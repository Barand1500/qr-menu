import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { getMenuGameGuestId } from '@/lib/menuGames';
import { resolveTableContext } from '@/lib/tableContext';

type XoxMark = 'X' | 'O';
type XoxCell = XoxMark | null;
type Room = {
  id: string;
  board: XoxCell[];
  turn: XoxMark;
  winner: XoxMark | 'draw' | null;
  waiting: boolean;
  yourMark: XoxMark | null;
  players: { mark: XoxMark; you: boolean }[];
};

export default function XoxGame({ slug, lang = 'tr' }: { slug: string; lang?: string }) {
  const en = (lang || 'tr').split('-')[0] === 'en';
  const guestId = useRef(getMenuGameGuestId()).current;
  const table = useRef(resolveTableContext()).current;
  const roomIdRef = useRef<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function join() {
    setBusy(true);
    setError('');
    try {
      const res = await api<{ ok: boolean; room: Room }>(`/api/menu/${slug}/games/xox/join`, {
        method: 'POST',
        body: JSON.stringify({
          guestId,
          tableNumber: table.masa,
          groupSlug: table.grup || undefined,
        }),
      });
      roomIdRef.current = res.room.id;
      setRoom(res.room);
    } catch (e) {
      setError(e instanceof Error ? e.message : en ? 'Could not join' : 'Katılınamadı');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void join();
    return () => {
      const id = roomIdRef.current;
      if (!id) return;
      void api(`/api/menu/${slug}/games/xox/${encodeURIComponent(id)}/leave`, {
        method: 'POST',
        body: JSON.stringify({ guestId }),
      }).catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    if (!room?.id) return;
    const t = window.setInterval(() => {
      void api<{ ok: boolean; room: Room }>(
        `/api/menu/${slug}/games/xox/${encodeURIComponent(room.id)}?guestId=${encodeURIComponent(guestId)}`
      )
        .then((res) => setRoom(res.room))
        .catch(() => undefined);
    }, 900);
    return () => window.clearInterval(t);
  }, [room?.id, slug, guestId]);

  async function move(cell: number) {
    if (!room || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await api<{ ok: boolean; room: Room }>(
        `/api/menu/${slug}/games/xox/${encodeURIComponent(room.id)}/move`,
        {
          method: 'POST',
          body: JSON.stringify({ guestId, cell }),
        }
      );
      setRoom(res.room);
    } catch (e) {
      setError(e instanceof Error ? e.message : en ? 'Move failed' : 'Hamle olmadı');
    } finally {
      setBusy(false);
    }
  }

  async function rematch() {
    if (!room) return;
    setBusy(true);
    try {
      const res = await api<{ ok: boolean; room: Room }>(
        `/api/menu/${slug}/games/xox/${encodeURIComponent(room.id)}/rematch`,
        {
          method: 'POST',
          body: JSON.stringify({ guestId }),
        }
      );
      setRoom(res.room);
    } catch (e) {
      setError(e instanceof Error ? e.message : en ? 'Rematch failed' : 'Tekrar başlamadı');
    } finally {
      setBusy(false);
    }
  }

  if (!table.masa) {
    return (
      <div className="menu-game-xox__msg">
        <p>
          {en
            ? 'Scan the table QR first so we can match you with the same table.'
            : 'Aynı masadaki kişiyle eşleşmek için önce masa QR’sini okutun.'}
        </p>
      </div>
    );
  }

  const status = !room
    ? en
      ? 'Connecting…'
      : 'Bağlanıyor…'
    : room.waiting
      ? en
        ? 'Waiting for someone at your table…'
        : 'Masadaki diğer kişi bekleniyor…'
      : room.winner === 'draw'
        ? en
          ? 'Draw!'
          : 'Berabere!'
        : room.winner
          ? room.yourMark === room.winner
            ? en
              ? 'You win!'
              : 'Kazandın!'
            : en
              ? 'You lost'
              : 'Kaybettin'
          : room.yourMark === room.turn
            ? en
              ? 'Your turn'
              : 'Sıra sende'
            : en
              ? 'Opponent’s turn'
              : 'Rakip oynuyor';

  return (
    <div className="menu-game-xox">
      <div className="menu-game-xox__bar">
        <span>
          {en ? 'Table' : 'Masa'} <strong>{table.masa}</strong>
          {room?.yourMark ? (
            <>
              {' '}
              · {en ? 'You' : 'Sen'}: <strong>{room.yourMark}</strong>
            </>
          ) : null}
        </span>
        <span className="menu-game-xox__status">{status}</span>
      </div>

      {error ? <p className="menu-game-xox__err">{error}</p> : null}

      <div className="menu-game-xox__board" role="grid" aria-label="XOX">
        {(room?.board || Array.from({ length: 9 }, () => null)).map((cell, i) => (
          <button
            key={i}
            type="button"
            className={`menu-game-xox__cell${cell ? ' has-mark' : ''}`}
            disabled={
              busy ||
              !room ||
              room.waiting ||
              Boolean(room.winner) ||
              cell != null ||
              room.yourMark !== room.turn
            }
            onClick={() => void move(i)}
          >
            {cell || ''}
          </button>
        ))}
      </div>

      <div className="menu-game-xox__actions">
        {room?.winner ? (
          <button type="button" className="menu-games__primary" onClick={() => void rematch()}>
            {en ? 'Play again' : 'Tekrar oyna'}
          </button>
        ) : null}
        <button type="button" className="menu-games__ghost" onClick={() => void join()} disabled={busy}>
          {en ? 'Rejoin' : 'Yeniden katıl'}
        </button>
      </div>
    </div>
  );
}
