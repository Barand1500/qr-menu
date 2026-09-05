import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const deploy = path.join(root, 'deploy');
const backend = path.join(root, 'backend');
const frontend = path.join(root, 'frontend');
const zipPath = path.join(root, 'menu-qr-deploy-2026-09-01.zip');

function rimraf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

rimraf(deploy);
fs.mkdirSync(path.join(deploy, 'uploads'), { recursive: true });
fs.writeFileSync(path.join(deploy, 'uploads', '.gitkeep'), '');

copyDir(path.join(backend, 'dist'), path.join(deploy, 'dist'));
copyDir(path.join(backend, 'prisma'), path.join(deploy, 'prisma'));
copyDir(path.join(frontend, 'dist'), path.join(deploy, 'public'));

const pkg = JSON.parse(fs.readFileSync(path.join(backend, 'package.json'), 'utf8'));
const deployPkg = {
  name: 'menu-qr-server',
  version: pkg.version,
  private: true,
  type: 'module',
  scripts: {
    start: 'node dist/index.js',
    'db:generate': 'prisma generate',
    'db:push': 'prisma db push',
    setup: 'prisma generate && prisma db push',
  },
  dependencies: { ...pkg.dependencies },
  prisma: pkg.prisma,
};
fs.writeFileSync(path.join(deploy, 'package.json'), `${JSON.stringify(deployPkg, null, 2)}\n`);

fs.copyFileSync(path.join(root, 'SUNUCU-KOMUTLAR.txt'), path.join(deploy, 'SUNUCU-KOMUTLAR.txt'));
fs.writeFileSync(
  path.join(deploy, 'OKU-BENI.txt'),
  `MENU QR — SUNUCUYA YÜKLEME PAKETİ\nTarih: 2026-09-01\n\nZIP çıkart → .env ve uploads/ DOKUNMA\npublic/, dist/, prisma/ tamamen değiştir\n\nSSH:\ncd ~/htdocs/menu.guzelteknoloji.com\nnpm install --omit=dev\nnpm run setup\n\nCloudPanel Node.js Restart\n`
);

rimraf(zipPath);
execSync(`tar -a -cf "${zipPath}" *`, { cwd: deploy, stdio: 'inherit', shell: true });

const mb = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(2);
console.log(`\nHazır: ${zipPath} (${mb} MB)`);
console.log(`public/assets: ${fs.readdirSync(path.join(deploy, 'public', 'assets')).length} dosya`);
