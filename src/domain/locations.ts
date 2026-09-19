import type { IconName } from './categories';
import type { StorageLocation } from './item';

export interface LocationMeta {
  id: StorageLocation;
  name: string;
  icon: IconName;
}

export const LOCATIONS: LocationMeta[] = [
  { id: 'fridge', name: 'Fridge', icon: 'fridge-outline' },
  { id: 'freezer', name: 'Freezer', icon: 'snowflake' },
  { id: 'pantry', name: 'Pantry', icon: 'cupboard-outline' },
  { id: 'other', name: 'Other', icon: 'home-outline' },
];

export function locationMeta(id: StorageLocation): LocationMeta {
  return LOCATIONS.find((l) => l.id === id) ?? LOCATIONS[LOCATIONS.length - 1];
}

/** Categories that imply where the thing actually lives, used to pre-select. */
export function suggestLocation(categoryId: string): StorageLocation {
  switch (categoryId) {
    case 'dairy':
    case 'meat':
    case 'produce':
      return 'fridge';
    case 'frozen':
      return 'freezer';
    case 'cosmetics':
    case 'medicine':
    case 'household':
      return 'other';
    default:
      return 'pantry';
  }
}
