# @vicociv/instaloader

[![npm downloads](https://img.shields.io/npm/dm/@vicociv/instaloader.svg)](https://www.npmjs.com/package/@vicociv/instaloader)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/@vicociv/instaloader)](https://bundlephobia.com/package/@vicociv/instaloader)
[![dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)](https://bundlephobia.com/package/@vicociv/instaloader)
[![tree-shaking](https://img.shields.io/badge/tree--shaking-supported-brightgreen)](https://bundlephobia.com/package/@vicociv/instaloader)
[![CI](https://github.com/star8ks/instaloader.js/actions/workflows/ci.yml/badge.svg)](https://github.com/star8ks/instaloader.js/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/star8ks/instaloader.js/branch/main/graph/badge.svg)](https://codecov.io/gh/star8ks/instaloader.js)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green.svg)](https://nodejs.org/)

TypeScript port of [instaloader](https://github.com/instaloader/instaloader) - Download Instagram content (posts, stories, profiles) with metadata.

## Installation

```bash
npm install @vicociv/instaloader
```

**Requirements:** Node.js >= 18.0.0

## Quick Start

```typescript
import { Instaloader, Profile, Post, Hashtag } from '@vicociv/instaloader';

const L = new Instaloader();

// Get a post by shortcode (works without login)
const post = await L.getPost('DSsaqgbkhAd');
console.log(post.caption);
console.log(post.typename);  // 'GraphImage' | 'GraphVideo' | 'GraphSidecar'

// Get a profile
const profile = await L.getProfile('instagram');
console.log(await profile.getFollowers()); // follower count

// Iterate posts
for await (const post of profile.getPosts()) {
  console.log(post.shortcode, post.likes);
}
```

## Authentication

Most operations work without login. However, login is required for:
- Accessing private profiles
- Viewing stories and highlights
- Saved posts
- Some rate-limited operations

```typescript
// Login with credentials
await L.login('username', 'password');

// Handle 2FA if required
try {
  await L.login('username', 'password');
} catch (e) {
  if (e instanceof TwoFactorAuthRequiredException) {
    await L.twoFactorLogin('123456');
  }
}

// Save/load session
await L.saveSessionToFile('session.json');
await L.loadSessionFromFile('username', 'session.json');

// Test if session is valid
const username = await L.testLogin(); // returns username or null
```

## API Reference

### Instaloader

Main class for downloading Instagram content.

```typescript
const L = new Instaloader(options?: InstaloaderOptions);
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sleep` | boolean | true | Enable rate limiting delays |
| `quiet` | boolean | false | Suppress console output |
| `userAgent` | string | - | Custom user agent |
| `downloadPictures` | boolean | true | Download images |
| `downloadVideos` | boolean | true | Download videos |
| `saveMetadata` | boolean | true | Save JSON metadata |

#### Get Content

```typescript
// Get profile/post/hashtag
const profile = await L.getProfile('username');
const post = await L.getPost('shortcode');
const hashtag = await L.getHashtag('nature');
```

#### Download Content

```typescript
// Download a single post
await L.downloadPost(post, 'target_folder');

// Download profile posts
await L.downloadProfile(profile, {
  maxCount: 10,
  fastUpdate: true, // stop at already downloaded
  postFilter: (p) => p.likes > 100,
});

// Download hashtag posts
await L.downloadHashtag(hashtag, { maxCount: 50 });
```

### Profile

Represents an Instagram user profile.

```typescript
import { Profile } from '@vicociv/instaloader';

// Create from username
const profile = await Profile.fromUsername(context, 'instagram');

// Properties (sync)
profile.username      // lowercase username
profile.userid        // numeric user ID
profile.is_private    // is private account
profile.followed_by_viewer
profile.follows_viewer

// Properties (async - may fetch metadata)
await profile.getFollowers()
await profile.getFollowees()
await profile.getMediacount()
await profile.getBiography()
await profile.getFullName()
await profile.getProfilePicUrl()
await profile.getIsVerified()
await profile.getExternalUrl()
```

#### Iterate Posts

```typescript
// All posts
for await (const post of profile.getPosts()) {
  console.log(post.shortcode);
}

// Saved posts (requires login as owner)
for await (const post of profile.getSavedPosts()) {
  console.log(post.shortcode);
}

// Tagged posts
for await (const post of profile.getTaggedPosts()) {
  console.log(post.shortcode);
}
```

### Post

Represents an Instagram post.

```typescript
import { Post } from '@vicociv/instaloader';

// Create from shortcode
const post = await Post.fromShortcode(context, 'ABC123');

// Properties
post.shortcode        // URL shortcode
post.mediaid          // BigInt media ID
post.typename         // 'GraphImage' | 'GraphVideo' | 'GraphSidecar'
post.url              // image/thumbnail URL
post.video_url        // video URL (if video)
post.is_video         // boolean
post.caption          // caption text
post.caption_hashtags // ['tag1', 'tag2']
post.caption_mentions // ['user1', 'user2']
post.likes            // like count
post.comments         // comment count
post.date_utc         // Date object
post.tagged_users     // tagged usernames

// Get owner profile
const owner = await post.getOwnerProfile();

// Sidecar (carousel) posts
for (const node of post.getSidecarNodes()) {
  console.log(node.is_video, node.display_url, node.video_url);
}
```

### Hashtag

Represents an Instagram hashtag.

```typescript
import { Hashtag } from '@vicociv/instaloader';

const hashtag = await Hashtag.fromName(context, 'photography');

// Properties
hashtag.name                    // lowercase name (without #)
await hashtag.getHashtagId()
await hashtag.getMediacount()
await hashtag.getProfilePicUrl()

// Get posts (use getPostsResumable for reliable pagination)
const iterator = hashtag.getPostsResumable();
for await (const post of iterator) {
  console.log(post.shortcode);
}

// Top posts
for await (const post of hashtag.getTopPosts()) {
  console.log(post.shortcode);
}
```

### Story & StoryItem

```typescript
import { Story, StoryItem } from '@vicociv/instaloader';

// Story contains multiple StoryItems
for await (const item of story.getItems()) {
  console.log(item.mediaid);
  console.log(item.typename);     // 'GraphStoryImage' | 'GraphStoryVideo'
  console.log(item.url);          // image URL
  console.log(item.video_url);    // video URL (if video)
  console.log(item.date_utc);
  console.log(item.expiring_utc);
}
```

### Highlight

Extends Story for profile highlights.

```typescript
import { Highlight } from '@vicociv/instaloader';

highlight.title       // highlight title
highlight.cover_url   // cover image URL

for await (const item of highlight.getItems()) {
  // ...
}
```

### TopSearchResults

Search Instagram for profiles, hashtags, and locations.

```typescript
import { TopSearchResults } from '@vicociv/instaloader';

const search = new TopSearchResults(context, 'query');

for await (const profile of search.getProfiles()) {
  console.log(profile.username);
}

for await (const hashtag of search.getHashtags()) {
  console.log(hashtag.name);
}

for await (const location of search.getLocations()) {
  console.log(location.name, location.lat, location.lng);
}
```

### NodeIterator

Paginated iterator with resume support.

```typescript
import { NodeIterator, FrozenNodeIterator } from '@vicociv/instaloader';

const iterator = profile.getPosts();

// Iterate
for await (const post of iterator) {
  // Save state for resume
  const state = iterator.freeze();
  fs.writeFileSync('state.json', JSON.stringify(state));
  break;
}

// Resume later
const savedState = JSON.parse(fs.readFileSync('state.json', 'utf-8'));
const frozen = new FrozenNodeIterator(savedState);
const resumed = frozen.thaw(context);
```

### Helper Functions

```typescript
import {
  shortcodeToMediaid,
  mediaidToShortcode,
  extractHashtags,
  extractMentions,
  parseInstagramUrl,
  extractShortcode,
  extractUsername,
  extractHashtagFromUrl,
  getJsonStructure,
  loadStructure,
} from '@vicociv/instaloader';

// Convert between shortcode and mediaid
const mediaid = shortcodeToMediaid('ABC123');     // BigInt
const shortcode = mediaidToShortcode(mediaid);    // string

// Extract from text
extractHashtags('Hello #world #test');  // ['world', 'test']
extractMentions('Hello @user1 @user2'); // ['user1', 'user2']

// Parse Instagram URLs
parseInstagramUrl('https://www.instagram.com/p/DSsaqgbkhAd/')
// => { type: 'post', shortcode: 'DSsaqgbkhAd' }

parseInstagramUrl('https://www.instagram.com/instagram/')
// => { type: 'profile', username: 'instagram' }

parseInstagramUrl('https://www.instagram.com/explore/tags/nature/')
// => { type: 'hashtag', hashtag: 'nature' }

// Extract specific identifiers from URLs
extractShortcode('https://www.instagram.com/p/DSsaqgbkhAd/?img_index=1')
// => 'DSsaqgbkhAd'

extractUsername('https://www.instagram.com/instagram/')
// => 'instagram'

extractHashtagFromUrl('https://www.instagram.com/explore/tags/nature/')
// => 'nature'

// JSON serialization
const json = getJsonStructure(post);
const restored = loadStructure(context, json);
```

### InstaloaderContext

Low-level API for direct Instagram requests. Usually accessed via `Instaloader.context`.

```typescript
const context = L.context;

// Check login status
context.is_logged_in  // boolean
context.username      // string | null

// Make GraphQL queries
const data = await context.graphql_query(queryHash, variables);
const data = await context.doc_id_graphql_query(docId, variables);

// Generic JSON request
const data = await context.getJson('path', params);

// iPhone API
const data = await context.get_iphone_json('api/v1/...', params);
```

### Exceptions

```typescript
import {
  InstaloaderException,        // Base exception
  LoginException,              // Login failed
  LoginRequiredException,      // Action requires login
  TwoFactorAuthRequiredException,
  BadCredentialsException,     // Wrong password
  ConnectionException,         // Network error
  TooManyRequestsException,    // Rate limited (429)
  ProfileNotExistsException,   // Profile not found
  QueryReturnedNotFoundException,
  QueryReturnedForbiddenException,
  PostChangedException,        // Post changed during download
  InvalidArgumentException,
} from '@vicociv/instaloader';
```

## TODO

- [ ] Download comments
- [ ] Download IGTV
- [ ] Download Reels
- [ ] Location support
- [ ] CLI tool

## License

MIT

## Buy Me a Coffee

If you find this project helpful, consider supporting its development:

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/vicociv)
