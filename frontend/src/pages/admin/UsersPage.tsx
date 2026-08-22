import { useEffect, useState } from 'react';
import { Plus, Pencil, EyeOff } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, Button, Card, EmptyState, Input, PageHeader, Spinner } from '@/components/ui';

interface UserItem {
  id: number;
  email: string;
  fullName: string;
  phone?: string | null;
  role: string;
  isActive: boolean;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UserItem | null>(null);
  const [form, setForm] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    role: 'staff',
    isActive: true,
  });

  async function load() {
    const params = search ? `?search=${search}` : '';
    const res = await api<{ data: UserItem[] }>(`/api/admin/users${params}`);
    setUsers(res.data);
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [search]);

  function openCreate() {
    setEditing(null);
    setForm({ email: '', password: '', fullName: '', phone: '', role: 'staff', isActive: true });
    setModalOpen(true);
  }

  function openEdit(user: UserItem) {
    setEditing(user);
    setForm({
      email: user.email,
      password: '',
      fullName: user.fullName,
      phone: user.phone || '',
      role: user.role,
      isActive: user.isActive,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    const payload = {
      email: form.email,
      fullName: form.fullName,
      phone: form.phone,
      role: form.role,
      isActive: form.isActive,
      ...(form.password && { password: form.password }),
    };

    if (editing) {
      await api(`/api/admin/users/${editing.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } else {
      await api('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ ...payload, password: form.password }),
      });
    }
    setModalOpen(false);
    await load();
  }

  async function handleToggle(id: number) {
    await api(`/api/admin/users/${id}/toggle`, { method: 'PATCH' });
    await load();
  }

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Kullanıcılar"
        actions={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" /> Yeni Kullanıcı
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <div className="p-4 border-b">
          <div className="max-w-xs">
            <Input label="Ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 bg-slate-50/80">
                <th className="py-3 px-4">Ad Soyad</th>
                <th className="py-3 px-4">E-posta</th>
                <th className="py-3 px-4 hidden sm:table-cell">GSM</th>
                <th className="py-3 px-4">Aktif</th>
                <th className="py-3 px-4 w-24" />
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={5}><EmptyState message="Kullanıcı bulunamadı" /></td></tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="border-b border-slate-50">
                    <td className="py-3 px-4 font-medium">{user.fullName}</td>
                    <td className="py-3 px-4 text-slate-600">{user.email}</td>
                    <td className="py-3 px-4 text-slate-500 hidden sm:table-cell">{user.phone || '—'}</td>
                    <td className="py-3 px-4"><Badge active={user.isActive} /></td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(user)} className="p-2 rounded-lg hover:bg-amber-50 text-amber-600">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleToggle(user.id)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
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
            <h2 className="text-lg font-semibold mb-4">{editing ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı'}</h2>
            <div className="space-y-4">
              <Input
                label="Ad Soyad"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
              <Input
                label="E-posta"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <Input
                label={editing ? 'Yeni Şifre (opsiyonel)' : 'Şifre'}
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <Input
                label="GSM"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
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
