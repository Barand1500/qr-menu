import { useEffect } from 'react';

/**
 * Menü sayfasında gövde (html/body) arka planını temanın rengine eşitler. Telefonda aşağı çekince,
 * adres çubuğu açılıp kapanınca ya da sayfa sonunda görünen boşluk beyaz kalmasın.
 */
const SELECTOR = '.sahne, .pd, .public-menu-page';
const VARS = ['--sh-bg', '--pd-bg', '--menu-bg'];

function themeColor(): string | null {
  const el = document.querySelector<HTMLElement>(SELECTOR);
  if (!el) return null;
  for (let node: HTMLElement | null = el; node; node = node.parentElement) {
    const c = getComputedStyle(node).backgroundColor;
    if (c && c !== 'transparent' && !/rgba\(\s*0,\s*0,\s*0,\s*0\s*\)/.test(c)) return c;
  }
  const cs = getComputedStyle(el);
  for (const v of VARS) {
    const val = cs.getPropertyValue(v).trim();
    if (val) return val;
  }
  return null;
}

export function usePageBackdrop() {
  useEffect(() => {
    // Karşılama ekranı kendi rengini yönetir
    const html = document.documentElement;
    const body = document.body;
    const prev = { html: html.style.backgroundColor, body: body.style.backgroundColor };
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const createdMeta = !meta;
    const prevMeta = meta?.content ?? '';
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    let raf = 0;
    const apply = () => {
      raf = 0;
      if (document.querySelector('.welcome-scene')) return;
      const color = themeColor();
      if (!color) return;
      html.style.backgroundColor = color;
      body.style.backgroundColor = color;
      if (meta) meta.content = color;
    };
    const schedule = () => {
      if (!raf) raf = window.requestAnimationFrame(apply);
    };
    schedule();
    const t1 = window.setTimeout(schedule, 400);
    const t2 = window.setTimeout(schedule, 1500);
    const attrs = new MutationObserver(schedule);
    attrs.observe(html, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
    const root = document.getElementById('root');
    const kids = new MutationObserver(schedule);
    if (root) kids.observe(root, { childList: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      attrs.disconnect();
      kids.disconnect();
      window.removeEventListener('resize', schedule);
      html.style.backgroundColor = prev.html;
      body.style.backgroundColor = prev.body;
      if (createdMeta) meta?.remove();
      else if (meta) meta.content = prevMeta;
    };
  }, []);
}
