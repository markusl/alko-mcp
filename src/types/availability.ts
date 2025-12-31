import { Timestamp } from '@google-cloud/firestore';

/**
 * Availability status
 */
export type AvailabilityStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

/**
 * Store availability for a product
 */
export interface StoreAvailability {
  id: string;              // Composite: `${productId}_${storeId}`
  productId: string;
  storeId: string;
  storeName: string;
  storeLink: string;
  quantity: number;        // Stock amount
  status: AvailabilityStatus;
  lastUpdated: string;     // From Alko - "17.11."
  checkedAt: Timestamp;    // When we scraped it
}

/**
 * Availability check result
 */
export interface AvailabilityResult {
  productId: string;
  productName: string;
  stores: StoreAvailability[];
  checkedAt: Date;
  fromCache: boolean;
}

/**
 * Raw availability data scraped from website
 */
export interface ScrapedAvailability {
  storeName: string;
  storeLink: string;
  amount: string | number;
  lastUpdated: string;
}
