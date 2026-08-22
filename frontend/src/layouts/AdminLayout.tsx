import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Menu,
  Bell,
  LogOut,
  ExternalLink,
  ChevronDown,
  Sun,
  Moon,
} from 'lucide-react';
import { Input } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useDemoData } from '@/contexts/DemoDataContext';

const mainNav = [
  { to: '/admin', label: 'Özet', end: true },
  { to: '/admin/groups', label: 'Gruplar' },
  { to: '/admin/products', label: 'Ürünler' },
  { to: '/admin/showcase', label: 'Vitrin Görselleri' },
  { to: '/admin/barcode', label: 'Barkod Yazdır' },
];

const reportNav = [{ to: '/admin/stats', label: 'İstatistikler' }];
const managementNav = [
  { to: '/admin/users', label: 'Kullanıcılar' },
  { to: '/admin/settings', label: 'Ayarlar' },
];

function NavItem({
  to,
  label,
  end,
  sub,
  onNavigate,
}: {
  to: string;
  label: string;
  end?: boolean;
  sub?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
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
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(true);
  const [managementOpen, setManagementOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const closeMobile = () => setMobileOpen(false);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  function openPublicMenu() {
    if (user?.restaurant.slug) {
      window.open(`/m/${user.restaurant.slug}`, '_blank');
    }
  }

  const reportsActive = location.pathname.startsWith('/admin/stats');
  const managementActive =
    location.pathname.startsWith('/admin/users') ||
    location.pathname.startsWith('/admin/settings');

  const sidebar = (
    <aside
      className="flex flex-col w-full h-full min-h-screen overflow-hidden"
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
        {mainNav.map(({ to, label, end }) => (
          <NavItem key={to} to={to} label={label} end={end} onNavigate={closeMobile} />
        ))}

        <div className="pt-2">
          <button
            onClick={() => setReportsOpen(!reportsOpen)}
            className={`sidebar-nav-link w-full text-left flex items-center justify-between ${
              reportsActive && !reportsOpen ? 'sidebar-nav-link--active' : ''
            }`}
            type="button"
          >
            <span>Raporlar</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${reportsOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {reportsOpen && (
            <div className="mt-0.5">
              {reportNav.map(({ to, label }) => (
                <NavItem key={to} to={to} label={label} sub onNavigate={closeMobile} />
              ))}
            </div>
          )}
        </div>

        <div>
          <button
            onClick={() => setManagementOpen(!managementOpen)}
            className={`sidebar-nav-link w-full text-left flex items-center justify-between ${
              managementActive && !managementOpen ? 'sidebar-nav-link--active' : ''
            }`}
            type="button"
          >
            <span>Yönetim</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${managementOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {managementOpen && (
            <div className="mt-0.5">
              {managementNav.map(({ to, label }) => (
                <NavItem key={to} to={to} label={label} sub onNavigate={closeMobile} />
              ))}
            </div>
          )}
        </div>
      </nav>

      <div className="px-6 py-5 border-t border-white/10 mt-auto">
        <p className="text-xs text-white/40 truncate">{user?.restaurant.name}</p>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--admin-bg)' }}>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={closeMobile}
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-50 w-[260px] transform transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebar}
      </div>

      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <header
          className="sticky top-0 z-30 px-4 sm:px-6 h-16 flex items-center gap-4 shrink-0"
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

          <div className="flex-1 max-w-md hidden sm:block">
            <Input
              label="Ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="[&_.float-field]:rounded-full"
            />
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
            <button
              onClick={toggleTheme}
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

            <button className="p-2 rounded-lg relative hover:bg-[var(--admin-accent-soft)] transition">
              <Bell className="w-[18px] h-[18px]" style={{ color: 'var(--admin-text-muted)' }} />
              <span
                className="absolute top-1 right-1 w-2 h-2 rounded-full"
                style={{ background: 'var(--admin-badge)' }}
              />
            </button>

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

        <main className="flex-1 p-5 sm:p-6 lg:p-8 overflow-auto admin-scroll">
          <Outlet context={{ searchQuery }} />
        </main>
      </div>
    </div>
  );
}
