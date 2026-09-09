import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Flame, Plus, Star } from 'lucide-react';
import { formatMoney, imageUrl } from '@/lib/api';
import TableServiceButtons from '@/components/public/TableServiceButtons';
import MenuMediaPlaceholder from '@/components/public/MenuMediaPlaceholder';
import AnimasyonProductOptions from '@/components/public/animasyon/AnimasyonProductOptions';
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
    animasyonCart?: boolean;
    animasyonVariants?: boolean;
  };
  optionGroups?: ProductOptionGroup[];
};

export default function AnimasyonProductPage({
  product,
  galleryImages,
  lang,
  slug,
  onBack,
}: {
  product: Product;
  related: unknown;
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
  const { addItem, setSheetOpen } = useSiparisCart();
  const cartEnabled = product.menuFeatures?.animasyonCart !== false;
  const variantsOn = product.menuFeatures?.animasyonVariants !== false;
  const optionGroups = variantsOn ? product.optionGroups || [] : [];
  const [imgIdx, setImgIdx] = useState(0);
  const [unitPrice, setUnitPrice] = useState(product.price);
  const [optionLabel, setOptionLabel] = useState('');
  const touchX = useRef<number | null>(null);
  const gallery = galleryImages.length > 0 ? galleryImages : [];
  const multi = gallery.length > 1;
  const hero = gallery[imgIdx] || gallery[0];

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
      gsap.from('.anim-page__card', {
        y: 40,
        autoAlpha: 0,
        scale: 0.96,
        duration: 0.6,
        ease: 'power3.out',
      });
      gsap.from('.anim-page__reveal', {
        y: 16,
        autoAlpha: 0,
        duration: 0.45,
        stagger: 0.06,
        ease: 'power2.out',
        delay: 0.15,
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
        { autoAlpha: 1, duration: 0.38, ease: 'power2.out', clearProps: 'transform' }
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
        imageUrl: gallery[0] || null,
        calories: product.calories,
      },
      { fromEl: addBtnRef.current || mediaRef.current }
    );
    setSheetOpen(true);
  }

  return (
    <div className="anim-page" ref={rootRef}>
      <div className="anim-page__bar">
        <button type="button" onClick={onBack} className="anim-detail__close" aria-label="Geri">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <TableServiceButtons
          lang={lang}
          slug={slug}
          enabled={product.menuFeatures?.tableService !== false}
        />
      </div>

      <div className="anim-page__card">
        <div
          className="anim-detail__media"
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
                className="anim-detail__img-nav anim-detail__img-nav--prev"
                aria-label="Önceki görsel"
                onClick={() => goImg(imgIdx - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="anim-detail__img-nav anim-detail__img-nav--next"
                aria-label="Sonraki görsel"
                onClick={() => goImg(imgIdx + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <div className="anim-detail__dots" role="tablist" aria-label="Görseller">
                {gallery.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    role="tab"
                    aria-selected={i === imgIdx}
                    className={i === imgIdx ? 'is-active' : ''}
                    onClick={() => setImgIdx(i)}
                    aria-label={`Görsel ${i + 1}`}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>
        <div className="anim-detail__body">
          <p className="anim-page__group anim-page__reveal">{product.group.name}</p>
          <h1 className="anim-page__title anim-page__reveal">{product.name}</h1>
          <p className="anim-detail__price anim-page__reveal">
            {formatMoney(optionGroups.length ? unitPrice : product.price, product.currency)}
            {optionGroups.length > 0 ? (
              <span className="anim-detail__price-hint">seçime göre</span>
            ) : null}
          </p>

          {(product.isRecommended || (product.calories != null && product.calories > 0)) && (
            <div className="anim-detail__chips anim-page__reveal">
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
            <p className="anim-detail__text anim-page__reveal">{product.description}</p>
          ) : null}

          {optionGroups.length > 0 ? (
            <AnimasyonProductOptions
              key={product.id}
              groups={optionGroups}
              basePrice={product.price}
              currency={product.currency}
              onChange={onOptionsChange}
            />
          ) : null}

          {product.ingredients ? (
            <section className="anim-detail__block anim-page__reveal">
              <h3>İçindekiler</h3>
              <p>{product.ingredients}</p>
            </section>
          ) : null}
          {product.allergens ? (
            <section className="anim-detail__block anim-page__reveal">
              <h3>Alerjenler</h3>
              <p>{product.allergens}</p>
            </section>
          ) : null}

          {cartEnabled ? (
            <button
              ref={addBtnRef}
              type="button"
              className="anim-detail__add anim-page__reveal"
              onClick={onAdd}
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              Sepete ekle
              {optionGroups.length > 0
                ? ` · ${formatMoney(unitPrice, product.currency)}`
                : ''}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
