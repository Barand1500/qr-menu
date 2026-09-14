import { useEffect, useMemo, useState } from 'react';
import { Check, Plus, Search, X } from 'lucide-react';
import { api } from '@/lib/api';
import {
  EMPTY_INGREDIENT_POOL,
  findItemByName,
  itemGroupIds,
  itemInGroup,
  menuGroupToPoolId,
  newPoolItemId,
  parseIngredientsList,
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
  return { ...pool, groups: [...menuAsPool, ...custom] };
}

type Props = {
  open: boolean;
  currentIngredients: string;
  onClose: () => void;
  /** Seçim değiştikçe seçili malzeme adlarını verir */
  onSelectionChange: (names: string[], allPoolNames: string[]) => void;
};

export default function IngredientPoolPicker({
  open,
  currentIngredients,
  onClose,
  onSelectionChange,
}: Props) {
  const [pool, setPool] = useState<IngredientPool>(EMPTY_INGREDIENT_POOL);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickGroupId, setQuickGroupId] = useState('');
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setQuery('');
    setGroupFilter('all');
    setQuickOpen(false);
    setQuickError(null);
    const already = new Set(
      parseIngredientsList(currentIngredients).map((n) => n.toLocaleLowerCase('tr-TR'))
    );
    Promise.all([
      api<IngredientPool>('/api/admin/settings/ingredient-pool').catch(() => EMPTY_INGREDIENT_POOL),
      api<{ data: MenuGroupRow[] }>('/api/admin/groups?limit=200').catch(() => ({ data: [] })),
    ])
      .then(([poolRes, groupsRes]) => {
        const menu = (groupsRes.data || []).filter((g) => g.isActive !== false);
        const next = mergeMenuGroupsIntoPool(poolRes || EMPTY_INGREDIENT_POOL, menu);
        setPool(next);
        const pre = new Set<string>();
        for (const item of next.items) {
          if (already.has(item.name.toLocaleLowerCase('tr-TR'))) pre.add(item.id);
        }
        setSelected(pre);
      })
      .catch(() => setPool(EMPTY_INGREDIENT_POOL))
      .finally(() => setLoading(false));
    // Açılışta bir kez yükle; currentIngredients değişince sürekli reset etme
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const allPoolNames = useMemo(() => pool.items.map((i) => i.name), [pool.items]);

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR');
    return pool.items.filter((item) => {
      const gids = itemGroupIds(item);
      if (groupFilter === 'none' && gids.length > 0) return false;
      if (
        groupFilter !== 'all' &&
        groupFilter !== 'none' &&
        !itemInGroup(item, groupFilter)
      ) {
        return false;
      }
      if (q && !item.name.toLocaleLowerCase('tr-TR').includes(q)) return false;
      return true;
    });
  }, [pool.items, groupFilter, query]);

  function emitSelection(nextIds: Set<string>, items = pool.items, names = allPoolNames) {
    const selectedNames = items.filter((i) => nextIds.has(i.id)).map((i) => i.name);
    onSelectionChange(selectedNames, names);
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      emitSelection(next);
      return next;
    });
  }

  function openQuickAdd() {
    setQuickName(query.trim());
    setQuickGroupId(
      groupFilter !== 'all' && groupFilter !== 'none' ? groupFilter : ''
    );
    setQuickError(null);
    setQuickOpen(true);
  }

  async function saveQuickAdd() {
    const name = quickName.trim();
    if (!name) {
      setQuickError('Malzeme adı gerekli');
      return;
    }

    setQuickSaving(true);
    setQuickError(null);
    try {
      const existing = findItemByName(pool.items, name);
      let nextPool: IngredientPool;
      let newId: string;

      if (existing) {
        newId = existing.id;
        if (quickGroupId && !itemInGroup(existing, quickGroupId)) {
          const ids = [...itemGroupIds(existing), quickGroupId];
          nextPool = {
            ...pool,
            items: pool.items.map((i) =>
              i.id === existing.id ? { ...i, groupIds: ids, groupId: ids[0] || null } : i
            ),
          };
        } else {
          nextPool = pool;
        }
      } else {
        newId = newPoolItemId();
        const item: IngredientPoolItem = {
          id: newId,
          name,
          groupIds: quickGroupId ? [quickGroupId] : [],
          groupId: quickGroupId || null,
          sortOrder: pool.items.length,
        };
        nextPool = { ...pool, items: [...pool.items, item] };
      }

      const saved = await api<IngredientPool>('/api/admin/settings/ingredient-pool', {
        method: 'PUT',
        body: JSON.stringify(nextPool),
      });

      // Menü gruplarını kayıptan koru
      const menuRows: MenuGroupRow[] = pool.groups
        .filter((g) => g.menuGroupId != null || /^mg-\d+$/.test(g.id))
        .map((g) => ({
          id: g.menuGroupId || Number(/^mg-(\d+)$/.exec(g.id)?.[1]) || 0,
          name: g.name,
          parentId: null,
          isActive: true,
        }))
        .filter((g) => g.id > 0);
      const merged = mergeMenuGroupsIntoPool(saved, menuRows);
      setPool(merged);

      const nextSelected = new Set(selected);
      nextSelected.add(newId);
      setSelected(nextSelected);
      emitSelection(
        nextSelected,
        merged.items,
        merged.items.map((i) => i.name)
      );

      setQuery('');
      setQuickOpen(false);
    } catch (e) {
      setQuickError(e instanceof Error ? e.message : 'Eklenemedi');
    } finally {
      setQuickSaving(false);
    }
  }

  if (!open) return null;

  return (
    <aside className="ingredient-pool-picker" aria-label="İçerik havuzu">
      <header className="ingredient-pool-picker__head">
        <div>
          <p className="ingredient-pool-picker__eyebrow">Havuz</p>
          <h3>Malzeme seç</h3>
        </div>
        <button type="button" className="ingredient-pool-picker__close" onClick={onClose} aria-label="Kapat">
          <X className="w-4 h-4" />
        </button>
      </header>

      <div className="ingredient-pool-picker__tools">
        <label className="ingredient-pool-picker__search">
          <Search className="w-4 h-4" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ara…"
          />
        </label>
        <select
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
          aria-label="Grup filtresi"
        >
          <option value="all">Tüm gruplar</option>
          <option value="none">Grupsuz</option>
          {pool.groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>

      <div className="ingredient-pool-picker__body">
        {loading ? (
          <p className="ingredient-pool-picker__empty">Yükleniyor…</p>
        ) : visible.length === 0 ? (
          <div className="ingredient-pool-picker__empty-box">
            <p>
              {query.trim()
                ? `“${query.trim()}” bulunamadı.`
                : 'Henüz malzeme yok.'}
            </p>
            <button
              type="button"
              className="ingredient-pool-picker__quick"
              onClick={openQuickAdd}
            >
              <Plus className="w-4 h-4" />
              Hızlı ekle
            </button>
          </div>
        ) : (
          <ul className="ingredient-pool-picker__list">
            {visible.map((item) => {
              const on = selected.has(item.id);
              const gids = itemGroupIds(item);
              const groupName = gids
                .map((id) => pool.groups.find((g) => g.id === id)?.name)
                .filter(Boolean)
                .join(' · ');
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`ingredient-pool-picker__chip${on ? ' is-on' : ''}`}
                    onClick={() => toggle(item.id)}
                  >
                    <span className="ingredient-pool-picker__check" aria-hidden>
                      {on ? <Check className="w-3.5 h-3.5" strokeWidth={2.75} /> : null}
                    </span>
                    <span className="min-w-0">
                      <strong>{item.name}</strong>
                      {groupName ? <em>{groupName}</em> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <footer className="ingredient-pool-picker__foot">
        <button type="button" className="ingredient-pool-picker__primary" onClick={onClose}>
          Tamam{selected.size > 0 ? ` (${selected.size})` : ''}
        </button>
      </footer>

      {quickOpen ? (
        <div className="ingredient-pool-quick" role="dialog" aria-modal="true" aria-label="Hızlı ekle">
          <div className="ingredient-pool-quick__card">
            <header className="ingredient-pool-quick__head">
              <h4>Hızlı ekle</h4>
              <button
                type="button"
                className="ingredient-pool-picker__close"
                onClick={() => setQuickOpen(false)}
                aria-label="Kapat"
              >
                <X className="w-4 h-4" />
              </button>
            </header>
            <div className="ingredient-pool-quick__body">
              <label>
                <span>Malzeme adı</span>
                <input
                  autoFocus
                  value={quickName}
                  onChange={(e) => setQuickName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void saveQuickAdd();
                    }
                  }}
                  placeholder="Örn. Domates"
                />
              </label>
              <label>
                <span>Grup</span>
                <select
                  value={quickGroupId}
                  onChange={(e) => setQuickGroupId(e.target.value)}
                >
                  <option value="">Grupsuz</option>
                  {pool.groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
              {quickError ? <p className="ingredient-pool-quick__error">{quickError}</p> : null}
            </div>
            <footer className="ingredient-pool-quick__foot">
              <button
                type="button"
                className="ingredient-pool-quick__ghost"
                onClick={() => setQuickOpen(false)}
                disabled={quickSaving}
              >
                Vazgeç
              </button>
              <button
                type="button"
                className="ingredient-pool-picker__primary"
                onClick={() => void saveQuickAdd()}
                disabled={quickSaving || !quickName.trim()}
              >
                {quickSaving ? 'Ekleniyor…' : 'Ekle'}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
