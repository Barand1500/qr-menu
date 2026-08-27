import { useEffect, useState } from 'react';
import { X, LayoutGrid } from 'lucide-react';
import { Button, Input } from '@/components/ui';

interface AddTableGroupModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (data: { name: string; count: number; prefix: string }) => void;
}

export default function AddTableGroupModal({
  open,
  onClose,
  onAdd,
}: AddTableGroupModalProps) {
  const [name, setName] = useState('');
  const [count, setCount] = useState('8');
  const [prefix, setPrefix] = useState('');

  useEffect(() => {
    if (!open) return;
    setName('');
    setCount('8');
    setPrefix('');
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  function handleSubmit(e?: { preventDefault(): void }) {
    e?.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const n = Math.max(1, Math.min(60, Number(count) || 8));
    onAdd({
      name: trimmed,
      count: n,
      prefix: prefix.trim().slice(0, 20),
    });
    onClose();
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
        onClick={(e) => e.stopPropagation()}
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
                <LayoutGrid className="w-5 h-5" />
              </div>
              <div className="flex items-center min-h-11">
                <h2 className="text-base font-bold text-[var(--admin-text)]">Grup Ekle</h2>
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

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <Input
            label="Grup adı"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Örn. Teras, Bahçe, VIP"
            autoFocus
          />
          <div className="table-group-dual">
            <Input
              label="Masa sayısı"
              type="number"
              min={1}
              max={60}
              value={count}
              onChange={(e) => setCount(e.target.value)}
            />
            <Input
              label="Prefix"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value.slice(0, 20))}
              placeholder="örn. a"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
              İptal
            </Button>
            <Button type="submit" className="flex-1" disabled={!name.trim()}>
              Ekle
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
