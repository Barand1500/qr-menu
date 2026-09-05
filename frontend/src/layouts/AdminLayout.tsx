import { useState, useEffect, type ReactNode } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Menu,
  LogOut,
  ExternalLink,
  ChevronDown,
  Sun,
  Moon,
  RotateCcw,
  Puzzle,
  Armchair,
  Construction,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useDemoData } from '@/contexts/DemoDataContext';
import { api } from '@/lib/api';
import { useAddons } from '@/hooks/useAddons';
import AdminNotificationBell from '@/components/AdminNotificationBell';
import AdminTour, { AdminTourHelpButton } from '@/components/admin/AdminTour';
import type { TourOpenGroup } from '@/lib/adminTourSteps';
import { adminPreviewMenuUrl } from '@/lib/tableContext';
import '@/admin-tour.css';
const mainNavBase = [
  { to: '/admin', label: 'Özet', end: true, tourId: 'nav-ozet' },
  { to: '/admin/groups', label: 'Gruplar', tourId: 'nav-groups' },
  { to: '/admin/products', label: 'Ürünler', tourId: 'nav-products' },
  { to: '/admin/showcase', label: 'Vitrin Görselleri', tourId: 'nav-showcase' },
  { to: '/admin/barcode', label: 'Barkod Yazdır', tourId: 'nav-barcode' },
];

const startupNav = [
  { to: '/admin/startup/welcome', label: 'Karşılama Ekranı', tourId: 'nav-welcome-theme' },
  { to: '/admin/startup/menu', label: 'Menü Ekranı', tourId: 'nav-menu-theme' },
];

const reportNav = [
  { to: '/admin/stats', label: 'İstatistikler', tourId: 'nav-stats' },
  { to: '/admin/suggestions', label: 'Öneri Kutusu', tourId: 'nav-suggestions' },
  { to: '/admin/complaints', label: 'Şikayet Kutusu', tourId: 'nav-complaints' },
];
const managementNav = [
  { to: '/admin/users', label: 'Kullanıcılar', tourId: 'nav-users' },
  { to: '/admin/settings', label: 'Ayarlar', tourId: 'nav-settings' },
];

function NavGroup({
  label,
  open,
  onToggle,
  children,
  tourId,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  tourId?: string;
}) {
  return (
    <div className="pt-1">
      <button
        type="button"
        onClick={onToggle}
        data-tour={tourId}
        className={`sidebar-nav-group-btn ${open ? 'sidebar-nav-group-btn--open' : ''}`}
      >
        <span>{label}</span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="sidebar-nav-submenu">{children}</div>}
    </div>
  );
}

function NavItem({
  to,
  label,
  end,
  sub,
  onNavigate,
  tourId,
}: {
  to: string;
  label: string;
  end?: boolean;
  sub?: boolean;
  onNavigate?: () => void;
  tourId?: string;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      data-tour={tourId}
      className={({ isActive }) =>
        `sidebar-nav-link${sub ? ' sidebar-nav-link--sub' : ''}${
          isActive ? ' sidebar-nav-link--active' : ''
        }`
      }
    >
      {label}
    </NavLink>
  );
}

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { demoEnabled, toggleDemo } = useDemoData();
  const { isOwned } = useAddons();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [managementOpen, setManagementOpen] = useState(false);
  const [startupOpen, setStartupOpen] = useState(false);
  const [resettingAddons, setResettingAddons] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [maintenanceOn, setMaintenanceOn] = useState(false);
  const [maintenanceBusy, setMaintenanceBusy] = useState(false);

  const mainNav = [
    ...mainNavBase,
    ...(isOwned('lang-pack')
      ? [{ to: '/admin/bulk-translate', label: 'Toplu Çeviri', tourId: 'nav-bulk' }]
      : []),
  ];

  const closeMobile = () => setMobileOpen(false);

  function handleOpenTourGroup(group: TourOpenGroup) {
    if (group === 'startup') setStartupOpen(true);
    if (group === 'reports') setReportsOpen(true);
    if (group === 'management') setManagementOpen(true);
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  function openPublicMenu() {
    window.open(adminPreviewMenuUrl(), '_blank');
  }

  async function handleResetPurchases() {
    if (
      !confirm(
        'Tüm eklenti satın alımları silinsin mi?\nTemalar ücretsiz haline döner. Test için kullanılır.'
      )
    ) {
      return;
    }
    setResettingAddons(true);
    try {
      await api('/api/admin/addons/reset', { method: 'POST' });
      alert('Satın alımlar geri yüklendi. Sayfa yenileniyor…');
      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Sıfırlanamadı');
    } finally {
      setResettingAddons(false);
    }
  }

  const reportsActive =
    location.pathname.startsWith('/admin/stats') ||
    location.pathname.startsWith('/admin/suggestions') ||
    location.pathname.startsWith('/admin/complaints');
  const managementActive =
    location.pathname.startsWith('/admin/users') ||
    location.pathname.startsWith('/admin/settings');
  const startupActive = location.pathname.startsWith('/admin/startup');
  const extensionsActive = location.pathname.startsWith('/admin/extensions');

  useEffect(() => {
    if (reportsActive) setReportsOpen(true);
  }, [reportsActive]);

  useEffect(() => {
    if (managementActive) setManagementOpen(true);
  }, [managementActive]);

  useEffect(() => {
    if (startupActive) setStartupOpen(true);
  }, [startupActive]);

  useEffect(() => {
    api<{ enabled: boolean }>('/api/admin/settings/maintenance')
      .then((r) => setMaintenanceOn(Boolean(r.enabled)))
      .catch(() => setMaintenanceOn(false));
  }, []);

  async function toggleMaintenance() {
    const next = !maintenanceOn;
    setMaintenanceBusy(true);
    try {
      const res = await api<{ enabled: boolean }>('/api/admin/settings/maintenance', {
        method: 'PUT',
        body: JSON.stringify({ enabled: next }),
      });
      setMaintenanceOn(Boolean(res.enabled));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Bakım modu güncellenemedi');
    } finally {
      setMaintenanceBusy(false);
    }
  }
  const sidebar = (
    <aside
      className="flex flex-col w-full h-full overflow-hidden"
      style={{ background: 'var(--admin-sidebar)' }}
    >
      <div className="px-6 pt-8 pb-6">
        <h1 className="text-xl font-bold text-white tracking-tight">Menu QR</h1>
        <p className="text-[11px] text-white/50 uppercase tracking-[0.15em] mt-1">
          Restoran Paneli
        </p>
      </div>

      <div className="px-5 mb-5">
        <button
          onClick={openPublicMenu}
          data-tour="menu-preview"
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all hover:brightness-105 active:scale-[0.98]"
          style={{
            background: 'var(--admin-sidebar-active-bg)',
            color: 'var(--admin-sidebar-active-text)',
          }}
        >
          <ExternalLink className="w-4 h-4" />
          Menüyü Gör
        </button>
      </div>

      <div className="mx-5 h-px bg-white/10 mb-2" />

      <nav className="sidebar-nav flex-1 overflow-y-auto admin-scroll pb-8">
        {mainNav.map(({ to, label, end, tourId }) => (
          <NavItem
            key={to}
            to={to}
            label={label}
            end={end}
            tourId={tourId}
            onNavigate={closeMobile}
          />
        ))}

        <NavGroup
          label="Başlangıç Ayarları"
          tourId="nav-startup"
          open={startupOpen}
          onToggle={() => setStartupOpen(!startupOpen)}
        >
          {startupNav.map(({ to, label, tourId }) => (
            <NavItem key={to} to={to} label={label} tourId={tourId} sub onNavigate={closeMobile} />
          ))}
        </NavGroup>

        <NavGroup
          label="Raporlar"
          tourId="nav-reports"
          open={reportsOpen}
          onToggle={() => setReportsOpen(!reportsOpen)}
        >
          {reportNav.map(({ to, label, tourId }) => (
            <NavItem key={to} to={to} label={label} tourId={tourId} sub onNavigate={closeMobile} />
          ))}
        </NavGroup>

        <NavGroup
          label="Yönetim"
          tourId="nav-management"
          open={managementOpen}
          onToggle={() => setManagementOpen(!managementOpen)}
        >
          {managementNav.map(({ to, label, tourId }) => (
            <NavItem key={to} to={to} label={label} tourId={tourId} sub onNavigate={closeMobile} />
          ))}
        </NavGroup>
      </nav>

      <div className="px-5 py-4 border-t border-white/10 mt-auto">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-xs text-white/45 truncate flex-1 min-w-0">
            {user?.restaurant.name}
          </p>
          <AdminTourHelpButton onClick={() => setTourOpen(true)} />
          <button
            type="button"
            className={`sidebar-maintenance-btn shrink-0${
              maintenanceOn ? ' sidebar-maintenance-btn--on' : ''
            }`}
            title={maintenanceOn ? 'Bakım modunu kapat' : 'Bakım modunu aç'}
            aria-label={maintenanceOn ? 'Bakım modunu kapat' : 'Bakım modunu aç'}
            aria-pressed={maintenanceOn}
            disabled={maintenanceBusy}
            data-tour="maintenance"
            onClick={() => void toggleMaintenance()}
          >
            <Construction className="w-[18px] h-[18px]" strokeWidth={1.75} />
          </button>
          <NavLink
            to="/admin/extensions"
            onClick={closeMobile}
            data-tour="extensions"
            title="Eklentiler"
            aria-label="Eklentiler"
            className={`sidebar-extensions-btn shrink-0 ${
              extensionsActive ? 'sidebar-extensions-btn--active' : ''
            }`}
          >
            <Puzzle className="w-[18px] h-[18px]" strokeWidth={1.75} />
          </NavLink>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="h-dvh flex overflow-hidden" style={{ background: 'var(--admin-bg)' }}>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={closeMobile}
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-50 w-[260px] transform transition-transform duration-300 lg:static lg:translate-x-0 lg:z-auto lg:shrink-0 lg:h-full ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebar}
      </div>

      <div className="flex-1 flex flex-col min-w-0 min-h-0 h-full overflow-hidden">
        <header
          className="shrink-0 z-30 px-4 sm:px-6 h-16 flex items-center gap-4"
          style={{
            background: 'var(--admin-header-bg)',
            borderBottom: '1px solid var(--admin-header-border)',
          }}
        >
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-[var(--admin-accent-soft)]"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="w-5 h-5" style={{ color: 'var(--admin-text)' }} />
          </button>

          <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
            <button
              onClick={toggleTheme}
              data-tour="header-theme"
              className="p-2 rounded-lg hover:bg-[var(--admin-accent-soft)] transition"
              title={theme === 'light' ? 'Gece modu' : 'Gündüz modu'}
            >
              {theme === 'light' ? (
                <Moon className="w-[18px] h-[18px]" style={{ color: 'var(--admin-accent)' }} />
              ) : (
                <Sun className="w-[18px] h-[18px]" style={{ color: 'var(--admin-accent)' }} />
              )}
            </button>

            <button
              type="button"
              onClick={() => navigate('/admin/masa-gorunumu')}
              data-tour="header-floor"
              className="p-2 rounded-lg hover:bg-[var(--admin-accent-soft)] transition"
              title="Masa görünümü"
            >
              <Armchair className="w-[18px] h-[18px]" style={{ color: 'var(--admin-accent)' }} />
            </button>

            <button
              onClick={toggleDemo}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                demoEnabled
                  ? 'ring-2 ring-[var(--admin-accent)] ring-offset-1 ring-offset-[var(--admin-header-bg)]'
                  : 'border border-[var(--admin-input-border)]'
              }`}
              style={
                demoEnabled
                  ? { background: 'var(--admin-accent)', color: '#ffffff' }
                  : {
                      background: 'var(--admin-input-bg)',
                      color: 'var(--admin-text-muted)',
                    }
              }
              title="Test için sahte veri göster"
            >
              Sahte Veri
            </button>

            <button
              onClick={handleResetPurchases}
              disabled={resettingAddons}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition border border-[var(--admin-input-border)] hover:border-amber-400 hover:text-amber-700 disabled:opacity-50"
              style={{
                background: 'var(--admin-input-bg)',
                color: 'var(--admin-text-muted)',
              }}
              title="Test: tüm eklenti satın alımlarını sıfırla"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${resettingAddons ? 'animate-spin' : ''}`} />
              {resettingAddons ? 'Sıfırlanıyor…' : 'Satın alımları geri yükle'}
            </button>

            <div data-tour="header-bell">
              <AdminNotificationBell />
            </div>

            <div className="hidden sm:flex items-center gap-2 pl-1">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  background: 'var(--admin-accent-soft)',
                  color: 'var(--admin-accent-text)',
                }}
              >
                {user?.fullName.charAt(0)}
              </div>
              <span
                className="text-sm font-medium max-w-[120px] truncate hidden md:block"
                style={{ color: 'var(--admin-text)' }}
              >
                {user?.fullName}
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 rounded-lg hover:bg-[var(--admin-accent-soft)] transition"
              title="Çıkış"
            >
              <LogOut className="w-[18px] h-[18px]" style={{ color: 'var(--admin-text-muted)' }} />
            </button>
          </div>
        </header>

        <main className="flex-1 min-h-0 p-5 sm:p-6 lg:p-8 overflow-y-auto admin-scroll">
          <Outlet />
        </main>
      </div>

      <AdminTour
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        onOpenGroup={handleOpenTourGroup}
        onNeedMobileNav={() => setMobileOpen(true)}
      />
    </div>
  );
}
