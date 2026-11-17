import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { HexColorInput, HexColorPicker } from 'react-colorful';
import { Frame, LayoutTemplate, Palette, Printer, Type, X } from 'lucide-react';
import QrCard, { FrameThumb } from './QrCard';
import {
  QR_COLORS,
  QR_FRAMES,
  TEMPLATES,
  normalizeHex,
  type CardSpec,
  type FrameId,
  type TemplateId,
} from './qr';

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="bq-field">
      <div className="bq-field__label">
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </div>
      {children}
    </div>
  );
}

export function ColorControl({
  value,
  onChange,
}: {
  value: string;
  onChange: (colorId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('#2563eb');
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const button = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const custom = !QR_COLORS.some((c) => c.id === value);
  const hex = normalizeHex(value) || draft;
  useEffect(() => {
    const next = normalizeHex(value);
    if (next) setDraft(next);
  }, [value]);
  useEffect(() => {
    if (!open || !button.current) return;
    const place = () => {
      const r = button.current!.getBoundingClientRect();
      const width = 232;
      const left = Math.max(
        8,
        Math.min(
          r.left + r.width / 2 - width / 2,
          window.innerWidth - width - 8,
        ),
      );
      const above = r.top > 330;
      setPos({
        top: above
          ? r.top - 322
          : Math.min(r.bottom + 8, window.innerHeight - 322),
        left,
      });
    };
    place();
    const outside = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!popover.current?.contains(t) && !button.current?.contains(t))
        setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
      button.current?.focus();
    };
    window.addEventListener('resize', place);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', key, true);
    return () => {
      window.removeEventListener('resize', place);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', key, true);
    };
  }, [open]);
  const apply = (next: string) => {
    const clean = normalizeHex(next) || next;
    setDraft(clean);
    onChange(clean.toLowerCase());
  };
  return (
    <div className="bq-swatches" role="group" aria-label="Renk">
      {QR_COLORS.map((c) => (
        <button
          type="button"
          key={c.id}
          className="bq-swatch"
          style={{ '--sw': c.fg } as React.CSSProperties}
          aria-pressed={value === c.id}
          aria-label={c.label}
          title={c.label}
          onClick={() => {
            setOpen(false);
            onChange(c.id);
          }}
        />
      ))}
      <button
        type="button"
        ref={button}
        className={`bq-swatch bq-swatch--custom${custom ? ' is-custom' : ''}`}
        style={custom ? ({ '--sw': hex } as React.CSSProperties) : undefined}
        aria-pressed={custom}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Özel renk"
        title="Özel renk"
        onClick={() => {
          setOpen((v) => !v);
          if (!open && !custom) apply(draft);
        }}
      />
      {open &&
        createPortal(
          <div
            ref={popover}
            className="bq-popover"
            role="dialog"
            aria-label="Özel renk seç"
            style={{ top: pos.top, left: pos.left }}
          >
            <div className="bq-popover__head">
              <span>Özel renk</span>
              <button
                type="button"
                aria-label="Kapat"
                onClick={() => setOpen(false)}
              >
                <X size={15} />
              </button>
            </div>
            <HexColorPicker color={hex} onChange={apply} />
            <div className="bq-popover__foot">
              <span style={{ background: hex }} />
              <HexColorInput
                color={hex}
                onChange={apply}
                prefixed
                aria-label="Hex renk kodu"
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

export function FrameControl({
  value,
  color,
  onChange,
}: {
  value: FrameId;
  color: string;
  onChange: (id: FrameId) => void;
}) {
  return (
    <div className="bq-frames" role="group" aria-label="Çerçeve">
      {QR_FRAMES.map((f) => (
        <button
          type="button"
          key={f.id}
          aria-pressed={value === f.id}
          onClick={() => onChange(f.id)}
        >
          <FrameThumb frameId={f.id} color={color} />
          <span>{f.label}</span>
        </button>
      ))}
    </div>
  );
}

const SAMPLE = (template: TemplateId, fg: string, bg: string): CardSpec => ({
  key: template,
  title: 'Masa 5',
  subtitle: 'Restoran',
  url: 'https://menu.qr/5',
  fg,
  bg,
  frameId: 'yok',
  template,
  cta: 'Okutun',
  showUrl: false,
});
export function TemplateControl({
  value,
  fg,
  bg,
  onChange,
}: {
  value: TemplateId;
  fg: string;
  bg: string;
  onChange: (id: TemplateId) => void;
}) {
  return (
    <div className="bq-templates" role="group" aria-label="Şablon">
      {TEMPLATES.map((t) => (
        <button
          type="button"
          key={t.id}
          aria-pressed={value === t.id}
          onClick={() => onChange(t.id)}
        >
          <span className="bq-templates__thumb" aria-hidden="true">
            <QrCard spec={SAMPLE(t.id, fg, bg)} unit="0.5px" />
          </span>
          <strong>{t.label}</strong>
          <small>{t.hint}</small>
        </button>
      ))}
    </div>
  );
}

function Switch({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className={`bq-switch-row${disabled ? ' is-disabled' : ''}`}>
      <span>
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <i className="bq-switch" aria-hidden="true" />
    </label>
  );
}

export function LogoControl({
  checked,
  hasLogo,
  onChange,
}: {
  checked: boolean;
  hasLogo: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Switch
      label="Ortada logo"
      hint={
        hasLogo
          ? 'Logon kodun tam ortasında durur'
          : 'Önce Ayarlar’dan logo yükle'
      }
      checked={checked && hasLogo}
      disabled={!hasLogo}
      onChange={onChange}
    />
  );
}

export function TextControls({
  titleLabel,
  title,
  onTitle,
  onTitleCommit,
  cta,
  onCta,
  showUrl,
  onShowUrl,
}: {
  titleLabel?: string;
  title?: string;
  onTitle?: (v: string) => void;
  onTitleCommit?: () => void;
  cta: string;
  onCta: (v: string) => void;
  showUrl: boolean;
  onShowUrl: (v: boolean) => void;
}) {
  return (
    <div className="bq-texts">
      {onTitle && (
        <label className="bq-input">
          <span>{titleLabel || 'Başlık'}</span>
          <input
            value={title}
            maxLength={60}
            onChange={(e) => onTitle(e.target.value)}
            onBlur={onTitleCommit}
            onKeyDown={(e) =>
              e.key === 'Enter' && (e.target as HTMLInputElement).blur()
            }
          />
        </label>
      )}
      <label className="bq-input">
        <span>Çağrı yazısı</span>
        <input
          value={cta}
          maxLength={60}
          placeholder="Menüyü görmek için okutun"
          onChange={(e) => onCta(e.target.value)}
        />
      </label>
      <Switch
        label="Bağlantıyı göster"
        hint="Kartın altına adres yazılır"
        checked={showUrl}
        onChange={onShowUrl}
      />
    </div>
  );
}

type Tab = 'color' | 'frame' | 'template' | 'text';
const TABS: { id: Tab; label: string; Icon: typeof Palette }[] = [
  { id: 'color', label: 'Renk', Icon: Palette },
  { id: 'frame', label: 'Çerçeve', Icon: Frame },
  { id: 'template', label: 'Şablon', Icon: LayoutTemplate },
  { id: 'text', label: 'Yazı', Icon: Type },
];

/** Phone toolbar: editing tools in a tray above the bar, the live card stays visible above. */
export function DesignDock({
  panels,
  locked,
  printLabel,
  printDisabled,
  onPrint,
}: {
  panels: Record<Tab, ReactNode>;
  locked: boolean;
  printLabel: string;
  printDisabled: boolean;
  onPrint: () => void;
}) {
  const [tab, setTab] = useState<Tab | null>(null);
  useEffect(() => {
    if (!tab) return;
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setTab(null);
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [tab]);
  return (
    <div className={`bq-dock${tab ? ' is-open' : ''}`}>
      {tab && !locked && (
        <div
          className="bq-tray"
          role="group"
          aria-label={TABS.find((t) => t.id === tab)?.label}
          key={tab}
        >
          {panels[tab]}
        </div>
      )}
      <div className="bq-dock__bar">
        {!locked && (
          <div
            className="bq-dock__tabs"
            role="group"
            aria-label="Tasarım araçları"
          >
            {TABS.map(({ id, label, Icon }) => (
              <button
                type="button"
                key={id}
                aria-pressed={tab === id}
                onClick={() => setTab(tab === id ? null : id)}
              >
                <Icon size={20} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          className="bq-dock__print"
          disabled={printDisabled}
          onClick={onPrint}
        >
          <Printer size={19} />
          {printLabel}
        </button>
      </div>
    </div>
  );
}
