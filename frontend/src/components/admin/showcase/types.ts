import type { AdminLanguage } from '@/lib/languages';
export type MediaType = 'banner' | 'story';
export type MediaText = { title1: string; title2: string };
export type ShowcaseItem = {
  id: number;
  name: string;
  productId: number | null;
  productName: string | null;
  imageUrl?: string | null;
  displayType: MediaType;
  sortOrder: number;
  isActive: boolean;
  durationSeconds?: number;
  translations: (MediaText & { languageId: number; languageCode: string })[];
};
export type ProductOption = { id: number; name: string };
export type MediaForm = {
  name: string;
  productId: string;
  isActive: boolean;
  durationSeconds: number;
  translations: Record<string, MediaText>;
};
export type MediaEditor = {
  type: MediaType;
  item: ShowcaseItem | null;
  form: MediaForm;
  file: File | null;
};
export type Language = AdminLanguage;
export function mediaReady(item: ShowcaseItem) {
  return (
    Boolean(item.imageUrl) &&
    (item.displayType !== 'story' || Boolean(item.productId))
  );
}
export function mediaForm(item?: ShowcaseItem): MediaForm {
  return {
    name: item?.name || '',
    productId: item?.productId?.toString() || '',
    isActive: item?.isActive ?? true,
    durationSeconds: item?.durationSeconds ?? 5,
    translations: Object.fromEntries(
      (item?.translations || []).map((t) => [
        t.languageCode,
        { title1: t.title1 || '', title2: t.title2 || '' },
      ]),
    ),
  };
}
