/** Müşteri QR / kod — frontend yardımcıları */

export const CUSTOMER_QR_TTL_MS = 45_000;
export const CUSTOMER_UNLOCK_WINDOW_MS = 5 * 60_000;

export type CustomerPrivacyFlags = {
  showName: boolean;
  showPhone: boolean;
  showEmail: boolean;
};

const PRIVACY_KEY = 'mc_privacy_v1';
const UNLOCK_KEY = 'mc_unlock_v1';

export function readCustomerPrivacy(customerId: number): CustomerPrivacyFlags {
  try {
    const raw = localStorage.getItem(`${PRIVACY_KEY}_${customerId}`);
    if (!raw) return { showName: true, showPhone: true, showEmail: true };
    const parsed = JSON.parse(raw) as Partial<CustomerPrivacyFlags>;
    return {
      showName: parsed.showName !== false,
      showPhone: parsed.showPhone !== false,
      showEmail: parsed.showEmail !== false,
    };
  } catch {
    return { showName: true, showPhone: true, showEmail: true };
  }
}

export function writeCustomerPrivacy(customerId: number, flags: CustomerPrivacyFlags) {
  try {
    localStorage.setItem(`${PRIVACY_KEY}_${customerId}`, JSON.stringify(flags));
  } catch {
    /* ignore */
  }
}

type UnlockSession = { customerId: number; until: number };

export function markCustomerUnlocked(customerId: number, windowMs = CUSTOMER_UNLOCK_WINDOW_MS) {
  const payload: UnlockSession = { customerId, until: Date.now() + windowMs };
  try {
    sessionStorage.setItem(UNLOCK_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
  return payload;
}

export function readCustomerUnlock(): UnlockSession | null {
  try {
    const raw = sessionStorage.getItem(UNLOCK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UnlockSession;
    if (!parsed?.customerId || !parsed.until || parsed.until <= Date.now()) {
      sessionStorage.removeItem(UNLOCK_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function isCustomerUnlocked(customerId: number) {
  const s = readCustomerUnlock();
  return Boolean(s && s.customerId === customerId);
}

export function clearCustomerUnlock() {
  try {
    sessionStorage.removeItem(UNLOCK_KEY);
  } catch {
    /* ignore */
  }
}

export function formatCustomerCodeDisplay(code: string) {
  const d = code.replace(/\D/g, '').slice(0, 6);
  if (d.length <= 3) return d;
  return `${d.slice(0, 3)} ${d.slice(3)}`;
}
