import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Check, ShoppingBag } from 'lucide-react';
import {
  addToSiparisCart,
  cartItemCount,
  cartTotalCalories,
  cartTotalPrice,
  emptySiparisCart,
  loadSiparisCart,
  saveSiparisCart,
  setSiparisQty,
  type SiparisAddPayload,
  type SiparisCartState,
} from '@/lib/siparisCart';
import { siparisFlyToCart } from '@/lib/siparisFlyToCart';
import { imageUrl } from '@/lib/api';

export type SiparisAddOptions = {
  qty?: number;
  fromEl?: HTMLElement | null;
  /** Görsel uçuşu için (yoksa payload.imageUrl) */
  flyImageUrl?: string | null;
};

type SiparisCartContextValue = {
  enabled: boolean;
  items: SiparisCartState['items'];
  note: string;
  count: number;
  totalPrice: number;
  totalCalories: number | null;
  sheetOpen: boolean;
  setSheetOpen: (open: boolean) => void;
  addItem: (payload: SiparisAddPayload, opts?: number | SiparisAddOptions) => void;
  setQty: (productId: number, qty: number) => void;
  setNote: (note: string) => void;
  clear: () => void;
};

const SiparisCartContext = createContext<SiparisCartContextValue | null>(null);

function SiparisToast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, 2200);
    return () => window.clearTimeout(t);
  }, [message, onDone]);

  return (
    <div className="siparis-toast" role="status" aria-live="polite">
      <span className="siparis-toast__icon" aria-hidden>
        <Check className="w-4 h-4" strokeWidth={3} />
      </span>
      <span className="siparis-toast__text">{message}</span>
      <ShoppingBag className="w-4 h-4 siparis-toast__bag" aria-hidden />
    </div>
  );
}

export function SiparisCartProvider({
  slug,
  enabled,
  children,
}: {
  slug: string | null | undefined;
  enabled: boolean;
  children: ReactNode;
}) {
  const [state, setState] = useState<SiparisCartState>(emptySiparisCart);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !slug) {
      setState(emptySiparisCart());
      setHydrated(true);
      return;
    }
    setState(loadSiparisCart(slug));
    setHydrated(true);
  }, [slug, enabled]);

  useEffect(() => {
    if (!hydrated || !enabled || !slug) return;
    saveSiparisCart(slug, state);
  }, [state, slug, enabled, hydrated]);

  const addItem = useCallback((payload: SiparisAddPayload, opts: number | SiparisAddOptions = 1) => {
    const options: SiparisAddOptions =
      typeof opts === 'number' ? { qty: opts } : opts ?? {};
    const qty = options.qty ?? 1;
    setState((prev) => addToSiparisCart(prev, payload, qty));

    const flySrc = options.flyImageUrl ?? payload.imageUrl;
    siparisFlyToCart(options.fromEl, flySrc ? imageUrl(flySrc) : null);
    setToast(`${payload.name} sepete eklendi`);
  }, []);

  const setQty = useCallback((productId: number, qty: number) => {
    setState((prev) => setSiparisQty(prev, productId, qty));
  }, []);

  const setNote = useCallback((note: string) => {
    setState((prev) => ({ ...prev, note }));
  }, []);

  const clear = useCallback(() => {
    setState(emptySiparisCart());
  }, []);

  const clearToast = useCallback(() => setToast(null), []);

  const value = useMemo<SiparisCartContextValue>(
    () => ({
      enabled,
      items: state.items,
      note: state.note,
      count: cartItemCount(state.items),
      totalPrice: cartTotalPrice(state.items),
      totalCalories: cartTotalCalories(state.items),
      sheetOpen,
      setSheetOpen,
      addItem,
      setQty,
      setNote,
      clear,
    }),
    [enabled, state, sheetOpen, addItem, setQty, setNote, clear]
  );

  return (
    <SiparisCartContext.Provider value={value}>
      {children}
      {enabled && toast ? <SiparisToast message={toast} onDone={clearToast} /> : null}
    </SiparisCartContext.Provider>
  );
}

export function useSiparisCart() {
  const ctx = useContext(SiparisCartContext);
  if (!ctx) {
    return {
      enabled: false,
      items: [] as SiparisCartState['items'],
      note: '',
      count: 0,
      totalPrice: 0,
      totalCalories: null as number | null,
      sheetOpen: false,
      setSheetOpen: (_open: boolean) => {},
      addItem: (_payload: SiparisAddPayload, _opts?: number | SiparisAddOptions) => {},
      setQty: (_productId: number, _qty: number) => {},
      setNote: (_note: string) => {},
      clear: () => {},
    } satisfies SiparisCartContextValue;
  }
  return ctx;
}
