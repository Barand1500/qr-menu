import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Pencil,
  EyeOff,
  Eye,
  GripVertical,
  FolderTree,
  Layers,
  X,
  Package,
  CornerDownRight,
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
import GroupProductsModal from '@/components/GroupProductsModal';
import {
  AdminFilterBar,
  FilterChipGroup,
  ToggleSwitch,
} from '@/components/AdminFilterBar';

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

type SubPosition = 'none' | 'first' | 'middle' | 'last' | 'only';

interface RowLayout {
  hideBottomBorder: boolean;
  subPosition: SubPosition;
  hasChildren: boolean;
}

function getRowLayout(groups: Group[], index: number): RowLayout {
  const group = groups[index];
  const prev = groups[index - 1];
  const next = groups[index + 1];

  if (!group.isSubGroup) {
    const hasChildren = next?.parentId === group.id;
    return { hideBottomBorder: hasChildren, subPosition: 'none', hasChildren };
  }

  const isFirst = !prev || prev.id === group.parentId;
  const isLast = !next || next.parentId !== group.parentId;

  let subPosition: SubPosition;
  if (isFirst && isLast) subPosition = 'only';
  else if (isFirst) subPosition = 'first';
  else if (isLast) subPosition = 'last';
  else subPosition = 'middle';

  return { hideBottomBorder: !isLast, subPosition, hasChildren: false };
}

function SortableRow({
  group,
  layout,
  sortMode,
  pickMode,
  selectedForSub,
  onEdit,
  onToggle,
  onPickParent,
  onShowProducts,
}: {
  group: Group;
  layout: RowLayout;
  sortMode: boolean;
  pickMode: boolean;
  selectedForSub: number | null;
  onEdit: (g: Group) => void;
  onToggle: (g: Group) => void;
  onPickParent: (g: Group) => void;
  onShowProducts: (g: Group) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: group.id,
    disabled: !sortMode,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : group.isActive ? 1 : 0.38,
  };

  const canPick = pickMode && !group.isSubGroup;
  const isHighlighted = pickMode && selectedForSub === group.id;
  const isSub = group.isSubGroup;
  const { hideBottomBorder, hasChildren } = layout;

  const subRowBg = isSub
    ? { background: 'color-mix(in srgb, var(--admin-accent-soft) 40%, var(--admin-card))' }
    : {};

  return (
    <tr
      ref={setNodeRef}
      onClick={() => canPick && onPickParent(group)}
      className={`transition-all duration-300 ${
        hideBottomBorder ? '' : 'border-b'
      } ${!group.isActive ? 'grayscale-[30%]' : ''} ${
        isHighlighted
          ? 'bg-[var(--admin-accent-soft)] ring-2 ring-inset ring-[var(--admin-accent)]'
          : canPick
            ? 'cursor-pointer hover:bg-[var(--admin-accent-soft)]/60'
            : isSub
              ? 'hover:bg-[var(--admin-accent-soft)]/50'
              : 'hover:bg-[var(--admin-accent-soft)]/30'
      } ${hasChildren ? 'border-b-0' : ''}`}
      style={{
        ...style,
        borderColor: hideBottomBorder ? 'transparent' : 'var(--admin-card-border)',
        ...subRowBg,
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
      <td className={`py-3.5 px-4 w-[72px] ${isSub ? 'pl-6' : ''}`}>
        <div className="flex items-center gap-1">
          {isSub && (
            <CornerDownRight
              className="w-4 h-4 shrink-0 admin-text-subtle"
              style={{ color: 'var(--admin-accent)' }}
            />
          )}
          {group.imageUrl ? (
            <img
              src={imageUrl(group.imageUrl)}
              alt=""
              className={`${isSub ? 'w-10 h-10' : 'w-12 h-12'} rounded-xl object-cover`}
              style={{ background: 'var(--admin-input-bg)' }}
            />
          ) : (
            <div
              className={`${isSub ? 'w-10 h-10' : 'w-12 h-12'} rounded-xl flex items-center justify-center`}
              style={{ background: 'var(--admin-accent-soft)' }}
            >
              {group.isSubGroup ? (
                <FolderTree className={`${isSub ? 'w-4 h-4' : 'w-5 h-5'}`} style={{ color: 'var(--admin-accent)' }} />
              ) : (
                <Layers className="w-5 h-5" style={{ color: 'var(--admin-accent)' }} />
              )}
            </div>
          )}
        </div>
      </td>
      <td className="py-3.5 px-4 min-w-[180px]">
        <div className={`min-w-0 ${isSub ? 'pl-1' : ''}`}>
          <p
            className={`truncate text-[var(--admin-text)] ${
              isSub ? 'text-sm font-medium' : 'font-semibold'
            }`}
          >
            {group.name}
          </p>
          {hasChildren && (
            <p className="text-xs admin-text-subtle mt-0.5">
              {group.childrenCount} alt grup
            </p>
          )}
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
      <td className="py-3.5 px-4 hidden lg:table-cell">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onShowProducts(group);
          }}
          className="inline-flex items-center gap-1.5 text-sm font-medium px-2.5 py-1 rounded-xl transition hover:bg-[var(--admin-accent-soft)]"
          style={{ color: 'var(--admin-accent-text)' }}
          title="Grup ürünlerini gör"
        >
          <Package className="w-3.5 h-3.5" />
          {group.productCount}
        </button>
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
                onToggle(group);
              }}
              className={`p-2 rounded-xl transition ${
                group.isActive
                  ? 'hover:bg-amber-500/10 text-amber-600'
                  : 'hover:bg-emerald-500/10 text-emerald-600'
              }`}
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
  const [hideSubGroups, setHideSubGroups] = useState(false);
  const [sortMode, setSortMode] = useState(false);

  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editing, setEditing] = useState<Group | null>(null);
  const [form, setForm] = useState<GroupFormState>(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [subGroupPickMode, setSubGroupPickMode] = useState(false);
  const [pickParent, setPickParent] = useState<Group | null>(null);

  const [productsModalGroup, setProductsModalGroup] = useState<Group | null>(null);

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

    if (hideSubGroups) {
      return list.filter((g) => !g.isSubGroup).sort((a, b) => a.sortOrder - b.sortOrder);
    }

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
  }, [allGroups, search, statusFilter, typeFilter, hideSubGroups]);

  const activeFilterCount = [
    statusFilter !== 'all',
    typeFilter !== 'all',
    search.trim().length > 0,
    hideSubGroups,
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

  async function handleToggle(group: Group) {
    const nextActive = !group.isActive;
    setAllGroups((prev) =>
      prev.map((g) => (g.id === group.id ? { ...g, isActive: nextActive } : g))
    );
    try {
      await api(`/api/admin/groups/${group.id}/toggle`, { method: 'PATCH' });
    } catch {
      setAllGroups((prev) =>
        prev.map((g) => (g.id === group.id ? { ...g, isActive: group.isActive } : g))
      );
    }
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
    setHideSubGroups(false);
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
        <AdminFilterBar
          search={
            <Input
              label="Grup adı veya üst grup ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          }
          filterOpen={filterOpen}
          onFilterToggle={() => setFilterOpen(!filterOpen)}
          activeFilterCount={activeFilterCount}
          recordLabel={`${filteredGroups.length} / ${allGroups.length} kayıt`}
          onClear={clearFilters}
        >
          <FilterChipGroup
            label="Durum"
            value={statusFilter}
            options={[
              { value: 'all', label: 'Tümü' },
              { value: 'active', label: 'Aktif' },
              { value: 'passive', label: 'Pasif' },
            ]}
            onChange={setStatusFilter}
          />
          <FilterChipGroup
            label="Grup Tipi"
            value={typeFilter}
            options={[
              { value: 'all', label: 'Tümü' },
              { value: 'main', label: 'Ana Grup' },
              { value: 'sub', label: 'Alt Grup' },
            ]}
            onChange={setTypeFilter}
          />
          <div className="flex items-center">
            <ToggleSwitch
              checked={hideSubGroups}
              onChange={setHideSubGroups}
              label="Alt grupları gizle"
              description="Listede yalnızca ana gruplar görünür"
            />
          </div>
        </AdminFilterBar>

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
                    filteredGroups.map((group, index) => (
                      <SortableRow
                        key={group.id}
                        group={group}
                        layout={getRowLayout(filteredGroups, index)}
                        sortMode={sortMode}
                        pickMode={subGroupPickMode}
                        selectedForSub={pickParent?.id ?? null}
                        onEdit={openEdit}
                        onToggle={handleToggle}
                        onPickParent={handlePickParent}
                        onShowProducts={setProductsModalGroup}
                      />
                    ))
                  )}
                </tbody>
              </SortableContext>
            </table>
          </DndContext>
        </div>
      </Card>

      <GroupProductsModal
        open={productsModalGroup !== null}
        groupId={productsModalGroup?.id ?? null}
        groupName={productsModalGroup?.name ?? ''}
        onClose={() => setProductsModalGroup(null)}
      />

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
