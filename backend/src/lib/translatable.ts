// Çevrilebilir metinlerin tek yer listesi: toplu çeviri sayfası ve herkese açık menü aynı anahtarları kullanır.
import { prisma } from './prisma.js';
import { ABOUT_PAGE_KEY, parseAboutPage, type AboutPageConfig } from './about-page.js';
import { CONTACT_CARD_KEY, parseContactCard, type ContactCardConfig } from './contact-card.js';
import { REVIEWS_KEY, parseReviews } from './reviews-config.js';
import { normalizeOptionGroups, type ProductOptionGroup } from './product-options.js';
import { I18N_DICT_KEY, dictText, parseDict, reviewKey, type Dict } from './i18n-dict.js';

export { reviewKey };
import { getProductField } from './i18n-json.js';

export type DictCategory = 'about' | 'contact' | 'reviews' | 'options' | 'campaigns' | 'stories';

export type DictSource = {
  key: string;
  category: DictCategory;
  /** Listede görünen ad (ör. ürün adı) */
  label: string;
  fieldLabel: string;
  sourceText: string;
};

export const aboutKey = (field: 'headline' | 'body' | `highlight:${number}`) => `about:${field}`;
export const contactKey = (field: 'tagline' | 'managerTitle' | 'hours' | 'address') => `contact:${field}`;
export const optionGroupKey = (productId: number, groupId: string) => `option:${productId}:${groupId}`;
export const optionKey = (productId: number, groupId: string, optionId: string) => `option:${productId}:${groupId}:${optionId}`;
export const storyNameKey = (id: number) => `story:${id}:name`;

export function translateStoryName(id: number, name: string, dict: Dict, lang: string): string {
  return dictText(dict, storyNameKey(id), lang, name.trim());
}

export const campaignKey = (slug: string) => `campaign:${slug}`;

export async function loadDict(restaurantId: number): Promise<Dict> {
  const row = await prisma.setting.findUnique({
    where: { restaurantId_key: { restaurantId, key: I18N_DICT_KEY } },
  });
  return parseDict(row?.value);
}

// ───── herkese açık menü: çeviriyi kaynağın üstüne bindirir (çeviri yoksa Türkçe kalır) ─────

export function translateAbout(cfg: AboutPageConfig, dict: Dict, lang: string): AboutPageConfig {
  if (lang === 'tr') return cfg;
  return {
    ...cfg,
    headline: dictText(dict, aboutKey('headline'), lang, cfg.headline),
    body: dictText(dict, aboutKey('body'), lang, cfg.body),
    highlights: cfg.highlights.map((h, i) => dictText(dict, aboutKey(`highlight:${i}`), lang, h)),
  };
}

export function translateContact(card: ContactCardConfig, dict: Dict, lang: string): ContactCardConfig {
  if (lang === 'tr') return card;
  return {
    ...card,
    tagline: dictText(dict, contactKey('tagline'), lang, card.tagline),
    managerTitle: dictText(dict, contactKey('managerTitle'), lang, card.managerTitle),
    hours: dictText(dict, contactKey('hours'), lang, card.hours),
    address: dictText(dict, contactKey('address'), lang, card.address),
  };
}

export function translateOptionGroups(groups: ProductOptionGroup[], productId: number, dict: Dict, lang: string): ProductOptionGroup[] {
  if (lang === 'tr') return groups;
  return groups.map((g) => ({
    ...g,
    name: dictText(dict, optionGroupKey(productId, g.id), lang, g.name),
    options: g.options.map((o) => ({ ...o, name: dictText(dict, optionKey(productId, g.id, o.id), lang, o.name) })),
  }));
}

export function translateCampaignName(name: string, slug: string, dict: Dict, lang: string): string {
  return dictText(dict, campaignKey(slug), lang, name);
}

// ───── toplu çeviri: kaynak metinleri topla ─────

const FIELD = {
  headline: 'Başlık',
  body: 'Metin',
  highlight: 'Öne çıkan',
  tagline: 'Slogan',
  managerTitle: 'Yönetici görevi',
  hours: 'Çalışma saatleri',
  address: 'Adres',
  review: 'Yorum',
  group: 'Seçenek grubu',
  option: 'Seçenek',
  campaign: 'Kampanya adı',
} as const;

export async function collectDictSources(restaurantId: number): Promise<DictSource[]> {
  const out: DictSource[] = [];
  const add = (s: DictSource) => {
    if (s.sourceText.trim()) out.push({ ...s, sourceText: s.sourceText.trim() });
  };

  const settings = await prisma.setting.findMany({
    where: { restaurantId, key: { in: [ABOUT_PAGE_KEY, 'company_about', CONTACT_CARD_KEY, REVIEWS_KEY] } },
  });
  const byKey = new Map(settings.map((s) => [s.key, s.value]));

  const about = parseAboutPage(byKey.get(ABOUT_PAGE_KEY), byKey.get('company_about') || '');
  add({ key: aboutKey('headline'), category: 'about', label: 'Hakkımızda sayfası', fieldLabel: FIELD.headline, sourceText: about.headline });
  add({ key: aboutKey('body'), category: 'about', label: 'Hakkımızda sayfası', fieldLabel: FIELD.body, sourceText: about.body });
  about.highlights.forEach((h, i) =>
    add({ key: aboutKey(`highlight:${i}`), category: 'about', label: 'Hakkımızda sayfası', fieldLabel: `${FIELD.highlight} ${i + 1}`, sourceText: h }),
  );

  const card = parseContactCard(byKey.get(CONTACT_CARD_KEY));
  if (card.enabled || card.managerName || card.phone) {
    add({ key: contactKey('tagline'), category: 'contact', label: 'İletişim kartı', fieldLabel: FIELD.tagline, sourceText: card.tagline });
    add({ key: contactKey('managerTitle'), category: 'contact', label: 'İletişim kartı', fieldLabel: FIELD.managerTitle, sourceText: card.managerTitle });
    add({ key: contactKey('hours'), category: 'contact', label: 'İletişim kartı', fieldLabel: FIELD.hours, sourceText: card.hours });
    add({ key: contactKey('address'), category: 'contact', label: 'İletişim kartı', fieldLabel: FIELD.address, sourceText: card.address });
  }

  const reviews = parseReviews(byKey.get(REVIEWS_KEY));
  for (const r of reviews.manual) {
    add({ key: reviewKey(r.name, r.text), category: 'reviews', label: r.name, fieldLabel: FIELD.review, sourceText: r.text });
  }

  const products = await prisma.product.findMany({
    where: { restaurantId },
    select: { id: true, i18n: true, optionGroups: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });
  for (const p of products) {
    const groups = normalizeOptionGroups(p.optionGroups);
    if (!groups.length) continue;
    const name = getProductField(p.i18n, 'tr', 'name') || `Ürün #${p.id}`;
    for (const g of groups) {
      add({ key: optionGroupKey(p.id, g.id), category: 'options', label: name, fieldLabel: FIELD.group, sourceText: g.name });
      for (const o of g.options) {
        if (!o.isActive) continue;
        add({ key: optionKey(p.id, g.id, o.id), category: 'options', label: `${name} · ${g.name}`, fieldLabel: FIELD.option, sourceText: o.name });
      }
    }
  }

  // Story captions are names, not the optional banner title1/title2 fields.
  const stories = await prisma.showcaseImage.findMany({
    where: { restaurantId, isDeleted: false, displayType: 'story' },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });
  for (const story of stories) {
    add({ key: storyNameKey(story.id), category: 'stories', label: story.name, fieldLabel: 'Hikâye adı', sourceText: story.name });
  }

  const campaigns = await prisma.campaign.findMany({ where: { restaurantId }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
  for (const c of campaigns) {
    add({ key: campaignKey(c.slug), category: 'campaigns', label: 'Kampanya', fieldLabel: FIELD.campaign, sourceText: c.name });
  }
  return out;
}
