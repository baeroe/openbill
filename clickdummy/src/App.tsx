import { Route, Routes } from 'react-router'
import { LoginPage } from '@/features/auth/LoginPage'
import { CatalogPage } from '@/features/catalog/CatalogPage'
import { CustomerDetailPage } from '@/features/customers/CustomerDetailPage'
import { CustomerListPage } from '@/features/customers/CustomerListPage'
import { TemplateEditorPage } from '@/features/templates/TemplateEditorPage'
import { TemplateGalleryPage } from '@/features/templates/TemplateGalleryPage'
import { SettingsLayout } from '@/features/settings/SettingsLayout'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { DocumentEditorPage } from '@/features/documents/DocumentEditorPage'
import { DocumentListPage } from '@/features/documents/DocumentListPage'
import { AppShell } from '@/layout/AppShell'
import { useApplyTheme } from '@/layout/useTheme'
import { ToastHost } from '@/ui/Toast'

export default function App() {
  useApplyTheme()
  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="documents" element={<DocumentListPage />} />
          <Route path="documents/:id" element={<DocumentEditorPage />} />
          <Route path="customers" element={<CustomerListPage />} />
          <Route path="customers/:id" element={<CustomerDetailPage />} />
          <Route path="catalog" element={<CatalogPage />} />
          <Route path="templates" element={<TemplateGalleryPage />} />
          <Route path="templates/:id" element={<TemplateEditorPage />} />
          <Route path="settings/*" element={<SettingsLayout />} />
        </Route>
      </Routes>
      <ToastHost />
    </>
  )
}
