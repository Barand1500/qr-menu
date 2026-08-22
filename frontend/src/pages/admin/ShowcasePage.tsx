import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, EyeOff, Eye } from 'lucide-react';
import { api, imageUrl } from '@/lib/api';
import { Badge, Button, Card, EmptyState, PageHeader, Spinner } from '@/components/ui';
import ShowcaseModal, {
  type ShowcaseFormState,
  type ShowcaseTranslationFields,
} from '@/components/ShowcaseModal';

interface ShowcaseItem {
  id: number;
  name: string;
  productId: number | null;
  productName: string | null;
  imageUrl?: string | null;
  sortOrder: number;
  isActive: boolean;
  translations: {
    languageId: number;
    languageCode: string;
    title1: string | null;
    title2: string | null;
  }[];
}

interface ProductOption {
  id: number;
  name: string;
}

interface Language {
  id: number;
  code: string;
  name: string;
}

const emptyForm = (): ShowcaseFormState => ({
  name: '',
  productId: '',
  isActive: true,
  translations: {},
});

function buildForm(item: ShowcaseItem): ShowcaseFormState {
  const translations: Record<string, ShowcaseTranslationFields> = {};
  for (const t of item.translations) {
    translations[t.languageCode] = {
      title1: t.title1 || '',
      title2: t.title2 || '',
    };
  }
  return {
    name: item.name,
    productId: item.productId?.toString() || '',
    isActive: item.isActive,
    translations,
  };
}

export default function ShowcasePage() {
  const [items, setItems] = useState<ShowcaseItem[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editing, setEditing] = useState<ShowcaseItem | null>(null);
  const [form, setForm] = useState<ShowcaseFormState>(emptyForm());
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [showcase, productList, langs] = await Promise.all([
      api<ShowcaseItem[]>('/api/admin/showcase'),
      api<{ data: { id: number; name: string }[] }>('/api/admin/products?limit=200'),
      api<Language[]>('/api/admin/languages'),
    ]);
    setItems(showcase);
    setProducts(productList.data);
    setLanguages(langs.filter((l) => l.code === 'tr' || l.code === 'en'));
  }, []);

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

  function openCreate() {
    setModalMode('create');
    setEditing(null);
    setForm(emptyForm());
    setImageFile(null);
    setImagePreview(null);
    setModalOpen(true);
  }

  function openEdit(item: ShowcaseItem) {
    setModalMode('edit');
    setEditing(item);
    setForm(buildForm(item));
    setImageFile(null);
    setImagePreview(item.imageUrl ? imageUrl(item.imageUrl) : null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setForm(emptyForm());
    setImageFile(null);
    setImagePreview(null);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const translations = languages.map((l) => ({
        languageId: l.id,
        title1: form.translations[l.code]?.title1 || '',
        title2: form.translations[l.code]?.title2 || '',
      }));

      const payload = {
        name: form.name,
        productId: form.productId ? Number(form.productId) : null,
        isActive: form.isActive,
        translations,
      };

      if (editing) {
        await api(`/api/admin/showcase/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        if (imageFile) await uploadImage(editing.id);
      } else {
        const created = await api<ShowcaseItem>('/api/admin/showcase', {
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
    await fetch(`/api/admin/showcase/${id}/image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: fd,
    });
  }

  async function handleToggle(item: ShowcaseItem) {
    const next = !item.isActive;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isActive: next } : i)));
    try {
      await api(`/api/admin/showcase/${item.id}/toggle`, { method: 'PATCH' });
    } catch {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, isActive: item.isActive } : i))
      );
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Vitrin Görselleri"
        actions={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Yeni Vitrin Görseli
          </Button>
        }
      />

      <p className="text-sm admin-text-muted -mt-3 max-w-2xl">
        Müşterinin dijital menüde gördüğü üst banner görselleri. Önerilen boyut 1920×600 px.
      </p>

      <Card className="overflow-hidden !p-0">
        <div className="overflow-x-auto admin-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr
                className="text-left text-xs uppercase tracking-wide admin-text-muted"
                style={{ background: 'var(--admin-input-bg)' }}
              >
                <th className="py-3.5 px-4 font-semibold w-[120px]">Önizleme</th>
                <th className="py-3.5 px-4 font-semibold">Adı</th>
                <th className="py-3.5 px-4 font-semibold hidden md:table-cell">İlgili Ürün</th>
                <th className="py-3.5 px-4 font-semibold hidden sm:table-cell">Sıra</th>
                <th className="py-3.5 px-4 font-semibold">Durum</th>
                <th className="py-3.5 px-4 font-semibold w-[100px]">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState message="Henüz vitrin görseli eklenmemiş" />
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b transition hover:bg-[var(--admin-accent-soft)]/30"
                    style={{
                      borderColor: 'var(--admin-card-border)',
                      opacity: item.isActive ? 1 : 0.4,
                    }}
                  >
                    <td className="py-3.5 px-4">
                      {item.imageUrl ? (
                        <img
                          src={imageUrl(item.imageUrl)}
                          alt=""
                          className="w-24 h-14 rounded-xl object-cover"
                          style={{ background: 'var(--admin-input-bg)' }}
                        />
                      ) : (
                        <div
                          className="w-24 h-14 rounded-xl"
                          style={{ background: 'var(--admin-accent-soft)' }}
                        />
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-[var(--admin-text)]">{item.name}</p>
                      {item.translations[0]?.title1 && (
                        <p className="text-xs admin-text-muted truncate max-w-xs">
                          {item.translations.find((t) => t.languageCode === 'tr')?.title1 ||
                            item.translations[0]?.title1}
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 admin-text-muted hidden md:table-cell">
                      {item.productName || '—'}
                    </td>
                    <td className="py-3.5 px-4 admin-text-muted hidden sm:table-cell">
                      {item.sortOrder}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge active={item.isActive} />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex gap-1">
                        <button
                          onClick={() => openEdit(item)}
                          className="p-2 rounded-xl transition hover:bg-[var(--admin-accent-soft)]"
                          style={{ color: 'var(--admin-accent)' }}
                          title="Düzenle"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggle(item)}
                          className={`p-2 rounded-xl transition ${
                            item.isActive
                              ? 'hover:bg-amber-500/10 text-amber-600'
                              : 'hover:bg-emerald-500/10 text-emerald-600'
                          }`}
                          title={item.isActive ? 'Pasifleştir' : 'Aktifleştir'}
                        >
                          {item.isActive ? (
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

      <ShowcaseModal
        open={modalOpen}
        mode={modalMode}
        languages={languages}
        products={products}
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
