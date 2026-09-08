import { useEffect, useState } from 'react';
import {
  Plus,
  Pencil,
  EyeOff,
  Eye,
  X,
  UserCircle,
  Lock,
  Copy,
  Check,
  Shuffle,
  Search,
  Link2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, Button, Card, EmptyState, Input, PageHeader, Spinner } from '@/components/ui';
import {
  adminPath,
  BLOCKED_ADMIN_PATHS,
  fetchAndCacheAdminPath,
  getAdminPathSlug,
  setAdminPathSlug,
  suggestAdminPath,
  validateAdminPath,
} from '@/lib/adminPath';

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
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    role: 'staff',
    isActive: true,
  });

  const [panelPath, setPanelPath] = useState(getAdminPathSlug());
  const [pathDraft, setPathDraft] = useState(getAdminPathSlug());
  const [pathAck, setPathAck] = useState(false);
  const [pathSaving, setPathSaving] = useState(false);
  const [pathError, setPathError] = useState<string | null>(null);
  const [pathOk, setPathOk] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    const res = await api<{ data: UserItem[] }>(`/api/admin/users${params}`);
    setUsers(res.data);
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [search]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api<{ path: string }>('/api/admin/settings/admin-path');
        const p = setAdminPathSlug(res.path);
        setPanelPath(p);
        setPathDraft(p);
      } catch {
        const p = await fetchAndCacheAdminPath();
        setPanelPath(p);
        setPathDraft(p);
      }
    })();
  }, []);

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
    setFormError(null);
    setForm({ email: '', password: '', fullName: '', phone: '', role: 'staff', isActive: true });
    setModalOpen(true);
  }

  function openEdit(user: UserItem) {
    setEditing(user);
    setFormError(null);
    setForm({
      email: user.email,
      password: '',
      fullName: user.fullName,
      phone: user.phone || '',
      role: user.role === 'admin' ? 'admin' : 'staff',
      isActive: user.isActive,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    setFormError(null);
    if (!form.fullName.trim()) {
      setFormError('Ad soyad gerekli');
      return;
    }
    if (!form.email.trim()) {
      setFormError('E-posta gerekli');
      return;
    }
    if (!editing && !form.password) {
      setFormError('Yeni kullanıcı için şifre gerekli');
      return;
    }
    if (form.password && form.password.length < 6) {
      setFormError('Şifre en az 6 karakter olmalı');
      return;
    }

    const payload = {
      email: form.email.trim(),
      fullName: form.fullName.trim(),
      phone: form.phone,
      role: form.role,
      isActive: form.isActive,
      ...(form.password && { password: form.password }),
    };

    setSaving(true);
    try {
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
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
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

  async function savePanelPath() {
    setPathError(null);
    setPathOk(null);
    const checked = validateAdminPath(pathDraft);
    if (!checked.ok) {
      setPathError(checked.message);
      return;
    }
    if (checked.path !== panelPath && !pathAck) {
      setPathError('Devam etmek için uyarı kutusunu onaylayın');
      return;
    }
    setPathSaving(true);
    try {
      const res = await api<{ path: string }>('/api/admin/settings/admin-path', {
        method: 'PUT',
        body: JSON.stringify({ path: checked.path }),
      });
      const next = setAdminPathSlug(res.path);
      setPanelPath(next);
      setPathDraft(next);
      setPathAck(false);
      setPathOk(`Panel yolu kaydedildi. Yeni adres: ${window.location.origin}${adminPath()}`);
      if (next !== panelPath) {
        window.setTimeout(() => {
          window.location.assign(adminPath('users'));
        }, 600);
      }
    } catch (err) {
      setPathError(err instanceof Error ? err.message : 'Kaydedilemedi');
    } finally {
      setPathSaving(false);
    }
  }

  async function copyPanelUrl() {
    const url = `${window.location.origin}${adminPath()}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setPathError('Kopyalanamadı');
    }
  }

  if (loading) return <Spinner />;

  const pathChanged = normalizeDraft(pathDraft) !== panelPath;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const draftSlug = normalizeDraft(pathDraft) || '…';

  return (
    <div className="space-y-4">
      <PageHeader
        title="Kullanıcılar"
        actions={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Yeni Kullanıcı
          </Button>
        }
      />

      <Card className="!p-0 overflow-hidden">
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 border-b"
          style={{
            borderColor: 'var(--admin-card-border)',
            background: 'color-mix(in srgb, var(--admin-accent-soft) 55%, var(--admin-card))',
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-card-border)' }}
            >
              <Lock className="w-3.5 h-3.5" style={{ color: 'var(--admin-accent)' }} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--admin-text)] leading-tight">
                Panel giriş adresi
              </p>
              <p className="text-[11px] admin-text-muted leading-snug">
                Gizli tutun · Değişince eski yol kapanır · Yasak:{' '}
                {BLOCKED_ADMIN_PATHS.map((p, i) => (
                  <span key={p}>
                    {i > 0 ? ', ' : null}
                    <code className="text-[10px] font-semibold text-red-600">/{p}</code>
                  </span>
                ))}
              </p>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 space-y-3">
          <div className="flex flex-col lg:flex-row gap-2 lg:items-center">
            <div
              className="flex-1 flex items-stretch rounded-xl overflow-hidden min-w-0"
              style={{
                border: '1px solid var(--admin-card-border)',
                background: 'var(--admin-input-bg)',
              }}
            >
              <span
                className="hidden sm:inline-flex items-center gap-1.5 px-3 text-xs admin-text-muted shrink-0 border-r whitespace-nowrap"
                style={{ borderColor: 'var(--admin-card-border)' }}
              >
                <Link2 className="w-3.5 h-3.5 opacity-60 shrink-0" />
                <span>{origin}/</span>
              </span>
              <input
                value={pathDraft}
                onChange={(e) => {
                  setPathDraft(e.target.value);
                  setPathError(null);
                  setPathOk(null);
                }}
                placeholder="panel-7k2x"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                className="flex-1 min-w-0 px-3 py-2.5 text-sm font-medium outline-none bg-transparent text-[var(--admin-text)]"
                aria-label="Panel yolu"
              />
            </div>

            <div className="flex flex-wrap gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setPathDraft(suggestAdminPath());
                  setPathError(null);
                  setPathOk(null);
                }}
                className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl text-xs font-semibold transition hover:bg-[var(--admin-accent-soft)]"
                style={{
                  border: '1px solid var(--admin-card-border)',
                  color: 'var(--admin-text)',
                  background: 'var(--admin-card)',
                }}
                title="Güçlü yol öner"
              >
                <Shuffle className="w-3.5 h-3.5" />
                Öner
              </button>
              <button
                type="button"
                onClick={() => void copyPanelUrl()}
                className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl text-xs font-semibold transition hover:bg-[var(--admin-accent-soft)]"
                style={{
                  border: '1px solid var(--admin-card-border)',
                  color: 'var(--admin-text)',
                  background: 'var(--admin-card)',
                }}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Kopyalandı' : 'Kopyala'}
              </button>
              <Button
                size="sm"
                className="h-10"
                disabled={pathSaving}
                onClick={() => void savePanelPath()}
              >
                {pathSaving ? '…' : 'Kaydet'}
              </Button>
            </div>
          </div>

          <p className="text-[11px] admin-text-muted sm:hidden">
            Tam adres:{' '}
            <span className="font-medium text-[var(--admin-text)]">
              {origin}/{draftSlug}
            </span>
          </p>

          {pathChanged ? (
            <label
              className="flex items-start gap-2.5 rounded-xl px-3 py-2.5 cursor-pointer text-[12px] leading-snug"
              style={{
                border: '1px solid color-mix(in srgb, #b45309 28%, var(--admin-card-border))',
                background: 'color-mix(in srgb, #f59e0b 10%, var(--admin-card))',
                color: 'var(--admin-text)',
              }}
            >
              <input
                type="checkbox"
                checked={pathAck}
                onChange={(e) => setPathAck(e.target.checked)}
                className="mt-0.5 w-3.5 h-3.5 rounded accent-[var(--admin-accent)] shrink-0"
              />
              <span>
                Eski yol (<code className="text-[11px]">/{panelPath}</code>) kapanacak; yeni adres{' '}
                <code className="text-[11px]">/{draftSlug}</code>. Yer imine ekleyin — unutursanız
                panele giremezsiniz.
              </span>
            </label>
          ) : null}

          {pathError ? <p className="text-xs text-red-600">{pathError}</p> : null}
          {pathOk ? <p className="text-xs text-emerald-600">{pathOk}</p> : null}
        </div>
      </Card>

      <Card className="overflow-hidden !p-0">
        <div
          className="px-4 py-3 border-b flex flex-wrap items-center gap-3"
          style={{ borderColor: 'var(--admin-card-border)' }}
        >
          <div className="relative flex-1 min-w-[12rem] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 admin-text-muted pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ad veya e-posta ara…"
              className="w-full h-10 pl-9 pr-3 rounded-xl text-sm outline-none"
              style={{
                background: 'var(--admin-input-bg)',
                border: '1px solid var(--admin-card-border)',
                color: 'var(--admin-text)',
              }}
            />
          </div>
          <p className="text-xs admin-text-muted ml-auto">{users.length} kullanıcı</p>
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
                <th className="py-3.5 px-4 font-semibold hidden md:table-cell">Rol</th>
                <th className="py-3.5 px-4 font-semibold hidden sm:table-cell">GSM</th>
                <th className="py-3.5 px-4 font-semibold">Durum</th>
                <th className="py-3.5 px-4 font-semibold w-[100px]">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6}>
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
                    <td className="py-3.5 px-4 hidden md:table-cell">
                      <span
                        className="inline-flex px-2 py-0.5 rounded-lg text-xs font-semibold"
                        style={{
                          background: 'var(--admin-accent-soft)',
                          color: 'var(--admin-accent-text)',
                        }}
                      >
                        {user.role === 'admin' ? 'Admin' : 'Personel'}
                      </span>
                    </td>
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
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
                  <p className="text-sm admin-text-muted mt-0.5">
                    Panel girişi: e-posta + şifre → {window.location.origin}/login
                  </p>
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
              <label className="block text-sm text-[var(--admin-text)]">
                <span className="admin-text-muted text-xs font-semibold uppercase tracking-wide">
                  Rol
                </span>
                <select
                  className="mt-1.5 w-full rounded-xl border px-3 py-2.5 bg-[var(--admin-input-bg)] text-[var(--admin-text)]"
                  style={{ borderColor: 'var(--admin-card-border)' }}
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <option value="staff">Personel</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer text-sm text-[var(--admin-text)] py-1">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--admin-accent)]"
                />
                Aktif kullanıcı (pasif ise giriş yapamaz)
              </label>
            </div>

            {formError ? <p className="text-sm text-red-600 mt-3">{formError}</p> : null}

            <div className="flex gap-3 mt-6">
              <Button variant="secondary" className="flex-1" onClick={() => setModalOpen(false)}>
                İptal
              </Button>
              <Button className="flex-1" disabled={saving} onClick={() => void handleSave()}>
                {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function normalizeDraft(raw: string) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
}
