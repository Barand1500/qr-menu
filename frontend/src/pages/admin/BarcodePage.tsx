import { useState } from 'react';
import { Printer } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Card, PageHeader } from '@/components/ui';

const PAPER_SIZES = [
  { value: 'a4', label: 'A4' },
  { value: 'a5', label: 'A5' },
  { value: '80mm', label: '80mm Termal' },
  { value: '58mm', label: '58mm Termal' },
];

export default function BarcodePage() {
  const { user } = useAuth();
  const [paperSize, setPaperSize] = useState('');
  const menuUrl = `${window.location.origin}/menu`;

  function handlePrint() {
    if (!paperSize) {
      alert('Lütfen kağıt boyutu seçin');
      return;
    }
    window.print();
  }

  return (
    <div>
      <PageHeader
        title="Barkod Yazdır"
        actions={
          <Button onClick={handlePrint}>
            <Printer className="w-4 h-4" /> Yazdır
          </Button>
        }
      />

      <Card className="p-6 max-w-lg">
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">Kağıt Boyutu</label>
          <select
            value={paperSize}
            onChange={(e) => setPaperSize(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
          >
            <option value="">Seçiniz</option>
            {PAPER_SIZES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div id="print-area" className="flex flex-col items-center gap-4 p-8 border border-dashed border-slate-200 rounded-xl">
          <h2 className="text-xl font-bold text-center">{user?.restaurant.name}</h2>
          <p className="text-sm text-slate-500 text-center">Dijital menümüze QR kod ile ulaşın</p>
          <QRCodeSVG value={menuUrl} size={180} level="H" />
          <p className="text-xs text-slate-400 break-all text-center max-w-xs">{menuUrl}</p>
        </div>
      </Card>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; border: none; }
        }
      `}</style>
    </div>
  );
}
