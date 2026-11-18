/**
 * Tarayıcıda çalışan, düz renkli arka planlar için arka plan silici. Görsel dışarı gönderilmez.
 *
 * Yöntem: kenarlardaki baskın rengi arka plan sayar; bu renge yeterince yakın piksellere kenarlardan içeri
 * doğru yayılarak (BFS) ulaşılır. Her piksel kaçıncı adımda silindiğini (depth) saklar; silinme animasyonu
 * bu sırayı kullanır. Kapalı bölgeler (ör. harf içleri) isteğe bağlı olarak ayrıca silinir.
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
  /** 0 = silinmedi; >0 = silinme sırası. */
  depth: Uint16Array;
  maxDepth: number;
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

  const depth = new Uint16Array(n);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  const seed = (p: number) => {
    if (removable[p] && depth[p] === 0) {
      depth[p] = 1;
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
  let maxDepth = tail > 0 ? 1 : 0;
  while (head < tail) {
    const p = queue[head++];
    const d = depth[p] + 1;
    const x = p % w;
    const neighbors = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p >= w ? p - w : -1, p < n - w ? p + w : -1];
    for (const q of neighbors) {
      if (q >= 0 && removable[q] && depth[q] === 0) {
        depth[q] = Math.min(65535, d);
        if (depth[q] > maxDepth) maxDepth = depth[q];
        queue[tail++] = q;
      }
    }
  }

  if (options.includeInner && maxDepth > 0) {
    // Kenara bağlı olmayan benzer bölgeler animasyonun ortalarında topluca silinir
    const innerDepth = Math.max(1, Math.round(maxDepth * 0.55));
    for (let p = 0; p < n; p++) if (removable[p] && depth[p] === 0) depth[p] = innerDepth;
  }

  // Nihai alfa: silinenler 0; sınırdaki piksellerde renk uzaklığına göre yumuşak geçiş
  const alpha = new Uint8ClampedArray(n);
  let removed = 0;
  for (let p = 0; p < n; p++) {
    if (depth[p] > 0) {
      removed++;
      continue;
    }
    alpha[p] = data[p * 4 + 3];
  }
  const soft = tol * 0.8 + 8;
  for (let p = 0; p < n; p++) {
    if (depth[p] > 0) continue;
    const x = p % w;
    const edge =
      (x > 0 && depth[p - 1] > 0) ||
      (x < w - 1 && depth[p + 1] > 0) ||
      (p >= w && depth[p - w] > 0) ||
      (p < n - w && depth[p + w] > 0);
    if (!edge) continue;
    const t = Math.min(1, Math.max(0, (dist[p] - tol) / soft));
    alpha[p] = Math.round(alpha[p] * (0.25 + 0.75 * t));
  }
  return { alpha, depth, maxDepth, removedRatio: removed / n };
}

/**
 * Silme animasyonunun bir karesi. progress 0 → özgün görsel, 1 → arka plan tamamen silinmiş.
 * Silinen alanın önünde parlayan ince bir "silgi" kuşağı bırakır.
 */
export function renderErase(
  base: ImageData,
  removal: Removal,
  progress: number,
  glow: [number, number, number],
  out: ImageData,
) {
  const { data } = base;
  const o = out.data;
  o.set(data);
  const n = removal.depth.length;
  if (removal.maxDepth === 0) return;
  const done = progress >= 1;
  const band = Math.max(6, removal.maxDepth * 0.05);
  const thr = progress * (removal.maxDepth + band);
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    const d = removal.depth[p];
    if (d > 0) {
      if (done || d <= thr - band) {
        o[i + 3] = 0;
      } else if (d <= thr) {
        const f = (thr - d) / band; // 0 = kuşağın önü, 1 = silinmiş
        const a = 1 - f;
        o[i] = data[i] + (glow[0] - data[i]) * 0.65 * a;
        o[i + 1] = data[i + 1] + (glow[1] - data[i + 1]) * 0.65 * a;
        o[i + 2] = data[i + 2] + (glow[2] - data[i + 2]) * 0.65 * a;
        o[i + 3] = data[i + 3] * a;
      }
    } else if (done) {
      o[i + 3] = removal.alpha[p];
    }
  }
}

/** Sonucu PNG dosyasına çevirir; 4,5 MB'ı aşarsa küçülterek tekrar dener. */
export async function exportPng(
  base: ImageData,
  removal: Removal,
  fileName: string,
): Promise<File> {
  const out = new ImageData(base.width, base.height);
  renderErase(base, removal, 1, [0, 0, 0], out);
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
