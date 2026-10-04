import { Route, Routes } from 'react-router'
import { LoginPage } from '@/features/auth/LoginPage'
import { Placeholder } from '@/features/Placeholder'
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
          <Route index element={<Placeholder title="Übersicht" />} />
          <Route path="documents" element={<Placeholder title="Dokumente" />} />
          <Route path="documents/:id" element={<Placeholder title="Dokument" />} />
          <Route path="customers" element={<Placeholder title="Kunden" />} />
          <Route path="customers/:id" element={<Placeholder title="Kunde" />} />
          <Route path="catalog" element={<Placeholder title="Katalog" />} />
          <Route path="templates" element={<Placeholder title="Templates" />} />
          <Route path="templates/:id" element={<Placeholder title="Template" />} />
          <Route path="settings/*" element={<Placeholder title="Einstellungen" />} />
        </Route>
      </Routes>
      <ToastHost />
    </>
  )
}
