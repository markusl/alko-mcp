import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { LRUCache } from 'lru-cache';
import { logger } from '../utils/logger.js';
import { RateLimiter, ExponentialBackoff } from '../utils/rate-limiter.js';
import { getFirestoreService } from './firestore.js';
import type { VivinoRating, VivinoRatingResult } from '../types/vivino.js';

/**
 * Vivino website scraper for wine ratings
 * Uses Playwright to fetch rating data from wine pages
 * Caches results in Firestore (7 days) with in-memory L1 cache (1 hour)
 */
export class VivinoScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private rateLimiter: RateLimiter;
  private backoff: ExponentialBackoff;
  // L1 in-memory cache for fast access (1 hour TTL)
  private memoryCache: LRUCache<string, VivinoRatingResult>;

  constructor() {
    // Use 3 second rate limit for Vivino (be respectful)
    this.rateLimiter = new RateLimiter(3000);
    this.backoff = new ExponentialBackoff();
    // L1 cache: in-memory for fast access
    this.memoryCache = new LRUCache<string, VivinoRatingResult>({
      max: 500,
      ttl: 60 * 60 * 1000, // 1 hour
    });
  }

  /**
   * Initialize the browser
   */
  async init(): Promise<void> {
    if (this.browser) {
      return;
    }

    logger.info('Initializing Playwright browser for Vivino');

    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    });

    this.context = await this.browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
    });

    this.page = await this.context.newPage();

    // Inject stealth script to avoid detection
    await this.page.addInitScript(`
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      window.chrome = { runtime: {} };
    `);

    logger.info('Vivino browser initialized');
  }

  /**
   * Check cache for a rating (memory first, then Firestore)
   */
  private async getCachedRating(cacheKey: string): Promise<VivinoRatingResult | null> {
    // L1: Check in-memory cache first
    const memoryCached = this.memoryCache.get(cacheKey);
    if (memoryCached) {
      logger.debug(`Memory cache hit for: ${cacheKey}`);
      return { ...memoryCached, fromCache: true };
    }

    // L2: Check Firestore cache
    try {
      const firestore = getFirestoreService();
      const storedRating = await firestore.getVivinoRating(cacheKey);
      if (storedRating) {
        logger.debug(`Firestore cache hit for: ${cacheKey}`);
        const result: VivinoRatingResult = {
          found: true,
          rating: {
            wineName: storedRating.wineName,
            winery: storedRating.winery,
            averageRating: storedRating.averageRating,
            ratingsCount: storedRating.ratingsCount,
            vivinoUrl: storedRating.vivinoUrl,
            fetchedAt: storedRating.fetchedAt.toDate(),
          },
          error: null,
          fromCache: true,
        };
        // Populate L1 cache
        this.memoryCache.set(cacheKey, result);
        return result;
      }
    } catch (error) {
      logger.warn('Failed to check Firestore cache', { error });
      // Continue without cache
    }

    return null;
  }

  /**
   * Store a rating in both caches
   */
  private async cacheRating(cacheKey: string, result: VivinoRatingResult): Promise<void> {
    // Store in L1 memory cache
    this.memoryCache.set(cacheKey, result);

    // Store in L2 Firestore cache (only for successful ratings)
    if (result.found && result.rating) {
      try {
        const firestore = getFirestoreService();
        await firestore.setVivinoRating(cacheKey, {
          wineName: result.rating.wineName,
          winery: result.rating.winery,
          averageRating: result.rating.averageRating,
          ratingsCount: result.rating.ratingsCount,
          vivinoUrl: result.rating.vivinoUrl,
        });
        logger.debug(`Stored Vivino rating in Firestore cache: ${cacheKey}`);
      } catch (error) {
        logger.warn('Failed to store rating in Firestore cache', { error });
        // Continue without persisting - in-memory cache still works
      }
    }
  }

  /**
   * Search for a wine on Vivino by name and get its rating
   */
  async getWineRating(wineName: string, winery?: string): Promise<VivinoRatingResult> {
    // Create cache key from wine name and winery
    const cacheKey = `${wineName}|${winery || ''}`.toLowerCase();

    // Check cache first (memory + Firestore)
    const cached = await this.getCachedRating(cacheKey);
    if (cached) {
      return cached;
    }

    // Ensure browser is initialized
    if (!this.browser) {
      await this.init();
    }

    // Apply rate limiting
    await this.rateLimiter.throttleWithJitter();

    logger.info(`Searching Vivino for: ${wineName}`);

    try {
      // Build search query
      const searchQuery = winery ? `${winery} ${wineName}` : wineName;
      const searchUrl = `https://www.vivino.com/search/wines?q=${encodeURIComponent(searchQuery)}`;

      await this.page!.goto(searchUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      // Wait for search results to load
      await this.page!.waitForTimeout(3000);

      // Check if we got a captcha or bot detection
      const pageContent = await this.page!.content();
      if (pageContent.includes("confirm you are human") || pageContent.includes("captcha")) {
        logger.warn('Vivino bot detection triggered');
        const result: VivinoRatingResult = {
          found: false,
          rating: null,
          error: 'Vivino requires human verification. Please try again later.',
          fromCache: false,
        };
        return result;
      }

      // Extract first wine result URL
      // Vivino uses data-testid="vintagePageLink" for wine links in search results
      // URL pattern is /en/.../w/123456 (not /wines/)
      const wineUrl: string | null = await this.page!.evaluate(`
        (() => {
          // Primary: Look for wine card links with data-testid
          const vintageLink = document.querySelector('a[data-testid="vintagePageLink"]');
          if (vintageLink) {
            return vintageLink.getAttribute('href');
          }

          // Fallback: Look for links containing /w/ pattern (wine pages)
          const wineLinks = document.querySelectorAll('a[href*="/w/"]');
          for (const link of wineLinks) {
            const href = link.getAttribute('href');
            // Match pattern like /en/wine-name/w/123456 or /wine-name/w/123456
            if (href && /\\/w\\/\\d+/.test(href)) {
              return href;
            }
          }

          // Last resort: Look for wineCard class elements
          const wineCard = document.querySelector('[class*="wineCard__cardLink"]');
          if (wineCard) {
            return wineCard.getAttribute('href');
          }

          return null;
        })()
      `);

      if (!wineUrl) {
        logger.info(`No wine found on Vivino for: ${wineName}`);
        const result: VivinoRatingResult = {
          found: false,
          rating: null,
          error: null,
          fromCache: false,
        };
        // Cache "not found" in memory only (don't persist to Firestore)
        this.memoryCache.set(cacheKey, result);
        return result;
      }

      // Navigate to wine page
      const fullWineUrl = wineUrl.startsWith('http') ? wineUrl : `https://www.vivino.com${wineUrl}`;

      await this.rateLimiter.throttleWithJitter();
      await this.page!.goto(fullWineUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      await this.page!.waitForTimeout(2000);

      // Extract rating data from wine page
      const ratingData: {
        wineName: string | null;
        winery: string | null;
        averageRating: string | null;
        ratingsCount: string | null;
      } = await this.page!.evaluate(`
        (() => {
          const result = {
            wineName: null,
            winery: null,
            averageRating: null,
            ratingsCount: null,
          };

          // Get wine name from h1 or class containing "wineName"
          const nameEl = document.querySelector('h1, [class*="wineName"]');
          result.wineName = nameEl?.textContent?.trim() || null;

          // Get winery name
          const wineryEl = document.querySelector('[class*="winery"], [data-testid="winery"]');
          result.winery = wineryEl?.textContent?.trim() || null;

          // Get average rating - look for vivinoRating_averageValue class pattern
          const ratingEl = document.querySelector('[class*="vivinoRating_averageValue"], [class*="averageValue"]');
          if (ratingEl) {
            result.averageRating = ratingEl.textContent?.trim() || null;
          }

          // Get ratings count - look for vivinoRating_caption class pattern
          const countEl = document.querySelector('[class*="vivinoRating_caption"], [class*="ratingCount"]');
          if (countEl) {
            result.ratingsCount = countEl.textContent?.trim() || null;
          }

          return result;
        })()
      `);

      // Parse the rating data
      // Check if wine has "Not enough ratings" message
      const hasNotEnoughRatings = ratingData.ratingsCount?.toLowerCase().includes('not enough');

      if (!ratingData.averageRating) {
        const errorMessage = hasNotEnoughRatings
          ? 'Wine found on Vivino but does not have enough ratings yet'
          : 'Wine page found but rating data could not be extracted';

        logger.info(`No rating data found for: ${wineName}`, { hasNotEnoughRatings });
        const result: VivinoRatingResult = {
          found: false,
          rating: null,
          error: errorMessage,
          fromCache: false,
        };
        // Cache "not enough ratings" in memory only
        this.memoryCache.set(cacheKey, result);
        return result;
      }

      // Parse average rating (e.g., "4.3" -> 4.3)
      const averageRating = parseFloat(ratingData.averageRating);
      if (isNaN(averageRating)) {
        logger.warn(`Could not parse rating: ${ratingData.averageRating}`);
        const result: VivinoRatingResult = {
          found: false,
          rating: null,
          error: `Could not parse rating value: ${ratingData.averageRating}`,
          fromCache: false,
        };
        return result;
      }

      // Parse ratings count (e.g., "6803 ratings" -> 6803)
      let ratingsCount = 0;
      if (ratingData.ratingsCount) {
        const countMatch = ratingData.ratingsCount.match(/[\d,]+/);
        if (countMatch) {
          ratingsCount = parseInt(countMatch[0].replace(/,/g, ''), 10);
        }
      }

      const rating: VivinoRating = {
        wineName: ratingData.wineName || wineName,
        winery: ratingData.winery,
        averageRating,
        ratingsCount,
        vivinoUrl: fullWineUrl,
        fetchedAt: new Date(),
      };

      const result: VivinoRatingResult = {
        found: true,
        rating,
        error: null,
        fromCache: false,
      };

      // Cache the result (memory + Firestore)
      await this.cacheRating(cacheKey, result);

      this.backoff.reset();
      logger.info(`Found Vivino rating for ${wineName}: ${averageRating} (${ratingsCount} ratings)`);

      return result;
    } catch (error) {
      logger.error(`Failed to get Vivino rating for ${wineName}`, { error });

      // Apply exponential backoff
      await this.backoff.wait();

      const result: VivinoRatingResult = {
        found: false,
        rating: null,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        fromCache: false,
      };

      return result;
    }
  }

  /**
   * Get rating by direct Vivino URL
   */
  async getRatingByUrl(vivinoUrl: string): Promise<VivinoRatingResult> {
    // Use URL as cache key
    const cacheKey = vivinoUrl.toLowerCase();

    // Check cache first (memory + Firestore)
    const cached = await this.getCachedRating(cacheKey);
    if (cached) {
      return cached;
    }

    // Ensure browser is initialized
    if (!this.browser) {
      await this.init();
    }

    // Apply rate limiting
    await this.rateLimiter.throttleWithJitter();

    logger.info(`Fetching Vivino rating from: ${vivinoUrl}`);

    try {
      await this.page!.goto(vivinoUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      await this.page!.waitForTimeout(2000);

      // Check for bot detection
      const pageContent = await this.page!.content();
      if (pageContent.includes("confirm you are human") || pageContent.includes("captcha")) {
        logger.warn('Vivino bot detection triggered');
        return {
          found: false,
          rating: null,
          error: 'Vivino requires human verification. Please try again later.',
          fromCache: false,
        };
      }

      // Extract rating data
      const ratingData: {
        wineName: string | null;
        winery: string | null;
        averageRating: string | null;
        ratingsCount: string | null;
      } = await this.page!.evaluate(`
        (() => {
          const result = {
            wineName: null,
            winery: null,
            averageRating: null,
            ratingsCount: null,
          };

          const nameEl = document.querySelector('h1, [class*="wineName"]');
          result.wineName = nameEl?.textContent?.trim() || null;

          const wineryEl = document.querySelector('[class*="winery"], [data-testid="winery"]');
          result.winery = wineryEl?.textContent?.trim() || null;

          const ratingEl = document.querySelector('[class*="vivinoRating_averageValue"], [class*="averageValue"]');
          if (ratingEl) {
            result.averageRating = ratingEl.textContent?.trim() || null;
          }

          const countEl = document.querySelector('[class*="vivinoRating_caption"], [class*="ratingCount"]');
          if (countEl) {
            result.ratingsCount = countEl.textContent?.trim() || null;
          }

          return result;
        })()
      `);

      // Check if wine has "Not enough ratings" message
      const hasNotEnoughRatings = ratingData.ratingsCount?.toLowerCase().includes('not enough');

      if (!ratingData.averageRating) {
        const errorMessage = hasNotEnoughRatings
          ? 'Wine found on Vivino but does not have enough ratings yet'
          : 'Wine page found but rating data could not be extracted';

        const result: VivinoRatingResult = {
          found: false,
          rating: null,
          error: errorMessage,
          fromCache: false,
        };
        return result;
      }

      const averageRating = parseFloat(ratingData.averageRating);
      if (isNaN(averageRating)) {
        return {
          found: false,
          rating: null,
          error: `Could not parse rating value: ${ratingData.averageRating}`,
          fromCache: false,
        };
      }

      let ratingsCount = 0;
      if (ratingData.ratingsCount) {
        const countMatch = ratingData.ratingsCount.match(/[\d,]+/);
        if (countMatch) {
          ratingsCount = parseInt(countMatch[0].replace(/,/g, ''), 10);
        }
      }

      const rating: VivinoRating = {
        wineName: ratingData.wineName || 'Unknown',
        winery: ratingData.winery,
        averageRating,
        ratingsCount,
        vivinoUrl,
        fetchedAt: new Date(),
      };

      const result: VivinoRatingResult = {
        found: true,
        rating,
        error: null,
        fromCache: false,
      };

      // Cache the result (memory + Firestore)
      await this.cacheRating(cacheKey, result);
      this.backoff.reset();

      logger.info(`Got Vivino rating: ${averageRating} (${ratingsCount} ratings)`);

      return result;
    } catch (error) {
      logger.error(`Failed to get Vivino rating from URL`, { error });
      await this.backoff.wait();

      return {
        found: false,
        rating: null,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        fromCache: false,
      };
    }
  }

  /**
   * Close the browser
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
      logger.info('Vivino browser closed');
    }
  }

  /**
   * Check if the scraper is initialized
   */
  isInitialized(): boolean {
    return this.browser !== null;
  }
}

// Singleton instance
let vivinoScraperInstance: VivinoScraper | null = null;

export function getVivinoScraper(): VivinoScraper {
  if (!vivinoScraperInstance) {
    vivinoScraperInstance = new VivinoScraper();
  }
  return vivinoScraperInstance;
}
