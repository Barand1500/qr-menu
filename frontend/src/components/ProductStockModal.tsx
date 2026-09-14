import { useEffect, useMemo, useState } from 'react';
import { Boxes, Check, Clock, Moon, SlidersHorizontal, Sun, X } from 'lucide-react';
import { api } from '@/lib/api';
import type { ProductOptionGroup } from '@/lib/productOptions';

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

/** 'S' / boş = sınırsız (null), rakam = adet, geçersiz = undefined */
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
}: {
  value: string;
  onChange: (next: string) => void;
  ariaLabel: string;
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
      className="w-20 rounded-xl px-3 py-2 text-center text-sm font-semibold outline-none focus:border-[var(--admin-accent)]"
      style={{
        background: 'var(--admin-input-bg)',
        border: '1px solid var(--admin-card-border)',
        color: 'var(--admin-text)',
      }}
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
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Kapat"
        onClick={onClose}
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${product.name} stok yönetimi`}
        className="relative w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden animate-slide-up"
        style={{
          background: 'var(--admin-card-bg)',
          border: '1px solid var(--admin-card-border)',
        }}
      >
        <header
          className="flex items-start gap-3 px-5 py-4 border-b"
          style={{ borderColor: 'var(--admin-card-border)' }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider admin-text-muted">
              Stok yönetimi
            </p>
            <h2
              className="text-lg font-bold truncate"
              style={{ color: 'var(--admin-text)' }}
            >
              {product.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="p-2 rounded-xl admin-text-muted hover:bg-[var(--admin-input-bg)]"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <nav
          className="grid grid-cols-2 border-b"
          style={{ borderColor: 'var(--admin-card-border)' }}
        >
          {(
            [
              { key: 'variants' as const, label: 'Varyant stoğu', icon: Boxes },
              { key: 'settings' as const, label: 'Ayarlar', icon: SlidersHorizontal },
            ]
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className="flex items-center justify-center gap-2 py-3 text-sm font-semibold transition"
              style={{
                color: tab === key ? 'var(--admin-accent)' : 'var(--admin-text-muted)',
                borderBottom:
                  tab === key
                    ? '2px solid var(--admin-accent)'
                    : '2px solid transparent',
                background: tab === key ? 'var(--admin-accent-soft)' : 'transparent',
              }}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>

        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto admin-scroll">
          {tab === 'variants' ? (
            groups.length === 0 ? (
              <p className="py-8 text-center text-sm admin-text-muted">
                Bu üründe varyant yok. Ürün stoğunu Ayarlar sekmesinden yönet.
              </p>
            ) : (
              <div className="space-y-4">
                <p className="text-xs admin-text-muted">
                  Her varyant için ayrı stok gir. <strong>S</strong> = sınırsız,{' '}
                  <strong>0</strong> = tükendi (menüde soluk görünür).
                </p>
                {groups.map((group) => (
                  <section key={group.id}>
                    <h3
                      className="text-xs font-bold uppercase tracking-wide mb-2"
                      style={{ color: 'var(--admin-text)' }}
                    >
                      {group.name}
                    </h3>
                    <div className="space-y-1.5">
                      {group.options.map((option) => {
                        const soldOut = optionStocks[option.id] === '0';
                        return (
                          <div
                            key={option.id}
                            className="flex items-center gap-3 rounded-xl px-3 py-2"
                            style={{ background: 'var(--admin-input-bg)' }}
                          >
                            <span
                              className="flex-1 min-w-0 truncate text-sm font-medium"
                              style={{
                                color: soldOut ? '#dc2626' : 'var(--admin-text)',
                              }}
                            >
                              {option.name}
                            </span>
                            <StockField
                              ariaLabel={`${option.name} stoğu`}
                              value={optionStocks[option.id] ?? 'S'}
                              onChange={(next) =>
                                setOptionStocks((prev) => ({ ...prev, [option.id]: next }))
                              }
                            />
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )
          ) : (
            <div className="space-y-5">
              <div>
                <label
                  className="block text-xs font-bold uppercase tracking-wide mb-1.5"
                  style={{ color: 'var(--admin-text)' }}
                >
                  Ürün stoğu
                </label>
                <div className="flex items-center gap-3">
                  <StockField
                    ariaLabel="Ürün stoğu"
                    value={productStock}
                    onChange={setProductStock}
                  />
                  <p className="text-xs admin-text-muted">
                    S = sınırsız · 0 = bugün bitti
                  </p>
                </div>
              </div>

              <div
                className="rounded-2xl p-4"
                style={{ background: 'var(--admin-input-bg)' }}
              >
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={resetOn}
                    onChange={(e) => setResetOn(e.target.checked)}
                    className="w-4 h-4 accent-[var(--admin-accent)]"
                  />
                  <Clock className="w-4 h-4" style={{ color: 'var(--admin-accent)' }} />
                  <span
                    className="text-sm font-semibold"
                    style={{ color: 'var(--admin-text)' }}
                  >
                    Günlük otomatik reset
                  </span>
                </label>

                {resetOn ? (
                  <div className="mt-4 space-y-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide admin-text-muted mb-2">
                        Saat
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={hour12}
                          onChange={(e) => setHour12(Number(e.target.value))}
                          aria-label="Saat"
                          className="rounded-xl px-3 py-2 text-sm font-semibold outline-none"
                          style={{
                            background: 'var(--admin-card-bg)',
                            border: '1px solid var(--admin-card-border)',
                            color: 'var(--admin-text)',
                          }}
                        >
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                            <option key={h} value={h}>
                              {String(h).padStart(2, '0')}
                            </option>
                          ))}
                        </select>
                        <span className="font-bold admin-text-muted">:</span>
                        <select
                          value={minute}
                          onChange={(e) => setMinute(Number(e.target.value))}
                          aria-label="Dakika"
                          className="rounded-xl px-3 py-2 text-sm font-semibold outline-none"
                          style={{
                            background: 'var(--admin-card-bg)',
                            border: '1px solid var(--admin-card-border)',
                            color: 'var(--admin-text)',
                          }}
                        >
                          {[0, 15, 30, 45].map((m) => (
                            <option key={m} value={m}>
                              {String(m).padStart(2, '0')}
                            </option>
                          ))}
                        </select>

                        <div
                          className="flex rounded-xl overflow-hidden ml-1"
                          style={{ border: '1px solid var(--admin-card-border)' }}
                        >
                          <button
                            type="button"
                            onClick={() => setIsPm(false)}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold transition"
                            style={{
                              background: !isPm
                                ? 'var(--admin-accent)'
                                : 'var(--admin-card-bg)',
                              color: !isPm ? '#fff' : 'var(--admin-text-muted)',
                            }}
                          >
                            <Sun className="w-3.5 h-3.5" />
                            Gündüz
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsPm(true)}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold transition"
                            style={{
                              background: isPm
                                ? 'var(--admin-accent)'
                                : 'var(--admin-card-bg)',
                              color: isPm ? '#fff' : 'var(--admin-text-muted)',
                            }}
                          >
                            <Moon className="w-3.5 h-3.5" />
                            Gece
                          </button>
                        </div>
                      </div>
                      <p className="mt-2 text-xs admin-text-muted">
                        Her gün{' '}
                        <strong style={{ color: 'var(--admin-text)' }}>
                          {String(hour24).padStart(2, '0')}:
                          {String(minute).padStart(2, '0')}
                        </strong>{' '}
                        saatinde stok yenilenir.
                      </p>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide admin-text-muted mb-2">
                        Reset sonrası stok
                      </p>
                      <StockField
                        ariaLabel="Reset sonrası stok"
                        value={resetTo}
                        onChange={setResetTo}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-xs admin-text-muted">
                    Kapalı — stok yalnızca elle değişir.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <footer
          className="flex items-center justify-between gap-3 px-5 py-3.5 border-t"
          style={{ borderColor: 'var(--admin-card-border)' }}
        >
          <p className="text-xs text-red-500 min-h-[1rem]">{error}</p>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-sm font-semibold admin-text-muted hover:bg-[var(--admin-input-bg)]"
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-60"
              style={{ background: 'var(--admin-accent)' }}
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
