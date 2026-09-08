export type OptionGroupType = 'single' | 'multi';
export type OptionPricingMode = 'replace' | 'add';

export type ProductOption = {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
  sortOrder: number;
};

export type ProductOptionGroup = {
  id: string;
  name: string;
  type: OptionGroupType;
  pricing: OptionPricingMode;
  required: boolean;
  sortOrder: number;
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
    ...partial,
  };
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
