import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Layers3,
  Loader2,
  Plus,
  Search,
  Trash2,
  ListChecks,
  CircleDot,
} from 'lucide-react';
import { api, formatMoney } from '@/lib/api';
import { adminPath } from '@/lib/adminPath';
import {
  emptyGroup,
  emptyOption,
  type ProductOptionGroup,
} from '@/lib/productOptions';
import '@/product-variants.css';

type ProductRow = {
  id: number;
  name: string;
  groupName: string;
  price: number;
  isActive: boolean;
  optionGroups?: ProductOptionGroup[];
  optionSummary?: { groupCount: number; optionCount: number };
};

export default function ProductVariantsPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [groups, setGroups] = useState<ProductOptionGroup[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ data: ProductRow[] }>('/api/admin/products?limit=500');
      setProducts(res.data || []);
      setSelectedId((prev) => {
        if (prev && res.data?.some((p) => p.id === prev)) return prev;
        return res.data?.[0]?.id ?? null;
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ürünler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => products.find((p) => p.id === selectedId) || null,
    [products, selectedId]
  );

  useEffect(() => {
    if (!selected) {
      setGroups([]);
      setDirty(false);
      return;
    }
    setGroups(
      (selected.optionGroups || []).map((g, i) => ({
        ...g,
        sortOrder: i,
        options: (g.options || []).map((o, j) => ({ ...o, sortOrder: j })),
      }))
    );
    setDirty(false);
    setMessage(null);
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps -- reset editor when product changes

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.groupName || '').toLowerCase().includes(q)
    );
  }, [products, query]);

  function updateGroups(next: ProductOptionGroup[]) {
    setGroups(next);
    setDirty(true);
    setMessage(null);
  }

  async function handleSave() {
    if (!selected) return;
    const cleaned = groups
      .map((g, gi) => ({
        ...g,
        name: g.name.trim(),
        sortOrder: gi,
        options: g.options
          .map((o, oi) => ({
            ...o,
            name: o.name.trim(),
            price: Math.max(0, Number(o.price) || 0),
            sortOrder: oi,
          }))
          .filter((o) => o.name),
      }))
      .filter((g) => g.name && g.options.length > 0);

    for (const g of groups) {
      if (g.name.trim() && !g.options.some((o) => o.name.trim())) {
        alert(`"${g.name}" grubunda en az bir seçenek olmalı`);
        return;
      }
    }

    setSaving(true);
    try {
      const updated = await api<ProductRow>(`/api/admin/products/${selected.id}/option-groups`, {
        method: 'PUT',
        body: JSON.stringify({ groups: cleaned }),
      });
      setProducts((prev) =>
        prev.map((p) =>
          p.id === selected.id
            ? {
                ...p,
                optionGroups: updated.optionGroups,
                optionSummary: updated.optionSummary,
              }
            : p
        )
      );
      setGroups(updated.optionGroups || cleaned);
      setDirty(false);
      setMessage('Seçenekler kaydedildi');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }

  function addGroup(type: 'single' | 'multi') {
    updateGroups([
      ...groups,
      emptyGroup({
        type,
        pricing: type === 'single' ? 'replace' : 'add',
        required: type === 'single',
        name: type === 'single' ? 'Tür seçimi' : 'Ekstralar',
        options: [
          emptyOption({
            name: type === 'single' ? 'Standart' : 'Ekstra',
            price: type === 'single' ? selected?.price || 0 : 10,
          }),
        ],
      }),
    ]);
  }

  return (
    <div className="pv-page">
      <header className="pv-top">
        <Link to={adminPath('products')} className="pv-back" aria-label="Ürünlere dön">
          <ArrowLeft className="w-4 h-4" />
          Geri
        </Link>
        <div className="pv-brand">
          <p>Ürün seçenekleri</p>
          <strong>Varyant & ekstra yönetimi</strong>
        </div>
        <div className="pv-top-actions">
          {message ? (
            <span className="pv-toast">
              <Check className="w-3.5 h-3.5" />
              {message}
            </span>
          ) : null}
          <button
            type="button"
            className="pv-btn pv-btn--primary"
            disabled={!selected || !dirty || saving}
            onClick={() => void handleSave()}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Kaydet
          </button>
        </div>
      </header>

      <div className="pv-body">
        <aside className="pv-list-pane">
          <div className="pv-search">
            <Search className="w-4 h-4" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ürün veya grup ara…"
            />
          </div>
          <p className="pv-list-meta">{filtered.length} ürün</p>
          <div className="pv-list admin-scroll">
            {loading ? (
              <div className="pv-empty">Yükleniyor…</div>
            ) : filtered.length === 0 ? (
              <div className="pv-empty">Ürün yok</div>
            ) : (
              filtered.map((p) => {
                const count = p.optionSummary?.optionCount ?? p.optionGroups?.flatMap((g) => g.options).length ?? 0;
                const gCount = p.optionSummary?.groupCount ?? p.optionGroups?.length ?? 0;
                const active = p.id === selectedId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`pv-product${active ? ' is-active' : ''}`}
                    onClick={() => {
                      if (dirty && selectedId !== p.id) {
                        if (!confirm('Kaydedilmemiş değişiklikler var. Yine de geçilsin mi?')) return;
                      }
                      setSelectedId(p.id);
                    }}
                  >
                    <div className="pv-product__main">
                      <strong>{p.name || `Ürün #${p.id}`}</strong>
                      <span>
                        {p.groupName || 'Grup yok'} · {formatMoney(p.price)}
                      </span>
                    </div>
                    {gCount > 0 ? (
                      <em className="pv-product__badge">
                        {gCount} grup · {count} seçenek
                      </em>
                    ) : (
                      <em className="pv-product__badge pv-product__badge--muted">Yok</em>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <main className="pv-editor">
          {!selected ? (
            <div className="pv-hero-empty">
              <Layers3 className="w-10 h-10" />
              <h2>Ürün seç</h2>
              <p>Soldan bir ürün seç; tek seçim veya miktarlı ekstra grupları ekle.</p>
            </div>
          ) : (
            <>
              <div className="pv-editor-head">
                <div>
                  <p className="pv-kicker">Seçili ürün</p>
                  <h2>{selected.name}</h2>
                  <p className="pv-sub">
                    Tabana {formatMoney(selected.price)} · Masa görünümünde sipariş eklerken bu
                    seçenekler çıkar
                  </p>
                </div>
                <div className="pv-add-row">
                  <button type="button" className="pv-btn" onClick={() => addGroup('single')}>
                    <CircleDot className="w-4 h-4" />
                    Tek seçim
                  </button>
                  <button type="button" className="pv-btn" onClick={() => addGroup('multi')}>
                    <ListChecks className="w-4 h-4" />
                    Ekstra + miktar
                  </button>
                </div>
              </div>

              <div className="pv-hint">
                <strong>Tek seçim</strong> — makarna türü gibi kırılma; fiyat genelde ürün fiyatının
                yerine geçer.
                <br />
                <strong>Ekstra + miktar</strong> — ekstra et ×2 gibi; her adet birim fiyatı ekler.
              </div>

              {groups.length === 0 ? (
                <div className="pv-hero-empty pv-hero-empty--soft">
                  <p>Henüz seçenek yok. Yukarıdan grup ekle.</p>
                </div>
              ) : (
                <div className="pv-groups admin-scroll">
                  {groups.map((g, gi) => (
                    <section key={g.id} className="pv-group">
                      <div className="pv-group__bar">
                        <input
                          className="pv-group__title"
                          value={g.name}
                          onChange={(e) => {
                            const next = [...groups];
                            next[gi] = { ...g, name: e.target.value };
                            updateGroups(next);
                          }}
                          placeholder="Grup adı"
                        />
                        <select
                          value={g.type}
                          onChange={(e) => {
                            const type = e.target.value as 'single' | 'multi';
                            const next = [...groups];
                            next[gi] = {
                              ...g,
                              type,
                              pricing: type === 'single' ? 'replace' : 'add',
                              required: type === 'single' ? true : g.required,
                            };
                            updateGroups(next);
                          }}
                        >
                          <option value="single">Tek seçim</option>
                          <option value="multi">Çoklu + miktar</option>
                        </select>
                        <select
                          value={g.pricing}
                          onChange={(e) => {
                            const next = [...groups];
                            next[gi] = {
                              ...g,
                              pricing: e.target.value as 'replace' | 'add',
                            };
                            updateGroups(next);
                          }}
                        >
                          <option value="replace">Fiyatı değiştir</option>
                          <option value="add">Fiyata ekle</option>
                        </select>
                        <label className="pv-check">
                          <input
                            type="checkbox"
                            checked={g.required}
                            onChange={(e) => {
                              const next = [...groups];
                              next[gi] = { ...g, required: e.target.checked };
                              updateGroups(next);
                            }}
                          />
                          Zorunlu
                        </label>
                        <button
                          type="button"
                          className="pv-icon-danger"
                          title="Grubu sil"
                          onClick={() => updateGroups(groups.filter((_, i) => i !== gi))}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="pv-options">
                        {g.options.map((o, oi) => (
                          <div key={o.id} className="pv-option">
                            <input
                              value={o.name}
                              placeholder="Seçenek adı"
                              onChange={(e) => {
                                const next = [...groups];
                                const opts = [...g.options];
                                opts[oi] = { ...o, name: e.target.value };
                                next[gi] = { ...g, options: opts };
                                updateGroups(next);
                              }}
                            />
                            <div className="pv-option__price">
                              <span>₺</span>
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={o.price}
                                onChange={(e) => {
                                  const next = [...groups];
                                  const opts = [...g.options];
                                  opts[oi] = { ...o, price: Number(e.target.value) || 0 };
                                  next[gi] = { ...g, options: opts };
                                  updateGroups(next);
                                }}
                              />
                            </div>
                            <label className="pv-check">
                              <input
                                type="checkbox"
                                checked={o.isActive}
                                onChange={(e) => {
                                  const next = [...groups];
                                  const opts = [...g.options];
                                  opts[oi] = { ...o, isActive: e.target.checked };
                                  next[gi] = { ...g, options: opts };
                                  updateGroups(next);
                                }}
                              />
                              Aktif
                            </label>
                            <button
                              type="button"
                              className="pv-icon-danger"
                              onClick={() => {
                                const next = [...groups];
                                next[gi] = {
                                  ...g,
                                  options: g.options.filter((_, i) => i !== oi),
                                };
                                updateGroups(next);
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="pv-add-opt"
                          onClick={() => {
                            const next = [...groups];
                            next[gi] = {
                              ...g,
                              options: [
                                ...g.options,
                                emptyOption({
                                  name: '',
                                  price: g.pricing === 'replace' ? selected.price : 0,
                                }),
                              ],
                            };
                            updateGroups(next);
                          }}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Seçenek ekle
                        </button>
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
