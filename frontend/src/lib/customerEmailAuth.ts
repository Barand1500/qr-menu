export type EmailPurpose = 'register' | 'reset';
export type EmailChallenge = {
  challengeId: string;
  expiresIn: number;
  retryAfter: number;
};
export class CustomerEmailApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public retryAfter = 0,
  ) {
    super(message);
  }
}
export async function customerEmailRequest<T>(
  action: string,
  body: Record<string, unknown>,
): Promise<T> {
  const result = await fetch(
    `${import.meta.env.VITE_API_URL || ''}/api/customer/auth/email/${action}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify(body),
    },
  );
  const data = await result.json().catch(() => ({}));
  if (!result.ok)
    throw new CustomerEmailApiError(
      data.message || 'İşlem tamamlanamadı.',
      result.status,
      Number(data.retryAfter || result.headers.get('Retry-After')) || 0,
    );
  return data as T;
}
