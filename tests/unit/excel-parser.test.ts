import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseAlkoExcel, validateProducts } from '../../src/utils/excel-parser.js';

describe('Excel Parser', () => {
  // Create a mock Excel workbook for testing
  function createMockWorkbook(rows: unknown[][]): ArrayBuffer {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Alkon Hinnasto Tekstitiedostona');
    return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  }

  describe('parseAlkoExcel', () => {
    it('should parse valid Excel data', () => {
      const rows = [
        ['Alkon hinnasto 29.12.2025'],
        ['Huom.! Hinnastojärjestyskoodilla...'],
        [],
        ['Numero', 'Nimi', 'Valmistaja', 'Pullokoko', 'Hinta', 'Litrahinta', 'Uutuus', 'Hinnastojärjestyskoodi', 'Tyyppi', 'Alatyyppi', 'Erityisryhmä', 'Oluttyyppi', 'Valmistusmaa', 'Alue', 'Vuosikerta', 'Etikettimerkintöjä', 'Huomautus', 'Rypäleet', 'Luonnehdinta', 'Pakkaustyyppi', 'Suljentatyyppi', 'Alkoholi-%', 'Hapot g/l', 'Sokeri g/l', 'Kantavierrep-%', 'Väri EBC', 'Katkerot EBU', 'Energia kcal/100 ml', 'Valikoima', 'EAN'],
        ['906458', 'Fair & Square Red 2024', 'La Riojana', '1 l', 11.98, 11.98, null, 110, 'punaviinit', 'Mehevä & Hilloinen', null, null, 'Argentiina', 'La Rioja', 2024, 'Famatina Valley', 'Vegaaneille soveltuva tuote', 'Syrah', 'Sinipunainen, täyteläinen...', 'kartonkitölkki', 'muovisuljin', 13.0, 5.2, 4.0, null, null, null, 80.0, 'vakiovalikoima', '7350084980013'],
        ['123456', 'Test Beer IPA', 'Test Brewery', '0.33 l', 4.99, 15.12, 'Uutuus', 200, 'oluet', null, null, 'ipa', 'Suomi', null, null, null, null, null, 'Kultainen, humalainen...', 'tölkki', 'avattava', 5.5, null, null, 12.0, 20, 45, 45.0, 'vakiovalikoima', '6417700000001'],
      ];

      const buffer = createMockWorkbook(rows);
      const products = parseAlkoExcel(buffer);

      expect(products).toHaveLength(2);

      // Check first product (wine)
      expect(products[0].id).toBe('906458');
      expect(products[0].name).toBe('Fair & Square Red 2024');
      expect(products[0].producer).toBe('La Riojana');
      expect(products[0].price).toBe(11.98);
      expect(products[0].alcoholPercentage).toBe(13.0);
      expect(products[0].type).toBe('punaviinit');
      expect(products[0].country).toBe('Argentiina');
      expect(products[0].vintage).toBe(2024);
      expect(products[0].isNew).toBe(false);

      // Check second product (beer)
      expect(products[1].id).toBe('123456');
      expect(products[1].name).toBe('Test Beer IPA');
      expect(products[1].beerType).toBe('ipa');
      expect(products[1].originalGravity).toBe(12.0);
      expect(products[1].bitternessEBU).toBe(45);
      expect(products[1].isNew).toBe(true);
    });

    it('should skip empty rows', () => {
      const rows = [
        ['Alkon hinnasto'],
        [],
        [],
        ['Numero', 'Nimi', 'Valmistaja', 'Pullokoko', 'Hinta', 'Litrahinta', 'Uutuus', 'Hinnastojärjestyskoodi', 'Tyyppi', 'Alatyyppi', 'Erityisryhmä', 'Oluttyyppi', 'Valmistusmaa', 'Alue', 'Vuosikerta', 'Etikettimerkintöjä', 'Huomautus', 'Rypäleet', 'Luonnehdinta', 'Pakkaustyyppi', 'Suljentatyyppi', 'Alkoholi-%', 'Hapot g/l', 'Sokeri g/l', 'Kantavierrep-%', 'Väri EBC', 'Katkerot EBU', 'Energia kcal/100 ml', 'Valikoima', 'EAN'],
        ['123', 'Product 1', 'Producer', '0.75 l', 10, 13.33, null, 100, 'punaviinit', null, null, null, 'Ranska', null, null, null, null, null, null, 'lasipullo', null, 12.0, null, null, null, null, null, null, 'vakiovalikoima', '123'],
        [], // Empty row
        [null, null, null], // Row with nulls
        ['456', 'Product 2', 'Producer 2', '0.5 l', 8, 16, null, 100, 'valkoviinit', null, null, null, 'Italia', null, null, null, null, null, null, 'lasipullo', null, 11.0, null, null, null, null, null, null, 'vakiovalikoima', '456'],
      ];

      const buffer = createMockWorkbook(rows);
      const products = parseAlkoExcel(buffer);

      expect(products).toHaveLength(2);
    });

    it('should throw error if header row not found', () => {
      const rows = [
        ['Invalid', 'Header', 'Row'],
        ['Data', 'Without', 'Numero'],
      ];

      const buffer = createMockWorkbook(rows);
      expect(() => parseAlkoExcel(buffer)).toThrow('Could not find header row with "Numero" column');
    });
  });

  describe('validateProducts', () => {
    it('should validate products correctly', () => {
      const products = [
        {
          id: '123',
          name: 'Valid Product',
          producer: 'Producer',
          ean: '123456',
          price: 10.99,
          pricePerLiter: 14.65,
          bottleSize: '0.75 l',
          packagingType: 'lasipullo',
          closureType: 'korkki',
          type: 'punaviinit',
          subtype: null,
          specialGroup: null,
          beerType: null,
          sortCode: 100,
          country: 'Ranska',
          region: null,
          vintage: null,
          grapes: null,
          labelNotes: null,
          description: null,
          notes: null,
          alcoholPercentage: 12.5,
          acids: null,
          sugar: null,
          energy: null,
          originalGravity: null,
          colorEBC: null,
          bitternessEBU: null,
          assortment: 'vakiovalikoima',
          isNew: false,
          updatedAt: { toDate: () => new Date() } as never,
          createdAt: { toDate: () => new Date() } as never,
        },
        {
          id: '',
          name: 'Invalid - No ID',
          producer: 'Producer',
          ean: '',
          price: 10,
          pricePerLiter: 10,
          bottleSize: '1 l',
          packagingType: null,
          closureType: null,
          type: 'oluet',
          subtype: null,
          specialGroup: null,
          beerType: null,
          sortCode: 100,
          country: 'Suomi',
          region: null,
          vintage: null,
          grapes: null,
          labelNotes: null,
          description: null,
          notes: null,
          alcoholPercentage: 5,
          acids: null,
          sugar: null,
          energy: null,
          originalGravity: null,
          colorEBC: null,
          bitternessEBU: null,
          assortment: 'vakiovalikoima',
          isNew: false,
          updatedAt: { toDate: () => new Date() } as never,
          createdAt: { toDate: () => new Date() } as never,
        },
      ];

      const { valid, invalid } = validateProducts(products);

      expect(valid).toHaveLength(1);
      expect(valid[0].id).toBe('123');
      expect(invalid).toHaveLength(1);
      expect(invalid[0].errors).toContain('Missing product ID');
    });

    it('should detect invalid alcohol percentage', () => {
      const products = [
        {
          id: '123',
          name: 'Invalid Alcohol',
          producer: 'Producer',
          ean: '123',
          price: 10,
          pricePerLiter: 10,
          bottleSize: '1 l',
          packagingType: null,
          closureType: null,
          type: 'viinit',
          subtype: null,
          specialGroup: null,
          beerType: null,
          sortCode: 100,
          country: 'Suomi',
          region: null,
          vintage: null,
          grapes: null,
          labelNotes: null,
          description: null,
          notes: null,
          alcoholPercentage: 150, // Invalid
          acids: null,
          sugar: null,
          energy: null,
          originalGravity: null,
          colorEBC: null,
          bitternessEBU: null,
          assortment: 'vakiovalikoima',
          isNew: false,
          updatedAt: { toDate: () => new Date() } as never,
          createdAt: { toDate: () => new Date() } as never,
        },
      ];

      const { valid, invalid } = validateProducts(products);

      expect(valid).toHaveLength(0);
      expect(invalid).toHaveLength(1);
      expect(invalid[0].errors.some((e) => e.includes('Invalid alcohol percentage'))).toBe(true);
    });
  });
});
