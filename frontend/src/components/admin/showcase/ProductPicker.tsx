import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, Search, SearchX, Utensils, X } from 'lucide-react';
import { formatMoney, imageUrl } from '@/lib/api';
import type { ProductOption } from './types';

/** Case, Turkish letters and accents are ignored: "izgara" finds "Izgara", "sogan" finds "Soğan". */
const fold = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i');
const groupOf = (product: ProductOption) => product.groupName || 'Diğer';

export function ProductThumb({ product }: { product?: ProductOption | null }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [product?.imageUrl]);
  return (
    <span className="sc-thumb" aria-hidden="true">
      {product?.imageUrl && !failed ? (
        <img
          src={imageUrl(product.imageUrl)}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <Utensils size={20} />
      )}
    </span>
  );
}

/**
 * Full-sheet product chooser: type to search, jump with arrow keys, or filter by group.
 * Choosing a product is one tap and returns to the form.
 */
export default function ProductPicker({
  products,
  value,
  busy,
  title,
  onSelect,
  onBack,
  onClose,
}: {
  products: ProductOption[];
  value: string;
  busy: boolean;
  title: string;
  onSelect: (id: string) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const filterBox = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<string | null>(null);
  const [panel, setPanel] = useState(false);
  const [active, setActive] = useState(0);

  // Keyboard users land in the search box; on touch screens it would only hide the list.
  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) input.current?.focus();
  }, []);
  const groups = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of products)
      counts.set(groupOf(product), (counts.get(groupOf(product)) || 0) + 1);
    return [...counts];
  }, [products]);
  const sections = useMemo(() => {
    const needle = fold(query.trim());
    const pool = products.filter((p) => !group || groupOf(p) === group);
    if (needle) {
      // Name starts with → a word starts with → name contains → group matches.
      const ranked = pool
        .map((product) => {
          const name = fold(product.name);
          const rank = name.startsWith(needle)
            ? 0
            : name.split(/\s+/).some((word) => word.startsWith(needle))
              ? 1
              : name.includes(needle)
                ? 2
                : fold(groupOf(product)).includes(needle)
                  ? 3
                  : -1;
          return { product, rank };
        })
        .filter((entry) => entry.rank >= 0)
        .sort((a, b) => a.rank - b.rank);
      return ranked.length
        ? [{ title: '', items: ranked.map((entry) => entry.product) }]
        : [];
    }
    const byGroup = new Map<string, ProductOption[]>();
    for (const product of pool)
      byGroup.set(groupOf(product), [...(byGroup.get(groupOf(product)) || []), product]);
    return [...byGroup].map(([name, items]) => ({ title: name, items }));
  }, [products, query, group]);
  const flat = useMemo(() => sections.flatMap((section) => section.items), [sections]);

  // New results: start on the chosen product, or on the first row.
  useEffect(() => {
    const chosen = flat.findIndex((p) => String(p.id) === value);
    setActive(query.trim() || chosen < 0 ? 0 : chosen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flat]);
  useEffect(() => {
    const row = list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    row?.scrollIntoView({ block: 'nearest' });
  }, [active, flat]);
  useEffect(() => {
    if (!panel) return;
    const outside = (event: PointerEvent) => {
      if (!filterBox.current?.contains(event.target as Node)) setPanel(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [panel]);

  function move(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!flat.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((n) => (n + step + flat.length) % flat.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      onSelect(String(flat[Math.min(active, flat.length - 1)].id));
    }
  }
  let index = -1;
  return (
    <div className="sc-picker">
      <header className="sc-editor__head">
        <button
          type="button"
          className="sc-icon"
          aria-label="Forma dön"
          disabled={busy}
          onClick={onBack}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2>Ürün seç</h2>
          <span className="sc-eyebrow sc-picker__for">{title}</span>
        </div>
        <button
          type="button"
          className="sc-icon"
          aria-label="Pencereyi kapat"
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      <div className="sc-picker__bar">
        <label className="sc-picker__search">
          <Search size={18} aria-hidden="true" />
          <input
            ref={input}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={flat.length ? `${listId}-${active}` : undefined}
            aria-label="Ürün ara"
            type="search"
            enterKeyHint="done"
            autoComplete="off"
            placeholder="Ürün ara"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={move}
          />
        </label>
        {groups.length > 1 && (
          <div
            className="sc-picker__filter"
            ref={filterBox}
            data-admin-escape-owner
            onKeyDown={(event) => {
              if (event.key !== 'Escape' || !panel) return;
              event.preventDefault();
              event.stopPropagation();
              setPanel(false);
            }}
          >
            <button
              type="button"
              className={group ? 'is-filtered' : ''}
              aria-expanded={panel}
              onClick={() => setPanel((open) => !open)}
            >
              <span>{group || 'Tüm gruplar'}</span>
              <ChevronDown size={16} aria-hidden="true" />
            </button>
            {panel && (
              <div className="sc-picker__panel">
                <button
                  type="button"
                  aria-pressed={!group}
                  onClick={() => {
                    setGroup(null);
                    setPanel(false);
                  }}
                >
                  <span>Tüm gruplar</span>
                  <small>{products.length}</small>
                </button>
                {groups.map(([name, count]) => (
                  <button
                    type="button"
                    key={name}
                    aria-pressed={group === name}
                    onClick={() => {
                      setGroup(name);
                      setPanel(false);
                    }}
                  >
                    <span>{name}</span>
                    <small>{count}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="sc-picker__list admin-scroll" id={listId} role="listbox" ref={list}>
        {!products.length ? (
          <p className="sc-picker__empty">
            <Utensils size={26} aria-hidden="true" />
            Henüz ürün yok. Önce Ürünler sayfasından bir ürün ekleyin.
          </p>
        ) : !flat.length ? (
          <div className="sc-picker__empty">
            <SearchX size={26} aria-hidden="true" />
            <p>“{query.trim()}” için ürün bulunamadı.</p>
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setGroup(null);
                input.current?.focus();
              }}
            >
              Aramayı temizle
            </button>
          </div>
        ) : (
          sections.map((section) => (
            <section key={section.title || 'results'}>
              {section.title && (
                <h3 className="sc-picker__title">
                  <span>{section.title}</span>
                  <small>{section.items.length}</small>
                </h3>
              )}
              {section.items.map((product) => {
                index++;
                const position = index;
                const selected = String(product.id) === value;
                return (
                  <div
                    key={product.id}
                    id={`${listId}-${position}`}
                    data-index={position}
                    role="option"
                    aria-selected={selected}
                    className={`sc-picker__row${selected ? ' is-selected' : ''}${
                      position === active ? ' is-active' : ''
                    }`}
                    onMouseMove={() => active !== position && setActive(position)}
                    onClick={() => onSelect(String(product.id))}
                  >
                    <ProductThumb product={product} />
                    <span className="sc-picker__text">
                      <strong>{product.name}</strong>
                      <small>
                        {groupOf(product)}
                        {product.isActive === false ? ' · Pasif' : ''}
                      </small>
                    </span>
                    {product.price != null && (
                      <span className="sc-picker__price">
                        {formatMoney(Number(product.price), product.currency)}
                      </span>
                    )}
                  </div>
                );
              })}
            </section>
          ))
        )}
      </div>
    </div>
  );
}
