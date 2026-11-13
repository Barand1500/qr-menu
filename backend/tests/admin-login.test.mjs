import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, 'backend/node_modules/.login-check');
process.env.JWT_SECRET = 'login-test-key';
const bcrypt = (
  await import(pathToFileURL(path.join(root, 'backend/node_modules/bcryptjs/index.js')).href)
).default;
const jwt = (
  await import(pathToFileURL(path.join(root, 'backend/node_modules/jsonwebtoken/index.js')).href)
).default;
const hash = await bcrypt.hash('test-password', 4);
const user = {
  id: 1,
  restaurantId: 7,
  email: 'admin@example.test',
  passwordHash: hash,
  fullName: 'Admin',
  role: 'admin',
  isActive: true,
  restaurant: { id: 7, name: 'Chef', slug: 'chef', logoUrl: null },
};
const inactive = { ...user, id: 2, email: 'inactive@example.test', isActive: false };
const rows = new Map();
let nextId = 1;
const clone = (x) => (x ? structuredClone(x) : null);
globalThis.__loginPrisma = {
  user: {
    findUnique: async ({ where }) =>
      clone(
        [user, inactive].find((u) => (where.email ? u.email === where.email : u.id === where.id))
      ),
  },
  setting: {
    findUnique: async ({ where }) =>
      clone(rows.get(`${where.restaurantId_key.restaurantId}:${where.restaurantId_key.key}`)),
    create: async ({ data }) => {
      const key = `${data.restaurantId}:${data.key}`;
      if (rows.has(key)) throw Object.assign(new Error(), { code: 'P2002' });
      const row = { id: nextId++, ...data };
      rows.set(key, row);
      return clone(row);
    },
    updateMany: async ({ where, data }) => {
      let count = 0;
      for (const [key, row] of rows) {
        if (Object.entries(where).every(([k, v]) => row[k] === v)) {
          rows.set(key, { ...row, ...data });
          count++;
        }
      }
      return { count };
    },
  },
};
let configured = true,
  mailFailure = false;
const sent = [];
globalThis.__loginMail = {
  configured: () => configured,
  send: async (email, code) => {
    if (mailFailure) throw Error('SMTP down');
    sent.push({ email, code });
  },
};
await build({
  entryPoints: [path.join(root, 'backend/src/routes/auth.ts')],
  outfile: path.join(out, 'router.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  plugins: [
    {
      name: 'login-test-deps',
      setup(b) {
        b.onResolve({ filter: /(^|\/)prisma\.js$/ }, () => ({ path: 'prisma', namespace: 'test' }));
        b.onResolve({ filter: /(^|\/)login-mail\.js$/ }, () => ({
          path: 'mail',
          namespace: 'test',
        }));
        b.onLoad({ filter: /.*/, namespace: 'test' }, (args) => ({
          contents:
            args.path === 'prisma'
              ? 'export const prisma=globalThis.__loginPrisma;'
              : 'export const loginMailConfigured=globalThis.__loginMail.configured;export const sendLoginCode=globalThis.__loginMail.send;',
          loader: 'js',
        }));
      },
    },
  ],
});
const router = (await import(pathToFileURL(path.join(out, 'router.mjs')).href)).default;
const express = (
  await import(pathToFileURL(path.join(root, 'backend/node_modules/express/index.js')).href)
).default;
const app = express();
app.use(express.json());
app.use(router);
app.use((err, req, res, next) => res.status(500).json({ message: 'Test error' }));
const server = app.listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}`;
const originalNow = Date.now;
let clock = originalNow();
Date.now = () => clock;
const call = async (route, body) => {
  const res = await fetch(base + route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json(), headers: res.headers };
};
const send = (email = user.email) => call('/login/code/request', { email });
const verify = (id, code, email = user.email) =>
  call('/login/code/verify', { email, challengeId: id, code });
const wrong = (code) => String((Number(code) + 1) % 1000000).padStart(6, '0');
try {
  assert.equal((await send('bad')).status, 400);
  assert.equal((await call('/login', { email: [], password: {} })).status, 400);
  assert.equal((await call('/login', { email: user.email, password: 'wrong' })).status, 401);
  let res = await call('/login', { email: ' ADMIN@example.test ', password: 'test-password' });
  assert.equal(res.status, 200);
  assert.equal(jwt.verify(res.body.token, 'login-test-key').restaurantId, 7);
  assert.equal(res.body.user.passwordHash, undefined);
  configured = false;
  assert.equal((await send()).status, 503);
  configured = true;
  res = await send('missing@example.test');
  assert.equal(res.status, 200);
  assert.ok(res.body.challengeId);
  assert.equal(sent.length, 0);
  assert.equal((await send(inactive.email)).status, 200);
  assert.equal(sent.length, 0);
  res = await send();
  assert.equal(res.status, 200);
  let id = res.body.challengeId,
    code = sent.at(-1).code;
  assert.match(code, /^\d{6}$/);
  assert.equal(res.body.code, undefined);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const record = JSON.parse([...rows.values()][0].value);
  assert.notEqual(record.hash, code);
  assert.match(record.hash, /^[a-f0-9]{64}$/);
  assert.equal((await send()).body.challengeId, id);
  assert.equal(sent.length, 1);
  assert.equal((await verify(id, wrong(code))).status, 401);
  res = await verify(id, code);
  assert.equal(res.status, 200);
  assert.equal(res.body.user.email, user.email);
  assert.equal(jwt.verify(res.body.token, 'login-test-key').userId, 1);
  assert.equal((await verify(id, code)).status, 401);
  assert.equal((await send()).status, 429);
  clock += 61000;
  res = await send();
  id = res.body.challengeId;
  code = sent.at(-1).code;
  for (let i = 0; i < 5; i++) assert.equal((await verify(id, wrong(code))).status, 401);
  assert.equal((await verify(id, code)).status, 401);
  assert.equal((await send()).status, 429);
  clock += 61000;
  res = await send();
  id = res.body.challengeId;
  code = sent.at(-1).code;
  clock += 301000;
  assert.equal((await verify(id, code)).status, 401);
  clock += 3600001;
  res = await send();
  id = res.body.challengeId;
  code = sent.at(-1).code;
  user.isActive = false;
  assert.equal((await verify(id, code)).status, 401);
  user.isActive = true;
  const concurrent = await Promise.all([verify(id, code), verify(id, code)]);
  assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 401]);
  clock += 3600001;
  mailFailure = true;
  assert.equal((await send()).status, 503);
  mailFailure = false;
  assert.equal((await send()).status, 429);
  assert.equal(JSON.parse([...rows.values()][0].value).hash, '');
  clock += 3600001;
  const before = sent.length;
  const requests = await Promise.all([send(), send()]);
  assert.ok(requests.some((r) => r.status === 200));
  assert.ok(requests.every((r) => [200, 429].includes(r.status)));
  assert.equal(sent.length, before + 1);
  for (let i = 0; i < 4; i++) {
    clock += 61000;
    assert.equal((await send()).status, 200);
  }
  clock += 61000;
  assert.equal((await send()).status, 429);
  clock += 3600001;
  for (let i = 0; i < 30; i++) assert.equal((await send('missing@example.test')).status, 200);
  assert.equal((await send('missing@example.test')).status, 429);
  assert.equal(
    (await call('/login', { email: user.email, password: 'test-password' })).status,
    200
  );
  console.log(
    'PASS: existing password login, normalized email, unconfigured SMTP, non-disclosing request, hashed durable codes, cooldown, wrong/expired/exhausted codes, inactive user, atomic one-time consumption, concurrent sends, failed delivery invalidation, per-account/hour and IP limits. No real database or email accessed.'
  );
} finally {
  Date.now = originalNow;
  server.close();
}
