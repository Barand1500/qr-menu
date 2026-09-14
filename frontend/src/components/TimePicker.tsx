import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

type TimePickerProps = {
  id?: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function parseHm(value: string): { h: number; m: number } {
  const [hs, ms] = String(value || '').split(':');
  const h = Math.min(23, Math.max(0, Number(hs) || 0));
  const m = Math.min(59, Math.max(0, Number(ms) || 0));
  return { h, m };
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

export function TimePicker({ id, label, value, onChange }: TimePickerProps) {
  const autoId = useId();
  const fieldId = id || autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const hourRef = useRef<HTMLDivElement>(null);
  const minuteRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const { h, m } = parseHm(value);
  const minuteOptions = MINUTES.includes(m) ? MINUTES : [...MINUTES, m].sort((a, b) => a - b);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const scrollSelected = (wrap: HTMLDivElement | null, sel: string) => {
      const el = wrap?.querySelector(sel) as HTMLElement | null;
      el?.scrollIntoView({ block: 'center' });
    };
    requestAnimationFrame(() => {
      scrollSelected(hourRef.current, '.is-selected');
      scrollSelected(minuteRef.current, '.is-selected');
    });
  }, [open, h, m]);

  const setTime = (nextH: number, nextM: number) => {
    onChange(`${pad(nextH)}:${pad(nextM)}`);
  };

  return (
    <div className="time-menu-field time-menu-time" ref={rootRef}>
      <label htmlFor={fieldId}>{label}</label>
      <button
        id={fieldId}
        type="button"
        className={`time-menu-time__trigger${open ? ' is-open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="time-menu-time__value">
          <em>{pad(h)}</em>
          <span>:</span>
          <em>{pad(m)}</em>
        </span>
        <ChevronDown className="time-menu-time__chev" aria-hidden />
      </button>

      {open ? (
        <div className="time-menu-time__pop" role="listbox" aria-label={label}>
          <div className="time-menu-time__col" ref={hourRef}>
            <p className="time-menu-time__col-label">Saat</p>
            <div className="time-menu-time__scroll">
              {HOURS.map((hour) => (
                <button
                  key={hour}
                  type="button"
                  role="option"
                  aria-selected={hour === h}
                  className={hour === h ? 'is-selected' : undefined}
                  onClick={() => setTime(hour, m)}
                >
                  {pad(hour)}
                </button>
              ))}
            </div>
          </div>
          <div className="time-menu-time__divider" aria-hidden />
          <div className="time-menu-time__col" ref={minuteRef}>
            <p className="time-menu-time__col-label">Dk</p>
            <div className="time-menu-time__scroll">
              {minuteOptions.map((min) => (
                <button
                  key={min}
                  type="button"
                  role="option"
                  aria-selected={min === m}
                  className={min === m ? 'is-selected' : undefined}
                  onClick={() => {
                    setTime(h, min);
                    setOpen(false);
                  }}
                >
                  {pad(min)}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
