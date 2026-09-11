import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { KeyRound, ShieldCheck, X } from 'lucide-react';
import {
  clearTableCodeCache,
  fetchTableSessionGate,
  readTableCodeCache,
  unlockTableSession,
  writeTableCodeCache,
} from '@/lib/tableSessionCode';
import { formatTableServiceLabel } from '@/lib/tableContext';
import '@/table-session-code.css';

type TableSessionCodeContextValue = {
  enabled: boolean;
  verified: boolean;
  /** Kod gerekmiyorsa true; gerekirse modal açar, doğrulanınca true */
  ensureUnlocked: () => Promise<boolean>;
  markNeedsUnlock: () => void;
};

const TableSessionCodeContext = createContext<TableSessionCodeContextValue>({
  enabled: false,
  verified: true,
  ensureUnlocked: async () => true,
  markNeedsUnlock: () => undefined,
});

export function useTableSessionCode() {
  return useContext(TableSessionCodeContext);
}

type Props = {
  slug: string | null;
  masa: string | null;
  grup: string | null;
  children: ReactNode;
};

/**
 * Menüyü kilitlemez. QR ile oturumu açar (admin’de “kod bekliyor”).
 * Sipariş / garson / hesap öncesi ensureUnlocked ile kod ister.
 */
export default function TableSessionCodeGate({ slug, masa, grup, children }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [verified, setVerified] = useState(true);
  const [ttlMinutes, setTtlMinutes] = useState(120);
  const [modalOpen, setModalOpen] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const waitersRef = useRef<Array<(ok: boolean) => void>>([]);

  const table = String(masa || '').trim();
  const group = grup ? String(grup).trim() : null;
  const active = Boolean(slug && table && table !== 'admin');

  const resolveWaiters = useCallback((ok: boolean) => {
    const list = waitersRef.current;
    waitersRef.current = [];
    list.forEach((fn) => fn(ok));
  }, []);

  const bootstrap = useCallback(async () => {
    if (!slug || !active) {
      setEnabled(false);
      setVerified(true);
      return;
    }
    try {
      const cached = readTableCodeCache(slug, table, group);
      const info = await fetchTableSessionGate(slug, table, group);
      setTtlMinutes(info.ttlMinutes || 120);
      if (!info.enabled) {
        setEnabled(false);
        setVerified(true);
        return;
      }
      setEnabled(true);
      const ok = !info.needsCode || info.status === 'verified' || Boolean(cached);
      setVerified(ok);
      if (ok && info.status === 'verified' && !cached) {
        writeTableCodeCache(slug, table, group, info.expiresAt);
      }
    } catch {
      setEnabled(false);
      setVerified(true);
    }
  }, [slug, table, group, active]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const markNeedsUnlock = useCallback(() => {
    if (!slug || !active) return;
    clearTableCodeCache(slug, table, group);
    setVerified(false);
  }, [slug, active, table, group]);

  const ensureUnlocked = useCallback(async () => {
    if (!enabled || !active) return true;
    if (verified) return true;
    if (slug && readTableCodeCache(slug, table, group)) {
      setVerified(true);
      return true;
    }
    setModalOpen(true);
    setError('');
    setCode('');
    return new Promise<boolean>((resolve) => {
      waitersRef.current.push(resolve);
    });
  }, [enabled, active, verified, slug, table, group]);

  function closeModal(ok: boolean) {
    setModalOpen(false);
    setCode('');
    setError('');
    resolveWaiters(ok);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!slug || !table) return;
    const pin = code.replace(/\D/g, '').slice(0, 12);
    if (pin.length < 4) {
      setError('En az 4 haneli kod girin');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await unlockTableSession(slug, table, group, pin);
      if (res.verified) {
        writeTableCodeCache(slug, table, group, res.expiresAt);
        setVerified(true);
        closeModal(true);
      } else {
        setError('Kod doğrulanamadı');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kod hatalı veya süresi dolmuş');
    } finally {
      setBusy(false);
    }
  }

  const value = useMemo(
    () => ({ enabled, verified, ensureUnlocked, markNeedsUnlock }),
    [enabled, verified, ensureUnlocked, markNeedsUnlock]
  );

  const tableLabel = formatTableServiceLabel(table, group);

  return (
    <TableSessionCodeContext.Provider value={value}>
      {children}
      {modalOpen ? (
        <div className="table-code-gate table-code-gate--modal" role="dialog" aria-modal="true">
          <button
            type="button"
            className="table-code-gate__scrim"
            aria-label="Kapat"
            onClick={() => closeModal(false)}
          />
          <div className="table-code-gate__card">
            <button
              type="button"
              className="table-code-gate__close"
              aria-label="Kapat"
              onClick={() => closeModal(false)}
            >
              <X className="w-5 h-5" />
            </button>
            <div className="table-code-gate__icon">
              <KeyRound className="w-7 h-7" />
            </div>
            <p className="table-code-gate__eyebrow">Masa erişimi</p>
            <h1>Devam için kod gerekli</h1>
            <p className="table-code-gate__copy">
              Sipariş vermek veya garson çağırmak için garsonun verdiği kodu girin. Kod yaklaşık{' '}
              {ttlMinutes} dakika geçerlidir.
            </p>
            <div className="table-code-gate__table">
              <ShieldCheck className="w-4 h-4" />
              <span>{tableLabel}</span>
            </div>
            <form onSubmit={(e) => void submit(e)} className="table-code-gate__form">
              <label htmlFor="table-access-code-modal">Erişim kodu</label>
              <input
                id="table-access-code-modal"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={8}
                placeholder="••••••"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                disabled={busy}
              />
              {error ? <p className="table-code-gate__error">{error}</p> : null}
              <button type="submit" disabled={busy || code.length < 4}>
                {busy ? 'Kontrol…' : 'Onayla ve devam et'}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </TableSessionCodeContext.Provider>
  );
}
