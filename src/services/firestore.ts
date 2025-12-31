import { Firestore, Timestamp, WriteBatch } from '@google-cloud/firestore';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import type {
  Product,
  ProductSearchFilters,
  ProductSearchOptions,
  ProductSearchResult,
  Store,
  StoreAvailability,
  StoredVivinoRating,
  SyncLog,
} from '../types/index.js';

/**
 * Firestore service for database operations
 */
export class FirestoreService {
  private db: Firestore;

  constructor() {
    this.db = new Firestore({
      projectId: config.gcpProject || undefined,
      databaseId: config.firestoreDatabase,
    });
  }

  // ============== Products ==============

  /**
   * Get a product by ID
   */
  async getProduct(productId: string): Promise<Product | null> {
    const doc = await this.db.collection('products').doc(productId).get();
    if (!doc.exists) {
      return null;
    }
    return doc.data() as Product;
  }

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
  private calculateRelevanceScore(product: Product, queryLower: string, queryWords: string[]): number {
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
   * Search products with filters
   */
  async searchProducts(
    filters: ProductSearchFilters,
    options: ProductSearchOptions = {}
  ): Promise<ProductSearchResult> {
    const { sortBy = 'name', sortOrder = 'asc', limit = 20, offset = 0 } = options;

    // If doing a text search, we need to scan all documents
    // Firestore doesn't support full-text search, so we fetch all and filter client-side
    // With ~12,000 products, this is acceptable; for larger catalogs consider Algolia/Elasticsearch
    const fetchLimit = filters.query ? 15000 : limit + 1;

    let query = this.db.collection('products').limit(fetchLimit);

    // Apply filters
    if (filters.type) {
      query = query.where('type', '==', filters.type);
    }
    if (filters.country) {
      query = query.where('country', '==', filters.country);
    }
    if (filters.assortment) {
      query = query.where('assortment', '==', filters.assortment);
    }
    if (filters.specialGroup) {
      query = query.where('specialGroup', '==', filters.specialGroup);
    }
    if (filters.beerType) {
      query = query.where('beerType', '==', filters.beerType);
    }
    if (filters.isNew !== undefined) {
      query = query.where('isNew', '==', filters.isNew);
    }
    if (filters.minPrice !== undefined) {
      query = query.where('price', '>=', filters.minPrice);
    }
    if (filters.maxPrice !== undefined) {
      query = query.where('price', '<=', filters.maxPrice);
    }
    if (filters.minAlcohol !== undefined) {
      query = query.where('alcoholPercentage', '>=', filters.minAlcohol);
    }
    if (filters.maxAlcohol !== undefined) {
      query = query.where('alcoholPercentage', '<=', filters.maxAlcohol);
    }

    // Apply sorting (only used when no text query, otherwise we sort by relevance)
    query = query.orderBy(sortBy, sortOrder);

    // Execute query
    const snapshot = await query.get();
    let products = snapshot.docs.map((doc) => doc.data() as Product);

    // Text search filter with relevance scoring
    // Splits query into words and checks if ALL words match in ANY searchable field
    // Then sorts by relevance score so best matches appear first
    if (filters.query) {
      const queryLower = filters.query.toLowerCase();
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
      products = matchedProducts
        .map(p => ({ product: p, score: this.calculateRelevanceScore(p, queryLower, queryWords) }))
        .sort((a, b) => {
          if (b.score !== a.score) {
            return b.score - a.score;
          }
          // Secondary sort by name for stable ordering
          return a.product.name.localeCompare(b.product.name, 'fi');
        })
        .map(item => item.product);
    }

    // Apply smokiness filters client-side (smokiness is nullable for non-whiskey products)
    if (filters.minSmokiness !== undefined) {
      products = products.filter((p) => p.smokiness !== null && p.smokiness >= filters.minSmokiness!);
    }
    if (filters.maxSmokiness !== undefined) {
      products = products.filter((p) => p.smokiness !== null && p.smokiness <= filters.maxSmokiness!);
    }

    // Calculate total after filtering
    const total = products.length;

    // Apply pagination after client-side filtering
    const paginatedProducts = products.slice(offset, offset + limit);
    const hasMore = total > offset + limit;

    return {
      products: paginatedProducts,
      total,
      limit,
      offset,
      hasMore,
    };
  }

  /**
   * Upsert products in batch
   */
  async upsertProducts(products: Product[]): Promise<{ added: number; updated: number }> {
    const BATCH_SIZE = 500; // Firestore limit is 500 operations per batch
    let added = 0;
    let updated = 0;

    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch: WriteBatch = this.db.batch();
      const chunk = products.slice(i, i + BATCH_SIZE);

      for (const product of chunk) {
        const ref = this.db.collection('products').doc(product.id);
        const existing = await ref.get();

        if (existing.exists) {
          // Update: preserve createdAt
          const existingData = existing.data() as Product;
          batch.set(ref, {
            ...product,
            createdAt: existingData.createdAt,
            updatedAt: Timestamp.now(),
          });
          updated++;
        } else {
          // Insert: set both timestamps
          batch.set(ref, {
            ...product,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          });
          added++;
        }
      }

      await batch.commit();
      logger.info(`Committed batch ${Math.floor(i / BATCH_SIZE) + 1}, processed ${chunk.length} products`);
    }

    return { added, updated };
  }

  /**
   * Update a single product with partial data (e.g., enriched fields)
   */
  async updateProduct(productId: string, updates: Partial<Product>): Promise<void> {
    const ref = this.db.collection('products').doc(productId);
    await ref.update({
      ...updates,
      updatedAt: Timestamp.now(),
    });
    logger.debug(`Updated product ${productId}`, { fields: Object.keys(updates) });
  }

  /**
   * Get product count
   */
  async getProductCount(): Promise<number> {
    const snapshot = await this.db.collection('products').count().get();
    return snapshot.data().count;
  }

  /**
   * Get distinct values for a field (for filters)
   */
  async getDistinctValues(field: keyof Product): Promise<string[]> {
    const snapshot = await this.db.collection('products').select(field).get();
    const values = new Set<string>();
    snapshot.docs.forEach((doc) => {
      const value = doc.data()[field];
      if (value && typeof value === 'string') {
        values.add(value);
      }
    });
    return Array.from(values).sort();
  }

  // ============== Stores ==============

  /**
   * Get a store by ID
   */
  async getStore(storeId: string): Promise<Store | null> {
    const doc = await this.db.collection('stores').doc(storeId).get();
    if (!doc.exists) {
      return null;
    }
    return doc.data() as Store;
  }

  /**
   * List stores
   */
  async listStores(city?: string, limit = 50): Promise<Store[]> {
    // Firestore queries are case-sensitive, so we fetch all and filter client-side
    // With only ~360 stores this is efficient enough
    const snapshot = await this.db.collection('stores').get();
    let stores = snapshot.docs.map((doc) => doc.data() as Store);

    // Case-insensitive city filter
    if (city) {
      const cityLower = city.toLowerCase();
      stores = stores.filter((s) => s.city.toLowerCase() === cityLower);
    }

    // Sort alphabetically by name for consistent results
    stores.sort((a, b) => a.name.localeCompare(b.name, 'fi'));

    return stores.slice(0, limit);
  }

  /**
   * Upsert a store
   */
  async upsertStore(store: Store): Promise<void> {
    await this.db.collection('stores').doc(store.id).set({
      ...store,
      updatedAt: Timestamp.now(),
    });
  }

  // ============== Availability ==============

  /**
   * Get availability for a product
   */
  async getAvailability(productId: string, city?: string): Promise<StoreAvailability[]> {
    let query = this.db.collection('availability').where('productId', '==', productId);
    if (city) {
      // Would need to join with stores collection or denormalize city
      // For now, fetch all and filter client-side
    }
    const snapshot = await query.get();
    return snapshot.docs.map((doc) => doc.data() as StoreAvailability);
  }

  /**
   * Upsert availability records
   */
  async upsertAvailability(records: StoreAvailability[]): Promise<void> {
    const BATCH_SIZE = 500;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = this.db.batch();
      const chunk = records.slice(i, i + BATCH_SIZE);

      for (const record of chunk) {
        const id = `${record.productId}_${record.storeId}`;
        const ref = this.db.collection('availability').doc(id);
        batch.set(ref, {
          ...record,
          id,
          checkedAt: Timestamp.now(),
        });
      }

      await batch.commit();
    }
  }

  // ============== Sync Logs ==============

  /**
   * Create a sync log entry
   */
  async createSyncLog(
    type: SyncLog['type'],
    sourceUrl: string
  ): Promise<string> {
    const doc = await this.db.collection('syncLogs').add({
      type,
      status: 'started',
      productsProcessed: 0,
      productsAdded: 0,
      productsUpdated: 0,
      errors: [],
      startedAt: Timestamp.now(),
      completedAt: null,
      sourceUrl,
    });
    return doc.id;
  }

  /**
   * Update a sync log entry
   */
  async updateSyncLog(
    id: string,
    update: Partial<Omit<SyncLog, 'id' | 'startedAt' | 'sourceUrl' | 'type'>>
  ): Promise<void> {
    await this.db.collection('syncLogs').doc(id).update(update);
  }

  /**
   * Complete a sync log entry
   */
  async completeSyncLog(
    id: string,
    result: {
      productsProcessed: number;
      productsAdded: number;
      productsUpdated: number;
      errors: string[];
    }
  ): Promise<void> {
    await this.db.collection('syncLogs').doc(id).update({
      ...result,
      status: 'completed',
      completedAt: Timestamp.now(),
    });
  }

  /**
   * Fail a sync log entry
   */
  async failSyncLog(id: string, error: string): Promise<void> {
    await this.db.collection('syncLogs').doc(id).update({
      status: 'failed',
      errors: [error],
      completedAt: Timestamp.now(),
    });
  }

  /**
   * Get recent sync logs
   */
  async getRecentSyncLogs(limit = 10): Promise<SyncLog[]> {
    const snapshot = await this.db
      .collection('syncLogs')
      .orderBy('startedAt', 'desc')
      .limit(limit)
      .get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as SyncLog));
  }

  // ============== Vivino Ratings Cache ==============

  /**
   * Get a cached Vivino rating by cache key
   */
  async getVivinoRating(cacheKey: string): Promise<StoredVivinoRating | null> {
    const doc = await this.db.collection('vivinoRatings').doc(cacheKey).get();
    if (!doc.exists) {
      return null;
    }
    return doc.data() as StoredVivinoRating;
  }

  /**
   * Store a Vivino rating in the cache
   */
  async setVivinoRating(
    cacheKey: string,
    rating: {
      wineName: string;
      winery: string | null;
      averageRating: number;
      ratingsCount: number;
      vivinoUrl: string;
    }
  ): Promise<void> {
    const storedRating: StoredVivinoRating = {
      cacheKey,
      wineName: rating.wineName,
      winery: rating.winery,
      averageRating: rating.averageRating,
      ratingsCount: rating.ratingsCount,
      vivinoUrl: rating.vivinoUrl,
      fetchedAt: Timestamp.now(),
    };

    await this.db.collection('vivinoRatings').doc(cacheKey).set(storedRating);
    logger.debug('Stored Vivino rating in cache', { cacheKey });
  }
}

// Singleton instance
let firestoreService: FirestoreService | null = null;

export function getFirestoreService(): FirestoreService {
  if (!firestoreService) {
    firestoreService = new FirestoreService();
  }
  return firestoreService;
}
