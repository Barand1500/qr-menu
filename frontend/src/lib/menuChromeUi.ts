/** Müşteri menü arayüz metinleri (yan menü, ayarlar) — dil koduna göre */

export type SideMenuCopy = {
  menu: string;
  home: string;
  about: string;
  lang: string;
  close: string;
  games: string;
  gamesPromo: string;
  gamesCta: string;
};

const GAMES_EN = {
  games: 'Games',
  gamesPromo: 'Waiter is on the way — play while you wait.',
  gamesCta: 'Start playing',
} as const;

const SIDE_MENU: Record<string, SideMenuCopy> = {
  tr: {
    menu: 'Menü',
    home: 'Anasayfa',
    about: 'Hakkımızda',
    lang: 'Dil Seçimi',
    close: 'Kapat',
    games: 'Oyunlar',
    gamesPromo: 'Garson yolda — beklerken oyun oynayabilirsiniz.',
    gamesCta: 'Oyuna başla',
  },
  en: {
    menu: 'Menu',
    home: 'Home',
    about: 'About',
    lang: 'Language',
    close: 'Close',
    ...GAMES_EN,
  },
  ru: { menu: 'Меню', home: 'Главная', about: 'О нас', lang: 'Язык', close: 'Закрыть', ...GAMES_EN },
  ar: { menu: 'القائمة', home: 'الرئيسية', about: 'من نحن', lang: 'اللغة', close: 'إغلاق', ...GAMES_EN },
  de: { menu: 'Menü', home: 'Startseite', about: 'Über uns', lang: 'Sprache', close: 'Schließen', ...GAMES_EN },
  fr: { menu: 'Menu', home: 'Accueil', about: 'À propos', lang: 'Langue', close: 'Fermer', ...GAMES_EN },
  es: { menu: 'Menú', home: 'Inicio', about: 'Nosotros', lang: 'Idioma', close: 'Cerrar', ...GAMES_EN },
  it: { menu: 'Menu', home: 'Home', about: 'Chi siamo', lang: 'Lingua', close: 'Chiudi', ...GAMES_EN },
  nl: { menu: 'Menu', home: 'Home', about: 'Over ons', lang: 'Taal', close: 'Sluiten', ...GAMES_EN },
  pt: { menu: 'Menu', home: 'Início', about: 'Sobre', lang: 'Idioma', close: 'Fechar', ...GAMES_EN },
  az: { menu: 'Menyu', home: 'Ana səhifə', about: 'Haqqımızda', lang: 'Dil', close: 'Bağla', ...GAMES_EN },
  uk: { menu: 'Меню', home: 'Головна', about: 'Про нас', lang: 'Мова', close: 'Закрити', ...GAMES_EN },
  zh: { menu: '菜单', home: '首页', about: '关于我们', lang: '语言', close: '关闭', ...GAMES_EN },
  ja: { menu: 'メニュー', home: 'ホーム', about: '私たちについて', lang: '言語', close: '閉じる', ...GAMES_EN },
  ko: { menu: '메뉴', home: '홈', about: '소개', lang: '언어', close: '닫기', ...GAMES_EN },
  fa: { menu: 'منو', home: 'خانه', about: 'درباره ما', lang: 'زبان', close: 'بستن', ...GAMES_EN },
  he: { menu: 'תפריט', home: 'בית', about: 'אודות', lang: 'שפה', close: 'סגור', ...GAMES_EN },
  el: { menu: 'Μενού', home: 'Αρχική', about: 'Σχετικά', lang: 'Γλώσσα', close: 'Κλείσιμο', ...GAMES_EN },
  pl: { menu: 'Menu', home: 'Start', about: 'O nas', lang: 'Język', close: 'Zamknij', ...GAMES_EN },
  ro: { menu: 'Meniu', home: 'Acasă', about: 'Despre', lang: 'Limbă', close: 'Închide', ...GAMES_EN },
  bg: { menu: 'Меню', home: 'Начало', about: 'За нас', lang: 'Език', close: 'Затвори', ...GAMES_EN },
  hu: { menu: 'Menü', home: 'Kezdőlap', about: 'Rólunk', lang: 'Nyelv', close: 'Bezárás', ...GAMES_EN },
  cs: { menu: 'Menu', home: 'Domů', about: 'O nás', lang: 'Jazyk', close: 'Zavřít', ...GAMES_EN },
  sv: { menu: 'Meny', home: 'Hem', about: 'Om oss', lang: 'Språk', close: 'Stäng', ...GAMES_EN },
  no: { menu: 'Meny', home: 'Hjem', about: 'Om oss', lang: 'Språk', close: 'Lukk', ...GAMES_EN },
  da: { menu: 'Menu', home: 'Hjem', about: 'Om os', lang: 'Sprog', close: 'Luk', ...GAMES_EN },
  fi: { menu: 'Valikko', home: 'Koti', about: 'Tietoa', lang: 'Kieli', close: 'Sulje', ...GAMES_EN },
  hi: { menu: 'मेनू', home: 'होम', about: 'हमारे बारे में', lang: 'भाषा', close: 'बंद', ...GAMES_EN },
  th: { menu: 'เมนู', home: 'หน้าแรก', about: 'เกี่ยวกับเรา', lang: 'ภาษา', close: 'ปิด', ...GAMES_EN },
  vi: { menu: 'Thực đơn', home: 'Trang chủ', about: 'Về chúng tôi', lang: 'Ngôn ngữ', close: 'Đóng', ...GAMES_EN },
};

export function sideMenuUi(lang: string): SideMenuCopy {
  const code = (lang || 'tr').split('-')[0].toLowerCase();
  return SIDE_MENU[code] || SIDE_MENU.en;
}
