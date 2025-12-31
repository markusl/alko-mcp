#!/usr/bin/env npx tsx

/**
 * Manual data sync script
 * Run with: npm run sync-data
 */

import { getDataSyncService } from '../src/services/data-sync.js';
import { logger } from '../src/utils/logger.js';

async function main() {
  logger.info('Starting manual data sync');

  const syncService = getDataSyncService();
  const result = await syncService.syncProducts();

  if (result.success) {
    logger.info('Sync completed successfully', {
      productsProcessed: result.productsProcessed,
      productsAdded: result.productsAdded,
      productsUpdated: result.productsUpdated,
    });
  } else {
    logger.error('Sync failed', { errors: result.errors });
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error('Unexpected error', { error });
  process.exit(1);
});
