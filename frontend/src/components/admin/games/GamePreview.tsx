import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import MemoryGame from '@/components/public/games/MemoryGame';
import DetectiveGame from '@/components/public/games/DetectiveGame';
import BlitzGame from '@/components/public/games/BlitzGame';
import type { MenuGamesConfig } from '@/lib/menuGamesConfig';
import type { GameCardId } from '@/pages/admin/GamesScreenPage';
import '@/menu-games.css';

function LocalXox() {
  const [cells, setCells] = useState<string[]>(Array(9).fill(''));
  const [turn, setTurn] = useState('X');
  const winner = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ].find(
    ([a, b, c]) => cells[a] && cells[a] === cells[b] && cells[a] === cells[c],
  );
  const done = Boolean(winner) || cells.every(Boolean);
  return (
    <div className="ags-xox">
      <p>
        Denemede iki tarafı da siz oynarsınız. Müşteriler aynı masa üzerinden
        eşleşir.
      </p>
      <strong role="status">
        {winner
          ? cells[winner[0]] + ' kazandı.'
          : done
            ? 'Berabere.'
            : 'Sıra: ' + turn}
      </strong>
      <div>
        {cells.map((value, i) => (
          <button
            key={i}
            disabled={done || Boolean(value)}
            aria-label={i + 1 + '. kare' + (value ? ': ' + value : '')}
            onClick={() => {
              setCells((c) => c.map((v, j) => (j === i ? turn : v)));
              setTurn((t) => (t === 'X' ? 'O' : 'X'));
            }}
          >
            {value}
          </button>
        ))}
      </div>
      <button
        className="ags-xox__reset"
        onClick={() => {
          setCells(Array(9).fill(''));
          setTurn('X');
        }}
      >
        <RotateCcw size={16} /> Yeniden
      </button>
    </div>
  );
}

export default function GamePreview({
  game,
  config,
}: {
  game: GameCardId;
  config: MenuGamesConfig;
}) {
  if (game === 'memory')
    return (
      <MemoryGame
        pairCount={config.memory.pairCount}
        pairs={config.memory.pairs}
      />
    );
  if (game === 'detective')
    return <DetectiveGame adminQuestions={config.detective.questions} />;
  if (game === 'xox') return <LocalXox />;
  return (
    <>
      <p className="ags-demo-note">
        Denemede örnek ürünler kullanılır; müşteri menüsünde kendi ürünleriniz
        görünür.
      </p>
      <BlitzGame />
    </>
  );
}
