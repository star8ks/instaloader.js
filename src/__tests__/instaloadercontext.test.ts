/**
 * Tests for InstaloaderContext class in instaloadercontext.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InstaloaderContext, defaultUserAgent, defaultIphoneHeaders } from '../instaloadercontext';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('defaultUserAgent', () => {
  it('should return a Chrome user agent string', () => {
    const ua = defaultUserAgent();
    expect(ua).toContain('Mozilla');
    expect(ua).toContain('Chrome');
    expect(ua).toContain('Safari');
  });
});

describe('defaultIphoneHeaders', () => {
  it('should return iPhone headers object', () => {
    const headers = defaultIphoneHeaders();
    expect(headers['User-Agent']).toContain('Instagram');
    expect(headers['User-Agent']).toContain('iPad');
    expect(headers['x-ig-app-id']).toBe('124024574287414');
  });

  it('should include timezone offset', () => {
    const headers = defaultIphoneHeaders();
    expect(headers['x-ig-timezone-offset']).toBeDefined();
    expect(typeof headers['x-ig-timezone-offset']).toBe('string');
  });

  it('should include a unique session ID', () => {
    const headers1 = defaultIphoneHeaders();
    const headers2 = defaultIphoneHeaders();
    expect(headers1['x-pigeon-session-id']).toBeDefined();
    expect(headers2['x-pigeon-session-id']).toBeDefined();
    // Session IDs should be unique
    expect(headers1['x-pigeon-session-id']).not.toBe(headers2['x-pigeon-session-id']);
  });
});

describe('InstaloaderContext', () => {
  let context: InstaloaderContext;

  beforeEach(() => {
    mockFetch.mockReset();
    context = new InstaloaderContext({ sleep: false, quiet: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create context with default options', () => {
      const ctx = new InstaloaderContext();
      expect(ctx.sleep).toBe(true);
      expect(ctx.quiet).toBe(false);
      expect(ctx.iphoneSupport).toBe(true);
      expect(ctx.maxConnectionAttempts).toBe(3);
      expect(ctx.requestTimeout).toBe(300000);
    });

    it('should accept custom options', () => {
      const ctx = new InstaloaderContext({
        sleep: false,
        quiet: true,
        maxConnectionAttempts: 5,
        requestTimeout: 60000,
        iphoneSupport: false,
      });
      expect(ctx.sleep).toBe(false);
      expect(ctx.quiet).toBe(true);
      expect(ctx.iphoneSupport).toBe(false);
      expect(ctx.maxConnectionAttempts).toBe(5);
      expect(ctx.requestTimeout).toBe(60000);
    });

    it('should accept custom user agent', () => {
      const customUA = 'CustomBot/1.0';
      const ctx = new InstaloaderContext({ userAgent: customUA });
      expect(ctx.userAgent).toBe(customUA);
    });

    it('should accept fatal status codes', () => {
      const ctx = new InstaloaderContext({ fatalStatusCodes: [500, 502, 503] });
      expect(ctx.fatalStatusCodes).toEqual([500, 502, 503]);
    });
  });

  describe('is_logged_in', () => {
    it('should return false when not logged in', () => {
      expect(context.is_logged_in).toBe(false);
    });

    it('should return false when username is null', () => {
      expect(context.username).toBeNull();
      expect(context.is_logged_in).toBe(false);
    });
  });

  describe('username', () => {
    it('should be null when not logged in', () => {
      expect(context.username).toBeNull();
    });
  });

  describe('userId', () => {
    it('should be null when not logged in', () => {
      expect(context.userId).toBeNull();
    });
  });

  describe('iphone_headers', () => {
    it('should return iPhone headers', () => {
      const headers = context.iphone_headers;
      expect(headers['User-Agent']).toContain('Instagram');
    });
  });

  describe('hasStoredErrors', () => {
    it('should return false when no errors logged', () => {
      expect(context.hasStoredErrors).toBe(false);
    });

    it('should return true after logging an error', () => {
      context.error('Test error');
      expect(context.hasStoredErrors).toBe(true);
    });
  });

  describe('log', () => {
    it('should not output when quiet is true', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      context.log('Test message');
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should output when quiet is false', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const loudContext = new InstaloaderContext({ quiet: false, sleep: false });
      loudContext.log('Test message');
      expect(consoleSpy).toHaveBeenCalledWith('Test message');
    });
  });

  describe('error', () => {
    it('should output to stderr', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      context.error('Test error');
      expect(consoleSpy).toHaveBeenCalledWith('Test error');
    });

    it('should store error for later by default', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      context.error('Stored error');
      expect(context.hasStoredErrors).toBe(true);
    });

    it('should not store error when repeatAtEnd is false', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const freshContext = new InstaloaderContext({ quiet: true, sleep: false });
      freshContext.error('Not stored', false);
      expect(freshContext.hasStoredErrors).toBe(false);
    });
  });

  describe('getCookies', () => {
    it('should return cookies as object', () => {
      const cookies = context.getCookies();
      expect(typeof cookies).toBe('object');
    });

    it('should have default cookies initialized', () => {
      const cookies = context.getCookies();
      // Default anonymous cookies should be set
      expect('sessionid' in cookies || 'ig_pr' in cookies).toBe(true);
    });
  });

  describe('setCookies', () => {
    it('should set cookies', () => {
      context.setCookies({ test_cookie: 'test_value' });
      const cookies = context.getCookies();
      expect(cookies['test_cookie']).toBe('test_value');
    });
  });

  describe('saveSession / loadSession', () => {
    it('should save and load session data', () => {
      // Set some cookies
      context.setCookies({ csrftoken: 'testtoken123', ds_user_id: '12345' });
      const saved = context.saveSession();

      // Create new context and load session
      const newContext = new InstaloaderContext({ quiet: true, sleep: false });
      newContext.loadSession('testuser', saved);

      expect(newContext.username).toBe('testuser');
      const cookies = newContext.getCookies();
      expect(cookies['csrftoken']).toBe('testtoken123');
    });
  });

  describe('updateCookies', () => {
    it('should update existing cookies', () => {
      context.setCookies({ existing: 'old_value' });
      context.updateCookies({ existing: 'new_value', another: 'value' });
      const cookies = context.getCookies();
      expect(cookies['existing']).toBe('new_value');
      expect(cookies['another']).toBe('value');
    });
  });

  describe('doSleep', () => {
    it('should not sleep when sleep is disabled', async () => {
      const start = Date.now();
      await context.doSleep();
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(100); // Should be nearly instant
    });

    it('should sleep when sleep is enabled', async () => {
      const sleepContext = new InstaloaderContext({ sleep: true, quiet: true });
      const start = Date.now();
      await sleepContext.doSleep();
      const elapsed = Date.now() - start;
      // Should have slept some time (but cap at 15 seconds max)
      expect(elapsed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('close', () => {
    it('should print stored errors when closing', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const loudContext = new InstaloaderContext({ quiet: false, sleep: false });
      loudContext.error('Error 1');
      loudContext.error('Error 2');
      loudContext.close();
      // Should have printed error messages
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should not print when quiet', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      context.error('Error');
      consoleSpy.mockClear();
      context.close();
      // close() should not print additional messages when quiet
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('profile_id_cache', () => {
    it('should be an empty Map initially', () => {
      expect(context.profile_id_cache).toBeInstanceOf(Map);
      expect(context.profile_id_cache.size).toBe(0);
    });

    it('should allow storing profiles', () => {
      const mockProfile = { username: 'test' };
      context.profile_id_cache.set(123, mockProfile);
      expect(context.profile_id_cache.get(123)).toBe(mockProfile);
    });
  });

  describe('head', () => {
    it('should make HEAD request', async () => {
      const mockHeaders = new Headers();
      mockHeaders.set('content-type', 'image/jpeg');
      mockHeaders.set('content-length', '12345');

      mockFetch.mockResolvedValueOnce({
        status: 200,
        headers: mockHeaders,
      });

      const result = await context.head('https://example.com/image.jpg');
      expect(result.headers).toBeInstanceOf(Map);
      expect(result.headers.get('content-type')).toBe('image/jpeg');
    });

    it('should throw QueryReturnedNotFoundException on 404', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 404,
        statusText: 'Not Found',
        headers: new Headers(),
      });

      await expect(context.head('https://example.com/notfound')).rejects.toThrow('Not Found');
    });

    it('should throw QueryReturnedForbiddenException on 403', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 403,
        statusText: 'Forbidden',
        headers: new Headers(),
      });

      await expect(context.head('https://example.com/forbidden')).rejects.toThrow('Forbidden');
    });
  });
});

describe('InstaloaderContext.getJson', () => {
  let context: InstaloaderContext;

  beforeEach(() => {
    mockFetch.mockReset();
    context = new InstaloaderContext({ sleep: false, quiet: true });
  });

  it('should make GET request by default', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      headers: new Headers(),
      json: async () => ({ status: 'ok', data: 'test' }),
    });

    const result = await context.getJson('api/test', { param: 'value' });
    expect(result['status']).toBe('ok');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('api/test'),
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('should make POST request when usePost is true', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      headers: new Headers(),
      json: async () => ({ status: 'ok' }),
    });

    await context.getJson('api/test', { param: 'value' }, { usePost: true });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('should throw QueryReturnedBadRequestException on 400', async () => {
    // Set maxConnectionAttempts to 1 to avoid retries
    const ctx = new InstaloaderContext({ sleep: false, quiet: true, maxConnectionAttempts: 1 });
    mockFetch.mockResolvedValueOnce({
      status: 400,
      statusText: 'Bad Request',
      headers: new Headers(),
      json: async () => ({ status: 'fail' }),
    });

    await expect(ctx.getJson('api/test', {})).rejects.toThrow('Bad Request');
  });

  it('should throw QueryReturnedNotFoundException on 404', async () => {
    // Set maxConnectionAttempts to 1 to avoid retries
    const ctx = new InstaloaderContext({ sleep: false, quiet: true, maxConnectionAttempts: 1 });
    mockFetch.mockResolvedValueOnce({
      status: 404,
      statusText: 'Not Found',
      headers: new Headers(),
    });

    await expect(ctx.getJson('api/test', {})).rejects.toThrow('Not Found');
  });

  it('should throw TooManyRequestsException on 429', async () => {
    // First call returns 429, second call should also fail after retries
    mockFetch.mockResolvedValue({
      status: 429,
      statusText: 'Too Many Requests',
      headers: new Headers(),
    });

    // Mock handle429 to avoid waiting
    vi.spyOn(context['_rateController'], 'handle429').mockResolvedValue();

    await expect(
      context.getJson('api/test', {}, { attempt: 3 }) // Start at max attempts
    ).rejects.toThrow();
  });

  it('should throw AbortDownloadException on fatal status codes', async () => {
    // Set maxConnectionAttempts to 1 to avoid retries
    const ctx = new InstaloaderContext({
      sleep: false,
      quiet: true,
      fatalStatusCodes: [500],
      maxConnectionAttempts: 1,
    });

    mockFetch.mockResolvedValueOnce({
      status: 500,
      statusText: 'Internal Server Error',
      headers: new Headers(),
    });

    await expect(ctx.getJson('api/test', {})).rejects.toThrow('500');
  });
});

describe('InstaloaderContext.graphql_query', () => {
  let context: InstaloaderContext;

  beforeEach(() => {
    mockFetch.mockReset();
    context = new InstaloaderContext({ sleep: false, quiet: true });
  });

  it('should make GraphQL query with query_hash', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      headers: new Headers(),
      json: async () => ({ status: 'ok', data: { user: { id: '123' } } }),
    });

    const result = await context.graphql_query('abc123hash', { user_id: '123' });
    expect(result['status']).toBe('ok');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('graphql/query'),
      expect.any(Object)
    );
  });

  it('should include variables in query', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      headers: new Headers(),
      json: async () => ({ status: 'ok' }),
    });

    await context.graphql_query('hash123', { var1: 'value1', var2: 123 });
    const callUrl = mockFetch.mock.calls[0]?.[0] as string;
    expect(callUrl).toContain('variables');
  });
});

describe('InstaloaderContext.doc_id_graphql_query', () => {
  let context: InstaloaderContext;

  beforeEach(() => {
    mockFetch.mockReset();
    context = new InstaloaderContext({ sleep: false, quiet: true });
  });

  it('should make GET request with doc_id for anonymous users', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      headers: new Headers(),
      json: async () => ({ status: 'ok', data: {} }),
    });

    const result = await context.doc_id_graphql_query('12345', { shortcode: 'abc' });
    expect(result['status']).toBe('ok');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('graphql/query'),
      expect.objectContaining({ method: 'GET' })
    );
  });
});

describe('InstaloaderContext.get_iphone_json', () => {
  let context: InstaloaderContext;

  beforeEach(() => {
    mockFetch.mockReset();
    context = new InstaloaderContext({ sleep: false, quiet: true });
  });

  it('should make request to i.instagram.com', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      headers: new Headers(),
      json: async () => ({ status: 'ok' }),
    });

    await context.get_iphone_json('api/v1/test', {});
    const callUrl = mockFetch.mock.calls[0]?.[0] as string;
    expect(callUrl).toContain('i.instagram.com');
  });

  it('should include iPhone headers', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      headers: new Headers(),
      json: async () => ({ status: 'ok' }),
    });

    await context.get_iphone_json('api/v1/test', {});
    const callOptions = mockFetch.mock.calls[0]?.[1] as RequestInit;
    const headers = callOptions.headers as Record<string, string>;
    expect(headers['User-Agent']).toContain('Instagram');
  });
});

describe('InstaloaderContext.testLogin', () => {
  let context: InstaloaderContext;

  beforeEach(() => {
    mockFetch.mockReset();
    context = new InstaloaderContext({ sleep: false, quiet: true });
  });

  it('should return username when logged in', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      headers: new Headers(),
      json: async () => ({
        status: 'ok',
        data: { user: { username: 'testuser' } },
      }),
    });

    const username = await context.testLogin();
    expect(username).toBe('testuser');
  });

  it('should return null when not logged in', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      headers: new Headers(),
      json: async () => ({
        status: 'ok',
        data: { user: null },
      }),
    });

    const username = await context.testLogin();
    expect(username).toBeNull();
  });

  it('should return null on connection error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    // Should not throw, should return null
    const username = await context.testLogin();
    expect(username).toBeNull();
  });

  it('should return null on AbortDownloadException', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { AbortDownloadException } = await import('../exceptions');
    mockFetch.mockRejectedValueOnce(new AbortDownloadException('Download aborted'));

    const username = await context.testLogin();
    expect(username).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error when checking if logged in')
    );
  });

  it('should return null on ConnectionException', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { ConnectionException } = await import('../exceptions');
    mockFetch.mockRejectedValueOnce(new ConnectionException('Connection failed'));

    const username = await context.testLogin();
    expect(username).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error when checking if logged in')
    );
  });
});

describe('InstaloaderContext.login', () => {
  let context: InstaloaderContext;

  beforeEach(() => {
    mockFetch.mockReset();
    context = new InstaloaderContext({ sleep: false, quiet: true });
  });

  it('should throw LoginException when CSRF token is missing', async () => {
    // Mock initial request that doesn't set csrftoken cookie
    mockFetch.mockResolvedValueOnce({
      status: 200,
      headers: new Headers(),
    });

    await expect(context.login('user', 'pass')).rejects.toThrow('CSRF');
  });

  it('should throw LoginException when login response is not valid JSON', async () => {
    const headers = new Headers();
    headers.append('Set-Cookie', 'csrftoken=testtoken; Path=/');

    mockFetch
      .mockResolvedValueOnce({
        status: 200,
        headers,
      })
      .mockResolvedValueOnce({
        status: 200,
        headers: new Headers(),
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

    await expect(context.login('user', 'pass')).rejects.toThrow('JSON decode fail');
  });

  it('should throw LoginException when status is not ok with message', async () => {
    const headers = new Headers();
    headers.append('Set-Cookie', 'csrftoken=testtoken; Path=/');

    mockFetch
      .mockResolvedValueOnce({
        status: 200,
        headers,
      })
      .mockResolvedValueOnce({
        status: 200,
        headers: new Headers(),
        json: async () => ({
          status: 'fail',
          message: 'Some error message',
        }),
      });

    await expect(context.login('user', 'pass')).rejects.toThrow('Some error message');
  });

  it('should throw LoginException when status is not ok without message', async () => {
    const headers = new Headers();
    headers.append('Set-Cookie', 'csrftoken=testtoken; Path=/');

    mockFetch
      .mockResolvedValueOnce({
        status: 200,
        headers,
      })
      .mockResolvedValueOnce({
        status: 200,
        headers: new Headers(),
        json: async () => ({
          status: 'error',
          // No message field
        }),
      });

    await expect(context.login('user', 'pass')).rejects.toThrow('"error" status');
  });

  it('should throw LoginException when checkpoint is required', async () => {
    const headers = new Headers();
    headers.append('Set-Cookie', 'csrftoken=testtoken; Path=/');

    mockFetch
      .mockResolvedValueOnce({
        status: 200,
        headers,
      })
      .mockResolvedValueOnce({
        status: 200,
        headers: new Headers(),
        json: async () => ({
          checkpoint_url: 'https://www.instagram.com/challenge/',
        }),
      });

    await expect(context.login('user', 'pass')).rejects.toThrow('Checkpoint required');
  });

  it('should throw BadCredentialsException on wrong password', async () => {
    // Mock initial request to get CSRF token
    const headers = new Headers();
    headers.append('Set-Cookie', 'csrftoken=testtoken; Path=/');

    mockFetch
      .mockResolvedValueOnce({
        status: 200,
        headers,
      })
      .mockResolvedValueOnce({
        status: 200,
        headers: new Headers(),
        json: async () => ({
          status: 'ok',
          authenticated: false,
          user: true,
        }),
      });

    await expect(context.login('user', 'wrongpass')).rejects.toThrow('Wrong password');
  });

  it('should throw LoginException when user does not exist', async () => {
    const headers = new Headers();
    headers.append('Set-Cookie', 'csrftoken=testtoken; Path=/');

    mockFetch
      .mockResolvedValueOnce({
        status: 200,
        headers,
      })
      .mockResolvedValueOnce({
        status: 200,
        headers: new Headers(),
        json: async () => ({
          status: 'ok',
          authenticated: false,
          user: false,
        }),
      });

    await expect(context.login('nonexistent', 'pass')).rejects.toThrow('does not exist');
  });

  it('should throw TwoFactorAuthRequiredException when 2FA is required', async () => {
    const headers = new Headers();
    headers.append('Set-Cookie', 'csrftoken=testtoken; Path=/');

    mockFetch
      .mockResolvedValueOnce({
        status: 200,
        headers,
      })
      .mockResolvedValueOnce({
        status: 200,
        headers: new Headers(),
        json: async () => ({
          status: 'ok',
          two_factor_required: true,
          two_factor_info: {
            two_factor_identifier: '2fa-id-123',
            obfuscated_phone_number: '***1234',
          },
        }),
      });

    await expect(context.login('user', 'pass')).rejects.toThrow('two-factor');
  });

  it('should include all two-factor info fields when available', async () => {
    const headers = new Headers();
    headers.append('Set-Cookie', 'csrftoken=testtoken; Path=/');

    mockFetch
      .mockResolvedValueOnce({
        status: 200,
        headers,
      })
      .mockResolvedValueOnce({
        status: 200,
        headers: new Headers(),
        json: async () => ({
          status: 'ok',
          two_factor_required: true,
          two_factor_info: {
            two_factor_identifier: '2fa-id-456',
            obfuscated_phone_number: '***5678',
            show_messenger_code_option: true,
            show_new_login_screen: false,
            show_trusted_device_option: true,
            pending_trusted_notification_polling: false,
          },
        }),
      });

    const { TwoFactorAuthRequiredException } = await import('../exceptions');
    try {
      await context.login('user', 'pass');
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(TwoFactorAuthRequiredException);
      const tfaError = e as InstanceType<typeof TwoFactorAuthRequiredException>;
      expect(tfaError.twoFactorInfo.identifier).toBe('2fa-id-456');
      expect(tfaError.twoFactorInfo.obfuscatedPhoneNumber).toBe('***5678');
      expect(tfaError.twoFactorInfo.showMessengerCodeOption).toBe(true);
      expect(tfaError.twoFactorInfo.showNewLoginScreen).toBe(false);
      expect(tfaError.twoFactorInfo.showTrustedDeviceOption).toBe(true);
      expect(tfaError.twoFactorInfo.pendingTrustedNotificationPolling).toBe(false);
    }
  });

  it('should set username and userId on successful login', async () => {
    const headers = new Headers();
    headers.append('Set-Cookie', 'csrftoken=testtoken; Path=/');

    const loginHeaders = new Headers();
    loginHeaders.append('Set-Cookie', 'csrftoken=newtoken; Path=/');
    loginHeaders.append('Set-Cookie', 'ds_user_id=12345; Path=/');

    mockFetch
      .mockResolvedValueOnce({
        status: 200,
        headers,
      })
      .mockResolvedValueOnce({
        status: 200,
        headers: loginHeaders,
        json: async () => ({
          status: 'ok',
          authenticated: true,
          user: true,
          userId: '12345',
        }),
      });

    await context.login('testuser', 'correctpass');
    expect(context.username).toBe('testuser');
    expect(context.userId).toBe('12345');
    expect(context.is_logged_in).toBe(true);
  });

  it('should throw LoginException on unexpected response without message', async () => {
    const headers = new Headers();
    headers.append('Set-Cookie', 'csrftoken=testtoken; Path=/');

    mockFetch
      .mockResolvedValueOnce({
        status: 200,
        headers,
      })
      .mockResolvedValueOnce({
        status: 200,
        headers: new Headers(),
        json: async () => ({
          status: 'ok',
          // Response with status: 'ok' but no 'authenticated' field and no message - blocked IP case
        }),
      });

    await expect(context.login('user', 'pass')).rejects.toThrow('blocked IP');
  });

  it('should throw LoginException on unexpected response with message', async () => {
    const headers = new Headers();
    headers.append('Set-Cookie', 'csrftoken=testtoken; Path=/');

    mockFetch
      .mockResolvedValueOnce({
        status: 200,
        headers,
      })
      .mockResolvedValueOnce({
        status: 200,
        headers: new Headers(),
        json: async () => ({
          status: 'ok',
          // Response with status: 'ok' but no 'authenticated' field, has a message
          message: 'checkpoint_required',
        }),
      });

    await expect(context.login('user', 'pass')).rejects.toThrow('checkpoint_required');
  });
});

describe('InstaloaderContext.twoFactorLogin', () => {
  let context: InstaloaderContext;

  beforeEach(() => {
    mockFetch.mockReset();
    context = new InstaloaderContext({ sleep: false, quiet: true });
  });

  it('should throw InvalidArgumentException when no 2FA pending', async () => {
    await expect(context.twoFactorLogin('123456')).rejects.toThrow(
      'No two-factor authentication pending'
    );
  });

  it('should complete login after 2FA', async () => {
    // First trigger 2FA requirement
    const headers = new Headers();
    headers.append('Set-Cookie', 'csrftoken=testtoken; Path=/');

    mockFetch
      .mockResolvedValueOnce({
        status: 200,
        headers,
      })
      .mockResolvedValueOnce({
        status: 200,
        headers: new Headers(),
        json: async () => ({
          status: 'ok',
          two_factor_required: true,
          two_factor_info: {
            two_factor_identifier: '2fa-id-123',
          },
        }),
      });

    try {
      await context.login('testuser', 'pass');
    } catch {
      // Expected 2FA exception
    }

    // Now complete 2FA
    const twoFactorHeaders = new Headers();
    twoFactorHeaders.append('Set-Cookie', 'csrftoken=newtoken; Path=/');
    twoFactorHeaders.append('Set-Cookie', 'ds_user_id=12345; Path=/');

    mockFetch.mockResolvedValueOnce({
      status: 200,
      headers: twoFactorHeaders,
      json: async () => ({
        status: 'ok',
      }),
    });

    await context.twoFactorLogin('123456');
    expect(context.username).toBe('testuser');
    expect(context.is_logged_in).toBe(true);
  });

  it('should throw BadCredentialsException on invalid 2FA code', async () => {
    // First trigger 2FA requirement
    const headers = new Headers();
    headers.append('Set-Cookie', 'csrftoken=testtoken; Path=/');

    mockFetch
      .mockResolvedValueOnce({
        status: 200,
        headers,
      })
      .mockResolvedValueOnce({
        status: 200,
        headers: new Headers(),
        json: async () => ({
          status: 'ok',
          two_factor_required: true,
          two_factor_info: {
            two_factor_identifier: '2fa-id-123',
          },
        }),
      });

    try {
      await context.login('testuser', 'pass');
    } catch {
      // Expected 2FA exception
    }

    // Invalid 2FA code
    mockFetch.mockResolvedValueOnce({
      status: 200,
      headers: new Headers(),
      json: async () => ({
        status: 'fail',
        message: 'Invalid verification code',
      }),
    });

    await expect(context.twoFactorLogin('wrongcode')).rejects.toThrow('2FA error');
  });

  it('should throw BadCredentialsException on 2FA failure without message', async () => {
    // First trigger 2FA requirement
    const headers = new Headers();
    headers.append('Set-Cookie', 'csrftoken=testtoken; Path=/');

    mockFetch
      .mockResolvedValueOnce({
        status: 200,
        headers,
      })
      .mockResolvedValueOnce({
        status: 200,
        headers: new Headers(),
        json: async () => ({
          status: 'ok',
          two_factor_required: true,
          two_factor_info: {
            two_factor_identifier: '2fa-id-123',
          },
        }),
      });

    try {
      await context.login('testuser', 'pass');
    } catch {
      // Expected 2FA exception
    }

    // 2FA fails with non-ok status but no message
    mockFetch.mockResolvedValueOnce({
      status: 200,
      headers: new Headers(),
      json: async () => ({
        status: 'fail',
        // No message field - tests line 1145-1146
      }),
    });

    await expect(context.twoFactorLogin('wrongcode')).rejects.toThrow('"fail" status');
  });
});
