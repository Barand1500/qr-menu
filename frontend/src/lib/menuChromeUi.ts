/** Müşteri menü arayüz metinleri (yan menü, ayarlar) — dil koduna göre */

export type SideMenuCopy = {
  menu: string;
  home: string;
  about: string;
  lang: string;
  close: string;
};

const SIDE_MENU: Record<string, SideMenuCopy> = {
  tr: { menu: 'Menü', home: 'Anasayfa', about: 'Hakkımızda', lang: 'Dil Seçimi', close: 'Kapat' },
  en: { menu: 'Menu', home: 'Home', about: 'About', lang: 'Language', close: 'Close' },
  ru: { menu: 'Меню', home: 'Главная', about: 'О нас', lang: 'Язык', close: 'Закрыть' },
  ar: { menu: 'القائمة', home: 'الرئيسية', about: 'من نحن', lang: 'اللغة', close: 'إغلاق' },
  de: { menu: 'Menü', home: 'Startseite', about: 'Über uns', lang: 'Sprache', close: 'Schließen' },
  fr: { menu: 'Menu', home: 'Accueil', about: 'À propos', lang: 'Langue', close: 'Fermer' },
  es: { menu: 'Menú', home: 'Inicio', about: 'Nosotros', lang: 'Idioma', close: 'Cerrar' },
  it: { menu: 'Menu', home: 'Home', about: 'Chi siamo', lang: 'Lingua', close: 'Chiudi' },
  nl: { menu: 'Menu', home: 'Home', about: 'Over ons', lang: 'Taal', close: 'Sluiten' },
  pt: { menu: 'Menu', home: 'Início', about: 'Sobre', lang: 'Idioma', close: 'Fechar' },
  az: { menu: 'Menyu', home: 'Ana səhifə', about: 'Haqqımızda', lang: 'Dil', close: 'Bağla' },
  uk: { menu: 'Меню', home: 'Головна', about: 'Про нас', lang: 'Мова', close: 'Закрити' },
  zh: { menu: '菜单', home: '首页', about: '关于我们', lang: '语言', close: '关闭' },
  ja: { menu: 'メニュー', home: 'ホーム', about: '私たちについて', lang: '言語', close: '閉じる' },
  ko: { menu: '메뉴', home: '홈', about: '소개', lang: '언어', close: '닫기' },
  fa: { menu: 'منو', home: 'خانه', about: 'درباره ما', lang: 'زبان', close: 'بستن' },
  he: { menu: 'תפריט', home: 'בית', about: 'אודות', lang: 'שפה', close: 'סגור' },
  el: { menu: 'Μενού', home: 'Αρχική', about: 'Σχετικά', lang: 'Γλώσσα', close: 'Κλείσιμο' },
  pl: { menu: 'Menu', home: 'Start', about: 'O nas', lang: 'Język', close: 'Zamknij' },
  ro: { menu: 'Meniu', home: 'Acasă', about: 'Despre', lang: 'Limbă', close: 'Închide' },
  bg: { menu: 'Меню', home: 'Начало', about: 'За нас', lang: 'Език', close: 'Затвори' },
  hu: { menu: 'Menü', home: 'Kezdőlap', about: 'Rólunk', lang: 'Nyelv', close: 'Bezárás' },
  cs: { menu: 'Menu', home: 'Domů', about: 'O nás', lang: 'Jazyk', close: 'Zavřít' },
  sv: { menu: 'Meny', home: 'Hem', about: 'Om oss', lang: 'Språk', close: 'Stäng' },
  no: { menu: 'Meny', home: 'Hjem', about: 'Om oss', lang: 'Språk', close: 'Lukk' },
  da: { menu: 'Menu', home: 'Hjem', about: 'Om os', lang: 'Sprog', close: 'Luk' },
  fi: { menu: 'Valikko', home: 'Koti', about: 'Tietoa', lang: 'Kieli', close: 'Sulje' },
  hi: { menu: 'मेनू', home: 'होम', about: 'हमारे बारे में', lang: 'भाषा', close: 'बंद' },
  th: { menu: 'เมนู', home: 'หน้าแรก', about: 'เกี่ยวกับเรา', lang: 'ภาษา', close: 'ปิด' },
  vi: { menu: 'Thực đơn', home: 'Trang chủ', about: 'Về chúng tôi', lang: 'Ngôn ngữ', close: 'Đóng' },
};

export function sideMenuUi(lang: string): SideMenuCopy {
  const code = (lang || 'tr').split('-')[0].toLowerCase();
  return SIDE_MENU[code] || SIDE_MENU.en;
}
