import { describe, it, expect } from 'vitest';
import { findFoodSymbol, FOOD_SYMBOLS } from '../../src/types/food-symbols.js';

describe('Food Symbols', () => {
  describe('FOOD_SYMBOLS constant', () => {
    it('should have 33 food symbols', () => {
      expect(FOOD_SYMBOLS).toHaveLength(33);
    });

    it('should have valid structure for each symbol', () => {
      for (const symbol of FOOD_SYMBOLS) {
        expect(symbol.name).toBeTruthy();
        expect(symbol.symbolId).toMatch(/^foodSymbol_/);
        expect(symbol.englishNames).toBeInstanceOf(Array);
        expect(symbol.englishNames.length).toBeGreaterThan(0);
      }
    });
  });

  describe('findFoodSymbol', () => {
    describe('Finnish name matching', () => {
      it('should find exact Finnish match', () => {
        const result = findFoodSymbol('Äyriäiset');
        expect(result).not.toBeNull();
        expect(result!.name).toBe('Äyriäiset');
        expect(result!.symbolId).toBe('foodSymbol_Ayriaiset');
      });

      it('should find case-insensitive Finnish match', () => {
        const result = findFoodSymbol('äyriäiset');
        expect(result).not.toBeNull();
        expect(result!.name).toBe('Äyriäiset');
      });

      it('should find partial Finnish match', () => {
        const result = findFoodSymbol('kana');
        expect(result).not.toBeNull();
        expect(result!.name).toBe('Kana, kalkkuna');
      });

      it('should find compound Finnish name', () => {
        const result = findFoodSymbol('pasta ja pizza');
        expect(result).not.toBeNull();
        expect(result!.name).toBe('Pasta ja pizza');
      });
    });

    describe('English name matching', () => {
      it('should find by English name - seafood', () => {
        const result = findFoodSymbol('seafood');
        expect(result).not.toBeNull();
        expect(result!.name).toBe('Äyriäiset');
      });

      it('should find by English name - chicken', () => {
        const result = findFoodSymbol('chicken');
        expect(result).not.toBeNull();
        expect(result!.name).toBe('Kana, kalkkuna');
      });

      it('should find by English name - steak', () => {
        const result = findFoodSymbol('steak');
        expect(result).not.toBeNull();
        expect(result!.name).toBe('Nauta');
      });

      it('should find by English name - salmon', () => {
        const result = findFoodSymbol('salmon');
        expect(result).not.toBeNull();
        expect(result!.name).toBe('Rasvainen kala');
      });

      it('should find by English name - sushi', () => {
        const result = findFoodSymbol('sushi');
        expect(result).not.toBeNull();
        expect(result!.name).toBe('Sushi');
      });

      it('should find by English name - dessert', () => {
        const result = findFoodSymbol('dessert');
        expect(result).not.toBeNull();
        expect(result!.name).toBe('Makea jälkiruoka');
      });

      it('should find by English name - vegetarian', () => {
        const result = findFoodSymbol('vegetarian');
        expect(result).not.toBeNull();
        expect(result!.name).toBe('Salaatit, kasvisruoka');
      });

      it('should find by English name - curry', () => {
        // "spicy" matches "spicy sausage", "hot" matches "hot dog"
        // Use "curry" or "chili" for Tulinen ruoka
        const result = findFoodSymbol('curry');
        expect(result).not.toBeNull();
        expect(result!.name).toBe('Tulinen ruoka');
      });

      it('should find by English name - grilled', () => {
        const result = findFoodSymbol('grilled');
        expect(result).not.toBeNull();
        expect(result!.name).toBe('Grilliruoka');
      });

      it('should find by English name - asian', () => {
        const result = findFoodSymbol('asian');
        expect(result).not.toBeNull();
        expect(result!.name).toBe('Itämainen ruoka');
      });

      it('should find by English name - pizza', () => {
        const result = findFoodSymbol('pizza');
        expect(result).not.toBeNull();
        expect(result!.name).toBe('Pasta ja pizza');
      });

      it('should find by English name - blue cheese', () => {
        const result = findFoodSymbol('blue cheese');
        expect(result).not.toBeNull();
        expect(result!.name).toBe('Voimakkaat juustot');
      });

      it('should find by English name - oysters', () => {
        const result = findFoodSymbol('oysters');
        expect(result).not.toBeNull();
        expect(result!.name).toBe('Simpukat ja osterit');
      });
    });

    describe('No match cases', () => {
      it('should return null for unknown food', () => {
        const result = findFoodSymbol('banana bread');
        expect(result).toBeNull();
      });

      it('should return null for empty string', () => {
        const result = findFoodSymbol('');
        expect(result).toBeNull();
      });

      it('should return null for completely unrelated text', () => {
        const result = findFoodSymbol('car engine');
        expect(result).toBeNull();
      });
    });
  });
});
