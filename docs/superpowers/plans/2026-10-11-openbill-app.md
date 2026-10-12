# openbill App Implementation Plan (Master)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die echte openbill-App nach der Spec bauen: selbst hostbar per Docker Compose, mit REST-API, MCP, Template-Toolkit und VitePress-Doku.

**Architecture:** Laravel 13 im Repo-Root mit Inertia/React-UI. Geschäftsabläufe ausschließlich in `app/Actions`, Rechenlogik in `app/Domain`, Rendering nur serverseitig (keepsuit/liquid → Gotenberg). UI, REST (API Platform) und MCP (laravel/mcp) sind dünne Schichten über denselben Actions.

**Tech Stack:** PHP 8.4, Laravel 13, MariaDB 11.4, Inertia v3, React 19, TypeScript, Tailwind 4, Vite, Zustand, SWR, @dnd-kit, CodeMirror 6, keepsuit/liquid, gotenberg/gotenberg-php, horstoeko/zugferd, brick/math, API Platform for Laravel, laravel/mcp, Sanctum, Pest, Larastan, Pint, Vitest, Playwright, VitePress, DDEV, Docker (serversideup/php).

**Spec:** `docs/superpowers/specs/2026-10-11-openbill-app-design.md` (dazu Fachkonzept Abschnitt 2 in `docs/superpowers/specs/2026-10-04-openbill-clickdummy-design.md` und `prototypes/clickdummy-v2/DESIGN.md`).

## Wie dieser Plan ausgeführt wird

Dieser Master-Plan legt Phasen, Schnittstellen und Abnahme fest. **Je Phase** läuft:

1. **Planungs-Agent** schreibt `docs/superpowers/plans/2026-10-11-phase-NN-<name>.md` im Format von superpowers:writing-plans (bite-sized Tasks, TDD, echte Code-Blöcke), gegen den aktuellen Stand von `main` und diesen Master-Plan.
2. **Umsetzungs-Agent** arbeitet den Phasenplan auf Branch `phase-NN-<name>` ab (TDD, häufige Commits), pusht und öffnet einen PR.
3. **Review-Agent** prüft den PR gegen Phasenplan, Spec und die Abnahmekriterien unten; Findings werden behoben.
4. Orchestrator merged nach grüner CI (`gh pr merge --squash --admin --delete-branch`), aktualisiert die Checkboxen hier und startet die nächste Phase.

## Global Constraints

- Git-Identität kommt aus `~/.gitconfig` (muss `rafael@hauss.dev` sein); nie `user.email` setzen. Commits enden mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, PR-Beschreibungen mit `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- PHP, Composer und Artisan nur in DDEV: `ddev composer …`, `ddev artisan …`, `ddev exec …`. Kein lokales PHP.
- JS-Pakete nur mit **pnpm** (nie npm/npx; Einmal-Tools `pnpm dlx`). pnpm-Workspace: Root, `packages/*`, `docs`.
- PHP 8.4, Laravel 13, MariaDB 11.4, Node 24.
- Keine Geschäftslogik in Controllern, API-Processors, MCP-Tools; nur in `app/Actions` (Abläufe) und `app/Domain` (Rechnen/Regeln).
- Beträge nie als `float`: `DECIMAL` in der DB, `Brick\Math\BigDecimal` in PHP, Strings im JSON.
- Primärschlüssel ULID (`HasUlids`).
- Abgeschlossene Dokumente (`finalized_at` gesetzt) sind unveränderlich außer `status`, `paid_at`, `cancelled_by_id`.
- Rendering nur serverseitig; der Browser macht nur den Seitenumbruch (`packages/paged-preview`).
- UI-Texte nur über Schlüssel in `lang/en.json` und `lang/de.json` (gleiche Schlüssel); Admin-URLs mit Sprachpräfix `/{locale}` (`en|de`). Code und Kommentare Englisch.
- Gestaltung nach `prototypes/clickdummy-v2/DESIGN.md` (Graphit & Kobalt), Tailwind-Tokens aus diesen Werten; keine shadcn-Defaults, Radix nur für Dialog/Menü/Popover.
- Doku: Jede Phase liefert ihre VitePress-Seiten in `docs/en/` **und** `docs/de/` im selben PR.
- Demo-Daten nur fiktiv (Studio Nordlicht, Hafenkontor Lindqvist, Fjord Analytics, Hotel Alpenglück, Kulturwerk Elbinsel). Keine echten Firmen, Hosts oder Personen (auch nicht die Arbeitgeber oder Kunden der Maintainer).
- CI: Pflicht-Check heißt `tests` und muss grün sein; weitere Jobs dürfen andere Namen haben.
- Englisches README, MIT-Lizenz (`Copyright (c) 2026 Rafael Haußmann`).
- `CLAUDE.md` im Repo wird in jeder Phase aktuell gehalten (Stack, Kommandos, Architektur, Fallstricke).

## Review Focus

- **Gleichzeitiges Abschließen:** Zwei Abschlüsse desselben Typs gleichzeitig dürfen nie dieselbe Nummer bekommen, ein fehlgeschlagener Abschluss (z. B. Gotenberg down) verbraucht keine Nummer und lässt das Dokument als Entwurf zurück. → Test in Phase 2 (Nummernvergabe mit Transaktion) und Phase 3 (Rollback bei Gotenberg-Fehler).
- **Kaputtes Template:** Liquid-Syntaxfehler, unbekannter Filter, Endlosschleife oder sehr großes Template liefern eine lesbare Fehlermeldung mit Bereich und Zeile statt 500 oder Hänger. → Tests in Phase 3 (Renderer-Limits) und Phase 4 (`POST /api/render` mit kaputtem Template).
- **Geänderte Stammdaten nach Abschluss:** Kunde, Steuersatz, Einheit, Template oder Felddefinition wird nach dem Abschließen geändert, archiviert oder gelöscht → abgeschlossenes Dokument und sein PDF bleiben unverändert. → Tests in Phase 2 (Snapshot) und Phase 3 (Download liefert Archivdatei).
- **Ungültige eigene Feldwerte über API/MCP:** falscher Typ, unbekannte Option, fehlendes Pflichtfeld, Feld gilt nicht für den Dokumenttyp → 422 mit Feldpfad, nichts wird gespeichert. → Tests in Phase 2 (Feldvalidierung) und Phase 4/8 (API/MCP).
- **Token-Rechte:** Ein Token mit nur `templates:render` kann keine Dokumente ändern oder abschließen; ein widerrufener Token bekommt 401; der Toolkit-Token kann nur sein eigenes Template schreiben. → Tests in Phase 4 und Phase 8/9.

---

## Phase 1: Fundament

**Branch:** `phase-01-foundation` · **Phasenplan:** `docs/superpowers/plans/2026-10-11-phase-01-foundation.md`

**Liefert:**
- `clickdummy/` → `prototypes/clickdummy/`, `clickdummy-v2/` → `prototypes/clickdummy-v2/` (git mv), Links in README/Spec/CI angepasst.
- Laravel 13 im Root (per `ddev composer create-project` in temporären Ordner, dann ins Root übernehmen), Inertia v3 + React 19 + TypeScript, Tailwind 4 mit `@theme`-Tokens aus DESIGN.md (nur Grundlage), Vite mit `laravel-vite-plugin`.
- pnpm-Workspace (`pnpm-workspace.yaml`: `.`, `packages/*`, `docs`, `prototypes/*`).
- DDEV: `.ddev/config.yaml` (name `openbill`, type laravel, php 8.4, mariadb 11.4, nodejs 24, corepack), Vite im Container über Port 5173 mit HMR auf `https://openbill.ddev.site:5173`, `.ddev/docker-compose.gotenberg.yaml` (gotenberg/gotenberg:8, intern `http://gotenberg:3000`).
- Pest (statt PHPUnit), Pint, Larastan Level 6, Pest-Architekturtests-Grundgerüst.
- i18n: `lang/en.json`, `lang/de.json`, Middleware `SetLocale`, Inertia-Shared-Props mit Übersetzungen, React-Helfer `t()`/`tn()`/`path()` (wie prevju), Test: gleiche Schlüssel in beiden Dateien.
- Auth: Login/Logout unter `/{locale}/login`, `users.role` (`owner`/`member`), Command `app:ensure-admin` (liest `ADMIN_EMAIL`/`ADMIN_PASSWORD`), Login-Drosselung.
- Minimale Startseite nach Login (Shell kommt in Phase 5).
- VitePress-Gerüst in `docs/` (Config nach prevju-Vorbild, Locales `/en/` und `/de/`, `srcExclude: ['history/**', 'superpowers/**']`, `llms.txt`), Seiten `index` und `development` (DDEV-Setup) in beiden Sprachen.
- `CLAUDE.md` (Regeln wie prevju: Doku in jedem PR, Kommandos über DDEV, Architekturregeln), `AGENTS.md` falls Laravel Boost genutzt.
- CI `tests`: PHP 8.4 + MariaDB-Service + Gotenberg-Service, `composer install`, Pint `--test`, Larastan, Pest, `pnpm install --frozen-lockfile`, `tsc`, `pnpm build`, Prototypen-Tests (`pnpm --filter ./prototypes/* test`).

**Abnahme:** `ddev start && ddev composer install && ddev exec pnpm install && ddev artisan migrate` läuft; Login mit `app:ensure-admin`-Nutzer klappt auf `/en/login` und `/de/login`; `ddev exec pnpm dev` liefert HMR; `ddev artisan test` grün; CI `tests` grün; `pnpm --dir docs build` grün.

## Phase 2: Domain & Datenmodell

**Branch:** `phase-02-domain` · **Phasenplan:** `…phase-02-domain.md`

**Liefert:** Migrationen und Models für alle Tabellen aus Spec Abschnitt 4 (ULID, Casts, `custom` als `array`, Sperre per `updating`-Hook in `Document`, Soft Delete bei `Customer`), Factories, `DemoSeeder` (Daten aus `prototypes/clickdummy-v2/src/api/seed.ts`, inkl. Templates-Platzhalter bis Phase 3).

`app/Domain`:
- `Money/Decimal` Helfer auf brick/math
- `Tax/EffectiveTax`, `Tax/TaxContext`
- `Totals/TotalsCalculator` → `Totals` (lines, groups, taxBreakdown, net, tax, gross, optionalNet, legalNotes, missingTaxRate)
- `Numbering/NumberFormatter`, `Numbering/NumberAllocator` (Transaktion + `lockForUpdate`)
- `Lifecycle/StatusMachine` (Übergänge, `isLocked`, `isOverdue`)
- `Fields/FieldRegistry` (Kernfelder je Ebene, reservierte Schlüssel), `Fields/CustomValueValidator` (Typ, Pflicht, Optionen, Dokumenttyp → Fehler mit Pfad), `Fields/KeySlugger`
- `Compliance/ComplianceChecker` (Profile `basic`, `en16931`; Issue mit `path` und `message`)
- `Conversion/DocumentConverter` (Regeln aus `prototypes/clickdummy-v2/src/domain/convert.ts`)

`app/Actions`: `CreateDocument`, `UpdateDraft` (ganzes Dokument inkl. Gruppen/Positionen ersetzen), `FinalizeDocument` (ohne PDF; ruft in Phase 3 den Renderer), `SetDocumentStatus`, `ConvertDocument`, `CancelInvoice`, `DuplicateDocument`, `DeleteDraft`, `SaveCustomer`, `DeleteCustomer`, `SaveFieldDefinition`, `DeleteFieldDefinition`, `UpdateOrganization`, `UpdateDocumentType`, `SaveTaxRate`/`ArchiveTaxRate`, `SaveUnit`/`ArchiveUnit`, `SaveTextBlock`/`DeleteTextBlock`. Jede Action schreibt `document_events` wo ein Dokument betroffen ist. Actor über `App\Support\Actor` (User oder Token).

**Tests:** alle Fälle aus `prototypes/clickdummy-v2/src/domain/*.test.ts` portiert, plus Review-Focus-Punkte 1 (Nummern), 3 (Snapshot), 4 (Feldvalidierung).

**Abnahme:** Pest grün inkl. Architekturtests (Actions/Domain-Regeln, kein `float` in `app/Domain`); `ddev artisan db:seed --class=DemoSeeder` erzeugt die Demo-Daten.

## Phase 3: Rendering, PDF, E-Rechnung

**Branch:** `phase-03-rendering` · **Phasenplan:** `…phase-03-rendering.md`

**Liefert:**
- `app/Rendering/ContextBuilder` (Quellen: Dokument, Entwurfs-Array, Szenario)
- `SampleDataFactory` (Szenarien `short_invoice`, `long_invoice`, `small_business`, `reverse_charge`, `offer_with_options`; deterministisch)
- `LiquidRenderer` (keepsuit/liquid, Filter `money`/`date`/`number`/`nl2br`/`t`, Seitenplatzhalter, Limits, `RenderResult{header, body, footer, paper, errors[]}`, `RenderError{part, line, message}`)
- `AssetInliner`
- `GotenbergClient` (Chromium HTML, Header/Footer, Ränder, PDF/A-3b-Option)
- `PdfArchive` (Speicher `storage/app/archive/{yyyy}/{document_id}.pdf|xml`, SHA-256)
- `FinalizeDocument` erweitert (PDF/XML in der Transaktion, Rollback)
- Downloads (`DocumentPdf`-Action: Entwurf live, abgeschlossen aus Archiv)
- `app/EInvoice/CiiBuilder` (horstoeko, EN 16931), `PdfA3Embedder`
- Templates „Klar“, „Kante“, „Leise“ aus `prototypes/clickdummy-v2/src/templates/` als Seeds (built_in)
- Template-Paket Import/Export (`TemplatePackage` ZIP ↔ Model, Manifest-Validierung)

**Tests:**
- Renderer-Golden-Tests (Template + Kontext → HTML)
- Fehler- und Limit-Tests (Review Focus 2)
- Gotenberg gefaked
- Gruppe `integration` mit echtem Gotenberg (in DDEV/CI-Service)
- XSD-Validierung der CII-XML
- Rollback-Test bei Gotenberg-Fehler (Review Focus 1)
- Archiv unverändert nach Stammdatenänderung (Review Focus 3)

**Doku:** `templates` (inkl. Liquid-Referenz: Kontext, Filter, Seitenplatzhalter, Paketformat) und `e-invoice`, en + de.

**Abnahme:** Demo-Rechnung lässt sich in DDEV abschließen; PDF/A-3 mit eingebetteter XML liegt im Archiv; Pest grün.

**Entscheidung aus dem Review (Steuerkategorie Drittland):** Kunden mit `third_country` werden bis Phase 7 auf die Kategorie `G` (Ausfuhr, steuerfrei) abgebildet. Für **Dienstleistungen** an Drittland-Kunden – den häufigeren Fall – ist fachlich `O` (nicht steuerbar) richtig, mit eigenen Regeln (BR-O-02 ff.: keine USt-IDs von Verkäufer und Käufer, nur diese eine Kategorie im Dokument). Phase 7 bekommt dafür eine Kundenoption „Leistungsart: Ware / Dienstleistung“ (Standard Dienstleistung), `EffectiveTax` bildet Drittland + Dienstleistung auf `O` ab, Compliance und `CiiBuilder` setzen die BR-O-Regeln um, und `scripts/validate-einvoice.sh` bekommt den Fall dazu. Exempt-Kategorien ohne Steuerhinweis bekommen seit Phase 3 einen Standard-Befreiungsgrund (`einvoice.exemption.*`).

## Phase 4: REST-API

**Branch:** `phase-04-api` · **Phasenplan:** `…phase-04-api.md`

**Liefert:**
- API Platform for Laravel unter `/api`, Formate JSON + JSON-LD, OpenAPI/Swagger unter `/api/docs`
- Ressourcen und Operationen exakt wie Spec Abschnitt 6, State Provider/Processor rufen Actions
- Problem Details (409 bei gesperrtem Dokument, 422 mit Feldpfaden)
- Filter/Pagination
- Sanctum: Token-Fähigkeiten `api:read`, `api:write`, `mcp`, `templates:render`, `templates:write` (+ Template-Bindung über Token-Name/Metadaten), Session-Auth für die eigene UI (stateful domains inkl. DDEV-Host)
- Render-Endpunkte `POST /api/render`, `GET /api/render/sources`, `GET /api/render/schema`
- `PUT /api/templates/{id}/files`, `GET /api/templates/{id}/package`
- Signierte Download-URLs für PDF/XML (wiederverwendbar in MCP)

**Tests:** Feature-Tests je Ressource und Operation, Rechte-Matrix (Review Focus 5), Feldvalidierung über API (Review Focus 4), kaputtes Template über `/api/render` (Review Focus 2), OpenAPI-Dokument erzeugbar.

**Doku:** `api` (Auth, Ressourcen, Beispiele mit curl), en + de.

**Abnahme:** Hauptablauf aus Spec 1 komplett per curl möglich (Test `ApiFlowTest`).

## Phase 5: UI-Basis

**Branch:** `phase-05-ui-base` · **Phasenplan:** `…phase-05-ui-base.md`

**Liefert:**
- Tailwind-Tokens vollständig aus DESIGN.md (hell/dunkel, `data-theme`)
- Schibsted Grotesk (Fontsource)
- Komponenten in `resources/js/components/ui/` (Port aus `prototypes/clickdummy-v2/src/components/ui/` nach Tailwind: Button, Inputs, Select, Checkbox, Switch, Badge/StatusBadge, Tabs, Dialog/Drawer (Radix Dialog), Menu (Radix DropdownMenu), Toaster, Skeleton/Empty/Error-States, PageHeader)
- `lib/api.ts` (fetch-Wrapper mit CSRF/Session, Problem-Details-Fehler) + SWR-Konfiguration
- AppShell (Sidebar, Einklappen, mobil, Benutzermenü nach oben, Theme, Abmelden)
- Seiten:
  - Übersicht (Kennzahlen, Aufmerksamkeit, zuletzt bearbeitet)
  - Dokumente (Filter in URL, Gruppierung nach Monat)
  - Dialog „Neues Dokument“ (Taste N)
  - Kunden Liste/Detail (Stammdaten, Steuerbehandlung, eigene Felder, Ansprechpartner-Drawer, Dokumente)
- Login im neuen Design

**Tests:** Pest-Inertia-Tests je Seite (Props), Vitest für `lib/api.ts`, Playwright-Grundgerüst in `e2e/` mit Login- und Kunden-Test gegen DDEV.

**Doku:** `documents` (Überblick Dokumente, Status, Kette), en + de.

**Abnahme:** Seiten sehen aus wie im Klickdummy v2 (Screenshots 1440/390, hell/dunkel geprüft); Playwright grün lokal.

## Phase 6: Dokument-Editor

**Branch:** `phase-06-editor` · **Phasenplan:** `…phase-06-editor.md`

**Liefert:**
- `packages/paged-preview` (Port von `prototypes/clickdummy-v2/src/components/PagedPreview.tsx`, Vitest für `computePageBreaks`)
- Editor-Seite `/{locale}/documents/{id}`:
  - Zustand-Store für den Entwurf
  - Autosave per SWR-Mutation `PATCH /api/documents/{id}` (600 ms, Status „Gespeichert“)
  - Vorschau per SWR `POST /api/render` (250 ms, Abbruch) mit Summen und Prüfergebnis aus der Antwort
  - Kopf-/eigene Felder, Gruppen und Positionen mit @dnd-kit (Port aus `prototypes/clickdummy-v2/src/routes/documents/editor/`), Vorschläge aus früheren Positionen (API-Endpunkt `GET /api/position-suggestions`, falls nicht in Phase 4: hier ergänzen)
  - Texte mit Bausteinen, Summen, Prüfanzeige mit Sprung
  - Aktionen (Abschließen mit Bestätigung, Status, Umwandeln, Storno, Duplizieren, Löschen mit Undo, PDF/XML)
  - Kette, E-Rechnungs-Tab (XML)
  - Read-only für abgeschlossene Dokumente

**Tests:** Playwright-Hauptablauf Angebot → Rechnung → abschließen → bezahlt → Storno; Vitest für Store-Operationen (Gruppen verschieben).

**Abnahme:** Hauptablauf in der UI grün in Playwright; keine Rechenlogik im Frontend (Summen kommen aus der API).

## Phase 7: Templates, eigene Felder, Einstellungen

**Branch:** `phase-07-settings` · **Phasenplan:** `…phase-07-settings.md`

**Liefert:**
- Templates-Galerie (Mini-Vorschau über `/api/render`), Import (ZIP), Duplizieren, Löschen
- Template-Editor mit CodeMirror (Kopfzeile/Inhalt/Fußzeile/CSS/Manifest + Papier-Formular), Feldleiste, Live-Vorschau mit Bereichshervorhebung, Beispieldaten-Auswahl, Export
- Eigene Felder (alle Ebenen, Dokumenttyp-Häkchen in der Zeile, Drawer mit Live-Vorschau, gesperrte Kern- und Profilfelder, Undo)
- Kundenoption „Leistungsart: Ware / Dienstleistung“ und Steuerkategorie `O` für Dienstleistungen an Drittland-Kunden (siehe Entscheidung in Phase 3)
- Einstellungen: Organisation (Logo-Upload, Besteuerung, Registernummer `registration_id`), Dokumenttypen (Profil, Nummernkreis mit Vorschau, Vorgaben), Steuern & Einheiten (Archivieren), Textbausteine, Benutzer (Einladen per kopierbarem Link, Rollen)

**Tests:** Pest-Inertia-Tests, Playwright: Feld anlegen → im Dokument füllen → im Template ergänzen → in Vorschau sichtbar.

**Doku:** `custom-fields`, `templates` ergänzt (UI-Editor), en + de.

**Abnahme:** Erfolgskriterium „eigenes Feld bis in Vorschau und PDF“ grün in Playwright.

## Phase 8: MCP

**Branch:** `phase-08-mcp` · **Phasenplan:** `…phase-08-mcp.md`

**Liefert:**
- `app/Mcp/Servers/OpenbillServer` unter `/mcp` (Sanctum, Fähigkeit `mcp`, Throttle)
- alle Tools aus Spec Abschnitt 6 (rufen Actions)
- Resources Liquid-Referenz (liest `docs/en/templates.md` zur Laufzeit; `docs/` darf nicht komplett in `.dockerignore`) und Feldschema
- Server-Instructions
- Seite Einstellungen → „API & MCP“: Tokens mit Fähigkeiten, einmalige Anzeige, zuletzt benutzt, Widerruf; Setup-Snippets für Claude Code, Codex, JSON; Link `/api/docs`

**Tests:** je Tool Feature-Test, Tool-Namen-Test, Rechte (Review Focus 5), Feldvalidierung (Review Focus 4), Playwright: Token anlegen → MCP `list-documents` per HTTP.

**Doku:** `mcp`, en + de.

**Abnahme:** Hauptablauf aus Spec 1 komplett per MCP-Tools möglich (Test `McpFlowTest`).

## Phase 9: Template-Toolkit

**Branch:** `phase-09-toolkit` · **Phasenplan:** `…phase-09-toolkit.md`

**Liefert:**
- `packages/template-kit` (Vite-App mit `paged-preview`, Datenquelle, Feldliste, Fehler-Overlay, Bereiche)
- Vite-Plugin `openbill-render` (watch `template/`, `POST /api/render`, HMR-Event `openbill:render`)
- CLI-Scripts `push`/`pull`/`pack`
- Build-Artefakt fürs Ausliefern
- Download-Endpunkt `POST /{locale}/templates/{id}/toolkit` (legt Token an, baut ZIP aus Kit + Template + `.env.local`)
- Dialog im Template-Editor

**Tests:**
- Vitest für Plugin (Datei-Änderung → Render-Aufruf → HMR-Event, mit Fake-Server)
- Pest für Download/ZIP-Inhalt und Token-Bindung (Review Focus 5)
- Playwright: Toolkit-ZIP entpacken, `pnpm install && pnpm dev` gegen DDEV, Datei ändern, Vorschau aktualisiert

**Doku:** `template-toolkit`, en + de.

**Abnahme:** Erfolgskriterium Toolkit aus Spec 1 grün.

## Phase 10: Docker & Release

**Branch:** `phase-10-docker` · **Phasenplan:** `…phase-10-docker.md`

**Liefert:**
- `Dockerfile` (Node-Stage mit pnpm: App-Assets + Template-Kit bauen; `serversideup/php:8.4-fpm-nginx`, Extensions `intl`, `pdo_mysql`, `zip`, `bcmath`, `gd`)
- `docker/entrypoint.d/99-openbill.sh` (DB warten, APP_KEY persistieren, migrate, ensure-admin, Templates seeden, optimize)
- `docker-compose.yml` (openbill, mariadb, gotenberg, Volumes `openbill-data`, `openbill-db`, Port 7739)
- `.env.docker.example`, `.dockerignore` (behält `docs/en/templates.md`)
- Workflows `docker.yml` (Tag → Multi-Arch nach `baeroe/openbill` + GitHub-Release), `dockerhub.yml` (README-Sync)
- `e2e`-Job in `tests.yml`: Image bauen, Compose starten, Playwright-Hauptablauf
- Trusted Proxies private Netze

**Doku:** `setup`, `reverse-proxy`, `backup` (mariadb-dump + Volume), `upgrading`, en + de.

**Abnahme:** `docker compose up -d` mit lokal gebautem Image → Login → Rechnung abschließen → PDF; `e2e`-Job grün.

## Phase 11: Feinschliff

**Branch:** `phase-11-polish` · **Phasenplan:** `…phase-11-polish.md`

**Liefert:**
- Screenshots mit Demo-Daten (`docs/public/screenshots/{en,de}/`, reproduzierbar per Playwright-Script)
- README (Englisch, Kurzfassung + Links)
- Docs-Workflow `docs.yml` (GitHub Pages)
- Doku-Durchsicht aller Seiten
- `docs/history/`-Eintrag, CLAUDE.md final
- GitHub-Repo-Metadaten (About, Topics)
- Release v0.1.0 **nur nach Nutzerfreigabe**

**Abnahme:** Doku baut, Seiten vollständig in beiden Sprachen; alle CI-Jobs grün.

---

## Fortschritt

- [x] Phase 1: Fundament
- [x] Phase 2: Domain & Datenmodell
- [x] Phase 3: Rendering, PDF, E-Rechnung
- [x] Phase 4: REST-API
- [x] Phase 5: UI-Basis
- [x] Phase 6: Dokument-Editor
- [x] Phase 7: Templates, eigene Felder, Einstellungen
- [x] Phase 8: MCP
- [x] Phase 9: Template-Toolkit
- [x] Phase 10: Docker & Release
- [ ] Phase 11: Feinschliff
