import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from '@/lib/api';
import { saveDietaryPrefs, type DietaryPrefs } from '@/lib/dietAllergens';

const TOKEN_KEY = 'customer_token';
const REMEMBER_KEY = 'customer_remember';
const FILTER_KEY = 'menu_customer_filter_on';

export type MenuCustomer = {
  id: number;
  email: string | null;
  phone: string | null;
  fullName: string;
  allergenTags: string[];
  dietTags: string[];
  likedFoods: string[];
  dislikedFoods: string[];
  drinksAlcohol?: boolean | null;
  pointsByRestaurant: Record<string, number>;
  kvkkAcceptedAt: string;
};

type AuthResponse = { token: string; customer: MenuCustomer };

type CustomerAuthContextValue = {
  customer: MenuCustomer | null;
  loading: boolean;
  filterEnabled: boolean;
  setFilterEnabled: (on: boolean) => void;
  login: (body: Record<string, unknown>) => Promise<void>;
  completeEmail: (body: Record<string, unknown>) => Promise<{ reset: boolean }>;
  logout: () => void;
  refresh: (restaurantId?: number | null) => Promise<void>;
  updateProfile: (body: Record<string, unknown>) => Promise<void>;
  /** Telefon/e-posta değişikliği: yeni değere doğrulama kodu gönderir. */
  requestContactChange: (field: ContactField, value: string, restaurantId: number) => Promise<ContactRequestResult>;
  /** Kodu doğrular ve değişikliği uygular. */
  verifyContactChange: (field: ContactField, value: string, challengeId: string, code: string, restaurantId: number) => Promise<void>;
  restaurantPoints: (restaurantId?: number | null) => number;
};

export type ContactField = 'phone' | 'email';
export type ContactRequestResult = {
  challengeId: string;
  /** Kodun gittiği kanal: sms veya email */
  channel: 'sms' | 'email';
  /** Maskeli hedef, ör. "5•• ••• •• 67" */
  maskedTo: string;
  retryAfter: number;
  expiresIn: number;
};

const CustomerAuthContext = createContext<CustomerAuthContextValue | null>(null);

function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string, remember: boolean) {
  try {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    if (remember) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(REMEMBER_KEY, '1');
    } else {
      sessionStorage.setItem(TOKEN_KEY, token);
      localStorage.removeItem(REMEMBER_KEY);
    }
  } catch {
    /* ignore */
  }
}

function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REMEMBER_KEY);
  } catch {
    /* ignore */
  }
}

function readFilterOn() {
  try {
    return localStorage.getItem(FILTER_KEY) !== '0';
  } catch {
    return true;
  }
}

function syncPrefsFromCustomer(c: MenuCustomer) {
  const prefs: DietaryPrefs = {
    allergens: c.allergenTags || [],
    diets: c.dietTags || [],
  };
  saveDietaryPrefs(prefs);
}

async function customerApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = readToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const base = import.meta.env.VITE_API_URL || '';
  const res = await fetch(`${base}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'İstek başarısız' }));
    throw new Error(err.message || 'İstek başarısız');
  }
  return res.json();
}

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<MenuCustomer | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterEnabled, setFilterEnabledState] = useState(readFilterOn);

  const setFilterEnabled = useCallback((on: boolean) => {
    setFilterEnabledState(on);
    try {
      localStorage.setItem(FILTER_KEY, on ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);

  const refresh = useCallback(async (restaurantId?: number | null) => {
    const token = readToken();
    if (!token) {
      setCustomer(null);
      return;
    }
    const qs =
      restaurantId && restaurantId > 0 ? `?restaurantId=${restaurantId}` : '';
    const res = await customerApi<{ customer: MenuCustomer }>(`/api/customer/auth/me${qs}`);
    setCustomer(res.customer);
    syncPrefsFromCustomer(res.customer);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        if (readToken()) await refresh();
      } catch {
        clearToken();
        setCustomer(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  const login = useCallback(async (body: Record<string, unknown>) => {
    const res = await api<AuthResponse>('/api/customer/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    storeToken(res.token, Boolean(body.remember));
    setCustomer(res.customer);
    syncPrefsFromCustomer(res.customer);
  }, []);

  const completeEmail = useCallback(async (body: Record<string, unknown>) => {
    const res = await api<AuthResponse | { reset: true }>('/api/customer/auth/email/complete', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if ('reset' in res) return { reset: true };
    storeToken(res.token, Boolean(body.remember));
    setCustomer(res.customer);
    syncPrefsFromCustomer(res.customer);
    return { reset: false };
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setCustomer(null);
  }, []);

  const updateProfile = useCallback(async (body: Record<string, unknown>) => {
    const res = await customerApi<{ customer: MenuCustomer }>('/api/customer/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    setCustomer(res.customer);
    syncPrefsFromCustomer(res.customer);
  }, []);

  const requestContactChange = useCallback(
    (field: ContactField, value: string, restaurantId: number) =>
      customerApi<ContactRequestResult>('/api/customer/auth/contact/request', {
        method: 'POST',
        body: JSON.stringify({ field, value, restaurantId }),
      }),
    [],
  );

  const verifyContactChange = useCallback(
    async (field: ContactField, value: string, challengeId: string, code: string, restaurantId: number) => {
      const res = await customerApi<{ customer: MenuCustomer }>('/api/customer/auth/contact/verify', {
        method: 'POST',
        body: JSON.stringify({ field, value, challengeId, code, restaurantId }),
      });
      setCustomer(res.customer);
    },
    [],
  );

  const restaurantPoints = useCallback(
    (restaurantId?: number | null) => {
      if (!customer || !restaurantId) return 0;
      return Number(customer.pointsByRestaurant?.[String(restaurantId)] ?? 0) || 0;
    },
    [customer]
  );

  const value = useMemo(
    () => ({
      customer,
      loading,
      filterEnabled,
      setFilterEnabled,
      login,
      completeEmail,
      logout,
      refresh,
      updateProfile,
      requestContactChange,
      verifyContactChange,
      restaurantPoints,
    }),
    [
      customer,
      loading,
      filterEnabled,
      setFilterEnabled,
      login,
      completeEmail,
      logout,
      refresh,
      updateProfile,
      requestContactChange,
      verifyContactChange,
      restaurantPoints,
    ]
  );

  return (
    <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error('useCustomerAuth must be used within CustomerAuthProvider');
  return ctx;
}
