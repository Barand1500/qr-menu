import { useEffect, useMemo, useState } from 'react';

const EMOJIS = ['🍕', '🍔', '🍣', '🍩', '🌮', '🥗', '🍜', '🍰'];

type Card = { id: number; emoji: string; flipped: boolean; matched: boolean };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck(): Card[] {
  const pairs = shuffle([...EMOJIS, ...EMOJIS]);
  return pairs.map((emoji, id) => ({ id, emoji, flipped: false, matched: false }));
}

export default function MemoryGame({ lang = 'tr' }: { lang?: string }) {
  const en = (lang || 'tr').split('-')[0] === 'en';
  const [cards, setCards] = useState<Card[]>(() => buildDeck());
  const [lock, setLock] = useState(false);
  const [moves, setMoves] = useState(0);
  const [startedAt] = useState(() => Date.now());
  const [wonAt, setWonAt] = useState<number | null>(null);

  const openIds = useMemo(
    () => cards.filter((c) => c.flipped && !c.matched).map((c) => c.id),
    [cards]
  );

  useEffect(() => {
    if (openIds.length !== 2) return;
    setLock(true);
    setMoves((m) => m + 1);
    const [a, b] = openIds;
    const ca = cards.find((c) => c.id === a)!;
    const cb = cards.find((c) => c.id === b)!;
    const match = ca.emoji === cb.emoji;
    const t = window.setTimeout(() => {
      setCards((prev) =>
        prev.map((c) => {
          if (c.id !== a && c.id !== b) return c;
          if (match) return { ...c, matched: true, flipped: true };
          return { ...c, flipped: false };
        })
      );
      setLock(false);
    }, match ? 280 : 650);
    return () => window.clearTimeout(t);
  }, [openIds.join(',')]);

  useEffect(() => {
    if (cards.length && cards.every((c) => c.matched) && wonAt == null) {
      setWonAt(Date.now());
    }
  }, [cards, wonAt]);

  function flip(id: number) {
    if (lock) return;
    setCards((prev) => {
      const card = prev.find((c) => c.id === id);
      if (!card || card.flipped || card.matched) return prev;
      const opened = prev.filter((c) => c.flipped && !c.matched).length;
      if (opened >= 2) return prev;
      return prev.map((c) => (c.id === id ? { ...c, flipped: true } : c));
    });
  }

  function reset() {
    setCards(buildDeck());
    setMoves(0);
    setWonAt(null);
    setLock(false);
  }

  const secs = wonAt ? Math.max(1, Math.round((wonAt - startedAt) / 1000)) : null;

  return (
    <div className="menu-game-memory">
      <div className="menu-game-memory__bar">
        <span>
          {en ? 'Moves' : 'Hamle'}: <strong>{moves}</strong>
        </span>
        {wonAt ? (
          <span className="menu-game-memory__win">
            {en ? `Done in ${secs}s` : `${secs} sn’de bitti`}
          </span>
        ) : (
          <span>{en ? 'Match the pairs' : 'Eşleri bul'}</span>
        )}
        <button type="button" onClick={reset}>
          {en ? 'Restart' : 'Yeniden'}
        </button>
      </div>
      <div className="menu-game-memory__board">
        {cards.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`menu-game-memory__card${c.flipped || c.matched ? ' is-open' : ''}${
              c.matched ? ' is-matched' : ''
            }`}
            onClick={() => flip(c.id)}
            disabled={lock || c.matched}
            aria-label={en ? 'Card' : 'Kart'}
          >
            <span className="menu-game-memory__face menu-game-memory__face--back">?</span>
            <span className="menu-game-memory__face menu-game-memory__face--front">{c.emoji}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
