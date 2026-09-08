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

function esc(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const PRINT_CSS = `
  @page { size: 80mm auto; margin: 4mm; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
    color: #111;
    font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet {
    width: 72mm;
    margin: 0 auto;
    padding: 0;
  }
  .brand { text-align: center; margin-bottom: 8px; }
  .logo {
    display: block;
    width: 48px;
    height: 48px;
    object-fit: contain;
    margin: 0 auto 6px;
  }
  .logo-fb {
    width: 40px;
    height: 40px;
    margin: 0 auto 6px;
    border-radius: 999px;
    background: #111;
    color: #fff;
    display: grid;
    place-items: center;
    font-weight: 800;
    font-size: 18px;
  }
  h1 {
    margin: 0;
    font-size: 15px;
    font-weight: 800;
    line-height: 1.2;
  }
  .doc {
    margin: 4px 0 0;
    font-size: 9px;
    letter-spacing: 0.12em;
    font-weight: 700;
    color: #555;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 10px;
    margin: 8px 0;
  }
  .grid span {
    display: block;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #777;
  }
  .grid strong {
    display: block;
    margin-top: 1px;
    font-size: 11px;
    font-weight: 750;
  }
  .rule {
    border: 0;
    border-top: 1px solid #111;
    margin: 8px 0;
  }
  .rule.dash {
    border-top: 1px dashed #999;
  }
  .lines { margin: 0; padding: 0; list-style: none; }
  .line {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 4px;
    margin: 0 0 7px;
    align-items: start;
    font-size: 11px;
  }
  .qty { font-weight: 800; }
  .name { font-weight: 750; line-height: 1.25; }
  .sub {
    display: block;
    margin-top: 1px;
    font-size: 9px;
    color: #666;
    font-weight: 600;
  }
  .amt { font-weight: 750; white-space: nowrap; }
  .fee, .total {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 11px;
    font-weight: 700;
  }
  .total {
    font-size: 13px;
    align-items: baseline;
  }
  .total strong { font-size: 16px; font-weight: 850; }
  .foot {
    text-align: center;
    margin-top: 10px;
    font-size: 11px;
    font-weight: 750;
  }
  .foot small {
    display: block;
    margin-top: 2px;
    font-size: 9px;
    color: #666;
    font-weight: 600;
  }
`;

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
    : '—';
  const closeStr = timeStr;

  const receiptNo = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const logoSrc = logoUrl ? imageUrl(logoUrl) : '';
  const name = restaurantName || 'Restoran';

  function buildPrintHtml() {
    const lines =
      orders.length === 0
        ? `<li class="line"><span></span><div class="name">Sipariş yok</div><span></span></li>`
        : orders
            .map((o) => {
              const sel = selectionNote(o);
              const note = (o.freeNote || o.note || '').trim();
              const adj = adjLabel(o);
              const subs = [sel, note, adj]
                .filter(Boolean)
                .map((t) => `<span class="sub">${esc(t!)}</span>`)
                .join('');
              return `<li class="line">
                <span class="qty">${o.qty}×</span>
                <div><div class="name">${esc(o.name)}</div>${subs}</div>
                <span class="amt">${esc(money(lineTotal(o)))}</span>
              </li>`;
            })
            .join('');

    const feeBlock =
      seatingFee > 0
        ? `<hr class="rule dash" /><div class="fee"><span>Oturma ücreti</span><strong>${esc(money(seatingFee))}</strong></div>`
        : '';

    const logoBlock = logoSrc
      ? `<img class="logo" src="${esc(logoSrc)}" alt="" />`
      : `<div class="logo-fb">${esc(name.trim().charAt(0).toUpperCase() || 'R')}</div>`;

    return `<!doctype html><html><head><meta charset="utf-8" /><title>Hesap fişi</title>
<style>${PRINT_CSS}</style></head><body>
<div class="sheet">
  <div class="brand">${logoBlock}<h1>${esc(name)}</h1><p class="doc">HESAP FİŞİ</p></div>
  <div class="grid">
    <div><span>Tarih</span><strong>${esc(dateStr)}</strong></div>
    <div><span>Saat</span><strong>${esc(timeStr)}</strong></div>
    <div><span>Fiş no</span><strong>${esc(receiptNo)}</strong></div>
  </div>
  <hr class="rule" />
  <div class="grid">
    <div><span>Masa</span><strong>${esc(tableName)}</strong></div>
    <div><span>Misafir</span><strong>${esc(guestName?.trim() || '—')}</strong></div>
    <div><span>Açılış</span><strong>${esc(openStr)}</strong></div>
    <div><span>Kapanış</span><strong>${esc(closeStr)}</strong></div>
  </div>
  <hr class="rule dash" />
  <ul class="lines">${lines}</ul>
  ${feeBlock}
  <hr class="rule" />
  <div class="total"><span>Toplam</span><strong>${esc(money(total))}</strong></div>
  <hr class="rule dash" />
  <div class="foot">Afiyet olsun<small>Teşekkür ederiz</small></div>
</div>
</body></html>`;
  }

  function handlePrint() {
    const html = buildPrintHtml();
    const iframe = document.createElement('iframe');
    iframe.setAttribute('title', 'Hesap yazdır');
    iframe.style.cssText =
      'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      iframe.remove();
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();

    const win = iframe.contentWindow;
    const cleanup = () => {
      setTimeout(() => iframe.remove(), 400);
    };

    const run = () => {
      try {
        win?.focus();
        win?.print();
      } finally {
        cleanup();
      }
    };

    const imgs = Array.from(doc.images || []);
    if (!imgs.length) {
      setTimeout(run, 50);
      return;
    }
    let left = imgs.length;
    const done = () => {
      left -= 1;
      if (left <= 0) setTimeout(run, 40);
    };
    imgs.forEach((img) => {
      if (img.complete) done();
      else {
        img.onload = done;
        img.onerror = done;
      }
    });
  }

  return (
    <div className="tf-receipt" role="dialog" aria-modal="true" aria-label="Hesap fişi">
      <div className="tf-receipt__backdrop" onClick={onClose} aria-hidden />

      <div className="tf-receipt__chrome">
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
        <article className="tf-receipt__paper">
          <div className="tf-receipt__perforation" aria-hidden />

          <header className="tf-receipt__brand">
            {logoSrc ? (
              <img src={logoSrc} alt="" className="tf-receipt__logo" />
            ) : (
              <div className="tf-receipt__logo-fallback" aria-hidden>
                {name.trim().charAt(0).toUpperCase() || 'R'}
              </div>
            )}
            <h1>{name}</h1>
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
            <div>
              <span>Misafir</span>
              <strong>{guestName?.trim() || '—'}</strong>
            </div>
            <div>
              <span>Açılış</span>
              <strong>{openStr}</strong>
            </div>
            <div>
              <span>Kapanış</span>
              <strong>{closeStr}</strong>
            </div>
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
