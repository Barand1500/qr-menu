const API_BASE = import.meta.env.VITE_API_URL || '';

function getToken(): string | null {
  return localStorage.getItem('token') || sessionStorage.getItem('token');
}

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function isCodeRequiredError(err: unknown): boolean {
  if (err instanceof ApiError) return err.code === 'CODE_REQUIRED';
  if (err instanceof Error) return /masa kodu/i.test(err.message);
  return false;
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'İstek başarısız' })) as {
      message?: string;
      code?: string;
    };
    throw new ApiError(err.message || 'İstek başarısız', res.status, err.code);
  }

  return res.json();
}

export function imageUrl(path?: string | null): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${API_BASE}${path}`;
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

export function formatMoney(
  price: number,
  currency?: { symbol?: string | null; code?: string | null } | null
): string {
  const symbol = currency?.symbol?.trim() || currency?.code?.trim() || '₺';
  return `${formatPrice(price)} ${symbol}`;
}

export function getSessionId(): string {
  let id = localStorage.getItem('menu_session_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('menu_session_id', id);
  }
  return id;
}
