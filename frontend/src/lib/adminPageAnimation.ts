/** Admin sayfa giriş animasyonu — her zaman “fazla” kayma */

export function getAdminPageAnimPreset() {
  return {
    y: 56,
    duration: 0.62,
    stagger: 0.085,
    scale: 0.96,
    ease: 'power3.out' as const,
  };
}

/** Sayfa kökündeki kutuları topla (tek / iç içe sarmalayıcıları deler). */
export function collectAdminPageAnimTargets(root: HTMLElement): HTMLElement[] {
  let pool = Array.from(root.children).filter(
    (n): n is HTMLElement => n instanceof HTMLElement
  );
  if (pool.length === 0) return [];

  // Tek çocuk → içeriğe in (en fazla 2 seviye)
  for (let depth = 0; depth < 2; depth++) {
    if (pool.length !== 1) break;
    const inner = Array.from(pool[0].children).filter(
      (n): n is HTMLElement => n instanceof HTMLElement
    );
    if (inner.length < 2) break;
    pool = inner;
  }

  return pool.filter((el) => {
    const tag = el.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'LINK') return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    return true;
  });
}
