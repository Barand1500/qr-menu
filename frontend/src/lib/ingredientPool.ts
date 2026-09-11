export type IngredientPoolGroup = {
  id: string;
  name: string;
  sortOrder: number;
};

export type IngredientPoolItem = {
  id: string;
  groupId: string | null;
  name: string;
  sortOrder: number;
};

export type IngredientPool = {
  groups: IngredientPoolGroup[];
  items: IngredientPoolItem[];
};

export const EMPTY_INGREDIENT_POOL: IngredientPool = { groups: [], items: [] };

export function newPoolGroupId() {
  return `ig-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function newPoolItemId() {
  return `ii-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Mevcut içindekiler metnini virgülle parçala */
export function parseIngredientsList(raw: string): string[] {
  return String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function joinIngredientsList(names: string[]): string {
  return names.map((n) => n.trim()).filter(Boolean).join(', ');
}

/** Seçilen havuz adlarını mevcut metinle birleştir (yinelenenleri atla) */
export function mergeIngredientNames(current: string, selectedNames: string[]): string {
  const existing = parseIngredientsList(current);
  const seen = new Set(existing.map((n) => n.toLocaleLowerCase('tr-TR')));
  const next = [...existing];
  for (const name of selectedNames) {
    const t = name.trim();
    if (!t) continue;
    const key = t.toLocaleLowerCase('tr-TR');
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(t);
  }
  return joinIngredientsList(next);
}

/**
 * Havuz seçimini metne yazar: elle yazılmış (havuzda olmayan) satırları korur,
 * havuzdaki seçimleri günceller (seçimi kaldırılanlar metinden düşer).
 */
export function syncIngredientsFromPoolSelection(
  current: string,
  selectedNames: string[],
  allPoolNames: string[]
): string {
  const poolKeys = new Set(allPoolNames.map((n) => n.trim().toLocaleLowerCase('tr-TR')).filter(Boolean));
  const manual = parseIngredientsList(current).filter(
    (n) => !poolKeys.has(n.toLocaleLowerCase('tr-TR'))
  );
  const selected = selectedNames.map((n) => n.trim()).filter(Boolean);
  return joinIngredientsList([...manual, ...selected]);
}
