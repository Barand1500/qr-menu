import { Check, Coffee, Search, Timer, Utensils } from 'lucide-react';
import type { GameCardId } from '@/pages/admin/GamesScreenPage';

export default function GameArtwork({ game }: { game: GameCardId }) {
  return (
    <div className={'ags-art ags-art--' + game} aria-hidden="true">
      {game === 'memory' && (
        <div className="ags-art__cards">
          <div className="ags-art__card ags-art__card--back">
            <Utensils />
          </div>
          <div className="ags-art__card ags-art__card--front">
            <Coffee />
            <span>Bir eş daha.</span>
          </div>
          <div className="ags-art__card ags-art__card--match">
            <Coffee />
            <Check size={15} />
          </div>
        </div>
      )}
      {game === 'xox' && (
        <div className="ags-art__board">
          {['X', 'O', '', '', 'X', 'O', 'O', '', 'X'].map((v, i) => (
            <span key={i} className={v === 'X' ? 'is-cross' : ''}>
              {v}
            </span>
          ))}
          <i />
        </div>
      )}
      {game === 'detective' && (
        <div className="ags-art__quiz">
          <Search className="ags-art__lens" size={54} strokeWidth={1.3} />
          <small>MASANIN MERAKLISI</small>
          <strong>Son kararın mı?</strong>
          <div>
            <span>A</span>
            <span>B</span>
            <span className="is-answer">
              <Check size={18} />
            </span>
            <span>D</span>
          </div>
        </div>
      )}
      {game === 'blitz' && (
        <div className="ags-art__ticket">
          <div>
            <Utensils size={20} />
            <span>MASA 08</span>
            <Timer size={20} />
          </div>
          <strong>Aklında kalsın.</strong>
          {['Biraz dikkat', 'Bir tutam hız', 'Tam isabet'].map((text, i) => (
            <p key={text}>
              <span>0{i + 1}</span>
              {text}
              <Check size={14} />
            </p>
          ))}
          <i />
        </div>
      )}
    </div>
  );
}
