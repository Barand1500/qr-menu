import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ChartLine, Maximize2, RotateCcw, Tags, Trash2 } from 'lucide-react';
import GroupsDialog from '@/components/admin/groups/GroupsDialog';
import { Button } from '@/components/ui';
import { formatMoney } from '@/lib/api';
import { adminPath } from '@/lib/adminPath';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import PriceHistoryExplorer from './PriceHistoryExplorer';
import { formatWhen } from '@/lib/priceHistory';
import type { PriceChange } from './types';

export { formatWhen };

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
  const navigate = useNavigate();
  const wide = useMediaQuery('(min-width: 1100px)');
  // Geniş ekranda grafik paneli açılır (tercih hatırlanır); telefonda "Grafik" sekmesi.
  const [chartOpen, setChartOpen] = useState(false);
  const [chartMounted, setChartMounted] = useState(false);
  useEffect(() => {
    if (!open) return;
    let stored = '1';
    try {
      stored = localStorage.getItem('aph_chart_open') ?? '1';
    } catch {
      /* tercih okunamadı */
    }
    const next = wide ? stored !== '0' : false;
    setChartOpen(next);
    setChartMounted(next);
  }, [open, wide]);
  function toggleChart(next: boolean) {
    setChartOpen(next);
    if (next) setChartMounted(true);
    if (wide) {
      try {
        localStorage.setItem('aph_chart_open', next ? '1' : '0');
      } catch {
        /* tercih kaydedilemedi */
      }
    }
  }
  const openFull = () => {
    setPending(null);
    onClose();
    navigate(adminPath('price-history'));
  };

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
      className={`ap-history${chartOpen ? ' has-chart' : ''}`}
      headerActions={
        <>
          <button
            type="button"
            className="aph-tool aph-tool--chart"
            aria-pressed={chartOpen}
            onClick={() => toggleChart(!chartOpen)}
          >
            <ChartLine size={17} aria-hidden="true" />
            <span className="aph-tool__label">{chartOpen ? 'Grafiği kapat' : 'Grafik'}</span>
          </button>
          <button type="button" className="aph-tool aph-tool--icon" aria-label="Tam ekran fiyat geçmişi" title="Tam ekran" onClick={openFull}>
            <Maximize2 size={17} aria-hidden="true" />
          </button>
        </>
      }
    >
      <div className="aph-split">
      <div className="aph-tabs" role="tablist" aria-label="Görünüm">
        <button type="button" role="tab" aria-selected={!chartOpen} onClick={() => toggleChart(false)}>
          Değişiklikler
        </button>
        <button type="button" role="tab" aria-selected={chartOpen} onClick={() => toggleChart(true)}>
          Ürün grafiği
        </button>
      </div>
      <div className="aph-pane aph-pane--list">
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
      </div>
      <aside className="aph-pane aph-pane--chart" aria-label="Ürün fiyat grafiği" aria-hidden={!chartOpen}>
        {chartMounted ? <PriceHistoryExplorer variant="side" onOpenFull={openFull} /> : null}
      </aside>
      </div>
    </GroupsDialog>
  );
}
