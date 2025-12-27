/**
 * Integration tests for real Instagram API calls
 *
 * NOTE: Instagram's GraphQL API requires authentication for most operations.
 * These tests are skipped by default as they require valid credentials.
 *
 * To run with authentication:
 * 1. Set INSTAGRAM_USERNAME and INSTAGRAM_PASSWORD environment variables
 * 2. Run: npx vitest run src/__tests__/integration.test.ts
 */

import { describe, it, expect } from 'vitest';
import { InstaloaderContext } from '../instaloadercontext';
import { Post } from '../structures';

const hasCredentials =
  process.env['INSTAGRAM_USERNAME'] && process.env['INSTAGRAM_PASSWORD'];

describe('Integration Tests', () => {
  describe('Instagram API Access (requires login)', () => {
    it.skipIf(!hasCredentials)(
      'should fetch post data from Instagram GraphQL API',
      async () => {
        const context = new InstaloaderContext({
          quiet: false,
          sleep: true,
        });

        try {
          // Login first
          await context.login(
            process.env['INSTAGRAM_USERNAME']!,
            process.env['INSTAGRAM_PASSWORD']!
          );

          // Real post: https://www.instagram.com/p/DSsaqgbkhAd/
          const shortcode = 'DSsaqgbkhAd';
          console.log('Fetching post:', shortcode);

          const post = await Post.fromShortcode(context, shortcode);

          // Basic assertions
          expect(post.shortcode).toBe(shortcode);
          expect(post.typename).toMatch(/^Graph(Image|Video|Sidecar)$/);

          // URL should be valid
          expect(post.url).toMatch(/^https:\/\//);
          console.log('Post URL:', post.url);
          console.log('Post typename:', post.typename);
          console.log('Caption:', post.caption?.slice(0, 100));
        } finally {
          context.close();
        }
      },
      120000
    );
  });
});
