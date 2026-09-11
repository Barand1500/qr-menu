import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { CustomerAuthProvider } from '@/contexts/CustomerAuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import LoginPage from '@/pages/LoginPage';
import AdminLayout from '@/layouts/AdminLayout';
import DashboardPage from '@/pages/admin/DashboardPage';
import GroupsPage from '@/pages/admin/GroupsPage';
import ProductsPage from '@/pages/admin/ProductsPage';
import ShowcasePage from '@/pages/admin/ShowcasePage';
import BarcodePage from '@/pages/admin/BarcodePage';
import StatsPage from '@/pages/admin/StatsPage';
import UsersPage from '@/pages/admin/UsersPage';
import CustomersPage from '@/pages/admin/CustomersPage';
import ComplaintsPage from '@/pages/admin/ComplaintsPage';
import SuggestionsPage from '@/pages/admin/SuggestionsPage';
import SettingsPage from '@/pages/admin/SettingsPage';
import WelcomeThemePage from '@/pages/admin/WelcomeThemePage';
import MenuThemePage from '@/pages/admin/MenuThemePage';
import GamesScreenPage from '@/pages/admin/GamesScreenPage';
import ExtensionsHubPage from '@/pages/admin/ExtensionsHubPage';
import BulkTranslatePage from '@/pages/admin/BulkTranslatePage';
import TableFloorPage from '@/pages/admin/TableFloorPage';
import ProductVariantsPage from '@/pages/admin/ProductVariantsPage';
import IngredientPoolPage from '@/pages/admin/IngredientPoolPage';
import GarsonAppPage from '@/pages/GarsonAppPage';
import PublicWelcomePage from '@/pages/public/PublicWelcomePage';
import PublicMenuPage from '@/pages/public/PublicMenuPage';
import PublicProductPage from '@/pages/public/PublicProductPage';
import {
  menuGroupPath,
  menuHomePath,
  menuProductPath,
  menuWelcomePath,
} from '@/lib/menuPaths';
import {
  adminPath,
  fetchAndCacheAdminPath,
  getAdminPathSlug,
} from '@/lib/adminPath';

function LegacyMenuRedirect({ to }: { to: 'welcome' | 'home' | 'group' | 'product' }) {
  const { groupId, productId } = useParams();
  if (to === 'product' && productId) return <Navigate to={menuProductPath(productId)} replace />;
  if (to === 'group' && groupId) return <Navigate to={menuGroupPath(groupId)} replace />;
  if (to === 'home') return <Navigate to={menuHomePath()} replace />;
  return <Navigate to={menuWelcomePath()} replace />;
}

function AdminRoutes({ slug }: { slug: string }) {
  const base = `/${slug}`;
  return (
    <Route element={<ProtectedRoute />}>
      <Route path={`${base}/masa-gorunumu`} element={<TableFloorPage />} />
      <Route path={`${base}/urun-secenekleri`} element={<ProductVariantsPage />} />
      <Route path={base} element={<AdminLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="groups" element={<GroupsPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="icerik-havuzu" element={<IngredientPoolPage />} />
        <Route path="showcase" element={<ShowcasePage />} />
        <Route path="barcode" element={<BarcodePage />} />
        <Route path="bulk-translate" element={<BulkTranslatePage />} />
        <Route path="startup/welcome" element={<WelcomeThemePage />} />
        <Route path="startup/menu" element={<MenuThemePage />} />
        <Route path="startup/games" element={<GamesScreenPage />} />
        <Route path="stats" element={<StatsPage />} />
        <Route path="complaints" element={<ComplaintsPage />} />
        <Route path="suggestions" element={<SuggestionsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="extensions" element={<ExtensionsHubPage />} />
        <Route
          path="extensions/welcome"
          element={<Navigate to={adminPath('extensions') + '?tab=startup'} replace />}
        />
        <Route
          path="extensions/menu"
          element={<Navigate to={adminPath('extensions') + '?tab=startup'} replace />}
        />
        <Route
          path="extensions/qr"
          element={<Navigate to={adminPath('extensions') + '?tab=qr'} replace />}
        />
        <Route
          path="extensions/lang"
          element={<Navigate to={adminPath('extensions') + '?tab=lang'} replace />}
        />
      </Route>
    </Route>
  );
}

function AppRouter() {
  const [slug, setSlug] = useState(() => getAdminPathSlug());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void fetchAndCacheAdminPath().then((p) => {
      setSlug(p);
      setReady(true);
    });
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/garson" element={<GarsonAppPage />} />
      <Route path="/menu" element={<PublicWelcomePage />} />
      <Route path="/menu/home" element={<PublicMenuPage />} />
      <Route path="/menu/group/:groupId" element={<PublicMenuPage />} />
      <Route path="/menu/product/:productId" element={<PublicProductPage />} />

      <Route path="/m/:slug" element={<LegacyMenuRedirect to="welcome" />} />
      <Route path="/m/:slug/menu" element={<LegacyMenuRedirect to="home" />} />
      <Route path="/m/:slug/group/:groupId" element={<LegacyMenuRedirect to="group" />} />
      <Route path="/m/:slug/product/:productId" element={<LegacyMenuRedirect to="product" />} />

      {AdminRoutes({ slug })}

      {/* Eski /admin: özel yol farklıysa kapat */}
      {slug !== 'admin' ? (
        <Route path="/admin/*" element={<Navigate to="/menu" replace />} />
      ) : null}

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CustomerAuthProvider>
        <BrowserRouter>
          <AppRouter />
        </BrowserRouter>
      </CustomerAuthProvider>
    </AuthProvider>
  );
}
