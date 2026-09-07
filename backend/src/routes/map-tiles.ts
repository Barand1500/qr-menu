import { Router } from 'express';

const router = Router();

/**
 * OSM karolarını kendi domainimiz üzerinden proxy'ler.
 * tile.openstreetmap.org Referer zorunlu kıldığı için tarayıcıdan
 * doğrudan çekmek (özellikle no-referrer header'lı sunucularda) 403 verir.
 */
router.get('/:z/:x/:y.png', async (req, res) => {
  const z = Number(req.params.z);
  const x = Number(req.params.x);
  const y = Number(req.params.y);
  if (
    ![z, x, y].every((n) => Number.isInteger(n) && n >= 0) ||
    z > 19 ||
    x >= 2 ** z ||
    y >= 2 ** z
  ) {
    return res.status(400).end();
  }

  try {
    const upstream = await fetch(`https://tile.openstreetmap.org/${z}/${x}/${y}.png`, {
      headers: {
        'User-Agent': 'MenuQR/1.0 (https://menu.guzelteknoloji.com; geo-lock)',
        Referer: 'https://menu.guzelteknoloji.com/',
      },
    });
    if (!upstream.ok) {
      return res.status(upstream.status).end();
    }
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.send(buf);
  } catch {
    res.status(502).end();
  }
});

export default router;
