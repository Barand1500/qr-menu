import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Search, Home, Info, Settings, ArrowLeft } from 'lucide-react';
import { api, formatPrice, getSessionId, imageUrl } from '@/lib/api';

interface MenuData {
  restaurant: { id: number; name: string; slug: string; logoUrl?: string | null };
  welcomeMessage: string;
  languages: { code: string; name: string }[];
  groups: { id: number; name: string; imageUrl?: string | null }[];
}

interface ProductData {
  group: { id: number; name: string; imageUrl?: string | null };
  products: { id: number; name: string; description: string; price: number; imageUrl?: string | null }[];
}

export default function PublicMenuPage() {
  const { slug, groupId } = useParams();
  const navigate = useNavigate();
  const [lang, setLang] = useState(() => localStorage.getItem('menu_lang') || 'tr');
  const [menu, setMenu] = useState<MenuData | null>(null);
  const [products, setProducts] = useState<ProductData | null>(null);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<
    { id: number; name: string; price: number; groupName: string; groupId: number }[]
  >([]);
  const [tab, setTab] = useState<'home' | 'about' | 'settings'>('home');
  const sessionId = getSessionId();

  useEffect(() => {
    if (!slug) return;
    const params = new URLSearchParams({ lang, sessionId });
    api<MenuData>(`/api/menu/${slug}?${params}`).then(setMenu);
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
      api<typeof searchResults>(`/api/menu/${slug}/search?q=${encodeURIComponent(search)}&lang=${lang}`)
        .then(setSearchResults);
    }, 300);
    return () => clearTimeout(t);
  }, [search, slug, lang]);

  function changeLang(code: string) {
    setLang(code);
    localStorage.setItem('menu_lang', code);
  }

  if (!menu) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (groupId && products) {
    return (
      <div className="min-h-screen bg-slate-100 pb-20">
        <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(`/m/${slug}`)} className="p-2 rounded-lg hover:bg-slate-100">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-semibold text-lg truncate">{products.group.name}</h1>
        </header>

        <div className="p-4 space-y-3 max-w-2xl mx-auto">
          {products.products.map((p) => (
            <div key={p.id} className="bg-white rounded-2xl p-4 flex gap-4 shadow-sm">
              {p.imageUrl ? (
                <img src={imageUrl(p.imageUrl)} alt="" className="w-20 h-20 rounded-xl object-cover shrink-0" />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-slate-100 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-900">{p.name}</h3>
                {p.description && <p className="text-sm text-slate-500 mt-1">{p.description}</p>}
                <p className="text-indigo-600 font-semibold mt-2">{formatPrice(p.price)} ₺</p>
              </div>
            </div>
          ))}
        </div>

        <BottomNav slug={slug!} tab="home" onTab={setTab} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-20">
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          {menu.restaurant.logoUrl ? (
            <img src={imageUrl(menu.restaurant.logoUrl)} alt="" className="w-10 h-10 rounded-lg object-contain" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
              {menu.restaurant.name.charAt(0)}
            </div>
          )}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ürün ara..."
              className="w-full pl-9 pr-4 py-2.5 rounded-full bg-slate-100 border-0 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>
        </div>
        {searchResults.length > 0 && (
          <div className="max-w-3xl mx-auto mt-2 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
            {searchResults.map((r) => (
              <Link
                key={r.id}
                to={`/m/${slug}/group/${r.groupId}`}
                className="block px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0"
                onClick={() => setSearch('')}
              >
                <div className="font-medium text-sm">{r.name}</div>
                <div className="text-xs text-slate-500">{r.groupName} · {formatPrice(r.price)} ₺</div>
              </Link>
            ))}
          </div>
        )}
      </header>

      <main className="max-w-3xl mx-auto p-4">
        {tab === 'home' && (
          <>
            {menu.welcomeMessage && (
              <p className="text-center text-slate-600 text-sm mb-6 px-4">{menu.welcomeMessage}</p>
            )}
            <h2 className="text-lg font-semibold mb-4 text-slate-800">Kategoriler</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {menu.groups.map((group) => (
                <Link
                  key={group.id}
                  to={`/m/${slug}/group/${group.id}`}
                  className="group relative rounded-2xl overflow-hidden aspect-[4/3] shadow-sm hover:shadow-md transition"
                >
                  {group.imageUrl ? (
                    <img
                      src={imageUrl(group.imageUrl)}
                      alt={group.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-violet-500" />
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-white/90 backdrop-blur px-3 py-2.5">
                    <span className="font-semibold text-sm text-slate-900">{group.name}</span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        {tab === 'about' && (
          <Card className="p-6 bg-white rounded-2xl shadow-sm">
            <h2 className="text-xl font-semibold mb-2">{menu.restaurant.name}</h2>
            <p className="text-slate-600 text-sm leading-relaxed">
              {menu.welcomeMessage || 'Dijital menümüze hoş geldiniz.'}
            </p>
          </Card>
        )}

        {tab === 'settings' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Dil Seçimi</h2>
            <div className="space-y-2">
              {menu.languages.map((l) => (
                <button
                  key={l.code}
                  onClick={() => changeLang(l.code)}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition ${
                    lang === l.code ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50'
                  }`}
                >
                  {l.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      <BottomNav slug={slug!} tab={tab} onTab={setTab} />
    </div>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

function BottomNav({
  slug,
  tab,
  onTab,
}: {
  slug: string;
  tab: 'home' | 'about' | 'settings';
  onTab: (t: 'home' | 'about' | 'settings') => void;
}) {
  const items = [
    { id: 'home' as const, icon: Home, label: 'Anasayfa', to: `/m/${slug}` },
    { id: 'about' as const, icon: Info, label: 'Hakkımızda' },
    { id: 'settings' as const, icon: Settings, label: 'Ayarlar' },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 safe-area-pb">
      <div className="max-w-3xl mx-auto flex">
        {items.map(({ id, icon: Icon, label, to }) => (
          <Link
            key={id}
            to={to || `/m/${slug}`}
            onClick={(e) => {
              if (id !== 'home') {
                e.preventDefault();
                onTab(id);
              } else {
                onTab('home');
              }
            }}
            className={`flex-1 flex flex-col items-center py-3 text-xs transition ${
              tab === id ? 'text-indigo-600' : 'text-slate-500'
            }`}
          >
            <Icon className="w-5 h-5 mb-1" />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
