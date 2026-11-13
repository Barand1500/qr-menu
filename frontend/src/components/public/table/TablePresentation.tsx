import { useState, type ReactNode } from 'react';
import { Box, Image, Utensils } from 'lucide-react';
import { imageUrl } from '@/lib/api';
import TableScene from './TableScene';
import type { TableItem, TableVariant } from './tableRenderer';

/** Keep the original photograph readable; WebGL is an explicit, optional view. */
export default function TablePresentation({
  item,
  variant,
  lang = 'tr',
  photo,
  onActivate,
}: {
  item?: TableItem;
  variant: TableVariant;
  lang?: string;
  photo?: ReactNode;
  onActivate?: () => void;
}) {
  const [dimensional, setDimensional] = useState(false);
  const [broken, setBroken] = useState('');
  const en = lang.startsWith('en');
  const src = item?.imageUrl;
  return (
    <div className={`table-presentation${dimensional ? ' is-dimensional' : ''}`}>
      {dimensional && item && src ? (
        <TableScene variant={variant} items={[item]} lang={lang} />
      ) : (
        <div className="table-presentation__photo">
          {photo ??
            (src && broken !== src ? (
              <button
                type="button"
                disabled={!onActivate}
                onClick={onActivate}
                aria-label={item?.name || (en ? 'Explore menu' : 'Menüyü keşfet')}
              >
                <img
                  src={src.startsWith('blob:') ? src : imageUrl(src)}
                  alt={item?.name || ''}
                  onError={() => setBroken(src)}
                />
              </button>
            ) : (
              <div className="table-presentation__empty">
                <Utensils size={36} />
                <span>{en ? 'Your place is ready.' : 'Sofrada yerin hazır.'}</span>
              </div>
            ))}
        </div>
      )}
      {src && (
        <div className="table-presentation__switch" aria-label={en ? 'Presentation' : 'Görünüm'}>
          <button type="button" aria-pressed={!dimensional} onClick={() => setDimensional(false)}>
            <Image size={14} />
            {en ? 'Photo' : 'Fotoğraf'}
          </button>
          <button type="button" aria-pressed={dimensional} onClick={() => setDimensional(true)}>
            <Box size={14} />
            {en ? '3D presentation' : '3D sunum'}
          </button>
        </div>
      )}
    </div>
  );
}
