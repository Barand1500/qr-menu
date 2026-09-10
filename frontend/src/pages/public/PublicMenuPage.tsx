import { useEffect, useState, type ReactNode } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, UserRound, X } from 'lucide-react';
import { api, formatMoney, getSessionId, imageUrl } from '@/lib/api';
import PublicMenuHeader from '@/components/public/PublicMenuHeader';
import PublicMobileNav from '@/components/public/PublicMobileNav';
import PublicSideMenu, { type PublicTab } from '@/components/public/PublicSideMenu';
import MobileStoriesStrip, { type MenuStory } from '@/components/public/MobileStoriesStrip';
import PopularSearchProducts, {
  type PopularProduct,
} from '@/components/public/PopularSearchProducts';
import { useDemoData } from '@/contexts/DemoDataContext';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import MenuCustomerAuthModal from '@/components/public/MenuCustomerAuthModal';
import MenuGamesOverlay from '@/components/public/games/MenuGamesOverlay';
import { MENU_WAITER_CALLED_EVENT, type MenuGameId } from '@/lib/menuGames';
import { isPublicGamesOn, type PublicMenuGames } from '@/lib/menuGamesConfig';
import '@/menu-customer.css';
import '@/menu-games.css';
import {
  DEMO_MENU_BANNERS,
  DEMO_POPULAR_PRODUCTS,
  mapDemoStoriesToGroups,
} from '@/lib/demoData';
import { checkInTable } from '@/lib/tableCheckin';
import GeoLockGate from '@/components/public/GeoLockGate';
import MaintenanceGate from '@/components/public/MaintenanceGate';
import TableSessionCodeGate from '@/components/public/TableSessionCodeGate';
import type { GeoCoords } from '@/lib/geoLock';
import { useMenuSlug } from '@/hooks/useMenuSlug';
import { useMenuColorMode } from '@/hooks/useMenuColorMode';
import { usePublicRtl } from '@/hooks/usePublicRtl';
import {
  enteredKey,
  menuGroupPath,
  menuHomePath,
  menuProductPath,
  menuWelcomePath,
} from '@/lib/menuPaths';
import PublicSocialLinks from '@/components/public/PublicSocialLinks';
import AboutPageView from '@/components/public/AboutPageView';
import { parseAboutPage, type AboutPageConfig } from '@/lib/aboutPage';
import '@/about-page.css';
import MenuMediaPlaceholder from '@/components/public/MenuMediaPlaceholder';
import MenuAssistantModal from '@/components/public/MenuAssistantModal';
import MenuMascot from '@/components/public/MenuMascot';
import TableServiceButtons from '@/components/public/TableServiceButtons';
import { parseMenuAssistantStyle } from '@/lib/menuAssistantStyle';
import { sideMenuUi } from '@/lib/menuChromeUi';
import type { PublicSocialLink } from '@/lib/socialCatalog';
import SadeHome from '@/components/public/sade/SadeHome';
import SadeProductList from '@/components/public/sade/SadeProductList';
import AliveHome from '@/components/public/alive/AliveHome';
import AliveProductList from '@/components/public/alive/AliveProductList';
import AnimasyonHome from '@/components/public/animasyon/AnimasyonHome';
import LinearHome from '@/components/public/linear/LinearHome';
import LuxuryProductList from '@/components/public/luxury/LuxuryProductList';
import SiparisHome from '@/components/public/siparis/SiparisHome';
import SiparisProductList from '@/components/public/siparis/SiparisProductList';
import SiparisCartButton from '@/components/public/siparis/SiparisCartButton';
import SiparisCartSheet from '@/components/public/siparis/SiparisCartSheet';
import AnimasyonCartSheet from '@/components/public/animasyon/AnimasyonCartSheet';
import SiparisMobileNav from '@/components/public/siparis/SiparisMobileNav';
import { SiparisCartProvider } from '@/hooks/useSiparisCart';
import {
  loadDietaryPrefs,
  preferenceUi,
  prefsActive,
  productMatchesCustomerProfile,
  productMatchesPrefs,
  saveDietaryPrefs,
  type DietaryPrefs,
} from '@/lib/dietAllergens';

interface ShowcaseItem {
  id: number;
  imageUrl?: string | null;
  title1: string;
  title2: string;
}

interface MenuData {
  restaurant: { id: number; name: string; slug: string; logoUrl?: string | null };
  welcomeMessage: string;
  about?: string;
  aboutPage?: AboutPageConfig;
  languages: { code: string; name: string }[];
  showcase?: ShowcaseItem[];
  stories?: MenuStory[];
  groups: {
    id: number;
    name: string;
    imageUrl?: string | null;
    productCount?: number;
    children?: { id: number; name: string; imageUrl?: string | null }[];
  }[];
  theme?: string;
  campaign?: { name: string; slug: string; itemCount: number } | null;
  socialLinks?: PublicSocialLink[];
  features?: {
    menuAssistant?: boolean;
    menuAssistantStyle?: 'sunset' | 'berry' | 'dark';
    tableService?: boolean;
    menuGames?: PublicMenuGames | boolean;
    animasyon?: { cartEnabled?: boolean; variantsEnabled?: boolean; userProfileEnabled?: boolean };
    sade?: { cartEnabled?: boolean; variantsEnabled?: boolean; userProfileEnabled?: boolean };
    alive?: { cartEnabled?: boolean; variantsEnabled?: boolean; userProfileEnabled?: boolean };
    luxury?: { cartEnabled?: boolean; variantsEnabled?: boolean; userProfileEnabled?: boolean };
    siparis?: { cartEnabled?: boolean; variantsEnabled?: boolean; userProfileEnabled?: boolean };
    linear?: {
      headline: string;
      subhead: string;
      features: { icon: string; text: string }[];
      cartEnabled?: boolean;
      variantsEnabled?: boolean;
      userProfileEnabled?: boolean;
    };
  };
}

interface ProductData {
  group: { id: number; name: string; imageUrl?: string | null };
  products: {
    id: number;
    name: string;
    description: string;
    price: number;
    currency?: { code?: string; symbol?: string } | null;
    imageUrl?: string | null;
    calories?: number | null;
    isRecommended?: boolean;
    allergens?: string | null;
    allergenTags?: string[];
    isVegan?: boolean;
    isVegetarian?: boolean;
    isGlutenFree?: boolean;
    isDiabetic?: boolean;
  }[];
  children?: {
    id: number;
    name: string;
    imageUrl?: string | null;
    products: ProductData['products'];
  }[];
}

export default function PublicMenuPage() {
  const { slug, error: slugError } = useMenuSlug();

  if (slugError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <p className="text-sm text-slate-600">{slugError}</p>
      </div>
    );
  }

  if (!slug) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center public-menu-page gap-3 p-6">
        <div className="w-9 h-9 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <MaintenanceGate slug={slug}>
      <GeoLockGate slug={slug}>
        {({ coords }) => <PublicMenuWithCodeGate slug={slug} coords={coords} />}
      </GeoLockGate>
    </MaintenanceGate>
  );
}

function PublicMenuWithCodeGate({
  slug,
  coords,
}: {
  slug: string;
  coords: import('@/lib/geoLock').GeoCoords | null;
}) {
  const [searchParams] = useSearchParams();
  return (
    <TableSessionCodeGate
      slug={slug}
      masa={searchParams.get('masa')}
      grup={searchParams.get('grup')}
    >
      <PublicMenuPageInner slug={slug} coords={coords} />
    </TableSessionCodeGate>
  );
}

function PublicMenuPageInner({
  slug,
  coords,
}: {
  slug: string;
  coords: GeoCoords | null;
}) {
  const { demoEnabled } = useDemoData();
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightProductId = searchParams.get('urun');
  const [lang, setLang] = useState(() => localStorage.getItem('menu_lang') || 'tr');
  const [menu, setMenu] = useState<MenuData | null>(null);
  const [products, setProducts] = useState<ProductData | null>(null);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<
    {
      id: number;
      name: string;
      price: number;
      currency?: { code?: string; symbol?: string } | null;
      imageUrl?: string | null;
      groupName: string;
      groupId: number;
      allergens?: string | null;
      allergenTags?: string[];
      isVegan?: boolean;
      isVegetarian?: boolean;
      isGlutenFree?: boolean;
      isDiabetic?: boolean;
    }[]
  >([]);
  const [tab, setTab] = useState<PublicTab>('home');
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [popularProducts, setPopularProducts] = useState<PopularProduct[]>([]);
  const [dietaryPrefs, setDietaryPrefs] = useState<DietaryPrefs>(() => loadDietaryPrefs());
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [customerAuthOpen, setCustomerAuthOpen] = useState(false);
  const [gamesOpen, setGamesOpen] = useState(false);
  const [gamesInitial, setGamesInitial] = useState<MenuGameId | null>(null);
  const [gamesPromo, setGamesPromo] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [menuLoading, setMenuLoading] = useState(true);
  const {
    customer,
    filterEnabled,
    setFilterEnabled,
    refresh: refreshCustomer,
  } = useCustomerAuth();
  const sessionId = getSessionId();
  const menuThemeForMode = menu?.theme || 'sade';
  const { colorMode, toggleColorMode } = useMenuColorMode(menuThemeForMode);

  usePublicRtl(lang);

  useEffect(() => {
    function onWaiter() {
      if (!isPublicGamesOn(menu?.features?.menuGames)) return;
      setGamesPromo(true);
      setSideMenuOpen(true);
    }
    window.addEventListener(MENU_WAITER_CALLED_EVENT, onWaiter);
    return () => window.removeEventListener(MENU_WAITER_CALLED_EVENT, onWaiter);
  }, [menu?.features?.menuGames]);

  useEffect(() => {
    const masa = searchParams.get('masa');
    const grup = searchParams.get('grup');
    const kampanya = searchParams.get('kampanya');
    if (masa) sessionStorage.setItem('menu_masa', masa);
    if (grup) sessionStorage.setItem('menu_grup', grup);
    if (kampanya) sessionStorage.setItem('menu_kampanya', kampanya);
  }, [searchParams]);

  useEffect(() => {
    const masa = searchParams.get('masa') || sessionStorage.getItem('menu_masa');
    const grup = searchParams.get('grup') || sessionStorage.getItem('menu_grup');
    if (masa) checkInTable(slug, masa, grup, coords ?? undefined);
  }, [slug, searchParams, coords]);

  useEffect(() => {
    if (!menu?.restaurant?.id || !customer) return;
    void refreshCustomer(menu.restaurant.id).catch(() => undefined);
  }, [menu?.restaurant?.id, customer?.id, refreshCustomer]);

  const campaignSlug =
    searchParams.get('kampanya') ||
    (typeof sessionStorage !== 'undefined'
      ? sessionStorage.getItem('menu_kampanya')
      : null) ||
    '';

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setMenuLoading(true);
    setMenuError(null);
    const params = new URLSearchParams({ lang, sessionId });
    if (campaignSlug) params.set('kampanya', campaignSlug);
    api<MenuData>(`/api/menu/${slug}?${params}`)
      .then((res) => {
        if (!cancelled) {
          setMenu(res);
          setMenuLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMenuError(
            campaignSlug
              ? 'Kampanya menüsü yüklenemedi. Linki kontrol edin veya backend’i çalıştırın.'
              : 'Menü yüklenemedi. Backend sunucusu çalışmıyor olabilir.'
          );
          setMenuLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slug, lang, sessionId, campaignSlug]);

  useEffect(() => {
    if (!slug || !groupId) {
      setProducts(null);
      return;
    }
    const params = new URLSearchParams({ lang, sessionId });
    if (campaignSlug) params.set('kampanya', campaignSlug);
    api<ProductData>(`/api/menu/${slug}/groups/${groupId}/products?${params}`).then(setProducts);
  }, [slug, groupId, lang, sessionId, campaignSlug]);

  useEffect(() => {
    if (!slug || !search.trim()) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(() => {
      const params = new URLSearchParams({
        q: search,
        lang,
      });
      if (campaignSlug) params.set('kampanya', campaignSlug);
      api<typeof searchResults>(`/api/menu/${slug}/search?${params}`).then(setSearchResults);
    }, 300);
    return () => clearTimeout(t);
  }, [search, slug, lang, campaignSlug]);

  useEffect(() => {
    if (!highlightProductId || !slug) return;
    navigate(menuProductPath(highlightProductId), { replace: true });
  }, [highlightProductId, slug, navigate]);

  useEffect(() => {
    if (!slug) return;
    if (demoEnabled) {
      setPopularProducts(DEMO_POPULAR_PRODUCTS);
      return;
    }
    const params = new URLSearchParams({ lang, limit: '8' });
    if (campaignSlug) params.set('kampanya', campaignSlug);
    api<PopularProduct[]>(`/api/menu/${slug}/popular-products?${params}`).then(
      setPopularProducts
    );
  }, [slug, lang, demoEnabled, campaignSlug]);

  function changeLang(code: string) {
    setLang(code);
    localStorage.setItem('menu_lang', code);
    if (code !== 'tr') setAssistantOpen(false);
  }

  function changeDietaryPrefs(prefs: DietaryPrefs) {
    setDietaryPrefs(prefs);
    saveDietaryPrefs(prefs);
  }

  function toggleSearch() {
    setSearchOpen((v) => !v);
  }

  function closeSearch() {
    setSearchOpen(false);
  }

  if (menuLoading && !menu) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center public-menu-page gap-3 p-6">
        <div className="w-9 h-9 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500">Menü yükleniyor…</p>
      </div>
    );
  }

  if (menuError && !menu) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center public-menu-page gap-4 p-6 text-center">
        <p className="text-lg font-semibold text-slate-800">Bağlantı kurulamadı</p>
        <p className="text-sm text-slate-500 max-w-sm">{menuError}</p>
        <p className="text-xs text-slate-400">Proje klasöründe: npm run dev</p>
        <button
          type="button"
          className="px-5 py-2.5 rounded-full bg-sky-500 text-white text-sm font-semibold"
          onClick={() => {
            setMenuLoading(true);
            setMenuError(null);
            if (!slug) return;
            const params = new URLSearchParams({ lang, sessionId });
            if (campaignSlug) params.set('kampanya', campaignSlug);
            api<MenuData>(`/api/menu/${slug}?${params}`)
              .then(setMenu)
              .catch(() => setMenuError('Hâlâ bağlanamıyoruz.'))
              .finally(() => setMenuLoading(false));
          }}
        >
          Tekrar Dene
        </button>
        {slug && (
          <button
            type="button"
            className="text-sm text-sky-600 underline"
            onClick={() => {
              sessionStorage.removeItem(enteredKey(slug));
              navigate(menuWelcomePath());
            }}
          >
            Karşılama ekranına dön
          </button>
        )}
      </div>
    );
  }

  if (!menu) return null;

  const allergyCopy = preferenceUi(lang);
  const menuTheme = menu.theme || 'sade';
  const isSade = menuTheme === 'sade';
  const isAlive = menuTheme === 'alive';
  const isLuxury = menuTheme === 'luxury';
  const isLinear = menuTheme === 'linear';
  const isAnimasyon = menuTheme === 'animasyon';
  const isSiparis = menuTheme === 'siparis';

  const profileEnabled =
    (isSade && menu.features?.sade?.userProfileEnabled === true) ||
    (isAlive && menu.features?.alive?.userProfileEnabled === true) ||
    (isLuxury && menu.features?.luxury?.userProfileEnabled === true) ||
    (isLinear && menu.features?.linear?.userProfileEnabled === true) ||
    (isAnimasyon && menu.features?.animasyon?.userProfileEnabled === true) ||
    (isSiparis && menu.features?.siparis?.userProfileEnabled === true);

  const matchProduct = (
    p: {
      name?: string | null;
      groupName?: string | null;
      features?: string[] | null;
      allergenTags?: string[];
      dietTags?: string[];
      isVegan?: boolean;
      isVegetarian?: boolean;
      isGlutenFree?: boolean;
      isDiabetic?: boolean;
    },
    groupName?: string | null
  ) => {
    if (customer && profileEnabled) {
      if (!filterEnabled) return true;
      return productMatchesCustomerProfile(
        { ...p, groupName: p.groupName || groupName || null },
        { allergens: customer.allergenTags || [], diets: customer.dietTags || [] },
        customer.dislikedFoods || [],
        customer.drinksAlcohol
      );
    }
    return productMatchesPrefs(p, dietaryPrefs);
  };

  const filteredPopular = popularProducts.filter((p) => matchProduct(p));
  const filteredSearchResults = searchResults.filter((r) => matchProduct(r));
  const filteredGroupProducts =
    products?.products.filter((p) => matchProduct(p, products.group.name)) ?? [];
  const filteredGroupChildren =
    products?.children
      ?.map((c) => ({
        ...c,
        products: c.products.filter((p) => matchProduct(p, c.name)),
      }))
      .filter((c) => c.products.length > 0) ?? [];
  const allergyActive =
    customer && profileEnabled
      ? filterEnabled &&
        (prefsActive({
          allergens: customer.allergenTags || [],
          diets: customer.dietTags || [],
        }) ||
          (customer.dislikedFoods || []).length > 0)
      : prefsActive(dietaryPrefs);
  const hasGroupContent =
    filteredGroupProducts.length > 0 || filteredGroupChildren.length > 0;

  const profileBanner =
    profileEnabled && customer && filterEnabled ? (
      <div className="public-profile-banner" role="status">
        <p className="public-profile-banner__text">
          Merhaba {customer.fullName.split(' ')[0] || customer.fullName}, sizin için menüyü
          filtreledik.
        </p>
        <div className="public-profile-banner__actions">
          <button type="button" className="is-off" onClick={() => setFilterEnabled(false)}>
            Filtreyi kapat
          </button>
          <button type="button" className="is-edit" onClick={() => setCustomerAuthOpen(true)}>
            Profil
          </button>
        </div>
      </div>
    ) : profileEnabled && customer && !filterEnabled ? (
      <div className="public-profile-banner" role="status">
        <p className="public-profile-banner__text">
          Merhaba {customer.fullName.split(' ')[0] || customer.fullName} — kişisel filtre kapalı.
        </p>
        <div className="public-profile-banner__actions">
          <button type="button" className="is-edit" onClick={() => setFilterEnabled(true)}>
            Filtreyi aç
          </button>
        </div>
      </div>
    ) : null;

  const allergyBanner = profileBanner ? (
    profileBanner
  ) : allergyActive ? (
    <div className="public-allergy-banner" role="status">
      <p className="public-allergy-banner__text">{allergyCopy.banner}</p>
      <button
        type="button"
        className="public-allergy-banner__clear"
        onClick={() => changeDietaryPrefs({ allergens: [], diets: [] })}
      >
        {allergyCopy.clear}
      </button>
    </div>
  ) : null;

  const displayShowcase =
    demoEnabled && menu ? DEMO_MENU_BANNERS : menu?.showcase;
  const displayStories =
    demoEnabled && menu ? mapDemoStoriesToGroups(menu.groups) : menu?.stories;

  const searchField = (
    <input
      type="search"
      className="public-search-input"
      placeholder="Ürün ara..."
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      aria-label="Ürün ara"
      autoComplete="off"
    />
  );

  function handleSearchNavigate() {
    setSearch('');
    closeSearch();
  }

  const searchResultsList =
    filteredSearchResults.length > 0 ? (
      <div className="public-search-results">
        <div className="public-popular-search__head">
          <span>Arama sonuçları</span>
        </div>
        <div className="public-popular-search__list">
          {filteredSearchResults.map((r) => (
            <Link
              key={r.id}
              to={menuProductPath(r.id)}
              className="public-popular-search__item"
              onClick={handleSearchNavigate}
            >
              {r.imageUrl ? (
                <img
                  src={imageUrl(r.imageUrl)}
                  alt=""
                  className="public-popular-search__thumb"
                />
              ) : (
                <div className="public-popular-search__thumb public-popular-search__thumb--empty">
                  <MenuMediaPlaceholder kind="product" size="sm" label={r.name} />
                </div>
              )}
              <div className="public-popular-search__meta">
                <span className="public-popular-search__name">{r.name}</span>
                <span className="public-popular-search__group">{r.groupName}</span>
              </div>
              <span className="public-popular-search__price">
                {formatMoney(r.price, r.currency)}
              </span>
            </Link>
          ))}
        </div>
      </div>
    ) : search.trim() ? (
      <p className="public-search-empty">
        {allergyActive ? allergyCopy.empty : 'Sonuç bulunamadı'}
      </p>
    ) : null;

  const popularList = !search.trim() ? (
    <PopularSearchProducts
      products={filteredPopular}
      onNavigate={handleSearchNavigate}
    />
  ) : null;

  const searchPanelExtra = search.trim() ? searchResultsList : popularList;
  const animasyonCartOn = menu.features?.animasyon?.cartEnabled !== false;
  const animasyonVariantsOn = menu.features?.animasyon?.variantsEnabled !== false;
  const sadeCartOn = menu.features?.sade?.cartEnabled === true;
  const aliveCartOn = menu.features?.alive?.cartEnabled === true;
  const luxuryCartOn = menu.features?.luxury?.cartEnabled === true;
  const linearCartOn = menu.features?.linear?.cartEnabled === true;
  const siparisCartOn = menu.features?.siparis?.cartEnabled !== false;
  const cartTheme =
    (isSiparis && siparisCartOn) ||
    (isAnimasyon && animasyonCartOn) ||
    (isSade && sadeCartOn) ||
    (isAlive && aliveCartOn) ||
    (isLuxury && luxuryCartOn) ||
    (isLinear && linearCartOn);
  const hideColorToggle = isAnimasyon || isLinear;
  const menuAssistantOn = Boolean(menu.features?.menuAssistant);
  const assistantStyle = parseMenuAssistantStyle(menu.features?.menuAssistantStyle);
  const tableServiceOn = menu.features?.tableService !== false;
  const gamesEnabled = isPublicGamesOn(menu.features?.menuGames);
  const gamesConfig = menu.features?.menuGames;
  const assistantLabel =
    (lang || 'tr').split('-')[0] === 'en'
      ? { title: 'What to eat?', sub: 'Ask me' }
      : { title: 'Ne yesem?', sub: 'Sana öneriyim' };

  const profileIcon = profileEnabled ? (
    <button
      type="button"
      className={`public-menu-header__icon-btn public-menu-header__icon-btn--md-only public-menu-header__profile-btn${customer ? ' is-active' : ''}`}
      aria-label={customer ? 'Profil' : 'Giriş / Kayıt'}
      title={customer ? 'Profil' : 'Giriş / Kayıt'}
      onClick={() => setCustomerAuthOpen(true)}
    >
      <UserRound className="w-5 h-5" />
    </button>
  ) : null;

  const headerExtraIcons = (
    <>
      {profileIcon}
      {cartTheme ? (
        <SiparisCartButton alwaysShow={isAnimasyon || isSade || isAlive || isLuxury || isLinear} />
      ) : null}
    </>
  );

  const mobileNavChrome = {
    colorMode: hideColorToggle ? undefined : colorMode,
    onColorModeToggle: hideColorToggle ? undefined : toggleColorMode,
    showProfile: profileEnabled,
    profileActive: Boolean(customer),
    onProfileOpen: profileEnabled ? () => setCustomerAuthOpen(true) : undefined,
  };

  const sideMenu = (
    <PublicSideMenu
      open={sideMenuOpen}
      tab={tab}
      restaurantName={menu.restaurant.name}
      languages={menu.languages}
      activeLang={lang}
      socialLinks={menu.socialLinks}
      dietaryPrefs={dietaryPrefs}
      onClose={() => setSideMenuOpen(false)}
      onTab={(t) => {
        setTab(t);
        if (groupId) navigate(menuHomePath());
      }}
      onLangChange={changeLang}
      onDietaryPrefsChange={changeDietaryPrefs}
      gamesEnabled={gamesEnabled}
      gamesConfig={gamesConfig}
      gamesPromo={gamesPromo}
      onGamesPromoDismiss={() => setGamesPromo(false)}
      onOpenGames={(game) => {
        setGamesInitial(game ?? null);
        setGamesOpen(true);
      }}
    />
  );

  const gamesOverlay =
    gamesEnabled && slug ? (
      <MenuGamesOverlay
        open={gamesOpen}
        onClose={() => {
          setGamesOpen(false);
          setGamesInitial(null);
        }}
        slug={slug}
        lang={lang}
        initialGame={gamesInitial}
        gamesConfig={gamesConfig}
      />
    ) : null;

  const assistantUi = menuAssistantOn && slug && lang === 'tr' ? (
    <>
      {!searchOpen && (
        <button
          type="button"
          className={`menu-assistant-launcher menu-assistant-launcher--${assistantStyle}`}
          onClick={() => setAssistantOpen(true)}
          aria-label={assistantLabel.title}
        >
          <span className="menu-assistant-launcher__face" aria-hidden>
            <MenuMascot mood="happy" size="sm" />
          </span>
          <span className="menu-assistant-launcher__copy">
            <strong>{assistantLabel.title}</strong>
            <span>{assistantLabel.sub}</span>
          </span>
        </button>
      )}
      <MenuAssistantModal
        open={assistantOpen}
        slug={slug}
        lang={lang}
        campaignSlug={campaignSlug}
        onClose={() => setAssistantOpen(false)}
      />
    </>
  ) : null;

  const tableServiceSlot = (
    <TableServiceButtons lang={lang} slug={slug} enabled={tableServiceOn} />
  );

  /* ── Ürün listesi ── */
  if (groupId && products) {
    return (
      <SiparisCartProvider slug={slug} enabled={cartTheme}>
      <div className="public-menu-page" data-theme-menu={menuTheme} data-color-mode={colorMode}>
        <PublicMenuHeader
          restaurant={menu.restaurant}
          title={products.group.name}
          showBack
          onBack={() => navigate(menuHomePath())}
          onMenuOpen={() => setSideMenuOpen(true)}
          searchOpen={searchOpen}
          onSearchToggle={toggleSearch}
          showMobileSearch={isSiparis}
          extraIcons={headerExtraIcons}
          colorMode={hideColorToggle ? undefined : colorMode}
          onColorModeToggle={hideColorToggle ? undefined : toggleColorMode}
          tableServiceSlot={tableServiceSlot}
          searchSlot={
            <>
              {searchField}
              {searchPanelExtra}
            </>
          }
        />

        <main className="public-menu-main">
          {allergyBanner}
          {!hasGroupContent ? (
            <p className="public-allergy-empty">
              {allergyActive ? allergyCopy.empty : 'Bu grupta ürün yok'}
            </p>
          ) : isLinear ? (
            <LinearHome
              menu={menu}
              allergyBanner={null}
              lang={lang}
              campaignSlug={campaignSlug}
              initialGroupId={products.group.id}
            />
          ) : isAlive ? (
            <AliveProductList
              products={filteredGroupProducts}
              subgroups={filteredGroupChildren}
              groupName={products.group.name}
              groupId={products.group.id}
              navGroups={menu.groups.map((g) => ({ id: g.id, name: g.name }))}
            />
          ) : isLuxury ? (
            <LuxuryProductList
              products={filteredGroupProducts}
              subgroups={filteredGroupChildren}
              groupName={products.group.name}
            />
          ) : isSiparis ? (
            <SiparisProductList
              products={filteredGroupProducts}
              groupName={products.group.name}
            />
          ) : isAnimasyon ? (
            <AnimasyonHome
              menu={menu}
              popularProducts={filteredPopular}
              allergyBanner={null}
              lang={lang}
              campaignSlug={campaignSlug}
              initialGroupId={products.group.id}
              cartEnabled={animasyonCartOn}
              variantsEnabled={animasyonVariantsOn}
            />
          ) : (
            <SadeProductList
              products={filteredGroupProducts}
              subgroups={filteredGroupChildren}
              groupName={products.group.name}
            />
          )}
        </main>

        {isAnimasyon ? (
          <PublicMobileNav
            tab="home"
            onTab={(t) => {
              setTab(t);
              if (t === 'home') navigate(menuHomePath());
            }}
            onSearchOpen={toggleSearch}
            onMenuOpen={() => setSideMenuOpen(true)}
            {...mobileNavChrome}
          />
        ) : isSiparis ? (
          <SiparisMobileNav
            tab="home"
            onTab={(t) => {
              setTab(t);
              if (t === 'home') navigate(menuHomePath());
            }}
            onSearchOpen={toggleSearch}
            onMenuOpen={() => setSideMenuOpen(true)}
            {...mobileNavChrome}
          />
        ) : (
          <PublicMobileNav
            tab="home"
            onTab={(t) => {
              setTab(t);
              if (t === 'home') navigate(menuHomePath());
            }}
            onSearchOpen={toggleSearch}
            onMenuOpen={() => setSideMenuOpen(true)}
            {...mobileNavChrome}
          />
        )}

        {sideMenu}
        {gamesOverlay}
        {assistantUi}
        {isAnimasyon ? (
          <AnimasyonCartSheet lang={lang} />
        ) : cartTheme ? (
          <SiparisCartSheet lang={lang} />
        ) : null}
        {profileEnabled ? (
          <MenuCustomerAuthModal
            open={customerAuthOpen}
            onClose={() => setCustomerAuthOpen(false)}
            restaurantId={menu.restaurant.id}
            restaurantName={menu.restaurant.name}
            lang={lang}
          />
        ) : null}

        {searchOpen && (
          <SearchOverlay
            search={search}
            onSearchChange={setSearch}
            onClose={closeSearch}
            results={searchPanelExtra}
          />
        )}
      </div>
      </SiparisCartProvider>
    );
  }

  /* ── Ana menü ── */
  return (
    <SiparisCartProvider slug={slug} enabled={cartTheme}>
    <div className="public-menu-page" data-theme-menu={menuTheme} data-color-mode={colorMode}>
      <PublicMenuHeader
        restaurant={menu.restaurant}
        onMenuOpen={() => setSideMenuOpen(true)}
        searchOpen={searchOpen}
        onSearchToggle={toggleSearch}
        showMobileSearch={isSiparis}
        extraIcons={headerExtraIcons}
        colorMode={hideColorToggle ? undefined : colorMode}
        onColorModeToggle={hideColorToggle ? undefined : toggleColorMode}
        tableServiceSlot={tableServiceSlot}
        searchSlot={
          <>
            {searchField}
            {searchPanelExtra}
          </>
        }
      />

      <main className="public-menu-main">
        <div className={`public-tablet-tabs${cartTheme ? ' public-tablet-tabs--always' : ''}`}>
          <button
            type="button"
            className={tab === 'home' ? 'is-active' : ''}
            onClick={() => setTab('home')}
          >
            {sideMenuUi(lang).home}
          </button>
          <button
            type="button"
            className={tab === 'about' ? 'is-active' : ''}
            onClick={() => setTab('about')}
          >
            {sideMenuUi(lang).about}
          </button>
          <button
            type="button"
            className={tab === 'settings' ? 'is-active' : ''}
            onClick={() => setTab('settings')}
          >
            {sideMenuUi(lang).lang}
          </button>
        </div>

        {tab === 'home' &&
          (isLinear ? (
            <LinearHome
              menu={menu}
              popularProducts={filteredPopular}
              allergyBanner={allergyBanner}
              lang={lang}
              campaignSlug={campaignSlug}
            />
          ) : isAlive ? (
            <AliveHome
              menu={menu}
              displayShowcase={displayShowcase}
              displayStories={displayStories}
              popularProducts={filteredPopular}
              allergyBanner={allergyBanner}
            />
          ) : isLuxury ? (
            <LuxuryHome
              menu={menu}
              displayShowcase={displayShowcase}
              displayStories={displayStories}
              popularProducts={filteredPopular}
              allergyBanner={allergyBanner}
            />
          ) : isSiparis ? (
            <SiparisHome
              menu={menu}
              displayShowcase={displayShowcase}
              popularProducts={filteredPopular}
              allergyBanner={allergyBanner}
              lang={lang}
              campaignSlug={campaignSlug}
            />
          ) : isAnimasyon ? (
            <AnimasyonHome
              menu={menu}
              popularProducts={filteredPopular}
              allergyBanner={allergyBanner}
              lang={lang}
              campaignSlug={campaignSlug}
              cartEnabled={animasyonCartOn}
              variantsEnabled={animasyonVariantsOn}
            />
          ) : (
            <SadeHome
              menu={menu}
              displayShowcase={displayShowcase}
              displayStories={displayStories}
              popularProducts={filteredPopular}
              allergyBanner={allergyBanner}
            />
          ))}

        {tab === 'about' && (
          <div className="max-w-2xl mx-auto w-full">
            <AboutPageView
              config={parseAboutPage(
                menu.aboutPage ? JSON.stringify(menu.aboutPage) : null,
                menu.about || menu.welcomeMessage || ''
              )}
              restaurantName={menu.restaurant.name}
              social={
                menu.socialLinks && menu.socialLinks.length > 0 ? (
                  <PublicSocialLinks links={menu.socialLinks} className="mt-5" />
                ) : null
              }
            />
          </div>
        )}

        {tab === 'settings' && (
          <div className="public-content-card max-w-md mx-auto md:max-w-lg">
            <h2 className="public-content-card__title">{sideMenuUi(lang).lang}</h2>
            <div className="public-lang-list">
              {menu.languages.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => changeLang(l.code)}
                  className={`public-lang-btn${lang === l.code ? ' is-active' : ''}`}
                >
                  {l.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

        {isAnimasyon ? (
          <PublicMobileNav
            tab={tab}
            onTab={setTab}
            onSearchOpen={toggleSearch}
            onMenuOpen={() => setSideMenuOpen(true)}
            {...mobileNavChrome}
          />
        ) : isSiparis ? (
          <SiparisMobileNav
            tab={tab}
            onTab={setTab}
            onSearchOpen={toggleSearch}
            onMenuOpen={() => setSideMenuOpen(true)}
            {...mobileNavChrome}
          />
        ) : (
          <PublicMobileNav
            tab={tab}
            onTab={setTab}
            onSearchOpen={toggleSearch}
            onMenuOpen={() => setSideMenuOpen(true)}
            {...mobileNavChrome}
          />
        )}

      {sideMenu}
      {gamesOverlay}
      {assistantUi}
      {isAnimasyon ? (
        <AnimasyonCartSheet lang={lang} />
      ) : cartTheme ? (
        <SiparisCartSheet lang={lang} />
      ) : null}
      {profileEnabled ? (
        <MenuCustomerAuthModal
          open={customerAuthOpen}
          onClose={() => setCustomerAuthOpen(false)}
          restaurantId={menu.restaurant.id}
          restaurantName={menu.restaurant.name}
          lang={lang}
        />
      ) : null}

      {searchOpen && (
        <SearchOverlay
          search={search}
          onSearchChange={setSearch}
          onClose={closeSearch}
          results={searchPanelExtra}
        />
      )}
    </div>
    </SiparisCartProvider>
  );
}

function LuxuryHome({
  menu,
  displayShowcase,
  displayStories,
  popularProducts,
  allergyBanner,
}: {
  menu: MenuData;
  displayShowcase?: ShowcaseItem[] | null;
  displayStories?: MenuStory[] | null;
  popularProducts: PopularProduct[];
  allergyBanner?: ReactNode;
}) {
  const banner = displayShowcase?.[0];
  const tagline = banner?.title2 || menu.welcomeMessage;

  return (
    <div className="luxury-home">
      {allergyBanner}
      <header className="luxury-masthead">
        <p className="luxury-eyebrow">
          {menu.campaign?.name || 'Fine Dining'}
        </p>
        <h1 className="luxury-masthead__brand">{menu.restaurant.name}</h1>
        <span className="luxury-rule luxury-rule--anim" aria-hidden />
        {tagline ? <p className="luxury-masthead__tagline">{tagline}</p> : null}
      </header>

      {banner?.imageUrl && (
        <section className="luxury-banner">
          <img src={imageUrl(banner.imageUrl)} alt={banner.title1 || ''} />
          <div className="luxury-banner__veil" aria-hidden />
          <div className="luxury-banner__copy">
            <p className="luxury-eyebrow">Vitrin</p>
            {banner.title1 ? <h2>{banner.title1}</h2> : null}
          </div>
        </section>
      )}

      {popularProducts.length > 0 && (
        <section className="luxury-signature">
          <div className="luxury-signature__head">
            <p className="luxury-eyebrow">İmza seçimler</p>
            <h2>Önerilenler</h2>
            <span className="luxury-rule" aria-hidden />
          </div>
          <div className="luxury-signature__track">
            {popularProducts.map((p) => (
              <Link
                key={p.id}
                to={menuProductPath(p.id)}
                className="luxury-signature__item"
              >
                <div className="luxury-signature__media">
                  {p.imageUrl ? (
                    <img src={imageUrl(p.imageUrl)} alt="" />
                  ) : (
                    <MenuMediaPlaceholder kind="product" size="md" label={p.name} />
                  )}
                </div>
                <strong>{p.name}</strong>
                <span>{formatMoney(p.price, p.currency)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {displayStories && displayStories.length > 0 && (
        <div className="luxury-stories">
          <MobileStoriesStrip stories={displayStories} />
        </div>
      )}

      <section className="luxury-chapters">
        <div className="luxury-chapters__head">
          <p className="luxury-eyebrow">Menü</p>
          <h2>Bölümler</h2>
          <span className="luxury-rule" aria-hidden />
        </div>

        <div className="luxury-chapters__stack">
          {menu.groups.map((group, index) => (
            <Link
              key={group.id}
              to={menuGroupPath(group.id)}
              className="luxury-chapter"
              style={{ animationDelay: `${Math.min(index, 8) * 70}ms` }}
            >
              <div className="luxury-chapter__media">
                {group.imageUrl ? (
                  <img src={imageUrl(group.imageUrl)} alt="" />
                ) : (
                  <MenuMediaPlaceholder
                    kind="group"
                    size="hero"
                    label={group.name}
                  />
                )}
              </div>
              <div className="luxury-chapter__veil" aria-hidden />
              <div className="luxury-chapter__copy">
                <span className="luxury-chapter__index">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3>{group.name}</h3>
                {typeof group.productCount === 'number' && group.productCount > 0 && (
                  <p>{group.productCount} ürün</p>
                )}
                <span className="luxury-chapter__cta">Keşfet</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {menu.socialLinks && menu.socialLinks.length > 0 && (
        <div className="luxury-social">
          <PublicSocialLinks links={menu.socialLinks} />
        </div>
      )}
    </div>
  );
}

function SearchOverlay({
  search,
  onSearchChange,
  onClose,
  results,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  onClose: () => void;
  results: React.ReactNode;
}) {
  return (
    <div className="public-search-overlay md:hidden">
      <div className="public-search-overlay__head">
        <button type="button" onClick={onClose} className="public-menu-header__icon-btn" aria-label="Kapat">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <input
            type="search"
            className="public-search-input"
            placeholder="Ürün ara..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Ürün ara"
            autoComplete="off"
            autoFocus
          />
        </div>
        {search && (
          <button type="button" onClick={() => onSearchChange('')} className="public-menu-header__icon-btn" aria-label="Temizle">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
      <div className="public-search-overlay__body">{results}</div>
    </div>
  );
}
