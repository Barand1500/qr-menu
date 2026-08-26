import { useEffect, useState } from 'react';
import { X, KeyRound, PartyPopper } from 'lucide-react';
import { Button, Input } from '@/components/ui';

interface UnlockAddonModalProps {
  open: boolean;
  productName: string;
  unlocking?: boolean;
  onClose: () => void;
  onUnlock: (code: string) => Promise<void>;
}

function fireConfetti() {
  const root = document.createElement('div');
  root.className = 'addon-confetti-root';
  root.setAttribute('aria-hidden', 'true');
  document.body.appendChild(root);

  const colors = ['#0ea5e9', '#22c55e', '#f59e0b', '#ec4899', '#8b5cf6', '#f97316'];
  for (let i = 0; i < 48; i++) {
    const piece = document.createElement('span');
    piece.className = 'addon-confetti-piece';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = `${Math.random() * 0.25}s`;
    piece.style.animationDuration = `${1.4 + Math.random() * 1.2}s`;
    root.appendChild(piece);
  }

  window.setTimeout(() => root.remove(), 2800);
}

export default function UnlockAddonModal({
  open,
  productName,
  unlocking,
  onClose,
  onUnlock,
}: UnlockAddonModalProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCode('');
    setError(null);
    setSuccess(false);
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onUnlock(code.trim());
      setSuccess(true);
      fireConfetti();
      window.setTimeout(() => onClose(), 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kod geçersiz');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[6px]" />
      <div
        className="relative w-full sm:max-w-md rounded-t-[28px] sm:rounded-[28px] shadow-2xl animate-slide-up overflow-hidden"
        style={{
          background: 'var(--admin-card)',
          border: '1px solid var(--admin-card-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: 'var(--admin-accent-soft)' }}
            >
              {success ? (
                <PartyPopper className="w-5 h-5" style={{ color: 'var(--admin-accent)' }} />
              ) : (
                <KeyRound className="w-5 h-5" style={{ color: 'var(--admin-accent)' }} />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--admin-text)]">
                {success ? 'Tebrikler!' : 'Kod Gir'}
              </h2>
              <p className="text-xs admin-text-muted mt-0.5 leading-relaxed">
                {success
                  ? `“${productName}” açıldı. Artık kullanabilirsin.`
                  : `“${productName}” için aktivasyon kodunu gir.`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-[var(--admin-accent-soft)]"
            aria-label="Kapat"
          >
            <X className="w-4 h-4 admin-text-muted" />
          </button>
        </div>

        {!success && (
          <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-4">
            <Input
              label="Aktivasyon kodu"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="••••••"
              autoFocus
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
                Vazgeç
              </Button>
              <Button type="submit" className="flex-1" disabled={unlocking || !code.trim()}>
                {unlocking ? 'Açılıyor…' : 'Kodu uygula'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
