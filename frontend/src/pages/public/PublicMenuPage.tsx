import { useEffect, useState, type ReactNode } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, X } from 'lucide-react';
import { api, formatMoney, getSessionId, imageUrl } from '@/lib/api';
import PublicMenuHeader from '@/components/public/PublicMenuHeader';
import PublicMobileNav from '@/components/public/PublicMobileNav';
import PublicSideMenu, { type PublicTab } from '@/components/public/PublicSideMenu';
import MobileStoriesStrip, { type MenuStory } from '@/components/public/MobileStoriesStrip';
import PopularSearchProducts, {
  type PopularProduct,
} from '@/components/public/PopularSearchProducts';
import { BrushCaption, BrushCaptionBlock } from '@/components/public/BrushCaption';
import { useDemoData } from '@/contexts/DemoDataContext';
import {
  DEMO_MENU_BANNERS,
  DEMO_POPULAR_PRODUCTS,
  mapDemoStoriesToGroups,
} from '@/lib/demoData';
import { useMenuSlug } from '@/hooks/useMenuSlug';
import { usePublicRtl } from '@/hooks/usePublicRtl';
import {
  enteredKey,
  menuGroupPath,
  menuHomePath,
  menuProductPath,
  menuWelcomePath,
} from '@/lib/menuPaths';
import PublicSocialLinks from '@/components/public/PublicSocialLinks';
import MenuMediaPlaceholder from '@/components/public/MenuMediaPlaceholder';
import MenuAssistantModal from '@/components/public/MenuAssistantModal';
import MenuMascot from '@/components/public/MenuMascot';
import TableServiceButtons from '@/components/public/TableServiceButtons';
import { parseMenuAssistantStyle } from '@/lib/menuAssistantStyle';
import type { PublicSocialLink } from '@/lib/socialCatalog';
import {
  loadDietaryPrefs,
  preferenceUi,
  prefsActive,
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
  languages: { code: string; name: string }[];
  showcase?: ShowcaseItem[];
  stories?: MenuStory[];
  groups: { id: number; name: string; imageUrl?: string | null; productCount?: number }[];
  theme?: string;
  campaign?: { name: string; slug: string; itemCount: number } | null;
  socialLinks?: PublicSocialLink[];
  features?: {
    menuAssistant?: boolean;
    menuAssistantStyle?: 'sunset' | 'berry' | 'dark';
    tableService?: boolean;
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
    allergens?: string | null;
    allergenTags?: string[];
    isVegan?: boolean;
    isVegetarian?: boolean;
    isGlutenFree?: boolean;
    isDiabetic?: boolean;
  }[];
}

export default function PublicMenuPage() {
  const { demoEnabled } = useDemoData();
  const { slug } = useMenuSlug();
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
  const [menuError, setMenuError] = useState<string | null>(null);
  const [menuLoading, setMenuLoading] = useState(true);
  const sessionId = getSessionId();

  usePublicRtl(lang);

  useEffect(() => {
    const masa = searchParams.get('masa');
    const grup = searchParams.get('grup');
    const kampanya = searchParams.get('kampanya');
    if (masa) sessionStorage.setItem('menu_masa', masa);
    if (grup) sessionStorage.setItem('menu_grup', grup);
    if (kampanya) sessionStorage.setItem('menu_kampanya', kampanya);
  }, [searchParams]);

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
    const params = new URLSearchParams({ lang, limit: '5' });
    if (campaignSlug) params.set('kampanya', campaignSlug);
    api<PopularProduct[]>(`/api/menu/${slug}/popular-products?${params}`).then(
      setPopularProducts
    );
  }, [slug, lang, demoEnabled, campaignSlug]);

  function changeLang(code: string) {
    setLang(code);
    localStorage.setItem('menu_lang', code);
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
  const filteredPopular = popularProducts.filter((p) => productMatchesPrefs(p, dietaryPrefs));
  const filteredSearchResults = searchResults.filter((r) => productMatchesPrefs(r, dietaryPrefs));
  const filteredGroupProducts =
    products?.products.filter((p) => productMatchesPrefs(p, dietaryPrefs)) ?? [];
  const allergyActive = prefsActive(dietaryPrefs);

  const allergyBanner = allergyActive ? (
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
  const menuTheme = menu.theme || 'sade';
  const isAlive = menuTheme === 'alive';
  const isLuxury = menuTheme === 'luxury';
  const menuAssistantOn = Boolean(menu.features?.menuAssistant);
  const assistantStyle = parseMenuAssistantStyle(menu.features?.menuAssistantStyle);
  const tableServiceOn = menu.features?.tableService !== false;
  const assistantLabel =
    (lang || 'tr').split('-')[0] === 'en'
      ? { title: 'What to eat?', sub: 'Ask me' }
      : { title: 'Ne yesem?', sub: 'Sana öneriyim' };

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
    />
  );

  const assistantUi = menuAssistantOn && slug ? (
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

  const tableServiceUi = !searchOpen ? (
    <TableServiceButtons lang={lang} slug={slug} enabled={tableServiceOn} />
  ) : null;

  /* ── Ürün listesi ── */
  if (groupId && products) {
    return (
      <div className="public-menu-page" data-theme-menu={menuTheme}>
        <PublicMenuHeader
          restaurant={menu.restaurant}
          title={products.group.name}
          showBack
          onBack={() => navigate(menuHomePath())}
          onMenuOpen={() => setSideMenuOpen(true)}
          searchOpen={searchOpen}
          onSearchToggle={toggleSearch}
          searchSlot={
            <>
              {searchField}
              {searchPanelExtra}
            </>
          }
        />

        <main className="public-menu-main">
          {allergyBanner}
          {filteredGroupProducts.length === 0 ? (
            <p className="public-allergy-empty">
              {allergyActive ? allergyCopy.empty : 'Bu grupta ürün yok'}
            </p>
          ) : isAlive ? (
            <div className="alive-product-grid">
              {filteredGroupProducts.map((p) => (
                <Link
                  key={p.id}
                  to={menuProductPath(p.id)}
                  className="alive-product-tile"
                >
                  <div className="alive-product-tile__media">
                    {p.imageUrl ? (
                      <img src={imageUrl(p.imageUrl)} alt="" />
                    ) : (
                      <MenuMediaPlaceholder kind="product" size="lg" label={p.name} />
                    )}
                    <span className="alive-product-tile__price">
                      {formatMoney(p.price, p.currency)}
                    </span>
                  </div>
                  <div className="alive-product-tile__body">
                    <h3>{p.name}</h3>
                    {p.description ? <p>{p.description}</p> : null}
                  </div>
                </Link>
              ))}
            </div>
          ) : isLuxury ? (
            <div className="luxury-product-list">
              <header className="luxury-product-list__head">
                <p className="luxury-eyebrow">Menü</p>
                <h1>{products.group.name}</h1>
                <span className="luxury-rule" aria-hidden />
              </header>
              {filteredGroupProducts.map((p) => (
                <Link
                  key={p.id}
                  to={menuProductPath(p.id)}
                  className="luxury-product-row"
                >
                  <div className="luxury-product-row__media">
                    {p.imageUrl ? (
                      <img src={imageUrl(p.imageUrl)} alt="" />
                    ) : (
                      <MenuMediaPlaceholder kind="product" size="lg" label={p.name} />
                    )}
                  </div>
                  <div className="luxury-product-row__body">
                    <h3>{p.name}</h3>
                    {p.description ? <p>{p.description}</p> : null}
                    <span className="luxury-product-row__price">
                      {formatMoney(p.price, p.currency)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="public-product-list">
              {filteredGroupProducts.map((p) => (
                <Link
                  key={p.id}
                  to={menuProductPath(p.id)}
                  className="public-product-card public-product-card--link"
                >
                  {p.imageUrl ? (
                    <img
                      src={imageUrl(p.imageUrl)}
                      alt=""
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl shrink-0 overflow-hidden">
                      <MenuMediaPlaceholder kind="product" size="md" label={p.name} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 text-base">{p.name}</h3>
                    {p.description && (
                      <p className="text-sm text-slate-500 mt-1 line-clamp-2">{p.description}</p>
                    )}
                    <p className="text-sky-600 font-bold mt-2 text-lg">
                      {formatMoney(p.price, p.currency)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </main>

        <PublicMobileNav
          tab="home"
          onTab={(t) => {
            setTab(t);
            if (t === 'home') navigate(menuHomePath());
          }}
          onSearchOpen={toggleSearch}
          onMenuOpen={() => setSideMenuOpen(true)}
        />

        {sideMenu}
        {assistantUi}
        {tableServiceUi}

        {searchOpen && (
          <SearchOverlay
            search={search}
            onSearchChange={setSearch}
            onClose={closeSearch}
            results={searchPanelExtra}
          />
        )}
      </div>
    );
  }

  /* ── Ana menü ── */
  return (
    <div className="public-menu-page" data-theme-menu={menuTheme}>
      <PublicMenuHeader
        restaurant={menu.restaurant}
        onMenuOpen={() => setSideMenuOpen(true)}
        searchOpen={searchOpen}
        onSearchToggle={toggleSearch}
        searchSlot={
          <>
            {searchField}
            {searchPanelExtra}
          </>
        }
      />

      <main className="public-menu-main">
        <div className="public-tablet-tabs">
          <button
            type="button"
            className={tab === 'home' ? 'is-active' : ''}
            onClick={() => setTab('home')}
          >
            Kategoriler
          </button>
          <button
            type="button"
            className={tab === 'about' ? 'is-active' : ''}
            onClick={() => setTab('about')}
          >
            Hakkımızda
          </button>
          <button
            type="button"
            className={tab === 'settings' ? 'is-active' : ''}
            onClick={() => setTab('settings')}
          >
            Dil
          </button>
        </div>

        {tab === 'home' &&
          (isAlive ? (
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
          ) : (
            <div className="public-menu-home">
              <div className="public-menu-home__orbs" aria-hidden>
                <span className="public-menu-home__orb public-menu-home__orb--1" />
                <span className="public-menu-home__orb public-menu-home__orb--2" />
                <span className="public-menu-home__orb public-menu-home__orb--3" />
              </div>

              {allergyBanner}

              {displayShowcase?.[0]?.imageUrl && (
                <div className="public-showcase public-menu-reveal public-menu-reveal--1">
                  <img
                    src={imageUrl(displayShowcase[0].imageUrl)}
                    alt={displayShowcase[0].title1 || ''}
                    className="w-full h-full object-cover"
                  />
                  <div className="public-showcase__fade" aria-hidden />
                  {(displayShowcase[0].title1 || displayShowcase[0].title2) && (
                    <div className="public-showcase__caption">
                      <BrushCaptionBlock>
                        {displayShowcase[0].title1 && (
                          <BrushCaption size="lg">{displayShowcase[0].title1}</BrushCaption>
                        )}
                        {displayShowcase[0].title2 && (
                          <BrushCaption size="sm" tone="warm">
                            {displayShowcase[0].title2}
                          </BrushCaption>
                        )}
                      </BrushCaptionBlock>
                    </div>
                  )}
                </div>
              )}

              {menu.campaign && (
                <div className="mx-4 mb-3 rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3 public-menu-reveal public-menu-reveal--2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-800/80">
                    Kampanya menüsü
                  </p>
                  <p className="text-sm font-semibold text-amber-950 mt-0.5">
                    {menu.campaign.name}
                  </p>
                </div>
              )}

              {menu.welcomeMessage && (
                <p className="public-welcome public-menu-reveal public-menu-reveal--2">
                  {menu.welcomeMessage}
                </p>
              )}

              <div className="public-menu-divider public-menu-reveal public-menu-reveal--2" aria-hidden>
                <span />
              </div>

              {displayStories && displayStories.length > 0 && (
                <div className="public-menu-reveal public-menu-reveal--3">
                  <MobileStoriesStrip stories={displayStories} />
                </div>
              )}

              {filteredPopular.length > 0 && (
                <section className="public-home-popular md:hidden public-menu-reveal public-menu-reveal--3">
                  <PopularSearchProducts products={filteredPopular} />
                </section>
              )}

              <div className="public-section-head public-menu-reveal public-menu-reveal--4">
                <h2 className="public-section-title">Kategoriler</h2>
                <span className="public-section-accent" aria-hidden />
              </div>

              <div className="public-group-grid">
                {menu.groups.map((group, index) => (
                  <GroupCard
                    key={group.id}
                    group={group}
                    reveal={Math.min(index + 5, 9)}
                  />
                ))}
              </div>

              {filteredPopular.length > 0 && (
                <section className="public-home-popular hidden md:block mt-4 public-menu-reveal public-menu-reveal--8">
                  <PopularSearchProducts products={filteredPopular} />
                </section>
              )}

              {menu.socialLinks && menu.socialLinks.length > 0 && (
                <div className="flex justify-center mt-6 pb-2 public-menu-reveal public-menu-reveal--9">
                  <PublicSocialLinks links={menu.socialLinks} />
                </div>
              )}
            </div>
          ))}

        {tab === 'about' && (
          <div className="public-content-card max-w-2xl mx-auto">
            <h2 className="public-content-card__title">{menu.restaurant.name}</h2>
            <p className="public-content-card__text">
              {menu.about || menu.welcomeMessage || 'Dijital menümüze hoş geldiniz.'}
            </p>
            {menu.socialLinks && menu.socialLinks.length > 0 && (
              <PublicSocialLinks links={menu.socialLinks} className="mt-5" />
            )}
          </div>
        )}

        {tab === 'settings' && (
          <div className="public-content-card max-w-md mx-auto md:max-w-lg">
            <h2 className="public-content-card__title">Dil Seçimi</h2>
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

      <PublicMobileNav
        tab={tab}
        onTab={setTab}
        onSearchOpen={toggleSearch}
        onMenuOpen={() => setSideMenuOpen(true)}
      />

      {sideMenu}
      {assistantUi}
      {tableServiceUi}

      {searchOpen && (
        <SearchOverlay
          search={search}
          onSearchChange={setSearch}
          onClose={closeSearch}
          results={searchPanelExtra}
        />
      )}
    </div>
  );
}

function AliveHome({
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
  const featured = menu.groups[0];
  const rest = menu.groups.slice(1);

  return (
    <div className="alive-home">
      {allergyBanner}

      {displayShowcase?.[0]?.imageUrl && (
        <section className="alive-hero">
          <img
            src={imageUrl(displayShowcase[0].imageUrl)}
            alt={displayShowcase[0].title1 || ''}
          />
          <div className="alive-hero__veil" aria-hidden />
          <div className="alive-hero__copy">
            {menu.campaign ? (
              <span className="alive-hero__badge">{menu.campaign.name}</span>
            ) : (
              <span className="alive-hero__badge">Menü</span>
            )}
            <h1>{displayShowcase[0].title1 || menu.restaurant.name}</h1>
            {(displayShowcase[0].title2 || menu.welcomeMessage) && (
              <p>{displayShowcase[0].title2 || menu.welcomeMessage}</p>
            )}
          </div>
        </section>
      )}

      {!displayShowcase?.[0]?.imageUrl && menu.welcomeMessage && (
        <p className="alive-welcome">{menu.welcomeMessage}</p>
      )}

      {popularProducts.length > 0 && (
        <section className="alive-rail">
          <div className="alive-rail__head">
            <h2>Öne çıkanlar</h2>
            <span>Kaydır</span>
          </div>
          <div className="alive-rail__track">
            {popularProducts.map((p) => (
              <Link
                key={p.id}
                to={menuProductPath(p.id)}
                className="alive-rail__card"
              >
                {p.imageUrl ? (
                  <img src={imageUrl(p.imageUrl)} alt="" />
                ) : (
                  <MenuMediaPlaceholder kind="product" size="md" label={p.name} className="alive-rail__ph" />
                )}
                <div className="alive-rail__meta">
                  <strong>{p.name}</strong>
                  <span>{formatMoney(p.price, p.currency)}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {displayStories && displayStories.length > 0 && (
        <div className="alive-stories">
          <MobileStoriesStrip stories={displayStories} />
        </div>
      )}

      <section className="alive-categories">
        <div className="alive-categories__head">
          <h2>Kategoriler</h2>
          <p>{menu.groups.length} bölüm</p>
        </div>

        {featured && (
          <Link to={menuGroupPath(featured.id)} className="alive-category-feature">
            {featured.imageUrl ? (
              <img src={imageUrl(featured.imageUrl)} alt={featured.name} />
            ) : (
              <MenuMediaPlaceholder
                kind="group"
                size="hero"
                label={featured.name}
                className="alive-category-feature__ph"
              />
            )}
            <div className="alive-category-feature__copy">
              <span>Öne çıkan</span>
              <h3>{featured.name}</h3>
              {typeof featured.productCount === 'number' && featured.productCount > 0 && (
                <p>{featured.productCount} ürün</p>
              )}
            </div>
          </Link>
        )}

        <div className="alive-category-stack">
          {rest.map((group) => (
            <Link
              key={group.id}
              to={menuGroupPath(group.id)}
              className="alive-category-row"
            >
              <div className="alive-category-row__media">
                {group.imageUrl ? (
                  <img src={imageUrl(group.imageUrl)} alt="" />
                ) : (
                  <MenuMediaPlaceholder kind="group" size="sm" label={group.name} />
                )}
              </div>
              <div className="alive-category-row__body">
                <h3>{group.name}</h3>
                {typeof group.productCount === 'number' && group.productCount > 0 && (
                  <p>{group.productCount} ürün</p>
                )}
              </div>
              <span className="alive-category-row__go" aria-hidden>
                →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {menu.socialLinks && menu.socialLinks.length > 0 && (
        <div className="alive-social">
          <PublicSocialLinks links={menu.socialLinks} />
        </div>
      )}
    </div>
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
            <h2>Öne çıkanlar</h2>
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

function GroupCard({
  group,
  reveal,
}: {
  group: { id: number; name: string; imageUrl?: string | null; productCount?: number };
  reveal: number;
}) {
  const [broken, setBroken] = useState(false);
  const showImage = Boolean(group.imageUrl) && !broken;

  return (
    <Link
      to={menuGroupPath(group.id)}
      className={`public-group-card public-menu-reveal public-menu-reveal--${reveal}`}
    >
      {showImage ? (
        <img
          src={imageUrl(group.imageUrl)}
          alt={group.name}
          className="public-group-card__img"
          onError={() => setBroken(true)}
        />
      ) : (
        <MenuMediaPlaceholder
          kind="group"
          size="lg"
          label={group.name}
          className="public-group-card__placeholder"
        />
      )}
      <div className="public-group-card__shade" aria-hidden />
      <div className="public-group-card__caption">
        <BrushCaption size="sm">{group.name}</BrushCaption>
        {typeof group.productCount === 'number' && group.productCount > 0 && (
          <span className="public-group-card__count">{group.productCount} ürün</span>
        )}
      </div>
    </Link>
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
