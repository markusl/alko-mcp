import { Timestamp } from '@google-cloud/firestore';

/**
 * Store opening hours for a single day
 */
export interface OpeningHours {
  day: string;             // Day name or "today"/"tomorrow"
  open: string;            // Opening time "09:00" or "SULJETTU" (closed)
  close: string;           // Closing time "20:00" or ""
  isClosed: boolean;       // True if closed
}

/**
 * Store entity stored in Firestore
 */
export interface Store {
  id: string;              // Store ID from URL (e.g., "2736")
  name: string;            // Store name - "Alko Varkaus"
  city: string;            // City - "Varkaus"
  address: string;         // Full address
  postalCode: string;      // Postal code
  coordinates: {
    lat: number;
    lng: number;
  } | null;
  storeLink: string;       // URL path - "/myymalat-palvelut/2736/"
  phone: string | null;    // Phone number
  email: string | null;    // Email address
  openingHoursToday: string | null;    // e.g., "9-20" or "SULJETTU"
  openingHoursTomorrow: string | null; // e.g., "9-18" or "SULJETTU"
  updatedAt: Timestamp;
}

/**
 * Store search filters
 */
export interface StoreSearchFilters {
  city?: string;
  name?: string;
}

/**
 * Store search options
 */
export interface StoreSearchOptions {
  limit?: number;
  offset?: number;
}
