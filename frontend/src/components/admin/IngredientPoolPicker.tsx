import { useEffect, useMemo, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { api } from '@/lib/api';
import {
  EMPTY_INGREDIENT_POOL,
  itemGroupIds,
  itemInGroup,
  parseIngredientsList,
  type IngredientPool,
} from '@/lib/ingredientPool';
import '@/ingredient-pool.css';

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

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setQuery('');
    setGroupFilter('all');
    const already = new Set(
      parseIngredientsList(currentIngredients).map((n) => n.toLocaleLowerCase('tr-TR'))
    );
    api<IngredientPool>('/api/admin/settings/ingredient-pool')
      .then((res) => {
        const next = res || EMPTY_INGREDIENT_POOL;
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

  function emitSelection(nextIds: Set<string>) {
    const names = pool.items.filter((i) => nextIds.has(i.id)).map((i) => i.name);
    onSelectionChange(names, allPoolNames);
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
          <p className="ingredient-pool-picker__empty">
            Malzeme yok. Önce İçerik havuzu sayfasından ekleyin.
          </p>
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
    </aside>
  );
}
