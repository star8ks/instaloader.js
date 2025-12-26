/**
 * Common types used throughout the Instaloader library.
 */

/// <reference lib="dom" />

/**
 * Generic JSON object type.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

/**
 * Cookie object for session management.
 */
export interface CookieData {
  [key: string]: string;
}

/**
 * HTTP headers object.
 */
export interface HttpHeaders {
  [key: string]: string;
}

/**
 * GraphQL query response.
 */
export interface GraphQLResponse {
  data?: JsonObject;
  status?: string;
  message?: string;
  [key: string]: JsonValue | undefined;
}

/**
 * Login response from Instagram.
 */
export interface LoginResponse {
  authenticated?: boolean;
  user?: boolean;
  userId?: string;
  status?: string;
  message?: string;
  checkpoint_url?: string;
  two_factor_required?: boolean;
  two_factor_info?: {
    two_factor_identifier: string;
    obfuscated_phone_number?: string;
    show_messenger_code_option?: boolean;
    show_new_login_screen?: boolean;
    show_trusted_device_option?: boolean;
    pending_trusted_notification_polling?: boolean;
  };
  oneTapPrompt?: boolean;
}

/**
 * HTTP response information.
 */
export interface ResponseInfo {
  status: number;
  statusText: string;
  headers: Headers;
  url: string;
}

/**
 * Request options for fetch.
 */
export interface RequestOptions {
  method?: 'GET' | 'POST' | 'HEAD';
  headers?: HeadersInit;
  body?: string | URLSearchParams;
  redirect?: RequestRedirect;
  signal?: AbortSignal;
}

/**
 * Session data for persistence.
 */
export interface SessionData {
  cookies: CookieData;
  username: string;
  userId?: string;
}

/**
 * Rate controller query timestamps.
 */
export interface QueryTimestamps {
  [queryType: string]: number[];
}

/**
 * iPhone headers for API requests.
 */
export interface IPhoneHeaders {
  'User-Agent': string;
  'x-ads-opt-out': string;
  'x-bloks-is-panorama-enabled': string;
  'x-bloks-version-id': string;
  'x-fb-client-ip': string;
  'x-fb-connection-type': string;
  'x-fb-http-engine': string;
  'x-fb-server-cluster': string;
  'x-fb': string;
  'x-ig-abr-connection-speed-kbps': string;
  'x-ig-app-id': string;
  'x-ig-app-locale': string;
  'x-ig-app-startup-country': string;
  'x-ig-bandwidth-speed-kbps': string;
  'x-ig-capabilities': string;
  'x-ig-connection-speed': string;
  'x-ig-connection-type': string;
  'x-ig-device-locale': string;
  'x-ig-mapped-locale': string;
  'x-ig-timezone-offset': string;
  'x-ig-www-claim': string;
  'x-pigeon-session-id': string;
  'x-tigon-is-retry': string;
  'x-whatsapp': string;
  [key: string]: string;
}

/**
 * Post node from GraphQL response.
 */
export interface PostNode {
  id: string;
  shortcode: string;
  typename?: string;
  __typename?: string;
  display_url?: string;
  is_video?: boolean;
  video_url?: string;
  edge_media_to_caption?: {
    edges: Array<{ node: { text: string } }>;
  };
  edge_media_to_comment?: {
    count: number;
  };
  edge_liked_by?: {
    count: number;
  };
  edge_media_preview_like?: {
    count: number;
  };
  owner?: {
    id: string;
    username: string;
  };
  taken_at_timestamp?: number;
  location?: {
    id: string;
    name: string;
    slug?: string;
  } | null;
  accessibility_caption?: string | null;
  edge_sidecar_to_children?: {
    edges: Array<{ node: PostNode }>;
  };
  video_view_count?: number;
  video_duration?: number;
}

/**
 * Profile node from GraphQL response.
 */
export interface ProfileNode {
  id: string;
  username: string;
  full_name?: string;
  biography?: string;
  profile_pic_url?: string;
  profile_pic_url_hd?: string;
  is_private?: boolean;
  is_verified?: boolean;
  is_business_account?: boolean;
  business_category_name?: string | null;
  external_url?: string | null;
  edge_followed_by?: {
    count: number;
  };
  edge_follow?: {
    count: number;
  };
  edge_owner_to_timeline_media?: {
    count: number;
  };
  followed_by_viewer?: boolean;
  follows_viewer?: boolean;
  blocked_by_viewer?: boolean;
  has_blocked_viewer?: boolean;
  requested_by_viewer?: boolean;
}

/**
 * Story item node from GraphQL response.
 */
export interface StoryItemNode {
  id: string;
  __typename?: string;
  display_url?: string;
  is_video?: boolean;
  video_resources?: Array<{
    src: string;
    profile?: string;
  }>;
  taken_at_timestamp?: number;
  expiring_at_timestamp?: number;
  story_cta_url?: string | null;
  owner?: {
    id: string;
    username: string;
  };
}

/**
 * Highlight node from GraphQL response.
 */
export interface HighlightNode {
  id: string;
  title: string;
  cover_media?: {
    thumbnail_src?: string;
  };
  cover_media_cropped_thumbnail?: {
    url?: string;
  };
  owner?: {
    id: string;
    username: string;
  };
}

/**
 * Comment node from GraphQL response.
 */
export interface CommentNode {
  id: string;
  text: string;
  created_at: number;
  owner: {
    id: string;
    username: string;
    profile_pic_url?: string;
  };
  edge_liked_by?: {
    count: number;
  };
  edge_threaded_comments?: {
    count: number;
    edges: Array<{ node: CommentNode }>;
  };
}

/**
 * Hashtag node from GraphQL response.
 */
export interface HashtagNode {
  id: string;
  name: string;
  profile_pic_url?: string;
  edge_hashtag_to_media?: {
    count: number;
  };
  edge_hashtag_to_top_posts?: {
    edges: Array<{ node: PostNode }>;
  };
}

/**
 * Location node from GraphQL response.
 */
export interface LocationNode {
  id: string;
  name: string;
  slug?: string;
  has_public_page?: boolean;
  lat?: number;
  lng?: number;
}

/**
 * Page info for pagination.
 */
export interface PageInfo {
  has_next_page: boolean;
  end_cursor: string | null;
}

/**
 * Edge connection type for GraphQL pagination.
 */
export interface EdgeConnection<T> {
  count?: number;
  page_info: PageInfo;
  edges: Array<{ node: T }>;
}

/**
 * Frozen iterator state for resumable downloads.
 */
export interface FrozenIteratorState {
  queryHash?: string;
  queryVariables: JsonObject;
  queryReferer?: string | null;
  contextUsername?: string | null;
  totalIndex: number;
  bestBefore?: number;
  remainingData?: Array<{ node: JsonObject }> | null;
  firstNode?: JsonObject | null;
  docId?: string;
}
