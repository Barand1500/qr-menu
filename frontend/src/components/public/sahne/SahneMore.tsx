import { useEffect, useId, useRef, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Globe2,
  Layers3,
  Leaf,
  Search,
  Sparkles,
  Timer,
  Utensils,
  X,
} from 'lucide-react';
import type { PublicSideMenuProps } from '../PublicSideMenu';
import PublicSocialLinks from '../PublicSocialLinks';
import LanguageFlag from '@/components/LanguageFlag';
import { useSheetFocus } from '../sofra/SofraSheet';
import { preferenceUi } from '@/lib/dietAllergens';
import {
  catalogLabel,
  loadPrefCatalogSession,
  resolvePrefCatalog,
} from '@/lib/prefCatalog';
import { sideMenuUi } from '@/lib/menuChromeUi';
import {
  MENU_GAMES_CATALOG,
  enabledMenuGames,
  type MenuGameId,
} from '@/lib/menuGames';
import { gameCatalogEntry, gamesUi } from '@/lib/menuGamesUi';
import './sahne-more.css';

type View = 'explore' | 'language' | 'preferences';

/** A small restaurant intermission, with utilities on their own page. */
export default function SahneMore({
  open,
  tab,
  restaurantName,
  languages,
  activeLang,
  socialLinks = [],
  dietaryPrefs = { allergens: [], diets: [] },
  onClose,
  onTab,
  onLangChange,
  onDietaryPrefsChange,
  gamesEnabled = false,
  gamesConfig,
  gamesPromo = false,
  onGamesPromoDismiss,
  onOpenGames,
  onAssistant,
}: PublicSideMenuProps) {
  const [view, setView] = useState<View>('explore');
  const [hoveredGame, setHoveredGame] = useState<MenuGameId | null>(null);
  const viewRef = useRef<HTMLElement>(null);
  const returnRef = useRef<HTMLButtonElement | null>(null);
  const wasOpen = useRef(open);
  const titleId = useId();
  const en = !activeLang.toLowerCase().startsWith('tr');
  const chrome = sideMenuUi(activeLang);
  const ui = preferenceUi(activeLang);
  const gameUi = gamesUi(activeLang);
  const prefCatalog = resolvePrefCatalog(loadPrefCatalogSession());
  const prefCount = dietaryPrefs.allergens.length + dietaryPrefs.diets.length;
  const activeLanguage =
    languages.find((l) => l.code === activeLang) || languages[0];
  const enabledGames = enabledMenuGames(gamesConfig ?? gamesEnabled);
  const games = gamesEnabled
    ? MENU_GAMES_CATALOG.filter((g) => enabledGames.includes(g.id))
    : [];

  const close = () => {
    onGamesPromoDismiss?.();
    onClose();
  };
  const panelRef = useSheetFocus(open, () =>
    view === 'explore' ? close() : setView('explore'),
  );

  useEffect(() => {
    if (open && !wasOpen.current) setView('explore');
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (view !== 'explore') viewRef.current?.scrollTo(0, 0);
    const frame = requestAnimationFrame(() => {
      if (view === 'explore') returnRef.current?.focus({ preventScroll: true });
      else viewRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [view, open]);

  function utility(next: View, target: HTMLButtonElement) {
    returnRef.current = target;
    setView(next);
  }
  function navigate(next: 'home' | 'about') {
    onTab(next);
    close();
  }
  function openGame(id: MenuGameId) {
    close();
    onOpenGames?.(id);
  }
  function toggle(id: string, kind: 'allergens' | 'diets') {
    const existing = dietaryPrefs[kind];
    const values = existing.includes(id)
      ? existing.filter((x) => x !== id)
      : [...existing, id];
    if (
      kind === 'diets' &&
      id === 'vegan' &&
      !existing.includes(id) &&
      !values.includes('vegetarian')
    ) {
      values.push('vegetarian');
    }
    onDietaryPrefsChange?.({ ...dietaryPrefs, [kind]: values });
  }

  return (
    <>
      <div
        className={`sh-interlude-shade ${open ? 'is-open' : ''}`}
        onClick={close}
        aria-hidden="true"
      />
      <aside
        ref={panelRef}
        tabIndex={-1}
        inert={!open}
        role={open ? 'dialog' : undefined}
        aria-modal={open ? true : undefined}
        aria-hidden={!open}
        aria-labelledby={titleId}
        className={`sh-interlude ${open ? 'is-open' : ''}`}
      >
        <header className="sh-interlude__head">
          <span className="sh-interlude__brand">
            <Utensils size={18} />
            <span>{restaurantName}</span>
          </span>
          <span className="sh-interlude__edition">
            {en ? 'A LITTLE INTERMISSION' : 'SOHBETE KÜÇÜK BİR ARA'}
          </span>
          <button
            className="sh-interlude__close"
            onClick={close}
            aria-label={chrome.close}
          >
            <X size={22} />
          </button>
        </header>

        <main
          ref={viewRef}
          tabIndex={-1}
          className="sh-interlude__body"
          key={view}
        >
          {view === 'explore' ? (
            <div className="sh-interlude__explore">
              <button
                className="sh-interlude__assistant"
                onClick={() => {
                  close();
                  if (onAssistant) onAssistant();
                  else onTab('home');
                }}
                aria-label={onAssistant ? 'Ne yesem?' : chrome.home}
              >
                <span className="sh-interlude__eyebrow">
                  <Sparkles size={15} />
                  {onAssistant
                    ? 'SANA GÖRE BİR ŞEY VAR'
                    : en
                      ? 'GOOD THINGS AWAIT'
                      : 'SOFRADA GÜZEL ŞEYLER VAR'}
                </span>
                <span className="sh-interlude__feature-title" id={titleId}>
                  {onAssistant ? (
                    <>
                      Ne <i>yesem?</i>
                    </>
                  ) : en ? (
                    <>
                      Enjoy <i>your stay.</i>
                    </>
                  ) : (
                    <>
                      Keyfine <i>bak.</i>
                    </>
                  )}
                </span>
                <span className="sh-interlude__feature-note">
                  {onAssistant
                    ? 'Sen biraz kendinden bahset. Gerisini bize bırak.'
                    : en
                      ? 'Discover what is on the menu.'
                      : 'Güzel bir lezzetle devam edelim.'}
                </span>
                <span className="sh-interlude__plate" aria-hidden="true">
                  <span className="sh-interlude__plate-ring" />
                  <Utensils className="sh-interlude__cutlery" strokeWidth={1} />
                  <Sparkles className="sh-interlude__spark sh-interlude__spark--one" />
                  <Sparkles className="sh-interlude__spark sh-interlude__spark--two" />
                  <span className="sh-interlude__plate-word">
                    {onAssistant ? 'SANA ÖZEL' : 'BON APPÉTIT'}
                  </span>
                </span>
                <span className="sh-interlude__feature-cta">
                  <span>{onAssistant ? 'Birlikte bulalım' : chrome.home}</span>
                  <ArrowUpRight size={24} />
                </span>
              </button>

              <section className="sh-interlude__right" aria-label={chrome.menu}>
                <div className="sh-interlude__navigation">
                  <p className="sh-interlude__eyebrow">
                    {en ? 'WHERE TO?' : 'NEREYE BAKALIM?'}
                  </p>
                  <button
                    className="sh-interlude__nav"
                    onClick={() => navigate('home')}
                    aria-current={tab === 'home' ? 'page' : undefined}
                  >
                    <small>01</small>
                    <span>{chrome.home}</span>
                    <ArrowUpRight />
                  </button>
                  <button
                    className="sh-interlude__nav"
                    onClick={() => navigate('about')}
                    aria-current={tab === 'about' ? 'page' : undefined}
                  >
                    <small>02</small>
                    <span>{chrome.about}</span>
                    <ArrowUpRight />
                  </button>
                </div>

                {games.length > 0 && (
                  <section
                    className="sh-interlude__games"
                    aria-label={gameUi.games}
                  >
                    <div className="sh-interlude__games-heading">
                      <p className="sh-interlude__eyebrow">{gameUi.games}</p>
                      <span>
                        {en
                          ? 'A little friendly competition.'
                          : 'Masaya biraz eğlence.'}
                      </span>
                      <ArrowDownLeft size={19} />
                    </div>
                    {gamesPromo && (
                      <p className="sh-interlude__promo" role="status">
                        {gameUi.gamesPromo}
                      </p>
                    )}
                    <div
                      className="sh-interlude__game-shelf"
                      onPointerLeave={() => setHoveredGame(null)}
                    >
                      {games.map((g) => {
                        const entry = gameCatalogEntry(g.id, activeLang);
                        return (
                          <button
                            key={g.id}
                            className={`sh-interlude__game sh-interlude__game--${g.id}`}
                            onClick={() => openGame(g.id)}
                            onPointerEnter={() => setHoveredGame(g.id)}
                            onFocus={() => setHoveredGame(g.id)}
                            onBlur={() => setHoveredGame(null)}
                            aria-label={`${entry.title} — ${entry.blurb}`}
                          >
                            <span
                              className="sh-interlude__game-object"
                              aria-hidden="true"
                            >
                              {g.id === 'memory' ? (
                                <>
                                  <Layers3 />
                                  <span className="sh-interlude__mini-star">
                                    ✳
                                  </span>
                                </>
                              ) : g.id === 'xox' ? (
                                <span className="sh-interlude__xox">
                                  ×<i>○</i>
                                </span>
                              ) : g.id === 'detective' ? (
                                <Search />
                              ) : (
                                <Timer />
                              )}
                            </span>
                            <strong>{entry.title}</strong>
                            <small>{entry.badge}</small>
                          </button>
                        );
                      })}
                    </div>
                    <p
                      className="sh-interlude__game-caption"
                      aria-hidden="true"
                    >
                      {hoveredGame
                        ? gameCatalogEntry(hoveredGame, activeLang).blurb
                        : en
                          ? 'Pick a game. Make yourself at home.'
                          : 'Bir oyun seç. Masanın keyfini çıkar.'}
                    </p>
                  </section>
                )}
              </section>
            </div>
          ) : (
            <section className="sh-interlude__utility-page">
              <button
                className="sh-interlude__back"
                onClick={() => setView('explore')}
              >
                <ArrowLeft size={18} />
                {chrome.menu}
              </button>
              <div className="sh-interlude__page-heading">
                <span className="sh-interlude__page-icon">
                  {view === 'language' ? <Globe2 /> : <Leaf />}
                </span>
                <h2 id={titleId}>
                  {view === 'language' ? chrome.lang : ui.sideTitle}
                </h2>
              </div>
              {view === 'language' ? (
                <div
                  className="sh-interlude__languages"
                  role="group"
                  aria-label={chrome.lang}
                >
                  {languages.map((l, i) => (
                    <button
                      key={l.code}
                      className={`sh-interlude__language ${l.code === activeLang ? 'is-active' : ''}`}
                      onClick={() => {
                        onLangChange(l.code);
                        close();
                      }}
                      aria-pressed={l.code === activeLang}
                    >
                      <small>{String(i + 1).padStart(2, '0')}</small>
                      <LanguageFlag code={l.code} size={28} />
                      <strong>{l.name}</strong>
                      {l.code === activeLang ? (
                        <Check size={20} />
                      ) : (
                        <ArrowUpRight size={20} />
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  <p className="sh-interlude__hint">{ui.hint}</p>
                  {(['allergens', 'diets'] as const).map((kind) => (
                    <fieldset className="sh-interlude__preferences" key={kind}>
                      <legend>
                        {kind === 'allergens' ? ui.avoidTitle : ui.dietTitle}
                      </legend>
                      <div>
                        {prefCatalog[kind].map((opt) => (
                          <button
                            key={opt.id}
                            className={`sh-interlude__preference ${dietaryPrefs[kind].includes(opt.id) ? 'is-active' : ''}`}
                            aria-pressed={dietaryPrefs[kind].includes(opt.id)}
                            onClick={() => toggle(opt.id, kind)}
                          >
                            <span>
                              {catalogLabel(
                                prefCatalog,
                                kind === 'allergens' ? 'allergen' : 'diet',
                                opt.id,
                                activeLang,
                              )}
                            </span>
                            <span className="sh-interlude__selection">
                              {dietaryPrefs[kind].includes(opt.id) ? (
                                <Check size={14} />
                              ) : (
                                '+'
                              )}
                            </span>
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                  <div className="sh-interlude__preference-actions">
                    {prefCount > 0 && (
                      <button
                        className="sh-interlude__clear"
                        onClick={() =>
                          onDietaryPrefsChange?.({ allergens: [], diets: [] })
                        }
                      >
                        {ui.clear}
                      </button>
                    )}
                    <button
                      className="sh-interlude__done"
                      onClick={() => setView('explore')}
                    >
                      {en ? 'Done' : 'Tamam'}
                      <ArrowRight size={18} />
                    </button>
                  </div>
                </>
              )}
            </section>
          )}
        </main>

        <footer className="sh-interlude__foot">
          <div className="sh-interlude__tools">
            <button
              className={`sh-interlude__tool ${view === 'language' ? 'is-active' : ''}`}
              onClick={(e) =>
                utility(
                  view === 'language' ? 'explore' : 'language',
                  e.currentTarget,
                )
              }
              aria-expanded={view === 'language'}
            >
              <LanguageFlag
                code={activeLanguage?.code || activeLang}
                size={20}
              />
              <span>{activeLanguage?.name || activeLang}</span>
              <ArrowUpRight size={15} />
            </button>
            {onDietaryPrefsChange && (
              <button
                className={`sh-interlude__tool ${view === 'preferences' ? 'is-active' : ''}`}
                onClick={(e) =>
                  utility(
                    view === 'preferences' ? 'explore' : 'preferences',
                    e.currentTarget,
                  )
                }
                aria-expanded={view === 'preferences'}
              >
                <Leaf size={18} />
                <span>{ui.sideTitle}</span>
                {prefCount > 0 ? (
                  <b>{prefCount}</b>
                ) : (
                  <ArrowUpRight size={15} />
                )}
              </button>
            )}
          </div>
          {socialLinks.length > 0 && <PublicSocialLinks links={socialLinks} />}
          <span className="sh-interlude__signature">
            {en ? 'Stay for the good moments.' : 'Lezzet bahane, keyif şahane.'}
          </span>
        </footer>
      </aside>
    </>
  );
}
