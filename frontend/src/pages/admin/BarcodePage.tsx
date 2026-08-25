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
import { api, imageUrl } from '@/lib/api';

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
  { id: 'wine', fg: '#7f1d1d', bg: '#fff1f2', label: 'Bordo' },
  { id: 'rose', fg: '#be123c', bg: '#fff1f2', label: 'Gül' },
  { id: 'coral', fg: '#c2410c', bg: '#fff7ed', label: 'Mercan' },
  { id: 'gold', fg: '#78350f', bg: '#fffbeb', label: 'Altın' },
  { id: 'amber', fg: '#b45309', bg: '#fffbeb', label: 'Amber' },
  { id: 'purple', fg: '#5b21b6', bg: '#f5f3ff', label: 'Mor' },
  { id: 'slate', fg: '#475569', bg: '#f8fafc', label: 'Gri' },
];

const QR_FRAMES = [
  { id: 'ince', label: 'İnce' },
  { id: 'kalin', label: 'Kalın' },
  { id: 'soft', label: 'Soft' },
  { id: 'kesik', label: 'Kesik' },
  { id: 'kose', label: 'Köşe' },
  { id: 'halka', label: 'Halka' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'lux', label: 'Lüks' },
] as const;

type FrameId = (typeof QR_FRAMES)[number]['id'];

interface CampaignItem {
  id: string;
  label: string;
  slug: string;
}

interface TableStyle {
  name: string;
  colorId: string;
  withLogo: boolean;
  frameId: FrameId;
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
  return { name: `Masa ${n}`, colorId: 'black', withLogo: false, frameId: 'minimal' };
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
  const [frameId, setFrameId] = useState<FrameId>('minimal');
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
  const [logoPath, setLogoPath] = useState<string | null>(
    user?.restaurant.logoUrl ?? null
  );

  useEffect(() => {
    setLogoPath(user?.restaurant.logoUrl ?? null);
  }, [user?.restaurant.logoUrl]);

  useEffect(() => {
    api<{ restaurant: { logoUrl?: string | null } }>('/api/admin/settings')
      .then((d) => {
        if (d.restaurant.logoUrl) setLogoPath(d.restaurant.logoUrl);
      })
      .catch(() => {});
  }, []);

  const logoSrc = logoPath ? imageUrl(logoPath) : '';
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
    const base = defaultTableStyle(n);
    const prev = tableStyles[n];
    if (!prev) return base;
    const frameOk = QR_FRAMES.some((f) => f.id === prev.frameId);
    return {
      ...base,
      ...prev,
      frameId: frameOk ? prev.frameId : base.frameId,
    };
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
              <QrCustomizePanel
                colorId={colorId}
                onColorChange={setColorId}
                withLogo={withLogo}
                onLogoChange={setWithLogo}
                hasLogo={!!logoSrc}
                frameId={frameId}
                onFrameChange={setFrameId}
                accent={color.fg}
              />
            )}

            <QrPreview
              title={activeTitle}
              subtitle="Dijital menümüze QR kod ile ulaşın"
              url={activeUrl}
              fg={qrPack ? color.fg : '#0f172a'}
              bg={qrPack ? color.bg : '#ffffff'}
              logo={qrPack && withLogo ? logoSrc : undefined}
              frameId={qrPack ? frameId : 'minimal'}
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
                              height: 22,
                              width: 22,
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

                <div className="mb-5">
                  <QrCustomizePanel
                    colorId={selectedStyle.colorId}
                    onColorChange={(id) =>
                      patchTableStyle(selectedTable, { colorId: id })
                    }
                    withLogo={selectedStyle.withLogo}
                    onLogoChange={(v) =>
                      patchTableStyle(selectedTable, { withLogo: v })
                    }
                    hasLogo={!!logoSrc}
                    frameId={selectedStyle.frameId}
                    onFrameChange={(id) =>
                      patchTableStyle(selectedTable, { frameId: id })
                    }
                    accent={selectedColor.fg}
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
                  frameId={selectedStyle.frameId}
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
              <QrCustomizePanel
                colorId={colorId}
                onColorChange={setColorId}
                withLogo={withLogo}
                onLogoChange={setWithLogo}
                hasLogo={!!logoSrc}
                frameId={frameId}
                onFrameChange={setFrameId}
                accent={color.fg}
              />
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
                  frameId={qrPack ? frameId : 'minimal'}
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

function FrameOrnament({ frameId, color }: { frameId: FrameId; color: string }) {
  const c = color || '#0f172a';
  return (
    <svg
      className="barcode-qr-frame-ornament"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
      style={{ color: c }}
    >
      {frameId === 'ince' && (
        <g fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round">
          <path d="M14 28c0-10 8-16 18-16M28 14c10 0 16 8 16 18" />
          <path d="M72 14c10 0 16 8 16 18M86 28c0-10-8-16-18-16" />
          <path d="M14 72c0 10 8 16 18 16M28 86c10 0 16-8 16-18" />
          <path d="M72 86c10 0 16-8 16-18M86 72c0 10-8 16-18 16" />
          <circle cx="18" cy="18" r="2.6" fill={c} stroke="none" />
          <circle cx="82" cy="18" r="2.6" fill={c} stroke="none" />
          <circle cx="18" cy="82" r="2.6" fill={c} stroke="none" />
          <circle cx="82" cy="82" r="2.6" fill={c} stroke="none" />
          <path d="M22 16c3-4 8-4 10-1M78 16c-3-4-8-4-10-1M22 84c3 4 8 4 10 1M78 84c-3 4-8 4-10 1" />
        </g>
      )}
      {frameId === 'kalin' && (
        <g fill="none" stroke={c} strokeWidth="3.2" strokeLinecap="round">
          <path d="M12 30 V16 H30" />
          <path d="M70 16 H88 V30" />
          <path d="M12 70 V84 H30" />
          <path d="M70 84 H88 V70" />
          <path d="M20 20c6-8 14-8 18-2M80 20c-6-8-14-8-18-2M20 80c6 8 14 8 18 2M80 80c-6 8-14 8-18 2" />
          <circle cx="16" cy="16" r="3.2" fill={c} stroke="none" />
          <circle cx="84" cy="16" r="3.2" fill={c} stroke="none" />
          <circle cx="16" cy="84" r="3.2" fill={c} stroke="none" />
          <circle cx="84" cy="84" r="3.2" fill={c} stroke="none" />
        </g>
      )}
      {frameId === 'soft' && (
        <g fill={c} stroke="none">
          <path d="M18 22c0-8 8-14 16-12 2 6-2 12-8 14-4 1-8-1-8-2z" opacity="0.9" />
          <path d="M82 22c0-8-8-14-16-12-2 6 2 12 8 14 4 1 8-1 8-2z" opacity="0.9" />
          <path d="M18 78c0 8 8 14 16 12 2-6-2-12-8-14-4-1-8 1-8 2z" opacity="0.9" />
          <path d="M82 78c0 8-8 14-16 12-2-6 2-12 8-14 4-1 8 1 8 2z" opacity="0.9" />
          <g fill="none" stroke={c} strokeWidth="1.4" opacity="0.55">
            <rect x="22" y="22" width="56" height="56" rx="14" />
          </g>
        </g>
      )}
      {frameId === 'kesik' && (
        <g fill="none" stroke={c} strokeWidth="1.6" strokeDasharray="3.5 3.5" strokeLinecap="round">
          <rect x="16" y="16" width="68" height="68" rx="6" />
          <g fill={c} stroke="none">
            <circle cx="16" cy="16" r="2.4" />
            <circle cx="84" cy="16" r="2.4" />
            <circle cx="16" cy="84" r="2.4" />
            <circle cx="84" cy="84" r="2.4" />
            <circle cx="50" cy="14" r="1.6" />
            <circle cx="50" cy="86" r="1.6" />
            <circle cx="14" cy="50" r="1.6" />
            <circle cx="86" cy="50" r="1.6" />
          </g>
        </g>
      )}
      {frameId === 'kose' && (
        <g fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round">
          <path d="M14 34c2-14 10-20 22-22M34 14c-4 6-2 12 2 16" />
          <path d="M12 20c8-2 14 2 16 8M20 12c2 8-2 14-8 16" />
          <path d="M86 34c-2-14-10-20-22-22M66 14c4 6 2 12-2 16" />
          <path d="M88 20c-8-2-14 2-16 8M80 12c-2 8 2 14 8 16" />
          <path d="M14 66c2 14 10 20 22 22M34 86c-4-6-2-12 2-16" />
          <path d="M12 80c8 2 14-2 16-8M20 88c2-8-2-14-8-16" />
          <path d="M86 66c-2 14-10 20-22 22M66 86c4-6 2-12-2-16" />
          <path d="M88 80c-8 2-14-2-16-8M80 88c-2-8 2-14 8-16" />
          <circle cx="18" cy="18" r="2" fill={c} stroke="none" />
          <circle cx="82" cy="18" r="2" fill={c} stroke="none" />
          <circle cx="18" cy="82" r="2" fill={c} stroke="none" />
          <circle cx="82" cy="82" r="2" fill={c} stroke="none" />
        </g>
      )}
      {frameId === 'halka' && (
        <g fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round">
          <circle cx="50" cy="50" r="42" opacity="0.35" />
          <circle cx="50" cy="50" r="38" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
            const r = 40;
            const a = (deg * Math.PI) / 180;
            const x = 50 + r * Math.cos(a);
            const y = 50 + r * Math.sin(a);
            return (
              <g key={deg} transform={`translate(${x} ${y}) rotate(${deg + 90})`}>
                <path d="M0 0c2-5 6-6 8-3-3 2-5 5-8 3z" fill={c} stroke="none" />
              </g>
            );
          })}
        </g>
      )}
      {frameId === 'minimal' && (
        <g fill={c} stroke="none">
          <circle cx="14" cy="14" r="1.8" />
          <circle cx="86" cy="14" r="1.8" />
          <circle cx="14" cy="86" r="1.8" />
          <circle cx="86" cy="86" r="1.8" />
          <g fill="none" stroke={c} strokeWidth="1" opacity="0.45">
            <path d="M20 14h10M14 20v10M70 14h10M86 20v10M20 86h10M14 70v10M70 86h10M86 70v10" />
          </g>
        </g>
      )}
      {frameId === 'lux' && (
        <g fill="none" stroke={c} strokeLinecap="round">
          <rect x="14" y="14" width="72" height="72" rx="4" strokeWidth="1.2" />
          <rect x="18" y="18" width="64" height="64" rx="2" strokeWidth="0.8" opacity="0.45" />
          <path
            d="M26 18c6-8 14-8 20 0M74 18c-6-8-14-8-20 0M26 82c6 8 14 8 20 0M74 82c-6 8-14 8-20 0"
            strokeWidth="1.4"
          />
          <path
            d="M18 26c-8 6-8 14 0 20M18 74c-8-6-8-14 0-20M82 26c8 6 8 14 0 20M82 74c8-6 8-14 0-20"
            strokeWidth="1.4"
          />
          <circle cx="50" cy="14" r="2.4" fill={c} stroke="none" />
          <circle cx="50" cy="86" r="2.4" fill={c} stroke="none" />
          <circle cx="14" cy="50" r="2.4" fill={c} stroke="none" />
          <circle cx="86" cy="50" r="2.4" fill={c} stroke="none" />
          <circle cx="22" cy="22" r="1.6" fill={c} stroke="none" />
          <circle cx="78" cy="22" r="1.6" fill={c} stroke="none" />
          <circle cx="22" cy="78" r="1.6" fill={c} stroke="none" />
          <circle cx="78" cy="78" r="1.6" fill={c} stroke="none" />
        </g>
      )}
    </svg>
  );
}

function QrCustomizePanel({
  colorId,
  onColorChange,
  withLogo,
  onLogoChange,
  hasLogo,
  frameId,
  onFrameChange,
  accent,
}: {
  colorId: string;
  onColorChange: (id: string) => void;
  withLogo: boolean;
  onLogoChange: (v: boolean) => void;
  hasLogo: boolean;
  frameId: FrameId;
  onFrameChange: (id: FrameId) => void;
  accent: string;
}) {
  return (
    <div className="barcode-customize">
      <div className="barcode-customize-left space-y-4">
        <ColorPicker value={colorId} onChange={onColorChange} />
        <LogoToggle checked={withLogo} onChange={onLogoChange} hasLogo={hasLogo} />
      </div>
      <div className="barcode-customize-divider" aria-hidden />
      <div className="barcode-customize-right">
        <p className="text-xs font-semibold uppercase tracking-wide admin-text-muted mb-2">
          QR Çerçevesi
        </p>
        <div className="barcode-frame-grid">
          {QR_FRAMES.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`barcode-frame-chip ${frameId === f.id ? 'is-active' : ''}`}
              onClick={() => onFrameChange(f.id)}
            >
              <span className="barcode-frame-thumb">
                <FrameOrnament frameId={f.id} color={accent} />
                <span className="barcode-frame-thumb-qr" />
              </span>
              <span className="barcode-frame-chip-label">{f.label}</span>
            </button>
          ))}
        </div>
      </div>
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
      <div className="barcode-color-row">
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
    <label
      className={`flex items-center gap-2.5 text-sm select-none ${
        hasLogo ? 'cursor-pointer text-[var(--admin-text)]' : 'cursor-not-allowed opacity-60'
      }`}
    >
      <input
        type="checkbox"
        checked={checked && hasLogo}
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
  frameId = 'minimal',
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
  frameId?: FrameId;
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
      <div className={`barcode-qr-frame barcode-qr-frame--${frameId}`}>
        <FrameOrnament frameId={frameId} color={fg} />
        <div className="barcode-qr-frame-inner">
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
                    height: Math.round(size * 0.26),
                    width: Math.round(size * 0.26),
                    excavate: true,
                  }
                : undefined
            }
          />
        </div>
      </div>
      <p className="text-xs break-all text-center max-w-xs opacity-60" style={{ color: fg }}>
        {url}
      </p>
    </div>
  );
}
