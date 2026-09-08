export type OptionGroupType = 'single' | 'multi' | 'choice';
export type OptionPricingMode = 'replace' | 'add';

export type ProductOption = {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
  sortOrder: number;
  excludesOptionIds: string[];
  /** Tek seçim boy/tür: seçilince ekstra gruplarına uygulanan maks (0 = özel yok) */
  limitsMultiMaxTotalQty: number;
};

export type ProductOptionGroup = {
  id: string;
  name: string;
  type: OptionGroupType;
  pricing: OptionPricingMode;
  required: boolean;
  sortOrder: number;
  /** multi: 0 = sınırsız (tür limiti yoksa) */
  maxTotalQty: number;
  options: ProductOption[];
};

export type SelectionMap = Record<string, { optionId: string; qty: number }[]>;

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
    maxTotalQty: 0,
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
    limitsMultiMaxTotalQty: 0,
    ...partial,
  };
}

export function selectionsFlat(selections: SelectionMap) {
  return Object.entries(selections).flatMap(([groupId, picks]) =>
    picks.map((p) => ({ groupId, optionId: p.optionId, qty: p.qty }))
  );
}

export function blockedOptionIds(groups: ProductOptionGroup[], selections: SelectionMap): Set<string> {
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

export function groupSelectedQty(selections: SelectionMap, groupId: string) {
  return (selections[groupId] || []).reduce((n, p) => n + Math.max(0, p.qty || 0), 0);
}

/** Seçili boy/türden gelen ekstra üst sınırı */
export function typeLimitedMultiMax(groups: ProductOptionGroup[], selections: SelectionMap): number {
  const limits: number[] = [];
  for (const g of groups) {
    if (g.type !== 'single') continue;
    for (const p of selections[g.id] || []) {
      const opt = g.options.find((o) => o.id === p.optionId);
      const lim = Math.max(0, Number(opt?.limitsMultiMaxTotalQty) || 0);
      if (lim > 0) limits.push(lim);
    }
  }
  if (!limits.length) return 0;
  return Math.min(...limits);
}

export function effectiveMultiMaxTotalQty(
  groups: ProductOptionGroup[],
  selections: SelectionMap,
  multiGroup: ProductOptionGroup
): number {
  const fromType = typeLimitedMultiMax(groups, selections);
  if (fromType > 0) return fromType;
  return Math.max(0, Number(multiGroup.maxTotalQty) || 0);
}

export function computePreviewUnitPrice(
  basePrice: number,
  groups: ProductOptionGroup[],
  selections: SelectionMap
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
export function pruneBlockedSelections(groups: ProductOptionGroup[], selections: SelectionMap) {
  let next = { ...selections };
  for (let i = 0; i < 5; i++) {
    const blocked = blockedOptionIds(groups, next);
    let changed = false;
    const cleaned: SelectionMap = {};
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

/** Tür limiti düşerse fazla ekstraları sondan kırp */
export function clampMultiSelectionsToMax(groups: ProductOptionGroup[], selections: SelectionMap) {
  let next: SelectionMap = { ...selections };
  for (const g of groups) {
    if (g.type !== 'multi') continue;
    const maxQty = effectiveMultiMaxTotalQty(groups, next, g);
    if (maxQty <= 0) continue;
    const picks = [...(next[g.id] || [])];
    let total = picks.reduce((n, p) => n + Math.max(0, p.qty || 0), 0);
    if (total <= maxQty) continue;
    const trimmed = picks.map((p) => ({ ...p }));
    for (let i = trimmed.length - 1; i >= 0 && total > maxQty; i--) {
      const over = total - maxQty;
      const cut = Math.min(trimmed[i].qty, over);
      trimmed[i] = { ...trimmed[i], qty: trimmed[i].qty - cut };
      total -= cut;
      if (trimmed[i].qty <= 0) trimmed.splice(i, 1);
    }
    if (trimmed.length) next[g.id] = trimmed;
    else {
      const copy = { ...next };
      delete copy[g.id];
      next = copy;
    }
  }
  return next;
}

export function sanitizeSelections(groups: ProductOptionGroup[], selections: SelectionMap) {
  return clampMultiSelectionsToMax(groups, pruneBlockedSelections(groups, selections));
}
