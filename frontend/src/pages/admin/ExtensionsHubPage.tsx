import { useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Check,
  KeyRound,
  Lock,
  ShoppingBag,
  QrCode,
  Settings2,
  Sparkles,
  Languages,
} from 'lucide-react';
import { Button, Card, PageHeader, Spinner } from '@/components/ui';
import UnlockAddonModal from '@/components/UnlockAddonModal';
import SupportContactModal from '@/components/SupportContactModal';
import LinearThemeSettingsModal from '@/components/LinearThemeSettingsModal';
import AnimasyonThemeSettingsModal from '@/components/AnimasyonThemeSettingsModal';
import { useAddons } from '@/hooks/useAddons';
import MenuAssistantStylePicker from '@/components/MenuAssistantStylePicker';
import type { AddonCategory, AddonProduct } from '@/addons';
import type { MenuAssistantStyle } from '@/lib/menuAssistantStyle';
import type { LinearThemeConfig } from '@/lib/menuLinearConfig';
import type { AnimasyonThemeConfig } from '@/lib/menuAnimasyonConfig';

type TabId = 'all' | 'welcome' | 'menu' | 'qr' | 'lang' | 'feature';

const TABS: { id: TabId; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'welcome', label: 'Karşılama' },
  { id: 'menu', label: 'Menü' },
  { id: 'qr', label: 'QR' },
  { id: 'lang', label: 'Dil' },
  { id: 'feature', label: 'Özellik' },
];

function matchesTab(product: AddonProduct, tab: TabId) {
  if (tab === 'all') return true;
  return product.category === tab;
}

function categoryBadge(category: AddonCategory) {
  if (category === 'welcome') return 'Karşılama';
  if (category === 'menu') return 'Menü';
  if (category === 'qr') return 'QR';
  if (category === 'feature') return 'Özellik';
  return 'Dil';
}

function parseTab(raw: string | null): TabId {
  if (
    raw === 'welcome' ||
    raw === 'menu' ||
    raw === 'qr' ||
    raw === 'lang' ||
    raw === 'feature' ||
    raw === 'all'
  ) {
    return raw;
  }
  // Eski “Başlangıç” linkleri → Karşılama
  if (raw === 'startup') return 'welcome';
  return 'all';
}

export default function ExtensionsHubPage() {
  const {
    products,
    loading,
    unlock,
    setEnabled,
    menuAssistantStyle,
    setAssistantStyle,
    linearConfig,
    setLinearThemeConfig,
    animasyonConfig,
    setAnimasyonThemeConfig,
  } = useAddons();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseTab(searchParams.get('tab'));
  const [selected, setSelected] = useState<AddonProduct | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [savingStyle, setSavingStyle] = useState(false);
  const [linearOpen, setLinearOpen] = useState(false);
  const [animasyonOpen, setAnimasyonOpen] = useState(false);
  const [savingLinear, setSavingLinear] = useState(false);
  const [savingAnimasyon, setSavingAnimasyon] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

  const list = useMemo(
    () => products.filter((p) => matchesTab(p, tab)),
    [products, tab]
  );

  function setTab(next: TabId) {
    const params = new URLSearchParams(searchParams);
    if (next === 'all') params.delete('tab');
    else params.set('tab', next);
    setSearchParams(params, { replace: true });
  }

  async function handleUnlock(code: string) {
    if (!selected) return;
    setUnlocking(true);
    try {
      await unlock(selected.id, code);
    } finally {
      setUnlocking(false);
    }
  }

  async function handleToggle(product: AddonProduct) {
    if (!product.toggleable) return;
    setTogglingId(product.id);
    try {
      await setEnabled(product.id, !product.enabled);
    } finally {
      setTogglingId(null);
    }
  }

  async function handleAssistantStyle(style: MenuAssistantStyle) {
    setSavingStyle(true);
    try {
      await setAssistantStyle(style);
    } finally {
      setSavingStyle(false);
    }
  }

  async function handleLinearSave(config: LinearThemeConfig) {
    setSavingLinear(true);
    try {
      await setLinearThemeConfig(config);
      setLinearOpen(false);
    } finally {
      setSavingLinear(false);
    }
  }

  async function handleAnimasyonSave(config: AnimasyonThemeConfig) {
    setSavingAnimasyon(true);
    try {
      await setAnimasyonThemeConfig(config);
      setAnimasyonOpen(false);
    } finally {
      setSavingAnimasyon(false);
    }
  }

  function ownedAction(product: AddonProduct) {
    if (product.id === 'menu-assistant' && product.owned) {
      const on = Boolean(product.enabled);
      return (
        <div className="flex flex-col gap-2.5 w-full">
          <button
            type="button"
            className="addon-toggle"
            onClick={() => void handleToggle(product)}
            disabled={togglingId === product.id}
            aria-pressed={on}
          >
            <span>{on ? 'Menüde açık' : 'Menüde kapalı'}</span>
            <span className={`addon-toggle__switch${on ? ' is-on' : ''}`} aria-hidden>
              <span className="addon-toggle__knob" />
            </span>
          </button>
          <MenuAssistantStylePicker
            value={menuAssistantStyle}
            saving={savingStyle}
            onChange={(style) => void handleAssistantStyle(style)}
          />
        </div>
      );
    }
    if (product.id === 'menu-linear' && product.owned) {
      return (
        <div className="flex flex-col gap-2 w-full">
          <Button type="button" variant="secondary" className="w-full" onClick={() => setLinearOpen(true)}>
            <Settings2 className="w-4 h-4" />
            Tema ayarları
          </Button>
          <Link to="/admin/startup/menu" className="w-full">
            <Button type="button" className="w-full">
              <Sparkles className="w-4 h-4" />
              Temalarda kullan
            </Button>
          </Link>
        </div>
      );
    }
    if (product.id === 'menu-animasyon' && product.owned) {
      return (
        <div className="flex flex-col gap-2 w-full">
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => setAnimasyonOpen(true)}
          >
            <Settings2 className="w-4 h-4" />
            Tema ayarları
          </Button>
          <Link to="/admin/startup/menu" className="w-full">
            <Button type="button" className="w-full">
              <Sparkles className="w-4 h-4" />
              Temalarda kullan
            </Button>
          </Link>
        </div>
      );
    }
    if (product.toggleable) {
      const on = Boolean(product.enabled);
      return (
        <button
          type="button"
          className="addon-toggle"
          onClick={() => void handleToggle(product)}
          disabled={togglingId === product.id}
          aria-pressed={on}
        >
          <span>{on ? 'Menüde açık' : 'Menüde kapalı'}</span>
          <span className={`addon-toggle__switch${on ? ' is-on' : ''}`} aria-hidden>
            <span className="addon-toggle__knob" />
          </span>
        </button>
      );
    }
    if (product.category === 'qr') {
      return (
        <Link to="/admin/barcode" className="w-full">
          <Button type="button" className="w-full">
            <QrCode className="w-4 h-4" />
            Barkod’a git
          </Button>
        </Link>
      );
    }
    if (product.category === 'lang') {
      return (
        <Link to="/admin/bulk-translate" className="w-full">
          <Button type="button" className="w-full">
            <Languages className="w-4 h-4" />
            Toplu Çeviri’ye git
          </Button>
        </Link>
      );
    }
    return (
      <Link
        to={product.category === 'welcome' ? '/admin/startup/welcome' : '/admin/startup/menu'}
        className="w-full"
      >
        <Button type="button" className="w-full">
          <Sparkles className="w-4 h-4" />
          Temalarda kullan
        </Button>
      </Link>
    );
  }

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Eklentiler" />
      <p className="text-sm admin-text-muted -mt-4 mb-5 max-w-2xl leading-relaxed">
        Satın almada sıkıntı mı yaşadınız? Hemen{' '}
        <button
          type="button"
          onClick={() => setSupportOpen(true)}
          className="font-bold underline underline-offset-2 hover:opacity-80 transition"
          style={{ color: 'var(--admin-accent)' }}
        >
          iletişime
        </button>{' '}
        geçiniz.
      </p>

      <div className="flex flex-wrap gap-1.5 mb-6">
        {TABS.map((item) => {
          const active = tab === item.id;
          const count =
            item.id === 'all'
              ? products.length
              : products.filter((p) => matchesTab(p, item.id)).length;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-sm font-semibold border transition ${
                active
                  ? 'border-[var(--admin-accent)] bg-[var(--admin-accent)] text-white'
                  : 'border-[var(--admin-card-border)] bg-[var(--admin-card)] text-[var(--admin-text)] hover:border-[var(--admin-accent)]'
              }`}
            >
              {item.label}
              <span
                className={`min-w-[1.15rem] text-center text-[11px] rounded-md px-1 py-0.5 ${
                  active ? 'bg-white/20' : 'bg-[var(--admin-accent-soft)] text-[var(--admin-accent)]'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {list.length === 0 ? (
        <Card className="p-8 text-center text-sm admin-text-muted">Bu sekmede eklenti yok.</Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((product) => {
            const owned = Boolean(product.owned);
            const free = Boolean(product.free);
            return (
              <Card
                key={product.id}
                className={`theme-pick-card overflow-hidden ${owned ? 'theme-pick-card--active' : ''}`}
              >
                <div className={`theme-preview ${product.previewClass || 'theme-preview--sade'}`}>
                  <div className="theme-preview__shine" />
                  <div className="absolute top-3 left-3 z-[1]">
                    <span className="inline-flex items-center h-6 px-2 rounded-lg text-[10px] font-bold uppercase tracking-wide bg-black/45 text-white backdrop-blur-sm">
                      {categoryBadge(product.category)}
                    </span>
                  </div>
                  {owned ? (
                    <div className="theme-preview__active">
                      <Check className="w-4 h-4" />
                      {free ? 'Dahil' : 'Satın alındı'}
                    </div>
                  ) : (
                    <div className="theme-preview__lock">
                      <Lock className="w-5 h-5" />
                      <span>Kilitli</span>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-[var(--admin-text)]">{product.name}</h3>
                  <p className="text-sm admin-text-muted mt-1.5 leading-relaxed">
                    {product.description}
                  </p>
                  <div className="mt-4 flex flex-col gap-2">
                    {free ? (
                      ownedAction(product)
                    ) : (
                      <>
                        <Button type="button" variant="secondary" className="w-full" disabled>
                          <ShoppingBag className="w-4 h-4" />
                          Satın Al
                        </Button>
                        {owned ? (
                          ownedAction(product)
                        ) : (
                          <Button type="button" className="w-full" onClick={() => setSelected(product)}>
                            <KeyRound className="w-4 h-4" />
                            Kod Gir
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <UnlockAddonModal
        open={Boolean(selected)}
        productName={selected?.name || ''}
        unlocking={unlocking}
        onClose={() => setSelected(null)}
        onUnlock={handleUnlock}
      />
      <LinearThemeSettingsModal
        open={linearOpen}
        initial={linearConfig}
        saving={savingLinear}
        onClose={() => setLinearOpen(false)}
        onSave={handleLinearSave}
      />
      <AnimasyonThemeSettingsModal
        open={animasyonOpen}
        initial={animasyonConfig}
        saving={savingAnimasyon}
        onClose={() => setAnimasyonOpen(false)}
        onSave={handleAnimasyonSave}
      />
      <SupportContactModal open={supportOpen} onClose={() => setSupportOpen(false)} />
    </div>
  );
}
