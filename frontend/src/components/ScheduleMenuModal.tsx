import { useEffect, useMemo, useState } from 'react';
import { Check, Clock, Plus, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
import {
  compactRules,
  createCustomSlot,
  findOverlappingSlots,
  getActiveSlot,
  normalizeTimeMenuConfig,
  type TimeMenuConfig,
  type TimeMenuRule,
  type TimeMenuSlot,
} from '@/lib/timeMenu';
import '@/schedule-menu-modal.css';

export type ScheduleMenuProduct = {
  id: number;
  name: string;
  groupId: number;
  groupName: string;
  price: number;
  isRecommended?: boolean;
};

export type ScheduleMenuGroup = {
  id: number;
  name: string;
  isSubGroup?: boolean;
  parentName?: string | null;
};

type RuleDraft = {
  hidden: boolean;
  featured: boolean;
  priceText: string;
};

function emptyDraft(): RuleDraft {
  return { hidden: false, featured: false, priceText: '' };
}

function ruleToDraft(rule: TimeMenuRule | undefined): RuleDraft {
  if (!rule) return emptyDraft();
  return {
    hidden: rule.hidden === true,
    featured: rule.featured === true,
    priceText: rule.price != null ? String(rule.price) : '',
  };
}

function draftsToRules(
  slotId: string,
  drafts: Record<number, RuleDraft>,
  otherRules: TimeMenuRule[]
): TimeMenuRule[] {
  const next: TimeMenuRule[] = otherRules.filter((r) => r.slotId !== slotId);
  for (const [idStr, draft] of Object.entries(drafts)) {
    const productId = Number(idStr);
    const priceTrim = draft.priceText.trim();
    let price: number | null | undefined;
    if (priceTrim === '') price = undefined;
    else if (/^\d+([.,]\d{1,2})?$/.test(priceTrim)) {
      price = Number(priceTrim.replace(',', '.'));
    } else {
      continue;
    }
    const rule: TimeMenuRule = { slotId, productId };
    if (draft.hidden) rule.hidden = true;
    if (draft.featured) rule.featured = true;
    if (price != null) rule.price = price;
    if (rule.hidden || rule.featured || rule.price != null) next.push(rule);
  }
  return compactRules(next);
}

export default function ScheduleMenuModal({
  open,
  groups,
  onClose,
}: {
  open: boolean;
  groups: ScheduleMenuGroup[];
  onClose: () => void;
}) {
  const [products, setProducts] = useState<ScheduleMenuProduct[]>([]);
  const [config, setConfig] = useState<TimeMenuConfig | null>(null);
  const [slotId, setSlotId] = useState('morning');
  const [groupFilter, setGroupFilter] = useState('');
  const [drafts, setDrafts] = useState<Record<number, RuleDraft>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      api<{ ok: boolean; config: TimeMenuConfig }>('/api/admin/settings/time-menu'),
      api<{ data: ScheduleMenuProduct[] }>('/api/admin/products?limit=500'),
    ])
      .then(([cfgRes, prodRes]) => {
        if (cancelled) return;
        const cfg = normalizeTimeMenuConfig(cfgRes.config);
        const list = prodRes.data || [];
        setProducts(list);
        setConfig(cfg);
        const first = cfg.slots[0]?.id || 'morning';
        setSlotId(first);
        const map: Record<number, RuleDraft> = {};
        for (const p of list) map[p.id] = emptyDraft();
        for (const rule of cfg.rules) {
          if (rule.slotId !== first) continue;
          map[rule.productId] = ruleToDraft(rule);
        }
        setDrafts(map);
      })
      .catch(() => {
        if (!cancelled) setError('Ayarlar yüklenemedi');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const activeSlot = useMemo(
    () => (config ? getActiveSlot(config) : null),
    [config]
  );

  const currentSlot = config?.slots.find((s) => s.id === slotId) || null;

  const overlaps = useMemo(
    () => (config ? findOverlappingSlots(config.slots) : []),
    [config]
  );

  const filteredProducts = useMemo(() => {
    if (!groupFilter) return products;
    const gid = Number(groupFilter);
    return products.filter((p) => p.groupId === gid);
  }, [products, groupFilter]);

  const groupOptions = useMemo(
    () =>
      groups.map((g) => ({
        value: String(g.id),
        label: g.isSubGroup && g.parentName ? `${g.parentName} › ${g.name}` : g.name,
      })),
    [groups]
  );

  function switchSlot(nextId: string) {
    if (!config || nextId === slotId) return;
    const rules = draftsToRules(slotId, drafts, config.rules);
    const nextConfig = { ...config, rules };
    setConfig(nextConfig);
    setSlotId(nextId);
    const map: Record<number, RuleDraft> = {};
    for (const p of products) map[p.id] = emptyDraft();
    for (const rule of nextConfig.rules) {
      if (rule.slotId !== nextId) continue;
      map[rule.productId] = ruleToDraft(rule);
    }
    setDrafts(map);
  }

  function updateSlot(patch: Partial<TimeMenuSlot>) {
    if (!config || !currentSlot) return;
    setConfig({
      ...config,
      slots: config.slots.map((s) => (s.id === currentSlot.id ? { ...s, ...patch } : s)),
    });
  }

  function addCustomSlot() {
    if (!config) return;
    const slot = createCustomSlot({ name: `Özel ${config.slots.length - 2}` });
    const rules = draftsToRules(slotId, drafts, config.rules);
    setConfig({ ...config, slots: [...config.slots, slot], rules });
    setSlotId(slot.id);
    const map: Record<number, RuleDraft> = {};
    for (const p of products) map[p.id] = emptyDraft();
    setDrafts(map);
  }

  function removeCurrentSlot() {
    if (!config || !currentSlot) return;
    if (['morning', 'lunch', 'dinner'].includes(currentSlot.id)) {
      updateSlot({ enabled: false });
      return;
    }
    const nextSlots = config.slots.filter((s) => s.id !== currentSlot.id);
    const nextRules = config.rules.filter((r) => r.slotId !== currentSlot.id);
    const nextId = nextSlots[0]?.id || 'morning';
    setConfig({ ...config, slots: nextSlots, rules: nextRules });
    setSlotId(nextId);
    const map: Record<number, RuleDraft> = {};
    for (const p of products) map[p.id] = emptyDraft();
    for (const rule of nextRules) {
      if (rule.slotId !== nextId) continue;
      map[rule.productId] = ruleToDraft(rule);
    }
    setDrafts(map);
  }

  function setDraft(productId: number, patch: Partial<RuleDraft>) {
    setDrafts((prev) => ({
      ...prev,
      [productId]: { ...(prev[productId] || emptyDraft()), ...patch },
    }));
  }

  function bulkForFiltered(kind: 'hide' | 'show' | 'feature' | 'unfeature') {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const p of filteredProducts) {
        const cur = next[p.id] || emptyDraft();
        if (kind === 'hide') next[p.id] = { ...cur, hidden: true };
        if (kind === 'show') next[p.id] = { ...cur, hidden: false };
        if (kind === 'feature') next[p.id] = { ...cur, featured: true, hidden: false };
        if (kind === 'unfeature') next[p.id] = { ...cur, featured: false };
      }
      return next;
    });
  }

  async function save() {
    if (!config) return;
    setSaving(true);
    setError(null);
    try {
      const rules = draftsToRules(slotId, drafts, config.rules);
      const payload = normalizeTimeMenuConfig({ ...config, rules });
      await api('/api/admin/settings/time-menu', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="smm-overlay" role="dialog" aria-modal="true" aria-labelledby="smm-title">
      <button type="button" className="smm-scrim" aria-label="Kapat" onClick={onClose} />
      <div className="smm-modal">
        <header className="smm-head">
          <div className="smm-head__icon" aria-hidden>
            <Clock className="w-5 h-5" />
          </div>
          <div className="smm-head__copy">
            <p>Ürünler</p>
            <h2 id="smm-title">Saatlik menü</h2>
          </div>
          <button type="button" className="smm-close" onClick={onClose} aria-label="Kapat">
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="smm-body">
          {loading || !config ? (
            <p className="smm-empty">Yükleniyor…</p>
          ) : (
            <>
              <div className="smm-enable">
                <div className="smm-enable__copy">
                  <strong>Saat dilimli menü</strong>
                  <span>Açıkken menü, saate göre ürünleri gösterir / gizler.</span>
                </div>
                <button
                  type="button"
                  className={`smm-switch${config.enabled ? ' is-on' : ''}`}
                  aria-pressed={config.enabled}
                  onClick={() => setConfig({ ...config, enabled: !config.enabled })}
                >
                  <em />
                </button>
              </div>

              <p className="smm-active">
                Şu an aktif dilim:{' '}
                <strong>{activeSlot ? `${activeSlot.name} (${activeSlot.start}–${activeSlot.end})` : 'yok'}</strong>
              </p>

              <div className="smm-slots" role="tablist">
                {config.slots.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    role="tab"
                    className={`smm-slot-tab${slotId === s.id ? ' is-on' : ''}`}
                    onClick={() => switchSlot(s.id)}
                  >
                    {s.name}
                    {!s.enabled ? ' · kapalı' : ''}
                  </button>
                ))}
                <button
                  type="button"
                  className="smm-slot-tab smm-slot-tab--add"
                  onClick={addCustomSlot}
                >
                  <Plus className="w-3.5 h-3.5 inline" /> Özel
                </button>
              </div>

              {currentSlot ? (
                <div className="smm-slot-card">
                  <div className="smm-slot-card__row">
                    <div className="smm-field">
                      <label htmlFor="smm-slot-name">Dilim adı</label>
                      <input
                        id="smm-slot-name"
                        type="text"
                        value={currentSlot.name}
                        onChange={(e) => updateSlot({ name: e.target.value })}
                      />
                    </div>
                    <label className="smm-slot-enabled">
                      <input
                        type="checkbox"
                        checked={currentSlot.enabled}
                        onChange={(e) => updateSlot({ enabled: e.target.checked })}
                      />
                      Aktif
                    </label>
                  </div>
                  <div className="smm-times">
                    <div className="smm-field">
                      <label htmlFor="smm-start">Başlangıç</label>
                      <input
                        id="smm-start"
                        type="time"
                        value={currentSlot.start}
                        onChange={(e) => updateSlot({ start: e.target.value || currentSlot.start })}
                      />
                    </div>
                    <div className="smm-field">
                      <label htmlFor="smm-end">Bitiş</label>
                      <input
                        id="smm-end"
                        type="time"
                        value={currentSlot.end}
                        onChange={(e) => updateSlot({ end: e.target.value || currentSlot.end })}
                      />
                    </div>
                    {!['morning', 'lunch', 'dinner'].includes(currentSlot.id) ? (
                      <button
                        type="button"
                        className="smm-chip is-danger"
                        title="Dilimini sil"
                        onClick={removeCurrentSlot}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <span />
                    )}
                  </div>
                  {overlaps.length > 0 ? (
                    <p className="smm-warn">{overlaps[0]} — kayıtta ilk eşleşen dilim kullanılır.</p>
                  ) : null}
                </div>
              ) : null}

              <div className="smm-products-head">
                <h3>Ürünler · {currentSlot?.name || 'dilim'}</h3>
                <div className="smm-field" style={{ minWidth: '11rem' }}>
                  <label htmlFor="smm-group">Grup</label>
                  <select
                    id="smm-group"
                    value={groupFilter}
                    onChange={(e) => setGroupFilter(e.target.value)}
                  >
                    <option value="">Tüm gruplar</option>
                    {groupOptions.map((g) => (
                      <option key={g.value} value={g.value}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="smm-bulk">
                <button type="button" onClick={() => bulkForFiltered('hide')}>
                  Listedekileri gizle
                </button>
                <button type="button" onClick={() => bulkForFiltered('show')}>
                  Listedekileri göster
                </button>
                <button type="button" onClick={() => bulkForFiltered('feature')}>
                  Öne çıkar
                </button>
                <button type="button" onClick={() => bulkForFiltered('unfeature')}>
                  Öne çıkanı kaldır
                </button>
              </div>

              {filteredProducts.length === 0 ? (
                <p className="smm-empty">Bu grupta ürün yok</p>
              ) : (
                <ul className="smm-list">
                  {filteredProducts.map((p) => {
                    const d = drafts[p.id] || emptyDraft();
                    return (
                      <li key={p.id} className={`smm-row${d.hidden ? ' is-hidden' : ''}`}>
                        <div>
                          <p className="smm-row__name">{p.name}</p>
                          <p className="smm-row__meta">
                            {p.groupName} · {p.price.toFixed(2)}
                          </p>
                        </div>
                        <div className="smm-row__actions">
                          <button
                            type="button"
                            className={`smm-chip is-danger${d.hidden ? ' is-on' : ''}`}
                            onClick={() => setDraft(p.id, { hidden: !d.hidden })}
                          >
                            Gizle
                          </button>
                          <button
                            type="button"
                            className={`smm-chip is-gold${d.featured ? ' is-on' : ''}`}
                            onClick={() =>
                              setDraft(p.id, {
                                featured: !d.featured,
                                hidden: d.featured ? d.hidden : false,
                              })
                            }
                          >
                            Öne çıkan
                          </button>
                          <input
                            className="smm-price"
                            inputMode="decimal"
                            placeholder="Fiyat"
                            title="Bu dilimde özel fiyat (boş = normal)"
                            value={d.priceText}
                            onChange={(e) => setDraft(p.id, { priceText: e.target.value })}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
          {error ? <p className="smm-error">{error}</p> : null}
        </div>

        <footer className="smm-foot">
          <button type="button" className="smm-foot__ghost" onClick={onClose}>
            İptal
          </button>
          <button
            type="button"
            className="smm-foot__primary"
            disabled={saving || loading || !config}
            onClick={() => void save()}
          >
            <Check className="w-4 h-4" />
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </footer>
      </div>
    </div>
  );
}
