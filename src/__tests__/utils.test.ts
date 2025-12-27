/**
 * Tests for utils.ts - UUID generation and SimpleCookieStore
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { generateUUID, SimpleCookieStore } from '../utils';

describe('generateUUID', () => {
  it('should generate a valid UUID v4 format', () => {
    const uuid = generateUUID();
    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(uuid).toMatch(uuidRegex);
  });

  it('should generate unique UUIDs', () => {
    const uuids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      uuids.add(generateUUID());
    }
    expect(uuids.size).toBe(100);
  });

  it('should generate UUIDs with correct length', () => {
    const uuid = generateUUID();
    expect(uuid.length).toBe(36); // 8-4-4-4-12 = 32 hex chars + 4 hyphens
  });

  it('should have version 4 indicator in position 14', () => {
    const uuid = generateUUID();
    expect(uuid[14]).toBe('4');
  });

  it('should have valid variant in position 19', () => {
    const uuid = generateUUID();
    const variantChar = uuid[19]!.toLowerCase();
    expect(['8', '9', 'a', 'b']).toContain(variantChar);
  });

  describe('fallback implementations', () => {
    const originalCrypto = globalThis.crypto;

    afterEach(() => {
      // Restore original crypto
      Object.defineProperty(globalThis, 'crypto', {
        value: originalCrypto,
        configurable: true,
        writable: true,
      });
    });

    it('should use getRandomValues fallback when randomUUID is not available', () => {
      // Mock crypto with getRandomValues but without randomUUID
      const mockGetRandomValues = vi.fn((array: Uint8Array) => {
        for (let i = 0; i < array.length; i++) {
          array[i] = (i * 17) % 256; // Deterministic pattern for testing
        }
        return array;
      });

      Object.defineProperty(globalThis, 'crypto', {
        value: {
          getRandomValues: mockGetRandomValues,
          // randomUUID is explicitly not defined
        },
        configurable: true,
        writable: true,
      });

      const uuid = generateUUID();

      // Should still be valid UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uuid).toMatch(uuidRegex);
      expect(mockGetRandomValues).toHaveBeenCalled();
    });

    it('should use Math.random fallback when no crypto methods are available', () => {
      // Mock crypto without randomUUID or getRandomValues
      Object.defineProperty(globalThis, 'crypto', {
        value: {
          // Neither randomUUID nor getRandomValues
        },
        configurable: true,
        writable: true,
      });

      const mathRandomSpy = vi.spyOn(Math, 'random');

      const uuid = generateUUID();

      // Should still be valid UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uuid).toMatch(uuidRegex);

      // Math.random should have been called 16 times (once per byte)
      expect(mathRandomSpy).toHaveBeenCalled();
      expect(mathRandomSpy.mock.calls.length).toBeGreaterThanOrEqual(16);

      mathRandomSpy.mockRestore();
    });

    it('should use Math.random fallback when crypto is undefined', () => {
      // Make crypto undefined
      Object.defineProperty(globalThis, 'crypto', {
        value: undefined,
        configurable: true,
        writable: true,
      });

      const mathRandomSpy = vi.spyOn(Math, 'random');

      const uuid = generateUUID();

      // Should still be valid UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uuid).toMatch(uuidRegex);

      expect(mathRandomSpy).toHaveBeenCalled();

      mathRandomSpy.mockRestore();
    });
  });
});

describe('SimpleCookieStore', () => {
  let store: SimpleCookieStore;

  beforeEach(() => {
    store = new SimpleCookieStore();
  });

  describe('setCookies and getCookies', () => {
    it('should store and retrieve cookies for a URL', () => {
      store.setCookies({ sessionid: '123', csrftoken: 'abc' }, 'https://www.instagram.com/');

      const cookies = store.getCookies('https://www.instagram.com/api/');
      expect(cookies).toEqual({ sessionid: '123', csrftoken: 'abc' });
    });

    it('should return empty object for URLs with no cookies', () => {
      const cookies = store.getCookies('https://example.com/');
      expect(cookies).toEqual({});
    });

    it('should merge cookies when setting multiple times', () => {
      store.setCookies({ a: '1' }, 'https://example.com/');
      store.setCookies({ b: '2' }, 'https://example.com/');

      const cookies = store.getCookies('https://example.com/');
      expect(cookies).toEqual({ a: '1', b: '2' });
    });

    it('should overwrite existing cookie values', () => {
      store.setCookies({ a: '1' }, 'https://example.com/');
      store.setCookies({ a: '2' }, 'https://example.com/');

      const cookies = store.getCookies('https://example.com/');
      expect(cookies).toEqual({ a: '2' });
    });

    it('should store cookies per domain', () => {
      store.setCookies({ a: '1' }, 'https://example.com/');
      store.setCookies({ b: '2' }, 'https://other.com/');

      expect(store.getCookies('https://example.com/')).toEqual({ a: '1' });
      expect(store.getCookies('https://other.com/')).toEqual({ b: '2' });
    });
  });

  describe('getCookieHeader', () => {
    it('should generate proper Cookie header string', () => {
      store.setCookies({ sessionid: '123', csrftoken: 'abc' }, 'https://example.com/');

      const header = store.getCookieHeader('https://example.com/');
      expect(header).toContain('sessionid=123');
      expect(header).toContain('csrftoken=abc');
      expect(header).toContain('; ');
    });

    it('should return empty string for URLs with no cookies', () => {
      const header = store.getCookieHeader('https://example.com/');
      expect(header).toBe('');
    });
  });

  describe('parseSetCookieHeaders', () => {
    it('should parse Set-Cookie headers', () => {
      // Mock getSetCookie since it may not be available in test environment
      const mockHeaders = {
        getSetCookie: () => ['sessionid=123; Path=/; HttpOnly', 'csrftoken=abc; Path=/'],
      } as unknown as Headers;

      store.parseSetCookieHeaders(mockHeaders, 'https://example.com/');

      const cookies = store.getCookies('https://example.com/');
      expect(cookies).toEqual({ sessionid: '123', csrftoken: 'abc' });
    });

    it('should handle cookies without attributes', () => {
      const mockHeaders = {
        getSetCookie: () => ['simple=value'],
      } as unknown as Headers;

      store.parseSetCookieHeaders(mockHeaders, 'https://example.com/');

      const cookies = store.getCookies('https://example.com/');
      expect(cookies).toEqual({ simple: 'value' });
    });

    it('should handle empty Set-Cookie headers', () => {
      const mockHeaders = {
        getSetCookie: () => [],
      } as unknown as Headers;

      store.parseSetCookieHeaders(mockHeaders, 'https://example.com/');

      const cookies = store.getCookies('https://example.com/');
      expect(cookies).toEqual({});
    });

    it('should handle Headers without getSetCookie method', () => {
      const mockHeaders = {} as Headers;

      store.parseSetCookieHeaders(mockHeaders, 'https://example.com/');

      const cookies = store.getCookies('https://example.com/');
      expect(cookies).toEqual({});
    });

    it('should skip invalid cookie strings without equals sign', () => {
      const mockHeaders = {
        getSetCookie: () => ['invalid', 'valid=value'],
      } as unknown as Headers;

      store.parseSetCookieHeaders(mockHeaders, 'https://example.com/');

      const cookies = store.getCookies('https://example.com/');
      expect(cookies).toEqual({ valid: 'value' });
    });

    it('should skip cookies with empty name', () => {
      const mockHeaders = {
        getSetCookie: () => ['=value', 'valid=value'],
      } as unknown as Headers;

      store.parseSetCookieHeaders(mockHeaders, 'https://example.com/');

      const cookies = store.getCookies('https://example.com/');
      expect(cookies).toEqual({ valid: 'value' });
    });
  });

  describe('clear', () => {
    it('should clear all cookies', () => {
      store.setCookies({ a: '1' }, 'https://example.com/');
      store.setCookies({ b: '2' }, 'https://other.com/');

      store.clear();

      expect(store.getCookies('https://example.com/')).toEqual({});
      expect(store.getCookies('https://other.com/')).toEqual({});
    });
  });

  describe('clearDomain', () => {
    it('should clear cookies for a specific domain only', () => {
      store.setCookies({ a: '1' }, 'https://example.com/');
      store.setCookies({ b: '2' }, 'https://other.com/');

      store.clearDomain('https://example.com/');

      expect(store.getCookies('https://example.com/')).toEqual({});
      expect(store.getCookies('https://other.com/')).toEqual({ b: '2' });
    });
  });

  describe('extractDomain', () => {
    it('should extract domain from valid URLs', () => {
      store.setCookies({ a: '1' }, 'https://www.example.com/path/to/page');
      expect(store.getCookies('https://www.example.com/other/path')).toEqual({ a: '1' });
    });

    it('should handle invalid URLs gracefully', () => {
      // When URL is invalid, it should use the string as-is as the domain key
      store.setCookies({ a: '1' }, 'not-a-valid-url');
      expect(store.getCookies('not-a-valid-url')).toEqual({ a: '1' });
    });
  });
});
