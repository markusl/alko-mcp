import { z } from 'zod';
import { Timestamp } from '@google-cloud/firestore';
import { getFirestoreService } from '../services/firestore.js';
import { getDataSyncService, ensureData } from '../services/data-sync.js';
import { logger } from '../utils/logger.js';
import type { Store } from '../types/index.js';

/**
 * Get store hours tool schema
 */
export const getStoreHoursSchema = z.object({
  storeId: z.string().optional().describe('Specific store ID to get hours for'),
  storeName: z.string().optional().describe('Search by store name (partial match, e.g., "Kamppi" or "Helsinki Arkadia")'),
  city: z.string().optional().describe('Filter by city name (e.g., "Helsinki", "Tampere")'),
  openNow: z.boolean().optional().describe('Filter to only show stores currently open'),
  limit: z.number().min(1).max(100).default(20).describe('Maximum number of stores to return'),
});

export type GetStoreHoursInput = z.infer<typeof getStoreHoursSchema>;

/**
 * Check if a store is currently open based on opening hours
 */
function isStoreOpenNow(openingHours: string | null): boolean {
  if (!openingHours || openingHours === 'SULJETTU') {
    return false;
  }

  const match = openingHours.match(/(\d{1,2})-(\d{1,2})/);
  if (!match) {
    return false;
  }

  const openHour = parseInt(match[1], 10);
  const closeHour = parseInt(match[2], 10);
  const currentHour = new Date().getHours();

  return currentHour >= openHour && currentHour < closeHour;
}

/**
 * Check if a store's data is stale (not updated today).
 * Opening hours are only valid for the day they were scraped.
 */
function isStoreDataStale(store: Store): boolean {
  if (!store.updatedAt) {
    return true;
  }

  const updatedDate = store.updatedAt instanceof Timestamp
    ? store.updatedAt.toDate()
    : new Date(store.updatedAt as unknown as string);

  const today = new Date();

  // Compare dates (ignoring time)
  return (
    updatedDate.getFullYear() !== today.getFullYear() ||
    updatedDate.getMonth() !== today.getMonth() ||
    updatedDate.getDate() !== today.getDate()
  );
}

/**
 * Get store opening hours
 */
export async function getStoreHours(input: GetStoreHoursInput): Promise<{
  stores: Array<{
    id: string;
    name: string;
    city: string;
    address: string;
    openingHoursToday: string | null;
    openingHoursTomorrow: string | null;
    isOpenNow: boolean;
  }>;
  currentTime: string;
  dataAsOf: string | null;
  refreshed: boolean;
  refreshError: string | null;
}> {
  // Ensure seed data is loaded if Firestore is empty
  await ensureData();

  logger.info('Getting store hours', { input });

  const firestore = getFirestoreService();

  let stores: Store[];

  if (input.storeId) {
    // Get specific store by ID
    const store = await firestore.getStore(input.storeId);
    stores = store ? [store] : [];
  } else {
    // List stores with optional city filter
    stores = await firestore.listStores(input.city, 200); // Get more to filter
  }

  // Filter by store name if provided
  if (input.storeName) {
    const searchTerm = input.storeName.toLowerCase();
    stores = stores.filter(s => s.name.toLowerCase().includes(searchTerm));
  }

  // Check if store data is stale and auto-refresh if needed
  const hasStaleData = stores.length > 0 && stores.some(isStoreDataStale);
  let refreshed = false;
  let refreshError: string | null = null;

  if (hasStaleData) {
    logger.info('Store data is stale, refreshing from Alko.fi...');
    try {
      const dataSync = getDataSyncService();
      await dataSync.syncStores();
      refreshed = true;

      // Re-fetch stores after refresh
      if (input.storeId) {
        const store = await firestore.getStore(input.storeId);
        stores = store ? [store] : [];
      } else {
        stores = await firestore.listStores(input.city, 200);
      }

      // Re-apply name filter
      if (input.storeName) {
        const searchTerm = input.storeName.toLowerCase();
        stores = stores.filter(s => s.name.toLowerCase().includes(searchTerm));
      }

      logger.info('Store data refreshed successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to refresh store data', { error });
      refreshError = `Failed to refresh store data: ${errorMessage}. Opening hours may be outdated.`;
    }
  }

  // Determine the data freshness after potential refresh
  const isDataStale = stores.length > 0 && stores.some(isStoreDataStale);

  // Get the oldest update timestamp for dataAsOf
  let dataAsOf: string | null = null;
  if (stores.length > 0) {
    const oldestUpdate = stores.reduce((oldest, store) => {
      if (!store.updatedAt) return oldest;
      const storeDate = store.updatedAt instanceof Timestamp
        ? store.updatedAt.toDate()
        : new Date(store.updatedAt as unknown as string);
      if (!oldest || storeDate < oldest) return storeDate;
      return oldest;
    }, null as Date | null);

    if (oldestUpdate) {
      dataAsOf = oldestUpdate.toISOString().split('T')[0]; // YYYY-MM-DD format
    }
  }

  // Map to result format with isOpenNow
  // If data is still stale (refresh failed), hours are unreliable
  let results = stores.map(store => {
    const storeIsStale = isStoreDataStale(store);
    return {
      id: store.id,
      name: store.name,
      city: store.city,
      address: `${store.address}, ${store.postalCode}`,
      openingHoursToday: storeIsStale ? null : store.openingHoursToday,
      openingHoursTomorrow: storeIsStale ? null : store.openingHoursTomorrow,
      isOpenNow: storeIsStale ? false : isStoreOpenNow(store.openingHoursToday),
    };
  });

  // Filter to only open stores if requested
  if (input.openNow) {
    results = results.filter(s => s.isOpenNow);
  }

  // Apply limit
  results = results.slice(0, input.limit);

  const now = new Date();
  const currentTime = now.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });

  logger.info('Store hours retrieved', {
    found: results.length,
    openNow: results.filter(s => s.isOpenNow).length,
    staleData: isDataStale,
    refreshed,
  });

  return {
    stores: results,
    currentTime,
    dataAsOf,
    refreshed,
    refreshError,
  };
}
