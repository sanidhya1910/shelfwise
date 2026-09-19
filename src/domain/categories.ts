import type { ComponentProps } from 'react';
import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export interface Category {
  id: string;
  name: string;
  icon: IconName;
  /** Accent used for the category chip and the dashboard tile. */
  color: string;
  /** Used to pre-fill an expiry date when only the product is known. */
  defaultShelfLifeDays: number;
  isBuiltIn: boolean;
}

/**
 * Shelf lives are unopened-at-room-or-fridge rules of thumb. They only ever
 * pre-fill the date field — the user always confirms before saving.
 */
export const BUILT_IN_CATEGORIES: Category[] = [
  { id: 'dairy', name: 'Dairy', icon: 'cheese', color: '#F2C14E', defaultShelfLifeDays: 10, isBuiltIn: true },
  { id: 'meat', name: 'Meat & Fish', icon: 'fish', color: '#E2725B', defaultShelfLifeDays: 3, isBuiltIn: true },
  { id: 'produce', name: 'Produce', icon: 'food-apple', color: '#6BB86B', defaultShelfLifeDays: 7, isBuiltIn: true },
  { id: 'bakery', name: 'Bakery', icon: 'bread-slice', color: '#C9954B', defaultShelfLifeDays: 5, isBuiltIn: true },
  { id: 'frozen', name: 'Frozen', icon: 'snowflake', color: '#5AA9DE', defaultShelfLifeDays: 180, isBuiltIn: true },
  { id: 'pantry', name: 'Pantry', icon: 'sack', color: '#B08D57', defaultShelfLifeDays: 365, isBuiltIn: true },
  { id: 'beverages', name: 'Beverages', icon: 'bottle-soda-classic', color: '#7E9FD6', defaultShelfLifeDays: 180, isBuiltIn: true },
  { id: 'condiments', name: 'Condiments', icon: 'bottle-tonic', color: '#D08A3E', defaultShelfLifeDays: 270, isBuiltIn: true },
  { id: 'snacks', name: 'Snacks', icon: 'cookie', color: '#D98E5F', defaultShelfLifeDays: 90, isBuiltIn: true },
  { id: 'medicine', name: 'Medicine', icon: 'pill', color: '#D46A8C', defaultShelfLifeDays: 730, isBuiltIn: true },
  { id: 'cosmetics', name: 'Cosmetics', icon: 'lipstick', color: '#B984C4', defaultShelfLifeDays: 365, isBuiltIn: true },
  { id: 'household', name: 'Household', icon: 'spray-bottle', color: '#6FB5AE', defaultShelfLifeDays: 730, isBuiltIn: true },
  { id: 'baby', name: 'Baby', icon: 'baby-bottle-outline', color: '#F0A6A6', defaultShelfLifeDays: 180, isBuiltIn: true },
  { id: 'pet', name: 'Pet', icon: 'paw', color: '#A8916F', defaultShelfLifeDays: 180, isBuiltIn: true },
  { id: 'other', name: 'Other', icon: 'dots-horizontal-circle-outline', color: '#9A9086', defaultShelfLifeDays: 30, isBuiltIn: true },
];

export const FALLBACK_CATEGORY_ID = 'other';

export function findCategory(categories: Category[], id: string | null | undefined): Category {
  return (
    categories.find((c) => c.id === id) ??
    categories.find((c) => c.id === FALLBACK_CATEGORY_ID) ??
    BUILT_IN_CATEGORIES[BUILT_IN_CATEGORIES.length - 1]
  );
}

/**
 * Maps free-text category hints (Open Food Facts tags, AI guesses) onto our ids.
 * First match wins, so the list is ordered most-specific first.
 */
const KEYWORD_MAP: [string[], string][] = [
  [['baby', 'infant', 'formula'], 'baby'],
  [['pet', 'dog', 'cat-food', 'cat food'], 'pet'],
  [
    // "syrup" alone would swallow chocolate syrup, so it has to be qualified.
    ['medicine', 'medication', 'pharma', 'drug', 'tablet', 'capsule', 'cough syrup', 'supplement', 'vitamin', 'antibiotic', 'ointment'],
    'medicine',
  ],
  // Frozen runs before dairy and cosmetics so ice cream lands in the freezer
  // rather than being caught by a "cream" match.
  [['frozen', 'ice-cream', 'ice cream'], 'frozen'],
  [
    // Never match a bare "cream": that is sour cream, double cream and cream
    // cheese, all of which are dairy.
    ['cosmetic', 'skincare', 'skin care', 'makeup', 'shampoo', 'lotion', 'face cream', 'hand cream', 'body cream', 'shaving cream', 'hair oil', 'perfume', 'deodorant', 'toothpaste'],
    'cosmetics',
  ],
  [['cleaning', 'detergent', 'household', 'bleach', 'disinfectant', 'soap'], 'household'],
  [['dairy', 'milk', 'cheese', 'yogurt', 'yoghurt', 'butter', 'cream', 'paneer', 'curd'], 'dairy'],
  [['meat', 'fish', 'seafood', 'poultry', 'chicken', 'beef', 'pork', 'mutton', 'egg'], 'meat'],
  [['fruit', 'vegetable', 'produce', 'salad', 'herb', 'fresh-vegetable'], 'produce'],
  [['bread', 'bakery', 'pastr', 'cake', 'bun', 'biscuit-bread'], 'bakery'],
  [['beverage', 'drink', 'juice', 'soda', 'water', 'coffee', 'tea', 'beer', 'wine'], 'beverages'],
  [['sauce', 'condiment', 'ketchup', 'mayonnaise', 'mustard', 'vinegar', 'oil', 'spread', 'jam', 'pickle'], 'condiments'],
  [['snack', 'chip', 'crisp', 'chocolate', 'candy', 'sweet', 'cookie', 'biscuit', 'confection'], 'snacks'],
  [['pantry', 'cereal', 'grain', 'rice', 'pasta', 'flour', 'sugar', 'salt', 'spice', 'canned', 'legume', 'pulse', 'dal', 'lentil'], 'pantry'],
];

export function categoryFromKeywords(hints: (string | null | undefined)[]): string {
  const haystack = hints.filter(Boolean).join(' ').toLowerCase().replace(/_/g, '-');
  for (const [needles, id] of KEYWORD_MAP) {
    if (needles.some((n) => haystack.includes(n))) return id;
  }
  return FALLBACK_CATEGORY_ID;
}
