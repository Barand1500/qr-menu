import { useEffect, useState } from 'react';
import { Plus, Pencil, EyeOff, Eye, X, UserCircle } from 'lucide-react';
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

  useEffect(() => {
    if (!modalOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setModalOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen]);

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

  async function handleToggle(user: UserItem) {
    const next = !user.isActive;
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isActive: next } : u)));
    try {
      await api(`/api/admin/users/${user.id}/toggle`, { method: 'PATCH' });
    } catch {
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isActive: user.isActive } : u))
      );
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Kullanıcılar"
        actions={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Yeni Kullanıcı
          </Button>
        }
      />

      <Card className="overflow-hidden !p-0">
        <div
          className="p-4 sm:p-5 border-b"
          style={{ borderColor: 'var(--admin-card-border)' }}
        >
          <div className="max-w-md">
            <Input
              label="Ad, e-posta ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto admin-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr
                className="text-left text-xs uppercase tracking-wide admin-text-muted"
                style={{ background: 'var(--admin-input-bg)' }}
              >
                <th className="py-3.5 px-4 font-semibold">Ad Soyad</th>
                <th className="py-3.5 px-4 font-semibold">E-posta</th>
                <th className="py-3.5 px-4 font-semibold hidden sm:table-cell">GSM</th>
                <th className="py-3.5 px-4 font-semibold">Durum</th>
                <th className="py-3.5 px-4 font-semibold w-[100px]">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState message="Kullanıcı bulunamadı" />
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    onDoubleClick={() => openEdit(user)}
                    className="border-b transition hover:bg-[var(--admin-accent-soft)]/30 admin-table-row--editable cursor-pointer"
                    style={{
                      borderColor: 'var(--admin-card-border)',
                      opacity: user.isActive ? 1 : 0.45,
                    }}
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold"
                          style={{
                            background: 'var(--admin-accent-soft)',
                            color: 'var(--admin-accent-text)',
                          }}
                        >
                          {user.fullName.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-[var(--admin-text)]">{user.fullName}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 admin-text-muted">{user.email}</td>
                    <td className="py-3.5 px-4 admin-text-muted hidden sm:table-cell">
                      {user.phone || '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge active={user.isActive} />
                    </td>
                    <td className="py-3.5 px-4" onDoubleClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <button
                          onClick={() => openEdit(user)}
                          className="p-2 rounded-xl transition hover:bg-[var(--admin-accent-soft)]"
                          style={{ color: 'var(--admin-accent)' }}
                          title="Düzenle"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggle(user)}
                          className={`p-2 rounded-xl transition ${
                            user.isActive
                              ? 'hover:bg-amber-500/10 text-amber-500'
                              : 'hover:bg-emerald-500/10 text-emerald-500'
                          }`}
                          title={user.isActive ? 'Pasifleştir' : 'Aktifleştir'}
                        >
                          {user.isActive ? (
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

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div className="absolute inset-0 bg-black/35 backdrop-blur-[6px]" />
          <div
            className="relative w-full sm:max-w-md rounded-t-[28px] sm:rounded-[28px] shadow-2xl animate-slide-up p-6"
            style={{
              background: 'var(--admin-card)',
              border: '1px solid var(--admin-card-border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-5">
              <div className="flex items-start gap-3">
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: 'var(--admin-accent-soft)' }}
                >
                  <UserCircle className="w-5 h-5" style={{ color: 'var(--admin-accent)' }} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[var(--admin-text)]">
                    {editing ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı'}
                  </h2>
                  <p className="text-sm admin-text-muted mt-0.5">Panel erişim bilgileri</p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-2 rounded-xl hover:bg-[var(--admin-accent-soft)] admin-text-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="float-field-stack">
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
              <label
                className="flex items-center gap-2.5 cursor-pointer text-sm text-[var(--admin-text)] py-1"
              >
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--admin-accent)]"
                />
                Aktif kullanıcı
              </label>
            </div>

            <div className="flex gap-3 mt-6">
              <Button variant="secondary" className="flex-1" onClick={() => setModalOpen(false)}>
                İptal
              </Button>
              <Button className="flex-1" onClick={handleSave}>
                Kaydet
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
