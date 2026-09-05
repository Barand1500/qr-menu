import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Flame, Star } from 'lucide-react';
import { formatMoney, imageUrl } from '@/lib/api';
import MenuColorModeToggle from '@/components/public/MenuColorModeToggle';
import TableServiceButtons from '@/components/public/TableServiceButtons';
import { menuGroupPath, menuProductPath } from '@/lib/menuPaths';
import type { MenuColorMode } from '@/lib/menuColorMode';
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
  menuFeatures?: { tableService?: boolean };
};

type Related = {
  id: number;
  name: string;
  price: number;
  currency?: { code?: string; symbol?: string } | null;
  imageUrl?: string | null;
};

export default function AliveProductPage({
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
  const [activeIdx, setActiveIdx] = useState(0);
  const multi = galleryImages.length > 1;
  const activeImg = galleryImages[activeIdx] || galleryImages[0];

  useEffect(() => {
    setActiveIdx(0);
  }, [product.id]);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.from('.alive-detail__reveal', {
        opacity: 0,
        y: 16,
        duration: 0.5,
        stagger: 0.06,
        ease: 'power2.out',
        clearProps: 'transform',
      });
    },
    { scope: rootRef, dependencies: [product.id] }
  );

  return (
    <div className="alive-detail" ref={rootRef}>
      <div className="alive-detail__top">
        <button type="button" onClick={onBack} className="alive-detail__back" aria-label="Geri">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="alive-detail__top-actions">
          <MenuColorModeToggle colorMode={colorMode} onToggle={toggleColorMode} />
          <TableServiceButtons
            lang={lang}
            slug={slug}
            enabled={product.menuFeatures?.tableService !== false}
          />
        </div>
      </div>

      <main className="alive-detail__main">
        <p className="alive-detail__group alive-detail__reveal">{product.group.name}</p>
        <h1 className="alive-detail__title alive-detail__reveal">{product.name}</h1>
        <p className="alive-detail__price alive-detail__reveal">
          {formatMoney(product.price, product.currency)}
        </p>

        {(product.isRecommended ||
          (product.calories != null && product.calories > 0) ||
          (product.prepTimeMinutes != null && product.prepTimeMinutes > 0)) && (
          <div className="alive-detail__chips alive-detail__reveal">
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
            {product.prepTimeMinutes != null && product.prepTimeMinutes > 0 ? (
              <span>{product.prepTimeMinutes} dk</span>
            ) : null}
          </div>
        )}

        {galleryImages.length > 0 ? (
          <div className="alive-detail__gallery alive-detail__reveal">
            <div className="alive-detail__hero-media">
              <img src={imageUrl(activeImg)} alt="" key={activeImg} />
            </div>
            {multi ? (
              <div className="alive-detail__thumbs" role="tablist" aria-label="Görseller">
                {galleryImages.map((src, i) => (
                  <button
                    key={`${src}-${i}`}
                    type="button"
                    role="tab"
                    aria-selected={i === activeIdx}
                    className={`alive-detail__thumb${i === activeIdx ? ' is-active' : ''}`}
                    onClick={() => setActiveIdx(i)}
                  >
                    <img src={imageUrl(src)} alt="" />
                  </button>
                ))}
              </div>
            ) : null}
            {multi ? (
              <div className="alive-detail__gallery-desktop">
                {galleryImages.map((src, i) => (
                  <div key={`${src}-${i}`} className="alive-detail__tile">
                    <img src={imageUrl(src)} alt="" />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {product.description ? (
          <p className="alive-detail__text alive-detail__reveal">{product.description}</p>
        ) : null}

        {product.ingredients ? (
          <section className="alive-detail__block alive-detail__reveal">
            <h2>İçindekiler</h2>
            <p>{product.ingredients}</p>
          </section>
        ) : null}

        {product.allergens ? (
          <section className="alive-detail__block alive-detail__reveal">
            <h2>Alerjenler</h2>
            <p>{product.allergens}</p>
          </section>
        ) : null}

        {related.length > 0 ? (
          <section className="alive-detail__related alive-detail__reveal">
            <h2>Benzer</h2>
            <div className="alive-detail__related-track">
              {related.slice(0, 8).map((item) => (
                <Link key={item.id} to={menuProductPath(item.id)} className="alive-detail__related-card">
                  {item.imageUrl ? <img src={imageUrl(item.imageUrl)} alt="" /> : null}
                  <strong>{item.name}</strong>
                  <span>{formatMoney(item.price, item.currency)}</span>
                </Link>
              ))}
            </div>
            <Link to={menuGroupPath(product.group.id)} className="alive-detail__more">
              Tüm {product.group.name}
            </Link>
          </section>
        ) : null}
      </main>
    </div>
  );
}
