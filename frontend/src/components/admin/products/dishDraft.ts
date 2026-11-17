import type { ProductFormState } from '@/components/ProductModal';
import { flagsFromDietSelection } from '@/lib/prefCatalog';
import type { DishTemplate } from '@/lib/dishCatalog';
import type { Product } from './types';

export type DraftFill = {
  before: ProductFormState;
  after: ProductFormState;
  name: string;
};
const keys = [
  'features',
  'allergenTags',
  'calories',
  'prepTimeMinutes',
] as const;
const dietKeys = [
  'dietTags',
  'isVegan',
  'isVegetarian',
  'isGlutenFree',
  'isDiabetic',
] as const;
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
// Renaming a suggested dish removes only generated values, preserving manual corrections.
export function undoDraftFill(
  form: ProductFormState,
  fill: DraftFill | null,
): ProductFormState {
  if (!fill) return form;
  const restored = {
    ...form,
    translations: { ...form.translations, tr: { ...form.translations.tr } },
  };
  for (const key of keys)
    if (same(form[key], fill.after[key]))
      Object.assign(restored, { [key]: fill.before[key] });
  if (dietKeys.every((key) => same(form[key], fill.after[key]))) {
    for (const key of dietKeys)
      Object.assign(restored, { [key]: fill.before[key] });
  }
  for (const key of ['description', 'ingredients', 'allergens'] as const) {
    if (same(form.translations.tr?.[key], fill.after.translations.tr?.[key]))
      restored.translations.tr[key] = fill.before.translations.tr?.[key] || '';
  }
  return restored;
}
export function fillDishDraft(
  form: ProductFormState,
  name: string,
  template?: DishTemplate,
  product?: Product,
): ProductFormState {
  const source = product?.translations.find(
    (item) => item.languageCode === 'tr',
  );
  const allergens = product?.allergenTags || template?.allergenTags || [];
  const diets = product?.dietTags || template?.dietTags || [];
  const dietary = product
    ? {
        isVegan: product.isVegan || false,
        isVegetarian: product.isVegetarian || false,
        isGlutenFree: product.isGlutenFree || false,
        isDiabetic: product.isDiabetic || false,
        dietTags: diets,
      }
    : flagsFromDietSelection(diets);
  const hasDiet =
    form.dietTags.length ||
    form.isVegan ||
    form.isVegetarian ||
    form.isGlutenFree ||
    form.isDiabetic;
  return {
    ...form,
    ...(hasDiet ? {} : dietary),
    features: form.features.length
      ? form.features
      : [...(product?.features || template?.features || [])],
    allergenTags: form.allergenTags.length ? form.allergenTags : [...allergens],
    prepTimeMinutes:
      form.prepTimeMinutes || product?.prepTimeMinutes?.toString() || '',
    calories: form.calories || product?.calories?.toString() || '',
    translations: {
      ...form.translations,
      tr: {
        name,
        description:
          form.translations.tr?.description ||
          source?.description ||
          template?.description ||
          '',
        ingredients:
          form.translations.tr?.ingredients ||
          source?.ingredients ||
          template?.ingredients.join(', ') ||
          '',
        allergens: form.translations.tr?.allergens || source?.allergens || '',
      },
    },
  };
}
