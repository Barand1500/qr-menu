import { useEffect, useMemo, useState } from 'react';
import { imageUrl } from '@/lib/api';
import type { MemoryPair, MemoryPairCount } from '@/lib/menuGamesConfig';

const EMOJIS = ['🍕', '🍔', '🍣', '🍩', '🌮', '🥗', '🍜', '🍰'];

type Face = { key: string; kind: 'emoji' | 'image'; emoji?: string; src?: string };

type Card = {
  id: number;
  face: Face;
  flipped: boolean;
  matched: boolean;
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildFaces(pairCount: MemoryPairCount, pairs: MemoryPair[]): Face[] {
  const custom = pairs.slice(0, pairCount).flatMap((p, i) => {
    const key = `pair-${p.id || i}`;
    return [
      { key, kind: 'image' as const, src: p.imageA },
      { key, kind: 'image' as const, src: p.imageB },
    ];
  });
  if (custom.length >= pairCount * 2) return custom.slice(0, pairCount * 2);

  const need = pairCount - Math.floor(custom.length / 2);
  const emojiFaces = EMOJIS.slice(0, need).flatMap((emoji) => {
    const key = `emoji-${emoji}`;
    return [
      { key, kind: 'emoji' as const, emoji },
      { key, kind: 'emoji' as const, emoji },
    ];
  });
  return [...custom, ...emojiFaces].slice(0, pairCount * 2);
}

function buildDeck(pairCount: MemoryPairCount, pairs: MemoryPair[]): Card[] {
  return shuffle(buildFaces(pairCount, pairs)).map((face, id) => ({
    id,
    face,
    flipped: false,
    matched: false,
  }));
}

type Props = {
  lang?: string;
  pairCount?: MemoryPairCount;
  pairs?: MemoryPair[];
};

export default function MemoryGame({
  lang = 'tr',
  pairCount = 6,
  pairs = [],
}: Props) {
  const en = (lang || 'tr').split('-')[0] === 'en';
  const [cards, setCards] = useState<Card[]>(() => buildDeck(pairCount, pairs));
  const [lock, setLock] = useState(false);
  const [moves, setMoves] = useState(0);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [wonAt, setWonAt] = useState<number | null>(null);

  useEffect(() => {
    setCards(buildDeck(pairCount, pairs));
    setMoves(0);
    setWonAt(null);
    setLock(false);
    setStartedAt(Date.now());
  }, [pairCount, pairs]);

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
    const match = ca.face.key === cb.face.key;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setCards(buildDeck(pairCount, pairs));
    setMoves(0);
    setWonAt(null);
    setLock(false);
    setStartedAt(Date.now());
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
      <div
        className={`menu-game-memory__board menu-game-memory__board--${pairCount}`}
      >
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
            <span className="menu-game-memory__face menu-game-memory__face--front">
              {c.face.kind === 'image' && c.face.src ? (
                <img src={imageUrl(c.face.src)} alt="" />
              ) : (
                c.face.emoji
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
