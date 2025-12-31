import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Product, ProductSearchResult } from '../../src/types/index.js';

// Mock the firestore service before importing tools
vi.mock('../../src/services/firestore.js', () => ({
  getFirestoreService: vi.fn(() => mockFirestoreService),
}));

vi.mock('../../src/services/cache.js', () => ({
  getCacheService: vi.fn(() => mockCacheService),
}));

vi.mock('../../src/services/scraper.js', () => ({
  getAlkoScraper: vi.fn(() => mockScraperService),
}));

const mockProducts: Product[] = [
  {
    id: '906458',
    name: 'Fair & Square Red 2024',
    producer: 'La Riojana',
    ean: '7350084980013',
    price: 11.98,
    pricePerLiter: 11.98,
    bottleSize: '1 l',
    packagingType: 'kartonkitölkki',
    closureType: 'muovisuljin',
    type: 'punaviinit',
    subtype: 'Mehevä & Hilloinen',
    specialGroup: null,
    beerType: null,
    sortCode: 110,
    country: 'Argentiina',
    region: 'La Rioja',
    vintage: 2024,
    grapes: 'Syrah',
    labelNotes: 'Famatina Valley',
    description: 'Sinipunainen, täyteläinen, pehmeä, kypsän marjaisa',
    notes: 'Vegaaneille soveltuva tuote',
    tasteProfile: null,
    usageTips: null,
    servingSuggestion: null,
    foodPairings: null,
    certificates: null,
    ingredients: null,
    smokiness: null,
    smokinessLabel: null,
    alcoholPercentage: 13.0,
    acids: 5.2,
    sugar: 4.0,
    energy: 80.0,
    originalGravity: null,
    colorEBC: null,
    bitternessEBU: null,
    assortment: 'vakiovalikoima',
    isNew: false,
    updatedAt: { toDate: () => new Date() } as never,
    createdAt: { toDate: () => new Date() } as never,
  },
  {
    id: '123456',
    name: 'Barolo Classico 2019',
    producer: 'Piedmont Wines',
    ean: '1234567890123',
    price: 45.0,
    pricePerLiter: 60.0,
    bottleSize: '0.75 l',
    packagingType: 'lasipullo',
    closureType: 'korkki',
    type: 'punaviinit',
    subtype: 'Vivahteikas & Kehittynyt',
    specialGroup: null,
    beerType: null,
    sortCode: 100,
    country: 'Italia',
    region: 'Piemonte',
    vintage: 2019,
    grapes: 'Nebbiolo',
    labelNotes: null,
    description: 'Tiilenpunainen, täyteläinen, tanniininen',
    notes: null,
    tasteProfile: null,
    usageTips: null,
    servingSuggestion: null,
    foodPairings: null,
    certificates: null,
    ingredients: null,
    smokiness: null,
    smokinessLabel: null,
    alcoholPercentage: 14.0,
    acids: 5.5,
    sugar: 2.0,
    energy: 85.0,
    originalGravity: null,
    colorEBC: null,
    bitternessEBU: null,
    assortment: 'vakiovalikoima',
    isNew: false,
    updatedAt: { toDate: () => new Date() } as never,
    createdAt: { toDate: () => new Date() } as never,
  },
];

// Product with enriched data already present (for skip-scrape test)
const mockProductWithEnrichedData: Product = {
  ...mockProducts[0],
  id: '004246',
  name: 'Hannibal',
  tasteProfile: 'Punainen, keskitäyteläinen, makea',
  usageTips: 'Sopii seurusteluun',
  servingSuggestion: 'Tarjoile 16-18 asteisena',
  foodPairings: ['seurustelujuoma', 'miedot juustot'],
  certificates: ['Luomu'],
  ingredients: 'Viinirypäleet, sulfiitit',
};

// Mock enriched data returned by scraper
const mockEnrichedData = {
  tasteProfile: 'Punainen, keskitäyteläinen, vähätanniininen, makea',
  usageTips: 'Pehmeät ja hedelmäiset punaviinimaailman moniottelijat sopivat seurusteluun',
  servingSuggestion: 'Punaviinit ovat parhaimmillaan 16-18 asteisina',
  foodPairings: ['seurustelujuoma', 'miedot juustot', 'tulinen ruoka'],
  certificates: ['Luomu', 'Vegaaneille soveltuva tuote'],
  ingredients: 'Viinirypäleet, säilöntäaine (sulfiitit)',
  smokiness: null,
  smokinessLabel: null,
};

const mockFirestoreService = {
  searchProducts: vi.fn(),
  getProduct: vi.fn(),
  getProductCount: vi.fn().mockResolvedValue(1000), // Mock non-empty database
  updateProduct: vi.fn(),
};

const mockScraperService = {
  scrapeProductDetails: vi.fn(),
};

const mockCacheService = {
  getSearchResults: vi.fn(() => undefined),
  setSearchResults: vi.fn(),
  getProduct: vi.fn(() => undefined),
  setProduct: vi.fn(),
};

// Import after mocking
import { searchProducts } from '../../src/tools/search-products.js';
import { getProduct } from '../../src/tools/get-product.js';

describe('MCP Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('searchProducts', () => {
    it('should search products with query filter', async () => {
      const searchResult: ProductSearchResult = {
        products: [mockProducts[1]],
        total: 1,
        limit: 20,
        offset: 0,
        hasMore: false,
      };
      mockFirestoreService.searchProducts.mockResolvedValue(searchResult);

      const result = await searchProducts({ query: 'barolo', limit: 10 });

      expect(result.products).toHaveLength(1);
      expect(result.products[0].name).toBe('Barolo Classico 2019');
      expect(mockFirestoreService.searchProducts).toHaveBeenCalled();
    });

    it('should search products with type and country filters', async () => {
      const searchResult: ProductSearchResult = {
        products: mockProducts,
        total: 2,
        limit: 20,
        offset: 0,
        hasMore: false,
      };
      mockFirestoreService.searchProducts.mockResolvedValue(searchResult);

      const result = await searchProducts({
        type: 'punaviinit',
        country: 'Italia',
        limit: 10,
      });

      expect(mockFirestoreService.searchProducts).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'punaviinit',
          country: 'Italia',
        }),
        expect.any(Object)
      );
    });

    it('should search products with price range', async () => {
      const searchResult: ProductSearchResult = {
        products: [mockProducts[0]],
        total: 1,
        limit: 20,
        offset: 0,
        hasMore: false,
      };
      mockFirestoreService.searchProducts.mockResolvedValue(searchResult);

      const result = await searchProducts({
        minPrice: 10,
        maxPrice: 20,
        limit: 10,
      });

      expect(mockFirestoreService.searchProducts).toHaveBeenCalledWith(
        expect.objectContaining({
          minPrice: 10,
          maxPrice: 20,
        }),
        expect.any(Object)
      );
    });

    it('should return result with product count', async () => {
      const searchResult: ProductSearchResult = {
        products: mockProducts,
        total: 2,
        limit: 20,
        offset: 0,
        hasMore: false,
      };
      mockFirestoreService.searchProducts.mockResolvedValue(searchResult);

      const result = await searchProducts({ limit: 10 });

      expect(result.products).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.products[0].name).toBe('Fair & Square Red 2024');
      expect(result.products[1].name).toBe('Barolo Classico 2019');
    });

    it('should return empty results when no products found', async () => {
      const searchResult: ProductSearchResult = {
        products: [],
        total: 0,
        limit: 20,
        offset: 0,
        hasMore: false,
      };
      mockFirestoreService.searchProducts.mockResolvedValue(searchResult);

      const result = await searchProducts({ limit: 10 });

      expect(result.products).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('getProduct', () => {
    it('should get product by ID', async () => {
      mockFirestoreService.getProduct.mockResolvedValue(mockProducts[0]);

      const result = await getProduct({ productId: '906458' });

      expect(result).not.toBeNull();
      expect(result?.id).toBe('906458');
      expect(result?.name).toBe('Fair & Square Red 2024');
    });

    it('should return null for non-existent product', async () => {
      mockFirestoreService.getProduct.mockResolvedValue(null);

      const result = await getProduct({ productId: 'nonexistent' });

      expect(result).toBeNull();
    });
  });

  describe('getProduct - Enriched Data (BUG FIXES)', () => {
    it('should scrape and persist enriched data to Firestore when includeEnrichedData is true', async () => {
      // Bug: Enriched data was only cached in memory, not persisted to Firestore
      mockFirestoreService.getProduct.mockResolvedValue(mockProducts[0]); // No enriched data
      mockScraperService.scrapeProductDetails.mockResolvedValue(mockEnrichedData);
      mockFirestoreService.updateProduct.mockResolvedValue(undefined);

      const result = await getProduct({ productId: '906458', includeEnrichedData: true });

      // Should have called scraper
      expect(mockScraperService.scrapeProductDetails).toHaveBeenCalledWith('906458');

      // Should persist to Firestore
      expect(mockFirestoreService.updateProduct).toHaveBeenCalledWith('906458', {
        tasteProfile: mockEnrichedData.tasteProfile,
        usageTips: mockEnrichedData.usageTips,
        servingSuggestion: mockEnrichedData.servingSuggestion,
        foodPairings: mockEnrichedData.foodPairings,
        certificates: mockEnrichedData.certificates,
        ingredients: mockEnrichedData.ingredients,
        smokiness: mockEnrichedData.smokiness,
        smokinessLabel: mockEnrichedData.smokinessLabel,
      });

      // Result should contain enriched data
      expect(result?.tasteProfile).toBe(mockEnrichedData.tasteProfile);
      expect(result?.usageTips).toBe(mockEnrichedData.usageTips);
      expect(result?.foodPairings).toEqual(mockEnrichedData.foodPairings);
      expect(result?.certificates).toEqual(mockEnrichedData.certificates);
      expect(result?.ingredients).toBe(mockEnrichedData.ingredients);
    });

    it('should skip scraping when product already has enriched data in Firestore', async () => {
      // Bug: Was re-scraping even when enriched data already existed
      mockFirestoreService.getProduct.mockResolvedValue(mockProductWithEnrichedData);

      const result = await getProduct({ productId: '004246', includeEnrichedData: true });

      // Should NOT call scraper since data already exists
      expect(mockScraperService.scrapeProductDetails).not.toHaveBeenCalled();

      // Should NOT update Firestore
      expect(mockFirestoreService.updateProduct).not.toHaveBeenCalled();

      // Result should still have the existing enriched data
      expect(result?.tasteProfile).toBe(mockProductWithEnrichedData.tasteProfile);
      expect(result?.foodPairings).toEqual(mockProductWithEnrichedData.foodPairings);
    });

    it('should not scrape when includeEnrichedData is false', async () => {
      mockFirestoreService.getProduct.mockResolvedValue(mockProducts[0]);

      await getProduct({ productId: '906458', includeEnrichedData: false });

      expect(mockScraperService.scrapeProductDetails).not.toHaveBeenCalled();
    });

    it('should return base product when scraping fails', async () => {
      mockFirestoreService.getProduct.mockResolvedValue(mockProducts[0]);
      mockScraperService.scrapeProductDetails.mockRejectedValue(new Error('Scrape failed'));

      const result = await getProduct({ productId: '906458', includeEnrichedData: true });

      // Should still return the base product
      expect(result).not.toBeNull();
      expect(result?.id).toBe('906458');
      expect(result?.tasteProfile).toBeNull();
    });

    it('should skip scraping when product only has ingredients field', async () => {
      // Product with only ingredients (no other enriched data) should still skip scraping
      const productWithOnlyIngredients: Product = {
        ...mockProducts[0],
        id: '555555',
        name: 'Product With Ingredients Only',
        tasteProfile: null,
        usageTips: null,
        servingSuggestion: null,
        foodPairings: null,
        ingredients: 'Vesi, alkoholi, aromit',
      };
      mockFirestoreService.getProduct.mockResolvedValue(productWithOnlyIngredients);

      const result = await getProduct({ productId: '555555', includeEnrichedData: true });

      // Should NOT call scraper since ingredients already exists
      expect(mockScraperService.scrapeProductDetails).not.toHaveBeenCalled();

      // Result should have the existing ingredients
      expect(result?.ingredients).toBe('Vesi, alkoholi, aromit');
    });
  });
});
