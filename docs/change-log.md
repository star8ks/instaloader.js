# Change Log

## 2024-12-27: Add Unit Tests for InstaloaderContext

### Summary
Added comprehensive unit tests for RateController and InstaloaderContext classes.

### Test Files Added
- `src/__tests__/ratecontroller.test.ts` - Tests for RateController (10 tests)
- `src/__tests__/instaloadercontext.test.ts` - Tests for InstaloaderContext (56 tests)

### Test Coverage
- **Total: 205 tests passing** (139 + 66 new)
- RateController: constructor, countPerSlidingWindow, queryWaittime, waitBeforeQuery, sleep, handle429
- InstaloaderContext: constructor options, is_logged_in, username/userId, cookies
- Session management: getCookies, setCookies, saveSession, loadSession
- HTTP requests: getJson (GET/POST), graphql_query, doc_id_graphql_query, get_iphone_json, head
- Error handling: 400, 403, 404, 429, fatal status codes
- Login flow: login, 2FA, error handling

### Testing Approach
- Used vitest with `vi.stubGlobal('fetch', mockFetch)` to mock fetch API
- Created mock InstaloaderContext using `vi.fn()` for method mocks
- Set `maxConnectionAttempts: 1` in error tests to avoid retry issues

### Verification
- `npm run test` - 205 tests pass
- `npm run typecheck` - Passes

---

## 2024-12-27: Port InstaloaderContext

### Summary
Ported InstaloaderContext and RateController classes from Python instaloadercontext.py.

### New Files
- `src/instaloadercontext.ts` (~1,100 lines) - HTTP client and Instagram communication

### Classes Ported

| Class | Description |
|-------|-------------|
| `InstaloaderContext` | HTTP client, session management, GraphQL queries, login |
| `RateController` | Request tracking and rate limiting |

### Key Features
- Cookie management using `tough-cookie`
- Native `fetch` API for HTTP requests
- GraphQL query support (`graphql_query`, `doc_id_graphql_query`)
- iPhone API support (`get_iphone_json`)
- Rate limiting with sliding window algorithm
- Login with 2FA support
- Session save/load for persistent login

### Helper Functions
- `defaultUserAgent()` - Returns default browser user agent
- `defaultIphoneHeaders()` - Returns iPhone API headers

### Dependencies Added
- `uuid` - For generating session IDs

### Design Decisions
1. **Cookie Management**: Using `tough-cookie` instead of browser cookies for Node.js compatibility
2. **Rate Limiting**: Ported the sliding window algorithm from Python
3. **2FA Flow**: Stores pending 2FA state for multi-step authentication
4. **Error Handling**: Proper exception hierarchy for different HTTP error codes

### Verification
- `npm run typecheck` - Passes
- `npm run test` - 139 tests pass
- `npm run build` - Builds successfully

---

## 2024-12-27: Add Unit Tests for Data Models

### Summary
Added comprehensive unit tests for all data model classes.

### Test Files Added
- `src/__tests__/helpers.test.ts` - Tests for helper functions (24 tests)
- `src/__tests__/post.test.ts` - Tests for Post class (31 tests)
- `src/__tests__/profile.test.ts` - Tests for Profile class (25 tests)
- `src/__tests__/story.test.ts` - Tests for StoryItem, Story, Highlight (35 tests)
- `src/__tests__/hashtag.test.ts` - Tests for Hashtag, TopSearchResults (24 tests)

### Test Coverage
- **Total: 139 tests passing**
- Helper functions: shortcodeToMediaid, mediaidToShortcode, extractHashtags, extractMentions
- Post class: constructor, properties, video, sidecar, equality, JSON serialization
- Profile class: constructor, properties, async metadata, equality, JSON serialization
- StoryItem/Story/Highlight: constructor, properties, iteration, equality
- Hashtag/TopSearchResults: constructor, properties, search results iteration

### Testing Approach
- Used vitest with mock InstaloaderContext
- Created sample node data matching Instagram API response structure
- Tested both sync properties and async methods

---

## 2024-12-27: Port Data Models from Python structures.py

### Summary
Ported all data model classes from Python instaloader's `structures.py` to TypeScript.

### Changes

#### New Files
- `src/structures.ts` (~1,800 lines) - All data model classes
- `src/index.ts` - Library exports
- `docs/progress.md` - Project progress tracking
- `docs/change-log.md` - This file

#### Modified Files
- `src/types.ts` - Removed index signatures that conflicted with specific typed properties
- `src/exceptions.ts` - Fixed `exactOptionalPropertyTypes` issue with `checkpointUrl`

### Classes Ported

| Class | Description |
|-------|-------------|
| `Post` | Instagram post with properties (caption, likes, comments, video, sidecar) |
| `Profile` | Instagram profile with metadata, followers/followees |
| `StoryItem` | Individual story item (image/video) |
| `Story` | Collection of story items from a user |
| `Highlight` | User highlights (extends Story) |
| `Hashtag` | Instagram hashtag with posts |
| `TopSearchResults` | Search results for profiles, hashtags, locations |
| `PostComment` | Comment on a post |

### Helper Types and Functions
- `PostSidecarNode` - Sidecar carousel item interface
- `PostCommentAnswer` - Reply to a comment interface
- `PostLocation` - Location data interface
- `shortcodeToMediaid()` / `mediaidToShortcode()` - ID conversion utilities
- `extractHashtags()` / `extractMentions()` - Caption parsing utilities
- `getJsonStructure()` / `loadStructure()` - JSON serialization

### Design Decisions

1. **Placeholder Interfaces**: Created `InstaloaderContext` and `NodeIterator` as placeholder interfaces in structures.ts. These will be replaced when those modules are ported.

2. **Async Pattern**: Python properties that lazily fetch data become async methods in TypeScript:
   - `post.owner_profile` → `post.getOwnerProfile()`
   - `profile.biography` → `profile.getBiography()`

3. **Type Safety**: Used `JsonObject` and `JsonValue` for dynamic API responses instead of `any`.

4. **BigInt for Media IDs**: Instagram media IDs exceed JavaScript's Number.MAX_SAFE_INTEGER, so we use BigInt.

### Review Notes

1. **types.ts Changes**: Removed `[key: string]: JsonValue | undefined` index signatures from `PostNode`, `ProfileNode`, `CommentNode`, `HashtagNode`, `LocationNode`, `StoryItemNode`, `HighlightNode` because they conflicted with specific typed properties like `edge_sidecar_to_children`.

2. **exceptions.ts Fix**: Changed `checkpointUrl?: string` to `checkpointUrl: string | undefined` to satisfy `exactOptionalPropertyTypes`.

3. **Unused Private Members**: Added `@ts-expect-error` comments for `_getIphoneStruct` and `_has_public_story` which are reserved for future use but not yet called.

### Verification
- `npm run typecheck` - Passes
- `npm run build` - Builds successfully (CJS + ESM + types)

### Next Steps
1. Write unit tests for data models
2. Port InstaloaderContext
3. Port NodeIterator
