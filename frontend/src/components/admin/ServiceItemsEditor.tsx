import { useEffect, useRef, useState } from 'react';
import { CarFront, ChevronDown, ChevronUp, HandHelping, ReceiptText } from 'lucide-react';
import HookahIcon from '@/components/public/HookahIcon';
import { SERVICE_TEXT, type MenuServiceItem, type MenuServiceKind } from '@/lib/tableService';

const ICONS: Record<MenuServiceKind, typeof HandHelping> = {
  waiter: HandHelping,
  bill: ReceiptText,
  hookah: HookahIcon as unknown as typeof HandHelping,
  valet: CarFront,
};

/**
 * Menüdeki servis butonları: her biri ayrı açılıp kapanır, sıra yukarı/aşağı okla değişir.
 * Sürükleme gerekmez; üstteki önizleme müşterinin göreceği sırayı gösterir.
 */
export default function ServiceItemsEditor({
  items,
  onChange,
}: {
  items: MenuServiceItem[];
  onChange: (next: MenuServiceItem[]) => void;
}) {
  const [moved, setMoved] = useState<MenuServiceKind | null>(null);
  const [announce, setAnnounce] = useState('');
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const on = items.filter((i) => i.enabled);

  function flash(kind: MenuServiceKind, message: string) {
    setMoved(kind);
    setAnnounce(message);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMoved(null), 700);
  }
  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = items.slice();
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
    flash(items[index].kind, `${SERVICE_TEXT[items[index].kind].label} ${target + 1}. sıraya taşındı.`);
  }
  function toggle(index: number) {
    const next = items.map((item, i) => (i === index ? { ...item, enabled: !item.enabled } : item));
    onChange(next);
    const item = next[index];
    flash(item.kind, `${SERVICE_TEXT[item.kind].label} ${item.enabled ? 'açıldı' : 'kapatıldı'}.`);
  }

  return (
    <div className="ast-svc">
      <div className="ast-svc-preview" aria-label="Menüde görünüm önizlemesi">
        <span className="ast-svc-preview-label">Menüde böyle görünür</span>
        {on.length ? (
          <ol>
            {on.map((item, i) => {
              const Icon = ICONS[item.kind];
              return (
                <li key={item.kind}>
                  <i>{i + 1}</i>
                  <Icon size={15} strokeWidth={1.8} />
                  {SERVICE_TEXT[item.kind].label}
                </li>
              );
            })}
          </ol>
        ) : (
          <p>Hiç servis açık değil; menüde servis butonu görünmez.</p>
        )}
      </div>

      <ul className="ast-svc-list">
        {items.map((item, index) => {
          const Icon = ICONS[item.kind];
          const text = SERVICE_TEXT[item.kind];
          return (
            <li
              key={item.kind}
              className={`ast-svc-row${item.enabled ? '' : ' is-off'}${moved === item.kind ? ' is-moved' : ''}`}
            >
              <span className="ast-svc-order" aria-hidden="true">
                {index + 1}
              </span>
              <span className="ast-svc-icon" aria-hidden="true">
                <Icon size={20} strokeWidth={1.7} />
              </span>
              <span className="ast-svc-text">
                <strong>{text.label}</strong>
                <small>{text.description}</small>
              </span>
              <span className="ast-svc-arrows">
                <button
                  type="button"
                  aria-label={`${text.label} servisini yukarı taşı`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ChevronUp size={18} />
                </button>
                <button
                  type="button"
                  aria-label={`${text.label} servisini aşağı taşı`}
                  disabled={index === items.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ChevronDown size={18} />
                </button>
              </span>
              <button
                type="button"
                className="ast-svc-switch"
                role="switch"
                aria-checked={item.enabled}
                aria-label={`${text.label} servisi`}
                onClick={() => toggle(index)}
              >
                <span className="ast-switch" aria-hidden="true">
                  <span />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="ast-sr" role="status" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}
