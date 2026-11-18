import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Package, Search, X } from 'lucide-react';
import { api, formatMoney, imageUrl } from '@/lib/api';
import { Button, Spinner } from '@/components/ui';
import GroupsDialog from './GroupsDialog';

type PickerProduct = {
  id: number;
  name: string;
  price: number;
  currency?: { code?: string; symbol?: string } | null;
  imageUrl?: string | null;
  isActive: boolean;
  groupId: number;
  groupName: string;
};

const norm = (s: string) => s.toLocaleLowerCase('tr').trim();

/**
 * Bir gruba toplu ürün atama. Ürün tek grupta bulunduğu için seçilenler bulundukları gruptan
 * bu gruba taşınır; pencere bunu açıkça söyler. Sıra: seçim sırasıyla grubun sonuna eklenir.
 */
export default function GroupAssignDialog({
  open,
  group,
  onClose,
  onDone,
}: {
  open: boolean;
  group: { id: number; name: string } | null;
  onClose: () => void;
  /** Taşıma bitince (taşınan ürün sayısı ile) çağrılır; pencereyi üst bileşen kapatır. */
  onDone: (moved: number) => void;
}) {
  const [products, setProducts] = useState<PickerProduct[]>([]);
  const [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
  const [query, setQuery] = useState(''),
    [from, setFrom] = useState('all');
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false),
    [submitError, setSubmitError] = useState('');
  const lock = useRef(false);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setFrom('all');
    setSelected([]);
    setSubmitError('');
    setError('');
    setLoading(true);
    let off = false;
    const abort = new AbortController();
    api<{ products: PickerProduct[] }>('/api/admin/products/picker', { signal: abort.signal })
      .then((res) => {
        if (!off) setProducts(res.products);
      })
      .catch((e) => {
        if (!off && !abort.signal.aborted)
          setError(e instanceof Error ? e.message : 'Ürünler yüklenemedi.');
      })
      .finally(() => {
        if (!off) setLoading(false);
      });
    return () => {
      off = true;
      abort.abort();
    };
  }, [open, retry]);

  const targetId = group?.id ?? -1;

  const sources = useMemo(() => {
    const map = new Map<number, { name: string; count: number }>();
    for (const p of products) {
      if (p.groupId === targetId) continue;
      const row = map.get(p.groupId) ?? { name: p.groupName, count: 0 };
      row.count += 1;
      map.set(p.groupId, row);
    }
    return [...map.entries()].map(([id, v]) => ({ id, ...v }));
  }, [products, targetId]);

  const visible = useMemo(() => {
    const q = norm(query);
    return products.filter(
      (p) =>
        (from === 'all' || String(p.groupId) === from) &&
        (!q || norm(p.name).includes(q) || norm(p.groupName).includes(q)),
    );
  }, [products, query, from]);

  const selectable = visible.filter((p) => p.groupId !== targetId);
  const allVisibleSelected =
    selectable.length > 0 && selectable.every((p) => selected.includes(p.id));
  const inTarget = products.filter((p) => p.groupId === targetId).length;

  function toggle(id: number) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }
  function toggleVisible() {
    if (allVisibleSelected) {
      const ids = new Set(selectable.map((p) => p.id));
      setSelected((s) => s.filter((id) => !ids.has(id)));
    } else {
      setSelected((s) => [...s, ...selectable.map((p) => p.id).filter((id) => !s.includes(id))]);
    }
  }
  async function submit() {
    if (!group || !selected.length || lock.current) return;
    lock.current = true;
    setBusy(true);
    setSubmitError('');
    try {
      const res = await api<{ moved: number }>('/api/admin/products/move-to-group', {
        method: 'POST',
        body: JSON.stringify({ groupId: group.id, productIds: selected }),
      });
      onDone(res.moved);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Ürünler taşınamadı.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <GroupsDialog
      open={open && group !== null}
      title="Ürün ata"
      subtitle={group ? `“${group.name}” grubuna eklenecek ürünleri seçin` : undefined}
      busy={busy}
      onClose={onClose}
      className="ag-assign"
    >
      {loading ? (
        <div className="aga-state">
          <Spinner />
        </div>
      ) : error ? (
        <div role="alert" className="aga-state">
          <p>{error}</p>
          <Button onClick={() => setRetry((v) => v + 1)}>Tekrar dene</Button>
        </div>
      ) : (
        <div className="aga">
          <div className="aga-tools">
            <label className="aga-search">
              <Search size={18} aria-hidden="true" />
              <input
                type="text"
                value={query}
                placeholder="Ürün veya grup ara…"
                aria-label="Ürün ara"
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button type="button" aria-label="Aramayı temizle" onClick={() => setQuery('')}>
                  <X size={16} />
                </button>
              )}
            </label>
            <label className="aga-from">
              <span>Hangi gruptan</span>
              <select aria-label="Hangi gruptan" value={from} onChange={(e) => setFrom(e.target.value)}>
                <option value="all">Tüm gruplar ({products.length - inTarget})</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.count})
                  </option>
                ))}
              </select>
            </label>
            <div className="aga-bar">
              <span>
                {selectable.length} ürün listeleniyor
                {inTarget > 0 && ` · ${inTarget} ürün zaten bu grupta`}
              </span>
              <button type="button" disabled={!selectable.length || busy} onClick={toggleVisible}>
                {allVisibleSelected ? 'Seçimi kaldır' : `Görünenlerin hepsini seç`}
              </button>
            </div>
          </div>

          <ul className="aga-list">
            {visible.map((p) => {
              const here = p.groupId === targetId;
              const on = selected.includes(p.id);
              return (
                <li key={p.id}>
                  <label className={`aga-row${on ? ' is-on' : ''}${here ? ' is-here' : ''}`}>
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={here || busy}
                      onChange={() => toggle(p.id)}
                    />
                    <span className="aga-check" aria-hidden="true">
                      <Check size={14} strokeWidth={3} />
                    </span>
                    <span className="aga-thumb" aria-hidden="true">
                      {p.imageUrl ? <img src={imageUrl(p.imageUrl)} alt="" loading="lazy" /> : <Package size={18} />}
                    </span>
                    <span className="aga-text">
                      <strong>{p.name}</strong>
                      <small>
                        {here ? 'Bu grupta' : p.groupName}
                        {!p.isActive && ' · Gizli'}
                      </small>
                    </span>
                    <span className="aga-price">{formatMoney(p.price, p.currency)}</span>
                  </label>
                </li>
              );
            })}
            {!visible.length && (
              <li className="aga-empty">
                {products.length
                  ? 'Aramanıza uyan ürün yok.'
                  : 'Henüz ürün yok. Önce Ürünler sayfasından ürün ekleyin.'}
              </li>
            )}
          </ul>

          <footer className="aga-foot">
            <p className="aga-note">
              Bir ürün tek grupta bulunur: seçilenler eski grubundan buraya taşınır.
            </p>
            {submitError && (
              <p role="alert" className="ag-form-error">
                {submitError}
              </p>
            )}
            <div className="aga-actions">
              <span aria-live="polite">
                <b>{selected.length}</b> seçildi
                {selected.length > 0 && (
                  <button type="button" disabled={busy} onClick={() => setSelected([])}>
                    Temizle
                  </button>
                )}
              </span>
              <Button
                className="aga-submit"
                disabled={!selected.length || busy}
                onClick={() => void submit()}
              >
                {busy
                  ? 'Taşınıyor…'
                  : selected.length
                    ? `${selected.length} ürünü ekle`
                    : 'Ürün seçin'}
              </Button>
            </div>
          </footer>
        </div>
      )}
    </GroupsDialog>
  );
}
