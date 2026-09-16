import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  Loader2,
  Minus,
  Plus,
  Trash2,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { api, formatMoney } from '@/lib/api';
import {
  blockedOptionIds,
  computePreviewUnitPrice,
  sanitizeSelections,
  type ProductOptionGroup,
  type SelectionMap,
} from '@/lib/productOptions';

export type GarsonOrderLine = {
  id: string;
  productId?: number | null;
  name: string;
  qty: number;
  price: number;
  createdAt: string;
  note?: string;
  freeNote?: string;
  selections?: { groupId: string; optionId: string; qty: number; label?: string }[];
  settledAt?: string | null;
};

export type GarsonAssignedTable = {
  key: string;
  code: string;
  name: string;
  groupSlug: string;
  groupName: string;
  sessionId: number | null;
  occupied: boolean;
  openedAt: string | null;
  orders: GarsonOrderLine[];
  total: number;
  remaining: number;
  isFresh?: boolean;
};

type CatalogProduct = {
  id: number;
  name: string;
  price: number;
  groupId?: number;
  groupName: string;
  optionGroups?: ProductOptionGroup[];
};

function defaultSelections(groups: ProductOptionGroup[]): SelectionMap {
  const out: SelectionMap = {};
  for (const g of groups) {
    const first = g.options.find((o) => o.isActive !== false);
    if (g.type === 'single' && first) {
      out[g.id] = [{ optionId: first.id, qty: 1 }];
    }
  }
  return sanitizeSelections(groups, out);
}

function lineTotal(o: GarsonOrderLine) {
  return Math.round(o.price * o.qty * 100) / 100;
}

function optionsLine(o: GarsonOrderLine) {
  if (o.selections?.length) {
    return o.selections
      .map((s) => {
        const label = s.label?.trim() || 'Seçenek';
        return s.qty > 1 ? `${label} ×${s.qty}` : label;
      })
      .join(' · ');
  }
  return (o.freeNote || o.note || '').trim();
}

export default function GarsonTableOrderDock({
  table,
  onClose,
  onChanged,
  onOpenFloor,
}: {
  table: GarsonAssignedTable;
  onClose: () => void;
  onChanged: () => void;
  onOpenFloor?: (masa: string, grup: string | null) => void;
}) {
  const [orders, setOrders] = useState<GarsonOrderLine[]>(table.orders || []);
  const [sessionId, setSessionId] = useState<number | null>(table.sessionId);
  const [total, setTotal] = useState(table.total || 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [step, setStep] = useState<'ticket' | 'categories' | 'products'>('ticket');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [qty, setQty] = useState(1);
  const [selections, setSelections] = useState<SelectionMap>({});

  const refreshSession = useCallback(async () => {
    try {
      const floor = await api<{
        groups: {
          id: string;
          tables: {
            code: string;
            sessionId: number | null;
            orders?: GarsonOrderLine[];
            total?: number;
          }[];
        }[];
      }>('/api/admin/table-floor');
      for (const g of floor.groups || []) {
        if (g.id !== table.groupSlug) continue;
        const t = g.tables.find((x) => x.code === table.code);
        if (t) {
          setOrders(t.orders || []);
          setSessionId(t.sessionId);
          setTotal(t.total || 0);
        }
      }
    } catch {
      /* ignore */
    }
  }, [table.code, table.groupSlug]);

  useEffect(() => {
    setOrders(table.orders || []);
    setSessionId(table.sessionId);
    setTotal(table.total || 0);
    setStep('ticket');
    setProduct(null);
    setCategoryId(null);
  }, [table.key, table.orders, table.sessionId, table.total]);

  useEffect(() => {
    let cancelled = false;
    void api<CatalogProduct[]>('/api/admin/table-floor/products')
      .then((list) => {
        if (!cancelled) setCatalog(list || []);
      })
      .catch(() => {
        if (!cancelled) setCatalog([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const catalogGroups = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const p of catalog) {
      const id = p.groupId != null ? String(p.groupId) : p.groupName.trim() || 'other';
      const name = p.groupName?.trim() || 'Diğer';
      const prev = map.get(id);
      if (prev) prev.count += 1;
      else map.set(id, { id, name, count: 1 });
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }, [catalog]);

  const products = useMemo(() => {
    if (!categoryId) return [];
    return catalog.filter((p) => {
      const id = p.groupId != null ? String(p.groupId) : p.groupName.trim() || 'other';
      return id === categoryId;
    });
  }, [catalog, categoryId]);

  const previewUnit = useMemo(() => {
    if (!product) return 0;
    const groups = product.optionGroups || [];
    if (!groups.length) return product.price;
    return computePreviewUnitPrice(product.price, groups, selections);
  }, [product, selections]);

  async function removeLine(itemId: string) {
    if (!sessionId || busy) return;
    if (!window.confirm('Bu satır silinsin mi?')) return;
    setBusy(true);
    setError('');
    try {
      await api('/api/admin/table-floor/orders/item', {
        method: 'PATCH',
        body: JSON.stringify({ sessionId, itemId, action: 'remove' }),
      });
      await refreshSession();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Silinemedi');
    } finally {
      setBusy(false);
    }
  }

  async function bumpQty(item: GarsonOrderLine, nextQty: number) {
    if (!sessionId || busy || item.settledAt) return;
    if (nextQty < 1) {
      void removeLine(item.id);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api('/api/admin/table-floor/orders/item', {
        method: 'PATCH',
        body: JSON.stringify({
          sessionId,
          itemId: item.id,
          action: 'update',
          patch: { qty: nextQty },
        }),
      });
      await refreshSession();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Güncellenemedi');
    } finally {
      setBusy(false);
    }
  }

  async function addProduct() {
    if (!product || qty < 1 || busy) return;
    const groups = product.optionGroups || [];
    for (const g of groups) {
      if (!g.required) continue;
      if (!(selections[g.id] || []).length) {
        setError(`${g.name || 'Seçenek'} zorunlu`);
        return;
      }
    }
    const sels = Object.entries(selections).flatMap(([groupId, picks]) =>
      picks.map((pick) => ({ groupId, optionId: pick.optionId, qty: pick.qty }))
    );
    setBusy(true);
    setError('');
    try {
      await api('/api/admin/table-floor/orders', {
        method: 'POST',
        body: JSON.stringify({
          tableNumber: table.code,
          groupSlug: table.groupSlug,
          items: [
            {
              productId: product.id,
              name: product.name,
              qty,
              price: previewUnit,
              ...(sels.length ? { selections: sels } : {}),
            },
          ],
        }),
      });
      setProduct(null);
      setQty(1);
      setSelections({});
      setStep('ticket');
      await refreshSession();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eklenemedi');
    } finally {
      setBusy(false);
    }
  }

  function pickProduct(p: CatalogProduct) {
    setProduct(p);
    setQty(1);
    setSelections(defaultSelections(p.optionGroups || []));
    setError('');
  }

  return (
    <div className="garson-order" role="dialog" aria-modal="true" aria-label={`${table.name} sipariş`}>
      <header className="garson-order__head">
        <button type="button" className="garson-order__back" onClick={onClose}>
          <ArrowLeft className="w-4 h-4" />
          Geri
        </button>
        <div className="garson-order__title">
          <strong>{table.name}</strong>
          <small>
            {table.groupName}
            {total > 0 ? ` · ${formatMoney(total)}` : ''}
          </small>
        </div>
        <div className="garson-order__head-actions">
          {onOpenFloor ? (
            <button
              type="button"
              className="garson-order__ghost"
              onClick={() => onOpenFloor(table.code, table.groupSlug)}
            >
              Masa görünümü
            </button>
          ) : null}
          <button type="button" className="garson-order__x" onClick={onClose} aria-label="Kapat">
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="garson-order__tabs" role="tablist">
        <button
          type="button"
          className={step === 'ticket' ? 'is-active' : ''}
          onClick={() => {
            setStep('ticket');
            setProduct(null);
          }}
        >
          Adisyon
        </button>
        <button
          type="button"
          className={step !== 'ticket' ? 'is-active' : ''}
          onClick={() => {
            setStep('categories');
            setProduct(null);
            setCategoryId(null);
          }}
        >
          <UtensilsCrossed className="w-3.5 h-3.5" />
          Ürün ekle
        </button>
      </div>

      {error ? <div className="garson-order__error">{error}</div> : null}

      {step === 'ticket' ? (
        <div className="garson-order__body">
          {orders.length === 0 ? (
            <div className="garson-order__empty">
              <p>Henüz ürün yok</p>
              <button type="button" onClick={() => setStep('categories')}>
                Ürün ekle
              </button>
            </div>
          ) : (
            <ul className="garson-order__lines">
              {orders.map((o) => {
                const opt = optionsLine(o);
                const settled = Boolean(o.settledAt);
                return (
                  <li key={o.id} className={settled ? 'is-settled' : ''}>
                    <div className="garson-order__line-copy">
                      <strong>{o.name}</strong>
                      {opt ? <small>{opt}</small> : null}
                      <em>{formatMoney(lineTotal(o))}</em>
                    </div>
                    {!settled ? (
                      <div className="garson-order__line-tools">
                        <button
                          type="button"
                          disabled={busy}
                          aria-label="Azalt"
                          onClick={() => void bumpQty(o, o.qty - 1)}
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span>{o.qty}</span>
                        <button
                          type="button"
                          disabled={busy}
                          aria-label="Artır"
                          onClick={() => void bumpQty(o, o.qty + 1)}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className="is-danger"
                          disabled={busy}
                          aria-label="Sil"
                          onClick={() => void removeLine(o.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="garson-order__paid">Ödendi</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <div className="garson-order__body">
          {step === 'products' || product ? (
            <button
              type="button"
              className="garson-order__crumb"
              onClick={() => {
                if (product) {
                  setProduct(null);
                  return;
                }
                setStep('categories');
                setCategoryId(null);
              }}
            >
              <ChevronLeft className="w-4 h-4" />
              {product ? 'Ürünler' : 'Kategoriler'}
            </button>
          ) : null}

          {!product && step === 'categories' ? (
            <div className="garson-order__cats">
              {catalogGroups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    setCategoryId(g.id);
                    setStep('products');
                  }}
                >
                  <span>{g.name}</span>
                  <em>{g.count}</em>
                </button>
              ))}
            </div>
          ) : null}

          {!product && step === 'products' ? (
            <div className="garson-order__products">
              {products.map((p) => (
                <button key={p.id} type="button" onClick={() => pickProduct(p)}>
                  <strong>{p.name}</strong>
                  <span>{formatMoney(p.price)}</span>
                </button>
              ))}
            </div>
          ) : null}

          {product ? (
            <div className="garson-order__config">
              <h4>{product.name}</h4>
              {(product.optionGroups || []).map((g) => {
                const picks = selections[g.id] || [];
                const blocked = blockedOptionIds(product.optionGroups || [], selections);
                const activeOpts = g.options.filter((o) => o.isActive !== false);
                if (g.type === 'single') {
                  const visible = activeOpts.filter(
                    (o) => !blocked.has(o.id) || picks[0]?.optionId === o.id
                  );
                  return (
                    <label key={g.id} className="garson-order__field">
                      <span>
                        {g.name}
                        {g.required ? ' *' : ''}
                      </span>
                      <select
                        value={picks[0]?.optionId || ''}
                        onChange={(e) => {
                          const optionId = e.target.value;
                          const next = { ...selections };
                          if (!optionId) delete next[g.id];
                          else next[g.id] = [{ optionId, qty: 1 }];
                          setSelections(sanitizeSelections(product.optionGroups || [], next));
                        }}
                      >
                        {!g.required ? <option value="">Seçilmedi</option> : null}
                        {visible.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                            {o.price ? ` · ${formatMoney(o.price)}` : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                }
                return (
                  <div key={g.id} className="garson-order__field">
                    <span>
                      {g.name}
                      {g.required ? ' *' : ''}
                    </span>
                    <div className="garson-order__multi">
                      {activeOpts
                        .filter((o) => !blocked.has(o.id) || picks.some((p) => p.optionId === o.id))
                        .map((o) => {
                          const pick = picks.find((p) => p.optionId === o.id);
                          const on = Boolean(pick);
                          return (
                            <button
                              key={o.id}
                              type="button"
                              className={on ? 'is-on' : ''}
                              onClick={() => {
                                const next = { ...selections };
                                const cur = [...(next[g.id] || [])];
                                const idx = cur.findIndex((p) => p.optionId === o.id);
                                if (idx >= 0) cur.splice(idx, 1);
                                else cur.push({ optionId: o.id, qty: 1 });
                                if (cur.length) next[g.id] = cur;
                                else delete next[g.id];
                                setSelections(sanitizeSelections(product.optionGroups || [], next));
                              }}
                            >
                              {o.name}
                              {o.price ? ` · ${formatMoney(o.price)}` : ''}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                );
              })}

              <div className="garson-order__qty">
                <span>Adet</span>
                <div>
                  <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                    <Minus className="w-4 h-4" />
                  </button>
                  <em>{qty}</em>
                  <button type="button" onClick={() => setQty((q) => q + 1)}>
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <strong>{formatMoney(previewUnit * qty)}</strong>
              </div>

              <button
                type="button"
                className="garson-order__add"
                disabled={busy}
                onClick={() => void addProduct()}
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Adisyona ekle
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
