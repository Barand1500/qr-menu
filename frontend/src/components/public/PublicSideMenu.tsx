import { useEffect, useRef, useState } from 'react';
import { X, Home, Info, Globe, Leaf, ChevronDown, Check, Gamepad2 } from 'lucide-react';
import PublicSocialLinks from '@/components/public/PublicSocialLinks';
import type { PublicSocialLink } from '@/lib/socialCatalog';
import LanguageFlag from '@/components/LanguageFlag';
import {
  preferenceUi,
  prefsActive,
  type DietaryPrefs,
} from '@/lib/dietAllergens';
import { catalogLabel, loadPrefCatalogSession, resolvePrefCatalog } from '@/lib/prefCatalog';
import { sideMenuUi } from '@/lib/menuChromeUi';
import { MENU_GAMES_CATALOG, enabledMenuGames, type MenuGameId } from '@/lib/menuGames';
import type { PublicMenuGames } from '@/lib/menuGamesConfig';

export type PublicTab = 'home' | 'about' | 'settings';

interface Language {
  code: string;
  name: string;
}

interface PublicSideMenuProps {
  open: boolean;
  tab: PublicTab;
  restaurantName: string;
  languages: Language[];
  activeLang: string;
  socialLinks?: PublicSocialLink[];
  dietaryPrefs?: DietaryPrefs;
  onClose: () => void;
  onTab: (tab: PublicTab) => void;
  onLangChange: (code: string) => void;
  onDietaryPrefsChange?: (prefs: DietaryPrefs) => void;
  gamesEnabled?: boolean;
  gamesConfig?: PublicMenuGames | boolean | null;
  gamesPromo?: boolean;
  onGamesPromoDismiss?: () => void;
  onOpenGames?: (game?: MenuGameId) => void;
}

export default function PublicSideMenu({
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
}: PublicSideMenuProps) {
  const ui = preferenceUi(activeLang);
  const chrome = sideMenuUi(activeLang);
  const prefCatalog = resolvePrefCatalog(loadPrefCatalogSession());
  const [langOpen, setLangOpen] = useState(false);
  const [allergyOpen, setAllergyOpen] = useState(() => prefsActive(dietaryPrefs));
  const langRef = useRef<HTMLDivElement>(null);
  const en = (activeLang || 'tr').split('-')[0] === 'en';
  const gameIds = enabledMenuGames(gamesConfig ?? (gamesEnabled ? true : false));
  const gameCards = MENU_GAMES_CATALOG.filter((g) => gameIds.includes(g.id));

  const activeLanguage = languages.find((l) => l.code === activeLang) || languages[0];
  const prefCount = dietaryPrefs.allergens.length + dietaryPrefs.diets.length;

  useEffect(() => {
    if (!open) setLangOpen(false);
  }, [open]);

  useEffect(() => {
    if (!langOpen) return;
    function onDoc(e: MouseEvent) {
      if (!langRef.current?.contains(e.target as Node)) setLangOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [langOpen]);

  function selectTab(next: PublicTab) {
    onTab(next);
    onClose();
  }

  function toggleAllergen(id: string) {
    if (!onDietaryPrefsChange) return;
    const allergens = dietaryPrefs.allergens.includes(id)
      ? dietaryPrefs.allergens.filter((x) => x !== id)
      : [...dietaryPrefs.allergens, id];
    onDietaryPrefsChange({ ...dietaryPrefs, allergens });
  }

  function toggleDiet(id: string) {
    if (!onDietaryPrefsChange) return;
    let diets = dietaryPrefs.diets.includes(id)
      ? dietaryPrefs.diets.filter((x) => x !== id)
      : [...dietaryPrefs.diets, id];
    if (id === 'vegan' && !dietaryPrefs.diets.includes('vegan')) {
      if (!diets.includes('vegetarian')) diets = [...diets, 'vegetarian'];
    }
    onDietaryPrefsChange({ ...dietaryPrefs, diets });
  }

  function openGame(id?: MenuGameId) {
    onGamesPromoDismiss?.();
    onClose();
    onOpenGames?.(id);
  }

  return (
    <>
      <div
        className={`public-side-menu__backdrop ${open ? 'is-open' : ''}`}
        onClick={() => {
          onGamesPromoDismiss?.();
          onClose();
        }}
        aria-hidden={!open}
      />

      <aside
        className={`public-side-menu ${open ? 'is-open' : ''}`}
        aria-hidden={!open}
        aria-label={chrome.menu}
      >
        <div className="public-side-menu__header">
          <div className="min-w-0">
            <p className="public-side-menu__eyebrow">{chrome.menu}</p>
            <p className="public-side-menu__brand truncate">{restaurantName}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              onGamesPromoDismiss?.();
              onClose();
            }}
            className="public-side-menu__close"
            aria-label={chrome.close}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="public-side-menu__nav">
          <button
            type="button"
            onClick={() => selectTab('home')}
            className={`public-side-menu__link ${tab === 'home' ? 'is-active' : ''}`}
          >
            <Home className="w-5 h-5" />
            {chrome.home}
          </button>
          <button
            type="button"
            onClick={() => selectTab('about')}
            className={`public-side-menu__link ${tab === 'about' ? 'is-active' : ''}`}
          >
            <Info className="w-5 h-5" />
            {chrome.about}
          </button>
        </nav>

        <div className="public-side-menu__scroll">
          {gamesEnabled && gameCards.length > 0 ? (
            <div className="public-side-menu__section public-side-menu__games">
              <p className="public-side-menu__section-title">
                <Gamepad2 className="w-4 h-4" />
                {chrome.games}
              </p>

              {gamesPromo ? (
                <div className="public-side-menu__games-promo">
                  <p>{chrome.gamesPromo}</p>
                  <div className="public-side-menu__games-promo-list">
                    {gameCards.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        className="public-side-menu__games-promo-item"
                        onClick={() => openGame(g.id)}
                      >
                        <span className="public-side-menu__games-ok" aria-hidden>
                          <Check className="w-3.5 h-3.5" strokeWidth={2.75} />
                        </span>
                        <span className="min-w-0">
                          <strong>{en ? g.titleEn : g.titleTr}</strong>
                          <small>{en ? g.blurbEn : g.blurbTr}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="public-side-menu__games-grid">
                  {gameCards.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      className="public-side-menu__game-card"
                      onClick={() => openGame(g.id)}
                    >
                      <span className="public-side-menu__games-ok is-quiet" aria-hidden>
                        <Check className="w-3 h-3" strokeWidth={2.75} />
                      </span>
                      <em>{en ? g.badgeEn : g.badgeTr}</em>
                      <strong>{en ? g.titleEn : g.titleTr}</strong>
                      <span>{en ? g.blurbEn : g.blurbTr}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          <div className="public-side-menu__section">
            <p className="public-side-menu__section-title">
              <Globe className="w-4 h-4" />
              {chrome.lang}
            </p>

            <div className="public-side-menu__lang-combo" ref={langRef}>
              <button
                type="button"
                className={`public-side-menu__lang-trigger${langOpen ? ' is-open' : ''}`}
                aria-haspopup="listbox"
                aria-expanded={langOpen}
                onClick={() => setLangOpen((v) => !v)}
              >
                <span className="public-side-menu__lang-flag" aria-hidden>
                  <LanguageFlag code={activeLanguage?.code || activeLang} size={18} />
                </span>
                <span className="public-side-menu__lang-name">
                  {activeLanguage?.name || activeLang}
                </span>
                <ChevronDown className="public-side-menu__lang-chevron w-4 h-4" />
              </button>

              {langOpen && (
                <ul className="public-side-menu__lang-list" role="listbox" aria-label={chrome.lang}>
                  {languages.map((l) => {
                    const selected = activeLang === l.code;
                    return (
                      <li key={l.code} role="option" aria-selected={selected}>
                        <button
                          type="button"
                          className={`public-side-menu__lang-option${selected ? ' is-active' : ''}`}
                          onClick={() => {
                            onLangChange(l.code);
                            setLangOpen(false);
                            onClose();
                          }}
                        >
                          <span className="public-side-menu__lang-flag" aria-hidden>
                            <LanguageFlag code={l.code} size={18} />
                          </span>
                          <span className="public-side-menu__lang-name">{l.name}</span>
                          {selected ? <Check className="w-4 h-4 shrink-0 opacity-90" /> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {onDietaryPrefsChange && (
            <div className="public-side-menu__section public-side-menu__allergy">
              <button
                type="button"
                className={`public-side-menu__accordion${allergyOpen ? ' is-open' : ''}`}
                aria-expanded={allergyOpen}
                onClick={() => setAllergyOpen((v) => !v)}
              >
                <span className="public-side-menu__accordion-left">
                  <Leaf className="w-4 h-4 shrink-0" />
                  <span className="public-side-menu__accordion-text">
                    <strong>{ui.sideTitle}</strong>
                    <span>{ui.hint}</span>
                  </span>
                </span>
                <span className="public-side-menu__accordion-right">
                  {prefCount > 0 && (
                    <span className="public-side-menu__accordion-badge">{prefCount}</span>
                  )}
                  <ChevronDown className="public-side-menu__accordion-chevron w-4 h-4" />
                </span>
              </button>

              {allergyOpen && (
                <div className="public-side-menu__accordion-body">
                  <p className="public-side-menu__allergy-sub">{ui.avoidTitle}</p>
                  <div className="public-side-menu__allergy-chips">
                    {prefCatalog.allergens.map((opt) => {
                      const active = dietaryPrefs.allergens.includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => toggleAllergen(opt.id)}
                          className={`public-side-menu__allergy-chip${active ? ' is-active' : ''}`}
                          aria-pressed={active}
                        >
                          {catalogLabel(prefCatalog, 'allergen', opt.id, activeLang)}
                        </button>
                      );
                    })}
                  </div>

                  <p className="public-side-menu__allergy-sub mt-3">{ui.dietTitle}</p>
                  <div className="public-side-menu__allergy-chips">
                    {prefCatalog.diets.map((opt) => {
                      const active = dietaryPrefs.diets.includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => toggleDiet(opt.id)}
                          className={`public-side-menu__allergy-chip public-side-menu__allergy-chip--diet${active ? ' is-active' : ''}`}
                          aria-pressed={active}
                        >
                          {catalogLabel(prefCatalog, 'diet', opt.id, activeLang)}
                        </button>
                      );
                    })}
                  </div>

                  {prefCount > 0 && (
                    <button
                      type="button"
                      className="public-side-menu__allergy-clear"
                      onClick={() => onDietaryPrefsChange({ allergens: [], diets: [] })}
                    >
                      {ui.clear}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {socialLinks.length > 0 && (
          <div className="public-side-menu__social mt-auto px-0 pb-1 pt-3">
            <PublicSocialLinks links={socialLinks} />
          </div>
        )}
      </aside>
    </>
  );
}
