import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  GripVertical,
  ImageOff,
  MoreHorizontal,
} from 'lucide-react';
import { imageUrl } from '@/lib/api';
import { mediaReady, type ShowcaseItem } from './types';
import VisibilityToggle from '@/components/admin/VisibilityToggle';
export function ShowcaseImage({
  src,
  alt = '',
}: {
  src?: string | null;
  alt?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return src && !failed ? (
    <img
      src={src.startsWith('blob:') ? src : imageUrl(src)}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  ) : (
    <span className="sc-image-empty">
      <ImageOff size={30} aria-hidden="true" />
      <span>Görsel yok</span>
    </span>
  );
}
export default function ShowcaseCard({
  item,
  index,
  busy,
  dragging,
  dropTarget,
  onEdit,
  onToggle,
  onActions,
  onDrag,
  onDrop,
  onMove,
}: {
  item: ShowcaseItem;
  index: number;
  busy: boolean;
  dragging: boolean;
  dropTarget: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onActions: (point: { x: number; y: number }) => void;
  onDrag: (id: number | null) => void;
  onDrop: (id: number, commit: boolean) => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const title = item.translations?.find((t) => t.languageCode === 'tr');
  return (
    <article
      data-showcase-id={item.id}
      className={`sc-card ${item.isActive ? '' : 'is-hidden'} ${dragging ? 'is-dragging' : ''} ${dropTarget ? 'is-drop-target' : ''}`}
      onDragOver={(event) => {
        if (!busy) {
          event.preventDefault();
          onDrop(item.id, false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(item.id, true);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        if (!busy) onActions({ x: event.clientX, y: event.clientY });
      }}
    >
      <div className="sc-card__stage">
        <button
          type="button"
          className="sc-card__visual"
          aria-label={`${item.name} düzenle`}
          onClick={onEdit}
          disabled={busy}
        >
          <ShowcaseImage src={item.imageUrl} />
          {item.displayType === 'banner' &&
            (title?.title1 || title?.title2) && (
              <span className="sc-card__caption">
                <strong>{title.title1}</strong>
                <span>{title.title2}</span>
              </span>
            )}
          <span className="sc-card__edit">
            Düzenle <ArrowUpRight size={15} />
          </span>
        </button>
        <span className="sc-card__number" aria-hidden="true">
          {String(index + 1).padStart(2, '0')}
        </span>
        <button
          type="button"
          className="sc-card__grip"
          draggable={!busy}
          disabled={busy}
          aria-label={`${item.name} sırasını değiştir`}
          title="Sürükle veya ok tuşlarıyla taşı"
          onDragStart={(event) => {
            event.dataTransfer.setData('text/plain', String(item.id));
            event.dataTransfer.effectAllowed = 'move';
            onDrag(item.id);
          }}
          onDragEnd={() => onDrag(null)}
          onKeyDown={(event) => {
            if (
              ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'].includes(
                event.key,
              )
            ) {
              event.preventDefault();
              onMove(['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1);
            }
          }}
        >
          <GripVertical size={18} />
        </button>
        {item.displayType === 'story' && (
          <span className="sc-card__duration">
            {item.durationSeconds ?? 5} sn
          </span>
        )}
      </div>
      <div className="sc-card__body">
        <button
          type="button"
          className="sc-card__name"
          onClick={onEdit}
          disabled={busy}
        >
          {item.name}
        </button>
        <p>
          {item.productName ||
            (item.displayType === 'banner'
              ? 'Bağlantı yok'
              : 'Ürün seçilmemiş')}
        </p>
        <div className="sc-card__tools">
          {mediaReady(item) ? (
            <VisibilityToggle
              checked={item.isActive}
              label={`${item.name} menüde göster`}
              disabled={busy}
              onToggle={onToggle}
            />
          ) : (
            <button
              type="button"
              className="sc-status"
              aria-label={`${item.name} eksik bilgilerini tamamla`}
              onClick={onEdit}
              disabled={busy}
            >
              Tamamla
            </button>
          )}
          <button
            type="button"
            className="sc-icon"
            aria-label={`${item.name} işlemleri`}
            disabled={busy}
            onClick={(event) => {
              const r = event.currentTarget.getBoundingClientRect();
              onActions({ x: r.right, y: r.bottom });
            }}
          >
            <MoreHorizontal size={21} />
          </button>
        </div>
      </div>
    </article>
  );
}
