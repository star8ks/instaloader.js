/**
 * Tests for helper functions in structures.ts
 */

import { describe, it, expect, vi } from 'vitest';
import {
  shortcodeToMediaid,
  mediaidToShortcode,
  extractHashtags,
  extractMentions,
  getJsonStructure,
  loadStructure,
  Post,
  Profile,
  StoryItem,
  Hashtag,
} from '../structures';
import { InvalidArgumentException } from '../exceptions';
import type { InstaloaderContext } from '../instaloadercontext';
import type { JsonObject } from '../types';

// Mock context for tests
function createMockContext(): InstaloaderContext {
  return {
    username: 'testuser',
    is_logged_in: false,
    iphoneSupport: false,
    quiet: true,
    sleep: false,
    graphql_query: vi.fn(),
    doc_id_graphql_query: vi.fn(),
    get_iphone_json: vi.fn(),
    getJson: vi.fn(),
    httpRequest: vi.fn(),
    log: vi.fn(),
    error: vi.fn(),
    profile_id_cache: new Map(),
  } as unknown as InstaloaderContext;
}

describe('shortcodeToMediaid', () => {
  it('should convert a valid shortcode to mediaid', () => {
    // Known conversion: shortcode "CpQz1234567" -> specific mediaid
    // Using a simple test case
    const shortcode = 'B';
    const mediaid = shortcodeToMediaid(shortcode);
    expect(mediaid).toBe(BigInt(1));
  });

  it('should convert shortcode "BA" correctly', () => {
    const shortcode = 'BA';
    const mediaid = shortcodeToMediaid(shortcode);
    expect(mediaid).toBe(BigInt(64)); // B=1, A=0 -> 1*64 + 0 = 64
  });

  it('should convert shortcode "BB" correctly', () => {
    const shortcode = 'BB';
    const mediaid = shortcodeToMediaid(shortcode);
    expect(mediaid).toBe(BigInt(65)); // B=1, B=1 -> 1*64 + 1 = 65
  });

  it('should handle longer shortcodes', () => {
    const shortcode = 'CpFxHKMNu7g';
    const mediaid = shortcodeToMediaid(shortcode);
    expect(typeof mediaid).toBe('bigint');
    expect(mediaid > BigInt(0)).toBe(true);
  });

  it('should throw for shortcodes longer than 11 characters', () => {
    const longCode = 'AAAAAAAAAAAA'; // 12 characters
    expect(() => shortcodeToMediaid(longCode)).toThrow(InvalidArgumentException);
  });
});

describe('mediaidToShortcode', () => {
  it('should convert mediaid 1 to shortcode "B"', () => {
    const shortcode = mediaidToShortcode(BigInt(1));
    expect(shortcode).toBe('B');
  });

  it('should convert mediaid 64 to shortcode "BA"', () => {
    const shortcode = mediaidToShortcode(BigInt(64));
    expect(shortcode).toBe('BA');
  });

  it('should convert mediaid 65 to shortcode "BB"', () => {
    const shortcode = mediaidToShortcode(BigInt(65));
    expect(shortcode).toBe('BB');
  });

  it('should return "A" for mediaid 0', () => {
    const shortcode = mediaidToShortcode(BigInt(0));
    expect(shortcode).toBe('A');
  });

  it('should be reversible with shortcodeToMediaid', () => {
    const originalShortcode = 'CpFxHKMNu7g';
    const mediaid = shortcodeToMediaid(originalShortcode);
    const resultShortcode = mediaidToShortcode(mediaid);
    expect(resultShortcode).toBe(originalShortcode);
  });
});

describe('extractHashtags', () => {
  it('should extract hashtags from text', () => {
    const text = 'Check out #sunset and #photography!';
    const hashtags = extractHashtags(text);
    expect(hashtags).toEqual(['sunset', 'photography']);
  });

  it('should return lowercase hashtags', () => {
    const text = '#UPPERCASE #MixedCase';
    const hashtags = extractHashtags(text);
    expect(hashtags).toEqual(['uppercase', 'mixedcase']);
  });

  it('should handle hashtags at the beginning', () => {
    const text = '#firsttag is great';
    const hashtags = extractHashtags(text);
    expect(hashtags).toEqual(['firsttag']);
  });

  it('should return empty array for text without hashtags', () => {
    const text = 'No hashtags here';
    const hashtags = extractHashtags(text);
    expect(hashtags).toEqual([]);
  });

  it('should handle multiple hashtags in a row', () => {
    const text = '#one#two#three';
    const hashtags = extractHashtags(text);
    expect(hashtags).toContain('one');
    // Note: depending on regex, #two and #three may or may not be matched
  });

  it('should handle hashtags with numbers', () => {
    const text = '#photo2023 #2cool';
    const hashtags = extractHashtags(text);
    expect(hashtags).toContain('photo2023');
    expect(hashtags).toContain('2cool');
  });

  it('should handle hashtags with underscores', () => {
    const text = '#hello_world';
    const hashtags = extractHashtags(text);
    expect(hashtags).toEqual(['hello_world']);
  });
});

describe('extractMentions', () => {
  it('should extract mentions from text', () => {
    const text = 'Thanks @john and @jane!';
    const mentions = extractMentions(text);
    expect(mentions).toContain('john');
    expect(mentions).toContain('jane');
  });

  it('should return lowercase mentions', () => {
    const text = '@JohnDoe @UPPERCASE';
    const mentions = extractMentions(text);
    expect(mentions).toContain('johndoe');
    expect(mentions).toContain('uppercase');
  });

  it('should handle mentions at the beginning', () => {
    const text = '@firstuser is cool';
    const mentions = extractMentions(text);
    expect(mentions).toContain('firstuser');
  });

  it('should return empty array for text without mentions', () => {
    const text = 'No mentions here';
    const mentions = extractMentions(text);
    expect(mentions).toEqual([]);
  });

  it('should handle mentions with dots', () => {
    const text = '@user.name is here';
    const mentions = extractMentions(text);
    expect(mentions).toContain('user.name');
  });

  it('should handle mentions with underscores', () => {
    const text = '@user_name';
    const mentions = extractMentions(text);
    expect(mentions).toContain('user_name');
  });

  it('should not extract email addresses as mentions', () => {
    const text = 'Email me at test@example.com';
    const mentions = extractMentions(text);
    // Should not include 'example.com' as it's part of an email
    expect(mentions).not.toContain('example.com');
  });
});

// Sample data for structure tests
const samplePostNode: JsonObject = {
  id: '12345',
  shortcode: 'ABC123',
  __typename: 'GraphImage',
  display_url: 'https://example.com/image.jpg',
  is_video: false,
  taken_at_timestamp: 1609459200,
  edge_media_to_caption: {
    edges: [{ node: { text: 'Test caption' } }],
  },
  edge_media_to_comment: { count: 5 },
  edge_liked_by: { count: 100 },
  owner: { id: '67890', username: 'testowner' },
};

const sampleProfileNode: JsonObject = {
  id: '67890',
  username: 'testprofile',
  is_private: false,
  full_name: 'Test Profile',
  biography: 'Test bio',
  profile_pic_url_hd: 'https://example.com/profile.jpg',
  edge_owner_to_timeline_media: { count: 50 },
  edge_followed_by: { count: 1000 },
  edge_follow: { count: 500 },
};

const sampleStoryItemNode: JsonObject = {
  id: '11111',
  __typename: 'GraphStoryImage',
  display_url: 'https://example.com/story.jpg',
  taken_at_timestamp: 1609459200,
  expiring_at_timestamp: 1609545600,
  is_video: false,
  owner: { id: '67890', username: 'testowner' },
};

const sampleHashtagNode: JsonObject = {
  name: 'photography',
  id: '17841563169109065',
  media_count: 10000,
  profile_pic_url: 'https://example.com/hashtag.jpg',
};

describe('getJsonStructure', () => {
  it('should wrap Post in correct JSON format', () => {
    const context = createMockContext();
    const post = new Post(context, samplePostNode);
    const json = getJsonStructure(post);

    expect(json).toHaveProperty('node');
    expect(json).toHaveProperty('instaloader');
    expect((json['instaloader'] as JsonObject)['node_type']).toBe('Post');
    expect((json['instaloader'] as JsonObject)['version']).toBe('4.15.0');
  });

  it('should wrap Profile in correct JSON format', () => {
    const context = createMockContext();
    const profile = new Profile(context, sampleProfileNode);
    const json = getJsonStructure(profile);

    expect(json).toHaveProperty('node');
    expect(json).toHaveProperty('instaloader');
    expect((json['instaloader'] as JsonObject)['node_type']).toBe('Profile');
  });

  it('should wrap StoryItem in correct JSON format', () => {
    const context = createMockContext();
    const storyItem = new StoryItem(context, sampleStoryItemNode);
    const json = getJsonStructure(storyItem);

    expect(json).toHaveProperty('node');
    expect(json).toHaveProperty('instaloader');
    expect((json['instaloader'] as JsonObject)['node_type']).toBe('StoryItem');
  });

  it('should wrap Hashtag in correct JSON format', () => {
    const context = createMockContext();
    const hashtag = new Hashtag(context, sampleHashtagNode);
    const json = getJsonStructure(hashtag);

    expect(json).toHaveProperty('node');
    expect(json).toHaveProperty('instaloader');
    expect((json['instaloader'] as JsonObject)['node_type']).toBe('Hashtag');
  });
});

describe('loadStructure', () => {
  it('should load Post from JSON structure', () => {
    const context = createMockContext();
    const jsonStructure: JsonObject = {
      node: samplePostNode,
      instaloader: {
        version: '4.15.0',
        node_type: 'Post',
      },
    };

    const result = loadStructure(context, jsonStructure);
    expect(result).toBeInstanceOf(Post);
    expect((result as Post).shortcode).toBe('ABC123');
  });

  it('should load Profile from JSON structure', () => {
    const context = createMockContext();
    const jsonStructure: JsonObject = {
      node: sampleProfileNode,
      instaloader: {
        version: '4.15.0',
        node_type: 'Profile',
      },
    };

    const result = loadStructure(context, jsonStructure);
    expect(result).toBeInstanceOf(Profile);
    expect((result as Profile).username).toBe('testprofile');
  });

  it('should load StoryItem from JSON structure', () => {
    const context = createMockContext();
    const jsonStructure: JsonObject = {
      node: sampleStoryItemNode,
      instaloader: {
        version: '4.15.0',
        node_type: 'StoryItem',
      },
    };

    const result = loadStructure(context, jsonStructure);
    expect(result).toBeInstanceOf(StoryItem);
  });

  it('should load Hashtag from JSON structure', () => {
    const context = createMockContext();
    const jsonStructure: JsonObject = {
      node: sampleHashtagNode,
      instaloader: {
        version: '4.15.0',
        node_type: 'Hashtag',
      },
    };

    const result = loadStructure(context, jsonStructure);
    expect(result).toBeInstanceOf(Hashtag);
    expect((result as Hashtag).name).toBe('photography');
  });

  it('should load legacy format with shortcode', () => {
    const context = createMockContext();
    const legacyStructure: JsonObject = {
      ...samplePostNode,
    };

    const result = loadStructure(context, legacyStructure);
    expect(result).toBeInstanceOf(Post);
  });

  it('should throw for invalid JSON structure', () => {
    const context = createMockContext();
    const invalidStructure: JsonObject = {
      something: 'invalid',
    };

    expect(() => loadStructure(context, invalidStructure)).toThrow(InvalidArgumentException);
  });

  it('should roundtrip Post through getJsonStructure and loadStructure', () => {
    const context = createMockContext();
    const post = new Post(context, samplePostNode);
    const json = getJsonStructure(post);
    const loaded = loadStructure(context, json);

    expect(loaded).toBeInstanceOf(Post);
    expect((loaded as Post).shortcode).toBe(post.shortcode);
  });
});
