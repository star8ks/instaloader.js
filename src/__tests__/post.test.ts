/**
 * Tests for Post class in structures.ts
 */

import { describe, it, expect, vi } from 'vitest';
import { Post } from '../structures';
import type { InstaloaderContext } from '../structures';
import type { JsonObject } from '../types';

// Mock InstaloaderContext
function createMockContext(overrides: Partial<InstaloaderContext> = {}): InstaloaderContext {
  return {
    iphone_support: false,
    is_logged_in: false,
    username: null,
    profile_id_cache: new Map(),
    graphql_query: vi.fn(),
    doc_id_graphql_query: vi.fn(),
    get_json: vi.fn(),
    get_iphone_json: vi.fn(),
    head: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
    ...overrides,
  };
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
      { node: { display_url: 'https://example.com/3.mp4', is_video: true, video_url: 'https://example.com/3.mp4' } },
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
      expect(() => new Post(context, { id: '123' })).toThrow("Node must contain 'shortcode' or 'code'");
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
  });
});
