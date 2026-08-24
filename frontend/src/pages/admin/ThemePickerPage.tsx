import { useEffect, useState } from 'react';
import { Check, Lock, ShoppingBag } from 'lucide-react';
import { api } from '@/lib/api';
import { Button, Card, PageHeader } from '@/components/ui';
import {
  DEFAULT_MENU_THEME,
  DEFAULT_WELCOME_THEME,
  MENU_THEMES,
  WELCOME_THEMES,
  type MenuThemeOption,
  type ThemeKind,
} from '@/lib/menuThemes';

interface ThemePickerPageProps {
  kind: ThemeKind;
  title: string;
  subtitle: string;
}

export default function ThemePickerPage({ kind, title, subtitle }: ThemePickerPageProps) {
  const themes = kind === 'welcome' ? WELCOME_THEMES : MENU_THEMES;
  const defaultId = kind === 'welcome' ? DEFAULT_WELCOME_THEME : DEFAULT_MENU_THEME;
  const [selected, setSelected] = useState(defaultId);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  async function selectTheme(theme: MenuThemeOption) {
    if (theme.locked) {
      setMessage(`“${theme.name}” teması kilitli. Satın Al ile açılacak.`);
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const body =
        kind === 'welcome' ? { welcome: theme.id } : { menu: theme.id };
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

  return (
    <div>
      <PageHeader title={title} />
      <p className="text-sm admin-text-muted -mt-4 mb-6 max-w-2xl">{subtitle}</p>

      {message && (
        <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          {message}
        </div>
      )}

      {loading ? (
        <div className="py-16 flex justify-center">
          <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {themes.map((theme) => {
            const isActive = selected === theme.id;
            return (
              <Card
                key={theme.id}
                className={`theme-pick-card overflow-hidden ${
                  isActive ? 'theme-pick-card--active' : ''
                } ${theme.locked ? 'theme-pick-card--locked' : ''}`}
              >
                <div className={`theme-preview ${theme.previewClass}`}>
                  <div className="theme-preview__shine" />
                  {theme.locked && (
                    <div className="theme-preview__lock">
                      <Lock className="w-5 h-5" />
                      <span>Satın Al</span>
                    </div>
                  )}
                  {isActive && !theme.locked && (
                    <div className="theme-preview__active">
                      <Check className="w-4 h-4" />
                      Aktif
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-[var(--admin-text)]">{theme.name}</h3>
                  <p className="text-sm admin-text-muted mt-1.5 leading-relaxed">
                    {theme.description}
                  </p>
                  <div className="mt-4">
                    {theme.locked ? (
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full"
                        onClick={() => selectTheme(theme)}
                      >
                        <ShoppingBag className="w-4 h-4" />
                        Satın Al
                      </Button>
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
    </div>
  );
}
