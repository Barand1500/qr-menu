import { useEffect, useMemo, useState } from 'react';
import { Check, Printer, X } from 'lucide-react';
import '@/components/table-payment-modal.css';

export type PaymentOrderLine = {
  id: string;
  name: string;
  qty: number;
  price: number;
  note?: string;
  freeNote?: string;
  selections?: { label?: string; qty: number }[];
  adjustmentType?: 'extra' | 'discount' | null;
  adjustmentMode?: 'fixed' | 'percent';
  adjustmentValue?: number;
  settledAt?: string | null;
};

export type PaymentMethod = 'cash' | 'card' | 'mixed';

type Props = {
  open: boolean;
  tableName: string;
  orders: PaymentOrderLine[];
  seatingFee: number;
  seatingFeePaid: number;
  paidTotal: number;
  remaining: number;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    itemIds: string[];
    includeSeatingFee: boolean;
    method: PaymentMethod;
  }) => Promise<void> | void;
  onPrintSelection?: (payload: {
    itemIds: string[];
    includeSeatingFee: boolean;
    amount: number;
    method: PaymentMethod;
  }) => void;
};

function money(n: number) {
  return `${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
}

function lineTotal(o: PaymentOrderLine) {
  const base = (Number(o.price) || 0) * Math.max(1, Number(o.qty) || 1);
  const val = Math.abs(Number(o.adjustmentValue) || 0);
  if (!val || !o.adjustmentType) return base;
  const delta = o.adjustmentMode === 'percent' ? (base * val) / 100 : val;
  if (o.adjustmentType === 'extra') return base + delta;
  if (o.adjustmentType === 'discount') return Math.max(0, base - delta);
  return base;
}

function selectionNote(o: PaymentOrderLine) {
  if (!o.selections?.length) return '';
  return o.selections
    .map((s) => {
      const label = s.label?.trim() || 'Seçenek';
      return s.qty > 1 ? `${label} ×${s.qty}` : label;
    })
    .join(', ');
}

export default function TablePaymentModal({
  open,
  tableName,
  orders,
  seatingFee,
  seatingFeePaid,
  paidTotal,
  remaining,
  busy,
  onClose,
  onSubmit,
  onPrintSelection,
}: Props) {
  const unpaid = useMemo(() => orders.filter((o) => !o.settledAt), [orders]);
  const settled = useMemo(() => orders.filter((o) => o.settledAt), [orders]);
  const seatLeft = Math.max(0, Math.round((seatingFee - seatingFeePaid) * 100) / 100);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [includeSeat, setIncludeSeat] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>('cash');

  useEffect(() => {
    if (!open) return;
    setSelected(new Set(unpaid.map((o) => o.id)));
    setIncludeSeat(seatLeft > 0.009);
    setMethod('cash');
  }, [open, unpaid, seatLeft]);

  const selectedAmount = useMemo(() => {
    let sum = 0;
    for (const o of unpaid) {
      if (selected.has(o.id)) sum += lineTotal(o);
    }
    if (includeSeat) sum += seatLeft;
    return Math.round(sum * 100) / 100;
  }, [unpaid, selected, includeSeat, seatLeft]);

  if (!open) return null;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllUnpaid() {
    setSelected(new Set(unpaid.map((o) => o.id)));
    setIncludeSeat(seatLeft > 0.009);
  }

  function clearSelection() {
    setSelected(new Set());
    setIncludeSeat(false);
  }

  const canPay = selectedAmount > 0.009 && !busy;

  return (
    <div className="tf-pay" role="dialog" aria-modal="true" aria-label="Masa ödemesi">
      <button type="button" className="tf-pay__backdrop" aria-label="Kapat" onClick={onClose} />
      <div className="tf-pay__panel">
        <header className="tf-pay__head">
          <div>
            <p>Ödeme</p>
            <h3>{tableName}</h3>
          </div>
          <button type="button" className="tf-pay__icon" onClick={onClose} aria-label="Kapat">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="tf-pay__summary">
          <div>
            <span>Ödenen</span>
            <strong>{money(paidTotal)}</strong>
          </div>
          <div>
            <span>Kalan</span>
            <strong className={remaining > 0.009 ? 'is-warn' : 'is-ok'}>{money(remaining)}</strong>
          </div>
        </div>

        <div className="tf-pay__toolbar">
          <button type="button" onClick={selectAllUnpaid}>
            Tümünü seç
          </button>
          <button type="button" onClick={clearSelection}>
            Temizle
          </button>
        </div>

        <div className="tf-pay__list">
          {unpaid.length === 0 && seatLeft <= 0.009 ? (
            <p className="tf-pay__empty">Ödenecek kalem kalmadı</p>
          ) : null}

          {unpaid.map((o) => {
            const on = selected.has(o.id);
            const sel = selectionNote(o);
            const note = (o.freeNote || o.note || '').trim();
            return (
              <button
                key={o.id}
                type="button"
                className={`tf-pay__row${on ? ' is-on' : ''}`}
                onClick={() => toggle(o.id)}
              >
                <span className={`tf-pay__check${on ? ' is-on' : ''}`}>
                  {on ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : null}
                </span>
                <span className="tf-pay__meta">
                  <strong>
                    {o.qty}× {o.name}
                  </strong>
                  {sel ? <em>{sel}</em> : null}
                  {note ? <em>{note}</em> : null}
                </span>
                <span className="tf-pay__amt">{money(lineTotal(o))}</span>
              </button>
            );
          })}

          {seatLeft > 0.009 ? (
            <button
              type="button"
              className={`tf-pay__row${includeSeat ? ' is-on' : ''}`}
              onClick={() => setIncludeSeat((v) => !v)}
            >
              <span className={`tf-pay__check${includeSeat ? ' is-on' : ''}`}>
                {includeSeat ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : null}
              </span>
              <span className="tf-pay__meta">
                <strong>Oturma ücreti</strong>
                <em>Birikmiş tutar</em>
              </span>
              <span className="tf-pay__amt">{money(seatLeft)}</span>
            </button>
          ) : null}

          {settled.length > 0 ? (
            <div className="tf-pay__settled">
              <p>Ödenmiş kalemler</p>
              {settled.map((o) => (
                <div key={o.id} className="tf-pay__row is-settled">
                  <span className="tf-pay__meta">
                    <strong>
                      {o.qty}× {o.name}
                    </strong>
                  </span>
                  <span className="tf-pay__amt">{money(lineTotal(o))}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="tf-pay__methods">
          {(
            [
              ['cash', 'Nakit'],
              ['card', 'Kart'],
              ['mixed', 'Karışık'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={method === id ? 'is-on' : undefined}
              onClick={() => setMethod(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <footer className="tf-pay__foot">
          <div className="tf-pay__selected">
            <span>Seçilen</span>
            <strong>{money(selectedAmount)}</strong>
          </div>
          <div className="tf-pay__actions">
            {onPrintSelection ? (
              <button
                type="button"
                className="tf-pay__ghost"
                disabled={selectedAmount <= 0.009}
                onClick={() =>
                  onPrintSelection({
                    itemIds: [...selected],
                    includeSeatingFee: includeSeat && seatLeft > 0.009,
                    amount: selectedAmount,
                    method,
                  })
                }
              >
                <Printer className="w-4 h-4" />
                Fiş
              </button>
            ) : null}
            <button type="button" className="tf-pay__ghost" onClick={onClose}>
              Vazgeç
            </button>
            <button
              type="button"
              className="tf-pay__submit"
              disabled={!canPay}
              onClick={() =>
                void onSubmit({
                  itemIds: [...selected],
                  includeSeatingFee: includeSeat && seatLeft > 0.009,
                  method,
                })
              }
            >
              {busy ? 'Kaydediliyor…' : 'Ödemeyi kaydet'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
