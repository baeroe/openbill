# openbill Klickdummy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein durchklickbarer Prototyp von openbill (Angebote, Auftragsbestätigungen, Rechnungen, Stornos mit frei definierbaren Feldern, Liquid-Templates mit Live-Vorschau, Konformitätsprofilen und Steuerlogik), um Konzept und Funktionsumfang zu finalisieren.

**Architecture:** Reine Client-App. Die gesamte Fachlogik (Summen, Steuern, Nummernkreise, Status, Umwandeln, Prüfungen, Template-Rendering, Template-Pakete) liegt als reine, getestete TypeScript-Funktionen in `src/domain/`. Zustand-Stores in `src/store/` halten den Zustand (persistiert in `localStorage`) und rufen nur Domain-Funktionen auf. Die UI in `src/features/` und `src/ui/` ist dünn und liest/schreibt ausschließlich über die Stores.

**Tech Stack:** Vite 7, React 19, TypeScript, React Router 7, Tailwind CSS v4 (`@tailwindcss/vite`), Zustand 5 (`persist`), liquidjs 10, CodeMirror 6 (`@codemirror/lang-liquid`), fflate, @dnd-kit/sortable, lucide-react, Fontsource (self-hosted Fonts), Vitest 3 (+ jsdom), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-04-openbill-clickdummy-design.md`

## Global Constraints

- Paketmanager ausschließlich **pnpm** (kein npm, kein npx; Einmal-Tools über `pnpm dlx`). Node 24 (`clickdummy/.node-version` = `24`).
- Alles liegt unter `clickdummy/`. Alle Befehle in diesem Plan laufen in `clickdummy/`, sofern nicht anders angegeben.
- **Keine UI-Library** (kein shadcn, kein MUI, kein Radix-Komponentenset). Styling nur mit **Tailwind CSS v4**; Design-Tokens über `@theme`. Light + Dark gleichwertig.
- Lokaler State nur über **Zustand** (ein Store je Domäne, `persist`-Middleware).
- UI-Sprache **Deutsch**, Code und Bezeichner **Englisch**.
- Demo-Daten nur fiktiv („Studio Nordlicht“ etc.) — keine echten Firmen-, Kunden- oder Personennamen.
- Fonts self-hosted über Fontsource (kein Google-Fonts-CDN — self-hosted Produkt, DSGVO).
- Kein Backend, kein echtes PDF, keine echte XML-Validierung, keine echte Authentifizierung.
- Template-Sprache **Liquid** (liquidjs), Kontext-Schlüssel in `snake_case`: `org`, `customer`, `contact`, `document`, `positions`, `groups`.
- Geldbeträge als `number` in Euro, gerundet mit `round2` auf Zeilenebene; Steuer pro Steuersatz-Gruppe auf die Netto-Summe gerechnet (EN 16931).
- Datumswerte als ISO-Strings `YYYY-MM-DD`.
- Commits enden mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- UI-Aufgaben (Task 11–17) laden vor dem Schreiben den Skill `frontend-design:frontend-design`. Gestaltungsrichtung laut Spec 3.4: „Papier & Präzision“ — modern, ruhig, eigenständig, nicht verspielt, nicht bieder.

## Review Focus

1. **Kaputte Liquid-Syntax** (im Template-Editor beim Tippen oder in einem importierten Paket) → Vorschau zeigt eine lesbare Fehlermeldung mit Zeile, die App stürzt nicht ab. (Test in Task 8)
2. **Gelöschte Stammdaten, die noch referenziert werden** (Steuersatz, Einheit, Kategorie, Kunde) → Summen rechnen weiter (0 %), die Prüfanzeige meldet das Problem, nichts wirft. (Tests in Task 3 und 7)
3. **Feldschlüssel-Kollisionen** (Duplikat, Kern-Schlüssel wie `number`, Umlaute/Leerzeichen im Label) → Feld-Builder lehnt ab bzw. erzeugt einen gültigen Slug. (Test in Task 5)
4. **Bearbeiten abgeschlossener Dokumente** über irgendeinen Weg (Store-Aktion, Position, Umwandeln-Ziel) → wird verweigert; Storno einer bereits stornierten Rechnung ist nicht möglich. (Tests in Task 6 und 10)
5. **Ungültige Importe / alter Speicherstand** (ZIP ohne Manifest, kaputtes JSON, falsche Version im `localStorage`) → verständliche Fehlerliste bzw. Rückfall auf Demo-Daten statt weißer Seite. (Tests in Task 9 und 10)

---

## Dateistruktur

```
clickdummy/
  .node-version                     # 24
  index.html
  package.json
  vite.config.ts                    # react + tailwind + vitest config
  tsconfig.json / tsconfig.app.json / tsconfig.node.json
  playwright.config.ts
  e2e/happy-path.spec.ts
  src/
    main.tsx                        # Fonts, CSS, Router-Mount
    App.tsx                         # Routen
    styles/app.css                  # Tailwind-Import, @theme-Tokens, Dark-Variante
    domain/                         # reine Fachlogik, vollständig getestet
      types.ts                      # alle Domänentypen
      money.ts                      # round2
      dates.ts                      # todayIso, addDays, isoToDate
      format.ts                     # formatMoney, formatDate, formatNumber
      totals.ts (+ .test.ts)        # effectiveTax, calcTotals, LEGAL_NOTES
      numbering.ts (+ .test.ts)     # formatNumber-Pattern, allocateNumber
      lifecycle.ts (+ .test.ts)     # Status-Übergänge, isLocked, isOverdue, Labels
      fields.ts (+ .test.ts)        # slugifyKey, validateFieldDef, RESERVED_KEYS
      convert.ts (+ .test.ts)       # canConvert, convertDocument
      compliance.ts (+ .test.ts)    # PROFILE_REQUIREMENTS, checkCompliance
      templateContext.ts (+ .test.ts) # buildTemplateContext
      liquid.ts (+ .test.ts)        # createLiquid, renderDocument
      templatePackage.ts (+ .test.ts) # importTemplatePackage, exportTemplatePackage
      einvoice.ts (+ .test.ts)      # generateCiiXml (Mock)
    templates/                      # mitgelieferte Templates
      klar/{template.liquid,styles.css,manifest.json}
      kante/{template.liquid,styles.css,manifest.json}
      leise/{template.liquid,styles.css,manifest.json}
      index.ts                      # builtInTemplates: Template[]
    data/seed.ts                    # Demo-Daten (fiktiv)
    store/
      ids.ts                        # newId()
      settingsStore.ts              # Organisation, Dokumenttypen, Steuern, Einheiten, Kategorien, Bausteine, Benutzer, Felddefinitionen
      customerStore.ts
      catalogStore.ts
      documentStore.ts (+ .test.ts)
      templateStore.ts
      sessionStore.ts               # Login, Theme
      reset.ts                      # resetDemo()
      selectors.ts                  # useDocumentView(id) etc.
    ui/                             # eigenes Komponentenset (Tailwind)
      Button.tsx Input.tsx Textarea.tsx Select.tsx Checkbox.tsx Badge.tsx Card.tsx
      Dialog.tsx Tabs.tsx Table.tsx EmptyState.tsx PageHeader.tsx StatusBadge.tsx
      CustomFieldInput.tsx FieldBuilder.tsx CodeEditor.tsx SheetPreview.tsx Toast.tsx
    layout/AppShell.tsx Sidebar.tsx RequireAuth.tsx ThemeToggle.tsx
    features/
      auth/LoginPage.tsx
      dashboard/DashboardPage.tsx
      documents/DocumentListPage.tsx NewDocumentDialog.tsx DocumentEditorPage.tsx
               DocumentHeaderFields.tsx PositionsTable.tsx PositionRow.tsx CatalogAutocomplete.tsx
               TextsSection.tsx TotalsPanel.tsx CompliancePanel.tsx DocumentActions.tsx
               DocumentChain.tsx EInvoiceTab.tsx DocumentPreviewPane.tsx
      customers/CustomerListPage.tsx CustomerDetailPage.tsx ContactsEditor.tsx
      catalog/CatalogPage.tsx CatalogItemDialog.tsx
      templates/TemplateGalleryPage.tsx TemplateEditorPage.tsx FieldReference.tsx ManifestForm.tsx
      settings/SettingsLayout.tsx OrganizationSettings.tsx DocumentTypeSettings.tsx
               CustomFieldsSettings.tsx TaxSettings.tsx UnitSettings.tsx CategorySettings.tsx
               TextBlockSettings.tsx UserSettings.tsx
```

---

### Task 1: Projekt-Scaffold

**Files:**
- Create: `clickdummy/` (Vite react-ts), `clickdummy/.node-version`, `clickdummy/vite.config.ts`, `clickdummy/src/styles/app.css`, `clickdummy/src/main.tsx`, `clickdummy/src/App.tsx`, `clickdummy/src/smoke.test.ts`
- Modify: `.gitignore` (Repo-Root)

**Interfaces:**
- Produces: `pnpm test` (Vitest), `pnpm build`, `pnpm dev`, Tailwind aktiv, Path-Alias `@/` → `src/`.

- [ ] **Step 1: Vite-Projekt anlegen**

Im Repo-Root:
```bash
pnpm create vite@latest clickdummy --template react-ts
```
Falls gefragt wird, ob sofort installiert/gestartet werden soll: Nein. Danach:
```bash
cd clickdummy
echo "24" > .node-version
pnpm install
pnpm add react-router zustand liquidjs fflate lucide-react @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities codemirror @codemirror/state @codemirror/view @codemirror/lang-liquid @fontsource-variable/geist @fontsource-variable/geist-mono @fontsource/instrument-serif
pnpm add -D tailwindcss @tailwindcss/vite vitest jsdom @playwright/test @types/node
```
Vite-Beispieldateien löschen: `src/App.css`, `src/index.css`, `src/assets/`, `public/vite.svg`.

- [ ] **Step 2: `vite.config.ts`**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
```
In `tsconfig.app.json` unter `compilerOptions` ergänzen: `"baseUrl": ".", "paths": { "@/*": ["src/*"] }`.

In `package.json` Scripts ergänzen: `"test": "vitest run"`, `"test:watch": "vitest"`, `"e2e": "playwright test"`, `"typecheck": "tsc -b"`.

- [ ] **Step 3: Basis-CSS, `main.tsx`, `App.tsx`**

`src/styles/app.css` (Start-Tokens; Task 11 verfeinert sie mit dem Frontend-Design-Skill):
```css
@import "tailwindcss";

@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));

:root {
  --paper: #f5f2ec;
  --sheet: #ffffff;
  --ink: #1b1a17;
  --muted: #6d685f;
  --line: #e3ddd2;
  --accent: #d6452a;
  --accent-ink: #ffffff;
  --ok: #2f7d4f;
  --warn: #b7791f;
  --danger: #b42318;
}
[data-theme="dark"] {
  --paper: #141413;
  --sheet: #1d1c1a;
  --ink: #efebe4;
  --muted: #9b958a;
  --line: #2e2c28;
  --accent: #f0643f;
  --accent-ink: #141413;
  --ok: #5fbf86;
  --warn: #e0a84a;
  --danger: #f0705f;
}

@theme inline {
  --color-paper: var(--paper);
  --color-sheet: var(--sheet);
  --color-ink: var(--ink);
  --color-muted: var(--muted);
  --color-line: var(--line);
  --color-accent: var(--accent);
  --color-accent-ink: var(--accent-ink);
  --color-ok: var(--ok);
  --color-warn: var(--warn);
  --color-danger: var(--danger);
  --font-display: "Instrument Serif", ui-serif, Georgia, serif;
  --font-sans: "Geist Variable", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "Geist Mono Variable", ui-monospace, monospace;
}

body { @apply bg-paper text-ink font-sans antialiased; font-feature-settings: "tnum" 1; }
```

`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '@fontsource/instrument-serif';
import './styles/app.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
```

`src/App.tsx`:
```tsx
export default function App() {
  return <main className="p-10 font-display text-5xl">openbill</main>;
}
```

In `index.html`: `<html lang="de">`, `<title>openbill</title>`.

- [ ] **Step 4: Smoke-Test schreiben**

`src/smoke.test.ts`:
```ts
import { describe, expect, it } from 'vitest';

describe('toolchain', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Verifizieren**

Run: `pnpm test && pnpm build`
Expected: 1 Test PASS, Build ohne Fehler.

- [ ] **Step 6: `.gitignore` im Repo-Root & Commit**

`.gitignore` (Repo-Root):
```
node_modules/
dist/
.DS_Store
clickdummy/test-results/
clickdummy/playwright-report/
```
```bash
git add -A
git commit -m "chore: scaffold clickdummy with Vite, React, Tailwind and Vitest

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Domänentypen und Basis-Helfer

**Files:**
- Create: `src/domain/types.ts`, `src/domain/money.ts`, `src/domain/dates.ts`, `src/domain/format.ts`, `src/domain/basics.test.ts`
- Delete: `src/smoke.test.ts`

**Interfaces:**
- Produces: alle Typen aus `types.ts` (unten), `round2(n: number): number`, `todayIso(): string`, `addDays(iso: string, days: number): string`, `isoToDate(iso: string): Date`, `formatMoney(n: number): string`, `formatDate(iso: string | null | undefined): string`, `formatDecimal(n: number, decimals?: number): string`.

- [ ] **Step 1: `types.ts` schreiben**

```ts
export type DocType = 'offer' | 'confirmation' | 'invoice' | 'cancellation';
export type DocStatus = 'draft' | 'open' | 'accepted' | 'rejected' | 'done' | 'paid' | 'cancelled' | 'closed';

export type FieldType = 'text' | 'textarea' | 'number' | 'money' | 'date' | 'select' | 'boolean' | 'image';
export type FieldValue = string | number | boolean | null;
export type CustomValues = Record<string, FieldValue>;

export interface FieldDef {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  defaultValue: FieldValue;
  help: string;
  options: string[]; // nur für 'select'
}

export type FieldScope = 'org' | 'customer' | 'contact' | 'catalog' | 'document' | 'position';
export type ProfileId = 'basic' | 'en16931';

export type TaxCategory = 'S' | 'Z' | 'E' | 'AE' | 'K' | 'G';
export interface TaxRate { id: string; label: string; percent: number; category: TaxCategory; exemptionNote: string | null }
export interface Unit { id: string; name: string; symbol: string; decimals: number; code: string }
export interface Category { id: string; name: string }
export type TextBlockKind = 'intro' | 'closing' | 'payment' | 'note';
export interface TextBlock { id: string; name: string; kind: TextBlockKind; body: string }
export interface User { id: string; name: string; email: string; role: 'owner' | 'member' }

export type TaxationMode = 'regular' | 'small_business';
export type CustomerTaxTreatment = 'domestic' | 'eu_reverse_charge' | 'third_country';

export interface Address { street: string; zip: string; city: string; country: string } // country = ISO 3166-1 alpha-2

export interface Organization {
  name: string;
  address: Address;
  logo: string | null; // data URL
  vatId: string;
  taxNumber: string;
  iban: string;
  bic: string;
  bankName: string;
  email: string;
  phone: string;
  website: string;
  taxationMode: TaxationMode;
  custom: CustomValues;
}

export interface Contact {
  id: string;
  salutation: string;
  firstName: string;
  lastName: string;
  position: string;
  email: string;
  phone: string;
  isDefault: boolean;
  custom: CustomValues;
}

export interface Customer {
  id: string;
  number: string;
  name: string;
  address: Address;
  email: string;
  vatId: string;
  taxTreatment: CustomerTaxTreatment;
  contacts: Contact[];
  custom: CustomValues;
}

export interface CatalogItem {
  id: string;
  title: string;
  description: string;
  categoryId: string | null;
  unitId: string;
  price: number;
  taxRateId: string;
  custom: CustomValues;
}

export type PositionKind = 'item' | 'heading' | 'text' | 'optional';
export interface Position {
  id: string;
  kind: PositionKind;
  title: string;
  description: string;
  quantity: number;
  unitId: string | null;
  unitPrice: number;
  taxRateId: string | null;
  categoryId: string | null;
  custom: CustomValues;
}

export interface NumberState { pattern: string; nextSeq: number; resetYearly: boolean; lastYear: number | null }

export interface DocTypeConfig {
  type: DocType;
  label: string;
  profile: ProfileId;
  numbering: NumberState;
  templateId: string;
  defaultIntroBlockId: string | null;
  defaultClosingBlockId: string | null;
  paymentTermDays: number | null; // invoice
  validityDays: number | null; // offer
  documentFields: FieldDef[];
  positionFields: FieldDef[];
}

export interface Document {
  id: string;
  type: DocType;
  status: DocStatus;
  number: string | null;
  date: string;
  customerId: string | null;
  contactId: string | null;
  serviceDate: string | null;
  serviceDateEnd: string | null;
  dueDate: string | null;
  validUntil: string | null;
  intro: string;
  closing: string;
  templateId: string;
  positions: Position[];
  custom: CustomValues;
  sourceId: string | null;
  cancelledById: string | null;
  finalizedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ExpectedFieldScope = 'org' | 'customer' | 'contact' | 'document' | 'position';
export interface TemplateManifest {
  name: string;
  version: string;
  author: string;
  license: string;
  description: string;
  documentTypes: DocType[];
  expectedFields: { scope: ExpectedFieldScope; key: string; type: FieldType; fallback: string }[];
  paper: { format: 'A4' | 'Letter'; margin: string };
}

export interface Template {
  id: string;
  builtIn: boolean;
  manifest: TemplateManifest;
  liquid: string;
  css: string;
}
```

- [ ] **Step 2: Failing Tests für Helfer**

`src/domain/basics.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { round2 } from './money';
import { addDays } from './dates';
import { formatDate, formatDecimal, formatMoney } from './format';

const norm = (s: string) => s.replace(/\s/g, ' ');

describe('round2', () => {
  it('rounds to cents', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(-2.345)).toBe(-2.34);
  });
});

describe('addDays', () => {
  it('adds days across month boundaries', () => {
    expect(addDays('2026-01-25', 14)).toBe('2026-02-08');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('format', () => {
  it('formats money in de-DE', () => {
    expect(norm(formatMoney(1234.5))).toBe('1.234,50 €');
    expect(norm(formatMoney(-95))).toBe('-95,00 €');
  });
  it('formats dates and empty values', () => {
    expect(formatDate('2026-10-04')).toBe('04.10.2026');
    expect(formatDate(null)).toBe('');
  });
  it('formats decimals', () => {
    expect(formatDecimal(2.5, 2)).toBe('2,50');
    expect(formatDecimal(3)).toBe('3');
  });
});
```
Run: `pnpm test` → Expected: FAIL (Module fehlen). `src/smoke.test.ts` löschen.

- [ ] **Step 3: Implementierung**

`src/domain/money.ts`:
```ts
export const round2 = (n: number): number => Math.round((n + Math.sign(n) * Number.EPSILON) * 100) / 100;
```
Hinweis: `Math.round(-234.5)` ergibt `-234` → `round2(-2.345) === -2.34`; das ist für den Dummy ausreichend und durch den Test festgehalten.

`src/domain/dates.ts`:
```ts
const pad = (n: number) => String(n).padStart(2, '0');
export const dateToIso = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const isoToDate = (iso: string): Date => new Date(`${iso}T00:00:00`);
export const todayIso = (): string => dateToIso(new Date());
export const addDays = (iso: string, days: number): string => {
  const d = isoToDate(iso);
  d.setDate(d.getDate() + days);
  return dateToIso(d);
};
```

`src/domain/format.ts`:
```ts
import { isoToDate } from './dates';

const money = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const date = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

export const formatMoney = (n: number): string => money.format(n);
export const formatDate = (iso: string | null | undefined): string => (iso ? date.format(isoToDate(iso)) : '');
export const formatDecimal = (n: number, decimals = 0): string =>
  new Intl.NumberFormat('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: Math.max(decimals, 3) }).format(n);
```

- [ ] **Step 4: Tests grün**

Run: `pnpm test` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(domain): add domain types and money/date/format helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Steuern und Summen

**Files:**
- Create: `src/domain/totals.ts`, `src/domain/totals.test.ts`

**Interfaces:**
- Consumes: `round2`, Typen `Position`, `TaxRate`, `TaxCategory`, `TaxationMode`, `CustomerTaxTreatment`.
- Produces:
  - `LEGAL_NOTES: { smallBusiness: string; reverseCharge: string; thirdCountry: string }`
  - `interface TaxContext { taxRates: TaxRate[]; taxationMode: TaxationMode; taxTreatment: CustomerTaxTreatment }`
  - `interface EffectiveTax { percent: number; category: TaxCategory; note: string | null }`
  - `effectiveTax(taxRateId: string | null, ctx: TaxContext): EffectiveTax | null` (`null` = Steuersatz unbekannt)
  - `interface LineTotal { positionId: string; net: number; tax: EffectiveTax | null }`
  - `interface GroupTotal { positionId: string; title: string; net: number }`
  - `interface TaxBreakdownRow { category: TaxCategory; percent: number; net: number; tax: number; gross: number }`
  - `interface Totals { lines: Record<string, LineTotal>; groups: GroupTotal[]; taxBreakdown: TaxBreakdownRow[]; net: number; tax: number; gross: number; optionalNet: number; legalNotes: string[]; missingTaxRate: string[] }`
  - `calcTotals(positions: Position[], ctx: TaxContext): Totals`

- [ ] **Step 1: Failing Tests**

`src/domain/totals.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { calcTotals, effectiveTax, LEGAL_NOTES, type TaxContext } from './totals';
import type { Position, TaxRate } from './types';

const rates: TaxRate[] = [
  { id: 'r19', label: '19 %', percent: 19, category: 'S', exemptionNote: null },
  { id: 'r7', label: '7 %', percent: 7, category: 'S', exemptionNote: null },
];
const regular: TaxContext = { taxRates: rates, taxationMode: 'regular', taxTreatment: 'domestic' };

const pos = (over: Partial<Position>): Position => ({
  id: over.id ?? 'p', kind: 'item', title: 'X', description: '', quantity: 1, unitId: 'u',
  unitPrice: 0, taxRateId: 'r19', categoryId: null, custom: {}, ...over,
});

describe('effectiveTax', () => {
  it('uses the rate for regular domestic customers', () => {
    expect(effectiveTax('r7', regular)).toEqual({ percent: 7, category: 'S', note: null });
  });
  it('forces E with § 19 note for small businesses', () => {
    expect(effectiveTax('r19', { ...regular, taxationMode: 'small_business' }))
      .toEqual({ percent: 0, category: 'E', note: LEGAL_NOTES.smallBusiness });
  });
  it('forces AE for EU reverse charge and G for third countries', () => {
    expect(effectiveTax('r19', { ...regular, taxTreatment: 'eu_reverse_charge' })?.category).toBe('AE');
    expect(effectiveTax('r19', { ...regular, taxTreatment: 'third_country' })?.category).toBe('G');
  });
  it('returns null for an unknown (deleted) rate', () => {
    expect(effectiveTax('gone', regular)).toBeNull();
  });
});

describe('calcTotals', () => {
  it('sums lines and computes tax per rate group', () => {
    const t = calcTotals([
      pos({ id: 'a', quantity: 10, unitPrice: 95 }),
      pos({ id: 'b', quantity: 1, unitPrice: 49.9, taxRateId: 'r7' }),
    ], regular);
    expect(t.lines.a.net).toBe(950);
    expect(t.taxBreakdown).toEqual([
      { category: 'S', percent: 19, net: 950, tax: 180.5, gross: 1130.5 },
      { category: 'S', percent: 7, net: 49.9, tax: 3.49, gross: 53.39 },
    ]);
    expect(t.net).toBe(999.9);
    expect(t.tax).toBe(183.99);
    expect(t.gross).toBe(1183.89);
  });

  it('builds groups from headings and ignores text lines', () => {
    const t = calcTotals([
      pos({ id: 'h1', kind: 'heading', title: 'Konzeption' }),
      pos({ id: 'a', quantity: 2, unitPrice: 100 }),
      pos({ id: 't', kind: 'text', title: 'Hinweis' }),
      pos({ id: 'h2', kind: 'heading', title: 'Umsetzung' }),
      pos({ id: 'b', quantity: 1, unitPrice: 50 }),
    ], regular);
    expect(t.groups).toEqual([
      { positionId: 'h1', title: 'Konzeption', net: 200 },
      { positionId: 'h2', title: 'Umsetzung', net: 50 },
    ]);
    expect(t.lines.t).toBeUndefined();
  });

  it('excludes optional positions from the total', () => {
    const t = calcTotals([pos({ id: 'a', unitPrice: 100 }), pos({ id: 'o', kind: 'optional', unitPrice: 300 })], regular);
    expect(t.net).toBe(100);
    expect(t.optionalNet).toBe(300);
  });

  it('collects legal notes once', () => {
    const t = calcTotals([pos({ id: 'a', unitPrice: 10 }), pos({ id: 'b', unitPrice: 20 })], { ...regular, taxationMode: 'small_business' });
    expect(t.tax).toBe(0);
    expect(t.legalNotes).toEqual([LEGAL_NOTES.smallBusiness]);
  });

  it('handles negative quantities (cancellations)', () => {
    const t = calcTotals([pos({ id: 'a', quantity: -10, unitPrice: 95 })], regular);
    expect(t.gross).toBe(-1130.5);
  });

  it('treats a deleted tax rate as 0 % and reports it', () => {
    const t = calcTotals([pos({ id: 'a', unitPrice: 100, taxRateId: 'gone' })], regular);
    expect(t.tax).toBe(0);
    expect(t.missingTaxRate).toEqual(['a']);
  });
});
```
Run: `pnpm test src/domain/totals.test.ts` → Expected: FAIL (Modul fehlt).

- [ ] **Step 2: Implementierung**

`src/domain/totals.ts`:
```ts
import { round2 } from './money';
import type { CustomerTaxTreatment, Position, TaxCategory, TaxationMode, TaxRate } from './types';

export const LEGAL_NOTES = {
  smallBusiness: 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.',
  reverseCharge: 'Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge).',
  thirdCountry: 'Nicht im Inland steuerbare Leistung.',
} as const;

export interface TaxContext { taxRates: TaxRate[]; taxationMode: TaxationMode; taxTreatment: CustomerTaxTreatment }
export interface EffectiveTax { percent: number; category: TaxCategory; note: string | null }
export interface LineTotal { positionId: string; net: number; tax: EffectiveTax | null }
export interface GroupTotal { positionId: string; title: string; net: number }
export interface TaxBreakdownRow { category: TaxCategory; percent: number; net: number; tax: number; gross: number }
export interface Totals {
  lines: Record<string, LineTotal>;
  groups: GroupTotal[];
  taxBreakdown: TaxBreakdownRow[];
  net: number;
  tax: number;
  gross: number;
  optionalNet: number;
  legalNotes: string[];
  missingTaxRate: string[];
}

export function effectiveTax(taxRateId: string | null, ctx: TaxContext): EffectiveTax | null {
  if (ctx.taxationMode === 'small_business') return { percent: 0, category: 'E', note: LEGAL_NOTES.smallBusiness };
  if (ctx.taxTreatment === 'eu_reverse_charge') return { percent: 0, category: 'AE', note: LEGAL_NOTES.reverseCharge };
  if (ctx.taxTreatment === 'third_country') return { percent: 0, category: 'G', note: LEGAL_NOTES.thirdCountry };
  const rate = ctx.taxRates.find((r) => r.id === taxRateId);
  if (!rate) return null;
  return { percent: rate.percent, category: rate.category, note: rate.exemptionNote };
}

export function calcTotals(positions: Position[], ctx: TaxContext): Totals {
  const lines: Record<string, LineTotal> = {};
  const groups: GroupTotal[] = [];
  const buckets = new Map<string, TaxBreakdownRow>();
  const notes = new Set<string>();
  const missingTaxRate: string[] = [];
  let optionalNet = 0;
  let current: GroupTotal | null = null;

  for (const p of positions) {
    if (p.kind === 'heading') {
      current = { positionId: p.id, title: p.title, net: 0 };
      groups.push(current);
      continue;
    }
    if (p.kind === 'text') continue;

    const net = round2(p.quantity * p.unitPrice);
    const tax = effectiveTax(p.taxRateId, ctx);
    lines[p.id] = { positionId: p.id, net, tax };
    if (p.kind === 'optional') {
      optionalNet = round2(optionalNet + net);
      continue;
    }
    if (!tax) missingTaxRate.push(p.id);
    if (current) current.net = round2(current.net + net);

    const t: EffectiveTax = tax ?? { percent: 0, category: 'S', note: null };
    const key = `${t.category}:${t.percent}`;
    const row = buckets.get(key) ?? { category: t.category, percent: t.percent, net: 0, tax: 0, gross: 0 };
    row.net = round2(row.net + net);
    buckets.set(key, row);
    if (t.note) notes.add(t.note);
  }

  const taxBreakdown = [...buckets.values()]
    .map((r) => {
      const tax = round2((r.net * r.percent) / 100);
      return { ...r, tax, gross: round2(r.net + tax) };
    })
    .sort((a, b) => b.percent - a.percent);
  const net = round2(taxBreakdown.reduce((s, r) => s + r.net, 0));
  const tax = round2(taxBreakdown.reduce((s, r) => s + r.tax, 0));

  return { lines, groups, taxBreakdown, net, tax, gross: round2(net + tax), optionalNet, legalNotes: [...notes], missingTaxRate };
}
```

- [ ] **Step 3: Tests grün**

Run: `pnpm test src/domain/totals.test.ts` → Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(domain): add tax rules and document totals

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Nummernkreise und Status-Lebenszyklus

**Files:**
- Create: `src/domain/numbering.ts`, `src/domain/numbering.test.ts`, `src/domain/lifecycle.ts`, `src/domain/lifecycle.test.ts`

**Interfaces:**
- Consumes: `NumberState`, `DocType`, `DocStatus`, `Document`.
- Produces:
  - `formatDocumentNumber(pattern: string, date: Date, seq: number): string`
  - `allocateNumber(state: NumberState, date: Date): { number: string; next: NumberState }`
  - `DOC_TYPE_LABELS: Record<DocType, string>`, `STATUS_LABELS: Record<DocStatus, string>`
  - `canTransition(type: DocType, from: DocStatus, to: DocStatus): boolean`
  - `nextStatuses(type: DocType, from: DocStatus): DocStatus[]`
  - `isLocked(doc: Pick<Document, 'status'>): boolean`
  - `isOverdue(doc: Pick<Document, 'type' | 'status' | 'dueDate'>, today: string): boolean`

- [ ] **Step 1: Failing Tests**

`src/domain/numbering.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { allocateNumber, formatDocumentNumber } from './numbering';

const d = new Date('2026-03-15T00:00:00');

describe('formatDocumentNumber', () => {
  it('replaces all placeholders', () => {
    expect(formatDocumentNumber('RE-{YYYY}-{0000}', d, 7)).toBe('RE-2026-0007');
    expect(formatDocumentNumber('{YY}{MM}-{000}', d, 12)).toBe('2603-012');
  });
  it('does not truncate sequences longer than the padding', () => {
    expect(formatDocumentNumber('AN{00}', d, 123)).toBe('AN123');
  });
  it('keeps patterns without sequence placeholder unchanged', () => {
    expect(formatDocumentNumber('FIX', d, 3)).toBe('FIX');
  });
});

describe('allocateNumber', () => {
  it('increments the sequence', () => {
    const r = allocateNumber({ pattern: 'RE-{0000}', nextSeq: 5, resetYearly: false, lastYear: 2025 }, d);
    expect(r.number).toBe('RE-0005');
    expect(r.next).toEqual({ pattern: 'RE-{0000}', nextSeq: 6, resetYearly: false, lastYear: 2026 });
  });
  it('resets to 1 in a new year when resetYearly is on', () => {
    const r = allocateNumber({ pattern: 'RE-{YYYY}-{000}', nextSeq: 42, resetYearly: true, lastYear: 2025 }, d);
    expect(r.number).toBe('RE-2026-001');
    expect(r.next.nextSeq).toBe(2);
  });
  it('does not reset within the same year', () => {
    const r = allocateNumber({ pattern: '{000}', nextSeq: 42, resetYearly: true, lastYear: 2026 }, d);
    expect(r.number).toBe('042');
  });
});
```

`src/domain/lifecycle.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { canTransition, isLocked, isOverdue, nextStatuses } from './lifecycle';

describe('transitions', () => {
  it('allows the documented flows', () => {
    expect(canTransition('offer', 'draft', 'open')).toBe(true);
    expect(canTransition('offer', 'open', 'accepted')).toBe(true);
    expect(canTransition('offer', 'open', 'rejected')).toBe(true);
    expect(canTransition('confirmation', 'open', 'done')).toBe(true);
    expect(canTransition('invoice', 'open', 'paid')).toBe(true);
    expect(canTransition('cancellation', 'draft', 'closed')).toBe(true);
  });
  it('rejects everything else', () => {
    expect(canTransition('offer', 'draft', 'accepted')).toBe(false);
    expect(canTransition('invoice', 'paid', 'open')).toBe(false);
    expect(canTransition('invoice', 'open', 'cancelled')).toBe(false); // only via cancellation
    expect(nextStatuses('invoice', 'cancelled')).toEqual([]);
  });
});

describe('isLocked / isOverdue', () => {
  it('locks everything but drafts', () => {
    expect(isLocked({ status: 'draft' })).toBe(false);
    expect(isLocked({ status: 'open' })).toBe(true);
  });
  it('marks open invoices past due date as overdue', () => {
    expect(isOverdue({ type: 'invoice', status: 'open', dueDate: '2026-10-01' }, '2026-10-04')).toBe(true);
    expect(isOverdue({ type: 'invoice', status: 'open', dueDate: '2026-10-04' }, '2026-10-04')).toBe(false);
    expect(isOverdue({ type: 'invoice', status: 'paid', dueDate: '2026-10-01' }, '2026-10-04')).toBe(false);
    expect(isOverdue({ type: 'offer', status: 'open', dueDate: '2026-10-01' }, '2026-10-04')).toBe(false);
  });
});
```
Run: `pnpm test` → Expected: FAIL (Module fehlen).

- [ ] **Step 2: Implementierung**

`src/domain/numbering.ts`:
```ts
import type { NumberState } from './types';

export function formatDocumentNumber(pattern: string, date: Date, seq: number): string {
  const yyyy = String(date.getFullYear());
  return pattern
    .replace(/\{YYYY\}/g, yyyy)
    .replace(/\{YY\}/g, yyyy.slice(-2))
    .replace(/\{MM\}/g, String(date.getMonth() + 1).padStart(2, '0'))
    .replace(/\{(0+)\}/g, (_m, zeros: string) => String(seq).padStart(zeros.length, '0'));
}

export function allocateNumber(state: NumberState, date: Date): { number: string; next: NumberState } {
  const year = date.getFullYear();
  const seq = state.resetYearly && state.lastYear !== null && state.lastYear !== year ? 1 : state.nextSeq;
  return {
    number: formatDocumentNumber(state.pattern, date, seq),
    next: { ...state, nextSeq: seq + 1, lastYear: year },
  };
}
```

`src/domain/lifecycle.ts`:
```ts
import type { DocStatus, DocType, Document } from './types';

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  offer: 'Angebot',
  confirmation: 'Auftragsbestätigung',
  invoice: 'Rechnung',
  cancellation: 'Storno',
};

export const STATUS_LABELS: Record<DocStatus, string> = {
  draft: 'Entwurf',
  open: 'Offen',
  accepted: 'Angenommen',
  rejected: 'Abgelehnt',
  done: 'Erledigt',
  paid: 'Bezahlt',
  cancelled: 'Storniert',
  closed: 'Abgeschlossen',
};

const TRANSITIONS: Record<DocType, Partial<Record<DocStatus, DocStatus[]>>> = {
  offer: { draft: ['open'], open: ['accepted', 'rejected'] },
  confirmation: { draft: ['open'], open: ['done'] },
  invoice: { draft: ['open'], open: ['paid'] },
  cancellation: { draft: ['closed'] },
};

export const nextStatuses = (type: DocType, from: DocStatus): DocStatus[] => TRANSITIONS[type][from] ?? [];
export const canTransition = (type: DocType, from: DocStatus, to: DocStatus): boolean => nextStatuses(type, from).includes(to);
export const isLocked = (doc: Pick<Document, 'status'>): boolean => doc.status !== 'draft';
export const isOverdue = (doc: Pick<Document, 'type' | 'status' | 'dueDate'>, today: string): boolean =>
  doc.type === 'invoice' && doc.status === 'open' && !!doc.dueDate && doc.dueDate < today;
```

- [ ] **Step 3: Tests grün**

Run: `pnpm test` → Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(domain): add number sequences and status lifecycle

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Felddefinitionen

**Files:**
- Create: `src/domain/fields.ts`, `src/domain/fields.test.ts`

**Interfaces:**
- Consumes: `FieldDef`, `FieldScope`, `FieldType`, `FieldValue`, `CustomValues`.
- Produces:
  - `FIELD_TYPE_LABELS: Record<FieldType, string>`
  - `RESERVED_KEYS: Record<FieldScope, string[]>`
  - `slugifyKey(label: string): string`
  - `validateFieldDef(def: Pick<FieldDef, 'id' | 'key' | 'label' | 'type' | 'options'>, existing: FieldDef[], scope: FieldScope): string[]` (leere Liste = gültig; `existing` darf die Definition selbst enthalten, Abgleich über `id`)
  - `isEmptyValue(v: FieldValue | undefined): boolean`
  - `defaultCustomValues(defs: FieldDef[]): CustomValues`

- [ ] **Step 1: Failing Tests**

`src/domain/fields.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { defaultCustomValues, isEmptyValue, slugifyKey, validateFieldDef } from './fields';
import type { FieldDef } from './types';

const def = (over: Partial<FieldDef>): FieldDef => ({
  id: 'f1', key: 'project_name', label: 'Projektname', type: 'text', required: false, defaultValue: null, help: '', options: [], ...over,
});

describe('slugifyKey', () => {
  it('creates snake_case keys and transliterates umlauts', () => {
    expect(slugifyKey('Projektname')).toBe('projektname');
    expect(slugifyKey('Ansprechpartner Intern')).toBe('ansprechpartner_intern');
    expect(slugifyKey('Größe / Maß')).toBe('groesse_mass');
    expect(slugifyKey('  2. Lieferdatum! ')).toBe('f_2_lieferdatum');
  });
});

describe('validateFieldDef', () => {
  it('accepts a valid definition', () => {
    expect(validateFieldDef(def({}), [], 'document')).toEqual([]);
  });
  it('rejects invalid keys', () => {
    expect(validateFieldDef(def({ key: 'Project Name' }), [], 'document')).toContain(
      'Schlüssel darf nur Kleinbuchstaben, Ziffern und _ enthalten und muss mit einem Buchstaben beginnen.',
    );
  });
  it('rejects reserved core keys', () => {
    expect(validateFieldDef(def({ key: 'number' }), [], 'document')).toContain('„number“ ist ein Kernfeld und reserviert.');
    expect(validateFieldDef(def({ key: 'quantity' }), [], 'position')).toContain('„quantity“ ist ein Kernfeld und reserviert.');
  });
  it('rejects duplicates but not the definition itself', () => {
    const existing = [def({ id: 'other' })];
    expect(validateFieldDef(def({}), existing, 'document')).toContain('Schlüssel „project_name“ ist bereits vergeben.');
    expect(validateFieldDef(def({}), [def({})], 'document')).toEqual([]);
  });
  it('requires a label and options for select fields', () => {
    expect(validateFieldDef(def({ label: ' ' }), [], 'document')).toContain('Bezeichnung fehlt.');
    expect(validateFieldDef(def({ type: 'select', options: [] }), [], 'document')).toContain('Auswahlfelder brauchen mindestens eine Option.');
  });
});

describe('values', () => {
  it('detects empty values', () => {
    expect(isEmptyValue(null)).toBe(true);
    expect(isEmptyValue(undefined)).toBe(true);
    expect(isEmptyValue('  ')).toBe(true);
    expect(isEmptyValue(0)).toBe(false);
    expect(isEmptyValue(false)).toBe(false);
  });
  it('builds default values from definitions', () => {
    expect(defaultCustomValues([def({}), def({ id: 'f2', key: 'billable', type: 'boolean', defaultValue: true })]))
      .toEqual({ project_name: null, billable: true });
  });
});
```
Run: `pnpm test src/domain/fields.test.ts` → Expected: FAIL.

- [ ] **Step 2: Implementierung**

`src/domain/fields.ts`:
```ts
import type { CustomValues, FieldDef, FieldScope, FieldType, FieldValue } from './types';

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'Text',
  textarea: 'Mehrzeiliger Text',
  number: 'Zahl',
  money: 'Betrag',
  date: 'Datum',
  select: 'Auswahl',
  boolean: 'Ja/Nein',
  image: 'Bild',
};

export const RESERVED_KEYS: Record<FieldScope, string[]> = {
  org: ['name', 'street', 'zip', 'city', 'country', 'logo', 'vat_id', 'tax_number', 'iban', 'bic', 'bank_name', 'email', 'phone', 'website', 'small_business'],
  customer: ['number', 'name', 'street', 'zip', 'city', 'country', 'email', 'vat_id', 'tax_treatment'],
  contact: ['salutation', 'first_name', 'last_name', 'full_name', 'position', 'email', 'phone'],
  catalog: ['title', 'description', 'category', 'unit', 'price', 'tax_rate'],
  document: ['type', 'type_label', 'status', 'number', 'date', 'due_date', 'valid_until', 'service_date', 'service_date_end', 'intro', 'closing', 'net_total', 'tax_total', 'gross_total', 'optional_total', 'tax_breakdown', 'legal_notes', 'source_number', 'customer', 'contact', 'positions'],
  position: ['index', 'kind', 'is_item', 'is_heading', 'is_text', 'is_optional', 'title', 'description', 'quantity', 'unit', 'unit_name', 'unit_code', 'unit_price', 'tax_percent', 'category', 'total'],
};

const KEY_RE = /^[a-z][a-z0-9_]*$/;
const TRANSLIT: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };

export function slugifyKey(label: string): string {
  const base = label
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => TRANSLIT[c])
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return /^[a-z]/.test(base) ? base : `f_${base}`;
}

export function validateFieldDef(
  def: Pick<FieldDef, 'id' | 'key' | 'label' | 'type' | 'options'>,
  existing: FieldDef[],
  scope: FieldScope,
): string[] {
  const errors: string[] = [];
  if (!def.label.trim()) errors.push('Bezeichnung fehlt.');
  if (!KEY_RE.test(def.key)) errors.push('Schlüssel darf nur Kleinbuchstaben, Ziffern und _ enthalten und muss mit einem Buchstaben beginnen.');
  if (RESERVED_KEYS[scope].includes(def.key)) errors.push(`„${def.key}“ ist ein Kernfeld und reserviert.`);
  if (existing.some((f) => f.key === def.key && f.id !== def.id)) errors.push(`Schlüssel „${def.key}“ ist bereits vergeben.`);
  if (def.type === 'select' && def.options.filter((o) => o.trim()).length === 0) errors.push('Auswahlfelder brauchen mindestens eine Option.');
  return errors;
}

export const isEmptyValue = (v: FieldValue | undefined): boolean =>
  v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

export const defaultCustomValues = (defs: FieldDef[]): CustomValues =>
  Object.fromEntries(defs.map((d) => [d.key, d.defaultValue]));
```

- [ ] **Step 3: Tests grün**

Run: `pnpm test src/domain/fields.test.ts` → Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(domain): add custom field definitions and validation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Umwandeln von Dokumenten

**Files:**
- Create: `src/domain/convert.ts`, `src/domain/convert.test.ts`

**Interfaces:**
- Consumes: `Document`, `DocType`, `DocTypeConfig`, `addDays`.
- Produces:
  - `CONVERSIONS: Record<DocType, DocType[]>`
  - `canConvert(source: Pick<Document, 'type' | 'status' | 'cancelledById'>, target: DocType): boolean`
  - `interface ConvertOptions { targetConfig: DocTypeConfig; today: string; now: string; newId: () => string }`
  - `convertDocument(source: Document, target: DocType, opts: ConvertOptions): { document: Document; droppedFields: string[] }`

- [ ] **Step 1: Failing Tests**

`src/domain/convert.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { canConvert, convertDocument } from './convert';
import type { DocTypeConfig, Document, FieldDef } from './types';

const field = (key: string): FieldDef => ({ id: key, key, label: key, type: 'text', required: false, defaultValue: null, help: '', options: [] });

const config = (over: Partial<DocTypeConfig>): DocTypeConfig => ({
  type: 'invoice', label: 'Rechnung', profile: 'basic',
  numbering: { pattern: 'RE-{0000}', nextSeq: 1, resetYearly: false, lastYear: null },
  templateId: 'tpl-invoice', defaultIntroBlockId: null, defaultClosingBlockId: null,
  paymentTermDays: 14, validityDays: null, documentFields: [], positionFields: [], ...over,
});

const offer: Document = {
  id: 'doc-1', type: 'offer', status: 'accepted', number: 'AN-0001', date: '2026-09-01',
  customerId: 'c1', contactId: 'ct1', serviceDate: '2026-09-15', serviceDateEnd: null, dueDate: null, validUntil: '2026-09-30',
  intro: 'Hallo', closing: 'Gruß', templateId: 'tpl-offer',
  positions: [
    { id: 'p1', kind: 'heading', title: 'Paket', description: '', quantity: 0, unitId: null, unitPrice: 0, taxRateId: null, categoryId: null, custom: {} },
    { id: 'p2', kind: 'item', title: 'Beratung', description: '', quantity: 4, unitId: 'u-h', unitPrice: 95, taxRateId: 'r19', categoryId: 'cat-1', custom: { phase: 'A', internal: 'x' } },
    { id: 'p3', kind: 'optional', title: 'Wartung', description: '', quantity: 1, unitId: 'u-m', unitPrice: 50, taxRateId: 'r19', categoryId: null, custom: {} },
  ],
  custom: { project_name: 'Relaunch', offer_only: 'nope' },
  sourceId: null, cancelledById: null, finalizedAt: '2026-09-01T10:00:00Z', createdAt: '', updatedAt: '',
};

let n = 0;
const opts = (targetConfig: DocTypeConfig) => ({ targetConfig, today: '2026-10-04', now: '2026-10-04T09:00:00Z', newId: () => `id-${++n}` });

describe('canConvert', () => {
  it('requires accepted offers', () => {
    expect(canConvert({ ...offer, status: 'open' }, 'invoice')).toBe(false);
    expect(canConvert(offer, 'invoice')).toBe(true);
    expect(canConvert(offer, 'confirmation')).toBe(true);
    expect(canConvert(offer, 'cancellation')).toBe(false);
  });
  it('allows cancelling open or paid invoices once', () => {
    expect(canConvert({ type: 'invoice', status: 'open', cancelledById: null }, 'cancellation')).toBe(true);
    expect(canConvert({ type: 'invoice', status: 'paid', cancelledById: null }, 'cancellation')).toBe(true);
    expect(canConvert({ type: 'invoice', status: 'draft', cancelledById: null }, 'cancellation')).toBe(false);
    expect(canConvert({ type: 'invoice', status: 'cancelled', cancelledById: 'x' }, 'cancellation')).toBe(false);
  });
  it('allows confirmations to become invoices once finalized', () => {
    expect(canConvert({ type: 'confirmation', status: 'draft', cancelledById: null }, 'invoice')).toBe(false);
    expect(canConvert({ type: 'confirmation', status: 'done', cancelledById: null }, 'invoice')).toBe(true);
  });
});

describe('convertDocument', () => {
  const target = config({ documentFields: [field('project_name')], positionFields: [field('phase')] });

  it('defaults the service date to today for invoices from offers without one', () => {
    const { document } = convertDocument({ ...offer, serviceDate: null }, 'invoice', opts(target));
    expect(document.serviceDate).toBe('2026-10-04');
  });

  it('creates a draft invoice linked to the source', () => {
    const { document } = convertDocument(offer, 'invoice', opts(target));
    expect(document).toMatchObject({
      type: 'invoice', status: 'draft', number: null, date: '2026-10-04', dueDate: '2026-10-18',
      customerId: 'c1', contactId: 'ct1', serviceDate: '2026-09-15', validUntil: null,
      intro: 'Hallo', closing: 'Gruß', templateId: 'tpl-invoice', sourceId: 'doc-1', finalizedAt: null,
    });
  });

  it('copies custom fields by matching key and reports dropped ones', () => {
    const { document, droppedFields } = convertDocument(offer, 'invoice', opts(target));
    expect(document.custom).toEqual({ project_name: 'Relaunch' });
    expect(document.positions[1].custom).toEqual({ phase: 'A' });
    expect(droppedFields.sort()).toEqual(['document.offer_only', 'position.internal']);
  });

  it('drops optional positions and gives positions new ids', () => {
    const { document } = convertDocument(offer, 'invoice', opts(target));
    expect(document.positions.map((p) => p.title)).toEqual(['Paket', 'Beratung']);
    expect(document.positions.map((p) => p.id)).not.toContain('p2');
  });

  it('negates item quantities for cancellations', () => {
    const invoice: Document = { ...offer, type: 'invoice', status: 'open', positions: offer.positions.slice(0, 2) };
    const { document } = convertDocument(invoice, 'cancellation', opts(config({ type: 'cancellation', paymentTermDays: null })));
    expect(document.positions[1].quantity).toBe(-4);
    expect(document.positions[0].quantity).toBe(0);
    expect(document.dueDate).toBeNull();
  });

  it('throws for disallowed conversions', () => {
    expect(() => convertDocument({ ...offer, status: 'open' }, 'invoice', opts(target))).toThrow('Umwandlung nicht erlaubt');
  });
});
```
Run: `pnpm test src/domain/convert.test.ts` → Expected: FAIL.

- [ ] **Step 2: Implementierung**

`src/domain/convert.ts`:
```ts
import { addDays } from './dates';
import type { CustomValues, DocType, DocTypeConfig, Document } from './types';

export const CONVERSIONS: Record<DocType, DocType[]> = {
  offer: ['confirmation', 'invoice'],
  confirmation: ['invoice'],
  invoice: ['cancellation'],
  cancellation: [],
};

export function canConvert(source: Pick<Document, 'type' | 'status' | 'cancelledById'>, target: DocType): boolean {
  if (!CONVERSIONS[source.type].includes(target)) return false;
  if (target === 'cancellation') return (source.status === 'open' || source.status === 'paid') && !source.cancelledById;
  if (source.type === 'offer') return source.status === 'accepted';
  return source.status !== 'draft';
}

export interface ConvertOptions { targetConfig: DocTypeConfig; today: string; now: string; newId: () => string }

export function convertDocument(source: Document, target: DocType, opts: ConvertOptions): { document: Document; droppedFields: string[] } {
  if (!canConvert(source, target)) throw new Error(`Umwandlung nicht erlaubt: ${source.type} (${source.status}) → ${target}`);
  const { targetConfig, today, now, newId } = opts;
  const dropped = new Set<string>();
  const pick = (custom: CustomValues, keys: Set<string>, prefix: string): CustomValues =>
    Object.fromEntries(
      Object.entries(custom).filter(([k]) => {
        if (keys.has(k)) return true;
        dropped.add(`${prefix}${k}`);
        return false;
      }),
    );
  const docKeys = new Set(targetConfig.documentFields.map((f) => f.key));
  const posKeys = new Set(targetConfig.positionFields.map((f) => f.key));
  const sign = target === 'cancellation' ? -1 : 1;

  const positions = source.positions
    .filter((p) => p.kind !== 'optional')
    .map((p) => ({ ...p, id: newId(), quantity: p.kind === 'item' ? p.quantity * sign : p.quantity, custom: pick(p.custom, posKeys, 'position.') }));

  const document: Document = {
    id: newId(),
    type: target,
    status: 'draft',
    number: null,
    date: today,
    customerId: source.customerId,
    contactId: source.contactId,
    serviceDate: source.serviceDate ?? (target === 'invoice' ? today : null),
    serviceDateEnd: source.serviceDateEnd,
    dueDate: target === 'invoice' && targetConfig.paymentTermDays !== null ? addDays(today, targetConfig.paymentTermDays) : null,
    validUntil: null,
    intro: source.intro,
    closing: source.closing,
    templateId: targetConfig.templateId,
    positions,
    custom: pick(source.custom, docKeys, 'document.'),
    sourceId: source.id,
    cancelledById: null,
    finalizedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  return { document, droppedFields: [...dropped] };
}
```

- [ ] **Step 3: Tests grün**

Run: `pnpm test src/domain/convert.test.ts` → Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(domain): add document conversion chain

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Konformitätsprofile und Prüfung

**Files:**
- Create: `src/domain/compliance.ts`, `src/domain/compliance.test.ts`

**Interfaces:**
- Consumes: Typen, `isEmptyValue`, `effectiveTax`-Logik indirekt über `taxRates`.
- Produces:
  - `PROFILE_LABELS: Record<ProfileId, string>`
  - `PROFILE_TYPES: Record<ProfileId, DocType[]>` (welche Dokumenttypen das Profil wählen dürfen)
  - `PROFILE_REQUIREMENTS: Record<ProfileId, { scope: 'org' | 'customer' | 'document' | 'position'; key: string; label: string }[]>` (für Badges im UI)
  - `interface ComplianceIssue { path: string; message: string }`
  - `interface ComplianceContext { doc: Document; config: DocTypeConfig; org: Organization; customer: Customer | null; units: Unit[]; taxRates: TaxRate[]; orgFields: FieldDef[]; customerFields: FieldDef[] }`
  - `checkCompliance(ctx: ComplianceContext): ComplianceIssue[]`

Pfad-Konvention für `path` (UI springt damit zum Feld): `org.<key>`, `customer.<key>`, `document.<key>`, `document.custom.<key>`, `positions.<positionId>.<key>`, `positions.<positionId>.custom.<key>`, `positions` (Liste allgemein).

- [ ] **Step 1: Failing Tests**

`src/domain/compliance.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { checkCompliance, type ComplianceContext } from './compliance';
import type { Customer, DocTypeConfig, Document, FieldDef, Organization, Position } from './types';

const org: Organization = {
  name: 'Studio Nordlicht', address: { street: 'Hafenweg 3', zip: '20457', city: 'Hamburg', country: 'DE' }, logo: null,
  vatId: 'DE123456789', taxNumber: '', iban: 'DE02120300000000202051', bic: 'BYLADEM1001', bankName: 'Demo Bank',
  email: 'hallo@nordlicht.example', phone: '', website: '', taxationMode: 'regular', custom: {},
};
const customer: Customer = {
  id: 'c1', number: 'K-1001', name: 'Bohnenwerk GmbH', address: { street: 'Röstweg 1', zip: '10115', city: 'Berlin', country: 'DE' },
  email: '', vatId: '', taxTreatment: 'domestic', contacts: [], custom: {},
};
const item = (over: Partial<Position> = {}): Position => ({
  id: 'p1', kind: 'item', title: 'Beratung', description: '', quantity: 2, unitId: 'u-h', unitPrice: 95, taxRateId: 'r19', categoryId: null, custom: {}, ...over,
});
const doc = (over: Partial<Document> = {}): Document => ({
  id: 'd1', type: 'invoice', status: 'draft', number: null, date: '2026-10-04', customerId: 'c1', contactId: null,
  serviceDate: '2026-09-30', serviceDateEnd: null, dueDate: '2026-10-18', validUntil: null, intro: '', closing: '',
  templateId: 't', positions: [item()], custom: {}, sourceId: null, cancelledById: null, finalizedAt: null, createdAt: '', updatedAt: '', ...over,
});
const config = (over: Partial<DocTypeConfig> = {}): DocTypeConfig => ({
  type: 'invoice', label: 'Rechnung', profile: 'basic', numbering: { pattern: '{0000}', nextSeq: 1, resetYearly: false, lastYear: null },
  templateId: 't', defaultIntroBlockId: null, defaultClosingBlockId: null, paymentTermDays: 14, validityDays: null,
  documentFields: [], positionFields: [], ...over,
});
const req = (key: string): FieldDef => ({ id: key, key, label: key, type: 'text', required: true, defaultValue: null, help: '', options: [] });

const ctx = (over: Partial<ComplianceContext> = {}): ComplianceContext => ({
  doc: doc(), config: config(), org, customer, units: [{ id: 'u-h', name: 'Stunde', symbol: 'Std.', decimals: 2, code: 'HUR' }],
  taxRates: [{ id: 'r19', label: '19 %', percent: 19, category: 'S', exemptionNote: null }], orgFields: [], customerFields: [], ...over,
});
const paths = (c: ComplianceContext) => checkCompliance(c).map((i) => i.path);

describe('basic profile', () => {
  it('passes a complete document', () => {
    expect(checkCompliance(ctx())).toEqual([]);
  });
  it('requires a customer and at least one item', () => {
    expect(paths(ctx({ customer: null, doc: doc({ customerId: null }) }))).toContain('document.customer');
    expect(paths(ctx({ doc: doc({ positions: [] }) }))).toContain('positions');
  });
  it('flags items without title and deleted tax rates', () => {
    expect(paths(ctx({ doc: doc({ positions: [item({ title: '' })] }) }))).toContain('positions.p1.title');
    expect(paths(ctx({ doc: doc({ positions: [item({ taxRateId: 'gone' })] }) }))).toContain('positions.p1.tax_rate');
  });
  it('does not flag tax rates for small businesses', () => {
    expect(paths(ctx({ org: { ...org, taxationMode: 'small_business' }, doc: doc({ positions: [item({ taxRateId: null })] }) }))).toEqual([]);
  });
  it('checks required custom fields on all levels', () => {
    const c = ctx({
      config: config({ documentFields: [req('project_name')], positionFields: [req('phase')] }),
      orgFields: [req('register')], customerFields: [req('branch')],
    });
    expect(paths(c).sort()).toEqual(['customer.branch', 'document.custom.project_name', 'org.register', 'positions.p1.custom.phase']);
  });
});

describe('en16931 profile', () => {
  const e = (over: Partial<ComplianceContext> = {}) => ctx({ config: config({ profile: 'en16931' }), ...over });

  it('passes a complete e-invoice', () => {
    expect(checkCompliance(e())).toEqual([]);
  });
  it('requires service date, due date and complete addresses', () => {
    const p = paths(e({
      doc: doc({ serviceDate: null, dueDate: null }),
      customer: { ...customer, address: { ...customer.address, zip: '' } },
      org: { ...org, address: { ...org.address, city: '' } },
    }));
    expect(p).toEqual(expect.arrayContaining(['document.service_date', 'document.due_date', 'customer.address', 'org.address']));
  });
  it('requires vat id or tax number and iban of the organisation', () => {
    expect(paths(e({ org: { ...org, vatId: '', taxNumber: '' } }))).toContain('org.vat_id');
    expect(paths(e({ org: { ...org, vatId: '', taxNumber: '12/345/67890' } }))).not.toContain('org.vat_id');
    expect(paths(e({ org: { ...org, iban: '' } }))).toContain('org.iban');
  });
  it('requires the customer vat id for reverse charge', () => {
    expect(paths(e({ customer: { ...customer, taxTreatment: 'eu_reverse_charge' } }))).toContain('customer.vat_id');
  });
  it('requires a unit with code and a non-zero quantity per item', () => {
    expect(paths(e({ doc: doc({ positions: [item({ unitId: 'gone', quantity: 0 })] }) })))
      .toEqual(expect.arrayContaining(['positions.p1.unit', 'positions.p1.quantity']));
  });
});
```
Run: `pnpm test src/domain/compliance.test.ts` → Expected: FAIL.

- [ ] **Step 2: Implementierung**

`src/domain/compliance.ts`:
```ts
import { isEmptyValue } from './fields';
import type { Address, Customer, DocType, DocTypeConfig, Document, FieldDef, Organization, ProfileId, TaxRate, Unit, CustomValues } from './types';

export const PROFILE_LABELS: Record<ProfileId, string> = {
  basic: 'Basis',
  en16931: 'E-Rechnung (EN 16931 · ZUGFeRD/XRechnung)',
};

export const PROFILE_TYPES: Record<ProfileId, DocType[]> = {
  basic: ['offer', 'confirmation', 'invoice', 'cancellation'],
  en16931: ['invoice', 'cancellation'],
};

type ReqScope = 'org' | 'customer' | 'document' | 'position';
export const PROFILE_REQUIREMENTS: Record<ProfileId, { scope: ReqScope; key: string; label: string }[]> = {
  basic: [
    { scope: 'document', key: 'customer', label: 'Kunde' },
    { scope: 'position', key: 'title', label: 'Bezeichnung' },
  ],
  en16931: [
    { scope: 'org', key: 'address', label: 'Vollständige Adresse' },
    { scope: 'org', key: 'vat_id', label: 'USt-ID oder Steuernummer' },
    { scope: 'org', key: 'iban', label: 'IBAN' },
    { scope: 'customer', key: 'address', label: 'Vollständige Adresse' },
    { scope: 'customer', key: 'vat_id', label: 'USt-ID (bei Reverse Charge)' },
    { scope: 'document', key: 'service_date', label: 'Leistungsdatum' },
    { scope: 'document', key: 'due_date', label: 'Fälligkeit' },
    { scope: 'position', key: 'unit', label: 'Einheit mit E-Rechnungs-Code' },
    { scope: 'position', key: 'quantity', label: 'Menge ≠ 0' },
  ],
};

export interface ComplianceIssue { path: string; message: string }
export interface ComplianceContext {
  doc: Document;
  config: DocTypeConfig;
  org: Organization;
  customer: Customer | null;
  units: Unit[];
  taxRates: TaxRate[];
  orgFields: FieldDef[];
  customerFields: FieldDef[];
}

const addressComplete = (a: Address) => [a.street, a.zip, a.city, a.country].every((v) => v.trim() !== '');

function requiredCustom(defs: FieldDef[], values: CustomValues, pathPrefix: string, labelPrefix: string): ComplianceIssue[] {
  return defs
    .filter((d) => d.required && isEmptyValue(values[d.key]))
    .map((d) => ({ path: `${pathPrefix}${d.key}`, message: `${labelPrefix}${d.label} fehlt.` }));
}

export function checkCompliance(ctx: ComplianceContext): ComplianceIssue[] {
  const { doc, config, org, customer, units, taxRates } = ctx;
  const issues: ComplianceIssue[] = [];
  const add = (path: string, message: string) => issues.push({ path, message });
  const items = doc.positions.filter((p) => p.kind === 'item');
  const strict = config.profile === 'en16931';

  // Basis
  if (!customer) add('document.customer', 'Kunde fehlt.');
  if (items.length === 0) add('positions', 'Mindestens eine Leistungsposition ist nötig.');
  for (const p of items) {
    if (!p.title.trim()) add(`positions.${p.id}.title`, 'Position ohne Bezeichnung.');
    if (org.taxationMode === 'regular' && !taxRates.some((r) => r.id === p.taxRateId)) add(`positions.${p.id}.tax_rate`, `„${p.title || 'Position'}“: Steuersatz fehlt oder wurde gelöscht.`);
  }
  issues.push(...requiredCustom(ctx.orgFields, org.custom, 'org.', 'Organisation: '));
  if (customer) issues.push(...requiredCustom(ctx.customerFields, customer.custom, 'customer.', 'Kunde: '));
  issues.push(...requiredCustom(config.documentFields, doc.custom, 'document.custom.', ''));
  for (const p of items) issues.push(...requiredCustom(config.positionFields, p.custom, `positions.${p.id}.custom.`, `„${p.title || 'Position'}“: `));

  if (!strict) return issues;

  // EN 16931
  if (!org.name.trim() || !addressComplete(org.address)) add('org.address', 'Organisation: Name und vollständige Adresse fehlen.');
  if (!org.vatId.trim() && !org.taxNumber.trim()) add('org.vat_id', 'Organisation: USt-ID oder Steuernummer fehlt.');
  if (!org.iban.trim()) add('org.iban', 'Organisation: IBAN fehlt.');
  if (customer && !addressComplete(customer.address)) add('customer.address', 'Kunde: vollständige Adresse fehlt.');
  if (customer?.taxTreatment === 'eu_reverse_charge' && !customer.vatId.trim()) add('customer.vat_id', 'Kunde: USt-ID ist bei Reverse Charge Pflicht.');
  if (!doc.serviceDate) add('document.service_date', 'Leistungsdatum fehlt.');
  if (doc.type === 'invoice' && !doc.dueDate) add('document.due_date', 'Fälligkeit fehlt.');
  for (const p of items) {
    const unit = units.find((u) => u.id === p.unitId);
    if (!unit || !unit.code.trim()) add(`positions.${p.id}.unit`, `„${p.title || 'Position'}“: Einheit mit E-Rechnungs-Code fehlt.`);
    if (p.quantity === 0) add(`positions.${p.id}.quantity`, `„${p.title || 'Position'}“: Menge darf nicht 0 sein.`);
  }
  return issues;
}
```

- [ ] **Step 3: Tests grün**

Run: `pnpm test src/domain/compliance.test.ts` → Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(domain): add compliance profiles (basic, EN 16931)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Template-Kontext, Liquid-Rendering und Standard-Template „Klar“

**Files:**
- Create: `src/domain/templateContext.ts`, `src/domain/templateContext.test.ts`, `src/domain/liquid.ts`, `src/domain/liquid.test.ts`, `src/templates/klar/template.liquid`, `src/templates/klar/styles.css`, `src/templates/klar/manifest.json`, `src/templates/index.ts`
- Modify: `src/vite-env.d.ts` (Typ für `?raw`-Importe ist in `vite/client` bereits enthalten — nur prüfen)

**Interfaces:**
- Consumes: `calcTotals`, `DOC_TYPE_LABELS`, `STATUS_LABELS`, `formatMoney`, `formatDate`, `formatDecimal`, Typen.
- Produces:
  - `interface TemplateContextInput { doc: Document; org: Organization; customer: Customer | null; contact: Contact | null; units: Unit[]; taxRates: TaxRate[]; categories: Category[]; sourceNumber: string | null }`
  - `type TemplateContext = { org: Record<string, unknown>; customer: Record<string, unknown> | null; contact: Record<string, unknown> | null; document: Record<string, unknown>; positions: Record<string, unknown>[]; groups: { title: string; total: number }[] }`
  - `buildTemplateContext(input: TemplateContextInput): TemplateContext`
  - `createLiquid(): Liquid`
  - `interface RenderResult { html: string; error: string | null }`
  - `renderDocument(engine: Liquid, template: Pick<Template, 'liquid' | 'css' | 'manifest'>, ctx: TemplateContext): Promise<RenderResult>` — rendert erst `document.intro`/`document.closing` als Liquid, dann das Template; Fehler liefern `error` + eine Fehlerseite als `html`, werfen nie.
  - `builtInTemplates: Template[]` aus `src/templates/index.ts` (in diesem Task nur „Klar“, Task 16 ergänzt „Kante“ und „Leise“)

Kontext-Felder (verbindlich, wird in der FieldReference im Template-Editor angezeigt):
- `org`: `name, street, zip, city, country, logo, vat_id, tax_number, iban, bic, bank_name, email, phone, website, small_business` + eigene Felder
- `customer`: `number, name, street, zip, city, country, email, vat_id, tax_treatment` + eigene Felder (oder `null`)
- `contact`: `salutation, first_name, last_name, full_name, position, email, phone` + eigene Felder (oder `null`)
- `document`: `type, type_label, status, number` (Entwurf: `"Entwurf"`), `date, due_date, valid_until, service_date, service_date_end, intro, closing, net_total, tax_total, gross_total, optional_total, tax_breakdown[] {category, percent, net, tax, gross}, legal_notes[], source_number` + eigene Felder
- `positions[]`: `index` (laufende Nr. nur für Leistungen/optionale, sonst `null`), `kind, is_item, is_heading, is_text, is_optional, title, description, quantity, unit, unit_name, unit_code, unit_price, tax_percent, category, total` + eigene Felder
- `groups[]`: `title, total`

- [ ] **Step 1: Failing Tests für den Kontext**

`src/domain/templateContext.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { buildTemplateContext, type TemplateContextInput } from './templateContext';

const input: TemplateContextInput = {
  doc: {
    id: 'd1', type: 'invoice', status: 'draft', number: null, date: '2026-10-04', customerId: 'c1', contactId: 'ct1',
    serviceDate: '2026-09-30', serviceDateEnd: null, dueDate: '2026-10-18', validUntil: null, intro: 'Hallo {{ contact.first_name }}', closing: '',
    templateId: 't', custom: { project_name: 'Relaunch' }, sourceId: 's', cancelledById: null, finalizedAt: null, createdAt: '', updatedAt: '',
    positions: [
      { id: 'h', kind: 'heading', title: 'Konzept', description: '', quantity: 0, unitId: null, unitPrice: 0, taxRateId: null, categoryId: null, custom: {} },
      { id: 'a', kind: 'item', title: 'Beratung', description: 'Workshop', quantity: 2, unitId: 'u-h', unitPrice: 95, taxRateId: 'r19', categoryId: 'cat', custom: { phase: 'A' } },
    ],
  },
  org: {
    name: 'Studio Nordlicht', address: { street: 'Hafenweg 3', zip: '20457', city: 'Hamburg', country: 'DE' }, logo: null,
    vatId: 'DE123', taxNumber: '', iban: 'DE02', bic: 'B', bankName: 'Demo Bank', email: 'e', phone: '', website: '',
    taxationMode: 'regular', custom: { register: 'HRB 1' },
  },
  customer: { id: 'c1', number: 'K-1', name: 'Bohnenwerk', address: { street: 'R 1', zip: '1', city: 'Berlin', country: 'DE' }, email: '', vatId: '', taxTreatment: 'domestic', contacts: [], custom: {} },
  contact: { id: 'ct1', salutation: 'Frau', firstName: 'Ida', lastName: 'Brandt', position: 'CEO', email: '', phone: '', isDefault: true, custom: {} },
  units: [{ id: 'u-h', name: 'Stunde', symbol: 'Std.', decimals: 2, code: 'HUR' }],
  taxRates: [{ id: 'r19', label: '19 %', percent: 19, category: 'S', exemptionNote: null }],
  categories: [{ id: 'cat', name: 'Beratung' }],
  sourceNumber: 'AN-0001',
};

describe('buildTemplateContext', () => {
  const ctx = buildTemplateContext(input);

  it('flattens organisation and merges custom fields', () => {
    expect(ctx.org).toMatchObject({ name: 'Studio Nordlicht', city: 'Hamburg', vat_id: 'DE123', small_business: false, register: 'HRB 1' });
  });
  it('exposes document core values, totals and custom fields', () => {
    expect(ctx.document).toMatchObject({
      type: 'invoice', type_label: 'Rechnung', number: 'Entwurf', due_date: '2026-10-18',
      net_total: 190, tax_total: 36.1, gross_total: 226.1, source_number: 'AN-0001', project_name: 'Relaunch',
    });
    expect(ctx.document.tax_breakdown).toEqual([{ category: 'S', percent: 19, net: 190, tax: 36.1, gross: 226.1 }]);
  });
  it('maps positions with resolved unit, category and running index', () => {
    expect(ctx.positions[0]).toMatchObject({ kind: 'heading', is_heading: true, index: null });
    expect(ctx.positions[1]).toMatchObject({
      index: 1, is_item: true, title: 'Beratung', unit: 'Std.', unit_code: 'HUR', unit_price: 95, tax_percent: 19, category: 'Beratung', total: 190, phase: 'A',
    });
    expect(ctx.groups).toEqual([{ title: 'Konzept', total: 190 }]);
  });
  it('exposes contact with full name', () => {
    expect(ctx.contact).toMatchObject({ full_name: 'Ida Brandt', first_name: 'Ida' });
  });
});
```
Run: `pnpm test src/domain/templateContext.test.ts` → Expected: FAIL.

- [ ] **Step 2: Kontext implementieren**

`src/domain/templateContext.ts`:
```ts
import { DOC_TYPE_LABELS } from './lifecycle';
import { calcTotals } from './totals';
import type { Category, Contact, Customer, Document, Organization, TaxRate, Unit } from './types';

export interface TemplateContextInput {
  doc: Document;
  org: Organization;
  customer: Customer | null;
  contact: Contact | null;
  units: Unit[];
  taxRates: TaxRate[];
  categories: Category[];
  sourceNumber: string | null;
}

export type TemplateContext = {
  org: Record<string, unknown>;
  customer: Record<string, unknown> | null;
  contact: Record<string, unknown> | null;
  document: Record<string, unknown>;
  positions: Record<string, unknown>[];
  groups: { title: string; total: number }[];
};

export function buildTemplateContext(input: TemplateContextInput): TemplateContext {
  const { doc, org, customer, contact, units, taxRates, categories } = input;
  const totals = calcTotals(doc.positions, {
    taxRates,
    taxationMode: org.taxationMode,
    taxTreatment: customer?.taxTreatment ?? 'domestic',
  });

  let index = 0;
  const positions = doc.positions.map((p) => {
    const unit = units.find((u) => u.id === p.unitId);
    const line = totals.lines[p.id];
    const counted = p.kind === 'item' || p.kind === 'optional';
    return {
      ...p.custom,
      index: counted ? ++index : null,
      kind: p.kind,
      is_item: p.kind === 'item',
      is_heading: p.kind === 'heading',
      is_text: p.kind === 'text',
      is_optional: p.kind === 'optional',
      title: p.title,
      description: p.description,
      quantity: p.quantity,
      unit: unit?.symbol ?? '',
      unit_name: unit?.name ?? '',
      unit_code: unit?.code ?? '',
      unit_price: p.unitPrice,
      tax_percent: line?.tax?.percent ?? 0,
      category: categories.find((c) => c.id === p.categoryId)?.name ?? '',
      total: line?.net ?? 0,
    };
  });

  return {
    org: {
      ...org.custom,
      name: org.name, street: org.address.street, zip: org.address.zip, city: org.address.city, country: org.address.country,
      logo: org.logo, vat_id: org.vatId, tax_number: org.taxNumber, iban: org.iban, bic: org.bic, bank_name: org.bankName,
      email: org.email, phone: org.phone, website: org.website, small_business: org.taxationMode === 'small_business',
    },
    customer: customer && {
      ...customer.custom,
      number: customer.number, name: customer.name, street: customer.address.street, zip: customer.address.zip,
      city: customer.address.city, country: customer.address.country, email: customer.email, vat_id: customer.vatId,
      tax_treatment: customer.taxTreatment,
    },
    contact: contact && {
      ...contact.custom,
      salutation: contact.salutation, first_name: contact.firstName, last_name: contact.lastName,
      full_name: `${contact.firstName} ${contact.lastName}`.trim(), position: contact.position, email: contact.email, phone: contact.phone,
    },
    document: {
      ...doc.custom,
      type: doc.type, type_label: DOC_TYPE_LABELS[doc.type], status: doc.status, number: doc.number ?? 'Entwurf',
      date: doc.date, due_date: doc.dueDate, valid_until: doc.validUntil, service_date: doc.serviceDate, service_date_end: doc.serviceDateEnd,
      intro: doc.intro, closing: doc.closing,
      net_total: totals.net, tax_total: totals.tax, gross_total: totals.gross, optional_total: totals.optionalNet,
      tax_breakdown: totals.taxBreakdown, legal_notes: totals.legalNotes, source_number: input.sourceNumber,
    },
    positions,
    groups: totals.groups.map((g) => ({ title: g.title, total: g.net })),
  };
}
```
Core-Werte stehen **nach** dem Spread der eigenen Felder, damit eigene Felder Kernwerte nie überschreiben (doppelte Absicherung zu `RESERVED_KEYS`).

Run: `pnpm test src/domain/templateContext.test.ts` → Expected: PASS.

- [ ] **Step 3: Failing Tests für Liquid**

`src/domain/liquid.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { createLiquid, renderDocument } from './liquid';
import type { TemplateContext } from './templateContext';
import type { TemplateManifest } from './types';

const manifest: TemplateManifest = {
  name: 'T', version: '1.0.0', author: 'a', license: 'MIT', description: '', documentTypes: ['invoice'], expectedFields: [],
  paper: { format: 'A4', margin: '20mm' },
};
const ctx: TemplateContext = {
  org: { name: 'Studio <Nordlicht>' }, customer: null, contact: { first_name: 'Ida' },
  document: { number: 'RE-1', date: '2026-10-04', gross_total: 1234.5, intro: 'Hallo {{ contact.first_name }}', closing: 'Zeile 1\nZeile 2' },
  positions: [], groups: [],
};
const norm = (s: string) => s.replace(/\s/g, ' ');

describe('renderDocument', () => {
  const engine = createLiquid();

  it('renders values with custom filters', async () => {
    const r = await renderDocument(engine, { manifest, css: '.x{}', liquid: '{{ document.number }}|{{ document.date | date }}|{{ document.gross_total | money }}' }, ctx);
    expect(r.error).toBeNull();
    expect(norm(r.html)).toContain('RE-1|04.10.2026|1.234,50 €');
    expect(r.html).toContain('.x{}');
  });

  it('escapes output by default', async () => {
    const r = await renderDocument(engine, { manifest, css: '', liquid: '{{ org.name }}' }, ctx);
    expect(r.html).toContain('Studio &lt;Nordlicht&gt;');
  });

  it('renders liquid inside intro and nl2br in closing', async () => {
    const r = await renderDocument(engine, { manifest, css: '', liquid: '{{ document.intro }}#{{ document.closing | nl2br }}' }, ctx);
    expect(r.html).toContain('Hallo Ida#Zeile 1<br>Zeile 2');
  });

  it('returns an error page instead of throwing on broken syntax', async () => {
    const r = await renderDocument(engine, { manifest, css: '', liquid: '{% for p in positions %}{{ p.title }' }, ctx);
    expect(r.error).toMatch(/line:?\s?1/i);
    expect(r.html).toContain('Template-Fehler');
  });

  it('renders missing variables as empty strings', async () => {
    const r = await renderDocument(engine, { manifest, css: '', liquid: '[{{ document.nope }}]' }, ctx);
    expect(r.html).toContain('[]');
  });

  it('puts paper margin on the sheet', async () => {
    const r = await renderDocument(engine, { manifest, css: '', liquid: '' }, ctx);
    expect(r.html).toContain('padding: 20mm');
  });
});
```
Run: `pnpm test src/domain/liquid.test.ts` → Expected: FAIL.

- [ ] **Step 4: Liquid implementieren**

`src/domain/liquid.ts`:
```ts
import { Liquid } from 'liquidjs';
import { formatDate, formatDecimal, formatMoney } from './format';
import type { TemplateContext } from './templateContext';
import type { Template } from './types';

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function createLiquid(): Liquid {
  const engine = new Liquid({ outputEscape: 'escape', strictVariables: false, strictFilters: true, ownPropertyOnly: true });
  engine.registerFilter('money', (v: unknown) => formatMoney(Number(v ?? 0)));
  engine.registerFilter('date', (v: unknown) => formatDate(v ? String(v) : null));
  engine.registerFilter('number', (v: unknown, decimals = 2) => formatDecimal(Number(v ?? 0), Number(decimals)));
  engine.registerFilter('nl2br', {
    handler: (v: unknown) => escapeHtml(String(v ?? '')).replace(/\n/g, '<br>'),
    raw: true,
  });
  return engine;
}

const PAPER: Record<'A4' | 'Letter', { w: string; h: string }> = { A4: { w: '210mm', h: '297mm' }, Letter: { w: '216mm', h: '279mm' } };

const shell = (body: string, css: string, manifest: Template['manifest']) => {
  const p = PAPER[manifest.paper.format];
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><style>
html{background:#fff}
body{margin:0;box-sizing:border-box;width:${p.w};min-height:${p.h};padding: ${manifest.paper.margin};}
@media print{@page{size:${manifest.paper.format};margin:${manifest.paper.margin}}body{width:auto;min-height:0;padding:0}}
${css}
</style></head><body>${body}</body></html>`;
};

export interface RenderResult { html: string; error: string | null }

export async function renderDocument(
  engine: Liquid,
  template: Pick<Template, 'liquid' | 'css' | 'manifest'>,
  ctx: TemplateContext,
): Promise<RenderResult> {
  try {
    const intro = await engine.parseAndRender(String(ctx.document.intro ?? ''), ctx);
    const closing = await engine.parseAndRender(String(ctx.document.closing ?? ''), ctx);
    const full = { ...ctx, document: { ...ctx.document, intro, closing } };
    const body = await engine.parseAndRender(template.liquid, full);
    return { html: shell(body, template.css, template.manifest), error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const body = `<div style="font:14px/1.5 system-ui;color:#b42318"><strong>Template-Fehler</strong><pre style="white-space:pre-wrap">${escapeHtml(message)}</pre></div>`;
    return { html: shell(body, '', template.manifest), error: message };
  }
}
```
Hinweise: Bei `outputEscape: 'escape'` wird jede Ausgabe escaped; `nl2br` ist als `raw: true` registriert, weil es selbst escaped. Die `intro`-/`closing`-Texte werden vor dem Einsetzen gerendert und danach beim Ausgeben erneut escaped — Templates geben sie deshalb mit `{{ document.intro | nl2br }}` aus (Escape passiert dann genau einmal in `nl2br`). Falls `nl2br` mit `raw: true` in der installierten liquidjs-Version doppelt escaped, stattdessen im Template `| raw` nach `nl2br` verwenden und den Test entsprechend anpassen — der Test `renders liquid inside intro and nl2br in closing` ist maßgeblich.

Run: `pnpm test src/domain/liquid.test.ts` → Expected: PASS.

- [ ] **Step 5: Standard-Template „Klar“**

`src/templates/klar/manifest.json`:
```json
{
  "name": "Klar",
  "version": "1.0.0",
  "author": "openbill",
  "license": "MIT",
  "description": "Ruhiges, klassisches Layout mit klarer Tabelle. Passt zu allen Dokumenttypen.",
  "documentTypes": ["offer", "confirmation", "invoice", "cancellation"],
  "expectedFields": [{ "scope": "document", "key": "project_name", "type": "text", "fallback": "" }],
  "paper": { "format": "A4", "margin": "18mm 20mm 22mm 20mm" }
}
```

`src/templates/klar/template.liquid`:
```liquid
<header class="head">
  <div class="sender">
    {% if org.logo %}<img class="logo" src="{{ org.logo }}" alt="">{% else %}<div class="wordmark">{{ org.name }}</div>{% endif %}
  </div>
  <div class="meta">
    <div class="type">{{ document.type_label }}</div>
    <dl>
      <dt>Nummer</dt><dd>{{ document.number }}</dd>
      <dt>Datum</dt><dd>{{ document.date | date }}</dd>
      {% if document.service_date %}<dt>Leistung</dt><dd>{{ document.service_date | date }}{% if document.service_date_end %} – {{ document.service_date_end | date }}{% endif %}</dd>{% endif %}
      {% if document.due_date %}<dt>Fällig</dt><dd>{{ document.due_date | date }}</dd>{% endif %}
      {% if document.valid_until %}<dt>Gültig bis</dt><dd>{{ document.valid_until | date }}</dd>{% endif %}
      {% if customer.number %}<dt>Kunde</dt><dd>{{ customer.number }}</dd>{% endif %}
      {% if document.source_number %}<dt>Bezug</dt><dd>{{ document.source_number }}</dd>{% endif %}
    </dl>
  </div>
</header>

<section class="address">
  <div class="return">{{ org.name }} · {{ org.street }} · {{ org.zip }} {{ org.city }}</div>
  {% if customer %}
    <div>{{ customer.name }}</div>
    {% if contact %}<div>{{ contact.salutation }} {{ contact.full_name }}</div>{% endif %}
    <div>{{ customer.street }}</div>
    <div>{{ customer.zip }} {{ customer.city }}</div>
  {% endif %}
</section>

<h1>{{ document.type_label }} {{ document.number }}{% if document.project_name %} · {{ document.project_name }}{% endif %}</h1>

{% if document.intro %}<p class="text">{{ document.intro | nl2br }}</p>{% endif %}

<table class="items">
  <thead><tr><th class="n">Pos.</th><th>Leistung</th><th class="r">Menge</th><th class="r">Einzelpreis</th><th class="r">Gesamt</th></tr></thead>
  <tbody>
  {% for p in positions %}
    {% if p.is_heading %}
      <tr class="heading"><td colspan="5">{{ p.title }}</td></tr>
    {% elsif p.is_text %}
      <tr class="note"><td></td><td colspan="4">{{ p.title }}{% if p.description %}<br><span class="desc">{{ p.description | nl2br }}</span>{% endif %}</td></tr>
    {% else %}
      <tr class="{% if p.is_optional %}optional{% endif %}">
        <td class="n">{{ p.index }}</td>
        <td>{{ p.title }}{% if p.is_optional %} <em>(optional)</em>{% endif %}{% if p.description %}<br><span class="desc">{{ p.description | nl2br }}</span>{% endif %}</td>
        <td class="r">{{ p.quantity | number: 2 }} {{ p.unit }}</td>
        <td class="r">{{ p.unit_price | money }}</td>
        <td class="r">{{ p.total | money }}</td>
      </tr>
    {% endif %}
  {% endfor %}
  </tbody>
</table>

<table class="sums">
  <tr><td>Netto</td><td class="r">{{ document.net_total | money }}</td></tr>
  {% for t in document.tax_breakdown %}{% if t.percent > 0 %}
  <tr><td>USt. {{ t.percent }} % auf {{ t.net | money }}</td><td class="r">{{ t.tax | money }}</td></tr>
  {% endif %}{% endfor %}
  <tr class="total"><td>Gesamt</td><td class="r">{{ document.gross_total | money }}</td></tr>
  {% if document.optional_total > 0 %}<tr class="opt"><td>Optionale Positionen (nicht enthalten)</td><td class="r">{{ document.optional_total | money }}</td></tr>{% endif %}
</table>

{% for note in document.legal_notes %}<p class="legal">{{ note }}</p>{% endfor %}
{% if document.closing %}<p class="text">{{ document.closing | nl2br }}</p>{% endif %}

<footer class="foot">
  <div>{{ org.name }}<br>{{ org.street }}<br>{{ org.zip }} {{ org.city }}</div>
  <div>{{ org.email }}<br>{{ org.phone }}<br>{{ org.website }}</div>
  <div>{% if org.vat_id %}USt-ID {{ org.vat_id }}{% else %}St.-Nr. {{ org.tax_number }}{% endif %}{% if org.register %}<br>{{ org.register }}{% endif %}</div>
  <div>{{ org.bank_name }}<br>IBAN {{ org.iban }}<br>BIC {{ org.bic }}</div>
</footer>
```

`src/templates/klar/styles.css`:
```css
body { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 9.5pt; color: #1b1a17; line-height: 1.45; position: relative; }
.head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14mm; }
.logo { max-height: 18mm; max-width: 60mm; }
.wordmark { font-size: 16pt; font-weight: 600; letter-spacing: -0.02em; }
.meta .type { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.12em; color: #6d685f; text-align: right; margin-bottom: 2mm; }
.meta dl { display: grid; grid-template-columns: auto auto; gap: 0.5mm 6mm; margin: 0; font-size: 8.5pt; }
.meta dt { color: #6d685f; } .meta dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; }
.address { min-height: 32mm; margin-bottom: 10mm; }
.return { font-size: 7pt; color: #6d685f; border-bottom: 0.3pt solid #c9c3b8; padding-bottom: 1mm; margin-bottom: 2mm; display: inline-block; }
h1 { font-size: 14pt; font-weight: 600; margin: 0 0 5mm; letter-spacing: -0.01em; }
.text { margin: 0 0 6mm; }
.items { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
.items th { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.08em; color: #6d685f; font-weight: 500; text-align: left; border-bottom: 0.6pt solid #1b1a17; padding: 0 2mm 1.5mm; }
.items td { padding: 2mm; border-bottom: 0.3pt solid #e3ddd2; vertical-align: top; }
.items .n { width: 9mm; color: #6d685f; } .items .r { text-align: right; white-space: nowrap; }
.items .heading td { font-weight: 600; padding-top: 4mm; border-bottom: none; }
.items .optional td { color: #6d685f; }
.desc { color: #6d685f; font-size: 8.5pt; }
.sums { margin: 4mm 0 6mm auto; border-collapse: collapse; min-width: 75mm; font-variant-numeric: tabular-nums; }
.sums td { padding: 1mm 2mm; } .sums .r { text-align: right; }
.sums .total td { font-weight: 700; border-top: 0.6pt solid #1b1a17; padding-top: 2mm; }
.sums .opt td { color: #6d685f; font-size: 8pt; }
.legal { font-size: 8.5pt; margin: 0 0 3mm; }
.foot { margin-top: 14mm; padding-top: 3mm; border-top: 0.3pt solid #c9c3b8; display: grid; grid-template-columns: repeat(4, 1fr); gap: 4mm; font-size: 7pt; color: #6d685f; }
```

`src/templates/index.ts`:
```ts
import type { Template, TemplateManifest } from '@/domain/types';
import klarLiquid from './klar/template.liquid?raw';
import klarCss from './klar/styles.css?raw';
import klarManifest from './klar/manifest.json';

export const builtInTemplates: Template[] = [
  { id: 'tpl-klar', builtIn: true, manifest: klarManifest as TemplateManifest, liquid: klarLiquid, css: klarCss },
];
```

- [ ] **Step 6: Smoke-Test des Templates gegen den Kontext**

In `src/domain/liquid.test.ts` ergänzen:
```ts
import { readFileSync } from 'node:fs';
import { buildTemplateContext } from './templateContext';

it('renders the built-in Klar template without errors', async () => {
  const liquid = readFileSync(new URL('../templates/klar/template.liquid', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../templates/klar/styles.css', import.meta.url), 'utf8');
  const ctx2 = buildTemplateContext({
    doc: { id: 'd', type: 'invoice', status: 'draft', number: null, date: '2026-10-04', customerId: null, contactId: null, serviceDate: null, serviceDateEnd: null, dueDate: null, validUntil: null, intro: '', closing: '', templateId: 't', positions: [{ id: 'a', kind: 'item', title: 'Beratung', description: '', quantity: 1, unitId: null, unitPrice: 100, taxRateId: 'r', categoryId: null, custom: {} }], custom: {}, sourceId: null, cancelledById: null, finalizedAt: null, createdAt: '', updatedAt: '' },
    org: { name: 'Studio Nordlicht', address: { street: '', zip: '', city: '', country: 'DE' }, logo: null, vatId: '', taxNumber: '', iban: '', bic: '', bankName: '', email: '', phone: '', website: '', taxationMode: 'regular', custom: {} },
    customer: null, contact: null, units: [], taxRates: [{ id: 'r', label: '19', percent: 19, category: 'S', exemptionNote: null }], categories: [], sourceNumber: null,
  });
  const r = await renderDocument(engine, { manifest, liquid, css }, ctx2);
  expect(r.error).toBeNull();
  expect(r.html).toContain('Beratung');
});
```
(`engine` und `manifest` aus dem `describe`-Block bzw. Dateikopf wiederverwenden — Test in den `describe('renderDocument')`-Block legen.)

Run: `pnpm test` → Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(domain): add template context, Liquid rendering and Klar template

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Template-Pakete (ZIP) und E-Rechnung-XML (Mock)

**Files:**
- Create: `src/domain/templatePackage.ts`, `src/domain/templatePackage.test.ts`, `src/domain/einvoice.ts`, `src/domain/einvoice.test.ts`

**Interfaces:**
- Consumes: `Template`, `TemplateManifest`, `TemplateContext`, fflate (`unzipSync`, `zipSync`, `strToU8`, `strFromU8`).
- Produces:
  - `type ImportResult = { ok: true; template: Omit<Template, 'id' | 'builtIn'> } | { ok: false; errors: string[] }`
  - `importTemplatePackage(bytes: Uint8Array): ImportResult`
  - `exportTemplatePackage(template: Template): Uint8Array`
  - `validateManifest(raw: unknown): { manifest: TemplateManifest | null; errors: string[] }`
  - `generateCiiXml(ctx: TemplateContext): string`

Paketformat: ZIP mit `manifest.json`, `template.liquid`, optional `styles.css`. Ein einzelner Wurzelordner im ZIP (z. B. `klar/manifest.json`) wird toleriert. `assets/` werden im Dummy ignoriert (Hinweis in `errors` nicht nötig).

- [ ] **Step 1: Failing Tests**

`src/domain/templatePackage.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { exportTemplatePackage, importTemplatePackage } from './templatePackage';
import type { Template } from './types';

const manifest = {
  name: 'Kante', version: '1.0.0', author: 'Jane', license: 'MIT', description: 'Bold', documentTypes: ['invoice'],
  expectedFields: [], paper: { format: 'A4', margin: '20mm' },
};
const zip = (files: Record<string, string>) => zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])));

describe('importTemplatePackage', () => {
  it('imports a valid package', () => {
    const r = importTemplatePackage(zip({ 'manifest.json': JSON.stringify(manifest), 'template.liquid': '<h1>{{ document.number }}</h1>', 'styles.css': 'h1{}' }));
    expect(r).toEqual({ ok: true, template: { manifest, liquid: '<h1>{{ document.number }}</h1>', css: 'h1{}' } });
  });
  it('accepts a single root folder', () => {
    const r = importTemplatePackage(zip({ 'kante/manifest.json': JSON.stringify(manifest), 'kante/template.liquid': 'x' }));
    expect(r.ok).toBe(true);
  });
  it('reports missing files', () => {
    const r = importTemplatePackage(zip({ 'readme.txt': 'hi' }));
    expect(r).toEqual({ ok: false, errors: ['manifest.json fehlt.', 'template.liquid fehlt.'] });
  });
  it('reports broken JSON and invalid manifest values', () => {
    expect(importTemplatePackage(zip({ 'manifest.json': '{', 'template.liquid': 'x' }))).toEqual({ ok: false, errors: ['manifest.json ist kein gültiges JSON.'] });
    const bad = importTemplatePackage(zip({ 'manifest.json': JSON.stringify({ ...manifest, name: '', documentTypes: ['bill'] }), 'template.liquid': 'x' }));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors).toEqual(['Manifest: name fehlt.', 'Manifest: unbekannter Dokumenttyp „bill“.']);
  });
  it('rejects non-zip input', () => {
    expect(importTemplatePackage(strToU8('not a zip'))).toEqual({ ok: false, errors: ['Datei ist kein gültiges ZIP-Archiv.'] });
  });
});

describe('exportTemplatePackage', () => {
  it('round-trips', () => {
    const t: Template = { id: 'x', builtIn: false, manifest: manifest as Template['manifest'], liquid: 'L', css: 'C' };
    expect(importTemplatePackage(exportTemplatePackage(t))).toEqual({ ok: true, template: { manifest, liquid: 'L', css: 'C' } });
  });
});
```

`src/domain/einvoice.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { generateCiiXml } from './einvoice';
import type { TemplateContext } from './templateContext';

const ctx: TemplateContext = {
  org: { name: 'Studio & Co', street: 'Hafenweg 3', zip: '20457', city: 'Hamburg', country: 'DE', vat_id: 'DE123' },
  customer: { name: 'Fjord AB', street: 'Gata 1', zip: '111', city: 'Stockholm', country: 'SE', vat_id: 'SE999' },
  contact: null,
  document: { number: 'RE-2026-0001', date: '2026-10-04', due_date: '2026-10-18', service_date: '2026-09-30', net_total: 190, tax_total: 0, gross_total: 190,
    tax_breakdown: [{ category: 'AE', percent: 0, net: 190, tax: 0, gross: 190 }], legal_notes: ['Reverse Charge'] },
  positions: [{ index: 1, is_item: true, title: 'Beratung', quantity: 2, unit_code: 'HUR', unit_price: 95, total: 190, tax_percent: 0 }],
  groups: [],
};

describe('generateCiiXml', () => {
  const xml = generateCiiXml(ctx);
  it('contains header data and escapes text', () => {
    expect(xml).toContain('<ram:ID>RE-2026-0001</ram:ID>');
    expect(xml).toContain('<udt:DateTimeString format="102">20261004</udt:DateTimeString>');
    expect(xml).toContain('Studio &amp; Co');
  });
  it('contains lines and tax categories', () => {
    expect(xml).toContain('<ram:BilledQuantity unitCode="HUR">2</ram:BilledQuantity>');
    expect(xml).toContain('<ram:CategoryCode>AE</ram:CategoryCode>');
    expect(xml).toContain('<ram:GrandTotalAmount>190.00</ram:GrandTotalAmount>');
  });
  it('skips non-item positions', () => {
    const x = generateCiiXml({ ...ctx, positions: [...ctx.positions, { is_item: false, title: 'Überschrift' }] });
    expect(x.match(/<ram:IncludedSupplyChainTradeLineItem>/g)).toHaveLength(1);
  });
});
```
Run: `pnpm test` → Expected: FAIL.

- [ ] **Step 2: Implementierung Pakete**

`src/domain/templatePackage.ts`:
```ts
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type { DocType, Template, TemplateManifest } from './types';

const DOC_TYPES: DocType[] = ['offer', 'confirmation', 'invoice', 'cancellation'];
export type ImportResult = { ok: true; template: Omit<Template, 'id' | 'builtIn'> } | { ok: false; errors: string[] };

export function validateManifest(raw: unknown): { manifest: TemplateManifest | null; errors: string[] } {
  const errors: string[] = [];
  const m = (raw ?? {}) as Record<string, unknown>;
  for (const key of ['name', 'version', 'author', 'license'] as const) {
    if (typeof m[key] !== 'string' || !(m[key] as string).trim()) errors.push(`Manifest: ${key} fehlt.`);
  }
  const types = Array.isArray(m.documentTypes) ? (m.documentTypes as unknown[]) : [];
  if (types.length === 0) errors.push('Manifest: documentTypes fehlt.');
  for (const t of types) if (!DOC_TYPES.includes(t as DocType)) errors.push(`Manifest: unbekannter Dokumenttyp „${String(t)}“.`);
  const paper = m.paper as { format?: unknown; margin?: unknown } | undefined;
  if (!paper || (paper.format !== 'A4' && paper.format !== 'Letter') || typeof paper.margin !== 'string') errors.push('Manifest: paper (format A4/Letter, margin) ungültig.');
  if (errors.length) return { manifest: null, errors };
  return {
    manifest: {
      name: m.name as string, version: m.version as string, author: m.author as string, license: m.license as string,
      description: typeof m.description === 'string' ? m.description : '',
      documentTypes: types as DocType[],
      expectedFields: Array.isArray(m.expectedFields) ? (m.expectedFields as TemplateManifest['expectedFields']) : [],
      paper: paper as TemplateManifest['paper'],
    },
    errors: [],
  };
}

export function importTemplatePackage(bytes: Uint8Array): ImportResult {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    return { ok: false, errors: ['Datei ist kein gültiges ZIP-Archiv.'] };
  }
  const names = Object.keys(entries).filter((n) => !n.endsWith('/') && !n.startsWith('__MACOSX/'));
  const roots = new Set(names.map((n) => (n.includes('/') ? n.split('/')[0] : '')));
  const prefix = roots.size === 1 && !roots.has('') ? `${[...roots][0]}/` : '';
  const read = (name: string) => (entries[prefix + name] ? strFromU8(entries[prefix + name]) : null);

  const manifestRaw = read('manifest.json');
  const liquid = read('template.liquid');
  const missing = [manifestRaw === null && 'manifest.json fehlt.', liquid === null && 'template.liquid fehlt.'].filter(Boolean) as string[];
  if (missing.length) return { ok: false, errors: missing };

  let parsed: unknown;
  try {
    parsed = JSON.parse(manifestRaw!);
  } catch {
    return { ok: false, errors: ['manifest.json ist kein gültiges JSON.'] };
  }
  const { manifest, errors } = validateManifest(parsed);
  if (!manifest) return { ok: false, errors };
  return { ok: true, template: { manifest, liquid: liquid!, css: read('styles.css') ?? '' } };
}

export function exportTemplatePackage(template: Template): Uint8Array {
  return zipSync({
    'manifest.json': strToU8(JSON.stringify(template.manifest, null, 2)),
    'template.liquid': strToU8(template.liquid),
    'styles.css': strToU8(template.css),
  });
}
```
Achtung: Der Round-Trip-Test vergleicht mit dem Original-`manifest` inkl. `description`; `validateManifest` übernimmt alle Felder, daher stimmen sie überein.

- [ ] **Step 3: Implementierung XML (Mock)**

`src/domain/einvoice.ts`:
```ts
import type { TemplateContext } from './templateContext';

const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const amount = (v: unknown) => Number(v ?? 0).toFixed(2);
const date102 = (iso: unknown) => String(iso ?? '').replace(/-/g, '');

const party = (tag: string, p: Record<string, unknown> | null) => p ? `
      <ram:${tag}>
        <ram:Name>${esc(p.name)}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${esc(p.zip)}</ram:PostcodeCode>
          <ram:LineOne>${esc(p.street)}</ram:LineOne>
          <ram:CityName>${esc(p.city)}</ram:CityName>
          <ram:CountryID>${esc(p.country)}</ram:CountryID>
        </ram:PostalTradeAddress>${p.vat_id ? `
        <ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(p.vat_id)}</ram:ID></ram:SpecifiedTaxRegistration>` : ''}
      </ram:${tag}>` : '';

/** Vereinfachte ZUGFeRD/CII-Struktur zur Anschauung im Klickdummy — nicht validiert. */
export function generateCiiXml(ctx: TemplateContext): string {
  const d = ctx.document;
  const lines = ctx.positions.filter((p) => p.is_item).map((p) => `
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument><ram:LineID>${esc(p.index)}</ram:LineID></ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct><ram:Name>${esc(p.title)}</ram:Name></ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice><ram:ChargeAmount>${amount(p.unit_price)}</ram:ChargeAmount></ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="${esc(p.unit_code)}">${esc(p.quantity)}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax><ram:TypeCode>VAT</ram:TypeCode><ram:RateApplicablePercent>${esc(p.tax_percent)}</ram:RateApplicablePercent></ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>${amount(p.total)}</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`).join('');
  const taxes = ((d.tax_breakdown as Record<string, unknown>[]) ?? []).map((t) => `
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${amount(t.tax)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>${(d.legal_notes as string[])?.length && t.percent === 0 ? `
        <ram:ExemptionReason>${esc((d.legal_notes as string[])[0])}</ram:ExemptionReason>` : ''}
        <ram:BasisAmount>${amount(t.net)}</ram:BasisAmount>
        <ram:CategoryCode>${esc(t.category)}</ram:CategoryCode>
        <ram:RateApplicablePercent>${esc(t.percent)}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>urn:cen.eu:en16931:2017</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${esc(d.number)}</ram:ID>
    <ram:TypeCode>${d.type === 'cancellation' ? '381' : '380'}</ram:TypeCode>
    <ram:IssueDateTime><udt:DateTimeString format="102">${date102(d.date)}</udt:DateTimeString></ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>${lines}
    <ram:ApplicableHeaderTradeAgreement>${party('SellerTradeParty', ctx.org)}${party('BuyerTradeParty', ctx.customer)}
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery>
      <ram:ActualDeliverySupplyChainEvent><ram:OccurrenceDateTime><udt:DateTimeString format="102">${date102(d.service_date)}</udt:DateTimeString></ram:OccurrenceDateTime></ram:ActualDeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>${taxes}
      <ram:SpecifiedTradePaymentTerms><ram:DueDateDateTime><udt:DateTimeString format="102">${date102(d.due_date)}</udt:DateTimeString></ram:DueDateDateTime></ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${amount(d.net_total)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${amount(d.net_total)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${amount(d.tax_total)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${amount(d.gross_total)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${amount(d.gross_total)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
}
```

- [ ] **Step 4: Tests grün**

Run: `pnpm test` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(domain): add template package import/export and mock CII XML

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Demo-Daten und Zustand-Stores

**Files:**
- Create: `src/store/ids.ts`, `src/data/seed.ts`, `src/store/settingsStore.ts`, `src/store/customerStore.ts`, `src/store/catalogStore.ts`, `src/store/documentStore.ts`, `src/store/templateStore.ts`, `src/store/sessionStore.ts`, `src/store/reset.ts`, `src/store/selectors.ts`, `src/store/documentStore.test.ts`

**Interfaces:**
- Consumes: alle Domain-Module, `builtInTemplates`.
- Produces (verbindliche Namen für alle UI-Tasks):
  - `newId(): string` (`crypto.randomUUID()`)
  - `seed(): SeedData` mit `interface SeedData { settings: SettingsData; customers: Customer[]; catalog: CatalogItem[]; documents: Document[]; templates: Template[] }`
  - `interface SettingsData { org: Organization; docTypes: Record<DocType, DocTypeConfig>; taxRates: TaxRate[]; units: Unit[]; categories: Category[]; textBlocks: TextBlock[]; users: User[]; fieldDefs: Record<'org' | 'customer' | 'contact' | 'catalog', FieldDef[]> }`
  - `useSettingsStore`: `SettingsData & { updateOrg(patch: Partial<Organization>): void; updateDocType(type: DocType, patch: Partial<DocTypeConfig>): void; upsertFieldDef(target: FieldTarget, def: FieldDef): string[]; removeFieldDef(target: FieldTarget, id: string): void; allocateNumber(type: DocType, date: string): string; upsertTaxRate(r: TaxRate): void; removeTaxRate(id: string): void; upsertUnit(u: Unit): void; removeUnit(id: string): void; upsertCategory(c: Category): void; removeCategory(id: string): void; upsertTextBlock(b: TextBlock): void; removeTextBlock(id: string): void; upsertUser(u: User): void; removeUser(id: string): void }`
  - `type FieldTarget = { scope: 'org' | 'customer' | 'contact' | 'catalog' } | { scope: 'document' | 'position'; docType: DocType }`
  - `useCustomerStore`: `{ customers: Customer[]; upsertCustomer(c: Customer): void; removeCustomer(id: string): void; upsertContact(customerId: string, contact: Contact): void; removeContact(customerId: string, contactId: string): void; setDefaultContact(customerId: string, contactId: string): void }`
  - `useCatalogStore`: `{ items: CatalogItem[]; upsertItem(i: CatalogItem): void; removeItem(id: string): void }`
  - `useDocumentStore`: `{ documents: Document[]; createDocument(type: DocType, customerId?: string | null): string; updateDocument(id: string, patch: Partial<Document>): void; addPosition(id: string, kind: PositionKind, afterIndex?: number): string; insertCatalogItem(id: string, item: CatalogItem, positionId?: string): void; updatePosition(id: string, positionId: string, patch: Partial<Position>): void; removePosition(id: string, positionId: string): void; movePosition(id: string, from: number, to: number): void; finalizeDocument(id: string): { ok: true } | { ok: false; issues: ComplianceIssue[] }; setStatus(id: string, status: DocStatus): void; convertTo(id: string, target: DocType): { id: string; droppedFields: string[] }; duplicateDocument(id: string): string; deleteDraft(id: string): void }`
  - `useTemplateStore`: `{ templates: Template[]; upsertTemplate(t: Template): void; removeTemplate(id: string): void; duplicateTemplate(id: string): string; importPackage(bytes: Uint8Array): { ok: true; id: string } | { ok: false; errors: string[] } }`
  - `useSessionStore`: `{ user: { name: string; email: string } | null; theme: 'system' | 'light' | 'dark'; login(email: string): void; logout(): void; setTheme(t: 'system' | 'light' | 'dark'): void }`
  - `resetDemo(): void`
  - `buildComplianceContext(docId: string): ComplianceContext | null`, `buildContextInput(docId: string): TemplateContextInput | null` in `selectors.ts` (lesen via `getState()`), dazu Hooks `useDocumentView(docId)` → `{ doc, config, customer, contact, totals, issues, contextInput } | null` (memoisiert mit `useMemo` über die Store-Slices).

Regeln in den Stores:
- `updateDocument`, `addPosition`, `insertCatalogItem`, `updatePosition`, `removePosition`, `movePosition`, `deleteDraft` sind **No-Op** (mit `console.warn`), wenn `isLocked(doc)`.
- `createDocument`: Defaults aus `DocTypeConfig` (Template, Standard-Bausteine als Text, `validUntil = date + validityDays` bei Angeboten, `dueDate = date + paymentTermDays` bei Rechnungen), `custom = defaultCustomValues(config.documentFields)`, `contactId` = Standard-Ansprechpartner des Kunden.
- `insertCatalogItem` kopiert `title, description, unitId, unitPrice ← price, taxRateId, categoryId` und eigene Felder mit gleichem Schlüssel aus `config.positionFields`; ohne `positionId` wird eine neue Position angehängt, sonst die genannte überschrieben.
- `finalizeDocument`: `checkCompliance` → bei Issues `{ ok: false, issues }`; sonst Nummer via `useSettingsStore.getState().allocateNumber(type, doc.date)`, Status `open` (bzw. `closed` bei Storno), `finalizedAt` setzen. Bei Storno zusätzlich Quell-Rechnung auf `cancelled` + `cancelledById` setzen.
- `setStatus` nur, wenn `canTransition`; `draft → open/closed` nur über `finalizeDocument` (in `setStatus` ablehnen).
- `convertTo` nutzt `convertDocument`, fügt das neue Dokument hinzu und liefert dessen `id` + `droppedFields`.
- Persistenz: `persist` mit `name: 'openbill:<store>'`, `version: 1`, `migrate: () => seed-Daten` (alter/unbekannter Stand → Demo-Daten). Actions werden nicht persistiert (`partialize`).

- [ ] **Step 1: `ids.ts` und `seed.ts`**

`src/store/ids.ts`:
```ts
export const newId = (): string => crypto.randomUUID();
```

`src/data/seed.ts` — vollständige, fiktive Demo-Daten:
```ts
import { addDays, todayIso } from '@/domain/dates';
import type { CatalogItem, Customer, DocType, DocTypeConfig, Document, FieldDef, Template, Position } from '@/domain/types';
import { builtInTemplates } from '@/templates';
import type { SettingsData } from '@/store/settingsStore';

export interface SeedData { settings: SettingsData; customers: Customer[]; catalog: CatalogItem[]; documents: Document[]; templates: Template[] }

const f = (id: string, key: string, label: string, type: FieldDef['type'], extra: Partial<FieldDef> = {}): FieldDef => ({
  id, key, label, type, required: false, defaultValue: null, help: '', options: [], ...extra,
});

const docType = (type: DocType, label: string, pattern: string, extra: Partial<DocTypeConfig> = {}): DocTypeConfig => ({
  type, label, profile: 'basic', numbering: { pattern, nextSeq: 1, resetYearly: true, lastYear: null },
  templateId: 'tpl-klar', defaultIntroBlockId: null, defaultClosingBlockId: null, paymentTermDays: null, validityDays: null,
  documentFields: [], positionFields: [], ...extra,
});

export function seed(): SeedData {
  const today = todayIso();
  const projectName = f('fd-project', 'project_name', 'Projektname', 'text');
  const phase = f('fd-phase', 'phase', 'Projektphase', 'select', { options: ['Konzeption', 'Design', 'Umsetzung', 'Betrieb'] });

  const settings: SettingsData = {
    org: {
      name: 'Studio Nordlicht', address: { street: 'Hafenweg 3', zip: '20457', city: 'Hamburg', country: 'DE' }, logo: null,
      vatId: 'DE123456789', taxNumber: '', iban: 'DE02120300000000202051', bic: 'BYLADEM1001', bankName: 'Demo Bank',
      email: 'hallo@nordlicht.example', phone: '+49 40 1234567', website: 'nordlicht.example', taxationMode: 'regular',
      custom: { register: 'Amtsgericht Hamburg HRB 000000' },
    },
    docTypes: {
      offer: docType('offer', 'Angebot', 'AN-{YYYY}-{0000}', { validityDays: 30, defaultIntroBlockId: 'tb-offer-intro', defaultClosingBlockId: 'tb-closing', documentFields: [projectName], positionFields: [phase] }),
      confirmation: docType('confirmation', 'Auftragsbestätigung', 'AB-{YYYY}-{0000}', { documentFields: [projectName], positionFields: [phase] }),
      invoice: docType('invoice', 'Rechnung', 'RE-{YYYY}-{0000}', { profile: 'en16931', paymentTermDays: 14, defaultIntroBlockId: 'tb-invoice-intro', defaultClosingBlockId: 'tb-payment', documentFields: [projectName], positionFields: [phase] }),
      cancellation: docType('cancellation', 'Storno', 'ST-{YYYY}-{0000}', { profile: 'en16931', documentFields: [projectName], positionFields: [phase] }),
    },
    taxRates: [
      { id: 'tax-19', label: '19 %', percent: 19, category: 'S', exemptionNote: null },
      { id: 'tax-7', label: '7 %', percent: 7, category: 'S', exemptionNote: null },
      { id: 'tax-0', label: '0 %', percent: 0, category: 'Z', exemptionNote: null },
    ],
    units: [
      { id: 'u-hour', name: 'Stunde', symbol: 'Std.', decimals: 2, code: 'HUR' },
      { id: 'u-day', name: 'Tag', symbol: 'Tag', decimals: 1, code: 'DAY' },
      { id: 'u-piece', name: 'Stück', symbol: 'Stk.', decimals: 0, code: 'H87' },
      { id: 'u-flat', name: 'Pauschal', symbol: 'psch.', decimals: 0, code: 'LS' },
      { id: 'u-km', name: 'Kilometer', symbol: 'km', decimals: 0, code: 'KMT' },
      { id: 'u-month', name: 'Monat', symbol: 'Mon.', decimals: 0, code: 'MON' },
    ],
    categories: [
      { id: 'cat-consulting', name: 'Beratung' },
      { id: 'cat-design', name: 'Design' },
      { id: 'cat-dev', name: 'Implementierung' },
      { id: 'cat-hosting', name: 'Hosting & Betrieb' },
    ],
    textBlocks: [
      { id: 'tb-offer-intro', name: 'Angebot – Einleitung', kind: 'intro', body: 'Hallo {{ contact.first_name }},\nvielen Dank für das nette Gespräch. Gerne biete ich Ihnen folgende Leistungen an:' },
      { id: 'tb-invoice-intro', name: 'Rechnung – Einleitung', kind: 'intro', body: 'Vielen Dank für die gute Zusammenarbeit. Ich berechne Ihnen folgende Leistungen:' },
      { id: 'tb-payment', name: 'Zahlungsbedingungen', kind: 'payment', body: 'Bitte überweisen Sie den Betrag bis zum {{ document.due_date | date }} auf das unten genannte Konto.' },
      { id: 'tb-closing', name: 'Schlusstext', kind: 'closing', body: 'Ich freue mich auf Ihre Rückmeldung.\nViele Grüße' },
    ],
    users: [
      { id: 'usr-1', name: 'Mara Lindqvist', email: 'mara@nordlicht.example', role: 'owner' },
      { id: 'usr-2', name: 'Jonas Peters', email: 'jonas@nordlicht.example', role: 'member' },
    ],
    fieldDefs: {
      org: [f('fd-register', 'register', 'Handelsregister', 'text')],
      customer: [f('fd-industry', 'industry', 'Branche', 'text')],
      contact: [f('fd-birthday', 'birthday', 'Geburtstag', 'date')],
      catalog: [f('fd-cat-phase', 'phase', 'Projektphase', 'select', { options: ['Konzeption', 'Design', 'Umsetzung', 'Betrieb'] })],
    },
  };

  const customers: Customer[] = [
    {
      id: 'cus-bohnenwerk', number: 'K-1001', name: 'Bohnenwerk Kaffeerösterei GmbH',
      address: { street: 'Röstereistraße 12', zip: '10115', city: 'Berlin', country: 'DE' }, email: 'buchhaltung@bohnenwerk.example',
      vatId: 'DE987654321', taxTreatment: 'domestic', custom: { industry: 'Gastronomie' },
      contacts: [
        { id: 'con-ida', salutation: 'Frau', firstName: 'Ida', lastName: 'Brandt', position: 'Geschäftsführerin', email: 'ida@bohnenwerk.example', phone: '', isDefault: true, custom: {} },
        { id: 'con-tom', salutation: 'Herr', firstName: 'Tom', lastName: 'Albers', position: 'Marketing', email: 'tom@bohnenwerk.example', phone: '', isDefault: false, custom: {} },
      ],
    },
    {
      id: 'cus-fjord', number: 'K-1002', name: 'Fjord Analytics AB',
      address: { street: 'Storgatan 8', zip: '111 51', city: 'Stockholm', country: 'SE' }, email: 'invoices@fjord.example',
      vatId: 'SE556677889901', taxTreatment: 'eu_reverse_charge', custom: { industry: 'Software' },
      contacts: [{ id: 'con-elin', salutation: 'Frau', firstName: 'Elin', lastName: 'Berg', position: 'CTO', email: 'elin@fjord.example', phone: '', isDefault: true, custom: {} }],
    },
    {
      id: 'cus-alpen', number: 'K-1003', name: 'Hotel Alpenglück',
      address: { street: 'Bergweg 1', zip: '87561', city: 'Oberstdorf', country: 'DE' }, email: 'info@alpenglueck.example',
      vatId: '', taxTreatment: 'domestic', custom: { industry: 'Hotellerie' },
      contacts: [{ id: 'con-max', salutation: 'Herr', firstName: 'Max', lastName: 'Huber', position: 'Inhaber', email: 'max@alpenglueck.example', phone: '', isDefault: true, custom: {} }],
    },
  ];

  const catalog: CatalogItem[] = [
    { id: 'cat-item-workshop', title: 'Workshop', description: 'Halbtägiger Workshop inkl. Vorbereitung', categoryId: 'cat-consulting', unitId: 'u-flat', price: 890, taxRateId: 'tax-19', custom: { phase: 'Konzeption' } },
    { id: 'cat-item-consulting', title: 'Beratung', description: '', categoryId: 'cat-consulting', unitId: 'u-hour', price: 110, taxRateId: 'tax-19', custom: { phase: 'Konzeption' } },
    { id: 'cat-item-design', title: 'UI-Design', description: 'Screens, Komponenten, Prototyp', categoryId: 'cat-design', unitId: 'u-hour', price: 95, taxRateId: 'tax-19', custom: { phase: 'Design' } },
    { id: 'cat-item-dev', title: 'Entwicklung', description: '', categoryId: 'cat-dev', unitId: 'u-hour', price: 95, taxRateId: 'tax-19', custom: { phase: 'Umsetzung' } },
    { id: 'cat-item-hosting', title: 'Hosting & Wartung', description: 'Server, Updates, Monitoring', categoryId: 'cat-hosting', unitId: 'u-month', price: 49, taxRateId: 'tax-19', custom: { phase: 'Betrieb' } },
  ];

  const p = (id: string, over: Partial<Position>): Position => ({
    id, kind: 'item', title: '', description: '', quantity: 1, unitId: 'u-hour', unitPrice: 95, taxRateId: 'tax-19', categoryId: null, custom: {}, ...over,
  });
  const base = { serviceDateEnd: null, contactId: null, sourceId: null, cancelledById: null, templateId: 'tpl-klar', createdAt: `${today}T08:00:00Z`, updatedAt: `${today}T08:00:00Z` };

  const documents: Document[] = [
    {
      ...base, id: 'doc-offer-1', type: 'offer', status: 'accepted', number: 'AN-2026-0001', date: addDays(today, -40), customerId: 'cus-bohnenwerk', contactId: 'con-ida',
      serviceDate: null, dueDate: null, validUntil: addDays(today, -10), intro: settings.textBlocks[0].body, closing: settings.textBlocks[3].body,
      custom: { project_name: 'Shop-Relaunch' }, finalizedAt: `${addDays(today, -40)}T09:00:00Z`,
      positions: [
        p('d1-h1', { kind: 'heading', title: 'Konzeption', quantity: 0, unitId: null, unitPrice: 0, taxRateId: null }),
        p('d1-a', { title: 'Workshop', description: 'Halbtägiger Workshop inkl. Vorbereitung', unitId: 'u-flat', unitPrice: 890, categoryId: 'cat-consulting', custom: { phase: 'Konzeption' } }),
        p('d1-h2', { kind: 'heading', title: 'Umsetzung', quantity: 0, unitId: null, unitPrice: 0, taxRateId: null }),
        p('d1-b', { title: 'UI-Design', quantity: 24, categoryId: 'cat-design', custom: { phase: 'Design' } }),
        p('d1-c', { title: 'Entwicklung', quantity: 60, categoryId: 'cat-dev', custom: { phase: 'Umsetzung' } }),
        p('d1-o', { kind: 'optional', title: 'Hosting & Wartung', unitId: 'u-month', quantity: 12, unitPrice: 49, categoryId: 'cat-hosting' }),
      ],
    },
    {
      ...base, id: 'doc-invoice-1', type: 'invoice', status: 'open', number: 'RE-2026-0001', date: addDays(today, -20), customerId: 'cus-fjord', contactId: 'con-elin',
      serviceDate: addDays(today, -22), dueDate: addDays(today, -6), validUntil: null, intro: settings.textBlocks[1].body, closing: settings.textBlocks[2].body,
      custom: { project_name: 'Dashboard-Audit' }, finalizedAt: `${addDays(today, -20)}T09:00:00Z`,
      positions: [p('d2-a', { title: 'Beratung', quantity: 16, unitPrice: 110, categoryId: 'cat-consulting' })],
    },
    {
      ...base, id: 'doc-invoice-2', type: 'invoice', status: 'paid', number: 'RE-2026-0002', date: addDays(today, -12), customerId: 'cus-alpen', contactId: 'con-max',
      serviceDate: addDays(today, -14), dueDate: addDays(today, 2), validUntil: null, intro: settings.textBlocks[1].body, closing: settings.textBlocks[2].body,
      custom: { project_name: 'Buchungsstrecke' }, finalizedAt: `${addDays(today, -12)}T09:00:00Z`,
      positions: [p('d3-a', { title: 'Entwicklung', quantity: 18, categoryId: 'cat-dev' }), p('d3-b', { title: 'Hosting & Wartung', unitId: 'u-month', quantity: 1, unitPrice: 49, categoryId: 'cat-hosting' })],
    },
    {
      ...base, id: 'doc-offer-2', type: 'offer', status: 'draft', number: null, date: today, customerId: 'cus-alpen', contactId: 'con-max',
      serviceDate: null, dueDate: null, validUntil: addDays(today, 30), intro: settings.textBlocks[0].body, closing: settings.textBlocks[3].body,
      custom: { project_name: 'Newsletter' }, finalizedAt: null,
      positions: [p('d4-a', { title: 'UI-Design', quantity: 8, categoryId: 'cat-design' })],
    },
  ];
  settings.docTypes.offer.numbering = { ...settings.docTypes.offer.numbering, nextSeq: 2, lastYear: new Date().getFullYear() };
  settings.docTypes.invoice.numbering = { ...settings.docTypes.invoice.numbering, nextSeq: 3, lastYear: new Date().getFullYear() };

  return { settings, customers, catalog, documents, templates: builtInTemplates };
}
```

- [ ] **Step 2: Stores implementieren**

`src/store/settingsStore.ts`:
```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { seed } from '@/data/seed';
import { validateFieldDef } from '@/domain/fields';
import { allocateNumber as allocate } from '@/domain/numbering';
import { isoToDate } from '@/domain/dates';
import type { Category, DocType, DocTypeConfig, FieldDef, Organization, TaxRate, TextBlock, Unit, User } from '@/domain/types';

export interface SettingsData {
  org: Organization;
  docTypes: Record<DocType, DocTypeConfig>;
  taxRates: TaxRate[];
  units: Unit[];
  categories: Category[];
  textBlocks: TextBlock[];
  users: User[];
  fieldDefs: Record<'org' | 'customer' | 'contact' | 'catalog', FieldDef[]>;
}
export type FieldTarget = { scope: 'org' | 'customer' | 'contact' | 'catalog' } | { scope: 'document' | 'position'; docType: DocType };

interface SettingsActions {
  updateOrg(patch: Partial<Organization>): void;
  updateDocType(type: DocType, patch: Partial<DocTypeConfig>): void;
  upsertFieldDef(target: FieldTarget, def: FieldDef): string[];
  removeFieldDef(target: FieldTarget, id: string): void;
  allocateNumber(type: DocType, date: string): string;
  upsertTaxRate(r: TaxRate): void; removeTaxRate(id: string): void;
  upsertUnit(u: Unit): void; removeUnit(id: string): void;
  upsertCategory(c: Category): void; removeCategory(id: string): void;
  upsertTextBlock(b: TextBlock): void; removeTextBlock(id: string): void;
  upsertUser(u: User): void; removeUser(id: string): void;
}

const upsert = <T extends { id: string }>(list: T[], item: T): T[] =>
  list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];
const without = <T extends { id: string }>(list: T[], id: string): T[] => list.filter((x) => x.id !== id);

export const useSettingsStore = create<SettingsData & SettingsActions>()(
  persist(
    (set, get) => {
      const getDefs = (t: FieldTarget): FieldDef[] =>
        t.scope === 'document' ? get().docTypes[t.docType].documentFields
        : t.scope === 'position' ? get().docTypes[t.docType].positionFields
        : get().fieldDefs[t.scope];
      const setDefs = (t: FieldTarget, defs: FieldDef[]) => {
        if (t.scope === 'document' || t.scope === 'position') {
          const key = t.scope === 'document' ? 'documentFields' : 'positionFields';
          set((s) => ({ docTypes: { ...s.docTypes, [t.docType]: { ...s.docTypes[t.docType], [key]: defs } } }));
        } else {
          set((s) => ({ fieldDefs: { ...s.fieldDefs, [t.scope]: defs } }));
        }
      };
      return {
        ...seed().settings,
        updateOrg: (patch) => set((s) => ({ org: { ...s.org, ...patch } })),
        updateDocType: (type, patch) => set((s) => ({ docTypes: { ...s.docTypes, [type]: { ...s.docTypes[type], ...patch } } })),
        upsertFieldDef: (target, def) => {
          const defs = getDefs(target);
          const errors = validateFieldDef(def, defs, target.scope);
          if (errors.length === 0) setDefs(target, upsert(defs, def));
          return errors;
        },
        removeFieldDef: (target, id) => setDefs(target, without(getDefs(target), id)),
        allocateNumber: (type, date) => {
          const { number, next } = allocate(get().docTypes[type].numbering, isoToDate(date));
          set((s) => ({ docTypes: { ...s.docTypes, [type]: { ...s.docTypes[type], numbering: next } } }));
          return number;
        },
        upsertTaxRate: (r) => set((s) => ({ taxRates: upsert(s.taxRates, r) })),
        removeTaxRate: (id) => set((s) => ({ taxRates: without(s.taxRates, id) })),
        upsertUnit: (u) => set((s) => ({ units: upsert(s.units, u) })),
        removeUnit: (id) => set((s) => ({ units: without(s.units, id) })),
        upsertCategory: (c) => set((s) => ({ categories: upsert(s.categories, c) })),
        removeCategory: (id) => set((s) => ({ categories: without(s.categories, id) })),
        upsertTextBlock: (b) => set((s) => ({ textBlocks: upsert(s.textBlocks, b) })),
        removeTextBlock: (id) => set((s) => ({ textBlocks: without(s.textBlocks, id) })),
        upsertUser: (u) => set((s) => ({ users: upsert(s.users, u) })),
        removeUser: (id) => set((s) => ({ users: without(s.users, id) })),
      };
    },
    { name: 'openbill:settings', version: 1, migrate: () => seed().settings as never },
  ),
);
```
Die Helfer `upsert`/`without` nach `src/store/listUtils.ts` auslagern und in allen Stores importieren (DRY).

`src/store/customerStore.ts`:
```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { seed } from '@/data/seed';
import type { Contact, Customer } from '@/domain/types';
import { upsert, without } from './listUtils';

interface CustomerState {
  customers: Customer[];
  upsertCustomer(c: Customer): void;
  removeCustomer(id: string): void;
  upsertContact(customerId: string, contact: Contact): void;
  removeContact(customerId: string, contactId: string): void;
  setDefaultContact(customerId: string, contactId: string): void;
}

const patchCustomer = (list: Customer[], id: string, fn: (c: Customer) => Customer) => list.map((c) => (c.id === id ? fn(c) : c));

export const useCustomerStore = create<CustomerState>()(
  persist(
    (set) => ({
      customers: seed().customers,
      upsertCustomer: (c) => set((s) => ({ customers: upsert(s.customers, c) })),
      removeCustomer: (id) => set((s) => ({ customers: without(s.customers, id) })),
      upsertContact: (customerId, contact) =>
        set((s) => ({
          customers: patchCustomer(s.customers, customerId, (c) => {
            const contacts = upsert(c.contacts, contact);
            return { ...c, contacts: contacts.some((x) => x.isDefault) ? contacts : contacts.map((x, i) => ({ ...x, isDefault: i === 0 })) };
          }),
        })),
      removeContact: (customerId, contactId) =>
        set((s) => ({
          customers: patchCustomer(s.customers, customerId, (c) => {
            const contacts = without(c.contacts, contactId);
            return { ...c, contacts: contacts.some((x) => x.isDefault) ? contacts : contacts.map((x, i) => ({ ...x, isDefault: i === 0 })) };
          }),
        })),
      setDefaultContact: (customerId, contactId) =>
        set((s) => ({ customers: patchCustomer(s.customers, customerId, (c) => ({ ...c, contacts: c.contacts.map((x) => ({ ...x, isDefault: x.id === contactId })) })) })),
    }),
    { name: 'openbill:customers', version: 1, migrate: () => ({ customers: seed().customers }) as never, partialize: (s) => ({ customers: s.customers }) },
  ),
);
```

`src/store/catalogStore.ts`:
```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { seed } from '@/data/seed';
import type { CatalogItem } from '@/domain/types';
import { upsert, without } from './listUtils';

interface CatalogState { items: CatalogItem[]; upsertItem(i: CatalogItem): void; removeItem(id: string): void }

export const useCatalogStore = create<CatalogState>()(
  persist(
    (set) => ({
      items: seed().catalog,
      upsertItem: (i) => set((s) => ({ items: upsert(s.items, i) })),
      removeItem: (id) => set((s) => ({ items: without(s.items, id) })),
    }),
    { name: 'openbill:catalog', version: 1, migrate: () => ({ items: seed().catalog }) as never, partialize: (s) => ({ items: s.items }) },
  ),
);
```

`src/store/templateStore.ts`:
```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { seed } from '@/data/seed';
import { importTemplatePackage } from '@/domain/templatePackage';
import type { Template } from '@/domain/types';
import { newId } from './ids';
import { upsert } from './listUtils';

interface TemplateState {
  templates: Template[];
  upsertTemplate(t: Template): void;
  removeTemplate(id: string): void;
  duplicateTemplate(id: string): string;
  importPackage(bytes: Uint8Array): { ok: true; id: string } | { ok: false; errors: string[] };
}

export const useTemplateStore = create<TemplateState>()(
  persist(
    (set, get) => ({
      templates: seed().templates,
      upsertTemplate: (t) => set((s) => ({ templates: upsert(s.templates, t) })),
      removeTemplate: (id) => set((s) => ({ templates: s.templates.filter((t) => t.id !== id || t.builtIn) })),
      duplicateTemplate: (id) => {
        const src = get().templates.find((t) => t.id === id);
        if (!src) throw new Error(`Template ${id} nicht gefunden`);
        const copy: Template = { ...src, id: newId(), builtIn: false, manifest: { ...src.manifest, name: `${src.manifest.name} (Kopie)` } };
        set((s) => ({ templates: [...s.templates, copy] }));
        return copy.id;
      },
      importPackage: (bytes) => {
        const r = importTemplatePackage(bytes);
        if (!r.ok) return r;
        const id = newId();
        set((s) => ({ templates: [...s.templates, { id, builtIn: false, ...r.template }] }));
        return { ok: true, id };
      },
    }),
    { name: 'openbill:templates', version: 1, migrate: () => ({ templates: seed().templates }) as never, partialize: (s) => ({ templates: s.templates }) },
  ),
);
```
Built-in-Templates im persistierten Stand werden bei jedem Laden durch die aktuelle Code-Version ersetzt: in `persist`-Options `merge: (persisted, current) => ({ ...current, templates: [...builtInTemplates, ...((persisted as { templates?: Template[] })?.templates ?? []).filter((t) => !t.builtIn)] })` (Import `builtInTemplates` aus `@/templates`).

`src/store/sessionStore.ts`:
```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'system' | 'light' | 'dark';
interface SessionState {
  user: { name: string; email: string } | null;
  theme: Theme;
  login(email: string): void;
  logout(): void;
  setTheme(t: Theme): void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      user: null,
      theme: 'system',
      login: (email) => set({ user: { name: 'Mara Lindqvist', email: email || 'mara@nordlicht.example' } }),
      logout: () => set({ user: null }),
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'openbill:session', version: 1, partialize: (s) => ({ user: s.user, theme: s.theme }) },
  ),
);
```

`src/store/documentStore.ts`:
```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { seed } from '@/data/seed';
import { checkCompliance, type ComplianceIssue } from '@/domain/compliance';
import { convertDocument } from '@/domain/convert';
import { addDays, todayIso } from '@/domain/dates';
import { defaultCustomValues } from '@/domain/fields';
import { canTransition, isLocked } from '@/domain/lifecycle';
import type { CatalogItem, DocStatus, DocType, Document, Position, PositionKind } from '@/domain/types';
import { newId } from './ids';
import { useSettingsStore } from './settingsStore';
import { useCustomerStore } from './customerStore';

interface DocumentState {
  documents: Document[];
  createDocument(type: DocType, customerId?: string | null): string;
  updateDocument(id: string, patch: Partial<Document>): void;
  addPosition(id: string, kind: PositionKind, afterIndex?: number): string;
  insertCatalogItem(id: string, item: CatalogItem, positionId?: string): void;
  updatePosition(id: string, positionId: string, patch: Partial<Position>): void;
  removePosition(id: string, positionId: string): void;
  movePosition(id: string, from: number, to: number): void;
  finalizeDocument(id: string): { ok: true } | { ok: false; issues: ComplianceIssue[] };
  setStatus(id: string, status: DocStatus): void;
  convertTo(id: string, target: DocType): { id: string; droppedFields: string[] };
  duplicateDocument(id: string): string;
  deleteDraft(id: string): void;
}

const nowIso = () => new Date().toISOString();

const emptyPosition = (kind: PositionKind): Position => ({
  id: newId(), kind, title: '', description: '', quantity: kind === 'item' || kind === 'optional' ? 1 : 0,
  unitId: kind === 'item' || kind === 'optional' ? 'u-hour' : null, unitPrice: 0,
  taxRateId: kind === 'item' || kind === 'optional' ? useSettingsStore.getState().taxRates[0]?.id ?? null : null,
  categoryId: null, custom: {},
});

export const useDocumentStore = create<DocumentState>()(
  persist(
    (set, get) => {
      const find = (id: string) => {
        const doc = get().documents.find((d) => d.id === id);
        if (!doc) throw new Error(`Dokument ${id} nicht gefunden`);
        return doc;
      };
      const replace = (doc: Document) => set((s) => ({ documents: s.documents.map((d) => (d.id === doc.id ? doc : d)) }));
      /** Ändert nur Entwürfe; abgeschlossene Dokumente bleiben unangetastet. */
      const mutateDraft = (id: string, fn: (doc: Document) => Document) => {
        const doc = find(id);
        if (isLocked(doc)) {
          console.warn(`Dokument ${doc.number} ist abgeschlossen und kann nicht geändert werden.`);
          return;
        }
        replace({ ...fn(doc), updatedAt: nowIso() });
      };

      return {
        documents: seed().documents,

        createDocument: (type, customerId = null) => {
          const settings = useSettingsStore.getState();
          const config = settings.docTypes[type];
          const block = (bid: string | null) => settings.textBlocks.find((b) => b.id === bid)?.body ?? '';
          const customer = useCustomerStore.getState().customers.find((c) => c.id === customerId);
          const date = todayIso();
          const doc: Document = {
            id: newId(), type, status: 'draft', number: null, date, customerId,
            contactId: customer?.contacts.find((c) => c.isDefault)?.id ?? null,
            serviceDate: type === 'invoice' ? date : null, serviceDateEnd: null,
            dueDate: config.paymentTermDays !== null ? addDays(date, config.paymentTermDays) : null,
            validUntil: config.validityDays !== null ? addDays(date, config.validityDays) : null,
            intro: block(config.defaultIntroBlockId), closing: block(config.defaultClosingBlockId),
            templateId: config.templateId, positions: [], custom: defaultCustomValues(config.documentFields),
            sourceId: null, cancelledById: null, finalizedAt: null, createdAt: nowIso(), updatedAt: nowIso(),
          };
          set((s) => ({ documents: [doc, ...s.documents] }));
          return doc.id;
        },

        updateDocument: (id, patch) => mutateDraft(id, (d) => ({ ...d, ...patch })),

        addPosition: (id, kind, afterIndex) => {
          const position = emptyPosition(kind);
          const config = useSettingsStore.getState().docTypes[find(id).type];
          position.custom = kind === 'item' || kind === 'optional' ? defaultCustomValues(config.positionFields) : {};
          mutateDraft(id, (d) => {
            const positions = [...d.positions];
            positions.splice(afterIndex === undefined ? positions.length : afterIndex + 1, 0, position);
            return { ...d, positions };
          });
          return position.id;
        },

        insertCatalogItem: (id, item, positionId) => {
          const config = useSettingsStore.getState().docTypes[find(id).type];
          const keys = new Set(config.positionFields.map((f) => f.key));
          const fromItem = {
            title: item.title, description: item.description, unitId: item.unitId, unitPrice: item.price,
            taxRateId: item.taxRateId, categoryId: item.categoryId,
            custom: { ...defaultCustomValues(config.positionFields), ...Object.fromEntries(Object.entries(item.custom).filter(([k]) => keys.has(k))) },
          };
          mutateDraft(id, (d) => ({
            ...d,
            positions: positionId
              ? d.positions.map((p) => (p.id === positionId ? { ...p, ...fromItem } : p))
              : [...d.positions, { ...emptyPosition('item'), ...fromItem }],
          }));
        },

        updatePosition: (id, positionId, patch) =>
          mutateDraft(id, (d) => ({ ...d, positions: d.positions.map((p) => (p.id === positionId ? { ...p, ...patch } : p)) })),

        removePosition: (id, positionId) => mutateDraft(id, (d) => ({ ...d, positions: d.positions.filter((p) => p.id !== positionId) })),

        movePosition: (id, from, to) =>
          mutateDraft(id, (d) => {
            const positions = [...d.positions];
            const [moved] = positions.splice(from, 1);
            positions.splice(to, 0, moved);
            return { ...d, positions };
          }),

        finalizeDocument: (id) => {
          const doc = find(id);
          if (doc.status !== 'draft') return { ok: true };
          const issues = checkCompliance(buildComplianceContextFor(doc));
          if (issues.length) return { ok: false, issues };
          const number = useSettingsStore.getState().allocateNumber(doc.type, doc.date);
          const finalizedAt = nowIso();
          const status: DocStatus = doc.type === 'cancellation' ? 'closed' : 'open';
          set((s) => ({
            documents: s.documents.map((d) => {
              if (d.id === id) return { ...d, number, status, finalizedAt, updatedAt: finalizedAt };
              if (doc.type === 'cancellation' && d.id === doc.sourceId) return { ...d, status: 'cancelled', cancelledById: id, updatedAt: finalizedAt };
              return d;
            }),
          }));
          return { ok: true };
        },

        setStatus: (id, status) => {
          const doc = find(id);
          if (doc.status === 'draft' || !canTransition(doc.type, doc.status, status)) {
            console.warn(`Statuswechsel ${doc.status} → ${status} nicht erlaubt.`);
            return;
          }
          replace({ ...doc, status, updatedAt: nowIso() });
        },

        convertTo: (id, target) => {
          const source = find(id);
          const { document, droppedFields } = convertDocument(source, target, {
            targetConfig: useSettingsStore.getState().docTypes[target], today: todayIso(), now: nowIso(), newId,
          });
          set((s) => ({ documents: [document, ...s.documents] }));
          return { id: document.id, droppedFields };
        },

        duplicateDocument: (id) => {
          const src = find(id);
          const copy: Document = {
            ...src, id: newId(), status: 'draft', number: null, date: todayIso(), sourceId: null, cancelledById: null, finalizedAt: null,
            positions: src.positions.map((p) => ({ ...p, id: newId() })), createdAt: nowIso(), updatedAt: nowIso(),
          };
          set((s) => ({ documents: [copy, ...s.documents] }));
          return copy.id;
        },

        deleteDraft: (id) => {
          if (isLocked(find(id))) return;
          set((s) => ({ documents: s.documents.filter((d) => d.id !== id) }));
        },
      };
    },
    { name: 'openbill:documents', version: 1, migrate: () => ({ documents: seed().documents }) as never, partialize: (s) => ({ documents: s.documents }) },
  ),
);
```
`buildComplianceContextFor` wird in `documentStore.ts` definiert und exportiert (`selectors.ts` importiert von dort — kein Zyklus). Am Ende von `documentStore.ts` ergänzen:
```ts
import type { ComplianceContext } from '@/domain/compliance';
export function buildComplianceContextFor(doc: Document): ComplianceContext {
  const s = useSettingsStore.getState();
  return {
    doc, config: s.docTypes[doc.type], org: s.org,
    customer: useCustomerStore.getState().customers.find((c) => c.id === doc.customerId) ?? null,
    units: s.units, taxRates: s.taxRates, orgFields: s.fieldDefs.org, customerFields: s.fieldDefs.customer,
  };
}
```

`src/store/selectors.ts`:
```ts
import { useMemo } from 'react';
import { checkCompliance } from '@/domain/compliance';
import type { TemplateContextInput } from '@/domain/templateContext';
import { calcTotals } from '@/domain/totals';
import { useCatalogStore } from './catalogStore';
import { useCustomerStore } from './customerStore';
import { buildComplianceContextFor, useDocumentStore } from './documentStore';
import { useSettingsStore } from './settingsStore';

export function useDocumentView(docId: string) {
  const documents = useDocumentStore((s) => s.documents);
  const customers = useCustomerStore((s) => s.customers);
  const settings = useSettingsStore();
  useCatalogStore((s) => s.items); // re-render bei Katalogänderung für Autocomplete

  return useMemo(() => {
    const doc = documents.find((d) => d.id === docId);
    if (!doc) return null;
    const config = settings.docTypes[doc.type];
    const customer = customers.find((c) => c.id === doc.customerId) ?? null;
    const contact = customer?.contacts.find((c) => c.id === doc.contactId) ?? null;
    const totals = calcTotals(doc.positions, { taxRates: settings.taxRates, taxationMode: settings.org.taxationMode, taxTreatment: customer?.taxTreatment ?? 'domestic' });
    const issues = checkCompliance(buildComplianceContextFor(doc));
    const contextInput: TemplateContextInput = {
      doc, org: settings.org, customer, contact, units: settings.units, taxRates: settings.taxRates, categories: settings.categories,
      sourceNumber: documents.find((d) => d.id === doc.sourceId)?.number ?? null,
    };
    return { doc, config, customer, contact, totals, issues, contextInput };
  }, [documents, customers, settings, docId]);
}
```

`src/store/reset.ts`:
```ts
import { seed } from '@/data/seed';
import { useCatalogStore } from './catalogStore';
import { useCustomerStore } from './customerStore';
import { useDocumentStore } from './documentStore';
import { useSettingsStore } from './settingsStore';
import { useTemplateStore } from './templateStore';

export function resetDemo(): void {
  const data = seed();
  useSettingsStore.setState(data.settings);
  useCustomerStore.setState({ customers: data.customers });
  useCatalogStore.setState({ items: data.catalog });
  useDocumentStore.setState({ documents: data.documents });
  useTemplateStore.setState({ templates: data.templates });
}
```

- [ ] **Step 3: Failing Store-Test (Durchlauf + Sperren)**

`src/store/documentStore.test.ts`:
```ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { useCatalogStore } from './catalogStore';
import { useDocumentStore } from './documentStore';
import { resetDemo } from './reset';
import { useSettingsStore } from './settingsStore';

const docs = () => useDocumentStore.getState();
const get = (id: string) => docs().documents.find((d) => d.id === id)!;

beforeEach(() => {
  localStorage.clear();
  resetDemo();
});

describe('document flow', () => {
  it('runs offer → invoice → cancellation', () => {
    const offerId = docs().createDocument('offer', 'cus-bohnenwerk');
    expect(get(offerId).contactId).toBe('con-ida');
    expect(get(offerId).intro).toContain('{{ contact.first_name }}');

    const item = useCatalogStore.getState().items.find((i) => i.id === 'cat-item-dev')!;
    docs().insertCatalogItem(offerId, item);
    expect(get(offerId).positions[0]).toMatchObject({ title: 'Entwicklung', unitPrice: 95, custom: { phase: 'Umsetzung' } });

    expect(docs().finalizeDocument(offerId)).toEqual({ ok: true });
    expect(get(offerId)).toMatchObject({ status: 'open', number: `AN-${new Date().getFullYear()}-0002` });

    docs().setStatus(offerId, 'accepted');
    const { id: invoiceId } = docs().convertTo(offerId, 'invoice');
    expect(get(invoiceId)).toMatchObject({ type: 'invoice', status: 'draft', sourceId: offerId });

    expect(docs().finalizeDocument(invoiceId)).toEqual({ ok: true });
    expect(get(invoiceId).number).toBe(`RE-${new Date().getFullYear()}-0003`);

    const { id: stornoId } = docs().convertTo(invoiceId, 'cancellation');
    expect(get(stornoId).positions[0].quantity).toBe(-1);
    expect(docs().finalizeDocument(stornoId)).toEqual({ ok: true });
    expect(get(invoiceId)).toMatchObject({ status: 'cancelled', cancelledById: stornoId });
    expect(() => docs().convertTo(invoiceId, 'cancellation')).toThrow();
  });

  it('blocks finalizing when the profile check fails', () => {
    const id = docs().createDocument('invoice', 'cus-bohnenwerk');
    docs().updateDocument(id, { serviceDate: null });
    const r = docs().finalizeDocument(id);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.map((i) => i.path)).toEqual(expect.arrayContaining(['positions', 'document.service_date']));
    expect(get(id).number).toBeNull();
  });

  it('refuses to change finalized documents', () => {
    const before = get('doc-invoice-1');
    docs().updateDocument('doc-invoice-1', { intro: 'hacked' });
    docs().addPosition('doc-invoice-1', 'item');
    docs().removePosition('doc-invoice-1', before.positions[0].id);
    docs().deleteDraft('doc-invoice-1');
    expect(get('doc-invoice-1')).toEqual(before);
  });

  it('only allows documented status changes', () => {
    docs().setStatus('doc-offer-2', 'accepted'); // draft → accepted
    expect(get('doc-offer-2').status).toBe('draft');
    docs().setStatus('doc-invoice-1', 'paid');
    expect(get('doc-invoice-1').status).toBe('paid');
  });

  it('switching to small business changes totals of drafts', () => {
    useSettingsStore.getState().updateOrg({ taxationMode: 'small_business' });
    expect(useSettingsStore.getState().org.taxationMode).toBe('small_business');
  });
});

describe('persistence', () => {
  it('falls back to seed data for an unknown stored version', async () => {
    localStorage.setItem('openbill:documents', JSON.stringify({ state: { documents: 'garbage' }, version: 0 }));
    await useDocumentStore.persist.rehydrate();
    expect(Array.isArray(docs().documents)).toBe(true);
    expect(docs().documents.length).toBeGreaterThan(0);
  });
});
```
Run: `pnpm test src/store` → Expected: zuerst FAIL (solange Stores fehlen), nach Step 2 PASS. Falls Step 2 schon erledigt ist, Test einmal mit absichtlich falscher Erwartung laufen lassen ist nicht nötig — direkt grün prüfen.

Hinweis zum `small_business`-Test: Er prüft nur den Settings-Wechsel; die Auswirkung auf Summen ist durch `totals.test.ts` abgedeckt und wird in Task 17 per E2E im UI geprüft. Die Invoice im Durchlauf bekommt ihr Leistungsdatum aus `convertDocument` (heute, weil das Angebot keins hat) — sonst würde das EN-16931-Profil das Abschließen blockieren.

- [ ] **Step 4: Tests + Typecheck**

Run: `pnpm test && pnpm typecheck` → Expected: PASS, keine TS-Fehler.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(store): add demo seed and Zustand stores with persistence

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Designsystem, App-Shell und Login

**Vorher:** Skill `frontend-design:frontend-design` laden. Richtung laut Spec 3.4 („Papier & Präzision“). Die Start-Tokens aus Task 1 dürfen verfeinert werden (Farben, Schatten, Radien, Typo-Skala), Namen der Tokens (`paper, sheet, ink, muted, line, accent, accent-ink, ok, warn, danger`, `font-display/sans/mono`) bleiben stabil.

**Files:**
- Modify: `src/styles/app.css`, `src/App.tsx`, `src/main.tsx`
- Create: `src/ui/Button.tsx`, `Input.tsx`, `Textarea.tsx`, `Select.tsx`, `Checkbox.tsx`, `Badge.tsx`, `StatusBadge.tsx`, `Card.tsx`, `Dialog.tsx`, `Tabs.tsx`, `Table.tsx`, `EmptyState.tsx`, `PageHeader.tsx`, `Toast.tsx`, `src/layout/AppShell.tsx`, `Sidebar.tsx`, `RequireAuth.tsx`, `ThemeToggle.tsx`, `src/features/auth/LoginPage.tsx`, Platzhalter-Seiten für alle Routen (werden in 12–17 ersetzt), `playwright.config.ts`, `e2e/shell.spec.ts`

**Interfaces:**
- Consumes: `useSessionStore`, `resetDemo`.
- Produces (Props verbindlich für Folge-Tasks):
  - `Button({ variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md'; icon?: ReactNode; ...ButtonHTMLAttributes })`
  - `Input`, `Textarea`, `Select` (native `<select>`), `Checkbox`: jeweils `{ label?: string; hint?: string; error?: string; mono?: boolean } & native props`; mit `forwardRef`
  - `Badge({ tone?: 'neutral' | 'accent' | 'ok' | 'warn' | 'danger'; children })`
  - `StatusBadge({ status: DocStatus; overdue?: boolean })`
  - `Card({ title?: string; actions?: ReactNode; children; className? })`
  - `Dialog({ open: boolean; onClose(): void; title: string; children; footer?: ReactNode })` — natives `<dialog>` mit `showModal()`
  - `Tabs({ tabs: { id: string; label: string; badge?: ReactNode }[]; value: string; onChange(id: string): void })`
  - `Table` = gestylte `<table>`-Wrapper (`Table`, `Th`, `Td`, `Tr`)
  - `EmptyState({ title: string; text?: string; action?: ReactNode })`
  - `PageHeader({ eyebrow?: string; title: string; actions?: ReactNode })`
  - `useToast(): (message: string, tone?: 'ok' | 'warn' | 'danger') => void` + `<ToastHost />`
  - Routen (in `App.tsx`): `/login`, `/` (Übersicht), `/documents`, `/documents/:id`, `/customers`, `/customers/:id`, `/catalog`, `/templates`, `/templates/:id`, `/settings/*` (`organization`, `document-types/:type`, `fields`, `taxes`, `units`, `categories`, `text-blocks`, `users`)
  - Theme: `data-theme` auf `<html>`, gesetzt in `ThemeToggle`/`AppShell` aus `useSessionStore.theme` (`system` → `matchMedia('(prefers-color-scheme: dark)')`)

- [ ] **Step 1: Playwright einrichten und Shell-Test schreiben (failing)**

```bash
pnpm exec playwright install chromium
```
`playwright.config.ts`:
```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:5173', viewport: { width: 1440, height: 900 } },
  webServer: { command: 'pnpm dev --port 5173 --strictPort', url: 'http://localhost:5173', reuseExistingServer: true },
});
```
`e2e/shell.spec.ts`:
```ts
import { expect, test } from '@playwright/test';

test('login leads into the app and navigation works', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('E-Mail').fill('mara@nordlicht.example');
  await page.getByLabel('Passwort').fill('egal');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page).toHaveURL('http://localhost:5173/');
  for (const name of ['Dokumente', 'Kunden', 'Katalog', 'Templates', 'Einstellungen']) {
    await page.getByRole('navigation').getByRole('link', { name }).click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
});

test('theme toggle switches to dark', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-Mail').fill('a@b.c');
  await page.getByLabel('Passwort').fill('x');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await page.getByRole('button', { name: 'Dunkles Design' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
```
Run: `pnpm e2e` → Expected: FAIL.

- [ ] **Step 2: UI-Primitives bauen**

Alle Komponenten aus „Produces“ mit Tailwind-Klassen auf Basis der Tokens. Vorgaben:
- Fokus-Ringe sichtbar (`focus-visible:outline-2 outline-accent outline-offset-2`), alle Inputs mit `<label htmlFor>` (Playwright nutzt `getByLabel`).
- Zahlen/Nummern/Feldschlüssel mit `font-mono` und `tabular-nums`.
- `Dialog` schließt mit Esc und Klick auf Backdrop.
- Keine Animationen über 200 ms; `prefers-reduced-motion` respektieren.

Beispiel `src/ui/Button.tsx` als Muster für den Stil der Primitives:
```tsx
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:brightness-95',
  secondary: 'bg-sheet text-ink border border-line hover:border-ink/30',
  ghost: 'text-ink hover:bg-ink/5',
  danger: 'bg-danger text-white hover:brightness-95',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; size?: 'sm' | 'md'; icon?: ReactNode }

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'secondary', size = 'md', icon, className = '', children, ...rest }, ref,
) {
  const sizing = size === 'sm' ? 'h-8 px-3 text-sm gap-1.5' : 'h-10 px-4 text-sm gap-2';
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${sizing} ${variants[variant]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
});
```

- [ ] **Step 3: App-Shell, Routing, Login**

- `RequireAuth`: leitet ohne `user` auf `/login` um.
- `AppShell`: linke Sidebar (Logo-Wortmarke „openbill“ in `font-display`, Navigation Übersicht/Dokumente/Kunden/Katalog/Templates/Einstellungen mit lucide-Icons, unten Benutzer, `ThemeToggle` mit Buttons `aria-label` „Helles Design“/„Dunkles Design“/„Systemeinstellung“, Link „Demo-Daten zurücksetzen“ mit Bestätigungsdialog → `resetDemo()`), Hauptbereich mit `<Outlet />`.
- Jede Seite rendert genau ein `<h1>` über `PageHeader`.
- `LoginPage`: eigenständig gestaltet — zweigeteilt: links Formular (E-Mail, Passwort, „Anmelden“), rechts eine typografische Komposition aus „Blättern“ (gestapelte, leicht versetzte Dokumentkarten in CSS mit echten Beispiel-Zahlen in `font-mono`, z. B. `RE-2026-0001 · 1.130,50 €`). Kein Stockfoto, keine Illustrationen-Library. Jede Eingabe führt rein (`login(email)` → `navigate('/')`).
- Platzhalter-Seiten (`PageHeader` mit Titel) für alle übrigen Routen, damit der Shell-Test grün wird.

- [ ] **Step 4: Verifizieren**

Run: `pnpm e2e && pnpm build` → Expected: PASS.
Screenshots von Login und Shell in Light + Dark ansehen (`page.screenshot` ad hoc oder Playwright-Trace) und gegen Spec 3.4 prüfen: ruhig, eigenständig, nicht verspielt, nicht bieder.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ui): add design system, app shell and login

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Übersicht und Dokumentliste

**Vorher:** `frontend-design:frontend-design` laden.

**Files:**
- Create: `src/features/dashboard/DashboardPage.tsx`, `src/features/documents/DocumentListPage.tsx`, `src/features/documents/NewDocumentDialog.tsx`, `e2e/documents-list.spec.ts`
- Modify: `src/App.tsx` (Platzhalter ersetzen)

**Interfaces:**
- Consumes: `useDocumentStore`, `useCustomerStore`, `useSettingsStore`, `calcTotals`, `isOverdue`, `STATUS_LABELS`, `DOC_TYPE_LABELS`, `formatMoney`, `formatDate`, `todayIso`, UI-Primitives.
- Produces: `NewDocumentDialog({ open: boolean; onClose(): void; defaultType?: DocType })` → nach „Anlegen“ `createDocument(type, customerId)` und `navigate('/documents/' + id)`.

Verhalten:
- **Übersicht:** Kennzahlen-Kacheln: „Offene Rechnungen“ (Summe brutto, Anzahl), „Überfällig“ (Summe, Anzahl, `danger`-Ton), „Offene Angebote“ (Summe, Anzahl), „Bezahlt (30 Tage)“. Liste „Zuletzt bearbeitet“ (5 Dokumente nach `updatedAt`). Primäraktion „Neues Dokument“.
- **Dokumentliste:** Tabs je Typ + „Alle“ (mit Anzahl), Filter Status (Select) und Kunde (Select), Suche (Nummer, Kunde, `project_name`). Spalten: Nummer (mono; Entwurf kursiv „Entwurf“), Typ, Kunde, Datum, Fällig/Gültig bis, Betrag brutto (rechtsbündig, mono), Status (`StatusBadge` mit `overdue`). Zeilen klickbar → Editor. Leerzustand mit `EmptyState`.

- [ ] **Step 1: Failing E2E**

`e2e/documents-list.spec.ts`:
```ts
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/login');
  await page.getByLabel('E-Mail').fill('a@b.c');
  await page.getByLabel('Passwort').fill('x');
  await page.getByRole('button', { name: 'Anmelden' }).click();
});

test('dashboard shows overdue invoice', async ({ page }) => {
  await expect(page.getByText('Überfällig')).toBeVisible();
  await expect(page.getByTestId('kpi-overdue')).toContainText('1');
});

test('list filters by type and search', async ({ page }) => {
  await page.getByRole('navigation').getByRole('link', { name: 'Dokumente' }).click();
  await page.getByRole('tab', { name: /Rechnung/ }).click();
  await expect(page.getByRole('row')).toHaveCount(3); // Kopf + 2 Rechnungen
  await page.getByLabel('Suche').fill('Buchungsstrecke');
  await expect(page.getByRole('row')).toHaveCount(2);
  await expect(page.getByText('überfällig', { exact: false })).toHaveCount(0);
});

test('new document dialog creates a draft', async ({ page }) => {
  await page.getByRole('button', { name: 'Neues Dokument' }).click();
  await page.getByLabel('Dokumenttyp').selectOption('offer');
  await page.getByLabel('Kunde').selectOption('cus-fjord');
  await page.getByRole('button', { name: 'Anlegen' }).click();
  await expect(page).toHaveURL(/\/documents\/.+/);
});
```
Run: `pnpm e2e e2e/documents-list.spec.ts` → Expected: FAIL.

- [ ] **Step 2: Implementieren** gemäß Verhalten oben. KPI-Kacheln bekommen `data-testid="kpi-open" | "kpi-overdue" | "kpi-offers" | "kpi-paid"`. Beträge je Dokument über `calcTotals(doc.positions, { taxRates, taxationMode: org.taxationMode, taxTreatment: customer?.taxTreatment ?? 'domestic' }).gross` — als Helper `documentGross(doc, settings, customers)` in `src/store/selectors.ts` ergänzen und dort exportieren.

- [ ] **Step 3: Verifizieren**

Run: `pnpm e2e && pnpm test && pnpm build` → Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(ui): add dashboard, document list and new document dialog

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Dokument-Editor — Felder, Positionen, Texte, Summen

**Vorher:** `frontend-design:frontend-design` laden.

**Files:**
- Create: `src/features/documents/DocumentEditorPage.tsx`, `DocumentHeaderFields.tsx`, `PositionsTable.tsx`, `PositionRow.tsx`, `CatalogAutocomplete.tsx`, `TextsSection.tsx`, `TotalsPanel.tsx`, `src/ui/CustomFieldInput.tsx`, `e2e/editor.spec.ts`

**Interfaces:**
- Consumes: `useDocumentView(id)`, `useDocumentStore`-Aktionen, `useCatalogStore`, `useSettingsStore` (units, taxRates, categories, textBlocks, org), `isLocked`, `formatMoney`.
- Produces:
  - `CustomFieldInput({ def: FieldDef; value: FieldValue; onChange(v: FieldValue): void; disabled?: boolean; id: string; error?: string })` — rendert je `FieldType`: text → Input, textarea → Textarea, number/money → Input `type="number"` (`step` 0.01 bei money), date → Input `type="date"`, select → Select mit Optionen, boolean → Checkbox, image → Datei-Input → Data-URL + Vorschau.
  - Elemente mit `id` gemäß Compliance-Pfad (`field-document.service_date`, `field-positions.<id>.title` …), damit Task 14 per `document.getElementById` hinspringen kann. Helper: `fieldDomId(path: string) => 'field-' + path`.

Layout: zweispaltig — links Editor (scrollend), rechts Vorschau-Spalte (in Task 14 befüllt; hier leerer Platzhalter `<aside data-testid="preview-pane" />`).

Verhalten:
- **Kopf:** Typ-Eyebrow, Nummer bzw. „Entwurf“, `StatusBadge`. Bei gesperrten Dokumenten: Hinweisbanner „Abgeschlossen am … — Änderungen nur über Storno“ (bei Rechnungen) bzw. „… — nicht mehr änderbar“, alle Eingaben `disabled`.
- **Kopffelder:** Kunde (Select), Ansprechpartner (Select der Kontakte des Kunden; bei Kundenwechsel auf Standard setzen), Datum, typabhängig Gültig bis (Angebot), Leistungsdatum/-ende, Fällig am (Rechnung), Template (Select aus `templateStore`, gefiltert nach `manifest.documentTypes`). Darunter eigene Dokumentfelder per `CustomFieldInput`; Pflichtfelder mit Sternchen, Profilfelder mit `Badge tone="accent"` „E-Rechnung“ (aus `PROFILE_REQUIREMENTS`).
- **Positionen:** Tabelle mit Drag-Handle (@dnd-kit/sortable, `movePosition`), Spalten Pos., Bezeichnung + Beschreibung (aufklappbar), Menge, Einheit (Select), Einzelpreis, Steuer (Select; bei Kleinunternehmer ersetzt durch Text „§ 19“; bei Reverse Charge „RC“), Gesamt, Menü (Löschen, Darunter einfügen). Überschrift- und Textzeilen über volle Breite mit eigenem Stil, optionale Positionen gedimmt mit Badge „optional“ (nur bei Angeboten anlegbar). Eigene Positionsfelder in einer aufklappbaren Zeile unter der Position.
- **Katalog-Autocomplete:** Im Bezeichnungsfeld ab 1 Zeichen Vorschlagsliste (Katalog, gruppiert nach Kategorie, Preis + Einheit rechts, Tastatur ↑↓ Enter Esc). Auswahl → `insertCatalogItem(docId, item, positionId)`. Freitext bleibt möglich.
- **Hinzufügen-Leiste:** „Leistung“, „Aus Katalog …“ (öffnet Dialog mit Suche + Mehrfachauswahl), „Überschrift“, „Textzeile“, „Optional“ (nur Angebot).
- **Texte:** Kopftext und Fußtext als Textarea mit Button „Baustein einfügen“ (Popover-Liste der `textBlocks`, Einfügen an Cursorposition). Hinweis „Liquid-Platzhalter wie {{ contact.first_name }} werden in der Vorschau ersetzt.“
- **Summen-Panel:** Netto, je Steuersatz „USt. 19 % auf …“, Gesamt, optionale Summe separat, gesetzliche Hinweise als kleine Notiz darunter.

- [ ] **Step 1: Failing E2E**

`e2e/editor.spec.ts`:
```ts
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/login');
  await page.getByLabel('E-Mail').fill('a@b.c');
  await page.getByLabel('Passwort').fill('x');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await page.goto('/documents/doc-offer-2');
});

test('catalog autocomplete fills a position and totals update', async ({ page }) => {
  await page.getByRole('button', { name: 'Leistung' }).click();
  const title = page.getByLabel('Bezeichnung').last();
  await title.fill('Work');
  await page.getByRole('option', { name: /Workshop/ }).click();
  await expect(page.getByTestId('total-gross')).toContainText('1.963,50'); // (8×95 + 890) × 1,19
});

test('optional positions do not count', async ({ page }) => {
  await page.getByRole('button', { name: 'Optional' }).click();
  await page.getByLabel('Bezeichnung').last().fill('Extra');
  await page.getByLabel('Einzelpreis').last().fill('500');
  await expect(page.getByTestId('total-gross')).toContainText('904,40'); // 8×95×1,19
  await expect(page.getByTestId('total-optional')).toContainText('500,00');
});

test('finalized documents are read-only', async ({ page }) => {
  await page.goto('/documents/doc-invoice-1');
  await expect(page.getByText(/nicht mehr änderbar|nur über Storno/)).toBeVisible();
  await expect(page.getByLabel('Bezeichnung').first()).toBeDisabled();
});

test('changing customer selects their default contact', async ({ page }) => {
  await page.getByLabel('Kunde').selectOption('cus-bohnenwerk');
  await expect(page.getByLabel('Ansprechpartner')).toHaveValue('con-ida');
});
```
Run: `pnpm e2e e2e/editor.spec.ts` → Expected: FAIL.

- [ ] **Step 2: Implementieren** gemäß Verhalten. Summen-Elemente: `data-testid="total-net" | "total-gross" | "total-optional"`. Eingaben für Zahlen akzeptieren Komma und Punkt (`parseFloat(v.replace(',', '.'))`, leere Eingabe → 0).

- [ ] **Step 3: Verifizieren**

Run: `pnpm e2e && pnpm test && pnpm build` → Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(ui): add document editor with positions, catalog autocomplete and totals

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Dokument-Editor — Vorschau, Prüfanzeige, Aktionen, Kette, E-Rechnung

**Vorher:** `frontend-design:frontend-design` laden.

**Files:**
- Create: `src/ui/SheetPreview.tsx`, `src/features/documents/DocumentPreviewPane.tsx`, `CompliancePanel.tsx`, `DocumentActions.tsx`, `DocumentChain.tsx`, `EInvoiceTab.tsx`, `e2e/editor-actions.spec.ts`
- Modify: `src/features/documents/DocumentEditorPage.tsx`

**Interfaces:**
- Consumes: `useDocumentView`, `createLiquid`, `renderDocument`, `buildTemplateContext`, `generateCiiXml`, `useTemplateStore`, `useDocumentStore` (`finalizeDocument`, `setStatus`, `convertTo`, `duplicateDocument`, `deleteDraft`), `nextStatuses`, `canConvert`, `CONVERSIONS`, `fieldDomId`, `useToast`.
- Produces: `SheetPreview({ html: string; className?: string })` — `<iframe sandbox="" srcDoc={html}>` (ohne `allow-scripts`), skaliert die A4-Seite per `ResizeObserver` auf die Containerbreite (`transform: scale(containerWidth / 794)`), Höhe proportional. Wird in Task 16 wiederverwendet.

Verhalten:
- **Vorschau-Spalte:** Tabs „Vorschau“ und (bei Profil `en16931`) „E-Rechnung“. Vorschau rendert über `renderDocument` (Engine einmal per `useMemo`), debounced 150 ms, zeigt bei `error` ein rotes Banner über der Vorschau. Über der Vorschau: Button „PDF herunterladen“ → Toast „Im Klickdummy nicht verfügbar — in der echten App rendert Gotenberg das PDF.“ und „Drucken“ (öffnet `iframe.contentWindow.print()` — erlaubt, weil kein Script im iframe nötig ist; wenn durch `sandbox` blockiert, Button weglassen).
- **E-Rechnung-Tab:** XML aus `generateCiiXml(buildTemplateContext(contextInput))` in einem `<pre>` mit `font-mono`, Button „XML kopieren“; Hinweis „Vereinfachte Vorschau. Die echte App erzeugt ZUGFeRD (PDF/A-3 mit eingebetteter XML) und validiert gegen EN 16931.“
- **Prüfanzeige (`CompliancePanel`):** Kopfzeile mit Profilname und Zustand: grün „Bereit zum Abschließen“ oder `warn` „N Angaben fehlen“. Liste der Issues; Klick springt zum Feld (`document.getElementById(fieldDomId(path))?.focus()` + `scrollIntoView`). Issues mit Pfad `org.*` verlinken auf `/settings/organization`, `customer.*` auf `/customers/:customerId`.
- **Aktionen (`DocumentActions`)** je nach Status:
  - Entwurf: „Abschließen“ (primär; disabled, solange Issues; Bestätigungsdialog „Nummer wird vergeben, danach nicht mehr änderbar.“), „Duplizieren“, „Löschen“ (Bestätigung → zurück zur Liste).
  - Abgeschlossen: Statuswechsel-Buttons aus `nextStatuses` (z. B. „Als angenommen markieren“, „Als bezahlt markieren“), Umwandeln-Buttons aus `CONVERSIONS` gefiltert durch `canConvert` („In Auftragsbestätigung umwandeln“, „In Rechnung umwandeln“, „Stornieren“). Nach Umwandeln: Navigation zum neuen Dokument; wenn `droppedFields` nicht leer, Toast `warn` „Nicht übernommen: …“.
  - Immer: „Duplizieren“.
- **Kette (`DocumentChain`):** kleine Zeitleiste: Quelle (rekursiv über `sourceId`), aktuelles Dokument, Folgedokumente (alle mit `sourceId === doc.id`), Storno (`cancelledById`). Jeder Eintrag verlinkt.

- [ ] **Step 1: Failing E2E**

`e2e/editor-actions.spec.ts`:
```ts
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/login');
  await page.getByLabel('E-Mail').fill('a@b.c');
  await page.getByLabel('Passwort').fill('x');
  await page.getByRole('button', { name: 'Anmelden' }).click();
});

test('preview renders liquid with contact name', async ({ page }) => {
  await page.goto('/documents/doc-offer-2');
  const frame = page.frameLocator('iframe[title="Dokumentvorschau"]');
  await expect(frame.getByText('Hallo Max,')).toBeVisible();
});

test('finalize offer, accept and convert to invoice', async ({ page }) => {
  await page.goto('/documents/doc-offer-2');
  await page.getByRole('button', { name: 'Abschließen' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Abschließen' }).click();
  await expect(page.getByText(/AN-\d{4}-0002/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Als angenommen markieren' }).click();
  await page.getByRole('button', { name: 'In Rechnung umwandeln' }).click();
  await expect(page.getByText('Rechnung').first()).toBeVisible();
  await expect(page.getByTestId('document-chain')).toContainText(/AN-\d{4}-0002/);
});

test('compliance panel blocks finalize and jumps to field', async ({ page }) => {
  await page.goto('/documents');
  await page.getByRole('button', { name: 'Neues Dokument' }).click();
  await page.getByLabel('Dokumenttyp').selectOption('invoice');
  await page.getByLabel('Kunde').selectOption('cus-bohnenwerk');
  await page.getByRole('button', { name: 'Anlegen' }).click();
  await expect(page.getByTestId('compliance')).toContainText('Angaben fehlen');
  await expect(page.getByRole('button', { name: 'Abschließen' })).toBeDisabled();
  await page.getByTestId('compliance').getByRole('button', { name: /Leistungsposition/ }).click();
});

test('e-invoice tab shows XML', async ({ page }) => {
  await page.goto('/documents/doc-invoice-1');
  await page.getByRole('tab', { name: 'E-Rechnung' }).click();
  await expect(page.getByText('<ram:CategoryCode>AE</ram:CategoryCode>')).toBeVisible();
});
```
Run: `pnpm e2e e2e/editor-actions.spec.ts` → Expected: FAIL.

- [ ] **Step 2: Implementieren** gemäß Verhalten. `SheetPreview` setzt `title="Dokumentvorschau"` (bzw. per Prop `title`). Kette mit `data-testid="document-chain"`, Prüfanzeige mit `data-testid="compliance"`, Issues als `<button>`.

- [ ] **Step 3: Verifizieren**

Run: `pnpm e2e && pnpm test && pnpm build` → Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(ui): add live preview, compliance panel, actions and document chain

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Kunden und Katalog

**Vorher:** `frontend-design:frontend-design` laden.

**Files:**
- Create: `src/features/customers/CustomerListPage.tsx`, `CustomerDetailPage.tsx`, `ContactsEditor.tsx`, `src/features/catalog/CatalogPage.tsx`, `CatalogItemDialog.tsx`, `e2e/customers-catalog.spec.ts`

**Interfaces:**
- Consumes: `useCustomerStore`, `useCatalogStore`, `useSettingsStore` (fieldDefs, units, taxRates, categories), `useDocumentStore` (Dokumente des Kunden), `CustomFieldInput`, `newId`, `documentGross`.

Verhalten:
- **Kundenliste:** Tabelle (Nr. mono, Name, Ort, Steuerbehandlung als Badge „Inland“/„EU · Reverse Charge“/„Drittland“, offene Summe), Suche, „Neuer Kunde“ (legt leeren Kunden mit nächster Nummer `K-<max+1>` an und öffnet Detail).
- **Kundendetail:** Abschnitte Stammdaten (Kern), Steuerbehandlung (Radio mit Erklärungstext), eigene Felder (`fieldDefs.customer`), Ansprechpartner (`ContactsEditor`: Karten je Kontakt, Standard-Stern, Hinzufügen/Bearbeiten in `Dialog`, eigene Felder `fieldDefs.contact`), Dokumente des Kunden (Liste wie in Task 12, gefiltert). Speichern automatisch bei Änderung (onBlur/onChange → `upsertCustomer`). Löschen nur, wenn keine Dokumente existieren (sonst Button disabled mit Tooltip).
- Felder mit DOM-IDs `field-customer.address`, `field-customer.vat_id` für Sprünge aus der Prüfanzeige (Task 14 verlinkt auf `/customers/:id#field-customer.vat_id` — Seite fokussiert bei Hash das Element).
- **Katalog:** Gruppiert nach Kategorie (Abschnitte), Suche, Karten oder Tabelle (Bezeichnung, Einheit, Preis mono, Steuer, eigene Felder als kleine Chips). „Neuer Eintrag“ / Klick → `CatalogItemDialog` mit Kern + eigenen Feldern (`fieldDefs.catalog`). Löschen mit Bestätigung (bestehende Positionen sind Kopien und bleiben unberührt — Hinweis im Dialog).

- [ ] **Step 1: Failing E2E**

`e2e/customers-catalog.spec.ts`:
```ts
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/login');
  await page.getByLabel('E-Mail').fill('a@b.c');
  await page.getByLabel('Passwort').fill('x');
  await page.getByRole('button', { name: 'Anmelden' }).click();
});

test('add a contact and make it default', async ({ page }) => {
  await page.goto('/customers/cus-alpen');
  await page.getByRole('button', { name: 'Ansprechpartner hinzufügen' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Vorname').fill('Lena');
  await dialog.getByLabel('Nachname').fill('Moser');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await page.getByRole('button', { name: 'Lena Moser als Standard setzen' }).click();
  await expect(page.getByTestId('contact-default')).toContainText('Lena Moser');
});

test('customer with documents cannot be deleted', async ({ page }) => {
  await page.goto('/customers/cus-fjord');
  await expect(page.getByRole('button', { name: 'Kunde löschen' })).toBeDisabled();
});

test('create catalog item and use it in a document', async ({ page }) => {
  await page.goto('/catalog');
  await page.getByRole('button', { name: 'Neuer Eintrag' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Bezeichnung').fill('Fotoshooting');
  await dialog.getByLabel('Preis').fill('650');
  await dialog.getByLabel('Einheit').selectOption('u-flat');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Fotoshooting')).toBeVisible();
  await page.goto('/documents/doc-offer-2');
  await page.getByRole('button', { name: 'Leistung' }).click();
  await page.getByLabel('Bezeichnung').last().fill('Foto');
  await expect(page.getByRole('option', { name: /Fotoshooting/ })).toBeVisible();
});
```
Run: `pnpm e2e e2e/customers-catalog.spec.ts` → Expected: FAIL.

- [ ] **Step 2: Implementieren** gemäß Verhalten.

- [ ] **Step 3: Verifizieren**

Run: `pnpm e2e && pnpm test && pnpm build` → Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(ui): add customers with contacts and catalog

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Templates — Galerie, Editor, Import/Export, weitere Standard-Templates

**Vorher:** `frontend-design:frontend-design` laden (auch für die Gestaltung der Templates „Kante“ und „Leise“).

**Files:**
- Create: `src/templates/kante/{template.liquid,styles.css,manifest.json}`, `src/templates/leise/{template.liquid,styles.css,manifest.json}`, `src/ui/CodeEditor.tsx`, `src/features/templates/TemplateGalleryPage.tsx`, `TemplateEditorPage.tsx`, `FieldReference.tsx`, `ManifestForm.tsx`, `e2e/templates.spec.ts`
- Modify: `src/templates/index.ts`, `src/domain/liquid.test.ts` (Smoke-Test für alle Built-ins)

**Interfaces:**
- Consumes: `useTemplateStore`, `useDocumentStore` (Beispieldokument-Auswahl), `buildTemplateContext`, `renderDocument`, `createLiquid`, `exportTemplatePackage`, `SheetPreview`, `useSettingsStore` (Felddefinitionen für die Referenz), `RESERVED_KEYS`.
- Produces: `CodeEditor({ value: string; onChange(v: string): void; language: 'liquid' | 'css'; readOnly?: boolean; ariaLabel: string })` — CodeMirror 6 (`EditorView`, `basicSetup` aus `codemirror`, `liquid()` aus `@codemirror/lang-liquid`, CSS via `@codemirror/lang-css` — Paket ergänzen: `pnpm add @codemirror/lang-css`), Theme aus Tokens (Light/Dark).

Neue Built-in-Templates (gleicher Kontext-Vertrag wie „Klar“, alle Dokumenttypen, müssen Überschriften/Textzeilen/optionale Positionen, Steueraufschlüsselung, `legal_notes`, Kopf-/Fußtext und Logo-Fallback darstellen):
- **„Kante“:** markant — großer Typ-Titel in einem kräftigen Farbblock oben, Nummer und Betrag groß, Tabelle mit starken Linien.
- **„Leise“:** minimal — viel Weißraum, serifenbetonte Typografie, Haarlinien, Summen dezent rechts.
IDs `tpl-kante`, `tpl-leise`; in `builtInTemplates` ergänzen.

Verhalten:
- **Galerie:** Karten mit Live-Miniatur (`SheetPreview` mit Beispieldokument `doc-offer-1`), Name, Autor, Version, Typen-Badges, Badge „Mitgeliefert“. Aktionen: Öffnen, Duplizieren, Exportieren (ZIP-Download `<name>-<version>.zip`), Löschen (nur eigene). „Template importieren“ (Datei-Input `.zip` → `importPackage`; Fehlerliste im Dialog). „Neues Template“ = Duplikat von „Klar“.
- **Editor:** dreispaltig — links `FieldReference` (Gruppen `org`, `customer`, `contact`, `document`, `positions[]`, `groups[]`, Filter; Kernfelder aus `RESERVED_KEYS`, eigene Felder aus Settings/DocTypes mit Typ-Badge; Klick fügt `{{ document.project_name }}` bzw. innerhalb einer Schleife `{{ p.key }}` an Cursor ein; Filter-Spickzettel `money`, `date`, `number`, `nl2br`), Mitte Tabs „Template“ / „CSS“ / „Manifest“ (`ManifestForm`), rechts Live-Vorschau mit Auswahl des Beispieldokuments (Select aller Dokumente) und Fehlerbanner bei Liquid-Fehlern. Built-in-Templates sind schreibgeschützt mit Banner „Mitgeliefertes Template — zum Bearbeiten duplizieren“ + Button.
- **Erwartete Felder:** Im Manifest-Tab Liste `expectedFields`; die Galerie zeigt pro Template einen Hinweis „2 erwartete Felder fehlen“ (Abgleich gegen die Felddefinitionen der unterstützten Dokumenttypen), Detail-Tooltip mit den Schlüsseln.
- Dokumenttyp-Einstellungen (Task 17) und Dokument-Editor nutzen die Templates aus dem Store.

- [ ] **Step 1: Failing Tests**

In `src/domain/liquid.test.ts` den Built-in-Smoke-Test aus Task 8 auf alle drei Ordner (`klar`, `kante`, `leise`) parametrisieren (`it.each`), Manifest jeweils aus `manifest.json` lesen und durch `validateManifest` prüfen (`errors` leer).

`e2e/templates.spec.ts`:
```ts
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/login');
  await page.getByLabel('E-Mail').fill('a@b.c');
  await page.getByLabel('Passwort').fill('x');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await page.goto('/templates');
});

test('gallery lists built-in templates', async ({ page }) => {
  for (const name of ['Klar', 'Kante', 'Leise']) await expect(page.getByRole('heading', { name })).toBeVisible();
});

test('duplicate, edit and see live preview incl. syntax error', async ({ page }) => {
  await page.getByRole('article', { name: 'Klar' }).getByRole('button', { name: 'Duplizieren' }).click();
  await expect(page).toHaveURL(/\/templates\/.+/);
  const editor = page.getByRole('textbox', { name: 'Template-Code' });
  await editor.click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type('<p id="marker">Projekt: {{ document.project_name }}</p>');
  const frame = page.frameLocator('iframe[title="Dokumentvorschau"]');
  await expect(frame.locator('#marker')).toContainText('Projekt:');
  await page.keyboard.type('{% if %}');
  await expect(page.getByText('Template-Fehler')).toBeVisible();
});

test('importing an invalid file shows errors', async ({ page }) => {
  await page.getByRole('button', { name: 'Template importieren' }).click();
  await page.getByLabel('ZIP-Datei').setInputFiles({ name: 'x.zip', mimeType: 'application/zip', buffer: Buffer.from('nope') });
  await expect(page.getByText('Datei ist kein gültiges ZIP-Archiv.')).toBeVisible();
});
```
Run: `pnpm test && pnpm e2e e2e/templates.spec.ts` → Expected: FAIL.

- [ ] **Step 2: Implementieren** gemäß Verhalten. Template-Karten als `<article aria-label={name}>`, Titel als `<h2>`/`<h3>`.

- [ ] **Step 3: Verifizieren**

Run: `pnpm e2e && pnpm test && pnpm build` → Expected: PASS. Alle drei Templates mit `doc-offer-1` (Gruppen + optional) und `doc-invoice-1` (Reverse Charge) visuell prüfen.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(ui): add template gallery, Liquid editor with live preview and more templates

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17: Einstellungen

**Vorher:** `frontend-design:frontend-design` laden.

**Files:**
- Create: `src/ui/FieldBuilder.tsx`, `src/features/settings/SettingsLayout.tsx`, `OrganizationSettings.tsx`, `DocumentTypeSettings.tsx`, `CustomFieldsSettings.tsx`, `TaxSettings.tsx`, `UnitSettings.tsx`, `CategorySettings.tsx`, `TextBlockSettings.tsx`, `UserSettings.tsx`, `e2e/settings.spec.ts`

**Interfaces:**
- Consumes: `useSettingsStore` (alle Aktionen), `useTemplateStore`, `PROFILE_LABELS`, `PROFILE_TYPES`, `PROFILE_REQUIREMENTS`, `FIELD_TYPE_LABELS`, `slugifyKey`, `validateFieldDef`, `allocateNumber` (für Vorschau „Nächste Nummer“: Domain-Funktion `allocateNumber(state, new Date()).number` direkt, ohne Store-Mutation), `newId`.
- Produces: `FieldBuilder({ target: FieldTarget; title: string; profileFields?: { key: string; label: string }[] })` — Liste der Felder (Drag-Sortierung, Label, Schlüssel mono, Typ-Badge, Pflicht-Badge), gesperrte Kern-/Profilfelder oben mit Schloss-Icon und Badge (nicht editierbar), „Feld hinzufügen“ → Dialog: Bezeichnung (Schlüssel wird live per `slugifyKey` vorgeschlagen, editierbar bis zum ersten Speichern, danach read-only mit Hinweis „Schlüssel ist fest, damit Templates nicht brechen“), Typ, Optionen (bei Auswahl, eine pro Zeile), Pflicht, Standardwert (per `CustomFieldInput`), Hilfetext. Fehler aus `upsertFieldDef` unter den Feldern anzeigen.

Verhalten:
- **Layout:** Unternavigation links: Organisation · Dokumenttypen (4 Einträge) · Eigene Felder · Steuern · Einheiten · Kategorien · Textbausteine · Benutzer.
- **Organisation:** Kernfelder inkl. Logo-Upload (Data-URL, Vorschau, Entfernen), Besteuerungsart (Radio „Regelbesteuerung“ / „Kleinunternehmer (§ 19 UStG)“ mit Erklärung, dass Steuern ausgeblendet und der Hinweis automatisch gesetzt wird), eigene Organisationsfelder per `FieldBuilder` + Wert-Eingabe. DOM-IDs `field-org.address`, `field-org.vat_id`, `field-org.iban` (Sprungziele der Prüfanzeige; Hash-Fokus wie bei Kunden).
- **Dokumenttyp (je Typ):** Profil-Auswahl (nur Profile, deren `PROFILE_TYPES` den Typ enthalten; Erklärtext; Liste der Pflichtangaben aus `PROFILE_REQUIREMENTS`), Nummernkreis (Muster mit Platzhalter-Hilfe, nächste Nummer, jährlich zurücksetzen, Live-Vorschau „Nächste Nummer: RE-2026-0003“), Standard-Template (Select), Standard-Kopf-/Fußtext (Select Textbausteine), Zahlungsziel in Tagen (Rechnung) bzw. Gültigkeit in Tagen (Angebot), `FieldBuilder` für Dokumentfelder und für Positionsfelder (mit gesperrten Kern-/Profilfeldern).
- **Eigene Felder:** `FieldBuilder` für Kunde, Ansprechpartner, Katalog.
- **Steuern:** Tabelle der Sätze (Bezeichnung, %, Kategorie-Code mit Klartext `S` Standard, `Z` Nullsatz, `E` Befreit, `AE` Reverse Charge, `K` Innergemeinschaftlich, `G` Ausfuhr; Befreiungshinweis), Anlegen/Bearbeiten/Löschen. Bei Kleinunternehmer Banner „Steuersätze werden aktuell nicht verwendet (§ 19 UStG).“
- **Einheiten:** Tabelle + Dialog; E-Rechnungs-Code als durchsuchbares Select über eine kuratierte Liste gängiger UN/ECE-Rec-20-Codes (`HUR` Stunde, `DAY` Tag, `WEE` Woche, `MON` Monat, `ANN` Jahr, `MIN` Minute, `H87` Stück, `C62` Einheit, `LS` Pauschale, `KMT` Kilometer, `MTR` Meter, `MTK` Quadratmeter, `KGM` Kilogramm, `LTR` Liter, `SET` Satz, `PR` Paar) als Konstante `UNIT_CODES` in `src/domain/unitCodes.ts`.
- **Kategorien:** einfache Liste mit Inline-Bearbeitung.
- **Textbausteine:** Liste nach Art gruppiert; Editor mit Textarea, Platzhalter-Hilfe und Live-Vorschau des gerenderten Textes (Liquid mit Beispieldokument).
- **Benutzer:** Tabelle (Name, E-Mail, Rolle), „Einladen“-Dialog (legt Benutzer an, Toast „Einladung im Klickdummy nicht versendet“).

- [ ] **Step 1: Failing E2E (deckt die Erfolgskriterien „eigenes Feld“ und „Kleinunternehmer“ ab)**

`e2e/settings.spec.ts`:
```ts
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/login');
  await page.getByLabel('E-Mail').fill('a@b.c');
  await page.getByLabel('Passwort').fill('x');
  await page.getByRole('button', { name: 'Anmelden' }).click();
});

test('custom field flows into document and preview', async ({ page }) => {
  await page.goto('/settings/document-types/offer');
  await page.getByRole('button', { name: 'Dokumentfeld hinzufügen' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Bezeichnung').fill('Ansprechpartner Intern');
  await expect(dialog.getByLabel('Schlüssel')).toHaveValue('ansprechpartner_intern');
  await dialog.getByRole('button', { name: 'Speichern' }).click();

  await page.goto('/templates');
  await page.getByRole('article', { name: 'Klar' }).getByRole('button', { name: 'Duplizieren' }).click();
  const editor = page.getByRole('textbox', { name: 'Template-Code' });
  await editor.click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type('<p id="intern">{{ document.ansprechpartner_intern }}</p>');
  await page.getByRole('tab', { name: 'Manifest' }).click();
  await page.getByLabel('Name').fill('Klar Intern');

  await page.goto('/documents/doc-offer-2');
  await page.getByLabel('Template').selectOption({ label: 'Klar Intern' });
  await page.getByLabel('Ansprechpartner Intern').fill('Jonas');
  await expect(page.frameLocator('iframe[title="Dokumentvorschau"]').locator('#intern')).toHaveText('Jonas');
});

test('reserved keys are rejected', async ({ page }) => {
  await page.goto('/settings/document-types/invoice');
  await page.getByRole('button', { name: 'Dokumentfeld hinzufügen' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Bezeichnung').fill('Number');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(dialog.getByText('„number“ ist ein Kernfeld und reserviert.')).toBeVisible();
});

test('small business mode removes tax and adds legal note', async ({ page }) => {
  await page.goto('/settings/organization');
  await page.getByLabel('Kleinunternehmer (§ 19 UStG)').check();
  await page.goto('/documents/doc-offer-2');
  await expect(page.getByTestId('total-gross')).toContainText('760,00');
  await expect(page.getByText('Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.').first()).toBeVisible();
});

test('number pattern preview updates', async ({ page }) => {
  await page.goto('/settings/document-types/invoice');
  await page.getByLabel('Nummernmuster').fill('R{YY}-{000}');
  await expect(page.getByTestId('next-number')).toContainText(/R\d{2}-003/);
});
```
Run: `pnpm e2e e2e/settings.spec.ts` → Expected: FAIL.

- [ ] **Step 2: Implementieren** gemäß Verhalten.

- [ ] **Step 3: Verifizieren**

Run: `pnpm e2e && pnpm test && pnpm build` → Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(ui): add settings with field builder, profiles, taxes, units and text blocks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 18: End-to-End-Durchlauf, Feinschliff, README

**Files:**
- Create: `e2e/happy-path.spec.ts`, `clickdummy/README.md`, `README.md` (Repo-Root, Englisch, kurz), `LICENSE` (MIT, `Copyright (c) 2026 Rafael Haußmann`)

**Interfaces:**
- Consumes: gesamte App.

- [ ] **Step 1: Happy-Path-Test (Erfolgskriterium 2 der Spec)**

`e2e/happy-path.spec.ts`:
```ts
import { expect, test } from '@playwright/test';

test('offer → invoice (e-invoice green) → cancellation', async ({ page }) => {
  await page.goto('/login');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/login');
  await page.getByLabel('E-Mail').fill('a@b.c');
  await page.getByLabel('Passwort').fill('x');
  await page.getByRole('button', { name: 'Anmelden' }).click();

  // Angebot anlegen
  await page.getByRole('button', { name: 'Neues Dokument' }).click();
  await page.getByLabel('Dokumenttyp').selectOption('offer');
  await page.getByLabel('Kunde').selectOption('cus-bohnenwerk');
  await page.getByRole('button', { name: 'Anlegen' }).click();

  // Katalogpositionen einfügen
  await page.getByRole('button', { name: 'Leistung' }).click();
  await page.getByLabel('Bezeichnung').last().fill('Work');
  await page.getByRole('option', { name: /Workshop/ }).click();
  await page.getByRole('button', { name: 'Leistung' }).click();
  await page.getByLabel('Bezeichnung').last().fill('Entw');
  await page.getByRole('option', { name: /Entwicklung/ }).click();
  await page.getByLabel('Menge').last().fill('10');

  // Abschließen, annehmen, umwandeln
  await page.getByRole('button', { name: 'Abschließen' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Abschließen' }).click();
  await page.getByRole('button', { name: 'Als angenommen markieren' }).click();
  await page.getByRole('button', { name: 'In Rechnung umwandeln' }).click();

  // E-Rechnung: Prüfanzeige grün
  await expect(page.getByTestId('compliance')).toContainText('Bereit zum Abschließen');
  await page.getByRole('button', { name: 'Abschließen' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Abschließen' }).click();
  await expect(page.getByText(/RE-\d{4}-0003/).first()).toBeVisible();

  // Stornieren
  await page.getByRole('button', { name: 'Stornieren' }).click();
  await page.getByRole('button', { name: 'Abschließen' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Abschließen' }).click();
  await expect(page.getByTestId('document-chain')).toContainText(/RE-\d{4}-0003/);
  await page.getByTestId('document-chain').getByRole('link', { name: /RE-\d{4}-0003/ }).click();
  await expect(page.getByText('Storniert').first()).toBeVisible();
});
```
Run: `pnpm e2e` → Expected: alle PASS. Fehlschläge beheben (keine Tests abschwächen).

- [ ] **Step 2: Responsiveness & Dark Mode prüfen**

Ad-hoc-Screenshots aller Hauptseiten bei 1440×900, 1024×768 (Tablet) und 390×844 (Mobile: nur Grundbedienbarkeit, keine horizontale Seiten-Scrollbar außer in Tabellen-Containern) in Light und Dark. Auffälligkeiten beheben.

- [ ] **Step 3: README & Lizenz**

`clickdummy/README.md` (Deutsch, kurz): Zweck, `pnpm install`, `pnpm dev`, `pnpm test`, `pnpm e2e`, Demo-Daten zurücksetzen.
`README.md` (Repo-Root, Englisch): One-liner „openbill — open, self-hosted quotes & invoices with custom fields and your own Liquid templates“, Status „concept / clickdummy“, Link auf Spec, Quickstart für den Klickdummy, Lizenz MIT.
`LICENSE`: MIT, `Copyright (c) 2026 Rafael Haußmann`.

- [ ] **Step 4: Abschlussprüfung**

Run: `pnpm typecheck && pnpm test && pnpm e2e && pnpm build` → Expected: alles grün.
Erfolgskriterien aus Spec 3.5 einzeln abhaken.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test(e2e): add happy path and finalize clickdummy docs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
