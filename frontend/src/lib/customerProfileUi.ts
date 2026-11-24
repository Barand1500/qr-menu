/** Müşteri profil / filtre banner metinleri */

export type CustomerProfileUi = {
  hello: string;
  myCode: string;
  preferences: string;
  myInfo: string;
  perks: string;
  visible: string;
  hidden: string;
  restaurantSees: string;
  accountSections: string;
  personalFilter: string;
  filterMenu: string;
  emptyLiked: string;
  emptyDisliked: string;
  add: string;
  remove: string;
  qrError: string;
  generating: string;
  noCode: string;
  tellWaiter: string;
  refreshCountdown: string;
  refresh: string;
  points: string;
  thisRestaurant: string;
  guest: string;
  restaurant: string;
  privacyHint: string;
  phone: string;
  email: string;
  optional: string;
  contactHint: string;
  pointsAvailable: string;
  discount: string;
  noneYet: string;
  balance: string;
  noDebt: string;
  otherPoints: string;
  searchRestaurant: string;
  noResults: string;
  noOtherPoints: string;
  saved: string;
  unsaved: string;
  saveError: string;
  change: string;
  phoneUpdated: string;
  emailUpdated: string;
  nameUpdated: string;
  newPhone: string;
  newEmail: string;
  cancel: string;
  sendCode: string;
  resend: string;
  seconds: string;
  sendError: string;
  verifyError: string;
  otpLabel: string;
  digit: string;
  codeSms: string;
  codeEmail: string;
  phoneViaEmail: string;
  emailViaPhone: string;
  helloFiltered: (name: string) => string;
  helloFilterOff: (name: string) => string;
  closeFilter: string;
  openFilter: string;
  profile: string;
  myProfile: string;
  login: string;
  register: string;
  close: string;
  personalFilterHint: string;
  fullName: string;
  alcohol: string;
  alcoholYes: string;
  alcoholNo: string;
  allergies: string;
  diet: string;
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
  hello: 'Hello',
  myCode: 'My code',
  preferences: 'Preferences',
  myInfo: 'My details',
  perks: 'Benefits',
  visible: 'Visible',
  hidden: 'Hidden',
  restaurantSees: 'visible to restaurants',
  accountSections: 'Account sections',
  personalFilter: 'Personal filter',
  filterMenu: 'Filter the menu for me',
  emptyLiked: 'No favourites yet',
  emptyDisliked: 'Nothing added yet',
  add: 'Add',
  remove: 'remove',
  qrError: 'Could not generate your code — try refreshing',
  generating: 'Generating…',
  noCode: 'No code',
  tellWaiter: 'Tell your waiter or scan',
  refreshCountdown: 'seconds until refresh',
  refresh: 'Refresh',
  points: 'points',
  thisRestaurant: 'This restaurant',
  guest: 'Guest',
  restaurant: 'Restaurant',
  privacyHint: 'Restaurants only see details you mark as “Visible”.',
  phone: 'Phone',
  email: 'Email',
  optional: 'optional',
  contactHint:
    'Changing your phone or email requires a verification code. Changing your name does not.',
  pointsAvailable: 'points available',
  discount: 'Special discount',
  noneYet: 'None yet',
  balance: 'Balance',
  noDebt: 'No outstanding balance',
  otherPoints: 'Your points at other restaurants',
  searchRestaurant: 'Search restaurants…',
  noResults: 'No results',
  noOtherPoints: 'No points at other restaurants yet',
  saved: 'Saved',
  unsaved: 'You have unsaved changes',
  saveError: 'Could not save',
  change: 'Change',
  phoneUpdated: 'Phone updated',
  emailUpdated: 'Email updated',
  nameUpdated: 'Name updated',
  newPhone: 'New phone: 5XX XXX XX XX',
  newEmail: 'New email address',
  cancel: 'Cancel',
  sendCode: 'Send code',
  resend: 'Resend',
  seconds: 'sec',
  sendError: 'Could not send the code.',
  verifyError: 'Could not verify the code.',
  otpLabel: '6-digit verification code',
  digit: 'digit',
  codeSms: 'was sent a 6-digit code by SMS.',
  codeEmail: 'was sent a 6-digit code by email.',
  phoneViaEmail: 'Your phone change is verified via your account email.',
  emailViaPhone: 'Your email change is verified via your phone.',
  helloFiltered: (name) => `Hi ${name}, we filtered the menu for you.`,
  helloFilterOff: (name) => `Hi ${name} — personal filter is off.`,
  closeFilter: 'Turn filter off',
  openFilter: 'Turn filter on',
  profile: 'Profile',
  myProfile: 'My profile',
  login: 'Sign in',
  register: 'Sign up',
  close: 'Close',
  personalFilterHint: 'When on, allergies, alcohol and disliked items apply',
  fullName: 'Full name',
  alcohol: 'Alcohol',
  alcoholYes: 'I drink alcohol',
  alcoholNo: 'I don’t drink alcohol',
  allergies: 'Allergies',
  diet: 'Diet / preferences',
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
  hello: 'Merhaba',
  myCode: 'Kodum',
  preferences: 'Tercihler',
  myInfo: 'Bilgilerim',
  perks: 'Avantajlar',
  visible: 'Görünür',
  hidden: 'Gizli',
  restaurantSees: 'restoran görür',
  accountSections: 'Hesap bölümleri',
  personalFilter: 'Kişisel filtre',
  filterMenu: 'Menüyü bana göre filtrele',
  emptyLiked: 'Henüz eklemedin',
  emptyDisliked: 'Henüz bir şey yok',
  add: 'Ekle',
  remove: 'kaldır',
  qrError: 'Kişisel kod üretilemedi — yenile’ye bas',
  generating: 'Üretiliyor…',
  noCode: 'Kod yok',
  tellWaiter: 'Garsona söyle veya okut',
  refreshCountdown: 'sn sonra yenilenir',
  refresh: 'Yenile',
  points: 'puan',
  thisRestaurant: 'Bu restoran',
  guest: 'Misafir',
  restaurant: 'Restoran',
  privacyHint: 'Restoranlar yalnızca “Görünür” bıraktığın bilgileri görür.',
  phone: 'Telefon',
  email: 'E-posta',
  optional: 'opsiyonel',
  contactHint:
    'Telefon veya e-posta değişince yeni değere bir doğrulama kodu gönderilir. İsim değişikliği kod istemez.',
  pointsAvailable: 'puanın var',
  discount: 'Özel indirim',
  noneYet: 'Şimdilik yok',
  balance: 'Borç / bakiye',
  noDebt: 'Borcun yok',
  otherPoints: 'Diğer restoranlardaki puanların',
  searchRestaurant: 'Restoran ara…',
  noResults: 'Sonuç yok',
  noOtherPoints: 'Başka restoranda puanın yok',
  saved: 'Kaydedildi',
  unsaved: 'Kaydedilmemiş değişiklikler var',
  saveError: 'Kaydedilemedi',
  change: 'Değiştir',
  phoneUpdated: 'Telefon güncellendi',
  emailUpdated: 'E-posta güncellendi',
  nameUpdated: 'İsim güncellendi',
  newPhone: 'Yeni telefon: 5XX XXX XX XX',
  newEmail: 'Yeni e-posta adresi',
  cancel: 'Vazgeç',
  sendCode: 'Kod gönder',
  resend: 'Tekrar gönder',
  seconds: 'sn',
  sendError: 'Kod gönderilemedi.',
  verifyError: 'Doğrulanamadı.',
  otpLabel: '6 haneli doğrulama kodu',
  digit: 'hane',
  codeSms: 'numarasına SMS ile 6 haneli kod gönderdik.',
  codeEmail: 'adresine e-posta ile 6 haneli kod gönderdik.',
  phoneViaEmail: 'Telefon değişikliği hesabındaki e-postayla doğrulanıyor.',
  emailViaPhone: 'E-posta değişikliği telefonunla doğrulanıyor.',
  helloFiltered: (name) => `Merhaba ${name}, sizin için menüyü filtreledik.`,
  helloFilterOff: (name) => `Merhaba ${name} — kişisel filtre kapalı.`,
  closeFilter: 'Filtreyi kapat',
  openFilter: 'Filtreyi aç',
  profile: 'Profil',
  myProfile: 'Profilim',
  login: 'Giriş yap',
  register: 'Kayıt ol',
  close: 'Kapat',
  personalFilterHint: 'Açıkken alerji, alkol ve sevmediklerin uygulanır',
  fullName: 'Ad Soyad',
  alcohol: 'Alkol',
  alcoholYes: 'Alkol tüketiyorum',
  alcoholNo: 'Alkol tüketmiyorum',
  allergies: 'Alerjiler',
  diet: 'Diyet / tercih',
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
    helloFiltered: (name) =>
      `Hallo ${name}, wir haben das Menü für Sie gefiltert.`,
    helloFilterOff: (name) => `Hallo ${name} — persönlicher Filter ist aus.`,
    closeFilter: 'Filter aus',
    openFilter: 'Filter an',
    profile: 'Profil',
    myProfile: 'Mein Profil',
    likedFoods: 'Lieblingsgerichte',
    dislikedFoods: 'Nicht mag ich',
    likedHint: 'Name oder Kategorie (z. B. Pizza)',
    dislikedHint: 'Groß/Klein egal; wird ausgeblendet wenn der Name passt',
    personalFilterHint:
      'Bei Aktivierung gelten Allergien, Alkohol und Abneigungen',
    allergies: 'Allergien',
    diet: 'Diät / Vorlieben',
    save: 'Speichern',
    logout: 'Abmelden',
  },
  ru: {
    ...EN,
    helloFiltered: (name) =>
      `Здравствуйте, ${name}, мы отфильтровали меню для вас.`,
    helloFilterOff: (name) => `Здравствуйте, ${name} — личный фильтр выключен.`,
    closeFilter: 'Выключить фильтр',
    openFilter: 'Включить фильтр',
    profile: 'Профиль',
    myProfile: 'Мой профиль',
    likedFoods: 'Любимые блюда',
    dislikedFoods: 'Нелюбимые блюда',
    allergies: 'Аллергии',
    diet: 'Диета / предпочтения',
    save: 'Сохранить',
    logout: 'Выйти',
  },
  fr: {
    ...EN,
    helloFiltered: (name) =>
      `Bonjour ${name}, nous avons filtré le menu pour vous.`,
    helloFilterOff: (name) => `Bonjour ${name} — filtre personnel désactivé.`,
    closeFilter: 'Désactiver le filtre',
    openFilter: 'Activer le filtre',
    profile: 'Profil',
    myProfile: 'Mon profil',
    likedFoods: 'Plats que j’aime',
    dislikedFoods: 'Plats que je n’aime pas',
    allergies: 'Allergies',
    diet: 'Régime / préférences',
    save: 'Enregistrer',
    logout: 'Se déconnecter',
  },
  es: {
    ...EN,
    helloFiltered: (name) => `Hola ${name}, filtramos el menú para ti.`,
    helloFilterOff: (name) =>
      `Hola ${name} — el filtro personal está desactivado.`,
    closeFilter: 'Desactivar filtro',
    openFilter: 'Activar filtro',
    profile: 'Perfil',
    myProfile: 'Mi perfil',
    likedFoods: 'Comidas que me gustan',
    dislikedFoods: 'Comidas que no me gustan',
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
    allergies: 'Allergiyalar',
    diet: 'Diet / üstünlük',
    save: 'Saxla',
    logout: 'Çıxış',
  },
  nl: {
    ...EN,
    helloFiltered: (name) =>
      `Hallo ${name}, we hebben het menu voor je gefilterd.`,
    helloFilterOff: (name) => `Hallo ${name} — persoonlijk filter staat uit.`,
    closeFilter: 'Filter uit',
    openFilter: 'Filter aan',
    profile: 'Profiel',
    myProfile: 'Mijn profiel',
    likedFoods: 'Gerechten die ik leuk vind',
    dislikedFoods: 'Gerechten die ik niet leuk vind',
    allergies: 'Allergieën',
    diet: 'Dieet / voorkeur',
    save: 'Opslaan',
    logout: 'Uitloggen',
  },
  pt: {
    ...EN,
    helloFiltered: (name) => `Olá ${name}, filtrámos o menu para si.`,
    helloFilterOff: (name) => `Olá ${name} — o filtro pessoal está desligado.`,
    closeFilter: 'Desligar filtro',
    openFilter: 'Ligar filtro',
    profile: 'Perfil',
    myProfile: 'O meu perfil',
    likedFoods: 'Comidas de que gosto',
    dislikedFoods: 'Comidas de que não gosto',
    allergies: 'Alergias',
    diet: 'Dieta / preferência',
    save: 'Guardar',
    logout: 'Terminar sessão',
  },
};

export function customerProfileUi(lang: string): CustomerProfileUi {
  const key = String(lang || 'tr')
    .toLowerCase()
    .slice(0, 2);
  return MAP[key] || EN;
}
