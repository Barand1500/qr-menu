/** Müşteri profil / filtre banner metinleri */

export type CustomerProfileUi = {
  helloFiltered: (name: string) => string;
  helloFilterOff: (name: string) => string;
  closeFilter: string;
  openFilter: string;
  profile: string;
  myProfile: string;
  login: string;
  register: string;
  close: string;
  account: string;
  points: string;
  personalFilter: string;
  personalFilterHint: string;
  fullName: string;
  alcohol: string;
  alcoholHint: string;
  alcoholYes: string;
  alcoholNo: string;
  allergies: string;
  allergiesHint: string;
  diet: string;
  dietHint: string;
  likedFoods: string;
  likedHint: string;
  dislikedFoods: string;
  dislikedHint: string;
  likedPlaceholder: string;
  dislikedPlaceholder: string;
  save: string;
  saving: string;
  logout: string;
  loginRegister: string;
};

const EN: CustomerProfileUi = {
  helloFiltered: (name) => `Hi ${name}, we filtered the menu for you.`,
  helloFilterOff: (name) => `Hi ${name} — personal filter is off.`,
  closeFilter: 'Turn filter off',
  openFilter: 'Turn filter on',
  profile: 'Profile',
  myProfile: 'My profile',
  login: 'Sign in',
  register: 'Sign up',
  close: 'Close',
  account: 'Account',
  points: 'Points',
  personalFilter: 'Personal menu filter',
  personalFilterHint: 'When on, allergies, alcohol and disliked items apply',
  fullName: 'Full name',
  alcohol: 'Alcohol',
  alcoholHint: 'Preference for products that contain alcohol',
  alcoholYes: 'I drink alcohol',
  alcoholNo: 'I don’t drink alcohol',
  allergies: 'Allergies',
  allergiesHint: 'Selected items are hidden from the menu',
  diet: 'Diet / preferences',
  dietHint: 'Matching products are highlighted',
  likedFoods: 'Foods I like',
  likedHint: 'Type a name or category (e.g. pizza, dessert)',
  dislikedFoods: 'Foods I dislike',
  dislikedHint: 'Case-insensitive; hidden if the name matches',
  likedPlaceholder: 'e.g. pizza',
  dislikedPlaceholder: 'e.g. onion',
  save: 'Save',
  saving: 'Saving…',
  logout: 'Log out',
  loginRegister: 'Sign in / Sign up',
};

const TR: CustomerProfileUi = {
  helloFiltered: (name) => `Merhaba ${name}, sizin için menüyü filtreledik.`,
  helloFilterOff: (name) => `Merhaba ${name} — kişisel filtre kapalı.`,
  closeFilter: 'Filtreyi kapat',
  openFilter: 'Filtreyi aç',
  profile: 'Profil',
  myProfile: 'Profilim',
  login: 'Giriş yap',
  register: 'Kayıt ol',
  close: 'Kapat',
  account: 'Hesap',
  points: 'Puan',
  personalFilter: 'Kişisel menü filtresi',
  personalFilterHint: 'Açıkken alerji, alkol ve sevmediklerin uygulanır',
  fullName: 'Ad soyad',
  alcohol: 'Alkol',
  alcoholHint: 'Restoranlarda alkol içeren ürünler için tercih',
  alcoholYes: 'Alkol tüketiyorum',
  alcoholNo: 'Alkol tüketmiyorum',
  allergies: 'Alerjiler',
  allergiesHint: 'Seçtiklerin menüden gizlenir',
  diet: 'Diyet / tercih',
  dietHint: 'Uygun ürünler öne çıkar',
  likedFoods: 'Sevdiğim yemekler',
  likedHint: 'İsim veya kategori yaz (ör. pizza, tatlı)',
  dislikedFoods: 'Sevmediğim yemekler',
  dislikedHint: 'Büyük/küçük harf fark etmez; ürün adında geçerse gizlenir',
  likedPlaceholder: 'Örn. pizza',
  dislikedPlaceholder: 'Örn. soğan',
  save: 'Kaydet',
  saving: 'Kaydediliyor…',
  logout: 'Çıkış yap',
  loginRegister: 'Giriş / Kayıt',
};

const MAP: Record<string, CustomerProfileUi> = {
  tr: TR,
  en: EN,
  de: {
    ...EN,
    helloFiltered: (name) => `Hallo ${name}, wir haben das Menü für Sie gefiltert.`,
    helloFilterOff: (name) => `Hallo ${name} — persönlicher Filter ist aus.`,
    closeFilter: 'Filter aus',
    openFilter: 'Filter an',
    profile: 'Profil',
    myProfile: 'Mein Profil',
    likedFoods: 'Lieblingsgerichte',
    dislikedFoods: 'Nicht mag ich',
    likedHint: 'Name oder Kategorie (z. B. Pizza)',
    dislikedHint: 'Groß/Klein egal; wird ausgeblendet wenn der Name passt',
    personalFilter: 'Persönlicher Menüfilter',
    personalFilterHint: 'Bei Aktivierung gelten Allergien, Alkohol und Abneigungen',
    allergies: 'Allergien',
    diet: 'Diät / Vorlieben',
    save: 'Speichern',
    logout: 'Abmelden',
  },
  ru: {
    ...EN,
    helloFiltered: (name) => `Здравствуйте, ${name}, мы отфильтровали меню для вас.`,
    helloFilterOff: (name) => `Здравствуйте, ${name} — личный фильтр выключен.`,
    closeFilter: 'Выключить фильтр',
    openFilter: 'Включить фильтр',
    profile: 'Профиль',
    myProfile: 'Мой профиль',
    likedFoods: 'Любимые блюда',
    dislikedFoods: 'Нелюбимые блюда',
    personalFilter: 'Личный фильтр меню',
    allergies: 'Аллергии',
    diet: 'Диета / предпочтения',
    save: 'Сохранить',
    logout: 'Выйти',
  },
  fr: {
    ...EN,
    helloFiltered: (name) => `Bonjour ${name}, nous avons filtré le menu pour vous.`,
    helloFilterOff: (name) => `Bonjour ${name} — filtre personnel désactivé.`,
    closeFilter: 'Désactiver le filtre',
    openFilter: 'Activer le filtre',
    profile: 'Profil',
    myProfile: 'Mon profil',
    likedFoods: 'Plats que j’aime',
    dislikedFoods: 'Plats que je n’aime pas',
    personalFilter: 'Filtre de menu personnel',
    allergies: 'Allergies',
    diet: 'Régime / préférences',
    save: 'Enregistrer',
    logout: 'Se déconnecter',
  },
  es: {
    ...EN,
    helloFiltered: (name) => `Hola ${name}, filtramos el menú para ti.`,
    helloFilterOff: (name) => `Hola ${name} — el filtro personal está desactivado.`,
    closeFilter: 'Desactivar filtro',
    openFilter: 'Activar filtro',
    profile: 'Perfil',
    myProfile: 'Mi perfil',
    likedFoods: 'Comidas que me gustan',
    dislikedFoods: 'Comidas que no me gustan',
    personalFilter: 'Filtro personal del menú',
    allergies: 'Alergias',
    diet: 'Dieta / preferencias',
    save: 'Guardar',
    logout: 'Cerrar sesión',
  },
  ar: {
    ...EN,
    helloFiltered: (name) => `مرحباً ${name}، قمنا بتصفية القائمة من أجلك.`,
    helloFilterOff: (name) => `مرحباً ${name} — الفلتر الشخصي متوقف.`,
    closeFilter: 'إيقاف الفلتر',
    openFilter: 'تشغيل الفلتر',
    profile: 'الملف',
    myProfile: 'ملفي',
    likedFoods: 'أطعمة أحبها',
    dislikedFoods: 'أطعمة لا أحبها',
    personalFilter: 'فلتر القائمة الشخصي',
    allergies: 'الحساسية',
    diet: 'نظام غذائي / تفضيلات',
    save: 'حفظ',
    logout: 'تسجيل الخروج',
  },
  it: {
    ...EN,
    helloFiltered: (name) => `Ciao ${name}, abbiamo filtrato il menu per te.`,
    helloFilterOff: (name) => `Ciao ${name} — filtro personale disattivato.`,
    closeFilter: 'Disattiva filtro',
    openFilter: 'Attiva filtro',
    profile: 'Profilo',
    myProfile: 'Il mio profilo',
    likedFoods: 'Piatti che mi piacciono',
    dislikedFoods: 'Piatti che non mi piacciono',
    personalFilter: 'Filtro menu personale',
    allergies: 'Allergie',
    diet: 'Dieta / preferenze',
    save: 'Salva',
    logout: 'Esci',
  },
  az: {
    ...TR,
    helloFiltered: (name) => `Salam ${name}, menyunu sizin üçün filtrlədik.`,
    helloFilterOff: (name) => `Salam ${name} — şəxsi filtr bağlıdır.`,
    closeFilter: 'Filtri bağla',
    openFilter: 'Filtri aç',
    profile: 'Profil',
    myProfile: 'Profilim',
    likedFoods: 'Sevdiyim yeməklər',
    dislikedFoods: 'Sevmədiyim yeməklər',
    personalFilter: 'Şəxsi menyu filtri',
    allergies: 'Allergiyalar',
    diet: 'Diet / üstünlük',
    save: 'Saxla',
    logout: 'Çıxış',
  },
  nl: {
    ...EN,
    helloFiltered: (name) => `Hallo ${name}, we hebben het menu voor je gefilterd.`,
    helloFilterOff: (name) => `Hallo ${name} — persoonlijk filter staat uit.`,
    closeFilter: 'Filter uit',
    openFilter: 'Filter aan',
    profile: 'Profiel',
    likedFoods: 'Gerechten die ik leuk vind',
    dislikedFoods: 'Gerechten die ik niet leuk vind',
  },
  pt: {
    ...EN,
    helloFiltered: (name) => `Olá ${name}, filtrámos o menu para si.`,
    helloFilterOff: (name) => `Olá ${name} — filtro pessoal desligado.`,
    closeFilter: 'Desligar filtro',
    openFilter: 'Ligar filtro',
    profile: 'Perfil',
    likedFoods: 'Comidas de que gosto',
    dislikedFoods: 'Comidas de que não gosto',
  },
};

export function customerProfileUi(lang: string): CustomerProfileUi {
  const code = (lang || 'tr').split('-')[0].toLowerCase();
  return MAP[code] || EN;
}
