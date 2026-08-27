import { useEffect, useRef, useState } from 'react';
import { X, Home, Info, Globe, Leaf, ChevronDown, Check } from 'lucide-react';
import PublicSocialLinks from '@/components/public/PublicSocialLinks';
import type { PublicSocialLink } from '@/lib/socialCatalog';
import { languageFlag } from '@/lib/languageFlags';
import {
  ALLERGEN_CATALOG,
  DIET_CATALOG,
  allergenLabel,
  dietLabel,
  preferenceUi,
  prefsActive,
  type DietaryPrefs,
} from '@/lib/dietAllergens';

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
}: PublicSideMenuProps) {
  const ui = preferenceUi(activeLang);
  const [langOpen, setLangOpen] = useState(false);
  const [allergyOpen, setAllergyOpen] = useState(() => prefsActive(dietaryPrefs));
  const langRef = useRef<HTMLDivElement>(null);

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

  return (
    <>
      <div
        className={`public-side-menu__backdrop ${open ? 'is-open' : ''}`}
        onClick={onClose}
        aria-hidden={!open}
      />

      <aside
        className={`public-side-menu ${open ? 'is-open' : ''}`}
        aria-hidden={!open}
        aria-label="Menü"
      >
        <div className="public-side-menu__header">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-white/60">Menü</p>
            <p className="font-semibold text-white truncate">{restaurantName}</p>
          </div>
          <button type="button" onClick={onClose} className="public-side-menu__close" aria-label="Kapat">
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
            Anasayfa
          </button>
          <button
            type="button"
            onClick={() => selectTab('about')}
            className={`public-side-menu__link ${tab === 'about' ? 'is-active' : ''}`}
          >
            <Info className="w-5 h-5" />
            Hakkımızda
          </button>
        </nav>

        <div className="public-side-menu__scroll">
          <div className="public-side-menu__section">
            <p className="public-side-menu__section-title">
              <Globe className="w-4 h-4" />
              Dil Seçimi
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
                  {languageFlag(activeLanguage?.code || activeLang)}
                </span>
                <span className="public-side-menu__lang-name">
                  {activeLanguage?.name || activeLang}
                </span>
                <ChevronDown className="public-side-menu__lang-chevron w-4 h-4" />
              </button>

              {langOpen && (
                <ul className="public-side-menu__lang-list" role="listbox" aria-label="Dil Seçimi">
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
                            {languageFlag(l.code)}
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
                    {ALLERGEN_CATALOG.map((opt) => {
                      const active = dietaryPrefs.allergens.includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => toggleAllergen(opt.id)}
                          className={`public-side-menu__allergy-chip${active ? ' is-active' : ''}`}
                          aria-pressed={active}
                        >
                          {allergenLabel(opt.id, activeLang)}
                        </button>
                      );
                    })}
                  </div>

                  <p className="public-side-menu__allergy-sub mt-3">{ui.dietTitle}</p>
                  <div className="public-side-menu__allergy-chips">
                    {DIET_CATALOG.map((opt) => {
                      const active = dietaryPrefs.diets.includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => toggleDiet(opt.id)}
                          className={`public-side-menu__allergy-chip public-side-menu__allergy-chip--diet${active ? ' is-active' : ''}`}
                          aria-pressed={active}
                        >
                          {dietLabel(opt.id, activeLang)}
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
            <PublicSocialLinks links={socialLinks} size="sm" />
          </div>
        )}
      </aside>
    </>
  );
}
