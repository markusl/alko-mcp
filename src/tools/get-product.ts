import { z } from 'zod';
import { getFirestoreService } from '../services/firestore.js';
import { getCacheService } from '../services/cache.js';
import { getAlkoScraper } from '../services/scraper.js';
import { ensureData } from '../services/data-sync.js';
import { logger } from '../utils/logger.js';
import type { Product } from '../types/index.js';

/**
 * Get product tool schema
 */
export const getProductSchema = z.object({
  productId: z.string().describe('The Alko product ID (e.g., "906458")'),
  includeEnrichedData: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'If true, scrapes additional data from product page: taste profile, usage tips, serving suggestions, and food pairings. This is slower but provides more detailed information.'
    ),
});

export type GetProductInput = z.infer<typeof getProductSchema>;

/**
 * Get detailed information about a specific product
 */
export async function getProduct(input: GetProductInput): Promise<Product | null> {
  // Ensure seed data is loaded if Firestore is empty
  await ensureData();

  logger.info('Getting product', { productId: input.productId, includeEnrichedData: input.includeEnrichedData });

  const cache = getCacheService();
  const firestore = getFirestoreService();

  // Check cache first
  const cached = cache.getProduct(input.productId);
  if (cached && !input.includeEnrichedData) {
    logger.debug('Cache hit for product');
    return cached;
  }

  // Query Firestore
  let product = await firestore.getProduct(input.productId);

  if (!product) {
    return null;
  }

  // Scrape enriched data if requested
  if (input.includeEnrichedData) {
    // Check if we already have enriched data in Firestore
    const hasEnrichedData = product.tasteProfile || product.usageTips || product.servingSuggestion ||
      (product.foodPairings && product.foodPairings.length > 0) ||
      (product.certificates && product.certificates.length > 0) ||
      product.ingredients || product.smokiness !== null;

    if (hasEnrichedData) {
      logger.debug('Product already has enriched data, skipping scrape', { productId: input.productId });
    } else {
      // Need to scrape enriched data
      try {
        const scraper = getAlkoScraper();
        const enrichedData = await scraper.scrapeProductDetails(input.productId);

        if (enrichedData) {
          const enrichedFields = {
            tasteProfile: enrichedData.tasteProfile,
            usageTips: enrichedData.usageTips,
            servingSuggestion: enrichedData.servingSuggestion,
            foodPairings: enrichedData.foodPairings.length > 0 ? enrichedData.foodPairings : null,
            certificates: enrichedData.certificates.length > 0 ? enrichedData.certificates : null,
            ingredients: enrichedData.ingredients,
            smokiness: enrichedData.smokiness,
            smokinessLabel: enrichedData.smokinessLabel,
          };

          // Merge enriched data into product
          product = {
            ...product,
            ...enrichedFields,
          };

          // Persist to Firestore so we don't need to scrape again
          try {
            await firestore.updateProduct(input.productId, enrichedFields);
            logger.info('Persisted enriched data to Firestore', { productId: input.productId });
          } catch (persistError) {
            logger.warn('Failed to persist enriched data to Firestore', { productId: input.productId, error: persistError });
          }

          logger.info('Enriched product with scraped data', {
            productId: input.productId,
            hasTaste: !!enrichedData.tasteProfile,
            hasTips: !!enrichedData.usageTips,
            hasServing: !!enrichedData.servingSuggestion,
            hasIngredients: !!enrichedData.ingredients,
            pairingsCount: enrichedData.foodPairings.length,
            certificatesCount: enrichedData.certificates.length,
            smokiness: enrichedData.smokiness,
          });
        }
      } catch (error) {
        logger.warn('Failed to scrape enriched data, returning base product', { productId: input.productId, error });
      }
    }
  }

  // Cache the result
  cache.setProduct(input.productId, product);

  logger.info('Product retrieved', { productId: input.productId, found: !!product, name: product?.name });

  return product;
}

