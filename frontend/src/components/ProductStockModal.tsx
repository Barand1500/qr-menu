import { useEffect, useMemo, useState } from 'react';
import { Boxes, Check, Clock, Moon, SlidersHorizontal, Sun, X } from 'lucide-react';
import { api } from '@/lib/api';
import type { ProductOptionGroup } from '@/lib/productOptions';
import '@/product-stock-modal.css';

export type StockProduct = {
  id: number;
  name: string;
  stockQty?: number | null;
  stockResetHour?: number | null;
  stockResetMinute?: number | null;
  stockResetTo?: number | null;
  optionGroups?: ProductOptionGroup[];
};

type Tab = 'variants' | 'settings';

export function stockLabel(stockQty: number | null | undefined) {
  return stockQty == null ? 'S' : String(stockQty);
}

function readStockInput(raw: string): number | null | undefined {
  const t = raw.trim();
  if (!t || /^s$/i.test(t)) return null;
  if (!/^\d+$/.test(t)) return undefined;
  return Number(t);
}

function sanitizeStockText(value: string) {
  if (value === '' || /^s$/i.test(value) || /^\d*$/.test(value)) {
    return value.toUpperCase();
  }
  return null;
}

function StockField({
  value,
  onChange,
  ariaLabel,
  size = 'md',
}: {
  value: string;
  onChange: (next: string) => void;
  ariaLabel: string;
  size?: 'sm' | 'md';
}) {
  return (
    <input
      value={value}
      aria-label={ariaLabel}
      placeholder="S"
      onChange={(e) => {
        const next = sanitizeStockText(e.target.value);
        if (next !== null) onChange(next);
      }}
      className={`psm-stock-input${size === 'sm' ? ' psm-stock-input--sm' : ''}`}
    />
  );
}

export default function ProductStockModal({
  product,
  onClose,
  onSaved,
}: {
  product: StockProduct;
  onClose: () => void;
  onSaved: (updated: StockProduct) => void;
}) {
  const groups = useMemo(
    () => (product.optionGroups || []).filter((g) => g.options.length > 0),
    [product.optionGroups]
  );

  const [tab, setTab] = useState<Tab>(groups.length ? 'variants' : 'settings');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [productStock, setProductStock] = useState(stockLabel(product.stockQty));
  const [optionStocks, setOptionStocks] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const g of product.optionGroups || []) {
      for (const o of g.options) map[o.id] = stockLabel(o.stockQty);
    }
    return map;
  });

  const initialHour = product.stockResetHour;
  const [resetOn, setResetOn] = useState(initialHour != null);
  const [hour12, setHour12] = useState(() => {
    if (initialHour == null) return 10;
    const h = initialHour % 12;
    return h === 0 ? 12 : h;
  });
  const [isPm, setIsPm] = useState(() => (initialHour ?? 10) >= 12);
  const [minute, setMinute] = useState(product.stockResetMinute ?? 0);
  const [resetTo, setResetTo] = useState(stockLabel(product.stockResetTo));

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const hour24 = isPm ? (hour12 % 12) + 12 : hour12 % 12;
  const timeLabel = `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  async function save() {
    setError(null);

    const body: Record<string, unknown> = {};

    const parsedProduct = readStockInput(productStock);
    if (parsedProduct === undefined) {
      setError('Ürün stoğu S veya sayı olmalı');
      setTab('settings');
      return;
    }
    body.stockQty = parsedProduct;

    const entries: { optionId: string; stockQty: number | null }[] = [];
    for (const [optionId, raw] of Object.entries(optionStocks)) {
      const parsed = readStockInput(raw);
      if (parsed === undefined) {
        setError('Varyant stoğu S veya sayı olmalı');
        setTab('variants');
        return;
      }
      entries.push({ optionId, stockQty: parsed });
    }
    if (entries.length) body.optionStocks = entries;

    if (resetOn) {
      const parsedTo = readStockInput(resetTo);
      if (parsedTo === undefined) {
        setError('Reset sonrası stok S veya sayı olmalı');
        setTab('settings');
        return;
      }
      body.stockResetHour = hour24;
      body.stockResetMinute = minute;
      body.stockResetTo = parsedTo;
    } else {
      body.stockResetHour = null;
      body.stockResetMinute = null;
      body.stockResetTo = null;
    }

    setSaving(true);
    try {
      const updated = await api<StockProduct>(`/api/admin/products/${product.id}/stock`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="psm-overlay">
      <button type="button" className="psm-scrim" aria-label="Kapat" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${product.name} stok yönetimi`}
        className="psm-modal animate-slide-up"
      >
        <header className="psm-head">
          <div className="psm-head__icon" aria-hidden>
            <Clock className="w-5 h-5" />
          </div>
          <div className="psm-head__copy">
            <p>Stok yönetimi</p>
            <h2>{product.name}</h2>
          </div>
          <button type="button" className="psm-close" onClick={onClose} aria-label="Kapat">
            <X className="w-4 h-4" />
          </button>
        </header>

        <nav className="psm-tabs" role="tablist">
          {(
            [
              { key: 'variants' as const, label: 'Varyant stoğu', icon: Boxes },
              { key: 'settings' as const, label: 'Ayarlar', icon: SlidersHorizontal },
            ]
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={`psm-tab${tab === key ? ' is-active' : ''}`}
              onClick={() => setTab(key)}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>

        <div className="psm-body admin-scroll">
          {tab === 'variants' ? (
            groups.length === 0 ? (
              <div className="psm-empty">
                <Boxes className="w-8 h-8" />
                <p>Bu üründe varyant yok.</p>
                <span>Ürün stoğunu Ayarlar sekmesinden yönet.</span>
              </div>
            ) : (
              <div className="psm-variants">
                <p className="psm-hint">
                  Her varyant için ayrı stok gir. <b>S</b> = sınırsız, <b>0</b> = tükendi.
                </p>
                {groups.map((group) => (
                  <section key={group.id} className="psm-variant-group">
                    <h3>{group.name}</h3>
                    <ul>
                      {group.options.map((option) => {
                        const soldOut = optionStocks[option.id] === '0';
                        return (
                          <li key={option.id} className={soldOut ? 'is-soldout' : undefined}>
                            <span>{option.name}</span>
                            <StockField
                              size="sm"
                              ariaLabel={`${option.name} stoğu`}
                              value={optionStocks[option.id] ?? 'S'}
                              onChange={(next) =>
                                setOptionStocks((prev) => ({ ...prev, [option.id]: next }))
                              }
                            />
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            )
          ) : (
            <div className="psm-settings">
              <section className="psm-card">
                <div className="psm-card__row">
                  <div>
                    <h3>Ürün stoğu</h3>
                    <p>S = sınırsız · 0 = bugün bitti</p>
                  </div>
                  <StockField
                    ariaLabel="Ürün stoğu"
                    value={productStock}
                    onChange={setProductStock}
                  />
                </div>
              </section>

              <section className={`psm-reset${resetOn ? ' is-on' : ''}`}>
                <button
                  type="button"
                  className="psm-reset__toggle"
                  onClick={() => setResetOn((v) => !v)}
                  aria-pressed={resetOn}
                >
                  <span className="psm-reset__switch" aria-hidden>
                    <em />
                  </span>
                  <span className="psm-reset__copy">
                    <strong>Günlük otomatik reset</strong>
                    <small>
                      {resetOn
                        ? `Her gün ${timeLabel} saatinde yenilenir`
                        : 'Kapalı — stok yalnızca elle değişir'}
                    </small>
                  </span>
                </button>

                {resetOn ? (
                  <div className="psm-reset__panel">
                    <div className="psm-period" role="group" aria-label="Gündüz veya gece">
                      <button
                        type="button"
                        className={`psm-period__btn psm-period__btn--day${!isPm ? ' is-on' : ''}`}
                        onClick={() => {
                          setIsPm(false);
                          if (hour12 === 12) setHour12(10);
                        }}
                        aria-pressed={!isPm}
                      >
                        <Sun className="w-5 h-5" />
                        <span>
                          <strong>Gündüz</strong>
                          <small>Örn. 08:00 · 10:00</small>
                        </span>
                      </button>
                      <button
                        type="button"
                        className={`psm-period__btn psm-period__btn--night${isPm ? ' is-on' : ''}`}
                        onClick={() => {
                          setIsPm(true);
                          if (hour12 === 12) setHour12(10);
                        }}
                        aria-pressed={isPm}
                      >
                        <Moon className="w-5 h-5" />
                        <span>
                          <strong>Gece</strong>
                          <small>Örn. 22:00 · 00:00</small>
                        </span>
                      </button>
                    </div>

                    <div className="psm-clock">
                      <div className="psm-clock__face" aria-hidden>
                        <span className={isPm ? 'is-night' : 'is-day'}>
                          {isPm ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                        </span>
                        <strong>{timeLabel}</strong>
                      </div>

                      <div className="psm-clock__pickers">
                        <label>
                          <span>Saat</span>
                          <select
                            value={hour12}
                            onChange={(e) => setHour12(Number(e.target.value))}
                            aria-label="Saat"
                          >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                              <option key={h} value={h}>
                                {String(h).padStart(2, '0')}
                              </option>
                            ))}
                          </select>
                        </label>
                        <span className="psm-clock__colon" aria-hidden>
                          :
                        </span>
                        <label>
                          <span>Dakika</span>
                          <select
                            value={minute}
                            onChange={(e) => setMinute(Number(e.target.value))}
                            aria-label="Dakika"
                          >
                            {[0, 15, 30, 45].map((m) => (
                              <option key={m} value={m}>
                                {String(m).padStart(2, '0')}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>

                    <div className="psm-card psm-card--inset">
                      <div className="psm-card__row">
                        <div>
                          <h3>Reset sonrası stok</h3>
                          <p>Her gün bu değere döner</p>
                        </div>
                        <StockField
                          ariaLabel="Reset sonrası stok"
                          value={resetTo}
                          onChange={setResetTo}
                        />
                      </div>
                    </div>
                  </div>
                ) : null}
              </section>
            </div>
          )}
        </div>

        <footer className="psm-foot">
          <p className="psm-error">{error}</p>
          <div className="psm-foot__actions">
            <button type="button" className="psm-btn-ghost" onClick={onClose} disabled={saving}>
              Vazgeç
            </button>
            <button
              type="button"
              className="psm-btn-primary"
              onClick={() => void save()}
              disabled={saving}
            >
              <Check className="w-4 h-4" />
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
