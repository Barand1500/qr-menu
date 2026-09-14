import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronRight,
  Layers,
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

export type LevelsProduct = {
  id: number;
  name: string;
  groupName: string;
  price: number;
  isActive?: boolean;
  imageUrl?: string | null;
  optionSummary?: { groupCount: number; optionCount: number };
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
  num: string;
  title: string;
  hint: string;
  mode: string;
}[] = [
  {
    key: 'level1',
    num: '01',
    title: '1. Seviye',
    hint: 'Tek seçim — örn. açık / kapalı çay',
    mode: 'Tek seçim',
  },
  {
    key: 'level2',
    num: '02',
    title: '2. Seviye',
    hint: 'Tek seçim — örn. şekerli / şekersiz',
    mode: 'Tek seçim',
  },
  {
    key: 'options',
    num: '03',
    title: 'Seçenekler',
    hint: 'Çoklu seçim — ekstra ne istenirse',
    mode: 'Çoklu seçim',
  },
];

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
  level1: ProductOptionGroup,
  level2: ProductOptionGroup,
  extras: ProductOptionGroup[],
  leftoverSingles: ProductOptionGroup[] = []
) {
  return [level1, level2, ...leftoverSingles, ...extras].map((g, i) => ({
    ...g,
    sortOrder: i,
  }));
}

function countNamed(opts: ProductOption[] | undefined) {
  return (opts || []).filter((o) => o.name.trim()).length;
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

  const parts = useMemo(() => partitionGroups(groups), [groups]);

  useEffect(() => {
    if (!selectedId) setActive('level1');
  }, [selectedId]);

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

  function ensureExtras(): ProductOptionGroup[] {
    if (parts.extras.length) return parts.extras;
    return [
      emptyGroup({
        type: 'multi',
        name: 'Seçenekler',
        pricing: 'add',
        required: false,
        options: [],
      }),
    ];
  }

  function commit(
    nextL1: ProductOptionGroup,
    nextL2: ProductOptionGroup,
    nextExtras: ProductOptionGroup[]
  ) {
    onUpdateGroups(rebuildGroups(nextL1, nextL2, nextExtras, parts.leftoverSingles));
  }

  function patchLevel1(patch: Partial<ProductOptionGroup>) {
    commit({ ...ensureLevel1(), ...patch }, ensureLevel2(), ensureExtras());
  }

  function patchLevel2(patch: Partial<ProductOptionGroup>) {
    commit(ensureLevel1(), { ...ensureLevel2(), ...patch }, ensureExtras());
  }

  function patchExtra(gi: number, patch: Partial<ProductOptionGroup>) {
    const extras = ensureExtras().map((g, i) => (i === gi ? { ...g, ...patch } : g));
    commit(ensureLevel1(), ensureLevel2(), extras);
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
    const extras = ensureExtras();
    const g = extras[extraGi];
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
    const extras = ensureExtras();
    const g = extras[extraGi] || extras[0];
    patchExtra(extraGi, { options: [...g.options, emptyOption({ name: '' })] });
    setActive('options');
  }

  function removeOption(which: 'level1' | 'level2' | 'extra', oi: number, extraGi = 0) {
    if (which === 'level1') {
      patchLevel1({ options: ensureLevel1().options.filter((_, i) => i !== oi) });
      return;
    }
    if (which === 'level2') {
      patchLevel2({ options: ensureLevel2().options.filter((_, i) => i !== oi) });
      return;
    }
    const g = ensureExtras()[extraGi];
    if (!g) return;
    patchExtra(extraGi, { options: g.options.filter((_, i) => i !== oi) });
  }

  const level1 = parts.level1;
  const level2 = parts.level2;
  const extras = parts.extras.length
    ? parts.extras
    : [
        emptyGroup({
          type: 'multi',
          name: 'Seçenekler',
          pricing: 'add',
          required: false,
          options: [],
        }),
      ];
  const primaryExtra = extras[0];

  const counts: Record<LevelKey, number> = {
    level1: countNamed(level1?.options),
    level2: countNamed(level2?.options),
    options: extras.reduce((n, g) => n + countNamed(g.options), 0),
  };

  const stepMeta = STEPS.find((s) => s.key === active)!;

  if (!selected) {
    return (
      <div className="pv-levels">
        <div className="pv-levels__pick">
          <header className="pv-levels__pick-head">
            <div className="pv-levels__pick-icon" aria-hidden>
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="pv-levels__eyebrow">Seviyeli kurulum</p>
              <h2>Ürün seç</h2>
              <p>Grubu filtrele, ürünü seç; 1. seviye → 2. seviye → ekstralar.</p>
            </div>
          </header>

          <div className="pv-levels__filters">
            <label className="pv-levels__search">
              <Search className="w-4 h-4" />
              <input
                value={query}
                onChange={(e) => onQuery(e.target.value)}
                placeholder="Ürün veya grup ara…"
              />
            </label>
            <div className="pv-levels__cats" role="tablist">
              <button
                type="button"
                className={category === 'all' ? 'is-active' : ''}
                onClick={() => onCategory('all')}
              >
                Hepsi
              </button>
              {categories.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  className={category === c.name ? 'is-active' : ''}
                  onClick={() => onCategory(c.name)}
                >
                  {c.name}
                  <em>{c.count}</em>
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="pv-levels__empty">
              <Loader2 className="w-5 h-5 animate-spin" />
              Yükleniyor…
            </div>
          ) : filtered.length === 0 ? (
            <div className="pv-levels__empty">Ürün bulunamadı.</div>
          ) : (
            <ul className="pv-levels__products">
              {filtered.map((p) => (
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
                      <small>{p.groupName || 'Grup yok'}</small>
                    </span>
                    <em>
                      {p.optionSummary?.optionCount
                        ? `${p.optionSummary.optionCount} seçenek`
                        : 'Boş'}
                    </em>
                    <ChevronRight className="w-4 h-4 pv-levels__chev" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="pv-levels is-editing">
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
            <p className="pv-levels__eyebrow">Düzenleniyor</p>
            <div className="pv-levels__hero-title">
              <h2>{selected.name}</h2>
              <span className="pv-levels__hero-price">{formatMoney(selected.price)}</span>
            </div>
            <p>{selected.groupName || 'Grup yok'}</p>
          </div>
          <button type="button" className="pv-levels__change" onClick={onClearProduct}>
            Ürünü değiştir
          </button>
        </header>

        <nav className="pv-levels__steps" aria-label="Seviyeler">
          {STEPS.map((s) => {
            const filled = counts[s.key] > 0;
            return (
              <button
                key={s.key}
                type="button"
                className={`pv-levels__step${active === s.key ? ' is-active' : ''}${
                  filled ? ' is-filled' : ''
                }`}
                onClick={() => setActive(s.key)}
              >
                <span className="pv-levels__step-num">{s.num}</span>
                <span className="pv-levels__step-text">
                  <strong>{s.title}</strong>
                  <small>{s.mode}</small>
                </span>
                <em>{counts[s.key]}</em>
              </button>
            );
          })}
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
                    value={level1?.name || '1. Seviye'}
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
                  Seçenek ekle
                </button>
              </>
            ) : null}

            {active === 'level2' ? (
              <>
                <label className="pv-levels__field">
                  <span>Başlık</span>
                  <input
                    value={level2?.name || '2. Seviye'}
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
                  Seçenek ekle
                </button>
              </>
            ) : null}

            {active === 'options' ? (
              <>
                <label className="pv-levels__field">
                  <span>Başlık</span>
                  <input
                    value={primaryExtra?.name || 'Seçenekler'}
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
                  Ekstra ekle
                </button>
              </>
            ) : null}
          </section>

          <aside className="pv-levels__preview" aria-label="Önizleme">
            <p className="pv-levels__preview-label">Müşteri görünümü</p>
            <div className="pv-levels__preview-card">
              <strong>{selected.name}</strong>
              <small>
                {selected.groupName || 'Grup yok'} · {formatMoney(selected.price)}
              </small>

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
                        {named.map((o) => (
                          <em key={o.id}>
                            {o.name}
                            {o.price ? ` · ${o.price}` : ''}
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
