import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FolderPlus, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { adminPath } from '@/lib/adminPath';
import { Button, Input, PageHeader } from '@/components/ui';
import {
  EMPTY_INGREDIENT_POOL,
  newPoolGroupId,
  newPoolItemId,
  type IngredientPool,
  type IngredientPoolGroup,
  type IngredientPoolItem,
} from '@/lib/ingredientPool';
import '@/ingredient-pool.css';

export default function IngredientPoolPage() {
  const [pool, setPool] = useState<IngredientPool>(EMPTY_INGREDIENT_POOL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | 'all' | 'none'>('all');
  const [newGroupName, setNewGroupName] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemGroupId, setNewItemGroupId] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    api<IngredientPool>('/api/admin/settings/ingredient-pool')
      .then((res) => {
        if (cancelled) return;
        setPool(res || EMPTY_INGREDIENT_POOL);
      })
      .catch(() => {
        if (!cancelled) setPool(EMPTY_INGREDIENT_POOL);
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

  const filteredItems = useMemo(() => {
    if (activeGroupId === 'all') return pool.items;
    if (activeGroupId === 'none') return pool.items.filter((i) => !i.groupId);
    return pool.items.filter((i) => i.groupId === activeGroupId);
  }, [pool.items, activeGroupId]);

  async function save(next: IngredientPool, toast?: string) {
    setSaving(true);
    setMessage(null);
    try {
      const res = await api<IngredientPool>('/api/admin/settings/ingredient-pool', {
        method: 'PUT',
        body: JSON.stringify(next),
      });
      setPool(res);
      setMessage(toast || 'Kaydedildi');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }

  function addGroup() {
    const name = newGroupName.trim();
    if (!name) return;
    const group: IngredientPoolGroup = {
      id: newPoolGroupId(),
      name,
      sortOrder: pool.groups.length,
    };
    setNewGroupName('');
    void save({ ...pool, groups: [...pool.groups, group] }, 'Grup eklendi');
  }

  function removeGroup(id: string) {
    if (!window.confirm('Bu grubu silmek istiyor musunuz? Malzemeler grupsuz kalır.')) return;
    const next: IngredientPool = {
      groups: pool.groups.filter((g) => g.id !== id),
      items: pool.items.map((it) => (it.groupId === id ? { ...it, groupId: null } : it)),
    };
    if (activeGroupId === id) setActiveGroupId('all');
    void save(next, 'Grup silindi');
  }

  function addItem() {
    const name = newItemName.trim();
    if (!name) return;
    const item: IngredientPoolItem = {
      id: newPoolItemId(),
      name,
      groupId: newItemGroupId || null,
      sortOrder: pool.items.length,
    };
    setNewItemName('');
    void save({ ...pool, items: [...pool.items, item] }, 'Malzeme eklendi');
  }

  function removeItem(id: string) {
    void save({ ...pool, items: pool.items.filter((i) => i.id !== id) }, 'Malzeme silindi');
  }

  function renameItem(id: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    void save({
      ...pool,
      items: pool.items.map((i) => (i.id === id ? { ...i, name: trimmed } : i)),
    });
  }

  function moveItemGroup(id: string, groupId: string | null) {
    void save({
      ...pool,
      items: pool.items.map((i) => (i.id === id ? { ...i, groupId } : i)),
    });
  }

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
        Malzemeleri ekleyin, isterseniz gruplayın. Üründe “Havuz” seçince buradan aktarılır.
      </p>

      {message ? (
        <div className="ingredient-pool-page__toast" role="status">
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
              </button>
              {pool.groups.map((g) => {
                const count = pool.items.filter((i) => i.groupId === g.id).length;
                return (
                  <div key={g.id} className="ingredient-pool-groups__row">
                    <button
                      type="button"
                      className={`ingredient-pool-groups__btn${activeGroupId === g.id ? ' is-active' : ''}`}
                      onClick={() => setActiveGroupId(g.id)}
                    >
                      <span>{g.name}</span>
                      <em>{count}</em>
                    </button>
                    <button
                      type="button"
                      className="ingredient-pool-icon-btn"
                      title="Grubu sil"
                      onClick={() => removeGroup(g.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="ingredient-pool-panel__add">
              <Input
                label="Yeni grup"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addGroup();
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                className="w-full"
                disabled={saving || !newGroupName.trim()}
                onClick={addGroup}
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
                  label="Malzeme adı"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addItem();
                    }
                  }}
                />
              </div>
              <label className="ingredient-pool-select">
                <span>Grup</span>
                <select
                  value={newItemGroupId}
                  onChange={(e) => setNewItemGroupId(e.target.value)}
                >
                  <option value="">Grupsuz</option>
                  {pool.groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="button" disabled={saving || !newItemName.trim()} onClick={addItem}>
                <Plus className="w-4 h-4" />
                Ekle
              </Button>
            </div>

            {filteredItems.length === 0 ? (
              <div className="ingredient-pool-empty">Henüz malzeme yok. Yukarıdan ekleyin.</div>
            ) : (
              <ul className="ingredient-pool-list">
                {filteredItems.map((item, index) => (
                  <li
                    key={item.id}
                    className="ingredient-pool-list__item"
                    style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
                  >
                    <input
                      className="ingredient-pool-list__name"
                      defaultValue={item.name}
                      aria-label="Malzeme adı"
                      onBlur={(e) => {
                        if (e.target.value.trim() !== item.name) renameItem(item.id, e.target.value);
                      }}
                    />
                    <select
                      className="ingredient-pool-list__group"
                      value={item.groupId || ''}
                      onChange={(e) => moveItemGroup(item.id, e.target.value || null)}
                      aria-label="Grup"
                    >
                      <option value="">Grupsuz</option>
                      {pool.groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="ingredient-pool-icon-btn"
                      onClick={() => removeItem(item.id)}
                      title="Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
