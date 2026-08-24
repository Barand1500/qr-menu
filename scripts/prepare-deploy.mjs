/**
 * Sunucuya atılacak paketi hazırlar.
 * Kullanım (proje kökünden): node scripts/prepare-deploy.mjs
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const deployDir = path.join(root, 'deploy');
const backendDir = path.join(root, 'backend');
const frontendDir = path.join(root, 'frontend');

function run(cmd, cwd) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit', shell: true });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

function rimraf(target) {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

console.log('1) Frontend build...');
run('npm run build', frontendDir);

console.log('\n2) Backend build...');
run('npm run build', backendDir);

console.log('\n3) deploy klasörü hazırlanıyor...');
rimraf(deployDir);
fs.mkdirSync(deployDir, { recursive: true });
fs.mkdirSync(path.join(deployDir, 'uploads'), { recursive: true });

copyDir(path.join(backendDir, 'dist'), path.join(deployDir, 'dist'));
copyDir(path.join(backendDir, 'prisma'), path.join(deployDir, 'prisma'));
copyDir(path.join(frontendDir, 'dist'), path.join(deployDir, 'public'));

const pkg = JSON.parse(fs.readFileSync(path.join(backendDir, 'package.json'), 'utf8'));
const deployPkg = {
  name: 'menu-qr-server',
  version: pkg.version,
  private: true,
  type: 'module',
  scripts: {
    start: 'node dist/index.js',
    'db:generate': 'prisma generate',
    'db:push': 'prisma db push',
    'db:seed': 'tsx prisma/seed.ts',
    setup: 'prisma generate && prisma db push && tsx prisma/seed.ts',
  },
  dependencies: {
    ...pkg.dependencies,
    tsx: pkg.devDependencies.tsx || '^4.20.6',
  },
  prisma: pkg.prisma,
};
fs.writeFileSync(path.join(deployDir, 'package.json'), JSON.stringify(deployPkg, null, 2));

fs.writeFileSync(
  path.join(deployDir, '.env.example'),
  `DATABASE_URL="mysql://guzelteknoloji-menu-user:SIFRE@127.0.0.1:3306/guzelteknoloji-menu-db"
JWT_SECRET="uzun-rastgele-bir-metin-yaz"
PORT=3008
CORS_ORIGIN=https://menu.guzelteknoloji.com,http://menu.guzelteknoloji.com
UPLOAD_DIR=./uploads
PUBLIC_DIR=./public
`
);

const readme = `MENU QR — SUNUCU KURULUM (CloudPanel)
=====================================

Domain: https://menu.guzelteknoloji.com
Port: 3008 (Node.js Ayarları ile aynı olmalı)

0) .env OLUŞTUR
   .env.example dosyasını kopyala → .env yap.
   SIFRE yerine veritabanı şifreni yaz.
   Şifrede ! varsa URL’de %21 yaz.

1) Bu ZIP içeriğinin TAMAMINI şuraya aç:
   htdocs/menu.guzelteknoloji.com/
   (içinde dist, public, prisma, package.json olmalı)

2) CloudPanel → SSH ile bağlan:
   cd ~/htdocs/menu.guzelteknoloji.com

3) Komutlar:
   cp .env.example .env
   # .env içindeki SIFRE’yi düzenle (nano .env)
   npm install --omit=dev
   npm run setup
   npm start

4) CloudPanel Node.js Ayarları:
   - Node 22 LTS
   - Uygulama Portu: 3008
   - Start: npm start

5) Test:
   https://menu.guzelteknoloji.com/api/health
   https://menu.guzelteknoloji.com/menu
   https://menu.guzelteknoloji.com/login

NOTLAR
- node_modules ZIP’te yok; sunucuda npm install şart.
- uploads klasörü boş gelir; görseller buraya yazılır.
`;
fs.writeFileSync(path.join(deployDir, 'OKU-BENI.txt'), readme);

console.log('\n4) ZIP oluşturuluyor...');
const zipPath = path.join(root, 'menu-qr-deploy.zip');
rimraf(zipPath);
run(
  `powershell -NoProfile -Command "Compress-Archive -Path '${deployDir}\\*' -DestinationPath '${zipPath}' -Force"`,
  root
);

console.log('\nHazır!');
console.log(`  Klasör: ${deployDir}`);
console.log(`  ZIP:    ${zipPath}`);
console.log('  Sunucuya ZIP’i atıp aç, sonra OKU-BENI.txt adımlarını uygula.');
