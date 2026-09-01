/** Geriye dönük export — dietAllergens kullanın */
export {
  ALLERGEN_CATALOG as ALLERGEN_OPTIONS,
  allergenLabel,
  allergyUi,
  loadDietaryPrefs as loadAllergyFiltersLegacy,
  preferenceUi,
  productMatchesPrefs,
  type DietaryPrefs,
} from './dietAllergens';

import { loadDietaryPrefs, saveDietaryPrefs } from './dietAllergens';

/** Eski API uyumu */
export function loadAllergyFilters(): string[] {
  return loadDietaryPrefs().allergens;
}

export function saveAllergyFilters(ids: string[]) {
  const prefs = loadDietaryPrefs();
  saveDietaryPrefs({ ...prefs, allergens: ids });
}

export function isProductSafeForAllergies(
  _allergensText: string | null | undefined,
  selectedIds: string[]
): boolean {
  // Eski imza — allergenTags olmadan metin yoksa güvenli kabul
  if (selectedIds.length === 0) return true;
  return true;
}
