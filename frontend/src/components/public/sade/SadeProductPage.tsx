import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import { formatMoney, imageUrl } from '@/lib/api';
import MenuColorModeToggle from '@/components/public/MenuColorModeToggle';
import TableServiceButtons from '@/components/public/TableServiceButtons';
import SadeProductOptions from '@/components/public/sade/SadeProductOptions';
import { menuGroupPath, menuProductPath } from '@/lib/menuPaths';
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
    sadeCart?: boolean;
    sadeVariants?: boolean;
  };
  optionGroups?: ProductOptionGroup[];
  imageUrl?: string | null;
  images?: string[];
};

type Related = {
  id: number;
  name: string;
  price: number;
  currency?: { code?: string; symbol?: string } | null;
  imageUrl?: string | null;
};

export default function SadeProductPage({
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
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const multi = galleryImages.length > 1;
  const activeImg = galleryImages[activeIdx] || galleryImages[0];
  const variantsOn = product.menuFeatures?.sadeVariants !== false;
  const cartEnabled = product.menuFeatures?.sadeCart === true;
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
    setActiveIdx(0);
    setUnitPrice(product.price);
    setOptionLabel('');
  }, [product.id, product.price]);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.from('.sade-detail__reveal', {
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
      { qty: 1, fromEl: addBtnRef.current }
    );
    setSheetOpen(true);
  }

  return (
    <div className={`sade-detail${showCart ? ' sade-detail--cart' : ''}`} ref={rootRef}>
      <div className="sade-detail__top">
        <button type="button" onClick={onBack} className="sade-detail__back" aria-label="Geri">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="sade-detail__top-actions">
          <MenuColorModeToggle colorMode={colorMode} onToggle={toggleColorMode} />
          <TableServiceButtons
            lang={lang}
            slug={slug}
            enabled={product.menuFeatures?.tableService !== false}
          />
        </div>
      </div>

      <main className={`sade-detail__main${multi ? ' sade-detail__main--gallery' : ''}`}>
        <p className="sade-detail__group sade-detail__reveal">{product.group.name}</p>
        <h1 className="sade-detail__title sade-detail__reveal">{product.name}</h1>
        <p className="sade-detail__price sade-detail__reveal">
          {formatMoney(optionGroups.length ? unitPrice : product.price, product.currency)}
          {optionGroups.length > 0 ? (
            <span className="sade-detail__price-hint">seçime göre</span>
          ) : null}
        </p>

        {galleryImages.length > 0 ? (
          <div className="sade-detail__gallery sade-detail__reveal">
            <div className="sade-detail__gallery-mobile">
              <div className="sade-detail__photo">
                <img src={imageUrl(activeImg)} alt="" key={activeImg} />
              </div>
              {multi ? (
                <div className="sade-detail__thumbs" role="tablist" aria-label="Görseller">
                  {galleryImages.map((src, i) => (
                    <button
                      key={`${src}-${i}`}
                      type="button"
                      role="tab"
                      aria-selected={i === activeIdx}
                      className={`sade-detail__thumb${i === activeIdx ? ' is-active' : ''}`}
                      onClick={() => setActiveIdx(i)}
                    >
                      <img src={imageUrl(src)} alt="" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {multi ? (
              <div className="sade-detail__gallery-desktop" aria-label="Görseller">
                {galleryImages.map((src, i) => (
                  <div key={`${src}-${i}`} className="sade-detail__photo sade-detail__photo--tile">
                    <img src={imageUrl(src)} alt="" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="sade-detail__gallery-desktop sade-detail__gallery-desktop--single">
                <div className="sade-detail__photo">
                  <img src={imageUrl(galleryImages[0])} alt="" />
                </div>
              </div>
            )}
          </div>
        ) : null}

        {product.description ? (
          <p className="sade-detail__text sade-detail__reveal">{product.description}</p>
        ) : null}

        {optionGroups.length > 0 ? (
          <SadeProductOptions
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
            className="sade-detail__add sade-detail__reveal"
            onClick={onAdd}
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            Sepete ekle · {formatMoney(optionGroups.length ? unitPrice : product.price, product.currency)}
          </button>
        ) : null}

        {product.ingredients ? (
          <section className="sade-detail__block sade-detail__reveal">
            <h2>İçindekiler</h2>
            <p>{product.ingredients}</p>
          </section>
        ) : null}

        {product.allergens ? (
          <section className="sade-detail__block sade-detail__reveal">
            <h2>Alerjenler</h2>
            <p>{product.allergens}</p>
          </section>
        ) : null}

        {(product.prepTimeMinutes || product.calories) && (
          <p className="sade-detail__meta sade-detail__reveal">
            {product.prepTimeMinutes != null && product.prepTimeMinutes > 0
              ? `${product.prepTimeMinutes} dk`
              : null}
            {product.prepTimeMinutes && product.calories ? ' · ' : null}
            {product.calories != null && product.calories > 0 ? `${product.calories} kcal` : null}
          </p>
        )}

        {related.length > 0 && (
          <section className="sade-detail__related sade-detail__reveal">
            <h2>Benzer</h2>
            <ul>
              {related.slice(0, 6).map((item) => (
                <li key={item.id}>
                  <Link to={menuProductPath(item.id)} className="sade-detail__related-row">
                    <span>{item.name}</span>
                    <span>{formatMoney(item.price, item.currency)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link to={menuGroupPath(product.group.id)} className="sade-detail__more">
              Tüm {product.group.name}
            </Link>
          </section>
        )}
      </main>
    </div>
  );
}
