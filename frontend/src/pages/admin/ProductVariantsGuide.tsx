import { useEffect, useLayoutEffect, useState, type CSSProperties } from 'react';
import {
  CircleDot,
  ListChecks,
  Ban,
  Save,
  MousePointerClick,
  Layers3,
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
} from 'lucide-react';

export type GuideStepId =
  | 'welcome'
  | 'pick'
  | 'single'
  | 'type-max'
  | 'multi'
  | 'exclude'
  | 'save';

export type GuideStep = {
  id: GuideStepId;
  title: string;
  body: string;
  /** data-tour hedefi; yoksa ortada kart */
  target?: string;
  Icon: typeof Sparkles;
};

export const VARIANT_GUIDE_STEPS: GuideStep[] = [
  {
    id: 'welcome',
    title: 'Nasıl çalışır?',
    body: 'Pizza örneğiyle gidelim: önce boy seçimi, sonra ekstralar. Kaydetmezsen örnek silinir — sadece öğrenmek için.',
    Icon: Sparkles,
  },
  {
    id: 'pick',
    title: '1 · Ürün seç',
    body: 'Soldan herhangi bir ürünü seç. Seçenekler ürüne özeldir; ekstra tanımlı olması şart değil.',
    target: 'pv-list',
    Icon: MousePointerClick,
  },
  {
    id: 'single',
    title: '2 · Tek seçim (boy)',
    body: '“Tek seçim” ile Boy grubu eklenir. Büyük / Mega gibi seçenekler ürün fiyatının yerine geçer.',
    target: 'pv-add-single',
    Icon: CircleDot,
  },
  {
    id: 'type-max',
    title: '3 · Boy’a göre ekstra limiti',
    body: 'Her boyun yanındaki “Ekstra” alanı: Büyük = 5, Mega = 7. Boş bırakırsan o boy özel limit koymaz.',
    target: 'pv-groups',
    Icon: Layers3,
  },
  {
    id: 'multi',
    title: '4 · Ekstra + miktar',
    body: '“Ekstra + miktar” ile Mantar, Sucuk gibi ekler gelir. Üstteki Maks genel yedektir; boy limiti varsa o geçerli olur.',
    target: 'pv-add-multi',
    Icon: ListChecks,
  },
  {
    id: 'exclude',
    title: '5 · Seçilince gizle',
    body: 'Bir seçeneğin altında chip’lere bas: örn. Acılı seçilince Çocuk porsiyonu gizlensin. Karmaşık kural yok.',
    target: 'pv-groups',
    Icon: Ban,
  },
  {
    id: 'save',
    title: '6 · Kaydet',
    body: 'Bitince Kaydet’e bas. Bu rehberdeki örnek ürününe yazılmaz — kapatınca eski haline döner.',
    target: 'pv-save',
    Icon: Save,
  },
];

type Rect = { top: number; left: number; width: number; height: number };

function measureTarget(selector: string | undefined): Rect | null {
  if (!selector) return null;
  const el = document.querySelector(`[data-tour="${selector}"]`) as HTMLElement | null;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 && r.height < 2) return null;
  const pad = 8;
  return {
    top: Math.max(8, r.top - pad),
    left: Math.max(8, r.left - pad),
    width: Math.min(window.innerWidth - 16, r.width + pad * 2),
    height: Math.min(window.innerHeight - 16, r.height + pad * 2),
  };
}

type Props = {
  open: boolean;
  stepIndex: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
};

export function ProductVariantsGuideOverlay({
  open,
  stepIndex,
  onClose,
  onPrev,
  onNext,
}: Props) {
  const step = VARIANT_GUIDE_STEPS[stepIndex];
  const [rect, setRect] = useState<Rect | null>(null);

  useLayoutEffect(() => {
    if (!open || !step) return;
    const update = () => setRect(measureTarget(step.target));
    update();
    const t = window.setTimeout(update, 80);
    const t2 = window.setTimeout(update, 280);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(t2);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, stepIndex, step]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onNext();
      if (e.key === 'ArrowLeft') onPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, onNext, onPrev]);

  if (!open || !step) return null;

  const Icon = step.Icon;
  const isLast = stepIndex >= VARIANT_GUIDE_STEPS.length - 1;
  const isFirst = stepIndex <= 0;

  const cardStyle: CSSProperties = (() => {
    if (!rect) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }
    const spaceBelow = window.innerHeight - (rect.top + rect.height);
    const preferBelow = spaceBelow > 220 || rect.top < 160;
    const top = preferBelow
      ? Math.min(window.innerHeight - 220, rect.top + rect.height + 12)
      : Math.max(12, rect.top - 200);
    let left = rect.left;
    left = Math.min(left, window.innerWidth - 360);
    left = Math.max(12, left);
    return { position: 'fixed', top, left };
  })();

  return (
    <div className="pv-guide" role="dialog" aria-modal="true" aria-label="Varyant rehberi">
      <div className="pv-guide__dim" onClick={onClose} />
      {rect ? (
        <div
          className="pv-guide__spot"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          }}
        />
      ) : null}

      <div className="pv-guide__card" style={cardStyle}>
        <button type="button" className="pv-guide__close" onClick={onClose} aria-label="Kapat">
          <X className="w-4 h-4" />
        </button>
        <div className="pv-guide__icon">
          <Icon className="w-6 h-6" />
        </div>
        <p className="pv-guide__step">
          {stepIndex + 1} / {VARIANT_GUIDE_STEPS.length}
        </p>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
        <div className="pv-guide__nav">
          <button type="button" className="pv-guide__btn" disabled={isFirst} onClick={onPrev}>
            <ChevronLeft className="w-4 h-4" />
            Geri
          </button>
          <button type="button" className="pv-guide__btn pv-guide__btn--primary" onClick={onNext}>
            {isLast ? 'Bitir' : 'İleri'}
            {!isLast ? <ChevronRight className="w-4 h-4" /> : null}
          </button>
        </div>
      </div>
    </div>
  );
}
