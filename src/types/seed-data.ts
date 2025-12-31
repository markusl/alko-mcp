/**
 * Serializable seed data types (no Firestore Timestamps)
 * Used for bundled seed data that can be loaded into empty Firestore
 */

/**
 * Serializable version of Product (no Firestore Timestamps)
 */
export interface SeedProduct {
  id: string;
  name: string;
  producer: string;
  ean: string;
  price: number;
  pricePerLiter: number;
  bottleSize: string;
  packagingType: string | null;
  closureType: string | null;
  type: string;
  subtype: string | null;
  specialGroup: string | null;
  beerType: string | null;
  sortCode: number;
  country: string;
  region: string | null;
  vintage: number | null;
  grapes: string | null;
  labelNotes: string | null;
  description: string | null;
  notes: string | null;
  tasteProfile: string | null;
  usageTips: string | null;
  servingSuggestion: string | null;
  foodPairings: string[] | null;
  certificates: string[] | null;
  ingredients: string | null;
  smokiness: number | null;
  smokinessLabel: string | null;
  alcoholPercentage: number;
  acids: number | null;
  sugar: number | null;
  energy: number | null;
  originalGravity: number | null;
  colorEBC: number | null;
  bitternessEBU: number | null;
  assortment: string;
  isNew: boolean;
}

/**
 * Serializable version of Store (no Firestore Timestamps)
 */
export interface SeedStore {
  id: string;
  name: string;
  city: string;
  address: string;
  postalCode: string;
  coordinates: { lat: number; lng: number } | null;
  storeLink: string;
  phone: string | null;
  email: string | null;
  openingHoursToday: string | null;
  openingHoursTomorrow: string | null;
}

/**
 * Seed data file structure
 */
export interface SeedData {
  exportedAt: string;
  version: number;
  products: SeedProduct[];
  stores: SeedStore[];
}
