import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import SettingsPage from '@/pages/admin/SettingsPage';
import PublicMenuPage from '@/pages/public/PublicMenuPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/m/:slug" element={<PublicMenuPage />} />
          <Route path="/m/:slug/group/:groupId" element={<PublicMenuPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="groups" element={<GroupsPage />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="showcase" element={<ShowcasePage />} />
              <Route path="barcode" element={<BarcodePage />} />
              <Route path="stats" element={<StatsPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>

          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
