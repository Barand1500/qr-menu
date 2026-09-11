import { useState } from 'react';
import { HandHelping, Check, AlertCircle } from 'lucide-react';
import { api, isCodeRequiredError } from '@/lib/api';
import { useMenuSlug } from '@/hooks/useMenuSlug';
import { resolveTableContext } from '@/lib/tableContext';
import { notifyTableRequestCreated } from '@/lib/tableRequestNotify';
import { notifyWaiterCalled } from '@/lib/menuGames';
import { useTableSessionCode } from '@/components/public/TableSessionCodeGate';

const COPY = {
  tr: {
    waiter: 'Garson çağır',
    sent: 'İletildi',
    wait: 'Bekleniyor',
    err: 'Olmadı',
  },
  en: {
    waiter: 'Call waiter',
    sent: 'Sent',
    wait: 'Wait',
    err: 'Failed',
  },
};

function ui(lang: string) {
  return (lang || 'tr').split('-')[0] === 'en' ? COPY.en : COPY.tr;
}

export default function TableServiceButtons({
  lang,
  slug: slugProp,
  enabled = true,
}: {
  lang: string;
  slug?: string | null;
  enabled?: boolean;
}) {
  const { slug: resolvedSlug } = useMenuSlug();
  const slug = slugProp ?? resolvedSlug;
  const t = ui(lang);
  const { ensureUnlocked, markNeedsUnlock } = useTableSessionCode();
  const [tableCtx] = useState(() => resolveTableContext());
  const masa = tableCtx.masa;
  const grup = tableCtx.grup;
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);

  if (!slug || !enabled) return null;

  async function postWaiter() {
    return api<{
      ok: boolean;
      duplicate?: boolean;
      id: number;
      type: string;
      tableNumber: string;
      groupSlug?: string | null;
      createdAt: string;
    }>(`/api/menu/${slug}/table-request`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'waiter',
        tableNumber: masa,
        groupSlug: grup || undefined,
      }),
    });
  }

  async function send() {
    if (busy || done || !masa) return;
    setBusy(true);
    setError(false);
    try {
      const unlocked = await ensureUnlocked();
      if (!unlocked) return;
      let res;
      try {
        res = await postWaiter();
      } catch (err) {
        if (!isCodeRequiredError(err)) throw err;
        markNeedsUnlock();
        const again = await ensureUnlocked();
        if (!again) return;
        res = await postWaiter();
      }
      if (!res.duplicate) {
        notifyTableRequestCreated({
          id: res.id,
          type: res.type,
          tableNumber: res.tableNumber,
          groupSlug: res.groupSlug,
          createdAt: res.createdAt,
        });
      }
      notifyWaiterCalled();
      setDone(true);
      window.setTimeout(() => setDone(false), 45_000);
    } catch {
      setError(true);
      window.setTimeout(() => setError(false), 2800);
    } finally {
      setBusy(false);
    }
  }

  const label = error ? t.err : done ? t.sent : busy ? t.wait : t.waiter;

  return (
    <button
      type="button"
      className={`table-service-header-btn${done ? ' is-done' : ''}${error ? ' is-error' : ''}`}
      disabled={busy}
      onClick={() => void send()}
      aria-label={label}
      title={label}
    >
      {error ? (
        <AlertCircle className="w-4 h-4" />
      ) : done ? (
        <Check className="w-4 h-4" />
      ) : (
        <HandHelping className="w-4 h-4" />
      )}
    </button>
  );
}
