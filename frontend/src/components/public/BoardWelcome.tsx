import { useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { imageUrl } from '@/lib/api';
import { catalogByCode } from '@/lib/languageCatalog';
import { welcomeUi } from '@/lib/welcomeUi';
import { preferenceUi, type DietaryPrefs } from '@/lib/dietAllergens';
import { catalogLabel, type PrefCatalog } from '@/lib/prefCatalog';
import '@/board-welcome.css';

function LeafIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 20c0-6 4-10 8-12-1 5-4 9-8 12Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M12 20c0-6-4-10-8-12 1 5 4 9 8 12Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M12 20V9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function CupIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 9h10v5.5a3.5 3.5 0 0 1-3.5 3.5h-3A3.5 3.5 0 0 1 6 14.5V9Z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path d="M16 10.5h1.8a2.2 2.2 0 0 1 0 4.4H16" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 19.5h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path
        d="M9 6.5c.4-.8.4-1.6 0-2.4M12 6.5c.4-.8.4-1.6 0-2.4M15 6.5c.4-.8.4-1.6 0-2.4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M2.5 6.2 5 8.7 9.5 3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M4 6.2 8 10l4-3.8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function nativeLangLabel(code: string, fallback: string) {
  return catalogByCode(code)?.nativeName || fallback || code;
}

export interface BoardWelcomeProps {
  restaurant: { name: string; logoUrl?: string | null };
  languages: { code: string; name: string }[];
  selectedLang: string;
  welcomeStep: 'lang' | 'prefs';
  dietaryPrefs: DietaryPrefs;
  prefCatalog: PrefCatalog;
  tableLabel?: string | null;
  campaignLabel?: string | null;
  musicOn: boolean;
  musicBlocked: boolean;
  musicLabel: string;
  entering: boolean;
  onToggleMusic: () => void;
  onPickLanguage: (code: string) => void;
  onBackToLang: () => void;
  onToggleAllergen: (id: string) => void;
  onToggleDiet: (id: string) => void;
  onContinue: () => void;
  onSkip: () => void;
}

export default function BoardWelcome({
  restaurant,
  languages,
  selectedLang,
  welcomeStep,
  dietaryPrefs,
  prefCatalog,
  tableLabel,
  campaignLabel,
  musicOn,
  musicBlocked,
  musicLabel,
  entering,
  onToggleMusic,
  onPickLanguage,
  onBackToLang,
  onToggleAllergen,
  onToggleDiet,
  onContinue,
  onSkip,
}: BoardWelcomeProps) {
  const t = welcomeUi(selectedLang);
  const prefUi = preferenceUi(selectedLang);
  const [openPanel, setOpenPanel] = useState<'allergens' | 'diets' | 'both'>(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 720px)').matches
      ? 'both'
      : 'allergens'
  );

  const allergenCount = dietaryPrefs.allergens.length;
  const dietCount = dietaryPrefs.diets.length;
  const allergensOpen = openPanel === 'allergens' || openPanel === 'both';
  const dietsOpen = openPanel === 'diets' || openPanel === 'both';

  function togglePanel(panel: 'allergens' | 'diets') {
    setOpenPanel((prev) => {
      // Desktop (both open possible): toggle independently via 'both'
      const wide = typeof window !== 'undefined' && window.matchMedia('(min-width: 720px)').matches;
      if (wide) {
        const aOpen = prev === 'allergens' || prev === 'both';
        const dOpen = prev === 'diets' || prev === 'both';
        const nextA = panel === 'allergens' ? !aOpen : aOpen;
        const nextD = panel === 'diets' ? !dOpen : dOpen;
        if (nextA && nextD) return 'both';
        if (nextA) return 'allergens';
        if (nextD) return 'diets';
        return panel;
      }
      // Mobile: one at a time
      return prev === panel ? panel : panel;
    });
  }

  return (
    <div
      className={`board-welcome${entering ? ' is-entering' : ''}`}
      data-theme-welcome="board"
    >
      <div className="board-welcome__texture" aria-hidden />
      <div className="board-welcome__vignette" aria-hidden />

      <button
        type="button"
        className={`board-welcome__music${musicBlocked && musicOn ? ' is-pulse' : ''}`}
        onClick={onToggleMusic}
        aria-label={musicOn ? t.musicAriaOn : t.musicAriaOff}
      >
        {musicOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        <span className="hidden sm:inline">{musicLabel}</span>
      </button>

      <div className="board-welcome__stage">
        {welcomeStep === 'lang' ? (
          <>
            <div className="board-welcome__logo-wrap">
              {restaurant.logoUrl ? (
                <img
                  src={imageUrl(restaurant.logoUrl)}
                  alt={restaurant.name}
                  className="board-welcome__logo"
                />
              ) : (
                <LeafIcon className="board-welcome__logo-fallback" />
              )}
            </div>

            <h1 className="board-welcome__title">{restaurant.name}</h1>

            {(tableLabel || campaignLabel) && (
              <div className="board-welcome__context">
                {tableLabel ? <span className="board-welcome__chip">{tableLabel}</span> : null}
                {campaignLabel ? (
                  <span className="board-welcome__chip">{campaignLabel}</span>
                ) : null}
              </div>
            )}

            <div className="board-welcome__divider" aria-hidden>
              <LeafIcon className="board-welcome__divider-icon" />
            </div>

            <div className="board-welcome__langs" role="list">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  role="listitem"
                  className={`board-welcome__lang${selectedLang === lang.code ? ' is-active' : ''}`}
                  onClick={() => onPickLanguage(lang.code)}
                >
                  {nativeLangLabel(lang.code, lang.name)}
                </button>
              ))}
            </div>

            <div className="board-welcome__footer-ornament" aria-hidden>
              <CupIcon className="board-welcome__cup" />
            </div>
          </>
        ) : (
          <div className="board-welcome__prefs">
            <button type="button" className="board-welcome__back" onClick={onBackToLang}>
              ←
            </button>

            <h2 className="board-welcome__prefs-title">{prefUi.title}</h2>
            <p className="board-welcome__prefs-hint">{prefUi.hint}</p>

            <div className="board-welcome__divider" aria-hidden>
              <LeafIcon className="board-welcome__divider-icon" />
            </div>

            <div className="board-welcome__accordion">
              <section
                className={`board-welcome__acc${allergensOpen ? ' is-open' : ''}`}
              >
                <button
                  type="button"
                  className="board-welcome__acc-head"
                  onClick={() => togglePanel('allergens')}
                  aria-expanded={allergensOpen}
                >
                  <span className="board-welcome__acc-title">{prefUi.avoidTitle}</span>
                  {allergenCount > 0 ? (
                    <span className="board-welcome__acc-count">{allergenCount}</span>
                  ) : null}
                  <ChevronIcon className="board-welcome__acc-chevron" />
                </button>
                {allergensOpen ? (
                  <div className="board-welcome__acc-body">
                    <div className="board-welcome__pills">
                      {prefCatalog.allergens.map((opt) => {
                        const active = dietaryPrefs.allergens.includes(opt.id);
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            className={`board-welcome__pill${active ? ' is-active' : ''}`}
                            onClick={() => onToggleAllergen(opt.id)}
                            aria-pressed={active}
                          >
                            <span className="board-welcome__check">
                              <CheckMark className="board-welcome__check-mark" />
                            </span>
                            <span>
                              {catalogLabel(prefCatalog, 'allergen', opt.id, selectedLang)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </section>

              <section className={`board-welcome__acc${dietsOpen ? ' is-open' : ''}`}>
                <button
                  type="button"
                  className="board-welcome__acc-head"
                  onClick={() => togglePanel('diets')}
                  aria-expanded={dietsOpen}
                >
                  <span className="board-welcome__acc-title">{prefUi.dietTitle}</span>
                  {dietCount > 0 ? (
                    <span className="board-welcome__acc-count">{dietCount}</span>
                  ) : null}
                  <ChevronIcon className="board-welcome__acc-chevron" />
                </button>
                {dietsOpen ? (
                  <div className="board-welcome__acc-body">
                    <div className="board-welcome__pills">
                      {prefCatalog.diets.map((opt) => {
                        const active = dietaryPrefs.diets.includes(opt.id);
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            className={`board-welcome__pill${active ? ' is-active' : ''}`}
                            onClick={() => onToggleDiet(opt.id)}
                            aria-pressed={active}
                          >
                            <span className="board-welcome__check">
                              <CheckMark className="board-welcome__check-mark" />
                            </span>
                            <span>
                              {catalogLabel(prefCatalog, 'diet', opt.id, selectedLang)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </section>
            </div>

            <div className="board-welcome__actions">
              <button type="button" className="board-welcome__enter" onClick={onContinue}>
                {prefUi.continue}
              </button>
              <button type="button" className="board-welcome__skip" onClick={onSkip}>
                {prefUi.skip}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
