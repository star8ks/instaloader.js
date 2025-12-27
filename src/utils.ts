/**
 * Lightweight utility functions to avoid external dependencies.
 */

/**
 * Generate a UUID v4 string.
 * Uses crypto.randomUUID() if available (Node.js 19+), otherwise falls back to manual generation.
 */
export function generateUUID(): string {
  // Use native crypto.randomUUID if available
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback implementation for older Node.js versions
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Last resort: use Math.random (less secure but functional)
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  // Set version (4) and variant (RFC4122)
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Simple cookie store for managing HTTP cookies.
 * Only implements the features we need for Instagram API.
 */
export class SimpleCookieStore {
  private cookies: Map<string, Map<string, string>> = new Map();

  /**
   * Get cookies for a URL as a key-value object.
   */
  getCookies(url: string): Record<string, string> {
    const domain = this.extractDomain(url);
    const domainCookies = this.cookies.get(domain);
    if (!domainCookies) {
      return {};
    }
    return Object.fromEntries(domainCookies);
  }

  /**
   * Set cookies from a key-value object.
   */
  setCookies(cookies: Record<string, string>, url: string): void {
    const domain = this.extractDomain(url);
    let domainCookies = this.cookies.get(domain);
    if (!domainCookies) {
      domainCookies = new Map();
      this.cookies.set(domain, domainCookies);
    }
    for (const [key, value] of Object.entries(cookies)) {
      domainCookies.set(key, value);
    }
  }

  /**
   * Parse and store cookies from Set-Cookie headers.
   */
  parseSetCookieHeaders(headers: Headers, url: string): void {
    const setCookies = headers.getSetCookie?.() || [];
    const domain = this.extractDomain(url);

    let domainCookies = this.cookies.get(domain);
    if (!domainCookies) {
      domainCookies = new Map();
      this.cookies.set(domain, domainCookies);
    }

    for (const cookieStr of setCookies) {
      const parsed = this.parseSetCookie(cookieStr);
      if (parsed) {
        domainCookies.set(parsed.name, parsed.value);
      }
    }
  }

  /**
   * Generate Cookie header string for a URL.
   */
  getCookieHeader(url: string): string {
    const cookies = this.getCookies(url);
    return Object.entries(cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  /**
   * Clear all cookies.
   */
  clear(): void {
    this.cookies.clear();
  }

  /**
   * Clear cookies for a specific domain.
   */
  clearDomain(url: string): void {
    const domain = this.extractDomain(url);
    this.cookies.delete(domain);
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }

  private parseSetCookie(cookieStr: string): { name: string; value: string } | null {
    // Parse "name=value; attributes..."
    const firstSemi = cookieStr.indexOf(';');
    const nameValue = firstSemi === -1 ? cookieStr : cookieStr.slice(0, firstSemi);
    const eqIndex = nameValue.indexOf('=');
    if (eqIndex === -1) {
      return null;
    }
    const name = nameValue.slice(0, eqIndex).trim();
    const value = nameValue.slice(eqIndex + 1).trim();
    if (!name) {
      return null;
    }
    return { name, value };
  }
}
