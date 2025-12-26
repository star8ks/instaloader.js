/**
 * Data structures for Instagram content.
 * Ported from Python instaloader/structures.py
 */

import {
  BadResponseException,
  InvalidArgumentException,
  IPhoneSupportDisabledException,
  LoginRequiredException,
  PostChangedException,
  ProfileNotExistsException,
  QueryReturnedNotFoundException,
} from './exceptions';
import type { JsonObject, JsonValue, FrozenIteratorState } from './types';

// =============================================================================
// Forward declarations / Placeholder interfaces
// These will be replaced when InstaloaderContext and NodeIterator are ported
// =============================================================================

/**
 * Placeholder interface for InstaloaderContext.
 * Will be replaced with actual implementation when instaloadercontext.ts is ported.
 */
export interface InstaloaderContext {
  readonly iphone_support: boolean;
  readonly is_logged_in: boolean;
  readonly username: string | null;
  readonly profile_id_cache: Map<number, Profile>;

  graphql_query(
    queryHash: string,
    variables: JsonObject,
    referer?: string
  ): Promise<JsonObject>;

  doc_id_graphql_query(
    docId: string,
    variables: JsonObject,
    referer?: string
  ): Promise<JsonObject>;

  get_json(path: string, params: JsonObject): Promise<JsonObject>;

  get_iphone_json(path: string, params: JsonObject): Promise<JsonObject>;

  head(
    url: string,
    options?: { allow_redirects?: boolean }
  ): Promise<{ headers: Map<string, string> }>;

  error(message: string): void;
  log(message: string): void;
}

/**
 * Placeholder for NodeIterator.
 * Will be replaced with actual implementation when nodeiterator.ts is ported.
 */
export interface NodeIterator<T> extends AsyncIterable<T> {
  readonly count: number | null;
  readonly total_index: number;
  readonly magic: string;
  readonly first_item: T | null;

  freeze(): FrozenIteratorState;
  thaw(frozen: FrozenIteratorState): void;
}

// =============================================================================
// Regex patterns for parsing captions
// =============================================================================

/**
 * Regex pattern to find hashtags in text.
 */
const HASHTAG_REGEX = /(?:#)(\w{1,150})/g;

/**
 * Regex pattern to find @mentions in text.
 * Modified from jStassen, adjusted for JavaScript's \w.
 */
const MENTION_REGEX = /(?:^|[^\w\n]|_)(?:@)(\w(?:(?:\w|(?:\.(?!\.))){0,28}(?:\w))?)/g;

// =============================================================================
// Helper types and interfaces
// =============================================================================

/**
 * Item of a Sidecar Post.
 */
export interface PostSidecarNode {
  /** Whether this node is a video. */
  is_video: boolean;
  /** URL of image or video thumbnail. */
  display_url: string;
  /** URL of video or null. */
  video_url: string | null;
}

/**
 * Answer to a comment.
 */
export interface PostCommentAnswer {
  /** ID number of comment. */
  id: number;
  /** Timestamp when comment was created (UTC). */
  created_at_utc: Date;
  /** Comment text. */
  text: string;
  /** Owner Profile of the comment. */
  owner: Profile;
  /** Number of likes on comment. */
  likes_count: number;
}

/**
 * Location associated with a post.
 */
export interface PostLocation {
  /** ID number of location. */
  id: number;
  /** Location name. */
  name: string;
  /** URL friendly variant of location name. */
  slug: string;
  /** Whether location has a public page. */
  has_public_page: boolean | null;
  /** Latitude (number or null). */
  lat: number | null;
  /** Longitude (number or null). */
  lng: number | null;
}

// =============================================================================
// Helper functions
// =============================================================================

/**
 * Normalize a string using NFC normalization, or return null if input is null/undefined.
 */
function optionalNormalize(str: string | null | undefined): string | null {
  if (str != null) {
    return str.normalize('NFC');
  }
  return null;
}

/**
 * Convert a shortcode to a mediaid.
 */
export function shortcodeToMediaid(code: string): bigint {
  if (code.length > 11) {
    throw new InvalidArgumentException(
      `Wrong shortcode "${code}", unable to convert to mediaid.`
    );
  }
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let mediaid = BigInt(0);
  for (const char of code) {
    mediaid = mediaid * BigInt(64) + BigInt(alphabet.indexOf(char));
  }
  return mediaid;
}

/**
 * Convert a mediaid to a shortcode.
 */
export function mediaidToShortcode(mediaid: bigint): string {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let shortcode = '';
  let id = mediaid;
  while (id > 0) {
    shortcode = alphabet[Number(id % BigInt(64))] + shortcode;
    id = id / BigInt(64);
  }
  return shortcode || 'A';
}

/**
 * Extract hashtags from text.
 */
export function extractHashtags(text: string): string[] {
  const matches: string[] = [];
  let match;
  const regex = new RegExp(HASHTAG_REGEX.source, 'g');
  while ((match = regex.exec(text.toLowerCase())) !== null) {
    matches.push(match[1]!);
  }
  return matches;
}

/**
 * Extract @mentions from text.
 */
export function extractMentions(text: string): string[] {
  const matches: string[] = [];
  let match;
  const regex = new RegExp(MENTION_REGEX.source, 'g');
  while ((match = regex.exec(text.toLowerCase())) !== null) {
    matches.push(match[1]!);
  }
  return matches;
}

/**
 * Ellipsify a caption for display purposes.
 */
function ellipsifyCaption(caption: string): string {
  const pcaption = caption
    .split('\n')
    .filter((s) => s)
    .map((s) => s.replace(/\//g, '\u2215'))
    .join(' ')
    .trim();
  return pcaption.length > 31 ? pcaption.slice(0, 30) + '\u2026' : pcaption;
}

// =============================================================================
// PostComment class
// =============================================================================

/**
 * Represents a comment on a post.
 */
export class PostComment {
  private readonly _context: InstaloaderContext;
  private readonly _node: JsonObject;
  private readonly _answers: AsyncIterable<PostCommentAnswer>;
  private readonly _post: Post;

  constructor(
    context: InstaloaderContext,
    node: JsonObject,
    answers: AsyncIterable<PostCommentAnswer>,
    post: Post
  ) {
    this._context = context;
    this._node = node;
    this._answers = answers;
    this._post = post;
  }

  /**
   * Create a PostComment from an iPhone API struct.
   */
  static fromIphoneStruct(
    context: InstaloaderContext,
    media: JsonObject,
    answers: AsyncIterable<PostCommentAnswer>,
    post: Post
  ): PostComment {
    return new PostComment(
      context,
      {
        id: media['pk'] as number,
        created_at: media['created_at'] as number,
        text: media['text'] as string,
        edge_liked_by: {
          count: media['comment_like_count'] as number,
        },
        iphone_struct: media,
      },
      answers,
      post
    );
  }

  /** ID number of comment. */
  get id(): number {
    return this._node['id'] as number;
  }

  /** Timestamp when comment was created (UTC). */
  get created_at_utc(): Date {
    return new Date((this._node['created_at'] as number) * 1000);
  }

  /** Comment text. */
  get text(): string {
    return this._node['text'] as string;
  }

  /** Owner Profile of the comment. */
  get owner(): Profile {
    if ('iphone_struct' in this._node) {
      const iphoneStruct = this._node['iphone_struct'] as JsonObject;
      return Profile.fromIphoneStruct(
        this._context,
        iphoneStruct['user'] as JsonObject
      );
    }
    return new Profile(this._context, this._node['owner'] as JsonObject);
  }

  /** Number of likes on comment. */
  get likes_count(): number {
    const edgeLikedBy = this._node['edge_liked_by'] as JsonObject | undefined;
    return (edgeLikedBy?.['count'] as number) ?? 0;
  }

  /** Iterator which yields all PostCommentAnswer for the comment. */
  get answers(): AsyncIterable<PostCommentAnswer> {
    return this._answers;
  }

  toString(): string {
    return `<PostComment ${this.id} of ${this._post.shortcode}>`;
  }
}

// =============================================================================
// Post class
// =============================================================================

/**
 * Structure containing information about an Instagram post.
 *
 * Created by methods Profile.get_posts(), Instaloader.get_hashtag_posts(),
 * Instaloader.get_feed_posts() and Profile.get_saved_posts().
 *
 * This class unifies access to the properties associated with a post.
 * It implements equality comparison and is hashable.
 */
export class Post {
  private readonly _context: InstaloaderContext;
  private _node: JsonObject;
  private _owner_profile: Profile | null;
  private _full_metadata_dict: JsonObject | null = null;
  private _location: PostLocation | null = null;
  private _iphone_struct_: JsonObject | null = null;

  /**
   * @param context InstaloaderContext used for additional queries if necessary.
   * @param node Node structure, as returned by Instagram.
   * @param owner_profile The Profile of the owner, if already known at creation.
   */
  constructor(
    context: InstaloaderContext,
    node: JsonObject,
    owner_profile: Profile | null = null
  ) {
    if (!('shortcode' in node) && !('code' in node)) {
      throw new Error("Node must contain 'shortcode' or 'code'");
    }
    this._context = context;
    this._node = node;
    this._owner_profile = owner_profile;
    if ('iphone_struct' in node) {
      this._iphone_struct_ = node['iphone_struct'] as JsonObject;
    }
  }

  /**
   * Create a post object from a given shortcode.
   */
  static async fromShortcode(
    context: InstaloaderContext,
    shortcode: string
  ): Promise<Post> {
    const post = new Post(context, { shortcode });
    post._node = await post._getFullMetadata();
    return post;
  }

  /**
   * Create a post object from a given mediaid.
   */
  static async fromMediaid(
    context: InstaloaderContext,
    mediaid: bigint
  ): Promise<Post> {
    return Post.fromShortcode(context, mediaidToShortcode(mediaid));
  }

  /**
   * Create a post from a given iphone_struct.
   */
  static fromIphoneStruct(
    context: InstaloaderContext,
    media: JsonObject
  ): Post {
    const mediaTypes: Record<number, string> = {
      1: 'GraphImage',
      2: 'GraphVideo',
      8: 'GraphSidecar',
    };

    const mediaType = media['media_type'] as number;
    const typename = mediaTypes[mediaType] ?? 'GraphImage';
    const caption = media['caption'] as JsonObject | null;

    const fakeNode: JsonObject = {
      shortcode: media['code'] as string,
      id: media['pk'] as string,
      __typename: typename,
      is_video: typename === 'GraphVideo',
      date: media['taken_at'] as number,
      caption: caption?.['text'] as string | null ?? null,
      title: (media['title'] as string) ?? null,
      viewer_has_liked: media['has_liked'] as boolean,
      edge_media_preview_like: { count: media['like_count'] as number },
      accessibility_caption: (media['accessibility_caption'] as string) ?? null,
      comments: (media['comment_count'] as number) ?? 0,
      iphone_struct: media,
    };

    // Try to get display_url
    try {
      const imageVersions = media['image_versions2'] as JsonObject | undefined;
      const candidates = imageVersions?.['candidates'] as JsonValue[] | undefined;
      if (candidates && candidates.length > 0) {
        const firstCandidate = candidates[0] as JsonObject;
        fakeNode['display_url'] = firstCandidate['url'] as string;
      }
    } catch {
      // Ignore
    }

    // Try to get video info
    try {
      const videoVersions = media['video_versions'] as JsonValue[] | undefined;
      if (videoVersions && videoVersions.length > 0) {
        const lastVideo = videoVersions[videoVersions.length - 1] as JsonObject;
        fakeNode['video_url'] = lastVideo['url'] as string;
        fakeNode['video_duration'] = media['video_duration'] as number;
        fakeNode['video_view_count'] = media['view_count'] as number;
      }
    } catch {
      // Ignore
    }

    // Try to get carousel/sidecar children
    try {
      const carouselMedia = media['carousel_media'] as JsonValue[] | undefined;
      if (carouselMedia) {
        fakeNode['edge_sidecar_to_children'] = {
          edges: carouselMedia.map((node) =>
            ({ node: Post._convertIphoneCarousel(node as JsonObject, mediaTypes) })
          ),
        };
      }
    } catch {
      // Ignore
    }

    const ownerProfile =
      'user' in media
        ? Profile.fromIphoneStruct(context, media['user'] as JsonObject)
        : null;

    return new Post(context, fakeNode, ownerProfile);
  }

  private static _convertIphoneCarousel(
    iphoneNode: JsonObject,
    mediaTypes: Record<number, string>
  ): JsonObject {
    const mediaType = iphoneNode['media_type'] as number;
    const imageVersions = iphoneNode['image_versions2'] as JsonObject;
    const candidates = imageVersions['candidates'] as JsonValue[];
    const firstCandidate = candidates[0] as JsonObject;

    const fakeNode: JsonObject = {
      display_url: firstCandidate['url'] as string,
      is_video: mediaTypes[mediaType] === 'GraphVideo',
    };

    const videoVersions = iphoneNode['video_versions'] as JsonValue[] | undefined;
    if (videoVersions && videoVersions.length > 0) {
      const firstVideo = videoVersions[0] as JsonObject;
      fakeNode['video_url'] = firstVideo['url'] as string;
    }

    return fakeNode;
  }

  /** The values of __typename fields that the Post class can handle. */
  static supportedGraphqlTypes(): string[] {
    return ['GraphImage', 'GraphVideo', 'GraphSidecar'];
  }

  /** Media shortcode. URL of the post is instagram.com/p/<shortcode>/. */
  get shortcode(): string {
    return (this._node['shortcode'] as string) ?? (this._node['code'] as string);
  }

  /** The mediaid is a decimal representation of the media shortcode. */
  get mediaid(): bigint {
    return BigInt(this._node['id'] as string);
  }

  /** Title of post */
  get title(): string | null {
    try {
      return this._field('title') as string | null;
    } catch {
      return null;
    }
  }

  toString(): string {
    return `<Post ${this.shortcode}>`;
  }

  equals(other: Post): boolean {
    return this.shortcode === other.shortcode;
  }

  private async _obtainMetadata(): Promise<void> {
    if (!this._full_metadata_dict) {
      const result = await this._context.doc_id_graphql_query(
        '8845758582119845',
        { shortcode: this.shortcode }
      );
      const data = result['data'] as JsonObject;
      const picJson = data['xdt_shortcode_media'] as JsonObject | null;

      if (picJson === null) {
        throw new BadResponseException('Fetching Post metadata failed.');
      }

      const xdtTypes: Record<string, string> = {
        XDTGraphImage: 'GraphImage',
        XDTGraphVideo: 'GraphVideo',
        XDTGraphSidecar: 'GraphSidecar',
      };

      const typename = picJson['__typename'] as string;
      if (!(typename in xdtTypes)) {
        throw new BadResponseException(
          `Unknown __typename in metadata: ${typename}.`
        );
      }
      picJson['__typename'] = xdtTypes[typename]!;

      this._full_metadata_dict = picJson;

      if (this.shortcode !== (this._full_metadata_dict['shortcode'] as string)) {
        Object.assign(this._node, this._full_metadata_dict);
        throw new PostChangedException();
      }
    }
  }

  private async _getFullMetadata(): Promise<JsonObject> {
    await this._obtainMetadata();
    return this._full_metadata_dict!;
  }

  /**
   * Get iPhone struct for high quality media.
   * Reserved for future use to fetch HQ images.
   */
  // @ts-expect-error Reserved for future HQ image fetching
  private async _getIphoneStruct(): Promise<JsonObject> {
    if (!this._context.iphone_support) {
      throw new IPhoneSupportDisabledException('iPhone support is disabled.');
    }
    if (!this._context.is_logged_in) {
      throw new LoginRequiredException(
        'Login required to access iPhone media info endpoint.'
      );
    }
    if (!this._iphone_struct_) {
      const data = await this._context.get_iphone_json(
        `api/v1/media/${this.mediaid}/info/`,
        {}
      );
      const items = data['items'] as JsonValue[];
      this._iphone_struct_ = items[0] as JsonObject;
    }
    return this._iphone_struct_;
  }

  /**
   * Lookup fields in _node, and if not found in _full_metadata.
   * Throws if not found anywhere.
   */
  private _field(...keys: string[]): JsonValue {
    try {
      let d: JsonValue = this._node;
      for (const key of keys) {
        if (typeof d !== 'object' || d === null || Array.isArray(d)) {
          throw new Error('Key not found');
        }
        d = d[key]!;
        if (d === undefined) {
          throw new Error('Key not found');
        }
      }
      return d;
    } catch {
      // Will need async version for full metadata lookup
      throw new Error(
        `Field ${keys.join('.')} not found. Use async method for full metadata.`
      );
    }
  }

  /**
   * Async version of _field that can fetch full metadata if needed.
   */
  async getField(...keys: string[]): Promise<JsonValue> {
    try {
      let d: JsonValue = this._node;
      for (const key of keys) {
        if (typeof d !== 'object' || d === null || Array.isArray(d)) {
          throw new Error('Key not found');
        }
        d = d[key]!;
        if (d === undefined) {
          throw new Error('Key not found');
        }
      }
      return d;
    } catch {
      const fullMetadata = await this._getFullMetadata();
      let d: JsonValue = fullMetadata;
      for (const key of keys) {
        if (typeof d !== 'object' || d === null || Array.isArray(d)) {
          throw new Error('Key not found');
        }
        d = d[key]!;
        if (d === undefined) {
          throw new Error('Key not found');
        }
      }
      return d;
    }
  }

  /** Profile instance of the Post's owner. */
  async getOwnerProfile(): Promise<Profile> {
    if (!this._owner_profile) {
      const owner = this._node['owner'] as JsonObject | undefined;
      if (owner && 'username' in owner) {
        this._owner_profile = new Profile(this._context, owner);
      } else {
        const fullMetadata = await this._getFullMetadata();
        const ownerStruct = fullMetadata['owner'] as JsonObject;
        this._owner_profile = new Profile(this._context, ownerStruct);
      }
    }
    return this._owner_profile;
  }

  /** The Post's lowercase owner name. */
  async getOwnerUsername(): Promise<string> {
    return (await this.getOwnerProfile()).username;
  }

  /** The ID of the Post's owner. */
  get owner_id(): number | null {
    const owner = this._node['owner'] as JsonObject | undefined;
    if (owner && 'id' in owner) {
      return Number(owner['id']);
    }
    return null;
  }

  /** Timestamp when the post was created (local time zone). */
  get date_local(): Date {
    return new Date(this._getTimestampDateCreated() * 1000);
  }

  /** Timestamp when the post was created (UTC). */
  get date_utc(): Date {
    return new Date(this._getTimestampDateCreated() * 1000);
  }

  /** Synonym to date_utc */
  get date(): Date {
    return this.date_utc;
  }

  private _getTimestampDateCreated(): number {
    return (
      (this._node['date'] as number) ??
      (this._node['taken_at_timestamp'] as number)
    );
  }

  /** URL of the picture / video thumbnail of the post */
  get url(): string {
    return (
      (this._node['display_url'] as string) ??
      (this._node['display_src'] as string)
    );
  }

  /** Type of post: GraphImage, GraphVideo or GraphSidecar */
  get typename(): string {
    return this._field('__typename') as string;
  }

  /** The number of media in a sidecar Post, or 1 if not a sidecar. */
  get mediacount(): number {
    if (this.typename === 'GraphSidecar') {
      try {
        const edges = this._field(
          'edge_sidecar_to_children',
          'edges'
        ) as JsonValue[];
        return edges.length;
      } catch {
        return 1;
      }
    }
    return 1;
  }

  /** Caption. */
  get caption(): string | null {
    const edgeMediaToCaption = this._node['edge_media_to_caption'] as JsonObject | undefined;
    if (edgeMediaToCaption) {
      const edges = edgeMediaToCaption['edges'] as JsonValue[];
      if (edges && edges.length > 0) {
        const firstEdge = edges[0] as JsonObject;
        const node = firstEdge['node'] as JsonObject;
        return optionalNormalize(node['text'] as string);
      }
    }
    if ('caption' in this._node) {
      return optionalNormalize(this._node['caption'] as string);
    }
    return null;
  }

  /** List of all lowercased hashtags (without preceding #) that occur in the Post's caption. */
  get caption_hashtags(): string[] {
    if (!this.caption) {
      return [];
    }
    return extractHashtags(this.caption);
  }

  /** List of all lowercased profiles that are mentioned in the Post's caption, without preceding @. */
  get caption_mentions(): string[] {
    if (!this.caption) {
      return [];
    }
    return extractMentions(this.caption);
  }

  /** Printable caption, useful as a format specifier for --filename-pattern. */
  get pcaption(): string {
    return this.caption ? ellipsifyCaption(this.caption) : '';
  }

  /** Accessibility caption of the post, if available. */
  get accessibility_caption(): string | null {
    try {
      return this._field('accessibility_caption') as string | null;
    } catch {
      return null;
    }
  }

  /** List of all lowercased users that are tagged in the Post. */
  get tagged_users(): string[] {
    try {
      const edges = this._field(
        'edge_media_to_tagged_user',
        'edges'
      ) as JsonValue[];
      return edges.map((edge) => {
        const e = edge as JsonObject;
        const node = e['node'] as JsonObject;
        const user = node['user'] as JsonObject;
        return (user['username'] as string).toLowerCase();
      });
    } catch {
      return [];
    }
  }

  /** True if the Post is a video. */
  get is_video(): boolean {
    return this._node['is_video'] as boolean;
  }

  /** URL of the video, or null. */
  get video_url(): string | null {
    if (this.is_video) {
      try {
        return this._field('video_url') as string;
      } catch {
        return null;
      }
    }
    return null;
  }

  /** View count of the video, or null. */
  get video_view_count(): number | null {
    if (this.is_video) {
      try {
        return this._field('video_view_count') as number;
      } catch {
        return null;
      }
    }
    return null;
  }

  /** Duration of the video in seconds, or null. */
  get video_duration(): number | null {
    if (this.is_video) {
      try {
        return this._field('video_duration') as number;
      } catch {
        return null;
      }
    }
    return null;
  }

  /** Whether the viewer has liked the post, or null if not logged in. */
  get viewer_has_liked(): boolean | null {
    if (!this._context.is_logged_in) {
      return null;
    }
    const likes = this._node['likes'] as JsonObject | undefined;
    if (likes && 'viewer_has_liked' in likes) {
      return likes['viewer_has_liked'] as boolean;
    }
    try {
      return this._field('viewer_has_liked') as boolean;
    } catch {
      return null;
    }
  }

  /** Likes count */
  get likes(): number {
    try {
      return this._field('edge_media_preview_like', 'count') as number;
    } catch {
      return 0;
    }
  }

  /** Comment count including answers */
  get comments(): number {
    const edgeMediaToComment = this._node['edge_media_to_comment'] as JsonObject | undefined;
    if (edgeMediaToComment && 'count' in edgeMediaToComment) {
      return edgeMediaToComment['count'] as number;
    }
    try {
      return this._field('edge_media_to_parent_comment', 'count') as number;
    } catch {
      try {
        return this._field('edge_media_to_comment', 'count') as number;
      } catch {
        return 0;
      }
    }
  }

  /** Whether Post is a sponsored post. */
  get is_sponsored(): boolean {
    try {
      const sponsorEdges = this._field(
        'edge_media_to_sponsor_user',
        'edges'
      ) as JsonValue[];
      return sponsorEdges.length > 0;
    } catch {
      return false;
    }
  }

  /** Returns true if is_video for each media in sidecar. */
  getIsVideos(): boolean[] {
    if (this.typename === 'GraphSidecar') {
      try {
        const edges = this._field(
          'edge_sidecar_to_children',
          'edges'
        ) as JsonValue[];
        return edges.map((edge) => {
          const e = edge as JsonObject;
          const node = e['node'] as JsonObject;
          return node['is_video'] as boolean;
        });
      } catch {
        return [this.is_video];
      }
    }
    return [this.is_video];
  }

  /** Sidecar nodes of a Post with typename==GraphSidecar. */
  *getSidecarNodes(start = 0, end = -1): Generator<PostSidecarNode> {
    if (this.typename !== 'GraphSidecar') {
      return;
    }

    try {
      const edges = this._field(
        'edge_sidecar_to_children',
        'edges'
      ) as JsonValue[];
      const actualEnd = end < 0 ? edges.length - 1 : end;
      const actualStart = start < 0 ? edges.length - 1 : start;

      for (let idx = 0; idx < edges.length; idx++) {
        if (idx >= actualStart && idx <= actualEnd) {
          const edge = edges[idx] as JsonObject;
          const node = edge['node'] as JsonObject;
          const isVideo = node['is_video'] as boolean;
          const displayUrl = node['display_url'] as string;
          const videoUrl = isVideo ? (node['video_url'] as string) : null;

          yield {
            is_video: isVideo,
            display_url: displayUrl,
            video_url: videoUrl,
          };
        }
      }
    } catch {
      // No sidecar children found
    }
  }

  /** Returns Post as a JSON-serializable object. */
  toJSON(): JsonObject {
    const node = { ...this._node };
    if (this._full_metadata_dict) {
      Object.assign(node, this._full_metadata_dict);
    }
    if (this._location) {
      node['location'] = this._location as unknown as JsonValue;
    }
    if (this._iphone_struct_) {
      node['iphone_struct'] = this._iphone_struct_;
    }
    return node;
  }
}

// =============================================================================
// Profile class
// =============================================================================

/**
 * An Instagram Profile.
 *
 * Provides methods for accessing profile properties, as well as get_posts()
 * and for own profile get_saved_posts().
 *
 * This class implements equality comparison and is hashable.
 */
export class Profile {
  private readonly _context: InstaloaderContext;
  private _node: JsonObject;
  // Reserved for future has_public_story implementation
  // @ts-expect-error Reserved for future use
  private _has_public_story: boolean | null = null;
  private _has_full_metadata = false;
  private _iphone_struct_: JsonObject | null = null;

  constructor(context: InstaloaderContext, node: JsonObject) {
    if (!('username' in node)) {
      throw new Error("Node must contain 'username'");
    }
    this._context = context;
    this._node = node;
    if ('iphone_struct' in node) {
      this._iphone_struct_ = node['iphone_struct'] as JsonObject;
    }
  }

  /**
   * Create a Profile instance from a given username.
   * Raises exception if it does not exist.
   */
  static async fromUsername(
    context: InstaloaderContext,
    username: string
  ): Promise<Profile> {
    const profile = new Profile(context, { username: username.toLowerCase() });
    await profile._obtainMetadata();
    return profile;
  }

  /**
   * Create a Profile instance from a given userid.
   * If possible, use fromUsername or constructor instead.
   */
  static async fromId(
    context: InstaloaderContext,
    profileId: number
  ): Promise<Profile> {
    const cached = context.profile_id_cache.get(profileId);
    if (cached) {
      return cached;
    }

    const data = await context.graphql_query('7c16654f22c819fb63d1183034a5162f', {
      user_id: String(profileId),
      include_chaining: false,
      include_reel: true,
      include_suggested_users: false,
      include_logged_out_extras: false,
      include_highlight_reels: false,
    });

    const userData = (data['data'] as JsonObject)['user'] as JsonObject | null;
    if (userData) {
      const reel = userData['reel'] as JsonObject;
      const owner = reel['owner'] as JsonObject;
      const profile = new Profile(context, owner);
      context.profile_id_cache.set(profileId, profile);
      return profile;
    }

    throw new ProfileNotExistsException(
      `No profile found, the user may have blocked you (ID: ${profileId}).`
    );
  }

  /**
   * Create a profile from a given iphone_struct.
   */
  static fromIphoneStruct(
    context: InstaloaderContext,
    media: JsonObject
  ): Profile {
    return new Profile(context, {
      id: media['pk'] as string,
      username: media['username'] as string,
      is_private: media['is_private'] as boolean,
      full_name: media['full_name'] as string,
      profile_pic_url_hd: media['profile_pic_url'] as string,
      iphone_struct: media,
    });
  }

  /**
   * Return own profile if logged-in.
   */
  static async ownProfile(context: InstaloaderContext): Promise<Profile> {
    if (!context.is_logged_in) {
      throw new LoginRequiredException('Login required to access own profile.');
    }
    const data = await context.graphql_query('d6f4427fbe92d846298cf93df0b937d3', {});
    const userData = (data['data'] as JsonObject)['user'] as JsonObject;
    return new Profile(context, userData);
  }

  private async _obtainMetadata(): Promise<void> {
    try {
      if (!this._has_full_metadata) {
        const metadata = await this._context.get_iphone_json(
          `api/v1/users/web_profile_info/?username=${this.username}`,
          {}
        );
        const data = metadata['data'] as JsonObject;
        const user = data['user'] as JsonObject | null;
        if (user === null) {
          throw new ProfileNotExistsException(
            `Profile ${this.username} does not exist.`
          );
        }
        this._node = user;
        this._has_full_metadata = true;
      }
    } catch (err) {
      if (
        err instanceof QueryReturnedNotFoundException ||
        err instanceof TypeError
      ) {
        // Try to find similar profiles
        const topSearch = new TopSearchResults(this._context, this.username);
        const profiles: string[] = [];
        for await (const profile of topSearch.getProfiles()) {
          profiles.push(profile.username);
          if (profiles.length >= 5) break;
        }

        if (profiles.length > 0) {
          if (profiles.includes(this.username)) {
            throw new ProfileNotExistsException(
              `Profile ${this.username} seems to exist, but could not be loaded.`
            );
          }
          const plural = profiles.length > 1 ? 's are' : ' is';
          throw new ProfileNotExistsException(
            `Profile ${this.username} does not exist.\nThe most similar profile${plural}: ${profiles.slice(0, 5).join(', ')}.`
          );
        }
        throw new ProfileNotExistsException(
          `Profile ${this.username} does not exist.`
        );
      }
      throw err;
    }
  }

  private _metadata(...keys: string[]): JsonValue {
    let d: JsonValue = this._node;
    for (const key of keys) {
      if (typeof d !== 'object' || d === null || Array.isArray(d)) {
        throw new Error('Key not found');
      }
      d = d[key]!;
      if (d === undefined) {
        throw new Error('Key not found');
      }
    }
    return d;
  }

  /**
   * Async version that can fetch full metadata if needed.
   */
  async getMetadata(...keys: string[]): Promise<JsonValue> {
    try {
      return this._metadata(...keys);
    } catch {
      await this._obtainMetadata();
      return this._metadata(...keys);
    }
  }

  /** User ID */
  get userid(): number {
    return Number(this._metadata('id'));
  }

  /** Profile Name (lowercase) */
  get username(): string {
    return (this._metadata('username') as string).toLowerCase();
  }

  toString(): string {
    try {
      return `<Profile ${this.username} (${this.userid})>`;
    } catch {
      return `<Profile ${this.username}>`;
    }
  }

  equals(other: Profile): boolean {
    try {
      return this.userid === other.userid;
    } catch {
      return this.username === other.username;
    }
  }

  /** Whether this is a private profile */
  get is_private(): boolean {
    return this._metadata('is_private') as boolean;
  }

  /** Whether the viewer follows this profile */
  get followed_by_viewer(): boolean {
    try {
      return this._metadata('followed_by_viewer') as boolean;
    } catch {
      return false;
    }
  }

  /** Number of posts */
  async getMediacount(): Promise<number> {
    return (await this.getMetadata('edge_owner_to_timeline_media', 'count')) as number;
  }

  /** Number of followers */
  async getFollowers(): Promise<number> {
    return (await this.getMetadata('edge_followed_by', 'count')) as number;
  }

  /** Number of followees */
  async getFollowees(): Promise<number> {
    return (await this.getMetadata('edge_follow', 'count')) as number;
  }

  /** External URL in bio */
  async getExternalUrl(): Promise<string | null> {
    try {
      return (await this.getMetadata('external_url')) as string | null;
    } catch {
      return null;
    }
  }

  /** Whether this is a business account */
  async getIsBusinessAccount(): Promise<boolean> {
    try {
      return (await this.getMetadata('is_business_account')) as boolean;
    } catch {
      return false;
    }
  }

  /** Business category name */
  async getBusinessCategoryName(): Promise<string | null> {
    try {
      return (await this.getMetadata('business_category_name')) as string | null;
    } catch {
      return null;
    }
  }

  /** Biography (normalized) */
  async getBiography(): Promise<string> {
    const bio = (await this.getMetadata('biography')) as string;
    return bio.normalize('NFC');
  }

  /** Full name */
  async getFullName(): Promise<string> {
    return (await this.getMetadata('full_name')) as string;
  }

  /** Whether the viewer blocked this profile */
  get blocked_by_viewer(): boolean {
    try {
      return this._metadata('blocked_by_viewer') as boolean;
    } catch {
      return false;
    }
  }

  /** Whether this profile follows the viewer */
  get follows_viewer(): boolean {
    try {
      return this._metadata('follows_viewer') as boolean;
    } catch {
      return false;
    }
  }

  /** Whether this profile has blocked the viewer */
  get has_blocked_viewer(): boolean {
    try {
      return this._metadata('has_blocked_viewer') as boolean;
    } catch {
      return false;
    }
  }

  /** Whether this profile is verified */
  async getIsVerified(): Promise<boolean> {
    try {
      return (await this.getMetadata('is_verified')) as boolean;
    } catch {
      return false;
    }
  }

  /** Profile picture URL */
  async getProfilePicUrl(): Promise<string> {
    if (this._context.iphone_support && this._context.is_logged_in) {
      try {
        if (!this._iphone_struct_) {
          const data = await this._context.get_iphone_json(
            `api/v1/users/${this.userid}/info/`,
            {}
          );
          this._iphone_struct_ = data['user'] as JsonObject;
        }
        const hdInfo = this._iphone_struct_['hd_profile_pic_url_info'] as JsonObject;
        return hdInfo['url'] as string;
      } catch (err) {
        this._context.error(`Unable to fetch high quality profile pic: ${err}`);
        return (await this.getMetadata('profile_pic_url_hd')) as string;
      }
    }
    return (await this.getMetadata('profile_pic_url_hd')) as string;
  }

  /** Returns Profile as a JSON-serializable object. */
  toJSON(): JsonObject {
    const jsonNode = { ...this._node };
    // Remove posts to avoid circular reference
    delete jsonNode['edge_media_collections'];
    delete jsonNode['edge_owner_to_timeline_media'];
    delete jsonNode['edge_saved_media'];
    delete jsonNode['edge_felix_video_timeline'];
    if (this._iphone_struct_) {
      jsonNode['iphone_struct'] = this._iphone_struct_;
    }
    return jsonNode;
  }
}

// =============================================================================
// StoryItem class
// =============================================================================

/**
 * Structure containing information about a user story item (image or video).
 *
 * Created by method Story.get_items(). This class implements equality comparison
 * and is hashable.
 */
export class StoryItem {
  private readonly _context: InstaloaderContext;
  private readonly _node: JsonObject;
  private _owner_profile: Profile | null;
  private _iphone_struct_: JsonObject | null = null;

  constructor(
    context: InstaloaderContext,
    node: JsonObject,
    owner_profile: Profile | null = null
  ) {
    this._context = context;
    this._node = node;
    this._owner_profile = owner_profile;
    if ('iphone_struct' in node) {
      this._iphone_struct_ = node['iphone_struct'] as JsonObject;
    }
  }

  /**
   * Create a StoryItem object from a given mediaid.
   */
  static async fromMediaid(
    context: InstaloaderContext,
    mediaid: bigint
  ): Promise<StoryItem> {
    const picJson = await context.graphql_query(
      '2b0673e0dc4580674a88d426fe00ea90',
      { shortcode: mediaidToShortcode(mediaid) }
    );
    const shortcodeMedia = (picJson['data'] as JsonObject)[
      'shortcode_media'
    ] as JsonObject | null;
    if (shortcodeMedia === null) {
      throw new BadResponseException('Fetching StoryItem metadata failed.');
    }
    return new StoryItem(context, shortcodeMedia);
  }

  /** The mediaid is a decimal representation of the media shortcode. */
  get mediaid(): bigint {
    return BigInt(this._node['id'] as string);
  }

  /** Convert mediaid to a shortcode-like string. */
  get shortcode(): string {
    return mediaidToShortcode(this.mediaid);
  }

  toString(): string {
    return `<StoryItem ${this.mediaid}>`;
  }

  equals(other: StoryItem): boolean {
    return this.mediaid === other.mediaid;
  }

  /** Profile instance of the story item's owner. */
  async getOwnerProfile(): Promise<Profile> {
    if (!this._owner_profile) {
      const owner = this._node['owner'] as JsonObject;
      this._owner_profile = await Profile.fromId(
        this._context,
        Number(owner['id'])
      );
    }
    return this._owner_profile;
  }

  /** The StoryItem owner's lowercase name. */
  async getOwnerUsername(): Promise<string> {
    return (await this.getOwnerProfile()).username;
  }

  /** The ID of the StoryItem owner. */
  async getOwnerId(): Promise<number> {
    return (await this.getOwnerProfile()).userid;
  }

  /** Timestamp when the StoryItem was created (local time zone). */
  get date_local(): Date {
    return new Date((this._node['taken_at_timestamp'] as number) * 1000);
  }

  /** Timestamp when the StoryItem was created (UTC). */
  get date_utc(): Date {
    return new Date((this._node['taken_at_timestamp'] as number) * 1000);
  }

  /** Synonym to date_utc */
  get date(): Date {
    return this.date_utc;
  }

  /** Timestamp when the StoryItem will get unavailable (local time zone). */
  get expiring_local(): Date {
    return new Date((this._node['expiring_at_timestamp'] as number) * 1000);
  }

  /** Timestamp when the StoryItem will get unavailable (UTC). */
  get expiring_utc(): Date {
    return new Date((this._node['expiring_at_timestamp'] as number) * 1000);
  }

  /** URL of the picture / video thumbnail of the StoryItem */
  get url(): string {
    const displayResources = this._node['display_resources'] as JsonValue[];
    const lastResource = displayResources[displayResources.length - 1] as JsonObject;
    return lastResource['src'] as string;
  }

  /** Type of story item: GraphStoryImage or GraphStoryVideo */
  get typename(): string {
    return this._node['__typename'] as string;
  }

  /** Caption. */
  get caption(): string | null {
    const edgeMediaToCaption = this._node['edge_media_to_caption'] as JsonObject | undefined;
    if (edgeMediaToCaption) {
      const edges = edgeMediaToCaption['edges'] as JsonValue[];
      if (edges && edges.length > 0) {
        const firstEdge = edges[0] as JsonObject;
        const node = firstEdge['node'] as JsonObject;
        return optionalNormalize(node['text'] as string);
      }
    }
    if ('caption' in this._node) {
      return optionalNormalize(this._node['caption'] as string);
    }
    return null;
  }

  /** List of all lowercased hashtags in the StoryItem's caption. */
  get caption_hashtags(): string[] {
    if (!this.caption) {
      return [];
    }
    return extractHashtags(this.caption);
  }

  /** List of all lowercased profiles mentioned in the StoryItem's caption. */
  get caption_mentions(): string[] {
    if (!this.caption) {
      return [];
    }
    return extractMentions(this.caption);
  }

  /** Printable caption. */
  get pcaption(): string {
    return this.caption ? ellipsifyCaption(this.caption) : '';
  }

  /** True if the StoryItem is a video. */
  get is_video(): boolean {
    return this._node['is_video'] as boolean;
  }

  /** URL of the video, or null. */
  get video_url(): string | null {
    if (this.is_video) {
      try {
        const videoResources = this._node['video_resources'] as JsonValue[];
        const lastResource = videoResources[videoResources.length - 1] as JsonObject;
        return lastResource['src'] as string;
      } catch {
        return null;
      }
    }
    return null;
  }

  /** Returns StoryItem as a JSON-serializable object. */
  toJSON(): JsonObject {
    const node = { ...this._node };
    if (this._owner_profile) {
      node['owner'] = this._owner_profile.toJSON();
    }
    if (this._iphone_struct_) {
      node['iphone_struct'] = this._iphone_struct_;
    }
    return node;
  }
}

// =============================================================================
// Story class
// =============================================================================

/**
 * Structure representing a user story with its associated items.
 *
 * Provides methods for accessing story properties, as well as getItems()
 * to request associated StoryItem nodes.
 *
 * This class implements equality comparison and is hashable.
 */
export class Story {
  protected readonly _context: InstaloaderContext;
  protected readonly _node: JsonObject;
  protected _unique_id: string | null = null;
  protected _owner_profile: Profile | null = null;
  protected _iphone_struct_: JsonObject | null = null;

  constructor(context: InstaloaderContext, node: JsonObject) {
    this._context = context;
    this._node = node;
  }

  toString(): string {
    const date = this.latest_media_utc;
    return `<Story by ${this.owner_username} changed ${date.toISOString()}>`;
  }

  equals(other: Story): boolean {
    return this.unique_id === other.unique_id;
  }

  /**
   * This ID only equals amongst Story instances which have the same owner
   * and the same set of StoryItem.
   */
  get unique_id(): string {
    if (!this._unique_id) {
      const items = this._node['items'] as JsonValue[];
      const idList = items
        .map((item) => BigInt((item as JsonObject)['id'] as string))
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      this._unique_id = String(this.owner_id) + idList.map(String).join('');
    }
    return this._unique_id;
  }

  /** Timestamp of the most recent StoryItem that has been watched or null (local time zone). */
  get last_seen_local(): Date | null {
    const seen = this._node['seen'] as number | null;
    if (seen) {
      return new Date(seen * 1000);
    }
    return null;
  }

  /** Timestamp of the most recent StoryItem that has been watched or null (UTC). */
  get last_seen_utc(): Date | null {
    return this.last_seen_local;
  }

  /** Timestamp when the last item of the story was created (local time zone). */
  get latest_media_local(): Date {
    return new Date((this._node['latest_reel_media'] as number) * 1000);
  }

  /** Timestamp when the last item of the story was created (UTC). */
  get latest_media_utc(): Date {
    return new Date((this._node['latest_reel_media'] as number) * 1000);
  }

  /** Count of items associated with the Story instance. */
  get itemcount(): number {
    return (this._node['items'] as JsonValue[]).length;
  }

  /** Profile instance of the story owner. */
  get owner_profile(): Profile {
    if (!this._owner_profile) {
      this._owner_profile = new Profile(
        this._context,
        this._node['user'] as JsonObject
      );
    }
    return this._owner_profile;
  }

  /** The story owner's lowercase username. */
  get owner_username(): string {
    return this.owner_profile.username;
  }

  /** The story owner's ID. */
  get owner_id(): number {
    return this.owner_profile.userid;
  }

  protected async _fetchIphoneStruct(): Promise<void> {
    if (
      this._context.iphone_support &&
      this._context.is_logged_in &&
      !this._iphone_struct_
    ) {
      const data = await this._context.get_iphone_json(
        `api/v1/feed/reels_media/?reel_ids=${this.owner_id}`,
        {}
      );
      const reels = data['reels'] as JsonObject;
      this._iphone_struct_ = reels[String(this.owner_id)] as JsonObject;
    }
  }

  /** Retrieve all items from a story. */
  async *getItems(): AsyncGenerator<StoryItem> {
    await this._fetchIphoneStruct();
    const items = [...(this._node['items'] as JsonValue[])].reverse();

    for (const item of items) {
      const itemObj = { ...(item as JsonObject) };

      if (this._iphone_struct_ !== null) {
        const iphoneItems = this._iphone_struct_['items'] as JsonValue[];
        for (const iphoneItem of iphoneItems) {
          const iphoneObj = iphoneItem as JsonObject;
          if (String(iphoneObj['pk']) === String(itemObj['id'])) {
            itemObj['iphone_struct'] = iphoneObj;
            break;
          }
        }
      }

      yield new StoryItem(this._context, itemObj, this.owner_profile);
    }
  }
}

// =============================================================================
// Highlight class
// =============================================================================

/**
 * Structure representing a user's highlight with its associated story items.
 *
 * Extends Story and provides methods for accessing highlight properties.
 */
export class Highlight extends Story {
  private _items: JsonValue[] | null = null;

  constructor(
    context: InstaloaderContext,
    node: JsonObject,
    owner: Profile | null = null
  ) {
    super(context, node);
    this._owner_profile = owner;
  }

  override toString(): string {
    return `<Highlight by ${this.owner_username}: ${this.title}>`;
  }

  /** A unique ID identifying this set of highlights. */
  override get unique_id(): string {
    return String(this._node['id']);
  }

  /** Profile instance of the highlights' owner. */
  override get owner_profile(): Profile {
    if (!this._owner_profile) {
      this._owner_profile = new Profile(
        this._context,
        this._node['owner'] as JsonObject
      );
    }
    return this._owner_profile;
  }

  /** The title of these highlights. */
  get title(): string {
    return this._node['title'] as string;
  }

  /** URL of the highlights' cover. */
  get cover_url(): string {
    const coverMedia = this._node['cover_media'] as JsonObject;
    return coverMedia['thumbnail_src'] as string;
  }

  /** URL of the cropped version of the cover. */
  get cover_cropped_url(): string {
    const coverMedia = this._node['cover_media_cropped_thumbnail'] as JsonObject;
    return coverMedia['url'] as string;
  }

  private async _fetchItems(): Promise<void> {
    if (!this._items) {
      const data = await this._context.graphql_query(
        '45246d3fe16ccc6577e0bd297a5db1ab',
        {
          reel_ids: [],
          tag_names: [],
          location_ids: [],
          highlight_reel_ids: [String(this.unique_id)],
          precomposed_overlay: false,
        }
      );
      const dataObj = data['data'] as JsonObject;
      const reelsMedia = dataObj['reels_media'] as JsonValue[];
      const firstReel = reelsMedia[0] as JsonObject;
      this._items = firstReel['items'] as JsonValue[];
    }
  }

  protected override async _fetchIphoneStruct(): Promise<void> {
    if (
      this._context.iphone_support &&
      this._context.is_logged_in &&
      !this._iphone_struct_
    ) {
      const data = await this._context.get_iphone_json(
        `api/v1/feed/reels_media/?reel_ids=highlight:${this.unique_id}`,
        {}
      );
      const reels = data['reels'] as JsonObject;
      this._iphone_struct_ = reels[`highlight:${this.unique_id}`] as JsonObject;
    }
  }

  /** Count of items associated with the Highlight instance. */
  override get itemcount(): number {
    // Note: This is synchronous in Python but we can't easily do that here
    // The caller should use getItemcount() for accurate count
    if (this._items) {
      return this._items.length;
    }
    // Return from node if available
    const items = this._node['items'] as JsonValue[] | undefined;
    return items?.length ?? 0;
  }

  /** Get accurate item count (async). */
  async getItemcount(): Promise<number> {
    await this._fetchItems();
    return this._items!.length;
  }

  /** Retrieve all associated highlight items. */
  override async *getItems(): AsyncGenerator<StoryItem> {
    await this._fetchItems();
    await this._fetchIphoneStruct();

    for (const item of this._items!) {
      const itemObj = { ...(item as JsonObject) };

      if (this._iphone_struct_ !== null) {
        const iphoneItems = this._iphone_struct_['items'] as JsonValue[];
        for (const iphoneItem of iphoneItems) {
          const iphoneObj = iphoneItem as JsonObject;
          if (String(iphoneObj['pk']) === String(itemObj['id'])) {
            itemObj['iphone_struct'] = iphoneObj;
            break;
          }
        }
      }

      yield new StoryItem(this._context, itemObj, this.owner_profile);
    }
  }
}

// =============================================================================
// Hashtag class
// =============================================================================

/**
 * An Instagram Hashtag.
 *
 * Provides methods for accessing hashtag properties and retrieving associated posts.
 * This class implements equality comparison and is hashable.
 */
export class Hashtag {
  private readonly _context: InstaloaderContext;
  private _node: JsonObject;
  private _has_full_metadata = false;

  constructor(context: InstaloaderContext, node: JsonObject) {
    if (!('name' in node)) {
      throw new Error("Node must contain 'name'");
    }
    this._context = context;
    this._node = node;
  }

  /**
   * Create a Hashtag instance from a given hashtag name, without preceding '#'.
   */
  static async fromName(
    context: InstaloaderContext,
    name: string
  ): Promise<Hashtag> {
    const hashtag = new Hashtag(context, { name: name.toLowerCase() });
    await hashtag._obtainMetadata();
    return hashtag;
  }

  /** Hashtag name lowercased, without preceding '#' */
  get name(): string {
    return (this._node['name'] as string).toLowerCase();
  }

  private async _query(params: JsonObject): Promise<JsonObject> {
    const jsonResponse = await this._context.get_iphone_json(
      'api/v1/tags/web_info/',
      { ...params, tag_name: this.name }
    );
    if ('graphql' in jsonResponse) {
      return (jsonResponse['graphql'] as JsonObject)['hashtag'] as JsonObject;
    }
    return jsonResponse['data'] as JsonObject;
  }

  private async _obtainMetadata(): Promise<void> {
    if (!this._has_full_metadata) {
      this._node = await this._query({ __a: 1, __d: 'dis' });
      this._has_full_metadata = true;
    }
  }

  private _metadata(...keys: string[]): JsonValue {
    let d: JsonValue = this._node;
    for (const key of keys) {
      if (typeof d !== 'object' || d === null || Array.isArray(d)) {
        throw new Error('Key not found');
      }
      d = d[key]!;
      if (d === undefined) {
        throw new Error('Key not found');
      }
    }
    return d;
  }

  async getMetadata(...keys: string[]): Promise<JsonValue> {
    try {
      return this._metadata(...keys);
    } catch {
      await this._obtainMetadata();
      return this._metadata(...keys);
    }
  }

  toString(): string {
    return `<Hashtag #${this.name}>`;
  }

  equals(other: Hashtag): boolean {
    return this.name === other.name;
  }

  /** Hashtag ID */
  async getHashtagId(): Promise<number> {
    return Number(await this.getMetadata('id'));
  }

  /** Profile picture URL of the hashtag */
  async getProfilePicUrl(): Promise<string> {
    return (await this.getMetadata('profile_pic_url')) as string;
  }

  /** Hashtag description */
  async getDescription(): Promise<string | null> {
    try {
      return (await this.getMetadata('description')) as string | null;
    } catch {
      return null;
    }
  }

  /** Whether following is allowed */
  async getAllowFollowing(): Promise<boolean> {
    return Boolean(await this.getMetadata('allow_following'));
  }

  /** Whether the current user is following this hashtag */
  async getIsFollowing(): Promise<boolean> {
    try {
      return (await this.getMetadata('is_following')) as boolean;
    } catch {
      return Boolean(await this.getMetadata('following'));
    }
  }

  /** Count of all media associated with this hashtag */
  async getMediacount(): Promise<number> {
    try {
      return (await this.getMetadata('edge_hashtag_to_media', 'count')) as number;
    } catch {
      return (await this.getMetadata('media_count')) as number;
    }
  }

  /** Yields the top posts of the hashtag. */
  async *getTopPosts(): AsyncGenerator<Post> {
    try {
      const edges = (await this.getMetadata(
        'edge_hashtag_to_top_posts',
        'edges'
      )) as JsonValue[];
      for (const edge of edges) {
        const e = edge as JsonObject;
        yield new Post(this._context, e['node'] as JsonObject);
      }
    } catch {
      // Would need SectionIterator implementation
      // For now, just return nothing
    }
  }

  /** Returns Hashtag as a JSON-serializable object. */
  toJSON(): JsonObject {
    const jsonNode = { ...this._node };
    delete jsonNode['edge_hashtag_to_top_posts'];
    delete jsonNode['top'];
    delete jsonNode['edge_hashtag_to_media'];
    delete jsonNode['recent'];
    return jsonNode;
  }
}

// =============================================================================
// TopSearchResults class
// =============================================================================

/**
 * An invocation of this class triggers a search on Instagram for the provided search string.
 *
 * Provides methods to access the search results as profiles, locations and hashtags.
 */
export class TopSearchResults {
  private readonly _context: InstaloaderContext;
  private readonly _searchstring: string;
  private _node: JsonObject | null = null;

  constructor(context: InstaloaderContext, searchstring: string) {
    this._context = context;
    this._searchstring = searchstring;
  }

  private async _ensureLoaded(): Promise<JsonObject> {
    if (!this._node) {
      this._node = await this._context.get_json('web/search/topsearch/', {
        context: 'blended',
        query: this._searchstring,
        include_reel: false,
        __a: 1,
      });
    }
    return this._node;
  }

  /** Provides the Profile instances from the search result. */
  async *getProfiles(): AsyncGenerator<Profile> {
    const node = await this._ensureLoaded();
    const users = (node['users'] ?? []) as JsonValue[];
    for (const user of users) {
      const userObj = user as JsonObject;
      const userNode = userObj['user'] as JsonObject;
      if ('pk' in userNode) {
        userNode['id'] = userNode['pk'];
      }
      yield new Profile(this._context, userNode);
    }
  }

  /** Provides all profile names from the search result that start with the search string. */
  async *getPrefixedUsernames(): AsyncGenerator<string> {
    const node = await this._ensureLoaded();
    const users = (node['users'] ?? []) as JsonValue[];
    for (const user of users) {
      const userObj = user as JsonObject;
      const innerUser = userObj['user'] as JsonObject;
      const username = (innerUser['username'] ?? '') as string;
      if (username.startsWith(this._searchstring)) {
        yield username;
      }
    }
  }

  /** Provides instances of PostLocation from the search result. */
  async *getLocations(): AsyncGenerator<PostLocation> {
    const node = await this._ensureLoaded();
    const places = (node['places'] ?? []) as JsonValue[];
    for (const location of places) {
      const locationObj = location as JsonObject;
      const place = locationObj['place'] as JsonObject;
      const slug = place['slug'] as string;
      const loc = place['location'] as JsonObject;
      yield {
        id: Number(loc['pk']),
        name: loc['name'] as string,
        slug,
        has_public_page: null,
        lat: (loc['lat'] as number) ?? null,
        lng: (loc['lng'] as number) ?? null,
      };
    }
  }

  /** Provides the hashtags from the search result as strings. */
  async *getHashtagStrings(): AsyncGenerator<string> {
    const node = await this._ensureLoaded();
    const hashtags = (node['hashtags'] ?? []) as JsonValue[];
    for (const hashtag of hashtags) {
      const hashtagObj = hashtag as JsonObject;
      const inner = hashtagObj['hashtag'] as JsonObject;
      const name = inner['name'] as string | undefined;
      if (name) {
        yield name;
      }
    }
  }

  /** Provides the hashtags from the search result. */
  async *getHashtags(): AsyncGenerator<Hashtag> {
    const node = await this._ensureLoaded();
    const hashtags = (node['hashtags'] ?? []) as JsonValue[];
    for (const hashtag of hashtags) {
      const hashtagObj = hashtag as JsonObject;
      const inner = hashtagObj['hashtag'] as JsonObject;
      if ('name' in inner) {
        yield new Hashtag(this._context, inner);
      }
    }
  }

  /** The string that was searched for on Instagram. */
  get searchstring(): string {
    return this._searchstring;
  }
}

// =============================================================================
// JSON serialization helpers
// =============================================================================

/**
 * Type that can be exported to JSON.
 */
export type JsonExportable = Post | Profile | StoryItem | Hashtag;

/**
 * Returns Instaloader JSON structure for a Post, Profile, StoryItem, or Hashtag
 * so that it can be loaded by loadStructure.
 */
export function getJsonStructure(structure: JsonExportable): JsonObject {
  return {
    node: structure.toJSON(),
    instaloader: {
      version: '4.15.0', // Match Python version
      node_type: structure.constructor.name,
    },
  };
}

/**
 * Loads a Post, Profile, StoryItem, or Hashtag from a json structure.
 */
export function loadStructure(
  context: InstaloaderContext,
  jsonStructure: JsonObject
): JsonExportable {
  if (
    'node' in jsonStructure &&
    'instaloader' in jsonStructure
  ) {
    const instaloader = jsonStructure['instaloader'] as JsonObject;
    if ('node_type' in instaloader) {
      const nodeType = instaloader['node_type'] as string;
      const node = jsonStructure['node'] as JsonObject;

      switch (nodeType) {
        case 'Post':
          return new Post(context, node);
        case 'Profile':
          return new Profile(context, node);
        case 'StoryItem':
          return new StoryItem(context, node);
        case 'Hashtag':
          return new Hashtag(context, node);
      }
    }
  }

  // Legacy format
  if ('shortcode' in jsonStructure) {
    // Would need async handling, so we create a post with the node directly
    return new Post(context, jsonStructure);
  }

  throw new InvalidArgumentException(
    'Passed json structure is not an Instaloader JSON'
  );
}
