import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus,
  Pencil,
  EyeOff,
  Eye,
  SlidersHorizontal,
  ChevronDown,
} from 'lucide-react';
import { api, formatPrice, imageUrl } from '@/lib/api';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Spinner,
} from '@/components/ui';
import ProductModal, {
  type ProductFormState,
  type ProductTranslationFields,
} from '@/components/ProductModal';

interface Product {
  id: number;
  name: string;
  groupId: number;
  groupName: string;
  price: number;
  imageUrl?: string | null;
  sortOrder: number;
  isActive: boolean;
  isValid: boolean;
  translations: {
    languageId: number;
    languageCode: string;
    name: string;
    description?: string | null;
  }[];
}

interface Group {
  id: number;
  name: string;
  parentId?: number | null;
  parentName?: string | null;
  isSubGroup?: boolean;
}

interface Language {
  id: number;
  code: string;
  name: string;
}

type StatusFilter = 'all' | 'active' | 'passive';

const emptyForm = (): ProductFormState => ({
  groupId: '',
  price: '',
  translations: {},
  isActive: true,
});

function buildFormFromProduct(product: Product): ProductFormState {
  const translations: Record<string, ProductTranslationFields> = {};
  for (const t of product.translations) {
    translations[t.languageCode] = {
      name: t.name,
      description: t.description || '',
    };
  }
  return {
    groupId: product.groupId.toString(),
    price: product.price.toString(),
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

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
    setLanguages(langs.filter((l) => l.code === 'tr' || l.code === 'en'));
  }, [search, groupFilter, statusFilter]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(editing?.imageUrl ? imageUrl(editing.imageUrl) : null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile, editing?.imageUrl]);

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
    setImageFile(null);
    setImagePreview(null);
    setModalOpen(true);
  }

  function openEdit(product: Product) {
    setModalMode('edit');
    setEditing(product);
    setForm(buildFormFromProduct(product));
    setImageFile(null);
    setImagePreview(product.imageUrl ? imageUrl(product.imageUrl) : null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setForm(emptyForm());
    setImageFile(null);
    setImagePreview(null);
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

  async function handleSave() {
    setSaving(true);
    try {
      const translations = languages.map((l) => ({
        languageId: l.id,
        name: form.translations[l.code]?.name || '',
        description: form.translations[l.code]?.description || '',
      }));

      const payload = {
        groupId: Number(form.groupId),
        price: parseFloat(form.price) || 0,
        translations,
        isActive: form.isActive,
      };

      if (editing) {
        await api(`/api/admin/products/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        if (imageFile) await uploadImage(editing.id);
      } else {
        const created = await api<Product>('/api/admin/products', {
          method: 'POST',
          body: JSON.stringify(payload),
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
    await fetch(`/api/admin/products/${id}/image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: fd,
    });
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
        <div
          className="p-4 sm:p-5 border-b flex flex-col gap-4"
          style={{ borderColor: 'var(--admin-card-border)' }}
        >
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
            <div className="relative flex-1 max-w-md">
              <Input
                label="Ürün adı ara..."
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
                    className="ml-1 min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold flex items-center justify-center"
                    style={{
                      background: 'var(--admin-accent)',
                      color: 'var(--admin-btn-primary-text)',
                    }}
                  >
                    {activeFilterCount}
                  </span>
                )}
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${filterOpen ? 'rotate-180' : ''}`}
                />
              </button>
              <span className="text-sm admin-text-muted">{products.length} kayıt</span>
            </div>
          </div>

          <div
            className={`grid transition-all duration-300 ease-out ${
              filterOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
              <div
                className="rounded-2xl p-4 grid sm:grid-cols-2 gap-4"
                style={{ background: 'var(--admin-input-bg)' }}
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide admin-text-muted mb-2">
                    Grup
                  </p>
                  <select
                    value={groupFilter}
                    onChange={(e) => setGroupFilter(e.target.value)}
                    className="w-full rounded-xl px-3 py-2.5 text-sm"
                    style={{
                      background: 'var(--admin-card)',
                      border: '1px solid var(--admin-card-border)',
                      color: 'var(--admin-text)',
                    }}
                  >
                    <option value="">Tüm Gruplar</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.isSubGroup && g.parentName ? `${g.parentName} › ${g.name}` : g.name}
                      </option>
                    ))}
                  </select>
                </div>
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
                            statusFilter === val
                              ? 'var(--admin-btn-primary-text)'
                              : 'var(--admin-text-muted)',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Filtreleri Temizle
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

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
                    className="border-b transition-all duration-300 hover:bg-[var(--admin-accent-soft)]/30"
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
                    <td className="py-3.5 px-4">
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
