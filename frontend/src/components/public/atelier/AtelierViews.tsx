import { useEffect, useState, type ComponentProps } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Search } from 'lucide-react';
import type { SofraMenuClassic, SofraWelcomeClassic } from '../sofra/SofraCanvas';
import { SofraBrand, SofraText } from '../sofra/SofraElements';
import { sofraCopy } from '@/lib/sofra';
import { api, imageUrl, formatMoney } from '@/lib/api';
import { resolveMenuSlug } from '@/lib/menuPaths';
import LanguageFlag from '@/components/LanguageFlag';
import SketchPhoto from './SketchPhoto';
import './atelier.css';

export function AtelierWelcome(p: ComponentProps<typeof SofraWelcomeClassic>) {
  const copy = sofraCopy(p.config, p.lang),
    en = p.lang.startsWith('en');
  const [photos, setPhotos] = useState<string[]>([]);
  useEffect(() => {
    if (p.onTextEdit || !window.matchMedia('(min-width: 1024px)').matches) return;
    let cancelled = false;
    resolveMenuSlug()
      .then((slug) =>
        api<{ imageUrl?: string }[]>(`/api/menu/${slug}/popular-products?lang=${p.lang}`),
      )
      .then((items) => {
        if (!cancelled && Array.isArray(items))
          setPhotos(
            items
              .map((item) => item.imageUrl)
              .filter((src): src is string => Boolean(src))
              .slice(0, 4),
          );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [p.lang, p.onTextEdit]);
  const [intro, setIntro] = useState(() => {
    try {
      return !sessionStorage.getItem('atelier-intro');
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (!intro) return;
    try {
      sessionStorage.setItem('atelier-intro', '1');
    } catch {}
    const timer = setTimeout(() => setIntro(false), 1400);
    return () => clearTimeout(timer);
  }, [intro]);
  return (
    <div
      className={`atelier atelier-welcome${p.entering ? ' is-entering' : ''}`}
      dir={['ar', 'he', 'fa', 'ur'].includes(p.lang.split('-')[0]) ? 'rtl' : 'ltr'}
    >
      <header className="atelier-header">
        <SofraBrand {...p} />
        <label>
          <LanguageFlag code={p.lang} />
          <select
            aria-label="Dil / Language"
            value={p.lang}
            onChange={(e) => p.onLangChange?.(e.target.value)}
          >
            {p.languages.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        {p.tableLabel && <span>{p.tableLabel}</span>}
      </header>
      <main className="atelier-cover">
        <div className="atelier-cover__text">
          <span className="atelier-kicker">
            {en ? 'FROM THE CHEF’S NOTEBOOK' : 'ŞEFİN DEFTERİNDEN'}
          </span>
          <SofraText
            as="h1"
            field="welcomeTitle"
            value={copy.welcomeTitle}
            onTextEdit={p.onTextEdit}
          />
          <SofraText
            as="p"
            field="welcomeSubtitle"
            value={copy.welcomeSubtitle}
            onTextEdit={p.onTextEdit}
          />
          <button className="atelier-primary" onClick={p.onEnter} disabled={p.entering}>
            <BookOpen size={19} />
            <SofraText field="enterLabel" value={copy.enterLabel} onTextEdit={p.onTextEdit} />
            <ArrowRight size={19} />
          </button>
          <SofraText field="sealText" value={copy.sealText} onTextEdit={p.onTextEdit} />
        </div>
        <button
          className="atelier-cover__image"
          onClick={() => (p.onImageEdit ? p.onImageEdit('welcomeImage') : p.onEnter?.())}
          aria-label={en ? 'Open menu' : 'Menüyü aç'}
        >
          <SketchPhoto src={p.config.welcomeImage} name={p.restaurant.name} />
        </button>
      </main>
      <footer className="atelier-footer">
        <SofraText field="footerText" value={copy.footerText} onTextEdit={p.onTextEdit} />
        <span>{p.config.openingHours}</span>
        {p.extra}
      </footer>
      {intro && p.config.welcomeImage && !p.onTextEdit && (
        <div className="atelier-intro" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i}>
              <img src={imageUrl(photos[i] || p.config.welcomeImage)} alt="" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AtelierMenu(p: ComponentProps<typeof SofraMenuClassic>) {
  const copy = sofraCopy(p.config, p.lang),
    en = p.lang.startsWith('en');
  const key = `atelier-book:${p.restaurant.name}:${p.activeGroup ?? 'picks'}:${p.search || ''}`;
  const [page, setPage] = useState(0),
    [contents, setContents] = useState(false);
  const rows = [...p.products, ...(p.subgroups || []).flatMap((g) => g.products)];
  useEffect(() => {
    try {
      setPage(Math.max(0, Number(sessionStorage.getItem(key)) || 0));
      setContents(
        window.matchMedia('(max-width: 1023px)').matches &&
          !sessionStorage.getItem('atelier-book-open') &&
          !p.search,
      );
    } catch {}
  }, [key, p.search]);
  const current = Math.min(page, Math.max(0, rows.length - 1));
  function turn(next: number) {
    setPage(next);
    if (window.matchMedia('(max-width: 1023px)').matches)
      window.scrollTo({ top: 0, behavior: 'instant' });
    try {
      sessionStorage.setItem(key, String(next));
    } catch {}
  }
  function choose(id: number | null) {
    setContents(false);
    try {
      sessionStorage.setItem('atelier-book-open', '1');
    } catch {}
    p.onGroupChange?.(id);
  }
  function open(id: number) {
    try {
      sessionStorage.setItem(
        'atelier-return',
        JSON.stringify({
          url:
            location.pathname +
            (location.search || p.search ? '?' : '') +
            new URLSearchParams({
              ...Object.fromEntries(new URLSearchParams(location.search)),
              ...(p.search ? { q: p.search } : {}),
            }).toString(),
          y: window.scrollY,
          productId: id,
        }),
      );
      sessionStorage.setItem(key, String(current));
    } catch {}
    p.onProductOpen?.(id);
  }
  useEffect(() => {
    if (p.loading) return;
    try {
      const value = JSON.parse(sessionStorage.getItem('atelier-return') || 'null');
      if (
        sessionStorage.getItem('atelier-restore') &&
        value?.url === location.pathname + location.search
      ) {
        const timer = setTimeout(() => {
          window.scrollTo(0, value.y);
          sessionStorage.removeItem('atelier-restore');
        }, 100);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, [p.loading]);
  return (
    <div
      className="atelier atelier-menu"
      dir={['ar', 'he', 'fa', 'ur'].includes(p.lang.split('-')[0]) ? 'rtl' : 'ltr'}
    >
      <header className="atelier-header">
        <SofraBrand {...p} />
        <div>{p.headerTools}</div>
      </header>
      <div className="atelier-navigation">
        <button className="atelier-index-toggle" onClick={() => setContents(!contents)}>
          <BookOpen size={19} />
          {en ? 'Contents' : 'İçindekiler'}
        </button>
        <nav aria-label={en ? 'Categories' : 'Kategoriler'}>
          <button
            onClick={() => choose(null)}
            aria-current={p.activeGroup == null ? 'page' : undefined}
          >
            <SofraText field="picksLabel" value={copy.picksLabel} onTextEdit={p.onTextEdit} />
          </button>
          {p.groups.map((g) => (
            <button
              key={g.id}
              aria-current={p.activeGroup === g.id ? 'page' : undefined}
              onClick={() => choose(g.id)}
            >
              {g.name}
            </button>
          ))}
        </nav>
        <label className="atelier-search">
          <Search size={18} />
          <input
            type="search"
            aria-label={en ? 'Search menu' : 'Menüde ara'}
            placeholder={en ? 'Search menu' : 'Menüde ara'}
            value={p.search || ''}
            onChange={(e) => {
              setContents(false);
              p.onSearchChange?.(e.target.value);
            }}
          />
        </label>
      </div>
      <main className="atelier-pages">
        <div className="atelier-section-heading">
          <SofraText as="h1" field="menuTitle" value={copy.menuTitle} onTextEdit={p.onTextEdit} />
          <SofraText field="menuEyebrow" value={copy.menuEyebrow} onTextEdit={p.onTextEdit} />
        </div>
        {contents && (
          <section className="atelier-contents">
            <span className="atelier-kicker">{en ? 'YOUR MENU' : 'MENÜ DEFTERİNİZ'}</span>
            <h2>{en ? 'Contents' : 'İçindekiler'}</h2>
            <button onClick={() => choose(null)}>
              <span>00</span>
              {copy.picksLabel}
              <ArrowRight size={18} />
            </button>
            {p.groups.map((g, i) => (
              <button key={g.id} onClick={() => choose(g.id)}>
                <span>{String(i + 1).padStart(2, '0')}</span>
                {g.name}
                <ArrowRight size={18} />
              </button>
            ))}
          </section>
        )}
        <div className={contents ? 'atelier-products is-contents' : 'atelier-products'}>
          {p.loading ? (
            <p role="status">{en ? 'Preparing the menu…' : 'Menü hazırlanıyor…'}</p>
          ) : p.error ? (
            <div role="alert">
              {p.error}
              <button onClick={p.onRetry}>{en ? 'Try again' : 'Tekrar dene'}</button>
            </div>
          ) : !rows.length ? (
            <p>{en ? 'No dishes found.' : 'Ürün bulunamadı.'}</p>
          ) : (
            rows.map((dish, i) => (
              <article
                key={dish.id}
                className={`atelier-dish${i === current ? ' is-book-page' : ''}`}
              >
                <button
                  className="atelier-dish__image"
                  onClick={() => open(dish.id)}
                  aria-label={dish.name}
                >
                  <SketchPhoto src={dish.imageUrl} name={dish.name} />
                </button>
                <div className="atelier-dish__text">
                  {p.subgroups?.find((g) =>
                    g.products.some((product) => product.id === dish.id),
                  ) && (
                    <h3 className="atelier-subgroup">
                      {
                        p.subgroups.find((g) =>
                          g.products.some((product) => product.id === dish.id),
                        )?.name
                      }
                    </h3>
                  )}
                  <span className="atelier-kicker">
                    {String(i + 1).padStart(2, '0')} / {String(rows.length).padStart(2, '0')}
                  </span>
                  <button className="atelier-dish__title" onClick={() => open(dish.id)}>
                    <h2>{dish.name}</h2>
                  </button>
                  <p>{dish.description}</p>
                  {dish.calories != null && <small>{dish.calories} kcal</small>}
                  <div className="atelier-dish__order">
                    <strong>{formatMoney(dish.price, dish.currency)}</strong>
                    {p.onAdd && (
                      <button
                        className="atelier-primary"
                        disabled={dish.soldOut}
                        onClick={() => dish.hasOptions !== false ? open(dish.id) : p.onAdd?.(dish)}
                      >
                        {dish.soldOut
                          ? en
                            ? 'Sold out'
                            : 'Bugün bitti'
                          : dish.hasOptions
                            ? en
                              ? 'Choose options'
                              : 'Seçenekleri seç'
                            : en
                              ? 'Add to cart'
                              : 'Sepete ekle'}
                        <ArrowRight size={18} />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))
          )}
          {!p.loading && !p.error && rows.length > 0 && (
            <div className="atelier-pagination">
              <button
                aria-label={en ? 'Previous page' : 'Önceki sayfa'}
                disabled={current === 0}
                onClick={() => turn(current - 1)}
              >
                <ArrowLeft />
              </button>
              <span>
                {current + 1} / {rows.length}
              </span>
              <button
                aria-label={en ? 'Next page' : 'Sonraki sayfa'}
                disabled={current === rows.length - 1}
                onClick={() => turn(current + 1)}
              >
                <ArrowRight />
              </button>
            </div>
          )}
        </div>
        <div className="atelier-extras">
          {p.beforeContent}
          {p.afterContent}
        </div>
      </main>
      <footer className="atelier-footer">
        <SofraText field="footerText" value={copy.footerText} onTextEdit={p.onTextEdit} />
      </footer>
    </div>
  );
}
