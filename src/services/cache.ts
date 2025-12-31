import { LRUCache } from 'lru-cache';
import type { Product } from '../types/index.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObject = Record<string, any>;

/**
 * In-memory cache for frequently accessed data
 */
export class CacheService {
  private productCache: LRUCache<string, Product>;
  private searchCache: LRUCache<string, Product[]>;
  private statsDataCache: LRUCache<string, AnyObject>;

  constructor(options: {
    productMaxSize?: number;
    searchMaxSize?: number;
    productTtl?: number;
    searchTtl?: number;
  } = {}) {
    this.productCache = new LRUCache<string, Product>({
      max: options.productMaxSize || 5000,
      ttl: options.productTtl || 1000 * 60 * 60, // 1 hour default
    });

    this.searchCache = new LRUCache<string, Product[]>({
      max: options.searchMaxSize || 500,
      ttl: options.searchTtl || 1000 * 60 * 15, // 15 minutes default
    });

    this.statsDataCache = new LRUCache<string, AnyObject>({
      max: 100,
      ttl: 1000 * 60 * 60, // 1 hour
    });
  }

  // ============== Product Cache ==============

  getProduct(id: string): Product | undefined {
    return this.productCache.get(id);
  }

  setProduct(id: string, product: Product): void {
    this.productCache.set(id, product);
  }

  setProducts(products: Product[]): void {
    for (const product of products) {
      this.productCache.set(product.id, product);
    }
  }

  // ============== Search Cache ==============

  private createSearchKey(filters: Record<string, unknown>): string {
    return JSON.stringify(filters, Object.keys(filters).sort());
  }

  getSearchResults(filters: Record<string, unknown>): Product[] | undefined {
    const key = this.createSearchKey(filters);
    return this.searchCache.get(key);
  }

  setSearchResults(filters: Record<string, unknown>, results: Product[]): void {
    const key = this.createSearchKey(filters);
    this.searchCache.set(key, results);
  }

  // ============== Stats Data Cache ==============

  getStatsData(key: string): AnyObject | undefined {
    return this.statsDataCache.get(key);
  }

  setStatsData(key: string, value: AnyObject): void {
    this.statsDataCache.set(key, value);
  }

  // ============== Cache Management ==============

  clearAll(): void {
    this.productCache.clear();
    this.searchCache.clear();
    this.statsDataCache.clear();
  }

  clearProducts(): void {
    this.productCache.clear();
  }

  clearSearches(): void {
    this.searchCache.clear();
  }

  getCacheStats(): {
    products: { size: number; max: number };
    searches: { size: number; max: number };
  } {
    return {
      products: {
        size: this.productCache.size,
        max: this.productCache.max,
      },
      searches: {
        size: this.searchCache.size,
        max: this.searchCache.max,
      },
    };
  }
}

// Singleton instance
let cacheService: CacheService | null = null;

export function getCacheService(): CacheService {
  if (!cacheService) {
    cacheService = new CacheService();
  }
  return cacheService;
}
