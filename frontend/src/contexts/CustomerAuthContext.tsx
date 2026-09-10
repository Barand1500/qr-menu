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
  register: (body: Record<string, unknown>) => Promise<void>;
  logout: () => void;
  refresh: (restaurantId?: number | null) => Promise<void>;
  updateProfile: (body: Record<string, unknown>) => Promise<void>;
  restaurantPoints: (restaurantId?: number | null) => number;
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

  const register = useCallback(async (body: Record<string, unknown>) => {
    const res = await api<AuthResponse>('/api/customer/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    storeToken(res.token, Boolean(body.remember));
    setCustomer(res.customer);
    syncPrefsFromCustomer(res.customer);
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
      register,
      logout,
      refresh,
      updateProfile,
      restaurantPoints,
    }),
    [
      customer,
      loading,
      filterEnabled,
      setFilterEnabled,
      login,
      register,
      logout,
      refresh,
      updateProfile,
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

export function useCustomerAuthOptional() {
  return useContext(CustomerAuthContext);
}
