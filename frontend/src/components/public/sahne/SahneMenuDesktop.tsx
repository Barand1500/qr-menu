import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import { SofraBrand, SofraText } from '../sofra/SofraElements';
import type { SofraProduct } from '../sofra/SofraElements';
import type { SofraMenuProps } from '../sofra/types';
import { DishCard, GridSkeleton, MenuState, SearchField, useMenuModel } from './menuShared';
import {
  Photo,
  SplitText,
  cssVars,
  isRtl,
  pad2,
  prefersReducedMotion,
  useCardPointer,
  useReveal,
} from './shared';
import './sahne.css';
import './sahne-menu.css';

/** Home hero: the business's showcase photos, or the theme's menu photo when there are none. */
function Showcase({ p, menuTitle, menuEyebrow }: { p: SofraMenuProps; menuTitle: string; menuEyebrow: string }) {
  const editing = Boolean(p.onTextEdit);
  const slides = editing ? [] : (p.showcase || []).filter((item) => item.imageUrl);
  const [active, setActive] = useState(0);
  const current = slides[active % Math.max(1, slides.length)];
  useEffect(() => {
    if (slides.length < 2 || prefersReducedMotion()) return;
    const timer = setInterval(() => setActive((n) => (n + 1) % slides.length), 5200);
    return () => clearInterval(timer);
  }, [slides.length, active]);
  return (
    <section className="sh-show">
      <div className="sh-show__media">
        {slides.length ? (
          slides.map((item, i) => (
            <div key={item.id} className={item === current ? 'is-on' : undefined}>
              <Photo src={item.imageUrl} eager={i === 0} />
            </div>
          ))
        ) : (
          <div className="is-on">
            <Photo src={p.config.menuImage} eager />
          </div>
        )}
      </div>
      {p.onImageEdit && (
        <button type="button" className="sh-edit-photo" onClick={() => p.onImageEdit?.('menuImage')}>
          Fotoğrafı değiştir
        </button>
      )}
      <div className="sh-show__copy">
        <SofraText
          as="p"
          className="sh-kicker"
          field="menuEyebrow"
          value={menuEyebrow}
          onTextEdit={p.onTextEdit}
        />
        <SofraText as="h1" field="menuTitle" value={menuTitle} onTextEdit={p.onTextEdit} />
      </div>
      {current && (current.title1 || current.title2) && (
        <div className="sh-show__caption" key={current.id}>
          <strong>{current.title1}</strong>
          {current.title2 && <span>{current.title2}</span>}
        </div>
      )}
      {slides.length > 1 && (
        <div className="sh-show__dots">
          {slides.map((item, i) => (
            <button
              type="button"
              key={item.id}
              className={item === current ? 'is-on' : undefined}
              aria-label={`${i + 1} / ${slides.length}`}
              aria-current={item === current ? 'true' : undefined}
              onClick={() => setActive(i)}
            >
              <i />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export default function SahneMenuDesktop(p: SofraMenuProps) {
  const m = useMenuModel(p);
  const { copy, t } = m;
  const root = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const [peek, setPeek] = useState<string | null>(null);
  const editing = Boolean(p.onTextEdit);
  const brand = p.config.brandName || p.restaurant.name;

  useCardPointer(root, !editing);
  useReveal(root, [p.products, p.subgroups, p.groups, p.loading, m.home], editing);

  // "/" jumps to the search field, like a command palette.
  useEffect(() => {
    const view = root.current?.ownerDocument.defaultView;
    if (!view || editing) return;
    const keydown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (target?.closest('input, textarea, select, [contenteditable], [role="dialog"]')) return;
      e.preventDefault();
      searchInput.current?.focus();
    };
    view.addEventListener('keydown', keydown);
    return () => view.removeEventListener('keydown', keydown);
  }, [editing]);

  // The highlight slides to the active category and the list follows it.
  useLayoutEffect(() => {
    const nav = rail.current;
    if (!nav) return;
    const active = nav.querySelector<HTMLElement>('[aria-current="page"]');
    nav.style.setProperty('--top', `${active?.offsetTop ?? 0}px`);
    nav.style.setProperty('--h', `${active?.offsetHeight ?? 0}px`);
    if (!active) return;
    if (active.offsetTop < nav.scrollTop) nav.scrollTop = active.offsetTop - 12;
    else if (active.offsetTop + active.offsetHeight > nav.scrollTop + nav.clientHeight)
      nav.scrollTop = active.offsetTop + active.offsetHeight - nav.clientHeight + 12;
  }, [p.activeGroup, p.groups, p.lang, copy.picksLabel]);

  const grid = (rows: SofraProduct[]) => (
    <div className="sh-grid">
      {rows.map((dish, i) => (
        <DishCard key={dish.id} dish={dish} index={i} t={t} onOpen={m.open} onAdd={p.onAdd} />
      ))}
    </div>
  );

  return (
    <div ref={root} className="sahne sh-menu sh-menu--desk" dir={isRtl(p.lang) ? 'rtl' : 'ltr'}>
      {m.wipe && (
        <div className="sh-wipe-in" aria-hidden="true">
          <span>{brand}</span>
        </div>
      )}
      <header className="sh-bar">
        <SofraBrand {...p} />
        <SearchField p={p} t={t} inputRef={searchInput} hint="/" />
        <div className="sh-bar__tools">{p.headerTools}</div>
      </header>
      <div className="sh-layout">
        <aside className="sh-rail">
          <p className="sh-kicker">{t.categories}</p>
          <nav
            ref={rail}
            aria-label={t.categories}
            onPointerMove={(e) =>
              e.currentTarget.parentElement?.style.setProperty('--peek-y', `${e.clientY}px`)
            }
            onPointerLeave={() => setPeek(null)}
          >
            <i className="sh-rail__pill" aria-hidden="true" />
            <button
              type="button"
              aria-current={m.home ? 'page' : undefined}
              onClick={() => p.onGroupChange?.(null)}
              onPointerEnter={() => setPeek(null)}
            >
              <span className="sh-rail__n">
                <Sparkles size={14} />
              </span>
              <span className="sh-rail__name">{copy.picksLabel}</span>
            </button>
            {p.groups.map((g, i) => (
              <button
                type="button"
                key={g.id}
                aria-current={!m.searching && p.activeGroup === g.id ? 'page' : undefined}
                onClick={() => p.onGroupChange?.(g.id)}
                onPointerEnter={() => setPeek(g.imageUrl || null)}
              >
                <span className="sh-rail__n">{pad2(i + 1)}</span>
                <span className="sh-rail__name">{g.name}</span>
              </button>
            ))}
          </nav>
          <div className={`sh-peek${peek ? ' is-on' : ''}`} aria-hidden="true">
            {peek && <Photo key={peek} src={peek} eager />}
          </div>
        </aside>
        <main className="sh-stage">
          {p.beforeContent}
          {m.home ? (
            <Showcase p={p} menuTitle={copy.menuTitle} menuEyebrow={copy.menuEyebrow} />
          ) : (
            <section className="sh-ghead" key={m.searching ? 'head-search' : `head-${p.activeGroup}`}>
              {!m.searching && m.group && (
                <div className="sh-ghead__ghost" aria-hidden="true">
                  <span>{Array.from({ length: 6 }, () => m.group?.name).join(' ✦ ')}</span>
                </div>
              )}
              <div className="sh-ghead__copy">
                <p className="sh-kicker">
                  {m.searching
                    ? t.results
                    : `${t.category} ${pad2(m.groupIndex + 1)} / ${pad2(p.groups.length)}`}
                </p>
                {m.searching ? (
                  <h1>“{p.search?.trim()}”</h1>
                ) : (
                  <h1 aria-label={m.group?.name}>
                    <SplitText text={m.group?.name || ''} />
                  </h1>
                )}
                {!p.loading && !p.error && <p className="sh-ghead__count">{t.items(m.count)}</p>}
              </div>
              {!m.searching && m.group?.imageUrl && (
                <div className="sh-ghead__img">
                  <Photo src={m.group.imageUrl} eager />
                </div>
              )}
            </section>
          )}
          {p.stories}
          {m.home && (m.count > 0 || p.loading || editing) && (
            <div className="sh-section">
              <SofraText as="h2" field="picksLabel" value={copy.picksLabel} onTextEdit={p.onTextEdit} />
              {!p.loading && m.count > 0 && <span>{t.items(m.count)}</span>}
            </div>
          )}
          <div
            className="sh-results"
            key={m.searching ? 'search' : (p.activeGroup ?? 'home')}
            aria-busy={p.loading || undefined}
          >
            {p.loading ? (
              <GridSkeleton label={t.loading} />
            ) : p.error ? (
              <MenuState error={p.error} t={t} onRetry={p.onRetry} />
            ) : !m.count ? (
              !m.home && <MenuState t={t} />
            ) : (
              <>
                {p.products.length > 0 && grid(p.products)}
                {p.subgroups?.map(
                  (g) =>
                    g.products.length > 0 && (
                      <section key={g.id}>
                        <h2 className="sh-subhead">
                          <span>{g.name}</span>
                          <i aria-hidden="true" />
                        </h2>
                        {grid(g.products)}
                      </section>
                    ),
                )}
              </>
            )}
          </div>
          {m.home && p.groups.length > 0 && (
            <section className="sh-cats">
              <div className="sh-section">
                <h2>{t.allCategories}</h2>
                <span>{pad2(p.groups.length)}</span>
              </div>
              <div className="sh-cats__grid">
                {p.groups.map((g, i) => (
                  <button
                    type="button"
                    className="sh-tile"
                    key={g.id}
                    data-reveal
                    style={cssVars({ '--i': i % 4 })}
                    onClick={() => p.onGroupChange?.(g.id)}
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
          {p.afterContent}
          <footer className="sh-menu__foot">
            <SofraText field="footerText" value={copy.footerText} onTextEdit={p.onTextEdit} />
          </footer>
        </main>
      </div>
    </div>
  );
}
