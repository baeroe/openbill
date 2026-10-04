import { seed } from '@/data/seed'
import { useCatalogStore } from './catalogStore'
import { useCustomerStore } from './customerStore'
import { useDocumentStore } from './documentStore'
import { useSettingsStore } from './settingsStore'
import { useTemplateStore } from './templateStore'

export function resetDemo(): void {
  const data = seed()
  useSettingsStore.setState(data.settings)
  useCustomerStore.setState({ customers: data.customers })
  useCatalogStore.setState({ items: data.catalog })
  useDocumentStore.setState({ documents: data.documents })
  useTemplateStore.setState({ templates: data.templates })
}
