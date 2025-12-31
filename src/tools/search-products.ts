import { z } from 'zod';
import { getFirestoreService } from '../services/firestore.js';
import { getCacheService } from '../services/cache.js';
import { ensureData } from '../services/data-sync.js';
import { logger } from '../utils/logger.js';
import type { ProductSearchFilters, ProductSearchOptions } from '../types/index.js';

/**
 * Search products tool schema
 */
export const searchProductsSchema = z.object({
  query: z.string().optional().describe('Text search query for product name, producer, or description'),
  type: z.string().optional().describe('Product type (e.g., "punaviinit", "oluet", "viskit")'),
  country: z.string().optional().describe('Country of origin (e.g., "Ranska", "Italia", "Suomi")'),
  region: z.string().optional().describe('Region within country (e.g., "Bordeaux", "Toscana")'),
  minPrice: z.number().optional().describe('Minimum price in EUR'),
  maxPrice: z.number().optional().describe('Maximum price in EUR'),
  minAlcohol: z.number().optional().describe('Minimum alcohol percentage'),
  maxAlcohol: z.number().optional().describe('Maximum alcohol percentage'),
  assortment: z
    .enum(['vakiovalikoima', 'tilausvalikoima', 'erikoiserä', 'kausituote'])
    .optional()
    .describe('Assortment type: vakiovalikoima (in stores), tilausvalikoima (order only)'),
  specialGroup: z.string().optional().describe('Special group (e.g., "Luomu", "Vegaaneille soveltuva tuote")'),
  beerType: z.string().optional().describe('Beer type for beer products (e.g., "ipa", "lager", "stout & porter")'),
  isNew: z.boolean().optional().describe('Filter for new products only'),
  isOrganic: z.boolean().optional().describe('Filter for organic products only'),
  isVegan: z.boolean().optional().describe('Filter for vegan-suitable products only'),
  minSmokiness: z.number().min(0).max(4).optional().describe('Minimum smokiness level (0-4, for whiskeys: 0=ei savuinen, 4=voimakkaan savuinen)'),
  maxSmokiness: z.number().min(0).max(4).optional().describe('Maximum smokiness level (0-4, for whiskeys: 0=ei savuinen, 4=voimakkaan savuinen)'),
  sortBy: z
    .enum(['price', 'name', 'alcohol', 'pricePerLiter'])
    .default('name')
    .describe('Field to sort by'),
  sortOrder: z.enum(['asc', 'desc']).default('asc').describe('Sort order'),
  limit: z.number().min(1).max(100).default(20).describe('Maximum number of results to return'),
  offset: z.number().min(0).default(0).describe('Number of results to skip for pagination'),
});

export type SearchProductsInput = z.infer<typeof searchProductsSchema>;

/**
 * Search products in the Alko catalog
 */
export async function searchProducts(input: SearchProductsInput) {
  // Ensure seed data is loaded if Firestore is empty
  await ensureData();

  logger.info('Searching products', { input });

  const cache = getCacheService();
  const firestore = getFirestoreService();

  // Build filters
  const filters: ProductSearchFilters = {
    query: input.query,
    type: input.type,
    country: input.country,
    region: input.region,
    minPrice: input.minPrice,
    maxPrice: input.maxPrice,
    minAlcohol: input.minAlcohol,
    maxAlcohol: input.maxAlcohol,
    assortment: input.assortment,
    specialGroup: input.specialGroup,
    beerType: input.beerType,
    isNew: input.isNew,
    minSmokiness: input.minSmokiness as 0 | 1 | 2 | 3 | 4 | undefined,
    maxSmokiness: input.maxSmokiness as 0 | 1 | 2 | 3 | 4 | undefined,
  };

  // Handle special filters
  if (input.isOrganic) {
    filters.specialGroup = 'Luomu';
  }
  if (input.isVegan) {
    filters.specialGroup = 'Vegaaneille soveltuva tuote';
  }

  // Build options
  const options: ProductSearchOptions = {
    sortBy: input.sortBy,
    sortOrder: input.sortOrder,
    limit: input.limit,
    offset: input.offset,
  };

  // Check cache first
  const cacheKey = { ...filters, ...options };
  const cached = cache.getSearchResults(cacheKey);
  if (cached) {
    logger.debug('Cache hit for search');
    return {
      products: cached,
      total: cached.length,
      limit: input.limit,
      offset: input.offset,
      hasMore: false,
      fromCache: true,
    };
  }

  // Query Firestore
  const result = await firestore.searchProducts(filters, options);

  // Cache the results
  cache.setSearchResults(cacheKey, result.products);

  logger.info('Search completed', { found: result.products.length, total: result.total, hasMore: result.hasMore });

  return {
    ...result,
    fromCache: false,
  };
}

