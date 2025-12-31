import { describe, it, expect } from 'vitest';

/**
 * Tests for Vivino scraper parsing logic.
 * These patterns are used in src/services/vivino-scraper.ts
 *
 * Test data is based on the Vivino wine page structure captured from vivino.com
 */

/**
 * Simulates the rating value extraction from vivino-scraper.ts
 * Parses strings like "4.3" to float
 */
function parseRatingValue(ratingText: string | null): number | null {
  if (!ratingText) return null;
  const rating = parseFloat(ratingText);
  return isNaN(rating) ? null : rating;
}

/**
 * Simulates the ratings count extraction from vivino-scraper.ts
 * Parses strings like "6803 ratings" or "1,234 ratings" to integer
 */
function parseRatingsCount(countText: string | null): number {
  if (!countText) return 0;
  const countMatch = countText.match(/[\d,]+/);
  if (countMatch) {
    return parseInt(countMatch[0].replace(/,/g, ''), 10);
  }
  return 0;
}

/**
 * Validates a Vivino URL format
 * Valid patterns: /wines/123 or /name/w/123 or /en/name/w/123
 */
function isValidVivinoUrl(url: string): boolean {
  return url.startsWith('https://www.vivino.com/') &&
    (url.includes('/wines/') || /\/w\/\d+/.test(url));
}

describe('Vivino Scraper - Rating Value Parsing', () => {
  it('should parse simple rating like "4.3"', () => {
    expect(parseRatingValue('4.3')).toBe(4.3);
  });

  it('should parse perfect rating "5.0"', () => {
    expect(parseRatingValue('5.0')).toBe(5.0);
  });

  it('should parse low rating "1.5"', () => {
    expect(parseRatingValue('1.5')).toBe(1.5);
  });

  it('should parse rating with extra whitespace', () => {
    expect(parseRatingValue(' 4.2 ')).toBe(4.2);
  });

  it('should return null for empty string', () => {
    expect(parseRatingValue('')).toBe(null);
  });

  it('should return null for null input', () => {
    expect(parseRatingValue(null)).toBe(null);
  });

  it('should return null for non-numeric text', () => {
    expect(parseRatingValue('not a rating')).toBe(null);
  });
});

describe('Vivino Scraper - Ratings Count Parsing', () => {
  it('should parse "6803 ratings"', () => {
    expect(parseRatingsCount('6803 ratings')).toBe(6803);
  });

  it('should parse count with comma separator "1,234 ratings"', () => {
    expect(parseRatingsCount('1,234 ratings')).toBe(1234);
  });

  it('should parse large count "12,345,678 ratings"', () => {
    expect(parseRatingsCount('12,345,678 ratings')).toBe(12345678);
  });

  it('should parse just the number without text', () => {
    expect(parseRatingsCount('500')).toBe(500);
  });

  it('should parse count with different text "123 reviews"', () => {
    expect(parseRatingsCount('123 reviews')).toBe(123);
  });

  it('should return 0 for empty string', () => {
    expect(parseRatingsCount('')).toBe(0);
  });

  it('should return 0 for null input', () => {
    expect(parseRatingsCount(null)).toBe(0);
  });

  it('should return 0 for text without numbers', () => {
    expect(parseRatingsCount('no ratings yet')).toBe(0);
  });
});

describe('Vivino Scraper - URL Validation', () => {
  it('should validate standard wine URL', () => {
    expect(isValidVivinoUrl('https://www.vivino.com/wines/1129971')).toBe(true);
  });

  it('should validate wine URL with name', () => {
    expect(
      isValidVivinoUrl(
        'https://www.vivino.com/chateau-margaux-chateau-margaux/w/1661'
      )
    ).toBe(true);
  });

  it('should validate wine URL with long path', () => {
    expect(
      isValidVivinoUrl(
        'https://www.vivino.com/chateau-d-esclans-whispering-angel-cotes-de-provence-rose/w/1141860'
      )
    ).toBe(true);
  });

  it('should validate wine URL with /en/ prefix', () => {
    expect(
      isValidVivinoUrl(
        'https://www.vivino.com/en/alexandre-le-bon-cuvee-prestige-cremant-de-loire-brut/w/12155913'
      )
    ).toBe(true);
  });

  it('should validate wine URL with query params', () => {
    expect(
      isValidVivinoUrl(
        'https://www.vivino.com/en/chateau-margaux/w/1127795?year=2022&price_id=40018364'
      )
    ).toBe(true);
  });

  it('should reject non-Vivino URL', () => {
    expect(isValidVivinoUrl('https://www.example.com/wines/123')).toBe(false);
  });

  it('should reject Vivino URL without /w path', () => {
    expect(isValidVivinoUrl('https://www.vivino.com/search?q=wine')).toBe(false);
  });
});

describe('Vivino Scraper - Rating Result Structure', () => {
  it('should have correct structure for found wine', () => {
    const result = {
      found: true,
      rating: {
        wineName: 'Chateau Margaux 2015',
        winery: 'Chateau Margaux',
        averageRating: 4.6,
        ratingsCount: 6803,
        vivinoUrl: 'https://www.vivino.com/chateau-margaux-chateau-margaux/w/1661',
        fetchedAt: new Date(),
      },
      error: null,
      fromCache: false,
    };

    expect(result.found).toBe(true);
    expect(result.rating).not.toBeNull();
    expect(result.rating!.averageRating).toBeGreaterThanOrEqual(1);
    expect(result.rating!.averageRating).toBeLessThanOrEqual(5);
    expect(result.rating!.ratingsCount).toBeGreaterThan(0);
    expect(result.rating!.vivinoUrl).toContain('vivino.com');
  });

  it('should have correct structure for not found wine', () => {
    const result = {
      found: false,
      rating: null,
      error: null,
      fromCache: false,
    };

    expect(result.found).toBe(false);
    expect(result.rating).toBeNull();
    expect(result.error).toBeNull();
  });

  it('should have correct structure for error case', () => {
    const result = {
      found: false,
      rating: null,
      error: 'Vivino requires human verification',
      fromCache: false,
    };

    expect(result.found).toBe(false);
    expect(result.rating).toBeNull();
    expect(result.error).not.toBeNull();
  });
});

describe('Vivino Scraper - Wine Name Search Query Building', () => {
  it('should create search query from wine name only', () => {
    const wineName = 'Chateau Margaux';
    const winery = undefined;
    const query = winery ? `${winery} ${wineName}` : wineName;
    expect(query).toBe('Chateau Margaux');
  });

  it('should create search query from wine name and winery', () => {
    const wineName = 'Grand Vin 2015';
    const winery = 'Chateau Margaux';
    const query = winery ? `${winery} ${wineName}` : wineName;
    expect(query).toBe('Chateau Margaux Grand Vin 2015');
  });

  it('should handle special characters in wine name', () => {
    const wineName = "Château d'Esclans Whispering Angel";
    const encoded = encodeURIComponent(wineName);
    expect(encoded).toContain("Ch%C3%A2teau");
    expect(encoded).toContain("d'Esclans");
  });
});

describe('Vivino Scraper - Cache Key Generation', () => {
  it('should create consistent cache key', () => {
    const wineName = 'Chateau Margaux';
    const winery = 'Margaux';
    const cacheKey = `${wineName}|${winery || ''}`.toLowerCase();
    expect(cacheKey).toBe('chateau margaux|margaux');
  });

  it('should handle empty winery', () => {
    const wineName = 'Some Wine';
    const winery = undefined;
    const cacheKey = `${wineName}|${winery || ''}`.toLowerCase();
    expect(cacheKey).toBe('some wine|');
  });

  it('should be case-insensitive', () => {
    const key1 = 'CHATEAU MARGAUX|MARGAUX'.toLowerCase();
    const key2 = 'chateau margaux|margaux'.toLowerCase();
    expect(key1).toBe(key2);
  });
});
