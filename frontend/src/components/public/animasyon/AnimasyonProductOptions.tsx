import { useEffect, useMemo, useState } from 'react';
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
  currency?: { code?: string; symbol?: string } | null
) {
  if (group.pricing === 'replace') return formatMoney(price, currency);
  if (price > 0) return `+${formatMoney(price, currency)}`;
  return null;
}

export default function AnimasyonProductOptions({
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
    [groups]
  );

  const [selections, setSelections] = useState<SelectionMap>(() =>
    defaultSelections(activeGroups)
  );

  useEffect(() => {
    setSelections(defaultSelections(activeGroups));
  }, [activeGroups]);

  const unitPrice = computePreviewUnitPrice(basePrice, activeGroups, selections);
  const priceChanged = Math.abs(unitPrice - basePrice) > 0.001;

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
    <section className="anim-opts anim-page__reveal" aria-label="Ürün seçenekleri">
      <header className="anim-opts__head">
        <h2>Seçenekler</h2>
        <p>Boy, ekstra ve isteklerini buradan seç.</p>
      </header>

      <div className="anim-opts__groups">
        {activeGroups.map((g) => {
          const picks = selections[g.id] || [];
          const blocked = blockedOptionIds(activeGroups, selections);

          if (g.type === 'single') {
            const visible = g.options.filter(
              (o) => !blocked.has(o.id) || picks[0]?.optionId === o.id
            );
            return (
              <div key={g.id} className="anim-opts__group">
                <div className="anim-opts__label">
                  <span>
                    {g.name}
                    {g.required ? <i aria-hidden>*</i> : null}
                  </span>
                </div>
                <div className="anim-opts__chips" role="radiogroup" aria-label={g.name}>
                  {!g.required ? (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={!picks.length}
                      className={`anim-opts__chip${!picks.length ? ' is-on' : ''}`}
                      onClick={() => {
                        const next = { ...selections };
                        delete next[g.id];
                        patch(next);
                      }}
                    >
                      Seçilmedi
                    </button>
                  ) : null}
                  {visible.map((o) => {
                    const on = picks[0]?.optionId === o.id;
                    const priceText = optionPriceLabel(g, o.price, currency);
                    return (
                      <button
                        key={o.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        className={`anim-opts__chip${on ? ' is-on' : ''}`}
                        onClick={() => {
                          patch({
                            ...selections,
                            [g.id]: [{ optionId: o.id, qty: 1 }],
                          });
                        }}
                      >
                        <span>{o.name}</span>
                        {priceText ? <small>{priceText}</small> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          }

          if (g.type === 'choice') {
            const visible = g.options.filter((o) => !blocked.has(o.id));
            return (
              <div key={g.id} className="anim-opts__group">
                <div className="anim-opts__label">
                  <span>
                    {g.name}
                    {g.required ? <i aria-hidden>*</i> : null}
                  </span>
                </div>
                <div className="anim-opts__chips">
                  {visible.map((o) => {
                    const on = picks.some((x) => x.optionId === o.id);
                    const priceText = optionPriceLabel(g, o.price, currency);
                    return (
                      <button
                        key={o.id}
                        type="button"
                        aria-pressed={on}
                        className={`anim-opts__chip${on ? ' is-on' : ''}`}
                        onClick={() => {
                          const nextPicks = on
                            ? picks.filter((x) => x.optionId !== o.id)
                            : [...picks, { optionId: o.id, qty: 1 }];
                          const next = { ...selections };
                          if (nextPicks.length) next[g.id] = nextPicks;
                          else delete next[g.id];
                          patch(next);
                        }}
                      >
                        <span>{o.name}</span>
                        {priceText ? <small>{priceText}</small> : null}
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
            <div key={g.id} className="anim-opts__group">
              <div className="anim-opts__label">
                <span>
                  {g.name}
                  {g.required ? <i aria-hidden>*</i> : null}
                </span>
                {maxQty > 0 ? (
                  <em>
                    en fazla {maxQty}
                    {groupQty > 0 ? ` · ${groupQty}` : ''}
                  </em>
                ) : null}
              </div>
              <ul className="anim-opts__multi">
                {visible.map((o) => {
                  const cur = picks.find((x) => x.optionId === o.id);
                  const q = cur?.qty || 0;
                  const priceText = optionPriceLabel(g, o.price, currency);
                  return (
                    <li key={o.id} className="anim-opts__multi-row">
                      <div className="anim-opts__multi-copy">
                        <strong>{o.name}</strong>
                        {priceText ? <span>{priceText}</span> : null}
                      </div>
                      <div className="anim-opts__stepper">
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
                                x.optionId === o.id ? { ...x, qty: q - 1 } : x
                              );
                            }
                            patch(next);
                          }}
                        >
                          −
                        </button>
                        <em>{q}</em>
                        <button
                          type="button"
                          aria-label={`${o.name} artır`}
                          disabled={maxQty > 0 && groupQty >= maxQty}
                          onClick={() => {
                            if (maxQty > 0 && groupQty >= maxQty) return;
                            const next = { ...selections };
                            if (q === 0) next[g.id] = [...picks, { optionId: o.id, qty: 1 }];
                            else {
                              next[g.id] = picks.map((x) =>
                                x.optionId === o.id ? { ...x, qty: q + 1 } : x
                              );
                            }
                            patch(next);
                          }}
                        >
                          +
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      <div className={`anim-opts__total${priceChanged ? ' is-live' : ''}`}>
        <span>Seçime göre</span>
        <strong>{formatMoney(unitPrice, currency)}</strong>
      </div>
    </section>
  );
}
