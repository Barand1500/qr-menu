/** Karşılama ekranı UI metinleri — sabit 4 dil */
export type WelcomeUiLang = 'tr' | 'en' | 'ru' | 'ar';

export interface WelcomeUiStrings {
  enterMenu: string;
  chooseLanguage: string;
  hint: string;
  suggestionBox: string;
  complaintBox: string;
  suggestionCta: string;
  complaintCta: string;
  musicOn: string;
  musicOff: string;
  musicLoading: string;
  musicStart: string;
  musicAriaOn: string;
  musicAriaOff: string;
  campaign: string;
  table: string;
  loading: string;
  connectionFailed: string;
  tryAgain: string;
  openComplaint: string;
}

const STRINGS: Record<WelcomeUiLang, WelcomeUiStrings> = {
  tr: {
    enterMenu: 'Menüye Gir',
    chooseLanguage: 'Dilinizi seçin',
    hint: 'Deneyiminizi kişiselleştirmek için dil seçimi yapın',
    suggestionBox: 'Öneri Kutusu',
    complaintBox: 'Şikayet Kutusu',
    suggestionCta: 'Önerin var mı? Puan ver',
    complaintCta: 'Bir şey mi olmadı?',
    musicOn: 'Müzik açık',
    musicOff: 'Müzik kapalı',
    musicLoading: 'Müzik yükleniyor',
    musicStart: 'Müziği başlat',
    musicAriaOn: 'Müziği kapat',
    musicAriaOff: 'Müziği aç',
    campaign: 'Kampanya',
    table: 'Masa',
    loading: 'Yükleniyor…',
    connectionFailed: 'Bağlantı kurulamadı',
    tryAgain: 'Tekrar Dene',
    openComplaint: 'Şikayet kutusunu aç',
  },
  en: {
    enterMenu: 'Enter Menu',
    chooseLanguage: 'Choose your language',
    hint: 'Select a language to personalize your experience',
    suggestionBox: 'Suggestion Box',
    complaintBox: 'Complaint Box',
    suggestionCta: 'Have a tip? Rate us',
    complaintCta: 'Something went wrong?',
    musicOn: 'Music on',
    musicOff: 'Music off',
    musicLoading: 'Loading music',
    musicStart: 'Start music',
    musicAriaOn: 'Mute music',
    musicAriaOff: 'Unmute music',
    campaign: 'Campaign',
    table: 'Table',
    loading: 'Loading…',
    connectionFailed: 'Connection failed',
    tryAgain: 'Try again',
    openComplaint: 'Open complaint box',
  },
  ru: {
    enterMenu: 'Войти в меню',
    chooseLanguage: 'Выберите язык',
    hint: 'Выберите язык, чтобы персонализировать опыт',
    suggestionBox: 'Предложения',
    complaintBox: 'Жалобы',
    suggestionCta: 'Есть идея? Оцените нас',
    complaintCta: 'Что-то пошло не так?',
    musicOn: 'Музыка включена',
    musicOff: 'Музыка выключена',
    musicLoading: 'Загрузка музыки',
    musicStart: 'Включить музыку',
    musicAriaOn: 'Выключить музыку',
    musicAriaOff: 'Включить музыку',
    campaign: 'Акция',
    table: 'Стол',
    loading: 'Загрузка…',
    connectionFailed: 'Нет соединения',
    tryAgain: 'Повторить',
    openComplaint: 'Открыть жалобы',
  },
  ar: {
    enterMenu: 'ادخل القائمة',
    chooseLanguage: 'اختر لغتك',
    hint: 'اختر لغة لتخصيص تجربتك',
    suggestionBox: 'صندوق الاقتراحات',
    complaintBox: 'صندوق الشكاوى',
    suggestionCta: 'لديك اقتراح؟ قيّمنا',
    complaintCta: 'هل حدث شيء؟',
    musicOn: 'الموسيقى قيد التشغيل',
    musicOff: 'الموسيقى متوقفة',
    musicLoading: 'جاري تحميل الموسيقى',
    musicStart: 'تشغيل الموسيقى',
    musicAriaOn: 'كتم الموسيقى',
    musicAriaOff: 'تشغيل الموسيقى',
    campaign: 'حملة',
    table: 'طاولة',
    loading: 'جاري التحميل…',
    connectionFailed: 'فشل الاتصال',
    tryAgain: 'أعد المحاولة',
    openComplaint: 'افتح صندوق الشكاوى',
  },
};

export function resolveWelcomeUiLang(code?: string | null): WelcomeUiLang {
  const c = (code || 'tr').toLowerCase().split('-')[0];
  if (c === 'en' || c === 'ru' || c === 'ar' || c === 'tr') return c;
  return 'tr';
}

export function welcomeUi(lang?: string | null): WelcomeUiStrings {
  return STRINGS[resolveWelcomeUiLang(lang)];
}
