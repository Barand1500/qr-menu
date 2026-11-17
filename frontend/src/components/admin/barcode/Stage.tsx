import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  Check,
  Copy,
  Download,
  FileImage,
  FileCode2,
  Link2,
  QrCode,
} from 'lucide-react';
import QrCard from './QrCard';
import type { CardSpec } from './qr';

function DownloadMenu({
  disabled,
  onPng,
  onSvg,
}: {
  disabled: boolean;
  onPng: () => void;
  onSvg: () => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  return (
    <div
      className="bq-menu"
      ref={box}
      data-admin-escape-owner
      onKeyDown={(e) => {
        if (e.key !== 'Escape' || !open) return;
        e.stopPropagation();
        setOpen(false);
      }}
    >
      <button
        type="button"
        className="bq-tool"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <Download size={18} />
        <span>QR indir</span>
      </button>
      {open && (
        <div className="bq-menu__list" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onPng();
            }}
          >
            <FileImage size={18} />
            <span>
              PNG görseli
              <small>Mesajlaşma ve sosyal medya için</small>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSvg();
            }}
          >
            <FileCode2 size={18} />
            <span>
              SVG (vektör)
              <small>Matbaa ve büyük baskı için</small>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

/** The live card on a desk-like surface. It tilts toward the pointer and glows in the card's colour. */
export default function Stage({
  spec,
  heading,
  compact,
  empty,
  onCopy,
  onPng,
  onSvg,
  children,
}: {
  spec: CardSpec | null;
  heading: string;
  compact: boolean;
  empty?: ReactNode;
  onCopy: () => Promise<boolean>;
  onPng: () => void;
  onSvg: () => void;
  children?: ReactNode;
}) {
  const card = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);
  const tilt = (e: React.PointerEvent) => {
    const node = card.current;
    if (
      !node ||
      e.pointerType !== 'mouse' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;
    const box = node.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width,
      y = (e.clientY - box.top) / box.height;
    node.style.setProperty('--rx', `${((0.5 - y) * 9).toFixed(2)}deg`);
    node.style.setProperty('--ry', `${((x - 0.5) * 11).toFixed(2)}deg`);
    node.style.setProperty('--gx', `${(x * 100).toFixed(1)}%`);
    node.style.setProperty('--gy', `${(y * 100).toFixed(1)}%`);
  };
  const reset = () => {
    card.current?.style.removeProperty('--rx');
    card.current?.style.removeProperty('--ry');
  };
  return (
    <aside
      className={`bq-stage${compact ? ' is-compact' : ''}`}
      aria-label="Canlı önizleme"
    >
      <div
        className="bq-stage__desk"
        style={{ '--tint': spec?.fg || 'var(--admin-accent)' } as CSSProperties}
      >
        <span className="bq-stage__label">
          <i aria-hidden="true" />
          Canlı önizleme · {heading}
        </span>
        {spec ? (
          <div
            className="bq-stage__card"
            ref={card}
            onPointerMove={tilt}
            onPointerLeave={reset}
          >
            {/* A new key replays the card's entrance each time the target changes. */}
            <div className="bq-stage__flip" key={spec.key}>
              <QrCard spec={spec} unit="var(--bq-u)" live />
            </div>
            <i className="bq-stage__glare" aria-hidden="true" />
          </div>
        ) : (
          <div className="bq-stage__empty">
            <QrCode size={34} aria-hidden="true" />
            {empty}
          </div>
        )}
      </div>
      <div className="bq-stage__bar">
        <div className="bq-link" title={spec?.url}>
          <Link2 size={16} aria-hidden="true" />
          <span>{spec ? spec.url.replace(/^https?:\/\//, '') : '—'}</span>
        </div>
        <button
          type="button"
          className={`bq-tool${copied ? ' is-done' : ''}`}
          disabled={!spec}
          onClick={async () => setCopied(await onCopy())}
        >
          {copied ? <Check size={18} /> : <Copy size={18} />}
          <span>{copied ? 'Kopyalandı' : 'Linki kopyala'}</span>
        </button>
        <DownloadMenu disabled={!spec} onPng={onPng} onSvg={onSvg} />
      </div>
      {children}
    </aside>
  );
}
