import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { CircleHelp, Lightbulb, X } from 'lucide-react';
import { ADMIN_TOUR_STEPS, type TourOpenGroup, type TourStep } from '@/lib/adminTourSteps';
import '@/admin-tour.css';

type Rect = { top: number; left: number; width: number; height: number };

type Props = {
  open: boolean;
  onClose: () => void;
  onOpenGroup: (group: TourOpenGroup) => void;
  onNeedMobileNav: () => void;
};

function pathMatches(current: string, expected?: string) {
  if (!expected) return true;
  if (current === expected) return true;
  // /admin exact vs /admin/...
  if (expected === '/admin') return current === '/admin' || current === '/admin/';
  return current === expected || current.startsWith(`${expected}/`);
}

function readTargetRect(target?: string): Rect | null {
  if (!target) return null;
  const el = document.querySelector(`[data-tour="${target}"]`) as HTMLElement | null;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 && r.height < 2) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function cardStyle(rect: Rect | null, placement: TourStep['placement']) {
  const gap = 14;
  const cardW = Math.min(360, window.innerWidth - 24);
  if (!rect || placement === 'center') {
    return {
      top: '50%',
      left: '50%',
      width: cardW,
      transform: 'translate(-50%, -50%)',
    } as const;
  }

  if (placement === 'right') {
    const left = rect.left + rect.width + gap;
    const maxW = Math.min(cardW, window.innerWidth - left - 12);
    return {
      top: Math.min(Math.max(12, rect.top + rect.height / 2), window.innerHeight - 12),
      left,
      width: Math.max(260, maxW),
      transform: 'translateY(-50%)',
    } as const;
  }
  if (placement === 'left') {
    return {
      top: Math.min(Math.max(12, rect.top + rect.height / 2), window.innerHeight - 12),
      left: rect.left - gap,
      width: cardW,
      transform: 'translate(-100%, -50%)',
    } as const;
  }
  if (placement === 'top') {
    return {
      top: rect.top - gap,
      left: Math.min(
        Math.max(12, rect.left + rect.width / 2 - cardW / 2),
        window.innerWidth - cardW - 12
      ),
      width: cardW,
      transform: 'translateY(-100%)',
    } as const;
  }
  return {
    top: rect.top + rect.height + gap,
    left: Math.min(
      Math.max(12, rect.left + rect.width / 2 - cardW / 2),
      window.innerWidth - cardW - 12
    ),
    width: cardW,
    transform: 'none',
  } as const;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export default function AdminTour({ open, onClose, onOpenGroup, onNeedMobileNav }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [busy, setBusy] = useState(false);
  const runId = useRef(0);
  const step = ADMIN_TOUR_STEPS[index];
  const total = ADMIN_TOUR_STEPS.length;

  const refreshRect = useCallback(() => {
    setRect(readTargetRect(step?.target));
  }, [step?.target]);

  useEffect(() => {
    if (!open) {
      setIndex(0);
      setRect(null);
      setBusy(false);
      return;
    }
    setIndex(0);
  }, [open]);

  // 1) Grupları aç + rotaya git
  useEffect(() => {
    if (!open || !step) return;
    if (window.innerWidth < 1024) onNeedMobileNav();
    if (step.openGroup) onOpenGroup(step.openGroup);
    if (step.path && !pathMatches(location.pathname, step.path)) {
      navigate(step.path);
    }
  }, [open, step, location.pathname, navigate, onOpenGroup, onNeedMobileNav]);

  // 2) Rota oturunca hedefi bekle ve vurgula
  useEffect(() => {
    if (!open || !step) return;
    if (step.path && !pathMatches(location.pathname, step.path)) {
      setBusy(true);
      setRect(null);
      return;
    }

    const id = ++runId.current;
    let cancelled = false;
    setBusy(true);

    async function lockOnTarget() {
      // menü grubunun DOM'a oturması için kısa nefes
      if (step.openGroup) {
        onOpenGroup(step.openGroup);
        await sleep(120);
      }
      await sleep(80);

      for (let i = 0; i < 30; i++) {
        if (cancelled || runId.current !== id) return;
        if (step.openGroup) onOpenGroup(step.openGroup);
        const next = readTargetRect(step.target);
        if (next || !step.target) {
          setRect(next);
          if (next && step.target) {
            document
              .querySelector(`[data-tour="${step.target}"]`)
              ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            await sleep(160);
            if (cancelled || runId.current !== id) return;
            setRect(readTargetRect(step.target));
          }
          setBusy(false);
          return;
        }
        await sleep(100);
      }
      if (!cancelled && runId.current === id) {
        setRect(null);
        setBusy(false);
      }
    }

    void lockOnTarget();
    return () => {
      cancelled = true;
    };
  }, [open, step, location.pathname, onOpenGroup, index]);

  useLayoutEffect(() => {
    if (!open || busy) return;
    refreshRect();
    const onResize = () => refreshRect();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [open, refreshRect, index, busy, location.pathname]);

  if (!open || !step) return null;

  const pad = 8;
  const spot = rect
    ? {
        top: Math.max(8, rect.top - pad),
        left: Math.max(8, rect.left - pad),
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : null;

  const placement = step.placement || (step.target ? 'right' : 'center');
  const style = cardStyle(rect, placement);
  const isLast = index >= total - 1;

  return createPortal(
    <div className="admin-tour" role="dialog" aria-modal="true" aria-label="İnteraktif tanıtım">
      <button type="button" className="admin-tour__scrim" aria-label="Kapat" onClick={onClose} />

      {spot ? (
        <div
          className="admin-tour__spot"
          style={{
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
          }}
        />
      ) : (
        <div className="admin-tour__dim" />
      )}

      <div className={`admin-tour__card${busy ? ' is-busy' : ''}`} style={style}>
        <div className="admin-tour__card-top">
          <span className="admin-tour__step">
            {index + 1} / {total}
          </span>
          <button type="button" className="admin-tour__x" onClick={onClose} aria-label="Turdan çık">
            <X className="w-4 h-4" />
          </button>
        </div>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
        {step.tip ? (
          <p className="admin-tour__tip">
            <Lightbulb className="w-3.5 h-3.5 shrink-0" />
            <span>{step.tip}</span>
          </p>
        ) : null}
        {busy ? <p className="admin-tour__loading">Sayfa açılıyor…</p> : null}
        <div className="admin-tour__actions">
          <button type="button" className="admin-tour__skip" onClick={onClose}>
            Atla
          </button>
          <div className="admin-tour__nav">
            {index > 0 ? (
              <button
                type="button"
                className="admin-tour__prev"
                disabled={busy}
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
              >
                Geri
              </button>
            ) : null}
            <button
              type="button"
              className="admin-tour__next"
              disabled={busy}
              onClick={() => {
                if (isLast) onClose();
                else setIndex((i) => i + 1);
              }}
            >
              {isLast ? 'Bitir' : 'İleri'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function AdminTourHelpButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="sidebar-tour-btn"
      data-tour="tour-help"
      title="İnteraktif tanıtım"
      aria-label="İnteraktif tanıtım"
      onClick={onClick}
    >
      <CircleHelp className="w-[18px] h-[18px]" strokeWidth={1.75} />
    </button>
  );
}
