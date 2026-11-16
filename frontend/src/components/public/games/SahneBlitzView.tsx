import { ArrowRight, Check, Clock3, RotateCcw, CheckCheck } from 'lucide-react';
import { gamesUi } from '@/lib/menuGamesUi';
import type { BlitzProduct } from './BlitzGame';
import SahneActivityArt from '../sahne/SahneActivityArt';
import './sahne-blitz.css';

type Props = {
  lang: string;
  phase: 'intro' | 'memorize' | 'recall' | 'result';
  seconds: number;
  order: BlitzProduct[];
  options: BlitzProduct[];
  picked: string[];
  score: number;
  onStart: () => void;
  onToggle: (id: string) => void;
  onSubmit: () => void;
};

export default function SahneBlitzView({
  lang,
  phase,
  seconds,
  order,
  options,
  picked,
  score,
  onStart,
  onToggle,
  onSubmit,
}: Props) {
  const ui = gamesUi(lang);
  const en = !lang.startsWith('tr');
  const perfect = score === order.length && picked.length === order.length;
  return (
    <div className={`menu-blitz sh-blitz sh-blitz--${phase}`}>
      {phase === 'intro' ? (
        <div className="menu-blitz__hero sh-blitz__intro">
          <div>
            <p className="menu-blitz__kicker">
              {en ? 'A LITTLE MEMORY TEST' : 'KÜÇÜK BİR HAFIZA TESTİ'}
            </p>
            <h3>
              {en ? 'The order' : 'Sipariş'}
              <br />
              <i>{en ? 'is yours.' : 'sende.'}</i>
            </h3>
            <p>
              {en
                ? 'Five seconds to remember the ticket. Then pick what was on it.'
                : 'Fişe bakmak için beş saniyen var. Sonra içindekileri hatırla ve seç.'}
            </p>
            <button
              type="button"
              className="menu-games__primary"
              onClick={onStart}
            >
              {ui.blitzStart}
              <ArrowRight size={19} />
            </button>
          </div>
          <div className="sh-blitz__art" aria-hidden="true">
            <SahneActivityArt kind="blitz" />
          </div>
        </div>
      ) : phase === 'result' ? (
        <div className="menu-blitz__result sh-blitz__result">
          <span className="sh-blitz__result-mark">
            <CheckCheck size={34} strokeWidth={1.4} />
          </span>
          <p className="menu-blitz__kicker">
            {perfect
              ? ui.blitzPerfect
              : en
                ? 'TICKET CHECKED'
                : 'FİŞ KONTROL EDİLDİ'}
          </p>
          <strong>{ui.blitzScore(score, order.length)}</strong>
          <p>
            {perfect
              ? en
                ? 'Not a single item left behind.'
                : 'Tek bir kalem bile gözünden kaçmadı.'
              : en
                ? 'A little practice makes a sharp memory.'
                : 'Bir tur daha, belki bu kez hepsi aklında kalır.'}
          </p>
          <button
            type="button"
            className="menu-games__primary"
            onClick={onStart}
          >
            <RotateCcw size={18} />
            {ui.blitzAgain}
          </button>
        </div>
      ) : (
        <>
          <div className="menu-blitz__top">
            <div>
              <p className="menu-blitz__kicker">
                {phase === 'memorize'
                  ? en
                    ? '01 / TAKE A LOOK'
                    : '01 / AKLINDA TUT'
                  : en
                    ? '02 / YOUR TURN'
                    : '02 / SIRA SENDE'}
              </p>
              <strong>
                {phase === 'memorize' ? ui.blitzMemorize : ui.blitzRecall}
              </strong>
              {phase === 'recall' && (
                <p className="menu-blitz__hint">{ui.blitzPick}</p>
              )}
            </div>
            {phase === 'memorize' ? (
              <span
                className="menu-blitz__timer"
                role="timer"
                aria-label={ui.blitzTime(seconds)}
              >
                <Clock3 size={17} />
                {ui.blitzTime(seconds)}
              </span>
            ) : (
              <span className="menu-blitz__count">
                {picked.length}
                <i>/ {order.length}</i>
              </span>
            )}
          </div>
          {phase === 'memorize' ? (
            <>
              <div className="sh-blitz__time-track" aria-hidden="true">
                <span style={{ transform: `scaleX(${seconds / 5})` }} />
              </div>
              <div className="sh-blitz__ticket">
                <header>
                  <span>{en ? 'ORDER TICKET' : 'SİPARİŞ FİŞİ'}</span>
                  <span>
                    {String(order.length).padStart(2, '0')}{' '}
                    {en ? 'ITEMS' : 'KALEM'}
                  </span>
                </header>
                <ol className="menu-blitz__order">
                  {order.map((item, i) => (
                    <li key={item.id} data-product-id={item.id}>
                      <em>{String(i + 1).padStart(2, '0')}</em>
                      <span>{item.name}</span>
                    </li>
                  ))}
                </ol>
                <footer>
                  {en
                    ? 'The ticket will disappear. Keep it in mind.'
                    : 'Birazdan bu fişi kapatacağız. Aklında kalsın.'}
                </footer>
              </div>
            </>
          ) : (
            <>
              <div className="menu-blitz__grid">
                {options.map((item) => {
                  const on = picked.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      data-product-id={item.id}
                      type="button"
                      className={`menu-blitz__chip${on ? ' is-on' : ''}`}
                      aria-pressed={on}
                      onClick={() => onToggle(item.id)}
                    >
                      <span className="sh-blitz__check" aria-hidden="true">
                        {on && <Check size={16} />}
                      </span>
                      <span>{item.name}</span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className="menu-games__primary sh-blitz__confirm"
                disabled={!picked.length}
                onClick={onSubmit}
              >
                {ui.blitzConfirm}
                <ArrowRight size={18} />
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
