import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './admin-overlay.css';

/** Product workflows share one focus/scroll contract; backdrop clicks never dismiss drafts. */
export default function AdminOverlay({
  open = true,
  busy = false,
  label,
  onClose,
  onEscape,
  className = '',
  children,
}: {
  open?: boolean;
  busy?: boolean;
  label: string;
  onClose: () => void;
  onEscape?: () => boolean;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    const app = document.getElementById('root'),
      inert = app?.inert;
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    if (app) app.inert = true;
    ref.current
      ?.querySelector<HTMLElement>(
        'button:not(:disabled), input:not(:disabled)',
      )
      ?.focus({ preventScroll: true });
    return () => {
      document.documentElement.style.overflow = overflow;
      if (app) app.inert = inert || false;
      if (before?.isConnected) before.focus({ preventScroll: true });
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    // Disabling the submitting button can temporarily return focus to body.
    const escapeOutside = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || ref.current?.contains(event.target as Node))
        return;
      event.preventDefault();
      if (!busy && !onEscape?.()) onClose();
    };
    document.addEventListener('keydown', escapeOutside);
    return () => document.removeEventListener('keydown', escapeOutside);
  }, [open, busy, onClose, onEscape]);
  if (!open) return null;
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className={`admin-overlay ${className}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) event.preventDefault();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          if (!busy && !onEscape?.()) onClose();
        }
        if (e.key !== 'Tab') return;
        const scope =
          (e.target as HTMLElement).closest('[role="dialog"]') ||
          e.currentTarget;
        const items = Array.from(
          scope.querySelectorAll<HTMLElement>(
            'button,input,textarea,select,a[href],[tabindex]',
          ),
        ).filter(
          (node) =>
            !node.matches(':disabled,[tabindex="-1"]') &&
            node.getClientRects().length > 0,
        );
        if (!items.length) {
          e.preventDefault();
          return;
        }
        if (e.shiftKey && document.activeElement === items[0]) {
          e.preventDefault();
          items.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === items.at(-1)) {
          e.preventDefault();
          items[0].focus();
        }
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
