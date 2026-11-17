import { useEffect, useMemo, useState } from 'react';
import { Printer, X } from 'lucide-react';
import AdminOverlay from '@/components/admin/AdminOverlay';
import { Button } from '@/components/ui';
import { PAPERS, PER_PAGE, sheetLayout, type PaperId } from './qr';

export type PrintSettings = {
  paperId: PaperId;
  perPage: number;
  cut: boolean;
  scope: 'one' | 'all';
};
const KEY = 'menu-qr-print-v2';
export function loadPrintSettings(): PrintSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    return {
      paperId: PAPERS.some((p) => p.id === raw?.paperId) ? raw.paperId : 'a4',
      perPage: (PER_PAGE as readonly number[]).includes(raw?.perPage)
        ? raw.perPage
        : 4,
      cut: raw?.cut !== false,
      scope: 'one',
    };
  } catch {
    return { paperId: 'a4', perPage: 4, cut: true, scope: 'one' };
  }
}

export default function PrintDialog({
  open,
  title,
  allCount,
  allLabel,
  onClose,
  onPrint,
}: {
  open: boolean;
  title: string;
  /** Number of cards in the "everything" scope (tables of a group); 0 hides the choice. */
  allCount: number;
  allLabel: string;
  onClose: () => void;
  onPrint: (settings: PrintSettings) => void;
}) {
  const [settings, setSettings] = useState<PrintSettings>(loadPrintSettings);
  useEffect(() => {
    if (open)
      setSettings((s) => ({
        ...loadPrintSettings(),
        scope: allCount ? s.scope : 'one',
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const paper = PAPERS.find((p) => p.id === settings.paperId) || PAPERS[0];
  const counts = paper.id === 'a5' ? PER_PAGE.filter((n) => n <= 4) : PER_PAGE;
  const perPage = paper.sheet
    ? (counts as readonly number[]).includes(settings.perPage)
      ? settings.perPage
      : 4
    : 1;
  const layout = sheetLayout(settings.paperId, perPage);
  const cards = settings.scope === 'all' && allCount ? allCount : layout.per;
  const pages = Math.ceil(cards / layout.per);
  const set = (patch: Partial<PrintSettings>) =>
    setSettings((s) => ({ ...s, ...patch }));
  const cells = useMemo(
    () => Array.from({ length: layout.per }, (_, i) => i),
    [layout.per],
  );
  const summary =
    settings.scope === 'all' && allCount
      ? `${allCount} kart · ${pages} sayfa`
      : paper.sheet
        ? `Sayfa ${layout.per} kopyayla dolar`
        : '1 kart';
  if (!open) return null;
  return (
    <AdminOverlay
      label="Yazdırma ayarları"
      onClose={onClose}
      className="bq-overlay"
    >
      <section className="bq-dialog bq-print">
        <header className="bq-dialog__head">
          <div>
            <span className="bq-eyebrow">YAZDIR</span>
            <h2>{title}</h2>
          </div>
          <button
            type="button"
            className="bq-icon"
            aria-label="Pencereyi kapat"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        <div className="bq-dialog__scroll admin-scroll bq-print__body">
          <div className="bq-paper-wrap" aria-hidden="true">
            <div className="bq-paper-stack" data-pages={Math.min(3, pages)}>
              <div
                className="bq-paper"
                style={{
                  aspectRatio: `${paper.w} / ${layout.pageH}`,
                  gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))`,
                }}
              >
                {cells.map((i) => (
                  <span
                    className="bq-paper__cell"
                    key={`${settings.paperId}-${perPage}-${i}`}
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <i />
                  </span>
                ))}
              </div>
            </div>
            <strong className="bq-paper-wrap__sum">{summary}</strong>
          </div>
          <div className="bq-print__opts">
            <fieldset className="bq-field">
              <legend>Kağıt</legend>
              <div className="bq-seg" role="group" aria-label="Kağıt">
                {PAPERS.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    aria-pressed={settings.paperId === p.id}
                    onClick={() => set({ paperId: p.id })}
                  >
                    {p.label}
                    {!p.sheet && <small>Termal</small>}
                  </button>
                ))}
              </div>
            </fieldset>
            {paper.sheet && (
              <fieldset className="bq-field">
                <legend>Sayfada</legend>
                <div
                  className="bq-seg bq-seg--num"
                  role="group"
                  aria-label="Sayfadaki kart sayısı"
                >
                  {counts.map((n) => (
                    <button
                      type="button"
                      key={n}
                      aria-pressed={perPage === n}
                      onClick={() => set({ perPage: n })}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            {allCount > 0 && (
              <fieldset className="bq-field">
                <legend>Ne yazdırılsın?</legend>
                <div className="bq-choice" role="group" aria-label="Kapsam">
                  <button
                    type="button"
                    aria-pressed={settings.scope === 'one'}
                    onClick={() => set({ scope: 'one' })}
                  >
                    <strong>Seçili kart</strong>
                    <small>{title}</small>
                  </button>
                  <button
                    type="button"
                    aria-pressed={settings.scope === 'all'}
                    onClick={() => set({ scope: 'all' })}
                  >
                    <strong>{allLabel}</strong>
                    <small>{allCount} kart, her biri kendi tasarımıyla</small>
                  </button>
                </div>
              </fieldset>
            )}
            <label className="bq-switch-row">
              <span>
                <strong>Kesim çizgisi</strong>
                <small>Kartların etrafına ince kesik çizgi çizer</small>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={settings.cut}
                onChange={(e) => set({ cut: e.target.checked })}
              />
              <i className="bq-switch" aria-hidden="true" />
            </label>
          </div>
        </div>
        <footer className="bq-dialog__foot">
          <Button
            onClick={() => {
              const next = { ...settings, perPage };
              try {
                localStorage.setItem(KEY, JSON.stringify(next));
              } catch {
                /* storage may be blocked */
              }
              onPrint(next);
            }}
          >
            <Printer size={18} /> Yazdır
          </Button>
        </footer>
      </section>
    </AdminOverlay>
  );
}
