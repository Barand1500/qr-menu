export type OptionGroupType = 'single' | 'multi';
export type OptionPricingMode = 'replace' | 'add';

export type ProductOption = {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
  sortOrder: number;
  excludesOptionIds: string[];
};

export type ProductOptionGroup = {
  id: string;
  name: string;
  type: OptionGroupType;
  pricing: OptionPricingMode;
  required: boolean;
  sortOrder: number;
  /** multi: 0 = sınırsız */
  maxTotalQty: number;
  options: ProductOption[];
};

export function newOptionId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function emptyGroup(partial?: Partial<ProductOptionGroup>): ProductOptionGroup {
  const type = partial?.type || 'multi';
  return {
    id: newOptionId('grp'),
    name: '',
    type,
    pricing: partial?.pricing || (type === 'single' ? 'replace' : 'add'),
    required: type === 'single',
    sortOrder: 0,
    maxTotalQty: type === 'multi' ? 0 : 0,
    options: [],
    ...partial,
  };
}

export function emptyOption(partial?: Partial<ProductOption>): ProductOption {
  return {
    id: newOptionId('opt'),
    name: '',
    price: 0,
    isActive: true,
    sortOrder: 0,
    excludesOptionIds: [],
    ...partial,
  };
}

export function selectionsFlat(
  selections: Record<string, { optionId: string; qty: number }[]>
) {
  return Object.entries(selections).flatMap(([groupId, picks]) =>
    picks.map((p) => ({ groupId, optionId: p.optionId, qty: p.qty }))
  );
}

export function blockedOptionIds(
  groups: ProductOptionGroup[],
  selections: Record<string, { optionId: string; qty: number }[]>
): Set<string> {
  const selected = new Set(
    Object.values(selections)
      .flat()
      .map((p) => p.optionId)
  );
  const blocked = new Set<string>();
  for (const g of groups) {
    for (const o of g.options) {
      if (!selected.has(o.id)) continue;
      for (const hid of o.excludesOptionIds || []) {
        if (hid && hid !== o.id) blocked.add(hid);
      }
    }
  }
  return blocked;
}

export function groupSelectedQty(
  selections: Record<string, { optionId: string; qty: number }[]>,
  groupId: string
) {
  return (selections[groupId] || []).reduce((n, p) => n + Math.max(0, p.qty || 0), 0);
}

export function computePreviewUnitPrice(
  basePrice: number,
  groups: ProductOptionGroup[],
  selections: Record<string, { optionId: string; qty: number }[]>
) {
  let unit = Math.max(0, basePrice);
  for (const g of groups) {
    const picks = selections[g.id] || [];
    if (g.pricing !== 'replace' || !picks.length) continue;
    const opt = g.options.find((o) => o.id === picks[0].optionId);
    if (opt) unit = Math.max(0, opt.price);
  }
  for (const g of groups) {
    if (g.pricing !== 'add') continue;
    for (const p of selections[g.id] || []) {
      const opt = g.options.find((o) => o.id === p.optionId);
      if (opt) unit += Math.max(0, opt.price) * Math.max(1, p.qty || 1);
    }
  }
  return Math.round(unit * 100) / 100;
}

/** Yasaklı seçimleri temizle (koşul değişince) */
export function pruneBlockedSelections(
  groups: ProductOptionGroup[],
  selections: Record<string, { optionId: string; qty: number }[]>
) {
  let next = { ...selections };
  for (let i = 0; i < 5; i++) {
    const blocked = blockedOptionIds(groups, next);
    let changed = false;
    const cleaned: typeof next = {};
    for (const [gid, picks] of Object.entries(next)) {
      const kept = picks.filter((p) => !blocked.has(p.optionId));
      if (kept.length !== picks.length) changed = true;
      if (kept.length) cleaned[gid] = kept;
    }
    next = cleaned;
    if (!changed) break;
  }
  return next;
}
