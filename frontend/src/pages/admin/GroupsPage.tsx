import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Pencil,
  EyeOff,
  Eye,
  GripVertical,
  FolderTree,
  Layers,
  SlidersHorizontal,
  ChevronDown,
  Search,
  X,
  Package,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api, imageUrl } from '@/lib/api';
import { Badge, Button, Card, EmptyState, Input, PageHeader, Spinner } from '@/components/ui';
import GroupModal, { type GroupFormState } from '@/components/GroupModal';

interface Group {
  id: number;
  name: string;
  parentId: number | null;
  parentName: string | null;
  isSubGroup: boolean;
  imageUrl?: string | null;
  sortOrder: number;
  isActive: boolean;
  childrenCount: number;
  productCount: number;
  translations: { languageId: number; languageCode: string; name: string }[];
}

interface Language {
  id: number;
  code: string;
  name: string;
}

type ModalMode = 'create' | 'edit' | 'sub' | null;
type StatusFilter = 'all' | 'active' | 'passive';
type TypeFilter = 'all' | 'main' | 'sub';

const emptyForm: GroupFormState = { translations: {}, isActive: true, parentId: null };

function SortableRow({
  group,
  sortMode,
  pickMode,
  selectedForSub,
  onEdit,
  onToggle,
  onPickParent,
}: {
  group: Group;
  sortMode: boolean;
  pickMode: boolean;
  selectedForSub: number | null;
  onEdit: (g: Group) => void;
  onToggle: (id: number) => void;
  onPickParent: (g: Group) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: group.id,
    disabled: !sortMode,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const canPick = pickMode && !group.isSubGroup;
  const isHighlighted = pickMode && selectedForSub === group.id;

  return (
    <tr
      ref={setNodeRef}
      onClick={() => canPick && onPickParent(group)}
      className={`border-b transition-colors ${
        isHighlighted
          ? 'bg-[var(--admin-accent-soft)] ring-2 ring-inset ring-[var(--admin-accent)]'
          : canPick
            ? 'cursor-pointer hover:bg-[var(--admin-accent-soft)]/60'
            : 'hover:bg-[var(--admin-accent-soft)]/30'
      }`}
      style={{
        ...style,
        borderColor: 'var(--admin-card-border)',
      }}
    >
      {sortMode && (
        <td className="py-3.5 px-3 w-10">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 rounded-lg admin-text-subtle hover:bg-[var(--admin-input-bg)]"
          >
            <GripVertical className="w-4 h-4" />
          </button>
        </td>
      )}
      <td className="py-3.5 px-4 w-[72px]">
        {group.imageUrl ? (
          <img
            src={imageUrl(group.imageUrl)}
            alt=""
            className="w-12 h-12 rounded-xl object-cover"
            style={{ background: 'var(--admin-input-bg)' }}
          />
        ) : (
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--admin-accent-soft)' }}
          >
            {group.isSubGroup ? (
              <FolderTree className="w-5 h-5" style={{ color: 'var(--admin-accent)' }} />
            ) : (
              <Layers className="w-5 h-5" style={{ color: 'var(--admin-accent)' }} />
            )}
          </div>
        )}
      </td>
      <td className="py-3.5 px-4 min-w-[180px]">
        <div
          className="flex items-center gap-2"
          style={{ paddingLeft: group.isSubGroup ? '1.25rem' : 0 }}
        >
          {group.isSubGroup && (
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--admin-accent)' }} />
          )}
          <div className="min-w-0">
            <p className="font-semibold text-[var(--admin-text)] truncate">{group.name}</p>
            {group.isSubGroup && group.parentName && (
              <p className="text-xs admin-text-subtle truncate">Üst: {group.parentName}</p>
            )}
          </div>
        </div>
      </td>
      <td className="py-3.5 px-4 hidden md:table-cell">
        <span
          className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full"
          style={{
            background: group.isSubGroup ? 'var(--admin-input-bg)' : 'var(--admin-accent-soft)',
            color: group.isSubGroup ? 'var(--admin-text-muted)' : 'var(--admin-accent-text)',
          }}
        >
          {group.isSubGroup ? 'Alt Grup' : 'Ana Grup'}
        </span>
      </td>
      <td className="py-3.5 px-4 hidden sm:table-cell text-sm admin-text-muted">
        {group.sortOrder}
      </td>
      <td className="py-3.5 px-4 hidden lg:table-cell text-sm admin-text-muted">
        <span className="inline-flex items-center gap-1">
          <Package className="w-3.5 h-3.5" />
          {group.productCount}
        </span>
      </td>
      <td className="py-3.5 px-4">
        <Badge active={group.isActive} />
      </td>
      <td className="py-3.5 px-4 w-[100px]">
        {!pickMode && (
          <div className="flex gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(group);
              }}
              className="p-2 rounded-xl transition hover:bg-[var(--admin-accent-soft)]"
              style={{ color: 'var(--admin-accent)' }}
              title="Düzenle"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggle(group.id);
              }}
              className="p-2 rounded-xl transition hover:bg-[var(--admin-input-bg)] admin-text-muted"
              title={group.isActive ? 'Pasifleştir' : 'Aktifleştir'}
            >
              {group.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

export default function GroupsPage() {
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortMode, setSortMode] = useState(false);

  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editing, setEditing] = useState<Group | null>(null);
  const [form, setForm] = useState<GroupFormState>(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [subGroupPickMode, setSubGroupPickMode] = useState(false);
  const [pickParent, setPickParent] = useState<Group | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const load = useCallback(async () => {
    const [g, langs] = await Promise.all([
      api<{ data: Group[] }>('/api/admin/groups?limit=200'),
      api<Language[]>('/api/admin/languages'),
    ]);
    setAllGroups(g.data);
    setLanguages(langs.filter((l) => l.code === 'tr' || l.code === 'en'));
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const filteredGroups = useMemo(() => {
    let list = [...allGroups];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          g.parentName?.toLowerCase().includes(q)
      );
    }

    if (statusFilter === 'active') list = list.filter((g) => g.isActive);
    if (statusFilter === 'passive') list = list.filter((g) => !g.isActive);
    if (typeFilter === 'main') list = list.filter((g) => !g.isSubGroup);
    if (typeFilter === 'sub') list = list.filter((g) => g.isSubGroup);

    const roots = list.filter((g) => !g.isSubGroup).sort((a, b) => a.sortOrder - b.sortOrder);
    const ordered: Group[] = [];
    for (const root of roots) {
      ordered.push(root);
      ordered.push(
        ...list.filter((g) => g.parentId === root.id).sort((a, b) => a.sortOrder - b.sortOrder)
      );
    }
    const seen = new Set(ordered.map((g) => g.id));
    list.filter((g) => !seen.has(g.id)).forEach((g) => ordered.push(g));
    return ordered;
  }, [allGroups, search, statusFilter, typeFilter]);

  const activeFilterCount = [
    statusFilter !== 'all',
    typeFilter !== 'all',
    search.trim().length > 0,
  ].filter(Boolean).length;

  function openCreateMain() {
    setSubGroupPickMode(false);
    setPickParent(null);
    setEditing(null);
    setForm(emptyForm);
    setImageFile(null);
    setModalMode('create');
  }

  function startSubGroupPick() {
    setSubGroupPickMode(true);
    setPickParent(null);
    setModalMode(null);
  }

  function cancelSubGroupPick() {
    setSubGroupPickMode(false);
    setPickParent(null);
  }

  function handlePickParent(group: Group) {
    if (group.isSubGroup) return;
    setPickParent(group);
    setSubGroupPickMode(false);
    setEditing(null);
    setForm({ ...emptyForm, parentId: group.id });
    setImageFile(null);
    setModalMode('sub');
  }

  function openEdit(group: Group) {
    setSubGroupPickMode(false);
    setEditing(group);
    setForm({
      translations: Object.fromEntries(group.translations.map((t) => [t.languageCode, t.name])),
      isActive: group.isActive,
      parentId: group.parentId,
    });
    setImageFile(null);
    setImagePreview(group.imageUrl ? imageUrl(group.imageUrl) : null);
    setModalMode('edit');
  }

  function closeModal() {
    setModalMode(null);
    setEditing(null);
    setForm(emptyForm);
    setImageFile(null);
    setImagePreview(null);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const translations = languages.map((l) => ({
        languageId: l.id,
        name: form.translations[l.code] || '',
      }));

      if (editing) {
        await api(`/api/admin/groups/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify({ translations, isActive: form.isActive }),
        });
        if (imageFile) await uploadImage(editing.id);
      } else {
        const created = await api<Group>('/api/admin/groups', {
          method: 'POST',
          body: JSON.stringify({
            translations,
            isActive: form.isActive,
            parentId: form.parentId,
          }),
        });
        if (imageFile) await uploadImage(created.id);
      }

      closeModal();
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function uploadImage(id: number) {
    const fd = new FormData();
    fd.append('image', imageFile!);
    await fetch(`/api/admin/groups/${id}/image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: fd,
    });
  }

  async function handleToggle(id: number) {
    await api(`/api/admin/groups/${id}/toggle`, { method: 'PATCH' });
    await load();
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeGroup = filteredGroups.find((g) => g.id === active.id);
    const overGroup = filteredGroups.find((g) => g.id === over.id);
    if (!activeGroup || !overGroup) return;
    if (activeGroup.parentId !== overGroup.parentId) return;

    const siblings = filteredGroups.filter((g) => g.parentId === activeGroup.parentId);
    const oldIndex = siblings.findIndex((g) => g.id === active.id);
    const newIndex = siblings.findIndex((g) => g.id === over.id);
    const reordered = arrayMove(siblings, oldIndex, newIndex).map((g, i) => ({
      ...g,
      sortOrder: i + 1,
    }));

    setAllGroups((prev) => {
      const map = new Map(reordered.map((g) => [g.id, g]));
      return prev.map((g) => map.get(g.id) ?? g);
    });

    await api('/api/admin/groups/reorder/bulk', {
      method: 'PUT',
      body: JSON.stringify({
        items: reordered.map((g) => ({ id: g.id, sortOrder: g.sortOrder })),
      }),
    });
  }

  function clearFilters() {
    setSearch('');
    setStatusFilter('all');
    setTypeFilter('all');
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Gruplar"
        actions={
          <>
            <Button
              variant={sortMode ? 'primary' : 'secondary'}
              onClick={() => {
                setSortMode(!sortMode);
                cancelSubGroupPick();
              }}
            >
              <GripVertical className="w-4 h-4" />
              {sortMode ? 'Sıralamayı Bitir' : 'Sıralama Modu'}
            </Button>
            <Button variant="secondary" onClick={startSubGroupPick}>
              <FolderTree className="w-4 h-4" />
              Yeni Alt Grup Ekle
            </Button>
            <Button onClick={openCreateMain}>
              <Plus className="w-4 h-4" />
              Yeni Grup Ekle
            </Button>
          </>
        }
      />

      {subGroupPickMode && (
        <div
          className="flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl text-sm font-medium animate-pulse"
          style={{
            background: 'var(--admin-accent-soft)',
            color: 'var(--admin-accent-text)',
            border: '1px dashed var(--admin-accent)',
          }}
        >
          <div className="flex items-center gap-2">
            <FolderTree className="w-4 h-4 shrink-0" />
            <span>Listeden bir ana grup seçiniz — alt grup bu grubun altına eklenecek</span>
          </div>
          <button
            onClick={cancelSubGroupPick}
            className="p-1.5 rounded-lg hover:bg-black/5 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <Card className="overflow-hidden !p-0">
        <div
          className="p-4 sm:p-5 border-b flex flex-col gap-4"
          style={{ borderColor: 'var(--admin-card-border)' }}
        >
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 admin-text-subtle" />
              <Input
                className="pl-10"
                placeholder="Grup adı veya üst grup ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setFilterOpen(!filterOpen)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition border ${
                  filterOpen ? 'ring-2 ring-[var(--admin-accent)]' : ''
                }`}
                style={{
                  background: 'var(--admin-input-bg)',
                  borderColor: 'var(--admin-card-border)',
                  color: 'var(--admin-text)',
                }}
              >
                <SlidersHorizontal className="w-4 h-4" />
                Filtrele
                {activeFilterCount > 0 && (
                  <span
                    className="ml-1 min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold flex items-center justify-center text-white"
                    style={{ background: 'var(--admin-accent)' }}
                  >
                    {activeFilterCount}
                  </span>
                )}
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${filterOpen ? 'rotate-180' : ''}`}
                />
              </button>
              <span className="text-sm admin-text-muted">
                {filteredGroups.length} / {allGroups.length} kayıt
              </span>
            </div>
          </div>

          <div
            className={`grid transition-all duration-300 ease-out ${
              filterOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
              <div
                className="rounded-2xl p-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
                style={{ background: 'var(--admin-input-bg)' }}
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide admin-text-muted mb-2">
                    Durum
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ['all', 'Tümü'],
                        ['active', 'Aktif'],
                        ['passive', 'Pasif'],
                      ] as const
                    ).map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => setStatusFilter(val)}
                        className="px-3 py-1.5 rounded-xl text-sm font-medium transition"
                        style={{
                          background:
                            statusFilter === val ? 'var(--admin-accent)' : 'var(--admin-card)',
                          color:
                            statusFilter === val ? '#fff' : 'var(--admin-text-muted)',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide admin-text-muted mb-2">
                    Grup Tipi
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ['all', 'Tümü'],
                        ['main', 'Ana Grup'],
                        ['sub', 'Alt Grup'],
                      ] as const
                    ).map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => setTypeFilter(val)}
                        className="px-3 py-1.5 rounded-xl text-sm font-medium transition"
                        style={{
                          background:
                            typeFilter === val ? 'var(--admin-accent)' : 'var(--admin-card)',
                          color: typeFilter === val ? '#fff' : 'var(--admin-text-muted)',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-end">
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full sm:w-auto">
                    Filtreleri Temizle
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto admin-scroll">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-left text-xs uppercase tracking-wide admin-text-muted"
                  style={{ background: 'var(--admin-input-bg)' }}
                >
                  {sortMode && <th className="w-10 py-3.5 px-3" />}
                  <th className="py-3.5 px-4 font-semibold w-[72px]">Görsel</th>
                  <th className="py-3.5 px-4 font-semibold">Grup Adı</th>
                  <th className="py-3.5 px-4 font-semibold hidden md:table-cell">Tip</th>
                  <th className="py-3.5 px-4 font-semibold hidden sm:table-cell">Sıra</th>
                  <th className="py-3.5 px-4 font-semibold hidden lg:table-cell">Ürün</th>
                  <th className="py-3.5 px-4 font-semibold">Durum</th>
                  <th className="py-3.5 px-4 font-semibold w-[100px]">İşlem</th>
                </tr>
              </thead>
              <SortableContext
                items={filteredGroups.map((g) => g.id)}
                strategy={verticalListSortingStrategy}
              >
                <tbody>
                  {filteredGroups.length === 0 ? (
                    <tr>
                      <td colSpan={sortMode ? 8 : 7}>
                        <EmptyState message="Filtrelere uygun grup bulunamadı" />
                      </td>
                    </tr>
                  ) : (
                    filteredGroups.map((group) => (
                      <SortableRow
                        key={group.id}
                        group={group}
                        sortMode={sortMode}
                        pickMode={subGroupPickMode}
                        selectedForSub={pickParent?.id ?? null}
                        onEdit={openEdit}
                        onToggle={handleToggle}
                        onPickParent={handlePickParent}
                      />
                    ))
                  )}
                </tbody>
              </SortableContext>
            </table>
          </DndContext>
        </div>
      </Card>

      <GroupModal
        open={modalMode !== null}
        mode={modalMode || 'create'}
        parentName={pickParent?.name || editing?.parentName}
        languages={languages}
        form={form}
        imagePreview={imagePreview}
        saving={saving}
        onClose={closeModal}
        onSave={handleSave}
        onFormChange={setForm}
        onImageChange={setImageFile}
      />
    </div>
  );
}
