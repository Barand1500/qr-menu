import { useEffect, useState } from 'react';
import { Plus, Pencil, EyeOff } from 'lucide-react';
import { api, imageUrl } from '@/lib/api';
import { Badge, Button, Card, EmptyState, Input, PageHeader, Spinner } from '@/components/ui';

interface ShowcaseItem {
  id: number;
  name: string;
  imageUrl?: string | null;
  sortOrder: number;
  isActive: boolean;
}

export default function ShowcasePage() {
  const [items, setItems] = useState<ShowcaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ShowcaseItem | null>(null);
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);

  async function load() {
    const data = await api<ShowcaseItem[]>('/api/admin/showcase');
    setItems(data);
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  function openCreate() {
    setEditing(null);
    setName('');
    setIsActive(true);
    setImageFile(null);
    setModalOpen(true);
  }

  function openEdit(item: ShowcaseItem) {
    setEditing(item);
    setName(item.name);
    setIsActive(item.isActive);
    setImageFile(null);
    setModalOpen(true);
  }

  async function handleSave() {
    if (editing) {
      await api(`/api/admin/showcase/${editing.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, isActive }),
      });
      if (imageFile) {
        const fd = new FormData();
        fd.append('image', imageFile);
        await fetch(`/api/admin/showcase/${editing.id}/image`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: fd,
        });
      }
    } else {
      const created = await api<ShowcaseItem>('/api/admin/showcase', {
        method: 'POST',
        body: JSON.stringify({ name, isActive }),
      });
      if (imageFile) {
        const fd = new FormData();
        fd.append('image', imageFile);
        await fetch(`/api/admin/showcase/${created.id}/image`, {
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
    await api(`/api/admin/showcase/${id}/toggle`, { method: 'PATCH' });
    await load();
  }

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Vitrin Görselleri"
        actions={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" /> Yeni Vitrin Görseli
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 bg-slate-50/80">
                <th className="py-3 px-4 w-16" />
                <th className="py-3 px-4 font-medium">Adı</th>
                <th className="py-3 px-4 font-medium">Sıra</th>
                <th className="py-3 px-4 font-medium">Aktif</th>
                <th className="py-3 px-4 w-24" />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState message="Tabloda herhangi bir veri mevcut değil" />
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-50">
                    <td className="py-3 px-4">
                      {item.imageUrl ? (
                        <img src={imageUrl(item.imageUrl)} alt="" className="w-12 h-12 rounded-lg object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-slate-100" />
                      )}
                    </td>
                    <td className="py-3 px-4 font-medium">{item.name}</td>
                    <td className="py-3 px-4 text-slate-500">{item.sortOrder}</td>
                    <td className="py-3 px-4">
                      <Badge active={item.isActive} />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(item)} className="p-2 rounded-lg hover:bg-amber-50 text-amber-600">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleToggle(item.id)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
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
          <Card className="w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">
              {editing ? 'Düzenle' : 'Yeni Vitrin Görseli'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Adı</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Görsel</label>
                <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                Aktif
              </label>
            </div>
            <div className="flex gap-2 mt-6 justify-end">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>İptal</Button>
              <Button onClick={handleSave}>Kaydet</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
