import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  BookOpen,
} from 'lucide-react';
import { api, formatMoney } from '@/lib/api';
import { adminPath } from '@/lib/adminPath';
import {
  emptyGroup,
  emptyOption,
  type ProductOption,
  type ProductOptionGroup,
} from '@/lib/productOptions';
import {
  ProductVariantsGuideOverlay,
  VARIANT_GUIDE_STEPS,
  guideDemoPhase,
} from '@/pages/admin/ProductVariantsGuide';
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

type GuideSnapshot = {
  selectedId: number | null;
  groups: ProductOptionGroup[];
  dirty: boolean;
};

function normalizeLoadedGroups(raw: ProductOptionGroup[] | undefined): ProductOptionGroup[] {
  return (raw || []).map((g, i) => ({
    ...g,
    sortOrder: i,
    maxTotalQty: g.type === 'multi' ? Math.max(0, Number(g.maxTotalQty) || 0) : 0,
    options: (g.options || []).map((o, j) => ({
      ...o,
      sortOrder: j,
      excludesOptionIds: Array.isArray(o.excludesOptionIds) ? o.excludesOptionIds : [],
      limitsMultiMaxTotalQty: Math.max(0, Number(o.limitsMultiMaxTotalQty) || 0),
    })),
  }));
}

/** Rehber örneği — sabit id’ler (adımlar arası flicker olmasın) */
function buildDemoGroups(
  basePrice: number,
  phase: ReturnType<typeof guideDemoPhase>
): ProductOptionGroup[] {
  if (phase === 'empty') return [];

  const withLimits = phase === 'boy-limits' || phase === 'full' || phase === 'full-exclude';
  const buyuk = emptyOption({
    id: 'demo_opt_buyuk',
    name: 'Büyük',
    price: basePrice,
    limitsMultiMaxTotalQty: withLimits ? 5 : 0,
  });
  const mega = emptyOption({
    id: 'demo_opt_mega',
    name: 'Mega',
    price: Math.round((basePrice + 40) * 100) / 100,
    limitsMultiMaxTotalQty: withLimits ? 7 : 0,
  });
  const boy = emptyGroup({
    id: 'demo_grp_boy',
    type: 'single',
    pricing: 'replace',
    required: true,
    name: 'Boy',
    options: [buyuk, mega],
  });

  if (phase === 'boy' || phase === 'boy-limits') return [boy];

  const mantar = emptyOption({ id: 'demo_opt_mantar', name: 'Mantar', price: 10 });
  const sucuk = emptyOption({ id: 'demo_opt_sucuk', name: 'Sucuk', price: 15 });
  const cocuk = emptyOption({ id: 'demo_opt_cocuk', name: 'Çocuk porsiyonu', price: 0 });
  const acili = emptyOption({
    id: 'demo_opt_acili',
    name: 'Acılı',
    price: 0,
    excludesOptionIds: phase === 'full-exclude' ? [cocuk.id] : [],
  });

  const extras = emptyGroup({
    id: 'demo_grp_extras',
    type: 'multi',
    pricing: 'add',
    required: false,
    name: 'Ekstralar',
    maxTotalQty: 0,
    options: [mantar, sucuk, acili, cocuk],
  });

  return [boy, extras];
}

function allOptionsFlat(groups: ProductOptionGroup[], exceptId?: string) {
  return groups.flatMap((g) =>
    g.options
      .filter((o) => o.id !== exceptId && o.name.trim())
      .map((o) => ({ ...o, groupName: g.name || 'Grup' }))
  );
}

function toggleExclude(opt: ProductOption, targetId: string): string[] {
  const set = new Set(opt.excludesOptionIds || []);
  if (set.has(targetId)) set.delete(targetId);
  else set.add(targetId);
  return [...set];
}

export default function ProductVariantsPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [groups, setGroups] = useState<ProductOptionGroup[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  const guideSnapshot = useRef<GuideSnapshot | null>(null);

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
    if (guideOpen) return;
    if (!selected) {
      setGroups([]);
      setDirty(false);
      return;
    }
    setGroups(normalizeLoadedGroups(selected.optionGroups));
    setDirty(false);
    setMessage(null);
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps -- reset editor when product changes

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      const key = (p.groupName || '').trim() || 'Diğer';
      map.set(key, (map.get(key) || 0) + 1);
    }
    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }, [products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const gName = (p.groupName || '').trim() || 'Diğer';
      if (category !== 'all' && gName !== category) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        gName.toLowerCase().includes(q)
      );
    });
  }, [products, query, category]);

  function updateGroups(next: ProductOptionGroup[]) {
    if (guideOpen) return;
    setGroups(next);
    setDirty(true);
    setMessage(null);
  }

  function applyGuideStep(index: number, productId: number | null, price: number) {
    const step = VARIANT_GUIDE_STEPS[index];
    const phase = guideDemoPhase(step?.id || 'welcome');
    setGuideStep(index);
    if (phase === 'empty') {
      if (step?.id === 'pick' && productId) setSelectedId(productId);
      setGroups([]);
      return;
    }
    setGroups(buildDemoGroups(price, phase));
    window.requestAnimationFrame(() => {
      const target = step?.target;
      if (!target) return;
      document
        .querySelector(`[data-tour="${target}"]`)
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }

  function startGuide() {
    if (saving) return;
    if (dirty && !guideOpen) {
      if (!confirm('Kaydedilmemiş değişiklikler var. Rehber örneği geçici olarak gösterir; bitince eski haline döner. Devam?')) {
        return;
      }
    }
    const pickId = selectedId || products[0]?.id || null;
    if (!pickId) {
      alert('Rehber için önce en az bir ürün olmalı.');
      return;
    }
    const product = products.find((p) => p.id === pickId) || products[0];
    guideSnapshot.current = {
      selectedId,
      groups: groups.map((g) => ({
        ...g,
        options: g.options.map((o) => ({ ...o, excludesOptionIds: [...(o.excludesOptionIds || [])] })),
      })),
      dirty,
    };
    setSelectedId(product.id);
    setDirty(false);
    setMessage(null);
    setGuideOpen(true);
    applyGuideStep(0, product.id, product.price);
  }

  function stopGuide() {
    const snap = guideSnapshot.current;
    setGuideOpen(false);
    setGuideStep(0);
    guideSnapshot.current = null;
    if (snap) {
      setSelectedId(snap.selectedId);
      setGroups(snap.groups);
      setDirty(snap.dirty);
    }
    setMessage(null);
  }

  function guidePrev() {
    if (guideStep <= 0) return;
    const next = guideStep - 1;
    const product = selected || products[0];
    applyGuideStep(next, product?.id || null, product?.price || 0);
  }

  function guideNext() {
    if (guideStep >= VARIANT_GUIDE_STEPS.length - 1) {
      stopGuide();
      return;
    }
    const next = guideStep + 1;
    const product = selected || products[0];
    applyGuideStep(next, product?.id || null, product?.price || 0);
  }

  async function handleSave() {
    if (!selected) return;
    if (guideOpen) {
      alert('Rehber açıkken kaydedilmez. Bitir veya kapat.');
      return;
    }
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
          {guideOpen ? (
            <span className="pv-toast pv-toast--guide">Örnek gösteriliyor · kaydedilmez</span>
          ) : null}
          <button
            type="button"
            className={`pv-btn pv-btn--ghost${guideOpen ? ' is-active' : ''}`}
            onClick={() => (guideOpen ? stopGuide() : startGuide())}
          >
            <BookOpen className="w-4 h-4" />
            {guideOpen ? 'Rehberi kapat' : 'Rehber'}
          </button>
          <button
            type="button"
            className="pv-btn pv-btn--primary"
            data-tour="pv-save"
            disabled={!selected || !dirty || saving || guideOpen}
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
          <div className="pv-cats" role="tablist" aria-label="Kategoriler">
            <button
              type="button"
              role="tab"
              aria-selected={category === 'all'}
              className={`pv-cat${category === 'all' ? ' is-active' : ''}`}
              onClick={() => setCategory('all')}
            >
              Tümü
              <em>{products.length}</em>
            </button>
            {categories.map((c) => (
              <button
                key={c.name}
                type="button"
                role="tab"
                aria-selected={category === c.name}
                className={`pv-cat${category === c.name ? ' is-active' : ''}`}
                onClick={() => setCategory(c.name)}
              >
                <span>{c.name}</span>
                <em>{c.count}</em>
              </button>
            ))}
          </div>
          <div className="pv-list admin-scroll" data-tour="pv-list">
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
                    disabled={guideOpen}
                    onClick={() => {
                      if (guideOpen) return;
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
                  <button
                    type="button"
                    className="pv-btn"
                    data-tour="pv-add-single"
                    disabled={guideOpen}
                    onClick={() => addGroup('single')}
                  >
                    <CircleDot className="w-4 h-4" />
                    Tek seçim
                  </button>
                  <button
                    type="button"
                    className="pv-btn"
                    data-tour="pv-add-multi"
                    disabled={guideOpen}
                    onClick={() => addGroup('multi')}
                  >
                    <ListChecks className="w-4 h-4" />
                    Ekstra + miktar
                  </button>
                </div>
              </div>

              {guideOpen ? (
                <div className="pv-demo-banner">
                  Rehber örneği — pizza boy + ekstra senaryosu. Kaydetmezsen kaybolur.
                </div>
              ) : (
                <div className="pv-hint">
                  <strong>Tek seçim</strong> — boy / tür. İstersen her boya ayrı ekstra limiti koy
                  (Büyük 5, Mega 7).
                  <br />
                  <strong>Ekstra</strong> — miktarlı ekler; grupta genel maks veya türe göre limit.
                  “A seçilince B gizlensin” chip’leriyle sade koşul.
                </div>
              )}

              {groups.length === 0 ? (
                <div className="pv-hero-empty pv-hero-empty--soft">
                  <p>
                    {guideOpen
                      ? 'İleri’ye bas; örnek gruplar adım adım eklenecek.'
                      : 'Henüz seçenek yok. Yukarıdan grup ekle.'}
                  </p>
                </div>
              ) : (
                <div className="pv-groups admin-scroll" data-tour="pv-groups">
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
                              maxTotalQty: type === 'multi' ? g.maxTotalQty : 0,
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
                        {g.type === 'multi' ? (
                          <div className="pv-max-group" title="Bu gruptaki toplam ekstra üst sınırı">
                            <span className="pv-max-group__label">Maks</span>
                            <label
                              className={`pv-max-group__field${!(g.maxTotalQty > 0) ? ' is-empty' : ''}`}
                            >
                              <input
                                type="number"
                                min={0}
                                max={99}
                                value={g.maxTotalQty > 0 ? g.maxTotalQty : ''}
                                aria-label="Maksimum ekstra adet"
                                onChange={(e) => {
                                  const raw = e.target.value.trim();
                                  const v =
                                    raw === ''
                                      ? 0
                                      : Math.max(0, Math.min(99, Math.floor(Number(raw) || 0)));
                                  const next = [...groups];
                                  next[gi] = { ...g, maxTotalQty: v };
                                  updateGroups(next);
                                }}
                              />
                              {!(g.maxTotalQty > 0) ? (
                                <span className="pv-max-group__hint" aria-hidden>
                                  <b>∞</b>
                                  <i>sınırsız</i>
                                </span>
                              ) : null}
                            </label>
                          </div>
                        ) : null}
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
                        {g.options.map((o, oi) => {
                          const others = allOptionsFlat(groups, o.id);
                          const showTypeMax =
                            g.type === 'single' && groups.some((x) => x.type === 'multi');
                          return (
                            <div key={o.id} className="pv-option-card">
                              <div
                                className={`pv-option${showTypeMax ? ' pv-option--type-max' : ''}`}
                              >
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
                                {showTypeMax ? (
                                  <div
                                    className="pv-max-group pv-max-group--opt"
                                    title="Bu boy/tür seçilince ekstra üst sınırı"
                                  >
                                    <span className="pv-max-group__label">Ekstra</span>
                                    <label
                                      className={`pv-max-group__field${
                                        !(o.limitsMultiMaxTotalQty > 0) ? ' is-empty' : ''
                                      }`}
                                    >
                                      <input
                                        type="number"
                                        min={0}
                                        max={99}
                                        value={
                                          o.limitsMultiMaxTotalQty > 0
                                            ? o.limitsMultiMaxTotalQty
                                            : ''
                                        }
                                        aria-label={`${o.name || 'Seçenek'} ekstra maksimum`}
                                        onChange={(e) => {
                                          const raw = e.target.value.trim();
                                          const v =
                                            raw === ''
                                              ? 0
                                              : Math.max(
                                                  0,
                                                  Math.min(99, Math.floor(Number(raw) || 0))
                                                );
                                          const next = [...groups];
                                          const opts = [...g.options];
                                          opts[oi] = { ...o, limitsMultiMaxTotalQty: v };
                                          next[gi] = { ...g, options: opts };
                                          updateGroups(next);
                                        }}
                                      />
                                      {!(o.limitsMultiMaxTotalQty > 0) ? (
                                        <span className="pv-max-group__hint" aria-hidden>
                                          <b>∞</b>
                                        </span>
                                      ) : null}
                                    </label>
                                  </div>
                                ) : null}
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

                              {others.length > 0 && o.name.trim() ? (
                                <div className="pv-exclude">
                                  <p>
                                    <strong>{o.name || 'Bu seçenek'}</strong> seçilince gizle
                                  </p>
                                  <div className="pv-exclude__chips">
                                    {others.map((other) => {
                                      const on = (o.excludesOptionIds || []).includes(other.id);
                                      return (
                                        <button
                                          key={other.id}
                                          type="button"
                                          className={`pv-exclude__chip${on ? ' is-on' : ''}`}
                                          onClick={() => {
                                            const next = [...groups];
                                            const opts = [...g.options];
                                            opts[oi] = {
                                              ...o,
                                              excludesOptionIds: toggleExclude(o, other.id),
                                            };
                                            next[gi] = { ...g, options: opts };
                                            updateGroups(next);
                                          }}
                                        >
                                          {other.name}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
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

      <ProductVariantsGuideOverlay
        open={guideOpen}
        stepIndex={guideStep}
        onClose={stopGuide}
        onPrev={guidePrev}
        onNext={guideNext}
      />
    </div>
  );
}
