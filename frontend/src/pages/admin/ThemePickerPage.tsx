import { useEffect, useState } from 'react';
import { Check, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { Button, Card, PageHeader } from '@/components/ui';
import { useAddons } from '@/hooks/useAddons';
import LinearThemeSettingsModal from '@/components/LinearThemeSettingsModal';
import AnimasyonThemeSettingsModal from '@/components/AnimasyonThemeSettingsModal';
import SadeThemeSettingsModal from '@/components/SadeThemeSettingsModal';
import AliveThemeSettingsModal from '@/components/AliveThemeSettingsModal';
import LuxuryThemeSettingsModal from '@/components/LuxuryThemeSettingsModal';
import BasketballThemeSettingsModal from '@/components/BasketballThemeSettingsModal';
import CupsThemeSettingsModal from '@/components/CupsThemeSettingsModal';
import {
  themeAddonId,
  DEFAULT_MENU_THEME,
  DEFAULT_WELCOME_THEME,
  MENU_THEMES,
  WELCOME_THEMES,
  type MenuThemeOption,
  type ThemeKind,
} from '@/addons';
import type { LinearThemeConfig } from '@/lib/menuLinearConfig';
import type { AnimasyonThemeConfig } from '@/lib/menuAnimasyonConfig';
import type { SadeThemeConfig } from '@/lib/menuSadeConfig';
import type { AliveThemeConfig } from '@/lib/menuAliveConfig';
import type { LuxuryThemeConfig } from '@/lib/menuLuxuryConfig';
import { adminPath } from '@/lib/adminPath';

interface ThemePickerPageProps {
  kind: ThemeKind;
  title: string;
  subtitle: string;
}

export default function ThemePickerPage({ kind, title, subtitle }: ThemePickerPageProps) {
  const themes = kind === 'welcome' ? WELCOME_THEMES : MENU_THEMES;
  const defaultId = kind === 'welcome' ? DEFAULT_WELCOME_THEME : DEFAULT_MENU_THEME;
  const {
    isOwned,
    loading: addonsLoading,
    linearConfig,
    setLinearThemeConfig,
    animasyonConfig,
    setAnimasyonThemeConfig,
    sadeConfig,
    setSadeThemeConfig,
    aliveConfig,
    setAliveThemeConfig,
    luxuryConfig,
    setLuxuryThemeConfig,
    basketballConfig,
    setBasketballThemeConfig,
    cupsConfig,
    setCupsThemeConfig,
  } = useAddons();
  const [selected, setSelected] = useState(defaultId);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [linearOpen, setLinearOpen] = useState(false);
  const [animasyonOpen, setAnimasyonOpen] = useState(false);
  const [sadeOpen, setSadeOpen] = useState(false);
  const [aliveOpen, setAliveOpen] = useState(false);
  const [luxuryOpen, setLuxuryOpen] = useState(false);
  const [savingLinear, setSavingLinear] = useState(false);
  const [savingAnimasyon, setSavingAnimasyon] = useState(false);
  const [savingSade, setSavingSade] = useState(false);
  const [savingAlive, setSavingAlive] = useState(false);
  const [savingLuxury, setSavingLuxury] = useState(false);
  const [basketballOpen, setBasketballOpen] = useState(false);
  const [savingBasketball, setSavingBasketball] = useState(false);
  const [cupsOpen, setCupsOpen] = useState(false);
  const [savingCups, setSavingCups] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<{ settings: Record<string, string> }>('/api/admin/settings')
      .then((res) => {
        if (cancelled) return;
        const key = kind === 'welcome' ? 'theme_welcome' : 'theme_menu';
        setSelected(res.settings?.[key] || defaultId);
      })
      .catch(() => {
        if (!cancelled) setSelected(defaultId);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [kind, defaultId]);

  function isThemeLocked(theme: MenuThemeOption) {
    if (!theme.locked) return false;
    const addonId = themeAddonId(kind, theme.id);
    if (!addonId) return true;
    return !isOwned(addonId);
  }

  async function selectTheme(theme: MenuThemeOption) {
    if (isThemeLocked(theme)) {
      setMessage(`“${theme.name}” kilitli. Eklentiler’den Kod Gir ile aç.`);
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const body = kind === 'welcome' ? { welcome: theme.id } : { menu: theme.id };
      const res = await api<{ welcome: string; menu: string }>('/api/admin/settings/themes', {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      setSelected(kind === 'welcome' ? res.welcome : res.menu);
      setMessage(`“${theme.name}” teması aktif.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Tema kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }

  async function handleLinearSave(config: LinearThemeConfig) {
    setSavingLinear(true);
    try {
      await setLinearThemeConfig(config);
      setLinearOpen(false);
      setMessage('Linear tema ayarları kaydedildi.');
    } finally {
      setSavingLinear(false);
    }
  }

  async function handleAnimasyonSave(config: AnimasyonThemeConfig) {
    setSavingAnimasyon(true);
    try {
      await setAnimasyonThemeConfig(config);
      setAnimasyonOpen(false);
      setMessage('Animasyonlu tema ayarları kaydedildi.');
    } finally {
      setSavingAnimasyon(false);
    }
  }

  async function handleSadeSave(config: SadeThemeConfig) {
    setSavingSade(true);
    try {
      await setSadeThemeConfig(config);
      setSadeOpen(false);
      setMessage('Sade tema ayarları kaydedildi.');
    } finally {
      setSavingSade(false);
    }
  }

  async function handleAliveSave(config: AliveThemeConfig) {
    setSavingAlive(true);
    try {
      await setAliveThemeConfig(config);
      setAliveOpen(false);
      setMessage('Canlı tema ayarları kaydedildi.');
    } finally {
      setSavingAlive(false);
    }
  }

  async function handleLuxurySave(config: LuxuryThemeConfig) {
    setSavingLuxury(true);
    try {
      await setLuxuryThemeConfig(config);
      setLuxuryOpen(false);
      setMessage('Lüks tema ayarları kaydedildi.');
    } finally {
      setSavingLuxury(false);
    }
  }

  async function handleBasketballSave(config: typeof basketballConfig) {
    setSavingBasketball(true);
    try {
      await setBasketballThemeConfig(config);
      setBasketballOpen(false);
      setMessage('Basketbol Menü ayarları kaydedildi.');
    } finally {
      setSavingBasketball(false);
    }
  }

  async function handleCupsSave(config: typeof cupsConfig) {
    setSavingCups(true);
    try {
      await setCupsThemeConfig(config);
      setCupsOpen(false);
      setMessage('Üç Bardak ayarları kaydedildi.');
    } finally {
      setSavingCups(false);
    }
  }

  function openThemeSettings(theme: MenuThemeOption) {
    if (theme.id === 'linear') setLinearOpen(true);
    else if (theme.id === 'animasyon') setAnimasyonOpen(true);
    else if (theme.id === 'sade') setSadeOpen(true);
    else if (theme.id === 'alive') setAliveOpen(true);
    else if (theme.id === 'luxury') setLuxuryOpen(true);
    else if (theme.id === 'basketball') setBasketballOpen(true);
    else if (theme.id === 'cups') setCupsOpen(true);
  }

  function hasThemeSettings(theme: MenuThemeOption) {
    if (isThemeLocked(theme)) return false;
    if (kind === 'welcome') return theme.id === 'basketball' || theme.id === 'cups';
    return (
      theme.id === 'linear' ||
      theme.id === 'animasyon' ||
      theme.id === 'sade' ||
      theme.id === 'alive' ||
      theme.id === 'luxury'
    );
  }

  return (
    <div>
      <PageHeader title={title} />
      <p className="text-sm admin-text-muted -mt-4 mb-6 max-w-2xl">{subtitle}</p>

      {message && (
        <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          {message}{' '}
          {message.includes('Eklentiler') && (
            <Link
              to={adminPath('extensions', kind === 'welcome' ? 'welcome' : 'menu')}
              className="underline font-semibold"
            >
              Eklentiler’e git
            </Link>
          )}
        </div>
      )}

      {loading || addonsLoading ? (
        <div className="py-16 flex justify-center">
          <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {themes.map((theme) => {
            const locked = isThemeLocked(theme);
            const isActive = selected === theme.id;
            const showSettings = hasThemeSettings(theme);
            return (
              <Card
                key={theme.id}
                className={`theme-pick-card overflow-hidden ${
                  isActive ? 'theme-pick-card--active' : ''
                } ${locked ? 'theme-pick-card--locked' : ''}`}
              >
                <div className={`theme-preview ${theme.previewClass}`}>
                  <div className="theme-preview__shine" />
                  {locked && (
                    <div className="theme-preview__lock">
                      <Lock className="w-5 h-5" />
                      <span>Eklentiler</span>
                    </div>
                  )}
                  {isActive && !locked && (
                    <div className="theme-preview__active theme-preview__active--left">
                      <Check className="w-4 h-4" />
                      Aktif
                    </div>
                  )}
                  {showSettings ? (
                    <button
                      type="button"
                      className="theme-preview__settings"
                      onClick={() => openThemeSettings(theme)}
                    >
                      ayarlar
                    </button>
                  ) : null}
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-[var(--admin-text)]">{theme.name}</h3>
                  <p className="text-sm admin-text-muted mt-1.5 leading-relaxed">
                    {theme.description}
                  </p>
                  <div className="mt-4 flex flex-col gap-2">
                    {locked ? (
                      <Link to={adminPath('extensions', kind === 'welcome' ? 'welcome' : 'menu')}>
                        <Button type="button" variant="secondary" className="w-full">
                          Eklentiler’de aç
                        </Button>
                      </Link>
                    ) : (
                      <Button
                        type="button"
                        className="w-full"
                        disabled={saving || isActive}
                        onClick={() => selectTheme(theme)}
                      >
                        {isActive ? 'Seçili tema' : 'Bu temayı kullan'}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {kind === 'menu' ? (
        <>
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
          <SadeThemeSettingsModal
            open={sadeOpen}
            initial={sadeConfig}
            saving={savingSade}
            onClose={() => setSadeOpen(false)}
            onSave={handleSadeSave}
          />
          <AliveThemeSettingsModal
            open={aliveOpen}
            initial={aliveConfig}
            saving={savingAlive}
            onClose={() => setAliveOpen(false)}
            onSave={handleAliveSave}
          />
          <LuxuryThemeSettingsModal
            open={luxuryOpen}
            initial={luxuryConfig}
            saving={savingLuxury}
            onClose={() => setLuxuryOpen(false)}
            onSave={handleLuxurySave}
          />
        </>
      ) : null}
      {kind === 'welcome' ? (
        <>
          <BasketballThemeSettingsModal
            open={basketballOpen}
            initial={basketballConfig}
            saving={savingBasketball}
            onClose={() => setBasketballOpen(false)}
            onSave={handleBasketballSave}
          />
          <CupsThemeSettingsModal
            open={cupsOpen}
            initial={cupsConfig}
            saving={savingCups}
            onClose={() => setCupsOpen(false)}
            onSave={handleCupsSave}
          />
        </>
      ) : null}
    </div>
  );
}
