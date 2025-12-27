import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NodeIterator, FrozenNodeIterator, resumableIteration } from '../nodeiterator';
import type { InstaloaderContext } from '../instaloadercontext';
import type { JsonObject } from '../types';

// Create a mock context
function createMockContext(username: string | null = 'testuser'): InstaloaderContext {
  return {
    username,
    graphql_query: vi.fn(),
    doc_id_graphql_query: vi.fn(),
    log: vi.fn(),
    error: vi.fn(),
  } as unknown as InstaloaderContext;
}

// Helper to create edge data
function createEdges(nodes: JsonObject[]): {
  edges: Array<{ node: JsonObject }>;
  page_info: { has_next_page: boolean; end_cursor: string | null };
  count?: number;
} {
  return {
    edges: nodes.map((node) => ({ node })),
    page_info: { has_next_page: false, end_cursor: null },
  };
}

function createEdgesWithPagination(
  nodes: JsonObject[],
  hasNextPage: boolean,
  endCursor: string | null
): {
  edges: Array<{ node: JsonObject }>;
  page_info: { has_next_page: boolean; end_cursor: string | null };
  count?: number;
} {
  return {
    edges: nodes.map((node) => ({ node })),
    page_info: { has_next_page: hasNextPage, end_cursor: endCursor },
  };
}

describe('FrozenNodeIterator', () => {
  it('should create a frozen iterator with all properties', () => {
    const frozen = new FrozenNodeIterator({
      queryHash: 'abc123',
      queryVariables: { id: '123' },
      queryReferer: 'https://example.com',
      contextUsername: 'testuser',
      totalIndex: 5,
      bestBefore: Date.now() / 1000,
      remainingData: { edges: [], page_info: { has_next_page: false, end_cursor: null } },
      firstNode: { id: '1' },
      docId: undefined,
    });

    expect(frozen.queryHash).toBe('abc123');
    expect(frozen.queryVariables).toEqual({ id: '123' });
    expect(frozen.queryReferer).toBe('https://example.com');
    expect(frozen.contextUsername).toBe('testuser');
    expect(frozen.totalIndex).toBe(5);
    expect(frozen.firstNode).toEqual({ id: '1' });
  });

  it('should convert to object with toObject()', () => {
    const frozen = new FrozenNodeIterator({
      queryHash: 'abc123',
      queryVariables: { id: '123' },
      queryReferer: null,
      contextUsername: 'testuser',
      totalIndex: 0,
      bestBefore: null,
      remainingData: null,
      firstNode: null,
      docId: 'doc123',
    });

    const obj = frozen.toObject();
    expect(obj.queryHash).toBe('abc123');
    expect(obj.docId).toBe('doc123');
  });
});

describe('NodeIterator', () => {
  let context: InstaloaderContext;

  beforeEach(() => {
    context = createMockContext();
  });

  describe('constructor', () => {
    it('should create iterator with query_hash', async () => {
      const firstData = createEdges([{ id: '1' }, { id: '2' }]);

      const iterator = new NodeIterator<JsonObject>({
        context,
        queryHash: 'hash123',
        edgeExtractor: (data) => (data['data'] as JsonObject)?.['user'] as JsonObject,
        nodeWrapper: (node) => node,
        firstData,
      });

      expect(iterator.count).toBeUndefined(); // No count in test data
    });

    it('should create iterator with doc_id', async () => {
      const firstData = createEdges([{ id: '1' }]);

      const iterator = new NodeIterator<JsonObject>({
        context,
        queryHash: null,
        docId: 'doc123',
        edgeExtractor: (data) => data,
        nodeWrapper: (node) => node,
        firstData,
      });

      expect(iterator).toBeDefined();
    });

    it('should fetch initial data if firstData not provided', async () => {
      const mockData = createEdges([{ id: '1' }]);
      (context.graphql_query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: mockData });

      new NodeIterator<JsonObject>({
        context,
        queryHash: 'hash123',
        edgeExtractor: (data) => data['data'] as JsonObject,
        nodeWrapper: (node) => node,
      });

      // Wait for the constructor's async initialization
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(context.graphql_query).toHaveBeenCalled();
    });
  });

  describe('iteration', () => {
    it('should iterate through all nodes', async () => {
      const nodes = [{ id: '1' }, { id: '2' }, { id: '3' }];
      const firstData = createEdges(nodes);

      const iterator = new NodeIterator<JsonObject>({
        context,
        queryHash: 'hash123',
        edgeExtractor: (data) => data,
        nodeWrapper: (node) => node,
        firstData,
      });

      const results: JsonObject[] = [];
      for await (const item of iterator) {
        results.push(item);
      }

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({ id: '1' });
      expect(results[1]).toEqual({ id: '2' });
      expect(results[2]).toEqual({ id: '3' });
    });

    it('should handle pagination', async () => {
      const page1 = createEdgesWithPagination([{ id: '1' }, { id: '2' }], true, 'cursor1');
      const page2 = createEdges([{ id: '3' }, { id: '4' }]);

      (context.graphql_query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: page2 });

      const iterator = new NodeIterator<JsonObject>({
        context,
        queryHash: 'hash123',
        edgeExtractor: (data) => (data['data'] as JsonObject) ?? data,
        nodeWrapper: (node) => node,
        firstData: page1,
      });

      const results: JsonObject[] = [];
      for await (const item of iterator) {
        results.push(item);
      }

      expect(results).toHaveLength(4);
      expect(results.map((r) => r['id'])).toEqual(['1', '2', '3', '4']);
    });

    it('should track totalIndex correctly', async () => {
      const nodes = [{ id: '1' }, { id: '2' }, { id: '3' }];
      const firstData = createEdges(nodes);

      const iterator = new NodeIterator<JsonObject>({
        context,
        queryHash: 'hash123',
        edgeExtractor: (data) => data,
        nodeWrapper: (node) => node,
        firstData,
      });

      expect(iterator.totalIndex).toBe(0);

      const iter = iterator[Symbol.asyncIterator]();
      await iter.next();
      expect(iterator.totalIndex).toBe(1);

      await iter.next();
      expect(iterator.totalIndex).toBe(2);
    });
  });

  describe('firstItem', () => {
    it('should return first item after iteration starts', async () => {
      const nodes = [{ id: '1' }, { id: '2' }];
      const firstData = createEdges(nodes);

      const iterator = new NodeIterator<JsonObject>({
        context,
        queryHash: 'hash123',
        edgeExtractor: (data) => data,
        nodeWrapper: (node) => node,
        firstData,
      });

      expect(iterator.firstItem).toBeNull();

      const iter = iterator[Symbol.asyncIterator]();
      await iter.next();

      expect(iterator.firstItem).toEqual({ id: '1' });
    });

    it('should use isFirst callback to determine first item', async () => {
      const nodes = [
        { id: '2', date: 100 },
        { id: '1', date: 200 },
      ];
      const firstData = createEdges(nodes);

      const iterator = new NodeIterator<JsonObject>({
        context,
        queryHash: 'hash123',
        edgeExtractor: (data) => data,
        nodeWrapper: (node) => node,
        firstData,
        isFirst: (item, currentFirst) => {
          if (!currentFirst) return true;
          return (item['date'] as number) > (currentFirst['date'] as number);
        },
      });

      const iter = iterator[Symbol.asyncIterator]();
      await iter.next(); // { id: '2', date: 100 }
      await iter.next(); // { id: '1', date: 200 }

      // The item with higher date should be considered first
      expect(iterator.firstItem).toEqual({ id: '1', date: 200 });
    });
  });

  describe('magic', () => {
    it('should generate consistent magic string', () => {
      const firstData = createEdges([{ id: '1' }]);

      const iterator1 = new NodeIterator<JsonObject>({
        context,
        queryHash: 'hash123',
        edgeExtractor: (data) => data,
        nodeWrapper: (node) => node,
        queryVariables: { id: '456' },
        firstData,
      });

      const iterator2 = new NodeIterator<JsonObject>({
        context,
        queryHash: 'hash123',
        edgeExtractor: (data) => data,
        nodeWrapper: (node) => node,
        queryVariables: { id: '456' },
        firstData,
      });

      expect(iterator1.magic).toBe(iterator2.magic);
    });

    it('should generate different magic for different parameters', () => {
      const firstData = createEdges([{ id: '1' }]);

      const iterator1 = new NodeIterator<JsonObject>({
        context,
        queryHash: 'hash123',
        edgeExtractor: (data) => data,
        nodeWrapper: (node) => node,
        queryVariables: { id: '456' },
        firstData,
      });

      const iterator2 = new NodeIterator<JsonObject>({
        context,
        queryHash: 'hash123',
        edgeExtractor: (data) => data,
        nodeWrapper: (node) => node,
        queryVariables: { id: '789' }, // Different variable
        firstData,
      });

      expect(iterator1.magic).not.toBe(iterator2.magic);
    });
  });

  describe('freeze', () => {
    it('should freeze iterator state', async () => {
      const nodes = [{ id: '1' }, { id: '2' }, { id: '3' }];
      const firstData = createEdges(nodes);

      const iterator = new NodeIterator<JsonObject>({
        context,
        queryHash: 'hash123',
        edgeExtractor: (data) => data,
        nodeWrapper: (node) => node,
        queryVariables: { id: '456' },
        queryReferer: 'https://example.com',
        firstData,
      });

      // Iterate through some items
      const iter = iterator[Symbol.asyncIterator]();
      await iter.next();
      await iter.next();

      const frozen = iterator.freeze();

      expect(frozen.queryHash).toBe('hash123');
      expect(frozen.queryVariables).toEqual({ id: '456' });
      expect(frozen.queryReferer).toBe('https://example.com');
      expect(frozen.contextUsername).toBe('testuser');
      expect(frozen.totalIndex).toBe(1); // max(2-1, 0)
      expect(frozen.firstNode).toEqual({ id: '1' });
      expect(frozen.remainingData).toBeDefined();
    });
  });

  describe('thaw', () => {
    it('should restore iterator state from frozen', async () => {
      const nodes = [{ id: '1' }, { id: '2' }, { id: '3' }];
      const firstData = createEdges(nodes);

      const iterator = new NodeIterator<JsonObject>({
        context,
        queryHash: 'hash123',
        edgeExtractor: (data) => data,
        nodeWrapper: (node) => node,
        queryVariables: { id: '456' },
        firstData,
      });

      const frozen = new FrozenNodeIterator({
        queryHash: 'hash123',
        queryVariables: { id: '456' },
        queryReferer: null,
        contextUsername: 'testuser',
        totalIndex: 1,
        bestBefore: Date.now() / 1000 + 86400, // 1 day in future
        remainingData: {
          edges: [{ node: { id: '2' } }, { node: { id: '3' } }],
          page_info: { has_next_page: false, end_cursor: null },
        },
        firstNode: { id: '1' },
        docId: undefined,
      });

      iterator.thaw(frozen);

      expect(iterator.totalIndex).toBe(1);
      expect(iterator.firstItem).toEqual({ id: '1' });
    });

    it('should throw error if iterator already used', async () => {
      const nodes = [{ id: '1' }, { id: '2' }];
      const firstData = createEdges(nodes);

      const iterator = new NodeIterator<JsonObject>({
        context,
        queryHash: 'hash123',
        edgeExtractor: (data) => data,
        nodeWrapper: (node) => node,
        firstData,
      });

      // Use the iterator
      const iter = iterator[Symbol.asyncIterator]();
      await iter.next();

      const frozen = new FrozenNodeIterator({
        queryHash: 'hash123',
        queryVariables: {},
        queryReferer: null,
        contextUsername: 'testuser',
        totalIndex: 0,
        bestBefore: Date.now() / 1000 + 86400,
        remainingData: { edges: [], page_info: { has_next_page: false, end_cursor: null } },
        firstNode: null,
        docId: undefined,
      });

      expect(() => iterator.thaw(frozen)).toThrow('thaw() called on already-used iterator');
    });

    it('should throw error if frozen state does not match', async () => {
      const nodes = [{ id: '1' }];
      const firstData = createEdges(nodes);

      const iterator = new NodeIterator<JsonObject>({
        context,
        queryHash: 'hash123',
        edgeExtractor: (data) => data,
        nodeWrapper: (node) => node,
        firstData,
      });

      const frozen = new FrozenNodeIterator({
        queryHash: 'different_hash', // Mismatching hash
        queryVariables: {},
        queryReferer: null,
        contextUsername: 'testuser',
        totalIndex: 0,
        bestBefore: Date.now() / 1000 + 86400,
        remainingData: { edges: [], page_info: { has_next_page: false, end_cursor: null } },
        firstNode: null,
        docId: undefined,
      });

      expect(() => iterator.thaw(frozen)).toThrow('Mismatching resume information');
    });

    it('should throw error if best_before is missing', async () => {
      const nodes = [{ id: '1' }];
      const firstData = createEdges(nodes);

      const iterator = new NodeIterator<JsonObject>({
        context,
        queryHash: 'hash123',
        edgeExtractor: (data) => data,
        nodeWrapper: (node) => node,
        firstData,
      });

      const frozen = new FrozenNodeIterator({
        queryHash: 'hash123',
        queryVariables: {},
        queryReferer: null,
        contextUsername: 'testuser',
        totalIndex: 0,
        bestBefore: null, // Missing
        remainingData: { edges: [], page_info: { has_next_page: false, end_cursor: null } },
        firstNode: null,
        docId: undefined,
      });

      expect(() => iterator.thaw(frozen)).toThrow('"best before" date missing');
    });
  });

  describe('pageLength', () => {
    it('should return static page length', () => {
      expect(NodeIterator.pageLength()).toBe(12);
    });
  });

  describe('count', () => {
    it('should return count from data if available', async () => {
      const firstData = {
        edges: [{ node: { id: '1' } }],
        page_info: { has_next_page: false, end_cursor: null },
        count: 100,
      };

      const iterator = new NodeIterator<JsonObject>({
        context,
        queryHash: 'hash123',
        edgeExtractor: (data) => data,
        nodeWrapper: (node) => node,
        firstData,
      });

      expect(iterator.count).toBe(100);
    });
  });
});

describe('resumableIteration', () => {
  let context: InstaloaderContext;
  let loadFn: (context: InstaloaderContext, path: string) => Promise<FrozenNodeIterator>;
  let saveFn: (frozen: FrozenNodeIterator, path: string) => void;
  let formatPath: (magic: string) => string;

  beforeEach(() => {
    context = createMockContext();
    loadFn = vi.fn().mockRejectedValue(new Error('File not found'));
    saveFn = vi.fn();
    formatPath = (magic: string) => `/tmp/resume_${magic}.json`;
  });

  it('should yield false and 0 for non-NodeIterator', async () => {
    const simpleIterator = [1, 2, 3];

    const result = await resumableIteration({
      context,
      iterator: simpleIterator,
      load: loadFn,
      save: saveFn,
      formatPath,
    });

    expect(result.isResuming).toBe(false);
    expect(result.startIndex).toBe(0);
  });

  it('should yield false and 0 when disabled', async () => {
    const nodes = [{ id: '1' }];
    const firstData = createEdges(nodes);

    const iterator = new NodeIterator<JsonObject>({
      context,
      queryHash: 'hash123',
      edgeExtractor: (data) => data,
      nodeWrapper: (node) => node,
      firstData,
    });

    const result = await resumableIteration({
      context,
      iterator,
      load: loadFn,
      save: saveFn,
      formatPath,
      enabled: false,
    });

    expect(result.isResuming).toBe(false);
    expect(result.startIndex).toBe(0);
  });

  it('should successfully resume when state is found', async () => {
    const nodes = [{ id: '2' }, { id: '3' }];
    const remainingData = createEdges(nodes);

    const mockFrozen = new FrozenNodeIterator({
      queryHash: 'hash123',
      queryVariables: {},
      queryReferer: null,
      contextUsername: 'testuser',
      totalIndex: 1, // Resume from index 1
      bestBefore: Date.now() / 1000 + 86400,
      remainingData,
      firstNode: { id: '1' },
      docId: undefined,
    });

    loadFn = vi.fn().mockResolvedValue(mockFrozen);

    const firstData = createEdges([{ id: '1' }]);
    const iterator = new NodeIterator<JsonObject>({
      context,
      queryHash: 'hash123',
      edgeExtractor: (data) => data,
      nodeWrapper: (node) => node,
      firstData,
    });

    const result = await resumableIteration({
      context,
      iterator,
      load: loadFn,
      save: saveFn,
      formatPath,
    });

    expect(result.isResuming).toBe(true);
    expect(result.startIndex).toBe(1);
  });

  it('should throw error when checkBbd is true and best before date has exceeded', async () => {
    const nodes = [{ id: '2' }, { id: '3' }];
    const remainingData = createEdges(nodes);

    // Create frozen iterator with expired best before date (1 day in the past)
    const mockFrozen = new FrozenNodeIterator({
      queryHash: 'hash123',
      queryVariables: {},
      queryReferer: null,
      contextUsername: 'testuser',
      totalIndex: 1,
      bestBefore: Date.now() / 1000 - 86400, // 1 day ago (expired)
      remainingData,
      firstNode: { id: '1' },
      docId: undefined,
    });

    loadFn = vi.fn().mockResolvedValue(mockFrozen);

    const firstData = createEdges([{ id: '1' }]);
    const iterator = new NodeIterator<JsonObject>({
      context,
      queryHash: 'hash123',
      edgeExtractor: (data) => data,
      nodeWrapper: (node) => node,
      firstData,
    });

    // With checkBbd = true (default), expired date should cause a warning and start fresh
    const result = await resumableIteration({
      context,
      iterator,
      load: loadFn,
      save: saveFn,
      formatPath,
      checkBbd: true,
    });

    // Should log warning and start fresh
    expect(context.error).toHaveBeenCalledWith(
      expect.stringContaining('"Best before" date exceeded')
    );
    expect(result.isResuming).toBe(false);
    expect(result.startIndex).toBe(0);
  });

  it('should log warning when loaded state is not a FrozenNodeIterator', async () => {
    // Return a non-FrozenNodeIterator object
    loadFn = vi.fn().mockResolvedValue({ not: 'a frozen iterator' });

    const firstData = createEdges([{ id: '1' }]);
    const iterator = new NodeIterator<JsonObject>({
      context,
      queryHash: 'hash123',
      edgeExtractor: (data) => data,
      nodeWrapper: (node) => node,
      firstData,
    });

    const result = await resumableIteration({
      context,
      iterator,
      load: loadFn,
      save: saveFn,
      formatPath,
    });

    // Should log warning and start fresh
    expect(context.error).toHaveBeenCalledWith(expect.stringContaining('Invalid type'));
    expect(result.isResuming).toBe(false);
    expect(result.startIndex).toBe(0);
  });

  it('should skip checkBbd when checkBbd is false', async () => {
    const nodes = [{ id: '2' }, { id: '3' }];
    const remainingData = createEdges(nodes);

    // Create frozen iterator with expired best before date
    const mockFrozen = new FrozenNodeIterator({
      queryHash: 'hash123',
      queryVariables: {},
      queryReferer: null,
      contextUsername: 'testuser',
      totalIndex: 1,
      bestBefore: Date.now() / 1000 - 86400, // Expired
      remainingData,
      firstNode: { id: '1' },
      docId: undefined,
    });

    loadFn = vi.fn().mockResolvedValue(mockFrozen);

    const firstData = createEdges([{ id: '1' }]);
    const iterator = new NodeIterator<JsonObject>({
      context,
      queryHash: 'hash123',
      edgeExtractor: (data) => data,
      nodeWrapper: (node) => node,
      firstData,
    });

    // With checkBbd = false, should resume despite expired date
    const result = await resumableIteration({
      context,
      iterator,
      load: loadFn,
      save: saveFn,
      formatPath,
      checkBbd: false,
    });

    expect(result.isResuming).toBe(true);
    expect(result.startIndex).toBe(1);
  });
});
