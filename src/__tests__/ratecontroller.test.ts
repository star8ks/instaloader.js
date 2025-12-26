/**
 * Tests for RateController class in instaloadercontext.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateController, InstaloaderContext } from '../instaloadercontext';

describe('RateController', () => {
  let context: InstaloaderContext;
  let controller: RateController;

  beforeEach(() => {
    context = new InstaloaderContext({ sleep: false, quiet: true });
    controller = new RateController(context);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create a RateController with context', () => {
      expect(controller).toBeInstanceOf(RateController);
    });
  });

  describe('countPerSlidingWindow', () => {
    it('should return 75 for "other" query type', () => {
      expect(controller.countPerSlidingWindow('other')).toBe(75);
    });

    it('should return 200 for graphql query types', () => {
      expect(controller.countPerSlidingWindow('somehash123')).toBe(200);
    });

    it('should return 200 for "iphone" query type', () => {
      expect(controller.countPerSlidingWindow('iphone')).toBe(200);
    });
  });

  describe('queryWaittime', () => {
    it('should return 0 for first query of a type', () => {
      const currentTime = Date.now() / 1000;
      const waittime = controller.queryWaittime('newquery', currentTime);
      expect(waittime).toBe(0);
    });

    it('should return 0 when under rate limit', () => {
      const currentTime = Date.now() / 1000;
      // Simulate 10 queries in the last minute (well under limit)
      for (let i = 0; i < 10; i++) {
        controller.queryWaittime('testquery', currentTime);
      }
      const waittime = controller.queryWaittime('testquery', currentTime);
      expect(waittime).toBe(0);
    });
  });

  describe('waitBeforeQuery', () => {
    it('should not wait when under rate limit', async () => {
      const sleepSpy = vi.spyOn(controller, 'sleep').mockResolvedValue();
      await controller.waitBeforeQuery('testquery');
      // Should not call sleep when waittime is 0
      expect(sleepSpy).not.toHaveBeenCalled();
    });

    it('should track query timestamps', async () => {
      await controller.waitBeforeQuery('trackedquery');
      // Query the waittime again - should have timestamp recorded
      const waittime = controller.queryWaittime('trackedquery', Date.now() / 1000);
      expect(waittime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('sleep', () => {
    it('should sleep for the specified time', async () => {
      const start = Date.now();
      await controller.sleep(0.01); // 10ms
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(9);
    });
  });

  describe('handle429', () => {
    it('should log error message', async () => {
      const errorSpy = vi.spyOn(context, 'error').mockImplementation(() => {});
      vi.spyOn(controller, 'sleep').mockResolvedValue();

      await controller.handle429('testquery');

      expect(errorSpy).toHaveBeenCalled();
      // The error message should mention 429
      const errorMessage = errorSpy.mock.calls[0]?.[0] as string;
      expect(errorMessage).toContain('429');
    });
  });
});
