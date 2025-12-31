import { describe, it, expect } from 'vitest';

/**
 * Tests for scraper regex patterns used to extract enriched product data.
 * These patterns are used in src/services/scraper.ts scrapeProductDetails()
 *
 * Test data is based on real product pages scraped from alko.fi
 */

/**
 * Simulates the ingredient extraction logic from scraper.ts
 */
function extractIngredients(bodyText: string): string | null {
  // This regex matches the pattern used in scraper.ts
  // Stop at the next uppercase section header (e.g., PAKKAUS, SULJENTA, KÄYTTÖ)
  const ingredientsMatch = bodyText.match(
    /TUOTTAJAN ILMOITTAMAT AINESOSAT\n([^]*?)(?=\n[A-ZÄÖÅÜ][A-ZÄÖÅÜ\/\s]{2,}\n|$)/
  );
  if (ingredientsMatch) {
    return ingredientsMatch[1].trim().substring(0, 1000);
  }
  return null;
}

/**
 * Simulates the taste profile extraction logic from scraper.ts
 */
function extractTasteProfile(bodyText: string): string | null {
  const tasteMatch = bodyText.match(
    /^[^\n]*?((?:Punainen|Valkoinen|Rosee|Kullanvärinen|Meripihkan|Kirkas|Tumma|Vaalea|Vaaleanruskea|Täyteläinen|Keskitäyteläinen|Kevyt|Kuiva|Makea|Puolimakea)[^\n]{10,200})/m
  );
  if (tasteMatch) {
    return tasteMatch[1].trim();
  }
  return null;
}

/**
 * Simulates the usage tips extraction logic from scraper.ts
 */
function extractUsageTips(bodyText: string): string | null {
  const vinkkiMatch = bodyText.match(/KÄYTTÖVINKIT\s*([^]*?)(?=TARJOILU|Tuotteen mahdollisesti|$)/i);
  if (vinkkiMatch) {
    return vinkkiMatch[1].trim().substring(0, 500);
  }
  return null;
}

/**
 * Simulates the serving suggestion extraction logic from scraper.ts
 */
function extractServingSuggestion(bodyText: string): string | null {
  const tarjoiluMatch = bodyText.match(/TARJOILU\s*([^]*?)(?=Tuotteen mahdollisesti|Alko Oy|$)/i);
  if (tarjoiluMatch) {
    return tarjoiluMatch[1].trim().substring(0, 500);
  }
  return null;
}

/**
 * Non-food symbols that should be filtered from food pairings
 * These are certification/info labels, not food pairing suggestions
 */
const NON_FOOD_SYMBOLS = [
  'Työolot',
  'Viljely',
  'Vegaaneille soveltuva tuote',
  'Luomu',
  'Reilu kauppa',
  'Ympäristö',
  'Pakkaus',
];

/**
 * Simulates food pairing filtering from scraper.ts
 */
function filterFoodPairings(pairings: string[]): string[] {
  return pairings.filter((p) => !NON_FOOD_SYMBOLS.includes(p));
}

describe('Scraper Parsing - Ingredients', () => {
  it('should extract ingredients when followed by PAKKAUS section (product 900629)', () => {
    // Real page structure from product 900629 (Valhalla Cream Liqueur)
    const bodyText = `PANTTI
0.1 €
TUOTTAJAN ILMOITTAMAT AINESOSAT
Sisältää maitoa
PAKKAUS
lasipullo
SULJENTA
synteettinen korkki
VALMISTAJA/VALMISTUTTAJA
Anora`;

    const result = extractIngredients(bodyText);
    expect(result).toBe('Sisältää maitoa');
  });

  it('should extract multi-line ingredients', () => {
    const bodyText = `TUOTTAJAN ILMOITTAMAT AINESOSAT
Vesi, alkoholi, sokeri
Sisältää maitoa ja sulfiitteja
PAKKAUS
lasipullo`;

    const result = extractIngredients(bodyText);
    expect(result).toBe('Vesi, alkoholi, sokeri\nSisältää maitoa ja sulfiitteja');
  });

  it('should extract ingredients when followed by SULJENTA section', () => {
    const bodyText = `TUOTTAJAN ILMOITTAMAT AINESOSAT
Viinirypäleet, säilöntäaine (sulfiitit)
SULJENTA
korkki`;

    const result = extractIngredients(bodyText);
    expect(result).toBe('Viinirypäleet, säilöntäaine (sulfiitit)');
  });

  it('should extract ingredients when followed by KÄYTTÖ section', () => {
    const bodyText = `TUOTTAJAN ILMOITTAMAT AINESOSAT
Ohramallas, humala, vesi, hiiva
KÄYTTÖ
Sopii seurusteluun`;

    const result = extractIngredients(bodyText);
    expect(result).toBe('Ohramallas, humala, vesi, hiiva');
  });

  it('should extract ingredients when followed by VALMISTAJA/VALMISTUTTAJA section', () => {
    const bodyText = `TUOTTAJAN ILMOITTAMAT AINESOSAT
Rypälemehtiiviste, vesi
VALMISTAJA/VALMISTUTTAJA
Some Producer Oy`;

    const result = extractIngredients(bodyText);
    expect(result).toBe('Rypälemehtiiviste, vesi');
  });

  it('should return null when no ingredients section exists', () => {
    const bodyText = `PAKKAUS
lasipullo
SULJENTA
korkki
VALMISTAJA
Some Producer`;

    const result = extractIngredients(bodyText);
    expect(result).toBeNull();
  });

  it('should extract ingredients at end of text', () => {
    const bodyText = `Some content
TUOTTAJAN ILMOITTAMAT AINESOSAT
Viinirypäleet`;

    const result = extractIngredients(bodyText);
    expect(result).toBe('Viinirypäleet');
  });

  it('should handle ingredients with special Finnish characters', () => {
    const bodyText = `TUOTTAJAN ILMOITTAMAT AINESOSAT
Sisältää: maitoa, vehnää, pähkinöitä
PAKKAUS
pullo`;

    const result = extractIngredients(bodyText);
    expect(result).toBe('Sisältää: maitoa, vehnää, pähkinöitä');
  });

  it('should truncate very long ingredients to 1000 characters', () => {
    const longIngredients = 'A'.repeat(1500);
    const bodyText = `TUOTTAJAN ILMOITTAMAT AINESOSAT
${longIngredients}
PAKKAUS
pullo`;

    const result = extractIngredients(bodyText);
    expect(result?.length).toBe(1000);
  });
});

describe('Scraper Parsing - Taste Profile', () => {
  it('should extract taste profile starting with Punainen', () => {
    const bodyText = `Some header
Punainen, täyteläinen, pehmeä, kypsän marjaisa, mausteinen viini
Other content`;

    const result = extractTasteProfile(bodyText);
    expect(result).toBe('Punainen, täyteläinen, pehmeä, kypsän marjaisa, mausteinen viini');
  });

  it('should extract taste profile starting with Valkoinen', () => {
    const bodyText = `Product name
Valkoinen, kuiva, raikas, sitruksinen, mineraalinen viini
MAKU section`;

    const result = extractTasteProfile(bodyText);
    expect(result).toBe('Valkoinen, kuiva, raikas, sitruksinen, mineraalinen viini');
  });

  it('should extract taste profile starting with Kullanvärinen', () => {
    const bodyText = `Whisky name
Kullanvärinen, täyteläinen, makea, vaniljainen, toffeinen viski
Details`;

    const result = extractTasteProfile(bodyText);
    expect(result).toBe('Kullanvärinen, täyteläinen, makea, vaniljainen, toffeinen viski');
  });

  it('should return null when no taste profile found', () => {
    const bodyText = `Product name
Some description without taste keywords
Other content`;

    const result = extractTasteProfile(bodyText);
    expect(result).toBeNull();
  });

  // Real product 900629 - Valhalla Cream Liqueur
  it('should extract taste profile starting with Vaaleanruskea (product 900629)', () => {
    const bodyText = `Valhalla Cream Liqueur
Vaaleanruskea, pehmeä, makea, täyteläinen, kermainen, toffeinen, kevyen mausteinen
15 %
0.5 l`;

    const result = extractTasteProfile(bodyText);
    expect(result).toBe('Vaaleanruskea, pehmeä, makea, täyteläinen, kermainen, toffeinen, kevyen mausteinen');
  });
});

describe('Scraper Parsing - Usage Tips', () => {
  // Real product 906458 - Fair & Square Red
  it('should extract usage tips for wine (product 906458)', () => {
    const bodyText = `KÄYTTÖVINKIT

Runsaat ja aromikkaat viinit ovat hyvä valinta, kun katat pöytään lihaisia ruokia.

Kokeile näiden viinien kanssa esimerkiksi barbeque-marinoituja possunribsejä, kasvis-naudanlihavartaita tai T-luupihvejä.

TARJOILU

Punaviinit ovat parhaimmillaan`;

    const result = extractUsageTips(bodyText);
    expect(result).toContain('Runsaat ja aromikkaat viinit');
    expect(result).toContain('barbeque-marinoituja possunribsejä');
    expect(result).not.toContain('TARJOILU');
  });

  // Real product 792836 - Olvi Tuplapukki (beer)
  it('should extract usage tips for beer (product 792836)', () => {
    const bodyText = `KÄYTTÖVINKIT

Runsaat ja tasapainoiset vahvat lagerit pyöristävät ruoan makua ja läpäisevät sen rasvaisuutta raikastaen näin suutuntumaa.

Kokeile vahvan lagerin kanssa esimerkiksi poronkäristystä, stroganoffia tai grillattuja maksapihvejä.

TARJOILU

Vahvat lagerit kannattaa`;

    const result = extractUsageTips(bodyText);
    expect(result).toContain('vahvat lagerit');
    expect(result).toContain('poronkäristystä');
    expect(result).not.toContain('TARJOILU');
  });

  it('should return null when no usage tips section exists', () => {
    const bodyText = `Product name
Some description
TARJOILU
Serve cold`;

    const result = extractUsageTips(bodyText);
    expect(result).toBeNull();
  });

  it('should stop at Tuotteen mahdollisesti section', () => {
    const bodyText = `KÄYTTÖVINKIT
Sopii seurusteluun ja ruoan kanssa.
Tuotteen mahdollisesti sisältämät allergeenit`;

    const result = extractUsageTips(bodyText);
    expect(result).toBe('Sopii seurusteluun ja ruoan kanssa.');
  });
});

describe('Scraper Parsing - Serving Suggestion', () => {
  // Real product 906458 - Fair & Square Red
  it('should extract serving suggestion for wine (product 906458)', () => {
    const bodyText = `TARJOILU

Punaviinit ovat parhaimmillaan, kun ne tarjotaan hieman huoneenlämpöä viileämpinä, noin 16–18-asteisina. Huoneenlämpöinen pullo viilenee sopivaan lämpötilaan jääkaapissa vajaassa puolessa tunnissa.

Tuotteen mahdollisesti sisältämät`;

    const result = extractServingSuggestion(bodyText);
    expect(result).toContain('Punaviinit ovat parhaimmillaan');
    expect(result).toContain('16–18-asteisina');
    expect(result).not.toContain('Tuotteen mahdollisesti');
  });

  // Real product 792836 - Olvi Tuplapukki (beer)
  it('should extract serving suggestion for beer (product 792836)', () => {
    const bodyText = `TARJOILU

Vahvat lagerit kannattaa tarjoilla viilennettyinä, 8–12-asteisina. Huoneenlämpöinen pullo viilenee sopivaan lämpötilaan jääkaapissa reilussa tunnissa.

Alko Oy provides this`;

    const result = extractServingSuggestion(bodyText);
    expect(result).toContain('Vahvat lagerit');
    expect(result).toContain('8–12-asteisina');
    expect(result).not.toContain('Alko Oy');
  });

  // Real product 900629 - Valhalla Cream Liqueur
  it('should extract serving suggestion for liqueur (product 900629)', () => {
    const bodyText = `TARJOILU

Liköörit tarjoillaan viilennettyinä, 10–12-asteisina.

Tuotteen mahdollisesti sisältämät`;

    const result = extractServingSuggestion(bodyText);
    expect(result).toBe('Liköörit tarjoillaan viilennettyinä, 10–12-asteisina.');
  });

  it('should return null when no serving section exists', () => {
    const bodyText = `Product info
KÄYTTÖVINKIT
Some tips here`;

    const result = extractServingSuggestion(bodyText);
    expect(result).toBeNull();
  });
});

describe('Scraper Parsing - Food Pairings Filter', () => {
  // Real product 906458 has these raw pairings including non-food symbols
  it('should filter out certification symbols from food pairings (product 906458)', () => {
    const rawPairings = [
      'porsas',
      'grilliruoka',
      'pikkusuolaiset',
      'nauta',
      'Työolot',
      'Viljely',
      'Vegaaneille soveltuva tuote',
      'Luomu',
    ];

    const result = filterFoodPairings(rawPairings);
    expect(result).toEqual(['porsas', 'grilliruoka', 'pikkusuolaiset', 'nauta']);
    expect(result).not.toContain('Työolot');
    expect(result).not.toContain('Vegaaneille soveltuva tuote');
    expect(result).not.toContain('Luomu');
  });

  // Real product 792836 - Olvi Tuplapukki
  it('should keep all food pairings when no certification symbols (product 792836)', () => {
    const rawPairings = ['grilliruoka', 'porsas', 'nauta', 'pataruoka'];

    const result = filterFoodPairings(rawPairings);
    expect(result).toEqual(['grilliruoka', 'porsas', 'nauta', 'pataruoka']);
  });

  // Real product 904727 - LAB Reserva
  it('should filter mixed food and certification symbols (product 904727)', () => {
    const rawPairings = [
      'grilliruoka',
      'mausteiset ja lihaisat makkarat',
      'porsas',
      'pasta ja pizza',
      'Vegaaneille soveltuva tuote',
    ];

    const result = filterFoodPairings(rawPairings);
    expect(result).toEqual([
      'grilliruoka',
      'mausteiset ja lihaisat makkarat',
      'porsas',
      'pasta ja pizza',
    ]);
  });

  it('should return empty array when all are certification symbols', () => {
    const rawPairings = ['Luomu', 'Reilu kauppa', 'Ympäristö'];

    const result = filterFoodPairings(rawPairings);
    expect(result).toEqual([]);
  });

  it('should handle empty array', () => {
    const result = filterFoodPairings([]);
    expect(result).toEqual([]);
  });
});

describe('Scraper Parsing - Real Product Data Integration', () => {
  // Product 906458 - Fair & Square Red (wine with full enriched data)
  it('should parse all fields for product 906458 (Fair & Square Red)', () => {
    const bodyText = `Fair & Square Organic Red

KÄYTTÖVINKIT

Runsaat ja aromikkaat viinit ovat hyvä valinta, kun katat pöytään lihaisia ruokia.

Kokeile näiden viinien kanssa esimerkiksi barbeque-marinoituja possunribsejä, kasvis-naudanlihavartaita tai T-luupihvejä.

TARJOILU

Punaviinit ovat parhaimmillaan, kun ne tarjotaan hieman huoneenlämpöä viileämpinä, noin 16–18-asteisina. Huoneenlämpöinen pullo viilenee sopivaan lämpötilaan jääkaapissa vajaassa puolessa tunnissa.

TUOTTAJAN ILMOITTAMAT AINESOSAT
Sisältää sulfiitteja. Tarkemman ainesosaluettelon ja ravintoarvot saat asiakaspalvelustamme.
PAKKAUS
lasipullo`;

    expect(extractUsageTips(bodyText)).toContain('Runsaat ja aromikkaat viinit');
    expect(extractServingSuggestion(bodyText)).toContain('16–18-asteisina');
    expect(extractIngredients(bodyText)).toContain('Sisältää sulfiitteja');
  });

  // Product 792836 - Olvi Tuplapukki (beer)
  it('should parse all fields for product 792836 (Olvi Tuplapukki)', () => {
    const bodyText = `Olvi Tuplapukki

KÄYTTÖVINKIT

Runsaat ja tasapainoiset vahvat lagerit pyöristävät ruoan makua ja läpäisevät sen rasvaisuutta raikastaen näin suutuntumaa.

Kokeile vahvan lagerin kanssa esimerkiksi poronkäristystä, stroganoffia tai grillattuja maksapihvejä.

TARJOILU

Vahvat lagerit kannattaa tarjoilla viilennettyinä, 8–12-asteisina. Huoneenlämpöinen pullo viilenee sopivaan lämpötilaan jääkaapissa reilussa tunnissa.

TUOTTAJAN ILMOITTAMAT AINESOSAT
Sisältää ohramallasta
PAKKAUS
tölkki`;

    expect(extractUsageTips(bodyText)).toContain('vahvat lagerit');
    expect(extractServingSuggestion(bodyText)).toContain('8–12-asteisina');
    expect(extractIngredients(bodyText)).toBe('Sisältää ohramallasta');
  });

  // Product 900629 - Valhalla Cream Liqueur (liqueur with taste profile)
  it('should parse all fields for product 900629 (Valhalla Cream Liqueur)', () => {
    const bodyText = `Valhalla Cream Liqueur
Vaaleanruskea, pehmeä, makea, täyteläinen, kermainen, toffeinen, kevyen mausteinen
15 %
0.5 l

TARJOILU

Liköörit tarjoillaan viilennettyinä, 10–12-asteisina.

TUOTTAJAN ILMOITTAMAT AINESOSAT
Sisältää maitoa
PAKKAUS
lasipullo`;

    expect(extractTasteProfile(bodyText)).toContain('Vaaleanruskea');
    expect(extractTasteProfile(bodyText)).toContain('kermainen, toffeinen');
    expect(extractServingSuggestion(bodyText)).toContain('10–12-asteisina');
    expect(extractIngredients(bodyText)).toBe('Sisältää maitoa');
    expect(extractUsageTips(bodyText)).toBeNull(); // Liqueurs don't have usage tips
  });

  // Product 460069 - Koskenkorva Viina (vodka with no enriched data)
  it('should return null for all fields for product 460069 (Koskenkorva Viina)', () => {
    // Vodka products typically have minimal enriched data
    const bodyText = `Koskenkorva Viina
40 %
0.5 l

PAKKAUS
lasipullo`;

    expect(extractTasteProfile(bodyText)).toBeNull();
    expect(extractUsageTips(bodyText)).toBeNull();
    expect(extractServingSuggestion(bodyText)).toBeNull();
    expect(extractIngredients(bodyText)).toBeNull();
  });
});

/**
 * Simulates the smokiness extraction logic from scraper.ts
 * Returns smokiness level (0-4) and label
 */
function extractSmokiness(html: string): { smokiness: number | null; smokinessLabel: string | null } {
  const result: { smokiness: number | null; smokinessLabel: string | null } = {
    smokiness: null,
    smokinessLabel: null,
  };

  // Check if smokiness container exists
  const containerMatch = html.match(/<div[^>]*class="[^"]*smokiness[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/);
  if (!containerMatch) return result;

  const container = containerMatch[0];

  // Extract label
  const labelMatch = container.match(/<div[^>]*class="[^"]*smokiness-label[^"]*"[^>]*>([^<]+)<\/div>/);
  if (labelMatch) {
    result.smokinessLabel = labelMatch[1].trim();
  }

  // Count smokey icons
  const smokeyIcons = container.match(/class="[^"]*smokiness-icon[^"]*smokey[^"]*"/g);
  result.smokiness = smokeyIcons ? smokeyIcons.length : 0;

  return result;
}

/**
 * Simulates the food pairing extraction logic from scraper.ts
 * Extracts from a.pdp-symbol-link[aria-label] but excludes .ecological.certificate elements
 * Certificates are now extracted separately using extractCertificatesFromHtml
 */
function extractFoodPairingsFromHtml(html: string): string[] {
  const result: string[] = [];
  const seenPairings = new Set<string>();

  // Match a.pdp-symbol-link with aria-label but NOT ecological certificate
  // Elements with "ecological certificate" class are certificates, not food pairings
  const regex = /<a[^>]*class="([^"]*)"[^>]*aria-label="([^"]+)"[^>]*>/g;
  let match;

  while ((match = regex.exec(html)) !== null) {
    const classes = match[1];
    const ariaLabel = match[2];
    // Only include if it has pdp-symbol-link but NOT ecological certificate
    if (classes.includes('pdp-symbol-link') && !classes.includes('ecological') && !classes.includes('certificate')) {
      if (ariaLabel && !seenPairings.has(ariaLabel)) {
        seenPairings.add(ariaLabel);
        result.push(ariaLabel);
      }
    }
  }

  // Also try reverse order (aria-label before class)
  const regex2 = /<a[^>]*aria-label="([^"]+)"[^>]*class="([^"]*)"[^>]*>/g;
  while ((match = regex2.exec(html)) !== null) {
    const ariaLabel = match[1];
    const classes = match[2];
    if (classes.includes('pdp-symbol-link') && !classes.includes('ecological') && !classes.includes('certificate')) {
      if (ariaLabel && !seenPairings.has(ariaLabel)) {
        seenPairings.add(ariaLabel);
        result.push(ariaLabel);
      }
    }
  }

  return result;
}

/**
 * Simulates the certificate extraction logic from scraper.ts
 * Extracts from elements with class="ecological certificate link-tooltip"
 */
function extractCertificatesFromHtml(html: string): string[] {
  const result: string[] = [];
  const seenCerts = new Set<string>();

  // Match elements with ecological certificate link-tooltip class and aria-label
  const regex = /<[^>]*class="[^"]*ecological[^"]*certificate[^"]*link-tooltip[^"]*"[^>]*aria-label="([^"]+)"[^>]*>/g;
  let match;

  while ((match = regex.exec(html)) !== null) {
    const ariaLabel = match[1];
    if (ariaLabel && !seenCerts.has(ariaLabel)) {
      seenCerts.add(ariaLabel);
      result.push(ariaLabel);
    }
  }

  // Also try reverse order (aria-label before class)
  const regex2 = /<[^>]*aria-label="([^"]+)"[^>]*class="[^"]*ecological[^"]*certificate[^"]*link-tooltip[^"]*"[^>]*>/g;
  while ((match = regex2.exec(html)) !== null) {
    const ariaLabel = match[1];
    if (ariaLabel && !seenCerts.has(ariaLabel)) {
      seenCerts.add(ariaLabel);
      result.push(ariaLabel);
    }
  }

  return result;
}

describe('Scraper Parsing - Food Pairings', () => {
  // Product 955845 - Veuve Ambal (should NOT have duplicates)
  it('should extract food pairings without duplicates for product 955845', () => {
    // Simulates the HTML structure with both div.foodSymbol_XXX and a.pdp-symbol-link
    const html = `
      <div class="alko-icon top foodSymbol_Aperitiivi"></div>
      <div class="alko-icon top foodSymbol_Kana_kalkkuna"></div>
      <div class="alko-icon top foodSymbol_Marjat_ja_hedelmat"></div>
      <a aria-label="aperitiivi" class="trackable-filter-item pdp-symbol-link" data-applied-filters="..."></a>
      <a aria-label="seurustelujuoma" class="trackable-filter-item pdp-symbol-link" data-applied-filters="..."></a>
      <a aria-label="kana, kalkkuna" class="trackable-filter-item pdp-symbol-link" data-applied-filters="..."></a>
      <a aria-label="marjat ja hedelmät" class="trackable-filter-item pdp-symbol-link" data-applied-filters="..."></a>
    `;

    const result = extractFoodPairingsFromHtml(html);

    // Should only have 4 unique pairings (from aria-label, not class names)
    expect(result).toHaveLength(4);
    expect(result).toContain('aperitiivi');
    expect(result).toContain('seurustelujuoma');
    expect(result).toContain('kana, kalkkuna'); // With comma!
    expect(result).toContain('marjat ja hedelmät'); // With ä!

    // Should NOT contain duplicates without proper formatting
    expect(result).not.toContain('kana kalkkuna'); // Without comma
    expect(result).not.toContain('marjat ja hedelmat'); // Without ä
  });

  // Product 900162 - Cortese Orange-Utan (certificates in separate elements)
  it('should exclude ecological certificate elements from food pairings for product 900162', () => {
    // Simulates HTML where certificates have ecological certificate class
    const html = `
      <a aria-label="seurustelujuoma" class="trackable-filter-item pdp-symbol-link"></a>
      <a aria-label="kala" class="trackable-filter-item pdp-symbol-link"></a>
      <a aria-label="äyriäiset" class="trackable-filter-item pdp-symbol-link"></a>
      <a aria-label="Luomu" class="ecological certificate link-tooltip"></a>
      <a aria-label="Vegaaneille soveltuva tuote" class="ecological certificate link-tooltip"></a>
      <a aria-label="Työolot" class="ecological certificate link-tooltip"></a>
      <a aria-label="Tuotanto" class="ecological certificate link-tooltip"></a>
      <a aria-label="Viljely" class="ecological certificate link-tooltip"></a>
    `;

    const result = extractFoodPairingsFromHtml(html);

    // Should only have food pairings, NOT certificates
    expect(result).toHaveLength(3);
    expect(result).toContain('seurustelujuoma');
    expect(result).toContain('kala');
    expect(result).toContain('äyriäiset');

    // Should NOT contain any certificates
    expect(result).not.toContain('Luomu');
    expect(result).not.toContain('Vegaaneille soveltuva tuote');
    expect(result).not.toContain('Työolot');
    expect(result).not.toContain('Tuotanto');
    expect(result).not.toContain('Viljely');
  });

  it('should handle duplicate aria-labels by only adding once', () => {
    const html = `
      <a aria-label="aperitiivi" class="pdp-symbol-link"></a>
      <a aria-label="aperitiivi" class="pdp-symbol-link"></a>
      <a aria-label="seurustelujuoma" class="pdp-symbol-link"></a>
    `;

    const result = extractFoodPairingsFromHtml(html);

    expect(result).toHaveLength(2);
    expect(result).toEqual(['aperitiivi', 'seurustelujuoma']);
  });

  it('should return empty array when no food pairings exist', () => {
    const html = `
      <div class="product-info">
        <p>No food symbols here</p>
      </div>
    `;

    const result = extractFoodPairingsFromHtml(html);
    expect(result).toEqual([]);
  });
});

describe('Scraper Parsing - Certificates', () => {
  // Product 900162 - Cortese Orange-Utan (organic with multiple certificates)
  it('should extract all certificates for product 900162', () => {
    const html = `
      <a aria-label="seurustelujuoma" class="trackable-filter-item pdp-symbol-link"></a>
      <a aria-label="kala" class="trackable-filter-item pdp-symbol-link"></a>
      <a aria-label="Luomu" class="ecological certificate link-tooltip"></a>
      <a aria-label="Vegaaneille soveltuva tuote" class="ecological certificate link-tooltip"></a>
      <a aria-label="Työolot" class="ecological certificate link-tooltip"></a>
      <a aria-label="Tuotanto" class="ecological certificate link-tooltip"></a>
      <a aria-label="Viljely" class="ecological certificate link-tooltip"></a>
    `;

    const result = extractCertificatesFromHtml(html);

    expect(result).toHaveLength(5);
    expect(result).toContain('Luomu');
    expect(result).toContain('Vegaaneille soveltuva tuote');
    expect(result).toContain('Työolot');
    expect(result).toContain('Tuotanto');
    expect(result).toContain('Viljely');

    // Should NOT contain food pairings
    expect(result).not.toContain('seurustelujuoma');
    expect(result).not.toContain('kala');
  });

  it('should handle product with only organic certificate', () => {
    const html = `
      <a aria-label="Luomu" class="ecological certificate link-tooltip"></a>
      <a aria-label="aperitiivi" class="pdp-symbol-link"></a>
    `;

    const result = extractCertificatesFromHtml(html);

    expect(result).toHaveLength(1);
    expect(result).toContain('Luomu');
  });

  it('should return empty array when no certificates exist', () => {
    const html = `
      <a aria-label="seurustelujuoma" class="trackable-filter-item pdp-symbol-link"></a>
      <a aria-label="kala" class="trackable-filter-item pdp-symbol-link"></a>
    `;

    const result = extractCertificatesFromHtml(html);
    expect(result).toEqual([]);
  });

  it('should handle duplicate certificates by only adding once', () => {
    const html = `
      <a aria-label="Luomu" class="ecological certificate link-tooltip"></a>
      <a aria-label="Luomu" class="ecological certificate link-tooltip"></a>
      <a aria-label="Viljely" class="ecological certificate link-tooltip"></a>
    `;

    const result = extractCertificatesFromHtml(html);

    expect(result).toHaveLength(2);
    expect(result).toContain('Luomu');
    expect(result).toContain('Viljely');
  });

  it('should handle fair trade certificate (Reilu kauppa)', () => {
    const html = `
      <a aria-label="Reilu kauppa" class="ecological certificate link-tooltip"></a>
      <a aria-label="Luomu" class="ecological certificate link-tooltip"></a>
    `;

    const result = extractCertificatesFromHtml(html);

    expect(result).toHaveLength(2);
    expect(result).toContain('Reilu kauppa');
    expect(result).toContain('Luomu');
  });

  it('should extract Ympäristö and Pakkaus certificates', () => {
    const html = `
      <a aria-label="Ympäristö" class="ecological certificate link-tooltip"></a>
      <a aria-label="Pakkaus" class="ecological certificate link-tooltip"></a>
    `;

    const result = extractCertificatesFromHtml(html);

    expect(result).toHaveLength(2);
    expect(result).toContain('Ympäristö');
    expect(result).toContain('Pakkaus');
  });
});

describe('Scraper Parsing - Smokiness', () => {
  // Product 113537 - Glen Scanlan (hennon savuinen, level 1)
  it('should extract smokiness level 1 (hennon savuinen) for product 113537', () => {
    const html = `
      <div class="smokiness">
        <div class="smokiness-label">hennon savuinen</div>
        <div class="smokiness-icons">
          <span class="smokiness-icon smokey"></span>
          <span class="smokiness-icon"></span>
          <span class="smokiness-icon"></span>
          <span class="smokiness-icon"></span>
        </div>
      </div>
    `;

    const result = extractSmokiness(html);
    expect(result.smokiness).toBe(1);
    expect(result.smokinessLabel).toBe('hennon savuinen');
  });

  // Product 001576 - Jameson (ei savuinen, level 0)
  it('should extract smokiness level 0 (ei savuinen) for product 001576', () => {
    const html = `
      <div class="smokiness">
        <div class="smokiness-label">ei savuinen</div>
        <div class="smokiness-icons">
          <span class="smokiness-icon"></span>
          <span class="smokiness-icon"></span>
          <span class="smokiness-icon"></span>
          <span class="smokiness-icon"></span>
        </div>
      </div>
    `;

    const result = extractSmokiness(html);
    expect(result.smokiness).toBe(0);
    expect(result.smokinessLabel).toBe('ei savuinen');
  });

  // Product 911377 - Compass Box Peat Monster (savuinen, level 3)
  it('should extract smokiness level 3 (savuinen) for product 911377', () => {
    const html = `
      <div class="smokiness">
        <div class="smokiness-label">savuinen</div>
        <div class="smokiness-icons">
          <span class="smokiness-icon smokey"></span>
          <span class="smokiness-icon smokey"></span>
          <span class="smokiness-icon smokey"></span>
          <span class="smokiness-icon"></span>
        </div>
      </div>
    `;

    const result = extractSmokiness(html);
    expect(result.smokiness).toBe(3);
    expect(result.smokinessLabel).toBe('savuinen');
  });

  // Product 900323 - Octomore (voimakkaan savuinen, level 4)
  it('should extract smokiness level 4 (voimakkaan savuinen) for product 900323', () => {
    const html = `
      <div class="smokiness">
        <div class="smokiness-label">voimakkaan savuinen</div>
        <div class="smokiness-icons">
          <span class="smokiness-icon smokey"></span>
          <span class="smokiness-icon smokey"></span>
          <span class="smokiness-icon smokey"></span>
          <span class="smokiness-icon smokey"></span>
        </div>
      </div>
    `;

    const result = extractSmokiness(html);
    expect(result.smokiness).toBe(4);
    expect(result.smokinessLabel).toBe('voimakkaan savuinen');
  });

  it('should return null when no smokiness container exists', () => {
    const html = `
      <div class="product-info">
        <div class="taste">Täyteläinen, hedelmäinen</div>
      </div>
    `;

    const result = extractSmokiness(html);
    expect(result.smokiness).toBeNull();
    expect(result.smokinessLabel).toBeNull();
  });

  it('should handle smokiness container without label', () => {
    const html = `
      <div class="smokiness">
        <div class="smokiness-icons">
          <span class="smokiness-icon smokey"></span>
          <span class="smokiness-icon smokey"></span>
          <span class="smokiness-icon"></span>
          <span class="smokiness-icon"></span>
        </div>
      </div>
    `;

    const result = extractSmokiness(html);
    expect(result.smokiness).toBe(2);
    expect(result.smokinessLabel).toBeNull();
  });
});

describe('Scraper Parsing - Field Order Independence', () => {
  it('should extract ingredients regardless of section order', () => {
    // Ingredients before other sections
    const bodyText1 = `TUOTTAJAN ILMOITTAMAT AINESOSAT
Sisältää sulfiitteja
PAKKAUS
lasipullo
KÄYTTÖVINKIT
Some tips`;

    expect(extractIngredients(bodyText1)).toBe('Sisältää sulfiitteja');

    // Ingredients after other sections
    const bodyText2 = `KÄYTTÖVINKIT
Some tips
TARJOILU
Serve cold
TUOTTAJAN ILMOITTAMAT AINESOSAT
Sisältää maitoa
PAKKAUS
lasipullo`;

    expect(extractIngredients(bodyText2)).toBe('Sisältää maitoa');
  });

  it('should extract usage tips regardless of position', () => {
    // Tips at the beginning
    const bodyText1 = `KÄYTTÖVINKIT
Sopii seurusteluun
TARJOILU
Serve at 16-18°C`;

    expect(extractUsageTips(bodyText1)).toBe('Sopii seurusteluun');

    // Tips after other content
    const bodyText2 = `Product name
Some info
KÄYTTÖVINKIT
Maistuu parhaiten ruoan kanssa
TARJOILU
Cold`;

    expect(extractUsageTips(bodyText2)).toBe('Maistuu parhaiten ruoan kanssa');
  });

  it('should handle missing sections gracefully', () => {
    const bodyText = `TARJOILU
Serve at room temperature

TUOTTAJAN ILMOITTAMAT AINESOSAT
Water, alcohol`;

    // No KÄYTTÖVINKIT section
    expect(extractUsageTips(bodyText)).toBeNull();
    // Other sections still work
    expect(extractServingSuggestion(bodyText)).toContain('room temperature');
    expect(extractIngredients(bodyText)).toBe('Water, alcohol');
  });
});

/**
 * Simulates product ID extraction from search results page (searchByFoodSymbol)
 * Extracts 6-digit product IDs from links like /tuotteet/123456
 */
function extractProductIdsFromSearchResults(html: string): string[] {
  const ids: string[] = [];
  const seenIds = new Set<string>();

  // Match all /tuotteet/XXXXXX patterns
  const regex = /\/tuotteet\/(\d{6})/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const id = match[1];
    if (!seenIds.has(id)) {
      seenIds.add(id);
      ids.push(id);
    }
  }

  return ids;
}

describe('Scraper Parsing - Search Results (Food Symbol)', () => {
  it('should extract product IDs from search results page', () => {
    const html = `
      <div class="product-tile">
        <a href="/tuotteet/900298" class="product-link">Wine A</a>
      </div>
      <div class="product-tile">
        <a href="/tuotteet/912345" class="product-link">Wine B</a>
      </div>
      <div class="product-tile">
        <a href="/tuotteet/923456" class="product-link">Wine C</a>
      </div>
    `;

    const result = extractProductIdsFromSearchResults(html);

    expect(result).toHaveLength(3);
    expect(result).toContain('900298');
    expect(result).toContain('912345');
    expect(result).toContain('923456');
  });

  it('should deduplicate product IDs that appear multiple times', () => {
    // Product ID often appears in multiple links (image, title, etc.)
    const html = `
      <div class="product-tile">
        <a href="/tuotteet/900298"><img src="..."/></a>
        <a href="/tuotteet/900298" class="title">Wine A</a>
        <a href="/tuotteet/900298" class="details">Details</a>
      </div>
      <div class="product-tile">
        <a href="/tuotteet/912345">Wine B</a>
      </div>
    `;

    const result = extractProductIdsFromSearchResults(html);

    expect(result).toHaveLength(2);
    expect(result).toContain('900298');
    expect(result).toContain('912345');
  });

  it('should only match 6-digit product IDs from valid product links', () => {
    const html = `
      <a href="/tuotteet/900298">Valid 6-digit</a>
      <a href="/tuotteet/12345">Invalid 5-digit (ignored)</a>
      <a href="/myymalat-palvelut/2736">Store link (ignored)</a>
      <a href="/tuotteet/tuotelistaus?page=2">Listing link (ignored)</a>
    `;

    const result = extractProductIdsFromSearchResults(html);

    expect(result).toHaveLength(1);
    expect(result).toContain('900298');
  });

  it('should handle URLs with query parameters', () => {
    const html = `
      <a href="/tuotteet/900298?referMethod=productSearch">Wine A</a>
      <a href="/tuotteet/912345?foo=bar&baz=qux">Wine B</a>
    `;

    const result = extractProductIdsFromSearchResults(html);

    expect(result).toHaveLength(2);
    expect(result).toContain('900298');
    expect(result).toContain('912345');
  });

  it('should return empty array when no products found', () => {
    const html = `
      <div class="no-results">
        <p>Ei tuloksia haullesi</p>
      </div>
    `;

    const result = extractProductIdsFromSearchResults(html);
    expect(result).toEqual([]);
  });

  it('should handle real-world search results structure', () => {
    // Simulated structure based on Alko.fi search page
    const html = `
      <div class="product-list">
        <div class="product-tile" id="product-tile-900298">
          <div class="product-image">
            <a href="/tuotteet/900298"><img src="/images/900298.jpg"/></a>
          </div>
          <div class="product-info">
            <a href="/tuotteet/900298" class="product-name">Château Margaux 2015</a>
            <span class="price">189,90 €</span>
          </div>
        </div>
        <div class="product-tile" id="product-tile-901234">
          <div class="product-image">
            <a href="/tuotteet/901234"><img src="/images/901234.jpg"/></a>
          </div>
          <div class="product-info">
            <a href="/tuotteet/901234" class="product-name">Opus One 2018</a>
            <span class="price">399,00 €</span>
          </div>
        </div>
      </div>
      <div class="pagination">
        <a href="/tuotteet/tuotelistaus?page=2">Next</a>
      </div>
    `;

    const result = extractProductIdsFromSearchResults(html);

    expect(result).toHaveLength(2);
    expect(result).toContain('900298');
    expect(result).toContain('901234');
    // Should not include anything from pagination links
  });
});
