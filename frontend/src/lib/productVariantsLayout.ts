/** Varyant sayfası düzeni — masa görünümü skin gibi localStorage */
export const PV_LAYOUT_KEY = 'menu_qr_product_variants_layout';

export const PV_LAYOUTS = ['gallery', 'wizard'] as const;
export type ProductVariantsLayout = (typeof PV_LAYOUTS)[number];

export const PV_LAYOUT_LABELS: Record<ProductVariantsLayout, string> = {
  gallery: 'Galeri',
  wizard: 'Sihirbaz',
};

export function loadProductVariantsLayout(): ProductVariantsLayout {
  try {
    const raw = localStorage.getItem(PV_LAYOUT_KEY);
    if (raw === 'wizard' || raw === 'gallery') return raw;
    const n = Number(raw);
    if (Number.isFinite(n) && PV_LAYOUTS[n]) return PV_LAYOUTS[n];
  } catch {
    /* ignore */
  }
  return 'gallery';
}

export function saveProductVariantsLayout(layout: ProductVariantsLayout) {
  try {
    localStorage.setItem(PV_LAYOUT_KEY, layout);
  } catch {
    /* ignore */
  }
}

export function cycleProductVariantsLayout(
  current: ProductVariantsLayout,
  dir: -1 | 1
): ProductVariantsLayout {
  const i = PV_LAYOUTS.indexOf(current);
  const next = PV_LAYOUTS[(i + dir + PV_LAYOUTS.length) % PV_LAYOUTS.length];
  saveProductVariantsLayout(next);
  return next;
}
