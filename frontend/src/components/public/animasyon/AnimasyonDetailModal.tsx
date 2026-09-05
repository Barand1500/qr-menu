import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Flame, Plus, Star, X } from 'lucide-react';
import { formatMoney, imageUrl } from '@/lib/api';
import MenuMediaPlaceholder from '@/components/public/MenuMediaPlaceholder';
import { useSiparisCart } from '@/hooks/useSiparisCart';
import { gsap, prefersReducedMotion, useGSAP } from '@/lib/gsapSetup';

export type AnimasyonProduct = {
  id: number;
  name: string;
  description?: string | null;
  ingredients?: string | null;
  allergens?: string | null;
  price: number;
  currency?: { code?: string; symbol?: string } | null;
  imageUrl?: string | null;
  images?: string[];
  calories?: number | null;
  isRecommended?: boolean;
};

export default function AnimasyonDetailModal({
  product,
  open,
  onClose,
  cartEnabled = true,
}: {
  product: AnimasyonProduct | null;
  open: boolean;
  onClose: () => void;
  cartEnabled?: boolean;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const { addItem } = useSiparisCart();
  const [imgIdx, setImgIdx] = useState(0);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    setImgIdx(0);
  }, [product?.id, open]);

  useGSAP(
    () => {
      if (!open || !overlayRef.current || !cardRef.current) return;
      if (prefersReducedMotion()) {
        gsap.set(overlayRef.current, { autoAlpha: 1 });
        gsap.set(cardRef.current, { autoAlpha: 1, y: 0, scale: 1 });
        return;
      }
      const tl = gsap.timeline();
      tl.fromTo(
        overlayRef.current,
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.35, ease: 'power2.out' }
      );
      tl.fromTo(
        cardRef.current,
        { autoAlpha: 0, y: 48, scale: 0.94 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.55, ease: 'power3.out' },
        0.05
      );
      tl.fromTo(
        '.anim-detail__reveal',
        { y: 18, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.4, stagger: 0.05, ease: 'power2.out' },
        0.18
      );
    },
    { scope: overlayRef, dependencies: [open, product?.id] }
  );

  useGSAP(
    () => {
      if (!open || !mediaRef.current) return;
      const img = mediaRef.current.querySelector('img, .menu-media-ph');
      if (!img || prefersReducedMotion()) return;
      gsap.fromTo(
        img,
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.38, ease: 'power2.out', clearProps: 'transform' }
      );
    },
    { scope: mediaRef, dependencies: [imgIdx, product?.id, open] }
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !product) return null;

  const current = product;
  const gallery =
    current.images && current.images.length > 0
      ? current.images
      : current.imageUrl
        ? [current.imageUrl]
        : [];
  const multi = gallery.length > 1;
  const activeSrc = gallery[imgIdx] || gallery[0];

  function goImg(next: number) {
    if (!multi) return;
    setImgIdx(((next % gallery.length) + gallery.length) % gallery.length);
  }

  function closeAnimated() {
    if (prefersReducedMotion() || !overlayRef.current || !cardRef.current) {
      onClose();
      return;
    }
    const tl = gsap.timeline({ onComplete: onClose });
    tl.to(cardRef.current, { y: 32, scale: 0.96, autoAlpha: 0, duration: 0.28, ease: 'power2.in' });
    tl.to(overlayRef.current, { autoAlpha: 0, duration: 0.22, ease: 'power2.in' }, 0.05);
  }

  function onAdd() {
    addItem(
      {
        productId: current.id,
        name: current.name,
        price: current.price,
        currency: current.currency,
        imageUrl: current.imageUrl,
        calories: current.calories,
      },
      { fromEl: mediaRef.current }
    );
  }

  return (
    <div
      className="anim-detail"
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={current.name}
    >
      <button type="button" className="anim-detail__scrim" aria-label="Kapat" onClick={closeAnimated} />
      <div className="anim-detail__card anim-detail__card--stack" ref={cardRef}>
        <button type="button" className="anim-detail__close" onClick={closeAnimated} aria-label="Kapat">
          <X className="w-5 h-5" />
        </button>

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
          {activeSrc ? (
            <img src={imageUrl(activeSrc)} alt="" key={activeSrc} />
          ) : (
            <MenuMediaPlaceholder kind="product" size="hero" label={current.name} />
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
          <header className="anim-detail__head anim-detail__reveal">
            <h2>{current.name}</h2>
            <p className="anim-detail__price">{formatMoney(current.price, current.currency)}</p>
          </header>

          {(current.isRecommended || (current.calories != null && current.calories > 0)) && (
            <div className="anim-detail__chips anim-detail__reveal">
              {current.isRecommended ? (
                <span>
                  <Star className="w-3.5 h-3.5" fill="currentColor" /> Önerilen
                </span>
              ) : null}
              {current.calories != null && current.calories > 0 ? (
                <span>
                  <Flame className="w-3.5 h-3.5" /> {current.calories} kcal
                </span>
              ) : null}
            </div>
          )}

          {current.description ? (
            <p className="anim-detail__text anim-detail__reveal">{current.description}</p>
          ) : null}

          {current.ingredients ? (
            <section className="anim-detail__block anim-detail__reveal">
              <h3>İçindekiler</h3>
              <p>{current.ingredients}</p>
            </section>
          ) : null}

          {current.allergens ? (
            <section className="anim-detail__block anim-detail__reveal">
              <h3>Alerjenler</h3>
              <p>{current.allergens}</p>
            </section>
          ) : null}

          {cartEnabled ? (
            <button type="button" className="anim-detail__add anim-detail__reveal" onClick={onAdd}>
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              Sepete ekle
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
