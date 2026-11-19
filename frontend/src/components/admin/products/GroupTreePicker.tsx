import { useMemo, useState } from 'react';
import { ChevronDown, LayoutGrid, Search } from 'lucide-react';
import { imageUrl } from '@/lib/api';
import type { Group } from './types';

const norm = (s: string) => s.toLocaleLowerCase('tr').trim();

function Thumb({ group }: { group: Group }) {
  const [broken, setBroken] = useState(false);
  return group.imageUrl && !broken ? (
    <img className="apg-thumb" src={imageUrl(group.imageUrl)} alt="" loading="lazy" onError={() => setBroken(true)} />
  ) : (
    <span className="apg-thumb apg-letter" style={{ ['--h' as string]: (group.id * 47) % 360 }} aria-hidden="true">
      {group.name.trim().charAt(0).toLocaleUpperCase('tr')}
    </span>
  );
}

/**
 * Bölüm seçici: üst gruplar ve altlarında girintili, aç/kapa alt gruplar. Seçili bölüm vurgulanır (tik yok);
 * seçili alt grubun üst grubu işaretli ve açık gelir. Arama, eşleşen dalları kendiliğinden açar.
 */
export default function GroupTreePicker({
  groups,
  selectedId,
  onSelect,
}: {
  groups: Group[];
  /** Seçili grup id'si; boşsa "Tüm ürünler". */
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const selected = groups.find((g) => String(g.id) === selectedId);
  const [expanded, setExpanded] = useState<Set<number>>(() => {
    const open = new Set<number>();
    if (selected?.parentId) open.add(selected.parentId);
    if (selected && !selected.isSubGroup) open.add(selected.id);
    return open;
  });

  const { roots, kids, total } = useMemo(() => {
    const byParent = new Map<number, Group[]>();
    const ids = new Set(groups.map((g) => g.id));
    const rootList: Group[] = [];
    for (const g of groups) {
      if (g.parentId && ids.has(g.parentId)) {
        const list = byParent.get(g.parentId) ?? [];
        list.push(g);
        byParent.set(g.parentId, list);
      } else rootList.push(g);
    }
    const sum = groups.reduce((n, g) => n + (g.productCount ?? 0), 0);
    return { roots: rootList, kids: byParent, total: groups.some((g) => g.productCount != null) ? sum : null };
  }, [groups]);

  const q = norm(query);
  const matches = (g: Group) => norm(`${g.name} ${g.parentName ?? ''}`).includes(q);
  const visible = roots
    .map((root) => {
      const children = kids.get(root.id) ?? [];
      if (!q) return { root, children, open: expanded.has(root.id) };
      const rootMatch = matches(root);
      const shown = rootMatch ? children : children.filter(matches);
      return rootMatch || shown.length ? { root, children: shown, open: true } : null;
    })
    .filter((n): n is { root: Group; children: Group[]; open: boolean } => n !== null);

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const count = (g: Group) => (g.productCount != null ? <em>{g.productCount}</em> : null);

  return (
    <div className="apg">
      {groups.length > 8 && (
        <label className="apg-search">
          <Search size={16} aria-hidden="true" />
          <input
            aria-label="Grup bul"
            placeholder="Grup ara"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      )}

      {!q && (
        <button type="button" className="apg-all" aria-pressed={!selectedId} onClick={() => onSelect('')}>
          <span className="apg-thumb apg-allicon" aria-hidden="true">
            <LayoutGrid size={17} />
          </span>
          <span className="apg-name">Tüm ürünler</span>
          {total != null && <em>{total}</em>}
        </button>
      )}

      <ul className="apg-tree">
        {visible.map(({ root, children, open }) => {
          const hasKids = children.length > 0;
          const inBranch = selected?.parentId === root.id;
          return (
            <li key={root.id} className={`apg-node${inBranch ? ' is-branch' : ''}`}>
              <div className="apg-row">
                <button
                  type="button"
                  className="apg-main"
                  aria-pressed={selectedId === String(root.id)}
                  onClick={() => onSelect(String(root.id))}
                >
                  <Thumb group={root} />
                  <span className="apg-name">{root.name}</span>
                  {count(root)}
                </button>
                {hasKids && !q && (
                  <button
                    type="button"
                    className="apg-toggle"
                    aria-expanded={open}
                    aria-label={`${root.name} alt gruplarını ${open ? 'kapat' : 'aç'}`}
                    onClick={() => toggle(root.id)}
                  >
                    <ChevronDown size={18} className={open ? 'is-open' : ''} />
                    <small>{children.length}</small>
                  </button>
                )}
              </div>
              {hasKids && (
                <div className="apg-sub" data-open={open}>
                  <ul>
                    {children.map((child) => (
                      <li key={child.id}>
                        <button
                          type="button"
                          className="apg-main is-sub"
                          aria-pressed={selectedId === String(child.id)}
                          onClick={() => onSelect(String(child.id))}
                        >
                          <Thumb group={child} />
                          <span className="apg-name">{child.name}</span>
                          {count(child)}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {!visible.length && <p className="apg-empty">Bu aramaya uyan grup yok.</p>}
    </div>
  );
}
