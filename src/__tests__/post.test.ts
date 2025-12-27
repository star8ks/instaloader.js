/**
 * Tests for Post class in structures.ts
 */

import { describe, it, expect, vi } from 'vitest';
import { Post, Profile, PostComment } from '../structures';
import type { InstaloaderContext } from '../instaloader-context';
import type { JsonObject } from '../types';

// Mock InstaloaderContext - use unknown cast for partial mock
function createMockContext(overrides: Record<string, unknown> = {}): InstaloaderContext {
  return {
    iphoneSupport: false,
    is_logged_in: false,
    username: null,
    profile_id_cache: new Map(),
    graphql_query: vi.fn(),
    doc_id_graphql_query: vi.fn(),
    getJson: vi.fn(),
    get_iphone_json: vi.fn(),
    head: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
    ...overrides,
  } as unknown as InstaloaderContext;
}

// Sample post node data
const samplePostNode: JsonObject = {
  shortcode: 'CpFxHKMNu7g',
  id: '2999999999999999999',
  __typename: 'GraphImage',
  display_url: 'https://example.com/image.jpg',
  is_video: false,
  taken_at_timestamp: 1677000000,
  edge_media_to_caption: {
    edges: [{ node: { text: 'Hello #world @friend! #photography' } }],
  },
  edge_media_preview_like: { count: 100 },
  edge_media_to_comment: { count: 10 },
  owner: { id: '123456789', username: 'testuser' },
  accessibility_caption: 'A beautiful sunset photo',
};

const sampleVideoNode: JsonObject = {
  shortcode: 'CpFxVideo123',
  id: '2888888888888888888',
  __typename: 'GraphVideo',
  display_url: 'https://example.com/thumbnail.jpg',
  is_video: true,
  video_url: 'https://example.com/video.mp4',
  video_view_count: 5000,
  video_duration: 30.5,
  taken_at_timestamp: 1677000000,
  edge_media_to_caption: {
    edges: [{ node: { text: 'Check out this video!' } }],
  },
  edge_media_preview_like: { count: 200 },
  edge_media_to_comment: { count: 25 },
  owner: { id: '123456789', username: 'testuser' },
};

const sampleSidecarNode: JsonObject = {
  shortcode: 'CpFxSidecar99',
  id: '2777777777777777777',
  __typename: 'GraphSidecar',
  display_url: 'https://example.com/first.jpg',
  is_video: false,
  taken_at_timestamp: 1677000000,
  edge_sidecar_to_children: {
    edges: [
      { node: { display_url: 'https://example.com/1.jpg', is_video: false } },
      { node: { display_url: 'https://example.com/2.jpg', is_video: false } },
      {
        node: {
          display_url: 'https://example.com/3.mp4',
          is_video: true,
          video_url: 'https://example.com/3.mp4',
        },
      },
    ],
  },
  edge_media_to_caption: {
    edges: [{ node: { text: 'Multiple photos!' } }],
  },
  edge_media_preview_like: { count: 50 },
  edge_media_to_comment: { count: 5 },
  owner: { id: '123456789', username: 'testuser' },
};

describe('Post', () => {
  describe('constructor', () => {
    it('should create a Post from a valid node', () => {
      const context = createMockContext();
      const post = new Post(context, samplePostNode);
      expect(post).toBeInstanceOf(Post);
    });

    it('should throw if node has no shortcode or code', () => {
      const context = createMockContext();
      expect(() => new Post(context, { id: '123' })).toThrow(
        "Node must contain 'shortcode' or 'code'"
      );
    });

    it('should accept node with "code" instead of "shortcode"', () => {
      const context = createMockContext();
      const nodeWithCode = { ...samplePostNode, code: 'ABC123' };
      delete (nodeWithCode as Record<string, unknown>)['shortcode'];
      const post = new Post(context, nodeWithCode);
      expect(post.shortcode).toBe('ABC123');
    });
  });

  describe('properties', () => {
    it('should return correct shortcode', () => {
      const context = createMockContext();
      const post = new Post(context, samplePostNode);
      expect(post.shortcode).toBe('CpFxHKMNu7g');
    });

    it('should return correct mediaid as BigInt', () => {
      const context = createMockContext();
      const post = new Post(context, samplePostNode);
      expect(post.mediaid).toBe(BigInt('2999999999999999999'));
    });

    it('should return correct typename', () => {
      const context = createMockContext();
      const post = new Post(context, samplePostNode);
      expect(post.typename).toBe('GraphImage');
    });

    it('should return correct url', () => {
      const context = createMockContext();
      const post = new Post(context, samplePostNode);
      expect(post.url).toBe('https://example.com/image.jpg');
    });

    it('should return correct caption', () => {
      const context = createMockContext();
      const post = new Post(context, samplePostNode);
      expect(post.caption).toBe('Hello #world @friend! #photography');
    });

    it('should return null caption when none exists', () => {
      const context = createMockContext();
      const nodeWithoutCaption = { ...samplePostNode };
      delete (nodeWithoutCaption as Record<string, unknown>)['edge_media_to_caption'];
      const post = new Post(context, nodeWithoutCaption);
      expect(post.caption).toBeNull();
    });

    it('should extract caption hashtags', () => {
      const context = createMockContext();
      const post = new Post(context, samplePostNode);
      expect(post.caption_hashtags).toEqual(['world', 'photography']);
    });

    it('should extract caption mentions', () => {
      const context = createMockContext();
      const post = new Post(context, samplePostNode);
      expect(post.caption_mentions).toContain('friend');
    });

    it('should return correct likes count', () => {
      const context = createMockContext();
      const post = new Post(context, samplePostNode);
      expect(post.likes).toBe(100);
    });

    it('should return correct comments count', () => {
      const context = createMockContext();
      const post = new Post(context, samplePostNode);
      expect(post.comments).toBe(10);
    });

    it('should return correct accessibility_caption', () => {
      const context = createMockContext();
      const post = new Post(context, samplePostNode);
      expect(post.accessibility_caption).toBe('A beautiful sunset photo');
    });

    it('should return correct date', () => {
      const context = createMockContext();
      const post = new Post(context, samplePostNode);
      const expectedDate = new Date(1677000000 * 1000);
      expect(post.date.getTime()).toBe(expectedDate.getTime());
    });
  });

  describe('video properties', () => {
    it('should correctly identify video posts', () => {
      const context = createMockContext();
      const videoPost = new Post(context, sampleVideoNode);
      expect(videoPost.is_video).toBe(true);
    });

    it('should correctly identify non-video posts', () => {
      const context = createMockContext();
      const imagePost = new Post(context, samplePostNode);
      expect(imagePost.is_video).toBe(false);
    });

    it('should return video_url for video posts', () => {
      const context = createMockContext();
      const videoPost = new Post(context, sampleVideoNode);
      expect(videoPost.video_url).toBe('https://example.com/video.mp4');
    });

    it('should return null video_url for image posts', () => {
      const context = createMockContext();
      const imagePost = new Post(context, samplePostNode);
      expect(imagePost.video_url).toBeNull();
    });

    it('should return video_view_count for video posts', () => {
      const context = createMockContext();
      const videoPost = new Post(context, sampleVideoNode);
      expect(videoPost.video_view_count).toBe(5000);
    });

    it('should return video_duration for video posts', () => {
      const context = createMockContext();
      const videoPost = new Post(context, sampleVideoNode);
      expect(videoPost.video_duration).toBe(30.5);
    });
  });

  describe('sidecar/carousel posts', () => {
    it('should return correct mediacount for sidecar', () => {
      const context = createMockContext();
      const sidecarPost = new Post(context, sampleSidecarNode);
      expect(sidecarPost.mediacount).toBe(3);
    });

    it('should return 1 for non-sidecar posts', () => {
      const context = createMockContext();
      const imagePost = new Post(context, samplePostNode);
      expect(imagePost.mediacount).toBe(1);
    });

    it('should yield sidecar nodes', () => {
      const context = createMockContext();
      const sidecarPost = new Post(context, sampleSidecarNode);
      const nodes = [...sidecarPost.getSidecarNodes()];
      expect(nodes.length).toBe(3);
      expect(nodes[0]?.is_video).toBe(false);
      expect(nodes[2]?.is_video).toBe(true);
    });

    it('should return is_videos array for sidecar', () => {
      const context = createMockContext();
      const sidecarPost = new Post(context, sampleSidecarNode);
      expect(sidecarPost.getIsVideos()).toEqual([false, false, true]);
    });
  });

  describe('equality and representation', () => {
    it('should be equal to another Post with same shortcode', () => {
      const context = createMockContext();
      const post1 = new Post(context, samplePostNode);
      const post2 = new Post(context, { ...samplePostNode });
      expect(post1.equals(post2)).toBe(true);
    });

    it('should not be equal to Post with different shortcode', () => {
      const context = createMockContext();
      const post1 = new Post(context, samplePostNode);
      const post2 = new Post(context, { ...samplePostNode, shortcode: 'different' });
      expect(post1.equals(post2)).toBe(false);
    });

    it('should have correct string representation', () => {
      const context = createMockContext();
      const post = new Post(context, samplePostNode);
      expect(post.toString()).toBe('<Post CpFxHKMNu7g>');
    });
  });

  describe('JSON serialization', () => {
    it('should convert to JSON object', () => {
      const context = createMockContext();
      const post = new Post(context, samplePostNode);
      const json = post.toJSON();
      expect(json['shortcode']).toBe('CpFxHKMNu7g');
      expect(json['__typename']).toBe('GraphImage');
    });
  });

  describe('static methods', () => {
    it('should return supported GraphQL types', () => {
      const types = Post.supportedGraphqlTypes();
      expect(types).toContain('GraphImage');
      expect(types).toContain('GraphVideo');
      expect(types).toContain('GraphSidecar');
    });
  });

  describe('fromIphoneStruct', () => {
    it('should create Post from iPhone struct', () => {
      const context = createMockContext();
      const iphoneMedia: JsonObject = {
        pk: '12345678901234567',
        code: 'iPhoneCode123',
        media_type: 1,
        taken_at: 1677000000,
        caption: { text: 'iPhone caption' },
        has_liked: false,
        like_count: 42,
        comment_count: 3,
        image_versions2: {
          candidates: [{ url: 'https://example.com/iphone.jpg' }],
        },
        user: {
          pk: '999',
          username: 'iphoneuser',
          is_private: false,
          full_name: 'iPhone User',
          profile_pic_url: 'https://example.com/profile.jpg',
        },
      };

      const post = Post.fromIphoneStruct(context, iphoneMedia);
      expect(post.shortcode).toBe('iPhoneCode123');
      expect(post.caption).toBe('iPhone caption');
      expect(post.likes).toBe(42);
    });

    it('should handle video media type', () => {
      const context = createMockContext();
      const iphoneMedia: JsonObject = {
        pk: '12345678901234567',
        code: 'iPhoneVideo123',
        media_type: 2, // Video
        taken_at: 1677000000,
        caption: { text: 'Video caption' },
        has_liked: true,
        like_count: 100,
        video_versions: [
          { url: 'https://example.com/low.mp4' },
          { url: 'https://example.com/high.mp4' },
        ],
        video_duration: 15.5,
        view_count: 5000,
      };

      const post = Post.fromIphoneStruct(context, iphoneMedia);
      expect(post.typename).toBe('GraphVideo');
      expect(post.is_video).toBe(true);
      expect(post.video_url).toBe('https://example.com/high.mp4');
      expect(post.video_duration).toBe(15.5);
    });

    it('should handle sidecar media type', () => {
      const context = createMockContext();
      const iphoneMedia: JsonObject = {
        pk: '12345678901234567',
        code: 'iPhoneSidecar123',
        media_type: 8, // Sidecar
        taken_at: 1677000000,
        caption: null,
        has_liked: false,
        like_count: 50,
      };

      const post = Post.fromIphoneStruct(context, iphoneMedia);
      expect(post.typename).toBe('GraphSidecar');
    });

    it('should handle null caption', () => {
      const context = createMockContext();
      const iphoneMedia: JsonObject = {
        pk: '12345678901234567',
        code: 'NoCaption123',
        media_type: 1,
        taken_at: 1677000000,
        caption: null,
        has_liked: false,
        like_count: 10,
      };

      const post = Post.fromIphoneStruct(context, iphoneMedia);
      expect(post.caption).toBeNull();
    });

    it('should handle missing image_versions2', () => {
      const context = createMockContext();
      const iphoneMedia: JsonObject = {
        pk: '12345678901234567',
        code: 'NoImage123',
        media_type: 1,
        taken_at: 1677000000,
        caption: null,
        has_liked: false,
        like_count: 10,
      };

      const post = Post.fromIphoneStruct(context, iphoneMedia);
      // Should not throw
      expect(post.shortcode).toBe('NoImage123');
    });
  });

  describe('date properties', () => {
    it('should return correct date_local', () => {
      const context = createMockContext();
      const post = new Post(context, samplePostNode);
      expect(post.date_local).toBeInstanceOf(Date);
    });

    it('should return correct date_utc', () => {
      const context = createMockContext();
      const post = new Post(context, samplePostNode);
      expect(post.date_utc).toBeInstanceOf(Date);
    });
  });

  describe('owner profile', () => {
    it('should return owner profile asynchronously', async () => {
      const context = createMockContext();
      // Provide owner data in the node
      const nodeWithOwner = {
        ...samplePostNode,
        owner: {
          id: '123456789',
          username: 'testuser',
          is_private: false,
        },
      };
      const post = new Post(context, nodeWithOwner);
      const profile = await post.getOwnerProfile();
      expect(profile).toBeInstanceOf(Profile);
      expect(profile.username).toBe('testuser');
    });

    it('should cache owner profile on subsequent calls', async () => {
      const context = createMockContext();
      const nodeWithOwner = {
        ...samplePostNode,
        owner: {
          id: '123456789',
          username: 'testuser',
          is_private: false,
        },
      };
      const post = new Post(context, nodeWithOwner);
      const profile1 = await post.getOwnerProfile();
      const profile2 = await post.getOwnerProfile();
      expect(profile1).toBe(profile2); // Same instance
    });
  });

  describe('pcaption', () => {
    it('should return printable caption', () => {
      const context = createMockContext();
      const post = new Post(context, samplePostNode);
      // pcaption truncates to 30 chars with ellipsis
      expect(post.pcaption).toBe('Hello #world @friend! #photogr…');
    });

    it('should return empty string when no caption', () => {
      const context = createMockContext();
      const nodeWithoutCaption = { ...samplePostNode };
      delete (nodeWithoutCaption as Record<string, unknown>)['edge_media_to_caption'];
      const post = new Post(context, nodeWithoutCaption);
      expect(post.pcaption).toBe('');
    });

    it('should not truncate short captions', () => {
      const context = createMockContext();
      const shortCaption = 'Short';
      const nodeWithShortCaption = {
        ...samplePostNode,
        edge_media_to_caption: { edges: [{ node: { text: shortCaption } }] },
      };
      const post = new Post(context, nodeWithShortCaption);
      expect(post.pcaption).toBe('Short');
    });
  });

  describe('tagged_users', () => {
    it('should return empty array when no tagged users', () => {
      const context = createMockContext();
      const post = new Post(context, samplePostNode);
      expect(post.tagged_users).toEqual([]);
    });

    it('should return lowercased tagged usernames', () => {
      const context = createMockContext();
      const nodeWithTags = {
        ...samplePostNode,
        edge_media_to_tagged_user: {
          edges: [
            { node: { user: { username: 'User1' } } },
            { node: { user: { username: 'User2' } } },
          ],
        },
      };
      const post = new Post(context, nodeWithTags);
      expect(post.tagged_users).toEqual(['user1', 'user2']);
    });
  });

  describe('caption with different formats', () => {
    it('should handle caption field directly', () => {
      const context = createMockContext();
      const nodeWithDirectCaption = {
        ...samplePostNode,
        caption: 'Direct caption',
      };
      delete (nodeWithDirectCaption as Record<string, unknown>)['edge_media_to_caption'];
      const post = new Post(context, nodeWithDirectCaption);
      expect(post.caption).toBe('Direct caption');
    });

    it('should handle empty edge_media_to_caption edges', () => {
      const context = createMockContext();
      const nodeWithEmptyEdges = {
        ...samplePostNode,
        edge_media_to_caption: { edges: [] },
      };
      const post = new Post(context, nodeWithEmptyEdges);
      expect(post.caption).toBeNull();
    });
  });

  describe('owner_id', () => {
    it('should return correct owner_id', () => {
      const context = createMockContext();
      const post = new Post(context, samplePostNode);
      expect(post.owner_id).toBe(123456789);
    });

    it('should return null when owner has no id', () => {
      const context = createMockContext();
      const nodeWithoutOwnerId = { ...samplePostNode, owner: {} };
      const post = new Post(context, nodeWithoutOwnerId);
      expect(post.owner_id).toBeNull();
    });

    it('should return null when no owner', () => {
      const context = createMockContext();
      const nodeWithoutOwner = { ...samplePostNode };
      delete (nodeWithoutOwner as Record<string, unknown>)['owner'];
      const post = new Post(context, nodeWithoutOwner);
      expect(post.owner_id).toBeNull();
    });
  });

  describe('getOwnerUsername', () => {
    it('should return owner username asynchronously', async () => {
      const context = createMockContext();
      const nodeWithOwner = {
        ...samplePostNode,
        owner: { id: '123456789', username: 'testuser' },
      };
      const post = new Post(context, nodeWithOwner);
      const username = await post.getOwnerUsername();
      expect(username).toBe('testuser');
    });
  });

  describe('fromIphoneStruct with carousel', () => {
    it('should handle carousel media (sidecar)', () => {
      const context = createMockContext();
      const iphoneMedia: JsonObject = {
        pk: '12345678901234567',
        code: 'iPhoneCarousel123',
        media_type: 8, // Sidecar
        taken_at: 1677000000,
        caption: { text: 'Carousel post' },
        has_liked: false,
        like_count: 75,
        carousel_media: [
          {
            media_type: 1,
            image_versions2: {
              candidates: [{ url: 'https://example.com/slide1.jpg' }],
            },
          },
          {
            media_type: 2,
            image_versions2: {
              candidates: [{ url: 'https://example.com/slide2_thumb.jpg' }],
            },
            video_versions: [{ url: 'https://example.com/slide2.mp4' }],
          },
        ],
        user: {
          pk: '999',
          username: 'carouseluser',
          is_private: false,
        },
      };

      const post = Post.fromIphoneStruct(context, iphoneMedia);
      expect(post.typename).toBe('GraphSidecar');
      expect(post.mediacount).toBe(2);
    });

    it('should handle title field', () => {
      const context = createMockContext();
      const iphoneMedia: JsonObject = {
        pk: '12345678901234567',
        code: 'TitleCode123',
        media_type: 1,
        taken_at: 1677000000,
        caption: null,
        title: 'Video Title',
        has_liked: false,
        like_count: 10,
        user: {
          pk: '999',
          username: 'titleuser',
          is_private: false,
        },
      };

      const post = Post.fromIphoneStruct(context, iphoneMedia);
      // title is stored in the node
      expect(post.toJSON()['title']).toBe('Video Title');
    });

    it('should handle accessibility_caption field', () => {
      const context = createMockContext();
      const iphoneMedia: JsonObject = {
        pk: '12345678901234567',
        code: 'AccessCode123',
        media_type: 1,
        taken_at: 1677000000,
        caption: null,
        accessibility_caption: 'A photo showing sunset',
        has_liked: false,
        like_count: 10,
      };

      const post = Post.fromIphoneStruct(context, iphoneMedia);
      expect(post.accessibility_caption).toBe('A photo showing sunset');
    });
  });
});

describe('PostComment', () => {
  describe('constructor', () => {
    it('should create a PostComment from a valid node', () => {
      const context = createMockContext();
      const post = new Post(context, samplePostNode);
      const commentNode: JsonObject = {
        id: 12345,
        created_at: 1677000000,
        text: 'Great post!',
        owner: { id: '111', username: 'commenter' },
        edge_liked_by: { count: 5 },
      };
      const emptyAnswers = (async function* () {})();
      const comment = new PostComment(context, commentNode, emptyAnswers, post);
      expect(comment).toBeInstanceOf(PostComment);
    });
  });

  describe('properties', () => {
    it('should return correct id', () => {
      const context = createMockContext();
      const post = new Post(context, samplePostNode);
      const commentNode: JsonObject = {
        id: 12345,
        created_at: 1677000000,
        text: 'Great post!',
        owner: { id: '111', username: 'commenter' },
        edge_liked_by: { count: 5 },
      };
      const emptyAnswers = (async function* () {})();
      const comment = new PostComment(context, commentNode, emptyAnswers, post);
      expect(comment.id).toBe(12345);
    });

    it('should return correct created_at_utc', () => {
      const context = createMockContext();
      const post = new Post(context, samplePostNode);
      const commentNode: JsonObject = {
        id: 12345,
        created_at: 1677000000,
        text: 'Great post!',
        owner: { id: '111', username: 'commenter' },
        edge_liked_by: { count: 5 },
      };
      const emptyAnswers = (async function* () {})();
      const comment = new PostComment(context, commentNode, emptyAnswers, post);
      expect(comment.created_at_utc.getTime()).toBe(1677000000 * 1000);
    });

    it('should return correct text', () => {
      const context = createMockContext();
      const post = new Post(context, samplePostNode);
      const commentNode: JsonObject = {
        id: 12345,
        created_at: 1677000000,
        text: 'Great post!',
        owner: { id: '111', username: 'commenter' },
        edge_liked_by: { count: 5 },
      };
      const emptyAnswers = (async function* () {})();
      const comment = new PostComment(context, commentNode, emptyAnswers, post);
      expect(comment.text).toBe('Great post!');
    });

    it('should return correct likes_count', () => {
      const context = createMockContext();
      const post = new Post(context, samplePostNode);
      const commentNode: JsonObject = {
        id: 12345,
        created_at: 1677000000,
        text: 'Great post!',
        owner: { id: '111', username: 'commenter' },
        edge_liked_by: { count: 5 },
      };
      const emptyAnswers = (async function* () {})();
      const comment = new PostComment(context, commentNode, emptyAnswers, post);
      expect(comment.likes_count).toBe(5);
    });

    it('should return 0 likes_count when no edge_liked_by', () => {
      const context = createMockContext();
      const post = new Post(context, samplePostNode);
      const commentNode: JsonObject = {
        id: 12345,
        created_at: 1677000000,
        text: 'Great post!',
        owner: { id: '111', username: 'commenter' },
      };
      const emptyAnswers = (async function* () {})();
      const comment = new PostComment(context, commentNode, emptyAnswers, post);
      expect(comment.likes_count).toBe(0);
    });

    it('should return owner Profile', () => {
      const context = createMockContext();
      const post = new Post(context, samplePostNode);
      const commentNode: JsonObject = {
        id: 12345,
        created_at: 1677000000,
        text: 'Great post!',
        owner: { id: '111', username: 'commenter' },
        edge_liked_by: { count: 5 },
      };
      const emptyAnswers = (async function* () {})();
      const comment = new PostComment(context, commentNode, emptyAnswers, post);
      expect(comment.owner).toBeInstanceOf(Profile);
      expect(comment.owner.username).toBe('commenter');
    });

    it('should return answers iterator', () => {
      const context = createMockContext();
      const post = new Post(context, samplePostNode);
      const commentNode: JsonObject = {
        id: 12345,
        created_at: 1677000000,
        text: 'Great post!',
        owner: { id: '111', username: 'commenter' },
      };
      const emptyAnswers = (async function* () {})();
      const comment = new PostComment(context, commentNode, emptyAnswers, post);
      expect(comment.answers).toBeDefined();
    });
  });

  describe('toString', () => {
    it('should return correct string representation', () => {
      const context = createMockContext();
      const post = new Post(context, samplePostNode);
      const commentNode: JsonObject = {
        id: 12345,
        created_at: 1677000000,
        text: 'Great post!',
        owner: { id: '111', username: 'commenter' },
      };
      const emptyAnswers = (async function* () {})();
      const comment = new PostComment(context, commentNode, emptyAnswers, post);
      expect(comment.toString()).toBe('<PostComment 12345 of CpFxHKMNu7g>');
    });
  });

  describe('fromIphoneStruct', () => {
    it('should create PostComment from iPhone struct', () => {
      const context = createMockContext();
      const post = new Post(context, samplePostNode);
      const iphoneComment: JsonObject = {
        pk: 12345,
        created_at: 1677000000,
        text: 'iPhone comment',
        comment_like_count: 10,
        user: { pk: '111', username: 'iphonecommenter' },
      };
      const emptyAnswers = (async function* () {})();
      const comment = PostComment.fromIphoneStruct(context, iphoneComment, emptyAnswers, post);
      expect(comment.id).toBe(12345);
      expect(comment.text).toBe('iPhone comment');
      expect(comment.likes_count).toBe(10);
    });

    it('should return owner from iphone_struct', () => {
      const context = createMockContext();
      const post = new Post(context, samplePostNode);
      const iphoneComment: JsonObject = {
        pk: 12345,
        created_at: 1677000000,
        text: 'iPhone comment',
        comment_like_count: 10,
        user: { pk: '111', username: 'iphonecommenter', is_private: false },
      };
      const emptyAnswers = (async function* () {})();
      const comment = PostComment.fromIphoneStruct(context, iphoneComment, emptyAnswers, post);
      expect(comment.owner.username).toBe('iphonecommenter');
    });
  });
});

describe('Post additional properties', () => {
  describe('title', () => {
    it('should return title when available', () => {
      const context = createMockContext();
      const nodeWithTitle = {
        ...samplePostNode,
        title: 'My Post Title',
      };
      const post = new Post(context, nodeWithTitle);
      expect(post.title).toBe('My Post Title');
    });

    it('should return null when title not available', () => {
      const context = createMockContext();
      const post = new Post(context, samplePostNode);
      expect(post.title).toBeNull();
    });
  });

  describe('video_view_count', () => {
    it('should return view count for videos', () => {
      const context = createMockContext();
      const nodeWithViews = {
        ...sampleVideoNode,
        video_view_count: 1000,
      };
      const post = new Post(context, nodeWithViews);
      expect(post.video_view_count).toBe(1000);
    });

    it('should return null for non-videos', () => {
      const context = createMockContext();
      const post = new Post(context, samplePostNode);
      expect(post.video_view_count).toBeNull();
    });

    it('should return null when view count not available', () => {
      const context = createMockContext();
      const videoWithoutViews = { ...sampleVideoNode };
      delete (videoWithoutViews as Record<string, unknown>)['video_view_count'];
      const post = new Post(context, videoWithoutViews);
      expect(post.video_view_count).toBeNull();
    });
  });

  describe('viewer_has_liked', () => {
    it('should return null when not logged in', () => {
      const context = createMockContext({ is_logged_in: false });
      const post = new Post(context, samplePostNode);
      expect(post.viewer_has_liked).toBeNull();
    });

    it('should return true when viewer has liked (likes structure)', () => {
      const context = createMockContext({ is_logged_in: true });
      const nodeWithLike = {
        ...samplePostNode,
        likes: { viewer_has_liked: true },
      };
      const post = new Post(context, nodeWithLike);
      expect(post.viewer_has_liked).toBe(true);
    });

    it('should return false when viewer has not liked', () => {
      const context = createMockContext({ is_logged_in: true });
      const nodeWithLike = {
        ...samplePostNode,
        viewer_has_liked: false,
      };
      const post = new Post(context, nodeWithLike);
      expect(post.viewer_has_liked).toBe(false);
    });
  });

  describe('mediacount', () => {
    it('should return 1 for non-sidecar posts', () => {
      const context = createMockContext();
      const post = new Post(context, samplePostNode);
      expect(post.mediacount).toBe(1);
    });

    it('should return count of slides for sidecar posts', () => {
      const context = createMockContext();
      const sidecarNode = {
        ...samplePostNode,
        __typename: 'GraphSidecar',
        edge_sidecar_to_children: {
          edges: [{ node: {} }, { node: {} }, { node: {} }],
        },
      };
      const post = new Post(context, sidecarNode);
      expect(post.mediacount).toBe(3);
    });

    it('should return 1 when sidecar has no edge data', () => {
      const context = createMockContext();
      const sidecarNode = {
        ...samplePostNode,
        __typename: 'GraphSidecar',
      };
      const post = new Post(context, sidecarNode);
      expect(post.mediacount).toBe(1);
    });
  });

  describe('date', () => {
    it('should return same as date_utc', () => {
      const context = createMockContext();
      const post = new Post(context, samplePostNode);
      expect(post.date.getTime()).toBe(post.date_utc.getTime());
    });
  });

  describe('url', () => {
    it('should return display_url', () => {
      const context = createMockContext();
      const post = new Post(context, samplePostNode);
      expect(post.url).toBe('https://example.com/image.jpg');
    });

    it('should fallback to display_src', () => {
      const context = createMockContext();
      const nodeWithSrc = {
        ...samplePostNode,
        display_src: 'https://example.com/fallback.jpg',
      };
      delete (nodeWithSrc as Record<string, unknown>)['display_url'];
      const post = new Post(context, nodeWithSrc);
      expect(post.url).toBe('https://example.com/fallback.jpg');
    });
  });

  describe('accessibility_caption', () => {
    it('should return accessibility caption when available', () => {
      const context = createMockContext();
      const post = new Post(context, samplePostNode);
      expect(post.accessibility_caption).toBe('A beautiful sunset photo');
    });

    it('should return null when not available', () => {
      const context = createMockContext();
      const nodeWithoutCaption = { ...samplePostNode };
      delete (nodeWithoutCaption as Record<string, unknown>)['accessibility_caption'];
      const post = new Post(context, nodeWithoutCaption);
      expect(post.accessibility_caption).toBeNull();
    });
  });

  describe('video_url', () => {
    it('should return video_url for videos', () => {
      const context = createMockContext();
      const post = new Post(context, sampleVideoNode);
      expect(post.video_url).toBe('https://example.com/video.mp4');
    });

    it('should return null for non-videos', () => {
      const context = createMockContext();
      const post = new Post(context, samplePostNode);
      expect(post.video_url).toBeNull();
    });

    it('should return null when video_url not available', () => {
      const context = createMockContext();
      const videoWithoutUrl = { ...sampleVideoNode };
      delete (videoWithoutUrl as Record<string, unknown>)['video_url'];
      const post = new Post(context, videoWithoutUrl);
      expect(post.video_url).toBeNull();
    });
  });
});
