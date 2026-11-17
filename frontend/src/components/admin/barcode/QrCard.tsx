import { forwardRef, type CSSProperties, type ReactNode } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { CardSpec, FrameId } from './qr';

function FloralCorner({ variant }: { variant: FrameId }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const box = {
    viewBox: '0 0 40 40',
    width: '100%',
    height: '100%',
    'aria-hidden': true,
  };
  if (variant === 'yok') return null;
  if (variant === 'ince')
    return (
      <svg {...box}>
        <path {...common} strokeWidth="1.6" d="M6 28V10h18" />
        <path {...common} strokeWidth="1.4" d="M10 10c4-7 12-7 16 0" />
        <circle cx="10" cy="10" r="2.2" fill="currentColor" />
        <path fill="currentColor" d="M18 6c3-4 8-3 9 1-4 1-7 3-9-1z" />
      </svg>
    );
  if (variant === 'kalin')
    return (
      <svg {...box}>
        <path {...common} strokeWidth="3.4" d="M5 30V8h22" />
        <path {...common} strokeWidth="2.2" d="M12 8c5-8 14-7 18 1" />
        <circle cx="8" cy="8" r="3" fill="currentColor" />
        <path fill="currentColor" d="M20 4c4-5 10-4 11 2-5 0-9 3-11-2z" />
        <path fill="currentColor" d="M4 20c-5 4-4 10 2 11 0-5 3-9-2-11z" />
      </svg>
    );
  if (variant === 'kelebek')
    return (
      <svg {...box}>
        <path
          fill="currentColor"
          d="M18 20c-9-2-14-9-12-15 5 1 10 5 12 11z"
          opacity="0.9"
        />
        <path
          fill="currentColor"
          d="M18 21c-8 3-12 10-9 15 5-2 9-7 9-12z"
          opacity="0.75"
        />
        <path
          fill="currentColor"
          d="M19 19c2-7 8-12 14-11-2 6-7 10-14 11z"
          opacity="0.85"
        />
        <ellipse cx="18.5" cy="20" rx="1.4" ry="4.2" fill="currentColor" />
        <circle cx="18.5" cy="16.2" r="1.3" fill="currentColor" />
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          d="M17.2 14.5c-1.5-2.5-0.5-4.5 0.5-5M19.8 14.5c1.5-2.5 0.5-4.5-0.5-5"
        />
        <circle cx="12" cy="12" r="1.1" fill="currentColor" opacity="0.55" />
        <circle cx="11" cy="26" r="1" fill="currentColor" opacity="0.45" />
      </svg>
    );
  if (variant === 'kesik')
    return (
      <svg {...box}>
        <path
          {...common}
          strokeWidth="2"
          strokeDasharray="3.5 2.8"
          d="M8 30V10h20"
        />
        <circle cx="10" cy="10" r="2.6" fill="currentColor" />
        <circle cx="22" cy="8" r="1.5" fill="currentColor" />
        <circle cx="8" cy="22" r="1.5" fill="currentColor" />
        <path fill="currentColor" d="M16 5c2.5-3.5 7-3 8 1-3.5.5-6 2.5-8-1z" />
      </svg>
    );
  if (variant === 'halka')
    return (
      <svg {...box}>
        <path {...common} strokeWidth="2" d="M8 28a20 20 0 0 1 20-20" />
        <path
          {...common}
          strokeWidth="1.3"
          opacity="0.45"
          d="M12 30a18 18 0 0 1 18-18"
        />
        <path fill="currentColor" d="M24 6c3-4 8-3 9 2-4 0-7 2-9-2z" />
        <path fill="currentColor" d="M6 24c-4 3-3 8 2 9 0-4 2-7-2-9z" />
        <circle cx="12" cy="12" r="2.3" fill="currentColor" />
      </svg>
    );
  if (variant === 'minimal')
    return (
      <svg {...box}>
        <path {...common} strokeWidth="2.2" d="M8 24V10h14" />
        <circle cx="10" cy="10" r="1.8" fill="currentColor" />
      </svg>
    );
  return (
    <svg {...box}>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        d="M8 32C8 20 10 14 18 10c6-3 10-2 14 2"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.7"
        d="M10 28c4-6 8-8 14-8"
      />
      <path fill="currentColor" d="M14 18c-4-5-2-9 2-10 1 4-1 8-2 10z" />
      <path
        fill="currentColor"
        d="M20 12c3-5 8-5 10-1-4 2-7 4-10 1z"
        opacity="0.9"
      />
      <path
        fill="currentColor"
        d="M12 24c-5-2-7 2-5 6 3-1 5-3 5-6z"
        opacity="0.85"
      />
      <circle cx="28" cy="10" r="2.2" fill="currentColor" />
      <circle cx="25.2" cy="8.2" r="1.5" fill="currentColor" opacity="0.8" />
      <circle cx="30.8" cy="8.2" r="1.5" fill="currentColor" opacity="0.8" />
      <circle cx="25.2" cy="11.8" r="1.5" fill="currentColor" opacity="0.8" />
      <circle cx="30.8" cy="11.8" r="1.5" fill="currentColor" opacity="0.8" />
      <circle cx="28" cy="10" r="1" fill="#fff" opacity="0.9" />
      <circle cx="10" cy="14" r="1.4" fill="currentColor" />
      <circle cx="16" cy="28" r="1.2" fill="currentColor" opacity="0.7" />
    </svg>
  );
}

/** Decorative frame around the code. Sizes are in card units (--u), so it scales with the card. */
export function QrFrame({
  frameId,
  color,
  children,
}: {
  frameId: FrameId;
  color: string;
  children: ReactNode;
}) {
  const bare = frameId === 'yok';
  return (
    <div
      className={`bq-frame bq-frame--${frameId}`}
      style={{ '--frame': color } as CSSProperties}
    >
      {!bare && <span className="bq-frame__ring" aria-hidden="true" />}
      {!bare &&
        (['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
          <span
            className={`bq-frame__corner ${corner}`}
            key={corner}
            aria-hidden="true"
          >
            <FloralCorner variant={frameId} />
          </span>
        ))}
      <div className="bq-frame__inner">{children}</div>
    </div>
  );
}

/** Tiny frame sample used by the frame picker. */
export function FrameThumb({
  frameId,
  color,
}: {
  frameId: FrameId;
  color: string;
}) {
  return (
    <span className="bq-frame-thumb" aria-hidden="true">
      <QrFrame frameId={frameId} color={color}>
        <span className="bq-mini-qr" />
      </QrFrame>
    </span>
  );
}

const longest = (text: string) =>
  Math.max(1, ...text.split(/\s+/).map((w) => w.length));
/** The card. `unit` is the CSS length of 1/100 of its width (px on screen, mm in print). */
const QrCard = forwardRef<
  HTMLDivElement,
  { spec: CardSpec; unit: string; live?: boolean; className?: string }
>(function QrCard({ spec, unit, live, className = '' }, ref) {
  const size =
    spec.title.length > 26 || longest(spec.title) > 14
      ? 0.68
      : spec.title.length > 14
        ? 0.84
        : 1;
  const qr = (
    <div className={`bq-card__qr${live ? ' is-live' : ''}`}>
      <QrFrame frameId={spec.frameId} color={spec.fg}>
        <QRCodeSVG
          value={spec.url}
          size={256}
          level="H"
          marginSize={4}
          fgColor={spec.fg}
          bgColor={spec.bg}
          imageSettings={
            spec.logo
              ? { src: spec.logo, height: 66, width: 66, excavate: true }
              : undefined
          }
        />
      </QrFrame>
      {live && <i className="bq-card__scan" aria-hidden="true" />}
    </div>
  );
  return (
    <div
      ref={ref}
      className={`bq-card bq-card--${spec.template} ${className}`}
      style={
        {
          '--fg': spec.fg,
          '--bg': spec.bg,
          '--u': unit,
          '--tl': size,
        } as CSSProperties
      }
    >
      {spec.template !== 'sade' ? (
        <header className="bq-card__head">
          {spec.subtitle && (
            <span className="bq-card__brand">{spec.subtitle}</span>
          )}
          <h3 className="bq-card__title">{spec.title}</h3>
        </header>
      ) : (
        <span className="bq-card__brand">{spec.subtitle}</span>
      )}
      {qr}
      <footer className="bq-card__foot">
        {spec.template === 'sade' && (
          <strong className="bq-card__small-title">{spec.title}</strong>
        )}
        {spec.cta && <p className="bq-card__cta">{spec.cta}</p>}
        {spec.showUrl && (
          <p className="bq-card__url">{spec.url.replace(/^https?:\/\//, '')}</p>
        )}
      </footer>
    </div>
  );
});
export default QrCard;
