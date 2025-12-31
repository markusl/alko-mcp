import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Store } from '../../src/types/index.js';
import { Timestamp } from '@google-cloud/firestore';

// Mock stores with different city casings
const mockStores: Store[] = [
  {
    id: '2135',
    name: 'Alko Helsinki Kontula',
    city: 'HELSINKI', // Uppercase as scraped from website
    address: 'Ostostie 4',
    postalCode: '00940',
    coordinates: null,
    storeLink: '/myymalat-palvelut/2135',
    phone: null,
    email: null,
    openingHoursToday: '9-21',
    openingHoursTomorrow: '9-18',
    updatedAt: Timestamp.now(),
  },
  {
    id: '2102',
    name: 'Alko Helsinki keskusta Arkadia',
    city: 'HELSINKI',
    address: 'Arkadiankatu 10',
    postalCode: '00100',
    coordinates: null,
    storeLink: '/myymalat-palvelut/2102',
    phone: null,
    email: null,
    openingHoursToday: '9-21',
    openingHoursTomorrow: 'SULJETTU',
    updatedAt: Timestamp.now(),
  },
  {
    id: '3001',
    name: 'Alko Tampere Koskikeskus',
    city: 'TAMPERE',
    address: 'Hatanpään valtatie 1',
    postalCode: '33100',
    coordinates: null,
    storeLink: '/myymalat-palvelut/3001',
    phone: null,
    email: null,
    openingHoursToday: '10-20',
    openingHoursTomorrow: '10-18',
    updatedAt: Timestamp.now(),
  },
];

const mockFirestoreService = {
  getStore: vi.fn(),
  listStores: vi.fn(),
  getProductCount: vi.fn().mockResolvedValue(1000), // Mock non-empty database
};

const mockDataSyncService = {
  syncStores: vi.fn(),
};

vi.mock('../../src/services/firestore.js', () => ({
  getFirestoreService: vi.fn(() => mockFirestoreService),
}));

vi.mock('../../src/services/data-sync.js', () => ({
  getDataSyncService: vi.fn(() => mockDataSyncService),
  ensureData: vi.fn().mockResolvedValue(undefined),
}));

// Import after mocking
import { getStoreHours } from '../../src/tools/get-store-hours.js';

describe('Store Hours Tool - Bug Fixes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Case-insensitive city matching (BUG FIX)', () => {
    it('should find stores when city is lowercase but data is uppercase', async () => {
      // Bug: City stored as "HELSINKI" but query used "helsinki"
      mockFirestoreService.listStores.mockResolvedValue(
        mockStores.filter((s) => s.city.toLowerCase() === 'helsinki')
      );

      const result = await getStoreHours({ city: 'helsinki', limit: 20 });

      expect(result.stores.length).toBeGreaterThan(0);
      expect(result.stores.every((s) => s.city.toUpperCase() === 'HELSINKI')).toBe(true);
    });

    it('should find stores when city is capitalized but data is uppercase', async () => {
      // Bug: City stored as "HELSINKI" but query used "Helsinki"
      mockFirestoreService.listStores.mockResolvedValue(
        mockStores.filter((s) => s.city.toLowerCase() === 'helsinki')
      );

      const result = await getStoreHours({ city: 'Helsinki', limit: 20 });

      expect(result.stores.length).toBeGreaterThan(0);
      expect(result.stores[0].name).toContain('Helsinki');
    });

    it('should find stores when city is uppercase and data is uppercase', async () => {
      mockFirestoreService.listStores.mockResolvedValue(
        mockStores.filter((s) => s.city === 'HELSINKI')
      );

      const result = await getStoreHours({ city: 'HELSINKI', limit: 20 });

      expect(result.stores.length).toBeGreaterThan(0);
    });
  });

  describe('Store name partial matching', () => {
    it('should find store by partial name match', async () => {
      mockFirestoreService.listStores.mockResolvedValue(mockStores);

      const result = await getStoreHours({ storeName: 'Kontula', limit: 20 });

      expect(result.stores.length).toBe(1);
      expect(result.stores[0].name).toBe('Alko Helsinki Kontula');
    });

    it('should find store by partial name match case-insensitively', async () => {
      mockFirestoreService.listStores.mockResolvedValue(mockStores);

      const result = await getStoreHours({ storeName: 'kontula', limit: 20 });

      expect(result.stores.length).toBe(1);
      expect(result.stores[0].name).toBe('Alko Helsinki Kontula');
    });

    it('should combine city and storeName filters', async () => {
      // Bug: { city: "Helsinki", storeName: "Kontula" } returned no results
      mockFirestoreService.listStores.mockResolvedValue(
        mockStores.filter((s) => s.city.toLowerCase() === 'helsinki')
      );

      const result = await getStoreHours({ city: 'Helsinki', storeName: 'Kontula', limit: 20 });

      expect(result.stores.length).toBe(1);
      expect(result.stores[0].name).toBe('Alko Helsinki Kontula');
      expect(result.stores[0].id).toBe('2135');
    });
  });

  describe('Opening hours status', () => {
    it('should correctly identify open stores during business hours', async () => {
      mockFirestoreService.listStores.mockResolvedValue([mockStores[0]]);

      const result = await getStoreHours({ limit: 20 });

      // Store has hours 9-21, check isOpenNow is calculated
      expect(result.stores[0]).toHaveProperty('isOpenNow');
      expect(typeof result.stores[0].isOpenNow).toBe('boolean');
    });

    it('should identify closed stores with SULJETTU status', async () => {
      const closedStore: Store = {
        ...mockStores[0],
        openingHoursToday: 'SULJETTU',
      };
      mockFirestoreService.listStores.mockResolvedValue([closedStore]);

      const result = await getStoreHours({ limit: 20 });

      expect(result.stores[0].isOpenNow).toBe(false);
    });

    it('should filter to only open stores when openNow is true', async () => {
      mockFirestoreService.listStores.mockResolvedValue(mockStores);

      const result = await getStoreHours({ openNow: true, limit: 20 });

      // All returned stores should be open
      expect(result.stores.every((s) => s.isOpenNow)).toBe(true);
    });
  });

  describe('Store ordering (BUG FIX)', () => {
    it('should preserve alphabetical order from listStores', async () => {
      // Bug: Firestore returns documents in undefined order, so Kontula was missing
      // when limit was applied before alphabetical sorting.
      // Fix: listStores now sorts alphabetically before returning.
      // This test verifies the tool preserves the sorted order from listStores.
      const sortedStores = [...mockStores].sort((a, b) => a.name.localeCompare(b.name, 'fi'));
      mockFirestoreService.listStores.mockResolvedValue(sortedStores);

      const result = await getStoreHours({ limit: 20 });

      // Verify stores remain in alphabetical order
      const names = result.stores.map((s) => s.name);
      const expectedNames = sortedStores.map((s) => s.name);
      expect(names).toEqual(expectedNames);
    });
  });

  describe('Stale data auto-refresh (BUG FIX)', () => {
    it('should auto-refresh when store data is from a previous day', async () => {
      // Bug: openingHoursToday and openingHoursTomorrow were only valid
      // for the day they were scraped, but were returned even days later
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const staleStore: Store = {
        ...mockStores[0],
        updatedAt: Timestamp.fromDate(yesterday),
      };

      // First call returns stale data, second call (after refresh) returns fresh data
      mockFirestoreService.listStores
        .mockResolvedValueOnce([staleStore])
        .mockResolvedValueOnce(mockStores);
      mockDataSyncService.syncStores.mockResolvedValue({ success: true, storesProcessed: 3, errors: [] });

      const result = await getStoreHours({ limit: 20 });

      // Should have triggered refresh
      expect(mockDataSyncService.syncStores).toHaveBeenCalled();
      expect(result.refreshed).toBe(true);
      expect(result.refreshError).toBeNull();
      // After refresh, hours should be available
      expect(result.stores[0].openingHoursToday).not.toBeNull();
    });

    it('should not refresh when data is from today', async () => {
      // Data updated today is fresh
      mockFirestoreService.listStores.mockResolvedValue(mockStores);

      const result = await getStoreHours({ limit: 20 });

      expect(mockDataSyncService.syncStores).not.toHaveBeenCalled();
      expect(result.refreshed).toBe(false);
      expect(result.refreshError).toBeNull();
      // Hours should be present
      expect(result.stores[0].openingHoursToday).not.toBeNull();
    });

    it('should return refreshError when refresh fails', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const staleStore: Store = {
        ...mockStores[0],
        updatedAt: Timestamp.fromDate(yesterday),
      };

      // Return stale data both before and after failed refresh
      mockFirestoreService.listStores.mockResolvedValue([staleStore]);
      mockDataSyncService.syncStores.mockRejectedValue(new Error('Network error'));

      const result = await getStoreHours({ limit: 20 });

      expect(mockDataSyncService.syncStores).toHaveBeenCalled();
      expect(result.refreshed).toBe(false);
      expect(result.refreshError).toContain('Failed to refresh store data');
      expect(result.refreshError).toContain('Network error');
      // Hours should be null since refresh failed and data is still stale
      expect(result.stores[0].openingHoursToday).toBeNull();
      expect(result.stores[0].isOpenNow).toBe(false);
    });

    it('should include dataAsOf field showing when data was last updated', async () => {
      mockFirestoreService.listStores.mockResolvedValue(mockStores);

      const result = await getStoreHours({ limit: 20 });

      expect(result.dataAsOf).not.toBeNull();
      // dataAsOf should be in YYYY-MM-DD format
      expect(result.dataAsOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

});
