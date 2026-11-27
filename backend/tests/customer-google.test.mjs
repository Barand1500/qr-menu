import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, 'backend/node_modules/.garson-check/customer-google.mjs');
await build({
  entryPoints: [path.join(root, 'backend/src/lib/customer-google.ts')],
  outfile: out,
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  logLevel: 'error',
});
process.env.JWT_SECRET = 'test-secret';
const g = await import(pathToFileURL(out).href);

// dönüş yolu yalnızca sitenin kendi yolu olabilir
assert.equal(g.safeReturnPath('/menu/x?t=5'), '/menu/x?t=5');
for (const bad of ['//evil.com', 'https://evil.com', '/\\evil.com', '/a\r\nSet-Cookie: x=1', undefined, 5]) assert.equal(g.safeReturnPath(bad), '/');

// state yalnızca aynı tarayıcının çerezi ile doğrulanır
const { state, nonce } = g.makeState('/menu/x', true);
assert.deepEqual({ ret: g.readState(state, nonce).ret, rem: g.readState(state, nonce).rem }, { ret: '/menu/x', rem: true });
assert.equal(g.readState(state, 'baska-nonce-degeri-aaaaaaaaaaaaaaa'), null);
assert.equal(g.readState(state, ''), null);
assert.equal(g.readState('bozuk', nonce), null);
assert.equal(g.readCookie('a=1; g_state=abc; b=2', 'g_state'), 'abc');

// kimlik belirteci: doğru istemci, Google, doğrulanmış e-posta, süresi dolmamış
const idt = (c) => `x.${Buffer.from(JSON.stringify(c)).toString('base64url')}.y`;
const ok = { iss: 'https://accounts.google.com', aud: 'CID', exp: Math.floor(Date.now() / 1000) + 600, email: 'Ali@Example.com', email_verified: true, name: ' Ali Veli ' };
assert.deepEqual(g.parseIdToken(idt(ok), 'CID'), { email: 'ali@example.com', name: 'Ali Veli' });
for (const bad of [{ aud: 'BASKA' }, { iss: 'https://evil.com' }, { email_verified: false }, { exp: 1 }, { email: 'yok' }])
  assert.throws(() => g.parseIdToken(idt({ ...ok, ...bad }), 'CID'), g.GoogleLoginError);
assert.throws(() => g.parseIdToken('', 'CID'), g.GoogleLoginError);

// adres: sabit değer yoksa https site adresinden türer
const req = { protocol: 'http', get: () => 'localhost:3008' };
assert.ok(g.googleRedirectUri(req).endsWith('/api/customer/auth/google/callback'));
assert.ok(g.authorizeUrl('CID', 'https://x/cb', 'S').includes('client_id=CID'));
console.log('customer-google testleri geçti');
