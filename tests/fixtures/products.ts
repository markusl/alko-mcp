/**
 * Real product data extracted from Alko's price list Excel file
 * Used for testing search functionality with actual data
 */
import type { Product } from '../../src/types/index.js';

// Helper to create minimal Product with required fields
function createProduct(data: Partial<Product> & { id: string; name: string; price: number }): Product {
  return {
    id: data.id,
    name: data.name,
    producer: data.producer ?? '',
    ean: data.ean ?? '',
    price: data.price,
    pricePerLiter: data.pricePerLiter ?? data.price,
    bottleSize: data.bottleSize ?? '0.75 l',
    packagingType: data.packagingType ?? 'lasipullo',
    closureType: data.closureType ?? 'korkki',
    type: data.type ?? 'punaviinit',
    subtype: data.subtype ?? null,
    specialGroup: data.specialGroup ?? null,
    beerType: data.beerType ?? null,
    sortCode: data.sortCode ?? 0,
    country: data.country ?? '',
    region: data.region ?? null,
    vintage: data.vintage ?? null,
    grapes: data.grapes ?? null,
    labelNotes: data.labelNotes ?? null,
    description: data.description ?? null,
    notes: data.notes ?? null,
    tasteProfile: data.tasteProfile ?? null,
    usageTips: data.usageTips ?? null,
    servingSuggestion: data.servingSuggestion ?? null,
    foodPairings: data.foodPairings ?? null,
    certificates: data.certificates ?? null,
    ingredients: data.ingredients ?? null,
    smokiness: data.smokiness ?? null,
    smokinessLabel: data.smokinessLabel ?? null,
    alcoholPercentage: data.alcoholPercentage ?? 12,
    acids: data.acids ?? null,
    sugar: data.sugar ?? null,
    energy: data.energy ?? null,
    originalGravity: data.originalGravity ?? null,
    colorEBC: data.colorEBC ?? null,
    bitternessEBU: data.bitternessEBU ?? null,
    assortment: data.assortment ?? 'vakiovalikoima',
    isNew: data.isNew ?? false,
    updatedAt: { toDate: () => new Date() } as never,
    createdAt: { toDate: () => new Date() } as never,
  };
}

/**
 * Real products from Alko's catalog for testing search functionality
 * These products were extracted from the actual Excel price list
 */
export const testProducts: Product[] = [
  // Portuguese wines - LAB Reserva, Quinta das Setencostas
  createProduct({
    id: '904727',
    name: 'LAB Reserva 2022',
    producer: 'Casa Santos Lima',
    price: 10.79,
    pricePerLiter: 14.25,
    bottleSize: '0.75 l',
    type: 'punaviinit',
    subtype: 'Mehevä & Hilloinen',
    country: 'Portugali',
    region: 'Lisboa',
    alcoholPercentage: 14,
    description: 'Runsaanpunainen, keskitäyteläinen, keskitanniininen, karhunvatukkainen, kirsikkainen, karpaloinen, kevyen mustaherukkainen, mausteinen',
    grapes: 'Cabernet Sauvignon, Syrah, Touriga Nacional,',
    specialGroup: 'Vegaaneille soveltuva tuote',
  }),
  createProduct({
    id: '947714',
    name: 'Quinta das Setencostas 2021',
    producer: 'Casa Santos Lima',
    price: 6.39,
    pricePerLiter: 16.77,
    bottleSize: '0.375 l',
    type: 'punaviinit',
    subtype: 'Mehevä & Hilloinen',
    country: 'Portugali',
    region: 'Lisboa',
    alcoholPercentage: 13.5,
    description: 'Tummanpunainen, keskitäyteläinen, keskitanniininen, vadelmainen, mustaherukkainen, mausteinen, vaniljainen',
    grapes: 'Castelão, Tinta Miúda,',
    specialGroup: 'Vegaaneille soveltuva tuote',
  }),

  // Finnish beer - Olvi Tuplapukki
  createProduct({
    id: '792836',
    name: 'Olvi Tuplapukki tölkki',
    producer: 'Olvi',
    price: 4.28,
    pricePerLiter: 8.26,
    bottleSize: '0.5 l',
    type: 'oluet',
    subtype: 'Vahva lager',
    country: 'Suomi',
    alcoholPercentage: 8.5,
    description: 'Kullankeltainen, täyteläinen, keskiasteisesti humaloitu, maltainen, makean hedelmäinen',
    beerType: 'vahva lager',
  }),

  // Chilean wines - Frontera, Viña Maipo
  createProduct({
    id: '008106',
    name: 'Frontera Chardonnay 2024',
    producer: 'Concha y Toro',
    price: 8.39,
    pricePerLiter: 11.05,
    bottleSize: '0.75 l',
    type: 'valkoviinit',
    subtype: 'Pirteä & Hedelmäinen',
    country: 'Chile',
    region: 'Valle Central',
    alcoholPercentage: 13,
    description: 'Vaaleanviherkeltainen, kuiva, hapokas, sitruksinen, omenainen, kevyen valkopippurinen, yrttinen, hennon paahteinen',
    grapes: 'Chardonnay,',
  }),
  createProduct({
    id: '588667',
    name: 'Viña Maipo Chardonnay 2025',
    producer: 'Viña Maipo',
    price: 8.39,
    pricePerLiter: 11.05,
    bottleSize: '0.75 l',
    type: 'valkoviinit',
    subtype: 'Pirteä & Hedelmäinen',
    country: 'Chile',
    region: 'Valle Central',
    alcoholPercentage: 13,
    description: 'Vaaleankeltainen, kuiva, hapokas, viheromenainen, valkoherukkainen, kypsän greippinen, mineraalinen, yrttinen',
    grapes: 'Chardonnay,',
  }),

  // South African wine - Pearly Bay
  createProduct({
    id: '007742',
    name: 'Pearly Bay Dry White',
    producer: 'KWV',
    price: 8.39,
    pricePerLiter: 11.05,
    bottleSize: '0.75 l',
    type: 'valkoviinit',
    subtype: 'Pirteä & Hedelmäinen',
    country: 'Etelä-Afrikka',
    region: 'Muut',
    alcoholPercentage: 12,
    description: 'Vaaleanviherkeltainen, kuiva, hapokas, sitruksinen, viherherukkainen, kevyen päärynäinen, mineraalinen, hennon mausteinen',
    grapes: 'Chenin Blanc, Colombard,',
  }),

  // Finnish vodka - Koskenkorva
  createProduct({
    id: '460069',
    name: 'Koskenkorva Viina',
    producer: 'Altia',
    price: 26.89,
    pricePerLiter: 38.41,
    bottleSize: '0.7 l',
    type: 'vodkat ja viinat',
    subtype: 'Viinat',
    country: 'Suomi',
    alcoholPercentage: 38,
    description: 'Väritön, pehmeä, kuiva, neutraali, hennon viljainen',
  }),
  createProduct({
    id: '083618',
    name: 'Koskenkorva Viina muovipullo',
    producer: 'Altia',
    price: 18.99,
    pricePerLiter: 38.0,
    bottleSize: '0.5 l',
    type: 'vodkat ja viinat',
    subtype: 'Viinat',
    country: 'Suomi',
    alcoholPercentage: 38,
    description: 'Väritön, pehmeä, kuiva, neutraali, hennon viljainen',
  }),

  // Italian wine - Barolo
  createProduct({
    id: '939876',
    name: 'Aldo Conterno Barolo Bussia 2020',
    producer: 'Aldo Conterno',
    price: 89.98,
    pricePerLiter: 119.97,
    bottleSize: '0.75 l',
    type: 'punaviinit',
    subtype: 'Vivahteikas & Kehittynyt',
    country: 'Italia',
    region: 'Piemonte',
    alcoholPercentage: 14.5,
    description: 'Granaatinpunainen, täyteläinen, tanniininen, kirsikkainen, mausteinen, tamminen',
    grapes: 'Nebbiolo,',
  }),

  // French wine with special characters - Château
  createProduct({
    id: '907123',
    name: 'Château Margaux 2018',
    producer: 'Château Margaux',
    price: 899.00,
    pricePerLiter: 1198.67,
    bottleSize: '0.75 l',
    type: 'punaviinit',
    subtype: 'Vivahteikas & Kehittynyt',
    country: 'Ranska',
    region: 'Bordeaux',
    alcoholPercentage: 13.5,
    description: 'Tummanpunainen, täyteläinen, hienotanniininen, mustaherukkainen, tamminen',
    grapes: 'Cabernet Sauvignon, Merlot,',
  }),

  // Japanese whisky with special characters
  createProduct({
    id: '911702',
    name: 'Akashi Meïsei',
    producer: 'Eigashima Shuzo',
    price: 42.98,
    pricePerLiter: 85.96,
    bottleSize: '0.5 l',
    type: 'viskit',
    subtype: 'Blended whisky',
    country: 'Japani',
    alcoholPercentage: 40,
    description: 'Kullanruskea, pehmeä, maltainen, vaniljainen, hedelmäinen',
  }),

  // Whiskey products with various smokiness levels for testing
  createProduct({
    id: '113537',
    name: 'Glen Scanlan Blended Scotch Whisky',
    producer: 'Glen Scanlan',
    price: 18.98,
    pricePerLiter: 27.11,
    bottleSize: '0.7 l',
    type: 'viskit',
    subtype: 'Blended whisky',
    country: 'Skotlanti',
    alcoholPercentage: 40,
    description: 'Meripihkan värinen, pehmeä, täyteläinen, makeahko, maltainen, mausteinen',
    smokiness: 1,
    smokinessLabel: 'hennon savuinen',
  }),
  createProduct({
    id: '001576',
    name: 'Jameson',
    producer: 'Irish Distillers',
    price: 28.89,
    pricePerLiter: 41.27,
    bottleSize: '0.7 l',
    type: 'viskit',
    subtype: 'Blended whisky',
    country: 'Irlanti',
    alcoholPercentage: 40,
    description: 'Kullanruskea, pehmeä, kevyt, hedelmäinen, vaniljainen, maltainen, hennon mausteinen',
    smokiness: 0,
    smokinessLabel: 'ei savuinen',
  }),
  createProduct({
    id: '911377',
    name: 'Compass Box Peat Monster',
    producer: 'Compass Box',
    price: 64.98,
    pricePerLiter: 92.83,
    bottleSize: '0.7 l',
    type: 'viskit',
    subtype: 'Blended Malt whisky',
    country: 'Skotlanti',
    alcoholPercentage: 46,
    description: 'Kullanruskea, täyteläinen, savuinen, hedelmäinen, maltainen, mausteinen',
    smokiness: 3,
    smokinessLabel: 'savuinen',
  }),
  createProduct({
    id: '163297',
    name: 'Kolme Leijonaa Savu',
    producer: 'Altia',
    price: 41.98,
    pricePerLiter: 59.97,
    bottleSize: '0.7 l',
    type: 'viskit',
    subtype: 'Blended whisky',
    country: 'Suomi',
    alcoholPercentage: 43,
    description: 'Kullanvärinen, täyteläinen, savuinen, maltainen, karpaloinen',
    smokiness: 3,
    smokinessLabel: 'savuinen',
  }),
  createProduct({
    id: '900323',
    name: 'Octomore 15.1 Scottish Barley 5 YO',
    producer: 'Bruichladdich',
    price: 295.00,
    pricePerLiter: 421.43,
    bottleSize: '0.7 l',
    type: 'viskit',
    subtype: 'Single Malt whisky',
    country: 'Skotlanti',
    alcoholPercentage: 59.1,
    description: 'Meripihkan värinen, täyteläinen, voimakas, intensiivisen savuinen, toffeinen, sitruunainen',
    smokiness: 4,
    smokinessLabel: 'voimakkaan savuinen',
  }),

  // Sparkling wines with food pairings for deduplication testing
  createProduct({
    id: '955845',
    name: 'Veuve Ambal Millésimé Rosé Crémant de Bourgogne Brut 2023',
    producer: 'Veuve Ambal',
    price: 16.98,
    pricePerLiter: 22.64,
    bottleSize: '0.75 l',
    type: 'kuohuviinit ja samppanjat',
    subtype: 'Pirteä & hedelmäinen',
    country: 'Ranska',
    region: 'Bourgogne',
    alcoholPercentage: 12,
    description: 'Vaaleanpunainen, kuiva, raikas, mansikkainen, sitruunainen',
    grapes: 'Chardonnay, Gamay, Pinot Noir,',
    foodPairings: ['aperitiivi', 'seurustelujuoma', 'kana, kalkkuna', 'marjat ja hedelmät'],
  }),
  createProduct({
    id: '574727',
    name: 'Braunewell Cremant Riesling 2022',
    producer: 'Braunewell',
    price: 18.98,
    pricePerLiter: 25.31,
    bottleSize: '0.75 l',
    type: 'kuohuviinit ja samppanjat',
    subtype: 'Pirteä & hedelmäinen',
    country: 'Saksa',
    region: 'Rheinhessen',
    alcoholPercentage: 12.5,
    description: 'Vaalean kultainen, kuiva, raikas, sitruksinen, omennainen, kukkainen',
    grapes: 'Riesling,',
    specialGroup: 'Vegaaneille soveltuva tuote',
    foodPairings: ['seurustelujuoma', 'salaatit, kasvisruoka', 'pikkusuolaiset', 'tulinen ruoka'],
  }),

  // Argentinian wine - Fair & Square
  createProduct({
    id: '906458',
    name: 'Fair & Square Red 2024 kartonkitölkki',
    producer: 'La Riojana',
    price: 11.98,
    pricePerLiter: 11.98,
    bottleSize: '1 l',
    type: 'punaviinit',
    subtype: 'Mehevä & Hilloinen',
    country: 'Argentiina',
    region: 'La Rioja',
    alcoholPercentage: 13,
    description: 'Sinipunainen, täyteläinen, keskitanniininen, boysenmarjainen, mustaherukkainen, tumman kirsikkainen, kevyen vaniljainen, hennon toffeinen',
    grapes: 'Syrah,',
  }),

  // Products with special diacritics - Côtes du Rhône
  createProduct({
    id: '912345',
    name: 'Côtes du Rhône Rouge 2022',
    producer: 'Maison Nicolas',
    price: 12.49,
    pricePerLiter: 16.65,
    bottleSize: '0.75 l',
    type: 'punaviinit',
    subtype: 'Mehevä & Hilloinen',
    country: 'Ranska',
    region: 'Rhône',
    alcoholPercentage: 14,
    description: 'Tummanpunainen, keskitäyteläinen, pehmeä, marjainen, mausteinen',
    grapes: 'Grenache, Syrah,',
  }),

  // Additional Viña Maipo for multi-word search testing
  createProduct({
    id: '500003',
    name: 'Viña Maipo Pinot Grigio 2025 hanapakkaus',
    producer: 'Viña Maipo',
    price: 21.99,
    pricePerLiter: 7.33,
    bottleSize: '3 l',
    type: 'valkoviinit',
    subtype: 'Pirteä & Hedelmäinen',
    country: 'Chile',
    region: 'Valle Central',
    alcoholPercentage: 12.5,
    description: 'Vaaleankeltainen, kuiva, raikas, sitruksinen, omennainen',
    grapes: 'Pinot Grigio,',
  }),

  // Finnish viina for relevance scoring tests - "Suomi Viina" search
  createProduct({
    id: '500004',
    name: 'Suomi Viina',
    producer: 'Test Producer',
    price: 19.99,
    pricePerLiter: 28.56,
    bottleSize: '0.7 l',
    type: 'vodkat ja viinat',
    subtype: 'Viinat',
    country: 'Suomi',
    alcoholPercentage: 38,
    description: 'Väritön, pehmeä, kuiva, neutraali',
  }),

  // Additional product for relevance testing - partial match in name
  createProduct({
    id: '500005',
    name: 'Suomi Special Edition',
    producer: 'Finnish Distillery',
    price: 34.99,
    pricePerLiter: 49.99,
    bottleSize: '0.7 l',
    type: 'vodkat ja viinat',
    subtype: 'Vodkat',
    country: 'Suomi',
    alcoholPercentage: 40,
    description: 'Väritön, pehmeä, vivahteikas, viljainen',
  }),

  // === PRODUCTS FOR EACH CATEGORY TYPE ===

  // Rosé wine
  createProduct({
    id: '960123',
    name: 'Whispering Angel Côtes de Provence Rosé 2023',
    producer: "Château d'Esclans",
    price: 24.98,
    pricePerLiter: 33.31,
    bottleSize: '0.75 l',
    type: 'roseeviinit',
    subtype: 'Keskitäyteläinen rosee',
    country: 'Ranska',
    region: 'Provence',
    alcoholPercentage: 13,
    description: 'Vaaleanpunainen, kuiva, raikas, mansikkainen, sitruksinen, mineraalinen',
    grapes: 'Grenache, Rolle,',
  }),

  // Gin
  createProduct({
    id: '468412',
    name: 'Hendricks Gin',
    producer: 'William Grant & Sons',
    price: 38.98,
    pricePerLiter: 55.69,
    bottleSize: '0.7 l',
    type: 'ginit ja maustetut viinat',
    subtype: 'Ginit',
    country: 'Skotlanti',
    alcoholPercentage: 41.4,
    description: 'Väritön, pehmeä, kuiva, kukkainen, kurkku, ruusu, katajanmarja',
  }),

  // Rum
  createProduct({
    id: '003245',
    name: 'Havana Club Añejo 7 Años',
    producer: 'Havana Club',
    price: 32.98,
    pricePerLiter: 47.11,
    bottleSize: '0.7 l',
    type: 'rommit',
    subtype: 'Tumma rommi',
    country: 'Kuuba',
    alcoholPercentage: 40,
    description: 'Tumman meripihkan värinen, pehmeä, täyteläinen, vaniljainen, toffeinen, mausteinen',
  }),

  // Cognac
  createProduct({
    id: '004789',
    name: 'Hennessy VS Cognac',
    producer: 'Hennessy',
    price: 44.98,
    pricePerLiter: 64.26,
    bottleSize: '0.7 l',
    type: 'konjakit',
    subtype: 'VS',
    country: 'Ranska',
    region: 'Cognac',
    alcoholPercentage: 40,
    description: 'Meripihkan värinen, täyteläinen, hedelmäinen, vaniljainen, tamminen',
  }),

  // Liqueur
  createProduct({
    id: '089234',
    name: 'Baileys Original Irish Cream',
    producer: 'Baileys',
    price: 22.98,
    pricePerLiter: 32.83,
    bottleSize: '0.7 l',
    type: 'liköörit ja katkerot',
    subtype: 'Kermaliköörit',
    country: 'Irlanti',
    alcoholPercentage: 17,
    description: 'Vaaleanruskea, pehmeä, makea, kermainen, suklainen, vaniljainen',
  }),

  // Brandy
  createProduct({
    id: '005678',
    name: 'Torres 10 Gran Reserva',
    producer: 'Torres',
    price: 28.98,
    pricePerLiter: 41.40,
    bottleSize: '0.7 l',
    type: 'brandyt, armanjakit ja calvadosit',
    subtype: 'Brandyt',
    country: 'Espanja',
    alcoholPercentage: 38,
    description: 'Meripihkan värinen, pehmeä, vaniljainen, hedelmäinen, tamminen',
  }),

  // Cider
  createProduct({
    id: '756432',
    name: 'Somersby Apple Cider tölkki',
    producer: 'Carlsberg',
    price: 3.49,
    pricePerLiter: 8.73,
    bottleSize: '0.4 l',
    type: 'siiderit',
    subtype: 'Omenasiiderit',
    country: 'Tanska',
    alcoholPercentage: 4.5,
    description: 'Vaalean kultainen, puolimakea, raikas, omenainen, kevyen makea',
  }),

  // Non-alcoholic
  createProduct({
    id: '970123',
    name: 'Leitz Eins Zwei Zero Riesling alkoholiton',
    producer: 'Weingut Leitz',
    price: 8.98,
    pricePerLiter: 11.97,
    bottleSize: '0.75 l',
    type: 'alkoholittomat',
    subtype: 'Valkoviinit',
    country: 'Saksa',
    region: 'Rheingau',
    alcoholPercentage: 0,
    description: 'Vaalean kultainen, kuiva, raikas, sitruksinen, omenainen, kukkainen',
    grapes: 'Riesling,',
  }),

  // Mixed drinks
  createProduct({
    id: '980456',
    name: 'Bacardi Breezer Orange tölkki',
    producer: 'Bacardi',
    price: 4.49,
    pricePerLiter: 12.83,
    bottleSize: '0.35 l',
    type: 'juomasekoitukset',
    subtype: 'Long drinkit',
    country: 'Saksa',
    alcoholPercentage: 4,
    description: 'Appelsiinin värinen, makea, hedelmäinen, appelsiininen',
  }),

  // Dessert/fortified wine
  createProduct({
    id: '001234',
    name: 'Taylor\'s 10 Year Old Tawny Port',
    producer: "Taylor's",
    price: 29.98,
    pricePerLiter: 39.97,
    bottleSize: '0.75 l',
    type: 'jälkiruokaviinit, väkevöidyt ja muut viinit',
    subtype: 'Portviinit',
    country: 'Portugali',
    region: 'Douro',
    alcoholPercentage: 20,
    description: 'Tumman meripihkan värinen, täyteläinen, makea, rusinakinen, pähkinäinen, karamellinen',
  }),

  // Wine drinks
  createProduct({
    id: '990789',
    name: 'Hugo Spritz tölkki',
    producer: 'Scavi & Ray',
    price: 3.99,
    pricePerLiter: 15.96,
    bottleSize: '0.25 l',
    type: 'viinijuomat',
    subtype: 'Viinicocktailit',
    country: 'Italia',
    alcoholPercentage: 6.5,
    description: 'Vaalean kultainen, makea, raikas, seljankukkainen, minttuinen, limettinen',
  }),

  // Organic wine (for isOrganic filter test)
  createProduct({
    id: '945678',
    name: 'Bonterra Chardonnay 2022',
    producer: 'Bonterra',
    price: 16.98,
    pricePerLiter: 22.64,
    bottleSize: '0.75 l',
    type: 'valkoviinit',
    subtype: 'Pirteä & Hedelmäinen',
    country: 'USA',
    region: 'California',
    alcoholPercentage: 13.5,
    description: 'Vaalean kultainen, kuiva, hapokas, trooppinen, sitruksinen, kevyen paahteinen',
    grapes: 'Chardonnay,',
    specialGroup: 'Luomu',
  }),

  // Product with certificates - organic Italian orange wine
  // Has ecological certificates (Luomu, Vegaaneille soveltuva tuote, Työolot, Tuotanto, Viljely)
  // but these should NOT be in foodPairings - they should be in certificates field
  createProduct({
    id: '900162',
    name: 'Cortese Orange-Utan 2024',
    producer: 'Azienda Agricola Franco Mondo',
    price: 16.99,
    pricePerLiter: 22.65,
    bottleSize: '0.75 l',
    type: 'valkoviinit',
    subtype: 'Pirteä & Hedelmäinen',
    country: 'Italia',
    region: 'Piemonte',
    alcoholPercentage: 11.5,
    description: 'Oranssinvärinen, kuiva, hapokas, katajainen, sitruunainen, hunaja, keltaomenainen, hennon tamminen',
    grapes: 'Cortese,',
    specialGroup: 'Luomu',
    // This product has certificates that should NOT appear in foodPairings
    certificates: ['Luomu', 'Vegaaneille soveltuva tuote', 'Työolot', 'Tuotanto', 'Viljely'],
    foodPairings: ['seurustelujuoma', 'kala', 'äyriäiset'],
  }),
];

/**
 * Generate dummy products to simulate real database size (~12,000 products)
 * Products are distributed alphabetically A-Z to test search across full alphabet
 */
function generateDummyProducts(count: number): Product[] {
  const products: Product[] = [];

  // Product name prefixes distributed across alphabet
  const prefixes = [
    'Abruzzo', 'Alamos', 'Alcorta', 'Antares', 'Arboleda',
    'Barbera', 'Beronia', 'Bolla', 'Bouchard', 'Brancott',
    'Campo', 'Carmel', 'Casillero', 'Cono Sur', 'Cusumano',
    'Domaine', 'Don David', 'Dopff', 'Duca', 'Durbanville',
    'El Esteco', 'Emiliana', 'Errazuriz', 'Escorihuela', 'Estampa',
    'Falernia', 'Farnese', 'Feudi', 'Finca', 'Folonari',
    'Gabbiano', 'Gato Negro', 'Georges', 'Giacondi', 'Graffigna',
    'Hacienda', 'Hardy', 'Hess', 'Hill', 'Hugel',
    'Inama', 'Indomita', 'Inniskillin', 'Ironstone', 'Isole',
    'Jaboulet', 'Jacob', 'Jadot', 'Jean-Luc', 'Jermann',
    'Kaiken', 'Kendall', 'Kim Crawford', 'Kleine', 'Kumala',
    'La Crema', 'La Vieille', 'Lafite', 'Lamberti', 'Laurent',
    'Maculan', 'Marques', 'Masciarelli', 'Masi', 'Montes',
    'Nautilus', 'Nederburg', 'Newton', 'Nobilo', 'Norton',
    'Ogier', 'Opus', 'Orvieto', 'Osborne', 'Oyster Bay',
    'Penfolds', 'Peter Lehmann', 'Planeta', 'Poggio', 'Prunotto',
    'Querciabella', 'Querceto', 'Quilceda', 'Quinta', 'Qupe',
    'Ramos Pinto', 'Ravenswood', 'Ruffino', 'Rust', 'Rutherford',
    'Saint Clair', 'Saintsbury', 'Salentein', 'San Pedro', 'Santa Rita',
    'Tabali', 'Talus', 'Tarapaca', 'Te Mata', 'Terrazas',
    'Undurraga', 'Urlar', 'Uvaggio', 'Uvas', 'Uzès',
    'Valdivieso', 'Vallformosa', 'Veramonte', 'Villa Maria', 'Viu Manent',
    'Wagner', 'Wairau', 'Wente', 'Whitehaven', 'Wolf Blass',
    'Xanadu', 'Xavier', 'Xeraco', 'Xisto', 'Xylem',
    'Yalumba', 'Yellowtail', 'Yering', 'Yokayo', 'Yquem',
    'Zaca Mesa', 'Zenato', 'Zinfandel', 'Zonin', 'Zuccardi',
  ];

  const types = [
    { type: 'punaviinit', subtype: 'Mehevä & Hilloinen', grapes: 'Merlot, Cabernet Sauvignon,' },
    { type: 'punaviinit', subtype: 'Vivahteikas & Kehittynyt', grapes: 'Nebbiolo,' },
    { type: 'punaviinit', subtype: 'Roteva & Voimakas', grapes: 'Syrah, Grenache,' },
    { type: 'valkoviinit', subtype: 'Pirteä & Hedelmäinen', grapes: 'Chardonnay,' },
    { type: 'valkoviinit', subtype: 'Pehmeä & Kepeä', grapes: 'Pinot Grigio,' },
    { type: 'valkoviinit', subtype: 'Vivahteikas & Ryhdikäs', grapes: 'Riesling,' },
    { type: 'kuohuviinit ja samppanjat', subtype: 'Samppanjat', grapes: 'Chardonnay, Pinot Noir,' },
    { type: 'kuohuviinit ja samppanjat', subtype: 'Cavat', grapes: 'Macabeo, Parellada,' },
    { type: 'roseeviinit', subtype: 'Hennon makea', grapes: 'Grenache,' },
    { type: 'oluet', subtype: 'Lager', grapes: null, beerType: 'lager' },
    { type: 'oluet', subtype: 'IPA', grapes: null, beerType: 'ipa' },
    { type: 'oluet', subtype: 'Stout & Porter', grapes: null, beerType: 'stout & porter' },
  ];

  const countries = [
    { country: 'Ranska', regions: ['Bordeaux', 'Bourgogne', 'Rhône', 'Loire', 'Alsace', 'Champagne'] },
    { country: 'Italia', regions: ['Toscana', 'Piemonte', 'Veneto', 'Sicilia', 'Puglia'] },
    { country: 'Espanja', regions: ['Rioja', 'Ribera del Duero', 'Priorat', 'Rueda', 'Galicia'] },
    { country: 'Chile', regions: ['Valle Central', 'Maipo', 'Colchagua', 'Casablanca'] },
    { country: 'Argentiina', regions: ['Mendoza', 'La Rioja', 'Salta', 'Patagonia'] },
    { country: 'Australia', regions: ['Barossa Valley', 'McLaren Vale', 'Yarra Valley', 'Margaret River'] },
    { country: 'Uusi-Seelanti', regions: ['Marlborough', 'Hawke\'s Bay', 'Central Otago'] },
    { country: 'Etelä-Afrikka', regions: ['Stellenbosch', 'Paarl', 'Constantia', 'Swartland'] },
    { country: 'Saksa', regions: ['Mosel', 'Rheingau', 'Pfalz', 'Baden'] },
    { country: 'Portugali', regions: ['Douro', 'Lisboa', 'Alentejo', 'Vinho Verde'] },
    { country: 'USA', regions: ['Napa Valley', 'Sonoma', 'Oregon', 'Washington'] },
    { country: 'Itävalta', regions: ['Wachau', 'Burgenland', 'Steiermark'] },
    { country: 'Suomi', regions: [null] },
    { country: 'Belgia', regions: [null] },
    { country: 'Japani', regions: [null] },
  ];

  const descriptions = [
    'Tummanpunainen, täyteläinen, tanniininen, marjainen, mausteinen',
    'Keskitäyteläinen, pehmeä, kirsikkainen, vaniljainen',
    'Rubiininpunainen, hedelmäinen, tasapainoinen, pitkä jälkimaku',
    'Vaaleanvihertävä, raikas, sitruksinen, mineraalinen',
    'Kultainen, pehmeä, kypsä hedelmäinen, mausteinen',
    'Oljenväri, kuiva, hapokas, omenainen, yrttinen',
    'Kullankeltainen, täyteläinen, kermainen, paahteinen',
    'Vaaleanpunainen, raikas, marjainen, kukkainen',
  ];

  // Seeded random for reproducibility
  const seededRandom = (seed: number): number => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  for (let i = 0; i < count; i++) {
    const seed = i + 1000;
    const prefixIndex = Math.floor(seededRandom(seed) * prefixes.length);
    const typeIndex = Math.floor(seededRandom(seed + 1) * types.length);
    const countryIndex = Math.floor(seededRandom(seed + 2) * countries.length);
    const descIndex = Math.floor(seededRandom(seed + 3) * descriptions.length);

    const prefix = prefixes[prefixIndex];
    const typeInfo = types[typeIndex];
    const countryInfo = countries[countryIndex];
    const regionIndex = Math.floor(seededRandom(seed + 4) * countryInfo.regions.length);
    const region = countryInfo.regions[regionIndex];

    const vintage = typeInfo.type.includes('viinit') ? 2020 + (i % 5) : null;
    const price = 5 + seededRandom(seed + 5) * 95; // 5-100 EUR
    const alcohol = typeInfo.type === 'oluet'
      ? 4 + seededRandom(seed + 6) * 8 // 4-12% for beer
      : 10 + seededRandom(seed + 6) * 6; // 10-16% for wine

    const name = vintage
      ? `${prefix} ${typeInfo.subtype?.split(' ')[0] || 'Reserve'} ${vintage}`
      : `${prefix} ${typeInfo.subtype?.split(' ')[0] || 'Classic'}`;

    products.push(createProduct({
      id: `D${String(i).padStart(5, '0')}`,
      name,
      producer: `${prefix} Winery`,
      price: Math.round(price * 100) / 100,
      pricePerLiter: Math.round((price / 0.75) * 100) / 100,
      type: typeInfo.type,
      subtype: typeInfo.subtype,
      country: countryInfo.country,
      region,
      alcoholPercentage: Math.round(alcohol * 10) / 10,
      description: descriptions[descIndex],
      grapes: typeInfo.grapes,
      beerType: typeInfo.beerType || null,
      vintage,
    }));
  }

  return products;
}

// Generate 6000 dummy products to simulate real database size
const dummyProducts = generateDummyProducts(6000);

/**
 * Combined test products: real products + dummy products
 * This simulates the actual database with ~12,000 products
 */
export const allTestProducts: Product[] = [...testProducts, ...dummyProducts];

/**
 * Get the real products only (for targeted tests)
 */
export const realProducts = testProducts;
