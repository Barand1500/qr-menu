export type ServiceKind = 'waiter' | 'hookah' | 'valet';

/** Keep structured service inputs separate from the existing food-order flow. */
export function parseServiceRequest(
  type: unknown,
  plate: unknown,
  note: unknown,
  order: unknown,
) {
  if (type !== 'waiter' && type !== 'hookah' && type !== 'valet') {
    throw new Error('Geçersiz istek türü');
  }
  if (type !== 'waiter' && order != null) {
    throw new Error('Bu servis türü sipariş içeremez');
  }
  let noteText = typeof note === 'string' ? note.trim().slice(0, 500) : '';
  if (type === 'valet') {
    const normalized =
      typeof plate === 'string'
        ? plate.trim().toLocaleUpperCase('tr-TR').replace(/\s+/g, ' ')
        : '';
    // Accept domestic and international plates; reject notes/control characters as plates.
    if (
      normalized.length < 4 ||
      normalized.length > 20 ||
      !/^[A-Z0-9ÇĞİÖŞÜ -]+$/.test(normalized) ||
      !/[0-9]/.test(normalized)
    ) {
      throw new Error('Lütfen geçerli bir araç plakası girin');
    }
    noteText = `Plaka: ${normalized}`;
  }
  return { requestType: type as ServiceKind, noteText };
}
