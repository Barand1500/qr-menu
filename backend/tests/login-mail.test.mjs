import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outfile = path.join(root, 'backend/node_modules/.login-check/mail.mjs');
const test = { options: [], messages: [], closed: 0, fail: false };
globalThis.__smtpTest = test;
await build({
  entryPoints: [path.join(root, 'backend/src/lib/login-mail.ts')],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  plugins: [
    {
      name: 'fake-smtp-transport',
      setup(b) {
        b.onResolve({ filter: /^nodemailer$/ }, () => ({ path: 'smtp', namespace: 'test' }));
        b.onLoad({ filter: /.*/, namespace: 'test' }, () => ({
          contents: `export default {createTransport(options){const t=globalThis.__smtpTest;t.options.push(options);return{async sendMail(message){if(t.fail)throw Error('SMTP failed');t.messages.push(message);return{}},close(){t.closed++}}}};`,
          loader: 'js',
        }));
      },
    },
  ],
});
const { sendLoginCode, loginMailConfigured } = await import(pathToFileURL(outfile).href);
Object.assign(process.env, {
  LOGIN_SMTP_HOST: 'smtp.example.test',
  LOGIN_SMTP_PORT: '587',
  LOGIN_SMTP_USER: 'test',
  LOGIN_SMTP_PASSWORD: 'test-secret',
  LOGIN_MAIL_FROM: 'Menu QR <login@example.test>',
});
assert.equal(loginMailConfigured(), true);
await sendLoginCode('admin@example.test', '123456');
assert.equal(test.options[0].secure, false);
assert.equal(test.options[0].requireTLS, true);
assert.equal(test.options[0].port, 587);
assert.deepEqual(test.messages[0].to, { address: 'admin@example.test', name: '' });
assert.ok(test.messages[0].text.includes('123456'));
assert.ok(test.messages[0].html.includes('123456'));
assert.equal(test.closed, 1);
process.env.LOGIN_SMTP_PORT = '465';
await sendLoginCode('admin@example.test', '234567');
assert.equal(test.options[1].secure, true);
assert.equal(test.options[1].requireTLS, false);
assert.equal(test.closed, 2);
test.fail = true;
await assert.rejects(sendLoginCode('admin@example.test', '345678'));
assert.equal(test.closed, 3);
delete process.env.LOGIN_SMTP_PASSWORD;
assert.equal(loginMailConfigured(), false);
await assert.rejects(sendLoginCode('admin@example.test', '456789'));
assert.equal(test.options.length, 3);
console.log(
  'PASS: SMTP settings, mandatory STARTTLS on 587, TLS on 465, message recipient/body, transport close on success/failure, missing-configuration rejection. No external email sent.'
);
