export interface AdminLanguage {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
}

export function getActiveLanguages(languages: AdminLanguage[]) {
  return languages.filter((l) => l.isActive);
}
