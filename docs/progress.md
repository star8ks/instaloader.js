# Project Progress

This document tracks the overall progress of porting Python instaloader to TypeScript.

## Overall Plan

Port the Python [instaloader](https://github.com/instaloader/instaloader) library to TypeScript, maintaining API compatibility while leveraging TypeScript's type safety.

### Core Modules to Port

| Module | Python File | TypeScript File | Status |
|--------|-------------|-----------------|--------|
| Exceptions | `exceptions.py` | `exceptions.ts` | Done |
| Types | N/A | `types.ts` | Done |
| Structures | `structures.py` | `structures.ts` | Done |
| Node Iterator | `nodeiterator.py` | `nodeiterator.ts` | Done |
| Context | `instaloadercontext.py` | `instaloadercontext.ts` | Done |
| Main Class | `instaloader.py` | `instaloader.ts` | Done (partial) |
| CLI | `__main__.py` | `cli.ts` | Not Started |

### Supporting Tasks

| Task | Status |
|------|--------|
| Project setup (package.json, tsconfig) | Done |
| Build configuration (tsup) | Done |
| Test setup (vitest) | Done |
| Unit tests for exceptions | Not Started |
| Unit tests for structures | Done (145 tests) |
| Unit tests for InstaloaderContext | Done (66 tests) |
| Unit tests for NodeIterator | Done (21 tests) |
| Unit tests for Instaloader | Done (36 tests) |
| Integration tests | Done (1 test, works without login) |
| URL parsing helpers | Done (14 tests) |

## Current Progress

### Completed (2024-12-27)

#### Anonymous Access Fix
Fixed the issue where the TypeScript version couldn't fetch Instagram data without login while Python version could.

**Root cause analysis:**
1. Python instaloader first tries POST request which gets 403 Forbidden
2. On retry, Python's `get_json()` doesn't pass `use_post` parameter, so it defaults to GET
3. GET requests work anonymously while POST requests get blocked

**Changes made:**
1. Added `getPerRequestHeaders()` function that generates fresh dynamic headers per request:
   - `x-pigeon-rawclienttime`: Current timestamp
   - `x-ig-connection-speed`: Random speed (1000-20000kbps)
   - `x-pigeon-session-id`: Fresh UUID
2. Modified `getJson()` to refresh dynamic headers on retry with `refreshDynamicHeaders` option
3. **Key fix**: On retry, `getJson()` now uses GET instead of POST (matching Python behavior)

This allows anonymous access to Instagram GraphQL API without login.

1. **Project Setup**
   - Initialized npm package with TypeScript
   - Configured tsup for dual CJS/ESM builds
   - Set up vitest for testing
   - Added instaloader Python repo as git submodule

2. **exceptions.ts** (~243 lines)
   - Full exception hierarchy ported
   - InstaloaderException as base class
   - Login, Connection, Query exceptions
   - TwoFactorAuthRequiredException with TwoFactorInfo interface

3. **types.ts** (~300 lines)
   - JSON value types
   - API response interfaces (PostNode, ProfileNode, StoryItemNode, etc.)
   - Request/Response types
   - Session and cookie data types
   - Pagination types (PageInfo, EdgeConnection)
   - FrozenIteratorState for resumable downloads

4. **structures.ts** (~1,800 lines)
   - Post class with all properties and methods
   - Profile class with metadata access
   - StoryItem and Story classes
   - Highlight class (extends Story)
   - Hashtag class
   - TopSearchResults class
   - PostComment class
   - Helper functions (shortcodeToMediaid, extractHashtags, etc.)
   - JSON serialization (getJsonStructure, loadStructure)

5. **index.ts**
   - Exports all public APIs

6. **Unit Tests for Structures** (145 tests)
   - `helpers.test.ts` - shortcodeToMediaid, mediaidToShortcode, extractHashtags, extractMentions
   - `post.test.ts` - Post class properties, video, sidecar, equality
   - `profile.test.ts` - Profile class properties, async metadata
   - `story.test.ts` - StoryItem, Story, Highlight classes
   - `hashtag.test.ts` - Hashtag, TopSearchResults classes

7. **instaloadercontext.ts** (~1,100 lines)
   - InstaloaderContext class for HTTP client and session management
   - RateController class for rate limiting
   - Cookie management with tough-cookie
   - GraphQL query support (graphql_query, doc_id_graphql_query)
   - iPhone API support (get_iphone_json)
   - Login with 2FA support
   - Session save/load

8. **Unit Tests for InstaloaderContext** (66 tests)
   - `ratecontroller.test.ts` - RateController class (10 tests)
   - `instaloadercontext.test.ts` - InstaloaderContext class (56 tests)
     - Constructor options
     - Cookie management
     - Session save/load
     - HTTP requests (GET, POST, HEAD)
     - GraphQL queries
     - iPhone API
     - Login and 2FA

9. **nodeiterator.ts** (~500 lines)
   - NodeIterator class for paginated GraphQL results
   - FrozenNodeIterator for serializing iterator state
   - Async iterator pattern with Symbol.asyncIterator
   - Freeze/thaw for resumable downloads
   - resumableIteration helper function

10. **Unit Tests for NodeIterator** (21 tests)
    - `nodeiterator.test.ts` - Tests for FrozenNodeIterator, NodeIterator, resumableIteration

11. **instaloader.ts** (~830 lines)
    - Instaloader main class for downloading content
    - Session management (save/load to file)
    - Download methods (downloadPic, downloadPost, downloadProfile, downloadHashtag)
    - File naming and path sanitization utilities
    - Full integration with NodeIterator for post pagination

12. **getPosts() methods** (2024-12-27)
    - Profile.getPosts() - Retrieve all posts from a profile
    - Profile.getSavedPosts() - Get saved posts (requires login)
    - Profile.getTaggedPosts() - Get posts where profile is tagged
    - Hashtag.getPosts() - Deprecated async generator for hashtag posts
    - Hashtag.getPostsResumable() - NodeIterator for resumable hashtag iteration

## Next Steps

1. **Add Instaloader tests** (Priority: Medium)
   - ~~Test download methods~~ Done (36 tests)
   - ~~Test session management~~ Done
   - ~~Test utility functions~~ Done

2. **CLI implementation** (Priority: Low)
   - Command-line interface for downloading

3. **Stories and Highlights download** (Priority: Medium)
   - Implement story/highlight downloading in Instaloader

## Architecture Notes

### Key Design Decisions

1. **Async/Await Pattern**: Python's synchronous methods become async in TypeScript. Some properties that lazily fetch data in Python become async methods in TypeScript.

2. **Type Safety**: Strict TypeScript with no `any` types. Using `JsonObject` and `JsonValue` for dynamic Instagram API responses.

3. **Node.js 18+**: Using native fetch API instead of external HTTP libraries.

### File Size Comparison

| Python | Lines | TypeScript | Lines | Notes |
|--------|-------|------------|-------|-------|
| exceptions.py | 84 | exceptions.ts | 243 | More verbose with JSDoc |
| structures.py | 2,255 | structures.ts | ~1,800 | Similar complexity |
| instaloadercontext.py | 885 | instaloadercontext.ts | ~1,100 | HTTP client ported |
| nodeiterator.py | 329 | nodeiterator.ts | ~500 | Async iterator pattern |
| instaloader.py | 1,669 | instaloader.ts | ~830 | Partial port (core features) |

## Dependencies

### Runtime
- `tough-cookie` - Cookie jar management

### Development
- `typescript` - Type checking
- `tsup` - Build tool
- `vitest` - Testing
- `eslint` - Linting
