import type { AppConfig } from './types/index.js';

// When using Firestore emulator, project ID can be any string (not a real GCP project)
const isEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
const defaultProject = isEmulator ? 'alko-mcp-dev' : null;

/**
 * Application configuration loaded from environment variables
 */
// Cloud Run sets K_SERVICE with the service name
const isCloudRun = !!process.env.K_SERVICE;

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '8080', 10),
  nodeEnv: (process.env.NODE_ENV || 'development') as AppConfig['nodeEnv'],
  gcpProject: process.env.GOOGLE_CLOUD_PROJECT || defaultProject,
  firestoreDatabase: process.env.FIRESTORE_DATABASE_ID || '(default)',
  alkoPriceListUrl: process.env.ALKO_PRICE_LIST_URL ||
    'https://www.alko.fi/INTERSHOP/static/WFS/Alko-OnlineShop-Site/-/Alko-OnlineShop/fi_FI/Alkon%20Hinnasto%20Tekstitiedostona/alkon-hinnasto-tekstitiedostona.xlsx',
  scrapeRateLimitMs: parseInt(process.env.SCRAPE_RATE_LIMIT_MS || '2000', 10),
  scrapeCacheTtlMs: parseInt(process.env.SCRAPE_CACHE_TTL_MS || '3600000', 10),
  syncCronSchedule: process.env.SYNC_CRON_SCHEDULE || '0 2 * * *',
  apiToken: process.env.API_TOKEN,
  isCloudRun,
};

/**
 * Validate configuration
 */
export function validateConfig(): void {
  if (config.port < 1 || config.port > 65535) {
    throw new Error(`Invalid PORT: ${config.port}`);
  }
  if (config.scrapeRateLimitMs < 1000) {
    throw new Error('SCRAPE_RATE_LIMIT_MS must be at least 1000ms');
  }
}
