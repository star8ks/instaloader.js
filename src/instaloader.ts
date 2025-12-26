/**
 * Instaloader - Main class for downloading Instagram content.
 *
 * Ported from Python instaloader/instaloader.py
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import {
  InstaloaderContext,
  RateController,
} from './instaloadercontext';
import { Post, Profile, StoryItem, Hashtag, getJsonStructure } from './structures';
import {
  LoginRequiredException,
  InvalidArgumentException,
  ConnectionException,
  PostChangedException,
} from './exceptions';

/**
 * Options for the Instaloader class.
 */
export interface InstaloaderOptions {
  /** Enable sleep between requests (rate limiting) */
  sleep?: boolean;
  /** Suppress output messages */
  quiet?: boolean;
  /** Custom user agent string */
  userAgent?: string;
  /** Directory pattern for downloads, default is "{target}" */
  dirnamePattern?: string;
  /** Filename pattern for downloads, default is "{date_utc}_UTC" */
  filenamePattern?: string;
  /** Title pattern for profile pics and covers */
  titlePattern?: string;
  /** Download pictures, default true */
  downloadPictures?: boolean;
  /** Download videos, default true */
  downloadVideos?: boolean;
  /** Download video thumbnails, default true */
  downloadVideoThumbnails?: boolean;
  /** Download geotags, default false */
  downloadGeotags?: boolean;
  /** Download comments, default false */
  downloadComments?: boolean;
  /** Save metadata JSON, default true */
  saveMetadata?: boolean;
  /** Compress JSON files with xz, default true */
  compressJson?: boolean;
  /** Pattern for post metadata txt files */
  postMetadataTxtPattern?: string;
  /** Pattern for story item metadata txt files */
  storyitemMetadataTxtPattern?: string;
  /** Maximum connection attempts, default 3 */
  maxConnectionAttempts?: number;
  /** Request timeout in seconds, default 300 */
  requestTimeout?: number;
  /** Custom rate controller factory */
  rateController?: (context: InstaloaderContext) => RateController;
  /** Resume file prefix, or null to disable resume */
  resumePrefix?: string | null;
  /** Check best-before date of resume files */
  checkResumeBbd?: boolean;
  /** Slide range for sidecar downloads (e.g., "1-3", "last") */
  slide?: string;
  /** Status codes that should abort the download */
  fatalStatusCodes?: number[];
  /** Enable iPhone API support */
  iphoneSupport?: boolean;
  /** Sanitize paths for Windows compatibility */
  sanitizePaths?: boolean;
}

/**
 * Gets the config directory for storing sessions and stamps.
 */
export function getConfigDir(): string {
  if (process.platform === 'win32') {
    const localAppData = process.env['LOCALAPPDATA'];
    if (localAppData) {
      return path.join(localAppData, 'Instaloader');
    }
    return path.join(os.tmpdir(), `.instaloader-${os.userInfo().username}`);
  }
  const xdgConfig = process.env['XDG_CONFIG_HOME'] || path.join(os.homedir(), '.config');
  return path.join(xdgConfig, 'instaloader');
}

/**
 * Returns the default session filename for a given username.
 */
export function getDefaultSessionFilename(username: string): string {
  return path.join(getConfigDir(), `session-${username}`);
}

/**
 * Returns the default stamps filename.
 */
export function getDefaultStampsFilename(): string {
  return path.join(getConfigDir(), 'latest-stamps.ini');
}

/**
 * Check if a format string contains a specific key.
 */
export function formatStringContainsKey(formatString: string, key: string): boolean {
  // Simple regex to find {key} or {key.something} patterns
  const pattern = new RegExp(`\\{${key}(?:\\.[^}]*)?\\}`, 'g');
  return pattern.test(formatString);
}

/**
 * Sanitize a path component for safe filesystem usage.
 */
export function sanitizePath(str: string, forceWindowsPath = false): string {
  // Replace forward slash with division slash
  let result = str.replace(/\//g, '\u2215');

  // Replace leading dot
  if (result.startsWith('.')) {
    result = '\u2024' + result.slice(1);
  }

  // Windows-specific replacements
  if (forceWindowsPath || process.platform === 'win32') {
    result = result
      .replace(/:/g, '\uff1a')
      .replace(/</g, '\ufe64')
      .replace(/>/g, '\ufe65')
      .replace(/"/g, '\uff02')
      .replace(/\\/g, '\ufe68')
      .replace(/\|/g, '\uff5c')
      .replace(/\?/g, '\ufe16')
      .replace(/\*/g, '\uff0a')
      .replace(/\n/g, ' ')
      .replace(/\r/g, ' ');

    // Handle reserved Windows filenames
    const reserved = new Set([
      'CON', 'PRN', 'AUX', 'NUL',
      'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
      'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
    ]);

    const ext = path.extname(result);
    let root = result.slice(0, result.length - ext.length);

    if (reserved.has(root.toUpperCase())) {
      root += '_';
    }

    const finalExt = ext === '.' ? '\u2024' : ext;
    result = root + finalExt;
  }

  return result;
}

/**
 * Format a filename with item attributes.
 * Note: This is a simplified synchronous version. Some properties like owner
 * require async access in the TypeScript version.
 */
export function formatFilename(
  pattern: string,
  item: Post | StoryItem | Profile,
  target?: string,
  sanitize = false
): string {
  let result = pattern;

  // Replace common placeholders
  const replacements: Record<string, string | undefined> = {
    target: target,
  };

  // Add profile username if available
  if (item instanceof Profile) {
    replacements['profile'] = item.username;
  }

  // Add date placeholders for Post and StoryItem
  if (item instanceof Post) {
    replacements['date_utc'] = formatDate(item.date_utc);
    replacements['date_local'] = formatDate(item.date_local);
    replacements['shortcode'] = item.shortcode;
    replacements['mediaid'] = item.mediaid.toString();
    replacements['typename'] = item.typename;
  } else if (item instanceof StoryItem) {
    replacements['date_utc'] = formatDate(item.date_utc);
    replacements['date_local'] = formatDate(item.date_local);
    replacements['mediaid'] = item.mediaid?.toString();
    replacements['typename'] = item.typename;
  }

  for (const [key, value] of Object.entries(replacements)) {
    if (value !== undefined) {
      const placeholder = new RegExp(`\\{${key}(?::[^}]*)?\\}`, 'g');
      let replacement = value;
      if (sanitize) {
        replacement = sanitizePath(value);
      }
      result = result.replace(placeholder, replacement);
    }
  }

  return result;
}

function formatDate(date: Date | undefined): string {
  if (!date) return '';
  return date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

/**
 * Main Instaloader class for downloading Instagram content.
 *
 * @example
 * ```typescript
 * const L = new Instaloader();
 *
 * // Login
 * await L.login('username', 'password');
 *
 * // Download a profile
 * const profile = await Profile.fromUsername(L.context, 'instagram');
 * await L.downloadProfile(profile);
 *
 * // Save session for later
 * await L.saveSessionToFile();
 * ```
 */
export class Instaloader {
  /** The associated InstaloaderContext for low-level operations */
  readonly context: InstaloaderContext;

  // Configuration
  readonly dirnamePattern: string;
  readonly filenamePattern: string;
  readonly titlePattern: string;
  readonly downloadPictures: boolean;
  readonly downloadVideos: boolean;
  readonly downloadVideoThumbnails: boolean;
  readonly downloadGeotags: boolean;
  readonly downloadComments: boolean;
  readonly saveMetadata: boolean;
  readonly compressJson: boolean;
  readonly postMetadataTxtPattern: string;
  readonly storyitemMetadataTxtPattern: string;
  readonly resumePrefix: string | null;
  readonly checkResumeBbd: boolean;
  readonly sanitizePaths: boolean;

  // Slide configuration
  readonly slide: string;
  private slideStart: number;
  private slideEnd: number;

  constructor(options: InstaloaderOptions = {}) {
    // Create context with relevant options - only pass defined values
    this.context = new InstaloaderContext({
      ...(options.sleep !== undefined && { sleep: options.sleep }),
      ...(options.quiet !== undefined && { quiet: options.quiet }),
      ...(options.userAgent !== undefined && { userAgent: options.userAgent }),
      ...(options.maxConnectionAttempts !== undefined && { maxConnectionAttempts: options.maxConnectionAttempts }),
      ...(options.requestTimeout !== undefined && { requestTimeout: options.requestTimeout }),
      ...(options.rateController !== undefined && { rateController: options.rateController }),
      ...(options.fatalStatusCodes !== undefined && { fatalStatusCodes: options.fatalStatusCodes }),
      ...(options.iphoneSupport !== undefined && { iphoneSupport: options.iphoneSupport }),
    });

    // Configuration
    this.dirnamePattern = options.dirnamePattern ?? '{target}';
    this.filenamePattern = options.filenamePattern ?? '{date_utc}_UTC';

    if (options.titlePattern !== undefined) {
      this.titlePattern = options.titlePattern;
    } else if (
      formatStringContainsKey(this.dirnamePattern, 'profile') ||
      formatStringContainsKey(this.dirnamePattern, 'target')
    ) {
      this.titlePattern = '{date_utc}_UTC_{typename}';
    } else {
      this.titlePattern = '{target}_{date_utc}_UTC_{typename}';
    }

    this.sanitizePaths = options.sanitizePaths ?? false;
    this.downloadPictures = options.downloadPictures ?? true;
    this.downloadVideos = options.downloadVideos ?? true;
    this.downloadVideoThumbnails = options.downloadVideoThumbnails ?? true;
    this.downloadGeotags = options.downloadGeotags ?? false;
    this.downloadComments = options.downloadComments ?? false;
    this.saveMetadata = options.saveMetadata ?? true;
    this.compressJson = options.compressJson ?? true;
    this.postMetadataTxtPattern = options.postMetadataTxtPattern ?? '{caption}';
    this.storyitemMetadataTxtPattern = options.storyitemMetadataTxtPattern ?? '';
    this.resumePrefix = options.resumePrefix === null ? null : (options.resumePrefix ?? 'iterator');
    this.checkResumeBbd = options.checkResumeBbd ?? true;

    // Parse slide parameter
    this.slide = options.slide ?? '';
    this.slideStart = 0;
    this.slideEnd = -1;

    if (this.slide !== '') {
      const parts = this.slide.split('-');
      if (parts.length === 1) {
        if (parts[0] === 'last') {
          this.slideStart = -1;
        } else {
          const num = parseInt(parts[0]!, 10);
          if (num > 0) {
            this.slideStart = this.slideEnd = num - 1;
          } else {
            throw new InvalidArgumentException('--slide parameter must be greater than 0.');
          }
        }
      } else if (parts.length === 2) {
        if (parts[1] === 'last') {
          this.slideStart = parseInt(parts[0]!, 10) - 1;
        } else {
          const start = parseInt(parts[0]!, 10);
          const end = parseInt(parts[1]!, 10);
          if (start > 0 && start < end) {
            this.slideStart = start - 1;
            this.slideEnd = end - 1;
          } else {
            throw new InvalidArgumentException('Invalid data for --slide parameter.');
          }
        }
      } else {
        throw new InvalidArgumentException('Invalid data for --slide parameter.');
      }
    }
  }

  /**
   * Close the session and clean up resources.
   */
  close(): void {
    this.context.close();
  }

  // ================== Session Management ==================

  /**
   * Save session to a dictionary.
   */
  saveSession(): Record<string, string> {
    if (!this.context.is_logged_in) {
      throw new LoginRequiredException('Login required.');
    }
    return this.context.saveSession();
  }

  /**
   * Load session from a dictionary.
   */
  loadSession(username: string, sessionData: Record<string, string>): void {
    this.context.loadSession(username, sessionData);
  }

  /**
   * Save session to file.
   */
  async saveSessionToFile(filename?: string): Promise<void> {
    if (!this.context.is_logged_in) {
      throw new LoginRequiredException('Login required.');
    }

    const targetFile = filename ?? getDefaultSessionFilename(this.context.username!);
    const dir = path.dirname(targetFile);

    if (dir !== '' && !fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true, mode: 0o700 });
    }

    const sessionData = this.saveSession();
    await fs.promises.writeFile(targetFile, JSON.stringify(sessionData), {
      mode: 0o600,
    });

    this.context.log(`Saved session to ${targetFile}.`);
  }

  /**
   * Load session from file.
   */
  async loadSessionFromFile(username: string, filename?: string): Promise<void> {
    let targetFile = filename ?? getDefaultSessionFilename(username);

    if (!fs.existsSync(targetFile)) {
      throw new Error(`Session file not found: ${targetFile}`);
    }

    const content = await fs.promises.readFile(targetFile, 'utf-8');
    const sessionData = JSON.parse(content) as Record<string, string>;
    this.loadSession(username, sessionData);

    this.context.log(`Loaded session from ${targetFile}.`);
  }

  /**
   * Test if the current session is valid.
   * Returns the username if logged in, null otherwise.
   */
  async testLogin(): Promise<string | null> {
    return this.context.testLogin();
  }

  /**
   * Login with username and password.
   */
  async login(user: string, passwd: string): Promise<void> {
    await this.context.login(user, passwd);
  }

  /**
   * Complete two-factor authentication.
   */
  async twoFactorLogin(twoFactorCode: string): Promise<void> {
    await this.context.twoFactorLogin(twoFactorCode);
  }

  // ================== Download Methods ==================

  /**
   * Download a picture or video from a URL.
   *
   * @param filename - Base filename (without extension)
   * @param url - URL to download from
   * @param mtime - Modification time to set on the file
   * @param filenameSuffix - Optional suffix to add before extension
   * @returns True if file was downloaded, false if it already existed
   */
  async downloadPic(
    filename: string,
    url: string,
    mtime: Date,
    filenameSuffix?: string
  ): Promise<boolean> {
    if (filenameSuffix) {
      filename += '_' + filenameSuffix;
    }

    // Extract file extension from URL
    const urlMatch = url.match(/\.([a-z0-9]+)\?/i);
    const fileExtension = urlMatch ? urlMatch[1]! : url.slice(-3);
    const nominalFilename = `${filename}.${fileExtension}`;

    // Check if file already exists
    if (fs.existsSync(nominalFilename)) {
      this.context.log(`${nominalFilename} exists`, false);
      return false;
    }

    // Fetch the file
    const response = await fetch(url, {
      headers: {
        'User-Agent': this.context.userAgent,
      },
    });

    if (!response.ok) {
      throw new ConnectionException(`Failed to download: ${response.status} ${response.statusText}`);
    }

    // Determine final filename from Content-Type if available
    let finalFilename = nominalFilename;
    const contentType = response.headers.get('Content-Type');
    if (contentType) {
      let headerExtension = contentType.split(';')[0]!.split('/').pop()!.toLowerCase();
      if (headerExtension === 'jpeg') {
        headerExtension = 'jpg';
      }
      finalFilename = `${filename}.${headerExtension}`;
    }

    // Check if file with determined extension already exists
    if (finalFilename !== nominalFilename && fs.existsSync(finalFilename)) {
      this.context.log(`${finalFilename} exists`, false);
      return false;
    }

    // Ensure directory exists
    const dir = path.dirname(finalFilename);
    if (dir && !fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }

    // Write file
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.promises.writeFile(finalFilename, buffer);

    // Set modification time
    await fs.promises.utimes(finalFilename, new Date(), mtime);

    return true;
  }

  /**
   * Save metadata JSON for a structure.
   */
  async saveMetadataJson(
    filename: string,
    structure: Post | StoryItem | Profile
  ): Promise<void> {
    const jsonFilename = this.compressJson ? `${filename}.json.xz` : `${filename}.json`;

    const dir = path.dirname(jsonFilename);
    if (dir && !fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }

    const data = getJsonStructure(structure);
    const json = JSON.stringify(data, null, 2);

    if (this.compressJson) {
      // For now, just save uncompressed - xz compression requires additional dependency
      await fs.promises.writeFile(jsonFilename.replace('.xz', ''), json);
    } else {
      await fs.promises.writeFile(jsonFilename, json);
    }

    if (structure instanceof Post || structure instanceof StoryItem) {
      this.context.log('json', false);
    }
  }

  /**
   * Save caption to a text file.
   */
  async saveCaption(filename: string, mtime: Date, caption: string): Promise<void> {
    const txtFilename = `${filename}.txt`;
    const content = caption + '\n';

    // Check if file exists and has same content
    if (fs.existsSync(txtFilename)) {
      const existing = await fs.promises.readFile(txtFilename, 'utf-8');
      if (existing.replace(/\r\n/g, '\n') === content.replace(/\r\n/g, '\n')) {
        this.context.log('txt unchanged', false);
        return;
      }
      this.context.log('txt updated', false);
    } else {
      const preview = caption.replace(/\n/g, ' ').trim();
      const ellipsified = preview.length > 31 ? `[${preview.slice(0, 29)}…]` : `[${preview}]`;
      this.context.log(ellipsified, false);
    }

    const dir = path.dirname(txtFilename);
    if (dir && !fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }

    await fs.promises.writeFile(txtFilename, content, 'utf-8');
    await fs.promises.utimes(txtFilename, new Date(), mtime);
  }

  /**
   * Download a single post.
   *
   * @param post - Post to download
   * @param target - Target directory name
   * @returns True if something was downloaded
   */
  async downloadPost(post: Post, target: string): Promise<boolean> {
    const dirname = formatFilename(this.dirnamePattern, post, target, this.sanitizePaths);
    const filename = path.join(
      dirname,
      formatFilename(this.filenamePattern, post, target, this.sanitizePaths)
    );

    let downloaded = false;

    // Download picture(s)
    if (this.downloadPictures) {
      if (post.typename === 'GraphSidecar') {
        // Sidecar post with multiple items
        const sidecarNodes = post.getSidecarNodes();
        let index = 0;
        for await (const node of sidecarNodes) {
          // Apply slide filter
          if (this.slideStart >= 0) {
            if (index < this.slideStart) {
              index++;
              continue;
            }
            if (this.slideEnd >= 0 && index > this.slideEnd) {
              break;
            }
          }

          if (node.is_video) {
            if (this.downloadVideos && node.video_url) {
              const dl = await this.downloadPic(filename, node.video_url, post.date_utc, `${index + 1}`);
              downloaded = downloaded || dl;
            }
          } else if (node.display_url) {
            const dl = await this.downloadPic(filename, node.display_url, post.date_utc, `${index + 1}`);
            downloaded = downloaded || dl;
          }
          index++;
        }
      } else if (post.is_video) {
        // Video post
        if (this.downloadVideos) {
          const videoUrl = post.video_url;
          if (videoUrl) {
            const dl = await this.downloadPic(filename, videoUrl, post.date_utc);
            downloaded = downloaded || dl;
          }
        }
        if (this.downloadVideoThumbnails && post.url) {
          await this.downloadPic(filename, post.url, post.date_utc, 'thumb');
        }
      } else {
        // Regular image post
        if (post.url) {
          const dl = await this.downloadPic(filename, post.url, post.date_utc);
          downloaded = downloaded || dl;
        }
      }
    }

    // Save metadata
    if (this.saveMetadata) {
      await this.saveMetadataJson(filename, post);
    }

    // Save caption
    if (this.postMetadataTxtPattern && post.caption) {
      await this.saveCaption(filename, post.date_utc, post.caption);
    }

    this.context.log('');
    return downloaded;
  }

  /**
   * Download posts from an iterator.
   *
   * @param posts - Iterator of posts
   * @param target - Target directory name
   * @param options - Download options
   */
  async downloadPosts(
    posts: AsyncIterable<Post>,
    target: string,
    options: {
      fastUpdate?: boolean;
      postFilter?: (post: Post) => boolean;
      maxCount?: number;
      totalCount?: number;
      ownerProfile?: Profile;
      possiblyPinned?: number;
    } = {}
  ): Promise<void> {
    const {
      fastUpdate = false,
      postFilter,
      maxCount,
      totalCount,
      // ownerProfile is reserved for future use (resume file naming)
      possiblyPinned = 0,
    } = options;

    const displayedCount = maxCount !== undefined && (totalCount === undefined || maxCount < totalCount)
      ? maxCount
      : totalCount;

    let number = 0;
    for await (const post of posts) {
      number++;

      if (maxCount !== undefined && number > maxCount) {
        break;
      }

      // Log progress
      if (displayedCount !== undefined) {
        const width = displayedCount.toString().length;
        this.context.log(`[${number.toString().padStart(width)}/${displayedCount.toString().padStart(width)}] `, false);
      } else {
        this.context.log(`[${number.toString().padStart(3)}] `, false);
      }

      // Apply filter
      if (postFilter) {
        try {
          if (!postFilter(post)) {
            this.context.log(`${post} skipped`);
            continue;
          }
        } catch (err) {
          this.context.error(`${post} skipped. Filter evaluation failed: ${err}`);
          continue;
        }
      }

      // Download
      try {
        const downloaded = await this.downloadPost(post, target);

        if (fastUpdate && !downloaded && number > possiblyPinned) {
          break;
        }
      } catch (err) {
        if (err instanceof PostChangedException) {
          // Post changed during download, skip
          continue;
        }
        this.context.error(`Download ${post} of ${target}: ${err}`);
      }
    }
  }

  /**
   * Download a profile's posts.
   */
  async downloadProfile(
    profile: Profile,
    options: {
      fastUpdate?: boolean;
      postFilter?: (post: Post) => boolean;
      maxCount?: number;
      downloadProfilePic?: boolean;
      downloadStories?: boolean;
      downloadHighlights?: boolean;
    } = {}
  ): Promise<void> {
    const {
      fastUpdate = false,
      postFilter,
      maxCount,
      downloadProfilePic = true,
      downloadStories = false,
      downloadHighlights = false,
    } = options;

    const target = profile.username.toLowerCase();
    this.context.log(`Downloading profile ${target}...`);

    // Download profile picture
    if (downloadProfilePic) {
      await this.downloadProfilePic(profile);
    }

    // TODO: Download posts requires Profile.getPosts() which uses NodeIterator
    // This will be implemented when we add getPosts() to Profile class
    if (maxCount !== undefined || postFilter !== undefined || fastUpdate) {
      this.context.log('Note: Post downloading requires getPosts() method on Profile - not yet implemented');
    }

    // Download stories (requires login)
    if (downloadStories && this.context.is_logged_in) {
      this.context.log(`Downloading stories of ${target}...`);
      // TODO: Stories implementation
    }

    // Download highlights (requires login)
    if (downloadHighlights && this.context.is_logged_in) {
      this.context.log(`Downloading highlights of ${target}...`);
      // TODO: Highlights implementation
    }
  }

  /**
   * Download a profile's profile picture.
   */
  async downloadProfilePic(profile: Profile): Promise<void> {
    const url = await profile.getProfilePicUrl();
    if (!url) return;

    const dirname = formatFilename(this.dirnamePattern, profile, profile.username.toLowerCase(), this.sanitizePaths);
    const filename = path.join(dirname, `${profile.username.toLowerCase()}_profile_pic`);

    await this.downloadPic(filename, url, new Date());
    this.context.log('');
  }

  /**
   * Download posts for a hashtag.
   * Note: This requires Hashtag.getPosts() which is not yet implemented.
   */
  async downloadHashtag(
    hashtag: Hashtag,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options: {
      maxCount?: number;
      postFilter?: (post: Post) => boolean;
    } = {}
  ): Promise<void> {
    const target = `#${hashtag.name}`;
    this.context.log(`Downloading hashtag ${target}...`);

    // TODO: Implement when Hashtag.getPosts() is available
    this.context.log('Note: Post downloading requires getPosts() method on Hashtag - not yet implemented');
  }

  /**
   * Get a profile by username.
   */
  async getProfile(username: string): Promise<Profile> {
    return Profile.fromUsername(this.context, username);
  }

  /**
   * Get a post by shortcode.
   */
  async getPost(shortcode: string): Promise<Post> {
    return Post.fromShortcode(this.context, shortcode);
  }

  /**
   * Get a hashtag by name.
   */
  async getHashtag(name: string): Promise<Hashtag> {
    return Hashtag.fromName(this.context, name);
  }
}
