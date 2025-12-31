import { z } from 'zod';
import { getAlkoScraper } from '../services/scraper.js';
import { getFirestoreService } from '../services/firestore.js';
import { ensureData } from '../services/data-sync.js';
import { logger } from '../utils/logger.js';
import type { AvailabilityResult } from '../types/index.js';

/**
 * Get availability tool schema
 */
export const getAvailabilitySchema = z.object({
  productId: z.string().describe('The Alko product ID (e.g., "906458")'),
  city: z.string().optional().describe('Filter by city name (e.g., "Helsinki", "Tampere")'),
  forceRefresh: z
    .boolean()
    .default(false)
    .describe('Force a fresh scrape instead of using cached data'),
});

export type GetAvailabilityInput = z.infer<typeof getAvailabilitySchema>;

/**
 * Get store availability for a product
 */
export async function getAvailability(input: GetAvailabilityInput): Promise<AvailabilityResult | null> {
  // Ensure seed data is loaded if Firestore is empty
  await ensureData();

  logger.info('Getting availability', { productId: input.productId, city: input.city });

  const scraper = getAlkoScraper();
  const firestore = getFirestoreService();

  // Get product name for display
  const product = await firestore.getProduct(input.productId);

  if (!input.forceRefresh) {
    // Try to get cached data first
    const cached = await scraper.getCachedAvailability(input.productId);
    if (cached) {
      // Filter by city if specified - create a copy to avoid mutating cache
      let stores = cached.stores;
      if (input.city) {
        const cityLower = input.city.toLowerCase();
        stores = stores.filter((s) =>
          s.storeName.toLowerCase().includes(cityLower)
        );
      }
      return { ...cached, stores };
    }
  }

  // Scrape fresh data
  try {
    const result = await scraper.getProductAvailability(
      input.productId,
      product?.name
    );

    // Filter by city if specified - create a copy to avoid mutating result
    let stores = result.stores;
    if (input.city) {
      const cityLower = input.city.toLowerCase();
      stores = stores.filter((s) =>
        s.storeName.toLowerCase().includes(cityLower)
      );
    }

    return { ...result, stores };
  } catch (error) {
    logger.error('Failed to get availability', { error });

    // Return cached data if available, even if stale
    const cached = await scraper.getCachedAvailability(input.productId);
    if (cached) {
      logger.info('Returning stale cached availability');
      return cached;
    }

    return null;
  }
}

