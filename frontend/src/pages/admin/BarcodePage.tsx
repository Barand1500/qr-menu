import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
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
import { Button, Card, Input, PageHeader, Select, Spinner } from '@/components/ui';
import { api, imageUrl } from '@/lib/api';
import AddTableGroupModal from '@/components/AddTableGroupModal';

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
  { id: 'yok', label: 'Yok' },
  { id: 'ince', label: 'İnce' },
  { id: 'kalin', label: 'Kalın' },
  { id: 'kelebek', label: 'Kelebek' },
  { id: 'kesik', label: 'Kesik' },
  { id: 'halka', label: 'Halka' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'sarma', label: 'Sarmaşık' },
] as const;

type FrameId = (typeof QR_FRAMES)[number]['id'];

interface CampaignItem {
  id: string;
  label: string;
  slug: string;
}

interface TableGroup {
  id: string;
  name: string;
  count: number;
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

function defaultTableStyle(n: number, groupName = 'Masa'): TableStyle {
  return {
    name: `${groupName} ${n}`,
    colorId: 'black',
    withLogo: false,
    frameId: 'yok',
  };
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
  const [frameId, setFrameId] = useState<FrameId>('yok');
  const [groups, setGroups] = useState<TableGroup[]>([
    { id: 'salon', name: 'Salon', count: 12 },
    { id: 'teras', name: 'Teras', count: 8 },
  ]);
  const [activeGroupId, setActiveGroupId] = useState('salon');
  const [groupStyles, setGroupStyles] = useState<
    Record<string, Record<number, TableStyle>>
  >({});
  const [addingGroup, setAddingGroup] = useState(false);
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [editingTable, setEditingTable] = useState<number | null>(null);
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
  const activeGroup =
    groups.find((g) => g.id === activeGroupId) || groups[0] || null;

  const classicUrl = `${origin}/menu`;
  const tableUrl =
    selectedTable && activeGroup
      ? `${origin}/menu?masa=${selectedTable}&grup=${activeGroup.id}`
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

  const tables = useMemo(() => {
    const count = activeGroup ? Math.max(1, Math.min(60, activeGroup.count)) : 0;
    return Array.from({ length: count }, (_, i) => i + 1);
  }, [activeGroup]);

  function getTableStyle(n: number): TableStyle {
    const groupName = activeGroup?.name || 'Masa';
    const base = defaultTableStyle(n, groupName);
    const prev = activeGroupId ? groupStyles[activeGroupId]?.[n] : undefined;
    if (!prev) return base;
    const frameOk = QR_FRAMES.some((f) => f.id === prev.frameId);
    return {
      ...base,
      ...prev,
      frameId: frameOk ? prev.frameId : base.frameId,
    };
  }

  function patchTableStyle(n: number, patch: Partial<TableStyle>) {
    if (!activeGroupId || !activeGroup) return;
    setGroupStyles((prev) => ({
      ...prev,
      [activeGroupId]: {
        ...prev[activeGroupId],
        [n]: {
          ...defaultTableStyle(n, activeGroup.name),
          ...prev[activeGroupId]?.[n],
          ...patch,
        },
      },
    }));
  }

  function setActiveGroupCount(count: number) {
    const next = Math.max(1, Math.min(60, count || 1));
    setGroups((prev) =>
      prev.map((g) => (g.id === activeGroupId ? { ...g, count: next } : g))
    );
  }

  function createGroup(data: { name: string; count: number }) {
    const name = data.name.trim();
    if (!name) return;
    let id = slugify(name) || `grup-${Date.now()}`;
    if (groups.some((g) => g.id === id)) id = `${id}-${Date.now()}`;
    const item: TableGroup = {
      id,
      name,
      count: Math.max(1, Math.min(60, data.count || 8)),
    };
    setGroups((prev) => [...prev, item]);
    setActiveGroupId(id);
    setSelectedTable(null);
    setEditingTable(null);
  }

  function deleteActiveGroup() {
    if (groups.length <= 1 || !activeGroup) return;
    if (!confirm(`“${activeGroup.name}” grubunu silmek istiyor musun?`)) return;
    const next = groups.filter((g) => g.id !== activeGroup.id);
    setGroups(next);
    setActiveGroupId(next[0].id);
    setGroupStyles((prev) => {
      const copy = { ...prev };
      delete copy[activeGroup.id];
      return copy;
    });
    setSelectedTable(null);
    setEditingTable(null);
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
          view === 'tables' ? (
            <Button
              type="button"
              onClick={() => setAddingGroup(true)}
            >
              <Plus className="w-4 h-4" /> Grup Ekle
            </Button>
          ) : (
            <Button onClick={handlePrint}>
              <Printer className="w-4 h-4" /> Yazdır
            </Button>
          )
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
                setAddingGroup(false);
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
              frameId={qrPack ? frameId : 'yok'}
              size={200}
            />
          </>
        )}

        {view === 'tables' && activeGroup && (
          <>
            <div className="barcode-group-toolbar">
              <div className="barcode-group-field">
                <Select
                  label="Grup"
                  value={activeGroupId}
                  onChange={(e) => {
                    setActiveGroupId(e.target.value);
                    setSelectedTable(null);
                    setEditingTable(null);
                  }}
                  options={groups.map((g) => ({
                    value: g.id,
                    label: g.name,
                  }))}
                />
              </div>
              <div className="barcode-group-field barcode-group-field--count">
                <Input
                  label="Masa sayısı"
                  type="number"
                  min={1}
                  max={60}
                  value={String(activeGroup.count)}
                  onChange={(e) =>
                    setActiveGroupCount(Number(e.target.value) || 1)
                  }
                />
              </div>
              {groups.length > 1 && (
                <button
                  type="button"
                  className="barcode-group-delete"
                  title="Grubu sil"
                  onClick={deleteActiveGroup}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="barcode-table-grid">
              {tables.map((n) => {
                const style = getTableStyle(n);
                const c = resolveColor(style.colorId);
                const masaUrl = `${origin}/menu?masa=${n}&grup=${activeGroup.id}`;
                return (
                  <button
                    key={`${activeGroup.id}-${n}`}
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
                      value={masaUrl}
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
                  frameId={qrPack ? frameId : 'yok'}
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

      <AddTableGroupModal
        open={addingGroup}
        onClose={() => setAddingGroup(false)}
        onAdd={createGroup}
      />

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

function FloralCorner({ variant }: { variant: FrameId }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  if (variant === 'yok') {
    return null;
  }

  if (variant === 'ince') {
    return (
      <svg viewBox="0 0 40 40" width="100%" height="100%" aria-hidden>
        <path {...common} strokeWidth="1.6" d="M6 28V10h18" />
        <path {...common} strokeWidth="1.4" d="M10 10c4-7 12-7 16 0" />
        <circle cx="10" cy="10" r="2.2" fill="currentColor" />
        <path fill="currentColor" d="M18 6c3-4 8-3 9 1-4 1-7 3-9-1z" />
      </svg>
    );
  }

  if (variant === 'kalin') {
    return (
      <svg viewBox="0 0 40 40" width="100%" height="100%" aria-hidden>
        <path {...common} strokeWidth="3.4" d="M5 30V8h22" />
        <path {...common} strokeWidth="2.2" d="M12 8c5-8 14-7 18 1" />
        <circle cx="8" cy="8" r="3" fill="currentColor" />
        <path fill="currentColor" d="M20 4c4-5 10-4 11 2-5 0-9 3-11-2z" />
        <path fill="currentColor" d="M4 20c-5 4-4 10 2 11 0-5 3-9-2-11z" />
      </svg>
    );
  }

  if (variant === 'kelebek') {
    return (
      <svg viewBox="0 0 40 40" width="100%" height="100%" aria-hidden>
        {/* Sol kanat */}
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
        {/* Sağ kanat (üst-köşe motifi için kısmi) */}
        <path
          fill="currentColor"
          d="M19 19c2-7 8-12 14-11-2 6-7 10-14 11z"
          opacity="0.85"
        />
        {/* Gövde */}
        <ellipse cx="18.5" cy="20" rx="1.4" ry="4.2" fill="currentColor" />
        <circle cx="18.5" cy="16.2" r="1.3" fill="currentColor" />
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          d="M17.2 14.5c-1.5-2.5-0.5-4.5 0.5-5M19.8 14.5c1.5-2.5 0.5-4.5-0.5-5"
        />
        {/* Nokta detay */}
        <circle cx="12" cy="12" r="1.1" fill="currentColor" opacity="0.55" />
        <circle cx="11" cy="26" r="1" fill="currentColor" opacity="0.45" />
      </svg>
    );
  }

  if (variant === 'kesik') {
    return (
      <svg viewBox="0 0 40 40" width="100%" height="100%" aria-hidden>
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
  }

  if (variant === 'halka') {
    return (
      <svg viewBox="0 0 40 40" width="100%" height="100%" aria-hidden>
        <path {...common} strokeWidth="2" d="M8 28a20 20 0 0 1 20-20" />
        <path {...common} strokeWidth="1.3" opacity="0.45" d="M12 30a18 18 0 0 1 18-18" />
        <path fill="currentColor" d="M24 6c3-4 8-3 9 2-4 0-7 2-9-2z" />
        <path fill="currentColor" d="M6 24c-4 3-3 8 2 9 0-4 2-7-2-9z" />
        <circle cx="12" cy="12" r="2.3" fill="currentColor" />
      </svg>
    );
  }

  if (variant === 'minimal') {
    return (
      <svg viewBox="0 0 40 40" width="100%" height="100%" aria-hidden>
        <path {...common} strokeWidth="2.2" d="M8 24V10h14" />
        <circle cx="10" cy="10" r="1.8" fill="currentColor" />
      </svg>
    );
  }

  // sarmaşık + çiçek
  return (
    <svg viewBox="0 0 40 40" width="100%" height="100%" aria-hidden>
      {/* Sarmaşık gövdesi */}
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
      {/* Yapraklar */}
      <path fill="currentColor" d="M14 18c-4-5-2-9 2-10 1 4-1 8-2 10z" />
      <path fill="currentColor" d="M20 12c3-5 8-5 10-1-4 2-7 4-10 1z" opacity="0.9" />
      <path fill="currentColor" d="M12 24c-5-2-7 2-5 6 3-1 5-3 5-6z" opacity="0.85" />
      {/* Çiçek */}
      <circle cx="28" cy="10" r="2.2" fill="currentColor" />
      <circle cx="25.2" cy="8.2" r="1.5" fill="currentColor" opacity="0.8" />
      <circle cx="30.8" cy="8.2" r="1.5" fill="currentColor" opacity="0.8" />
      <circle cx="25.2" cy="11.8" r="1.5" fill="currentColor" opacity="0.8" />
      <circle cx="30.8" cy="11.8" r="1.5" fill="currentColor" opacity="0.8" />
      <circle cx="28" cy="10" r="1" fill="#fff" opacity="0.9" />
      {/* Küçük tomurcuk */}
      <circle cx="10" cy="14" r="1.4" fill="currentColor" />
      <circle cx="16" cy="28" r="1.2" fill="currentColor" opacity="0.7" />
    </svg>
  );
}

function QrFrameShell({
  frameId,
  color,
  children,
  thumb,
}: {
  frameId: FrameId;
  color: string;
  children: ReactNode;
  thumb?: boolean;
}) {
  const bare = frameId === 'yok';
  return (
    <div
      className={`barcode-qr-frame barcode-qr-frame--${frameId}${thumb ? ' is-thumb' : ''}`}
      style={{ ['--qr-frame-color' as string]: color || '#0f172a' }}
    >
      {!bare && <span className="barcode-qr-frame-ring" aria-hidden />}
      {!bare && (
        <>
          <span className="barcode-qr-frame-c tl" aria-hidden>
            <FloralCorner variant={frameId} />
          </span>
          <span className="barcode-qr-frame-c tr" aria-hidden>
            <FloralCorner variant={frameId} />
          </span>
          <span className="barcode-qr-frame-c bl" aria-hidden>
            <FloralCorner variant={frameId} />
          </span>
          <span className="barcode-qr-frame-c br" aria-hidden>
            <FloralCorner variant={frameId} />
          </span>
        </>
      )}
      <div className="barcode-qr-frame-inner">{children}</div>
    </div>
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
              <QrFrameShell frameId={f.id} color={accent} thumb>
                <span className="barcode-frame-thumb-qr" />
              </QrFrameShell>
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
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const isCustom = !QR_COLORS.some((c) => c.id === value);
  const customHex = normalizeHex(value) || draft;

  useEffect(() => {
    const hex = normalizeHex(value);
    if (hex) setDraft(hex);
  }, [value]);

  useEffect(() => {
    if (!open || !btnRef.current) return;
    function place() {
      const r = btnRef.current!.getBoundingClientRect();
      const width = 220;
      let left = r.right - width;
      left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
      const top = Math.min(r.bottom + 8, window.innerHeight - 320);
      setPos({ top, left });
    }
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let remove: (() => void) | undefined;
    const timer = window.setTimeout(() => {
      function onDoc(e: MouseEvent) {
        const t = e.target as Node;
        if (wrapRef.current?.contains(t) || popoverRef.current?.contains(t)) return;
        setOpen(false);
      }
      function onKey(e: KeyboardEvent) {
        if (e.key === 'Escape') setOpen(false);
      }
      document.addEventListener('mousedown', onDoc);
      document.addEventListener('keydown', onKey);
      remove = () => {
        document.removeEventListener('mousedown', onDoc);
        document.removeEventListener('keydown', onKey);
      };
    }, 0);
    return () => {
      window.clearTimeout(timer);
      remove?.();
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
            ref={btnRef}
            type="button"
            className={`barcode-color-swatch barcode-color-custom ${
              isCustom || open ? 'is-active' : ''
            }`}
            title="Özel renk"
            aria-expanded={open}
            aria-haspopup="dialog"
            onClick={(e) => {
              e.stopPropagation();
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

          {open &&
            createPortal(
              <div
                ref={popoverRef}
                className="barcode-color-popover"
                role="dialog"
                aria-label="Özel renk seç"
                style={{ top: pos.top, left: pos.left }}
              >
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
              </div>,
              document.body
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
  frameId = 'yok',
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
      <QrFrameShell frameId={frameId} color={fg}>
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
      </QrFrameShell>
      <p className="text-xs break-all text-center max-w-xs opacity-60" style={{ color: fg }}>
        {url}
      </p>
    </div>
  );
}
