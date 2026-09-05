import { useEffect, useState, type ReactNode } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { api, imageUrl, formatMoney } from '@/lib/api';
import { useMenuSlug } from '@/hooks/useMenuSlug';
import MenuMediaPlaceholder from '@/components/public/MenuMediaPlaceholder';
import SiparisProductCard, {
  type SiparisProductCardItem,
} from '@/components/public/siparis/SiparisProductCard';
import SiparisBannerCarousel from '@/components/public/siparis/SiparisBannerCarousel';
import type { PopularProduct } from '@/components/public/PopularSearchProducts';
import { useSiparisCart } from '@/hooks/useSiparisCart';

type ShowcaseItem = {
  id: number;
  imageUrl?: string | null;
  title1: string;
  title2: string;
};

type MenuGroup = {
  id: number;
  name: string;
  imageUrl?: string | null;
  productCount?: number;
  children?: { id: number; name: string; imageUrl?: string | null }[];
};

type MenuData = {
  restaurant: { name: string };
  groups: MenuGroup[];
  campaign?: { name: string } | null;
};

type GroupProduct = {
  id: number;
  name: string;
  description?: string;
  price: number;
  currency?: { code?: string; symbol?: string } | null;
  imageUrl?: string | null;
  calories?: number | null;
};

export default function SiparisHome({
  menu,
  displayShowcase,
  popularProducts,
  allergyBanner,
  lang,
  campaignSlug,
}: {
  menu: MenuData;
  displayShowcase?: ShowcaseItem[] | null;
  popularProducts: PopularProduct[];
  allergyBanner?: ReactNode;
  lang: string;
  campaignSlug?: string;
}) {
  const { slug } = useMenuSlug();
  const { items, totalPrice, count, setSheetOpen } = useSiparisCart();
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const [activeSubId, setActiveSubId] = useState<number | null>(null);
  const [groupProducts, setGroupProducts] = useState<GroupProduct[] | null>(null);
  const [loadingGroup, setLoadingGroup] = useState(false);

  const banners = displayShowcase?.length ? displayShowcase : [];
  const en = (lang || 'tr').split('-')[0] === 'en';

  const activeGroup =
    activeGroupId == null ? null : menu.groups.find((g) => g.id === activeGroupId) || null;
  const children = activeGroup?.children?.length ? activeGroup.children : [];
  /** Ana kategori ürünleri + isteğe bağlı alt filtre */
  const fetchGroupId = activeSubId ?? activeGroupId;

  useEffect(() => {
    if (fetchGroupId == null || !slug) {
      setGroupProducts(null);
      setLoadingGroup(false);
      return;
    }
    let cancelled = false;
    setLoadingGroup(true);
    const params = new URLSearchParams({ lang });
    if (campaignSlug) params.set('kampanya', campaignSlug);
    api<{ products: GroupProduct[] }>(
      `/api/menu/${slug}/groups/${fetchGroupId}/products?${params}`
    )
      .then((data) => {
        if (!cancelled) setGroupProducts(data.products);
      })
      .catch(() => {
        if (!cancelled) setGroupProducts([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingGroup(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchGroupId, slug, lang, campaignSlug]);

  function selectRoot(id: number | null) {
    setActiveGroupId(id);
    setActiveSubId(null);
    setGroupProducts(null);
  }

  function toggleSub(id: number) {
    setActiveSubId((prev) => (prev === id ? null : id));
  }

  const listItems: SiparisProductCardItem[] =
    activeGroupId == null
      ? popularProducts.map((p) => ({
          productId: p.id,
          name: p.name,
          price: p.price,
          currency: p.currency,
          imageUrl: p.imageUrl,
          calories: p.calories ?? null,
        }))
      : (groupProducts || []).map((p) => ({
          productId: p.id,
          name: p.name,
          price: p.price,
          currency: p.currency,
          imageUrl: p.imageUrl,
          calories: p.calories ?? null,
          description: p.description,
        }));

  const sectionTitle =
    activeGroupId == null
      ? en
        ? 'Recommended'
        : 'Önerilen ürünler'
      : activeSubId != null
        ? children.find((c) => c.id === activeSubId)?.name || activeGroup?.name || ''
        : activeGroup?.name || '';

  return (
    <div className="siparis-home">
      {allergyBanner}

      <div className="siparis-home__main">
        {banners.length > 0 ? (
          <SiparisBannerCarousel
            banners={banners}
            campaignName={menu.campaign?.name}
          />
        ) : null}

        <nav className="siparis-cats" aria-label={en ? 'Categories' : 'Kategoriler'}>
          <button
            type="button"
            className={`siparis-cats__item${activeGroupId == null ? ' is-active' : ''}`}
            onClick={() => selectRoot(null)}
          >
            <span className="siparis-cats__icon siparis-cats__icon--star" aria-hidden>
              ★
            </span>
            <span className="siparis-cats__label">{en ? 'Picks' : 'Önerilen'}</span>
          </button>
          {menu.groups.map((g) => (
            <button
              key={g.id}
              type="button"
              className={`siparis-cats__item${activeGroupId === g.id ? ' is-active' : ''}`}
              onClick={() => selectRoot(g.id)}
            >
              <span className="siparis-cats__icon">
                {g.imageUrl ? (
                  <img src={imageUrl(g.imageUrl)} alt="" />
                ) : (
                  <MenuMediaPlaceholder kind="group" size="sm" label={g.name} />
                )}
              </span>
              <span className="siparis-cats__label">{g.name}</span>
            </button>
          ))}
        </nav>

        {children.length > 0 ? (
          <div className="siparis-subs" role="group" aria-label={en ? 'Subcategories' : 'Alt kategoriler'}>
            <p className="siparis-subs__label">
              {en ? 'Subcategories' : 'Alt kategoriler'}
              <span> · {activeGroup?.name}</span>
              {activeSubId ? (
                <button
                  type="button"
                  className="siparis-subs__clear"
                  onClick={() => setActiveSubId(null)}
                >
                  {en ? 'Clear filter' : 'Filtreyi kaldır'}
                </button>
              ) : null}
            </p>
            <div className="siparis-subs__grid">
              {children.map((c) => {
                const selected = activeSubId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`siparis-subs__chip${selected ? ' is-selected' : ''}`}
                    onClick={() => toggleSub(c.id)}
                    aria-pressed={selected}
                  >
                    <span className="siparis-subs__check" aria-hidden>
                      {selected ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : null}
                    </span>
                    <span className="siparis-subs__thumb">
                      {c.imageUrl ? (
                        <img src={imageUrl(c.imageUrl)} alt="" />
                      ) : (
                        <MenuMediaPlaceholder kind="group" size="sm" label={c.name} />
                      )}
                    </span>
                    <span className="siparis-subs__name">{c.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <section className="siparis-section">
          <header className="siparis-section__head">
            <h3>{sectionTitle}</h3>
            {activeGroupId == null && popularProducts.length > 0 ? (
              <span className="siparis-section__hint">
                {en ? 'Tap + to add' : '+ ile sepete ekle'}
              </span>
            ) : activeGroupId != null && children.length > 0 && activeSubId == null ? (
              <span className="siparis-section__hint">
                {en ? 'Main category items' : 'Ana kategori ürünleri'}
              </span>
            ) : null}
          </header>

          {loadingGroup ? (
            <div className="siparis-section__loading" aria-hidden>
              <span className="siparis-spinner" />
            </div>
          ) : listItems.length === 0 ? (
            <p className="siparis-section__empty">
              {en ? 'No products here yet.' : 'Bu kategoride ürün yok.'}
            </p>
          ) : (
            <div className="siparis-grid">
              {listItems.map((p) => (
                <SiparisProductCard key={p.productId} product={p} />
              ))}
            </div>
          )}
        </section>
      </div>

      <aside className="siparis-rail" aria-label={en ? 'Order summary' : 'Sipariş özeti'}>
        <div className="siparis-rail__card">
          <h3>{en ? 'Your order' : 'Siparişin'}</h3>
          {items.length === 0 ? (
            <p className="siparis-rail__empty">
              {en ? 'Add items with +' : '+ ile ürün ekle'}
            </p>
          ) : (
            <ul className="siparis-rail__list">
              {items.map((i) => (
                <li key={i.productId}>
                  <span>
                    {i.qty}× {i.name}
                  </span>
                  <strong>{formatMoney(i.price * i.qty, i.currency)}</strong>
                </li>
              ))}
            </ul>
          )}
          <div className="siparis-rail__total">
            <span>{en ? 'Total' : 'Toplam'}</span>
            <strong>{formatMoney(totalPrice, items[0]?.currency)}</strong>
          </div>
          <button
            type="button"
            className="siparis-rail__open"
            onClick={() => setSheetOpen(true)}
          >
            {en ? 'Open cart' : 'Sepeti aç'}
            {count > 0 ? ` (${count})` : ''}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </aside>
    </div>
  );
}
