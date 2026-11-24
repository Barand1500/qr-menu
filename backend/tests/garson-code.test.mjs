import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import express from 'express';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'node_modules/.garson-code-check');
const stubs = {
  name: 'memory-db',
  setup(b) {
    b.onResolve({ filter: /\/lib\/prisma\.js$|^\.\/prisma\.js$/ }, () => ({
      path: 'prisma',
      namespace: 'test',
    }));
    b.onResolve({ filter: /\/lib\/auth\.js$/ }, () => ({
      path: 'auth',
      namespace: 'test',
    }));
    b.onLoad({ filter: /.*/, namespace: 'test' }, (args) => ({
      loader: 'js',
      contents:
        args.path === 'prisma'
          ? 'export const prisma = globalThis.__garsonDb;'
          : "export const authRequired = (req,res,next) => { if(!req.headers['x-user']) return res.sendStatus(401); req.user={userId:Number(req.headers['x-user'])}; next(); }; export const getRestaurantId = async req => Number(req.headers['x-restaurant'] || 1);",
    }));
  },
};
for (const [name, entry] of [
  ['garson', 'garson.ts'],
  ['public', 'public-menu.ts'],
])
  await build({
    entryPoints: [path.join(root, 'src/routes', entry)],
    outfile: path.join(out, name + '.mjs'),
    bundle: true,
    platform: 'node',
    format: 'esm',
    packages: 'external',
    plugins: [stubs],
    logLevel: 'error',
    banner: {
      js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
    },
  });
const matches = (row, where = {}) =>
  Object.entries(where).every(([k, v]) =>
    k === 'OR'
      ? v.some((w) => matches(row, w))
      : v && typeof v === 'object' && !(v instanceof Date)
        ? 'in' in v
          ? v.in.includes(row[k])
          : 'gte' in v
            ? row[k] >= v.gte
            : row[k] === v
        : row[k] === v,
  );
let enabled = true,
  settings = [],
  sessions = [],
  writes = 0,
  verifyDuringRefresh = false;
function session(id = 10, table = '1', restaurantId = 1) {
  return {
    id,
    restaurantId,
    tableNumber: table,
    groupSlug: 'salon',
    status: 'open',
    openedBy: 'qr',
    openedAt: new Date(),
    accessCode: '012345',
    codeExpiresAt: new Date(Date.now() + 3600000),
    codeVerifiedAt: null,
    guestName: null,
    ordersJson: '[]',
    metaJson: null,
  };
}
sessions = [session()];
const db = {
  user: {
    findUnique: async ({ where }) => ({
      id: where.id,
      fullName: where.id === 1 ? 'Ali' : 'Ayşe',
    }),
  },
  restaurant: {
    findUnique: async ({ where }) =>
      where.slug
        ? { id: 1, name: 'CHEF', slug: 'chef' }
        : { id: where.id, name: 'CHEF' },
  },
  qrTableGroup: {
    findMany: async () => [
      { slug: 'salon', name: 'Salon', prefix: '', tableCount: 3 },
    ],
    findFirst: async () => ({ name: 'Salon' }),
  },
  tableServiceRequest: { findMany: async () => [] },
  setting: {
    findMany: async () => [
      { key: 'table_session_code_enabled', value: String(enabled) },
      { key: 'table_session_code_ttl_minutes', value: '120' },
    ],
    findUnique: async ({ where }) =>
      settings.find(
        (r) =>
          r.restaurantId === where.restaurantId_key.restaurantId &&
          r.key === where.restaurantId_key.key,
      ) || null,
    create: async ({ data }) => {
      if (
        settings.some(
          (r) => r.restaurantId === data.restaurantId && r.key === data.key,
        )
      )
        throw Object.assign(Error('duplicate'), { code: 'P2002' });
      const row = { id: settings.length + 1, ...data };
      settings.push(row);
      return row;
    },
    updateMany: async ({ where, data }) => {
      const row = settings.find((r) => matches(r, where));
      if (!row) return { count: 0 };
      Object.assign(row, data);
      return { count: 1 };
    },
  },
  tableFloorSession: {
    findFirst: async ({ where }) => {
      if (where.tableNumber === 'fail') throw Error('DB unavailable');
      return sessions.find((r) => matches(r, where)) || null;
    },
    findMany: async ({ where }) => sessions.filter((r) => matches(r, where)),
    updateMany: async ({ where, data }) => {
      if (verifyDuringRefresh) {
        sessions.find((r) => r.id === where.id).codeVerifiedAt = new Date();
        verifyDuringRefresh = false;
      }
      const row = sessions.find((r) => matches(r, where));
      if (!row) return { count: 0 };
      writes++;
      Object.assign(row, data);
      return { count: 1 };
    },
    update: async ({ where, data }) => {
      const row = sessions.find((r) => matches(r, where));
      assert(row);
      writes++;
      Object.assign(row, data);
      return row;
    },
    create: async () => {
      throw Error('Visiting an empty table must not create a session');
    },
  },
};
globalThis.__garsonDb = db;
const app = express();
app.use(express.json());
app.use(
  '/garson',
  (await import(pathToFileURL(path.join(out, 'garson.mjs')).href)).default,
);
app.use(
  '/menu',
  (await import(pathToFileURL(path.join(out, 'public.mjs')).href)).default,
);
app.use((err, req, res, next) =>
  res.status(500).json({ message: err.message }),
);
const server = app.listen(0, '127.0.0.1');
await new Promise((r) => server.on('listening', r));
const base = 'http://127.0.0.1:' + server.address().port;
async function request(url, body, user = 1, restaurant = 1) {
  const r = await fetch(base + url, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-user': String(user),
      'x-restaurant': String(restaurant),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json() };
}
const table = (data) => data.tables.find((t) => t.code === '1');
try {
  assert.equal(table((await request('/garson/board')).data).session.code, null);
  const results = await Promise.all([
    request('/garson/visit', { group: 'salon', table: '1' }, 1),
    request('/garson/visit', { group: 'salon', table: '1' }, 2),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const owner = results[0].status === 200 ? 1 : 2,
    other = owner === 1 ? 2 : 1;
  assert.equal(
    table((await request('/garson/board', null, owner)).data).session.code,
    '012345',
  );
  assert.equal(
    table((await request('/garson/board', null, other)).data).session.code,
    null,
  );
  assert.equal(
    (await request('/garson/visit', { group: 'salon', table: '1' }, owner))
      .status,
    200,
  );
  assert.equal(writes, 0, 'valid code remains stable');
  assert.equal(
    (
      await request('/menu/chef/table-session-unlock', {
        tableNumber: '1',
        groupSlug: 'salon',
        code: '999999',
      })
    ).status,
    403,
  );
  sessions.push({ ...session(11, '2'), accessCode: '654321' });
  assert.equal(
    (
      await request('/menu/chef/table-session-unlock', {
        tableNumber: '1',
        groupSlug: 'salon',
        code: '654321',
      })
    ).data.code,
    'CODE_OTHER_TABLE',
  );
  assert.equal(sessions[0].codeVerifiedAt, null);
  assert.equal(
    (
      await request('/menu/chef/table-session-unlock', {
        tableNumber: '1',
        groupSlug: 'salon',
        code: '012345',
      })
    ).data.verified,
    true,
  );
  let board = (await request('/garson/board', null, owner)).data;
  assert.equal(table(board).session.code, null);
  assert.equal(table(board).session.codeStatus, 'verified');
  assert(board.feed.some((f) => f.kind === 'verified'));
  const snapshot = sessions[0].accessCode;
  await request('/garson/visit', { group: 'salon', table: '1' }, owner);
  assert.equal(sessions[0].accessCode, snapshot);
  assert(sessions[0].codeVerifiedAt);
  sessions[0].status = 'paid';
  sessions.push({ ...session(12), accessCode: '777777' });
  board = (await request('/garson/board', null, owner)).data;
  assert.equal(table(board).session.handoff, null);
  assert.equal(table(board).session.code, null);
  sessions.at(-1).codeExpiresAt = new Date(0);
  await request('/garson/visit', { group: 'salon', table: '1' }, owner);
  assert(sessions.at(-1).codeExpiresAt > Date.now());
  assert.notEqual(sessions.at(-1).accessCode, '777777');
  assert.equal(
    table((await request('/garson/board', null, owner, 2)).data).session,
    null,
    'another tenant cannot read the session',
  );
  sessions.at(-1).codeExpiresAt = new Date(0);
  verifyDuringRefresh = true;
  await request('/garson/visit', { group: 'salon', table: '1' }, owner);
  assert(
    sessions.at(-1).codeVerifiedAt,
    'a concurrent verification must survive renewal',
  );
  assert.equal(
    (await request('/garson/visit', { group: 'salon', table: 'fail' }, owner))
      .status,
    500,
  );
  enabled = false;
  board = (await request('/garson/board', null, owner)).data;
  assert.equal(board.codeGateEnabled, false);
  assert.equal(table(board).session.code, null);
  assert.equal(table(board).session.handoff, null);
  await request('/garson/visit', { group: 'salon', table: '3' }, owner);
  assert.equal(sessions.length, 3);
  console.log(
    'PASS: real garson visit/board and customer unlock routes, concurrency, stable/expired codes, new sessions and tenant isolation (in-memory DB)',
  );
} finally {
  server.close();
}
