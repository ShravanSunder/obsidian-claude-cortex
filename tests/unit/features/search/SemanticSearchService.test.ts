import {
  CODANNA_CONFIG,
  type McpToolInvoker,
  SemanticSearchService,
} from '@/features/search/SemanticSearchService';

describe('SemanticSearchService', () => {
  describe('isAvailable', () => {
    it('should return false when no MCP invoker is set', async () => {
      const service = new SemanticSearchService();
      const available = await service.isAvailable();
      expect(available).toBe(false);
    });

    it('should return true when Codanna responds to search tool', async () => {
      const service = new SemanticSearchService();
      const mockInvoker: McpToolInvoker = vi.fn().mockResolvedValue([]);

      service.setMcpInvoker(mockInvoker);
      const available = await service.isAvailable();

      expect(available).toBe(true);
      expect(mockInvoker).toHaveBeenCalledWith(CODANNA_CONFIG.serverName, 'search', {
        query: '',
        limit: 1,
      });
    });

    it('should try alternative tool names if primary fails', async () => {
      const service = new SemanticSearchService();
      let callCount = 0;
      const mockInvoker: McpToolInvoker = vi.fn().mockImplementation((_server, tool) => {
        callCount++;
        if (tool === 'search') {
          return Promise.reject(new Error('Tool not found'));
        }
        if (tool === 'semantic_search') {
          return Promise.resolve([]);
        }
        return Promise.reject(new Error('Tool not found'));
      });

      service.setMcpInvoker(mockInvoker);
      const available = await service.isAvailable();

      expect(available).toBe(true);
      expect(callCount).toBe(2); // search, then semantic_search
      expect(service.getDetectedTool()).toBe('semantic_search');
    });

    it('should return false when all tools fail', async () => {
      const service = new SemanticSearchService();
      const mockInvoker: McpToolInvoker = vi.fn().mockRejectedValue(new Error('Not available'));

      service.setMcpInvoker(mockInvoker);
      const available = await service.isAvailable();

      expect(available).toBe(false);
    });

    it('should cache availability result', async () => {
      const service = new SemanticSearchService();
      const mockInvoker: McpToolInvoker = vi.fn().mockResolvedValue([]);

      service.setMcpInvoker(mockInvoker);

      await service.isAvailable();
      await service.isAvailable();
      await service.isAvailable();

      // Should only check once due to caching
      expect(mockInvoker).toHaveBeenCalledTimes(1);
    });

    it('should reset cache when invoker changes', async () => {
      const service = new SemanticSearchService();
      const mockInvoker1: McpToolInvoker = vi.fn().mockResolvedValue([]);
      const mockInvoker2: McpToolInvoker = vi.fn().mockResolvedValue([]);

      service.setMcpInvoker(mockInvoker1);
      await service.isAvailable();
      expect(mockInvoker1).toHaveBeenCalledTimes(1);

      service.setMcpInvoker(mockInvoker2);
      await service.isAvailable();
      expect(mockInvoker2).toHaveBeenCalledTimes(1);
    });
  });

  describe('resetCache', () => {
    it('should force fresh availability check', async () => {
      const service = new SemanticSearchService();
      const mockInvoker: McpToolInvoker = vi.fn().mockResolvedValue([]);

      service.setMcpInvoker(mockInvoker);
      await service.isAvailable();
      expect(mockInvoker).toHaveBeenCalledTimes(1);

      service.resetCache();
      await service.isAvailable();
      expect(mockInvoker).toHaveBeenCalledTimes(2);
    });
  });

  describe('search', () => {
    it('should throw when MCP invoker not configured', async () => {
      const service = new SemanticSearchService();

      await expect(service.search('test query')).rejects.toThrow(
        'MCP invoker not configured. Call setMcpInvoker first.',
      );
    });

    it('should throw when Codanna is not available', async () => {
      const service = new SemanticSearchService();
      const mockInvoker: McpToolInvoker = vi.fn().mockRejectedValue(new Error('Not available'));

      service.setMcpInvoker(mockInvoker);

      await expect(service.search('test query')).rejects.toThrow(
        'Codanna is not available. Install it with: cargo install codanna --all-features',
      );
    });

    it('should return normalized search results', async () => {
      const service = new SemanticSearchService();
      const mockResults = [
        { file: 'note1.md', title: 'Note 1', score: 0.9, excerpt: 'Content 1' },
        { file: 'note2.md', title: 'Note 2', score: 0.8, content: 'Content 2' },
        { path: 'note3.md', name: 'Note 3', similarity: 0.7, text: 'Content 3' },
      ];
      const mockInvoker: McpToolInvoker = vi.fn().mockResolvedValue(mockResults);

      service.setMcpInvoker(mockInvoker);
      const results = await service.search('test query');

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({
        filePath: 'note1.md',
        title: 'Note 1',
        score: 0.9,
        excerpt: 'Content 1',
      });
      expect(results[1]).toEqual({
        filePath: 'note2.md',
        title: 'Note 2',
        score: 0.8,
        excerpt: 'Content 2',
      });
      expect(results[2]).toEqual({
        filePath: 'note3.md',
        title: 'Note 3',
        score: 0.7,
        excerpt: 'Content 3',
      });
    });

    it('should filter out results with empty file paths', async () => {
      const service = new SemanticSearchService();
      const mockResults = [
        { file: 'note1.md', title: 'Note 1', score: 0.9 },
        { title: 'No Path', score: 0.8 }, // No file path
        { file: '', title: 'Empty Path', score: 0.7 }, // Empty file path
      ];
      const mockInvoker: McpToolInvoker = vi.fn().mockResolvedValue(mockResults);

      service.setMcpInvoker(mockInvoker);
      const results = await service.search('test query');

      expect(results).toHaveLength(1);
      expect(results[0].filePath).toBe('note1.md');
    });

    it('should pass search options to MCP invoker', async () => {
      const service = new SemanticSearchService();
      const mockInvoker: McpToolInvoker = vi.fn().mockResolvedValue([]);

      service.setMcpInvoker(mockInvoker);
      await service.search('test query', {
        limit: 10,
        minScore: 0.6,
        folders: ['notes'],
        excludeFolders: ['archive'],
      });

      expect(mockInvoker).toHaveBeenLastCalledWith(CODANNA_CONFIG.serverName, 'search', {
        query: 'test query',
        limit: 10,
        min_score: 0.6,
        folders: ['notes'],
        exclude_folders: ['archive'],
      });
    });

    it('should return empty array on search error', async () => {
      const service = new SemanticSearchService();
      let firstCall = true;
      const mockInvoker: McpToolInvoker = vi.fn().mockImplementation(() => {
        if (firstCall) {
          firstCall = false;
          return Promise.resolve([]); // First call for availability check
        }
        return Promise.reject(new Error('Search failed'));
      });

      service.setMcpInvoker(mockInvoker);
      await service.isAvailable(); // Initialize
      const results = await service.search('test query');

      expect(results).toEqual([]);
    });

    it('should return empty array when result is not an array', async () => {
      const service = new SemanticSearchService();
      let firstCall = true;
      const mockInvoker: McpToolInvoker = vi.fn().mockImplementation(() => {
        if (firstCall) {
          firstCall = false;
          return Promise.resolve([]);
        }
        return Promise.resolve({ error: 'Invalid result' }); // Not an array
      });

      service.setMcpInvoker(mockInvoker);
      await service.isAvailable();
      const results = await service.search('test query');

      expect(results).toEqual([]);
    });
  });

  describe('getDetectedTool', () => {
    it('should return null when not yet checked', () => {
      const service = new SemanticSearchService();
      expect(service.getDetectedTool()).toBeNull();
    });

    it('should return detected tool name after availability check', async () => {
      const service = new SemanticSearchService();
      const mockInvoker: McpToolInvoker = vi.fn().mockResolvedValue([]);

      service.setMcpInvoker(mockInvoker);
      await service.isAvailable();

      expect(service.getDetectedTool()).toBe('search');
    });
  });

  describe('CODANNA_CONFIG', () => {
    it('should have correct configuration values', () => {
      expect(CODANNA_CONFIG.serverName).toBe('codanna');
      expect(CODANNA_CONFIG.searchTool).toBe('search');
      expect(CODANNA_CONFIG.installCommand).toBe('cargo install codanna --all-features');
      expect(CODANNA_CONFIG.githubUrl).toBe('https://github.com/bartolli/codanna');
      expect(CODANNA_CONFIG.rustUrl).toBe('https://rustup.rs');
    });
  });
});
