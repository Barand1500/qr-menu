import { useState } from 'react';
import { ArrowRight, RotateCcw, Tags, Trash2 } from 'lucide-react';
import GroupsDialog from '@/components/admin/groups/GroupsDialog';
import { Button } from '@/components/ui';
import { formatMoney } from '@/lib/api';
import type { PriceChange } from './types';

/** "Bugün 14:32", "Dün 09:10" ya da "18 Kas 2026, 14:32". */
export function formatWhen(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((day(now) - day(date)) / 86400000);
  if (diff === 0) return `Bugün ${time}`;
  if (diff === 1) return `Dün ${time}`;
  return `${date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}, ${time}`;
}

type Pending = { id: number; action: 'restore' | 'delete' } | null;

/**
 * Fiyat geçmişi: en son yapılan en üstte; her kayıtta ne yapıldığı, kim yaptığı, ilk birkaç ürünün eski → yeni
 * fiyatı. "Geri al" o değişiklikten önceki fiyatlara döner; "Sil" kaydı geçmişten kaldırır (fiyatlar değişmez).
 */
export default function PriceHistoryDialog({
  open,
  changes,
  busy,
  error,
  onClose,
  onRestore,
  onDelete,
}: {
  open: boolean;
  changes: PriceChange[];
  busy: boolean;
  error: string;
  onClose: () => void;
  onRestore: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const [pending, setPending] = useState<Pending>(null);

  function confirmText(change: PriceChange, index: number) {
    if (pending?.action === 'delete') {
      return 'Bu kayıt geçmişten silinir ve bu değişikliğe bir daha dönülemez. Ürünlerin şu anki fiyatları değişmez.';
    }
    if (change.kind === 'restore') {
      return `Bu geri alma iptal edilir: ${change.itemCount} ürün, geri almadan önceki fiyatına döner.`;
    }
    return index === 0
      ? `Son değişiklik geri alınır: ${change.itemCount} ürün eski fiyatına döner.`
      : `${change.itemCount} ürün, bu değişiklikten önceki fiyatına döner. Bu tarihten sonra yapılan fiyat değişiklikleri bu ürünlerde geçersiz olur.`;
  }

  return (
    <GroupsDialog
      open={open}
      title="Fiyat geçmişi"
      subtitle="En son yapılan en üstte. Dilediğiniz kayda dönebilir ya da kaydı silebilirsiniz."
      busy={busy}
      onClose={() => {
        setPending(null);
        onClose();
      }}
      className="ap-history"
    >
      {error && (
        <p role="alert" className="ag-form-error">
          {error}
        </p>
      )}
      {!changes.length ? (
        <p className="ag-delete-copy">Henüz kayıtlı bir fiyat değişikliği yok.</p>
      ) : (
        <ol className="aph-list">
          {changes.map((change, index) => {
            const isPending = pending?.id === change.id;
            const more = change.itemCount - change.sample.length;
            return (
              <li key={change.id} className={`aph-card${change.kind === 'restore' ? ' is-restore' : ''}${isPending ? ' is-pending' : ''}`}>
                <div className="aph-top">
                  <span className="aph-icon" aria-hidden="true">
                    {change.kind === 'restore' ? <RotateCcw size={18} /> : <Tags size={18} />}
                  </span>
                  <div className="aph-main">
                    <strong>{change.summary}</strong>
                    <small>
                      {change.itemCount} ürün · {change.userName} · {formatWhen(change.createdAt)}
                    </small>
                  </div>
                  {index === 0 && <span className="aph-badge">Son</span>}
                </div>

                {change.sample.length > 0 && (
                  <ul className="aph-sample">
                    {change.sample.map((s, i) => (
                      <li key={i}>
                        <span>{s.name}</span>
                        <b>
                          {formatMoney(s.oldPrice, { symbol: s.symbol })}
                          {s.newPrice != null && (
                            <>
                              <ArrowRight size={12} aria-hidden="true" />
                              {formatMoney(s.newPrice, { symbol: s.symbol })}
                            </>
                          )}
                        </b>
                      </li>
                    ))}
                    {more > 0 && <li className="aph-more">+{more} ürün daha</li>}
                  </ul>
                )}

                {isPending ? (
                  <div className="aph-confirm" role="group" aria-label="Onay">
                    <p>{confirmText(change, index)}</p>
                    <div>
                      <button type="button" disabled={busy} onClick={() => setPending(null)}>
                        Vazgeç
                      </button>
                      <Button
                        className={pending?.action === 'delete' ? 'ag-delete-button' : undefined}
                        disabled={busy}
                        onClick={() => {
                          const action = pending!.action;
                          setPending(null);
                          if (action === 'restore') onRestore(change.id);
                          else onDelete(change.id);
                        }}
                      >
                        {pending?.action === 'delete' ? 'Kaydı sil' : 'Geri al'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="aph-actions">
                    <button
                      type="button"
                      className="aph-restore"
                      disabled={busy}
                      onClick={() => setPending({ id: change.id, action: 'restore' })}
                    >
                      <RotateCcw size={16} />
                      {change.kind === 'restore' ? 'Geri almayı iptal et' : 'Geri al'}
                    </button>
                    <button
                      type="button"
                      className="aph-delete"
                      disabled={busy}
                      aria-label="Kaydı sil"
                      onClick={() => setPending({ id: change.id, action: 'delete' })}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </GroupsDialog>
  );
}
