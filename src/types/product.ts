import { Timestamp } from '@google-cloud/firestore';

/**
 * Product types available in Alko catalog
 */
export type ProductType =
  | 'punaviinit'              // Red wines
  | 'valkoviinit'             // White wines
  | 'roseeviinit'             // Rosé wines
  | 'kuohuviinit ja samppanjat' // Sparkling wines & champagne
  | 'oluet'                   // Beers
  | 'viskit'                  // Whiskies
  | 'ginit ja maustetut viinat' // Gins and flavored spirits
  | 'vodkat ja viinat'        // Vodkas and spirits
  | 'rommit'                  // Rums
  | 'konjakit'                // Cognacs
  | 'liköörit ja katkerot'    // Liqueurs and bitters
  | 'brandyt, armanjakit ja calvadosit' // Brandies
  | 'siiderit'                // Ciders
  | 'alkoholittomat'          // Non-alcoholic
  | 'juomasekoitukset'        // Mixed drinks
  | 'jälkiruokaviinit, väkevöidyt ja muut viinit' // Dessert wines
  | 'viinijuomat'             // Wine drinks
  | 'lahja- ja juomatarvikkeet' // Gift and drink accessories
  | 'hanapakkaukset';         // Bag-in-box

/**
 * Assortment types
 */
export type Assortment =
  | 'vakiovalikoima'          // Standard assortment (in stores)
  | 'tilausvalikoima'         // Order-only selection
  | 'erikoiserä'              // Special batch
  | 'kausituote'              // Seasonal product
  | 'tarvikevalikoima';       // Accessories

/**
 * Special product groups
 */
export type SpecialGroup =
  | 'Luomu'                   // Organic
  | 'Vegaaneille soveltuva tuote' // Vegan-suitable
  | 'Alkuviini'               // Natural wine
  | 'Biodynaaminen';          // Biodynamic

/**
 * Beer types (only for beer products)
 */
export type BeerType =
  | 'ipa'
  | 'lager'
  | 'ale'
  | 'stout & porter'
  | 'vehnäolut'               // Wheat beer
  | 'erikoisuus'              // Specialty
  | 'vahva lager'             // Strong lager
  | 'pils'
  | 'tumma lager';            // Dark lager

/**
 * Packaging types
 */
export type PackagingType =
  | 'lasipullo'               // Glass bottle
  | 'tölkki'                  // Can
  | 'muovipullo'              // Plastic bottle
  | 'pullo'                   // Bottle (generic)
  | 'hanapakkaus'             // Bag-in-box
  | 'kartonkitölkki'          // Carton
  | 'viinipussi'              // Wine pouch
  | 'paperipullo'             // Paper bottle
  | 'keraaminen pullo'        // Ceramic bottle
  | 'muu';                    // Other

/**
 * Raw product data from Excel file (Finnish column names)
 */
export interface AlkoExcelRow {
  Numero: string;
  Nimi: string;
  Valmistaja: string;
  Pullokoko: string;
  Hinta: number;
  Litrahinta: number;
  Uutuus: string | null;
  Hinnastojärjestyskoodi: number;
  Tyyppi: string;
  Alatyyppi: string | null;
  Erityisryhmä: string | null;
  Oluttyyppi: string | null;
  Valmistusmaa: string;
  Alue: string | null;
  Vuosikerta: number | null;
  Etikettimerkintöjä: string | null;
  Huomautus: string | null;
  Rypäleet: string | null;
  Luonnehdinta: string | null;
  Pakkaustyyppi: string | null;
  Suljentatyyppi: string | null;
  'Alkoholi-%': number;
  'Hapot g/l': number | null;
  'Sokeri g/l': number | null;
  'Kantavierrep-%': number | null;
  'Väri EBC': number | null;
  'Katkerot EBU': number | null;
  'Energia kcal/100 ml': number | null;
  Valikoima: string;
  EAN: string;
}

/**
 * Product entity stored in Firestore
 */
export interface Product {
  // Core identifiers
  id: string;                    // Numero - "906458"
  name: string;                  // Nimi - "Fair & Square Red 2024"
  producer: string;              // Valmistaja - "La Riojana"
  ean: string;                   // EAN - "7350084980013"

  // Pricing
  price: number;                 // Hinta (EUR) - 11.98
  pricePerLiter: number;         // Litrahinta - 11.98

  // Volume & Packaging
  bottleSize: string;            // Pullokoko - "1 l", "0.75 l"
  packagingType: string | null;  // Pakkaustyyppi - "lasipullo", "tölkki"
  closureType: string | null;    // Suljentatyyppi - "korkki", "kierrekorkki"

  // Classification
  type: string;                  // Tyyppi - "punaviinit", "oluet"
  subtype: string | null;        // Alatyyppi - "Mehevä & Hilloinen"
  specialGroup: string | null;   // Erityisryhmä - "Luomu", "Vegaaneille soveltuva"
  beerType: string | null;       // Oluttyyppi - "ipa", "lager" (only for beers)
  sortCode: number;              // Hinnastojärjestyskoodi - 110

  // Origin
  country: string;               // Valmistusmaa - "Ranska"
  region: string | null;         // Alue - "Bordeaux"

  // Wine-specific
  vintage: number | null;        // Vuosikerta - 2024
  grapes: string | null;         // Rypäleet - "Syrah, Merlot"
  labelNotes: string | null;     // Etikettimerkintöjä - "Famatina Valley"

  // Taste & Description
  description: string | null;    // Luonnehdinta - full taste description
  notes: string | null;          // Huomautus - additional notes

  // Enriched data (scraped from product page)
  tasteProfile: string | null;   // Maku - detailed taste description
  usageTips: string | null;      // Käyttövinkit - usage/pairing tips
  servingSuggestion: string | null; // Tarjoilu - serving temperature/suggestions
  foodPairings: string[] | null; // Food pairing symbols (e.g., "seurustelujuoma", "tulinen ruoka")
  certificates: string[] | null; // Certification labels (e.g., "Luomu", "Vegaaneille soveltuva tuote", "Työolot")
  ingredients: string | null;    // Tuottajan ilmoittamat ainesosat - producer declared ingredients

  // Whiskey-specific enriched data
  smokiness: number | null;      // Smokiness level 0-4 (0=ei savuinen, 4=voimakkaan savuinen)
  smokinessLabel: string | null; // Smokiness description (ei savuinen, hennon savuinen, savuinen, voimakkaan savuinen)

  // Technical specs
  alcoholPercentage: number;     // Alkoholi-% - 13.0
  acids: number | null;          // Hapot g/l - 5.2
  sugar: number | null;          // Sokeri g/l - 4.0
  energy: number | null;         // Energia kcal/100 ml - 80.0

  // Beer-specific specs
  originalGravity: number | null; // Kantavierrep-% - for beers
  colorEBC: number | null;        // Väri EBC - for beers
  bitternessEBU: number | null;   // Katkerot EBU - for beers

  // Assortment & Status
  assortment: string;            // Valikoima - "vakiovalikoima", "tilausvalikoima"
  isNew: boolean;                // Uutuus - true/false

  // Metadata
  updatedAt: Timestamp;
  createdAt: Timestamp;
}

/**
 * Smokiness levels for whiskey
 */
export type SmokinessLevel = 0 | 1 | 2 | 3 | 4;

/**
 * Product search filters
 */
export interface ProductSearchFilters {
  query?: string;
  type?: string;
  country?: string;
  region?: string;
  minPrice?: number;
  maxPrice?: number;
  minAlcohol?: number;
  maxAlcohol?: number;
  assortment?: string;
  specialGroup?: string;
  beerType?: string;
  isNew?: boolean;
  isOrganic?: boolean;
  isVegan?: boolean;
  minSmokiness?: SmokinessLevel;
  maxSmokiness?: SmokinessLevel;
}

/**
 * Product search options
 */
export interface ProductSearchOptions {
  sortBy?: 'price' | 'name' | 'alcohol' | 'pricePerLiter';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

/**
 * Product search result
 */
export interface ProductSearchResult {
  products: Product[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
