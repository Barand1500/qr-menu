import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, imageUrl } from '@/lib/api';
import { useMenuSlug } from '@/hooks/useMenuSlug';
import MobileStoriesStrip, { type MenuStory } from '@/components/public/MobileStoriesStrip';
import StandartChatRow, {
  type StandartChatProduct,
} from '@/components/public/standart/StandartChatRow';
import StandartPcBoard from '@/components/public/standart/StandartPcBoard';
import type { PopularProduct } from '@/components/public/PopularSearchProducts';
import { useSiparisCart } from '@/hooks/useSiparisCart';

type ShowcaseUnused = unknown;

type MenuGroup = {
  id: number;
  name: string;
  imageUrl?: string | null;
  productCount?: number;
  children?: { id: number; name: string; imageUrl?: string | null }[];
};

type MenuData = {
  restaurant: { name: string; logoUrl?: string | null };
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
  soldOut?: boolean;
};

export default function StandartHome({
  menu,
  displayStories,
  popularProducts,
  allergyBanner,
  lang,
  campaignSlug,
}: {
  menu: MenuData;
  displayStories?: MenuStory[] | null;
  popularProducts: PopularProduct[];
  allergyBanner?: ReactNode;
  lang: string;
  campaignSlug?: string;
  displayShowcase?: ShowcaseUnused;
}) {
  const { slug } = useMenuSlug();
  const { enabled: cartOn } = useSiparisCart();
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const [groupProducts, setGroupProducts] = useState<GroupProduct[] | null>(null);
  const [loadingGroup, setLoadingGroup] = useState(false);

  const hasStories = Boolean(displayStories && displayStories.length > 0);
  const en = (lang || 'tr').split('-')[0] === 'en';
  const boardGroups = useMemo(
    () => menu.groups.map((g) => ({ id: g.id, name: g.name, imageUrl: g.imageUrl })),
    [menu.groups]
  );

  useEffect(() => {
    if (activeGroupId == null || !slug) {
      setGroupProducts(null);
      setLoadingGroup(false);
      return;
    }
    let cancelled = false;
    setLoadingGroup(true);
    const params = new URLSearchParams({ lang });
    if (campaignSlug) params.set('kampanya', campaignSlug);
    api<{ products: GroupProduct[] }>(
      `/api/menu/${slug}/groups/${activeGroupId}/products?${params}`
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
  }, [activeGroupId, slug, lang, campaignSlug]);

  const listItems: StandartChatProduct[] =
    activeGroupId == null
      ? popularProducts.map((p) => ({
          productId: p.id,
          name: p.name,
          description: undefined,
          price: p.price,
          currency: p.currency,
          imageUrl: p.imageUrl,
          calories: p.calories ?? null,
          soldOut: Boolean(p.soldOut),
        }))
      : (groupProducts || []).map((p) => ({
          productId: p.id,
          name: p.name,
          description: p.description,
          price: p.price,
          currency: p.currency,
          imageUrl: p.imageUrl,
          calories: p.calories ?? null,
          soldOut: Boolean(p.soldOut),
        }));

  const sectionTitle =
    activeGroupId == null
      ? en
        ? 'Recommended'
        : 'Önerilen'
      : menu.groups.find((g) => g.id === activeGroupId)?.name || '';

  return (
    <div className="std-home">
      {allergyBanner}

      {/* Mobil yüzey */}
      <div className="std-home__mobile">
        <header className="std-home__brand" aria-label={menu.restaurant.name}>
          {menu.restaurant.logoUrl ? (
            <img
              src={imageUrl(menu.restaurant.logoUrl)}
              alt={menu.restaurant.name}
              className="std-home__logo"
            />
          ) : (
            <div className="std-home__logo-fallback" aria-hidden>
              {menu.restaurant.name.charAt(0)}
            </div>
          )}
          {menu.campaign?.name ? (
            <p className="std-home__campaign">{menu.campaign.name}</p>
          ) : null}
        </header>

        {hasStories ? (
          <div className="std-home__stories">
            <MobileStoriesStrip stories={displayStories!} />
          </div>
        ) : null}

        <nav className="std-cats std-cats--mobile" aria-label={en ? 'Categories' : 'Kategoriler'}>
          <button
            type="button"
            className={`std-cats__chip${activeGroupId == null ? ' is-active' : ''}`}
            onClick={() => setActiveGroupId(null)}
          >
            {en ? 'Picks' : 'Önerilen'}
          </button>
          {menu.groups.map((g) => (
            <button
              key={g.id}
              type="button"
              className={`std-cats__chip${activeGroupId === g.id ? ' is-active' : ''}`}
              onClick={() => setActiveGroupId(g.id)}
            >
              {g.name}
            </button>
          ))}
        </nav>

        <section className="std-chat" aria-label={sectionTitle}>
          <h2 className="std-chat__title">{sectionTitle}</h2>
          {loadingGroup ? (
            <p className="std-chat__empty">{en ? 'Loading…' : 'Yükleniyor…'}</p>
          ) : listItems.length === 0 ? (
            <p className="std-chat__empty">{en ? 'No products' : 'Ürün yok'}</p>
          ) : (
            <ul className="std-chat__list">
              {listItems.map((p) => (
                <li key={p.productId}>
                  <StandartChatRow product={p} swipeEnabled={cartOn} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* PC bento board */}
      <div className="std-home__desktop">
        <StandartPcBoard groups={boardGroups} lang={lang} campaignSlug={campaignSlug} />
      </div>
    </div>
  );
}
