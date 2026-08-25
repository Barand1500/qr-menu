import { useEffect } from 'react';
import { isRtlLanguage } from '@/lib/rtl';

/**
 * Müşteri menüsünde seçilen dile göre html dir/lang ayarlar.
 * Admin paneline dokunmaz; sayfa unmount olunca LTR’ye döner.
 */
export function usePublicRtl(lang: string) {
  useEffect(() => {
    const root = document.documentElement;
    const rtl = isRtlLanguage(lang);
    const prevDir = root.getAttribute('dir');
    const prevLang = root.getAttribute('lang');

    root.setAttribute('dir', rtl ? 'rtl' : 'ltr');
    root.setAttribute('lang', lang || 'tr');
    root.classList.toggle('public-rtl', rtl);

    return () => {
      if (prevDir) root.setAttribute('dir', prevDir);
      else root.setAttribute('dir', 'ltr');
      if (prevLang) root.setAttribute('lang', prevLang);
      else root.removeAttribute('lang');
      root.classList.remove('public-rtl');
    };
  }, [lang]);
}
