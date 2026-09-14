import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { adminPath } from '@/lib/adminPath';
import { Button, PageHeader, Spinner } from '@/components/ui';
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
import '@/time-menu-page.css';

type ProductRow = {
  id: number;
  name: string;
  groupId: number;
  groupName: string;
  price: number;
};

type GroupRow = {
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

function draftsFromConfig(
  products: ProductRow[],
  config: TimeMenuConfig,
  slotId: string
): Record<number, RuleDraft> {
  const map: Record<number, RuleDraft> = {};
  for (const p of products) map[p.id] = emptyDraft();
  for (const rule of config.rules) {
    if (rule.slotId !== slotId) continue;
    map[rule.productId] = ruleToDraft(rule);
  }
  return map;
}

export default function TimeMenuPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [config, setConfig] = useState<TimeMenuConfig | null>(null);
  const [slotId, setSlotId] = useState('morning');
  const [groupFilter, setGroupFilter] = useState('');
  const [drafts, setDrafts] = useState<Record<number, RuleDraft>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [toastKind, setToastKind] = useState<'ok' | 'warn'>('ok');

  const showToast = useCallback((text: string, kind: 'ok' | 'warn' = 'ok') => {
    setToastKind(kind);
    setMessage(text);
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api<{ ok: boolean; config: TimeMenuConfig }>('/api/admin/settings/time-menu'),
      api<{ data: ProductRow[] }>('/api/admin/products?limit=500'),
      api<{ data: GroupRow[] }>('/api/admin/groups?limit=200'),
    ])
      .then(([cfgRes, prodRes, groupsRes]) => {
        if (cancelled) return;
        const cfg = normalizeTimeMenuConfig(cfgRes.config);
        const list = prodRes.data || [];
        setProducts(list);
        setGroups(groupsRes.data || []);
        setConfig(cfg);
        const first = cfg.slots[0]?.id || 'morning';
        setSlotId(first);
        setDrafts(draftsFromConfig(list, cfg, first));
      })
      .catch(() => {
        if (!cancelled) showToast('Ayarlar yüklenemedi', 'warn');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => setMessage(null), 2600);
    return () => window.clearTimeout(t);
  }, [message]);

  const activeSlotLive = useMemo(
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
        count: products.filter((p) => p.groupId === g.id).length,
      })),
    [groups, products]
  );

  function commitSlotDrafts(nextSlotId: string, nextConfig: TimeMenuConfig) {
    const rules = draftsToRules(slotId, drafts, nextConfig.rules);
    const merged = { ...nextConfig, rules };
    setConfig(merged);
    setSlotId(nextSlotId);
    setDrafts(draftsFromConfig(products, merged, nextSlotId));
  }

  function switchSlot(nextId: string) {
    if (!config || nextId === slotId) return;
    commitSlotDrafts(nextId, config);
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
    const slot = createCustomSlot({ name: `Özel ${Math.max(1, config.slots.length - 2)}` });
    const rules = draftsToRules(slotId, drafts, config.rules);
    const next = { ...config, slots: [...config.slots, slot], rules };
    setConfig(next);
    setSlotId(slot.id);
    setDrafts(draftsFromConfig(products, next, slot.id));
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
    const next = { ...config, slots: nextSlots, rules: nextRules };
    setConfig(next);
    setSlotId(nextId);
    setDrafts(draftsFromConfig(products, next, nextId));
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
    try {
      const rules = draftsToRules(slotId, drafts, config.rules);
      const payload = normalizeTimeMenuConfig({ ...config, rules });
      const res = await api<{ ok: boolean; config: TimeMenuConfig }>(
        '/api/admin/settings/time-menu',
        {
          method: 'PUT',
          body: JSON.stringify(payload),
        }
      );
      const saved = normalizeTimeMenuConfig(res.config);
      setConfig(saved);
      setDrafts(draftsFromConfig(products, saved, slotId));
      showToast('Saatlik menü kaydedildi');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Kaydedilemedi', 'warn');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="time-menu-page">
        <div className="time-menu-page__loading">
          <Spinner />
        </div>
      </div>
    );
  }

  return (
    <div className="time-menu-page">
      <div className="time-menu-page__top">
        <Link to={adminPath('products')} className="time-menu-page__back">
          <ArrowLeft className="w-4 h-4" />
          Ürünlere dön
        </Link>
      </div>

      <PageHeader
        title="Saatlik menü"
        actions={
          <Button onClick={() => void save()} disabled={saving || !config}>
            <Check className="w-4 h-4" />
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        }
      />
      <p className="time-menu-page__lead">
        Sabah / öğle / akşam dilimlerinde ürünleri gizle, öne çıkar veya özel fiyat ver. Kural
        yoksa ürün her zaman görünür.
      </p>

      {message ? (
        <div
          className={`time-menu-page__toast${toastKind === 'warn' ? ' is-warn' : ''}`}
          role="status"
        >
          {message}
        </div>
      ) : null}

      {!config ? (
        <p className="time-menu-empty">Ayarlar yüklenemedi</p>
      ) : (
        <>
          <div className="time-menu-page__toolbar">
            <div className="time-menu-page__enable">
              <button
                type="button"
                className={`time-menu-switch${config.enabled ? ' is-on' : ''}`}
                aria-pressed={config.enabled}
                onClick={() => setConfig({ ...config, enabled: !config.enabled })}
              >
                <em />
              </button>
              <div>
                <strong>Saat dilimli menü {config.enabled ? 'açık' : 'kapalı'}</strong>
                <span>Açıkken menü, saate göre ürünleri gösterir veya gizler.</span>
              </div>
            </div>
            <p className="time-menu-page__active">
              Şu an aktif:{' '}
              <strong>
                {activeSlotLive
                  ? `${activeSlotLive.name} (${activeSlotLive.start}–${activeSlotLive.end})`
                  : 'yok'}
              </strong>
            </p>
          </div>

          <div className="time-menu-page__grid">
            <aside className="time-menu-panel time-menu-panel--side">
              <p className="time-menu-panel__label">Dilimler</p>
              <div className="time-menu-slots">
                {config.slots.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`time-menu-slots__btn${slotId === s.id ? ' is-active' : ''}${
                      !s.enabled ? ' is-off' : ''
                    }`}
                    onClick={() => switchSlot(s.id)}
                  >
                    <span>{s.name}</span>
                    <small>
                      {s.start}–{s.end}
                      {!s.enabled ? ' · kapalı' : ''}
                    </small>
                  </button>
                ))}
                <button
                  type="button"
                  className="time-menu-slots__btn time-menu-slots__add"
                  onClick={addCustomSlot}
                >
                  <span>
                    <Plus className="w-3.5 h-3.5 inline" /> Özel dilim
                  </span>
                </button>
              </div>

              <p className="time-menu-panel__label">Grup filtresi</p>
              <div className="time-menu-groups">
                <button
                  type="button"
                  className={`time-menu-groups__btn${groupFilter === '' ? ' is-active' : ''}`}
                  onClick={() => setGroupFilter('')}
                >
                  <span>Tüm gruplar</span>
                  <em>{products.length}</em>
                </button>
                {groupOptions.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    className={`time-menu-groups__btn${
                      groupFilter === g.value ? ' is-active' : ''
                    }`}
                    onClick={() => setGroupFilter(g.value)}
                  >
                    <span>{g.label}</span>
                    <em>{g.count}</em>
                  </button>
                ))}
              </div>
            </aside>

            <section className="time-menu-panel">
              {currentSlot ? (
                <div className="time-menu-slot-edit">
                  <div className="time-menu-slot-edit__row">
                    <div className="time-menu-field">
                      <label htmlFor="tm-slot-name">Dilim adı</label>
                      <input
                        id="tm-slot-name"
                        type="text"
                        value={currentSlot.name}
                        onChange={(e) => updateSlot({ name: e.target.value })}
                      />
                    </div>
                    <label className="time-menu-check">
                      <input
                        type="checkbox"
                        checked={currentSlot.enabled}
                        onChange={(e) => updateSlot({ enabled: e.target.checked })}
                      />
                      Aktif
                    </label>
                  </div>
                  <div className="time-menu-slot-edit__times">
                    <div className="time-menu-field">
                      <label htmlFor="tm-start">Başlangıç</label>
                      <input
                        id="tm-start"
                        type="time"
                        value={currentSlot.start}
                        onChange={(e) =>
                          updateSlot({ start: e.target.value || currentSlot.start })
                        }
                      />
                    </div>
                    <div className="time-menu-field">
                      <label htmlFor="tm-end">Bitiş</label>
                      <input
                        id="tm-end"
                        type="time"
                        value={currentSlot.end}
                        onChange={(e) => updateSlot({ end: e.target.value || currentSlot.end })}
                      />
                    </div>
                    {!['morning', 'lunch', 'dinner'].includes(currentSlot.id) ? (
                      <button
                        type="button"
                        className="time-menu-icon-btn"
                        title="Dilimini sil"
                        onClick={removeCurrentSlot}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <span />
                    )}
                  </div>
                  {overlaps.length > 0 ? (
                    <p className="time-menu-warn">
                      {overlaps[0]} — kayıtta listedeki ilk eşleşen dilim kullanılır.
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="time-menu-bulk">
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
                <p className="time-menu-empty">Bu grupta ürün yok</p>
              ) : (
                <ul className="time-menu-list">
                  {filteredProducts.map((p) => {
                    const d = drafts[p.id] || emptyDraft();
                    return (
                      <li
                        key={p.id}
                        className={`time-menu-row${d.hidden ? ' is-hidden' : ''}`}
                      >
                        <div>
                          <p className="time-menu-row__name">{p.name}</p>
                          <p className="time-menu-row__meta">
                            {p.groupName} · normal {p.price.toFixed(2)}
                          </p>
                        </div>
                        <div className="time-menu-row__actions">
                          <button
                            type="button"
                            className={`time-menu-chip is-danger${d.hidden ? ' is-on' : ''}`}
                            onClick={() => setDraft(p.id, { hidden: !d.hidden })}
                          >
                            Gizle
                          </button>
                          <button
                            type="button"
                            className={`time-menu-chip is-gold${d.featured ? ' is-on' : ''}`}
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
                            className="time-menu-price"
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
            </section>
          </div>
        </>
      )}
    </div>
  );
}
