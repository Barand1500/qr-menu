import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  Flame,
  Leaf,
  AlertTriangle,
  UtensilsCrossed,
  Sparkles,
  ChevronRight,
  Star,
} from 'lucide-react';
import { api, formatMoney, getSessionId, imageUrl } from '@/lib/api';
import { useDemoData } from '@/contexts/DemoDataContext';
import { getDemoProductDetail } from '@/lib/demoData';
import ProductImageGallery, {
  ProductGalleryThumbs,
  useProductGalleryIndex,
} from '@/components/public/ProductImageGallery';
import BrushPanel from '@/components/public/BrushPanel';
import { useMenuSlug } from '@/hooks/useMenuSlug';
import { usePublicRtl } from '@/hooks/usePublicRtl';
import { menuGroupPath, menuProductPath } from '@/lib/menuPaths';
import { useEffect, useState } from 'react';

interface ProductDetail {
  id: number;
  name: string;
  description: string;
  ingredients: string;
  allergens: string;
  price: number;
  currency?: { code?: string; symbol?: string } | null;
  imageUrl?: string | null;
  images?: string[];
  prepTimeMinutes?: number | null;
  calories?: number | null;
  isRecommended?: boolean;
  features: string[];
  group: { id: number; name: string };
  restaurant: { name: string; slug: string; logoUrl?: string | null };
}

interface RelatedProduct {
  id: number;
  name: string;
  price: number;
  currency?: { code?: string; symbol?: string } | null;
  imageUrl?: string | null;
}

export default function PublicProductPage() {
  const { productId } = useParams();
  const { slug } = useMenuSlug();
  const navigate = useNavigate();
  const { demoEnabled } = useDemoData();
  const [lang] = useState(() => localStorage.getItem('menu_lang') || 'tr');
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [related, setRelated] = useState<RelatedProduct[]>([]);
  const sessionId = getSessionId();
  const campaignSlug =
    (typeof sessionStorage !== 'undefined'
      ? sessionStorage.getItem('menu_kampanya')
      : null) || '';

  usePublicRtl(lang);

  useEffect(() => {
    if (!slug || !productId) return;
    if (demoEnabled) {
      setProduct(getDemoProductDetail(Number(productId), lang));
      return;
    }
    const params = new URLSearchParams({ lang, sessionId });
    if (campaignSlug) params.set('kampanya', campaignSlug);
    api<ProductDetail>(`/api/menu/${slug}/products/${productId}?${params}`).then(setProduct);
  }, [slug, productId, lang, sessionId, demoEnabled, campaignSlug]);

  useEffect(() => {
    if (!product || !slug) return;

    if (demoEnabled) {
      api<{ products: RelatedProduct[] }>(
        `/api/menu/${slug}/groups/${product.group.id}/products?lang=${lang}&sessionId=${sessionId}`
      )
        .then((data) => {
          setRelated(
            data.products.filter((p) => p.id !== product.id).slice(0, 8)
          );
        })
        .catch(() => setRelated([]));
      return;
    }

    const params = new URLSearchParams({ lang, sessionId });
    if (campaignSlug) params.set('kampanya', campaignSlug);
    api<{ products: RelatedProduct[] }>(
      `/api/menu/${slug}/groups/${product.group.id}/products?${params}`
    ).then((data) => {
      setRelated(data.products.filter((p) => p.id !== product.id).slice(0, 8));
    });
  }, [product, slug, lang, sessionId, demoEnabled, campaignSlug]);

  const galleryImageCount = product
    ? product.images && product.images.length > 0
      ? product.images.length
      : product.imageUrl
        ? 1
        : 0
    : 0;
  const { index: galleryIndex, setIndex: setGalleryIndex } =
    useProductGalleryIndex(galleryImageCount);

  if (!product) {
    return (
      <div className="public-menu-page min-h-screen flex items-center justify-center">
        <div className="w-9 h-9 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const galleryImages =
    product.images && product.images.length > 0
      ? product.images
      : product.imageUrl
        ? [product.imageUrl]
        : [];

  const hasMultipleImages = galleryImages.length > 1;
  const hasTags = product.isRecommended || product.features.length > 0;
  const hasStats =
    (product.prepTimeMinutes != null && product.prepTimeMinutes > 0) ||
    (product.calories != null && product.calories > 0);

  return (
    <div className="public-menu-page public-product-page">
      <header className="public-product-hero">
        <ProductImageGallery
          images={galleryImages}
          alt={product.name}
          index={galleryIndex}
          onIndexChange={setGalleryIndex}
        />
        <div className="public-product-hero__shade" />
        <div className="public-product-hero__glow" aria-hidden />

        <div className="public-product-hero__top">
          <button
            type="button"
            onClick={() => navigate(menuGroupPath(product.group.id))}
            className="public-product-hero__back"
            aria-label="Geri"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>

        <div className="public-product-hero__bottom">
          <span className="public-product-hero__chip">{product.group.name}</span>
          <h1 className="public-product-hero__title">{product.name}</h1>
          <p className="public-product-hero__price">{formatMoney(product.price, product.currency)}</p>
        </div>
      </header>

      <div className="public-product-sheet">
        <div className="public-product-sheet__handle" aria-hidden />

        {hasMultipleImages && (
          <ProductGalleryThumbs
            images={galleryImages}
            alt={product.name}
            index={galleryIndex}
            onSelect={setGalleryIndex}
            layout="horizontal"
            className="public-product-gallery__thumbs--mobile"
          />
        )}

          <div className="public-product-scene">
          <div className="public-product-scene__orb public-product-scene__orb--1" aria-hidden />
          <div className="public-product-scene__orb public-product-scene__orb--2" aria-hidden />
          <div className="public-product-scene__orb public-product-scene__orb--3" aria-hidden />

          <main className="public-product-body">
            {product.restaurant.name && (
              <p className="public-product-brand">
                <Star className="w-3.5 h-3.5" />
                {product.restaurant.name}
              </p>
            )}

            {hasTags && (
              <div className="public-product-tags public-product-reveal">
                {product.isRecommended && (
                  <span className="public-product-tag public-product-tag--hot">
                    <Flame className="w-3.5 h-3.5" />
                    Önerilen
                  </span>
                )}
                {product.features.map((f) => (
                  <span key={f} className="public-product-tag">
                    <Sparkles className="w-3.5 h-3.5" />
                    {f}
                  </span>
                ))}
              </div>
            )}

            {hasStats && (
              <div className="public-product-stats public-product-reveal public-product-reveal--1">
                {product.prepTimeMinutes != null && product.prepTimeMinutes > 0 && (
                  <div className="public-product-stat">
                    <span className="public-product-stat__icon">
                      <Clock className="w-4 h-4" />
                    </span>
                    <span className="public-product-stat__label">Hazırlık</span>
                    <span className="public-product-stat__value">{product.prepTimeMinutes} dk</span>
                  </div>
                )}
                {product.calories != null && product.calories > 0 && (
                  <div className="public-product-stat">
                    <span className="public-product-stat__icon public-product-stat__icon--green">
                      <Leaf className="w-4 h-4" />
                    </span>
                    <span className="public-product-stat__label">Kalori</span>
                    <span className="public-product-stat__value">{product.calories} kcal</span>
                  </div>
                )}
              </div>
            )}

            <div className="public-product-content-layout">
              {hasMultipleImages && (
                <ProductGalleryThumbs
                  images={galleryImages}
                  alt={product.name}
                  index={galleryIndex}
                  onSelect={setGalleryIndex}
                  layout="vertical"
                  className="public-product-gallery__thumbs--desktop"
                />
              )}

              <div className="public-product-content">
              {product.description && (
                <section className="public-product-reveal public-product-reveal--2">
                  <h2 className="public-product-section-label">Açıklama</h2>
                  <BrushPanel className="public-product-panel">
                    <p className="public-product-panel__lead">{product.description}</p>
                  </BrushPanel>
                </section>
              )}

              {product.ingredients && (
                <section className="public-product-reveal public-product-reveal--3">
                  <h2 className="public-product-section-label public-product-section-label--warm">
                    <span className="public-product-section-label__row">
                      <UtensilsCrossed className="w-3.5 h-3.5" />
                      İçindekiler
                    </span>
                  </h2>
                  <BrushPanel tone="warm" className="public-product-panel">
                    <p className="public-product-panel__text">{product.ingredients}</p>
                  </BrushPanel>
                </section>
              )}

              {product.allergens && (
                <section className="public-product-reveal public-product-reveal--4">
                  <h2 className="public-product-section-label public-product-section-label--warn">
                    <span className="public-product-section-label__row">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Alerjenler
                    </span>
                  </h2>
                  <BrushPanel tone="warn" className="public-product-panel">
                    <p className="public-product-panel__text">{product.allergens}</p>
                  </BrushPanel>
                </section>
              )}
              </div>
            </div>

            {related.length > 0 && (
              <section className="public-product-related public-product-reveal public-product-reveal--5">
                <div className="public-product-related__head">
                  <h2 className="public-product-section-label public-product-related__title">
                    Benzer lezzetler
                  </h2>
                  <Link
                    to={menuGroupPath(product.group.id)}
                    className="public-product-related__more"
                  >
                    Tümünü gör
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
                <div className="public-product-related__scroll">
                  {related.map((item) => (
                    <Link
                      key={item.id}
                      to={menuProductPath(item.id)}
                      className="public-product-related__card"
                    >
                      {item.imageUrl ? (
                        <img
                          src={imageUrl(item.imageUrl)}
                          alt=""
                          className="public-product-related__img"
                          loading="lazy"
                        />
                      ) : (
                        <div className="public-product-related__img public-product-related__img--empty" />
                      )}
                      <div className="public-product-related__info">
                        <p className="public-product-related__name">{item.name}</p>
                        <p className="public-product-related__price">{formatMoney(item.price, item.currency)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <footer className="public-product-footer public-product-reveal public-product-reveal--6">
              <Link
                to={menuGroupPath(product.group.id)}
                className="public-product-footer__btn"
              >
                <ArrowLeft className="w-4 h-4" />
                {product.group.name} kategorisine dön
              </Link>
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}
