import { api } from '@/lib/api';
import { markCustomerUnlocked } from '@/lib/customerQrPreview';

export type CustomerLookupResult = {
  customerId: number;
  customer: {
    id: number;
    fullName: string;
    email: string | null;
    phone: string | null;
    points: number;
  };
};

export async function lookupCustomerByCodeOrQr(body: {
  code?: string;
  qr?: string;
}): Promise<CustomerLookupResult> {
  const res = await api<CustomerLookupResult>('/api/admin/customers/lookup', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  markCustomerUnlocked(res.customerId);
  return res;
}

export async function issueCustomerQrChallenge(): Promise<{
  qrPayload: string;
  code: string;
  expiresAt: number;
  ttlMs: number;
}> {
  const token =
    localStorage.getItem('customer_token') || sessionStorage.getItem('customer_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const base = import.meta.env.VITE_API_URL || '';
  const res = await fetch(`${base}/api/customer/auth/qr-challenge`, {
    method: 'POST',
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Kod üretilemedi' }));
    throw new Error(err.message || 'Kod üretilemedi');
  }
  return res.json();
}
