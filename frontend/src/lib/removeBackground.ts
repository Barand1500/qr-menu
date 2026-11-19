/**
 * Tarayıcıda çalışan, düz renkli arka planlar için arka plan silici. Görsel dışarı gönderilmez.
 *
 * Yöntem: kenarlardaki baskın rengi arka plan sayar; bu renge yeterince yakın piksellere kenarlardan içeri
 * doğru yayılarak (BFS) ulaşılır. Kapalı bölgeler (ör. harf içleri) isteğe bağlı olarak ayrıca silinir.
 * Silinme animasyonu "Matrix yağmuru"dur: sütunlar rastgele gecikmelerle yukarıdan aşağı akar, geçtikleri
 * yerdeki arka plan yeşil koda dönüşüp çözülür.
 */

export type RemoveOptions = {
  /** 1–60: arka plan rengine ne kadar uzak pikseller de silinsin (yüzde cinsinden renk uzaklığı). */
  tolerance: number;
  /** Kenara bağlı olmayan, arka plana benzer iç bölgeleri de sil. */
  includeInner: boolean;
};

export type Background = {
  color: [number, number, number];
  /** Kenar piksellerinin çoğu zaten şeffafsa true. */
  alreadyTransparent: boolean;
};

export type Removal = {
  /** Silme sonrası her pikselin nihai alfa değeri (kenar yumuşatma dahil). */
  alpha: Uint8ClampedArray;
  /** 1 = bu piksel arka plandır ve silinir. */
  removed: Uint8Array;
  /** Silinecek piksel sayısı. */
  count: number;
  /** Silinen piksel oranı (0–1). */
  removedRatio: number;
};

const MAX_SIDE = 1400;

/** Dosyayı en uzun kenarı MAX_SIDE'ı geçmeyecek biçimde canvas'a çizer. */
export async function loadImageData(
  file: Blob,
): Promise<{ image: ImageData; width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Görsel işlenemedi.');
    ctx.drawImage(img, 0, 0, width, height);
    return { image: ctx.getImageData(0, 0, width, height), width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Kenar piksellerinden arka plan rengini bulur (en sık görülen renk kümesinin ortalaması). */
export function detectBackground(image: ImageData): Background {
  const { width: w, height: h, data } = image;
  let transparent = 0;
  let total = 0;
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  const sample = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    total++;
    if (data[i + 3] < 16) {
      transparent++;
      return;
    }
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    const b = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    b.n++;
    b.r += data[i];
    b.g += data[i + 1];
    b.b += data[i + 2];
    buckets.set(key, b);
  };
  const stepX = Math.max(1, Math.floor(w / 400));
  const stepY = Math.max(1, Math.floor(h / 400));
  for (let x = 0; x < w; x += stepX) {
    sample(x, 0);
    sample(x, h - 1);
  }
  for (let y = 0; y < h; y += stepY) {
    sample(0, y);
    sample(w - 1, y);
  }
  let best: { n: number; r: number; g: number; b: number } | null = null;
  for (const b of buckets.values()) if (!best || b.n > best.n) best = b;
  const color: [number, number, number] = best
    ? [Math.round(best.r / best.n), Math.round(best.g / best.n), Math.round(best.b / best.n)]
    : [255, 255, 255];
  return { color, alreadyTransparent: total > 0 && transparent / total > 0.6 };
}

/** Arka planı hesaplar (görseli değiştirmez). */
export function computeRemoval(
  image: ImageData,
  bg: Background,
  options: RemoveOptions,
): Removal {
  const { width: w, height: h, data } = image;
  const n = w * h;
  const tol = options.tolerance * 2.55; // 0–255 ölçeği
  const [br, bgG, bb] = bg.color;
  const dist = new Uint8Array(n); // arka plan rengine uzaklık, 0–255
  const removable = new Uint8Array(n);
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    if (data[i + 3] < 16) {
      removable[p] = 1;
      continue;
    }
    const dr = data[i] - br;
    const dg = data[i + 1] - bgG;
    const db = data[i + 2] - bb;
    const d = Math.min(255, (Math.sqrt(dr * dr + dg * dg + db * db) / 441.67) * 255);
    dist[p] = d;
    if (d <= tol) removable[p] = 1;
  }

  const removed = new Uint8Array(n);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  const seed = (p: number) => {
    if (removable[p] && !removed[p]) {
      removed[p] = 1;
      queue[tail++] = p;
    }
  };
  for (let x = 0; x < w; x++) {
    seed(x);
    seed((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    seed(y * w);
    seed(y * w + w - 1);
  }
  while (head < tail) {
    const p = queue[head++];
    const x = p % w;
    if (x > 0) seed(p - 1);
    if (x < w - 1) seed(p + 1);
    if (p >= w) seed(p - w);
    if (p < n - w) seed(p + w);
  }
  if (options.includeInner && tail > 0) {
    // Kenara bağlı olmayan benzer bölgeler (harf içleri vb.)
    for (let p = 0; p < n; p++) if (removable[p]) removed[p] = 1;
  }

  // Nihai alfa: silinenler 0; sınırdaki piksellerde renk uzaklığına göre yumuşak geçiş
  const alpha = new Uint8ClampedArray(n);
  let count = 0;
  for (let p = 0; p < n; p++) {
    if (removed[p]) count++;
    else alpha[p] = data[p * 4 + 3];
  }
  const soft = tol * 0.8 + 8;
  for (let p = 0; p < n; p++) {
    if (removed[p]) continue;
    const x = p % w;
    const edge =
      (x > 0 && removed[p - 1]) ||
      (x < w - 1 && removed[p + 1]) ||
      (p >= w && removed[p - w]) ||
      (p < n - w && removed[p + w]);
    if (!edge) continue;
    const t = Math.min(1, Math.max(0, (dist[p] - tol) / soft));
    alpha[p] = Math.round(alpha[p] * (0.25 + 0.75 * t));
  }
  return { alpha, removed, count, removedRatio: count / n };
}

/* ───────────── Matrix yağmuru animasyonu ───────────── */

export type RainPlan = {
  /** Yağmur sütununun genişliği (piksel). */
  cell: number;
  cols: number;
  /** Her sütunun başlama gecikmesi (0–maxDelay, ilerlemenin kesri). */
  delay: Float32Array;
  /** Hız eğrisi: <1 ağır başlar hızlanır, >1 hızlı başlar yavaşlar. */
  gamma: Float32Array;
  maxDelay: number;
};

const RAIN_GREEN: [number, number, number] = [0, 255, 102];
const GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜ0123456789:.=*+-<>';

/** Hızlı, tekrarlanabilir sözde rastgele sayı (0–1). */
function hash(a: number, b: number, c = 0) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Görselin genişliğine göre sütunlar ve rastgele gecikmeler. */
export function createRainPlan(width: number, seed = 7): RainPlan {
  const cell = Math.max(8, Math.round(width / 44));
  const cols = Math.ceil(width / cell);
  const maxDelay = 0.42;
  const delay = new Float32Array(cols);
  const gamma = new Float32Array(cols);
  for (let c = 0; c < cols; c++) {
    delay[c] = hash(c, seed, 1) * maxDelay;
    gamma[c] = 0.8 + hash(c, seed, 2) * 0.55;
  }
  return { cell, cols, delay, gamma, maxDelay };
}

function columnHead(plan: RainPlan, c: number, progress: number, height: number, trail: number) {
  const q = Math.min(1, Math.max(0, (progress - plan.delay[c]) / (1 - plan.maxDelay)));
  return Math.pow(q, plan.gamma[c]) * (height + trail);
}

/**
 * Animasyonun bir karesinin piksel katmanı. progress 0 → özgün, 1'e yaklaştıkça sütunlar yağarak arka planı siler.
 * Yağmurun önündeki arka plan yeşile boyanıp titreşerek çözülür.
 */
export function renderErase(
  base: ImageData,
  removal: Removal,
  plan: RainPlan,
  progress: number,
  frame: number,
  out: ImageData,
) {
  const { width: w, height: h, data } = base;
  const o = out.data;
  o.set(data);
  if (removal.count === 0) return;
  const trail = Math.max(24, h * 0.2);
  const heads = new Float32Array(plan.cols);
  for (let c = 0; c < plan.cols; c++) heads[c] = columnHead(plan, c, progress, h, trail);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const p = row + x;
      if (!removal.removed[p]) continue;
      const dy = heads[Math.min(plan.cols - 1, (x / plan.cell) | 0)] - y; // >0: yağmur bu satırı geçti
      if (dy <= 0) continue;
      const i = p * 4;
      if (dy >= trail) {
        o[i + 3] = 0;
        continue;
      }
      const pos = dy / trail; // 0 = yağmurun ucu, 1 = tamamen silinmiş
      const flicker = 0.78 + 0.22 * hash(x, y, frame >> 1);
      const glow = (1 - pos) * (1 - pos);
      const mix = Math.min(1, 0.9 * glow + 0.15);
      o[i] = data[i] + (RAIN_GREEN[0] - data[i]) * mix;
      o[i + 1] = data[i + 1] + (RAIN_GREEN[1] - data[i + 1]) * mix;
      o[i + 2] = data[i + 2] + (RAIN_GREEN[2] - data[i + 2]) * mix;
      o[i + 3] = data[i + 3] * (1 - pos) * flicker;
    }
  }
}

/** Yağmurun glifleri (katakana/rakam): yalnızca silinmekte olan arka planın üstüne çizilir. */
export function drawRain(
  ctx: CanvasRenderingContext2D,
  removal: Removal,
  plan: RainPlan,
  progress: number,
  frame: number,
  width: number,
  height: number,
) {
  if (removal.count === 0) return;
  const trail = Math.max(24, height * 0.2);
  const size = Math.round(plan.cell * 1.05);
  const step = size * 1.15;
  const count = Math.min(14, Math.ceil(trail / step));
  ctx.save();
  ctx.font = `${size}px ui-monospace, "Cascadia Mono", Consolas, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let c = 0; c < plan.cols; c++) {
    const head = columnHead(plan, c, progress, height, trail);
    if (head <= 0 || head >= height + trail) continue;
    const cx = Math.min(width - 1, Math.round(c * plan.cell + plan.cell / 2));
    for (let k = 0; k < count; k++) {
      const y = head - k * step;
      if (y < 0 || y >= height) continue;
      if (!removal.removed[(y | 0) * width + cx]) continue;
      const glyph = GLYPHS[Math.floor(hash(c, k, (frame >> 2) + (k === 0 ? frame : 0)) * GLYPHS.length)];
      const fade = 1 - k / count;
      if (k === 0) {
        ctx.shadowColor = 'rgba(0,255,102,0.9)';
        ctx.shadowBlur = size * 0.9;
        ctx.fillStyle = '#e8fff0';
      } else {
        ctx.shadowBlur = 0;
        ctx.fillStyle = `rgba(0,255,102,${(0.12 + fade * 0.75).toFixed(2)})`;
      }
      ctx.fillText(glyph, cx, y);
    }
  }
  ctx.restore();
}

/** Tamamlanmış sonuç: silinenler şeffaf, kenarlar yumuşak. */
export function renderFinal(base: ImageData, removal: Removal, out: ImageData) {
  out.data.set(base.data);
  const o = out.data;
  for (let p = 0, i = 3; p < removal.alpha.length; p++, i += 4) {
    o[i] = removal.removed[p] ? 0 : removal.alpha[p];
  }
}

/** Sonucu PNG dosyasına çevirir; 4,5 MB'ı aşarsa küçülterek tekrar dener. */
export async function exportPng(
  base: ImageData,
  removal: Removal,
  fileName: string,
): Promise<File> {
  const out = new ImageData(base.width, base.height);
  renderFinal(base, removal, out);
  let scale = 1;
  for (let attempt = 0; attempt < 4; attempt++) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(base.width * scale));
    canvas.height = Math.max(1, Math.round(base.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Görsel kaydedilemedi.');
    if (scale === 1) {
      ctx.putImageData(out, 0, 0);
    } else {
      const full = document.createElement('canvas');
      full.width = base.width;
      full.height = base.height;
      full.getContext('2d')!.putImageData(out, 0, 0);
      ctx.drawImage(full, 0, 0, canvas.width, canvas.height);
    }
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Görsel kaydedilemedi.');
    if (blob.size <= 4.5 * 1024 * 1024) return new File([blob], fileName, { type: 'image/png' });
    scale *= 0.75;
  }
  throw new Error('Görsel çok büyük. Daha küçük bir dosya deneyin.');
}
