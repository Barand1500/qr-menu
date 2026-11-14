import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowUpRight, Search, Sparkles, X } from 'lucide-react';
import { formatMoney } from '@/lib/api';
import { SofraBrand, SofraText } from '../sofra/SofraElements';
import type { SofraProduct } from '../sofra/SofraElements';
import type { SofraMenuProps } from '../sofra/types';
import { AddButton, DishCard, GridSkeleton, MenuState, SearchField, useMenuModel } from './menuShared';
import { Photo, cssVars, isRtl, pad2, useReveal, useSahneNav } from './shared';
import './sahne.css';
import './sahne-menu.css';

export default function SahneMenuMobile(p: SofraMenuProps) {
  const m = useMenuModel(p);
  const { copy, t } = m;
  const nav = useSahneNav();
  const root = useRef<HTMLDivElement>(null);
  const chips = useRef<HTMLElement>(null);
  const reel = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLElement>(null);
  const [query, setQuery] = useState('');
  const editing = Boolean(p.onTextEdit);
  const brand = p.config.brandName || p.restaurant.name;
  const pickerOpen = Boolean(nav?.open);

  useReveal(root, [p.products, p.subgroups, p.groups, p.loading, m.home], editing);

  // Keep the active chip in view without moving the page itself.
  useLayoutEffect(() => {
    const strip = chips.current,
      active = strip?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!strip || !active) return;
    const a = active.getBoundingClientRect(),
      s = strip.getBoundingClientRect();
    strip.scrollLeft += a.left + a.width / 2 - (s.left + s.width / 2);
  }, [p.activeGroup, m.home, p.groups.length]);

  // Picks carousel: cards shrink and tilt away as they leave the centre.
  useEffect(() => {
    const strip = reel.current,
      view = strip?.ownerDocument.defaultView;
    if (!strip || !view) return;
    let frame = 0;
    const paint = () => {
      frame = 0;
      const box = strip.getBoundingClientRect(),
        mid = box.left + box.width / 2;
      strip.querySelectorAll<HTMLElement>('.sh-reel__card').forEach((card) => {
        const c = card.getBoundingClientRect();
        const d = Math.max(-1, Math.min(1, (c.left + c.width / 2 - mid) / box.width));
        card.style.setProperty('--d', d.toFixed(3));
        card.style.setProperty('--a', Math.abs(d).toFixed(3));
      });
    };
    const schedule = () => {
      if (!frame) frame = view.requestAnimationFrame(paint);
    };
    strip.addEventListener('scroll', schedule, { passive: true });
    view.addEventListener('resize', schedule);
    paint();
    return () => {
      view.cancelAnimationFrame(frame);
      strip.removeEventListener('scroll', schedule);
      view.removeEventListener('resize', schedule);
    };
  }, [m.home, p.loading, p.products.length]);

  // Category overlay: lock the page, trap focus, close with Escape.
  useEffect(() => {
    if (!pickerOpen) return;
    const doc = document.documentElement,
      prior = document.activeElement as HTMLElement | null,
      overflow = doc.style.overflow;
    doc.style.overflow = 'hidden';
    overlay.current?.querySelector<HTMLElement>('.sh-picker__close')?.focus();
    const keydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') nav?.setOpen(false);
      if (e.key !== 'Tab') return;
      const nodes = Array.from(
        overlay.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input') || [],
      );
      if (e.shiftKey && document.activeElement === nodes[0]) {
        e.preventDefault();
        nodes.at(-1)?.focus();
      } else if (!e.shiftKey && document.activeElement === nodes.at(-1)) {
        e.preventDefault();
        nodes[0]?.focus();
      }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      doc.style.overflow = overflow;
      document.removeEventListener('keydown', keydown);
      prior?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerOpen]);

  function choose(id: number | null) {
    nav?.setOpen(false);
    setQuery('');
    p.onGroupChange?.(id);
  }

  const needle = query.trim().toLocaleLowerCase(p.lang);
  const picker = [{ id: null as number | null, name: copy.picksLabel, imageUrl: null }, ...p.groups];
  const filtered = picker.filter((g) => g.name.toLocaleLowerCase(p.lang).includes(needle));

  const grid = (rows: SofraProduct[], lead: boolean) => (
    <div className="sh-grid">
      {rows.map((dish, i) => (
        <DishCard
          key={dish.id}
          dish={dish}
          index={i}
          lead={lead && i === 0 && rows.length > 2}
          t={t}
          onOpen={m.open}
          onAdd={p.onAdd}
        />
      ))}
    </div>
  );

  return (
    <div ref={root} className="sahne sh-menu sh-menu--mob" dir={isRtl(p.lang) ? 'rtl' : 'ltr'}>
      {m.wipe && (
        <div className="sh-wipe-in" aria-hidden="true">
          <span>{brand}</span>
        </div>
      )}
      <header className="sh-mbar">
        {/* Phone header: the logo alone; the name appears only when there is no logo. */}
        {p.restaurant.logoUrl ? (
          <span className="sh-mlogo">
            <Photo src={p.restaurant.logoUrl} alt={brand} eager />
          </span>
        ) : (
          <SofraBrand {...p} />
        )}
        <div className="sh-bar__tools">{p.headerTools}</div>
      </header>
      <div className="sh-msearch">
        <SearchField p={p} t={t} />
      </div>
      <nav className="sh-chips" ref={chips} aria-label={t.categories}>
        <button
          type="button"
          aria-current={m.home ? 'page' : undefined}
          onClick={() => choose(null)}
        >
          <Sparkles size={15} aria-hidden="true" />
          {copy.picksLabel}
        </button>
        {p.groups.map((g) => (
          <button
            type="button"
            key={g.id}
            aria-current={!m.searching && p.activeGroup === g.id ? 'page' : undefined}
            onClick={() => choose(g.id)}
          >
            {g.imageUrl && <Photo src={g.imageUrl} />}
            {g.name}
          </button>
        ))}
      </nav>
      <main className="sh-mstage">
        {p.beforeContent}
        {p.stories}
        {m.home ? (
          <>
            <div className="sh-mhead">
              <SofraText
                as="p"
                className="sh-kicker"
                field="menuEyebrow"
                value={copy.menuEyebrow}
                onTextEdit={p.onTextEdit}
              />
              <SofraText as="h1" field="menuTitle" value={copy.menuTitle} onTextEdit={p.onTextEdit} />
            </div>
            {(p.loading || p.error || m.count > 0 || editing) && (
              <section className="sh-picks">
                <div className="sh-section">
                  <SofraText
                    as="h2"
                    field="picksLabel"
                    value={copy.picksLabel}
                    onTextEdit={p.onTextEdit}
                  />
                  {!p.loading && m.count > 0 && <span>{pad2(m.count)}</span>}
                </div>
                {p.loading ? (
                  <div className="sh-reel" role="status" aria-label={t.loading}>
                    {[0, 1, 2].map((i) => (
                      <div className="sh-reel__card sh-skeleton" key={i} />
                    ))}
                  </div>
                ) : p.error ? (
                  <MenuState error={p.error} t={t} onRetry={p.onRetry} />
                ) : (
                  <div className="sh-reel" ref={reel}>
                    {p.products.map((dish, i) => (
                      <article
                        className={`sh-reel__card${dish.soldOut ? ' is-out' : ''}`}
                        key={dish.id}
                        data-dish
                      >
                        <button
                          type="button"
                          className="sh-reel__open"
                          aria-label={dish.name}
                          onClick={() => m.open(dish.id)}
                        >
                          <Photo src={dish.imageUrl} eager={i < 2} />
                        </button>
                        <div className="sh-reel__info">
                          <span className="sh-reel__n">{pad2(i + 1)}</span>
                          <h3>{dish.name}</h3>
                          <div>
                            <strong>{formatMoney(dish.price, dish.currency)}</strong>
                            {p.onAdd && <AddButton dish={dish} t={t} onAdd={p.onAdd} round />}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}
            {p.groups.length > 0 && (
              <section className="sh-cats">
                <div className="sh-section">
                  <h2>{t.categories}</h2>
                  <span>{pad2(p.groups.length)}</span>
                </div>
                <div className="sh-cats__list">
                  {p.groups.map((g, i) => (
                    <button
                      type="button"
                      className="sh-tile"
                      key={g.id}
                      data-reveal
                      style={cssVars({ '--i': i % 3 })}
                      onClick={() => choose(g.id)}
                    >
                      <Photo src={g.imageUrl} />
                      <span className="sh-tile__n">{pad2(i + 1)}</span>
                      <strong>{g.name}</strong>
                      <ArrowUpRight size={20} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : (
          <>
            <div className="sh-mhead" key={m.searching ? 'search' : p.activeGroup}>
              <p className="sh-kicker">
                {m.searching
                  ? t.results
                  : `${t.category} ${pad2(m.groupIndex + 1)} / ${pad2(p.groups.length)}`}
              </p>
              <h1>{m.searching ? `“${p.search?.trim()}”` : m.group?.name}</h1>
              {!p.loading && !p.error && <p className="sh-ghead__count">{t.items(m.count)}</p>}
            </div>
            <div
              className="sh-results"
              key={m.searching ? 'results' : `g${p.activeGroup}`}
              aria-busy={p.loading || undefined}
            >
              {p.loading ? (
                <GridSkeleton count={6} label={t.loading} />
              ) : p.error ? (
                <MenuState error={p.error} t={t} onRetry={p.onRetry} />
              ) : !m.count ? (
                <MenuState t={t} />
              ) : (
                <>
                  {p.products.length > 0 && grid(p.products, !m.searching)}
                  {p.subgroups?.map(
                    (g) =>
                      g.products.length > 0 && (
                        <section key={g.id}>
                          <h2 className="sh-subhead">
                            <span>{g.name}</span>
                            <i aria-hidden="true" />
                          </h2>
                          {grid(g.products, false)}
                        </section>
                      ),
                  )}
                </>
              )}
            </div>
          </>
        )}
        {p.afterContent}
        <footer className="sh-menu__foot">
          <SofraText field="footerText" value={copy.footerText} onTextEdit={p.onTextEdit} />
        </footer>
      </main>
      {pickerOpen && (
        <section
          ref={overlay}
          className="sh-picker"
          role="dialog"
          aria-modal="true"
          aria-label={t.categories}
        >
          <header>
            <div>
              <p className="sh-kicker">{t.explore}</p>
              <h2>{t.craving}</h2>
            </div>
            <button
              type="button"
              className="sh-picker__close"
              aria-label={t.close}
              onClick={() => nav?.setOpen(false)}
            >
              <X size={22} />
            </button>
          </header>
          {p.groups.length > 7 && (
            <label className="sh-search">
              <Search size={18} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.findCategory}
                aria-label={t.findCategory}
              />
            </label>
          )}
          <div className="sh-picker__list">
            {!filtered.length && (
              <p className="sh-state" role="status">
                {t.noCategory}
              </p>
            )}
            {filtered.map((g, i) => {
              const active = g.id == null ? m.home : !m.searching && p.activeGroup === g.id;
              return (
                <button
                  type="button"
                  key={g.id ?? 'picks'}
                  aria-pressed={active}
                  style={cssVars({ '--i': Math.min(i, 12) })}
                  onClick={() => choose(g.id)}
                >
                  <span className="sh-picker__thumb">
                    {g.id == null ? <Sparkles size={20} /> : <Photo src={g.imageUrl} />}
                  </span>
                  <span className="sh-picker__n">{pad2(picker.indexOf(g))}</span>
                  <strong>{g.name}</strong>
                  <ArrowUpRight size={20} aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
