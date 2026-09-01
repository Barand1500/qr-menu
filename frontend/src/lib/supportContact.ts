export const SUPPORT_PHONE_DISPLAY = '+90 850 885 12 60';
export const SUPPORT_PHONE_TEL = '+908508851260';
export const SUPPORT_PHONE_WA = '908508851260';

export function supportWhatsAppUrl(text: string) {
  return `https://wa.me/${SUPPORT_PHONE_WA}?text=${encodeURIComponent(text)}`;
}
