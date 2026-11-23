import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, MoreHorizontal, Share2, X } from 'lucide-react';
import SocialBrandIcon from '@/components/SocialBrandIcon';
import { copyShareLink } from '@/lib/menuShare';
import './menu-share.css';

/** Small, non-blocking share menu. A native share is invoked only directly from its own button. */
export default function MenuShareButton({
  url,
  title,
  label,
  lang = 'tr',
  showLabel = false,
  className = '',
}: {
  url: string;
  title: string;
  label?: string;
  lang?: string;
  showLabel?: boolean;
  className?: string;
}) {
  const en = !lang.toLowerCase().startsWith('tr');
  const t = {
    share: en ? 'Share' : 'Paylaş',
    copy: en ? 'Copy link' : 'Bağlantıyı kopyala',
    copied: en ? 'Link copied' : 'Bağlantı kopyalandı',
    other: en ? 'More' : 'Diğer',
    close: en ? 'Close share menu' : 'Paylaşımı kapat',
    failed: en
      ? 'Select and copy the link below.'
      : 'Aşağıdaki bağlantıyı seçip kopyalayabilirsiniz.',
  };
  const [open, setOpen] = useState(false),
    [status, setStatus] = useState<'idle' | 'copied' | 'manual'>('idle'),
    [nativeBusy, setNativeBusy] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({}),
    [top, setTop] = useState(0),
    [left, setLeft] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null),
    panel = useRef<HTMLDivElement>(null),
    live = useRef(true),
    nativeLock = useRef(false);
  const id = useId(),
    heading = id + '-heading';
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  useEffect(() => {
    setOpen(false);
    setStatus('idle');
  }, [url]);
  function close(restore = false) {
    if (nativeLock.current) return;
    setOpen(false);
    if (restore) trigger.current?.focus({ preventScroll: true });
  }
  useLayoutEffect(() => {
    if (!open) return;
    const button = trigger.current,
      view = button?.ownerDocument.defaultView;
    if (!button || !view) return;
    const styles = view.getComputedStyle(button);
    const value = (...names: string[]) =>
      names.map((name) => styles.getPropertyValue(name).trim()).find(Boolean);
    setStyle({
      '--ms-bg':
        value('--cc-ui-bg', '--pd-surface', '--sh-surface') || '#18130f',
      '--ms-text': value('--cc-ui-ink', '--pd-text', '--sh-text') || '#f6eee4',
      '--ms-muted':
        value('--cc-ui-muted', '--pd-muted', '--sh-muted') || '#a99b8d',
      '--ms-line':
        value('--cc-ui-line', '--pd-line', '--sh-line') || '#f6eee41f',
      '--ms-accent':
        value('--cc-accent', '--pd-accent', '--sh-accent') || '#ff6b2c',
    } as CSSProperties);
    const place = () => {
      const r = button.getBoundingClientRect(),
        width = Math.min(264, view.innerWidth - 24),
        height = panel.current?.offsetHeight || 157;
      setLeft(
        Math.min(view.innerWidth - width - 12, Math.max(12, r.right - width)),
      );
      setTop(
        r.bottom + height + 10 < view.innerHeight
          ? r.bottom + 8
          : Math.max(12, r.top - height - 8),
      );
    };
    place();
    view.addEventListener('resize', place);
    const frame = view.requestAnimationFrame(place);
    return () => {
      view.removeEventListener('resize', place);
      view.cancelAnimationFrame(frame);
    };
  }, [open, status]);
  useEffect(() => {
    if (!open) return;
    const doc = trigger.current?.ownerDocument || document;
    const outside = (e: Event) => {
      if (
        panel.current?.contains(e.target as Node) ||
        trigger.current?.contains(e.target as Node)
      )
        return;
      close();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close(true);
      }
    };
    const scroll = (e: Event) => {
      if (!panel.current?.contains(e.target as Node)) close();
    };
    doc.addEventListener('pointerdown', outside);
    doc.addEventListener('keydown', key);
    doc.addEventListener('scroll', scroll, true);
    panel.current
      ?.querySelector<HTMLButtonElement>('.menu-share-close')
      ?.focus({ preventScroll: true });
    return () => {
      doc.removeEventListener('pointerdown', outside);
      doc.removeEventListener('keydown', key);
      doc.removeEventListener('scroll', scroll, true);
    };
  }, [open]);
  async function copy() {
    const ok = await copyShareLink(url);
    if (live.current) setStatus(ok ? 'copied' : 'manual');
  }
  async function native() {
    if (nativeLock.current) return;
    nativeLock.current = true;
    setNativeBusy(true);
    try {
      await navigator.share({ title, text: title, url });
      if (live.current) setOpen(false);
    } catch (error) {
      if (live.current && (error as Error).name !== 'AbortError')
        setStatus('manual');
    } finally {
      nativeLock.current = false;
      if (live.current) setNativeBusy(false);
    }
  }
  const message = encodeURIComponent(`${title}\n${url}`);
  return (
    <>
      <button
        ref={trigger}
        disabled={nativeBusy}
        type="button"
        className={`menu-share-trigger ${className}`}
        aria-label={label || t.share}
        title={label || t.share}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={(e) => {
          e.stopPropagation();
          setStatus('idle');
          setOpen((v) => !v);
        }}
      >
        <Share2 size={17} strokeWidth={1.7} />
        {showLabel && <span>{label || t.share}</span>}
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            id={id}
            role="dialog"
            aria-modal="false"
            aria-labelledby={heading}
            className="menu-share-popover"
            style={{ ...style, top, left }}
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <span id={heading}>{title}</span>
              <button
                type="button"
                className="menu-share-close"
                aria-label={t.close}
                disabled={nativeBusy}
                onClick={() => close(true)}
              >
                <X size={15} />
              </button>
            </header>
            <div className="menu-share-targets">
              <a
                href={`https://wa.me/?text=${message}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => close()}
              >
                <SocialBrandIcon id="whatsapp" className="menu-share-brand" />
                <span>WhatsApp</span>
              </a>
              <a
                href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => close()}
              >
                <SocialBrandIcon id="telegram" className="menu-share-brand" />
                <span>Telegram</span>
              </a>
              <button
                type="button"
                aria-label={t.copy}
                disabled={nativeBusy}
                onClick={() => void copy()}
              >
                {status === 'copied' ? <Check size={20} /> : <Copy size={20} />}
                <span>{en ? 'Copy' : 'Kopyala'}</span>
              </button>
              {typeof navigator.share === 'function' && (
                <button
                  type="button"
                  disabled={nativeBusy}
                  onClick={() => void native()}
                >
                  <MoreHorizontal size={21} />
                  <span>{t.other}</span>
                </button>
              )}
            </div>
            <p className="menu-share-status" role="status">
              {status === 'copied'
                ? t.copied
                : status === 'manual'
                  ? t.failed
                  : t.share}
            </p>
            {status === 'manual' && (
              <input
                className="menu-share-manual"
                aria-label={en ? 'Share link' : 'Paylaşım bağlantısı'}
                value={url}
                readOnly
                onFocus={(e) => e.target.select()}
              />
            )}
          </div>,
          trigger.current?.ownerDocument.body || document.body,
        )}
    </>
  );
}
