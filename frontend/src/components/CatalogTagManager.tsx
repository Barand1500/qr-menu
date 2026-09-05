import { useEffect, useState } from 'react';
import { Check, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Input } from '@/components/ui';
import type { PrefCatalog, PrefCatalogItem } from '@/lib/prefCatalog';
import { newCatalogItemId } from '@/lib/prefCatalog';
import { translatePrefLabel } from '@/lib/translate';

type CatalogKind = 'allergen' | 'diet';

function CatalogEditorPanel({
  kind,
  items,
  languageCodes,
  onChange,
  onClose,
}: {
  kind: CatalogKind;
  items: PrefCatalogItem[];
  languageCodes: string[];
  onChange: (items: PrefCatalogItem[]) => void;
  onClose: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [adding, setAdding] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [busy, setBusy] = useState(false);

  const title = kind === 'allergen' ? 'Alerjen listesi' : 'Diyet listesi';
  const langHint =
    languageCodes.length > 1
      ? `TR yazın → ${languageCodes.filter((c) => c !== 'tr').join(', ').toUpperCase() || 'diğer diller'} otomatik çevrilir`
      : 'Türkçe ad yazın';

  function startEdit(item: PrefCatalogItem) {
    setEditingId(item.id);
    setEditValue(item.label.tr);
  }

  async function saveEdit(id: string) {
    const name = editValue.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const label = await translatePrefLabel(name, languageCodes);
      onChange(items.map((item) => (item.id === id ? { ...item, label } : item)));
      setEditingId(null);
      setEditValue('');
    } finally {
      setBusy(false);
    }
  }

  function removeItem(id: string) {
    if (!window.confirm('Bu seçeneği listeden kaldırmak istediğinize emin misiniz?')) return;
    onChange(items.filter((item) => item.id !== id));
  }

  async function addItem() {
    const name = newValue.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const id = newCatalogItemId(name);
      const label = await translatePrefLabel(name, languageCodes);
      onChange([...items, { id, label }]);
      setNewValue('');
      setAdding(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="rounded-2xl border p-3.5 space-y-3"
      style={{
        background: 'var(--admin-input-bg)',
        borderColor: 'var(--admin-card-border)',
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide admin-text-muted">{title}</p>
          <p className="text-[11px] admin-text-muted mt-0.5">{langHint}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-[var(--admin-accent-soft)] admin-text-muted"
          title="Kapat"
          disabled={busy}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <ul className="space-y-1.5 max-h-48 overflow-y-auto admin-scroll">
        {items.map((item) =>
          editingId === item.id ? (
            <li key={item.id} className="flex items-center gap-2">
              <Input
                label="Ad (Türkçe)"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="flex-1"
                onKeyDown={(e) => e.key === 'Enter' && void saveEdit(item.id)}
                disabled={busy}
              />
              <button
                type="button"
                onClick={() => void saveEdit(item.id)}
                className="p-2 rounded-lg shrink-0"
                style={{ background: 'var(--admin-accent)', color: '#fff' }}
                disabled={busy}
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              </button>
            </li>
          ) : (
            <li
              key={item.id}
              className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-sm"
              style={{
                background: 'var(--admin-card)',
                border: '1px solid var(--admin-card-border)',
                color: 'var(--admin-text)',
              }}
            >
              <span className="truncate">{item.label.tr}</span>
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => startEdit(item)}
                  className="p-1.5 rounded-lg hover:bg-[var(--admin-accent-soft)]"
                  style={{ color: 'var(--admin-accent)' }}
                  title="Düzenle"
                  disabled={busy}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500"
                  title="Sil"
                  disabled={busy}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </li>
          )
        )}
      </ul>

      {adding ? (
        <div className="flex items-center gap-2">
          <Input
            label="Yeni seçenek (Türkçe)"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className="flex-1 min-w-0 !mb-0"
            onKeyDown={(e) => e.key === 'Enter' && void addItem()}
            autoFocus
            disabled={busy}
          />
          <div className="flex items-center gap-1.5 shrink-0 self-center">
            <button
              type="button"
              onClick={() => void addItem()}
              className="h-9 px-3 rounded-lg text-xs font-semibold transition hover:opacity-90 active:scale-[0.98] inline-flex items-center gap-1.5"
              style={{
                background: 'var(--admin-accent)',
                color: '#ffffff',
              }}
              disabled={busy}
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Ekle
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setNewValue('');
              }}
              className="h-9 px-2.5 rounded-lg text-xs font-medium admin-text-muted transition hover:bg-[var(--admin-accent-soft)]"
              disabled={busy}
            >
              İptal
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition hover:opacity-90"
          style={{ background: 'var(--admin-accent-soft)', color: 'var(--admin-accent)' }}
          disabled={busy}
        >
          <Plus className="w-3.5 h-3.5" />
          Yeni ekle
        </button>
      )}
    </div>
  );
}

export function ManageableTagPillGroup({
  title,
  hint,
  kind,
  options,
  selected,
  onChange,
  catalog,
  onCatalogChange,
  languageCodes = ['tr', 'en', 'ru', 'ar'],
}: {
  title: string;
  hint?: string;
  kind: CatalogKind;
  options: { id: string; label: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  catalog: PrefCatalog;
  onCatalogChange: (catalog: PrefCatalog) => void;
  /** Dil Ayarları'ndaki aktif dil kodları */
  languageCodes?: string[];
}) {
  const [editing, setEditing] = useState(false);

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  function updateCatalogItems(items: PrefCatalogItem[]) {
    const removed = new Set(
      (kind === 'allergen' ? catalog.allergens : catalog.diets)
        .filter((t) => !items.some((i) => i.id === t.id))
        .map((t) => t.id)
    );
    const nextCatalog: PrefCatalog =
      kind === 'allergen'
        ? { ...catalog, allergens: items }
        : { ...catalog, diets: items };
    onCatalogChange(nextCatalog);
    if (removed.size > 0) {
      onChange(selected.filter((id) => !removed.has(id)));
    }
  }

  const catalogItems = kind === 'allergen' ? catalog.allergens : catalog.diets;

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--admin-text)]">{title}</p>
          {hint ? <p className="text-xs admin-text-muted mt-0.5">{hint}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="p-2 rounded-xl shrink-0 transition hover:opacity-90"
          style={{
            background: editing ? 'var(--admin-accent)' : 'var(--admin-accent-soft)',
            color: editing ? '#fff' : 'var(--admin-accent)',
          }}
          title={editing ? 'Listeyi kapat' : 'Listeyi düzenle'}
          aria-pressed={editing}
        >
          <Pencil className="w-4 h-4" />
        </button>
      </div>

      {editing && (
        <CatalogEditorPanel
          kind={kind}
          items={catalogItems}
          languageCodes={languageCodes}
          onChange={updateCatalogItems}
          onClose={() => setEditing(false)}
        />
      )}

      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = selected.includes(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => toggle(opt.id)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold border transition"
              style={{
                background: active ? 'var(--admin-accent)' : 'var(--admin-input-bg)',
                color: active ? '#ffffff' : 'var(--admin-text)',
                borderColor: active ? 'var(--admin-accent)' : 'var(--admin-card-border)',
              }}
              aria-pressed={active}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function usePrefCatalogState(initial: PrefCatalog) {
  const [catalog, setCatalog] = useState<PrefCatalog>(initial);
  useEffect(() => {
    setCatalog(initial);
  }, [initial]);
  return [catalog, setCatalog] as const;
}
