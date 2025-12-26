/**
 * Instaloader.js - TypeScript port of Python instaloader
 *
 * Download pictures (or videos) along with their captions
 * and other metadata from Instagram.
 */

// Exceptions
export {
  InstaloaderException,
  QueryReturnedBadRequestException,
  QueryReturnedForbiddenException,
  ProfileNotExistsException,
  ProfileHasNoPicsException,
  PrivateProfileNotFollowedException,
  LoginRequiredException,
  LoginException,
  TwoFactorAuthRequiredException,
  InvalidArgumentException,
  BadResponseException,
  BadCredentialsException,
  ConnectionException,
  PostChangedException,
  QueryReturnedNotFoundException,
  TooManyRequestsException,
  IPhoneSupportDisabledException,
  AbortDownloadException,
  SessionNotFoundException,
  CheckpointRequiredException,
  InvalidIteratorException,
} from './exceptions';

export type { TwoFactorInfo, PhoneVerificationSettings } from './exceptions';

// Types
export type {
  JsonValue,
  JsonObject,
  CookieData,
  HttpHeaders,
  GraphQLResponse,
  LoginResponse,
  ResponseInfo,
  RequestOptions,
  SessionData,
  QueryTimestamps,
  IPhoneHeaders,
  PostNode,
  ProfileNode,
  StoryItemNode,
  HighlightNode,
  CommentNode,
  HashtagNode,
  LocationNode,
  PageInfo,
  EdgeConnection,
  FrozenIteratorState,
} from './types';

// InstaloaderContext
export {
  InstaloaderContext,
  RateController,
  defaultUserAgent,
  defaultIphoneHeaders,
} from './instaloadercontext';

export type { InstaloaderContextOptions } from './instaloadercontext';

// NodeIterator
export {
  NodeIterator,
  FrozenNodeIterator,
  resumableIteration,
} from './nodeiterator';

export type {
  NodeIteratorOptions,
  ResumableIterationOptions,
  ResumableIterationResult,
} from './nodeiterator';

// Structures
export {
  // Helper functions
  shortcodeToMediaid,
  mediaidToShortcode,
  extractHashtags,
  extractMentions,
  // Classes
  PostComment,
  Post,
  Profile,
  StoryItem,
  Story,
  Highlight,
  Hashtag,
  TopSearchResults,
  // JSON serialization
  getJsonStructure,
  loadStructure,
} from './structures';

export type {
  NodeIterator as StructureNodeIterator, // Re-export with different name to avoid conflict
  PostSidecarNode,
  PostCommentAnswer,
  PostLocation,
  JsonExportable,
} from './structures';

// Instaloader main class
export {
  Instaloader,
  getConfigDir,
  getDefaultSessionFilename,
  getDefaultStampsFilename,
  formatStringContainsKey,
  sanitizePath,
  formatFilename,
} from './instaloader';

export type { InstaloaderOptions } from './instaloader';
