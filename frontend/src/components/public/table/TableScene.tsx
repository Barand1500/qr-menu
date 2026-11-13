import { useEffect, useRef, useState } from 'react';
import { RotateCcw, Utensils } from 'lucide-react';
import { imageUrl } from '@/lib/api';
import type { TableRenderer, TableItem, TableVariant } from './tableRenderer';

export interface TableSceneProps {
  lang?: string;
  variant: TableVariant;
  items: TableItem[];
  seed?: number;
  entering?: boolean;
  onActivate?: (id: number) => void;
}
export default function TableScene(props: TableSceneProps) {
  const host = useRef<HTMLDivElement>(null);
  const renderer = useRef<TableRenderer | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const [brokenPhoto, setBrokenPhoto] = useState('');
  const signature = JSON.stringify(props.items.map((p) => [p.id, p.imageUrl]));
  useEffect(() => {
    let cancelled = false;
    const node = host.current;
    if (!node) return;
    setStatus('loading');
    import('./tableRenderer')
      .then(({ createTableRenderer }) => {
        if (cancelled) return;
        try {
          const driver = createTableRenderer(node, props.variant, {
            activate: (id) => latest.current.onActivate?.(id),
            lost: () => setStatus('fallback'),
            project: (points) => {
              for (const point of points) {
                const label = node.parentElement?.querySelector<HTMLElement>(
                  `[data-table-label="${point.id}"]`
                );
                if (label) {
                  label.style.left = `${point.x}px`;
                  label.style.top = `${point.y}px`;
                  label.style.visibility = point.visible ? 'visible' : 'hidden';
                }
              }
            },
          });
          renderer.current = driver;
          driver.update(
            latest.current.items,
            latest.current.seed || 0,
            Boolean(latest.current.entering)
          );
          setStatus('ready');
        } catch {
          setStatus('fallback');
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('fallback');
      });
    return () => {
      cancelled = true;
      renderer.current?.dispose();
      renderer.current = null;
    };
  }, [props.variant]);
  useEffect(() => {
    renderer.current?.update(props.items, props.seed || 0, Boolean(props.entering));
  }, [signature, props.seed, props.entering]);
  const first = props.items[0];
  return (
    <div
      className={`table-scene table-scene--${props.variant} is-${status}`}
      data-table-renderer={status}
    >
      <div ref={host} className="table-scene__canvas" aria-hidden="true" />
      {status !== 'ready' && (
        <div className="table-scene__fallback" aria-hidden="true">
          <div className="table-scene__fallback-plate">
            {first?.imageUrl && brokenPhoto !== first.imageUrl ? (
              <img
                src={first.imageUrl.startsWith('blob:') ? first.imageUrl : imageUrl(first.imageUrl)}
                alt=""
                onError={() => setBrokenPhoto(first.imageUrl || '')}
              />
            ) : (
              <Utensils size={40} />
            )}
          </div>
        </div>
      )}
      {props.variant === 'menu' && status === 'ready' && (
        <div className="table-scene__labels">
          {props.items.slice(0, 3).map((item) => (
            <button
              key={item.id}
              type="button"
              data-table-label={item.id}
              onClick={() => props.onActivate?.(item.id)}
            >
              <strong>{item.name}</strong>
              <span>{item.meta}</span>
            </button>
          ))}
        </div>
      )}
      {status === 'ready' && props.variant === 'detail' && (
        <button
          type="button"
          className="table-scene__guide"
          title={
            props.lang?.startsWith('en')
              ? 'You can also drag to rotate'
              : 'Sürükleyerek de çevirebilirsiniz'
          }
          onClick={() => renderer.current?.turn(Math.PI / 4)}
        >
          <RotateCcw size={14} />{' '}
          {props.lang?.startsWith('en') ? 'Rotate the plate' : 'Tabağı çevir'}
        </button>
      )}
    </div>
  );
}
