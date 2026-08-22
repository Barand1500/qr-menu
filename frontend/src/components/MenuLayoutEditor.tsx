import { useCallback, useEffect, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, X, Eye, LayoutGrid } from 'lucide-react';
import { api } from '@/lib/api';
import { Spinner } from '@/components/ui';

interface Group {
  id: number;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

function SortableGroupItem({
  group,
  onRemove,
  onSelect,
  selected,
}: {
  group: Group;
  onRemove: () => void;
  onSelect: () => void;
  selected: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `active-${group.id}`,
  });

  return (
    <div
      ref={setNodeRef}
      onClick={onSelect}
      className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition ${
        selected ? 'ring-2 ring-[var(--admin-accent)]' : ''
      }`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        background: 'var(--admin-input-bg)',
        borderColor: selected ? 'var(--admin-accent)' : 'var(--admin-card-border)',
      }}
    >
      <button
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="cursor-grab text-[var(--admin-text-subtle)] hover:text-[var(--admin-text)]"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <span className="flex-1 text-sm font-medium text-[var(--admin-text)] truncate">
        {group.name}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="p-1 rounded-lg hover:bg-red-500/10 text-red-500"
        title="Menüden kaldır"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function PassiveGroupItem({
  group,
  onAdd,
  onSelect,
  selected,
}: {
  group: Group;
  onAdd: () => void;
  onSelect: () => void;
  selected: boolean;
}) {
  return (
    <div
      onClick={onSelect}
      className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition ${
        selected ? 'ring-2 ring-[var(--admin-accent)]' : ''
      }`}
      style={{
        background: 'var(--admin-card)',
        borderColor: selected ? 'var(--admin-accent)' : 'var(--admin-card-border)',
        opacity: 0.85,
      }}
    >
      <span className="flex-1 text-sm text-[var(--admin-text-muted)] truncate">{group.name}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onAdd();
        }}
        className="p-1.5 rounded-lg hover:bg-[var(--admin-accent-soft)]"
        style={{ color: 'var(--admin-accent)' }}
        title="Menüye ekle"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function MenuLayoutEditor({ onClose }: { onClose?: () => void }) {
  const [activeGroups, setActiveGroups] = useState<Group[]>([]);
  const [passiveGroups, setPassiveGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [dragItem, setDragItem] = useState<Group | null>(null);
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const load = useCallback(async () => {
    const res = await api<{ data: Group[] }>('/api/admin/groups?limit=100');
    const sorted = [...res.data].sort((a, b) => a.sortOrder - b.sortOrder);
    setActiveGroups(sorted.filter((g) => g.isActive));
    setPassiveGroups(sorted.filter((g) => !g.isActive));
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function persistOrder(groups: Group[]) {
    setSaving(true);
    try {
      await api('/api/admin/groups/reorder/bulk', {
        method: 'PUT',
        body: JSON.stringify({
          items: groups.map((g, i) => ({ id: g.id, sortOrder: i + 1 })),
        }),
      });
    } finally {
      setSaving(false);
    }
  }

  async function toggleGroup(group: Group, activate: boolean) {
    setSaving(true);
    try {
      if (!activate && group.isActive) {
        await api(`/api/admin/groups/${group.id}/toggle`, { method: 'PATCH' });
      } else if (activate && !group.isActive) {
        await api(`/api/admin/groups/${group.id}/toggle`, { method: 'PATCH' });
      }
      await load();
    } finally {
      setSaving(false);
    }
  }

  function handleDragStart(e: DragStartEvent) {
    const id = String(e.active.id).replace('active-', '');
    const g = activeGroups.find((x) => x.id === Number(id));
    if (g) setDragItem(g);
  }

  async function handleDragEnd(e: DragEndEvent) {
    setDragItem(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const oldIndex = activeGroups.findIndex((g) => `active-${g.id}` === active.id);
    const newIndex = activeGroups.findIndex((g) => `active-${g.id}` === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(activeGroups, oldIndex, newIndex);
    setActiveGroups(reordered);
    await persistOrder(reordered);
  }

  async function removeFromMenu(group: Group) {
    await toggleGroup(group, false);
  }

  async function addToMenu(group: Group) {
    await toggleGroup(group, true);
  }

  const selectedGroup =
    [...activeGroups, ...passiveGroups].find((g) => g.id === selectedId) ?? null;

  if (loading) return <Spinner />;

  return (
    <div className="admin-card p-5 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-[var(--admin-text)] flex items-center gap-2">
            <LayoutGrid className="w-5 h-5" style={{ color: 'var(--admin-accent)' }} />
            Menü Düzenleme
          </h3>
          <p className="text-xs admin-text-muted mt-1">
            Aktif grupları sürükleyerek sıralayın. Pasif grupları menüye ekleyin.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="flex rounded-xl p-1"
            style={{ background: 'var(--admin-input-bg)' }}
          >
            <button
              onClick={() => setLayoutMode('grid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                layoutMode === 'grid' ? 'shadow-sm' : ''
              }`}
              style={
                layoutMode === 'grid'
                  ? { background: 'var(--admin-card)', color: 'var(--admin-accent)' }
                  : { color: 'var(--admin-text-muted)' }
              }
            >
              Grid
            </button>
            <button
              onClick={() => setLayoutMode('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                layoutMode === 'list' ? 'shadow-sm' : ''
              }`}
              style={
                layoutMode === 'list'
                  ? { background: 'var(--admin-card)', color: 'var(--admin-accent)' }
                  : { color: 'var(--admin-text-muted)' }
              }
            >
              Liste
            </button>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl text-sm admin-text-muted hover:bg-[var(--admin-accent-soft)]"
            >
              Kapat
            </button>
          )}
          {saving && (
            <span className="text-xs admin-text-subtle animate-pulse">Kaydediliyor...</span>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Aktif gruplar */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Eye className="w-4 h-4" style={{ color: 'var(--admin-accent)' }} />
            <h4 className="text-sm font-semibold text-[var(--admin-text)]">
              Menüde Görünenler ({activeGroups.length})
            </h4>
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={activeGroups.map((g) => `active-${g.id}`)}
              strategy={verticalListSortingStrategy}
            >
              <div
                className={`space-y-2 min-h-[120px] p-3 rounded-xl border-2 border-dashed ${
                  layoutMode === 'grid' ? 'sm:grid sm:grid-cols-2 sm:space-y-0 sm:gap-2' : ''
                }`}
                style={{ borderColor: 'var(--admin-accent-soft)' }}
              >
                {activeGroups.length === 0 ? (
                  <p className="text-sm admin-text-subtle text-center py-6 col-span-2">
                    Henüz aktif grup yok. Alttan ekleyin.
                  </p>
                ) : (
                  activeGroups.map((group) => (
                    <SortableGroupItem
                      key={group.id}
                      group={group}
                      selected={selectedId === group.id}
                      onSelect={() => setSelectedId(group.id)}
                      onRemove={() => removeFromMenu(group)}
                    />
                  ))
                )}
              </div>
            </SortableContext>
            <DragOverlay>
              {dragItem && (
                <div
                  className="p-3 rounded-xl shadow-lg text-sm font-medium"
                  style={{ background: 'var(--admin-card)', color: 'var(--admin-text)' }}
                >
                  {dragItem.name}
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>

        {/* Pasif / eklenmeyenler */}
        <div>
          <h4 className="text-sm font-semibold text-[var(--admin-text-muted)] mb-3">
            Eklenmeyenler / Pasif ({passiveGroups.length})
          </h4>
          <div
            className={`space-y-2 min-h-[120px] p-3 rounded-xl border border-dashed ${
              layoutMode === 'grid' ? 'sm:grid sm:grid-cols-2 sm:space-y-0 sm:gap-2' : ''
            }`}
            style={{ borderColor: 'var(--admin-card-border)' }}
          >
            {passiveGroups.length === 0 ? (
              <p className="text-sm admin-text-subtle text-center py-6 col-span-2">
                Tüm gruplar menüde görünüyor.
              </p>
            ) : (
              passiveGroups.map((group) => (
                <PassiveGroupItem
                  key={group.id}
                  group={group}
                  selected={selectedId === group.id}
                  onSelect={() => setSelectedId(group.id)}
                  onAdd={() => addToMenu(group)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Seçili grup detayı */}
      {selectedGroup && (
        <div
          className="p-4 rounded-xl border"
          style={{
            background: 'var(--admin-accent-soft)',
            borderColor: 'var(--admin-card-border)',
          }}
        >
          <p className="text-sm font-semibold text-[var(--admin-text)]">{selectedGroup.name}</p>
          <p className="text-xs admin-text-muted mt-1">
            Sıra: {selectedGroup.sortOrder} ·{' '}
            {selectedGroup.isActive ? 'Menüde aktif' : 'Pasif / eklenmemiş'}
          </p>
          <div className="flex gap-2 mt-3">
            {selectedGroup.isActive ? (
              <button
                onClick={() => removeFromMenu(selectedGroup)}
                className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 font-medium"
              >
                Menüden Kaldır
              </button>
            ) : (
              <button
                onClick={() => addToMenu(selectedGroup)}
                className="text-xs px-3 py-1.5 rounded-lg font-medium text-white"
                style={{ background: 'var(--admin-accent)' }}
              >
                Menüye Ekle
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
