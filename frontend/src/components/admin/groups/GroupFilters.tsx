import { useEffect, useId, useRef, useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';

export default function GroupFilters({
  status,
  kind,
  onStatusChange,
  onKindChange,
}: {
  status: 'all' | 'active' | 'passive';
  kind: 'all' | 'main' | 'sub';
  onStatusChange: (value: 'all' | 'active' | 'passive') => void;
  onKindChange: (value: 'all' | 'main' | 'sub') => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const count = Number(status !== 'all') + Number(kind !== 'all');
  useEffect(() => {
    if (!open) return;
    const position = () => {
      const top = panel.current?.getBoundingClientRect().top || 0;
      panel.current?.style.setProperty(
        '--ag-filter-space',
        `${Math.max(120, innerHeight - top - 12)}px`,
      );
    };
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        trigger.current?.focus({ preventScroll: true });
      }
    };
    position();
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    };
  }, [open]);
  return (
    <div
      ref={root}
      className="ag-filter-wrap"
      onBlurCapture={(e) => {
        if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget))
          setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        className={`ag-filter${count ? ' is-active' : ''}`}
        aria-label="Filtrele"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <SlidersHorizontal size={17} />
        <span>Filtrele</span>
        {count > 0 && <b>{count}</b>}
      </button>
      {open && (
        <div
          ref={panel}
          id={id}
          className="ag-filter-panel"
          role="region"
          aria-label="Grup filtreleri"
        >
          <header>
            <span>Filtreler</span>
            <button
              type="button"
              className="ag-icon"
              aria-label="Filtreleri kapat"
              onClick={() => {
                setOpen(false);
                trigger.current?.focus({ preventScroll: true });
              }}
            >
              <X size={17} />
            </button>
          </header>
          <fieldset className="ag-filter-options">
            <legend>Menüde görünürlük</legend>
            {(
              [
                ['all', 'Tümü'],
                ['active', 'Göster'],
                ['passive', 'Gizle'],
              ] as const
            ).map(([value, label]) => (
              <button
                type="button"
                key={value}
                aria-pressed={status === value}
                onClick={() => onStatusChange(value)}
              >
                {label}
              </button>
            ))}
          </fieldset>
          <fieldset className="ag-filter-options">
            <legend>Grup yapısı</legend>
            {(
              [
                ['all', 'Tüm gruplar'],
                ['main', 'Ana gruplar'],
                ['sub', 'Alt gruplar'],
              ] as const
            ).map(([value, label]) => (
              <button
                type="button"
                key={value}
                aria-pressed={kind === value}
                onClick={() => onKindChange(value)}
              >
                {label}
              </button>
            ))}
          </fieldset>
          {count > 0 && (
            <button
              type="button"
              className="ag-filter-reset"
              onClick={() => {
                onStatusChange('all');
                onKindChange('all');
              }}
            >
              Filtreleri temizle
            </button>
          )}
        </div>
      )}
    </div>
  );
}
