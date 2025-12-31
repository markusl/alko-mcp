#!/usr/bin/env npx tsx

/**
 * Debug script to inspect Alko product page structure for additional fields
 */

import { chromium } from 'playwright';

async function main() {
  const productId = '004246'; // Hannibal wine

  console.log(`Inspecting product page: ${productId}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    locale: 'fi-FI',
  });
  const page = await context.newPage();

  await page.addInitScript(`
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  `);

  try {
    // Establish session
    await page.goto('https://www.alko.fi/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Go to product page
    await page.goto(`https://www.alko.fi/tuotteet/${productId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Save screenshot
    await page.screenshot({ path: '/tmp/alko-product-detail.png', fullPage: true });
    console.log('Screenshot saved to /tmp/alko-product-detail.png\n');

    // Extract additional product info
    const productInfo = await page.evaluate(`
      (() => {
        const result = {
          maku: null,
          kayttovinkit: null,
          tarjoilu: null,
          foodPairings: [],
          allSections: [],
        };

        // Look for "Maku" section
        const makuEl = document.querySelector('[class*="taste"], [data-testid*="taste"]');
        if (makuEl) {
          result.maku = makuEl.textContent?.trim();
        }

        // Look for description/luonnehdinta that might have maku info
        const descriptionEl = document.querySelector('.product-description, [class*="description"]');
        if (descriptionEl) {
          result.maku = descriptionEl.textContent?.trim();
        }

        // Look for all accordion/expandable sections
        const sections = document.querySelectorAll('[class*="accordion"], [class*="Accordion"], [class*="expand"], details, [class*="section"]');
        sections.forEach(section => {
          const title = section.querySelector('h2, h3, h4, summary, [class*="title"], [class*="header"]');
          const content = section.querySelector('[class*="content"], [class*="body"], p');
          if (title) {
            result.allSections.push({
              title: title.textContent?.trim().substring(0, 50),
              content: content?.textContent?.trim().substring(0, 200) || section.textContent?.trim().substring(0, 200),
            });
          }
        });

        // Look for food pairing symbols
        const foodPairingContainer = document.querySelector('.food-pairings, [class*="food-pairing"], [class*="foodSymbol"]');
        if (foodPairingContainer) {
          const links = foodPairingContainer.querySelectorAll('a[aria-label]');
          links.forEach(link => {
            const label = link.getAttribute('aria-label');
            if (label) {
              result.foodPairings.push(label);
            }
          });
        }

        // Also try to find food symbols by icon class
        const foodSymbols = document.querySelectorAll('[class*="foodSymbol_"]');
        foodSymbols.forEach(el => {
          const classes = el.className || '';
          const match = classes.match(/foodSymbol_([A-Za-z]+)/);
          if (match) {
            const symbol = match[1];
            if (!result.foodPairings.includes(symbol.toLowerCase())) {
              result.foodPairings.push(symbol.toLowerCase());
            }
          }
        });

        // Look for serving suggestion/tarjoilu
        const bodyText = document.body.innerText;
        const tarjoiluMatch = bodyText.match(/Tarjoilu[:\\s]+([^\\n]+)/i);
        if (tarjoiluMatch) {
          result.tarjoilu = tarjoiluMatch[1].trim();
        }

        // Look for käyttövinkit
        const vinkkiMatch = bodyText.match(/Käyttövink[a-z]*[:\\s]+([^\\n]+)/i);
        if (vinkkiMatch) {
          result.kayttovinkit = vinkkiMatch[1].trim();
        }

        // Get full page text for analysis
        result.pageTextSample = bodyText.substring(0, 3000);

        return result;
      })()
    `);

    console.log('=== Maku (Taste) ===');
    console.log(productInfo.maku || 'Not found');

    console.log('\n=== Käyttövinkit (Usage tips) ===');
    console.log(productInfo.kayttovinkit || 'Not found');

    console.log('\n=== Tarjoilu (Serving) ===');
    console.log(productInfo.tarjoilu || 'Not found');

    console.log('\n=== Food Pairings ===');
    console.log(productInfo.foodPairings.length > 0 ? productInfo.foodPairings : 'None found');

    console.log('\n=== All Sections Found ===');
    productInfo.allSections.forEach((section: { title: string; content: string }) => {
      console.log(`- ${section.title}`);
    });

    console.log('\n=== Page Text Sample ===');
    console.log(productInfo.pageTextSample);

  } finally {
    await browser.close();
  }
}

main().catch(console.error);
