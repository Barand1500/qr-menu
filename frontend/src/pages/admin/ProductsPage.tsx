import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus,
  Pencil,
  EyeOff,
  Eye,
} from 'lucide-react';
import { api, formatPrice, imageUrl } from '@/lib/api';
import { getActiveLanguages, type AdminLanguage } from '@/lib/languages';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Spinner,
} from '@/components/ui';
import ProductModal, {
  type ProductFormState,
  type ProductTranslationFields,
} from '@/components/ProductModal';
import {
  AdminFilterBar,
  FilterChipGroup,
  FilterFieldLabel,
  FilterSection,
} from '@/components/AdminFilterBar';

interface Product {
  id: number;
  name: string;
  groupId: number;
  groupName: string;
  price: number;
  prepTimeMinutes?: number | null;
  calories?: number | null;
  features?: string[];
  isRecommended?: boolean;
  imageUrl?: string | null;
  images?: string[];
  sortOrder: number;
  isActive: boolean;
  isValid: boolean;
  translations: {
    languageId: number;
    languageCode: string;
    name: string;
    description?: string | null;
    ingredients?: string | null;
    allergens?: string | null;
  }[];
}

interface Group {
  id: number;
  name: string;
  parentId?: number | null;
  parentName?: string | null;
  isSubGroup?: boolean;
}

interface Language extends AdminLanguage {}

type StatusFilter = 'all' | 'active' | 'passive';

const emptyForm = (): ProductFormState => ({
  groupId: '',
  price: '',
  prepTimeMinutes: '',
  calories: '',
  features: [],
  isRecommended: false,
  translations: {},
  isActive: true,
});

function buildFormFromProduct(product: Product): ProductFormState {
  const translations: Record<string, ProductTranslationFields> = {};
  for (const t of product.translations) {
    translations[t.languageCode] = {
      name: t.name,
      description: t.description || '',
      ingredients: t.ingredients || '',
      allergens: t.allergens || '',
    };
  }
  return {
    groupId: product.groupId.toString(),
    price: product.price.toString(),
    prepTimeMinutes: product.prepTimeMinutes?.toString() || '',
    calories: product.calories?.toString() || '',
    features: product.features ?? [],
    isRecommended: product.isRecommended ?? false,
    translations,
    isActive: product.isActive,
  };
}

export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [filterOpen, setFilterOpen] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductFormState>(emptyForm());
  const [productImages, setProductImages] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<{ id: string; file: File; url: string }[]>([]);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ limit: '100' });
    if (search) params.set('search', search);
    if (groupFilter) params.set('groupId', groupFilter);
    if (statusFilter === 'active') params.set('active', 'true');
    if (statusFilter === 'passive') params.set('active', 'false');

    const [p, g, langs] = await Promise.all([
      api<{ data: Product[] }>(`/api/admin/products?${params}`),
      api<{ data: Group[] }>('/api/admin/groups?limit=200'),
      api<Language[]>('/api/admin/languages'),
    ]);
    setProducts(p.data);
    setGroups(g.data);
    setLanguages(getActiveLanguages(langs));
  }, [search, groupFilter, statusFilter]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    return () => {
      pendingFiles.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [pendingFiles]);

  const groupOptions = useMemo(
    () =>
      groups.map((g) => ({
        id: g.id,
        name: g.name,
        isSubGroup: g.isSubGroup,
        parentName: g.parentName,
      })),
    [groups]
  );

  const activeFilterCount = [
    groupFilter.length > 0,
    statusFilter !== 'all',
    search.trim().length > 0,
  ].filter(Boolean).length;

  function openCreate() {
    setModalMode('create');
    setEditing(null);
    setForm({
      ...emptyForm(),
      groupId: groups[0]?.id?.toString() || '',
    });
    setProductImages([]);
    setPendingFiles([]);
    setModalOpen(true);
  }

  function openEdit(product: Product) {
    setModalMode('edit');
    setEditing(product);
    setForm(buildFormFromProduct(product));
    setPendingFiles([]);
    setProductImages(
      product.images?.length ? product.images : product.imageUrl ? [product.imageUrl] : []
    );
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setForm(emptyForm());
    pendingFiles.forEach((p) => URL.revokeObjectURL(p.url));
    setPendingFiles([]);
    setProductImages([]);
  }

  useEffect(() => {
    const editId = searchParams.get('edit');
    if (!editId || loading) return;

    const id = Number(editId);
    if (!id) return;

    async function openFromUrl() {
      const fromList = products.find((p) => p.id === id);
      if (fromList) {
        openEdit(fromList);
      } else {
        try {
          const product = await api<Product>(`/api/admin/products/${id}`);
          openEdit(product);
        } catch {
          /* ignore */
        }
      }
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('edit');
        return next;
      }, { replace: true });
    }

    openFromUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, products, loading]);

  function handleAddImages(files: FileList | null) {
    if (!files?.length) return;
    const next = Array.from(files).map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      url: URL.createObjectURL(file),
    }));
    setPendingFiles((prev) => [...prev, ...next]);
  }

  function handleRemovePending(id: string) {
    setPendingFiles((prev) => {
      const item = prev.find((p) => p.id === id);
      if (item) URL.revokeObjectURL(item.url);
      return prev.filter((p) => p.id !== id);
    });
  }

  async function handleRemoveImage(url: string) {
    if (editing) {
      const updated = await api<Product>(`/api/admin/products/${editing.id}/images`, {
        method: 'DELETE',
        body: JSON.stringify({ url }),
      });
      setProductImages(updated.images ?? []);
      setEditing(updated);
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
      return;
    }
    setProductImages((prev) => prev.filter((u) => u !== url));
  }

  async function handleMoveImage(url: string, direction: -1 | 1) {
    const list = [...productImages];
    const index = list.indexOf(url);
    if (index < 0) return;
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    setProductImages(list);

    if (editing) {
      const updated = await api<Product>(`/api/admin/products/${editing.id}/images/reorder`, {
        method: 'PUT',
        body: JSON.stringify({ images: list }),
      });
      setProductImages(updated.images ?? list);
      setEditing(updated);
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
    }
  }

  async function uploadImages(id: number, files: File[]) {
    if (files.length === 0) return;
    const fd = new FormData();
    files.forEach((file) => fd.append('images', file));
    const res = await fetch(`/api/admin/products/${id}/images`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: fd,
    });
    if (!res.ok) throw new Error('Görsel yüklenemedi');
    return res.json() as Promise<Product>;
  }

  async function handleSave() {
    setSaving(true);
    try {
      const translations = languages.map((l) => ({
        languageId: l.id,
        name: form.translations[l.code]?.name || '',
        description: form.translations[l.code]?.description || '',
        ingredients: form.translations[l.code]?.ingredients || '',
        allergens: form.translations[l.code]?.allergens || '',
      }));

      const payload = {
        groupId: Number(form.groupId),
        price: parseFloat(form.price) || 0,
        prepTimeMinutes: form.prepTimeMinutes ? Number(form.prepTimeMinutes) : null,
        calories: form.calories ? Number(form.calories) : null,
        features: form.features,
        isRecommended: form.isRecommended,
        translations,
        isActive: form.isActive,
      };

      if (editing) {
        await api(`/api/admin/products/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        if (pendingFiles.length > 0) {
          await uploadImages(
            editing.id,
            pendingFiles.map((p) => p.file)
          );
        }
      } else {
        const created = await api<Product>('/api/admin/products', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        if (pendingFiles.length > 0) {
          await uploadImages(
            created.id,
            pendingFiles.map((p) => p.file)
          );
        }
      }

      closeModal();
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(product: Product) {
    const nextActive = !product.isActive;
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, isActive: nextActive } : p))
    );
    try {
      await api(`/api/admin/products/${product.id}/toggle`, { method: 'PATCH' });
    } catch {
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, isActive: product.isActive } : p))
      );
    }
  }

  function clearFilters() {
    setSearch('');
    setGroupFilter('');
    setStatusFilter('all');
  }

  const groupFilterOptions = useMemo(
    () =>
      groups.map((g) => ({
        value: g.id.toString(),
        label: g.isSubGroup && g.parentName ? `${g.parentName} › ${g.name}` : g.name,
      })),
    [groups]
  );

  if (loading) return <Spinner />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ürünler"
        actions={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Yeni Ürün Ekle
          </Button>
        }
      />

      <Card className="overflow-hidden !p-0">
        <AdminFilterBar
          search={
            <Input
              label="Ürün adı ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          }
          filterOpen={filterOpen}
          onFilterToggle={() => setFilterOpen(!filterOpen)}
          activeFilterCount={activeFilterCount}
          recordLabel={`${products.length} kayıt`}
          onClear={clearFilters}
        >
          <FilterSection className="min-w-[200px]">
            <FilterFieldLabel>Grup</FilterFieldLabel>
            <Select
              label="Tüm gruplar"
              value={groupFilter}
              options={groupFilterOptions}
              onChange={(e) => setGroupFilter(e.target.value)}
            />
          </FilterSection>
          <FilterSection>
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
          </FilterSection>
        </AdminFilterBar>

        <div className="overflow-x-auto admin-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr
                className="text-left text-xs uppercase tracking-wide admin-text-muted"
                style={{ background: 'var(--admin-input-bg)' }}
              >
                <th className="py-3.5 px-4 font-semibold w-[72px]">Görsel</th>
                <th className="py-3.5 px-4 font-semibold">Adı</th>
                <th className="py-3.5 px-4 font-semibold hidden md:table-cell">Grubu</th>
                <th className="py-3.5 px-4 font-semibold">Fiyat</th>
                <th className="py-3.5 px-4 font-semibold hidden sm:table-cell">Sıra</th>
                <th className="py-3.5 px-4 font-semibold">Durum</th>
                <th className="py-3.5 px-4 font-semibold w-[100px]">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState message="Henüz ürün eklenmemiş" />
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr
                    key={product.id}
                    onDoubleClick={() => openEdit(product)}
                    className="border-b transition-all duration-300 hover:bg-[var(--admin-accent-soft)]/30 admin-table-row--editable cursor-pointer"
                    style={{
                      borderColor: 'var(--admin-card-border)',
                      opacity: product.isActive ? 1 : 0.38,
                    }}
                  >
                    <td className="py-3.5 px-4">
                      {product.imageUrl ? (
                        <img
                          src={imageUrl(product.imageUrl)}
                          alt=""
                          className="w-12 h-12 rounded-xl object-cover"
                          style={{ background: 'var(--admin-input-bg)' }}
                        />
                      ) : (
                        <div
                          className="w-12 h-12 rounded-xl"
                          style={{ background: 'var(--admin-accent-soft)' }}
                        />
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-[var(--admin-text)]">{product.name}</p>
                      {!product.isValid && (
                        <span className="text-xs text-red-500">Eksik çeviri</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 admin-text-muted hidden md:table-cell">
                      {product.groupName}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-[var(--admin-text)]">
                      {formatPrice(product.price)} ₺
                    </td>
                    <td className="py-3.5 px-4 admin-text-muted hidden sm:table-cell">
                      {product.sortOrder}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge active={product.isActive} />
                    </td>
                    <td className="py-3.5 px-4" onDoubleClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <button
                          onClick={() => openEdit(product)}
                          className="p-2 rounded-xl transition hover:bg-[var(--admin-accent-soft)]"
                          style={{ color: 'var(--admin-accent)' }}
                          title="Düzenle"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggle(product)}
                          className={`p-2 rounded-xl transition ${
                            product.isActive
                              ? 'hover:bg-amber-500/10 text-amber-600'
                              : 'hover:bg-emerald-500/10 text-emerald-600'
                          }`}
                          title={product.isActive ? 'Pasifleştir' : 'Aktifleştir'}
                        >
                          {product.isActive ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <ProductModal
        open={modalOpen}
        mode={modalMode}
        languages={languages}
        groups={groupOptions}
        form={form}
        productImages={productImages}
        pendingPreviews={pendingFiles.map(({ id, url }) => ({ id, url }))}
        saving={saving}
        onClose={closeModal}
        onSave={handleSave}
        onFormChange={setForm}
        onAddImages={handleAddImages}
        onRemoveImage={handleRemoveImage}
        onRemovePending={handleRemovePending}
        onMoveImage={handleMoveImage}
      />
    </div>
  );
}
