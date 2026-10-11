# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Diese Datei aktuell halten.** Wer Stack, Ablauf, Kommandos oder Konventionen ändert, passt CLAUDE.md im selben Commit an. Veraltete Angaben hier sind schlimmer als keine.

**Die Doku (`docs/`, VitePress) ist Teil jeder Änderung.** Jede Änderung, die Nutzer, Betreiber oder Entwickler betrifft (Verhalten, Setup, Umgebungsvariablen, Routen, API, MCP-Tools, UI-Abläufe, Templates), passt im selben PR die betroffenen Seiten an, **auf Englisch (`docs/en/`) und Deutsch (`docs/de/`)**. Kein Merge mit veralteter Doku. Reine Refactorings ohne sichtbare Auswirkung brauchen keine Doku.

Spec und Pläne: `docs/superpowers/specs/2026-10-11-openbill-app-design.md` (bindend), Master-Plan `docs/superpowers/plans/2026-10-11-openbill-app.md`, Phasenpläne daneben. Projektgedächtnis: `docs/history/` (falls vorhanden).

## Was openbill ist

Offenes, selbst gehostetes Programm für Angebote, Auftragsbestätigungen, Rechnungen und Stornos mit eigenen Feldern, eigenen Liquid-Templates (Rendering nur serverseitig, PDF über Gotenberg) und E-Rechnung (EN 16931). Steuerbar über UI, REST-API und MCP. Wird in Phasen gebaut; Stand: Phase 3 (Rendering: Liquid-Templates, PDF über Gotenberg, E-Rechnung EN 16931, Archiv; noch keine API und keine UI für Dokumente).

## Tech Stack

- PHP 8.4, Laravel 13, MariaDB 11.4, Inertia v3 + React 19 + TypeScript, Tailwind 4, Vite 8 (`laravel-vite-plugin`)
- Tests: Pest 5 (Suiten `Unit` ohne App, `Feature` gegen MariaDB-DB `testing` mit `RefreshDatabase`, `Integration` mit `DatabaseMigrations` für echte Parallelität), Larastan Level 6, Pint
- Rechnen: brick/math (`BigDecimal`), nie float
- Rendering: keepsuit/liquid (Templates), gotenberg/gotenberg-php (PDF über Gotenberg ≥ 8.34, PDF/A-3b mit Factur-X), horstoeko/zugferd (CII-XML EN 16931 + XSD), smalot/pdfparser (nur Tests)
- Doku: VitePress in `docs/` (eigenes Paket im pnpm-Workspace)
- Prototypen (Referenz, nicht Teil der App): `prototypes/clickdummy`, `prototypes/clickdummy-v2` (Gestaltung: `prototypes/clickdummy-v2/DESIGN.md`)
- Lokal: DDEV (Web-Container mit PHP 8.4 + Node 24 + pnpm über corepack, MariaDB, Mailpit, Gotenberg als Zusatzdienst)

## Kommandos

Auf dem Host gibt es kein PHP. **PHP, Composer, Artisan nur über DDEV; JS nur über pnpm im Container** (`node_modules` enthält Linux-Binaries).

```bash
ddev start                                   # https://openbill.ddev.site
ddev composer install
ddev artisan migrate
ddev artisan app:ensure-admin                # Owner aus ADMIN_EMAIL / ADMIN_PASSWORD (.env)
ddev exec pnpm install
ddev exec pnpm dev                           # Vite + HMR über https://openbill.ddev.site:5173
ddev artisan test                            # alle Pest-Tests
ddev artisan test --filter=AuthTest          # einzelne Datei/Test
ddev artisan test --testsuite=Integration    # Parallelprozesse/Locks (DatabaseMigrations, langsamer)
ddev artisan db:seed --class=DemoSeeder      # Demo-Daten (ersetzt alle Fachdaten, Benutzer bleiben)
ddev artisan app:sync-templates              # mitgelieferte Templates Klar/Kante/Leise anlegen/aktualisieren
ddev artisan app:render-sample klar long_invoice --locale=de   # PDF mit Beispieldaten → storage/app/private/samples/
ddev artisan test --testsuite=Integration --group=gotenberg     # gegen das echte Gotenberg (DDEV-Dienst)
ddev exec 'UPDATE_GOLDEN=1 php artisan test --filter=GoldenTest'   # Golden-HTML der Templates neu schreiben (Diff prüfen!)
scripts/validate-einvoice.sh                 # EN-16931-Schematron (CEN, Saxon-HE in Docker) auf die E-Rechnungen aus EInvoiceSamplesTest
ddev exec vendor/bin/pint                    # PHP formatieren (CI: --test)
ddev exec vendor/bin/phpstan analyse --memory-limit=1G
ddev exec pnpm typecheck                     # tsc
ddev exec pnpm build
ddev exec 'pnpm --filter "./prototypes/*" test'   # äußere Quotes nötig, siehe Fallstricke
ddev exec pnpm --dir docs dev                # https://openbill.ddev.site:5174/en/
ddev exec pnpm --dir docs build
```

## Regeln

- **Actions-Regel:** Keine Geschäftslogik in Controllern, API-Processors oder MCP-Tools. Abläufe nur in `app/Actions`, Rechnen/Regeln nur in `app/Domain` (reines PHP). Controller validieren, rufen eine Action, formen die Antwort. Architekturtests in `tests/Unit/ArchTest.php` sichern das ab und wachsen mit.
- **pnpm-Regel:** Nur pnpm, nie npm/npx (Einmal-Tools `pnpm dlx`). Root-Abhängigkeiten mit `pnpm add -w`, Pakete mit `pnpm --dir <paket> add` bzw. `--filter`. Workspace: Root, `packages/*`, `docs`, `prototypes/*`, ein Lockfile im Root. Neue Abhängigkeiten mit Build-Skripten müssen in `pnpm-workspace.yaml` unter `allowBuilds` freigegeben (`true`) oder geblockt (`false`) werden, sonst bricht `pnpm install` ab.
- Beträge nie als `float` (`DECIMAL` in der DB, `Brick\Math\BigDecimal` in PHP, Strings im JSON). Primärschlüssel ULID (`HasUlids`).
- UI-Texte nur über Schlüssel in `lang/en.json` und `lang/de.json` (flach, Punkt-Namensräume wie `login.submit`, Platzhalter `:name`, Plural `.one`/`.other`). PHP `__('key')`, React `t('key')`/`tn('key', n)` aus `resources/js/lib/i18n.ts`, Admin-URLs im Frontend immer über `path('/…')`. `tests/Unit/TranslationsTest.php` prüft gleiche Schlüssel und dass jeder im Code benutzte Schlüssel existiert. Code und Kommentare Englisch.
- Gestaltung nach `prototypes/clickdummy-v2/DESIGN.md`; Tokens in `resources/css/app.css` (`@theme inline`). Keine shadcn-Defaults, Radix nur für Dialog/Menü/Popover.
- Demo-Daten und Test-Beispiele nur fiktiv (`@example.com`, Studio Nordlicht, Hafenkontor Lindqvist, …); keine echten Firmen, Hosts oder Personen.
- CI: Pflicht-Job `tests` in `.github/workflows/tests.yml` – Name nie ändern. Neue Prüfungen dort anhängen.
- Git: Branch je Phase `phase-NN-<name>`, PR gegen `main`, Conventional Commits.

## Architektur (Stand Phase 3)

- Routen (`routes/web.php`): Admin unter Sprachpräfix `/{locale}` (`en|de`): `GET|POST /{locale}/login` (guest), `POST /{locale}/logout`, `GET /{locale}` = Startseite `home` (auth). `/` und `/login` leiten in die zuletzt genutzte Sprache um (Cookie `locale`, sonst `en`). Unbekanntes Präfix → 404.
- `app/Http/Middleware/SetLocale.php`: Sprache aus Präfix, sonst Cookie, sonst `en` (nie `Accept-Language`). Setzt `URL::defaults(['locale' => …])` und das Request-Attribut `locale`, merkt die Sprache im Cookie und **entfernt den Routenparameter `locale`**, damit Controller ihn nie als Argument bekommen (sonst verrutschen Model-Bindings). `SetLocale::fromRequest()` funktioniert auch vor der Middleware (Auth läuft wegen der Middleware-Priorität früher) und wird in `bootstrap/app.php` für `redirectGuestsTo`/`redirectUsersTo` genutzt.
- `app/Http/Middleware/HandleInertiaRequests.php`: Shared Props `locale`, `translations` (ganze JSON-Datei der Sprache), `auth.user` (`id`, `name`, `email`, `role`). TS-Typ: `SharedProps` in `resources/js/types.ts`. Sprachwechsel lädt die Seite neu (`resources/js/app.tsx`).
- Login: `app/Http/Requests/LoginRequest.php` sperrt nach 5 Fehlversuchen je `lower(email)|IP` für 60 s; Route zusätzlich `throttle:20,1` je IP. Remember-Cookie nur mit Checkbox „Angemeldet bleiben“ (`remember`). Nach Login zurück zur angefragten Seite (nur Ziele auf der eigenen Basis-URL), aber in der Sprache des Logins.
- Nutzer: ULID, `role` (`App\Enums\UserRole`: `owner`/`member`), `locale` (nullable). `php artisan app:ensure-admin` liest `config('openbill.admin.*')` (= `ADMIN_EMAIL`/`ADMIN_PASSWORD`), legt einmalig einen Owner an, ändert bestehende Konten nie, überspringt ohne Variablen, bricht bei ungültiger E-Mail oder Passwort < 8 Zeichen ab.
- Gotenberg: `config('services.gotenberg.url')` (`GOTENBERG_URL`, DDEV: `http://gotenberg:3000`), `config('services.gotenberg.timeout')` (`GOTENBERG_TIMEOUT`, 20 s).
- **Domain** (`app/Domain`, reines PHP, nur `App\Enums` + brick/math, kein float – `tests/Unit/NoFloatTest.php`, `ArchTest`): `Money/Decimal`, `Tax/*`, `Totals/TotalsCalculator` → `Totals` (`toArray()` mit Strings), `Numbering/NumberFormatter`, `Lifecycle/StatusMachine`, `Fields/*` (Registry, `KeySlugger`, `CustomValueValidator`, `FieldDefinitionValidator`), `Compliance/ComplianceChecker` (Profile `basic`/`en16931`), `Conversion/DocumentConverter`. Port der Logik aus `prototypes/clickdummy-v2/src/domain`; Meldungen kommen als Codes (`ComplianceRule`, `FieldErrorCode`), übersetzt über `compliance.*` / `fields.error.*`.
- **Actions** (`app/Actions`, final, `handle(Actor $actor, …)`): einzige Stelle, die Fachdaten schreibt. Validieren selbst (Laravel-`ValidationException` mit Punkt-Pfaden wie `groups.0.positions.1.custom.ticket`), laufen in Transaktionen, schreiben `document_events` über `App\Support\EventLog`. Liste und Signaturen: Phasenplan `docs/superpowers/plans/2026-10-11-phase-02-domain.md`, Abschnitt „Interfaces“.
- **Support** (`app/Support`): `Actor` (user/token/system), `SnapshotBuilder` (Stammdaten in Snapshot-Form), `DocumentInspector` (Summen/Prüfung: Entwurf live, abgeschlossen aus dem Snapshot), `DomainMapper` (Models → Domain-DTOs), `GroupWriter` (ersetzt Gruppen/Positionen, behält eigene IDs), `Text::t()` (`__()` mit String-Rückgabe).
- **Sperre:** `Document::updating/deleting` werfen `DocumentLockedException`, sobald `finalized_at` gesetzt ist (erlaubt bleiben `status` außer `draft`, `paid_at`, `cancelled_by_id`); Gruppen/Positionen prüfen über `Document::assertDraft()` altes und neues Dokument (kein Umhängen), eine Position muss in einer Gruppe ihres Dokuments liegen. Snapshots, Dateien und Events sind unveränderlich. Zusätzlich MariaDB-Trigger (`2026_10_11_100250_create_document_lock_triggers.php`) auf `documents`, `positions`, `position_groups`, `document_snapshots`, `document_files`: Query-Builder-Schreibzugriffe enden in `QueryException` (`SQLSTATE 45000`, Meldung `openbill: …`). Abschließende/ändernde Actions laden das Dokument in der Transaktion mit `lockForUpdate` neu und prüfen dort (`UpdateDraft`, `DeleteDraft`, `FinalizeDocument`, `SetDocumentStatus`, `ConvertDocument`).
- **Abschließen:** `FinalizeDocument` in einer Transaktion: Zeile sperren → Prüfprofil (`ComplianceFailedException` mit Issue-Liste) → `AllocateDocumentNumber` (`lockForUpdate` auf `number_sequences`, überspringt belegte Nummern) → Summen → Snapshot → Storno setzt Rechnung auf `cancelled` → `App\Contracts\DocumentArchiver` (`PdfDocumentArchiver`: PDF/XML ins Archiv; `NullDocumentArchiver` nur für Tests) → Event. Jeder Fehler rollt alles zurück.
- **Rendering** (`app/Rendering`): `ContextBuilder::build(Document, $sources)` → Liquid-Kontext (org, customer, contact, document, groups, positions; Beträge als Strings, eigene Felder direkt am Objekt, nur reservierte Kernschlüssel) + `Totals`. Quellen: gespeicherter Entwurf (`SnapshotBuilder::build`), abgeschlossen (Snapshot), ungespeicherter Entwurf (`DraftOverlay::apply` über `DraftInput::validate`, nie speichern), Beispieldaten (`SampleDataFactory`, Szenarien `RenderScenario`). `LiquidRenderer::render(TemplateSource, $context, RenderOptions)` → `RenderResult{header, body, footer, paper, errors[]}` (drei eigenständige HTML-Dokumente wie für Gotenberg; wirft nie wegen des Templates; `RenderError{part, line, message}` mit `RenderPart::file()`). Sandbox: `Liquid/LiquidEnvironment` (strikte Filter, Fehler mit Zeile, `ResourceLimits` aus `config('openbill.rendering')`, `BoundedForTag`, kein `tablerow`/`render`), Filter in `Liquid/OpenbillFilters` (`money`, `number`, `date`, `nl2br`, `t`). Vorschau-Schnittstelle für Phase 4/6/7/9: `App\Actions\RenderPreview` → `PreviewResult::toArray()` = Antwort von `POST /api/render`.
- **PDF und Archiv:** `GotenbergClient::pdf(RenderResult, ?xml)` (gotenberg-php baut den Request, Laravel `Http` sendet ihn mit `services.gotenberg.timeout`). `PdfDocumentArchiver` (gebunden an `DocumentArchiver`) rendert beim Abschließen aus dem Snapshot über `DocumentRenderer` und speichert per `PdfArchive` auf der Disk `archive` (`storage/app/archive/{yyyy}/{id}.pdf|xml`, `document_files` mit SHA-256): erst `.tmp/`, dann in der Transaktion umbenennen, `DB::afterRollBack()` löscht. Downloads: `DocumentPdf` (abgeschlossen: Archivdatei mit SHA-256-Prüfung, sonst `ArchiveCorruptedException`; Entwurf: live mit Wasserzeichen), `DocumentXml` (nur archivierte E-Rechnungen, sonst `ActionNotAllowedException` `no_e_invoice`).
- **E-Rechnung** (`app/EInvoice`): `CiiBuilder::build(Document, $sources, Totals)` mit horstoeko (Profil EN 16931, Storno = Gutschrift 381 mit positiven Beträgen), prüft gegen das XSD (`CiiBuilder::validate()`, sonst `EInvoiceInvalidException`). Einbetten macht Gotenberg (`pdfa=PDF/A-3b` + `facturX`, Datei `factur-x.xml`). Einzige float-Stelle: `CiiAmount::of()` (Rundreise-Prüfung).
- **Templates:** Paketformat `TemplatePackage` (`manifest.json`, `template.liquid`, `header.liquid`, `footer.liquid`, `styles.css`, `assets/…`), Prüfung `ManifestValidator`, Actions `ImportTemplatePackage` (ZIP, Assets auf Disk `local` unter `templates/{id}/`), `ExportTemplatePackage`, `SyncBuiltInTemplates` (Quellen `resources/templates/{klar,kante,leise}`, Migration `2026_10_11_100400`, `DemoSeeder`, `app:sync-templates`). Welches Template: `TemplateResolver::for()` (Dokument → Dokumenttyp → `klar`); der Snapshot friert das tatsächlich benutzte ein.
- **Exceptions** (`app/Exceptions`, Basis `DomainActionException::status()`): `DocumentLockedException` 409, `ActionNotAllowedException` 409 (`reason`), `ComplianceFailedException` 422 (`toArray()` → `[{path, message}]`).
- **Exceptions** zusätzlich: `TemplateRenderFailedException` 422 (`toArray()` = Fehlerliste), `EInvoiceInvalidException` 422, `PdfRenderFailedException` 503, `ArchiveCorruptedException` (kein Domain-Fehler, 500).
- `document_snapshots.data` enthält zusätzlich `legal_notes` (`small_business`, `reverse_charge`, `third_country` in der Dokumentsprache); `DocumentInspector` nimmt sie bei abgeschlossenen Dokumenten aus dem Snapshot und wirft `LogicException`, wenn einem abgeschlossenen Dokument der Snapshot fehlt. `document_events.user_id` hält den Nutzer hinter einem Token.
- **Grunddaten** kommen aus der Migration `2026_10_11_100300_insert_default_master_data.php` (Organisation, Dokumenttypen, Nummernkreise `Q`/`OC`/`INV`/`CN`, Steuersätze, Einheiten), nicht aus Seedern.

## Doku

VitePress in `docs/`, Englisch unter `docs/en/` (Locale `root` mit `link: '/en/'`), Deutsch unter `docs/de/`, gleiche Dateinamen; Pfade ohne Präfix leitet `docs/.vitepress/theme/index.ts` auf `/en/…` um. Interne Links immer mit Präfix. Neue Seite: Datei in beiden Sprachen anlegen und den Namen in `pages` in `docs/.vitepress/config.ts` eintragen (`tests/Unit/DocsTest.php` prüft beides). `docs/history/` und `docs/superpowers/` sind per `srcExclude` nicht Teil der Website. `llms.txt` enthält nur die englischen Seiten. `pnpm-workspace.yaml` überschreibt `vitepress>vite` auf ^6.4.3 (VitePress 1.x pinnt Vite 5); entfernen, sobald VitePress 2 stabil ist. Der Dev-Server erlaubt per `vite.server.allowedHosts` nur `.ddev.site` (sonst 403 hinter DDEV).

## Fallstricke

- `public/hot` bleibt liegen, wenn Vite hart beendet wird; dann lädt die Seite Assets vom toten Dev-Server. `rm public/hot`.
- `ddev exec` reicht die Argumente an eine Shell im Container weiter: Globs wie `./prototypes/*` werden dort expandiert. Den ganzen Befehl in einfache Quotes setzen: `ddev exec 'pnpm --filter "./prototypes/*" test'`.
- Tests laufen ohne Vite-Build (`withoutVite()` in `tests/TestCase.php`); Inertia-Tests prüfen, dass `resources/js/pages/<name>.tsx` existiert.
- Sessions sind JSON-serialisiert (`config/session.php`, `serialization => json`): Nach einem Test-Request liefert `session('errors')` ein Array, erst `->assertSessionHasErrors()` macht daraus wieder einen `ViewErrorBag`. Fehlertexte also nach `assertSessionHasErrors()` lesen.
- `phpunit.xml` erzwingt `DB_DATABASE=testing` (DDEV-Hook legt sie bei `ddev start` an; in CI der MariaDB-Service).
- Tailwind scannt nur `resources/` (`@import 'tailwindcss' source(none)` + `@source`), sonst landen Klassen aus Prototypen und Doku im CSS.
- `users.id` ist eine ULID: Sanctum (Phase 4) braucht `ulidMorphs('tokenable')` in `personal_access_tokens`; `sessions.user_id` ist bereits `foreignUlid`.
- `ddev composer create-project` nicht benutzen (der DDEV-Wrapper will ein leeres Root).
- Laravel Boost wird nicht genutzt; es gibt kein `AGENTS.md`.
- Mass-Updates/-Deletes (`Model::query()->update()`, `->delete()` auf Relationen) umgehen die Sperr-Hooks; abgeschlossene Dokumente schützen dann nur noch die Trigger. In Actions nur für Entwürfe benutzen (wie `GroupWriter`). `DB::table()` auf `documents`, `positions`, `position_groups`, `document_snapshots`, `document_files` ist in `app/` verboten (`ArchTest`).
- Neue Spalte in `documents`: Trigger `documents_lock_update` in derselben Migration neu anlegen (DROP + CREATE mit allen gesperrten Spalten); `SchemaTest` prüft, dass jede Spalte außer `Document::MUTABLE_WHEN_FINALIZED` im Trigger steht.
- `SET @openbill_unlock = 1` schaltet die Trigger für die Session ab. Nur `DemoSeeder::wipe()` nutzt das (und der Seeder verweigert `production`).
- Trigger anlegen braucht bei aktivem Binlog `log_bin_trust_function_creators = 1` oder SUPER (relevant für Phase 10, Docker/Produktion).
- Beträge/Mengen in Action-Eingaben nur als String mit Punkt oder int (`DecimalString`); JSON-Zahlen mit Nachkommastellen (`12.5`) werden abgelehnt.
- Feature-Tests laufen in einer Transaktion: Was andere Prozesse oder Verbindungen sehen müssen (Locks, `Concurrency`), gehört in `tests/Integration` (DatabaseMigrations, committete Daten). Closures für `Concurrency::run()` müssen `static` sein und in einer per Autoload ladbaren Klasse entstehen (z. B. `tests/Integration/ParallelAllocation.php`): Eine Closure aus einer Pest-Datei trägt Pests generierte Testklasse als Scope, die der Kindprozess nicht laden kann (`Class "P\Tests\…" not found`).
- `document_types` hat den String-PK `type` (Model `DocumentTypeSetting`, weil `DocumentType` das Enum ist).
- Laravels eingebaute Validierungstexte (`required`, `email`, …) sind nur englisch, bis `lang/de/validation.php` existiert; eigene Meldungen stehen in `lang/*.json`.
- Larastan liest Model-Casts nur mit `parseModelCastsMethod: true` (`phpstan.neon`), weil `casts()` als `array<string, string>` annotiert ist; sonst gelten Enum-/Decimal-Spalten als `string`/`float`.
- Test-Helfer stehen in `tests/Pest.php` (`systemActor()`, `itemRow()`, `draftDocument()`, `draft()`, `completeOrganization()`, …). Pest-Dateien laufen ohne `strict_types`: Ein float an einem `string`-Parameter wird still zu `"12.5"`; float-Eingaben deshalb direkt ins Array schreiben.
- **Escaping:** keepsuit/liquid escapt nicht von selbst. `LiquidRenderer` escapt alle Strings im Kontext genau einmal; Templates geben Werte direkt aus, `nl2br` escapt nicht. Neue Kontextwerte, die HTML sein sollen (wie `org.logo` als Data-URL), dürfen keine Sonderzeichen enthalten oder müssen nach dem Escapen eingesetzt werden.
- **Beträge in Liquid** sind Strings: `"0.00" != 0` ist in keepsuit **wahr**. In Templates nur `> 0`/`< 0` vergleichen (Test in `BuiltInTemplatesTest`).
- **Gotenberg in Tests:** Die Feature-Suite erbt von `Tests\FeatureTestCase` (Gotenberg per `Tests\Support\GotenbergFake`, `Http::preventStrayRequests()`, Disks `archive` und `local` gefaked). `GotenbergFake::failWithError()`/`timeOut()`/`answerWithHtml()` schalten das Verhalten – darüber steuern, kein weiteres `Http::fake()` registrieren (bei mehreren passenden Stubs gewinnt der zuerst registrierte). Das Fake-PDF hängt vom Request ab – so lässt sich „nicht neu gerendert“ prüfen. Echte PDFs nur in `tests/Integration` (Gruppe `gotenberg`).
- **Sandbox für Templates (zwei Schichten):** jedes gerenderte Dokument beginnt mit einer CSP (`LiquidRenderer::CSP`: nichts laden außer `data:`, kein Skript), und Gotenberg läuft gehärtet (`--chromium-disable-javascript`, Deny-List für alles außer `file:`/`data:`, keine privaten/öffentlichen IPs) – in `.ddev/docker-compose.gotenberg.yaml` und als `docker run` in CI (Service-Container können kein `command`). `GotenbergTest` prüft beide Schichten. Renderzeit: `openbill.rendering.max_seconds` (5 s, `RenderLimits`/`RenderEnv::checkDeadline()`), Ausgabe wird gestreamt (Länge je Chunk geprüft).
- Gotenberg muss **≥ 8.34** sein (Factur-X-Felder). DDEV und CI nutzen `gotenberg/gotenberg:8`; `GotenbergTest` prüft die Version.
- `services.gotenberg.timeout` (20 s) muss deutlich unter `innodb_lock_wait_timeout` (50 s) bleiben, weil `FinalizeDocument` beim Rendern die Nummernkreis-Zeile sperrt (`ConfigTest`).
- horstoeko/zugferd hat globale statische Einstellungen (`ZugferdSettings`); `CiiBuilder` setzt die Nachkommastellen bei jedem Aufruf (Preise/Mengen 4, Beträge 2).
- Golden-Dateien (`tests/Feature/Rendering/golden/`) nur mit `UPDATE_GOLDEN=1` neu schreiben und den Diff ansehen; sie enthalten nur Beispieldaten.
- Die Migration `2026_10_11_100400` ruft `SyncBuiltInTemplates` auf (Action + Model). Ändert sich das `templates`-Schema, muss die Action mit allen bisherigen Migrationsständen laufen.
- VitePress wertet `{{ … }}` als Vue aus: Liquid-Beispiele in der Doku in `::: v-pre` setzen.
- **Leere Texte sind in Liquid wahr** (nur `nil`/`false` sind falsch): `{% if org.logo %}` ist bei `''` wahr. Templates prüfen Texte mit `!= blank` (`BuiltInTemplatesTest` prüft u. a., dass ohne Logo kein `<img src="">` entsteht).
- Chromium setzt Kopf-/Fußzeile in einen eigenen Flex-Container; ohne Hülle schrumpft das oberste Element auf seine Inhaltsbreite. `LiquidRenderer::bandShell()` legt deshalb ein seitenbreites `.openbill-band` um den Inhalt.
- `DemoSeeder` archiviert die abgeschlossenen Demo-Dokumente über Gotenberg: Gotenberg muss laufen (`ddev start`), sonst scheitert der Seeder mit `PdfRenderFailedException`.
- DDEV läuft mit Mutagen: Dateien, die im Container entstehen (Golden-Dateien, `composer.lock`, Beispiel-PDFs), sind auf dem Mac erst nach `ddev mutagen sync` (oder ein paar Sekunden) sichtbar.
- Liquid-Rechenfilter `plus`/`minus`/`times`/`divided_by`/`round` und `escape` sind in `OpenbillFilters` überschrieben (BigDecimal bzw. wie `escape_once`); `NoFloatTest` ignoriert nur den *deklarierten* Methodennamen `round`.
- Organisation hat das Kernfeld `registration_id` (BT-30). Prüfprofil `en16931`: USt-ID oder Registernummer (BR-CO-26), bei Regelbesteuerung und Reverse Charge/Drittland die USt-ID (BR-AE-02/BR-G-02; Kleinunternehmer = Kategorie E, Steuernummer reicht). E-Rechnungsfälle für das Schematron stehen in `tests/Feature/EInvoice/EInvoiceSamplesTest.php` (mit `EINVOICE_SAMPLES_DIR` schreibt der Test die XMLs; CI-Job `einvoice`, kein Pflicht-Check). Neue E-Rechnungs-Fälle dort ergänzen.
