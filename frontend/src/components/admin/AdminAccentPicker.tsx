import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import gsap from 'gsap';
import { Check, ChevronDown, Palette } from 'lucide-react';
import {
  ADMIN_ACCENT_OPTIONS,
  type AdminAccentId,
  useTheme,
} from '@/contexts/ThemeContext';

export default function AdminAccentPicker({ disabled }: { disabled?: boolean }) {
  const { accent, setAccent } = useTheme();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const current = ADMIN_ACCENT_OPTIONS.find((o) => o.id === accent) || ADMIN_ACCENT_OPTIONS[0];

  useEffect(() => {
    if (!open) return;

    function place() {
      const btn = btnRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const width = Math.max(r.width, 168);
      let left = r.right - width;
      left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
      setPos({ top: r.bottom + 8, left, width });
    }

    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !menuRef.current) return;
    const el = menuRef.current;
    gsap.fromTo(
      el,
      { opacity: 0, y: -6, scale: 0.96 },
      { opacity: 1, y: 0, scale: 1, duration: 0.28, ease: 'power2.out' }
    );
    const items = el.querySelectorAll('.dash-accent-menu__item');
    gsap.fromTo(
      items,
      { opacity: 0, x: 8 },
      { opacity: 1, x: 0, duration: 0.28, stagger: 0.05, ease: 'power2.out', delay: 0.04 }
    );
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function pick(id: AdminAccentId) {
    setAccent(id);
    setOpen(false);
  }

  return (
    <div className="dash-accent-picker" ref={wrapRef}>
      <button
        ref={btnRef}
        type="button"
        className={`dash-accent-trigger${open ? ' is-open' : ''}`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Site tema rengi"
        title="Site tema rengi"
        onClick={() => !disabled && setOpen((v) => !v)}
      >
        <span className="dash-accent-trigger__orb" aria-hidden>
          <span className="dash-accent-trigger__orb-core" />
          <Palette className="dash-accent-trigger__orb-icon" strokeWidth={2} />
        </span>
        <span className="dash-accent-trigger__meta">
          <em>Tema</em>
          <strong>{current.label}</strong>
        </span>
        <ChevronDown className={`dash-accent-trigger__chev${open ? ' is-open' : ''}`} strokeWidth={2.25} />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="dash-accent-menu"
            role="listbox"
            aria-label="Tema renkleri"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
          >
            <p className="dash-accent-menu__hint">Panel vurgu rengi</p>
            {ADMIN_ACCENT_OPTIONS.map((opt) => {
              const active = opt.id === accent;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`dash-accent-menu__item${active ? ' is-active' : ''}`}
                  onClick={() => pick(opt.id)}
                >
                  <span
                    className="dash-accent-menu__swatch"
                    style={{ background: opt.swatch }}
                    aria-hidden
                  />
                  <span className="dash-accent-menu__label">{opt.label}</span>
                  {active ? <Check className="dash-accent-menu__check" strokeWidth={2.5} /> : null}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}
