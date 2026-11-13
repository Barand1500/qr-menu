import { useEffect, useRef, useState } from 'react';
import { imageUrl } from '@/lib/api';

/** Derive contours and pencil shading from the actual photo, keeping identical registration. */
export default function SketchPhoto({ src, name }: { src?: string | null; name: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && node.getBoundingClientRect().width > 0) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '180px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setReady(false);
    setFailed(false);
    if (
      !src ||
      !visible ||
      !host.current?.ownerDocument.defaultView?.matchMedia(
        '(min-width: 1024px) and (prefers-reduced-motion: no-preference)',
      ).matches
    )
      return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled || !canvas.current) return;
      try {
        const c = canvas.current,
          scale = Math.min(1, Math.min(640 / img.naturalWidth, 640 / img.naturalHeight));
        c.width = Math.round(img.naturalWidth * scale);
        c.height = Math.round(img.naturalHeight * scale);
        const ctx = c.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, c.width, c.height);
        const data = ctx.getImageData(0, 0, c.width, c.height),
          pixels = data.data;
        const gray = new Float32Array(c.width * c.height);
        for (let i = 0; i < gray.length; i++)
          gray[i] = pixels[i * 4] * 0.299 + pixels[i * 4 + 1] * 0.587 + pixels[i * 4 + 2] * 0.114;
        for (let y = 1; y < c.height - 1; y++)
          for (let x = 1; x < c.width - 1; x++) {
            const i = y * c.width + x,
              w = c.width;
            const gx =
              -gray[i - w - 1] +
              gray[i - w + 1] -
              2 * gray[i - 1] +
              2 * gray[i + 1] -
              gray[i + w - 1] +
              gray[i + w + 1];
            const gy =
              -gray[i - w - 1] -
              2 * gray[i - w] -
              gray[i - w + 1] +
              gray[i + w - 1] +
              2 * gray[i + w] +
              gray[i + w + 1];
            const edge = Math.min(130, Math.hypot(gx, gy) * 0.48);
            const shade = (255 - gray[i]) * 0.18,
              hatch = (x + y) % 7 < 2 ? shade * 0.8 : 0;
            const tone = Math.max(35, 248 - edge - shade - hatch);
            pixels[i * 4] = tone;
            pixels[i * 4 + 1] = tone * 0.975;
            pixels[i * 4 + 2] = tone * 0.93;
          }
        ctx.putImageData(data, 0, 0);
        setReady(true);
      } catch {
        /* CORS or canvas unavailable: original photo remains usable. */
      }
    };
    img.src = src.startsWith('blob:') ? src : imageUrl(src);
    return () => {
      cancelled = true;
      img.onload = null;
    };
  }, [src, visible]);
  return (
    <div ref={host} className={`atelier-photo${ready ? ' has-sketch' : ''}`}>
      {src && !failed ? (
        <>
          <canvas ref={canvas} aria-hidden="true" />
          <img
            src={src.startsWith('blob:') ? src : imageUrl(src)}
            alt={name}
            loading="lazy"
            onError={() => setFailed(true)}
          />
        </>
      ) : (
        <span className="atelier-photo__missing">{name}</span>
      )}
    </div>
  );
}
