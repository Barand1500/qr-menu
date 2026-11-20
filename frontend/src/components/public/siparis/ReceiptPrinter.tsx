import { useEffect, useRef } from 'react';
import { AlertCircle, Check, Home, Loader2, RotateCcw } from 'lucide-react';
import { imageUrl } from '@/lib/api';
import './receipt-printer.css';

export type ReceiptStage = 'processing' | 'printing' | 'complete' | 'error';

export type ReceiptData = {
  brandName: string;
  brandLogo?: string | null;
  tableLabel: string;
  items: { name: string; qty: number; line: string }[];
  total: string;
  note?: string;
  orderNo: number | null;
  at: Date;
};

/** Kağıdın yazıcıdan kademeli (satır satır) çıkışı: ms cinsinden toplam süre. Sunucu yanıtından sonra başlar. */
export const PRINT_MS = 2400;

const COPY = {
  tr: {
    processing: 'Siparişin alınıyor',
    printing: 'Fişin yazdırılıyor',
    complete: 'Sipariş iletildi',
    error: 'Sipariş gönderilemedi',
    total: 'Toplam',
    order: 'Sipariş no',
    table: 'Masa',
    date: 'Tarih',
    note: 'Not',
    thanks: 'Afiyet olsun!',
    waiter: 'Garsonumuz masana geliyor.',
    home: 'Menü',
    retry: 'Tekrar dene',
    close: 'Kapat',
    machine: 'Sipariş fişi yazıcısı',
  },
  en: {
    processing: 'Placing your order',
    printing: 'Printing your receipt',
    complete: 'Order sent',
    error: 'Could not send order',
    total: 'Total',
    order: 'Order',
    table: 'Table',
    date: 'Date',
    note: 'Note',
    thanks: 'Enjoy your meal!',
    waiter: 'Your server is on the way.',
    home: 'Menu',
    retry: 'Try again',
    close: 'Close',
    machine: 'Order receipt printer',
  },
};

// Code 39: gerçek, tarayıcıyla okunabilir barkod (rakamlar ve * başlangıç/bitiş).
const C39: Record<string, string> = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn', '4': 'nnnwwnnnw',
  '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw', '8': 'wnnwnnwnn', '9': 'nnwwnnwnn', '*': 'nwnnwnwnn',
};
function barcodeBars(value: string) {
  const text = `*${value}*`;
  const out: { x: number; w: number }[] = [];
  let x = 0;
  for (const ch of text) {
    const pattern = C39[ch];
    if (!pattern) continue;
    [...pattern].forEach((p, i) => {
      const w = p === 'w' ? 3 : 1;
      if (i % 2 === 0) out.push({ x, w });
      x += w;
    });
    x += 1; // karakterler arası boşluk
  }
  return { bars: out, width: x };
}

function Barcode({ value }: { value: string }) {
  const { bars, width } = barcodeBars(value);
  return (
    <svg className="rp-barcode" viewBox={`0 0 ${width} 40`} preserveAspectRatio="none" role="img" aria-label={`Barkod ${value}`}>
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.w} height={40} />
      ))}
    </svg>
  );
}

/**
 * Sipariş onayından sonraki "fiş yazıcısı" anı: makine ekranı durumu söyler, kağıt kademeli çıkar.
 * Hareket azaltma tercihinde kağıt doğrudan görünür.
 */
export default function ReceiptPrinter({
  open,
  stage,
  data,
  lang,
  errorMessage,
  onRetry,
  onClose,
}: {
  open: boolean;
  stage: ReceiptStage;
  data: ReceiptData | null;
  lang: string;
  errorMessage?: string;
  onRetry: () => void;
  onClose: () => void;
}) {
  const t = (lang || 'tr').split('-')[0] === 'en' ? COPY.en : COPY.tr;
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    rootRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const key = (e: KeyboardEvent) => e.key === 'Escape' && (stage === 'complete' || stage === 'error') && closeRef.current();
    window.addEventListener('keydown', key);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', key);
    };
  }, [open, stage]);

  if (!open || !data) return null;
  const printed = stage === 'printing' || stage === 'complete';
  const dateText = data.at.toLocaleString(t === COPY.en ? 'en-GB' : 'tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const orderText = data.orderNo != null ? String(data.orderNo) : '';

  return (
    <div className="rp" ref={rootRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t.machine} data-stage={stage}>
      <div className="rp__glow" aria-hidden="true" />
      <div className="rp__stage">
        <section className="rp__machine">
          <header className="rp__head">
            <span className="rp__logo" aria-hidden="true">
              {data.brandLogo ? <img src={imageUrl(data.brandLogo)} alt="" data-no-fit /> : data.brandName.trim().charAt(0).toLocaleUpperCase('tr') || '•'}
            </span>
            <span className="rp__brand">{data.brandName}</span>
            <button type="button" className="rp__home" onClick={onClose} disabled={stage === 'processing' || stage === 'printing'} aria-hidden={stage === 'processing' || stage === 'printing'} tabIndex={stage === 'complete' || stage === 'error' ? 0 : -1}>
              <Home size={15} aria-hidden /> {t.home}
            </button>
          </header>

          <div className="rp__screen">
            <div className="rp__sum">
              <div>
                <strong>{data.tableLabel}</strong>
                <small>
                  {data.items.reduce((n, i) => n + i.qty, 0)} {t === COPY.en ? 'items' : 'ürün'}
                </small>
              </div>
              <div>
                <small>{t.total}</small>
                <strong className="rp__total">{data.total}</strong>
              </div>
            </div>
            <div className="rp__status" role="status" aria-live="polite" key={stage}>
              <span className={`rp__icon rp__icon--${stage}`} aria-hidden="true">
                {stage === 'complete' ? <Check size={14} strokeWidth={3} /> : stage === 'error' ? <AlertCircle size={15} /> : <Loader2 size={15} className="rp__spin" />}
              </span>
              <span>{stage === 'error' ? errorMessage || t.error : t[stage]}</span>
            </div>
          </div>
          <span className="rp__slot" aria-hidden="true" />
        </section>

        {stage === 'error' ? (
          <div className="rp__actions">
            <button type="button" className="rp__btn" onClick={onRetry}>
              <RotateCcw size={16} aria-hidden /> {t.retry}
            </button>
            <button type="button" className="rp__btn rp__btn--ghost" onClick={onClose}>
              {t.close}
            </button>
          </div>
        ) : (
          <div className={`rp__out${stage === 'complete' ? ' is-done' : ''}`}>
            {printed ? <span className="rp__shade" aria-hidden="true" /> : null}
            <div className={`rp__feed${stage === 'printing' ? ' is-feeding' : ''}${printed ? ' is-out' : ''}`} style={{ ['--rp-ms' as string]: `${PRINT_MS}ms` }}>
              <article className="rp__paper" aria-hidden={stage !== 'complete'}>
                <div className="rp__mark" aria-hidden="true">
                  {data.brandLogo ? <img src={imageUrl(data.brandLogo)} alt="" data-no-fit /> : <span>{data.brandName.trim().charAt(0).toLocaleUpperCase('tr') || '•'}</span>}
                </div>
                <p className="rp__name">{data.brandName}</p>
                <hr />
                <ul className="rp__lines">
                  {data.items.map((i, k) => (
                    <li key={k}>
                      <span>
                        <b>{i.qty}×</b> {i.name}
                      </span>
                      <em>{i.line}</em>
                    </li>
                  ))}
                </ul>
                {data.note ? <p className="rp__note">{t.note}: {data.note}</p> : null}
                <hr />
                <div className="rp__grand">
                  <span>{t.total}</span>
                  <strong>{data.total}</strong>
                </div>
                <hr />
                <dl className="rp__meta">
                  {orderText ? (
                    <div>
                      <dt>{t.order}</dt>
                      <dd>#{orderText}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>{t.table}</dt>
                    <dd>{data.tableLabel.replace(/^Masa\s+/i, '').replace(/^Table\s+/i, '')}</dd>
                  </div>
                  <div>
                    <dt>{t.date}</dt>
                    <dd>{dateText}</dd>
                  </div>
                </dl>
                {orderText ? (
                  <div className="rp__code">
                    <Barcode value={orderText} />
                    <small>ORD {orderText}</small>
                  </div>
                ) : null}
                <p className="rp__thanks">{t.thanks}</p>
                <p className="rp__sub">{t.waiter}</p>
              </article>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
