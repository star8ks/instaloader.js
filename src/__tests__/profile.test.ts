/**
 * Tests for Profile class in structures.ts
 */

import { describe, it, expect, vi } from 'vitest';
import { Profile } from '../structures';
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

// Sample profile node data
const sampleProfileNode: JsonObject = {
  id: '123456789',
  username: 'TestUser',
  full_name: 'Test User',
  biography: 'Hello! I love #photography and @instagram',
  profile_pic_url_hd: 'https://example.com/profile_hd.jpg',
  is_private: false,
  is_verified: true,
  is_business_account: false,
  edge_followed_by: { count: 1000 },
  edge_follow: { count: 500 },
  edge_owner_to_timeline_media: { count: 50 },
  followed_by_viewer: false,
  follows_viewer: false,
  blocked_by_viewer: false,
  has_blocked_viewer: false,
  external_url: 'https://example.com',
};

const samplePrivateProfileNode: JsonObject = {
  id: '987654321',
  username: 'PrivateUser',
  full_name: 'Private User',
  biography: 'This is private',
  profile_pic_url_hd: 'https://example.com/private.jpg',
  is_private: true,
  is_verified: false,
  is_business_account: false,
  edge_followed_by: { count: 100 },
  edge_follow: { count: 50 },
  edge_owner_to_timeline_media: { count: 10 },
  followed_by_viewer: false,
  follows_viewer: false,
  blocked_by_viewer: false,
  has_blocked_viewer: false,
};

describe('Profile', () => {
  describe('constructor', () => {
    it('should create a Profile from a valid node', () => {
      const context = createMockContext();
      const profile = new Profile(context, sampleProfileNode);
      expect(profile).toBeInstanceOf(Profile);
    });

    it('should throw if node has no username', () => {
      const context = createMockContext();
      expect(() => new Profile(context, { id: '123' })).toThrow("Node must contain 'username'");
    });
  });

  describe('basic properties', () => {
    it('should return correct userid', () => {
      const context = createMockContext();
      const profile = new Profile(context, sampleProfileNode);
      expect(profile.userid).toBe(123456789);
    });

    it('should return lowercase username', () => {
      const context = createMockContext();
      const profile = new Profile(context, sampleProfileNode);
      expect(profile.username).toBe('testuser');
    });

    it('should return correct is_private', () => {
      const context = createMockContext();
      const publicProfile = new Profile(context, sampleProfileNode);
      const privateProfile = new Profile(context, samplePrivateProfileNode);
      expect(publicProfile.is_private).toBe(false);
      expect(privateProfile.is_private).toBe(true);
    });

    it('should return correct followed_by_viewer', () => {
      const context = createMockContext();
      const profile = new Profile(context, sampleProfileNode);
      expect(profile.followed_by_viewer).toBe(false);
    });

    it('should return correct follows_viewer', () => {
      const context = createMockContext();
      const profile = new Profile(context, sampleProfileNode);
      expect(profile.follows_viewer).toBe(false);
    });

    it('should return correct blocked_by_viewer', () => {
      const context = createMockContext();
      const profile = new Profile(context, sampleProfileNode);
      expect(profile.blocked_by_viewer).toBe(false);
    });

    it('should return correct has_blocked_viewer', () => {
      const context = createMockContext();
      const profile = new Profile(context, sampleProfileNode);
      expect(profile.has_blocked_viewer).toBe(false);
    });
  });

  describe('async metadata methods', () => {
    it('should return correct followers count', async () => {
      const context = createMockContext();
      const profile = new Profile(context, sampleProfileNode);
      const followers = await profile.getFollowers();
      expect(followers).toBe(1000);
    });

    it('should return correct followees count', async () => {
      const context = createMockContext();
      const profile = new Profile(context, sampleProfileNode);
      const followees = await profile.getFollowees();
      expect(followees).toBe(500);
    });

    it('should return correct mediacount', async () => {
      const context = createMockContext();
      const profile = new Profile(context, sampleProfileNode);
      const mediacount = await profile.getMediacount();
      expect(mediacount).toBe(50);
    });

    it('should return correct full name', async () => {
      const context = createMockContext();
      const profile = new Profile(context, sampleProfileNode);
      const fullName = await profile.getFullName();
      expect(fullName).toBe('Test User');
    });

    it('should return correct biography', async () => {
      const context = createMockContext();
      const profile = new Profile(context, sampleProfileNode);
      const bio = await profile.getBiography();
      expect(bio).toBe('Hello! I love #photography and @instagram');
    });

    it('should return correct external_url', async () => {
      const context = createMockContext();
      const profile = new Profile(context, sampleProfileNode);
      const url = await profile.getExternalUrl();
      expect(url).toBe('https://example.com');
    });

    it('should return null external_url when not present', async () => {
      const context = createMockContext();
      const profile = new Profile(context, samplePrivateProfileNode);
      const url = await profile.getExternalUrl();
      expect(url).toBeNull();
    });

    it('should return correct is_verified', async () => {
      const context = createMockContext();
      const verifiedProfile = new Profile(context, sampleProfileNode);
      const unverifiedProfile = new Profile(context, samplePrivateProfileNode);
      expect(await verifiedProfile.getIsVerified()).toBe(true);
      expect(await unverifiedProfile.getIsVerified()).toBe(false);
    });

    it('should return correct is_business_account', async () => {
      const context = createMockContext();
      const profile = new Profile(context, sampleProfileNode);
      const isBusiness = await profile.getIsBusinessAccount();
      expect(isBusiness).toBe(false);
    });

    it('should return profile pic URL', async () => {
      const context = createMockContext();
      const profile = new Profile(context, sampleProfileNode);
      const url = await profile.getProfilePicUrl();
      expect(url).toBe('https://example.com/profile_hd.jpg');
    });
  });

  describe('equality and representation', () => {
    it('should be equal to another Profile with same userid', () => {
      const context = createMockContext();
      const profile1 = new Profile(context, sampleProfileNode);
      const profile2 = new Profile(context, { ...sampleProfileNode });
      expect(profile1.equals(profile2)).toBe(true);
    });

    it('should not be equal to Profile with different userid', () => {
      const context = createMockContext();
      const profile1 = new Profile(context, sampleProfileNode);
      const profile2 = new Profile(context, { ...sampleProfileNode, id: '999999999' });
      expect(profile1.equals(profile2)).toBe(false);
    });

    it('should have correct string representation', () => {
      const context = createMockContext();
      const profile = new Profile(context, sampleProfileNode);
      expect(profile.toString()).toBe('<Profile testuser (123456789)>');
    });
  });

  describe('JSON serialization', () => {
    it('should convert to JSON object', () => {
      const context = createMockContext();
      const profile = new Profile(context, sampleProfileNode);
      const json = profile.toJSON();
      expect(json['username']).toBe('TestUser');
      expect(json['id']).toBe('123456789');
    });

    it('should exclude edge collections from JSON', () => {
      const context = createMockContext();
      const nodeWithEdges = {
        ...sampleProfileNode,
        edge_media_collections: { edges: [] },
        edge_owner_to_timeline_media: { edges: [], count: 50 },
        edge_saved_media: { edges: [] },
      };
      const profile = new Profile(context, nodeWithEdges);
      const json = profile.toJSON();
      expect(json['edge_media_collections']).toBeUndefined();
      expect(json['edge_saved_media']).toBeUndefined();
    });
  });

  describe('fromIphoneStruct', () => {
    it('should create Profile from iPhone struct', () => {
      const context = createMockContext();
      const iphoneUser: JsonObject = {
        pk: '12345',
        username: 'iphone_user',
        is_private: false,
        full_name: 'iPhone User',
        profile_pic_url: 'https://example.com/iphone_pic.jpg',
      };

      const profile = Profile.fromIphoneStruct(context, iphoneUser);
      expect(profile.username).toBe('iphone_user');
      expect(profile.userid).toBe(12345);
      expect(profile.is_private).toBe(false);
    });
  });

  describe('getPosts', () => {
    it('should return a NodeIterator when firstData is available', () => {
      const context = createMockContext({ is_logged_in: false });
      const profileWithEdge = {
        ...sampleProfileNode,
        edge_owner_to_timeline_media: {
          edges: [],
          page_info: { has_next_page: false, end_cursor: null },
          count: 0,
        },
      };
      const profile = new Profile(context, profileWithEdge);
      const iterator = profile.getPosts();
      expect(iterator).toBeDefined();
      expect(typeof iterator[Symbol.asyncIterator]).toBe('function');
    });

    it('should use first data from edge_owner_to_timeline_media when not logged in', () => {
      const context = createMockContext({ is_logged_in: false });
      const profileWithEdge = {
        ...sampleProfileNode,
        edge_owner_to_timeline_media: {
          edges: [
            { node: { shortcode: 'abc123', id: '123', __typename: 'GraphImage', is_video: false } },
          ],
          page_info: { has_next_page: false, end_cursor: null },
          count: 1,
        },
      };
      const profile = new Profile(context, profileWithEdge);
      const iterator = profile.getPosts();
      expect(iterator).toBeDefined();
    });
  });

  describe('getSavedPosts', () => {
    it('should throw LoginRequiredException if not logged in as target user', () => {
      const context = createMockContext({ username: 'otheruser' });
      const profile = new Profile(context, sampleProfileNode);
      expect(() => profile.getSavedPosts()).toThrow('Login as testuser required');
    });
  });

  describe('getMediacount', () => {
    it('should return correct mediacount', async () => {
      const context = createMockContext();
      const profile = new Profile(context, {
        ...sampleProfileNode,
        edge_owner_to_timeline_media: { count: 42 },
      });
      const count = await profile.getMediacount();
      expect(count).toBe(42);
    });
  });

  describe('getFollowers and getFollowees', () => {
    it('should return correct followers count', async () => {
      const context = createMockContext();
      const profile = new Profile(context, sampleProfileNode);
      const count = await profile.getFollowers();
      expect(count).toBe(1000);
    });

    it('should return correct followees count', async () => {
      const context = createMockContext();
      const profile = new Profile(context, sampleProfileNode);
      const count = await profile.getFollowees();
      expect(count).toBe(500);
    });
  });

  describe('followed_by_viewer and follows_viewer getters', () => {
    it('should return correct followed_by_viewer status', () => {
      const context = createMockContext();
      const profile = new Profile(context, sampleProfileNode);
      expect(profile.followed_by_viewer).toBe(false);
    });

    it('should return correct follows_viewer status', () => {
      const context = createMockContext();
      const profile = new Profile(context, sampleProfileNode);
      expect(profile.follows_viewer).toBe(false);
    });

    it('should handle true values for followed_by_viewer', () => {
      const context = createMockContext();
      const profile = new Profile(context, { ...sampleProfileNode, followed_by_viewer: true });
      expect(profile.followed_by_viewer).toBe(true);
    });

    it('should handle true values for follows_viewer', () => {
      const context = createMockContext();
      const profile = new Profile(context, { ...sampleProfileNode, follows_viewer: true });
      expect(profile.follows_viewer).toBe(true);
    });
  });

  describe('Profile toJSON edge cases', () => {
    it('should exclude edge collections from JSON', () => {
      const context = createMockContext();
      const nodeWithEdges = {
        ...sampleProfileNode,
        edge_felix_video_timeline: { edges: [] },
        edge_owner_to_timeline_media: { edges: [], count: 50 },
      };
      const profile = new Profile(context, nodeWithEdges);
      const json = profile.toJSON();
      expect(json['edge_felix_video_timeline']).toBeUndefined();
    });
  });
});

describe('Profile static methods', () => {
  describe('fromId', () => {
    it('should create Profile from user ID', async () => {
      const mockGraphqlQuery = vi.fn().mockResolvedValue({
        data: {
          user: {
            reel: {
              owner: {
                id: '123456789',
                username: 'testuser',
                is_private: false,
                full_name: 'Test User',
              },
            },
          },
        },
      });
      const context = createMockContext({
        graphql_query: mockGraphqlQuery,
      });
      const profile = await Profile.fromId(context, 123456789);
      expect(profile).toBeInstanceOf(Profile);
      expect(profile.username).toBe('testuser');
    });

    it('should return cached profile if available', async () => {
      const context = createMockContext();
      const cachedProfile = new Profile(context, sampleProfileNode);
      context.profile_id_cache.set(123456789, cachedProfile);

      const profile = await Profile.fromId(context, 123456789);
      expect(profile).toBe(cachedProfile);
    });

    it('should throw ProfileNotExistsException when user not found', async () => {
      const mockGraphqlQuery = vi.fn().mockResolvedValue({
        data: {
          user: null,
        },
      });
      const context = createMockContext({
        graphql_query: mockGraphqlQuery,
      });

      const { ProfileNotExistsException } = await import('../exceptions');
      await expect(Profile.fromId(context, 999999999)).rejects.toThrow(ProfileNotExistsException);
    });
  });

  describe('ownProfile', () => {
    it('should throw LoginRequiredException when not logged in', async () => {
      const context = createMockContext({ is_logged_in: false });
      const { LoginRequiredException } = await import('../exceptions');
      await expect(Profile.ownProfile(context)).rejects.toThrow(LoginRequiredException);
    });

    it('should return own profile when logged in', async () => {
      const mockGraphqlQuery = vi.fn().mockResolvedValue({
        data: {
          user: {
            id: '123456789',
            username: 'myuser',
            is_private: false,
            full_name: 'My User',
          },
        },
      });
      const context = createMockContext({
        is_logged_in: true,
        graphql_query: mockGraphqlQuery,
      });

      const profile = await Profile.ownProfile(context);
      expect(profile).toBeInstanceOf(Profile);
      expect(profile.username).toBe('myuser');
    });
  });

  describe('fromUsername', () => {
    it('should create Profile from username', async () => {
      const mockGetIphoneJson = vi.fn().mockResolvedValue({
        data: {
          user: {
            id: '123456789',
            username: 'testuser',
            is_private: false,
            full_name: 'Test User',
          },
        },
      });
      const context = createMockContext({
        get_iphone_json: mockGetIphoneJson,
      });

      const profile = await Profile.fromUsername(context, 'testuser');
      expect(profile).toBeInstanceOf(Profile);
      expect(profile.username).toBe('testuser');
    });
  });
});
