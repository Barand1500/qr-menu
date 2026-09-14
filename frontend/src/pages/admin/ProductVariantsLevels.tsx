import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { imageUrl } from '@/lib/api';
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
  const [open, setOpen] = useState<Record<LevelKey, boolean>>({
    level1: true,
    level2: false,
    options: false,
  });

  const parts = useMemo(() => partitionGroups(groups), [groups]);

  useEffect(() => {
    if (!selectedId) {
      setOpen({ level1: true, level2: false, options: false });
    }
  }, [selectedId]);

  function toggle(key: LevelKey) {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }

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
    onUpdateGroups(
      rebuildGroups(nextL1, nextL2, nextExtras, parts.leftoverSingles)
    );
  }

  function patchLevel1(patch: Partial<ProductOptionGroup>) {
    const l1 = { ...ensureLevel1(), ...patch };
    commit(l1, ensureLevel2(), ensureExtras());
  }

  function patchLevel2(patch: Partial<ProductOptionGroup>) {
    const l2 = { ...ensureLevel2(), ...patch };
    commit(ensureLevel1(), l2, ensureExtras());
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
      const options = g.options.map((o, i) => (i === oi ? { ...o, ...patch } : o));
      patchLevel1({ options });
      return;
    }
    if (which === 'level2') {
      const g = ensureLevel2();
      const options = g.options.map((o, i) => (i === oi ? { ...o, ...patch } : o));
      patchLevel2({ options });
      return;
    }
    const extras = ensureExtras();
    const g = extras[extraGi];
    if (!g) return;
    const options = g.options.map((o, i) => (i === oi ? { ...o, ...patch } : o));
    patchExtra(extraGi, { options });
  }

  function addOption(which: 'level1' | 'level2' | 'extra', extraGi = 0) {
    if (which === 'level1') {
      const g = ensureLevel1();
      patchLevel1({ options: [...g.options, emptyOption({ name: '' })] });
      setOpen((p) => ({ ...p, level1: true }));
      return;
    }
    if (which === 'level2') {
      const g = ensureLevel2();
      patchLevel2({ options: [...g.options, emptyOption({ name: '' })] });
      setOpen((p) => ({ ...p, level2: true }));
      return;
    }
    const extras = ensureExtras();
    const g = extras[extraGi] || extras[0];
    patchExtra(extraGi, { options: [...g.options, emptyOption({ name: '' })] });
    setOpen((p) => ({ ...p, options: true }));
  }

  function removeOption(which: 'level1' | 'level2' | 'extra', oi: number, extraGi = 0) {
    if (which === 'level1') {
      const g = ensureLevel1();
      patchLevel1({ options: g.options.filter((_, i) => i !== oi) });
      return;
    }
    if (which === 'level2') {
      const g = ensureLevel2();
      patchLevel2({ options: g.options.filter((_, i) => i !== oi) });
      return;
    }
    const extras = ensureExtras();
    const g = extras[extraGi];
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

  if (!selected) {
    return (
      <div className="pv-levels">
        <div className="pv-levels__pick">
          <header className="pv-levels__pick-head">
            <div>
              <p className="pv-levels__eyebrow">Adım 1</p>
              <h2>Ürün seç</h2>
              <p>Önce grubu / ürünü seç, sonra seviyeleri doldur.</p>
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
    <div className="pv-levels">
      <div className="pv-levels__editor">
        <header className="pv-levels__product-bar">
          <span className="pv-levels__product-media is-sm">
            {selected.imageUrl ? (
              <img src={imageUrl(selected.imageUrl)} alt="" />
            ) : (
              <MenuMediaPlaceholder />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="pv-levels__eyebrow">Seviyeli kurulum</p>
            <strong>{selected.name}</strong>
            <small>{selected.groupName || 'Grup yok'}</small>
          </div>
          <button type="button" className="pv-levels__change" onClick={onClearProduct}>
            Ürünü değiştir
          </button>
        </header>

        <p className="pv-levels__guide">
          Örnek: <b>1. Seviye</b> açık/kapalı çay → <b>2. Seviye</b> şekerli/şekersiz →{' '}
          <b>Seçenekler</b> ekstralar (çoklu seçim).
        </p>

        <section className={`pv-levels__panel${open.level1 ? ' is-open' : ''}`}>
          <button
            type="button"
            className="pv-levels__panel-head"
            aria-expanded={open.level1}
            onClick={() => toggle('level1')}
          >
            <ChevronRight className="pv-levels__fold" />
            <div>
              <strong>1. Seviye</strong>
              <span>Tek seçim — örn. açık çay / kapalı çay</span>
            </div>
            <em>{level1?.options.filter((o) => o.name.trim()).length || 0}</em>
          </button>
          {open.level1 ? (
            <div className="pv-levels__panel-body">
              <label className="pv-levels__field">
                <span>Başlık</span>
                <input
                  value={level1?.name || '1. Seviye'}
                  onChange={(e) => patchLevel1({ name: e.target.value })}
                  placeholder="1. Seviye"
                />
              </label>
              <div className="pv-levels__opts">
                {(level1?.options || []).map((o, oi) => (
                  <div key={o.id} className="pv-levels__opt">
                    <input
                      value={o.name}
                      onChange={(e) => patchOption('level1', oi, { name: e.target.value })}
                      placeholder="Seçenek adı"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={o.price}
                      onChange={(e) =>
                        patchOption('level1', oi, { price: Number(e.target.value) || 0 })
                      }
                      aria-label="Fiyat"
                    />
                    <button
                      type="button"
                      className="pv-levels__opt-del"
                      onClick={() => removeOption('level1', oi)}
                      aria-label="Sil"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="pv-levels__add"
                onClick={() => addOption('level1')}
              >
                <Plus className="w-4 h-4" />
                Seçenek ekle
              </button>
            </div>
          ) : null}
        </section>

        <section className={`pv-levels__panel${open.level2 ? ' is-open' : ''}`}>
          <button
            type="button"
            className="pv-levels__panel-head"
            aria-expanded={open.level2}
            onClick={() => toggle('level2')}
          >
            <ChevronRight className="pv-levels__fold" />
            <div>
              <strong>2. Seviye</strong>
              <span>Tek seçim — örn. şekerli / şekersiz</span>
            </div>
            <em>{level2?.options.filter((o) => o.name.trim()).length || 0}</em>
          </button>
          {open.level2 ? (
            <div className="pv-levels__panel-body">
              <label className="pv-levels__field">
                <span>Başlık</span>
                <input
                  value={level2?.name || '2. Seviye'}
                  onChange={(e) => patchLevel2({ name: e.target.value })}
                  placeholder="2. Seviye"
                />
              </label>
              <div className="pv-levels__opts">
                {(level2?.options || []).map((o, oi) => (
                  <div key={o.id} className="pv-levels__opt">
                    <input
                      value={o.name}
                      onChange={(e) => patchOption('level2', oi, { name: e.target.value })}
                      placeholder="Seçenek adı"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={o.price}
                      onChange={(e) =>
                        patchOption('level2', oi, { price: Number(e.target.value) || 0 })
                      }
                      aria-label="Fiyat"
                    />
                    <button
                      type="button"
                      className="pv-levels__opt-del"
                      onClick={() => removeOption('level2', oi)}
                      aria-label="Sil"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="pv-levels__add"
                onClick={() => addOption('level2')}
              >
                <Plus className="w-4 h-4" />
                Seçenek ekle
              </button>
            </div>
          ) : null}
        </section>

        <section className={`pv-levels__panel${open.options ? ' is-open' : ''}`}>
          <button
            type="button"
            className="pv-levels__panel-head"
            aria-expanded={open.options}
            onClick={() => toggle('options')}
          >
            <ChevronRight className="pv-levels__fold" />
            <div>
              <strong>Seçenekler</strong>
              <span>Çoklu seçim — ekstra ne istenirse</span>
            </div>
            <em>
              {extras.reduce((n, g) => n + g.options.filter((o) => o.name.trim()).length, 0)}
            </em>
          </button>
          {open.options ? (
            <div className="pv-levels__panel-body">
              <label className="pv-levels__field">
                <span>Başlık</span>
                <input
                  value={primaryExtra?.name || 'Seçenekler'}
                  onChange={(e) => patchExtra(0, { name: e.target.value })}
                  placeholder="Seçenekler"
                />
              </label>
              <div className="pv-levels__opts">
                {(primaryExtra?.options || []).map((o, oi) => (
                  <div key={o.id} className="pv-levels__opt">
                    <input
                      value={o.name}
                      onChange={(e) => patchOption('extra', oi, { name: e.target.value }, 0)}
                      placeholder="Ekstra adı"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={o.price}
                      onChange={(e) =>
                        patchOption(
                          'extra',
                          oi,
                          { price: Number(e.target.value) || 0 },
                          0
                        )
                      }
                      aria-label="Fiyat"
                    />
                    <button
                      type="button"
                      className="pv-levels__opt-del"
                      onClick={() => removeOption('extra', oi, 0)}
                      aria-label="Sil"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="pv-levels__add"
                onClick={() => addOption('extra', 0)}
              >
                <Plus className="w-4 h-4" />
                Ekstra ekle
              </button>
            </div>
          ) : null}
        </section>

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
        </div>
      </div>
    </div>
  );
}
