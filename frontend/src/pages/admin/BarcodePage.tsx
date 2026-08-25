import { useMemo, useState } from 'react';
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
  { id: 'forest', fg: '#14532d', bg: '#f0fdf4', label: 'Yeşil' },
  { id: 'wine', fg: '#7f1d1d', bg: '#fff1f2', label: 'Bordo' },
  { id: 'gold', fg: '#78350f', bg: '#fffbeb', label: 'Altın' },
];

interface CampaignItem {
  id: string;
  label: string;
  slug: string;
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
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([
    { id: '1', label: 'İftar Menüsü', slug: 'iftar' },
    { id: '2', label: 'Happy Hour', slug: 'happy-hour' },
  ]);
  const [campaignDraft, setCampaignDraft] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignItem | null>(null);

  const color = QR_COLORS.find((c) => c.id === colorId) || QR_COLORS[0];
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
      ? `Masa ${selectedTable}`
      : view === 'campaign' && selectedCampaign
        ? selectedCampaign.label
        : user?.restaurant.name || 'Menü';

  const tables = useMemo(
    () => Array.from({ length: Math.max(1, Math.min(60, tableCount)) }, (_, i) => i + 1),
    [tableCount]
  );

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

      <div className="grid lg:grid-cols-[1fr_320px] gap-5 items-start">
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
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide admin-text-muted mb-2">
                      Renk
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {QR_COLORS.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setColorId(c.id)}
                          className={`barcode-color-swatch ${
                            colorId === c.id ? 'is-active' : ''
                          }`}
                          style={{ background: c.fg }}
                          title={c.label}
                        />
                      ))}
                    </div>
                  </div>

                  <label className="flex items-center gap-2.5 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={withLogo}
                      onChange={(e) => setWithLogo(e.target.checked)}
                      disabled={!logoSrc}
                      className="rounded accent-[var(--admin-accent)]"
                    />
                    Logo ortalı QR
                    {!logoSrc && (
                      <span className="text-xs admin-text-muted">(önce Ayarlar’dan logo yükle)</span>
                    )}
                  </label>
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
              <div className="flex flex-wrap items-end gap-3">
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
                <p className="text-xs admin-text-muted pb-2">
                  Link örneği: <code className="text-[11px]">/menu?masa=5</code>
                </p>
              </div>

              <div className="barcode-table-grid">
                {tables.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`barcode-table-card ${
                      selectedTable === n ? 'is-active' : ''
                    }`}
                    onClick={() => setSelectedTable(n)}
                  >
                    <QRCodeSVG
                      value={`${origin}/menu?masa=${n}`}
                      size={72}
                      level="M"
                      fgColor={color.fg}
                      bgColor={color.bg}
                    />
                    <span>Masa {n}</span>
                  </button>
                ))}
              </div>

              {selectedTable && (
                <div className="barcode-enlarge">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-[var(--admin-text)]">Masa {selectedTable}</h3>
                    <button
                      type="button"
                      onClick={() => setSelectedTable(null)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--admin-accent-soft)]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <QrPreview
                    title={`Masa ${selectedTable}`}
                    subtitle={user?.restaurant.name || ''}
                    url={tableUrl}
                    fg={color.fg}
                    bg={color.bg}
                    logo={withLogo && logoSrc ? logoSrc : undefined}
                    size={220}
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
                      <p className="font-semibold text-[var(--admin-text)] truncate">{c.label}</p>
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

        <Card className="p-5 space-y-3">
          <h3 className="text-sm font-bold text-[var(--admin-text)]">Özet</h3>
          <p className="text-xs admin-text-muted leading-relaxed">
            Klasik QR her zaman ücretsiz. Masa ve kampanya linkleri istatistik / karşılama için
            URL’de taşınır.
          </p>
          <div
            className="rounded-xl p-3 text-xs break-all"
            style={{ background: 'var(--admin-input-bg)' }}
          >
            {activeUrl}
          </div>
        </Card>
      </div>

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

function QrPreview({
  title,
  subtitle,
  url,
  fg,
  bg,
  logo,
  size,
}: {
  title: string;
  subtitle: string;
  url: string;
  fg: string;
  bg: string;
  logo?: string;
  size: number;
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
      <h2 className="text-xl font-bold text-center" style={{ color: fg }}>
        {title}
      </h2>
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
