import { useSearchParams } from 'react-router-dom';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowUpRight,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Crop,
  Globe,
  HandHelping,
  ImagePlus,
  KeyRound,
  Link2,
  MapPinned,
  Phone,
  Plug,
  PlugZap,
  Plus,
  Save,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { api, imageUrl } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader, Spinner } from '@/components/ui';
import AdminOverlay from '@/components/admin/AdminOverlay';
import { useImageBackground } from '@/components/admin/ImageBackgroundProvider';
import type { ImageBackgroundMode } from '@/components/admin/ImageBackgroundRemover';
import AdminToast, {
  type AdminToastNotice,
} from '@/components/admin/AdminToast';
import { autoTranslate } from '@/lib/translate';
import SocialBrandIcon from '@/components/SocialBrandIcon';
import {
  SocialDisplayIcon,
  CUSTOM_ICONS,
} from '@/components/SocialDisplayIcon';
import GeoLockMapEditor from '@/components/admin/GeoLockMapEditor';
import type { GeoLockConfig } from '@/lib/geoLock';
import { DEFAULT_ABOUT_PAGE, parseAboutPage } from '@/lib/aboutPage';
import LanguageFlag from '@/components/LanguageFlag';
import {
  LANGUAGE_CATALOG,
  catalogByCode,
  type CatalogLanguage,
} from '@/lib/languageCatalog';
import { CURRENCY_CATALOG, type CatalogCurrency } from '@/lib/currencyCatalog';
import {
  CUSTOM_ICON_OPTIONS,
  mergeSocialConfigs,
  newCustomSocialLink,
  SOCIAL_PLATFORMS,
  splitSocialConfigs,
  type SocialLinkConfig,
} from '@/lib/socialCatalog';
import { useAddons } from '@/hooks/useAddons';
import { resolveServiceItems, type MenuServiceItem } from '@/lib/tableService';
import ServiceItemsEditor from '@/components/admin/ServiceItemsEditor';
import { daysUntilLicenseEnd, formatLicenseDate } from '@/lib/license';
import {
  SUPPORT_PHONE_DISPLAY,
  SUPPORT_PHONE_TEL,
  supportWhatsAppUrl,
} from '@/lib/supportContact';
import ImageFitSettings from '@/components/admin/ImageFitSettings';
import IntegrationsSettings from '@/components/admin/IntegrationsSettings';
import '@/admin-settings.css';

type SectionId =
  'business' | 'menu' | 'images' | 'integrations' | 'localization' | 'social' | 'connections';
interface Language {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
}
interface Currency extends Language {
  symbol: string;
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
  welcomeMessages: {
    languageId: number;
    languageCode: string;
    message: string;
  }[];
  settings: Record<string, string>;
}
const SECTIONS: {
  id: SectionId;
  title: string;
  description: string;
  icon: typeof Globe;
}[] = [
  {
    id: 'business',
    title: 'İşletme',
    description: 'İsim, logo ve hikâyeniz',
    icon: Building2,
  },
  {
    id: 'menu',
    title: 'Menü deneyimi',
    description: 'Karşılama, servis ve konum',
    icon: HandHelping,
  },
  {
    id: 'images',
    title: 'Resim kırpma',
    description: 'Görseller nasıl görünsün',
    icon: Crop,
  },
  {
    id: 'integrations',
    title: 'Entegrasyonlar',
    description: 'E-posta, SMS ve yorum bağlantıları',
    icon: PlugZap,
  },
  {
    id: 'localization',
    title: 'Dil ve para',
    description: 'Menünüzün konuştuğu diller',
    icon: Globe,
  },
  {
    id: 'social',
    title: 'Sosyal bağlantılar',
    description: 'Hesaplarınız ve özel linkler',
    icon: Share2,
  },
  {
    id: 'connections',
    title: 'Bağlantılar',
    description: 'Entegrasyon ve lisans',
    icon: Plug,
  },
];
function Section({
  title,
  description,
  children,
  action,
  className = '',
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`ast-card ${className}`}>
      <header className="ast-card-head">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </header>
      <div className="ast-card-body">{children}</div>
    </section>
  );
}
function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled,
  icon: Icon,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  icon?: typeof Globe;
}) {
  return (
    <button
      type="button"
      className="ast-toggle"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
    >
      {Icon && <Icon size={20} strokeWidth={1.6} />}
      <span>
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
      <span className="ast-switch" aria-hidden="true">
        <span />
      </span>
    </button>
  );
}
const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : 'İşlem tamamlanamadı.';

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const { isOwned, isEnabled, setEnabled } = useAddons();
  const [searchParams, setSearchParams] = useSearchParams();
  const [active, setActive] = useState<SectionId>(() =>
    searchParams.get('focus') === 'languages' ? 'localization' : 'business',
  );
  const [navOpen, setNavOpen] = useState(false),
    [revision, setRevision] = useState(0);
  const [data, setData] = useState<SettingsData | null>(null),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(false);
  const [languages, setLanguages] = useState<Language[]>([]),
    [currencies, setCurrencies] = useState<Currency[]>([]);
  const [companyName, setCompanyName] = useState(''),
    [companyAbout, setCompanyAbout] = useState('');
  const aboutPage = useRef(DEFAULT_ABOUT_PAGE);
  const [messages, setMessages] = useState<Record<number, string>>({});
  const [integrationEnabled, setIntegrationEnabled] = useState(false),
    [openaiApiKey, setOpenaiApiKey] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null),
    [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [socialLinks, setSocialLinks] = useState<SocialLinkConfig[]>(
    mergeSocialConfigs([]),
  );
  const [welcomeMusicUrl, setWelcomeMusicUrl] = useState(''),
    [serviceItems, setServiceItems] = useState<MenuServiceItem[]>(() => resolveServiceItems());
  const [tableCodeEnabled, setTableCodeEnabled] = useState(false),
    [tableCodeTtl, setTableCodeTtl] = useState(120);
  const [geoLock, setGeoLock] = useState<GeoLockConfig>({
    enabled: false,
    lat: 36.8121,
    lng: 34.6415,
    radiusMeters: 120,
  });
  const [dirty, setDirty] = useState<SectionId[]>([]),
    [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<AdminToastNotice>(null);
  const [picker, setPicker] = useState<'language' | 'currency' | null>(null),
    [catalogQuery, setCatalogQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{
    kind: 'language' | 'currency';
    id: number;
    name: string;
  } | null>(null);
  const [catalogBusy, setCatalogBusy] = useState(false),
    [assistantBusy, setAssistantBusy] = useState(false);
  const [iconFor, setIconFor] = useState<string | null>(null),
    [uploadingIcon, setUploadingIcon] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null),
    iconInputRef = useRef<HTMLInputElement>(null);
  const actionLock = useRef(false),
    contentRef = useRef<HTMLDivElement>(null);
  const [translating, setTranslating] = useState<string | null>(null);
  const busy =
    saving ||
    catalogBusy ||
    assistantBusy ||
    uploadingIcon ||
    translating !== null;
  const toast = (text: string, error = false) => setNotice({ text, error });
  const { mode: imageMode, prepare: prepareImages, setMode: setImageMode } = useImageBackground();
  async function chooseImageMode(next: ImageBackgroundMode) {
    if (next === imageMode) return;
    try {
      await setImageMode(next);
      toast('Görsel ayarı kaydedildi.');
    } catch (err) {
      toast(errorMessage(err), true);
    }
  }
  const mark = (section: SectionId) =>
    setDirty((list) => (list.includes(section) ? list : [...list, section]));
  const { platforms: platformSocial, customs: customSocial } =
    splitSocialConfigs(socialLinks);
  const current = SECTIONS.find((s) => s.id === active)!;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(false);
    api<SettingsData>('/api/admin/settings', { signal: controller.signal })
      .then(async (d) => {
        let curs = d.currencies;
        if (!curs)
          curs = await api<Currency[]>('/api/admin/currencies', {
            signal: controller.signal,
          });
        if (controller.signal.aborted) return;
        setData(d);
        setLanguages(d.languages);
        setCurrencies(curs);
        setCompanyName(d.restaurant.name);
        setCompanyAbout(d.settings.company_about || '');
        aboutPage.current = parseAboutPage(
          d.settings.company_about_page,
          d.settings.company_about || '',
        );
        setMessages(
          Object.fromEntries(
            d.welcomeMessages.map((m) => [m.languageId, m.message]),
          ),
        );
        setIntegrationEnabled(d.settings.integration_enabled === 'true');
        setOpenaiApiKey(d.settings.openai_api_key || '');
        setLogoPreview(
          d.restaurant.logoUrl ? imageUrl(d.restaurant.logoUrl) : null,
        );
        try {
          setSocialLinks(
            mergeSocialConfigs(JSON.parse(d.settings.social_links || '[]')),
          );
        } catch {
          setSocialLinks(mergeSocialConfigs([]));
        }
        setWelcomeMusicUrl(d.settings.welcome_music_url || '');
        setServiceItems(
          resolveServiceItems(
            d.settings.menu_table_service_enabled,
            d.settings.menu_service_items,
          ),
        );
        setTableCodeEnabled(
          ['true', '1'].includes(d.settings.table_session_code_enabled),
        );
        const ttl = Number(d.settings.table_session_code_ttl_minutes);
        setTableCodeTtl(
          Number.isFinite(ttl) && ttl > 0
            ? Math.min(120, Math.max(15, Math.round(ttl)))
            : 120,
        );
        try {
          const g = JSON.parse(d.settings.geo_lock || 'null');
          if (
            g &&
            Number.isFinite(Number(g.lat)) &&
            Number.isFinite(Number(g.lng))
          )
            setGeoLock({
              enabled: Boolean(g.enabled),
              lat: Number(g.lat),
              lng: Number(g.lng),
              radiusMeters: Math.min(
                2000,
                Math.max(30, Number(g.radiusMeters) || 120),
              ),
            });
        } catch {
          /* Defaults remain usable. */
        }
        setDirty([]);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [revision]);
  useEffect(() => {
    if (searchParams.get('focus') !== 'languages') return;
    setActive('localization');
    const next = new URLSearchParams(searchParams);
    next.delete('focus');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
  useEffect(() => {
    if (!logoFile) return;
    const url = URL.createObjectURL(logoFile);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);
  useEffect(() => {
    if (!dirty.length) return;
    const before = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', before);
    return () => window.removeEventListener('beforeunload', before);
  }, [dirty.length]);

  function choose(section: SectionId) {
    setActive(section);
    setNavOpen(false);
    contentRef.current?.scrollIntoView({ behavior: 'instant', block: 'start' });
  }
  async function save() {
    if (actionLock.current || !data || !dirty.length) return;
    if (dirty.includes('business') && !companyName.trim()) {
      setActive('business');
      toast('İşletme adı gerekli.', true);
      return;
    }
    if (dirty.includes('menu') && /spotify\.com/i.test(welcomeMusicUrl)) {
      setActive('menu');
      toast('YouTube veya doğrudan ses dosyası bağlantısı kullanın.', true);
      return;
    }
    actionLock.current = true;
    setSaving(true);
    let partial = false;
    const put = (path: string, body: unknown) =>
      api('/api/admin/settings/' + path, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    try {
      if (dirty.includes('business')) {
        await put('company', {
          name: companyName.trim(),
          about: companyAbout,
          aboutPage: { ...aboutPage.current, body: companyAbout },
        });
        partial = true;
        if (logoFile) {
          const fd = new FormData();
          fd.append('logo', logoFile);
          const res = await api<{ logoUrl: string }>(
            '/api/admin/settings/logo',
            { method: 'POST', body: fd },
          );
          setLogoPreview(imageUrl(res.logoUrl));
          setLogoFile(null);
        }
      }
      if (dirty.includes('localization')) {
        await put('languages', {
          languages: languages.map((l) => ({ id: l.id, isActive: l.isActive })),
        });
        partial = true;
        await put('currencies', {
          currencies: currencies.map((c) => ({
            id: c.id,
            isActive: c.isActive,
          })),
        });
      }
      if (dirty.includes('menu')) {
        await put('welcome-messages', {
          messages: Object.entries(messages).map(([languageId, message]) => ({
            languageId: Number(languageId),
            message,
          })),
        });
        partial = true;
        await put('welcome-music', { url: welcomeMusicUrl });
        await put('menu-features', {
          serviceItems,
          tableSessionCode: tableCodeEnabled,
          tableSessionCodeTtlMinutes: tableCodeTtl,
        });
        await put('geo-lock', geoLock);
      }
      if (dirty.includes('social')) {
        await put('social', { links: socialLinks });
        partial = true;
      }
      if (dirty.includes('connections')) {
        await put('integration', { enabled: integrationEnabled, openaiApiKey });
        partial = true;
      }
      setDirty([]);
      toast('Değişiklikler kaydedildi.');
      void refreshUser().catch(() =>
        toast(
          'Ayarlar kaydedildi. Panel bilgileri için sayfayı yenileyebilirsiniz.',
          true,
        ),
      );
    } catch (err) {
      toast(
        (partial
          ? 'Bazı ayarlar kaydedilmiş olabilir. Taslağınız korunuyor; tekrar deneyin. '
          : '') + errorMessage(err),
        true,
      );
    } finally {
      actionLock.current = false;
      setSaving(false);
    }
  }
  function openPicker(kind: 'language' | 'currency') {
    setCatalogQuery('');
    setPicker(kind);
  }
  async function addCatalog(item: CatalogLanguage | CatalogCurrency) {
    if (actionLock.current || !picker) return;
    actionLock.current = true;
    setCatalogBusy(true);
    try {
      if (picker === 'language') {
        const created = await api<Language>('/api/admin/languages', {
          method: 'POST',
          body: JSON.stringify({ code: item.code, name: item.name }),
        });
        setLanguages((list) =>
          list.some((l) => l.id === created.id)
            ? list.map((l) => (l.id === created.id ? created : l))
            : [...list, created],
        );
        setMessages((m) => ({ ...m, [created.id]: m[created.id] || '' }));
      } else {
        const c = item as CatalogCurrency;
        const created = await api<Currency>('/api/admin/currencies', {
          method: 'POST',
          body: JSON.stringify({
            code: c.code,
            name: c.name,
            symbol: c.symbol,
          }),
        });
        setCurrencies((list) =>
          list.some((l) => l.id === created.id)
            ? list.map((l) => (l.id === created.id ? created : l))
            : [...list, created],
        );
      }
      setPicker(null);
      toast(item.name + ' eklendi.');
    } catch (err) {
      toast(errorMessage(err), true);
    } finally {
      actionLock.current = false;
      setCatalogBusy(false);
    }
  }
  async function deleteCatalog() {
    if (actionLock.current || !deleteTarget) return;
    actionLock.current = true;
    setCatalogBusy(true);
    try {
      const target = deleteTarget;
      await api(
        `/api/admin/${target.kind === 'language' ? 'languages' : 'currencies'}/${target.id}`,
        { method: 'DELETE' },
      );
      if (target.kind === 'language') {
        setLanguages((list) => list.filter((l) => l.id !== target.id));
        setMessages((m) => {
          const next = { ...m };
          delete next[target.id];
          return next;
        });
      } else setCurrencies((list) => list.filter((c) => c.id !== target.id));
      setDeleteTarget(null);
      toast(target.name + ' silindi.');
    } catch (err) {
      toast(errorMessage(err), true);
    } finally {
      actionLock.current = false;
      setCatalogBusy(false);
    }
  }
  async function toggleAssistant() {
    if (actionLock.current || !isOwned('menu-assistant')) return;
    actionLock.current = true;
    setAssistantBusy(true);
    try {
      await setEnabled('menu-assistant', !isEnabled('menu-assistant'));
      toast('Menü Asistanı güncellendi.');
    } catch (err) {
      toast(errorMessage(err), true);
    } finally {
      actionLock.current = false;
      setAssistantBusy(false);
    }
  }
  function updateSocial(id: string, patch: Partial<SocialLinkConfig>) {
    setSocialLinks((list) =>
      list.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );
    mark('social');
  }
  async function uploadIcon(file: File) {
    if (actionLock.current || !iconFor) return;
    actionLock.current = true;
    setUploadingIcon(true);
    try {
      const fd = new FormData();
      fd.append('icon', file);
      const res = await api<{ iconUrl: string }>(
        '/api/admin/settings/social-icon',
        { method: 'POST', body: fd },
      );
      updateSocial(iconFor, { iconUrl: res.iconUrl, iconKey: 'link' });
      setIconFor(null);
      toast('İkon yüklendi. Yayınlamak için kaydedin.');
    } catch (err) {
      toast(errorMessage(err), true);
    } finally {
      actionLock.current = false;
      setUploadingIcon(false);
    }
  }
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(String(data?.restaurant.id));
      toast('Restoran kodu kopyalandı.');
    } catch {
      toast('Kod kopyalanamadı.', true);
    }
  }
  async function translateMessage(lang: Language) {
    if (actionLock.current) return;
    const source = languages.find((l) => l.code === 'tr');
    const text = source ? messages[source.id]?.trim() : '';
    if (!text) {
      toast('Önce Türkçe karşılama metnini yazın.', true);
      return;
    }
    actionLock.current = true;
    setTranslating(lang.code);
    try {
      const translated = await autoTranslate(text, 'tr', lang.code);
      setMessages((m) => ({ ...m, [lang.id]: translated }));
      mark('menu');
      toast('Çeviri hazır. Yayınlamak için kaydedin.');
    } catch (err) {
      toast(errorMessage(err), true);
    } finally {
      actionLock.current = false;
      setTranslating(null);
    }
  }
  function socialRow(
    row: SocialLinkConfig,
    name: string,
    placeholder: string,
    phone = false,
    custom = false,
  ) {
    return (
      <div className="ast-social-row" key={row.id}>
        <div className="ast-social-identity">
          {custom ? (
            <button
              type="button"
              className="ast-social-icon"
              aria-label={`${row.label || 'Özel link'} ikonunu seç`}
              onClick={() => setIconFor(row.id)}
            >
              <SocialDisplayIcon
                id={row.id}
                iconKey={row.iconKey}
                iconUrl={row.iconUrl}
                className="w-5 h-5"
              />
            </button>
          ) : (
            <span className="ast-social-icon">
              {SOCIAL_PLATFORMS.find((p) => p.id === row.id) ? (
                <SocialBrandIcon
                  id={SOCIAL_PLATFORMS.find((p) => p.id === row.id)!.id}
                  className="w-5 h-5"
                />
              ) : (
                <Link2 size={20} />
              )}
            </span>
          )}
          {custom ? (
            <label>
              Bağlantı adı
              <input
                value={row.label || ''}
                onChange={(e) =>
                  updateSocial(row.id, { label: e.target.value })
                }
                aria-label="Özel link adı"
                placeholder="Örn. Yol tarifi"
              />
            </label>
          ) : (
            <strong>{name}</strong>
          )}
          {custom && (
            <button
              type="button"
              className="ast-icon-button is-danger"
              aria-label="Özel linki kaldır"
              onClick={() => {
                setSocialLinks((list) => list.filter((s) => s.id !== row.id));
                mark('social');
              }}
            >
              <Trash2 size={17} />
            </button>
          )}
        </div>
        <input
          className="ast-social-url"
          type={phone ? 'tel' : 'text'}
          aria-label={custom ? 'Özel link' : name}
          placeholder={placeholder}
          value={row.value}
          onChange={(e) => updateSocial(row.id, { value: e.target.value })}
        />
        <div
          className="ast-visibility"
          role="group"
          aria-label={`${name} görünürlüğü`}
        >
          {(['showWelcome', 'showMenu'] as const).map((key) => (
            <button
              type="button"
              key={key}
              aria-pressed={row[key]}
              onClick={() => updateSocial(row.id, { [key]: !row[key] })}
            >
              {row[key] && <Check size={13} />}{' '}
              {key === 'showWelcome' ? 'Karşılama' : 'Menü'}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (loading)
    return (
      <div className="ast-loading">
        <PageHeader title="Ayarlar" />
        <Spinner />
      </div>
    );
  if (loadError || !data)
    return (
      <div className="ast-page">
        <PageHeader title="Ayarlar" />
        <div className="ast-load-error" role="alert">
          <Plug size={32} />
          <h2>Ayarlar yüklenemedi.</h2>
          <p>Mevcut ayarlarınız değiştirilmedi.</p>
          <button
            className="ast-button"
            onClick={() => setRevision((v) => v + 1)}
          >
            Tekrar dene
          </button>
        </div>
      </div>
    );
  const activeLanguages = [...languages.filter((l) => l.isActive)].sort(
    (a, b) =>
      a.code === 'tr'
        ? -1
        : b.code === 'tr'
          ? 1
          : a.name.localeCompare(b.name, 'tr'),
  );
  const days = daysUntilLicenseEnd(data.restaurant.licenseExpiresAt);
  const catalogItems =
    picker === 'language' ? LANGUAGE_CATALOG : CURRENCY_CATALOG;
  const existing = new Set(
    (picker === 'language' ? languages : currencies).map((l) =>
      l.code.toLowerCase(),
    ),
  );
  const filtered = catalogItems.filter((item) =>
    [item.code, item.name, 'nativeName' in item ? item.nativeName : ''].some(
      (s) =>
        s
          .toLocaleLowerCase('tr')
          .includes(catalogQuery.trim().toLocaleLowerCase('tr')),
    ),
  );
  return (
    <div className={`ast-page${dirty.length ? ' has-draft' : ''}`}>
      <PageHeader
        title="Ayarlar"
        subtitle="İşletmenizin menüsünü, dilini ve bağlantılarını yönetin."
      />
      <div className="ast-layout">
        <aside className="ast-nav" aria-label="Ayar bölümleri">
          <div className="ast-nav-identity">
            {logoPreview ? (
              <img src={logoPreview} alt="" />
            ) : (
              <Building2 size={27} />
            )}
            <div>
              <strong>{companyName || 'İşletmeniz'}</strong>
              <span>Restoran #{data.restaurant.id}</span>
            </div>
          </div>
          {SECTIONS.map((s, i) => (
            <button
              type="button"
              key={s.id}
              aria-current={active === s.id ? 'page' : undefined}
              onClick={() => choose(s.id)}
            >
              <s.icon size={20} strokeWidth={1.5} />
              <span>
                <strong>{s.title}</strong>
                <small>{s.description}</small>
              </span>
              {dirty.includes(s.id) ? (
                <i aria-label="Kaydedilmedi" />
              ) : (
                <span className="ast-nav-index">0{i + 1}</span>
              )}
            </button>
          ))}
          <p>Değişiklikleriniz siz kaydedince yayınlanır.</p>
        </aside>
        <div className="ast-main" ref={contentRef}>
          <button
            type="button"
            className="ast-mobile-nav"
            aria-expanded={navOpen}
            onClick={() => setNavOpen(true)}
          >
            <current.icon size={20} />
            <span>{current.title}</span>
            <ChevronDown size={18} />
          </button>
          <fieldset className="ast-workspace" disabled={busy} key={active}>
            {active === 'images' && <ImageFitSettings onToast={toast} />}
            {active === 'integrations' && <IntegrationsSettings onToast={toast} adminEmail={user?.email} />}
            {active === 'business' && (
              <>
                <Section
                  title="İşletmenin kimliği"
                  description="Misafirleriniz sizi bu isim ve logoyla tanısın."
                >
                  <div className="ast-brand-edit">
                    <button
                      type="button"
                      className="ast-logo"
                      onClick={() => fileRef.current?.click()}
                      aria-label="Logo değiştir"
                    >
                      {logoPreview ? (
                        <img src={logoPreview} alt="Logo önizleme" />
                      ) : (
                        <Building2 size={36} />
                      )}
                      <span>
                        <ImagePlus size={15} />
                      </span>
                    </button>
                    <div>
                      <label>
                        İşletme adı
                        <input
                          value={companyName}
                          onChange={(e) => {
                            setCompanyName(e.target.value);
                            mark('business');
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        className="ast-text-button"
                        onClick={() => fileRef.current?.click()}
                      >
                        Logoyu değiştir <ArrowUpRight size={14} />
                      </button>
                    </div>
                  </div>
                </Section>
                <Section
                  title="Görseller"
                  description="Ürün ve grup görseli yüklerken arka planın nasıl ele alınacağını seçin."
                >
                  <div className="ast-radio-list" role="radiogroup" aria-label="Görsel arka planı">
                    {(
                      [
                        ['ask', 'Her seferinde sor', 'Görsel yüklerken arka planı silmek isteyip istemediğiniz sorulur.'],
                        ['auto', 'Düzse otomatik sil', 'Arka planı tek renk olan görseller sorulmadan şeffaf yapılır; fotoğraf gibi karmaşık görsellere dokunulmaz.'],
                        ['never', 'Hiç sorma', 'Görseller olduğu gibi yüklenir.'],
                      ] as const
                    ).map(([value, label, hint]) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={imageMode === value}
                        disabled={imageMode === undefined}
                        onClick={() => void chooseImageMode(value)}
                      >
                        <span>
                          <strong>{label}</strong>
                          <small>{hint}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="ast-hint">
                    {imageMode === null
                      ? 'Henüz seçmediniz: ilk ürün veya grup görselinde sorulur. Seçiminiz tüm işletme için geçerli olur ve hemen kaydedilir.'
                      : 'Seçiminiz tüm işletme için geçerlidir ve hemen kaydedilir. Logo yüklerken her zaman sorulur.'}
                  </p>
                </Section>
                <Section
                  title="Hakkımızda"
                  description="Mekânınızı en iyi siz anlatırsınız."
                >
                  <label className="ast-about-label">
                    İşletmenizin hikâyesi
                    <textarea
                      aria-label="İşletmenizin hikâyesi"
                      rows={9}
                      value={companyAbout}
                      onChange={(e) => {
                        setCompanyAbout(e.target.value);
                        mark('business');
                      }}
                      placeholder="Kapınızdan giren misafirlerin sizi tanımasını sağlayın…"
                    />
                  </label>
                  <div className="ast-field-foot">
                    <span>Menünüzdeki Hakkımızda sayfasında görünür.</span>
                    <span>
                      {companyAbout.length.toLocaleString('tr')} karakter
                    </span>
                  </div>
                </Section>
              </>
            )}
            {active === 'localization' && (
              <>
                <Section
                  title="Menünün dilleri"
                  description="Türkçe sabit kalır; diğer dilleri dilediğinizde açabilirsiniz."
                  action={
                    <button
                      type="button"
                      className="ast-button"
                      onClick={() => openPicker('language')}
                    >
                      <Plus size={16} /> Dil ekle
                    </button>
                  }
                >
                  <div className="ast-catalog-list">
                    {[...languages]
                      .sort((a, b) =>
                        a.code === 'tr'
                          ? -1
                          : b.code === 'tr'
                            ? 1
                            : a.name.localeCompare(b.name, 'tr'),
                      )
                      .map((lang) => (
                        <div className="ast-catalog-row" key={lang.id}>
                          <LanguageFlag code={lang.code} size={25} />
                          <div>
                            <strong>{lang.name}</strong>
                            <small>
                              {catalogByCode(lang.code)?.nativeName ||
                                lang.code}
                            </small>
                          </div>
                          {lang.code === 'tr' ? (
                            <span className="ast-fixed-label">Varsayılan</span>
                          ) : (
                            <>
                              <button
                                type="button"
                                role="switch"
                                className="ast-mini-switch"
                                aria-label={`${lang.name} dilini göster`}
                                aria-checked={lang.isActive}
                                onClick={() => {
                                  setLanguages((list) =>
                                    list.map((l) =>
                                      l.id === lang.id
                                        ? { ...l, isActive: !l.isActive }
                                        : l,
                                    ),
                                  );
                                  mark('localization');
                                }}
                              >
                                <span className="ast-switch">
                                  <span />
                                </span>
                              </button>
                              <button
                                type="button"
                                className="ast-icon-button is-danger"
                                aria-label={`${lang.name} dilini sil`}
                                onClick={() =>
                                  setDeleteTarget({
                                    kind: 'language',
                                    id: lang.id,
                                    name: lang.name,
                                  })
                                }
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                  </div>
                </Section>
                <Section
                  title="Para birimleri"
                  description="Ürünlerin fiyatlarında kullanabileceğiniz para birimleri."
                  action={
                    <button
                      type="button"
                      className="ast-button"
                      onClick={() => openPicker('currency')}
                    >
                      <Plus size={16} /> Para birimi ekle
                    </button>
                  }
                >
                  <div className="ast-catalog-list">
                    {[...currencies]
                      .sort((a, b) =>
                        a.code === 'TRY'
                          ? -1
                          : b.code === 'TRY'
                            ? 1
                            : a.code.localeCompare(b.code),
                      )
                      .map((c) => (
                        <div className="ast-catalog-row" key={c.id}>
                          <span className="ast-currency-symbol">
                            {c.symbol}
                          </span>
                          <div>
                            <strong>{c.name}</strong>
                            <small>{c.code}</small>
                          </div>
                          {c.code === 'TRY' ? (
                            <span className="ast-fixed-label">Varsayılan</span>
                          ) : (
                            <>
                              <button
                                type="button"
                                role="switch"
                                className="ast-mini-switch"
                                aria-label={`${c.name} para birimini göster`}
                                aria-checked={c.isActive}
                                onClick={() => {
                                  setCurrencies((list) =>
                                    list.map((v) =>
                                      v.id === c.id
                                        ? { ...v, isActive: !v.isActive }
                                        : v,
                                    ),
                                  );
                                  mark('localization');
                                }}
                              >
                                <span className="ast-switch">
                                  <span />
                                </span>
                              </button>
                              <button
                                type="button"
                                className="ast-icon-button is-danger"
                                aria-label={`${c.name} para birimini sil`}
                                onClick={() =>
                                  setDeleteTarget({
                                    kind: 'currency',
                                    id: c.id,
                                    name: c.name,
                                  })
                                }
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                  </div>
                </Section>
              </>
            )}
            {active === 'menu' && (
              <>
                <Section
                  title="İlk sözü siz söyleyin."
                  description="Misafirlerinizi kendi dillerinde karşılayın."
                >
                  <div className="ast-welcome-fields">
                    {activeLanguages.map((lang) => (
                      <div key={lang.id} className="ast-welcome-field">
                        <div>
                          <span>
                            <LanguageFlag code={lang.code} size={20} />
                            {lang.name}
                          </span>
                          {lang.code !== 'tr' && (
                            <button
                              type="button"
                              className="ast-text-button"
                              aria-label={`${lang.name} metnini çevir`}
                              onClick={() => void translateMessage(lang)}
                            >
                              <Sparkles size={14} />
                              {translating === lang.code
                                ? 'Çevriliyor…'
                                : 'Türkçeden çevir'}
                            </button>
                          )}
                        </div>
                        <textarea
                          aria-label={`Karşılama metni (${lang.name})`}
                          rows={3}
                          value={messages[lang.id] || ''}
                          onChange={(e) => {
                            setMessages((m) => ({
                              ...m,
                              [lang.id]: e.target.value,
                            }));
                            mark('menu');
                          }}
                        />
                      </div>
                    ))}
                    {!activeLanguages.length && (
                      <p>Önce bir dil etkinleştirin.</p>
                    )}
                  </div>
                </Section>
                <Section
                  title="Menüdeki servisler"
                  description="Müşterinin menüden çağırabileceği servisleri açın, kapatın ve sıralayın."
                >
                  <ServiceItemsEditor
                    items={serviceItems}
                    onChange={(next) => {
                      setServiceItems(next);
                      mark('menu');
                    }}
                  />
                </Section>
                <Section
                  title="Masa ve asistan"
                  description="Masa erişimi ve menü asistanı."
                >
                  <Toggle
                    label="Masa erişim kodu"
                    description="Masa oturumuna kodla erişim."
                    icon={KeyRound}
                    checked={tableCodeEnabled}
                    onChange={() => {
                      setTableCodeEnabled((v) => !v);
                      mark('menu');
                    }}
                  />
                  {tableCodeEnabled && (
                    <label className="ast-range">
                      Kod süresi <b>{tableCodeTtl} dakika</b>
                      <input
                        type="range"
                        min={15}
                        max={120}
                        step={5}
                        value={tableCodeTtl}
                        onChange={(e) => {
                          setTableCodeTtl(Number(e.target.value));
                          mark('menu');
                        }}
                      />
                    </label>
                  )}
                  <Toggle
                    label="Menü Asistanı"
                    description={
                      isOwned('menu-assistant')
                        ? 'Değişiklik hemen uygulanır.'
                        : 'Bu özellik hesabınızda etkin değil.'
                    }
                    icon={Sparkles}
                    checked={isEnabled('menu-assistant')}
                    disabled={!isOwned('menu-assistant')}
                    onChange={() => void toggleAssistant()}
                  />
                </Section>
                <Section
                  title="Karşılama müziği"
                  description="YouTube bağlantısı veya doğrudan MP3, M4A, OGG dosyası."
                >
                  <label>
                    Müzik bağlantısı
                    <input
                      type="url"
                      value={welcomeMusicUrl}
                      onChange={(e) => {
                        setWelcomeMusicUrl(e.target.value);
                        mark('menu');
                      }}
                      placeholder="https://…"
                    />
                  </label>
                  <p className="ast-hint">
                    Boş bırakırsanız varsayılan ortam sesi kullanılır. Spotify
                    bağlantısı desteklenmez.
                  </p>
                </Section>
                <Section
                  title="Konum kilidi"
                  description="Menü erişimini işletmenizin çevresiyle sınırlandırın."
                >
                  <Toggle
                    label="Konum kilidini kullan"
                    icon={MapPinned}
                    description="Açıkken bölge dışında veya konum izni olmadan menü açılmaz."
                    checked={geoLock.enabled}
                    onChange={() => {
                      setGeoLock((g) => ({ ...g, enabled: !g.enabled }));
                      mark('menu');
                    }}
                  />
                  {geoLock.enabled && (
                    <GeoLockMapEditor
                      draftOnly
                      value={geoLock}
                      onChange={(g) => {
                        setGeoLock(g);
                        mark('menu');
                      }}
                    />
                  )}
                </Section>
              </>
            )}
            {active === 'social' && (
              <Section
                title="Birlikte bağlantıda kalalım."
                description="Her bağlantının karşılama ve menüde görünürlüğünü ayrı seçin."
                action={
                  <button
                    type="button"
                    className="ast-button"
                    onClick={() => {
                      setSocialLinks((list) => [
                        ...list,
                        newCustomSocialLink(),
                      ]);
                      mark('social');
                    }}
                  >
                    <Plus size={16} /> Özel link
                  </button>
                }
              >
                <div className="ast-social-list">
                  {SOCIAL_PLATFORMS.map((p) =>
                    socialRow(
                      platformSocial.find((s) => s.id === p.id) || {
                        id: p.id,
                        value: '',
                        showWelcome: false,
                        showMenu: false,
                      },
                      p.name,
                      p.placeholder,
                      p.kind === 'phone',
                    ),
                  )}
                  {customSocial.map((row) =>
                    socialRow(
                      row,
                      row.label || 'Özel link',
                      'https://…',
                      false,
                      true,
                    ),
                  )}
                </div>
              </Section>
            )}
            {active === 'connections' && (
              <>
                <Section
                  title="Entegrasyon"
                  description="Harici POS veya sipariş sistemleriyle bağlantı."
                >
                  <Toggle
                    label="Entegrasyonu etkinleştir"
                    icon={Plug}
                    checked={integrationEnabled}
                    onChange={() => {
                      setIntegrationEnabled((v) => !v);
                      mark('connections');
                    }}
                  />
                  <label className="ast-key-label">
                    OpenAI API anahtarı
                    <input
                      type="password"
                      value={openaiApiKey}
                      autoComplete="off"
                      onChange={(e) => {
                        setOpenaiApiKey(e.target.value);
                        mark('connections');
                      }}
                      placeholder="sk-…"
                    />
                  </label>
                  <p className="ast-hint">
                    Otomatik çeviride kayıtlı anahtar kullanılır.
                  </p>
                </Section>
                <Section
                  title="Lisans ve destek"
                  description="Hesabınızın durumunu buradan takip edin."
                >
                  <div className="ast-license">
                    <ShieldCheck size={32} strokeWidth={1.3} />
                    <div>
                      <strong>
                        {days === null
                          ? 'Lisans süresi tanımlanmamış'
                          : days < 0
                            ? 'Lisansınız sona erdi'
                            : days === 0
                              ? 'Lisansınız bugün sona eriyor'
                              : `${days} gününüz var.`}
                      </strong>
                      {data.restaurant.licenseExpiresAt && days !== null && (
                        <p>
                          Bitiş:{' '}
                          {formatLicenseDate(data.restaurant.licenseExpiresAt)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="ast-support-code">
                    <span>
                      Restoran kodunuz <b>{data.restaurant.id}</b>
                    </span>
                    <button
                      type="button"
                      className="ast-icon-button"
                      aria-label="Restoran kodunu kopyala"
                      onClick={() => void copyCode()}
                    >
                      <Copy size={17} />
                    </button>
                  </div>
                  <div className="ast-support-links">
                    <a href={`tel:${SUPPORT_PHONE_TEL}`}>
                      <Phone size={18} />
                      <span>
                        {SUPPORT_PHONE_DISPLAY}
                        <small>Destek ekibini ara</small>
                      </span>
                      <ArrowUpRight size={17} />
                    </a>
                    <a
                      href={supportWhatsAppUrl(
                        `Merhaba, Menu QR lisans yenileme talebi. Restoran kodu: ${data.restaurant.id}. Restoran: ${data.restaurant.name}`,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Link2 size={18} />
                      <span>
                        WhatsApp<small>Destek ve lisans yenileme</small>
                      </span>
                      <ArrowUpRight size={17} />
                    </a>
                  </div>
                </Section>
              </>
            )}
          </fieldset>
        </div>
      </div>
      {dirty.length > 0 && (
        <div
          className="ast-savebar"
          role="region"
          aria-label="Değişiklikleri kaydet"
        >
          <span>
            <i />
            <strong>Yayınlanmamış değişiklikler</strong>
            <small>{dirty.length} bölümde düzenleme yaptınız.</small>
          </span>
          <button
            className="ast-button is-primary"
            disabled={busy}
            onClick={() => void save()}
          >
            <Save size={17} />
            {saving ? 'Kaydediliyor…' : 'Değişiklikleri kaydet'}
          </button>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) {
            if (!file.type.startsWith('image/')) {
              toast('Bir görsel dosyası seçin.', true);
              return;
            }
            // Logo her zaman sorulur (PNG/JPEG/WebP); SVG ve GIF olduğu gibi kullanılır
            void prepareImages([file], { subject: 'Logo', forceAsk: true }).then((out) => {
              if (!out) return;
              setLogoFile(out[0]);
              mark('business');
            });
          }
        }}
      />
      <input
        ref={iconInputRef}
        type="file"
        accept="image/*"
        hidden
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void uploadIcon(file);
        }}
      />
      <AdminToast notice={notice} onClose={() => setNotice(null)} />
      {navOpen && (
        <AdminOverlay label="Ayar bölümleri" onClose={() => setNavOpen(false)}>
          <section className="relative ast-nav-sheet">
            <header>
              <h2>Neyi düzenleyelim?</h2>
              <button
                className="ast-icon-button"
                aria-label="Kapat"
                onClick={() => setNavOpen(false)}
              >
                <X size={20} />
              </button>
            </header>
            {SECTIONS.map((s) => (
              <button
                type="button"
                className="ast-nav-option"
                key={s.id}
                aria-current={active === s.id ? 'page' : undefined}
                onClick={() => choose(s.id)}
              >
                <s.icon size={22} />
                <span>
                  <strong>{s.title}</strong>
                  <small>{s.description}</small>
                </span>
                <ChevronRight size={17} />
              </button>
            ))}
          </section>
        </AdminOverlay>
      )}
      {picker && (
        <AdminOverlay
          label={picker === 'language' ? 'Dil ekle' : 'Para birimi ekle'}
          busy={catalogBusy}
          onClose={() => setPicker(null)}
        >
          <section className="relative ast-picker">
            <header>
              <div>
                <h2>
                  {picker === 'language' ? 'Bir dil daha.' : 'Yeni para birimi'}
                </h2>
                <p>Seçtiğiniz kayıt hemen eklenir.</p>
              </div>
              <button
                className="ast-icon-button"
                aria-label="Kapat"
                disabled={catalogBusy}
                onClick={() => setPicker(null)}
              >
                <X size={20} />
              </button>
            </header>
            <label className="ast-picker-search">
              <Search size={18} />
              <input
                type="search"
                aria-label="Katalogda ara"
                placeholder={
                  picker === 'language' ? 'Dil ara…' : 'Para birimi ara…'
                }
                value={catalogQuery}
                onChange={(e) => setCatalogQuery(e.target.value)}
                disabled={catalogBusy}
              />
            </label>
            <ul>
              {filtered.map((item) => (
                <li key={item.code}>
                  <button
                    type="button"
                    disabled={
                      catalogBusy || existing.has(item.code.toLowerCase())
                    }
                    onClick={() => void addCatalog(item)}
                  >
                    {picker === 'language' ? (
                      <LanguageFlag code={item.code} size={25} />
                    ) : (
                      <span className="ast-currency-symbol">
                        {'symbol' in item ? item.symbol : item.code}
                      </span>
                    )}
                    <span>
                      <strong>{item.name}</strong>
                      <small>{item.code}</small>
                    </span>
                    {existing.has(item.code.toLowerCase()) ? (
                      <span className="ast-fixed-label">Ekli</span>
                    ) : (
                      <Plus size={17} />
                    )}
                  </button>
                </li>
              ))}
              {!filtered.length && (
                <li className="ast-picker-empty">Eşleşen kayıt bulunamadı.</li>
              )}
            </ul>
          </section>
        </AdminOverlay>
      )}
      {deleteTarget && (
        <AdminOverlay
          label="Kaydı sil"
          busy={catalogBusy}
          onClose={() => setDeleteTarget(null)}
        >
          <section className="relative ast-delete">
            <header>
              <Trash2 size={24} />
              <button
                className="ast-icon-button"
                aria-label="Kapat"
                disabled={catalogBusy}
                onClick={() => setDeleteTarget(null)}
              >
                <X size={20} />
              </button>
            </header>
            <h2>{deleteTarget.name} silinsin mi?</h2>
            <p>
              Bu {deleteTarget.kind === 'language' ? 'dil' : 'para birimi'} menü
              seçeneklerinizden kaldırılacak.
              {deleteTarget.kind === 'language'
                ? ' Bu dile ait tüm çeviriler (gruplar, ürünler, hikâyeler, karşılama ve tema metinleri, hakkımızda, iletişim…) kalıcı olarak silinir; dili sonradan yeniden eklerseniz baştan çevirmeniz gerekir.'
                : ''}
            </p>
            <button
              className="ast-button is-danger"
              disabled={catalogBusy}
              onClick={() => void deleteCatalog()}
            >
              {catalogBusy ? 'Siliniyor…' : 'Sil'}
            </button>
          </section>
        </AdminOverlay>
      )}
      {iconFor && (
        <AdminOverlay
          label="Bağlantı ikonu"
          busy={uploadingIcon}
          onClose={() => setIconFor(null)}
        >
          <section className="relative ast-icons">
            <header>
              <h2>Bir ikon seçin.</h2>
              <button
                className="ast-icon-button"
                aria-label="Kapat"
                disabled={uploadingIcon}
                onClick={() => setIconFor(null)}
              >
                <X size={20} />
              </button>
            </header>
            <div>
              {CUSTOM_ICON_OPTIONS.map((option) => {
                const Icon = CUSTOM_ICONS[option.id];
                return (
                  <button
                    type="button"
                    key={option.id}
                    disabled={uploadingIcon}
                    onClick={() => {
                      updateSocial(iconFor, {
                        iconKey: option.id,
                        iconUrl: null,
                      });
                      setIconFor(null);
                    }}
                  >
                    <Icon size={24} />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              className="ast-button"
              disabled={uploadingIcon}
              onClick={() => iconInputRef.current?.click()}
            >
              <ImagePlus size={17} />
              {uploadingIcon ? 'Yükleniyor…' : 'Kendi ikonumu yükle'}
            </button>
          </section>
        </AdminOverlay>
      )}
    </div>
  );
}
