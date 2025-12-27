/**
 * Tests for URL parsing helpers
 */

import { describe, it, expect } from 'vitest';
import {
  parseInstagramUrl,
  extractShortcode,
  extractUsername,
  extractHashtagFromUrl,
} from '../structures';

describe('URL Parsing Helpers', () => {
  describe('parseInstagramUrl', () => {
    it('should parse post URLs', () => {
      expect(parseInstagramUrl('https://www.instagram.com/p/DSsaqgbkhAd/')).toEqual({
        type: 'post',
        shortcode: 'DSsaqgbkhAd',
      });

      expect(parseInstagramUrl('https://instagram.com/p/ABC123')).toEqual({
        type: 'post',
        shortcode: 'ABC123',
      });

      expect(
        parseInstagramUrl('https://www.instagram.com/p/DSsaqgbkhAd/?img_index=1')
      ).toEqual({
        type: 'post',
        shortcode: 'DSsaqgbkhAd',
      });
    });

    it('should parse reel URLs', () => {
      expect(parseInstagramUrl('https://www.instagram.com/reel/ABC123/')).toEqual({
        type: 'post',
        shortcode: 'ABC123',
      });
    });

    it('should parse TV URLs', () => {
      expect(parseInstagramUrl('https://www.instagram.com/tv/XYZ789/')).toEqual({
        type: 'post',
        shortcode: 'XYZ789',
      });
    });

    it('should parse profile URLs', () => {
      expect(parseInstagramUrl('https://www.instagram.com/instagram/')).toEqual({
        type: 'profile',
        username: 'instagram',
      });

      expect(parseInstagramUrl('https://instagram.com/natgeo')).toEqual({
        type: 'profile',
        username: 'natgeo',
      });

      expect(parseInstagramUrl('https://www.instagram.com/user.name/')).toEqual({
        type: 'profile',
        username: 'user.name',
      });

      expect(parseInstagramUrl('https://www.instagram.com/user_name/?hl=en')).toEqual({
        type: 'profile',
        username: 'user_name',
      });
    });

    it('should parse hashtag URLs', () => {
      expect(
        parseInstagramUrl('https://www.instagram.com/explore/tags/nature/')
      ).toEqual({
        type: 'hashtag',
        hashtag: 'nature',
      });

      expect(
        parseInstagramUrl('https://instagram.com/explore/tags/photography')
      ).toEqual({
        type: 'hashtag',
        hashtag: 'photography',
      });
    });

    it('should return unknown for non-Instagram URLs', () => {
      expect(parseInstagramUrl('https://google.com')).toEqual({ type: 'unknown' });
      expect(parseInstagramUrl('not a url')).toEqual({ type: 'unknown' });
    });

    it('should return unknown for special Instagram paths', () => {
      expect(parseInstagramUrl('https://www.instagram.com/explore/')).toEqual({
        type: 'unknown',
      });
      expect(parseInstagramUrl('https://www.instagram.com/accounts/login/')).toEqual({
        type: 'unknown',
      });
    });
  });

  describe('extractShortcode', () => {
    it('should extract shortcode from post URL', () => {
      expect(
        extractShortcode('https://www.instagram.com/p/DSsaqgbkhAd/?img_index=1')
      ).toBe('DSsaqgbkhAd');
    });

    it('should extract shortcode from reel URL', () => {
      expect(extractShortcode('https://www.instagram.com/reel/ABC123/')).toBe(
        'ABC123'
      );
    });

    it('should return null for non-post URLs', () => {
      expect(extractShortcode('https://www.instagram.com/instagram/')).toBeNull();
    });
  });

  describe('extractUsername', () => {
    it('should extract username from profile URL', () => {
      expect(extractUsername('https://www.instagram.com/instagram/')).toBe(
        'instagram'
      );
    });

    it('should return null for non-profile URLs', () => {
      expect(extractUsername('https://www.instagram.com/p/ABC123/')).toBeNull();
    });
  });

  describe('extractHashtagFromUrl', () => {
    it('should extract hashtag from URL', () => {
      expect(
        extractHashtagFromUrl('https://www.instagram.com/explore/tags/nature/')
      ).toBe('nature');
    });

    it('should return null for non-hashtag URLs', () => {
      expect(
        extractHashtagFromUrl('https://www.instagram.com/instagram/')
      ).toBeNull();
    });
  });
});
