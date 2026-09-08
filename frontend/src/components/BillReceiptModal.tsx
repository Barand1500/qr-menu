import { Printer, X } from 'lucide-react';
import { imageUrl } from '@/lib/api';

export type ReceiptOrderLine = {
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
  createdAt?: string;
};

function money(n: number) {
  return `${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
}

function lineTotal(o: ReceiptOrderLine) {
  const base = (Number(o.price) || 0) * Math.max(1, Number(o.qty) || 1);
  const val = Math.abs(Number(o.adjustmentValue) || 0);
  if (!val || !o.adjustmentType) return base;
  const delta = o.adjustmentMode === 'percent' ? (base * val) / 100 : val;
  if (o.adjustmentType === 'extra') return base + delta;
  if (o.adjustmentType === 'discount') return Math.max(0, base - delta);
  return base;
}

function adjLabel(o: ReceiptOrderLine) {
  if (!o.adjustmentType || !o.adjustmentValue) return '';
  const sign = o.adjustmentType === 'extra' ? '+' : '−';
  const unit = o.adjustmentMode === 'percent' ? '%' : '₺';
  const label = o.adjustmentType === 'extra' ? 'ekstra' : 'indirim';
  return `${sign}${o.adjustmentValue}${unit} ${label}`;
}

function selectionNote(o: ReceiptOrderLine) {
  if (!o.selections?.length) return '';
  return o.selections
    .map((s) => {
      const label = s.label?.trim() || 'Seçenek';
      return s.qty > 1 ? `${label} ×${s.qty}` : label;
    })
    .join(', ');
}

type Props = {
  open: boolean;
  onClose: () => void;
  restaurantName: string;
  logoUrl?: string | null;
  tableName: string;
  guestName?: string | null;
  openedAt?: string | null;
  orders: ReceiptOrderLine[];
  seatingFee?: number;
  total: number;
};

export default function BillReceiptModal({
  open,
  onClose,
  restaurantName,
  logoUrl,
  tableName,
  guestName,
  openedAt,
  orders,
  seatingFee = 0,
  total,
}: Props) {
  if (!open) return null;

  const now = new Date();
  const dateStr = now.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const openStr = openedAt
    ? new Date(openedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    : null;

  const receiptNo = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

  function handlePrint() {
    window.print();
  }

  return (
    <div className="tf-receipt" role="dialog" aria-modal="true" aria-label="Hesap fişi">
      <div className="tf-receipt__backdrop" onClick={onClose} aria-hidden />

      <div className="tf-receipt__chrome no-print">
        <div className="tf-receipt__chrome-inner">
          <p>Hesap fişi</p>
          <div className="tf-receipt__chrome-actions">
            <button type="button" className="tf-receipt__btn" onClick={onClose}>
              <X className="w-4 h-4" />
              Kapat
            </button>
            <button type="button" className="tf-receipt__btn is-primary" onClick={handlePrint}>
              <Printer className="w-4 h-4" />
              Yazdır
            </button>
          </div>
        </div>
      </div>

      <div className="tf-receipt__stage">
        <article className="tf-receipt__paper" id="tf-receipt-print">
          <div className="tf-receipt__perforation" aria-hidden />

          <header className="tf-receipt__brand">
            {logoUrl ? (
              <img src={imageUrl(logoUrl)} alt="" className="tf-receipt__logo" />
            ) : (
              <div className="tf-receipt__logo-fallback" aria-hidden>
                {(restaurantName || 'R').trim().charAt(0).toUpperCase()}
              </div>
            )}
            <h1>{restaurantName || 'Restoran'}</h1>
            <p className="tf-receipt__doc">HESAP FİŞİ</p>
          </header>

          <div className="tf-receipt__meta">
            <div>
              <span>Tarih</span>
              <strong>{dateStr}</strong>
            </div>
            <div>
              <span>Saat</span>
              <strong>{timeStr}</strong>
            </div>
            <div>
              <span>Fiş no</span>
              <strong>{receiptNo}</strong>
            </div>
          </div>

          <div className="tf-receipt__rule" aria-hidden />

          <div className="tf-receipt__table-meta">
            <div>
              <span>Masa</span>
              <strong>{tableName}</strong>
            </div>
            {guestName?.trim() ? (
              <div>
                <span>Misafir</span>
                <strong>{guestName.trim()}</strong>
              </div>
            ) : null}
            {openStr ? (
              <div>
                <span>Açılış</span>
                <strong>{openStr}</strong>
              </div>
            ) : null}
          </div>

          <div className="tf-receipt__rule is-dashed" aria-hidden />

          <ul className="tf-receipt__lines">
            {orders.length === 0 ? (
              <li className="tf-receipt__empty">Sipariş yok</li>
            ) : (
              orders.map((o) => {
                const sel = selectionNote(o);
                const note = (o.freeNote || o.note || '').trim();
                const adj = adjLabel(o);
                return (
                  <li key={o.id}>
                    <div className="tf-receipt__line-main">
                      <span className="tf-receipt__qty">{o.qty}×</span>
                      <div className="tf-receipt__line-text">
                        <strong>{o.name}</strong>
                        {sel ? <em>{sel}</em> : null}
                        {note ? <em>{note}</em> : null}
                        {adj ? <em className="is-adj">{adj}</em> : null}
                      </div>
                      <span className="tf-receipt__amount">{money(lineTotal(o))}</span>
                    </div>
                  </li>
                );
              })
            )}
          </ul>

          {seatingFee > 0 ? (
            <>
              <div className="tf-receipt__rule is-dashed" aria-hidden />
              <div className="tf-receipt__fee">
                <span>Oturma ücreti</span>
                <strong>{money(seatingFee)}</strong>
              </div>
            </>
          ) : null}

          <div className="tf-receipt__rule" aria-hidden />

          <div className="tf-receipt__total">
            <span>Toplam</span>
            <strong>{money(total)}</strong>
          </div>

          <div className="tf-receipt__rule is-dashed" aria-hidden />

          <footer className="tf-receipt__foot">
            <p>Afiyet olsun</p>
            <span>Teşekkür ederiz</span>
          </footer>

          <div className="tf-receipt__perforation is-bottom" aria-hidden />
        </article>
      </div>
    </div>
  );
}
