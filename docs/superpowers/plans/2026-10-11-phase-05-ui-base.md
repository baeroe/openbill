# Phase 5: UI-Basis – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** openbill bekommt die echte Oberfläche im Design „Graphit & Kobalt“: vollständige Tailwind-Tokens mit Dark Mode, ein eigenes Komponentenset, `lib/api.ts` mit SWR, die App-Shell und die Seiten Übersicht, Dokumente (mit Dialog „Neues Dokument“), Kunden (Liste/Detail, Speichern über die REST-API) und Login – mit Pest-Inertia-Tests, Vitest und einem Playwright-Grundgerüst.

**Architecture:** Inertia-Seiten bekommen über Props nur Seitenkontext und **serverseitig berechnete Kennzahlen** (Übersicht, Zähler und Summen der Dokumentliste, offene Beträge je Kunde – Beträge bleiben Strings, im Browser wird nie mit Geld gerechnet). Listen und Detaildaten lädt die UI mit SWR aus der REST-API aus Phase 4 (Session + CSRF), Schreiben läuft über `lib/api.ts` an dieselben Endpunkte wie bei Agenten. Die Komponenten sind ein Port von `prototypes/clickdummy-v2/src/components/ui` nach Tailwind 4 (Tokens in `@theme`, hell/dunkel über `data-theme`), Radix nur für Dialog/Drawer und Menü.

**Tech Stack:** Laravel 13, Inertia v3 (`@inertiajs/react` 3.9), React 19, TypeScript 7, Tailwind 4.3, Vite 8, SWR 2, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `lucide-react`, `@fontsource-variable/schibsted-grotesk`, Vitest 5, Playwright (eigenes Paket in `e2e/`), Pest 5.

**Spec:** `docs/superpowers/specs/2026-10-11-openbill-app-design.md` (bindend, v. a. Abschnitt 8, dazu 2, 3, 6, 10, 11), Master-Plan `docs/superpowers/plans/2026-10-11-openbill-app.md` (Abschnitt „Phase 5“), Gestaltung `prototypes/clickdummy-v2/DESIGN.md`, API-Schnittstellen aus `docs/superpowers/plans/2026-10-11-phase-04-api.md` (Abschnitt „Interfaces“). Vorlagen: `prototypes/clickdummy-v2/src/styles/*.css`, `src/components/ui/*`, `src/layout/AppShell.tsx`, `src/routes/dashboard/*`, `src/routes/documents/DocumentListPage*`, `src/routes/documents/NewDocumentDialog*`, `src/routes/customers/*`, `src/routes/LoginPage*`, `src/components/CustomFieldInput.tsx`.

## Global Constraints

- Branch `phase-05-ui-base` (ist ausgecheckt). Git-Identität kommt aus `~/.gitconfig`; vor dem ersten Commit `git config user.email` → muss `rafael@hauss.dev` sein, sonst stoppen und nachfragen. Nie `user.email`/`user.name` setzen.
- Jede Commit-Message endet mit der Zeile `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (in diesem Plan als zweites `-m`); die PR-Beschreibung endet mit `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- PHP, Composer, Artisan **nur in DDEV** (`ddev artisan …`, `ddev exec …`). JS-Pakete der App nur mit pnpm **im Container** (`ddev exec pnpm …`, Root-Abhängigkeiten mit `-w`), nie npm/npx. Ausnahme ist nur `e2e/` (Task 15): eigenes Paket, das auf dem Mac installiert wird, weil Playwright dort läuft.
- Vor jedem Commit `ddev exec vendor/bin/pint` (CI prüft `--test`), bei TS-Änderungen `ddev exec pnpm typecheck`. Code-Blöcke in diesem Plan sind inhaltlich verbindlich, Formatierung entscheiden Pint und der vorhandene Stil (4 Leerzeichen, einfache Quotes, Semikolons).
- **Keine Geschäftslogik in Controllern** (Architekturtests). Web-Controller lesen über `App\Support`-Klassen und rendern Inertia-Seiten; geschrieben wird ausschließlich über die REST-API → Actions.
- **Beträge nie als Zahl im Browser:** Die API liefert Strings (`"1130.50"`); die UI formatiert sie mit `Intl.NumberFormat` direkt als String (exakt) und summiert nie selbst. Summen/Zähler kommen aus PHP (`BigDecimal`/SQL `SUM` auf `DECIMAL`).
- UI-Texte nur über Schlüssel in `lang/en.json` **und** `lang/de.json` (gleiche Schlüssel, flach, alphabetisch einsortiert, Platzhalter `:name`, Plural `.one`/`.other`, Schlüssel nur `[a-z_]` mit Punkten). React `t()`/`tn()`/`path()` aus `resources/js/lib/i18n.ts`. Admin-URLs immer über `path('/…')`. Code und Kommentare Englisch. Deutsche Texte in Du-Form wie im Klickdummy.
- Gestaltung nach `prototypes/clickdummy-v2/DESIGN.md`: keine Rahmen und Schatten zur Gliederung (Ebenen über Tonwerte), Schatten nur für Schwebendes (`shadow-float`), Pillen für Buttons/Filter/Badges, Radien 12/18/24, Fokus 2 px Kobalt mit 2 px Abstand, `proportional-nums lining-nums` (Utility `num`) statt `tabular-nums`, keine Versal-Labels, keine Pfeile `→` an Buttons, keine Emoji. **Keine shadcn-Defaults**, keine fremde UI-Bibliothek; Radix nur `@radix-ui/react-dialog` (Dialog/Drawer) und `@radix-ui/react-dropdown-menu` (Menü). Popover kommt erst, wenn Phase 6 es braucht.
- Zustand (Bibliothek) bleibt dem Editor-Store in Phase 6 vorbehalten (Spec 2); UI-Zustände dieser Phase (Theme, Toasts, Seitenleiste) laufen über `useSyncExternalStore`/`localStorage`.
- Demo-Daten und Testbeispiele nur fiktiv (Studio Nordlicht, Hafenkontor Lindqvist, Fjord Analytics, Hotel Alpenglück, Kulturwerk Elbinsel, Werkstatt Morgenrot; E-Mails `@example.com`/`.example`). Keine echten Firmen, Hosts oder Personen – auch nicht in Screenshots.
- CI: Pflicht-Job heißt `tests` und muss grün sein; Name nie ändern. Neue Prüfungen (Vitest) dort anhängen.
- Doku: VitePress-Seite `documents` (UI-Teil) in `docs/en/` **und** `docs/de/` im selben PR, dazu Ergänzungen in `api` und `development`. `CLAUDE.md` wird aktualisiert.
- Der Haken für Phase 4 im Abschnitt „Fortschritt“ des Master-Plans ist mit diesem Plan committet. Den Haken für Phase 5 setzt der Orchestrator nach dem Merge, nicht der Umsetzer.

## Review Focus

- **Sitzung oder CSRF-Token läuft ab, während die Seite offen ist:** Ein Speichern nach Session-Erneuerung in einem anderen Tab (419) holt einmal ein frisches CSRF-Cookie und wiederholt die Anfrage; eine abgelaufene Session (401) führt zum Login der aktuellen Sprache statt zu einer stummen Fehlermeldung; ein Netzwerkfehler zeigt einen lesbaren, übersetzten Text. → Task 4 (Vitest `api.test.ts`).
- **Getippte oder alte Filter-URLs:** `/en/documents?type=bogus&status[]=x&q=%20&customer_id=…` darf nie 500 liefern; ungültige Werte fallen still weg, gültige bleiben, Zähler und Summe passen zu den gültigen Filtern; `status=overdue` funktioniert in Seite und API gleich. → Task 8 (`DocumentQueryTest`) und Task 11 (`DocumentPagesTest`).
- **API-Fehler landen am richtigen Feld:** Ein 422 mit `violations[].path` (`email`, `number`, `contacts.1.email`, `custom.industry`) markiert genau dieses Feld bzw. den Ansprechpartner, nichts wird gespeichert, Namen nur aus Leerzeichen gelten als leer und Leerzeichen um Stammdaten werden entfernt. → Task 1 (Pest Trim + deutsche Texte), Task 4 (`ApiError.fieldErrors`), Task 12 (`lib/customers.test.ts`: `contactErrors`), Task 15 (Playwright).
- **Ungespeicherte Änderungen beim Verlassen:** Navigation über Sidebar, Links, Zurück-Link sowie Neuladen/Schließen des Tabs fragen nach, solange der Kunde ungespeichert ist (Vor/Zurück im Browser stellt Inertia aus der History wieder her, ohne `before`-Ereignis – bewusst nicht abgefangen); nach dem Speichern (auch beim Umleiten eines neuen Kunden auf seine URL) fragt nichts mehr. → Task 13 (Implementierung `useLeaveGuard`), Task 15 (Playwright `customers.spec.ts`).
- **Leere und große Datenmengen, ungewöhnliche Beträge:** Frische Installation ohne Kunden/Dokumente zeigt überall Leerzustände ohne Fehler; Listen über einer Seite (> 50) laden per „Mehr laden“ nach; negative Beträge (Stornos) und Beträge jenseits der Float-Genauigkeit (`"9007199254740993.10"`) werden exakt formatiert. → Task 3 (Vitest `format.test.ts`), Task 8 und 10 (leere Übersicht), Task 12 (leere Kundenliste), Task 4 (`apiPage` erkennt die letzte Seite) und Task 11 Step 7 (60 Dokumente, „Mehr laden“ im Browser).

## Entscheidungen (geprüft am 2026-10-11)

| Thema | Entscheidung | Grund / Prüfung |
|---|---|---|
| Datenfluss | Inertia-Props: Seitenkontext (`customer_id`, `document_id`, normalisierte `filters`) und Aggregate (Übersicht, `counts`, `summary`, `open_by_customer`, Kundenliste für den Filter). SWR: Listen (paginiert, „Mehr laden“) und Details aus `/api`. Schreiben: `lib/api.ts` → `/api` | Master-Plan: „Pest-Inertia-Tests je Seite (Props)“ + „`lib/api.ts` + SWR“; Phase-4-Interfaces: „Phase 5 bekommt Kennzahlen der Übersicht über Inertia-Props“. Summen im Browser würden Geld als Float addieren. |
| Filter `overdue` | `App\Support\DocumentQuery` (aus `DocumentProvider` herausgezogen) kennt `status=overdue` (= offene Rechnung mit `due_date < heute`, gleiche Regel wie `StatusMachine::isOverdue`); API und Seite nutzen dieselbe Klasse | Klickdummy verlinkt „Davon überfällig“ auf diesen Filter; eine Filterlogik für API, Zähler und Summe. |
| Spalte „Projekt“ | entfällt; Liste zeigt Kunde einzeilig | Das echte Datenmodell hat kein Projektfeld (im Demo ist `project_name` ein eigenes Feld), die Listenform der API trägt keine `custom`-Werte. |
| Navigation | Phase 5 zeigt Übersicht, Dokumente, Kunden. Templates, Eigene Felder, Einstellungen ergänzt Phase 7 in `resources/js/layouts/nav.ts` | Keine Links auf 404-Seiten. |
| Dokument-Detail | Platzhalterseite `documents/show` (Kopf, Status, Kunde, Datum, Betrag, PDF-Link, Hinweis), Route `/{locale}/documents/{id}` | „Neues Dokument“ und alle Listen verlinken dorthin; Phase 6 ersetzt die Seite durch den Editor (gleiche Route, gleicher Komponentenname, gleiche Prop `document_id`). |
| Theme | Präferenz `system`/`light`/`dark` in `localStorage` (`openbill:theme`), Inline-Skript in `app.blade.php` setzt `data-theme` vor dem ersten Paint, `lib/theme.ts` mit gleicher Regel; Tailwind-Variante `dark:` folgt `data-theme` | Kein Aufblitzen; pro Gerät wie im Klickdummy; Server muss nichts wissen. |
| Tokens | Rohwerte als CSS-Variablen auf `:root`/`:root[data-theme='dark']`, Tailwind-Namen über `@theme inline` (`bg-surface-2`, `text-muted`, `shadow-float`, `rounded-lg`=18 px, `text-sm`=13 px, `h-control`). Tailwinds Farbpalette wird mit `--color-*: initial` entfernt | Erzwingt Token-Nutzung; Schriftgrößen-Skala 12/13/14/16/20/26/34 aus DESIGN.md. |
| Breakpoints | `xs` 520, `sm` 720, `md` 900 (Sidebar erscheint), `lg` 1100 px | Grenzen aus den Klickdummy-CSS-Dateien (mobile first umgedreht). |
| Schrift | `import '@fontsource-variable/schibsted-grotesk'` in `app.tsx` | Vite bündelt die woff2-Dateien; kein CDN. |
| Icons | `lucide-react` (wie Klickdummy) | Port 1:1. |
| Beträge | `formatMoney(amount: string)` über `Intl.NumberFormat(…).format(string)` (ES2023: Strings werden exakt als Dezimalzahl formatiert), Währung EUR | Spec 13: keine Fremdwährungen. Test mit `"9007199254740993.10"`. |
| Sprache für Intl | `en` → `en-GB`, `de` → `de-DE` | Tag vor Monat im Englischen wie im Rest Europas. |
| Toasts | eigener Store (`lib/toast.ts`, `useSyncExternalStore`), `<Toaster>` in der Shell | Kein Zustand außerhalb des Editors (Spec 2). |
| Menü | Radix DropdownMenu mit `modal={false}` | Vermeidet das bekannte Radix-Problem „`pointer-events: none` bleibt am Body“, wenn aus einem Menüpunkt ein Dialog öffnet. |
| Liste/Suche Kunden | Server-Suche `q` (Name, Nummer, E-Mail; Phase 4) mit 250 ms Entprellung | Klickdummy suchte zusätzlich Ort/Ansprechpartner lokal; die API sucht serverseitig über alle Seiten. |
| Eigene Felder vom Typ Bild | in Phase 5 nur Anzeige (deaktiviert, Hinweis „über die API“) | Ein Upload-Weg für Bilder entsteht erst mit Phase 7 (Logo/Assets). |
| Vitest | im Root, `vitest.config.ts`, Umgebung `node`, nur `resources/js/**/*.test.ts` (reine Funktionen: `lib/`, `api/keys`, `layouts/nav`); CI-Schritt `Vitest` im Job `tests` | Komponenten prüfen Pest (Props) und Playwright (Verhalten); kein jsdom nötig. |
| Playwright | eigenes Paket `e2e/` (eigene `package.json` + `pnpm-lock.yaml`, **nicht** im Workspace), Installation auf dem Mac mit `pnpm --dir e2e install --ignore-workspace`, Browser per `pnpm --dir e2e exec playwright install chromium`; läuft gegen `https://openbill.ddev.site`; `globalSetup` seedet per `ddev artisan db:seed` (`DemoSeeder` + `E2eUserSeeder`). Nicht in CI (Phase 10 baut den `e2e`-Job gegen Compose) | `node_modules` im Root enthält Linux-Binaries aus dem Container; Playwright braucht macOS-Browser. Ein Workspace-Paket würde das Root-Lockfile und die CI berühren. |
| E2E-Login | `Database\Seeders\E2eUserSeeder`: `e2e@example.com` / `e2e-password`, Owner, verweigert `production` | Tests brauchen einen bekannten Login unabhängig von `.env`. |
| Phase-2-Minor #13 | `lang/de/validation.php` vollständig (alle Schlüssel der Framework-Datei, Test prüft Gleichstand) + deutsche Attributnamen | Laravels Standardmeldungen erscheinen sonst englisch in der deutschen UI und in der API mit `Accept-Language: de`. |
| Phase-4-Minor TrimStrings | `SaveCustomer` trimmt Stammdaten-Strings (Kunde + Ansprechpartner) **vor** der Validierung; leere Kundennummer = nächste freie Nummer. Dokumente werden nicht getrimmt | `TrimStrings` sieht API-Platform-Bodies nicht. Entwürfe speichert Phase 6 per Autosave während des Tippens: Trimmen würde Leerzeichen am Cursor fressen. Phase 7 trimmt Organisation/Felder in ihren Actions genauso. |
| Startseite | `HomeController` → `OverviewController`, Komponente `overview`, Routenname `home` bleibt | `home.tsx` war nur ein Platzhalter aus Phase 1. |

---

## Dateistruktur nach Phase 5

```
app/
├─ Http/Controllers/
│  ├─ OverviewController.php          GET /{locale}            → overview (ersetzt HomeController)
│  ├─ DocumentController.php          GET /{locale}/documents, /documents/{id} → documents/index, documents/show
│  └─ CustomerController.php          GET /{locale}/customers, /customers/new, /customers/{id} → customers/index, customers/show
├─ Http/Middleware/HandleInertiaRequests.php   + Shared Prop org {name}
├─ Support/
│  ├─ Amount.php                      SQL-Summe → "0.00"-String (BigDecimal)
│  ├─ DocumentQuery.php               Filter/Sortierung der Dokumentliste (API + Seite), counts(), summary()
│  └─ Overview.php                    Kennzahlen, Aufmerksamkeit, zuletzt bearbeitet, offene Beträge je Kunde
├─ State/Provider/DocumentProvider.php         nutzt DocumentQuery
└─ Actions/SaveCustomer.php           trimmt Stammdaten, leere Nummer = nächste Nummer
database/seeders/E2eUserSeeder.php
lang/de/validation.php
resources/
├─ css/app.css                        Tokens hell/dunkel, @theme, Basis, Animationen
├─ views/app.blade.php                Theme-Skript vor dem Paint, theme-color hell/dunkel
└─ js/
   ├─ app.tsx                         Schrift, Theme, ApiProvider (SWR)
   ├─ types.ts                        SharedProps + org
   ├─ lib/
   │  ├─ api.ts (+ .test.ts)          fetch mit Session/CSRF, ApiError (Problem Details), apiPage, apiUrl
   │  ├─ swr.tsx                      SWRConfig (Fetcher, Retry-Regeln), ApiProvider
   │  ├─ format.ts (+ .test.ts)       Geld, Datum, Monat, relative Tage, Gruppierung, Initialen, Länder, Dezimal-Eingabe
   │  ├─ theme.ts (+ .test.ts)        Theme-Präferenz, data-theme, useThemePref
   │  ├─ toast.ts (+ .test.ts)        Toast-Store
   │  ├─ hooks.ts                     useDebounced, useLeaveGuard
   │  ├─ prefs.ts                     useStoredFlag (localStorage)
   │  ├─ customers.ts (+ .test.ts)    Kunden-Entwurf ↔ API, Ansprechpartner-Operationen, Länder, Steuerbehandlungen
   │  └─ i18n.ts                      + localeHref()
   ├─ api/
   │  ├─ types.ts                     TS-Typen der API (Customer, Contact, DocumentSummary, FieldDefinition, …)
   │  ├─ keys.ts (+ .test.ts)         SWR-Schlüssel = Request-URLs, PAGE_SIZE
   │  ├─ paged.ts                     usePagedList (useSWRInfinite)
   │  ├─ customers.ts                 useCustomerList, useCustomerOptions, useCustomer, saveCustomer, deleteCustomer
   │  ├─ documents.ts                 useDocumentList, useDocument, createDocument
   │  └─ fields.ts                    useFieldDefinitions
   ├─ components/
   │  ├─ ui/                          cx, button, form, badge, tabs, card, page, states, avatar, dialog, menu, toaster, index
   │  ├─ custom-field-input.tsx       Eingabe je Feldtyp (auch Phase 6/7)
   │  ├─ locale-switch.tsx            neu gestaltet
   │  ├─ new-document/                new-document-context.tsx, new-document-dialog.tsx
   │  └─ customers/                   contact-drawer.tsx, customer-documents.tsx
   ├─ layouts/                        app-shell.tsx, nav.ts (+ .test.ts), user-menu.tsx, logo.tsx
   └─ pages/                          login, overview, documents/index, documents/show, customers/index, customers/show
e2e/                                  package.json, pnpm-lock.yaml, playwright.config.ts, global-setup.ts, tests/*.spec.ts
tests/Feature/Pages/                  OverviewPageTest, DocumentPagesTest, CustomerPagesTest, ShellPropsTest
tests/Feature/Support/                DocumentQueryTest, OverviewTest
tests/Feature/                        ValidationLocaleTest, E2eUserSeederTest, Actions/SaveCustomerTrimTest
tests/Unit/ValidationTranslationTest.php
vitest.config.ts
```

## Interfaces (verbindlich für Phase 6, 7, 8)

**Layout und Seiten**

- Jede Seite mit Shell setzt `Page.layout = appLayout` (`resources/js/layouts/app-shell.tsx`: `export function appLayout(page: ReactNode): ReactNode`). Die Shell bleibt über Seitenwechsel gemountet (persistentes Inertia-Layout) und enthält `NewDocumentProvider` und `<Toaster />`.
- Seitenrahmen: `<Page wide?>` (`components/ui/page.tsx`; `wide` = ohne `max-w-[1320px]`, für den Editor in Phase 6), Kopf `<PageHeader title description? actions? back?={{ href, label }}>`.
- Navigation: `resources/js/layouts/nav.ts` → `navItems(): NavItem[]` (`{ href, label, icon, exact? }`) und `setupItems(): NavItem[]` (Phase 5 leer; Phase 7 trägt Eigene Felder und Einstellungen ein, Templates kommt in `navItems`). `isActive(url: string, item: NavItem): boolean`.
- Neues Dokument von überall: `useNewDocument(): (options?: { type?: DocumentType; customerId?: string }) => void` (`components/new-document/new-document-context.tsx`). Taste **N** öffnet den Dialog, solange kein Eingabefeld, Editor (`.cm-editor`) oder Dialog fokussiert/offen ist.
- Inertia-Komponenten und Props: `overview` `{ overview: OverviewData }`, `documents/index` `{ filters, counts, summary, customers }`, `documents/show` `{ document_id: string }` (Phase 6 ersetzt die Seite, Prop bleibt), `customers/index` `{ open_by_customer: Record<string, { gross: string; count: number; overdue: number }> }`, `customers/show` `{ customer_id: string | null }`. Shared: `locale`, `translations`, `auth.user`, `org: { name: string } | null`.

**API-Client** (`resources/js/lib/api.ts`)

```ts
export type Violation = { path: string; message: string; code?: string };
export type Problem = { type: string; title: string; status: number; detail: string; reason: string; violations?: Violation[]; [extension: string]: unknown };
export class ApiError extends Error { readonly status: number; readonly problem: Problem; get reason(): string; get violations(): Violation[]; fieldErrors(): Record<string, string> }
export type ApiOptions = { method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'; body?: unknown; signal?: AbortSignal; format?: 'json' | 'jsonld' };
export function api<T>(path: string, options?: ApiOptions): Promise<T>;          // ≥ 400 → ApiError; 204 → undefined; 419 → einmal Cookie erneuern und wiederholen; 401 → Login
export type Page<T> = { items: T[]; total: number; page: number; hasMore: boolean };
export function apiPage<T>(path: string, signal?: AbortSignal): Promise<Page<T>>; // JSON-LD member/totalItems/view.next
export function apiUrl(path: string, params?: Record<string, string | number | boolean | null | undefined>): string;
export function errorMessage(error: unknown): string;
export function setUnauthenticatedHandler(handler: () => void): void;
```

- PATCH schickt `application/merge-patch+json`, POST/PUT `application/json`; jede Anfrage `Accept-Language` = UI-Sprache, schreibende `X-XSRF-TOKEN` aus dem Cookie `XSRF-TOKEN`.
- Phase 6 (Autosave/Vorschau): `api<Document>(keys.document(id), { method: 'PATCH', body, signal })` und `api<PreviewResult>('/api/render', { method: 'POST', body, signal })` mit `AbortController`; Felder markiert sie über `ApiError.violations`.

**SWR** (`resources/js/lib/swr.tsx`, `resources/js/api/*`)

- `ApiProvider` umschließt die App (`app.tsx`); `swrConfig`: Fetcher `api<unknown>(url)`, `keepPreviousData: true`, keine Wiederholung bei 4xx, `focusThrottleInterval` 30 s.
- Schlüssel = Request-URL (`resources/js/api/keys.ts`): `keys.customers(q, page)`, `keys.customerOptions(q)`, `keys.customer(id)`, `keys.documents(filters, page)`, `keys.document(id)`, `keys.fieldDefinitions(scope)`; `PAGE_SIZE = 50`. Phase 6 ergänzt `keys.render…`/`keys.positionSuggestions(q)`, Phase 7 `keys.templates()`, `keys.organization()` usw. nach demselben Muster.
- `usePagedList<T>(key: (page: number) => string): PagedList<T>` mit `{ items, total, hasMore, isLoading, isLoadingMore, error, loadMore(), retry() }` (`resources/js/api/paged.ts`).
- Hooks: `useCustomerList(q)`, `useCustomerOptions(q)`, `useCustomer(id | null)`, `saveCustomer(input, id?)`, `deleteCustomer(id)`, `useDocumentList(filters)`, `useDocument(id)`, `createDocument({ type, customer_id })`, `useFieldDefinitions(scope)`.
- Typen (`resources/js/api/types.ts`): `DocumentType`, `DocumentStatus`, `TaxTreatment`, `FieldScope`, `FieldType`, `CustomValue`, `CustomValues`, `Contact`, `ContactInput`, `Customer`, `CustomerInput`, `DocumentSummary`, `DocumentFilters`, `FieldDefinition`. Phase 6 ergänzt `Document` (Einzelform mit `groups`, `totals`, `issues`).

**Komponenten** (`resources/js/components/ui/index.ts`)

```ts
cx(...parts): string
Button({ variant?: 'default'|'primary'|'soft'|'ghost'|'danger', size?: 'md'|'sm', icon?, iconOnly?, pending?, ref?, ...button })
ButtonLink({ variant?, size?, icon?, iconOnly?, ...InertiaLinkProps }); buttonClass(look?, extra?): string
Field({ label?, hint?, error?, aside?, className?, path?, children: (id, describedBy) => ReactNode })
TextInput / Select / Textarea ({ label?, hint?, error?, aside?, wrapClassName?, path?, ...native })
SelectControl(native select + Chevron, ohne Label), SearchInput(native input type=search + Lupe), controlClass(error?, extra?)
Checkbox({ label, ...input }), Switch({ label, ...input })
Badge({ tone?: 'neutral'|'accent'|'ok'|'warn'|'bad'|'ink', plain?, children }), StatusBadge({ status, overdue? }), Tag({ tone?: 'accent'|'neutral'|'bad', neutral?, children })
Tabs<T>({ items: TabItem<T>[], value, onChange, label }), PillButton({ pressed, count?, children, ...button })
Card({ flush?, tinted?, ...section }), CardHead({ title, titleId?, description?, actions? })
Page({ wide?, className?, children }), PageHeader({ title, description?, actions?, back? }), BackLink({ href, children })
Spinner, Skeleton({ w?, h?, r?, className? }), ListSkeleton({ rows? }), EmptyState({ icon, title, children?, actions?, compact? }),
ErrorState({ error, onRetry?, title? }), Notice({ tone?: 'neutral'|'warn'|'ok'|'bad'|'accent', icon?, children })
Avatar({ name, size?: 'sm'|'md'|'lg', tone?: 'neutral'|'accent', children? })
Dialog({ open, onClose, title, description?, children?, footer?, wide? }), Drawer({ open, onClose, title, description?, children?, footer? }),
ConfirmDialog({ open, onClose, onConfirm, title, description?, confirmLabel, pending?, danger? })
Menu({ trigger: ReactElement, children, align?: 'start'|'end', side?: 'top'|'bottom', className? }), MenuItem({ icon?, danger?, onSelect?, disabled?, children }),
MenuLabel, MenuSeparator, MenuRadioGroup({ value, onValueChange, children }), MenuRadioItem({ value, icon?, children })
Toaster(); toast.success|error|info(message, action?) aus '@/lib/toast'
```

- `CustomFieldInput({ definition: FieldDefinition, value: CustomValue | undefined, onChange(value: CustomValue): void, error?: string, disabled?: boolean, compact?: boolean, path?: string })` (`resources/js/components/custom-field-input.tsx`) – Phase 6 benutzt sie für Dokument- und Positionsfelder (`compact` in der Positionszeile), Phase 7 für die Live-Vorschau im Feld-Drawer. Zahl/Betrag bleiben Strings mit Punkt (`toDecimalString`).
- Formatierung (`resources/js/lib/format.ts`): `intlLocale`, `formatMoney(amount: string, locale?)`, `formatDate(iso | null, locale?)`, `formatMonth('YYYY-MM', locale?)`, `formatLongDate(date, locale?)`, `monthName(date, locale?)`, `relativeDays(iso, today, locale?)`, `todayIso()`, `groupByMonth(rows)`, `initials(name)`, `countryName(code, locale?)`, `toDecimalString(raw)`.
- Hooks (`resources/js/lib/hooks.ts`): `useDebounced(value, ms?)`, `useLeaveGuard(active, message): () => void` (Phase 6 nutzt es, solange Autosave ausstehend ist; Phase 7 in Formularen).

**Server**

- `App\Support\DocumentQuery`: `rules()`, `validate(array $query): array` (422 bei Unsinn, für die API), `lenient(array $query): array` (verwirft Unsinn, für Seiten), `filtered(array $filters, string $today): Builder<Document>`, `sorted(Builder, string $sort = '-date'): Builder`, `counts(array $filters, string $today): array{all:int, offer:int, confirmation:int, invoice:int, cancellation:int}`, `summary(array $filters, string $today): array{count:int, gross_total:string}`. Status-Filter `overdue` = `DocumentQuery::OVERDUE`.
- `App\Support\Overview::build(CarbonImmutable $today): array` (Form siehe Task 8) – **Phase 8 gibt genau dieses Array als MCP-Tool `get-overview` zurück**; `Overview::openByCustomer(CarbonImmutable $today): array<string, array{gross: string, count: int, overdue: int}>`.
- `App\Support\Amount::of(mixed $value): string` (Skala 2).

---

### Task 1: Deutsche Validierungstexte und getrimmte Kundendaten (aufgeschobene Punkte)

Erledigt Phase-2-Minor #13 und den Phase-4-Minor „TrimStrings wirkt nicht auf API-Platform-Bodies“.

**Files:**
- Create: `lang/de/validation.php`
- Create: `tests/Unit/ValidationTranslationTest.php`
- Create: `tests/Feature/ValidationLocaleTest.php`
- Create: `tests/Feature/Actions/SaveCustomerTrimTest.php`
- Modify: `app/Actions/SaveCustomer.php` (Anfang von `handle()`, Nummernvergabe in der Transaktion, neue Methode `trimmed()`)

**Interfaces:**
- Consumes: `App\Actions\SaveCustomer::handle(Actor $actor, array $input, ?Customer $customer = null): Customer` (Phase 2/4), Test-Helfer `systemActor()`, `apiToken()` aus `tests/Pest.php`.
- Produces: deutsche Laravel-Meldungen für `de` (Web und `/api` mit `Accept-Language: de`); `SaveCustomer` speichert Strings getrimmt, `number: ""`/`"  "` vergibt bei neuen Kunden die nächste Nummer und lässt sie bei bestehenden unverändert (die UI schickt das leere Feld mit).

- [ ] **Step 1: Identität prüfen**

Run: `git config user.email`
Expected: `rafael@hauss.dev` (sonst stoppen und nachfragen).

- [ ] **Step 2: Failing tests schreiben**

`tests/Unit/ValidationTranslationTest.php`:

```php
<?php

/**
 * lang/de/validation.php must cover every message of Laravel's English file, otherwise German pages and
 * API answers (Accept-Language: de) fall back to English for that rule.
 *
 * @return list<string>
 */
function validationKeys(array $lines, string $prefix = ''): array
{
    $keys = [];
    foreach ($lines as $key => $value) {
        if ($prefix === '' && in_array($key, ['custom', 'attributes'], true)) {
            continue;
        }
        $keys = is_array($value)
            ? [...$keys, ...validationKeys($value, "{$prefix}{$key}.")]
            : [...$keys, "{$prefix}{$key}"];
    }

    return $keys;
}

it('has a German text for every validation message of Laravel', function () {
    $root = dirname(__DIR__, 2);
    $en = require "{$root}/vendor/laravel/framework/src/Illuminate/Translation/lang/en/validation.php";
    $de = require "{$root}/lang/de/validation.php";

    expect(array_values(array_diff(validationKeys($en), validationKeys($de))))->toBe([])
        ->and(array_values(array_diff(validationKeys($de), validationKeys($en))))->toBe([]);
});

it('keeps the placeholders of every message', function () {
    $root = dirname(__DIR__, 2);
    $flatten = function (array $lines, string $prefix = '') use (&$flatten): array {
        $result = [];
        foreach ($lines as $key => $value) {
            if ($prefix === '' && in_array($key, ['custom', 'attributes'], true)) {
                continue;
            }
            $result = is_array($value) ? [...$result, ...$flatten($value, "{$prefix}{$key}.")] : [...$result, "{$prefix}{$key}" => $value];
        }

        return $result;
    };
    $placeholders = function (string $text): array {
        preg_match_all('/:[a-z_]+/', $text, $m);
        $list = array_values(array_unique($m[0]));
        sort($list);

        return $list;
    };
    $en = $flatten(require "{$root}/vendor/laravel/framework/src/Illuminate/Translation/lang/en/validation.php");
    $de = $flatten(require "{$root}/lang/de/validation.php");

    foreach ($en as $key => $text) {
        expect($placeholders($de[$key] ?? ''))->toBe($placeholders($text), "placeholders of {$key}");
    }
});
```

`tests/Feature/ValidationLocaleTest.php`:

```php
<?php

use App\Models\User;
use Illuminate\Support\Facades\Validator;

it('validates in German with German field names', function () {
    app()->setLocale('de');

    $validator = Validator::make(
        ['email' => 'no-mail', 'contacts' => [['email' => 'no-mail']]],
        ['name' => 'required', 'email' => 'email', 'contacts.*.email' => 'email'],
    );

    expect($validator->errors()->first('name'))->toBe('Name ist erforderlich.')
        ->and($validator->errors()->first('email'))->toBe('E-Mail muss eine gültige E-Mail-Adresse sein.')
        ->and($validator->errors()->first('contacts.0.email'))->toBe('E-Mail muss eine gültige E-Mail-Adresse sein.');
});

it('shows German messages on the German login', function () {
    $this->post('/de/login', ['email' => '', 'password' => 'secret'])
        ->assertSessionHasErrors(['email' => 'E-Mail ist erforderlich.']);
});

it('answers the API in German when asked to', function () {
    $this->withToken(apiToken(user: User::factory()->create()))
        ->withHeader('Accept-Language', 'de')
        ->postJson('/api/customers', ['name' => '   '])
        ->assertUnprocessable()
        ->assertJsonPath('violations.0.path', 'name')
        ->assertJsonPath('violations.0.message', 'Name ist erforderlich.');
});
```

`tests/Feature/Actions/SaveCustomerTrimTest.php`:

```php
<?php

use App\Actions\SaveCustomer;
use App\Models\Customer;
use Illuminate\Validation\ValidationException;

it('stores master data without surrounding blanks', function () {
    $customer = app(SaveCustomer::class)->handle(systemActor(), [
        'name' => '  Hafenkontor Lindqvist GmbH ',
        'city' => ' Hamburg ',
        'email' => ' buchhaltung@hafenkontor.example ',
        'vat_id' => ' DE987654321 ',
        'contacts' => [['first_name' => ' Mira ', 'last_name' => 'Albers  ', 'email' => ' mira@hafenkontor.example']],
    ]);

    $contact = $customer->contacts->first();
    expect($customer->name)->toBe('Hafenkontor Lindqvist GmbH')
        ->and($customer->city)->toBe('Hamburg')
        ->and($customer->email)->toBe('buchhaltung@hafenkontor.example')
        ->and($customer->vat_id)->toBe('DE987654321')
        ->and($contact->first_name)->toBe('Mira')
        ->and($contact->last_name)->toBe('Albers')
        ->and($contact->email)->toBe('mira@hafenkontor.example');
});

it('refuses a name of blanks only', function () {
    app(SaveCustomer::class)->handle(systemActor(), ['name' => '   ']);
})->throws(ValidationException::class);

it('gives a new customer with an empty number the next number', function () {
    $customer = app(SaveCustomer::class)->handle(systemActor(), ['name' => 'Hotel Alpenglück', 'number' => '  ']);

    expect($customer->number)->toBe('C-1001');
});

it('keeps the number of an existing customer when the number is sent empty', function () {
    $customer = Customer::factory()->create(['number' => 'K-1003']);

    $saved = app(SaveCustomer::class)->handle(systemActor(), ['number' => '', 'city' => 'Oberstdorf'], $customer);

    expect($saved->number)->toBe('K-1003')->and($saved->city)->toBe('Oberstdorf');
});
```

- [ ] **Step 3: Tests laufen lassen, sie schlagen fehl**

Run: `ddev artisan test --filter='ValidationTranslationTest|ValidationLocaleTest|SaveCustomerTrimTest'`
Expected: FAIL – `lang/de/validation.php` fehlt („Failed to open stream“), englische Meldungen statt deutscher, `'  Hafenkontor Lindqvist GmbH '` statt getrimmt, Nummer `'  '` statt `C-1001`.

- [ ] **Step 4: `lang/de/validation.php` anlegen**

```php
<?php

// German messages of Laravel's built-in rules (keys as in vendor/laravel/framework/src/Illuminate/Translation/lang/en/validation.php,
// tests/Unit/ValidationTranslationTest.php keeps them in step). App messages live in lang/de.json.
return [
    'accepted' => ':attribute muss akzeptiert werden.',
    'accepted_if' => ':attribute muss akzeptiert werden, wenn :other :value ist.',
    'active_url' => ':attribute muss eine gültige URL sein.',
    'after' => ':attribute muss ein Datum nach dem :date sein.',
    'after_or_equal' => ':attribute muss ein Datum am oder nach dem :date sein.',
    'alpha' => ':attribute darf nur Buchstaben enthalten.',
    'alpha_dash' => ':attribute darf nur Buchstaben, Ziffern, Binde- und Unterstriche enthalten.',
    'alpha_num' => ':attribute darf nur Buchstaben und Ziffern enthalten.',
    'any_of' => ':attribute ist ungültig.',
    'array' => ':attribute muss eine Liste sein.',
    'array_keys' => ':attribute darf nur diese Schlüssel enthalten: :values.',
    'ascii' => ':attribute darf nur einfache Zeichen (ASCII) enthalten.',
    'base64' => ':attribute muss gültiges Base64 sein.',
    'before' => ':attribute muss ein Datum vor dem :date sein.',
    'before_or_equal' => ':attribute muss ein Datum am oder vor dem :date sein.',
    'between' => [
        'array' => ':attribute muss zwischen :min und :max Einträge haben.',
        'file' => ':attribute muss zwischen :min und :max Kilobyte groß sein.',
        'numeric' => ':attribute muss zwischen :min und :max liegen.',
        'string' => ':attribute muss zwischen :min und :max Zeichen lang sein.',
    ],
    'boolean' => ':attribute muss ja oder nein sein.',
    'can' => ':attribute enthält einen nicht erlaubten Wert.',
    'confirmed' => 'Die Bestätigung von :attribute stimmt nicht überein.',
    'contains' => 'In :attribute fehlt ein erforderlicher Wert.',
    'current_password' => 'Das Passwort ist falsch.',
    'date' => ':attribute muss ein gültiges Datum sein.',
    'date_equals' => ':attribute muss das Datum :date sein.',
    'date_format' => ':attribute muss das Format :format haben.',
    'decimal' => ':attribute muss :decimal Nachkommastellen haben.',
    'declined' => ':attribute muss abgelehnt werden.',
    'declined_if' => ':attribute muss abgelehnt werden, wenn :other :value ist.',
    'different' => ':attribute und :other müssen sich unterscheiden.',
    'digits' => ':attribute muss :digits Ziffern haben.',
    'digits_between' => ':attribute muss zwischen :min und :max Ziffern haben.',
    'dimensions' => ':attribute hat ungültige Bildmaße.',
    'distinct' => ':attribute enthält einen Wert doppelt.',
    'doesnt_contain' => ':attribute darf nichts davon enthalten: :values.',
    'doesnt_end_with' => ':attribute darf nicht auf eines davon enden: :values.',
    'doesnt_start_with' => ':attribute darf nicht mit einem davon beginnen: :values.',
    'email' => ':attribute muss eine gültige E-Mail-Adresse sein.',
    'encoding' => ':attribute muss in :encoding kodiert sein.',
    'ends_with' => ':attribute muss auf eines davon enden: :values.',
    'enum' => 'Der gewählte Wert für :attribute ist ungültig.',
    'exists' => 'Der gewählte Wert für :attribute ist ungültig.',
    'extensions' => ':attribute muss eine dieser Endungen haben: :values.',
    'file' => ':attribute muss eine Datei sein.',
    'filled' => ':attribute muss einen Wert haben.',
    'gt' => [
        'array' => ':attribute muss mehr als :value Einträge haben.',
        'file' => ':attribute muss größer als :value Kilobyte sein.',
        'numeric' => ':attribute muss größer als :value sein.',
        'string' => ':attribute muss länger als :value Zeichen sein.',
    ],
    'gte' => [
        'array' => ':attribute muss mindestens :value Einträge haben.',
        'file' => ':attribute muss mindestens :value Kilobyte groß sein.',
        'numeric' => ':attribute muss mindestens :value sein.',
        'string' => ':attribute muss mindestens :value Zeichen lang sein.',
    ],
    'hex_color' => ':attribute muss eine gültige Hex-Farbe sein.',
    'image' => ':attribute muss ein Bild sein.',
    'in' => 'Der gewählte Wert für :attribute ist ungültig.',
    'in_array' => ':attribute muss in :other vorkommen.',
    'in_array_keys' => ':attribute muss mindestens einen dieser Schlüssel enthalten: :values.',
    'integer' => ':attribute muss eine ganze Zahl sein.',
    'ip' => ':attribute muss eine gültige IP-Adresse sein.',
    'ipv4' => ':attribute muss eine gültige IPv4-Adresse sein.',
    'ipv6' => ':attribute muss eine gültige IPv6-Adresse sein.',
    'json' => ':attribute muss gültiges JSON sein.',
    'list' => ':attribute muss eine Liste sein.',
    'lowercase' => ':attribute muss kleingeschrieben sein.',
    'lt' => [
        'array' => ':attribute muss weniger als :value Einträge haben.',
        'file' => ':attribute muss kleiner als :value Kilobyte sein.',
        'numeric' => ':attribute muss kleiner als :value sein.',
        'string' => ':attribute muss kürzer als :value Zeichen sein.',
    ],
    'lte' => [
        'array' => ':attribute darf höchstens :value Einträge haben.',
        'file' => ':attribute darf höchstens :value Kilobyte groß sein.',
        'numeric' => ':attribute darf höchstens :value sein.',
        'string' => ':attribute darf höchstens :value Zeichen lang sein.',
    ],
    'mac_address' => ':attribute muss eine gültige MAC-Adresse sein.',
    'max' => [
        'array' => ':attribute darf höchstens :max Einträge haben.',
        'file' => ':attribute darf höchstens :max Kilobyte groß sein.',
        'numeric' => ':attribute darf nicht größer als :max sein.',
        'string' => ':attribute darf höchstens :max Zeichen lang sein.',
    ],
    'max_digits' => ':attribute darf höchstens :max Ziffern haben.',
    'mimes' => ':attribute muss eine Datei dieses Typs sein: :values.',
    'mimetypes' => ':attribute muss eine Datei dieses Typs sein: :values.',
    'min' => [
        'array' => ':attribute muss mindestens :min Einträge haben.',
        'file' => ':attribute muss mindestens :min Kilobyte groß sein.',
        'numeric' => ':attribute muss mindestens :min sein.',
        'string' => ':attribute muss mindestens :min Zeichen lang sein.',
    ],
    'min_digits' => ':attribute muss mindestens :min Ziffern haben.',
    'missing' => ':attribute darf nicht vorhanden sein.',
    'missing_if' => ':attribute darf nicht vorhanden sein, wenn :other :value ist.',
    'missing_unless' => ':attribute darf nicht vorhanden sein, außer :other ist :value.',
    'missing_with' => ':attribute darf nicht vorhanden sein, wenn :values vorhanden ist.',
    'missing_with_all' => ':attribute darf nicht vorhanden sein, wenn :values vorhanden sind.',
    'multiple_of' => ':attribute muss ein Vielfaches von :value sein.',
    'not_in' => 'Der gewählte Wert für :attribute ist ungültig.',
    'not_regex' => 'Das Format von :attribute ist ungültig.',
    'numeric' => ':attribute muss eine Zahl sein.',
    'password' => [
        'letters' => ':attribute muss mindestens einen Buchstaben enthalten.',
        'mixed' => ':attribute muss mindestens einen Groß- und einen Kleinbuchstaben enthalten.',
        'numbers' => ':attribute muss mindestens eine Ziffer enthalten.',
        'symbols' => ':attribute muss mindestens ein Sonderzeichen enthalten.',
        'uncompromised' => 'Dieses :attribute ist in einem Datenleck aufgetaucht. Bitte wähle ein anderes :attribute.',
    ],
    'present' => ':attribute muss vorhanden sein.',
    'present_if' => ':attribute muss vorhanden sein, wenn :other :value ist.',
    'present_unless' => ':attribute muss vorhanden sein, außer :other ist :value.',
    'present_with' => ':attribute muss vorhanden sein, wenn :values vorhanden ist.',
    'present_with_all' => ':attribute muss vorhanden sein, wenn :values vorhanden sind.',
    'prohibited' => ':attribute ist nicht erlaubt.',
    'prohibited_if' => ':attribute ist nicht erlaubt, wenn :other :value ist.',
    'prohibited_if_accepted' => ':attribute ist nicht erlaubt, wenn :other akzeptiert ist.',
    'prohibited_if_declined' => ':attribute ist nicht erlaubt, wenn :other abgelehnt ist.',
    'prohibited_unless' => ':attribute ist nicht erlaubt, außer :other ist in :values.',
    'prohibits' => ':attribute verbietet, dass :other vorhanden ist.',
    'regex' => 'Das Format von :attribute ist ungültig.',
    'required' => ':attribute ist erforderlich.',
    'required_array_keys' => ':attribute muss Einträge für :values enthalten.',
    'required_if' => ':attribute ist erforderlich, wenn :other :value ist.',
    'required_if_accepted' => ':attribute ist erforderlich, wenn :other akzeptiert ist.',
    'required_if_declined' => ':attribute ist erforderlich, wenn :other abgelehnt ist.',
    'required_unless' => ':attribute ist erforderlich, außer :other ist in :values.',
    'required_with' => ':attribute ist erforderlich, wenn :values vorhanden ist.',
    'required_with_all' => ':attribute ist erforderlich, wenn :values vorhanden sind.',
    'required_without' => ':attribute ist erforderlich, wenn :values fehlt.',
    'required_without_all' => ':attribute ist erforderlich, wenn keines von :values vorhanden ist.',
    'same' => ':attribute und :other müssen übereinstimmen.',
    'size' => [
        'array' => ':attribute muss genau :size Einträge enthalten.',
        'file' => ':attribute muss :size Kilobyte groß sein.',
        'numeric' => ':attribute muss :size sein.',
        'string' => ':attribute muss genau :size Zeichen lang sein.',
    ],
    'starts_with' => ':attribute muss mit einem davon beginnen: :values.',
    'string' => ':attribute muss ein Text sein.',
    'timezone' => ':attribute muss eine gültige Zeitzone sein.',
    'unique' => ':attribute ist bereits vergeben.',
    'uploaded' => ':attribute konnte nicht hochgeladen werden.',
    'uppercase' => ':attribute muss großgeschrieben sein.',
    'url' => ':attribute muss eine gültige URL sein.',
    'ulid' => ':attribute muss eine gültige ULID sein.',
    'uuid' => ':attribute muss eine gültige UUID sein.',

    'custom' => [],

    // field names in messages; nested paths through their wildcard form
    'attributes' => [
        'name' => 'Name',
        'number' => 'Nummer',
        'street' => 'Straße',
        'zip' => 'PLZ',
        'city' => 'Ort',
        'country' => 'Land',
        'email' => 'E-Mail',
        'password' => 'Passwort',
        'vat_id' => 'USt-ID',
        'tax_number' => 'Steuernummer',
        'registration_id' => 'Registernummer',
        'tax_treatment' => 'Steuerbehandlung',
        'locale' => 'Sprache',
        'type' => 'Art',
        'status' => 'Status',
        'date' => 'Datum',
        'customer_id' => 'Kunde',
        'contact_id' => 'Ansprechpartner',
        'due_date' => 'Fälligkeit',
        'valid_until' => 'Gültig bis',
        'service_date' => 'Leistungsdatum',
        'label' => 'Bezeichnung',
        'key' => 'Schlüssel',
        'contacts.*.salutation' => 'Anrede',
        'contacts.*.first_name' => 'Vorname',
        'contacts.*.last_name' => 'Nachname',
        'contacts.*.position' => 'Position',
        'contacts.*.email' => 'E-Mail',
        'contacts.*.phone' => 'Telefon',
    ],
];
```

- [ ] **Step 5: `SaveCustomer` trimmen lassen**

In `app/Actions/SaveCustomer.php` als erste Zeile von `handle()` (vor `Validator::make`):

```php
        $input = self::trimmed($input);
```

In der Transaktion die Nummernvergabe ersetzen. Vorher:

```php
            if (($data['number'] ?? null) !== null) {
                $customer->number = $data['number'];
            } elseif (! $customer->exists) {
                $customer->number = $this->nextNumber();
            }
```

Nachher:

```php
            // an empty number means "next number" for a new customer and "keep it" for an existing one
            if (($data['number'] ?? '') !== '') {
                $customer->number = $data['number'];
            } elseif (! $customer->exists) {
                $customer->number = $this->nextNumber();
            }
```

Neue private Methode (unter `nextNumber()`):

```php
    /**
     * Master data is stored without surrounding blanks. Laravel's TrimStrings middleware never sees the
     * JSON bodies of the API (API Platform reads the raw body), so the action trims itself.
     *
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    private static function trimmed(array $input): array
    {
        foreach (['number', 'name', ...self::STRINGS] as $key) {
            if (isset($input[$key]) && is_string($input[$key])) {
                $input[$key] = trim($input[$key]);
            }
        }
        if (isset($input['contacts']) && is_array($input['contacts'])) {
            foreach ($input['contacts'] as $i => $contact) {
                if (! is_array($contact)) {
                    continue;
                }
                foreach (self::CONTACT_STRINGS as $key) {
                    if (isset($contact[$key]) && is_string($contact[$key])) {
                        $input['contacts'][$i][$key] = trim($contact[$key]);
                    }
                }
            }
        }

        return $input;
    }
```

- [ ] **Step 6: Tests laufen lassen, sie sind grün**

Run: `ddev artisan test --filter='ValidationTranslationTest|ValidationLocaleTest|SaveCustomerTrimTest|CustomerApiTest|AuthTest'`
Expected: PASS (alle). Falls `ValidationTranslationTest` Schlüssel meldet, die die Framework-Datei in dieser Laravel-Version zusätzlich hat: in `lang/de/validation.php` ergänzen (gleiche Platzhalter), nicht den Test lockern.

- [ ] **Step 7: Gesamte Suite, Larastan, Pint**

Run: `ddev exec vendor/bin/pint && ddev exec vendor/bin/phpstan analyse --memory-limit=1G && ddev artisan test`
Expected: Pint formatiert, `[OK] No errors`, alle Tests grün (insbesondere `AuthTest` mit `'Zu viele Anmeldeversuche'` bleibt grün, weil `login.*` aus `de.json` kommt).

- [ ] **Step 8: Commit**

```bash
git add lang/de/validation.php app/Actions/SaveCustomer.php tests/Unit/ValidationTranslationTest.php tests/Feature/ValidationLocaleTest.php tests/Feature/Actions/SaveCustomerTrimTest.php
git commit -m "fix: German validation messages and trimmed customer master data" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Design-Tokens, Schrift, Theme und Vitest

**Files:**
- Modify: `package.json` (Abhängigkeiten, Skript `test`), `pnpm-lock.yaml`
- Rewrite: `resources/css/app.css`
- Modify: `resources/views/app.blade.php`
- Modify: `resources/js/app.tsx`
- Create: `resources/js/lib/theme.ts`, `resources/js/lib/theme.test.ts`
- Create: `vitest.config.ts`
- Modify: `.github/workflows/tests.yml` (Schritt `Vitest`)

**Interfaces:**
- Consumes: nichts aus früheren Tasks.
- Produces: Tailwind-Utilities `bg-bg|surface|surface-2|surface-3|panel|accent|accent-soft|accent-soft-hover|ok(-soft)|warn(-soft)|bad(-soft)|ink|overlay`, `text-ink|muted|faint|accent|accent-ink|ok|warn|bad`, `text-xs|sm|md|lg|xl|2xl|3xl` (12/13/14/16/20/26/34 px), `font-strong` (550), `font-heading` (650), `tracking-heading|title|brand`, `rounded-sm|md|lg|xl` (8/12/18/24), `h-control`/`w-control` (38 px), `h-control-sm`/`w-control-sm` (32 px), `shadow-float|paper|tab`, `animate-fade-in|pop-in|menu-in|overlay-in|slide-in|shimmer`, `ease-soft`, Utility `num`, Variante `dark:`, Breakpoints `xs` 520 / `sm` 720 / `md` 900 / `lg` 1100 px. `lib/theme.ts`: `type ThemePref`, `isThemePref`, `resolveTheme`, `readThemePref`, `getThemePref`, `setThemePref`, `applyTheme`, `watchSystemTheme`, `useThemePref`. `pnpm test` (Vitest).

- [ ] **Step 1: Abhängigkeiten installieren**

Run:

```bash
ddev exec pnpm add -w swr @radix-ui/react-dialog @radix-ui/react-dropdown-menu lucide-react @fontsource-variable/schibsted-grotesk
ddev exec pnpm add -w -D vitest
```

Expected: `package.json` listet die Pakete (`lucide-react` und `@fontsource-variable/schibsted-grotesk` in denselben Hauptversionen wie in `prototypes/clickdummy-v2/package.json`, `vitest` ^5). Bricht `pnpm add` mit einem Hinweis auf Build-Skripte ab, das genannte Paket in `pnpm-workspace.yaml` unter `allowBuilds` mit `false` eintragen (keines davon braucht ein natives Binary) und den Befehl wiederholen.

In `package.json` unter `scripts` ergänzen:

```json
        "test": "vitest run",
```

- [ ] **Step 2: Failing test für die Theme-Regel schreiben**

`vitest.config.ts`:

```ts
import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Unit tests of resources/js: plain functions only (lib/, api/keys, layouts/nav). Pages are covered by Pest
// (Inertia props) and Playwright (e2e/), so there is no DOM here.
export default defineConfig({
    resolve: { alias: { '@': path.resolve(import.meta.dirname, 'resources/js') } },
    test: {
        include: ['resources/js/**/*.test.ts'],
        environment: 'node',
    },
});
```

`resources/js/lib/theme.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isThemePref, resolveTheme } from './theme';

describe('resolveTheme', () => {
    it('follows the system only for "system"', () => {
        expect(resolveTheme('system', true)).toBe('dark');
        expect(resolveTheme('system', false)).toBe('light');
        expect(resolveTheme('light', true)).toBe('light');
        expect(resolveTheme('dark', false)).toBe('dark');
    });
});

describe('isThemePref', () => {
    it('accepts the three preferences only', () => {
        expect(['system', 'light', 'dark'].every(isThemePref)).toBe(true);
        expect(isThemePref('blue')).toBe(false);
        expect(isThemePref(null)).toBe(false);
    });
});
```

- [ ] **Step 3: Test laufen lassen, er schlägt fehl**

Run: `ddev exec pnpm test`
Expected: FAIL – `Failed to resolve import "./theme"`.

- [ ] **Step 4: `resources/js/lib/theme.ts` schreiben**

```ts
import { useSyncExternalStore } from 'react';

export type ThemePref = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

/** Same key and rule as the inline script in resources/views/app.blade.php (it runs before the first paint). */
const KEY = 'openbill:theme';
const listeners = new Set<() => void>();
let current: ThemePref | null = null;

export function isThemePref(value: unknown): value is ThemePref {
    return value === 'system' || value === 'light' || value === 'dark';
}

export function resolveTheme(pref: ThemePref, prefersDark: boolean): Theme {
    return pref === 'dark' || (pref === 'system' && prefersDark) ? 'dark' : 'light';
}

export function readThemePref(): ThemePref {
    try {
        const value = window.localStorage.getItem(KEY);
        return isThemePref(value) ? value : 'system';
    } catch {
        return 'system';
    }
}

export function getThemePref(): ThemePref {
    current ??= readThemePref();
    return current;
}

const prefersDark = (): boolean => window.matchMedia('(prefers-color-scheme: dark)').matches;

/** Sets data-theme on <html>; every color token switches with it. */
export function applyTheme(pref: ThemePref = getThemePref()): void {
    document.documentElement.dataset.theme = resolveTheme(pref, prefersDark());
}

export function setThemePref(pref: ThemePref): void {
    current = pref;
    try {
        window.localStorage.setItem(KEY, pref);
    } catch {
        // storage blocked (private mode): the choice lasts until the next page load
    }
    applyTheme(pref);
    listeners.forEach((listener) => listener());
}

/** Follows changes of the OS setting while the preference is "system". Call once (app.tsx). */
export function watchSystemTheme(): () => void {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
        if (getThemePref() === 'system') applyTheme('system');
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function useThemePref(): ThemePref {
    return useSyncExternalStore(subscribe, getThemePref, () => 'system');
}
```

- [ ] **Step 5: Test laufen lassen, er ist grün**

Run: `ddev exec pnpm test`
Expected: PASS – `2 passed` in `resources/js/lib/theme.test.ts`.

- [ ] **Step 6: Tokens in `resources/css/app.css` (ganze Datei ersetzen)**

```css
/* Only resources/ is scanned: the prototypes and docs carry their own (old) classes. */
@import 'tailwindcss' source(none);
@source '../js';
@source '../views';

/* dark: follows data-theme on <html> (set before the first paint in resources/views/app.blade.php), not the OS */
@custom-variant dark (&:where([data-theme='dark'], [data-theme='dark'] *));

/*
 * "Graphit & Kobalt" (prototypes/clickdummy-v2/DESIGN.md, values from src/styles/tokens.css).
 * Layers come from tone (bg → surface → surface-2), never from borders or stacked shadows.
 * Dark mode assigns the same names again; components only use the Tailwind names from @theme below.
 */
:root {
    --bg: #f4f4f2;
    --surface: #ffffff;
    --surface-2: #ecece9;
    --surface-3: #e3e3df;
    --ink: #23252b;
    --muted: #73767e;
    --faint: #a2a4aa;
    --accent: #2f55d4;
    --accent-hover: #2647b8;
    --accent-ink: #ffffff;
    --accent-soft: #e3e9fb;
    --accent-soft-hover: #d5def8;
    --ok: #2e7d4f;
    --ok-soft: #dff0e5;
    --warn: #8f5b00;
    --warn-soft: #faefd7;
    --bad: #b4322e;
    --bad-soft: #fbe3e1;
    --overlay: rgb(28 30 36 / 0.32);
    --elev-paper: 0 1px 2px rgb(20 22 30 / 0.06), 0 16px 36px -18px rgb(20 22 30 / 0.28);
    --elev-float: 0 1px 2px rgb(20 22 30 / 0.06), 0 18px 48px -12px rgb(20 22 30 / 0.22);
    --elev-tab: 0 1px 2px rgb(20 22 30 / 0.08);
    --font: 'Schibsted Grotesk Variable', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
    --font-code: ui-monospace, 'SF Mono', 'Cascadia Code', Menlo, monospace;
    color-scheme: light;
}

:root[data-theme='dark'] {
    --bg: #16171a;
    --surface: #1f2024;
    --surface-2: #292a2f;
    --surface-3: #33343a;
    --ink: #ececee;
    --muted: #9a9ca3;
    --faint: #686a71;
    --accent: #829bf3;
    --accent-hover: #9aaff6;
    --accent-ink: #0d1330;
    --accent-soft: #252e52;
    --accent-soft-hover: #2e3963;
    --ok: #6cc891;
    --ok-soft: #173326;
    --warn: #e3b158;
    --warn-soft: #3a2c10;
    --bad: #f08a84;
    --bad-soft: #3d1a18;
    --overlay: rgb(0 0 0 / 0.55);
    --elev-paper: 0 1px 2px rgb(0 0 0 / 0.4), 0 18px 40px -16px rgb(0 0 0 / 0.7);
    --elev-float: 0 1px 2px rgb(0 0 0 / 0.4), 0 20px 50px -12px rgb(0 0 0 / 0.6);
    --elev-tab: 0 1px 2px rgb(0 0 0 / 0.4);
    color-scheme: dark;
}

/* no Tailwind palette: only the tokens exist (plus white/black for overlays on ink and bad) */
@theme {
    --color-*: initial;
    --color-white: #ffffff;
    --color-black: #000000;
}

@theme inline {
    --color-bg: var(--bg);
    --color-surface: var(--surface);
    --color-surface-2: var(--surface-2);
    --color-surface-3: var(--surface-3);
    /* tinted panel inside the white workspace (lists, overview panels) */
    --color-panel: color-mix(in srgb, var(--surface-2) 45%, var(--surface));
    --color-ink: var(--ink);
    --color-muted: var(--muted);
    --color-faint: var(--faint);
    --color-accent: var(--accent);
    --color-accent-hover: var(--accent-hover);
    --color-accent-ink: var(--accent-ink);
    --color-accent-soft: var(--accent-soft);
    --color-accent-soft-hover: var(--accent-soft-hover);
    --color-ok: var(--ok);
    --color-ok-soft: var(--ok-soft);
    --color-warn: var(--warn);
    --color-warn-soft: var(--warn-soft);
    --color-bad: var(--bad);
    --color-bad-soft: var(--bad-soft);
    --color-overlay: var(--overlay);

    --font-sans: var(--font);
    --font-mono: var(--font-code);

    --shadow-float: var(--elev-float);
    --shadow-paper: var(--elev-paper);
    --shadow-tab: var(--elev-tab);
}

@theme {
    /* type scale 12 / 13 / 14 (base) / 16 / 20 / 26 / 34 px */
    --text-xs: 0.75rem;
    --text-xs--line-height: 1.5;
    --text-sm: 0.8125rem;
    --text-sm--line-height: 1.5;
    --text-md: 0.875rem;
    --text-md--line-height: 1.5;
    --text-lg: 1rem;
    --text-lg--line-height: 1.4;
    --text-xl: 1.25rem;
    --text-xl--line-height: 1.25;
    --text-2xl: 1.625rem;
    --text-2xl--line-height: 1.2;
    --text-3xl: 2.125rem;
    --text-3xl--line-height: 1.15;

    --font-weight-strong: 550;
    --font-weight-heading: 650;

    --tracking-heading: -0.025em;
    --tracking-title: -0.035em;
    --tracking-brand: -0.04em;

    --radius-sm: 8px;
    --radius-md: 12px;
    --radius-lg: 18px;
    --radius-xl: 24px;

    --spacing-control: 2.375rem;
    --spacing-control-sm: 2rem;

    /* breakpoints of the clickdummy CSS (it is desktop first; Tailwind is mobile first) */
    --breakpoint-xs: 32.5rem;
    --breakpoint-sm: 45rem;
    --breakpoint-md: 56.25rem;
    --breakpoint-lg: 68.75rem;
    --breakpoint-xl: 80rem;

    --ease-soft: cubic-bezier(0.2, 0, 0, 1);
    --default-transition-duration: 180ms;
    --default-transition-timing-function: cubic-bezier(0.2, 0, 0, 1);

    --animate-fade-in: fade-in 180ms cubic-bezier(0.2, 0, 0, 1) both;
    --animate-pop-in: pop-in 220ms cubic-bezier(0.2, 0, 0, 1);
    --animate-menu-in: pop-in 160ms cubic-bezier(0.2, 0, 0, 1);
    --animate-overlay-in: overlay-in 180ms cubic-bezier(0.2, 0, 0, 1);
    --animate-slide-in: slide-in 220ms cubic-bezier(0.2, 0, 0, 1);
    --animate-shimmer: shimmer 1.6s ease infinite;

    @keyframes fade-in {
        from {
            opacity: 0;
            transform: translateY(4px);
        }
        to {
            opacity: 1;
            transform: none;
        }
    }
    @keyframes pop-in {
        from {
            opacity: 0;
            transform: translateY(8px) scale(0.985);
        }
        to {
            opacity: 1;
            transform: none;
        }
    }
    @keyframes overlay-in {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }
    @keyframes slide-in {
        from {
            opacity: 0;
            transform: translateX(16px);
        }
        to {
            opacity: 1;
            transform: none;
        }
    }
    @keyframes shimmer {
        from {
            background-position: 200% 0;
        }
        to {
            background-position: -200% 0;
        }
    }
}

@layer base {
    body {
        min-height: 100dvh;
        background: var(--bg);
        color: var(--ink);
        font-family: var(--font);
        font-size: 0.875rem;
        line-height: 1.5;
        -webkit-font-smoothing: antialiased;
        font-feature-settings: 'ss01';
    }

    h1,
    h2,
    h3,
    h4 {
        font-weight: 650;
        letter-spacing: -0.025em;
        line-height: 1.2;
        text-wrap: balance;
    }

    ::selection {
        background: var(--accent-soft);
    }

    :focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
    }

    /* Tailwind 4 resets buttons to the default cursor */
    button:not(:disabled),
    [role='button']:not([aria-disabled='true']) {
        cursor: pointer;
    }
}

/* amounts, numbers and dates: proportional lining figures (the tabular figures of Schibsted Grotesk look like a typewriter) */
@utility num {
    font-variant-numeric: proportional-nums lining-nums;
}

@media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
        animation-duration: 1ms !important;
        transition-duration: 1ms !important;
    }
}
```

- [ ] **Step 7: Theme vor dem ersten Paint (`resources/views/app.blade.php`)**

Die Zeile `<meta name="theme-color" content="#f4f4f2">` ersetzen durch:

```html
    <meta name="theme-color" content="#f4f4f2" media="(prefers-color-scheme: light)">
    <meta name="theme-color" content="#16171a" media="(prefers-color-scheme: dark)">
    <script>
        // theme before the first paint, same key and rule as resources/js/lib/theme.ts (no flash of the wrong theme)
        (function () {
            var pref = 'system';
            try { pref = localStorage.getItem('openbill:theme') || 'system'; } catch (e) {}
            var dark = pref === 'dark' || (pref !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
            document.documentElement.dataset.theme = dark ? 'dark' : 'light';
        })();
    </script>
```

- [ ] **Step 8: Schrift und Theme in `resources/js/app.tsx`**

```tsx
import '@fontsource-variable/schibsted-grotesk';
import { createInertiaApp, router } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';
import { getLocale, initI18n } from '@/lib/i18n';
import { applyTheme, watchSystemTheme } from '@/lib/theme';
import type { SharedProps } from '@/types';

createInertiaApp({
    title: (title) => (title ? `${title} – openbill` : 'openbill'),
    resolve: (name) => {
        const pages = import.meta.glob('./pages/**/*.tsx', { eager: true });
        return pages[`./pages/${name}.tsx`] as never;
    },
    setup({ el, App, props }) {
        initI18n(props.initialPage.props as unknown as SharedProps);
        applyTheme();
        watchSystemTheme();
        // translations are set once per page load: a visit that lands in another language reloads
        router.on('navigate', (event) => {
            if (event.detail.page.props.locale !== getLocale()) window.location.reload();
        });
        createRoot(el).render(<App {...props} />);
    },
    progress: { color: '#2F55D4', showSpinner: false },
});
```

- [ ] **Step 9: CI-Schritt Vitest**

In `.github/workflows/tests.yml` direkt nach dem Schritt `TypeScript` einfügen:

```yaml
      # unit tests of resources/js (lib/api.ts, formatting, keys, navigation)
      - name: Vitest
        run: pnpm test
```

- [ ] **Step 10: Prüfen: Typen, Build, CSS enthält Tokens und Schrift**

Run:

```bash
ddev exec pnpm typecheck
ddev exec pnpm build
ddev exec 'grep -l "Schibsted Grotesk Variable" public/build/assets/*.css'
ddev exec 'grep -lF "data-theme=dark" public/build/assets/*.css'
ddev exec 'grep -cF -- "--color-red-500" public/build/assets/*.css || true'
```

Expected: `tsc` ohne Fehler; Build fertig; eine CSS-Datei mit `Schibsted Grotesk Variable` (die `@font-face` aus Fontsource), `data-theme=dark` (Variante) und Zählung `0` für `--color-red-500` (Palette entfernt). Danach im Browser `https://openbill.ddev.site/en/login` öffnen, in den DevTools `localStorage.setItem('openbill:theme','dark')` setzen und neu laden: Hintergrund `#16171a` ohne hellen Blitz.

- [ ] **Step 11: Commit**

```bash
git add package.json pnpm-lock.yaml pnpm-workspace.yaml resources/css/app.css resources/views/app.blade.php resources/js/app.tsx resources/js/lib/theme.ts resources/js/lib/theme.test.ts vitest.config.ts .github/workflows/tests.yml
git commit -m "feat: design tokens with dark mode, Schibsted Grotesk and Vitest" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Formatierung (`lib/format.ts`) und Sprachwechsel-Link

**Files:**
- Create: `resources/js/lib/format.ts`, `resources/js/lib/format.test.ts`
- Modify: `resources/js/lib/i18n.ts` (neu: `localeHref`), Create: `resources/js/lib/i18n.test.ts`
- Modify: `resources/js/components/locale-switch.tsx` (nutzt `localeHref`)

**Interfaces:**
- Consumes: `getLocale()` aus `resources/js/lib/i18n.ts`.
- Produces: `intlLocale(locale?)`, `formatMoney(amount: string, locale?)`, `formatDate(iso: string | null | undefined, locale?)`, `formatMonth(key: string, locale?)`, `formatLongDate(date: Date, locale?)`, `monthName(date: Date, locale?)`, `daysBetween(fromIso, toIso)`, `relativeDays(iso, todayIso, locale?)`, `todayIso(now?)`, `groupByMonth<T extends { date: string }>(rows): { key: string; items: T[] }[]`, `initials(name)`, `countryName(code, locale?)`, `toDecimalString(raw): string | null`; `localeHref(locale, location?)`.

- [ ] **Step 1: Failing tests schreiben**

`resources/js/lib/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
    countryName,
    daysBetween,
    formatDate,
    formatLongDate,
    formatMoney,
    formatMonth,
    groupByMonth,
    initials,
    relativeDays,
    toDecimalString,
    todayIso,
} from './format';

// Intl puts a no-break space between amount and currency in German
const plain = (text: string) => text.replace(/[  ]/g, ' ');

describe('formatMoney', () => {
    it('formats amount strings in the UI language', () => {
        expect(plain(formatMoney('1234.5', 'de'))).toBe('1.234,50 €');
        expect(formatMoney('1234.5', 'en')).toBe('€1,234.50');
    });

    it('keeps negative amounts of cancellations', () => {
        expect(plain(formatMoney('-119.00', 'de'))).toBe('-119,00 €');
    });

    it('is exact beyond the precision of floats', () => {
        // as a float this would be 9007199254740992
        expect(formatMoney('9007199254740993.10', 'en')).toBe('€9,007,199,254,740,993.10');
    });
});

describe('dates', () => {
    it('formats ISO dates without shifting the day', () => {
        expect(formatDate('2026-10-11', 'de')).toBe('11.10.2026');
        expect(formatDate('2026-10-11', 'en')).toBe('11/10/2026');
        expect(formatDate(null, 'de')).toBe('');
    });

    it('names months and long dates', () => {
        expect(formatMonth('2026-03', 'de')).toBe('März 2026');
        expect(formatMonth('2026-03', 'en')).toBe('March 2026');
        expect(formatLongDate(new Date(2026, 9, 11), 'de')).toBe('Sonntag, 11. Oktober');
    });

    it('counts days and says them relative to today', () => {
        expect(daysBetween('2026-10-11', '2026-10-14')).toBe(3);
        expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2); // across the DST change
        expect(relativeDays('2026-10-11', '2026-10-11', 'de')).toBe('heute');
        expect(relativeDays('2026-10-12', '2026-10-11', 'de')).toBe('morgen');
        expect(relativeDays('2026-10-08', '2026-10-11', 'de')).toBe('vor 3 Tagen');
        expect(relativeDays('2026-10-14', '2026-10-11', 'en')).toBe('in 3 days');
    });

    it('gives today as local ISO date', () => {
        expect(todayIso(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    });
});

describe('groupByMonth', () => {
    it('groups by month, newest first, keeping the order inside a month', () => {
        const rows = [
            { id: 'a', date: '2026-10-02' },
            { id: 'b', date: '2026-09-30' },
            { id: 'c', date: '2026-10-20' },
        ];

        expect(groupByMonth(rows)).toEqual([
            { key: '2026-10', items: [rows[0], rows[2]] },
            { key: '2026-09', items: [rows[1]] },
        ]);
        expect(groupByMonth([])).toEqual([]);
    });
});

describe('names', () => {
    it('builds initials without legal forms', () => {
        expect(initials('Hafenkontor Lindqvist GmbH')).toBe('HL');
        expect(initials('Kulturwerk Elbinsel e. V.')).toBe('KE');
        expect(initials('Fjord Analytics AB')).toBe('FA');
        expect(initials('   ')).toBe('?');
    });

    it('names countries in the UI language', () => {
        expect(countryName('SE', 'de')).toBe('Schweden');
        expect(countryName('se', 'en')).toBe('Sweden');
        expect(countryName('', 'de')).toBe('');
    });
});

describe('toDecimalString', () => {
    it('turns typed numbers into API strings with a dot', () => {
        expect(toDecimalString('12,50')).toBe('12.50');
        expect(toDecimalString('1.234,5')).toBe('1234.5');
        expect(toDecimalString(' 12.5 ')).toBe('12.5');
        expect(toDecimalString('-3')).toBe('-3');
        expect(toDecimalString('')).toBeNull();
        expect(toDecimalString('abc')).toBe('abc'); // left for the server to refuse with a message
    });
});
```

`resources/js/lib/i18n.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { localeHref } from './i18n';

describe('localeHref', () => {
    it('swaps the language prefix and keeps path and query', () => {
        expect(localeHref('de', { pathname: '/en/documents', search: '?type=invoice' })).toBe('/de/documents?type=invoice');
        expect(localeHref('en', { pathname: '/de', search: '' })).toBe('/en');
        expect(localeHref('de', { pathname: '/en/customers/01k9', search: '' })).toBe('/de/customers/01k9');
    });
});
```

- [ ] **Step 2: Tests laufen lassen, sie schlagen fehl**

Run: `ddev exec pnpm test`
Expected: FAIL – `Failed to resolve import "./format"` und `localeHref is not a function`.

- [ ] **Step 3: `resources/js/lib/format.ts` schreiben**

```ts
import { getLocale } from '@/lib/i18n';

/** Intl locale of a UI language (English with day-month order, as in the rest of Europe). */
export function intlLocale(locale: string = getLocale()): string {
    return locale === 'de' ? 'de-DE' : 'en-GB';
}

/**
 * Amount string of the API ("1130.50", "-119.00") as money. Intl.NumberFormat formats decimal strings
 * exactly (ES2023), so the amount never becomes a float. openbill has one currency (spec 13).
 */
export function formatMoney(amount: string, locale?: string): string {
    const format = new Intl.NumberFormat(intlLocale(locale), { style: 'currency', currency: 'EUR' }).format as (value: string) => string;
    return format(amount);
}

const atNoon = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`);

export function formatDate(iso: string | null | undefined, locale?: string): string {
    if (!iso) return '';
    return new Intl.DateTimeFormat(intlLocale(locale), { day: '2-digit', month: '2-digit', year: 'numeric' }).format(atNoon(iso));
}

/** "2026-03" → "March 2026" / "März 2026". */
export function formatMonth(key: string, locale?: string): string {
    return new Intl.DateTimeFormat(intlLocale(locale), { month: 'long', year: 'numeric' }).format(atNoon(`${key}-01`));
}

export function formatLongDate(date: Date, locale?: string): string {
    return new Intl.DateTimeFormat(intlLocale(locale), { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
}

export function monthName(date: Date, locale?: string): string {
    return new Intl.DateTimeFormat(intlLocale(locale), { month: 'long' }).format(date);
}

/** Whole days from one ISO date to another (calendar days, DST-safe). */
export function daysBetween(fromIso: string, toIso: string): number {
    const utc = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
    return Math.round((utc(toIso) - utc(fromIso)) / 86_400_000);
}

/** "today", "tomorrow", "3 days ago", "in 3 days" in the UI language. */
export function relativeDays(iso: string, today: string, locale?: string): string {
    return new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: 'auto' }).format(daysBetween(today, iso), 'day');
}

/** Today in the browser's time zone as YYYY-MM-DD. */
export function todayIso(now: Date = new Date()): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Rows grouped by the month of their date, newest month first; the order inside a month stays. */
export function groupByMonth<T extends { date: string }>(rows: T[]): { key: string; items: T[] }[] {
    const groups = new Map<string, T[]>();
    for (const row of rows) {
        const key = row.date.slice(0, 7);
        groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    return [...groups.entries()].map(([key, items]) => ({ key, items })).sort((a, b) => b.key.localeCompare(a.key));
}

/** Two letters for an avatar; legal forms like GmbH or e. V. don't count. */
export function initials(name: string): string {
    const words = name
        .replace(/\b(GmbH|AG|AB|KG|UG|Ltd|Inc|e\.\s?V\.)(?=\s|$)/gi, '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    return (
        words
            .slice(0, 2)
            .map((word) => word[0]?.toUpperCase() ?? '')
            .join('') || '?'
    );
}

export function countryName(code: string, locale?: string): string {
    if (!code) return '';
    try {
        return new Intl.DisplayNames([intlLocale(locale)], { type: 'region' }).of(code.toUpperCase()) ?? code;
    } catch {
        return code;
    }
}

/**
 * Typed number → API string with a dot ("12,50" → "12.50", "1.234,5" → "1234.5"). Empty → null.
 * Anything else stays as typed, so the server answers with a message for that field.
 */
export function toDecimalString(raw: string): string | null {
    const value = raw.trim().replace(/\s/g, '');
    if (value === '') return null;
    return value.includes(',') ? value.replace(/\./g, '').replace(',', '.') : value;
}
```

- [ ] **Step 4: `localeHref` in `resources/js/lib/i18n.ts` ergänzen**

Am Ende der Datei:

```ts
/** The same page in another language. A full page load, because translations are loaded once per page. */
export function localeHref(target: string, location: { pathname: string; search: string } = window.location): string {
    return location.pathname.replace(/^\/(en|de)(?=\/|$)/, `/${target}`) + location.search;
}
```

`resources/js/components/locale-switch.tsx` (ganze Datei, neue Gestaltung als Pillen):

```tsx
import { getLocale, localeHref, t } from '@/lib/i18n';
import type { Locale } from '@/types';

/** Same page in the other language (full page load, translations are loaded once per page). */
export function LocaleSwitch() {
    const labels: Record<Locale, string> = { en: t('locale.en'), de: t('locale.de') };

    return (
        <nav aria-label={t('locale.switch')} className="flex gap-1">
            {(Object.keys(labels) as Locale[]).map((locale) => (
                <a
                    key={locale}
                    href={localeHref(locale)}
                    lang={locale}
                    aria-current={locale === getLocale() ? 'true' : undefined}
                    className="inline-flex h-8 items-center rounded-full px-3 text-sm font-medium text-muted no-underline transition-colors hover:bg-surface-2 hover:text-ink aria-[current=true]:bg-ink aria-[current=true]:text-bg"
                >
                    {labels[locale]}
                </a>
            ))}
        </nav>
    );
}
```

- [ ] **Step 5: Tests laufen lassen, sie sind grün**

Run: `ddev exec pnpm test`
Expected: PASS – alle Tests in `format.test.ts`, `i18n.test.ts`, `theme.test.ts`. Weicht eine Intl-Ausgabe ab (andere ICU-Version in Node 24), die **Erwartung** nur dann anpassen, wenn die Ausgabe fachlich gleich bleibt (z. B. anderes Leerzeichen), und den Grund im Test kommentieren.

- [ ] **Step 6: Typen prüfen und committen**

Run: `ddev exec pnpm typecheck`
Expected: keine Fehler.

```bash
git add resources/js/lib/format.ts resources/js/lib/format.test.ts resources/js/lib/i18n.ts resources/js/lib/i18n.test.ts resources/js/components/locale-switch.tsx
git commit -m "feat: exact money and date formatting for the UI" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: API-Client `lib/api.ts` (Session, CSRF, Problem Details)

**Files:**
- Create: `resources/js/lib/api.ts`, `resources/js/lib/api.test.ts`
- Modify: `lang/en.json`, `lang/de.json`

**Interfaces:**
- Consumes: `getLocale()`, `t()` aus `resources/js/lib/i18n.ts`; Phase-4-Fehlerformat (`application/problem+json`), Session-Auth über Sanctum (`XSRF-TOKEN`-Cookie), JSON-LD-Listen `{member, totalItems, view.next?}`.
- Produces: siehe Abschnitt „Interfaces → API-Client“ (`api`, `apiPage`, `apiUrl`, `ApiError`, `Problem`, `Violation`, `Page`, `errorMessage`, `setUnauthenticatedHandler`).

- [ ] **Step 1: Annahmen in DDEV prüfen**

Run:

```bash
ddev artisan route:list --path=sanctum
ddev artisan db:seed --class=DemoSeeder
TOKEN=$(ddev artisan app:create-token admin@example.com --ability=api:read | tail -1)
curl -s -H "Authorization: Bearer $TOKEN" -H 'Accept: application/ld+json' 'https://openbill.ddev.site/api/customers?itemsPerPage=2' | head -c 600; echo
```

Expected: eine Route `GET|HEAD sanctum/csrf-cookie`; die JSON-LD-Antwort enthält `"member":[…]`, `"totalItems":4` und `"view":{…,"next":"/api/customers?itemsPerPage=2&page=2"}` (ohne `hydra:`-Präfix). `admin@example.com` steht für `ADMIN_EMAIL` aus `.env` (wie in Phase 4); gibt es den Nutzer noch nicht, vorher `ddev artisan app:ensure-admin`. Fehlt die Sanctum-Route, im Code unten den 419-Wiederholungsweg auf `GET /{locale}/login` (setzt ebenfalls ein frisches `XSRF-TOKEN`) umstellen und das im Commit vermerken.

- [ ] **Step 2: Failing tests schreiben**

`resources/js/lib/api.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, apiPage, apiUrl, errorMessage, setUnauthenticatedHandler } from './api';

const json = (status: number, body: unknown, type = 'application/json') =>
    new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': type } });

const problem = (status: number, reason: string, extra: Record<string, unknown> = {}) =>
    json(status, { type: `urn:openbill:problem:${reason}`, title: 'Title', status, detail: `Detail ${reason}`, reason, ...extra }, 'application/problem+json');

let fetchMock: ReturnType<typeof vi.fn>;
let unauthenticated: ReturnType<typeof vi.fn>;

beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('document', { cookie: 'locale=en; XSRF-TOKEN=abc%3D%3D' });
    unauthenticated = vi.fn();
    setUnauthenticatedHandler(unauthenticated);
});

afterEach(() => vi.unstubAllGlobals());

const sent = (call = 0) => {
    const [url, init] = fetchMock.mock.calls[call] as [string, RequestInit];
    return { url, init, headers: init.headers as Record<string, string> };
};

describe('api', () => {
    it('reads JSON with the UI language and the session, without CSRF header', async () => {
        fetchMock.mockResolvedValue(json(200, { id: 'c1' }));

        await expect(api('/api/customers/c1')).resolves.toEqual({ id: 'c1' });
        const { url, init, headers } = sent();
        expect(url).toBe('/api/customers/c1');
        expect(init.method).toBe('GET');
        expect(init.credentials).toBe('same-origin');
        expect(headers.Accept).toBe('application/json');
        expect(headers['Accept-Language']).toBe('en');
        expect(headers['X-XSRF-TOKEN']).toBeUndefined();
    });

    it('writes JSON with the decoded XSRF cookie', async () => {
        fetchMock.mockResolvedValue(json(201, { id: 'c2' }));

        await api('/api/customers', { method: 'POST', body: { name: 'Fjord Analytics AB' } });
        const { init, headers } = sent();
        expect(init.body).toBe('{"name":"Fjord Analytics AB"}');
        expect(headers['Content-Type']).toBe('application/json');
        expect(headers['X-XSRF-TOKEN']).toBe('abc==');
    });

    it('patches as merge-patch', async () => {
        fetchMock.mockResolvedValue(json(200, {}));

        await api('/api/customers/c1', { method: 'PATCH', body: { city: 'Hamburg' } });
        expect(sent().headers['Content-Type']).toBe('application/merge-patch+json');
    });

    it('returns undefined for 204', async () => {
        fetchMock.mockResolvedValue(json(204, null));

        await expect(api('/api/customers/c1', { method: 'DELETE' })).resolves.toBeUndefined();
    });

    it('throws Problem Details with the first message per field', async () => {
        fetchMock.mockResolvedValue(
            problem(422, 'validation_failed', {
                violations: [
                    { path: 'email', message: 'The email field must be a valid email address.' },
                    { path: 'contacts.1.email', message: 'first' },
                    { path: 'contacts.1.email', message: 'second' },
                ],
            }),
        );

        const error = await api('/api/customers', { method: 'POST', body: {} }).catch((e: unknown) => e);
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(422);
        expect((error as ApiError).reason).toBe('validation_failed');
        expect((error as ApiError).fieldErrors()).toEqual({
            email: 'The email field must be a valid email address.',
            'contacts.1.email': 'first',
        });
        expect(errorMessage(error)).toBe('Detail validation_failed');
    });

    it('turns an HTML error page into an ApiError with the status', async () => {
        fetchMock.mockResolvedValue(new Response('<html>Bad Gateway</html>', { status: 502, statusText: 'Bad Gateway' }));

        const error = (await api('/api/customers').catch((e: unknown) => e)) as ApiError;
        expect(error.status).toBe(502);
        expect(error.reason).toBe('http_error');
        expect(error.message).toBe('Bad Gateway');
    });

    it('renews the CSRF cookie once after 419 and repeats the request', async () => {
        fetchMock
            .mockResolvedValueOnce(problem(419, 'csrf_token_mismatch'))
            .mockResolvedValueOnce(new Response(null, { status: 204 }))
            .mockResolvedValueOnce(json(201, { id: 'c3' }));

        await expect(api('/api/customers', { method: 'POST', body: { name: 'Hotel Alpenglück' } })).resolves.toEqual({ id: 'c3' });
        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(sent(1).url).toBe('/sanctum/csrf-cookie');
        expect(sent(2).url).toBe('/api/customers');
    });

    it('gives up after a second 419', async () => {
        fetchMock.mockResolvedValueOnce(problem(419, 'csrf_token_mismatch')).mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(problem(419, 'csrf_token_mismatch'));

        await expect(api('/api/customers', { method: 'POST', body: {} })).rejects.toMatchObject({ status: 419 });
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('hands a lost session to the login handler', async () => {
        fetchMock.mockResolvedValue(problem(401, 'unauthenticated'));

        await expect(api('/api/customers')).rejects.toMatchObject({ status: 401 });
        expect(unauthenticated).toHaveBeenCalledOnce();
    });

    it('reports network failures as ApiError with status 0', async () => {
        fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

        await expect(api('/api/customers')).rejects.toMatchObject({ status: 0, reason: 'network' });
    });

    it('passes aborts through untouched', async () => {
        const abort = new DOMException('The operation was aborted.', 'AbortError');
        fetchMock.mockRejectedValue(abort);

        await expect(api('/api/render', { method: 'POST', body: {} })).rejects.toBe(abort);
    });
});

describe('apiPage', () => {
    it('reads JSON-LD collections as a page', async () => {
        fetchMock.mockResolvedValue(json(200, { member: [{ id: 'd1' }], totalItems: 51, view: { next: '/api/documents?page=2' } }, 'application/ld+json'));

        await expect(apiPage('/api/documents?page=1&itemsPerPage=50')).resolves.toEqual({ items: [{ id: 'd1' }], total: 51, page: 1, hasMore: true });
        expect(sent().headers.Accept).toBe('application/ld+json');
    });

    it('knows the last page', async () => {
        fetchMock.mockResolvedValue(json(200, { member: [], totalItems: 0 }, 'application/ld+json'));

        await expect(apiPage('/api/documents?page=3')).resolves.toMatchObject({ page: 3, hasMore: false, total: 0 });
    });
});

describe('apiUrl', () => {
    it('leaves out empty filters', () => {
        expect(apiUrl('/api/documents', { type: 'invoice', status: '', q: undefined, customer_id: null, page: 2 })).toBe('/api/documents?type=invoice&page=2');
        expect(apiUrl('/api/documents')).toBe('/api/documents');
        expect(apiUrl('/api/documents', { q: 'Fjord & Co' })).toBe('/api/documents?q=Fjord+%26+Co');
    });
});
```

- [ ] **Step 3: Tests laufen lassen, sie schlagen fehl**

Run: `ddev exec pnpm test`
Expected: FAIL – `Failed to resolve import "./api"`.

- [ ] **Step 4: `resources/js/lib/api.ts` schreiben**

```ts
import { getLocale, t } from '@/lib/i18n';

export type Violation = { path: string; message: string; code?: string };

/** Problem Details of every /api error (App\Support\Problem, RFC 9457). */
export type Problem = {
    type: string;
    title: string;
    status: number;
    detail: string;
    reason: string;
    violations?: Violation[];
    [extension: string]: unknown;
};

export class ApiError extends Error {
    readonly status: number;
    readonly problem: Problem;

    constructor(problem: Problem) {
        super(problem.detail || problem.title);
        this.name = 'ApiError';
        this.status = problem.status;
        this.problem = problem;
    }

    get reason(): string {
        return this.problem.reason;
    }

    get violations(): Violation[] {
        return this.problem.violations ?? [];
    }

    /** First message per path: "name", "contacts.1.email", "custom.industry", "groups.0.positions.2.title". */
    fieldErrors(): Record<string, string> {
        const errors: Record<string, string> = {};
        for (const violation of this.violations) errors[violation.path] ??= violation.message;
        return errors;
    }
}

export type ApiOptions = {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    body?: unknown;
    signal?: AbortSignal;
    /** "jsonld" for paginated collections (total and next page); default plain JSON. */
    format?: 'json' | 'jsonld';
};

const ACCEPT = { json: 'application/json', jsonld: 'application/ld+json' } as const;

/** Path with query string; empty values (undefined, null, '', false) are left out. */
export function apiUrl(path: string, params: Record<string, string | number | boolean | null | undefined> = {}): string {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === '' || value === false) continue;
        query.set(key, value === true ? '1' : String(value));
    }
    const qs = query.toString();
    return qs ? `${path}?${qs}` : path;
}

function cookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const entry = document.cookie.split('; ').find((part) => part.startsWith(`${name}=`));
    return entry ? decodeURIComponent(entry.slice(name.length + 1)) : null;
}

let onUnauthenticated = (): void => {
    window.location.assign(`/${getLocale()}/login`);
};

/** What happens when the session is gone (401). Default: the login page of the current language. */
export function setUnauthenticatedHandler(handler: () => void): void {
    onUnauthenticated = handler;
}

async function send(path: string, options: ApiOptions): Promise<Response> {
    const method = options.method ?? 'GET';
    const headers: Record<string, string> = {
        Accept: ACCEPT[options.format ?? 'json'],
        'Accept-Language': getLocale(),
        'X-Requested-With': 'XMLHttpRequest',
    };
    if (options.body !== undefined) headers['Content-Type'] = method === 'PATCH' ? 'application/merge-patch+json' : 'application/json';
    // the session's CSRF token for writes (Sanctum "stateful" requests, phase 4)
    const xsrf = cookie('XSRF-TOKEN');
    if (xsrf && method !== 'GET') headers['X-XSRF-TOKEN'] = xsrf;

    try {
        return await fetch(path, {
            method,
            headers,
            credentials: 'same-origin',
            signal: options.signal,
            body: options.body === undefined ? undefined : JSON.stringify(options.body),
        });
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        throw new ApiError({ type: 'urn:openbill:problem:network', title: t('errors.network'), status: 0, detail: t('errors.network'), reason: 'network' });
    }
}

async function problemOf(response: Response): Promise<Problem> {
    const fallback: Problem = {
        type: 'about:blank',
        title: response.statusText || t('errors.unknown'),
        status: response.status,
        detail: '',
        reason: 'http_error',
    };
    try {
        const body = (await response.json()) as Partial<Problem>;
        return { ...fallback, ...body, status: typeof body.status === 'number' ? body.status : response.status };
    } catch {
        return fallback;
    }
}

/** One request to the own API with the login session. Every answer ≥ 400 throws an ApiError. */
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
    let response = await send(path, options);
    // 419: the CSRF token changed (e.g. a new login in another tab): fetch a fresh cookie, then try once more
    if (response.status === 419) {
        await fetch('/sanctum/csrf-cookie', { credentials: 'same-origin' });
        response = await send(path, options);
    }
    if (response.status === 401) onUnauthenticated();
    if (!response.ok) throw new ApiError(await problemOf(response));
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
}

export type Page<T> = { items: T[]; total: number; page: number; hasMore: boolean };

type Collection<T> = { member: T[]; totalItems: number; view?: { next?: string } };

/** One page of a paginated collection (customers, documents), read as JSON-LD for the total. */
export async function apiPage<T>(path: string, signal?: AbortSignal): Promise<Page<T>> {
    const body = await api<Collection<T>>(path, { format: 'jsonld', signal });
    const page = Number(new URL(path, 'http://openbill.invalid').searchParams.get('page') ?? '1');
    return { items: body.member, total: body.totalItems, page, hasMore: body.view?.next !== undefined };
}

/** Text for a toast or an error state. */
export function errorMessage(error: unknown): string {
    if (error instanceof ApiError) return error.problem.detail || error.problem.title;
    if (error instanceof Error && error.message) return error.message;
    return t('errors.unknown');
}
```

`lang/en.json` (alphabetisch einsortieren):

```json
    "errors.network": "The server cannot be reached. Check the connection and try again.",
    "errors.unknown": "Unknown error.",
```

`lang/de.json`:

```json
    "errors.network": "Der Server ist nicht erreichbar. Prüfe die Verbindung und versuche es noch einmal.",
    "errors.unknown": "Unbekannter Fehler.",
```

- [ ] **Step 5: Tests laufen lassen, sie sind grün**

Run: `ddev exec pnpm test && ddev exec pnpm typecheck && ddev artisan test --filter=TranslationsTest`
Expected: PASS (Vitest alle grün, `tsc` ohne Fehler, gleiche Schlüssel in beiden Sprachen).

- [ ] **Step 6: Commit**

```bash
git add resources/js/lib/api.ts resources/js/lib/api.test.ts lang/en.json lang/de.json
git commit -m "feat: API client with session, CSRF renewal and problem details" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: SWR-Konfiguration, API-Typen, Schlüssel und Hooks

**Files:**
- Create: `resources/js/lib/swr.tsx`
- Create: `resources/js/api/types.ts`, `resources/js/api/keys.ts`, `resources/js/api/keys.test.ts`, `resources/js/api/paged.ts`, `resources/js/api/customers.ts`, `resources/js/api/documents.ts`, `resources/js/api/fields.ts`
- Modify: `resources/js/app.tsx` (ApiProvider)

**Interfaces:**
- Consumes: `api`, `apiPage`, `apiUrl`, `ApiError`, `Page` aus Task 4; Ressourcenformen aus Phase 4 (`Customer`, Listenform `Document`, `FieldDefinition`).
- Produces: siehe Abschnitt „Interfaces → SWR“. Konkrete Signaturen:
  - `usePagedList<T>(key: (page: number) => string): PagedList<T>`
  - `useCustomerList(q: string): PagedList<Customer>`, `useCustomerOptions(q: string, enabled?: boolean): SWRResponse<Page<Customer>>`, `useCustomer(id: string | null): SWRResponse<Customer>`, `saveCustomer(input: CustomerInput, id?: string): Promise<Customer>`, `deleteCustomer(id: string): Promise<void>`
  - `useDocumentList(filters: DocumentFilters): PagedList<DocumentSummary>`, `useDocument(id: string): SWRResponse<DocumentSummary>`, `createDocument(input: { type: DocumentType; customer_id: string | null }): Promise<DocumentSummary>`
  - `useFieldDefinitions(scope: FieldScope): SWRResponse<FieldDefinition[]>`

- [ ] **Step 1: Failing test für die Schlüssel schreiben**

`resources/js/api/keys.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { keys, PAGE_SIZE } from './keys';

describe('keys', () => {
    it('are the request URLs, with empty filters left out', () => {
        expect(keys.documents({ type: 'invoice', status: 'overdue', q: '  ' }, 2)).toBe(`/api/documents?type=invoice&status=overdue&page=2&itemsPerPage=${PAGE_SIZE}`);
        expect(keys.documents({}, 1)).toBe('/api/documents?page=1&itemsPerPage=50');
        expect(keys.customers(' Fjord ', 1)).toBe('/api/customers?q=Fjord&page=1&itemsPerPage=50');
        expect(keys.customerOptions('')).toBe('/api/customers?itemsPerPage=20');
        expect(keys.customer('01k9')).toBe('/api/customers/01k9');
        expect(keys.document('01k9')).toBe('/api/documents/01k9');
        expect(keys.fieldDefinitions('contact')).toBe('/api/field-definitions?scope=contact');
    });
});
```

- [ ] **Step 2: Test laufen lassen, er schlägt fehl**

Run: `ddev exec pnpm test resources/js/api`
Expected: FAIL – `Failed to resolve import "./keys"`.

- [ ] **Step 3: Typen und Schlüssel schreiben**

`resources/js/api/types.ts`:

```ts
/** Shapes of the REST API (phase 4, docs/superpowers/plans/2026-10-11-phase-04-api.md "Interfaces"). Amounts are strings. */

export type DocumentType = 'offer' | 'confirmation' | 'invoice' | 'cancellation';
export type DocumentStatus = 'draft' | 'open' | 'accepted' | 'rejected' | 'done' | 'paid' | 'cancelled' | 'closed';
export type TaxTreatment = 'domestic' | 'eu_reverse_charge' | 'third_country';
export type FieldScope = 'org' | 'customer' | 'contact' | 'document' | 'position';
export type FieldType = 'text' | 'textarea' | 'number' | 'money' | 'date' | 'select' | 'boolean' | 'image';

/** Value of a custom field: text, date (YYYY-MM-DD), number/amount as string with a dot, yes/no, or empty. */
export type CustomValue = string | number | boolean | null;
export type CustomValues = Record<string, CustomValue>;

export const DOCUMENT_TYPES: DocumentType[] = ['offer', 'confirmation', 'invoice', 'cancellation'];
export const DOCUMENT_STATUSES: DocumentStatus[] = ['draft', 'open', 'accepted', 'rejected', 'done', 'paid', 'cancelled', 'closed'];

export type Contact = {
    id: string;
    salutation: string;
    first_name: string;
    last_name: string;
    position: string;
    email: string;
    phone: string;
    is_default: boolean;
    custom: CustomValues;
};

export type Customer = {
    id: string;
    number: string;
    name: string;
    street: string;
    zip: string;
    city: string;
    country: string;
    email: string;
    vat_id: string;
    tax_treatment: TaxTreatment;
    locale: string | null;
    custom: CustomValues;
    contacts: Contact[];
    created_at: string | null;
    updated_at: string | null;
};

/** What SaveCustomer takes. "contacts" is the complete list; contacts without id are new. */
export type ContactInput = Omit<Contact, 'id'> & { id?: string };
export type CustomerInput = Omit<Customer, 'id' | 'contacts' | 'created_at' | 'updated_at'> & { contacts: ContactInput[] };

/** List form of a document (GET /api/documents). */
export type DocumentSummary = {
    id: string;
    type: DocumentType;
    status: DocumentStatus;
    number: string | null;
    date: string;
    customer_id: string | null;
    customer_name: string | null;
    contact_id: string | null;
    due_date: string | null;
    valid_until: string | null;
    locale: string;
    source_id: string | null;
    cancelled_by_id: string | null;
    is_locked: boolean;
    is_overdue: boolean;
    finalized_at: string | null;
    paid_at: string | null;
    net_total: string;
    tax_total: string;
    gross_total: string;
    created_at: string | null;
    updated_at: string | null;
};

export type DocumentFilters = {
    type?: DocumentType | null;
    status?: DocumentStatus | 'overdue' | null;
    customer_id?: string | null;
    q?: string | null;
};

export type FieldDefinition = {
    id: string;
    scope: FieldScope;
    key: string;
    label: string;
    type: FieldType;
    required: boolean;
    default_value: string | number | boolean | null;
    help: string;
    options: string[];
    doc_types: DocumentType[];
    sort: number;
};
```

`resources/js/api/keys.ts`:

```ts
import { apiUrl } from '@/lib/api';
import type { DocumentFilters, FieldScope } from './types';

/** Rows per page of the paginated lists (the API allows up to 100). */
export const PAGE_SIZE = 50;

/**
 * SWR keys are the request URLs. The default fetcher (lib/swr.tsx) loads them as JSON; paginated lists
 * pass apiPage as fetcher (api/paged.ts).
 */
export const keys = {
    customers: (q: string, page: number) => apiUrl('/api/customers', { q: q.trim(), page, itemsPerPage: PAGE_SIZE }),
    customerOptions: (q: string) => apiUrl('/api/customers', { q: q.trim(), itemsPerPage: 20 }),
    customer: (id: string) => `/api/customers/${id}`,
    documents: (filters: DocumentFilters, page: number) =>
        apiUrl('/api/documents', {
            type: filters.type,
            status: filters.status,
            customer_id: filters.customer_id,
            q: filters.q?.trim(),
            page,
            itemsPerPage: PAGE_SIZE,
        }),
    document: (id: string) => `/api/documents/${id}`,
    fieldDefinitions: (scope: FieldScope) => apiUrl('/api/field-definitions', { scope }),
};
```

- [ ] **Step 4: Test laufen lassen, er ist grün**

Run: `ddev exec pnpm test resources/js/api`
Expected: PASS.

- [ ] **Step 5: SWR-Konfiguration und Hooks**

`resources/js/lib/swr.tsx`:

```tsx
import type { ReactNode } from 'react';
import { SWRConfig, type SWRConfiguration } from 'swr';
import { api, ApiError } from '@/lib/api';

export const fetcher = (url: string): Promise<unknown> => api<unknown>(url);

export const swrConfig: SWRConfiguration = {
    fetcher,
    // filters and searches keep showing the last rows while the next answer loads
    keepPreviousData: true,
    // client errors (404, 403, 422) don't get better by asking again
    shouldRetryOnError: (error: unknown) => !(error instanceof ApiError && error.status >= 400 && error.status < 500),
    errorRetryCount: 2,
    focusThrottleInterval: 30_000,
};

export function ApiProvider({ children }: { children: ReactNode }) {
    return <SWRConfig value={swrConfig}>{children}</SWRConfig>;
}
```

`resources/js/api/paged.ts`:

```ts
import useSWRInfinite from 'swr/infinite';
import { apiPage, type Page } from '@/lib/api';

export type PagedList<T> = {
    items: T[];
    total: number;
    hasMore: boolean;
    isLoading: boolean;
    isLoadingMore: boolean;
    error: unknown;
    loadMore(): void;
    retry(): void;
};

/** A paginated collection with "load more". `key(page)` gives the URL of a page (1-based). */
export function usePagedList<T>(key: (page: number) => string): PagedList<T> {
    const swr = useSWRInfinite<Page<T>>(
        (index, previous: Page<T> | null) => (previous && !previous.hasMore ? null : key(index + 1)),
        (url: string) => apiPage<T>(url),
    );
    const pages = swr.data ?? [];

    return {
        items: pages.flatMap((page) => page.items),
        total: pages[0]?.total ?? 0,
        hasMore: pages.at(-1)?.hasMore ?? false,
        isLoading: swr.isLoading,
        isLoadingMore: swr.size > 0 && swr.data !== undefined && swr.data[swr.size - 1] === undefined,
        error: swr.error,
        loadMore: () => void swr.setSize(swr.size + 1),
        retry: () => void swr.mutate(),
    };
}
```

`resources/js/api/customers.ts`:

```ts
import useSWR, { mutate } from 'swr';
import { api, apiPage, type Page } from '@/lib/api';
import { keys } from './keys';
import { usePagedList, type PagedList } from './paged';
import type { Customer, CustomerInput } from './types';

export function useCustomerList(q: string): PagedList<Customer> {
    return usePagedList<Customer>((page) => keys.customers(q, page));
}

/** First 20 matches for pickers (new document dialog); `enabled = false` fetches nothing (dialog closed). */
export function useCustomerOptions(q: string, enabled = true) {
    return useSWR<Page<Customer>>(enabled ? keys.customerOptions(q) : null, (url: string) => apiPage<Customer>(url));
}

export function useCustomer(id: string | null) {
    return useSWR<Customer>(id ? keys.customer(id) : null);
}

/** POST (new) or PATCH (existing); the answer goes straight into the cache of the detail. */
export async function saveCustomer(input: CustomerInput, id?: string): Promise<Customer> {
    const saved = id
        ? await api<Customer>(keys.customer(id), { method: 'PATCH', body: input })
        : await api<Customer>('/api/customers', { method: 'POST', body: input });
    await mutate(keys.customer(saved.id), saved, { revalidate: false });
    return saved;
}

export async function deleteCustomer(id: string): Promise<void> {
    await api<void>(keys.customer(id), { method: 'DELETE' });
    await mutate(keys.customer(id), undefined, { revalidate: false });
}
```

`resources/js/api/documents.ts`:

```ts
import useSWR from 'swr';
import { api } from '@/lib/api';
import { keys } from './keys';
import { usePagedList, type PagedList } from './paged';
import type { DocumentFilters, DocumentSummary, DocumentType } from './types';

export function useDocumentList(filters: DocumentFilters): PagedList<DocumentSummary> {
    return usePagedList<DocumentSummary>((page) => keys.documents(filters, page));
}

/** Item form of a document; phase 6 adds the full type (groups, totals, issues). */
export function useDocument(id: string) {
    return useSWR<DocumentSummary>(keys.document(id));
}

export function createDocument(input: { type: DocumentType; customer_id: string | null }): Promise<DocumentSummary> {
    return api<DocumentSummary>('/api/documents', { method: 'POST', body: input });
}
```

`resources/js/api/fields.ts`:

```ts
import useSWR from 'swr';
import { keys } from './keys';
import type { FieldDefinition, FieldScope } from './types';

/** Custom field definitions of one level (not paginated), in their configured order. */
export function useFieldDefinitions(scope: FieldScope) {
    return useSWR<FieldDefinition[]>(keys.fieldDefinitions(scope));
}
```

In `resources/js/app.tsx` den Import `import { ApiProvider } from '@/lib/swr';` ergänzen und das Rendern ändern:

```tsx
        createRoot(el).render(
            <ApiProvider>
                <App {...props} />
            </ApiProvider>,
        );
```

- [ ] **Step 6: Prüfen und committen**

Run: `ddev exec pnpm test && ddev exec pnpm typecheck && ddev exec pnpm build`
Expected: alles grün.

```bash
git add resources/js/lib/swr.tsx resources/js/api resources/js/app.tsx
git commit -m "feat: SWR setup, API types, keys and data hooks" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Komponenten I – Buttons, Formulare, Badges, Flächen, Zustände

Port von `prototypes/clickdummy-v2/src/components/ui/{Button,form,Badge,Tabs,PageHeader,states}.tsx` und `src/styles/components.css` nach Tailwind. Die Klassenlisten unten sind die Übersetzung der CSS-Regeln; Abweichungen nur, wo der Klickdummy Pseudo-Elemente an `<input>` nutzt (Firefox rendert sie nicht): Haken und Schalter-Knopf sind dort eigene Elemente mit `peer-checked:`.

**Files:**
- Create: `resources/js/components/ui/cx.ts`, `button.tsx`, `form.tsx`, `badge.tsx`, `tabs.tsx`, `card.tsx`, `page.tsx`, `states.tsx`, `avatar.tsx`, `index.ts`
- Modify: `lang/en.json`, `lang/de.json`

**Interfaces:**
- Consumes: Tokens aus Task 2 (`h-control`, `font-strong`, `shadow-tab`, `animate-*`, `bg-panel`, `num`), `t()`, `initials()` aus Task 3, `DocumentStatus` aus Task 5.
- Produces: alle Komponenten aus „Interfaces → Komponenten“ außer Dialog/Drawer/ConfirmDialog/Menu/Toaster (Task 7).

- [ ] **Step 1: `cx.ts`, `button.tsx` (mit `Spinner`), `states.tsx`**

`resources/js/components/ui/cx.ts`:

```ts
/** Joins class names, skipping empty ones. */
export const cx = (...parts: (string | false | null | undefined)[]): string => parts.filter(Boolean).join(' ');
```

`resources/js/components/ui/states.tsx`:

```tsx
import { AlertTriangle, RotateCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { errorMessage } from '@/lib/api';
import { t } from '@/lib/i18n';
import { Button } from './button';
import { cx } from './cx';

export function Skeleton({ w = '100%', h = 14, r, className }: { w?: number | string; h?: number | string; r?: number; className?: string }) {
    return (
        <span
            aria-hidden
            className={cx('block animate-shimmer rounded-sm bg-[linear-gradient(90deg,var(--surface-2)_25%,var(--surface-3)_50%,var(--surface-2)_75%)] bg-[length:400%_100%]', className)}
            style={{ width: w, height: h, borderRadius: r }}
        />
    );
}

/** Placeholder in the shape of a list. */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
    return (
        <div className="grid gap-4 px-5 py-4" aria-busy="true" aria-label={t('common.loading')}>
            {Array.from({ length: rows }, (_, i) => (
                <div key={i} className="flex items-center gap-4">
                    <Skeleton w={96} h={12} />
                    <Skeleton w={`${40 + ((i * 17) % 30)}%`} h={12} />
                    <span className="flex-1" />
                    <Skeleton w={72} h={20} r={999} />
                    <Skeleton w={84} h={12} />
                </div>
            ))}
        </div>
    );
}

export function EmptyState({ icon, title, children, actions, compact = false }: { icon: ReactNode; title: string; children?: ReactNode; actions?: ReactNode; compact?: boolean }) {
    return (
        <div className={cx('grid animate-fade-in justify-items-center gap-3 text-center', compact ? 'px-4 py-6' : 'px-6 py-12')}>
            <div className="grid size-12 place-items-center rounded-full bg-surface-2 text-muted [&_svg]:size-[1.375rem]">{icon}</div>
            <h3 className="text-lg">{title}</h3>
            {children && <p className="max-w-[46ch] text-muted">{children}</p>}
            {actions && <div className="mt-2 flex flex-wrap justify-center gap-3">{actions}</div>}
        </div>
    );
}

export function ErrorState({ error, onRetry, title }: { error: unknown; onRetry?: () => void; title?: string }) {
    return (
        <div role="alert" className="grid animate-fade-in justify-items-center gap-3 px-6 py-12 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-bad-soft text-bad [&_svg]:size-[1.375rem]">
                <AlertTriangle aria-hidden />
            </div>
            <h3 className="text-lg">{title ?? t('errors.title')}</h3>
            <p className="max-w-[46ch] text-muted">{errorMessage(error)}</p>
            {onRetry && (
                <div className="mt-2">
                    <Button icon={<RotateCw />} onClick={onRetry}>
                        {t('common.retry')}
                    </Button>
                </div>
            )}
        </div>
    );
}

export type NoticeTone = 'neutral' | 'warn' | 'ok' | 'bad' | 'accent';

const NOTICE_TONES: Record<NoticeTone, string> = {
    neutral: 'bg-surface-2',
    warn: 'bg-warn-soft text-warn',
    ok: 'bg-ok-soft text-ok',
    bad: 'bg-bad-soft text-bad',
    accent: 'bg-accent-soft text-accent',
};

export function Notice({ tone = 'neutral', icon, children, className }: { tone?: NoticeTone; icon?: ReactNode; children: ReactNode; className?: string }) {
    return (
        <div className={cx('flex items-start gap-3 rounded-md px-4 py-3 text-sm [&_b]:font-heading [&>svg]:mt-px [&>svg]:size-[1.1rem] [&>svg]:shrink-0', NOTICE_TONES[tone], className)}>
            {icon}
            <span>{children}</span>
        </div>
    );
}
```

`resources/js/components/ui/button.tsx`:

```tsx
import { Link } from '@inertiajs/react';
import type { ButtonHTMLAttributes, ComponentProps, ReactNode, Ref } from 'react';
import { cx } from './cx';

export function Spinner({ className }: { className?: string }) {
    return <span aria-hidden className={cx('inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent', className)} />;
}

export type ButtonVariant = 'default' | 'primary' | 'soft' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'sm';
type Look = { variant?: ButtonVariant; size?: ButtonSize; iconOnly?: boolean };

const VARIANTS: Record<ButtonVariant, string> = {
    default: 'bg-surface-2 text-ink hover:bg-surface-3',
    primary: 'bg-accent text-accent-ink hover:bg-accent-hover',
    soft: 'bg-accent-soft text-accent hover:bg-accent-soft-hover',
    ghost: 'bg-transparent text-muted hover:bg-surface-2 hover:text-ink',
    danger: 'bg-bad-soft text-bad hover:bg-bad hover:text-surface',
};

/** Pill button classes; also for links that look like buttons. */
export function buttonClass({ variant = 'default', size = 'md', iconOnly = false }: Look = {}, extra?: string): string {
    return cx(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-strong whitespace-nowrap no-underline transition-[background-color,color,transform] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
        size === 'sm' ? 'h-control-sm text-sm' : 'h-control text-md',
        iconOnly ? (size === 'sm' ? 'w-control-sm' : 'w-control') : size === 'sm' ? 'px-3' : 'px-4',
        VARIANTS[variant],
        extra,
    );
}

type ButtonProps = Look &
    ButtonHTMLAttributes<HTMLButtonElement> & {
        icon?: ReactNode;
        pending?: boolean;
        ref?: Ref<HTMLButtonElement>;
    };

/** Icon-only buttons keep their text for screen readers (children become sr-only). */
export function Button({ variant, size, iconOnly, icon, pending = false, className, children, disabled, type = 'button', ref, ...rest }: ButtonProps) {
    return (
        <button ref={ref} type={type} className={buttonClass({ variant, size, iconOnly }, className)} disabled={disabled || pending} aria-busy={pending || undefined} {...rest}>
            {pending ? <Spinner className="size-[0.9rem]" /> : icon}
            {iconOnly ? <span className="sr-only">{children}</span> : children}
        </button>
    );
}

type ButtonLinkProps = Look & ComponentProps<typeof Link> & { icon?: ReactNode };

export function ButtonLink({ variant, size, iconOnly, icon, className, children, ...rest }: ButtonLinkProps) {
    return (
        <Link className={buttonClass({ variant, size, iconOnly }, typeof className === 'string' ? className : undefined)} {...rest}>
            {icon}
            {iconOnly ? <span className="sr-only">{children as ReactNode}</span> : (children as ReactNode)}
        </Link>
    );
}
```

- [ ] **Step 2: `form.tsx`**

```tsx
import { Check, ChevronDown, Search } from 'lucide-react';
import { useId, type InputHTMLAttributes, type ReactNode, type Ref, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cx } from './cx';

// no height here: single-line controls add h-control, the textarea grows (two height classes would conflict)
const CONTROL =
    'w-full min-w-0 rounded-md border-0 bg-surface-2 px-3 text-md text-ink transition-[background-color,box-shadow] placeholder:text-faint hover:bg-surface-3 focus:bg-surface focus:shadow-[0_0_0_2px_var(--accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 read-only:bg-transparent read-only:shadow-[inset_0_0_0_1px_var(--surface-3)]';
const INVALID = 'shadow-[0_0_0_2px_var(--bad)] hover:shadow-[0_0_0_2px_var(--bad)]';

/**
 * Classes of a text control (tinted field, kobalt ring on focus, red ring when invalid). `extra` may only add
 * properties the base does not set (or longhands like pl-9 after px-3): two classes for the same CSS property
 * have no defined winner in Tailwind.
 */
export function controlClass(invalid = false, extra?: string): string {
    return cx(CONTROL, invalid && INVALID, extra);
}

type FieldProps = {
    label?: ReactNode;
    hint?: ReactNode;
    error?: ReactNode;
    aside?: ReactNode;
    className?: string;
    /** Marks the field for jumps from error lists (data-path, e.g. "contacts.0.email"). */
    path?: string;
    children: (id: string, describedBy: string | undefined) => ReactNode;
};

/** Labelled field with hint or error below. */
export function Field({ label, hint, error, aside, className, path, children }: FieldProps) {
    const id = useId();
    const messageId = `${id}-message`;
    const message = error || hint;

    return (
        <div className={cx('grid min-w-0 content-start gap-1.5', className)} data-path={path}>
            {label && (
                <label htmlFor={id} className="flex items-center gap-2 text-sm font-medium text-muted">
                    {label}
                    {aside && <span className="ml-auto">{aside}</span>}
                </label>
            )}
            {children(id, message ? messageId : undefined)}
            {message && (
                <span id={messageId} className={cx('text-xs', error ? 'text-bad' : 'text-muted')}>
                    {message}
                </span>
            )}
        </div>
    );
}

type FieldExtras = { label?: ReactNode; hint?: ReactNode; error?: ReactNode; aside?: ReactNode; wrapClassName?: string; path?: string };

export function TextInput({ label, hint, error, aside, wrapClassName, path, className, ref, ...rest }: FieldExtras & Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & { ref?: Ref<HTMLInputElement> }) {
    return (
        <Field label={label} hint={hint} error={error} aside={aside} className={wrapClassName} path={path}>
            {(id, describedBy) => <input ref={ref} id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} className={controlClass(!!error, cx('h-control', className))} {...rest} />}
        </Field>
    );
}

/** Native select with the chevron, without label (filters, compact rows). */
export function SelectControl({ invalid = false, className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
    return (
        <span className={cx('relative grid min-w-0', className)}>
            <select className={controlClass(invalid, 'h-control cursor-pointer appearance-none pr-9')} aria-invalid={invalid || undefined} {...rest}>
                {children}
            </select>
            <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" />
        </span>
    );
}

export function Select({ label, hint, error, aside, wrapClassName, path, children, ...rest }: FieldExtras & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'>) {
    return (
        <Field label={label} hint={hint} error={error} aside={aside} className={wrapClassName} path={path}>
            {(id, describedBy) => (
                <SelectControl id={id} invalid={!!error} aria-describedby={describedBy} {...rest}>
                    {children}
                </SelectControl>
            )}
        </Field>
    );
}

export function Textarea({ label, hint, error, aside, wrapClassName, path, className, ...rest }: FieldExtras & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'>) {
    return (
        <Field label={label} hint={hint} error={error} aside={aside} className={wrapClassName} path={path}>
            {(id, describedBy) => (
                <textarea id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} className={controlClass(!!error, cx('min-h-22 resize-y py-2 leading-normal', className))} {...rest} />
            )}
        </Field>
    );
}

/** Search field with the magnifier inside. */
export function SearchInput({ className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
    return (
        <span className={cx('relative flex min-w-0 items-center', className)}>
            <Search aria-hidden className="pointer-events-none absolute left-3 size-4 text-muted" />
            <input type="search" className={controlClass(false, 'h-control pl-9')} {...rest} />
        </span>
    );
}

export function Checkbox({ label, className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: ReactNode }) {
    return (
        <label className={cx('inline-flex cursor-pointer items-center gap-2 select-none', className)}>
            <span className="relative inline-grid size-[1.125rem] shrink-0">
                <input type="checkbox" className="peer size-full cursor-pointer appearance-none rounded-[6px] bg-surface-3 transition-colors checked:bg-accent disabled:cursor-not-allowed disabled:opacity-60" {...rest} />
                <Check aria-hidden strokeWidth={3} className="pointer-events-none absolute inset-0 m-auto size-3 text-accent-ink opacity-0 peer-checked:opacity-100" />
            </span>
            <span>{label}</span>
        </label>
    );
}

export function Switch({ label, className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'role'> & { label: ReactNode }) {
    return (
        <label className={cx('inline-flex cursor-pointer items-center gap-3 select-none', className)}>
            <span className="relative inline-grid h-[1.375rem] w-9 shrink-0">
                <input type="checkbox" role="switch" className="peer size-full cursor-pointer appearance-none rounded-full bg-surface-3 transition-colors checked:bg-accent disabled:cursor-not-allowed disabled:opacity-60" {...rest} />
                <span aria-hidden className="pointer-events-none absolute top-[3px] left-[3px] size-4 rounded-full bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.2)] transition-transform peer-checked:translate-x-3.5" />
            </span>
            <span>{label}</span>
        </label>
    );
}
```

- [ ] **Step 3: `badge.tsx`, `tabs.tsx`, `card.tsx`, `page.tsx`, `avatar.tsx`**

`resources/js/components/ui/badge.tsx`:

```tsx
import type { ReactNode } from 'react';
import type { DocumentStatus } from '@/api/types';
import { t } from '@/lib/i18n';
import { cx } from './cx';

export type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'bad' | 'ink';

const TONES: Record<Tone, string> = {
    neutral: 'bg-surface-2 text-muted',
    accent: 'bg-accent-soft text-accent',
    ok: 'bg-ok-soft text-ok',
    warn: 'bg-warn-soft text-warn',
    bad: 'bg-bad-soft text-bad',
    ink: 'bg-ink text-bg',
};

/** Pill with a dot in the text color; `plain` without the dot (counters). */
export function Badge({ tone = 'neutral', plain = false, children, className }: { tone?: Tone; plain?: boolean; children: ReactNode; className?: string }) {
    return (
        <span
            className={cx(
                'inline-flex h-6 items-center gap-1.5 rounded-full text-xs font-semibold whitespace-nowrap',
                plain ? 'px-2' : 'pr-2 pl-2 before:size-1.5 before:shrink-0 before:rounded-full before:bg-current before:content-[""]',
                TONES[tone],
                className,
            )}
        >
            {children}
        </span>
    );
}

const STATUS_TONES: Record<DocumentStatus, Tone> = {
    draft: 'neutral',
    open: 'accent',
    accepted: 'ok',
    rejected: 'bad',
    done: 'ok',
    paid: 'ok',
    cancelled: 'neutral',
    closed: 'neutral',
};

/** Status of a document; an overdue invoice shows "Overdue" instead of "Open" (overdue is no status). */
export function StatusBadge({ status, overdue = false }: { status: DocumentStatus; overdue?: boolean }) {
    if (overdue) return <Badge tone="bad">{t('status.overdue')}</Badge>;
    return <Badge tone={STATUS_TONES[status]}>{t(`status.${status}`)}</Badge>;
}

const TAG_TONES = { accent: 'bg-accent-soft text-accent', neutral: 'bg-surface-2 text-muted', bad: 'bg-bad-soft text-bad' } as const;

/** Small label without dot; `neutral` is short for tone="neutral". */
export function Tag({ tone, neutral = false, children, className }: { tone?: keyof typeof TAG_TONES; neutral?: boolean; children: ReactNode; className?: string }) {
    return (
        <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-px text-xs font-medium whitespace-nowrap [&_svg]:size-3', TAG_TONES[tone ?? (neutral ? 'neutral' : 'accent')], className)}>
            {children}
        </span>
    );
}
```

`resources/js/components/ui/tabs.tsx`:

```tsx
import type { ButtonHTMLAttributes, KeyboardEvent, ReactNode } from 'react';
import { cx } from './cx';

export type TabItem<T extends string> = { value: T; label: ReactNode; icon?: ReactNode };

/** Segmented switch as a pill. Arrow keys move between the tabs. */
export function Tabs<T extends string>({ items, value, onChange, label }: { items: TabItem<T>[]; value: T; onChange(value: T): void; label: string }) {
    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
        const index = items.findIndex((item) => item.value === value);
        const next = items[(index + (event.key === 'ArrowRight' ? 1 : items.length - 1)) % items.length];
        onChange(next.value);
        event.currentTarget.querySelector<HTMLElement>(`[data-value="${next.value}"]`)?.focus();
    };

    return (
        <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-full bg-surface-2 p-[3px]">
            {items.map((item) => (
                <button
                    key={item.value}
                    type="button"
                    role="tab"
                    data-value={item.value}
                    aria-selected={item.value === value}
                    tabIndex={item.value === value ? 0 : -1}
                    onClick={() => onChange(item.value)}
                    className="inline-flex h-[1.875rem] items-center gap-1.5 rounded-full px-3 text-sm font-strong whitespace-nowrap text-muted transition-colors hover:text-ink aria-selected:bg-surface aria-selected:text-ink aria-selected:shadow-tab [&_svg]:size-[0.9rem]"
                >
                    {item.icon}
                    {item.label}
                </button>
            ))}
        </div>
    );
}

/** Filter pill (pressed = ink on bg), optionally with a count. */
export function PillButton({ pressed, count, children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { pressed: boolean; count?: number }) {
    return (
        <button
            type="button"
            aria-pressed={pressed}
            className={cx(
                'inline-flex h-8 items-center gap-2 rounded-full px-3 text-sm font-medium whitespace-nowrap text-muted transition-colors hover:bg-surface-2 hover:text-ink aria-pressed:bg-ink aria-pressed:text-bg aria-pressed:hover:bg-ink aria-pressed:hover:text-bg',
                className,
            )}
            {...rest}
        >
            {children}
            {count !== undefined && <span className="num opacity-60">{count}</span>}
        </button>
    );
}
```

`resources/js/components/ui/card.tsx`:

```tsx
import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

/** Surface with 18 px radius; `tinted` = panel tone inside the white workspace, `flush` = no padding. */
export function Card({ flush = false, tinted = false, className, children, ...rest }: HTMLAttributes<HTMLElement> & { flush?: boolean; tinted?: boolean }) {
    return (
        <section className={cx('min-w-0 rounded-lg', tinted ? 'bg-panel' : 'bg-surface', flush ? 'overflow-hidden' : 'p-5', className)} {...rest}>
            {children}
        </section>
    );
}

export function CardHead({ title, titleId, description, actions }: { title: ReactNode; titleId?: string; description?: ReactNode; actions?: ReactNode }) {
    return (
        <div className="mb-4 flex items-center gap-3">
            <div className="min-w-0">
                <h2 id={titleId} className="text-lg font-heading tracking-[-0.02em]">
                    {title}
                </h2>
                {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
            </div>
            {actions && <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
    );
}
```

`resources/js/components/ui/page.tsx`:

```tsx
import { Link } from '@inertiajs/react';
import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from './cx';

/** Content area of a page inside the workspace. `wide` drops the max width (editor in phase 6). */
export function Page({ wide = false, className, children }: { wide?: boolean; className?: string; children: ReactNode }) {
    return <div className={cx('mx-auto grid content-start gap-6 px-4 pt-5 pb-12 sm:px-8 sm:pt-8 sm:pb-16', !wide && 'max-w-[1320px]', className)}>{children}</div>;
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
    return (
        <Link href={href} className="inline-flex items-center gap-1 justify-self-start text-sm font-medium text-muted no-underline hover:text-ink [&_svg]:size-4">
            <ChevronLeft aria-hidden />
            {children}
        </Link>
    );
}

export function PageHeader({ title, description, actions, back }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
    return (
        <header className="flex flex-wrap items-end gap-4">
            <div className="grid min-w-0 gap-1">
                {back && <BackLink href={back.href}>{back.label}</BackLink>}
                <h1 className="text-2xl font-bold tracking-title sm:text-3xl">{title}</h1>
                {description && <p className="max-w-[64ch] text-muted">{description}</p>}
            </div>
            {actions && <div className="ml-auto flex flex-wrap items-center gap-3">{actions}</div>}
        </header>
    );
}
```

`resources/js/components/ui/avatar.tsx`:

```tsx
import type { ReactNode } from 'react';
import { initials } from '@/lib/format';
import { cx } from './cx';

const SIZES = { sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-13 text-lg' } as const;

/** Round initials (or an icon as children). Decorative: the name is always written next to it. */
export function Avatar({ name, size = 'md', tone = 'neutral', children }: { name: string; size?: keyof typeof SIZES; tone?: 'neutral' | 'accent'; children?: ReactNode }) {
    return (
        <span
            aria-hidden
            className={cx(
                'grid shrink-0 place-items-center rounded-full font-bold tracking-[-0.02em] [&_svg]:size-5',
                SIZES[size],
                tone === 'accent' ? 'bg-accent-soft text-accent' : 'bg-surface-3 text-ink',
            )}
        >
            {children ?? initials(name)}
        </span>
    );
}
```

`resources/js/components/ui/index.ts` (Task 7 ergänzt die Overlays):

```ts
export { Avatar } from './avatar';
export { Badge, StatusBadge, Tag, type Tone } from './badge';
export { Button, ButtonLink, buttonClass, Spinner, type ButtonSize, type ButtonVariant } from './button';
export { Card, CardHead } from './card';
export { cx } from './cx';
export { Checkbox, controlClass, Field, SearchInput, Select, SelectControl, Switch, Textarea, TextInput } from './form';
export { BackLink, Page, PageHeader } from './page';
export { EmptyState, ErrorState, ListSkeleton, Notice, Skeleton, type NoticeTone } from './states';
export { PillButton, Tabs, type TabItem } from './tabs';
```

- [ ] **Step 4: Texte**

`lang/en.json`:

```json
    "common.loading": "Loading",
    "common.retry": "Try again",
    "errors.title": "That did not work",
    "status.accepted": "Accepted",
    "status.cancelled": "Cancelled",
    "status.closed": "Closed",
    "status.done": "Done",
    "status.draft": "Draft",
    "status.open": "Open",
    "status.overdue": "Overdue",
    "status.paid": "Paid",
    "status.rejected": "Rejected",
```

`lang/de.json`:

```json
    "common.loading": "Wird geladen",
    "common.retry": "Erneut versuchen",
    "errors.title": "Das hat nicht geklappt",
    "status.accepted": "Angenommen",
    "status.cancelled": "Storniert",
    "status.closed": "Abgeschlossen",
    "status.done": "Erledigt",
    "status.draft": "Entwurf",
    "status.open": "Offen",
    "status.overdue": "Überfällig",
    "status.paid": "Bezahlt",
    "status.rejected": "Abgelehnt",
```

- [ ] **Step 5: Prüfen**

Run: `ddev exec pnpm typecheck && ddev exec pnpm build && ddev artisan test --filter=TranslationsTest`
Expected: keine TS-Fehler (meldet TS bei `ComponentProps<typeof Link>`, dass `className` eine Funktion sein kann, ist die `typeof className === 'string'`-Weiche oben die Lösung), Build fertig, Übersetzungstest grün. Die Komponenten werden ab Task 9 sichtbar und mit den Screenshots in Task 17 gegen den Klickdummy geprüft.

- [ ] **Step 6: Commit**

```bash
git add resources/js/components/ui lang/en.json lang/de.json
git commit -m "feat: base UI components ported to Tailwind" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Komponenten II – Dialog, Drawer, Menü, Toasts

**Files:**
- Create: `resources/js/components/ui/dialog.tsx`, `resources/js/components/ui/menu.tsx`, `resources/js/components/ui/toaster.tsx`
- Create: `resources/js/lib/toast.ts`, `resources/js/lib/toast.test.ts`
- Modify: `resources/js/components/ui/index.ts`, `lang/en.json`, `lang/de.json`

**Interfaces:**
- Consumes: `Button`, `Tag`, `cx` aus Task 6.
- Produces: `Dialog`, `Drawer`, `ConfirmDialog`, `Menu`, `MenuItem`, `MenuLabel`, `MenuSeparator`, `MenuRadioGroup`, `MenuRadioItem`, `Toaster`; `toast.success|error|info(message, action?) → id`, `dismissToast(id)`, `useToasts()`.

- [ ] **Step 1: Failing test für den Toast-Store**

`resources/js/lib/toast.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { currentToasts, dismissToast, toast } from './toast';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
    currentToasts().forEach((item) => dismissToast(item.id));
    vi.useRealTimers();
});

describe('toast', () => {
    it('shows at most three toasts, the newest last', () => {
        ['one', 'two', 'three', 'four'].forEach((message) => toast.info(message));

        expect(currentToasts().map((item) => item.message)).toEqual(['two', 'three', 'four']);
    });

    it('closes by itself, later when it offers an action', () => {
        toast.success('Customer saved');
        toast.info('Draft deleted', { label: 'Undo', run: () => undefined });

        vi.advanceTimersByTime(3600);
        expect(currentToasts().map((item) => item.message)).toEqual(['Draft deleted']);
        vi.advanceTimersByTime(2500);
        expect(currentToasts()).toEqual([]);
    });

    it('can be dismissed', () => {
        const id = toast.error('Could not save');
        dismissToast(id);

        expect(currentToasts()).toEqual([]);
    });
});
```

- [ ] **Step 2: Test laufen lassen, er schlägt fehl**

Run: `ddev exec pnpm test resources/js/lib/toast.test.ts`
Expected: FAIL – `Failed to resolve import "./toast"`.

- [ ] **Step 3: `resources/js/lib/toast.ts`**

```ts
import { useSyncExternalStore } from 'react';

export type ToastTone = 'neutral' | 'success' | 'error';
export type ToastAction = { label: string; run(): void };
export type Toast = { id: number; message: string; tone: ToastTone; action?: ToastAction };

let toasts: Toast[] = [];
let sequence = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export function currentToasts(): Toast[] {
    return toasts;
}

export function dismissToast(id: number): void {
    toasts = toasts.filter((item) => item.id !== id);
    emit();
}

function push(message: string, tone: ToastTone, action?: ToastAction): number {
    const id = ++sequence;
    toasts = [...toasts.slice(-2), { id, message, tone, action }];
    emit();
    // with an action (undo) the toast stays longer
    setTimeout(() => dismissToast(id), action ? 6000 : 3500);
    return id;
}

export const toast = {
    success: (message: string, action?: ToastAction) => push(message, 'success', action),
    error: (message: string) => push(message, 'error'),
    info: (message: string, action?: ToastAction) => push(message, 'neutral', action),
};

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function useToasts(): Toast[] {
    return useSyncExternalStore(subscribe, currentToasts, currentToasts);
}
```

- [ ] **Step 4: Test laufen lassen, er ist grün**

Run: `ddev exec pnpm test resources/js/lib/toast.test.ts`
Expected: PASS (3 Tests).

- [ ] **Step 5: Dialog, Drawer, ConfirmDialog (`resources/js/components/ui/dialog.tsx`)**

```tsx
import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { t } from '@/lib/i18n';
import { Button } from './button';
import { cx } from './cx';

type DialogProps = {
    open: boolean;
    onClose(): void;
    title: ReactNode;
    description?: ReactNode;
    children?: ReactNode;
    footer?: ReactNode;
    wide?: boolean;
};

/** Focus the first field (or [data-autofocus]) instead of the close button, like the clickdummy. */
function focusFirstField(event: Event): void {
    const content = event.currentTarget as HTMLElement | null;
    const target = content?.querySelector<HTMLElement>('[data-autofocus], input:not([type=hidden]), select, textarea');
    if (target) {
        event.preventDefault();
        target.focus();
    }
}

function Head({ title, description }: { title: ReactNode; description?: ReactNode }) {
    return (
        <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
                <RadixDialog.Title className="text-xl">{title}</RadixDialog.Title>
                {description && <RadixDialog.Description className="mt-1 text-muted">{description}</RadixDialog.Description>}
            </div>
            <RadixDialog.Close asChild>
                <Button variant="ghost" size="sm" iconOnly icon={<X />}>
                    {t('common.close')}
                </Button>
            </RadixDialog.Close>
        </div>
    );
}

/** Centered modal (Radix: focus trap, Escape, scroll lock, aria). */
export function Dialog({ open, onClose, title, description, children, footer, wide = false }: DialogProps) {
    return (
        <RadixDialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
            <RadixDialog.Portal>
                <RadixDialog.Overlay className="fixed inset-0 z-50 grid animate-overlay-in place-items-center overflow-y-auto bg-overlay p-4">
                    <RadixDialog.Content
                        onOpenAutoFocus={focusFirstField}
                        {...(description ? {} : { 'aria-describedby': undefined })}
                        className={cx('grid max-h-[calc(100dvh-2rem)] w-full animate-pop-in gap-5 overflow-auto rounded-xl bg-surface p-6 shadow-float focus:outline-none', wide ? 'max-w-[44rem]' : 'max-w-[32rem]')}
                    >
                        <Head title={title} description={description} />
                        {children}
                        {footer && <div className="flex flex-wrap justify-end gap-2">{footer}</div>}
                    </RadixDialog.Content>
                </RadixDialog.Overlay>
            </RadixDialog.Portal>
        </RadixDialog.Root>
    );
}

/** Side panel from the right, for forms next to their context. */
export function Drawer({ open, onClose, title, description, children, footer }: Omit<DialogProps, 'wide'>) {
    return (
        <RadixDialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
            <RadixDialog.Portal>
                <RadixDialog.Overlay className="fixed inset-0 z-50 animate-overlay-in bg-overlay" />
                <RadixDialog.Content
                    onOpenAutoFocus={focusFirstField}
                    {...(description ? {} : { 'aria-describedby': undefined })}
                    className="fixed top-3 right-3 bottom-3 z-50 grid w-[min(calc(100%-1.5rem),30rem)] animate-slide-in grid-rows-[auto_1fr_auto] overflow-auto rounded-xl bg-surface shadow-float focus:outline-none"
                >
                    <div className="px-6 pt-6 pb-4">
                        <Head title={title} description={description} />
                    </div>
                    <div className="grid content-start gap-5 px-6 pb-6">{children}</div>
                    {footer && <div className="sticky bottom-0 flex justify-end gap-2 rounded-b-xl bg-surface px-6 py-4">{footer}</div>}
                </RadixDialog.Content>
            </RadixDialog.Portal>
        </RadixDialog.Root>
    );
}

type ConfirmProps = {
    open: boolean;
    onClose(): void;
    onConfirm(): void;
    title: ReactNode;
    description?: ReactNode;
    confirmLabel: string;
    pending?: boolean;
    danger?: boolean;
    icon?: ReactNode;
};

export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel, pending = false, danger = false, icon }: ConfirmProps) {
    return (
        <Dialog
            open={open}
            onClose={onClose}
            title={title}
            description={description}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>
                        {t('common.cancel')}
                    </Button>
                    <Button variant={danger ? 'danger' : 'primary'} icon={icon} pending={pending} onClick={onConfirm} data-autofocus>
                        {confirmLabel}
                    </Button>
                </>
            }
        />
    );
}
```

- [ ] **Step 6: Menü (`resources/js/components/ui/menu.tsx`)**

```tsx
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { ReactElement, ReactNode } from 'react';
import { t } from '@/lib/i18n';
import { Tag } from './badge';
import { cx } from './cx';

const ITEM =
    'flex w-full cursor-pointer items-center gap-2 rounded-sm px-2.5 py-2 text-left text-md text-ink no-underline outline-none select-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-45 data-[highlighted]:bg-surface-2 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted';

/**
 * Drop-down menu (Radix: arrow keys, typeahead, Escape, focus return). Not modal: a dialog opened from an
 * item would otherwise inherit Radix' pointer-events lock on <body>.
 */
export function Menu({ trigger, children, align = 'end', side = 'bottom', className }: { trigger: ReactElement; children: ReactNode; align?: 'start' | 'end'; side?: 'top' | 'bottom'; className?: string }) {
    return (
        <DropdownMenu.Root modal={false}>
            <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
            <DropdownMenu.Portal>
                <DropdownMenu.Content align={align} side={side} sideOffset={6} className={cx('z-40 grid min-w-56 animate-menu-in rounded-md bg-surface p-1.5 shadow-float focus:outline-none', className)}>
                    {children}
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    );
}

export function MenuItem({ icon, danger = false, onSelect, disabled, children }: { icon?: ReactNode; danger?: boolean; onSelect?: () => void; disabled?: boolean; children: ReactNode }) {
    return (
        <DropdownMenu.Item onSelect={onSelect} disabled={disabled} className={cx(ITEM, danger && 'text-bad [&_svg]:text-bad')}>
            {icon}
            {children}
        </DropdownMenu.Item>
    );
}

export function MenuLabel({ children }: { children: ReactNode }) {
    return <DropdownMenu.Label className="px-2.5 pt-1.5 pb-0.5 text-xs font-medium text-muted">{children}</DropdownMenu.Label>;
}

export function MenuSeparator() {
    return <DropdownMenu.Separator className="mx-1.5 my-1 h-px bg-surface-2" />;
}

export function MenuRadioGroup({ value, onValueChange, children }: { value: string; onValueChange(value: string): void; children: ReactNode }) {
    return (
        <DropdownMenu.RadioGroup value={value} onValueChange={onValueChange}>
            {children}
        </DropdownMenu.RadioGroup>
    );
}

export function MenuRadioItem({ value, icon, children }: { value: string; icon?: ReactNode; children: ReactNode }) {
    return (
        <DropdownMenu.RadioItem value={value} className={ITEM}>
            {icon}
            {children}
            <DropdownMenu.ItemIndicator className="ml-auto">
                <Tag>{t('menu.active')}</Tag>
            </DropdownMenu.ItemIndicator>
        </DropdownMenu.RadioItem>
    );
}
```

- [ ] **Step 7: Toaster (`resources/js/components/ui/toaster.tsx`) und Barrel**

```tsx
import { AlertCircle, Check, Info } from 'lucide-react';
import { dismissToast, useToasts } from '@/lib/toast';
import { cx } from './cx';

export function Toaster() {
    const toasts = useToasts();

    return (
        <div role="status" aria-live="polite" className="fixed bottom-5 left-1/2 z-60 grid w-[min(calc(100%-2rem),26rem)] -translate-x-1/2 gap-2">
            {toasts.map((item) => (
                <div
                    key={item.id}
                    className={cx(
                        'flex animate-pop-in items-center gap-3 rounded-full py-2.5 pr-2.5 pl-4 text-sm font-medium shadow-float [&>svg]:size-4 [&>svg]:shrink-0',
                        item.tone === 'error' ? 'bg-bad text-white' : 'bg-ink text-bg',
                    )}
                >
                    {item.tone === 'success' ? <Check aria-hidden /> : item.tone === 'error' ? <AlertCircle aria-hidden /> : <Info aria-hidden />}
                    <span className="min-w-0 flex-1">{item.message}</span>
                    {item.action && (
                        <button
                            type="button"
                            className="h-7 shrink-0 rounded-full bg-white/15 px-3 text-xs font-strong hover:bg-white/25 dark:bg-black/10 dark:hover:bg-black/20"
                            onClick={() => {
                                item.action?.run();
                                dismissToast(item.id);
                            }}
                        >
                            {item.action.label}
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
}
```

`resources/js/components/ui/index.ts` ergänzen:

```ts
export { ConfirmDialog, Dialog, Drawer } from './dialog';
export { Menu, MenuItem, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuSeparator } from './menu';
export { Toaster } from './toaster';
```

Texte – `lang/en.json`:

```json
    "common.cancel": "Cancel",
    "common.close": "Close",
    "menu.active": "active",
```

`lang/de.json`:

```json
    "common.cancel": "Abbrechen",
    "common.close": "Schließen",
    "menu.active": "aktiv",
```

- [ ] **Step 8: Prüfen und committen**

Run: `ddev exec pnpm test && ddev exec pnpm typecheck && ddev exec pnpm build && ddev artisan test --filter=TranslationsTest`
Expected: alles grün.

```bash
git add resources/js/components/ui resources/js/lib/toast.ts resources/js/lib/toast.test.ts lang/en.json lang/de.json
git commit -m "feat: dialog, drawer, menu and toasts on Radix primitives" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Serverseite – Dokumentfilter, Übersicht, Shared Prop `org`

**Files:**
- Create: `app/Support/Amount.php`, `app/Support/DocumentQuery.php`, `app/Support/Overview.php`
- Modify: `app/State/Provider/DocumentProvider.php` (nutzt `DocumentQuery`), `app/ApiResource/DocumentResource.php` (Beschreibung des Parameters `status`)
- Modify: `app/Http/Middleware/HandleInertiaRequests.php` (Shared Prop `org`), `resources/js/types.ts`
- Test: `tests/Feature/Support/DocumentQueryTest.php`, `tests/Feature/Support/OverviewTest.php`, `tests/Feature/Pages/ShellPropsTest.php`

**Interfaces:**
- Consumes: `App\Models\Document` (Spalten `type`, `status`, `date`, `due_date`, `valid_until`, `paid_at`, `gross_total`, `customer_id`, `updated_at`), `App\Support\Like`, `App\Domain\Lifecycle\StatusMachine::isOverdue()`, Factories `Document::factory()->type()->finalized()`, `Customer::factory()`.
- Produces: siehe „Interfaces → Server“. Form von `Overview::build()`:

```
{
  figures: { open: {gross: "0.00", count: 0}, overdue: {…}, offers: {…}, paid_month: {…}, paid_year: {…} },
  attention: [ {id, type, status, number, customer_name, gross_total, is_overdue, reason: "overdue"|"offer_expired"|"offer_expiring"|"draft", reason_date: "YYYY-MM-DD"} ],   // höchstens 8
  attention_count: int,                                                                                                                             // alle
  recent: [ {…gleiche Felder, reason: null, reason_date: null} ]                                                                                     // 6, zuletzt geändert zuerst
}
```

- [ ] **Step 1: Failing tests schreiben**

`tests/Feature/Support/DocumentQueryTest.php`:

```php
<?php

use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Models\Customer;
use App\Models\Document;
use App\Support\DocumentQuery;
use Illuminate\Validation\ValidationException;

beforeEach(function () {
    $this->today = '2026-10-11';
    $this->travelTo('2026-10-11 10:00:00');
    $this->fjord = Customer::factory()->create(['name' => 'Fjord Analytics AB']);
    $this->late = Document::factory()->finalized()->create(['customer_id' => $this->fjord->id, 'gross_total' => '119.00', 'due_date' => '2026-10-01']);
    // explicit customer: the factory picks a random demo name, which could be Fjord as well
    $this->onTime = Document::factory()->finalized()->create(['customer_id' => Customer::factory()->create(['name' => 'Hotel Alpenglück'])->id, 'gross_total' => '0.10', 'due_date' => '2026-10-20']);
    $this->offer = Document::factory()->type(DocumentType::Offer)->create(['customer_id' => $this->fjord->id, 'gross_total' => '50.00']);
});

it('filters overdue invoices like StatusMachine::isOverdue', function () {
    $ids = DocumentQuery::filtered(['status' => DocumentQuery::OVERDUE], $this->today)->pluck('id')->all();

    expect($ids)->toBe([$this->late->id]);
});

it('counts per type with the other filters applied', function () {
    expect(DocumentQuery::counts(['customer_id' => $this->fjord->id], $this->today))
        ->toBe(['all' => 2, 'offer' => 1, 'confirmation' => 0, 'invoice' => 1, 'cancellation' => 0]);
});

it('sums the gross totals as an exact string', function () {
    expect(DocumentQuery::summary(['type' => 'invoice'], $this->today))->toBe(['count' => 2, 'gross_total' => '119.10'])
        ->and(DocumentQuery::summary(['type' => 'cancellation'], $this->today))->toBe(['count' => 0, 'gross_total' => '0.00']);
});

it('searches number and customer name', function () {
    $ids = DocumentQuery::filtered(['q' => 'fjord'], $this->today)->pluck('id')->sort()->values()->all();

    expect($ids)->toBe(collect([$this->late->id, $this->offer->id])->sort()->values()->all());
});

it('drops invalid filters of a typed URL instead of failing (review focus)', function () {
    $query = ['type' => 'bogus', 'status' => ['x'], 'q' => '  ', 'customer_id' => str_repeat('x', 40), 'page' => '2'];

    expect(DocumentQuery::lenient($query))->toBe([])
        ->and(DocumentQuery::lenient(['type' => 'invoice', 'status' => 'overdue', 'q' => ' Fjord ']))
        ->toBe(['type' => 'invoice', 'status' => 'overdue', 'q' => 'Fjord']);
});

it('refuses invalid filters strictly for the API', function () {
    DocumentQuery::validate(['status' => 'bogus']);
})->throws(ValidationException::class);

it('lists overdue invoices over the API as well', function () {
    $this->withToken(apiToken())
        ->getJson('/api/documents?status=overdue')
        ->assertOk()
        ->assertJsonCount(1)
        ->assertJsonPath('0.id', $this->late->id);
});

it('keeps the status filter of the API', function () {
    $this->withToken(apiToken())
        ->getJson('/api/documents?status='.DocumentStatus::Draft->value)
        ->assertOk()
        ->assertJsonCount(1)
        ->assertJsonPath('0.id', $this->offer->id);
});
```

`tests/Feature/Support/OverviewTest.php`:

```php
<?php

use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Models\Customer;
use App\Models\Document;
use App\Support\Overview;
use Carbon\CarbonImmutable;

beforeEach(fn () => $this->travelTo('2026-10-11 10:00:00'));

$today = fn (): CarbonImmutable => CarbonImmutable::parse('2026-10-11');

it('is empty on a fresh installation (review focus)', function () use ($today) {
    $overview = Overview::build($today());

    expect($overview['figures']['open'])->toBe(['gross' => '0.00', 'count' => 0])
        ->and($overview['figures']['paid_year'])->toBe(['gross' => '0.00', 'count' => 0])
        ->and($overview['attention'])->toBe([])
        ->and($overview['attention_count'])->toBe(0)
        ->and($overview['recent'])->toBe([]);
});

it('sums open, overdue, offered and paid amounts exactly', function () use ($today) {
    Document::factory()->finalized()->create(['gross_total' => '100.10', 'due_date' => '2026-10-20']);
    Document::factory()->finalized()->create(['gross_total' => '0.20', 'due_date' => '2026-10-01']);
    Document::factory()->type(DocumentType::Offer)->finalized()->create(['gross_total' => '500.00', 'valid_until' => '2026-11-30']);
    Document::factory()->finalized()->create(['status' => DocumentStatus::Paid, 'paid_at' => '2026-10-05 12:00:00', 'gross_total' => '40.00']);
    Document::factory()->finalized()->create(['status' => DocumentStatus::Paid, 'paid_at' => '2026-02-01 12:00:00', 'gross_total' => '60.00']);
    Document::factory()->finalized()->create(['status' => DocumentStatus::Paid, 'paid_at' => '2025-12-31 12:00:00', 'gross_total' => '999.00']);

    $figures = Overview::build($today())['figures'];

    expect($figures['open'])->toBe(['gross' => '100.30', 'count' => 2])
        ->and($figures['overdue'])->toBe(['gross' => '0.20', 'count' => 1])
        ->and($figures['offers'])->toBe(['gross' => '500.00', 'count' => 1])
        ->and($figures['paid_month'])->toBe(['gross' => '40.00', 'count' => 1])
        ->and($figures['paid_year'])->toBe(['gross' => '100.00', 'count' => 2]);
});

it('lists overdue invoices, then expiring offers, then drafts', function () use ($today) {
    $draft = Document::factory()->create(['updated_at' => '2026-10-09 08:00:00']);
    $expiring = Document::factory()->type(DocumentType::Offer)->finalized()->create(['valid_until' => '2026-10-15']);
    $expired = Document::factory()->type(DocumentType::Offer)->finalized()->create(['valid_until' => '2026-10-02']);
    Document::factory()->type(DocumentType::Offer)->finalized()->create(['valid_until' => '2026-12-01']);
    $late = Document::factory()->finalized()->create(['due_date' => '2026-10-08']);

    $attention = Overview::build($today())['attention'];

    expect(array_column($attention, 'id'))->toBe([$late->id, $expired->id, $expiring->id, $draft->id])
        ->and(array_column($attention, 'reason'))->toBe(['overdue', 'offer_expired', 'offer_expiring', 'draft'])
        ->and(array_column($attention, 'reason_date'))->toBe(['2026-10-08', '2026-10-02', '2026-10-15', '2026-10-09'])
        ->and($attention[0]['is_overdue'])->toBeTrue();
});

it('shows at most eight items but counts all', function () use ($today) {
    Document::factory()->count(10)->create();

    $overview = Overview::build($today());

    expect($overview['attention'])->toHaveCount(8)
        ->and($overview['attention_count'])->toBe(10);
});

it('lists the six documents changed last', function () use ($today) {
    $documents = collect(range(1, 7))->map(fn (int $day) => Document::factory()->create(['updated_at' => "2026-10-0{$day} 09:00:00"]));

    $recent = Overview::build($today())['recent'];

    expect(array_column($recent, 'id'))->toBe($documents->reverse()->take(6)->pluck('id')->values()->all())
        ->and($recent[0])->toHaveKeys(['id', 'type', 'status', 'number', 'customer_name', 'gross_total', 'is_overdue']);
});

it('sums open invoices per customer for the customer list', function () use ($today) {
    $customer = Customer::factory()->create();
    Document::factory()->finalized()->create(['customer_id' => $customer->id, 'gross_total' => '10.05', 'due_date' => '2026-10-01']);
    Document::factory()->finalized()->create(['customer_id' => $customer->id, 'gross_total' => '20.00', 'due_date' => '2026-10-30']);
    Document::factory()->create(['customer_id' => $customer->id, 'gross_total' => '99.00']); // draft: not open

    expect(Overview::openByCustomer($today()))->toBe([$customer->id => ['gross' => '30.05', 'count' => 2, 'overdue' => 1]]);
});
```

`tests/Feature/Pages/ShellPropsTest.php`:

```php
<?php

use App\Models\Organization;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

it('shares the organization name with signed-in users', function () {
    Organization::query()->update(['name' => 'Studio Nordlicht']);

    $this->actingAs(User::factory()->create())->get('/en')
        ->assertInertia(fn (Assert $page) => $page->where('org.name', 'Studio Nordlicht'));
});

it('shares no organization with guests', function () {
    $this->get('/en/login')->assertInertia(fn (Assert $page) => $page->where('org', null));
});
```

- [ ] **Step 2: Tests laufen lassen, sie schlagen fehl**

Run: `ddev artisan test --filter='DocumentQueryTest|OverviewTest|ShellPropsTest'`
Expected: FAIL – `Class "App\Support\DocumentQuery" not found`, `Class "App\Support\Overview" not found`, Prop `org` fehlt.

- [ ] **Step 3: `app/Support/Amount.php`**

```php
<?php

namespace App\Support;

use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use LogicException;

/** A DECIMAL column or SQL sum as money string with two decimals ("0.00" for no rows). */
final class Amount
{
    public static function of(mixed $value): string
    {
        if (is_float($value)) {
            // MariaDB returns DECIMAL as string; a float here means the PDO settings changed
            throw new LogicException('An amount came back from the database as float.');
        }
        $text = is_string($value) || is_int($value) ? trim((string) $value) : '';

        return (string) BigDecimal::of($text === '' ? '0' : $text)->toScale(2, RoundingMode::HalfUp);
    }
}
```

- [ ] **Step 4: `app/Support/DocumentQuery.php`**

```php
<?php

namespace App\Support;

use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Models\Document;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Filters of the document list, shared by GET /api/documents and the documents page (rows, counts, sum).
 * status "overdue" = open invoice past its due date (the rule of StatusMachine::isOverdue).
 */
final class DocumentQuery
{
    public const SORTS = ['date', 'number', 'updated_at', 'gross_total'];

    public const OVERDUE = 'overdue';

    /** Filters a page URL may carry (the API takes all rules). */
    private const PAGE_FILTERS = ['type', 'status', 'customer_id', 'q'];

    /**
     * @return array<string, list<mixed>>
     */
    public static function rules(): array
    {
        return [
            'type' => ['sometimes', Rule::enum(DocumentType::class)],
            'status' => ['sometimes', Rule::in([...array_map(fn (DocumentStatus $s): string => $s->value, DocumentStatus::cases()), self::OVERDUE])],
            'customer_id' => ['sometimes', 'string', 'max:26'],
            'q' => ['sometimes', 'nullable', 'string', 'max:100'],
            'date_from' => ['sometimes', 'date_format:Y-m-d'],
            'date_to' => ['sometimes', 'date_format:Y-m-d'],
            'sort' => ['sometimes', Rule::in([...self::SORTS, ...array_map(fn (string $s): string => "-{$s}", self::SORTS)])],
        ];
    }

    /**
     * Strict, for the API: anything invalid is a 422.
     *
     * @param  array<string, mixed>  $query
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    public static function validate(array $query): array
    {
        return Validator::make($query, self::rules())->validate();
    }

    /**
     * Lenient, for pages whose URLs people type and bookmark: invalid values are dropped, strings trimmed.
     *
     * @param  array<string, mixed>  $query
     * @return array<string, string>
     */
    public static function lenient(array $query): array
    {
        $rules = self::rules();
        $filters = [];
        foreach (self::PAGE_FILTERS as $key) {
            $value = $query[$key] ?? null;
            if (! is_string($value) || trim($value) === '') {
                continue;
            }
            $value = trim($value);
            if (Validator::make([$key => $value], [$key => $rules[$key]])->passes()) {
                $filters[$key] = $value;
            }
        }

        return $filters;
    }

    /**
     * @param  array<string, mixed>  $filters  validated (validate() or lenient())
     * @return Builder<Document>
     */
    public static function filtered(array $filters, string $today): Builder
    {
        $q = trim((string) ($filters['q'] ?? ''));
        $status = $filters['status'] ?? null;

        return Document::query()
            ->when($filters['type'] ?? null, fn ($query, string $type) => $query->where('type', $type))
            ->when($status === self::OVERDUE, fn ($query) => $query
                ->where('type', DocumentType::Invoice->value)
                ->where('status', DocumentStatus::Open->value)
                ->where('due_date', '<', $today))
            ->when(is_string($status) && $status !== self::OVERDUE, fn ($query) => $query->where('status', $status))
            ->when($filters['customer_id'] ?? null, fn ($query, string $id) => $query->where('customer_id', $id))
            ->when($filters['date_from'] ?? null, fn ($query, string $date) => $query->where('date', '>=', $date))
            ->when($filters['date_to'] ?? null, fn ($query, string $date) => $query->where('date', '<=', $date))
            ->when($q !== '', fn ($query) => $query->where(fn ($where) => $where
                ->where('number', 'like', Like::contains($q))
                ->orWhereHas('customer', fn ($customer) => $customer->withTrashed()->where('name', 'like', Like::contains($q)))));
    }

    /**
     * @param  Builder<Document>  $query
     * @return Builder<Document>
     */
    public static function sorted(Builder $query, string $sort = '-date'): Builder
    {
        $direction = str_starts_with($sort, '-') ? 'desc' : 'asc';

        return $query->orderBy(ltrim($sort, '-'), $direction)->orderBy('id', $direction);
    }

    /**
     * Documents per type under the other filters (the type pills of the documents page).
     *
     * @param  array<string, mixed>  $filters
     * @return array{all: int, offer: int, confirmation: int, invoice: int, cancellation: int}
     */
    public static function counts(array $filters, string $today): array
    {
        $byType = self::filtered($filters, $today)->toBase()
            ->selectRaw('type, COUNT(*) as aggregate')
            ->groupBy('type')
            ->pluck('aggregate', 'type');
        $count = fn (DocumentType $type): int => (int) ($byType[$type->value] ?? 0);
        $offer = $count(DocumentType::Offer);
        $confirmation = $count(DocumentType::Confirmation);
        $invoice = $count(DocumentType::Invoice);
        $cancellation = $count(DocumentType::Cancellation);

        return [
            'all' => $offer + $confirmation + $invoice + $cancellation,
            'offer' => $offer,
            'confirmation' => $confirmation,
            'invoice' => $invoice,
            'cancellation' => $cancellation,
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array{count: int, gross_total: string}
     */
    public static function summary(array $filters, string $today): array
    {
        // the query builder returns stdClass rows; as array they are typed for Larastan
        $row = (array) (self::filtered($filters, $today)->toBase()
            ->selectRaw('COUNT(*) as aggregate, SUM(gross_total) as gross')
            ->first() ?? []);

        return ['count' => (int) ($row['aggregate'] ?? 0), 'gross_total' => Amount::of($row['gross'] ?? null)];
    }
}
```

- [ ] **Step 5: `DocumentProvider` auf `DocumentQuery` umstellen**

In `app/State/Provider/DocumentProvider.php` die Konstante `SORTS` und den Block von `$filters = Validator::make(…)` bis `return Paginate::query(…)` ersetzen durch:

```php
        $request = ApiContext::request($context);
        $filters = DocumentQuery::validate($request->query());
        $query = DocumentQuery::sorted(DocumentQuery::filtered($filters, now()->toDateString()), (string) ($filters['sort'] ?? '-date'))
            ->with(['customer' => fn ($customer) => $customer->withTrashed()]);

        return Paginate::query($query, $request, fn (Document $document): DocumentResource => DocumentResource::fromModel($document));
```

Imports: `use App\Support\DocumentQuery;` ergänzen; nicht mehr benutzte Imports (`DocumentStatus`, `DocumentType`, `Like`, `Validator`, `Rule`) entfernen.

In `app/ApiResource/DocumentResource.php` den Parameter `status` beschreiben:

```php
                'status' => new QueryParameter(description: 'draft, open, accepted, rejected, done, paid, cancelled, closed, or overdue (open invoices past their due date)'),
```

- [ ] **Step 6: `app/Support/Overview.php`**

```php
<?php

namespace App\Support;

use App\Domain\Lifecycle\StatusMachine;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Models\Document;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

/**
 * Figures and lists of the overview page. Phase 8 returns exactly this array from the MCP tool get-overview.
 * Sums come from the stored document totals (drafts keep them current on every save) and stay strings.
 */
final class Overview
{
    public const ATTENTION_LIMIT = 8;

    public const RECENT_LIMIT = 6;

    /** Open offers whose validity ends within this many days need attention. */
    public const EXPIRY_DAYS = 7;

    /**
     * @return array{
     *     figures: array{open: array{gross: string, count: int}, overdue: array{gross: string, count: int}, offers: array{gross: string, count: int}, paid_month: array{gross: string, count: int}, paid_year: array{gross: string, count: int}},
     *     attention: list<array<string, mixed>>,
     *     attention_count: int,
     *     recent: list<array<string, mixed>>
     * }
     */
    public static function build(CarbonImmutable $today): array
    {
        $day = $today->toDateString();
        [$attention, $attentionCount] = self::attention($today);

        return [
            'figures' => [
                'open' => self::figure(self::openInvoices()),
                'overdue' => self::figure(self::openInvoices()->where('due_date', '<', $day)),
                'offers' => self::figure(self::openOffers()),
                'paid_month' => self::figure(self::paidInvoices()->whereBetween('paid_at', [$today->startOfMonth(), $today->endOfMonth()])),
                'paid_year' => self::figure(self::paidInvoices()->whereBetween('paid_at', [$today->startOfYear(), $today->endOfYear()])),
            ],
            'attention' => $attention,
            'attention_count' => $attentionCount,
            'recent' => self::withCustomer(Document::query())
                ->orderByDesc('updated_at')->orderByDesc('id')
                ->limit(self::RECENT_LIMIT)->get()
                ->map(fn (Document $document): array => self::row($document, $day))
                ->values()->all(),
        ];
    }

    /**
     * Open invoices per customer (customer list): gross sum, count and how many are overdue.
     *
     * @return array<string, array{gross: string, count: int, overdue: int}>
     */
    public static function openByCustomer(CarbonImmutable $today): array
    {
        $rows = self::openInvoices()->whereNotNull('customer_id')->toBase()
            ->selectRaw('customer_id, COUNT(*) as aggregate, SUM(gross_total) as gross, SUM(CASE WHEN due_date < ? THEN 1 ELSE 0 END) as overdue', [$today->toDateString()])
            ->groupBy('customer_id')
            ->get();

        $result = [];
        foreach ($rows as $row) {
            $row = (array) $row;
            $result[(string) $row['customer_id']] = ['gross' => Amount::of($row['gross']), 'count' => (int) $row['aggregate'], 'overdue' => (int) $row['overdue']];
        }

        return $result;
    }

    /**
     * Overdue invoices first (oldest due date), then open offers that expired or expire within EXPIRY_DAYS
     * (expired first), then drafts (changed last first).
     *
     * @return array{0: list<array<string, mixed>>, 1: int}
     */
    private static function attention(CarbonImmutable $today): array
    {
        $day = $today->toDateString();
        $overdue = self::openInvoices()->where('due_date', '<', $day);
        $offers = self::openOffers()->whereNotNull('valid_until')->where('valid_until', '<=', $today->addDays(self::EXPIRY_DAYS)->toDateString());
        $drafts = Document::query()->where('status', DocumentStatus::Draft->value);

        $rows = [
            ...self::withCustomer(clone $overdue)->orderBy('due_date')->orderBy('id')->limit(self::ATTENTION_LIMIT)->get()
                ->map(fn (Document $d): array => self::row($d, $day, 'overdue', $d->due_date?->toDateString())),
            ...self::withCustomer(clone $offers)->orderBy('valid_until')->orderBy('id')->limit(self::ATTENTION_LIMIT)->get()
                ->map(fn (Document $d): array => self::row($d, $day, $d->valid_until !== null && $d->valid_until->toDateString() < $day ? 'offer_expired' : 'offer_expiring', $d->valid_until?->toDateString())),
            ...self::withCustomer(clone $drafts)->orderByDesc('updated_at')->orderByDesc('id')->limit(self::ATTENTION_LIMIT)->get()
                ->map(fn (Document $d): array => self::row($d, $day, 'draft', $d->updated_at?->toDateString())),
        ];

        return [array_slice($rows, 0, self::ATTENTION_LIMIT), $overdue->count() + $offers->count() + $drafts->count()];
    }

    /**
     * @return array<string, mixed>
     */
    private static function row(Document $document, string $today, ?string $reason = null, ?string $reasonDate = null): array
    {
        return [
            'id' => $document->id,
            'type' => $document->type->value,
            'status' => $document->status->value,
            'number' => $document->number,
            'customer_name' => $document->customer?->name,
            'gross_total' => Amount::of((string) $document->gross_total),
            'is_overdue' => StatusMachine::isOverdue($document->type, $document->status, $document->due_date?->toDateString(), $today),
            'reason' => $reason,
            'reason_date' => $reasonDate,
        ];
    }

    /**
     * @param  Builder<Document>  $query
     * @return array{gross: string, count: int}
     */
    private static function figure(Builder $query): array
    {
        $row = (array) ($query->toBase()->selectRaw('COUNT(*) as aggregate, SUM(gross_total) as gross')->first() ?? []);

        return ['gross' => Amount::of($row['gross'] ?? null), 'count' => (int) ($row['aggregate'] ?? 0)];
    }

    /**
     * @param  Builder<Document>  $query
     * @return Builder<Document>
     */
    private static function withCustomer(Builder $query): Builder
    {
        return $query->with(['customer' => fn ($customer) => $customer->withTrashed()]);
    }

    /** @return Builder<Document> */
    private static function openInvoices(): Builder
    {
        return Document::query()->where('type', DocumentType::Invoice->value)->where('status', DocumentStatus::Open->value);
    }

    /** @return Builder<Document> */
    private static function openOffers(): Builder
    {
        return Document::query()->where('type', DocumentType::Offer->value)->where('status', DocumentStatus::Open->value);
    }

    /** @return Builder<Document> */
    private static function paidInvoices(): Builder
    {
        return Document::query()->where('type', DocumentType::Invoice->value)->where('status', DocumentStatus::Paid->value);
    }
}
```

Hinweis: Die Zeitstempel- und Datumsspalten sind am `Document`-Model als `date`/`datetime` gecastet (Phase 2: `due_date`, `valid_until`, `paid_at`, `updated_at`). Meldet Larastan einen anderen Typ, die Casts in `app/Models/Document.php` nachsehen und die `?->toDateString()`-Aufrufe daran ausrichten, nicht die Casts ändern.

- [ ] **Step 7: Shared Prop `org`**

In `app/Http/Middleware/HandleInertiaRequests.php` im Rückgabe-Array nach `auth` ergänzen und `use App\Models\Organization;` importieren:

```php
            // name in the user menu; guests (login page) get nothing
            'org' => fn (): ?array => $request->user() === null ? null : ['name' => (string) Organization::query()->value('name')],
```

`resources/js/types.ts` – `SharedProps` erweitern:

```ts
/** Props every Inertia page receives (app/Http/Middleware/HandleInertiaRequests.php). */
export type SharedProps = {
    locale: Locale;
    translations: Record<string, string>;
    auth: { user: AuthUser | null };
    org: { name: string } | null;
};
```

- [ ] **Step 8: Tests laufen lassen, sie sind grün**

Run: `ddev artisan test --filter='DocumentQueryTest|OverviewTest|ShellPropsTest|DocumentReadApiTest|RightsMatrixTest|OpenApiTest'`
Expected: PASS. `ShellPropsTest` nutzt noch die Komponente `home` (Task 10 benennt sie um) – das ist für diesen Test egal, er prüft nur die Shared Props.

- [ ] **Step 9: Pint, Larastan, ganze Suite**

Run: `ddev exec vendor/bin/pint && ddev exec vendor/bin/phpstan analyse --memory-limit=1G && ddev artisan test`
Expected: `[OK] No errors`, alle Tests grün (Architekturtests: `App\State` nutzt weiter kein `App\Domain`; `App\Support\Overview` darf `StatusMachine` nutzen).

- [ ] **Step 10: Commit**

```bash
git add app/Support/Amount.php app/Support/DocumentQuery.php app/Support/Overview.php app/State/Provider/DocumentProvider.php app/ApiResource/DocumentResource.php app/Http/Middleware/HandleInertiaRequests.php resources/js/types.ts tests/Feature/Support tests/Feature/Pages/ShellPropsTest.php
git commit -m "feat: shared document filters with overdue, overview figures and org prop" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: App-Shell (Sidebar, Einklappen, mobil, Benutzermenü, Theme, Abmelden) und Dialog „Neues Dokument“

Port von `prototypes/clickdummy-v2/src/layout/AppShell.tsx`, `Logo.tsx`, `src/styles/shell.css` und `src/routes/documents/NewDocumentDialog.*`. Unterschiede zum Klickdummy: Navigation nur mit vorhandenen Seiten, kein „Demo-Daten zurücksetzen“, dafür Sprache im Benutzermenü, Abmelden per `POST /{locale}/logout`.

**Files:**
- Create: `resources/js/layouts/app-shell.tsx`, `resources/js/layouts/nav.ts`, `resources/js/layouts/nav.test.ts`, `resources/js/layouts/user-menu.tsx`, `resources/js/layouts/logo.tsx`
- Create: `resources/js/components/new-document/new-document-context.tsx`, `resources/js/components/new-document/new-document-dialog.tsx`
- Create: `resources/js/lib/prefs.ts`, `resources/js/lib/hooks.ts`
- Modify: `resources/js/pages/home.tsx` (vorübergehend in der Shell; Task 10 ersetzt die Seite)
- Modify: `lang/en.json`, `lang/de.json`

**Interfaces:**
- Consumes: Komponenten aus Task 6/7, `useThemePref`/`setThemePref`/`isThemePref` (Task 2), `localeHref` (Task 3), `useCustomerOptions`, `useCustomer`, `createDocument` (Task 5), `toast` (Task 7), Shared Props `auth.user`, `org`, `locale` (Task 8).
- Produces: `appLayout`, `AppShell`, `navItems`, `setupItems`, `isActive`, `NavItem`, `LogoMark`, `useNewDocument`, `NewDocumentProvider`, `NewDocumentOptions`, `useStoredFlag(key, initial?)`, `useDebounced(value, ms?)`.

- [ ] **Step 1: Failing test für die Navigation**

`resources/js/layouts/nav.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isActive, navItems } from './nav';

describe('isActive', () => {
    it('matches the overview exactly and sections with their sub pages', () => {
        const [overview, documents] = navItems();

        expect(isActive('/en', overview)).toBe(true);
        expect(isActive('/en?from=login', overview)).toBe(true);
        expect(isActive('/en/documents', overview)).toBe(false);
        expect(isActive('/en/documents?type=invoice', documents)).toBe(true);
        expect(isActive('/en/documents/01k9', documents)).toBe(true);
        expect(isActive('/en/documents-archive', documents)).toBe(false);
    });

    it('lists only pages that exist in this phase', () => {
        expect(navItems().map((item) => item.href)).toEqual(['/en', '/en/documents', '/en/customers']);
    });
});
```

Run: `ddev exec pnpm test resources/js/layouts`
Expected: FAIL – `Failed to resolve import "./nav"`.

- [ ] **Step 2: `nav.ts`, `prefs.ts`, `hooks.ts`, `logo.tsx`**

`resources/js/layouts/nav.ts`:

```ts
import { FileText, LayoutGrid, Users, type LucideIcon } from 'lucide-react';
import { path, t } from '@/lib/i18n';

export type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };

/** Main navigation. Phase 7 adds Templates (after Customers). */
export function navItems(): NavItem[] {
    return [
        { href: path(''), label: t('nav.overview'), icon: LayoutGrid, exact: true },
        { href: path('/documents'), label: t('nav.documents'), icon: FileText },
        { href: path('/customers'), label: t('nav.customers'), icon: Users },
    ];
}

/** Group "Set up" (custom fields, settings): phase 7 fills it; the shell hides the group while it is empty. */
export function setupItems(): NavItem[] {
    return [];
}

/** `url` is Inertia's page URL (path + query). */
export function isActive(url: string, item: NavItem): boolean {
    const pathname = url.split(/[?#]/)[0];
    return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}
```

`resources/js/lib/prefs.ts`:

```ts
import { useCallback, useState } from 'react';

/** A yes/no preference of this browser (e.g. collapsed sidebar). Works without storage (private mode). */
export function useStoredFlag(key: string, initial = false): [boolean, (next: boolean) => void] {
    const [value, setValue] = useState<boolean>(() => {
        try {
            const stored = window.localStorage.getItem(key);
            return stored === null ? initial : stored === '1';
        } catch {
            return initial;
        }
    });

    const set = useCallback(
        (next: boolean) => {
            setValue(next);
            try {
                window.localStorage.setItem(key, next ? '1' : '0');
            } catch {
                // storage blocked: the choice lasts until the next page load
            }
        },
        [key],
    );

    return [value, set];
}
```

`resources/js/lib/hooks.ts` (Task 13 ergänzt `useLeaveGuard`):

```ts
import { useEffect, useState } from 'react';

/** The value, but only after it stopped changing for `delay` ms (search fields). */
export function useDebounced<T>(value: T, delay = 250): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return debounced;
}
```

`resources/js/layouts/logo.tsx`:

```tsx
/** Brand mark: a sheet with a folded corner and a check. */
export function LogoMark() {
    return (
        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-accent text-accent-ink">
            <svg viewBox="0 0 24 24" className="size-[1.1rem]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 3h8l4 4v14H6z" />
                <path d="M9.5 13.5l2 2 3.5-4" />
            </svg>
        </span>
    );
}
```

Run: `ddev exec pnpm test resources/js/layouts`
Expected: PASS.

- [ ] **Step 3: Dialog „Neues Dokument“**

`resources/js/components/new-document/new-document-dialog.tsx`:

```tsx
import { router } from '@inertiajs/react';
import { FileCheck2, FilePlus2, FileText, FileX2, type LucideIcon } from 'lucide-react';
import { useEffect, useState, type KeyboardEvent } from 'react';
import { useCustomer, useCustomerOptions } from '@/api/customers';
import { createDocument } from '@/api/documents';
import type { Customer, DocumentType } from '@/api/types';
import { Button, cx, Dialog, SearchInput, Skeleton } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useDebounced } from '@/lib/hooks';
import { path, t } from '@/lib/i18n';
import { toast } from '@/lib/toast';

export type NewDocumentOptions = { type?: DocumentType; customerId?: string };

const TYPES: { type: DocumentType; icon: LucideIcon }[] = [
    { type: 'offer', icon: FilePlus2 },
    { type: 'confirmation', icon: FileCheck2 },
    { type: 'invoice', icon: FileText },
    { type: 'cancellation', icon: FileX2 },
];

/** Cancellations come from an invoice (CreateDocument refuses them), so the card is only an explanation. */
const creatable = (type: DocumentType) => type !== 'cancellation';

export function NewDocumentDialog({ open, options, onClose }: { open: boolean; options: NewDocumentOptions; onClose(): void }) {
    const [type, setType] = useState<DocumentType>('offer');
    const [customerId, setCustomerId] = useState('');
    const [query, setQuery] = useState('');
    const [pending, setPending] = useState(false);
    const search = useDebounced(query, 250);
    const customers = useCustomerOptions(search, open);
    const selected = useCustomer(open && customerId ? customerId : null);

    useEffect(() => {
        if (!open) return;
        setType(options.type && creatable(options.type) ? options.type : 'offer');
        setCustomerId(options.customerId ?? '');
        setQuery('');
    }, [open, options.type, options.customerId]);

    // a preselected customer stays visible even when it is not among the first matches
    const results = customers.data?.items ?? [];
    const list: Customer[] = selected.data && !results.some((c) => c.id === selected.data?.id) ? [selected.data, ...results] : results;

    const moveType = (event: KeyboardEvent<HTMLDivElement>) => {
        if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(event.key)) return;
        event.preventDefault();
        const enabled = TYPES.filter((item) => creatable(item.type));
        const index = enabled.findIndex((item) => item.type === type);
        const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : enabled.length - 1;
        const next = enabled[(index + step) % enabled.length];
        setType(next.type);
        event.currentTarget.querySelector<HTMLElement>(`[data-type="${next.type}"]`)?.focus();
    };

    const submit = async () => {
        setPending(true);
        try {
            const document = await createDocument({ type, customer_id: customerId || null });
            toast.success(t('new_document.created', { type: t(`document_type.${type}`) }));
            onClose();
            router.visit(path(`/documents/${document.id}`));
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setPending(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            wide
            title={t('new_document.title')}
            description={t('new_document.description')}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>
                        {t('common.cancel')}
                    </Button>
                    <Button variant="primary" pending={pending} onClick={() => void submit()}>
                        {t('new_document.create', { type: t(`document_type.${type}`) })}
                    </Button>
                </>
            }
        >
            <div role="radiogroup" aria-label={t('new_document.type_label')} onKeyDown={moveType} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {TYPES.map(({ type: value, icon: Icon }) => (
                    <button
                        key={value}
                        type="button"
                        role="radio"
                        data-type={value}
                        aria-checked={type === value}
                        disabled={!creatable(value)}
                        title={creatable(value) ? undefined : t('new_document.cancellation_hint')}
                        tabIndex={type === value ? 0 : -1}
                        data-autofocus={type === value ? '' : undefined}
                        onClick={() => setType(value)}
                        className="group grid content-start justify-items-start gap-1 rounded-lg bg-surface-2 p-4 text-left text-ink transition-[background-color,box-shadow] hover:enabled:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-55 aria-checked:bg-accent-soft aria-checked:shadow-[inset_0_0_0_2px_var(--accent)] aria-checked:hover:bg-accent-soft"
                    >
                        <span className="mb-2 grid size-9 place-items-center rounded-md bg-surface text-muted group-aria-checked:bg-accent group-aria-checked:text-accent-ink [&_svg]:size-[1.1rem]">
                            <Icon aria-hidden />
                        </span>
                        <span className="font-heading">{t(`document_type.${value}`)}</span>
                        <span className="text-xs leading-snug text-muted">{t(`new_document.${value}_text`)}</span>
                    </button>
                ))}
            </div>

            <div className="grid gap-1.5">
                <span id="new-document-customer" className="text-sm font-medium text-muted">
                    {t('new_document.customer')}
                </span>
                <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('new_document.search')} aria-label={t('new_document.search')} />
                <div role="listbox" aria-labelledby="new-document-customer" className="grid max-h-60 gap-0.5 overflow-auto p-0.5">
                    {customers.error ? (
                        <p className="p-3 text-sm text-muted">
                            {t('new_document.load_failed')}{' '}
                            <button type="button" className="font-strong text-accent" onClick={() => void customers.mutate()}>
                                {t('common.retry')}
                            </button>
                        </p>
                    ) : customers.isLoading ? (
                        Array.from({ length: 3 }, (_, i) => <Skeleton key={i} h={40} r={12} />)
                    ) : (
                        <>
                            <CustomerOption selected={customerId === ''} onSelect={() => setCustomerId('')} name={t('new_document.later')} />
                            {list.map((customer) => (
                                <CustomerOption
                                    key={customer.id}
                                    selected={customerId === customer.id}
                                    onSelect={() => setCustomerId(customer.id)}
                                    name={customer.name}
                                    meta={[customer.number, customer.city].filter(Boolean).join(' · ')}
                                />
                            ))}
                            {list.length === 0 && search.trim() !== '' && <p className="p-3 text-sm text-muted">{t('new_document.no_match', { q: search.trim() })}</p>}
                        </>
                    )}
                </div>
            </div>
        </Dialog>
    );
}

function CustomerOption({ selected, onSelect, name, meta }: { selected: boolean; onSelect(): void; name: string; meta?: string }) {
    return (
        <button
            type="button"
            role="option"
            aria-selected={selected}
            onClick={onSelect}
            className={cx('flex w-full items-baseline gap-3 rounded-md px-3 py-[9px] text-left text-ink transition-colors hover:bg-surface-2 aria-selected:bg-accent-soft aria-selected:text-accent')}
        >
            <span className="min-w-0 truncate font-strong">{name}</span>
            {meta && <span className="ml-auto text-xs whitespace-nowrap text-muted">{meta}</span>}
        </button>
    );
}
```

`resources/js/components/new-document/new-document-context.tsx`:

```tsx
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { NewDocumentDialog, type NewDocumentOptions } from './new-document-dialog';

const NewDocumentContext = createContext<(options?: NewDocumentOptions) => void>(() => undefined);

/** One "new document" dialog for the whole app (shell button, key N, overview, customer page). */
export function NewDocumentProvider({ children }: { children: ReactNode }) {
    const [options, setOptions] = useState<NewDocumentOptions | null>(null);
    const open = useCallback((next: NewDocumentOptions = {}) => setOptions(next), []);

    return (
        <NewDocumentContext value={open}>
            {children}
            <NewDocumentDialog open={options !== null} options={options ?? {}} onClose={() => setOptions(null)} />
        </NewDocumentContext>
    );
}

export function useNewDocument(): (options?: NewDocumentOptions) => void {
    return useContext(NewDocumentContext);
}
```

- [ ] **Step 4: Benutzermenü (`resources/js/layouts/user-menu.tsx`)**

```tsx
import { router, usePage } from '@inertiajs/react';
import { Languages, LogOut, Monitor, Moon, Sun } from 'lucide-react';
import { Avatar, cx, Menu, MenuItem, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuSeparator } from '@/components/ui';
import { localeHref, path, t } from '@/lib/i18n';
import { isThemePref, setThemePref, useThemePref } from '@/lib/theme';
import type { SharedProps } from '@/types';

/** Account chip at the bottom of the sidebar; the menu opens upwards. */
export function UserMenu({ collapsed }: { collapsed: boolean }) {
    const { auth, org, locale } = usePage<SharedProps>().props;
    const theme = useThemePref();
    const name = auth.user?.name ?? '';

    return (
        <Menu
            side="top"
            align="start"
            className="w-60"
            trigger={
                <button
                    type="button"
                    aria-label={t('user_menu.open')}
                    title={collapsed ? name : undefined}
                    className="flex w-full min-w-0 items-center gap-2 rounded-full p-2 text-left transition-colors hover:bg-surface-2 data-[state=open]:bg-surface-2 md:group-data-collapsed/shell:justify-center"
                >
                    <Avatar name={name} size="sm" />
                    <span className={cx('grid min-w-0', 'md:group-data-collapsed/shell:hidden')}>
                        <span className="truncate text-sm font-strong">{name}</span>
                        <span className="truncate text-xs text-muted">{org?.name ?? ''}</span>
                    </span>
                </button>
            }
        >
            <MenuLabel>{t('user_menu.appearance')}</MenuLabel>
            <MenuRadioGroup value={theme} onValueChange={(value) => isThemePref(value) && setThemePref(value)}>
                <MenuRadioItem value="system" icon={<Monitor />}>
                    {t('user_menu.theme_system')}
                </MenuRadioItem>
                <MenuRadioItem value="light" icon={<Sun />}>
                    {t('user_menu.theme_light')}
                </MenuRadioItem>
                <MenuRadioItem value="dark" icon={<Moon />}>
                    {t('user_menu.theme_dark')}
                </MenuRadioItem>
            </MenuRadioGroup>
            <MenuSeparator />
            <MenuLabel>{t('user_menu.language')}</MenuLabel>
            {/* other language = full page load (translations are loaded once per page) */}
            <MenuRadioGroup value={locale} onValueChange={(value) => value !== locale && window.location.assign(localeHref(value))}>
                <MenuRadioItem value="en" icon={<Languages />}>
                    {t('locale.en')}
                </MenuRadioItem>
                <MenuRadioItem value="de" icon={<Languages />}>
                    {t('locale.de')}
                </MenuRadioItem>
            </MenuRadioGroup>
            <MenuSeparator />
            <MenuItem icon={<LogOut />} onSelect={() => router.post(path('/logout'))}>
                {t('common.logout')}
            </MenuItem>
        </Menu>
    );
}
```

- [ ] **Step 5: Shell (`resources/js/layouts/app-shell.tsx`)**

```tsx
import { Link, router, usePage } from '@inertiajs/react';
import { Menu as MenuIcon, PanelLeftClose, PanelLeftOpen, Plus } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { NewDocumentProvider, useNewDocument } from '@/components/new-document/new-document-context';
import { Button, cx, Toaster } from '@/components/ui';
import { path, t } from '@/lib/i18n';
import { useStoredFlag } from '@/lib/prefs';
import { LogoMark } from './logo';
import { isActive, navItems, setupItems, type NavItem } from './nav';
import { UserMenu } from './user-menu';

/** Hidden while the sidebar is collapsed (desktop only: the mobile drawer is always full width). */
const HIDE_COLLAPSED = 'md:group-data-collapsed/shell:hidden';

const NAV_LINK =
    'flex h-10 items-center gap-3 rounded-full px-3 font-strong whitespace-nowrap text-muted no-underline transition-colors hover:bg-surface-2 hover:text-ink [&_svg]:size-[1.125rem] [&_svg]:shrink-0 md:group-data-collapsed/shell:justify-center md:group-data-collapsed/shell:px-0';

/** Persistent Inertia layout: `Page.layout = appLayout` keeps the shell mounted across visits. */
export function appLayout(page: ReactNode): ReactNode {
    return <AppShell>{page}</AppShell>;
}

export function AppShell({ children }: { children: ReactNode }) {
    return (
        <NewDocumentProvider>
            <Shell>{children}</Shell>
            <Toaster />
        </NewDocumentProvider>
    );
}

function Shell({ children }: { children: ReactNode }) {
    const { url } = usePage();
    const [collapsed, setCollapsed] = useStoredFlag('openbill:sidebar-collapsed');
    const [mobileOpen, setMobileOpen] = useState(false);
    const openNewDocument = useNewDocument();
    const setup = setupItems();

    useEffect(() => router.on('navigate', () => setMobileOpen(false)), []);

    // "N" opens "New document" everywhere, unless the user types somewhere or a dialog/menu is open
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key.toLowerCase() !== 'n' || event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
            const target = event.target as HTMLElement | null;
            if (target?.closest('input, textarea, select, [contenteditable="true"], .cm-editor, [role="dialog"], [role="menu"]')) return;
            if (document.querySelector('[role="dialog"], [role="menu"]')) return;
            event.preventDefault();
            openNewDocument();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [openNewDocument]);

    useEffect(() => {
        if (!mobileOpen) return;
        const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setMobileOpen(false);
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [mobileOpen]);

    return (
        <div data-collapsed={collapsed || undefined} className={cx('group/shell grid min-h-dvh grid-cols-1', collapsed ? 'md:grid-cols-[4.5rem_minmax(0,1fr)]' : 'md:grid-cols-[15rem_minmax(0,1fr)]')}>
            <a href="#main" className="sr-only rounded-full bg-accent px-4 py-2 text-accent-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50">
                {t('shell.skip')}
            </a>

            <aside
                aria-label={t('shell.sidebar')}
                className={cx(
                    'flex-col gap-1 px-3 py-5',
                    mobileOpen ? 'fixed inset-y-0 left-0 z-[45] flex w-68 overflow-y-auto bg-bg shadow-float' : 'hidden',
                    'md:sticky md:top-0 md:z-auto md:flex md:h-dvh md:w-auto md:bg-transparent md:shadow-none',
                )}
            >
                <Link href={path('')} className="flex items-center gap-2.5 px-2 pb-5 text-xl font-bold tracking-brand text-ink no-underline md:group-data-collapsed/shell:justify-center md:group-data-collapsed/shell:px-0">
                    <LogoMark />
                    <span className={HIDE_COLLAPSED}>openbill</span>
                </Link>

                {/* own classes instead of <Button>: it is left-aligned and changes shape when collapsed */}
                <button
                    type="button"
                    onClick={() => openNewDocument()}
                    title={t('shell.new_document_hint')}
                    aria-label={t('shell.new_document')}
                    className="mb-4 flex h-control items-center gap-2 rounded-full bg-accent pr-4 pl-3 font-strong whitespace-nowrap text-accent-ink transition-[background-color,transform] hover:bg-accent-hover active:scale-[0.98] [&_svg]:size-4 [&_svg]:shrink-0 md:group-data-collapsed/shell:mx-auto md:group-data-collapsed/shell:w-10 md:group-data-collapsed/shell:justify-center md:group-data-collapsed/shell:px-0"
                >
                    <Plus aria-hidden />
                    <span className={HIDE_COLLAPSED}>{t('shell.new_document')}</span>
                </button>

                <nav aria-label={t('nav.main')} className="grid gap-0.5">
                    {navItems().map((item) => (
                        <NavLink key={item.href} item={item} active={isActive(url, item)} collapsed={collapsed} />
                    ))}
                    {setup.length > 0 && (
                        <>
                            <div className="h-4" />
                            <div className={cx('px-3 pt-2 pb-1 text-xs font-medium text-faint', HIDE_COLLAPSED)}>{t('nav.setup')}</div>
                            {setup.map((item) => (
                                <NavLink key={item.href} item={item} active={isActive(url, item)} collapsed={collapsed} />
                            ))}
                        </>
                    )}
                </nav>

                <div className="mt-auto grid gap-1">
                    <UserMenu collapsed={collapsed} />
                    <button
                        type="button"
                        onClick={() => setCollapsed(!collapsed)}
                        aria-label={collapsed ? t('shell.expand') : undefined}
                        title={collapsed ? t('shell.expand') : undefined}
                        className={cx(NAV_LINK, 'hidden md:flex')}
                    >
                        {collapsed ? <PanelLeftOpen aria-hidden /> : <PanelLeftClose aria-hidden />}
                        <span className={HIDE_COLLAPSED}>{t('shell.collapse')}</span>
                    </button>
                </div>
            </aside>
            {mobileOpen && <div aria-hidden className="fixed inset-0 z-[44] animate-overlay-in bg-overlay md:hidden" onClick={() => setMobileOpen(false)} />}

            <div className="min-w-0 md:py-3 md:pr-3">
                <div className="sticky top-0 z-30 flex h-14 items-center gap-2 bg-bg px-3 md:hidden">
                    <Button variant="ghost" iconOnly icon={<MenuIcon />} onClick={() => setMobileOpen(true)}>
                        {t('shell.open_navigation')}
                    </Button>
                    <Link href={path('')} className="flex items-center gap-2.5 text-lg font-bold tracking-brand text-ink no-underline">
                        <LogoMark />
                        <span>openbill</span>
                    </Link>
                    <Button variant="primary" size="sm" icon={<Plus />} onClick={() => openNewDocument()} className="ml-auto">
                        {t('shell.new_short')}
                    </Button>
                </div>
                <main id="main" className="min-h-[calc(100dvh-3.5rem)] overflow-clip bg-surface md:min-h-[calc(100dvh-1.5rem)] md:rounded-xl">
                    {children}
                </main>
            </div>
        </div>
    );
}

function NavLink({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
    const Icon = item.icon;
    return (
        <Link
            href={item.href}
            aria-current={active ? 'page' : undefined}
            aria-label={collapsed ? item.label : undefined}
            title={collapsed ? item.label : undefined}
            className={cx(NAV_LINK, 'aria-[current=page]:bg-accent-soft aria-[current=page]:text-accent')}
        >
            <Icon aria-hidden />
            <span className={HIDE_COLLAPSED}>{item.label}</span>
        </Link>
    );
}
```

`resources/js/pages/home.tsx` vorübergehend (wird in Task 10 gelöscht) – ganze Datei:

```tsx
import { Head, usePage } from '@inertiajs/react';
import { Page, PageHeader } from '@/components/ui';
import { appLayout } from '@/layouts/app-shell';
import { t } from '@/lib/i18n';
import type { SharedProps } from '@/types';

export default function Home() {
    const { auth } = usePage<SharedProps>().props;

    return (
        <Page>
            <Head title={t('home.title')} />
            <PageHeader title={t('home.title')} description={t('home.signed_in_as', { name: auth.user?.name ?? '' })} />
        </Page>
    );
}

Home.layout = appLayout;
```

- [ ] **Step 6: Texte**

`lang/en.json`:

```json
    "nav.customers": "Customers",
    "nav.documents": "Documents",
    "nav.main": "Main navigation",
    "nav.overview": "Overview",
    "nav.setup": "Set up",
    "new_document.cancellation_hint": "Open the invoice and choose “Cancel” there.",
    "new_document.cancellation_text": "Always created from an invoice.",
    "new_document.confirmation_text": "Confirm an order in writing.",
    "new_document.create": "Create :type",
    "new_document.created": ":type created",
    "new_document.customer": "Customer",
    "new_document.description": "Choose the type and the customer. Everything else can be added in the editor.",
    "new_document.invoice_text": "Bill services you delivered, as an e-invoice if you like.",
    "new_document.later": "Choose later",
    "new_document.load_failed": "Customers could not be loaded.",
    "new_document.no_match": "No customer matches “:q”.",
    "new_document.offer_text": "Propose services and prices. Can be converted later.",
    "new_document.search": "Search customers",
    "new_document.title": "New document",
    "new_document.type_label": "Type of document",
    "shell.collapse": "Collapse",
    "shell.expand": "Expand sidebar",
    "shell.new_document": "New document",
    "shell.new_document_hint": "New document (N)",
    "shell.new_short": "New",
    "shell.open_navigation": "Open navigation",
    "shell.sidebar": "Sidebar",
    "shell.skip": "Skip to content",
    "user_menu.appearance": "Appearance",
    "user_menu.language": "Language",
    "user_menu.open": "Account menu",
    "user_menu.theme_dark": "Dark",
    "user_menu.theme_light": "Light",
    "user_menu.theme_system": "Like the system",
```

`lang/de.json`:

```json
    "nav.customers": "Kunden",
    "nav.documents": "Dokumente",
    "nav.main": "Hauptnavigation",
    "nav.overview": "Übersicht",
    "nav.setup": "Einrichten",
    "new_document.cancellation_hint": "Öffne die Rechnung und wähle dort „Stornieren“.",
    "new_document.cancellation_text": "Entsteht immer aus einer Rechnung.",
    "new_document.confirmation_text": "Einen Auftrag schriftlich bestätigen.",
    "new_document.create": ":type anlegen",
    "new_document.created": ":type angelegt",
    "new_document.customer": "Kunde",
    "new_document.description": "Wähle die Art und den Kunden. Alles andere kannst du im Editor ergänzen.",
    "new_document.invoice_text": "Erbrachte Leistungen berechnen, auf Wunsch als E-Rechnung.",
    "new_document.later": "Später wählen",
    "new_document.load_failed": "Kunden konnten nicht geladen werden.",
    "new_document.no_match": "Kein Kunde passt zu „:q“.",
    "new_document.offer_text": "Leistungen und Preise vorschlagen. Lässt sich später umwandeln.",
    "new_document.search": "Kunden suchen",
    "new_document.title": "Neues Dokument",
    "new_document.type_label": "Art des Dokuments",
    "shell.collapse": "Einklappen",
    "shell.expand": "Seitenleiste ausklappen",
    "shell.new_document": "Neues Dokument",
    "shell.new_document_hint": "Neues Dokument (N)",
    "shell.new_short": "Neu",
    "shell.open_navigation": "Navigation öffnen",
    "shell.sidebar": "Seitenleiste",
    "shell.skip": "Zum Inhalt springen",
    "user_menu.appearance": "Darstellung",
    "user_menu.language": "Sprache",
    "user_menu.open": "Kontomenü",
    "user_menu.theme_dark": "Dunkel",
    "user_menu.theme_light": "Hell",
    "user_menu.theme_system": "Wie das System",
```

- [ ] **Step 7: Prüfen – automatisch und im Browser**

Run: `ddev exec pnpm test && ddev exec pnpm typecheck && ddev exec pnpm build && ddev artisan test --filter='TranslationsTest|LocaleTest'`
Expected: alles grün.

Dann `ddev exec pnpm dev` (im Hintergrund) und `https://openbill.ddev.site/en` nach dem Login öffnen. Prüfen und Abweichungen sofort beheben:
1. Sidebar wie im Klickdummy (Marke, „New document“, aktive Pille in Kobalt), Einklappen → 72 px breite Leiste nur mit Icons, nach Neuladen weiter eingeklappt.
2. Fenster < 900 px: Topbar mit Menü-Button; Drawer öffnet, Escape und Klick auf den Hintergrund schließen ihn.
3. Benutzermenü öffnet nach oben; „Dark“ schaltet sofort und bleibt nach Neuladen ohne Aufblitzen; „Deutsch“ lädt `/de`; „Log out“ landet auf `/en/login`.
4. Taste N öffnet „New document“ (nicht in einem Eingabefeld); Kundensuche filtert; „Create quote“ legt einen Entwurf an und navigiert zu `/en/documents/<id>` (404 bis Task 11 – erwartbar).

Abschließend `ddev exec pkill -f vite || true; rm -f public/hot` (siehe Fallstricke in `CLAUDE.md`).

- [ ] **Step 8: Commit**

```bash
git add resources/js/layouts resources/js/components/new-document resources/js/lib/prefs.ts resources/js/lib/hooks.ts resources/js/pages/home.tsx lang/en.json lang/de.json
git commit -m "feat: app shell with collapsible sidebar, user menu and new document dialog" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Übersicht (Kennzahlen, Aufmerksamkeit, zuletzt bearbeitet)

Port von `prototypes/clickdummy-v2/src/routes/dashboard/DashboardPage.{tsx,css}`. Alle Zahlen kommen fertig aus `App\Support\Overview` (Task 8); die Seite rechnet nichts.

**Files:**
- Create: `app/Http/Controllers/OverviewController.php`
- Delete: `app/Http/Controllers/HomeController.php`, `resources/js/pages/home.tsx`
- Modify: `routes/web.php`
- Create: `resources/js/pages/overview.tsx`
- Test: `tests/Feature/Pages/OverviewPageTest.php`; Modify: `tests/Feature/LocaleTest.php` (Komponente `home` → `overview`)
- Modify: `lang/en.json`, `lang/de.json` (neue Schlüssel, `home.*` entfernen)

**Interfaces:**
- Consumes: `Overview::build(CarbonImmutable $today)` (Task 8), `useNewDocument` (Task 9), Komponenten (Task 6/7), `formatMoney`, `formatDate`, `formatLongDate`, `monthName`, `relativeDays`, `todayIso` (Task 3).
- Produces: Inertia-Komponente `overview` mit Prop `overview: OverviewData` (exportierte TS-Typen `OverviewData`, `OverviewDocument` in `resources/js/pages/overview.tsx`); Routenname `home` bleibt (`LoginController`, `bootstrap/app.php`).

- [ ] **Step 1: Failing test schreiben**

`tests/Feature/Pages/OverviewPageTest.php`:

```php
<?php

use App\Models\Document;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(fn () => $this->travelTo('2026-10-11 10:00:00'));

it('renders the overview with the figures as strings', function () {
    Document::factory()->finalized()->create(['gross_total' => '119.00', 'due_date' => '2026-10-08']);

    $this->actingAs(User::factory()->create())->get('/en')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('overview')
            ->where('overview.figures.open', ['gross' => '119.00', 'count' => 1])
            ->where('overview.figures.overdue.count', 1)
            ->where('overview.attention.0.reason', 'overdue')
            ->where('overview.attention_count', 1)
            ->has('overview.recent', 1));
});

it('renders an empty overview on a fresh installation', function () {
    $this->actingAs(User::factory()->create())->get('/de')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('overview')
            ->where('overview.figures.paid_year.gross', '0.00')
            ->where('overview.attention', [])
            ->where('overview.recent', []));
});

it('sends guests to the login', function () {
    $this->get('/en')->assertRedirect('/en/login');
});
```

In `tests/Feature/LocaleTest.php` im Test „shows the start page with the signed-in user but without secrets“ `->component('home')` durch `->component('overview')` ersetzen.

Run: `ddev artisan test --filter='OverviewPageTest|LocaleTest'`
Expected: FAIL – Komponente `home` statt `overview`, Prop `overview` fehlt.

- [ ] **Step 2: Controller und Route**

`app/Http/Controllers/OverviewController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Support\Overview;
use Carbon\CarbonImmutable;
use Inertia\Inertia;
use Inertia\Response;

/** Start page after login: figures, what needs attention, recently edited documents. */
class OverviewController extends Controller
{
    public function __invoke(): Response
    {
        return Inertia::render('overview', ['overview' => Overview::build(CarbonImmutable::today())]);
    }
}
```

`routes/web.php`: `use App\Http\Controllers\HomeController;` → `use App\Http\Controllers\OverviewController;` und

```php
        Route::get('/', OverviewController::class)->name('home');
```

`git rm app/Http/Controllers/HomeController.php resources/js/pages/home.tsx`.

- [ ] **Step 3: Seite `resources/js/pages/overview.tsx`**

```tsx
import { Head, Link, usePage } from '@inertiajs/react';
import { AlarmClock, ArrowUpRight, CircleCheck, FilePen, FilePlus2, FileText, Hourglass, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { DocumentStatus, DocumentType } from '@/api/types';
import { useNewDocument } from '@/components/new-document/new-document-context';
import { Badge, Button, Card, CardHead, cx, EmptyState, Page, StatusBadge } from '@/components/ui';
import { appLayout } from '@/layouts/app-shell';
import { formatDate, formatLongDate, formatMoney, monthName, relativeDays, todayIso } from '@/lib/format';
import { path, t, tn } from '@/lib/i18n';
import type { SharedProps } from '@/types';

type Figure = { gross: string; count: number };
type Reason = 'overdue' | 'offer_expired' | 'offer_expiring' | 'draft';

/** One row of App\Support\Overview. */
export type OverviewDocument = {
    id: string;
    type: DocumentType;
    status: DocumentStatus;
    number: string | null;
    customer_name: string | null;
    gross_total: string;
    is_overdue: boolean;
    reason: Reason | null;
    reason_date: string | null;
};

export type OverviewData = {
    figures: { open: Figure; overdue: Figure; offers: Figure; paid_month: Figure; paid_year: Figure };
    attention: OverviewDocument[];
    attention_count: number;
    recent: OverviewDocument[];
};

const ATTENTION: Record<Reason, { icon: LucideIcon; tone: string }> = {
    overdue: { icon: AlarmClock, tone: 'bg-bad-soft text-bad' },
    offer_expired: { icon: Hourglass, tone: 'bg-warn-soft text-warn' },
    offer_expiring: { icon: Hourglass, tone: 'bg-warn-soft text-warn' },
    draft: { icon: FilePen, tone: 'bg-surface-2 text-muted' },
};

const ROW = 'grid min-h-14 items-center gap-4 rounded-md px-3 py-2 text-inherit no-underline transition-colors hover:bg-surface';

function greeting(name: string, hour: number): string {
    if (hour < 11) return t('overview.greeting_morning', { name });
    if (hour < 18) return t('overview.greeting_day', { name });
    return t('overview.greeting_evening', { name });
}

function attentionText(document: OverviewDocument, today: string): string {
    const date = document.reason_date ?? today;
    switch (document.reason) {
        case 'overdue':
            return t('overview.due', { when: relativeDays(date, today) });
        case 'offer_expired':
            return t('overview.offer_expired');
        case 'offer_expiring':
            return t('overview.offer_valid', { date: formatDate(date), when: relativeDays(date, today) });
        default:
            return t('overview.draft_changed', { when: relativeDays(date, today) });
    }
}

export default function Overview({ overview }: { overview: OverviewData }) {
    const { auth } = usePage<SharedProps>().props;
    const openNewDocument = useNewDocument();
    const now = new Date();
    const today = todayIso(now);
    const firstName = (auth.user?.name ?? '').split(' ')[0];
    const { figures, attention, attention_count: attentionCount, recent } = overview;

    return (
        <Page className="gap-8">
            <Head title={t('nav.overview')} />
            <header className="flex flex-wrap items-end gap-4">
                <div className="grid min-w-0 gap-1">
                    <h1 className="text-2xl font-bold tracking-brand sm:text-3xl">{greeting(firstName, now.getHours())}</h1>
                    <p className="text-muted first-letter:uppercase">{formatLongDate(now)}</p>
                </div>
                <div className="ml-auto flex flex-wrap gap-3">
                    <Button icon={<FilePlus2 />} onClick={() => openNewDocument({ type: 'offer' })}>
                        {t('overview.new_offer')}
                    </Button>
                    <Button variant="primary" icon={<FileText />} onClick={() => openNewDocument({ type: 'invoice' })}>
                        {t('overview.new_invoice')}
                    </Button>
                </div>
            </header>

            <section aria-label={t('overview.figures')} className="grid gap-2 xs:grid-cols-2 lg:grid-cols-4">
                <FigureTile
                    label={t('overview.open_invoices')}
                    value={formatMoney(figures.open.gross)}
                    note={tn('overview.open_invoices_note', figures.open.count)}
                    href={path('/documents?type=invoice&status=open')}
                />
                <FigureTile
                    label={t('overview.overdue')}
                    value={formatMoney(figures.overdue.gross)}
                    bad={figures.overdue.count > 0}
                    note={figures.overdue.count > 0 ? tn('overview.overdue_note', figures.overdue.count) : t('overview.on_time')}
                    href={figures.overdue.count > 0 ? path('/documents?type=invoice&status=overdue') : undefined}
                />
                <FigureTile
                    label={t('overview.open_offers')}
                    value={formatMoney(figures.offers.gross)}
                    note={tn('overview.open_offers_note', figures.offers.count)}
                    href={path('/documents?type=offer&status=open')}
                />
                <FigureTile
                    label={t('overview.paid_month', { month: monthName(now) })}
                    value={formatMoney(figures.paid_month.gross)}
                    note={t('overview.paid_year', { amount: formatMoney(figures.paid_year.gross) })}
                    href={path('/documents?type=invoice&status=paid')}
                />
            </section>

            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                <Card tinted flush className="px-3 pt-5 pb-3" aria-labelledby="overview-attention">
                    <div className="px-2">
                        <CardHead titleId="overview-attention" title={t('overview.attention')} actions={attentionCount > 0 ? <Badge plain>{attentionCount}</Badge> : undefined} />
                    </div>
                    {attention.length === 0 ? (
                        <EmptyState icon={<CircleCheck />} title={t('overview.nothing_to_do')}>
                            {t('overview.nothing_to_do_text')}
                        </EmptyState>
                    ) : (
                        <div className="grid animate-fade-in">
                            {attention.map((document) => (
                                <AttentionRow key={document.id} document={document} today={today} />
                            ))}
                            {attentionCount > attention.length && <p className="px-3 pt-2 text-sm text-muted">{t('overview.attention_more', { count: attentionCount - attention.length })}</p>}
                        </div>
                    )}
                </Card>

                <Card tinted flush className="px-3 pt-5 pb-3" aria-labelledby="overview-recent">
                    <div className="px-2">
                        <CardHead
                            titleId="overview-recent"
                            title={t('overview.recent')}
                            actions={
                                <Link href={path('/documents')} className="inline-flex items-center gap-0.5 text-sm font-strong text-accent no-underline hover:underline [&_svg]:size-[0.9rem]">
                                    {t('overview.all_documents')}
                                    <ArrowUpRight aria-hidden />
                                </Link>
                            }
                        />
                    </div>
                    {recent.length === 0 ? (
                        <EmptyState
                            icon={<FileText />}
                            title={t('overview.no_documents')}
                            actions={
                                <Button variant="primary" onClick={() => openNewDocument({ type: 'offer' })}>
                                    {t('overview.first_offer')}
                                </Button>
                            }
                        >
                            {t('overview.no_documents_text')}
                        </EmptyState>
                    ) : (
                        <div className="grid animate-fade-in">
                            {recent.map((document) => (
                                <RecentRow key={document.id} document={document} />
                            ))}
                        </div>
                    )}
                </Card>
            </div>
        </Page>
    );
}

Overview.layout = appLayout;

function FigureTile({ label, value, note, href, bad = false }: { label: string; value: string; note: string; href?: string; bad?: boolean }) {
    const body: ReactNode = (
        <>
            <span className="text-sm font-medium text-muted">{label}</span>
            <span className={cx('num text-2xl font-heading tracking-[-0.03em]', bad && 'text-bad')}>{value}</span>
            <span className="text-xs text-muted">{note}</span>
        </>
    );
    const className = 'grid content-start gap-1 rounded-lg bg-surface-2 p-5 text-inherit no-underline transition-colors';

    return href ? (
        <Link href={href} className={cx(className, 'hover:bg-surface-3')}>
            {body}
        </Link>
    ) : (
        <div className={className}>{body}</div>
    );
}

function AttentionRow({ document, today }: { document: OverviewDocument; today: string }) {
    const { icon: Icon, tone } = ATTENTION[document.reason ?? 'draft'];
    return (
        <Link href={path(`/documents/${document.id}`)} className={cx(ROW, 'grid-cols-[2rem_minmax(0,1fr)_auto]')}>
            <span className={cx('grid size-8 place-items-center rounded-full [&_svg]:size-4', tone)}>
                <Icon aria-hidden />
            </span>
            <span className="grid min-w-0 gap-px">
                <span className="truncate font-strong">
                    {document.number ?? t(`document_type.${document.type}`)} · {document.customer_name ?? t('documents.no_customer')}
                </span>
                <span className="truncate text-sm text-muted">{attentionText(document, today)}</span>
            </span>
            <span className="num text-right font-semibold whitespace-nowrap">{formatMoney(document.gross_total)}</span>
        </Link>
    );
}

function RecentRow({ document }: { document: OverviewDocument }) {
    return (
        <Link href={path(`/documents/${document.id}`)} className={cx(ROW, 'grid-cols-[minmax(0,1fr)_auto] xs:grid-cols-[minmax(0,1fr)_auto_6.5rem]')}>
            <span className="grid min-w-0 gap-px">
                <span className="truncate font-strong">{document.customer_name ?? t('documents.no_customer')}</span>
                <span className="truncate text-sm text-muted">
                    {t(`document_type.${document.type}`)} {document.number ?? t('overview.draft_label')}
                </span>
            </span>
            <span className="hidden xs:block">
                <StatusBadge status={document.status} overdue={document.is_overdue} />
            </span>
            <span className="num text-right font-semibold whitespace-nowrap">{formatMoney(document.gross_total)}</span>
        </Link>
    );
}
```

- [ ] **Step 4: Texte**

`home.placeholder`, `home.signed_in_as`, `home.title` aus beiden Dateien entfernen. Neu in `lang/en.json`:

```json
    "documents.no_customer": "No customer",
    "overview.all_documents": "All documents",
    "overview.attention": "Needs your attention",
    "overview.attention_more": "and :count more",
    "overview.draft_changed": "Draft, last changed :when",
    "overview.draft_label": "(draft)",
    "overview.due": "Due :when",
    "overview.figures": "Key figures",
    "overview.first_offer": "Create the first quote",
    "overview.greeting_day": "Hello, :name",
    "overview.greeting_evening": "Good evening, :name",
    "overview.greeting_morning": "Good morning, :name",
    "overview.new_invoice": "New invoice",
    "overview.new_offer": "New quote",
    "overview.no_documents": "No documents yet",
    "overview.no_documents_text": "The documents you worked on last show up here.",
    "overview.nothing_to_do": "Nothing to do",
    "overview.nothing_to_do_text": "No overdue invoices, no expiring quotes, no open drafts.",
    "overview.offer_expired": "Quote expired",
    "overview.offer_valid": "Valid until :date, :when",
    "overview.on_time": "Everything on time",
    "overview.open_invoices": "Open invoices",
    "overview.open_invoices_note.one": ":count invoice is waiting for payment",
    "overview.open_invoices_note.other": ":count invoices are waiting for payment",
    "overview.open_offers": "Open quotes",
    "overview.open_offers_note.one": ":count quote is waiting for an answer",
    "overview.open_offers_note.other": ":count quotes are waiting for an answer",
    "overview.overdue": "Of which overdue",
    "overview.overdue_note.one": ":count invoice past its due date",
    "overview.overdue_note.other": ":count invoices past their due date",
    "overview.paid_month": "Paid in :month",
    "overview.paid_year": ":amount since the start of the year",
    "overview.recent": "Recently edited",
```

`lang/de.json`:

```json
    "documents.no_customer": "Ohne Kunde",
    "overview.all_documents": "Alle Dokumente",
    "overview.attention": "Braucht deine Aufmerksamkeit",
    "overview.attention_more": "und :count weitere",
    "overview.draft_changed": "Entwurf, zuletzt geändert :when",
    "overview.draft_label": "(Entwurf)",
    "overview.due": "Fällig :when",
    "overview.figures": "Kennzahlen",
    "overview.first_offer": "Erstes Angebot anlegen",
    "overview.greeting_day": "Hallo, :name",
    "overview.greeting_evening": "Guten Abend, :name",
    "overview.greeting_morning": "Guten Morgen, :name",
    "overview.new_invoice": "Neue Rechnung",
    "overview.new_offer": "Neues Angebot",
    "overview.no_documents": "Noch keine Dokumente",
    "overview.no_documents_text": "Hier erscheinen die Dokumente, an denen du zuletzt gearbeitet hast.",
    "overview.nothing_to_do": "Nichts zu tun",
    "overview.nothing_to_do_text": "Keine überfälligen Rechnungen, keine ablaufenden Angebote, keine offenen Entwürfe.",
    "overview.offer_expired": "Angebot abgelaufen",
    "overview.offer_valid": "Gültig bis :date, :when",
    "overview.on_time": "Alles im Zeitplan",
    "overview.open_invoices": "Offene Rechnungen",
    "overview.open_invoices_note.one": ":count Rechnung wartet auf Zahlung",
    "overview.open_invoices_note.other": ":count Rechnungen warten auf Zahlung",
    "overview.open_offers": "Offene Angebote",
    "overview.open_offers_note.one": ":count Angebot wartet auf Antwort",
    "overview.open_offers_note.other": ":count Angebote warten auf Antwort",
    "overview.overdue": "Davon überfällig",
    "overview.overdue_note.one": ":count Rechnung über der Frist",
    "overview.overdue_note.other": ":count Rechnungen über der Frist",
    "overview.paid_month": "Bezahlt im :month",
    "overview.paid_year": ":amount seit Jahresbeginn",
    "overview.recent": "Zuletzt bearbeitet",
```

- [ ] **Step 5: Tests laufen lassen, sie sind grün**

Run: `ddev exec vendor/bin/pint && ddev artisan test --filter='OverviewPageTest|LocaleTest|AuthTest|ShellPropsTest|TranslationsTest' && ddev exec pnpm typecheck && ddev exec pnpm build`
Expected: PASS, keine TS-Fehler.

- [ ] **Step 6: Im Browser prüfen**

`ddev artisan db:seed --class=DemoSeeder`, dann `https://openbill.ddev.site/en` und `/de` öffnen: vier Kennzahl-Kacheln mit Euro-Beträgen (Demo-Daten), „Braucht deine Aufmerksamkeit“ mit farbigen Icons und relativen Zeiten („vor 3 Tagen“), „Zuletzt bearbeitet“ mit Status-Badges; Klick auf „Offene Rechnungen“ führt zu `/de/documents?type=invoice&status=open` (404 bis Task 11). Bei 390 px Breite: Kacheln einspaltig, Spalten untereinander.

- [ ] **Step 7: Commit**

```bash
git add -A app/Http/Controllers routes/web.php resources/js/pages tests/Feature/Pages/OverviewPageTest.php tests/Feature/LocaleTest.php lang/en.json lang/de.json
git commit -m "feat: overview page with figures, attention list and recent documents" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Dokumentliste (Filter in der URL, Gruppierung nach Monat) und Dokument-Platzhalter

Port von `prototypes/clickdummy-v2/src/routes/documents/DocumentListPage.{tsx,css}`. Filter stehen in der URL (`?type=&status=&customer_id=&q=`), der Server normalisiert sie (`DocumentQuery::lenient`) und liefert Zähler je Typ und die Summe; die Zeilen lädt SWR seitenweise aus `/api/documents`.

**Files:**
- Create: `app/Http/Controllers/DocumentController.php`
- Modify: `routes/web.php`
- Create: `resources/js/pages/documents/index.tsx`, `resources/js/pages/documents/show.tsx`
- Test: `tests/Feature/Pages/DocumentPagesTest.php`
- Modify: `lang/en.json`, `lang/de.json`

**Interfaces:**
- Consumes: `DocumentQuery::lenient|counts|summary` (Task 8), `useDocumentList`, `useDocument` (Task 5), `useNewDocument` (Task 9), `groupByMonth`, `formatMonth`, `formatDate`, `formatMoney` (Task 3), `useDebounced` (Task 9).
- Produces: Route `documents.index` `GET /{locale}/documents`, Route `documents.show` `GET /{locale}/documents/{id}` (`whereUlid`, 404 für unbekannte IDs); Inertia `documents/index` `{ filters: {type, status, customer_id, q}, counts: {all, offer, confirmation, invoice, cancellation}, summary: {count, gross_total}, customers: [{id, name}] }`, `documents/show` `{ document_id }`.

- [ ] **Step 1: Failing test schreiben**

`tests/Feature/Pages/DocumentPagesTest.php`:

```php
<?php

use App\Enums\DocumentType;
use App\Models\Customer;
use App\Models\Document;
use App\Models\User;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(fn () => $this->travelTo('2026-10-11 10:00:00'));

it('renders the list with normalized filters, counts per type and the sum', function () {
    $fjord = Customer::factory()->create(['name' => 'Fjord Analytics AB']);
    Document::factory()->finalized()->create(['customer_id' => $fjord->id, 'gross_total' => '119.00', 'due_date' => '2026-10-01']);
    Document::factory()->finalized()->create(['customer_id' => $fjord->id, 'gross_total' => '10.00', 'due_date' => '2026-10-30']);
    Document::factory()->type(DocumentType::Offer)->create(['customer_id' => $fjord->id, 'gross_total' => '50.00']);

    $this->actingAs(User::factory()->create())
        ->get("/en/documents?type=invoice&customer_id={$fjord->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('documents/index')
            ->where('filters', ['type' => 'invoice', 'status' => null, 'customer_id' => $fjord->id, 'q' => null])
            ->where('counts', ['all' => 3, 'offer' => 1, 'confirmation' => 0, 'invoice' => 2, 'cancellation' => 0])
            ->where('summary', ['count' => 2, 'gross_total' => '129.00'])
            ->where('customers', [['id' => $fjord->id, 'name' => 'Fjord Analytics AB']]));
});

it('filters overdue invoices', function () {
    Document::factory()->finalized()->create(['due_date' => '2026-10-01']);
    Document::factory()->finalized()->create(['due_date' => '2026-10-30']);

    $this->actingAs(User::factory()->create())
        ->get('/de/documents?status=overdue')
        ->assertInertia(fn (Assert $page) => $page
            ->where('filters.status', 'overdue')
            ->where('counts.invoice', 1)
            ->where('summary.count', 1));
});

it('ignores invalid filters of a typed URL (review focus)', function () {
    Document::factory()->create();

    $this->actingAs(User::factory()->create())
        ->get('/en/documents?type=bogus&status[]=x&q=%20%20&customer_id='.str_repeat('x', 40))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('filters', ['type' => null, 'status' => null, 'customer_id' => null, 'q' => null])
            ->where('counts.all', 1)
            ->where('summary.count', 1));
});

it('renders the page of an existing document only', function () {
    $document = Document::factory()->create();
    $this->actingAs(User::factory()->create());

    $this->get("/en/documents/{$document->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('documents/show')->where('document_id', $document->id));
    $this->get('/en/documents/'.strtolower((string) Str::ulid()))->assertNotFound();
    $this->get('/en/documents/not-an-id')->assertNotFound();
});

it('sends guests to the login', function () {
    $this->get('/en/documents')->assertRedirect('/en/login');
});
```

Run: `ddev artisan test --filter=DocumentPagesTest`
Expected: FAIL – 404 für `/en/documents`.

- [ ] **Step 2: Controller und Routen**

`app/Http/Controllers/DocumentController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\Document;
use App\Support\DocumentQuery;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Inertia\Inertia;
use Inertia\Response;

class DocumentController extends Controller
{
    /** Filters from the URL; the rows come from GET /api/documents (SWR), counts and sum from here (exact, server-side). */
    public function index(Request $request): Response
    {
        $today = CarbonImmutable::today()->toDateString();
        $filters = DocumentQuery::lenient($request->query());

        return Inertia::render('documents/index', [
            'filters' => [
                'type' => $filters['type'] ?? null,
                'status' => $filters['status'] ?? null,
                'customer_id' => $filters['customer_id'] ?? null,
                'q' => $filters['q'] ?? null,
            ],
            // the type pills show what each type would give under the other filters
            'counts' => DocumentQuery::counts(Arr::except($filters, ['type']), $today),
            'summary' => DocumentQuery::summary($filters, $today),
            'customers' => Customer::query()->orderBy('name')->get(['id', 'name'])
                ->map(fn (Customer $customer): array => ['id' => $customer->id, 'name' => $customer->name])
                ->all(),
        ]);
    }

    /** Summary page of a document; phase 6 replaces it with the editor (same route and prop). */
    public function show(string $id): Response
    {
        return Inertia::render('documents/show', ['document_id' => Document::query()->findOrFail($id)->id]);
    }
}
```

`routes/web.php` in der `auth`-Gruppe (Import `use App\Http\Controllers\DocumentController;`):

```php
        Route::get('/documents', [DocumentController::class, 'index'])->name('documents.index');
        Route::get('/documents/{id}', [DocumentController::class, 'show'])->whereUlid('id')->name('documents.show');
```

- [ ] **Step 3: Seite `resources/js/pages/documents/index.tsx`**

```tsx
import { Head, Link, router } from '@inertiajs/react';
import { FileText, Plus, SearchX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useDocumentList } from '@/api/documents';
import type { DocumentFilters, DocumentStatus, DocumentSummary, DocumentType } from '@/api/types';
import { useNewDocument } from '@/components/new-document/new-document-context';
import { Button, Card, cx, EmptyState, ErrorState, ListSkeleton, Page, PageHeader, PillButton, SearchInput, SelectControl, StatusBadge } from '@/components/ui';
import { appLayout } from '@/layouts/app-shell';
import { formatDate, formatMoney, formatMonth, groupByMonth } from '@/lib/format';
import { useDebounced } from '@/lib/hooks';
import { path, t, tn } from '@/lib/i18n';

type Filters = { type: DocumentType | null; status: DocumentFilters['status']; customer_id: string | null; q: string | null };

type Props = {
    filters: Filters;
    counts: Record<'all' | DocumentType, number>;
    summary: { count: number; gross_total: string };
    customers: { id: string; name: string }[];
};

const TYPE_PILLS: { value: DocumentType | null; key: 'all' | DocumentType }[] = [
    { value: null, key: 'all' },
    { value: 'offer', key: 'offer' },
    { value: 'confirmation', key: 'confirmation' },
    { value: 'invoice', key: 'invoice' },
    { value: 'cancellation', key: 'cancellation' },
];

const STATUS_OPTIONS: (DocumentStatus | 'overdue')[] = ['draft', 'open', 'overdue', 'accepted', 'rejected', 'done', 'paid', 'cancelled', 'closed'];

/** Number · customer · date · due/valid until · status · amount; on phones two lines (customer/amount, number/status). */
const GRID = 'grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[8rem_minmax(0,1fr)_6.5rem_7.5rem_7rem] lg:grid-cols-[8.5rem_minmax(0,1fr)_5.5rem_6.5rem_7.5rem_7rem]';

const EMPTY: Filters = { type: null, status: null, customer_id: null, q: null };

export default function Documents({ filters, counts, summary, customers }: Props) {
    const openNewDocument = useNewDocument();
    const [query, setQuery] = useState(filters.q ?? '');
    const search = useDebounced(query, 300);
    const list = useDocumentList(filters);
    const groups = groupByMonth(list.items);
    const filtered = Boolean(filters.type || filters.status || filters.customer_id || filters.q);

    // the URL is the state: every change is an Inertia visit that also brings fresh counts and sum
    const visit = (next: Filters) => {
        const params = Object.fromEntries(Object.entries(next).filter(([, value]) => value));
        router.get(path('/documents'), params, { preserveState: true, preserveScroll: true, replace: true, only: ['filters', 'counts', 'summary'] });
    };
    const set = (patch: Partial<Filters>) => visit({ ...filters, ...patch });
    const reset = () => {
        setQuery('');
        visit(EMPTY);
    };
    const newDocument = () =>
        openNewDocument({ type: filters.type && filters.type !== 'cancellation' ? filters.type : undefined, customerId: filters.customer_id ?? undefined });

    // the search goes into the URL once typing pauses
    useEffect(() => {
        const q = search.trim() || null;
        if (q !== filters.q) set({ q });
    }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

    // back/forward in the browser changes the URL: the field follows. Compared with the debounced text, so an
    // answer to an older search never overwrites what is being typed right now.
    useEffect(() => {
        if ((filters.q ?? '') !== search.trim()) setQuery(filters.q ?? '');
    }, [filters.q]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <Page>
            <Head title={t('nav.documents')} />
            <PageHeader
                title={t('nav.documents')}
                description={t('documents.description')}
                actions={
                    <Button variant="primary" icon={<Plus />} onClick={newDocument}>
                        {t('shell.new_document')}
                    </Button>
                }
            />

            <div className="grid gap-3">
                <div role="group" aria-label={t('documents.filter_type')} className="flex flex-wrap gap-1">
                    {TYPE_PILLS.map((pill) => (
                        <PillButton key={pill.key} pressed={filters.type === pill.value} count={counts[pill.key]} onClick={() => set({ type: pill.value })}>
                            {t(`documents.type_${pill.key}`)}
                        </PillButton>
                    ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <SearchInput
                        className="max-w-[26rem] flex-[1_1_18rem]"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={t('documents.search')}
                        aria-label={t('documents.search_label')}
                    />
                    <SelectControl
                        className="flex-[1_1_10rem] sm:flex-[0_1_13rem]"
                        value={filters.status ?? ''}
                        onChange={(e) => set({ status: (e.target.value || null) as Filters['status'] })}
                        aria-label={t('documents.filter_status')}
                    >
                        <option value="">{t('documents.any_status')}</option>
                        {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                                {t(`status.${status}`)}
                            </option>
                        ))}
                    </SelectControl>
                    <SelectControl
                        className="flex-[1_1_10rem] sm:flex-[0_1_13rem]"
                        value={filters.customer_id ?? ''}
                        onChange={(e) => set({ customer_id: e.target.value || null })}
                        aria-label={t('documents.filter_customer')}
                    >
                        <option value="">{t('documents.all_customers')}</option>
                        {customers.map((customer) => (
                            <option key={customer.id} value={customer.id}>
                                {customer.name}
                            </option>
                        ))}
                    </SelectControl>
                    {filtered && (
                        <Button variant="ghost" size="sm" onClick={reset}>
                            {t('documents.reset')}
                        </Button>
                    )}
                </div>
            </div>

            <Card tinted flush className="p-2" aria-busy={list.isLoading || list.isLoadingMore}>
                {list.error ? (
                    <ErrorState error={list.error} onRetry={list.retry} />
                ) : list.isLoading ? (
                    <ListSkeleton rows={7} />
                ) : list.items.length === 0 ? (
                    filtered ? (
                        <EmptyState icon={<SearchX />} title={t('documents.none_found')} actions={<Button onClick={reset}>{t('documents.reset')}</Button>}>
                            {t('documents.none_found_text')}
                        </EmptyState>
                    ) : (
                        <EmptyState
                            icon={<FileText />}
                            title={t('documents.empty')}
                            actions={
                                <Button variant="primary" icon={<Plus />} onClick={newDocument}>
                                    {t('documents.first')}
                                </Button>
                            }
                        >
                            {t('documents.empty_text')}
                        </EmptyState>
                    )
                ) : (
                    <div className="animate-fade-in">
                        <div aria-hidden className={cx('hidden gap-4 px-5 py-2 text-xs font-medium text-muted sm:grid', GRID)}>
                            <span>{t('documents.col_number')}</span>
                            <span>{t('documents.col_customer')}</span>
                            <span className="hidden lg:block">{t('documents.col_date')}</span>
                            <span>{t('documents.col_deadline')}</span>
                            <span>{t('documents.col_status')}</span>
                            <span className="text-right">{t('documents.col_amount')}</span>
                        </div>
                        {groups.map((group) => (
                            <section key={group.key} aria-label={formatMonth(group.key)}>
                                <h2 className="px-5 pt-4 pb-1 text-sm font-semibold tracking-[-0.01em] text-muted">{formatMonth(group.key)}</h2>
                                <div className="grid">
                                    {group.items.map((document) => (
                                        <DocumentRow key={document.id} document={document} />
                                    ))}
                                </div>
                            </section>
                        ))}
                        {list.hasMore && (
                            <div className="flex justify-center pt-3">
                                <Button size="sm" pending={list.isLoadingMore} onClick={list.loadMore}>
                                    {t('documents.load_more')}
                                </Button>
                            </div>
                        )}
                        <div className="flex justify-between gap-4 px-5 pt-4 pb-3 text-sm text-muted">
                            <span>{tn('documents.count', summary.count)}</span>
                            <span className="num">{t('documents.sum', { amount: formatMoney(summary.gross_total) })}</span>
                        </div>
                    </div>
                )}
            </Card>
        </Page>
    );
}

Documents.layout = appLayout;

function DocumentRow({ document }: { document: DocumentSummary }) {
    const deadline = document.type === 'invoice' ? document.due_date : document.type === 'offer' ? document.valid_until : null;

    return (
        <Link
            href={path(`/documents/${document.id}`)}
            className={cx('grid min-h-14 items-center gap-x-4 gap-y-1 rounded-md px-4 py-3 text-inherit no-underline transition-colors hover:bg-surface-2 sm:gap-4 sm:px-5', GRID)}
        >
            <span className="col-start-1 row-start-2 flex min-w-0 items-baseline gap-2 sm:col-auto sm:row-auto sm:grid sm:gap-px">
                <span className={document.number ? 'num font-semibold' : 'font-semibold text-muted italic'}>{document.number ?? t('documents.draft')}</span>
                <span className="truncate text-sm text-muted">{t(`document_type.${document.type}`)}</span>
            </span>
            <span className="col-start-1 row-start-1 min-w-0 truncate font-strong sm:col-auto sm:row-auto">{document.customer_name ?? t('documents.no_customer')}</span>
            <span className="num hidden text-sm text-muted lg:block">{formatDate(document.date)}</span>
            <span className={cx('num hidden text-sm sm:block', document.is_overdue ? 'font-semibold text-bad' : 'text-muted')}>{deadline ? formatDate(deadline) : '–'}</span>
            <span className="col-start-2 row-start-2 justify-self-end sm:col-auto sm:row-auto sm:justify-self-start">
                <StatusBadge status={document.status} overdue={document.is_overdue} />
            </span>
            <span className="num col-start-2 row-start-1 text-right font-semibold sm:col-auto sm:row-auto">{formatMoney(document.gross_total)}</span>
        </Link>
    );
}
```

Hinweis: Der Kommentar `// eslint-disable-line …` ist nur Doku (es gibt kein ESLint im Projekt); er erklärt, warum `filters` und `set` absichtlich nicht in den Abhängigkeiten stehen.

- [ ] **Step 4: Seite `resources/js/pages/documents/show.tsx`**

```tsx
import { Head } from '@inertiajs/react';
import { FileDown, Info } from 'lucide-react';
import { useDocument } from '@/api/documents';
import { BackLink, buttonClass, Card, ErrorState, Notice, Page, Skeleton, StatusBadge } from '@/components/ui';
import { appLayout } from '@/layouts/app-shell';
import { formatDate, formatMoney } from '@/lib/format';
import { path, t } from '@/lib/i18n';

/** Read-only summary of a document. Phase 6 replaces this page with the editor (same route, same prop). */
export default function DocumentPage({ document_id: id }: { document_id: string }) {
    const { data: document, error, mutate } = useDocument(id);
    const title = document ? `${t(`document_type.${document.type}`)} ${document.number ?? t('overview.draft_label')}` : t('nav.documents');

    return (
        <Page>
            <Head title={title} />
            <BackLink href={path('/documents')}>{t('document_page.back')}</BackLink>
            {error ? (
                <ErrorState error={error} onRetry={() => void mutate()} />
            ) : !document ? (
                <div className="grid gap-4" aria-busy="true" aria-label={t('common.loading')}>
                    <Skeleton w="40%" h={34} />
                    <Skeleton h={120} r={18} />
                </div>
            ) : (
                <>
                    <header className="flex flex-wrap items-end gap-4">
                        <div className="grid min-w-0 gap-1">
                            <h1 className="text-2xl font-bold tracking-title sm:text-3xl">{title}</h1>
                            <p className="text-muted">{document.customer_name ?? t('documents.no_customer')}</p>
                        </div>
                        <div className="ml-auto flex items-center gap-3">
                            <StatusBadge status={document.status} overdue={document.is_overdue} />
                            {/* same-origin link: the browser sends the session cookie and the Referer Sanctum needs */}
                            <a className={buttonClass({ variant: 'primary' })} href={`/api/documents/${document.id}/pdf?inline=1`} target="_blank" rel="noopener">
                                <FileDown aria-hidden />
                                {t('document_page.pdf')}
                            </a>
                        </div>
                    </header>
                    <Card tinted>
                        <dl className="grid gap-4 sm:grid-cols-3">
                            <Fact label={t('documents.col_date')} value={formatDate(document.date)} />
                            <Fact label={t('documents.col_deadline')} value={formatDate(document.type === 'offer' ? document.valid_until : document.due_date) || '–'} />
                            <Fact label={t('documents.col_amount')} value={formatMoney(document.gross_total)} />
                        </dl>
                    </Card>
                    <Notice icon={<Info />}>{t('document_page.read_only_hint')}</Notice>
                </>
            )}
        </Page>
    );
}

DocumentPage.layout = appLayout;

function Fact({ label, value }: { label: string; value: string }) {
    return (
        <div className="grid gap-1">
            <dt className="text-sm font-medium text-muted">{label}</dt>
            <dd className="num text-lg font-heading">{value}</dd>
        </div>
    );
}
```

- [ ] **Step 5: Texte**

`lang/en.json`:

```json
    "document_page.back": "All documents",
    "document_page.pdf": "PDF",
    "document_page.read_only_hint": "Documents cannot be edited in the app yet. Use the PDF or the REST API.",
    "documents.all_customers": "All customers",
    "documents.any_status": "Any status",
    "documents.col_amount": "Amount",
    "documents.col_customer": "Customer",
    "documents.col_date": "Date",
    "documents.col_deadline": "Due / valid until",
    "documents.col_number": "Number",
    "documents.col_status": "Status",
    "documents.count.one": ":count document",
    "documents.count.other": ":count documents",
    "documents.description": "Quotes, order confirmations, invoices and cancellations in one place.",
    "documents.draft": "Draft",
    "documents.empty": "No documents yet",
    "documents.empty_text": "Create a quote or an invoice. openbill assigns numbers when finalizing.",
    "documents.filter_customer": "Filter by customer",
    "documents.filter_status": "Filter by status",
    "documents.filter_type": "Filter by type",
    "documents.first": "Create the first document",
    "documents.load_more": "Load more",
    "documents.none_found": "No documents found",
    "documents.none_found_text": "No document matches these filters. Loosen the search or reset the filters.",
    "documents.reset": "Reset filters",
    "documents.search": "Number or customer",
    "documents.search_label": "Search documents",
    "documents.sum": "Total :amount",
    "documents.type_all": "All",
    "documents.type_cancellation": "Cancellations",
    "documents.type_confirmation": "Order confirmations",
    "documents.type_invoice": "Invoices",
    "documents.type_offer": "Quotes",
```

`lang/de.json`:

```json
    "document_page.back": "Alle Dokumente",
    "document_page.pdf": "PDF",
    "document_page.read_only_hint": "Dokumente lassen sich in der App noch nicht bearbeiten. Nutze das PDF oder die REST-API.",
    "documents.all_customers": "Alle Kunden",
    "documents.any_status": "Jeder Status",
    "documents.col_amount": "Betrag",
    "documents.col_customer": "Kunde",
    "documents.col_date": "Datum",
    "documents.col_deadline": "Fällig / gültig bis",
    "documents.col_number": "Nummer",
    "documents.col_status": "Status",
    "documents.count.one": ":count Dokument",
    "documents.count.other": ":count Dokumente",
    "documents.description": "Angebote, Auftragsbestätigungen, Rechnungen und Stornos an einem Ort.",
    "documents.draft": "Entwurf",
    "documents.empty": "Noch keine Dokumente",
    "documents.empty_text": "Leg ein Angebot oder eine Rechnung an. Nummern vergibt openbill beim Abschließen.",
    "documents.filter_customer": "Nach Kunde filtern",
    "documents.filter_status": "Nach Status filtern",
    "documents.filter_type": "Nach Art filtern",
    "documents.first": "Erstes Dokument anlegen",
    "documents.load_more": "Mehr laden",
    "documents.none_found": "Keine Dokumente gefunden",
    "documents.none_found_text": "Zu diesen Filtern passt kein Dokument. Lockere die Suche oder setze die Filter zurück.",
    "documents.reset": "Filter zurücksetzen",
    "documents.search": "Nummer oder Kunde",
    "documents.search_label": "Dokumente durchsuchen",
    "documents.sum": "Summe :amount",
    "documents.type_all": "Alle",
    "documents.type_cancellation": "Stornos",
    "documents.type_confirmation": "Auftragsbestätigungen",
    "documents.type_invoice": "Rechnungen",
    "documents.type_offer": "Angebote",
```

- [ ] **Step 6: Tests und Typen**

Run: `ddev exec vendor/bin/pint && ddev artisan test --filter='DocumentPagesTest|TranslationsTest' && ddev exec pnpm typecheck && ddev exec pnpm build`
Expected: PASS, keine TS-Fehler.

- [ ] **Step 7: Im Browser prüfen**

Mit Demo-Daten `https://openbill.ddev.site/de/documents`: Pillen zeigen Zähler, Klick auf „Rechnungen“ setzt `?type=invoice` und die Zähler der anderen Pillen bleiben; Status „Überfällig“ zeigt nur überfällige Rechnungen in Rot; Suche „Fjord“ aktualisiert die URL nach der Pause; Zurück im Browser stellt den vorigen Filter her; Monatsüberschriften („Oktober 2026“); Fußzeile „n Dokumente · Summe …“. Mehr als 50 Dokumente: `ddev artisan tinker --execute='App\Models\Document::factory()->count(60)->create();'` → „Mehr laden“ erscheint und lädt die nächste Seite (danach `ddev artisan db:seed --class=DemoSeeder` für saubere Demo-Daten). Klick auf ein Dokument → Platzhalterseite; „PDF“ öffnet das PDF in einem neuen Tab (Entwurf mit Wasserzeichen; Gotenberg muss laufen).

- [ ] **Step 8: Commit**

```bash
git add app/Http/Controllers/DocumentController.php routes/web.php resources/js/pages/documents tests/Feature/Pages/DocumentPagesTest.php lang/en.json lang/de.json
git commit -m "feat: document list with URL filters, month groups and document summary page" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Kundenliste und Kunden-Helfer

Port von `prototypes/clickdummy-v2/src/routes/customers/CustomerListPage.tsx`, `labels.ts` und `customers.css` (Liste). Dazu die reinen Funktionen für das Kundenformular (Entwurf ↔ API, Ansprechpartner), die Task 13 benutzt – hier per TDD.

**Files:**
- Create: `resources/js/lib/customers.ts`, `resources/js/lib/customers.test.ts`
- Create: `app/Http/Controllers/CustomerController.php`
- Modify: `routes/web.php`
- Create: `resources/js/pages/customers/index.tsx`
- Test: `tests/Feature/Pages/CustomerPagesTest.php`
- Modify: `lang/en.json`, `lang/de.json`

**Interfaces:**
- Consumes: `Overview::openByCustomer()` (Task 8), `useCustomerList` (Task 5), Komponenten, `countryName`, `formatMoney` (Task 3), `useDebounced` (Task 9).
- Produces: `resources/js/lib/customers.ts`: `TAX_TREATMENTS`, `COUNTRIES`, `taxTag(treatment)`, `defaultContact(contacts)`, `contactName(contact, withSalutation?)`, `type ContactDraft`, `type CustomerDraft`, `emptyCustomer()`, `draftOf(customer)`, `inputOf(draft)`, `newContact(contacts)`, `applyContact(contacts, contact)`, `makeDefault(contacts, key)`, `removeContact(contacts, key)`, `contactErrors(errors, index)`. Route `customers.index`, Inertia `customers/index` `{ open_by_customer }`.

- [ ] **Step 1: Failing tests für die Helfer**

`resources/js/lib/customers.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Customer } from '@/api/types';
import { applyContact, contactErrors, contactName, defaultContact, draftOf, emptyCustomer, inputOf, makeDefault, newContact, removeContact, taxTag, type ContactDraft } from './customers';

const customer: Customer = {
    id: 'c1',
    number: 'K-1001',
    name: 'Hafenkontor Lindqvist GmbH',
    street: 'Am Sandtorkai 4',
    zip: '20457',
    city: 'Hamburg',
    country: 'DE',
    email: 'buchhaltung@hafenkontor.example',
    vat_id: 'DE987654321',
    tax_treatment: 'domestic',
    locale: null,
    custom: { industry: 'Handel' },
    contacts: [
        { id: 'p1', salutation: 'Frau', first_name: 'Mira', last_name: 'Albers', position: 'Leitung E-Commerce', email: 'mira.albers@hafenkontor.example', phone: '', is_default: true, custom: {} },
        { id: 'p2', salutation: 'Herr', first_name: 'Ole', last_name: 'Brandt', position: 'Einkauf', email: '', phone: '', is_default: false, custom: {} },
    ],
    created_at: null,
    updated_at: null,
};

const keys = (contacts: ContactDraft[]) => contacts.map((c) => `${c.key}${c.is_default ? '*' : ''}`);

describe('draft ↔ API', () => {
    it('keeps the ids of existing contacts and sends new ones without id', () => {
        const draft = draftOf(customer);
        const added = { ...newContact(draft.contacts), first_name: 'Lena', last_name: 'Sommer' };
        const input = inputOf({ ...draft, contacts: applyContact(draft.contacts, added) });

        expect(input.contacts.map((c) => c.id)).toEqual(['p1', 'p2', undefined]);
        expect('key' in input.contacts[2]).toBe(false);
        expect(input).not.toHaveProperty('id');
        expect(input.custom).toEqual({ industry: 'Handel' });
    });

    it('starts a new customer empty and domestic', () => {
        expect(emptyCustomer()).toMatchObject({ name: '', number: '', country: 'DE', tax_treatment: 'domestic', contacts: [] });
    });
});

describe('contacts', () => {
    it('makes the first new contact the default', () => {
        const first = newContact([]);
        expect(first.is_default).toBe(true);
        expect(newContact([first]).is_default).toBe(false);
    });

    it('keeps exactly one default', () => {
        const draft = draftOf(customer);
        const promoted = applyContact(draft.contacts, { ...draft.contacts[1], is_default: true });

        expect(keys(promoted)).toEqual(['p1', 'p2*']);
        expect(keys(makeDefault(promoted, 'p1'))).toEqual(['p1*', 'p2']);
        expect(keys(removeContact(draft.contacts, 'p1'))).toEqual(['p2*']);
        expect(removeContact(removeContact(draft.contacts, 'p1'), 'p2')).toEqual([]);
    });

    it('maps API errors of one contact to its fields', () => {
        const errors = { name: 'Name is required.', 'contacts.1.email': 'Invalid email.', 'contacts.1.custom.department': 'Too long.', 'contacts.10.email': 'Other contact.' };

        expect(contactErrors(errors, 1)).toEqual({ email: 'Invalid email.', 'custom.department': 'Too long.' });
        expect(contactErrors(errors, 0)).toEqual({});
    });

    it('names contacts and finds the default', () => {
        expect(contactName(customer.contacts[0])).toBe('Frau Mira Albers');
        expect(contactName(customer.contacts[0], false)).toBe('Mira Albers');
        expect(contactName({ salutation: '', first_name: ' ', last_name: '' })).toBe('');
        expect(defaultContact(customer.contacts)?.id).toBe('p1');
        expect(defaultContact([])).toBeNull();
    });
});

describe('taxTag', () => {
    it('tags only customers outside the domestic case', () => {
        expect(taxTag('domestic')).toBeNull();
        expect(taxTag('eu_reverse_charge')).toBe('tax_treatment.eu_reverse_charge_tag'); // no translations loaded in tests
    });
});
```

Run: `ddev exec pnpm test resources/js/lib/customers.test.ts`
Expected: FAIL – `Failed to resolve import "./customers"`.

- [ ] **Step 2: `resources/js/lib/customers.ts`**

```ts
import type { Contact, ContactInput, Customer, CustomerInput, TaxTreatment } from '@/api/types';
import { t } from '@/lib/i18n';

export const TAX_TREATMENTS: TaxTreatment[] = ['domestic', 'eu_reverse_charge', 'third_country'];

/** Country choices of the customer form; a stored country outside the list stays selectable. */
export const COUNTRIES = ['DE', 'AT', 'CH', 'NL', 'BE', 'FR', 'IT', 'ES', 'DK', 'SE', 'PL', 'CZ', 'GB', 'US'];

/** Short tag in lists; domestic customers get none. */
export function taxTag(treatment: TaxTreatment): string | null {
    if (treatment === 'eu_reverse_charge') return t('tax_treatment.eu_reverse_charge_tag');
    if (treatment === 'third_country') return t('tax_treatment.third_country_tag');
    return null;
}

export function defaultContact<T extends { is_default: boolean }>(contacts: T[]): T | null {
    return contacts.find((contact) => contact.is_default) ?? contacts[0] ?? null;
}

export function contactName(contact: Pick<Contact, 'salutation' | 'first_name' | 'last_name'>, withSalutation = true): string {
    return [withSalutation ? contact.salutation : '', contact.first_name, contact.last_name]
        .map((part) => part.trim())
        .filter(Boolean)
        .join(' ');
}

/** A contact in the form; `key` identifies it in lists and the drawer, also before it has an id. */
export type ContactDraft = ContactInput & { key: string };
export type CustomerDraft = Omit<CustomerInput, 'contacts'> & { contacts: ContactDraft[] };

export function emptyCustomer(): CustomerDraft {
    return { number: '', name: '', street: '', zip: '', city: '', country: 'DE', email: '', vat_id: '', tax_treatment: 'domestic', locale: null, custom: {}, contacts: [] };
}

export function draftOf(customer: Customer): CustomerDraft {
    return {
        number: customer.number,
        name: customer.name,
        street: customer.street,
        zip: customer.zip,
        city: customer.city,
        country: customer.country,
        email: customer.email,
        vat_id: customer.vat_id,
        tax_treatment: customer.tax_treatment,
        locale: customer.locale,
        custom: { ...customer.custom },
        contacts: customer.contacts.map((contact) => ({ ...contact, custom: { ...contact.custom }, key: contact.id })),
    };
}

/** What SaveCustomer gets: every field and the complete contact list in form order (errors come back as contacts.<index>.…). */
export function inputOf(draft: CustomerDraft): CustomerInput {
    return {
        number: draft.number,
        name: draft.name,
        street: draft.street,
        zip: draft.zip,
        city: draft.city,
        country: draft.country,
        email: draft.email,
        vat_id: draft.vat_id,
        tax_treatment: draft.tax_treatment,
        locale: draft.locale,
        custom: draft.custom,
        contacts: draft.contacts.map((contact) => ({
            ...(contact.id ? { id: contact.id } : {}),
            salutation: contact.salutation,
            first_name: contact.first_name,
            last_name: contact.last_name,
            position: contact.position,
            email: contact.email,
            phone: contact.phone,
            is_default: contact.is_default,
            custom: contact.custom,
        })),
    };
}

let sequence = 0;

export function newContact(contacts: ContactDraft[]): ContactDraft {
    sequence += 1;
    return { key: `new-${sequence}`, salutation: '', first_name: '', last_name: '', position: '', email: '', phone: '', is_default: contacts.length === 0, custom: {} };
}

/** Exactly one default as long as there are contacts (SaveCustomer enforces the same). */
function withOneDefault(contacts: ContactDraft[], preferred?: string): ContactDraft[] {
    if (contacts.length === 0) return contacts;
    const key = preferred ?? contacts.find((contact) => contact.is_default)?.key ?? contacts[0].key;
    return contacts.map((contact) => ({ ...contact, is_default: contact.key === key }));
}

/** Adds the contact or replaces the one with the same key. */
export function applyContact(contacts: ContactDraft[], contact: ContactDraft): ContactDraft[] {
    const exists = contacts.some((item) => item.key === contact.key);
    const next = exists ? contacts.map((item) => (item.key === contact.key ? contact : item)) : [...contacts, contact];
    return withOneDefault(next, contact.is_default ? contact.key : undefined);
}

export function makeDefault(contacts: ContactDraft[], key: string): ContactDraft[] {
    return withOneDefault(contacts, key);
}

export function removeContact(contacts: ContactDraft[], key: string): ContactDraft[] {
    return withOneDefault(contacts.filter((contact) => contact.key !== key));
}

/** Errors of contact <index> from the API paths "contacts.<index>.<field>", keyed by field ("email", "custom.department"). */
export function contactErrors(errors: Record<string, string>, index: number): Record<string, string> {
    const prefix = `contacts.${index}.`;
    return Object.fromEntries(
        Object.entries(errors)
            .filter(([path]) => path.startsWith(prefix))
            .map(([path, message]) => [path.slice(prefix.length), message]),
    );
}
```

Run: `ddev exec pnpm test resources/js/lib/customers.test.ts`
Expected: PASS.

- [ ] **Step 3: Failing Pest-Test für die Seite**

`tests/Feature/Pages/CustomerPagesTest.php`:

```php
<?php

use App\Models\Customer;
use App\Models\Document;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(fn () => $this->travelTo('2026-10-11 10:00:00'));

it('renders the customer list with the open amounts per customer', function () {
    $customer = Customer::factory()->create();
    Document::factory()->finalized()->create(['customer_id' => $customer->id, 'gross_total' => '119.00', 'due_date' => '2026-10-01']);

    $this->actingAs(User::factory()->create())->get('/en/customers')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('customers/index')
            ->where("open_by_customer.{$customer->id}", ['gross' => '119.00', 'count' => 1, 'overdue' => 1]));
});

it('renders an empty customer list on a fresh installation', function () {
    $this->actingAs(User::factory()->create())->get('/de/customers')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('customers/index')->where('open_by_customer', []));
});
```

Run: `ddev artisan test --filter=CustomerPagesTest`
Expected: FAIL – 404.

- [ ] **Step 4: Controller, Route, Seite**

`app/Http/Controllers/CustomerController.php` (Task 13 ergänzt `create` und `show`):

```php
<?php

namespace App\Http\Controllers;

use App\Support\Overview;
use Carbon\CarbonImmutable;
use Inertia\Inertia;
use Inertia\Response;

class CustomerController extends Controller
{
    /** Rows come from GET /api/customers (SWR); the open amounts per customer from here (exact sums). */
    public function index(): Response
    {
        // object: an empty map stays {} in JSON
        return Inertia::render('customers/index', ['open_by_customer' => (object) Overview::openByCustomer(CarbonImmutable::today())]);
    }
}
```

`routes/web.php` in der `auth`-Gruppe (Import `use App\Http\Controllers\CustomerController;`):

```php
        Route::get('/customers', [CustomerController::class, 'index'])->name('customers.index');
```

`resources/js/pages/customers/index.tsx`:

```tsx
import { Head, Link } from '@inertiajs/react';
import { Plus, Search, Users } from 'lucide-react';
import { useState } from 'react';
import { useCustomerList } from '@/api/customers';
import type { Customer } from '@/api/types';
import { Avatar, Badge, Button, ButtonLink, Card, cx, EmptyState, ErrorState, Page, PageHeader, SearchInput, Skeleton, Tag } from '@/components/ui';
import { appLayout } from '@/layouts/app-shell';
import { contactName, defaultContact, taxTag } from '@/lib/customers';
import { countryName, formatMoney } from '@/lib/format';
import { useDebounced } from '@/lib/hooks';
import { path, t, tn } from '@/lib/i18n';

type OpenSum = { gross: string; count: number; overdue: number };

/** Avatar · name · city · contact · open; below 900 px only avatar, name and open. */
const COLUMNS = 'grid-cols-[2.5rem_minmax(0,1fr)_auto] md:grid-cols-[2.5rem_minmax(0,2.2fr)_minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(7rem,auto)]';

export default function Customers({ open_by_customer: openByCustomer }: { open_by_customer: Record<string, OpenSum> }) {
    const [query, setQuery] = useState('');
    const search = useDebounced(query, 250);
    const list = useCustomerList(search);
    const newButton = (
        <ButtonLink href={path('/customers/new')} variant="primary" icon={<Plus />}>
            {t('customers.new')}
        </ButtonLink>
    );

    return (
        <Page>
            <Head title={t('nav.customers')} />
            <PageHeader title={t('nav.customers')} description={t('customers.description')} actions={newButton} />

            <div className="flex flex-wrap items-center gap-3">
                <SearchInput className="w-full max-w-[22rem]" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('customers.search')} aria-label={t('customers.search_label')} />
                {!list.isLoading && !list.error && <span className="text-sm text-muted">{tn('customers.count', list.total)}</span>}
            </div>

            <Card flush aria-busy={list.isLoading || list.isLoadingMore}>
                {list.error ? (
                    <ErrorState error={list.error} onRetry={list.retry} />
                ) : list.isLoading ? (
                    <ListLoading />
                ) : list.items.length === 0 ? (
                    search.trim() ? (
                        <EmptyState icon={<Search />} title={t('customers.none_found')}>
                            {t('customers.none_found_text', { q: search.trim() })}
                        </EmptyState>
                    ) : (
                        <EmptyState icon={<Users />} title={t('customers.empty')} actions={newButton}>
                            {t('customers.empty_text')}
                        </EmptyState>
                    )
                ) : (
                    <>
                        <div aria-hidden className={cx('hidden gap-4 px-6 pt-2 text-xs font-medium text-muted md:grid', COLUMNS)}>
                            <span />
                            <span>{t('customers.col_customer')}</span>
                            <span>{t('customers.col_city')}</span>
                            <span>{t('customers.col_contact')}</span>
                            <span className="text-right">{t('customers.col_open')}</span>
                        </div>
                        <div className="grid animate-fade-in gap-0.5 p-2">
                            {list.items.map((customer) => (
                                <CustomerRow key={customer.id} customer={customer} open={openByCustomer[customer.id]} />
                            ))}
                        </div>
                        {list.hasMore && (
                            <div className="flex justify-center pb-4">
                                <Button size="sm" pending={list.isLoadingMore} onClick={list.loadMore}>
                                    {t('documents.load_more')}
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </Card>
        </Page>
    );
}

Customers.layout = appLayout;

function CustomerRow({ customer, open }: { customer: Customer; open?: OpenSum }) {
    const contact = defaultContact(customer.contacts);
    const tag = taxTag(customer.tax_treatment);

    return (
        <Link href={path(`/customers/${customer.id}`)} className={cx('grid items-center gap-4 rounded-md px-4 py-3 text-inherit no-underline transition-colors hover:bg-surface-2', COLUMNS)}>
            <Avatar name={customer.name} tone="accent" />
            <span className="grid min-w-0 gap-0.5">
                <span className="flex min-w-0 items-center gap-2">
                    <strong className="truncate font-semibold">{customer.name}</strong>
                    {tag && <Tag neutral>{tag}</Tag>}
                </span>
                <span className="truncate text-sm text-muted">{customer.number}</span>
            </span>
            <span className="hidden min-w-0 gap-0.5 md:grid">
                <span className="truncate">{customer.city || t('customers.no_city')}</span>
                <span className="truncate text-sm text-muted">{countryName(customer.country)}</span>
            </span>
            <span className="hidden min-w-0 gap-0.5 md:grid">
                <span className="truncate">{contact ? contactName(contact, false) || t('contact.no_name') : t('customers.no_contact')}</span>
                <span className="truncate text-sm text-muted">{contact?.position || contact?.email || ' '}</span>
            </span>
            <span className="grid justify-items-end gap-0.5 text-right">
                {open ? (
                    <>
                        <strong className="num font-semibold">{formatMoney(open.gross)}</strong>
                        {open.overdue > 0 ? <Badge tone="bad">{t('customers.overdue', { count: open.overdue })}</Badge> : <span className="text-sm text-muted">{tn('customers.open_invoices', open.count)}</span>}
                    </>
                ) : (
                    <span className="text-sm text-muted">{t('customers.nothing_open')}</span>
                )}
            </span>
        </Link>
    );
}

function ListLoading() {
    return (
        <div className="grid gap-0.5 p-2" aria-busy="true" aria-label={t('common.loading')}>
            {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className={cx('grid items-center gap-4 px-4 py-3', COLUMNS)}>
                    <Skeleton w={40} h={40} r={999} />
                    <span className="grid gap-1.5">
                        <Skeleton w={`${50 + ((i * 13) % 30)}%`} h={14} />
                        <Skeleton w={56} h={11} />
                    </span>
                    <span className="hidden gap-1.5 md:grid">
                        <Skeleton w="60%" h={12} />
                        <Skeleton w="40%" h={11} />
                    </span>
                    <span className="hidden gap-1.5 md:grid">
                        <Skeleton w="70%" h={12} />
                        <Skeleton w="45%" h={11} />
                    </span>
                    <Skeleton w={80} h={14} className="justify-self-end" />
                </div>
            ))}
        </div>
    );
}
```

- [ ] **Step 5: Texte**

`lang/en.json`:

```json
    "contact.no_name": "No name",
    "customers.col_city": "City",
    "customers.col_contact": "Contact",
    "customers.col_customer": "Customer",
    "customers.col_open": "Open",
    "customers.count.one": ":count customer",
    "customers.count.other": ":count customers",
    "customers.description": "Master data, contacts and all documents per customer.",
    "customers.empty": "No customers yet",
    "customers.empty_text": "Create your first customer. Then you can write a quote or an invoice for them right away.",
    "customers.new": "New customer",
    "customers.no_city": "No city",
    "customers.no_contact": "No contact",
    "customers.none_found": "No customer found",
    "customers.none_found_text": "No name, number or email matches “:q”.",
    "customers.nothing_open": "Nothing open",
    "customers.open_invoices.one": ":count invoice",
    "customers.open_invoices.other": ":count invoices",
    "customers.overdue": ":count overdue",
    "customers.search": "Name, number or email",
    "customers.search_label": "Search customers",
    "tax_treatment.eu_reverse_charge_tag": "EU · reverse charge",
    "tax_treatment.third_country_tag": "Third country",
```

`lang/de.json`:

```json
    "contact.no_name": "Ohne Namen",
    "customers.col_city": "Ort",
    "customers.col_contact": "Ansprechpartner",
    "customers.col_customer": "Kunde",
    "customers.col_open": "Offen",
    "customers.count.one": ":count Kunde",
    "customers.count.other": ":count Kunden",
    "customers.description": "Stammdaten, Ansprechpartner und alle Dokumente pro Kunde.",
    "customers.empty": "Noch keine Kunden",
    "customers.empty_text": "Lege deinen ersten Kunden an. Danach kannst du direkt ein Angebot oder eine Rechnung für ihn schreiben.",
    "customers.new": "Kunde anlegen",
    "customers.no_city": "Ohne Ort",
    "customers.no_contact": "Kein Ansprechpartner",
    "customers.none_found": "Kein Kunde gefunden",
    "customers.none_found_text": "Zu „:q“ passt kein Name, keine Nummer und keine E-Mail.",
    "customers.nothing_open": "Nichts offen",
    "customers.open_invoices.one": ":count Rechnung",
    "customers.open_invoices.other": ":count Rechnungen",
    "customers.overdue": ":count überfällig",
    "customers.search": "Name, Nummer oder E-Mail",
    "customers.search_label": "Kunden durchsuchen",
    "tax_treatment.eu_reverse_charge_tag": "EU · Reverse Charge",
    "tax_treatment.third_country_tag": "Drittland",
```

- [ ] **Step 6: Prüfen und committen**

Run: `ddev exec vendor/bin/pint && ddev artisan test --filter='CustomerPagesTest|TranslationsTest' && ddev exec pnpm test && ddev exec pnpm typecheck && ddev exec pnpm build`
Expected: alles grün. Im Browser `/en/customers` mit Demo-Daten: vier Kunden, Fjord mit Tag „EU · reverse charge“, offene Beträge rechts, Suche „kontor“ findet Hafenkontor, Suche „zzz“ zeigt „No customer found“.

```bash
git add resources/js/lib/customers.ts resources/js/lib/customers.test.ts app/Http/Controllers/CustomerController.php routes/web.php resources/js/pages/customers/index.tsx tests/Feature/Pages/CustomerPagesTest.php lang/en.json lang/de.json
git commit -m "feat: customer list with open amounts and customer form helpers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Kunden-Detail (Stammdaten, Steuerbehandlung, eigene Felder, Ansprechpartner-Drawer, Dokumente)

Port von `prototypes/clickdummy-v2/src/routes/customers/{CustomerDetailPage,ContactDrawer,CustomerDocuments}.tsx`, `customers.css` (Detail) und `src/components/CustomFieldInput.tsx`. Gespeichert wird der ganze Kunde samt Ansprechpartnern mit **einem** `POST /api/customers` bzw. `PATCH /api/customers/{id}`; 422-Fehler landen über `violations[].path` am Feld.

**Files:**
- Modify: `app/Http/Controllers/CustomerController.php` (`create`, `show`), `routes/web.php`
- Modify: `resources/js/lib/hooks.ts` (neu: `useLeaveGuard`)
- Create: `resources/js/components/custom-field-input.tsx`
- Create: `resources/js/components/customers/contact-drawer.tsx`, `resources/js/components/customers/customer-documents.tsx`
- Create: `resources/js/pages/customers/show.tsx`
- Test: `tests/Feature/Pages/CustomerPagesTest.php` (erweitern)
- Modify: `lang/en.json`, `lang/de.json`

**Interfaces:**
- Consumes: `lib/customers.ts` (Task 12), `useCustomer`, `saveCustomer`, `deleteCustomer`, `useFieldDefinitions`, `useDocumentList` (Task 5), `ApiError`, `errorMessage` (Task 4), `useNewDocument` (Task 9), `toast` (Task 7), Komponenten (Task 6/7), `countryName`, `formatDate`, `formatMoney`, `toDecimalString` (Task 3).
- Produces: Routen `customers.create` `GET /{locale}/customers/new` und `customers.show` `GET /{locale}/customers/{id}` (`whereUlid`), Inertia `customers/show` `{ customer_id: string | null }`; `CustomFieldInput` (siehe „Interfaces“); `useLeaveGuard(active, message): () => void`.

- [ ] **Step 1: Failing Pest-Tests ergänzen**

An `tests/Feature/Pages/CustomerPagesTest.php` anhängen (Import `use Illuminate\Support\Str;` ergänzen):

```php
it('renders the page of a new customer', function () {
    $this->actingAs(User::factory()->create())->get('/en/customers/new')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('customers/show')->where('customer_id', null));
});

it('renders the page of an existing customer only', function () {
    $customer = Customer::factory()->create();
    $this->actingAs(User::factory()->create());

    $this->get("/de/customers/{$customer->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('customers/show')->where('customer_id', $customer->id));
    $this->get('/de/customers/'.strtolower((string) Str::ulid()))->assertNotFound();
});

it('does not show deleted customers', function () {
    $customer = Customer::factory()->create();
    $customer->delete();

    $this->actingAs(User::factory()->create())->get("/en/customers/{$customer->id}")->assertNotFound();
});
```

Run: `ddev artisan test --filter=CustomerPagesTest`
Expected: FAIL – 404 für `/en/customers/new`.

- [ ] **Step 2: Controller und Routen**

In `app/Http/Controllers/CustomerController.php` ergänzen (Import `use App\Models\Customer;`):

```php
    public function create(): Response
    {
        return Inertia::render('customers/show', ['customer_id' => null]);
    }

    /** The data comes from GET /api/customers/{id}; 404 here for unknown or deleted customers. */
    public function show(string $id): Response
    {
        return Inertia::render('customers/show', ['customer_id' => Customer::query()->findOrFail($id)->id]);
    }
```

`routes/web.php` (nach `customers.index`; `new` vor `{id}`):

```php
        Route::get('/customers/new', [CustomerController::class, 'create'])->name('customers.create');
        Route::get('/customers/{id}', [CustomerController::class, 'show'])->whereUlid('id')->name('customers.show');
```

- [ ] **Step 3: `useLeaveGuard` in `resources/js/lib/hooks.ts`**

Imports der Datei erweitern zu `import { router } from '@inertiajs/react';` und `import { useEffect, useRef, useState } from 'react';`, dann anhängen:

```ts
/**
 * Asks before the page is left while `active`: reload/close of the tab (browser dialog) and every Inertia
 * visit (sidebar, links, back link). The returned function switches the guard off for the own navigation
 * right after saving, before React has re-rendered with the clean state.
 */
export function useLeaveGuard(active: boolean, message: string): () => void {
    const activeRef = useRef(active);
    useEffect(() => {
        activeRef.current = active;
    }, [active]);

    useEffect(() => {
        const onBeforeUnload = (event: BeforeUnloadEvent) => {
            if (activeRef.current) event.preventDefault();
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        const off = router.on('before', (event) => {
            if (activeRef.current && !window.confirm(message)) event.preventDefault();
        });
        return () => {
            window.removeEventListener('beforeunload', onBeforeUnload);
            off();
        };
    }, [message]);

    return () => {
        activeRef.current = false;
    };
}
```

- [ ] **Step 4: `resources/js/components/custom-field-input.tsx`**

```tsx
import { useEffect, useState, type ReactNode } from 'react';
import type { CustomValue, FieldDefinition } from '@/api/types';
import { controlClass, cx, Field, SelectControl, Switch, Textarea, TextInput } from '@/components/ui';
import { toDecimalString } from '@/lib/format';
import { t } from '@/lib/i18n';

type Props = {
    definition: FieldDefinition;
    value: CustomValue | undefined;
    onChange(value: CustomValue): void;
    error?: string;
    disabled?: boolean;
    /** Without label and hint (position rows of the editor in phase 6); the label becomes aria-label. */
    compact?: boolean;
    path?: string;
};

/** Input for one custom field by its type. Numbers and amounts stay strings with a dot (the API refuses floats). */
export function CustomFieldInput({ definition, value, onChange, error, disabled = false, compact = false, path }: Props) {
    const label: ReactNode = compact ? undefined : (
        <>
            {definition.label}
            {definition.required && <span aria-hidden> *</span>}
        </>
    );
    const hint = compact ? undefined : definition.help || undefined;
    const text = value === null || value === undefined ? '' : String(value);
    const aria = compact ? definition.label : undefined;

    switch (definition.type) {
        case 'textarea':
            return <Textarea label={label} hint={hint} error={error} path={path} value={text} disabled={disabled} aria-label={aria} onChange={(e) => onChange(e.target.value)} />;
        case 'number':
        case 'money':
            return <DecimalInput label={label} hint={hint} error={error} path={path} value={text} disabled={disabled} aria={aria} money={definition.type === 'money'} onChange={onChange} />;
        case 'date':
            return <TextInput type="date" label={label} hint={hint} error={error} path={path} value={text} disabled={disabled} aria-label={aria} onChange={(e) => onChange(e.target.value || null)} />;
        case 'select':
            return (
                <Field label={label} hint={hint} error={error} path={path}>
                    {(id, describedBy) => (
                        <SelectControl id={id} aria-describedby={describedBy} aria-label={aria} invalid={!!error} value={text} disabled={disabled} onChange={(e) => onChange(e.target.value || null)}>
                            <option value="">{t('fields.no_selection')}</option>
                            {definition.options.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                            {/* a stored value whose option was removed later stays visible */}
                            {text !== '' && !definition.options.includes(text) && <option value={text}>{text}</option>}
                        </SelectControl>
                    )}
                </Field>
            );
        case 'boolean':
            return (
                <Field label={label} hint={hint} error={error} path={path}>
                    {() => (
                        <Switch className="h-control" checked={value === true} disabled={disabled} aria-label={definition.label} onChange={(e) => onChange(e.target.checked)} label={value === true ? t('fields.yes') : t('fields.no')} />
                    )}
                </Field>
            );
        case 'image':
            // no upload path for images yet (phase 7 brings asset uploads); the stored path stays as it is
            return <TextInput label={label} hint={compact ? undefined : t('fields.image_read_only')} error={error} path={path} value={text} disabled readOnly aria-label={aria} />;
        default:
            return <TextInput label={label} hint={hint} error={error} path={path} value={text} disabled={disabled} aria-label={aria} onChange={(e) => onChange(e.target.value)} />;
    }
}

type DecimalProps = { label?: ReactNode; hint?: ReactNode; error?: string; path?: string; value: string; disabled: boolean; aria?: string; money: boolean; onChange(value: CustomValue): void };

/** Typing keeps the raw text ("12,5"); leaving the field stores "12.5" (or null when empty). */
function DecimalInput({ label, hint, error, path, value, disabled, aria, money, onChange }: DecimalProps) {
    const [raw, setRaw] = useState(value);
    useEffect(() => setRaw(value), [value]);

    return (
        <Field label={label} hint={hint} error={error} path={path}>
            {(id, describedBy) => (
                <span className="relative flex items-center">
                    <input
                        id={id}
                        inputMode="decimal"
                        aria-label={aria}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={describedBy}
                        disabled={disabled}
                        value={raw}
                        onChange={(e) => setRaw(e.target.value)}
                        onBlur={() => onChange(toDecimalString(raw))}
                        onKeyDown={(e) => {
                            // Enter commits the number first instead of submitting the form with the old value
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                e.currentTarget.blur();
                            }
                        }}
                        className={controlClass(!!error, cx('num h-control text-right', money && 'pr-8'))}
                    />
                    {money && <span aria-hidden className="pointer-events-none absolute right-3 text-sm text-muted">€</span>}
                </span>
            )}
        </Field>
    );
}
```

- [ ] **Step 5: `resources/js/components/customers/contact-drawer.tsx`**

```tsx
import { useEffect, useState } from 'react';
import type { FieldDefinition } from '@/api/types';
import { CustomFieldInput } from '@/components/custom-field-input';
import { Button, Drawer, Select, Switch, TextInput } from '@/components/ui';
import type { ContactDraft } from '@/lib/customers';
import { t } from '@/lib/i18n';

type Props = {
    contact: ContactDraft | null;
    isNew: boolean;
    fields: FieldDefinition[];
    /** API errors of this contact, keyed by field ("email", "custom.department"). */
    errors: Record<string, string>;
    onClose(): void;
    onApply(contact: ContactDraft): void;
};

/** Edits a contact. The change lands in the customer draft and is saved together with the customer. */
export function ContactDrawer({ contact, isNew, fields, errors, onClose, onApply }: Props) {
    const [draft, setDraft] = useState<ContactDraft | null>(contact);
    const [touched, setTouched] = useState(false);
    useEffect(() => {
        setDraft(contact);
        setTouched(false);
    }, [contact]);

    if (!draft) return null;

    const set = (patch: Partial<ContactDraft>) => setDraft({ ...draft, ...patch });
    const nameMissing = !draft.first_name.trim() && !draft.last_name.trim();
    const salutations = ['', t('contact.salutation_ms'), t('contact.salutation_mr'), t('contact.salutation_mx')];
    const options = salutations.includes(draft.salutation) ? salutations : [...salutations, draft.salutation];

    return (
        <Drawer
            open
            onClose={onClose}
            title={isNew ? t('contact.add_title') : t('contact.edit_title')}
            description={t('contact.drawer_text')}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>
                        {t('common.cancel')}
                    </Button>
                    <Button
                        variant="primary"
                        onClick={() => {
                            setTouched(true);
                            if (!nameMissing) onApply(draft);
                        }}
                    >
                        {isNew ? t('contact.add') : t('contact.apply')}
                    </Button>
                </>
            }
        >
            <div className="grid gap-4 sm:grid-cols-2">
                <Select label={t('contact.salutation')} value={draft.salutation} error={errors.salutation} onChange={(e) => set({ salutation: e.target.value })}>
                    {options.map((salutation) => (
                        <option key={salutation} value={salutation}>
                            {salutation || t('contact.salutation_none')}
                        </option>
                    ))}
                </Select>
                <TextInput label={t('contact.position')} value={draft.position} placeholder={t('contact.position_placeholder')} error={errors.position} onChange={(e) => set({ position: e.target.value })} />
                <TextInput
                    label={t('contact.first_name')}
                    value={draft.first_name}
                    error={touched && nameMissing ? t('contact.name_required') : errors.first_name}
                    onChange={(e) => set({ first_name: e.target.value })}
                />
                <TextInput label={t('contact.last_name')} value={draft.last_name} error={errors.last_name} onChange={(e) => set({ last_name: e.target.value })} />
                <TextInput label={t('contact.email')} type="email" wrapClassName="sm:col-span-2" value={draft.email} error={errors.email} onChange={(e) => set({ email: e.target.value })} />
                <TextInput label={t('contact.phone')} type="tel" wrapClassName="sm:col-span-2" value={draft.phone} error={errors.phone} onChange={(e) => set({ phone: e.target.value })} />
            </div>
            <Switch label={t('contact.is_default')} checked={draft.is_default} onChange={(e) => set({ is_default: e.target.checked })} />
            {fields.length > 0 && (
                <div className="grid gap-4">
                    <h3 className="text-md">{t('contact.fields')}</h3>
                    {fields.map((field) => (
                        <CustomFieldInput
                            key={field.id}
                            definition={field}
                            value={draft.custom[field.key]}
                            error={errors[`custom.${field.key}`]}
                            onChange={(value) => set({ custom: { ...draft.custom, [field.key]: value } })}
                        />
                    ))}
                </div>
            )}
        </Drawer>
    );
}
```

- [ ] **Step 6: `resources/js/components/customers/customer-documents.tsx`**

```tsx
import { Link } from '@inertiajs/react';
import { FilePlus, FileText } from 'lucide-react';
import { useDocumentList } from '@/api/documents';
import { useNewDocument } from '@/components/new-document/new-document-context';
import { Button, Card, CardHead, EmptyState, ErrorState, Skeleton, StatusBadge } from '@/components/ui';
import { formatDate, formatMoney } from '@/lib/format';
import { path, t, tn } from '@/lib/i18n';

const SHOWN = 10;

/** Documents of a customer, newest first; "New" is off while the customer has unsaved changes. */
export function CustomerDocuments({ customerId, disabled = false }: { customerId: string; disabled?: boolean }) {
    const list = useDocumentList({ customer_id: customerId });
    const openNewDocument = useNewDocument();
    const create = (label: string, variant: 'soft' | 'primary') => (
        <Button size="sm" variant={variant} icon={<FilePlus />} disabled={disabled} title={disabled ? t('customer.save_first') : undefined} onClick={() => openNewDocument({ customerId })}>
            {label}
        </Button>
    );

    return (
        <Card aria-labelledby="customer-documents">
            <CardHead titleId="customer-documents" title={t('customer.documents')} description={list.total > 0 ? tn('documents.count', list.total) : undefined} actions={create(t('customer.documents_new'), 'soft')} />
            {list.error ? (
                <ErrorState error={list.error} onRetry={list.retry} />
            ) : list.isLoading ? (
                <div className="grid gap-2" aria-busy="true" aria-label={t('common.loading')}>
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="flex justify-between gap-4 p-3">
                            <Skeleton w="55%" h={13} />
                            <Skeleton w={70} h={13} />
                        </div>
                    ))}
                </div>
            ) : list.items.length === 0 ? (
                <EmptyState compact icon={<FileText />} title={t('customer.documents_empty')} actions={create(t('customer.documents_create'), 'primary')} />
            ) : (
                <div className="-mx-3 grid gap-0.5">
                    {list.items.slice(0, SHOWN).map((document) => (
                        <Link
                            key={document.id}
                            href={path(`/documents/${document.id}`)}
                            className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 rounded-md p-3 text-inherit no-underline transition-colors hover:bg-surface-2"
                        >
                            <span className="truncate font-semibold">
                                {t(`document_type.${document.type}`)} {document.number ?? t('overview.draft_label')}
                            </span>
                            <span className="num text-right font-semibold">{formatMoney(document.gross_total)}</span>
                            <span className="num truncate text-sm text-muted">{formatDate(document.date)}</span>
                            <span className="justify-self-end">
                                <StatusBadge status={document.status} overdue={document.is_overdue} />
                            </span>
                        </Link>
                    ))}
                    {list.total > SHOWN && (
                        <Link href={path(`/documents?customer_id=${customerId}`)} className="px-3 pt-2 text-sm font-strong text-accent no-underline hover:underline">
                            {t('overview.all_documents')}
                        </Link>
                    )}
                </div>
            )}
        </Card>
    );
}
```

- [ ] **Step 7: Seite `resources/js/pages/customers/show.tsx`**

```tsx
import { Head, router } from '@inertiajs/react';
import { AlertTriangle, FilePlus, MoreHorizontal, Pencil, Plus, Star, Trash2, UserRound } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { deleteCustomer, saveCustomer, useCustomer } from '@/api/customers';
import { useFieldDefinitions } from '@/api/fields';
import type { TaxTreatment } from '@/api/types';
import { ContactDrawer } from '@/components/customers/contact-drawer';
import { CustomerDocuments } from '@/components/customers/customer-documents';
import { CustomFieldInput } from '@/components/custom-field-input';
import { useNewDocument } from '@/components/new-document/new-document-context';
import { Avatar, BackLink, Badge, Button, Card, CardHead, ConfirmDialog, ErrorState, Menu, MenuItem, MenuSeparator, Notice, Page, Select, Skeleton, Tag, TextInput } from '@/components/ui';
import { appLayout } from '@/layouts/app-shell';
import { ApiError, errorMessage } from '@/lib/api';
import {
    applyContact,
    contactErrors,
    contactName,
    COUNTRIES,
    draftOf,
    emptyCustomer,
    inputOf,
    makeDefault,
    newContact,
    removeContact,
    TAX_TREATMENTS,
    type ContactDraft,
    type CustomerDraft,
} from '@/lib/customers';
import { countryName } from '@/lib/format';
import { useLeaveGuard } from '@/lib/hooks';
import { path, t } from '@/lib/i18n';
import { toast } from '@/lib/toast';

export default function CustomerPage({ customer_id: id }: { customer_id: string | null }) {
    // a fresh editor per customer, so a draft never wanders to another customer
    return id === null ? <CustomerEditor key="new" id={null} initial={emptyCustomer()} /> : <ExistingCustomer key={id} id={id} />;
}

CustomerPage.layout = appLayout;

function ExistingCustomer({ id }: { id: string }) {
    const { data, error, mutate } = useCustomer(id);

    if (error) {
        return (
            <Page>
                <BackLink href={path('/customers')}>{t('customer.all')}</BackLink>
                <ErrorState error={error} title={t('customer.load_failed')} onRetry={() => void mutate()} />
            </Page>
        );
    }
    if (!data) return <DetailSkeleton />;
    return <CustomerEditor id={id} initial={draftOf(data)} />;
}

/** Focus the first field marked invalid (after React rendered the errors). */
const focusFirstInvalid = () => requestAnimationFrame(() => document.querySelector<HTMLElement>('main [aria-invalid="true"]')?.focus());

function CustomerEditor({ id, initial }: { id: string | null; initial: CustomerDraft }) {
    const isNew = id === null;
    const customerFields = useFieldDefinitions('customer');
    const contactFields = useFieldDefinitions('contact');
    const openNewDocument = useNewDocument();
    const [base, setBase] = useState(initial);
    const [draft, setDraft] = useState(initial);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [triedSave, setTriedSave] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState<{ contact: ContactDraft; isNew: boolean } | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(base), [draft, base]);
    const release = useLeaveGuard(dirty, t('customer.leave_confirm'));

    const set = (patch: Partial<CustomerDraft>) => setDraft((current) => ({ ...current, ...patch }));
    const nameError = errors.name ?? (triedSave && !draft.name.trim() ? t('customer.name_required') : undefined);
    const vatMissing = draft.tax_treatment === 'eu_reverse_charge' && !draft.vat_id.trim();
    const title = draft.name.trim() || (isNew ? t('customer.new_title') : t('customer.no_name'));
    const editingIndex = editing ? draft.contacts.findIndex((contact) => contact.key === editing.contact.key) : -1;

    const submit = async (event?: FormEvent) => {
        event?.preventDefault();
        setTriedSave(true);
        if (!draft.name.trim()) {
            focusFirstInvalid();
            return;
        }
        setSaving(true);
        try {
            const saved = await saveCustomer(inputOf(draft), id ?? undefined);
            const next = draftOf(saved);
            setBase(next);
            setDraft(next);
            setErrors({});
            setTriedSave(false);
            toast.success(isNew ? t('customer.created') : t('customer.saved'));
            if (isNew) {
                release();
                router.visit(path(`/customers/${saved.id}`), { replace: true });
            }
        } catch (error) {
            if (error instanceof ApiError && error.status === 422) {
                setErrors(error.fieldErrors());
                toast.error(t('customer.invalid'));
                focusFirstInvalid();
            } else {
                toast.error(errorMessage(error));
            }
        } finally {
            setSaving(false);
        }
    };

    const discard = () => {
        if (isNew) {
            release();
            router.visit(path('/customers'));
            return;
        }
        setDraft(base);
        setErrors({});
        setTriedSave(false);
    };

    const remove = async () => {
        if (id === null) return;
        setDeleting(true);
        try {
            await deleteCustomer(id);
            toast.success(t('customer.deleted'));
            release();
            router.visit(path('/customers'));
        } catch (error) {
            setConfirmDelete(false);
            toast.error(errorMessage(error));
        } finally {
            setDeleting(false);
        }
    };

    const applyEdited = (contact: ContactDraft) => {
        set({ contacts: applyContact(draft.contacts, contact) });
        // what the API complained about for this contact was just edited
        if (editingIndex >= 0) setErrors((current) => Object.fromEntries(Object.entries(current).filter(([path]) => !path.startsWith(`contacts.${editingIndex}.`))));
        setEditing(null);
    };

    return (
        <Page>
            <Head title={title} />
            <form noValidate onSubmit={(event) => void submit(event)} className="grid gap-6">
                <header className="flex flex-wrap items-end gap-4">
                    <div className="grid min-w-0 gap-1">
                        <BackLink href={path('/customers')}>{t('customer.all')}</BackLink>
                        <div className="flex min-w-0 items-center gap-4">
                            <Avatar name={draft.name} size="lg" tone="accent">
                                {isNew && !draft.name.trim() ? <UserRound /> : undefined}
                            </Avatar>
                            <div className="grid min-w-0 gap-1">
                                <h1 className="text-2xl font-bold tracking-title [overflow-wrap:anywhere] sm:text-3xl">{title}</h1>
                                <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                                    {draft.number && <span className="num">{draft.number}</span>}
                                    {draft.city && (
                                        <span>
                                            {draft.city}, {countryName(draft.country)}
                                        </span>
                                    )}
                                    {isNew && <Badge plain>{t('customer.not_saved')}</Badge>}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="ml-auto flex flex-wrap items-center gap-3">
                        {!isNew && (
                            <Button variant="soft" icon={<FilePlus />} disabled={dirty} title={dirty ? t('customer.save_first') : undefined} onClick={() => openNewDocument({ customerId: id ?? undefined })}>
                                {t('customer.new_document')}
                            </Button>
                        )}
                        <Button type="submit" variant="primary" pending={saving} disabled={!dirty && !isNew}>
                            {isNew ? t('customer.create') : t('customer.save')}
                        </Button>
                        {!isNew && (
                            <Menu
                                trigger={
                                    <Button iconOnly icon={<MoreHorizontal />}>
                                        {t('customer.more')}
                                    </Button>
                                }
                            >
                                <MenuItem danger icon={<Trash2 />} onSelect={() => setConfirmDelete(true)}>
                                    {t('customer.delete')}
                                </MenuItem>
                            </Menu>
                        )}
                    </div>
                </header>

                <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                    <div className="grid content-start gap-6">
                        <Card aria-labelledby="customer-base">
                            <CardHead titleId="customer-base" title={t('customer.base')} />
                            <div className="grid gap-4 sm:grid-cols-2">
                                <TextInput
                                    label={t('customer.name')}
                                    path="name"
                                    wrapClassName="sm:col-span-2"
                                    value={draft.name}
                                    placeholder={t('customer.name_placeholder')}
                                    error={nameError}
                                    autoFocus={isNew}
                                    onChange={(e) => set({ name: e.target.value })}
                                />
                                <TextInput
                                    label={t('customer.number')}
                                    path="number"
                                    className="num"
                                    value={draft.number}
                                    hint={isNew ? t('customer.number_hint') : undefined}
                                    error={errors.number}
                                    onChange={(e) => set({ number: e.target.value })}
                                />
                                <TextInput label={t('customer.email')} type="email" path="email" value={draft.email} error={errors.email} onChange={(e) => set({ email: e.target.value })} />
                                <TextInput label={t('customer.street')} path="street" wrapClassName="sm:col-span-2" value={draft.street} error={errors.street} onChange={(e) => set({ street: e.target.value })} />
                                <TextInput label={t('customer.zip')} path="zip" value={draft.zip} error={errors.zip} onChange={(e) => set({ zip: e.target.value })} />
                                <TextInput label={t('customer.city')} path="city" value={draft.city} error={errors.city} onChange={(e) => set({ city: e.target.value })} />
                                <Select label={t('customer.country')} path="country" value={draft.country} error={errors.country} onChange={(e) => set({ country: e.target.value })}>
                                    {[...new Set([draft.country, ...COUNTRIES])].filter(Boolean).map((code) => (
                                        <option key={code} value={code}>
                                            {countryName(code)}
                                        </option>
                                    ))}
                                </Select>
                                <TextInput
                                    label={t('customer.vat_id')}
                                    path="vat_id"
                                    value={draft.vat_id}
                                    placeholder={t('customer.vat_id_placeholder')}
                                    error={errors.vat_id ?? (vatMissing && triedSave ? t('customer.vat_id_required') : undefined)}
                                    onChange={(e) => set({ vat_id: e.target.value })}
                                />
                            </div>
                        </Card>

                        <Card aria-labelledby="customer-tax">
                            <CardHead titleId="customer-tax" title={t('customer.tax')} description={t('customer.tax_text')} />
                            <div role="radiogroup" aria-labelledby="customer-tax" className="grid gap-2 sm:grid-cols-3">
                                {TAX_TREATMENTS.map((value) => (
                                    <TaxOption key={value} value={value} checked={draft.tax_treatment === value} onChange={() => set({ tax_treatment: value })} />
                                ))}
                            </div>
                            {vatMissing && (
                                <Notice tone="warn" icon={<AlertTriangle />} className="mt-4">
                                    <b>{t('customer.vat_missing')}</b> {t('customer.vat_missing_text')}
                                </Notice>
                            )}
                        </Card>

                        <Card aria-labelledby="customer-fields">
                            <CardHead
                                titleId="customer-fields"
                                title={t('customer.fields')}
                                description={
                                    <>
                                        {t('customer.fields_text')} <code className="rounded-[6px] bg-surface-2 px-1.5 py-px font-mono text-[0.8em] text-ink">{'{{ customer.key }}'}</code>
                                    </>
                                }
                            />
                            {customerFields.error ? (
                                <ErrorState error={customerFields.error} onRetry={() => void customerFields.mutate()} />
                            ) : !customerFields.data ? (
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <Skeleton h={60} />
                                    <Skeleton h={60} />
                                </div>
                            ) : customerFields.data.length === 0 ? (
                                <p className="text-muted">{t('customer.fields_empty')}</p>
                            ) : (
                                <div className="grid gap-4 sm:grid-cols-2">
                                    {customerFields.data.map((field) => (
                                        <CustomFieldInput
                                            key={field.id}
                                            definition={field}
                                            path={`custom.${field.key}`}
                                            value={draft.custom[field.key]}
                                            error={errors[`custom.${field.key}`]}
                                            onChange={(value) => set({ custom: { ...draft.custom, [field.key]: value } })}
                                        />
                                    ))}
                                </div>
                            )}
                        </Card>
                    </div>

                    <div className="grid content-start gap-6">
                        <Card aria-labelledby="customer-contacts">
                            <CardHead
                                titleId="customer-contacts"
                                title={t('customer.contacts')}
                                description={t('customer.contacts_text')}
                                actions={
                                    <Button size="sm" variant="soft" icon={<Plus />} onClick={() => setEditing({ contact: newContact(draft.contacts), isNew: true })}>
                                        {t('customer.contacts_add')}
                                    </Button>
                                }
                            />
                            {draft.contacts.length === 0 ? (
                                <p className="text-muted">{t('customer.contacts_empty')}</p>
                            ) : (
                                <div className="-mx-3 grid gap-0.5">
                                    {draft.contacts.map((contact, index) => (
                                        <ContactRow
                                            key={contact.key}
                                            contact={contact}
                                            invalid={Object.keys(contactErrors(errors, index)).length > 0}
                                            onEdit={() => setEditing({ contact, isNew: false })}
                                            onDefault={() => set({ contacts: makeDefault(draft.contacts, contact.key) })}
                                            onRemove={() => set({ contacts: removeContact(draft.contacts, contact.key) })}
                                        />
                                    ))}
                                </div>
                            )}
                        </Card>
                        {id !== null && <CustomerDocuments customerId={id} disabled={dirty} />}
                    </div>
                </div>

                {dirty && (
                    <div role="region" aria-label={t('customer.unsaved')} className="sticky bottom-4 z-20 mx-auto flex w-full max-w-xl animate-pop-in items-center gap-3 rounded-full bg-ink py-2 pr-2 pl-5 text-bg shadow-float">
                        <span className="flex-1 text-sm font-medium">{isNew ? t('customer.unsaved_new') : t('customer.unsaved')}</span>
                        {/* own classes: a ghost <Button> would bring its own text color */}
                        <button type="button" onClick={discard} className="h-control-sm rounded-full px-3 text-sm font-strong text-bg opacity-80 transition-[background-color,opacity] hover:bg-white/10 hover:opacity-100 dark:hover:bg-black/10">
                            {isNew ? t('customer.discard') : t('customer.reset')}
                        </button>
                        <Button type="submit" size="sm" variant="primary" pending={saving}>
                            {isNew ? t('customer.create') : t('customer.save')}
                        </Button>
                    </div>
                )}
            </form>

            <ContactDrawer
                contact={editing?.contact ?? null}
                isNew={editing?.isNew ?? false}
                fields={contactFields.data ?? []}
                errors={editingIndex >= 0 ? contactErrors(errors, editingIndex) : {}}
                onClose={() => setEditing(null)}
                onApply={applyEdited}
            />
            {!isNew && (
                <ConfirmDialog
                    open={confirmDelete}
                    onClose={() => setConfirmDelete(false)}
                    onConfirm={() => void remove()}
                    title={t('customer.delete_title', { name: base.name })}
                    description={t('customer.delete_text')}
                    confirmLabel={t('customer.delete_confirm')}
                    icon={<Trash2 />}
                    pending={deleting}
                    danger
                />
            )}
        </Page>
    );
}

function TaxOption({ value, checked, onChange }: { value: TaxTreatment; checked: boolean; onChange(): void }) {
    return (
        <label className="relative grid cursor-pointer content-start gap-1 rounded-md bg-surface-2 p-4 transition-[background-color,box-shadow] hover:bg-surface-3 has-checked:bg-accent-soft has-checked:shadow-[inset_0_0_0_2px_var(--accent)] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent">
            <input type="radio" name="tax_treatment" value={value} checked={checked} onChange={onChange} className="peer pointer-events-none absolute opacity-0" />
            <strong className="font-semibold peer-checked:text-accent">{t(`tax_treatment.${value}`)}</strong>
            <span className="text-sm leading-snug text-muted">{t(`tax_treatment.${value}_text`)}</span>
        </label>
    );
}

function ContactRow({ contact, invalid, onEdit, onDefault, onRemove }: { contact: ContactDraft; invalid: boolean; onEdit(): void; onDefault(): void; onRemove(): void }) {
    const name = contactName(contact) || t('contact.no_name');

    return (
        <div className="flex items-center gap-3 rounded-md p-3 transition-colors hover:bg-surface-2">
            <Avatar name={`${contact.first_name} ${contact.last_name}`} size="sm" />
            <div className="grid min-w-0 flex-1 gap-0.5">
                <div className="flex min-w-0 items-center gap-2 font-semibold">
                    <button type="button" onClick={onEdit} className="truncate text-left hover:underline">
                        {name}
                    </button>
                    {contact.is_default && <Tag>{t('customer.contact_default')}</Tag>}
                    {invalid && <Tag tone="bad">{t('customer.contact_invalid')}</Tag>}
                </div>
                <div className="truncate text-sm text-muted">{[contact.position, contact.email].filter(Boolean).join(' · ') || t('customer.contact_no_details')}</div>
            </div>
            <Menu
                trigger={
                    <Button size="sm" variant="ghost" iconOnly icon={<MoreHorizontal />}>
                        {t('customer.contact_actions', { name })}
                    </Button>
                }
            >
                <MenuItem icon={<Pencil />} onSelect={onEdit}>
                    {t('customer.contact_edit')}
                </MenuItem>
                <MenuItem icon={<Star />} disabled={contact.is_default} onSelect={onDefault}>
                    {t('customer.contact_make_default')}
                </MenuItem>
                <MenuSeparator />
                <MenuItem danger icon={<Trash2 />} onSelect={onRemove}>
                    {t('customer.contact_remove')}
                </MenuItem>
            </Menu>
        </div>
    );
}

function DetailSkeleton() {
    return (
        <Page>
            <div className="grid gap-2" aria-busy="true" aria-label={t('common.loading')}>
                <Skeleton w={90} h={12} />
                <div className="flex items-center gap-4">
                    <Skeleton w={52} h={52} r={999} />
                    <div className="grid flex-1 gap-2">
                        <Skeleton w="40%" h={30} />
                        <Skeleton w={120} h={12} />
                    </div>
                </div>
            </div>
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                <div className="grid gap-6">
                    <Card className="grid gap-4">
                        <Skeleton w={110} h={18} />
                        <div className="grid gap-4 sm:grid-cols-2">
                            {Array.from({ length: 6 }, (_, i) => (
                                <Skeleton key={i} h={58} />
                            ))}
                        </div>
                    </Card>
                    <Card className="grid gap-4">
                        <Skeleton w={150} h={18} />
                        <Skeleton h={90} />
                    </Card>
                </div>
                <Card className="grid gap-4">
                    {Array.from({ length: 3 }, (_, i) => (
                        <div key={i} className="flex items-center gap-3">
                            <Skeleton w={32} h={32} r={999} />
                            <Skeleton w="60%" h={14} />
                        </div>
                    ))}
                </Card>
            </div>
        </Page>
    );
}
```

- [ ] **Step 8: Texte**

`lang/en.json`:

```json
    "contact.add": "Add",
    "contact.add_title": "Add contact",
    "contact.apply": "Apply",
    "contact.drawer_text": "The change is saved with the customer.",
    "contact.edit_title": "Edit contact",
    "contact.email": "Email",
    "contact.fields": "Custom fields",
    "contact.first_name": "First name",
    "contact.is_default": "Default contact for new documents",
    "contact.last_name": "Last name",
    "contact.name_required": "Enter a first or last name.",
    "contact.phone": "Phone",
    "contact.position": "Position",
    "contact.position_placeholder": "e.g. purchasing",
    "contact.salutation": "Salutation",
    "contact.salutation_mr": "Mr",
    "contact.salutation_ms": "Ms",
    "contact.salutation_mx": "Mx",
    "contact.salutation_none": "None",
    "customer.all": "All customers",
    "customer.base": "Master data",
    "customer.city": "City",
    "customer.contact_actions": "Actions for :name",
    "customer.contact_default": "Default",
    "customer.contact_edit": "Edit",
    "customer.contact_invalid": "Check this",
    "customer.contact_make_default": "Make default",
    "customer.contact_no_details": "No contact details",
    "customer.contact_remove": "Remove",
    "customer.contacts": "Contacts",
    "customer.contacts_add": "Add",
    "customer.contacts_empty": "No contact yet. Documents then go to the company in general.",
    "customer.contacts_text": "The default contact goes into new documents.",
    "customer.country": "Country",
    "customer.create": "Create customer",
    "customer.created": "Customer created",
    "customer.delete": "Delete customer",
    "customer.delete_confirm": "Delete",
    "customer.delete_text": "The customer and their drafts are removed. Customers with finalized documents cannot be deleted.",
    "customer.delete_title": "Delete :name?",
    "customer.deleted": "Customer deleted",
    "customer.discard": "Discard",
    "customer.documents": "Documents",
    "customer.documents_create": "Create document",
    "customer.documents_empty": "No documents for this customer yet",
    "customer.documents_new": "New",
    "customer.email": "Email for invoices",
    "customer.fields": "Custom fields",
    "customer.fields_empty": "There are no custom fields for customers yet.",
    "customer.fields_text": "Available in templates as",
    "customer.invalid": "Some entries are not valid.",
    "customer.leave_confirm": "Leave this page? Unsaved changes are lost.",
    "customer.load_failed": "Customer not loaded",
    "customer.more": "More actions",
    "customer.name": "Name",
    "customer.name_placeholder": "Company or person",
    "customer.name_required": "The customer needs a name.",
    "customer.new_document": "New document",
    "customer.new_title": "New customer",
    "customer.no_name": "No name",
    "customer.not_saved": "Not saved yet",
    "customer.number": "Customer number",
    "customer.number_hint": "Empty: the next free number.",
    "customer.reset": "Reset",
    "customer.save": "Save",
    "customer.save_first": "Save the changes first.",
    "customer.saved": "Changes saved",
    "customer.street": "Street and number",
    "customer.tax": "Tax treatment",
    "customer.tax_text": "Decides how VAT is calculated on this customer's documents.",
    "customer.unsaved": "Unsaved changes",
    "customer.unsaved_new": "New customer, not saved yet",
    "customer.vat_id": "VAT ID",
    "customer.vat_id_placeholder": "e.g. DE123456789",
    "customer.vat_id_required": "The VAT ID is required for reverse charge.",
    "customer.vat_missing": "VAT ID missing.",
    "customer.vat_missing_text": "Without it an invoice with reverse charge cannot be finalized.",
    "customer.zip": "Postcode",
    "fields.image_read_only": "Images can be set through the API.",
    "fields.no": "No",
    "fields.no_selection": "No selection",
    "fields.yes": "Yes",
    "tax_treatment.domestic": "Domestic",
    "tax_treatment.domestic_text": "Regular VAT according to the tax rates of the positions.",
    "tax_treatment.eu_reverse_charge": "EU with VAT ID",
    "tax_treatment.eu_reverse_charge_text": "No VAT, the customer accounts for it. Their VAT ID is required.",
    "tax_treatment.third_country": "Third country",
    "tax_treatment.third_country_text": "Outside the EU. The service is not taxable in Germany.",
```

`lang/de.json`:

```json
    "contact.add": "Hinzufügen",
    "contact.add_title": "Ansprechpartner hinzufügen",
    "contact.apply": "Übernehmen",
    "contact.drawer_text": "Die Änderung wird mit dem Kunden gespeichert.",
    "contact.edit_title": "Ansprechpartner bearbeiten",
    "contact.email": "E-Mail",
    "contact.fields": "Eigene Felder",
    "contact.first_name": "Vorname",
    "contact.is_default": "Standard-Ansprechpartner für neue Dokumente",
    "contact.last_name": "Nachname",
    "contact.name_required": "Gib einen Vor- oder Nachnamen ein.",
    "contact.phone": "Telefon",
    "contact.position": "Position",
    "contact.position_placeholder": "z. B. Einkauf",
    "contact.salutation": "Anrede",
    "contact.salutation_mr": "Herr",
    "contact.salutation_ms": "Frau",
    "contact.salutation_mx": "Divers",
    "contact.salutation_none": "Keine",
    "customer.all": "Alle Kunden",
    "customer.base": "Stammdaten",
    "customer.city": "Ort",
    "customer.contact_actions": "Aktionen für :name",
    "customer.contact_default": "Standard",
    "customer.contact_edit": "Bearbeiten",
    "customer.contact_invalid": "Bitte prüfen",
    "customer.contact_make_default": "Als Standard setzen",
    "customer.contact_no_details": "Keine Kontaktdaten",
    "customer.contact_remove": "Entfernen",
    "customer.contacts": "Ansprechpartner",
    "customer.contacts_add": "Hinzufügen",
    "customer.contacts_empty": "Noch kein Ansprechpartner. Dokumente gehen dann allgemein an die Firma.",
    "customer.contacts_text": "Der Standard wird in neue Dokumente übernommen.",
    "customer.country": "Land",
    "customer.create": "Kunde anlegen",
    "customer.created": "Kunde angelegt",
    "customer.delete": "Kunde löschen",
    "customer.delete_confirm": "Löschen",
    "customer.delete_text": "Der Kunde und seine Entwürfe werden entfernt. Kunden mit abgeschlossenen Dokumenten lassen sich nicht löschen.",
    "customer.delete_title": ":name löschen?",
    "customer.deleted": "Kunde gelöscht",
    "customer.discard": "Verwerfen",
    "customer.documents": "Dokumente",
    "customer.documents_create": "Dokument anlegen",
    "customer.documents_empty": "Für diesen Kunden gibt es noch keine Dokumente",
    "customer.documents_new": "Neu",
    "customer.email": "E-Mail für Rechnungen",
    "customer.fields": "Eigene Felder",
    "customer.fields_empty": "Für Kunden gibt es noch keine eigenen Felder.",
    "customer.fields_text": "Im Template verfügbar als",
    "customer.invalid": "Einige Angaben sind ungültig.",
    "customer.leave_confirm": "Seite verlassen? Ungespeicherte Änderungen gehen verloren.",
    "customer.load_failed": "Kunde nicht geladen",
    "customer.more": "Weitere Aktionen",
    "customer.name": "Name",
    "customer.name_placeholder": "Firma oder Person",
    "customer.name_required": "Der Kunde braucht einen Namen.",
    "customer.new_document": "Neues Dokument",
    "customer.new_title": "Neuer Kunde",
    "customer.no_name": "Ohne Namen",
    "customer.not_saved": "Noch nicht gespeichert",
    "customer.number": "Kundennummer",
    "customer.number_hint": "Leer: die nächste freie Nummer.",
    "customer.reset": "Zurücksetzen",
    "customer.save": "Speichern",
    "customer.save_first": "Speichere zuerst die Änderungen.",
    "customer.saved": "Änderungen gespeichert",
    "customer.street": "Straße und Hausnummer",
    "customer.tax": "Steuerbehandlung",
    "customer.tax_text": "Bestimmt, wie Umsatzsteuer auf den Dokumenten dieses Kunden berechnet wird.",
    "customer.unsaved": "Ungespeicherte Änderungen",
    "customer.unsaved_new": "Neuer Kunde, noch nicht gespeichert",
    "customer.vat_id": "USt-ID",
    "customer.vat_id_placeholder": "z. B. DE123456789",
    "customer.vat_id_required": "Bei Reverse Charge ist die USt-ID Pflicht.",
    "customer.vat_missing": "USt-ID fehlt.",
    "customer.vat_missing_text": "Ohne sie lässt sich eine Rechnung mit Reverse Charge nicht abschließen.",
    "customer.zip": "PLZ",
    "fields.image_read_only": "Bilder lassen sich über die API setzen.",
    "fields.no": "Nein",
    "fields.no_selection": "Keine Auswahl",
    "fields.yes": "Ja",
    "tax_treatment.domestic": "Inland",
    "tax_treatment.domestic_text": "Normale Umsatzsteuer nach den Steuersätzen der Positionen.",
    "tax_treatment.eu_reverse_charge": "EU mit USt-ID",
    "tax_treatment.eu_reverse_charge_text": "Keine Umsatzsteuer, der Kunde führt sie selbst ab. Seine USt-ID ist Pflicht.",
    "tax_treatment.third_country": "Drittland",
    "tax_treatment.third_country_text": "Außerhalb der EU. Die Leistung ist im Inland nicht steuerbar.",
```

- [ ] **Step 9: Tests, Typen, Build**

Run: `ddev exec vendor/bin/pint && ddev artisan test --filter='CustomerPagesTest|TranslationsTest|CustomerApiTest' && ddev exec pnpm test && ddev exec pnpm typecheck && ddev exec pnpm build`
Expected: alles grün.

- [ ] **Step 10: Im Browser prüfen (Review Focus)**

Mit Demo-Daten:
1. `/en/customers/new`: Name leer → „Create customer“ zeigt „The customer needs a name.“ am Feld und fokussiert es. Name „Werkstatt Morgenrot“, Ort „Lübeck“, Ansprechpartner über den Drawer („Lena Sommer“, `lena@morgenrot.example`) → „Create customer“ → Toast „Customer created“, URL `/en/customers/<ulid>`, Kundennummer `K-1005`, keine Rückfrage beim Umleiten.
2. Hafenkontor öffnen, E-Mail auf `not-an-email` → Speichern → Fehlertext der API unter dem Feld (auf `/de/…` deutsch: „E-Mail muss eine gültige E-Mail-Adresse sein.“), Toast „Some entries are not valid.“, nach Neuladen alte E-Mail.
3. Ansprechpartner Ole Brandt: E-Mail `kaputt` → Übernehmen → Speichern → Zeile zeigt „Check this“, Drawer zeigt den Fehler am Feld.
4. Name ändern, dann Sidebar „Customers“ → Rückfrage „Leave this page?…“; Abbrechen bleibt auf der Seite. Speicherleiste unten („Unsaved changes“, „Reset“).
5. Steuerbehandlung „EU with VAT ID“ ohne USt-ID → gelber Hinweis.
6. Fjord löschen (abgeschlossene Dokumente vorhanden) → Toast mit der 409-Meldung der API, Kunde bleibt.
7. Dark Mode und 390 px Breite: Karten untereinander, Speicherleiste lesbar.

- [ ] **Step 11: Commit**

```bash
git add app/Http/Controllers/CustomerController.php routes/web.php resources/js/lib/hooks.ts resources/js/components/custom-field-input.tsx resources/js/components/customers resources/js/pages/customers/show.tsx tests/Feature/Pages/CustomerPagesTest.php lang/en.json lang/de.json
git commit -m "feat: customer detail with contacts drawer, custom fields and saving over the API" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Login im neuen Design

Port von `prototypes/clickdummy-v2/src/routes/LoginPage.{tsx,css}` und `.login*` aus `shell.css`. Die Illustration rechts ist rein dekorativ (`aria-hidden`) und ohne Firmennamen, weil sie auf jeder Instanz erscheint; Papier bleibt in beiden Themes weiß (DESIGN.md).

**Files:**
- Rewrite: `resources/js/pages/login.tsx`
- Modify: `lang/en.json`, `lang/de.json`

**Interfaces:**
- Consumes: `TextInput`, `Checkbox`, `Button`, `Badge` (Task 6), `LogoMark` (Task 9), `LocaleSwitch`, `formatMoney` (Task 3); unverändert: `POST /{locale}/login` mit `email`, `password`, `remember` (Phase 1).
- Produces: Inertia-Komponente `login` (gleicher Name, gleiche Felder – `AuthTest`/`LocaleTest` bleiben gültig).

- [ ] **Step 1: `resources/js/pages/login.tsx` (ganze Datei)**

```tsx
import { Head, useForm } from '@inertiajs/react';
import { LogIn } from 'lucide-react';
import { LocaleSwitch } from '@/components/locale-switch';
import { Badge, Button, Checkbox, TextInput } from '@/components/ui';
import { LogoMark } from '@/layouts/logo';
import { formatMoney } from '@/lib/format';
import { path, t } from '@/lib/i18n';

export default function Login() {
    const form = useForm({ email: '', password: '', remember: false });

    return (
        <main className="grid min-h-dvh gap-3 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <Head title={t('login.title')} />
            <div className="relative grid content-center justify-items-start gap-8 px-3 py-12 sm:px-[clamp(1.5rem,6vw,6rem)]">
                <div className="absolute top-1 right-1">
                    <LocaleSwitch />
                </div>
                <div className="flex items-center gap-2.5 text-xl font-bold tracking-brand">
                    <LogoMark />
                    <span>openbill</span>
                </div>
                <div>
                    <h1 className="text-3xl font-bold tracking-brand">{t('login.welcome')}</h1>
                    <p className="mt-2 max-w-[34ch] text-muted">{t('login.lead')}</p>
                </div>
                {/* noValidate: the server answers in the page language (lang/de/validation.php) instead of the browser */}
                <form
                    noValidate
                    className="grid w-full max-w-sm gap-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.post(path('/login'), { onFinish: () => form.reset('password') });
                    }}
                >
                    <TextInput
                        label={t('login.email')}
                        name="email"
                        type="email"
                        autoComplete="username"
                        spellCheck={false}
                        autoFocus
                        value={form.data.email}
                        error={form.errors.email}
                        onChange={(e) => form.setData('email', e.target.value)}
                    />
                    <TextInput
                        label={t('login.password')}
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        value={form.data.password}
                        error={form.errors.password}
                        onChange={(e) => form.setData('password', e.target.value)}
                    />
                    <Checkbox label={t('login.remember')} name="remember" checked={form.data.remember} onChange={(e) => form.setData('remember', e.target.checked)} />
                    <Button type="submit" variant="primary" icon={<LogIn />} pending={form.processing} className="mt-2">
                        {t('login.submit')}
                    </Button>
                </form>
            </div>
            <div aria-hidden className="relative hidden place-items-center overflow-hidden rounded-xl bg-surface-2 p-10 md:grid">
                <LoginArt />
            </div>
        </main>
    );
}

/** Two sheets of paper, a total and a "paid" chip. Decorative; paper stays white in dark mode as well. */
function LoginArt() {
    const line = (width: string) => <span className="block h-2 rounded-full bg-[#ecece9]" style={{ width }} />;
    const row = (left: string, right: string, group = false) => (
        <div className={group ? 'flex justify-between border-t border-[#ecece9] pt-2.5' : 'flex justify-between'}>
            {line(left)}
            {line(right)}
        </div>
    );

    return (
        <div className="relative aspect-[210/260] w-full max-w-[26rem]">
            <div className="absolute inset-0 grid -translate-x-[8%] translate-y-[3%] -rotate-5 content-start gap-2.5 rounded-[6px] bg-white p-[9%] opacity-70 shadow-paper">
                {line('40%')}
                {line('70%')}
                {line('55%')}
            </div>
            <div className="absolute inset-0 grid content-start gap-2.5 rounded-[6px] bg-white p-[9%] text-[13px] text-[#23252b] shadow-paper">
                <div className="mb-4 flex items-baseline justify-between">
                    <span className="block h-3 w-[38%] rounded-full bg-[#23252b]" />
                    {line('28%')}
                </div>
                {row('36%', '18%', true)}
                {row('52%', '16%')}
                {row('44%', '16%')}
                {row('30%', '18%', true)}
                {row('48%', '16%')}
                <div className="num mt-4 flex justify-between rounded-[10px] bg-[#e3e9fb] px-3 py-2.5 font-bold text-[#2f55d4]">
                    <span>{t('template.total')}</span>
                    <span>{formatMoney('9650.90')}</span>
                </div>
            </div>
            <div className="absolute right-[-6%] bottom-[10%] flex items-center gap-2 rounded-full bg-surface py-2 pr-3.5 pl-2 shadow-float">
                <Badge tone="ok">{t('status.paid')}</Badge>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Texte**

`lang/en.json`:

```json
    "login.lead": "Sign in to work on your quotes and invoices.",
    "login.welcome": "Welcome back",
```

`lang/de.json`:

```json
    "login.lead": "Melde dich an, um Angebote und Rechnungen zu bearbeiten.",
    "login.welcome": "Willkommen zurück",
```

- [ ] **Step 3: Prüfen**

Run: `ddev artisan test --filter='AuthTest|LocaleTest|ValidationLocaleTest|TranslationsTest' && ddev exec pnpm typecheck && ddev exec pnpm build`
Expected: PASS.

Im Browser (abgemeldet) `/en/login` und `/de/login`, hell und dunkel, 1440 und 390 px: Formular links, Illustration rechts (unter 900 px ausgeblendet), Sprachumschalter oben rechts. Leeres Absenden auf `/de/login` zeigt „E-Mail ist erforderlich.“ am Feld; falsches Passwort zeigt „E-Mail oder Passwort stimmen nicht.“ unter dem E-Mail-Feld; nach dem Login landet man auf der Übersicht.

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/login.tsx lang/en.json lang/de.json
git commit -m "feat: login in the Graphit & Kobalt design" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Playwright-Grundgerüst in `e2e/` (Login, Kunden) gegen DDEV

Playwright läuft **auf dem Mac** gegen `https://openbill.ddev.site`, weil die Browser macOS-Binaries sind und `node_modules` im Repo-Root die Linux-Binaries des Containers enthält. Deshalb ist `e2e/` ein eigenes pnpm-Projekt mit eigenem Lockfile und eigenem `pnpm-workspace.yaml` (eigene Workspace-Wurzel): Es gehört nicht zum Workspace der App, die CI und `ddev exec pnpm install` sehen es nicht.

**Files:**
- Create: `e2e/package.json`, `e2e/pnpm-workspace.yaml`, `e2e/pnpm-lock.yaml` (von pnpm erzeugt), `e2e/playwright.config.ts`, `e2e/global-setup.ts`, `e2e/tests/helpers.ts`, `e2e/tests/login.spec.ts`, `e2e/tests/customers.spec.ts`
- Create: `database/seeders/E2eUserSeeder.php`, `tests/Feature/E2eUserSeederTest.php`
- Modify: `.gitignore`, `vite.config.ts` (Watcher ignoriert `e2e/`)

**Interfaces:**
- Consumes: alle Seiten aus Task 9–14, `DemoSeeder` (Phase 2/3).
- Produces: `pnpm --dir e2e test` (Projekt `chromium`, 1440 × 900), `pnpm --dir e2e screenshots` (Projekt `screenshots`, nur mit `SCREENSHOTS=1`, Task 17), Helfer `login(page, locale?)` und `USER` in `e2e/tests/helpers.ts`. Phase 6–9 legen ihre Playwright-Tests in `e2e/tests/` ab; Phase 10 baut daraus den CI-Job `e2e` gegen Compose (`OPENBILL_URL`, `E2E_SKIP_SEED`).

- [ ] **Step 1: Failing Pest-Test für den E2E-Login**

`tests/Feature/E2eUserSeederTest.php`:

```php
<?php

use App\Enums\UserRole;
use App\Models\User;
use Database\Seeders\E2eUserSeeder;
use Illuminate\Support\Facades\Hash;

it('creates the login of the Playwright tests once', function () {
    $this->seed(E2eUserSeeder::class);
    $this->seed(E2eUserSeeder::class);

    $user = User::query()->where('email', E2eUserSeeder::EMAIL)->sole();
    expect(Hash::check(E2eUserSeeder::PASSWORD, $user->password))->toBeTrue()
        ->and($user->role)->toBe(UserRole::Owner)
        ->and($user->name)->toBe('Erik Ende');
});

it('refuses to run in production', function () {
    app()->detectEnvironment(fn () => 'production');

    (new E2eUserSeeder)->run();
})->throws(RuntimeException::class);
```

Run: `ddev artisan test --filter=E2eUserSeederTest`
Expected: FAIL – `Class "Database\Seeders\E2eUserSeeder" not found`.

- [ ] **Step 2: `database/seeders/E2eUserSeeder.php`**

```php
<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Seeder;
use RuntimeException;

/** Login of the Playwright tests in e2e/ (fictional). Never in production. */
class E2eUserSeeder extends Seeder
{
    public const EMAIL = 'e2e@example.com';

    public const PASSWORD = 'e2e-password';

    public function run(): void
    {
        if (app()->environment('production')) {
            throw new RuntimeException('E2eUserSeeder must not run in production.');
        }

        // the model hashes the password (cast "hashed")
        User::query()->updateOrCreate(
            ['email' => self::EMAIL],
            ['name' => 'Erik Ende', 'password' => self::PASSWORD, 'role' => UserRole::Owner, 'locale' => null],
        );
    }
}
```

Run: `ddev exec vendor/bin/pint && ddev artisan test --filter=E2eUserSeederTest`
Expected: PASS.

- [ ] **Step 3: Paket `e2e/` anlegen und auf dem Mac installieren**

`e2e/package.json`:

```json
{
    "name": "openbill-e2e",
    "private": true,
    "type": "module",
    "packageManager": "pnpm@12.8.1",
    "scripts": {
        "test": "playwright test",
        "screenshots": "SCREENSHOTS=1 playwright test --project=screenshots"
    }
}
```

`e2e/pnpm-workspace.yaml`:

```yaml
# e2e/ is its own pnpm project, installed on the Mac (Playwright's browsers are macOS binaries, the root
# node_modules are Linux binaries from the DDEV container). This file makes e2e/ its own workspace root,
# so it never touches the app's workspace or pnpm-lock.yaml.
packages: []
```

Run (auf dem Mac, nicht in DDEV):

```bash
pnpm --dir e2e add -D @playwright/test
pnpm --dir e2e exec playwright install chromium
git status --short pnpm-lock.yaml e2e
```

Expected: `e2e/package.json` hat `devDependencies.@playwright/test` (aktuelle Version), `e2e/pnpm-lock.yaml` entsteht, das Root-`pnpm-lock.yaml` ist **unverändert** (taucht in `git status` nicht auf); Chromium wird nach `~/Library/Caches/ms-playwright` geladen. Meldet pnpm, dass `e2e` nicht zum Workspace gehört, oder ändert es das Root-Lockfile: `git checkout pnpm-lock.yaml` und stattdessen `pnpm --dir e2e add -D @playwright/test --ignore-workspace` verwenden (und das in Task 16 in CLAUDE.md so dokumentieren).

`.gitignore` ergänzen:

```
/e2e/test-results
/e2e/playwright-report
/e2e/screenshots
```

`vite.config.ts`: in `server.watch.ignored` den Eintrag `'**/e2e/**'` ergänzen (`e2e/node_modules` landet per Mutagen auch im Container).

- [ ] **Step 4: Konfiguration, Setup, Helfer**

`e2e/playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

// The app runs in DDEV, Playwright on the Mac. Phase 10 points it at the Compose stack via OPENBILL_URL.
const baseURL = process.env.OPENBILL_URL ?? 'https://openbill.ddev.site';

export default defineConfig({
    testDir: './tests',
    outputDir: './test-results',
    // one shared database (demo data): files run one after another
    fullyParallel: false,
    workers: 1,
    retries: 0,
    reporter: [['list']],
    globalSetup: './global-setup.ts',
    use: {
        baseURL,
        ignoreHTTPSErrors: true,
        locale: 'en-GB',
        timezoneId: 'Europe/Berlin',
        trace: 'retain-on-failure',
    },
    projects: [
        { name: 'chromium', testIgnore: /screenshots\.spec\.ts/, use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
        // review screenshots against the clickdummy (pnpm screenshots): only when asked for
        ...(process.env.SCREENSHOTS ? [{ name: 'screenshots', testMatch: /screenshots\.spec\.ts/, use: { ...devices['Desktop Chrome'] } }] : []),
    ],
});
```

`e2e/global-setup.ts`:

```ts
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

/** Fresh demo data and the e2e login in the DDEV database (PHP runs only in DDEV). E2E_SKIP_SEED=1 skips it. */
export default function globalSetup(): void {
    if (!existsSync(path.join(root, 'public/hot')) && !existsSync(path.join(root, 'public/build/manifest.json'))) {
        throw new Error('No frontend assets: run `ddev exec pnpm build` (or keep `ddev exec pnpm dev` running) first.');
    }
    if (process.env.E2E_SKIP_SEED) return;

    const artisan = (...args: string[]) => execFileSync('ddev', ['artisan', ...args], { cwd: root, stdio: 'inherit' });
    artisan('db:seed', '--class=DemoSeeder', '--no-interaction');
    artisan('db:seed', '--class=E2eUserSeeder', '--no-interaction');
}
```

`e2e/tests/helpers.ts`:

```ts
import { expect, type Page } from '@playwright/test';

/** Login of database/seeders/E2eUserSeeder.php (fictional). */
export const USER = { email: 'e2e@example.com', password: 'e2e-password', name: 'Erik Ende' };

export async function login(page: Page, locale: 'en' | 'de' = 'en'): Promise<void> {
    const de = locale === 'de';
    await page.goto(`/${locale}/login`);
    await page.getByLabel(de ? 'E-Mail' : 'Email', { exact: true }).fill(USER.email);
    await page.getByLabel(de ? 'Passwort' : 'Password', { exact: true }).fill(USER.password);
    await page.getByRole('button', { name: de ? 'Anmelden' : 'Log in' }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}$`));
}

/** The session cookie of the page, for checks against the API (Sanctum needs a Referer of the own host). */
export async function apiGet(page: Page, url: string): Promise<unknown> {
    const response = await page.request.get(url, { headers: { Accept: 'application/json', Referer: page.url() } });
    expect(response.ok()).toBe(true);
    return response.json();
}
```

- [ ] **Step 5: Tests schreiben**

`e2e/tests/login.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { login, USER } from './helpers';

test('logs in, shows the overview and logs out', async ({ page }) => {
    await login(page);

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Erik');
    await expect(page.getByRole('region', { name: 'Key figures' })).toBeVisible();

    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('menuitem', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/en\/login$/);
});

test('refuses a wrong password with a message at the field', async ({ page }) => {
    await page.goto('/en/login');
    await page.getByLabel('Email', { exact: true }).fill(USER.email);
    await page.getByLabel('Password', { exact: true }).fill('wrong-password');
    await page.getByRole('button', { name: 'Log in' }).click();

    await expect(page.getByText('Email or password is incorrect.')).toBeVisible();
    await expect(page).toHaveURL(/\/en\/login$/);
});

test('works in German', async ({ page }) => {
    await login(page, 'de');

    await expect(page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link', { name: 'Kunden' })).toBeVisible();
});

test('opens "New document" with the key N and closes it with Escape', async ({ page }) => {
    await login(page);

    await page.keyboard.press('n');
    await expect(page.getByRole('dialog', { name: 'New document' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
});
```

`e2e/tests/customers.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { apiGet, login } from './helpers';

test.beforeEach(async ({ page }) => {
    await login(page);
});

test('creates a customer with a contact over the API', async ({ page }) => {
    await page.goto('/en/customers');
    await page.getByRole('link', { name: 'New customer' }).click();
    await page.getByLabel('Name', { exact: true }).fill('Werkstatt Morgenrot');
    await page.getByLabel('City', { exact: true }).fill('Lübeck');

    await page.getByRole('button', { name: 'Add', exact: true }).click();
    const drawer = page.getByRole('dialog', { name: 'Add contact' });
    await drawer.getByLabel('First name').fill('Lena');
    await drawer.getByLabel('Last name').fill('Sommer');
    await drawer.getByLabel('Email').fill('lena@morgenrot.example');
    await drawer.getByRole('button', { name: 'Add', exact: true }).click();

    await page.getByRole('button', { name: 'Create customer' }).first().click();
    await expect(page.getByText('Customer created')).toBeVisible();
    await expect(page).toHaveURL(/\/en\/customers\/[0-9a-z]{26}$/);

    await page.reload();
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Werkstatt Morgenrot');
    await expect(page.getByText('Lena Sommer')).toBeVisible();

    await page.getByRole('link', { name: 'All customers' }).click();
    await page.getByLabel('Search customers').fill('Morgenrot');
    await expect(page.getByRole('link', { name: /Werkstatt Morgenrot/ }).first()).toBeVisible();
});

test('shows API validation at the field and saves nothing (review focus)', async ({ page }) => {
    await page.goto('/en/customers');
    await page.getByRole('link', { name: /Hafenkontor Lindqvist GmbH/ }).click();
    await expect(page).toHaveURL(/\/en\/customers\/[0-9a-z]{26}$/);
    const id = page.url().split('/').pop();

    const email = page.getByLabel('Email for invoices');
    await email.fill('not-an-email');
    await page.getByRole('button', { name: 'Save', exact: true }).first().click();

    await expect(page.getByText('The email field must be a valid email address.')).toBeVisible();
    await expect(email).toHaveAttribute('aria-invalid', 'true');
    const saved = (await apiGet(page, `/api/customers/${id}`)) as { email: string };
    expect(saved.email).toBe('buchhaltung@hafenkontor.example');
});

test('asks before leaving unsaved changes (review focus)', async ({ page }) => {
    await page.goto('/en/customers');
    await page.getByRole('link', { name: /Hotel Alpenglück/ }).click();
    await expect(page).toHaveURL(/\/en\/customers\/[0-9a-z]{26}$/);
    const url = page.url();

    await page.getByLabel('Name', { exact: true }).fill('Hotel Alpenglück & Spa');
    let asked = '';
    page.once('dialog', async (dialog) => {
        asked = dialog.message();
        await dialog.dismiss();
    });
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Customers' }).click();

    await expect.poll(() => asked).toContain('Unsaved changes are lost');
    expect(page.url()).toBe(url);
    await expect(page.getByRole('region', { name: 'Unsaved changes' })).toBeVisible();
});
```

- [ ] **Step 6: Laufen lassen**

Run:

```bash
ddev exec pnpm build
pnpm --dir e2e test
```

Expected: Global Setup seedet (Ausgabe des DemoSeeders), dann `7 passed`. Häufige Ursachen bei Fehlern: `public/hot` von einem beendeten Vite-Server (`rm public/hot`), Gotenberg nicht gestartet (DemoSeeder bricht ab, `ddev start`), Login gesperrt nach mehreren Fehlversuchen (60 s warten). Schlägt ein Selektor fehl, weil ein Label anders heißt, den **Test** an den tatsächlichen Text aus `lang/en.json` anpassen, nicht umgekehrt.

- [ ] **Step 7: Commit**

```bash
git add e2e/package.json e2e/pnpm-workspace.yaml e2e/pnpm-lock.yaml e2e/playwright.config.ts e2e/global-setup.ts e2e/tests database/seeders/E2eUserSeeder.php tests/Feature/E2eUserSeederTest.php .gitignore vite.config.ts
git commit -m "test: Playwright scaffold in e2e/ with login and customer tests against DDEV" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Doku (`documents` UI-Teil, `api`, `development`) und CLAUDE.md

**Files:**
- Modify: `docs/en/documents.md`, `docs/de/documents.md` (neuer Abschnitt vor „Demo data“/„Demo-Daten“)
- Modify: `docs/en/api.md`, `docs/de/api.md` (Filter `overdue`)
- Modify: `docs/en/development.md`, `docs/de/development.md` (Vitest, Playwright)
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: Verhalten aus Task 1–15.
- Produces: Doku in beiden Sprachen; `tests/Unit/DocsTest.php` bleibt grün (keine neue Seite, gleiche Dateinamen).

- [ ] **Step 1: `docs/en/documents.md` – vor `## Demo data` einfügen**

```markdown
## In the app

### Overview

After logging in you land on the overview. Four figures sum up the money side: open invoices, how much of that is overdue, open quotes, and what was paid this month (with the total since the start of the year). Each figure opens the matching filtered list. **Needs your attention** lists overdue invoices first, then open quotes whose validity ends within seven days or has ended, then drafts. **Recently edited** shows the six documents changed last.

### Document list

**Documents** shows all documents, newest first and grouped by month. Filter by type (each pill shows how many documents that type has under the other filters), by status, by customer, and search number and customer name. The status filter also offers **Overdue**: open invoices past their due date. Every filter is part of the address, for example `/en/documents?type=invoice&status=overdue`, so a filtered list can be bookmarked, shared and reached again with the browser's back button. The list loads 50 documents at a time (**Load more**); the line below it counts all matching documents and sums their gross amounts.

### New document

**New document** in the sidebar – or the key **N** anywhere, as long as you are not typing in a field – opens a dialog: choose the type and the customer (or choose the customer later), and openbill creates a draft with the defaults of the document type. Cancellations are not created here; they always come from an invoice. Editing documents in the app comes with the document editor; until then a document's page shows its key data and its PDF.

### Customers

**Customers** lists all customers with their default contact and what is open: the sum of their open invoices, overdue ones marked. The search looks through name, number and email.

A customer's page holds the master data, the **tax treatment** (domestic; EU with VAT ID, which means reverse charge; third country), the customer's custom fields, the **contacts** and the customer's documents. Contacts are edited in a side panel; one of them is the default that new documents use. All changes, contacts included, are saved together with **Save**:

- Mistakes are shown at the field they belong to (or at the contact), and nothing is saved until everything is valid.
- Leading and trailing spaces are removed; an empty customer number gets the next free number.
- Leaving the page with unsaved changes asks first.
- A customer with finalized documents cannot be deleted.

### Appearance and language

The account menu at the bottom of the sidebar switches between light, dark and the system setting (remembered per browser) and between English and German. The sidebar can be collapsed to icons; on small screens it opens from the menu button.
```

- [ ] **Step 2: `docs/de/documents.md` – vor `## Demo-Daten` einfügen**

```markdown
## In der App

### Übersicht

Nach dem Anmelden landest du auf der Übersicht. Vier Kennzahlen fassen das Geld zusammen: offene Rechnungen, wie viel davon überfällig ist, offene Angebote und was in diesem Monat bezahlt wurde (mit der Summe seit Jahresbeginn). Jede Kennzahl öffnet die passend gefilterte Liste. **Braucht deine Aufmerksamkeit** zeigt zuerst überfällige Rechnungen, dann offene Angebote, deren Gültigkeit in den nächsten sieben Tagen endet oder schon abgelaufen ist, dann Entwürfe. **Zuletzt bearbeitet** zeigt die sechs zuletzt geänderten Dokumente.

### Dokumentliste

**Dokumente** zeigt alle Dokumente, die neuesten zuerst und nach Monaten gruppiert. Filtern lässt sich nach Art (jede Pille zeigt, wie viele Dokumente dieser Art unter den übrigen Filtern dazukommen), nach Status und Kunde, dazu eine Suche über Nummer und Kundennamen. Der Statusfilter kennt zusätzlich **Überfällig**: offene Rechnungen, deren Fälligkeit überschritten ist. Jeder Filter steht in der Adresse, zum Beispiel `/de/documents?type=invoice&status=overdue`; eine gefilterte Liste lässt sich also als Lesezeichen speichern, weitergeben und mit dem Zurück-Knopf des Browsers wieder aufrufen. Die Liste lädt 50 Dokumente auf einmal (**Mehr laden**); die Zeile darunter zählt alle passenden Dokumente und summiert ihre Bruttobeträge.

### Neues Dokument

**Neues Dokument** in der Seitenleiste – oder die Taste **N** überall, solange du nicht in einem Feld tippst – öffnet einen Dialog: Art und Kunde wählen (den Kunden auch später), und openbill legt einen Entwurf mit den Vorgaben des Dokumenttyps an. Stornos entstehen hier nicht, sondern immer aus einer Rechnung. Dokumente in der App bearbeiten kommt mit dem Dokument-Editor; bis dahin zeigt die Seite eines Dokuments seine Eckdaten und das PDF.

### Kunden

**Kunden** listet alle Kunden mit ihrem Standard-Ansprechpartner und dem, was offen ist: die Summe ihrer offenen Rechnungen, überfällige markiert. Die Suche geht über Name, Nummer und E-Mail.

Die Seite eines Kunden enthält die Stammdaten, die **Steuerbehandlung** (Inland; EU mit USt-ID, also Reverse Charge; Drittland), die eigenen Felder des Kunden, die **Ansprechpartner** und seine Dokumente. Ansprechpartner bearbeitest du in einem Seitenpanel; einer davon ist der Standard, den neue Dokumente übernehmen. Alle Änderungen, auch die an Ansprechpartnern, speichert **Speichern** zusammen:

- Fehler stehen am betroffenen Feld (oder am Ansprechpartner), und gespeichert wird erst, wenn alles gültig ist.
- Leerzeichen am Anfang und Ende werden entfernt; eine leere Kundennummer bekommt die nächste freie Nummer.
- Wer die Seite mit ungespeicherten Änderungen verlässt, wird vorher gefragt.
- Kunden mit abgeschlossenen Dokumenten lassen sich nicht löschen.

### Darstellung und Sprache

Das Kontomenü unten in der Seitenleiste schaltet zwischen hell, dunkel und der Systemeinstellung um (gemerkt pro Browser) und zwischen Englisch und Deutsch. Die Seitenleiste lässt sich auf Symbole einklappen; auf kleinen Bildschirmen öffnet sie der Menü-Knopf.
```

- [ ] **Step 3: `api` und `development`**

`docs/en/api.md`: direkt nach dem Absatz, der mit „A document in a list has the short form“ beginnt, einfügen:

```markdown
The `status` filter of `GET /api/documents` also takes `overdue`: open invoices whose due date has passed. Overdue is not a status of its own, so documents never carry it.
```

`docs/de/api.md`: nach dem Absatz „Ein Dokument in einer Liste hat die Kurzform …“:

```markdown
Der Filter `status` von `GET /api/documents` kennt zusätzlich `overdue`: offene Rechnungen, deren Fälligkeit überschritten ist. Überfällig ist kein eigener Status; Dokumente tragen ihn nie.
```

`docs/en/development.md`: im Block unter „Everyday commands“ nach `ddev exec pnpm typecheck` die Zeile `ddev exec pnpm test                                    # Vitest (resources/js)` ergänzen und vor `## Languages` einfügen:

````markdown
## Browser tests

Playwright tests live in `e2e/` and run on your machine against the DDEV site (the browsers are native binaries, the `node_modules` of the app belong to the container). `e2e/` is a separate pnpm project with its own lockfile.

```bash
pnpm --dir e2e install                       # once, on the host
pnpm --dir e2e exec playwright install chromium
ddev exec pnpm build                         # or keep `ddev exec pnpm dev` running
pnpm --dir e2e test                          # seeds demo data, then runs the tests
```

The tests log in as `e2e@example.com` (created by `Database\Seeders\E2eUserSeeder`) and replace all business data with the demo data before they start (`E2E_SKIP_SEED=1` skips that). `OPENBILL_URL` points them at another instance.
````

`docs/de/development.md` entsprechend: Zeile `ddev exec pnpm test                                    # Vitest (resources/js)` im Befehlsblock und vor `## Sprachen`:

````markdown
## Browsertests

Die Playwright-Tests liegen in `e2e/` und laufen auf deinem Rechner gegen die DDEV-Seite (die Browser sind native Programme, die `node_modules` der App gehören dem Container). `e2e/` ist ein eigenes pnpm-Projekt mit eigenem Lockfile.

```bash
pnpm --dir e2e install                       # einmal, auf dem Host
pnpm --dir e2e exec playwright install chromium
ddev exec pnpm build                         # oder `ddev exec pnpm dev` laufen lassen
pnpm --dir e2e test                          # spielt Demo-Daten ein, dann die Tests
```

Die Tests melden sich als `e2e@example.com` an (angelegt von `Database\Seeders\E2eUserSeeder`) und ersetzen vor dem Start alle Fachdaten durch die Demo-Daten (`E2E_SKIP_SEED=1` überspringt das). `OPENBILL_URL` richtet sie auf eine andere Instanz.
````

- [ ] **Step 4: `CLAUDE.md` aktualisieren**

1. In „Was openbill ist“ den Satz ab „Stand:“ ersetzen durch: `Stand: Phase 5 (UI-Basis: Shell, Übersicht, Dokumentliste, „Neues Dokument“, Kunden; REST-API unter /api; Dokument-Editor folgt in Phase 6, kein MCP).`
2. In „Tech Stack“ nach der Zeile `- PHP 8.4, …` ergänzen:
   `- UI: SWR 2 (Daten aus /api), @radix-ui/react-dialog + react-dropdown-menu (nur Dialog/Drawer/Menü), lucide-react (Icons), @fontsource-variable/schibsted-grotesk; eigene Komponenten in resources/js/components/ui (Port aus prototypes/clickdummy-v2)`
   und die Test-Zeile ergänzen um `, Vitest (resources/js/**/*.test.ts, Umgebung node), Playwright (e2e/, eigenes pnpm-Projekt, läuft auf dem Mac gegen DDEV)`.
3. In „Kommandos“ nach `ddev exec pnpm typecheck` ergänzen:

```bash
ddev exec pnpm test                          # Vitest
pnpm --dir e2e install && pnpm --dir e2e exec playwright install chromium   # auf dem Mac (einmal)
pnpm --dir e2e test                          # Playwright gegen https://openbill.ddev.site (seedet Demo-Daten)
pnpm --dir e2e screenshots                   # Review-Screenshots 1440/390 hell/dunkel nach e2e/screenshots/ (CLICKDUMMY_URL für den Vergleich)
```

4. In „Regeln“:
   - pnpm-Regel ergänzen: `Ausnahme: e2e/ ist eine eigene pnpm-Workspace-Wurzel (e2e/pnpm-workspace.yaml, e2e/pnpm-lock.yaml) und wird auf dem Mac installiert; dort keine App-Abhängigkeiten.`
   - Die Zeile „Gestaltung nach …“ ersetzen durch: `Gestaltung nach prototypes/clickdummy-v2/DESIGN.md. Tokens in resources/css/app.css: Rohwerte als CSS-Variablen (:root und :root[data-theme='dark']), Tailwind-Namen über @theme inline (bg-surface-2, text-muted, shadow-float, rounded-lg = 18 px, text-sm = 13 px, h-control, font-strong/font-heading, Breakpoints xs 520/sm 720/md 900/lg 1100). Tailwinds Farbpalette ist entfernt (--color-*: initial). Zahlen mit der Utility num (proportional), nie tabular-nums. Keine shadcn-Defaults, Radix nur für Dialog/Menü/Popover.`
   - Neu: `UI-Datenfluss: Inertia-Props nur für Seitenkontext und serverseitig berechnete Kennzahlen (App\Support\Overview, App\Support\DocumentQuery::counts/summary); Listen und Details lädt die UI per SWR aus /api (resources/js/api/*, Schlüssel = URL), geschrieben wird nur über lib/api.ts → /api → Actions. Im Browser wird nie mit Beträgen gerechnet (formatMoney formatiert die API-Strings exakt).`
   - Neu: `Seiten mit Shell setzen Page.layout = appLayout (resources/js/layouts/app-shell.tsx); neue Navigationspunkte in resources/js/layouts/nav.ts.`
5. „Architektur (Stand Phase 4)“ → „Architektur (Stand Phase 5)“; die Routen-Zeile ersetzen durch: `Routen (routes/web.php): Admin unter Sprachpräfix /{locale} (en|de): GET|POST /{locale}/login (guest), POST /{locale}/logout, GET /{locale} = Übersicht (Routenname home, OverviewController), GET /{locale}/documents (DocumentController@index, Filter ?type&status&customer_id&q, normalisiert über DocumentQuery::lenient), GET /{locale}/documents/{id} (Platzhalter bis Phase 6), GET /{locale}/customers, /customers/new, /customers/{id} (CustomerController; IDs whereUlid). / und /login leiten in die zuletzt genutzte Sprache um (Cookie locale, sonst en). Unbekanntes Präfix → 404.`
   Die Shared-Props-Zeile um `, org (name; nur angemeldet)` ergänzen. Neue Zeilen:
   - `**UI** (resources/js): lib/api.ts (fetch mit Session, X-XSRF-TOKEN aus dem Cookie, Accept-Language, ApiError mit Problem Details, 419 → /sanctum/csrf-cookie und einmal wiederholen, 401 → Login), lib/swr.tsx (ApiProvider in app.tsx), api/* (Typen, Schlüssel, usePagedList mit „Mehr laden“, Hooks), components/ui (Komponentenset), layouts (AppShell mit NewDocumentProvider und Toaster, Taste N), lib/theme.ts (Theme in localStorage openbill:theme, Inline-Skript in app.blade.php setzt data-theme vor dem Paint – beide Regeln gleich halten), lib/toast.ts, lib/format.ts, lib/customers.ts.`
   - `App\Support\DocumentQuery (Filter der Dokumentliste für API und Seite, Status overdue = offene Rechnung mit due_date < heute), App\Support\Overview (Kennzahlen/Aufmerksamkeit/zuletzt bearbeitet, offene Beträge je Kunde; Phase 8 gibt build() als MCP-Tool get-overview zurück), App\Support\Amount (SQL-Summe → "0.00").`
6. In „Fallstricke“ die Zeile „Laravels eingebaute Validierungstexte … nur englisch, bis lang/de/validation.php existiert …“ ersetzen durch: `Laravels Standardmeldungen stehen deutsch in lang/de/validation.php (inkl. Attributnamen, Wildcards wie contacts.*.email); ValidationTranslationTest hält die Schlüssel gleich zur Framework-Datei – nach Laravel-Updates neue Regeln dort ergänzen. Eigene Meldungen stehen in lang/*.json.` Und neu anhängen:
   - `Tailwind kennt keinen Sieger zwischen zwei Klassen für dieselbe CSS-Eigenschaft (z. B. justify-start und justify-center, text-bg und text-muted). className-Ergänzungen an Komponenten dürfen nur Eigenschaften setzen, die die Komponente nicht setzt (Layout, Abstände, Langformen wie pl-9 nach px-3); sonst eigene Klassen/Varianten statt Überschreiben. Es gibt bewusst kein tailwind-merge.`
   - `Radix-Menüs laufen mit modal={false}: Öffnet ein Menüpunkt einen Dialog, bleibt sonst pointer-events: none am body hängen.`
   - `SaveCustomer trimmt Stammdaten selbst (TrimStrings sieht API-Bodies nicht). Dokument-Entwürfe werden absichtlich nicht getrimmt (Autosave beim Tippen).`
   - `Playwright läuft auf dem Mac; e2e/node_modules wird per Mutagen auch in den Container gespiegelt (harmlos, Vite ignoriert e2e/). Nach mehreren Fehlversuchen sperrt der Login 60 s – auch für e2e@example.com.`
   - `Intl.NumberFormat.format() bekommt Beträge als String (exakt, ES2023); die TS-Lib ES2022 kennt die Überladung nicht, daher der Cast in lib/format.ts.`

- [ ] **Step 5: Prüfen und committen**

Run: `ddev artisan test --filter=DocsTest && ddev exec pnpm --dir docs build`
Expected: PASS, VitePress-Build fertig (keine toten Links).

```bash
git add docs/en/documents.md docs/de/documents.md docs/en/api.md docs/de/api.md docs/en/development.md docs/de/development.md CLAUDE.md
git commit -m "docs: UI of documents and customers, overdue filter, browser tests, CLAUDE.md for phase 5" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17: Verifizieren, Screenshots gegen den Klickdummy, pushen, PR, CI

**Files:**
- Create: `e2e/tests/screenshots.spec.ts`
- Fixes aus dem Vergleich in den betroffenen Dateien (eigene Commits)

**Interfaces:**
- Consumes: alles aus Task 1–16.
- Produces: Screenshots unter `e2e/screenshots/{app,clickdummy}/` (nicht im Repo), PR `phase-05-ui-base` → `main` mit grüner CI (`tests`); **nicht** mergen.

- [ ] **Step 1: Alles lokal prüfen**

Run:

```bash
ddev exec vendor/bin/pint --test
ddev exec vendor/bin/phpstan analyse --memory-limit=1G
ddev artisan test
ddev exec pnpm typecheck
ddev exec pnpm test
ddev exec pnpm build
ddev exec 'pnpm --filter "./prototypes/*" test'
ddev exec pnpm --dir docs build
pnpm --dir e2e test
```

Expected: Pint ohne Änderungen, `[OK] No errors`, alle Pest-Tests grün, `tsc` ohne Fehler, Vitest grün, Vite- und VitePress-Build fertig, Prototyp-Tests grün, Playwright `7 passed`.

- [ ] **Step 2: Screenshot-Spec schreiben**

`e2e/tests/screenshots.spec.ts`:

```ts
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { test, type Page } from '@playwright/test';
import { login } from './helpers';

/**
 * Review screenshots, not a regression test: every page at 1440 and 390 px in light and dark, from the app and –
 * with CLICKDUMMY_URL – from prototypes/clickdummy-v2 for the side-by-side comparison.
 * Output: e2e/screenshots/{app,clickdummy}/<page>-<width>-<theme>.png (git-ignored). Run: pnpm --dir e2e screenshots
 */
const VIEWPORTS = [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
];
const THEMES = ['light', 'dark'] as const;
const OUT = path.resolve(import.meta.dirname, '../screenshots');

/** `prefix` is "/en" for the app (language prefix) and "" for the clickdummy. */
type Shot = { name: string; open(page: Page, prefix: string): Promise<void> };

const go = async (page: Page, prefix: string, to: string): Promise<void> => {
    await page.goto(to === '/' ? prefix || '/' : `${prefix}${to}`);
};

const SHOTS: Shot[] = [
    { name: 'overview', open: (page, prefix) => go(page, prefix, '/') },
    { name: 'documents', open: (page, prefix) => go(page, prefix, '/documents') },
    {
        name: 'new-document',
        open: async (page, prefix) => {
            await go(page, prefix, '/documents');
            await page.keyboard.press('n');
            await page.getByRole('dialog').waitFor();
        },
    },
    { name: 'customers', open: (page, prefix) => go(page, prefix, '/customers') },
    {
        name: 'customer',
        open: async (page, prefix) => {
            await go(page, prefix, '/customers');
            await page.getByRole('link', { name: /Hafenkontor Lindqvist GmbH/ }).first().click();
            await page.getByText('Mira Albers').first().waitFor();
        },
    },
];

async function capture(page: Page, dir: string, name: string): Promise<void> {
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true });
}

for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
        test.describe(`${viewport.width} ${theme}`, () => {
            test.use({ viewport });

            test('app', async ({ page }) => {
                const dir = path.join(OUT, 'app');
                mkdirSync(dir, { recursive: true });
                await page.addInitScript((value) => window.localStorage.setItem('openbill:theme', value), theme);

                await page.goto('/en/login');
                await capture(page, dir, `login-${viewport.width}-${theme}`);
                await login(page);
                for (const shot of SHOTS) {
                    await shot.open(page, '/en');
                    await capture(page, dir, `${shot.name}-${viewport.width}-${theme}`);
                }
            });

            test('clickdummy', async ({ browser }) => {
                const base = process.env.CLICKDUMMY_URL;
                test.skip(!base, 'CLICKDUMMY_URL is not set');
                const dir = path.join(OUT, 'clickdummy');
                mkdirSync(dir, { recursive: true });
                const ui = (signedIn: boolean) => JSON.stringify({ state: { theme, signedIn, sidebarCollapsed: false, previewOpen: true, showGuides: false }, version: 0 });

                const guest = await browser.newPage({ viewport, baseURL: base });
                await guest.addInitScript((value) => window.localStorage.setItem('openbill:ui', value), ui(false));
                await guest.goto('/login');
                await capture(guest, dir, `login-${viewport.width}-${theme}`);
                await guest.close();

                const page = await browser.newPage({ viewport, baseURL: base });
                await page.addInitScript((value) => window.localStorage.setItem('openbill:ui', value), ui(true));
                for (const shot of SHOTS) {
                    await shot.open(page, '');
                    await capture(page, dir, `${shot.name}-${viewport.width}-${theme}`);
                }
                await page.close();
            });
        });
    }
}
```

- [ ] **Step 3: Klickdummy bauen und auf dem Mac ausliefern, Screenshots erzeugen**

Run:

```bash
ddev exec 'pnpm --filter openbill-clickdummy-v2 build'
ddev mutagen sync
pnpm dlx serve -s prototypes/clickdummy-v2/dist -l 4173   # im Hintergrund laufen lassen
CLICKDUMMY_URL=http://localhost:4173 pnpm --dir e2e screenshots
ls e2e/screenshots/app e2e/screenshots/clickdummy | wc -l
git status --short
```

Expected: `vite build` des Klickdummys fertig (`dist/` ist dort git-ignoriert), `serve` meldet `Serving! … http://localhost:4173`, Playwright `8 passed` (4 Kombinationen × app/clickdummy), je Verzeichnis 24 PNGs (6 Seiten × 2 Breiten × 2 Themes), `git status` ohne `dist/` und ohne Screenshots. Danach den `serve`-Prozess beenden.

- [ ] **Step 4: Vergleichen und Abweichungen beheben**

Jedes Paar `e2e/screenshots/app/<name>.png` ↔ `e2e/screenshots/clickdummy/<name>.png` ansehen (Read-Tool auf die PNGs). Prüfen: Tonwert-Ebenen (bg → surface → surface-2), Radien, Pillen, Schriftgrößen und -gewichte, Abstände, Kobalt nur für Aktion/Auswahl, Dark-Mode-Farben, mobile Topbar und einspaltige Layouts bei 390 px, keine horizontale Scrollleiste, Proportionalziffern bei Beträgen.

**Erwartete, gewollte Unterschiede** (nicht „beheben“): Navigation ohne Templates/Eigene Felder/Einstellungen; Benutzermenü-Inhalt (Sprache statt „Demo-Daten zurücksetzen“); Dokumentliste ohne Projektzeile; Login-Illustration ohne Firmen- und Positionsnamen und ohne Demo-Hinweis; andere Demo-Daten/Beträge und Datumswerte; Begrüßung je nach Uhrzeit.

Jede andere Abweichung in der betroffenen Komponente beheben, Screenshots neu erzeugen, dann je Thema committen, z. B.:

```bash
git add resources/js/components/ui/form.tsx
git commit -m "fix: match the input focus ring of the clickdummy" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Die Liste der geprüften Seiten und der bewusst gelassenen Unterschiede kommt in die PR-Beschreibung (Step 6).

- [ ] **Step 5: Identität, keine Geheimnisse, Push**

Run: `git config user.email && git status --short && git log --oneline main..HEAD`
Expected: `rafael@hauss.dev`, sauberer Arbeitsbaum (Screenshots und `dist/` ignoriert), die Commits aus Task 1–17.

Run: `git grep -nE 'openbill_[A-Za-z0-9]{20,}|BEGIN (RSA|OPENSSH) PRIVATE KEY|rafael@lulububu' -- . ':!docs/superpowers' || echo clean`
Expected: `clean`.

Run: `git push -u origin phase-05-ui-base`

- [ ] **Step 6: PR öffnen**

```bash
gh pr create --base main --head phase-05-ui-base --title "feat: phase 5 UI base" --body "$(cat <<'EOF'
## Phase 5: UI base

Plan: `docs/superpowers/plans/2026-10-11-phase-05-ui-base.md`

- Tailwind 4 tokens of "Graphit & Kobalt" with dark mode (`data-theme`, set before the first paint), Schibsted Grotesk via Fontsource, proportional figures
- Own component set in `resources/js/components/ui` (port of the clickdummy): buttons, fields, badges, tabs/pills, cards, states, dialog/drawer and menu on Radix, toasts
- `lib/api.ts`: session + CSRF, `Accept-Language`, Problem Details as `ApiError` (field errors from `violations`), CSRF renewal on 419, login on 401; SWR provider, keys and hooks with "load more"
- App shell: collapsible sidebar, mobile drawer, account menu (theme, language, log out), "New document" dialog on button and key N
- Pages: overview (figures, attention, recently edited – computed server-side), documents (filters in the URL incl. `overdue`, month groups, counts and sum), document summary page (editor follows in phase 6), customers list and detail (master data, tax treatment, custom fields, contacts drawer, documents; saved over the REST API), login
- Server: `App\Support\DocumentQuery` (shared by API and page, new status filter `overdue`), `App\Support\Overview`, shared prop `org`
- Deferred items: German Laravel validation messages (phase-2 minor #13), `SaveCustomer` trims master data (phase-4 minor TrimStrings)
- Docs: `documents` (UI), `api` (overdue filter), `development` (Vitest, Playwright) in en and de; CLAUDE.md

## Tests

- Pest: Inertia props of every page, `DocumentQuery`, `Overview`, German validation, trimming, e2e seeder
- Vitest: `lib/api.ts`, formatting, theme, toasts, keys, navigation, customer helpers (CI step `Vitest`)
- Playwright (`e2e/`, run locally against DDEV): login/logout, wrong password, German UI, key N, create customer with contact, API validation at the field, unsaved-changes guard

## Screenshots

Compared at 1440 and 390 px, light and dark, against `prototypes/clickdummy-v2` (`pnpm --dir e2e screenshots`). Intended differences: navigation without templates/fields/settings (phase 7), account menu with language instead of the demo reset, no project line in the document list, login illustration without names.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: URL des PRs (`https://github.com/baeroe/openbill/pull/<n>`). Weicht die Liste der gelassenen Unterschiede nach Step 4 ab, den Abschnitt „Screenshots“ vorher anpassen.

- [ ] **Step 7: CI abwarten, nicht mergen**

Run: `gh pr checks --watch`
Expected: `tests` ✓ (inkl. neuem Schritt `Vitest`; der Job `einvoice` ist kein Pflicht-Check). Schlägt `tests` fehl: `gh run view --log-failed`, Ursache beheben, mit Co-Authored-By-Zeile committen, pushen und erneut warten. **Nicht mergen** – das macht der Orchestrator nach dem Review.

---

## Abdeckung (Self-Review)

| Anforderung (Master-Plan Phase 5 / Spec 8 / Auftrag) | Task |
|---|---|
| Tailwind-Tokens vollständig aus DESIGN.md, hell/dunkel über `data-theme` | 2 |
| Schibsted Grotesk (Fontsource), Proportionalziffern | 2 |
| Komponenten: Button, Inputs, Select, Checkbox, Switch, Badge/StatusBadge, Tabs, Dialog/Drawer (Radix), Menu (Radix DropdownMenu), Toaster, Skeleton/Empty/Error, PageHeader | 6, 7 |
| `lib/api.ts` (CSRF, Session, Problem Details) + Vitest | 4 |
| SWR-Konfiguration (Provider, Fetcher, Keys, Hooks) | 5 |
| AppShell: Sidebar, Einklappen, mobil, Benutzermenü nach oben, Theme, Abmelden | 9 |
| Übersicht (Kennzahlen, Aufmerksamkeit, zuletzt bearbeitet) | 8, 10 |
| Dokumente (Filter in URL, Gruppierung nach Monat) | 8, 11 |
| Dialog „Neues Dokument“ (Taste N) | 9 |
| Kunden Liste/Detail (Stammdaten, Steuerbehandlung, eigene Felder, Ansprechpartner-Drawer, Dokumente; Speichern über API) | 12, 13 |
| Login im neuen Design | 14 |
| Leere, Fehler- und Ladezustände | 6 (Komponenten), 10–14 (je Seite) |
| Pest-Inertia-Tests je Seite (Props) | 8, 10, 11, 12, 13 |
| Playwright-Grundgerüst `e2e/` (Login, Kunden) gegen DDEV, eigener Install-Weg | 15 |
| Doku `documents` (UI) en/de, CLAUDE.md | 16 |
| Phase-2-Minor #13 (deutsche Validierungstexte), Phase-4-Minor TrimStrings | 1 |
| Screenshots 1440/390 hell/dunkel gegen Klickdummy, Push, PR, CI | 17 |
| Haken Phase 4 im Master-Plan | mit diesem Plan committet |
| Schnittstellen für Phase 6/7 (Komponenten, Hooks, Layout-Slots) | Abschnitt „Interfaces“ |
