import { useEffect, useId, useRef, useState } from 'react';
import { ArrowUpLeft, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { Input } from '@/components/ui';
import type { Product } from './types';

// Names only: a dish name cannot establish a restaurant's recipe or portion size.
const DISH_NAMES = [
  'Tavuk',
  'Tavuk pilav',
  'Tavuk şiş',
  'Tavuk dürüm',
  'Tavuk burger',
  'Tavuk sote',
  'Tavuk salata',
  'Tavuk çorbası',
  'Izgara tavuk',
  'Et döner',
  'Et dürüm',
  'Et sote',
  'Izgara köfte',
  'İskender',
  'Adana kebap',
  'Urfa kebap',
  'Kuzu şiş',
  'Hamburger',
  'Cheeseburger',
  'Margherita pizza',
  'Karışık pizza',
  'Mantarlı pizza',
  'Lahmacun',
  'Kaşarlı pide',
  'Kıymalı pide',
  'Menemen',
  'Serpme kahvaltı',
  'Sahanda yumurta',
  'Sucuklu yumurta',
  'Peynirli omlet',
  'Kaşarlı tost',
  'Karışık tost',
  'Patates kızartması',
  'Mercimek çorbası',
  'Ezogelin çorbası',
  'Domates çorbası',
  'Çoban salata',
  'Sezar salata',
  'Mevsim salata',
  'Akdeniz salata',
  'Pirinç pilavı',
  'Bulgur pilavı',
  'Nohutlu pilav',
  'Fettuccine Alfredo',
  'Spagetti bolonez',
  'Penne arrabbiata',
  'Mantı',
  'Künefe',
  'Sütlaç',
  'Tiramisu',
  'Cheesecake',
  'Çikolatalı sufle',
  'Türk kahvesi',
  'Filtre kahve',
  'Latte',
  'Cappuccino',
  'Espresso',
  'Çay',
  'Limonata',
  'Ayran',
  'Portakal suyu',
  'Su',
];
const fold = (text: string) =>
  text
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
type Suggestion = { name: string; product?: Product };

export default function ProductNameField({
  value,
  productId,
  disabled,
  onChange,
  onSelect,
}: {
  value: string;
  productId?: number;
  disabled?: boolean;
  onChange: (value: string) => void;
  onSelect: (suggestion: Suggestion) => void;
}) {
  const id = useId(),
    root = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false),
    [dismissed, setDismissed] = useState(false);
  const [found, setFound] = useState<Product[]>([]),
    [active, setActive] = useState(-1);
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
    ...DISH_NAMES.filter((name) => q && fold(name).includes(q)).map((name) => ({
      name,
    })),
  ]) {
    if (!choices.some((item) => fold(item.name) === fold(suggestion.name)))
      choices.push(suggestion);
  }
  choices.sort(
    (a, b) =>
      Number(fold(b.name).startsWith(q)) - Number(fold(a.name).startsWith(q)),
  );
  const visible = choices.slice(0, 5),
    open = focused && !dismissed && q.length >= 2 && visible.length > 0;
  function choose(item: Suggestion) {
    onSelect(item);
    setDismissed(true);
    setActive(-1);
  }
  return (
    <div
      ref={root}
      className="pe-name"
      onBlur={(event) => {
        if (!root.current?.contains(event.relatedTarget as Node))
          setFocused(false);
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
          open && active >= 0 ? `${id}-${active}` : undefined
        }
        onFocus={() => {
          setFocused(true);
          setDismissed(false);
        }}
        onChange={(event) => {
          setDismissed(false);
          onChange(event.target.value);
        }}
        onKeyDown={(event) => {
          if (open && event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            setDismissed(true);
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
          if (open && event.key === 'Enter' && active >= 0) {
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
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => choose(item)}
            >
              <Search size={14} />
              <span>
                {item.name}
                <small>
                  {item.product
                    ? 'Menünüzden · kayıtlı süre ve kalori'
                    : 'Yemek adı önerisi'}
                </small>
              </span>
              <ArrowUpLeft size={15} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
