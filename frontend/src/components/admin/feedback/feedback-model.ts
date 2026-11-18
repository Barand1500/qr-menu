export type FeedbackKind = 'suggestion' | 'complaint';

export interface FeedbackItem {
  id: number;
  fullName?: string | null;
  phone?: string | null;
  email?: string | null;
  message?: string | null;
  rating?: number;
  isRead: boolean;
  createdAt: string;
}

export const FEEDBACK_COPY = {
  suggestion: {
    title: 'Öneri Kutusu',
    noun: 'öneri',
    endpoint: 'suggestions',
    description: 'Misafirlerinizden gelen notlar ve puanlar.',
    unreadSuffix: ' okunmamış not · Misafirlerinize kulak verin.',
    filterLabel: 'Öneri görünümü',
    searchLabel: 'Öneri ara',
    searchPlaceholder: 'İsim, iletişim bilgisi veya not ara',
    refreshLabel: 'Önerileri yenile',
    listLabel: 'Öneriler',
    listHeading: 'GELEN NOTLAR',
    loadingLabel: 'Öneriler yükleniyor',
    loadError: 'Notlar yüklenemedi.',
    emptySearch: 'Bu aramada not yok.',
    emptyInbox: 'İlk güzel fikri bekliyoruz.',
    emptyUnreadHelp: 'Diğer notlara Tümü bölümünden ulaşabilirsiniz.',
    emptyInboxHelp: 'Misafirleriniz öneri bıraktığında burada buluşacağız.',
    noMessage: 'Misafiriniz bir not eklemeden puan bırakmış.',
    previewFallback: 'Yalnızca puan bıraktı.',
    readSuffix: ' önerisini oku',
    readToast: 'Öneri okundu olarak işaretlendi.',
    deleteToast: 'Öneri silindi.',
    deleteError: 'Öneri silinemedi.',
    deleteLabel: 'Öneriyi sil',
    deleteGroup: 'Öneriyi silme onayı',
    deleteConfirm: 'Bu not kalıcı olarak silinecek.',
    detailLabel: 'Seçilen öneri',
    dialogLabel: 'Öneri ayrıntısı',
    closeLabel: 'Öneriyi kapat',
    emptyReaderTitle: 'Her notta bir fikir var.',
    emptyReaderHelp: 'Bir öneri seçin, misafirinizin sesine kulak verin.',
    letterLabel: 'MİSAFİRİNİZDEN BİR NOT',
    replyTitle: 'Küçük bir teşekkür, güzel bir başlangıç.',
  },
  complaint: {
    title: 'Şikayet Kutusu',
    noun: 'şikayet',
    endpoint: 'complaints',
    description: 'Misafirlerinizin yaşadığı sorunları buradan takip edin.',
    unreadSuffix: ' okunmamış mesaj · Geri bildirimlere kulak verin.',
    filterLabel: 'Şikayet görünümü',
    searchLabel: 'Şikayet ara',
    searchPlaceholder: 'İsim, iletişim bilgisi veya mesaj ara',
    refreshLabel: 'Şikayetleri yenile',
    listLabel: 'Şikayetler',
    listHeading: 'GELEN MESAJLAR',
    loadingLabel: 'Şikayetler yükleniyor',
    loadError: 'Mesajlar yüklenemedi.',
    emptySearch: 'Aramanızla eşleşen şikayet yok.',
    emptyInbox: 'Şu an şikayet mesajı yok.',
    emptyUnreadHelp: 'Diğer mesajlara Tümü bölümünden ulaşabilirsiniz.',
    emptyInboxHelp: 'Yeni geri bildirimler geldiğinde burada göreceksiniz.',
    noMessage: 'Bu kayıtta mesaj metni bulunmuyor.',
    previewFallback: 'Mesaj metni bulunmuyor.',
    readSuffix: ' şikayetini oku',
    readToast: 'Şikayet okundu olarak işaretlendi.',
    deleteToast: 'Şikayet silindi.',
    deleteError: 'Şikayet silinemedi.',
    deleteLabel: 'Şikayeti sil',
    deleteGroup: 'Şikayeti silme onayı',
    deleteConfirm: 'Bu mesaj kalıcı olarak silinecek.',
    detailLabel: 'Seçilen şikayet',
    dialogLabel: 'Şikayet ayrıntısı',
    closeLabel: 'Şikayeti kapat',
    emptyReaderTitle: 'Önce dinleyelim.',
    emptyReaderHelp:
      'Bir mesaj seçin; ayrıntıları okuyun, misafirinizle iletişime geçin.',
    letterLabel: 'MİSAFİRİNİZİN GERİ BİLDİRİMİ',
    replyTitle: 'Bir yanıtla ilk adımı atın.',
  },
} as const;
