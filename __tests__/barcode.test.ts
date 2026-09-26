import { categoryFromKeywords, FALLBACK_CATEGORY_ID } from '@/domain/categories';
import { isPlausibleBarcode } from '@/vision/barcode';

describe('isPlausibleBarcode', () => {
  it('accepts real EAN-13 codes', () => {
    // Nutella 400g, verified against the live Open Food Facts database.
    expect(isPlausibleBarcode('3017620422003')).toBe(true);
    expect(isPlausibleBarcode('5449000000996')).toBe(true);
  });

  it('accepts EAN-8', () => {
    expect(isPlausibleBarcode('96385074')).toBe(true);
  });

  it('rejects a code whose check digit is wrong', () => {
    // A single-digit OCR slip should not cost us a network round trip.
    expect(isPlausibleBarcode('3017620422004')).toBe(false);
  });

  it('rejects anything that is not a barcode at all', () => {
    for (const value of ['', 'abcdefghijkl', '12345', '30176204220031234']) {
      expect(isPlausibleBarcode(value)).toBe(false);
    }
  });
});

describe('categoryFromKeywords', () => {
  it('maps real Open Food Facts tags', () => {
    // The exact tags the API returns for Nutella.
    expect(
      categoryFromKeywords(['en:breakfasts', 'en:spreads', 'en:sweet-spreads', 'Nutella'])
    ).toBe('condiments');
  });

  const cases: [string[], string][] = [
    [['en:yogurts', 'Greek yoghurt'], 'dairy'],
    [['en:fresh-chicken'], 'meat'],
    [['en:fresh-vegetables'], 'produce'],
    [['en:breads', 'Sourdough'], 'bakery'],
    [['en:frozen-foods'], 'frozen'],
    [['en:sodas', 'Cola'], 'beverages'],
    [['en:rice', 'Basmati'], 'pantry'],
    [['Paracetamol tablets'], 'medicine'],
    [['Shampoo'], 'cosmetics'],
    [['Laundry detergent'], 'household'],
    [['Infant formula'], 'baby'],
    [['Dog food'], 'pet'],
  ];

  it.each(cases)('maps %s to %s', (hints, expected) => {
    expect(categoryFromKeywords(hints)).toBe(expected);
  });

  it('falls back rather than guessing when nothing matches', () => {
    expect(categoryFromKeywords(['en:unclassified', 'mystery object'])).toBe(FALLBACK_CATEGORY_ID);
    expect(categoryFromKeywords([null, undefined, ''])).toBe(FALLBACK_CATEGORY_ID);
  });

  it('prefers the more specific category when hints overlap', () => {
    // "Baby milk" is dairy-shaped but belongs under baby.
    expect(categoryFromKeywords(['Baby milk formula'])).toBe('baby');
    // Ice cream is dairy-shaped but belongs in the freezer.
    expect(categoryFromKeywords(['en:ice-cream'])).toBe('frozen');
  });

  it('does not let cosmetic keywords steal dairy products', () => {
    // A bare "cream" match used to send all of these to Cosmetics.
    expect(categoryFromKeywords(['en:sour-cream'])).toBe('dairy');
    expect(categoryFromKeywords(['Double cream'])).toBe('dairy');
    expect(categoryFromKeywords(['en:cream-cheeses', 'Cream cheese'])).toBe('dairy');
    // While genuine cosmetics still land correctly.
    expect(categoryFromKeywords(['Nivea hand cream'])).toBe('cosmetics');
    expect(categoryFromKeywords(['Hair oil'])).toBe('cosmetics');
  });

  it('does not let medicine keywords steal food', () => {
    expect(categoryFromKeywords(['Chocolate syrup'])).toBe('snacks');
    expect(categoryFromKeywords(['Cough syrup'])).toBe('medicine');
  });
});
