export type CupsWelcomeStrings = {
  chooseLanguage: string;
  languageHint: string;
  enterMenu: string;
  lockedTitle: string;
  lockedText: string;
  watchKey: string;
  findHint: string;
  wrongTitle: string;
  wrongText: string;
  skip: string;
  unlockTitle: string;
  unlockText: string;
  round: string;
};

const STRINGS: Record<string, CupsWelcomeStrings> = {
  tr: {
    chooseLanguage: 'Dil seçiniz',
    languageHint: 'Seçtiğin dil menüde de kullanılacak.',
    enterMenu: 'Menüye gir',
    lockedTitle: 'Menü kilitli',
    lockedText: 'Anahtar masaya düşüyor… bir bardak onu saklayacak.',
    watchKey: 'Anahtarı izle',
    findHint: 'Anahtar hangi bardakta?',
    wrongTitle: 'Yanlış bardak',
    wrongText: 'Anahtar buradaymış. Yeni tur başlıyor…',
    skip: 'Oyunu atla',
    unlockTitle: 'Kilit açıldı',
    unlockText: 'Menü artık senin. Afiyet olsun.',
    round: 'Tur',
  },
  en: {
    chooseLanguage: 'Choose language',
    languageHint: 'Your selection will also be used in the menu.',
    enterMenu: 'Enter menu',
    lockedTitle: 'Menu locked',
    lockedText: 'The key drops onto the table… one cup will hide it.',
    watchKey: 'Watch the key',
    findHint: 'Which cup hides the key?',
    wrongTitle: 'Wrong cup',
    wrongText: 'The key was here. Starting a new round…',
    skip: 'Skip game',
    unlockTitle: 'Unlocked',
    unlockText: 'The menu is yours. Enjoy.',
    round: 'Round',
  },
  ru: {
    chooseLanguage: 'Выберите язык',
    languageHint: 'Выбранный язык будет использоваться и в меню.',
    enterMenu: 'Войти в меню',
    lockedTitle: 'Меню закрыто',
    lockedText: 'Ключ падает на стол… один бокал спрячет его.',
    watchKey: 'Следите за ключом',
    findHint: 'Под каким бокалом ключ?',
    wrongTitle: 'Неверный бокал',
    wrongText: 'Ключ был здесь. Новый раунд…',
    skip: 'Пропустить игру',
    unlockTitle: 'Открыто',
    unlockText: 'Меню теперь ваше. Приятного аппетита.',
    round: 'Раунд',
  },
  ar: {
    chooseLanguage: 'اختر اللغة',
    languageHint: 'سيتم استخدام اللغة المختارة في القائمة أيضاً.',
    enterMenu: 'دخول القائمة',
    lockedTitle: 'القائمة مقفلة',
    lockedText: 'المفتاح يسقط على الطاولة… كأس واحد سيخفيه.',
    watchKey: 'راقب المفتاح',
    findHint: 'أي كأس يخفي المفتاح؟',
    wrongTitle: 'كأس خاطئ',
    wrongText: 'كان المفتاح هنا. جولة جديدة…',
    skip: 'تخطي اللعبة',
    unlockTitle: 'تم الفتح',
    unlockText: 'القائمة لك الآن. بالهناء والشفاء.',
    round: 'جولة',
  },
  de: {
    chooseLanguage: 'Sprache wählen',
    languageHint: 'Deine Auswahl gilt auch im Menü.',
    enterMenu: 'Zum Menü',
    lockedTitle: 'Menü gesperrt',
    lockedText: 'Der Schlüssel fällt auf den Tisch… ein Glas versteckt ihn.',
    watchKey: 'Schlüssel beobachten',
    findHint: 'Unter welchem Glas liegt der Schlüssel?',
    wrongTitle: 'Falsches Glas',
    wrongText: 'Der Schlüssel war hier. Neue Runde…',
    skip: 'Spiel überspringen',
    unlockTitle: 'Entriegelt',
    unlockText: 'Das Menü gehört dir. Guten Appetit.',
    round: 'Runde',
  },
  fr: {
    chooseLanguage: 'Choisir la langue',
    languageHint: 'Votre choix sera aussi utilisé dans le menu.',
    enterMenu: 'Entrer au menu',
    lockedTitle: 'Menu verrouillé',
    lockedText: 'La clé tombe sur la table… un verre la cachera.',
    watchKey: 'Regardez la clé',
    findHint: 'Sous quel verre est la clé ?',
    wrongTitle: 'Mauvais verre',
    wrongText: 'La clé était ici. Nouveau tour…',
    skip: 'Passer le jeu',
    unlockTitle: 'Déverrouillé',
    unlockText: 'Le menu est à vous. Bon appétit.',
    round: 'Tour',
  },
  es: {
    chooseLanguage: 'Elige el idioma',
    languageHint: 'Tu selección también se usará en el menú.',
    enterMenu: 'Entrar al menú',
    lockedTitle: 'Menú bloqueado',
    lockedText: 'La llave cae sobre la mesa… una copa la esconderá.',
    watchKey: 'Mira la llave',
    findHint: '¿En qué copa está la llave?',
    wrongTitle: 'Copa incorrecta',
    wrongText: 'La llave estaba aquí. Nueva ronda…',
    skip: 'Saltar juego',
    unlockTitle: 'Desbloqueado',
    unlockText: 'El menú es tuyo. Buen provecho.',
    round: 'Ronda',
  },
};

export function cupsWelcomeUi(code?: string | null): CupsWelcomeStrings {
  const base = (code || 'en').toLowerCase().split('-')[0];
  return STRINGS[base] || STRINGS.en;
}
