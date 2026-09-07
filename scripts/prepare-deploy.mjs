/**
 * Sunucuya atılacak paketi hazırlar + ZIP oluşturur.
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

const stamp = new Date().toISOString().slice(0, 10);
const zipName = `menu-qr-deploy-${stamp}.zip`;
const zipPath = path.join(root, zipName);

console.log('1) Frontend build (eski dist temizleniyor)...');
rimraf(path.join(frontendDir, 'dist'));
run('npm run build', frontendDir);

console.log('\n2) Backend build...');
run('npm run build', backendDir);

console.log('\n3) deploy klasörü hazırlanıyor...');
rimraf(deployDir);
fs.mkdirSync(deployDir, { recursive: true });
fs.mkdirSync(path.join(deployDir, 'uploads'), { recursive: true });
fs.writeFileSync(path.join(deployDir, 'uploads', '.gitkeep'), '');

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
    /** Güncellemede seed ÇALIŞTIRMA — tüm veriyi siler */
    setup: 'prisma generate && prisma db push',
  },
  dependencies: {
    ...pkg.dependencies,
  },
  prisma: pkg.prisma,
};
fs.writeFileSync(path.join(deployDir, 'package.json'), JSON.stringify(deployPkg, null, 2));

const envExample = `DATABASE_URL="mysql://KULLANICI:SIFRE@127.0.0.1:3306/VERITABANI"
JWT_SECRET="uzun-rastgele-bir-metin-yaz"
PORT=3008
CORS_ORIGIN=https://menu.guzelteknoloji.com,http://menu.guzelteknoloji.com
UPLOAD_DIR=./uploads
PUBLIC_DIR=./public
`;
fs.writeFileSync(path.join(deployDir, '.env.example'), envExample);

const okuBeni = `MENU QR — SUNUCUYA YÜKLEME PAKETİ
=====================================
Tarih: ${stamp}
Domain: https://menu.guzelteknoloji.com
Port: 3008
Klasör: ~/htdocs/menu.guzelteknoloji.com

ADIM 1 — ZIP'İ SUNUCUYA AT
---------------------------
CloudPanel → Dosya Yöneticisi → htdocs/menu.guzelteknoloji.com
ZIP dosyasını buraya yükle ve "Extract / Çıkart" de.


ADIM 2 — DOSYALARI YERLEŞTİR
----------------------------
ZIP içindeki dosyalar doğrudan site köküne gelsin.
Şu yapı oluşmalı (deploy ara klasörü OLMASIN):

  menu.guzelteknoloji.com/
    dist/
    public/
    prisma/
    package.json
    uploads/        ← mevcutsa ÜZERİNE YAZMA (logolar burada)
    .env            ← mevcutsa DOKUNMA

ÖNEMLİ:
  ✗ .env dosyasını silip yenisiyle değiştirme
  ✗ uploads/ klasörünü silme (yüklenen görseller kaybolur)
  ✓ public/ klasörünü TAMAMEN değiştir (eski assets silinsin)
  ✓ dist/ ve prisma/ klasörlerini tamamen değiştir


ADIM 3 — SSH İLE KOMUTLAR
-------------------------
CloudPanel → SSH Terminal veya PuTTY ile bağlan.
Aşağıdaki komutları sırayla yapıştır:

cd ~/htdocs/menu.guzelteknoloji.com

npm install --omit=dev

npm run setup

# CloudPanel Node.js uygulamasını "Restart" yap
# (Panelden restart yeterli; aşağıdaki npm start'ı panel açıkken çalıştırma)

Detaylı açıklama için: SUNUCU-KOMUTLAR.txt


ADIM 4 — TEST
-------------
https://menu.guzelteknoloji.com/api/health
  → {"status":"ok"...}

https://menu.guzelteknoloji.com/login
  → Admin giriş (Ctrl+F5 ile hard refresh)

Ayarlar → Entegrasyon → lisans kutusu görünüyor mu kontrol et.


YENİ ÖZELLİKLER (bu paket)
---------------------------
- Bakım modu (sidebar inşaat ikonu) + rehber adımı
- Bakım ekranı: Garson Koşusu oyunu + gerçek skor sıralaması
- Karşılama logo animasyonu yumuşatma
- Masa görünümü / konum kilidi / admin tur iyileştirmeleri

UYARI: npm run db:seed veya db:reset ÇALIŞTIRMA — tüm canlı veriyi siler!
`;
fs.writeFileSync(path.join(deployDir, 'OKU-BENI.txt'), okuBeni);

const sunucuKomutlar = `====================================================
  MENU QR — SUNUCU KOMUTLARI (CloudPanel SSH)
  Domain: https://menu.guzelteknoloji.com
  Port: 3008
====================================================

GÜNCELLEME (mevcut canlı site) — bu paket için
------------------------------------------------

1) ZIP'i site klasörüne çıkart
2) .env ve uploads/ DOKUNMA
3) SSH'de sırayla:

cd ~/htdocs/menu.guzelteknoloji.com
npm install --omit=dev
npm run setup

4) CloudPanel → Node.js → Restart


İLK KURULUM (sıfırdan)
----------------------
Yukarıdakilere ek olarak .env dosyasını oluştur (.env.example'a bak).
Sonra panelden Node uygulamasını başlat.


----------------------------------------------------
KOMUT AÇIKLAMALARI
----------------------------------------------------

cd ~/htdocs/menu.guzelteknoloji.com
  → Proje klasörüne gir

npm install --omit=dev
  → Bağımlılıkları kur (node_modules)

npm run setup
  → prisma generate + prisma db push
  → Yeni tablolar/kolonlar eklenir (masa_cagrilari, lisans_bitis vb.)
  → SEED ÇALIŞTIRMAZ — canlı veri korunur


----------------------------------------------------
NODE YENİDEN BAŞLAT
----------------------------------------------------

SEÇENEK A (önerilen):
  CloudPanel → Sites → menu.guzelteknoloji.com → Node.js → Restart

SEÇENEK B (sadece test, panel kapalıyken):
  npm start


----------------------------------------------------
TEST
----------------------------------------------------
https://menu.guzelteknoloji.com/api/health
https://menu.guzelteknoloji.com/login
https://menu.guzelteknoloji.com/menu


----------------------------------------------------
HIZLI KOPYALA (güncelleme)
----------------------------------------------------

cd ~/htdocs/menu.guzelteknoloji.com
npm install --omit=dev
npm run setup

(sonra CloudPanel'den Restart)


----------------------------------------------------
SIK HATALAR
----------------------------------------------------

EADDRINUSE / port kullanımda
  → Panel + npm start aynı anda çalışıyor. Birini kapat.

Database / P1000 / auth failed
  → .env DATABASE_URL yanlış. ! karakteri URL'de %21 olmalı.

Cannot find module '@prisma/client'
  → npm install --omit=dev && npm run setup

502 Bad Gateway
  → Node kapalı. Panelden Restart.

Lisans kutusu "henüz tanımlanmadı"
  → Normal; MySQL'de lisans_bitis set et:
  UPDATE restoranlar SET lisans_bitis = '2027-12-31' WHERE id = 1;

ASLA ÇALIŞTIRMA (canlıda):
  npm run db:seed
  npm run db:reset
  → Tüm menü, kullanıcı, ayar verisi silinir!

====================================================
`;
fs.writeFileSync(path.join(deployDir, 'SUNUCU-KOMUTLAR.txt'), sunucuKomutlar);
fs.writeFileSync(path.join(root, 'SUNUCU-KOMUTLAR.txt'), sunucuKomutlar);

console.log('\n4) ZIP oluşturuluyor...');
if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
// tar: Windows'ta dosya kilidi sorunlarına karşı Compress-Archive yerine
execSync(`tar -a -cf "${zipPath}" *`, {
  cwd: deployDir,
  stdio: 'inherit',
  shell: true,
});

const zipSizeMb = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(2);

console.log('\n========================================');
console.log('  DEPLOY PAKETİ HAZIR');
console.log('========================================');
console.log(`  ZIP:  ${zipPath}`);
console.log(`  Boyut: ${zipSizeMb} MB`);
console.log(`  Klasör: ${deployDir}`);
console.log('\nSunucuya ZIP at → çıkart → SSH komutlarını çalıştır.');
console.log('Detay: deploy/OKU-BENI.txt');
