#!/usr/bin/env npx tsx

/**
 * Export product and store data from Firestore to a JSON seed file.
 * Shows a diff of what changed compared to the previous export.
 *
 * Usage:
 *   FIRESTORE_EMULATOR_HOST=localhost:8081 npx tsx scripts/export-seed-data.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { getFirestoreService } from '../src/services/firestore.js';
import { config } from '../src/config.js';
import type { Product, Store } from '../src/types/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_FILE_PATH = path.join(__dirname, '..', 'data', 'seed-data.json');

/**
 * Serializable version of Product (no Firestore Timestamps)
 */
interface SeedProduct {
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
interface SeedStore {
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
interface SeedData {
  exportedAt: string;
  version: number;
  products: SeedProduct[];
  stores: SeedStore[];
}

/**
 * Convert Firestore Product to SeedProduct (strip Timestamps)
 */
function toSeedProduct(p: Product): SeedProduct {
  return {
    id: p.id,
    name: p.name,
    producer: p.producer,
    ean: p.ean,
    price: p.price,
    pricePerLiter: p.pricePerLiter,
    bottleSize: p.bottleSize,
    packagingType: p.packagingType,
    closureType: p.closureType,
    type: p.type,
    subtype: p.subtype,
    specialGroup: p.specialGroup,
    beerType: p.beerType,
    sortCode: p.sortCode,
    country: p.country,
    region: p.region,
    vintage: p.vintage,
    grapes: p.grapes,
    labelNotes: p.labelNotes,
    description: p.description,
    notes: p.notes,
    tasteProfile: p.tasteProfile,
    usageTips: p.usageTips,
    servingSuggestion: p.servingSuggestion,
    foodPairings: p.foodPairings,
    ingredients: p.ingredients,
    smokiness: p.smokiness,
    smokinessLabel: p.smokinessLabel,
    alcoholPercentage: p.alcoholPercentage,
    acids: p.acids,
    sugar: p.sugar,
    energy: p.energy,
    originalGravity: p.originalGravity,
    colorEBC: p.colorEBC,
    bitternessEBU: p.bitternessEBU,
    assortment: p.assortment,
    isNew: p.isNew,
  };
}

/**
 * Convert Firestore Store to SeedStore (strip Timestamps)
 */
function toSeedStore(s: Store): SeedStore {
  return {
    id: s.id,
    name: s.name,
    city: s.city,
    address: s.address,
    postalCode: s.postalCode,
    coordinates: s.coordinates,
    storeLink: s.storeLink,
    phone: s.phone,
    email: s.email,
    openingHoursToday: s.openingHoursToday,
    openingHoursTomorrow: s.openingHoursTomorrow,
  };
}

/**
 * Load existing seed data if it exists
 */
function loadExistingSeedData(): SeedData | null {
  if (!fs.existsSync(SEED_FILE_PATH)) {
    return null;
  }
  try {
    const content = fs.readFileSync(SEED_FILE_PATH, 'utf-8');
    return JSON.parse(content) as SeedData;
  } catch {
    console.warn('Warning: Could not parse existing seed data file');
    return null;
  }
}

/**
 * ANSI color codes for terminal output
 */
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

/**
 * Field change information
 */
interface FieldChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

/**
 * Updated item with field-level changes
 */
interface UpdatedItem<T> {
  item: T;
  oldItem: T;
  changes: FieldChange[];
}

/**
 * Diff result with field-level changes for updated items
 */
interface DiffResult<T> {
  added: T[];
  removed: T[];
  updated: UpdatedItem<T>[];
}

/**
 * Format a value for display
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return `[${value.map((v) => JSON.stringify(v)).join(', ')}]`;
  }
  if (typeof value === 'string') {
    // Truncate long strings
    if (value.length > 80) {
      return `"${value.substring(0, 77)}..."`;
    }
    return `"${value}"`;
  }
  return String(value);
}

/**
 * Calculate field-level diff between two objects
 */
function getFieldChanges<T extends Record<string, unknown>>(oldItem: T, newItem: T): FieldChange[] {
  const changes: FieldChange[] = [];
  const allKeys = new Set([...Object.keys(oldItem), ...Object.keys(newItem)]);

  for (const key of allKeys) {
    const oldValue = oldItem[key];
    const newValue = newItem[key];

    // Deep comparison for arrays and objects
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changes.push({ field: key, oldValue, newValue });
    }
  }

  return changes;
}

/**
 * Calculate diff between old and new data with field-level changes
 */
function calculateDiff(
  oldProducts: SeedProduct[],
  newProducts: SeedProduct[],
  oldStores: SeedStore[],
  newStores: SeedStore[]
): {
  products: DiffResult<SeedProduct>;
  stores: DiffResult<SeedStore>;
} {
  const oldProductMap = new Map(oldProducts.map((p) => [p.id, p]));
  const newProductMap = new Map(newProducts.map((p) => [p.id, p]));

  const oldStoreMap = new Map(oldStores.map((s) => [s.id, s]));
  const newStoreMap = new Map(newStores.map((s) => [s.id, s]));

  // Products diff
  const addedProducts: SeedProduct[] = [];
  const removedProducts: SeedProduct[] = [];
  const updatedProducts: UpdatedItem<SeedProduct>[] = [];

  for (const [id, product] of newProductMap) {
    const oldProduct = oldProductMap.get(id);
    if (!oldProduct) {
      addedProducts.push(product);
    } else if (JSON.stringify(oldProduct) !== JSON.stringify(product)) {
      const changes = getFieldChanges(
        oldProduct as unknown as Record<string, unknown>,
        product as unknown as Record<string, unknown>
      );
      updatedProducts.push({ item: product, oldItem: oldProduct, changes });
    }
  }

  for (const [id, product] of oldProductMap) {
    if (!newProductMap.has(id)) {
      removedProducts.push(product);
    }
  }

  // Stores diff
  const addedStores: SeedStore[] = [];
  const removedStores: SeedStore[] = [];
  const updatedStores: UpdatedItem<SeedStore>[] = [];

  for (const [id, store] of newStoreMap) {
    const oldStore = oldStoreMap.get(id);
    if (!oldStore) {
      addedStores.push(store);
    } else if (JSON.stringify(oldStore) !== JSON.stringify(store)) {
      const changes = getFieldChanges(
        oldStore as unknown as Record<string, unknown>,
        store as unknown as Record<string, unknown>
      );
      updatedStores.push({ item: store, oldItem: oldStore, changes });
    }
  }

  for (const [id, store] of oldStoreMap) {
    if (!newStoreMap.has(id)) {
      removedStores.push(store);
    }
  }

  return {
    products: { added: addedProducts, removed: removedProducts, updated: updatedProducts },
    stores: { added: addedStores, removed: removedStores, updated: updatedStores },
  };
}

/**
 * Print a single field change in Git diff style
 */
function printFieldChange(change: FieldChange, indent: string = '  '): void {
  const { field, oldValue, newValue } = change;

  // Handle null -> value (field added)
  if (oldValue === null && newValue !== null) {
    console.log(`${indent}${colors.green}+ ${field}: ${formatValue(newValue)}${colors.reset}`);
    return;
  }

  // Handle value -> null (field removed)
  if (oldValue !== null && newValue === null) {
    console.log(`${indent}${colors.red}- ${field}: ${formatValue(oldValue)}${colors.reset}`);
    return;
  }

  // Handle value change
  console.log(`${indent}${colors.red}- ${field}: ${formatValue(oldValue)}${colors.reset}`);
  console.log(`${indent}${colors.green}+ ${field}: ${formatValue(newValue)}${colors.reset}`);
}

/**
 * Print diff in Git-like style with field-level changes
 */
function printDiff(diff: ReturnType<typeof calculateDiff>): void {
  const { products, stores } = diff;

  const totalChanges =
    products.added.length +
    products.removed.length +
    products.updated.length +
    stores.added.length +
    stores.removed.length +
    stores.updated.length;

  if (totalChanges === 0) {
    console.log('\nNo changes detected.');
    return;
  }

  console.log(`\n${colors.bold}=== DIFF ===${colors.reset}\n`);

  // Summary line
  const summaryParts: string[] = [];
  if (products.added.length > 0) summaryParts.push(`${colors.green}+${products.added.length} products${colors.reset}`);
  if (products.removed.length > 0) summaryParts.push(`${colors.red}-${products.removed.length} products${colors.reset}`);
  if (products.updated.length > 0) summaryParts.push(`${colors.yellow}~${products.updated.length} products${colors.reset}`);
  if (stores.added.length > 0) summaryParts.push(`${colors.green}+${stores.added.length} stores${colors.reset}`);
  if (stores.removed.length > 0) summaryParts.push(`${colors.red}-${stores.removed.length} stores${colors.reset}`);
  if (stores.updated.length > 0) summaryParts.push(`${colors.yellow}~${stores.updated.length} stores${colors.reset}`);

  console.log(`Summary: ${summaryParts.join(', ')}\n`);

  // --- PRODUCTS ---

  // Added products
  if (products.added.length > 0) {
    console.log(`${colors.green}${colors.bold}+++ Added Products (${products.added.length})${colors.reset}\n`);
    const toShow = products.added.slice(0, 20);
    for (const p of toShow) {
      console.log(`${colors.green}+ [${p.id}] ${p.name}${colors.reset}`);
      console.log(`${colors.dim}  ${p.type} | ${p.country} | ${p.price}€${colors.reset}`);
    }
    if (products.added.length > 20) {
      console.log(`${colors.dim}  ... and ${products.added.length - 20} more${colors.reset}`);
    }
    console.log('');
  }

  // Removed products
  if (products.removed.length > 0) {
    console.log(`${colors.red}${colors.bold}--- Removed Products (${products.removed.length})${colors.reset}\n`);
    const toShow = products.removed.slice(0, 20);
    for (const p of toShow) {
      console.log(`${colors.red}- [${p.id}] ${p.name}${colors.reset}`);
    }
    if (products.removed.length > 20) {
      console.log(`${colors.dim}  ... and ${products.removed.length - 20} more${colors.reset}`);
    }
    console.log('');
  }

  // Updated products with field-level diff
  if (products.updated.length > 0) {
    console.log(`${colors.yellow}${colors.bold}~~~ Modified Products (${products.updated.length})${colors.reset}\n`);
    const toShow = products.updated.slice(0, 30);
    for (const { item, changes } of toShow) {
      console.log(`${colors.cyan}[${item.id}] ${item.name}${colors.reset}`);
      for (const change of changes) {
        printFieldChange(change, '  ');
      }
      console.log('');
    }
    if (products.updated.length > 30) {
      console.log(`${colors.dim}... and ${products.updated.length - 30} more modified products${colors.reset}\n`);
    }
  }

  // --- STORES ---

  // Added stores
  if (stores.added.length > 0) {
    console.log(`${colors.green}${colors.bold}+++ Added Stores (${stores.added.length})${colors.reset}\n`);
    for (const s of stores.added) {
      console.log(`${colors.green}+ [${s.id}] ${s.name}${colors.reset}`);
      console.log(`${colors.dim}  ${s.address}, ${s.postalCode} ${s.city}${colors.reset}`);
    }
    console.log('');
  }

  // Removed stores
  if (stores.removed.length > 0) {
    console.log(`${colors.red}${colors.bold}--- Removed Stores (${stores.removed.length})${colors.reset}\n`);
    for (const s of stores.removed) {
      console.log(`${colors.red}- [${s.id}] ${s.name} (${s.city})${colors.reset}`);
    }
    console.log('');
  }

  // Updated stores with field-level diff
  if (stores.updated.length > 0) {
    console.log(`${colors.yellow}${colors.bold}~~~ Modified Stores (${stores.updated.length})${colors.reset}\n`);
    const toShow = stores.updated.slice(0, 20);
    for (const { item, changes } of toShow) {
      console.log(`${colors.cyan}[${item.id}] ${item.name}${colors.reset}`);
      for (const change of changes) {
        printFieldChange(change, '  ');
      }
      console.log('');
    }
    if (stores.updated.length > 20) {
      console.log(`${colors.dim}... and ${stores.updated.length - 20} more modified stores${colors.reset}\n`);
    }
  }
}

async function main() {
  console.log('Exporting seed data from Firestore...\n');

  // Show connection info
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  console.log(`Firestore: ${emulatorHost ? `emulator @ ${emulatorHost}` : 'production'}`);
  console.log(`Project: ${config.gcpProject}`);
  console.log(`GOOGLE_CLOUD_PROJECT env: ${process.env.GOOGLE_CLOUD_PROJECT || '(not set, using default)'}\n`);

  const firestore = getFirestoreService();

  // Fetch all products
  console.log('Fetching products...');
  const productResult = await firestore.searchProducts({}, { limit: 15000 });
  const products = productResult.products.map(toSeedProduct);

  // Count products with enriched data
  const enrichedProducts = products.filter(
    (p) => p.tasteProfile || p.usageTips || p.servingSuggestion || (p.foodPairings && p.foodPairings.length > 0) || p.ingredients
  );
  const enrichedCount = enrichedProducts.length;

  console.log(`  Found ${products.length} products (${enrichedCount} with enriched data)`);

  // Show some examples of enriched products if any
  if (enrichedCount > 0 && enrichedCount <= 10) {
    console.log('  Enriched products:');
    for (const p of enrichedProducts) {
      const fields = [];
      if (p.tasteProfile) fields.push('taste');
      if (p.usageTips) fields.push('tips');
      if (p.servingSuggestion) fields.push('serving');
      if (p.foodPairings && p.foodPairings.length > 0) fields.push(`${p.foodPairings.length} pairings`);
      if (p.ingredients) fields.push('ingredients');
      console.log(`    - [${p.id}] ${p.name}: ${fields.join(', ')}`);
    }
  } else if (enrichedCount > 10) {
    console.log(`  Enriched products (first 10 of ${enrichedCount}):`);
    for (const p of enrichedProducts.slice(0, 10)) {
      const fields = [];
      if (p.tasteProfile) fields.push('taste');
      if (p.usageTips) fields.push('tips');
      if (p.servingSuggestion) fields.push('serving');
      if (p.foodPairings && p.foodPairings.length > 0) fields.push(`${p.foodPairings.length} pairings`);
      if (p.ingredients) fields.push('ingredients');
      console.log(`    - [${p.id}] ${p.name}: ${fields.join(', ')}`);
    }
  }

  // Fetch all stores
  console.log('Fetching stores...');
  const stores = (await firestore.listStores(undefined, 1000)).map(toSeedStore);
  console.log(`  Found ${stores.length} stores`);

  // Sort for consistent ordering
  products.sort((a, b) => a.id.localeCompare(b.id));
  stores.sort((a, b) => a.id.localeCompare(b.id));

  // Load existing data for diff
  const existingData = loadExistingSeedData();

  // Create new seed data
  const newVersion = existingData ? existingData.version + 1 : 1;
  const seedData: SeedData = {
    exportedAt: new Date().toISOString(),
    version: newVersion,
    products,
    stores,
  };

  // Calculate and print diff
  if (existingData) {
    const diff = calculateDiff(
      existingData.products,
      products,
      existingData.stores,
      stores
    );

    const hasChanges =
      diff.products.added.length > 0 ||
      diff.products.removed.length > 0 ||
      diff.products.updated.length > 0 ||
      diff.stores.added.length > 0 ||
      diff.stores.removed.length > 0 ||
      diff.stores.updated.length > 0;

    if (!hasChanges) {
      console.log('\nNo changes detected. Seed data is up to date.');
      return;
    }

    printDiff(diff);
  } else {
    console.log('\nNo existing seed data found. Creating initial export.');
  }

  // Write seed data
  const jsonContent = JSON.stringify(seedData, null, 2);
  fs.writeFileSync(SEED_FILE_PATH, jsonContent);

  const fileSizeKB = (Buffer.byteLength(jsonContent) / 1024).toFixed(1);
  const fileSizeMB = (Buffer.byteLength(jsonContent) / 1024 / 1024).toFixed(2);

  console.log(`\n=== EXPORT COMPLETE ===`);
  console.log(`File: ${SEED_FILE_PATH}`);
  console.log(`Size: ${fileSizeKB} KB (${fileSizeMB} MB)`);
  console.log(`Version: ${newVersion}`);
  console.log(`Products: ${products.length} (${enrichedCount} enriched)`);
  console.log(`Stores: ${stores.length}`);
}

main().catch((error) => {
  console.error('Export failed:', error);
  process.exit(1);
});
