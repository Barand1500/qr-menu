import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CircleHelp } from 'lucide-react';
import { driver, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { api } from '@/lib/api';
import { adminPath } from '@/lib/adminPath';
import {
  getAdminTourSteps,
  type TourCreated,
  type TourOpenGroup,
  type TourStep,
} from '@/lib/adminTourSteps';
import '@/admin-tour.css';

type Props = {
  open: boolean;
  onClose: () => void;
  onOpenGroup: (group: TourOpenGroup) => void;
  onNeedMobileNav: () => void;
  /** Tur sonunda kısa bilgi (silinenler vb.) göstermek için. */
  onNotice?: (text: string, error?: boolean) => void;
};

function pathMatches(current: string, expected?: string) {
  if (!expected) return true;
  const home = adminPath();
  if (expected === home) return current === home || current === `${home}/`;
  return current === expected || current.startsWith(`${expected}/`);
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const visible = (el: HTMLElement | null) => (el && el.getBoundingClientRect().width > 1 ? el : null);

function spotHtml(step: TourStep, index: number, total: number) {
  const pct = Math.round(((index + 1) / total) * 100);
  return `
    <div class="adt-meta"><span>${index + 1} / ${total}</span><i><b style="width:${pct}%"></b></i></div>
    <p class="adt-body">${step.body}</p>
    ${step.task ? `<p class="adt-task"><span aria-hidden="true">👆</span>${step.task}</p>` : ''}`;
}

/** Açık pencerenin içine yerleşen yönlendirme kartı (üstteki modal karartmanın üstünde kalır). */
function mountCoach(
  host: HTMLElement,
  step: TourStep,
  index: number,
  total: number,
  onSkip: () => void,
  onQuit: () => void,
) {
  const el = document.createElement('div');
  el.className = 'adt-coach';
  el.innerHTML = `
    <div class="adt-coach__top"><span>${index + 1} / ${total}</span>
      <i><b style="width:${Math.round(((index + 1) / total) * 100)}%"></b></i></div>
    <strong>${step.title}</strong>
    <p>${step.body}</p>
    <div class="adt-coach__act">
      <button type="button" data-act="skip">Bu adımı geç</button>
      <button type="button" data-act="quit">Turdan çık</button>
    </div>`;
  el.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement).closest('[data-act]')?.getAttribute('data-act');
    if (act === 'skip') onSkip();
    if (act === 'quit') onQuit();
  });
  (host.querySelector<HTMLElement>('.ag-dialog__surface, .product-modal-shell__main, .au-editor') ?? host).prepend(el);
  return () => el.remove();
}

/**
 * Yaptırarak öğreten tur: grup, ürün, ürünü gruba atama ve çalışan ekleme.
 * Tur boyunca oluşturulan kayıtlar (fetch izlenerek) tur bitince silinir.
 */
export default function AdminTour({ open, onClose, onOpenGroup, onNeedMobileNav, onNotice }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;
  const live = useRef({ navigate, onClose, onOpenGroup, onNeedMobileNav, onNotice });
  live.current = { navigate, onClose, onOpenGroup, onNeedMobileNav, onNotice };

  useEffect(() => {
    if (!open) return;
    const steps = getAdminTourSteps();
    const total = steps.length;
    const created: TourCreated = {};
    const listeners = new Set<(sig: string) => void>();
    let token = 0;
    let drv: Driver | null = null;
    let cleanups: Array<() => void> = [];
    let prevDialog: Element | null = null;
    let ended = false;

    // Başarılı POST isteklerini izle: adımları ilerletir, oluşan kayıtları not eder.
    const realFetch = window.fetch;
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const res = await realFetch(...args);
      try {
        const req = args[0];
        const method = (args[1]?.method || (req instanceof Request ? req.method : 'GET')).toUpperCase();
        const url = new URL(typeof req === 'string' ? req : req instanceof Request ? req.url : String(req), window.location.href);
        if (res.ok && method === 'POST') {
          const sig = `${method} ${url.pathname}`;
          const kind =
            url.pathname === '/api/admin/groups'
              ? 'group'
              : url.pathname === '/api/admin/products'
                ? 'product'
                : url.pathname === '/api/admin/users'
                  ? 'user'
                  : null;
          if (kind) {
            const body = (await res.clone().json().catch(() => null)) as { id?: number } | null;
            if (body?.id) created[kind] = body.id;
          }
          listeners.forEach((fn) => fn(sig));
        }
      } catch {
        /* izleme hatası tura engel olmaz */
      }
      return res;
    };

    const clear = () => {
      cleanups.forEach((fn) => fn());
      cleanups = [];
      drv?.destroy();
      drv = null;
      document.body.classList.remove('adt-task-on');
      document.querySelectorAll('.adt-glow').forEach((n) => n.classList.remove('adt-glow'));
    };

    async function finish() {
      if (ended) return;
      ended = true;
      token++;
      clear();
      window.fetch = realFetch;
      window.removeEventListener('keydown', onKey);
      document.querySelectorAll('dialog[open]').forEach((d) => (d as HTMLDialogElement).close?.());
      const failed: string[] = [];
      const del = async (label: string, path: string, id?: number) => {
        if (!id) return;
        try {
          await api(`${path}/${id}`, { method: 'DELETE' });
        } catch {
          failed.push(label);
        }
      };
      await del('ürün', '/api/admin/products', created.product);
      await del('çalışan', '/api/admin/users', created.user);
      await del('grup', '/api/admin/groups', created.group);
      const any = created.group || created.product || created.user;
      if (any) {
        live.current.onNotice?.(
          failed.length
            ? `Tur denemeleri silinemedi: ${failed.join(', ')}. Elle silebilirsin.`
            : 'Tur bitti, denemeler silindi.',
          failed.length > 0,
        );
        live.current.navigate(adminPath());
      }
      live.current.onClose();
    }

    async function goTo(i: number) {
      if (ended) return;
      if (i >= total) return void finish();
      const index = Math.max(0, i);
      const step = steps[index];
      const my = ++token;
      clear();

      if (window.innerWidth < 1024 && (step.target || step.path)) live.current.onNeedMobileNav();
      if (step.openGroup) live.current.onOpenGroup(step.openGroup);
      if (step.path && !pathMatches(pathRef.current, step.path)) {
        live.current.navigate(step.path);
        for (let k = 0; k < 30 && !pathMatches(pathRef.current, step.path); k++) await sleep(100);
        await sleep(250);
      }
      const ctx = { created, prev: prevDialog };
      const locate = () =>
        visible(
          step.find
            ? step.find(ctx)
            : step.target
              ? (document.querySelector(`[data-tour="${step.target}"]`) as HTMLElement | null)
              : null,
        );
      let el: HTMLElement | null = null;
      for (let k = 0; k < 40 && (step.target || step.find); k++) {
        if (my !== token || ended) return;
        el = locate();
        if (el) break;
        await sleep(100);
      }
      if (my !== token || ended) return;
      const isLast = index === total - 1;
      const advance = () => {
        if (my === token) window.setTimeout(() => my === token && void goTo(index + 1), 420);
      };

      // Pencere içi yönlendirme (modal): karartma yok, kart pencerenin içinde.
      if (step.mode === 'coach' && el) {
        prevDialog = el;
        cleanups.push(mountCoach(el, step, index, total, () => void goTo(index + 1), () => void finish()));
        let glowEl: HTMLElement | null = null;
        if (step.glow) {
          glowEl =
            Array.from(el.querySelectorAll<HTMLElement>('button')).find((b) => step.glow!.test(b.textContent || '')) ??
            null;
          glowEl?.classList.add('adt-glow');
        }
        if (step.wait && 'click' in step.wait && glowEl) {
          const g = glowEl;
          g.addEventListener('click', advance, { once: true, capture: true });
          cleanups.push(() => g.removeEventListener('click', advance, { capture: true }));
        }
        if (step.wait && 'api' in step.wait) {
          const want = step.wait.api;
          const onSig = (sig: string) => sig === want && advance();
          listeners.add(onSig);
          cleanups.push(() => listeners.delete(onSig));
        }
        return;
      }

      // Sayfa üstü vurgu (driver.js)
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      await sleep(el ? 120 : 0);
      if (my !== token || ended) return;
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
      const interactive = Boolean(step.wait && 'click' in step.wait && el);
      drv.highlight({
        element: el ?? undefined,
        disableActiveInteraction: !interactive,
        popover: {
          title: step.title,
          description: spotHtml(step, index, total),
          side: el ? (step.placement && step.placement !== 'center' ? step.placement : 'bottom') : undefined,
          align: 'center',
          showButtons: interactive
            ? ['previous', 'close']
            : index === 0
              ? ['next', 'close']
              : ['previous', 'next', 'close'],
          nextBtnText: isLast ? 'Bitir ✓' : index === 0 ? 'Başlayalım →' : 'İleri →',
          prevBtnText: '← Geri',
          popoverClass: `adt${el ? '' : ' adt--center'}${interactive ? ' adt--task' : ''}`,
          onNextClick: () => (isLast ? void finish() : void goTo(index + 1)),
          onPrevClick: () => void goTo(index - 1),
          onCloseClick: () => void finish(),
        },
      });
      if (interactive && el) {
        document.body.classList.add('adt-task-on');
        const target = el;
        target.addEventListener('click', advance, { once: true, capture: true });
        cleanups.push(() => target.removeEventListener('click', advance, { capture: true }));
      }
    }

    function onKey(e: KeyboardEvent) {
      // Açık bir pencere varsa Esc yalnızca onu kapatsın.
      if (e.key === 'Escape' && !document.querySelector('dialog[open], [role="dialog"]')) void finish();
    }
    window.addEventListener('keydown', onKey);
    void goTo(0);

    return () => {
      if (ended) return;
      ended = true;
      token++;
      clear();
      window.fetch = realFetch;
      window.removeEventListener('keydown', onKey);
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
