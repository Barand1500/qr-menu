import { useEffect, useRef, useState } from 'react';
import { imageUrl } from '@/lib/api';
import { gsap, prefersReducedMotion, useGSAP } from '@/lib/gsapSetup';

export type SiparisBannerItem = {
  id: number;
  imageUrl?: string | null;
  title1: string;
  title2: string;
};

const AUTO_MS = 4800;

export default function SiparisBannerCarousel({
  banners,
  campaignName,
}: {
  banners: SiparisBannerItem[];
  campaignName?: string | null;
}) {
  const rootRef = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0);
  const prevIndex = useRef(0);
  const reduced = prefersReducedMotion();

  useEffect(() => {
    if (banners.length <= 1 || reduced) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % banners.length);
    }, AUTO_MS);
    return () => window.clearInterval(id);
  }, [banners.length, reduced, index]);

  useEffect(() => {
    if (index >= banners.length) setIndex(0);
  }, [banners.length, index]);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root || banners.length === 0) return;

      const slides = root.querySelectorAll<HTMLElement>('.siparis-banner__slide');
      if (slides.length === 0) return;

      const next = slides[index];
      const prev = slides[prevIndex.current];
      const isFirstPaint = prevIndex.current === index;

      if (reduced || isFirstPaint) {
        gsap.set(slides, { autoAlpha: 0, x: 0 });
        gsap.set(next, { autoAlpha: 1, x: 0 });
        prevIndex.current = index;
        return;
      }

      const tl = gsap.timeline({
        defaults: { ease: 'power2.inOut' },
        onComplete: () => {
          prevIndex.current = index;
        },
      });

      if (prev && prev !== next) {
        tl.to(prev, { autoAlpha: 0, x: -36, duration: 0.4 }, 0);
      }
      tl.fromTo(
        next,
        { autoAlpha: 0, x: 44 },
        { autoAlpha: 1, x: 0, duration: 0.55, ease: 'power3.out' },
        0.08
      );

      const copy = next.querySelector('.siparis-banner__copy');
      const media = next.querySelector('.siparis-banner__media');
      if (copy) {
        tl.fromTo(
          copy,
          { y: 16, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.45, ease: 'power2.out' },
          0.12
        );
      }
      if (media) {
        tl.fromTo(
          media,
          { scale: 0.9, autoAlpha: 0.35 },
          { scale: 1, autoAlpha: 1, duration: 0.55, ease: 'power2.out' },
          0.1
        );
      }
    },
    { scope: rootRef, dependencies: [index, banners.length, reduced] }
  );

  if (banners.length === 0) return null;

  return (
    <section className="siparis-banner" ref={rootRef} aria-label="Kampanya" aria-roledescription="carousel">
      <div className="siparis-banner__viewport">
        {banners.map((banner, i) => (
          <div
            key={banner.id}
            className={`siparis-banner__slide${i === index ? ' is-active' : ''}`}
            aria-hidden={i !== index}
          >
            <div className="siparis-banner__copy">
              {campaignName ? (
                <span className="siparis-banner__badge">{campaignName}</span>
              ) : null}
              <h2>
                {banner.title1}
                {banner.title2 ? (
                  <>
                    <br />
                    {banner.title2}
                  </>
                ) : null}
              </h2>
            </div>
            {banner.imageUrl ? (
              <div className="siparis-banner__media">
                <img src={imageUrl(banner.imageUrl)} alt="" />
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {banners.length > 1 ? (
        <div className="siparis-banner__dots" role="tablist" aria-label="Banner">
          {banners.map((b, i) => (
            <button
              key={b.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              className={`siparis-banner__dot${i === index ? ' is-active' : ''}`}
              onClick={() => setIndex(i)}
              aria-label={`Banner ${i + 1}`}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
