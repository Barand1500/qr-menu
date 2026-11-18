import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Link2,
  LockKeyhole,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Shuffle,
  Type,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader, Spinner } from '@/components/ui';
import AdminOverlay from '@/components/admin/AdminOverlay';
import AdminToast, {
  type AdminToastNotice,
} from '@/components/admin/AdminToast';
import { useAuth } from '@/contexts/AuthContext';
import {
  adminPath,
  getAdminPathSlug,
  normalizeAdminPath,
  setAdminPathSlug,
  suggestAdminPath,
  validateAdminPath,
} from '@/lib/adminPath';
import {
  DEFAULT_SITE_TITLE,
  getSiteTitle,
  setSiteTitle,
  validateSiteTitle,
} from '@/lib/siteTitle';
import '@/admin-users.css';

interface UserItem {
  id: number;
  email: string;
  fullName: string;
  phone?: string | null;
  role: string;
  isActive: boolean;
}
const blankForm = () => ({
  email: '',
  password: '',
  fullName: '',
  phone: '',
  role: 'staff',
  isActive: true,
});
const message = (err: unknown) =>
  err instanceof Error ? err.message : 'İşlem tamamlanamadı';
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toLocaleUpperCase('tr') || '?';

export default function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]),
    [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(false);
  const [searchDraft, setSearchDraft] = useState(''),
    [search, setSearch] = useState('');
  const [page, setPage] = useState(1),
    [revision, setRevision] = useState(0);
  const [modalOpen, setModalOpen] = useState(false),
    [editing, setEditing] = useState<UserItem | null>(null);
  const [form, setForm] = useState(blankForm),
    [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false),
    [showPassword, setShowPassword] = useState(false);
  const [toggling, setToggling] = useState<number | null>(null);
  const mutationLock = useRef(false);
  const [notice, setNotice] = useState<AdminToastNotice>(null);
  const toast = (text: string, error = false) => setNotice({ text, error });
  const [settingsOpen, setSettingsOpen] = useState(false),
    [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState(false),
    [settingsRevision, setSettingsRevision] = useState(0);
  const [panelPath, setPanelPath] = useState(getAdminPathSlug),
    [pathDraft, setPathDraft] = useState(getAdminPathSlug);
  const [pathAck, setPathAck] = useState(false),
    [pathSaving, setPathSaving] = useState(false);
  const [pathError, setPathError] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState(getSiteTitle),
    [savedTitle, setSavedTitle] = useState(getSiteTitle);
  const [titleSaving, setTitleSaving] = useState(false),
    [titleError, setTitleError] = useState<string | null>(null);
  const settingsLock = useRef(false),
    redirectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
      undefined,
    );
  const pageSize = 20,
    pageCount = Math.max(1, Math.ceil(total / pageSize));
  const settingsBusy = pathSaving || titleSaving;
  const normalizedPath = pathDraft.trim() ? normalizeAdminPath(pathDraft) : '';
  const pathChanged = normalizedPath !== panelPath;

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchDraft.trim());
      setPage(1);
    }, 280);
    return () => clearTimeout(timer);
  }, [searchDraft]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(false);
    const query = new URLSearchParams({
      page: String(page),
      limit: String(pageSize),
    });
    if (search) query.set('search', search);
    api<{ data: UserItem[]; pagination?: { total: number } }>(
      `/api/admin/users?${query}`,
      { signal: controller.signal },
    )
      .then((res) => {
        if (controller.signal.aborted) return;
        const count = res.pagination?.total ?? res.data.length;
        if (page > Math.max(1, Math.ceil(count / pageSize))) {
          setPage(Math.max(1, Math.ceil(count / pageSize)));
          return;
        }
        setUsers(res.data);
        setTotal(count);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [search, page, revision]);
  useEffect(() => {
    const controller = new AbortController();
    setSettingsLoading(true);
    setSettingsError(false);
    Promise.all([
      api<{ path: string }>('/api/admin/settings/admin-path', {
        signal: controller.signal,
      }),
      api<{ title: string }>('/api/admin/settings/site-title', {
        signal: controller.signal,
      }),
    ])
      .then(([path, title]) => {
        if (controller.signal.aborted) return;
        const p = setAdminPathSlug(path.path),
          t = setSiteTitle(title.title);
        setPanelPath(p);
        setPathDraft(p);
        setTitleDraft(t);
        setSavedTitle(t);
      })
      .catch(() => {
        if (!controller.signal.aborted) setSettingsError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setSettingsLoading(false);
      });
    return () => controller.abort();
  }, [settingsRevision]);
  useEffect(() => () => clearTimeout(redirectTimer.current), []);

  function openUser(item?: UserItem) {
    if (mutationLock.current) return;
    setEditing(item || null);
    setFormError(null);
    setShowPassword(false);
    setForm(
      item
        ? {
            ...blankForm(),
            email: item.email,
            fullName: item.fullName,
            phone: item.phone || '',
            role: item.role === 'admin' ? 'admin' : 'staff',
            isActive: item.isActive,
          }
        : blankForm(),
    );
    setModalOpen(true);
  }
  async function saveUser() {
    if (mutationLock.current) return;
    setFormError(null);
    if (!form.fullName.trim()) {
      setFormError('Ad soyad gerekli.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setFormError('Geçerli bir e-posta adresi yazın.');
      return;
    }
    if (!editing && !form.password) {
      setFormError('Yeni kullanıcı için şifre gerekli.');
      return;
    }
    if (form.password && form.password.length < 6) {
      setFormError('Şifre en az 6 karakter olmalı.');
      return;
    }
    mutationLock.current = true;
    setSaving(true);
    try {
      await api(
        editing ? `/api/admin/users/${editing.id}` : '/api/admin/users',
        {
          method: editing ? 'PUT' : 'POST',
          body: JSON.stringify({
            email: form.email.trim(),
            fullName: form.fullName.trim(),
            phone: form.phone.trim(),
            role: form.role,
            isActive: form.isActive,
            ...(form.password ? { password: form.password } : {}),
          }),
        },
      );
      setModalOpen(false);
      toast(editing ? 'Kullanıcı güncellendi.' : 'Yeni kullanıcı eklendi.');
      setRevision((v) => v + 1);
    } catch (err) {
      setFormError(message(err));
    } finally {
      mutationLock.current = false;
      setSaving(false);
    }
  }
  async function toggleUser(item: UserItem) {
    if (mutationLock.current) return;
    mutationLock.current = true;
    setToggling(item.id);
    try {
      const updated = await api<UserItem>(
        `/api/admin/users/${item.id}/toggle`,
        { method: 'PATCH' },
      );
      setUsers((items) => items.map((u) => (u.id === item.id ? updated : u)));
      toast(
        updated.isActive ? 'Panel erişimi açıldı.' : 'Panel erişimi kapatıldı.',
      );
    } catch (err) {
      toast(message(err), true);
    } finally {
      mutationLock.current = false;
      setToggling(null);
    }
  }
  async function saveTitle() {
    if (settingsLock.current || settingsLoading || settingsError) return;
    setTitleError(null);
    const checked = validateSiteTitle(titleDraft);
    if (!checked.ok) {
      setTitleError(checked.message);
      return;
    }
    settingsLock.current = true;
    setTitleSaving(true);
    try {
      const res = await api<{ title: string }>(
        '/api/admin/settings/site-title',
        { method: 'PUT', body: JSON.stringify({ title: checked.title }) },
      );
      const title = setSiteTitle(res.title);
      setTitleDraft(title);
      setSavedTitle(title);
      toast('Sekme adı güncellendi.');
    } catch (err) {
      setTitleError(message(err));
    } finally {
      settingsLock.current = false;
      setTitleSaving(false);
    }
  }
  async function savePath() {
    if (settingsLock.current || settingsLoading || settingsError) return;
    setPathError(null);
    const checked = validateAdminPath(pathDraft);
    if (!checked.ok) {
      setPathError(checked.message);
      return;
    }
    if (checked.path !== panelPath && !pathAck) {
      setPathError('Eski adresin kapanacağını onaylayın.');
      return;
    }
    settingsLock.current = true;
    setPathSaving(true);
    try {
      const res = await api<{ path: string }>(
        '/api/admin/settings/admin-path',
        { method: 'PUT', body: JSON.stringify({ path: checked.path }) },
      );
      const next = setAdminPathSlug(res.path);
      setPanelPath(next);
      setPathDraft(next);
      setPathAck(false);
      toast('Panel adresi güncellendi.');
      if (next !== panelPath) {
        redirectTimer.current = setTimeout(
          () => window.location.assign(adminPath('users')),
          650,
        );
      } else {
        settingsLock.current = false;
        setPathSaving(false);
      }
    } catch (err) {
      setPathError(message(err));
      settingsLock.current = false;
      setPathSaving(false);
    }
  }
  async function copyPath() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}${adminPath()}`,
      );
      toast('Panel adresi kopyalandı.');
    } catch {
      toast('Adres kopyalanamadı.', true);
    }
  }

  return (
    <div className="au-page">
      <PageHeader
        title="Kullanıcılar"
        subtitle={loading ? 'Panelinize erişen kişiler.' : `${total} kullanıcı`}
        actions={
          <div className="au-heading-actions">
            <button className="au-button" onClick={() => setSettingsOpen(true)}>
              <Settings2 size={17} /> Panel ayarları
            </button>
            <button
              className="au-button is-primary"
              disabled={saving || toggling !== null}
              onClick={() => openUser()}
            >
              <Plus size={18} /> Kullanıcı ekle
            </button>
          </div>
        }
      />
      <AdminToast notice={notice} onClose={() => setNotice(null)} />
      <section className="au-directory" aria-label="Kullanıcı listesi">
        <div className="au-toolbar">
          <label className="au-search">
            <Search size={18} />
            <input
              type="search"
              aria-label="Kullanıcı ara"
              placeholder="Ad veya e-posta ara"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
            />
          </label>
          <span>
            <UsersRound size={16} /> Ekip erişimi
          </span>
        </div>
        <div className="au-column-head" aria-hidden="true">
          <span>Kullanıcı</span>
          <span>İletişim</span>
          <span>Rol</span>
          <span>Panel erişimi</span>
        </div>
        {loading ? (
          <div className="au-empty">
            <Spinner />
          </div>
        ) : loadError ? (
          <div className="au-empty" role="alert">
            <UsersRound size={30} />
            <p>Kullanıcılar yüklenemedi.</p>
            <button
              className="au-button"
              onClick={() => setRevision((v) => v + 1)}
            >
              Tekrar dene
            </button>
          </div>
        ) : !users.length ? (
          <div className="au-empty">
            <UsersRound size={34} />
            <h2>
              {search ? 'Bir eşleşme bulamadık.' : 'Ekibinizi buraya ekleyin.'}
            </h2>
            <p>
              {search
                ? 'Farklı bir ad veya e-posta deneyin.'
                : 'Her çalışan kendi hesabıyla giriş yapsın.'}
            </p>
            {!search && (
              <button
                className="au-button is-primary"
                onClick={() => openUser()}
              >
                <Plus size={17} /> Kullanıcı ekle
              </button>
            )}
          </div>
        ) : (
          <ul className="au-list">
            {users.map((item, index) => (
              <li
                className={`au-row${item.isActive ? '' : ' is-inactive'}`}
                key={item.id}
                style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
              >
                <button
                  className="au-open"
                  aria-label={`${item.fullName} kullanıcısını düzenle`}
                  disabled={saving || toggling !== null}
                  onClick={() => openUser(item)}
                >
                  <span className="au-person">
                    <span className="au-avatar">{initials(item.fullName)}</span>
                    <span>
                      <strong>
                        {item.fullName}
                        {me?.id === item.id && <small>Siz</small>}
                      </strong>
                    </span>
                  </span>
                  <span className="au-contact">
                    <span>{item.email}</span>
                    {item.phone && <small>{item.phone}</small>}
                  </span>
                  <span
                    className={`au-role${item.role === 'admin' ? ' is-admin' : ''}`}
                  >
                    {item.role === 'admin' ? (
                      <ShieldCheck size={15} />
                    ) : (
                      <UserRound size={15} />
                    )}{' '}
                    {item.role === 'admin' ? 'Yönetici' : 'Personel'}
                  </span>
                  <ArrowUpRight className="au-row-arrow" size={18} />
                </button>
                <button
                  className="au-access"
                  role="switch"
                  aria-checked={item.isActive}
                  aria-label={`${item.fullName} panel erişimi`}
                  disabled={toggling !== null || saving}
                  onClick={() => void toggleUser(item)}
                >
                  <span className="au-switch">
                    <span>
                      {toggling === item.id ? (
                        <span className="au-pending" />
                      ) : item.isActive ? (
                        <Check size={11} />
                      ) : null}
                    </span>
                  </span>
                  <span>{item.isActive ? 'Açık' : 'Kapalı'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {!loading && !loadError && total > 0 && (
          <footer className="au-pager">
            <span>
              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} /{' '}
              {total}
            </span>
            <div>
              <button
                aria-label="Önceki sayfa"
                disabled={page <= 1}
                onClick={() => setPage((v) => v - 1)}
              >
                <ChevronLeft size={18} />
              </button>
              <span>
                {page} / {pageCount}
              </span>
              <button
                aria-label="Sonraki sayfa"
                disabled={page >= pageCount}
                onClick={() => setPage((v) => v + 1)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </footer>
        )}
      </section>
      {modalOpen && (
        <AdminOverlay
          label={editing ? 'Kullanıcı düzenle' : 'Yeni kullanıcı'}
          busy={saving}
          onClose={() => {
            if (!mutationLock.current) setModalOpen(false);
          }}
          className="au-overlay"
        >
          <section className="relative au-editor">
            <header className="au-modal-head">
              <span className="au-modal-icon">
                <UserRound size={22} />
              </span>
              <div>
                <h2>
                  {editing ? 'Kullanıcı düzenle' : 'Ekibe birini ekleyin.'}
                </h2>
                <p>
                  {editing
                    ? editing.email
                    : 'Panel için kişisel bir giriş hesabı.'}
                </p>
              </div>
              <button
                className="au-close"
                aria-label="Kapat"
                disabled={saving}
                onClick={() => setModalOpen(false)}
              >
                <X size={20} />
              </button>
            </header>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void saveUser();
              }}
            >
              <fieldset className="au-fields" disabled={saving}>
                <label className="au-wide">
                  Ad soyad
                  <input
                    autoComplete="name"
                    value={form.fullName}
                    onChange={(e) =>
                      setForm({ ...form, fullName: e.target.value })
                    }
                    required
                  />
                </label>
                <label className="au-wide">
                  E-posta
                  <input
                    type="email"
                    autoComplete="off"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    required
                  />
                </label>
                <label className="au-wide">
                  {editing ? 'Yeni şifre' : 'Şifre'}
                  {editing && (
                    <small>Boş bırakırsanız mevcut şifre korunur.</small>
                  )}
                  <span className="au-password">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      minLength={6}
                      required={!editing}
                      value={form.password}
                      onChange={(e) =>
                        setForm({ ...form, password: e.target.value })
                      }
                    />
                    <button
                      type="button"
                      aria-label={
                        showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'
                      }
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </span>
                </label>
                <label className="au-wide">
                  Telefon <small>İsteğe bağlı</small>
                  <input
                    type="tel"
                    autoComplete="tel"
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                  />
                </label>
                <div className="au-wide au-role-picker">
                  <span>Rol</span>
                  <div role="group" aria-label="Kullanıcı rolü">
                    {['staff', 'admin'].map((role) => (
                      <button
                        type="button"
                        key={role}
                        aria-pressed={form.role === role}
                        onClick={() => setForm({ ...form, role })}
                      >
                        {role === 'admin' ? (
                          <ShieldCheck size={19} />
                        ) : (
                          <UserRound size={19} />
                        )}{' '}
                        {role === 'admin' ? 'Yönetici' : 'Personel'}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="au-active-field au-wide">
                  <span>
                    <strong>Panel erişimi</strong>
                    <small>Kapalı hesaplar giriş yapamaz.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) =>
                      setForm({ ...form, isActive: e.target.checked })
                    }
                  />
                </label>
              </fieldset>
              {formError && (
                <p className="au-error" role="alert">
                  {formError}
                </p>
              )}
              <footer className="au-form-footer">
                <button
                  className="au-button is-primary"
                  disabled={saving}
                  type="submit"
                >
                  {saving
                    ? 'Kaydediliyor…'
                    : editing
                      ? 'Değişiklikleri kaydet'
                      : 'Kullanıcıyı ekle'}
                  <ArrowUpRight size={18} />
                </button>
              </footer>
            </form>
          </section>
        </AdminOverlay>
      )}
      {settingsOpen && (
        <AdminOverlay
          label="Panel ayarları"
          busy={settingsBusy}
          onClose={() => {
            if (!settingsLock.current) setSettingsOpen(false);
          }}
          className="au-overlay"
        >
          <section className="relative au-settings">
            <header className="au-modal-head">
              <span className="au-modal-icon">
                <Settings2 size={22} />
              </span>
              <div>
                <h2>Panel ayarları</h2>
                <p>Giriş adresiniz ve tarayıcı sekmeniz.</p>
              </div>
              <button
                className="au-close"
                aria-label="Kapat"
                disabled={settingsBusy}
                onClick={() => setSettingsOpen(false)}
              >
                <X size={20} />
              </button>
            </header>
            {settingsLoading ? (
              <div className="au-empty">
                <Spinner />
              </div>
            ) : settingsError ? (
              <div className="au-empty" role="alert">
                <p>Ayarlar yüklenemedi.</p>
                <button
                  className="au-button"
                  onClick={() => setSettingsRevision((v) => v + 1)}
                >
                  Tekrar dene
                </button>
              </div>
            ) : (
              <>
                <form
                  className="au-setting-section"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void saveTitle();
                  }}
                >
                  <div className="au-setting-title">
                    <Type size={20} />
                    <div>
                      <h3>Sekme adı</h3>
                      <p>Tarayıcının üstünde görünen isim.</p>
                    </div>
                  </div>
                  <fieldset disabled={settingsBusy}>
                    <label>
                      Site / sekme adı
                      <input
                        maxLength={60}
                        value={titleDraft}
                        placeholder={DEFAULT_SITE_TITLE}
                        onChange={(e) => {
                          setTitleDraft(e.target.value);
                          setTitleError(null);
                        }}
                      />
                    </label>
                    <div className="au-setting-actions">
                      <button
                        type="button"
                        className="au-text-button"
                        onClick={() => setTitleDraft(DEFAULT_SITE_TITLE)}
                      >
                        Varsayılana dön
                      </button>
                      <button
                        className="au-button is-primary"
                        disabled={titleDraft === savedTitle}
                      >
                        {titleSaving ? 'Kaydediliyor…' : 'Adı kaydet'}
                      </button>
                    </div>
                  </fieldset>
                  {titleError && (
                    <p className="au-error" role="alert">
                      {titleError}
                    </p>
                  )}
                </form>
                <form
                  className="au-setting-section"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void savePath();
                  }}
                >
                  <div className="au-setting-title">
                    <LockKeyhole size={20} />
                    <div>
                      <h3>Panel giriş adresi</h3>
                      <p>Adres değiştiğinde eski yol kapanır.</p>
                    </div>
                    <button
                      type="button"
                      className="au-close"
                      aria-label="Panel adresini kopyala"
                      disabled={settingsBusy}
                      onClick={() => void copyPath()}
                    >
                      <Copy size={17} />
                    </button>
                  </div>
                  <fieldset disabled={settingsBusy}>
                    <label>
                      Panel yolu
                      <span className="au-path-input">
                        <Link2 size={17} />
                        <span>/</span>
                        <input
                          value={pathDraft}
                          aria-label="Panel yolu"
                          spellCheck={false}
                          autoCapitalize="off"
                          autoCorrect="off"
                          onChange={(e) => {
                            setPathDraft(e.target.value);
                            setPathAck(false);
                            setPathError(null);
                          }}
                        />
                      </span>
                    </label>
                    <p className="au-address">
                      {window.location.origin}/{normalizedPath || '…'}
                    </p>
                    {pathChanged && (
                      <label className="au-path-ack">
                        <input
                          type="checkbox"
                          checked={pathAck}
                          onChange={(e) => setPathAck(e.target.checked)}
                        />
                        <span>
                          <strong>Yeni adresimi kaydettim.</strong> /{panelPath}{' '}
                          kapanacak; yeni adres üzerinden devam edeceğim.
                        </span>
                      </label>
                    )}
                    <div className="au-setting-actions">
                      <button
                        className="au-text-button"
                        type="button"
                        onClick={() => {
                          setPathDraft(suggestAdminPath());
                          setPathAck(false);
                          setPathError(null);
                        }}
                      >
                        <Shuffle size={15} /> Adres öner
                      </button>
                      <button
                        className="au-button is-primary"
                        disabled={!pathChanged}
                      >
                        {pathSaving ? 'Yönlendiriliyor…' : 'Adresi kaydet'}
                      </button>
                    </div>
                  </fieldset>
                  {pathError && (
                    <p className="au-error" role="alert">
                      {pathError}
                    </p>
                  )}
                </form>
              </>
            )}
          </section>
        </AdminOverlay>
      )}
    </div>
  );
}
