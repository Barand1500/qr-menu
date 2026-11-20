/** Menünün işletme adı/logosu: fiş gibi menü dışı yüzeylerde göstermek için (sayfalar arası korunur). */
export type MenuBrand = { name: string; logoUrl?: string | null };

const mem = new Map<string, MenuBrand>();
const KEY = (slug: string) => `menu_brand_${slug}`;

export function setMenuBrand(slug: string | null | undefined, brand: MenuBrand | null | undefined) {
  if (!slug || !brand?.name) return;
  mem.set(slug, brand);
  try {
    sessionStorage.setItem(KEY(slug), JSON.stringify(brand));
  } catch {
    /* saklanamadı */
  }
}

export function getMenuBrand(slug: string | null | undefined): MenuBrand | null {
  if (!slug) return null;
  const hit = mem.get(slug);
  if (hit) return hit;
  try {
    const raw = sessionStorage.getItem(KEY(slug));
    return raw ? (JSON.parse(raw) as MenuBrand) : null;
  } catch {
    return null;
  }
}
