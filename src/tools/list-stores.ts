import { z } from 'zod';
import { getFirestoreService } from '../services/firestore.js';
import { ensureData } from '../services/data-sync.js';
import { logger } from '../utils/logger.js';
import type { Store } from '../types/index.js';

/**
 * List stores tool schema
 */
export const listStoresSchema = z.object({
  city: z.string().optional().describe('Filter by city name (e.g., "Helsinki", "Tampere")'),
  limit: z.number().min(1).max(200).default(50).describe('Maximum number of stores to return'),
});

export type ListStoresInput = z.infer<typeof listStoresSchema>;

/**
 * List Alko stores
 */
export async function listStores(input: ListStoresInput): Promise<Store[]> {
  // Ensure seed data is loaded if Firestore is empty
  await ensureData();

  logger.info('Listing stores', { city: input.city, limit: input.limit });

  const firestore = getFirestoreService();

  const stores = await firestore.listStores(input.city, input.limit);

  return stores;
}

