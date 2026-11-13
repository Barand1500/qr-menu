import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/** Match the rendering document, including the theme editor's iframe. */
export default function DesktopTableSurface({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(false);
  useLayoutEffect(() => {
    const view = ref.current?.ownerDocument.defaultView;
    if (!view) return;
    const media = view.matchMedia('(min-width: 1024px)');
    const update = () => setWide(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return (
    <div ref={ref} className="table-responsive-surface" style={{ display: 'contents' }}>
      {wide ? children : fallback}
    </div>
  );
}
