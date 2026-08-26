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
    /** Güncellemede seed YOK — sadece şema senkron */
    setup: 'prisma generate && prisma db push',
  },
  dependencies: {
    ...pkg.dependencies,
    tsx: pkg.devDependencies.tsx || '^4.20.6',
  },
  prisma: pkg.prisma,
};
fs.writeFileSync(path.join(deployDir, 'package.json'), JSON.stringify(deployPkg, null, 2));

const envContent = `DATABASE_URL="mysql://guzelteknoloji-menu-user:bRn241016%21@127.0.0.1:3306/guzelteknoloji-menu-db"
JWT_SECRET="uzun-rastgele-bir-metin-yaz"
PORT=3008
CORS_ORIGIN=https://menu.guzelteknoloji.com,http://menu.guzelteknoloji.com
UPLOAD_DIR=./uploads
PUBLIC_DIR=./public
`;
fs.writeFileSync(path.join(deployDir, '.env'), envContent);
fs.writeFileSync(path.join(deployDir, '.env.example'), envContent);

const readme = `MENU QR — GÜNCELLEME (CloudPanel)
================================

Domain: https://menu.guzelteknoloji.com
Port: 3008

1) ZIP’i Dosya Yöneticisi’nde şuraya atıp AÇ:
   htdocs/menu.guzelteknoloji.com/
   (içerik doğrudan bu klasöre çıksın; ara klasör olmasın)

2) KORU:
   - uploads/  (görseller)
   - .env      (zaten doğruysa dokunma; ZIP’teki .env ile aynı)

3) SSH’de SADECE şunlar:
   cd ~/htdocs/menu.guzelteknoloji.com
   npm install --omit=dev
   npx prisma generate
   npx prisma db push

4) CloudPanel → Node.js → Uygulamayı Yeniden Başlat (Restart)

5) Test:
   https://menu.guzelteknoloji.com/api/health

ÖNEMLİ
- npm run setup / db:seed ÇALIŞTIRMA — veriyi siler.
- node_modules ZIP’te yok; npm install şart.
`;
fs.writeFileSync(path.join(deployDir, 'OKU-BENI.txt'), readme);

console.log('\n4) ZIP oluşturuluyor...');
const zipPath = path.join(root, 'menu-qr-deploy.zip');
rimraf(zipPath);
run(`tar -a -c -f "${zipPath}" -C "${deployDir}" .`, root);

console.log('\nHazır!');
console.log(`  Klasör: ${deployDir}`);
console.log(`  ZIP:    ${zipPath}`);
console.log('  Sunucuya ZIP’i atıp aç, sonra OKU-BENI.txt adımlarını uygula.');
