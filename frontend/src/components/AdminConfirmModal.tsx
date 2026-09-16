import { useEffect, useId } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui';

type AdminConfirmModalProps = {
  open: boolean;
  title: string;
  description?: string;
  /** Vurgulanacak ad (ürün/grup adı) */
  highlight?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  tone?: 'danger' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
};

export default function AdminConfirmModal({
  open,
  title,
  description,
  highlight,
  confirmLabel = 'Sil',
  cancelLabel = 'Vazgeç',
  busy = false,
  tone = 'danger',
  onConfirm,
  onCancel,
}: AdminConfirmModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const iconBg =
    tone === 'danger' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.14)';
  const iconColor = tone === 'danger' ? '#dc2626' : '#d97706';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[6px]"
        aria-label="Kapat"
        disabled={busy}
        onClick={() => {
          if (!busy) onCancel();
        }}
      />
      <div
        className="relative w-full sm:max-w-md flex flex-col rounded-t-[28px] sm:rounded-[28px] shadow-2xl animate-slide-up overflow-hidden"
        style={{
          background: 'var(--admin-card)',
          border: '1px solid var(--admin-card-border)',
        }}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div
          className="px-5 pt-5 pb-4"
          style={{ borderBottom: '1px solid var(--admin-card-border)' }}
        >
          <div className="flex items-start gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: iconBg, color: iconColor }}
            >
              <AlertTriangle className="w-5 h-5" strokeWidth={2.25} />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <h2 id={titleId} className="text-base font-bold text-[var(--admin-text)]">
                {title}
              </h2>
              {description ? (
                <p className="text-xs admin-text-muted mt-0.5 leading-relaxed">{description}</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 space-y-3">
          {highlight ? (
            <p
              className="text-sm font-semibold text-[var(--admin-text)] rounded-xl px-3.5 py-3 leading-snug"
              style={{ background: 'var(--admin-input-bg)' }}
            >
              “{highlight}”
            </p>
          ) : null}
          <p className="text-sm text-[var(--admin-text)] leading-relaxed">
            Bu işlem <strong>geri alınamaz</strong>. Kayıt kalıcı olarak silinir.
          </p>
        </div>

        <div
          className="px-5 py-4 flex gap-2"
          style={{ borderTop: '1px solid var(--admin-card-border)' }}
        >
          <Button
            type="button"
            variant="ghost"
            className="flex-1"
            disabled={busy}
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="danger"
            className="flex-1"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? 'Siliniyor…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
