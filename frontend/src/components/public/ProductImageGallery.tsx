import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { imageUrl } from '@/lib/api';
import MenuMediaPlaceholder from '@/components/public/MenuMediaPlaceholder';

interface ProductImageGalleryProps {
  images: string[];
  alt: string;
  index: number;
  onIndexChange: (index: number) => void;
}

interface ProductGalleryThumbsProps {
  images: string[];
  alt: string;
  index: number;
  onSelect: (index: number) => void;
  className?: string;
  layout?: 'vertical' | 'horizontal';
}

export function ProductGalleryThumbs({
  images,
  alt,
  index,
  onSelect,
  className = '',
  layout = 'horizontal',
}: ProductGalleryThumbsProps) {
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const active = strip.querySelector<HTMLElement>('.public-product-gallery__thumb.is-active');
    active?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [index, layout]);

  if (images.length <= 1) return null;

  return (
    <div
      ref={stripRef}
      className={`public-product-gallery__thumbs public-product-gallery__thumbs--${layout} ${className}`.trim()}
      role="tablist"
      aria-label="Ürün görselleri"
    >
      {images.map((src, i) => (
        <button
          key={`thumb-${i}`}
          type="button"
          role="tab"
          aria-selected={i === index}
          aria-label={`Görsel ${i + 1}`}
          className={`public-product-gallery__thumb ${i === index ? 'is-active' : ''}`}
          onClick={() => onSelect(i)}
        >
          <img src={imageUrl(src)} alt={i === 0 ? alt : `${alt} ${i + 1}`} draggable={false} />
        </button>
      ))}
    </div>
  );
}

export default function ProductImageGallery({
  images,
  alt,
  index,
  onIndexChange,
}: ProductImageGalleryProps) {
  const slides = images.length > 0 ? images : [];
  const touchStartX = useRef(0);

  function go(delta: number) {
    if (slides.length <= 1) return;
    const next = (index + delta + slides.length) % slides.length;
    onIndexChange(next);
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? 0;
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (slides.length <= 1) return;
    const endX = e.changedTouches[0]?.clientX ?? 0;
    const diff = touchStartX.current - endX;
    if (Math.abs(diff) < 40) return;
    go(diff > 0 ? 1 : -1);
  }

  if (slides.length === 0) {
    return (
      <div className="public-product-hero__placeholder">
        <MenuMediaPlaceholder kind="product" size="hero" label={alt} />
      </div>
    );
  }

  const showNav = slides.length > 1;

  return (
    <div
      className="public-product-gallery"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {showNav && (
        <>
          <button
            type="button"
            className="public-product-gallery__nav public-product-gallery__nav--prev"
            onClick={() => go(-1)}
            aria-label="Önceki görsel"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            className="public-product-gallery__nav public-product-gallery__nav--next"
            onClick={() => go(1)}
            aria-label="Sonraki görsel"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      <div className="public-product-gallery__stage">
        {slides.map((src, i) => (
          <img
            key={`slide-${i}`}
            src={imageUrl(src)}
            alt={i === 0 ? alt : `${alt} ${i + 1}`}
            className={`public-product-gallery__slide ${i === index ? 'is-visible' : ''}`}
            draggable={false}
            aria-hidden={i !== index}
          />
        ))}
      </div>
    </div>
  );
}

export function useProductGalleryIndex(imageCount: number) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [imageCount]);

  return { index, setIndex };
}