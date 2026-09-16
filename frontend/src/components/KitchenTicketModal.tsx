import { Printer, X } from 'lucide-react';

export type KitchenLine = {
  id: string;
  name: string;
  qty: number;
  note?: string;
  freeNote?: string;
  selections?: { label?: string; qty: number }[];
  createdAt?: string;
};

function selectionNote(o: KitchenLine) {
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

type KitchenTicketModalProps = {
  open: boolean;
  restaurantName: string;
  tableName: string;
  lines: KitchenLine[];
  onClose: () => void;
};

export default function KitchenTicketModal({
  open,
  restaurantName,
  tableName,
  lines,
  onClose,
}: KitchenTicketModalProps) {
  if (!open) return null;

  function printTicket() {
    const rows = lines
      .map((o) => {
        const extras = [selectionNote(o), o.freeNote || o.note || ''].filter(Boolean).join(' · ');
        return `<tr>
          <td style="padding:4px 0;font-weight:800;width:2rem;vertical-align:top">${o.qty}×</td>
          <td style="padding:4px 0;vertical-align:top">
            <div style="font-weight:750">${esc(o.name)}</div>
            ${extras ? `<div style="font-size:11px;opacity:.75;margin-top:2px">${esc(extras)}</div>` : ''}
          </td>
        </tr>`;
      })
      .join('');

    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Mutfak</title>
      <style>
        @page { size: 80mm auto; margin: 4mm; }
        body { font-family: "Segoe UI", Arial, sans-serif; color:#111; margin:0; }
        .sheet { width:72mm; margin:0 auto; }
        h1 { font-size:16px; margin:0 0 4px; text-align:center; }
        .sub { text-align:center; font-size:12px; margin-bottom:8px; }
        .meta { font-size:12px; margin-bottom:8px; border-top:1px dashed #999; border-bottom:1px dashed #999; padding:6px 0; }
        table { width:100%; border-collapse:collapse; font-size:13px; }
        .foot { margin-top:10px; text-align:center; font-size:11px; opacity:.7; }
      </style></head><body><div class="sheet">
        <h1>MUTFAK FİŞİ</h1>
        <div class="sub">${esc(restaurantName)}</div>
        <div class="meta"><strong>Masa:</strong> ${esc(tableName)}<br/>${new Date().toLocaleString('tr-TR')}</div>
        <table>${rows || '<tr><td>Kalem yok</td></tr>'}</table>
        <div class="foot">${lines.length} kalem</div>
      </div></body></html>`;

    const w = window.open('', '_blank', 'noopener,noreferrer,width=420,height=640');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    window.setTimeout(() => {
      w.print();
    }, 250);
  }

  return (
    <div className="table-floor-modal" role="dialog" aria-modal="true" aria-label="Mutfak fişi">
      <button type="button" className="table-floor-modal__backdrop" aria-label="Kapat" onClick={onClose} />
      <div className="table-floor-modal__panel" style={{ maxWidth: '22rem' }}>
        <header>
          <div>
            <p>Mutfak</p>
            <h3>{tableName}</h3>
          </div>
          <button type="button" className="table-floor__icon-btn" onClick={onClose} aria-label="Kapat">
            <X className="w-5 h-5" />
          </button>
        </header>
        <div style={{ padding: '0.75rem 1rem', maxHeight: '50vh', overflow: 'auto' }}>
          {lines.length === 0 ? (
            <p className="table-floor__hint">Yazdırılacak kalem yok.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.55rem' }}>
              {lines.map((l) => (
                <li key={l.id} style={{ display: 'flex', gap: '0.6rem', fontSize: '0.9rem' }}>
                  <strong>{l.qty}×</strong>
                  <span>
                    {l.name}
                    {(selectionNote(l) || l.freeNote || l.note) && (
                      <em style={{ display: 'block', fontSize: '0.75rem', opacity: 0.7, fontStyle: 'normal' }}>
                        {[selectionNote(l), l.freeNote || l.note].filter(Boolean).join(' · ')}
                      </em>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <footer className="table-floor-confirm__footer">
          <button type="button" className="table-floor__secondary" onClick={onClose}>
            Vazgeç
          </button>
          <button
            type="button"
            className="table-floor__primary"
            disabled={!lines.length}
            onClick={printTicket}
          >
            <Printer className="w-4 h-4" />
            Yazdır
          </button>
        </footer>
      </div>
    </div>
  );
}
