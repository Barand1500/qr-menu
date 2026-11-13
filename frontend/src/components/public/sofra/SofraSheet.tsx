import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import './sofra-overlays.css';

export function useSheetPresence(open: boolean) {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const timer = window.setTimeout(() => setMounted(false), 240);
    return () => window.clearTimeout(timer);
  }, [open]);
  return mounted;
}
export function useSheetFocus(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = requestAnimationFrame(() => ref.current?.focus());
    const key = (e: KeyboardEvent) => {
      // A nested gate (for example the table code) owns its own keyboard interaction.
      if (
        document.activeElement?.closest('[role="dialog"]') &&
        !ref.current?.contains(document.activeElement)
      )
        return;
      if (e.key === 'Escape') {
        e.preventDefault();
        close.current();
      }
      if (e.key !== 'Tab') return;
      const nodes = Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]'
        ) || []
      ).filter((n) => n.getClientRects().length);
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (!first) {
        e.preventDefault();
        return;
      }
      if (
        e.shiftKey &&
        (document.activeElement === first || document.activeElement === ref.current)
      ) {
        e.preventDefault();
        last.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last || !ref.current?.contains(document.activeElement))
      ) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', key);
      previous?.focus();
    };
  }, [open]);
  return ref;
}
export default function SofraSheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  busy?: boolean;
}) {
  const mounted = useSheetPresence(open);
  const close = () => {
    if (!busy) onClose();
  };
  const ref = useSheetFocus(open, close);
  const id = useId();
  if (!mounted) return null;
  return (
    <div className={`sofra-sheet${open ? ' is-open' : ''}`} inert={!open}>
      <button className="sofra-sheet-shade" onClick={close} aria-label="Kapat" tabIndex={-1} />
      <section
        className="sofra-sheet-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        ref={ref}
        tabIndex={-1}
      >
        <div className="sofra-sheet-handle" aria-hidden />
        <header className="sofra-sheet-head">
          <div>
            <h2 id={id}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            type="button"
            className="sofra-sheet-close"
            aria-label="Kapat"
            onClick={close}
            disabled={busy}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
