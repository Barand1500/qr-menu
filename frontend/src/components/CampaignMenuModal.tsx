import { useEffect, useMemo, useState } from 'react';
import { Megaphone, X, Search, EyeOff } from 'lucide-react';
import { api, formatMoney, imageUrl } from '@/lib/api';
import { Button, Spinner } from '@/components/ui';

interface Currency {
  id: number;
  code: string;
  name: string;
  symbol: string;
}

interface CatalogProduct {
  id: number;
  name: string;
  price: number;
  currency?: { id?: number | null; code?: string; symbol?: string } | null;
  imageUrl?: string | null;
  groupId: number;
  groupName: string;
  isActive: boolean;
}

interface DraftItem {
  selected: boolean;
  price: string;
  currencyId: string;
}

interface CampaignMenuModalProps {
  open: boolean;
  campaignId: number | null;
  campaignName: string;
  onClose: () => void;
  onSaved: (itemCount: number) => void;
}

export default function CampaignMenuModal({
  open,
  campaignId,
  campaignName,
  onClose,
  onSaved,
}: CampaignMenuModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<number | 'all'>('all');
  const [hideUnselected, setHideUnselected] = useState(false);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [draft, setDraft] = useState<Record<number, DraftItem>>({});

  useEffect(() => {
    if (!open || !campaignId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setQuery('');
    setCategoryId('all');
    setHideUnselected(false);

    Promise.all([
      api<{ data: CatalogProduct[] }>('/api/admin/products?limit=500'),
      api<Currency[]>('/api/admin/currencies'),
      api<{
        items: {
          productId: number;
          price: number;
          currencyId: number | null;
        }[];
      }>(`/api/admin/campaigns/${campaignId}/items`),
    ])
      .then(([productRes, currencyRes, itemsRes]) => {
        if (cancelled) return;
        const list = (productRes.data || []).filter((p) => p.isActive !== false);
        setProducts(list);
        setCurrencies(currencyRes || []);

        const defaultCurrencyId =
          currencyRes.find((c) => c.code === 'TRY')?.id ?? currencyRes[0]?.id ?? null;

        const existing = new Map(
          (itemsRes.items || []).map((item) => [item.productId, item])
        );

        const next: Record<number, DraftItem> = {};
        for (const p of list) {
          const hit = existing.get(p.id);
          next[p.id] = {
            selected: !!hit,
            price: hit ? String(hit.price) : String(p.price),
            currencyId: String(
              hit?.currencyId ?? p.currency?.id ?? defaultCurrencyId ?? ''
            ),
          };
        }
        setDraft(next);
      })
      .catch(() => {
        if (!cancelled) setError('Özel menü yüklenemedi');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, campaignId]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const categories = useMemo(() => {
    const map = new Map<number, string>();
    for (const p of products) {
      if (!map.has(p.groupId)) map.set(p.groupId, p.groupName || 'Diğer');
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }, [products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const item = draft[p.id];
      if (!item) return false;
      if (hideUnselected && !item.selected) return false;
      if (categoryId !== 'all' && p.groupId !== categoryId) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.groupName || '').toLowerCase().includes(q)
      );
    });
  }, [products, query, categoryId, hideUnselected, draft]);

  const selectedCount = useMemo(
    () => Object.values(draft).filter((d) => d.selected).length,
    [draft]
  );

  function patchItem(productId: number, patch: Partial<DraftItem>) {
    setDraft((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], ...patch },
    }));
  }

  async function handleSave() {
    if (!campaignId) return;
    setSaving(true);
    setError(null);
    try {
      const items = Object.entries(draft)
        .filter(([, d]) => d.selected)
        .map(([id, d], index) => {
          const price = Number(d.price);
          if (!Number.isFinite(price) || price < 0) {
            throw new Error('Geçersiz fiyat');
          }
          return {
            productId: Number(id),
            price,
            currencyId: d.currencyId ? Number(d.currencyId) : null,
            sortOrder: index,
          };
        });

      const res = await api<{ itemCount: number }>(
        `/api/admin/campaigns/${campaignId}/items`,
        {
          method: 'PUT',
          body: JSON.stringify({ items }),
        }
      );
      onSaved(res.itemCount);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }

  if (!open || !campaignId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[6px]" />

      <div
        className="relative w-full sm:max-w-4xl max-h-[92vh] overflow-hidden flex flex-col rounded-t-[28px] sm:rounded-[28px] shadow-2xl animate-slide-up"
        style={{
          background: 'var(--admin-card)',
          border: '1px solid var(--admin-card-border)',
        }}
      >
        <div
          className="px-5 pt-5 pb-4 shrink-0 space-y-4"
          style={{ borderBottom: '1px solid var(--admin-card-border)' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: 'var(--admin-accent-soft)', color: 'var(--admin-accent)' }}
              >
                <Megaphone className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-[var(--admin-text)]">
                  Özel menü oluştur
                </h2>
                <p className="text-xs admin-text-muted mt-0.5 truncate">
                  {campaignName} · {selectedCount} ürün seçili
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-[var(--admin-accent-soft)] transition"
              aria-label="Kapat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 admin-text-muted pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ürün ara…"
              className="camp-menu-search"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={`camp-menu-chip ${categoryId === 'all' ? 'is-active' : ''}`}
              onClick={() => setCategoryId('all')}
            >
              Tümü
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`camp-menu-chip ${categoryId === cat.id ? 'is-active' : ''}`}
                onClick={() => setCategoryId(cat.id)}
              >
                {cat.name}
              </button>
            ))}
            <button
              type="button"
              className={`camp-menu-chip camp-menu-chip--toggle ${hideUnselected ? 'is-active' : ''}`}
              onClick={() => setHideUnselected((v) => !v)}
              title="Seçilmeyen ürünleri listeden gizle"
            >
              <EyeOff className="w-3.5 h-3.5" />
              Seçilmeyenleri gizle
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto admin-scroll px-5 py-4">
          {loading ? (
            <Spinner />
          ) : error && products.length === 0 ? (
            <p className="text-sm text-red-600 py-8 text-center">{error}</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm admin-text-muted py-8 text-center">
              {hideUnselected
                ? 'Seçili ürün yok. Filtreyi kapatıp ürün seç.'
                : 'Ürün bulunamadı'}
            </p>
          ) : (
            <div className="camp-menu-grid">
              {filtered.map((product) => {
                const item = draft[product.id];
                if (!item) return null;
                return (
                  <div
                    key={product.id}
                    className={`camp-menu-card ${item.selected ? 'is-selected' : ''}`}
                  >
                    <button
                      type="button"
                      className="camp-menu-card__main"
                      onClick={() =>
                        patchItem(product.id, { selected: !item.selected })
                      }
                    >
                      <span
                        className={`camp-menu-check ${item.selected ? 'is-on' : ''}`}
                        aria-hidden
                      />
                      {product.imageUrl ? (
                        <img
                          src={imageUrl(product.imageUrl)}
                          alt=""
                          className="camp-menu-card__img"
                        />
                      ) : (
                        <div className="camp-menu-card__img camp-menu-card__img--empty" />
                      )}
                      <div className="camp-menu-card__meta">
                        <p className="camp-menu-card__name">{product.name}</p>
                        <p className="camp-menu-card__sub">
                          {product.groupName} · {formatMoney(product.price, product.currency)}
                        </p>
                      </div>
                    </button>

                    {item.selected && (
                      <div className="camp-menu-price">
                        <label className="camp-menu-field">
                          <span>Kampanya fiyatı</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.price}
                            onChange={(e) =>
                              patchItem(product.id, { price: e.target.value })
                            }
                            onClick={(e) => e.stopPropagation()}
                          />
                        </label>
                        <label className="camp-menu-field">
                          <span>Para birimi</span>
                          <select
                            value={item.currencyId}
                            onChange={(e) =>
                              patchItem(product.id, { currencyId: e.target.value })
                            }
                            onClick={(e) => e.stopPropagation()}
                          >
                            {currencies.map((c) => (
                              <option key={c.id} value={String(c.id)}>
                                {c.symbol} {c.code}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div
          className="px-5 py-4 shrink-0 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between"
          style={{ borderTop: '1px solid var(--admin-card-border)' }}
        >
          {error ? (
            <p className="text-xs text-red-600">{error}</p>
          ) : (
            <p className="text-xs admin-text-muted">
              Esc veya × ile kapat. Seçilenler kampanya fiyatıyla görünür.
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
              Vazgeç
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving || loading}>
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
