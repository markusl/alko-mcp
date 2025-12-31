/**
 * Alko food pairing symbols
 * These map to foodSymbolId query parameters in Alko's search API
 */

/**
 * Food symbol definition
 */
export interface FoodSymbol {
  /** Display name in Finnish */
  name: string;
  /** Internal ID used in Alko search API (e.g., "foodSymbol_Ayriaiset") */
  symbolId: string;
  /** English translation for matching user queries */
  englishNames: string[];
}

/**
 * All available food symbols from Alko.fi
 * Format: foodSymbolId is derived from Finnish name with special chars normalized
 */
export const FOOD_SYMBOLS: FoodSymbol[] = [
  { name: 'Aperitiivi', symbolId: 'foodSymbol_Aperitiivi', englishNames: ['aperitif', 'appetizer'] },
  { name: 'Blinit', symbolId: 'foodSymbol_Blinit', englishNames: ['blini', 'blinis', 'pancake'] },
  { name: 'Grilliruoka', symbolId: 'foodSymbol_Grilliruoka', englishNames: ['grill', 'grilled', 'bbq', 'barbecue'] },
  { name: 'Itämainen ruoka', symbolId: 'foodSymbol_Itamainenruoka', englishNames: ['asian', 'oriental', 'chinese', 'thai', 'vietnamese', 'indian'] },
  { name: 'Kana, kalkkuna', symbolId: 'foodSymbol_Kanakalkkuna', englishNames: ['chicken', 'turkey', 'poultry'] },
  { name: 'Keitot', symbolId: 'foodSymbol_Keitot', englishNames: ['soup', 'soups', 'stew'] },
  { name: 'Lammas', symbolId: 'foodSymbol_Lammas', englishNames: ['lamb', 'mutton'] },
  { name: 'Makea jälkiruoka', symbolId: 'foodSymbol_Makeajalkiruoka', englishNames: ['dessert', 'sweet', 'cake', 'pastry', 'chocolate'] },
  { name: 'Maksa', symbolId: 'foodSymbol_Maksa', englishNames: ['liver', 'pate', 'foie gras'] },
  { name: 'Marjat ja hedelmät', symbolId: 'foodSymbol_Marjatjahedelmät', englishNames: ['berries', 'fruits', 'fruit'] },
  { name: 'Mausteiset ja lihaisat makkarat', symbolId: 'foodSymbol_Mausteisetjalihaisatmakkarat', englishNames: ['spicy sausage', 'chorizo', 'salami'] },
  { name: 'Miedot juustot', symbolId: 'foodSymbol_Miedotjuustot', englishNames: ['mild cheese', 'soft cheese', 'brie', 'camembert', 'mozzarella'] },
  { name: 'Miedot makkarat', symbolId: 'foodSymbol_Miedotmakkarat', englishNames: ['mild sausage', 'frankfurter', 'hot dog'] },
  { name: 'Nauta', symbolId: 'foodSymbol_Nauta', englishNames: ['beef', 'steak', 'cattle'] },
  { name: 'Nautiskelujuoma', symbolId: 'foodSymbol_Nautiskelujuoma', englishNames: ['sipping', 'digestif', 'nightcap'] },
  { name: 'Noutopöytä', symbolId: 'foodSymbol_Noutopöytä', englishNames: ['buffet', 'smorgasbord'] },
  { name: 'Pasta ja pizza', symbolId: 'foodSymbol_Pastajapizza', englishNames: ['pasta', 'pizza', 'italian'] },
  { name: 'Pataruoka', symbolId: 'foodSymbol_Pataruoka', englishNames: ['casserole', 'pot roast'] },
  { name: 'Pikkusuolaiset', symbolId: 'foodSymbol_Pikkusuolaiset', englishNames: ['snacks', 'appetizers', 'tapas', 'finger food'] },
  { name: 'Porsas', symbolId: 'foodSymbol_Porsas', englishNames: ['pork', 'pig', 'ham', 'bacon'] },
  { name: 'Rasvainen kala', symbolId: 'foodSymbol_Rasvainenkala', englishNames: ['oily fish', 'fatty fish', 'salmon', 'mackerel', 'tuna', 'sardine'] },
  { name: 'Riista', symbolId: 'foodSymbol_Riista', englishNames: ['game', 'venison', 'wild boar', 'elk', 'moose', 'reindeer'] },
  { name: 'Riistalinnut', symbolId: 'foodSymbol_Riistalinnut', englishNames: ['game birds', 'pheasant', 'duck', 'goose', 'quail'] },
  { name: 'Salaatit, kasvisruoka', symbolId: 'foodSymbol_Salaatitkasvisruoka', englishNames: ['salad', 'vegetarian', 'vegan', 'vegetables'] },
  { name: 'Seurustelujuoma', symbolId: 'foodSymbol_Seurustelujuoma', englishNames: ['social', 'party', 'casual'] },
  { name: 'Sienet', symbolId: 'foodSymbol_Sienet', englishNames: ['mushroom', 'mushrooms', 'truffle'] },
  { name: 'Simpukat ja osterit', symbolId: 'foodSymbol_Simpukatjaosterit', englishNames: ['mussels', 'oysters', 'clams', 'shellfish'] },
  { name: 'Sushi', symbolId: 'foodSymbol_Sushi', englishNames: ['sushi', 'sashimi', 'japanese'] },
  { name: 'Tapas ja antipasti', symbolId: 'foodSymbol_Tapasjaantipasti', englishNames: ['tapas', 'antipasti', 'mezze', 'small plates'] },
  { name: 'Tulinen ruoka', symbolId: 'foodSymbol_Tulinenruoka', englishNames: ['spicy', 'hot', 'chili', 'curry'] },
  { name: 'Vähärasvainen kala', symbolId: 'foodSymbol_Vaharasvainenkala', englishNames: ['white fish', 'lean fish', 'cod', 'halibut', 'sea bass', 'pike'] },
  { name: 'Voimakkaat juustot', symbolId: 'foodSymbol_Voimakkaatjuustot', englishNames: ['strong cheese', 'blue cheese', 'aged cheese', 'parmesan', 'gorgonzola', 'roquefort'] },
  { name: 'Äyriäiset', symbolId: 'foodSymbol_Ayriaiset', englishNames: ['seafood', 'shrimp', 'prawn', 'lobster', 'crab', 'crayfish'] },
];

/**
 * Find a food symbol matching the user's query
 * Matches against Finnish names and English translations
 */
export function findFoodSymbol(query: string): FoodSymbol | null {
  const queryLower = query.toLowerCase().trim();

  // Empty query returns null
  if (!queryLower) return null;

  // First try exact Finnish match
  const exactFinnish = FOOD_SYMBOLS.find(
    s => s.name.toLowerCase() === queryLower
  );
  if (exactFinnish) return exactFinnish;

  // Try partial Finnish match
  const partialFinnish = FOOD_SYMBOLS.find(
    s => s.name.toLowerCase().includes(queryLower) || queryLower.includes(s.name.toLowerCase())
  );
  if (partialFinnish) return partialFinnish;

  // Try English matches
  for (const symbol of FOOD_SYMBOLS) {
    for (const eng of symbol.englishNames) {
      if (queryLower.includes(eng) || eng.includes(queryLower)) {
        return symbol;
      }
    }
  }

  return null;
}
