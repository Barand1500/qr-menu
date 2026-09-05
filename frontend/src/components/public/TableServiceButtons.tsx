import { useState } from 'react';
import { HandHelping, Receipt, Check, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useMenuSlug } from '@/hooks/useMenuSlug';
import { resolveTableContext } from '@/lib/tableContext';
import { notifyTableRequestCreated } from '@/lib/tableRequestNotify';

type RequestType = 'waiter' | 'bill';

const COPY = {
  tr: {
    waiter: 'Garson',
    bill: 'Hesap',
    sent: 'İletildi',
    wait: 'Bekleniyor',
    err: 'Olmadı',
    group: 'Masa hizmeti',
  },
  en: {
    waiter: 'Waiter',
    bill: 'Bill',
    sent: 'Sent',
    wait: 'Wait',
    err: 'Failed',
    group: 'Table service',
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
  const [tableCtx] = useState(() => resolveTableContext());
  const masa = tableCtx.masa;
  const grup = tableCtx.grup;
  const [busy, setBusy] = useState<RequestType | null>(null);
  const [done, setDone] = useState<RequestType | null>(null);
  const [error, setError] = useState<RequestType | null>(null);

  if (!slug || !enabled) return null;

  async function send(type: RequestType) {
    if (busy || done || !masa) return;
    setBusy(type);
    setError(null);
    try {
      const res = await api<{
        ok: boolean;
        id: number;
        type: string;
        tableNumber: string;
        groupSlug?: string | null;
        createdAt: string;
      }>(`/api/menu/${slug}/table-request`, {
        method: 'POST',
        body: JSON.stringify({
          type,
          tableNumber: masa,
          groupSlug: grup || undefined,
        }),
      });
      notifyTableRequestCreated({
        id: res.id,
        type: res.type,
        tableNumber: res.tableNumber,
        groupSlug: res.groupSlug,
        createdAt: res.createdAt,
      });
      setDone(type);
      window.setTimeout(() => setDone(null), 3500);
    } catch {
      setError(type);
      window.setTimeout(() => setError(null), 2800);
    } finally {
      setBusy(null);
    }
  }

  function labelFor(type: RequestType) {
    if (error === type) return t.err;
    if (done === type) return t.sent;
    if (busy === type) return t.wait;
    return type === 'waiter' ? t.waiter : t.bill;
  }

  return (
    <div className="table-service-bar" role="group" aria-label={t.group}>
      <button
        type="button"
        className={`table-service-btn table-service-btn--icon table-service-btn--waiter${
          done === 'waiter' ? ' is-done' : error === 'waiter' ? ' is-error' : ''
        }`}
        disabled={Boolean(busy)}
        onClick={() => void send('waiter')}
        aria-label={labelFor('waiter')}
        title={labelFor('waiter')}
      >
        {error === 'waiter' ? (
          <AlertCircle className="w-5 h-5" />
        ) : done === 'waiter' ? (
          <Check className="w-5 h-5" />
        ) : (
          <HandHelping className="w-5 h-5" />
        )}
      </button>
      <button
        type="button"
        className={`table-service-btn table-service-btn--icon table-service-btn--bill${
          done === 'bill' ? ' is-done' : error === 'bill' ? ' is-error' : ''
        }`}
        disabled={Boolean(busy)}
        onClick={() => void send('bill')}
        aria-label={labelFor('bill')}
        title={labelFor('bill')}
      >
        {error === 'bill' ? (
          <AlertCircle className="w-5 h-5" />
        ) : done === 'bill' ? (
          <Check className="w-5 h-5" />
        ) : (
          <Receipt className="w-5 h-5" />
        )}
      </button>
    </div>
  );
}
