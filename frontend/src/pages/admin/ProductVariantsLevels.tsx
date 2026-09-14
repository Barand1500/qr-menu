import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { formatMoney, imageUrl } from '@/lib/api';
import MenuMediaPlaceholder from '@/components/public/MenuMediaPlaceholder';
import {
  emptyGroup,
  emptyOption,
  type ProductOption,
  type ProductOptionGroup,
} from '@/lib/productOptions';

type LevelsProduct = {
  id: number;
  name: string;
  groupName: string;
  price: number;
  imageUrl?: string | null;
};

type Category = { name: string; count: number };

type LevelKey = 'level1' | 'level2' | 'options';

type Props = {
  filtered: LevelsProduct[];
  loading: boolean;
  query: string;
  category: string;
  categories: Category[];
  onQuery: (q: string) => void;
  onCategory: (c: string) => void;
  selected: LevelsProduct | null;
  selectedId: number | null;
  onSelectProduct: (p: LevelsProduct) => void;
  onClearProduct: () => void;
  groups: ProductOptionGroup[];
  onUpdateGroups: (next: ProductOptionGroup[]) => void;
  dirty: boolean;
  saving: boolean;
  onSave: () => Promise<boolean>;
};

const STEPS: {
  key: LevelKey;
  title: string;
  hint: string;
  mode: string;
}[] = [
  {
    key: 'level1',
    title: '1. Seviye',
    hint: 'Tek seçim — örn. açık / kapalı çay',
    mode: 'Tek seçim',
  },
  {
    key: 'level2',
    title: '2. Seviye',
    hint: 'Tek seçim — örn. şekerli / şekersiz',
    mode: 'Tek seçim',
  },
  {
    key: 'options',
    title: 'Seçenekler',
    hint: 'Çoklu seçim — ekstra ne istenirse',
    mode: 'Çoklu seçim',
  },
];

const PRODUCTS_PER_PAGE = 6;
const CATS_PER_PAGE = 8;

function partitionGroups(groups: ProductOptionGroup[]) {
  const singles = groups
    .filter((g) => g.type === 'single')
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const extras = groups
    .filter((g) => g.type !== 'single')
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    level1: singles[0] || null,
    level2: singles[1] || null,
    leftoverSingles: singles.slice(2),
    extras,
  };
}

function rebuildGroups(
  level1: ProductOptionGroup | null,
  level2: ProductOptionGroup | null,
  extras: ProductOptionGroup[],
  leftoverSingles: ProductOptionGroup[] = []
) {
  return [level1, level2, ...leftoverSingles, ...extras]
    .filter((g): g is ProductOptionGroup => g != null)
    .map((g, i) => ({
      ...g,
      sortOrder: i,
    }));
}

function countNamed(opts: ProductOption[] | undefined) {
  return (opts || []).filter((o) => o.name.trim()).length;
}

/** Boş hayalet grubu state'e yazma — seçenek veya başlık yoksa at */
function keepGroup(
  g: ProductOptionGroup | null | undefined,
  existed: boolean
): ProductOptionGroup | null {
  if (!g) return null;
  if (existed) return g;
  if (g.options.length > 0 || g.name.trim()) return g;
  return null;
}

function OptionRows({
  options,
  namePlaceholder,
  pricing,
  onPatch,
  onRemove,
}: {
  options: ProductOption[];
  namePlaceholder: string;
  pricing: 'replace' | 'add';
  onPatch: (oi: number, patch: Partial<ProductOption>) => void;
  onRemove: (oi: number) => void;
}) {
  if (!options.length) {
    return (
      <div className="pv-levels__opt-empty">
        Henüz seçenek yok. Aşağıdan ekleyebilirsin.
      </div>
    );
  }

  return (
    <div className="pv-levels__opts">
      <div className="pv-levels__opt-head" aria-hidden>
        <span>Ad</span>
        <span>Fiyat</span>
        <span />
      </div>
      {options.map((o, oi) => (
        <div key={o.id} className="pv-levels__opt">
          <input
            value={o.name}
            onChange={(e) => onPatch(oi, { name: e.target.value })}
            placeholder={namePlaceholder}
          />
          <label
            className="pv-levels__price"
            title={pricing === 'replace' ? 'Fiyatı değiştir' : 'Fiyata ekle'}
          >
            {pricing === 'replace' ? (
              <RefreshCw className="w-3 h-3 pv-money__mode" aria-hidden />
            ) : (
              <Plus className="w-3.5 h-3.5 pv-money__mode" aria-hidden />
            )}
            <input
              type="number"
              step="0.01"
              value={o.price}
              onChange={(e) => onPatch(oi, { price: Number(e.target.value) || 0 })}
              aria-label="Fiyat"
            />
            <em>₺</em>
          </label>
          <button
            type="button"
            className="pv-levels__opt-del"
            onClick={() => onRemove(oi)}
            aria-label="Sil"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

export default function ProductVariantsLevels({
  filtered,
  loading,
  query,
  category,
  categories,
  onQuery,
  onCategory,
  selected,
  selectedId,
  onSelectProduct,
  onClearProduct,
  groups,
  onUpdateGroups,
  dirty,
  saving,
  onSave,
}: Props) {
  const [active, setActive] = useState<LevelKey>('level1');
  const [productPage, setProductPage] = useState(0);
  const [catPage, setCatPage] = useState(0);

  const parts = useMemo(() => partitionGroups(groups), [groups]);

  const catItems = useMemo(() => {
    const total = categories.reduce((n, c) => n + c.count, 0);
    return [
      { id: 'all' as const, name: 'Hepsi', count: total },
      ...categories.map((c) => ({ id: c.name, name: c.name, count: c.count })),
    ];
  }, [categories]);

  const catPageCount = Math.max(1, Math.ceil(catItems.length / CATS_PER_PAGE));
  const safeCatPage = Math.min(catPage, catPageCount - 1);
  const pagedCats = catItems.slice(
    safeCatPage * CATS_PER_PAGE,
    safeCatPage * CATS_PER_PAGE + CATS_PER_PAGE
  );

  const productPageCount = Math.max(1, Math.ceil(filtered.length / PRODUCTS_PER_PAGE));
  const safeProductPage = Math.min(productPage, productPageCount - 1);
  const pagedProducts = filtered.slice(
    safeProductPage * PRODUCTS_PER_PAGE,
    safeProductPage * PRODUCTS_PER_PAGE + PRODUCTS_PER_PAGE
  );

  useEffect(() => {
    if (!selectedId) setActive('level1');
  }, [selectedId]);

  useEffect(() => {
    setProductPage(0);
  }, [category, query]);

  useEffect(() => {
    setCatPage(0);
  }, [categories.length]);

  useEffect(() => {
    if (productPage > productPageCount - 1) setProductPage(Math.max(0, productPageCount - 1));
  }, [productPage, productPageCount]);

  useEffect(() => {
    if (catPage > catPageCount - 1) setCatPage(Math.max(0, catPageCount - 1));
  }, [catPage, catPageCount]);

  function ensureLevel1(): ProductOptionGroup {
    if (parts.level1) return parts.level1;
    return emptyGroup({
      type: 'single',
      name: '1. Seviye',
      pricing: 'replace',
      required: true,
      options: [],
    });
  }

  function ensureLevel2(): ProductOptionGroup {
    if (parts.level2) return parts.level2;
    return emptyGroup({
      type: 'single',
      name: '2. Seviye',
      pricing: 'replace',
      required: false,
      options: [],
    });
  }

  function ensurePrimaryExtra(): ProductOptionGroup {
    if (parts.extras[0]) return parts.extras[0];
    return emptyGroup({
      type: 'multi',
      name: 'Seçenekler',
      pricing: 'add',
      required: false,
      options: [],
    });
  }

  function commit(
    nextL1: ProductOptionGroup | null,
    nextL2: ProductOptionGroup | null,
    nextExtras: ProductOptionGroup[]
  ) {
    onUpdateGroups(
      rebuildGroups(
        keepGroup(nextL1, !!parts.level1),
        keepGroup(nextL2, !!parts.level2),
        nextExtras
          .map((g, i) => keepGroup(g, !!parts.extras[i]))
          .filter((g): g is ProductOptionGroup => g != null),
        parts.leftoverSingles
      )
    );
  }

  function patchLevel1(patch: Partial<ProductOptionGroup>) {
    commit({ ...ensureLevel1(), ...patch }, parts.level2, parts.extras);
  }

  function patchLevel2(patch: Partial<ProductOptionGroup>) {
    commit(parts.level1, { ...ensureLevel2(), ...patch }, parts.extras);
  }

  function patchExtra(gi: number, patch: Partial<ProductOptionGroup>) {
    if (parts.extras.length) {
      commit(
        parts.level1,
        parts.level2,
        parts.extras.map((g, i) => (i === gi ? { ...g, ...patch } : g))
      );
      return;
    }
    if (gi !== 0) return;
    commit(parts.level1, parts.level2, [{ ...ensurePrimaryExtra(), ...patch }]);
  }

  function patchOption(
    which: 'level1' | 'level2' | 'extra',
    oi: number,
    patch: Partial<ProductOption>,
    extraGi = 0
  ) {
    if (which === 'level1') {
      const g = ensureLevel1();
      patchLevel1({
        options: g.options.map((o, i) => (i === oi ? { ...o, ...patch } : o)),
      });
      return;
    }
    if (which === 'level2') {
      const g = ensureLevel2();
      patchLevel2({
        options: g.options.map((o, i) => (i === oi ? { ...o, ...patch } : o)),
      });
      return;
    }
    const base = parts.extras.length ? parts.extras : [ensurePrimaryExtra()];
    const g = base[extraGi];
    if (!g) return;
    patchExtra(extraGi, {
      options: g.options.map((o, i) => (i === oi ? { ...o, ...patch } : o)),
    });
  }

  function addOption(which: 'level1' | 'level2' | 'extra', extraGi = 0) {
    if (which === 'level1') {
      const g = ensureLevel1();
      patchLevel1({ options: [...g.options, emptyOption({ name: '' })] });
      setActive('level1');
      return;
    }
    if (which === 'level2') {
      const g = ensureLevel2();
      patchLevel2({ options: [...g.options, emptyOption({ name: '' })] });
      setActive('level2');
      return;
    }
    const base = parts.extras.length ? parts.extras : [ensurePrimaryExtra()];
    const idx = base[extraGi] ? extraGi : 0;
    const g = base[idx];
    patchExtra(idx, { options: [...g.options, emptyOption({ name: '' })] });
    setActive('options');
  }

  function removeOption(which: 'level1' | 'level2' | 'extra', oi: number, extraGi = 0) {
    if (which === 'level1') {
      const nextOpts = ensureLevel1().options.filter((_, i) => i !== oi);
      if (!nextOpts.length && parts.level1) {
        // Son seçenek silindi — grubu state'ten kaldır (kayıt engeli olmasın)
        commit(null, parts.level2, parts.extras);
        return;
      }
      patchLevel1({ options: nextOpts });
      return;
    }
    if (which === 'level2') {
      const nextOpts = ensureLevel2().options.filter((_, i) => i !== oi);
      if (!nextOpts.length && parts.level2) {
        commit(parts.level1, null, parts.extras);
        return;
      }
      patchLevel2({ options: nextOpts });
      return;
    }
    const base = parts.extras.length ? parts.extras : [];
    const g = base[extraGi];
    if (!g) return;
    const nextOpts = g.options.filter((_, i) => i !== oi);
    if (!nextOpts.length) {
      const extras = base.filter((_, i) => i !== extraGi);
      commit(parts.level1, parts.level2, extras);
      return;
    }
    patchExtra(extraGi, { options: nextOpts });
  }

  const level1 = parts.level1;
  const level2 = parts.level2;
  const primaryExtra = parts.extras[0] || null;

  const counts: Record<LevelKey, number> = {
    level1: countNamed(level1?.options),
    level2: countNamed(level2?.options),
    options: parts.extras.reduce((n, g) => n + countNamed(g.options), 0),
  };

  const stepMeta = STEPS.find((s) => s.key === active)!;

  if (!selected) {
    return (
      <div className="pv-levels is-picking">
        <header className="pv-levels__pick-head">
          <p className="pv-levels__eyebrow">Seviyeli kurulum</p>
          <h2>Ürün seç</h2>
        </header>

        <div className="pv-levels__split">
          <aside className="pv-levels__side">
            <label className="pv-levels__search">
              <Search className="w-4 h-4" />
              <input
                value={query}
                onChange={(e) => onQuery(e.target.value)}
                placeholder="Ürün ara…"
              />
            </label>
            <nav className="pv-levels__cats" aria-label="Gruplar">
              {pagedCats.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={category === c.id ? 'is-active' : ''}
                  onClick={() => onCategory(c.id)}
                >
                  <span>{c.name}</span>
                  <em>{c.count}</em>
                </button>
              ))}
            </nav>
            {catPageCount > 1 ? (
              <div className="pv-levels__pager">
                <button
                  type="button"
                  disabled={safeCatPage <= 0}
                  onClick={() => setCatPage((p) => Math.max(0, p - 1))}
                  aria-label="Önceki gruplar"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span>
                  {safeCatPage + 1} / {catPageCount}
                </span>
                <button
                  type="button"
                  disabled={safeCatPage >= catPageCount - 1}
                  onClick={() => setCatPage((p) => Math.min(catPageCount - 1, p + 1))}
                  aria-label="Sonraki gruplar"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ) : null}
          </aside>

          <section className="pv-levels__main">
            {loading ? (
              <div className="pv-levels__empty">
                <Loader2 className="w-5 h-5 animate-spin" />
                Yükleniyor…
              </div>
            ) : filtered.length === 0 ? (
              <div className="pv-levels__empty">Ürün bulunamadı.</div>
            ) : (
              <>
                <ul className="pv-levels__products">
                  {pagedProducts.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="pv-levels__product"
                        onClick={() => onSelectProduct(p)}
                      >
                        <span className="pv-levels__product-media">
                          {p.imageUrl ? (
                            <img src={imageUrl(p.imageUrl)} alt="" />
                          ) : (
                            <MenuMediaPlaceholder />
                          )}
                        </span>
                        <span className="pv-levels__product-meta">
                          <strong>{p.name}</strong>
                          <small>| {p.groupName || 'Grup yok'}</small>
                        </span>
                        <span className="pv-levels__product-price">
                          {formatMoney(p.price)}
                        </span>
                        <span className="pv-levels__product-go">
                          Devam
                          <ChevronRight className="w-4 h-4" />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {productPageCount > 1 ? (
                  <div className="pv-levels__pager pv-levels__pager--main">
                    <button
                      type="button"
                      disabled={safeProductPage <= 0}
                      onClick={() => setProductPage((p) => Math.max(0, p - 1))}
                      aria-label="Önceki ürünler"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span>
                      {safeProductPage + 1} / {productPageCount}
                    </span>
                    <button
                      type="button"
                      disabled={safeProductPage >= productPageCount - 1}
                      onClick={() =>
                        setProductPage((p) => Math.min(productPageCount - 1, p + 1))
                      }
                      aria-label="Sonraki ürünler"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </section>
        </div>
      </div>
    );
  }

  return (
      <div className="pv-levels">
      <div className="pv-levels__editor">
        <header className="pv-levels__hero">
          <span className="pv-levels__hero-media">
            {selected.imageUrl ? (
              <img src={imageUrl(selected.imageUrl)} alt="" />
            ) : (
              <MenuMediaPlaceholder />
            )}
          </span>
          <div className="pv-levels__hero-copy">
            <h2>{selected.name}</h2>
            <p>Grup: {selected.groupName || 'Grup yok'}</p>
            <strong className="pv-levels__hero-price">{formatMoney(selected.price)}</strong>
          </div>
          <button type="button" className="pv-levels__change" onClick={onClearProduct}>
            Ürünü değiştir
          </button>
        </header>

        <nav className="pv-levels__tabs" aria-label="Seviyeler">
          {STEPS.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`pv-levels__tab${active === s.key ? ' is-active' : ''}`}
              onClick={() => setActive(s.key)}
            >
              <span className="pv-levels__tab-title">{s.title}</span>
              <em>{counts[s.key]}</em>
            </button>
          ))}
        </nav>

        <div className="pv-levels__workspace">
          <section className="pv-levels__board">
            <header className="pv-levels__board-head">
              <div>
                <h3>{stepMeta.title}</h3>
                <p>{stepMeta.hint}</p>
              </div>
              <span className="pv-levels__mode">{stepMeta.mode}</span>
            </header>

            {active === 'level1' ? (
              <>
                <label className="pv-levels__field">
                  <span>Başlık</span>
                  <input
                    value={level1?.name ?? ''}
                    onChange={(e) => patchLevel1({ name: e.target.value })}
                    placeholder="1. Seviye"
                  />
                </label>
                <OptionRows
                  options={level1?.options || []}
                  namePlaceholder="Örn. Açık çay"
                  pricing={level1?.pricing === 'add' ? 'add' : 'replace'}
                  onPatch={(oi, patch) => patchOption('level1', oi, patch)}
                  onRemove={(oi) => removeOption('level1', oi)}
                />
                <button
                  type="button"
                  className="pv-levels__add"
                  onClick={() => addOption('level1')}
                >
                  <Plus className="w-4 h-4" />
                  Ekle
                </button>
              </>
            ) : null}

            {active === 'level2' ? (
              <>
                <label className="pv-levels__field">
                  <span>Başlık</span>
                  <input
                    value={level2?.name ?? ''}
                    onChange={(e) => patchLevel2({ name: e.target.value })}
                    placeholder="2. Seviye"
                  />
                </label>
                <OptionRows
                  options={level2?.options || []}
                  namePlaceholder="Örn. Şekerli"
                  pricing={level2?.pricing === 'add' ? 'add' : 'replace'}
                  onPatch={(oi, patch) => patchOption('level2', oi, patch)}
                  onRemove={(oi) => removeOption('level2', oi)}
                />
                <button
                  type="button"
                  className="pv-levels__add"
                  onClick={() => addOption('level2')}
                >
                  <Plus className="w-4 h-4" />
                  Ekle
                </button>
              </>
            ) : null}

            {active === 'options' ? (
              <>
                <label className="pv-levels__field">
                  <span>Başlık</span>
                  <input
                    value={primaryExtra?.name ?? ''}
                    onChange={(e) => patchExtra(0, { name: e.target.value })}
                    placeholder="Seçenekler"
                  />
                </label>
                <OptionRows
                  options={primaryExtra?.options || []}
                  namePlaceholder="Örn. Ekstra peynir"
                  pricing={primaryExtra?.pricing === 'replace' ? 'replace' : 'add'}
                  onPatch={(oi, patch) => patchOption('extra', oi, patch, 0)}
                  onRemove={(oi) => removeOption('extra', oi, 0)}
                />
                <button
                  type="button"
                  className="pv-levels__add"
                  onClick={() => addOption('extra', 0)}
                >
                  <Plus className="w-4 h-4" />
                  Ekle
                </button>
              </>
            ) : null}
          </section>

          <aside className="pv-levels__preview" aria-label="Önizleme">
            <div className="pv-levels__preview-card">
              <header className="pv-levels__preview-head">
                <p>Müşteri görünümü</p>
                <strong>{selected.name}</strong>
                <small>
                  {selected.groupName || 'Grup yok'} · {formatMoney(selected.price)}
                </small>
              </header>

              {(
                [
                  { key: 'level1' as const, g: level1, fallback: '1. Seviye' },
                  { key: 'level2' as const, g: level2, fallback: '2. Seviye' },
                  {
                    key: 'options' as const,
                    g: primaryExtra,
                    fallback: 'Seçenekler',
                  },
                ] as const
              ).map(({ key, g, fallback }) => {
                const named = (g?.options || []).filter((o) => o.name.trim());
                return (
                  <div
                    key={key}
                    className={`pv-levels__preview-block${
                      active === key ? ' is-focus' : ''
                    }`}
                  >
                    <span>{g?.name?.trim() || fallback}</span>
                    {named.length ? (
                      <div className="pv-levels__preview-chips">
                        {named.map((o, i) => (
                          <em
                            key={o.id}
                            className={active === key && i === 0 ? 'is-on' : undefined}
                          >
                            {o.name}
                            {o.price ? ` · ${formatMoney(o.price)}` : ''}
                          </em>
                        ))}
                      </div>
                    ) : (
                      <p className="pv-levels__preview-empty">Henüz seçenek yok</p>
                    )}
                  </div>
                );
              })}
            </div>
          </aside>
        </div>

        <div className="pv-levels__footer">
          <button
            type="button"
            className="pv-levels__save"
            disabled={!dirty || saving}
            onClick={() => void onSave()}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
          {dirty ? <span className="pv-levels__dirty">Kaydedilmemiş değişiklik var</span> : null}
        </div>
      </div>
    </div>
  );
}
