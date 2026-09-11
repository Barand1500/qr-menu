import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FolderPlus, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { adminPath } from '@/lib/adminPath';
import { Button, Card, Input, PageHeader } from '@/components/ui';
import {
  EMPTY_INGREDIENT_POOL,
  newPoolGroupId,
  newPoolItemId,
  type IngredientPool,
  type IngredientPoolGroup,
  type IngredientPoolItem,
} from '@/lib/ingredientPool';

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
      setMessage(toast || 'Kaydedildi.');
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
    void save({ ...pool, groups: [...pool.groups, group] }, 'Grup eklendi.');
  }

  function removeGroup(id: string) {
    if (!window.confirm('Bu grubu silmek istiyor musunuz? Malzemeler grupsuz kalır.')) return;
    const next: IngredientPool = {
      groups: pool.groups.filter((g) => g.id !== id),
      items: pool.items.map((it) => (it.groupId === id ? { ...it, groupId: null } : it)),
    };
    if (activeGroupId === id) setActiveGroupId('all');
    void save(next, 'Grup silindi.');
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
    void save({ ...pool, items: [...pool.items, item] }, 'Malzeme eklendi.');
  }

  function removeItem(id: string) {
    void save(
      { ...pool, items: pool.items.filter((i) => i.id !== id) },
      'Malzeme silindi.'
    );
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
    <div>
      <div className="mb-4">
        <Link
          to={adminPath('products')}
          className="inline-flex items-center gap-1.5 text-sm admin-text-muted hover:text-[var(--admin-accent)]"
        >
          <ArrowLeft className="w-4 h-4" />
          Ürünlere dön
        </Link>
      </div>

      <PageHeader title="İçerik havuzu" />
      <p className="text-sm admin-text-muted -mt-4 mb-6 max-w-2xl">
        Malzemeleri buraya ekleyin, isterseniz gruplayın. Ürün çevirilerinde “Havuz” seçince buradan
        seçip içindekilere aktarırsınız.
      </p>

      {message ? (
        <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          {message}
        </div>
      ) : null}

      {loading ? (
        <div className="py-16 flex justify-center">
          <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <Card className="!p-4 h-fit">
            <p className="text-xs font-extrabold uppercase tracking-wide text-slate-400 mb-3">
              Gruplar
            </p>
            <div className="space-y-1 mb-3">
              <button
                type="button"
                className={`w-full text-left rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  activeGroupId === 'all'
                    ? 'bg-sky-50 text-sky-800'
                    : 'hover:bg-slate-50 text-slate-700'
                }`}
                onClick={() => setActiveGroupId('all')}
              >
                Tümü
                <span className="float-right text-xs text-slate-400">{pool.items.length}</span>
              </button>
              <button
                type="button"
                className={`w-full text-left rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  activeGroupId === 'none'
                    ? 'bg-sky-50 text-sky-800'
                    : 'hover:bg-slate-50 text-slate-700'
                }`}
                onClick={() => setActiveGroupId('none')}
              >
                Grupsuz
              </button>
              {pool.groups.map((g) => {
                const count = pool.items.filter((i) => i.groupId === g.id).length;
                return (
                  <div key={g.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      className={`min-w-0 flex-1 text-left rounded-lg px-3 py-2 text-sm font-semibold transition ${
                        activeGroupId === g.id
                          ? 'bg-sky-50 text-sky-800'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                      onClick={() => setActiveGroupId(g.id)}
                    >
                      <span className="truncate block">{g.name}</span>
                      <span className="text-xs text-slate-400">{count}</span>
                    </button>
                    <button
                      type="button"
                      className="p-2 rounded-lg text-rose-500 hover:bg-rose-50"
                      title="Grubu sil"
                      onClick={() => removeGroup(g.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
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
            </div>
            <Button
              type="button"
              size="sm"
              className="mt-2 w-full"
              disabled={saving || !newGroupName.trim()}
              onClick={addGroup}
            >
              <FolderPlus className="w-3.5 h-3.5" />
              Grup ekle
            </Button>
          </Card>

          <Card className="!p-4">
            <div className="flex flex-wrap items-end gap-2 mb-4">
              <div className="min-w-[12rem] flex-1">
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
              <label className="text-sm text-slate-600">
                <span className="block text-xs font-semibold text-slate-400 mb-1">Grup</span>
                <select
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm min-w-[9rem]"
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
              <p className="text-sm text-slate-500 py-10 text-center border border-dashed border-slate-200 rounded-xl">
                Henüz malzeme yok. Yukarıdan ekleyin.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden bg-white">
                {filteredItems.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                    <input
                      className="min-w-0 flex-1 rounded-lg border border-transparent px-2 py-1.5 text-sm font-semibold text-slate-800 hover:border-slate-200 focus:border-sky-300 focus:outline-none"
                      defaultValue={item.name}
                      onBlur={(e) => {
                        if (e.target.value.trim() !== item.name) renameItem(item.id, e.target.value);
                      }}
                    />
                    <select
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-600"
                      value={item.groupId || ''}
                      onChange={(e) => moveItemGroup(item.id, e.target.value || null)}
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
                      className="p-2 rounded-lg text-rose-500 hover:bg-rose-50"
                      onClick={() => removeItem(item.id)}
                      title="Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
