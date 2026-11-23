/** Share only the public destination; table codes, campaign/session data and admin query strings stay local. */
export function publicMenuShareUrl(
  path: string,
  origin = window.location.origin,
): string {
  return new URL(path, origin).href;
}

export async function copyShareLink(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const before = document.activeElement as HTMLElement | null;
    const area = document.createElement('textarea');
    area.value = value;
    area.readOnly = true;
    area.style.cssText = 'position:fixed;left:0;top:0;opacity:0;font-size:16px';
    document.body.appendChild(area);
    try {
      area.select();
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      area.remove();
      before?.focus({ preventScroll: true });
    }
  }
}
