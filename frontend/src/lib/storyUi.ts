/** Shared story controls; business captions come from bulk translations. */
const COPY = {
  tr: {
    seen: 'İzlendi',
    heading: 'SOFRADAN HİKÂYELER',
    resume: 'Devam et',
    pause: 'Duraklat',
    close: 'Kapat',
    unavailable: 'Görsel yüklenemedi',
    discover: 'MENÜDE KEŞFET',
    product: 'Ürüne git',
    previous: 'Önceki hikâye',
    paused: 'Duraklatıldı',
    hold: 'Basılı tut · anı yakala',
    closeStories: 'Hikâyeleri kapat',
    next: 'Sonraki hikâye',
    hint: 'Sol/sağ: geç · Orta: ürüne git · Basılı tut: duraklat',
  },
  en: {
    seen: 'Viewed',
    heading: 'STORIES FROM THE TABLE',
    resume: 'Resume',
    pause: 'Pause',
    close: 'Close',
    unavailable: 'Image unavailable',
    discover: 'EXPLORE THE MENU',
    product: 'View product',
    previous: 'Previous story',
    paused: 'Paused',
    hold: 'Hold · savour the moment',
    closeStories: 'Close stories',
    next: 'Next story',
    hint: 'Left/right: navigate · Centre: view product · Hold: pause',
  },
};

export function storyUi(lang: string) {
  return lang.toLowerCase().startsWith('tr') ? COPY.tr : COPY.en;
}
