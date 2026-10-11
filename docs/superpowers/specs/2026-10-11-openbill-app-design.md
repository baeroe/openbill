# openbill — App-Design (Ausprojektierung)

Stand: 2026-10-11 · Status: freigegeben

Baut auf dem Fachkonzept in `2026-10-04-openbill-clickdummy-design.md` (Abschnitt 2, inklusive der Änderungen vom 2026-10-11) und dem Klickdummy v2 (`prototypes/clickdummy-v2/`, Gestaltung in dessen `DESIGN.md`) auf. Diese Spec beschreibt die echte Anwendung.

## 1. Ziel

openbill ist ein offenes, selbst gehostetes Programm für Angebote, Auftragsbestätigungen, Rechnungen und Stornos mit eigenen Feldern, eigenen Liquid-Templates und E-Rechnung (EN 16931). Es wird wie `baeroe/prevju` betrieben: ein Image auf Docker Hub, `docker compose up -d`, Doku als VitePress-Seite auf GitHub Pages. Agenten steuern alles über eine REST-API und einen MCP-Server. Template-Autoren entwickeln Templates lokal mit einem Toolkit mit Live-Vorschau.

**Erfolgskriterien**

- `docker compose up -d` mit drei Diensten (openbill, MariaDB, Gotenberg) startet eine nutzbare Instanz mit Admin-Login.
- Kompletter Ablauf in der UI, über die REST-API und über MCP: Angebot mit Gruppen anlegen → abschließen → angenommen → in Rechnung umwandeln → E-Rechnungsprüfung grün → abschließen (PDF/A-3 mit XML im Archiv) → bezahlt → Storno.
- Eigenes Feld anlegen → im Dokument füllen → im Template verwenden → erscheint in Vorschau und PDF.
- Toolkit herunterladen → `pnpm install && pnpm dev` → Änderung an `template.liquid` ist ohne Neuladen in der Vorschau sichtbar → `pnpm push` übernimmt sie in die Instanz.
- Doku (en + de) beschreibt Setup, Betrieb, Templates, Toolkit, E-Rechnung, API und MCP.

## 2. Entscheidungen

| Thema | Entscheidung | Grund |
|---|---|---|
| Repo | Laravel im Repo-Root, `docs/` VitePress, `packages/` TS-Pakete, Klickdummys nach `prototypes/` | wie prevju; einfacher Docker-Build und DDEV |
| Stack | PHP 8.4, Laravel 13, Inertia v3, React 19, TypeScript, Tailwind 4, Vite; Zustand nur für lokalen Editor-State; SWR für asynchrone Requests | Nutzervorgabe |
| Datenbank | MariaDB 11.4 (DDEV und Compose) | Nutzerentscheidung |
| Rendering | **nur serverseitig** (keepsuit/liquid); Browser macht nur den Seitenumbruch der fertigen HTML-Teile | eine Wahrheit; Toolkit kann echte Daten nutzen |
| Rechenlogik | nur in PHP (`app/Domain`); die UI zeigt Summen aus der Render-/Autosave-Antwort | eine Wahrheit |
| Geschäftsabläufe | nur in `app/Actions`; UI, REST-API und MCP rufen dieselben Actions | identisches Verhalten überall |
| PDF | Gotenberg 8 (Chromium-Route), PDF/A-3b bei E-Rechnung | wie Spec v1 |
| E-Rechnung | horstoeko/zugferd, Profil EN 16931 (CII); XRechnung mit Leitweg-ID später | verbreitet, gepflegt |
| REST | API Platform für Laravel unter `/api`, OpenAPI unter `/api/docs` | Nutzervorgabe |
| MCP | laravel/mcp unter `/mcp`, Sanctum-Token | wie prevju |
| Auth | Session für die UI, Sanctum-Tokens mit Fähigkeiten für API/MCP/Toolkit; kein OAuth | wie prevju |
| UI-Sprache | Englisch + Deutsch über Schlüssel (`lang/en.json`, `lang/de.json`), Sprachpräfix in Admin-URLs | Open Source |
| IDs | ULIDs | keine aufzählbaren IDs in API/MCP |
| Beträge | `DECIMAL` in der DB, `brick/math` in PHP, nie Float | Genauigkeit |
| Lokal | DDEV (PHP 8.4, MariaDB, Node 24/pnpm, Vite mit HMR, Gotenberg als Zusatzdienst, Mailpit) | Nutzervorgabe |
| Pakete | pnpm (Workspace: Root-App, `packages/*`, `docs`), Composer | Nutzerregel |
| Ablieferung | je Phase ein Branch + PR; Subagent implementiert, Review-Subagent prüft, Merge per Admin nach grüner CI | Nutzerentscheidung |

## 3. Architektur

```
openbill/
├─ app/
│  ├─ Domain/        Summen, Steuern, Nummernkreise, Prüfprofile, Umwandeln, Feldvalidierung (reines PHP)
│  ├─ Actions/       CreateDocument, UpdateDraft, FinalizeDocument, SetDocumentStatus, ConvertDocument,
│  │                 CancelInvoice, DuplicateDocument, SaveCustomer, SaveFieldDefinition, …
│  ├─ Rendering/     ContextBuilder, SampleDataFactory, LiquidRenderer (+Filter), GotenbergClient, PdfArchive
│  ├─ EInvoice/      CiiBuilder, PdfA3Embedder
│  ├─ Http/          Inertia-Controller (Seiten), Middleware (Locale, Inertia-Shared-Props)
│  ├─ ApiResource/   API-Platform-Ressourcen, State Provider/Processor → Actions
│  ├─ Mcp/           Server, Tools, Resources
│  └─ Models/
├─ resources/js/     Inertia-Seiten, Komponenten, Stores (Zustand), API-Client (SWR)
├─ packages/
│  ├─ paged-preview/ React-Komponente: Seitenumbruch, Kopf-/Fußzeile je Seite, Bereiche
│  └─ template-kit/  Vite-Projekt für lokale Template-Entwicklung
├─ docs/             VitePress (en, de), docs/history (Projektgedächtnis), docs/superpowers (Specs/Pläne)
├─ e2e/              Playwright
├─ prototypes/       clickdummy, clickdummy-v2 (Referenz, eigener CI-Schritt)
├─ .ddev/
├─ docker/, Dockerfile, docker-compose.yml, .env.docker.example
└─ lang/en.json, lang/de.json
```

**Kernregel:** Keine Geschäftslogik in Controllern, API-Processors oder MCP-Tools. Diese validieren Eingaben, rufen eine Action und formen die Antwort. Ein Pest-Architekturtest sichert das.

## 4. Datenmodell

Alle Primärschlüssel ULID. Zeitstempel überall. Beträge `DECIMAL(15,4)` für Preise/Mengen, `DECIMAL(15,2)` für Summen.

| Tabelle | Spalten (Kern) | Regeln |
|---|---|---|
| `organization` | name, street, zip, city, country, logo_path, vat_id, tax_number, iban, bic, bank_name, email, phone, website, taxation_mode (`regular`/`small_business`), locale, custom (JSON) | genau eine Zeile |
| `users` | name, email, password, role (`owner`/`member`), locale | Admin entsteht beim Start aus `ADMIN_EMAIL`/`ADMIN_PASSWORD` (`app:ensure-admin`) |
| `personal_access_tokens` | Sanctum | Fähigkeiten: `api:read`, `api:write`, `mcp`, `templates:render`, `templates:write` |
| `customers` | number (unique), name, street, zip, city, country, email, vat_id, tax_treatment (`domestic`/`eu_reverse_charge`/`third_country`), locale, custom | Soft Delete; Löschen verboten bei abgeschlossenen Dokumenten |
| `contacts` | customer_id, salutation, first_name, last_name, position, email, phone, is_default, custom | genau ein Standard je Kunde |
| `field_definitions` | scope (`org`/`customer`/`contact`/`document`/`position`), key, label, type, required, default_value (JSON), help, options (JSON), doc_types (JSON), sort | unique(scope, key); key unveränderlich; Kern-Schlüssel reserviert |
| `tax_rates` | label, percent, category (`S`,`Z`,`E`,`AE`,`K`,`G`), exemption_note, sort, archived_at | archivieren statt löschen, wenn benutzt |
| `units` | name, symbol, decimals, code (UN/ECE Rec 20), sort, archived_at | wie tax_rates |
| `text_blocks` | name, kind (`intro`/`closing`/`payment`/`note`), body | Liquid-Platzhalter erlaubt |
| `document_types` | type (PK: `offer`/`confirmation`/`invoice`/`cancellation`), profile (`basic`/`en16931`), template_id, default_intro_block_id, default_closing_block_id, payment_term_days, validity_days | `en16931` nur für invoice/cancellation |
| `number_sequences` | doc_type, year (nullable), pattern, next_value, reset_yearly | Vergabe in Transaktion mit `lockForUpdate` |
| `documents` | type, status, number (unique, nullable), date, customer_id, contact_id, service_date, service_date_end, due_date, valid_until, intro, closing, template_id, locale, custom, source_id, cancelled_by_id, finalized_at, paid_at, net_total, tax_total, gross_total, created_by | ab `finalized_at` gesperrt (nur Status/paid_at/cancelled_by_id änderbar) |
| `position_groups` | document_id, title (nullable = lose Positionen), sort | |
| `positions` | document_id, group_id, kind (`item`/`text`/`optional`), title, description, quantity, unit_id, unit_price, tax_rate_id, custom, sort | `optional` nur bei Angeboten |
| `document_snapshots` | document_id, data (JSON: org, customer, contact, tax_rates, units, template) | beim Abschließen |
| `document_files` | document_id, kind (`pdf`/`xml`), path, sha256, size | unveränderlich, Volume |
| `document_events` | document_id, actor_type (`user`/`token`), actor_id, action, payload (JSON) | Protokoll |
| `templates` | name, slug, version, author, license, description, built_in, manifest (JSON), header, body, footer, css | built_in schreibgeschützt |
| `template_assets` | template_id, path, mime, storage_path, size | Fonts, Bilder |

Statusmodell, Umwandlung, Steuerlogik, Prüfprofile, Nummernkreise und Feldtypen exakt wie Fachkonzept Abschnitt 2 (mit Gruppen statt Überschrift-Positionen, zentralen Feldern, Feldern je Dokumenttyp). Umwandeln übernimmt eigene Felder, wenn die Definition auch für den Zieltyp gilt.

## 5. Rendering, PDF, E-Rechnung

- **ContextBuilder** baut `org`, `customer`, `contact`, `document` (inkl. `net_total`, `tax_total`, `gross_total`, `optional_total`, `tax_breakdown`, `legal_notes`, `source_number`), `positions` und `groups` (`title`, `has_title`, `total`, `optional_total`, `positions`). Eigene Felder direkt am Objekt; Kernwerte überschreiben eigene nie. Quellen: gespeichertes Dokument (Entwurf → aktuelle Stammdaten, abgeschlossen → Snapshot), ungespeicherter Entwurf (JSON, nicht persistiert), Beispieldaten.
- **SampleDataFactory** erzeugt deterministische Beispieldaten aus den Felddefinitionen für die Szenarien `short_invoice`, `long_invoice` (mehrseitig, Gruppen), `small_business`, `reverse_charge`, `offer_with_options`.
- **LiquidRenderer** (keepsuit/liquid): Sandbox mit Ressourcengrenzen, Filter `money`, `date`, `number`, `nl2br`, `t`; `{{ page.number }}`/`{{ page.total }}` → `<span class="pageNumber">`/`<span class="totalPages">`. Fehler mit Bereich (`header`/`body`/`footer`/`css`) und Zeile. Logo und Template-Assets in Kopf-/Fußzeile als Data-URL.
- **Render-Endpunkt** `POST /api/render` → `{ header, body, footer, paper, totals, issues, errors }`. UI über SWR (250 ms Verzögerung, Abbruch veralteter Anfragen). Toolkit mit Token `templates:render`. Dazu `GET /api/render/sources` (wählbare Dokumente und Szenarien) und `GET /api/render/schema` (Kern- und eigene Felder je Ebene).
- **Seitenumbruch** im Browser: `packages/paged-preview` (Iframes ohne Skriptrechte, Kopf-/Fußzeile je Seite, Bereiche einblendbar) — Port der Komponente aus dem Klickdummy.
- **GotenbergClient** (gotenberg/gotenberg-php): HTML + header.html + footer.html, Ränder aus dem Manifest, Papierformat, Hintergründe; PDF/A-3b bei Profil `en16931`. Entwürfe als PDF mit „Entwurf“.
- **FinalizeDocument** in einer DB-Transaktion: Prüfprofil → Nummer → Snapshot → PDF (+ XML bei E-Rechnung, eingebettet) → `document_files` mit SHA-256 → Event. Fehler bei Gotenberg rollt alles zurück, Nummer bleibt frei. Downloads liefern danach immer die archivierte Datei.
- **E-Rechnung**: `CiiBuilder` (horstoeko/zugferd, EN 16931), `PdfA3Embedder` (horstoeko PDF-Merger). XML separat herunterladbar. Tests validieren gegen XSD; optionaler CI-Job prüft mit dem KoSIT-Validator (nur Warnung).
- Mitgelieferte Templates „Klar“, „Kante“, „Leise“ aus dem Klickdummy v2 (Gruppen mit Zwischensummen).

## 6. REST-API und MCP

**REST (API Platform, `/api`)**: Ressourcen `Customer` (+ `contacts`), `Document` (Gruppen/Positionen eingebettet, schreibbar nur als Entwurf), `FieldDefinition`, `TaxRate`, `Unit`, `TextBlock`, `Template`, `DocumentType`, `Organization` (GET/PATCH). Eigene Operationen: `POST /api/documents/{id}/finalize|status|convert|cancel|duplicate`, `GET /api/documents/{id}/pdf|xml`, `POST /api/render`, `GET /api/render/sources|schema`, `PUT /api/templates/{id}/files`, `GET /api/templates/{id}/package` (ZIP). Formate JSON und JSON-LD, Fehler als Problem Details (RFC 7807), gesperrtes Dokument → 409. Listen paginiert und filterbar. Auth: Sanctum (Token mit Fähigkeiten oder Session der UI). Die UI nutzt dieselbe API für Autosave, Vorschläge und Vorschau.

**MCP (laravel/mcp, `/mcp`)**: Token-Fähigkeit `mcp`, Throttle. Tools (kebab-case): `get-overview`, `list-customers`, `get-customer`, `create-customer`, `update-customer`, `list-documents`, `get-document`, `create-document`, `update-document`, `finalize-document`, `set-document-status`, `convert-document`, `cancel-invoice`, `duplicate-document`, `get-document-pdf-url` (signiert, 15 min), `list-field-definitions`, `save-field-definition`, `list-templates`, `get-template`, `update-template`, `render-template-preview`, `get-settings`, `update-organization`, `list-tax-rates-and-units`, `list-text-blocks`. Resources: Liquid-Referenz (zur Laufzeit aus `docs/en/templates.md`), Feldschema. Fehler als `ValidationException`. Test: jeder in Texten genannte Tool-Name existiert. Destruktive Tools annotiert.

**Seite „API & MCP“** (Einstellungen): Tokens anlegen (Name, Fähigkeiten), einmal anzeigen, „zuletzt benutzt“, widerrufen; Einrichtungsbefehle mit Token für Claude Code (`claude mcp add --transport http …`), Codex (`config.toml`) und als JSON; Link auf `/api/docs`.

## 7. Template-Toolkit

- **Download** im Template-Editor („Toolkit herunterladen“): Dialog legt einen Token an (`templates:render`, `templates:write`, auf das Template beschränkt) und liefert ein ZIP: `template/` (header.liquid, template.liquid, footer.liquid, styles.css, manifest.json, assets/), `.env.local` (`OPENBILL_URL`, `OPENBILL_TOKEN`, `OPENBILL_TEMPLATE_ID`, in `.gitignore`), `package.json` und das beim Docker-Build gebaute Kit aus `packages/template-kit`.
- **`pnpm dev`**: lokale Seite mit `paged-preview`, Datenquelle (Szenarien oder echte Dokumente), Feldliste je Ebene mit Typ (Klick kopiert Ausdruck), Markierung fehlender erwarteter Felder, Fehler-Overlay mit Datei und Zeile, Schalter „Bereiche“, Seitenzahl.
- **HMR**: Vite-Plugin beobachtet `template/`, rendert über `POST /api/render`, schickt das Ergebnis per HMR-Event; kein Neuladen, Scroll-Position bleibt.
- **`pnpm push`** (nur eigene Templates), **`pnpm pull`** (Template + Schema), **`pnpm pack`** (Template-Paket-ZIP für Import).
- Braucht eine erreichbare Instanz; offline gibt es keine Vorschau.

## 8. UI

Gestaltung „Graphit & Kobalt“ nach `prototypes/clickdummy-v2/DESIGN.md`, umgesetzt mit Tailwind 4 (`@theme` mit den Tokens), eigenen Komponenten (Port aus dem Klickdummy) und Radix-Primitives nur dort, wo Barrierefreiheit es verlangt (Dialog, Menü, Popover). Seiten wie im Klickdummy v2: Login, Übersicht, Dokumente, Dokument-Editor, Kunden (Liste/Detail), Templates (Galerie/Editor), Eigene Felder, Einstellungen (Organisation, Dokumenttypen, Steuern & Einheiten, Textbausteine, Benutzer, API & MCP). Editor: Entwurf in einem Zustand-Store, Autosave per SWR (`PATCH /api/documents/{id}`), Vorschau per SWR (`POST /api/render`), Gruppen und Positionen per Drag & Drop (@dnd-kit), Vorschläge aus früheren Positionen.

## 9. Betrieb

**DDEV**: `.ddev/config.yaml` (type laravel, php 8.4, mariadb 11.4, nodejs 24, corepack/pnpm), Vite im Web-Container mit HMR über `https://openbill.ddev.site:5173`, `.ddev/docker-compose.gotenberg.yaml`. Befehle: `ddev start`, `ddev composer …`, `ddev exec pnpm …`, `ddev artisan …`.

**Docker Compose** (Self-Hosting): `openbill` (Image `baeroe/openbill`, `serversideup/php:8.4-fpm-nginx`, Host-Port 7739 → 8080, Volume `openbill-data` = `storage/app`), `mariadb` (11.4, Volume `openbill-db`), `gotenberg` (8). Entrypoint: auf DB warten, `APP_KEY` erzeugen und im Volume speichern, migrieren, `app:ensure-admin`, `optimize`. `.env.docker.example` mit `APP_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DB_PASSWORD`, `DB_ROOT_PASSWORD`, `OPENBILL_PORT`, optional `OPENBILL_IMAGE`. Trusted Proxies nur für private Netze.

**Release**: Tag `vX.Y.Z` → `.github/workflows/docker.yml` baut amd64 + arm64, pusht `baeroe/openbill:X.Y.Z`, `:X.Y`, `:latest` und legt ein GitHub-Release an. `dockerhub.yml` synchronisiert die README. Secrets `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN` sind gesetzt. Vor jedem Tag ein Abschnitt in `docs/en/upgrading.md` und `docs/de/upgrading.md`.

## 10. Tests und CI

- **Pest**: Unit (Domain), Feature (Actions, Inertia-Seiten, API, MCP, Rendering). Gotenberg standardmäßig gefaked (`Http::fake`); Gruppe `integration` rendert echt.
- **Architektur**: Geschäftslogik nur in Actions, kein `float` in `app/Domain`, Models ohne Logik außer Sperren/Casts.
- **Statisch**: Pint, Larastan (Level 6), `tsc`.
- **Vitest**: `packages/paged-preview`, `packages/template-kit`.
- **Playwright** (`e2e/`): Hauptablauf Angebot → Rechnung → Storno, Feld → Template → Vorschau, Token → MCP-Aufruf, Toolkit-Download.
- **CI** `.github/workflows/tests.yml`: Pflicht-Job `tests` (MariaDB- und Gotenberg-Service, Pint, Larastan, Pest, tsc, Vitest, Build, Prototypen-Tests); Job `e2e` gegen den Compose-Stack (nicht Pflicht); `docs.yml` (GitHub Pages bei Änderungen in `docs/`).

## 11. Doku

VitePress in `docs/` (eigenes `package.json` im pnpm-Workspace), Englisch unter `/en/`, Deutsch unter `/de/`, gleiche Dateinamen, `llms.txt` aus den englischen Seiten. `srcExclude`: `history/**`, `superpowers/**`. Seiten: `index`, `setup`, `reverse-proxy`, `backup`, `upgrading`, `documents`, `custom-fields`, `templates` (inkl. Liquid-Referenz), `template-toolkit`, `e-invoice`, `api`, `mcp`. Jede Phase liefert ihre Seiten im selben PR in beiden Sprachen; CLAUDE.md schreibt das fest. Screenshots nur mit Demo-Daten.

## 12. Phasen

1. **Fundament**: Klickdummys nach `prototypes/`, Laravel 13 + Inertia/React/TS + Tailwind 4, Pest/Pint/Larastan, pnpm-Workspace, DDEV (inkl. Gotenberg), i18n en/de, Login + `app:ensure-admin` + Rollen, CLAUDE.md, CI, VitePress-Gerüst mit Setup-Seite für Entwickler.
2. **Domain & Datenmodell**: Migrationen, Models (ULID, Sperre, Casts), Domain-Services, Feldvalidierung, Actions, Demo-Seeder, Tests (Fälle aus dem Klickdummy).
3. **Rendering, PDF, E-Rechnung**: ContextBuilder, SampleDataFactory, LiquidRenderer, Templates Klar/Kante/Leise, GotenbergClient, FinalizeDocument mit Archiv, ZUGFeRD; Doku `templates`, `e-invoice`.
4. **REST-API**: API Platform, eigene Operationen, Sanctum-Fähigkeiten, Render-Endpunkte, OpenAPI; Doku `api`.
5. **UI-Basis**: Tokens/Komponenten, Shell, Übersicht, Dokumentliste, Neues Dokument, Kunden; Doku `documents`.
6. **Dokument-Editor**: Zustand-Store, Autosave/Vorschau per SWR, `packages/paged-preview`, Gruppen mit DnD, Vorschläge, Prüfanzeige, Aktionen, Kette.
7. **Templates, Felder, Einstellungen**: Template-Galerie/-Editor (CodeMirror), Import/Export, Eigene Felder, Einstellungsseiten; Doku `custom-fields`.
8. **MCP**: Server, Tools, Resources, Seite „API & MCP“; Doku `mcp`.
9. **Template-Toolkit**: `packages/template-kit`, Download, HMR, push/pull/pack; Doku `template-toolkit`.
10. **Docker & Release**: Dockerfile, Entrypoint, Compose, Workflows, E2E gegen den Stack; Doku `setup`, `reverse-proxy`, `backup`, `upgrading`.
11. **Feinschliff**: Screenshots, README, Doku-Durchsicht, Projektgedächtnis; Release v0.1.0 nach Freigabe durch den Nutzer.

## 13. Nicht im Umfang

OAuth für Connectors, XRechnung mit Leitweg-ID, E-Mail-Versand, Zahlungsabgleich, Mahnwesen, Marketplace, Mehrmandanten, Fremdwährungen, Offline-Vorschau im Toolkit.
