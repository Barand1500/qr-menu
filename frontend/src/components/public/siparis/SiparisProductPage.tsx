import MenuShareButton from '../share/MenuShareButton';
import { publicMenuShareUrl } from '@/lib/menuShare';
import { Link } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Clock, Plus, UtensilsCrossed } from 'lucide-react';
import { formatMoney, imageUrl } from '@/lib/api';
import { menuProductPath } from '@/lib/menuPaths';
import ProductImageGallery, { useProductGalleryIndex } from '@/components/public/ProductImageGallery';
import MenuMediaPlaceholder from '@/components/public/MenuMediaPlaceholder';
import MenuColorModeToggle from '@/components/public/MenuColorModeToggle';
import TableServiceButtons from '@/components/public/TableServiceButtons';
import SiparisCartButton from '@/components/public/siparis/SiparisCartButton';
import SiparisKcal from '@/components/public/siparis/SiparisKcal';
import IngredientCard from '@/components/public/siparis/IngredientCard';
import PlateProductPage from '@/components/public/plate/PlateProductPage';
import SiparisProductOptions from '@/components/public/siparis/SiparisProductOptions';
import { useSiparisCart } from '@/hooks/useSiparisCart';
import type { MenuColorMode } from '@/lib/menuColorMode';
import type { ProductOptionGroup, SelectionMap } from '@/lib/productOptions';
import './siparis-product.css';

type ProductDetail = {
  id: number;
  name: string;
  description: string;
  ingredients?: string;
  allergens?: string;
  price: number;
  currency?: { code?: string; symbol?: string } | null;
  imageUrl?: string | null;
  prepTimeMinutes?: number | null;
  calories?: number | null;
  isRecommended?: boolean;
  features: string[];
  group: { id: number; name: string };
  restaurant: { name: string };
  menuFeatures?: {
    tableService?: boolean;
    siparisCart?: boolean;
    siparisVariants?: boolean;
    plateView?: boolean;
  };
  optionGroups?: ProductOptionGroup[];
  soldOut?: boolean;
  stockQty?: number | null;
};

type RelatedProduct = {
  id: number;
  name: string;
  price: number;
  currency?: { code?: string; symbol?: string } | null;
  imageUrl?: string | null;
};

/**
 * Ürün detayı (Sofra ve Sipariş temaları). Görsel kenardan kenara tam kaplar; başlık görselin
 * üstünde durur, içerik kartı kaydırdıkça görselin üzerine çıkar. Sepet işlemi altta sabit çubukta.
 */
function ClassicProductPage({
  product,
  related,
  galleryImages,
  colorMode,
  toggleColorMode,
  lang,
  slug,
  onBack,
  hideColorToggle = false,
}: {
  product: ProductDetail;
  related: RelatedProduct[];
  galleryImages: string[];
  colorMode: MenuColorMode;
  toggleColorMode: () => void;
  lang: string;
  slug: string | null | undefined;
  onBack: () => void;
  hideColorToggle?: boolean;
}) {
  const { addItem, enabled: cartCtxOn } = useSiparisCart();
  const { index, setIndex } = useProductGalleryIndex(galleryImages.length);
  const mediaRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const [solid, setSolid] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const addedTimer = useRef<number | undefined>(undefined);
  const [added, setAdded] = useState(false);
  const en = (lang || 'tr').split('-')[0] === 'en';
  const tableServiceOn = product.menuFeatures?.tableService !== false;
  const variantsOn = product.menuFeatures?.siparisVariants !== false;
  const cartEnabled = product.menuFeatures?.siparisCart !== false;
  const showCart = cartEnabled && cartCtxOn;
  const soldOut = Boolean(product.soldOut);
  const optionGroups = variantsOn ? product.optionGroups || [] : [];
  const hasOptions = optionGroups.length > 0;

  const [unitPrice, setUnitPrice] = useState(product.price);
  const [optionLabel, setOptionLabel] = useState('');

  const onOptionsChange = useCallback(
    (next: { unitPrice: number; selections: SelectionMap; label: string }) => {
      setUnitPrice(next.unitPrice);
      setOptionLabel(next.label);
    },
    [],
  );

  useEffect(() => {
    setUnitPrice(product.price);
    setOptionLabel('');
    setAdded(false);
  }, [product.id, product.price]);

  useEffect(() => () => window.clearTimeout(addedTimer.current), []);

  // Görselin altına inince üst çubuk okunur, dolgun bir hâle geçer
  useEffect(() => {
    const onScroll = () => {
      const limit = window.innerWidth >= 1024 ? 40 : (heroRef.current?.offsetHeight ?? 400) - 110;
      setSolid(window.scrollY > limit);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  function add() {
    if (soldOut) return;
    const name = optionLabel ? `${product.name} (${optionLabel})` : product.name;
    addItem(
      {
        productId: product.id,
        name,
        price: hasOptions ? unitPrice : product.price,
        currency: product.currency,
        imageUrl: product.imageUrl ?? galleryImages[0] ?? null,
        calories: product.calories ?? null,
      },
      { fromEl: mediaRef.current || addBtnRef.current },
    );
    setAdded(true);
    window.clearTimeout(addedTimer.current);
    addedTimer.current = window.setTimeout(() => setAdded(false), 1400);
  }

  const price = formatMoney(hasOptions ? unitPrice : product.price, product.currency);
  const hasStats =
    (product.calories != null && product.calories > 0) ||
    (product.prepTimeMinutes != null && product.prepTimeMinutes > 0);

  return (
    <div className={`pd${galleryImages.length === 0 ? ' pd--no-image' : ''}${showCart ? ' pd--bar' : ''}`}>
      <header className={`pd-top${solid ? ' is-solid' : ''}`}>
        <button type="button" className="pd-glass pd-top__back" onClick={onBack} aria-label="Geri">
          <ArrowLeft size={20} />
        </button>
        <div className="pd-glass pd-top__actions">
          {hideColorToggle && (
            <MenuShareButton url={publicMenuShareUrl(menuProductPath(product.id))}
              title={`${product.restaurant.name} · ${product.name}`} lang={lang}
              label={en ? 'Share product' : 'Ürünü paylaş'} />
          )}
          {showCart ? <SiparisCartButton alwaysShow /> : null}
          {!hideColorToggle && (
            <MenuColorModeToggle colorMode={colorMode} onToggle={toggleColorMode} />
          )}
          <TableServiceButtons lang={lang} slug={slug} enabled={tableServiceOn} />
        </div>
      </header>

      <div className="pd-grid">
        <section ref={heroRef} className="pd-hero" aria-label={product.name}>
          <div className="pd-hero__media" ref={mediaRef}>
            {galleryImages.length > 0 ? (
              <ProductImageGallery
                images={galleryImages}
                index={index}
                onIndexChange={setIndex}
                alt={product.name}
              />
            ) : (
              <div className="pd-hero__ph" aria-hidden>
                <UtensilsCrossed size={64} strokeWidth={1.2} />
              </div>
            )}
          </div>
          <div className="pd-hero__shade" aria-hidden />

          {galleryImages.length > 1 ? (
            <div className="pd-dots" role="tablist" aria-label="Ürün görselleri">
              {galleryImages.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Görsel ${i + 1}`}
                  className={i === index ? 'is-active' : ''}
                  onClick={() => setIndex(i)}
                />
              ))}
            </div>
          ) : null}

          <div className="pd-hero__info">
            <p className="pd-hero__brand">{product.restaurant.name}</p>
            <p className="pd-chip">{product.group.name}</p>
            <h1>{product.name}</h1>
            <div className="pd-meta">
              {!showCart ? <strong className="pd-meta__price">{price}</strong> : null}
              {hasStats ? (
                <>
                  {product.calories != null && product.calories > 0 ? (
                    <span className="pd-pill">
                      <SiparisKcal calories={product.calories} />
                    </span>
                  ) : null}
                  {product.prepTimeMinutes != null && product.prepTimeMinutes > 0 ? (
                    <span className="pd-pill">
                      <Clock size={15} />
                      {product.prepTimeMinutes} dk
                    </span>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        </section>

        <div className="pd-sheet">
          <div className="pd-sheet__body">
            {product.description ? <p className="pd-desc">{product.description}</p> : null}

            {hasOptions ? (
              <SiparisProductOptions
                key={product.id}
                groups={optionGroups}
                basePrice={product.price}
                currency={product.currency}
                onChange={onOptionsChange}
              />
            ) : null}

            {product.ingredients || product.allergens ? (
              <div className="pd-facts">
                {product.ingredients ? <IngredientCard text={product.ingredients} kind="ingredients" en={en} /> : null}
                {product.allergens ? <IngredientCard text={product.allergens} kind="allergens" en={en} /> : null}
              </div>
            ) : null}

            {related.length > 0 ? (
              <section className="pd-related">
                <h2>{en ? 'You may also like' : 'Bunlar da olabilir'}</h2>
                <div className="pd-related__grid">
                  {related.map((r) => (
                    <Link key={r.id} to={menuProductPath(r.id)} className="pd-related__card">
                      <span className="pd-related__img">
                        {r.imageUrl ? (
                          <img src={imageUrl(r.imageUrl)} alt="" loading="lazy" />
                        ) : (
                          <MenuMediaPlaceholder kind="product" size="sm" label={r.name} />
                        )}
                      </span>
                      <span className="pd-related__name">{r.name}</span>
                      <strong>{formatMoney(r.price, r.currency)}</strong>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          {showCart ? (
            <div className="pd-bar">
              {soldOut ? (
                <p className="pd-bar__sold">{en ? 'Sold out today' : 'Bugün bitti'}</p>
              ) : (
                <>
                  <div className="pd-bar__price">
                    <small>{hasOptions ? (en ? 'By selection' : 'Seçime göre') : en ? 'Price' : 'Fiyat'}</small>
                    <strong>{price}</strong>
                  </div>
                  <button
                    ref={addBtnRef}
                    type="button"
                    className={`pd-bar__add${added ? ' is-added' : ''}`}
                    onClick={add}
                  >
                    {added ? <Check size={20} strokeWidth={2.6} /> : <Plus size={20} strokeWidth={2.4} />}
                    {added ? (en ? 'Added' : 'Eklendi') : en ? 'Add to cart' : 'Sepete ekle'}
                  </button>
                </>
              )}
            </div>
          ) : soldOut ? (
            <p className="pd-bar__sold pd-bar__sold--inline">{en ? 'Sold out today' : 'Bugün bitti'}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type PageProps = Parameters<typeof ClassicProductPage>[0];

/** Ayarlarda "Tabak görünümü" açıksa yeni sahne tasarımı, değilse klasik sayfa. */
export default function SiparisProductPage(props: PageProps) {
  if (props.product.menuFeatures?.plateView === true && props.galleryImages.length > 0) {
    return <PlateProductPage {...props} />;
  }
  return <ClassicProductPage {...props} />;
}
