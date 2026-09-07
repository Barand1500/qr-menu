#!/usr/bin/env bash
# =============================================================================
# MENU QR — Sunucu deploy (git pull + build + restart)
# =============================================================================
# İlk kurulum (bir kez):
#   mkdir -p /home/guzelteknoloji-menu/apps
#   cd /home/guzelteknoloji-menu/apps
#   git clone https://github.com/Barand1500/qr-menu.git menu-qr
#   cd menu-qr
#   chmod +x scripts/server-deploy.sh
#
# Sonraki her güncellemede (SSH):
#   /home/guzelteknoloji-menu/apps/menu-qr/scripts/server-deploy.sh
#
# veya:
#   cd /home/guzelteknoloji-menu/apps/menu-qr && ./scripts/server-deploy.sh
# =============================================================================
set -euo pipefail

REPO_DIR="${REPO_DIR:-/home/guzelteknoloji-menu/apps/menu-qr}"
SITE_DIR="${SITE_DIR:-/home/guzelteknoloji-menu/htdocs/menu.guzelteknoloji.com}"
BRANCH="${BRANCH:-main}"
PORT="${PORT:-3008}"

log() { printf '\n==> %s\n' "$*"; }
die() { printf '\nHATA: %s\n' "$*" >&2; exit 1; }

[[ -d "$REPO_DIR/.git" ]] || die "Repo yok: $REPO_DIR — önce git clone yap."
[[ -d "$SITE_DIR" ]] || die "Site klasörü yok: $SITE_DIR"
[[ -f "$SITE_DIR/.env" ]] || die "Site .env bulunamadı: $SITE_DIR/.env — dokunma, oluştur."

cd "$REPO_DIR"

log "Git: $BRANCH çekiliyor..."
git fetch origin
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

log "Bağımlılıklar (repo)..."
if [[ -f package-lock.json ]]; then
  npm install --prefix . --no-fund --no-audit
fi
npm install --prefix frontend --no-fund --no-audit
npm install --prefix backend --no-fund --no-audit

log "Build (frontend + backend)..."
npm run build --prefix frontend
npm run build --prefix backend

[[ -d frontend/dist ]] || die "frontend/dist oluşmadı"
[[ -d backend/dist ]] || die "backend/dist oluşmadı"

log "Canlı siteye yazılıyor (.env ve uploads korunur)..."
# public: eski asset hash'leri kalsın diye klasörü yenile
rm -rf "$SITE_DIR/public"
mkdir -p "$SITE_DIR/public"
cp -a frontend/dist/. "$SITE_DIR/public/"

rm -rf "$SITE_DIR/dist"
mkdir -p "$SITE_DIR/dist"
cp -a backend/dist/. "$SITE_DIR/dist/"

rm -rf "$SITE_DIR/prisma"
mkdir -p "$SITE_DIR/prisma"
cp -a backend/prisma/. "$SITE_DIR/prisma/"

# Canlı package.json (yalnızca production bağımlılıkları)
REPO_DIR="$REPO_DIR" SITE_DIR="$SITE_DIR" node --input-type=module <<'NODE'
import fs from 'node:fs';
import path from 'node:path';

const repo = process.env.REPO_DIR;
const site = process.env.SITE_DIR;
if (!repo || !site) throw new Error('REPO_DIR / SITE_DIR eksik');
const pkg = JSON.parse(fs.readFileSync(path.join(repo, 'backend/package.json'), 'utf8'));
const out = {
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
fs.writeFileSync(path.join(site, 'package.json'), JSON.stringify(out, null, 2) + '\n');
NODE

mkdir -p "$SITE_DIR/uploads"

log "Site bağımlılıkları + prisma..."
cd "$SITE_DIR"
npm install --omit=dev --no-fund --no-audit
npm run setup

log "Port $PORT yeniden başlatılıyor..."
fuser -k "${PORT}/tcp" 2>/dev/null || true
if command -v lsof >/dev/null 2>&1; then
  kill $(lsof -t -i:"$PORT") 2>/dev/null || true
fi
sleep 2
nohup npm start >> logs-start.log 2>&1 &
sleep 3

log "Sağlık kontrolü..."
if curl -fsS "http://127.0.0.1:${PORT}/api/health"; then
  printf '\n\nDeploy tamam. Tarayıcıda Ctrl+F5 yap.\n'
else
  die "Health check başarısız — logs-start.log dosyasına bak."
fi
