import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { api, formatMoney, imageUrl } from '@/lib/api';
import { useMenuSlug } from '@/hooks/useMenuSlug';
import MenuMediaPlaceholder from '@/components/public/MenuMediaPlaceholder';
import AnimasyonDetailModal, {
  type AnimasyonProduct,
} from '@/components/public/animasyon/AnimasyonDetailModal';
import { useSiparisCart } from '@/hooks/useSiparisCart';
import { gsap, prefersReducedMotion, useGSAP } from '@/lib/gsapSetup';
import type { PopularProduct } from '@/components/public/PopularSearchProducts';

type MenuGroup = {
  id: number;
  name: string;
  imageUrl?: string | null;
  children?: { id: number; name: string }[];
};

type MenuData = {
  restaurant: { name: string; logoUrl?: string | null };
  welcomeMessage: string;
  groups: MenuGroup[];
  campaign?: { name: string } | null;
};

type ListProduct = {
  id: number;
  name: string;
  description?: string;
  price: number;
  currency?: { code?: string; symbol?: string } | null;
  imageUrl?: string | null;
  calories?: number | null;
  isRecommended?: boolean;
  allergens?: string | null;
};

function bgWord(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return parts.slice(0, 2).join(' ').toUpperCase();
  return name.slice(0, 18).toUpperCase();
}

export default function AnimasyonHome({
  menu,
  popularProducts,
  allergyBanner,
  lang,
  campaignSlug,
  initialGroupId,
  cartEnabled = true,
  variantsEnabled = true,
}: {
  menu: MenuData;
  popularProducts: PopularProduct[];
  allergyBanner?: ReactNode;
  lang: string;
  campaignSlug?: string;
  initialGroupId?: number | null;
  displayShowcase?: unknown;
  displayStories?: unknown;
  cartEnabled?: boolean;
  variantsEnabled?: boolean;
}) {
  const { slug } = useMenuSlug();
  const { addItem } = useSiparisCart();
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const catsRef = useRef<HTMLElement>(null);
  const touchX = useRef<number | null>(null);
  const tweenRef = useRef<ReturnType<typeof gsap.timeline> | null>(null);

  const [groupId, setGroupId] = useState<number | null>(
    initialGroupId ?? menu.groups[0]?.id ?? null
  );
  const [products, setProducts] = useState<ListProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [index, setIndex] = useState(0);
  const [detail, setDetail] = useState<AnimasyonProduct | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const indexRef = useRef(0);

  const activeGroup = menu.groups.find((g) => g.id === groupId) || null;
  const active = products[index] || null;

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    if (initialGroupId != null) setGroupId(initialGroupId);
  }, [initialGroupId]);

  useEffect(() => {
    if (groupId == null || !slug) {
      setProducts([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ lang });
    if (campaignSlug) params.set('kampanya', campaignSlug);
    api<{
      products: ListProduct[];
      children?: { id: number; name: string; products: ListProduct[] }[];
    }>(`/api/menu/${slug}/groups/${groupId}/products?${params}`)
      .then((data) => {
        if (cancelled) return;
        const childItems = (data.children || []).flatMap((c) => c.products);
        const merged = [...(data.products || []), ...childItems];
        setProducts(merged);
        setIndex(0);
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [groupId, slug, lang, campaignSlug]);

  useEffect(() => {
    if (loading) return;
    if (products.length > 0) return;
    if (popularProducts.length === 0) return;
    if (groupId != null) return;
    setProducts(
      popularProducts.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        currency: p.currency,
        imageUrl: p.imageUrl,
        calories: p.calories,
      }))
    );
  }, [loading, products.length, popularProducts, groupId]);

  useEffect(() => {
    const el = catsRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
      if (el.scrollWidth <= el.clientWidth + 4) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [menu.groups.length]);

  /** Peek rail — aktif ortada, yanlar yarı görünür */
  useGSAP(
    () => {
      const stage = stageRef.current;
      const track = trackRef.current;
      if (!stage || !track || products.length === 0) return;

      const cards = Array.from(track.querySelectorAll<HTMLElement>('.anim-rail__card'));
      const activeCard = cards[index];
      if (!activeCard) return;

      const targetX = stage.clientWidth / 2 - (activeCard.offsetLeft + activeCard.offsetWidth / 2);
      const reduced = prefersReducedMotion();
      tweenRef.current?.kill();

      if (reduced) {
        gsap.set(track, { x: targetX });
        cards.forEach((card, i) => {
          const on = i === index;
          gsap.set(card, { scale: on ? 1 : 0.78, autoAlpha: on ? 1 : 0.5 });
        });
        gsap.set('.anim-stage__bgword', { autoAlpha: 0.1, x: 0 });
        gsap.set('.anim-stage__copy', { autoAlpha: 1, y: 0, clearProps: 'transform' });
        return;
      }

      const tl = gsap.timeline({
        defaults: { ease: 'power3.out' },
      });
      tweenRef.current = tl;

      tl.to(track, { x: targetX, duration: 0.62 }, 0);
      cards.forEach((card, i) => {
        const dist = Math.abs(i - index);
        const on = dist === 0;
        tl.to(
          card,
          {
            scale: on ? 1 : dist === 1 ? 0.78 : 0.7,
            autoAlpha: on ? 1 : dist === 1 ? 0.52 : 0.28,
            duration: 0.55,
          },
          0
        );
      });

      const bg = stage.querySelector('.anim-stage__bgword');
      if (bg) {
        tl.fromTo(
          bg,
          { autoAlpha: 0.04, x: 28 },
          { autoAlpha: 0.1, x: 0, duration: 0.55 },
          0.05
        );
      }

      const copy = stage.querySelector('.anim-stage__copy');
      if (copy) {
        tl.fromTo(
          copy,
          { autoAlpha: 0, y: 14 },
          { autoAlpha: 1, y: 0, duration: 0.42, clearProps: 'transform' },
          0.18
        );
      }
    },
    { scope: stageRef, dependencies: [index, products.length, loading] }
  );

  useGSAP(
    () => {
      if (prefersReducedMotion() || !rootRef.current) return;
      gsap.from('.anim-cats__pill', {
        autoAlpha: 0,
        y: 8,
        duration: 0.35,
        stagger: 0.03,
        ease: 'power2.out',
        clearProps: 'transform',
      });
    },
    { scope: rootRef, dependencies: [menu.groups.length] }
  );

  useEffect(() => {
    const onResize = () => {
      const stage = stageRef.current;
      const track = trackRef.current;
      if (!stage || !track) return;
      const card = track.querySelectorAll<HTMLElement>('.anim-rail__card')[index];
      if (!card) return;
      const targetX = stage.clientWidth / 2 - (card.offsetLeft + card.offsetWidth / 2);
      gsap.set(track, { x: targetX });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [index, products.length]);

  function go(next: number) {
    if (products.length === 0) return;
    const n = ((next % products.length) + products.length) % products.length;
    if (n === indexRef.current) return;
    setIndex(n);
  }

  async function openDetail(p: ListProduct) {
    setDetailOpen(true);
    setDetail({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      currency: p.currency,
      imageUrl: p.imageUrl,
      calories: p.calories,
      isRecommended: p.isRecommended,
      allergens: p.allergens,
    });
    if (!slug) return;
    try {
      const params = new URLSearchParams({ lang });
      if (campaignSlug) params.set('kampanya', campaignSlug);
      const full = await api<{
        id: number;
        name: string;
        description: string;
        ingredients: string;
        allergens: string;
        price: number;
        currency?: { code?: string; symbol?: string } | null;
        imageUrl?: string | null;
        images?: string[];
        calories?: number | null;
        isRecommended?: boolean;
        optionGroups?: AnimasyonProduct['optionGroups'];
      }>(`/api/menu/${slug}/products/${p.id}?${params}`);
      setDetail({
        id: full.id,
        name: full.name,
        description: full.description,
        ingredients: full.ingredients,
        allergens: full.allergens,
        price: full.price,
        currency: full.currency,
        imageUrl: full.imageUrl,
        images: full.images,
        calories: full.calories,
        isRecommended: full.isRecommended,
        optionGroups: full.optionGroups,
      });
    } catch {
      /* keep list payload */
    }
  }

  function onAddQuick(p: ListProduct, el: HTMLElement | null) {
    addItem(
      {
        productId: p.id,
        name: p.name,
        price: p.price,
        currency: p.currency,
        imageUrl: p.imageUrl,
        calories: p.calories,
      },
      { fromEl: el }
    );
  }

  function selectGroup(id: number) {
    setGroupId(id);
    const pill = catsRef.current?.querySelector(`.anim-cats__pill[data-gid="${id}"]`);
    pill?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  return (
    <div className="anim-shell" ref={rootRef}>
      {allergyBanner}

      <header className="anim-top">
        <div className="anim-top__brand">
          <span className="anim-top__rule" aria-hidden />
          <p>{menu.restaurant.name}</p>
          <span className="anim-top__rule" aria-hidden />
        </div>
      </header>

      <div className="anim-cats-wrap">
        <nav className="anim-cats" aria-label="Kategoriler" ref={catsRef}>
          {menu.groups.map((g) => (
            <button
              key={g.id}
              type="button"
              data-gid={g.id}
              className={`anim-cats__pill${g.id === groupId ? ' is-active' : ''}`}
              onClick={() => selectGroup(g.id)}
            >
              {g.name}
            </button>
          ))}
        </nav>
      </div>

      <div
        className="anim-stage"
        ref={stageRef}
        onTouchStart={(e) => {
          touchX.current = e.changedTouches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          if (touchX.current == null) return;
          const x = e.changedTouches[0]?.clientX ?? touchX.current;
          const dx = x - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) < 40) return;
          go(index + (dx < 0 ? 1 : -1));
        }}
      >
        {loading ? (
          <p className="anim-stage__empty">Yükleniyor…</p>
        ) : !active ? (
          <p className="anim-stage__empty">Bu kategoride ürün yok</p>
        ) : (
          <>
            <div className="anim-stage__bgword" aria-hidden>
              {bgWord(active.name)}
            </div>

            <p className="anim-stage__eyebrow">{activeGroup?.name || 'Menü'}</p>

            <div className="anim-rail" aria-roledescription="carousel">
              <div className="anim-rail__track" ref={trackRef}>
                {products.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`anim-rail__card${i === index ? ' is-active' : ' is-side'}`}
                    onClick={() => {
                      if (i === index) openDetail(p);
                      else go(i);
                    }}
                    aria-label={p.name}
                    aria-current={i === index ? 'true' : undefined}
                  >
                    <div className="anim-rail__media">
                      {p.imageUrl ? (
                        <img src={imageUrl(p.imageUrl)} alt="" draggable={false} />
                      ) : (
                        <MenuMediaPlaceholder kind="product" size="hero" label={p.name} />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="anim-stage__copy" key={`copy-${active.id}`}>
              <h1>{active.name}</h1>
              {active.description ? <p>{active.description}</p> : null}
              <strong>{formatMoney(active.price, active.currency)}</strong>
            </div>

            <div className="anim-stage__pager" role="tablist" aria-label="Ürünler">
              {products.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  className={`anim-stage__dot${i === index ? ' is-active' : ''}`}
                  onClick={() => go(i)}
                  aria-label={p.name}
                />
              ))}
            </div>

            <div className="anim-stage__actions">
              <button
                type="button"
                className="anim-stage__nav"
                aria-label="Önceki"
                onClick={() => go(index - 1)}
                disabled={products.length < 2}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button type="button" className="anim-stage__cta" onClick={() => openDetail(active)}>
                Keşfet
              </button>
              <button
                type="button"
                className="anim-stage__nav"
                aria-label="Sonraki"
                onClick={() => go(index + 1)}
                disabled={products.length < 2}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <button
              type="button"
              className="anim-stage__quick-add"
              onClick={(e) => {
                const media = stageRef.current?.querySelector(
                  '.anim-rail__card.is-active .anim-rail__media'
                ) as HTMLElement | null;
                onAddQuick(active, media || e.currentTarget);
              }}
              aria-label="Sepete ekle"
              hidden={!cartEnabled}
            >
              <Plus className="w-5 h-5" strokeWidth={2.5} />
            </button>
          </>
        )}
      </div>

      <AnimasyonDetailModal
        product={detail}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        cartEnabled={cartEnabled}
        variantsEnabled={variantsEnabled}
      />
    </div>
  );
}
