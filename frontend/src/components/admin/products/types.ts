import type { ProductOptionGroup } from '@/lib/productOptions';
export interface Currency {
  id: number;
  code: string;
  name: string;
  symbol: string;
  isActive: boolean;
}

export interface Product {
  id: number;
  name: string;
  groupId: number;
  groupName: string;
  price: number;
  previousPrice?: number | null;
  previousPriceAt?: string | null;
  currencyId?: number | null;
  currency?: { id: number | null; code: string; name: string; symbol: string };
  prepTimeMinutes?: number | null;
  calories?: number | null;
  features?: string[];
  allergenTags?: string[];
  dietTags?: string[];
  isVegan?: boolean;
  isVegetarian?: boolean;
  isGlutenFree?: boolean;
  isDiabetic?: boolean;
  isRecommended?: boolean;
  imageUrl?: string | null;
  images?: string[];
  sortOrder: number;
  isActive: boolean;
  /** null = sınırsız (S) */
  stockQty?: number | null;
  stockResetHour?: number | null;
  stockResetMinute?: number | null;
  stockResetTo?: number | null;
  optionGroups?: ProductOptionGroup[];
  isValid: boolean;
  translations: {
    languageId: number;
    languageCode: string;
    name: string;
    description?: string | null;
    ingredients?: string | null;
    allergens?: string | null;
  }[];
}

export interface Group {
  id: number;
  name: string;
  parentId?: number | null;
  parentName?: string | null;
  isSubGroup?: boolean;
}
