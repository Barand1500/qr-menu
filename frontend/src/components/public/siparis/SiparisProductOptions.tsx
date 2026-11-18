import { useEffect, useMemo, useState } from 'react';
import { Check, Minus, Plus } from 'lucide-react';
import { formatMoney } from '@/lib/api';
import {
  blockedOptionIds,
  computePreviewUnitPrice,
  effectiveMultiMaxTotalQty,
  groupSelectedQty,
  sanitizeSelections,
  type ProductOptionGroup,
  type SelectionMap,
} from '@/lib/productOptions';

function defaultSelections(groups: ProductOptionGroup[]): SelectionMap {
  const out: SelectionMap = {};
  for (const g of groups) {
    const first = g.options.find((o) => o.isActive !== false);
    if (g.type === 'single' && g.required && first) {
      out[g.id] = [{ optionId: first.id, qty: 1 }];
    } else if (g.type === 'single' && first && g.pricing === 'replace') {
      out[g.id] = [{ optionId: first.id, qty: 1 }];
    }
  }
  return sanitizeSelections(groups, out);
}

function optionPriceLabel(
  group: ProductOptionGroup,
  price: number,
  currency?: { code?: string; symbol?: string } | null,
) {
  if (group.pricing === 'replace') return formatMoney(price, currency);
  if (price > 0) return `+${formatMoney(price, currency)}`;
  return null;
}

/** Ürün seçenekleri: tüm gruplar alt alta, seçim yapıldıkça fiyat üstteki sayfaya iletilir. */
export default function SiparisProductOptions({
  groups,
  basePrice,
  currency,
  onChange,
}: {
  groups: ProductOptionGroup[];
  basePrice: number;
  currency?: { code?: string; symbol?: string } | null;
  onChange?: (next: { unitPrice: number; selections: SelectionMap; label: string }) => void;
}) {
  const activeGroups = useMemo(
    () =>
      groups
        .map((g) => ({
          ...g,
          options: g.options.filter((o) => o.isActive !== false),
        }))
        .filter((g) => g.options.length > 0)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
    [groups],
  );

  const [selections, setSelections] = useState<SelectionMap>(() => defaultSelections(activeGroups));

  useEffect(() => {
    setSelections(defaultSelections(activeGroups));
  }, [activeGroups]);

  const unitPrice = computePreviewUnitPrice(basePrice, activeGroups, selections);

  const selectionLabel = useMemo(() => {
    const parts: string[] = [];
    for (const g of activeGroups) {
      for (const p of selections[g.id] || []) {
        const opt = g.options.find((o) => o.id === p.optionId);
        if (!opt) continue;
        parts.push(p.qty > 1 ? `${opt.name} ×${p.qty}` : opt.name);
      }
    }
    return parts.join(', ');
  }, [activeGroups, selections]);

  useEffect(() => {
    onChange?.({ unitPrice, selections, label: selectionLabel });
  }, [unitPrice, selections, selectionLabel, onChange]);

  if (!activeGroups.length) return null;

  function patch(next: SelectionMap) {
    setSelections(sanitizeSelections(activeGroups, next));
  }

  return (
    <section className="pd-opts" aria-label="Ürün seçenekleri">
      {activeGroups.map((g, groupIndex) => {
        const picks = selections[g.id] || [];
        const blocked = blockedOptionIds(activeGroups, selections);
        const label = (
          <div className="pd-opts__label">
            <span className="pd-opts__step" aria-hidden>
              {groupIndex + 1}
            </span>
            <h3>{g.name}</h3>
            {g.required ? <small>Zorunlu</small> : null}
          </div>
        );

        if (g.type === 'single' || g.type === 'choice') {
          const single = g.type === 'single';
          const visible = g.options.filter((o) =>
            single ? !blocked.has(o.id) || picks[0]?.optionId === o.id : !blocked.has(o.id),
          );
          return (
            <div key={g.id} className="pd-opts__group">
              {label}
              <div
                className="pd-opts__chips"
                role={single ? 'radiogroup' : 'group'}
                aria-label={g.name}
              >
                {single && !g.required ? (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!picks.length}
                    className={`pd-opts__chip${!picks.length ? ' is-on' : ''}`}
                    onClick={() => {
                      const next = { ...selections };
                      delete next[g.id];
                      patch(next);
                    }}
                  >
                    <span>Seçilmedi</span>
                  </button>
                ) : null}
                {visible.map((o) => {
                  const on = single
                    ? picks[0]?.optionId === o.id
                    : picks.some((x) => x.optionId === o.id);
                  const priceText = optionPriceLabel(g, o.price, currency);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      role={single ? 'radio' : undefined}
                      aria-checked={single ? on : undefined}
                      aria-pressed={single ? undefined : on}
                      className={`pd-opts__chip${on ? ' is-on' : ''}`}
                      data-sold-out={o.stockQty === 0 ? 'true' : undefined}
                      disabled={o.stockQty === 0}
                      onClick={() => {
                        if (single) {
                          patch({ ...selections, [g.id]: [{ optionId: o.id, qty: 1 }] });
                          return;
                        }
                        const nextPicks = on
                          ? picks.filter((x) => x.optionId !== o.id)
                          : [...picks, { optionId: o.id, qty: 1 }];
                        const next = { ...selections };
                        if (nextPicks.length) next[g.id] = nextPicks;
                        else delete next[g.id];
                        patch(next);
                      }}
                    >
                      <span>
                        {o.name}
                        {o.stockQty === 0 ? ' · bitti' : ''}
                      </span>
                      {priceText ? <small>{priceText}</small> : null}
                      {on ? (
                        <i aria-hidden>
                          <Check size={12} strokeWidth={3} />
                        </i>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        }

        const groupQty = groupSelectedQty(selections, g.id);
        const maxQty = effectiveMultiMaxTotalQty(activeGroups, selections, g);
        const visible = g.options.filter((o) => !blocked.has(o.id));

        return (
          <div key={g.id} className="pd-opts__group">
            {label}
            {maxQty > 0 ? (
              <p className="pd-opts__hint">
                En fazla {maxQty}
                {groupQty > 0 ? ` · seçilen ${groupQty}` : ''}
              </p>
            ) : null}
            <ul className="pd-opts__multi">
              {visible.map((o) => {
                const cur = picks.find((x) => x.optionId === o.id);
                const q = cur?.qty || 0;
                const priceText = optionPriceLabel(g, o.price, currency);
                return (
                  <li
                    key={o.id}
                    className={`pd-opts__row${q > 0 ? ' is-on' : ''}`}
                    data-sold-out={o.stockQty === 0 ? 'true' : undefined}
                  >
                    <div className="pd-opts__row-copy">
                      <strong>
                        {o.name}
                        {o.stockQty === 0 ? ' · bitti' : ''}
                      </strong>
                      {priceText ? <span>{priceText}</span> : null}
                    </div>
                    <div className="pd-opts__stepper">
                      <button
                        type="button"
                        aria-label={`${o.name} azalt`}
                        disabled={q <= 0}
                        onClick={() => {
                          const next = { ...selections };
                          if (q <= 1) {
                            const rest = picks.filter((x) => x.optionId !== o.id);
                            if (rest.length) next[g.id] = rest;
                            else delete next[g.id];
                          } else {
                            next[g.id] = picks.map((x) =>
                              x.optionId === o.id ? { ...x, qty: q - 1 } : x,
                            );
                          }
                          patch(next);
                        }}
                      >
                        <Minus size={16} />
                      </button>
                      <em>{q}</em>
                      <button
                        type="button"
                        aria-label={`${o.name} artır`}
                        disabled={o.stockQty === 0 || (maxQty > 0 && groupQty >= maxQty)}
                        onClick={() => {
                          if (maxQty > 0 && groupQty >= maxQty) return;
                          const next = { ...selections };
                          if (q === 0) next[g.id] = [...picks, { optionId: o.id, qty: 1 }];
                          else {
                            next[g.id] = picks.map((x) =>
                              x.optionId === o.id ? { ...x, qty: q + 1 } : x,
                            );
                          }
                          patch(next);
                        }}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
