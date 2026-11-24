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
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { CheckCircle2, KeyRound, ShieldCheck, X } from 'lucide-react';
import {
  clearTableCodeCache,
  fetchTableSessionGate,
  readTableCodeCache,
  unlockTableSession,
  writeTableCodeCache,
} from '@/lib/tableSessionCode';
import {
  ADMIN_PREVIEW_TABLE,
  formatTableServiceLabel,
  getTableContext,
  rememberTableGroupName,
} from '@/lib/tableContext';
import { usePageBackdrop } from '@/lib/pageBackdrop';
import { sendPresence, subscribePresence, topPresence, usePresenceEntry, type PresenceKind } from '@/lib/tablePresence';
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
  /** URL’den gelebilir; yoksa sessionStorage kullanılır */
  masa?: string | null;
  grup?: string | null;
  children: ReactNode;
};

function resolveMasaGrup(masaProp?: string | null, grupProp?: string | null) {
  const stored = getTableContext();
  const fromProp = String(masaProp || '').trim();
  const fromStore = String(stored.masa || '').trim();
  const table = fromProp || fromStore;
  const groupRaw = String(grupProp || stored.grup || '').trim();
  return {
    table,
    group: groupRaw || null,
  };
}

/**
 * Menüyü kilitlemez. QR ile oturumu açar (admin’de “kod bekliyor”).
 * Sipariş / garson / hesap öncesi ensureUnlocked ile kod ister.
 */
export default function TableSessionCodeGate({ slug, masa, grup, children }: Props) {
  const initial = resolveMasaGrup(masa, grup);
  const [table, setTable] = useState(initial.table);
  const [group, setGroup] = useState<string | null>(initial.group);
  const [enabled, setEnabled] = useState(false);
  const [verified, setVerified] = useState(true);
  const [ttlMinutes, setTtlMinutes] = useState(120);
  const [modalOpen, setModalOpen] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const { pathname } = useLocation();
  usePageBackdrop();
  const [success, setSuccess] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const waitersRef = useRef<Array<(ok: boolean) => void>>([]);
  const successTimerRef = useRef<number | null>(null);

  const active = Boolean(slug && table && table !== ADMIN_PREVIEW_TABLE && table !== 'admin');

  // URL veya storage değişince masa bilgisini güncelle; URL varsa storage’a yaz
  useEffect(() => {
    const next = resolveMasaGrup(masa, grup);
    if (next.table && typeof sessionStorage !== 'undefined') {
      if (String(masa || '').trim()) sessionStorage.setItem('menu_masa', next.table);
      if (String(grup || '').trim()) sessionStorage.setItem('menu_grup', next.group || '');
    }
    setTable(next.table);
    setGroup(next.group);
  }, [masa, grup]);

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
      setSessionId(info.sessionId ?? null);
      rememberTableGroupName(group, info.groupName);
      if (!info.enabled) {
        setEnabled(false);
        setVerified(true);
        return;
      }
      setEnabled(true);
      const ok = !info.needsCode || info.status === 'verified' || Boolean(cached);
      setVerified(ok);
      if (ok && (info.status === 'verified' || !info.needsCode) && !cached) {
        writeTableCodeCache(slug, table, group, info.expiresAt);
      }
    } catch {
      // Fail-open: menü açılsın; garson/sepet anında tekrar kontrol edilir
      setEnabled(true);
      setVerified(Boolean(readTableCodeCache(slug, table, group)));
    }
  }, [slug, table, group, active]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  // Kod penceresi açıkken garson panosunda "kod giriyor" görünsün
  usePresenceEntry('code', '', modalOpen);

  // Müşterinin ekranı: değişince ve ~30 sn'de bir kaba durum gönder
  const baseKind: PresenceKind = pathname.includes('/menu/product/')
    ? 'product'
    : pathname.includes('/menu/group/')
      ? 'category'
      : pathname.includes('/menu/home')
        ? 'menu'
        : 'welcome';
  useEffect(() => {
    if (!slug || !active || !sessionId) return;
    let last = '';
    let timer = 0;
    const push = (force = false) => {
      if (document.hidden) return;
      const top = topPresence(baseKind);
      const sig = `${top.kind}|${top.label}`;
      if (!force && sig === last) return;
      last = sig;
      void sendPresence(slug, { tableNumber: table, groupSlug: group, sessionId, kind: top.kind, label: top.label, active: true });
    };
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => push(), 500);
    };
    const onVisibility = () => {
      if (document.hidden) {
        last = '';
        void sendPresence(slug, { tableNumber: table, groupSlug: group, sessionId, kind: baseKind, label: '', active: false });
      } else push(true);
    };
    push(true);
    const unsub = subscribePresence(schedule);
    const beat = window.setInterval(() => push(true), 30000);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(beat);
      unsub();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [slug, active, sessionId, table, group, baseKind]);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) window.clearTimeout(successTimerRef.current);
    };
  }, []);

  const markNeedsUnlock = useCallback(() => {
    if (!slug || !active) return;
    clearTableCodeCache(slug, table, group);
    setVerified(false);
  }, [slug, active, table, group]);

  const ensureUnlocked = useCallback(async () => {
    if (!active || !slug) return true;

    // Admin onayladıysa / zaten doğrulandıysa sunucudan taze durum al
    try {
      const info = await fetchTableSessionGate(slug, table, group);
      setTtlMinutes(info.ttlMinutes || 120);
      if (!info.enabled) {
        setEnabled(false);
        setVerified(true);
        return true;
      }
      setEnabled(true);
      if (!info.needsCode || info.status === 'verified') {
        writeTableCodeCache(slug, table, group, info.expiresAt);
        setVerified(true);
        return true;
      }
      setVerified(false);
    } catch {
      if (verified || readTableCodeCache(slug, table, group)) return true;
    }

    if (readTableCodeCache(slug, table, group)) {
      setVerified(true);
      return true;
    }

    setModalOpen(true);
    setSuccess(false);
    setError('');
    setCode('');
    return new Promise<boolean>((resolve) => {
      waitersRef.current.push(resolve);
    });
  }, [active, slug, table, group, verified]);

  useEffect(() => {
    if (!modalOpen || success || busy) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, success, busy]);

  function closeModal(ok: boolean) {
    setModalOpen(false);
    setSuccess(false);
    setCode('');
    setError('');
    resolveWaiters(ok);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!slug || !table || success) return;
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
        setSuccess(true);
        if (successTimerRef.current) window.clearTimeout(successTimerRef.current);
        successTimerRef.current = window.setTimeout(() => {
          closeModal(true);
        }, 1100);
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
      {modalOpen
        ? createPortal(
        <div className="table-code-gate table-code-gate--modal" role="dialog" aria-modal="true">
          <div className="table-code-gate__scrim" aria-hidden="true" />
          <div className={`table-code-gate__card${success ? ' is-success' : ''}`}>
            <span className="table-code-gate__grip" aria-hidden="true" />
            {!success ? (
              <button
                type="button"
                className="table-code-gate__close"
                aria-label="Kapat"
                disabled={busy}
                onClick={() => closeModal(false)}
              >
                <X className="w-5 h-5" />
              </button>
            ) : null}

            {success ? (
              <div className="table-code-gate__success">
                <div className="table-code-gate__success-icon" aria-hidden>
                  <CheckCircle2 className="w-10 h-10" strokeWidth={2.25} />
                </div>
                <p className="table-code-gate__eyebrow">Hazır</p>
                <h1>Başarıyla tamamlandı</h1>
                <p className="table-code-gate__copy">Sipariş ve garson çağrısı açıldı.</p>
              </div>
            ) : (
              <>
                <div className="table-code-gate__icon">
                  <KeyRound className="w-7 h-7" />
                </div>
                <p className="table-code-gate__eyebrow">Masa erişimi</p>
                <h1>Lütfen kodu giriniz</h1>
                <p className="table-code-gate__copy">
                  Garson veya sipariş için masadaki kodu girin. Kod yaklaşık {ttlMinutes} dakika
                  geçerlidir.
                </p>
                <div className="table-code-gate__table">
                  <ShieldCheck className="w-4 h-4" />
                  <span>{tableLabel}</span>
                </div>
                <form onSubmit={(e) => void submit(e)} className="table-code-gate__form">
                  <label htmlFor="table-access-code-modal">Erişim kodu</label>
                  <div className={`table-code-gate__cells${error ? ' has-error' : ''}`}>
                    {Array.from({ length: Math.max(6, code.length) }, (_, i) => (
                      <span
                        key={i}
                        className={`table-code-gate__cell${code[i] ? ' is-filled' : ''}${i === code.length ? ' is-current' : ''}`}
                        aria-hidden="true"
                      >
                        {code[i] || ''}
                      </span>
                    ))}
                    <input
                      id="table-access-code-modal"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      autoFocus
                      maxLength={8}
                      value={code}
                      onChange={(e) => {
                        setError('');
                        setCode(e.target.value.replace(/\D/g, '').slice(0, 8));
                      }}
                      disabled={busy}
                    />
                  </div>
                  {error ? <p className="table-code-gate__error" role="alert">{error}</p> : null}
                  <button type="submit" disabled={busy || code.length < 4}>
                    {busy ? 'Kontrol…' : 'Onayla ve devam et'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>,
        document.body,
      )
        : null}
    </TableSessionCodeContext.Provider>
  );
}
