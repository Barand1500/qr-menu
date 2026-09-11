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

/** Sayfa kökündeki kutuları topla (tek sarmalayıcıyı deler). */
export function collectAdminPageAnimTargets(root: HTMLElement): HTMLElement[] {
  const direct = Array.from(root.children).filter(
    (n): n is HTMLElement => n instanceof HTMLElement
  );
  if (direct.length === 0) return [];

  let pool = direct;
  if (direct.length === 1) {
    const inner = Array.from(direct[0].children).filter(
      (n): n is HTMLElement => n instanceof HTMLElement
    );
    if (inner.length >= 2) pool = inner;
  }

  return pool.filter((el) => {
    const tag = el.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'LINK') return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    return true;
  });
}
