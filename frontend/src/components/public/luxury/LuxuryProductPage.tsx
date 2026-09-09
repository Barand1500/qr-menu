import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Flame, Plus, Star } from 'lucide-react';
import { formatMoney, imageUrl } from '@/lib/api';
import MenuColorModeToggle from '@/components/public/MenuColorModeToggle';
import TableServiceButtons from '@/components/public/TableServiceButtons';
import MenuMediaPlaceholder from '@/components/public/MenuMediaPlaceholder';
import LuxuryProductOptions from '@/components/public/luxury/LuxuryProductOptions';
import { menuProductPath } from '@/lib/menuPaths';
import type { MenuColorMode } from '@/lib/menuColorMode';
import type { ProductOptionGroup, SelectionMap } from '@/lib/productOptions';
import { useSiparisCart } from '@/hooks/useSiparisCart';
import { gsap, prefersReducedMotion, useGSAP } from '@/lib/gsapSetup';

type Product = {
  id: number;
  name: string;
  description: string;
  ingredients: string;
  allergens: string;
  price: number;
  currency?: { code?: string; symbol?: string } | null;
  prepTimeMinutes?: number | null;
  calories?: number | null;
  isRecommended?: boolean;
  features: string[];
  group: { id: number; name: string };
  restaurant: { name: string };
  menuFeatures?: {
    tableService?: boolean;
    luxuryCart?: boolean;
    luxuryVariants?: boolean;
  };
  optionGroups?: ProductOptionGroup[];
  imageUrl?: string | null;
};

type Related = {
  id: number;
  name: string;
  price: number;
  currency?: { code?: string; symbol?: string } | null;
  imageUrl?: string | null;
};

export default function LuxuryProductPage({
  product,
  related,
  galleryImages,
  colorMode,
  toggleColorMode,
  lang,
  slug,
  onBack,
}: {
  product: Product;
  related: Related[];
  galleryImages: string[];
  colorMode: MenuColorMode;
  toggleColorMode: () => void;
  lang: string;
  slug: string | null;
  onBack: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const [imgIdx, setImgIdx] = useState(0);
  const touchX = useRef<number | null>(null);
  const gallery = galleryImages.length > 0 ? galleryImages : [];
  const multi = gallery.length > 1;
  const hero = gallery[imgIdx] || gallery[0];
  const variantsOn = product.menuFeatures?.luxuryVariants !== false;
  const cartEnabled = product.menuFeatures?.luxuryCart === true;
  const optionGroups = variantsOn ? product.optionGroups || [] : [];
  const { addItem, setSheetOpen, enabled: cartCtxOn } = useSiparisCart();
  const showCart = cartEnabled && cartCtxOn;

  const [unitPrice, setUnitPrice] = useState(product.price);
  const [optionLabel, setOptionLabel] = useState('');

  const onOptionsChange = useCallback(
    (next: { unitPrice: number; selections: SelectionMap; label: string }) => {
      setUnitPrice(next.unitPrice);
      setOptionLabel(next.label);
    },
    []
  );

  useEffect(() => {
    setImgIdx(0);
    setUnitPrice(product.price);
    setOptionLabel('');
  }, [product.id, product.price]);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.from('.lux-detail__reveal', {
        autoAlpha: 0,
        y: 18,
        duration: 0.55,
        stagger: 0.07,
        ease: 'power2.out',
        clearProps: 'transform',
      });
    },
    { scope: rootRef, dependencies: [product.id] }
  );

  useGSAP(
    () => {
      if (!mediaRef.current || prefersReducedMotion()) return;
      const img = mediaRef.current.querySelector('img, .menu-media-ph');
      if (!img) return;
      gsap.fromTo(
        img,
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.4, ease: 'power2.out' }
      );
    },
    { scope: mediaRef, dependencies: [imgIdx, product.id] }
  );

  function goImg(next: number) {
    if (!multi) return;
    setImgIdx(((next % gallery.length) + gallery.length) % gallery.length);
  }

  function onAdd() {
    const name = optionLabel ? `${product.name} (${optionLabel})` : product.name;
    addItem(
      {
        productId: product.id,
        name,
        price: optionGroups.length ? unitPrice : product.price,
        currency: product.currency,
        imageUrl: gallery[0] || product.imageUrl || null,
        calories: product.calories ?? null,
      },
      { qty: 1, fromEl: addBtnRef.current }
    );
    setSheetOpen(true);
  }

  return (
    <div className={`lux-detail${showCart ? ' lux-detail--cart' : ''}`} ref={rootRef}>
      <div className="lux-detail__bar lux-detail__reveal">
        <button type="button" className="lux-detail__back" onClick={onBack} aria-label="Geri">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="lux-detail__bar-actions">
          <MenuColorModeToggle colorMode={colorMode} onToggle={toggleColorMode} />
          <TableServiceButtons
            lang={lang}
            slug={slug}
            enabled={product.menuFeatures?.tableService !== false}
          />
        </div>
      </div>

      <div className="lux-detail__layout">
        <div
          className="lux-detail__media lux-detail__reveal"
          ref={mediaRef}
          onTouchStart={(e) => {
            touchX.current = e.changedTouches[0]?.clientX ?? null;
          }}
          onTouchEnd={(e) => {
            if (touchX.current == null || !multi) return;
            const x = e.changedTouches[0]?.clientX ?? touchX.current;
            const dx = x - touchX.current;
            touchX.current = null;
            if (Math.abs(dx) < 40) return;
            goImg(imgIdx + (dx < 0 ? 1 : -1));
          }}
        >
          {hero ? (
            <img src={imageUrl(hero)} alt="" key={hero} />
          ) : (
            <MenuMediaPlaceholder kind="product" size="hero" label={product.name} />
          )}

          {multi ? (
            <>
              <button
                type="button"
                className="lux-detail__nav lux-detail__nav--prev"
                aria-label="Önceki görsel"
                onClick={() => goImg(imgIdx - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="lux-detail__nav lux-detail__nav--next"
                aria-label="Sonraki görsel"
                onClick={() => goImg(imgIdx + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <div className="lux-detail__dots" aria-hidden>
                {gallery.map((_, i) => (
                  <span key={i} className={i === imgIdx ? 'is-active' : ''} />
                ))}
              </div>
            </>
          ) : null}
        </div>

        <div className="lux-detail__copy">
          <span className="luxury-rule lux-detail__reveal" aria-hidden />

          <p className="luxury-eyebrow lux-detail__reveal">{product.group.name}</p>
          <h1 className="lux-detail__title lux-detail__reveal">{product.name}</h1>
          <p className="lux-detail__price lux-detail__reveal">
            {formatMoney(optionGroups.length ? unitPrice : product.price, product.currency)}
            {optionGroups.length > 0 ? (
              <span className="lux-detail__price-hint">seçime göre</span>
            ) : null}
          </p>

          {(product.isRecommended || (product.calories != null && product.calories > 0)) && (
            <div className="lux-detail__meta lux-detail__reveal">
              {product.isRecommended ? (
                <span>
                  <Star className="w-3.5 h-3.5" fill="currentColor" /> Önerilen
                </span>
              ) : null}
              {product.calories != null && product.calories > 0 ? (
                <span>
                  <Flame className="w-3.5 h-3.5" /> {product.calories} kcal
                </span>
              ) : null}
            </div>
          )}

          {product.description ? (
            <p className="lux-detail__desc lux-detail__reveal">{product.description}</p>
          ) : null}

          {optionGroups.length > 0 ? (
            <LuxuryProductOptions
              key={product.id}
              groups={optionGroups}
              basePrice={product.price}
              currency={product.currency}
              onChange={onOptionsChange}
            />
          ) : null}

          {showCart ? (
            <button
              ref={addBtnRef}
              type="button"
              className="lux-detail__add lux-detail__reveal"
              onClick={onAdd}
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              Sepete ekle ·{' '}
              {formatMoney(optionGroups.length ? unitPrice : product.price, product.currency)}
            </button>
          ) : null}

          {product.ingredients ? (
            <section className="lux-detail__block lux-detail__reveal">
              <h2>İçindekiler</h2>
              <span className="luxury-rule" aria-hidden />
              <p>{product.ingredients}</p>
            </section>
          ) : null}

          {product.allergens ? (
            <section className="lux-detail__block lux-detail__reveal">
              <h2>Alerjenler</h2>
              <span className="luxury-rule" aria-hidden />
              <p>{product.allergens}</p>
            </section>
          ) : null}
        </div>
      </div>

      {related.length > 0 ? (
        <section className="lux-detail__related lux-detail__reveal" aria-label="Benzer">
          <div className="lux-detail__related-head">
            <p className="luxury-eyebrow">Benzer</p>
            <h2>Seçimler</h2>
            <span className="luxury-rule" aria-hidden />
          </div>
          <div className="lux-detail__related-track">
            {related.map((item) => (
              <Link
                key={item.id}
                to={menuProductPath(item.id)}
                className="lux-detail__related-item"
              >
                <div className="lux-detail__related-media">
                  {item.imageUrl ? (
                    <img src={imageUrl(item.imageUrl)} alt="" />
                  ) : (
                    <MenuMediaPlaceholder kind="product" size="sm" label={item.name} />
                  )}
                </div>
                <strong>{item.name}</strong>
                <span>{formatMoney(item.price, item.currency)}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
