import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Printer,
  QrCode,
  LayoutGrid,
  Megaphone,
  X,
  Lock,
  Plus,
  Trash2,
} from 'lucide-react';
import { HexColorPicker, HexColorInput } from 'react-colorful';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '@/contexts/AuthContext';
import { useAddons } from '@/hooks/useAddons';
import { Button, Card, Input, PageHeader, Spinner } from '@/components/ui';
import { imageUrl } from '@/lib/api';

type ViewMode = 'classic' | 'tables' | 'campaign';

const PAPER_SIZES = [
  { value: 'a4', label: 'A4' },
  { value: 'a5', label: 'A5' },
  { value: '80mm', label: '80mm Termal' },
  { value: '58mm', label: '58mm Termal' },
];

const QR_COLORS = [
  { id: 'black', fg: '#0f172a', bg: '#ffffff', label: 'Siyah' },
  { id: 'navy', fg: '#1e3a5f', bg: '#f8fafc', label: 'Lacivert' },
  { id: 'ocean', fg: '#0369a1', bg: '#f0f9ff', label: 'Okyanus' },
  { id: 'sky', fg: '#0284c7', bg: '#e0f2fe', label: 'Gök mavisi' },
  { id: 'teal', fg: '#0f766e', bg: '#f0fdfa', label: 'Turkuaz' },
  { id: 'forest', fg: '#14532d', bg: '#f0fdf4', label: 'Yeşil' },
  { id: 'emerald', fg: '#047857', bg: '#ecfdf5', label: 'Zümrüt' },
  { id: 'olive', fg: '#3f6212', bg: '#f7fee7', label: 'Zeytin' },
  { id: 'wine', fg: '#7f1d1d', bg: '#fff1f2', label: 'Bordo' },
  { id: 'rose', fg: '#be123c', bg: '#fff1f2', label: 'Gül' },
  { id: 'coral', fg: '#c2410c', bg: '#fff7ed', label: 'Mercan' },
  { id: 'gold', fg: '#78350f', bg: '#fffbeb', label: 'Altın' },
  { id: 'amber', fg: '#b45309', bg: '#fffbeb', label: 'Amber' },
  { id: 'purple', fg: '#5b21b6', bg: '#f5f3ff', label: 'Mor' },
  { id: 'plum', fg: '#86198f', bg: '#fdf4ff', label: 'Erik' },
  { id: 'slate', fg: '#475569', bg: '#f8fafc', label: 'Gri' },
];

interface CampaignItem {
  id: string;
  label: string;
  slug: string;
}

interface TableStyle {
  name: string;
  colorId: string;
  withLogo: boolean;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function defaultTableStyle(n: number): TableStyle {
  return { name: `Masa ${n}`, colorId: 'black', withLogo: false };
}

function normalizeHex(value: string): string | null {
  const v = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  if (/^#[0-9a-f]{3}$/.test(v)) {
    return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  }
  return null;
}

function softBgFromFg(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = (c: number) => Math.round(c * 0.1 + 255 * 0.9);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function resolveColor(colorId: string) {
  const preset = QR_COLORS.find((c) => c.id === colorId);
  if (preset) return preset;
  const fg = normalizeHex(colorId) || '#0f172a';
  return { id: 'custom', fg, bg: softBgFromFg(fg), label: 'Özel' };
}

export default function BarcodePage() {
  const { user } = useAuth();
  const { isOwned, loading: addonsLoading } = useAddons();
  const qrPack = isOwned('qr-pack');

  const [view, setView] = useState<ViewMode>('classic');
  const [paperSize, setPaperSize] = useState('a4');
  const [colorId, setColorId] = useState('black');
  const [withLogo, setWithLogo] = useState(false);
  const [tableCount, setTableCount] = useState(12);
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [editingTable, setEditingTable] = useState<number | null>(null);
  const [tableStyles, setTableStyles] = useState<Record<number, TableStyle>>({});
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([
    { id: '1', label: 'İftar Menüsü', slug: 'iftar' },
    { id: '2', label: 'Happy Hour', slug: 'happy-hour' },
  ]);
  const [campaignDraft, setCampaignDraft] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignItem | null>(null);

  const color = resolveColor(colorId);
  const logoSrc = user?.restaurant.logoUrl ? imageUrl(user.restaurant.logoUrl) : '';
  const origin = window.location.origin;

  const classicUrl = `${origin}/menu`;
  const tableUrl = selectedTable
    ? `${origin}/menu?masa=${selectedTable}`
    : classicUrl;
  const campaignUrl = selectedCampaign
    ? `${origin}/menu?kampanya=${selectedCampaign.slug}`
    : classicUrl;

  const activeUrl =
    view === 'tables' ? tableUrl : view === 'campaign' ? campaignUrl : classicUrl;

  const activeTitle =
    view === 'tables' && selectedTable
      ? getTableStyle(selectedTable).name
      : view === 'campaign' && selectedCampaign
        ? selectedCampaign.label
        : user?.restaurant.name || 'Menü';

  const tables = useMemo(
    () => Array.from({ length: Math.max(1, Math.min(60, tableCount)) }, (_, i) => i + 1),
    [tableCount]
  );

  function getTableStyle(n: number): TableStyle {
    return tableStyles[n] || defaultTableStyle(n);
  }

  function patchTableStyle(n: number, patch: Partial<TableStyle>) {
    setTableStyles((prev) => ({
      ...prev,
      [n]: { ...defaultTableStyle(n), ...prev[n], ...patch },
    }));
  }

  function handlePrint() {
    if (view === 'tables' && !selectedTable) {
      alert('Yazdırmak için bir masa seç');
      return;
    }
    if (view === 'campaign' && !selectedCampaign) {
      alert('Yazdırmak için bir kampanya seç');
      return;
    }
    window.print();
  }

  function addCampaign() {
    const label = campaignDraft.trim();
    if (!label) return;
    const slug = slugify(label) || `kampanya-${Date.now()}`;
    const item = { id: String(Date.now()), label, slug };
    setCampaigns((prev) => [...prev, item]);
    setCampaignDraft('');
    setSelectedCampaign(item);
  }

  if (addonsLoading) return <Spinner />;

  const selectedStyle = selectedTable ? getTableStyle(selectedTable) : null;
  const selectedColor = selectedStyle
    ? resolveColor(selectedStyle.colorId)
    : color;

  return (
    <div className="barcode-page">
      <PageHeader
        title="Barkod Yazdır"
        actions={
          <Button onClick={handlePrint}>
            <Printer className="w-4 h-4" /> Yazdır
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2 mb-5">
        {(
          [
            { id: 'classic', label: 'Klasik QR', icon: QrCode },
            { id: 'tables', label: 'Masa görünümü', icon: LayoutGrid, locked: !qrPack },
            { id: 'campaign', label: 'Kampanya', icon: Megaphone, locked: !qrPack },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const locked = 'locked' in tab && tab.locked;
          return (
            <button
              key={tab.id}
              type="button"
              disabled={locked}
              onClick={() => {
                setView(tab.id);
                setSelectedTable(null);
                setSelectedCampaign(null);
                setEditingTable(null);
              }}
              className={`barcode-mode-chip ${view === tab.id ? 'is-active' : ''} ${
                locked ? 'is-locked' : ''
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {locked && <Lock className="w-3.5 h-3.5 opacity-70" />}
            </button>
          );
        })}
      </div>

      {!qrPack && (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Sade siyah QR ücretsiz. Renk, logo, masa ve kampanya için{' '}
          <Link to="/admin/extensions/qr" className="font-semibold underline">
            Eklentiler → QR
          </Link>{' '}
          paketini Kod Gir ile aç.
        </div>
      )}

      <Card className="p-5 space-y-5">
        {view === 'classic' && (
          <>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide admin-text-muted mb-2">
                Kağıt boyutu
              </p>
              <select
                value={paperSize}
                onChange={(e) => setPaperSize(e.target.value)}
                className="w-full max-w-xs rounded-xl border px-4 py-2.5 text-sm"
                style={{
                  borderColor: 'var(--admin-card-border)',
                  background: 'var(--admin-input-bg)',
                  color: 'var(--admin-text)',
                }}
              >
                {PAPER_SIZES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {qrPack && (
              <>
                <ColorPicker value={colorId} onChange={setColorId} />
                <LogoToggle
                  checked={withLogo}
                  onChange={setWithLogo}
                  hasLogo={!!logoSrc}
                />
              </>
            )}

            <QrPreview
              title={activeTitle}
              subtitle="Dijital menümüze QR kod ile ulaşın"
              url={activeUrl}
              fg={qrPack ? color.fg : '#0f172a'}
              bg={qrPack ? color.bg : '#ffffff'}
              logo={qrPack && withLogo ? logoSrc : undefined}
              size={200}
            />
          </>
        )}

        {view === 'tables' && (
          <>
            <div className="w-36">
              <Input
                label="Masa sayısı"
                type="number"
                min={1}
                max={60}
                value={String(tableCount)}
                onChange={(e) => setTableCount(Number(e.target.value) || 1)}
              />
            </div>

            <div className="barcode-table-grid">
              {tables.map((n) => {
                const style = getTableStyle(n);
                const c = resolveColor(style.colorId);
                return (
                  <button
                    key={n}
                    type="button"
                    className={`barcode-table-card ${
                      selectedTable === n ? 'is-active' : ''
                    }`}
                    onClick={() => {
                      setSelectedTable(n);
                      setEditingTable(null);
                    }}
                  >
                    <QRCodeSVG
                      value={`${origin}/menu?masa=${n}`}
                      size={72}
                      level="M"
                      fgColor={c.fg}
                      bgColor={c.bg}
                      imageSettings={
                        style.withLogo && logoSrc
                          ? {
                              src: logoSrc,
                              height: 14,
                              width: 14,
                              excavate: true,
                            }
                          : undefined
                      }
                    />
                    <span>{style.name}</span>
                  </button>
                );
              })}
            </div>

            {selectedTable && selectedStyle && (
              <div className="barcode-enlarge">
                <div className="flex items-start justify-end mb-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTable(null);
                      setEditingTable(null);
                    }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--admin-accent-soft)] shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-4 mb-5">
                  <ColorPicker
                    value={selectedStyle.colorId}
                    onChange={(id) =>
                      patchTableStyle(selectedTable, { colorId: id })
                    }
                  />
                  <LogoToggle
                    checked={selectedStyle.withLogo}
                    onChange={(v) =>
                      patchTableStyle(selectedTable, { withLogo: v })
                    }
                    hasLogo={!!logoSrc}
                  />
                </div>

                <QrPreview
                  title={selectedStyle.name}
                  subtitle={user?.restaurant.name || ''}
                  url={tableUrl}
                  fg={selectedColor.fg}
                  bg={selectedColor.bg}
                  logo={
                    selectedStyle.withLogo && logoSrc ? logoSrc : undefined
                  }
                  size={220}
                  titleEditable
                  titleEditing={editingTable === selectedTable}
                  onTitleEditStart={() => setEditingTable(selectedTable)}
                  onTitleChange={(name) =>
                    patchTableStyle(selectedTable, { name })
                  }
                  onTitleEditEnd={() => {
                    const trimmed =
                      selectedStyle.name.trim() || `Masa ${selectedTable}`;
                    patchTableStyle(selectedTable, { name: trimmed });
                    setEditingTable(null);
                  }}
                />
                <Button className="w-full mt-4" onClick={handlePrint}>
                  <Printer className="w-4 h-4" /> Bu masayı yazdır
                </Button>
              </div>
            )}
          </>
        )}

        {view === 'campaign' && (
          <>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[180px]">
                <Input
                  label="Yeni kampanya adı"
                  value={campaignDraft}
                  onChange={(e) => setCampaignDraft(e.target.value)}
                  placeholder="Örn. Yaz Menüsü"
                />
              </div>
              <Button type="button" onClick={addCampaign}>
                <Plus className="w-4 h-4" /> Ekle
              </Button>
            </div>

            {qrPack && selectedCampaign && (
              <div className="space-y-4">
                <ColorPicker value={colorId} onChange={setColorId} />
                <LogoToggle
                  checked={withLogo}
                  onChange={setWithLogo}
                  hasLogo={!!logoSrc}
                />
              </div>
            )}

            <div className="space-y-2">
              {campaigns.map((c) => (
                <div
                  key={c.id}
                  className={`barcode-campaign-row ${
                    selectedCampaign?.id === c.id ? 'is-active' : ''
                  }`}
                >
                  <button
                    type="button"
                    className="flex-1 text-left min-w-0"
                    onClick={() => setSelectedCampaign(c)}
                  >
                    <p className="font-semibold text-[var(--admin-text)] truncate">
                      {c.label}
                    </p>
                    <p className="text-xs admin-text-muted truncate">
                      /menu?kampanya={c.slug}
                    </p>
                  </button>
                  <button
                    type="button"
                    className="p-2 rounded-lg text-red-500 hover:bg-red-50"
                    onClick={() => {
                      setCampaigns((prev) => prev.filter((x) => x.id !== c.id));
                      if (selectedCampaign?.id === c.id) setSelectedCampaign(null);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {selectedCampaign && (
              <div className="barcode-enlarge">
                <QrPreview
                  title={selectedCampaign.label}
                  subtitle={user?.restaurant.name || ''}
                  url={campaignUrl}
                  fg={color.fg}
                  bg={color.bg}
                  logo={withLogo && logoSrc ? logoSrc : undefined}
                  size={220}
                />
                <Button className="w-full mt-4" onClick={handlePrint}>
                  <Printer className="w-4 h-4" /> Kampanya QR yazdır
                </Button>
              </div>
            )}
          </>
        )}
      </Card>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            border: none !important;
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>
  );
}

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('#2563eb');
  const wrapRef = useRef<HTMLDivElement>(null);
  const isCustom = !QR_COLORS.some((c) => c.id === value);
  const customHex = normalizeHex(value) || draft;

  useEffect(() => {
    const hex = normalizeHex(value);
    if (hex) setDraft(hex);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function applyCustom(hex: string) {
    const next = normalizeHex(hex) || hex;
    setDraft(next);
    onChange(next.toLowerCase());
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide admin-text-muted mb-2">
        Renk
      </p>
      <div className="flex flex-wrap gap-2 items-center">
        {QR_COLORS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setOpen(false);
              onChange(c.id);
            }}
            className={`barcode-color-swatch ${value === c.id ? 'is-active' : ''}`}
            style={{ background: c.fg }}
            title={c.label}
          />
        ))}
        <div className="barcode-color-custom-wrap" ref={wrapRef}>
          <button
            type="button"
            className={`barcode-color-swatch barcode-color-custom ${
              isCustom || open ? 'is-active' : ''
            }`}
            title="Özel renk"
            aria-expanded={open}
            aria-haspopup="dialog"
            onClick={() => {
              const next = !open;
              setOpen(next);
              if (next && !isCustom) applyCustom(draft);
            }}
          >
            <span
              className="barcode-color-custom-face"
              style={isCustom ? { background: customHex } : undefined}
            />
          </button>

          {open && (
            <div className="barcode-color-popover" role="dialog" aria-label="Özel renk seç">
              <div className="barcode-color-popover-head">
                <span>Özel renk</span>
                <button
                  type="button"
                  className="barcode-color-popover-close"
                  onClick={() => setOpen(false)}
                  aria-label="Kapat"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <HexColorPicker color={customHex} onChange={applyCustom} />
              <div className="barcode-color-popover-foot">
                <span
                  className="barcode-color-popover-preview"
                  style={{ background: customHex }}
                />
                <HexColorInput
                  color={customHex}
                  onChange={applyCustom}
                  prefixed
                  className="barcode-color-hex-input"
                  aria-label="Hex renk kodu"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LogoToggle({
  checked,
  onChange,
  hasLogo,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  hasLogo: boolean;
}) {
  return (
    <label className="flex items-center gap-2.5 text-sm cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={!hasLogo}
        className="rounded accent-[var(--admin-accent)]"
      />
      Logo ortalı QR
      {!hasLogo && (
        <span className="text-xs admin-text-muted">(önce Ayarlar’dan logo yükle)</span>
      )}
    </label>
  );
}

function QrPreview({
  title,
  subtitle,
  url,
  fg,
  bg,
  logo,
  size,
  titleEditable,
  titleEditing,
  onTitleEditStart,
  onTitleChange,
  onTitleEditEnd,
}: {
  title: string;
  subtitle: string;
  url: string;
  fg: string;
  bg: string;
  logo?: string;
  size: number;
  titleEditable?: boolean;
  titleEditing?: boolean;
  onTitleEditStart?: () => void;
  onTitleChange?: (name: string) => void;
  onTitleEditEnd?: () => void;
}) {
  return (
    <div
      id="print-area"
      className="flex flex-col items-center gap-4 p-8 border border-dashed rounded-2xl"
      style={{
        borderColor: 'var(--admin-card-border)',
        background: bg,
      }}
    >
      {titleEditable && titleEditing ? (
        <input
          autoFocus
          className="barcode-qr-title-input"
          value={title}
          onChange={(e) => onTitleChange?.(e.target.value)}
          onBlur={() => onTitleEditEnd?.()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') {
              (e.target as HTMLInputElement).blur();
            }
          }}
          style={{ color: fg, borderColor: fg }}
        />
      ) : (
        <h2
          className={`text-xl font-bold text-center ${
            titleEditable ? 'barcode-qr-title-editable' : ''
          }`}
          style={{ color: fg }}
          title={titleEditable ? 'Tıkla — adı değiştir' : undefined}
          onClick={titleEditable ? onTitleEditStart : undefined}
        >
          {title}
        </h2>
      )}
      {subtitle && (
        <p className="text-sm text-center opacity-70" style={{ color: fg }}>
          {subtitle}
        </p>
      )}
      <QRCodeSVG
        value={url}
        size={size}
        level="H"
        fgColor={fg}
        bgColor={bg}
        imageSettings={
          logo
            ? {
                src: logo,
                height: Math.round(size * 0.18),
                width: Math.round(size * 0.18),
                excavate: true,
              }
            : undefined
        }
      />
      <p className="text-xs break-all text-center max-w-xs opacity-60" style={{ color: fg }}>
        {url}
      </p>
    </div>
  );
}
