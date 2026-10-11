import { FieldBuilder } from './FieldBuilder'

export function CustomFieldsSettings() {
  return (
    <div className="grid gap-5">
      <FieldBuilder target={{ scope: 'customer' }} prefix="customer" title="Kunden"
        core={[{ key: 'number', label: 'Kundennummer' }, { key: 'name', label: 'Name' }, { key: 'street', label: 'Adresse' }, { key: 'email', label: 'E-Mail' }, { key: 'vat_id', label: 'USt-ID' }]} />
      <FieldBuilder target={{ scope: 'contact' }} prefix="contact" title="Ansprechpartner"
        core={[{ key: 'salutation', label: 'Anrede' }, { key: 'full_name', label: 'Name' }, { key: 'position', label: 'Position' }, { key: 'email', label: 'E-Mail' }, { key: 'phone', label: 'Telefon' }]} />
      <FieldBuilder target={{ scope: 'catalog' }} prefix="p" title="Katalog" description="Eigene Katalogfelder werden beim Einfügen in Positionsfelder mit gleichem Schlüssel kopiert."
        core={[{ key: 'title', label: 'Bezeichnung' }, { key: 'description', label: 'Beschreibung' }, { key: 'category', label: 'Kategorie' }, { key: 'unit', label: 'Einheit' }, { key: 'price', label: 'Preis' }, { key: 'tax_rate', label: 'Steuersatz' }]} />
    </div>
  )
}
