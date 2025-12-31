#!/usr/bin/env npx tsx

/**
 * Store sync script - scrapes Alko stores from the website
 * Run with: npm run sync-stores
 *
 * Requires: Firestore emulator or GCP credentials
 */

import { getDataSyncService } from '../src/services/data-sync.js';
import { getAlkoScraper } from '../src/services/scraper.js';
import { logger } from '../src/utils/logger.js';

async function main() {
  logger.info('Starting store sync');

  const syncService = getDataSyncService();

  try {
    const result = await syncService.syncStores();

    if (result.success) {
      logger.info('Store sync completed successfully', {
        storesProcessed: result.storesProcessed,
      });

      console.log('\n=== Store Sync Results ===');
      console.log(`Stores processed: ${result.storesProcessed}`);

      if (result.errors.length > 0) {
        console.log(`Warnings: ${result.errors.length}`);
        result.errors.forEach((e) => console.log(`  - ${e}`));
      }
    } else {
      logger.error('Store sync failed', { errors: result.errors });
      console.error('\nSync failed:', result.errors.join(', '));
      process.exit(1);
    }
  } catch (error) {
    logger.error('Unexpected error during store sync', { error });
    console.error('Error:', error);
    process.exit(1);
  } finally {
    // Close the browser
    const scraper = getAlkoScraper();
    await scraper.close();
  }
}

main();
