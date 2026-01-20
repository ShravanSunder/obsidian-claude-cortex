/**
 * Integration tests for SDK session isolation behavior.
 *
 * These tests call the actual Claude Code CLI to verify:
 * 1. New query() without resume = fresh session (no prior context)
 * 2. Query() with resume = loads conversation history
 * 3. Rapid session switching doesn't cause context leakage
 *
 * IMPORTANT: These tests require:
 * - Claude Code CLI installed and authenticated
 * - ANTHROPIC_API_KEY set in environment
 * - Run with: CORTEX_SDK_TESTS=1 pnpm test session-isolation
 *
 * Tests are skipped by default to avoid API costs during regular test runs.
 */

import { query as agentQuery } from '@anthropic-ai/claude-agent-sdk';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const SKIP_SDK_TESTS = !process.env.CORTEX_SDK_TESTS;
const TEST_CWD = path.join(os.tmpdir(), 'cortex-sdk-test');

// Skip all tests if CORTEX_SDK_TESTS is not set
const describeOrSkip = SKIP_SDK_TESTS ? describe.skip : describe;

interface QueryResult {
  sessionId: string | null;
  textContent: string;
  allMessages: unknown[];
}

/**
 * Helper to send a message and collect the response.
 * Uses minimal options to isolate SDK behavior.
 */
async function sendMessage(prompt: string, options?: { resume?: string }): Promise<QueryResult> {
  const response = agentQuery({
    prompt,
    options: {
      cwd: TEST_CWD,
      model: 'claude-haiku-4-5',
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      ...options,
    },
  });

  let sessionId: string | null = null;
  let textContent = '';
  const allMessages: unknown[] = [];

  for await (const message of response) {
    allMessages.push(message);

    // Capture session ID from init message
    // SDK uses snake_case: session_id (not sessionId)
    if (
      message.type === 'system' &&
      'subtype' in message &&
      message.subtype === 'init' &&
      'session_id' in message
    ) {
      sessionId = (message as { session_id: string }).session_id;
    }

    // Capture text content from assistant messages
    if (message.type === 'assistant' && 'message' in message) {
      const msg = message.message as { content?: Array<{ type: string; text?: string }> };
      if (msg.content) {
        for (const block of msg.content) {
          if (block.type === 'text' && block.text) {
            textContent += block.text;
          }
        }
      }
    }
  }

  return { sessionId, textContent, allMessages };
}

describeOrSkip('SDK Session Isolation (Real CLI)', () => {
  beforeAll(() => {
    // Ensure test directory exists
    if (!fs.existsSync(TEST_CWD)) {
      fs.mkdirSync(TEST_CWD, { recursive: true });
    }
    console.log(`Using test directory: ${TEST_CWD}`);
  });

  afterAll(() => {
    // Cleanup test directory
    try {
      fs.rmSync(TEST_CWD, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should create unique session ID for each query without resume', async () => {
    // Query 1
    const result1 = await sendMessage('Say exactly: "Response 1"');
    expect(result1.sessionId).toBeTruthy();

    // Query 2 - should get a DIFFERENT session ID
    const result2 = await sendMessage('Say exactly: "Response 2"');
    expect(result2.sessionId).toBeTruthy();
    expect(result2.sessionId).not.toBe(result1.sessionId);

    console.log('Session 1:', result1.sessionId);
    console.log('Session 2:', result2.sessionId);
  }, 60000); // 60s timeout for real API calls

  it('should NOT retain context between queries without resume', async () => {
    // Query 1: Establish secret context
    const SECRET = `SECRET_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const result1 = await sendMessage(
      `Remember this secret code: ${SECRET}. Just say "I will remember ${SECRET}" and nothing else.`,
    );
    expect(result1.sessionId).toBeTruthy();
    expect(result1.textContent).toContain(SECRET);

    // Query 2: Ask for the secret WITHOUT resume - should NOT know it
    const result2 = await sendMessage(
      'What is the secret code I told you? If you don\'t know any secret code, say "I have no prior context".',
    );
    expect(result2.sessionId).not.toBe(result1.sessionId);

    // The response should NOT contain the secret
    const hasSecret = result2.textContent.includes(SECRET);
    const hasNoContext =
      result2.textContent.toLowerCase().includes('no prior context') ||
      result2.textContent.toLowerCase().includes("don't have") ||
      result2.textContent.toLowerCase().includes("haven't been") ||
      result2.textContent.toLowerCase().includes("don't know");

    console.log('Query 1 response:', result1.textContent.substring(0, 200));
    console.log('Query 2 response:', result2.textContent.substring(0, 200));
    console.log('Has secret in response:', hasSecret);
    console.log('Has "no context" indicator:', hasNoContext);

    // CRITICAL: If this fails, the SDK is leaking context
    expect(hasSecret).toBe(false);
    // We also expect Claude to indicate it has no prior context
    // (but this is a softer assertion since Claude might phrase it differently)
  }, 120000);

  it('should restore context WITH resume option', async () => {
    // Query 1: Establish context
    const SECRET = `RESUME_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const result1 = await sendMessage(
      `Remember this code: ${SECRET}. Say "I will remember ${SECRET}" and nothing else.`,
    );
    expect(result1.sessionId).toBeTruthy();

    // Query 2: Resume and ask for the secret - SHOULD know it
    const result2 = await sendMessage('What is the code I told you to remember?', {
      resume: result1.sessionId!,
    });

    console.log('Original session:', result1.sessionId);
    console.log('Resumed response:', result2.textContent.substring(0, 200));

    // The response SHOULD contain the secret when resuming
    expect(result2.textContent).toContain(SECRET);
  }, 120000);

  it('should isolate rapid sequential sessions', async () => {
    // Create session A with unique context
    const SECRET_A = `ALPHA_${Date.now()}`;
    const sessionA = await sendMessage(
      `In this session, the code is ${SECRET_A}. Say "Code: ${SECRET_A}".`,
    );
    expect(sessionA.sessionId).toBeTruthy();

    // Create session B with different context
    const SECRET_B = `BETA_${Date.now()}`;
    const sessionB = await sendMessage(
      `In this session, the code is ${SECRET_B}. Say "Code: ${SECRET_B}".`,
    );
    expect(sessionB.sessionId).toBeTruthy();
    expect(sessionB.sessionId).not.toBe(sessionA.sessionId);

    // Resume session A - should only have A's context
    const checkA = await sendMessage('What code did I tell you?', {
      resume: sessionA.sessionId!,
    });
    expect(checkA.textContent).toContain(SECRET_A);
    expect(checkA.textContent).not.toContain(SECRET_B);

    // Resume session B - should only have B's context
    const checkB = await sendMessage('What code did I tell you?', {
      resume: sessionB.sessionId!,
    });
    expect(checkB.textContent).toContain(SECRET_B);
    expect(checkB.textContent).not.toContain(SECRET_A);

    console.log('Session A check:', checkA.textContent.substring(0, 100));
    console.log('Session B check:', checkB.textContent.substring(0, 100));
  }, 180000);

  it('should log SDK messages for debugging', async () => {
    const result = await sendMessage('Say "Debug test complete"');

    console.log('\n=== SDK Message Types ===');
    const messageTypes = result.allMessages.map((m: unknown) => {
      const msg = m as { type?: string; subtype?: string };
      return msg.subtype ? `${msg.type}:${msg.subtype}` : msg.type;
    });
    console.log(messageTypes.join(', '));

    console.log('\n=== Full Messages ===');
    console.log(JSON.stringify(result.allMessages, null, 2).substring(0, 2000));

    expect(result.sessionId).toBeTruthy();
  }, 60000);
});

describeOrSkip('SDK Subprocess Behavior', () => {
  beforeAll(() => {
    if (!fs.existsSync(TEST_CWD)) {
      fs.mkdirSync(TEST_CWD, { recursive: true });
    }
  });

  it('should trace whether subprocess is reused across queries', async () => {
    // This test helps understand SDK's subprocess lifecycle
    const startTime = Date.now();

    // Query 1 - first spawn
    const t1 = Date.now();
    const result1 = await sendMessage('Say "1"');
    const duration1 = Date.now() - t1;

    // Query 2 - might be faster if subprocess is reused
    const t2 = Date.now();
    const result2 = await sendMessage('Say "2"');
    const duration2 = Date.now() - t2;

    // Query 3
    const t3 = Date.now();
    const result3 = await sendMessage('Say "3"');
    const duration3 = Date.now() - t3;

    console.log('\n=== Timing Analysis ===');
    console.log(`Query 1: ${duration1}ms (session: ${result1.sessionId?.substring(0, 8)}...)`);
    console.log(`Query 2: ${duration2}ms (session: ${result2.sessionId?.substring(0, 8)}...)`);
    console.log(`Query 3: ${duration3}ms (session: ${result3.sessionId?.substring(0, 8)}...)`);
    console.log(`Total: ${Date.now() - startTime}ms`);

    // If subprocess is reused, queries 2 and 3 should be significantly faster
    // than query 1 (no cold start penalty)
    // This is informational - we're not asserting specific timing

    expect(result1.sessionId).toBeTruthy();
    expect(result2.sessionId).toBeTruthy();
    expect(result3.sessionId).toBeTruthy();
  }, 180000);
});
