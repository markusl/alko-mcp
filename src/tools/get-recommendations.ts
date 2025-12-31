import { z } from 'zod';
import { getFirestoreService } from '../services/firestore.js';
import { getAlkoScraper } from '../services/scraper.js';
import { ensureData } from '../services/data-sync.js';
import { logger } from '../utils/logger.js';
import { findFoodSymbol, FOOD_SYMBOLS } from '../types/food-symbols.js';
import type { Product } from '../types/index.js';

/**
 * Get recommendations tool schema
 */
export const getRecommendationsSchema = z.object({
  preferredTypes: z
    .array(z.string())
    .optional()
    .describe('Preferred product types (e.g., ["punaviinit", "viskit"])'),
  priceRange: z
    .object({
      min: z.number().describe('Minimum price in EUR'),
      max: z.number().describe('Maximum price in EUR'),
    })
    .optional()
    .describe('Price range for recommendations'),
  occasion: z
    .string()
    .optional()
    .describe('Occasion for the drink (e.g., "dinner party", "gift", "casual")'),
  foodPairing: z
    .string()
    .optional()
    .describe(
      'Food to pair with. Uses Alko\'s official food pairing data. ' +
      'Supported categories (Finnish/English): ' +
      'Äyriäiset (seafood/shrimp/lobster/crab), ' +
      'Rasvainen kala (salmon/tuna/mackerel), ' +
      'Vähärasvainen kala (cod/halibut/white fish), ' +
      'Kana, kalkkuna (chicken/turkey/poultry), ' +
      'Nauta (beef/steak), ' +
      'Porsas (pork/ham/bacon), ' +
      'Lammas (lamb), ' +
      'Riista (game/venison/elk), ' +
      'Riistalinnut (duck/pheasant/goose), ' +
      'Sushi (sushi/sashimi/japanese), ' +
      'Pasta ja pizza (pasta/pizza/italian), ' +
      'Grilliruoka (grilled/bbq), ' +
      'Itämainen ruoka (asian/thai/chinese/indian), ' +
      'Tulinen ruoka (spicy/curry/chili), ' +
      'Salaatit, kasvisruoka (salad/vegetarian/vegan), ' +
      'Miedot juustot (mild cheese/brie/mozzarella), ' +
      'Voimakkaat juustot (strong cheese/blue cheese/parmesan), ' +
      'Simpukat ja osterit (mussels/oysters/clams), ' +
      'Sienet (mushrooms/truffle), ' +
      'Makea jälkiruoka (dessert/chocolate/cake), ' +
      'Aperitiivi (aperitif), ' +
      'Seurustelujuoma (social/party), ' +
      'Nautiskelujuoma (digestif/nightcap), ' +
      'Tapas ja antipasti (tapas/antipasti/mezze), ' +
      'Pikkusuolaiset (snacks/finger food), ' +
      'Keitot (soup/stew), ' +
      'Noutopöytä (buffet), ' +
      'Blinit (blini)'
    ),
  preferOrganic: z.boolean().optional().describe('Prefer organic products'),
  preferVegan: z.boolean().optional().describe('Prefer vegan-suitable products'),
  country: z.string().optional().describe('Preferred country of origin'),
  limit: z.number().min(1).max(20).default(5).describe('Number of recommendations'),
});

export type GetRecommendationsInput = z.infer<typeof getRecommendationsSchema>;

/**
 * Occasion keywords mapped to product characteristics
 */
const OCCASIONS: Record<string, { types: string[]; priceMultiplier: number; description: string }> = {
  'dinner party': {
    types: ['punaviinit', 'valkoviinit', 'kuohuviinit ja samppanjat'],
    priceMultiplier: 1.5,
    description: 'elegant dinner party',
  },
  gift: {
    types: ['kuohuviinit ja samppanjat', 'viskit', 'konjakit'],
    priceMultiplier: 2,
    description: 'special gift',
  },
  casual: {
    types: ['punaviinit', 'valkoviinit', 'oluet', 'siiderit'],
    priceMultiplier: 0.8,
    description: 'casual occasion',
  },
  celebration: {
    types: ['kuohuviinit ja samppanjat'],
    priceMultiplier: 1.5,
    description: 'celebration',
  },
  aperitif: {
    types: ['kuohuviinit ja samppanjat', 'valkoviinit', 'roseeviinit'],
    priceMultiplier: 1,
    description: 'aperitif',
  },
  nightcap: {
    types: ['viskit', 'konjakit', 'brandyt, armanjakit ja calvadosit', 'liköörit ja katkerot'],
    priceMultiplier: 1.5,
    description: 'nightcap',
  },
};

/**
 * Get product recommendations based on preferences
 */
export async function getRecommendations(input: GetRecommendationsInput): Promise<{
  recommendations: Product[];
  reasoning: string;
  foodSymbol?: string;
  availableFoodSymbols?: string[];
}> {
  // Ensure seed data is loaded if Firestore is empty
  await ensureData();

  logger.info('Getting recommendations', { input });

  const firestore = getFirestoreService();

  // If food pairing is specified, try to find matching food symbol and scrape
  if (input.foodPairing) {
    const foodSymbol = findFoodSymbol(input.foodPairing);

    if (foodSymbol) {
      logger.info(`Found food symbol for "${input.foodPairing}": ${foodSymbol.name}`);

      try {
        const scraper = getAlkoScraper();
        // Request more products than limit to allow for filtering
        const productIds = await scraper.searchByFoodSymbol(
          foodSymbol.symbolId,
          input.limit * 3
        );

        if (productIds.length > 0) {
          // Fetch full product details from Firestore
          const products: Product[] = [];
          for (const id of productIds) {
            const product = await firestore.getProduct(id);
            if (product) {
              // Apply additional filters
              if (input.preferredTypes && input.preferredTypes.length > 0) {
                if (!input.preferredTypes.includes(product.type)) continue;
              }
              if (input.country && product.country !== input.country) continue;
              if (input.priceRange) {
                if (input.priceRange.min && product.price < input.priceRange.min) continue;
                if (input.priceRange.max && product.price > input.priceRange.max) continue;
              }
              if (input.preferOrganic && product.specialGroup !== 'Luomu') continue;
              if (input.preferVegan && !product.specialGroup?.includes('Vegaaneille')) continue;

              products.push(product);

              if (products.length >= input.limit) break;
            }
          }

          const reasoningParts: string[] = [`pairs with ${foodSymbol.name}`];
          if (input.preferredTypes?.length) {
            reasoningParts.push(`type: ${input.preferredTypes.join(', ')}`);
          }
          if (input.country) {
            reasoningParts.push(`from ${input.country}`);
          }
          if (input.priceRange) {
            reasoningParts.push(`€${input.priceRange.min || 0}-${input.priceRange.max || '∞'}`);
          }
          if (input.preferOrganic) {
            reasoningParts.push('organic');
          }
          if (input.preferVegan) {
            reasoningParts.push('vegan');
          }

          return {
            recommendations: products,
            reasoning: `Products that ${reasoningParts.join(', ')} (from Alko's official food pairing data).`,
            foodSymbol: foodSymbol.name,
          };
        }
      } catch (error) {
        logger.error('Failed to scrape food symbol products, falling back to database search', { error });
        // Fall through to database search
      }
    } else {
      // Food symbol not found - return available options
      logger.info(`No food symbol found for "${input.foodPairing}"`);
      return {
        recommendations: [],
        reasoning: `No matching food pairing found for "${input.foodPairing}". Try one of the available food categories.`,
        availableFoodSymbols: FOOD_SYMBOLS.map(s => s.name),
      };
    }
  }

  // Fallback: Database search (for occasions or when food symbol search fails)
  let types: string[] = input.preferredTypes || [];

  // Apply occasion logic
  let priceMultiplier = 1;
  if (input.occasion) {
    const occasionLower = input.occasion.toLowerCase();
    for (const [occasion, config] of Object.entries(OCCASIONS)) {
      if (occasionLower.includes(occasion)) {
        types = [...types, ...config.types];
        priceMultiplier = config.priceMultiplier;
        break;
      }
    }
  }

  // Remove duplicates
  types = [...new Set(types)];

  // Build filters
  const filters: Record<string, unknown> = {};

  if (types.length === 1) {
    filters.type = types[0];
  }

  if (input.country) {
    filters.country = input.country;
  }

  // Adjust price range with occasion multiplier
  let minPrice = input.priceRange?.min;
  let maxPrice = input.priceRange?.max;
  if (priceMultiplier !== 1 && maxPrice) {
    maxPrice = maxPrice * priceMultiplier;
  }
  if (minPrice !== undefined) {
    filters.minPrice = minPrice;
  }
  if (maxPrice !== undefined) {
    filters.maxPrice = maxPrice;
  }

  if (input.preferOrganic) {
    filters.specialGroup = 'Luomu';
  } else if (input.preferVegan) {
    filters.specialGroup = 'Vegaaneille soveltuva tuote';
  }

  // Fetch products
  const result = await firestore.searchProducts(filters as never, {
    limit: input.limit * 3, // Fetch more to allow for filtering
    sortBy: 'price',
    sortOrder: 'desc',
  });

  // Filter by types if multiple
  let products = result.products;
  if (types.length > 1) {
    products = products.filter((p) => types.includes(p.type));
  }

  // Score and rank products (simple scoring)
  const scored = products.map((product) => {
    let score = 0;

    // Prefer products with descriptions
    if (product.description) score += 2;

    // Prefer newer products slightly
    if (product.isNew) score += 1;

    // Prefer products in standard assortment
    if (product.assortment === 'vakiovalikoima') score += 1;

    // Prefer special groups if requested
    if (input.preferOrganic && product.specialGroup === 'Luomu') score += 3;
    if (input.preferVegan && product.specialGroup?.includes('Vegaaneille')) score += 3;

    return { product, score };
  });

  // Sort by score and take top N
  scored.sort((a, b) => b.score - a.score);
  const recommendations = scored.slice(0, input.limit).map((s) => s.product);

  // Build reasoning
  const reasoningParts: string[] = [];
  if (input.occasion) {
    reasoningParts.push(`suitable for ${input.occasion}`);
  }
  if (input.preferOrganic) {
    reasoningParts.push('organic products');
  }
  if (input.preferVegan) {
    reasoningParts.push('vegan-suitable');
  }
  if (input.priceRange) {
    reasoningParts.push(`within €${input.priceRange.min || 0}-${input.priceRange.max || '∞'} range`);
  }

  const reasoning =
    reasoningParts.length > 0
      ? `Recommendations based on: ${reasoningParts.join(', ')}.`
      : 'General recommendations based on quality and value.';

  return {
    recommendations,
    reasoning,
  };
}
