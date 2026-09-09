export type BasketballWelcomeStrings = {
  chooseLanguage: string;
  languageHint: string;
  continue: string;
  challengeEyebrow: string;
  challengeTitle: string;
  challengeText: string;
  start: string;
  dragHint: string;
  score: string;
  attempts: string;
  skip: string;
  successTitle: string;
  successText: string;
  retry: string;
};

const STRINGS: Record<string, BasketballWelcomeStrings> = {
  tr: {
    chooseLanguage: 'Dil seçiniz',
    languageHint: 'Seçtiğin dil menüde de kullanılacak.',
    continue: 'Devam et',
    challengeEyebrow: 'MENÜ MÜCADELESİ',
    challengeTitle: 'Menüyü görmek mi istiyorsun?',
    challengeText: 'O zaman yeteneğinle bunu hak et. Topu aşağı çek, potayı hedefle ve bırak!',
    start: 'Meydan okumayı başlat',
    dragHint: 'Topu aşağı çek ve bırak',
    score: 'Basket',
    attempts: 'Atış',
    skip: 'Oyunu atla',
    successTitle: 'Basket! Başardın',
    successText: 'Menünün kilidi açıldı. Lezzetler seni bekliyor.',
    retry: 'Bir daha dene!',
  },
  en: {
    chooseLanguage: 'Choose language',
    languageHint: 'Your selection will also be used in the menu.',
    continue: 'Continue',
    challengeEyebrow: 'MENU CHALLENGE',
    challengeTitle: 'Want to see the menu?',
    challengeText: 'Then earn it with your skill. Pull the ball down, aim for the hoop and release!',
    start: 'Start the challenge',
    dragHint: 'Pull the ball down and release',
    score: 'Score',
    attempts: 'Shots',
    skip: 'Skip game',
    successTitle: 'Swish! You did it',
    successText: 'The menu is unlocked. Great flavors are waiting.',
    retry: 'Try again!',
  },
  ru: {
    chooseLanguage: 'Выберите язык',
    languageHint: 'Выбранный язык будет использоваться и в меню.',
    continue: 'Продолжить',
    challengeEyebrow: 'ИСПЫТАНИЕ МЕНЮ',
    challengeTitle: 'Хотите увидеть меню?',
    challengeText: 'Тогда заслужите это мастерством. Потяните мяч вниз, прицельтесь и отпустите!',
    start: 'Начать испытание',
    dragHint: 'Потяните мяч вниз и отпустите',
    score: 'Попадания',
    attempts: 'Броски',
    skip: 'Пропустить игру',
    successTitle: 'В корзине! Получилось',
    successText: 'Меню открыто. Вкусные блюда уже ждут.',
    retry: 'Ещё раз!',
  },
  ar: {
    chooseLanguage: 'اختر اللغة',
    languageHint: 'سيتم استخدام اللغة المختارة في القائمة أيضاً.',
    continue: 'متابعة',
    challengeEyebrow: 'تحدي القائمة',
    challengeTitle: 'هل تريد رؤية القائمة؟',
    challengeText: 'إذن استحقها بمهارتك. اسحب الكرة إلى الأسفل، صوب نحو السلة ثم اتركها!',
    start: 'ابدأ التحدي',
    dragHint: 'اسحب الكرة إلى الأسفل ثم اتركها',
    score: 'أهداف',
    attempts: 'رميات',
    skip: 'تخطي اللعبة',
    successTitle: 'سلة! لقد نجحت',
    successText: 'تم فتح القائمة. النكهات الرائعة بانتظارك.',
    retry: 'حاول مرة أخرى!',
  },
  de: {
    chooseLanguage: 'Sprache wählen',
    languageHint: 'Diese Sprache wird auch im Menü verwendet.',
    continue: 'Weiter',
    challengeEyebrow: 'MENÜ-CHALLENGE',
    challengeTitle: 'Du möchtest das Menü sehen?',
    challengeText: 'Dann verdiene es mit Geschick. Zieh den Ball nach unten, ziele auf den Korb und lass los!',
    start: 'Challenge starten',
    dragHint: 'Ball nach unten ziehen und loslassen',
    score: 'Treffer',
    attempts: 'Würfe',
    skip: 'Spiel überspringen',
    successTitle: 'Treffer! Geschafft',
    successText: 'Das Menü ist freigeschaltet. Köstlichkeiten warten auf dich.',
    retry: 'Noch einmal!',
  },
  fr: {
    chooseLanguage: 'Choisir la langue',
    languageHint: 'Cette langue sera aussi utilisée dans le menu.',
    continue: 'Continuer',
    challengeEyebrow: 'DÉFI DU MENU',
    challengeTitle: 'Tu veux voir le menu ?',
    challengeText: 'Alors mérite-le avec ton talent. Tire le ballon vers le bas, vise le panier et relâche !',
    start: 'Commencer le défi',
    dragHint: 'Tire le ballon vers le bas et relâche',
    score: 'Paniers',
    attempts: 'Tirs',
    skip: 'Passer le jeu',
    successTitle: 'Panier ! Bravo',
    successText: 'Le menu est déverrouillé. De belles saveurs t’attendent.',
    retry: 'Réessaie !',
  },
  es: {
    chooseLanguage: 'Elige el idioma',
    languageHint: 'Ese idioma también se usará en el menú.',
    continue: 'Continuar',
    challengeEyebrow: 'RETO DEL MENÚ',
    challengeTitle: '¿Quieres ver el menú?',
    challengeText: 'Entonces gánatelo con tu habilidad. Tira del balón hacia abajo, apunta y suelta.',
    start: 'Empezar el reto',
    dragHint: 'Tira del balón hacia abajo y suelta',
    score: 'Canastas',
    attempts: 'Tiros',
    skip: 'Saltar juego',
    successTitle: '¡Canasta! Lo lograste',
    successText: 'El menú está desbloqueado. Grandes sabores te esperan.',
    retry: '¡Otra vez!',
  },
};

export function basketballWelcomeUi(code?: string | null): BasketballWelcomeStrings {
  const lang = (code || 'tr').toLowerCase().split('-')[0];
  return STRINGS[lang] || STRINGS.en;
}
