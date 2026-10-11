# Phase 6: Dokument-Editor – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Seite `/{locale}/documents/{id}` wird zum Dokument-Editor aus dem Klickdummy v2: Entwurf in einem Zustand-Store, Autosave per SWR-Mutation auf `PATCH /api/documents/{id}`, seitenweise Live-Vorschau über `POST /api/render` mit dem neuen Workspace-Paket `packages/paged-preview`, Gruppen und Positionen mit @dnd-kit, Summen und Prüfanzeige ausschließlich aus Serverantworten, alle Dokument-Aktionen (Abschließen, Status, Umwandeln, Storno, Duplizieren, Löschen mit Undo, PDF/XML), Kette, E-Rechnungs-Tab und Read-only für abgeschlossene Dokumente – abgesichert mit Vitest, Pest und einem Playwright-Hauptablauf.

**Architecture:** Der Browser rechnet nichts: Er hält den Entwurf (Zustand-Store, reine Operationen), schickt ihn entprellt an `PATCH /api/documents/{id}` (600 ms) und an `POST /api/render` (250 ms, veraltete Anfragen werden abgebrochen) und zeigt Summen, Zeilen-/Gruppensummen, Prüfergebnis und HTML aus der Render-Antwort. Seitenkontext, den nur der Server entscheiden kann (Prüfprofil, nächste Nummer, erlaubte Statuswechsel und Umwandlungen, Kette, Kleinunternehmer, Templates je Dokumenttyp), kommt als Inertia-Prop `context` aus der lesenden Action `App\Actions\DescribeDocumentPage`; Stammdaten (Steuersätze, Einheiten, Textbausteine, Felddefinitionen, Kunden, Vorschläge) lädt die Seite per SWR aus `/api`. `packages/paged-preview` ist ein TS/React-Paket ohne Tailwind (eigenes CSS), das die drei HTML-Teile in Iframes ohne Skriptrechte seitenweise anordnet und von App und später Toolkit (Phase 9) und Template-Editor (Phase 7) genutzt wird.

**Tech Stack:** Laravel 13, Inertia v3 (`@inertiajs/react` 3.9), React 19, TypeScript 7, Tailwind 4, Vite 8, SWR 2 (`swr`, `swr/mutation`), Zustand 5, @dnd-kit (`core` 6, `sortable` 10, `utilities` 3), lucide-react, Vitest 5, Pest 5, Playwright (`e2e/`).

**Spec:** `docs/superpowers/specs/2026-10-11-openbill-app-design.md` (bindend, v. a. Abschnitt 5 „Render-Endpunkt“/„Seitenumbruch“ und 8 „UI/Editor“, dazu 2 „Rechenlogik nur in PHP“), Master-Plan `docs/superpowers/plans/2026-10-11-openbill-app.md` (Abschnitt „Phase 6“), Gestaltung `prototypes/clickdummy-v2/DESIGN.md`, Schnittstellen aus `docs/superpowers/plans/2026-10-11-phase-04-api.md` und `…-phase-05-ui-base.md` (jeweils „Interfaces“). **Vorlagen:** `prototypes/clickdummy-v2/src/routes/documents/DocumentEditorPage.tsx`, `src/routes/documents/editor/*` (GroupsEditor, PositionRow, TitleAutocomplete, HeaderFields, TextsSection, TotalsPanel, CompliancePanel, ChainBar, PreviewPane, EditorHeader, ops.ts, useDraft.ts, jump.ts, editor.css), `src/components/PagedPreview.tsx` + `.css`, `src/domain/paper.ts` (+ `paper.test.ts`). Im Klickdummy rechnete der Browser Summen, Prüfung, Nummer, erlaubte Aktionen, Liquid und XML – **in der App kommt all das vom Server**.

## Global Constraints

- Branch `phase-06-editor` (ist ausgecheckt). Git-Identität kommt aus `~/.gitconfig`; vor dem ersten Commit `git config user.email` → muss `rafael@hauss.dev` sein, sonst stoppen und nachfragen. Nie `user.email`/`user.name` setzen.
- Jede Commit-Message endet mit der Zeile `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (in diesem Plan als zweites `-m`); die PR-Beschreibung endet mit `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- PHP, Composer, Artisan **nur in DDEV** (`ddev artisan …`, `ddev exec …`). JS-Pakete nur mit pnpm **im Container** (`ddev exec pnpm …`; Root-Abhängigkeiten mit `-w`, Pakete mit `--filter`), nie npm/npx. Ausnahme: `e2e/` läuft und installiert auf dem Mac (`pnpm --dir e2e …`), dort keine App-Abhängigkeiten.
- Vor jedem Commit: `ddev exec vendor/bin/pint` (bei PHP), `ddev exec pnpm typecheck` und `ddev exec pnpm test` (bei TS). Code-Blöcke in diesem Plan sind inhaltlich verbindlich; Formatierung nach vorhandenem Stil (4 Leerzeichen, einfache Quotes, Semikolons; Pint für PHP).
- **Keine Rechenlogik im Frontend** (Abnahme Phase 6): keine Summen, Steuern, Rundungen, Nummern, Prüfregeln, Status-/Umwandlungsregeln im Browser. Beträge bleiben Strings und werden nur mit `formatMoney()` formatiert. Erlaubt sind reine Formatierung, Formatprüfung einer getippten Zahl (`"12,5"` → `"12.5"`) und Datenstruktur-Operationen (Gruppen/Positionen verschieben).
- **Keine Geschäftslogik in Controllern** (`tests/Unit/ArchTest.php`). Der Web-Controller ruft die lesende Action `App\Actions\DescribeDocumentPage` und rendert die Inertia-Seite; geschrieben wird nur über `/api` → Actions.
- UI-Texte nur über Schlüssel in `lang/en.json` **und** `lang/de.json` (gleiche Schlüssel, flach, alphabetisch einsortiert, Platzhalter `:name`, Plural `.one`/`.other`). React `t()`/`tn()`/`path()` aus `resources/js/lib/i18n.ts`. Admin-URLs nur über `path('/…')`. Code und Kommentare Englisch, deutsche Texte in Du-Form. `tests/Unit/TranslationsTest.php` findet Schlüssel nur in `t('…')`/`tn('…')` mit Literal und nur bis drei Ordner tief unter `resources/js` – Dateien deshalb höchstens `resources/js/<a>/<b>/<c>/datei.tsx`.
- Gestaltung nach `prototypes/clickdummy-v2/DESIGN.md` und den Tokens in `resources/css/app.css` (`bg-surface-2`, `text-muted`, `shadow-float`, `rounded-lg`, `h-control`, `num`, Breakpoints `xs/sm/md/lg`). Keine shadcn-Defaults, Radix nur Dialog/Menü. Zwei Tailwind-Klassen für dieselbe CSS-Eigenschaft sind verboten (kein tailwind-merge). Was sich mit Utilities nicht sauber ausdrücken lässt (Positionsraster mit Container-Queries und `grid-template-areas`, Sprung-Aufleuchten, Vorschau-Variablen), steht in `resources/css/editor.css` (`@layer components`, nur Tokens).
- `packages/paged-preview` hat **keine** Tailwind- und keine App-Abhängigkeit (kein `@/…`, kein `t()`); Texte kommen über die Prop `labels`, Farben über CSS-Variablen `--pp-*` mit Standardwerten.
- Demo- und Testdaten nur fiktiv (Studio Nordlicht, Hafenkontor Lindqvist, Fjord Analytics, Hotel Alpenglück, Kulturwerk Elbinsel; `@example.com`). Auch in Screenshots keine echten Firmen, Hosts oder Personen.
- CI: Pflicht-Job heißt `tests` und muss grün sein; Name nie ändern. Neue Prüfungen (Vitest des Pakets) dort anhängen.
- Doku: VitePress-Seite `documents` (Abschnitt „In der App → Dokument-Editor“) in `docs/en/` **und** `docs/de/` im selben PR; `CLAUDE.md` aktualisieren.
- Der Haken für Phase 5 im Abschnitt „Fortschritt“ des Master-Plans ist mit diesem Plan committet. Den Haken für Phase 6 setzt der Orchestrator nach dem Merge, nicht der Umsetzer.

## Review Focus

- **Tippen während ein Autosave unterwegs ist, neue Positionen ohne Server-ID:** Änderungen, die während eines laufenden `PATCH` entstehen, gehen nie verloren (zweiter Save direkt danach), neue Gruppen/Positionen bekommen nach dem Speichern die ULIDs des Servers, ohne doppelt zu entstehen, ohne Fokusverlust (stabile React-Keys) und ohne dass ein Sprung-Pfad ins Leere zeigt; ein langsamer alter Save überschreibt nie einen neueren lokalen Stand. → Task 5 (`ops.test.ts`: `reconcileIds`), Task 7 (`autosave.test.ts`: Änderung während des Speicherns, Reihenfolge), Task 14 (Playwright: Position anlegen, sofort weitertippen, neu laden).
- **Dokument wird woanders abgeschlossen oder gelöscht (API, MCP, zweiter Tab):** Autosave bekommt 409/404, hört auf zu speichern und zu wiederholen, der Editor zeigt einen Hinweis und lädt den Serverstand (abgeschlossen → read-only); keine Endlosschleife von Fehlertoasts. Netzwerk-/5xx-Fehler werden mit wachsendem Abstand wiederholt und lassen sich per Knopf sofort wiederholen; 422 markiert die Felder und wiederholt nicht. → Task 7 (`autosave.test.ts`), Task 6 (`paths.test.ts`: API-Pfade → Feld), Task 14 (Playwright: per API abschließen, während der Editor offen ist).
- **Veraltete Vorschau-Antworten:** Eine langsame ältere `POST /api/render`-Antwort darf nie eine neuere Vorschau, neuere Summen oder ein neueres Prüfergebnis überschreiben; abgebrochene Anfragen erscheinen nicht als Fehler; ein Template-Fehler zeigt Bereich/Datei/Zeile statt einer leeren Vorschau. → Task 9 (`latest.test.ts`), Task 14 (Playwright: Summe nach schnellem Tippen stimmt mit dem gespeicherten Dokument überein).
- **Ungewöhnliche Eingaben in Zahlenfeldern:** `"1,5"`, `"1.234,50"` (de), `"-2"` (Storno), `""`, `"abc"`, `"1e3"`, mehr als 4 Nachkommastellen – gültige Werte werden als String mit Punkt gespeichert, ungültige markieren das Feld lokal und werden nicht gesendet; Serverfehler (`groups.0.positions.1.quantity`) landen an genau dieser Zeile. → Task 6 (`decimal.test.ts`, `paths.test.ts`).
- **Seite verlassen mit ungespeicherten Änderungen:** Navigation über Sidebar/Links/Zurück-Link speichert vorher (kein Verlust, kein Dialog), Schließen/Neuladen des Tabs schickt den Stand per `fetch(…, { keepalive: true })`; „Entwurf löschen“ speichert nichts mehr nach und lässt sich per Undo zurücknehmen, bis der Toast verschwindet. → Task 7 (`autosave.test.ts`: `flushKeepalive`, `dispose`), Task 12 (`pending-delete.test.ts`, `toast.test.ts`), Task 14 (Playwright: tippen und sofort wegnavigieren; löschen und rückgängig).

## Entscheidungen (geprüft am 2026-10-11)

| Thema | Entscheidung | Grund / Prüfung |
|---|---|---|
| Summen/Prüfung im Editor | Quelle ist die **letzte Render-Antwort** (`POST /api/render` mit `document_id` + `draft` = kompletter lokaler Stand). Bis sie da ist, gelten `totals`/`issues` aus `GET /api/documents/{id}`. Die PATCH-Antwort dient nur dem Abgleich (IDs, Serverstand) | `RenderPreview` rechnet über `DraftOverlay` mit den **lokalen** IDs (`DraftOverlay` übernimmt jede String-ID), die PATCH-Antwort mit Server-IDs (`GroupWriter` behält nur eigene IDs). So passen `totals.lines[<id>]`, `totals.groups[<id>]` und Issue-Pfade `positions.<id>.…` immer zum angezeigten Stand. |
| Neue Gruppen/Positionen | Lokale IDs `local-<uuid>`; nach jedem Save ersetzt `reconcileIds()` sie per Index (Antwort hat dieselbe Reihenfolge wie der gesendete Stand) durch die ULIDs aus der Antwort. React-Keys bleiben über `aliases` (Server-ID → ursprüngliche lokale ID) stabil | `GroupWriter::replace()` vergibt neue ULIDs für alles, was nicht dem Dokument gehört; ohne Abgleich würde jeder Save alle neuen Positionen neu anlegen und die Pfade ändern. |
| Autosave | Reine Klasse `Autosave` (`resources/js/editor/autosave.ts`, Vitest mit Fake-Timern), im Hook über `useSWRMutation(keys.document(id), …, { populateCache: true, revalidate: false })`. 600 ms Entprellung, immer nur ein PATCH gleichzeitig, Folgesave direkt danach. Fehler: 422 → `invalid` (Feldfehler, kein Retry), 409 → `locked`, 404 → `gone`, sonst `error` mit Retry nach 2/5/15/30 s | Spec 8: „Autosave per SWR“; testbar ohne DOM; Retries ohne Toast-Flut. |
| Serverstand übernehmen | Der Store übernimmt `GET /api/documents/{id}` nur, wenn lokal nichts offen ist (`saveState` ∈ `saved`/`locked`/`gone`) und sich der Serverstand inhaltlich vom zuletzt gesehenen unterscheidet (`samePayload`), oder wenn sich `is_locked` geändert hat | Änderungen über API/MCP oder einen zweiten Tab erscheinen nach Fokuswechsel (SWR revalidiert), ohne Tippen zu überschreiben. `updated_at` reicht nicht: Gruppen/Positionen berühren es nicht. |
| Konflikt zweier Tabs | Kein Sperrprotokoll (kein ETag in der API); letzter Save gewinnt. Abgeschlossen/gelöscht wird erkannt (409/404) | API aus Phase 4 hat keine Versionen; YAGNI. In der Doku erwähnt. |
| Verlassen | `router.on('before')` und Unmount rufen `flush()` (läuft im Hintergrund weiter, die SPA bleibt geladen); `pagehide` schickt `saveDraft(…, { keepalive: true })` | Kein Nachfrage-Dialog nötig, weil gespeichert wird. `keepalive` hat 64 KB Body-Limit; Dokumente bis ~200 Positionen passen. |
| Vorschau | `useSWR(['/api/render', bodyJson])` mit `useDebounced(bodyJson, 250)` und einem „latest only“-Fetcher (`createLatest`: neue Anfrage bricht die vorige per `AbortController` ab); `keepPreviousData` zeigt bis zur neuen Antwort die alte Vorschau | Spec 5: „SWR (250 ms Verzögerung, Abbruch veralteter Anfragen)“. |
| Inertia-Props | `documents/show` bekommt `document_id` (bleibt) und `context` (`DescribeDocumentPage::handle()`): `profile`, `next_number`, `small_business`, `chain`, `templates`, `allowed` (`finalize`, `delete`, `duplicate`, `statuses`, `conversions`, `cancel`). Nach jeder Aktion `router.reload({ only: ['context'] })` | Regeln (StatusMachine, DocumentConverter, Nummernvorschau, Snapshot-Besteuerung) sind PHP; die Template-Liste der API (`template:list`) enthält kein Manifest. Pest prüft die Props. |
| Stammdaten | SWR aus `/api`: `/api/tax-rates?include_archived=1`, `/api/units?include_archived=1`, `/api/text-blocks`, `/api/field-definitions?scope=document|position`, `/api/customers?itemsPerPage=100` (Kundenauswahl), `/api/customers/{id}` (Ansprechpartner), `/api/position-suggestions?q=…&limit=6` | Archivierte Sätze/Einheiten müssen in alten Entwürfen und abgeschlossenen Dokumenten lesbar bleiben; zur Auswahl stehen nur aktive (plus der aktuell gewählte). |
| Kundenauswahl | `<select>` mit den ersten 100 Kunden (nach Name) plus dem aktuellen Kunden, falls er nicht dabei ist | Wie im Klickdummy; eine Suche im Feld folgt bei Bedarf in Phase 11. |
| Vorschläge | Server-Suche `q` (150 ms entprellt, 6 Treffer), Auswahl übernimmt Titel, Beschreibung, Preis, Einheit und Satz (nur wenn noch aktiv) | `GET /api/position-suggestions` existiert (Phase 4). |
| Löschen mit Undo | **Verzögertes Löschen:** „Entwurf löschen“ stoppt den Autosave, navigiert zur Liste und zeigt einen Toast mit „Rückgängig“; erst wenn der Toast ohne Undo verschwindet (Zeitablauf, Schließen, verdrängt) läuft `DELETE`. `pagehide` schickt offene Löschungen per `keepalive`. Die Dokumentliste blendet vorgemerkte IDs aus | Die API hat kein Wiederherstellen und `DeleteDraft` löscht hart; ein Neuanlegen per `POST` ginge für Stornos nicht und bekäme eine neue ID. `lib/toast.ts` bekommt dafür `onExpire`. |
| E-Rechnungs-Tab | Nur bei Profil `en16931`. Abgeschlossen: XML aus `GET /api/documents/{id}/xml` (Kopieren, Herunterladen). Entwurf: Hinweis, dass die XML beim Abschließen entsteht, plus Prüfanzeige-Zustand | Es gibt keinen Endpunkt für Entwurfs-XML (`DocumentXml` liefert nur Archivdateien); der Klickdummy erzeugte sie im Browser. Kein neuer Endpunkt in dieser Phase. |
| PDF | Link `GET /api/documents/{id}/pdf?inline=1` in neuem Tab; bei offenen Änderungen erst `flush()`, dann `window.open` | Entwurf rendert live mit Wasserzeichen, abgeschlossen liefert die Archivdatei (Phase 3/4). |
| Prüfanzeige-Links | `positions.*`, `document.*`, `groups.*` springen zum Feld (`data-path`); `customer.*`/`contact.*` verlinken auf `/{locale}/customers/{id}`; `org.*` zeigt nur den Text „Einstellungen der Organisation“ ohne Link | Einstellungen gibt es erst in Phase 7 (kein Link auf 404). |
| Template-Hinweis „erwartete Felder“ | entfällt in Phase 6 | Phase 7 baut Felder und Template-Editor; Hinweis gehört dorthin. |
| Zahlen-Eingabe | Anzeige ohne Tausendertrennung im Gebietsschema (`1234,5` de, `1234.5` en), Commit beim Verlassen/Enter über `parseDecimalInput()`; leer → `"0"` | `toDecimalString()` würde `"1,234.5"` (en mit Gruppierung) falsch lesen. |
| Layout | Editor nutzt `<Page wide>` nicht: eigenes Raster wie `.ed` im Klickdummy (Formular links, Vorschau rechts ab 1200 px, sticky), Vorschau-Schalter in `localStorage` (`openbill:editor-preview`, `openbill:editor-guides`) über `useStoredFlag` | Klickdummy `editor.css`; `main` hat `overflow-clip` (kein Scroll-Container), `position: sticky` funktioniert. |
| Überschrift | `"<Typ> <Nummer>"` bzw. `"<Typ> (draft)"` wie bisher (`overview.draft_label`) | `e2e/tests/documents.spec.ts` erwartet `Invoice (draft)`. |
| Paket-Einbindung | `@openbill/paged-preview` als `workspace:*`-Abhängigkeit der Root-App; das Paket exportiert TS-Quellen (`exports: { ".": "./src/index.ts" }`), kein eigener Build; die Komponente importiert ihr CSS selbst | Vite (App, Phase-9-Kit) kompiliert TS direkt; Phase 10 bündelt beim Docker-Build. |

---

## Dateistruktur nach Phase 6

```
packages/paged-preview/
├─ package.json                 @openbill/paged-preview (privat, TS-Quellen, peer react 19)
├─ tsconfig.json, vitest.config.ts
└─ src/
   ├─ index.ts                  öffentliche Exporte (siehe Interfaces)
   ├─ geometry.ts (+ .test.ts)  toPx, pageGeometry, computePageBreaks
   ├─ paged-preview.tsx         <PagedPreview>
   └─ paged-preview.css         .pp-* Klassen, Variablen --pp-*
app/
├─ Actions/DescribeDocumentPage.php          Seitenkontext des Editors (Profil, Nummer, erlaubte Aktionen, …)
├─ Http/Controllers/DocumentController.php   show(): document_id + context
└─ Support/DocumentChain.php                 Kette über source_id (Wurzel + Nachfahren)
resources/
├─ css/app.css                  @import './editor.css'
├─ css/editor.css               Positionsraster, Sprung-Aufleuchten, --pp-* aus Tokens
└─ js/
   ├─ api/types.ts              + DocumentDetail, ApiGroup/ApiPosition, Totals, Issue, RenderResponse, TaxRate, Unit, TextBlock, PositionSuggestion, DocumentPageContext
   ├─ api/keys.ts (+ test)      + taxRates, units, textBlocks, customerChoices, suggestions, xml
   ├─ api/documents.ts          + saveDraft, renderPreview, finalize/status/convert/cancel/duplicate/delete, fetchXml
   ├─ api/master-data.ts        useTaxRates, useUnits, useTextBlocks, useCustomerChoices, usePositionSuggestions
   ├─ lib/api.ts (+ test)       + keepalive, apiText
   ├─ lib/toast.ts (+ test)     + onExpire
   ├─ lib/pending-delete.ts (+ test)   verzögertes Löschen mit Undo
   ├─ editor/
   │  ├─ types.ts               Draft, DraftPayload, IdMap
   │  ├─ ops.ts (+ test)        reine Gruppen-/Positions-Operationen, fromDocument, toPayload, reconcileIds, samePayload
   │  ├─ decimal.ts (+ test)    parseDecimalInput, formatDecimalInput
   │  ├─ paths.ts (+ test)      violationPath, fieldErrors, issuePaths
   │  ├─ jump.ts                jumpTo(path)
   │  ├─ store.ts (+ test)      Zustand-Store useEditor
   │  ├─ autosave.ts (+ test)   Klasse Autosave
   │  ├─ latest.ts (+ test)     createLatest (Abbruch veralteter Anfragen)
   │  ├─ use-autosave.ts        Hook: Store ↔ Autosave ↔ SWR-Mutation, Verlassen
   │  ├─ use-preview.ts         Hook: SWR POST /api/render (250 ms)
   │  ├─ use-actions.ts         Hook: Abschließen, Status, Umwandeln, Storno, Duplizieren, Löschen, PDF
   │  └─ components/
   │     ├─ editor.tsx           Editor (Layout, Verdrahtung)
   │     ├─ editor-header.tsx, editor-actions.tsx, chain-bar.tsx, read-only-notice.tsx
   │     ├─ header-fields.tsx, texts-section.tsx
   │     ├─ groups-editor.tsx, position-row.tsx, title-autocomplete.tsx, decimal-cell.tsx
   │     ├─ totals-panel.tsx, compliance-panel.tsx
   │     ├─ preview-pane.tsx, xml-view.tsx
   │     └─ editor-skeleton.tsx
   └─ pages/documents/show.tsx  Editor-Seite (ersetzt die Platzhalterseite)
tests/Feature/Pages/DocumentPagesTest.php    + Props des Editors
tests/Feature/Actions/DescribeDocumentPageTest.php, tests/Feature/Support/DocumentChainTest.php
e2e/tests/editor.spec.ts (Hauptablauf), editor-details.spec.ts, screenshots.spec.ts (+ editor)
docs/{en,de}/documents.md       Abschnitt „Dokument-Editor“
```

## Interfaces

**`packages/paged-preview` (verbindlich für Phase 7 und 9)** – Import `@openbill/paged-preview`:

```ts
/** The three standalone HTML documents of POST /api/render (header, body, footer). */
export type RenderedParts = { header: string; body: string; footer: string };

/** Paper of the template manifest = `paper` of POST /api/render ("20mm", "1in", …). */
export type Paper = { format: 'A4' | 'Letter' | (string & {}); marginX: string; headerHeight: string; footerHeight: string };

export type Zone = 'header' | 'body' | 'footer';

/** Visible and accessible texts; English defaults, the app passes translations. */
export type PagedPreviewLabels = {
    document: string;           // "Document preview" – aria-label of the whole preview
    page(n: number): string;    // "Page 2" – title of the body frame of page n > 1
    header: string;             // "Header"
    body: string;               // "Content"
    footer: string;             // "Footer"
};

export type PagedPreviewProps = {
    parts: RenderedParts;
    paper: Paper;
    /** Dashed outlines + side labels for header, content, footer on every page. */
    showGuides?: boolean;
    /** One zone emphasized (template editor, phase 7); implies its guide. */
    highlight?: Zone | null;
    /** Only the first n pages (gallery thumbnails). */
    maxPages?: number;
    /** Clip the scaled stack to this height in px. */
    maxHeight?: number;
    onPageCount?(count: number): void;
    className?: string;
    labels?: Partial<PagedPreviewLabels>;
};

export function PagedPreview(props: PagedPreviewProps): JSX.Element;

export type Block = { top: number; bottom: number };
export type PageGeometry = { width: number; height: number; marginX: number; headerHeight: number; footerHeight: number; contentWidth: number; contentHeight: number };
export function toPx(value: string): number;                       // CSS length at 96 dpi (mm, cm, in, pt, px); invalid → 0
export function pageGeometry(paper: Paper): PageGeometry;           // A4/Letter (unknown → A4), like App\Rendering\Paper::FORMATS
export function computePageBreaks(blocks: Block[], totalHeight: number, pageContentHeight: number): number[]; // start offset of every page
export const DEFAULT_LABELS: PagedPreviewLabels;
```

CSS-Variablen (auf `.pp` oder einem Vorfahren setzbar): `--pp-paper-shadow`, `--pp-accent`, `--pp-accent-soft`, `--pp-accent-soft-hover`, `--pp-page-gap` ist fest 28 px (Konstante `PAGE_GAP`). Iframes: `sandbox="allow-same-origin"` (kein Skript; nötig, um Seitenzahlen einzusetzen und zu messen), `.pageNumber`/`.totalPages` werden je Seite gefüllt.

**Inertia-Seite `documents/show`** (Props, Pest-geprüft):

```ts
type DocumentPageProps = { document_id: string; context: DocumentPageContext };
type DocumentPageContext = {
    profile: 'basic' | 'en16931';
    next_number: string | null;          // drafts: AllocateDocumentNumber::preview(type, date); else null
    small_business: boolean;             // draft: current organization; finalized: snapshot
    chain: { id: string; type: DocumentType; status: DocumentStatus; number: string | null }[]; // [] when alone
    templates: { id: string; name: string; document_types: DocumentType[] }[];               // all, by name
    allowed: { finalize: boolean; delete: boolean; duplicate: boolean; statuses: DocumentStatus[]; conversions: DocumentType[]; cancel: boolean };
};
```

PHP: `App\Actions\DescribeDocumentPage::handle(Actor $actor, Document $document): array` (lesende Action wie `DescribeRenderSchema`, weil `ArchTest` `App\Support` → `App\Actions` verbietet; nutzt `AllocateDocumentNumber::preview`, `DocumentInspector::sources`, `StatusMachine`, `DocumentConverter`, `DocumentChain`), `App\Support\DocumentChain::for(Document $document): array` (`list<array{id: string, type: string, status: string, number: string|null}>`).

**Editor-Kern (`resources/js/editor`)**

```ts
// types.ts
export type Draft = Pick<DocumentDetail, 'id' | 'type' | 'status' | 'date' | 'customer_id' | 'contact_id' | 'service_date' | 'service_date_end'
    | 'due_date' | 'valid_until' | 'intro' | 'closing' | 'template_id' | 'locale' | 'custom' | 'groups'>;
export type DraftPayload = Omit<Draft, 'id' | 'type' | 'status'>;   // body of PATCH /api/documents/{id} and of render "draft"
export type IdMap = Record<string, string>;                         // local id → server ULID

// ops.ts (pure, Vitest)
export const LOCAL_PREFIX = 'local-';
export function localId(): string;
export function isLocalId(id: string): boolean;
export type PositionDefaults = { unitId: string | null; taxRateId: string | null; custom: CustomValues };
export function newPosition(kind: PositionKind, defaults: PositionDefaults): ApiPosition;
export function fromDocument(document: DocumentDetail): Draft;
export function toPayload(draft: Draft): DraftPayload;
export function samePayload(a: DraftPayload | null, b: DraftPayload | null): boolean;
export function addPosition(draft: Draft, groupId: string, position: ApiPosition, afterId?: string): Draft;
export function updatePosition(draft: Draft, id: string, patch: Partial<ApiPosition>): Draft;
export function setPositionKind(draft: Draft, id: string, kind: PositionKind, defaults: PositionDefaults): Draft;
export function removePosition(draft: Draft, id: string): { draft: Draft; position: ApiPosition | null; groupId: string | null; index: number };
export function restorePosition(draft: Draft, groupId: string, position: ApiPosition, index: number): Draft;
export function addGroup(draft: Draft, title: string | null, first: ApiPosition, atStart?: boolean): Draft;
export function updateGroup(draft: Draft, id: string, patch: Partial<Pick<ApiGroup, 'title'>>): Draft;
export function removeGroup(draft: Draft, id: string): { draft: Draft; group: ApiGroup | null; index: number };
export function restoreGroup(draft: Draft, group: ApiGroup, index: number): Draft;
export function dissolveGroup(draft: Draft, id: string): Draft;
export function moveGroup(draft: Draft, from: number, to: number): Draft;
export function movePosition(draft: Draft, positionId: string, toGroupId: string, toIndex: number): Draft;
export function groupOf(draft: Draft, positionId: string): ApiGroup | undefined;
export function appendText(current: string, block: string): string;
export function idMap(sent: DraftPayload, saved: ApiGroup[]): IdMap;
export function reconcileIds(draft: Draft, map: IdMap): Draft;

// decimal.ts
export function parseDecimalInput(raw: string, scale?: number): string | 'invalid';   // "" → "0"
export function formatDecimalInput(value: string, locale?: string, minFraction?: number): string;
export function isZeroDecimal(value: string): boolean;

// paths.ts
export function violationPath(draft: Draft, apiPath: string): string;      // "groups.0.positions.1.unit_id" → "positions.<id>.unit"
export function fieldErrors(draft: Draft, violations: Violation[]): Record<string, string>;
export function issuePaths(issues: Issue[]): Set<string>;

// jump.ts
export function jumpTo(path: string): boolean;
export function jumpToIssue(path: string, expand: () => void): void;

// store.ts (Zustand)
export type SaveState = 'saved' | 'dirty' | 'saving' | 'error' | 'invalid' | 'locked' | 'gone';
export type EditorState = {
    draft: Draft | null;
    revision: number;                      // +1 on every local change
    synced: DraftPayload | null;           // last server state seen (GET or PATCH answer)
    saveState: SaveState;
    saveError: unknown;
    errors: Record<string, string>;        // data-path → message (422 of PATCH or render)
    collapsed: string[];                   // collapsed group ids
    aliases: Record<string, string>;       // server id → local id it replaced (stable React keys across saves)
    load(document: DocumentDetail): void;
    update(fn: (draft: Draft) => Draft): void;   // no-op unless draft.status === 'draft' and saveState not locked/gone
    applySaved(sent: DraftPayload, saved: DocumentDetail): void;
    setSave(state: SaveState, error?: unknown): void;
    setErrors(errors: Record<string, string>): void;
    toggleGroup(id: string): void;
    expandAll(): void;
    reset(): void;
};
export const useEditor: UseBoundStore<StoreApi<EditorState>>;

// autosave.ts
export type AutosaveOptions = {
    delay?: number;                                        // 600
    retryDelays?: number[];                                // [2000, 5000, 15000, 30000]
    revision(): number;
    payload(): DraftPayload | null;
    save(payload: DraftPayload): Promise<DocumentDetail>;
    onSaved(sent: DraftPayload, saved: DocumentDetail): void;
    onState(state: SaveState, error?: unknown, sent?: DraftPayload): void;
};
export class Autosave {
    constructor(options: AutosaveOptions);
    get state(): SaveState;
    get pending(): boolean;                                // unsaved revision or save in flight
    changed(): void;
    flush(): Promise<void>;
    retry(): Promise<void>;                                // attempt counter back to 0, save now
    flushKeepalive(send: (payload: DraftPayload) => void): void;
    reset(): void;                                         // current revision counts as saved (after load)
    stop(): void;                                          // no saves anymore (delete); timers cleared
}

// latest.ts
export function createLatest<A, R>(run: (arg: A, signal: AbortSignal) => Promise<R>): (arg: A) => Promise<R>;
export function isAbort(error: unknown): boolean;

// use-autosave.ts / use-preview.ts / use-actions.ts
export function useAutosave(id: string, document: DocumentDetail | undefined): { flush(): Promise<void>; retry(): void; stop(): void };
export function useRenderPreview(id: string, draft: Draft | null): { data: RenderResponse | undefined; error: unknown; isValidating: boolean };
export function useDocumentActions(args: { document: DocumentDetail; issues: Issue[]; flush(): Promise<void>; stop(): void; expand(): void }): DocumentActions;
export type DocumentActions = {
    pending: 'finalize' | 'status' | 'convert' | 'cancel' | 'duplicate' | null;
    finalizeOpen: boolean;
    cancelOpen: boolean;
    startFinalize(): Promise<void>;     // issues → toast + jump; else flush, reload context, open dialog
    confirmFinalize(): Promise<void>;
    closeFinalize(): void;
    setStatus(status: DocumentStatus): Promise<void>;
    convert(type: DocumentType): Promise<void>;
    openCancel(): void;
    confirmCancel(): Promise<void>;
    closeCancel(): void;
    duplicate(): Promise<void>;
    remove(): void;                     // delete with undo (Task 12)
    openPdf(): Promise<void>;
};
```

**API-Ergänzungen (`resources/js/api`, `resources/js/lib`)**

```ts
// lib/api.ts
export type ApiOptions = { method?: …; body?: unknown; signal?: AbortSignal; format?: 'json' | 'jsonld'; keepalive?: boolean };
export async function apiText(path: string, options?: Omit<ApiOptions, 'format'>): Promise<string>;   // text answer (XML)

// lib/toast.ts
export type ToastAction = { label: string; run(): void; onExpire?(): void };   // onExpire: closed without using the action
export function dismissToast(id: number, used?: boolean): void;                 // used = the action ran (no onExpire)

// lib/pending-delete.ts
export type DeleteRun = (options: { keepalive: boolean }) => Promise<void>;
export function scheduleDelete(id: string, run: DeleteRun): { undo(): boolean; commit(): Promise<void> };   // undo false once committing
export function pendingDeleteIds(): ReadonlySet<string>;
export function usePendingDeletes(): ReadonlySet<string>;
export function commitAllKeepalive(): void;   // pagehide: every pending delete with keepalive

// api/documents.ts
export function useDocument(id: string): SWRResponse<DocumentDetail>;
export function saveDraft(id: string, payload: DraftPayload, options?: { keepalive?: boolean }): Promise<DocumentDetail>;
export function renderPreview(body: RenderRequest, signal?: AbortSignal): Promise<RenderResponse>;
export function finalizeDocument(id: string): Promise<DocumentDetail>;
export function setDocumentStatus(id: string, status: DocumentStatus): Promise<DocumentDetail>;
export function convertDocument(id: string, type: DocumentType): Promise<DocumentDetail>;
export function cancelInvoice(id: string): Promise<DocumentDetail>;
export function duplicateDocument(id: string): Promise<DocumentDetail>;
export function deleteDocument(id: string, options?: { keepalive?: boolean }): Promise<void>;
export function fetchXml(id: string): Promise<string>;
export type RenderRequest = { document_id: string; draft?: DraftPayload };
```

---

## Task 1: Paket `packages/paged-preview` – Geometrie und Seitenumbruch

**Files:**
- Create: `packages/paged-preview/package.json`, `packages/paged-preview/tsconfig.json`, `packages/paged-preview/vitest.config.ts`
- Create: `packages/paged-preview/src/geometry.ts`, `packages/paged-preview/src/index.ts`
- Test: `packages/paged-preview/src/geometry.test.ts`
- Modify: `.github/workflows/tests.yml` (Schritt „Packages“ nach „Vitest“), `pnpm-lock.yaml` (durch `pnpm install`)

**Interfaces:**
- Consumes: nichts.
- Produces: `toPx`, `pageGeometry`, `computePageBreaks`, Typen `Paper`, `Block`, `PageGeometry` (Abschnitt „Interfaces“). Task 2 ergänzt die Komponente im selben Paket.

- [ ] **Step 1: Identität prüfen**

Run: `git config user.email`
Expected: `rafael@hauss.dev` (sonst stoppen und nachfragen).

- [ ] **Step 2: Paketgerüst anlegen**

`packages/paged-preview/package.json`:

```json
{
    "name": "@openbill/paged-preview",
    "version": "0.0.0",
    "private": true,
    "type": "module",
    "description": "Lays out the server-rendered parts of an openbill document (header, body, footer) as pages, like the PDF.",
    "license": "MIT",
    "exports": {
        ".": "./src/index.ts"
    },
    "sideEffects": ["*.css"],
    "scripts": {
        "test": "vitest run",
        "typecheck": "tsc -p ."
    },
    "peerDependencies": {
        "react": "^19.0.0",
        "react-dom": "^19.0.0"
    },
    "devDependencies": {
        "@types/react": "^19.3.0",
        "@types/react-dom": "^19.3.0",
        "react": "^19.3.0",
        "react-dom": "^19.3.0",
        "typescript": "^7.0.2",
        "vitest": "^5.0.3"
    }
}
```

`packages/paged-preview/tsconfig.json`:

```json
{
    "compilerOptions": {
        "target": "ES2022",
        "lib": ["ES2022", "DOM", "DOM.Iterable"],
        "module": "ESNext",
        "moduleResolution": "bundler",
        "jsx": "react-jsx",
        "strict": true,
        "noEmit": true,
        "skipLibCheck": true,
        "isolatedModules": true,
        "verbatimModuleSyntax": true,
        "noUnusedLocals": true,
        "noUnusedParameters": true
    },
    "include": ["src"]
}
```

`packages/paged-preview/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

// Page geometry and breaks are plain functions; the component is checked with static markup (no DOM needed).
export default defineConfig({
    test: {
        include: ['src/**/*.test.{ts,tsx}'],
        environment: 'node',
    },
});
```

- [ ] **Step 3: Failing Test schreiben**

`packages/paged-preview/src/geometry.test.ts` (Port von `prototypes/clickdummy-v2/src/domain/paper.test.ts` plus Randfälle):

```ts
import { describe, expect, it } from 'vitest';
import { computePageBreaks, pageGeometry, toPx } from './geometry';

describe('toPx', () => {
    it('converts print units at 96 dpi', () => {
        expect(toPx('25.4mm')).toBeCloseTo(96);
        expect(toPx('2.54cm')).toBeCloseTo(96);
        expect(toPx('1in')).toBe(96);
        expect(toPx('72pt')).toBeCloseTo(96);
        expect(toPx('10px')).toBe(10);
        expect(toPx(' 10 ')).toBe(10);
    });

    it('treats anything else as 0', () => {
        expect(toPx('')).toBe(0);
        expect(toPx('20 furlongs')).toBe(0);
        expect(toPx('calc(1mm + 2mm)')).toBe(0);
    });
});

describe('pageGeometry', () => {
    it('derives the content area from header, footer and side margins', () => {
        const g = pageGeometry({ format: 'A4', marginX: '20mm', headerHeight: '25mm', footerHeight: '20mm' });

        expect(Math.round(g.width)).toBe(794);
        expect(Math.round(g.height)).toBe(1123);
        expect(Math.round(g.contentHeight)).toBe(Math.round(toPx('252mm')));
        expect(Math.round(g.contentWidth)).toBe(Math.round(toPx('170mm')));
    });

    it('knows Letter and falls back to A4 for unknown formats', () => {
        expect(pageGeometry({ format: 'Letter', marginX: '1in', headerHeight: '1in', footerHeight: '1in' }).width).toBe(816);
        expect(Math.round(pageGeometry({ format: 'A3', marginX: '0mm', headerHeight: '0mm', footerHeight: '0mm' }).width)).toBe(794);
    });

    it('never returns a content height below one pixel', () => {
        expect(pageGeometry({ format: 'A4', marginX: '0mm', headerHeight: '200mm', footerHeight: '200mm' }).contentHeight).toBe(1);
    });
});

describe('computePageBreaks', () => {
    it('fits everything on one page', () => {
        expect(computePageBreaks([{ top: 0, bottom: 100 }], 100, 500)).toEqual([0]);
        expect(computePageBreaks([], 0, 500)).toEqual([0]);
    });

    it('never splits a block: breaks before the block that crosses the page edge', () => {
        const blocks = [{ top: 0, bottom: 300 }, { top: 300, bottom: 450 }, { top: 450, bottom: 600 }];

        expect(computePageBreaks(blocks, 600, 500)).toEqual([0, 450]);
    });

    it('breaks at the edge when a block ends exactly there', () => {
        expect(computePageBreaks([{ top: 0, bottom: 500 }, { top: 500, bottom: 600 }], 600, 500)).toEqual([0, 500]);
    });

    it('moves the earliest crossing block (nested rows inside a section)', () => {
        expect(computePageBreaks([{ top: 100, bottom: 900 }, { top: 450, bottom: 550 }], 900, 500)).toEqual([0, 100, 600]);
    });

    it('cuts a block taller than a page instead of looping forever', () => {
        expect(computePageBreaks([{ top: 0, bottom: 1200 }], 1200, 500)).toEqual([0, 500, 1000]);
    });
});
```

- [ ] **Step 4: Abhängigkeiten installieren und Test laufen lassen**

Run: `ddev exec pnpm install`
Expected: endet mit `Done`, `pnpm-lock.yaml` enthält den Importer `packages/paged-preview`.

Run: `ddev exec pnpm --filter @openbill/paged-preview test`
Expected: FAIL – `Failed to resolve import "./geometry"`.

- [ ] **Step 5: Implementierung**

`packages/paged-preview/src/geometry.ts`:

```ts
/** Paper of a template manifest, as POST /api/render returns it ("20mm", "1in", …). */
export type Paper = { format: 'A4' | 'Letter' | (string & {}); marginX: string; headerHeight: string; footerHeight: string };

export type PageGeometry = {
    width: number;
    height: number;
    marginX: number;
    headerHeight: number;
    footerHeight: number;
    contentWidth: number;
    contentHeight: number;
};

export type Block = { top: number; bottom: number };

const UNIT = { mm: 96 / 25.4, cm: 96 / 2.54, in: 96, pt: 96 / 72, px: 1 } as const;

/** Same formats as App\Rendering\Paper::FORMATS. */
const FORMATS: Record<string, { width: string; height: string }> = {
    A4: { width: '210mm', height: '297mm' },
    Letter: { width: '8.5in', height: '11in' },
};

/** CSS length in pixels at 96 dpi (as Chromium prints). Supports mm, cm, in, pt, px; anything else is 0. */
export function toPx(value: string): number {
    const match = /^\s*(-?\d+(?:\.\d+)?)\s*(mm|cm|in|pt|px)?\s*$/.exec(value ?? '');
    if (!match) return 0;
    return Number(match[1]) * UNIT[(match[2] ?? 'px') as keyof typeof UNIT];
}

/**
 * Page layout like Gotenberg/Chromium: the header sits in the top margin, the footer in the bottom margin,
 * the body flows in between. Header and footer heights are the page margins.
 */
export function pageGeometry(paper: Paper): PageGeometry {
    const format = FORMATS[paper.format] ?? FORMATS.A4;
    const width = toPx(format.width);
    const height = toPx(format.height);
    const marginX = toPx(paper.marginX);
    const headerHeight = toPx(paper.headerHeight);
    const footerHeight = toPx(paper.footerHeight);

    return {
        width,
        height,
        marginX,
        headerHeight,
        footerHeight,
        contentWidth: width - 2 * marginX,
        contentHeight: Math.max(1, height - headerHeight - footerHeight),
    };
}

/**
 * Page breaks for the preview: a block (table row, paragraph, …) that crosses the page edge moves to the next
 * page as a whole; a block taller than a page is cut. Returns the start offset of every page in pixels.
 */
export function computePageBreaks(blocks: Block[], totalHeight: number, pageContentHeight: number): number[] {
    const breaks = [0];
    let start = 0;
    while (start + pageContentHeight < totalHeight) {
        const limit = start + pageContentHeight;
        const crossing = blocks.filter((block) => block.top > start && block.top < limit && block.bottom > limit);
        const next = crossing.length ? Math.min(...crossing.map((block) => block.top)) : limit;
        breaks.push(next);
        start = next;
    }
    return breaks;
}
```

`packages/paged-preview/src/index.ts`:

```ts
export { computePageBreaks, pageGeometry, toPx, type Block, type PageGeometry, type Paper } from './geometry';
```

- [ ] **Step 6: Tests und Typprüfung grün**

Run: `ddev exec pnpm --filter @openbill/paged-preview test`
Expected: PASS, `10 passed`.

Run: `ddev exec pnpm --filter @openbill/paged-preview typecheck`
Expected: keine Ausgabe, Exit-Code 0.

- [ ] **Step 7: CI-Schritt ergänzen**

In `.github/workflows/tests.yml` direkt nach dem Schritt `Vitest` (vor `Build`) einfügen:

```yaml
      # workspace packages (paged-preview: page geometry and breaks)
      - name: Packages
        run: |
          pnpm --filter "./packages/*" run typecheck
          pnpm --filter "./packages/*" run test
```

Lokal wie in CI prüfen (äußere Quotes wegen des Globs, siehe CLAUDE.md „Fallstricke“):

Run: `ddev exec 'pnpm --filter "./packages/*" run test'`
Expected: `packages/paged-preview test: … 10 passed`.

- [ ] **Step 8: Commit**

```bash
git add packages/paged-preview pnpm-lock.yaml .github/workflows/tests.yml
git commit -m "feat(paged-preview): page geometry and page breaks as a workspace package" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 2: `PagedPreview`-Komponente und Einbindung in die App

**Files:**
- Create: `packages/paged-preview/src/paged-preview.tsx`, `packages/paged-preview/src/paged-preview.css`
- Modify: `packages/paged-preview/src/index.ts`
- Test: `packages/paged-preview/src/paged-preview.test.tsx`
- Modify: `package.json` (Abhängigkeit `@openbill/paged-preview`), `pnpm-lock.yaml`

**Interfaces:**
- Consumes: `pageGeometry`, `computePageBreaks`, `Paper` (Task 1).
- Produces: `PagedPreview`, `PagedPreviewProps`, `PagedPreviewLabels`, `DEFAULT_LABELS`, `RenderedParts`, `Zone`, `PAGE_GAP` (Abschnitt „Interfaces“). Task 8 nutzt die Komponente im Editor, Phase 7/9 im Template-Editor/Toolkit.

- [ ] **Step 1: Failing Test schreiben**

`packages/paged-preview/src/paged-preview.test.tsx`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import * as api from './index';
import { DEFAULT_LABELS, PagedPreview } from './paged-preview';

const parts = { header: '<html><body>Head</body></html>', body: '<html><body><p>Body</p></body></html>', footer: '<html><body>Foot</body></html>' };
const paper = { format: 'A4', marginX: '20mm', headerHeight: '30mm', footerHeight: '20mm' };

describe('PagedPreview', () => {
    it('exports the documented interface', () => {
        expect(Object.keys(api).sort()).toEqual(['DEFAULT_LABELS', 'PAGE_GAP', 'PagedPreview', 'computePageBreaks', 'pageGeometry', 'toPx']);
        expect(DEFAULT_LABELS.page(3)).toBe('Page 3');
    });

    it('renders one page with header, body and footer in script-less frames', () => {
        const html = renderToStaticMarkup(<PagedPreview parts={parts} paper={paper} />);

        expect(html.match(/class="pp-page"/g)).toHaveLength(1);
        // measurement frame + header + body + footer, all without script rights
        expect(html.match(/<iframe/g)).toHaveLength(4);
        expect(html.match(/sandbox="allow-same-origin"/g)).toHaveLength(4);
        expect(html).not.toContain('allow-scripts');
        expect(html).toContain('aria-label="Document preview"');
    });

    it('uses the given labels and shows guides only when asked', () => {
        const plain = renderToStaticMarkup(<PagedPreview parts={parts} paper={paper} />);
        const guided = renderToStaticMarkup(<PagedPreview parts={parts} paper={paper} showGuides labels={{ document: 'Dokumentvorschau', header: 'Kopfzeile', body: 'Inhalt', footer: 'Fußzeile' }} />);

        expect(plain).not.toContain('pp-guide');
        expect(guided.match(/class="pp-guide"/g)).toHaveLength(3);
        expect(guided).toContain('>Kopfzeile<');
        expect(guided).toContain('aria-label="Dokumentvorschau"');
    });

    it('emphasizes one zone without showing the other guides', () => {
        const html = renderToStaticMarkup(<PagedPreview parts={parts} paper={paper} highlight="footer" />);

        expect(html.match(/pp-guide pp-guide--on/g)).toHaveLength(1);
        expect(html.match(/class="pp-guide"/g)).toBeNull();
    });
});
```

- [ ] **Step 2: Test läuft rot**

Run: `ddev exec pnpm --filter @openbill/paged-preview test`
Expected: FAIL – `Failed to resolve import "./paged-preview"`.

- [ ] **Step 3: Komponente (Port von `prototypes/clickdummy-v2/src/components/PagedPreview.tsx`)**

`packages/paged-preview/src/paged-preview.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { computePageBreaks, pageGeometry, type Paper } from './geometry';
import './paged-preview.css';

/** The three standalone HTML documents of POST /api/render. */
export type RenderedParts = { header: string; body: string; footer: string };

export type Zone = 'header' | 'body' | 'footer';

export type PagedPreviewLabels = {
    document: string;
    page(n: number): string;
    header: string;
    body: string;
    footer: string;
};

export const DEFAULT_LABELS: PagedPreviewLabels = {
    document: 'Document preview',
    page: (n) => `Page ${n}`,
    header: 'Header',
    body: 'Content',
    footer: 'Footer',
};

export type PagedPreviewProps = {
    parts: RenderedParts;
    paper: Paper;
    showGuides?: boolean;
    highlight?: Zone | null;
    maxPages?: number;
    maxHeight?: number;
    onPageCount?(count: number): void;
    className?: string;
    labels?: Partial<PagedPreviewLabels>;
};

/** Elements never split across pages (what Chromium tries for rows and paragraphs). */
const ATOMIC = 'tr, p, li, h1, h2, h3, h4, h5, h6, dt, dd, img, pre, blockquote, figure, section.address, .keep';
/** Gap between two pages in unscaled pixels. */
export const PAGE_GAP = 28;
/** Room for the zone labels left of the pages when guides are shown. */
const GUTTER = 24;

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(' ');

/** Fills {{ page.number }} / {{ page.total }} (rendered as .pageNumber / .totalPages) of one header or footer frame. */
function fillPageNumbers(frame: HTMLIFrameElement | null, page: number, total: number): void {
    const doc = frame?.contentDocument;
    if (!doc) return;
    doc.querySelectorAll('.pageNumber').forEach((element) => (element.textContent = String(page)));
    doc.querySelectorAll('.totalPages').forEach((element) => (element.textContent = String(total)));
}

function Band({ html, top, width, height, page, total, title }: { html: string; top: number; width: number; height: number; page: number; total: number; title: string }) {
    const ref = useRef<HTMLIFrameElement>(null);
    useEffect(() => fillPageNumbers(ref.current, page, total), [page, total, html]);
    return (
        <iframe
            ref={ref}
            title={title}
            sandbox="allow-same-origin"
            srcDoc={html}
            onLoad={() => fillPageNumbers(ref.current, page, total)}
            className="pp-frame"
            style={{ top, width, height }}
            tabIndex={-1}
        />
    );
}

/**
 * Pages as in the finished PDF: the header in the top margin and the footer in the bottom margin of every page,
 * the body cut into pages in between. All frames run without script rights; the markup is rendered on the server.
 */
export function PagedPreview({ parts, paper, showGuides = false, highlight = null, maxPages, maxHeight, onPageCount, className, labels }: PagedPreviewProps): JSX.Element {
    const text = { ...DEFAULT_LABELS, ...labels };
    // the render answer is a new object every time: only real changes of the paper count
    const g = useMemo(() => pageGeometry(paper), [paper.format, paper.marginX, paper.headerHeight, paper.footerHeight]); // eslint-disable-line react-hooks/exhaustive-deps
    const box = useRef<HTMLDivElement>(null);
    const measure = useRef<HTMLIFrameElement>(null);
    const pageCountRef = useRef(onPageCount);
    const [boxWidth, setBoxWidth] = useState(400);
    const [layout, setLayout] = useState<{ breaks: number[]; total: number }>({ breaks: [0], total: g.contentHeight });

    useEffect(() => {
        pageCountRef.current = onPageCount;
    }, [onPageCount]);

    useEffect(() => {
        const element = box.current;
        if (!element) return;
        const observer = new ResizeObserver(([entry]) => setBoxWidth(entry.contentRect.width));
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    const paginate = useCallback(() => {
        const doc = measure.current?.contentDocument;
        if (!doc?.body) return;
        const scroll = doc.documentElement.scrollTop;
        const total = Math.max(doc.documentElement.scrollHeight, 1);
        const blocks = [...doc.querySelectorAll(ATOMIC)].map((element) => {
            const rect = element.getBoundingClientRect();
            return { top: rect.top + scroll, bottom: rect.bottom + scroll };
        });
        const breaks = computePageBreaks(blocks, total, g.contentHeight);
        setLayout({ breaks, total });
        pageCountRef.current?.(breaks.length);
    }, [g.contentHeight]);

    useEffect(paginate, [paginate, g.contentWidth]);

    const withGuides = showGuides || !!highlight;
    const gutter = withGuides ? GUTTER : 0;
    const scale = Math.max(0.1, (boxWidth - gutter) / g.width);
    const pageCount = layout.breaks.length;
    const pages = layout.breaks.slice(0, maxPages ?? pageCount);
    const stackHeight = pages.length * g.height + (pages.length - 1) * PAGE_GAP;
    const visible = maxHeight ? Math.min(stackHeight * scale, maxHeight) : stackHeight * scale;
    const zones: { zone: Zone; label: string; y: number; h: number; x: number; w: number }[] = [
        { zone: 'header', label: text.header, y: 0, h: g.headerHeight, x: 0, w: g.width },
        { zone: 'body', label: text.body, y: g.headerHeight, h: g.contentHeight, x: g.marginX, w: g.contentWidth },
        { zone: 'footer', label: text.footer, y: g.height - g.footerHeight, h: g.footerHeight, x: 0, w: g.width },
    ];
    const shown = zones.filter((z) => showGuides || highlight === z.zone);

    return (
        <div ref={box} className={cx('pp', className)} style={{ height: visible }} role="img" aria-label={text.document}>
            <iframe
                ref={measure}
                title={text.document}
                aria-hidden
                sandbox="allow-same-origin"
                srcDoc={parts.body}
                onLoad={paginate}
                className="pp-measure"
                style={{ width: g.contentWidth, height: 10 }}
                tabIndex={-1}
            />

            <div className="pp-stack" style={{ left: gutter, width: g.width, transform: `scale(${scale})` }}>
                {pages.map((start, i) => {
                    const end = layout.breaks[i + 1] ?? layout.total;
                    return (
                        <div key={i} data-page={i + 1} className="pp-page" style={{ top: i * (g.height + PAGE_GAP), width: g.width, height: g.height }}>
                            <Band html={parts.header} top={0} width={g.width} height={g.headerHeight} page={i + 1} total={pageCount} title={text.header} />
                            <div className="pp-clip" style={{ top: g.headerHeight, left: g.marginX, width: g.contentWidth, height: end - start }}>
                                <iframe
                                    title={i === 0 ? text.document : text.page(i + 1)}
                                    sandbox="allow-same-origin"
                                    srcDoc={parts.body}
                                    className="pp-frame"
                                    style={{ top: -start, width: g.contentWidth, height: layout.total }}
                                    tabIndex={-1}
                                />
                            </div>
                            <Band html={parts.footer} top={g.height - g.footerHeight} width={g.width} height={g.footerHeight} page={i + 1} total={pageCount} title={text.footer} />
                            {shown.map((z) => (
                                <div key={z.zone} className={cx('pp-guide', highlight === z.zone && 'pp-guide--on')} style={{ top: z.y, left: z.x, width: z.w, height: z.h }} />
                            ))}
                        </div>
                    );
                })}
            </div>

            {pages.map((_, i) =>
                shown.map((z) => (
                    <span
                        key={`${i}-${z.zone}`}
                        className={cx('pp-label', highlight === z.zone && 'pp-label--on')}
                        style={{ top: (i * (g.height + PAGE_GAP) + z.y) * scale + 1, height: Math.max(z.h * scale - 2, 8) }}
                    >
                        {z.zone === 'body' && i > 0 ? `${z.label}, ${text.page(i + 1)}` : z.label}
                    </span>
                )),
            )}
        </div>
    );
}
```

Hinweis zum Test „emphasizes one zone“: Bei `highlight="footer"` ohne `showGuides` erscheint nur der Fußzeilen-Rahmen mit Klasse `pp-guide pp-guide--on`; der Test zählt `class="pp-guide"` (ohne Zusatz) und erwartet keinen Treffer.

`packages/paged-preview/src/paged-preview.css` (keine Tailwind-Klassen; Farben über `--pp-*` mit Standardwerten aus DESIGN.md, Papier bleibt in beiden Themes weiß):

```css
.pp {
    position: relative;
    width: 100%;
    overflow: hidden;
}
.pp-measure {
    position: absolute;
    top: 0;
    left: -9999px;
    border: 0;
    opacity: 0;
    pointer-events: none;
}
.pp-stack {
    position: absolute;
    top: 0;
    transform-origin: top left;
}
.pp-page {
    position: absolute;
    left: 0;
    overflow: hidden;
    border-radius: 3px;
    background: #fff;
    box-shadow: var(--pp-paper-shadow, 0 1px 2px rgb(20 22 30 / 0.06), 0 16px 36px -18px rgb(20 22 30 / 0.28));
}
.pp-clip {
    position: absolute;
    overflow: hidden;
}
.pp-frame {
    position: absolute;
    left: 0;
    border: 0;
    pointer-events: none;
}
.pp-guide {
    position: absolute;
    pointer-events: none;
    outline: 1px dashed color-mix(in srgb, var(--pp-accent, #2f55d4) 55%, transparent);
    outline-offset: -1px;
}
.pp-guide--on {
    outline: 2px solid var(--pp-accent, #2f55d4);
    outline-offset: -2px;
    background: color-mix(in srgb, var(--pp-accent, #2f55d4) 6%, transparent);
}
.pp-label {
    position: absolute;
    left: 0;
    display: flex;
    width: 18px;
    align-items: flex-start;
    justify-content: center;
    overflow: hidden;
    padding: 6px 0;
    border-radius: 6px;
    writing-mode: vertical-rl;
    white-space: nowrap;
    font-size: 10.5px;
    font-weight: 600;
    line-height: 1;
    background: var(--pp-accent-soft, #e3e9fb);
    color: var(--pp-accent, #2f55d4);
}
.pp-label--on {
    background: var(--pp-accent-soft-hover, #d5def8);
}
```

`packages/paged-preview/src/index.ts` ersetzen:

```ts
export { computePageBreaks, pageGeometry, toPx, type Block, type PageGeometry, type Paper } from './geometry';
export { DEFAULT_LABELS, PAGE_GAP, PagedPreview, type PagedPreviewLabels, type PagedPreviewProps, type RenderedParts, type Zone } from './paged-preview';
```

- [ ] **Step 4: Tests grün**

Run: `ddev exec pnpm --filter @openbill/paged-preview test`
Expected: PASS, `14 passed` (10 Geometrie + 4 Komponente). Falls Vitest den CSS-Import im Node-Modus nicht auflöst, in `vitest.config.ts` `test.css: false` ergänzen (Standard ist bereits „CSS ignorieren“; nur bei Fehlermeldung `Unknown file extension ".css"` nötig) und erneut laufen lassen.

Run: `ddev exec pnpm --filter @openbill/paged-preview typecheck`
Expected: Exit-Code 0. (Im Repo läuft kein ESLint; der `eslint-disable`-Kommentar am `useMemo` dokumentiert nur, dass die Abhängigkeiten absichtlich die einzelnen Papierwerte sind.)

- [ ] **Step 5: In die App einbinden**

Run: `ddev exec pnpm add -w '@openbill/paged-preview@workspace:*'`
Expected: `package.json` → `"@openbill/paged-preview": "workspace:*"` unter `dependencies`.

Run: `ddev exec pnpm typecheck && ddev exec pnpm build`
Expected: beides ohne Fehler (das Paket wird noch nicht importiert; der Build prüft nur, dass die Abhängigkeit auflösbar ist).

- [ ] **Step 6: Commit**

```bash
git add packages/paged-preview package.json pnpm-lock.yaml
git commit -m "feat(paged-preview): PagedPreview component with script-less frames, guides and labels" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 3: Seitenkontext des Editors (Inertia-Props, Kette)

**Files:**
- Create: `app/Support/DocumentChain.php`, `app/Actions/DescribeDocumentPage.php`
- Modify: `app/Http/Controllers/DocumentController.php` (Methode `show`)
- Test: `tests/Feature/Support/DocumentChainTest.php`, `tests/Feature/Actions/DescribeDocumentPageTest.php`, `tests/Feature/Pages/DocumentPagesTest.php`

**Interfaces:**
- Consumes: `AllocateDocumentNumber::preview(DocumentType, string $date): string`, `DocumentInspector::sources(Document): array` (Snapshot-Form, `org.taxation_mode`), `StatusMachine::nextStatuses/canSetManually`, `DocumentConverter::CONVERSIONS/canConvert`, Model `Template` (`name`, `manifest['documentTypes']`).
- Produces: `App\Support\DocumentChain::for(Document): list<array{id,type,status,number}>`, `App\Actions\DescribeDocumentPage::handle(Actor, Document): array` (Form `DocumentPageContext`, Abschnitt „Interfaces“), Inertia-Prop `context` auf `documents/show`.

Hinweis: `tests/Unit/ArchTest.php` verbietet `App\Support` → `App\Actions` und `App\Http` → `App\Domain`. Deshalb ist der Seitenkontext eine **lesende Action** (wie `DescribeRenderSchema`), die Kette eine Support-Klasse ohne Actions.

- [ ] **Step 1: Failing Test für die Kette**

`tests/Feature/Support/DocumentChainTest.php`:

```php
<?php

use App\Actions\CancelInvoice;
use App\Actions\ConvertDocument;
use App\Actions\DuplicateDocument;
use App\Actions\FinalizeDocument;
use App\Actions\SetDocumentStatus;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Models\Document;
use App\Support\DocumentChain;

beforeEach(fn () => $this->travelTo('2026-10-11 10:00:00'));

function chainFinalize(Document $document): Document
{
    return app(FinalizeDocument::class)->handle(systemActor(), $document);
}

it('is empty for a document without source or successors', function () {
    expect(DocumentChain::for(draft()))->toBe([]);
});

it('lists the whole chain from the root, the same for every member, without duplicates', function () {
    $offer = chainFinalize(draft(DocumentType::Offer));
    $offer = app(SetDocumentStatus::class)->handle(systemActor(), $offer, DocumentStatus::Accepted);
    $confirmation = chainFinalize(app(ConvertDocument::class)->handle(systemActor(), $offer, DocumentType::Confirmation)->document);
    $invoice = chainFinalize(app(ConvertDocument::class)->handle(systemActor(), $confirmation, DocumentType::Invoice)->document);
    $cancellation = app(CancelInvoice::class)->handle(systemActor(), $invoice)->document;
    app(DuplicateDocument::class)->handle(systemActor(), $invoice);

    $expected = [
        ['id' => $offer->id, 'type' => 'offer', 'status' => 'accepted', 'number' => $offer->number],
        ['id' => $confirmation->id, 'type' => 'confirmation', 'status' => 'open', 'number' => $confirmation->number],
        ['id' => $invoice->id, 'type' => 'invoice', 'status' => 'open', 'number' => $invoice->number],
        ['id' => $cancellation->id, 'type' => 'cancellation', 'status' => 'draft', 'number' => null],
    ];

    foreach ([$offer, $confirmation, $invoice, $cancellation] as $member) {
        expect(DocumentChain::for($member->fresh()))->toBe($expected);
    }
});
```

- [ ] **Step 2: Rot**

Run: `ddev artisan test --filter=DocumentChainTest`
Expected: FAIL – `Class "App\Support\DocumentChain" not found`.

- [ ] **Step 3: Implementierung**

`app/Support/DocumentChain.php`:

```php
<?php

namespace App\Support;

use App\Models\Document;

/**
 * The chain of a document along source_id (offer → confirmation → invoice → cancellation): the root and all its
 * successors, breadth first in creation order. Duplicates have no source and are never part of a chain.
 */
final class DocumentChain
{
    /** Guards against corrupt data (a source cycle); real chains have at most four members per branch. */
    private const MAX = 50;

    /**
     * @return list<array{id: string, type: string, status: string, number: string|null}> empty when the document stands alone
     */
    public static function for(Document $document): array
    {
        $root = $document;
        $seen = [$root->id => true];
        while ($root->source_id !== null && ! isset($seen[$root->source_id]) && count($seen) < self::MAX) {
            $parent = Document::query()->find($root->source_id);
            if ($parent === null) {
                break;
            }
            $seen[$parent->id] = true;
            $root = $parent;
        }

        $chain = [];
        $visited = [];
        $queue = [$root];
        while ($queue !== [] && count($chain) < self::MAX) {
            $current = array_shift($queue);
            if (isset($visited[$current->id])) {
                continue;
            }
            $visited[$current->id] = true;
            $chain[] = $current;
            $children = Document::query()->where('source_id', $current->id)->orderBy('created_at')->orderBy('id')->get();
            foreach ($children as $child) {
                $queue[] = $child;
            }
        }

        if (count($chain) < 2) {
            return [];
        }

        return array_map(fn (Document $member): array => [
            'id' => $member->id,
            'type' => $member->type->value,
            'status' => $member->status->value,
            'number' => $member->number,
        ], $chain);
    }
}
```

- [ ] **Step 4: Grün**

Run: `ddev artisan test --filter=DocumentChainTest`
Expected: PASS, `2 passed`. Falls `created_at` von Angebot und Folgedokumenten wegen `travelTo` gleich ist, sortiert `id` (ULID, monoton innerhalb derselben Millisekunde nicht garantiert): Schlägt die Reihenfolge fehl, im Test zwischen den Schritten `$this->travel(1)->seconds();` einfügen – nicht die Sortierung ändern.

- [ ] **Step 5: Failing Test für den Seitenkontext**

`tests/Feature/Actions/DescribeDocumentPageTest.php`:

```php
<?php

use App\Actions\AllocateDocumentNumber;
use App\Actions\CancelInvoice;
use App\Actions\ConvertDocument;
use App\Actions\DescribeDocumentPage;
use App\Actions\FinalizeDocument;
use App\Actions\SetDocumentStatus;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\TaxationMode;
use App\Models\Document;
use App\Models\DocumentTypeSetting;
use App\Models\Organization;

beforeEach(fn () => $this->travelTo('2026-10-11 10:00:00'));

function pageContext(Document $document): array
{
    return app(DescribeDocumentPage::class)->handle(systemActor(), $document->fresh());
}

function pageFinalize(Document $document): Document
{
    return app(FinalizeDocument::class)->handle(systemActor(), $document);
}

it('describes a draft: profile, number preview, finalize and delete, no status change or conversion', function () {
    $draft = draft(DocumentType::Invoice);

    $context = pageContext($draft);

    expect($context['profile'])->toBe('basic')
        ->and($context['next_number'])->toBe(app(AllocateDocumentNumber::class)->preview(DocumentType::Invoice, '2026-10-11'))
        ->and($context['small_business'])->toBeFalse()
        ->and($context['chain'])->toBe([])
        ->and($context['allowed'])->toBe(['finalize' => true, 'delete' => true, 'duplicate' => true, 'statuses' => [], 'conversions' => [], 'cancel' => false]);
});

it('takes the profile of the document type', function () {
    DocumentTypeSetting::query()->whereKey('invoice')->update(['profile' => 'en16931']);

    expect(pageContext(draft(DocumentType::Invoice))['profile'])->toBe('en16931');
});

it('offers the status changes and conversions the rules allow', function () {
    $offer = pageFinalize(draft(DocumentType::Offer));

    expect(pageContext($offer)['allowed'])->toBe(['finalize' => false, 'delete' => false, 'duplicate' => true, 'statuses' => ['accepted', 'rejected'], 'conversions' => [], 'cancel' => false])
        ->and(pageContext($offer)['next_number'])->toBeNull();

    $accepted = app(SetDocumentStatus::class)->handle(systemActor(), $offer, DocumentStatus::Accepted);
    expect(pageContext($accepted)['allowed'])->toBe(['finalize' => false, 'delete' => false, 'duplicate' => true, 'statuses' => [], 'conversions' => ['confirmation', 'invoice'], 'cancel' => false]);

    $invoice = pageFinalize(app(ConvertDocument::class)->handle(systemActor(), $accepted, DocumentType::Invoice)->document);
    expect(pageContext($invoice)['allowed'])->toBe(['finalize' => false, 'delete' => false, 'duplicate' => true, 'statuses' => ['paid'], 'conversions' => [], 'cancel' => true])
        ->and(array_column(pageContext($invoice)['chain'], 'type'))->toBe(['offer', 'invoice']);

    $cancellation = app(CancelInvoice::class)->handle(systemActor(), $invoice)->document;
    expect(pageContext($cancellation)['allowed'])->toBe(['finalize' => true, 'delete' => true, 'duplicate' => false, 'statuses' => [], 'conversions' => [], 'cancel' => false]);

    pageFinalize($cancellation);
    expect(pageContext($invoice)['allowed']['cancel'])->toBeFalse()
        ->and(pageContext($invoice)['allowed']['statuses'])->toBe([]);
});

it('reads small business from the organization for drafts and from the snapshot once finalized', function () {
    Organization::current()->forceFill(['taxation_mode' => TaxationMode::SmallBusiness])->save();
    $draft = draft(DocumentType::Invoice);
    expect(pageContext($draft)['small_business'])->toBeTrue();

    $invoice = pageFinalize($draft);
    Organization::current()->forceFill(['taxation_mode' => TaxationMode::Regular])->save();

    expect(pageContext($invoice)['small_business'])->toBeTrue()
        ->and(pageContext(draft(DocumentType::Invoice))['small_business'])->toBeFalse();
});

it('lists every template with the document types of its manifest', function () {
    $templates = pageContext(draft())['templates'];

    expect(array_column($templates, 'name'))->toBe(['Kante', 'Klar', 'Leise'])
        ->and($templates[1])->toMatchArray(['name' => 'Klar', 'document_types' => ['offer', 'confirmation', 'invoice', 'cancellation']])
        ->and($templates[1]['id'])->toBeString();
});
```

- [ ] **Step 6: Rot**

Run: `ddev artisan test --filter=DescribeDocumentPageTest`
Expected: FAIL – `Class "App\Actions\DescribeDocumentPage" not found`.

- [ ] **Step 7: Implementierung**

Vorher prüfen: `grep -n "documentTypes" resources/templates/*/manifest.json` → alle drei Manifeste haben den Schlüssel `documentTypes`. `DocumentTypeSetting::profile` ist auf `App\Enums\ComplianceProfile` gecastet (`app/Models/DocumentTypeSetting.php`).

`app/Actions/DescribeDocumentPage.php`:

```php
<?php

namespace App\Actions;

use App\Domain\Conversion\DocumentConverter;
use App\Domain\Lifecycle\StatusMachine;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\TaxationMode;
use App\Models\Document;
use App\Models\DocumentTypeSetting;
use App\Models\Organization;
use App\Models\Template;
use App\Support\Actor;
use App\Support\DocumentChain;
use App\Support\DocumentInspector;

/**
 * Page context of the document editor (Inertia prop "context" of documents/show): everything the browser
 * must not decide itself – compliance profile, number preview, allowed status changes and conversions,
 * chain, small business, templates per document type. Reads only.
 */
final class DescribeDocumentPage
{
    public function __construct(
        private readonly AllocateDocumentNumber $numbers,
        private readonly DocumentInspector $inspector,
    ) {}

    /**
     * @return array{
     *     profile: string,
     *     next_number: string|null,
     *     small_business: bool,
     *     chain: list<array{id: string, type: string, status: string, number: string|null}>,
     *     templates: list<array{id: string, name: string, document_types: list<string>}>,
     *     allowed: array{finalize: bool, delete: bool, duplicate: bool, statuses: list<string>, conversions: list<string>, cancel: bool}
     * }
     */
    public function handle(Actor $actor, Document $document): array
    {
        $setting = DocumentTypeSetting::query()->findOrFail($document->type->value);
        $draft = ! $document->isFinalized();

        return [
            'profile' => $setting->profile->value,
            'next_number' => $draft ? $this->numbers->preview($document->type, $document->date->toDateString()) : null,
            'small_business' => $this->smallBusiness($document, $draft),
            'chain' => DocumentChain::for($document),
            'templates' => Template::query()->orderBy('name')->get(['id', 'name', 'manifest'])
                ->map(fn (Template $template): array => [
                    'id' => $template->id,
                    'name' => $template->name,
                    'document_types' => array_values(array_filter((array) ($template->manifest['documentTypes'] ?? []), 'is_string')),
                ])->values()->all(),
            'allowed' => self::allowed($document, $draft),
        ];
    }

    private function smallBusiness(Document $document, bool $draft): bool
    {
        if ($draft) {
            return Organization::current()->taxation_mode === TaxationMode::SmallBusiness;
        }
        $org = $this->inspector->sources($document)['org'] ?? [];

        return is_array($org) && ($org['taxation_mode'] ?? null) === TaxationMode::SmallBusiness->value;
    }

    /**
     * @return array{finalize: bool, delete: bool, duplicate: bool, statuses: list<string>, conversions: list<string>, cancel: bool}
     */
    private static function allowed(Document $document, bool $draft): array
    {
        $type = $document->type;
        $status = $document->status;
        $cancelled = $document->cancelled_by_id !== null;

        $statuses = array_values(array_map(
            fn (DocumentStatus $to): string => $to->value,
            array_filter(StatusMachine::nextStatuses($type, $status), fn (DocumentStatus $to): bool => StatusMachine::canSetManually($type, $status, $to)),
        ));
        $conversions = array_values(array_filter(
            DocumentConverter::CONVERSIONS[$type->value],
            fn (string $target): bool => $target !== DocumentType::Cancellation->value
                && DocumentConverter::canConvert($type, $status, $cancelled, DocumentType::from($target)),
        ));

        return [
            'finalize' => $draft,
            'delete' => $draft,
            'duplicate' => $type !== DocumentType::Cancellation,
            'statuses' => $statuses,
            'conversions' => $conversions,
            'cancel' => DocumentConverter::canConvert($type, $status, $cancelled, DocumentType::Cancellation),
        ];
    }
}
```

- [ ] **Step 8: Grün**

Run: `ddev artisan test --filter=DescribeDocumentPageTest`
Expected: PASS, `5 passed`. Prüfen, falls rot:
- `profile` ≠ `basic`: Grunddaten-Migration `2026_10_11_100300` setzt `basic` für alle Typen – dann den Test nicht anpassen, sondern den Cast in `DocumentTypeSetting` ansehen.
- Templates-Reihenfolge: Namen der mitgelieferten Templates aus `resources/templates/*/manifest.json` (`Kante`, `Klar`, `Leise`) – nach Name sortiert.

- [ ] **Step 9: Failing Test für die Inertia-Props**

In `tests/Feature/Pages/DocumentPagesTest.php` den Test `renders the page of an existing document only` ersetzen und einen weiteren ergänzen (Imports oben ergänzen: `use App\Actions\AllocateDocumentNumber;`):

```php
it('renders the editor of an existing document only', function () {
    $document = Document::factory()->create();
    $this->actingAs(User::factory()->create());

    $this->get("/en/documents/{$document->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('documents/show')
            ->where('document_id', $document->id)
            ->has('context', fn (Assert $context) => $context
                ->hasAll(['profile', 'next_number', 'small_business', 'chain', 'templates', 'allowed'])));
    $this->get('/en/documents/'.strtolower((string) Str::ulid()))->assertNotFound();
    $this->get('/en/documents/not-an-id')->assertNotFound();
});

it('passes the editor context: profile, number preview, templates and allowed actions', function () {
    $document = draft(DocumentType::Offer);

    $this->actingAs(User::factory()->create())
        ->get("/de/documents/{$document->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('documents/show')
            ->where('document_id', $document->id)
            ->where('context.profile', 'basic')
            ->where('context.next_number', app(AllocateDocumentNumber::class)->preview(DocumentType::Offer, '2026-10-11'))
            ->where('context.small_business', false)
            ->where('context.chain', [])
            ->has('context.templates', 3)
            ->where('context.allowed', ['finalize' => true, 'delete' => true, 'duplicate' => true, 'statuses' => [], 'conversions' => [], 'cancel' => false]));
});
```

- [ ] **Step 10: Rot**

Run: `ddev artisan test --filter=DocumentPagesTest`
Expected: FAIL – `Property [context] does not exist.`

- [ ] **Step 11: Controller**

`app/Http/Controllers/DocumentController.php` – Methode `show` ersetzen (Imports `use App\Actions\DescribeDocumentPage;` und `use App\Support\Actor;` ergänzen):

```php
    /** Document editor: the document itself comes from GET /api/documents/{id} (SWR), the server-side page context from here. */
    public function show(Request $request, string $id, DescribeDocumentPage $describe): Response
    {
        $document = Document::query()->findOrFail($id);

        return Inertia::render('documents/show', [
            'document_id' => $document->id,
            'context' => $describe->handle(Actor::user($request->user()), $document),
        ]);
    }
```

Vorher prüfen: `App\Support\Actor::user()` erwartet `App\Models\User` (Signatur in `app/Support/Actor.php`). `$request->user()` ist durch die `auth`-Middleware der Route nie `null`; Larastan meldet sonst `User|null` – dann `/** @var User $user */ $user = $request->user();` davor setzen.

- [ ] **Step 12: Grün, Architektur, Stil**

Run: `ddev artisan test --filter='DocumentPagesTest|DescribeDocumentPageTest|DocumentChainTest|ArchTest'`
Expected: PASS.

Run: `ddev exec vendor/bin/pint && ddev exec vendor/bin/phpstan analyse --memory-limit=1G`
Expected: Pint formatiert ggf.; Larastan `[OK] No errors`.

- [ ] **Step 13: Commit**

```bash
git add app/Support/DocumentChain.php app/Actions/DescribeDocumentPage.php app/Http/Controllers/DocumentController.php tests/Feature/Support/DocumentChainTest.php tests/Feature/Actions/DescribeDocumentPageTest.php tests/Feature/Pages/DocumentPagesTest.php
git commit -m "feat(editor): page context of the document editor (profile, number preview, allowed actions, chain)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 4: Abhängigkeiten, API-Typen und API-Funktionen des Editors

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml` (zustand, @dnd-kit)
- Modify: `resources/js/api/types.ts`, `resources/js/api/keys.ts`, `resources/js/api/documents.ts`, `resources/js/lib/api.ts`
- Create: `resources/js/api/master-data.ts`, `resources/js/editor/types.ts`
- Test: `resources/js/lib/api.test.ts`, `resources/js/api/keys.test.ts`

**Interfaces:**
- Consumes: `api`, `apiPage`, `apiUrl`, `ApiError` (`lib/api.ts`), `invalidate` (`api/paged.ts`), `keys` (`api/keys.ts`).
- Produces: Typen `DocumentDetail`, `ApiGroup`, `ApiPosition`, `PositionKind`, `Totals`, `Issue`, `RenderResponse`, `RenderErrorItem`, `Paper`, `TaxRate`, `Unit`, `TextBlock`, `TextBlockKind`, `PositionSuggestion`, `DocumentPageContext`, `ComplianceProfile`; `Draft`, `DraftPayload`, `IdMap`, `SaveState` (`editor/types.ts`); `ApiOptions.keepalive`, `apiText`; Funktionen aus `api/documents.ts` und Hooks aus `api/master-data.ts` (Abschnitt „Interfaces“).

- [ ] **Step 1: Abhängigkeiten**

Run: `ddev exec pnpm add -w zustand@^5.0.15 @dnd-kit/core@^6.3.1 @dnd-kit/sortable@^10.0.0 @dnd-kit/utilities@^3.2.2`
Expected: vier neue Einträge unter `dependencies`, keine Build-Skript-Warnung (keins der Pakete hat Build-Skripte; meldet pnpm doch eins, in `pnpm-workspace.yaml` unter `allowBuilds` mit `false` eintragen und `ddev exec pnpm install` wiederholen).

- [ ] **Step 2: Failing Tests für `lib/api.ts` und Schlüssel**

In `resources/js/lib/api.test.ts` Import um `apiText` erweitern (`import { api, ApiError, apiPage, apiText, apiUrl, errorMessage, setUnauthenticatedHandler } from './api';`) und am Ende anfügen:

```ts
describe('keepalive and text answers', () => {
    it('passes keepalive through (saving while the tab closes)', async () => {
        fetchMock.mockResolvedValue(json(200, {}));

        await api('/api/documents/d1', { method: 'PATCH', body: { intro: 'Hi' }, keepalive: true });
        expect(sent().init.keepalive).toBe(true);
    });

    it('reads text (e-invoice XML) and still throws problems as ApiError', async () => {
        fetchMock.mockResolvedValueOnce(new Response('<rsm:CrossIndustryInvoice/>', { status: 200, headers: { 'Content-Type': 'application/xml' } }));
        await expect(apiText('/api/documents/d1/xml')).resolves.toBe('<rsm:CrossIndustryInvoice/>');
        expect(sent().headers.Accept).toBe('application/xml, application/problem+json');

        fetchMock.mockResolvedValueOnce(problem(409, 'no_e_invoice'));
        await expect(apiText('/api/documents/d1/xml')).rejects.toMatchObject({ status: 409, reason: 'no_e_invoice' });
    });
});
```

In `resources/js/api/keys.test.ts` im bestehenden `it` vor der schließenden Klammer ergänzen:

```ts
        expect(keys.taxRates()).toBe('/api/tax-rates?include_archived=1');
        expect(keys.units()).toBe('/api/units?include_archived=1');
        expect(keys.textBlocks()).toBe('/api/text-blocks');
        expect(keys.customerChoices()).toBe('/api/customers?itemsPerPage=100');
        expect(keys.suggestions(' Work ')).toBe('/api/position-suggestions?q=Work&limit=6');
        expect(keys.suggestions('')).toBeNull();
        expect(keys.documentXml('01k9')).toBe('/api/documents/01k9/xml');
        expect(keys.documentPdf('01k9')).toBe('/api/documents/01k9/pdf?inline=1');
```

- [ ] **Step 3: Rot**

Run: `ddev exec pnpm test`
Expected: FAIL – `apiText is not a function` bzw. `keys.taxRates is not a function`.

- [ ] **Step 4: `lib/api.ts` erweitern**

In `resources/js/lib/api.ts`:

1. `ApiOptions` um `keepalive` erweitern:

```ts
export type ApiOptions = {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    body?: unknown;
    signal?: AbortSignal;
    /** "jsonld" for paginated collections (total and next page); default plain JSON. */
    format?: 'json' | 'jsonld';
    /** Request outlives the page (saving while the tab closes; body ≤ 64 KB). */
    keepalive?: boolean;
};
```

2. `ACCEPT` und `send` ersetzen:

```ts
type Format = NonNullable<ApiOptions['format']> | 'text';

const ACCEPT: Record<Format, string> = { json: 'application/json', jsonld: 'application/ld+json', text: 'application/xml, application/problem+json' };

async function send(path: string, options: ApiOptions, format: Format): Promise<Response> {
    const method = options.method ?? 'GET';
    const headers: Record<string, string> = {
        Accept: ACCEPT[format],
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
            keepalive: options.keepalive,
            body: options.body === undefined ? undefined : JSON.stringify(options.body),
        });
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        throw new ApiError({ type: 'urn:openbill:problem:network', title: t('errors.network'), status: 0, detail: t('errors.network'), reason: 'network' });
    }
}
```

3. `api()` auf einen gemeinsamen Ablauf umstellen und `apiText` ergänzen:

```ts
/** Sends, renews the CSRF cookie once on 419, sends 401 to the login and throws every answer ≥ 400 as ApiError. */
async function request(path: string, options: ApiOptions, format: Format): Promise<Response> {
    let response = await send(path, options, format);
    // 419: the CSRF token changed (e.g. a new login in another tab): fetch a fresh cookie, then try once more
    if (response.status === 419) {
        await fetch('/sanctum/csrf-cookie', { credentials: 'same-origin' });
        response = await send(path, options, format);
    }
    if (response.status === 401) onUnauthenticated();
    if (!response.ok) throw new ApiError(await problemOf(response));
    return response;
}

/** One request to the own API with the login session. Every answer ≥ 400 throws an ApiError. */
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
    const response = await request(path, options, options.format ?? 'json');
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
}

/** A text answer (e-invoice XML); errors still arrive as Problem Details. */
export async function apiText(path: string, options: Omit<ApiOptions, 'format'> = {}): Promise<string> {
    return (await request(path, options, 'text')).text();
}
```

- [ ] **Step 5: Typen**

An `resources/js/api/types.ts` anhängen (Formen aus `DocumentResource::fromModel()`/`groups()`, `PreviewResult::toArray()`, `Totals::toArray()`, `RenderError::toArray()`, `TaxRateResource`, `UnitResource`, `TextBlockResource`, `SuggestPositions`, `DescribeDocumentPage`):

```ts
export type PositionKind = 'item' | 'text' | 'optional';
export type ComplianceProfile = 'basic' | 'en16931';
export type TextBlockKind = 'intro' | 'closing' | 'payment' | 'note';

/** A position as GET/PATCH /api/documents/{id} carries it; quantity and price are decimal strings. */
export type ApiPosition = {
    id: string;
    kind: PositionKind;
    title: string;
    description: string;
    quantity: string;
    unit_id: string | null;
    unit_price: string;
    tax_rate_id: string | null;
    custom: CustomValues;
};

/** title null = loose positions (no heading). */
export type ApiGroup = { id: string; title: string | null; positions: ApiPosition[] };

/** Compliance issue: path like "document.due_date", "positions.<id>.unit", "customer.vat_id", "org.iban". */
export type Issue = { path: string; message: string; code: string };

/**
 * Totals of the server (Totals::toArray()), all amounts as strings. lines/groups are keyed by position/group id;
 * an empty map may arrive as [] (POST /api/render does not wrap empty maps), reading a key gives undefined either way.
 */
export type Totals = {
    lines: Record<string, { net: string; tax_percent: string | null; tax_category: string | null }>;
    groups: Record<string, { title: string | null; net: string; optional_net: string }>;
    tax_breakdown: { category: string; percent: string; net: string; tax: string; gross: string }[];
    net: string;
    tax: string;
    gross: string;
    optional_net: string;
    legal_notes: string[];
    missing_tax_rate: boolean;
};

/** Item form of a document (GET /api/documents/{id}, answers of PATCH and the document actions). */
export type DocumentDetail = DocumentSummary & {
    service_date: string | null;
    service_date_end: string | null;
    intro: string;
    closing: string;
    template_id: string | null;
    custom: CustomValues;
    groups: ApiGroup[];
    totals: Totals | null;
    issues: Issue[];
    dropped_fields: string[];
};

export type Paper = { format: string; marginX: string; headerHeight: string; footerHeight: string };
export type RenderErrorItem = { part: string; file: string | null; line: number | null; message: string };

/** Answer of POST /api/render (PreviewResult::toArray()). */
export type RenderResponse = { header: string; body: string; footer: string; paper: Paper; errors: RenderErrorItem[]; totals: Totals; issues: Issue[] };

export type TaxRate = { id: string; label: string; percent: string; category: string; exemption_note: string | null; sort: number; archived_at: string | null };
export type Unit = { id: string; name: string; symbol: string; decimals: number; code: string; sort: number; archived_at: string | null };
export type TextBlock = { id: string; name: string; kind: TextBlockKind; body: string; updated_at: string | null };

/** GET /api/position-suggestions: earlier positions by title, values of their latest use. */
export type PositionSuggestion = {
    title: string;
    description: string;
    unit_id: string | null;
    unit_price: string;
    tax_rate_id: string | null;
    used_count: number;
    last_used: string;
};

/** Inertia prop "context" of documents/show (App\Actions\DescribeDocumentPage). */
export type DocumentPageContext = {
    profile: ComplianceProfile;
    next_number: string | null;
    small_business: boolean;
    chain: { id: string; type: DocumentType; status: DocumentStatus; number: string | null }[];
    templates: { id: string; name: string; document_types: DocumentType[] }[];
    allowed: { finalize: boolean; delete: boolean; duplicate: boolean; statuses: DocumentStatus[]; conversions: DocumentType[]; cancel: boolean };
};
```

Vorher prüfen, dass die Felder stimmen: `TaxRateResource` (`id, label, percent, category, exemption_note, sort, archived_at`), `UnitResource` (`id, name, symbol, decimals, code, sort, archived_at`), `TextBlockResource` (`id, name, kind, body, updated_at`) – bei Abweichung die Typen an die Ressource anpassen, nicht umgekehrt.

`resources/js/editor/types.ts`:

```ts
import type { DocumentDetail } from '@/api/types';

/** The editable part of a document, held in the editor store. */
export type Draft = Pick<
    DocumentDetail,
    'id' | 'type' | 'status' | 'date' | 'customer_id' | 'contact_id' | 'service_date' | 'service_date_end' | 'due_date' | 'valid_until' | 'intro' | 'closing' | 'template_id' | 'locale' | 'custom' | 'groups'
>;

/** Body of PATCH /api/documents/{id} and the "draft" of POST /api/render: every draft field, groups replace all groups. */
export type DraftPayload = Omit<Draft, 'id' | 'type' | 'status'>;

/** Local id → id the server gave the group or position. */
export type IdMap = Record<string, string>;

/** saved/dirty/saving: normal; error: retrying; invalid: 422 at fields; locked: finalized elsewhere; gone: deleted elsewhere. */
export type SaveState = 'saved' | 'dirty' | 'saving' | 'error' | 'invalid' | 'locked' | 'gone';
```

- [ ] **Step 6: Schlüssel und API-Funktionen**

In `resources/js/api/keys.ts` innerhalb von `keys` ergänzen:

```ts
    // archived rates and units stay readable in old drafts and finalized documents; pickers offer only active ones
    taxRates: () => apiUrl('/api/tax-rates', { include_archived: true }),
    units: () => apiUrl('/api/units', { include_archived: true }),
    textBlocks: () => '/api/text-blocks',
    /** Customer select of the editor: the first 100 by name. */
    customerChoices: () => apiUrl('/api/customers', { itemsPerPage: 100 }),
    /** Suggestions for a typed title; null (nothing to fetch) while the title is empty. */
    suggestions: (q: string) => (q.trim() ? apiUrl('/api/position-suggestions', { q: q.trim(), limit: 6 }) : null),
    documentXml: (id: string) => `/api/documents/${id}/xml`,
    documentPdf: (id: string) => `/api/documents/${id}/pdf?inline=1`,
```

Vorher prüfen: `apiUrl(…, { include_archived: true })` ergibt `include_archived=1` (Regel in `apiUrl`: `true` → `'1'`). `TaxRateProvider` liest `boolean('include_archived')` → `1` ist wahr.

`resources/js/api/documents.ts` vollständig ersetzen:

```ts
import useSWR from 'swr';
import { api, apiText } from '@/lib/api';
import type { DraftPayload } from '@/editor/types';
import { keys } from './keys';
import { invalidate, usePagedList, type PagedList } from './paged';
import type { DocumentDetail, DocumentFilters, DocumentStatus, DocumentSummary, DocumentType, RenderResponse } from './types';

export function useDocumentList(filters: DocumentFilters): PagedList<DocumentSummary> {
    return usePagedList<DocumentSummary>((page) => keys.documents(filters, page));
}

/** Item form with groups, totals and (drafts) compliance issues. */
export function useDocument(id: string) {
    return useSWR<DocumentDetail>(keys.document(id));
}

export async function createDocument(input: { type: DocumentType; customer_id: string | null }): Promise<DocumentSummary> {
    const document = await api<DocumentSummary>('/api/documents', { method: 'POST', body: input });
    void invalidate('/api/documents');
    return document;
}

/** Autosave target. The answer carries the server ids of new groups and positions (same order as sent). */
export function saveDraft(id: string, payload: DraftPayload, options: { keepalive?: boolean } = {}): Promise<DocumentDetail> {
    return api<DocumentDetail>(keys.document(id), { method: 'PATCH', body: payload, keepalive: options.keepalive });
}

export type RenderRequest = { document_id: string; draft?: DraftPayload };

/** Rendered parts, totals and issues of the saved document, with the unsaved draft on top when given. */
export function renderPreview(body: RenderRequest, signal?: AbortSignal): Promise<RenderResponse> {
    return api<RenderResponse>('/api/render', { method: 'POST', body, signal });
}

/** After an action: the document's cache gets the answer, lists and other details reload. */
async function settle(document: DocumentDetail): Promise<DocumentDetail> {
    void invalidate('/api/documents', [keys.document(document.id)]);
    return document;
}

const action = (id: string, name: string, body?: unknown) => api<DocumentDetail>(`${keys.document(id)}/${name}`, { method: 'POST', body: body ?? {} });

export const finalizeDocument = async (id: string) => settle(await action(id, 'finalize'));
export const setDocumentStatus = async (id: string, status: DocumentStatus) => settle(await action(id, 'status', { status }));
export const convertDocument = async (id: string, type: DocumentType) => settle(await action(id, 'convert', { type }));
export const cancelInvoice = async (id: string) => settle(await action(id, 'cancel'));
export const duplicateDocument = async (id: string) => settle(await action(id, 'duplicate'));

export async function deleteDocument(id: string, options: { keepalive?: boolean } = {}): Promise<void> {
    await api<void>(keys.document(id), { method: 'DELETE', keepalive: options.keepalive });
    void invalidate('/api/documents', [keys.document(id)]);
}

export function fetchXml(id: string): Promise<string> {
    return apiText(keys.documentXml(id));
}
```

`resources/js/api/master-data.ts`:

```ts
import useSWR from 'swr';
import { apiPage, type Page } from '@/lib/api';
import { keys } from './keys';
import type { Customer, PositionSuggestion, TaxRate, TextBlock, Unit } from './types';

const STATIC = { revalidateOnFocus: false };

export function useTaxRates() {
    return useSWR<TaxRate[]>(keys.taxRates(), STATIC);
}

export function useUnits() {
    return useSWR<Unit[]>(keys.units(), STATIC);
}

export function useTextBlocks() {
    return useSWR<TextBlock[]>(keys.textBlocks(), STATIC);
}

export function useCustomerChoices() {
    return useSWR<Page<Customer>>(keys.customerChoices(), (url: string) => apiPage<Customer>(url), STATIC);
}

/** Up to six earlier positions whose title contains the (debounced) input. */
export function usePositionSuggestions(q: string) {
    return useSWR<PositionSuggestion[]>(keys.suggestions(q), { revalidateOnFocus: false, keepPreviousData: false });
}
```

Prüfen, ob `/api/tax-rates`, `/api/units`, `/api/text-blocks` ohne `Accept: application/ld+json` ein **Array** liefern (Collections mit `paginationEnabled: false` in JSON):

Run: `ddev exec 'curl -s -H "Accept: application/json" -b /dev/null https://openbill.ddev.site/api/units -o /dev/null -w "%{http_code}\n"'`
Expected: `401` (ohne Session) – bestätigt die Route. Die Form prüft `tests/Feature/Api/MasterDataApiTest.php` (`assertJsonIsArray` bzw. `json()` als Liste); nachsehen und bei einer Objekt-Hülle die Hooks auf `.member` umstellen.

- [ ] **Step 7: Grün**

Run: `ddev exec pnpm test && ddev exec pnpm typecheck`
Expected: alle Vitest-Dateien PASS (inkl. der neuen Fälle), `tsc` ohne Fehler. `pages/documents/show.tsx` nutzt noch `DocumentSummary`-Felder, die in `DocumentDetail` enthalten sind – kompiliert weiter.

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-lock.yaml resources/js/api resources/js/lib/api.ts resources/js/lib/api.test.ts resources/js/editor/types.ts
git commit -m "feat(editor): API types, document actions, master data hooks, keepalive and text requests" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 5: Reine Entwurfs-Operationen (Gruppen, Positionen, ID-Abgleich)

**Files:**
- Create: `resources/js/editor/ops.ts`
- Test: `resources/js/editor/ops.test.ts`

**Interfaces:**
- Consumes: `Draft`, `DraftPayload`, `IdMap` (Task 4), `ApiGroup`, `ApiPosition`, `PositionKind`, `CustomValues`, `DocumentDetail` (Task 4).
- Produces: alle Funktionen aus `ops.ts` (Abschnitt „Interfaces“). Store (Task 7) und Komponenten (Task 9–11) rufen nur diese Funktionen, um den Entwurf zu ändern.

- [ ] **Step 1: Failing Tests**

`resources/js/editor/ops.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { ApiGroup, ApiPosition, DocumentDetail } from '@/api/types';
import * as ops from './ops';
import type { Draft } from './types';

const position = (id: string, title = id, extra: Partial<ApiPosition> = {}): ApiPosition => ({
    id,
    kind: 'item',
    title,
    description: '',
    quantity: '1',
    unit_id: 'unit-h',
    unit_price: '100',
    tax_rate_id: 'rate-19',
    custom: {},
    ...extra,
});

const group = (id: string, title: string | null, positions: ApiPosition[]): ApiGroup => ({ id, title, positions });

const draft = (groups: ApiGroup[]): Draft => ({
    id: 'doc',
    type: 'offer',
    status: 'draft',
    date: '2026-10-11',
    customer_id: 'cust',
    contact_id: null,
    service_date: null,
    service_date_end: null,
    due_date: null,
    valid_until: '2026-10-25',
    intro: '',
    closing: '',
    template_id: 'tpl',
    locale: 'de',
    custom: { project_name: 'Relaunch' },
    groups,
});

const ids = (d: Draft) => d.groups.map((g) => `${g.id}:${g.positions.map((p) => p.id).join(',')}`);
const defaults = { unitId: 'unit-h', taxRateId: 'rate-19', custom: { ticket: null } };

describe('ids', () => {
    it('marks local ids', () => {
        const id = ops.localId();
        expect(id.startsWith(ops.LOCAL_PREFIX)).toBe(true);
        expect(ops.isLocalId(id)).toBe(true);
        expect(ops.isLocalId('01k9xyz')).toBe(false);
    });
});

describe('newPosition', () => {
    it('prices items with the defaults and leaves text lines empty', () => {
        const item = ops.newPosition('item', defaults);
        const text = ops.newPosition('text', defaults);

        expect(item).toMatchObject({ kind: 'item', quantity: '1', unit_price: '0', unit_id: 'unit-h', tax_rate_id: 'rate-19', custom: { ticket: null } });
        expect(text).toMatchObject({ kind: 'text', quantity: '0', unit_price: '0', unit_id: null, tax_rate_id: null, custom: {} });
        expect(ops.isLocalId(item.id)).toBe(true);
    });
});

describe('positions', () => {
    const base = draft([group('g1', 'Konzept', [position('a'), position('b')]), group('g2', 'Umsetzung', [position('c')])]);

    it('adds after a position or at the end', () => {
        expect(ids(ops.addPosition(base, 'g1', position('x'), 'a'))).toEqual(['g1:a,x,b', 'g2:c']);
        expect(ids(ops.addPosition(base, 'g2', position('x')))).toEqual(['g1:a,b', 'g2:c,x']);
    });

    it('updates one position and leaves the rest untouched (same objects)', () => {
        const next = ops.updatePosition(base, 'b', { title: 'Workshop', unit_price: '450' });

        expect(next.groups[0].positions[1]).toMatchObject({ title: 'Workshop', unit_price: '450' });
        expect(next.groups[1]).toBe(base.groups[1]);
        expect(base.groups[0].positions[1].title).toBe('b');
    });

    it('removes a position and restores it at its place', () => {
        const removed = ops.removePosition(base, 'a');

        expect(ids(removed.draft)).toEqual(['g1:b', 'g2:c']);
        expect(removed).toMatchObject({ groupId: 'g1', index: 0 });
        expect(ids(ops.restorePosition(removed.draft, 'g1', removed.position!, removed.index))).toEqual(['g1:a,b', 'g2:c']);
    });

    it('restores into a new loose group when its group is gone', () => {
        const removed = ops.removePosition(base, 'c');
        const withoutGroup = ops.removeGroup(removed.draft, 'g2').draft;
        const restored = ops.restorePosition(withoutGroup, 'g2', removed.position!, 0);

        expect(restored.groups[0].title).toBeNull();
        expect(restored.groups[0].positions.map((p) => p.id)).toEqual(['c']);
    });

    it('switches kinds: text drops amounts, item restores quantity and defaults', () => {
        const text = ops.setPositionKind(base, 'a', 'text', defaults);
        expect(text.groups[0].positions[0]).toMatchObject({ kind: 'text', quantity: '0', unit_price: '0', unit_id: null, tax_rate_id: null });

        const item = ops.setPositionKind(text, 'a', 'item', defaults);
        expect(item.groups[0].positions[0]).toMatchObject({ kind: 'item', quantity: '1', unit_id: 'unit-h', tax_rate_id: 'rate-19' });

        const optional = ops.setPositionKind(base, 'b', 'optional', defaults);
        expect(optional.groups[0].positions[1]).toMatchObject({ kind: 'optional', quantity: '1', unit_price: '100' });
    });

    it('moves within a group, across groups and clamps the index', () => {
        expect(ids(ops.movePosition(base, 'a', 'g1', 1))).toEqual(['g1:b,a', 'g2:c']);
        expect(ids(ops.movePosition(base, 'a', 'g2', 0))).toEqual(['g1:b', 'g2:a,c']);
        expect(ids(ops.movePosition(base, 'a', 'g2', 99))).toEqual(['g1:b', 'g2:c,a']);
        expect(ops.movePosition(base, 'missing', 'g2', 0)).toBe(base);
    });

    it('finds the group of a position', () => {
        expect(ops.groupOf(base, 'c')?.id).toBe('g2');
        expect(ops.groupOf(base, 'missing')).toBeUndefined();
    });
});

describe('groups', () => {
    const base = draft([group('loose', null, [position('a')]), group('g1', 'Konzept', [position('b')]), group('g2', 'Umsetzung', [position('c')])]);

    it('adds at the end or at the start', () => {
        expect(ids(ops.addGroup(base, 'Betrieb', position('x'))).at(-1)).toMatch(/:x$/);
        const first = ops.addGroup(base, null, position('y'), true);
        expect(first.groups[0]).toMatchObject({ title: null, positions: [expect.objectContaining({ id: 'y' })] });
        expect(ops.isLocalId(first.groups[0].id)).toBe(true);
    });

    it('renames', () => {
        expect(ops.updateGroup(base, 'g1', { title: 'Analyse' }).groups[1].title).toBe('Analyse');
    });

    it('moves groups (drag and drop) and ignores invalid indexes', () => {
        expect(ids(ops.moveGroup(base, 2, 0))).toEqual(['g2:c', 'loose:a', 'g1:b']);
        expect(ids(ops.moveGroup(base, 0, 2))).toEqual(['g1:b', 'g2:c', 'loose:a']);
        expect(ops.moveGroup(base, 5, 0)).toBe(base);
        expect(ops.moveGroup(base, 1, 1)).toBe(base);
    });

    it('removes a group with its positions and restores it at its place (undo)', () => {
        const removed = ops.removeGroup(base, 'g1');

        expect(ids(removed.draft)).toEqual(['loose:a', 'g2:c']);
        expect(removed.index).toBe(1);
        expect(ids(ops.restoreGroup(removed.draft, removed.group!, removed.index))).toEqual(ids(base));
    });

    it('dissolves a group into the loose positions, or turns it loose when there are none', () => {
        expect(ids(ops.dissolveGroup(base, 'g1'))).toEqual(['loose:a,b', 'g2:c']);

        const noLoose = draft([group('g1', 'Konzept', [position('b')])]);
        expect(ops.dissolveGroup(noLoose, 'g1').groups[0]).toMatchObject({ id: 'g1', title: null });
    });
});

describe('texts', () => {
    it('appends a text block after a blank line', () => {
        expect(ops.appendText('', 'Vielen Dank.')).toBe('Vielen Dank.');
        expect(ops.appendText('Hallo,\n  ', 'Vielen Dank.')).toBe('Hallo,\n\nVielen Dank.');
    });
});

describe('server state', () => {
    const detail = {
        ...draft([group('g1', 'Konzept', [position('a', 'Workshop', { custom: { ticket: 'SHOP-1' } })])]),
        number: null,
        customer_name: 'Hafenkontor Lindqvist GmbH',
        source_id: null,
        cancelled_by_id: null,
        is_locked: false,
        is_overdue: false,
        finalized_at: null,
        paid_at: null,
        net_total: '100.00',
        tax_total: '19.00',
        gross_total: '119.00',
        created_at: null,
        updated_at: null,
        totals: null,
        issues: [],
        dropped_fields: [],
    } satisfies DocumentDetail;

    it('takes the editable part of a document as a deep copy', () => {
        const d = ops.fromDocument(detail);

        expect(d).toMatchObject({ id: 'doc', type: 'offer', status: 'draft', valid_until: '2026-10-25' });
        expect(d).not.toHaveProperty('gross_total');
        expect(d.groups[0].positions[0].custom).not.toBe(detail.groups[0].positions[0].custom);
    });

    it('builds the PATCH body with every draft field and without id, type, status', () => {
        const payload = ops.toPayload(ops.fromDocument(detail));

        expect(Object.keys(payload).sort()).toEqual(
            ['closing', 'contact_id', 'custom', 'customer_id', 'date', 'due_date', 'groups', 'intro', 'locale', 'service_date', 'service_date_end', 'template_id', 'valid_until'].sort(),
        );
    });

    it('compares payloads independent of key order', () => {
        const a = ops.toPayload(ops.fromDocument(detail));
        const b = { ...a, custom: { project_name: 'Relaunch' } };
        const reordered = JSON.parse(JSON.stringify({ groups: a.groups, ...a })) as typeof a;

        expect(ops.samePayload(a, reordered)).toBe(true);
        expect(ops.samePayload(a, { ...b, intro: 'Hallo' })).toBe(false);
        expect(ops.samePayload(a, null)).toBe(false);
    });

    it('maps local ids to the server ids by position in the answer', () => {
        const sent = ops.toPayload(draft([group('local-g', 'Neu', [position('local-p'), position('b')]), group('g2', null, [position('local-q')])]));
        const saved = [group('01G', 'Neu', [position('01P'), position('b')]), group('g2', null, [position('01Q')])];

        expect(ops.idMap(sent, saved)).toEqual({ 'local-g': '01G', 'local-p': '01P', 'local-q': '01Q' });
        expect(ops.idMap(sent, saved.slice(0, 1))).toEqual({});
    });

    it('replaces ids in the current draft, also when it changed meanwhile (typing during the save)', () => {
        const current = draft([group('local-g', 'Neu', [position('local-p', 'Workshop, getippt während des Speicherns'), position('local-new')])]);

        const next = ops.reconcileIds(current, { 'local-g': '01G', 'local-p': '01P' });

        expect(ids(next)).toEqual(['01G:01P,local-new']);
        expect(next.groups[0].positions[0].title).toBe('Workshop, getippt während des Speicherns');
        expect(ops.reconcileIds(current, {})).toBe(current);
    });
});
```

- [ ] **Step 2: Rot**

Run: `ddev exec pnpm test -- resources/js/editor/ops.test.ts`
Expected: FAIL – `Failed to resolve import "./ops"`.

- [ ] **Step 3: Implementierung**

`resources/js/editor/ops.ts`:

```ts
import type { ApiGroup, ApiPosition, CustomValues, DocumentDetail, PositionKind } from '@/api/types';
import type { Draft, DraftPayload, IdMap } from './types';

/**
 * Pure operations on the local draft. They only rearrange data – amounts stay the strings the user typed,
 * totals and checks come from the server (POST /api/render).
 */

export const LOCAL_PREFIX = 'local-';

/** Id of a group or position the server has not seen yet (GroupWriter gives it a ULID on save). */
export function localId(): string {
    return `${LOCAL_PREFIX}${crypto.randomUUID()}`;
}

export function isLocalId(id: string): boolean {
    return id.startsWith(LOCAL_PREFIX);
}

export type PositionDefaults = { unitId: string | null; taxRateId: string | null; custom: CustomValues };

export function newPosition(kind: PositionKind, defaults: PositionDefaults): ApiPosition {
    const priced = kind !== 'text';
    return {
        id: localId(),
        kind,
        title: '',
        description: '',
        quantity: priced ? '1' : '0',
        unit_id: priced ? defaults.unitId : null,
        unit_price: '0',
        tax_rate_id: priced ? defaults.taxRateId : null,
        custom: priced ? { ...defaults.custom } : {},
    };
}

const copyGroups = (groups: ApiGroup[]): ApiGroup[] =>
    groups.map((group) => ({ ...group, positions: group.positions.map((position) => ({ ...position, custom: { ...position.custom } })) }));

export function fromDocument(document: DocumentDetail): Draft {
    return {
        id: document.id,
        type: document.type,
        status: document.status,
        date: document.date,
        customer_id: document.customer_id,
        contact_id: document.contact_id,
        service_date: document.service_date,
        service_date_end: document.service_date_end,
        due_date: document.due_date,
        valid_until: document.valid_until,
        intro: document.intro,
        closing: document.closing,
        template_id: document.template_id,
        locale: document.locale,
        custom: { ...document.custom },
        groups: copyGroups(document.groups),
    };
}

export function toPayload(draft: Draft): DraftPayload {
    return {
        date: draft.date,
        customer_id: draft.customer_id,
        contact_id: draft.contact_id,
        service_date: draft.service_date,
        service_date_end: draft.service_date_end,
        due_date: draft.due_date,
        valid_until: draft.valid_until,
        intro: draft.intro,
        closing: draft.closing,
        template_id: draft.template_id,
        locale: draft.locale,
        custom: draft.custom,
        groups: draft.groups,
    };
}

/** JSON with sorted object keys: the server may order custom values differently than the browser. */
function stable(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
    if (value !== null && typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
        return `{${entries.map(([key, v]) => `${JSON.stringify(key)}:${stable(v)}`).join(',')}}`;
    }
    return JSON.stringify(value) ?? 'null';
}

export function samePayload(a: DraftPayload | null, b: DraftPayload | null): boolean {
    if (a === null || b === null) return false;
    return stable(a) === stable(b);
}

const mapGroups = (draft: Draft, fn: (group: ApiGroup) => ApiGroup): Draft => ({ ...draft, groups: draft.groups.map(fn) });

export function groupOf(draft: Draft, positionId: string): ApiGroup | undefined {
    return draft.groups.find((group) => group.positions.some((p) => p.id === positionId));
}

export function addPosition(draft: Draft, groupId: string, position: ApiPosition, afterId?: string): Draft {
    return mapGroups(draft, (group) => {
        if (group.id !== groupId) return group;
        const positions = [...group.positions];
        const index = afterId ? positions.findIndex((p) => p.id === afterId) : -1;
        positions.splice(index < 0 ? positions.length : index + 1, 0, position);
        return { ...group, positions };
    });
}

export function updatePosition(draft: Draft, id: string, patch: Partial<ApiPosition>): Draft {
    return mapGroups(draft, (group) =>
        group.positions.some((p) => p.id === id) ? { ...group, positions: group.positions.map((p) => (p.id === id ? { ...p, ...patch } : p)) } : group,
    );
}

const ZERO = /^-?0*(\.0*)?$/;

/** Text lines carry no amounts; items/optional ones get a quantity and the defaults back. */
export function setPositionKind(draft: Draft, id: string, kind: PositionKind, defaults: PositionDefaults): Draft {
    const current = draft.groups.flatMap((group) => group.positions).find((p) => p.id === id);
    if (!current || current.kind === kind) return draft;
    if (kind === 'text') return updatePosition(draft, id, { kind, quantity: '0', unit_price: '0', unit_id: null, tax_rate_id: null });
    return updatePosition(draft, id, {
        kind,
        quantity: current.quantity === '' || ZERO.test(current.quantity) ? '1' : current.quantity,
        unit_id: current.unit_id ?? defaults.unitId,
        tax_rate_id: current.tax_rate_id ?? defaults.taxRateId,
    });
}

export function removePosition(draft: Draft, id: string): { draft: Draft; position: ApiPosition | null; groupId: string | null; index: number } {
    const group = groupOf(draft, id);
    if (!group) return { draft, position: null, groupId: null, index: -1 };
    const index = group.positions.findIndex((p) => p.id === id);
    return {
        draft: mapGroups(draft, (g) => (g.id === group.id ? { ...g, positions: g.positions.filter((p) => p.id !== id) } : g)),
        position: group.positions[index],
        groupId: group.id,
        index,
    };
}

/** Undo of removePosition: back at its index, or in a new loose group when its group is gone. */
export function restorePosition(draft: Draft, groupId: string, position: ApiPosition, index: number): Draft {
    if (!draft.groups.some((g) => g.id === groupId)) return addGroup(draft, null, position, true);
    return mapGroups(draft, (group) => {
        if (group.id !== groupId) return group;
        const positions = [...group.positions];
        positions.splice(Math.max(0, Math.min(index, positions.length)), 0, position);
        return { ...group, positions };
    });
}

export function addGroup(draft: Draft, title: string | null, first: ApiPosition, atStart = false): Draft {
    const group: ApiGroup = { id: localId(), title, positions: [first] };
    return { ...draft, groups: atStart ? [group, ...draft.groups] : [...draft.groups, group] };
}

export function updateGroup(draft: Draft, id: string, patch: Partial<Pick<ApiGroup, 'title'>>): Draft {
    return mapGroups(draft, (group) => (group.id === id ? { ...group, ...patch } : group));
}

export function removeGroup(draft: Draft, id: string): { draft: Draft; group: ApiGroup | null; index: number } {
    const index = draft.groups.findIndex((g) => g.id === id);
    if (index < 0) return { draft, group: null, index };
    return { draft: { ...draft, groups: draft.groups.filter((g) => g.id !== id) }, group: draft.groups[index], index };
}

export function restoreGroup(draft: Draft, group: ApiGroup, index: number): Draft {
    const groups = [...draft.groups];
    groups.splice(Math.max(0, Math.min(index, groups.length)), 0, group);
    return { ...draft, groups };
}

/** The positions of a group join the loose positions (no heading); without loose positions the group loses its title. */
export function dissolveGroup(draft: Draft, id: string): Draft {
    const group = draft.groups.find((g) => g.id === id);
    if (!group) return draft;
    const loose = draft.groups.find((g) => g.title === null && g.id !== id);
    if (!loose) return updateGroup(draft, id, { title: null });
    return {
        ...draft,
        groups: draft.groups.filter((g) => g.id !== id).map((g) => (g.id === loose.id ? { ...g, positions: [...g.positions, ...group.positions] } : g)),
    };
}

export function moveGroup(draft: Draft, from: number, to: number): Draft {
    const count = draft.groups.length;
    if (from === to || from < 0 || to < 0 || from >= count || to >= count) return draft;
    const groups = [...draft.groups];
    const [moved] = groups.splice(from, 1);
    groups.splice(to, 0, moved);
    return { ...draft, groups };
}

/** Moves a position into a group at an index (also within the same group). */
export function movePosition(draft: Draft, positionId: string, toGroupId: string, toIndex: number): Draft {
    const from = groupOf(draft, positionId);
    if (!from || !draft.groups.some((g) => g.id === toGroupId)) return draft;
    const moved = from.positions.find((p) => p.id === positionId)!;
    const without = draft.groups.map((g) => (g.id === from.id ? { ...g, positions: g.positions.filter((p) => p.id !== positionId) } : g));
    return {
        ...draft,
        groups: without.map((g) => {
            if (g.id !== toGroupId) return g;
            const positions = [...g.positions];
            positions.splice(Math.max(0, Math.min(toIndex, positions.length)), 0, moved);
            return { ...g, positions };
        }),
    };
}

/** Text block into the introduction/closing: after a blank line, or alone when the field is empty. */
export function appendText(current: string, block: string): string {
    return current.trim() ? `${current.trimEnd()}\n\n${block}` : block;
}

/**
 * Which ids the server gave the sent groups and positions: the answer lists them in the order they were sent.
 * Different shapes (another save in between) give an empty map – the next save sends the local ids again.
 */
export function idMap(sent: DraftPayload, saved: ApiGroup[]): IdMap {
    const map: IdMap = {};
    if (sent.groups.length !== saved.length) return map;
    sent.groups.forEach((group, g) => {
        const target = saved[g];
        if (group.id !== target.id) map[group.id] = target.id;
        if (group.positions.length !== target.positions.length) return;
        group.positions.forEach((position, p) => {
            if (position.id !== target.positions[p].id) map[position.id] = target.positions[p].id;
        });
    });
    return map;
}

export function reconcileIds(draft: Draft, map: IdMap): Draft {
    if (Object.keys(map).length === 0) return draft;
    return {
        ...draft,
        groups: draft.groups.map((group) => ({
            ...group,
            id: map[group.id] ?? group.id,
            positions: group.positions.map((position) => (map[position.id] ? { ...position, id: map[position.id] } : position)),
        })),
    };
}
```

- [ ] **Step 4: Grün**

Run: `ddev exec pnpm test -- resources/js/editor/ops.test.ts && ddev exec pnpm typecheck`
Expected: PASS (alle `ops`-Tests), `tsc` ohne Fehler.

- [ ] **Step 5: Commit**

```bash
git add resources/js/editor/ops.ts resources/js/editor/ops.test.ts
git commit -m "feat(editor): pure draft operations for groups, positions and server ids" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 6: Zahlen-Eingabe, Feldpfade und Sprung

**Files:**
- Create: `resources/js/editor/decimal.ts`, `resources/js/editor/paths.ts`, `resources/js/editor/jump.ts`
- Test: `resources/js/editor/decimal.test.ts`, `resources/js/editor/paths.test.ts`

**Interfaces:**
- Consumes: `Draft` (Task 4), `Violation` (`lib/api.ts`), `Issue` (Task 4), `intlLocale` (`lib/format.ts`).
- Produces: `parseDecimalInput`, `formatDecimalInput`, `isZeroDecimal`, `violationPath`, `fieldErrors`, `issuePaths`, `jumpTo`, `jumpToIssue` (Abschnitt „Interfaces“; `jumpToIssue(path: string, expand: () => void): void` zusätzlich).

`data-path`-Konvention (gilt für alle Komponenten ab Task 9 und für Issue-Pfade des Servers): `document.customer`, `document.contact`, `document.date`, `document.valid_until`, `document.service_date`, `document.service_date_end`, `document.due_date`, `document.template`, `document.intro`, `document.closing`, `document.custom.<key>`, `groups.<id>.title`, `positions` (ganzer Positionsbereich), `positions.<id>.title|description|quantity|unit|unit_price|tax_rate|kind|custom.<key>`.

- [ ] **Step 1: Failing Tests**

`resources/js/editor/decimal.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatDecimalInput, isZeroDecimal, parseDecimalInput } from './decimal';

describe('parseDecimalInput', () => {
    it('turns typed numbers into API strings with a dot', () => {
        expect(parseDecimalInput('12,5')).toBe('12.5');
        expect(parseDecimalInput('12.5')).toBe('12.5');
        expect(parseDecimalInput('1.234,50')).toBe('1234.50');
        expect(parseDecimalInput('1,234.50')).toBe('1234.50');
        expect(parseDecimalInput('1 234,5')).toBe('1234.5');
        expect(parseDecimalInput('-2')).toBe('-2');
        expect(parseDecimalInput(' 3 ')).toBe('3');
    });

    it('reads an empty field as 0', () => {
        expect(parseDecimalInput('')).toBe('0');
        expect(parseDecimalInput('   ')).toBe('0');
    });

    it('refuses what the API would refuse', () => {
        expect(parseDecimalInput('abc')).toBe('invalid');
        expect(parseDecimalInput('1e3')).toBe('invalid');
        expect(parseDecimalInput('1,2,3')).toBe('invalid');
        expect(parseDecimalInput('1.23456')).toBe('invalid');
        expect(parseDecimalInput('1.234567', 6)).toBe('1.234567');
        expect(parseDecimalInput('--1')).toBe('invalid');
    });
});

describe('formatDecimalInput', () => {
    it('shows API strings in the UI language without grouping or trailing zeros', () => {
        expect(formatDecimalInput('2.0000', 'en')).toBe('2');
        expect(formatDecimalInput('1234.5', 'de')).toBe('1234,5');
        expect(formatDecimalInput('1234.5', 'en')).toBe('1234.5');
        expect(formatDecimalInput('-1.5', 'de')).toBe('-1,5');
    });

    it('keeps two decimals for prices when asked', () => {
        expect(formatDecimalInput('450.0000', 'de', 2)).toBe('450,00');
        expect(formatDecimalInput('0.125', 'en', 2)).toBe('0.125');
    });

    it('leaves anything that is not a decimal string as it is', () => {
        expect(formatDecimalInput('abc', 'en')).toBe('abc');
    });
});

describe('isZeroDecimal', () => {
    it('recognizes zero in every spelling of the API', () => {
        expect(isZeroDecimal('0.00')).toBe(true);
        expect(isZeroDecimal('-0.0000')).toBe(true);
        expect(isZeroDecimal('0')).toBe(true);
        expect(isZeroDecimal('0.01')).toBe(false);
        expect(isZeroDecimal('10')).toBe(false);
    });
});
```

`resources/js/editor/paths.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { ApiPosition } from '@/api/types';
import { fieldErrors, issuePaths, violationPath } from './paths';

const p = (id: string): ApiPosition => ({ id, kind: 'item', title: '', description: '', quantity: '1', unit_id: null, unit_price: '0', tax_rate_id: null, custom: {} });
const draft = { groups: [{ id: 'g1', title: 'Konzept', positions: [p('a'), p('b')] }, { id: 'g2', title: null, positions: [p('c')] }] };

describe('violationPath', () => {
    it('maps position paths of the API to the field of that row', () => {
        expect(violationPath(draft, 'groups.0.positions.1.quantity')).toBe('positions.b.quantity');
        expect(violationPath(draft, 'groups.1.positions.0.unit_id')).toBe('positions.c.unit');
        expect(violationPath(draft, 'groups.0.positions.0.tax_rate_id')).toBe('positions.a.tax_rate');
        expect(violationPath(draft, 'groups.0.positions.0.custom.ticket')).toBe('positions.a.custom.ticket');
        expect(violationPath(draft, 'draft.groups.0.positions.1.unit_price')).toBe('positions.b.unit_price');
    });

    it('maps group and document paths', () => {
        expect(violationPath(draft, 'groups.0.title')).toBe('groups.g1.title');
        expect(violationPath(draft, 'customer_id')).toBe('document.customer');
        expect(violationPath(draft, 'contact_id')).toBe('document.contact');
        expect(violationPath(draft, 'due_date')).toBe('document.due_date');
        expect(violationPath(draft, 'custom.project_name')).toBe('document.custom.project_name');
        expect(violationPath(draft, 'template_id')).toBe('document.template');
    });

    it('keeps paths that already are field paths (compliance issues of a refused finalize)', () => {
        expect(violationPath(draft, 'positions.a.unit')).toBe('positions.a.unit');
        expect(violationPath(draft, 'document.due_date')).toBe('document.due_date');
        expect(violationPath(draft, 'customer.vat_id')).toBe('customer.vat_id');
        expect(violationPath(draft, 'org.iban')).toBe('org.iban');
    });

    it('falls back to the positions area for rows that no longer exist', () => {
        expect(violationPath(draft, 'groups.5.positions.0.title')).toBe('positions');
        expect(violationPath(draft, 'groups')).toBe('positions');
    });
});

describe('fieldErrors', () => {
    it('keeps the first message per field', () => {
        expect(
            fieldErrors(draft, [
                { path: 'groups.0.positions.0.quantity', message: 'Enter a number.' },
                { path: 'groups.0.positions.0.quantity', message: 'Second.' },
                { path: 'date', message: 'Date is missing.' },
            ]),
        ).toEqual({ 'positions.a.quantity': 'Enter a number.', 'document.date': 'Date is missing.' });
    });
});

describe('issuePaths', () => {
    it('collects the paths of compliance issues', () => {
        expect([...issuePaths([{ path: 'document.due_date', message: '', code: 'due_date_missing' }])]).toEqual(['document.due_date']);
    });
});
```

- [ ] **Step 2: Rot**

Run: `ddev exec pnpm test -- resources/js/editor`
Expected: FAIL – `Failed to resolve import "./decimal"` / `"./paths"`.

- [ ] **Step 3: Implementierung**

`resources/js/editor/decimal.ts`:

```ts
import { intlLocale } from '@/lib/format';

const DECIMAL = /^-?\d+(?:\.\d+)?$/;

/**
 * Normalizes separators of a typed number: the last of "," and "." is the decimal separator, the other one groups.
 * "1.234,50" → "1234.50", "1,234.50" → "1234.50", "12,5" → "12.5". Spaces (also narrow ones) are dropped.
 */
function normalize(raw: string): string {
    const value = raw.trim().replace(/[\s  ']/g, '');
    const comma = value.lastIndexOf(',');
    const dot = value.lastIndexOf('.');
    if (comma >= 0 && dot >= 0) return comma > dot ? value.replace(/\./g, '').replace(',', '.') : value.replace(/,/g, '');
    if (comma >= 0 && value.indexOf(',') === comma) return value.replace(',', '.');
    return value;
}

/**
 * A typed quantity or price as the API takes it (string with a dot, at most `scale` decimals).
 * Empty counts as 0; anything else the API would refuse is 'invalid' and is not sent.
 * Only the format is checked here – nothing is calculated.
 */
export function parseDecimalInput(raw: string, scale = 4): string | 'invalid' {
    const value = normalize(raw);
    if (value === '') return '0';
    if (!DECIMAL.test(value)) return 'invalid';
    return (value.split('.')[1] ?? '').length > scale ? 'invalid' : value;
}

/** An API decimal string for an input field in the UI language: no grouping (typing it back stays unambiguous). */
export function formatDecimalInput(value: string, locale?: string, minFraction = 0): string {
    if (!DECIMAL.test(value)) return value;
    const format = new Intl.NumberFormat(intlLocale(locale), { useGrouping: false, minimumFractionDigits: minFraction, maximumFractionDigits: 4 })
        .format as unknown as (v: string) => string;
    return format(value);
}

/** "0", "0.00", "-0.0000" – a format check of an API string (optional sums, removed rows), no arithmetic. */
export function isZeroDecimal(value: string): boolean {
    return DECIMAL.test(value) && /^-?0+(\.0+)?$/.test(value);
}
```

Hinweis: `Intl.NumberFormat.format(string)` formatiert Dezimalstrings exakt (ES2023, wie `formatMoney`); der Cast entspricht `lib/format.ts`.

`resources/js/editor/paths.ts`:

```ts
import type { Issue } from '@/api/types';
import type { Violation } from '@/lib/api';
import type { Draft } from './types';

/** Position fields whose data-path differs from the API key (issue paths use "unit" and "tax_rate"). */
const POSITION_FIELD: Record<string, string> = { unit_id: 'unit', tax_rate_id: 'tax_rate' };
const DOCUMENT_FIELD: Record<string, string> = { customer_id: 'customer', contact_id: 'contact', template_id: 'template' };

/**
 * data-path of the field a validation error of PATCH /api/documents/{id} (or of "draft." in POST /api/render) belongs to.
 * Index paths are resolved against the groups that were sent.
 */
export function violationPath(draft: Pick<Draft, 'groups'>, apiPath: string): string {
    const path = apiPath.startsWith('draft.') ? apiPath.slice('draft.'.length) : apiPath;
    // compliance issues (422 of finalize) already carry field paths
    if (/^(positions|document|customer|contact|org)(\.|$)/.test(path)) return path;

    const position = /^groups\.(\d+)\.positions\.(\d+)\.(.+)$/.exec(path);
    if (position) {
        const row = draft.groups[Number(position[1])]?.positions[Number(position[2])];
        return row ? `positions.${row.id}.${POSITION_FIELD[position[3]] ?? position[3]}` : 'positions';
    }
    const group = /^groups\.(\d+)\.(.+)$/.exec(path);
    if (group) {
        const target = draft.groups[Number(group[1])];
        return target && !group[2].startsWith('positions') ? `groups.${target.id}.${group[2]}` : 'positions';
    }
    if (path === 'groups' || path.startsWith('groups.')) return 'positions';

    const [head, ...rest] = path.split('.');
    return ['document', DOCUMENT_FIELD[head] ?? head, ...rest].join('.');
}

export function fieldErrors(draft: Pick<Draft, 'groups'>, violations: Violation[]): Record<string, string> {
    const errors: Record<string, string> = {};
    for (const violation of violations) errors[violationPath(draft, violation.path)] ??= violation.message;
    return errors;
}

export function issuePaths(issues: Issue[]): Set<string> {
    return new Set(issues.map((issue) => issue.path));
}
```

`resources/js/editor/jump.ts` (Port von `prototypes/clickdummy-v2/src/routes/documents/editor/jump.ts`, im Browser geprüft durch Playwright in Task 14):

```ts
/** Scrolls to the field with this data-path, focuses its first input and lets it light up briefly (.flash in editor.css). */
export function jumpTo(path: string): boolean {
    const element = document.querySelector<HTMLElement>(`[data-path="${CSS.escape(path)}"]`);
    if (!element) return false;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const input = element.matches('input, select, textarea') ? element : element.querySelector<HTMLElement>('input, select, textarea, button');
    window.setTimeout(() => input?.focus({ preventScroll: true }), 250);
    element.classList.remove('flash');
    void element.offsetWidth; // restart the animation
    element.classList.add('flash');
    return true;
}

/**
 * Jump for an issue or a field error: a row inside a collapsed group is not in the DOM, so `expand` opens all groups
 * first; a field that does not exist (anymore) falls back to its area.
 */
export function jumpToIssue(path: string, expand: () => void): void {
    if (jumpTo(path)) return;
    expand();
    requestAnimationFrame(() => {
        if (jumpTo(path)) return;
        jumpTo(path.startsWith('positions.') || path.startsWith('groups.') ? 'positions' : path.split('.').slice(0, 2).join('.'));
    });
}
```

- [ ] **Step 4: Grün**

Run: `ddev exec pnpm test -- resources/js/editor && ddev exec pnpm typecheck`
Expected: PASS, `tsc` ohne Fehler.

- [ ] **Step 5: Commit**

```bash
git add resources/js/editor/decimal.ts resources/js/editor/decimal.test.ts resources/js/editor/paths.ts resources/js/editor/paths.test.ts resources/js/editor/jump.ts
git commit -m "feat(editor): decimal input, field paths of API errors and issues, jump to field" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 7: Zustand-Store und Autosave

**Files:**
- Create: `resources/js/editor/store.ts`, `resources/js/editor/autosave.ts`, `resources/js/editor/use-autosave.ts`
- Test: `resources/js/editor/store.test.ts`, `resources/js/editor/autosave.test.ts`

**Interfaces:**
- Consumes: `fromDocument`, `toPayload`, `samePayload`, `idMap`, `reconcileIds` (Task 5), `fieldErrors` (Task 6), `saveDraft` (Task 4), `keys.document` (Task 4), `ApiError`, `errorMessage` (`lib/api.ts`), `toast` (`lib/toast.ts`), `router` (`@inertiajs/react`), `useSWRMutation` (`swr/mutation`).
- Produces: `useEditor` (Zustand, Form `EditorState`), Klasse `Autosave`, Hook `useAutosave(id, document)` (Abschnitt „Interfaces“).

- [ ] **Step 1: Failing Tests für den Store**

`resources/js/editor/store.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import type { DocumentDetail } from '@/api/types';
import { useEditor } from './store';

const detail = (overrides: Partial<DocumentDetail> = {}): DocumentDetail => ({
    id: 'doc',
    type: 'invoice',
    status: 'draft',
    number: null,
    date: '2026-10-11',
    customer_id: 'cust',
    customer_name: 'Hotel Alpenglück',
    contact_id: null,
    service_date: '2026-10-11',
    service_date_end: null,
    due_date: '2026-10-25',
    valid_until: null,
    intro: '',
    closing: '',
    template_id: 'tpl',
    locale: 'de',
    custom: {},
    source_id: null,
    cancelled_by_id: null,
    is_locked: false,
    is_overdue: false,
    finalized_at: null,
    paid_at: null,
    net_total: '0.00',
    tax_total: '0.00',
    gross_total: '0.00',
    created_at: null,
    updated_at: null,
    groups: [{ id: 'g1', title: 'Konzept', positions: [] }],
    totals: null,
    issues: [],
    dropped_fields: [],
    ...overrides,
});

const state = () => useEditor.getState();

beforeEach(() => state().reset());

describe('editor store', () => {
    it('loads a document and counts local changes', () => {
        state().load(detail());
        const loaded = state().revision;

        state().update((d) => ({ ...d, intro: 'Hallo' }));

        expect(state().draft?.intro).toBe('Hallo');
        expect(state().revision).toBe(loaded + 1);
        expect(state().synced?.intro).toBe('');
    });

    it('ignores changes that change nothing, of finalized documents and after a conflict', () => {
        state().load(detail());
        const loaded = state().revision;
        state().update((d) => d);
        expect(state().revision).toBe(loaded);

        state().load(detail({ status: 'open', is_locked: true }));
        state().update((d) => ({ ...d, intro: 'x' }));
        expect(state().draft?.intro).toBe('');

        state().load(detail());
        state().setSave('locked');
        state().update((d) => ({ ...d, intro: 'x' }));
        expect(state().draft?.intro).toBe('');
    });

    it('keeps a conflict when the same document loads again, forgets it for another one', () => {
        state().load(detail());
        state().setSave('locked');
        state().load(detail({ status: 'open', is_locked: true }));
        expect(state().saveState).toBe('locked');

        state().load(detail({ id: 'other' }));
        expect(state().saveState).toBe('saved');
    });

    it('takes over server ids, the saved state and collapsed groups after a save', () => {
        state().load(detail({ groups: [] }));
        state().update((d) => ({ ...d, groups: [{ id: 'local-g', title: 'Neu', positions: [] }] }));
        state().toggleGroup('local-g');
        state().setErrors({ 'document.date': 'Date is missing.' });
        const sent = { ...state().draft!, groups: state().draft!.groups };

        state().applySaved(sent, detail({ groups: [{ id: '01G', title: 'Neu', positions: [] }] }));

        expect(state().draft?.groups[0].id).toBe('01G');
        expect(state().aliases).toEqual({ '01G': 'local-g' });
        expect(state().collapsed).toEqual(['01G']);
        expect(state().errors).toEqual({});
        expect(state().synced?.groups[0].id).toBe('01G');
    });

    it('collapses and expands groups', () => {
        state().toggleGroup('g1');
        expect(state().collapsed).toEqual(['g1']);
        state().toggleGroup('g1');
        expect(state().collapsed).toEqual([]);
        state().toggleGroup('g1');
        state().expandAll();
        expect(state().collapsed).toEqual([]);
    });
});
```

- [ ] **Step 2: Failing Tests für den Autosave**

`resources/js/editor/autosave.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentDetail } from '@/api/types';
import { ApiError } from '@/lib/api';
import { Autosave } from './autosave';
import type { DraftPayload, SaveState } from './types';

type Call = { payload: DraftPayload; resolve(answer: DocumentDetail): void; reject(error: unknown): void };

function setup(retryDelays?: number[]) {
    let revision = 0;
    let payload = { intro: 'v0' } as unknown as DraftPayload;
    const calls: Call[] = [];
    const states: SaveState[] = [];
    const saved: [DraftPayload, DocumentDetail][] = [];
    const autosave = new Autosave({
        delay: 600,
        retryDelays,
        revision: () => revision,
        payload: () => payload,
        save: (sent) => new Promise<DocumentDetail>((resolve, reject) => calls.push({ payload: sent, resolve, reject })),
        onSaved: (sent, answer) => saved.push([sent, answer]),
        onState: (state) => states.push(state),
    });
    const change = (intro: string) => {
        revision++;
        payload = { intro } as unknown as DraftPayload;
        autosave.changed();
    };
    return { autosave, calls, states, saved, change };
}

const answer = (n: number) => ({ id: `answer-${n}` }) as unknown as DocumentDetail;
const problem = (status: number, reason: string) => new ApiError({ type: `urn:openbill:problem:${reason}`, title: 'Title', status, detail: reason, reason });
const intro = (call: Call) => (call.payload as unknown as { intro: string }).intro;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('Autosave', () => {
    it('saves once, 600 ms after the last change, with the latest state', async () => {
        const { calls, states, change } = setup();

        change('a');
        await vi.advanceTimersByTimeAsync(300);
        change('ab');
        await vi.advanceTimersByTimeAsync(599);
        expect(calls).toHaveLength(0);
        await vi.advanceTimersByTimeAsync(1);

        expect(calls.map(intro)).toEqual(['ab']);
        expect(states).toEqual(['dirty', 'dirty', 'saving']);
    });

    it('saves a change made during a save right after it, exactly once (review focus)', async () => {
        const { calls, states, saved, change } = setup();

        change('a');
        await vi.advanceTimersByTimeAsync(600);
        change('ab');
        await vi.advanceTimersByTimeAsync(600);
        expect(calls).toHaveLength(1);

        calls[0].resolve(answer(1));
        await vi.advanceTimersByTimeAsync(0);
        expect(calls.map(intro)).toEqual(['a', 'ab']);
        expect(saved.map(([sent]) => (sent as unknown as { intro: string }).intro)).toEqual(['a']);

        calls[1].resolve(answer(2));
        await vi.advanceTimersByTimeAsync(0);
        expect(calls).toHaveLength(2);
        expect(states.at(-1)).toBe('saved');
    });

    it('does not retry invalid input until the next change', async () => {
        const { autosave, calls, change } = setup();
        change('a');
        await vi.advanceTimersByTimeAsync(600);

        calls[0].reject(problem(422, 'validation_failed'));
        await vi.advanceTimersByTimeAsync(60_000);
        expect(autosave.state).toBe('invalid');
        expect(calls).toHaveLength(1);

        change('b');
        await vi.advanceTimersByTimeAsync(600);
        expect(calls).toHaveLength(2);
    });

    it('stops for good when the document was finalized or deleted elsewhere (review focus)', async () => {
        for (const [error, state] of [
            [problem(409, 'document_locked'), 'locked'],
            [problem(404, 'not_found'), 'gone'],
        ] as const) {
            const { autosave, calls, change } = setup();
            change('a');
            await vi.advanceTimersByTimeAsync(600);
            calls[0].reject(error);
            await vi.advanceTimersByTimeAsync(0);

            change('b');
            await vi.advanceTimersByTimeAsync(60_000);
            await autosave.flush();

            expect(autosave.state).toBe(state);
            expect(calls).toHaveLength(1);
        }
    });

    it('treats other conflicts (cancellation customer) as invalid input', async () => {
        const { autosave, calls, change } = setup();
        change('a');
        await vi.advanceTimersByTimeAsync(600);
        calls[0].reject(problem(409, 'cancellation_customer'));
        await vi.advanceTimersByTimeAsync(0);

        expect(autosave.state).toBe('invalid');
    });

    it('retries network and server errors with growing pauses', async () => {
        const { autosave, calls, change } = setup([2000, 5000]);
        change('a');
        await vi.advanceTimersByTimeAsync(600);

        calls[0].reject(problem(0, 'network'));
        await vi.advanceTimersByTimeAsync(1999);
        expect(autosave.state).toBe('error');
        expect(calls).toHaveLength(1);
        await vi.advanceTimersByTimeAsync(1);
        expect(calls).toHaveLength(2);

        calls[1].reject(problem(503, 'pdf_render_failed'));
        await vi.advanceTimersByTimeAsync(4999);
        expect(calls).toHaveLength(2);
        await vi.advanceTimersByTimeAsync(1);
        expect(calls).toHaveLength(3);

        calls[2].resolve(answer(3));
        await vi.advanceTimersByTimeAsync(0);
        expect(autosave.state).toBe('saved');
    });

    it('retry() saves at once', async () => {
        const { autosave, calls, change } = setup([30_000]);
        change('a');
        await vi.advanceTimersByTimeAsync(600);
        calls[0].reject(problem(0, 'network'));
        await vi.advanceTimersByTimeAsync(0);

        void autosave.retry();
        expect(calls).toHaveLength(2);
    });

    it('flush() saves without waiting and resolves after the answer', async () => {
        const { autosave, calls, change } = setup();
        change('a');

        const done = autosave.flush();
        expect(calls).toHaveLength(1);
        calls[0].resolve(answer(1));
        await done;

        expect(autosave.state).toBe('saved');
        expect(autosave.pending).toBe(false);
        await expect(autosave.flush()).resolves.toBeUndefined();
        expect(calls).toHaveLength(1);
    });

    it('sends the unsaved state with keepalive when the tab closes, nothing when saved', async () => {
        const { autosave, calls, change } = setup();
        const sent: DraftPayload[] = [];

        autosave.flushKeepalive((payload) => sent.push(payload));
        expect(sent).toHaveLength(0);

        change('a');
        autosave.flushKeepalive((payload) => sent.push(payload));
        await vi.advanceTimersByTimeAsync(600);

        expect(sent).toHaveLength(1);
        expect(calls).toHaveLength(0);
    });

    it('reset() counts the current state as saved (after loading the server state)', async () => {
        const { autosave, calls, change } = setup();
        change('a');
        autosave.reset();
        await vi.advanceTimersByTimeAsync(600);

        expect(calls).toHaveLength(0);
        expect(autosave.state).toBe('saved');
    });

    it('saves nothing after stop() and ignores an answer that arrives later (deleted draft)', async () => {
        const { autosave, calls, saved, change } = setup();
        change('a');
        await vi.advanceTimersByTimeAsync(600);
        autosave.stop();
        calls[0].resolve(answer(1));
        change('b');
        await vi.advanceTimersByTimeAsync(600);
        await autosave.flush();

        expect(calls).toHaveLength(1);
        expect(saved).toHaveLength(0);
    });
});
```

- [ ] **Step 3: Rot**

Run: `ddev exec pnpm test -- resources/js/editor`
Expected: FAIL – `Failed to resolve import "./store"` bzw. `"./autosave"`.

- [ ] **Step 4: Store**

`resources/js/editor/store.ts`:

```ts
import { create } from 'zustand';
import type { DocumentDetail } from '@/api/types';
import { fromDocument, idMap, reconcileIds, toPayload } from './ops';
import type { Draft, DraftPayload, SaveState } from './types';

export type EditorState = {
    draft: Draft | null;
    /** +1 on every local change (and on load); autosave compares it with the last saved revision. */
    revision: number;
    /** Last server state seen (GET or PATCH answer): tells external changes from own ones. */
    synced: DraftPayload | null;
    saveState: SaveState;
    saveError: unknown;
    /** data-path → message of the last refused save (422). */
    errors: Record<string, string>;
    collapsed: string[];
    /** Server id → the local id it replaced: stable React keys, so a row keeps focus and input state across a save. */
    aliases: Record<string, string>;
    load(document: DocumentDetail): void;
    update(fn: (draft: Draft) => Draft): void;
    applySaved(sent: DraftPayload, saved: DocumentDetail): void;
    setSave(state: SaveState, error?: unknown): void;
    setErrors(errors: Record<string, string>): void;
    toggleGroup(id: string): void;
    expandAll(): void;
    reset(): void;
};

type Data = Pick<EditorState, 'draft' | 'revision' | 'synced' | 'saveState' | 'saveError' | 'errors' | 'collapsed' | 'aliases'>;

const initial = (): Data => ({ draft: null, revision: 0, synced: null, saveState: 'saved', saveError: null, errors: {}, collapsed: [], aliases: {} });

/** Local state of the document editor (spec 2: Zustand only for the editor). Changes go through the pure functions in ops.ts. */
export const useEditor = create<EditorState>()((set, get) => ({
    ...initial(),

    load: (document) =>
        set((state) => {
            const same = state.draft?.id === document.id;
            const draft = fromDocument(document);
            const conflict = same && (state.saveState === 'locked' || state.saveState === 'gone');
            return {
                draft,
                synced: toPayload(draft),
                revision: state.revision + 1,
                saveState: conflict ? state.saveState : 'saved',
                saveError: conflict ? state.saveError : null,
                errors: {},
                collapsed: same ? state.collapsed : [],
                aliases: same ? state.aliases : {},
            };
        }),

    update: (fn) => {
        const { draft, saveState } = get();
        if (!draft || draft.status !== 'draft' || saveState === 'locked' || saveState === 'gone') return;
        const next = fn(draft);
        if (next !== draft) set((state) => ({ draft: next, revision: state.revision + 1 }));
    },

    applySaved: (sent, saved) =>
        set((state) => {
            const map = idMap(sent, saved.groups);
            return {
                draft: state.draft ? reconcileIds(state.draft, map) : null,
                synced: toPayload(fromDocument(saved)),
                collapsed: state.collapsed.map((id) => map[id] ?? id),
                aliases: { ...state.aliases, ...Object.fromEntries(Object.entries(map).map(([local, server]) => [server, state.aliases[local] ?? local])) },
                errors: {},
            };
        }),

    setSave: (saveState, error = null) => set({ saveState, saveError: error }),
    setErrors: (errors) => set({ errors }),
    toggleGroup: (id) => set((state) => ({ collapsed: state.collapsed.includes(id) ? state.collapsed.filter((x) => x !== id) : [...state.collapsed, id] })),
    expandAll: () => set({ collapsed: [] }),
    reset: () => set(initial()),
}));
```

Hinweis zum Test „takes over server ids“: `sent` ist im Test der ganze Entwurf statt der Payload; `idMap` liest nur `groups`, deshalb genügt das. TS akzeptiert es, weil `Draft` alle Felder von `DraftPayload` enthält.

- [ ] **Step 5: Autosave**

`resources/js/editor/autosave.ts`:

```ts
import type { DocumentDetail } from '@/api/types';
import { ApiError } from '@/lib/api';
import type { DraftPayload, SaveState } from './types';

export type AutosaveOptions = {
    delay?: number;
    retryDelays?: number[];
    revision(): number;
    payload(): DraftPayload | null;
    save(payload: DraftPayload): Promise<DocumentDetail>;
    onSaved(sent: DraftPayload, saved: DocumentDetail): void;
    onState(state: SaveState, error?: unknown, sent?: DraftPayload): void;
};

const RETRY = [2000, 5000, 15000, 30000];

/**
 * Debounced autosave of the editor draft (PATCH /api/documents/{id}): one save at a time, a follow-up save right after
 * when the draft changed meanwhile, retries with growing pauses on network and server errors, no retries for answers
 * that asking again cannot change (422 invalid input, 409 finalized elsewhere, 404 deleted elsewhere).
 */
export class Autosave {
    private savedRevision: number;
    private timer: ReturnType<typeof setTimeout> | null = null;
    private inFlight: Promise<void> | null = null;
    private attempt = 0;
    private current: SaveState = 'saved';
    private stopped = false;

    constructor(private readonly options: AutosaveOptions) {
        this.savedRevision = options.revision();
    }

    get state(): SaveState {
        return this.current;
    }

    /** Something is not on the server yet: an unsaved revision or a save on its way. */
    get pending(): boolean {
        return this.inFlight !== null || this.options.revision() !== this.savedRevision;
    }

    changed(): void {
        if (this.blocked() || this.options.revision() === this.savedRevision) return;
        this.attempt = 0;
        if (!this.inFlight) this.set('dirty');
        this.schedule(this.options.delay ?? 600);
    }

    flush(): Promise<void> {
        this.clear();
        if (this.blocked()) return Promise.resolve();
        if (this.inFlight) return this.inFlight.then(() => this.flush());
        const revision = this.options.revision();
        const payload = this.options.payload();
        if (payload === null || revision === this.savedRevision) return Promise.resolve();

        this.set('saving');
        this.inFlight = this.options.save(payload).then(
            (saved) => {
                this.inFlight = null;
                this.savedRevision = revision;
                this.attempt = 0;
                if (this.stopped) return;
                this.options.onSaved(payload, saved);
                if (this.options.revision() !== this.savedRevision) {
                    this.set('dirty');
                    this.schedule(0);
                } else {
                    this.set('saved');
                }
            },
            (error: unknown) => {
                this.inFlight = null;
                if (!this.stopped) this.fail(error, payload);
            },
        );
        return this.inFlight;
    }

    retry(): Promise<void> {
        this.attempt = 0;
        return this.flush();
    }

    /** The tab closes: hand the unsaved state to a keepalive request (the page will not see the answer). */
    flushKeepalive(send: (payload: DraftPayload) => void): void {
        if (this.blocked() || !this.pending) return;
        const payload = this.options.payload();
        if (payload === null) return;
        this.clear();
        send(payload);
    }

    /** The server state was loaded: the current revision counts as saved. */
    reset(): void {
        this.clear();
        this.savedRevision = this.options.revision();
        this.attempt = 0;
        if (!this.blocked()) this.set('saved');
    }

    /** No more saves (the draft is being deleted). */
    stop(): void {
        this.stopped = true;
        this.clear();
    }

    private blocked(): boolean {
        return this.stopped || this.current === 'locked' || this.current === 'gone';
    }

    private fail(error: unknown, sent: DraftPayload): void {
        if (error instanceof ApiError && error.status === 409 && error.reason === 'document_locked') return this.set('locked', error, sent);
        if (error instanceof ApiError && error.status === 404) return this.set('gone', error, sent);
        // 422 and other client errors do not change by asking again (401 sends to the login, 419 is retried in api())
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return this.set('invalid', error, sent);
        this.set('error', error, sent);
        const delays = this.options.retryDelays ?? RETRY;
        this.schedule(delays[Math.min(this.attempt, delays.length - 1)]);
        this.attempt++;
    }

    private schedule(delay: number): void {
        this.clear();
        this.timer = setTimeout(() => {
            this.timer = null;
            void this.flush();
        }, delay);
    }

    private clear(): void {
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;
    }

    private set(state: SaveState, error?: unknown, sent?: DraftPayload): void {
        this.current = state;
        this.options.onState(state, error, sent);
    }
}
```

- [ ] **Step 6: Grün**

Run: `ddev exec pnpm test -- resources/js/editor`
Expected: PASS (`store.test.ts`, `autosave.test.ts`, `ops.test.ts`, `decimal.test.ts`, `paths.test.ts`).

Prüfen, falls „saves a change made during a save“ zwei Folgesaves zählt: `flush()` muss bei laufendem Save **keinen** zweiten `save()` starten, sondern sich an `inFlight` hängen – der Test ist die Spezifikation.

- [ ] **Step 7: Hook `useAutosave`**

`resources/js/editor/use-autosave.ts`:

```ts
import { router } from '@inertiajs/react';
import { useEffect, useMemo, useRef } from 'react';
import { mutate } from 'swr';
import useSWRMutation from 'swr/mutation';
import { saveDraft } from '@/api/documents';
import { keys } from '@/api/keys';
import type { DocumentDetail } from '@/api/types';
import { ApiError, errorMessage } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Autosave } from './autosave';
import { fromDocument, samePayload, toPayload } from './ops';
import { fieldErrors } from './paths';
import { useEditor } from './store';
import type { DraftPayload } from './types';

/**
 * Connects the editor store with the autosave: local changes go out 600 ms after the last one as an SWR mutation of the
 * document key (the answer becomes the cached document), server states are taken over while nothing is pending, and
 * leaving the page saves first. The editor component is keyed by document id, so one instance serves one document.
 */
export function useAutosave(id: string, document: DocumentDetail | undefined): { flush(): Promise<void>; retry(): void; stop(): void } {
    const { trigger } = useSWRMutation(keys.document(id), (_key: string, { arg }: { arg: DraftPayload }) => saveDraft(id, arg), {
        populateCache: true,
        revalidate: false,
    });
    const triggerRef = useRef(trigger);
    useEffect(() => {
        triggerRef.current = trigger;
    }, [trigger]);

    const autosave = useMemo(() => {
        const mine = () => useEditor.getState().draft?.id === id;
        return new Autosave({
            revision: () => useEditor.getState().revision,
            payload: () => {
                const draft = useEditor.getState().draft;
                return draft && draft.id === id && draft.status === 'draft' ? toPayload(draft) : null;
            },
            save: async (payload) => {
                const saved = await triggerRef.current(payload);
                // SWR types the answer as optional; PATCH always answers with the document
                if (!saved) throw new Error('PATCH /api/documents answered without a document.');
                return saved;
            },
            onSaved: (sent, saved) => {
                if (mine()) useEditor.getState().applySaved(sent, saved);
            },
            onState: (state, error, sent) => {
                if (!mine()) return;
                const store = useEditor.getState();
                store.setSave(state, error ?? null);
                if (state === 'invalid' && error instanceof ApiError) {
                    store.setErrors(fieldErrors(sent ?? { groups: [] }, error.violations));
                    if (error.violations.length === 0) toast.error(errorMessage(error));
                }
                // finalized or deleted elsewhere: show the server state (read-only) or the not-found state
                if (state === 'locked' || state === 'gone') void mutate(keys.document(id));
            },
        });
    }, [id]);

    // server state → store: a new document, a changed lock, or an external change while nothing is pending
    useEffect(() => {
        if (!document || document.id !== id) return;
        const store = useEditor.getState();
        const fresh = store.draft === null || store.draft.id !== id;
        const lockChanged = !fresh && (store.draft!.status !== 'draft') !== document.is_locked;
        const external = !fresh && !autosave.pending && !samePayload(toPayload(fromDocument(document)), store.synced);
        if (fresh || lockChanged || external) {
            store.load(document);
            autosave.reset();
        }
    }, [document, id, autosave]);

    // every local change (re)starts the debounce; load() bumps the revision too, reset() right after cancels that
    useEffect(
        () =>
            useEditor.subscribe((state, previous) => {
                if (state.revision !== previous.revision && state.draft?.id === id) autosave.changed();
            }),
        [autosave, id],
    );

    // leaving: Inertia visits and unmount save in the background (the SPA stays loaded), closing the tab uses keepalive
    useEffect(() => {
        const onPageHide = () => autosave.flushKeepalive((payload) => void saveDraft(id, payload, { keepalive: true }).catch(() => undefined));
        window.addEventListener('pagehide', onPageHide);
        const off = router.on('before', () => {
            void autosave.flush();
        });
        return () => {
            window.removeEventListener('pagehide', onPageHide);
            off();
            void autosave.flush();
        };
    }, [autosave, id]);

    return useMemo(
        () => ({
            flush: () => autosave.flush(),
            retry: () => void autosave.retry(),
            stop: () => autosave.stop(),
        }),
        [autosave],
    );
}
```

Vorher prüfen (SWR 2.x): `useSWRMutation(key, fetcher, { populateCache: true, revalidate: false })` – `trigger(arg)` gibt die Antwort zurück und schreibt sie in den Cache des Schlüssels (`node_modules/swr/dist/mutation/index.d.mts`, Optionen `populateCache`, `revalidate`). Weicht die Signatur ab, Fetcher-Signatur an die installierte Version anpassen, nicht das Verhalten.

- [ ] **Step 8: Typprüfung und Tests**

Run: `ddev exec pnpm typecheck && ddev exec pnpm test`
Expected: beides grün.

- [ ] **Step 9: Commit**

```bash
git add resources/js/editor/store.ts resources/js/editor/store.test.ts resources/js/editor/autosave.ts resources/js/editor/autosave.test.ts resources/js/editor/use-autosave.ts
git commit -m "feat(editor): Zustand draft store and debounced autosave with conflict and retry handling" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 8: Editor-Seite – Grundgerüst, Kopf, Kopf-/eigene Felder, Texte

**Files:**
- Modify: `lang/en.json`, `lang/de.json` (alle Editor-Texte dieser Phase)
- Create: `resources/css/editor.css`; Modify: `resources/css/app.css` (Import)
- Create: `resources/js/editor/components/editor.tsx`, `editor-header.tsx`, `chain-bar.tsx`, `read-only-notice.tsx`, `header-fields.tsx`, `texts-section.tsx`, `editor-skeleton.tsx`
- Modify (ersetzen): `resources/js/pages/documents/show.tsx`
- Test: `tests/Unit/TranslationsTest.php` (vorhanden), `ddev exec pnpm build`

**Interfaces:**
- Consumes: `useDocument` (Task 4), `useCustomerChoices`, `useTextBlocks` (Task 4), `useCustomer` (`api/customers.ts`), `useFieldDefinitions` (`api/fields.ts`), `useEditor` (Task 7), `useAutosave` (Task 7), `fromDocument`, `appendText` (Task 5), `CustomFieldInput` (`components/custom-field-input.tsx`), UI-Komponenten (`components/ui`).
- Produces: `Editor` (`editor/components/editor.tsx`, Props `{ document: DocumentDetail; context: DocumentPageContext }`), `EditorHeader` (Props `{ document, title, saveState, onRetry, children? }` – `children` sind Aktionen rechts), `ChainBar`, `ReadOnlyNotice`, `HeaderFields`, `TextsSection`, `EditorSkeleton`; CSS-Klassen `.ed`, `.ed--with-preview`, `.ed-main`, `.ed-head`, `.ed-preview`, `.ed-pane`, `.ed-pane__body`, `.ed-groups`, `.ed-pos-head`, `.ed-pos*`, `.ed-no-tax`, `.flash`; alle Übersetzungsschlüssel `editor.*`.

- [ ] **Step 1: Übersetzungen**

In `lang/en.json` und `lang/de.json` die folgenden Schlüssel einfügen (Block nach `documents.type_offer`, vor `einvoice.…` – er ist bereits alphabetisch sortiert). `document_page.pdf` und `document_page.read_only_hint` entfernt Step 5 zusammen mit der alten Platzhalterseite.

`lang/en.json`:

```json
    "editor.add_group": "Add group",
    "editor.add_loose": "Position without group",
    "editor.add_position": "Add position",
    "editor.archived": ":label (archived)",
    "editor.cancel_confirm": "Create cancellation",
    "editor.cancel_invoice": "Cancel invoice",
    "editor.cancel_text": "openbill creates a cancellation draft with all positions and negative amounts. Once you finalize it, the invoice is marked as cancelled.",
    "editor.cancel_title": "Cancel :number?",
    "editor.cancelled_by": "Cancelled by",
    "editor.cancelled_by_link": "the cancellation",
    "editor.chain": "Document chain",
    "editor.check.at_customer": "At the customer",
    "editor.check.missing.one": ":count required detail is missing",
    "editor.check.missing.other": ":count required details are missing",
    "editor.check.org": "Organization settings",
    "editor.check.profile": "Profile: :profile",
    "editor.check.ready": "Ready to finalize",
    "editor.closing": "Closing text",
    "editor.closing_placeholder": "Comes after the totals, e.g. payment terms and regards.",
    "editor.col_price": "Unit price",
    "editor.col_quantity": "Qty",
    "editor.col_tax": "Tax",
    "editor.col_title": "Item",
    "editor.col_total": "Total",
    "editor.col_unit": "Unit",
    "editor.contact": "Contact",
    "editor.contact_empty": "None on file",
    "editor.contact_none": "No contact",
    "editor.convert": "Convert",
    "editor.convert_menu_item": "To :type",
    "editor.convert_to": "Convert to :type",
    "editor.converted": ":type created as draft",
    "editor.custom_fields": "Custom fields",
    "editor.customer": "Customer",
    "editor.customer_choose": "Choose a customer",
    "editor.customer_open": "Open customer",
    "editor.date": "Date",
    "editor.delete": "Delete draft",
    "editor.deleted": "Draft deleted",
    "editor.description": "Description",
    "editor.description_placeholder": "Description (optional)",
    "editor.dropped_fields": "Not carried over because the field does not apply to :type: :fields",
    "editor.due_date": "Due on",
    "editor.duplicate": "Duplicate",
    "editor.duplicated": "Copy created as draft",
    "editor.e_invoice": "E-invoice",
    "editor.finalize": "Finalize",
    "editor.finalize_blocked.one": ":count required detail is still missing.",
    "editor.finalize_blocked.other": ":count required details are still missing.",
    "editor.finalize_text": "The document gets the number :number and can no longer be changed afterwards.",
    "editor.finalize_title": "Finalize :type?",
    "editor.finalized": ":type :number finalized",
    "editor.finalized_on": "finalized on :date",
    "editor.gone": "This draft was deleted elsewhere.",
    "editor.gross": "Total",
    "editor.group_collapse": "Collapse group",
    "editor.group_count.one": ":count position",
    "editor.group_count.other": ":count positions",
    "editor.group_default": "Group :n",
    "editor.group_dissolve": "Dissolve group",
    "editor.group_empty": "Drag positions here or add a new one.",
    "editor.group_expand": "Expand group",
    "editor.group_menu": "Edit group",
    "editor.group_move": "Move group “:title”",
    "editor.group_name": "Group name",
    "editor.group_optional": "+ :amount optional",
    "editor.group_remove": "Remove group with positions",
    "editor.group_removed": "“:title” removed",
    "editor.group_subtotal": "Subtotal net",
    "editor.guides": "Areas",
    "editor.guides_title": "Guides for header, content and footer",
    "editor.insert_block": "Insert text block",
    "editor.intro": "Introduction",
    "editor.intro_placeholder": "Comes before the positions, e.g. a short greeting.",
    "editor.invalid_number": "Enter a number, e.g. 12.5",
    "editor.kind.item": "Service",
    "editor.kind.optional": "Optional service",
    "editor.kind.text": "Text line",
    "editor.kind_label": "Kind of position",
    "editor.line_total": "Total of the position",
    "editor.locale": "Document language",
    "editor.locked_elsewhere": "This document was finalized elsewhere. Your last changes were not saved.",
    "editor.loose": "Loose positions",
    "editor.missing_tax_rate": "Positions without a tax rate count without VAT.",
    "editor.more": "More actions",
    "editor.net": "Net",
    "editor.not_found": "Document not found",
    "editor.not_found_text": "Maybe the draft was deleted. All quotes and invoices are in the list.",
    "editor.optional_tag": "Optional, not in the total",
    "editor.optional_total": "Optional positions, not included",
    "editor.pages.one": ":count page",
    "editor.pages.other": ":count pages",
    "editor.pdf": "Download PDF",
    "editor.position": "Position",
    "editor.position_menu": "Edit position",
    "editor.position_move": "Move “:title”",
    "editor.position_remove": "Remove position",
    "editor.position_removed": "“:title” removed",
    "editor.positions": "Positions",
    "editor.positions_empty": "No positions yet. Add a service or create groups, e.g. “Concept” and “Implementation”.",
    "editor.pp.body": "Content",
    "editor.pp.document": "Document preview",
    "editor.pp.footer": "Footer",
    "editor.pp.header": "Header",
    "editor.pp.page": "Page :n",
    "editor.preview": "Preview",
    "editor.preview_failed": "The preview could not be loaded.",
    "editor.preview_hide": "Hide preview",
    "editor.preview_show": "Show preview",
    "editor.preview_template": "Template “:name”",
    "editor.profile.basic": "Basic",
    "editor.profile.en16931": "E-invoice (EN 16931)",
    "editor.quantity": "Quantity",
    "editor.read_only": "Finalized on :date. The document can no longer be changed.",
    "editor.read_only_invoice": "Corrections only work through a cancellation.",
    "editor.read_only_other": "Duplicate it for a new version.",
    "editor.remove": "Remove",
    "editor.restored": "Draft kept",
    "editor.save.dirty": "Unsaved",
    "editor.save.error": "Not saved, trying again",
    "editor.save.invalid": "Not saved: check the marked fields",
    "editor.save.saved": "Saved",
    "editor.save.saving": "Saving …",
    "editor.service_date": "Service from",
    "editor.service_date_end": "Service until",
    "editor.service_date_end_hint": "Leave empty for a single day",
    "editor.small_business": "Small business: without VAT",
    "editor.status_action.accepted": "Mark as accepted",
    "editor.status_action.done": "Mark as done",
    "editor.status_action.paid": "Mark as paid",
    "editor.status_action.rejected": "Mark as rejected",
    "editor.status_change": "Change status",
    "editor.status_set": "Status set to “:status”",
    "editor.suggestions": "From earlier documents",
    "editor.tax_category.ae": "Reverse charge",
    "editor.tax_category.e": "Exempt from VAT",
    "editor.tax_category.g": "Export, exempt",
    "editor.tax_category.k": "Intra-community supply",
    "editor.tax_category.z": "Zero rate",
    "editor.tax_exempt_line": ":label on :net",
    "editor.tax_line": "VAT :percent % on :net",
    "editor.tax_rate": "Tax rate",
    "editor.template": "Template",
    "editor.template_error": "The template has an error (:file, line :line): :message",
    "editor.text_placeholder": "Note, e.g. “Includes two rounds of corrections.”",
    "editor.title_placeholder": "Service, e.g. concept",
    "editor.to_documents": "To the documents",
    "editor.totals": "Totals",
    "editor.undo": "Undo",
    "editor.unit": "Unit",
    "editor.unit_price": "Unit price",
    "editor.used_count.one": "used once",
    "editor.used_count.other": ":count× used",
    "editor.valid_until": "Valid until",
    "editor.view": "View",
    "editor.xml_copied": "XML copied",
    "editor.xml_copy": "Copy",
    "editor.xml_copy_failed": "Copying did not work. Select the text and copy it yourself.",
    "editor.xml_download": "Download XML",
    "editor.xml_hint": "XML according to EN 16931 (CII), embedded in the PDF.",
    "editor.xml_hint_draft": "openbill creates the XML (EN 16931, CII) when finalizing and embeds it in the PDF. Until then the check panel shows what is still missing.",
```

`lang/de.json`:

```json
    "editor.add_group": "Gruppe hinzufügen",
    "editor.add_loose": "Position ohne Gruppe",
    "editor.add_position": "Position hinzufügen",
    "editor.archived": ":label (archiviert)",
    "editor.cancel_confirm": "Storno anlegen",
    "editor.cancel_invoice": "Stornieren",
    "editor.cancel_text": "openbill legt ein Storno als Entwurf an, mit allen Positionen und negativen Beträgen. Sobald du das Storno abschließt, steht die Rechnung auf „Storniert“.",
    "editor.cancel_title": ":number stornieren?",
    "editor.cancelled_by": "Storniert durch",
    "editor.cancelled_by_link": "das Storno",
    "editor.chain": "Dokumentkette",
    "editor.check.at_customer": "Beim Kunden",
    "editor.check.missing.one": ":count Pflichtangabe fehlt",
    "editor.check.missing.other": ":count Pflichtangaben fehlen",
    "editor.check.org": "Einstellungen der Organisation",
    "editor.check.profile": "Profil: :profile",
    "editor.check.ready": "Bereit zum Abschließen",
    "editor.closing": "Schlusstext",
    "editor.closing_placeholder": "Steht nach den Summen, z. B. Zahlungsbedingungen und Gruß.",
    "editor.col_price": "Einzelpreis",
    "editor.col_quantity": "Menge",
    "editor.col_tax": "Steuer",
    "editor.col_title": "Bezeichnung",
    "editor.col_total": "Summe",
    "editor.col_unit": "Einheit",
    "editor.contact": "Ansprechpartner",
    "editor.contact_empty": "Keine hinterlegt",
    "editor.contact_none": "Ohne Ansprechpartner",
    "editor.convert": "Umwandeln",
    "editor.convert_menu_item": "In :type",
    "editor.convert_to": "In :type umwandeln",
    "editor.converted": ":type als Entwurf angelegt",
    "editor.custom_fields": "Eigene Felder",
    "editor.customer": "Kunde",
    "editor.customer_choose": "Kunde wählen",
    "editor.customer_open": "Kunde öffnen",
    "editor.date": "Datum",
    "editor.delete": "Entwurf löschen",
    "editor.deleted": "Entwurf gelöscht",
    "editor.description": "Beschreibung",
    "editor.description_placeholder": "Beschreibung (optional)",
    "editor.dropped_fields": "Nicht übernommen, weil das Feld für :type nicht gilt: :fields",
    "editor.due_date": "Fällig am",
    "editor.duplicate": "Duplizieren",
    "editor.duplicated": "Kopie als Entwurf angelegt",
    "editor.e_invoice": "E-Rechnung",
    "editor.finalize": "Abschließen",
    "editor.finalize_blocked.one": "Es fehlt noch :count Pflichtangabe.",
    "editor.finalize_blocked.other": "Es fehlen noch :count Pflichtangaben.",
    "editor.finalize_text": "Das Dokument bekommt die Nummer :number und lässt sich danach nicht mehr ändern.",
    "editor.finalize_title": ":type abschließen?",
    "editor.finalized": ":type :number abgeschlossen",
    "editor.finalized_on": "abgeschlossen am :date",
    "editor.gone": "Dieser Entwurf wurde an anderer Stelle gelöscht.",
    "editor.gross": "Gesamt",
    "editor.group_collapse": "Gruppe einklappen",
    "editor.group_count.one": ":count Position",
    "editor.group_count.other": ":count Positionen",
    "editor.group_default": "Gruppe :n",
    "editor.group_dissolve": "Gruppe auflösen",
    "editor.group_empty": "Zieh Positionen hierher oder füge eine neue hinzu.",
    "editor.group_expand": "Gruppe aufklappen",
    "editor.group_menu": "Gruppe bearbeiten",
    "editor.group_move": "Gruppe „:title“ verschieben",
    "editor.group_name": "Name der Gruppe",
    "editor.group_optional": "+ :amount optional",
    "editor.group_remove": "Gruppe mit Positionen entfernen",
    "editor.group_removed": "„:title“ entfernt",
    "editor.group_subtotal": "Zwischensumme netto",
    "editor.guides": "Bereiche",
    "editor.guides_title": "Hilfslinien für Kopfzeile, Inhalt und Fußzeile",
    "editor.insert_block": "Baustein einfügen",
    "editor.intro": "Einleitung",
    "editor.intro_placeholder": "Steht vor den Positionen, z. B. eine kurze Anrede.",
    "editor.invalid_number": "Gib eine Zahl ein, z. B. 12,5",
    "editor.kind.item": "Leistung",
    "editor.kind.optional": "Optionale Leistung",
    "editor.kind.text": "Textzeile",
    "editor.kind_label": "Art der Position",
    "editor.line_total": "Summe der Position",
    "editor.locale": "Dokumentsprache",
    "editor.locked_elsewhere": "Dieses Dokument wurde inzwischen an anderer Stelle abgeschlossen. Deine letzten Änderungen sind nicht gespeichert.",
    "editor.loose": "Lose Positionen",
    "editor.missing_tax_rate": "Positionen ohne Steuersatz zählen ohne Umsatzsteuer.",
    "editor.more": "Weitere Aktionen",
    "editor.net": "Netto",
    "editor.not_found": "Dokument nicht gefunden",
    "editor.not_found_text": "Vielleicht wurde der Entwurf gelöscht. In der Liste findest du alle Angebote und Rechnungen.",
    "editor.optional_tag": "Optional, nicht in der Summe",
    "editor.optional_total": "Optionale Positionen, nicht enthalten",
    "editor.pages.one": ":count Seite",
    "editor.pages.other": ":count Seiten",
    "editor.pdf": "PDF herunterladen",
    "editor.position": "Position",
    "editor.position_menu": "Position bearbeiten",
    "editor.position_move": "„:title“ verschieben",
    "editor.position_remove": "Position entfernen",
    "editor.position_removed": "„:title“ entfernt",
    "editor.positions": "Positionen",
    "editor.positions_empty": "Noch keine Positionen. Füge eine Leistung hinzu oder lege Gruppen an, z. B. „Konzept“ und „Umsetzung“.",
    "editor.pp.body": "Inhalt",
    "editor.pp.document": "Dokumentvorschau",
    "editor.pp.footer": "Fußzeile",
    "editor.pp.header": "Kopfzeile",
    "editor.pp.page": "Seite :n",
    "editor.preview": "Vorschau",
    "editor.preview_failed": "Die Vorschau ließ sich nicht laden.",
    "editor.preview_hide": "Vorschau ausblenden",
    "editor.preview_show": "Vorschau einblenden",
    "editor.preview_template": "Template „:name“",
    "editor.profile.basic": "Basis",
    "editor.profile.en16931": "E-Rechnung (EN 16931)",
    "editor.quantity": "Menge",
    "editor.read_only": "Abgeschlossen am :date. Das Dokument lässt sich nicht mehr ändern.",
    "editor.read_only_invoice": "Korrekturen gehen nur über ein Storno.",
    "editor.read_only_other": "Für eine neue Fassung duplizierst du es.",
    "editor.remove": "Entfernen",
    "editor.restored": "Entwurf behalten",
    "editor.save.dirty": "Ungespeichert",
    "editor.save.error": "Nicht gespeichert, neuer Versuch folgt",
    "editor.save.invalid": "Nicht gespeichert: markierte Felder prüfen",
    "editor.save.saved": "Gespeichert",
    "editor.save.saving": "Speichert …",
    "editor.service_date": "Leistung ab",
    "editor.service_date_end": "Leistung bis",
    "editor.service_date_end_hint": "Leer lassen bei einem Tag",
    "editor.small_business": "Kleinunternehmer: ohne Umsatzsteuer",
    "editor.status_action.accepted": "Als angenommen markieren",
    "editor.status_action.done": "Als erledigt markieren",
    "editor.status_action.paid": "Als bezahlt markieren",
    "editor.status_action.rejected": "Als abgelehnt markieren",
    "editor.status_change": "Status ändern",
    "editor.status_set": "Status auf „:status“ gesetzt",
    "editor.suggestions": "Aus früheren Dokumenten",
    "editor.tax_category.ae": "Reverse Charge",
    "editor.tax_category.e": "Steuerfrei",
    "editor.tax_category.g": "Ausfuhr, steuerfrei",
    "editor.tax_category.k": "Innergemeinschaftliche Lieferung",
    "editor.tax_category.z": "Nullsatz",
    "editor.tax_exempt_line": ":label auf :net",
    "editor.tax_line": "USt. :percent % auf :net",
    "editor.tax_rate": "Steuersatz",
    "editor.template": "Template",
    "editor.template_error": "Das Template hat einen Fehler (:file, Zeile :line): :message",
    "editor.text_placeholder": "Hinweis, z. B. „Inklusive zwei Korrekturschleifen.“",
    "editor.title_placeholder": "Leistung, z. B. Konzeption",
    "editor.to_documents": "Zu den Dokumenten",
    "editor.totals": "Summen",
    "editor.undo": "Rückgängig",
    "editor.unit": "Einheit",
    "editor.unit_price": "Einzelpreis",
    "editor.used_count.one": "einmal verwendet",
    "editor.used_count.other": ":count× verwendet",
    "editor.valid_until": "Gültig bis",
    "editor.view": "Ansicht",
    "editor.xml_copied": "XML kopiert",
    "editor.xml_copy": "Kopieren",
    "editor.xml_copy_failed": "Kopieren ging nicht. Markiere den Text und kopiere ihn selbst.",
    "editor.xml_download": "XML herunterladen",
    "editor.xml_hint": "XML nach EN 16931 (CII), im PDF eingebettet.",
    "editor.xml_hint_draft": "openbill erzeugt die XML (EN 16931, CII) beim Abschließen und bettet sie ins PDF ein. Bis dahin zeigt die Prüfanzeige, was noch fehlt.",
```

Run: `ddev artisan test --filter=TranslationsTest`
Expected: PASS (gleiche Schlüssel in beiden Dateien).

- [ ] **Step 2: Editor-CSS**

`resources/css/editor.css` (Port der Raster-Regeln aus `prototypes/clickdummy-v2/src/routes/documents/editor/editor.css`; Farben/Typo machen die Komponenten mit Tailwind):

```css
/*
 * Document editor: what Tailwind utilities cannot express cleanly – the page grid with the sticky preview,
 * the position rows (container queries with grid areas), the jump flash and the preview variables. Tokens only.
 */
@layer components {
    .ed {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        align-items: start;
    }
    .ed-main {
        display: grid;
        min-width: 0;
        width: 100%;
        max-width: 1080px;
        margin: 0 auto;
        align-content: start;
        gap: 2rem;
        padding: 1.5rem 2rem 4rem;
    }
    .ed-preview {
        min-width: 0;
        padding: 0 2rem 3rem;
    }
    .ed-head {
        position: sticky;
        top: 0;
        z-index: 20;
        margin: -1.5rem -1.5rem 0;
        padding: 1.5rem 1.5rem 1rem;
        background: color-mix(in srgb, var(--surface) 92%, transparent);
        backdrop-filter: blur(10px);
    }
    .ed-pane {
        height: 100%;
    }
    @media (min-width: 1200px) {
        .ed--with-preview {
            grid-template-columns: minmax(0, 1fr) minmax(360px, 40%);
        }
        .ed--with-preview .ed-main {
            max-width: none;
            margin: 0;
            padding-right: 1.5rem;
        }
        .ed--with-preview .ed-preview {
            position: sticky;
            top: 0.75rem;
            height: calc(100dvh - 1.5rem);
            padding: 0.75rem 0.75rem 0.75rem 0;
        }
    }
    @media (max-width: 1199px) {
        .ed-pane {
            height: auto;
        }
        .ed-pane__body {
            overflow: visible;
        }
    }
    @media (max-width: 720px) {
        .ed-main {
            gap: 1.5rem;
            padding: 1.25rem 1rem 3rem;
        }
        .ed-preview {
            padding: 0 1rem 2.5rem;
        }
        .ed-head {
            position: static;
            margin: 0;
            padding: 0;
            background: none;
            backdrop-filter: none;
        }
    }

    /* position rows: header and rows share the columns; they follow the width of the list, not of the window */
    .ed-groups {
        container: positions / inline-size;
    }
    .ed-pos-head,
    .ed-pos {
        --cols: 1.5rem minmax(0, 1fr) 5.25rem 5.5rem 7.25rem 5.5rem 7rem 2rem;
        display: grid;
        grid-template-columns: var(--cols);
        column-gap: 0.5rem;
    }
    .ed-pos-head.ed-no-tax,
    .ed-pos.ed-no-tax {
        --cols: 1.5rem minmax(0, 1fr) 5.25rem 5.5rem 7.25rem 7rem 2rem;
    }
    .ed-pos {
        align-items: start;
        row-gap: 2px;
    }
    .ed-pos--text .ed-pos__main {
        grid-column: 2 / -2;
    }
    /* an empty description takes no room until the row is being edited */
    .ed-pos:not(:focus-within) .ed-pos__desc:placeholder-shown:not(:disabled) {
        min-height: 0;
        height: 0;
        padding-block: 0;
    }
    .ed-pos__desc:disabled:placeholder-shown {
        display: none;
    }
    /* inputs in position rows read like text until touched (controlClass tints them; no second background class) */
    .ed-pos input:not(:hover):not(:focus):not([aria-invalid='true']),
    .ed-pos select:not(:hover):not(:focus):not([aria-invalid='true']),
    .ed-pos textarea:not(:hover):not(:focus) {
        background-color: transparent;
    }
    .ed-pos :is(input, select):disabled {
        opacity: 1;
        cursor: default;
        color: var(--ink);
    }

    @container positions (max-width: 51rem) {
        .ed-pos-head {
            display: none;
        }
        .ed-pos,
        .ed-pos.ed-no-tax {
            grid-template-columns: 1.5rem 5.5rem 6.5rem 7.25rem 5.5rem minmax(0, 1fr) 2rem;
            grid-template-areas: 'handle main main main main total menu' '. qty unit price tax . .';
            row-gap: 0.25rem;
        }
        .ed-pos.ed-no-tax {
            grid-template-areas: 'handle main main main main total menu' '. qty unit price . . .';
        }
        .ed-pos--text,
        .ed-pos--text.ed-no-tax {
            grid-template-areas: 'handle main main main main main menu';
        }
        .ed-pos__handle {
            grid-area: handle;
        }
        .ed-pos__main,
        .ed-pos--text .ed-pos__main {
            grid-area: main;
        }
        .ed-pos__qty {
            grid-area: qty;
        }
        .ed-pos__unit {
            grid-area: unit;
        }
        .ed-pos__price {
            grid-area: price;
        }
        .ed-pos__tax {
            grid-area: tax;
        }
        .ed-pos__total {
            grid-area: total;
        }
        .ed-pos__menu {
            grid-area: menu;
        }
    }
    @container positions (max-width: 30rem) {
        .ed-pos,
        .ed-pos.ed-no-tax {
            grid-template-columns: 1.5rem minmax(0, 1fr) minmax(0, 1fr) 2rem;
            grid-template-areas: 'handle main main menu' '. qty unit .' '. price tax .' '. total total .';
        }
        .ed-pos.ed-no-tax {
            grid-template-areas: 'handle main main menu' '. qty unit .' '. price price .' '. total total .';
        }
        .ed-pos--text,
        .ed-pos--text.ed-no-tax {
            grid-template-areas: 'handle main main menu';
        }
    }

    /* short highlight after a jump from the check panel */
    .flash {
        border-radius: 12px;
        animation: ed-flash 1.2s cubic-bezier(0.2, 0, 0, 1);
    }
    @keyframes ed-flash {
        0%,
        30% {
            box-shadow: 0 0 0 4px var(--warn-soft), 0 0 0 6px var(--warn);
        }
        100% {
            box-shadow: 0 0 0 0 transparent;
        }
    }

    /* packages/paged-preview reads its colors from these variables */
    .ed-pane .pp {
        --pp-paper-shadow: var(--elev-paper);
        --pp-accent: var(--accent);
        --pp-accent-soft: var(--accent-soft);
        --pp-accent-soft-hover: var(--accent-soft-hover);
    }
}
```

In `resources/css/app.css` direkt unter `@import 'tailwindcss' source(none);` einfügen:

```css
@import './editor.css';
```

- [ ] **Step 3: Kleine Bausteine**

`resources/js/editor/components/editor-skeleton.tsx`:

```tsx
import { Skeleton } from '@/components/ui';
import { t } from '@/lib/i18n';

export function EditorSkeleton() {
    return (
        <div className="ed ed--with-preview" aria-busy="true" aria-label={t('common.loading')}>
            <div className="ed-main">
                <div className="flex items-center gap-4">
                    <div className="grid gap-2">
                        <Skeleton w={260} h={30} />
                        <Skeleton w={200} h={14} />
                    </div>
                    <span className="flex-1" />
                    <Skeleton w={130} h={38} r={999} />
                </div>
                <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(12.5rem,1fr))]">
                    {Array.from({ length: 6 }, (_, i) => (
                        <div key={i} className="grid gap-2">
                            <Skeleton w={90} h={12} />
                            <Skeleton h={38} r={12} />
                        </div>
                    ))}
                </div>
                <div className="grid gap-3">
                    {Array.from({ length: 4 }, (_, i) => (
                        <Skeleton key={i} h={44} r={12} />
                    ))}
                </div>
            </div>
            <div className="ed-preview">
                <Skeleton h={560} r={4} />
            </div>
        </div>
    );
}
```

`resources/js/editor/components/chain-bar.tsx`:

```tsx
import { Link } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';
import type { DocumentPageContext } from '@/api/types';
import { cx } from '@/components/ui';
import { path, t } from '@/lib/i18n';

/** Offer → order confirmation → invoice → cancellation; the server builds the chain (DocumentChain). */
export function ChainBar({ chain, currentId }: { chain: DocumentPageContext['chain']; currentId: string }) {
    if (chain.length < 2) return null;
    return (
        <nav aria-label={t('editor.chain')} className="-mt-6 flex flex-wrap items-center gap-0.5">
            {chain.map((member, i) => (
                <span key={member.id} className="inline-flex items-center gap-0.5">
                    {i > 0 && <ChevronRight aria-hidden className="size-3.5 text-faint" />}
                    <Link
                        href={path(`/documents/${member.id}`)}
                        aria-current={member.id === currentId ? 'page' : undefined}
                        title={`${t(`document_type.${member.type}`)}, ${t(`status.${member.status}`)}`}
                        className={cx(
                            'inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium no-underline transition-colors',
                            member.id === currentId ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-muted hover:bg-surface-3 hover:text-ink',
                        )}
                    >
                        {t(`document_type.${member.type}`)} <span className="num">{member.number ?? t('documents.draft')}</span>
                    </Link>
                </span>
            ))}
        </nav>
    );
}
```

`resources/js/editor/components/read-only-notice.tsx`:

```tsx
import { Link } from '@inertiajs/react';
import { FileQuestion, Lock } from 'lucide-react';
import type { DocumentDetail } from '@/api/types';
import { Notice } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { path, t } from '@/lib/i18n';
import type { SaveState } from '../types';

export function ReadOnlyNotice({ document, saveState }: { document: DocumentDetail; saveState: SaveState }) {
    if (saveState === 'locked') {
        return (
            <Notice tone="warn" icon={<Lock />}>
                {t('editor.locked_elsewhere')}
            </Notice>
        );
    }
    if (saveState === 'gone') {
        return (
            <Notice tone="bad" icon={<FileQuestion />}>
                {t('editor.gone')}{' '}
                <Link href={path('/documents')} className="font-medium text-accent">
                    {t('editor.to_documents')}
                </Link>
            </Notice>
        );
    }
    if (!document.is_locked) return null;
    return (
        <Notice tone="accent" icon={<Lock />}>
            {t('editor.read_only', { date: formatDate(document.finalized_at) })}{' '}
            {document.type === 'invoice' ? t('editor.read_only_invoice') : document.type === 'cancellation' ? '' : t('editor.read_only_other')}
            {document.cancelled_by_id && (
                <>
                    {' '}
                    {t('editor.cancelled_by')}{' '}
                    <Link href={path(`/documents/${document.cancelled_by_id}`)} className="font-medium text-accent">
                        {t('editor.cancelled_by_link')}
                    </Link>
                    .
                </>
            )}
        </Notice>
    );
}
```

`resources/js/editor/components/editor-header.tsx`:

```tsx
import { Check, CloudOff, RotateCw } from 'lucide-react';
import type { ReactNode } from 'react';
import type { DocumentDetail } from '@/api/types';
import { Button, cx, StatusBadge } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import type { SaveState } from '../types';

const LABEL: Partial<Record<SaveState, string>> = {
    saved: 'editor.save.saved',
    dirty: 'editor.save.dirty',
    saving: 'editor.save.saving',
    error: 'editor.save.error',
    invalid: 'editor.save.invalid',
};

function SaveStatus({ state, onRetry }: { state: SaveState; onRetry(): void }) {
    const label = LABEL[state];
    if (!label) return null;
    const bad = state === 'error' || state === 'invalid';
    return (
        <span className="inline-flex items-center gap-1">
            <span data-testid="save-status" role="status" className={cx('inline-flex items-center gap-1.5 px-2 text-xs font-medium whitespace-nowrap [&_svg]:size-3.5', bad ? 'text-bad' : 'text-muted')}>
                {state === 'saved' ? <Check aria-hidden /> : bad ? <CloudOff aria-hidden /> : <span aria-hidden className={cx('size-[7px] rounded-full', state === 'saving' ? 'animate-pulse bg-accent' : 'bg-faint')} />}
                {t(label)}
            </span>
            {state === 'error' && (
                <Button size="sm" variant="ghost" iconOnly icon={<RotateCw />} onClick={onRetry}>
                    {t('common.retry')}
                </Button>
            )}
        </span>
    );
}

export function EditorHeader({ document, title, saveState, onRetry, children }: { document: DocumentDetail; title: string; saveState: SaveState; onRetry(): void; children?: ReactNode }) {
    const typeLabel = t(`document_type.${document.type}`);
    return (
        <header className="ed-head flex flex-wrap items-center gap-x-4 gap-y-3">
            <div className="grid min-w-0 flex-[1_1_18rem] gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-bold tracking-title" aria-label={title}>
                        {typeLabel} <span className="num font-semibold text-muted">{document.number ?? t('overview.draft_label')}</span>
                    </h1>
                    <StatusBadge status={document.status} overdue={document.is_overdue} />
                </div>
                <p className="truncate text-sm text-muted">
                    {document.customer_name ?? t('documents.no_customer')}
                    {document.finalized_at && <> · {t('editor.finalized_on', { date: formatDate(document.finalized_at) })}</>}
                </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                {!document.is_locked && <SaveStatus state={saveState} onRetry={onRetry} />}
                {children}
            </div>
        </header>
    );
}
```

Hinweis: `aria-label={title}` am `h1` sorgt dafür, dass die Überschrift für Playwright und Screenreader „Invoice (draft)“ bzw. „Invoice RE-2026-0042“ heißt, unabhängig von Leerzeichen zwischen den Spans. `tracking-title`/`font-semibold` gibt es (Phase 5, `show.tsx`); falls `font-semibold` nicht existiert, `font-strong` nehmen.

- [ ] **Step 4: Kopf-/eigene Felder und Texte**

`resources/js/editor/components/header-fields.tsx`:

```tsx
import { Link } from '@inertiajs/react';
import { useCustomer } from '@/api/customers';
import { useFieldDefinitions } from '@/api/fields';
import { useCustomerChoices } from '@/api/master-data';
import type { DocumentPageContext } from '@/api/types';
import { CustomFieldInput } from '@/components/custom-field-input';
import { Select, TextInput } from '@/components/ui';
import { path, t } from '@/lib/i18n';
import type { Draft } from '../types';

type DateKey = 'date' | 'valid_until' | 'service_date' | 'service_date_end' | 'due_date';

type Props = {
    draft: Draft;
    context: DocumentPageContext;
    readOnly: boolean;
    /** data-path → message (field errors of the last save and compliance issues). */
    messages: Record<string, string>;
    customerName: string | null;
    update(fn: (draft: Draft) => Draft): void;
};

/** Customer, contact, dates, language, template and the document's custom fields. */
export function HeaderFields({ draft, context, readOnly, messages, customerName, update }: Props) {
    const choices = useCustomerChoices();
    const customer = useCustomer(draft.customer_id);
    const fields = useFieldDefinitions('document');
    const set = (patch: Partial<Draft>) => update((d) => ({ ...d, ...patch }));

    const list = choices.data?.items ?? [];
    const current = customer.data;
    const options = current && !list.some((c) => c.id === current.id) ? [...list, current] : list;
    const contacts = current?.contacts ?? [];
    const definitions = (fields.data ?? []).filter((definition) => definition.doc_types.includes(draft.type));
    const templates = context.templates.filter((template) => template.document_types.includes(draft.type) || template.id === draft.template_id);

    const date = (key: DateKey, label: string, hint?: string) => (
        <TextInput
            label={label}
            type="date"
            value={draft[key] ?? ''}
            disabled={readOnly}
            path={`document.${key}`}
            error={messages[`document.${key}`]}
            hint={hint}
            // the document date is required: clearing it keeps the old one
            onChange={(e) => set({ [key]: e.target.value || (key === 'date' ? draft.date : null) } as Partial<Draft>)}
        />
    );

    return (
        <div className="grid gap-4">
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(12.5rem,1fr))]">
                <Select
                    label={t('editor.customer')}
                    value={draft.customer_id ?? ''}
                    disabled={readOnly || draft.type === 'cancellation'}
                    path="document.customer"
                    wrapClassName="xs:col-span-2"
                    error={messages['document.customer']}
                    hint={draft.type === 'cancellation' && !readOnly ? t('errors.cancellation_customer') : undefined}
                    aside={
                        draft.customer_id && (
                            <Link href={path(`/customers/${draft.customer_id}`)} className="text-xs font-medium text-accent no-underline hover:underline">
                                {t('editor.customer_open')}
                            </Link>
                        )
                    }
                    onChange={(e) => {
                        const chosen = options.find((c) => c.id === e.target.value);
                        // PATCH always sends contact_id, so the default contact is chosen here (UpdateDraft only picks it when contact_id is missing)
                        set({ customer_id: chosen?.id ?? null, contact_id: chosen?.contacts.find((c) => c.is_default)?.id ?? null });
                    }}
                >
                    <option value="">{t('editor.customer_choose')}</option>
                    {options.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.name}
                        </option>
                    ))}
                    {draft.customer_id && !options.some((c) => c.id === draft.customer_id) && <option value={draft.customer_id}>{customerName ?? '…'}</option>}
                </Select>
                <Select
                    label={t('editor.contact')}
                    value={draft.contact_id ?? ''}
                    disabled={readOnly || contacts.length === 0}
                    path="document.contact"
                    error={messages['document.contact']}
                    onChange={(e) => set({ contact_id: e.target.value || null })}
                >
                    <option value="">{contacts.length ? t('editor.contact_none') : t('editor.contact_empty')}</option>
                    {contacts.map((c) => (
                        <option key={c.id} value={c.id}>
                            {`${c.first_name} ${c.last_name}`.trim()}
                        </option>
                    ))}
                </Select>
                {date('date', t('editor.date'))}
                {draft.type === 'offer' && date('valid_until', t('editor.valid_until'))}
                {(draft.type === 'invoice' || draft.type === 'cancellation') && (
                    <>
                        {date('service_date', t('editor.service_date'))}
                        {date('service_date_end', t('editor.service_date_end'), t('editor.service_date_end_hint'))}
                    </>
                )}
                {draft.type === 'invoice' && date('due_date', t('editor.due_date'))}
                <Select label={t('editor.locale')} value={draft.locale} disabled={readOnly} path="document.locale" onChange={(e) => set({ locale: e.target.value })}>
                    <option value="en">{t('locale.en')}</option>
                    <option value="de">{t('locale.de')}</option>
                </Select>
                <Select
                    label={t('editor.template')}
                    value={draft.template_id ?? ''}
                    disabled={readOnly}
                    path="document.template"
                    error={messages['document.template']}
                    onChange={(e) => set({ template_id: e.target.value || null })}
                >
                    {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                            {template.name}
                        </option>
                    ))}
                </Select>
            </div>

            {definitions.length > 0 && (
                <div className="grid gap-3 rounded-lg bg-bg p-4">
                    <span className="text-sm font-strong">{t('editor.custom_fields')}</span>
                    <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(12.5rem,1fr))]">
                        {definitions.map((definition) => (
                            <CustomFieldInput
                                key={definition.id}
                                definition={definition}
                                value={draft.custom[definition.key]}
                                disabled={readOnly}
                                path={`document.custom.${definition.key}`}
                                error={messages[`document.custom.${definition.key}`]}
                                onChange={(value) => update((d) => ({ ...d, custom: { ...d.custom, [definition.key]: value } }))}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
```

Vorher prüfen: `Customer` aus `/api/customers` (Liste) enthält `contacts` (Typ `Customer` in `api/types.ts`; `CustomerResource` liefert sie in der Liste – Kundenliste der Phase 5 zeigt den Standard-Ansprechpartner). `xs:col-span-2` nutzt den Breakpoint `xs` (520 px) aus `app.css`.

`resources/js/editor/components/texts-section.tsx`:

```tsx
import { TextQuote } from 'lucide-react';
import { useTextBlocks } from '@/api/master-data';
import type { TextBlockKind } from '@/api/types';
import { Button, Menu, MenuItem, Textarea } from '@/components/ui';
import { t } from '@/lib/i18n';
import { appendText } from '../ops';

const ORDER: Record<'intro' | 'closing', TextBlockKind[]> = {
    intro: ['intro', 'note', 'payment', 'closing'],
    closing: ['closing', 'payment', 'note', 'intro'],
};

/** Introduction or closing text, typed or from text blocks (appended after a blank line). */
export function TextsSection({ which, value, readOnly, error, onChange }: { which: 'intro' | 'closing'; value: string; readOnly: boolean; error?: string; onChange(value: string): void }) {
    const blocks = useTextBlocks().data ?? [];
    const sorted = [...blocks].sort((a, b) => ORDER[which].indexOf(a.kind) - ORDER[which].indexOf(b.kind));

    return (
        <Textarea
            label={which === 'intro' ? t('editor.intro') : t('editor.closing')}
            aside={
                !readOnly && (
                    <Menu
                        trigger={
                            <Button variant="ghost" size="sm" icon={<TextQuote />} disabled={sorted.length === 0}>
                                {t('editor.insert_block')}
                            </Button>
                        }
                    >
                        {sorted.map((block) => (
                            <MenuItem key={block.id} onSelect={() => onChange(appendText(value, block.body))}>
                                <span className="grid min-w-0">
                                    <span>{block.name}</span>
                                    <span className="max-w-72 truncate text-xs text-muted">{block.body.split('\n')[0]}</span>
                                </span>
                            </MenuItem>
                        ))}
                    </Menu>
                )
            }
            value={value}
            disabled={readOnly}
            rows={3}
            className="min-h-18"
            path={`document.${which}`}
            error={error}
            placeholder={which === 'intro' ? t('editor.intro_placeholder') : t('editor.closing_placeholder')}
            onChange={(e) => onChange(e.target.value)}
        />
    );
}
```

- [ ] **Step 5: Editor und Seite**

`resources/js/editor/components/editor.tsx`:

```tsx
import { Head } from '@inertiajs/react';
import { useMemo } from 'react';
import type { DocumentDetail, DocumentPageContext } from '@/api/types';
import { t } from '@/lib/i18n';
import { fromDocument } from '../ops';
import { useEditor } from '../store';
import { useAutosave } from '../use-autosave';
import { ChainBar } from './chain-bar';
import { EditorHeader } from './editor-header';
import { HeaderFields } from './header-fields';
import { ReadOnlyNotice } from './read-only-notice';
import { TextsSection } from './texts-section';

/** The document editor. Keyed by document id in the page: one instance (and one autosave) per document. */
export function Editor({ document, context }: { document: DocumentDetail; context: DocumentPageContext }) {
    const autosave = useAutosave(document.id, document);
    const stored = useEditor((state) => state.draft);
    const saveState = useEditor((state) => state.saveState);
    const errors = useEditor((state) => state.errors);
    const update = useEditor((state) => state.update);
    // first render (before the store has loaded this document): show the server state
    const fallback = useMemo(() => fromDocument(document), [document]);
    const draft = stored?.id === document.id ? stored : fallback;
    const readOnly = draft.status !== 'draft' || saveState === 'locked' || saveState === 'gone';
    const issues = readOnly ? [] : document.issues;
    const messages = useMemo(() => ({ ...Object.fromEntries(issues.map((issue) => [issue.path, issue.message])), ...errors }), [issues, errors]);
    const title = `${t(`document_type.${document.type}`)} ${document.number ?? t('overview.draft_label')}`;

    return (
        <div className="ed">
            <Head title={title} />
            <div className="ed-main">
                <EditorHeader document={document} title={title} saveState={saveState} onRetry={autosave.retry} />
                <ChainBar chain={context.chain} currentId={document.id} />
                <ReadOnlyNotice document={document} saveState={saveState} />
                <section className="grid min-w-0 gap-4">
                    <HeaderFields draft={draft} context={context} readOnly={readOnly} messages={messages} customerName={document.customer_name} update={update} />
                </section>
                <TextsSection which="intro" value={draft.intro} readOnly={readOnly} error={messages['document.intro']} onChange={(intro) => update((d) => ({ ...d, intro }))} />
                <TextsSection which="closing" value={draft.closing} readOnly={readOnly} error={messages['document.closing']} onChange={(closing) => update((d) => ({ ...d, closing }))} />
            </div>
        </div>
    );
}
```

In `lang/en.json` und `lang/de.json` die Schlüssel `document_page.pdf` und `document_page.read_only_hint` löschen (`document_page.back` bleibt).

`resources/js/pages/documents/show.tsx` vollständig ersetzen:

```tsx
import { Head } from '@inertiajs/react';
import { FileQuestion } from 'lucide-react';
import { useDocument } from '@/api/documents';
import type { DocumentPageContext } from '@/api/types';
import { ButtonLink, EmptyState, ErrorState, Page } from '@/components/ui';
import { Editor } from '@/editor/components/editor';
import { EditorSkeleton } from '@/editor/components/editor-skeleton';
import { appLayout } from '@/layouts/app-shell';
import { ApiError } from '@/lib/api';
import { path, t } from '@/lib/i18n';

/** Document editor (/{locale}/documents/{id}): the document from GET /api/documents/{id}, the page context from Inertia. */
export default function DocumentPage({ document_id: id, context }: { document_id: string; context: DocumentPageContext }) {
    const { data: document, error, mutate } = useDocument(id);

    if (error && !document) {
        return (
            <Page>
                <Head title={t('nav.documents')} />
                {error instanceof ApiError && error.status === 404 ? (
                    <EmptyState
                        icon={<FileQuestion />}
                        title={t('editor.not_found')}
                        actions={
                            <ButtonLink href={path('/documents')} variant="primary">
                                {t('editor.to_documents')}
                            </ButtonLink>
                        }
                    >
                        {t('editor.not_found_text')}
                    </EmptyState>
                ) : (
                    <ErrorState error={error} onRetry={() => void mutate()} />
                )}
            </Page>
        );
    }
    if (!document) return <EditorSkeleton />;
    return <Editor key={id} document={document} context={context} />;
}

DocumentPage.layout = appLayout;
```

- [ ] **Step 6: Prüfen**

Run: `ddev exec pnpm typecheck && ddev exec pnpm test && ddev exec pnpm build`
Expected: alles grün; der Build enthält `editor.css` (Größe von `public/build/assets/app-*.css` wächst).

Run: `ddev artisan test --filter='TranslationsTest|DocumentPagesTest'`
Expected: PASS.

Im Browser prüfen (`ddev exec pnpm dev` läuft, Demo-Daten geseedet: `ddev artisan db:seed --class=DemoSeeder`): `https://openbill.ddev.site/de/documents` → Entwurf öffnen → Kopf mit „Gespeichert“, Felder; Einleitung ändern → „Ungespeichert“ → nach ~0,6 s „Speichert …“ → „Gespeichert“; Seite neu laden → Text ist da. Ein abgeschlossenes Dokument zeigt den Hinweis „Abgeschlossen am …“ und deaktivierte Felder.

Run: `pnpm --dir e2e test -- documents.spec.ts`
Expected: PASS (`creates a document from the dialog and opens it` sieht die Überschrift `Invoice (draft)` und „Hotel Alpenglück“).

- [ ] **Step 7: Commit**

```bash
git add lang/en.json lang/de.json resources/css resources/js/editor/components resources/js/pages/documents/show.tsx
git commit -m "feat(editor): editor page with header, save status, chain, header and custom fields, texts" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 9: Vorschau, Summen und Prüfanzeige aus `POST /api/render`

**Files:**
- Create: `resources/js/editor/latest.ts`, `resources/js/editor/use-preview.ts`, `resources/js/editor/components/preview-pane.tsx`, `xml-view.tsx`, `totals-panel.tsx`, `compliance-panel.tsx`
- Modify: `resources/js/editor/components/editor.tsx`
- Test: `resources/js/editor/latest.test.ts`

**Interfaces:**
- Consumes: `renderPreview`, `fetchXml`, `RenderRequest` (Task 4), `keys.documentXml` (Task 4), `toPayload` (Task 5), `formatDecimalInput`, `isZeroDecimal` (Task 6), `jumpToIssue` (Task 6), `useEditor` (Task 7), `PagedPreview` (Task 2), `useDebounced` (`lib/hooks.ts`), `useStoredFlag` (`lib/prefs.ts`), `formatMoney` (`lib/format.ts`).
- Produces: `createLatest`, `isAbort`, `useRenderPreview(id, draft)`, Komponenten `PreviewPane`, `XmlView`, `TotalsPanel` (Props `{ totals: Totals | null }`), `CompliancePanel` (Props `{ issues, profile, customerId, onJump }`); im Editor: `totals`/`issues` aus der Render-Antwort, Abschnitt „Positionen“ (Überschrift + Summen; Task 10 setzt die Gruppen hinein), Vorschau-Spalte.

- [ ] **Step 1: Failing Test**

`resources/js/editor/latest.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api';
import { createLatest, isAbort } from './latest';

/** A request that waits until it is resolved or its signal aborts (like fetch). */
function controllable() {
    const pending: { arg: string; signal: AbortSignal; resolve(value: string): void }[] = [];
    const run = (arg: string, signal: AbortSignal) =>
        new Promise<string>((resolve, reject) => {
            pending.push({ arg, signal, resolve });
            signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        });
    return { pending, run };
}

describe('createLatest', () => {
    it('aborts the request still running when a newer one starts (review focus)', async () => {
        const { pending, run } = controllable();
        const latest = createLatest(run);

        const first = latest('slow');
        const second = latest('fast');

        expect(pending[0].signal.aborted).toBe(true);
        await expect(first).rejects.toSatisfy(isAbort);
        pending[1].resolve('fast answer');
        await expect(second).resolves.toBe('fast answer');
    });

    it('does not abort the next request when an earlier one finishes', async () => {
        const { pending, run } = controllable();
        const latest = createLatest(run);

        const first = latest('a');
        pending[0].resolve('a');
        await first;
        void latest('b');

        expect(pending[1].signal.aborted).toBe(false);
    });
});

describe('isAbort', () => {
    it('recognizes aborted requests only', () => {
        expect(isAbort(new DOMException('Aborted', 'AbortError'))).toBe(true);
        expect(isAbort(new ApiError({ type: '', title: '', status: 0, detail: '', reason: 'network' }))).toBe(false);
        expect(isAbort(null)).toBe(false);
    });
});
```

Vorher prüfen: Vitest 5 kennt `toSatisfy` (`expect(…).rejects.toSatisfy(fn)`); falls nicht, `await expect(first).rejects.toThrow('Aborted')` und `isAbort` separat prüfen.

- [ ] **Step 2: Rot**

Run: `ddev exec pnpm test -- resources/js/editor/latest.test.ts`
Expected: FAIL – `Failed to resolve import "./latest"`.

- [ ] **Step 3: `latest.ts` und Vorschau-Hook**

`resources/js/editor/latest.ts`:

```ts
/** Wraps a request so that a new call aborts the one still running: only the latest answer can arrive. */
export function createLatest<A, R>(run: (arg: A, signal: AbortSignal) => Promise<R>): (arg: A) => Promise<R> {
    let controller: AbortController | null = null;
    return (arg) => {
        controller?.abort();
        const own = new AbortController();
        controller = own;
        return run(arg, own.signal).finally(() => {
            if (controller === own) controller = null;
        });
    };
}

export function isAbort(error: unknown): boolean {
    return (error instanceof DOMException || error instanceof Error) && error.name === 'AbortError';
}
```

`resources/js/editor/use-preview.ts`:

```ts
import useSWR from 'swr';
import { renderPreview, type RenderRequest } from '@/api/documents';
import type { RenderResponse } from '@/api/types';
import { useDebounced } from '@/lib/hooks';
import { createLatest } from './latest';
import { toPayload } from './ops';
import type { Draft } from './types';

const render = createLatest((body: RenderRequest, signal: AbortSignal) => renderPreview(body, signal));

/**
 * Live preview: POST /api/render 250 ms after the last change with the whole local draft; a newer request aborts the
 * older one, the last answer stays visible meanwhile. Totals, line and group sums and issues come from this answer.
 * Finalized documents (draft null) render from their snapshot.
 */
export function useRenderPreview(id: string, draft: Draft | null) {
    const body = JSON.stringify(draft ? { document_id: id, draft: toPayload(draft) } : { document_id: id });
    const debounced = useDebounced(body, 250);
    return useSWR<RenderResponse>(['/api/render', debounced], ([, json]: [string, string]) => render(JSON.parse(json) as RenderRequest), {
        keepPreviousData: true,
        revalidateOnFocus: false,
        revalidateIfStale: false,
        shouldRetryOnError: false,
    });
}
```

- [ ] **Step 4: Grün**

Run: `ddev exec pnpm test -- resources/js/editor/latest.test.ts`
Expected: PASS, `3 passed`.

- [ ] **Step 5: Summen und Prüfanzeige**

`resources/js/editor/components/totals-panel.tsx`:

```tsx
import type { Totals } from '@/api/types';
import { cx } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { t } from '@/lib/i18n';
import { formatDecimalInput, isZeroDecimal } from '../decimal';

function Row({ label, value, sub = false }: { label: string; value: string; sub?: boolean }) {
    return (
        <div className={cx('flex justify-between gap-4', sub && 'text-sm text-muted')}>
            <span>{label}</span>
            <span className="num">{value}</span>
        </div>
    );
}

/** Net, VAT per rate, total, optional positions and legal notes – exactly as the server calculated them. */
export function TotalsPanel({ totals }: { totals: Totals | null }) {
    if (!totals) return null;
    return (
        <div role="group" aria-label={t('editor.totals')} className="mt-2 ml-auto grid w-full max-w-96 gap-1.5 rounded-lg bg-bg px-5 py-4">
            <Row label={t('editor.net')} value={formatMoney(totals.net)} />
            {totals.tax_breakdown.map((row) => (
                <Row
                    key={`${row.category}:${row.percent}`}
                    sub
                    label={
                        row.category === 'S'
                            ? t('editor.tax_line', { percent: formatDecimalInput(row.percent), net: formatMoney(row.net) })
                            : t('editor.tax_exempt_line', { label: t(`editor.tax_category.${row.category.toLowerCase()}`), net: formatMoney(row.net) })
                    }
                    value={formatMoney(row.tax)}
                />
            ))}
            <div className="mt-2 flex justify-between gap-4 pt-3 text-xl font-bold tracking-tight shadow-[inset_0_1px_0_var(--surface-3)]">
                <span>{t('editor.gross')}</span>
                <span className="num">{formatMoney(totals.gross)}</span>
            </div>
            {!isZeroDecimal(totals.optional_net) && <Row sub label={t('editor.optional_total')} value={formatMoney(totals.optional_net)} />}
            {totals.missing_tax_rate && <p className="text-xs text-muted">{t('editor.missing_tax_rate')}</p>}
            {totals.legal_notes.map((note) => (
                <p key={note} className="mt-1 text-xs text-muted">
                    {note}
                </p>
            ))}
        </div>
    );
}
```

`resources/js/editor/components/compliance-panel.tsx`:

```tsx
import { Link } from '@inertiajs/react';
import { AlertCircle, ArrowUpRight, CheckCircle2, ChevronRight } from 'lucide-react';
import type { ComplianceProfile, Issue } from '@/api/types';
import { cx } from '@/components/ui';
import { path, t, tn } from '@/lib/i18n';

const ITEM = 'flex w-full items-center gap-2 rounded-sm bg-[color-mix(in_srgb,var(--surface)_55%,transparent)] px-3 py-[7px] text-left text-sm text-ink no-underline hover:bg-surface [&>svg]:ml-auto [&>svg]:size-[0.95rem] [&>svg]:shrink-0 [&>svg]:text-muted';
const WHERE = 'ml-auto inline-flex items-center gap-1 text-xs whitespace-nowrap text-muted [&_svg]:size-3';

/** Result of the compliance profile from the last render answer, every issue jumps to its field or links to its place. */
export function CompliancePanel({ issues, profile, customerId, onJump }: { issues: Issue[]; profile: ComplianceProfile; customerId: string | null; onJump(path: string): void }) {
    const ok = issues.length === 0;
    return (
        <section id="check-panel" aria-live="polite" className={cx('grid scroll-mt-16 gap-3 rounded-lg px-5 py-4', ok ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn')}>
            <div className="flex items-center gap-3">
                {ok ? <CheckCircle2 aria-hidden className="size-5 shrink-0" /> : <AlertCircle aria-hidden className="size-5 shrink-0" />}
                <div className="grid">
                    <b className="font-strong">{ok ? t('editor.check.ready') : tn('editor.check.missing', issues.length)}</b>
                    <span className="text-xs opacity-80">{t('editor.check.profile', { profile: profile === 'en16931' ? t('editor.profile.en16931') : t('editor.profile.basic') })}</span>
                </div>
            </div>
            {!ok && (
                <ul className="m-0 grid list-none gap-0.5 p-0">
                    {issues.map((issue) => (
                        <li key={`${issue.path}:${issue.code}`}>
                            {(issue.path.startsWith('customer.') || issue.path.startsWith('contact.')) && customerId ? (
                                <Link href={path(`/customers/${customerId}`)} className={ITEM}>
                                    {issue.message}
                                    <span className={WHERE}>
                                        {t('editor.check.at_customer')}
                                        <ArrowUpRight aria-hidden />
                                    </span>
                                </Link>
                            ) : issue.path.startsWith('org.') ? (
                                <div className={ITEM}>
                                    {issue.message}
                                    <span className={WHERE}>{t('editor.check.org')}</span>
                                </div>
                            ) : (
                                <button type="button" className={ITEM} onClick={() => onJump(issue.path)}>
                                    {issue.message}
                                    <ChevronRight aria-hidden />
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
```

Vorher prüfen: Tailwind-Namen `bg-ok-soft`, `text-ok`, `bg-warn-soft`, `text-warn` existieren (`@theme inline` in `resources/css/app.css`; `Notice` nutzt dieselben Töne). Sonst die Namen aus `app.css` übernehmen.

- [ ] **Step 6: Vorschau-Spalte und E-Rechnung**

`resources/js/editor/components/xml-view.tsx`:

```tsx
import { Copy, Download, FileCode } from 'lucide-react';
import useSWR from 'swr';
import { fetchXml } from '@/api/documents';
import { keys } from '@/api/keys';
import { Button, buttonClass, ErrorState, Notice, Skeleton } from '@/components/ui';
import { t } from '@/lib/i18n';
import { toast } from '@/lib/toast';

/** E-invoice tab: the archived XML of a finalized document; drafts get it when finalizing. */
export function XmlView({ documentId, finalized }: { documentId: string; finalized: boolean }) {
    const xml = useSWR(finalized ? keys.documentXml(documentId) : null, () => fetchXml(documentId), { revalidateOnFocus: false });

    if (!finalized) return <Notice icon={<FileCode />}>{t('editor.xml_hint_draft')}</Notice>;
    if (xml.error) return <ErrorState error={xml.error} onRetry={() => void xml.mutate()} />;
    if (!xml.data) return <Skeleton h={320} r={12} />;

    const text = xml.data;
    const copy = () => {
        if (!navigator.clipboard) {
            toast.error(t('editor.xml_copy_failed'));
            return;
        }
        navigator.clipboard.writeText(text).then(
            () => toast.success(t('editor.xml_copied')),
            () => toast.error(t('editor.xml_copy_failed')),
        );
    };

    return (
        <div className="overflow-hidden rounded-md bg-surface">
            <div className="flex flex-wrap items-center gap-2 py-2 pr-2 pl-4 text-xs text-muted">
                <span className="flex-1">{t('editor.xml_hint')}</span>
                <Button size="sm" variant="ghost" icon={<Copy />} onClick={copy}>
                    {t('editor.xml_copy')}
                </Button>
                <a className={buttonClass({ variant: 'ghost', size: 'sm' })} href={keys.documentXml(documentId)} download>
                    <Download aria-hidden />
                    {t('editor.xml_download')}
                </a>
            </div>
            <pre tabIndex={0} className="m-0 max-h-[70vh] overflow-auto bg-surface p-4 font-[family-name:var(--font-code)] text-[11px] leading-relaxed text-muted">
                {text}
            </pre>
        </div>
    );
}
```

`resources/js/editor/components/preview-pane.tsx`:

```tsx
import { PagedPreview } from '@openbill/paged-preview';
import { Download, Frame, PanelRightClose } from 'lucide-react';
import { useState } from 'react';
import type { ComplianceProfile, RenderResponse } from '@/api/types';
import { Button, Notice, PillButton, Skeleton, Tabs } from '@/components/ui';
import { t, tn } from '@/lib/i18n';
import { useStoredFlag } from '@/lib/prefs';
import { isAbort } from '../latest';
import { XmlView } from './xml-view';

type Tab = 'preview' | 'xml';

type Props = {
    documentId: string;
    profile: ComplianceProfile;
    finalized: boolean;
    data: RenderResponse | undefined;
    error: unknown;
    templateName: string;
    onClose(): void;
    onPdf(): void;
};

/** Pages exactly as the PDF: server-rendered header, body and footer, split into pages by packages/paged-preview. */
export function PreviewPane({ documentId, profile, finalized, data, error, templateName, onClose, onPdf }: Props) {
    const [tab, setTab] = useState<Tab>('preview');
    const [guides, setGuides] = useStoredFlag('openbill:editor-guides', false);
    const [pages, setPages] = useState(1);
    const strict = profile === 'en16931';
    const active: Tab = strict ? tab : 'preview';
    const failed = !!error && !isAbort(error) && !data;

    return (
        <aside aria-label={t('editor.preview')} className="ed-pane grid grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-xl bg-bg">
            <div className="flex flex-wrap items-center gap-2 px-4 pt-3 pb-2">
                {strict ? (
                    <Tabs<Tab> label={t('editor.view')} value={active} onChange={setTab} items={[{ value: 'preview', label: t('editor.preview') }, { value: 'xml', label: t('editor.e_invoice') }]} />
                ) : (
                    <span className="font-heading">{t('editor.preview')}</span>
                )}
                <span className="flex-1" />
                {active === 'preview' && (
                    <PillButton pressed={guides} onClick={() => setGuides(!guides)} title={t('editor.guides_title')}>
                        <Frame aria-hidden className="size-3.5" />
                        {t('editor.guides')}
                    </PillButton>
                )}
                <Button size="sm" variant="ghost" iconOnly icon={<Download />} onClick={onPdf}>
                    {t('editor.pdf')}
                </Button>
                <Button size="sm" variant="ghost" iconOnly icon={<PanelRightClose />} onClick={onClose}>
                    {t('editor.preview_hide')}
                </Button>
            </div>

            <div className="ed-pane__body grid content-start gap-3 overflow-auto px-5 pt-2 pb-5">
                {active === 'xml' ? (
                    <XmlView documentId={documentId} finalized={finalized} />
                ) : (
                    <>
                        {data?.errors.map((item, i) => (
                            <Notice key={i} tone="bad">
                                {t('editor.template_error', { file: item.file ?? item.part, line: item.line ?? '–', message: item.message })}
                            </Notice>
                        ))}
                        {failed && <Notice tone="bad">{t('editor.preview_failed')}</Notice>}
                        {data ? (
                            <PagedPreview
                                parts={data}
                                paper={data.paper}
                                showGuides={guides}
                                onPageCount={setPages}
                                labels={{
                                    document: t('editor.pp.document'),
                                    page: (n) => t('editor.pp.page', { n }),
                                    header: t('editor.pp.header'),
                                    body: t('editor.pp.body'),
                                    footer: t('editor.pp.footer'),
                                }}
                            />
                        ) : (
                            !failed && <Skeleton h={520} r={4} />
                        )}
                        <p className="text-center text-xs text-muted">
                            {tn('editor.pages', pages)} · {t('editor.preview_template', { name: templateName })}
                        </p>
                    </>
                )}
            </div>
        </aside>
    );
}
```

Vorher prüfen: `PillButton` (`components/ui/tabs.tsx`) setzt `aria-pressed` aus `pressed`; `Tabs` ist generisch (`Tabs<T extends string>`). `font-heading` ist eine vorhandene Utility (CLAUDE.md „Regeln“).

- [ ] **Step 7: Editor verdrahten**

In `resources/js/editor/components/editor.tsx`:

1. Imports ergänzen:

```tsx
import { PanelRightOpen } from 'lucide-react';
import { keys } from '@/api/keys';
import { Button, cx } from '@/components/ui';
import { useStoredFlag } from '@/lib/prefs';
import { jumpToIssue } from '../jump';
import { useRenderPreview } from '../use-preview';
import { CompliancePanel } from './compliance-panel';
import { PreviewPane } from './preview-pane';
import { TotalsPanel } from './totals-panel';
```

2. Die Zeile `const issues = readOnly ? [] : document.issues;` ersetzen durch:

```tsx
    const [previewOpen, setPreviewOpen] = useStoredFlag('openbill:editor-preview', true);
    const preview = useRenderPreview(document.id, readOnly ? null : draft);
    // totals and issues come from the server: the last render answer, until then the saved document's
    const totals = preview.data?.totals ?? document.totals;
    const issues = readOnly ? [] : (preview.data?.issues ?? document.issues);
    const expandAll = useEditor((state) => state.expandAll);
    const jump = (target: string) => jumpToIssue(target, expandAll);
    const templateName = context.templates.find((template) => template.id === draft.template_id)?.name ?? '–';
    const openPdf = () => window.open(keys.documentPdf(document.id), '_blank', 'noopener');
```

3. Im JSX das äußere `<div className="ed">` ersetzen durch `<div className={cx('ed', previewOpen && 'ed--with-preview')}>`, dem `EditorHeader` Kinder geben:

```tsx
                <EditorHeader document={document} title={title} saveState={saveState} onRetry={autosave.retry}>
                    {!previewOpen && (
                        <Button variant="ghost" iconOnly icon={<PanelRightOpen />} onClick={() => setPreviewOpen(true)}>
                            {t('editor.preview_show')}
                        </Button>
                    )}
                </EditorHeader>
```

4. Zwischen den beiden `TextsSection` den Positionsabschnitt einfügen und nach dem Schlusstext die Prüfanzeige:

```tsx
                <section className="grid min-w-0 gap-4" aria-labelledby="positions-heading">
                    <div className="flex flex-wrap items-center gap-3">
                        <h2 id="positions-heading" className="text-lg font-heading">
                            {t('editor.positions')}
                        </h2>
                        {context.small_business && <Tag neutral>{t('editor.small_business')}</Tag>}
                    </div>
                    <TotalsPanel totals={totals} />
                </section>
```

```tsx
                {!readOnly && <CompliancePanel issues={issues} profile={context.profile} customerId={draft.customer_id} onJump={jump} />}
```

5. Nach `</div>` von `.ed-main` die Vorschau-Spalte:

```tsx
            {previewOpen && (
                <div className="ed-preview">
                    <PreviewPane
                        documentId={document.id}
                        profile={context.profile}
                        finalized={document.is_locked}
                        data={preview.data}
                        error={preview.error}
                        templateName={templateName}
                        onClose={() => setPreviewOpen(false)}
                        onPdf={openPdf}
                    />
                </div>
            )}
```

`Tag` mit in den Import aus `@/components/ui` aufnehmen. (Task 11 ersetzt `openPdf` durch die Aktion, die vorher speichert.)

- [ ] **Step 8: Prüfen**

Run: `ddev exec pnpm typecheck && ddev exec pnpm test && ddev exec pnpm build`
Expected: grün.

Im Browser: Entwurf einer Rechnung öffnen → rechts die Vorschau mit Kopf-/Fußzeile, „1 Seite · Template „Klar““; „Bereiche“ zeigt die Hilfslinien; Einleitung tippen → Vorschau aktualisiert nach kurzer Pause (DevTools → Network: höchstens eine laufende `render`-Anfrage, ältere als „canceled“). Summenkasten zeigt Netto/USt./Gesamt; Prüfanzeige zeigt fehlende Angaben, Klick auf „Fälligkeit fehlt“ (Fälligkeit vorher leeren) springt ins Feld und lässt es aufleuchten. Bei Profil `en16931` gibt es den Tab „E-Rechnung“ mit dem Hinweis für Entwürfe. Breite unter 1200 px: Vorschau unter dem Formular.

Kaputtes Template gegenprüfen (Review Focus 3): In `ddev artisan tinker` nicht nötig – `RenderControllerTest` (Phase 4) deckt die Fehlerform ab; im Browser genügt, dass `data.errors` als roter Hinweis erscheint (Template-Fehler lassen sich erst mit Phase 7 im UI erzeugen).

- [ ] **Step 9: Commit**

```bash
git add resources/js/editor
git commit -m "feat(editor): live preview with paged-preview, totals and compliance from POST /api/render" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 10: Gruppen und Positionen mit @dnd-kit, Vorschläge, Zahlenfelder

**Files:**
- Create: `resources/js/editor/components/groups-editor.tsx`, `position-row.tsx`, `title-autocomplete.tsx`, `decimal-cell.tsx`
- Modify: `resources/js/editor/components/editor.tsx`

**Interfaces:**
- Consumes: alle Operationen aus `ops.ts` (Task 5), `parseDecimalInput`, `formatDecimalInput`, `isZeroDecimal` (Task 6), `useEditor` (Task 7), `useTaxRates`, `useUnits`, `usePositionSuggestions` (Task 4), `useFieldDefinitions`, `CustomFieldInput`, `toast`, UI-Komponenten, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.
- Produces: `GroupsEditor` (Props `{ draft, totals, smallBusiness, readOnly, messages, update }`), `PositionRow`/`SortablePositionRow`, `TitleAutocomplete`, `DecimalCell`. DOM-Konventionen für Tests: jede Gruppe `role="group"` mit `aria-label` = Titel (lose: „Loose positions“), jede Zeile `data-position-row`, Titel-Eingabe `role="combobox"` mit Name „Item“, Mengen-/Preisfelder `textbox` „Quantity“/„Unit price“, Gruppen-Griff „Move group “…””.

- [ ] **Step 1: Zahlenfeld**

`resources/js/editor/components/decimal-cell.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { controlClass, cx } from '@/components/ui';
import { t } from '@/lib/i18n';
import { formatDecimalInput, parseDecimalInput } from '../decimal';

type Props = {
    value: string;
    onCommit(value: string): void;
    label: string;
    disabled?: boolean;
    error?: string;
    path?: string;
    /** Decimals the API accepts (quantities and prices: 4). */
    scale?: number;
    minFraction?: number;
    suffix?: string;
    className?: string;
};

/**
 * Quantity or price. Valid input goes to the draft while typing ("12,5" → "12.5"), so the preview follows; invalid input
 * stays local, is marked when the field is left and is never sent.
 */
export function DecimalCell({ value, onCommit, label, disabled = false, error, path, scale = 4, minFraction = 0, suffix, className }: Props) {
    const [raw, setRaw] = useState(() => formatDecimalInput(value, undefined, minFraction));
    const [invalid, setInvalid] = useState(false);
    const focused = useRef(false);

    useEffect(() => {
        if (focused.current) return;
        setRaw(formatDecimalInput(value, undefined, minFraction));
        setInvalid(false);
    }, [value, minFraction]);

    const message = invalid ? t('editor.invalid_number') : error;

    return (
        <span className={cx('relative flex items-center', className)} data-path={path}>
            <input
                inputMode="decimal"
                aria-label={label}
                aria-invalid={message ? true : undefined}
                title={message}
                disabled={disabled}
                value={raw}
                onFocus={() => (focused.current = true)}
                onChange={(e) => {
                    setRaw(e.target.value);
                    const parsed = parseDecimalInput(e.target.value, scale);
                    if (parsed === 'invalid') return;
                    setInvalid(false);
                    if (parsed !== value) onCommit(parsed);
                }}
                onBlur={() => {
                    focused.current = false;
                    const parsed = parseDecimalInput(raw, scale);
                    if (parsed === 'invalid') {
                        setInvalid(true);
                        return;
                    }
                    setRaw(formatDecimalInput(parsed, undefined, minFraction));
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                }}
                className={controlClass(!!message, cx('num h-control text-right', suffix && 'pr-7'))}
            />
            {suffix && (
                <span aria-hidden className="pointer-events-none absolute right-2.5 text-sm text-muted">
                    {suffix}
                </span>
            )}
        </span>
    );
}
```

- [ ] **Step 2: Bezeichnung mit Vorschlägen**

`resources/js/editor/components/title-autocomplete.tsx` (Port von `TitleAutocomplete.tsx`; Treffer kommen vom Server):

```tsx
import { History } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { usePositionSuggestions } from '@/api/master-data';
import type { PositionSuggestion, Unit } from '@/api/types';
import { controlClass, cx } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { t, tn } from '@/lib/i18n';
import { useDebounced } from '@/lib/hooks';

type Props = {
    value: string;
    onChange(value: string): void;
    onPick(suggestion: PositionSuggestion): void;
    onEnter?(): void;
    withSuggestions: boolean;
    units: Unit[];
    disabled?: boolean;
    autoFocus?: boolean;
    error?: string;
    placeholder: string;
    path: string;
    muted?: boolean;
};

/** Title of a position with suggestions from earlier documents (replaces a catalogue). Enter without a pick adds a row. */
export function TitleAutocomplete({ value, onChange, onPick, onEnter, withSuggestions, units, disabled = false, autoFocus = false, error, placeholder, path, muted = false }: Props) {
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(-1);
    const listId = useId();
    const input = useRef<HTMLInputElement>(null);
    const query = useDebounced(open && withSuggestions && !disabled ? value : '', 150);
    const { data = [] } = usePositionSuggestions(query);
    const matches = data.filter((s) => s.title.toLowerCase() !== value.trim().toLowerCase()).slice(0, 6);
    const show = open && matches.length > 0;

    // focus after inserting a row; an effect, because autoFocus gets lost after clicks
    useEffect(() => {
        if (autoFocus) requestAnimationFrame(() => input.current?.focus());
    }, [autoFocus]);

    const pick = (suggestion: PositionSuggestion) => {
        onPick(suggestion);
        setOpen(false);
        setActive(-1);
    };

    const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown' && matches.length) {
            e.preventDefault();
            setOpen(true);
            setActive((a) => (a + 1) % matches.length);
        } else if (e.key === 'ArrowUp' && matches.length) {
            e.preventDefault();
            setActive((a) => (a <= 0 ? matches.length - 1 : a - 1));
        } else if (e.key === 'Escape') {
            setOpen(false);
            setActive(-1);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (show && active >= 0) pick(matches[active]);
            else {
                setOpen(false);
                onEnter?.();
            }
        }
    };

    const unitSymbol = (id: string | null) => units.find((u) => u.id === id)?.symbol;

    return (
        <div className="relative" data-path={path}>
            <input
                ref={input}
                className={controlClass(!!error, cx('h-control', muted ? 'text-muted italic' : 'font-medium'))}
                value={value}
                placeholder={placeholder}
                disabled={disabled}
                title={error}
                role="combobox"
                aria-label={t('editor.col_title')}
                aria-invalid={error ? true : undefined}
                aria-expanded={show}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={show && active >= 0 ? `${listId}-${active}` : undefined}
                onChange={(e) => {
                    onChange(e.target.value);
                    setOpen(true);
                    setActive(-1);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 120)}
                onKeyDown={onKeyDown}
            />
            {show && (
                <ul id={listId} role="listbox" aria-label={t('editor.suggestions')} className="absolute top-[calc(100%+4px)] left-0 z-30 m-0 grid w-[min(28rem,100%)] min-w-64 animate-pop-in list-none rounded-md bg-surface p-1.5 shadow-float">
                    <li aria-hidden className="flex items-center gap-1.5 px-2 pt-1 pb-1.5 text-xs text-muted [&_svg]:size-3">
                        <History />
                        {t('editor.suggestions')}
                    </li>
                    {matches.map((s, i) => (
                        <li
                            key={s.title}
                            id={`${listId}-${i}`}
                            role="option"
                            aria-selected={i === active}
                            className={cx('grid cursor-pointer gap-px rounded-sm px-2.5 py-[7px]', i === active && 'bg-accent-soft')}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                pick(s);
                            }}
                            onMouseEnter={() => setActive(i)}
                        >
                            <span className={cx('font-medium', i === active && 'text-accent')}>{s.title}</span>
                            <span className="num text-xs text-muted">
                                {formatMoney(s.unit_price)}
                                {unitSymbol(s.unit_id) && ` / ${unitSymbol(s.unit_id)}`}
                                {` · ${tn('editor.used_count', s.used_count)}`}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
```

Hinweis: `controlClass` setzt `bg-surface-2`; ein zusätzliches `bg-transparent` wäre ein Konflikt derselben Eigenschaft (CLAUDE.md „Fallstricke“). Dass Eingaben in Positionszeilen wie Text wirken, bis man sie anfasst, regelt `editor.css` (`.ed-pos input:not(:hover):not(:focus)…`, Task 8 Step 2).

- [ ] **Step 3: Positionszeile**

`resources/js/editor/components/position-row.tsx`:

```tsx
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlignLeft, CircleDashed, GripVertical, ListPlus, MoreHorizontal, Package, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { ApiPosition, DocumentType, FieldDefinition, PositionKind, TaxRate, Unit } from '@/api/types';
import { CustomFieldInput } from '@/components/custom-field-input';
import { Button, cx, Menu, MenuItem, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuSeparator, SelectControl, Tag } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { t } from '@/lib/i18n';
import { DecimalCell } from './decimal-cell';
import { TitleAutocomplete } from './title-autocomplete';

const KIND_ICON: Record<PositionKind, ReactNode> = { item: <Package />, optional: <CircleDashed />, text: <AlignLeft /> };

export type PositionRowProps = {
    position: ApiPosition;
    docType: DocumentType;
    taxRates: TaxRate[];
    units: Unit[];
    fields: FieldDefinition[];
    /** Line net from the server (render answer); undefined while unknown. */
    net: string | undefined;
    readOnly: boolean;
    smallBusiness: boolean;
    messages: Record<string, string>;
    autoFocus: boolean;
    onChange(patch: Partial<ApiPosition>): void;
    onKind(kind: PositionKind): void;
    onRemove(): void;
    onEnter(): void;
};

/** Options of a select: active entries plus the chosen one even when archived. */
function choices<T extends { id: string; archived_at: string | null }>(list: T[], chosen: string | null): T[] {
    return list.filter((item) => item.archived_at === null || item.id === chosen);
}

export function SortablePositionRow(props: PositionRowProps) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: `pos:${props.position.id}`, disabled: props.readOnly });
    return (
        <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={cx(isDragging && 'relative z-[5] [&>div]:bg-surface [&>div]:shadow-float')}>
            <PositionRow
                {...props}
                handle={
                    props.readOnly ? (
                        <span aria-hidden className="ed-pos__handle w-6" />
                    ) : (
                        <button
                            type="button"
                            ref={setActivatorNodeRef}
                            className="ed-pos__handle grid h-control w-6 cursor-grab touch-none place-items-center self-start rounded-sm text-faint hover:bg-surface-2 hover:text-ink active:cursor-grabbing [&_svg]:size-4"
                            aria-label={t('editor.position_move', { title: props.position.title || t('editor.position') })}
                            {...attributes}
                            {...listeners}
                        >
                            <GripVertical />
                        </button>
                    )
                }
            />
        </div>
    );
}

export function PositionRow({ position: p, docType, taxRates, units, fields, net, readOnly, smallBusiness, messages, autoFocus, onChange, onKind, onRemove, onEnter, handle }: PositionRowProps & { handle: ReactNode }) {
    const [showFields, setShowFields] = useState(false);
    const isText = p.kind === 'text';
    const path = (key: string) => `positions.${p.id}.${key}`;
    const filled = fields.filter((d) => p.custom[d.key] !== null && p.custom[d.key] !== undefined && p.custom[d.key] !== '').length;
    const fieldsInvalid = fields.some((d) => messages[path(`custom.${d.key}`)]);
    const kinds: PositionKind[] = docType === 'offer' ? ['item', 'optional', 'text'] : ['item', 'text'];
    const unitOptions = choices(units, p.unit_id);
    const rateOptions = choices(taxRates, p.tax_rate_id);
    const archived = (label: string, item: { archived_at: string | null } | undefined) => (item?.archived_at ? t('editor.archived', { label }) : label);

    return (
        <div
            data-position-row
            className={cx(
                'ed-pos rounded-md py-1 pr-2 pl-1 transition-colors hover:bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] focus-within:bg-[color-mix(in_srgb,var(--surface)_70%,transparent)]',
                isText && 'ed-pos--text',
                smallBusiness && 'ed-no-tax',
            )}
        >
            {handle}

            <div className="ed-pos__main grid min-w-0 gap-0.5">
                <TitleAutocomplete
                    value={p.title}
                    onChange={(title) => onChange({ title })}
                    onPick={(s) =>
                        onChange({
                            title: s.title,
                            description: s.description,
                            ...(isText
                                ? {}
                                : {
                                      unit_price: s.unit_price,
                                      unit_id: units.some((u) => u.id === s.unit_id && u.archived_at === null) ? s.unit_id : p.unit_id,
                                      tax_rate_id: taxRates.some((r) => r.id === s.tax_rate_id && r.archived_at === null) ? s.tax_rate_id : p.tax_rate_id,
                                  }),
                        })
                    }
                    onEnter={onEnter}
                    withSuggestions={!isText}
                    units={units}
                    disabled={readOnly}
                    autoFocus={autoFocus}
                    error={messages[path('title')]}
                    placeholder={isText ? t('editor.text_placeholder') : t('editor.title_placeholder')}
                    path={path('title')}
                    muted={isText}
                />
                {(!isText || p.description) && (
                    <textarea
                        data-path={path('description')}
                        className="ed-pos__desc min-h-7 w-full resize-none rounded-sm border-0 px-3 py-1 text-sm leading-snug text-muted [field-sizing:content] placeholder:text-faint focus:text-ink focus:shadow-[0_0_0_2px_var(--accent)] focus:outline-none"
                        rows={1}
                        value={p.description}
                        disabled={readOnly}
                        placeholder={t('editor.description_placeholder')}
                        aria-label={t('editor.description')}
                        onChange={(e) => onChange({ description: e.target.value })}
                    />
                )}
                {(p.kind === 'optional' || (!isText && fields.length > 0)) && (
                    <div className="flex flex-wrap items-center gap-2 pl-3">
                        {p.kind === 'optional' && (
                            <Tag neutral>
                                <CircleDashed aria-hidden className="size-3" />
                                {t('editor.optional_tag')}
                            </Tag>
                        )}
                        {!isText && fields.length > 0 && (
                            <button
                                type="button"
                                aria-expanded={showFields || fieldsInvalid}
                                onClick={() => setShowFields((v) => !v)}
                                className={cx('inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-xs font-medium hover:bg-surface-2 [&_svg]:size-3', fieldsInvalid ? 'text-bad' : 'text-muted hover:text-ink')}
                            >
                                <ListPlus aria-hidden />
                                {t('editor.custom_fields')} <span className="num">{`${filled}/${fields.length}`}</span>
                            </button>
                        )}
                    </div>
                )}
                {!isText && fields.length > 0 && (showFields || fieldsInvalid) && (
                    <div className="mt-1 mb-2 ml-3 grid gap-3 rounded-md bg-surface p-3 [grid-template-columns:repeat(auto-fill,minmax(11rem,1fr))]">
                        {fields.map((d) => (
                            <CustomFieldInput
                                key={d.id}
                                definition={d}
                                value={p.custom[d.key]}
                                disabled={readOnly}
                                path={path(`custom.${d.key}`)}
                                error={messages[path(`custom.${d.key}`)]}
                                onChange={(value) => onChange({ custom: { ...p.custom, [d.key]: value } })}
                            />
                        ))}
                    </div>
                )}
            </div>

            {!isText && (
                <>
                    <DecimalCell className="ed-pos__qty" value={p.quantity} onCommit={(quantity) => onChange({ quantity })} label={t('editor.quantity')} disabled={readOnly} error={messages[path('quantity')]} path={path('quantity')} />
                    <div className="ed-pos__unit" data-path={path('unit')}>
                        <SelectControl value={p.unit_id ?? ''} disabled={readOnly} invalid={!!messages[path('unit')]} title={messages[path('unit')]} aria-label={t('editor.unit')} onChange={(e) => onChange({ unit_id: e.target.value || null })}>
                            {!unitOptions.some((u) => u.id === p.unit_id) && <option value="">{t('editor.unit')}</option>}
                            {unitOptions.map((u) => (
                                <option key={u.id} value={u.id}>
                                    {archived(u.symbol, u)}
                                </option>
                            ))}
                        </SelectControl>
                    </div>
                    <DecimalCell className="ed-pos__price" value={p.unit_price} onCommit={(unit_price) => onChange({ unit_price })} label={t('editor.unit_price')} disabled={readOnly} error={messages[path('unit_price')]} path={path('unit_price')} minFraction={2} suffix="€" />
                    {!smallBusiness && (
                        <div className="ed-pos__tax" data-path={path('tax_rate')}>
                            <SelectControl value={p.tax_rate_id ?? ''} disabled={readOnly} invalid={!!messages[path('tax_rate')]} title={messages[path('tax_rate')]} aria-label={t('editor.tax_rate')} onChange={(e) => onChange({ tax_rate_id: e.target.value || null })}>
                                {!rateOptions.some((r) => r.id === p.tax_rate_id) && <option value="">{t('editor.tax_rate')}</option>}
                                {rateOptions.map((r) => (
                                    <option key={r.id} value={r.id}>
                                        {archived(r.label, r)}
                                    </option>
                                ))}
                            </SelectControl>
                        </div>
                    )}
                    <div aria-label={t('editor.line_total')} className={cx('ed-pos__total num flex h-control items-center justify-end whitespace-nowrap', p.kind === 'optional' ? 'font-medium text-muted line-through decoration-faint' : 'font-strong')}>
                        {net === undefined ? '–' : formatMoney(net)}
                    </div>
                </>
            )}

            <div className="ed-pos__menu flex h-control items-center">
                {!readOnly && (
                    <Menu
                        trigger={
                            <Button variant="ghost" size="sm" iconOnly icon={<MoreHorizontal />}>
                                {t('editor.position_menu')}
                            </Button>
                        }
                    >
                        <MenuLabel>{t('editor.kind_label')}</MenuLabel>
                        <MenuRadioGroup value={p.kind} onValueChange={(kind) => onKind(kind as PositionKind)}>
                            {kinds.map((kind) => (
                                <MenuRadioItem key={kind} value={kind} icon={KIND_ICON[kind]}>
                                    {t(`editor.kind.${kind}`)}
                                </MenuRadioItem>
                            ))}
                        </MenuRadioGroup>
                        <MenuSeparator />
                        <MenuItem danger icon={<Trash2 />} onSelect={onRemove}>
                            {t('editor.position_remove')}
                        </MenuItem>
                    </Menu>
                )}
            </div>
        </div>
    );
}
```

Hinweis: `MenuRadioGroup`/`MenuRadioItem` (`components/ui/menu.tsx`, Radix-Radio mit `aria-checked`) zeigen die aktive Art; `MenuRadioItem` nimmt `icon` an.

- [ ] **Step 4: Gruppen-Editor**

`resources/js/editor/components/groups-editor.tsx`:

```tsx
import {
    closestCenter,
    DndContext,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    useDroppable,
    useSensor,
    useSensors,
    type CollisionDetection,
    type DragEndEvent,
    type DragOverEvent,
    type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, FolderPlus, GripVertical, MoreHorizontal, Plus, Trash2, Ungroup } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useFieldDefinitions } from '@/api/fields';
import { useTaxRates, useUnits } from '@/api/master-data';
import type { ApiGroup, ApiPosition, Totals } from '@/api/types';
import { Button, cx, Menu, MenuItem } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { t, tn } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { isZeroDecimal } from '../decimal';
import * as ops from '../ops';
import { useEditor } from '../store';
import type { Draft } from '../types';
import { SortablePositionRow } from './position-row';

type Props = {
    draft: Draft;
    totals: Totals | null;
    smallBusiness: boolean;
    readOnly: boolean;
    messages: Record<string, string>;
    update(fn: (draft: Draft) => Draft): void;
};

const gid = (id: string) => `group:${id}`;
const pid = (id: string) => `pos:${id}`;
const bodyId = (id: string) => `body:${id}`;
const strip = (id: string | number) => String(id).replace(/^(group|pos|body):/, '');

/** Groups with drag and drop: groups among each other, positions within and between groups (keyboard: Space, arrows, Space). */
export function GroupsEditor({ draft, totals, smallBusiness, readOnly, messages, update }: Props) {
    const collapsed = useEditor((state) => state.collapsed);
    const toggleGroup = useEditor((state) => state.toggleGroup);
    const aliases = useEditor((state) => state.aliases);
    // React keys survive the id swap after a save (review focus: no focus loss while typing)
    const keyOf = (id: string) => aliases[id] ?? id;
    const taxRates = useTaxRates().data ?? [];
    const units = useUnits().data ?? [];
    const fields = (useFieldDefinitions('position').data ?? []).filter((d) => d.doc_types.includes(draft.type));
    const [focusId, setFocusId] = useState<string | null>(null);
    const [dragging, setDragging] = useState<string | null>(null);
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

    const defaults: ops.PositionDefaults = {
        unitId: units.find((u) => u.archived_at === null)?.id ?? null,
        taxRateId: taxRates.find((r) => r.archived_at === null)?.id ?? null,
        custom: Object.fromEntries(fields.map((d) => [d.key, d.default_value ?? null])),
    };

    // groups collide only with groups, positions with positions and group bodies (empty groups)
    const collision: CollisionDetection = (args) => {
        const isGroup = String(args.active.id).startsWith('group:');
        return closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((c) => String(c.id).startsWith('group:') === isGroup) });
    };

    const targetGroup = (overId: string) => (overId.startsWith('body:') ? strip(overId) : overId.startsWith('pos:') ? ops.groupOf(draft, strip(overId))?.id : undefined);

    const onDragStart = (e: DragStartEvent) => setDragging(String(e.active.id));

    const onDragOver = ({ active, over }: DragOverEvent) => {
        if (!over || !String(active.id).startsWith('pos:')) return;
        const positionId = strip(active.id);
        const from = ops.groupOf(draft, positionId);
        const to = targetGroup(String(over.id));
        if (!from || !to || from.id === to) return;
        const target = draft.groups.find((g) => g.id === to)!;
        const index = String(over.id).startsWith('pos:') ? target.positions.findIndex((p) => p.id === strip(over.id)) : target.positions.length;
        update((d) => ops.movePosition(d, positionId, to, index < 0 ? target.positions.length : index));
    };

    const onDragEnd = ({ active, over }: DragEndEvent) => {
        setDragging(null);
        if (!over || active.id === over.id) return;
        const activeId = String(active.id);
        if (activeId.startsWith('group:')) {
            const from = draft.groups.findIndex((g) => g.id === strip(activeId));
            const to = draft.groups.findIndex((g) => g.id === strip(over.id));
            if (from >= 0 && to >= 0) update((d) => ops.moveGroup(d, from, to));
            return;
        }
        const positionId = strip(activeId);
        const group = ops.groupOf(draft, positionId);
        if (!group || group.id !== targetGroup(String(over.id))) return;
        const index = String(over.id).startsWith('pos:') ? group.positions.findIndex((p) => p.id === strip(over.id)) : group.positions.length - 1;
        update((d) => ops.movePosition(d, positionId, group.id, index));
    };

    const addPosition = (groupId: string, afterId?: string) => {
        const position = ops.newPosition('item', defaults);
        update((d) => ops.addPosition(d, groupId, position, afterId));
        setFocusId(position.id);
    };

    const addGroup = () => {
        const titled = draft.groups.filter((g) => g.title !== null).length;
        const before = new Set(draft.groups.map((g) => g.id));
        update((d) => ops.addGroup(d, t('editor.group_default', { n: titled + 1 }), ops.newPosition('item', defaults)));
        // new group: focus and select its title so the name can be typed right away
        requestAnimationFrame(() => {
            const input = [...document.querySelectorAll<HTMLInputElement>('input[data-group-title]')].find((el) => !before.has(el.dataset.groupTitle ?? ''));
            input?.focus();
            input?.select();
        });
    };

    const addLoose = () => {
        const position = ops.newPosition('item', defaults);
        update((d) => ops.addGroup(d, null, position, true));
        setFocusId(position.id);
    };

    const removeGroup = (group: ApiGroup) => {
        const { group: removed, index } = ops.removeGroup(draft, group.id);
        if (!removed) return;
        update((d) => ops.removeGroup(d, group.id).draft);
        toast.info(t('editor.group_removed', { title: group.title ?? t('editor.loose') }), { label: t('editor.undo'), run: () => update((d) => ops.restoreGroup(d, removed, index)) });
    };

    const removePosition = (position: ApiPosition) => {
        const result = ops.removePosition(draft, position.id);
        if (!result.position || !result.groupId) return;
        const { groupId, index } = result;
        update((d) => ops.removePosition(d, position.id).draft);
        if (position.title.trim() || !isZeroDecimal(position.unit_price)) {
            toast.info(t('editor.position_removed', { title: position.title || t('editor.position') }), {
                label: t('editor.undo'),
                run: () => update((d) => ops.restorePosition(d, groupId, position, index)),
            });
        }
    };

    const titled = draft.groups.filter((g) => g.title !== null).length;
    const draggingGroup = dragging?.startsWith('group:') ? draft.groups.find((g) => g.id === strip(dragging)) : null;

    return (
        <div className="ed-groups grid gap-3" data-path="positions">
            <div className={cx('ed-pos-head pr-3 pl-2 text-xs font-medium text-muted', smallBusiness && 'ed-no-tax')} aria-hidden>
                <span />
                <span>{t('editor.col_title')}</span>
                <span className="text-right">{t('editor.col_quantity')}</span>
                <span>{t('editor.col_unit')}</span>
                <span className="text-right">{t('editor.col_price')}</span>
                {!smallBusiness && <span>{t('editor.col_tax')}</span>}
                <span className="text-right">{t('editor.col_total')}</span>
                <span />
            </div>

            <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
                <SortableContext items={draft.groups.map((g) => gid(g.id))} strategy={verticalListSortingStrategy}>
                    {draft.groups.map((group) => (
                        <SortableGroup
                            key={keyOf(group.id)}
                            group={group}
                            readOnly={readOnly}
                            collapsed={collapsed.includes(group.id)}
                            canDrag={titled > 0 || draft.groups.length > 1}
                            total={totals?.groups[group.id]?.net}
                            optionalTotal={totals?.groups[group.id]?.optional_net}
                            error={messages[`groups.${group.id}.title`]}
                            onToggle={() => toggleGroup(group.id)}
                            onRename={(title) => update((d) => ops.updateGroup(d, group.id, { title }))}
                            onRemove={() => removeGroup(group)}
                            onDissolve={() => update((d) => ops.dissolveGroup(d, group.id))}
                            onAdd={() => addPosition(group.id)}
                        >
                            <SortableContext items={group.positions.map((p) => pid(p.id))} strategy={verticalListSortingStrategy}>
                                {group.positions.map((position, i) => (
                                    <SortablePositionRow
                                        key={keyOf(position.id)}
                                        position={position}
                                        docType={draft.type}
                                        taxRates={taxRates}
                                        units={units}
                                        fields={fields}
                                        net={totals?.lines[position.id]?.net}
                                        readOnly={readOnly}
                                        smallBusiness={smallBusiness}
                                        messages={messages}
                                        autoFocus={focusId === position.id}
                                        onChange={(patch) => update((d) => ops.updatePosition(d, position.id, patch))}
                                        onKind={(kind) => update((d) => ops.setPositionKind(d, position.id, kind, defaults))}
                                        onRemove={() => removePosition(position)}
                                        onEnter={() => {
                                            if (i === group.positions.length - 1) addPosition(group.id, position.id);
                                        }}
                                    />
                                ))}
                            </SortableContext>
                        </SortableGroup>
                    ))}
                </SortableContext>
                <DragOverlay>
                    {draggingGroup && (
                        <div className="flex cursor-grabbing items-center gap-2 rounded-lg bg-surface p-3 shadow-float">
                            <GripVertical aria-hidden className="size-4 text-muted" />
                            <b>{draggingGroup.title ?? t('editor.loose')}</b>
                        </div>
                    )}
                </DragOverlay>
            </DndContext>

            {draft.groups.every((g) => g.positions.length === 0) && !readOnly && <p className="px-1 py-2 text-sm text-muted">{t('editor.positions_empty')}</p>}

            {!readOnly && (
                <div className="flex flex-wrap gap-2 pt-1">
                    <Button variant="soft" size="sm" icon={<FolderPlus />} onClick={addGroup}>
                        {t('editor.add_group')}
                    </Button>
                    {!draft.groups.some((g) => g.title === null) && (
                        <Button variant="ghost" size="sm" icon={<Plus />} onClick={addLoose}>
                            {t('editor.add_loose')}
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}

type GroupProps = {
    group: ApiGroup;
    readOnly: boolean;
    collapsed: boolean;
    canDrag: boolean;
    total: string | undefined;
    optionalTotal: string | undefined;
    error?: string;
    onToggle(): void;
    onRename(title: string): void;
    onRemove(): void;
    onDissolve(): void;
    onAdd(): void;
    children: ReactNode;
};

function SortableGroup({ group: g, readOnly, collapsed, canDrag, total, optionalTotal, error, onToggle, onRename, onRemove, onDissolve, onAdd, children }: GroupProps) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: gid(g.id), disabled: readOnly || !canDrag });
    const { setNodeRef: setBodyRef, isOver } = useDroppable({ id: bodyId(g.id), disabled: readOnly });
    const loose = g.title === null;
    const count = g.positions.filter((p) => p.kind !== 'text').length;

    return (
        <div
            ref={setNodeRef}
            role="group"
            aria-label={g.title ?? t('editor.loose')}
            style={{ transform: CSS.Translate.toString(transform), transition }}
            className={cx('rounded-lg px-1 py-2 transition-[box-shadow,background-color]', loose ? 'bg-transparent' : 'bg-bg', isDragging && 'opacity-40', isOver && 'shadow-[inset_0_0_0_2px_var(--accent-soft-hover)]')}
        >
            {!loose && (
                <div className="flex items-center gap-1 pt-0.5 pr-2 pb-2 pl-1" data-path={`groups.${g.id}.title`}>
                    {!readOnly && (
                        <button
                            type="button"
                            ref={setActivatorNodeRef}
                            aria-label={t('editor.group_move', { title: g.title ?? '' })}
                            className="grid h-control w-6 shrink-0 cursor-grab touch-none place-items-center rounded-sm text-faint hover:bg-surface-2 hover:text-ink active:cursor-grabbing [&_svg]:size-4"
                            {...attributes}
                            {...listeners}
                        >
                            <GripVertical />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onToggle}
                        aria-expanded={!collapsed}
                        aria-label={collapsed ? t('editor.group_expand') : t('editor.group_collapse')}
                        className="grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink [&_svg]:size-4 [&_svg]:transition-transform aria-[expanded=false]:[&_svg]:-rotate-90"
                    >
                        <ChevronDown />
                    </button>
                    <input
                        data-group-title={g.id}
                        value={g.title ?? ''}
                        disabled={readOnly}
                        aria-label={t('editor.group_name')}
                        aria-invalid={error ? true : undefined}
                        title={error}
                        placeholder={t('editor.group_name')}
                        className={cx(
                            'h-8 min-w-24 flex-1 rounded-sm border-0 bg-transparent px-2 text-lg font-heading tracking-tight text-ink hover:enabled:bg-surface focus:bg-surface focus:shadow-[0_0_0_2px_var(--accent)] focus:outline-none',
                            error && 'shadow-[0_0_0_2px_var(--bad)]',
                        )}
                        onChange={(e) => onRename(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                e.currentTarget.closest('[role="group"]')?.querySelector<HTMLInputElement>('[data-position-row] input[role="combobox"]')?.focus();
                            }
                        }}
                    />
                    {collapsed && <span className="text-xs whitespace-nowrap text-muted">{tn('editor.group_count', count)}</span>}
                    <span className="ml-auto flex items-baseline gap-2 px-2 font-strong whitespace-nowrap" title={t('editor.group_subtotal')}>
                        {optionalTotal !== undefined && !isZeroDecimal(optionalTotal) && <span className="text-xs font-medium text-muted">{t('editor.group_optional', { amount: formatMoney(optionalTotal) })}</span>}
                        <span className="num">{total === undefined ? '–' : formatMoney(total)}</span>
                    </span>
                    {!readOnly && (
                        <Menu
                            trigger={
                                <Button variant="ghost" size="sm" iconOnly icon={<MoreHorizontal />}>
                                    {t('editor.group_menu')}
                                </Button>
                            }
                        >
                            <MenuItem icon={<Ungroup />} onSelect={onDissolve}>
                                {t('editor.group_dissolve')}
                            </MenuItem>
                            <MenuItem danger icon={<Trash2 />} onSelect={onRemove}>
                                {t('editor.group_remove')}
                            </MenuItem>
                        </Menu>
                    )}
                </div>
            )}
            {!collapsed && (
                <div ref={setBodyRef} className="grid min-h-10 gap-0.5">
                    {children}
                    {g.positions.length === 0 && <p className="px-4 py-3 text-sm text-faint">{t('editor.group_empty')}</p>}
                    {!readOnly && (
                        <div className="flex gap-2 pt-0.5 pr-2 pl-9">
                            <button type="button" onClick={onAdd} className="inline-flex h-8 items-center gap-1.5 rounded-full px-2 text-sm font-medium text-accent hover:bg-accent-soft [&_svg]:size-[0.95rem]">
                                <Plus aria-hidden />
                                {t('editor.add_position')}
                            </button>
                            {loose && g.positions.length === 0 && (
                                <button type="button" onClick={onRemove} className="inline-flex h-8 items-center rounded-full px-2 text-sm font-medium text-muted hover:bg-surface-2">
                                    {t('editor.remove')}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
```

Vorher prüfen: Tailwind 4 kennt `aria-[expanded=false]:` und die Stapel-Variante `aria-[expanded=false]:[&_svg]:-rotate-90`; falls der Build die Klasse nicht erzeugt (im CSS nach `-rotate-90` suchen), stattdessen am `<ChevronDown className={collapsed ? '-rotate-90' : undefined} />` drehen.

- [ ] **Step 5: In den Editor einsetzen**

In `resources/js/editor/components/editor.tsx` Import ergänzen (`import { GroupsEditor } from './groups-editor';`) und im Positionsabschnitt zwischen Kopfzeile (`<div className="flex flex-wrap items-center gap-3">…</div>`) und `<TotalsPanel totals={totals} />` einfügen:

```tsx
                    <GroupsEditor draft={draft} totals={totals} smallBusiness={context.small_business} readOnly={readOnly} messages={messages} update={update} />
```

- [ ] **Step 6: Prüfen**

Run: `ddev exec pnpm typecheck && ddev exec pnpm test && ddev exec pnpm build`
Expected: grün.

Im Browser (Angebot-Entwurf):
- „Gruppe hinzufügen“ → Titel markiert, „Konzept“ tippen, Enter springt in die erste Position.
- Position tippen „Work…“ → Vorschläge aus den Demo-Dokumenten; Pfeil runter + Enter übernimmt Preis/Einheit/Satz.
- Menge `2`, Preis `450` → Zeilensumme und Gruppensumme erscheinen nach ~250 ms (aus `render`), Summenkasten passt.
- Menge `abc` + Tab → rot markiert, Tooltip „Enter a number…“, Network zeigt keinen PATCH mit `abc`.
- Gruppe per Griff ziehen und per Tastatur (Griff fokussieren, Leertaste, Pfeil hoch, Leertaste); Position in eine andere Gruppe ziehen; Reihenfolge bleibt nach dem Neuladen.
- Gruppe entfernen → Toast „Rückgängig“ stellt sie wieder her; Gruppe auflösen → Positionen wandern zu den losen.
- Positionsart „Optionale Leistung“ (nur Angebot) → durchgestrichene Summe, „+ … optional“ an der Gruppe, Zeile „Optionale Positionen“ im Summenkasten.
- 390 px Breite: Zeilen gestapelt (Container-Query), nichts läuft horizontal über.

- [ ] **Step 7: Commit**

```bash
git add resources/js/editor
git commit -m "feat(editor): groups and positions with drag and drop, suggestions and decimal inputs" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 11: Aktionen – Abschließen, Status, Umwandeln, Storno, Duplizieren, PDF

**Files:**
- Create: `resources/js/editor/use-actions.ts`, `resources/js/editor/components/editor-actions.tsx`
- Modify: `resources/js/editor/components/editor.tsx`

**Interfaces:**
- Consumes: `finalizeDocument`, `setDocumentStatus`, `convertDocument`, `cancelInvoice`, `duplicateDocument` (Task 4), `keys.document`, `keys.documentPdf` (Task 4), `violationPath` (Task 6), `jumpToIssue` (Task 6), `useEditor` (Task 7), `useAutosave().flush` (Task 7), `context.allowed`, `context.next_number` (Task 3), `ConfirmDialog`, `Menu`, `MenuItem`, `MenuSeparator`, `Button` (`components/ui`), `mutate` (`swr`), `router` (`@inertiajs/react`).
- Produces: `useDocumentActions({ document, issues, flush, stop, expand }): DocumentActions` (in diesem Task ohne `remove`, das ergänzt Task 12), `EditorActions` (Props `{ document, context, actions }`).

- [ ] **Step 1: Aktions-Hook**

`resources/js/editor/use-actions.ts`:

```ts
import { router } from '@inertiajs/react';
import { useState } from 'react';
import { mutate } from 'swr';
import { cancelInvoice, convertDocument, duplicateDocument, finalizeDocument, setDocumentStatus } from '@/api/documents';
import { keys } from '@/api/keys';
import type { DocumentDetail, DocumentStatus, DocumentType, Issue } from '@/api/types';
import { ApiError, errorMessage } from '@/lib/api';
import { path, t, tn } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { jumpToIssue } from './jump';
import { violationPath } from './paths';
import { useEditor } from './store';

type Running = 'finalize' | 'status' | 'convert' | 'cancel' | 'duplicate';

export type DocumentActions = {
    pending: Running | null;
    finalizeOpen: boolean;
    cancelOpen: boolean;
    startFinalize(): Promise<void>;
    confirmFinalize(): Promise<void>;
    closeFinalize(): void;
    setStatus(status: DocumentStatus): Promise<void>;
    convert(type: DocumentType): Promise<void>;
    openCancel(): void;
    confirmCancel(): Promise<void>;
    closeCancel(): void;
    duplicate(): Promise<void>;
    openPdf(): Promise<void>;
};

type Args = { document: DocumentDetail; issues: Issue[]; flush(): Promise<void>; expand(): void };

/**
 * The document actions of the editor. Every rule (may this be finalized, converted, cancelled?) is the server's:
 * the buttons follow the page context, the API answers with the new document or a problem.
 */
export function useDocumentActions({ document, issues, flush, expand }: Args): DocumentActions {
    const [pending, setPending] = useState<Running | null>(null);
    const [finalizeOpen, setFinalizeOpen] = useState(false);
    const [cancelOpen, setCancelOpen] = useState(false);
    const label = (type: DocumentType) => t(`document_type.${type}`);

    const report = (error: unknown) => {
        toast.error(errorMessage(error));
        // a refused finalize lists the compliance issues as violations: jump to the first one
        const first = error instanceof ApiError ? error.violations[0] : undefined;
        if (first) jumpToIssue(violationPath(useEditor.getState().draft ?? { groups: [] }, first.path), expand);
    };

    const run = async (name: Running, job: () => Promise<void>) => {
        setPending(name);
        try {
            await job();
        } catch (error) {
            report(error);
        } finally {
            setPending(null);
        }
    };

    /** The answer is the changed document: into the cache, then the page context (allowed actions, chain) anew. */
    const settle = async (saved: DocumentDetail) => {
        await mutate(keys.document(saved.id), saved, { revalidate: false });
        router.reload({ only: ['context'] });
    };

    /** Another document came out of the action: cache it (no skeleton) and open it. */
    const open = async (created: DocumentDetail) => {
        await mutate(keys.document(created.id), created, { revalidate: false });
        router.visit(path(`/documents/${created.id}`));
    };

    return {
        pending,
        finalizeOpen,
        cancelOpen,
        startFinalize: async () => {
            if (issues.length > 0) {
                toast.error(tn('editor.finalize_blocked', issues.length));
                jumpToIssue(issues[0].path, expand);
                return;
            }
            await flush();
            // invalid input or a conflict: the save status and the notice say why
            if (useEditor.getState().saveState !== 'saved') return;
            router.reload({ only: ['context'] }); // number preview for the current date
            setFinalizeOpen(true);
        },
        confirmFinalize: () =>
            run('finalize', async () => {
                try {
                    const saved = await finalizeDocument(document.id);
                    await settle(saved);
                    toast.success(t('editor.finalized', { type: label(saved.type), number: saved.number ?? '' }));
                } finally {
                    setFinalizeOpen(false);
                }
            }),
        closeFinalize: () => setFinalizeOpen(false),
        setStatus: (status) =>
            run('status', async () => {
                await settle(await setDocumentStatus(document.id, status));
                toast.success(t('editor.status_set', { status: t(`status.${status}`) }));
            }),
        convert: (type) =>
            run('convert', async () => {
                const created = await convertDocument(document.id, type);
                await open(created);
                toast.success(t('editor.converted', { type: label(type) }));
                if (created.dropped_fields.length > 0) toast.info(t('editor.dropped_fields', { type: label(type), fields: created.dropped_fields.join(', ') }));
            }),
        openCancel: () => setCancelOpen(true),
        confirmCancel: () =>
            run('cancel', async () => {
                try {
                    await open(await cancelInvoice(document.id));
                    toast.success(t('editor.converted', { type: label('cancellation') }));
                } finally {
                    setCancelOpen(false);
                }
            }),
        closeCancel: () => setCancelOpen(false),
        duplicate: () =>
            run('duplicate', async () => {
                await flush();
                await open(await duplicateDocument(document.id));
                toast.success(t('editor.duplicated'));
            }),
        openPdf: async () => {
            // a draft renders live (with watermark): save first, so the PDF shows what is on screen
            if (!document.is_locked) await flush();
            window.open(keys.documentPdf(document.id), '_blank', 'noopener');
        },
    };
}
```

Vorher prüfen: `router.reload({ only: ['context'] })` und `router.visit(url)` sind die Inertia-v3-Signaturen (`node_modules/@inertiajs/core/types/router.d.ts`); `only` lädt nur die Prop `context` neu.

- [ ] **Step 2: Aktionsleiste**

`resources/js/editor/components/editor-actions.tsx`:

```tsx
import { Ban, ChevronDown, Copy, Download, Lock, MoreHorizontal, Repeat2 } from 'lucide-react';
import type { DocumentDetail, DocumentPageContext } from '@/api/types';
import { Button, ConfirmDialog, Menu, MenuItem, MenuSeparator } from '@/components/ui';
import { t } from '@/lib/i18n';
import type { DocumentActions } from '../use-actions';

/** More actions, status change, conversion and finalize – each only when the page context allows it. */
export function EditorActions({ document, context, actions }: { document: DocumentDetail; context: DocumentPageContext; actions: DocumentActions }) {
    const { allowed } = context;
    const typeLabel = t(`document_type.${document.type}`);
    const busy = actions.pending !== null;

    return (
        <>
            <Menu
                trigger={
                    <Button variant="ghost" iconOnly icon={<MoreHorizontal />}>
                        {t('editor.more')}
                    </Button>
                }
            >
                <MenuItem icon={<Download />} onSelect={() => void actions.openPdf()}>
                    {t('editor.pdf')}
                </MenuItem>
                {allowed.duplicate && (
                    <MenuItem icon={<Copy />} disabled={busy} onSelect={() => void actions.duplicate()}>
                        {t('editor.duplicate')}
                    </MenuItem>
                )}
                {allowed.cancel && (
                    <>
                        <MenuSeparator />
                        <MenuItem danger icon={<Ban />} disabled={busy} onSelect={actions.openCancel}>
                            {t('editor.cancel_invoice')}
                        </MenuItem>
                    </>
                )}
            </Menu>

            {allowed.statuses.length > 0 && (
                <Menu
                    trigger={
                        <Button pending={actions.pending === 'status'}>
                            {t('editor.status_change')}
                            <ChevronDown aria-hidden />
                        </Button>
                    }
                >
                    {allowed.statuses.map((status) => (
                        <MenuItem key={status} onSelect={() => void actions.setStatus(status)}>
                            {t(`editor.status_action.${status}`)}
                        </MenuItem>
                    ))}
                </Menu>
            )}

            {allowed.conversions.length === 1 && (
                <Button variant="primary" icon={<Repeat2 />} pending={actions.pending === 'convert'} onClick={() => void actions.convert(allowed.conversions[0])}>
                    {t('editor.convert_to', { type: t(`document_type.${allowed.conversions[0]}`) })}
                </Button>
            )}
            {allowed.conversions.length > 1 && (
                <Menu
                    trigger={
                        <Button variant="primary" icon={<Repeat2 />} pending={actions.pending === 'convert'}>
                            {t('editor.convert')}
                            <ChevronDown aria-hidden />
                        </Button>
                    }
                >
                    {allowed.conversions.map((type) => (
                        <MenuItem key={type} onSelect={() => void actions.convert(type)}>
                            {t('editor.convert_menu_item', { type: t(`document_type.${type}`) })}
                        </MenuItem>
                    ))}
                </Menu>
            )}

            {allowed.finalize && !document.is_locked && (
                <Button variant="primary" icon={<Lock />} pending={actions.pending === 'finalize'} onClick={() => void actions.startFinalize()}>
                    {t('editor.finalize')}
                </Button>
            )}

            <ConfirmDialog
                open={actions.finalizeOpen}
                onClose={actions.closeFinalize}
                onConfirm={() => void actions.confirmFinalize()}
                pending={actions.pending === 'finalize'}
                icon={<Lock />}
                title={t('editor.finalize_title', { type: typeLabel })}
                description={`${t('editor.finalize_text', { number: context.next_number ?? '–' })}${document.type === 'invoice' ? ` ${t('editor.read_only_invoice')}` : ''}`}
                confirmLabel={t('editor.finalize')}
            />
            <ConfirmDialog
                open={actions.cancelOpen}
                onClose={actions.closeCancel}
                onConfirm={() => void actions.confirmCancel()}
                pending={actions.pending === 'cancel'}
                danger
                icon={<Ban />}
                title={t('editor.cancel_title', { number: document.number ?? '' })}
                description={t('editor.cancel_text')}
                confirmLabel={t('editor.cancel_confirm')}
            />
        </>
    );
}
```

- [ ] **Step 3: Verdrahten**

In `resources/js/editor/components/editor.tsx`:

1. Imports ergänzen: `import { useDocumentActions } from '../use-actions';`, `import { EditorActions } from './editor-actions';`; den Import `import { keys } from '@/api/keys';` entfernen.
2. Die Zeile `const openPdf = () => window.open(keys.documentPdf(document.id), '_blank', 'noopener');` ersetzen durch:

```tsx
    const actions = useDocumentActions({ document, issues, flush: autosave.flush, expand: expandAll });
```

3. Im `EditorHeader` nach dem Vorschau-Knopf `<EditorActions document={document} context={context} actions={actions} />` einsetzen.
4. Am `PreviewPane` `onPdf={openPdf}` durch `onPdf={() => void actions.openPdf()}` ersetzen.

- [ ] **Step 4: Prüfen**

Run: `ddev exec pnpm typecheck && ddev exec pnpm test && ddev exec pnpm build`
Expected: grün.

Im Browser mit Demo-Daten (`ddev artisan db:seed --class=DemoSeeder`):
- Angebot-Entwurf: „Abschließen“ → Dialog nennt die Nummer (`AN-2026-…`) → bestätigen → Kopf zeigt Nummer und „Offen“, Hinweis „Abgeschlossen am …“, Felder gesperrt, Vorschau ohne Wasserzeichen.
- „Status ändern → Als angenommen markieren“ → „Umwandeln → In Rechnung“ → neuer Entwurf geöffnet, Kette „Angebot AN-… › Rechnung Entwurf“.
- Rechnung mit fehlender Fälligkeit → „Abschließen“ zeigt Toast „Es fehlt noch 1 Pflichtangabe.“ und springt ins Feld.
- „Weitere Aktionen → PDF herunterladen“ öffnet das PDF im neuen Tab (Entwurf mit Wasserzeichen); „Duplizieren“ öffnet die Kopie.
- Offene Rechnung → „Stornieren“ → Dialog → „Storno anlegen“ öffnet den Storno-Entwurf.

- [ ] **Step 5: Commit**

```bash
git add resources/js/editor
git commit -m "feat(editor): finalize with confirmation, status, convert, cancel, duplicate and PDF" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 12: Entwurf löschen mit Undo

**Files:**
- Modify: `resources/js/lib/toast.ts`, `resources/js/components/ui/toaster.tsx`, `resources/js/pages/documents/index.tsx`, `resources/js/editor/use-actions.ts`, `resources/js/editor/components/editor-actions.tsx`, `resources/js/editor/components/editor.tsx`
- Create: `resources/js/lib/pending-delete.ts`
- Test: `resources/js/lib/toast.test.ts`, `resources/js/lib/pending-delete.test.ts`

**Interfaces:**
- Consumes: `deleteDocument(id, { keepalive })` (Task 4), `useAutosave().stop` (Task 7), `useEditor().reset` (Task 7).
- Produces: `ToastAction.onExpire`, `dismissToast(id, used?)`, `scheduleDelete`, `pendingDeleteIds`, `usePendingDeletes`, `commitAllKeepalive`, `DocumentActions.remove()`.

- [ ] **Step 1: Failing Tests**

In `resources/js/lib/toast.test.ts` am Ende anfügen:

```ts
describe('onExpire', () => {
    it('runs when a toast with an action closes by itself or through its close button', () => {
        const expired = vi.fn();
        toast.success('Draft deleted', { label: 'Undo', run: () => undefined, onExpire: expired });
        vi.advanceTimersByTime(6100);
        expect(expired).toHaveBeenCalledTimes(1);

        const closed = vi.fn();
        const id = toast.success('Draft deleted', { label: 'Undo', run: () => undefined, onExpire: closed });
        dismissToast(id);
        expect(closed).toHaveBeenCalledTimes(1);
    });

    it('does not run when the action was used', () => {
        const expired = vi.fn();
        const id = toast.success('Draft deleted', { label: 'Undo', run: () => undefined, onExpire: expired });

        dismissToast(id, true);
        vi.advanceTimersByTime(10_000);
        expect(expired).not.toHaveBeenCalled();
    });

    it('runs for a toast pushed out by newer ones', () => {
        const expired = vi.fn();
        toast.success('Draft deleted', { label: 'Undo', run: () => undefined, onExpire: expired });
        ['one', 'two', 'three'].forEach((message) => toast.info(message));

        expect(expired).toHaveBeenCalledTimes(1);
    });
});
```

`resources/js/lib/pending-delete.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { commitAllKeepalive, pendingDeleteIds, scheduleDelete } from './pending-delete';

afterEach(() => commitAllKeepalive());

describe('scheduleDelete', () => {
    it('hides the draft until undo, without deleting it', () => {
        const run = vi.fn(async () => undefined);
        const pending = scheduleDelete('d1', run);

        expect(pendingDeleteIds().has('d1')).toBe(true);
        expect(pending.undo()).toBe(true);
        expect(pendingDeleteIds().has('d1')).toBe(false);
        expect(run).not.toHaveBeenCalled();
    });

    it('deletes on commit, once, and refuses undo once the delete started', async () => {
        let finish!: () => void;
        const run = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
        const pending = scheduleDelete('d2', run);

        const committing = pending.commit();
        expect(pending.undo()).toBe(false);
        // stays hidden until the server answered (no flash of the row)
        expect(pendingDeleteIds().has('d2')).toBe(true);
        finish();
        await committing;
        await pending.commit();

        expect(run).toHaveBeenCalledTimes(1);
        expect(run).toHaveBeenCalledWith({ keepalive: false });
        expect(pendingDeleteIds().has('d2')).toBe(false);
    });

    it('shows the draft again when the delete fails', async () => {
        const pending = scheduleDelete('d3', async () => {
            throw new Error('locked');
        });

        await expect(pending.commit()).rejects.toThrow('locked');
        expect(pendingDeleteIds().has('d3')).toBe(false);
    });

    it('sends every waiting delete with keepalive when the tab closes (review focus)', () => {
        const run = vi.fn(async () => undefined);
        scheduleDelete('d4', run);

        commitAllKeepalive();

        expect(run).toHaveBeenCalledWith({ keepalive: true });
        expect(pendingDeleteIds().size).toBe(0);
    });
});
```

- [ ] **Step 2: Rot**

Run: `ddev exec pnpm test -- resources/js/lib`
Expected: FAIL – `onExpire` wird nie aufgerufen; `Failed to resolve import "./pending-delete"`.

- [ ] **Step 3: Toast**

In `resources/js/lib/toast.ts`:

1. Typ:

```ts
/** onExpire: the toast closed without its action (time up, close button, pushed out) – e.g. the delayed delete. */
export type ToastAction = { label: string; run(): void; onExpire?(): void };
```

2. `dismissToast` ersetzen:

```ts
/** `used`: the action ran (undo), so onExpire does not. */
export function dismissToast(id: number, used = false): void {
    const timer = timers.get(id);
    if (timer?.handle) clearTimeout(timer.handle);
    timers.delete(id);
    const item = toasts.find((entry) => entry.id === id);
    toasts = toasts.filter((entry) => entry.id !== id);
    emit();
    if (item && !used) item.action?.onExpire?.();
}
```

3. In `push()` nach `emit();` (vor `return id;`) die verdrängten Toasts ablaufen lassen:

```ts
    dropped.forEach((item) => item.action?.onExpire?.());
```

In `resources/js/components/ui/toaster.tsx` den Klick auf die Aktion (`item.action?.run(); dismissToast(item.id);`) ändern zu:

```tsx
                        item.action?.run();
                        dismissToast(item.id, true);
```

- [ ] **Step 4: Verzögertes Löschen**

`resources/js/lib/pending-delete.ts`:

```ts
import { useSyncExternalStore } from 'react';

export type DeleteRun = (options: { keepalive: boolean }) => Promise<void>;
type Entry = { run: DeleteRun; committing: boolean };

const entries = new Map<string, Entry>();
let snapshot: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

function emit(): void {
    snapshot = new Set(entries.keys());
    listeners.forEach((listener) => listener());
}

/** Closing the tab: every delete still waiting for its toast goes out with keepalive. */
export function commitAllKeepalive(): void {
    for (const [id, entry] of entries) {
        if (entry.committing) continue;
        entry.committing = true;
        entries.delete(id);
        void entry.run({ keepalive: true }).catch(() => undefined);
    }
    emit();
}

let listening = false;

function listen(): void {
    if (listening || typeof window === 'undefined') return;
    listening = true;
    window.addEventListener('pagehide', commitAllKeepalive);
}

/**
 * Delete with undo (the API deletes drafts for good): the draft disappears from the lists at once, DELETE runs on
 * commit() – when the undo toast closed without undo. undo() keeps the draft as long as the delete has not started.
 */
export function scheduleDelete(id: string, run: DeleteRun): { undo(): boolean; commit(): Promise<void> } {
    const entry: Entry = { run, committing: false };
    entries.set(id, entry);
    listen();
    emit();

    return {
        undo: () => {
            if (entries.get(id) !== entry || entry.committing) return false;
            entries.delete(id);
            emit();
            return true;
        },
        commit: async () => {
            if (entries.get(id) !== entry || entry.committing) return;
            entry.committing = true;
            try {
                await run({ keepalive: false });
            } finally {
                if (entries.get(id) === entry) entries.delete(id);
                emit();
            }
        },
    };
}

export function pendingDeleteIds(): ReadonlySet<string> {
    return snapshot;
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function usePendingDeletes(): ReadonlySet<string> {
    return useSyncExternalStore(subscribe, pendingDeleteIds, pendingDeleteIds);
}
```

- [ ] **Step 5: Grün**

Run: `ddev exec pnpm test -- resources/js/lib`
Expected: PASS (inkl. der vorhandenen Toast-Tests; `afterEach` dort ruft `dismissToast` ohne `used` – das löst `onExpire` der Test-Toasts aus, die `vi.fn()` sind).

- [ ] **Step 6: Aktion und Liste**

In `resources/js/editor/use-actions.ts`:

1. Imports ergänzen: `deleteDocument` aus `@/api/documents`, `scheduleDelete` aus `@/lib/pending-delete`.
2. `DocumentActions` um `remove(): void;` erweitern, `Args` um `stop(): void`, die Signatur zu `useDocumentActions({ document, issues, flush, stop, expand }: Args)`.
3. Im zurückgegebenen Objekt ergänzen:

```ts
        remove: () => {
            // nothing may be saved anymore; an undo loads the draft fresh from the server
            stop();
            useEditor.getState().reset();
            const id = document.id;
            const pendingDelete = scheduleDelete(id, (options) => deleteDocument(id, options));
            router.visit(path('/documents'));
            toast.success(t('editor.deleted'), {
                label: t('editor.undo'),
                run: () => {
                    if (!pendingDelete.undo()) return;
                    router.visit(path(`/documents/${id}`));
                    toast.info(t('editor.restored'));
                },
                onExpire: () => void pendingDelete.commit().catch((error: unknown) => toast.error(errorMessage(error))),
            });
        },
```

In `resources/js/editor/components/editor.tsx` den Hook-Aufruf zu `useDocumentActions({ document, issues, flush: autosave.flush, stop: autosave.stop, expand: expandAll })` ändern.

In `resources/js/editor/components/editor-actions.tsx` im Menü „Weitere Aktionen“ nach dem Storno-Block ergänzen (Import `Trash2` aus `lucide-react`):

```tsx
                {allowed.delete && (
                    <>
                        <MenuSeparator />
                        <MenuItem danger icon={<Trash2 />} disabled={busy} onSelect={actions.remove}>
                            {t('editor.delete')}
                        </MenuItem>
                    </>
                )}
```

In `resources/js/pages/documents/index.tsx` (Import `import { usePendingDeletes } from '@/lib/pending-delete';`) die Zeilen

```tsx
    const list = useDocumentList(filters);
    const groups = groupByMonth(list.items);
```

ersetzen durch

```tsx
    const list = useDocumentList(filters);
    // drafts deleted in the editor disappear at once; the DELETE follows when their undo toast is gone
    const removed = usePendingDeletes();
    const items = list.items.filter((row) => !removed.has(row.id));
    const groups = groupByMonth(items);
```

und weiter unten `list.items.length === 0` durch `items.length === 0` ersetzen (`grep -n "list.items" resources/js/pages/documents/index.tsx` darf danach nur noch die Filterzeile zeigen).

- [ ] **Step 7: Prüfen**

Run: `ddev exec pnpm typecheck && ddev exec pnpm test && ddev exec pnpm build`
Expected: grün.

Im Browser: Entwurf → „Weitere Aktionen → Entwurf löschen“ → Liste ohne den Entwurf, Toast „Entwurf gelöscht · Rückgängig“ → „Rückgängig“ öffnet den Entwurf wieder (Toast „Entwurf behalten“). Erneut löschen und warten, bis der Toast weg ist → Network zeigt `DELETE /api/documents/{id}` → 204; die URL des Entwurfs zeigt „Dokument nicht gefunden“.

- [ ] **Step 8: Commit**

```bash
git add resources/js/lib resources/js/components/ui/toaster.tsx resources/js/pages/documents/index.tsx resources/js/editor
git commit -m "feat(editor): delete drafts with undo (delayed delete, keepalive on close)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 13: Playwright – Hauptablauf in der UI

**Files:**
- Modify: `e2e/tests/helpers.ts` (`apiPost`)
- Create: `e2e/tests/editor-helpers.ts`, `e2e/tests/editor.spec.ts`

**Interfaces:**
- Consumes: DOM-Konventionen aus Task 8–12 (Überschrift `h1` mit `aria-label`, `data-testid="save-status"`, Gruppen `role="group"` mit Titel, Zeilen `data-position-row`, Combobox „Item“, Textfelder „Quantity“/„Unit price“, Griff „Move group “…””, `#check-panel`, Navigation „Document chain“, Summen `role="group"` „Totals“, Tabs „Preview“/„E-invoice“), Demo-Daten aus `DemoSeeder` (Hafenkontor Lindqvist GmbH, Inlandskunde; Steuersatz 19 % zuerst, Einheit „Std.“ zuerst; Nummernkreise `AN-`, `RE-`, `ST-`; Rechnung und Storno mit Profil `en16931`).
- Produces: `apiPost(page, url, body?)`, `newDocument`, `settle`, `fillRow`, `finalize`, `heading` für Task 14.

- [ ] **Step 1: Helfer**

In `e2e/tests/helpers.ts` anfügen:

```ts
/** A write against the API with the page's session: Sanctum needs the Referer and the XSRF cookie as header. */
export async function apiPost(page: Page, url: string, body: unknown = {}): Promise<unknown> {
    const xsrf = (await page.context().cookies()).find((cookie) => cookie.name === 'XSRF-TOKEN')?.value ?? '';
    const response = await page.request.post(url, {
        data: body,
        headers: { Accept: 'application/json', Referer: page.url(), 'X-XSRF-TOKEN': decodeURIComponent(xsrf) },
    });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
}
```

`e2e/tests/editor-helpers.ts`:

```ts
import { expect, type Locator, type Page } from '@playwright/test';

export const heading = (page: Page) => page.getByRole('heading', { level: 1 });

/** Creates a draft through the "New document" dialog and returns its id. */
export async function newDocument(page: Page, type: 'Quote' | 'Invoice', customer: RegExp): Promise<string> {
    await page.goto('/en/documents');
    await page.getByRole('button', { name: 'New document' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'New document' });
    await dialog.getByRole('radio', { name: new RegExp(type) }).click();
    await dialog.getByRole('radio', { name: customer }).click();
    await dialog.getByRole('button', { name: `Create ${type}` }).click();
    await expect(page).toHaveURL(/\/en\/documents\/[0-9a-z]{26}$/);
    return page.url().split('/').pop()!;
}

/** Autosave waits 600 ms after the last change; then the status reads "Saved" again. */
export async function settle(page: Page): Promise<void> {
    await page.waitForTimeout(700);
    await expect(page.getByTestId('save-status')).toHaveText('Saved', { timeout: 10_000 });
}

/** Fills row `index` of a group (or of the page) with title, quantity and unit price. */
export async function fillRow(scope: Locator, index: number, title: string, quantity: string, price: string): Promise<void> {
    const row = scope.locator('[data-position-row]').nth(index);
    const name = row.getByRole('combobox', { name: 'Item' });
    await name.fill(title);
    await name.press('Escape'); // close the suggestions of earlier documents
    await row.getByRole('textbox', { name: 'Quantity' }).fill(quantity);
    const price_ = row.getByRole('textbox', { name: 'Unit price' });
    await price_.fill(price);
    await price_.press('Tab');
}

export async function finalize(page: Page, type: string): Promise<void> {
    await page.getByRole('button', { name: 'Finalize', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: `Finalize ${type}?` });
    await dialog.getByRole('button', { name: 'Finalize' }).click();
    await expect(dialog).toBeHidden();
}

/** Today in the time zone of the browser (playwright.config: Europe/Berlin) as YYYY-MM-DD. */
export const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
```

- [ ] **Step 2: Hauptablauf schreiben**

`e2e/tests/editor.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { finalize, fillRow, heading, newDocument, settle, today } from './editor-helpers';
import { apiGet, login } from './helpers';

type Doc = { gross_total: string; net_total: string; status: string; number: string | null; groups: { title: string | null }[] };

test('quote with groups → finalize → accepted → invoice → check green → finalize → PDF → paid → cancellation', async ({ page }) => {
    test.setTimeout(180_000);
    await login(page);

    // 1. quote for Hafenkontor Lindqvist with two groups
    const quoteId = await newDocument(page, 'Quote', /Hafenkontor Lindqvist/);
    await expect(heading(page)).toHaveAccessibleName('Quote (draft)');

    await page.getByRole('button', { name: 'Add group' }).click();
    await expect(page.getByRole('textbox', { name: 'Group name' }).last()).toBeFocused();
    await page.keyboard.type('Konzept');
    const konzept = page.getByRole('group', { name: 'Konzept' });
    await fillRow(konzept, 0, 'Workshop', '2', '450');
    await konzept.getByRole('button', { name: 'Add position' }).click();
    await fillRow(konzept, 1, 'Konzeptpapier', '1', '800');

    await page.getByRole('button', { name: 'Add group' }).click();
    await expect(page.getByRole('textbox', { name: 'Group name' }).last()).toBeFocused();
    await page.keyboard.type('Umsetzung');
    await fillRow(page.getByRole('group', { name: 'Umsetzung' }), 0, 'Umsetzung Website', '1', '3200');
    await settle(page);

    // totals come from the server: 2 × 450 + 800 + 3200 = 4900 net, 19 % VAT
    const totals = page.getByRole('group', { name: 'Totals' });
    await expect(totals).toContainText('€4,900.00');
    await expect(totals).toContainText('€5,831.00');
    expect(((await apiGet(page, `/api/documents/${quoteId}`)) as Doc).gross_total).toBe('5831.00');

    // 2. move "Umsetzung" above "Konzept" with the keyboard (dnd-kit: Space, arrow, Space)
    await page.getByRole('button', { name: 'Move group “Umsetzung”' }).focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Space');
    await settle(page);
    expect(((await apiGet(page, `/api/documents/${quoteId}`)) as Doc).groups.map((g) => g.title)).toEqual([null, 'Umsetzung', 'Konzept']);

    // 3. finalize the quote: number from the server, read-only afterwards
    await page.getByRole('button', { name: 'Finalize', exact: true }).click();
    const confirm = page.getByRole('dialog', { name: 'Finalize Quote?' });
    await expect(confirm).toContainText(/AN-\d{4}-\d{4}/);
    await confirm.getByRole('button', { name: 'Finalize' }).click();
    await expect(heading(page)).toHaveAccessibleName(/^Quote AN-\d{4}-\d{4}$/);
    await expect(page.getByText(/Finalized on/)).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Item' }).first()).toBeDisabled();

    // 4. accepted, then convert into an invoice
    await page.getByRole('button', { name: 'Change status' }).click();
    await page.getByRole('menuitem', { name: 'Mark as accepted' }).click();
    await expect(page.locator('.ed-head').getByText('Accepted', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Convert' }).click();
    await page.getByRole('menuitem', { name: 'To Invoice' }).click();
    await expect(heading(page)).toHaveAccessibleName('Invoice (draft)');
    const invoiceId = page.url().split('/').pop()!;
    expect(invoiceId).not.toBe(quoteId);
    await expect(page.getByRole('navigation', { name: 'Document chain' }).getByRole('link')).toHaveCount(2);

    // 5. make the check green: an empty service date is an issue, the issue jumps to the field
    const check = page.locator('#check-panel');
    const serviceDate = page.getByLabel('Service from');
    await serviceDate.fill('');
    await expect(check).toContainText('Service date is missing.');
    await check.getByRole('button', { name: /Service date is missing/ }).click();
    await expect(serviceDate).toBeFocused();
    await serviceDate.fill(today());
    await expect(check).toContainText('Ready to finalize');
    await settle(page);

    // 6. finalize the invoice (PDF/A-3 with XML in the archive), open the PDF, look at the e-invoice
    await finalize(page, 'Invoice');
    await expect(heading(page)).toHaveAccessibleName(/^Invoice RE-\d{4}-\d{4}$/);

    const popup = page.context().waitForEvent('page');
    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Download PDF' }).click();
    const pdfPage = await popup;
    expect(pdfPage.url()).toContain(`/api/documents/${invoiceId}/pdf`);
    await pdfPage.close();
    const pdf = await page.request.get(`/api/documents/${invoiceId}/pdf`, { headers: { Referer: page.url() } });
    expect(pdf.headers()['content-type']).toContain('application/pdf');

    await page.getByRole('tab', { name: 'E-invoice' }).click();
    await expect(page.locator('pre')).toContainText('CrossIndustryInvoice');
    await page.getByRole('tab', { name: 'Preview' }).click();

    // 7. paid
    await page.getByRole('button', { name: 'Change status' }).click();
    await page.getByRole('menuitem', { name: 'Mark as paid' }).click();
    await expect(page.locator('.ed-head').getByText('Paid', { exact: true })).toBeVisible();

    // 8. cancellation: draft from the invoice, finalize, the invoice becomes cancelled
    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Cancel invoice' }).click();
    await page.getByRole('dialog', { name: /^Cancel RE-/ }).getByRole('button', { name: 'Create cancellation' }).click();
    await expect(heading(page)).toHaveAccessibleName('Cancellation (draft)');
    await expect(page.locator('#check-panel')).toContainText('Ready to finalize');
    await finalize(page, 'Cancellation');
    await expect(heading(page)).toHaveAccessibleName(/^Cancellation ST-\d{4}-\d{4}$/);

    const chain = page.getByRole('navigation', { name: 'Document chain' });
    await expect(chain.getByRole('link')).toHaveCount(3);
    await chain.getByRole('link', { name: /Invoice RE-/ }).click();
    await expect(page.locator('.ed-head').getByText('Cancelled', { exact: true })).toBeVisible();
    await expect(page.getByText(/Cancelled by/)).toBeVisible();
    expect(((await apiGet(page, `/api/documents/${invoiceId}`)) as Doc).status).toBe('cancelled');
});
```

- [ ] **Step 3: Gegen DDEV laufen lassen**

Voraussetzung: `ddev start`, Assets vorhanden (`ddev exec pnpm build` oder laufender `ddev exec pnpm dev`), Playwright auf dem Mac installiert (`pnpm --dir e2e install && pnpm --dir e2e exec playwright install chromium`).

Run: `pnpm --dir e2e test -- editor.spec.ts`
Expected: `1 passed`. Falls rot, gezielt prüfen – nie den Ablauf aufweichen:
- Tastatur-Drag greift nicht: dnd-kit braucht nach `Space` einen Frame; zwischen den drei Tasten `await page.waitForTimeout(150);` einfügen.
- Prüfanzeige zeigt nach dem Datum weitere Punkte: Demo-Daten (`database/seeders/DemoSeeder.php`: Organisation mit USt-ID/IBAN/Adresse, Kunde mit Adresse, Einheiten mit Code) und Regeln (`ComplianceChecker`) prüfen; ein fehlendes Datum in den Demo-Daten ist ein Fehler im Seeder, nicht im Test.
- Nummernformat weicht ab: Muster in `DemoSeeder` (`AN-{YYYY}-{0000}`, `RE-{YYYY}-{0000}`, `ST-{YYYY}-{0000}`) nachsehen und die Regex anpassen.
- `toHaveAccessibleName` am `h1`: das `aria-label` aus `EditorHeader` ist maßgeblich.

Run: `pnpm --dir e2e test`
Expected: alle Specs grün (bei 429 am Login eine Minute warten, siehe CLAUDE.md „Fallstricke“).

- [ ] **Step 4: Commit**

```bash
git add e2e/tests/helpers.ts e2e/tests/editor-helpers.ts e2e/tests/editor.spec.ts
git commit -m "test(e2e): main flow quote to cancellation in the document editor" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 14: Playwright – Randfälle aus dem Review Focus

**Files:**
- Create: `e2e/tests/editor-details.spec.ts`

**Interfaces:**
- Consumes: Helfer aus Task 13 (`newDocument`, `settle`, `fillRow`, `heading`, `apiGet`, `apiPost`, `login`).
- Produces: Tests für Review Focus 1–5 im Browser.

- [ ] **Step 1: Tests schreiben**

`e2e/tests/editor-details.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { fillRow, heading, newDocument, settle } from './editor-helpers';
import { apiGet, apiPost, login } from './helpers';

type Doc = { intro: string; gross_total: string; groups: { positions: { title: string; quantity: string }[] }[] };

test.beforeEach(async ({ page }) => {
    await login(page);
});

test('keeps typing during a save and new positions across a reload, without duplicates (review focus 1)', async ({ page }) => {
    const id = await newDocument(page, 'Invoice', /Hotel Alpenglück/);
    const loose = page.getByRole('group', { name: 'Loose positions' });

    await loose.getByRole('button', { name: 'Add position' }).click();
    const first = loose.locator('[data-position-row]').nth(0).getByRole('combobox', { name: 'Item' });
    await first.pressSequentially('Zimmer');
    await page.waitForTimeout(650); // the first save (new position with a local id) is on its way …
    await first.pressSequentially('reinigung'); // … while typing goes on in the same field
    await expect(first).toBeFocused();
    await first.press('Escape');

    await loose.getByRole('button', { name: 'Add position' }).click();
    await loose.locator('[data-position-row]').nth(1).getByRole('combobox', { name: 'Item' }).pressSequentially('Wäscheservice');
    await settle(page);

    await page.reload();
    const rows = page.getByRole('group', { name: 'Loose positions' }).locator('[data-position-row]');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0).getByRole('combobox', { name: 'Item' })).toHaveValue('Zimmerreinigung');
    await expect(rows.nth(1).getByRole('combobox', { name: 'Item' })).toHaveValue('Wäscheservice');
    const saved = (await apiGet(page, `/api/documents/${id}`)) as Doc;
    expect(saved.groups.flatMap((g) => g.positions.map((p) => p.title))).toEqual(['Zimmerreinigung', 'Wäscheservice']);
});

test('saves before leaving the page (review focus 5)', async ({ page }) => {
    const id = await newDocument(page, 'Quote', /Kulturwerk Elbinsel/);

    await page.getByLabel('Introduction').fill('Hallo Jana, wie besprochen:');
    await page.getByRole('link', { name: 'Documents', exact: true }).first().click();
    await expect(page).toHaveURL(/\/en\/documents$/);

    await expect.poll(async () => ((await apiGet(page, `/api/documents/${id}`)) as Doc).intro).toBe('Hallo Jana, wie besprochen:');
});

test('stops saving and turns read-only when the document is finalized elsewhere (review focus 2)', async ({ page }) => {
    const id = await newDocument(page, 'Quote', /Hafenkontor Lindqvist/);
    const loose = page.getByRole('group', { name: 'Loose positions' });
    await loose.getByRole('button', { name: 'Add position' }).click();
    await fillRow(loose, 0, 'Beratung', '1', '100');
    await settle(page);

    // another client (API token, MCP, second tab) finalizes the draft
    await apiPost(page, `/api/documents/${id}/finalize`);
    await page.getByLabel('Introduction').fill('Noch eine Änderung');

    await expect(page.getByText(/This document was finalized elsewhere/)).toBeVisible();
    await expect(page.getByLabel('Introduction')).toBeDisabled();
    await expect(heading(page)).toHaveAccessibleName(/^Quote AN-\d{4}-\d{4}$/);
    expect(((await apiGet(page, `/api/documents/${id}`)) as Doc).intro).not.toBe('Noch eine Änderung');
});

test('shows the totals of the server after fast typing (review focus 3)', async ({ page }) => {
    const id = await newDocument(page, 'Invoice', /Hafenkontor Lindqvist/);
    const loose = page.getByRole('group', { name: 'Loose positions' });
    await loose.getByRole('button', { name: 'Add position' }).click();
    const row = loose.locator('[data-position-row]').nth(0);
    await row.getByRole('combobox', { name: 'Item' }).fill('Workshop');
    await row.getByRole('combobox', { name: 'Item' }).press('Escape');

    const price = row.getByRole('textbox', { name: 'Unit price' });
    await price.pressSequentially('1234,5', { delay: 40 }); // six renders requested, older ones are aborted
    await price.press('Tab');
    await settle(page);

    // 1234.50 + 19 % (234.555 → 234.56) = 1469.06
    expect(((await apiGet(page, `/api/documents/${id}`)) as Doc).gross_total).toBe('1469.06');
    await expect(page.getByRole('group', { name: 'Totals' })).toContainText('€1,469.06');
    await expect(row.getByLabel('Total of the position')).toHaveText('€1,234.50');
});

test('marks an invalid number and never sends it (review focus 4)', async ({ page }) => {
    const id = await newDocument(page, 'Quote', /Hafenkontor Lindqvist/);
    const bodies: string[] = [];
    page.on('request', (request) => {
        if (request.method() === 'PATCH' && request.url().endsWith(`/api/documents/${id}`)) bodies.push(request.postData() ?? '');
    });

    const loose = page.getByRole('group', { name: 'Loose positions' });
    await loose.getByRole('button', { name: 'Add position' }).click();
    const row = loose.locator('[data-position-row]').nth(0);
    await row.getByRole('combobox', { name: 'Item' }).fill('Beratung');
    const quantity = row.getByRole('textbox', { name: 'Quantity' });

    await quantity.fill('abc');
    await quantity.press('Tab');
    await expect(quantity).toHaveAttribute('aria-invalid', 'true');
    await expect(quantity).toHaveAttribute('title', /Enter a number/);
    await settle(page);
    expect(bodies.some((body) => body.includes('abc'))).toBe(false);

    await quantity.fill('1,5');
    await quantity.press('Tab');
    await expect(quantity).not.toHaveAttribute('aria-invalid', 'true');
    await settle(page);
    const saved = (await apiGet(page, `/api/documents/${id}`)) as Doc;
    expect(Number(saved.groups.flatMap((g) => g.positions)[0].quantity)).toBe(1.5);
});

test('deletes a draft with undo, and for good once the toast is gone (review focus 5)', async ({ page }) => {
    const id = await newDocument(page, 'Quote', /Hafenkontor Lindqvist/);

    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Delete draft' }).click();
    await expect(page).toHaveURL(/\/en\/documents$/);
    await expect(page.locator(`main a[href="/en/documents/${id}"]`)).toHaveCount(0);
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page).toHaveURL(new RegExp(`/en/documents/${id}$`));
    await expect(heading(page)).toHaveAccessibleName('Quote (draft)');

    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Delete draft' }).click();
    await expect(page).toHaveURL(/\/en\/documents$/);
    await page.mouse.move(0, 0); // a pointer on the toast would pause it
    await expect(page.getByText('Draft deleted')).toBeHidden({ timeout: 10_000 });
    await expect
        .poll(async () => (await page.request.get(`/api/documents/${id}`, { headers: { Accept: 'application/json', Referer: page.url() } })).status())
        .toBe(404);
});
```

- [ ] **Step 2: Laufen lassen**

Run: `pnpm --dir e2e test -- editor-details.spec.ts`
Expected: `6 passed`. Falls „keeps typing during a save“ rot ist, weil der Fokus nach dem Save verloren geht: Die Zeilen müssen mit `keyOf(id)` (Store `aliases`, Task 7/10) als React-Key gerendert werden – nicht mit `position.id`. Das ist der Kern von Review Focus 1, nicht den Test ändern.

Run: `pnpm --dir e2e test`
Expected: alle Specs grün.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/editor-details.spec.ts
git commit -m "test(e2e): autosave races, conflicts, stale previews, invalid numbers and delete with undo" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 15: Doku (en/de) und CLAUDE.md

**Files:**
- Modify: `docs/en/documents.md`, `docs/de/documents.md`, `docs/en/development.md`, `docs/de/development.md`, `CLAUDE.md`
- Test: `tests/Unit/DocsTest.php` (vorhanden), `ddev exec pnpm --dir docs build`

**Interfaces:**
- Consumes: Verhalten aus Task 1–14.
- Produces: Nutzer- und Entwicklerdoku des Editors; aktueller Stand in CLAUDE.md.

- [ ] **Step 1: `docs/en/documents.md`**

Im Abschnitt `### New document` den letzten Satz („Editing documents in the app comes with the document editor; until then a document's page shows its key data and its PDF.“) ersetzen durch „The new draft opens in the document editor.“ und danach (vor `### Customers`) einfügen:

```markdown
### Document editor

Every document opens in the editor: the form on the left, a live preview on the right (below the form on narrow screens). The preview shows the pages exactly as the PDF will look – openbill renders header, content and footer on the server with the document's template and only splits them into pages in the browser. **Areas** outlines header, content and footer on every page. The preview can be hidden and shown again; the choice is remembered in this browser.

- **Header fields:** customer, contact (the customer's default contact is preselected), date, valid until (quotes), service period (invoices and cancellations), due date (invoices), document language and template, plus the document's custom fields. A cancellation always keeps the customer of its invoice.
- **Positions:** organize positions in groups, each with its subtotal. Drag groups and positions by their handle – also with the keyboard: focus the handle, press Space, move with the arrow keys, press Space again. A position is a service, a text line or, in quotes, an optional service that is shown but not added to the total. While you type a title, openbill suggests positions from earlier documents with their price, unit and tax rate. Numbers can be typed with a comma or a dot (`12,5` or `12.5`); invalid input is marked and not saved. Removing a group or a position can be undone from the message that appears.
- **Texts:** introduction and closing text, typed or inserted from text blocks.
- **Totals and check:** net, VAT per rate, total, optional positions and legal notes come from the server, as do the line and group totals. The check panel lists what the document's compliance profile still requires; click an entry to jump to the field. Entries about the customer link to the customer; entries about your organization name the organization settings.
- **Saving:** changes are saved automatically shortly after you stop typing; the header shows *Unsaved*, *Saving …* and *Saved*. Leaving the page or closing the tab saves first. If saving fails because of the connection, openbill tries again on its own (or right away with **Try again**); invalid input is marked at its field. If the document was finalized or deleted elsewhere in the meantime (another tab, the API or MCP), the editor stops saving and says so. Two people editing the same draft at the same time overwrite each other's changes – the last save wins.
- **Actions:** **Finalize** asks for confirmation and names the number the document will get; with missing required details it jumps to the first one instead. Finalized documents are read-only. Depending on the status you can change it (for example *Mark as accepted*, *Mark as paid*), convert a document along the chain, cancel an invoice, duplicate a document, download the PDF (drafts with a watermark) and delete a draft – with **Undo** while the message is visible.
- **Chain and e-invoice:** above the form, the chain links the quote, order confirmation, invoice and cancellation that belong together. With the e-invoice profile, the tab **E-invoice** shows the XML of a finalized invoice or cancellation (copy or download); for drafts it explains that the XML is created when finalizing.
```

- [ ] **Step 2: `docs/de/documents.md`**

Den entsprechenden Satz im Abschnitt „Neues Dokument“ (deutsche Fassung: „Dokumente bearbeiten kommt mit dem Dokument-Editor; …“ – Satz mit `grep -n "Editor" docs/de/documents.md` finden) ersetzen durch „Der neue Entwurf öffnet sich im Dokument-Editor.“ und vor dem Abschnitt „Kunden“ einfügen:

```markdown
### Dokument-Editor

Jedes Dokument öffnet sich im Editor: links das Formular, rechts eine Live-Vorschau (auf schmalen Bildschirmen unter dem Formular). Die Vorschau zeigt die Seiten genau so, wie das PDF aussehen wird – openbill rendert Kopfzeile, Inhalt und Fußzeile auf dem Server mit dem Template des Dokuments und teilt sie im Browser nur in Seiten auf. **Bereiche** umrandet Kopfzeile, Inhalt und Fußzeile auf jeder Seite. Die Vorschau lässt sich aus- und wieder einblenden; die Wahl merkt sich dieser Browser.

- **Kopfdaten:** Kunde, Ansprechpartner (der Standard-Ansprechpartner des Kunden ist vorausgewählt), Datum, Gültig bis (Angebote), Leistungszeitraum (Rechnungen und Stornos), Fälligkeit (Rechnungen), Dokumentsprache und Template, dazu die eigenen Felder des Dokuments. Ein Storno behält immer den Kunden seiner Rechnung.
- **Positionen:** Positionen lassen sich in Gruppen ordnen, jede mit Zwischensumme. Gruppen und Positionen ziehst du am Griff – auch per Tastatur: Griff fokussieren, Leertaste, mit den Pfeiltasten bewegen, Leertaste. Eine Position ist eine Leistung, eine Textzeile oder in Angeboten eine optionale Leistung, die angezeigt, aber nicht mitgerechnet wird. Beim Tippen der Bezeichnung schlägt openbill Positionen aus früheren Dokumenten mit Preis, Einheit und Steuersatz vor. Zahlen gehen mit Komma oder Punkt (`12,5` oder `12.5`); ungültige Eingaben werden markiert und nicht gespeichert. Das Entfernen einer Gruppe oder Position lässt sich in der eingeblendeten Meldung rückgängig machen.
- **Texte:** Einleitung und Schlusstext, frei getippt oder aus Textbausteinen eingefügt.
- **Summen und Prüfung:** Netto, Umsatzsteuer je Satz, Gesamt, optionale Positionen und rechtliche Hinweise kommen vom Server, ebenso die Zeilen- und Gruppensummen. Die Prüfanzeige listet, was das Prüfprofil des Dokuments noch verlangt; ein Klick springt ins Feld. Punkte zum Kunden verlinken auf den Kunden, Punkte zur eigenen Organisation nennen die Einstellungen der Organisation.
- **Speichern:** Änderungen speichert openbill kurz nach dem letzten Tastendruck von selbst; der Kopf zeigt *Ungespeichert*, *Speichert …* und *Gespeichert*. Beim Verlassen der Seite oder Schließen des Tabs wird vorher gespeichert. Scheitert das Speichern an der Verbindung, versucht openbill es selbst erneut (oder sofort mit **Erneut versuchen**); ungültige Eingaben werden am Feld markiert. Wurde das Dokument inzwischen woanders abgeschlossen oder gelöscht (anderer Tab, API oder MCP), hört der Editor auf zu speichern und sagt das. Bearbeiten zwei Personen gleichzeitig denselben Entwurf, überschreiben sie sich gegenseitig – der letzte Stand gewinnt.
- **Aktionen:** **Abschließen** fragt nach und nennt die Nummer, die das Dokument bekommt; fehlen noch Pflichtangaben, springt es stattdessen zur ersten. Abgeschlossene Dokumente sind schreibgeschützt. Je nach Status kannst du ihn ändern (z. B. *Als angenommen markieren*, *Als bezahlt markieren*), ein Dokument entlang der Kette umwandeln, eine Rechnung stornieren, ein Dokument duplizieren, das PDF herunterladen (Entwürfe mit Wasserzeichen) und einen Entwurf löschen – mit **Rückgängig**, solange die Meldung zu sehen ist.
- **Kette und E-Rechnung:** Über dem Formular verbindet die Kette Angebot, Auftragsbestätigung, Rechnung und Storno, die zusammengehören. Mit dem E-Rechnungs-Profil zeigt der Tab **E-Rechnung** die XML einer abgeschlossenen Rechnung oder eines Stornos (kopieren oder herunterladen); bei Entwürfen erklärt er, dass die XML beim Abschließen entsteht.
```

- [ ] **Step 3: Entwicklerdoku**

In `docs/en/development.md` im Block „Everyday commands“ nach der Vitest-Zeile ergänzen:

```bash
ddev exec 'pnpm --filter "./packages/*" test'          # workspace packages (paged-preview)
pnpm --dir e2e test                                    # Playwright on the Mac against DDEV (incl. the editor flow)
```

und nach dem Absatz unter dem Block:

```markdown
`packages/paged-preview` splits the server-rendered parts of a document into pages. The app, the template editor and the template toolkit use it; it has no dependency on the app (no Tailwind, texts come in as props).
```

In `docs/de/development.md` an denselben Stellen:

```bash
ddev exec 'pnpm --filter "./packages/*" test'          # Workspace-Pakete (paged-preview)
pnpm --dir e2e test                                    # Playwright auf dem Mac gegen DDEV (inkl. Editor-Ablauf)
```

```markdown
`packages/paged-preview` teilt die serverseitig gerenderten Teile eines Dokuments in Seiten auf. App, Template-Editor und Template-Toolkit nutzen das Paket; es hängt nicht von der App ab (kein Tailwind, Texte kommen als Props).
```

Falls die vorhandenen Abschnitte in `docs/de/development.md` anders heißen, die Zeilen in den deutschen Befehlsblock bzw. hinter den Absatz zu `ddev exec` setzen (`grep -n "pnpm test" docs/de/development.md`).

- [ ] **Step 4: CLAUDE.md**

1. „Was openbill ist“, letzter Satz: `Stand: Phase 5 (…; Dokument-Editor folgt in Phase 6, kein MCP)` ersetzen durch `Stand: Phase 6 (UI mit Shell, Übersicht, Dokumentliste, Kunden und Dokument-Editor; REST-API unter /api; kein MCP).`
2. „Tech Stack“, UI-Zeile ergänzen: `, Zustand 5 (nur Editor-Store), @dnd-kit (core/sortable/utilities, Gruppen und Positionen), Workspace-Paket packages/paged-preview (Seitenumbruch der Vorschau, ohne Tailwind)`. Test-Zeile: `Vitest (resources/js/**/*.test.ts, Umgebung node; Pakete eigene Vitest-Konfiguration)`.
3. „Kommandos“ nach `ddev exec pnpm test`:

```bash
ddev exec 'pnpm --filter "./packages/*" test'   # Workspace-Pakete (paged-preview)
```

4. „Architektur (Stand Phase 5)“ → „(Stand Phase 6)“; in der Routen-Zeile `GET /{locale}/documents/{id}` (Platzhalter bis Phase 6) ersetzen durch `GET /{locale}/documents/{id}` = Dokument-Editor (`DocumentController@show`, Props `document_id` + `context` aus `App\Actions\DescribeDocumentPage`). Neuen Punkt anfügen:

```markdown
- **Dokument-Editor** (`resources/js/editor`, Seite `pages/documents/show.tsx`, Komponente keyed by id): Entwurf im Zustand-Store `useEditor` (`store.ts`), Änderungen nur über reine Funktionen in `ops.ts`. Autosave (`autosave.ts`, Hook `use-autosave.ts`) = SWR-Mutation `PATCH /api/documents/{id}`, 600 ms, ein Save gleichzeitig, 422 → Feldfehler, 409 `document_locked`/404 → Stopp + Hinweis, sonst Retry 2/5/15/30 s; Verlassen speichert (`router.on('before')`, Unmount, `pagehide` mit `keepalive`). Neue Gruppen/Positionen haben lokale IDs `local-…`, nach dem Save `reconcileIds()` per Index; React-Keys über `aliases` stabil. Vorschau (`use-preview.ts`) = SWR `POST /api/render` mit `document_id` + `draft`, 250 ms, `createLatest` bricht ältere Anfragen ab; **Summen, Zeilen-/Gruppensummen und Issues kommen aus dieser Antwort** (DraftOverlay behält lokale IDs). Seitenkontext (Profil, Nummernvorschau, erlaubte Statuswechsel/Umwandlungen, Kette `App\Support\DocumentChain`, Kleinunternehmer, Templates) als Inertia-Prop, nach Aktionen `router.reload({ only: ['context'] })`. `data-path`-Konvention: `document.<feld>`, `document.custom.<key>`, `groups.<id>.title`, `positions`, `positions.<id>.<feld>` (Issue-Pfade des Servers; `violationPath()` übersetzt API-Pfade). Löschen mit Undo: `lib/pending-delete.ts` (DELETE erst bei `onExpire` des Toasts, Liste blendet vorgemerkte IDs aus, `pagehide` schickt per `keepalive`).
- **packages/paged-preview**: `PagedPreview({ parts, paper, showGuides?, highlight?, maxPages?, maxHeight?, onPageCount?, labels? })`, `computePageBreaks`, `pageGeometry`, `toPx`; exportiert TS-Quellen (`workspace:*`), CSS mit Variablen `--pp-*` (App setzt sie in `resources/css/editor.css`). Schnittstelle für Phase 7/9: Phasenplan `docs/superpowers/plans/2026-10-11-phase-06-editor.md`, Abschnitt „Interfaces“.
```

5. „Fallstricke“ anfügen:

```markdown
- `tests/Unit/TranslationsTest.php` findet `t('…')`-Schlüssel nur bis drei Ordner unter `resources/js` (`editor/components/x.tsx` geht, tiefer nicht) und nur als Literal; dynamische Schlüssel (`t(\`document_type.${type}\`)`) prüft er nicht – die müssen trotzdem in beiden Dateien stehen.
- Editor-Zeilen nie mit `key={position.id}` rendern: Nach dem ersten Save tauscht `reconcileIds()` die lokale ID gegen die ULID, die Zeile würde neu gemountet und verlöre Fokus und Eingabe. `keyOf(id)` (Store `aliases`) benutzen.
- `PATCH /api/documents/{id}` schickt immer alle Felder (auch `contact_id`): `UpdateDraft` wählt den Standard-Ansprechpartner nur, wenn `contact_id` fehlt – beim Kundenwechsel wählt ihn deshalb der Editor.
- `fetch(…, { keepalive: true })` hat ein Body-Limit von 64 KB; sehr große Entwürfe (hunderte Positionen) gehen beim Schließen des Tabs nicht mehr raus (Navigation in der App speichert normal).
- Positionsraster, Sprung-Aufleuchten und Vorschau-Variablen stehen in `resources/css/editor.css` (Container-Queries mit `grid-template-areas`), nicht als Tailwind-Klassen.
```

- [ ] **Step 5: Prüfen**

Run: `ddev artisan test --filter='DocsTest|TranslationsTest' && ddev exec pnpm --dir docs build`
Expected: PASS; VitePress-Build ohne Fehler (keine `{{ … }}` außerhalb von `::: v-pre` – die Doku oben enthält keine).

- [ ] **Step 6: Commit**

```bash
git add docs/en/documents.md docs/de/documents.md docs/en/development.md docs/de/development.md CLAUDE.md
git commit -m "docs: document editor (en, de) and CLAUDE.md for phase 6" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 16: Screenshots, Gesamtprüfung, Push und Pull Request

**Files:**
- Modify: `e2e/tests/screenshots.spec.ts`

**Interfaces:**
- Consumes: alles Vorherige.
- Produces: Review-Screenshots `e2e/screenshots/{app,clickdummy}/editor-{1440,390}-{light,dark}.png` (git-ignoriert), Branch auf GitHub, PR gegen `main`, grüne CI.

- [ ] **Step 1: Editor in die Screenshots aufnehmen**

In `e2e/tests/screenshots.spec.ts` dem Array `SHOTS` anfügen:

```ts
    {
        name: 'editor',
        open: async (page, prefix) => {
            await go(page, prefix, '/documents');
            await page.getByRole('link', { name: /Hafenkontor Lindqvist GmbH/ }).first().click();
            await page.waitForURL(/\/documents\/[^/?]+$/);
            // the preview is ready when the first page of paged-preview is laid out
            await page.locator('.pp-page').first().waitFor();
        },
    },
```

- [ ] **Step 2: Screenshots erzeugen und vergleichen**

Klickdummy bauen und auf dem Mac ausliefern (wie in Phase 5, Plan `…-phase-05-ui-base.md`, letzter Task), dann Screenshots erzeugen:

```bash
ddev exec 'pnpm --filter openbill-clickdummy-v2 build'
ddev mutagen sync
pnpm dlx serve -s prototypes/clickdummy-v2/dist -l 4173   # im Hintergrund laufen lassen
CLICKDUMMY_URL=http://localhost:4173 pnpm --dir e2e screenshots
ls e2e/screenshots/app e2e/screenshots/clickdummy | wc -l
git status --short
```

Expected: `serve` meldet `Serving! … http://localhost:4173`, Playwright `8 passed` (4 Kombinationen × app/clickdummy), je Verzeichnis 28 PNGs (7 Seiten × 2 Breiten × 2 Themes), darunter `editor-1440-light.png`, `editor-1440-dark.png`, `editor-390-light.png`, `editor-390-dark.png`; `git status` ohne `dist/` und ohne Screenshots. Danach den `serve`-Prozess beenden.

Die acht Editor-Bilder paarweise ansehen (Read-Tool auf die PNGs). Prüfen und Abweichungen beheben, bevor es weitergeht:
- 1440: Formular links, Vorschau rechts (sticky), Kopf mit Status und Aktionen, Gruppen als getönte Blöcke, Summenkasten rechtsbündig, Prüfanzeige.
- 390: Kopf nicht sticky, Felder einspaltig, Positionszeilen gestapelt, Vorschau unter dem Formular, keine horizontale Scrollleiste.
- Dunkel: Papier bleibt weiß, Gruppen/Summen in `bg`-Ton, keine hellen Ränder.
Bewusste Unterschiede (keine Behebung): kein Projektname im Untertitel (App kennt kein festes Projektfeld), kein „erwartete Felder“-Hinweis am Template, Org-Punkte der Prüfanzeige ohne Link, E-Rechnungs-Tab bei Entwürfen nur mit Hinweis.

- [ ] **Step 3: Gesamtprüfung**

Run:

```bash
ddev exec vendor/bin/pint --test
ddev exec vendor/bin/phpstan analyse --memory-limit=1G
ddev artisan test
ddev exec pnpm typecheck
ddev exec pnpm test
ddev exec 'pnpm --filter "./packages/*" run typecheck'
ddev exec 'pnpm --filter "./packages/*" run test'
ddev exec pnpm build
ddev exec 'pnpm --filter "./prototypes/*" test'
ddev exec pnpm --dir docs build
pnpm --dir e2e test
```

Expected: alles grün (Pint ohne Änderungen, Larastan `[OK] No errors`, Pest alle Suiten, Vitest App und Paket, Build, Prototypen, Doku, Playwright alle Specs).

Abnahme Phase 6 gegenprüfen – „keine Rechenlogik im Frontend“:

Run: `grep -rnE "parseFloat|Number\(|\* ?[0-9]|\.toFixed\(" resources/js/editor resources/js/pages/documents packages/paged-preview/src | grep -v "\.test\." `
Expected: Treffer nur in `packages/paged-preview/src/geometry.ts`/`paged-preview.tsx` (Pixel-Geometrie, Skalierung) und `resources/js/editor/paths.ts` (Array-Index aus dem API-Pfad), dazu ggf. Kommentarzeilen. Jeden Treffer ansehen: Beträge, Mengen oder Steuern werden nirgends gerechnet; ein solcher Treffer wird entfernt.

- [ ] **Step 4: Push und PR**

Run: `git status --short && git log --oneline main..HEAD`
Expected: sauberer Arbeitsbaum; Commits dieser Phase (Plan-Commit + Task 1–15).

Run: `git push -u origin phase-06-editor`

```bash
gh pr create --base main --head phase-06-editor --title "feat: phase 6 document editor" --body "$(cat <<'EOF'
## Summary
- `packages/paged-preview`: workspace package (TS + React, own CSS, no Tailwind) that splits the server-rendered header/body/footer into pages in script-less iframes; Vitest for page geometry and breaks; used by the editor, later by the template editor (phase 7) and the toolkit (phase 9)
- Document editor at `/{locale}/documents/{id}`: Zustand draft store with pure operations, autosave as SWR mutation on `PATCH /api/documents/{id}` (600 ms, one save at a time, retries, 422/409/404 handling, saving on leave incl. keepalive), live preview via SWR `POST /api/render` (250 ms, older requests aborted)
- Totals, line and group sums and the compliance result come only from the server; check panel jumps to the field (`data-path` ↔ issue path)
- Header and custom fields, groups and positions with @dnd-kit (mouse and keyboard), suggestions from earlier positions, text blocks
- Actions: finalize with confirmation and number preview, status, convert, cancel, duplicate, delete with undo, PDF/XML; chain, e-invoice tab, read-only for finalized documents
- Page context (`App\Actions\DescribeDocumentPage`, `App\Support\DocumentChain`) as Inertia props
- Docs `documents` (editor) and `development` in en/de, CLAUDE.md

## Test plan
- [x] Pest: `DescribeDocumentPageTest`, `DocumentChainTest`, `DocumentPagesTest` (Inertia props), full suite
- [x] Vitest: draft operations, store, autosave, decimal input, field paths, latest-only requests, toast `onExpire`, delayed delete; `packages/paged-preview` geometry and component
- [x] Playwright against DDEV: quote → groups/positions → finalize → accepted → invoice → check green → finalize → PDF → paid → cancellation; autosave races, conflict, fast typing, invalid numbers, delete with undo
- [x] Screenshots 1440/390 light/dark compared with the clickdummy editor

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: `gh` gibt die PR-URL aus.

- [ ] **Step 5: CI abwarten (nicht mergen)**

Run: `gh pr checks --watch`
Expected: `tests` (Pflicht) grün, ebenso die übrigen Jobs (`einvoice` ist kein Pflicht-Check). Schlägt etwas fehl: Log mit `gh run view --log-failed` lesen, beheben, committen (Co-Authored-By-Zeile), pushen, erneut `gh pr checks --watch`. **Nicht mergen** – das macht der Orchestrator nach dem Review.
