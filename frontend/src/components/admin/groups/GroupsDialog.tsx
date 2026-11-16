import {
  useEffect,
  useId,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import './groups.css';

/** Native focus/inert handling; a bottom sheet on phones, a compact dialog on desktop. */
export default function GroupsDialog({
  open,
  title,
  subtitle,
  busy = false,
  onClose,
  children,
  className = '',
  anchor,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  busy?: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  anchor?: { x: number; y: number };
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const dialog = ref.current;
    if (!dialog) return;
    const prior = document.activeElement as HTMLElement | null;
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    dialog.showModal();
    return () => {
      dialog.close();
      document.documentElement.style.overflow = overflow;
      if (prior?.isConnected) prior.focus({ preventScroll: true });
    };
  }, [open]);
  if (!open) return null;
  return createPortal(
    <dialog
      ref={ref}
      className={`ag-dialog ${className}`}
      aria-labelledby={titleId}
      style={
        anchor
          ? ({
              '--ag-x': `${anchor.x}px`,
              '--ag-y': `${anchor.y}px`,
            } as CSSProperties)
          : undefined
      }
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Tab') return;
        const nodes = Array.from(
          e.currentTarget.querySelectorAll<HTMLElement>(
            'button, input, select, textarea, a[href], [tabindex]',
          ),
        ).filter(
          (node) =>
            !node.matches(':disabled, [tabindex="-1"]') &&
            node.getClientRects().length > 0,
        );
        if (!nodes.length) {
          e.preventDefault();
          return;
        }
        if (
          e.shiftKey &&
          (document.activeElement === nodes[0] ||
            !e.currentTarget.contains(document.activeElement))
        ) {
          e.preventDefault();
          nodes.at(-1)?.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === nodes.at(-1) ||
            !e.currentTarget.contains(document.activeElement))
        ) {
          e.preventDefault();
          nodes[0].focus();
        }
      }}
    >
      <div className="ag-dialog__surface">
        <span className="ag-dialog__handle" aria-hidden="true" />
        <header className="ag-dialog__head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            type="button"
            className="ag-icon"
            aria-label="Pencereyi kapat"
            disabled={busy}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        <div className="ag-dialog__body" aria-busy={busy || undefined}>
          {children}
        </div>
      </div>
    </dialog>,
    document.body,
  );
}
