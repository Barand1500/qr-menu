import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
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
  TextCursorInput,
  Copy,
  ClipboardPaste,
  X,
  SlidersHorizontal,
  Tag,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { api, imageUrl } from '@/lib/api';
import { adminPath } from '@/lib/adminPath';
import MenuMediaPlaceholder from '@/components/public/MenuMediaPlaceholder';
import {
  emptyGroup,
  emptyOption,
  newOptionId,
  type OptionGroupType,
  type ProductOption,
  type ProductOptionGroup,
} from '@/lib/productOptions';
import ProductVariantsWizard from '@/pages/admin/ProductVariantsWizard';
import ProductVariantsKanban from '@/pages/admin/ProductVariantsKanban';
import {
  animateCopySuck,
  animatePasteBurst,
  waitForGroupCards,
} from '@/lib/productVariantsFly';
import {
  PV_LAYOUTS,
  cycleProductVariantsLayout,
  loadProductVariantsLayout,
  type ProductVariantsLayout,
} from '@/lib/productVariantsLayout';
import '@/product-variants.css';

type ProductRow = {
  id: number;
  name: string;
  groupName: string;
  price: number;
  isActive: boolean;
  imageUrl?: string | null;
  optionGroups?: ProductOptionGroup[];
  optionSummary?: { groupCount: number; optionCount: number };
};

type OptionsClipboard = {
  fromId: number;
  fromName: string;
  groups: ProductOptionGroup[];
};

function cloneOptionGroups(groups: ProductOptionGroup[]): ProductOptionGroup[] {
  const idMap = new Map<string, string>();
  for (const g of groups) {
    idMap.set(g.id, newOptionId('grp'));
    for (const o of g.options) idMap.set(o.id, newOptionId('opt'));
  }
  return groups.map((g, gi) => ({
    ...g,
    id: idMap.get(g.id) || newOptionId('grp'),
    sortOrder: gi,
    maxTotalQty: g.type === 'multi' ? Math.max(0, Number(g.maxTotalQty) || 0) : 0,
    options: g.options.map((o, oi) => ({
      ...o,
      id: idMap.get(o.id) || newOptionId('opt'),
      sortOrder: oi,
      excludesOptionIds: (o.excludesOptionIds || [])
        .map((id) => idMap.get(id))
        .filter((id): id is string => Boolean(id)),
      limitsMultiMaxTotalQty: Math.max(0, Number(o.limitsMultiMaxTotalQty) || 0),
    })),
  }));
}

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

function typeLabel(type: OptionGroupType) {
  if (type === 'single') return 'Tek seçim';
  if (type === 'multi') return 'Çoklu seçim';
  return 'İstek';
}

function TypeIcon({ type }: { type: OptionGroupType }) {
  if (type === 'single') return <CircleDot className="w-4 h-4" />;
  if (type === 'multi') return <ListChecks className="w-4 h-4" />;
  return <TextCursorInput className="w-4 h-4" />;
}

function productCounts(p: ProductRow, liveGroups?: ProductOptionGroup[]) {
  if (liveGroups) {
    return {
      gCount: liveGroups.length,
      oCount: liveGroups.reduce((n, g) => n + g.options.length, 0),
    };
  }
  return {
    gCount: p.optionSummary?.groupCount ?? p.optionGroups?.length ?? 0,
    oCount:
      p.optionSummary?.optionCount ??
      p.optionGroups?.flatMap((g) => g.options).length ??
      0,
  };
}

export default function ProductVariantsPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [layout, setLayout] = useState<ProductVariantsLayout>(() => loadProductVariantsLayout());
  const [view, setView] = useState<'gallery' | 'editor'>('gallery');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [groups, setGroups] = useState<ProductOptionGroup[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<OptionsClipboard | null>(null);
  const [pasteBusyId, setPasteBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ data: ProductRow[] }>('/api/admin/products?limit=500');
      setProducts(res.data || []);
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
      if (layout === 'wizard' || layout === 'kanban' || view === 'editor') {
        setGroups([]);
        setDirty(false);
      }
      return;
    }
    // Galeri: sadece editördeyken yükle; sihirbaz/kanban: ürün seçilince yükle
    if (layout === 'gallery' && view !== 'editor') return;
    setGroups(normalizeLoadedGroups(selected.optionGroups));
    setDirty(false);
    setRulesOpen(false);
  }, [selectedId, view, layout]); // eslint-disable-line react-hooks/exhaustive-deps -- reset editor when product/view/layout changes

  useEffect(() => {
    if (!groups.length) {
      setActiveGroupId(null);
      return;
    }
    if (!activeGroupId || !groups.some((g) => g.id === activeGroupId)) {
      setActiveGroupId(groups[0].id);
    }
  }, [groups, activeGroupId]);

  const activeGroup = useMemo(
    () => groups.find((g) => g.id === activeGroupId) || null,
    [groups, activeGroupId]
  );

  const activeGroupIndex = useMemo(
    () => groups.findIndex((g) => g.id === activeGroupId),
    [groups, activeGroupId]
  );

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
      return p.name.toLowerCase().includes(q) || gName.toLowerCase().includes(q);
    });
  }, [products, query, category]);

  function updateGroups(next: ProductOptionGroup[]) {
    setGroups(next);
    setDirty(true);
    setMessage(null);
  }

  function patchActiveGroup(patch: Partial<ProductOptionGroup>) {
    if (activeGroupIndex < 0) return;
    const next = [...groups];
    next[activeGroupIndex] = { ...next[activeGroupIndex], ...patch };
    updateGroups(next);
  }

  function patchActiveOption(oi: number, patch: Partial<ProductOption>) {
    if (activeGroupIndex < 0) return;
    const g = groups[activeGroupIndex];
    const opts = [...g.options];
    opts[oi] = { ...opts[oi], ...patch };
    patchActiveGroup({ options: opts });
  }

  function openProduct(p: ProductRow) {
    if (
      dirty &&
      selectedId !== p.id &&
      (view === 'editor' || layout === 'wizard' || layout === 'kanban')
    ) {
      if (!confirm('Kaydedilmemiş değişiklikler var. Yine de geçilsin mi?')) return;
    }
    setSelectedId(p.id);
    if (layout === 'gallery') {
      setView('editor');
      setRulesOpen(false);
    }
  }

  function cycleLayout(dir: -1 | 1) {
    if (dirty) {
      if (!confirm('Kaydedilmemiş değişiklikler var. Tasarım değiştirilsin mi?')) return;
    }
    setLayout((prev) => {
      const next = cycleProductVariantsLayout(prev, dir);
      setView('gallery');
      setRulesOpen(false);
      setDirty(false);
      setMessage('Sadece sayfa tasarımı değişti — istediğiniz görünümü seçebilirsiniz.');
      return next;
    });
  }

  function backToGallery() {
    if (dirty) {
      if (!confirm('Kaydedilmemiş değişiklikler var. Galeriye dönülsün mü?')) return;
    }
    setView('gallery');
    setRulesOpen(false);
    setDirty(false);
    setSelectedId(null);
    setGroups([]);
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
      setGroups(normalizeLoadedGroups(updated.optionGroups) || cleaned);
      setDirty(false);
      setMessage('Seçenekler kaydedildi');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }

  async function handleCopyOptions(p: ProductRow, e?: MouseEvent) {
    e?.stopPropagation();
    e?.preventDefault();
    if (clipboard?.fromId === p.id) {
      setClipboard(null);
      setMessage(null);
      return;
    }
    const useLive =
      p.id === selectedId &&
      (view === 'editor' || layout === 'wizard' || layout === 'kanban');
    const sourceGroups = useLive ? groups : normalizeLoadedGroups(p.optionGroups);
    if (!sourceGroups.length) {
      alert('Bu üründe kopyalanacak seçenek yok.');
      return;
    }

    if (view === 'editor' && selectedId === p.id) {
      const icon = document.querySelector<HTMLElement>(`[data-clip-id="${p.id}"]`);
      await animateCopySuck(icon);
    } else {
      const icon = document.querySelector<HTMLElement>(`[data-clip-id="${p.id}"]`);
      if (icon) await animateCopySuck(icon);
    }

    setClipboard({
      fromId: p.id,
      fromName: p.name || `Ürün #${p.id}`,
      groups: cloneOptionGroups(sourceGroups),
    });
    setMessage(`“${p.name || p.id}” seçenekleri kopyalandı`);
  }

  async function handlePasteOptions(p: ProductRow, e?: MouseEvent) {
    e?.stopPropagation();
    e?.preventDefault();
    if (!clipboard || clipboard.fromId === p.id || pasteBusyId) return;
    const targetCount = p.optionSummary?.groupCount ?? p.optionGroups?.length ?? 0;
    if (targetCount > 0) {
      if (!confirm(`“${p.name}” ürününde zaten seçenek var. Üzerine yazılsın mı?`)) {
        return;
      }
    }
    const payload = cloneOptionGroups(clipboard.groups);
    const pasteIcon = document.querySelector<HTMLElement>(`[data-paste-id="${p.id}"]`);
    setPasteBusyId(p.id);
    try {
      const updated = await api<ProductRow>(`/api/admin/products/${p.id}/option-groups`, {
        method: 'PUT',
        body: JSON.stringify({ groups: payload }),
      });
      setProducts((prev) =>
        prev.map((row) =>
          row.id === p.id
            ? {
                ...row,
                optionGroups: updated.optionGroups,
                optionSummary: updated.optionSummary,
              }
            : row
        )
      );
      setSelectedId(p.id);
      if (layout === 'gallery') setView('editor');
      const nextGroups = normalizeLoadedGroups(updated.optionGroups);
      setGroups(nextGroups);
      setActiveGroupId(nextGroups[0]?.id ?? null);
      setDirty(false);
      setMessage(`Seçenekler “${p.name}” ürününe yapıştırıldı`);

      const cards = await waitForGroupCards();
      const iconAfter =
        document.querySelector<HTMLElement>(`[data-paste-id="${p.id}"]`) || pasteIcon;
      await animatePasteBurst(iconAfter, cards);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Yapıştırılamadı');
    } finally {
      setPasteBusyId(null);
    }
  }

  function handleKanbanCopy() {
    if (!selected) return;
    void handleCopyOptions(selected);
  }

  function handleKanbanPaste() {
    if (!selected) return;
    void handlePasteOptions(selected);
  }

  function addGroup(type: OptionGroupType) {
    const defaults =
      type === 'single'
        ? { name: 'Tür seçimi', optName: 'Standart', price: selected?.price || 0, required: true }
        : type === 'choice'
          ? { name: 'İstekler', optName: 'Maydanoz olmasın', price: 0, required: false }
          : { name: 'Ekstralar', optName: 'Ekstra', price: 10, required: false };
    const g = emptyGroup({
      type,
      pricing: type === 'single' ? 'replace' : 'add',
      required: defaults.required,
      name: defaults.name,
      options: [emptyOption({ name: defaults.optName, price: defaults.price })],
    });
    updateGroups([...groups, g]);
    setActiveGroupId(g.id);
  }

  const showMultiLimits = groups.some((g) => g.type === 'multi');

  const pageModeClass =
    layout === 'gallery'
      ? view === 'editor'
        ? ' is-editor'
        : ' is-gallery'
      : layout === 'wizard'
        ? ' is-wizard'
        : ' is-kanban';

  return (
    <div className={`pv-page pv-page--${layout}${pageModeClass}`}>
      <header className="pv-top">
        {layout === 'gallery' && view === 'editor' ? (
          <button type="button" className="pv-back" onClick={backToGallery}>
            <ArrowLeft className="w-4 h-4" />
            Galeri
          </button>
        ) : (
          <Link to={adminPath('products')} className="pv-back" aria-label="Ürünlere dön">
            <ArrowLeft className="w-4 h-4" />
            Geri
          </Link>
        )}
        <div className="pv-brand">
          <div className="pv-brand__title">
            <button
              type="button"
              className="pv-skin-btn"
              aria-label="Önceki tasarım"
              title="Önceki tasarım"
              onClick={() => cycleLayout(-1)}
            >
              <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2.5} />
            </button>
            <p>
              {layout === 'wizard'
                ? 'Kurulum sihirbazı'
                : layout === 'kanban'
                  ? 'Kanban panosu'
                  : view === 'gallery'
                    ? 'Menü seçenekleri galerisi'
                    : 'Ürün düzenleyici'}
            </p>
            <button
              type="button"
              className="pv-skin-btn"
              aria-label="Sonraki tasarım"
              title="Sonraki tasarım"
              onClick={() => cycleLayout(1)}
            >
              <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
            </button>
            <span className="pv-skin-index" aria-hidden>
              {PV_LAYOUTS.indexOf(layout) + 1}/{PV_LAYOUTS.length}
            </span>
          </div>
          <strong>
            {layout === 'gallery' && view === 'editor' && selected
              ? selected.name || `Ürün #${selected.id}`
              : layout === 'wizard'
                ? 'Varyant & ekstra yönetimi'
                : 'Varyant & ekstra yönetimi'}
          </strong>
        </div>
        <div className="pv-top-actions">
          {message ? (
            <span className="pv-toast">
              <Check className="w-3.5 h-3.5" />
              {message}
            </span>
          ) : null}
          {clipboard ? (
            <span className="pv-toast pv-toast--clip">
              Kopya: {clipboard.fromName}
              <button
                type="button"
                className="pv-clip-clear"
                title="Kopyayı temizle"
                onClick={() => setClipboard(null)}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ) : null}
          {layout === 'gallery' && view === 'editor' ? (
            <button
              type="button"
              className="pv-btn pv-btn--primary"
              data-tour="pv-save"
              disabled={!selected || !dirty || saving}
              onClick={() => void handleSave()}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Kaydet
            </button>
          ) : null}
        </div>
      </header>

      {layout === 'wizard' ? (
        <ProductVariantsWizard
          products={products}
          filtered={filtered}
          loading={loading}
          query={query}
          category={category}
          categories={categories}
          onQuery={setQuery}
          onCategory={setCategory}
          selected={selected}
          selectedId={selectedId}
          onSelectProduct={(p) => openProduct(p as ProductRow)}
          groups={groups}
          activeGroupId={activeGroupId}
          onActiveGroupId={setActiveGroupId}
          onUpdateGroups={updateGroups}
          dirty={dirty}
          saving={saving}
          onSave={() => void handleSave()}
        />
      ) : layout === 'kanban' ? (
        <ProductVariantsKanban
          products={products}
          selected={selected}
          selectedId={selectedId}
          onSelectProduct={(p) => openProduct(p as ProductRow)}
          groups={groups}
          onUpdateGroups={updateGroups}
          dirty={dirty}
          saving={saving}
          onSave={() => void handleSave()}
          clipboard={
            clipboard
              ? { fromId: clipboard.fromId, fromName: clipboard.fromName }
              : null
          }
          onCopy={handleKanbanCopy}
          onPaste={handleKanbanPaste}
          onClearClipboard={() => setClipboard(null)}
          pasteBusy={pasteBusyId !== null}
        />
      ) : view === 'gallery' ? (
        <div className="pv-gallery" data-tour="pv-gallery">
          <div className="pv-gallery__toolbar">
            <div className="pv-search">
              <Search className="w-4 h-4" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                aria-label="Ürün ara"
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
                Hepsi
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
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="pv-empty-state">Yükleniyor…</div>
          ) : filtered.length === 0 ? (
            <div className="pv-empty-state">Ürün yok</div>
          ) : (
            <div className="pv-grid admin-scroll" data-tour="pv-list">
              {filtered.map((p) => {
                const { gCount, oCount } = productCounts(p);
                const isSource = clipboard?.fromId === p.id;
                const showPaste = Boolean(clipboard && !isSource);
                const canCopy = gCount > 0;
                return (
                  <article
                    key={p.id}
                    className={`pv-card${isSource ? ' is-clip-source' : ''}${showPaste ? ' has-paste' : ''}`}
                  >
                    <button
                      type="button"
                      className="pv-card__hit"
                      onClick={() => openProduct(p)}
                    >
                      <div className="pv-card__media">
                        {p.imageUrl ? (
                          <img src={imageUrl(p.imageUrl)} alt="" />
                        ) : (
                          <MenuMediaPlaceholder kind="product" size="lg" label={p.name} />
                        )}
                      </div>
                      <div className="pv-card__body">
                        <strong>{p.name || `Ürün #${p.id}`}</strong>
                        <span>{p.groupName || 'Grup yok'}</span>
                        <p className="pv-card__meta">
                          <Tag className="w-3.5 h-3.5" aria-hidden />
                          {gCount > 0
                            ? `${gCount} grup · ${oCount} seçenek`
                            : 'Henüz seçenek yok'}
                        </p>
                      </div>
                    </button>
                    <div className="pv-card__actions">
                      {showPaste ? (
                        <button
                          type="button"
                          className="pv-card__clip is-paste"
                          data-paste-id={p.id}
                          title={`“${clipboard!.fromName}” seçeneklerini yapıştır`}
                          disabled={pasteBusyId === p.id}
                          onClick={(e) => void handlePasteOptions(p, e)}
                        >
                          {pasteBusyId === p.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <ClipboardPaste className="w-3.5 h-3.5" />
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={`pv-card__clip${isSource ? ' is-source' : ''}`}
                          data-clip-id={p.id}
                          title={isSource ? 'Kopyayı iptal et' : 'Seçenekleri kopyala'}
                          disabled={!canCopy}
                          onClick={(e) => void handleCopyOptions(p, e)}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="pv-editor-shell">
          {!selected ? (
            <div className="pv-empty-state">
              <Layers3 className="w-10 h-10" />
              <p>Ürün seçilmedi</p>
              <button type="button" className="pv-btn" onClick={backToGallery}>
                Galeriye dön
              </button>
            </div>
          ) : (
            <div className="pv-editor">
              <aside className="pv-rail">
                <p className="pv-rail__label">Varyant grupları</p>
                <div className="pv-rail__list" data-tour="pv-groups">
                  {groups.length === 0 ? (
                    <p className="pv-rail__empty">Henüz grup yok</p>
                  ) : (
                    groups.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        className={`pv-group pv-rail__item${g.id === activeGroupId ? ' is-active' : ''}`}
                        onClick={() => setActiveGroupId(g.id)}
                      >
                        <TypeIcon type={g.type} />
                        <span>
                          <strong>{g.name.trim() || 'Adsız grup'}</strong>
                          <em>({typeLabel(g.type)})</em>
                        </span>
                      </button>
                    ))
                  )}
                </div>

                <div className="pv-rail__add" data-tour="pv-add-row">
                  <button
                    type="button"
                    className="pv-btn pv-btn--sm"
                    data-tour="pv-add-single"
                    onClick={() => addGroup('single')}
                  >
                    <CircleDot className="w-3.5 h-3.5" />
                    Tek seçim
                  </button>
                  <button
                    type="button"
                    className="pv-btn pv-btn--sm"
                    data-tour="pv-add-multi"
                    onClick={() => addGroup('multi')}
                  >
                    <ListChecks className="w-3.5 h-3.5" />
                    Ekstra
                  </button>
                  <button
                    type="button"
                    className="pv-btn pv-btn--sm"
                    data-tour="pv-add-choice"
                    onClick={() => addGroup('choice')}
                  >
                    <TextCursorInput className="w-3.5 h-3.5" />
                    İstek
                  </button>
                </div>

                <button
                  type="button"
                  className="pv-btn pv-btn--teal"
                  data-tour="pv-rules"
                  disabled={!activeGroup}
                  onClick={() => setRulesOpen(true)}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  Kurallar
                </button>
              </aside>

              <main className="pv-canvas">
                {!activeGroup ? (
                  <div className="pv-empty-state pv-empty-state--soft">
                    <p>Soldan grup ekle veya bir grup seç.</p>
                  </div>
                ) : (
                  <>
                    <header className="pv-canvas__head">
                      <div className="pv-canvas__title">
                        <TypeIcon type={activeGroup.type} />
                        <input
                          value={activeGroup.name}
                          onChange={(e) => patchActiveGroup({ name: e.target.value })}
                          placeholder="Grup adı"
                        />
                      </div>
                      <button
                        type="button"
                        className="pv-icon-danger"
                        title="Grubu sil"
                        onClick={() => {
                          const next = groups.filter((g) => g.id !== activeGroup.id);
                          updateGroups(next);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </header>

                    <ul className="pv-opt-list">
                      {activeGroup.options.map((o, oi) => (
                        <li key={o.id} className="pv-opt-row">
                          <input
                            className="pv-opt-row__name"
                            value={o.name}
                            placeholder={
                              activeGroup.type === 'choice'
                                ? 'Örn. Maydanoz olmasın'
                                : 'Seçenek adı'
                            }
                            onChange={(e) => patchActiveOption(oi, { name: e.target.value })}
                          />
                          <label className="pv-opt-row__price">
                            <span>+</span>
                            <input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              step="0.01"
                              value={o.price}
                              onChange={(e) =>
                                patchActiveOption(oi, { price: Number(e.target.value) || 0 })
                              }
                            />
                            <em>₺</em>
                          </label>
                          <label className="pv-switch" title="Aktif">
                            <input
                              type="checkbox"
                              checked={o.isActive}
                              onChange={(e) =>
                                patchActiveOption(oi, { isActive: e.target.checked })
                              }
                            />
                            <span />
                          </label>
                          <button
                            type="button"
                            className="pv-icon-danger"
                            onClick={() => {
                              patchActiveGroup({
                                options: activeGroup.options.filter((_, i) => i !== oi),
                              });
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      className="pv-add-opt"
                      onClick={() => {
                        patchActiveGroup({
                          options: [
                            ...activeGroup.options,
                            emptyOption({
                              name: '',
                              price:
                                activeGroup.pricing === 'replace' ? selected.price : 0,
                            }),
                          ],
                        });
                      }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Seçenek ekle
                    </button>

                    <div className="pv-canvas__foot">
                      <button
                        type="button"
                        className="pv-btn pv-btn--teal"
                        disabled={!activeGroup}
                        onClick={() => setRulesOpen(true)}
                      >
                        <SlidersHorizontal className="w-4 h-4" />
                        Kurallar
                      </button>
                      <p>
                        Zorunluluk, fiyat modu, maks. adet ve “seçilince gizle” kuralları burada.
                      </p>
                    </div>
                  </>
                )}
              </main>

              {rulesOpen && activeGroup && activeGroupIndex >= 0 ? (
                <div className="pv-rules" role="dialog" aria-modal="true" aria-label="Kurallar">
                  <button
                    type="button"
                    className="pv-rules__scrim"
                    aria-label="Kapat"
                    onClick={() => setRulesOpen(false)}
                  />
                  <div className="pv-rules__panel" data-tour="pv-rules-panel">
                    <header className="pv-rules__head">
                      <div>
                        <p>Kurallar</p>
                        <strong>{activeGroup.name.trim() || 'Adsız grup'}</strong>
                      </div>
                      <button
                        type="button"
                        className="pv-icon-btn"
                        onClick={() => setRulesOpen(false)}
                        aria-label="Kapat"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </header>

                    <div className="pv-rules__body admin-scroll">
                      <section className="pv-rules__section">
                        <h3>Grup ayarları</h3>
                        <label className="pv-field">
                          <span>Tip</span>
                          <select
                            value={activeGroup.type}
                            onChange={(e) => {
                              const type = e.target.value as OptionGroupType;
                              patchActiveGroup({
                                type,
                                pricing: type === 'single' ? 'replace' : 'add',
                                required: type === 'single' ? true : activeGroup.required,
                                maxTotalQty: type === 'multi' ? activeGroup.maxTotalQty : 0,
                              });
                            }}
                          >
                            <option value="single">Tek seçim</option>
                            <option value="multi">Çoklu + miktar</option>
                            <option value="choice">Çoklu seçim (istek)</option>
                          </select>
                        </label>
                        <label className="pv-field">
                          <span>Fiyat</span>
                          <select
                            value={activeGroup.pricing}
                            onChange={(e) =>
                              patchActiveGroup({
                                pricing: e.target.value as 'replace' | 'add',
                              })
                            }
                          >
                            <option value="replace">Fiyatı değiştir</option>
                            <option value="add">Fiyata ekle</option>
                          </select>
                        </label>
                        {activeGroup.type === 'multi' ? (
                          <label className="pv-field">
                            <span>Maks. ekstra adet (0 = sınırsız)</span>
                            <input
                              type="number"
                              min={0}
                              max={99}
                              value={activeGroup.maxTotalQty > 0 ? activeGroup.maxTotalQty : ''}
                              placeholder="∞"
                              onChange={(e) => {
                                const raw = e.target.value.trim();
                                const v =
                                  raw === ''
                                    ? 0
                                    : Math.max(0, Math.min(99, Math.floor(Number(raw) || 0)));
                                patchActiveGroup({ maxTotalQty: v });
                              }}
                            />
                          </label>
                        ) : null}
                        <label className="pv-check-row">
                          <input
                            type="checkbox"
                            checked={activeGroup.required}
                            onChange={(e) => patchActiveGroup({ required: e.target.checked })}
                          />
                          Zorunlu grup
                        </label>
                      </section>

                      {activeGroup.type === 'single' && showMultiLimits ? (
                        <section className="pv-rules__section">
                          <h3>Boy’a göre ekstra limiti</h3>
                          <p className="pv-rules__hint">
                            Bu seçenek seçilince ekstra gruplarına uygulanan üst sınır.
                          </p>
                          {activeGroup.options.map((o, oi) =>
                            o.name.trim() ? (
                              <label key={o.id} className="pv-field pv-field--inline">
                                <span>{o.name}</span>
                                <input
                                  type="number"
                                  min={0}
                                  max={99}
                                  value={
                                    o.limitsMultiMaxTotalQty > 0
                                      ? o.limitsMultiMaxTotalQty
                                      : ''
                                  }
                                  placeholder="∞"
                                  onChange={(e) => {
                                    const raw = e.target.value.trim();
                                    const v =
                                      raw === ''
                                        ? 0
                                        : Math.max(
                                            0,
                                            Math.min(99, Math.floor(Number(raw) || 0))
                                          );
                                    patchActiveOption(oi, { limitsMultiMaxTotalQty: v });
                                  }}
                                />
                              </label>
                            ) : null
                          )}
                        </section>
                      ) : null}

                      <section className="pv-rules__section">
                        <h3>Seçilince gizle</h3>
                        <p className="pv-rules__hint">
                          Bir seçenek işaretlenince listeden gizlenecek diğer seçenekler.
                        </p>
                        {activeGroup.options.map((o, oi) => {
                          const others = allOptionsFlat(groups, o.id);
                          if (!o.name.trim() || !others.length) return null;
                          return (
                            <div key={o.id} className="pv-exclude-block">
                              <p>
                                <strong>{o.name}</strong> seçilince gizle
                              </p>
                              <div className="pv-exclude__chips">
                                {others.map((other) => {
                                  const on = (o.excludesOptionIds || []).includes(other.id);
                                  return (
                                    <button
                                      key={other.id}
                                      type="button"
                                      className={`pv-exclude__chip${on ? ' is-on' : ''}`}
                                      onClick={() =>
                                        patchActiveOption(oi, {
                                          excludesOptionIds: toggleExclude(o, other.id),
                                        })
                                      }
                                    >
                                      {other.groupName !== (activeGroup.name || 'Grup')
                                        ? `${other.groupName}: ${other.name}`
                                        : other.name}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </section>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
