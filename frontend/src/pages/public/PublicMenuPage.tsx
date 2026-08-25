import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, X, UtensilsCrossed } from 'lucide-react';
import { api, formatMoney, getSessionId, imageUrl } from '@/lib/api';
import { Input } from '@/components/ui';
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
      groupName: string;
      groupId: number;
    }[]
  >([]);
  const [tab, setTab] = useState<PublicTab>('home');
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [popularProducts, setPopularProducts] = useState<PopularProduct[]>([]);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [menuLoading, setMenuLoading] = useState(true);
  const sessionId = getSessionId();

  usePublicRtl(lang);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setMenuLoading(true);
    setMenuError(null);
    const params = new URLSearchParams({ lang, sessionId });
    api<MenuData>(`/api/menu/${slug}?${params}`)
      .then((res) => {
        if (!cancelled) {
          setMenu(res);
          setMenuLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMenuError('Menü yüklenemedi. Backend sunucusu çalışmıyor olabilir.');
          setMenuLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slug, lang, sessionId]);

  useEffect(() => {
    if (!slug || !groupId) {
      setProducts(null);
      return;
    }
    const params = new URLSearchParams({ lang, sessionId });
    api<ProductData>(`/api/menu/${slug}/groups/${groupId}/products?${params}`).then(setProducts);
  }, [slug, groupId, lang, sessionId]);

  useEffect(() => {
    if (!slug || !search.trim()) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(() => {
      api<typeof searchResults>(
        `/api/menu/${slug}/search?q=${encodeURIComponent(search)}&lang=${lang}`
      ).then(setSearchResults);
    }, 300);
    return () => clearTimeout(t);
  }, [search, slug, lang]);

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
    api<PopularProduct[]>(`/api/menu/${slug}/popular-products?lang=${lang}&limit=5`).then(
      setPopularProducts
    );
  }, [slug, lang, demoEnabled]);

  function changeLang(code: string) {
    setLang(code);
    localStorage.setItem('menu_lang', code);
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

  const displayShowcase =
    demoEnabled && menu ? DEMO_MENU_BANNERS : menu?.showcase;
  const displayStories =
    demoEnabled && menu ? mapDemoStoriesToGroups(menu.groups) : menu?.stories;

  const searchField = (
    <Input
      variant="public"
      label="Ürün ara..."
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      className="[&_.float-field]:rounded-full [&_.float-field]:border-0 [&_.float-field]:bg-white/95"
    />
  );

  function handleSearchNavigate() {
    setSearch('');
    closeSearch();
  }

  const searchResultsList =
    searchResults.length > 0 ? (
      <div className="mt-2 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        {searchResults.map((r) => (
          <Link
            key={r.id}
            to={menuProductPath(r.id)}
            className="block px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0"
            onClick={handleSearchNavigate}
          >
            <div className="font-medium text-sm text-slate-900">{r.name}</div>
            <div className="text-xs text-slate-500">
              {r.groupName} · {formatMoney(r.price, r.currency)}
            </div>
          </Link>
        ))}
      </div>
    ) : search.trim() ? (
      <p className="text-sm text-slate-500 mt-3 px-1">Sonuç bulunamadı</p>
    ) : null;

  const popularList = !search.trim() ? (
    <PopularSearchProducts
      products={popularProducts}
      onNavigate={handleSearchNavigate}
    />
  ) : null;

  const searchPanelExtra = search.trim() ? searchResultsList : popularList;

  /* ── Ürün listesi ── */
  if (groupId && products) {
    return (
      <div className="public-menu-page" data-theme-menu={menu.theme || 'sade'}>
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
          <div className="public-product-list">
            {products.products.map((p) => (
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
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-slate-100 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 text-base">{p.name}</h3>
                  {p.description && (
                    <p className="text-sm text-slate-500 mt-1 line-clamp-2">{p.description}</p>
                  )}
                  <p className="text-sky-600 font-bold mt-2 text-lg">{formatMoney(p.price, p.currency)}</p>
                </div>
              </Link>
            ))}
          </div>
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

        <PublicSideMenu
          open={sideMenuOpen}
          tab={tab}
          restaurantName={menu.restaurant.name}
          languages={menu.languages}
          activeLang={lang}
          onClose={() => setSideMenuOpen(false)}
          onTab={(t) => {
            setTab(t);
            navigate(menuHomePath());
          }}
          onLangChange={changeLang}
        />

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
    <div className="public-menu-page" data-theme-menu={menu.theme || 'sade'}>
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

        {tab === 'home' && (
          <div className="public-menu-home">
            <div className="public-menu-home__orbs" aria-hidden>
              <span className="public-menu-home__orb public-menu-home__orb--1" />
              <span className="public-menu-home__orb public-menu-home__orb--2" />
              <span className="public-menu-home__orb public-menu-home__orb--3" />
            </div>

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

            {popularProducts.length > 0 && (
              <section className="public-home-popular md:hidden public-menu-reveal public-menu-reveal--3">
                <PopularSearchProducts products={popularProducts} />
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

            {popularProducts.length > 0 && (
              <section className="public-home-popular hidden md:block mt-4 public-menu-reveal public-menu-reveal--8">
                <PopularSearchProducts products={popularProducts} />
              </section>
            )}
          </div>
        )}

        {tab === 'about' && (
          <div className="public-content-card max-w-2xl mx-auto">
            <h2 className="text-xl font-bold text-slate-900 mb-3">{menu.restaurant.name}</h2>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              {menu.about || menu.welcomeMessage || 'Dijital menümüze hoş geldiniz.'}
            </p>
          </div>
        )}

        {tab === 'settings' && (
          <div className="public-content-card max-w-md mx-auto md:max-w-lg">
            <h2 className="font-semibold text-slate-900 mb-4">Dil Seçimi</h2>
            <div className="space-y-2">
              {menu.languages.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => changeLang(l.code)}
                  className={`w-full text-left px-4 py-3.5 rounded-xl text-sm font-medium transition ${
                    lang === l.code
                      ? 'bg-sky-50 text-sky-700 ring-1 ring-sky-200'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
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

      <PublicSideMenu
        open={sideMenuOpen}
        tab={tab}
        restaurantName={menu.restaurant.name}
        languages={menu.languages}
        activeLang={lang}
        onClose={() => setSideMenuOpen(false)}
        onTab={setTab}
        onLangChange={changeLang}
      />

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
        <div className="public-group-card__placeholder">
          <UtensilsCrossed className="w-8 h-8" />
          <span>{group.name}</span>
        </div>
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
        <div className="flex-1">
          <Input
            variant="public"
            label="Ürün ara..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="[&_.float-field]:rounded-full [&_.float-field]:border-0 [&_.float-field]:bg-white/95"
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
