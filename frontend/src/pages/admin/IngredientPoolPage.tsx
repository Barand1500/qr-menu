import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FolderPlus, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { adminPath } from '@/lib/adminPath';
import { Button, Input, PageHeader } from '@/components/ui';
import {
  EMPTY_INGREDIENT_POOL,
  findItemByName,
  itemGroupIds,
  itemInGroup,
  menuGroupToPoolId,
  nameKey,
  newPoolGroupId,
  newPoolItemId,
  type IngredientPool,
  type IngredientPoolGroup,
  type IngredientPoolItem,
} from '@/lib/ingredientPool';
import '@/ingredient-pool.css';

type MenuGroupRow = {
  id: number;
  name: string;
  parentId: number | null;
  parentName?: string | null;
  isActive: boolean;
};

function mergeMenuGroupsIntoPool(
  pool: IngredientPool,
  menuGroups: MenuGroupRow[]
): IngredientPool {
  const custom = pool.groups.filter((g) => !g.menuGroupId && !/^mg-\d+$/.test(g.id));
  const menuAsPool: IngredientPoolGroup[] = menuGroups
    .filter((g) => g.isActive !== false)
    .map((g, i) => ({
      id: menuGroupToPoolId(g.id),
      name: g.parentName ? `${g.parentName} › ${g.name}` : g.name,
      sortOrder: i,
      menuGroupId: g.id,
    }));

  // Menü grupları önce, özel gruplar sonra
  const groups = [
    ...menuAsPool,
    ...custom.map((g, i) => ({ ...g, sortOrder: menuAsPool.length + i, menuGroupId: null })),
  ];
  const valid = new Set(groups.map((g) => g.id));

  const items: IngredientPoolItem[] = pool.items.map((it, i) => {
    const ids = itemGroupIds(it).filter((id) => valid.has(id));
    return {
      ...it,
      groupIds: ids,
      groupId: ids[0] || null,
      sortOrder: i,
    };
  });

  return { groups, items };
}

export default function IngredientPoolPage() {
  const [pool, setPool] = useState<IngredientPool>(EMPTY_INGREDIENT_POOL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [toastKind, setToastKind] = useState<'ok' | 'warn'>('ok');
  const [activeGroupId, setActiveGroupId] = useState<string | 'all' | 'none'>('all');
  const [newGroupName, setNewGroupName] = useState('');
  const [newItemName, setNewItemName] = useState('');

  const showToast = useCallback((text: string, kind: 'ok' | 'warn' = 'ok') => {
    setToastKind(kind);
    setMessage(text);
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api<IngredientPool>('/api/admin/settings/ingredient-pool').catch(() => EMPTY_INGREDIENT_POOL),
      api<{ data: MenuGroupRow[] }>('/api/admin/groups?limit=200').catch(() => ({ data: [] })),
    ])
      .then(([poolRes, groupsRes]) => {
        if (cancelled) return;
        const menu = (groupsRes.data || []).filter((g) => g.isActive !== false);
        setPool(mergeMenuGroupsIntoPool(poolRes || EMPTY_INGREDIENT_POOL, menu));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => setMessage(null), 2600);
    return () => window.clearTimeout(t);
  }, [message]);

  const menuGroups = useMemo(
    () => pool.groups.filter((g) => g.menuGroupId != null || /^mg-\d+$/.test(g.id)),
    [pool.groups]
  );
  const customGroups = useMemo(
    () => pool.groups.filter((g) => !(g.menuGroupId != null || /^mg-\d+$/.test(g.id))),
    [pool.groups]
  );

  const filteredItems = useMemo(() => {
    let list =
      activeGroupId === 'all'
        ? pool.items
        : activeGroupId === 'none'
          ? pool.items.filter((i) => itemGroupIds(i).length === 0)
          : pool.items.filter((i) => itemInGroup(i, activeGroupId));
    // Son eklenen üstte
    return [...list].sort(
      (a, b) => b.sortOrder - a.sortOrder || b.name.localeCompare(a.name, 'tr')
    );
  }, [pool.items, activeGroupId]);

  const targetGroupId =
    activeGroupId !== 'all' && activeGroupId !== 'none' ? activeGroupId : null;

  async function save(next: IngredientPool, toast?: string, kind: 'ok' | 'warn' = 'ok') {
    setSaving(true);
    try {
      const res = await api<IngredientPool>('/api/admin/settings/ingredient-pool', {
        method: 'PUT',
        body: JSON.stringify(next),
      });
      // Menü grup isimlerini kayıptan koru — sunucu sadece kaydettiklerini döner
      const menuRows: MenuGroupRow[] = menuGroups.map((g) => ({
        id: g.menuGroupId || Number(/^mg-(\d+)$/.exec(g.id)?.[1]) || 0,
        name: g.name,
        parentId: null,
        isActive: true,
      })).filter((g) => g.id > 0);
      setPool(mergeMenuGroupsIntoPool(res, menuRows));
      if (toast) showToast(toast, kind);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Kaydedilemedi', 'warn');
    } finally {
      setSaving(false);
    }
  }

  function addCustomGroup() {
    const name = newGroupName.trim();
    if (!name) return;
    if (pool.groups.some((g) => nameKey(g.name) === nameKey(name))) {
      showToast('Bu grup adı zaten var', 'warn');
      return;
    }
    const group: IngredientPoolGroup = {
      id: newPoolGroupId(),
      name,
      sortOrder: pool.groups.length,
      menuGroupId: null,
    };
    setNewGroupName('');
    void save({ ...pool, groups: [...pool.groups, group] }, 'Özel grup eklendi');
  }

  function removeCustomGroup(id: string) {
    const g = pool.groups.find((x) => x.id === id);
    if (!g || g.menuGroupId != null || /^mg-\d+$/.test(g.id)) return;
    if (!window.confirm('Bu özel grubu silmek istiyor musunuz? Malzemeler gruptan çıkar.')) {
      return;
    }
    const next: IngredientPool = {
      groups: pool.groups.filter((x) => x.id !== id),
      items: pool.items.map((it) => {
        const ids = itemGroupIds(it).filter((gid) => gid !== id);
        return { ...it, groupIds: ids, groupId: ids[0] || null };
      }),
    };
    if (activeGroupId === id) setActiveGroupId('all');
    void save(next, 'Grup silindi');
  }

  function addItem() {
    const name = newItemName.trim();
    if (!name) return;

    const existing = findItemByName(pool.items, name);

    // Aktif grup varsa ona ekle
    if (targetGroupId) {
      if (existing && itemInGroup(existing, targetGroupId)) {
        showToast('Zaten ekli', 'warn');
        return;
      }
      if (existing) {
        const ids = [...itemGroupIds(existing), targetGroupId];
        const nextItems = pool.items.map((i) =>
          i.id === existing.id ? { ...i, groupIds: ids, groupId: ids[0] || null } : i
        );
        setNewItemName('');
        void save({ ...pool, items: nextItems }, 'Gruba eklendi');
        return;
      }
      const item: IngredientPoolItem = {
        id: newPoolItemId(),
        name,
        groupIds: [targetGroupId],
        groupId: targetGroupId,
        sortOrder: pool.items.length,
      };
      setNewItemName('');
      void save({ ...pool, items: [...pool.items, item] }, 'Malzeme eklendi');
      return;
    }

    // Tümü / Grupsuz: yeni malzeme (grupsuz) — aynı isim varsa uyarı
    if (existing) {
      showToast('Zaten ekli', 'warn');
      return;
    }
    const item: IngredientPoolItem = {
      id: newPoolItemId(),
      name,
      groupIds: [],
      groupId: null,
      sortOrder: pool.items.length,
    };
    setNewItemName('');
    void save({ ...pool, items: [...pool.items, item] }, 'Malzeme eklendi');
  }

  function removeItem(id: string) {
    // Aktif gruptaysa sadece gruptan çıkar; aksi halde tamamen sil
    if (targetGroupId) {
      const nextItems = pool.items.map((it) => {
        if (it.id !== id) return it;
        const ids = itemGroupIds(it).filter((gid) => gid !== targetGroupId);
        return { ...it, groupIds: ids, groupId: ids[0] || null };
      });
      void save({ ...pool, items: nextItems }, 'Gruptan çıkarıldı');
      return;
    }
    void save({ ...pool, items: pool.items.filter((i) => i.id !== id) }, 'Malzeme silindi');
  }

  function renameItem(id: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const clash = findItemByName(
      pool.items.filter((i) => i.id !== id),
      trimmed
    );
    if (clash) {
      showToast('Zaten ekli', 'warn');
      return;
    }
    void save({
      ...pool,
      items: pool.items.map((i) => (i.id === id ? { ...i, name: trimmed } : i)),
    });
  }

  function toggleItemGroup(itemId: string, groupId: string) {
    const item = pool.items.find((i) => i.id === itemId);
    if (!item) return;
    const ids = itemGroupIds(item);
    const nextIds = ids.includes(groupId)
      ? ids.filter((id) => id !== groupId)
      : [...ids, groupId];
    void save({
      ...pool,
      items: pool.items.map((i) =>
        i.id === itemId ? { ...i, groupIds: nextIds, groupId: nextIds[0] || null } : i
      ),
    });
  }

  function countInGroup(groupId: string) {
    return pool.items.filter((i) => itemInGroup(i, groupId)).length;
  }

  const activeGroupName =
    targetGroupId != null
      ? pool.groups.find((g) => g.id === targetGroupId)?.name || 'Grup'
      : null;

  return (
    <div className="ingredient-pool-page">
      <div className="ingredient-pool-page__top">
        <Link to={adminPath('products')} className="ingredient-pool-page__back">
          <ArrowLeft className="w-4 h-4" />
          Ürünlere dön
        </Link>
      </div>

      <PageHeader title="İçerik havuzu" />
      <p className="ingredient-pool-page__lead">
        Malzemeleri gruplara ekle. Aynı isim aynı gruba tekrar eklenmez.
      </p>

      {message ? (
        <div
          className={`ingredient-pool-page__toast${toastKind === 'warn' ? ' is-warn' : ''}`}
          role="status"
        >
          {message}
        </div>
      ) : null}

      {loading ? (
        <div className="ingredient-pool-page__loading">
          <span className="ingredient-pool-page__spinner" />
        </div>
      ) : (
        <div className="ingredient-pool-page__grid">
          <aside className="ingredient-pool-panel ingredient-pool-panel--side">
            <p className="ingredient-pool-panel__label">Gruplar</p>
            <div className="ingredient-pool-groups">
              <button
                type="button"
                className={`ingredient-pool-groups__btn${activeGroupId === 'all' ? ' is-active' : ''}`}
                onClick={() => setActiveGroupId('all')}
              >
                <span>Tümü</span>
                <em>{pool.items.length}</em>
              </button>
              <button
                type="button"
                className={`ingredient-pool-groups__btn${activeGroupId === 'none' ? ' is-active' : ''}`}
                onClick={() => setActiveGroupId('none')}
              >
                <span>Grupsuz</span>
                <em>{pool.items.filter((i) => itemGroupIds(i).length === 0).length}</em>
              </button>

              {menuGroups.length > 0 ? (
                <p className="ingredient-pool-groups__section">Menü grupları</p>
              ) : null}
              {menuGroups.map((g) => (
                <div key={g.id} className="ingredient-pool-groups__row">
                  <button
                    type="button"
                    className={`ingredient-pool-groups__btn${activeGroupId === g.id ? ' is-active' : ''}`}
                    onClick={() => setActiveGroupId(g.id)}
                  >
                    <span>{g.name}</span>
                    <em>{countInGroup(g.id)}</em>
                  </button>
                </div>
              ))}

              {customGroups.length > 0 ? (
                <p className="ingredient-pool-groups__section">Özel gruplar</p>
              ) : null}
              {customGroups.map((g) => (
                <div key={g.id} className="ingredient-pool-groups__row">
                  <button
                    type="button"
                    className={`ingredient-pool-groups__btn${activeGroupId === g.id ? ' is-active' : ''}`}
                    onClick={() => setActiveGroupId(g.id)}
                  >
                    <span>{g.name}</span>
                    <em>{countInGroup(g.id)}</em>
                  </button>
                  <button
                    type="button"
                    className="ingredient-pool-icon-btn"
                    title="Özel grubu sil"
                    onClick={() => removeCustomGroup(g.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="ingredient-pool-panel__add">
              <Input
                label="Özel grup ekle"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomGroup();
                  }
                }}
                placeholder="Örn. Soslar"
              />
              <Button
                type="button"
                size="sm"
                className="w-full"
                disabled={saving || !newGroupName.trim()}
                onClick={addCustomGroup}
              >
                <FolderPlus className="w-3.5 h-3.5" />
                Grup ekle
              </Button>
            </div>
          </aside>

          <section className="ingredient-pool-panel">
            <div className="ingredient-pool-composer">
              <div className="ingredient-pool-composer__name">
                <Input
                  label={
                    activeGroupName
                      ? `Malzeme ekle → ${activeGroupName}`
                      : 'Malzeme adı'
                  }
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addItem();
                    }
                  }}
                  placeholder="Örn. Domates"
                />
              </div>
              <Button type="button" disabled={saving || !newItemName.trim()} onClick={addItem}>
                <Plus className="w-4 h-4" />
                Ekle
              </Button>
            </div>

            {activeGroupName ? (
              <p className="ingredient-pool-hint">Bu gruba ait malzemeler</p>
            ) : null}

            {filteredItems.length === 0 ? (
              <div className="ingredient-pool-empty">
                {activeGroupName
                  ? `“${activeGroupName}” grubunda henüz malzeme yok.`
                  : 'Henüz malzeme yok. Yukarıdan ekleyin.'}
              </div>
            ) : (
              <ul className="ingredient-pool-list">
                {filteredItems.map((item, index) => {
                  const ids = itemGroupIds(item);
                  return (
                    <li
                      key={item.id}
                      className="ingredient-pool-list__item ingredient-pool-list__item--multi"
                      style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
                    >
                      <input
                        className="ingredient-pool-list__name"
                        defaultValue={item.name}
                        key={`${item.id}:${item.name}`}
                        aria-label="Malzeme adı"
                        onBlur={(e) => {
                          if (e.target.value.trim() !== item.name) {
                            renameItem(item.id, e.target.value);
                          }
                        }}
                      />
                      <div className="ingredient-pool-list__chips" role="group" aria-label="Gruplar">
                        {pool.groups.map((g) => {
                          const on = ids.includes(g.id);
                          return (
                            <button
                              key={g.id}
                              type="button"
                              className={`ingredient-pool-chip${on ? ' is-on' : ''}`}
                              disabled={saving}
                              onClick={() => toggleItemGroup(item.id, g.id)}
                              title={on ? 'Gruptan çıkar' : 'Gruba ekle'}
                            >
                              {g.name}
                            </button>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        className="ingredient-pool-icon-btn"
                        onClick={() => removeItem(item.id)}
                        title={targetGroupId ? 'Gruptan çıkar' : 'Sil'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
