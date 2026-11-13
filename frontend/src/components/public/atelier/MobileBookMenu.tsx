import { useEffect, useRef, useState, type CSSProperties, type ComponentProps } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Search, Utensils, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { imageUrl, formatMoney } from '@/lib/api';
import { sofraCopy } from '@/lib/sofra';
import { SofraBrand, SofraText } from '../sofra/SofraElements';
import type { SofraMenuClassic } from '../sofra/SofraCanvas';
import { useBookNavigation } from './BookNavigation';
import './mobile-book.css';

function Photo({ src, name }: { src?: string | null; name: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  return src && !broken ? (
    <img src={imageUrl(src)} alt={name} loading="lazy" onError={() => setBroken(true)} />
  ) : (
    <span className="book-photo-empty">
      <Utensils size={28} />
    </span>
  );
}

export default function MobileBookMenu(p: ComponentProps<typeof SofraMenuClassic>) {
  const en = p.lang.startsWith('en'),
    copy = sofraCopy(p.config, p.lang),
    navigation = useBookNavigation();
  const key = `mobile-book:${p.restaurant.name}:${p.activeGroup ?? 'picks'}:${p.search || ''}`;
  const [contents, setContents] = useState(() => {
    try {
      return !sessionStorage.getItem('mobile-book-return');
    } catch {
      return true;
    }
  });
  const [page, setPage] = useState(() => {
    try {
      return Number(sessionStorage.getItem(key)) || 0;
    } catch {
      return 0;
    }
  });
  const [direction, setDirection] = useState(1),
    [query, setQuery] = useState('');
  const dialog = useRef<HTMLElement>(null),
    leaf = useRef<HTMLElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const rows = [...p.products, ...(p.subgroups || []).flatMap((g) => g.products)];
  const current = Math.max(0, Math.min(page, Math.max(0, rows.length - 1))),
    dish = rows[current];
  const categories = [
    { id: null, name: copy.picksLabel, imageUrl: p.groups.find((g) => g.imageUrl)?.imageUrl },
    ...p.groups,
  ];
  const filteredCategories = categories.filter((group) =>
    group.name.toLocaleLowerCase(p.lang).includes(query.toLocaleLowerCase(p.lang)),
  );
  useEffect(() => {
    try {
      sessionStorage.removeItem('mobile-book-return');
      sessionStorage.removeItem('atelier-restore');
    } catch {}
  }, []);
  useEffect(() => {
    leaf.current?.scrollTo(0, 0);
  }, [current, contents, p.activeGroup]);
  useEffect(() => {
    if (!navigation?.open) return;
    const prior = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLInputElement>('input')?.focus();
    function keydown(e: KeyboardEvent) {
      if (e.key === 'Escape') navigation?.setOpen(false);
      if (e.key === 'Tab') {
        const nodes = Array.from(
          dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input') || [],
        );
        if (e.shiftKey && document.activeElement === nodes[0]) {
          e.preventDefault();
          nodes.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === nodes.at(-1)) {
          e.preventDefault();
          nodes[0]?.focus();
        }
      }
    }
    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('keydown', keydown);
      prior?.focus();
    };
  }, [navigation?.open]);
  function choose(id: number | null) {
    setContents(false);
    setPage(0);
    setDirection(1);
    navigation?.setOpen(false);
    setQuery('');
    p.onGroupChange?.(id);
  }
  function turn(next: number) {
    setDirection(next > current ? 1 : -1);
    setPage(next);
    try {
      sessionStorage.setItem(key, String(next));
    } catch {}
  }
  function open(id: number) {
    try {
      const params = new URLSearchParams(location.search);
      if (p.search) params.set('q', p.search);
      const url = location.pathname + (params.size ? '?' + params.toString() : '');
      sessionStorage.setItem('atelier-return', JSON.stringify({ url, y: 0, productId: id }));
      sessionStorage.setItem(key, String(current));
      sessionStorage.setItem('mobile-book-return', '1');
    } catch {}
    p.onProductOpen?.(id);
  }
  const categoryName =
    p.activeGroup == null ? copy.picksLabel : p.groups.find((g) => g.id === p.activeGroup)?.name;
  return (
    <div
      className="mobile-book"
      dir={['ar', 'he', 'fa', 'ur'].includes(p.lang.split('-')[0]) ? 'rtl' : 'ltr'}
    >
      <header className="book-header">
        <SofraBrand {...p} />
        <div className="book-header__tools">{p.headerTools}</div>
      </header>
      <div className="book-stories">{p.beforeContent}</div>
      <div className="book-toolbar">
        <button
          type="button"
          onClick={() => {
            setContents(true);
            p.onSearchChange?.('');
          }}
          aria-pressed={contents}
        >
          <BookOpen size={17} />
          {en ? 'Contents' : 'İçindekiler'}
        </button>
        <label>
          <Search size={17} />
          <input
            type="search"
            aria-label={en ? 'Search menu' : 'Menüde ara'}
            placeholder={en ? 'Find a dish' : 'Bir lezzet ara'}
            value={p.search || ''}
            onChange={(e) => {
              setContents(false);
              setPage(0);
              p.onSearchChange?.(e.target.value);
            }}
          />
        </label>
      </div>
      <main className={`book-volume${contents ? ' is-contents' : ''}`}>
        <div className="book-running-title">
          <span>{contents ? (en ? 'THE MENU' : 'MENÜ DEFTERİ') : categoryName}</span>
          <span>{contents ? '01' : String(current + 2).padStart(2, '0')}</span>
        </div>
        <section
          className="book-leaf"
          ref={leaf}
          key={contents ? 'contents' : `${p.activeGroup}:${current}:${p.search}`}
          style={{ '--page-direction': direction } as CSSProperties}
          onTouchStart={(e) => {
            const point = e.touches[0];
            touch.current = point ? { x: point.clientX, y: point.clientY } : null;
          }}
          onTouchEnd={(e) => {
            const start = touch.current,
              point = e.changedTouches[0];
            touch.current = null;
            if (!start || !point || contents || p.loading) return;
            const dx = point.clientX - start.x,
              dy = point.clientY - start.y;
            if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6) {
              const next = current + (dx < 0 ? 1 : -1);
              if (next >= 0 && next < rows.length) turn(next);
            }
          }}
        >
          {contents ? (
            <>
              <SofraText
                as="h1"
                field="menuTitle"
                value={copy.menuTitle}
                onTextEdit={p.onTextEdit}
              />
              <SofraText
                as="p"
                className="book-intro"
                field="menuEyebrow"
                value={copy.menuEyebrow}
                onTextEdit={p.onTextEdit}
              />
              <div className="book-contents-grid">
                {categories.map((g, i) => (
                  <button type="button" key={g.id ?? 'picks'} onClick={() => choose(g.id)}>
                    <div>
                      <Photo src={g.imageUrl} name="" />
                      <span>{String(i + 1).padStart(2, '0')}</span>
                    </div>
                    <strong>
                      {g.id == null ? (
                        <SofraText field="picksLabel" value={g.name} onTextEdit={p.onTextEdit} />
                      ) : (
                        g.name
                      )}
                    </strong>
                    <ArrowRight size={16} />
                  </button>
                ))}
              </div>
            </>
          ) : p.loading ? (
            <div className="book-empty" role="status">
              {en ? 'Preparing your menu…' : 'Menün hazırlanıyor…'}
            </div>
          ) : p.error ? (
            <div className="book-empty" role="alert">
              <p>{p.error}</p>
              <button type="button" onClick={p.onRetry}>
                {en ? 'Try again' : 'Tekrar dene'}
              </button>
            </div>
          ) : !dish ? (
            <div className="book-empty">
              {en ? 'No dishes found.' : 'Bu seçimde ürün bulunamadı.'}
            </div>
          ) : (
            <article className="book-product">
              <button
                className="book-product__photo"
                type="button"
                onClick={() => open(dish.id)}
                aria-label={dish.name}
              >
                <Photo src={dish.imageUrl} name={dish.name} />
                <span>
                  {en ? 'Discover' : 'Keşfet'} <ArrowRight size={16} />
                </span>
              </button>
              <div className="book-product__copy">
                <span className="book-product__number">
                  {String(current + 1).padStart(2, '0')} — {categoryName}
                </span>
                <button type="button" className="book-product__title" onClick={() => open(dish.id)}>
                  <h1>{dish.name}</h1>
                </button>
                <p>{dish.description}</p>
                {dish.calories != null && <small>{dish.calories} kcal</small>}
              </div>
              <div className="book-product__order">
                <strong>{formatMoney(dish.price, dish.currency)}</strong>
                {p.onAdd && (
                  <button
                    type="button"
                    disabled={dish.soldOut}
                    onClick={() => (dish.hasOptions !== false ? open(dish.id) : p.onAdd?.(dish))}
                  >
                    {dish.soldOut
                      ? en
                        ? 'Sold out'
                        : 'Bugün bitti'
                      : dish.hasOptions !== false
                        ? en
                          ? 'Choose'
                          : 'Seçenekler'
                        : en
                          ? 'Add'
                          : 'Sepete ekle'}
                    <ArrowRight size={17} />
                  </button>
                )}
              </div>
            </article>
          )}
        </section>
        {!contents && rows.length > 0 && !p.loading && !p.error && (
          <nav className="book-pagination" aria-label={en ? 'Pages' : 'Sayfalar'}>
            <button
              type="button"
              aria-label={en ? 'Previous page' : 'Önceki sayfa'}
              disabled={current === 0}
              onClick={() => turn(current - 1)}
            >
              <ArrowLeft size={21} />
            </button>
            <span>
              {current + 1}
              <i>/</i>
              {rows.length}
            </span>
            <button
              type="button"
              aria-label={en ? 'Next page' : 'Sonraki sayfa'}
              disabled={current >= rows.length - 1}
              onClick={() => turn(current + 1)}
            >
              <ArrowRight size={21} />
            </button>
          </nav>
        )}
      </main>
      {p.afterContent}
      {navigation?.open &&
        createPortal(
          <div className="book-picker-backdrop">
            <button
              className="book-picker-shade"
              aria-label={en ? 'Close categories' : 'Kategorileri kapat'}
              onClick={() => navigation.setOpen(false)}
            />
            <section
              ref={dialog}
              className="book-picker"
              role="dialog"
              aria-modal="true"
              aria-label={en ? 'Choose a category' : 'Kategori seç'}
            >
              <div className="book-picker__handle" />
              <header>
                <div>
                  <small>{en ? 'EXPLORE THE MENU' : 'MENÜYÜ KEŞFET'}</small>
                  <h2>{en ? 'What would you like?' : 'Canın ne çekti?'}</h2>
                </div>
                <button
                  type="button"
                  aria-label={en ? 'Close' : 'Kapat'}
                  onClick={() => navigation.setOpen(false)}
                >
                  <X />
                </button>
              </header>
              <label className="book-picker__search">
                <Search size={19} />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={en ? 'Find a category' : 'Kategori ara'}
                  aria-label={en ? 'Search categories' : 'Kategori ara'}
                />
              </label>
              <div className="book-picker__grid">
                {!filteredCategories.length && (
                  <p className="book-picker__empty" role="status">
                    {en ? 'No categories found.' : 'Kategori bulunamadı.'}
                  </p>
                )}
                {filteredCategories.map((g, i) => (
                  <button
                    type="button"
                    key={g.id ?? 'picks'}
                    style={{ animationDelay: `${Math.min(i, 8) * 25}ms` }}
                    aria-pressed={!contents && p.activeGroup === g.id}
                    onClick={() => choose(g.id)}
                  >
                    <Photo src={g.imageUrl} name="" />
                    <span>{g.name}</span>
                  </button>
                ))}
              </div>
              <footer>
                <BookOpen size={20} />
                <span>
                  {en ? 'Every chapter, a new flavour.' : 'Her bölümde başka bir lezzet.'}
                </span>
              </footer>
            </section>
          </div>,
          document.body,
        )}
    </div>
  );
}
