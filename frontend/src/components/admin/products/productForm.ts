import type {
  ProductFormState,
  ProductTranslationFields,
} from '@/components/ProductModal';
import type { Product } from './types';
export const emptyForm = (): ProductFormState => ({
  groupId: '',
  price: '',
  currencyId: '',
  prepTimeMinutes: '',
  calories: '',
  features: [],
  allergenTags: [],
  dietTags: [],
  isVegan: false,
  isVegetarian: false,
  isGlutenFree: false,
  isDiabetic: false,
  isRecommended: false,
  translations: {},
  isActive: true,
});

export function buildFormFromProduct(product: Product): ProductFormState {
  const translations: Record<string, ProductTranslationFields> = {};
  for (const t of product.translations) {
    translations[t.languageCode] = {
      name: t.name,
      description: t.description || '',
      ingredients: t.ingredients || '',
      allergens: t.allergens || '',
    };
  }
  return {
    groupId: product.groupId.toString(),
    price: product.price.toString(),
    currencyId: (product.currencyId ?? product.currency?.id)?.toString() || '',
    prepTimeMinutes: product.prepTimeMinutes?.toString() || '',
    calories: product.calories?.toString() || '',
    features: product.features ?? [],
    allergenTags: product.allergenTags ?? [],
    dietTags: product.dietTags ?? [],
    isVegan: product.isVegan ?? false,
    isVegetarian: product.isVegetarian ?? false,
    isGlutenFree: product.isGlutenFree ?? false,
    isDiabetic: product.isDiabetic ?? false,
    isRecommended: product.isRecommended ?? false,
    translations,
    isActive: product.isActive,
  };
}
