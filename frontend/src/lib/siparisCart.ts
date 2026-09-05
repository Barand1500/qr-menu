export type SiparisCartCurrency = { code?: string; symbol?: string } | null;

export type SiparisCartItem = {
  productId: number;
  name: string;
  price: number;
  currency?: SiparisCartCurrency;
  imageUrl?: string | null;
  calories?: number | null;
  qty: number;
};

export type SiparisCartState = {
  items: SiparisCartItem[];
  note: string;
};

function storageKey(slug: string) {
  return `siparis_cart_${slug}`;
}

export function emptySiparisCart(): SiparisCartState {
  return { items: [], note: '' };
}

export function loadSiparisCart(slug: string): SiparisCartState {
  try {
    const raw = localStorage.getItem(storageKey(slug));
    if (!raw) return emptySiparisCart();
    const parsed = JSON.parse(raw) as SiparisCartState;
    if (!parsed || !Array.isArray(parsed.items)) return emptySiparisCart();
    return {
      items: parsed.items.filter(
        (i) => i && typeof i.productId === 'number' && i.qty > 0
      ),
      note: typeof parsed.note === 'string' ? parsed.note : '',
    };
  } catch {
    return emptySiparisCart();
  }
}

export function saveSiparisCart(slug: string, state: SiparisCartState) {
  try {
    localStorage.setItem(storageKey(slug), JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function cartItemCount(items: SiparisCartItem[]) {
  return items.reduce((n, i) => n + i.qty, 0);
}

export function cartTotalPrice(items: SiparisCartItem[]) {
  return items.reduce((n, i) => n + i.price * i.qty, 0);
}

export function cartTotalCalories(items: SiparisCartItem[]) {
  let sum = 0;
  let any = false;
  for (const i of items) {
    if (i.calories != null && i.calories > 0) {
      sum += i.calories * i.qty;
      any = true;
    }
  }
  return any ? sum : null;
}

export type SiparisAddPayload = {
  productId: number;
  name: string;
  price: number;
  currency?: SiparisCartCurrency;
  imageUrl?: string | null;
  calories?: number | null;
};

export function addToSiparisCart(
  state: SiparisCartState,
  payload: SiparisAddPayload,
  qty = 1
): SiparisCartState {
  const existing = state.items.find((i) => i.productId === payload.productId);
  if (existing) {
    return {
      ...state,
      items: state.items.map((i) =>
        i.productId === payload.productId ? { ...i, qty: i.qty + qty } : i
      ),
    };
  }
  return {
    ...state,
    items: [
      ...state.items,
      {
        productId: payload.productId,
        name: payload.name,
        price: payload.price,
        currency: payload.currency,
        imageUrl: payload.imageUrl,
        calories: payload.calories ?? null,
        qty,
      },
    ],
  };
}

export function setSiparisQty(
  state: SiparisCartState,
  productId: number,
  qty: number
): SiparisCartState {
  if (qty <= 0) {
    return {
      ...state,
      items: state.items.filter((i) => i.productId !== productId),
    };
  }
  return {
    ...state,
    items: state.items.map((i) =>
      i.productId === productId ? { ...i, qty } : i
    ),
  };
}
