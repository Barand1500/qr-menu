import { useMemo, useState, type DragEvent } from 'react';
import {
  Check,
  ChevronDown,
  ClipboardPaste,
  Copy,
  GripVertical,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  emptyGroup,
  emptyOption,
  type OptionGroupType,
  type ProductOption,
  type ProductOptionGroup,
} from '@/lib/productOptions';

export type KanbanProduct = {
  id: number;
  name: string;
  groupName: string;
  price: number;
  optionSummary?: { groupCount: number; optionCount: number };
  optionGroups?: ProductOptionGroup[];
};

type ClipboardInfo = {
  fromId: number;
  fromName: string;
} | null;

type Props = {
  products: KanbanProduct[];
  selected: KanbanProduct | null;
  selectedId: number | null;
  onSelectProduct: (p: KanbanProduct) => void;
  groups: ProductOptionGroup[];
  onUpdateGroups: (next: ProductOptionGroup[]) => void;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  clipboard: ClipboardInfo;
  onCopy: () => void;
  onPaste: () => void;
  onClearClipboard: () => void;
  pasteBusy: boolean;
};

const COLUMNS: { type: OptionGroupType; title: string; hint: string }[] = [
  { type: 'single', title: 'Varyantlar', hint: 'tek seçim' },
  { type: 'multi', title: 'Ekstralar', hint: 'çoklu + adet' },
  { type: 'choice', title: 'İstekler', hint: 'metin seçimleri' },
];

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

export default function ProductVariantsKanban({
  products,
  selected,
  selectedId,
  onSelectProduct,
  groups,
  onUpdateGroups,
  dirty,
  saving,
  onSave,
  clipboard,
  onCopy,
  onPaste,
  onClearClipboard,
  pasteBusy,
}: Props) {
  const [productQuery, setProductQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const menuGroupNames = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      const n = (p.groupName || '').trim();
      if (n) set.add(n);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'tr'));
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    return products.filter((p) => {
      const gName = (p.groupName || '').trim() || 'Grup yok';
      if (groupFilter !== 'all' && gName !== groupFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) || gName.toLowerCase().includes(q)
      );
    });
  }, [products, productQuery, groupFilter]);

  const byType = useMemo(() => {
    const map: Record<OptionGroupType, ProductOptionGroup[]> = {
      single: [],
      multi: [],
      choice: [],
    };
    for (const g of groups) map[g.type]?.push(g);
    return map;
  }, [groups]);

  function patchGroup(id: string, patch: Partial<ProductOptionGroup>) {
    onUpdateGroups(groups.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  }

  function patchOption(gid: string, oi: number, patch: Partial<ProductOption>) {
    onUpdateGroups(
      groups.map((g) => {
        if (g.id !== gid) return g;
        const options = [...g.options];
        options[oi] = { ...options[oi], ...patch };
        return { ...g, options };
      })
    );
  }

  function addGroup(type: OptionGroupType) {
    const g = emptyGroup({
      type,
      pricing: type === 'single' ? 'replace' : 'add',
      required: type === 'single',
      name:
        type === 'single' ? 'Tür seçimi' : type === 'multi' ? 'Ekstralar' : 'İstekler',
      options: [
        emptyOption({
          name: type === 'choice' ? 'Maydanoz olmasın' : type === 'single' ? 'Standart' : 'Ekstra',
          price: type === 'single' ? selected?.price || 0 : type === 'multi' ? 10 : 0,
        }),
      ],
    });
    onUpdateGroups([...groups, g]);
    setExpandedId(g.id);
    setAdvancedOpen(false);
  }

  function removeGroup(id: string) {
    onUpdateGroups(groups.filter((g) => g.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  function reorderWithinType(type: OptionGroupType, fromId: string, toId: string) {
    if (fromId === toId) return;
    const typed = groups.filter((g) => g.type === type);
    const from = typed.findIndex((g) => g.id === fromId);
    const to = typed.findIndex((g) => g.id === toId);
    if (from < 0 || to < 0) return;
    const nextTyped = [...typed];
    const [moved] = nextTyped.splice(from, 1);
    nextTyped.splice(to, 0, moved);
    let ti = 0;
    onUpdateGroups(groups.map((g) => (g.type === type ? nextTyped[ti++] : g)));
  }

  function onDragStart(e: DragEvent, id: string) {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  }

  function onDropCard(e: DragEvent, type: OptionGroupType, targetId: string) {
    e.preventDefault();
    const fromId = e.dataTransfer.getData('text/plain') || dragId;
    setDragId(null);
    if (!fromId) return;
    const from = groups.find((g) => g.id === fromId);
    if (!from || from.type !== type) return;
    reorderWithinType(type, fromId, targetId);
  }

  const canCopy = groups.length > 0;
  const canPaste = Boolean(clipboard && clipboard.fromId !== selectedId);

  return (
    <div className={`pv-kb${dirty ? ' is-dirty' : ''}`}>
      <div className="pv-kb__bar">
        <div className="pv-kb__actions">
          <button
            type="button"
            className="pv-btn pv-btn--primary"
            disabled={!selected || !dirty || saving}
            onClick={onSave}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Kaydet
          </button>
          {clipboard && canPaste ? (
            <button
              type="button"
              className="pv-btn"
              disabled={!selected || pasteBusy}
              onClick={onPaste}
              title={`“${clipboard.fromName}” seçeneklerini yapıştır`}
            >
              {pasteBusy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ClipboardPaste className="w-4 h-4" />
              )}
              Yapıştır
            </button>
          ) : (
            <button
              type="button"
              className="pv-btn"
              disabled={!selected || !canCopy}
              onClick={onCopy}
            >
              <Copy className="w-4 h-4" />
              Kopyala
            </button>
          )}
          {clipboard ? (
            <button
              type="button"
              className="pv-kb__clip"
              onClick={onClearClipboard}
              title="Kopyayı temizle"
            >
              Kopya: {clipboard.fromName}
              <X className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>

        <div className="pv-kb__pickers">
          <label className="pv-kb__group-select">
            <span className="pv-kb__sr">Grup</span>
            <select
              value={groupFilter}
              onChange={(e) => {
                setGroupFilter(e.target.value);
                setPickerOpen(false);
              }}
              aria-label="Grup seç"
            >
              <option value="all">Tüm gruplar</option>
              {menuGroupNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <div className="pv-kb__picker">
            <button
              type="button"
              className="pv-kb__picker-btn"
              onClick={() => setPickerOpen((v) => !v)}
            >
              <span>{selected?.name || 'Ürün seç'}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            {pickerOpen ? (
              <div className="pv-kb__picker-menu">
                <div className="pv-kb__picker-search">
                  <Search className="w-4 h-4" />
                  <input
                    value={productQuery}
                    onChange={(e) => setProductQuery(e.target.value)}
                    placeholder="Ürün ara…"
                    autoFocus
                  />
                </div>
                <div className="pv-kb__picker-list admin-scroll">
                  {filteredProducts.length === 0 ? (
                    <p className="pv-kb__picker-empty">Bu grupta ürün yok</p>
                  ) : (
                    filteredProducts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={`pv-kb__picker-item${p.id === selectedId ? ' is-active' : ''}`}
                        onClick={() => {
                          onSelectProduct(p);
                          setPickerOpen(false);
                          setExpandedId(null);
                        }}
                      >
                        <strong>{p.name}</strong>
                        <em>{p.groupName || 'Grup yok'}</em>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {!selected ? (
        <div className="pv-empty-state">Üstten bir ürün seçerek başla.</div>
      ) : (
        <div className="pv-kb__board">
          {COLUMNS.map((col) => {
            const cards = byType[col.type];
            return (
              <section key={col.type} className="pv-kb__col">
                <header className="pv-kb__col-head">
                  <h2>{col.title}</h2>
                  <em>({col.hint})</em>
                </header>

                <div className="pv-kb__col-body">
                  {cards.map((g) => {
                    const open = expandedId === g.id;
                    return (
                      <article
                        key={g.id}
                        className={`pv-kb__card${open ? ' is-expanded' : ''}${dirty && open ? ' is-focus' : ''}`}
                        draggable={!open}
                        onDragStart={(e) => onDragStart(e, g.id)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => onDropCard(e, col.type, g.id)}
                      >
                        <button
                          type="button"
                          className="pv-kb__card-hit"
                          onClick={() => {
                            setExpandedId(open ? null : g.id);
                            setAdvancedOpen(false);
                          }}
                        >
                          <GripVertical className="pv-kb__grip w-4 h-4" />
                          <div className="pv-kb__card-title">
                            <strong>{g.name.trim() || 'Adsız grup'}</strong>
                            {!open ? (
                              <span className="pv-kb__pills">
                                {g.options
                                  .filter((o) => o.name.trim())
                                  .map((o) => (
                                    <em key={o.id}>
                                      {o.name}: +{o.price}₺
                                    </em>
                                  ))}
                                {!g.options.some((o) => o.name.trim()) ? (
                                  <em className="is-muted">Seçenek yok</em>
                                ) : null}
                              </span>
                            ) : null}
                          </div>
                          <ChevronDown
                            className={`pv-kb__chevron w-4 h-4${open ? ' is-open' : ''}`}
                          />
                        </button>

                        {open ? (
                          <div className="pv-kb__card-edit">
                            <label className="pv-kb__field">
                              <span>Grup adı</span>
                              <input
                                value={g.name}
                                onChange={(e) => patchGroup(g.id, { name: e.target.value })}
                              />
                            </label>

                            <ul className="pv-kb__opt-list">
                              {g.options.map((o, oi) => (
                                <li key={o.id}>
                                  <input
                                    className="pv-kb__opt-name"
                                    value={o.name}
                                    placeholder="Seçenek"
                                    onChange={(e) =>
                                      patchOption(g.id, oi, { name: e.target.value })
                                    }
                                  />
                                  <label className="pv-money">
                                    <span>+</span>
                                    <input
                                      type="number"
                                      inputMode="decimal"
                                      min={0}
                                      step="0.01"
                                      value={o.price}
                                      onChange={(e) =>
                                        patchOption(g.id, oi, {
                                          price: Number(e.target.value) || 0,
                                        })
                                      }
                                    />
                                    <em>₺</em>
                                  </label>
                                  <button
                                    type="button"
                                    className="pv-icon-danger"
                                    onClick={() =>
                                      patchGroup(g.id, {
                                        options: g.options.filter((_, i) => i !== oi),
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
                              className="pv-kb__add-opt"
                              onClick={() =>
                                patchGroup(g.id, {
                                  options: [
                                    ...g.options,
                                    emptyOption({
                                      name: '',
                                      price: g.pricing === 'replace' ? selected.price : 0,
                                    }),
                                  ],
                                })
                              }
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Seçenek ekle
                            </button>

                            <button
                              type="button"
                              className={`pv-kb__adv-toggle${advancedOpen ? ' is-open' : ''}`}
                              onClick={() => setAdvancedOpen((v) => !v)}
                            >
                              Gelişmiş
                              <ChevronDown className="w-4 h-4" />
                            </button>

                            {advancedOpen ? (
                              <div className="pv-kb__adv">
                                <label className="pv-kb__field">
                                  <span>Fiyat modu</span>
                                  <select
                                    value={g.pricing}
                                    onChange={(e) =>
                                      patchGroup(g.id, {
                                        pricing: e.target.value as 'replace' | 'add',
                                      })
                                    }
                                  >
                                    <option value="replace">Fiyatı değiştir</option>
                                    <option value="add">Fiyata ekle</option>
                                  </select>
                                </label>
                                <label className="pv-check-row">
                                  <input
                                    type="checkbox"
                                    checked={g.required}
                                    onChange={(e) =>
                                      patchGroup(g.id, { required: e.target.checked })
                                    }
                                  />
                                  Zorunlu
                                </label>
                                {g.type === 'multi' ? (
                                  <label className="pv-kb__field">
                                    <span>Maks. adet (0 = sınırsız)</span>
                                    <input
                                      type="number"
                                      inputMode="numeric"
                                      className="pv-num"
                                      min={0}
                                      max={99}
                                      value={g.maxTotalQty > 0 ? g.maxTotalQty : ''}
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
                                        patchGroup(g.id, { maxTotalQty: v });
                                      }}
                                    />
                                  </label>
                                ) : null}
                                {g.type === 'single' && byType.multi.length > 0 ? (
                                  <div className="pv-kb__adv-block">
                                    <p>Boy’a göre ekstra limiti</p>
                                    {g.options.map((o, oi) =>
                                      o.name.trim() ? (
                                        <label key={o.id} className="pv-kb__field pv-kb__field--row">
                                          <span>{o.name}</span>
                                          <input
                                            type="number"
                                            inputMode="numeric"
                                            className="pv-num"
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
                                              patchOption(g.id, oi, {
                                                limitsMultiMaxTotalQty: v,
                                              });
                                            }}
                                          />
                                        </label>
                                      ) : null
                                    )}
                                  </div>
                                ) : null}
                                <div className="pv-kb__adv-block">
                                  <p>Seçilince gizle</p>
                                  {g.options.map((o, oi) => {
                                    const others = allOptionsFlat(groups, o.id);
                                    if (!o.name.trim() || !others.length) return null;
                                    return (
                                      <div key={o.id} className="pv-exclude-block">
                                        <p>
                                          <strong>{o.name}</strong>
                                        </p>
                                        <div className="pv-exclude__chips">
                                          {others.map((other) => {
                                            const on = (o.excludesOptionIds || []).includes(
                                              other.id
                                            );
                                            return (
                                              <button
                                                key={other.id}
                                                type="button"
                                                className={`pv-exclude__chip${on ? ' is-on' : ''}`}
                                                onClick={() =>
                                                  patchOption(g.id, oi, {
                                                    excludesOptionIds: toggleExclude(
                                                      o,
                                                      other.id
                                                    ),
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
                                <button
                                  type="button"
                                  className="pv-btn pv-btn--sm"
                                  style={{ color: 'var(--pv-danger)' }}
                                  onClick={() => removeGroup(g.id)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Grubu sil
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}

                  <button
                    type="button"
                    className="pv-kb__add-group"
                    onClick={() => addGroup(col.type)}
                  >
                    <Plus className="w-4 h-4" />
                    Grup ekle
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {pickerOpen ? (
        <button
          type="button"
          className="pv-kb__picker-scrim"
          aria-label="Kapat"
          onClick={() => setPickerOpen(false)}
        />
      ) : null}
    </div>
  );
}
