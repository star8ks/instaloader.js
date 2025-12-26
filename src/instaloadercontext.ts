/**
 * InstaloaderContext - HTTP client and low-level communication with Instagram.
 * Ported from Python instaloader/instaloadercontext.py
 */

import { CookieJar, Cookie } from 'tough-cookie';
import { v4 as uuidv4 } from 'uuid';
import {
  AbortDownloadException,
  BadCredentialsException,
  ConnectionException,
  InvalidArgumentException,
  LoginException,
  LoginRequiredException,
  QueryReturnedBadRequestException,
  QueryReturnedForbiddenException,
  QueryReturnedNotFoundException,
  TooManyRequestsException,
  TwoFactorAuthRequiredException,
} from './exceptions';
import type { JsonObject, CookieData, HttpHeaders } from './types';
import type { TwoFactorInfo } from './exceptions';

// =============================================================================
// Helper functions
// =============================================================================

/**
 * Returns default user agent string.
 */
export function defaultUserAgent(): string {
  return (
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
  );
}

/**
 * Returns default iPhone headers for API requests.
 */
export function defaultIphoneHeaders(): HttpHeaders {
  const timezoneOffset = new Date().getTimezoneOffset() * -60;
  return {
    'User-Agent':
      'Instagram 361.0.0.35.82 (iPad13,8; iOS 18_0; en_US; en-US; ' +
      'scale=2.00; 2048x2732; 674117118) AppleWebKit/420+',
    'x-ads-opt-out': '1',
    'x-bloks-is-panorama-enabled': 'true',
    'x-bloks-version-id':
      '16b7bd25c6c06886d57c4d455265669345a2d96625385b8ee30026ac2dc5ed97',
    'x-fb-client-ip': 'True',
    'x-fb-connection-type': 'wifi',
    'x-fb-http-engine': 'Liger',
    'x-fb-server-cluster': 'True',
    'x-fb': '1',
    'x-ig-abr-connection-speed-kbps': '2',
    'x-ig-app-id': '124024574287414',
    'x-ig-app-locale': 'en-US',
    'x-ig-app-startup-country': 'US',
    'x-ig-bandwidth-speed-kbps': '0.000',
    'x-ig-capabilities': '36r/F/8=',
    'x-ig-connection-speed': `${Math.floor(Math.random() * 19000) + 1000}kbps`,
    'x-ig-connection-type': 'WiFi',
    'x-ig-device-locale': 'en-US',
    'x-ig-mapped-locale': 'en-US',
    'x-ig-timezone-offset': String(timezoneOffset),
    'x-ig-www-claim': '0',
    'x-pigeon-session-id': uuidv4(),
    'x-tigon-is-retry': 'False',
    'x-whatsapp': '0',
  };
}

/**
 * Sleep for given milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Exponential random variate (for sleep timing).
 */
function exponentialVariate(lambda: number): number {
  return -Math.log(1 - Math.random()) / lambda;
}

// =============================================================================
// RateController class
// =============================================================================

/**
 * Class providing request tracking and rate controlling to stay within rate limits.
 */
export class RateController {
  protected _context: InstaloaderContext;
  protected _queryTimestamps: Map<string, number[]> = new Map();
  protected _earliestNextRequestTime = 0;
  protected _iphoneEarliestNextRequestTime = 0;

  constructor(context: InstaloaderContext) {
    this._context = context;
  }

  /**
   * Wait given number of seconds.
   */
  async sleep(secs: number): Promise<void> {
    await sleep(secs * 1000);
  }

  /**
   * Return how many requests of the given type can be done within a sliding window of 11 minutes.
   */
  countPerSlidingWindow(queryType: string): number {
    return queryType === 'other' ? 75 : 200;
  }

  private _reqsInSlidingWindow(
    queryType: string | null,
    currentTime: number,
    window: number
  ): number[] {
    if (queryType !== null) {
      const timestamps = this._queryTimestamps.get(queryType) || [];
      return timestamps.filter((t) => t > currentTime - window);
    } else {
      // All GraphQL queries (not 'iphone' or 'other')
      const allTimestamps: number[] = [];
      for (const [type, times] of this._queryTimestamps) {
        if (type !== 'iphone' && type !== 'other') {
          allTimestamps.push(...times.filter((t) => t > currentTime - window));
        }
      }
      return allTimestamps;
    }
  }

  /**
   * Calculate time needed to wait before query can be executed.
   */
  queryWaittime(
    queryType: string,
    currentTime: number,
    untrackedQueries = false
  ): number {
    const perTypeSlidingWindow = 660;
    const iphoneSlidingWindow = 1800;

    if (!this._queryTimestamps.has(queryType)) {
      this._queryTimestamps.set(queryType, []);
    }

    // Clean up old timestamps (older than 1 hour)
    const timestamps = this._queryTimestamps.get(queryType)!;
    const filteredTimestamps = timestamps.filter(
      (t) => t > currentTime - 60 * 60
    );
    this._queryTimestamps.set(queryType, filteredTimestamps);

    const perTypeNextRequestTime = (): number => {
      const reqs = this._reqsInSlidingWindow(
        queryType,
        currentTime,
        perTypeSlidingWindow
      );
      if (reqs.length < this.countPerSlidingWindow(queryType)) {
        return 0;
      } else {
        return Math.min(...reqs) + perTypeSlidingWindow + 6;
      }
    };

    const gqlAccumulatedNextRequestTime = (): number => {
      if (queryType === 'iphone' || queryType === 'other') {
        return 0;
      }
      const gqlAccumulatedSlidingWindow = 600;
      const gqlAccumulatedMaxCount = 275;
      const reqs = this._reqsInSlidingWindow(
        null,
        currentTime,
        gqlAccumulatedSlidingWindow
      );
      if (reqs.length < gqlAccumulatedMaxCount) {
        return 0;
      } else {
        return Math.min(...reqs) + gqlAccumulatedSlidingWindow;
      }
    };

    const untrackedNextRequestTime = (): number => {
      if (untrackedQueries) {
        if (queryType === 'iphone') {
          const reqs = this._reqsInSlidingWindow(
            queryType,
            currentTime,
            iphoneSlidingWindow
          );
          this._iphoneEarliestNextRequestTime =
            Math.min(...reqs) + iphoneSlidingWindow + 18;
        } else {
          const reqs = this._reqsInSlidingWindow(
            queryType,
            currentTime,
            perTypeSlidingWindow
          );
          this._earliestNextRequestTime =
            Math.min(...reqs) + perTypeSlidingWindow + 6;
        }
      }
      return Math.max(
        this._iphoneEarliestNextRequestTime,
        this._earliestNextRequestTime
      );
    };

    const iphoneNextRequest = (): number => {
      if (queryType === 'iphone') {
        const reqs = this._reqsInSlidingWindow(
          queryType,
          currentTime,
          iphoneSlidingWindow
        );
        if (reqs.length >= 199) {
          return Math.min(...reqs) + iphoneSlidingWindow + 18;
        }
      }
      return 0;
    };

    return Math.max(
      0,
      Math.max(
        perTypeNextRequestTime(),
        gqlAccumulatedNextRequestTime(),
        untrackedNextRequestTime(),
        iphoneNextRequest()
      ) - currentTime
    );
  }

  /**
   * Called before a query to Instagram.
   */
  async waitBeforeQuery(queryType: string): Promise<void> {
    const currentTime = Date.now() / 1000;
    const waittime = this.queryWaittime(queryType, currentTime, false);

    if (waittime > 15) {
      const formattedWaittime =
        waittime <= 666
          ? `${Math.round(waittime)} seconds`
          : `${Math.round(waittime / 60)} minutes`;
      const resumeTime = new Date(Date.now() + waittime * 1000);
      this._context.log(
        `\nToo many queries in the last time. Need to wait ${formattedWaittime}, until ${resumeTime.toLocaleTimeString()}.`
      );
    }

    if (waittime > 0) {
      await this.sleep(waittime);
    }

    if (!this._queryTimestamps.has(queryType)) {
      this._queryTimestamps.set(queryType, [Date.now() / 1000]);
    } else {
      this._queryTimestamps.get(queryType)!.push(Date.now() / 1000);
    }
  }

  /**
   * Handle a 429 Too Many Requests response.
   */
  async handle429(queryType: string): Promise<void> {
    const currentTime = Date.now() / 1000;
    const waittime = this.queryWaittime(queryType, currentTime, true);

    const text429 =
      'Instagram responded with HTTP error "429 - Too Many Requests". Please do not run multiple ' +
      'instances of Instaloader in parallel or within short sequence. Also, do not use any Instagram ' +
      'App while Instaloader is running.';
    this._context.error(text429);

    if (waittime > 1.5) {
      const formattedWaittime =
        waittime <= 666
          ? `${Math.round(waittime)} seconds`
          : `${Math.round(waittime / 60)} minutes`;
      const resumeTime = new Date(Date.now() + waittime * 1000);
      this._context.error(
        `The request will be retried in ${formattedWaittime}, at ${resumeTime.toLocaleTimeString()}.`
      );
    }

    if (waittime > 0) {
      await this.sleep(waittime);
    }
  }
}

// =============================================================================
// InstaloaderContext options
// =============================================================================

export interface InstaloaderContextOptions {
  /** Whether to sleep between requests (default: true) */
  sleep?: boolean;
  /** Whether to suppress output (default: false) */
  quiet?: boolean;
  /** Custom user agent string */
  userAgent?: string;
  /** Maximum connection retry attempts (default: 3) */
  maxConnectionAttempts?: number;
  /** Request timeout in milliseconds (default: 300000) */
  requestTimeout?: number;
  /** Custom rate controller factory */
  rateController?: (ctx: InstaloaderContext) => RateController;
  /** HTTP status codes that should cause an AbortDownloadException */
  fatalStatusCodes?: number[];
  /** Whether to enable iPhone API support (default: true) */
  iphoneSupport?: boolean;
}

// =============================================================================
// InstaloaderContext class
// =============================================================================

/**
 * Class providing methods for logging and low-level communication with Instagram.
 *
 * It provides low-level communication routines getJson(), graphqlQuery(), getIphoneJson()
 * and implements mechanisms for rate controlling and error handling.
 *
 * Further, it provides methods for logging in and general session handles.
 */
export class InstaloaderContext {
  readonly userAgent: string;
  readonly requestTimeout: number;
  readonly maxConnectionAttempts: number;
  readonly sleep: boolean;
  readonly quiet: boolean;
  readonly iphoneSupport: boolean;
  readonly fatalStatusCodes: number[];

  private _cookieJar: CookieJar;
  private _csrfToken: string | null = null;
  private _username: string | null = null;
  private _userId: string | null = null;
  private _iphoneHeaders: HttpHeaders;
  private _rateController: RateController;
  private _errorLog: string[] = [];
  private _twoFactorAuthPending: {
    csrfToken: string;
    cookies: CookieData;
    username: string;
    twoFactorId: string;
  } | null = null;

  /** Raise all errors instead of catching them (for testing) */
  raiseAllErrors = false;

  /** Cache profile from id (mapping from id to Profile) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly profile_id_cache: Map<number, any> = new Map();

  constructor(options: InstaloaderContextOptions = {}) {
    this.userAgent = options.userAgent ?? defaultUserAgent();
    this.requestTimeout = options.requestTimeout ?? 300000;
    this.maxConnectionAttempts = options.maxConnectionAttempts ?? 3;
    this.sleep = options.sleep ?? true;
    this.quiet = options.quiet ?? false;
    this.iphoneSupport = options.iphoneSupport ?? true;
    this.fatalStatusCodes = options.fatalStatusCodes ?? [];

    this._cookieJar = new CookieJar();
    this._iphoneHeaders = defaultIphoneHeaders();

    // Initialize anonymous session cookies
    this._initAnonymousCookies();

    this._rateController = options.rateController
      ? options.rateController(this)
      : new RateController(this);
  }

  private _initAnonymousCookies(): void {
    const domain = 'www.instagram.com';
    const defaultCookies = {
      sessionid: '',
      mid: '',
      ig_pr: '1',
      ig_vw: '1920',
      csrftoken: '',
      s_network: '',
      ds_user_id: '',
    };

    for (const [name, value] of Object.entries(defaultCookies)) {
      const cookie = new Cookie({
        key: name,
        value,
        domain,
        path: '/',
      });
      this._cookieJar.setCookieSync(cookie, `https://${domain}/`);
    }
  }

  /** True if this instance is logged in. */
  get is_logged_in(): boolean {
    return this._username !== null;
  }

  /** The username of the logged-in user, or null. */
  get username(): string | null {
    return this._username;
  }

  /** The user ID of the logged-in user, or null. */
  get userId(): string | null {
    return this._userId;
  }

  /** iPhone headers for API requests. */
  get iphone_headers(): HttpHeaders {
    return this._iphoneHeaders;
  }

  /** Whether any error has been reported and stored. */
  get hasStoredErrors(): boolean {
    return this._errorLog.length > 0;
  }

  /**
   * Log a message to stdout (can be suppressed with quiet option).
   * @param message - The message to log
   * @param newline - Whether to add a newline (default true, false for inline messages)
   */
  log(message: string, newline = true): void {
    if (!this.quiet) {
      if (newline) {
        console.log(message);
      } else {
        process.stdout.write(message);
      }
    }
  }

  /**
   * Log a non-fatal error message to stderr.
   */
  error(message: string, repeatAtEnd = true): void {
    console.error(message);
    if (repeatAtEnd) {
      this._errorLog.push(message);
    }
  }

  /**
   * Close the context and print any stored errors.
   */
  close(): void {
    if (this._errorLog.length > 0 && !this.quiet) {
      console.error('\nErrors or warnings occurred:');
      for (const err of this._errorLog) {
        console.error(err);
      }
    }
  }

  /**
   * Returns default HTTP headers for requests.
   */
  private _defaultHttpHeader(emptySessionOnly = false): HttpHeaders {
    const header: HttpHeaders = {
      'Accept-Encoding': 'gzip, deflate',
      'Accept-Language': 'en-US,en;q=0.8',
      Connection: 'keep-alive',
      'Content-Length': '0',
      Host: 'www.instagram.com',
      Origin: 'https://www.instagram.com',
      Referer: 'https://www.instagram.com/',
      'User-Agent': this.userAgent,
      'X-Instagram-AJAX': '1',
      'X-Requested-With': 'XMLHttpRequest',
    };

    if (emptySessionOnly) {
      delete header['Host'];
      delete header['Origin'];
      delete header['X-Instagram-AJAX'];
      delete header['X-Requested-With'];
    }

    return header;
  }

  /**
   * Sleep a short time if sleep is enabled.
   */
  async doSleep(): Promise<void> {
    if (this.sleep) {
      const sleepTime = Math.min(exponentialVariate(0.6), 15.0);
      await sleep(sleepTime * 1000);
    }
  }

  /**
   * Get cookies as a plain object.
   */
  getCookies(url = 'https://www.instagram.com/'): CookieData {
    const cookies = this._cookieJar.getCookiesSync(url);
    const result: CookieData = {};
    for (const cookie of cookies) {
      result[cookie.key] = cookie.value;
    }
    return result;
  }

  /**
   * Set cookies from a plain object.
   */
  setCookies(cookies: CookieData, url = 'https://www.instagram.com/'): void {
    const domain = new URL(url).hostname;
    for (const [name, value] of Object.entries(cookies)) {
      const cookie = new Cookie({
        key: name,
        value,
        domain,
        path: '/',
      });
      this._cookieJar.setCookieSync(cookie, url);
    }
  }

  /**
   * Save session data for later restoration.
   */
  saveSession(): CookieData {
    return this.getCookies();
  }

  /**
   * Load session data from a saved session.
   */
  loadSession(username: string, sessionData: CookieData): void {
    this._cookieJar = new CookieJar();
    this.setCookies(sessionData);
    this._csrfToken = sessionData['csrftoken'] || null;
    this._username = username;
    this._userId = sessionData['ds_user_id'] || null;
  }

  /**
   * Update cookies with new values.
   */
  updateCookies(cookies: CookieData): void {
    this.setCookies(cookies);
  }

  /**
   * Build cookie header string from cookie jar.
   */
  private _getCookieHeader(url: string): string {
    const cookies = this._cookieJar.getCookiesSync(url);
    return cookies.map((c) => `${c.key}=${c.value}`).join('; ');
  }

  /**
   * Parse and store cookies from Set-Cookie headers.
   */
  private _storeCookies(url: string, headers: Headers): void {
    const setCookies = headers.getSetCookie?.() || [];
    for (const cookieStr of setCookies) {
      try {
        const cookie = Cookie.parse(cookieStr);
        if (cookie) {
          this._cookieJar.setCookieSync(cookie, url);
        }
      } catch {
        // Ignore invalid cookies
      }
    }
  }

  /**
   * Format response error message.
   */
  private _responseError(
    status: number,
    statusText: string,
    url: string,
    respJson?: JsonObject
  ): string {
    let extraFromJson: string | null = null;
    if (respJson && 'status' in respJson) {
      if ('message' in respJson) {
        extraFromJson = `"${respJson['status']}" status, message "${respJson['message']}"`;
      } else {
        extraFromJson = `"${respJson['status']}" status`;
      }
    }
    return `${status} ${statusText}${extraFromJson ? ` - ${extraFromJson}` : ''} when accessing ${url}`;
  }

  /**
   * Make a JSON request to Instagram.
   */
  async getJson(
    path: string,
    params: JsonObject,
    options: {
      host?: string;
      usePost?: boolean;
      attempt?: number;
      headers?: HttpHeaders;
    } = {}
  ): Promise<JsonObject> {
    const {
      host = 'www.instagram.com',
      usePost = false,
      attempt = 1,
      headers: extraHeaders,
    } = options;

    const isGraphqlQuery = 'query_hash' in params && path.includes('graphql/query');
    const isDocIdQuery = 'doc_id' in params && path.includes('graphql/query');
    const isIphoneQuery = host === 'i.instagram.com';
    const isOtherQuery = !isGraphqlQuery && !isDocIdQuery && host === 'www.instagram.com';

    try {
      await this.doSleep();

      // Rate limiting
      if (isGraphqlQuery) {
        await this._rateController.waitBeforeQuery(params['query_hash'] as string);
      }
      if (isDocIdQuery) {
        await this._rateController.waitBeforeQuery(params['doc_id'] as string);
      }
      if (isIphoneQuery) {
        await this._rateController.waitBeforeQuery('iphone');
      }
      if (isOtherQuery) {
        await this._rateController.waitBeforeQuery('other');
      }

      const url = new URL(`https://${host}/${path}`);
      const headers: HttpHeaders = {
        ...this._defaultHttpHeader(true),
        Cookie: this._getCookieHeader(url.toString()),
        ...extraHeaders,
      };

      if (this._csrfToken) {
        headers['X-CSRFToken'] = this._csrfToken;
      }

      let response: Response;
      if (usePost) {
        const body = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
          body.append(key, typeof value === 'string' ? value : JSON.stringify(value));
        }
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        delete headers['Content-Length'];

        response = await fetch(url.toString(), {
          method: 'POST',
          headers,
          body,
          redirect: 'manual',
          signal: AbortSignal.timeout(this.requestTimeout),
        });
      } else {
        for (const [key, value] of Object.entries(params)) {
          url.searchParams.set(
            key,
            typeof value === 'string' ? value : JSON.stringify(value)
          );
        }
        response = await fetch(url.toString(), {
          method: 'GET',
          headers,
          redirect: 'manual',
          signal: AbortSignal.timeout(this.requestTimeout),
        });
      }

      this._storeCookies(url.toString(), response.headers);

      // Handle fatal status codes
      if (this.fatalStatusCodes.includes(response.status)) {
        const redirect = response.headers.get('location')
          ? ` redirect to ${response.headers.get('location')}`
          : '';
        throw new AbortDownloadException(
          `Query to ${url} responded with "${response.status} ${response.statusText}"${redirect}`
        );
      }

      // Handle redirects
      if (response.status >= 300 && response.status < 400) {
        const redirectUrl = response.headers.get('location');
        if (redirectUrl) {
          this.log(`\nHTTP redirect from ${url} to ${redirectUrl}`);
          if (
            redirectUrl.startsWith('https://www.instagram.com/accounts/login') ||
            redirectUrl.startsWith('https://i.instagram.com/accounts/login')
          ) {
            if (!this.is_logged_in) {
              throw new LoginRequiredException(
                'Redirected to login page. Use login() first.'
              );
            }
            throw new AbortDownloadException(
              "Redirected to login page. You've been logged out, please wait some time, recreate the session and try again"
            );
          }
        }
      }

      // Handle error status codes
      if (response.status === 400) {
        let respJson: JsonObject | undefined;
        try {
          respJson = (await response.json()) as JsonObject;
          const message = respJson['message'] as string | undefined;
          if (
            message === 'feedback_required' ||
            message === 'checkpoint_required' ||
            message === 'challenge_required'
          ) {
            throw new AbortDownloadException(
              this._responseError(response.status, response.statusText, url.toString(), respJson)
            );
          }
        } catch (e) {
          if (e instanceof AbortDownloadException) throw e;
        }
        throw new QueryReturnedBadRequestException(
          this._responseError(response.status, response.statusText, url.toString(), respJson)
        );
      }

      if (response.status === 404) {
        throw new QueryReturnedNotFoundException(
          this._responseError(response.status, response.statusText, url.toString())
        );
      }

      if (response.status === 429) {
        throw new TooManyRequestsException(
          this._responseError(response.status, response.statusText, url.toString())
        );
      }

      if (response.status !== 200) {
        throw new ConnectionException(
          this._responseError(response.status, response.statusText, url.toString())
        );
      }

      const respJson = (await response.json()) as JsonObject;

      if ('status' in respJson && respJson['status'] !== 'ok') {
        throw new ConnectionException(
          this._responseError(response.status, response.statusText, url.toString(), respJson)
        );
      }

      return respJson;
    } catch (err) {
      const errorString = `JSON Query to ${path}: ${err}`;

      if (attempt >= this.maxConnectionAttempts) {
        if (err instanceof QueryReturnedNotFoundException) {
          throw new QueryReturnedNotFoundException(errorString);
        }
        throw new ConnectionException(errorString);
      }

      this.error(`${errorString} [retrying]`, false);

      if (err instanceof TooManyRequestsException) {
        if (isGraphqlQuery) {
          await this._rateController.handle429(params['query_hash'] as string);
        }
        if (isDocIdQuery) {
          await this._rateController.handle429(params['doc_id'] as string);
        }
        if (isIphoneQuery) {
          await this._rateController.handle429('iphone');
        }
        if (isOtherQuery) {
          await this._rateController.handle429('other');
        }
      }

      return this.getJson(path, params, {
        host,
        usePost,
        attempt: attempt + 1,
        ...(extraHeaders !== undefined && { headers: extraHeaders }),
      });
    }
  }

  /**
   * Do a GraphQL Query.
   */
  async graphql_query(
    queryHash: string,
    variables: JsonObject,
    referer?: string
  ): Promise<JsonObject> {
    const headers: HttpHeaders = {
      ...this._defaultHttpHeader(true),
      authority: 'www.instagram.com',
      scheme: 'https',
      accept: '*/*',
    };

    delete headers['Connection'];
    delete headers['Content-Length'];

    if (referer) {
      headers['referer'] = encodeURIComponent(referer);
    }

    const variablesJson = JSON.stringify(variables);

    const respJson = await this.getJson(
      'graphql/query',
      { query_hash: queryHash, variables: variablesJson },
      { headers }
    );

    if (!('status' in respJson)) {
      this.error('GraphQL response did not contain a "status" field.');
    }

    return respJson;
  }

  /**
   * Do a doc_id-based GraphQL Query using POST.
   */
  async doc_id_graphql_query(
    docId: string,
    variables: JsonObject,
    referer?: string
  ): Promise<JsonObject> {
    const headers: HttpHeaders = {
      ...this._defaultHttpHeader(true),
      authority: 'www.instagram.com',
      scheme: 'https',
      accept: '*/*',
    };

    delete headers['Connection'];
    delete headers['Content-Length'];

    if (referer) {
      headers['referer'] = encodeURIComponent(referer);
    }

    const variablesJson = JSON.stringify(variables);

    const respJson = await this.getJson(
      'graphql/query',
      { variables: variablesJson, doc_id: docId, server_timestamps: 'true' },
      { usePost: true, headers }
    );

    if (!('status' in respJson)) {
      this.error('GraphQL response did not contain a "status" field.');
    }

    return respJson;
  }

  /**
   * JSON request to i.instagram.com.
   */
  async get_iphone_json(path: string, params: JsonObject): Promise<JsonObject> {
    const headers: HttpHeaders = {
      ...this._iphoneHeaders,
      'ig-intended-user-id': this._userId || '',
      'x-pigeon-rawclienttime': (Date.now() / 1000).toFixed(6),
    };

    // Map cookies to headers
    const cookies = this.getCookies('https://i.instagram.com/');
    const headerCookiesMapping: Record<string, string> = {
      'x-mid': 'mid',
      'ig-u-ds-user-id': 'ds_user_id',
      'x-ig-device-id': 'ig_did',
      'x-ig-family-device-id': 'ig_did',
      family_device_id: 'ig_did',
    };

    for (const [headerKey, cookieKey] of Object.entries(headerCookiesMapping)) {
      if (cookieKey in cookies && !(headerKey in headers)) {
        headers[headerKey] = cookies[cookieKey]!;
      }
    }

    // Handle rur cookie specially
    if ('rur' in cookies && !('ig-u-rur' in headers)) {
      const rurValue = cookies['rur']!;
      headers['ig-u-rur'] = rurValue.replace(/^"|"$/g, '');
    }

    const response = await this.getJson(path, params, {
      host: 'i.instagram.com',
      headers,
    });

    return response;
  }

  /**
   * HEAD a URL anonymously.
   */
  async head(
    url: string,
    options: { allowRedirects?: boolean } = {}
  ): Promise<{ headers: Map<string, string> }> {
    const { allowRedirects = false } = options;

    const response = await fetch(url, {
      method: 'HEAD',
      redirect: allowRedirects ? 'follow' : 'manual',
      headers: {
        'User-Agent': this.userAgent,
      },
      signal: AbortSignal.timeout(this.requestTimeout),
    });

    if (response.status === 200 || (response.status >= 300 && response.status < 400)) {
      const headers = new Map<string, string>();
      response.headers.forEach((value, key) => {
        headers.set(key, value);
      });
      return { headers };
    }

    if (response.status === 403) {
      throw new QueryReturnedForbiddenException(
        this._responseError(response.status, response.statusText, url)
      );
    }

    if (response.status === 404) {
      throw new QueryReturnedNotFoundException(
        this._responseError(response.status, response.statusText, url)
      );
    }

    throw new ConnectionException(
      this._responseError(response.status, response.statusText, url)
    );
  }

  /**
   * Test if logged in by querying the current user.
   */
  async testLogin(): Promise<string | null> {
    try {
      const data = await this.graphql_query('d6f4427fbe92d846298cf93df0b937d3', {});
      const userData = (data['data'] as JsonObject)?.['user'] as JsonObject | null;
      return userData ? (userData['username'] as string) : null;
    } catch (err) {
      if (err instanceof AbortDownloadException || err instanceof ConnectionException) {
        this.error(`Error when checking if logged in: ${err}`);
        return null;
      }
      throw err;
    }
  }

  /**
   * Login to Instagram.
   */
  async login(username: string, password: string): Promise<void> {
    // Initialize a fresh cookie jar
    this._cookieJar = new CookieJar();
    this._initAnonymousCookies();

    // Make a request to get csrftoken
    const initUrl = 'https://www.instagram.com/';
    const initResponse = await fetch(initUrl, {
      headers: {
        'User-Agent': this.userAgent,
        Cookie: this._getCookieHeader(initUrl),
      },
      signal: AbortSignal.timeout(this.requestTimeout),
    });

    this._storeCookies(initUrl, initResponse.headers);

    const cookies = this.getCookies();
    const csrfToken = cookies['csrftoken'];
    if (!csrfToken) {
      throw new LoginException('Failed to get CSRF token from Instagram.');
    }
    this._csrfToken = csrfToken;

    await this.doSleep();

    // Prepare login request
    const encPassword = `#PWD_INSTAGRAM_BROWSER:0:${Math.floor(Date.now() / 1000)}:${password}`;
    const loginUrl = 'https://www.instagram.com/api/v1/web/accounts/login/ajax/';

    const loginResponse = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'User-Agent': this.userAgent,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-CSRFToken': csrfToken,
        Cookie: this._getCookieHeader(loginUrl),
        Referer: 'https://www.instagram.com/',
      },
      body: new URLSearchParams({
        enc_password: encPassword,
        username,
      }),
      redirect: 'follow',
      signal: AbortSignal.timeout(this.requestTimeout),
    });

    this._storeCookies(loginUrl, loginResponse.headers);

    let respJson: JsonObject;
    try {
      respJson = (await loginResponse.json()) as JsonObject;
    } catch {
      throw new LoginException(
        `Login error: JSON decode fail, ${loginResponse.status} - ${loginResponse.statusText}.`
      );
    }

    if (respJson['two_factor_required']) {
      const twoFactorInfoResp = respJson['two_factor_info'] as JsonObject;
      const twoFactorId = twoFactorInfoResp['two_factor_identifier'] as string;
      this._twoFactorAuthPending = {
        csrfToken,
        cookies: this.getCookies(),
        username,
        twoFactorId,
      };
      const twoFactorInfo: TwoFactorInfo = {
        username,
        identifier: twoFactorId,
      };
      if (twoFactorInfoResp['obfuscated_phone_number'] !== undefined) {
        twoFactorInfo.obfuscatedPhoneNumber = twoFactorInfoResp['obfuscated_phone_number'] as string;
      }
      if (twoFactorInfoResp['show_messenger_code_option'] !== undefined) {
        twoFactorInfo.showMessengerCodeOption = twoFactorInfoResp['show_messenger_code_option'] as boolean;
      }
      if (twoFactorInfoResp['show_new_login_screen'] !== undefined) {
        twoFactorInfo.showNewLoginScreen = twoFactorInfoResp['show_new_login_screen'] as boolean;
      }
      if (twoFactorInfoResp['show_trusted_device_option'] !== undefined) {
        twoFactorInfo.showTrustedDeviceOption = twoFactorInfoResp['show_trusted_device_option'] as boolean;
      }
      if (twoFactorInfoResp['pending_trusted_notification_polling'] !== undefined) {
        twoFactorInfo.pendingTrustedNotificationPolling = twoFactorInfoResp['pending_trusted_notification_polling'] as boolean;
      }
      throw new TwoFactorAuthRequiredException(
        twoFactorInfo,
        'Login error: two-factor authentication required.'
      );
    }

    if (respJson['checkpoint_url']) {
      throw new LoginException(
        `Login: Checkpoint required. Point your browser to ${respJson['checkpoint_url']} - follow the instructions, then retry.`
      );
    }

    if (respJson['status'] !== 'ok') {
      const message = respJson['message'] as string | undefined;
      if (message) {
        throw new LoginException(
          `Login error: "${respJson['status']}" status, message "${message}".`
        );
      }
      throw new LoginException(`Login error: "${respJson['status']}" status.`);
    }

    if (!('authenticated' in respJson)) {
      const message = respJson['message'] as string | undefined;
      if (message) {
        throw new LoginException(`Login error: Unexpected response, "${message}".`);
      }
      throw new LoginException(
        'Login error: Unexpected response, this might indicate a blocked IP.'
      );
    }

    if (!respJson['authenticated']) {
      if (respJson['user']) {
        throw new BadCredentialsException('Login error: Wrong password.');
      }
      throw new LoginException(`Login error: User ${username} does not exist.`);
    }

    // Success - update session
    const newCookies = this.getCookies();
    this._csrfToken = newCookies['csrftoken'] || csrfToken;
    this._username = username;
    this._userId = (respJson['userId'] as string) || newCookies['ds_user_id'] || null;
  }

  /**
   * Second step of login if 2FA is enabled.
   */
  async twoFactorLogin(twoFactorCode: string): Promise<void> {
    if (!this._twoFactorAuthPending) {
      throw new InvalidArgumentException('No two-factor authentication pending.');
    }

    const { csrfToken, cookies, username, twoFactorId } = this._twoFactorAuthPending;

    // Restore cookies from 2FA pending state
    this._cookieJar = new CookieJar();
    this.setCookies(cookies);

    const loginUrl = 'https://www.instagram.com/accounts/login/ajax/two_factor/';

    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'User-Agent': this.userAgent,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-CSRFToken': csrfToken,
        Cookie: this._getCookieHeader(loginUrl),
        Referer: 'https://www.instagram.com/',
      },
      body: new URLSearchParams({
        username,
        verificationCode: twoFactorCode,
        identifier: twoFactorId,
      }),
      redirect: 'follow',
      signal: AbortSignal.timeout(this.requestTimeout),
    });

    this._storeCookies(loginUrl, response.headers);

    const respJson = (await response.json()) as JsonObject;

    if (respJson['status'] !== 'ok') {
      const message = respJson['message'] as string | undefined;
      if (message) {
        throw new BadCredentialsException(`2FA error: ${message}`);
      }
      throw new BadCredentialsException(`2FA error: "${respJson['status']}" status.`);
    }

    // Success
    const newCookies = this.getCookies();
    this._csrfToken = newCookies['csrftoken'] || csrfToken;
    this._username = username;
    this._userId = newCookies['ds_user_id'] || null;
    this._twoFactorAuthPending = null;
  }
}
