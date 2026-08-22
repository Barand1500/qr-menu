import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, EyeOff } from 'lucide-react';
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
  translations: { languageId: number; languageCode: string; name: string }[];
}

interface Group {
  id: number;
  name: string;
}

interface Language {
  id: number;
  code: string;
  name: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({
    groupId: '',
    price: '',
    translations: {} as Record<string, string>,
    isActive: true,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ limit: '100' });
    if (search) params.set('search', search);
    if (groupFilter) params.set('groupId', groupFilter);

    const [p, g, langs] = await Promise.all([
      api<{ data: Product[] }>(`/api/admin/products?${params}`),
      api<{ data: Group[] }>('/api/admin/groups?limit=100'),
      api<Language[]>('/api/admin/languages'),
    ]);
    setProducts(p.data);
    setGroups(g.data);
    setLanguages(langs.filter((l) => l.code === 'tr' || l.code === 'en'));
  }, [search, groupFilter]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({
      groupId: groups[0]?.id?.toString() || '',
      price: '',
      translations: {},
      isActive: true,
    });
    setImageFile(null);
    setModalOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setForm({
      groupId: product.groupId.toString(),
      price: product.price.toString(),
      translations: Object.fromEntries(product.translations.map((t) => [t.languageCode, t.name])),
      isActive: product.isActive,
    });
    setImageFile(null);
    setModalOpen(true);
  }

  async function handleSave() {
    const translations = languages.map((l) => ({
      languageId: l.id,
      name: form.translations[l.code] || '',
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
      if (imageFile) {
        const fd = new FormData();
        fd.append('image', imageFile);
        await fetch(`/api/admin/products/${editing.id}/image`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: fd,
        });
      }
    } else {
      const created = await api<Product>('/api/admin/products', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (imageFile) {
        const fd = new FormData();
        fd.append('image', imageFile);
        await fetch(`/api/admin/products/${created.id}/image`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: fd,
        });
      }
    }

    setModalOpen(false);
    await load();
  }

  async function handleToggle(id: number) {
    await api(`/api/admin/products/${id}/toggle`, { method: 'PATCH' });
    await load();
  }

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Ürünler"
        actions={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" /> Yeni Ürün
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3">
          <div className="flex-1 max-w-xs">
            <Input
              label="Ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Tüm Gruplar</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 bg-slate-50/80">
                <th className="py-3 px-4 w-16" />
                <th className="py-3 px-4 font-medium">Adı</th>
                <th className="py-3 px-4 font-medium hidden md:table-cell">Grubu</th>
                <th className="py-3 px-4 font-medium">Fiyat</th>
                <th className="py-3 px-4 font-medium hidden sm:table-cell">Sıra</th>
                <th className="py-3 px-4 font-medium">Aktif</th>
                <th className="py-3 px-4 w-24" />
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
                  <tr key={product.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="py-3 px-4">
                      {product.imageUrl ? (
                        <img
                          src={imageUrl(product.imageUrl)}
                          alt=""
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-slate-100" />
                      )}
                    </td>
                    <td className="py-3 px-4 font-medium">
                      {product.name}
                      {!product.isValid && (
                        <span className="ml-2 text-xs text-red-500">Hatalı</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500 hidden md:table-cell">
                      {product.groupName}
                    </td>
                    <td className="py-3 px-4">{formatPrice(product.price)} ₺</td>
                    <td className="py-3 px-4 text-slate-500 hidden sm:table-cell">
                      {product.sortOrder}
                    </td>
                    <td className="py-3 px-4">
                      <Badge active={product.isActive} />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1">
                        <button
                          onClick={() => openEdit(product)}
                          className="p-2 rounded-lg hover:bg-amber-50 text-amber-600"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggle(product.id)}
                          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
                        >
                          <EyeOff className="w-4 h-4" />
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

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <Card className="w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">
              {editing ? 'Ürün Düzenle' : 'Yeni Ürün'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Grup</label>
                <select
                  value={form.groupId}
                  onChange={(e) => setForm({ ...form, groupId: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Fiyat (₺)"
                type="number"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
              {languages.map((lang) => (
                <Input
                  key={lang.id}
                  label={`Ad (${lang.name})`}
                  value={form.translations[lang.code] || ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      translations: { ...form.translations, [lang.code]: e.target.value },
                    })
                  }
                />
              ))}
              <div>
                <label className="block text-sm font-medium mb-1">Görsel</label>
                <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                Aktif
              </label>
            </div>
            <div className="flex gap-2 mt-6 justify-end">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                İptal
              </Button>
              <Button onClick={handleSave}>Kaydet</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
