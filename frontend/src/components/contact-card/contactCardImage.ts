import { CONTACT_CARD_PALETTES, SIGNATURE_BOX, type ContactCardConfig } from '@/lib/contactCard';
import type { ContactCardCopy } from '@/lib/contactCardCopy';
import type { ContactCardLayout } from './ContactCardView';
import { MINIMAP_ZOOM, tilePosition } from './ContactMiniMap';

type Options = {
  card: ContactCardConfig;
  name: string;
  logoUrl: string | null;
  layout: ContactCardLayout;
  number: string;
  copy: ContactCardCopy;
};

const SANS = "'Bricolage Grotesque','Outfit','Inter',system-ui,-apple-system,'Segoe UI',sans-serif";
const MONO = "ui-monospace,'SF Mono',Menlo,Consolas,monospace";

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Metni verilen genişliğe sığdırır; en çok `maxLines` satır, taşarsa … ile biter. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, maxLines: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= width || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    let last = lines[maxLines - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > width) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last}…`;
  }
  if (!lines.length) lines.push('');
  return lines;
}

function spaced(ctx: CanvasRenderingContext2D, value: string) {
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = value;
}

/** Kartın ön yüzünü PNG olarak çizer (ekran görüntüsü yerine temiz, yüksek çözünürlüklü görüntü). */
export async function renderContactCardImage(o: Options): Promise<Blob> {
  const { card, copy: t } = o;
  const palette = CONTACT_CARD_PALETTES[card.tone];
  const landscape = o.layout === 'landscape';
  const W = landscape ? 1600 : 1020;
  const hasMap = typeof card.lat === 'number' && typeof card.lng === 'number';
  const H = landscape ? 1010 : hasMap ? 1790 : 1590;
  const P = 64;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');

  await (document.fonts?.ready ?? Promise.resolve());
  const logo = o.logoUrl ? await loadImage(o.logoUrl) : null;
  const mapTiles = hasMap ? await loadMapTiles(card.lat as number, card.lng as number) : null;

  // zemin
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, palette.bg[0]);
  bg.addColorStop(1, palette.bg[1]);
  roundRect(ctx, 0, 0, W, H, 60);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.save();
  ctx.clip();
  for (const [cx, cy, color] of [
    [W * 0.95, H * 0.02, palette.accent],
    [W * 0.02, H * 0.98, palette.accent2],
  ] as const) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.55);
    g.addColorStop(0, `${color}40`);
    g.addColorStop(1, `${color}00`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.strokeStyle = palette.light ? '#00000008' : '#ffffff0a';
  ctx.lineWidth = 2;
  for (let x = -H; x < W; x += 26) {
    ctx.beginPath();
    ctx.moveTo(x, H);
    ctx.lineTo(x + H, 0);
    ctx.stroke();
  }
  ctx.restore();
  roundRect(ctx, 3, 3, W - 6, H - 6, 58);
  ctx.strokeStyle = palette.light ? '#00000026' : '#ffffff2e';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.textBaseline = 'alphabetic';
  const label = (text: string, x: number, y: number, size = 22) => {
    ctx.font = `700 ${size}px ${MONO}`;
    ctx.fillStyle = palette.muted;
    spaced(ctx, '3px');
    ctx.fillText(text, x, y);
    spaced(ctx, '0px');
  };

  // üst şerit
  label(t.cardKind, P, P + 22, 22);
  ctx.textAlign = 'right';
  label(`№ ${o.number}`, W - P, P + 22, 22);
  ctx.textAlign = 'left';

  const colW = landscape ? 700 : W - P * 2;
  let y = P + 90;

  // logo + ad
  const logoSize = landscape ? 170 : 190;
  roundRect(ctx, P, y, logoSize, logoSize, 36);
  ctx.fillStyle = palette.paper;
  ctx.fill();
  if (logo) {
    ctx.save();
    roundRect(ctx, P, y, logoSize, logoSize, 36);
    ctx.clip();
    const s = Math.max(logoSize / logo.width, logoSize / logo.height);
    ctx.drawImage(logo, P + (logoSize - logo.width * s) / 2, y + (logoSize - logo.height * s) / 2, logo.width * s, logo.height * s);
    ctx.restore();
  } else {
    ctx.fillStyle = palette.accent;
    ctx.font = `800 ${logoSize * 0.5}px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.fillText(o.name.trim().charAt(0).toLocaleUpperCase('tr') || '•', P + logoSize / 2, y + logoSize * 0.68);
    ctx.textAlign = 'left';
  }
  const nameX = P + logoSize + 40;
  ctx.font = `800 ${landscape ? 66 : 70}px ${SANS}`;
  ctx.fillStyle = palette.ink;
  const nameLines = wrap(ctx, o.name, colW - logoSize - 40, 2);
  let ny = y + (nameLines.length > 1 ? 70 : 92);
  for (const line of nameLines) {
    ctx.fillText(line, nameX, ny);
    ny += 74;
  }
  if (card.tagline) {
    ctx.font = `500 34px ${SANS}`;
    ctx.fillStyle = palette.muted;
    const tag = wrap(ctx, card.tagline, colW - logoSize - 40, 1);
    ctx.fillText(tag[0], nameX, Math.max(ny + 6, y + logoSize - 6));
  }
  y += logoSize + 56;

  // yönetici
  if (card.managerName) {
    label(card.managerTitle ? `${t.manager} · ${card.managerTitle}` : t.manager, P, y, 22);
    ctx.font = `800 52px ${SANS}`;
    ctx.fillStyle = palette.ink;
    ctx.fillText(wrap(ctx, card.managerName, colW, 1)[0], P, y + 58);
    y += 112;
  }

  // alanlar
  const rows = [
    [t.phone, card.phone],
    [t.whatsapp, card.whatsapp],
    [t.email, card.email],
    [t.web, card.website.replace(/^https?:\/\//, '').replace(/\/$/, '')],
    [t.address, card.address || card.placeLabel],
    [t.hours, card.hours],
  ].filter((r) => r[1]);
  let fx = P;
  let fy = y;
  let fw = colW;
  if (landscape) {
    fx = P + colW + 100;
    fy = P + 90;
    fw = W - fx - P;
  }
  if (rows.length) {
    ctx.strokeStyle = palette.light ? '#00000022' : '#ffffff26';
    ctx.setLineDash([3, 9]);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (landscape) {
      ctx.moveTo(fx - 50, P + 80);
      ctx.lineTo(fx - 50, H - P - 80);
    } else {
      ctx.moveTo(P, fy - 28);
      ctx.lineTo(W - P, fy - 28);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }
  for (const [idx, [name, value]] of rows.entries()) {
    label(name, fx, fy + 22, 21);
    ctx.font = `600 ${landscape ? 38 : 40}px ${SANS}`;
    ctx.fillStyle = palette.ink;
    const lines = wrap(ctx, value, fw, name === t.address ? 2 : 1);
    lines.forEach((line, i) => ctx.fillText(line, fx, fy + 66 + i * 46));
    let extra = 0;
    if (idx === rows.length - 1 && card.address && card.placeLabel) {
      ctx.font = `500 28px ${SANS}`;
      ctx.fillStyle = palette.muted;
      const sub = wrap(ctx, card.placeLabel, fw, 2);
      sub.forEach((line, i) => ctx.fillText(line, fx, fy + 66 + lines.length * 46 - 6 + i * 36));
      extra = sub.length * 36 + 4;
    }
    fy += 98 + (lines.length - 1) * 46 + extra;
  }

  // küçük harita
  if (mapTiles) {
    const mw = fw;
    const mh = landscape ? 250 : 270;
    const mx = fx;
    const my = fy + 14;
    ctx.save();
    roundRect(ctx, mx, my, mw, mh, 28);
    ctx.clip();
    ctx.fillStyle = palette.paper;
    ctx.fillRect(mx, my, mw, mh);
    const T = 240;
    const { x: px, y: py } = mapTiles.pos;
    const fxr = px - Math.floor(px);
    const fyr = py - Math.floor(py);
    if (!palette.light) (ctx as CanvasRenderingContext2D & { filter?: string }).filter = 'invert(1) hue-rotate(180deg) brightness(0.92) contrast(0.92) saturate(0.55) sepia(0.25)';
    for (const tile of mapTiles.tiles) {
      ctx.drawImage(tile.img, mx + mw / 2 - (2 + fxr) * T + tile.col * T, my + mh / 2 - (1 + fyr) * T + tile.row * T, T, T);
    }
    (ctx as CanvasRenderingContext2D & { filter?: string }).filter = 'none';
    ctx.fillStyle = palette.accent;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(mx + mw / 2, my + mh / 2, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    roundRect(ctx, mx, my, mw, mh, 28);
    ctx.strokeStyle = palette.light ? '#00000026' : '#ffffff2e';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = `600 17px ${SANS}`;
    ctx.fillStyle = '#ffffffcc';
    ctx.textAlign = 'right';
    ctx.fillText('© OpenStreetMap', mx + mw - 14, my + mh - 12);
    ctx.textAlign = 'left';
  }

  // imza alanı
  if (card.signature.length) {
    const boxW = landscape ? colW : W - P * 2;
    const boxH = landscape ? 220 : 210;
    const bx = P;
    const by = H - P - boxH;
    roundRect(ctx, bx, by, boxW, boxH, 30);
    ctx.fillStyle = palette.light ? '#ffffffb3' : '#ffffff12';
    ctx.fill();
    ctx.strokeStyle = palette.light ? '#00000020' : '#ffffff24';
    ctx.lineWidth = 2;
    ctx.stroke();
    label(t.signature, bx + 28, by + 44, 20);
    const scale = Math.min((boxW * 0.62) / SIGNATURE_BOX.width, (boxH - 60) / SIGNATURE_BOX.height);
    ctx.save();
    ctx.translate(bx + 40, by + boxH - 20 - SIGNATURE_BOX.height * scale);
    ctx.scale(scale, scale);
    ctx.strokeStyle = palette.light ? '#1b2a4a' : palette.ink;
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const d of card.signature) ctx.stroke(new Path2D(d));
    ctx.restore();
    // mühür
    ctx.save();
    ctx.translate(bx + boxW - 150, by + boxH / 2);
    ctx.rotate(-0.2);
    ctx.strokeStyle = palette.accent;
    ctx.fillStyle = palette.accent;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(0, 0, 76, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 63, 0, Math.PI * 2);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.font = `800 24px ${MONO}`;
    spaced(ctx, '3px');
    ctx.fillText(t.verified, 1.5, 4);
    spaced(ctx, '0px');
    ctx.font = `700 22px ${SANS}`;
    ctx.fillText('★', 0, 36);
    ctx.restore();
    ctx.textAlign = 'left';
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('png'))), 'image/png');
  });
}

/** Konumun çevresindeki 5×3 harita karosunu yükler; biri bile yüklenmezse harita çizilmez. */
async function loadMapTiles(lat: number, lng: number) {
  const pos = tilePosition(lat, lng);
  const tx = Math.floor(pos.x);
  const ty = Math.floor(pos.y);
  const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
  const jobs: Promise<{ col: number; row: number; img: HTMLImageElement } | null>[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5; col++) {
      jobs.push(
        loadImage(`${base}/api/map-tiles/${MINIMAP_ZOOM}/${tx - 2 + col}/${ty - 1 + row}.png`).then((img) => (img ? { col, row, img } : null)),
      );
    }
  }
  const done = await Promise.all(jobs);
  if (done.some((d) => !d)) return null;
  return { pos, tiles: done as { col: number; row: number; img: HTMLImageElement }[] };
}
