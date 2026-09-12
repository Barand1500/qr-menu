export type IngredientPoolGroup = {
  id: string;
  name: string;
  sortOrder: number;
  /** Menü Gruplar sayfasından geldiyse sayısal id */
  menuGroupId?: number | null;
};

export type IngredientPoolItem = {
  id: string;
  /** @deprecated groupIds kullan — geriye uyumluluk */
  groupId?: string | null;
  /** Malzeme birden fazla gruba ait olabilir */
  groupIds: string[];
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

export function menuGroupToPoolId(menuGroupId: number) {
  return `mg-${menuGroupId}`;
}

export function parseMenuGroupPoolId(id: string): number | null {
  const m = /^mg-(\d+)$/.exec(id);
  return m ? Number(m[1]) : null;
}

export function nameKey(name: string) {
  return name.trim().toLocaleLowerCase('tr-TR');
}

/** Item’ın grup üyeliklerini tek yerden oku (eski groupId dahil) */
export function itemGroupIds(item: IngredientPoolItem): string[] {
  if (Array.isArray(item.groupIds) && item.groupIds.length) {
    return item.groupIds.filter(Boolean);
  }
  if (item.groupId) return [item.groupId];
  return [];
}

export function itemInGroup(item: IngredientPoolItem, groupId: string) {
  return itemGroupIds(item).includes(groupId);
}

export function findItemByName(items: IngredientPoolItem[], name: string) {
  const key = nameKey(name);
  if (!key) return null;
  return items.find((i) => nameKey(i.name) === key) || null;
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
  const poolKeys = new Set(
    allPoolNames.map((n) => n.trim().toLocaleLowerCase('tr-TR')).filter(Boolean)
  );
  const manual = parseIngredientsList(current).filter(
    (n) => !poolKeys.has(n.toLocaleLowerCase('tr-TR'))
  );
  const selected = selectedNames.map((n) => n.trim()).filter(Boolean);
  return joinIngredientsList([...manual, ...selected]);
}
