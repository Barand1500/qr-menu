import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Gamepad2,
  Layers3,
  Search,
  Timer,
  X,
} from 'lucide-react';
import { useSheetFocus } from '../sofra/SofraSheet';
import '../sahne/sahne-entertainment.css';
import BlitzGame, {
  type BlitzProduct,
} from '@/components/public/games/BlitzGame';
import DetectiveGame from '@/components/public/games/DetectiveGame';
import MemoryGame from '@/components/public/games/MemoryGame';
import XoxGame from '@/components/public/games/XoxGame';
import {
  enabledMenuGames,
  MENU_GAMES_CATALOG,
  type MenuGameId,
} from '@/lib/menuGames';
import { gameCatalogEntry, gamesUi } from '@/lib/menuGamesUi';
import type { PublicMenuGames } from '@/lib/menuGamesConfig';

type Props = {
  sahne?: boolean;
  open: boolean;
  onClose: () => void;
  slug: string;
  lang?: string;
  initialGame?: MenuGameId | null;
  gamesConfig?: PublicMenuGames | boolean | null;
  products?: BlitzProduct[];
};

export default function MenuGamesOverlay({
  open,
  sahne = false,
  onClose,
  slug,
  lang = 'tr',
  initialGame = null,
  gamesConfig,
  products = [],
}: Props) {
  const ui = gamesUi(lang);
  const enabled = useMemo(() => enabledMenuGames(gamesConfig), [gamesConfig]);
  const [active, setActive] = useState<MenuGameId | null>(initialGame);

  useEffect(() => {
    if (!open) return;
    if (initialGame && enabled.includes(initialGame)) setActive(initialGame);
    else setActive(null);
  }, [open, initialGame, enabled]);

  const panelRef = useSheetFocus(open, () =>
    active ? setActive(null) : onClose(),
  );
  useEffect(() => {
    if (open) panelRef.current?.focus({ preventScroll: true });
  }, [active, open, panelRef]);

  const catalog = MENU_GAMES_CATALOG.filter((g) => enabled.includes(g.id));

  const title = useMemo(() => {
    if (!active) return ui.title;
    return gameCatalogEntry(active, lang).title;
  }, [active, lang, ui.title]);

  const cfg =
    typeof gamesConfig === 'object' && gamesConfig ? gamesConfig : null;
  const memoryPairs = cfg?.memory?.pairs || [];
  const pairCount = cfg?.memory?.pairCount || 6;
  const detectiveQuestions = cfg?.detective?.questions || [];

  if (!open) return null;

  return (
    <div
      className={`menu-games${sahne ? ' sh-games' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="menu-games-title"
    >
      <button
        type="button"
        className="menu-games__scrim"
        aria-label={ui.close}
        onClick={onClose}
      />
      <section ref={panelRef} tabIndex={-1} className="menu-games__panel">
        <header className="menu-games__head">
          {sahne && active && (
            <button
              type="button"
              className="sh-games__back"
              onClick={() => setActive(null)}
              aria-label={ui.title}
            >
              <ArrowLeft size={21} />
            </button>
          )}
          <div className="menu-games__head-icon">
            <Gamepad2 className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="menu-games__eyebrow">{ui.eyebrow}</p>
            <h2 id="menu-games-title">{title}</h2>
          </div>
          <button
            type="button"
            className="menu-games__close"
            onClick={() => {
              if (active && !sahne) setActive(null);
              else onClose();
            }}
            aria-label={ui.close}
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="menu-games__body" key={active || 'catalog'}>
          {sahne && !active && (
            <div className="sh-games__intro">
              <h3>
                {lang.startsWith('tr') ? (
                  <>
                    Masada <i>oyun var.</i>
                  </>
                ) : (
                  <>
                    Time to <i>play.</i>
                  </>
                )}
              </h3>
              <p>
                {lang.startsWith('tr')
                  ? 'Tek başına bir rekor. Ya da masada küçük bir rekabet.'
                  : 'A solo challenge. Or a little friendly competition.'}
              </p>
            </div>
          )}
          {!active ? (
            <div className="menu-games__grid">
              {catalog.map((g) => {
                const entry = gameCatalogEntry(g.id, lang);
                return (
                  <button
                    key={g.id}
                    type="button"
                    className={`menu-games__tile sh-games__tile--${g.id}`}
                    onClick={() => setActive(g.id)}
                  >
                    {sahne && (
                      <span className="sh-games__art" aria-hidden="true">
                        {g.id === 'memory' ? (
                          <Layers3 />
                        ) : g.id === 'xox' ? (
                          <span className="sh-games__xox">
                            ×<i>○</i>
                          </span>
                        ) : g.id === 'detective' ? (
                          <Search />
                        ) : (
                          <Timer />
                        )}
                        <i className="sh-games__art-orbit" />
                      </span>
                    )}
                    <span className="menu-games__tile-ok" aria-hidden>
                      <Check className="w-3.5 h-3.5" strokeWidth={2.75} />
                    </span>
                    <span className="menu-games__tile-badge">
                      {entry.badge}
                    </span>
                    <strong>{entry.title}</strong>
                    <span>{entry.blurb}</span>
                    {sahne && (
                      <ArrowUpRight
                        className="sh-games__arrow"
                        size={20}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
              {sahne && !catalog.length && (
                <p>
                  {lang.startsWith('tr')
                    ? 'Oyunlar şu an kapalı.'
                    : 'Games are currently unavailable.'}
                </p>
              )}
            </div>
          ) : active === 'memory' ? (
            <MemoryGame lang={lang} pairCount={pairCount} pairs={memoryPairs} />
          ) : active === 'xox' ? (
            <XoxGame slug={slug} lang={lang} />
          ) : active === 'detective' ? (
            <DetectiveGame lang={lang} adminQuestions={detectiveQuestions} />
          ) : (
            <BlitzGame lang={lang} products={products} />
          )}
        </div>
      </section>
    </div>
  );
}
