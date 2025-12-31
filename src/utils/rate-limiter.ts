/**
 * Simple rate limiter for controlling request frequency
 */
export class RateLimiter {
  private lastRequestTime = 0;
  private readonly minIntervalMs: number;

  constructor(minIntervalMs: number) {
    this.minIntervalMs = minIntervalMs;
  }

  /**
   * Wait if needed to respect rate limit, then record the request time
   */
  async throttle(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minIntervalMs) {
      const waitTime = this.minIntervalMs - timeSinceLastRequest;
      await this.sleep(waitTime);
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Add random jitter to avoid detection patterns
   */
  async throttleWithJitter(maxJitterMs = 1000): Promise<void> {
    await this.throttle();
    const jitter = Math.random() * maxJitterMs;
    await this.sleep(jitter);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Exponential backoff calculator
 */
export class ExponentialBackoff {
  private attempt = 0;
  private readonly baseMs: number;
  private readonly maxMs: number;
  private readonly factor: number;

  constructor(options: { baseMs?: number; maxMs?: number; factor?: number } = {}) {
    this.baseMs = options.baseMs || 2000;
    this.maxMs = options.maxMs || 60000;
    this.factor = options.factor || 2;
  }

  /**
   * Get the next backoff delay and increment attempt counter
   */
  getNextDelay(): number {
    const delay = Math.min(this.baseMs * Math.pow(this.factor, this.attempt), this.maxMs);
    this.attempt++;
    return delay;
  }

  /**
   * Reset the attempt counter (call on success)
   */
  reset(): void {
    this.attempt = 0;
  }

  /**
   * Wait for the next backoff delay
   */
  async wait(): Promise<void> {
    const delay = this.getNextDelay();
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

/**
 * Create a default rate limiter for Alko scraping
 */
export function createAlkoRateLimiter(): RateLimiter {
  return new RateLimiter(2000); // 2 seconds between requests
}
