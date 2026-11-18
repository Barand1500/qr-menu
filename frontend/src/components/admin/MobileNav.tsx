import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronUp, Search, X, type LucideIcon } from 'lucide-react';
import './mobile-nav.css';

export type MobileNavItem = { to: string; label: string; icon: LucideIcon; end?: boolean };
export type MobileNavSection = {
  id: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  /** Bölümün rengi (balon, kutucuk ve düğme vurgusu). */
  tone: string;
  items: MobileNavItem[];
};
export type MobileNavAction = {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  /** Küçük durum noktası: true = açık/yeşil. */
  on?: boolean;
};

const RADIUS = 116;

function isItemActive(pathname: string, item: MobileNavItem) {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const to = item.to.replace(/\/+$/, '') || '/';
  return item.end ? clean === to : clean === to || clean.startsWith(`${to}/`);
}

/**
 * Telefon gezinmesi: alt ortada yüzen "çark" düğmesi. Açılınca kategori balonları yay
 * biçiminde dizilir, seçilen kategorinin sayfaları üstte kutucuk olarak çıkar.
 * Masaüstünde görünmez (kenar çubuğu kullanılır).
 */
export default function MobileNav({
  sections,
  actions,
}: {
  sections: MobileNavSection[];
  actions: MobileNavAction[];
}) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState('');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [hidden, setHidden] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ y: number; id: number } | null>(null);

  const current = useMemo(
    () => sections.find((s) => s.items.some((i) => isItemActive(pathname, i))),
    [sections, pathname],
  );
  const currentItem = current?.items.find((i) => isItemActive(pathname, i));
  const multi = sections.filter((s) => s.items.length > 1);
  const pickedSection = sections.find((s) => s.id === picked) ?? multi[0];
  const FabIcon = current?.icon ?? sections[0].icon;
  const tone = current?.tone ?? 'var(--admin-accent)';

  const q = query.trim().toLocaleLowerCase('tr');
  const results = useMemo(
    () =>
      q
        ? sections.flatMap((s) =>
            s.items
              .filter(
                (i) =>
                  i.label.toLocaleLowerCase('tr').includes(q) ||
                  s.label.toLocaleLowerCase('tr').includes(q),
              )
              .map((i) => ({ item: i, section: s })),
          )
        : [],
    [q, sections],
  );

  function openNav() {
    setPicked(current && current.items.length > 1 ? current.id : multi[0]?.id ?? '');
    setQuery('');
    setSearching(false);
    setOpen(true);
  }
  function closeNav(restoreFocus = true) {
    setOpen(false);
    setSearching(false);
    setQuery('');
    if (panelRef.current) panelRef.current.style.transform = '';
    if (restoreFocus) fabRef.current?.focus({ preventScroll: true });
  }

  // Sayfa değişince kapan
  useEffect(() => {
    setOpen(false);
    setSearching(false);
    setQuery('');
    setHidden(false);
  }, [pathname]);

  // Açıkken: Escape ile kapan, arka plan kaymasın, odak panelde olsun
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeNav();
    };
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    const t = window.setTimeout(() => panelRef.current?.focus({ preventScroll: true }), 60);
    return () => {
      window.clearTimeout(t);
      document.documentElement.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Aşağı kaydırınca düğme saklanır, yukarı kaydırınca geri gelir (sayfa altındaki işlemleri örtmesin)
  useEffect(() => {
    const el = document.querySelector<HTMLElement>('main.admin-scroll');
    if (!el) return;
    let last = el.scrollTop;
    const onScroll = () => {
      const y = el.scrollTop;
      const atEnd = el.scrollHeight - el.clientHeight - y < 40;
      if (y < 60 || atEnd || y < last - 6) setHidden(false);
      else if (y > last + 8) setHidden(true);
      last = y;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  function pickSection(s: MobileNavSection) {
    navigator.vibrate?.(6);
    if (s.items.length === 1) return; // tek sayfalı bölüm bağlantı olarak çalışır
    setPicked(s.id);
  }

  // Tutamaçtan aşağı sürükleyerek kapatma (X ve Escape ayrıca var)
  function onGrabDown(e: React.PointerEvent) {
    drag.current = { y: e.clientY, id: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (panelRef.current) panelRef.current.style.transition = 'none';
  }
  function onGrabMove(e: React.PointerEvent) {
    if (!drag.current || !panelRef.current) return;
    const dy = Math.max(0, e.clientY - drag.current.y);
    panelRef.current.style.transform = `translateY(${dy}px)`;
  }
  function onGrabUp(e: React.PointerEvent) {
    if (!drag.current || !panelRef.current) return;
    const dy = e.clientY - drag.current.y;
    drag.current = null;
    panelRef.current.style.transition = '';
    if (dy > 90) closeNav();
    else panelRef.current.style.transform = '';
  }

  const n = sections.length;
  const showSearching = searching || q.length > 0;

  return (
    <div className={`mnav${open ? ' is-open' : ''}${showSearching ? ' is-searching' : ''}`}>
      <div className="mnav__backdrop" onClick={() => closeNav()} aria-hidden />

      <section
        ref={panelRef}
        className="mnav__panel"
        role="dialog"
        aria-modal="true"
        aria-label="Sayfa menüsü"
        aria-hidden={!open}
        tabIndex={-1}
      >
        <div
          className="mnav__grab"
          onPointerDown={onGrabDown}
          onPointerMove={onGrabMove}
          onPointerUp={onGrabUp}
          onPointerCancel={onGrabUp}
          aria-hidden
        >
          <span />
        </div>

        <div className="mnav__top">
          <label className="mnav__search">
            <Search size={18} aria-hidden />
            <input
              type="search"
              value={query}
              placeholder="Sayfa veya bölüm ara…"
              aria-label="Sayfa ara"
              enterKeyHint="go"
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setSearching(true)}
              onBlur={() => setSearching(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && results[0]) {
                  e.preventDefault();
                  (document.activeElement as HTMLElement | null)?.blur();
                  document.getElementById(`mnav-r-0`)?.click();
                }
              }}
            />
            {query ? (
              <button type="button" aria-label="Aramayı temizle" onClick={() => setQuery('')}>
                <X size={16} />
              </button>
            ) : null}
          </label>
          <button type="button" className="mnav__close" aria-label="Menüyü kapat" onClick={() => closeNav()}>
            <X size={20} />
          </button>
        </div>

        <div className="mnav__scroll">
          {q ? (
            <>
              <h2 className="mnav__title">
                <span>Sonuçlar</span>
                <small>{results.length} sayfa</small>
              </h2>
              {results.length === 0 ? (
                <p className="mnav__empty">“{query.trim()}” için sayfa bulunamadı.</p>
              ) : (
                <div className="mnav__grid">
                  {results.map(({ item, section }, i) => (
                    <Link
                      key={item.to}
                      id={`mnav-r-${i}`}
                      to={item.to}
                      className={`mnav__tile${isItemActive(pathname, item) ? ' is-current' : ''}`}
                      style={{ ['--tone' as string]: section.tone, ['--i' as string]: i }}
                    >
                      <span className="mnav__tile-icon">
                        <item.icon size={22} strokeWidth={1.8} />
                      </span>
                      <b>{item.label}</b>
                      <small>{section.label}</small>
                    </Link>
                  ))}
                </div>
              )}
            </>
          ) : pickedSection ? (
            <>
              <h2 className="mnav__title" style={{ ['--tone' as string]: pickedSection.tone }}>
                <span>
                  <pickedSection.icon size={18} aria-hidden /> {pickedSection.label}
                </span>
                <small>{pickedSection.hint}</small>
              </h2>
              <div className="mnav__grid" key={pickedSection.id}>
                {pickedSection.items.map((item, i) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`mnav__tile${isItemActive(pathname, item) ? ' is-current' : ''}`}
                    style={{ ['--tone' as string]: pickedSection.tone, ['--i' as string]: i }}
                    aria-current={isItemActive(pathname, item) ? 'page' : undefined}
                  >
                    <span className="mnav__tile-icon">
                      <item.icon size={22} strokeWidth={1.8} />
                    </span>
                    <b>{item.label}</b>
                  </Link>
                ))}
              </div>

              {actions.length > 0 ? (
                <>
                  <h3 className="mnav__sub">Hızlı işlemler</h3>
                  <div className="mnav__chips">
                    {actions.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => {
                          closeNav(false);
                          a.onClick();
                        }}
                      >
                        <a.icon size={17} aria-hidden />
                        {a.label}
                        {a.on !== undefined ? (
                          <i className={a.on ? 'is-on' : ''} aria-label={a.on ? 'Açık' : 'Kapalı'} />
                        ) : null}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </>
          ) : null}
        </div>

        {/* Yay: kategori balonları çark düğmesinin çevresine açılır */}
        <div className="mnav__dock" aria-hidden={showSearching}>
          <div className="mnav__origin" style={{ ['--r' as string]: `${RADIUS}px` }}>
            {sections.map((s, i) => {
              const angle = ((n === 1 ? 90 : 166 - (i * 152) / (n - 1)) * Math.PI) / 180;
              const x = Math.round(RADIUS * Math.cos(angle));
              const y = -Math.round(RADIUS * Math.sin(angle));
              const single = s.items.length === 1;
              const isPicked = !single && pickedSection?.id === s.id;
              const isHere = current?.id === s.id;
              const cls = `mnav__bubble${isPicked ? ' is-picked' : ''}${isHere ? ' is-here' : ''}`;
              const style = {
                ['--x' as string]: `${x}px`,
                ['--y' as string]: `${y}px`,
                ['--i' as string]: i,
                ['--tone' as string]: s.tone,
              };
              const inner = (
                <>
                  <s.icon size={20} strokeWidth={1.8} />
                  <span className="mnav__bubble-label">{s.label}</span>
                </>
              );
              return single ? (
                <Link
                  key={s.id}
                  to={s.items[0].to}
                  className={cls}
                  style={style}
                  tabIndex={open && !showSearching ? 0 : -1}
                  onClick={() => navigator.vibrate?.(6)}
                >
                  {inner}
                </Link>
              ) : (
                <button
                  key={s.id}
                  type="button"
                  className={cls}
                  style={style}
                  aria-pressed={isPicked}
                  tabIndex={open && !showSearching ? 0 : -1}
                  onClick={() => pickSection(s)}
                >
                  {inner}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <button
        ref={fabRef}
        type="button"
        className={`mnav__fab${hidden && !open ? ' is-hidden' : ''}`}
        style={{ ['--tone' as string]: tone }}
        aria-label={open ? 'Menüyü kapat' : 'Sayfa menüsünü aç'}
        aria-expanded={open}
        onClick={() => (open ? closeNav() : openNav())}
      >
        <span className="mnav__fab-icon">
          <FabIcon size={24} strokeWidth={1.9} className="mnav__fab-i1" />
          <X size={24} strokeWidth={2.2} className="mnav__fab-i2" />
        </span>
        <span className="mnav__fab-label">{currentItem?.label ?? current?.label ?? 'Menü'}</span>
        <ChevronUp size={18} className="mnav__fab-chev" aria-hidden />
      </button>
    </div>
  );
}
