import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import {
  fetchTableSessionGate,
  readTableCodeCache,
  unlockTableSession,
  writeTableCodeCache,
} from '@/lib/tableSessionCode';
import { formatTableServiceLabel } from '@/lib/tableContext';
import '@/table-session-code.css';

type Props = {
  slug: string | null;
  masa: string | null;
  grup: string | null;
  children: React.ReactNode;
};

export default function TableSessionCodeGate({ slug, masa, grup, children }: Props) {
  const [checking, setChecking] = useState(true);
  const [needsCode, setNeedsCode] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ttlMinutes, setTtlMinutes] = useState(120);

  const runCheck = useCallback(async () => {
    if (!slug) return;
    const table = String(masa || '').trim();
    if (!table || table === 'admin') {
      setNeedsCode(false);
      setChecking(false);
      return;
    }

    setChecking(true);
    setError('');
    try {
      const cached = readTableCodeCache(slug, table, grup);
      const info = await fetchTableSessionGate(slug, table, grup);
      setTtlMinutes(info.ttlMinutes || 120);
      if (!info.enabled) {
        setNeedsCode(false);
        return;
      }
      if (!info.needsCode || (cached && info.status === 'verified')) {
        setNeedsCode(false);
        return;
      }
      setNeedsCode(true);
    } catch {
      setNeedsCode(false);
    } finally {
      setChecking(false);
    }
  }, [slug, masa, grup]);

  useEffect(() => {
    void runCheck();
  }, [runCheck]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!slug || !masa) return;
    const pin = code.replace(/\D/g, '').slice(0, 12);
    if (pin.length < 4) {
      setError('En az 4 haneli kod girin');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await unlockTableSession(slug, masa, grup, pin);
      if (res.verified) {
        if (res.expiresAt) writeTableCodeCache(slug, masa, grup, res.expiresAt);
        setNeedsCode(false);
      } else {
        setError('Kod doğrulanamadı');
      }
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: string }).message || '')
          : '';
      setError(msg || 'Kod hatalı veya süresi dolmuş');
    } finally {
      setBusy(false);
    }
  }

  if (!slug || checking) {
    return (
      <div className="table-code-gate table-code-gate--loading">
        <Loader2 className="w-7 h-7 animate-spin" />
        <p>Kontrol ediliyor…</p>
      </div>
    );
  }

  if (!needsCode) return <>{children}</>;

  const tableLabel = formatTableServiceLabel(masa || '', grup);

  return (
    <div className="table-code-gate">
      <div className="table-code-gate__card">
        <div className="table-code-gate__icon">
          <KeyRound className="w-7 h-7" />
        </div>
        <p className="table-code-gate__eyebrow">Masa erişimi</p>
        <h1>Menü için kod gerekli</h1>
        <p className="table-code-gate__copy">
          Garsonun verdiği kodu gir. Kod yaklaşık {ttlMinutes} dakika geçerli.
        </p>
        <div className="table-code-gate__table">
          <ShieldCheck className="w-4 h-4" />
          <span>{tableLabel}</span>
        </div>
        <form onSubmit={(e) => void submit(e)} className="table-code-gate__form">
          <label htmlFor="table-access-code">Erişim kodu</label>
          <input
            id="table-access-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            placeholder="••••••"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
            disabled={busy}
          />
          {error ? <p className="table-code-gate__error">{error}</p> : null}
          <button type="submit" disabled={busy || code.length < 4}>
            {busy ? 'Kontrol…' : 'Menüyü aç'}
          </button>
        </form>
      </div>
    </div>
  );
}
