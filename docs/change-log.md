# Change Log

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
