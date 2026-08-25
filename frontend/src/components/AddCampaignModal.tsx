import { useEffect, useState } from 'react';
import { X, Megaphone } from 'lucide-react';
import { Button, Input } from '@/components/ui';

interface AddCampaignModalProps {
  open: boolean;
  saving?: boolean;
  onClose: () => void;
  onAdd: (name: string) => void | Promise<void>;
}

export default function AddCampaignModal({
  open,
  saving = false,
  onClose,
  onAdd,
}: AddCampaignModalProps) {
  const [name, setName] = useState('');

  useEffect(() => {
    if (!open) return;
    setName('');
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit(e?: { preventDefault(): void }) {
    e?.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    await onAdd(trimmed);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[6px]" />

      <div
        className="relative w-full sm:max-w-md flex flex-col rounded-t-[28px] sm:rounded-[28px] shadow-2xl animate-slide-up overflow-hidden"
        style={{
          background: 'var(--admin-card)',
          border: '1px solid var(--admin-card-border)',
        }}
      >
        <div
          className="px-5 pt-5 pb-4 shrink-0"
          style={{ borderBottom: '1px solid var(--admin-card-border)' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: 'var(--admin-accent-soft)', color: 'var(--admin-accent)' }}
              >
                <Megaphone className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[var(--admin-text)]">Kampanya Ekle</h2>
                <p className="text-xs admin-text-muted mt-0.5 leading-relaxed">
                  İftar, happy hour gibi özel menü kampanyası oluştur.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-[var(--admin-accent-soft)] transition"
              aria-label="Kapat"
            >
              <X className="w-4 h-4 admin-text-muted" />
            </button>
          </div>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="p-5 space-y-4">
          <Input
            label="Kampanya adı"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Örn. İftar Menüsü"
            autoFocus
          />
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="ghost" className="flex-1" onClick={onClose} disabled={saving}>
              İptal
            </Button>
            <Button type="submit" className="flex-1" disabled={!name.trim() || saving}>
              {saving ? 'Ekleniyor…' : 'Ekle'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
