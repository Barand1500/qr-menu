import { catalogByCode } from './languageCatalog';

export function languageFlag(code: string) {
  return catalogByCode(code)?.flag || '🌐';
}
