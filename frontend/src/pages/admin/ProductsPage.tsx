import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Pencil,
  EyeOff,
  Eye,
  Layers3,
  Tags,
  RotateCcw,
} from 'lucide-react';
import { api, formatMoney, formatPrice, imageUrl } from '@/lib/api';
import { adminPath } from '@/lib/adminPath';
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
import MenuMediaPlaceholder from '@/components/public/MenuMediaPlaceholder';
import ProductModal, {
  type ProductFormState,
  type ProductTranslationFields,
} from '@/components/ProductModal';
import BulkPriceModal, {
  type BulkPriceApplyResult,
} from '@/components/BulkPriceModal';
import {
  defaultPrefCatalog,
  fetchPrefCatalog,
  savePrefCatalog,
  type PrefCatalog,
} from '@/lib/prefCatalog';
import {
  AdminFilterBar,
  FilterChipGroup,
  FilterFieldLabel,
  FilterSection,
} from '@/components/AdminFilterBar';

interface Currency {
  id: number;
  code: string;
  name: string;
  symbol: string;
  isActive: boolean;
}

interface Product {
  id: number;
  name: string;
  groupId: number;
  groupName: string;
  price: number;
  previousPrice?: number | null;
  previousPriceAt?: string | null;
  currencyId?: number | null;
  currency?: { id: number | null; code: string; name: string; symbol: string };
  prepTimeMinutes?: number | null;
  calories?: number | null;
  features?: string[];
  allergenTags?: string[];
  dietTags?: string[];
  isVegan?: boolean;
  isVegetarian?: boolean;
  isGlutenFree?: boolean;
  isDiabetic?: boolean;
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

type BulkStatus = {
  hasSnapshot: boolean;
  appliedAt: string | null;
  count: number;
};

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function formatShortDate(iso?: string | null) {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

function ProductPriceCell({
  price,
  currency,
  previousPrice,
  previousPriceAt,
  rolling,
  rollFrom,
}: {
  price: number;
  currency?: { symbol?: string | null; code?: string | null } | null;
  previousPrice?: number | null;
  previousPriceAt?: string | null;
  rolling: boolean;
  rollFrom: number | null;
}) {
  const [shown, setShown] = useState(price);
  const symbol = currency?.symbol?.trim() || currency?.code?.trim() || '₺';

  useEffect(() => {
    if (!rolling || rollFrom == null) {
      setShown(price);
      return;
    }
    const start = performance.now();
    const duration = 650;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setShown(rollFrom + (price - rollFrom) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [rolling, rollFrom, price]);

  return (
    <div className={rolling ? 'bulk-price-rolling' : undefined}>
      <p className="font-medium text-[var(--admin-text)] tabular-nums">
        {formatPrice(shown)} {symbol}
      </p>
      {previousPrice != null && (
        <p className="text-[11px] admin-text-muted mt-0.5 leading-snug">
          Önceki: {formatMoney(previousPrice, currency)}
          {previousPriceAt ? ` · ${formatShortDate(previousPriceAt)}` : ''}
        </p>
      )}
    </div>
  );
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
  currencyId: '',
  prepTimeMinutes: '',
  calories: '',
  features: [],
  allergenTags: [],
  dietTags: [],
  isVegan: false,
  isVegetarian: false,
  isGlutenFree: false,
  isDiabetic: false,
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
    currencyId: (product.currencyId ?? product.currency?.id)?.toString() || '',
    prepTimeMinutes: product.prepTimeMinutes?.toString() || '',
    calories: product.calories?.toString() || '',
    features: product.features ?? [],
    allergenTags: product.allergenTags ?? [],
    dietTags: product.dietTags ?? [],
    isVegan: product.isVegan ?? false,
    isVegetarian: product.isVegetarian ?? false,
    isGlutenFree: product.isGlutenFree ?? false,
    isDiabetic: product.isDiabetic ?? false,
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
  const [currencies, setCurrencies] = useState<Currency[]>([]);
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
  const [prefCatalog, setPrefCatalog] = useState<PrefCatalog>(() => defaultPrefCatalog());

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<BulkStatus>({
    hasSnapshot: false,
    appliedAt: null,
    count: 0,
  });
  const [bulkAnimating, setBulkAnimating] = useState(false);
  const [rollingId, setRollingId] = useState<number | null>(null);
  const [rollFrom, setRollFrom] = useState<number | null>(null);
  const productsRef = useRef(products);
  productsRef.current = products;

  const refreshBulkStatus = useCallback(async () => {
    try {
      const status = await api<BulkStatus>('/api/admin/products/bulk-price/status');
      setBulkStatus(status);
    } catch {
      setBulkStatus({ hasSnapshot: false, appliedAt: null, count: 0 });
    }
  }, []);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ limit: '100' });
    if (search) params.set('search', search);
    if (groupFilter) params.set('groupId', groupFilter);
    if (statusFilter === 'active') params.set('active', 'true');
    if (statusFilter === 'passive') params.set('active', 'false');

    const [p, g, langs, curs] = await Promise.all([
      api<{ data: Product[] }>(`/api/admin/products?${params}`),
      api<{ data: Group[] }>('/api/admin/groups?limit=200'),
      api<Language[]>('/api/admin/languages'),
      api<Currency[]>('/api/admin/currencies'),
    ]);
    setProducts(p.data);
    setGroups(g.data);
    setLanguages(getActiveLanguages(langs));
    setCurrencies(curs);
  }, [search, groupFilter, statusFilter]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    void refreshBulkStatus();
  }, [refreshBulkStatus]);

  useEffect(() => {
    fetchPrefCatalog().then(setPrefCatalog).catch(() => undefined);
  }, []);

  async function runPriceSequence(
    updates: {
      id: number;
      price: number;
      previousPrice?: number | null;
      previousPriceAt?: string | null;
    }[],
    kind: 'apply' | 'restore'
  ) {
    setBulkAnimating(true);
    for (const u of updates) {
      const row = document.querySelector(`[data-product-row="${u.id}"]`);
      if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(420);
      }

      const current = productsRef.current.find((p) => p.id === u.id);
      const from = current?.price ?? u.previousPrice ?? u.price;
      setRollFrom(from);
      setRollingId(u.id);
      setProducts((prev) =>
        prev.map((p) =>
          p.id === u.id
            ? {
                ...p,
                price: u.price,
                previousPrice: kind === 'apply' ? (u.previousPrice ?? null) : null,
                previousPriceAt: kind === 'apply' ? (u.previousPriceAt ?? null) : null,
              }
            : p
        )
      );
      await sleep(720);
    }
    setRollingId(null);
    setRollFrom(null);
    setBulkAnimating(false);
    await refreshBulkStatus();
  }

  async function handleBulkApplied(result: BulkPriceApplyResult) {
    await runPriceSequence(result.updates, 'apply');
    if (result.skipped.length > 0) {
      window.alert(
        `${result.skipped.length} ürün atlandı (fiyat 0 altına düşerdi):\n` +
          result.skipped
            .slice(0, 8)
            .map((s) => `• ${s.name}`)
            .join('\n') +
          (result.skipped.length > 8 ? `\n… +${result.skipped.length - 8}` : '')
      );
    }
  }

  async function handleBulkRestore() {
    if (bulkAnimating || !bulkStatus.hasSnapshot) return;
    const ok = window.confirm(
      `Son toplu işlemdeki ${bulkStatus.count} ürünün fiyatı eski haline dönecek. Devam edilsin mi?`
    );
    if (!ok) return;
    try {
      const res = await api<{
        ok: true;
        orderIds: number[];
        updates: { id: number; price: number }[];
      }>('/api/admin/products/bulk-price/restore', { method: 'POST' });
      await runPriceSequence(res.updates, 'restore');
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Geri alınamadı');
    }
  }

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
    const defaultCurrency =
      currencies.find((c) => c.code === 'TRY' && c.isActive) ||
      currencies.find((c) => c.isActive);
    setForm({
      ...emptyForm(),
      groupId: groups[0]?.id?.toString() || '',
      currencyId: defaultCurrency?.id.toString() || '',
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
        currencyId: form.currencyId ? Number(form.currencyId) : null,
        prepTimeMinutes: form.prepTimeMinutes ? Number(form.prepTimeMinutes) : null,
        calories: form.calories ? Number(form.calories) : null,
        features: form.features,
        allergenTags: form.allergenTags,
        dietTags: form.dietTags,
        isVegan: form.isVegan,
        isVegetarian: form.isVegetarian,
        isGlutenFree: form.isGlutenFree,
        isDiabetic: form.isDiabetic,
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

  async function handlePrefCatalogChange(catalog: PrefCatalog) {
    setPrefCatalog(catalog);
    try {
      await savePrefCatalog(catalog);
    } catch {
      /* sessiz — kullanıcı kaydetmeye devam edebilir */
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
          <div className="flex flex-wrap gap-2">
            <Link to={adminPath('urun-secenekleri')}>
              <Button variant="secondary">
                <Layers3 className="w-4 h-4" />
                Varyant / seçenek
              </Button>
            </Link>
            <Button
              variant="secondary"
              onClick={() => setBulkOpen(true)}
              disabled={bulkAnimating}
            >
              <Tags className="w-4 h-4" />
              Toplu fiyat
            </Button>
            {bulkStatus.hasSnapshot && (
              <Button
                variant="ghost"
                onClick={() => void handleBulkRestore()}
                disabled={bulkAnimating}
                title={
                  bulkStatus.appliedAt
                    ? `Son işlem: ${formatShortDate(bulkStatus.appliedAt)}`
                    : 'Eski fiyata dön'
                }
              >
                <RotateCcw className="w-4 h-4" />
                Eski fiyata dön
              </Button>
            )}
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4" />
              Yeni Ürün Ekle
            </Button>
          </div>
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
                    data-product-row={product.id}
                    onDoubleClick={() => openEdit(product)}
                    className={`border-b transition-all duration-300 hover:bg-[var(--admin-accent-soft)]/30 admin-table-row--editable cursor-pointer${
                      rollingId === product.id ? ' bulk-price-row--flash' : ''
                    }`}
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
                        <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0">
                          <MenuMediaPlaceholder kind="product" size="sm" label={product.name} />
                        </div>
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
                    <td className="py-3.5 px-4">
                      <ProductPriceCell
                        price={product.price}
                        currency={product.currency}
                        previousPrice={product.previousPrice}
                        previousPriceAt={product.previousPriceAt}
                        rolling={rollingId === product.id}
                        rollFrom={rollingId === product.id ? rollFrom : null}
                      />
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
        currencies={currencies}
        groups={groupOptions}
        prefCatalog={prefCatalog}
        onPrefCatalogChange={handlePrefCatalogChange}
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

      <BulkPriceModal
        open={bulkOpen}
        groups={groupOptions}
        onClose={() => setBulkOpen(false)}
        onApplied={handleBulkApplied}
      />
    </div>
  );
}
