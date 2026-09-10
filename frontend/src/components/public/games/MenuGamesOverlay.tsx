import { useEffect, useMemo, useState } from 'react';
import { Gamepad2, X } from 'lucide-react';
import MemoryGame from '@/components/public/games/MemoryGame';
import XoxGame from '@/components/public/games/XoxGame';
import {
  MENU_GAMES_CATALOG,
  type MenuGameId,
} from '@/lib/menuGames';

type Props = {
  open: boolean;
  onClose: () => void;
  slug: string;
  lang?: string;
  initialGame?: MenuGameId | null;
};

export default function MenuGamesOverlay({
  open,
  onClose,
  slug,
  lang = 'tr',
  initialGame = null,
}: Props) {
  const en = (lang || 'tr').split('-')[0] === 'en';
  const [active, setActive] = useState<MenuGameId | null>(initialGame);

  useEffect(() => {
    if (open) setActive(initialGame);
  }, [open, initialGame]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (active) setActive(null);
        else onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, active, onClose]);

  const title = useMemo(() => {
    if (!active) return en ? 'Games' : 'Oyunlar';
    const g = MENU_GAMES_CATALOG.find((x) => x.id === active);
    return g ? (en ? g.titleEn : g.titleTr) : en ? 'Games' : 'Oyunlar';
  }, [active, en]);

  if (!open) return null;

  return (
    <div className="menu-games" role="dialog" aria-modal="true" aria-labelledby="menu-games-title">
      <button type="button" className="menu-games__scrim" aria-label="Kapat" onClick={onClose} />
      <div className="menu-games__panel">
        <header className="menu-games__head">
          <div className="menu-games__head-icon">
            <Gamepad2 className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="menu-games__eyebrow">{en ? 'While you wait' : 'Beklerken'}</p>
            <h2 id="menu-games-title">{title}</h2>
          </div>
          <button
            type="button"
            className="menu-games__close"
            onClick={() => {
              if (active) setActive(null);
              else onClose();
            }}
            aria-label={en ? 'Close' : 'Kapat'}
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="menu-games__body">
          {!active ? (
            <div className="menu-games__grid">
              {MENU_GAMES_CATALOG.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className="menu-games__tile"
                  onClick={() => setActive(g.id)}
                >
                  <span className="menu-games__tile-badge">{en ? g.badgeEn : g.badgeTr}</span>
                  <strong>{en ? g.titleEn : g.titleTr}</strong>
                  <span>{en ? g.blurbEn : g.blurbTr}</span>
                </button>
              ))}
              <div className="menu-games__soon" aria-hidden>
                <strong>{en ? 'More soon' : 'Yakında'}</strong>
                <span>{en ? '4 more games coming' : '4 oyun daha eklenecek'}</span>
              </div>
            </div>
          ) : active === 'memory' ? (
            <MemoryGame lang={lang} />
          ) : (
            <XoxGame slug={slug} lang={lang} />
          )}
        </div>
      </div>
    </div>
  );
}
