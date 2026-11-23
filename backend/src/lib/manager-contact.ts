export type ManagerContact = { enabled: boolean; email: string; phone: string };
export const managerEmailValid = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export function normalizeManagerContact(raw: unknown): ManagerContact {
  const r =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const email = typeof r.email === 'string' ? r.email.trim().slice(0, 150) : '';
  const phone = typeof r.phone === 'string' ? r.phone.trim().slice(0, 30) : '';
  return {
    enabled: r.enabled === true,
    email: managerEmailValid(email) ? email : '',
    phone:
      /^[+\d ().-]{7,30}$/.test(phone) &&
      phone.replace(/\D/g, '').length >= 7 &&
      phone.replace(/\D/g, '').length <= 15
        ? phone
        : '',
  };
}
export function parseManagerNote(raw: unknown) {
  const r =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const text = (value: unknown) =>
    typeof value === 'string' ? value.trim() : '';
  const kind = r.kind,
    fullName = text(r.fullName),
    message = text(r.message),
    contact = text(r.contact);
  if (kind !== 'suggestion' && kind !== 'complaint')
    throw new Error('Öneri veya şikâyet seçin.');
  if (message.length < 5 || message.length > 2000)
    throw new Error('Mesajınız 5–2000 karakter arasında olmalı.');
  if (fullName && (fullName.length < 2 || fullName.length > 150))
    throw new Error('Adınız 2–150 karakter arasında olmalı.');
  let email: string | null = null,
    phone: string | null = null;
  if (contact) {
    if (contact.includes('@')) {
      if (contact.length > 150 || !managerEmailValid(contact))
        throw new Error('Geçerli bir e-posta adresi girin.');
      email = contact;
    } else {
      const digits = contact.replace(/\D/g, '');
      if (
        !/^[+\d ().-]+$/.test(contact) ||
        digits.length < 7 ||
        digits.length > 15 ||
        contact.length > 30
      )
        throw new Error('Geçerli bir telefon veya e-posta adresi girin.');
      phone = contact;
    }
  }
  return { kind, fullName: fullName || null, message, email, phone };
}
