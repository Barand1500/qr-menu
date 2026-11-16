import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Eye,
  EyeOff,
  FolderPlus,
  Package,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
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
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { api, imageUrl } from '@/lib/api';
import { getActiveLanguages, type AdminLanguage } from '@/lib/languages';
import { Button, Spinner } from '@/components/ui';
import { AdminListPager } from '@/components/AdminListPager';
import GroupModal, { type GroupFormState } from '@/components/GroupModal';
import GroupProductsModal from '@/components/GroupProductsModal';
import GroupListRow from '@/components/admin/groups/GroupListRow';
import GroupsDialog from '@/components/admin/groups/GroupsDialog';
import type { AdminGroup as Group } from '@/components/admin/groups/types';
import '@/components/admin/groups/groups.css';

const emptyForm: GroupFormState = {
  translations: {},
  isActive: true,
  parentId: null,
};
const byOrder = (a: Group, b: Group) =>
  a.sortOrder - b.sortOrder || a.id - b.id;
type Status = 'all' | 'active' | 'passive';
type Kind = 'all' | 'main' | 'sub';
type Notice = { error: boolean; text: string } | null;

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [languages, setLanguages] = useState<AdminLanguage[]>([]);
  const [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState(''),
    [status, setStatus] = useState<Status>('all'),
    [kind, setKind] = useState<Kind>('all');
  const [filtersOpen, setFiltersOpen] = useState(false),
    [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<Notice>(null),
    [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'sub' | null>(
    null,
  );
  const [editing, setEditing] = useState<Group | null>(null),
    [parent, setParent] = useState<Group | null>(null);
  const [form, setForm] = useState<GroupFormState>(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null),
    [imagePreview, setImagePreview] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [productsGroup, setProductsGroup] = useState<Group | null>(null),
    [deleteTarget, setDeleteTarget] = useState<Group | null>(null);
  const [actions, setActions] = useState<{
    id: number;
    point: { x: number; y: number };
  } | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const load = useCallback(async () => {
    const [first, langs] = await Promise.all([
      api<{ data: Group[]; pagination?: { total: number } }>(
        '/api/admin/groups?limit=200',
      ),
      api<AdminLanguage[]>('/api/admin/languages'),
    ]);
    const result = [...first.data];
    for (let next = 2; result.length < (first.pagination?.total || 0); next++) {
      const batch = await api<{ data: Group[] }>(
        `/api/admin/groups?limit=200&page=${next}`,
      );
      if (!batch.data.length) break;
      result.push(...batch.data);
    }
    setGroups(result);
    setLanguages(getActiveLanguages(langs));
    setLoadError('');
  }, []);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      await load();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Gruplar yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [load]);
  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => {
    if (!imageFile) {
      setImagePreview(editing?.imageUrl ? imageUrl(editing.imageUrl) : null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile, editing]);
  useEffect(() => setPage(1), [search, status, kind]);
  const matches = useCallback(
    (g: Group) => {
      const q = search.trim().toLocaleLowerCase('tr');
      return (
        (!q ||
          [
            g.name,
            g.parentName || '',
            ...g.translations.map((t) => t.name),
          ].some((name) => name.toLocaleLowerCase('tr').includes(q))) &&
        (status === 'all' || g.isActive === (status === 'active')) &&
        (kind === 'all' || g.isSubGroup === (kind === 'sub'))
      );
    },
    [search, status, kind],
  );
  const roots = useMemo(() => {
    const list = groups
      .filter((g) => g.parentId == null)
      .sort(byOrder)
      .map((root) => ({
        root,
        children: groups.filter((g) => g.parentId === root.id).sort(byOrder),
      }));
    groups
      .filter(
        (g) => g.parentId != null && !groups.some((p) => p.id === g.parentId),
      )
      .sort(byOrder)
      .forEach((root) => list.push({ root, children: [] }));
    return list.filter(
      ({ root, children }) => matches(root) || children.some(matches),
    );
  }, [groups, matches]);
  const filtering = Boolean(
    search.trim() || status !== 'all' || kind !== 'all',
  );
  const pageSize = 12,
    pageCount = Math.max(1, Math.ceil(roots.length / pageSize)),
    safePage = Math.min(page, pageCount);
  const blocks = roots.slice((safePage - 1) * pageSize, safePage * pageSize);
  const visible = blocks.flatMap(({ root, children }) => [
    root,
    ...(filtering || expanded.has(root.id)
      ? children.filter((g) => !filtering || matches(g))
      : []),
  ]);
  const currentAction = groups.find((g) => g.id === actions?.id);
  const siblings = currentAction
    ? groups.filter((g) => g.parentId === currentAction.parentId).sort(byOrder)
    : [];
  const actionIndex = siblings.findIndex((g) => g.id === currentAction?.id);
  function begin() {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    return true;
  }
  function end() {
    busyRef.current = false;
    setBusy(false);
  }
  function error(e: unknown, fallback: string) {
    setNotice({ error: true, text: e instanceof Error ? e.message : fallback });
  }
  function openActions(group: Group, event: MouseEvent<HTMLElement>) {
    event.preventDefault();
    if (busy) return;
    const box = event.currentTarget.getBoundingClientRect();
    setActions({
      id: group.id,
      point: {
        x: event.type === 'contextmenu' ? event.clientX : box.right - 280,
        y: event.type === 'contextmenu' ? event.clientY : box.bottom + 6,
      },
    });
  }
  function openForm(group: Group | null, parentGroup: Group | null = null) {
    setActions(null);
    setEditing(group);
    setParent(parentGroup);
    setFormError('');
    setImageFile(null);
    setForm(
      group
        ? {
            translations: Object.fromEntries(
              group.translations.map((t) => [t.languageCode, t.name]),
            ),
            isActive: group.isActive,
            parentId: group.parentId,
          }
        : { ...emptyForm, parentId: parentGroup?.id ?? null },
    );
    setModalMode(group ? 'edit' : parentGroup ? 'sub' : 'create');
  }
  async function rename(group: Group, name: string) {
    if (!begin()) return false;
    try {
      const lang = languages.find((l) => l.code === 'tr') || languages[0];
      if (!lang) throw new Error('Önce etkin bir menü dili tanımlayın.');
      const updated = await api<Group>(`/api/admin/groups/${group.id}`, {
        method: 'PUT',
        body: JSON.stringify({ translations: [{ languageId: lang.id, name }] }),
      });
      setGroups((list) =>
        list.map((g) =>
          g.id === group.id
            ? { ...g, ...updated }
            : g.parentId === group.id
              ? { ...g, parentName: updated.name }
              : g,
        ),
      );
      setNotice({ error: false, text: 'Grup adı kaydedildi.' });
      return true;
    } catch (e) {
      error(e, 'Ad kaydedilemedi.');
      return false;
    } finally {
      end();
    }
  }
  async function toggle(group: Group) {
    if (!begin()) return;
    setGroups((list) =>
      list.map((g) =>
        g.id === group.id ? { ...g, isActive: !group.isActive } : g,
      ),
    );
    try {
      const updated = await api<Group>(`/api/admin/groups/${group.id}/toggle`, {
        method: 'PATCH',
      });
      setGroups((list) =>
        list.map((g) =>
          g.id === group.id ? { ...g, isActive: updated.isActive } : g,
        ),
      );
      setNotice({
        error: false,
        text: `${group.name} ${updated.isActive ? 'menüde gösteriliyor.' : 'menüde gizlendi.'}`,
      });
    } catch (e) {
      setGroups((list) =>
        list.map((g) =>
          g.id === group.id ? { ...g, isActive: group.isActive } : g,
        ),
      );
      error(e, 'Görünürlük değiştirilemedi.');
    } finally {
      end();
    }
  }
  function validateImage(file: File) {
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024)
      throw new Error('En fazla 5 MB boyutunda bir görsel seçin.');
  }
  async function upload(id: number, file: File) {
    validateImage(file);
    const body = new FormData();
    body.append('image', file);
    return api<Group>(`/api/admin/groups/${id}/image`, {
      method: 'POST',
      body,
    });
  }
  async function quickImage(group: Group, file: File) {
    if (!begin()) return;
    try {
      const updated = await upload(group.id, file);
      setGroups((list) =>
        list.map((g) =>
          g.id === group.id ? { ...g, imageUrl: updated.imageUrl } : g,
        ),
      );
      setNotice({ error: false, text: `${group.name} görseli kaydedildi.` });
    } catch (e) {
      error(e, 'Görsel yüklenemedi.');
    } finally {
      end();
    }
  }
  async function saveForm() {
    if (!begin()) return;
    setFormError('');
    try {
      const primary = languages.find((l) => l.code === 'tr') || languages[0];
      if (!primary || !form.translations[primary.code]?.trim())
        throw new Error('Grup adını yazın.');
      if (imageFile) validateImage(imageFile);
      const translations = languages.map((l) => ({
        languageId: l.id,
        name: form.translations[l.code]?.trim() || '',
      }));
      const saved = await api<Group>(
        editing ? `/api/admin/groups/${editing.id}` : '/api/admin/groups',
        {
          method: editing ? 'PUT' : 'POST',
          body: JSON.stringify({
            translations,
            isActive: form.isActive,
            ...(!editing ? { parentId: form.parentId } : {}),
          }),
        },
      );
      // A failed image upload must not create another copy on retry.
      setEditing(saved);
      setModalMode('edit');
      setGroups((list) =>
        list.some((g) => g.id === saved.id)
          ? list.map((g) => (g.id === saved.id ? saved : g))
          : [...list, saved],
      );
      if (imageFile) await upload(saved.id, imageFile);
      await load();
      if (saved.parentId)
        setExpanded((prev) => new Set([...prev, saved.parentId!]));
      setModalMode(null);
      setImageFile(null);
      setNotice({ error: false, text: 'Grup kaydedildi.' });
    } catch (e) {
      setFormError(
        e instanceof Error
          ? e.message
          : 'Kaydedilemedi. Bilgileriniz korunuyor.',
      );
    } finally {
      end();
    }
  }
  async function reorder(activeId: number, overId: number) {
    const active = groups.find((g) => g.id === activeId),
      over = groups.find((g) => g.id === overId);
    if (
      !active ||
      !over ||
      active.id === over.id ||
      active.parentId !== over.parentId ||
      !begin()
    )
      return;
    const previous = groups
      .filter((g) => g.parentId === active.parentId)
      .sort(byOrder);
    const ordered = arrayMove(
      previous,
      previous.findIndex((g) => g.id === activeId),
      previous.findIndex((g) => g.id === overId),
    ).map((g, i) => ({ ...g, sortOrder: i + 1 }));
    const map = new Map(ordered.map((g) => [g.id, g.sortOrder]));
    setGroups((list) =>
      list.map((g) =>
        map.has(g.id) ? { ...g, sortOrder: map.get(g.id)! } : g,
      ),
    );
    try {
      await api('/api/admin/groups/reorder/bulk', {
        method: 'PUT',
        body: JSON.stringify({
          items: ordered.map(({ id, sortOrder }) => ({ id, sortOrder })),
        }),
      });
      setNotice({ error: false, text: 'Menü sırası kaydedildi.' });
    } catch (e) {
      const old = new Map(previous.map((g) => [g.id, g.sortOrder]));
      setGroups((list) =>
        list.map((g) =>
          old.has(g.id) ? { ...g, sortOrder: old.get(g.id)! } : g,
        ),
      );
      error(e, 'Sıralama kaydedilemedi.');
    } finally {
      end();
    }
  }
  function dragEnd({ active, over }: DragEndEvent) {
    if (over) void reorder(Number(active.id), Number(over.id));
  }
  async function remove() {
    if (!deleteTarget || !begin()) return;
    try {
      await api(`/api/admin/groups/${deleteTarget.id}`, { method: 'DELETE' });
      setGroups((list) => list.filter((g) => g.id !== deleteTarget.id));
      setDeleteTarget(null);
      setNotice({ error: false, text: 'Grup silindi.' });
    } catch (e) {
      error(e, 'Grup silinemedi.');
    } finally {
      end();
    }
  }
  const closeActions = () => setActions(null);
  function clearFilters() {
    setSearch('');
    setStatus('all');
    setKind('all');
  }
  if (loading) return <Spinner />;
  if (loadError)
    return (
      <section className="ag-page ag-empty" role="alert">
        <h1>Gruplar yüklenemedi</h1>
        <p>{loadError}</p>
        <Button onClick={() => void reload()}>Tekrar dene</Button>
      </section>
    );
  return (
    <section className="ag-page" aria-label="Grup yönetimi">
      <header className="ag-head">
        <div>
          <p className="ag-eyebrow">MENÜ DÜZENİ</p>
          <h1>
            Gruplar<span>.</span>
          </h1>
          <p>
            {groups.filter((g) => !g.isSubGroup).length} ana grup ·{' '}
            {groups.filter((g) => g.isSubGroup).length} alt grup
          </p>
        </div>
        <Button onClick={() => openForm(null)} disabled={busy}>
          <Plus size={18} />
          Grup ekle
        </Button>
      </header>
      {notice && (
        <div
          className={`ag-notice${notice.error ? ' is-error' : ''}`}
          role={notice.error ? 'alert' : 'status'}
        >
          <span>{notice.text}</span>
          <button
            className="ag-icon"
            aria-label="Bildirimi kapat"
            onClick={() => setNotice(null)}
          >
            <X size={17} />
          </button>
        </div>
      )}
      <div className="ag-board">
        <div className="ag-toolbar">
          <label className="ag-search">
            <Search size={19} />
            <input
              aria-label="Gruplarda ara"
              placeholder="Grup veya alt grup ara"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                className="ag-icon"
                aria-label="Aramayı temizle"
                onClick={() => setSearch('')}
              >
                <X size={16} />
              </button>
            )}
          </label>
          <button
            className={`ag-filter${status !== 'all' || kind !== 'all' ? ' is-active' : ''}`}
            aria-label="Filtrele"
            onClick={() => setFiltersOpen(true)}
          >
            <SlidersHorizontal size={17} />
            <span>Filtrele</span>
            {(status !== 'all' || kind !== 'all') && (
              <b>{Number(status !== 'all') + Number(kind !== 'all')}</b>
            )}
          </button>
        </div>
        {filtering && (
          <div className="ag-filter-summary">
            <span>
              {groups.filter(matches).length} eşleşme
              {status !== 'all'
                ? ` · ${status === 'active' ? 'Açık' : 'Gizli'}`
                : ''}
              {kind !== 'all'
                ? ` · ${kind === 'main' ? 'Ana gruplar' : 'Alt gruplar'}`
                : ''}
            </span>
            <button onClick={clearFilters}>Temizle</button>
          </div>
        )}
        <div className="ag-list-label">
          <span>Menüdeki sıra</span>
          <span className="ag-desktop-hint">
            Adı düzenle · Görsele dokun · Sürükleyerek sırala
          </span>
        </div>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={dragEnd}
        >
          <SortableContext
            items={visible.map((g) => g.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="ag-list">
              {blocks.map(({ root, children }) => {
                const open = filtering || expanded.has(root.id),
                  shown = children.filter((g) => !filtering || matches(g));
                const rowProps = {
                  onActions: openActions,
                  onRename: rename,
                  onToggle: toggle,
                  onProducts: setProductsGroup,
                  onImage: quickImage,
                  busy,
                  sortable: !filtering,
                };
                return (
                  <section
                    className="ag-family"
                    key={root.id}
                    aria-label={root.name}
                  >
                    <GroupListRow
                      group={root}
                      {...rowProps}
                      contextOnly={filtering && !matches(root)}
                      childrenNames={children.map((g) => g.name)}
                      expanded={open}
                      onExpand={() =>
                        setExpanded((prev) => {
                          const next = new Set(prev);
                          next.has(root.id)
                            ? next.delete(root.id)
                            : next.add(root.id);
                          return next;
                        })
                      }
                    />
                    {open && shown.length > 0 && (
                      <div className="ag-branches">
                        {shown.map((child) => (
                          <GroupListRow
                            key={child.id}
                            group={child}
                            {...rowProps}
                          />
                        ))}
                      </div>
                    )}
                    {!root.isSubGroup &&
                      !filtering &&
                      open &&
                      children.length > 0 && (
                        <button
                          className="ag-add-sub"
                          disabled={busy}
                          onClick={() => openForm(null, root)}
                        >
                          <Plus size={14} />
                          <span>{root.name} altına ekle</span>
                        </button>
                      )}
                  </section>
                );
              })}
              {!blocks.length && (
                <div className="ag-empty">
                  <FolderPlus size={28} />
                  <h2>
                    {groups.length
                      ? 'Bu aramada grup yok'
                      : 'Menünüzün ilk başlığını açın'}
                  </h2>
                  <p>
                    {groups.length
                      ? 'Başka bir isim deneyin veya filtreleri temizleyin.'
                      : 'Kahvaltılar, içecekler, tatlılar… İlk grubunuzla başlayın.'}
                  </p>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      groups.length ? clearFilters() : openForm(null)
                    }
                  >
                    {groups.length ? 'Filtreleri temizle' : 'İlk grubu ekle'}
                  </Button>
                </div>
              )}
            </div>
          </SortableContext>
        </DndContext>
        <AdminListPager
          page={safePage}
          pageCount={pageCount}
          total={roots.length}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      </div>
      <p className="ag-footnote">
        Sıra, ad ve görünürlük değişiklikleri doğrudan menünüze yansır.
      </p>
      <GroupsDialog
        open={filtersOpen}
        title="Görmek istediklerin"
        subtitle="Listeyi daraltın; düzeniniz aynı kalır."
        onClose={() => setFiltersOpen(false)}
      >
        <fieldset className="ag-filter-options">
          <legend>Menüde görünürlük</legend>
          {(
            [
              ['all', 'Tümü'],
              ['active', 'Açık'],
              ['passive', 'Gizli'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              aria-pressed={status === key}
              onClick={() => setStatus(key)}
            >
              {label}
              {status === key && <Check size={16} />}
            </button>
          ))}
        </fieldset>
        <fieldset className="ag-filter-options">
          <legend>Grup yapısı</legend>
          {(
            [
              ['all', 'Tüm gruplar'],
              ['main', 'Ana gruplar'],
              ['sub', 'Alt gruplar'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              aria-pressed={kind === key}
              onClick={() => setKind(key)}
            >
              {label}
              {kind === key && <Check size={16} />}
            </button>
          ))}
        </fieldset>
        <Button className="w-full" onClick={() => setFiltersOpen(false)}>
          Listeyi göster
        </Button>
      </GroupsDialog>
      <GroupsDialog
        open={Boolean(currentAction)}
        title={currentAction?.name || 'Grup işlemleri'}
        subtitle={
          currentAction?.isSubGroup
            ? currentAction.parentName || 'Alt grup'
            : 'Bu grupla ne yapalım?'
        }
        onClose={closeActions}
        className="ag-actions"
        anchor={actions?.point}
      >
        {currentAction && (
          <div className="ag-action-list">
            <button onClick={() => openForm(currentAction)}>
              <Pencil size={19} />
              <span>
                Ayrıntıları düzenle<small>Çeviriler ve grup bilgileri</small>
              </span>
            </button>
            <button
              onClick={() => {
                closeActions();
                setProductsGroup(currentAction);
              }}
            >
              <Package size={19} />
              <span>
                Ürünleri gör<small>{currentAction.productCount} ürün</small>
              </span>
            </button>
            {!currentAction.isSubGroup && (
              <button onClick={() => openForm(null, currentAction)}>
                <FolderPlus size={19} />
                <span>Alt grup ekle</span>
              </button>
            )}
            <div className="ag-move">
              <button
                disabled={filtering || actionIndex <= 0}
                onClick={() => {
                  closeActions();
                  void reorder(currentAction.id, siblings[actionIndex - 1].id);
                }}
              >
                <ArrowUp size={18} />
                Yukarı taşı
              </button>
              <button
                disabled={filtering || actionIndex >= siblings.length - 1}
                onClick={() => {
                  closeActions();
                  void reorder(currentAction.id, siblings[actionIndex + 1].id);
                }}
              >
                <ArrowDown size={18} />
                Aşağı taşı
              </button>
            </div>
            <button
              onClick={() => {
                closeActions();
                void toggle(currentAction);
              }}
            >
              {currentAction.isActive ? (
                <EyeOff size={19} />
              ) : (
                <Eye size={19} />
              )}
              <span>
                {currentAction.isActive ? 'Menüde gizle' : 'Menüde göster'}
              </span>
            </button>
            <button
              className="is-danger"
              onClick={() => {
                closeActions();
                setNotice(null);
                setDeleteTarget(currentAction);
              }}
            >
              <Trash2 size={19} />
              <span>Grubu sil</span>
            </button>
          </div>
        )}
      </GroupsDialog>
      <GroupModal
        open={modalMode !== null}
        mode={modalMode || 'create'}
        parentName={parent?.name || editing?.parentName}
        languages={languages}
        form={form}
        imagePreview={imagePreview}
        saving={busy}
        error={formError}
        onClose={() => {
          if (!busy) {
            setModalMode(null);
            setImageFile(null);
          }
        }}
        onSave={() => void saveForm()}
        onFormChange={setForm}
        onImageChange={setImageFile}
      />
      <GroupProductsModal
        open={Boolean(productsGroup)}
        groupId={productsGroup?.id ?? null}
        groupName={productsGroup?.name || ''}
        onClose={() => setProductsGroup(null)}
      />
      <GroupsDialog
        open={Boolean(deleteTarget)}
        title="Bu grubu silelim mi?"
        subtitle={deleteTarget?.name}
        busy={busy}
        onClose={() => setDeleteTarget(null)}
      >
        <p className="ag-delete-copy">
          Bu işlem geri alınamaz. İçinde ürün veya alt grup bulunan gruplar
          silinemez; önce onları taşıyın veya kaldırın.
        </p>
        {notice?.error && (
          <p role="alert" className="ag-form-error">
            {notice.text}
          </p>
        )}
        <div className="ag-form-actions">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => setDeleteTarget(null)}
          >
            Vazgeç
          </Button>
          <Button
            className="ag-delete-button"
            disabled={busy}
            onClick={() => void remove()}
          >
            {busy ? 'Siliniyor…' : 'Grubu sil'}
          </Button>
        </div>
      </GroupsDialog>
    </section>
  );
}
