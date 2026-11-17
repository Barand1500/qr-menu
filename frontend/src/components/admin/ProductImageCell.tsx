import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LoaderCircle, X } from 'lucide-react';
import { imageUrl } from '@/lib/api';
import MenuMediaPlaceholder from '@/components/public/MenuMediaPlaceholder';
import ProductGallery from './products/ProductGallery';
import './product-image-popover.css';

interface ProductImageCellProps {
  name: string;
  cover?: string | null;
  images?: string[];
  busy: boolean;
  disabled: boolean;
  onUpload: (files: File[]) => Promise<void>;
  onOrder: (urls: string[]) => Promise<boolean>;
  onRemove: (url: string) => Promise<boolean>;
  onReplace: (url: string, file: File) => Promise<boolean>;
}

export default function ProductImageCell({
  name,
  cover,
  images,
  busy,
  disabled,
  onUpload,
  onOrder,
  onRemove,
  onReplace,
}: ProductImageCellProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const replacement = useRef<string | null>(null);
  const pinned = useRef(false),
    suppressFocus = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 0 });
  const photos = images?.length ? images : cover ? [cover] : [];

  function showGallery() {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches)
      return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (photos.length > 1) setOpen(true);
  }

  function hideGallery() {
    closeTimer.current = setTimeout(() => {
      if (!pinned.current && !busy) setOpen(false);
    }, 200);
  }
  function closeGallery(returnFocus = false) {
    if (busy) return;
    pinned.current = false;
    setOpen(false);
    if (returnFocus) {
      suppressFocus.current = true;
      triggerRef.current?.focus();
    }
  }
  useEffect(() => {
    if (!photos.length) setOpen(false);
  }, [photos.length]);
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        !popupRef.current?.contains(event.target as Node)
      ) {
        event.preventDefault();
        closeGallery(true);
      }
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [open, busy]);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  useLayoutEffect(() => {
    if (!open) return;
    function placeGallery() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        setOpen(false);
        return;
      }
      const width = Math.min(
        Math.min(photos.length, 4) * 116 + 24,
        500,
        window.innerWidth - 24,
      );
      const height = popupRef.current?.getBoundingClientRect().height || 280;
      const next = {
        width,
        left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        top: Math.max(
          12,
          Math.min(rect.top - height - 8, window.innerHeight - height - 12),
        ),
      };
      if (rect.bottom + height + 8 <= window.innerHeight)
        next.top = rect.bottom + 8;
      setPosition((previous) =>
        previous.width === next.width &&
        previous.left === next.left &&
        previous.top === next.top
          ? previous
          : next,
      );
    }
    placeGallery();
    window.addEventListener('resize', placeGallery);
    window.addEventListener('scroll', placeGallery, true);
    const observer = new ResizeObserver(placeGallery);
    if (popupRef.current) observer.observe(popupRef.current);
    return () => {
      window.removeEventListener('resize', placeGallery);
      window.removeEventListener('scroll', placeGallery, true);
      observer.disconnect();
    };
  }, [open, photos.length, busy]);

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
        onFocus={() => {
          if (suppressFocus.current) suppressFocus.current = false;
          else showGallery();
        }}
        aria-haspopup={photos.length ? 'dialog' : undefined}
        aria-expanded={open}
        onClick={() => {
          if (window.matchMedia('(pointer: coarse)').matches) {
            setOpen(false);
            inputRef.current?.click();
          }
        }}
        onDoubleClick={() => {
          setOpen(false);
          inputRef.current?.click();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            closeGallery();
          }
          if (e.key === 'ArrowDown' && photos.length) {
            e.preventDefault();
            pinned.current = true;
            setOpen(true);
            requestAnimationFrame(() =>
              popupRef.current?.querySelector('button')?.focus(),
            );
          }
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(false);
            inputRef.current?.click();
          }
        }}
      >
        {photos[0] ? (
          <img
            src={imageUrl(photos[0])}
            alt=""
            className="w-12 h-12 rounded-xl object-cover"
          />
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
      <input
        ref={replaceInput}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label={`${name} görselini değiştir`}
        onChange={(event) => {
          const file = event.target.files?.[0],
            url = replacement.current;
          event.target.value = '';
          if (file && url) void onReplace(url, file);
        }}
      />
      {open &&
        photos.length > 0 &&
        createPortal(
          <div
            ref={popupRef}
            role="dialog"
            aria-modal="false"
            aria-label={`${name} görselleri`}
            className="ap-image-popover"
            style={position}
            onMouseEnter={showGallery}
            onMouseLeave={hideGallery}
            onDoubleClick={(e) => e.stopPropagation()}
            onPointerDownCapture={() => {
              pinned.current = true;
            }}
            onFocusCapture={() => {
              pinned.current = true;
            }}
            onKeyDown={(event) => {
              if (
                event.key === 'Escape' &&
                !(event.target as HTMLElement).closest(
                  '[data-admin-escape-owner]',
                )
              ) {
                event.preventDefault();
                event.stopPropagation();
                closeGallery(true);
              }
            }}
          >
            <header>
              <p>
                {name} <small>· {photos.length} görsel</small>
              </p>
              <button
                type="button"
                aria-label="Görsel önizlemesini kapat"
                disabled={busy}
                onClick={() => closeGallery(true)}
              >
                <X size={16} />
              </button>
            </header>
            <ProductGallery
              immediate
              disabled={disabled}
              photos={photos.map((url) => ({ id: url, src: imageUrl(url) }))}
              onOrder={(urls) => {
                void onOrder(urls);
              }}
              onRemove={(photo) => {
                void onRemove(photo.id);
              }}
              onReplace={(photo) => {
                replacement.current = photo.id;
                replaceInput.current?.click();
              }}
            />
          </div>,
          document.body,
        )}
    </div>
  );
}
