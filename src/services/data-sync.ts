import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { parseAlkoExcel, validateProducts } from '../utils/excel-parser.js';
import { getFirestoreService } from './firestore.js';
import { getAlkoScraper } from './scraper.js';
import type { SeedData, SeedProduct, SeedStore } from '../types/index.js';
import type { Product, Store } from '../types/index.js';
import { Timestamp } from '@google-cloud/firestore';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_DATA_PATH = path.join(__dirname, '..', '..', 'data', 'seed-data.json');

// Track if we've already checked/loaded seed data this session
let seedDataChecked = false;
let seedDataLoading: Promise<void> | null = null;

/**
 * Data synchronization service for Alko product catalog
 */
export class DataSyncService {
  private firestore = getFirestoreService();

  /**
   * Download the Alko price list Excel file
   * Uses two-step session approach to bypass Incapsula protection
   */
  async downloadPriceList(): Promise<ArrayBuffer> {
    logger.info('Starting Alko price list download');

    // Step 1: Visit homepage to establish session
    const homeResponse = await fetch('https://www.alko.fi/', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fi-FI,fi;q=0.9,en;q=0.8',
      },
    });

    // Extract cookies from response
    const cookies = homeResponse.headers.get('set-cookie') || '';
    logger.info('Established session with Alko.fi');

    // Step 2: Download the Excel file with session cookies
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Small delay

    const excelResponse = await fetch(config.alkoPriceListUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,*/*',
        'Accept-Language': 'fi-FI,fi;q=0.9,en;q=0.8',
        Referer: 'https://www.alko.fi/valikoimat-ja-hinnasto/hinnasto',
        Cookie: cookies,
      },
    });

    if (!excelResponse.ok) {
      throw new Error(`Failed to download price list: ${excelResponse.status} ${excelResponse.statusText}`);
    }

    const contentType = excelResponse.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      throw new Error('Received HTML instead of Excel file - likely blocked by bot protection');
    }

    const buffer = await excelResponse.arrayBuffer();
    logger.info(`Downloaded price list: ${buffer.byteLength} bytes`);

    return buffer;
  }

  /**
   * Sync products from the Alko price list
   */
  async syncProducts(): Promise<{
    success: boolean;
    productsProcessed: number;
    productsAdded: number;
    productsUpdated: number;
    errors: string[];
  }> {
    const syncLogId = await this.firestore.createSyncLog('product_sync', config.alkoPriceListUrl);
    const errors: string[] = [];

    try {
      // Download the Excel file
      const buffer = await this.downloadPriceList();

      // Parse the Excel file
      logger.info('Parsing Excel file');
      const products = parseAlkoExcel(buffer);
      logger.info(`Parsed ${products.length} products`);

      // Validate products
      const { valid, invalid } = validateProducts(products);
      logger.info(`Valid products: ${valid.length}, Invalid: ${invalid.length}`);

      for (const { product, errors: productErrors } of invalid) {
        errors.push(`Product ${product.id}: ${productErrors.join(', ')}`);
      }

      // Upsert to Firestore
      logger.info('Upserting products to Firestore');
      const { added, updated } = await this.firestore.upsertProducts(valid);

      const result = {
        success: true,
        productsProcessed: valid.length,
        productsAdded: added,
        productsUpdated: updated,
        errors,
      };

      await this.firestore.completeSyncLog(syncLogId, result);
      logger.info(`Sync completed: ${added} added, ${updated} updated`);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Sync failed: ${errorMessage}`);
      await this.firestore.failSyncLog(syncLogId, errorMessage);

      return {
        success: false,
        productsProcessed: 0,
        productsAdded: 0,
        productsUpdated: 0,
        errors: [errorMessage],
      };
    }
  }

  /**
   * Sync stores by scraping Alko.fi
   * Uses Playwright to bypass Incapsula protection
   */
  async syncStores(): Promise<{
    success: boolean;
    storesProcessed: number;
    errors: string[];
  }> {
    const syncLogId = await this.firestore.createSyncLog('store_sync', 'https://www.alko.fi/myymalat-palvelut');
    const errors: string[] = [];

    try {
      logger.info('Starting store sync via web scraping');

      const scraper = getAlkoScraper();
      const stores = await scraper.scrapeStores();

      logger.info(`Scraped ${stores.length} stores`);

      const result = {
        success: true,
        storesProcessed: stores.length,
        errors,
      };

      await this.firestore.completeSyncLog(syncLogId, {
        productsProcessed: stores.length,
        productsAdded: stores.length,
        productsUpdated: 0,
        errors,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Store sync failed: ${errorMessage}`);
      await this.firestore.failSyncLog(syncLogId, errorMessage);

      return {
        success: false,
        storesProcessed: 0,
        errors: [errorMessage],
      };
    }
  }

  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<{
    lastSync: Date | null;
    lastSyncStatus: string | null;
    productCount: number;
  }> {
    const recentLogs = await this.firestore.getRecentSyncLogs(1);
    const productCount = await this.firestore.getProductCount();

    if (recentLogs.length === 0) {
      return {
        lastSync: null,
        lastSyncStatus: null,
        productCount,
      };
    }

    const lastLog = recentLogs[0];
    return {
      lastSync: lastLog.startedAt.toDate(),
      lastSyncStatus: lastLog.status,
      productCount,
    };
  }
}

// Singleton instance
let dataSyncService: DataSyncService | null = null;

export function getDataSyncService(): DataSyncService {
  if (!dataSyncService) {
    dataSyncService = new DataSyncService();
  }
  return dataSyncService;
}

/**
 * Convert SeedProduct to Product (add Timestamps)
 */
function seedProductToProduct(sp: SeedProduct): Product {
  const now = Timestamp.now();
  return {
    ...sp,
    updatedAt: now,
    createdAt: now,
  };
}

/**
 * Convert SeedStore to Store (add Timestamps)
 */
function seedStoreToStore(ss: SeedStore): Store {
  return {
    ...ss,
    updatedAt: Timestamp.now(),
  };
}

/**
 * Load seed data from bundled JSON file
 */
function loadSeedData(): SeedData | null {
  if (!fs.existsSync(SEED_DATA_PATH)) {
    logger.debug('No seed data file found', { path: SEED_DATA_PATH });
    return null;
  }

  try {
    const content = fs.readFileSync(SEED_DATA_PATH, 'utf-8');
    const data = JSON.parse(content) as SeedData;
    logger.debug('Loaded seed data', {
      version: data.version,
      products: data.products.length,
      stores: data.stores.length,
    });
    return data;
  } catch (error) {
    logger.error('Failed to load seed data', { error });
    return null;
  }
}

/**
 * Ensure Firestore has data, loading from bundled seed if empty.
 * This function is idempotent - it only loads data once per session
 * and only if the database is empty.
 *
 * Call this at the start of any tool that queries data.
 */
export async function ensureData(): Promise<void> {
  // Fast path: already checked this session
  if (seedDataChecked) {
    return;
  }

  // Prevent concurrent loading
  if (seedDataLoading) {
    return seedDataLoading;
  }

  seedDataLoading = (async () => {
    try {
      const firestore = getFirestoreService();
      const productCount = await firestore.getProductCount();

      if (productCount > 0) {
        logger.debug('Firestore already has data', { productCount });
        seedDataChecked = true;
        return;
      }

      // Database is empty, try to load seed data
      logger.info('Firestore is empty, attempting to load seed data...');

      const seedData = loadSeedData();
      if (!seedData) {
        logger.warn('No seed data available. Run "npm run sync-data" to populate the database.');
        seedDataChecked = true;
        return;
      }

      if (seedData.products.length === 0 && seedData.stores.length === 0) {
        logger.warn('Seed data file is empty. Run "npm run export-seed" to update it.');
        seedDataChecked = true;
        return;
      }

      // Load products
      if (seedData.products.length > 0) {
        logger.info('Loading seed products...', { count: seedData.products.length });
        const products = seedData.products.map(seedProductToProduct);
        await firestore.upsertProducts(products);
        logger.info('Loaded seed products', { count: products.length });
      }

      // Load stores
      if (seedData.stores.length > 0) {
        logger.info('Loading seed stores...', { count: seedData.stores.length });
        for (const seedStore of seedData.stores) {
          const store = seedStoreToStore(seedStore);
          await firestore.upsertStore(store);
        }
        logger.info('Loaded seed stores', { count: seedData.stores.length });
      }

      logger.info('Seed data loaded successfully', {
        version: seedData.version,
        products: seedData.products.length,
        stores: seedData.stores.length,
      });

      seedDataChecked = true;
    } catch (error) {
      logger.error('Failed to ensure data', { error });
      // Mark as checked to avoid repeated failures
      seedDataChecked = true;
      throw error;
    } finally {
      seedDataLoading = null;
    }
  })();

  return seedDataLoading;
}
