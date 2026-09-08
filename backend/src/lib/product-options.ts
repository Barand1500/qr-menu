/** Ürün seçenek grupları — tek seçim (kırılma) veya miktarlı ekstra */

export type OptionGroupType = 'single' | 'multi';
export type OptionPricingMode = 'replace' | 'add';

export type ProductOption = {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
  sortOrder: number;
  /** Bu seçenek seçilince gizlenecek / yasaklanacak diğer seçenek id’leri */
  excludesOptionIds: string[];
};

export type ProductOptionGroup = {
  id: string;
  name: string;
  type: OptionGroupType;
  /** single: genelde replace (makarna tipi); multi: add (ekstra et) */
  pricing: OptionPricingMode;
  required: boolean;
  sortOrder: number;
  /** multi: toplam ekstra adet üst sınırı (0 = sınırsız) */
  maxTotalQty: number;
  options: ProductOption[];
};

export type OptionSelectionInput = {
  groupId: string;
  optionId: string;
  qty?: number;
};

function asArray(raw: unknown): unknown[] {
  return Array.isArray(raw) ? raw : [];
}

function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function normalizeOptionGroups(raw: unknown): ProductOptionGroup[] {
  return asArray(raw)
    .map((row, gi) => {
      if (!row || typeof row !== 'object') return null;
      const r = row as Record<string, unknown>;
      const type: OptionGroupType = r.type === 'multi' ? 'multi' : 'single';
      const pricing: OptionPricingMode =
        r.pricing === 'add' || r.pricing === 'replace'
          ? r.pricing
          : type === 'multi'
            ? 'add'
            : 'replace';
      const options = asArray(r.options)
        .map((opt, oi) => {
          if (!opt || typeof opt !== 'object') return null;
          const o = opt as Record<string, unknown>;
          const name = String(o.name || '').trim().slice(0, 80);
          if (!name) return null;
          const excludesOptionIds = asArray(o.excludesOptionIds)
            .map((id) => String(id || '').trim())
            .filter(Boolean)
            .slice(0, 40);
          return {
            id: String(o.id || newId('opt')).slice(0, 64),
            name,
            price: Math.max(0, Math.round((Number(o.price) || 0) * 100) / 100),
            isActive: o.isActive !== false,
            sortOrder: Number.isFinite(Number(o.sortOrder)) ? Number(o.sortOrder) : oi,
            excludesOptionIds,
          } satisfies ProductOption;
        })
        .filter(Boolean) as ProductOption[];

      const name = String(r.name || '').trim().slice(0, 80);
      if (!name) return null;

      const maxRaw = Number(r.maxTotalQty);
      const maxTotalQty =
        type === 'multi' && Number.isFinite(maxRaw) && maxRaw > 0
          ? Math.min(99, Math.floor(maxRaw))
          : 0;

      return {
        id: String(r.id || newId('grp')).slice(0, 64),
        name,
        type,
        pricing,
        required: r.required === true || (type === 'single' && r.required !== false),
        sortOrder: Number.isFinite(Number(r.sortOrder)) ? Number(r.sortOrder) : gi,
        maxTotalQty,
        options: options.sort((a, b) => a.sortOrder - b.sortOrder),
      } satisfies ProductOptionGroup;
    })
    .filter(Boolean)
    .sort((a, b) => a!.sortOrder - b!.sortOrder) as ProductOptionGroup[];
}

export function activeOptionGroups(raw: unknown): ProductOptionGroup[] {
  return normalizeOptionGroups(raw)
    .map((g) => ({
      ...g,
      options: g.options.filter((o) => o.isActive),
    }))
    .filter((g) => g.options.length > 0);
}

/** Seçili seçeneklerin exclude listesinden yasaklı option id’leri */
export function blockedOptionIds(
  groups: ProductOptionGroup[],
  selections: OptionSelectionInput[]
): Set<string> {
  const selectedIds = new Set(
    (selections || []).map((s) => String(s.optionId || '')).filter(Boolean)
  );
  const blocked = new Set<string>();
  for (const g of groups) {
    for (const o of g.options) {
      if (!selectedIds.has(o.id)) continue;
      for (const hid of o.excludesOptionIds || []) {
        if (hid && hid !== o.id) blocked.add(hid);
      }
    }
  }
  return blocked;
}

export function validateSelections(
  groups: ProductOptionGroup[],
  selections: OptionSelectionInput[]
): { ok: true; picks: { group: ProductOptionGroup; option: ProductOption; qty: number }[] } | { ok: false; message: string } {
  const picks: { group: ProductOptionGroup; option: ProductOption; qty: number }[] = [];
  const byGroup = new Map<string, OptionSelectionInput[]>();

  for (const s of selections || []) {
    const gid = String(s.groupId || '');
    if (!gid) continue;
    const list = byGroup.get(gid) || [];
    list.push(s);
    byGroup.set(gid, list);
  }

  for (const group of groups) {
    const chosen = byGroup.get(group.id) || [];
    if (group.type === 'single') {
      if (group.required && chosen.length === 0) {
        return { ok: false, message: `"${group.name}" seçimi zorunlu` };
      }
      if (chosen.length > 1) {
        return { ok: false, message: `"${group.name}" için tek seçim yapın` };
      }
      if (chosen.length === 1) {
        const opt = group.options.find((o) => o.id === String(chosen[0].optionId));
        if (!opt) return { ok: false, message: `"${group.name}" geçersiz seçenek` };
        picks.push({ group, option: opt, qty: 1 });
      }
      continue;
    }

    // multi
    if (group.required && chosen.length === 0) {
      return { ok: false, message: `"${group.name}" için en az bir seçim yapın` };
    }
    let totalQty = 0;
    for (const c of chosen) {
      const opt = group.options.find((o) => o.id === String(c.optionId));
      if (!opt) return { ok: false, message: `"${group.name}" geçersiz seçenek` };
      const qty = Math.min(99, Math.max(1, Number(c.qty) || 1));
      totalQty += qty;
      picks.push({ group, option: opt, qty });
    }
    if (group.maxTotalQty > 0 && totalQty > group.maxTotalQty) {
      return {
        ok: false,
        message: `"${group.name}" en fazla ${group.maxTotalQty} adet olabilir`,
      };
    }
  }

  const blocked = blockedOptionIds(groups, selections || []);
  for (const p of picks) {
    if (blocked.has(p.option.id)) {
      return {
        ok: false,
        message: `"${p.option.name}" şu anki seçimlerle birlikte kullanılamaz`,
      };
    }
  }

  return { ok: true, picks };
}

/** Birim fiyat: replace grupları tabanı değiştirir, add grupları ekler */
export function computeUnitPrice(
  basePrice: number,
  picks: { group: ProductOptionGroup; option: ProductOption; qty: number }[]
) {
  let unit = Math.max(0, Number(basePrice) || 0);
  for (const p of picks) {
    if (p.group.pricing === 'replace') {
      unit = Math.max(0, Number(p.option.price) || 0);
    }
  }
  for (const p of picks) {
    if (p.group.pricing === 'add') {
      unit += Math.max(0, Number(p.option.price) || 0) * Math.max(1, p.qty);
    }
  }
  return Math.round(unit * 100) / 100;
}

export function formatSelectionsNote(
  picks: { group: ProductOptionGroup; option: ProductOption; qty: number }[]
) {
  return picks
    .map((p) => (p.qty > 1 ? `${p.option.name} ×${p.qty}` : p.option.name))
    .join(' · ')
    .slice(0, 240);
}

export function optionGroupsSummary(raw: unknown) {
  const groups = normalizeOptionGroups(raw);
  const optionCount = groups.reduce((n, g) => n + g.options.length, 0);
  return { groupCount: groups.length, optionCount };
}
