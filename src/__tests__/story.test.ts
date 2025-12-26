/**
 * Tests for StoryItem, Story, and Highlight classes in structures.ts
 */

import { describe, it, expect, vi } from 'vitest';
import { StoryItem, Story, Highlight, Profile } from '../structures';
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

// Sample story item node data
const sampleStoryItemNode: JsonObject = {
  id: '3123456789012345678',
  __typename: 'GraphStoryImage',
  display_resources: [
    { src: 'https://example.com/story_low.jpg' },
    { src: 'https://example.com/story_high.jpg' },
  ],
  is_video: false,
  taken_at_timestamp: 1677000000,
  expiring_at_timestamp: 1677086400,
  owner: { id: '123456789', username: 'storyowner' },
  edge_media_to_caption: {
    edges: [{ node: { text: 'Story caption #awesome @friend' } }],
  },
};

const sampleVideoStoryItemNode: JsonObject = {
  id: '3223456789012345678',
  __typename: 'GraphStoryVideo',
  display_resources: [
    { src: 'https://example.com/story_thumb.jpg' },
  ],
  video_resources: [
    { src: 'https://example.com/story_video.mp4' },
  ],
  is_video: true,
  taken_at_timestamp: 1677000000,
  expiring_at_timestamp: 1677086400,
  owner: { id: '123456789', username: 'storyowner' },
};

// Sample story node data
const sampleStoryNode: JsonObject = {
  id: 'story123',
  user: {
    id: '123456789',
    username: 'storyuser',
    full_name: 'Story User',
    profile_pic_url_hd: 'https://example.com/profile.jpg',
    is_private: false,
  },
  items: [
    { id: '1001', __typename: 'GraphStoryImage', is_video: false, taken_at_timestamp: 1677000000, expiring_at_timestamp: 1677086400, display_resources: [{ src: 'https://example.com/1.jpg' }] },
    { id: '1002', __typename: 'GraphStoryVideo', is_video: true, taken_at_timestamp: 1677001000, expiring_at_timestamp: 1677087400, display_resources: [{ src: 'https://example.com/2.jpg' }], video_resources: [{ src: 'https://example.com/2.mp4' }] },
  ],
  latest_reel_media: 1677001000,
  seen: null,
};

// Sample highlight node data
const sampleHighlightNode: JsonObject = {
  id: 'highlight:123',
  title: 'Best Moments',
  cover_media: { thumbnail_src: 'https://example.com/cover.jpg' },
  cover_media_cropped_thumbnail: { url: 'https://example.com/cover_cropped.jpg' },
  owner: {
    id: '123456789',
    username: 'highlightowner',
    full_name: 'Highlight Owner',
    profile_pic_url_hd: 'https://example.com/owner.jpg',
    is_private: false,
  },
  items: [
    { id: '2001', __typename: 'GraphStoryImage', is_video: false, taken_at_timestamp: 1677000000, expiring_at_timestamp: 1677086400, display_resources: [{ src: 'https://example.com/h1.jpg' }] },
  ],
  latest_reel_media: 1677000000,
  seen: null,
};

describe('StoryItem', () => {
  describe('constructor', () => {
    it('should create a StoryItem from a valid node', () => {
      const context = createMockContext();
      const storyItem = new StoryItem(context, sampleStoryItemNode);
      expect(storyItem).toBeInstanceOf(StoryItem);
    });
  });

  describe('basic properties', () => {
    it('should return correct mediaid as BigInt', () => {
      const context = createMockContext();
      const storyItem = new StoryItem(context, sampleStoryItemNode);
      expect(storyItem.mediaid).toBe(BigInt('3123456789012345678'));
    });

    it('should return correct shortcode', () => {
      const context = createMockContext();
      const storyItem = new StoryItem(context, sampleStoryItemNode);
      expect(typeof storyItem.shortcode).toBe('string');
      expect(storyItem.shortcode.length).toBeGreaterThan(0);
    });

    it('should return correct typename', () => {
      const context = createMockContext();
      const storyItem = new StoryItem(context, sampleStoryItemNode);
      expect(storyItem.typename).toBe('GraphStoryImage');
    });

    it('should return correct url from display_resources', () => {
      const context = createMockContext();
      const storyItem = new StoryItem(context, sampleStoryItemNode);
      expect(storyItem.url).toBe('https://example.com/story_high.jpg');
    });

    it('should return correct is_video', () => {
      const context = createMockContext();
      const imageStory = new StoryItem(context, sampleStoryItemNode);
      const videoStory = new StoryItem(context, sampleVideoStoryItemNode);
      expect(imageStory.is_video).toBe(false);
      expect(videoStory.is_video).toBe(true);
    });

    it('should return correct video_url for video stories', () => {
      const context = createMockContext();
      const videoStory = new StoryItem(context, sampleVideoStoryItemNode);
      expect(videoStory.video_url).toBe('https://example.com/story_video.mp4');
    });

    it('should return null video_url for image stories', () => {
      const context = createMockContext();
      const imageStory = new StoryItem(context, sampleStoryItemNode);
      expect(imageStory.video_url).toBeNull();
    });

    it('should return correct dates', () => {
      const context = createMockContext();
      const storyItem = new StoryItem(context, sampleStoryItemNode);
      expect(storyItem.date_utc.getTime()).toBe(1677000000 * 1000);
      expect(storyItem.expiring_utc.getTime()).toBe(1677086400 * 1000);
    });

    it('should return correct caption', () => {
      const context = createMockContext();
      const storyItem = new StoryItem(context, sampleStoryItemNode);
      expect(storyItem.caption).toBe('Story caption #awesome @friend');
    });

    it('should extract caption hashtags', () => {
      const context = createMockContext();
      const storyItem = new StoryItem(context, sampleStoryItemNode);
      expect(storyItem.caption_hashtags).toContain('awesome');
    });

    it('should extract caption mentions', () => {
      const context = createMockContext();
      const storyItem = new StoryItem(context, sampleStoryItemNode);
      expect(storyItem.caption_mentions).toContain('friend');
    });
  });

  describe('equality and representation', () => {
    it('should be equal to another StoryItem with same mediaid', () => {
      const context = createMockContext();
      const item1 = new StoryItem(context, sampleStoryItemNode);
      const item2 = new StoryItem(context, { ...sampleStoryItemNode });
      expect(item1.equals(item2)).toBe(true);
    });

    it('should have correct string representation', () => {
      const context = createMockContext();
      const storyItem = new StoryItem(context, sampleStoryItemNode);
      expect(storyItem.toString()).toMatch(/<StoryItem \d+>/);
    });
  });

  describe('JSON serialization', () => {
    it('should convert to JSON object', () => {
      const context = createMockContext();
      const storyItem = new StoryItem(context, sampleStoryItemNode);
      const json = storyItem.toJSON();
      expect(json['id']).toBe('3123456789012345678');
      expect(json['__typename']).toBe('GraphStoryImage');
    });
  });
});

describe('Story', () => {
  describe('constructor', () => {
    it('should create a Story from a valid node', () => {
      const context = createMockContext();
      const story = new Story(context, sampleStoryNode);
      expect(story).toBeInstanceOf(Story);
    });
  });

  describe('basic properties', () => {
    it('should return unique_id', () => {
      const context = createMockContext();
      const story = new Story(context, sampleStoryNode);
      expect(typeof story.unique_id).toBe('string');
    });

    it('should return correct itemcount', () => {
      const context = createMockContext();
      const story = new Story(context, sampleStoryNode);
      expect(story.itemcount).toBe(2);
    });

    it('should return correct latest_media_utc', () => {
      const context = createMockContext();
      const story = new Story(context, sampleStoryNode);
      expect(story.latest_media_utc.getTime()).toBe(1677001000 * 1000);
    });

    it('should return null last_seen_utc when not seen', () => {
      const context = createMockContext();
      const story = new Story(context, sampleStoryNode);
      expect(story.last_seen_utc).toBeNull();
    });

    it('should return last_seen_utc when seen', () => {
      const context = createMockContext();
      const seenStory = new Story(context, { ...sampleStoryNode, seen: 1677000500 });
      expect(seenStory.last_seen_utc?.getTime()).toBe(1677000500 * 1000);
    });
  });

  describe('owner properties', () => {
    it('should return correct owner_profile', () => {
      const context = createMockContext();
      const story = new Story(context, sampleStoryNode);
      expect(story.owner_profile).toBeInstanceOf(Profile);
    });

    it('should return correct owner_username', () => {
      const context = createMockContext();
      const story = new Story(context, sampleStoryNode);
      expect(story.owner_username).toBe('storyuser');
    });

    it('should return correct owner_id', () => {
      const context = createMockContext();
      const story = new Story(context, sampleStoryNode);
      expect(story.owner_id).toBe(123456789);
    });
  });

  describe('equality and representation', () => {
    it('should be equal to another Story with same unique_id', () => {
      const context = createMockContext();
      const story1 = new Story(context, sampleStoryNode);
      const story2 = new Story(context, { ...sampleStoryNode });
      expect(story1.equals(story2)).toBe(true);
    });

    it('should have correct string representation', () => {
      const context = createMockContext();
      const story = new Story(context, sampleStoryNode);
      expect(story.toString()).toMatch(/<Story by storyuser changed .+>/);
    });
  });

  describe('getItems', () => {
    it('should yield StoryItems', async () => {
      const context = createMockContext();
      const story = new Story(context, sampleStoryNode);
      const items: StoryItem[] = [];
      for await (const item of story.getItems()) {
        items.push(item);
      }
      expect(items.length).toBe(2);
      expect(items[0]).toBeInstanceOf(StoryItem);
    });
  });
});

describe('Highlight', () => {
  describe('constructor', () => {
    it('should create a Highlight from a valid node', () => {
      const context = createMockContext();
      const highlight = new Highlight(context, sampleHighlightNode);
      expect(highlight).toBeInstanceOf(Highlight);
    });

    it('should extend Story', () => {
      const context = createMockContext();
      const highlight = new Highlight(context, sampleHighlightNode);
      expect(highlight).toBeInstanceOf(Story);
    });
  });

  describe('properties', () => {
    it('should return correct unique_id', () => {
      const context = createMockContext();
      const highlight = new Highlight(context, sampleHighlightNode);
      expect(highlight.unique_id).toBe('highlight:123');
    });

    it('should return correct title', () => {
      const context = createMockContext();
      const highlight = new Highlight(context, sampleHighlightNode);
      expect(highlight.title).toBe('Best Moments');
    });

    it('should return correct cover_url', () => {
      const context = createMockContext();
      const highlight = new Highlight(context, sampleHighlightNode);
      expect(highlight.cover_url).toBe('https://example.com/cover.jpg');
    });

    it('should return correct cover_cropped_url', () => {
      const context = createMockContext();
      const highlight = new Highlight(context, sampleHighlightNode);
      expect(highlight.cover_cropped_url).toBe('https://example.com/cover_cropped.jpg');
    });

    it('should return correct owner_profile', () => {
      const context = createMockContext();
      const highlight = new Highlight(context, sampleHighlightNode);
      expect(highlight.owner_profile).toBeInstanceOf(Profile);
      expect(highlight.owner_username).toBe('highlightowner');
    });
  });

  describe('equality and representation', () => {
    it('should have correct string representation', () => {
      const context = createMockContext();
      const highlight = new Highlight(context, sampleHighlightNode);
      expect(highlight.toString()).toBe('<Highlight by highlightowner: Best Moments>');
    });
  });
});
