import { useEffect, useMemo, useState } from 'react';
import { gamesUi } from '@/lib/menuGamesUi';

export type BlitzProduct = {
  id: string;
  name: string;
  imageUrl?: string | null;
};

const FALLBACK: BlitzProduct[] = [
  { id: 'f1', name: 'Pizza' },
  { id: 'f2', name: 'Burger' },
  { id: 'f3', name: 'Pasta' },
  { id: 'f4', name: 'Salad' },
  { id: 'f5', name: 'Soup' },
  { id: 'f6', name: 'Steak' },
  { id: 'f7', name: 'Sushi' },
  { id: 'f8', name: 'Dessert' },
  { id: 'f9', name: 'Coffee' },
  { id: 'f10', name: 'Juice' },
  { id: 'f11', name: 'Wrap' },
  { id: 'f12', name: 'Fries' },
];

type Phase = 'intro' | 'memorize' | 'recall' | 'result';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Props = {
  lang?: string;
  products?: BlitzProduct[];
};

export default function BlitzGame({ lang = 'tr', products = [] }: Props) {
  const ui = gamesUi(lang);
  const pool = useMemo(() => {
    const fromMenu = products.filter((p) => p.name?.trim()).slice(0, 24);
    return fromMenu.length >= 6 ? fromMenu : FALLBACK;
  }, [products]);

  const [phase, setPhase] = useState<Phase>('intro');
  const [order, setOrder] = useState<BlitzProduct[]>([]);
  const [options, setOptions] = useState<BlitzProduct[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [seconds, setSeconds] = useState(5);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (phase !== 'memorize') return;
    setSeconds(5);
    const tick = window.setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          window.clearInterval(tick);
          setPhase('recall');
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(tick);
  }, [phase, order]);

  function start() {
    const targetCount = Math.min(4, Math.max(3, Math.floor(pool.length / 3)));
    const shuffled = shuffle(pool);
    const target = shuffled.slice(0, targetCount);
    const decoys = shuffled.slice(targetCount, targetCount + Math.max(4, targetCount + 2));
    const mixed = shuffle([...target, ...decoys]).slice(0, Math.min(8, target.length + decoys.length));
    setOrder(target);
    setOptions(mixed.length >= target.length + 2 ? mixed : shuffle([...target, ...FALLBACK]).slice(0, 8));
    setPicked([]);
    setScore(0);
    setPhase('memorize');
  }

  function toggle(id: string) {
    if (phase !== 'recall') return;
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function submit() {
    const want = new Set(order.map((o) => o.id));
    const ok = picked.filter((id) => want.has(id)).length;
    const falsePos = picked.filter((id) => !want.has(id)).length;
    setScore(Math.max(0, ok - falsePos));
    setPhase('result');
  }

  if (phase === 'intro') {
    return (
      <div className="menu-blitz">
        <div className="menu-blitz__hero">
          <p className="menu-blitz__kicker">{ui.blitz.badge}</p>
          <h3>{ui.blitz.title}</h3>
          <p>{ui.blitz.blurb}</p>
          <button type="button" className="menu-games__primary" onClick={start}>
            {ui.blitzStart}
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'memorize') {
    return (
      <div className="menu-blitz">
        <div className="menu-blitz__top">
          <strong>{ui.blitzMemorize}</strong>
          <span className="menu-blitz__timer">{ui.blitzTime(seconds)}</span>
        </div>
        <ul className="menu-blitz__order">
          {order.map((item, i) => (
            <li key={item.id}>
              <em>{i + 1}</em>
              <span>{item.name}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (phase === 'result') {
    const perfect = score === order.length && picked.length === order.length;
    return (
      <div className="menu-blitz menu-blitz--end">
        <div className="menu-blitz__result">
          <p className="menu-blitz__kicker">{perfect ? ui.blitzPerfect : ui.blitzScore(score, order.length)}</p>
          <strong>{ui.blitzScore(score, order.length)}</strong>
          <button type="button" className="menu-games__primary" onClick={start}>
            {ui.blitzAgain}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="menu-blitz">
      <div className="menu-blitz__top">
        <div>
          <strong>{ui.blitzRecall}</strong>
          <p className="menu-blitz__hint">{ui.blitzPick}</p>
        </div>
        <span className="menu-blitz__count">
          {picked.length}/{order.length}
        </span>
      </div>
      <div className="menu-blitz__grid">
        {options.map((item) => {
          const on = picked.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              className={`menu-blitz__chip${on ? ' is-on' : ''}`}
              onClick={() => toggle(item.id)}
            >
              {item.name}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="menu-games__primary"
        disabled={picked.length === 0}
        onClick={submit}
      >
        {ui.blitzConfirm}
      </button>
    </div>
  );
}
