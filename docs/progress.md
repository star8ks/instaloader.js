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
| Node Iterator | `nodeiterator.py` | `nodeiterator.ts` | Not Started |
| Context | `instaloadercontext.py` | `instaloadercontext.ts` | Done |
| Main Class | `instaloader.py` | `instaloader.ts` | Not Started |
| CLI | `__main__.py` | `cli.ts` | Not Started |

### Supporting Tasks

| Task | Status |
|------|--------|
| Project setup (package.json, tsconfig) | Done |
| Build configuration (tsup) | Done |
| Test setup (vitest) | Done |
| Unit tests for exceptions | Not Started |
| Unit tests for structures | Done (139 tests) |
| Integration tests | Not Started |

## Current Progress

### Completed (2024-12-27)

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

6. **Unit Tests for Structures** (139 tests)
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

## Next Steps

1. **Port NodeIterator** (Priority: High)
   - Async iterator for paginated results
   - Freeze/thaw for resumable downloads

2. **Port main Instaloader class** (Priority: Medium)
   - Download orchestration
   - File saving utilities

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
| instaloadercontext.py | 885 | - | - | Not started |
| nodeiterator.py | 329 | - | - | Not started |
| instaloader.py | 1,669 | - | - | Not started |

## Dependencies

### Runtime
- `tough-cookie` - Cookie jar management

### Development
- `typescript` - Type checking
- `tsup` - Build tool
- `vitest` - Testing
- `eslint` - Linting
