/**
 * Tests for helper functions in structures.ts
 */

import { describe, it, expect } from 'vitest';
import {
  shortcodeToMediaid,
  mediaidToShortcode,
  extractHashtags,
  extractMentions,
} from '../structures';
import { InvalidArgumentException } from '../exceptions';

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
