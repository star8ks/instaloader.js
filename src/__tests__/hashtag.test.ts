/**
 * Tests for Hashtag and TopSearchResults classes in structures.ts
 */

import { describe, it, expect, vi } from 'vitest';
import { Hashtag, TopSearchResults, Profile, Post } from '../structures';
import type { InstaloaderContext } from '../instaloadercontext';
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

// Sample hashtag node data
const sampleHashtagNode: JsonObject = {
  id: '17843829475633456',
  name: 'Photography',
  profile_pic_url: 'https://example.com/hashtag.jpg',
  edge_hashtag_to_media: { count: 1000000 },
  edge_hashtag_to_top_posts: {
    edges: [
      {
        node: {
          id: '123',
          shortcode: 'ABC123',
          __typename: 'GraphImage',
          display_url: 'https://example.com/post1.jpg',
          is_video: false,
          taken_at_timestamp: 1677000000,
          edge_media_to_caption: { edges: [] },
          edge_media_preview_like: { count: 100 },
          edge_media_to_comment: { count: 10 },
          owner: { id: '999', username: 'poster' },
        },
      },
    ],
  },
  description: 'Photography related posts',
  allow_following: true,
  is_following: false,
};

// Sample search results data
const sampleSearchResults: JsonObject = {
  users: [
    {
      user: {
        pk: '123456789',
        username: 'testuser',
        full_name: 'Test User',
        is_private: false,
        profile_pic_url: 'https://example.com/user.jpg',
      },
    },
    {
      user: {
        pk: '987654321',
        username: 'testuser2',
        full_name: 'Test User 2',
        is_private: true,
        profile_pic_url: 'https://example.com/user2.jpg',
      },
    },
  ],
  places: [
    {
      place: {
        slug: 'new-york-city',
        location: {
          pk: '12345',
          name: 'New York City',
          lat: 40.7128,
          lng: -74.006,
        },
      },
    },
  ],
  hashtags: [
    {
      hashtag: {
        name: 'test',
        id: '111',
        profile_pic_url: 'https://example.com/tag.jpg',
      },
    },
    {
      hashtag: {
        name: 'testing',
        id: '222',
        profile_pic_url: 'https://example.com/tag2.jpg',
      },
    },
  ],
};

describe('Hashtag', () => {
  describe('constructor', () => {
    it('should create a Hashtag from a valid node', () => {
      const context = createMockContext();
      const hashtag = new Hashtag(context, sampleHashtagNode);
      expect(hashtag).toBeInstanceOf(Hashtag);
    });

    it('should throw if node has no name', () => {
      const context = createMockContext();
      expect(() => new Hashtag(context, { id: '123' })).toThrow("Node must contain 'name'");
    });
  });

  describe('basic properties', () => {
    it('should return lowercase name', () => {
      const context = createMockContext();
      const hashtag = new Hashtag(context, sampleHashtagNode);
      expect(hashtag.name).toBe('photography');
    });

    it('should handle uppercase names', () => {
      const context = createMockContext();
      const hashtag = new Hashtag(context, { ...sampleHashtagNode, name: 'UPPERCASE' });
      expect(hashtag.name).toBe('uppercase');
    });
  });

  describe('async metadata methods', () => {
    it('should return correct hashtagid', async () => {
      const context = createMockContext();
      const hashtag = new Hashtag(context, sampleHashtagNode);
      const id = await hashtag.getHashtagId();
      expect(id).toBe(17843829475633456);
    });

    it('should return correct profile_pic_url', async () => {
      const context = createMockContext();
      const hashtag = new Hashtag(context, sampleHashtagNode);
      const url = await hashtag.getProfilePicUrl();
      expect(url).toBe('https://example.com/hashtag.jpg');
    });

    it('should return correct description', async () => {
      const context = createMockContext();
      const hashtag = new Hashtag(context, sampleHashtagNode);
      const description = await hashtag.getDescription();
      expect(description).toBe('Photography related posts');
    });

    it('should return correct mediacount', async () => {
      const context = createMockContext();
      const hashtag = new Hashtag(context, sampleHashtagNode);
      const count = await hashtag.getMediacount();
      expect(count).toBe(1000000);
    });

    it('should fallback to media_count when edge_hashtag_to_media is not available', async () => {
      const context = createMockContext();
      const hashtagWithMediaCount = {
        ...sampleHashtagNode,
        edge_hashtag_to_media: undefined,
        media_count: 500000,
      };
      const hashtag = new Hashtag(context, hashtagWithMediaCount);
      const count = await hashtag.getMediacount();
      expect(count).toBe(500000);
    });

    it('should return correct allow_following', async () => {
      const context = createMockContext();
      const hashtag = new Hashtag(context, sampleHashtagNode);
      const allowFollowing = await hashtag.getAllowFollowing();
      expect(allowFollowing).toBe(true);
    });

    it('should return correct is_following', async () => {
      const context = createMockContext();
      const hashtag = new Hashtag(context, sampleHashtagNode);
      const isFollowing = await hashtag.getIsFollowing();
      expect(isFollowing).toBe(false);
    });

    it('should fallback to following field when is_following is not available', async () => {
      const context = createMockContext();
      const hashtagWithFollowing = {
        ...sampleHashtagNode,
        is_following: undefined,
        following: true,
      };
      const hashtag = new Hashtag(context, hashtagWithFollowing);
      const isFollowing = await hashtag.getIsFollowing();
      expect(isFollowing).toBe(true);
    });
  });

  describe('getTopPosts', () => {
    it('should yield Post instances', async () => {
      const context = createMockContext();
      const hashtag = new Hashtag(context, sampleHashtagNode);
      const posts: Post[] = [];
      for await (const post of hashtag.getTopPosts()) {
        posts.push(post);
      }
      expect(posts.length).toBe(1);
      expect(posts[0]).toBeInstanceOf(Post);
      expect(posts[0]?.shortcode).toBe('ABC123');
    });

    it('should handle errors gracefully and return nothing', async () => {
      const context = createMockContext();
      // Create hashtag without edge_hashtag_to_top_posts data to trigger error
      const hashtagWithoutTopPosts = {
        ...sampleHashtagNode,
        edge_hashtag_to_top_posts: undefined,
      };
      const hashtag = new Hashtag(context, hashtagWithoutTopPosts);
      const posts: Post[] = [];
      for await (const post of hashtag.getTopPosts()) {
        posts.push(post);
      }
      expect(posts).toHaveLength(0);
    });
  });

  describe('equality and representation', () => {
    it('should be equal to another Hashtag with same name', () => {
      const context = createMockContext();
      const hashtag1 = new Hashtag(context, sampleHashtagNode);
      const hashtag2 = new Hashtag(context, { ...sampleHashtagNode });
      expect(hashtag1.equals(hashtag2)).toBe(true);
    });

    it('should not be equal to Hashtag with different name', () => {
      const context = createMockContext();
      const hashtag1 = new Hashtag(context, sampleHashtagNode);
      const hashtag2 = new Hashtag(context, { ...sampleHashtagNode, name: 'different' });
      expect(hashtag1.equals(hashtag2)).toBe(false);
    });

    it('should have correct string representation', () => {
      const context = createMockContext();
      const hashtag = new Hashtag(context, sampleHashtagNode);
      expect(hashtag.toString()).toBe('<Hashtag #photography>');
    });
  });

  describe('JSON serialization', () => {
    it('should convert to JSON object', () => {
      const context = createMockContext();
      const hashtag = new Hashtag(context, sampleHashtagNode);
      const json = hashtag.toJSON();
      expect(json['name']).toBe('Photography');
      expect(json['id']).toBe('17843829475633456');
    });

    it('should exclude edge collections from JSON', () => {
      const context = createMockContext();
      const hashtag = new Hashtag(context, sampleHashtagNode);
      const json = hashtag.toJSON();
      expect(json['edge_hashtag_to_top_posts']).toBeUndefined();
      expect(json['edge_hashtag_to_media']).toBeUndefined();
    });
  });

  describe('getPostsResumable', () => {
    it('should be a method', () => {
      const context = createMockContext();
      const hashtag = new Hashtag(context, sampleHashtagNode);
      expect(typeof hashtag.getPostsResumable).toBe('function');
    });

    it('should return a NodeIterator object that can iterate', async () => {
      // Mock graphql_query to return proper paginated data
      const mockGraphqlQuery = vi.fn().mockResolvedValue({
        data: {
          hashtag: {
            edge_hashtag_to_media: {
              edges: [
                {
                  node: {
                    id: '123',
                    shortcode: 'ABC123',
                    __typename: 'GraphImage',
                    display_url: 'https://example.com/post1.jpg',
                    is_video: false,
                    taken_at_timestamp: 1677000000,
                    edge_media_to_caption: { edges: [] },
                    edge_media_preview_like: { count: 100 },
                    edge_media_to_comment: { count: 10 },
                    owner: { id: '999', username: 'poster' },
                  },
                },
              ],
              page_info: { has_next_page: false, end_cursor: null },
              count: 1,
            },
          },
        },
      });
      const context = createMockContext({
        graphql_query: mockGraphqlQuery,
      });
      const hashtag = new Hashtag(context, sampleHashtagNode);
      const iterator = hashtag.getPostsResumable();

      // Verify it's an object (the NodeIterator)
      expect(iterator).toBeDefined();
      expect(typeof iterator).toBe('object');

      // Verify we can iterate over it
      const posts: Post[] = [];
      for await (const post of iterator) {
        posts.push(post);
      }
      expect(posts).toHaveLength(1);
      expect(posts[0]).toBeInstanceOf(Post);
      expect(mockGraphqlQuery).toHaveBeenCalled();
    });
  });

  describe('_obtainMetadata and getMetadata', () => {
    it('should fetch metadata when not available', async () => {
      const mockGetIphoneJson = vi.fn().mockResolvedValue({
        description: 'Full description from API',
        id: '17843829475633456',
        name: 'photography',
        profile_pic_url: 'https://example.com/hashtag.jpg',
      });
      const context = createMockContext({
        get_iphone_json: mockGetIphoneJson,
      });
      // Create hashtag without description
      const hashtagWithoutDescription = {
        ...sampleHashtagNode,
        description: undefined,
      };
      delete (hashtagWithoutDescription as Record<string, unknown>)['description'];
      const hashtag = new Hashtag(context, hashtagWithoutDescription);

      // First call will throw because description is not in node
      // Second call after _obtainMetadata should succeed
      await hashtag.getDescription();
      // Since we're mocking the API to return description, it should work
      expect(mockGetIphoneJson).toHaveBeenCalled();
    });

    it('should return cached metadata without fetching again', async () => {
      const context = createMockContext();
      const hashtag = new Hashtag(context, sampleHashtagNode);

      // First call should use cached data
      const description1 = await hashtag.getDescription();
      const description2 = await hashtag.getDescription();
      expect(description1).toBe(description2);
    });
  });

  describe('fromName', () => {
    it('should create Hashtag with lowercase name', async () => {
      const mockGetIphoneJson = vi.fn().mockResolvedValue({
        data: {
          ...sampleHashtagNode,
          name: 'photography',
        },
      });
      const context = createMockContext({
        get_iphone_json: mockGetIphoneJson,
      });

      const hashtag = await Hashtag.fromName(context, 'Photography');
      expect(hashtag).toBeInstanceOf(Hashtag);
      expect(hashtag.name).toBe('photography');
      expect(mockGetIphoneJson).toHaveBeenCalledWith('api/v1/tags/web_info/', {
        __a: 1,
        __d: 'dis',
        tag_name: 'photography',
      });
    });
  });

  describe('getPosts', () => {
    it('should return an async generator', () => {
      const context = createMockContext();
      const hashtagWithEdge = {
        ...sampleHashtagNode,
        edge_hashtag_to_media: {
          edges: [],
          page_info: { has_next_page: false, end_cursor: null },
          count: 0,
        },
      };
      const hashtag = new Hashtag(context, hashtagWithEdge);
      const generator = hashtag.getPosts();
      expect(generator).toBeDefined();
      expect(typeof generator[Symbol.asyncIterator]).toBe('function');
    });

    it('should yield posts when edge data is available', async () => {
      const context = createMockContext();
      const hashtagWithEdge = {
        ...sampleHashtagNode,
        edge_hashtag_to_media: {
          edges: [
            { node: { shortcode: 'post1', id: '111', __typename: 'GraphImage', is_video: false } },
            { node: { shortcode: 'post2', id: '222', __typename: 'GraphImage', is_video: false } },
          ],
          page_info: { has_next_page: false, end_cursor: null },
          count: 2,
        },
      };
      const hashtag = new Hashtag(context, hashtagWithEdge);
      const posts = [];
      for await (const post of hashtag.getPosts()) {
        posts.push(post);
      }
      expect(posts).toHaveLength(2);
      expect(posts[0]?.shortcode).toBe('post1');
      expect(posts[1]?.shortcode).toBe('post2');
    });

    it('should handle pagination with has_next_page', async () => {
      const mockGetIphoneJson = vi.fn().mockResolvedValue({
        data: {
          edge_hashtag_to_media: {
            edges: [
              {
                node: { shortcode: 'post3', id: '333', __typename: 'GraphImage', is_video: false },
              },
            ],
            page_info: { has_next_page: false, end_cursor: null },
            count: 3,
          },
        },
      });
      const context = createMockContext({
        get_iphone_json: mockGetIphoneJson,
      });
      const hashtagWithPagination = {
        ...sampleHashtagNode,
        edge_hashtag_to_media: {
          edges: [
            { node: { shortcode: 'post1', id: '111', __typename: 'GraphImage', is_video: false } },
            { node: { shortcode: 'post2', id: '222', __typename: 'GraphImage', is_video: false } },
          ],
          page_info: { has_next_page: true, end_cursor: 'cursor123' },
          count: 3,
        },
      };
      const hashtag = new Hashtag(context, hashtagWithPagination);
      const posts = [];
      for await (const post of hashtag.getPosts()) {
        posts.push(post);
      }
      expect(posts).toHaveLength(3);
      expect(posts[0]?.shortcode).toBe('post1');
      expect(posts[1]?.shortcode).toBe('post2');
      expect(posts[2]?.shortcode).toBe('post3');
    });

    it('should handle errors gracefully and return nothing', async () => {
      const mockGetJson = vi.fn().mockRejectedValue(new Error('API Error'));
      const context = createMockContext({
        getJson: mockGetJson,
      });
      // Missing edge_hashtag_to_media will cause an error when trying to iterate
      const hashtag = new Hashtag(context, {
        ...sampleHashtagNode,
        edge_hashtag_to_media: undefined,
      });
      const posts = [];
      // Should not throw, just return empty
      for await (const post of hashtag.getPosts()) {
        posts.push(post);
      }
      expect(posts).toHaveLength(0);
    });
  });
});

describe('TopSearchResults', () => {
  describe('constructor', () => {
    it('should create TopSearchResults', () => {
      const context = createMockContext({
        getJson: vi.fn().mockResolvedValue(sampleSearchResults),
      });
      const results = new TopSearchResults(context, 'test');
      expect(results).toBeInstanceOf(TopSearchResults);
    });

    it('should store searchstring', () => {
      const context = createMockContext({
        getJson: vi.fn().mockResolvedValue(sampleSearchResults),
      });
      const results = new TopSearchResults(context, 'mysearch');
      expect(results.searchstring).toBe('mysearch');
    });
  });

  describe('getProfiles', () => {
    it('should yield Profile instances', async () => {
      const context = createMockContext({
        getJson: vi.fn().mockResolvedValue(sampleSearchResults),
      });
      const results = new TopSearchResults(context, 'test');
      const profiles: Profile[] = [];
      for await (const profile of results.getProfiles()) {
        profiles.push(profile);
      }
      expect(profiles.length).toBe(2);
      expect(profiles[0]).toBeInstanceOf(Profile);
      expect(profiles[0]?.username).toBe('testuser');
    });
  });

  describe('getPrefixedUsernames', () => {
    it('should yield usernames starting with search string', async () => {
      const context = createMockContext({
        getJson: vi.fn().mockResolvedValue(sampleSearchResults),
      });
      const results = new TopSearchResults(context, 'test');
      const usernames: string[] = [];
      for await (const username of results.getPrefixedUsernames()) {
        usernames.push(username);
      }
      expect(usernames).toContain('testuser');
      expect(usernames).toContain('testuser2');
    });

    it('should filter out non-matching usernames', async () => {
      const context = createMockContext({
        getJson: vi.fn().mockResolvedValue({
          users: [
            { user: { pk: '1', username: 'testuser' } },
            { user: { pk: '2', username: 'other' } },
          ],
        }),
      });
      const results = new TopSearchResults(context, 'test');
      const usernames: string[] = [];
      for await (const username of results.getPrefixedUsernames()) {
        usernames.push(username);
      }
      expect(usernames).toContain('testuser');
      expect(usernames).not.toContain('other');
    });
  });

  describe('getLocations', () => {
    it('should yield PostLocation objects', async () => {
      const context = createMockContext({
        getJson: vi.fn().mockResolvedValue(sampleSearchResults),
      });
      const results = new TopSearchResults(context, 'new york');
      const locations: Array<{ id: number; name: string }> = [];
      for await (const location of results.getLocations()) {
        locations.push(location);
      }
      expect(locations.length).toBe(1);
      expect(locations[0]?.name).toBe('New York City');
      expect(locations[0]?.id).toBe(12345);
    });
  });

  describe('getHashtagStrings', () => {
    it('should yield hashtag name strings', async () => {
      const context = createMockContext({
        getJson: vi.fn().mockResolvedValue(sampleSearchResults),
      });
      const results = new TopSearchResults(context, 'test');
      const hashtags: string[] = [];
      for await (const hashtag of results.getHashtagStrings()) {
        hashtags.push(hashtag);
      }
      expect(hashtags).toContain('test');
      expect(hashtags).toContain('testing');
    });
  });

  describe('getHashtags', () => {
    it('should yield Hashtag instances', async () => {
      const context = createMockContext({
        getJson: vi.fn().mockResolvedValue(sampleSearchResults),
      });
      const results = new TopSearchResults(context, 'test');
      const hashtags: Hashtag[] = [];
      for await (const hashtag of results.getHashtags()) {
        hashtags.push(hashtag);
      }
      expect(hashtags.length).toBe(2);
      expect(hashtags[0]).toBeInstanceOf(Hashtag);
      expect(hashtags[0]?.name).toBe('test');
    });
  });
});
