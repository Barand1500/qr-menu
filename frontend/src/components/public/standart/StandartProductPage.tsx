import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, ShoppingBag } from 'lucide-react';
import { formatMoney, imageUrl } from '@/lib/api';
import TableServiceButtons from '@/components/public/TableServiceButtons';
import SadeProductOptions from '@/components/public/sade/SadeProductOptions';
import { menuGroupPath, menuProductPath } from '@/lib/menuPaths';
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
  group: { id: number; name: string };
  menuFeatures?: {
    tableService?: boolean;
    standartCart?: boolean;
    standartVariants?: boolean;
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

export default function StandartProductPage({
  product,
  related,
  galleryImages,
  lang,
  slug,
  onBack,
}: {
  product: Product;
  related: Related[];
  galleryImages: string[];
  lang: string;
  slug: string | null;
  onBack: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const multi = galleryImages.length > 1;
  const activeImg = galleryImages[activeIdx] || galleryImages[0];
  const variantsOn = product.menuFeatures?.standartVariants !== false;
  const cartEnabled = product.menuFeatures?.standartCart !== false;
  const optionGroups = variantsOn ? product.optionGroups || [] : [];
  const { addItem, setSheetOpen, enabled: cartCtxOn, count } = useSiparisCart();
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
    setActiveIdx(0);
    setUnitPrice(product.price);
    setOptionLabel('');
  }, [product.id, product.price]);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.from('.std-detail__reveal', {
        opacity: 0,
        y: 14,
        duration: 0.5,
        stagger: 0.07,
        ease: 'power2.out',
        clearProps: 'transform',
      });
    },
    { scope: rootRef, dependencies: [product.id] }
  );

  function onAdd() {
    const name = optionLabel ? `${product.name} (${optionLabel})` : product.name;
    addItem(
      {
        productId: product.id,
        name,
        price: optionGroups.length ? unitPrice : product.price,
        currency: product.currency,
        imageUrl: galleryImages[0] || product.imageUrl || null,
        calories: product.calories ?? null,
      },
      { qty: 1, fromEl: mediaRef.current || addBtnRef.current }
    );
    // Uçuş görünsün diye sheet’i geciktir
    window.setTimeout(() => setSheetOpen(true), 780);
  }

  const heroSrc = activeImg || product.imageUrl || null;

  return (
    <div className={`std-detail${showCart ? ' std-detail--cart' : ''}`} ref={rootRef}>
      <div className="std-detail__top">
        <button type="button" onClick={onBack} className="std-detail__back" aria-label="Geri">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="std-detail__top-actions">
          <TableServiceButtons
            lang={lang}
            slug={slug}
            enabled={product.menuFeatures?.tableService !== false}
          />
          {showCart ? (
            <button
              type="button"
              className="std-detail__cart-btn"
              data-siparis-cart-target
              onClick={() => setSheetOpen(true)}
              aria-label="Sepet"
            >
              <ShoppingBag className="w-5 h-5" />
              {count > 0 ? (
                <span className="std-detail__cart-badge">{count > 99 ? '99+' : count}</span>
              ) : null}
            </button>
          ) : null}
        </div>
      </div>

      <main className="std-detail__main">
        <div className="std-detail__media std-detail__reveal" ref={mediaRef}>
          {heroSrc ? (
            <div className="std-detail__hero">
              <img src={imageUrl(heroSrc)} alt="" key={heroSrc} />
            </div>
          ) : (
            <div className="std-detail__hero std-detail__hero--empty" />
          )}
          {multi ? (
            <div className="std-detail__thumbs" role="tablist" aria-label="Görseller">
              {galleryImages.map((src, i) => (
                <button
                  key={`${src}-${i}`}
                  type="button"
                  role="tab"
                  aria-selected={i === activeIdx}
                  className={`std-detail__thumb${i === activeIdx ? ' is-active' : ''}`}
                  onClick={() => setActiveIdx(i)}
                >
                  <img src={imageUrl(src)} alt="" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="std-detail__info">
          <p className="std-detail__group std-detail__reveal">{product.group.name}</p>
          <h1 className="std-detail__title std-detail__reveal">{product.name}</h1>
          <p className="std-detail__price std-detail__reveal">
            {formatMoney(optionGroups.length ? unitPrice : product.price, product.currency)}
          </p>

          {product.description ? (
            <p className="std-detail__text std-detail__reveal">{product.description}</p>
          ) : null}

          {optionGroups.length > 0 ? (
            <div className="std-detail__opts std-detail__reveal">
              <SadeProductOptions
                key={product.id}
                groups={optionGroups}
                basePrice={product.price}
                currency={product.currency}
                onChange={onOptionsChange}
              />
            </div>
          ) : null}

          {product.ingredients ? (
            <section className="std-detail__block std-detail__reveal">
              <h2>İçindekiler</h2>
              <p>{product.ingredients}</p>
            </section>
          ) : null}

          {product.allergens ? (
            <section className="std-detail__block std-detail__reveal">
              <h2>Alerjenler</h2>
              <p>{product.allergens}</p>
            </section>
          ) : null}

          {related.length > 0 ? (
            <section className="std-detail__related std-detail__reveal">
              <h2>Benzer</h2>
              <ul>
                {related.slice(0, 6).map((item) => (
                  <li key={item.id}>
                    <Link to={menuProductPath(item.id)} className="std-detail__related-row">
                      <span>{item.name}</span>
                      <span>{formatMoney(item.price, item.currency)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link to={menuGroupPath(product.group.id)} className="std-detail__more">
                Tüm {product.group.name}
              </Link>
            </section>
          ) : null}

          {showCart ? (
            <div className="std-detail__footer std-detail__footer--inline">
              <button
                ref={addBtnRef}
                type="button"
                className="std-detail__add"
                onClick={onAdd}
              >
                <Plus className="w-4 h-4" strokeWidth={2.5} />
                Sepete ekle ·{' '}
                {formatMoney(optionGroups.length ? unitPrice : product.price, product.currency)}
              </button>
            </div>
          ) : null}
        </div>
      </main>

      {showCart ? (
        <div className="std-detail__footer std-detail__footer--mobile">
          <button
            type="button"
            className="std-detail__add"
            onClick={onAdd}
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            Sepete ekle ·{' '}
            {formatMoney(optionGroups.length ? unitPrice : product.price, product.currency)}
          </button>
        </div>
      ) : null}
    </div>
  );
}
