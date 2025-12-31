import { z } from 'zod';
import { getVivinoScraper } from '../services/vivino-scraper.js';
import { logger } from '../utils/logger.js';
import type { VivinoRatingResult } from '../types/vivino.js';

/**
 * Get Vivino rating tool schema
 */
export const getVivinoRatingSchema = z.object({
  wineName: z
    .string()
    .optional()
    .describe('The wine name to search for on Vivino (e.g., "Chateau Margaux")'),
  winery: z
    .string()
    .optional()
    .describe('The winery/producer name to help narrow down the search'),
  vivinoUrl: z
    .string()
    .optional()
    .describe('Direct Vivino URL if known (e.g., "https://www.vivino.com/wines/1129971")'),
}).refine(
  (data) => data.wineName || data.vivinoUrl,
  { message: 'Either wineName or vivinoUrl must be provided' }
);

export type GetVivinoRatingInput = z.infer<typeof getVivinoRatingSchema>;

/**
 * Get Vivino rating for a wine
 * Can search by wine name or fetch directly from Vivino URL
 */
export async function getVivinoRating(input: GetVivinoRatingInput): Promise<VivinoRatingResult> {
  logger.info('Getting Vivino rating', { wineName: input.wineName, winery: input.winery, vivinoUrl: input.vivinoUrl });

  const scraper = getVivinoScraper();

  try {
    let result: VivinoRatingResult;

    if (input.vivinoUrl) {
      // Fetch rating from direct URL
      result = await scraper.getRatingByUrl(input.vivinoUrl);
    } else if (input.wineName) {
      // Search by wine name
      result = await scraper.getWineRating(input.wineName, input.winery);
    } else {
      // This shouldn't happen due to schema validation, but handle it anyway
      result = {
        found: false,
        rating: null,
        error: 'Either wineName or vivinoUrl must be provided',
        fromCache: false,
      };
    }

    if (result.found && result.rating) {
      logger.info('Vivino rating retrieved', {
        wineName: result.rating.wineName,
        rating: result.rating.averageRating,
        ratingsCount: result.rating.ratingsCount,
        fromCache: result.fromCache,
      });
    } else {
      logger.info('No Vivino rating found', { error: result.error });
    }

    return result;
  } catch (error) {
    logger.error('Failed to get Vivino rating', { error });

    return {
      found: false,
      rating: null,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      fromCache: false,
    };
  }
}
