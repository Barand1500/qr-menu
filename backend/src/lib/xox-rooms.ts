export type XoxMark = 'X' | 'O';
export type XoxCell = XoxMark | null;
export type XoxWinner = XoxMark | 'draw' | null;

export type XoxPlayer = {
  id: string;
  mark: XoxMark;
  joinedAt: number;
};

export type XoxRoom = {
  id: string;
  restaurantId: number;
  tableKey: string;
  players: XoxPlayer[];
  board: XoxCell[];
  turn: XoxMark;
  winner: XoxWinner;
  updatedAt: number;
};

const rooms = new Map<string, XoxRoom>();
const ROOM_TTL_MS = 1000 * 60 * 90;

function purgeStale() {
  const now = Date.now();
  for (const [id, room] of rooms) {
    if (now - room.updatedAt > ROOM_TTL_MS) rooms.delete(id);
  }
}

export function tableGameKey(tableNumber: string, groupSlug?: string | null) {
  return `${String(tableNumber).trim()}::${(groupSlug || '').trim().toLowerCase()}`;
}

function emptyBoard(): XoxCell[] {
  return Array.from({ length: 9 }, () => null);
}

function checkWinner(board: XoxCell[]): XoxWinner {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];
  for (const [a, b, c] of lines) {
    const v = board[a];
    if (v && v === board[b] && v === board[c]) return v;
  }
  if (board.every((c) => c != null)) return 'draw';
  return null;
}

function publicRoom(room: XoxRoom, guestId: string) {
  const me = room.players.find((p) => p.id === guestId) || null;
  return {
    id: room.id,
    tableKey: room.tableKey,
    board: room.board,
    turn: room.turn,
    winner: room.winner,
    players: room.players.map((p) => ({
      mark: p.mark,
      you: p.id === guestId,
    })),
    yourMark: me?.mark ?? null,
    waiting: room.players.length < 2,
    updatedAt: room.updatedAt,
  };
}

export function joinXoxRoom(opts: {
  restaurantId: number;
  tableNumber: string;
  groupSlug?: string | null;
  guestId: string;
}) {
  purgeStale();
  const tableKey = tableGameKey(opts.tableNumber, opts.groupSlug);
  const roomId = `${opts.restaurantId}:${tableKey}`;
  let room = rooms.get(roomId);

  if (!room) {
    room = {
      id: roomId,
      restaurantId: opts.restaurantId,
      tableKey,
      players: [{ id: opts.guestId, mark: 'X', joinedAt: Date.now() }],
      board: emptyBoard(),
      turn: 'X',
      winner: null,
      updatedAt: Date.now(),
    };
    rooms.set(roomId, room);
    return publicRoom(room, opts.guestId);
  }

  const existing = room.players.find((p) => p.id === opts.guestId);
  if (existing) {
    room.updatedAt = Date.now();
    return publicRoom(room, opts.guestId);
  }

  if (room.players.length >= 2) {
    const err = new Error('ROOM_FULL');
    (err as Error & { code?: string }).code = 'ROOM_FULL';
    throw err;
  }

  room.players.push({ id: opts.guestId, mark: 'O', joinedAt: Date.now() });
  room.updatedAt = Date.now();
  return publicRoom(room, opts.guestId);
}

export function getXoxRoom(roomId: string, guestId: string) {
  purgeStale();
  const room = rooms.get(roomId);
  if (!room) return null;
  room.updatedAt = Date.now();
  return publicRoom(room, guestId);
}

export function playXoxMove(opts: { roomId: string; guestId: string; cell: number }) {
  purgeStale();
  const room = rooms.get(opts.roomId);
  if (!room) return null;
  if (opts.cell < 0 || opts.cell > 8 || !Number.isInteger(opts.cell)) {
    const err = new Error('BAD_CELL');
    (err as Error & { code?: string }).code = 'BAD_CELL';
    throw err;
  }
  if (room.winner) {
    const err = new Error('GAME_OVER');
    (err as Error & { code?: string }).code = 'GAME_OVER';
    throw err;
  }
  if (room.players.length < 2) {
    const err = new Error('WAITING');
    (err as Error & { code?: string }).code = 'WAITING';
    throw err;
  }
  const me = room.players.find((p) => p.id === opts.guestId);
  if (!me) {
    const err = new Error('NOT_PLAYER');
    (err as Error & { code?: string }).code = 'NOT_PLAYER';
    throw err;
  }
  if (me.mark !== room.turn) {
    const err = new Error('NOT_TURN');
    (err as Error & { code?: string }).code = 'NOT_TURN';
    throw err;
  }
  if (room.board[opts.cell] != null) {
    const err = new Error('OCCUPIED');
    (err as Error & { code?: string }).code = 'OCCUPIED';
    throw err;
  }

  room.board[opts.cell] = me.mark;
  room.winner = checkWinner(room.board);
  if (!room.winner) room.turn = me.mark === 'X' ? 'O' : 'X';
  room.updatedAt = Date.now();
  return publicRoom(room, opts.guestId);
}

export function rematchXox(opts: { roomId: string; guestId: string }) {
  purgeStale();
  const room = rooms.get(opts.roomId);
  if (!room) return null;
  if (!room.players.some((p) => p.id === opts.guestId)) {
    const err = new Error('NOT_PLAYER');
    (err as Error & { code?: string }).code = 'NOT_PLAYER';
    throw err;
  }
  room.board = emptyBoard();
  room.turn = 'X';
  room.winner = null;
  room.updatedAt = Date.now();
  return publicRoom(room, opts.guestId);
}

export function leaveXoxRoom(opts: { roomId: string; guestId: string }) {
  const room = rooms.get(opts.roomId);
  if (!room) return;
  room.players = room.players.filter((p) => p.id !== opts.guestId);
  if (room.players.length === 0) {
    rooms.delete(opts.roomId);
    return;
  }
  // Tek oyuncu kalırsa tahtayı sıfırla, kalan X olsun
  room.players = room.players.map((p, i) => ({
    ...p,
    mark: i === 0 ? 'X' : 'O',
  }));
  room.board = emptyBoard();
  room.turn = 'X';
  room.winner = null;
  room.updatedAt = Date.now();
}
