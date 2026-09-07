export const ABOUT_TEMPLATES = ['classic', 'story', 'highlights', 'editorial'] as const;
export type AboutTemplateId = (typeof ABOUT_TEMPLATES)[number];

export const ABOUT_COVER_FITS = ['cover', 'contain'] as const;
export type AboutCoverFit = (typeof ABOUT_COVER_FITS)[number];

export const ABOUT_COVER_POSITIONS = ['center', 'left', 'right', 'top', 'bottom'] as const;
export type AboutCoverPosition = (typeof ABOUT_COVER_POSITIONS)[number];

export type AboutPageConfig = {
  template: AboutTemplateId;
  coverUrl: string | null;
  coverFit: AboutCoverFit;
  coverPosition: AboutCoverPosition;
  headline: string;
  body: string;
  highlights: string[];
};

export const ABOUT_TEMPLATE_META: Record<
  AboutTemplateId,
  { label: string; blurb: string }
> = {
  classic: {
    label: 'Klasik',
    blurb: 'Kapak + başlık + hikâye. Sade ve net.',
  },
  story: {
    label: 'Hikâye',
    blurb: 'Büyük kapak, üzerinde başlık; altta metin.',
  },
  highlights: {
    label: 'Öne çıkanlar',
    blurb: 'Kapak, kısa metin ve 3 vurgu satırı.',
  },
  editorial: {
    label: 'Editoryal',
    blurb: 'Yan yana görsel ve yazı — dergi havası.',
  },
};

export const ABOUT_COVER_FIT_LABEL: Record<AboutCoverFit, string> = {
  cover: 'Doldur',
  contain: 'Sığdır',
};

export const ABOUT_COVER_POS_LABEL: Record<AboutCoverPosition, string> = {
  center: 'Orta',
  left: 'Soldan',
  right: 'Sağdan',
  top: 'Üstten',
  bottom: 'Alttan',
};

export const DEFAULT_ABOUT_PAGE: AboutPageConfig = {
  template: 'classic',
  coverUrl: null,
  coverFit: 'cover',
  coverPosition: 'center',
  headline: '',
  body: '',
  highlights: ['', '', ''],
};

/** Şablon seçilince doldurulabilecek hazır metinler (boş alanlara) */
export const ABOUT_TEMPLATE_PRESETS: Record<
  AboutTemplateId,
  Pick<AboutPageConfig, 'headline' | 'body' | 'highlights'>
> = {
  classic: {
    headline: 'Hikâyemiz',
    body: 'Yıllardır aynı tutkuyu taşıyoruz: taze ürünler, samimi bir atmosfer ve misafirlerimizi mutlu eden lezzetler. Menümüzü QR ile keşfederken bizimle tanışın.',
    highlights: ['', '', ''],
  },
  story: {
    headline: 'Masada başlayan bir hikâye',
    body: 'Her tabak bir davet. Mutfağımızda mevsimlik malzemelerle çalışıyor, serviste ise sıcak bir gülümsemeyi eksik etmiyoruz. Gelin, sofranın bir parçası olun.',
    highlights: ['', '', ''],
  },
  highlights: {
    headline: 'Neden biz?',
    body: 'Küçük dokunuşlarla büyük fark yaratmayı seviyoruz. İşte bizi biz yapan üç şey:',
    highlights: [
      'Günlük taze ürünler',
      'Özenli sunum ve hızlı servis',
      'Her misafire aynı sıcak karşılama',
    ],
  },
  editorial: {
    headline: 'Ruhumuz',
    body: 'Bu mekân bir adres değil; bir his. Kahvaltıdan akşam yemeğine, her ziyarette aynı özeni hissedin. Kapımız herkese açık.',
    highlights: ['', '', ''],
  },
};

export function parseAboutPage(raw?: string | null, fallbackBody = ''): AboutPageConfig {
  const base: AboutPageConfig = {
    ...DEFAULT_ABOUT_PAGE,
    body: fallbackBody || '',
    highlights: ['', '', ''],
  };
  if (!raw) return base;
  try {
    const data = JSON.parse(raw) as Partial<AboutPageConfig>;
    const template = ABOUT_TEMPLATES.includes(data.template as AboutTemplateId)
      ? (data.template as AboutTemplateId)
      : 'classic';
    const coverFit = ABOUT_COVER_FITS.includes(data.coverFit as AboutCoverFit)
      ? (data.coverFit as AboutCoverFit)
      : 'cover';
    const coverPosition = ABOUT_COVER_POSITIONS.includes(data.coverPosition as AboutCoverPosition)
      ? (data.coverPosition as AboutCoverPosition)
      : 'center';
    const highlights = Array.isArray(data.highlights)
      ? [0, 1, 2].map((i) => String(data.highlights?.[i] ?? '').slice(0, 80))
      : ['', '', ''];
    return {
      template,
      coverUrl: typeof data.coverUrl === 'string' && data.coverUrl ? data.coverUrl : null,
      coverFit,
      coverPosition,
      headline: typeof data.headline === 'string' ? data.headline.slice(0, 80) : '',
      body:
        typeof data.body === 'string' && data.body.trim()
          ? data.body.slice(0, 4000)
          : fallbackBody || '',
      highlights,
    };
  } catch {
    return base;
  }
}

export function applyAboutTemplate(
  current: AboutPageConfig,
  template: AboutTemplateId,
  fillEmpty = true
): AboutPageConfig {
  const preset = ABOUT_TEMPLATE_PRESETS[template];
  return {
    ...current,
    template,
    headline: fillEmpty && !current.headline.trim() ? preset.headline : current.headline,
    body: fillEmpty && !current.body.trim() ? preset.body : current.body,
    highlights:
      template === 'highlights' && fillEmpty && !current.highlights.some((h) => h.trim())
        ? [...preset.highlights]
        : current.highlights,
  };
}
