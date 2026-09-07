import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { Globe, Plug, MessageSquare, Building2, ImagePlus, Plus, Coins, Share2, Trash2, Music2, HandHelping, Sparkles, CalendarClock, Phone, MessageCircle, Copy, Check, MapPinned, Maximize2 } from 'lucide-react';
import { api, imageUrl } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Input, PageHeader, Spinner, Textarea } from '@/components/ui';
import { TranslatableTextarea } from '@/components/TranslatableField';
import AddLanguageModal from '@/components/AddLanguageModal';
import AddCurrencyModal from '@/components/AddCurrencyModal';
import SocialBrandIcon from '@/components/SocialBrandIcon';
import { SocialDisplayIcon, CUSTOM_ICONS } from '@/components/SocialDisplayIcon';
import GeoLockMapEditor from '@/components/admin/GeoLockMapEditor';
import AboutPageEditorModal from '@/components/admin/AboutPageEditorModal';
import type { GeoLockConfig } from '@/lib/geoLock';
import { DEFAULT_ABOUT_PAGE, parseAboutPage, type AboutPageConfig } from '@/lib/aboutPage';
import '@/about-page.css';
import { languageFlag } from '@/lib/languageFlags';
import { catalogByCode, type CatalogLanguage } from '@/lib/languageCatalog';
import { currencyCatalogByCode, type CatalogCurrency } from '@/lib/currencyCatalog';
import {
  CUSTOM_ICON_OPTIONS,
  mergeSocialConfigs,
  newCustomSocialLink,
  SOCIAL_PLATFORMS,
  splitSocialConfigs,
  type SocialLinkConfig,
} from '@/lib/socialCatalog';
import { useAddons } from '@/hooks/useAddons';
import { isTableServiceEnabled } from '@/lib/tableService';
import { daysUntilLicenseEnd, formatLicenseDate } from '@/lib/license';
import {
  SUPPORT_PHONE_DISPLAY,
  SUPPORT_PHONE_TEL,
  supportWhatsAppUrl,
} from '@/lib/supportContact';

interface Language {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
}

interface Currency {
  id: number;
  code: string;
  name: string;
  symbol: string;
  isActive: boolean;
}

interface SettingsData {
  restaurant: {
    id: number;
    name: string;
    logoUrl?: string | null;
    licenseExpiresAt?: string | null;
  };
  languages: Language[];
  currencies?: Currency[];
  welcomeMessages: { languageId: number; languageCode: string; message: string }[];
  settings: Record<string, string>;
}

interface TranslateStatus {
  openaiConfigured: boolean;
  freeFallback: boolean;
}

function SettingsSection({
  icon: Icon,
  title,
  children,
  className = '',
  bodyClassName = '',
  action,
  sectionId,
  highlight,
}: {
  icon: typeof Globe;
  title: string;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  action?: React.ReactNode;
  sectionId?: string;
  highlight?: boolean;
}) {
  return (
    <section
      id={sectionId}
      className={`admin-card overflow-hidden flex flex-col ${className}${
        highlight ? ' settings-section--pulse' : ''
      }`}
    >
      <div
        className="flex items-center gap-2.5 px-5 py-3.5 shrink-0"
        style={{
          background: 'var(--admin-input-bg)',
          borderBottom: '1px solid var(--admin-card-border)',
        }}
      >
        <Icon className="w-4 h-4 shrink-0" style={{ color: 'var(--admin-accent)' }} />
        <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--admin-text)] flex-1">
          {title}
        </h3>
        {action}
      </div>
      <div className={`p-5 flex-1 min-h-0 ${bodyClassName}`.trim()}>{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  const { refreshUser } = useAuth();
  const { isOwned, isEnabled, setEnabled } = useAddons();
  const assistantOwned = isOwned('menu-assistant');
  const assistantEnabled = isEnabled('menu-assistant');
  const [searchParams, setSearchParams] = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<SettingsData | null>(null);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState('');
  const [companyAbout, setCompanyAbout] = useState('');
  const [aboutPage, setAboutPage] = useState<AboutPageConfig>(DEFAULT_ABOUT_PAGE);
  const [aboutEditorOpen, setAboutEditorOpen] = useState(false);
  const [messages, setMessages] = useState<Record<number, string>>({});
  const [integrationEnabled, setIntegrationEnabled] = useState(false);
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [addLangOpen, setAddLangOpen] = useState(false);
  const [addingLang, setAddingLang] = useState(false);
  const [addCurrencyOpen, setAddCurrencyOpen] = useState(false);
  const [addingCurrency, setAddingCurrency] = useState(false);
  const [translateStatus, setTranslateStatus] = useState<TranslateStatus | null>(null);
  const [languagesHighlight, setLanguagesHighlight] = useState(false);
  const [socialLinks, setSocialLinks] = useState<SocialLinkConfig[]>(mergeSocialConfigs([]));
  const [welcomeMusicUrl, setWelcomeMusicUrl] = useState('');
  const [tableServiceEnabled, setTableServiceEnabled] = useState(true);
  const [geoLock, setGeoLock] = useState<GeoLockConfig>({
    enabled: false,
    lat: 36.8121,
    lng: 34.6415,
    radiusMeters: 120,
  });
  const [togglingMenuFeature, setTogglingMenuFeature] = useState<'table' | 'assistant' | null>(null);
  const [renewContactOpen, setRenewContactOpen] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [iconPickerFor, setIconPickerFor] = useState<string | null>(null);
  const [iconPickerPos, setIconPickerPos] = useState<{ left: number; bottom: number } | null>(
    null
  );
  const customIconInputRef = useRef<HTMLInputElement>(null);
  const pendingCustomIconIdRef = useRef<string | null>(null);
  const [uploadingIconFor, setUploadingIconFor] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<SettingsData>('/api/admin/settings'),
      api<TranslateStatus>('/api/admin/translate/status').catch(() => ({
        openaiConfigured: false,
        freeFallback: true,
      })),
      api<Currency[]>('/api/admin/currencies').catch(() => [] as Currency[]),
    ])
      .then(([d, status, curs]) => {
        setData(d);
        setCurrencies(d.currencies?.length ? d.currencies : curs);
        setCompanyName(d.restaurant.name);
        setCompanyAbout(d.settings.company_about || '');
        setAboutPage(
          parseAboutPage(d.settings.company_about_page, d.settings.company_about || '')
        );
        setMessages(Object.fromEntries(d.welcomeMessages.map((m) => [m.languageId, m.message])));
        setIntegrationEnabled(d.settings.integration_enabled === 'true');
        setOpenaiApiKey(d.settings.openai_api_key || '');
        setLogoPreview(d.restaurant.logoUrl ? imageUrl(d.restaurant.logoUrl) : null);
        try {
          setSocialLinks(
            mergeSocialConfigs(
              d.settings.social_links ? JSON.parse(d.settings.social_links) : []
            )
          );
        } catch {
          setSocialLinks(mergeSocialConfigs([]));
        }
        setWelcomeMusicUrl(d.settings.welcome_music_url || '');
        setTableServiceEnabled(isTableServiceEnabled(d.settings.menu_table_service_enabled));
        try {
          const raw = d.settings.geo_lock ? JSON.parse(d.settings.geo_lock) : null;
          if (raw && typeof raw === 'object') {
            setGeoLock({
              enabled: Boolean(raw.enabled),
              lat: Number(raw.lat) || 36.8121,
              lng: Number(raw.lng) || 34.6415,
              radiusMeters: Number(raw.radiusMeters) || 120,
            });
          }
        } catch {
          /* keep default */
        }
        setTranslateStatus({
          openaiConfigured:
            status.openaiConfigured || Boolean(d.settings.openai_api_key?.trim()),
          freeFallback: status.freeFallback !== false,
        });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (loading || searchParams.get('focus') !== 'languages') return;
    const timer = window.setTimeout(() => {
      const el = document.getElementById('settings-languages');
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setLanguagesHighlight(true);
      window.setTimeout(() => setLanguagesHighlight(false), 2200);
      const next = new URLSearchParams(searchParams);
      next.delete('focus');
      setSearchParams(next, { replace: true });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [loading, searchParams, setSearchParams]);

  useEffect(() => {
    if (!logoFile) return;
    const url = URL.createObjectURL(logoFile);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  useEffect(() => {
    setTranslateStatus((prev) =>
      prev
        ? { ...prev, openaiConfigured: Boolean(openaiApiKey.trim()) || prev.openaiConfigured }
        : {
            openaiConfigured: Boolean(openaiApiKey.trim()),
            freeFallback: true,
          }
    );
  }, [openaiApiKey]);

  useEffect(() => {
    if (!iconPickerFor) return;
    const onScrollOrResize = () => {
      setIconPickerFor(null);
      setIconPickerPos(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIconPickerFor(null);
        setIconPickerPos(null);
      }
    };
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('keydown', onKey);
    };
  }, [iconPickerFor]);

  async function saveLanguages() {
    if (!data) return;
    await api('/api/admin/settings/languages', {
      method: 'PUT',
      body: JSON.stringify({
        languages: data.languages.map((l) => ({ id: l.id, isActive: l.isActive })),
      }),
    });
  }

  async function saveCurrencies() {
    await api('/api/admin/settings/currencies', {
      method: 'PUT',
      body: JSON.stringify({
        currencies: currencies.map((c) => ({ id: c.id, isActive: c.isActive })),
      }),
    });
  }

  async function toggleTableService() {
    const next = !tableServiceEnabled;
    setTogglingMenuFeature('table');
    try {
      await api('/api/admin/settings/menu-features', {
        method: 'PUT',
        body: JSON.stringify({ tableService: next }),
      });
      setTableServiceEnabled(next);
    } catch {
      /* leave previous state */
    } finally {
      setTogglingMenuFeature(null);
    }
  }

  async function toggleMenuAssistant() {
    if (!assistantOwned) return;
    setTogglingMenuFeature('assistant');
    try {
      await setEnabled('menu-assistant', !assistantEnabled);
    } catch {
      /* leave previous state */
    } finally {
      setTogglingMenuFeature(null);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api('/api/admin/settings/company', {
        method: 'PUT',
        body: JSON.stringify({
          name: companyName,
          about: companyAbout,
          aboutPage: { ...aboutPage, body: companyAbout },
        }),
      });
      await api('/api/admin/settings/welcome-messages', {
        method: 'PUT',
        body: JSON.stringify({
          messages: Object.entries(messages).map(([languageId, message]) => ({
            languageId: Number(languageId),
            message,
          })),
        }),
      });
      await saveLanguages();
      await saveCurrencies();
      await api('/api/admin/settings/integration', {
        method: 'PUT',
        body: JSON.stringify({
          enabled: integrationEnabled,
          openaiApiKey,
        }),
      });
      await api('/api/admin/settings/social', {
        method: 'PUT',
        body: JSON.stringify({ links: socialLinks }),
      });
      await api('/api/admin/settings/welcome-music', {
        method: 'PUT',
        body: JSON.stringify({ url: welcomeMusicUrl }),
      });
      await api('/api/admin/settings/menu-features', {
        method: 'PUT',
        body: JSON.stringify({ tableService: tableServiceEnabled }),
      });
      await api('/api/admin/settings/geo-lock', {
        method: 'PUT',
        body: JSON.stringify(geoLock),
      });
      if (logoFile) {
        const fd = new FormData();
        fd.append('logo', logoFile);
        const token =
          localStorage.getItem('token') || sessionStorage.getItem('token');
        const logoRes = await fetch('/api/admin/settings/logo', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (!logoRes.ok) throw new Error('Logo yüklenemedi');
        setLogoFile(null);
      }
      await refreshUser();
      alert('Ayarlar kaydedildi');
    } finally {
      setSaving(false);
    }
  }

  function toggleLanguage(id: number) {
    if (!data) return;
    const lang = data.languages.find((l) => l.id === id);
    if (!lang || lang.code === 'tr') return;
    setData({
      ...data,
      languages: data.languages.map((l) =>
        l.id === id ? { ...l, isActive: !l.isActive } : l
      ),
    });
  }

  function toggleCurrency(id: number) {
    setCurrencies((prev) => {
      const target = prev.find((c) => c.id === id);
      if (!target || target.code === 'TRY') return prev;
      return prev.map((c) => (c.id === id ? { ...c, isActive: !c.isActive } : c));
    });
  }

  async function handleDeleteLanguage(lang: Language) {
    if (lang.code === 'tr') return;
    if (!window.confirm(`“${lang.name}” dilini silmek istediğinize emin misiniz?`)) return;
    try {
      await api(`/api/admin/languages/${lang.id}`, { method: 'DELETE' });
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          languages: prev.languages.filter((l) => l.id !== lang.id),
        };
      });
      setMessages((prev) => {
        const next = { ...prev };
        delete next[lang.id];
        return next;
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Dil silinemedi');
    }
  }

  async function handleDeleteCurrency(currency: Currency) {
    if (currency.code === 'TRY') return;
    if (
      !window.confirm(`“${currency.name}” para birimini silmek istediğinize emin misiniz?`)
    ) {
      return;
    }
    try {
      await api(`/api/admin/currencies/${currency.id}`, { method: 'DELETE' });
      setCurrencies((prev) => prev.filter((c) => c.id !== currency.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Para birimi silinemedi');
    }
  }

  async function handleAddLanguage(lang: CatalogLanguage) {
    setAddingLang(true);
    try {
      const created = await api<Language>('/api/admin/languages', {
        method: 'POST',
        body: JSON.stringify({ code: lang.code, name: lang.name }),
      });
      setData((prev) => {
        if (!prev) return prev;
        const exists = prev.languages.some((l) => l.id === created.id);
        return {
          ...prev,
          languages: exists
            ? prev.languages.map((l) => (l.id === created.id ? created : l))
            : [...prev.languages, created],
        };
      });
      setMessages((prev) => ({ ...prev, [created.id]: prev[created.id] || '' }));
      setAddLangOpen(false);
    } catch (err) {
      // DB'de var ama liste eskiyse sunucudan senkronize et
      try {
        const all = await api<Language[]>('/api/admin/languages');
        setData((prev) => (prev ? { ...prev, languages: all } : prev));
        const found = all.find((l) => l.code === lang.code);
        if (found) {
          setMessages((prev) => ({ ...prev, [found.id]: prev[found.id] || '' }));
          setAddLangOpen(false);
          return;
        }
      } catch {
        /* ignore sync errors */
      }
      alert(err instanceof Error ? err.message : 'Dil eklenemedi');
    } finally {
      setAddingLang(false);
    }
  }

  async function handleAddCurrency(currency: CatalogCurrency) {
    setAddingCurrency(true);
    try {
      const created = await api<Currency>('/api/admin/currencies', {
        method: 'POST',
        body: JSON.stringify({
          code: currency.code,
          name: currency.name,
          symbol: currency.symbol,
        }),
      });
      setCurrencies((prev) => {
        const exists = prev.some((c) => c.id === created.id);
        return exists
          ? prev.map((c) => (c.id === created.id ? created : c))
          : [...prev, created];
      });
      setAddCurrencyOpen(false);
    } catch (err) {
      try {
        const all = await api<Currency[]>('/api/admin/currencies');
        setCurrencies(all);
        if (all.some((c) => c.code === currency.code)) {
          setAddCurrencyOpen(false);
          return;
        }
      } catch {
        /* ignore */
      }
      alert(err instanceof Error ? err.message : 'Para birimi eklenemedi');
    } finally {
      setAddingCurrency(false);
    }
  }

  if (loading || !data) return <Spinner />;

  const activeLanguages = [...data.languages.filter((l) => l.isActive)].sort((a, b) =>
    a.code === 'tr' ? -1 : b.code === 'tr' ? 1 : 0
  );
  const trLanguage = data.languages.find((l) => l.code === 'tr');
  const trWelcomeMessage = trLanguage ? messages[trLanguage.id] || '' : '';
  const sortedLanguages = [...data.languages].sort((a, b) => {
    if (a.code === 'tr') return -1;
    if (b.code === 'tr') return 1;
    return a.name.localeCompare(b.name, 'tr');
  });
  const sortedCurrencies = [...currencies].sort((a, b) => {
    if (a.code === 'TRY') return -1;
    if (b.code === 'TRY') return 1;
    return a.name.localeCompare(b.name, 'tr');
  });

  const { platforms: platformSocial, customs: customSocial } = splitSocialConfigs(socialLinks);
  const filledSocialCount = socialLinks.filter((s) => s.value.trim()).length;

  function updateSocial(id: string, patch: Partial<SocialLinkConfig>) {
    setSocialLinks((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function addCustomSocial() {
    setSocialLinks((prev) => [...prev, newCustomSocialLink()]);
  }

  function removeCustomSocial(id: string) {
    setSocialLinks((prev) => prev.filter((s) => s.id !== id));
    if (iconPickerFor === id) {
      setIconPickerFor(null);
      setIconPickerPos(null);
    }
  }

  function closeIconPicker() {
    setIconPickerFor(null);
    setIconPickerPos(null);
  }

  function openIconPicker(id: string, anchor: HTMLElement) {
    if (iconPickerFor === id) {
      closeIconPicker();
      return;
    }
    const rect = anchor.getBoundingClientRect();
    setIconPickerPos({
      left: Math.min(rect.left, window.innerWidth - 220),
      bottom: window.innerHeight - rect.top + 8,
    });
    setIconPickerFor(id);
  }

  async function uploadCustomIcon(id: string, file: File) {
    setUploadingIconFor(id);
    try {
      const body = new FormData();
      body.append('icon', file);
      const res = await api<{ iconUrl: string }>('/api/admin/settings/social-icon', {
        method: 'POST',
        body,
      });
      updateSocial(id, { iconUrl: res.iconUrl, iconKey: 'link' });
      closeIconPicker();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'İkon yüklenemedi');
    } finally {
      setUploadingIconFor(null);
    }
  }

  return (
    <div className="space-y-5 w-full">
      <PageHeader
        title="Ayarlar"
        actions={
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        }
      />

      <div className="grid lg:grid-cols-2 gap-5">
        <SettingsSection
          sectionId="settings-languages"
          highlight={languagesHighlight}
          icon={Globe}
          title="Dil Ayarları"
          action={
            <button
              type="button"
              onClick={() => setAddLangOpen(true)}
              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-xl text-xs font-bold transition hover:opacity-90"
              style={{ background: 'var(--admin-accent)', color: '#fff' }}
            >
              <Plus className="w-3.5 h-3.5" />
              Dil Ekle
            </button>
          }
        >
          <div className="space-y-1">
            {sortedLanguages.length === 0 ? (
              <p className="text-sm admin-text-muted py-4 text-center">
                Henüz dil yok. + Dil Ekle ile başla.
              </p>
            ) : (
              sortedLanguages.map((lang) => {
                const catalog = catalogByCode(lang.code);
                const isProtected = lang.code === 'tr';
                return (
                  <div
                    key={lang.id}
                    className="flex items-center justify-between py-3 px-3 rounded-xl transition hover:bg-[var(--admin-accent-soft)]/30 gap-3"
                    style={{ borderBottom: '1px solid var(--admin-card-border)' }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xl leading-none shrink-0">
                        {languageFlag(lang.code)}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--admin-text)] truncate">
                          {lang.name}
                        </p>
                        <p className="text-[11px] admin-text-muted uppercase tracking-wide">
                          {lang.code}
                          {catalog?.nativeName ? ` · ${catalog.nativeName}` : ''}
                          {isProtected ? ' · Varsayılan' : ''}
                        </p>
                      </div>
                    </div>
                    {!isProtected && (
                      <div className="flex items-center gap-2.5 shrink-0">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <span className="text-xs admin-text-muted">Aktif</span>
                          <input
                            type="checkbox"
                            checked={lang.isActive}
                            onChange={() => toggleLanguage(lang.id)}
                            className="w-4 h-4 rounded accent-[var(--admin-accent)]"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => handleDeleteLanguage(lang)}
                          className="p-2 rounded-xl hover:bg-red-500/10 text-red-500 transition"
                          title="Sil"
                          aria-label={`${lang.name} dilini sil`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </SettingsSection>

        <SettingsSection
          icon={Coins}
          title="Para Birimleri"
          action={
            <button
              type="button"
              onClick={() => setAddCurrencyOpen(true)}
              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-xl text-xs font-bold transition hover:opacity-90"
              style={{ background: 'var(--admin-accent)', color: '#fff' }}
            >
              <Plus className="w-3.5 h-3.5" />
              Para Birimi
            </button>
          }
        >
          <div className="space-y-1">
            {sortedCurrencies.length === 0 ? (
              <p className="text-sm admin-text-muted py-4 text-center">
                Henüz para birimi yok. + Para Birimi ile ekle.
              </p>
            ) : (
              sortedCurrencies.map((currency) => {
                const catalog = currencyCatalogByCode(currency.code);
                const isProtected = currency.code === 'TRY';
                return (
                  <div
                    key={currency.id}
                    className="flex items-center justify-between py-3 px-3 rounded-xl transition hover:bg-[var(--admin-accent-soft)]/30 gap-3"
                    style={{ borderBottom: '1px solid var(--admin-card-border)' }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xl leading-none shrink-0 w-8 text-center">
                        {catalog?.flag || '💱'}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--admin-text)] truncate">
                          {currency.symbol} · {currency.name}
                        </p>
                        <p className="text-[11px] admin-text-muted uppercase tracking-wide">
                          {currency.code}
                          {isProtected ? ' · Varsayılan' : ''}
                        </p>
                      </div>
                    </div>
                    {!isProtected && (
                      <div className="flex items-center gap-2.5 shrink-0">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <span className="text-xs admin-text-muted">Aktif</span>
                          <input
                            type="checkbox"
                            checked={currency.isActive}
                            onChange={() => toggleCurrency(currency.id)}
                            className="w-4 h-4 rounded accent-[var(--admin-accent)]"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => handleDeleteCurrency(currency)}
                          className="p-2 rounded-xl hover:bg-red-500/10 text-red-500 transition"
                          title="Sil"
                          aria-label={`${currency.name} para birimini sil`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </SettingsSection>
      </div>

      <div className="grid lg:grid-cols-2 gap-5 items-stretch">
        <SettingsSection icon={Plug} title="Entegrasyon Ayarları">
          <div className="flex flex-col gap-3.5">
            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl hover:bg-[var(--admin-accent-soft)]/30 transition">
              <input
                type="checkbox"
                checked={integrationEnabled}
                onChange={(e) => setIntegrationEnabled(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded accent-[var(--admin-accent)]"
              />
              <div>
                <p className="text-sm font-medium text-[var(--admin-text)]">
                  Entegrasyonu etkinleştir
                </p>
                <p className="text-xs admin-text-muted mt-1">
                  Harici POS veya sipariş sistemleri ile bağlantı
                </p>
              </div>
            </label>

            <div className="settings-openai-box rounded-2xl p-3.5">
              <Input
                label="OpenAI API Anahtarı"
                type="password"
                value={openaiApiKey}
                onChange={(e) => setOpenaiApiKey(e.target.value)}
                placeholder="sk-..."
              />
              <p className="text-[11px] admin-text-muted mt-2 leading-relaxed">
                Oto çeviri için ChatGPT anahtarınızı yapıştırın. Kayıtlıysa önce OpenAI kullanılır.
              </p>
            </div>

            {data && (
              <div className="settings-license-box">
                <div className="settings-license-box__head">
                  <span className="settings-license-box__icon" aria-hidden>
                    <CalendarClock className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="settings-license-box__title">Abonelik / Lisans</p>
                    {data.restaurant.licenseExpiresAt && (
                      <p className="settings-license-box__date">
                        Bitiş: {formatLicenseDate(data.restaurant.licenseExpiresAt)}
                      </p>
                    )}
                  </div>
                </div>

                {(() => {
                  const days = daysUntilLicenseEnd(data.restaurant.licenseExpiresAt);
                  if (days === null) {
                    return (
                      <p className="settings-license-box__status settings-license-box__status--muted">
                        Lisans süreniz henüz tanımlanmadı. Yenileme için bizimle iletişime geçin.
                      </p>
                    );
                  }
                  if (days < 0) {
                    return (
                      <p className="settings-license-box__status settings-license-box__status--danger">
                        Aboneliğiniz sona erdi ({Math.abs(days)} gün önce)
                      </p>
                    );
                  }
                  if (days === 0) {
                    return (
                      <p className="settings-license-box__status settings-license-box__status--danger">
                        Aboneliğiniz bugün sona eriyor
                      </p>
                    );
                  }
                  return (
                    <p
                      className={`settings-license-box__status${
                        days <= 7
                          ? ' settings-license-box__status--danger'
                          : days <= 30
                            ? ' settings-license-box__status--warn'
                            : ' settings-license-box__status--ok'
                      }`}
                    >
                      Aboneliğinizin bitmesine <strong>{days}</strong> gün kaldı
                    </p>
                  );
                })()}

                {!renewContactOpen ? (
                  <div className="settings-license-box__renew">
                    <p>Yenilemek ister misiniz?</p>
                    <button
                      type="button"
                      className="settings-license-box__renew-btn"
                      onClick={() => setRenewContactOpen(true)}
                    >
                      Evet, iletişime geç
                    </button>
                  </div>
                ) : (
                  <div className="settings-license-box__contact">
                    <p className="settings-license-box__contact-hint">
                      Lisans yenileme için bizi arayın veya WhatsApp’tan yazın. Restoran kodunuzu
                      belirtmeyi unutmayın.
                    </p>
                    <a href={`tel:${SUPPORT_PHONE_TEL}`} className="settings-license-contact-row">
                      <span className="settings-license-contact-row__icon">
                        <Phone className="w-4 h-4" />
                      </span>
                      <span>
                        <strong>{SUPPORT_PHONE_DISPLAY}</strong>
                        <em>Ara</em>
                      </span>
                    </a>
                    <a
                      href={supportWhatsAppUrl(
                        `Merhaba, Menu QR lisans yenileme talebi.\nRestoran kodu: ${data.restaurant.id}\nRestoran: ${data.restaurant.name}`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="settings-license-contact-row settings-license-contact-row--wa"
                    >
                      <span
                        className="settings-license-contact-row__icon"
                        style={{ background: '#25D366' }}
                      >
                        <MessageCircle className="w-4 h-4" />
                      </span>
                      <span>
                        <strong>WhatsApp ile yaz</strong>
                        <em>Formu otomatik doldurur</em>
                      </span>
                    </a>
                    <button
                      type="button"
                      className="settings-license-box__back"
                      onClick={() => setRenewContactOpen(false)}
                    >
                      Kapat
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </SettingsSection>

        <SettingsSection icon={Building2} title="Firma Ayarları" className="flex flex-col">
          <div className="flex flex-col gap-4 h-full">
            {data && (
              <div className="settings-restaurant-code shrink-0">
                <div className="min-w-0">
                  <p className="settings-restaurant-code__label">Restoran Kodunuz</p>
                  <p className="settings-restaurant-code__hint">
                    Destek veya yenileme talebinde bu kodu paylaşın
                  </p>
                </div>
                <div className="settings-restaurant-code__value-wrap">
                  <span className="settings-restaurant-code__value">{data.restaurant.id}</span>
                  <button
                    type="button"
                    className="settings-restaurant-code__copy"
                    onClick={() => {
                      void navigator.clipboard.writeText(String(data.restaurant.id)).then(() => {
                        setCodeCopied(true);
                        window.setTimeout(() => setCodeCopied(false), 1800);
                      });
                    }}
                    aria-label="Kodu kopyala"
                  >
                    {codeCopied ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-6 items-stretch flex-1 min-h-0">
            <div className="flex flex-col gap-4 min-h-[240px]">
              <Input
                label="Firma Adı"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
              <div className="about-field-wrap flex-1 flex flex-col min-h-0">
                <button
                  type="button"
                  className="about-expand-btn"
                  title="Hakkında sayfasını özelleştir"
                  aria-label="Hakkında sayfasını büyüt"
                  onClick={() => setAboutEditorOpen(true)}
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
                <Textarea
                  label="Hakkında"
                  value={companyAbout}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCompanyAbout(v);
                    setAboutPage((p) => ({ ...p, body: v }));
                  }}
                  className="flex-1 [&_.float-field]:h-full [&_.float-field__input]:min-h-[140px] [&_.float-field__input]:h-full [&_.float-field__input]:resize-none"
                  rows={6}
                />
              </div>
            </div>

            <div className="flex flex-col min-h-[240px]">
              <p className="text-xs font-semibold uppercase tracking-wide admin-text-muted mb-2">
                Logo
              </p>
              <div
                className="flex-1 rounded-2xl border-2 border-dashed p-6 text-center transition hover:border-[var(--admin-accent)] cursor-pointer flex flex-col items-center justify-center min-h-[240px]"
                style={{ borderColor: 'var(--admin-card-border)' }}
                onClick={() => fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                />
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Logo önizleme"
                    className="max-h-28 max-w-full object-contain mb-2"
                  />
                ) : (
                  <ImagePlus
                    className="w-10 h-10 mb-2"
                    style={{ color: 'var(--admin-accent)' }}
                  />
                )}
                <p className="text-sm font-medium text-[var(--admin-text)]">
                  Logo yüklemek için tıklayın
                </p>
                <p className="text-xs admin-text-subtle mt-1">PNG, JPG — şeffaf arka plan önerilir</p>
              </div>
            </div>
          </div>
          </div>
        </SettingsSection>
      </div>

      <div className="settings-welcome-split">
        <SettingsSection
          icon={MessageSquare}
          title="Karşılama Metinleri"
          className="settings-welcome-split__texts"
          bodyClassName="settings-welcome-split__texts-body admin-scroll"
        >
          <div className="grid sm:grid-cols-1 gap-4 float-field-stack">
            {activeLanguages.length === 0 ? (
              <p className="text-sm admin-text-muted">
                Karşılama metni eklemek için en az bir dil aktif olmalı.
              </p>
            ) : (
              activeLanguages.map((lang) => (
                <TranslatableTextarea
                  key={lang.id}
                  label={`Karşılama metni (${lang.name})`}
                  rows={3}
                  sourceText={trWelcomeMessage}
                  targetLang={lang.code}
                  value={messages[lang.id] || ''}
                  onChange={(val) => setMessages({ ...messages, [lang.id]: val })}
                />
              ))
            )}
          </div>
        </SettingsSection>

        <section className="admin-card overflow-hidden flex flex-col settings-welcome-split__social">
          <div
            className="w-full flex items-center gap-2.5 px-5 py-3.5 shrink-0"
            style={{ background: 'var(--admin-input-bg)' }}
          >
            <Share2 className="w-4 h-4 shrink-0" style={{ color: 'var(--admin-accent)' }} />
            <span className="text-sm font-bold uppercase tracking-wide text-[var(--admin-text)] flex-1">
              Sosyal Medya
            </span>
            <span className="text-[11px] font-semibold admin-text-muted">{filledSocialCount} dolu</span>
          </div>

          <div className="p-4 space-y-2 settings-welcome-split__social-body admin-scroll">
            {SOCIAL_PLATFORMS.map((platform) => {
              const row = platformSocial.find((s) => s.id === platform.id) || {
                id: platform.id,
                value: '',
                showWelcome: false,
                showMenu: false,
              };
              return (
                <div key={platform.id} className="social-settings-row">
                  <span
                    className="social-settings-row__icon"
                    style={{
                      background:
                        platform.id === 'instagram'
                          ? 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)'
                          : platform.color,
                    }}
                    title={platform.name}
                  >
                    <SocialBrandIcon id={platform.id} className="w-4 h-4 text-white" />
                  </span>
                  <input
                    type={platform.kind === 'phone' ? 'tel' : 'url'}
                    className="social-settings-row__input"
                    placeholder={platform.placeholder}
                    value={row.value}
                    onChange={(e) => updateSocial(platform.id, { value: e.target.value })}
                    aria-label={platform.name}
                  />
                  <label className="social-settings-row__toggle" title="Karşılamada göster">
                    <input
                      type="checkbox"
                      checked={row.showWelcome}
                      onChange={(e) =>
                        updateSocial(platform.id, { showWelcome: e.target.checked })
                      }
                    />
                    <span>Karşılama</span>
                  </label>
                  <label className="social-settings-row__toggle" title="Menüde göster">
                    <input
                      type="checkbox"
                      checked={row.showMenu}
                      onChange={(e) => updateSocial(platform.id, { showMenu: e.target.checked })}
                    />
                    <span>Menü</span>
                  </label>
                </div>
              );
            })}

            {customSocial.map((row) => (
              <div key={row.id} className="social-settings-row social-settings-row--custom">
                <button
                  type="button"
                  className="social-settings-row__icon social-settings-row__icon--btn"
                  style={{
                    background: row.iconUrl ? 'transparent' : '#475569',
                    overflow: 'hidden',
                    padding: row.iconUrl ? 0 : undefined,
                  }}
                  title="İkon seç"
                  onClick={(e) => openIconPicker(row.id, e.currentTarget)}
                >
                  <SocialDisplayIcon
                    id={row.id}
                    iconKey={row.iconKey}
                    iconUrl={row.iconUrl}
                    className="w-4 h-4 text-white"
                  />
                </button>
                <input
                  type="text"
                  className="social-settings-row__input social-settings-row__input--label"
                  placeholder="İsim (opsiyonel)"
                  value={row.label || ''}
                  onChange={(e) => updateSocial(row.id, { label: e.target.value })}
                  aria-label="Özel link adı"
                />
                <input
                  type="url"
                  className="social-settings-row__input"
                  placeholder="https://..."
                  value={row.value}
                  onChange={(e) => updateSocial(row.id, { value: e.target.value })}
                  aria-label="Özel link"
                />
                <label className="social-settings-row__toggle" title="Karşılamada göster">
                  <input
                    type="checkbox"
                    checked={row.showWelcome}
                    onChange={(e) => updateSocial(row.id, { showWelcome: e.target.checked })}
                  />
                  <span>Karşılama</span>
                </label>
                <label className="social-settings-row__toggle" title="Menüde göster">
                  <input
                    type="checkbox"
                    checked={row.showMenu}
                    onChange={(e) => updateSocial(row.id, { showMenu: e.target.checked })}
                  />
                  <span>Menü</span>
                </label>
                <button
                  type="button"
                  className="social-settings-row__remove"
                  title="Sil"
                  onClick={() => removeCustomSocial(row.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            <button type="button" className="social-settings-add" onClick={addCustomSocial}>
              <Plus className="w-4 h-4" />
              Kendi linkini ekle
            </button>

            <input
              ref={customIconInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                const id = pendingCustomIconIdRef.current;
                pendingCustomIconIdRef.current = null;
                e.target.value = '';
                if (!file || !id) return;
                void uploadCustomIcon(id, file);
              }}
            />
          </div>
        </section>
      </div>

      <SettingsSection icon={Music2} title="Karşılama Müziği / Çağırma Ayarları">
        <div className="settings-welcome-music">
          <p className="settings-welcome-music__hint">
            YouTube video linki veya doğrudan ses dosyası (mp3, m4a, ogg) yapıştırın. Karşılama
            ekranında bu müzik çalar. Boş bırakırsanız varsayılan ambient kullanılır. Spotify sayfa
            linkleri desteklenmez.
          </p>
          <Input
            label="Müzik linki"
            type="url"
            placeholder="https://www.youtube.com/watch?v=… veya https://…/muzik.mp3"
            value={welcomeMusicUrl}
            onChange={(e) => setWelcomeMusicUrl(e.target.value)}
          />
          {welcomeMusicUrl.trim() && /spotify\.com|open\.spotify/i.test(welcomeMusicUrl) && (
            <p className="settings-welcome-music__warn">
              Spotify linki desteklenmiyor. YouTube veya doğrudan mp3 linki kullanın.
            </p>
          )}

          <div className="settings-menu-features">
            <p className="settings-menu-features__caption">Menü çağırma</p>
            <div className="settings-menu-features__row">
              <button
                type="button"
                className="settings-feature-toggle"
                role="switch"
                aria-checked={tableServiceEnabled}
                disabled={togglingMenuFeature === 'table'}
                onClick={() => void toggleTableService()}
              >
                <span className="settings-feature-toggle__label">
                  <HandHelping className="w-4 h-4 shrink-0" style={{ color: 'var(--admin-accent)' }} />
                  Garson çağır
                </span>
                <span
                  className={`settings-switch${tableServiceEnabled ? ' is-on' : ''}`}
                  aria-hidden
                >
                  <span className="settings-switch__knob" />
                </span>
              </button>

              <button
                type="button"
                className={`settings-feature-toggle${!assistantOwned ? ' is-disabled' : ''}`}
                role="switch"
                aria-checked={assistantEnabled}
                disabled={!assistantOwned || togglingMenuFeature === 'assistant'}
                onClick={() => void toggleMenuAssistant()}
                title={
                  assistantOwned
                    ? undefined
                    : 'Menü Asistanı için önce Eklentiler’den satın alın'
                }
              >
                <span className="settings-feature-toggle__label">
                  <Sparkles className="w-4 h-4 shrink-0" style={{ color: 'var(--admin-accent)' }} />
                  Menü Asistanı
                </span>
                <span
                  className={`settings-switch${assistantEnabled ? ' is-on' : ''}`}
                  aria-hidden
                >
                  <span className="settings-switch__knob" />
                </span>
              </button>
            </div>
            <p className="settings-menu-features__hint">
              Menüdeki yüzen butonları buradan açıp kapatabilirsiniz. Menü Asistanı için önce
              Eklentiler’den satın almanız gerekir.
            </p>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection icon={MapPinned} title="Konum Kilidi (QR Bölgesi)">
        <div className="geo-lock-admin">
          <p className="geo-lock-admin__hint">
            Açıkken menü yalnızca seçtiğiniz daire içinde konum izni veren müşterilere açılır.
            Dışarıdan QR okutanlar karşılama ekranını görmez; “Bölge dışındasınız” uyarısı alır.
          </p>
          <button
            type="button"
            className="settings-feature-toggle geo-lock-admin__toggle"
            role="switch"
            aria-checked={geoLock.enabled}
            onClick={() => setGeoLock((g) => ({ ...g, enabled: !g.enabled }))}
          >
            <span className="settings-feature-toggle__label">
              <MapPinned className="w-4 h-4 shrink-0" style={{ color: 'var(--admin-accent)' }} />
              Konum kilidini kullan
            </span>
            <span className={`settings-switch${geoLock.enabled ? ' is-on' : ''}`} aria-hidden>
              <span className="settings-switch__knob" />
            </span>
          </button>
          {geoLock.enabled ? (
            <GeoLockMapEditor value={geoLock} onChange={setGeoLock} />
          ) : (
            <p className="geo-lock-admin__hint">
              Kilidi açınca bölge arayıp haritada restoran konumunu ve yarıçapı ayarlayabilirsiniz.
            </p>
          )}
        </div>
      </SettingsSection>

      {iconPickerFor &&
        iconPickerPos &&
        createPortal(
          <>
            <button
              type="button"
              className="social-icon-picker-backdrop"
              aria-label="İkon seçiciyi kapat"
              onClick={closeIconPicker}
            />
            <div
              className="social-icon-picker social-icon-picker--portal"
              style={{ left: iconPickerPos.left, bottom: iconPickerPos.bottom }}
              role="dialog"
              aria-label="İkon seç"
            >
              <div className="social-icon-picker__grid">
                {CUSTOM_ICON_OPTIONS.map((opt) => {
                  const Icon = CUSTOM_ICONS[opt.id];
                  const row = customSocial.find((c) => c.id === iconPickerFor);
                  const active = row?.iconKey === opt.id && !row?.iconUrl;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      title={opt.label}
                      className={`social-icon-picker__item ${active ? 'is-active' : ''}`}
                      onClick={() => {
                        updateSocial(iconPickerFor, { iconKey: opt.id, iconUrl: null });
                        closeIconPicker();
                      }}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className="social-icon-picker__upload"
                disabled={uploadingIconFor === iconPickerFor}
                onClick={() => {
                  pendingCustomIconIdRef.current = iconPickerFor;
                  customIconInputRef.current?.click();
                }}
              >
                {uploadingIconFor === iconPickerFor ? 'Yükleniyor…' : 'Kendi görselini yükle'}
              </button>
            </div>
          </>,
          document.body
        )}

      <AddLanguageModal
        open={addLangOpen}
        existing={data.languages}
        translateStatus={translateStatus}
        saving={addingLang}
        onClose={() => setAddLangOpen(false)}
        onAdd={handleAddLanguage}
      />

      <AddCurrencyModal
        open={addCurrencyOpen}
        existing={currencies}
        saving={addingCurrency}
        onClose={() => setAddCurrencyOpen(false)}
        onAdd={handleAddCurrency}
      />

      <AboutPageEditorModal
        open={aboutEditorOpen}
        initial={{ ...aboutPage, body: companyAbout }}
        restaurantName={companyName || data?.restaurant.name || 'Restoran'}
        saving={saving}
        onClose={() => setAboutEditorOpen(false)}
        onSave={async (config) => {
          setAboutPage(config);
          setCompanyAbout(config.body);
          setSaving(true);
          try {
            await api('/api/admin/settings/company', {
              method: 'PUT',
              body: JSON.stringify({
                name: companyName,
                about: config.body,
                aboutPage: config,
              }),
            });
            setAboutEditorOpen(false);
          } catch {
            /* keep open */
          } finally {
            setSaving(false);
          }
        }}
        onCoverUploaded={(coverUrl) => {
          setAboutPage((p) => ({ ...p, coverUrl }));
        }}
      />
    </div>
  );
}
