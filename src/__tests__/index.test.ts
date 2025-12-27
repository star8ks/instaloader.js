/**
 * Tests for index.ts exports
 */

import { describe, it, expect } from 'vitest';

// Import everything from index to test that exports work
import * as instaloader from '../index';

describe('index exports', () => {
  describe('exceptions', () => {
    it('should export all exception classes', () => {
      expect(instaloader.InstaloaderException).toBeDefined();
      expect(instaloader.QueryReturnedBadRequestException).toBeDefined();
      expect(instaloader.QueryReturnedForbiddenException).toBeDefined();
      expect(instaloader.ProfileNotExistsException).toBeDefined();
      expect(instaloader.ProfileHasNoPicsException).toBeDefined();
      expect(instaloader.PrivateProfileNotFollowedException).toBeDefined();
      expect(instaloader.LoginRequiredException).toBeDefined();
      expect(instaloader.LoginException).toBeDefined();
      expect(instaloader.TwoFactorAuthRequiredException).toBeDefined();
      expect(instaloader.InvalidArgumentException).toBeDefined();
      expect(instaloader.BadResponseException).toBeDefined();
      expect(instaloader.BadCredentialsException).toBeDefined();
      expect(instaloader.ConnectionException).toBeDefined();
      expect(instaloader.PostChangedException).toBeDefined();
      expect(instaloader.QueryReturnedNotFoundException).toBeDefined();
      expect(instaloader.TooManyRequestsException).toBeDefined();
      expect(instaloader.IPhoneSupportDisabledException).toBeDefined();
      expect(instaloader.AbortDownloadException).toBeDefined();
      expect(instaloader.SessionNotFoundException).toBeDefined();
      expect(instaloader.CheckpointRequiredException).toBeDefined();
      expect(instaloader.InvalidIteratorException).toBeDefined();
    });
  });

  describe('InstaloaderContext', () => {
    it('should export InstaloaderContext class', () => {
      expect(instaloader.InstaloaderContext).toBeDefined();
    });

    it('should export RateController class', () => {
      expect(instaloader.RateController).toBeDefined();
    });

    it('should export defaultUserAgent', () => {
      expect(instaloader.defaultUserAgent).toBeDefined();
      // defaultUserAgent is a function that returns a user agent string
      expect(typeof instaloader.defaultUserAgent).toBe('function');
      const ua = instaloader.defaultUserAgent();
      expect(typeof ua).toBe('string');
      expect(ua.length).toBeGreaterThan(0);
    });

    it('should export defaultIphoneHeaders', () => {
      expect(instaloader.defaultIphoneHeaders).toBeDefined();
      // defaultIphoneHeaders is a function that returns headers object
      expect(typeof instaloader.defaultIphoneHeaders).toBe('function');
      const headers = instaloader.defaultIphoneHeaders();
      expect(typeof headers).toBe('object');
    });
  });

  describe('NodeIterator', () => {
    it('should export NodeIterator class', () => {
      expect(instaloader.NodeIterator).toBeDefined();
    });

    it('should export FrozenNodeIterator class', () => {
      expect(instaloader.FrozenNodeIterator).toBeDefined();
    });

    it('should export resumableIteration function', () => {
      expect(instaloader.resumableIteration).toBeDefined();
      expect(typeof instaloader.resumableIteration).toBe('function');
    });
  });

  describe('structures', () => {
    it('should export helper functions', () => {
      expect(instaloader.shortcodeToMediaid).toBeDefined();
      expect(instaloader.mediaidToShortcode).toBeDefined();
      expect(instaloader.extractHashtags).toBeDefined();
      expect(instaloader.extractMentions).toBeDefined();
    });

    it('should export URL parsing helpers', () => {
      expect(instaloader.parseInstagramUrl).toBeDefined();
      expect(instaloader.extractShortcode).toBeDefined();
      expect(instaloader.extractUsername).toBeDefined();
      expect(instaloader.extractHashtagFromUrl).toBeDefined();
    });

    it('should export structure classes', () => {
      expect(instaloader.PostComment).toBeDefined();
      expect(instaloader.Post).toBeDefined();
      expect(instaloader.Profile).toBeDefined();
      expect(instaloader.StoryItem).toBeDefined();
      expect(instaloader.Story).toBeDefined();
      expect(instaloader.Highlight).toBeDefined();
      expect(instaloader.Hashtag).toBeDefined();
      expect(instaloader.TopSearchResults).toBeDefined();
    });

    it('should export JSON serialization functions', () => {
      expect(instaloader.getJsonStructure).toBeDefined();
      expect(instaloader.loadStructure).toBeDefined();
    });
  });

  describe('Instaloader', () => {
    it('should export Instaloader class', () => {
      expect(instaloader.Instaloader).toBeDefined();
    });

    it('should export utility functions', () => {
      expect(instaloader.getConfigDir).toBeDefined();
      expect(instaloader.getDefaultSessionFilename).toBeDefined();
      expect(instaloader.getDefaultStampsFilename).toBeDefined();
      expect(instaloader.formatStringContainsKey).toBeDefined();
      expect(instaloader.sanitizePath).toBeDefined();
      expect(instaloader.formatFilename).toBeDefined();
    });
  });

  describe('functional tests', () => {
    it('should be able to use shortcodeToMediaid', () => {
      const mediaid = instaloader.shortcodeToMediaid('B');
      expect(mediaid).toBe(BigInt(1));
    });

    it('should be able to use extractHashtags', () => {
      const hashtags = instaloader.extractHashtags('Hello #world #test');
      expect(hashtags).toContain('world');
      expect(hashtags).toContain('test');
    });

    it('should be able to use parseInstagramUrl', () => {
      const result = instaloader.parseInstagramUrl('https://www.instagram.com/p/ABC123/');
      expect(result.type).toBe('post');
      expect(result.shortcode).toBe('ABC123');
    });

    it('should be able to create an Instaloader instance', () => {
      const loader = new instaloader.Instaloader({ quiet: true });
      expect(loader).toBeDefined();
      expect(loader.context).toBeDefined();
      loader.close();
    });
  });
});
