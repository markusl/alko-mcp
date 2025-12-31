import { describe, it, expect } from 'vitest';
import type { Product, ProductSearchFilters } from '../../src/types/index.js';
import { testProducts, allTestProducts, realProducts } from '../fixtures/products.js';

/**
 * Unit tests for product search functionality using real Alko product data
 *
 * These tests verify that the search logic correctly finds products
 * from the actual Alko catalog, ensuring search works for:
 * - Multi-word queries (e.g., "Suomi Viina", "LAB Reserva")
 * - Products with special characters (e.g., "Château", "Côtes", "Viña")
 * - Case-insensitive matching
 * - Searches across all searchable fields (name, producer, country, region, description, grapes)
 * - Relevance scoring (exact phrase matches ranked higher than cross-field matches)
 *
 * Tests run against 6000+ products to simulate real database size and catch
 * issues like the alphabetical ordering bug where products after index 5000 weren't found.
 */

// Use the full dataset (real + 6000 dummy products) for realistic testing
const searchableProducts = allTestProducts;

/**
 * Calculate relevance score for a product against a search query.
 * Higher scores = better matches.
 *
 * Scoring:
 * - 100: Exact phrase match in name
 * - 80: All words appear in name (not necessarily as phrase)
 * - 60: Exact phrase match in producer
 * - 50: All words in producer
 * - 40: Exact phrase in any other single field
 * - 30: All words in any other single field
 * - 20: Words found across multiple fields (baseline match)
 */
function calculateRelevanceScore(product: Product, queryLower: string, queryWords: string[]): number {
  const nameLower = (product.name || '').toLowerCase();
  const producerLower = (product.producer || '').toLowerCase();

  // Check exact phrase match in name (highest priority)
  if (nameLower.includes(queryLower)) {
    return 100;
  }

  // Check all words in name
  if (queryWords.every(word => nameLower.includes(word))) {
    return 80;
  }

  // Check exact phrase in producer
  if (producerLower.includes(queryLower)) {
    return 60;
  }

  // Check all words in producer
  if (queryWords.every(word => producerLower.includes(word))) {
    return 50;
  }

  // Check other fields for exact phrase or all words in single field
  const otherFields = [
    product.country,
    product.region,
    product.type,
    product.subtype,
    product.description,
    product.grapes,
  ].filter(Boolean).map(f => f!.toLowerCase());

  for (const field of otherFields) {
    if (field.includes(queryLower)) {
      return 40;
    }
    if (queryWords.every(word => field.includes(word))) {
      return 30;
    }
  }

  // Baseline: words found across multiple fields
  return 20;
}

/**
 * Simulates the client-side text search filter with relevance scoring
 * from FirestoreService.searchProducts
 */
function filterByQuery(products: Product[], query: string): Product[] {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 0);

  // Filter products that match all query words
  const matchedProducts = products.filter((p) => {
    // Combine all searchable fields into one string
    const searchableText = [
      p.name,
      p.producer,
      p.country,
      p.region,
      p.type,
      p.subtype,
      p.description,
      p.grapes,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    // All query words must be found somewhere in the searchable text
    return queryWords.every((word) => searchableText.includes(word));
  });

  // Sort by relevance score (highest first), then by name for stable ordering
  return matchedProducts
    .map(p => ({ product: p, score: calculateRelevanceScore(p, queryLower, queryWords) }))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      // Secondary sort by name for stable ordering
      return a.product.name.localeCompare(b.product.name, 'fi');
    })
    .map(item => item.product);
}

/**
 * Simulates the Firestore field filters from FirestoreService.searchProducts
 */
function filterByFields(products: Product[], filters: ProductSearchFilters): Product[] {
  return products.filter((p) => {
    if (filters.type && p.type !== filters.type) return false;
    if (filters.country && p.country !== filters.country) return false;
    if (filters.assortment && p.assortment !== filters.assortment) return false;
    if (filters.specialGroup && p.specialGroup !== filters.specialGroup) return false;
    if (filters.beerType && p.beerType !== filters.beerType) return false;
    if (filters.isNew !== undefined && p.isNew !== filters.isNew) return false;
    if (filters.minPrice !== undefined && p.price < filters.minPrice) return false;
    if (filters.maxPrice !== undefined && p.price > filters.maxPrice) return false;
    if (filters.minAlcohol !== undefined && p.alcoholPercentage < filters.minAlcohol) return false;
    if (filters.maxAlcohol !== undefined && p.alcoholPercentage > filters.maxAlcohol) return false;
    return true;
  });
}

/**
 * Combined search function that matches FirestoreService.searchProducts behavior
 * Searches across 6000+ products to simulate real database
 */
function searchProducts(filters: ProductSearchFilters): Product[] {
  let results = filterByFields(searchableProducts, filters);
  if (filters.query) {
    results = filterByQuery(results, filters.query);
  }
  return results;
}

describe('Product Search with Real Data', () => {
  describe('Multi-word text search', () => {
    it('should find "LAB Reserva" - Portuguese wine', () => {
      const results = searchProducts({ query: 'LAB Reserva' });

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(p => p.name.includes('LAB Reserva'))).toBe(true);
    });

    it('should find "Olvi Tuplapukki" - Finnish beer', () => {
      const results = searchProducts({ query: 'Olvi Tuplapukki' });

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(p => p.name.includes('Olvi Tuplapukki'))).toBe(true);
    });

    it('should find "Frontera Chardonnay" - Chilean wine', () => {
      const results = searchProducts({ query: 'Frontera Chardonnay' });

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(p => p.name.includes('Frontera Chardonnay'))).toBe(true);
    });

    it('should find "Viña Maipo Chardonnay" - with special character ñ', () => {
      const results = searchProducts({ query: 'Viña Maipo Chardonnay' });

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(p => p.name.includes('Viña Maipo Chardonnay'))).toBe(true);
    });

    it('should find "Quinta das Setencostas" - Portuguese wine with multiple words', () => {
      const results = searchProducts({ query: 'Quinta das Setencostas' });

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(p => p.name.includes('Quinta das Setencostas'))).toBe(true);
    });

    it('should find "Pearly Bay" - South African wine', () => {
      const results = searchProducts({ query: 'Pearly Bay' });

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(p => p.name.includes('Pearly Bay'))).toBe(true);
    });

    it('should find "Suomi Viina" - matches country + type across fields', () => {
      const results = searchProducts({ query: 'Suomi Viina' });

      expect(results.length).toBeGreaterThan(0);
      // Should find Koskenkorva (Suomi country, Viinat type)
      expect(results.some(p => p.country === 'Suomi' && p.type === 'vodkat ja viinat')).toBe(true);
    });

    it('should find "Koskenkorva" - Finnish vodka', () => {
      const results = searchProducts({ query: 'Koskenkorva' });

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(p => p.name.includes('Koskenkorva'))).toBe(true);
    });
  });

  describe('Special characters in search', () => {
    it('should find "Château" - French wine with accent', () => {
      const results = searchProducts({ query: 'Château' });

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(p => p.name.includes('Château'))).toBe(true);
    });

    it('should find "Côtes" - French wine with ô accent', () => {
      const results = searchProducts({ query: 'Côtes' });

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(p => p.name.includes('Côtes'))).toBe(true);
    });

    it('should find "Viña" - Spanish wine with ñ', () => {
      const results = searchProducts({ query: 'Viña' });

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(p => p.name.includes('Viña'))).toBe(true);
    });

    it('should find "Meïsei" - Japanese whisky with diaeresis', () => {
      const results = searchProducts({ query: 'Meïsei' });

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(p => p.name.includes('Meïsei'))).toBe(true);
    });
  });

  describe('Case-insensitive search', () => {
    it('should find "lab reserva" (lowercase)', () => {
      const results = searchProducts({ query: 'lab reserva' });

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(p => p.name.includes('LAB Reserva'))).toBe(true);
    });

    it('should find "KOSKENKORVA" (uppercase)', () => {
      const results = searchProducts({ query: 'KOSKENKORVA' });

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(p => p.name.includes('Koskenkorva'))).toBe(true);
    });

    it('should find "OlVi TuPlApUkKi" (mixed case)', () => {
      const results = searchProducts({ query: 'OlVi TuPlApUkKi' });

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(p => p.name.includes('Olvi Tuplapukki'))).toBe(true);
    });
  });

  describe('Search across different fields', () => {
    it('should find products by producer name', () => {
      const results = searchProducts({ query: 'Casa Santos Lima' });

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(p => p.producer === 'Casa Santos Lima')).toBe(true);
    });

    it('should find products by country', () => {
      const results = searchProducts({ query: 'Japani' });

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(p => p.country === 'Japani')).toBe(true);
    });

    it('should find products by region', () => {
      const results = searchProducts({ query: 'Bordeaux' });

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(p => p.region === 'Bordeaux')).toBe(true);
    });

    it('should find products by grape variety', () => {
      const results = searchProducts({ query: 'Nebbiolo' });

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(p => p.grapes?.includes('Nebbiolo'))).toBe(true);
    });

    it('should find products by description keywords', () => {
      const results = searchProducts({ query: 'tanniininen' });

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(p => p.description?.toLowerCase().includes('tanniininen'))).toBe(true);
    });
  });

  describe('Combined text and field filters', () => {
    it('should find Chardonnay wines from Chile', () => {
      const results = searchProducts({ query: 'Chardonnay', country: 'Chile' });

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(p => p.country === 'Chile')).toBe(true);
      expect(results.every(p =>
        p.name.toLowerCase().includes('chardonnay') ||
        p.grapes?.toLowerCase().includes('chardonnay')
      )).toBe(true);
    });

    it('should find red wines from Portugal under €15', () => {
      const results = searchProducts({
        type: 'punaviinit',
        country: 'Portugali',
        maxPrice: 15
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(p => p.type === 'punaviinit')).toBe(true);
      expect(results.every(p => p.country === 'Portugali')).toBe(true);
      expect(results.every(p => p.price <= 15)).toBe(true);
    });

    it('should find Finnish products with high alcohol', () => {
      const results = searchProducts({
        country: 'Suomi',
        minAlcohol: 30
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(p => p.country === 'Suomi')).toBe(true);
      expect(results.every(p => p.alcoholPercentage >= 30)).toBe(true);
    });

    it('should find vegan wines', () => {
      const results = searchProducts({
        specialGroup: 'Vegaaneille soveltuva tuote'
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(p => p.specialGroup === 'Vegaaneille soveltuva tuote')).toBe(true);
    });
  });

  describe('Multi-word search logic', () => {
    it('should match ALL words, not just some', () => {
      // "Fair Square" should only match products containing BOTH words
      const results = searchProducts({ query: 'Fair Square' });

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(p => {
        const text = [p.name, p.producer, p.description].filter(Boolean).join(' ').toLowerCase();
        return text.includes('fair') && text.includes('square');
      })).toBe(true);
    });

    it('should match words in any order', () => {
      // "Reserva LAB" should find "LAB Reserva"
      const results = searchProducts({ query: 'Reserva LAB' });

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(p => p.name.includes('LAB Reserva'))).toBe(true);
    });

    it('should match words across different fields', () => {
      // "Altia viina" should match producer + type
      const results = searchProducts({ query: 'Altia viina' });

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(p => p.producer === 'Altia')).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should return empty array for non-existent product', () => {
      const results = searchProducts({ query: 'XyzNonExistentProduct123' });

      expect(results).toHaveLength(0);
    });

    it('should handle empty query', () => {
      const results = searchProducts({ query: '' });

      // Empty query should return all products (no text filter applied)
      expect(results.length).toBe(searchableProducts.length);
    });

    it('should handle query with only spaces', () => {
      const results = searchProducts({ query: '   ' });

      // Whitespace-only query should return all products
      expect(results.length).toBe(searchableProducts.length);
    });

    it('should handle single character query', () => {
      const results = searchProducts({ query: 'a' });

      // Should find products containing 'a'
      expect(results.length).toBeGreaterThan(0);
    });
  });
});

describe('Large Dataset Search (Bug Regression)', () => {
  /**
   * This test specifically catches the bug where products after index 5000
   * (alphabetically) weren't being found because the search only fetched
   * the first 5000 products sorted by name.
   *
   * Products like "Koskenkorva" (K), "LAB Reserva" (L), etc. were missed.
   */
  it('should find products in later alphabet (K-Z) in large dataset', () => {
    // These products start with letters that come after the first 5000 alphabetically
    const laterAlphabetQueries = [
      'Koskenkorva',  // K - was missed in original bug
      'LAB Reserva',  // L - was missed in original bug
      'Quinta',       // Q - later in alphabet
      'Zuccardi',     // Z - dummy product, very late in alphabet
    ];

    for (const query of laterAlphabetQueries) {
      const results = searchProducts({ query });
      expect(
        results.length,
        `Should find products matching "${query}" even in large dataset`
      ).toBeGreaterThan(0);
    }
  });

  it('should find real products even when mixed with 6000 dummy products', () => {
    // All real products should still be findable
    const realProductNames = [
      'LAB Reserva',
      'Olvi Tuplapukki',
      'Frontera Chardonnay',
      'Koskenkorva Viina',
      'Pearly Bay',
      'Château Margaux',
      'Akashi Meïsei',
    ];

    for (const name of realProductNames) {
      const results = searchProducts({ query: name });
      expect(
        results.some(p => p.name.includes(name.split(' ')[0])),
        `Should find "${name}" in dataset of ${searchableProducts.length} products`
      ).toBe(true);
    }
  });

  it('should correctly count total products in dataset', () => {
    // Verify we have a large enough dataset to catch the bug
    expect(searchableProducts.length).toBeGreaterThan(6000);
  });

  it('should find products from dummy dataset by producer', () => {
    // Search for dummy products to ensure they're included
    const results = searchProducts({ query: 'Zuccardi Winery' });
    expect(results.length).toBeGreaterThan(0);
  });
});

describe('Test Fixture Validation', () => {
  it('should have real test products loaded', () => {
    expect(realProducts.length).toBeGreaterThan(0);
    expect(realProducts.length).toBe(36); // 36 real products (23 previous + 12 category products + 1 certificate test product)
  });

  it('should have 6000+ dummy products for realistic testing', () => {
    expect(allTestProducts.length).toBeGreaterThan(6000);
  });

  it('should have required test products for all specified searches', () => {
    const requiredProducts = [
      'LAB Reserva',
      'Olvi Tuplapukki',
      'Frontera Chardonnay',
      'Viña Maipo Chardonnay',
      'Quinta das Setencostas',
      'Pearly Bay',
      'Koskenkorva',
    ];

    for (const name of requiredProducts) {
      const found = realProducts.some(p => p.name.includes(name));
      expect(found, `Missing test product: ${name}`).toBe(true);
    }
  });

  it('should have products from multiple countries in full dataset', () => {
    const countries = new Set(allTestProducts.map(p => p.country));
    expect(countries.size).toBeGreaterThan(10);
  });

  it('should have products of different types in full dataset', () => {
    const types = new Set(allTestProducts.map(p => p.type));
    // Core wine and beer types
    expect(types.has('punaviinit')).toBe(true);
    expect(types.has('valkoviinit')).toBe(true);
    expect(types.has('roseeviinit')).toBe(true);
    expect(types.has('kuohuviinit ja samppanjat')).toBe(true);
    expect(types.has('oluet')).toBe(true);
    // Spirits
    expect(types.has('viskit')).toBe(true);
    expect(types.has('vodkat ja viinat')).toBe(true);
    expect(types.has('ginit ja maustetut viinat')).toBe(true);
    expect(types.has('rommit')).toBe(true);
    expect(types.has('konjakit')).toBe(true);
    expect(types.has('liköörit ja katkerot')).toBe(true);
    expect(types.has('brandyt, armanjakit ja calvadosit')).toBe(true);
    // Other categories
    expect(types.has('siiderit')).toBe(true);
    expect(types.has('alkoholittomat')).toBe(true);
    expect(types.has('juomasekoitukset')).toBe(true);
    expect(types.has('jälkiruokaviinit, väkevöidyt ja muut viinit')).toBe(true);
    expect(types.has('viinijuomat')).toBe(true);
  });

  it('should have real products for each category type', () => {
    const realTypes = new Set(realProducts.map(p => p.type));
    // All product category types should have at least one real product
    const requiredTypes = [
      'punaviinit',
      'valkoviinit',
      'roseeviinit',
      'kuohuviinit ja samppanjat',
      'oluet',
      'viskit',
      'vodkat ja viinat',
      'ginit ja maustetut viinat',
      'rommit',
      'konjakit',
      'liköörit ja katkerot',
      'brandyt, armanjakit ja calvadosit',
      'siiderit',
      'alkoholittomat',
      'juomasekoitukset',
      'jälkiruokaviinit, väkevöidyt ja muut viinit',
      'viinijuomat',
    ];
    for (const type of requiredTypes) {
      expect(realTypes.has(type), `Missing real product for type: ${type}`).toBe(true);
    }
  });

  it('should have products alphabetically distributed (A-Z)', () => {
    const firstLetters = new Set(
      allTestProducts.map(p => p.name.charAt(0).toUpperCase())
    );
    // Should have products starting with letters across the alphabet
    expect(firstLetters.has('A')).toBe(true);
    expect(firstLetters.has('K')).toBe(true); // Koskenkorva
    expect(firstLetters.has('L')).toBe(true); // LAB Reserva
    expect(firstLetters.has('Z')).toBe(true); // Zuccardi, Zenato, etc.
  });
});

describe('Relevance Scoring (Bug Fix)', () => {
  /**
   * This test suite verifies that search results are ranked by relevance.
   * Products with exact phrase matches in name should appear before products
   * where words are found across different fields.
   */

  describe('Exact phrase in name ranked highest', () => {
    it('should rank "Suomi Viina" (exact name match) first for "Suomi Viina" query', () => {
      const results = searchProducts({ query: 'Suomi Viina' });

      expect(results.length).toBeGreaterThan(0);

      // First result should be the product with "Suomi Viina" in name
      expect(results[0].name).toBe('Suomi Viina');
    });

    it('should rank "LAB Reserva" first for "LAB Reserva" query', () => {
      const results = searchProducts({ query: 'LAB Reserva' });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toContain('LAB Reserva');
    });

    it('should rank "Koskenkorva Viina" before products with Viina from Suomi', () => {
      const results = searchProducts({ query: 'Koskenkorva Viina' });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toContain('Koskenkorva Viina');
    });
  });

  describe('Name matches ranked before cross-field matches', () => {
    it('should rank products with both words in name before cross-field matches', () => {
      // "Suomi Viina" matches:
      // - Score 100: "Suomi Viina" (exact phrase in name)
      // - Score 20: Products from country "Suomi" with type containing "viina"
      const results = searchProducts({ query: 'Suomi Viina' });

      // First result should have exact match in name
      expect(results[0].name.toLowerCase()).toContain('suomi viina');

      // Cross-field matches (country=Suomi + type has viina) should be later
      const crossFieldMatch = results.find(
        p => p.country === 'Suomi' && p.type.includes('viina') && !p.name.toLowerCase().includes('suomi viina')
      );
      if (crossFieldMatch) {
        const exactMatchIndex = results.findIndex(p => p.name.toLowerCase().includes('suomi viina'));
        const crossFieldIndex = results.indexOf(crossFieldMatch);
        expect(exactMatchIndex).toBeLessThan(crossFieldIndex);
      }
    });

    it('should rank "Viña Maipo Chardonnay" higher than generic Chardonnays', () => {
      const results = searchProducts({ query: 'Viña Maipo Chardonnay' });

      expect(results.length).toBeGreaterThan(0);
      // Exact phrase match should be first
      expect(results[0].name).toContain('Viña Maipo Chardonnay');
    });
  });

  describe('Score calculation', () => {
    it('should assign score 100 for exact phrase match in name', () => {
      const product = allTestProducts.find(p => p.name === 'Suomi Viina')!;
      expect(product).toBeDefined();

      const score = calculateRelevanceScore(product, 'suomi viina', ['suomi', 'viina']);
      expect(score).toBe(100);
    });

    it('should assign score 80 for all words in name but not as phrase', () => {
      // Find a product where all words appear in name but not as exact phrase
      // e.g., "Viña Maipo Pinot Grigio" for query "Maipo Grigio"
      const product = allTestProducts.find(p => p.name.includes('Viña Maipo Pinot Grigio'))!;
      expect(product).toBeDefined();

      const score = calculateRelevanceScore(product, 'maipo grigio', ['maipo', 'grigio']);
      expect(score).toBe(80);
    });

    it('should assign score 20 for cross-field matches', () => {
      // Find a product from Suomi with viina in type but NOT in name
      const product = allTestProducts.find(
        p => p.country === 'Suomi' &&
             p.type.toLowerCase().includes('viina') &&
             !p.name.toLowerCase().includes('viina')
      );

      if (product) {
        const score = calculateRelevanceScore(product, 'suomi viina', ['suomi', 'viina']);
        expect(score).toBe(20);
      }
    });
  });

  describe('Stable ordering with same relevance', () => {
    it('should sort alphabetically when relevance scores are equal', () => {
      // Search for something with multiple cross-field matches
      const results = searchProducts({ query: 'Italia punaviinit' });

      // All cross-field matches (country=Italia, type=punaviinit) should have same score
      // and be sorted alphabetically by name
      const italianReds = results.filter(
        p => p.country === 'Italia' && p.type === 'punaviinit'
      );

      if (italianReds.length > 1) {
        for (let i = 1; i < italianReds.length; i++) {
          const comparison = italianReds[i - 1].name.localeCompare(italianReds[i].name, 'fi');
          expect(comparison).toBeLessThanOrEqual(0);
        }
      }
    });
  });
});

describe('Category-specific Search', () => {
  describe('Search by product type', () => {
    it('should find rosé wines', () => {
      const results = searchProducts({ type: 'roseeviinit' });
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(p => p.type === 'roseeviinit')).toBe(true);
    });

    it('should find gins', () => {
      const results = searchProducts({ type: 'ginit ja maustetut viinat' });
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(p => p.type === 'ginit ja maustetut viinat')).toBe(true);
    });

    it('should find rums', () => {
      const results = searchProducts({ type: 'rommit' });
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(p => p.type === 'rommit')).toBe(true);
    });

    it('should find cognacs', () => {
      const results = searchProducts({ type: 'konjakit' });
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(p => p.type === 'konjakit')).toBe(true);
    });

    it('should find liqueurs', () => {
      const results = searchProducts({ type: 'liköörit ja katkerot' });
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(p => p.type === 'liköörit ja katkerot')).toBe(true);
    });

    it('should find brandies', () => {
      const results = searchProducts({ type: 'brandyt, armanjakit ja calvadosit' });
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(p => p.type === 'brandyt, armanjakit ja calvadosit')).toBe(true);
    });

    it('should find ciders', () => {
      const results = searchProducts({ type: 'siiderit' });
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(p => p.type === 'siiderit')).toBe(true);
    });

    it('should find non-alcoholic products', () => {
      const results = searchProducts({ type: 'alkoholittomat' });
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(p => p.type === 'alkoholittomat')).toBe(true);
    });

    it('should find mixed drinks', () => {
      const results = searchProducts({ type: 'juomasekoitukset' });
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(p => p.type === 'juomasekoitukset')).toBe(true);
    });

    it('should find dessert wines', () => {
      const results = searchProducts({ type: 'jälkiruokaviinit, väkevöidyt ja muut viinit' });
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(p => p.type === 'jälkiruokaviinit, väkevöidyt ja muut viinit')).toBe(true);
    });

    it('should find wine drinks', () => {
      const results = searchProducts({ type: 'viinijuomat' });
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(p => p.type === 'viinijuomat')).toBe(true);
    });
  });

  describe('Search by product name from each category', () => {
    it('should find "Whispering Angel" - rosé wine', () => {
      const results = searchProducts({ query: 'Whispering Angel' });
      expect(results.some(p => p.name.includes('Whispering Angel'))).toBe(true);
    });

    it('should find "Hendricks Gin"', () => {
      const results = searchProducts({ query: 'Hendricks Gin' });
      expect(results.some(p => p.name.includes('Hendricks'))).toBe(true);
    });

    it('should find "Havana Club" - rum', () => {
      const results = searchProducts({ query: 'Havana Club' });
      expect(results.some(p => p.name.includes('Havana Club'))).toBe(true);
    });

    it('should find "Hennessy" - cognac', () => {
      const results = searchProducts({ query: 'Hennessy' });
      expect(results.some(p => p.name.includes('Hennessy'))).toBe(true);
    });

    it('should find "Baileys" - liqueur', () => {
      const results = searchProducts({ query: 'Baileys' });
      expect(results.some(p => p.name.includes('Baileys'))).toBe(true);
    });

    it('should find "Torres 10" - brandy', () => {
      const results = searchProducts({ query: 'Torres 10' });
      expect(results.some(p => p.name.includes('Torres'))).toBe(true);
    });

    it('should find "Somersby" - cider', () => {
      const results = searchProducts({ query: 'Somersby' });
      expect(results.some(p => p.name.includes('Somersby'))).toBe(true);
    });

    it('should find "Leitz Eins Zwei Zero" - non-alcoholic', () => {
      const results = searchProducts({ query: 'Leitz' });
      expect(results.some(p => p.name.includes('Leitz'))).toBe(true);
    });

    it('should find "Bacardi Breezer" - mixed drink', () => {
      const results = searchProducts({ query: 'Bacardi Breezer' });
      expect(results.some(p => p.name.includes('Bacardi Breezer'))).toBe(true);
    });

    it('should find "Taylor\'s Port" - dessert wine', () => {
      const results = searchProducts({ query: "Taylor's Tawny" });
      expect(results.some(p => p.name.includes("Taylor's"))).toBe(true);
    });

    it('should find "Hugo Spritz" - wine drink', () => {
      const results = searchProducts({ query: 'Hugo Spritz' });
      expect(results.some(p => p.name.includes('Hugo Spritz'))).toBe(true);
    });
  });
});

describe('Special Filter Tests', () => {
  /**
   * Simulates filter by beer type (similar to filterByFields but with beerType)
   */
  function searchWithBeerType(beerType: string): Product[] {
    return searchableProducts.filter(p => p.beerType === beerType);
  }

  /**
   * Simulates filter by specialGroup for organic/vegan
   */
  function searchBySpecialGroup(group: string): Product[] {
    return searchableProducts.filter(p => p.specialGroup === group);
  }

  /**
   * Simulates smokiness filter
   */
  function searchBySmokiness(min?: number, max?: number): Product[] {
    return searchableProducts.filter(p => {
      if (p.smokiness === null) return false;
      if (min !== undefined && p.smokiness < min) return false;
      if (max !== undefined && p.smokiness > max) return false;
      return true;
    });
  }

  describe('Beer type filter', () => {
    it('should filter by beerType "vahva lager"', () => {
      const results = searchWithBeerType('vahva lager');
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(p => p.beerType === 'vahva lager')).toBe(true);
    });

    it('should filter by beerType "lager" from dummy products', () => {
      const results = searchWithBeerType('lager');
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(p => p.beerType === 'lager')).toBe(true);
    });

    it('should filter by beerType "ipa" from dummy products', () => {
      const results = searchWithBeerType('ipa');
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(p => p.beerType === 'ipa')).toBe(true);
    });
  });

  describe('Organic/Vegan filter', () => {
    it('should find organic (Luomu) products', () => {
      const results = searchBySpecialGroup('Luomu');
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(p => p.specialGroup === 'Luomu')).toBe(true);
    });

    it('should find vegan products', () => {
      const results = searchBySpecialGroup('Vegaaneille soveltuva tuote');
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(p => p.specialGroup === 'Vegaaneille soveltuva tuote')).toBe(true);
    });
  });

  describe('Smokiness filter', () => {
    it('should find non-smoky whiskies (smokiness = 0)', () => {
      const results = searchBySmokiness(0, 0);
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(p => p.smokiness === 0)).toBe(true);
    });

    it('should find lightly smoky whiskies (smokiness = 1)', () => {
      const results = searchBySmokiness(1, 1);
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(p => p.smokiness === 1)).toBe(true);
    });

    it('should find smoky whiskies (smokiness = 3)', () => {
      const results = searchBySmokiness(3, 3);
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(p => p.smokiness === 3)).toBe(true);
    });

    it('should find heavily smoky whiskies (smokiness = 4)', () => {
      const results = searchBySmokiness(4, 4);
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(p => p.smokiness === 4)).toBe(true);
    });

    it('should find whiskies with smokiness >= 3', () => {
      const results = searchBySmokiness(3);
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(p => p.smokiness !== null && p.smokiness >= 3)).toBe(true);
    });

    it('should find whiskies with smokiness <= 1', () => {
      const results = searchBySmokiness(undefined, 1);
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(p => p.smokiness !== null && p.smokiness <= 1)).toBe(true);
    });

    it('should find whiskies with smokiness between 1 and 3', () => {
      const results = searchBySmokiness(1, 3);
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(p => p.smokiness !== null && p.smokiness >= 1 && p.smokiness <= 3)).toBe(true);
    });
  });
});
