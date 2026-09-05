import { Link } from 'react-router-dom';
import { useRef } from 'react';
import { ArrowLeft, Clock, Plus } from 'lucide-react';
import { formatMoney, imageUrl } from '@/lib/api';
import { menuProductPath } from '@/lib/menuPaths';
import ProductImageGallery, {
  ProductGalleryThumbs,
  useProductGalleryIndex,
} from '@/components/public/ProductImageGallery';
import MenuMediaPlaceholder from '@/components/public/MenuMediaPlaceholder';
import MenuColorModeToggle from '@/components/public/MenuColorModeToggle';
import TableServiceButtons from '@/components/public/TableServiceButtons';
import SiparisCartButton from '@/components/public/siparis/SiparisCartButton';
import SiparisKcal from '@/components/public/siparis/SiparisKcal';
import { useSiparisCart } from '@/hooks/useSiparisCart';
import type { MenuColorMode } from '@/lib/menuColorMode';

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
  menuFeatures?: { tableService?: boolean };
};

type RelatedProduct = {
  id: number;
  name: string;
  price: number;
  currency?: { code?: string; symbol?: string } | null;
  imageUrl?: string | null;
};

export default function SiparisProductPage({
  product,
  related,
  galleryImages,
  colorMode,
  toggleColorMode,
  lang,
  slug,
  onBack,
}: {
  product: ProductDetail;
  related: RelatedProduct[];
  galleryImages: string[];
  colorMode: MenuColorMode;
  toggleColorMode: () => void;
  lang: string;
  slug: string | null | undefined;
  onBack: () => void;
}) {
  const { addItem, setSheetOpen } = useSiparisCart();
  const { index, setIndex } = useProductGalleryIndex(galleryImages.length);
  const mediaRef = useRef<HTMLDivElement>(null);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const en = (lang || 'tr').split('-')[0] === 'en';
  const tableServiceOn = product.menuFeatures?.tableService !== false;

  function add() {
    addItem(
      {
        productId: product.id,
        name: product.name,
        price: product.price,
        currency: product.currency,
        imageUrl: product.imageUrl ?? galleryImages[0] ?? null,
        calories: product.calories ?? null,
      },
      { fromEl: mediaRef.current || addBtnRef.current }
    );
  }

  function addAndOpen() {
    add();
    window.setTimeout(() => setSheetOpen(true), 380);
  }

  return (
    <div className="siparis-detail">
      <div className="siparis-detail__topbar">
        <button type="button" className="siparis-detail__back" onClick={onBack} aria-label="Geri">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <p className="siparis-detail__brand">{product.restaurant.name}</p>
        <div className="siparis-detail__top-actions">
          <SiparisCartButton alwaysShow />
          <MenuColorModeToggle colorMode={colorMode} onToggle={toggleColorMode} />
          <TableServiceButtons lang={lang} slug={slug} enabled={tableServiceOn} />
        </div>
      </div>

      <div className="siparis-detail__layout">
        <div className="siparis-detail__hero">
          {galleryImages.length > 0 ? (
            <>
              <div className="siparis-detail__media" ref={mediaRef}>
                <ProductImageGallery
                  images={galleryImages}
                  index={index}
                  onIndexChange={setIndex}
                  alt={product.name}
                />
              </div>
              {galleryImages.length > 1 ? (
                <ProductGalleryThumbs
                  images={galleryImages}
                  alt={product.name}
                  index={index}
                  onSelect={setIndex}
                />
              ) : null}
            </>
          ) : (
            <div className="siparis-detail__ph">
              <MenuMediaPlaceholder kind="product" size="lg" label={product.name} />
            </div>
          )}
        </div>

        <div className="siparis-detail__body">
          <p className="siparis-detail__group">{product.group.name}</p>
          <h1>{product.name}</h1>
          <p className="siparis-detail__price">{formatMoney(product.price, product.currency)}</p>

          <div className="siparis-detail__stats">
            {product.calories != null && product.calories > 0 ? (
              <span>
                <SiparisKcal calories={product.calories} />
              </span>
            ) : null}
            {product.prepTimeMinutes != null && product.prepTimeMinutes > 0 ? (
              <span>
                <Clock className="w-4 h-4" />
                {product.prepTimeMinutes} dk
              </span>
            ) : null}
          </div>

          {product.description ? (
            <p className="siparis-detail__desc">{product.description}</p>
          ) : null}

          {product.ingredients ? (
            <div className="siparis-detail__block">
              <h2>{en ? 'Ingredients' : 'İçindekiler'}</h2>
              <p>{product.ingredients}</p>
            </div>
          ) : null}

          {product.allergens ? (
            <div className="siparis-detail__block siparis-detail__block--warn">
              <h2>{en ? 'Allergens' : 'Alerjenler'}</h2>
              <p>{product.allergens}</p>
            </div>
          ) : null}

          <div className="siparis-detail__actions">
            <button ref={addBtnRef} type="button" className="siparis-detail__add" onClick={add}>
              <Plus className="w-5 h-5" />
              {en ? 'Add to cart' : 'Sepete ekle'}
            </button>
            <button type="button" className="siparis-detail__add siparis-detail__add--ghost" onClick={addAndOpen}>
              {en ? 'Add & view cart' : 'Ekle ve sepete git'}
            </button>
          </div>

          {related.length > 0 ? (
            <section className="siparis-detail__related">
              <h2>{en ? 'You may also like' : 'Bunlar da olabilir'}</h2>
              <div className="siparis-detail__related-grid">
                {related.map((r) => (
                  <Link key={r.id} to={menuProductPath(r.id)} className="siparis-detail__related-card">
                    {r.imageUrl ? (
                      <img src={imageUrl(r.imageUrl)} alt="" />
                    ) : (
                      <MenuMediaPlaceholder kind="product" size="sm" label={r.name} />
                    )}
                    <span>{r.name}</span>
                    <strong>{formatMoney(r.price, r.currency)}</strong>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
