export * from './product.js';
export * from './store.js';
export * from './availability.js';
export * from './seed-data.js';
export * from './vivino.js';
export * from './food-symbols.js';

import { Timestamp } from '@google-cloud/firestore';

/**
 * Sync log for tracking data synchronization
 */
export interface SyncLog {
  id: string;
  type: 'product_sync' | 'availability_sync' | 'store_sync';
  status: 'started' | 'completed' | 'failed';
  productsProcessed: number;
  productsAdded: number;
  productsUpdated: number;
  errors: string[];
  startedAt: Timestamp;
  completedAt: Timestamp | null;
  sourceUrl: string;
}

/**
 * Application configuration
 */
export interface AppConfig {
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  gcpProject: string | null;
  firestoreDatabase: string;
  alkoPriceListUrl: string;
  scrapeRateLimitMs: number;
  scrapeCacheTtlMs: number;
  syncCronSchedule: string;
}
