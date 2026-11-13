import { useEffect, useRef, useState } from 'react';
import { RotateCcw, Utensils } from 'lucide-react';
import { imageUrl } from '@/lib/api';
import type { TableRenderer, TableItem, TableVariant } from './tableRenderer';

export interface TableSceneProps {
  lang?: string;
  variant: TableVariant;
  items: TableItem[];
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
          const driver = createTableRenderer(node, { lost: () => setStatus('fallback') });
          renderer.current = driver;
          driver.update(latest.current.items);
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
    renderer.current?.update(props.items);
  }, [signature]);
  useEffect(() => {
    if (status === 'fallback') {
      renderer.current?.dispose();
      renderer.current = null;
    }
  }, [status]);
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
      {status === 'ready' && props.variant === 'detail' && (
        <button
          type="button"
          className="table-scene__guide"
          onClick={() => renderer.current?.turn(Math.PI / 4)}
        >
          <RotateCcw size={14} />{' '}
          {props.lang?.startsWith('en') ? 'Rotate the plate' : 'Tabağı çevir'}
        </button>
      )}
    </div>
  );
}
