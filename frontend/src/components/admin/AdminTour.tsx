import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CircleHelp } from 'lucide-react';
import { driver, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { getAdminTourSteps, type TourOpenGroup, type TourStep } from '@/lib/adminTourSteps';
import { adminPath } from '@/lib/adminPath';
import '@/admin-tour.css';

type Props = {
  open: boolean;
  onClose: () => void;
  onOpenGroup: (group: TourOpenGroup) => void;
  onNeedMobileNav: () => void;
};

function pathMatches(current: string, expected?: string) {
  if (!expected) return true;
  const home = adminPath();
  if (expected === home) return current === home || current === `${home}/`;
  return current === expected || current.startsWith(`${expected}/`);
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const findTarget = (target?: string) =>
  target ? (document.querySelector(`[data-tour="${target}"]`) as HTMLElement | null) : null;

const SIDEBAR_TARGETS = /^(nav-|extensions|tour-help|maintenance|menu-preview)/;

function describe(step: TourStep, index: number, total: number) {
  const pct = Math.round(((index + 1) / total) * 100);
  return `
    <div class="adt-meta"><span>${index + 1} / ${total}</span><i><b style="width:${pct}%"></b></i></div>
    <p class="adt-body">${step.body}</p>
    ${step.tip ? `<p class="adt-tip">${step.tip}</p>` : ''}
    ${step.task ? `<p class="adt-task"><span aria-hidden="true">👆</span>${step.task}</p>` : ''}`;
}

/**
 * driver.js ile yönlendirmeli tanıtım turu. Adımlar `adminTourSteps.ts` içinde;
 * `task` olan adımlarda kullanıcı vurgulanan öğeye dokununca tur kendiliğinden ilerler.
 */
export default function AdminTour({ open, onClose, onOpenGroup, onNeedMobileNav }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;
  const api = useRef({ navigate, onClose, onOpenGroup, onNeedMobileNav });
  api.current = { navigate, onClose, onOpenGroup, onNeedMobileNav };

  useEffect(() => {
    if (!open) return;
    const steps = getAdminTourSteps();
    const total = steps.length;
    let token = 0;
    let drv: Driver | null = null;
    let offTask: (() => void) | null = null;
    let ended = false;

    const finish = () => {
      if (ended) return;
      ended = true;
      token++;
      offTask?.();
      document.body.classList.remove('adt-task-on');
      drv?.destroy();
      api.current.onClose();
    };

    async function goTo(i: number) {
      if (ended) return;
      if (i >= total) return finish();
      const my = ++token;
      const step = steps[Math.max(0, i)];
      const index = Math.max(0, i);
      offTask?.();
      offTask = null;
      document.body.classList.remove('adt-task-on');

      if (step.target && SIDEBAR_TARGETS.test(step.target) && window.innerWidth < 1024) {
        api.current.onNeedMobileNav();
      }
      if (step.openGroup) api.current.onOpenGroup(step.openGroup);
      // Görevli adımlarda sayfaya kullanıcı gider; diğerlerinde tur götürür.
      if (step.path && !step.task && !pathMatches(pathRef.current, step.path)) {
        api.current.navigate(step.path);
        for (let k = 0; k < 30 && !pathMatches(pathRef.current, step.path); k++) await sleep(100);
      }
      let el: HTMLElement | null = null;
      for (let k = 0; k < 30 && step.target; k++) {
        if (my !== token) return;
        if (step.openGroup) api.current.onOpenGroup(step.openGroup);
        el = findTarget(step.target);
        if (el && el.getBoundingClientRect().width > 1) break;
        el = null;
        await sleep(100);
      }
      if (my !== token || ended) return;
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      await sleep(el ? 120 : 0);
      if (my !== token || ended) return;

      const isLast = index === total - 1;
      const goBack = () => void goTo(index - 1);
      drv?.highlight({
        element: el ?? undefined,
        disableActiveInteraction: !step.task,
        popover: {
          title: step.title,
          description: describe(step, index, total),
          side: el ? (step.placement && step.placement !== 'center' ? step.placement : 'right') : undefined,
          align: 'center',
          showButtons: index === 0 ? ['next', 'close'] : ['previous', 'next', 'close'],
          nextBtnText: isLast ? 'Bitir ✓' : index === 0 ? 'Başlayalım →' : 'İleri →',
          prevBtnText: '← Geri',
          popoverClass: `adt${el ? '' : ' adt--center'}${step.task ? ' adt--task' : ''}`,
          onNextClick: () => (isLast ? finish() : void goTo(index + 1)),
          onPrevClick: goBack,
          onCloseClick: finish,
        },
      });

      if (step.task && el) {
        document.body.classList.add('adt-task-on');
        const onClick = () => {
          offTask?.();
          offTask = null;
          window.setTimeout(() => {
            if (my === token) void goTo(index + 1);
          }, 420);
        };
        el.addEventListener('click', onClick, { once: true, capture: true });
        offTask = () => el?.removeEventListener('click', onClick, { capture: true });
      }
    }

    drv = driver({
      animate: true,
      smoothScroll: false,
      allowClose: false,
      overlayColor: '#020617',
      overlayOpacity: 0.74,
      stagePadding: 8,
      stageRadius: 16,
      popoverOffset: 16,
      showProgress: false,
    });

    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && finish();
    window.addEventListener('keydown', onKey);
    void goTo(0);

    return () => {
      window.removeEventListener('keydown', onKey);
      if (!ended) {
        ended = true;
        token++;
        offTask?.();
        document.body.classList.remove('adt-task-on');
        drv?.destroy();
      }
    };
  }, [open]);

  return null;
}

export function AdminTourHelpButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="sidebar-footer-btn"
      data-tour="tour-help"
      title="İnteraktif tanıtım"
      aria-label="İnteraktif tanıtım"
      onClick={onClick}
    >
      <CircleHelp className="w-[18px] h-[18px]" strokeWidth={1.75} />
    </button>
  );
}
