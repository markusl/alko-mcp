#!/usr/bin/env npx tsx

/**
 * Test script for MCP tools
 */

import { searchProducts } from '../src/tools/search-products.js';
import { getProduct } from '../src/tools/get-product.js';
import { getDataSyncService } from '../src/services/data-sync.js';
import { logger } from '../src/utils/logger.js';

async function main() {
  logger.info('Starting MCP tools test');

  // Test 1: Search for products by name
  console.log('\n=== Test 1: Search for "barolo" ===');
  const searchResult1 = await searchProducts({ query: 'barolo', limit: 3 });
  console.log(`Found ${searchResult1.total} total matches, showing ${searchResult1.products.length}:`);
  for (const p of searchResult1.products) {
    console.log(`  - ${p.name} | ${p.price}€ | ${p.country} | ${p.type}`);
  }

  // Test 2: Search with filters
  console.log('\n=== Test 2: Italian red wines under 20€ ===');
  const searchResult2 = await searchProducts({
    type: 'punaviinit',
    country: 'Italia',
    maxPrice: 20,
    limit: 5,
  });
  console.log(`Found ${searchResult2.total} total matches, showing ${searchResult2.products.length}:`);
  for (const p of searchResult2.products) {
    console.log(`  - ${p.name} | ${p.price}€ | ${p.subtype || 'N/A'}`);
  }

  // Test 3: Get a specific product
  if (searchResult1.products.length > 0) {
    const productId = searchResult1.products[0].id;
    console.log(`\n=== Test 3: Get product details for ID: ${productId} ===`);
    const product = await getProduct({ productId });
    if (product) {
      console.log(`  Name: ${product.name}`);
      console.log(`  Producer: ${product.producer}`);
      console.log(`  Price: ${product.price}€`);
      console.log(`  Alcohol: ${product.alcoholPercentage}%`);
      console.log(`  Country: ${product.country}`);
      console.log(`  Type: ${product.type}`);
      console.log(`  Description: ${product.description || 'N/A'}`);
    } else {
      console.log(`  Product not found`);
    }
  }

  // Test 4: Get sync status
  console.log('\n=== Test 4: Sync Status ===');
  const syncService = getDataSyncService();
  const status = await syncService.getSyncStatus();
  console.log(`  Product count: ${status.productCount}`);
  console.log(`  Last sync: ${status.lastSync || 'Never'}`);
  console.log(`  Last sync status: ${status.lastSyncStatus || 'N/A'}`);

  // Test 5: Test search with no results
  console.log('\n=== Test 5: Search for non-existent product ===');
  const searchResult3 = await searchProducts({ query: 'xyznonexistent123', limit: 5 });
  console.log(`Found ${searchResult3.total} matches`);

  console.log('\n=== All tests completed successfully! ===');
}

main().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});
