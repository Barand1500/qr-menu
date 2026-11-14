import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, Plus, RotateCw, Search, X } from 'lucide-react';
import { formatMoney } from '@/lib/api';
import { sofraCopy } from '@/lib/sofra';
import type { SofraProduct } from '../sofra/SofraElements';
import type { SofraMenuProps } from '../sofra/types';
import { Photo, cssVars, prefersReducedMotion } from './shared';

const TEXT = {
  tr: {
    search: 'Menüde ara',
    clear: 'Aramayı temizle',
    categories: 'Kategoriler',
    allCategories: 'Tüm kategoriler',
    category: 'Kategori',
    results: 'Arama sonuçları',
    loading: 'Menü hazırlanıyor…',
    retry: 'Tekrar dene',
    empty: 'Bu seçimde ürün bulunamadı.',
    soldOut: 'Bugün bitti',
    add: 'Sepete ekle',
    added: 'Eklendi',
    choose: 'Seçenekler',
    close: 'Kapat',
    findCategory: 'Kategori ara',
    noCategory: 'Kategori bulunamadı.',
    craving: 'Canın ne çekti?',
    explore: 'Menüyü keşfet',
    items: (n: number) => `${n} lezzet`,
  },
  en: {
    search: 'Search the menu',
    clear: 'Clear search',
    categories: 'Categories',
    allCategories: 'All categories',
    category: 'Category',
    results: 'Search results',
    loading: 'Preparing the menu…',
    retry: 'Try again',
    empty: 'No dishes found here.',
    soldOut: 'Sold out today',
    add: 'Add to cart',
    added: 'Added',
    choose: 'Options',
    close: 'Close',
    findCategory: 'Find a category',
    noCategory: 'No categories found.',
    craving: 'What are you craving?',
    explore: 'Explore the menu',
    items: (n: number) => `${n} ${n === 1 ? 'dish' : 'dishes'}`,
  },
};
export type MenuText = (typeof TEXT)['tr'];

export function SearchCorrection({ p }: { p: SofraMenuProps }) {
  if (!p.search?.trim() || !p.searchSuggestion || p.loading || p.error || !p.products.length)
    return null;
  const en = p.lang.split('-')[0] === 'en';
  return (
    <div className="sh-search-correction" role="status">
      <span>{en ? 'Did you mean' : 'Bunu mu demek istediniz?'}</span>
      <button type="button" onClick={() => p.onSearchChange?.(p.searchSuggestion!)}>
        {p.searchSuggestion}
        <ArrowUpRight size={15} />
      </button>
      <small>
        {en
          ? 'A little typo won’t stop us finding your favourite.'
          : 'Küçük yazım hataları bizde sorun değil.'}{' '}
        <span aria-hidden="true">♡</span>
      </small>
    </div>
  );
}

const RETURN_KEY = 'menu-return';
const RESTORE_KEY = 'menu-restore';

/** Derived state and behaviour shared by the desktop and mobile menus. */
export function useMenuModel(p: SofraMenuProps) {
  const copy = sofraCopy(p.config, p.lang);
  const t: MenuText = p.lang.split('-')[0] === 'en' ? TEXT.en : TEXT.tr;
  const searching = Boolean(p.search?.trim());
  const home = p.activeGroup == null && !searching;
  const groupIndex = p.groups.findIndex((g) => g.id === p.activeGroup);
  const group = groupIndex >= 0 ? p.groups[groupIndex] : undefined;
  const count =
    p.products.length + (p.subgroups || []).reduce((sum, g) => sum + g.products.length, 0);

  // The welcome screen leaves a flag so its colour wipe can finish on this page.
  const [wipe, setWipe] = useState(() => {
    try {
      return Boolean(sessionStorage.getItem('sahne-wipe')) && !prefersReducedMotion();
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      sessionStorage.removeItem('sahne-wipe');
    } catch {}
    if (!wipe) return;
    const timer = setTimeout(() => setWipe(false), 1300);
    return () => clearTimeout(timer);
  }, [wipe]);

  // Coming back from a product: return to the same scroll position.
  useEffect(() => {
    if (p.loading) return;
    try {
      const saved = JSON.parse(sessionStorage.getItem(RETURN_KEY) || 'null');
      if (!sessionStorage.getItem(RESTORE_KEY)) return;
      sessionStorage.removeItem(RESTORE_KEY);
      if (saved?.url !== location.pathname + location.search) return;
      const timer = setTimeout(() => window.scrollTo(0, Number(saved.y) || 0), 80);
      return () => clearTimeout(timer);
    } catch {}
  }, [p.loading]);

  // A new category starts from the top.
  const firstGroup = useRef(true);
  useEffect(() => {
    if (firstGroup.current) {
      firstGroup.current = false;
      return;
    }
    window.scrollTo(0, 0);
  }, [p.activeGroup]);

  function open(id: number) {
    try {
      const params = new URLSearchParams(location.search);
      if (p.search?.trim()) params.set('q', p.search);
      const query = params.toString();
      sessionStorage.setItem(
        RETURN_KEY,
        JSON.stringify({
          url: location.pathname + (query ? '?' + query : ''),
          y: window.scrollY,
          productId: id,
        }),
      );
    } catch {}
    p.onProductOpen?.(id);
  }

  return { copy, t, searching, home, group, groupIndex, count, wipe, open };
}

export function SearchField({
  p,
  t,
  inputRef,
  hint,
}: {
  p: SofraMenuProps;
  t: MenuText;
  inputRef?: React.Ref<HTMLInputElement>;
  hint?: string;
}) {
  return (
    <label className="sh-search">
      <Search size={18} aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        aria-label={t.search}
        placeholder={t.search}
        value={p.search || ''}
        onChange={(e) => p.onSearchChange?.(e.target.value)}
      />
      {p.search ? (
        <button type="button" aria-label={t.clear} onClick={() => p.onSearchChange?.('')}>
          <X size={16} />
        </button>
      ) : (
        hint && <kbd aria-hidden="true">{hint}</kbd>
      )}
    </label>
  );
}

export function AddButton({
  dish,
  t,
  onAdd,
  round,
}: {
  dish: SofraProduct;
  t: MenuText;
  onAdd: NonNullable<SofraMenuProps['onAdd']>;
  round?: boolean;
}) {
  const [added, setAdded] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  // Products without options go straight to the cart; the rest open their detail page.
  const direct = dish.hasOptions === false;
  const label = dish.soldOut ? t.soldOut : added ? t.added : direct ? t.add : t.choose;
  return (
    <button
      type="button"
      className={`sh-add${round ? ' sh-add--round' : ''}${added ? ' is-added' : ''}`}
      disabled={dish.soldOut}
      aria-label={`${dish.name}: ${label}`}
      onClick={(e) => {
        if (direct) {
          setAdded(true);
          clearTimeout(timer.current);
          timer.current = window.setTimeout(() => setAdded(false), 1200);
        }
        const from = e.currentTarget.closest('[data-dish]')?.querySelector<HTMLElement>('img');
        onAdd(dish, from || e.currentTarget);
      }}
    >
      {added ? <Check size={18} /> : direct ? <Plus size={18} /> : <ArrowUpRight size={18} />}
      <span>{label}</span>
    </button>
  );
}

export function DishCard({
  dish,
  index,
  lead,
  t,
  onOpen,
  onAdd,
}: {
  dish: SofraProduct;
  index: number;
  lead?: boolean;
  t: MenuText;
  onOpen: (id: number) => void;
  onAdd?: SofraMenuProps['onAdd'];
}) {
  return (
    <article
      className={`sh-card${lead ? ' sh-card--lead' : ''}${dish.soldOut ? ' is-out' : ''}`}
      style={cssVars({ '--i': index % 4 })}
      data-reveal
      data-dish
    >
      <div className="sh-card__in">
        <button
          type="button"
          className="sh-card__media"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => onOpen(dish.id)}
        >
          <Photo src={dish.imageUrl} />
          {dish.soldOut && <span className="sh-card__flag">{t.soldOut}</span>}
          {dish.calories != null && <span className="sh-card__kcal">{dish.calories} kcal</span>}
        </button>
        <div className="sh-card__body">
          <button type="button" className="sh-card__name" onClick={() => onOpen(dish.id)}>
            <h3>{dish.name}</h3>
          </button>
          {dish.description && <p>{dish.description}</p>}
          <div className="sh-card__foot">
            <strong>{formatMoney(dish.price, dish.currency)}</strong>
            {onAdd && <AddButton dish={dish} t={t} onAdd={onAdd} />}
          </div>
        </div>
        <i className="sh-card__glow" aria-hidden="true" />
      </div>
    </article>
  );
}

export function GridSkeleton({ count = 8, label }: { count?: number; label: string }) {
  return (
    <div className="sh-grid" role="status" aria-label={label}>
      {Array.from({ length: count }, (_, i) => (
        <div className="sh-skeleton" key={i} style={cssVars({ '--i': i })} />
      ))}
    </div>
  );
}

export function MenuState({
  error,
  t,
  onRetry,
}: {
  error?: string | null;
  t: MenuText;
  onRetry?: () => void;
}) {
  return error ? (
    <div className="sh-state" role="alert">
      <p>{error}</p>
      <button type="button" className="sh-ghost" onClick={onRetry}>
        <RotateCw size={16} />
        {t.retry}
      </button>
    </div>
  ) : (
    <p className="sh-state">{t.empty}</p>
  );
}
