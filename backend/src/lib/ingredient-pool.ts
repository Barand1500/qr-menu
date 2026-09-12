import { prisma } from './prisma.js';

export const INGREDIENT_POOL_KEY = 'ingredient_pool';

export type IngredientPoolGroup = {
  id: string;
  name: string;
  sortOrder: number;
  menuGroupId?: number | null;
};

export type IngredientPoolItem = {
  id: string;
  /** legacy */
  groupId?: string | null;
  groupIds: string[];
  name: string;
  sortOrder: number;
};

export type IngredientPool = {
  groups: IngredientPoolGroup[];
  items: IngredientPoolItem[];
};

export const EMPTY_INGREDIENT_POOL: IngredientPool = { groups: [], items: [] };

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function createPoolGroupId() {
  return newId('ig');
}

export function createPoolItemId() {
  return newId('ii');
}

function parseGroupIds(row: Record<string, unknown>, groupIds: Set<string>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: unknown) => {
    if (typeof raw !== 'string') return;
    const id = raw.trim();
    if (!id || !groupIds.has(id) || seen.has(id)) return;
    seen.add(id);
    out.push(id);
  };
  if (Array.isArray(row.groupIds)) {
    for (const g of row.groupIds) push(g);
  }
  if (!out.length) push(row.groupId);
  return out;
}

export function normalizeIngredientPool(raw: unknown): IngredientPool {
  if (!raw || typeof raw !== 'object') return structuredClone(EMPTY_INGREDIENT_POOL);
  const o = raw as { groups?: unknown; items?: unknown };

  const groups: IngredientPoolGroup[] = [];
  const knownGroupIds = new Set<string>();
  if (Array.isArray(o.groups)) {
    o.groups.forEach((g, i) => {
      if (!g || typeof g !== 'object') return;
      const row = g as Record<string, unknown>;
      const name = typeof row.name === 'string' ? row.name.trim() : '';
      if (!name) return;
      const id =
        typeof row.id === 'string' && row.id.trim() ? row.id.trim() : createPoolGroupId();
      if (knownGroupIds.has(id)) return;
      knownGroupIds.add(id);
      const menuGroupIdRaw = Number(row.menuGroupId);
      groups.push({
        id,
        name: name.slice(0, 80),
        sortOrder: Number.isFinite(Number(row.sortOrder)) ? Number(row.sortOrder) : i,
        menuGroupId:
          Number.isFinite(menuGroupIdRaw) && menuGroupIdRaw > 0 ? menuGroupIdRaw : null,
      });
    });
  }
  groups.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'tr'));
  groups.forEach((g, i) => {
    g.sortOrder = i;
  });

  const items: IngredientPoolItem[] = [];
  const itemIds = new Set<string>();
  if (Array.isArray(o.items)) {
    o.items.forEach((it, i) => {
      if (!it || typeof it !== 'object') return;
      const row = it as Record<string, unknown>;
      const name = typeof row.name === 'string' ? row.name.trim() : '';
      if (!name) return;
      const id =
        typeof row.id === 'string' && row.id.trim() ? row.id.trim() : createPoolItemId();
      if (itemIds.has(id)) return;
      itemIds.add(id);
      const groupIds = parseGroupIds(row, knownGroupIds);
      items.push({
        id,
        groupIds,
        groupId: groupIds[0] || null,
        name: name.slice(0, 80),
        sortOrder: Number.isFinite(Number(row.sortOrder)) ? Number(row.sortOrder) : i,
      });
    });
  }
  items.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'tr'));
  items.forEach((it, i) => {
    it.sortOrder = i;
  });

  return { groups, items };
}

export function serializeIngredientPool(pool: IngredientPool): string {
  return JSON.stringify(normalizeIngredientPool(pool));
}

export async function loadIngredientPool(restaurantId: number): Promise<IngredientPool> {
  const row = await prisma.setting.findFirst({
    where: { restaurantId, key: INGREDIENT_POOL_KEY },
  });
  if (!row?.value) return structuredClone(EMPTY_INGREDIENT_POOL);
  try {
    return normalizeIngredientPool(JSON.parse(row.value));
  } catch {
    return structuredClone(EMPTY_INGREDIENT_POOL);
  }
}
