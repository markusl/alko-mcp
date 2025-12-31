import * as XLSX from 'xlsx';
import { Timestamp } from '@google-cloud/firestore';
import type { Product, AlkoExcelRow } from '../types/index.js';
import { logger } from './logger.js';

/**
 * Column mapping from Excel column index to field name
 * Based on verified structure from actual Alko price list
 *
 * Index positions for reference:
 * 0: Numero, 1: Nimi, 2: Valmistaja, 3: Pullokoko, 4: Hinta,
 * 5: Litrahinta, 6: Uutuus, 7: Hinnastojärjestyskoodi, 8: Tyyppi,
 * 9: Alatyyppi, 10: Erityisryhmä, 11: Oluttyyppi, 12: Valmistusmaa,
 * 13: Alue, 14: Vuosikerta, 15: Etikettimerkintöjä, 16: Huomautus,
 * 17: Rypäleet, 18: Luonnehdinta, 19: Pakkaustyyppi, 20: Suljentatyyppi,
 * 21: Alkoholi-%, 22: Hapot g/l, 23: Sokeri g/l, 24: Kantavierrep-%,
 * 25: Väri EBC, 26: Katkerot EBU, 27: Energia kcal/100 ml,
 * 28: Valikoima, 29: EAN
 */

/**
 * Parse a number from Excel cell value
 */
function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
  return isNaN(num) ? null : num;
}

/**
 * Parse a string from Excel cell value
 */
function parseString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return String(value).trim();
}

/**
 * Convert an Excel row to AlkoExcelRow
 */
function rowToAlkoExcelRow(row: unknown[]): AlkoExcelRow | null {
  const numero = parseString(row[0]);
  if (!numero) {
    return null;
  }

  return {
    Numero: numero,
    Nimi: parseString(row[1]) || '',
    Valmistaja: parseString(row[2]) || '',
    Pullokoko: parseString(row[3]) || '',
    Hinta: parseNumber(row[4]) || 0,
    Litrahinta: parseNumber(row[5]) || 0,
    Uutuus: parseString(row[6]),
    Hinnastojärjestyskoodi: parseNumber(row[7]) || 0,
    Tyyppi: parseString(row[8]) || '',
    Alatyyppi: parseString(row[9]),
    Erityisryhmä: parseString(row[10]),
    Oluttyyppi: parseString(row[11]),
    Valmistusmaa: parseString(row[12]) || '',
    Alue: parseString(row[13]),
    Vuosikerta: parseNumber(row[14]),
    Etikettimerkintöjä: parseString(row[15]),
    Huomautus: parseString(row[16]),
    Rypäleet: parseString(row[17]),
    Luonnehdinta: parseString(row[18]),
    Pakkaustyyppi: parseString(row[19]),
    Suljentatyyppi: parseString(row[20]),
    'Alkoholi-%': parseNumber(row[21]) || 0,
    'Hapot g/l': parseNumber(row[22]),
    'Sokeri g/l': parseNumber(row[23]),
    'Kantavierrep-%': parseNumber(row[24]),
    'Väri EBC': parseNumber(row[25]),
    'Katkerot EBU': parseNumber(row[26]),
    'Energia kcal/100 ml': parseNumber(row[27]),
    Valikoima: parseString(row[28]) || '',
    EAN: parseString(row[29]) || '',
  };
}

/**
 * Convert AlkoExcelRow to Product entity
 */
function excelRowToProduct(row: AlkoExcelRow): Product {
  const now = Timestamp.now();

  return {
    id: row.Numero,
    name: row.Nimi,
    producer: row.Valmistaja,
    ean: row.EAN,
    price: row.Hinta,
    pricePerLiter: row.Litrahinta,
    bottleSize: row.Pullokoko,
    packagingType: row.Pakkaustyyppi,
    closureType: row.Suljentatyyppi,
    type: row.Tyyppi,
    subtype: row.Alatyyppi,
    specialGroup: row.Erityisryhmä,
    beerType: row.Oluttyyppi,
    sortCode: row.Hinnastojärjestyskoodi,
    country: row.Valmistusmaa,
    region: row.Alue,
    vintage: row.Vuosikerta,
    grapes: row.Rypäleet,
    labelNotes: row.Etikettimerkintöjä,
    description: row.Luonnehdinta,
    notes: row.Huomautus,
    // Enriched data (not in Excel, scraped from product page)
    tasteProfile: null,
    usageTips: null,
    servingSuggestion: null,
    foodPairings: null,
    certificates: null,
    ingredients: null,
    smokiness: null,
    smokinessLabel: null,
    alcoholPercentage: row['Alkoholi-%'],
    acids: row['Hapot g/l'],
    sugar: row['Sokeri g/l'],
    energy: row['Energia kcal/100 ml'],
    originalGravity: row['Kantavierrep-%'],
    colorEBC: row['Väri EBC'],
    bitternessEBU: row['Katkerot EBU'],
    assortment: row.Valikoima,
    isNew: row.Uutuus !== null && row.Uutuus !== '',
    updatedAt: now,
    createdAt: now,
  };
}

/**
 * Parse Alko Excel file and return Product entities
 */
export function parseAlkoExcel(buffer: ArrayBuffer): Product[] {
  const workbook = XLSX.read(buffer, { type: 'array' });

  // Get the first sheet
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('No sheets found in Excel file');
  }

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found`);
  }

  // Convert to array of arrays
  const data: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // Find the header row (contains "Numero")
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(10, data.length); i++) {
    const row = data[i];
    if (row && row[0] === 'Numero') {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    throw new Error('Could not find header row with "Numero" column');
  }

  logger.info(`Found header row at index ${headerRowIndex}`);

  // Parse data rows (skip header)
  const products: Product[] = [];
  let skipped = 0;

  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) {
      continue;
    }

    const excelRow = rowToAlkoExcelRow(row);
    if (!excelRow) {
      skipped++;
      continue;
    }

    products.push(excelRowToProduct(excelRow));
  }

  logger.info(`Parsed ${products.length} products, skipped ${skipped} invalid rows`);

  return products;
}

/**
 * Validate parsed products
 */
export function validateProducts(products: Product[]): {
  valid: Product[];
  invalid: { product: Product; errors: string[] }[];
} {
  const valid: Product[] = [];
  const invalid: { product: Product; errors: string[] }[] = [];

  for (const product of products) {
    const errors: string[] = [];

    if (!product.id) {
      errors.push('Missing product ID');
    }
    if (!product.name) {
      errors.push('Missing product name');
    }
    if (product.price < 0) {
      errors.push(`Invalid price: ${product.price}`);
    }
    if (product.alcoholPercentage < 0 || product.alcoholPercentage > 100) {
      errors.push(`Invalid alcohol percentage: ${product.alcoholPercentage}`);
    }

    if (errors.length === 0) {
      valid.push(product);
    } else {
      invalid.push({ product, errors });
    }
  }

  return { valid, invalid };
}
