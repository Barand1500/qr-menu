import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  Cake,
  Cherry,
  Coffee,
  Heart,
  Leaf,
  Sparkles,
  Star,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';
import { api, formatMoney, imageUrl } from '@/lib/api';
import { useMenuSlug } from '@/hooks/useMenuSlug';
import MenuMediaPlaceholder from '@/components/public/MenuMediaPlaceholder';
import {
  parseLinearThemeConfig,
  type LinearFeatureIcon,
} from '@/lib/menuLinearConfig';
import { gsap, prefersReducedMotion, useGSAP } from '@/lib/gsapSetup';

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
  features?: {
    linear?: unknown;
  };
};

type ListProduct = {
  id: number;
  name: string;
  description?: string;
  price: number;
  currency?: { code?: string; symbol?: string } | null;
  imageUrl?: string | null;
};

type DetailProduct = ListProduct & {
  ingredients?: string;
  allergens?: string;
};

const ICON_MAP: Record<LinearFeatureIcon, LucideIcon> = {
  leaf: Leaf,
  heart: Heart,
  cake: Cake,
  strawberry: Cherry,
  sparkles: Sparkles,
  coffee: Coffee,
  star: Star,
  utensils: UtensilsCrossed,
};

export default function LinearHome({
  menu,
  allergyBanner,
  lang,
  campaignSlug,
  initialGroupId,
}: {
  menu: MenuData;
  allergyBanner?: ReactNode;
  lang: string;
  campaignSlug?: string;
  initialGroupId?: number | null;
  displayShowcase?: unknown;
  displayStories?: unknown;
  popularProducts?: unknown;
}) {
  const { slug } = useMenuSlug();
  const rootRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLElement>(null);
  const listLayerRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const animBusy = useRef(false);
  const openIndexRef = useRef(0);
  const pendingAnim = useRef<'open' | null>(null);
  const skipListIntro = useRef(false);
  const tlRef = useRef<ReturnType<typeof gsap.timeline> | null>(null);

  const config = parseLinearThemeConfig(
    menu.features?.linear ? JSON.stringify(menu.features.linear) : null
  );

  const [groupId, setGroupId] = useState<number | null>(
    initialGroupId ?? menu.groups[0]?.id ?? null
  );
  const [products, setProducts] = useState<ListProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<DetailProduct | null>(null);

  const activeGroup = menu.groups.find((g) => g.id === groupId) || null;
  const { contextSafe } = useGSAP({ scope: rootRef });

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
    setDetail(null);
    tlRef.current?.kill();
    animBusy.current = false;
    pendingAnim.current = null;
    const params = new URLSearchParams({ lang });
    if (campaignSlug) params.set('kampanya', campaignSlug);
    api<{
      products: ListProduct[];
      children?: { id: number; name: string; products: ListProduct[] }[];
    }>(`/api/menu/${slug}/groups/${groupId}/products?${params}`)
      .then((data) => {
        if (cancelled) return;
        const childItems = (data.children || []).flatMap((c) => c.products);
        setProducts([...(data.products || []), ...childItems]);
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

  useGSAP(
    () => {
      if (prefersReducedMotion() || detail || loading) return;
      if (skipListIntro.current) {
        skipListIntro.current = false;
        return;
      }
      gsap.from('.linear-item', {
        opacity: 0,
        y: 18,
        duration: 0.42,
        stagger: 0.05,
        ease: 'power2.out',
        clearProps: 'transform',
      });
    },
    { scope: rootRef, dependencies: [products.length, groupId, loading] }
  );

  function enrichDetail(product: ListProduct) {
    if (!slug) return;
    const params = new URLSearchParams({ lang });
    if (campaignSlug) params.set('kampanya', campaignSlug);
    api<DetailProduct>(`/api/menu/${slug}/products/${product.id}?${params}`)
      .then((full) => {
        setDetail((prev) =>
          prev && prev.id === product.id ? { ...prev, ...full } : prev
        );
      })
      .catch(() => undefined);
  }

  useLayoutEffect(() => {
    if (!detail || pendingAnim.current !== 'open') return;
    pendingAnim.current = null;

    const panel = detailRef.current;
    const listLayer = listLayerRef.current;
    const index = openIndexRef.current;

    if (!panel) {
      animBusy.current = false;
      return;
    }

    if (prefersReducedMotion()) {
      gsap.set(panel, { autoAlpha: 1 });
      if (listLayer) gsap.set(listLayer, { autoAlpha: 0, pointerEvents: 'none' });
      animBusy.current = false;
      return;
    }

    gsap.set(panel, { autoAlpha: 0 });
    gsap.set(panel.querySelector('.linear-detail__back'), { autoAlpha: 0, y: -8 });
    gsap.set(panel.querySelector('.linear-detail__plate'), {
      autoAlpha: 0,
      y: 36,
      scale: 0.78,
    });
    gsap.set(panel.querySelectorAll('.linear-detail__copy > *'), {
      autoAlpha: 0,
      y: 16,
    });

    const items = Array.from(
      railRef.current?.querySelectorAll<HTMLElement>('.linear-item') || []
    );
    const current = items[index];
    const above = items.slice(0, index);
    const below = items.slice(index + 1);
    const plate = current?.querySelector('.linear-item__plate');
    const body = current?.querySelector('.linear-item__body');
    const aside = listLayer?.querySelector('.linear-aside');
    const cats = listLayer?.querySelector('.linear-cats');

    const tl = gsap.timeline({
      defaults: { ease: 'power2.inOut' },
      onComplete: () => {
        if (listLayer) gsap.set(listLayer, { pointerEvents: 'none' });
        animBusy.current = false;
      },
    });
    tlRef.current = tl;

    // Liste çıkışı
    if (cats) tl.to(cats, { autoAlpha: 0, y: -8, duration: 0.26 }, 0);
    if (aside) tl.to(aside, { autoAlpha: 0, x: -16, duration: 0.3 }, 0);
    if (above.length) {
      tl.to(
        above,
        {
          y: -64,
          autoAlpha: 0,
          duration: 0.32,
          stagger: { each: 0.04, from: 'end' },
        },
        0.02
      );
    }
    if (below.length) {
      tl.to(
        below,
        { y: 72, autoAlpha: 0, duration: 0.34, stagger: 0.04 },
        0.03
      );
    }
    if (body) tl.to(body, { x: 48, autoAlpha: 0, duration: 0.26 }, 0.04);
    if (plate) {
      tl.to(
        plate,
        { y: -28, scale: 1.18, duration: 0.38, ease: 'power2.inOut' },
        0.05
      );
    }
    if (current) tl.to(current, { autoAlpha: 0, duration: 0.16 }, 0.32);

    // Detay girişi — liste bitmeden başlar, boş flaş olmaz
    tl.to(panel, { autoAlpha: 1, duration: 0.2, ease: 'power1.out' }, 0.28);
    tl.to(
      panel.querySelector('.linear-detail__back'),
      { autoAlpha: 1, y: 0, duration: 0.28, ease: 'power2.out' },
      0.3
    );
    tl.to(
      panel.querySelector('.linear-detail__plate'),
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.46, ease: 'power3.out' },
      0.3
    );
    tl.to(
      panel.querySelectorAll('.linear-detail__copy > *'),
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.34,
        stagger: 0.045,
        ease: 'power2.out',
      },
      0.4
    );
  }, [detail]);

  const openDetail = contextSafe((product: ListProduct, index: number) => {
    if (animBusy.current || detail) return;
    animBusy.current = true;
    openIndexRef.current = index;
    tlRef.current?.kill();
    enrichDetail(product);
    pendingAnim.current = 'open';
    setDetail(product);
  });

  const closeDetail = contextSafe(() => {
    if (animBusy.current || !detail) return;
    animBusy.current = true;
    tlRef.current?.kill();

    const index = openIndexRef.current;
    const panel = detailRef.current;
    const listLayer = listLayerRef.current;

    const finishClose = () => {
      skipListIntro.current = true;
      setDetail(null);
      requestAnimationFrame(() => {
        const items = Array.from(
          railRef.current?.querySelectorAll<HTMLElement>('.linear-item') || []
        );
        const current = items[index];
        const above = items.slice(0, index);
        const below = items.slice(index + 1);
        const plate = current?.querySelector('.linear-item__plate');
        const body = current?.querySelector('.linear-item__body');
        const aside = listLayerRef.current?.querySelector('.linear-aside');
        const cats = listLayerRef.current?.querySelector('.linear-cats');

        if (listLayerRef.current) {
          gsap.set(listLayerRef.current, { autoAlpha: 1, pointerEvents: 'auto' });
        }

        if (prefersReducedMotion() || !railRef.current) {
          gsap.set([aside, cats, items, plate, body].flat().filter(Boolean), {
            clearProps: 'all',
          });
          animBusy.current = false;
          return;
        }

        gsap.set(above, { y: -64, autoAlpha: 0 });
        gsap.set(below, { y: 72, autoAlpha: 0 });
        if (current) gsap.set(current, { autoAlpha: 1 });
        if (plate) gsap.set(plate, { y: -24, scale: 1.12, autoAlpha: 1 });
        if (body) gsap.set(body, { x: 40, autoAlpha: 0 });
        if (aside) gsap.set(aside, { x: -16, autoAlpha: 0 });
        if (cats) gsap.set(cats, { y: -8, autoAlpha: 0 });

        const tl = gsap.timeline({
          defaults: { ease: 'power2.out' },
          onComplete: () => {
            gsap.set([aside, cats, items, plate, body].flat().filter(Boolean), {
              clearProps: 'all',
            });
            animBusy.current = false;
          },
        });
        tlRef.current = tl;

        if (cats) tl.to(cats, { autoAlpha: 1, y: 0, duration: 0.3 }, 0);
        if (aside) tl.to(aside, { autoAlpha: 1, x: 0, duration: 0.34 }, 0);
        if (plate) tl.to(plate, { y: 0, scale: 1, duration: 0.4, ease: 'power3.out' }, 0.02);
        if (body) tl.to(body, { x: 0, autoAlpha: 1, duration: 0.32 }, 0.06);
        if (above.length) {
          tl.to(above, { y: 0, autoAlpha: 1, duration: 0.36, stagger: 0.04 }, 0.05);
        }
        if (below.length) {
          tl.to(
            below,
            {
              y: 0,
              autoAlpha: 1,
              duration: 0.38,
              stagger: { each: 0.04, from: 'end' },
            },
            0.06
          );
        }
      });
    };

    if (prefersReducedMotion() || !panel) {
      finishClose();
      return;
    }

    // Liste katmanını detay çıkmadan görünür hazırla (altta)
    if (listLayer) {
      gsap.set(listLayer, { autoAlpha: 1, pointerEvents: 'none' });
    }

    const out = gsap.timeline({ onComplete: finishClose });
    tlRef.current = out;
    out.to(
      panel.querySelectorAll('.linear-detail__copy > *'),
      {
        autoAlpha: 0,
        y: 12,
        duration: 0.2,
        stagger: { each: 0.025, from: 'end' },
        ease: 'power2.in',
      },
      0
    );
    out.to(
      panel.querySelector('.linear-detail__plate'),
      { autoAlpha: 0, y: 22, scale: 0.88, duration: 0.28, ease: 'power2.in' },
      0.03
    );
    out.to(
      panel.querySelector('.linear-detail__back'),
      { autoAlpha: 0, y: -6, duration: 0.18, ease: 'power2.in' },
      0
    );
    out.to(panel, { autoAlpha: 0, duration: 0.12 }, 0.22);
  });

  return (
    <div className={`linear-shell${detail ? ' is-detail' : ''}`} ref={rootRef}>
      <div className="linear-shell__split" aria-hidden>
        <svg
          className="linear-shell__wave"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <path
            d="M42 0 C48 8 36 16 44 28 C52 40 38 48 46 60 C54 72 40 82 48 92 C52 96 50 98 50 100 L100 100 L100 0 Z"
            fill="currentColor"
          />
        </svg>
      </div>

      {allergyBanner}

      <div className="linear-list-layer" ref={listLayerRef}>
        <nav className="linear-cats" aria-label="Kategoriler">
          {menu.groups.map((g) => (
            <button
              key={g.id}
              type="button"
              className={`linear-cats__pill${g.id === groupId ? ' is-active' : ''}`}
              onClick={() => !detail && setGroupId(g.id)}
              tabIndex={detail ? -1 : undefined}
            >
              {g.name}
            </button>
          ))}
        </nav>

        <div className="linear-stage">
          <aside className="linear-aside">
            <header className="linear-brand">
              {menu.restaurant.logoUrl ? (
                <img
                  src={imageUrl(menu.restaurant.logoUrl)}
                  alt=""
                  className="linear-brand__logo"
                />
              ) : (
                <span className="linear-brand__mark" aria-hidden>
                  {menu.restaurant.name.charAt(0)}
                </span>
              )}
              <p className="linear-brand__name">{menu.restaurant.name}</p>
              {menu.welcomeMessage ? (
                <p className="linear-brand__tag">{menu.welcomeMessage}</p>
              ) : null}
            </header>

            <div className="linear-aside__copy">
              <h1>{activeGroup?.name || config.headline}</h1>
              <p>{config.subhead}</p>
            </div>

            <ul className="linear-features">
              {config.features.map((f, i) => {
                const Icon = ICON_MAP[f.icon] || Leaf;
                return (
                  <li key={`${f.icon}-${i}`}>
                    <span className="linear-features__icon" aria-hidden>
                      <Icon strokeWidth={1.6} />
                    </span>
                    <span>{f.text}</span>
                  </li>
                );
              })}
            </ul>
          </aside>

          <section
            className="linear-rail"
            ref={railRef}
            aria-label={activeGroup?.name || 'Ürünler'}
          >
            {loading ? (
              <p className="linear-rail__empty">Yükleniyor…</p>
            ) : products.length === 0 ? (
              <p className="linear-rail__empty">Bu kategoride ürün yok</p>
            ) : (
              products.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  className={`linear-item${i % 2 === 1 ? ' linear-item--shift' : ''}`}
                  onClick={() => openDetail(p, i)}
                  disabled={Boolean(detail)}
                >
                  <div className="linear-item__plate">
                    {p.imageUrl ? (
                      <img src={imageUrl(p.imageUrl)} alt="" draggable={false} />
                    ) : (
                      <MenuMediaPlaceholder kind="product" size="lg" label={p.name} />
                    )}
                  </div>
                  <div className="linear-item__body">
                    <h2>{p.name}</h2>
                    {p.description ? <p>{p.description}</p> : null}
                    <strong>{formatMoney(p.price, p.currency)}</strong>
                  </div>
                </button>
              ))
            )}
          </section>
        </div>
      </div>

      {detail ? (
        <div className="linear-detail" ref={detailRef}>
          <button
            type="button"
            className="linear-detail__back"
            onClick={closeDetail}
            aria-label="Geri"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="linear-detail__plate">
            {detail.imageUrl ? (
              <img src={imageUrl(detail.imageUrl)} alt="" />
            ) : (
              <MenuMediaPlaceholder kind="product" size="hero" label={detail.name} />
            )}
          </div>

          <div className="linear-detail__copy">
            <p className="linear-detail__group">{activeGroup?.name || 'Menü'}</p>
            <h1>{detail.name}</h1>
            <strong>{formatMoney(detail.price, detail.currency)}</strong>
            {detail.description ? <p className="linear-detail__text">{detail.description}</p> : null}
            {detail.ingredients ? (
              <section className="linear-detail__block">
                <h2>İçindekiler</h2>
                <p>{detail.ingredients}</p>
              </section>
            ) : null}
            {detail.allergens ? (
              <section className="linear-detail__block">
                <h2>Alerjenler</h2>
                <p>{detail.allergens}</p>
              </section>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
