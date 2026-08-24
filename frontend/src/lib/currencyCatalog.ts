/** Eklenebilir para birimleri — kur/çevrim yok */

export interface CatalogCurrency {
  code: string;
  name: string;
  symbol: string;
  flag: string;
}

export const CURRENCY_CATALOG: CatalogCurrency[] = [
  { code: 'TRY', name: 'Türk Lirası', symbol: '₺', flag: '🇹🇷' },
  { code: 'USD', name: 'ABD Doları', symbol: '$', flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'GBP', name: 'Sterlin', symbol: '£', flag: '🇬🇧' },
  { code: 'RUB', name: 'Rus Rublesi', symbol: '₽', flag: '🇷🇺' },
  { code: 'AED', name: 'BAE Dirhemi', symbol: 'د.إ', flag: '🇦🇪' },
  { code: 'SAR', name: 'Suudi Riyali', symbol: '﷼', flag: '🇸🇦' },
  { code: 'CHF', name: 'İsviçre Frangı', symbol: 'CHF', flag: '🇨🇭' },
  { code: 'JPY', name: 'Japon Yeni', symbol: '¥', flag: '🇯🇵' },
  { code: 'CNY', name: 'Çin Yuanı', symbol: '¥', flag: '🇨🇳' },
  { code: 'AZN', name: 'Azerbaycan Manatı', symbol: '₼', flag: '🇦🇿' },
  { code: 'GEL', name: 'Gürcistan Larisi', symbol: '₾', flag: '🇬🇪' },
  { code: 'PLN', name: 'Polonya Zlotisi', symbol: 'zł', flag: '🇵🇱' },
  { code: 'RON', name: 'Romanya Leyi', symbol: 'lei', flag: '🇷🇴' },
  { code: 'BGN', name: 'Bulgar Levası', symbol: 'лв', flag: '🇧🇬' },
  { code: 'UAH', name: 'Ukrayna Grivnası', symbol: '₴', flag: '🇺🇦' },
];

export function currencyCatalogByCode(code: string) {
  return CURRENCY_CATALOG.find((c) => c.code === code.toUpperCase());
}
