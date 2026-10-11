import { Route, Routes } from 'react-router'
import { Toaster } from '@/components/ui'
import { useApplyTheme } from '@/hooks/useTheme'
import { AppShell } from '@/layout/AppShell'
import { LoginPage } from '@/routes/LoginPage'
import { DashboardPage } from '@/routes/dashboard/DashboardPage'
import { DocumentListPage } from '@/routes/documents/DocumentListPage'
import { DocumentEditorPage } from '@/routes/documents/DocumentEditorPage'
import { CustomerListPage } from '@/routes/customers/CustomerListPage'
import { CustomerDetailPage } from '@/routes/customers/CustomerDetailPage'
import { TemplateGalleryPage } from '@/routes/templates/TemplateGalleryPage'
import { TemplateEditorPage } from '@/routes/templates/TemplateEditorPage'
import { FieldsPage } from '@/routes/fields/FieldsPage'
import { SettingsPage } from '@/routes/settings/SettingsPage'

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
          <Route path="templates" element={<TemplateGalleryPage />} />
          <Route path="templates/:id" element={<TemplateEditorPage />} />
          <Route path="fields" element={<FieldsPage />} />
          <Route path="settings/*" element={<SettingsPage />} />
        </Route>
      </Routes>
      <Toaster />
    </>
  )
}
