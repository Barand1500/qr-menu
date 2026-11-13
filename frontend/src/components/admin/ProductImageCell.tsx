import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LoaderCircle } from 'lucide-react';
import { imageUrl } from '@/lib/api';
import MenuMediaPlaceholder from '@/components/public/MenuMediaPlaceholder';

interface ProductImageCellProps {
  name: string;
  cover?: string | null;
  images?: string[];
  busy: boolean;
  disabled: boolean;
  onUpload: (files: File[]) => Promise<void>;
}

export default function ProductImageCell({ name, cover, images, busy, disabled, onUpload }: ProductImageCellProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 0 });
  const photos = images?.length ? images : cover ? [cover] : [];

  function showGallery() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (photos.length > 1) setOpen(true);
  }

  function hideGallery() {
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  }

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    function placeGallery() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        setOpen(false);
        return;
      }
      const width = Math.min(photos.length * 116 + 12, 560, window.innerWidth - 24);
      setPosition({
        width,
        left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        top: Math.max(12, rect.bottom + 192 <= window.innerHeight ? rect.bottom + 8 : rect.top - 184),
      });
    }
    placeGallery();
    window.addEventListener('resize', placeGallery);
    window.addEventListener('scroll', placeGallery, true);
    return () => {
      window.removeEventListener('resize', placeGallery);
      window.removeEventListener('scroll', placeGallery, true);
    };
  }, [open, photos.length]);

  return (
    <div onDoubleClick={(e) => e.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`${name}: görsel ekle${photos.length > 1 ? `, ${photos.length} görseli önizle` : ''}`}
        aria-busy={busy}
        disabled={disabled}
        title="Ek görsel yüklemek için çift tıklayın"
        className="relative block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--admin-accent)]"
        onMouseEnter={showGallery}
        onMouseLeave={hideGallery}
        onFocus={showGallery}
        onBlur={() => setOpen(false)}
        onDoubleClick={() => {
          setOpen(false);
          inputRef.current?.click();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(false);
            inputRef.current?.click();
          }
        }}
      >
        {photos[0] ? (
          <img src={imageUrl(photos[0])} alt="" className="w-12 h-12 rounded-xl object-cover" />
        ) : (
          <div className="w-12 h-12 rounded-xl overflow-hidden">
            <MenuMediaPlaceholder kind="product" size="sm" label={name} />
          </div>
        )}
        {photos.length > 1 && !busy && (
          <span className="absolute -bottom-1 -right-1 min-w-5 px-1 rounded-md bg-[var(--admin-accent)] text-[var(--admin-btn-primary-text)] text-[10px] font-semibold shadow-sm">
            {photos.length}
          </span>
        )}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50 text-white">
            <LoaderCircle className="w-5 h-5 animate-spin" />
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        aria-label={`${name} için ek görsel seç`}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          const files = Array.from(e.currentTarget.files ?? []);
          e.currentTarget.value = '';
          if (files.length) void onUpload(files);
        }}
      />
      {open && photos.length > 1 && createPortal(
        <div
          role="tooltip"
          aria-label={`${name} görselleri`}
          className="fixed z-[70] rounded-2xl border border-[var(--admin-card-border)] bg-[var(--admin-card)] p-3 shadow-2xl"
          style={position}
          onMouseEnter={showGallery}
          onMouseLeave={hideGallery}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <p className="mb-2 truncate text-xs font-semibold text-[var(--admin-text)]">{name} · {photos.length} görsel</p>
          <div className="flex gap-3 overflow-x-auto pb-1 admin-scroll">
            {photos.map((url, index) => (
              <figure key={`${url}-${index}`} className="w-[104px] shrink-0 overflow-hidden rounded-xl border border-[var(--admin-card-border)] bg-[var(--admin-input-bg)]">
                <img src={imageUrl(url)} alt={`${name} — ${index + 1}. görsel`} className="h-[104px] w-full object-cover" />
                <figcaption className="py-1.5 text-center text-[10px] font-medium text-[var(--admin-text-muted)]">
                  {index === 0 ? 'Kapak' : `Görsel ${index + 1}`}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
