import { Timestamp } from '@google-cloud/firestore';

/**
 * Vivino rating data types
 */

/**
 * Vivino wine rating information
 */
export interface VivinoRating {
  /** Wine name on Vivino */
  wineName: string;
  /** Winery/producer name */
  winery: string | null;
  /** Average rating (1.0 - 5.0) */
  averageRating: number;
  /** Number of ratings */
  ratingsCount: number;
  /** Vivino wine page URL */
  vivinoUrl: string;
  /** When the rating was fetched */
  fetchedAt: Date;
}

/**
 * Vivino rating stored in Firestore
 */
export interface StoredVivinoRating {
  /** Cache key (wine name + winery, lowercase) */
  cacheKey: string;
  /** Wine name on Vivino */
  wineName: string;
  /** Winery/producer name */
  winery: string | null;
  /** Average rating (1.0 - 5.0) */
  averageRating: number;
  /** Number of ratings */
  ratingsCount: number;
  /** Vivino wine page URL */
  vivinoUrl: string;
  /** When the rating was fetched from Vivino */
  fetchedAt: Timestamp;
}

/**
 * Search result for wine on Vivino
 */
export interface VivinoSearchResult {
  /** Wine ID on Vivino */
  wineId: string;
  /** Wine name */
  wineName: string;
  /** Winery name */
  winery: string | null;
  /** Wine page URL */
  url: string;
  /** Preview rating if available */
  rating: number | null;
}

/**
 * Result of Vivino rating lookup
 */
export interface VivinoRatingResult {
  /** Whether a matching wine was found */
  found: boolean;
  /** The rating data if found */
  rating: VivinoRating | null;
  /** Error message if lookup failed */
  error: string | null;
  /** Whether result came from cache */
  fromCache: boolean;
}
