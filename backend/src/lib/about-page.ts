export const ABOUT_TEMPLATES = ['classic', 'story', 'highlights', 'editorial'] as const;
export type AboutTemplateId = (typeof ABOUT_TEMPLATES)[number];

export type AboutPageConfig = {
  template: AboutTemplateId;
  coverUrl: string | null;
  headline: string;
  body: string;
  highlights: string[];
};

export const ABOUT_PAGE_KEY = 'company_about_page';

export function parseAboutPage(raw?: string | null, fallbackBody = ''): AboutPageConfig {
  const base: AboutPageConfig = {
    template: 'classic',
    coverUrl: null,
    headline: '',
    body: fallbackBody || '',
    highlights: ['', '', ''],
  };
  if (!raw) return base;
  try {
    const data = JSON.parse(raw) as Partial<AboutPageConfig>;
    const template = ABOUT_TEMPLATES.includes(data.template as AboutTemplateId)
      ? (data.template as AboutTemplateId)
      : 'classic';
    const highlights = Array.isArray(data.highlights)
      ? [0, 1, 2].map((i) => String(data.highlights?.[i] ?? '').slice(0, 80))
      : ['', '', ''];
    return {
      template,
      coverUrl: typeof data.coverUrl === 'string' && data.coverUrl ? data.coverUrl : null,
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

export function serializeAboutPage(config: AboutPageConfig): string {
  return JSON.stringify({
    template: config.template,
    coverUrl: config.coverUrl || null,
    headline: String(config.headline || '').slice(0, 80),
    body: String(config.body || '').slice(0, 4000),
    highlights: [0, 1, 2].map((i) => String(config.highlights?.[i] ?? '').slice(0, 80)),
  });
}
