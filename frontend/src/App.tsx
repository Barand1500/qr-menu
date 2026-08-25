import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
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
import ComplaintsPage from '@/pages/admin/ComplaintsPage';
import SuggestionsPage from '@/pages/admin/SuggestionsPage';
import SettingsPage from '@/pages/admin/SettingsPage';
import WelcomeThemePage from '@/pages/admin/WelcomeThemePage';
import MenuThemePage from '@/pages/admin/MenuThemePage';
import ExtensionsHubPage from '@/pages/admin/ExtensionsHubPage';
import ExtensionsCategoryPage from '@/pages/admin/ExtensionsCategoryPage';
import PublicWelcomePage from '@/pages/public/PublicWelcomePage';
import PublicMenuPage from '@/pages/public/PublicMenuPage';
import PublicProductPage from '@/pages/public/PublicProductPage';
import {
  menuGroupPath,
  menuHomePath,
  menuProductPath,
  menuWelcomePath,
} from '@/lib/menuPaths';

function LegacyMenuRedirect({ to }: { to: 'welcome' | 'home' | 'group' | 'product' }) {
  const { groupId, productId } = useParams();
  if (to === 'product' && productId) return <Navigate to={menuProductPath(productId)} replace />;
  if (to === 'group' && groupId) return <Navigate to={menuGroupPath(groupId)} replace />;
  if (to === 'home') return <Navigate to={menuHomePath()} replace />;
  return <Navigate to={menuWelcomePath()} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/menu" element={<PublicWelcomePage />} />
          <Route path="/menu/home" element={<PublicMenuPage />} />
          <Route path="/menu/group/:groupId" element={<PublicMenuPage />} />
          <Route path="/menu/product/:productId" element={<PublicProductPage />} />

          <Route path="/m/:slug" element={<LegacyMenuRedirect to="welcome" />} />
          <Route path="/m/:slug/menu" element={<LegacyMenuRedirect to="home" />} />
          <Route path="/m/:slug/group/:groupId" element={<LegacyMenuRedirect to="group" />} />
          <Route path="/m/:slug/product/:productId" element={<LegacyMenuRedirect to="product" />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="groups" element={<GroupsPage />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="showcase" element={<ShowcasePage />} />
              <Route path="barcode" element={<BarcodePage />} />
              <Route path="startup/welcome" element={<WelcomeThemePage />} />
              <Route path="startup/menu" element={<MenuThemePage />} />
              <Route path="stats" element={<StatsPage />} />
              <Route path="complaints" element={<ComplaintsPage />} />
              <Route path="suggestions" element={<SuggestionsPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="extensions" element={<ExtensionsHubPage />} />
              <Route
                path="extensions/welcome"
                element={
                  <ExtensionsCategoryPage
                    category="welcome"
                    title="Karşılama ekranları"
                    subtitle="Satın Al yakında. Şimdilik Kod Gir ile temayı aç; sonra Başlangıç Ayarları’nda kullan."
                  />
                }
              />
              <Route
                path="extensions/menu"
                element={
                  <ExtensionsCategoryPage
                    category="menu"
                    title="Menü ekranları"
                    subtitle="Satın Al yakında. Kod ile açılan temalar Menü Ekranı’nda seçilebilir."
                  />
                }
              />
              <Route
                path="extensions/qr"
                element={
                  <ExtensionsCategoryPage
                    category="qr"
                    title="QR"
                    subtitle="Renkli, logolu, masa ve kampanya QR paketi. Açılınca Barkod Yazdır sayfasında kullanılır."
                  />
                }
              />
            </Route>
          </Route>

          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
