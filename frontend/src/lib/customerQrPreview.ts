/** Tasarım / önizleme — gerçek doğrulama sonra bağlanacak */
export const CUSTOMER_QR_TTL_MS = 45_000;

export function makeCustomerQrPreviewPayload(customerId: number) {
  const nonce =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  const exp = Date.now() + CUSTOMER_QR_TTL_MS;
  return `mqr-c1.${customerId}.${nonce}.${exp}`;
}

export type CustomerPrivacyFlags = {
  showName: boolean;
  showPhone: boolean;
  showEmail: boolean;
};

const PRIVACY_KEY = 'mc_privacy_v1';

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
