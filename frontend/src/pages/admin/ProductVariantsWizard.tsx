import { useEffect, useMemo, useState } from 'react';
import {
  CircleDot,
  ListChecks,
  TextCursorInput,
  Plus,
  Trash2,
  Check,
  Loader2,
} from 'lucide-react';
import { imageUrl } from '@/lib/api';
import MenuMediaPlaceholder from '@/components/public/MenuMediaPlaceholder';
import {
  emptyGroup,
  emptyOption,
  type OptionGroupType,
  type ProductOption,
  type ProductOptionGroup,
} from '@/lib/productOptions';

export type WizardProduct = {
  id: number;
  name: string;
  groupName: string;
  price: number;
  isActive?: boolean;
  imageUrl?: string | null;
  optionSummary?: { groupCount: number; optionCount: number };
  optionGroups?: ProductOptionGroup[];
};

type Category = { name: string; count: number };

const STEPS = [
  {
    id: 1,
    title: 'Ürünü seç',
    short: 'Ürünü seç',
  },
  {
    id: 2,
    title: 'Seçenek grubu ekle (Varyant / Ekstra / İstek)',
    short: 'Seçenek grubu ekle',
  },
  {
    id: 3,
    title: 'Seçenekleri doldur (ad, fiyat, aktif)',
    short: 'Seçenekleri doldur',
  },
  {
    id: 4,
    title: 'Kurallar (zorunlu, max adet, çakışan seçenekleri gizle)',
    short: 'Kurallar',
  },
  {
    id: 5,
    title: 'Önizleme + Kaydet',
    short: 'Önizleme + Kaydet',
  },
] as const;

const TYPE_TILES: {
  type: OptionGroupType;
  title: string;
  detail: string;
}[] = [
  { type: 'single', title: 'Varyant (tek seçim)', detail: 'Boy, tür, porsiyon' },
  { type: 'multi', title: 'Ekstra (çoklu + adet)', detail: 'Mantar ×2 gibi' },
  { type: 'choice', title: 'İstek (metin seçimleri)', detail: 'Maydanoz olmasın…' },
];

function typeLabel(type: OptionGroupType) {
  if (type === 'single') return 'Tek seçim';
  if (type === 'multi') return 'Çoklu + miktar';
  return 'İstek';
}

function TypeIcon({ type }: { type: OptionGroupType }) {
  if (type === 'single') return <CircleDot className="w-5 h-5" />;
  if (type === 'multi') return <ListChecks className="w-5 h-5" />;
  return <TextCursorInput className="w-5 h-5" />;
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

type Props = {
  products: WizardProduct[];
  filtered: WizardProduct[];
  loading: boolean;
  query: string;
  category: string;
  categories: Category[];
  onQuery: (q: string) => void;
  onCategory: (c: string) => void;
  selected: WizardProduct | null;
  selectedId: number | null;
  onSelectProduct: (p: WizardProduct) => void;
  groups: ProductOptionGroup[];
  activeGroupId: string | null;
  onActiveGroupId: (id: string | null) => void;
  onUpdateGroups: (next: ProductOptionGroup[]) => void;
  dirty: boolean;
  saving: boolean;
  onSave: () => Promise<boolean>;
};

export default function ProductVariantsWizard({
  products,
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
  groups,
  activeGroupId,
  onActiveGroupId,
  onUpdateGroups,
  dirty,
  saving,
  onSave,
}: Props) {
  const [step, setStep] = useState(1);
  const [draftType, setDraftType] = useState<OptionGroupType>('single');
  const [draftName, setDraftName] = useState('');
  const [editingExistingId, setEditingExistingId] = useState<string | null>(null);

  const activeGroup = useMemo(
    () => groups.find((g) => g.id === activeGroupId) || null,
    [groups, activeGroupId]
  );
  const activeIndex = useMemo(
    () => groups.findIndex((g) => g.id === activeGroupId),
    [groups, activeGroupId]
  );
  const showMultiLimits = groups.some((g) => g.type === 'multi');
  const progress = ((step - 1) / (STEPS.length - 1)) * 100;

  useEffect(() => {
    if (!selectedId) setStep(1);
  }, [selectedId]);

  function patchActiveGroup(patch: Partial<ProductOptionGroup>) {
    if (activeIndex < 0) return;
    const next = [...groups];
    next[activeIndex] = { ...next[activeIndex], ...patch };
    onUpdateGroups(next);
  }

  function patchActiveOption(oi: number, patch: Partial<ProductOption>) {
    if (activeIndex < 0 || !activeGroup) return;
    const opts = [...activeGroup.options];
    opts[oi] = { ...opts[oi], ...patch };
    patchActiveGroup({ options: opts });
  }

  function goNext() {
    if (step === 1) {
      if (!selected) {
        alert('Önce bir ürün seç.');
        return;
      }
      setDraftType('single');
      setDraftName('');
      setEditingExistingId(null);
      setStep(2);
      return;
    }
    if (step === 2) {
      const name = draftName.trim();
      if (!name) {
        alert('Grup adını yaz.');
        return;
      }
      if (editingExistingId) {
        const g = groups.find((x) => x.id === editingExistingId);
        if (!g) return;
        const next = groups.map((x) =>
          x.id === editingExistingId
            ? {
                ...x,
                name,
                type: draftType,
                pricing:
                  draftType === 'single'
                    ? ('replace' as const)
                    : x.pricing === 'replace'
                      ? ('add' as const)
                      : x.pricing,
                required: draftType === 'single' ? true : x.required,
                maxTotalQty: draftType === 'multi' ? x.maxTotalQty : 0,
              }
            : x
        );
        onUpdateGroups(next);
        onActiveGroupId(editingExistingId);
      } else {
        const g = emptyGroup({
          type: draftType,
          pricing: draftType === 'single' ? 'replace' : 'add',
          required: draftType === 'single',
          name,
          options: [
            emptyOption({
              name: draftType === 'choice' ? 'Maydanoz olmasın' : draftType === 'single' ? 'Standart' : 'Ekstra',
              price: draftType === 'single' ? selected?.price || 0 : draftType === 'multi' ? 10 : 0,
            }),
          ],
        });
        onUpdateGroups([...groups, g]);
        onActiveGroupId(g.id);
      }
      setStep(3);
      return;
    }
    if (step === 3) {
      if (!activeGroup) {
        alert('Grup bulunamadı.');
        return;
      }
      if (!activeGroup.options.some((o) => o.name.trim())) {
        alert('En az bir seçenek adı yaz.');
        return;
      }
      setStep(4);
      return;
    }
    if (step === 4) {
      setStep(5);
      return;
    }
  }

  function goBack() {
    if (step <= 1) return;
    if (step === 3 && activeGroup) {
      setDraftType(activeGroup.type);
      setDraftName(activeGroup.name);
      setEditingExistingId(activeGroup.id);
    }
    setStep((s) => s - 1);
  }

  function startAnotherGroup() {
    setDraftType('single');
    setDraftName('');
    setEditingExistingId(null);
    setStep(2);
  }

  async function handleWizardSave() {
    const ok = await onSave();
    if (!ok) return;
    // Kayıttan sonra ürün seçimine dön — yeni ürün kurmaya hazır
    setStep(1);
    setDraftType('single');
    setDraftName('');
    setEditingExistingId(null);
  }

  function pickExistingGroup(g: ProductOptionGroup) {
    setEditingExistingId(g.id);
    setDraftType(g.type);
    setDraftName(g.name);
    onActiveGroupId(g.id);
  }

  return (
    <div className="pv-wiz">
      <aside className="pv-wiz__steps" aria-label="Kurulum adımları">
        {STEPS.map((s, i) => {
          const active = step === s.id;
          const done = step > s.id;
          return (
            <div key={s.id} className={`pv-wiz__step${active ? ' is-active' : ''}${done ? ' is-done' : ''}`}>
              <span className="pv-wiz__step-num">{s.id}</span>
              <p>{s.title}</p>
              {i < STEPS.length - 1 ? <i className="pv-wiz__step-line" aria-hidden /> : null}
            </div>
          );
        })}
      </aside>

      <div className="pv-wiz__main">
        <header className="pv-wiz__hero">
          <div className="pv-wiz__thumb">
            {selected?.imageUrl ? (
              <img src={imageUrl(selected.imageUrl)} alt="" />
            ) : selected ? (
              <MenuMediaPlaceholder kind="product" size="sm" label={selected.name} />
            ) : (
              <span className="pv-wiz__thumb-empty" />
            )}
          </div>
          <div>
            <p>{selected ? selected.groupName || 'Menü' : 'Yeni restoran menüsü'}</p>
            <strong>{selected ? selected.name : 'Varyant & ekstra yönetimi'}</strong>
          </div>
        </header>

        <div className="pv-wiz__card">
          <div className="pv-wiz__progress" aria-hidden>
            <span style={{ width: `${progress}%` }} />
          </div>

          {step === 1 ? (
            <div className="pv-wiz__pane">
              <h2>Ürünü seç</h2>
              <p className="pv-wiz__lead">Hangi ürünün seçeneklerini kuracağını seç.</p>
              <div className="pv-wiz__filters">
                <input
                  value={query}
                  onChange={(e) => onQuery(e.target.value)}
                  placeholder="Ürün ara…"
                  aria-label="Ürün ara"
                />
                <div className="pv-cats">
                  <button
                    type="button"
                    className={`pv-cat${category === 'all' ? ' is-active' : ''}`}
                    onClick={() => onCategory('all')}
                  >
                    Hepsi
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      className={`pv-cat${category === c.name ? ' is-active' : ''}`}
                      onClick={() => onCategory(c.name)}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
              {loading ? (
                <p className="pv-wiz__muted">Yükleniyor…</p>
              ) : (
                <div className="pv-wiz__product-list admin-scroll">
                  {filtered.map((p) => {
                    const gCount = p.optionSummary?.groupCount ?? p.optionGroups?.length ?? 0;
                    const active = p.id === selectedId;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={`pv-wiz__product${active ? ' is-active' : ''}`}
                        onClick={() => onSelectProduct(p)}
                      >
                        <div className="pv-wiz__product-media">
                          {p.imageUrl ? (
                            <img src={imageUrl(p.imageUrl)} alt="" />
                          ) : (
                            <MenuMediaPlaceholder kind="product" size="sm" label={p.name} />
                          )}
                        </div>
                        <span>
                          <strong>{p.name}</strong>
                          <em>
                            {p.groupName || 'Grup yok'}
                            {gCount > 0 ? ` · ${gCount} grup` : ' · seçenek yok'}
                          </em>
                        </span>
                      </button>
                    );
                  })}
                  {!filtered.length ? <p className="pv-wiz__muted">Ürün yok</p> : null}
                </div>
              )}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="pv-wiz__pane">
              <h2>Seçenek grubu</h2>
              <p className="pv-wiz__lead">Grup tipini seç, adını yaz. Sonra seçenekleri dolduracaksın.</p>

              {groups.length > 0 ? (
                <div className="pv-wiz__existing">
                  <p>Mevcut gruplar — düzenlemek için seç</p>
                  <div className="pv-wiz__existing-row">
                    {groups.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        className={`pv-wiz__chip${editingExistingId === g.id ? ' is-on' : ''}`}
                        onClick={() => pickExistingGroup(g)}
                      >
                        {g.name || 'Adsız'} · {typeLabel(g.type)}
                      </button>
                    ))}
                    <button
                      type="button"
                      className={`pv-wiz__chip${editingExistingId == null ? ' is-on' : ''}`}
                      onClick={() => {
                        setEditingExistingId(null);
                        setDraftType('single');
                        setDraftName('');
                      }}
                    >
                      + Yeni grup
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="pv-wiz__tiles">
                {TYPE_TILES.map((t) => (
                  <button
                    key={t.type}
                    type="button"
                    className={`pv-wiz__tile${draftType === t.type ? ' is-active' : ''}`}
                    onClick={() => setDraftType(t.type)}
                  >
                    <TypeIcon type={t.type} />
                    <strong>{t.title}</strong>
                    <em>{t.detail}</em>
                  </button>
                ))}
              </div>

              <label className="pv-wiz__field">
                <span>Grup adı</span>
                <input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="Örn. Boyut, Ekstralar, İstekler"
                />
              </label>
            </div>
          ) : null}

          {step === 3 && activeGroup ? (
            <div className="pv-wiz__pane">
              <h2>Seçenekleri doldur</h2>
              <p className="pv-wiz__lead">
                <strong>{activeGroup.name}</strong> grubu — ad, fiyat ve aktif durumu.
              </p>
              <ul className="pv-opt-list">
                {activeGroup.options.map((o, oi) => (
                  <li key={o.id} className="pv-opt-row">
                    <input
                      className="pv-opt-row__name"
                      value={o.name}
                      placeholder={
                        activeGroup.type === 'choice' ? 'Örn. Maydanoz olmasın' : 'Seçenek adı'
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
                        onChange={(e) => patchActiveOption(oi, { isActive: e.target.checked })}
                      />
                      <span />
                    </label>
                    <button
                      type="button"
                      className="pv-icon-danger"
                      onClick={() =>
                        patchActiveGroup({
                          options: activeGroup.options.filter((_, i) => i !== oi),
                        })
                      }
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="pv-add-opt"
                onClick={() =>
                  patchActiveGroup({
                    options: [
                      ...activeGroup.options,
                      emptyOption({
                        name: '',
                        price: activeGroup.pricing === 'replace' ? selected?.price || 0 : 0,
                      }),
                    ],
                  })
                }
              >
                <Plus className="w-3.5 h-3.5" />
                Seçenek ekle
              </button>
            </div>
          ) : null}

          {step === 4 && activeGroup ? (
            <div className="pv-wiz__pane">
              <h2>Kurallar</h2>
              <p className="pv-wiz__lead">Zorunluluk, fiyat modu, limit ve çakışan seçenekler.</p>

              <label className="pv-field">
                <span>Fiyat</span>
                <select
                  value={activeGroup.pricing}
                  onChange={(e) =>
                    patchActiveGroup({ pricing: e.target.value as 'replace' | 'add' })
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

              {activeGroup.type === 'single' && showMultiLimits ? (
                <div className="pv-rules__section" style={{ marginTop: '1.25rem' }}>
                  <h3>Boy’a göre ekstra limiti</h3>
                  {activeGroup.options.map((o, oi) =>
                    o.name.trim() ? (
                      <label key={o.id} className="pv-field pv-field--inline">
                        <span>{o.name}</span>
                        <input
                          type="number"
                          min={0}
                          max={99}
                          value={o.limitsMultiMaxTotalQty > 0 ? o.limitsMultiMaxTotalQty : ''}
                          placeholder="∞"
                          onChange={(e) => {
                            const raw = e.target.value.trim();
                            const v =
                              raw === ''
                                ? 0
                                : Math.max(0, Math.min(99, Math.floor(Number(raw) || 0)));
                            patchActiveOption(oi, { limitsMultiMaxTotalQty: v });
                          }}
                        />
                      </label>
                    ) : null
                  )}
                </div>
              ) : null}

              <div className="pv-rules__section" style={{ marginTop: '1.25rem' }}>
                <h3>Seçilince gizle</h3>
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
                              {other.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {step === 5 ? (
            <div className="pv-wiz__pane">
              <h2>Önizleme + Kaydet</h2>
              <p className="pv-wiz__lead">
                {selected?.name} için kurulan gruplar. Kaydetmeden masaya yansımaz.
              </p>
              {groups.length === 0 ? (
                <p className="pv-wiz__muted">Henüz grup yok. Geri dönüp ekle.</p>
              ) : (
                <div className="pv-wiz__preview">
                  {groups.map((g) => (
                    <section key={g.id} className="pv-wiz__preview-card">
                      <header>
                        <TypeIcon type={g.type} />
                        <div>
                          <strong>{g.name || 'Adsız grup'}</strong>
                          <em>
                            {typeLabel(g.type)}
                            {g.required ? ' · zorunlu' : ''}
                            {g.pricing === 'replace' ? ' · fiyat değişir' : ' · fiyata ekler'}
                          </em>
                        </div>
                      </header>
                      <ul>
                        {g.options.map((o) => (
                          <li key={o.id}>
                            <span>{o.name || '—'}</span>
                            <b>
                              +{o.price}₺{!o.isActive ? ' · pasif' : ''}
                            </b>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
              <button
                type="button"
                className="pv-btn"
                onClick={startAnotherGroup}
              >
                <Plus className="w-4 h-4" />
                Başka grup ekle
              </button>
            </div>
          ) : null}

          <footer className="pv-wiz__footer">
            {step === 5 ? (
              <button
                type="button"
                className="pv-wiz__primary"
                disabled={!dirty || saving || !selected}
                onClick={() => void handleWizardSave()}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Kaydet
              </button>
            ) : (
              <button
                type="button"
                className="pv-wiz__primary"
                disabled={(step === 1 && !selected)}
                onClick={goNext}
              >
                Devam
              </button>
            )}
            {step > 1 ? (
              <button type="button" className="pv-wiz__back" onClick={goBack}>
                Geri
              </button>
            ) : null}
            {products.length === 0 ? null : (
              <span className="pv-wiz__footer-hint">
                Adım {step}/{STEPS.length}
              </span>
            )}
          </footer>
        </div>
      </div>
    </div>
  );
}
