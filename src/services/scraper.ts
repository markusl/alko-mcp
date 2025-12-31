import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { LRUCache } from 'lru-cache';
import { Timestamp } from '@google-cloud/firestore';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { RateLimiter, ExponentialBackoff } from '../utils/rate-limiter.js';
import type { Store, StoreAvailability, ScrapedAvailability, AvailabilityResult } from '../types/index.js';

/**
 * Enriched product data scraped from product page
 */
export interface EnrichedProductData {
  tasteProfile: string | null;
  usageTips: string | null;
  servingSuggestion: string | null;
  foodPairings: string[];
  certificates: string[];
  ingredients: string | null;
  smokiness: number | null;
  smokinessLabel: string | null;
}
import { getFirestoreService } from './firestore.js';

/**
 * Alko website scraper for store availability
 * Uses Playwright to bypass Incapsula bot protection
 */
export class AlkoScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private sessionEstablished = false;
  private rateLimiter: RateLimiter;
  private backoff: ExponentialBackoff;
  private cache: LRUCache<string, AvailabilityResult>;
  private firestore = getFirestoreService();

  constructor() {
    this.rateLimiter = new RateLimiter(config.scrapeRateLimitMs);
    this.backoff = new ExponentialBackoff();
    this.cache = new LRUCache<string, AvailabilityResult>({
      max: 1000,
      ttl: config.scrapeCacheTtlMs,
    });
  }

  /**
   * Initialize the browser
   */
  async init(): Promise<void> {
    if (this.browser) {
      return;
    }

    logger.info('Initializing Playwright browser');

    this.browser = await chromium.launch({
      headless: true,
      args: [
        // Anti-detection
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        // Required for Cloud Run / Docker
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',  // Use /tmp instead of /dev/shm (limited in containers)
        '--disable-gpu',             // No GPU in Cloud Run
        '--no-zygote',               // Disable zygote process (reduces memory)
        '--single-process',          // Run in single process (more stable in containers)
        // Performance optimizations
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--metrics-recording-only',
        '--no-first-run',
        '--safebrowsing-disable-auto-update',
        // Memory optimizations
        '--js-flags=--max-old-space-size=512',
      ],
    });

    this.context = await this.browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'fi-FI',
      timezoneId: 'Europe/Helsinki',
    });

    this.page = await this.context.newPage();

    // Inject stealth script to avoid detection
    // Note: This runs in browser context so window/navigator are available
    await this.page.addInitScript(`
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      window.chrome = { runtime: {} };
    `);

    logger.info('Browser initialized');
  }

  /**
   * Establish a session with Alko.fi
   */
  async establishSession(): Promise<void> {
    if (!this.page) {
      await this.init();
    }

    if (this.sessionEstablished) {
      return;
    }

    logger.info('Establishing session with Alko.fi');

    try {
      await this.page!.goto('https://www.alko.fi/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });

      // Wait for potential challenge scripts to execute
      await this.page!.waitForTimeout(3000);

      // Accept cookies if dialog appears - OneTrust cookie consent
      try {
        const cookieButton = await this.page!.$(
          '#onetrust-accept-btn-handler, button:has-text("Hyväksy kaikki"), button[id*="cookie"], button[class*="cookie"]'
        );
        if (cookieButton) {
          logger.info('Dismissing cookie consent');
          await cookieButton.click();
          await this.page!.waitForTimeout(1000);
        }
      } catch {
        // Cookie dialog may not appear
      }

      this.sessionEstablished = true;
      this.backoff.reset();
      logger.info('Session established successfully');
    } catch (error) {
      logger.error('Failed to establish session', { error });
      throw error;
    }
  }

  /**
   * Get store availability for a product
   */
  async getProductAvailability(
    productId: string,
    productName?: string
  ): Promise<AvailabilityResult> {
    // Check cache first
    const cached = this.cache.get(productId);
    if (cached) {
      logger.debug(`Cache hit for product ${productId}`);
      return { ...cached, fromCache: true };
    }

    // Ensure we have a session
    if (!this.sessionEstablished) {
      await this.init();
      await this.establishSession();
    }

    // Apply rate limiting
    await this.rateLimiter.throttleWithJitter();

    logger.info(`Scraping availability for product ${productId}`);

    try {
      // Navigate to product page
      await this.page!.goto(`https://www.alko.fi/tuotteet/${productId}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      // Wait for page to load
      await this.page!.waitForTimeout(2000);

      // Click on "Katso myymäläsaatavuus" link to open the availability panel
      try {
        const availabilityLink = await this.page!.$(
          'a:has-text("myymäläsaatavuus"), a:has-text("Saatavuus")'
        );
        if (availabilityLink) {
          logger.info('Found availability link, clicking...');
          await availabilityLink.click();
          // Wait for the store list panel to open and load
          await this.page!.waitForTimeout(3000);

          // Click on dropdown to reveal store list (the "Määrä myymälässä" dropdown)
          const dropdown = await this.page!.$(
            '.stock-availability .dropdown, .off-canvas-stock-availability .dropdown, [class*="is-dropdown-submenu-parent"]'
          );
          if (dropdown) {
            logger.info('Found dropdown, clicking...');
            await dropdown.click();
            await this.page!.waitForTimeout(2000);
          } else {
            logger.info('No dropdown found, stores might be directly visible');
          }
        } else {
          logger.info('Availability link not found on page');
        }
      } catch (error) {
        logger.debug('Availability link click failed', { error });
      }

      // Debug: Check how many store items exist on the page
      const storeItemCount = await this.page!.evaluate(
        `document.querySelectorAll('li.store-item.stockInStore').length`
      );
      logger.info(`Found ${storeItemCount} store items on page`);

      // Extract availability data from li.store-item elements
      // Structure: li.store-item.stockInStore > a.store-item-link > span.store-in-stock + span.number-in-stock
      const scrapedData: ScrapedAvailability[] = await this.page!.evaluate(`
        (() => {
          const items = [];
          const seenStores = new Set();

          // Store items are LI elements with class store-item stockInStore
          const storeItems = document.querySelectorAll('li.store-item.stockInStore');

          storeItems.forEach((item) => {
            // Get store name from span.store-in-stock
            const nameSpan = item.querySelector('span.store-in-stock, span.option-text');
            const storeName = nameSpan?.textContent?.trim() || '';
            if (!storeName) return;

            // Skip duplicates
            if (seenStores.has(storeName)) return;
            seenStores.add(storeName);

            // Get quantity from span.number-in-stock
            const quantitySpan = item.querySelector('span.number-in-stock');
            const quantityText = quantitySpan?.textContent?.trim() || '0';

            // Extract quantity from range (e.g., "11-15" -> 11)
            const quantityMatch = quantityText.match(/(\\d+)/);
            const amount = quantityMatch ? quantityMatch[1] : '0';

            // Get link with store URL
            const link = item.querySelector('a');
            const dataUrl = link?.getAttribute('data-url') || '';
            const href = link?.getAttribute('href') || '';

            items.push({
              storeName,
              storeLink: dataUrl || href,
              amount,
              lastUpdated: '',
            });
          });

          return items;
        })()
      `);

      // Convert scraped data to StoreAvailability entities
      const stores: StoreAvailability[] = scrapedData.map((data) => {
        const quantity = parseInt(String(data.amount).replace(/\D/g, ''), 10) || 0;
        // Extract store ID from link (format: /myymalat-palvelut/XXXX or similar)
        const storeIdMatch = data.storeLink.match(/\/(\d+)(?:[/?]|$)/);
        const storeId = storeIdMatch ? storeIdMatch[1] : data.storeName.replace(/\s/g, '_');

        return {
          id: `${productId}_${storeId}`,
          productId,
          storeId,
          storeName: data.storeName,
          storeLink: data.storeLink,
          quantity,
          status: quantity > 5 ? 'in_stock' : quantity > 0 ? 'low_stock' : 'out_of_stock',
          lastUpdated: data.lastUpdated,
          checkedAt: Timestamp.now(),
        };
      });

      const result: AvailabilityResult = {
        productId,
        productName: productName || productId,
        stores,
        checkedAt: new Date(),
        fromCache: false,
      };

      // Cache the result
      this.cache.set(productId, result);

      // Save to Firestore
      if (stores.length > 0) {
        await this.firestore.upsertAvailability(stores);
      }

      this.backoff.reset();
      logger.info(`Found availability in ${stores.length} stores for product ${productId}`);

      return result;
    } catch (error) {
      logger.error(`Failed to scrape availability for product ${productId}`, { error });

      // Apply exponential backoff
      await this.backoff.wait();

      // Reset session on persistent errors
      if (this.backoff['attempt'] > 3) {
        this.sessionEstablished = false;
      }

      throw error;
    }
  }

  /**
   * Get availability from cache or Firestore (without scraping)
   */
  async getCachedAvailability(productId: string): Promise<AvailabilityResult | null> {
    // Check memory cache
    const cached = this.cache.get(productId);
    if (cached) {
      return { ...cached, fromCache: true };
    }

    // Check Firestore
    const stores = await this.firestore.getAvailability(productId);
    if (stores.length > 0) {
      const result: AvailabilityResult = {
        productId,
        productName: productId,
        stores,
        checkedAt: stores[0].checkedAt.toDate(),
        fromCache: true,
      };

      // Populate memory cache
      this.cache.set(productId, result);

      return result;
    }

    return null;
  }

  /**
   * Scrape enriched product details from product page
   * Includes taste profile, usage tips, serving suggestions, and food pairings
   */
  async scrapeProductDetails(productId: string): Promise<EnrichedProductData | null> {
    // Ensure we have a session
    if (!this.sessionEstablished) {
      await this.init();
      await this.establishSession();
    }

    // Apply rate limiting
    await this.rateLimiter.throttleWithJitter();

    logger.info(`Scraping product details for ${productId}`);

    try {
      await this.page!.goto(`https://www.alko.fi/tuotteet/${productId}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      await this.page!.waitForTimeout(2000);

      const enrichedData: EnrichedProductData = await this.page!.evaluate(`
        (() => {
          const result = {
            tasteProfile: null,
            usageTips: null,
            servingSuggestion: null,
            foodPairings: [],
            certificates: [],
            ingredients: null,
            smokiness: null,
            smokinessLabel: null,
          };

          const bodyText = document.body.innerText || '';

          // Extract taste profile (the short description under the product name)
          // Format: "Punainen, keskitäyteläinen, vähätanniininen, makea, karhunvatukkainen..."
          // Added Vaaleanruskea for liqueurs like Valhalla Cream
          const tasteMatch = bodyText.match(/^[^\\n]*?((?:Punainen|Valkoinen|Rosee|Kullanvärinen|Meripihkan|Kirkas|Tumma|Vaalea|Vaaleanruskea|Täyteläinen|Keskitäyteläinen|Kevyt|Kuiva|Makea|Puolimakea)[^\\n]{10,200})/m);
          if (tasteMatch) {
            result.tasteProfile = tasteMatch[1].trim();
          }

          // Extract usage tips (KÄYTTÖVINKIT section)
          const vinkkiMatch = bodyText.match(/KÄYTTÖVINKIT\\s*([^]*?)(?=TARJOILU|Tuotteen mahdollisesti|$)/i);
          if (vinkkiMatch) {
            result.usageTips = vinkkiMatch[1].trim().substring(0, 500);
          }

          // Extract serving suggestion (TARJOILU section)
          const tarjoiluMatch = bodyText.match(/TARJOILU\\s*([^]*?)(?=Tuotteen mahdollisesti|Alko Oy|$)/i);
          if (tarjoiluMatch) {
            result.servingSuggestion = tarjoiluMatch[1].trim().substring(0, 500);
          }

          // Extract producer declared ingredients (TUOTTAJAN ILMOITTAMAT AINESOSAT section)
          // Stop at the next uppercase section header (e.g., PAKKAUS, SULJENTA, KÄYTTÖ)
          const ingredientsMatch = bodyText.match(/TUOTTAJAN ILMOITTAMAT AINESOSAT\\n([^]*?)(?=\\n[A-ZÄÖÅÜ][A-ZÄÖÅÜ\\/\\s]{2,}\\n|$)/);
          if (ingredientsMatch) {
            result.ingredients = ingredientsMatch[1].trim().substring(0, 1000);
          }

          // Extract whiskey smokiness level and label
          // Structure: div.smokiness > div.smokiness-label + div.smokiness-icons > div.smokiness-icon.smokey (0-4)
          const smokinessContainer = document.querySelector('.smokiness');
          if (smokinessContainer) {
            // Get label text
            const labelEl = smokinessContainer.querySelector('.smokiness-label');
            if (labelEl) {
              result.smokinessLabel = labelEl.textContent?.trim() || null;
            }

            // Count icons with 'smokey' class (0-4)
            const smokeyIcons = smokinessContainer.querySelectorAll('.smokiness-icon.smokey');
            result.smokiness = smokeyIcons.length;
          }

          // Extract certification labels from ecological certificate elements
          // These have class="ecological certificate link-tooltip" (not food pairings)
          const certElements = document.querySelectorAll('.ecological.certificate.link-tooltip[aria-label]');
          const seenCerts = new Set();

          certElements.forEach(el => {
            const ariaLabel = el.getAttribute('aria-label');
            if (ariaLabel && !seenCerts.has(ariaLabel)) {
              seenCerts.add(ariaLabel);
              result.certificates.push(ariaLabel);
            }
          });

          // Extract food pairing symbols from pdp-symbol-link elements with aria-label
          // Only use aria-label as the source to avoid duplicates from foodSymbol_XXX class names
          // which have slightly different formatting (e.g., "kana kalkkuna" vs "kana, kalkkuna")
          // Exclude elements that are certificates (have .ecological.certificate class)
          const foodSymbols = document.querySelectorAll('a.pdp-symbol-link[aria-label]:not(.ecological.certificate)');
          const seenPairings = new Set();

          foodSymbols.forEach(el => {
            const ariaLabel = el.getAttribute('aria-label');
            if (ariaLabel && !seenPairings.has(ariaLabel)) {
              seenPairings.add(ariaLabel);
              result.foodPairings.push(ariaLabel);
            }
          });

          return result;
        })()
      `);

      this.backoff.reset();
      logger.info(`Scraped product details for ${productId}`, {
        hasTaste: !!enrichedData.tasteProfile,
        hasTips: !!enrichedData.usageTips,
        hasServing: !!enrichedData.servingSuggestion,
        hasIngredients: !!enrichedData.ingredients,
        pairingsCount: enrichedData.foodPairings.length,
        certificatesCount: enrichedData.certificates.length,
        smokiness: enrichedData.smokiness,
        smokinessLabel: enrichedData.smokinessLabel,
      });

      return enrichedData;
    } catch (error) {
      logger.error(`Failed to scrape product details for ${productId}`, { error });
      await this.backoff.wait();

      if (this.backoff['attempt'] > 3) {
        this.sessionEstablished = false;
      }

      return null;
    }
  }

  /**
   * Scraped store data from the page
   */
  private parseScrapedStore(data: {
    name: string;
    address: string;
    link: string;
    city?: string;
    openingHoursToday?: string;
    openingHoursTomorrow?: string;
  }): Store | null {
    // Extract store ID from link (e.g., "/myymalat-palvelut/2736?referMethod=..." or "/myymalat-palvelut/2736/")
    const idMatch = data.link.match(/\/myymalat-palvelut\/(\d+)/);
    if (!idMatch) {
      return null;
    }

    const id = idMatch[1];

    // Parse address to extract city and postal code
    // Format: "Kauppakatu 32, 78200 Varkaus" or "Street, 00100 Helsinki"
    const addressParts = data.address.split(',').map((s) => s.trim());
    let street = addressParts[0] || '';
    let postalAndCity = addressParts[1] || '';

    // Extract postal code and city from "78200 Varkaus"
    const postalMatch = postalAndCity.match(/^(\d{5})\s+(.+)$/);
    let postalCode = '';
    let city = data.city || '';

    if (postalMatch) {
      postalCode = postalMatch[1];
      city = postalMatch[2];
    } else if (postalAndCity) {
      // Fallback if format is different
      city = postalAndCity;
    }

    // Clean up store name (remove "Alko " prefix if present for consistency)
    const name = data.name.trim();

    return {
      id,
      name,
      city,
      address: street,
      postalCode,
      coordinates: null, // We don't scrape coordinates
      storeLink: data.link,
      phone: null, // Not available on listing page
      email: null, // Not available on listing page
      openingHoursToday: data.openingHoursToday || null,
      openingHoursTomorrow: data.openingHoursTomorrow || null,
      updatedAt: Timestamp.now(),
    };
  }

  /**
   * Scrape all Alko stores from the store listing page
   */
  async scrapeStores(): Promise<Store[]> {
    // Ensure we have a session
    if (!this.sessionEstablished) {
      await this.init();
      await this.establishSession();
    }

    // Apply rate limiting
    await this.rateLimiter.throttleWithJitter();

    logger.info('Scraping Alko store listing');

    try {
      // Navigate to store listing page
      await this.page!.goto('https://www.alko.fi/myymalat-palvelut', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });

      // Wait for store list to load
      await this.page!.waitForTimeout(3000);

      // Try to load all stores by scrolling or clicking "load more"
      // Some pages use infinite scroll or pagination
      let previousCount = 0;
      let attempts = 0;
      const maxAttempts = 10;

      while (attempts < maxAttempts) {
        // Scroll to bottom to trigger lazy loading
        await this.page!.evaluate('window.scrollTo(0, document.body.scrollHeight)');
        await this.page!.waitForTimeout(1500);

        // Try to click "Show more" or "Load more" button if it exists
        try {
          const loadMoreButton = await this.page!.$(
            'button:has-text("Näytä lisää"), button:has-text("Lataa lisää"), button[class*="loadMore"], a:has-text("Näytä kaikki")'
          );
          if (loadMoreButton) {
            await loadMoreButton.click();
            await this.page!.waitForTimeout(2000);
          }
        } catch {
          // No load more button
        }

        // Check current count
        const currentCount = await this.page!.evaluate(`
          document.querySelectorAll('[class*="store"], [class*="Store"], [data-testid*="store"], .store-item, .store-card, a[href*="/myymalat-palvelut/"]').length
        `);

        if (currentCount === previousCount) {
          // No new stores loaded, we're done
          break;
        }

        previousCount = currentCount as number;
        attempts++;
      }

      // Extract store data using the actual page structure
      // Store items are in div.store-list-item with class outletType_myymalat
      const scrapedData: Array<{
        name: string;
        address: string;
        link: string;
        city?: string;
        openingHoursToday?: string;
        openingHoursTomorrow?: string;
      }> = await this.page!.evaluate(`
        (() => {
          const stores = [];
          const seenIds = new Set();

          // Primary strategy: div.store-list-item elements
          const storeItems = document.querySelectorAll('div.store-list-item');

          storeItems.forEach((item) => {
            // Find the store link (contains store ID)
            const linkEl = item.querySelector('a[href*="/myymalat-palvelut/"]');
            if (!linkEl) return;

            const link = linkEl.getAttribute('href') || '';

            // Extract store ID to deduplicate
            const idMatch = link.match(/\\/myymalat-palvelut\\/(\\d+)/);
            if (!idMatch) return;

            const storeId = idMatch[1];
            if (seenIds.has(storeId)) return;
            seenIds.add(storeId);

            // Get store name - look for the store name link or heading
            // The store name appears multiple times, find the one with just the name
            const nameLinks = item.querySelectorAll('a[href*="/myymalat-palvelut/"]');
            let name = '';
            for (const nl of nameLinks) {
              const text = nl.textContent?.trim() || '';
              // Skip generic texts like "MYYMÄLÄ" or "NÄYTÄ LISÄTIEDOT"
              if (text && !text.match(/^(MYYMÄLÄ|NOUTOPISTE|NÄYTÄ|LISÄTIEDOT)/i) && text.startsWith('Alko')) {
                name = text;
                break;
              }
            }

            if (!name) {
              // Fallback: find any link text starting with "Alko"
              const allText = item.textContent || '';
              const alkoMatch = allText.match(/Alko [^\\n]+/);
              if (alkoMatch) {
                name = alkoMatch[0].trim();
              }
            }

            // Get address - look for text after "Osoite:"
            const itemText = item.textContent || '';
            let address = '';
            let city = '';

            const addressMatch = itemText.match(/Osoite:\\s*([^,]+),\\s*(\\d{5})\\s+([A-ZÄÖÅ]+)/i);
            if (addressMatch) {
              address = addressMatch[1].trim() + ', ' + addressMatch[2] + ' ' + addressMatch[3];
              city = addressMatch[3];
            }

            // Get opening hours - format: "Auki tänään:9-20" or "Auki tänään:SULJETTU"
            let openingHoursToday = null;
            let openingHoursTomorrow = null;

            const todayMatch = itemText.match(/Auki tänään[:\\s]*([\\d-]+|SULJETTU)/i);
            if (todayMatch) {
              openingHoursToday = todayMatch[1].trim();
            }

            const tomorrowMatch = itemText.match(/Auki huomenna[:\\s]*([\\d-]+|SULJETTU)/i);
            if (tomorrowMatch) {
              openingHoursTomorrow = tomorrowMatch[1].trim();
            }

            if (name && link) {
              stores.push({
                name: name.replace(/\\s+/g, ' ').trim(),
                address: address.replace(/\\s+/g, ' ').trim(),
                link: link.split('?')[0], // Remove query params
                city,
                openingHoursToday,
                openingHoursTomorrow,
              });
            }
          });

          return stores;
        })()
      `);

      logger.info(`Found ${scrapedData.length} store entries on page`);

      // Parse and validate store data
      const stores: Store[] = [];
      for (const data of scrapedData) {
        const store = this.parseScrapedStore(data);
        if (store) {
          stores.push(store);
        }
      }

      // If we didn't find stores with the above approach, try scraping individual store pages
      // by looking for store links
      if (stores.length === 0) {
        logger.info('No stores found with primary method, trying to extract store links');

        const storeLinks: string[] = await this.page!.evaluate(`
          (() => {
            const links = [];
            const seenIds = new Set();
            const anchors = document.querySelectorAll('a[href*="/myymalat-palvelut/"]');
            anchors.forEach((a) => {
              const href = a.getAttribute('href') || '';
              const match = href.match(/\\/myymalat-palvelut\\/(\\d+)/);
              if (match && !seenIds.has(match[1])) {
                seenIds.add(match[1]);
                // Return clean link without query params
                links.push('/myymalat-palvelut/' + match[1]);
              }
            });
            return links;
          })()
        `);

        logger.info(`Found ${storeLinks.length} store links to scrape`);

        // Scrape a sample of stores (to avoid overloading)
        const sampleSize = Math.min(storeLinks.length, 20);
        for (let i = 0; i < sampleSize; i++) {
          await this.rateLimiter.throttleWithJitter();
          const store = await this.scrapeIndividualStore(storeLinks[i]);
          if (store) {
            stores.push(store);
          }
        }
      }

      // Save stores to Firestore
      if (stores.length > 0) {
        for (const store of stores) {
          await this.firestore.upsertStore(store);
        }
        logger.info(`Saved ${stores.length} stores to Firestore`);
      }

      this.backoff.reset();
      return stores;
    } catch (error) {
      logger.error('Failed to scrape stores', { error });
      await this.backoff.wait();

      if (this.backoff['attempt'] > 3) {
        this.sessionEstablished = false;
      }

      throw error;
    }
  }

  /**
   * Scrape an individual store page for details
   */
  private async scrapeIndividualStore(storeLink: string): Promise<Store | null> {
    try {
      const fullUrl = storeLink.startsWith('http')
        ? storeLink
        : `https://www.alko.fi${storeLink}`;

      await this.page!.goto(fullUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      await this.page!.waitForTimeout(2000);

      const storeData: {
        name: string;
        address: string;
        city: string;
        postalCode: string;
        phone: string | null;
        email: string | null;
        openingHoursToday: string | null;
      } | null = await this.page!.evaluate(`
        (() => {
          // Try to extract store name
          const nameEl = document.querySelector('h1, [class*="storeName"], [class*="store-name"]');
          const name = nameEl?.textContent?.trim().split(',')[0] || '';

          // Get all body text for parsing
          const bodyText = document.body.innerText || '';

          // Try to extract address from structured data
          const addressMatch = bodyText.match(/([A-Za-zÄÖÅäöå\\s]+\\s+\\d+[A-Za-z]?),\\s*(\\d{5})\\s+([A-ZÄÖÅ]+)/);
          let street = '';
          let postalCode = '';
          let city = '';

          if (addressMatch) {
            street = addressMatch[1].trim();
            postalCode = addressMatch[2];
            city = addressMatch[3];
          }

          // Extract phone number
          const phoneMatch = bodyText.match(/\\+358\\s*\\d+\\s*\\d+\\s*\\d+/);
          const phone = phoneMatch ? phoneMatch[0].replace(/\\s+/g, ' ') : null;

          // Extract email
          const emailMatch = bodyText.match(/[a-z]+@alko\\.fi/i);
          const email = emailMatch ? emailMatch[0] : null;

          // Extract today's opening hours from the schedule
          // Format: "ti 30.12 10-21" or "to 01.01 SULJETTU"
          const today = new Date();
          const dayNames = ['su', 'ma', 'ti', 'ke', 'to', 'pe', 'la'];
          const todayAbbr = dayNames[today.getDay()];
          const todayDate = today.getDate().toString().padStart(2, '0') + '.' + (today.getMonth() + 1).toString().padStart(2, '0');

          let openingHoursToday = null;
          const hoursMatch = bodyText.match(new RegExp(todayAbbr + '\\\\s+' + todayDate + '\\\\s+(\\\\d+-\\\\d+|SULJETTU)', 'i'));
          if (hoursMatch) {
            openingHoursToday = hoursMatch[1];
          }

          if (!name) return null;

          return {
            name,
            address: street,
            city,
            postalCode,
            phone,
            email,
            openingHoursToday,
          };
        })()
      `);

      if (!storeData) {
        return null;
      }

      // Extract store ID from URL
      const idMatch = storeLink.match(/\/myymalat-palvelut\/(\d+)/);
      if (!idMatch) {
        return null;
      }

      return {
        id: idMatch[1],
        name: storeData.name,
        city: storeData.city,
        address: storeData.address,
        postalCode: storeData.postalCode,
        coordinates: null,
        storeLink,
        phone: storeData.phone,
        email: storeData.email,
        openingHoursToday: storeData.openingHoursToday,
        openingHoursTomorrow: null, // Would need to calculate from schedule
        updatedAt: Timestamp.now(),
      };
    } catch (error) {
      logger.error(`Failed to scrape store ${storeLink}`, { error });
      return null;
    }
  }

  /**
   * Search products by food symbol (food pairing)
   * Returns an array of product IDs that pair well with the specified food
   */
  async searchByFoodSymbol(
    foodSymbolId: string,
    limit: number = 20
  ): Promise<string[]> {
    // Ensure we have a session
    if (!this.sessionEstablished) {
      await this.init();
      await this.establishSession();
    }

    // Apply rate limiting
    await this.rateLimiter.throttleWithJitter();

    logger.info(`Searching products by food symbol: ${foodSymbolId}`);

    try {
      // Build the search URL with food symbol filter
      // Format: SearchParameter contains URL-encoded query with foodSymbolId
      // Note: ContextCategoryUUID is not required - Intershop search works without it
      const searchParams = `@QueryTerm=*&${foodSymbolId}&OnlineFlag=1`;
      const encodedParams = encodeURIComponent(searchParams);
      const pageSize = Math.min(limit, 48); // Alko max is 48 per page
      const url = `https://www.alko.fi/tuotteet/tuotelistaus?SearchTerm=*&PageSize=${pageSize}&SearchParameter=${encodedParams}`;

      await this.page!.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      await this.page!.waitForTimeout(3000);

      // Extract product IDs from the search results
      // Product tiles have links like /tuotteet/123456
      const productIds: string[] = await this.page!.evaluate(`
        (() => {
          const ids = [];
          const seenIds = new Set();

          // Find all product links
          const productLinks = document.querySelectorAll('a[href*="/tuotteet/"]');

          productLinks.forEach(link => {
            const href = link.getAttribute('href') || '';
            // Extract product ID (6-digit number)
            const match = href.match(/\\/tuotteet\\/(\\d{6})/);
            if (match && !seenIds.has(match[1])) {
              seenIds.add(match[1]);
              ids.push(match[1]);
            }
          });

          return ids;
        })()
      `);

      this.backoff.reset();
      logger.info(`Found ${productIds.length} products for food symbol ${foodSymbolId}`);

      return productIds;
    } catch (error) {
      logger.error(`Failed to search by food symbol ${foodSymbolId}`, { error });
      await this.backoff.wait();

      if (this.backoff['attempt'] > 3) {
        this.sessionEstablished = false;
      }

      throw error;
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
      this.sessionEstablished = false;
      logger.info('Browser closed');
    }
  }

  /**
   * Check if the scraper is initialized
   */
  isInitialized(): boolean {
    return this.browser !== null && this.sessionEstablished;
  }
}

// Singleton instance
let scraperInstance: AlkoScraper | null = null;

export function getAlkoScraper(): AlkoScraper {
  if (!scraperInstance) {
    scraperInstance = new AlkoScraper();
  }
  return scraperInstance;
}
