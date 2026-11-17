import { useEffect, useId, useRef, useState } from 'react';
import { ArrowUpLeft, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { Input } from '@/components/ui';
import type { Product } from './types';
import {
  DISH_CATALOG,
  type DishTemplate,
  normalizeDishName,
} from '@/lib/dishCatalog';

// Names only: a dish name cannot establish a restaurant's recipe or portion size.
const DISH_NAMES = ['Tavuk'];
const fold = (text: string) =>
  text
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
export type Suggestion = {
  name: string;
  product?: Product;
  template?: DishTemplate;
  remoteId?: string;
  remoteSource?: string;
};

export default function ProductNameField({
  value,
  productId,
  disabled,
  onChange,
  onSelect,
  onResolvingChange,
}: {
  value: string;
  productId?: number;
  disabled?: boolean;
  onChange: (value: string) => void;
  onSelect: (suggestion: Suggestion) => void;
  onResolvingChange?: (pending: boolean) => void;
}) {
  const id = useId(),
    root = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false),
    [dismissed, setDismissed] = useState(false);
  const [found, setFound] = useState<Product[]>([]),
    [active, setActive] = useState(-1);
  const [remote, setRemote] = useState<
    { id: string; name: string; source: string }[]
  >([]);
  const [remoteMessage, setRemoteMessage] = useState('');
  const [selecting, setSelecting] = useState(false);
  useEffect(() => {
    onResolvingChange?.(selecting);
    return () => onResolvingChange?.(false);
  }, [selecting, onResolvingChange]);
  const selection = useRef<AbortController | null>(null);
  useEffect(() => {
    setActive(-1);
  }, [remote, found]);
  useEffect(() => () => selection.current?.abort(), []);
  useEffect(() => {
    setRemote([]);
    setRemoteMessage('');
    if (!focused || dismissed || value.trim().length < 3) return;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      setRemoteMessage('Tarif kaynağında aranıyor…');
      void api<{
        data: { id: string; name: string; source: string }[];
        developmentKey?: boolean;
        source?: string;
      }>(
        `/api/admin/products/recipe-suggestions?search=${encodeURIComponent(value.trim())}`,
        { signal: abort.signal },
      )
        .then((result) => {
          if (abort.signal.aborted) return;
          setRemote(Array.isArray(result.data) ? result.data : []);
          setRemoteMessage(
            result.developmentKey
              ? 'TheMealDB · ücretsiz geliştirme bağlantısı'
              : result.data?.length
                ? `${result.source || 'Çevrimiçi'} tarif önerileri`
                : 'Bu adla çevrimiçi tarif bulunamadı.',
          );
        })
        .catch((error) => {
          if (!abort.signal.aborted)
            setRemoteMessage(
              error?.status === 503
                ? 'Ücretsiz Tiny Plates hesabının API anahtarını sunucuya ekleyin.'
                : error?.status === 429
                  ? 'Tarif arama sınırına ulaşıldı; yerel öneriler kullanılabilir.'
                  : 'Çevrimiçi tarif kaynağına ulaşılamadı; yerel öneriler kullanılabilir.',
            );
        });
    }, 900);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [value, focused, dismissed]);
  useEffect(() => {
    setFound([]);
    setActive(-1);
    if (!focused || value.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void api<{ data: Product[] }>(
        `/api/admin/products?limit=6&search=${encodeURIComponent(value.trim())}`,
        { signal: controller.signal },
      )
        .then((result) => {
          if (!controller.signal.aborted)
            setFound(result.data.filter((p) => p.id !== productId));
        })
        .catch(() => {
          /* Offline: Turkish name suggestions remain available. */
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, focused, productId]);
  const q = fold(value.trim());
  const choices: Suggestion[] = [];
  for (const suggestion of [
    ...found.map((product) => ({ name: product.name, product })),
    ...DISH_CATALOG.filter(
      (dish) =>
        q &&
        [dish.name, ...dish.aliases].some((name) =>
          normalizeDishName(name).includes(q),
        ),
    ).map((template) => ({ name: template.name, template })),
    ...DISH_NAMES.filter((name) => q && fold(name).includes(q)).map((name) => ({
      name,
    })),
    ...remote.map((item) => ({
      name: item.name,
      remoteId: item.id,
      remoteSource: item.source,
    })),
  ]) {
    if (!choices.some((item) => fold(item.name) === fold(suggestion.name)))
      choices.push(suggestion);
  }
  choices.sort(
    (a, b) =>
      Number(fold(b.name).startsWith(q)) - Number(fold(a.name).startsWith(q)),
  );
  const local = choices.filter((item) => !item.remoteId);
  const visible = [
      ...local.slice(0, remote.length ? 2 : 5),
      ...choices.filter((item) => item.remoteId).slice(0, 3),
    ],
    open = focused && !dismissed && q.length >= 2 && visible.length > 0;
  async function choose(item: Suggestion) {
    if (selecting) return;
    if (item.remoteId) {
      selection.current?.abort();
      const abort = new AbortController();
      selection.current = abort;
      setSelecting(true);
      setRemoteMessage('Tarif bilgileri alınıyor…');
      try {
        const result = await api<{ template: DishTemplate }>(
          `/api/admin/products/recipe-suggestions/${encodeURIComponent(item.remoteId)}`,
          { signal: abort.signal },
        );
        if (abort.signal.aborted) return;
        onSelect({ name: result.template.name, template: result.template });
        setDismissed(true);
        setActive(-1);
        setRemoteMessage('');
      } catch {
        if (!abort.signal.aborted)
          setRemoteMessage(
            'Tarif alınamadı. Tekrar seçebilir veya bilgileri yazabilirsiniz.',
          );
      } finally {
        if (selection.current === abort) setSelecting(false);
      }
      return;
    }
    onSelect(item);
    setDismissed(true);
    setActive(-1);
  }
  return (
    <div
      ref={root}
      className="pe-name"
      onBlur={(event) => {
        if (!root.current?.contains(event.relatedTarget as Node)) {
          setFocused(false);
          selection.current?.abort();
          setSelecting(false);
        }
      }}
    >
      <Input
        label="Adı"
        placeholder="Örn. Tavuk pilav"
        value={value}
        disabled={disabled}
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-activedescendant={
          open && active >= 0 && active < visible.length
            ? `${id}-${active}`
            : undefined
        }
        onFocus={() => {
          setFocused(true);
          setDismissed(false);
        }}
        onChange={(event) => {
          selection.current?.abort();
          setSelecting(false);
          setDismissed(false);
          onChange(event.target.value);
        }}
        onKeyDown={(event) => {
          if (open && event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            setDismissed(true);
            selection.current?.abort();
            setSelecting(false);
          }
          if (open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault();
            setActive(
              (i) =>
                (i < 0
                  ? event.key === 'ArrowDown'
                    ? 0
                    : visible.length - 1
                  : i + (event.key === 'ArrowDown' ? 1 : -1) + visible.length) %
                visible.length,
            );
          }
          if (open && event.key === 'Enter' && active >= 0 && visible[active]) {
            event.preventDefault();
            choose(visible[active]);
          }
        }}
      />
      {open && (
        <div
          className="pe-suggestions"
          id={id}
          role="listbox"
          aria-label="Ürün adı önerileri"
        >
          {visible.map((item, index) => (
            <button
              key={item.name}
              type="button"
              role="option"
              id={`${id}-${index}`}
              aria-selected={active === index}
              disabled={disabled || selecting}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => choose(item)}
            >
              <Search size={14} />
              <span>
                {item.name}
                <small>
                  {item.product
                    ? 'Menünüzden · kayıtlı ürün bilgileri'
                    : item.remoteId
                      ? `${item.remoteSource || 'API'} · çevrimiçi tarif`
                      : item.template
                        ? 'Başlangıç kataloğu · örnek tarif'
                        : 'Yemek adı önerisi'}
                </small>
              </span>
              <ArrowUpLeft size={15} />
            </button>
          ))}
        </div>
      )}
      {remoteMessage && focused && !dismissed && (
        <p className="pe-help" role="status" aria-live="polite">
          {remoteMessage}
        </p>
      )}
    </div>
  );
}
