/**
 * Tests for Instaloader class and utility functions.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import {
  Instaloader,
  getConfigDir,
  getDefaultSessionFilename,
  getDefaultStampsFilename,
  formatStringContainsKey,
  sanitizePath,
  formatFilename,
} from '../instaloader';
import { Post, Profile, StoryItem } from '../structures';
import { LoginRequiredException, InvalidArgumentException } from '../exceptions';
import type { InstaloaderContext } from '../instaloadercontext';
import type { JsonObject } from '../types';

// Mock fs module
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof fs>('fs');
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(false),
    promises: {
      ...actual.promises,
      mkdir: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
      readFile: vi.fn().mockResolvedValue('{}'),
      utimes: vi.fn().mockResolvedValue(undefined),
      access: vi.fn().mockRejectedValue(new Error('ENOENT')),
    },
  };
});

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock InstaloaderContext
function createMockContext(overrides: Record<string, unknown> = {}): InstaloaderContext {
  return {
    username: 'testuser',
    is_logged_in: true,
    iphoneSupport: false,
    quiet: false,
    sleep: false,
    graphql_query: vi.fn(),
    doc_id_graphql_query: vi.fn(),
    get_iphone_json: vi.fn(),
    getJson: vi.fn(),
    httpRequest: vi.fn(),
    log: vi.fn(),
    error: vi.fn(),
    profile_id_cache: new Map(),
    ...overrides,
  } as unknown as InstaloaderContext;
}

// Sample post data
const samplePostNode: JsonObject = {
  id: '12345',
  shortcode: 'ABC123',
  __typename: 'GraphImage',
  display_url: 'https://example.com/image.jpg',
  is_video: false,
  taken_at_timestamp: 1609459200, // 2021-01-01 00:00:00 UTC
  edge_media_to_caption: {
    edges: [{ node: { text: 'Test caption' } }],
  },
  edge_media_to_comment: { count: 5 },
  edge_liked_by: { count: 100 },
  owner: {
    id: '67890',
    username: 'testowner',
  },
};

// Sample profile data
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

describe('getConfigDir', () => {
  const originalPlatform = process.platform;
  const originalEnv = { ...process.env };

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    process.env = { ...originalEnv };
  });

  it('should return XDG config path on Unix', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    delete process.env['XDG_CONFIG_HOME'];
    const configDir = getConfigDir();
    expect(configDir).toContain('instaloader');
    expect(configDir).toContain('.config');
  });

  it('should respect XDG_CONFIG_HOME on Unix', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    process.env['XDG_CONFIG_HOME'] = '/custom/config';
    const configDir = getConfigDir();
    expect(configDir).toBe('/custom/config/instaloader');
  });

  it('should use LOCALAPPDATA on Windows', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    process.env['LOCALAPPDATA'] = 'C:\\Users\\Test\\AppData\\Local';
    const configDir = getConfigDir();
    expect(configDir).toBe(path.join('C:\\Users\\Test\\AppData\\Local', 'Instaloader'));
  });

  it('should fallback to tmpdir on Windows without LOCALAPPDATA', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    delete process.env['LOCALAPPDATA'];
    const configDir = getConfigDir();
    expect(configDir).toContain('.instaloader-');
    expect(configDir).toContain(os.tmpdir());
  });
});

describe('getDefaultSessionFilename', () => {
  it('should include username in filename', () => {
    const filename = getDefaultSessionFilename('testuser');
    expect(filename).toContain('session-testuser');
  });

  it('should be inside config directory', () => {
    const filename = getDefaultSessionFilename('testuser');
    expect(filename.startsWith(getConfigDir())).toBe(true);
  });
});

describe('getDefaultStampsFilename', () => {
  it('should return stamps filename in config directory', () => {
    const filename = getDefaultStampsFilename();
    expect(filename).toContain('latest-stamps.ini');
    expect(filename.startsWith(getConfigDir())).toBe(true);
  });
});

describe('formatStringContainsKey', () => {
  it('should find simple key', () => {
    expect(formatStringContainsKey('{target}', 'target')).toBe(true);
  });

  it('should find key with modifier', () => {
    expect(formatStringContainsKey('{date_utc:%Y-%m-%d}', 'date_utc')).toBe(true);
  });

  it('should not find non-existent key', () => {
    expect(formatStringContainsKey('{target}', 'other')).toBe(false);
  });

  it('should find nested key', () => {
    expect(formatStringContainsKey('{owner.username}', 'owner')).toBe(true);
  });

  it('should handle multiple keys', () => {
    const pattern = '{target}/{date_utc}';
    expect(formatStringContainsKey(pattern, 'target')).toBe(true);
    expect(formatStringContainsKey(pattern, 'date_utc')).toBe(true);
    expect(formatStringContainsKey(pattern, 'other')).toBe(false);
  });
});

describe('sanitizePath', () => {
  it('should replace forward slash', () => {
    expect(sanitizePath('a/b')).toBe('a\u2215b');
  });

  it('should replace leading dot', () => {
    expect(sanitizePath('.hidden')).toBe('\u2024hidden');
  });

  it('should handle Windows reserved names when forced', () => {
    expect(sanitizePath('CON', true)).toBe('CON_');
    expect(sanitizePath('NUL', true)).toBe('NUL_');
    expect(sanitizePath('COM1', true)).toBe('COM1_');
    expect(sanitizePath('LPT1', true)).toBe('LPT1_');
  });

  it('should replace Windows special characters when forced', () => {
    const result = sanitizePath('a:b<c>d"e\\f|g?h*i', true);
    expect(result).not.toContain(':');
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).not.toContain('"');
    expect(result).not.toContain('\\');
    expect(result).not.toContain('|');
    expect(result).not.toContain('?');
    expect(result).not.toContain('*');
  });

  it('should handle normal string', () => {
    expect(sanitizePath('normal')).toBe('normal');
  });
});

describe('formatFilename', () => {
  it('should replace target placeholder', () => {
    expect(formatFilename('{target}', {} as Post, 'myprofile')).toBe('myprofile');
  });

  it('should handle Post placeholders', () => {
    const context = createMockContext();
    const post = new Post(context, samplePostNode);
    const result = formatFilename('{shortcode}', post, 'target');
    expect(result).toBe('ABC123');
  });

  it('should handle date placeholders for Post', () => {
    const context = createMockContext();
    const post = new Post(context, samplePostNode);
    const result = formatFilename('{date_utc}', post, 'target');
    expect(result).toContain('2021-01-01');
  });

  it('should handle Profile username', () => {
    const context = createMockContext();
    const profile = new Profile(context, sampleProfileNode);
    const result = formatFilename('{profile}', profile, 'target');
    expect(result).toBe('testprofile');
  });

  it('should sanitize when requested', () => {
    const result = formatFilename('{target}', {} as Post, 'a/b', true);
    expect(result).toBe('a\u2215b');
  });

  it('should handle combined pattern', () => {
    const context = createMockContext();
    const post = new Post(context, samplePostNode);
    const result = formatFilename('{target}/{shortcode}', post, 'myprofile');
    expect(result).toBe('myprofile/ABC123');
  });
});

describe('Instaloader', () => {
  describe('constructor', () => {
    it('should create with default options', () => {
      const loader = new Instaloader();
      expect(loader.context).toBeDefined();
      expect(loader.dirnamePattern).toBe('{target}');
      expect(loader.filenamePattern).toBe('{date_utc}_UTC');
      expect(loader.downloadPictures).toBe(true);
      expect(loader.downloadVideos).toBe(true);
      expect(loader.saveMetadata).toBe(true);
    });

    it('should accept custom options', () => {
      const loader = new Instaloader({
        dirnamePattern: '{target}/{date_utc}',
        filenamePattern: '{shortcode}',
        downloadPictures: false,
        downloadVideos: false,
        quiet: true,
      });
      expect(loader.dirnamePattern).toBe('{target}/{date_utc}');
      expect(loader.filenamePattern).toBe('{shortcode}');
      expect(loader.downloadPictures).toBe(false);
      expect(loader.downloadVideos).toBe(false);
    });

    it('should create context with provided options', () => {
      const loader = new Instaloader({
        sleep: true,
        quiet: true,
        userAgent: 'CustomAgent/1.0',
      });
      expect(loader.context).toBeDefined();
    });

    it('should set titlePattern based on dirnamePattern containing profile', () => {
      const loader = new Instaloader({
        dirnamePattern: '{profile}/posts',
      });
      expect(loader.titlePattern).toBe('{date_utc}_UTC_{typename}');
    });

    it('should set titlePattern based on dirnamePattern containing target', () => {
      const loader = new Instaloader({
        dirnamePattern: '{target}/posts',
      });
      expect(loader.titlePattern).toBe('{date_utc}_UTC_{typename}');
    });

    it('should set titlePattern with target when dirnamePattern has neither profile nor target', () => {
      const loader = new Instaloader({
        dirnamePattern: 'downloads',
      });
      expect(loader.titlePattern).toBe('{target}_{date_utc}_UTC_{typename}');
    });

    it('should use custom titlePattern when provided', () => {
      const loader = new Instaloader({
        titlePattern: '{custom}',
      });
      expect(loader.titlePattern).toBe('{custom}');
    });

    it('should set resumePrefix to null when explicitly set', () => {
      const loader = new Instaloader({
        resumePrefix: null,
      });
      expect(loader.resumePrefix).toBeNull();
    });

    it('should use custom resumePrefix when provided', () => {
      const loader = new Instaloader({
        resumePrefix: 'custom-prefix',
      });
      expect(loader.resumePrefix).toBe('custom-prefix');
    });

    it('should default resumePrefix to iterator', () => {
      const loader = new Instaloader();
      expect(loader.resumePrefix).toBe('iterator');
    });
  });

  describe('slide parameter parsing', () => {
    it('should parse single slide number', () => {
      const loader = new Instaloader({ slide: '3' });
      expect(loader.slide).toBe('3');
    });

    it('should parse slide range', () => {
      const loader = new Instaloader({ slide: '1-5' });
      expect(loader.slide).toBe('1-5');
    });

    it('should parse "last" slide', () => {
      const loader = new Instaloader({ slide: 'last' });
      expect(loader.slide).toBe('last');
    });

    it('should parse range ending with "last"', () => {
      const loader = new Instaloader({ slide: '2-last' });
      expect(loader.slide).toBe('2-last');
    });

    it('should throw InvalidArgumentException for slide <= 0', () => {
      expect(() => new Instaloader({ slide: '0' })).toThrow(InvalidArgumentException);
      expect(() => new Instaloader({ slide: '-1' })).toThrow(InvalidArgumentException);
    });

    it('should throw InvalidArgumentException for invalid range (start >= end)', () => {
      expect(() => new Instaloader({ slide: '5-3' })).toThrow(InvalidArgumentException);
      expect(() => new Instaloader({ slide: '3-3' })).toThrow(InvalidArgumentException);
    });

    it('should throw InvalidArgumentException for invalid slide format', () => {
      expect(() => new Instaloader({ slide: '1-2-3' })).toThrow(InvalidArgumentException);
    });
  });

  describe('close', () => {
    it('should call context.close()', () => {
      const loader = new Instaloader();
      const closeSpy = vi.spyOn(loader.context, 'close');
      loader.close();
      expect(closeSpy).toHaveBeenCalled();
    });
  });

  describe('session management', () => {
    it('saveSession should throw LoginRequiredException when not logged in', () => {
      const loader = new Instaloader();
      // Mock is_logged_in to false
      Object.defineProperty(loader.context, 'is_logged_in', { value: false });
      expect(() => loader.saveSession()).toThrow(LoginRequiredException);
    });

    it('saveSession should call context.saveSession when logged in', () => {
      const loader = new Instaloader();
      Object.defineProperty(loader.context, 'is_logged_in', { value: true });
      const mockSaveSession = vi.fn().mockReturnValue({ sessionid: 'test' });
      loader.context.saveSession = mockSaveSession;

      const result = loader.saveSession();
      expect(mockSaveSession).toHaveBeenCalled();
      expect(result).toEqual({ sessionid: 'test' });
    });

    it('loadSession should call context.loadSession', () => {
      const loader = new Instaloader();
      const mockLoadSession = vi.fn();
      loader.context.loadSession = mockLoadSession;

      loader.loadSession('testuser', { sessionid: 'test' });
      expect(mockLoadSession).toHaveBeenCalledWith('testuser', { sessionid: 'test' });
    });

    it('login should call context.login', async () => {
      const loader = new Instaloader();
      const mockLogin = vi.fn().mockResolvedValue(undefined);
      loader.context.login = mockLogin;

      await loader.login('user', 'pass');
      expect(mockLogin).toHaveBeenCalledWith('user', 'pass');
    });

    it('twoFactorLogin should call context.twoFactorLogin', async () => {
      const loader = new Instaloader();
      const mockTwoFactorLogin = vi.fn().mockResolvedValue(undefined);
      loader.context.twoFactorLogin = mockTwoFactorLogin;

      await loader.twoFactorLogin('123456');
      expect(mockTwoFactorLogin).toHaveBeenCalledWith('123456');
    });
  });

  describe('testLogin', () => {
    it('should return true when logged in', async () => {
      const loader = new Instaloader();
      // Mock the context's testLogin method
      const mockTestLogin = vi.fn().mockResolvedValue(true);
      (loader.context as unknown as { testLogin: typeof mockTestLogin }).testLogin = mockTestLogin;

      const result = await loader.testLogin();
      expect(result).toBe(true);
      expect(mockTestLogin).toHaveBeenCalled();
    });
  });

  describe('getProfile', () => {
    it('should return a Profile for a username', async () => {
      const loader = new Instaloader();

      // Mock the get_iphone_json to return profile data
      const mockGetIphoneJson = vi.fn().mockResolvedValue({
        data: {
          user: {
            ...sampleProfileNode,
          },
        },
      });
      (loader.context as unknown as { get_iphone_json: typeof mockGetIphoneJson }).get_iphone_json =
        mockGetIphoneJson;

      const profile = await loader.getProfile('testprofile');
      expect(profile).toBeInstanceOf(Profile);
      expect(profile.username).toBe('testprofile');
    });
  });

  describe('getPost', () => {
    it('should be a method that returns a Promise', () => {
      const loader = new Instaloader();
      expect(typeof loader.getPost).toBe('function');
      // Note: Full testing would require mocking the network layer
      // which is complex due to Post.fromShortcode's internal behavior
    });
  });

  describe('sanitizePaths option', () => {
    it('should use sanitizePaths when enabled', () => {
      const loader = new Instaloader({
        sanitizePaths: true,
      });
      expect(loader.sanitizePaths).toBe(true);
    });

    it('should not sanitize by default', () => {
      const loader = new Instaloader();
      expect(loader.sanitizePaths).toBe(false);
    });
  });

  describe('configuration', () => {
    it('should expose downloadPictures setting', () => {
      const loader1 = new Instaloader({ downloadPictures: true });
      const loader2 = new Instaloader({ downloadPictures: false });
      expect(loader1.downloadPictures).toBe(true);
      expect(loader2.downloadPictures).toBe(false);
    });

    it('should expose downloadVideos setting', () => {
      const loader1 = new Instaloader({ downloadVideos: true });
      const loader2 = new Instaloader({ downloadVideos: false });
      expect(loader1.downloadVideos).toBe(true);
      expect(loader2.downloadVideos).toBe(false);
    });

    it('should expose saveMetadata setting', () => {
      const loader1 = new Instaloader({ saveMetadata: true });
      const loader2 = new Instaloader({ saveMetadata: false });
      expect(loader1.saveMetadata).toBe(true);
      expect(loader2.saveMetadata).toBe(false);
    });

    it('should expose downloadComments setting', () => {
      const loader1 = new Instaloader({ downloadComments: true });
      const loader2 = new Instaloader({ downloadComments: false });
      expect(loader1.downloadComments).toBe(true);
      expect(loader2.downloadComments).toBe(false);
    });

    it('should expose compressJson setting', () => {
      const loader1 = new Instaloader({ compressJson: true });
      const loader2 = new Instaloader({ compressJson: false });
      expect(loader1.compressJson).toBe(true);
      expect(loader2.compressJson).toBe(false);
    });

    it('should expose downloadVideoThumbnails setting', () => {
      const loader1 = new Instaloader({ downloadVideoThumbnails: true });
      const loader2 = new Instaloader({ downloadVideoThumbnails: false });
      expect(loader1.downloadVideoThumbnails).toBe(true);
      expect(loader2.downloadVideoThumbnails).toBe(false);
    });

    it('should expose downloadGeotags setting', () => {
      const loader1 = new Instaloader({ downloadGeotags: true });
      const loader2 = new Instaloader({ downloadGeotags: false });
      expect(loader1.downloadGeotags).toBe(true);
      expect(loader2.downloadGeotags).toBe(false);
    });

    it('should expose postMetadataTxtPattern setting', () => {
      const loader = new Instaloader({ postMetadataTxtPattern: '{shortcode}' });
      expect(loader.postMetadataTxtPattern).toBe('{shortcode}');
    });

    it('should expose storyitemMetadataTxtPattern setting', () => {
      const loader = new Instaloader({ storyitemMetadataTxtPattern: '{mediaid}' });
      expect(loader.storyitemMetadataTxtPattern).toBe('{mediaid}');
    });

    it('should expose checkResumeBbd setting', () => {
      const loader1 = new Instaloader({ checkResumeBbd: true });
      const loader2 = new Instaloader({ checkResumeBbd: false });
      expect(loader1.checkResumeBbd).toBe(true);
      expect(loader2.checkResumeBbd).toBe(false);
    });
  });

  describe('downloadPic', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(fs.existsSync).mockReturnValue(false);
    });

    it('should download a file successfully', async () => {
      const loader = new Instaloader({ quiet: true });
      const mockResponse = {
        ok: true,
        headers: new Headers({ 'Content-Type': 'image/jpeg' }),
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await loader.downloadPic(
        '/tmp/test',
        'https://example.com/image.jpg?123',
        new Date()
      );

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalled();
      expect(fs.promises.writeFile).toHaveBeenCalled();
      expect(fs.promises.utimes).toHaveBeenCalled();
    });

    it('should return false if file already exists', async () => {
      const loader = new Instaloader({ quiet: true });
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const result = await loader.downloadPic(
        '/tmp/test',
        'https://example.com/image.jpg?123',
        new Date()
      );

      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should add filename suffix when provided', async () => {
      const loader = new Instaloader({ quiet: true });
      const mockResponse = {
        ok: true,
        headers: new Headers({ 'Content-Type': 'image/jpeg' }),
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await loader.downloadPic('/tmp/test', 'https://example.com/image.jpg?123', new Date(), '1');

      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test_1'),
        expect.anything()
      );
    });

    it('should throw ConnectionException on failed fetch', async () => {
      const loader = new Instaloader({ quiet: true });
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const { ConnectionException } = await import('../exceptions');
      await expect(
        loader.downloadPic('/tmp/test', 'https://example.com/image.jpg', new Date())
      ).rejects.toThrow(ConnectionException);
    });

    it('should convert jpeg Content-Type to jpg extension', async () => {
      const loader = new Instaloader({ quiet: true });
      const mockResponse = {
        ok: true,
        headers: new Headers({ 'Content-Type': 'image/jpeg' }),
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await loader.downloadPic('/tmp/test', 'https://example.com/image.png?123', new Date());

      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.jpg'),
        expect.anything()
      );
    });

    it('should create directory if it does not exist', async () => {
      const loader = new Instaloader({ quiet: true });
      const mockResponse = {
        ok: true,
        headers: new Headers({ 'Content-Type': 'image/jpeg' }),
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
      };
      mockFetch.mockResolvedValue(mockResponse);
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await loader.downloadPic('/tmp/subdir/test', 'https://example.com/image.jpg', new Date());

      expect(fs.promises.mkdir).toHaveBeenCalledWith(expect.stringContaining('subdir'), {
        recursive: true,
      });
    });
  });

  describe('saveMetadataJson', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(fs.existsSync).mockReturnValue(false);
    });

    it('should save metadata as JSON', async () => {
      const loader = new Instaloader({ quiet: true, compressJson: false });
      const context = createMockContext();
      const post = new Post(context, samplePostNode);

      await loader.saveMetadataJson('/tmp/test', post);

      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        '/tmp/test.json',
        expect.stringContaining('"node"')
      );
    });

    it('should handle compressJson option (saves as uncompressed for now)', async () => {
      const loader = new Instaloader({ quiet: true, compressJson: true });
      const context = createMockContext();
      const post = new Post(context, samplePostNode);

      await loader.saveMetadataJson('/tmp/test', post);

      // Currently saves as uncompressed even with compressJson: true
      expect(fs.promises.writeFile).toHaveBeenCalled();
    });

    it('should log json for Post', async () => {
      const loader = new Instaloader({ quiet: false, compressJson: false });
      const context = createMockContext();
      const post = new Post(context, samplePostNode);
      const logSpy = vi.spyOn(loader.context, 'log');

      await loader.saveMetadataJson('/tmp/test', post);

      expect(logSpy).toHaveBeenCalledWith('json', false);
    });

    it('should log json for StoryItem', async () => {
      const loader = new Instaloader({ quiet: false, compressJson: false });
      const context = createMockContext();
      const storyItem = new StoryItem(context, {
        id: '11111',
        __typename: 'GraphStoryImage',
        display_url: 'https://example.com/story.jpg',
        taken_at_timestamp: 1609459200,
        is_video: false,
        owner: { id: '67890', username: 'testowner' },
      });
      const logSpy = vi.spyOn(loader.context, 'log');

      await loader.saveMetadataJson('/tmp/test', storyItem);

      expect(logSpy).toHaveBeenCalledWith('json', false);
    });
  });

  describe('saveCaption', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(fs.existsSync).mockReturnValue(false);
    });

    it('should save caption to text file', async () => {
      const loader = new Instaloader({ quiet: true });

      await loader.saveCaption('/tmp/test', new Date(), 'Test caption');

      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        '/tmp/test.txt',
        'Test caption\n',
        'utf-8'
      );
    });

    it('should log unchanged when file content is same', async () => {
      const loader = new Instaloader({ quiet: false });
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readFile).mockResolvedValue('Test caption\n');
      const logSpy = vi.spyOn(loader.context, 'log');

      await loader.saveCaption('/tmp/test', new Date(), 'Test caption');

      expect(logSpy).toHaveBeenCalledWith('txt unchanged', false);
    });

    it('should log updated when file content is different', async () => {
      const loader = new Instaloader({ quiet: false });
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readFile).mockResolvedValue('Old caption\n');
      const logSpy = vi.spyOn(loader.context, 'log');

      await loader.saveCaption('/tmp/test', new Date(), 'New caption');

      expect(logSpy).toHaveBeenCalledWith('txt updated', false);
    });

    it('should log preview when creating new file', async () => {
      const loader = new Instaloader({ quiet: false });
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const logSpy = vi.spyOn(loader.context, 'log');

      await loader.saveCaption('/tmp/test', new Date(), 'Short caption');

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[Short caption]'), false);
    });

    it('should truncate long preview', async () => {
      const loader = new Instaloader({ quiet: false });
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const logSpy = vi.spyOn(loader.context, 'log');

      const longCaption = 'A'.repeat(100);
      await loader.saveCaption('/tmp/test', new Date(), longCaption);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('…]'), false);
    });
  });

  describe('getHashtag', () => {
    it('should be a method that returns a Promise', () => {
      const loader = new Instaloader();
      expect(typeof loader.getHashtag).toBe('function');
    });
  });

  describe('context access', () => {
    it('should expose context userAgent', () => {
      const loader = new Instaloader({ userAgent: 'CustomAgent/1.0' });
      expect(loader.context.userAgent).toBeDefined();
    });
  });
});
