import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter, ExponentialBackoff } from '../../src/utils/rate-limiter.js';

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should not throttle first request', async () => {
    const limiter = new RateLimiter(1000);
    const start = Date.now();

    const throttlePromise = limiter.throttle();
    await vi.runAllTimersAsync();
    await throttlePromise;

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(100); // Should be nearly instant
  });

  it('should throttle subsequent requests', async () => {
    const limiter = new RateLimiter(1000);

    // First request
    await limiter.throttle();
    vi.advanceTimersByTime(0);

    // Second request should wait
    const start = Date.now();
    const throttlePromise = limiter.throttle();

    // Advance time by 1000ms
    vi.advanceTimersByTime(1000);
    await throttlePromise;

    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(1000);
  });

  it('should not throttle if enough time has passed', async () => {
    const limiter = new RateLimiter(1000);

    // First request
    await limiter.throttle();

    // Wait 2 seconds
    vi.advanceTimersByTime(2000);

    // Second request should not wait
    const start = Date.now();
    const throttlePromise = limiter.throttle();
    await vi.runAllTimersAsync();
    await throttlePromise;

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(100);
  });
});

describe('ExponentialBackoff', () => {
  it('should return increasing delays', () => {
    const backoff = new ExponentialBackoff({ baseMs: 1000, factor: 2, maxMs: 60000 });

    expect(backoff.getNextDelay()).toBe(1000);   // 1000 * 2^0
    expect(backoff.getNextDelay()).toBe(2000);   // 1000 * 2^1
    expect(backoff.getNextDelay()).toBe(4000);   // 1000 * 2^2
    expect(backoff.getNextDelay()).toBe(8000);   // 1000 * 2^3
  });

  it('should cap at maxMs', () => {
    const backoff = new ExponentialBackoff({ baseMs: 10000, factor: 2, maxMs: 30000 });

    expect(backoff.getNextDelay()).toBe(10000);
    expect(backoff.getNextDelay()).toBe(20000);
    expect(backoff.getNextDelay()).toBe(30000); // Capped
    expect(backoff.getNextDelay()).toBe(30000); // Still capped
  });

  it('should reset attempt counter', () => {
    const backoff = new ExponentialBackoff({ baseMs: 1000, factor: 2, maxMs: 60000 });

    backoff.getNextDelay(); // 1000
    backoff.getNextDelay(); // 2000
    backoff.getNextDelay(); // 4000

    backoff.reset();

    expect(backoff.getNextDelay()).toBe(1000); // Back to base
  });

  it('should use default values', () => {
    const backoff = new ExponentialBackoff();

    expect(backoff.getNextDelay()).toBe(2000); // Default base
  });
});
