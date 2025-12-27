/**
 * NodeIterator - Async iterator for paginated GraphQL results.
 *
 * Ported from Python instaloader/nodeiterator.py
 */

import { createHash } from 'crypto';
import type { InstaloaderContext } from './instaloader-context';
import type { JsonObject } from './types';
import { InvalidArgumentException } from './exceptions';

/**
 * Frozen state of a NodeIterator for resumable downloads.
 */
export class FrozenNodeIterator {
  readonly queryHash: string | null;
  readonly queryVariables: JsonObject;
  readonly queryReferer: string | null;
  readonly contextUsername: string | null;
  readonly totalIndex: number;
  readonly bestBefore: number | null;
  readonly remainingData: {
    edges: Array<{ node: JsonObject }>;
    page_info: { has_next_page: boolean; end_cursor: string | null };
    count?: number;
  } | null;
  readonly firstNode: JsonObject | null;
  readonly docId: string | undefined;

  constructor(params: {
    queryHash: string | null;
    queryVariables: JsonObject;
    queryReferer: string | null;
    contextUsername: string | null;
    totalIndex: number;
    bestBefore: number | null;
    remainingData: {
      edges: Array<{ node: JsonObject }>;
      page_info: { has_next_page: boolean; end_cursor: string | null };
      count?: number;
    } | null;
    firstNode: JsonObject | null;
    docId: string | undefined;
  }) {
    this.queryHash = params.queryHash;
    this.queryVariables = params.queryVariables;
    this.queryReferer = params.queryReferer;
    this.contextUsername = params.contextUsername;
    this.totalIndex = params.totalIndex;
    this.bestBefore = params.bestBefore;
    this.remainingData = params.remainingData;
    this.firstNode = params.firstNode;
    this.docId = params.docId;
  }

  /**
   * Convert to plain object for JSON serialization.
   */
  toObject(): {
    queryHash: string | null;
    queryVariables: JsonObject;
    queryReferer: string | null;
    contextUsername: string | null;
    totalIndex: number;
    bestBefore: number | null;
    remainingData: {
      edges: Array<{ node: JsonObject }>;
      page_info: { has_next_page: boolean; end_cursor: string | null };
      count?: number;
    } | null;
    firstNode: JsonObject | null;
    docId: string | undefined;
  } {
    return {
      queryHash: this.queryHash,
      queryVariables: this.queryVariables,
      queryReferer: this.queryReferer,
      contextUsername: this.contextUsername,
      totalIndex: this.totalIndex,
      bestBefore: this.bestBefore,
      remainingData: this.remainingData,
      firstNode: this.firstNode,
      docId: this.docId,
    };
  }

  /**
   * Create from plain object (JSON deserialization).
   */
  static fromObject(obj: ReturnType<FrozenNodeIterator['toObject']>): FrozenNodeIterator {
    return new FrozenNodeIterator(obj);
  }
}

interface NodeIteratorData {
  edges: Array<{ node: JsonObject }>;
  page_info: { has_next_page: boolean; end_cursor: string | null };
  count?: number;
}

export interface NodeIteratorOptions<T> {
  context: InstaloaderContext;
  queryHash: string | null;
  edgeExtractor: (data: JsonObject) => JsonObject;
  nodeWrapper: (node: JsonObject) => T;
  queryVariables?: JsonObject;
  queryReferer?: string | null;
  firstData?: NodeIteratorData;
  isFirst?: (item: T, currentFirst: T | null) => boolean;
  docId?: string;
}

/**
 * Iterate the nodes within edges in a GraphQL pagination.
 *
 * What makes this iterator special is its ability to freeze/store its current state,
 * e.g. to interrupt an iteration, and later thaw/resume from where it left off.
 *
 * @example
 * ```typescript
 * const postIterator = profile.getPosts();
 * try {
 *   for await (const post of postIterator) {
 *     await doSomethingWith(post);
 *   }
 * } catch (e) {
 *   if (e instanceof KeyboardInterrupt) {
 *     save("resume_information.json", postIterator.freeze());
 *   }
 * }
 * ```
 *
 * And later reuse it with `thaw()`:
 * ```typescript
 * const postIterator = profile.getPosts();
 * postIterator.thaw(load("resume_information.json"));
 * ```
 */
export class NodeIterator<T> implements AsyncIterable<T> {
  private static readonly _graphql_page_length = 12;
  private static readonly _shelf_life_days = 29;

  private readonly _context: InstaloaderContext;
  private readonly _queryHash: string | null;
  private readonly _docId: string | undefined;
  private readonly _edgeExtractor: (data: JsonObject) => JsonObject;
  private readonly _nodeWrapper: (node: JsonObject) => T;
  private readonly _queryVariables: JsonObject;
  private readonly _queryReferer: string | null;
  private readonly _isFirst: ((item: T, currentFirst: T | null) => boolean) | undefined;

  private _pageIndex = 0;
  private _totalIndex = 0;
  private _data: NodeIteratorData | null = null;
  private _bestBefore: Date | null = null;
  private _firstNode: JsonObject | null = null;
  private _initialized = false;
  private _initPromise: Promise<void> | null = null;

  constructor(options: NodeIteratorOptions<T>) {
    this._context = options.context;
    this._queryHash = options.queryHash;
    this._docId = options.docId;
    this._edgeExtractor = options.edgeExtractor;
    this._nodeWrapper = options.nodeWrapper;
    this._queryVariables = options.queryVariables ?? {};
    this._queryReferer = options.queryReferer ?? null;
    this._isFirst = options.isFirst;

    if (options.firstData !== undefined) {
      this._data = options.firstData;
      this._bestBefore = new Date(Date.now() + NodeIterator._shelf_life_days * 24 * 60 * 60 * 1000);
      this._initialized = true;
    } else {
      // Start async initialization
      this._initPromise = this._initialize();
    }
  }

  private async _initialize(): Promise<void> {
    if (this._initialized) return;
    this._data = await this._query();
    this._initialized = true;
  }

  private async _ensureInitialized(): Promise<void> {
    if (!this._initialized && this._initPromise) {
      await this._initPromise;
    }
  }

  private async _query(after?: string): Promise<NodeIteratorData> {
    if (this._docId !== undefined) {
      return this._queryDocId(this._docId, after);
    } else {
      if (this._queryHash === null) {
        throw new Error('Either queryHash or docId must be provided');
      }
      return this._queryQueryHash(this._queryHash, after);
    }
  }

  private async _queryDocId(docId: string, after?: string): Promise<NodeIteratorData> {
    const paginationVariables: JsonObject = {
      __relay_internal__pv__PolarisFeedShareMenurelayprovider: false,
    };
    if (after !== undefined) {
      paginationVariables['after'] = after;
      paginationVariables['before'] = null;
      paginationVariables['first'] = 12;
      paginationVariables['last'] = null;
    }

    const response = await this._context.doc_id_graphql_query(
      docId,
      { ...this._queryVariables, ...paginationVariables },
      this._queryReferer ?? undefined
    );

    const data = this._edgeExtractor(response as JsonObject) as unknown as NodeIteratorData;
    this._bestBefore = new Date(Date.now() + NodeIterator._shelf_life_days * 24 * 60 * 60 * 1000);
    return data;
  }

  private async _queryQueryHash(queryHash: string, after?: string): Promise<NodeIteratorData> {
    const paginationVariables: JsonObject = {
      first: NodeIterator._graphql_page_length,
    };
    if (after !== undefined) {
      paginationVariables['after'] = after;
    }

    const response = await this._context.graphql_query(
      queryHash,
      { ...this._queryVariables, ...paginationVariables },
      this._queryReferer ?? undefined
    );

    const data = this._edgeExtractor(response as JsonObject) as unknown as NodeIteratorData;
    this._bestBefore = new Date(Date.now() + NodeIterator._shelf_life_days * 24 * 60 * 60 * 1000);
    return data;
  }

  /**
   * The count as returned by Instagram.
   * This is not always the total count this iterator will yield.
   */
  get count(): number | undefined {
    return this._data?.count;
  }

  /**
   * Number of items that have already been returned.
   */
  get totalIndex(): number {
    return this._totalIndex;
  }

  /**
   * Magic string for easily identifying a matching iterator file for resuming.
   * Two NodeIterators are matching if and only if they have the same magic.
   */
  get magic(): string {
    const data = JSON.stringify([
      this._queryHash,
      this._queryVariables,
      this._queryReferer,
      this._context.username,
    ]);

    // Use blake2b-like hash (Node.js doesn't have blake2b built-in, use sha256 instead)
    const hash = createHash('sha256').update(data).digest();
    // Take first 6 bytes and base64url encode
    return hash.subarray(0, 6).toString('base64url');
  }

  /**
   * If this iterator has produced any items, returns the first item produced.
   *
   * It is possible to override what is considered the first item by passing
   * a callback function as the `isFirst` parameter when creating the class.
   */
  get firstItem(): T | null {
    return this._firstNode !== null ? this._nodeWrapper(this._firstNode) : null;
  }

  /**
   * Static page length used for pagination.
   */
  static pageLength(): number {
    return NodeIterator._graphql_page_length;
  }

  /**
   * Freeze the iterator for later resuming.
   */
  freeze(): FrozenNodeIterator {
    let remainingData: NodeIteratorData | null = null;
    if (this._data !== null) {
      remainingData = {
        ...this._data,
        edges: this._data.edges.slice(Math.max(this._pageIndex - 1, 0)),
      };
    }

    return new FrozenNodeIterator({
      queryHash: this._queryHash,
      queryVariables: this._queryVariables,
      queryReferer: this._queryReferer,
      contextUsername: this._context.username,
      totalIndex: Math.max(this._totalIndex - 1, 0),
      bestBefore: this._bestBefore ? this._bestBefore.getTime() / 1000 : null,
      remainingData,
      firstNode: this._firstNode,
      docId: this._docId,
    });
  }

  /**
   * Use this iterator for resuming from earlier iteration.
   *
   * @throws InvalidArgumentException if the iterator has already been used or the frozen state doesn't match
   */
  thaw(frozen: FrozenNodeIterator): void {
    if (this._totalIndex || this._pageIndex) {
      throw new InvalidArgumentException('thaw() called on already-used iterator.');
    }

    if (
      this._queryHash !== frozen.queryHash ||
      JSON.stringify(this._queryVariables) !== JSON.stringify(frozen.queryVariables) ||
      this._queryReferer !== frozen.queryReferer ||
      this._context.username !== frozen.contextUsername ||
      this._docId !== frozen.docId
    ) {
      throw new InvalidArgumentException('Mismatching resume information.');
    }

    if (!frozen.bestBefore) {
      throw new InvalidArgumentException('"best before" date missing.');
    }

    if (frozen.remainingData === null) {
      throw new InvalidArgumentException('"remaining_data" missing.');
    }

    this._totalIndex = frozen.totalIndex;
    this._bestBefore = new Date(frozen.bestBefore * 1000);
    this._data = frozen.remainingData;
    this._initialized = true;

    if (frozen.firstNode !== null) {
      this._firstNode = frozen.firstNode;
    }
  }

  /**
   * Async iterator implementation.
   */
  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    await this._ensureInitialized();

    while (true) {
      if (this._data === null) {
        return;
      }

      // Process current page
      while (this._pageIndex < this._data.edges.length) {
        const edge = this._data.edges[this._pageIndex];
        if (!edge) break;
        const node = edge.node;
        this._pageIndex += 1;
        this._totalIndex += 1;

        const item = this._nodeWrapper(node);

        // Track first item
        if (this._isFirst !== undefined) {
          if (this._isFirst(item, this.firstItem)) {
            this._firstNode = node;
          }
        } else {
          if (this._firstNode === null) {
            this._firstNode = node;
          }
        }

        yield item;
      }

      // Check for next page
      if (this._data.page_info?.has_next_page && this._data.page_info.end_cursor) {
        const queryResponse = await this._query(this._data.page_info.end_cursor);

        // Check if we got new data
        if (
          JSON.stringify(this._data.edges) !== JSON.stringify(queryResponse.edges) &&
          queryResponse.edges.length > 0
        ) {
          this._pageIndex = 0;
          this._data = queryResponse;
          continue;
        }
      }

      // No more data
      return;
    }
  }
}

/**
 * Options for resumable iteration.
 */
export interface ResumableIterationOptions<T> {
  context: InstaloaderContext;
  iterator: AsyncIterable<T> | Iterable<T>;
  load: (
    context: InstaloaderContext,
    path: string
  ) => FrozenNodeIterator | Promise<FrozenNodeIterator>;
  save: (frozen: FrozenNodeIterator, path: string) => void | Promise<void>;
  formatPath: (magic: string) => string;
  checkBbd?: boolean;
  enabled?: boolean;
}

/**
 * Result of resumable iteration setup.
 */
export interface ResumableIterationResult {
  isResuming: boolean;
  startIndex: number;
}

/**
 * High-level function to handle resumable iteration.
 *
 * Note: Unlike Python's context manager, this returns the resumption info
 * and the caller is responsible for handling interrupts.
 *
 * @example
 * ```typescript
 * const postIterator = profile.getPosts();
 * const { isResuming, startIndex } = await resumableIteration({
 *   context: L.context,
 *   iterator: postIterator,
 *   load: async (_, path) => FrozenNodeIterator.fromObject(JSON.parse(await fs.readFile(path, 'utf-8'))),
 *   save: async (fni, path) => fs.writeFile(path, JSON.stringify(fni.toObject())),
 *   formatPath: (magic) => `resume_info_${magic}.json`,
 * });
 *
 * try {
 *   for await (const post of postIterator) {
 *     await doSomethingWith(post);
 *   }
 * } catch (e) {
 *   // Save state on interrupt
 *   if (postIterator instanceof NodeIterator) {
 *     await save(postIterator.freeze(), formatPath(postIterator.magic));
 *   }
 *   throw e;
 * }
 * ```
 */
export async function resumableIteration<T>(
  options: ResumableIterationOptions<T>
): Promise<ResumableIterationResult> {
  // Note: save is not used directly here - caller is responsible for saving on interrupt
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {
    context,
    iterator,
    load,
    save: _save,
    formatPath,
    checkBbd = true,
    enabled = true,
  } = options;

  // If disabled or not a NodeIterator, just return defaults
  if (!enabled || !(iterator instanceof NodeIterator)) {
    return { isResuming: false, startIndex: 0 };
  }

  const nodeIterator = iterator as NodeIterator<T>;
  let isResuming = false;
  let startIndex = 0;
  const resumeFilePath = formatPath(nodeIterator.magic);

  // Try to load existing resume file
  try {
    // Note: In a real implementation, you'd check if file exists first
    // For now, we assume load() throws if file doesn't exist
    const fni = await Promise.resolve(load(context, resumeFilePath));

    if (!(fni instanceof FrozenNodeIterator)) {
      throw new InvalidArgumentException('Invalid type.');
    }

    if (checkBbd && fni.bestBefore && new Date(fni.bestBefore * 1000) < new Date()) {
      throw new InvalidArgumentException('"Best before" date exceeded.');
    }

    nodeIterator.thaw(fni);
    isResuming = true;
    startIndex = nodeIterator.totalIndex;
    context.log(`Resuming from ${resumeFilePath}.`);
  } catch (e) {
    // File doesn't exist or is invalid - that's okay, start fresh
    if (e instanceof InvalidArgumentException) {
      context.error(`Warning: Not resuming from ${resumeFilePath}: ${e.message}`);
    }
    // Other errors (like file not found) are silently ignored
  }

  return { isResuming, startIndex };
}
