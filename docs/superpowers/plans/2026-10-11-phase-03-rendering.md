# Phase 3: Rendering, PDF, E-Rechnung – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dokumente werden serverseitig mit Liquid gerendert (Kontext, Filter, Seitenplatzhalter, Limits, lesbare Fehler mit Bereich und Zeile), über Gotenberg zu PDF (bei EN 16931 als PDF/A-3b mit eingebetteter CII-XML) und beim Abschließen unveränderlich archiviert. Die Templates „Klar“, „Kante“ und „Leise“ sind mitgeliefert, Template-Pakete lassen sich als ZIP importieren und exportieren, Downloads liefern Archivdateien, und `RenderPreview` ist die fertige Schnittstelle für `POST /api/render` (Phase 4), die Editor-Vorschau (Phase 6/7) und das Toolkit (Phase 9).

**Architecture:** `app/Rendering` baut aus einem Dokument (gespeicherter Entwurf, ungespeicherter Entwurf über `DraftOverlay` oder Beispieldaten aus `SampleDataFactory`) und snapshot-förmigen Stammdaten den Liquid-Kontext (`ContextBuilder`), rendert Kopfzeile, Inhalt und Fußzeile als drei eigenständige HTML-Dokumente (`LiquidRenderer` auf keepsuit/liquid mit eigenen Filtern, `RenderResult`/`RenderError`) und schickt sie an Gotenberg (`GotenbergClient`). `app/EInvoice/CiiBuilder` erzeugt die EN-16931-XML mit horstoeko/zugferd und prüft sie gegen das XSD; Gotenberg (≥ 8.34) bettet sie als `factur-x.xml` in ein PDF/A-3b ein. `PdfDocumentArchiver` ersetzt den No-op-Haken aus Phase 2 und schreibt PDF/XML innerhalb der Transaktion von `FinalizeDocument` ins Archiv (`PdfArchive`: erst temporär, dann umbenennen, bei Rollback löschen). Neue Actions: `DocumentPdf`, `DocumentXml`, `RenderPreview`, `ImportTemplatePackage`, `ExportTemplatePackage`, `SyncBuiltInTemplates`.

**Tech Stack:** PHP 8.4, Laravel 13, MariaDB 11.4, keepsuit/liquid ^0.12 (0.12.1), gotenberg/gotenberg-php ^2.25, horstoeko/zugferd ^1.0.132, smalot/pdfparser (nur Tests), Gotenberg 8 (DDEV-Dienst und CI-Service, ≥ 8.34), brick/math, Pest 5, Larastan 6, Pint, VitePress.

**Spec:** `docs/superpowers/specs/2026-10-11-openbill-app-design.md` (bindend, v. a. Abschnitt 5), Master-Plan `docs/superpowers/plans/2026-10-11-openbill-app.md` (Abschnitt „Phase 3“, Review Focus 1–3), Interfaces aus Phase 2 in `docs/superpowers/plans/2026-10-11-phase-02-domain.md`. Vorlagen: `prototypes/clickdummy-v2/src/templates/` und `prototypes/clickdummy-v2/src/domain/{liquid,templateContext,paper,einvoice}.ts` samt Tests.

## Global Constraints

- Branch `phase-03-rendering` (ist ausgecheckt). Git-Identität kommt aus `~/.gitconfig`; vor dem ersten Commit `git config user.email` → muss `rafael@hauss.dev` sein, sonst stoppen und nachfragen. Nie `user.email`/`user.name` setzen.
- Jede Commit-Message endet mit der Zeile `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; die PR-Beschreibung endet mit `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- PHP, Composer, Artisan **nur in DDEV**: `ddev composer …`, `ddev artisan …`, `ddev exec …`. Auf dem Mac gibt es kein PHP. JS nur mit pnpm im Container, nie npm/npx.
- Vor jedem Commit `ddev exec vendor/bin/pint` (CI prüft mit `--test`). Code-Blöcke in diesem Plan sind inhaltlich verbindlich, Formatierung entscheidet Pint.
- Keine Geschäftslogik in Controllern, API-Processors, MCP-Tools; Abläufe nur in `app/Actions`, Rechnen nur in `app/Domain`. `app/Rendering` und `app/EInvoice` rufen keine Actions auf.
- Beträge nie als `float`: Strings im Kontext, `BigDecimal` beim Formatieren. Einzige Ausnahme ist `App\EInvoice\CiiAmount` (horstoeko verlangt `float`), mit Rundreise-Prüfung; `tests/Unit/NoFloatTest.php` sichert das ab.
- Abgeschlossene Dokumente sind unveränderlich; Downloads liefern immer die Archivdatei (SHA-256 geprüft), nie ein neues Rendering.
- UI-Texte und Meldungen nur über Schlüssel in `lang/en.json` und `lang/de.json` (gleiche Schlüssel, flach, alphabetisch sortiert, Platzhalter `:name`). Code und Kommentare Englisch.
- Doku: VitePress-Seiten in `docs/en/` **und** `docs/de/` im selben PR.
- Demo-Daten und Testbeispiele nur fiktiv (Studio Nordlicht, Hafenkontor Lindqvist, Fjord Analytics, Hotel Alpenglück, Kulturwerk Elbinsel; E-Mails `@example.com`/`.example`). Keine echten Firmen, Hosts oder Personen, auch nicht in Tests oder Golden-Dateien.
- CI: Pflicht-Job heißt `tests` und muss grün sein; Name nie ändern.
- `CLAUDE.md` wird in dieser Phase aktualisiert (Stand, Stack, Kommandos, Architektur, Fallstricke).

## Review Focus

- **Abschluss scheitert an Gotenberg (Master Review Focus 1):** Gotenberg antwortet mit Fehler oder Timeout → `PdfRenderFailedException` (503), das Dokument bleibt Entwurf, die Nummer bleibt frei, keine `document_files`-Zeile, keine Datei im Archiv (auch kein Rest unter `.tmp/`). Der Gotenberg-Timeout (`services.gotenberg.timeout`, 20 s) liegt mindestens 20 s unter `innodb_lock_wait_timeout`. → Task 11 (`FinalizeArchiveTest`).
- **Kaputtes Template (Master Review Focus 2):** Syntaxfehler, unbekannter Filter, Endlosschleife (verschachtelte Schleifen, riesiger Bereich), zu viel Ausgabe, zu großes Template, `{% render %}`, `</style>` im CSS, falsches Papierformat → `RenderResult.errors` mit Bereich (`header`/`body`/`footer`/`css`/`manifest`/`intro`/`closing`), Datei und Zeile, nie eine Exception und kein Hänger; beim Abschließen wird daraus `TemplateRenderFailedException` (422) und nichts wird gespeichert. Kundendaten mit `<`, `&` oder `"` erscheinen genau einmal escaped, auch in Einleitung/Schlusstext, die selbst Liquid enthalten. → Task 3, 4 und 11.
- **Stammdaten nach Abschluss geändert (Master Review Focus 3):** Kunde, Steuersatz, Template oder Felddefinition ändern sich nach dem Abschließen → `DocumentPdf` liefert byte-gleich die archivierte Datei, ohne Gotenberg aufzurufen; eine manipulierte Archivdatei fällt über SHA-256 auf. → Task 12 (`DownloadTest`).
- **Template-Pakete aus fremder Quelle:** Pfad-Traversal (`../`), absolute Pfade, unbekannte Dateien, ausführbare Assets, Zip-Bombe (entpackte Größe), ungültiges Manifest → `ValidationException` mit Pfad, nichts wird angelegt. → Task 7.
- **E-Rechnung:** Jede archivierte XML ist gegen das EN-16931-XSD gültig; Storno wird Gutschrift (TypeCode 381, positive Beträge, Bezug auf die Rechnung); Kleinunternehmer/Reverse Charge tragen Kategorie und Befreiungsgrund; die XML im PDF ist byte-gleich mit der archivierten. → Task 10 und 13.

## Entscheidungen (geprüft am 2026-10-11)

| Thema | Entscheidung | Grund / Prüfung |
|---|---|---|
| Liquid | `keepsuit/liquid` ^0.12 (0.12.1, PHP ^8.2, keine Konflikte mit Laravel 13 laut `composer require --dry-run`) | strikter Parser mit Zeilennummern (`LiquidException::$lineNumber`), `ResourceLimits`, eigene Filter über `FiltersProvider`, eigene Tags überschreibbar. 0.13 ist noch Beta. |
| Escaping | keepsuit hat kein Auto-Escape: `LiquidRenderer` escapt **alle Strings im Kontext genau einmal** vor dem Rendern; Einleitung/Schlusstext werden vorher auf den Rohdaten gerendert und dann mit escapt | wie im Klickdummy („genau einmal“). `nl2br` escapt deshalb nicht mehr; `escape` braucht kein Template. |
| Endlosschleifen | eigener `BoundedForTag` (Bereiche > 10 000 Einträge → Fehler, jede Iteration kostet einen Render-Punkt), `tablerow` entfernt, `render`/`include` ohne Dateisystem | in DDEV geprüft: `(1..100000000)` würde sonst vor jeder Grenze `range()` mit 10⁸ Einträgen anlegen; leere verschachtelte Schleifen zählen ohne den Punkt nicht. Mit beiden Maßnahmen bricht `9999×9999` nach < 0,1 s mit `ResourceLimitException` ab. |
| Vergleiche | Beträge im Kontext sind Strings (`"0.00"`); keepsuit vergleicht `"0.00" != 0` als **wahr** (`0.0 === 0` schlägt fehl), `> 0` funktioniert | in DDEV geprüft. Templates und Doku nutzen `> 0`, nie `== 0`/`!= 0` für Beträge. |
| PDF | `gotenberg/gotenberg-php` ^2.25 baut den Multipart-Request (Chromium HTML, `header.html`/`footer.html`, Papier, Ränder, `printBackground`, `pdfa`, `facturX`); gesendet wird er über Laravels `Http` mit Timeout | so greifen `Http::fake()` in Tests und Laravels Timeout/ConnectionException. |
| PDF/A-3 + XML | **Gotenberg bettet die XML selbst ein** (`pdfa=PDF/A-3b` + `facturxXml`, seit Gotenberg 8.34) statt `horstoeko`-PDF-Merger (`PdfA3Embedder` aus Spec/Master-Plan entfällt) | in DDEV (Gotenberg 8.37.0) geprüft: Metadaten `Part 3`, `Conformance B`, `DocumentFileName factur-x.xml`, `ConformanceLevel EN 16931`; `ZugferdDocumentPdfReader::getXmlFromContent()` liefert die XML byte-gleich zurück; Seitenzahlen der Fußzeile bleiben erhalten. Der Merger würde die Chromium-Seiten per FPDI neu zusammensetzen und echte PDF/A-Konvertierung (LibreOffice in Gotenberg) umgehen. |
| XML | `horstoeko/zugferd` ^1.0.132 (`ZugferdDocumentBuilder`, Profil EN 16931, XSD aus dem Paket) | in DDEV geprüft: Builder + `ZugferdXsdValidator` ohne Fehler; Einzelpreis mit 4 Nachkommastellen und Menge mit 4 Nachkommastellen nur mit `ZugferdSettings::setUnitAmountDecimals(4)`/`setQuantityDecimals(4)`. Die API nimmt `float`: Umwandlung nur in `CiiAmount` mit Rundreise-Prüfung (`DECIMAL(15,4)` hat ≤ 15 signifikante Stellen, also verlustfrei). |
| KoSIT-Validator | **nicht in dieser Phase**; XSD-Prüfung in Pest und vor jedem Archivieren | Die KoSIT-Konfiguration prüft XRechnung-Szenarien; reines EN 16931 (CII, ohne Leitweg-ID) hätte dort kein passendes Szenario. Optionaler Job bleibt für Phase 11 notiert. |
| Archiv | Disk `archive` (`storage/app/archive`), Pfad `{yyyy}/{document_id}.pdf` bzw. `.xml`; Datei erst nach `.tmp/` schreiben, **innerhalb** der Transaktion atomar umbenennen, `DB::afterRollBack()` löscht sie wieder | Umbenennen nach dem Commit hätte ein Fenster, in dem ein abgeschlossenes (unveränderliches) Dokument auf eine fehlende Datei zeigt; eine verwaiste Datei nach einem Absturz ist harmlos und wird beim nächsten Versuch überschrieben. `DocumentArchiver`-Docblock wird angepasst. |
| Vokabular | Filter `t` liest `translations.<locale>.<key>` aus dem Manifest, sonst `template.<key>` aus `lang/*.json` (Dokumentsprache), sonst den Schlüssel | Die Klickdummy-Templates sind deutsch fest verdrahtet; mitgelieferte Templates müssen en/de können. |
| Mitgelieferte Templates | Quellen in `resources/templates/{klar,kante,leise}/` im Paketformat; `SyncBuiltInTemplates` (Action) legt sie an/aktualisiert sie; Migration `2026_10_11_100400` ruft sie auf, ebenso `DemoSeeder` und später der Docker-Entrypoint (`app:sync-templates`) | Grunddaten kommen in diesem Projekt aus Migrationen; Tests haben die Templates dadurch automatisch. |
| Entwurfs-PDF | live gerendert, nicht archiviert, nicht PDF/A, mit „ENTWURF“/„DRAFT“-Wasserzeichen | Spec Abschnitt 5 („Entwürfe als PDF mit ‚Entwurf‘“). |
| Entwurfs-XML | `DocumentXml` nur für abgeschlossene E-Rechnungen (sonst 409 `no_e_invoice`) | Ohne Nummer gibt es keine gültige Rechnung; Phase 6 zeigt die XML erst nach dem Abschluss. |
| Golden-Tests | HTML-Ausgabe der drei Templates mit Beispieldaten in `tests/Feature/Rendering/golden/`, erzeugt mit `UPDATE_GOLDEN=1` | Beispieldaten sind deterministisch (feste Daten, feste Steuersätze/Einheiten). |

---

## Dateistruktur nach Phase 3

```
app/
├─ Actions/
│  ├─ DocumentPdf.php, DocumentXml.php                Downloads (Entwurf live, abgeschlossen aus dem Archiv)
│  ├─ RenderPreview.php                               Vorschau für POST /api/render (Phase 4), Editor (6/7), Toolkit (9)
│  ├─ ImportTemplatePackage.php, ExportTemplatePackage.php, SyncBuiltInTemplates.php
│  └─ UpdateDraft.php                                 nutzt jetzt App\Support\DraftInput
├─ Console/Commands/SyncTemplates.php                 app:sync-templates
├─ Console/Commands/RenderSample.php                  app:render-sample (PDF mit Beispieldaten zum Anschauen)
├─ EInvoice/CiiBuilder.php, EInvoice/CiiAmount.php
├─ Enums/RenderPart.php, Enums/RenderScenario.php
├─ Exceptions/TemplateRenderFailedException.php (422), PdfRenderFailedException.php (503),
│             EInvoiceInvalidException.php (422), ArchiveCorruptedException.php (500)
├─ Rendering/
│  ├─ RenderResult.php, RenderError.php, RenderOptions.php, Paper.php, TemplateSource.php, TemplateContext.php
│  ├─ PreviewResult.php, RenderedDocument.php, SampleData.php, Amounts.php, NumberText.php
│  ├─ Liquid/{LiquidEnvironment,OpenbillFilters,BoundedForTag,RenderEnv}.php
│  ├─ LiquidRenderer.php, AssetInliner.php, ContextBuilder.php, SampleDataFactory.php
│  ├─ TemplatePackage.php, ManifestValidator.php
│  ├─ GotenbergClient.php, PdfArchive.php, DocumentRenderer.php, PdfDocumentArchiver.php
├─ Support/DraftInput.php, DraftOverlay.php, TemplateResolver.php, DownloadFile.php, IssueList.php
config/filesystems.php (Disk archive), config/services.php (gotenberg.timeout), config/openbill.php (rendering, templates)
database/migrations/2026_10_11_100400_insert_built_in_templates.php
database/seeders/DemoSeeder.php                       echte Templates, archiviert abgeschlossene Demo-Dokumente
resources/templates/{klar,kante,leise}/{manifest.json,header.liquid,template.liquid,footer.liquid,styles.css}
lang/{en,de}.json                                     document_type.*, template.*, rendering.*, template_package.*, einvoice.*
tests/
├─ FeatureTestCase.php, Support/GotenbergFake.php     Feature-Suite: Gotenberg gefaked, Disks archive/local gefaked
├─ Feature/Rendering/{PaperTest,FiltersTest,LiquidRendererTest,ContextBuilderTest,SampleDataFactoryTest,
│                     TemplatePackageTest,BuiltInTemplatesTest,GoldenTest,GotenbergClientTest,RenderPreviewTest}.php
├─ Feature/Rendering/golden/*.html
├─ Feature/EInvoice/CiiBuilderTest.php
├─ Feature/Actions/{FinalizeArchiveTest,DownloadTest}.php
├─ Integration/GotenbergTest.php                     echtes Gotenberg (DDEV-Dienst, CI-Service), Gruppe gotenberg
└─ Unit/{ArchTest,NoFloatTest,EnumsTest}.php (erweitert)
docs/{en,de}/templates.md, docs/{en,de}/e-invoice.md, docs/.vitepress/config.ts, CLAUDE.md, .github/workflows/tests.yml
```

## Interfaces (verbindlich für Phase 4, 6, 7, 8 und 9)

**Render-Ergebnis** (`App\Rendering`, alle `final readonly`):

- `RenderResult{header: string, body: string, footer: string, paper: Paper, errors: list<RenderError>}`, `ok(): bool`, `toArray()` →
  `{header, body, footer, paper: {format, marginX, headerHeight, footerHeight}, errors: [{part, file, line, message}]}`.
  `header`/`body`/`footer` sind je ein vollständiges HTML-Dokument (wie Gotenberg sie bekommt); `body` hat die Breite des Inhaltsbereichs (`paper`), Kopf-/Fußzeile die Seitenbreite und ihre Höhe. Seitenzahlen stehen als `<span class="pageNumber"></span>`/`<span class="totalPages"></span>` in Kopf-/Fußzeile (Chromium füllt sie, `packages/paged-preview` in Phase 6 ebenfalls).
- `RenderError{part: App\Enums\RenderPart, line: ?int, message: string}`, `toArray()` → `{part, file, line, message}`; `part` ∈ `header|body|footer|css|manifest|intro|closing`, `file` = `RenderPart::file()` (`header.liquid`, `template.liquid`, `footer.liquid`, `styles.css`, `manifest.json`, `null` für intro/closing) – das Toolkit-Overlay (Phase 9) zeigt Datei und Zeile.
- `Paper{format: 'A4'|'Letter', marginX, headerHeight, footerHeight}` (CSS-Längen wie im Manifest), `toArray()` in Manifest-Form (camelCase).
- `LiquidRenderer::render(TemplateSource $template, array $context, RenderOptions $options = new RenderOptions): RenderResult` wirft nie wegen des Templates.

**Vorschau** – `App\Actions\RenderPreview::handle(Actor $actor, array $input): PreviewResult`:

```
template_id?: string                      gespeichertes Template (sonst: Template des Dokuments bzw. Standard)
template?: {header?, body?, footer?, css?, manifest?}   ungespeicherte Teile, überschreiben template_id (dessen Assets bleiben)
document_id: string                       Pflicht ohne scenario; Entwurf → aktuelle Stammdaten, abgeschlossen → Snapshot
draft?: { …wie UpdateDraft… }             ungespeicherter Stand eines Entwurfs (nur mit document_id; abgeschlossen → DocumentLockedException)
scenario: short_invoice|long_invoice|small_business|reverse_charge|offer_with_options   Pflicht ohne document_id
locale?: en|de                            nur für scenario (sonst Dokumentsprache)
```

`PreviewResult::toArray()` = Antwort von `POST /api/render`: `{header, body, footer, paper, errors, totals, issues}` mit `totals` = `Totals::toArray()` und `issues` = `[{path, message}]` (leer bei abgeschlossenen Dokumenten und Szenarien). Template-Fehler stehen in `errors` (HTTP 200); `ValidationException` (422, Pfade bei `draft` mit Präfix `draft.`) und `DocumentLockedException` (409) sind die einzigen Exceptions. Die Szenarien liefert `App\Enums\RenderScenario::cases()` (für `GET /api/render/sources`), die Feldliste für `GET /api/render/schema` bleibt `FieldRegistry::CORE` + Felddefinitionen (Phase 4).

**Downloads** – `App\Actions\DocumentPdf::handle(Actor, Document): DownloadFile`, `App\Actions\DocumentXml::handle(Actor, Document): DownloadFile`; `App\Support\DownloadFile{filename, mimeType, contents}`. Abgeschlossen: Archivdatei (SHA-256 geprüft, sonst `ArchiveCorruptedException`), Entwurf (nur PDF): live mit Wasserzeichen. `DocumentXml` ohne archivierte XML → `ActionNotAllowedException` mit `reason = no_e_invoice` (409). Phase 4 nutzt beides für `GET /api/documents/{id}/pdf|xml` und die signierten URLs.

**Templates** – `ImportTemplatePackage::handle(Actor, string $zipPath): Template` (`ValidationException` mit Pfaden `package`, `manifest.<feld>`, `assets.<pfad>`), `ExportTemplatePackage::handle(Actor, Template): DownloadFile` (ZIP), `SyncBuiltInTemplates::handle(Actor): array<slug, Template>` (idempotent; Kommando `app:sync-templates` für den Docker-Entrypoint in Phase 10). Paketformat und Dateinamen: `TemplatePackage::FILES` (`header` → `header.liquid`, `body` → `template.liquid`, `footer` → `footer.liquid`, `css` → `styles.css`) + `manifest.json` + `assets/…` – `PUT /api/templates/{id}/files` (Phase 4) und `pnpm push/pull/pack` (Phase 9) verwenden genau diese Namen.

**Abschließen** – `App\Rendering\PdfDocumentArchiver` ist an `App\Contracts\DocumentArchiver` gebunden. `FinalizeDocument` wirft zusätzlich `TemplateRenderFailedException` (422, `toArray()` = Fehlerliste), `EInvoiceInvalidException` (422, `errors: list<string>`) und `PdfRenderFailedException` (503). Alle rollen vollständig zurück.

**Exceptions** (`App\Exceptions`): neue `DomainActionException`s mit `status()` wie oben; `ArchiveCorruptedException extends RuntimeException` (kein Domain-Fehler, Phase 4 antwortet 500).

**Kontext für Templates** (Liquid, Phase 7 Feldleiste, Phase 9 Feldliste) – Schlüssel je Ebene, alle in `FieldRegistry::CORE`/reserviert:

```
org:       name street zip city country logo(Data-URL|'') vat_id tax_number iban bic bank_name email phone website taxation_mode small_business locale + eigene Felder
customer:  null | number name street zip city country email vat_id tax_treatment locale + eigene Felder
contact:   null | salutation first_name last_name full_name position email phone + eigene Felder
document:  type type_label status number(Entwurf: "Draft"/"Entwurf") date due_date valid_until service_date service_date_end locale intro closing
           net_total tax_total gross_total optional_total tax_breakdown[{category percent net tax gross}] legal_notes[] source_number + eigene Felder
groups[]:  title has_title total optional_total positions[]
positions[]: index(null bei Text) kind is_item is_text is_optional title description quantity unit unit_name unit_code unit_price tax_percent total group + eigene Felder
page:      number total   (nur Kopf-/Fußzeile)
```

Beträge sind Strings mit Punkt (`"1130.50"`), Datumswerte `YYYY-MM-DD`, alle Strings sind bereits HTML-escaped.

---
### Task 1: Pakete, Konfiguration und Test-Grundgerüst (Gotenberg-Fake)

**Files:**
- Modify: `composer.json`, `composer.lock` (über `ddev composer`)
- Modify: `config/services.php`, `config/filesystems.php`, `config/openbill.php`, `.env.example`
- Create: `tests/FeatureTestCase.php`, `tests/Support/GotenbergFake.php`
- Modify: `tests/Pest.php`
- Test: `tests/Feature/Rendering/ConfigTest.php`

**Interfaces:**
- Consumes: –
- Produces: `config('services.gotenberg.timeout')` (int, 20), Disk `archive`, `config('openbill.rendering.{max_source_bytes,max_output_bytes,max_render_score,max_assign_score,max_range}')`, `config('openbill.templates.{max_package_bytes,max_unpacked_bytes,max_entries,max_asset_bytes}')`, `Tests\FeatureTestCase` (Feature-Suite), `Tests\Support\GotenbergFake::{install(), succeed(), failWithError(), timeOut(), answerWithHtml(), pdfFor(string): string}`

- [ ] **Step 1: Identität prüfen**

```bash
git config user.email
```
Erwartet: `rafael@hauss.dev`. Sonst stoppen und nachfragen.

- [ ] **Step 2: Pakete installieren**

```bash
ddev composer require keepsuit/liquid:^0.12 gotenberg/gotenberg-php:^2.25 horstoeko/zugferd:^1.0.132
ddev composer require --dev smalot/pdfparser:^2.12
```
Erwartet: u. a. `Locking keepsuit/liquid (v0.12.1)`, `gotenberg/gotenberg-php (v2.25.0)`, `horstoeko/zugferd (v1.0.132)`, keine Konflikte. Falls `php-http/discovery` nach einer Plugin-Freigabe fragt: `composer.json` erlaubt sie bereits (`allow-plugins`).

Verifizieren, dass die DDEV-Gotenberg-Version Factur-X kann (≥ 8.34):

```bash
ddev exec curl -s http://gotenberg:3000/version
```
Erwartet: `8.34.0` oder höher (am 2026-10-11: `8.37.0`). Ist sie älter: `ddev restart` mit `docker pull gotenberg/gotenberg:8`.

- [ ] **Step 3: Failing test für die Konfiguration schreiben**

`tests/Feature/Rendering/ConfigTest.php`:

```php
<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\Support\GotenbergFake;

it('keeps the Gotenberg timeout well below the InnoDB lock wait timeout', function () {
    // finalize holds the number_sequences row lock while Gotenberg renders: waiting finalizes must not time out first
    $lockWait = (int) DB::selectOne('SELECT @@innodb_lock_wait_timeout AS t')->t;

    expect(config('services.gotenberg.timeout'))->toBeInt()->toBeGreaterThan(0)
        ->and(config('services.gotenberg.timeout'))->toBeLessThanOrEqual($lockWait - 20);
});

it('has an archive disk below storage/app/archive that throws on errors', function () {
    expect(config('filesystems.disks.archive.root'))->toBe(storage_path('app/archive'))
        ->and(config('filesystems.disks.archive.throw'))->toBeTrue();
});

it('fakes Gotenberg in feature tests and refuses any other HTTP request', function () {
    $pdf = Http::post('http://gotenberg:3000/forms/chromium/convert/html')->body();

    expect($pdf)->toStartWith('%PDF-')
        ->and(fn () => Http::get('https://example.com'))->toThrow(RuntimeException::class);

    GotenbergFake::failWithError();
    expect(Http::post('http://gotenberg:3000/forms/chromium/convert/html')->status())->toBe(500);
});
```

- [ ] **Step 4: Test laufen lassen, Fehlschlag prüfen**

```bash
ddev artisan test --filter=ConfigTest
```
Erwartet: FAIL (`config('services.gotenberg.timeout')` ist `null`, `Class "Tests\Support\GotenbergFake" not found`).

- [ ] **Step 5: Konfiguration ergänzen**

`config/services.php` – Eintrag `gotenberg` ersetzen:

```php
    'gotenberg' => [
        'url' => env('GOTENBERG_URL', 'http://gotenberg:3000'),
        // seconds; FinalizeDocument holds the number_sequences row lock while Gotenberg renders, so this must stay
        // well below innodb_lock_wait_timeout (50 s) or waiting finalizes fail with a lock wait timeout
        'timeout' => (int) env('GOTENBERG_TIMEOUT', 20),
    ],
```

`config/filesystems.php` – unter `disks` nach `public` einfügen:

```php
        // archived PDF/XML of finalized documents (storage/app/archive/{yyyy}/{document_id}.pdf|xml), never changed
        'archive' => [
            'driver' => 'local',
            'root' => storage_path('app/archive'),
            'throw' => true,
            'report' => false,
        ],
```

`config/openbill.php` – nach `admin` ergänzen:

```php
    /*
    | Limits for Liquid templates (see docs/en/templates.md, "Limits and errors").
    */
    'rendering' => [
        'max_source_bytes' => 200 * 1024,     // per part: header, body, footer, styles
        'max_output_bytes' => 5 * 1024 * 1024, // rendered HTML per part
        'max_render_score' => 200_000,        // Liquid nodes and loop iterations per part
        'max_assign_score' => 50_000,         // assign/capture work per part
        'max_range' => 10_000,                // items in a range like (1..n)
    ],

    /*
    | Template packages (ZIP import).
    */
    'templates' => [
        'max_package_bytes' => 10 * 1024 * 1024,
        'max_unpacked_bytes' => 20 * 1024 * 1024,
        'max_entries' => 100,
        'max_asset_bytes' => 2 * 1024 * 1024,
    ],
```

`.env.example` – unter `GOTENBERG_URL=http://gotenberg:3000` ergänzen:

```
GOTENBERG_TIMEOUT=20
```

- [ ] **Step 6: Gotenberg-Fake und Feature-Basisklasse**

`tests/Support/GotenbergFake.php`:

```php
<?php

namespace Tests\Support;

use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

/**
 * Gotenberg for feature tests. The fake PDF depends on the request body, so a second rendering of
 * changed data gives different bytes (tests can tell an archived file from a fresh render).
 * Integration tests (tests/Integration) talk to the real service instead.
 */
final class GotenbergFake
{
    private static string $mode = 'ok';

    public static function install(): void
    {
        self::$mode = 'ok';
        Http::preventStrayRequests();
        Http::fake(function (Request $request) {
            if (! str_contains($request->url(), '/forms/chromium/convert/html')) {
                return null; // stray request → exception
            }

            return match (self::$mode) {
                'error' => Http::response('Chromium failed to convert the page', 500),
                'html' => Http::response('<html>proxy error page</html>', 200),
                'timeout' => Http::failedConnection('cURL error 28: Operation timed out after 20001 milliseconds')($request),
                default => Http::response(self::pdfFor($request->body()), 200, ['Content-Type' => 'application/pdf']),
            };
        });
    }

    public static function pdfFor(string $requestBody): string
    {
        return "%PDF-1.7\n% fake ".md5($requestBody)."\n%%EOF\n";
    }

    public static function failWithError(): void
    {
        self::$mode = 'error';
    }

    public static function timeOut(): void
    {
        self::$mode = 'timeout';
    }

    /** 200 with something that is no PDF (e.g. a proxy page). */
    public static function answerWithHtml(): void
    {
        self::$mode = 'html';
    }

    public static function succeed(): void
    {
        self::$mode = 'ok';
    }
}
```

`tests/FeatureTestCase.php`:

```php
<?php

namespace Tests;

use Illuminate\Support\Facades\Storage;
use Tests\Support\GotenbergFake;

/** Feature suite: no real files, no real Gotenberg. */
abstract class FeatureTestCase extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('archive');
        Storage::fake('local');
        GotenbergFake::install();
    }
}
```

`tests/Pest.php` – die Feature-Zeile ersetzen und den Import ergänzen:

```php
use Tests\FeatureTestCase;
```

```php
pest()->extend(FeatureTestCase::class)->use(RefreshDatabase::class)->in('Feature');
```

(Der Kommentar darüber bekommt den Zusatz: „Gotenberg is faked and the archive/local disks are fake disks (`Tests\FeatureTestCase`).“)

- [ ] **Step 7: Tests laufen lassen**

```bash
ddev artisan test --filter=ConfigTest
```
Erwartet: PASS (3 Tests). Falls der Stray-Request-Test eine andere Klasse als `RuntimeException` wirft (Laravel 13: `Illuminate\Http\Client\StrayRequestException extends RuntimeException`): die konkrete Klasse in den Test schreiben.

```bash
ddev artisan test
```
Erwartet: alle bisherigen Tests grün (Phase-2-Tests rufen Gotenberg noch nicht auf).

- [ ] **Step 8: Commit**

```bash
ddev exec vendor/bin/pint
git add composer.json composer.lock config/services.php config/filesystems.php config/openbill.php .env.example tests/FeatureTestCase.php tests/Support/GotenbergFake.php tests/Pest.php tests/Feature/Rendering/ConfigTest.php
git commit -m "$(cat <<'EOF'
chore(rendering): add liquid, gotenberg and zugferd packages, archive disk and gotenberg fake

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Render-Bausteine – RenderPart, RenderError, RenderResult, Paper, TemplateSource

**Files:**
- Create: `app/Enums/RenderPart.php`
- Create: `app/Rendering/RenderError.php`, `app/Rendering/RenderResult.php`, `app/Rendering/RenderOptions.php`, `app/Rendering/Paper.php`, `app/Rendering/TemplateSource.php`
- Modify: `lang/en.json`, `lang/de.json`
- Modify: `tests/Unit/EnumsTest.php`
- Test: `tests/Feature/Rendering/PaperTest.php`

**Interfaces:**
- Consumes: `App\Support\Text::t()`, `App\Models\Template`/`TemplateAsset`
- Produces: `App\Enums\RenderPart` (+ `file(): ?string`), `RenderError(RenderPart $part, ?int $line, string $message)`, `RenderResult(string $header, string $body, string $footer, Paper $paper, list<RenderError> $errors = [])` mit `ok()`, `toArray()`, `RenderOptions(string $locale = 'en', ?string $draftMark = null)`, `Paper` (`FORMATS`, `DEFAULT`, `fromManifest(array): self`, `errors(mixed): array<string,string>`, `lengthToPx(string): BigDecimal`, `size(): array{0,1}`, `pageWidthPx()`, `contentWidthPx()`, `headerHeightPx()`, `footerHeightPx()`, `toArray()`), `TemplateSource(header, body, footer, css, array $manifest = [], array $assets = [])` mit `fromModel(Template)`, `fromSnapshot(array)`, `with(array)`

- [ ] **Step 1: Failing tests schreiben**

`tests/Unit/EnumsTest.php` – Import `use App\Enums\RenderPart;` ergänzen und im Dataset hinzufügen:

```php
    'render parts' => [RenderPart::class, ['header', 'body', 'footer', 'css', 'manifest', 'intro', 'closing']],
```

`tests/Feature/Rendering/PaperTest.php`:

```php
<?php

use App\Enums\RenderPart;
use App\Models\Template;
use App\Models\TemplateAsset;
use App\Rendering\Paper;
use App\Rendering\RenderError;
use App\Rendering\RenderResult;
use App\Rendering\TemplateSource;
use Illuminate\Support\Facades\Storage;

it('converts print lengths to CSS pixels at 96 dpi without floats', function () {
    expect((string) Paper::lengthToPx('25.4mm'))->toBe('96.00')
        ->and((string) Paper::lengthToPx('1in'))->toBe('96.00')
        ->and((string) Paper::lengthToPx('2.54cm'))->toBe('96.00')
        ->and((string) Paper::lengthToPx('72pt'))->toBe('96.00')
        ->and((string) Paper::lengthToPx('10px'))->toBe('10.00')
        ->and((string) Paper::lengthToPx('nonsense'))->toBe('0.00');
});

it('derives the page geometry like Chromium (header and footer are the top and bottom margins)', function () {
    $paper = new Paper('A4', '20mm', '30mm', '28mm');

    expect((string) $paper->pageWidthPx())->toBe('793.70')
        ->and((string) $paper->contentWidthPx())->toBe('642.52')
        ->and((string) $paper->headerHeightPx())->toBe('113.39')
        ->and((string) $paper->footerHeightPx())->toBe('105.83')
        ->and($paper->size())->toBe(['210mm', '297mm'])
        ->and((new Paper('Letter', '1in', '1in', '1in'))->size())->toBe(['8.5in', '11in']);
});

it('reads the paper from the manifest and falls back to defaults for missing or invalid values', function () {
    expect(Paper::fromManifest([])->toArray())->toBe(['format' => 'A4', 'marginX' => '20mm', 'headerHeight' => '30mm', 'footerHeight' => '20mm'])
        ->and(Paper::fromManifest(['paper' => ['format' => 'Letter', 'marginX' => '16mm']])->toArray())
        ->toBe(['format' => 'Letter', 'marginX' => '16mm', 'headerHeight' => '30mm', 'footerHeight' => '20mm'])
        ->and(Paper::fromManifest(['paper' => ['format' => 'A3', 'marginX' => 'wide']])->toArray())
        ->toBe(Paper::DEFAULT);
});

it('reports invalid paper settings with their path', function () {
    expect(Paper::errors(null))->toBe([])
        ->and(Paper::errors(['format' => 'A4', 'marginX' => '20mm']))->toBe([])
        ->and(array_keys(Paper::errors(['format' => 'A3', 'headerHeight' => '3 cm', 'footerHeight' => 12])))
        ->toBe(['paper.format', 'paper.headerHeight', 'paper.footerHeight'])
        ->and(array_keys(Paper::errors('A4')))->toBe(['paper']);
});

it('serializes render results and errors for the API (file and line for the toolkit)', function () {
    $result = new RenderResult('<h>', '<b>', '<f>', Paper::fromManifest([]), [new RenderError(RenderPart::Body, 3, 'Unknown tag')]);

    expect($result->ok())->toBeFalse()
        ->and($result->toArray())->toBe([
            'header' => '<h>',
            'body' => '<b>',
            'footer' => '<f>',
            'paper' => Paper::DEFAULT,
            'errors' => [['part' => 'body', 'file' => 'template.liquid', 'line' => 3, 'message' => 'Unknown tag']],
        ])
        ->and(RenderPart::Intro->file())->toBeNull();
});

it('builds a template source from a model with its assets and from a snapshot row', function () {
    $template = Template::factory()->create(['header' => 'H', 'body' => 'B', 'footer' => 'F', 'css' => 'C', 'manifest' => ['name' => 'X']]);
    Storage::disk('local')->put("templates/{$template->id}/assets/logo.svg", '<svg/>');
    TemplateAsset::query()->create(['template_id' => $template->id, 'path' => 'assets/logo.svg', 'mime' => 'image/svg+xml', 'storage_path' => "templates/{$template->id}/assets/logo.svg", 'size' => 6]);

    $source = TemplateSource::fromModel($template->fresh());
    $snapshot = TemplateSource::fromSnapshot(['id' => $template->id, 'header' => 'h1', 'body' => 'b1', 'footer' => null, 'css' => 'c1', 'manifest' => ['paper' => ['format' => 'Letter']]]);

    expect([$source->header, $source->body, $source->footer, $source->css, $source->manifest])->toBe(['H', 'B', 'F', 'C', ['name' => 'X']])
        ->and($source->assets)->toBe(['assets/logo.svg' => ['mime' => 'image/svg+xml', 'contents' => '<svg/>']])
        ->and([$snapshot->header, $snapshot->body, $snapshot->footer])->toBe(['h1', 'b1', ''])
        ->and($snapshot->assets)->toHaveKey('assets/logo.svg')
        ->and($source->with(['body' => 'new', 'manifest' => ['name' => 'Y']])->body)->toBe('new')
        ->and($source->with(['body' => 'new'])->assets)->toBe($source->assets)
        ->and(TemplateSource::fromSnapshot([])->body)->toBe('');
});
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

```bash
ddev artisan test --filter='PaperTest|EnumsTest'
```
Erwartet: FAIL (`Class "App\Enums\RenderPart" not found`).

- [ ] **Step 3: Enum und Wertobjekte implementieren**

`app/Enums/RenderPart.php`:

```php
<?php

namespace App\Enums;

/** Where a template error happened: a template part, its manifest, or the document's intro/closing text. */
enum RenderPart: string
{
    case Header = 'header';
    case Body = 'body';
    case Footer = 'footer';
    case Css = 'css';
    case Manifest = 'manifest';
    case Intro = 'intro';
    case Closing = 'closing';

    /** File of a template package (toolkit error overlay); intro and closing come from the document. */
    public function file(): ?string
    {
        return match ($this) {
            self::Header => 'header.liquid',
            self::Body => 'template.liquid',
            self::Footer => 'footer.liquid',
            self::Css => 'styles.css',
            self::Manifest => 'manifest.json',
            self::Intro, self::Closing => null,
        };
    }
}
```

`app/Rendering/RenderError.php`:

```php
<?php

namespace App\Rendering;

use App\Enums\RenderPart;

final readonly class RenderError
{
    public function __construct(
        public RenderPart $part,
        public ?int $line,
        public string $message,
    ) {}

    /**
     * @return array{part: string, file: string|null, line: int|null, message: string}
     */
    public function toArray(): array
    {
        return ['part' => $this->part->value, 'file' => $this->part->file(), 'line' => $this->line, 'message' => $this->message];
    }
}
```

`app/Rendering/RenderResult.php`:

```php
<?php

namespace App\Rendering;

/**
 * Header, body and footer as three standalone HTML documents (what Gotenberg receives),
 * the paper they were laid out for, and every template problem.
 */
final readonly class RenderResult
{
    /**
     * @param  list<RenderError>  $errors
     */
    public function __construct(
        public string $header,
        public string $body,
        public string $footer,
        public Paper $paper,
        public array $errors = [],
    ) {}

    public function ok(): bool
    {
        return $this->errors === [];
    }

    /**
     * @return array{header: string, body: string, footer: string, paper: array<string, string>, errors: list<array{part: string, file: string|null, line: int|null, message: string}>}
     */
    public function toArray(): array
    {
        return [
            'header' => $this->header,
            'body' => $this->body,
            'footer' => $this->footer,
            'paper' => $this->paper->toArray(),
            'errors' => array_map(fn (RenderError $error): array => $error->toArray(), $this->errors),
        ];
    }
}
```

`app/Rendering/RenderOptions.php`:

```php
<?php

namespace App\Rendering;

final readonly class RenderOptions
{
    /**
     * @param  string  $locale  document language: filters (money, date, number, t) format in it
     * @param  string|null  $draftMark  watermark text on every page (draft PDFs), null for none
     */
    public function __construct(
        public string $locale = 'en',
        public ?string $draftMark = null,
    ) {}
}
```

`app/Rendering/Paper.php`:

```php
<?php

namespace App\Rendering;

use App\Support\Text;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;

/**
 * Page layout from the manifest ("paper"): like Gotenberg/Chromium, the header lives in the top margin,
 * the footer in the bottom margin, the body in between. Lengths are CSS lengths ("20mm").
 */
final readonly class Paper
{
    /** @var array<string, array{0: string, 1: string}> */
    public const FORMATS = ['A4' => ['210mm', '297mm'], 'Letter' => ['8.5in', '11in']];

    /** @var array{format: string, marginX: string, headerHeight: string, footerHeight: string} */
    public const DEFAULT = ['format' => 'A4', 'marginX' => '20mm', 'headerHeight' => '30mm', 'footerHeight' => '20mm'];

    private const LENGTH = '/^(\d+(?:\.\d+)?)(mm|cm|in|pt|px)$/';

    public function __construct(
        public string $format,
        public string $marginX,
        public string $headerHeight,
        public string $footerHeight,
    ) {}

    /**
     * Lenient: invalid or missing values fall back to the defaults (errors() reports them).
     *
     * @param  array<string, mixed>  $manifest
     */
    public static function fromManifest(array $manifest): self
    {
        $paper = is_array($manifest['paper'] ?? null) ? $manifest['paper'] : [];
        $invalid = self::errors($paper);
        $pick = fn (string $key): string => ! isset($invalid["paper.{$key}"]) && is_string($paper[$key] ?? null)
            ? $paper[$key]
            : self::DEFAULT[$key];

        return new self($pick('format'), $pick('marginX'), $pick('headerHeight'), $pick('footerHeight'));
    }

    /**
     * Problems of a manifest's "paper" value by path (paper.format, paper.marginX, …); null = not set = fine.
     *
     * @return array<string, string>
     */
    public static function errors(mixed $paper): array
    {
        if ($paper === null) {
            return [];
        }
        if (! is_array($paper)) {
            return ['paper' => Text::t('template_package.paper_invalid')];
        }

        $errors = [];
        if (isset($paper['format']) && (! is_string($paper['format']) || ! array_key_exists($paper['format'], self::FORMATS))) {
            $errors['paper.format'] = Text::t('template_package.paper_format', ['formats' => implode(', ', array_keys(self::FORMATS))]);
        }
        foreach (['marginX', 'headerHeight', 'footerHeight'] as $key) {
            if (isset($paper[$key]) && (! is_string($paper[$key]) || preg_match(self::LENGTH, $paper[$key]) !== 1)) {
                $errors["paper.{$key}"] = Text::t('template_package.paper_length', ['key' => $key]);
            }
        }

        return $errors;
    }

    /** CSS pixels at 96 dpi, two decimals (what Chromium uses for print layout). */
    public static function lengthToPx(string $length): BigDecimal
    {
        if (preg_match(self::LENGTH, $length, $m) !== 1) {
            return BigDecimal::zero()->toScale(2);
        }
        [$numerator, $denominator] = match ($m[2]) {
            'mm' => ['96', '25.4'],
            'cm' => ['96', '2.54'],
            'in' => ['96', '1'],
            'pt' => ['96', '72'],
            default => ['1', '1'],
        };

        return BigDecimal::of($m[1])->multipliedBy($numerator)->dividedBy($denominator, 2, RoundingMode::HalfUp);
    }

    /** @return array{0: string, 1: string} width, height for Gotenberg */
    public function size(): array
    {
        return self::FORMATS[$this->format] ?? self::FORMATS['A4'];
    }

    public function pageWidthPx(): BigDecimal
    {
        return self::lengthToPx($this->size()[0]);
    }

    public function contentWidthPx(): BigDecimal
    {
        return $this->pageWidthPx()->minus(self::lengthToPx($this->marginX)->multipliedBy(2));
    }

    public function headerHeightPx(): BigDecimal
    {
        return self::lengthToPx($this->headerHeight);
    }

    public function footerHeightPx(): BigDecimal
    {
        return self::lengthToPx($this->footerHeight);
    }

    /**
     * @return array{format: string, marginX: string, headerHeight: string, footerHeight: string}
     */
    public function toArray(): array
    {
        return ['format' => $this->format, 'marginX' => $this->marginX, 'headerHeight' => $this->headerHeight, 'footerHeight' => $this->footerHeight];
    }
}
```

`app/Rendering/TemplateSource.php`:

```php
<?php

namespace App\Rendering;

use App\Models\Template;
use Illuminate\Support\Facades\Storage;

/** The parts of a template as the renderer needs them (from a model, a snapshot or unsaved editor/toolkit input). */
final readonly class TemplateSource
{
    /**
     * @param  array<string, mixed>  $manifest
     * @param  array<string, array{mime: string, contents: string}>  $assets  by package path ("assets/logo.svg")
     */
    public function __construct(
        public string $header,
        public string $body,
        public string $footer,
        public string $css,
        public array $manifest = [],
        public array $assets = [],
    ) {}

    public static function fromModel(Template $template): self
    {
        $assets = [];
        foreach ($template->assets as $asset) {
            $contents = Storage::disk('local')->get($asset->storage_path);
            if ($contents !== null) {
                $assets[$asset->path] = ['mime' => $asset->mime, 'contents' => $contents];
            }
        }

        return new self(
            (string) $template->header,
            (string) $template->body,
            (string) $template->footer,
            (string) $template->css,
            $template->manifest ?? [],
            $assets,
        );
    }

    /**
     * "template" of a snapshot (SnapshotBuilder). Finalized documents are never re-rendered for downloads
     * (they come from the archive), so reading the assets live by template id is fine for previews.
     *
     * @param  array<string, mixed>  $row
     */
    public static function fromSnapshot(array $row): self
    {
        $template = is_string($row['id'] ?? null) ? Template::query()->with('assets')->find($row['id']) : null;

        return new self(
            (string) ($row['header'] ?? ''),
            (string) ($row['body'] ?? ''),
            (string) ($row['footer'] ?? ''),
            (string) ($row['css'] ?? ''),
            is_array($row['manifest'] ?? null) ? $row['manifest'] : [],
            $template === null ? [] : self::fromModel($template)->assets,
        );
    }

    /**
     * Unsaved parts (editor, toolkit) on top of this template; the assets stay.
     *
     * @param  array<string, mixed>  $parts  header, body, footer, css, manifest
     */
    public function with(array $parts): self
    {
        $text = fn (string $key, string $current): string => array_key_exists($key, $parts) ? (string) $parts[$key] : $current;

        return new self(
            $text('header', $this->header),
            $text('body', $this->body),
            $text('footer', $this->footer),
            $text('css', $this->css),
            is_array($parts['manifest'] ?? null) ? $parts['manifest'] : $this->manifest,
            $this->assets,
        );
    }
}
```

- [ ] **Step 4: Sprachschlüssel ergänzen**

In `lang/en.json` und `lang/de.json` die Paper-Meldungen einfügen (alphabetisch einsortieren; Task 3 und 7 ergänzen den Rest von `template_package.*`):

| Schlüssel | en | de |
|---|---|---|
| `template_package.paper_format` | `paper.format must be one of :formats.` | `paper.format muss eins von :formats sein.` |
| `template_package.paper_invalid` | `paper must be an object.` | `paper muss ein Objekt sein.` |
| `template_package.paper_length` | `paper.:key must be a length like 20mm (mm, cm, in, pt or px).` | `paper.:key muss eine Länge wie 20mm sein (mm, cm, in, pt oder px).` |

Danach beide Dateien sortieren (die Dateien sind alphabetisch sortiert, 4 Leerzeichen eingerückt):

```bash
ddev exec php -r 'foreach (["lang/en.json", "lang/de.json"] as $f) { $a = json_decode(file_get_contents($f), true, flags: JSON_THROW_ON_ERROR); ksort($a); file_put_contents($f, json_encode($a, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)."\n"); }'
git diff --stat lang/
```
Erwartet: nur die neuen Zeilen als Änderung (keine Umsortierung bestehender Schlüssel). Diesen Befehl nach jeder Ergänzung der Sprachdateien wiederholen.

- [ ] **Step 5: Tests laufen lassen**

```bash
ddev artisan test --filter='PaperTest|EnumsTest|TranslationsTest'
```
Erwartet: PASS.

- [ ] **Step 6: Commit**

```bash
ddev exec vendor/bin/pint
git add app/Enums/RenderPart.php app/Rendering lang tests/Unit/EnumsTest.php tests/Feature/Rendering/PaperTest.php
git commit -m "$(cat <<'EOF'
feat(rendering): add render result, render errors, paper geometry and template sources

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Liquid-Umgebung – Filter `money`/`date`/`number`/`nl2br`/`t`, begrenzte Schleifen, Vokabular

**Files:**
- Create: `app/Rendering/Liquid/RenderEnv.php`, `app/Rendering/Liquid/OpenbillFilters.php`, `app/Rendering/Liquid/BoundedForTag.php`, `app/Rendering/Liquid/LiquidEnvironment.php`, `app/Rendering/NumberText.php`
- Modify: `lang/en.json`, `lang/de.json`
- Test: `tests/Feature/Rendering/FiltersTest.php`

**Interfaces:**
- Consumes: Task 1 (`config('openbill.rendering.*')`)
- Produces: `Liquid\LiquidEnvironment::make(): Keepsuit\Liquid\Environment`, `Liquid\RenderEnv(string $locale, array $translations = [])` + `REGISTER = 'openbill'`, `Liquid\OpenbillFilters` (Filter `money`, `number`, `date`, `nl2br`, `t`), `Liquid\BoundedForTag`, `NumberText::format(BigDecimal, int, string): string`, Sprachschlüssel `template.*`, `rendering.error.range`

- [ ] **Step 1: Failing tests schreiben**

`tests/Feature/Rendering/FiltersTest.php`:

```php
<?php

use App\Rendering\Liquid\LiquidEnvironment;
use App\Rendering\Liquid\RenderEnv;
use Keepsuit\Liquid\Exceptions\ResourceLimitException;
use Keepsuit\Liquid\Exceptions\StandardException;
use Keepsuit\Liquid\Exceptions\SyntaxException;
use Keepsuit\Liquid\Exceptions\UndefinedFilterException;

/**
 * @param  array<string, mixed>  $data
 * @param  array<string, array<string, string>>  $translations
 */
function liquid(string $source, array $data = [], string $locale = 'de', array $translations = []): string
{
    $environment = LiquidEnvironment::make();

    return $environment->parseString($source)->render($environment->newRenderContext(
        data: $data,
        registers: [RenderEnv::REGISTER => new RenderEnv($locale, $translations)],
    ));
}

it('formats money in the document language without floats', function (string $value, string $locale, string $expected) {
    expect(liquid('{{ v | money }}', ['v' => $value], $locale))->toBe($expected);
})->with([
    ['1234.5', 'de', '1.234,50 €'],
    ['1234.5', 'en', '€1,234.50'],
    ['-0.5', 'de', '-0,50 €'],
    ['-0.5', 'en', '-€0.50'],
    ['-0.004', 'de', '0,00 €'],
    ['1234567890123.45', 'de', '1.234.567.890.123,45 €'],
    ['0.125', 'en', '€0.13'],
]);

it('takes the number of decimals as argument and ignores what is not a number', function () {
    expect(liquid('{{ v | money: 4 }}', ['v' => '12.3456']))->toBe('12,3456 €')
        ->and(liquid('{{ v | money }}', ['v' => 7]))->toBe('7,00 €')
        ->and(liquid('[{{ missing | money }}]'))->toBe('[]')
        ->and(liquid('[{{ v | money }}]', ['v' => 'abc']))->toBe('[]')
        ->and(liquid('{{ 3 | times: 1.5 | money }}'))->toBe('4,50 €');
});

it('formats numbers', function () {
    expect(liquid('{{ v | number }}', ['v' => '1234.5']))->toBe('1.234,50')
        ->and(liquid('{{ v | number: 2 }}', ['v' => '1234.5'], 'en'))->toBe('1,234.50')
        ->and(liquid('{{ v | number: 0 }}', ['v' => '1234.5']))->toBe('1.235')
        ->and(liquid('{{ v | number: 3 }}', ['v' => '-1.5']))->toBe('-1,500');
});

it('formats dates per language or with a strftime pattern', function () {
    expect(liquid('{{ d | date }}', ['d' => '2026-10-04']))->toBe('04.10.2026')
        ->and(liquid('{{ d | date }}', ['d' => '2026-10-04'], 'en'))->toBe('Oct 4, 2026')
        ->and(liquid('{{ d | date: "%Y/%m/%d" }}', ['d' => '2026-10-04']))->toBe('2026/10/04')
        ->and(liquid('[{{ d | date }}]', ['d' => null]))->toBe('[]')
        ->and(liquid('{{ d | date }}', ['d' => 'not a date']))->toBe('not a date');
});

it('turns line breaks into <br> without escaping again (context values are escaped already)', function () {
    expect(liquid('{{ s | nl2br }}', ['s' => "a &amp; b\nc\r\nd"]))->toBe('a &amp; b<br>c<br>d');
});

it('translates template words: manifest first, then the built-in vocabulary, else the key', function () {
    expect(liquid("{{ 'number' | t }}"))->toBe('Nummer')
        ->and(liquid("{{ 'number' | t }}", [], 'en'))->toBe('Number')
        ->and(liquid("{{ 'number' | t }}", [], 'de', ['de' => ['number' => 'Nr.']]))->toBe('Nr.')
        ->and(liquid("{{ 'hotline' | t }}", [], 'de', ['en' => ['hotline' => 'Hotline']]))->toBe('hotline');
});

it('refuses unknown filters, unbounded ranges, tablerow and partials', function (string $source, string $exception) {
    expect(fn () => liquid($source))->toThrow($exception);
})->with([
    'unknown filter' => ['{{ 1 | nope }}', UndefinedFilterException::class],
    'huge range' => ['{% for i in (1..100000000) %}{% endfor %}', StandardException::class],
    'tablerow' => ['{% tablerow i in (1..3) %}{{ i }}{% endtablerow %}', SyntaxException::class],
    'render' => ["{% render 'other' %}", Exception::class],
]);

it('stops nested empty loops at the render limit within a fraction of a second', function () {
    $start = microtime(true);

    expect(fn () => liquid('{% for a in (1..9999) %}{% for b in (1..9999) %}{% endfor %}{% endfor %}'))
        ->toThrow(ResourceLimitException::class)
        ->and(microtime(true) - $start)->toBeLessThan(5);
});

it('has the vocabulary of the built-in templates in both languages', function () {
    $words = ['amount_due', 'credit', 'customer_number', 'date', 'details', 'draft', 'due_date', 'for', 'net', 'number', 'number_short',
        'of', 'offer_total', 'optional', 'optional_total', 'page', 'pos', 'price', 'project', 'quantity', 'reference', 'service',
        'service_date', 'subtotal', 'sum', 'tax_number', 'total', 'unit_price', 'valid_until', 'vat', 'vat_id', 'vat_long', 'vat_on'];

    foreach (['en', 'de'] as $locale) {
        $lang = json_decode((string) file_get_contents(lang_path("{$locale}.json")), true);
        foreach ($words as $word) {
            expect($lang)->toHaveKey("template.{$word}");
        }
    }
});
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

```bash
ddev artisan test --filter=FiltersTest
```
Erwartet: FAIL (`Class "App\Rendering\Liquid\LiquidEnvironment" not found`).

- [ ] **Step 3: Implementieren**

`app/Rendering/Liquid/RenderEnv.php`:

```php
<?php

namespace App\Rendering\Liquid;

/** What filters need besides the value: document language and the template's own translations (register "openbill"). */
final readonly class RenderEnv
{
    public const REGISTER = 'openbill';

    /**
     * @param  array<string, array<string, string>>  $translations  manifest "translations" by locale
     */
    public function __construct(
        public string $locale,
        public array $translations = [],
    ) {}
}
```

`app/Rendering/NumberText.php`:

```php
<?php

namespace App\Rendering;

use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;

/** Decimal → "1.234,50" (de) / "1,234.50" (en), commercial rounding, no floats. */
final class NumberText
{
    public static function format(BigDecimal $value, int $decimals, string $locale): string
    {
        $rounded = $value->toScale($decimals, RoundingMode::HalfUp);
        [$integer, $fraction] = array_pad(explode('.', (string) $rounded->abs()), 2, '');
        $grouped = strrev(implode($locale === 'de' ? '.' : ',', str_split(strrev($integer), 3)));
        $text = $fraction === '' ? $grouped : $grouped.($locale === 'de' ? ',' : '.').$fraction;

        return ($rounded->isNegative() ? '-' : '').$text;
    }
}
```

`app/Rendering/Liquid/OpenbillFilters.php`:

```php
<?php

namespace App\Rendering\Liquid;

use App\Rendering\NumberText;
use App\Support\Text;
use Brick\Math\BigDecimal;
use Carbon\CarbonImmutable;
use Keepsuit\Liquid\Filters\FiltersProvider;
use Keepsuit\Liquid\Filters\StandardFilters;
use Throwable;

/**
 * openbill's Liquid filters. Every public method is a filter (keepsuit registers them by name).
 * Values in the context are HTML-escaped strings already (LiquidRenderer), so nothing here escapes.
 */
final class OpenbillFilters extends FiltersProvider
{
    /** Euro amount in the document language: "1.234,50 €" (de), "€1,234.50" (en); '' for non-numbers. */
    public function money(mixed $value, mixed $decimals = 2): string
    {
        $amount = self::decimal($value);
        if ($amount === null) {
            return '';
        }
        $text = NumberText::format($amount, self::digits($decimals), $this->env()->locale);
        $sign = str_starts_with($text, '-') ? '-' : '';
        $text = ltrim($text, '-');

        return $this->env()->locale === 'de' ? "{$sign}{$text} €" : "{$sign}€{$text}";
    }

    /** Number in the document language with $decimals decimals (default 2); '' for non-numbers. */
    public function number(mixed $value, mixed $decimals = 2): string
    {
        $amount = self::decimal($value);

        return $amount === null ? '' : NumberText::format($amount, self::digits($decimals), $this->env()->locale);
    }

    /**
     * "04.10.2026" (de) / "Oct 4, 2026" (en). With a format argument it behaves like Liquid's standard
     * date filter (strftime: "%d.%m.%Y"). Empty for empty values, the value itself when it is no date.
     */
    public function date(mixed $value, mixed $format = null): string
    {
        if (! is_string($value) || trim($value) === '') {
            return '';
        }
        try {
            $date = CarbonImmutable::parse($value);
        } catch (Throwable) {
            return $value;
        }
        if (is_string($format) && $format !== '') {
            return (string) (new StandardFilters)->date($value, $format);
        }

        return $this->env()->locale === 'de' ? $date->format('d.m.Y') : $date->format('M j, Y');
    }

    /** Line breaks → <br>. */
    public function nl2br(mixed $value): string
    {
        return is_scalar($value) ? str_replace(["\r\n", "\r", "\n"], '<br>', (string) $value) : '';
    }

    /** Template word: manifest "translations" of the document language, then lang template.<key>, else the key. */
    public function t(mixed $key): string
    {
        if (! is_string($key) || $key === '') {
            return '';
        }
        $env = $this->env();
        $own = $env->translations[$env->locale][$key] ?? null;
        if (is_string($own)) {
            return $own;
        }
        $text = Text::t("template.{$key}", [], $env->locale);

        return $text === "template.{$key}" ? $key : $text;
    }

    private function env(): RenderEnv
    {
        $env = $this->context->getRegister(RenderEnv::REGISTER);

        return $env instanceof RenderEnv ? $env : new RenderEnv('en');
    }

    private static function decimal(mixed $value): ?BigDecimal
    {
        if (is_int($value)) {
            return BigDecimal::of($value);
        }
        // Liquid math (times, plus, …) yields PHP floats; their decimal text is exact enough for display
        if (is_float($value) && is_finite($value)) {
            return BigDecimal::of(sprintf('%.6F', $value));
        }
        if (is_string($value) && preg_match('/^-?\d+(\.\d+)?$/', trim($value)) === 1) {
            return BigDecimal::of(trim($value));
        }

        return null;
    }

    private static function digits(mixed $decimals): int
    {
        $digits = is_int($decimals) || (is_string($decimals) && ctype_digit($decimals)) ? (int) $decimals : 2;

        return max(0, min(6, $digits));
    }
}
```

`app/Rendering/Liquid/BoundedForTag.php`:

```php
<?php

namespace App\Rendering\Liquid;

use App\Support\Text;
use Keepsuit\Liquid\Exceptions\StandardException;
use Keepsuit\Liquid\Nodes\Range;
use Keepsuit\Liquid\Render\RenderContext;
use Keepsuit\Liquid\Tags\ForTag;

/**
 * {% for %} with two guards against endless rendering:
 * - a range like (1..100000000) would be expanded with range() before any limit applies → refused;
 * - every iteration costs one render point, so empty nested loops hit the render limit as well.
 */
final class BoundedForTag extends ForTag
{
    protected function collectionSegment(RenderContext $context): array
    {
        $collection = $context->evaluate($this->collection);
        $max = (int) config('openbill.rendering.max_range');
        if ($collection instanceof Range && abs($collection->end - $collection->start) + 1 > $max) {
            throw new StandardException(Text::t('rendering.error.range', ['max' => $max]));
        }

        $segment = parent::collectionSegment($context);
        $context->resourceLimits->incrementRenderScore(count($segment));

        return $segment;
    }
}
```

`app/Rendering/Liquid/LiquidEnvironment.php`:

```php
<?php

namespace App\Rendering\Liquid;

use Keepsuit\Liquid\Environment;
use Keepsuit\Liquid\EnvironmentFactory;
use Keepsuit\Liquid\Render\ResourceLimits;

/**
 * The sandbox templates run in: strict parsing (keepsuit always), unknown filters are errors, unknown
 * variables render empty, errors are rethrown (with line numbers) instead of printed, resource limits from
 * config('openbill.rendering'), no file system (render/include fail), no tablerow.
 */
final class LiquidEnvironment
{
    public static function make(): Environment
    {
        $environment = EnvironmentFactory::new()
            ->setStrictFilters(true)
            ->setStrictVariables(false)
            ->setRethrowErrors(true)
            ->setResourceLimits(new ResourceLimits(
                renderLengthLimit: (int) config('openbill.rendering.max_output_bytes'),
                renderScoreLimit: (int) config('openbill.rendering.max_render_score'),
                assignScoreLimit: (int) config('openbill.rendering.max_assign_score'),
            ))
            ->registerFilters(OpenbillFilters::class)
            ->registerTag(BoundedForTag::class)
            ->build();

        // tablerow expands ranges without a limit and has no use in documents
        $environment->tagRegistry->delete('tablerow');

        return $environment;
    }
}
```

- [ ] **Step 4: Sprachschlüssel ergänzen**

In `lang/en.json` / `lang/de.json` einfügen, danach den Sortier-Befehl aus Task 2 Step 4 ausführen:

| Schlüssel | en | de |
|---|---|---|
| `rendering.error.range` | `A range may contain at most :max items.` | `Ein Bereich darf höchstens :max Einträge haben.` |
| `template.amount_due` | `Amount due` | `Zu zahlen` |
| `template.credit` | `Credit` | `Gutschrift` |
| `template.customer_number` | `Customer no.` | `Kunde` |
| `template.date` | `Date` | `Datum` |
| `template.details` | `Details` | `Daten` |
| `template.draft` | `Draft` | `Entwurf` |
| `template.due_date` | `Due` | `Fällig` |
| `template.for` | `For` | `Für` |
| `template.net` | `Net` | `Netto` |
| `template.number` | `Number` | `Nummer` |
| `template.number_short` | `No.` | `Nr.` |
| `template.of` | `of` | `von` |
| `template.offer_total` | `Quote total` | `Angebotssumme` |
| `template.optional` | `optional` | `optional` |
| `template.optional_total` | `Optional items (not included)` | `Optionale Positionen (nicht enthalten)` |
| `template.page` | `Page` | `Seite` |
| `template.pos` | `No.` | `Pos.` |
| `template.price` | `Price` | `Preis` |
| `template.project` | `Project` | `Projekt` |
| `template.quantity` | `Quantity` | `Menge` |
| `template.reference` | `Reference` | `Bezug` |
| `template.service` | `Service` | `Leistung` |
| `template.service_date` | `Service date` | `Leistung` |
| `template.subtotal` | `Subtotal` | `Summe` |
| `template.sum` | `Amount` | `Summe` |
| `template.tax_number` | `Tax no.` | `St.-Nr.` |
| `template.total` | `Total` | `Gesamt` |
| `template.unit_price` | `Unit price` | `Einzelpreis` |
| `template.valid_until` | `Valid until` | `Gültig bis` |
| `template.vat` | `VAT` | `USt.` |
| `template.vat_id` | `VAT ID` | `USt-ID` |
| `template.vat_long` | `VAT` | `Umsatzsteuer` |
| `template.vat_on` | `on` | `auf` |

- [ ] **Step 5: Tests laufen lassen**

```bash
ddev artisan test --filter=FiltersTest
```
Erwartet: PASS. Zwei Stellen gegen die echte Bibliothek prüfen, falls sie abweichen:
- `{% render 'other' %}` wirft `Keepsuit\Liquid\Exceptions\FileSystemException` („This liquid context does not allow includes.“) – das ist eine `Exception`, der Test bleibt so.
- `{{ 3 | times: 1.5 | money }}`: `times` liefert `4.5` (float) → `4,50 €`. Liefert keepsuit hier einen String, ist der Test trotzdem grün.

- [ ] **Step 6: Commit**

```bash
ddev exec vendor/bin/pint
git add app/Rendering lang tests/Feature/Rendering/FiltersTest.php
git commit -m "$(cat <<'EOF'
feat(rendering): add liquid sandbox with money, date, number, nl2br and t filters

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: LiquidRenderer und AssetInliner – drei HTML-Dokumente, Escaping, Seitenplatzhalter, Fehler und Limits

**Files:**
- Create: `app/Rendering/LiquidRenderer.php`, `app/Rendering/AssetInliner.php`
- Modify: `lang/en.json`, `lang/de.json`
- Test: `tests/Feature/Rendering/LiquidRendererTest.php`

**Interfaces:**
- Consumes: Task 2 (`TemplateSource`, `RenderResult`, `RenderError`, `RenderOptions`, `Paper`), Task 3 (`LiquidEnvironment`, `RenderEnv`)
- Produces: `LiquidRenderer::render(TemplateSource $template, array $context, RenderOptions $options = new RenderOptions): RenderResult`, `AssetInliner::logo(?string): string`, `AssetInliner::inline(string, array): string`, `AssetInliner::dataUrl(string, string): string`

- [ ] **Step 1: Failing tests schreiben** (Port von `prototypes/clickdummy-v2/src/domain/liquid.test.ts` plus Review Focus 2)

`tests/Feature/Rendering/LiquidRendererTest.php`:

```php
<?php

use App\Enums\RenderPart;
use App\Rendering\LiquidRenderer;
use App\Rendering\RenderOptions;
use App\Rendering\RenderResult;
use App\Rendering\TemplateSource;
use App\Support\Text;

/**
 * @param  array<string, mixed>  $parts  header, body, footer, css, manifest, assets
 * @param  array<string, mixed>|null  $context
 */
function renderParts(array $parts, ?array $context = null, ?RenderOptions $options = null): RenderResult
{
    return app(LiquidRenderer::class)->render(
        new TemplateSource($parts['header'] ?? '', $parts['body'] ?? '', $parts['footer'] ?? '', $parts['css'] ?? '', $parts['manifest'] ?? [], $parts['assets'] ?? []),
        $context ?? rendererContext(),
        $options ?? new RenderOptions('de'),
    );
}

/** @return array<string, mixed> */
function rendererContext(array $document = [], ?array $customer = null): array
{
    return [
        'org' => ['name' => 'Studio <Nordlicht>'],
        'customer' => $customer,
        'contact' => ['first_name' => 'Ida'],
        'document' => [
            'type_label' => 'Rechnung', 'number' => 'RE-1', 'date' => '2026-10-04', 'gross_total' => '1234.50',
            'intro' => 'Hallo {{ contact.first_name }}', 'closing' => "Zeile 1\nZeile 2", ...$document,
        ],
        'positions' => [],
        'groups' => [],
    ];
}

it('renders values with the filters and escapes context values', function () {
    $result = renderParts(['body' => '{{ document.date | date }}|{{ document.gross_total | money }}|{{ org.name }}']);

    expect($result->errors)->toBe([])
        ->and($result->body)->toContain('04.10.2026|1.234,50 €|Studio &lt;Nordlicht&gt;');
});

it('renders Liquid inside intro and closing, nl2br keeps the line breaks', function () {
    $result = renderParts(['body' => '{{ document.intro | nl2br }}#{{ document.closing | nl2br }}']);

    expect($result->body)->toContain('Hallo Ida#Zeile 1<br>Zeile 2');
});

it('escapes customer data inside the intro exactly once', function () {
    $context = rendererContext(['intro' => 'Für {{ customer.name }}'], ['name' => 'Müller & Söhne "Nord"']);

    $viaNl2br = renderParts(['body' => '{{ document.intro | nl2br }}'], $context);
    $plain = renderParts(['body' => '{{ document.intro }}'], $context);

    expect($viaNl2br->body)->toContain('Für Müller &amp; Söhne &quot;Nord&quot;')
        ->and($plain->body)->toContain('Für Müller &amp; Söhne &quot;Nord&quot;')
        ->and($viaNl2br->body)->not->toContain('&amp;amp;');
});

it('renders header and footer as separate documents with Chromium page placeholders', function () {
    $result = renderParts([
        'body' => 'Inhalt',
        'header' => '<b>{{ document.number }}</b>',
        'footer' => 'Seite {{ page.number }} von {{page.total}}',
    ]);

    expect($result->header)->toContain('<b>RE-1</b>')->not->toContain('Inhalt')
        ->and($result->footer)->toContain('Seite <span class="pageNumber"></span> von <span class="totalPages"></span>')
        ->and($result->body)->not->toContain('pageNumber')
        ->and($result->body)->toStartWith('<!doctype html><html lang="de">');
});

it('lays out body, header and footer for the paper of the manifest', function () {
    $result = renderParts([
        'body' => 'x', 'header' => 'h', 'footer' => 'f', 'css' => 'h1 { color: red; }',
        'manifest' => ['paper' => ['format' => 'A4', 'marginX' => '20mm', 'headerHeight' => '30mm', 'footerHeight' => '28mm']],
    ]);

    expect($result->paper->toArray())->toBe(['format' => 'A4', 'marginX' => '20mm', 'headerHeight' => '30mm', 'footerHeight' => '28mm'])
        ->and($result->body)->toContain('body{margin:0;width:642.52px}')->toContain('h1 { color: red; }')
        ->and($result->header)->toContain('width:793.70px;height:113.39px')->not->toContain('color: red')
        ->and($result->footer)->toContain('width:793.70px;height:105.83px');
});

it('reports a syntax error with part and line and shows an error box instead of throwing', function () {
    $result = renderParts(['body' => "a\nb\n{% for p in positions %}{{ p.title }"]);

    expect($result->errors)->toHaveCount(1)
        ->and($result->errors[0]->part)->toBe(RenderPart::Body)
        ->and($result->errors[0]->line)->toBe(3)
        ->and($result->body)->toContain('class="openbill-error"');
});

it('reports unknown filters and errors in the footer with their part', function () {
    $result = renderParts(['body' => "ok\n{{ document.number | shout }}", 'footer' => '{% if %}']);

    expect(array_map(fn ($e) => [$e->part, $e->line], $result->errors))->toBe([[RenderPart::Body, 2], [RenderPart::Footer, 1]])
        ->and($result->errors[0]->message)->toContain('shout')
        ->and($result->header)->not->toContain('openbill-error');
});

it('stops endless loops and too much output with a readable message', function (string $body) {
    $start = microtime(true);
    $result = renderParts(['body' => $body], [...rendererContext(), 'long' => str_repeat('x', 1000)]);

    expect($result->errors)->toHaveCount(1)
        ->and($result->errors[0]->message)->toBe(Text::t('rendering.error.limit'))
        ->and(microtime(true) - $start)->toBeLessThan(5);
})->with([
    'nested loops' => ['{% for a in (1..9999) %}{% for b in (1..9999) %}{% endfor %}{% endfor %}'],
    'output' => ['{% for i in (1..9000) %}{{ long }}{% endfor %}'],
]);

it('refuses a huge range with its line', function () {
    $result = renderParts(['body' => "x\n{% for i in (1..100000000) %}{% endfor %}"]);

    expect($result->errors[0]->line)->toBe(2)
        ->and($result->errors[0]->message)->toBe(Text::t('rendering.error.range', ['max' => 10000]));
});

it('refuses a template part larger than the limit without parsing it', function () {
    $result = renderParts(['header' => str_repeat('{{ x }}', 40000)]);

    expect($result->errors)->toHaveCount(1)
        ->and($result->errors[0]->part)->toBe(RenderPart::Header)
        ->and($result->errors[0]->message)->toBe(Text::t('rendering.error.too_large', ['kb' => 200]));
});

it('refuses partials, </style> in the CSS and an invalid paper', function () {
    $result = renderParts([
        'body' => "{% render 'x' %}",
        'css' => "h1{}\n</style><script>alert(1)</script>",
        'manifest' => ['paper' => ['format' => 'A3']],
    ]);

    expect(array_map(fn ($e) => $e->part, $result->errors))->toBe([RenderPart::Manifest, RenderPart::Css, RenderPart::Body])
        ->and($result->errors[1]->line)->toBe(2)
        ->and($result->body)->not->toContain('<script>')
        ->and($result->paper->format)->toBe('A4');
});

it('keeps a broken intro as plain text and reports it', function () {
    $result = renderParts(['body' => '{{ document.intro }}'], rendererContext(['intro' => 'Hallo {{ contact.first_name ']));

    expect($result->errors[0]->part)->toBe(RenderPart::Intro)
        ->and($result->body)->toContain('Hallo {{ contact.first_name');
});

it('puts a watermark on every page of a draft only when asked to', function () {
    expect(renderParts(['body' => 'x'], null, new RenderOptions('de', 'ENTWURF'))->body)->toContain('<div class="openbill-draft-mark">ENTWURF</div>')
        ->and(renderParts(['body' => 'x'])->body)->not->toContain('openbill-draft-mark');
});

it('inlines template assets as data URLs in all parts and in the CSS', function () {
    $result = renderParts([
        'header' => '<img src="assets/logo.svg">',
        'body' => "<img src='./assets/logo.svg'><img src=\"assets/missing.png\">",
        'css' => '@font-face { src: url(assets/font.woff2); }',
        'assets' => [
            'assets/logo.svg' => ['mime' => 'image/svg+xml', 'contents' => '<svg/>'],
            'assets/font.woff2' => ['mime' => 'font/woff2', 'contents' => 'FONT'],
        ],
    ]);

    expect($result->header)->toContain('src="data:image/svg+xml;base64,'.base64_encode('<svg/>').'"')
        ->and($result->body)->toContain("src='data:image/svg+xml;base64,")
        ->and($result->body)->toContain('src="assets/missing.png"')
        ->and($result->body)->toContain('url(data:font/woff2;base64,'.base64_encode('FONT').')');
});

it('uses the template translations from the manifest', function () {
    $result = renderParts(['body' => "{{ 'number' | t }}", 'manifest' => ['translations' => ['de' => ['number' => 'Beleg-Nr.']]]]);

    expect($result->body)->toContain('Beleg-Nr.');
});
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

```bash
ddev artisan test --filter=LiquidRendererTest
```
Erwartet: FAIL (`Class "App\Rendering\LiquidRenderer" not found`).

- [ ] **Step 3: AssetInliner implementieren**

`app/Rendering/AssetInliner.php`:

```php
<?php

namespace App\Rendering;

use Illuminate\Support\Facades\Storage;

/**
 * Chromium's header and footer can't load files, and a PDF must not depend on the network:
 * the organization logo and template assets become data URLs.
 */
final class AssetInliner
{
    /** Organization logo (path on the local disk) as data URL; '' when there is none. */
    public function logo(?string $path): string
    {
        if ($path === null || $path === '') {
            return '';
        }
        $disk = Storage::disk('local');
        $contents = $disk->get($path);
        if ($contents === null) {
            return '';
        }
        $mime = $disk->mimeType($path);

        return self::dataUrl(is_string($mime) ? $mime : 'application/octet-stream', $contents);
    }

    /**
     * Replaces references to template assets ("assets/logo.svg" or "./assets/logo.svg" in quotes or url())
     * by data URLs. Unknown assets stay as they are.
     *
     * @param  array<string, array{mime: string, contents: string}>  $assets  by package path
     */
    public function inline(string $html, array $assets): string
    {
        if ($assets === []) {
            return $html;
        }

        return (string) preg_replace_callback(
            '#(?<=["\'(])(?:\./)?(assets/[A-Za-z0-9._/-]+)(?=["\')])#',
            fn (array $m): string => isset($assets[$m[1]]) ? self::dataUrl($assets[$m[1]]['mime'], $assets[$m[1]]['contents']) : $m[0],
            $html,
        );
    }

    public static function dataUrl(string $mime, string $contents): string
    {
        return 'data:'.$mime.';base64,'.base64_encode($contents);
    }
}
```

- [ ] **Step 4: LiquidRenderer implementieren**

`app/Rendering/LiquidRenderer.php`:

```php
<?php

namespace App\Rendering;

use App\Enums\RenderPart;
use App\Rendering\Liquid\LiquidEnvironment;
use App\Rendering\Liquid\RenderEnv;
use App\Support\Text;
use Brick\Math\BigDecimal;
use Keepsuit\Liquid\Environment;
use Keepsuit\Liquid\Exceptions\LiquidException;
use Keepsuit\Liquid\Exceptions\ResourceLimitException;
use Throwable;

/**
 * Renders a template into three standalone HTML documents – body, header, footer – exactly as Gotenberg
 * receives them (port of prototypes/clickdummy-v2/src/domain/liquid.ts). Never throws because of the
 * template: problems end up in RenderResult::$errors and the part shows an error box.
 *
 * Escaping: keepsuit has no auto-escape, so every string of the context is HTML-escaped exactly once
 * before rendering. Intro and closing (Liquid too, from text blocks) are rendered on the raw data first
 * and escaped together with the rest.
 */
final class LiquidRenderer
{
    private const PAGE_TOKENS = [
        '/\{\{\s*page\.number\s*\}\}/' => '<span class="pageNumber"></span>',
        '/\{\{\s*page\.total\s*\}\}/' => '<span class="totalPages"></span>',
    ];

    private Environment $liquid;

    public function __construct(private readonly AssetInliner $assets)
    {
        $this->liquid = LiquidEnvironment::make();
    }

    /**
     * @param  array<string, mixed>  $context  raw values (ContextBuilder::build()->data)
     */
    public function render(TemplateSource $template, array $context, RenderOptions $options = new RenderOptions): RenderResult
    {
        /** @var list<RenderError> $errors */
        $errors = [];
        foreach (Paper::errors($template->manifest['paper'] ?? null) as $message) {
            $errors[] = new RenderError(RenderPart::Manifest, null, $message);
        }
        $paper = Paper::fromManifest($template->manifest);
        $env = new RenderEnv($options->locale, self::translations($template->manifest));

        $document = is_array($context['document'] ?? null) ? $context['document'] : [];
        foreach ([[RenderPart::Intro, 'intro'], [RenderPart::Closing, 'closing']] as [$part, $key]) {
            if (is_string($document[$key] ?? null) && $document[$key] !== '') {
                $document[$key] = $this->part($part, $document[$key], $context, $env, $errors) ?? $document[$key];
            }
        }
        $context['document'] = $document;
        /** @var array<string, mixed> $escaped */
        $escaped = self::escape($context);

        $css = $this->css($template->css, $errors);
        $body = $this->part(RenderPart::Body, $template->body, $escaped, $env, $errors) ?? self::errorBox(end($errors));
        $header = $this->part(RenderPart::Header, self::pageTokens($template->header), $escaped, $env, $errors) ?? self::errorBox(end($errors));
        $footer = $this->part(RenderPart::Footer, self::pageTokens($template->footer), $escaped, $env, $errors) ?? self::errorBox(end($errors));

        $title = trim(((string) ($escaped['document']['type_label'] ?? '')).' '.((string) ($escaped['document']['number'] ?? '')));

        return new RenderResult(
            header: self::bandShell($this->assets->inline($header, $template->assets), $paper, $paper->headerHeightPx(), $options->locale),
            body: self::bodyShell($this->assets->inline($body, $template->assets), $this->assets->inline($css, $template->assets), $paper, $title, $options),
            footer: self::bandShell($this->assets->inline($footer, $template->assets), $paper, $paper->footerHeightPx(), $options->locale),
            paper: $paper,
            errors: $errors,
        );
    }

    /**
     * One Liquid part; null (and an entry in $errors) when it fails.
     *
     * @param  array<string, mixed>  $data
     * @param  list<RenderError>  $errors
     */
    private function part(RenderPart $part, string $source, array $data, RenderEnv $env, array &$errors): ?string
    {
        $max = (int) config('openbill.rendering.max_source_bytes');
        if (strlen($source) > $max) {
            $errors[] = new RenderError($part, null, Text::t('rendering.error.too_large', ['kb' => intdiv($max, 1024)]));

            return null;
        }
        if (trim($source) === '') {
            return '';
        }

        try {
            return $this->liquid->parseString($source)->render(
                $this->liquid->newRenderContext(data: $data, registers: [RenderEnv::REGISTER => $env]),
            );
        } catch (ResourceLimitException) {
            $errors[] = new RenderError($part, null, Text::t('rendering.error.limit'));
        } catch (LiquidException $e) {
            $errors[] = new RenderError($part, $e->lineNumber, $e->getMessage());
        } catch (Throwable $e) {
            report($e);
            $errors[] = new RenderError($part, null, Text::t('rendering.error.internal', ['message' => $e->getMessage()]));
        }

        return null;
    }

    /**
     * styles.css is plain CSS (no Liquid); it must not end the <style> element it is put into.
     *
     * @param  list<RenderError>  $errors
     */
    private function css(string $css, array &$errors): string
    {
        $max = (int) config('openbill.rendering.max_source_bytes');
        if (strlen($css) > $max) {
            $errors[] = new RenderError(RenderPart::Css, null, Text::t('rendering.error.too_large', ['kb' => intdiv($max, 1024)]));

            return '';
        }
        $position = stripos($css, '</style');
        if ($position !== false) {
            $errors[] = new RenderError(RenderPart::Css, substr_count($css, "\n", 0, $position) + 1, Text::t('rendering.error.style_tag'));

            return '';
        }

        return $css;
    }

    /** {{ page.number }} / {{ page.total }} become the elements Chromium fills while printing (same line count). */
    private static function pageTokens(string $source): string
    {
        return (string) preg_replace(array_keys(self::PAGE_TOKENS), array_values(self::PAGE_TOKENS), $source);
    }

    private static function escape(mixed $value): mixed
    {
        if (is_string($value)) {
            return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        }
        if (is_array($value)) {
            return array_map(self::escape(...), $value);
        }

        return $value;
    }

    /**
     * @param  array<string, mixed>  $manifest
     * @return array<string, array<string, string>>
     */
    private static function translations(array $manifest): array
    {
        $translations = [];
        foreach (is_array($manifest['translations'] ?? null) ? $manifest['translations'] : [] as $locale => $words) {
            if (is_string($locale) && is_array($words)) {
                $translations[$locale] = array_filter($words, fn (mixed $word, mixed $key): bool => is_string($key) && is_string($word), ARRAY_FILTER_USE_BOTH);
            }
        }

        return $translations;
    }

    private static function errorBox(RenderError|false $error): string
    {
        if ($error === false) {
            return '';
        }
        $where = Text::t('rendering.error_box', ['part' => $error->part->value]).($error->line === null ? '' : ", {$error->line}");

        return '<div class="openbill-error" style="font:13px/1.5 system-ui,sans-serif;color:#b42318;border:1px solid #b42318;padding:8px 12px">'
            .'<strong>'.e($where).'</strong><pre style="white-space:pre-wrap;margin:4px 0 0">'.e($error->message).'</pre></div>';
    }

    private static function head(string $locale, string $title): string
    {
        return '<!doctype html><html lang="'.e($locale).'"><head><meta charset="utf-8"><title>'.$title.'</title>';
    }

    /** Body: as wide as the content area, no own margins (Gotenberg sets them from the paper). */
    private static function bodyShell(string $body, string $css, Paper $paper, string $title, RenderOptions $options): string
    {
        $mark = $options->draftMark === null ? '' : '<div class="openbill-draft-mark">'.e($options->draftMark).'</div>';
        $markCss = $options->draftMark === null ? '' : '.openbill-draft-mark{position:fixed;top:42%;left:0;right:0;text-align:center;'
            .'transform:rotate(-30deg);font:700 72pt/1 sans-serif;letter-spacing:.1em;color:rgba(0,0,0,.07);pointer-events:none;z-index:1000}'."\n";

        return self::head($options->locale, $title)
            ."<style>\nhtml{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}\n"
            ."body{margin:0;width:{$paper->contentWidthPx()}px}\n@media print{body{width:auto}}\n"
            .$markCss.$css."\n</style></head><body>{$mark}{$body}</body></html>";
    }

    /** Header/footer: own document like in Chromium, page wide, as high as its margin, without the body CSS. */
    private static function bandShell(string $content, Paper $paper, BigDecimal $height, string $locale): string
    {
        return self::head($locale, '')
            .'<style>html{-webkit-print-color-adjust:exact;print-color-adjust:exact;background:#fff}'
            ."body{margin:0;width:{$paper->pageWidthPx()}px;height:{$height}px;overflow:hidden}</style></head><body>{$content}</body></html>";
    }
}
```

- [ ] **Step 5: Sprachschlüssel ergänzen** (danach sortieren wie in Task 2)

| Schlüssel | en | de |
|---|---|---|
| `rendering.error.internal` | `Internal error while rendering: :message` | `Interner Fehler beim Rendern: :message` |
| `rendering.error.limit` | `The template exceeds the render limit (endless loop or too much output).` | `Das Template überschreitet die Render-Grenze (Endlosschleife oder zu viel Ausgabe).` |
| `rendering.error.style_tag` | `styles.css must not contain </style>.` | `styles.css darf kein </style> enthalten.` |
| `rendering.error.too_large` | `This part is larger than :kb KB.` | `Dieser Teil ist größer als :kb KB.` |
| `rendering.error_box` | `Template error in :part` | `Template-Fehler in :part` |

- [ ] **Step 6: Tests laufen lassen**

```bash
ddev artisan test --filter=LiquidRendererTest
```
Erwartet: PASS. Prüfpunkte, falls ein Test abweicht:
- `body{margin:0;width:642.52px}`: `BigDecimal` wird mit zwei Nachkommastellen in den String gesetzt (`(string)` von `minus()` behält die Skala 2).
- Fehlerreihenfolge im Test „partials, </style> …“: Manifest → CSS → Body, weil `css()` vor den Liquid-Teilen läuft.
- Ausgabe-Limit: 9000 × 1000 Zeichen = 9 MB > 5 MB; keepsuit prüft die Länge am Ende von `Template::render()` und wirft `ResourceLimitException`.

- [ ] **Step 7: Commit**

```bash
ddev exec vendor/bin/pint
git add app/Rendering lang tests/Feature/Rendering/LiquidRendererTest.php
git commit -m "$(cat <<'EOF'
feat(rendering): render header, body and footer with escaping, page placeholders and limits

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: ContextBuilder, TemplateResolver und ungespeicherte Entwürfe (DraftInput, DraftOverlay)

**Files:**
- Create: `app/Support/TemplateResolver.php`, `app/Support/DraftInput.php`, `app/Support/DraftOverlay.php`
- Create: `app/Rendering/ContextBuilder.php`, `app/Rendering/TemplateContext.php`, `app/Rendering/Amounts.php`
- Modify: `app/Support/SnapshotBuilder.php` (Template über `TemplateResolver`, `orgRow()` öffentlich)
- Modify: `app/Actions/UpdateDraft.php` (Regeln und Feldprüfung nach `DraftInput`)
- Modify: `lang/en.json`, `lang/de.json`
- Test: `tests/Feature/Rendering/ContextBuilderTest.php`

**Interfaces:**
- Consumes: Task 4 (`AssetInliner`), Phase 2 (`DocumentInspector::sources()/totals()`, `SnapshotBuilder`, `UpdateDraft`)
- Produces: `ContextBuilder::build(Document $document, array $sources): TemplateContext`, `TemplateContext{array $data, Totals $totals}`, `TemplateResolver::for(Document): ?Template`, `TemplateResolver::fallback(): ?Template`, `DraftInput::FIELDS`, `DraftInput::validate(Document, array): array`, `DraftInput::rules(): array`, `DraftOverlay::apply(Document, array): Document`, `SnapshotBuilder::orgRow(Organization): array`, `Amounts::plain()`, `Amounts::price()`, Sprachschlüssel `document_type.*`

- [ ] **Step 1: Failing tests schreiben** (Port von `prototypes/clickdummy-v2/src/domain/templateContext.ts`)

`tests/Feature/Rendering/ContextBuilderTest.php`:

```php
<?php

use App\Actions\ConvertDocument;
use App\Actions\FinalizeDocument;
use App\Actions\SetDocumentStatus;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\FieldScope;
use App\Models\Contact;
use App\Models\Customer;
use App\Models\Document;
use App\Models\DocumentTypeSetting;
use App\Models\FieldDefinition;
use App\Models\Organization;
use App\Models\Template;
use App\Contracts\DocumentArchiver;
use App\Domain\Fields\FieldRegistry;
use App\Support\NullDocumentArchiver;
use App\Rendering\ContextBuilder;
use App\Support\DocumentInspector;
use App\Support\DraftInput;
use App\Support\DraftOverlay;
use App\Support\SnapshotBuilder;
use App\Support\TemplateResolver;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

function contextOf(Document $document): array
{
    $document->loadMissing('groups.positions');

    return app(ContextBuilder::class)->build($document, app(DocumentInspector::class)->sources($document))->data;
}

function groupedDraft(): Document
{
    $customer = Customer::factory()->create(['name' => 'Hafenkontor Lindqvist GmbH', 'number' => 'K-1001']);
    Contact::factory()->for($customer)->create(['first_name' => 'Mira', 'last_name' => 'Albers', 'is_default' => true]);

    return draft(DocumentType::Invoice, [], [
        'customer_id' => $customer->id,
        'groups' => [
            ['title' => 'Konzept', 'positions' => [itemRow('Workshop', '10', '95'), ['kind' => 'text', 'title' => 'Inklusive Protokoll', 'quantity' => '0', 'unit_price' => '0', 'unit_id' => null, 'tax_rate_id' => null, 'custom' => []]]],
            ['title' => null, 'positions' => [itemRow('Hosting', '1', '49.5')]],
        ],
    ]);
}

it('builds the context of a draft from live master data', function () {
    $context = contextOf(groupedDraft());

    expect($context['document'])->toMatchArray([
        'type' => 'invoice',
        'type_label' => 'Invoice',
        'status' => 'draft',
        'number' => 'Draft',
        'locale' => 'en',
        'net_total' => '999.50',
        'tax_total' => '189.91',
        'gross_total' => '1189.41',
        'optional_total' => '0.00',
        'source_number' => null,
    ])
        ->and($context['document']['tax_breakdown'])->toBe([['category' => 'S', 'percent' => '19', 'net' => '999.50', 'tax' => '189.91', 'gross' => '1189.41']])
        ->and($context['customer'])->toMatchArray(['name' => 'Hafenkontor Lindqvist GmbH', 'number' => 'K-1001', 'tax_treatment' => 'domestic'])
        ->and($context['contact'])->toMatchArray(['first_name' => 'Mira', 'full_name' => 'Mira Albers'])
        ->and($context['groups'][0])->toMatchArray(['title' => 'Konzept', 'has_title' => true, 'total' => '950.00', 'optional_total' => '0.00'])
        ->and($context['groups'][1])->toMatchArray(['title' => '', 'has_title' => false, 'total' => '49.50'])
        ->and($context['positions'])->toHaveCount(3)
        ->and($context['positions'][0])->toMatchArray([
            'index' => 1, 'kind' => 'item', 'is_item' => true, 'is_text' => false, 'is_optional' => false, 'title' => 'Workshop',
            'quantity' => '10', 'unit' => 'h', 'unit_name' => 'Hour', 'unit_code' => 'HUR', 'unit_price' => '95.00',
            'tax_percent' => '19', 'total' => '950.00', 'group' => 'Konzept',
        ])
        ->and($context['positions'][1])->toMatchArray(['index' => null, 'is_text' => true, 'title' => 'Inklusive Protokoll'])
        ->and($context['positions'][2])->toMatchArray(['index' => 2, 'unit_price' => '49.50', 'group' => '']);
});

it('puts custom fields directly on their object and never lets them override core values', function () {
    FieldDefinition::factory()->create(['scope' => FieldScope::Document, 'key' => 'project_name', 'label' => 'Project', 'doc_types' => ['invoice']]);
    $document = groupedDraft();
    $document->forceFill(['custom' => ['project_name' => 'Relaunch', 'number' => 'FAKE']])->save();
    Customer::query()->whereKey($document->customer_id)->update(['custom' => json_encode(['industry' => 'Handel', 'name' => 'Evil'])]);

    $context = contextOf($document->fresh());

    expect($context['document']['project_name'])->toBe('Relaunch')
        ->and($context['document']['number'])->toBe('Draft')
        ->and($context['customer']['industry'])->toBe('Handel')
        ->and($context['customer']['name'])->toBe('Hafenkontor Lindqvist GmbH');
});

it('only uses reserved keys for core values, so a custom field can never be shadowed silently', function () {
    $context = contextOf(groupedDraft());
    $levels = ['org' => FieldScope::Org, 'customer' => FieldScope::Customer, 'contact' => FieldScope::Contact, 'document' => FieldScope::Document];

    foreach ($levels as $level => $scope) {
        foreach (array_keys($context[$level]) as $key) {
            expect(FieldRegistry::isReserved($scope, $key))->toBeTrue("{$level}.{$key} is not reserved");
        }
    }
    foreach (array_keys($context['positions'][0]) as $key) {
        expect(FieldRegistry::isReserved(FieldScope::Position, $key))->toBeTrue("position.{$key} is not reserved");
    }
});

it('uses the snapshot for a finalized document', function () {
    // the archiver is not what this test is about (task 11 covers it)
    app()->bind(DocumentArchiver::class, NullDocumentArchiver::class);
    $done = app(FinalizeDocument::class)->handle(systemActor(), groupedDraft());
    Customer::query()->whereKey($done->customer_id)->update(['name' => 'Renamed']);

    expect(contextOf($done->fresh())['customer']['name'])->toBe('Hafenkontor Lindqvist GmbH');
});

it('shows the number of the source document', function () {
    app()->bind(DocumentArchiver::class, NullDocumentArchiver::class);
    $offer = app(FinalizeDocument::class)->handle(systemActor(), draft(DocumentType::Offer));
    app(SetDocumentStatus::class)->handle(systemActor(), $offer, DocumentStatus::Accepted);
    $invoice = app(ConvertDocument::class)->handle(systemActor(), $offer->fresh(), DocumentType::Invoice)->document;

    expect(contextOf($invoice)['document']['source_number'])->toBe($offer->number);
});

it('embeds the organization logo as data URL', function () {
    Storage::disk('local')->put('logos/nordlicht.png', 'PNGDATA');
    Organization::current()->forceFill(['logo_path' => 'logos/nordlicht.png'])->save();

    expect(contextOf(groupedDraft())['org']['logo'])->toStartWith('data:')->toEndWith(';base64,'.base64_encode('PNGDATA'));
});

it('previews unsaved draft changes without writing them', function () {
    $document = groupedDraft();
    $rows = [['title' => 'Neu', 'positions' => [itemRow('Workshop', '2', '100')]]];
    $virtual = DraftOverlay::apply($document, DraftInput::validate($document, ['intro' => 'Unsaved', 'groups' => $rows]));

    $context = app(ContextBuilder::class)->build($virtual, app(DocumentInspector::class)->sources($virtual))->data;

    expect($context['document']['intro'])->toBe('Unsaved')
        ->and($context['document']['net_total'])->toBe('200.00')
        ->and($context['groups'][0]['title'])->toBe('Neu')
        ->and($document->fresh()->intro)->not->toBe('Unsaved')
        ->and($document->fresh()->net_total)->toBe('999.50')
        ->and(fn () => DraftInput::validate($document, ['groups' => [['positions' => [['kind' => 'item', 'quantity' => 12.5]]]]]))
        ->toThrow(ValidationException::class);
});

it('resolves the template: document, then document type, then the built-in fallback', function () {
    $own = Template::factory()->create();
    $typeDefault = Template::factory()->create();
    $document = groupedDraft();

    DocumentTypeSetting::query()->whereKey('invoice')->update(['template_id' => $typeDefault->id]);
    expect(TemplateResolver::for($document->fresh())?->id)->toBe($document->template_id ?? $typeDefault->id);

    $document->forceFill(['template_id' => null])->save();
    expect(TemplateResolver::for($document->fresh())?->id)->toBe($typeDefault->id);

    $document->forceFill(['template_id' => $own->id])->save();
    expect(TemplateResolver::for($document->fresh())?->id)->toBe($own->id)
        ->and(app(SnapshotBuilder::class)->build($document->fresh())['template']['id'])->toBe($own->id);
});
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

```bash
ddev artisan test --filter=ContextBuilderTest
```
Erwartet: FAIL (`Class "App\Rendering\ContextBuilder" not found`).

- [ ] **Step 3: `DraftInput` aus `UpdateDraft` herauslösen** (reine Verschiebung, Verhalten gleich)

`app/Support/DraftInput.php` – `FIELDS`, `rules()` und `checkDomain()` aus `app/Actions/UpdateDraft.php` (Stand Phase 2) unverändert übernommen, `checkDomain` wird `private static`. Weicht der Code in `UpdateDraft` inzwischen ab (Review-Fixes), gilt der Code in `UpdateDraft`:

```php
<?php

namespace App\Support;

use App\Domain\Fields\CustomValueValidator;
use App\Domain\Fields\FieldRegistry;
use App\Enums\DocumentType;
use App\Enums\FieldScope;
use App\Enums\PositionKind;
use App\Models\Contact;
use App\Models\Document;
use App\Rules\DecimalString;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Validation of draft input (UpdateDraft, and the unsaved draft of RenderPreview): Laravel rules plus
 * custom values, optional positions and contact ↔ customer. Returns the input with normalized custom values.
 */
final class DraftInput
{
    public const FIELDS = ['date', 'customer_id', 'contact_id', 'service_date', 'service_date_end', 'due_date', 'valid_until', 'intro', 'closing', 'template_id', 'locale', 'custom'];

    /**
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    public static function validate(Document $document, array $input): array
    {
        return self::checkDomain($document, Validator::make($input, self::rules())->validate());
    }

    /**
     * @return array<string, mixed>
     */
    public static function rules(): array
    {
        $date = ['sometimes', 'nullable', 'date_format:Y-m-d'];

        return [
            'date' => ['sometimes', 'required', 'date_format:Y-m-d'],
            'customer_id' => ['sometimes', 'nullable', 'string', Rule::exists('customers', 'id')->whereNull('deleted_at')],
            'contact_id' => ['sometimes', 'nullable', 'string', Rule::exists('contacts', 'id')->whereNull('deleted_at')],
            'service_date' => $date,
            'service_date_end' => $date,
            'due_date' => $date,
            'valid_until' => $date,
            'intro' => ['sometimes', 'nullable', 'string', 'max:20000'],
            'closing' => ['sometimes', 'nullable', 'string', 'max:20000'],
            'template_id' => ['sometimes', 'nullable', 'string', Rule::exists('templates', 'id')],
            'locale' => ['sometimes', 'required', Rule::in(['en', 'de'])],
            'custom' => ['sometimes', 'array'],
            'groups' => ['sometimes', 'array', 'list', 'max:200'],
            'groups.*' => ['array'],
            'groups.*.id' => ['sometimes', 'nullable', 'string'],
            'groups.*.title' => ['sometimes', 'nullable', 'string', 'max:500'],
            'groups.*.positions' => ['sometimes', 'array', 'list', 'max:1000'],
            'groups.*.positions.*' => ['array'],
            'groups.*.positions.*.id' => ['sometimes', 'nullable', 'string'],
            'groups.*.positions.*.kind' => ['required', Rule::enum(PositionKind::class)],
            'groups.*.positions.*.title' => ['sometimes', 'nullable', 'string', 'max:500'],
            'groups.*.positions.*.description' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'groups.*.positions.*.quantity' => ['sometimes', new DecimalString(4)],
            'groups.*.positions.*.unit_price' => ['sometimes', new DecimalString(4)],
            'groups.*.positions.*.unit_id' => ['sometimes', 'nullable', 'string', Rule::exists('units', 'id')],
            'groups.*.positions.*.tax_rate_id' => ['sometimes', 'nullable', 'string', Rule::exists('tax_rates', 'id')],
            'groups.*.positions.*.custom' => ['sometimes', 'array'],
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    private static function checkDomain(Document $document, array $data): array
    {
        $definitions = DomainMapper::currentFieldDefinitions();
        $errors = [];
        $messages = [];

        if (array_key_exists('custom', $data)) {
            $result = CustomValueValidator::validate(FieldRegistry::forScope($definitions, FieldScope::Document, $document->type), $data['custom'], 'custom.', false);
            $errors = $result->errors;
            $data['custom'] = $result->values;
        }

        $positionFields = FieldRegistry::forScope($definitions, FieldScope::Position, $document->type);
        foreach ($data['groups'] ?? [] as $g => $group) {
            foreach ($group['positions'] ?? [] as $p => $position) {
                $path = "groups.{$g}.positions.{$p}.";
                $result = CustomValueValidator::validate($positionFields, $position['custom'] ?? [], $path.'custom.', false);
                $errors = [...$errors, ...$result->errors];
                $data['groups'][$g]['positions'][$p]['custom'] = $result->values;

                if ($position['kind'] === PositionKind::Optional->value && $document->type !== DocumentType::Offer) {
                    $messages[$path.'kind'][] = Text::t('errors.optional_only_offers');
                }
            }
        }

        $customerId = array_key_exists('customer_id', $data) ? $data['customer_id'] : $document->customer_id;
        if (($data['contact_id'] ?? null) !== null
            && ! Contact::query()->whereKey($data['contact_id'])->where('customer_id', $customerId)->exists()) {
            $messages['contact_id'][] = Text::t('errors.contact_not_of_customer');
        }

        $messages = array_merge_recursive(FieldErrors::messages($errors), $messages);
        if ($messages !== []) {
            throw ValidationException::withMessages($messages);
        }

        return $data;
    }
}
```

In `app/Actions/UpdateDraft.php`:
- `private const FIELDS`, `rules()` und `checkDomain()` löschen;
- in `handle()` die beiden Zeilen `$data = Validator::make($input, self::rules())->validate();` und `$data = $this->checkDomain($document, $data);` ersetzen durch `$data = DraftInput::validate($document, $input);`;
- `Arr::only($data, self::FIELDS)` → `Arr::only($data, DraftInput::FIELDS)`;
- nicht mehr benutzte Imports entfernen (`CustomValueValidator`, `FieldRegistry`, `FieldScope`, `PositionKind`, `DecimalString`, `DomainMapper`, `FieldErrors`, `Text`, `Validator`, `Rule`), `use App\Support\DraftInput;` ergänzen.

```bash
ddev artisan test --filter='DraftActionsTest|DocumentFlowTest'
```
Erwartet: PASS (Verhalten unverändert).

- [ ] **Step 4: `DraftOverlay`, `TemplateResolver`, Snapshot-Anpassung**

`app/Support/DraftOverlay.php`:

```php
<?php

namespace App\Support;

use App\Models\Document;
use App\Models\Position;
use App\Models\PositionGroup;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Arr;

/**
 * The unsaved state of a draft for previews (editor autosave still pending): the stored draft with
 * validated DraftInput data on top. The result is an in-memory copy and must never be saved.
 */
final class DraftOverlay
{
    /**
     * @param  array<string, mixed>  $data  result of DraftInput::validate()
     */
    public static function apply(Document $draft, array $data): Document
    {
        $draft->loadMissing('groups.positions');
        $virtual = clone $draft;
        $virtual->fill(Arr::only($data, DraftInput::FIELDS));
        if (! array_key_exists('groups', $data)) {
            return $virtual;
        }

        $groups = [];
        foreach (array_values($data['groups']) as $g => $row) {
            $group = new PositionGroup(['title' => $row['title'] ?? null, 'sort' => $g]);
            $group->id = is_string($row['id'] ?? null) ? $row['id'] : "draft-group-{$g}";
            $positions = [];
            foreach (array_values($row['positions'] ?? []) as $p => $item) {
                $position = new Position([
                    'kind' => $item['kind'],
                    'title' => $item['title'] ?? '',
                    'description' => $item['description'] ?? '',
                    'quantity' => (string) ($item['quantity'] ?? '0'),
                    'unit_price' => (string) ($item['unit_price'] ?? '0'),
                    'unit_id' => $item['unit_id'] ?? null,
                    'tax_rate_id' => $item['tax_rate_id'] ?? null,
                    'custom' => $item['custom'] ?? [],
                    'sort' => $p,
                ]);
                $position->id = is_string($item['id'] ?? null) ? $item['id'] : "draft-position-{$g}-{$p}";
                $positions[] = $position;
            }
            $group->setRelation('positions', new Collection($positions));
            $groups[] = $group;
        }
        $virtual->setRelation('groups', new Collection($groups));

        return $virtual;
    }
}
```

`app/Support/TemplateResolver.php`:

```php
<?php

namespace App\Support;

use App\Models\Document;
use App\Models\DocumentTypeSetting;
use App\Models\Template;

/** Which template renders a document: its own, else its type's default, else the built-in "klar". */
final class TemplateResolver
{
    public static function for(Document $document): ?Template
    {
        $id = $document->template_id
            ?? DocumentTypeSetting::query()->whereKey($document->type->value)->value('template_id');
        $template = is_string($id) ? Template::query()->find($id) : null;

        return $template ?? self::fallback();
    }

    public static function fallback(): ?Template
    {
        return Template::query()->where('slug', 'klar')->first()
            ?? Template::query()->orderByDesc('built_in')->orderBy('name')->first();
    }
}
```

`app/Support/SnapshotBuilder.php`:
- `use App\Models\Template;` kann bleiben (Typ im Rückgabewert), die Zeile `$template = $document->template_id === null ? null : Template::query()->find($document->template_id);` wird zu `$template = TemplateResolver::for($document);` (ein Dokument ohne eigenes Template friert so das tatsächlich benutzte ein);
- der `org`-Block wandert in eine öffentliche Methode, `build()` ruft `'org' => self::orgRow(Organization::current()),`:

```php
    /**
     * @return array<string, mixed>
     */
    public static function orgRow(Organization $org): array
    {
        return [
            ...$org->only(['name', 'street', 'zip', 'city', 'country', 'logo_path', 'vat_id', 'tax_number', 'iban', 'bic', 'bank_name', 'email', 'phone', 'website', 'locale']),
            'taxation_mode' => $org->taxation_mode->value,
            'custom' => $org->custom ?? [],
        ];
    }
```

- [ ] **Step 5: ContextBuilder implementieren**

`app/Rendering/Amounts.php`:

```php
<?php

namespace App\Rendering;

use Brick\Math\BigDecimal;

/** Display form of stored decimals in the template context. */
final class Amounts
{
    /** Quantities: "10.0000" → "10", "1.2500" → "1.25". */
    public static function plain(string|int|null $value): string
    {
        return (string) BigDecimal::of($value ?? 0)->strippedOfTrailingZeros();
    }

    /** Prices keep at least two decimals: "95.0000" → "95.00", "12.3456" stays. */
    public static function price(string|int|null $value): string
    {
        $price = BigDecimal::of($value ?? 0)->strippedOfTrailingZeros();

        return (string) ($price->getScale() < 2 ? $price->toScale(2) : $price);
    }
}
```

`app/Rendering/TemplateContext.php`:

```php
<?php

namespace App\Rendering;

use App\Domain\Totals\Totals;

final readonly class TemplateContext
{
    /**
     * @param  array<string, mixed>  $data  Liquid variables (raw, not escaped)
     */
    public function __construct(
        public array $data,
        public Totals $totals,
    ) {}
}
```

`app/Rendering/ContextBuilder.php`:

```php
<?php

namespace App\Rendering;

use App\Enums\PositionKind;
use App\Enums\TaxationMode;
use App\Models\Document;
use App\Support\DocumentInspector;
use App\Support\Text;

/**
 * Liquid context of a document (port of prototypes/clickdummy-v2/src/domain/templateContext.ts):
 * org, customer, contact, document, groups, positions. Custom fields sit directly on their object;
 * core values come last and win (FieldRegistry reserves those keys, so this only matters for bad data).
 * Values are raw – LiquidRenderer escapes them. Amounts are strings, dates YYYY-MM-DD.
 */
final class ContextBuilder
{
    public function __construct(
        private readonly DocumentInspector $inspector,
        private readonly AssetInliner $assets,
    ) {}

    /**
     * @param  array<string, mixed>  $sources  snapshot-shaped master data (SnapshotBuilder, snapshot, SampleDataFactory)
     */
    public function build(Document $document, array $sources): TemplateContext
    {
        $totals = $this->inspector->totals($document, $sources);
        $summary = $totals->toArray();
        $locale = $document->locale;
        $units = array_column($sources['units'], null, 'id');

        $index = 0;
        $groups = [];
        foreach ($document->groups as $group) {
            $hasTitle = $group->title !== null && $group->title !== '';
            $positions = [];
            foreach ($group->positions as $position) {
                $line = $totals->lines[$position->id] ?? null;
                $unit = $position->unit_id === null ? null : ($units[$position->unit_id] ?? null);
                $positions[] = [
                    ...($position->custom ?? []),
                    'index' => $position->kind === PositionKind::Text ? null : ++$index,
                    'kind' => $position->kind->value,
                    'is_item' => $position->kind === PositionKind::Item,
                    'is_text' => $position->kind === PositionKind::Text,
                    'is_optional' => $position->kind === PositionKind::Optional,
                    'title' => $position->title,
                    'description' => $position->description ?? '',
                    'quantity' => Amounts::plain($position->quantity),
                    'unit' => (string) ($unit['symbol'] ?? ''),
                    'unit_name' => (string) ($unit['name'] ?? ''),
                    'unit_code' => (string) ($unit['code'] ?? ''),
                    'unit_price' => Amounts::price($position->unit_price),
                    'tax_percent' => $line?->tax === null ? '0' : (string) $line->tax->percent->strippedOfTrailingZeros(),
                    'total' => $line === null ? '0.00' : (string) $line->net,
                    'group' => $hasTitle ? (string) $group->title : '',
                ];
            }
            $groupTotal = $totals->groups[$group->id] ?? null;
            $groups[] = [
                'title' => $hasTitle ? (string) $group->title : '',
                'has_title' => $hasTitle,
                'total' => $groupTotal === null ? '0.00' : (string) $groupTotal->net,
                'optional_total' => $groupTotal === null ? '0.00' : (string) $groupTotal->optionalNet,
                'positions' => $positions,
            ];
        }

        $org = $sources['org'];
        $customer = $sources['customer'];
        $contact = $sources['contact'];

        return new TemplateContext([
            'org' => [
                ...($org['custom'] ?? []),
                ...self::pick($org, ['name', 'street', 'zip', 'city', 'country', 'vat_id', 'tax_number', 'iban', 'bic', 'bank_name', 'email', 'phone', 'website']),
                'logo' => $this->assets->logo($org['logo_path'] ?? null),
                'taxation_mode' => (string) $org['taxation_mode'],
                'small_business' => $org['taxation_mode'] === TaxationMode::SmallBusiness->value,
                'locale' => (string) ($org['locale'] ?? 'en'),
            ],
            'customer' => $customer === null ? null : [
                ...($customer['custom'] ?? []),
                ...self::pick($customer, ['number', 'name', 'street', 'zip', 'city', 'country', 'email', 'vat_id', 'tax_treatment']),
                'locale' => $customer['locale'] ?? null,
            ],
            'contact' => $contact === null ? null : [
                ...($contact['custom'] ?? []),
                ...self::pick($contact, ['salutation', 'first_name', 'last_name']),
                'full_name' => trim(($contact['first_name'] ?? '').' '.($contact['last_name'] ?? '')),
                ...self::pick($contact, ['position', 'email', 'phone']),
            ],
            'document' => [
                ...($document->custom ?? []),
                'type' => $document->type->value,
                'type_label' => Text::t('document_type.'.$document->type->value, [], $locale),
                'status' => $document->status->value,
                'number' => $document->number ?? Text::t('template.draft', [], $locale),
                'date' => $document->date?->toDateString(),
                'due_date' => $document->due_date?->toDateString(),
                'valid_until' => $document->valid_until?->toDateString(),
                'service_date' => $document->service_date?->toDateString(),
                'service_date_end' => $document->service_date_end?->toDateString(),
                'locale' => $locale,
                'intro' => $document->intro ?? '',
                'closing' => $document->closing ?? '',
                'net_total' => $summary['net'],
                'tax_total' => $summary['tax'],
                'gross_total' => $summary['gross'],
                'optional_total' => $summary['optional_net'],
                'tax_breakdown' => $summary['tax_breakdown'],
                'legal_notes' => $summary['legal_notes'],
                'source_number' => $document->source_id === null ? null : Document::query()->whereKey($document->source_id)->value('number'),
            ],
            'positions' => array_merge([], ...array_column($groups, 'positions')),
            'groups' => $groups,
        ], $totals);
    }

    /**
     * @param  array<string, mixed>  $row
     * @param  list<string>  $keys
     * @return array<string, string>
     */
    private static function pick(array $row, array $keys): array
    {
        $values = [];
        foreach ($keys as $key) {
            $values[$key] = (string) ($row[$key] ?? '');
        }

        return $values;
    }
}
```

- [ ] **Step 6: Sprachschlüssel ergänzen** (danach sortieren wie in Task 2)

| Schlüssel | en | de |
|---|---|---|
| `document_type.cancellation` | `Cancellation` | `Stornorechnung` |
| `document_type.confirmation` | `Order confirmation` | `Auftragsbestätigung` |
| `document_type.invoice` | `Invoice` | `Rechnung` |
| `document_type.offer` | `Quote` | `Angebot` |

- [ ] **Step 7: Tests laufen lassen**

```bash
ddev artisan test --filter=ContextBuilderTest
ddev artisan test
```
Erwartet: `ContextBuilderTest` grün, danach die ganze Suite grün. Hinweise:
- 10 × 95 = 950,00 + 49,50 = 999,50 netto, 19 % → 189,905 → kaufmännisch 189,91 (`TotalsCalculator` rundet die Steuer je Satz einmal).
- Falls `DocumentInspectorTest` oder ein anderer Phase-2-Test erwartet, dass `snapshot.template` ohne eigenes Template `null` ist: Er bleibt `null`, solange es kein Template gibt; nach Task 8 (mitgelieferte Templates per Migration) ist es „klar“. Solche Erwartungen dann auf `TemplateResolver::for()` umstellen.

- [ ] **Step 8: Commit**

```bash
ddev exec vendor/bin/pint
git add app/Support app/Rendering app/Actions/UpdateDraft.php lang tests/Feature/Rendering/ContextBuilderTest.php
git commit -m "$(cat <<'EOF'
feat(rendering): build the liquid context from documents, snapshots and unsaved drafts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: SampleDataFactory – deterministische Beispieldaten für fünf Szenarien

**Files:**
- Create: `app/Enums/RenderScenario.php`, `app/Rendering/SampleData.php`, `app/Rendering/SampleDataFactory.php`
- Modify: `tests/Unit/EnumsTest.php`
- Test: `tests/Feature/Rendering/SampleDataFactoryTest.php`

**Interfaces:**
- Consumes: Task 5 (`ContextBuilder`, `SnapshotBuilder::orgRow()`)
- Produces: `App\Enums\RenderScenario` (+ `documentType(): DocumentType`), `SampleDataFactory::make(RenderScenario $scenario, string $locale): SampleData`, `SampleData{Document $document, array $sources}`

- [ ] **Step 1: Failing tests schreiben**

`tests/Unit/EnumsTest.php` – Import `use App\Enums\RenderScenario;` und Dataset-Eintrag:

```php
    'render scenarios' => [RenderScenario::class, ['short_invoice', 'long_invoice', 'small_business', 'reverse_charge', 'offer_with_options']],
```

`tests/Feature/Rendering/SampleDataFactoryTest.php`:

```php
<?php

use App\Enums\FieldScope;
use App\Enums\FieldType;
use App\Enums\RenderScenario;
use App\Models\Document;
use App\Models\FieldDefinition;
use App\Models\Organization;
use App\Rendering\ContextBuilder;
use App\Rendering\SampleDataFactory;
use App\Support\Text;

/** @return array<string, mixed> */
function sampleContext(RenderScenario $scenario, string $locale = 'de'): array
{
    $sample = app(SampleDataFactory::class)->make($scenario, $locale);

    return app(ContextBuilder::class)->build($sample->document, $sample->sources)->data;
}

it('is deterministic and writes nothing', function (RenderScenario $scenario) {
    expect(sampleContext($scenario))->toBe(sampleContext($scenario))
        ->and(Document::query()->count())->toBe(0);
})->with(RenderScenario::cases());

it('fills an empty organization with the fictional sample organization', function () {
    expect(sampleContext(RenderScenario::ShortInvoice)['org'])->toMatchArray(['name' => 'Studio Nordlicht', 'city' => 'Hamburg', 'small_business' => false]);

    Organization::current()->forceFill(['name' => 'Kulturwerk Elbinsel e. V.', 'city' => 'Hamburg'])->save();
    expect(sampleContext(RenderScenario::ShortInvoice)['org']['name'])->toBe('Kulturwerk Elbinsel e. V.');
});

it('covers a short invoice', function () {
    $context = sampleContext(RenderScenario::ShortInvoice);

    expect($context['document'])->toMatchArray(['type' => 'invoice', 'number' => 'INV-2026-0042', 'date' => '2026-10-01', 'due_date' => '2026-10-15', 'service_date' => '2026-09-30', 'net_total' => '3450.00', 'tax_total' => '655.50', 'gross_total' => '4105.50'])
        ->and($context['positions'])->toHaveCount(3)
        ->and($context['groups'])->toHaveCount(1)
        ->and($context['groups'][0]['has_title'])->toBeFalse()
        ->and($context['customer']['name'])->toBe('Hafenkontor Lindqvist GmbH')
        ->and($context['contact']['full_name'])->toBe('Mira Albers');
});

it('covers a long invoice over several groups', function () {
    $context = sampleContext(RenderScenario::LongInvoice);

    expect($context['groups'])->toHaveCount(4)
        ->and(count($context['positions']))->toBe(49)
        ->and(array_filter($context['positions'], fn (array $p): bool => $p['is_text']))->toHaveCount(1)
        ->and($context['groups'][0]['has_title'])->toBeTrue();
});

it('covers small business and reverse charge with their legal notes', function () {
    $small = sampleContext(RenderScenario::SmallBusiness);
    $reverse = sampleContext(RenderScenario::ReverseCharge);

    expect($small['org']['small_business'])->toBeTrue()
        ->and($small['document']['tax_total'])->toBe('0.00')
        ->and($small['document']['legal_notes'])->toBe([Text::t('legal.small_business', [], 'de')])
        ->and($reverse['customer'])->toMatchArray(['name' => 'Hotel Alpenglück', 'country' => 'AT', 'vat_id' => 'ATU12345678', 'tax_treatment' => 'eu_reverse_charge'])
        ->and($reverse['document']['tax_breakdown'][0]['category'])->toBe('AE')
        ->and($reverse['document']['legal_notes'])->toBe([Text::t('legal.reverse_charge', [], 'de')]);
});

it('covers an offer with optional positions', function () {
    $context = sampleContext(RenderScenario::OfferWithOptions, 'en');

    expect($context['document'])->toMatchArray(['type' => 'offer', 'type_label' => 'Quote', 'number' => 'Q-2026-0042', 'valid_until' => '2026-10-31', 'due_date' => null, 'optional_total' => '1788.00'])
        ->and(array_column($context['positions'], 'is_optional'))->toContain(true)
        ->and($context['groups'][1]['optional_total'])->toBe('1788.00');
});

it('fills custom fields from their definitions', function () {
    FieldDefinition::factory()->create(['scope' => FieldScope::Document, 'key' => 'project_name', 'label' => 'Projektname', 'type' => FieldType::Text, 'doc_types' => ['invoice']]);
    FieldDefinition::factory()->create(['scope' => FieldScope::Document, 'key' => 'response_time', 'label' => 'Reaktionszeit', 'type' => FieldType::Select, 'options' => ['24 Stunden', '48 Stunden'], 'doc_types' => ['offer']]);
    FieldDefinition::factory()->create(['scope' => FieldScope::Position, 'key' => 'ticket', 'label' => 'Ticket', 'type' => FieldType::Text, 'default_value' => 'SHOP-142', 'doc_types' => ['invoice']]);
    FieldDefinition::factory()->create(['scope' => FieldScope::Customer, 'key' => 'supplier_number', 'label' => 'Lieferantennummer', 'type' => FieldType::Number, 'doc_types' => []]);

    $invoice = sampleContext(RenderScenario::ShortInvoice);
    $offer = sampleContext(RenderScenario::OfferWithOptions);

    expect($invoice['document']['project_name'])->toBe('Projektname')
        ->and($invoice['document'])->not->toHaveKey('response_time')
        ->and($offer['document']['response_time'])->toBe('24 Stunden')
        ->and($invoice['positions'][0]['ticket'])->toBe('SHOP-142')
        ->and($invoice['customer']['supplier_number'])->toBe('42');
});
```

Rechnung zur Kontrolle (kurze Rechnung): 1 × 890 + 3 × 760 + 24 × 95 = 890 + 2280 + 2280 = 3450,00; 19 % = 655,50; brutto 4105,50. Optional im Angebot: 12 × 149 = 1788,00. Lange Rechnung: 4 Gruppen × 12 Positionen + 1 Textzeile = 49.

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

```bash
ddev artisan test --filter='SampleDataFactoryTest|EnumsTest'
```
Erwartet: FAIL (`Class "App\Enums\RenderScenario" not found`).

- [ ] **Step 3: Implementieren**

`app/Enums/RenderScenario.php`:

```php
<?php

namespace App\Enums;

/** Sample data sets for template previews (SampleDataFactory). */
enum RenderScenario: string
{
    case ShortInvoice = 'short_invoice';
    case LongInvoice = 'long_invoice';
    case SmallBusiness = 'small_business';
    case ReverseCharge = 'reverse_charge';
    case OfferWithOptions = 'offer_with_options';

    public function documentType(): DocumentType
    {
        return $this === self::OfferWithOptions ? DocumentType::Offer : DocumentType::Invoice;
    }
}
```

`app/Rendering/SampleData.php`:

```php
<?php

namespace App\Rendering;

use App\Models\Document;

final readonly class SampleData
{
    /**
     * @param  Document  $document  in-memory document with groups and positions, never saved
     * @param  array<string, mixed>  $sources  snapshot-shaped master data
     */
    public function __construct(
        public Document $document,
        public array $sources,
    ) {}
}
```

`app/Rendering/SampleDataFactory.php`:

```php
<?php

namespace App\Rendering;

use App\Domain\Fields\FieldRegistry;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\FieldScope;
use App\Enums\FieldType;
use App\Enums\PositionKind;
use App\Enums\RenderScenario;
use App\Enums\TaxationMode;
use App\Models\Document;
use App\Models\Organization;
use App\Models\Position;
use App\Models\PositionGroup;
use App\Support\DomainMapper;
use App\Support\LegalNoteTexts;
use App\Support\SnapshotBuilder;
use Illuminate\Database\Eloquent\Collection;

/**
 * Deterministic sample documents for template previews (template editor, toolkit, golden tests):
 * fixed dates and numbers, a fictional customer and contact, fixed tax rates and units, custom fields
 * filled from their definitions. Nothing is saved. The organization is the real one; an empty one
 * (fresh instance) is replaced by the fictional Studio Nordlicht.
 */
final class SampleDataFactory
{
    private const DATE = '2026-10-01';

    private const ORG = [
        'name' => 'Studio Nordlicht', 'street' => 'Speicherstraße 12', 'zip' => '20457', 'city' => 'Hamburg', 'country' => 'DE',
        'vat_id' => 'DE123456789', 'tax_number' => '', 'iban' => 'DE02 1203 0000 0000 2020 51', 'bic' => 'BYLADEM1001',
        'bank_name' => 'Demo Bank', 'email' => 'hallo@nordlicht.example', 'phone' => '+49 40 1234567', 'website' => 'nordlicht.example',
    ];

    /** @var array<string, array{0: string, 1: int}> unit key => [UN/ECE code, decimals] */
    private const UNITS = ['hour' => ['HUR', 2], 'day' => ['DAY', 1], 'piece' => ['H87', 0], 'flat' => ['LS', 0], 'month' => ['MON', 0]];

    private const TEXT = [
        'de' => [
            'invoice_intro' => "Hallo {{ contact.first_name }},\nvielen Dank für die gute Zusammenarbeit. Wir berechnen folgende Leistungen:",
            'invoice_closing' => "Bitte überweisen Sie den Betrag bis zum {{ document.due_date | date }}.\nViele Grüße",
            'offer_intro' => "Hallo {{ contact.first_name }},\nwie besprochen bieten wir Ihnen folgende Leistungen an:",
            'offer_closing' => 'Wir freuen uns auf Ihre Rückmeldung.',
            'items' => [['Konzeption', 'Workshop mit Protokoll', '1', 'flat', '890'], ['Gestaltung', 'Startseite und Unterseiten', '3', 'day', '760'], ['Entwicklung', 'Frontend und Backend', '24', 'hour', '95']],
            'groups' => ['Konzept', 'Gestaltung', 'Umsetzung', 'Betrieb'],
            'tasks' => ['Abstimmung', 'Recherche', 'Entwurf', 'Umsetzung', 'Test', 'Dokumentation'],
            'note' => 'Inklusive zwei Korrekturschleifen.',
            'optional' => ['Wartung & Updates', 'Monatlich, inklusive Monitoring'],
            'units' => ['hour' => ['Stunde', 'Std.'], 'day' => ['Tag', 'Tage'], 'piece' => ['Stück', 'Stk.'], 'flat' => ['Pauschal', 'Psch.'], 'month' => ['Monat', 'Mon.']],
            'contact' => ['Frau', 'Leitung E-Commerce'],
        ],
        'en' => [
            'invoice_intro' => "Hello {{ contact.first_name }},\nthank you for working with us. We invoice the following services:",
            'invoice_closing' => "Please transfer the amount by {{ document.due_date | date }}.\nKind regards",
            'offer_intro' => "Hello {{ contact.first_name }},\nas discussed, we offer the following services:",
            'offer_closing' => 'We look forward to hearing from you.',
            'items' => [['Concept', 'Workshop with minutes', '1', 'flat', '890'], ['Design', 'Home page and sub pages', '3', 'day', '760'], ['Development', 'Frontend and backend', '24', 'hour', '95']],
            'groups' => ['Concept', 'Design', 'Development', 'Operations'],
            'tasks' => ['Alignment', 'Research', 'Draft', 'Implementation', 'Testing', 'Documentation'],
            'note' => 'Includes two rounds of revisions.',
            'optional' => ['Maintenance & updates', 'Monthly, including monitoring'],
            'units' => ['hour' => ['Hour', 'h'], 'day' => ['Day', 'd'], 'piece' => ['Piece', 'pc'], 'flat' => ['Flat rate', 'flat'], 'month' => ['Month', 'mo']],
            'contact' => ['Ms', 'Head of e-commerce'],
        ],
    ];

    public function make(RenderScenario $scenario, string $locale): SampleData
    {
        $locale = array_key_exists($locale, self::TEXT) ? $locale : 'en';
        $text = self::TEXT[$locale];
        $type = $scenario->documentType();
        $offer = $type === DocumentType::Offer;
        $definitions = SnapshotBuilder::fieldDefinitionRows();

        $sources = [
            'org' => $this->org($scenario, $definitions),
            'customer' => $this->customer($scenario, $locale, $definitions),
            'contact' => [
                'id' => 'sample-contact', 'salutation' => $text['contact'][0], 'first_name' => 'Mira', 'last_name' => 'Albers',
                'position' => $text['contact'][1], 'email' => 'mira.albers@hafenkontor.example', 'phone' => '+49 40 555 0101',
                'custom' => self::custom($definitions, FieldScope::Contact, null),
            ],
            'tax_rates' => [
                ['id' => 'sample-vat-19', 'label' => '19 %', 'percent' => '19.00', 'category' => 'S', 'exemption_note' => null, 'archived' => false],
                ['id' => 'sample-vat-7', 'label' => '7 %', 'percent' => '7.00', 'category' => 'S', 'exemption_note' => null, 'archived' => false],
            ],
            'units' => array_map(fn (string $key): array => [
                'id' => "sample-unit-{$key}", 'name' => $text['units'][$key][0], 'symbol' => $text['units'][$key][1],
                'decimals' => self::UNITS[$key][1], 'code' => self::UNITS[$key][0], 'archived' => false,
            ], array_keys(self::UNITS)),
            'template' => null,
            'field_definitions' => $definitions,
            'legal_notes' => LegalNoteTexts::toArray(LegalNoteTexts::for($locale)),
        ];

        $document = new Document;
        $document->forceFill([
            'type' => $type,
            'status' => DocumentStatus::Open,
            'number' => $offer ? 'Q-2026-0042' : 'INV-2026-0042',
            'date' => self::DATE,
            'service_date' => $offer ? null : '2026-09-30',
            'due_date' => $offer ? null : '2026-10-15',
            'valid_until' => $offer ? '2026-10-31' : null,
            'intro' => $text[$offer ? 'offer_intro' : 'invoice_intro'],
            'closing' => $text[$offer ? 'offer_closing' : 'invoice_closing'],
            'locale' => $locale,
            'custom' => self::custom($definitions, FieldScope::Document, $type),
        ]);
        $document->id = 'sample-'.$scenario->value;
        $document->setRelation('groups', new Collection($this->groups($scenario, $text, self::custom($definitions, FieldScope::Position, $type))));

        return new SampleData($document, $sources);
    }

    /**
     * @param  list<array<string, mixed>>  $definitions
     * @return array<string, mixed>
     */
    private function org(RenderScenario $scenario, array $definitions): array
    {
        $org = SnapshotBuilder::orgRow(Organization::current());
        if (trim((string) $org['name']) === '') {
            $org = [...$org, ...self::ORG];
        }
        $org['custom'] = [...self::custom($definitions, FieldScope::Org, null), ...$org['custom']];
        $org['taxation_mode'] = $scenario === RenderScenario::SmallBusiness ? TaxationMode::SmallBusiness->value : TaxationMode::Regular->value;

        return $org;
    }

    /**
     * @param  list<array<string, mixed>>  $definitions
     * @return array<string, mixed>
     */
    private function customer(RenderScenario $scenario, string $locale, array $definitions): array
    {
        $customer = $scenario === RenderScenario::ReverseCharge
            ? ['number' => 'K-1003', 'name' => 'Hotel Alpenglück', 'street' => 'Bergweg 7', 'zip' => '6020', 'city' => 'Innsbruck', 'country' => 'AT', 'email' => 'office@alpenglueck.example', 'vat_id' => 'ATU12345678', 'tax_treatment' => 'eu_reverse_charge']
            : ['number' => 'K-1001', 'name' => 'Hafenkontor Lindqvist GmbH', 'street' => 'Am Sandtorkai 4', 'zip' => '20457', 'city' => 'Hamburg', 'country' => 'DE', 'email' => 'buchhaltung@hafenkontor.example', 'vat_id' => 'DE987654321', 'tax_treatment' => 'domestic'];

        return ['id' => 'sample-customer', ...$customer, 'locale' => $locale, 'custom' => self::custom($definitions, FieldScope::Customer, null)];
    }

    /**
     * @param  array<string, mixed>  $text
     * @param  array<string, mixed>  $custom  sample values of the position fields
     * @return list<PositionGroup>
     */
    private function groups(RenderScenario $scenario, array $text, array $custom): array
    {
        $line = fn (string $title, string $description, string $quantity, string $unit, string $price, PositionKind $kind = PositionKind::Item): array
            => ['title' => $title, 'description' => $description, 'quantity' => $quantity, 'unit' => $unit, 'price' => $price, 'kind' => $kind];
        $items = array_map(fn (array $i): array => $line(...$i), $text['items']);
        $note = $line($text['note'], '', '0', 'hour', '0', PositionKind::Text);

        $rows = match ($scenario) {
            RenderScenario::LongInvoice => array_map(fn (int $g): array => [
                'title' => $text['groups'][$g],
                'positions' => [
                    ...array_map(fn (int $i): array => $line(
                        $text['tasks'][($g * 12 + $i) % 6].' '.($i + 1), '', (string) (($i % 5) + 1), 'hour', (string) (80 + 5 * ($i % 4)),
                    ), range(0, 11)),
                    ...($g === 1 ? [$note] : []),
                ],
            ], range(0, 3)),
            RenderScenario::OfferWithOptions => [
                ['title' => $text['groups'][0], 'positions' => [$items[0], $items[1], $note]],
                ['title' => $text['groups'][3], 'positions' => [$items[2], $line($text['optional'][0], $text['optional'][1], '12', 'month', '149', PositionKind::Optional)]],
            ],
            default => [['title' => null, 'positions' => $items]],
        };

        $groups = [];
        foreach ($rows as $g => $row) {
            $group = new PositionGroup(['title' => $row['title'], 'sort' => $g]);
            $group->id = "sample-group-{$g}";
            $positions = [];
            foreach ($row['positions'] as $p => $data) {
                $isText = $data['kind'] === PositionKind::Text;
                $position = new Position([
                    'kind' => $data['kind'],
                    'title' => $data['title'],
                    'description' => $data['description'],
                    'quantity' => $data['quantity'],
                    'unit_price' => $data['price'],
                    'unit_id' => $isText ? null : 'sample-unit-'.$data['unit'],
                    'tax_rate_id' => $isText ? null : 'sample-vat-19',
                    'custom' => $isText ? [] : $custom,
                    'sort' => $p,
                ]);
                $position->id = "sample-position-{$g}-{$p}";
                $positions[] = $position;
            }
            $group->setRelation('positions', new Collection($positions));
            $groups[] = $group;
        }

        return $groups;
    }

    /**
     * Sample values for the custom fields of one level: default value, else a value by type.
     *
     * @param  list<array<string, mixed>>  $definitions  SnapshotBuilder::fieldDefinitionRows()
     * @return array<string, mixed>
     */
    private static function custom(array $definitions, FieldScope $scope, ?DocumentType $type): array
    {
        $values = [];
        foreach (FieldRegistry::forScope(DomainMapper::fieldDefinitions($definitions), $scope, $type) as $definition) {
            $values[$definition->key] = $definition->defaultValue ?? match ($definition->type) {
                FieldType::Text => $definition->label,
                FieldType::Textarea => $definition->label."\n".$definition->label,
                FieldType::Number => '42',
                FieldType::Money => '1250.00',
                FieldType::Date => self::DATE,
                FieldType::Select => $definition->options[0] ?? '',
                FieldType::Boolean => true,
                FieldType::Image => '',
            };
        }

        return $values;
    }
}
```

- [ ] **Step 4: Tests laufen lassen**

```bash
ddev artisan test --filter='SampleDataFactoryTest|EnumsTest'
```
Erwartet: PASS. Falls `FieldDefinitionData::$options` anders heißt oder `defaultValue` bei Select einen Wert erzwingt: an `app/Domain/Fields/FieldDefinitionData.php` angleichen (Phase-2-Code ist maßgeblich). Falls `FieldDefinition::factory()` für `doc_types => []` bei Kundenfeldern eine Prüfung verlangt: `doc_types` weglassen.

- [ ] **Step 5: Commit**

```bash
ddev exec vendor/bin/pint
git add app/Enums/RenderScenario.php app/Rendering tests/Unit/EnumsTest.php tests/Feature/Rendering/SampleDataFactoryTest.php
git commit -m "$(cat <<'EOF'
feat(rendering): add deterministic sample data for five preview scenarios

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Template-Pakete – Manifest-Prüfung, ZIP-Import und -Export

**Files:**
- Create: `app/Rendering/ManifestValidator.php`, `app/Rendering/TemplatePackage.php`
- Create: `app/Support/DownloadFile.php`
- Create: `app/Actions/ImportTemplatePackage.php`, `app/Actions/ExportTemplatePackage.php`
- Modify: `lang/en.json`, `lang/de.json`
- Test: `tests/Feature/Rendering/TemplatePackageTest.php`

**Interfaces:**
- Consumes: Task 2 (`Paper::errors()`)
- Produces: `ManifestValidator::validate(mixed): array<string, string>`, `TemplatePackage(array $manifest, string $header, string $body, string $footer, string $css, array $assets = [])` mit `FILES`, `ASSET_TYPES`, `fromDirectory(string)`, `fromZip(string)`, `fromTemplate(Template)`, `toZip(): string`, `mimeOf(string)`, `DownloadFile{filename, mimeType, contents}` + `nameFor(Document, string)`, `ImportTemplatePackage::handle(Actor, string $zipPath): Template`, `ExportTemplatePackage::handle(Actor, Template): DownloadFile`, `SyncBuiltInTemplates::SLUGS`

Paketformat (wird in `docs/*/templates.md` beschrieben): `manifest.json` (Pflicht), `template.liquid` (Pflicht), `header.liquid`, `footer.liquid`, `styles.css` (optional, leer wenn fehlend), `assets/…` (Bilder und Schriften). Erlaubt ist auch ein ZIP mit genau einem Ordner auf oberster Ebene (so packt macOS/Windows einen Ordner); `__MACOSX/` und `.DS_Store` werden ignoriert.

- [ ] **Step 1: Failing tests schreiben**

`tests/Feature/Rendering/TemplatePackageTest.php`:

```php
<?php

use App\Actions\ExportTemplatePackage;
use App\Actions\ImportTemplatePackage;
use App\Models\Template;
use App\Rendering\ManifestValidator;
use App\Rendering\TemplatePackage;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/** @param  array<string, string>  $files */
function zipOf(array $files): string
{
    $path = (string) tempnam(sys_get_temp_dir(), 'openbill-test-');
    $zip = new ZipArchive;
    $zip->open($path, ZipArchive::OVERWRITE);
    foreach ($files as $name => $contents) {
        $zip->addFromString($name, $contents);
    }
    $zip->close();

    return $path;
}

/** @return array<string, string> */
function packageFiles(array $manifest = [], array $extra = []): array
{
    return [
        'manifest.json' => json_encode([
            'name' => 'Nordlicht Brief', 'version' => '1.2.0', 'author' => 'Studio Nordlicht', 'license' => 'MIT',
            'description' => 'Briefbogen', 'documentTypes' => ['invoice'],
            'expectedFields' => [['scope' => 'document', 'key' => 'project_name', 'type' => 'text', 'fallback' => '']],
            'paper' => ['format' => 'A4', 'marginX' => '20mm', 'headerHeight' => '30mm', 'footerHeight' => '20mm'],
            ...$manifest,
        ]),
        'template.liquid' => '<h1>{{ document.number }}</h1><img src="assets/logo.svg">',
        'header.liquid' => '<b>{{ org.name }}</b>',
        'footer.liquid' => '{{ page.number }}',
        'styles.css' => 'h1 { font-size: 14pt; }',
        'assets/logo.svg' => '<svg xmlns="http://www.w3.org/2000/svg"/>',
        ...$extra,
    ];
}

function importErrors(string $zipPath): array
{
    try {
        app(ImportTemplatePackage::class)->handle(systemActor(), $zipPath);
    } catch (ValidationException $e) {
        return $e->errors();
    }

    return [];
}

it('imports a package with its assets as a new template', function () {
    $template = app(ImportTemplatePackage::class)->handle(systemActor(), zipOf(packageFiles()));

    expect($template->only(['name', 'slug', 'version', 'author', 'license', 'description', 'built_in']))->toBe([
        'name' => 'Nordlicht Brief', 'slug' => 'nordlicht-brief', 'version' => '1.2.0', 'author' => 'Studio Nordlicht',
        'license' => 'MIT', 'description' => 'Briefbogen', 'built_in' => false,
    ])
        ->and($template->body)->toContain('<h1>')
        ->and($template->css)->toBe('h1 { font-size: 14pt; }')
        ->and($template->manifest['paper']['format'])->toBe('A4')
        ->and($template->assets->pluck('path')->all())->toBe(['assets/logo.svg'])
        ->and($template->assets->first()->mime)->toBe('image/svg+xml');

    Storage::disk('local')->assertExists($template->assets->first()->storage_path);
});

it('accepts a zipped folder and ignores macOS metadata', function () {
    $files = [];
    foreach (packageFiles() as $name => $contents) {
        $files["nordlicht/{$name}"] = $contents;
    }
    $files['__MACOSX/nordlicht/._template.liquid'] = 'x';
    $files['nordlicht/.DS_Store'] = 'x';

    expect(app(ImportTemplatePackage::class)->handle(systemActor(), zipOf($files))->slug)->toBe('nordlicht-brief');
});

it('gives imported templates a free slug and never takes a built-in one', function () {
    $first = app(ImportTemplatePackage::class)->handle(systemActor(), zipOf(packageFiles()));
    $second = app(ImportTemplatePackage::class)->handle(systemActor(), zipOf(packageFiles()));
    $klar = app(ImportTemplatePackage::class)->handle(systemActor(), zipOf(packageFiles(['name' => 'Klar'])));

    expect([$first->slug, $second->slug, $klar->slug])->toBe(['nordlicht-brief', 'nordlicht-brief-2', 'klar-2']);
});

it('refuses unsafe or broken packages with a path and creates nothing', function (array $files, string $key) {
    expect(importErrors(zipOf($files)))->toHaveKey($key)
        ->and(Template::query()->where('built_in', false)->count())->toBe(0);
})->with([
    'path traversal' => [packageFiles([], ['../evil.liquid' => 'x']), 'package'],
    'absolute path' => [packageFiles([], ['/etc/passwd' => 'x']), 'package'],
    'unknown file' => [packageFiles([], ['run.php' => '<?php']), 'package'],
    'executable asset' => [packageFiles([], ['assets/tool.exe' => 'MZ']), 'assets.assets/tool.exe'],
    'missing template' => [array_diff_key(packageFiles(), ['template.liquid' => true]), 'package'],
    'missing manifest' => [array_diff_key(packageFiles(), ['manifest.json' => true]), 'package'],
    'broken json' => [[...packageFiles(), 'manifest.json' => '{'], 'manifest'],
    'bad version' => [packageFiles(['version' => 'latest']), 'manifest.version'],
    'bad paper' => [packageFiles(['paper' => ['format' => 'A3']]), 'manifest.paper.format'],
    'bad document type' => [packageFiles(['documentTypes' => ['receipt']]), 'manifest.documentTypes'],
    'no name' => [packageFiles(['name' => '']), 'manifest.name'],
]);

it('refuses a file that is no ZIP and a ZIP bomb', function () {
    $notZip = (string) tempnam(sys_get_temp_dir(), 'openbill-test-');
    file_put_contents($notZip, 'plain text');
    config(['openbill.templates.max_unpacked_bytes' => 1024]);

    expect(importErrors($notZip))->toHaveKey('package')
        ->and(importErrors(zipOf(packageFiles([], ['assets/big.png' => str_repeat('0', 4096)]))))->toHaveKey('package');
});

it('exports a template as a package that imports to the same template', function () {
    $original = app(ImportTemplatePackage::class)->handle(systemActor(), zipOf(packageFiles()));

    $download = app(ExportTemplatePackage::class)->handle(systemActor(), $original);
    $path = (string) tempnam(sys_get_temp_dir(), 'openbill-test-');
    file_put_contents($path, $download->contents);
    $copy = app(ImportTemplatePackage::class)->handle(systemActor(), $path);

    expect($download->filename)->toBe('nordlicht-brief-1.2.0.zip')
        ->and($download->mimeType)->toBe('application/zip')
        ->and($copy->only(['name', 'version', 'header', 'body', 'footer', 'css']))->toBe($original->only(['name', 'version', 'header', 'body', 'footer', 'css']))
        ->and($copy->manifest)->toBe($original->manifest)
        ->and(Storage::disk('local')->get($copy->assets->first()->storage_path))->toBe('<svg xmlns="http://www.w3.org/2000/svg"/>');
});

it('validates manifests field by field', function () {
    expect(ManifestValidator::validate(json_decode(packageFiles()['manifest.json'], true)))->toBe([])
        ->and(array_keys(ManifestValidator::validate(['name' => 'X', 'version' => '1.0.0', 'expectedFields' => [['key' => 'x']], 'translations' => ['fr' => ['a' => 'b']]])))
        ->toBe(['expectedFields.0', 'translations'])
        ->and(ManifestValidator::validate('nope'))->toHaveKey('manifest');
});

it('reads a package from a directory', function () {
    $dir = sys_get_temp_dir().'/openbill-package-'.uniqid();
    mkdir("{$dir}/assets", 0777, true);
    foreach (packageFiles() as $name => $contents) {
        file_put_contents("{$dir}/{$name}", $contents);
    }

    $package = TemplatePackage::fromDirectory($dir);

    expect($package->manifest['name'])->toBe('Nordlicht Brief')
        ->and($package->body)->toContain('<h1>')
        ->and($package->assets)->toBe(['assets/logo.svg' => '<svg xmlns="http://www.w3.org/2000/svg"/>']);
});
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

```bash
ddev artisan test --filter=TemplatePackageTest
```
Erwartet: FAIL (`Class "App\Actions\ImportTemplatePackage" not found`).

- [ ] **Step 3: ManifestValidator**

`app/Rendering/ManifestValidator.php`:

```php
<?php

namespace App\Rendering;

use App\Enums\DocumentType;
use App\Enums\FieldScope;
use App\Enums\FieldType;
use App\Support\Text;

/** manifest.json of a template package. Paths without the "manifest." prefix (the import adds it). */
final class ManifestValidator
{
    /**
     * @return array<string, string> path => message
     */
    public static function validate(mixed $manifest): array
    {
        if (! is_array($manifest) || array_is_list($manifest)) {
            return ['manifest' => Text::t('template_package.manifest_object')];
        }

        $errors = [];
        foreach (['name' => 100, 'version' => 32, 'author' => 255, 'license' => 64, 'description' => 1000] as $field => $max) {
            $value = $manifest[$field] ?? null;
            $required = $field === 'name' || $field === 'version';
            if ($value === null && ! $required) {
                continue;
            }
            if (! is_string($value) || ($required && trim($value) === '') || mb_strlen($value) > $max) {
                $errors[$field] = $required && ! (is_string($value) && trim($value) !== '')
                    ? Text::t('template_package.required', ['field' => $field])
                    : Text::t('template_package.string', ['field' => $field, 'max' => $max]);
            }
        }
        if (! isset($errors['version']) && preg_match('/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/', (string) $manifest['version']) !== 1) {
            $errors['version'] = Text::t('template_package.version');
        }

        if (array_key_exists('documentTypes', $manifest)) {
            $types = $manifest['documentTypes'];
            if (! is_array($types) || ! array_is_list($types) || $types === []
                || array_filter($types, fn (mixed $t): bool => ! is_string($t) || DocumentType::tryFrom($t) === null) !== []) {
                $errors['documentTypes'] = Text::t('template_package.document_types');
            }
        }

        $fields = $manifest['expectedFields'] ?? [];
        if (! is_array($fields) || ! array_is_list($fields)) {
            $errors['expectedFields'] = Text::t('template_package.expected_fields', ['index' => 0]);
        } else {
            foreach ($fields as $i => $field) {
                if (! is_array($field) || ! is_string($field['key'] ?? null)
                    || FieldScope::tryFrom((string) ($field['scope'] ?? '')) === null
                    || FieldType::tryFrom((string) ($field['type'] ?? '')) === null) {
                    $errors["expectedFields.{$i}"] = Text::t('template_package.expected_fields', ['index' => $i]);
                }
            }
        }

        $errors = [...$errors, ...Paper::errors($manifest['paper'] ?? null)];

        if (array_key_exists('translations', $manifest)) {
            $translations = $manifest['translations'];
            $valid = is_array($translations) && ! array_is_list($translations);
            foreach ($valid ? $translations : [] as $locale => $words) {
                $valid = $valid && in_array($locale, ['en', 'de'], true) && is_array($words)
                    && array_filter($words, fn (mixed $w, mixed $k): bool => ! is_string($k) || ! is_string($w), ARRAY_FILTER_USE_BOTH) === [];
            }
            if (! $valid) {
                $errors['translations'] = Text::t('template_package.translations');
            }
        }

        return $errors;
    }
}
```

- [ ] **Step 4: TemplatePackage**

`app/Rendering/TemplatePackage.php`:

```php
<?php

namespace App\Rendering;

use App\Models\Template;
use App\Support\Text;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use JsonException;
use RuntimeException;
use ZipArchive;

/**
 * Template package: manifest.json, template.liquid, header.liquid, footer.liquid, styles.css, assets/…
 * Read from a ZIP (import, untrusted: paths, types and sizes are checked) or a directory (built-ins).
 */
final readonly class TemplatePackage
{
    /** Template column => file in the package. */
    public const FILES = ['header' => 'header.liquid', 'body' => 'template.liquid', 'footer' => 'footer.liquid', 'css' => 'styles.css'];

    /** Allowed asset types by extension. */
    public const ASSET_TYPES = [
        'png' => 'image/png', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'gif' => 'image/gif', 'webp' => 'image/webp',
        'svg' => 'image/svg+xml', 'woff' => 'font/woff', 'woff2' => 'font/woff2', 'ttf' => 'font/ttf', 'otf' => 'font/otf',
    ];

    /**
     * @param  array<string, mixed>  $manifest
     * @param  array<string, string>  $assets  package path ("assets/logo.svg") => contents
     */
    public function __construct(
        public array $manifest,
        public string $header,
        public string $body,
        public string $footer,
        public string $css,
        public array $assets = [],
    ) {}

    /** Trusted source (resources/templates/<slug>). */
    public static function fromDirectory(string $dir): self
    {
        $read = fn (string $file): string => is_file("{$dir}/{$file}") ? (string) file_get_contents("{$dir}/{$file}") : '';
        $assets = [];
        foreach (glob("{$dir}/assets/*") ?: [] as $file) {
            $assets['assets/'.basename($file)] = (string) file_get_contents($file);
        }

        return new self(
            json_decode($read('manifest.json'), true, flags: JSON_THROW_ON_ERROR),
            $read(self::FILES['header']),
            $read(self::FILES['body']),
            $read(self::FILES['footer']),
            $read(self::FILES['css']),
            $assets,
        );
    }

    /**
     * Untrusted ZIP upload.
     *
     * @throws ValidationException
     */
    public static function fromZip(string $path): self
    {
        $limits = config('openbill.templates');
        if (! is_file($path) || filesize($path) > $limits['max_package_bytes']) {
            self::fail('package', 'template_package.too_large', ['mb' => intdiv($limits['max_package_bytes'], 1024 * 1024)]);
        }
        $zip = new ZipArchive;
        if ($zip->open($path, ZipArchive::RDONLY) !== true) {
            self::fail('package', 'template_package.not_a_zip');
        }

        try {
            if ($zip->numFiles > $limits['max_entries']) {
                self::fail('package', 'template_package.too_many_files', ['max' => $limits['max_entries']]);
            }

            $entries = [];
            $unpacked = 0;
            for ($i = 0; $i < $zip->numFiles; $i++) {
                $stat = $zip->statIndex($i);
                $name = is_array($stat) ? (string) $stat['name'] : '';
                if (str_ends_with($name, '/') || str_starts_with($name, '__MACOSX/') || basename($name) === '.DS_Store') {
                    continue;
                }
                if (! self::safePath($name)) {
                    self::fail('package', 'template_package.bad_path', ['path' => $name]);
                }
                $unpacked += (int) $stat['size'];
                if ($unpacked > $limits['max_unpacked_bytes']) {
                    self::fail('package', 'template_package.too_large', ['mb' => intdiv($limits['max_unpacked_bytes'], 1024 * 1024)]);
                }
                $entries[$name] = $i;
            }
            $entries = self::withoutCommonFolder($entries);

            foreach (array_keys($entries) as $name) {
                if (in_array($name, ['manifest.json', ...array_values(self::FILES)], true)) {
                    continue;
                }
                if (! str_starts_with($name, 'assets/')) {
                    self::fail('package', 'template_package.unknown_file', ['path' => $name]);
                }
                if (! array_key_exists(strtolower(pathinfo($name, PATHINFO_EXTENSION)), self::ASSET_TYPES)) {
                    self::fail("assets.{$name}", 'template_package.asset_type', ['path' => $name]);
                }
                if ((int) ($zip->statIndex($entries[$name])['size'] ?? 0) > $limits['max_asset_bytes']) {
                    self::fail("assets.{$name}", 'template_package.asset_too_large', ['path' => $name, 'mb' => intdiv($limits['max_asset_bytes'], 1024 * 1024)]);
                }
            }
            foreach (['manifest.json', self::FILES['body']] as $required) {
                if (! isset($entries[$required])) {
                    self::fail('package', 'template_package.missing_file', ['file' => $required]);
                }
            }

            $text = function (string $file) use ($zip, $entries): string {
                if (! isset($entries[$file])) {
                    return '';
                }
                $contents = (string) $zip->getFromIndex($entries[$file]);
                if (! mb_check_encoding($contents, 'UTF-8')) {
                    self::fail('package', 'template_package.not_utf8', ['file' => $file]);
                }

                return $contents;
            };

            try {
                $manifest = json_decode($text('manifest.json'), true, flags: JSON_THROW_ON_ERROR);
            } catch (JsonException) {
                self::fail('manifest', 'template_package.manifest_json');
            }
            $errors = ManifestValidator::validate($manifest);
            if ($errors !== []) {
                $paths = array_map(fn (string $path): string => $path === 'manifest' ? 'manifest' : "manifest.{$path}", array_keys($errors));
                throw ValidationException::withMessages(array_combine($paths, array_values($errors)));
            }

            $assets = [];
            foreach ($entries as $name => $index) {
                if (str_starts_with($name, 'assets/')) {
                    $assets[$name] = (string) $zip->getFromIndex($index);
                }
            }

            return new self($manifest, $text(self::FILES['header']), $text(self::FILES['body']), $text(self::FILES['footer']), $text(self::FILES['css']), $assets);
        } finally {
            $zip->close();
        }
    }

    /** Export: columns win over the stored manifest for name, version, author, license, description. */
    public static function fromTemplate(Template $template): self
    {
        $assets = [];
        foreach ($template->assets as $asset) {
            $assets[$asset->path] = (string) Storage::disk('local')->get($asset->storage_path);
        }
        $manifest = [
            ...($template->manifest ?? []),
            'name' => $template->name,
            'version' => $template->version,
            'author' => $template->author,
            'license' => $template->license,
            'description' => (string) $template->description,
        ];

        return new self($manifest, (string) $template->header, (string) $template->body, (string) $template->footer, (string) $template->css, $assets);
    }

    public function toZip(): string
    {
        $path = tempnam(sys_get_temp_dir(), 'openbill-template-');
        if ($path === false) {
            throw new RuntimeException('Could not create a temporary file for the template package.');
        }
        try {
            $zip = new ZipArchive;
            $zip->open($path, ZipArchive::OVERWRITE);
            $zip->addFromString('manifest.json', json_encode($this->manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)."\n");
            foreach (self::FILES as $column => $file) {
                $zip->addFromString($file, $this->{$column});
            }
            foreach ($this->assets as $name => $contents) {
                $zip->addFromString($name, $contents);
            }
            $zip->close();

            return (string) file_get_contents($path);
        } finally {
            if (is_file($path)) {
                unlink($path);
            }
        }
    }

    public static function mimeOf(string $path): string
    {
        return self::ASSET_TYPES[strtolower(pathinfo($path, PATHINFO_EXTENSION))] ?? 'application/octet-stream';
    }

    private static function safePath(string $name): bool
    {
        if ($name === '' || str_contains($name, "\0") || str_contains($name, '\\') || str_starts_with($name, '/') || preg_match('/^[A-Za-z]:/', $name) === 1) {
            return false;
        }
        $segments = explode('/', $name);

        return ! in_array('..', $segments, true) && ! in_array('.', $segments, true) && ! in_array('', $segments, true);
    }

    /**
     * "folder/manifest.json", "folder/template.liquid", … → "manifest.json", … when everything sits in one folder.
     *
     * @param  array<string, int>  $entries
     * @return array<string, int>
     */
    private static function withoutCommonFolder(array $entries): array
    {
        if ($entries === [] || isset($entries['manifest.json'])) {
            return $entries;
        }
        $folders = array_unique(array_map(fn (string $name): string => explode('/', $name, 2)[0], array_keys($entries)));
        if (count($folders) !== 1) {
            return $entries;
        }
        $prefix = reset($folders).'/';
        $stripped = [];
        foreach ($entries as $name => $index) {
            $stripped[substr($name, strlen($prefix))] = $index;
        }

        return $stripped;
    }

    /**
     * @param  array<string, string|int>  $replace
     *
     * @throws ValidationException
     */
    private static function fail(string $path, string $key, array $replace = []): never
    {
        throw ValidationException::withMessages([$path => Text::t($key, $replace)]);
    }
}
```

- [ ] **Step 5: DownloadFile und Actions**

`app/Support/DownloadFile.php`:

```php
<?php

namespace App\Support;

use App\Models\Document;

/** A file an action hands out (PDF, XML, template package); controllers turn it into a download response. */
final readonly class DownloadFile
{
    public function __construct(
        public string $filename,
        public string $mimeType,
        public string $contents,
    ) {}

    /** "INV-2026-0001.pdf", drafts "draft-<id>.pdf". */
    public static function nameFor(Document $document, string $extension): string
    {
        $base = $document->number ?? 'draft-'.$document->id;

        return preg_replace('/[^A-Za-z0-9._-]+/', '-', $base).'.'.$extension;
    }
}
```

`app/Actions/ImportTemplatePackage.php`:

```php
<?php

namespace App\Actions;

use App\Models\Template;
use App\Rendering\TemplatePackage;
use App\Support\Actor;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/** Template package (ZIP) → new, editable template. Assets go to the local disk under templates/<id>/. */
final class ImportTemplatePackage
{
    /**
     * @throws ValidationException
     */
    public function handle(Actor $actor, string $zipPath): Template
    {
        $package = TemplatePackage::fromZip($zipPath);

        return DB::transaction(function () use ($package): Template {
            $manifest = $package->manifest;
            $template = Template::query()->create([
                'name' => $manifest['name'],
                'slug' => self::freeSlug(Str::slug((string) $manifest['name']) ?: 'template'),
                'version' => $manifest['version'],
                'author' => (string) ($manifest['author'] ?? ''),
                'license' => (string) ($manifest['license'] ?? ''),
                'description' => $manifest['description'] ?? null,
                'built_in' => false,
                'manifest' => $manifest,
                'header' => $package->header,
                'body' => $package->body,
                'footer' => $package->footer,
                'css' => $package->css,
            ]);
            $folder = "templates/{$template->id}";
            DB::afterRollBack(fn () => Storage::disk('local')->deleteDirectory($folder));

            foreach ($package->assets as $path => $contents) {
                Storage::disk('local')->put("{$folder}/{$path}", $contents);
                $template->assets()->create([
                    'path' => $path,
                    'mime' => TemplatePackage::mimeOf($path),
                    'storage_path' => "{$folder}/{$path}",
                    'size' => strlen($contents),
                ]);
            }

            return $template->load('assets');
        });
    }

    /** Built-in slugs stay reserved, so syncing them never overwrites an imported template. */
    private static function freeSlug(string $base): string
    {
        $slug = $base;
        for ($n = 2; in_array($slug, SyncBuiltInTemplates::SLUGS, true) || Template::query()->where('slug', $slug)->exists(); $n++) {
            $slug = "{$base}-{$n}";
        }

        return $slug;
    }
}
```

`app/Actions/ExportTemplatePackage.php`:

```php
<?php

namespace App\Actions;

use App\Models\Template;
use App\Rendering\TemplatePackage;
use App\Support\Actor;
use App\Support\DownloadFile;

/** Template → package ZIP (GET /api/templates/{id}/package in phase 4, export in the template editor in phase 7). */
final class ExportTemplatePackage
{
    public function handle(Actor $actor, Template $template): DownloadFile
    {
        return new DownloadFile(
            "{$template->slug}-{$template->version}.zip",
            'application/zip',
            TemplatePackage::fromTemplate($template->loadMissing('assets'))->toZip(),
        );
    }
}
```

`SyncBuiltInTemplates::SLUGS` entsteht in Task 8. Damit dieser Task allein grün ist, legt dieser Schritt die Klasse schon mit der Konstante an (Task 8 ergänzt `handle()`):

`app/Actions/SyncBuiltInTemplates.php` (vorläufig):

```php
<?php

namespace App\Actions;

use App\Support\Actor;

final class SyncBuiltInTemplates
{
    public const SLUGS = ['klar', 'kante', 'leise'];

    /** @return array<string, \App\Models\Template> */
    public function handle(Actor $actor): array
    {
        return []; // task 8
    }
}
```

- [ ] **Step 6: Sprachschlüssel ergänzen** (danach sortieren wie in Task 2)

| Schlüssel | en | de |
|---|---|---|
| `template_package.asset_too_large` | `The asset :path is larger than :mb MB.` | `Die Datei :path ist größer als :mb MB.` |
| `template_package.asset_type` | `The asset :path has an unsupported type (images: png, jpg, gif, webp, svg; fonts: woff, woff2, ttf, otf).` | `Die Datei :path hat einen nicht erlaubten Typ (Bilder: png, jpg, gif, webp, svg; Schriften: woff, woff2, ttf, otf).` |
| `template_package.bad_path` | `The path :path is not allowed.` | `Der Pfad :path ist nicht erlaubt.` |
| `template_package.document_types` | `documentTypes must list offer, confirmation, invoice or cancellation.` | `documentTypes muss offer, confirmation, invoice oder cancellation enthalten.` |
| `template_package.expected_fields` | `expectedFields entry :index needs scope, key and type.` | `Eintrag :index in expectedFields braucht scope, key und type.` |
| `template_package.manifest_json` | `manifest.json is not valid JSON.` | `manifest.json ist kein gültiges JSON.` |
| `template_package.manifest_object` | `manifest.json must contain an object.` | `manifest.json muss ein Objekt enthalten.` |
| `template_package.missing_file` | `:file is missing.` | `:file fehlt.` |
| `template_package.not_a_zip` | `The file is not a ZIP archive.` | `Die Datei ist kein ZIP-Archiv.` |
| `template_package.not_utf8` | `:file is not UTF-8 text.` | `:file ist kein UTF-8-Text.` |
| `template_package.required` | `:field is required.` | `:field ist Pflicht.` |
| `template_package.string` | `:field must be a text of at most :max characters.` | `:field muss ein Text mit höchstens :max Zeichen sein.` |
| `template_package.too_large` | `The package is too large (at most :mb MB).` | `Das Paket ist zu groß (höchstens :mb MB).` |
| `template_package.too_many_files` | `The package contains more than :max files.` | `Das Paket enthält mehr als :max Dateien.` |
| `template_package.translations` | `translations must map en and de to texts.` | `translations muss en und de auf Texte abbilden.` |
| `template_package.unknown_file` | `The file :path is not part of a template package.` | `Die Datei :path gehört nicht in ein Template-Paket.` |
| `template_package.version` | `version must look like 1.0.0.` | `version muss wie 1.0.0 aussehen.` |

- [ ] **Step 7: Tests laufen lassen**

```bash
ddev artisan test --filter=TemplatePackageTest
```
Erwartet: PASS. Prüfpunkte:
- Normalisiert die installierte libzip `../evil.liquid` oder `/etc/passwd` beim Schreiben (z. B. zu `evil.liquid`), landen beide Fälle bei „unknown file“ – ebenfalls Schlüssel `package`, der Test bleibt gültig. Mit `ddev exec unzip -l <zip>` lässt sich nachsehen, was im Archiv steht.
- Der ZIP-Bomb-Fall setzt `max_unpacked_bytes` auf 1 KB; das Paket entpackt > 4 KB.

- [ ] **Step 8: Commit**

```bash
ddev exec vendor/bin/pint
git add app/Rendering app/Support/DownloadFile.php app/Actions lang tests/Feature/Rendering/TemplatePackageTest.php
git commit -m "$(cat <<'EOF'
feat(templates): import and export template packages with manifest validation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Mitgelieferte Templates Klar, Kante, Leise (Sync, Migration, Kommando, Golden-Tests)

**Files:**
- Create: `resources/templates/klar/{manifest.json,header.liquid,template.liquid,footer.liquid,styles.css}`
- Create: `resources/templates/kante/{…}`, `resources/templates/leise/{…}`
- Modify: `app/Actions/SyncBuiltInTemplates.php` (vollständig)
- Create: `app/Console/Commands/SyncTemplates.php`
- Create: `database/migrations/2026_10_11_100400_insert_built_in_templates.php`
- Modify: `database/seeders/DemoSeeder.php` (Templates aus dem Sync statt Platzhaltern)
- Test: `tests/Feature/Rendering/BuiltInTemplatesTest.php`, `tests/Feature/Rendering/GoldenTest.php`, `tests/Feature/Rendering/golden/*.html`

**Interfaces:**
- Consumes: Task 7 (`TemplatePackage::fromDirectory()`, `SyncBuiltInTemplates::SLUGS`), Task 4–6 (Golden-Tests)
- Produces: `SyncBuiltInTemplates::handle(Actor): array<string, Template>`, Kommando `app:sync-templates`, nach `migrate` die Templates `klar`/`kante`/`leise` (`built_in`) und `document_types.template_id` = Klar

Port aus `prototypes/clickdummy-v2/src/templates/`: Aufbau und CSS bleiben gleich, feste deutsche Wörter werden zu `{{ 'key' | t }}`, Betragsvergleiche nutzen `> 0` (nie `!= 0`, siehe Entscheidungen), die Schleifenvariable der Steuerzeilen heißt `row` (statt `t`, um Verwechslung mit dem Filter zu vermeiden). `styles.css` und `header.liquid` von Klar sowie `styles.css` von Kante und Leise werden **unverändert kopiert**:

```bash
for t in klar kante leise; do mkdir -p resources/templates/$t; cp prototypes/clickdummy-v2/src/templates/$t/styles.css resources/templates/$t/styles.css; done
cp prototypes/clickdummy-v2/src/templates/klar/header.liquid resources/templates/klar/header.liquid
cp prototypes/clickdummy-v2/src/templates/kante/header.liquid resources/templates/kante/header.liquid
cp prototypes/clickdummy-v2/src/templates/leise/header.liquid resources/templates/leise/header.liquid
```

- [ ] **Step 1: Failing tests schreiben**

`tests/Feature/Rendering/BuiltInTemplatesTest.php`:

```php
<?php

use App\Actions\SyncBuiltInTemplates;
use App\Enums\RenderScenario;
use App\Models\DocumentTypeSetting;
use App\Models\Template;
use App\Rendering\ContextBuilder;
use App\Rendering\LiquidRenderer;
use App\Rendering\ManifestValidator;
use App\Rendering\RenderOptions;
use App\Rendering\SampleDataFactory;
use App\Rendering\TemplatePackage;
use App\Rendering\TemplateSource;

it('ships Klar, Kante and Leise as built-in templates and uses Klar as default for every document type', function () {
    $klar = Template::query()->where('slug', 'klar')->firstOrFail();

    expect(Template::query()->where('built_in', true)->orderBy('slug')->pluck('name', 'slug')->all())->toBe(['kante' => 'Kante', 'klar' => 'Klar', 'leise' => 'Leise'])
        ->and(DocumentTypeSetting::query()->pluck('template_id')->unique()->values()->all())->toBe([$klar->id])
        ->and($klar->version)->toBe('1.0.0')
        ->and($klar->manifest['paper'])->toBe(['format' => 'A4', 'marginX' => '20mm', 'headerHeight' => '30mm', 'footerHeight' => '28mm']);
});

it('syncs idempotently and restores changed built-in templates', function () {
    Template::query()->where('slug', 'klar')->update(['body' => 'changed']);

    $first = app(SyncBuiltInTemplates::class)->handle(systemActor());
    $second = app(SyncBuiltInTemplates::class)->handle(systemActor());

    expect(array_keys($first))->toBe(['klar', 'kante', 'leise'])
        ->and($second['klar']->id)->toBe($first['klar']->id)
        ->and(Template::query()->count())->toBe(3)
        ->and($second['klar']->body)->toBe((string) file_get_contents(resource_path('templates/klar/template.liquid')));
});

it('has valid manifests for all built-in templates', function (string $slug) {
    expect(ManifestValidator::validate(TemplatePackage::fromDirectory(resource_path("templates/{$slug}"))->manifest))->toBe([]);
})->with(SyncBuiltInTemplates::SLUGS);

it('renders every built-in template with every scenario in both languages without errors', function (string $slug, RenderScenario $scenario) {
    foreach (['de', 'en'] as $locale) {
        $sample = app(SampleDataFactory::class)->make($scenario, $locale);
        $context = app(ContextBuilder::class)->build($sample->document, $sample->sources);
        $result = app(LiquidRenderer::class)->render(TemplateSource::fromModel(Template::query()->where('slug', $slug)->firstOrFail()), $context->data, new RenderOptions($locale));

        expect($result->errors)->toBe([])
            ->and($result->footer)->toContain('<span class="pageNumber"></span>')
            ->and($result->body)->not->toContain('openbill-error');
    }
})->with(SyncBuiltInTemplates::SLUGS)->with(RenderScenario::cases());

it('uses only words of the template vocabulary', function () {
    $lang = ['en' => json_decode((string) file_get_contents(lang_path('en.json')), true), 'de' => json_decode((string) file_get_contents(lang_path('de.json')), true)];
    $words = [];
    foreach (glob(resource_path('templates/*/*.liquid')) ?: [] as $file) {
        preg_match_all("/'([a-z_]+)'\\s*\\|\\s*t\\b/", (string) file_get_contents($file), $m);
        array_push($words, ...$m[1]);
    }

    expect($words)->not->toBeEmpty();
    foreach (array_unique($words) as $word) {
        expect($lang['en'])->toHaveKey("template.{$word}")
            ->and($lang['de'])->toHaveKey("template.{$word}");
    }
});

it('never compares amounts with == or != (string amounts, see docs)', function () {
    foreach (glob(resource_path('templates/*/*.liquid')) ?: [] as $file) {
        expect((string) file_get_contents($file))->not->toMatch('/(total|net|tax|percent)\s*(==|!=)\s*0/');
    }
});

it('syncs from the console', function () {
    $this->artisan('app:sync-templates')->expectsOutputToContain('klar, kante, leise')->assertSuccessful();
});
```

`tests/Feature/Rendering/GoldenTest.php`:

```php
<?php

use App\Enums\RenderScenario;
use App\Models\Template;
use App\Rendering\ContextBuilder;
use App\Rendering\LiquidRenderer;
use App\Rendering\RenderOptions;
use App\Rendering\SampleDataFactory;
use App\Rendering\TemplateSource;

/*
 * Approved HTML of the built-in templates with sample data. After an intended change:
 *   ddev exec 'UPDATE_GOLDEN=1 php artisan test --filter=GoldenTest'
 * then look at the diff (git diff tests/Feature/Rendering/golden) and at the PDF (php artisan app:render-sample).
 */
it('renders the built-in templates exactly like the approved output', function (string $slug, RenderScenario $scenario, string $locale) {
    $sample = app(SampleDataFactory::class)->make($scenario, $locale);
    $context = app(ContextBuilder::class)->build($sample->document, $sample->sources);
    $result = app(LiquidRenderer::class)->render(TemplateSource::fromModel(Template::query()->where('slug', $slug)->firstOrFail()), $context->data, new RenderOptions($locale));

    expect($result->errors)->toBe([]);
    foreach (['header' => $result->header, 'body' => $result->body, 'footer' => $result->footer] as $part => $html) {
        $file = __DIR__."/golden/{$slug}-{$scenario->value}-{$locale}.{$part}.html";
        if (getenv('UPDATE_GOLDEN') === '1') {
            file_put_contents($file, $html);
        }
        expect(is_file($file))->toBeTrue("missing {$file}: run with UPDATE_GOLDEN=1")
            ->and($html)->toBe((string) file_get_contents($file));
    }
})->with([
    'klar short invoice de' => ['klar', RenderScenario::ShortInvoice, 'de'],
    'klar long invoice en' => ['klar', RenderScenario::LongInvoice, 'en'],
    'kante offer with options en' => ['kante', RenderScenario::OfferWithOptions, 'en'],
    'kante small business de' => ['kante', RenderScenario::SmallBusiness, 'de'],
    'leise reverse charge de' => ['leise', RenderScenario::ReverseCharge, 'de'],
]);
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

```bash
ddev artisan test --filter='BuiltInTemplatesTest|GoldenTest'
```
Erwartet: FAIL (keine Templates mit `built_in = true`, `resources/templates/klar/manifest.json` fehlt).

- [ ] **Step 3: Klar**

`resources/templates/klar/manifest.json`:

```json
{
  "name": "Klar",
  "version": "1.0.0",
  "author": "openbill",
  "license": "MIT",
  "description": "Calm, classic layout with a clear table. Fits every document type.",
  "documentTypes": ["offer", "confirmation", "invoice", "cancellation"],
  "expectedFields": [
    { "scope": "document", "key": "project_name", "type": "text", "fallback": "" }
  ],
  "paper": { "format": "A4", "marginX": "20mm", "headerHeight": "30mm", "footerHeight": "28mm" }
}
```

`resources/templates/klar/template.liquid`:

```liquid
<div class="meta">
  <div class="type">{{ document.type_label }}</div>
  <dl>
    <dt>{{ 'number' | t }}</dt><dd>{{ document.number }}</dd>
    <dt>{{ 'date' | t }}</dt><dd>{{ document.date | date }}</dd>
    {% if document.service_date %}<dt>{{ 'service_date' | t }}</dt><dd>{{ document.service_date | date }}{% if document.service_date_end %} – {{ document.service_date_end | date }}{% endif %}</dd>{% endif %}
    {% if document.due_date %}<dt>{{ 'due_date' | t }}</dt><dd>{{ document.due_date | date }}</dd>{% endif %}
    {% if document.valid_until %}<dt>{{ 'valid_until' | t }}</dt><dd>{{ document.valid_until | date }}</dd>{% endif %}
    {% if customer.number %}<dt>{{ 'customer_number' | t }}</dt><dd>{{ customer.number }}</dd>{% endif %}
    {% if document.source_number %}<dt>{{ 'reference' | t }}</dt><dd>{{ document.source_number }}</dd>{% endif %}
  </dl>
</div>

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
  <thead><tr><th class="n">{{ 'pos' | t }}</th><th>{{ 'service' | t }}</th><th class="r">{{ 'quantity' | t }}</th><th class="r">{{ 'unit_price' | t }}</th><th class="r">{{ 'total' | t }}</th></tr></thead>
  <tbody>
  {% for g in groups %}
    {% if g.has_title %}<tr class="heading"><td colspan="5">{{ g.title }}</td></tr>{% endif %}
    {% for p in g.positions %}
      {% if p.is_text %}
        <tr class="note"><td></td><td colspan="4">{{ p.title }}{% if p.description %}<br><span class="desc">{{ p.description | nl2br }}</span>{% endif %}</td></tr>
      {% else %}
        <tr class="{% if p.is_optional %}optional{% endif %}">
          <td class="n">{{ p.index }}</td>
          <td>{{ p.title }}{% if p.is_optional %} <em>({{ 'optional' | t }})</em>{% endif %}{% if p.description %}<br><span class="desc">{{ p.description | nl2br }}</span>{% endif %}</td>
          <td class="r">{{ p.quantity | number: 2 }} {{ p.unit }}</td>
          <td class="r">{{ p.unit_price | money }}</td>
          <td class="r">{{ p.total | money }}</td>
        </tr>
      {% endif %}
    {% endfor %}
    {% if g.has_title %}<tr class="subtotal"><td></td><td colspan="3">{{ 'subtotal' | t }} {{ g.title }}</td><td class="r">{{ g.total | money }}</td></tr>{% endif %}
  {% endfor %}
  </tbody>
</table>

<table class="sums">
  <tr><td>{{ 'net' | t }}</td><td class="r">{{ document.net_total | money }}</td></tr>
  {% for row in document.tax_breakdown %}{% if row.percent > 0 %}
  <tr><td>{{ 'vat' | t }} {{ row.percent }} % {{ 'vat_on' | t }} {{ row.net | money }}</td><td class="r">{{ row.tax | money }}</td></tr>
  {% endif %}{% endfor %}
  <tr class="total"><td>{{ 'total' | t }}</td><td class="r">{{ document.gross_total | money }}</td></tr>
  {% if document.optional_total > 0 %}<tr class="opt"><td>{{ 'optional_total' | t }}</td><td class="r">{{ document.optional_total | money }}</td></tr>{% endif %}
</table>

{% for note in document.legal_notes %}<p class="legal">{{ note }}</p>{% endfor %}
{% if document.closing %}<p class="text">{{ document.closing | nl2br }}</p>{% endif %}
```

`resources/templates/klar/footer.liquid`:

```liquid
<style>
  .f { box-sizing: border-box; height: 100%; padding: 4mm 20mm 0; font-family: "Helvetica Neue", Arial, sans-serif; font-size: 7pt; line-height: 1.45; color: #6d685f; }
  .f-cols { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4mm; border-top: 0.3pt solid #c9c3b8; padding-top: 3mm; }
  .f-page { margin-top: 3mm; text-align: right; color: #1b1a17; }
</style>
<div class="f">
  <div class="f-cols">
    <div>{{ org.name }}<br>{{ org.street }}<br>{{ org.zip }} {{ org.city }}</div>
    <div>{{ org.email }}<br>{{ org.phone }}<br>{{ org.website }}</div>
    <div>{% if org.vat_id %}{{ 'vat_id' | t }} {{ org.vat_id }}{% else %}{{ 'tax_number' | t }} {{ org.tax_number }}{% endif %}{% if org.register %}<br>{{ org.register }}{% endif %}</div>
    <div>{{ org.bank_name }}<br>IBAN {{ org.iban }}<br>BIC {{ org.bic }}</div>
  </div>
  <div class="f-page">{{ 'page' | t }} {{ page.number }} {{ 'of' | t }} {{ page.total }}</div>
</div>
```

- [ ] **Step 4: Kante**

`resources/templates/kante/manifest.json`:

```json
{
  "name": "Kante",
  "version": "1.0.0",
  "author": "openbill",
  "license": "MIT",
  "description": "Bold: a strong colour band, a large total, heavy rules.",
  "documentTypes": ["offer", "confirmation", "invoice", "cancellation"],
  "expectedFields": [
    { "scope": "document", "key": "project_name", "type": "text", "fallback": "" }
  ],
  "paper": { "format": "A4", "marginX": "16mm", "headerHeight": "16mm", "footerHeight": "18mm" }
}
```

`resources/templates/kante/template.liquid`:

```liquid
<header class="band">
  <div class="band-top">
    {% if org.logo %}<img class="logo" src="{{ org.logo }}" alt="">{% else %}<span class="org">{{ org.name }}</span>{% endif %}
  </div>
  <div class="band-main">
    <h1>{{ document.type_label }}</h1>
    <div class="amount">
      <span>{% if document.type == "offer" %}{{ 'offer_total' | t }}{% elsif document.type == "cancellation" %}{{ 'credit' | t }}{% else %}{{ 'amount_due' | t }}{% endif %}</span>
      <strong>{{ document.gross_total | money }}</strong>
    </div>
  </div>
</header>

<section class="parties">
  <div>
    <p class="label">{{ 'for' | t }}</p>
    {% if customer %}
      <p><b>{{ customer.name }}</b>{% if contact %}<br>{{ contact.full_name }}{% endif %}<br>{{ customer.street }}<br>{{ customer.zip }} {{ customer.city }}</p>
    {% endif %}
  </div>
  <div>
    <p class="label">{{ 'details' | t }}</p>
    <p>
      {{ 'number' | t }} {{ document.number }}
      <br>{{ 'date' | t }} {{ document.date | date }}
      {% if document.service_date %}<br>{{ 'service_date' | t }} {{ document.service_date | date }}{% endif %}
      {% if document.due_date %}<br>{{ 'due_date' | t }} {{ document.due_date | date }}{% endif %}
      {% if document.valid_until %}<br>{{ 'valid_until' | t }} {{ document.valid_until | date }}{% endif %}
      {% if document.source_number %}<br>{{ 'reference' | t }} {{ document.source_number }}{% endif %}
    </p>
  </div>
  {% if document.project_name %}
  <div>
    <p class="label">{{ 'project' | t }}</p>
    <p><b>{{ document.project_name }}</b></p>
  </div>
  {% endif %}
</section>

<main class="content">
  {% if document.intro %}<p class="text">{{ document.intro | nl2br }}</p>{% endif %}

  <table class="items">
    <thead><tr><th>{{ 'service' | t }}</th><th class="r">{{ 'quantity' | t }}</th><th class="r">{{ 'price' | t }}</th><th class="r">{{ 'sum' | t }}</th></tr></thead>
    <tbody>
    {% for g in groups %}
      {% if g.has_title %}<tr class="heading"><td colspan="3">{{ g.title }}</td><td class="r">{{ g.total | money }}</td></tr>{% endif %}
      {% for p in g.positions %}
        {% if p.is_text %}
          <tr class="note"><td colspan="4">{{ p.title }}</td></tr>
        {% else %}
          <tr class="{% if p.is_optional %}optional{% endif %}">
            <td><b>{{ p.title }}</b>{% if p.is_optional %} · {{ 'optional' | t }}{% endif %}{% if p.description %}<br><small>{{ p.description }}</small>{% endif %}</td>
            <td class="r">{{ p.quantity | number: 2 }} {{ p.unit }}</td>
            <td class="r">{{ p.unit_price | money }}</td>
            <td class="r">{{ p.total | money }}</td>
          </tr>
        {% endif %}
      {% endfor %}
    {% endfor %}
    </tbody>
  </table>

  <div class="sums">
    <div><span>{{ 'net' | t }}</span><span>{{ document.net_total | money }}</span></div>
    {% for row in document.tax_breakdown %}{% if row.percent > 0 %}<div><span>{{ 'vat' | t }} {{ row.percent }} %</span><span>{{ row.tax | money }}</span></div>{% endif %}{% endfor %}
    <div class="total"><span>{{ 'total' | t }}</span><span>{{ document.gross_total | money }}</span></div>
  </div>

  {% for note in document.legal_notes %}<p class="legal">{{ note }}</p>{% endfor %}
  {% if document.closing %}<p class="text">{{ document.closing | nl2br }}</p>{% endif %}
</main>
```

`resources/templates/kante/footer.liquid`:

```liquid
<style>
  .kf { box-sizing: border-box; height: 100%; padding: 3mm 16mm 0; font-family: "Arial Narrow", Arial, sans-serif; font-size: 7.5pt; color: #555; }
  .kf-row { display: flex; justify-content: space-between; gap: 6mm; border-top: 0.75pt solid #111; padding-top: 3mm; }
  .kf-page { font-weight: 700; color: #1f2a5a; }
</style>
<div class="kf"><div class="kf-row">
  <span>{{ org.name }}, {{ org.street }}, {{ org.zip }} {{ org.city }}</span>
  <span>{% if org.vat_id %}{{ 'vat_id' | t }} {{ org.vat_id }}{% else %}{{ 'tax_number' | t }} {{ org.tax_number }}{% endif %}</span>
  <span>IBAN {{ org.iban }}</span>
  <span class="kf-page">{{ page.number }}/{{ page.total }}</span>
</div></div>
```

- [ ] **Step 5: Leise**

`resources/templates/leise/manifest.json`:

```json
{
  "name": "Leise",
  "version": "1.0.0",
  "author": "openbill",
  "license": "MIT",
  "description": "Minimal: lots of white space, a serif typeface, hairlines.",
  "documentTypes": ["offer", "confirmation", "invoice", "cancellation"],
  "expectedFields": [],
  "paper": { "format": "A4", "marginX": "24mm", "headerHeight": "26mm", "footerHeight": "22mm" }
}
```

`resources/templates/leise/template.liquid`:

```liquid
<section class="to">
  {% if customer %}{{ customer.name }}<br>{% if contact %}{{ contact.full_name }}<br>{% endif %}{{ customer.street }}<br>{{ customer.zip }} {{ customer.city }}{% endif %}
</section>

<h1>{{ document.type_label }}</h1>
<p class="meta">
  {{ 'number_short' | t }} {{ document.number }}, {{ document.date | date }}{% if document.service_date %}, {{ 'service_date' | t }} {{ document.service_date | date }}{% endif %}{% if document.valid_until %}, {{ 'valid_until' | t | downcase }} {{ document.valid_until | date }}{% endif %}{% if document.source_number %}, {{ 'reference' | t }} {{ document.source_number }}{% endif %}
</p>

{% if document.intro %}<p class="text">{{ document.intro | nl2br }}</p>{% endif %}

<table class="items">
  {% for g in groups %}
    {% if g.has_title %}<tr class="heading"><td colspan="2">{{ g.title }}</td><td class="r">{{ g.total | money }}</td></tr>{% endif %}
    {% for p in g.positions %}
      {% if p.is_text %}
        <tr><td colspan="3" class="note">{{ p.title }}</td></tr>
      {% else %}
        <tr class="{% if p.is_optional %}optional{% endif %}">
          <td>{{ p.title }}{% if p.is_optional %} ({{ 'optional' | t }}){% endif %}{% if p.description %}<span>{{ p.description }}</span>{% endif %}</td>
          <td class="r q">{{ p.quantity | number: 2 }} {{ p.unit }} × {{ p.unit_price | money }}</td>
          <td class="r">{{ p.total | money }}</td>
        </tr>
      {% endif %}
    {% endfor %}
  {% endfor %}
</table>

<table class="sums">
  <tr><td>{{ 'net' | t }}</td><td class="r">{{ document.net_total | money }}</td></tr>
  {% for row in document.tax_breakdown %}{% if row.percent > 0 %}<tr><td>{{ 'vat_long' | t }} {{ row.percent }} %</td><td class="r">{{ row.tax | money }}</td></tr>{% endif %}{% endfor %}
  <tr class="total"><td>{{ 'total' | t }}</td><td class="r">{{ document.gross_total | money }}</td></tr>
</table>

{% for note in document.legal_notes %}<p class="legal">{{ note }}</p>{% endfor %}
{% if document.closing %}<p class="text">{{ document.closing | nl2br }}</p>{% endif %}
```

`resources/templates/leise/footer.liquid`:

```liquid
<style>
  .lf { box-sizing: border-box; height: 100%; padding: 8mm 24mm 0; font-family: Georgia, serif; font-size: 7pt; color: #999; display: flex; justify-content: space-between; }
</style>
<div class="lf">
  <span>{{ org.name }} · {{ org.bank_name }} · IBAN {{ org.iban }} · {% if org.vat_id %}{{ 'vat_id' | t }} {{ org.vat_id }}{% else %}{{ 'tax_number' | t }} {{ org.tax_number }}{% endif %}</span>
  <span>{{ page.number }} / {{ page.total }}</span>
</div>
```

- [ ] **Step 6: SyncBuiltInTemplates, Kommando, Migration**

`app/Actions/SyncBuiltInTemplates.php` (ersetzt die vorläufige Fassung aus Task 7):

```php
<?php

namespace App\Actions;

use App\Models\DocumentTypeSetting;
use App\Models\Template;
use App\Rendering\TemplatePackage;
use App\Support\Actor;
use Illuminate\Support\Facades\DB;

/**
 * Creates or updates the built-in templates from resources/templates/<slug>/ (idempotent).
 * Runs in the migration 2026_10_11_100400, in DemoSeeder and – via app:sync-templates – in the
 * Docker entrypoint, so an update of openbill also updates the built-ins. Document types without
 * a template get "klar".
 */
final class SyncBuiltInTemplates
{
    public const SLUGS = ['klar', 'kante', 'leise'];

    /**
     * @return array<string, Template> by slug
     */
    public function handle(Actor $actor): array
    {
        return DB::transaction(function (): array {
            $templates = [];
            foreach (self::SLUGS as $slug) {
                $package = TemplatePackage::fromDirectory(resource_path("templates/{$slug}"));
                $templates[$slug] = Template::query()->updateOrCreate(['slug' => $slug], [
                    'name' => $package->manifest['name'],
                    'version' => $package->manifest['version'],
                    'author' => $package->manifest['author'] ?? 'openbill',
                    'license' => $package->manifest['license'] ?? 'MIT',
                    'description' => $package->manifest['description'] ?? null,
                    'built_in' => true,
                    'manifest' => $package->manifest,
                    'header' => $package->header,
                    'body' => $package->body,
                    'footer' => $package->footer,
                    'css' => $package->css,
                ]);
            }
            DocumentTypeSetting::query()->whereNull('template_id')->update(['template_id' => $templates['klar']->id]);

            return $templates;
        });
    }
}
```

`app/Console/Commands/SyncTemplates.php`:

```php
<?php

namespace App\Console\Commands;

use App\Actions\SyncBuiltInTemplates;
use App\Support\Actor;
use Illuminate\Console\Command;

class SyncTemplates extends Command
{
    protected $signature = 'app:sync-templates';

    protected $description = 'Create or update the built-in templates (Klar, Kante, Leise)';

    public function handle(SyncBuiltInTemplates $sync): int
    {
        $templates = $sync->handle(Actor::system());
        $this->info('Built-in templates: '.implode(', ', array_keys($templates)));

        return self::SUCCESS;
    }
}
```

`database/migrations/2026_10_11_100400_insert_built_in_templates.php`:

```php
<?php

use App\Actions\SyncBuiltInTemplates;
use App\Support\Actor;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The built-in templates belong to the base data (like document types), so every instance and every
 * test database has them. Later versions are applied by app:sync-templates (Docker entrypoint).
 */
return new class extends Migration
{
    public function up(): void
    {
        app(SyncBuiltInTemplates::class)->handle(Actor::system());
    }

    public function down(): void
    {
        DB::table('document_types')->update(['template_id' => null]);
        DB::table('templates')
            ->where('built_in', true)
            ->whereNotIn('id', DB::table('documents')->whereNotNull('template_id')->select('template_id'))
            ->delete();
    }
};
```

- [ ] **Step 7: DemoSeeder auf die echten Templates umstellen**

In `database/seeders/DemoSeeder.php`:
- Konstruktor um `private readonly SyncBuiltInTemplates $builtInTemplates,` ergänzen (`use App\Actions\SyncBuiltInTemplates;`, `use App\Support\Actor;`);
- `templates()` ersetzen:

```php
    /** @return array<string, string> slug => id */
    private function templates(): array
    {
        return array_map(fn (Template $template): string => $template->id, $this->builtInTemplates->handle(Actor::system()));
    }
```

`tests/Feature/DemoSeederTest.php` erwartet weiter `['kante', 'klar', 'leise']` – unverändert grün.

- [ ] **Step 8: Golden-Dateien erzeugen und prüfen**

```bash
ddev exec 'UPDATE_GOLDEN=1 php artisan test --filter=GoldenTest'
ls tests/Feature/Rendering/golden/
```
Erwartet: 15 Dateien (`klar-short_invoice-de.body.html`, … je Fall `header`, `body`, `footer`). Stichprobe:

```bash
grep -o 'Rechnung INV-2026-0042' tests/Feature/Rendering/golden/klar-short_invoice-de.body.html | head -1
grep -o '4.105,50 €' tests/Feature/Rendering/golden/klar-short_invoice-de.body.html | head -1
grep -o 'Hafenkontor Lindqvist GmbH' tests/Feature/Rendering/golden/klar-short_invoice-de.body.html | head -1
grep -c 'Maintenance &amp; updates' tests/Feature/Rendering/golden/kante-offer_with_options-en.body.html
grep -o 'Seite <span class="pageNumber"></span> von <span class="totalPages"></span>' tests/Feature/Rendering/golden/klar-short_invoice-de.footer.html
```
Erwartet: je ein Treffer (`grep -c` → `1`). Keine echten Namen oder Hosts in den Dateien (nur Beispieldaten).

(`RefreshDatabase` migriert die Test-DB beim ersten Test eines Laufs neu, die neue Migration greift also automatisch.)

- [ ] **Step 9: Tests laufen lassen**

```bash
ddev artisan test --filter='BuiltInTemplatesTest|GoldenTest|DemoSeederTest|TemplatePackageTest|ContextBuilderTest'
ddev artisan test
```
Erwartet: alles grün. Falls ein Phase-2-Test ein Template mit `Template::factory()` und `slug` `klar` anlegt (Unique-Konflikt mit der Migration): dort den Slug ändern. Erwartet ein Phase-2-Test `template_id = null` als Grundzustand von Dokumenttypen oder neuen Dokumenten: auf das Klar-Template umstellen – die Migration setzt jetzt den Standard (gewollt, siehe Entscheidungen).

- [ ] **Step 10: Commit**

```bash
ddev exec vendor/bin/pint
git add resources/templates app/Actions/SyncBuiltInTemplates.php app/Console/Commands/SyncTemplates.php database/migrations/2026_10_11_100400_insert_built_in_templates.php database/seeders/DemoSeeder.php tests/Feature/Rendering
git commit -m "$(cat <<'EOF'
feat(templates): ship Klar, Kante and Leise as built-in templates with golden tests

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: GotenbergClient – Chromium-HTML mit Kopf-/Fußzeile, Rändern und PDF/A-3b/Factur-X

**Files:**
- Create: `app/Rendering/GotenbergClient.php`
- Create: `app/Exceptions/PdfRenderFailedException.php`
- Modify: `lang/en.json`, `lang/de.json`
- Test: `tests/Feature/Rendering/GotenbergClientTest.php`

**Interfaces:**
- Consumes: Task 1 (`GotenbergFake`, `services.gotenberg.*`), Task 2 (`RenderResult`, `Paper::size()`)
- Produces: `GotenbergClient::pdf(RenderResult $result, ?string $facturXml = null): string`, `PdfRenderFailedException` (503, `unreachable(Throwable)`, `answered(int, string)`)

- [ ] **Step 1: Failing tests schreiben**

`tests/Feature/Rendering/GotenbergClientTest.php`:

```php
<?php

use App\Exceptions\PdfRenderFailedException;
use App\Rendering\GotenbergClient;
use App\Rendering\Paper;
use App\Rendering\RenderResult;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\Support\GotenbergFake;

function sampleResult(): RenderResult
{
    return new RenderResult('<html>HEADER</html>', '<html>BODY</html>', '<html>FOOTER</html>', new Paper('A4', '16mm', '16mm', '18mm'));
}

/** Value of a multipart form field in a recorded request. */
function formValue(Request $request, string $name): ?string
{
    return preg_match('/name="'.preg_quote($name, '/').'"[^\r\n]*\r\n(?:[^\r\n]+\r\n)*\r\n(.*?)\r\n--/s', $request->body(), $m) === 1 ? $m[1] : null;
}

it('sends body, header and footer with paper size, margins and backgrounds to the Chromium route', function () {
    $pdf = app(GotenbergClient::class)->pdf(sampleResult());

    expect($pdf)->toStartWith('%PDF-');
    Http::assertSent(function (Request $request): bool {
        return $request->url() === config('services.gotenberg.url').'/forms/chromium/convert/html'
            && formValue($request, 'paperWidth') === '210mm'
            && formValue($request, 'paperHeight') === '297mm'
            && formValue($request, 'marginTop') === '16mm'
            && formValue($request, 'marginBottom') === '18mm'
            && formValue($request, 'marginLeft') === '16mm'
            && formValue($request, 'marginRight') === '16mm'
            && formValue($request, 'printBackground') === '1'
            && str_contains($request->body(), 'filename="index.html"') && str_contains($request->body(), '<html>BODY</html>')
            && str_contains($request->body(), 'filename="header.html"') && str_contains($request->body(), '<html>HEADER</html>')
            && str_contains($request->body(), 'filename="footer.html"') && str_contains($request->body(), '<html>FOOTER</html>')
            && formValue($request, 'pdfa') === null
            && ! str_contains($request->body(), 'facturx');
    });
});

it('asks for PDF/A-3b with the XML embedded as factur-x.xml when an e-invoice is given', function () {
    app(GotenbergClient::class)->pdf(sampleResult(), '<rsm:CrossIndustryInvoice/>');

    Http::assertSent(fn (Request $request): bool => formValue($request, 'pdfa') === 'PDF/A-3b'
        && formValue($request, 'facturxConformanceLevel') === 'EN 16931'
        && formValue($request, 'facturxDocumentType') === 'INVOICE'
        && str_contains($request->body(), 'name="facturxXml"; filename="factur-x.xml"')
        && str_contains($request->body(), '<rsm:CrossIndustryInvoice/>'));
});

it('turns errors, timeouts and non-PDF answers into PdfRenderFailedException (503)', function (Closure $arrange) {
    $arrange();

    try {
        app(GotenbergClient::class)->pdf(sampleResult());
        $this->fail('no exception');
    } catch (PdfRenderFailedException $e) {
        expect($e->status())->toBe(503)->and($e->getMessage())->not->toBe('');
    }
})->with([
    'error answer' => [fn () => GotenbergFake::failWithError()],
    'timeout' => [fn () => GotenbergFake::timeOut()],
    'no PDF' => [fn () => GotenbergFake::answerWithHtml()],
]);

```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

```bash
ddev artisan test --filter=GotenbergClientTest
```
Erwartet: FAIL (`Class "App\Rendering\GotenbergClient" not found`).

- [ ] **Step 3: Exception und Client implementieren**

`app/Exceptions/PdfRenderFailedException.php`:

```php
<?php

namespace App\Exceptions;

use App\Support\Text;
use Throwable;

/** Gotenberg was unreachable, too slow or answered with an error (503: try again later). */
final class PdfRenderFailedException extends DomainActionException
{
    public static function unreachable(Throwable $previous): self
    {
        return new self(Text::t('rendering.pdf_unreachable'), 0, $previous);
    }

    public static function answered(int $status, string $body): self
    {
        $message = mb_substr(trim(strip_tags($body)), 0, 300);

        return new self(Text::t('rendering.pdf_failed', ['status' => $status, 'message' => $message]));
    }

    public function status(): int
    {
        return 503;
    }
}
```

`app/Rendering/GotenbergClient.php`:

```php
<?php

namespace App\Rendering;

use App\Exceptions\PdfRenderFailedException;
use Gotenberg\FacturX;
use Gotenberg\Gotenberg;
use Gotenberg\Stream;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

/**
 * Gotenberg 8, Chromium route: body = index.html, header.html, footer.html, paper and margins from the
 * manifest (the header lives in the top margin, the footer in the bottom one), backgrounds printed.
 * With an e-invoice XML the result is PDF/A-3b with the XML embedded as factur-x.xml (Gotenberg ≥ 8.34).
 * gotenberg-php builds the multipart request, Laravel's HTTP client sends it (timeout, Http::fake in tests).
 */
final class GotenbergClient
{
    /**
     * @throws PdfRenderFailedException
     */
    public function pdf(RenderResult $result, ?string $facturXml = null): string
    {
        [$width, $height] = $result->paper->size();
        $builder = Gotenberg::chromium((string) config('services.gotenberg.url'))->pdf()
            ->paperSize($width, $height)
            ->margins($result->paper->headerHeight, $result->paper->footerHeight, $result->paper->marginX, $result->paper->marginX)
            ->printBackground()
            ->header(Stream::string('header.html', $result->header))
            ->footer(Stream::string('footer.html', $result->footer));
        if ($facturXml !== null) {
            $builder->pdfa('PDF/A-3b')
                ->facturX(new FacturX(Stream::string('factur-x.xml', $facturXml), FacturX::CONFORMANCE_EN_16931));
        }
        $request = $builder->html(Stream::string('index.html', $result->body));

        try {
            $response = Http::timeout((int) config('services.gotenberg.timeout'))
                ->withBody((string) $request->getBody(), $request->getHeaderLine('Content-Type'))
                ->post((string) $request->getUri());
        } catch (ConnectionException $e) {
            throw PdfRenderFailedException::unreachable($e);
        }

        if (! $response->successful() || ! str_starts_with($response->body(), '%PDF-')) {
            throw PdfRenderFailedException::answered($response->status(), $response->body());
        }

        return $response->body();
    }
}
```

- [ ] **Step 4: Sprachschlüssel ergänzen** (danach sortieren wie in Task 2)

| Schlüssel | en | de |
|---|---|---|
| `rendering.pdf_failed` | `The PDF service answered with an error (:status): :message` | `Der PDF-Dienst hat mit einem Fehler geantwortet (:status): :message` |
| `rendering.pdf_unreachable` | `The PDF service (Gotenberg) is not reachable or too slow. Please try again.` | `Der PDF-Dienst (Gotenberg) ist nicht erreichbar oder zu langsam. Bitte noch einmal versuchen.` |

- [ ] **Step 5: Tests laufen lassen**

```bash
ddev artisan test --filter=GotenbergClientTest
```
Erwartet: PASS. Prüfpunkte:
- `formValue()` liest das Multipart-Format von Guzzles `MultipartStream` (`Content-Disposition: form-data; name="…"`, weitere Header, Leerzeile, Wert, `\r\n--boundary`). `printBackground()` übergibt `true`, Guzzle schreibt `1`. Weicht das Format ab: `ddev exec php -r` mit einem `dump`-freien `echo $request->body()` im Test ansehen und den regulären Ausdruck anpassen, nicht die Prüfungen weglassen.
- Liefert `Http::failedConnection()` in der installierten Laravel-Version kein `ConnectionException`, sondern `RequestException`: in `GotenbergClient` zusätzlich `RequestException` abfangen (beide → `unreachable`).

- [ ] **Step 6: Commit**

```bash
ddev exec vendor/bin/pint
git add app/Rendering/GotenbergClient.php app/Exceptions/PdfRenderFailedException.php lang tests/Feature/Rendering/GotenbergClientTest.php
git commit -m "$(cat <<'EOF'
feat(pdf): add gotenberg client with header, footer, margins and PDF/A-3b factur-x embedding

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: E-Rechnung – CiiBuilder (EN 16931) mit XSD-Prüfung

**Files:**
- Create: `app/EInvoice/CiiAmount.php`, `app/EInvoice/CiiBuilder.php`
- Create: `app/Exceptions/EInvoiceInvalidException.php`
- Modify: `lang/en.json`, `lang/de.json`
- Test: `tests/Feature/EInvoice/CiiBuilderTest.php`

**Interfaces:**
- Consumes: Phase 2 (`Totals`, `LineTotal`, `EffectiveTax`, `TaxBreakdownRow`, `SnapshotBuilder`, `DocumentInspector`)
- Produces: `CiiBuilder::build(Document $document, array $sources, Totals $totals): string`, `CiiBuilder::validate(string $xml): list<string>`, `CiiAmount::of(BigDecimal|string): float`, `EInvoiceInvalidException(list<string> $errors)` (422)

Abbildung (EN 16931, CII, Profil-ID `urn:cen.eu:en16931:2017`):

| openbill | CII / BT |
|---|---|
| Rechnung / Storno | TypeCode `380` / `381` (Gutschrift: alle Beträge und Mengen positiv, Bezug auf die Rechnung BT-25/26) |
| Nummer, Datum | BT-1, BT-2 |
| Rechtshinweise (`legal_notes`) | BT-22 (Notes) |
| Organisation | Verkäufer BT-27, Anschrift BT-35…40, USt-ID `VA` (BT-31), Steuernummer `FC` (BT-32), E-Mail BT-34 (`EM`) |
| Kunde | Käufer BT-44 (Kundennummer BT-46), Anschrift BT-50…55, USt-ID `VA` (BT-48) |
| Leistungsdatum / -zeitraum | BT-72 / BT-73…74 |
| IBAN, BIC | Zahlungsmittel `58` SEPA-Überweisung, BT-84/86 (nur Rechnungen) |
| Fälligkeit | BT-9 |
| Positionen (`item`) | Zeilen-ID fortlaufend, Titel BT-153, Beschreibung BT-154, Nettopreis BT-146 (4 Nachkommastellen), Menge + Einheitencode BT-129/130 (4 Nachkommastellen, ohne Code `C62`), Kategorie + Satz BT-151/152, Zeilennetto BT-131 |
| Steueraufschlüsselung | BT-116…119 je Kategorie/Satz, Befreiungsgrund BT-120 für `E`, `AE`, `K`, `G` (Steuerhinweis der Position, sonst erster Rechtshinweis) |
| Summen | BT-106, BT-109, BT-110, BT-112, BT-115 |

Text- und optionale Positionen erscheinen nicht in der XML (optionale gibt es nur in Angeboten).

- [ ] **Step 1: Failing tests schreiben**

`tests/Feature/EInvoice/CiiBuilderTest.php`:

```php
<?php

use App\Actions\CancelInvoice;
use App\Actions\FinalizeDocument;
use App\Contracts\DocumentArchiver;
use App\EInvoice\CiiAmount;
use App\EInvoice\CiiBuilder;
use App\Enums\DocumentType;
use App\Enums\TaxTreatment;
use App\Exceptions\EInvoiceInvalidException;
use App\Models\Customer;
use App\Models\Document;
use App\Models\DocumentTypeSetting;
use App\Models\Organization;
use App\Support\DocumentInspector;
use App\Support\NullDocumentArchiver;
use App\Support\SnapshotBuilder;
use App\Support\Text;

beforeEach(function () {
    completeOrganization();
    DocumentTypeSetting::query()->whereIn('type', ['invoice', 'cancellation'])->update(['profile' => 'en16931']);
});

function ciiOf(Document $document, string $number = 'INV-2026-0007'): string
{
    $document->loadMissing('groups.positions');
    $document->number ??= $number;
    $sources = app(SnapshotBuilder::class)->build($document);

    return app(CiiBuilder::class)->build($document, $sources, app(DocumentInspector::class)->totals($document, $sources));
}

it('builds an EN 16931 invoice that is valid against the XSD', function () {
    $customer = Customer::factory()->create(['name' => 'Hafenkontor Lindqvist GmbH', 'number' => 'K-1001', 'vat_id' => 'DE987654321']);
    $document = draft(DocumentType::Invoice, [itemRow('Workshop', '10', '95'), itemRow('Lizenz', '1.125', '12.3456')], [
        'customer_id' => $customer->id, 'date' => '2026-10-04', 'service_date' => '2026-09-30', 'due_date' => '2026-10-18',
    ]);

    $xml = ciiOf($document);

    expect(CiiBuilder::validate($xml))->toBe([])
        ->and($xml)->toContain('urn:cen.eu:en16931:2017')
        ->toContain('<ram:ID>INV-2026-0007</ram:ID>')
        ->toContain('<ram:TypeCode>380</ram:TypeCode>')
        ->toContain('20261004')
        ->toContain('Studio Nordlicht')
        ->toContain('DE123456789')
        ->toContain('Hafenkontor Lindqvist GmbH')
        ->toContain('DE987654321')
        ->toContain('DE02120300000000202051')
        ->toContain('<ram:ChargeAmount>12.3456</ram:ChargeAmount>')
        ->toContain('unitCode="HUR">1.1250</ram:BilledQuantity>')
        ->toContain('<ram:LineTotalAmount>950.00</ram:LineTotalAmount>')
        ->toContain('<ram:CategoryCode>S</ram:CategoryCode>')
        ->toContain('<ram:GrandTotalAmount>1147.03</ram:GrandTotalAmount>')
        ->toContain('<ram:DuePayableAmount>1147.03</ram:DuePayableAmount>')
        ->toContain('20260930')
        ->toContain('20261018');
});

it('marks small business invoices as exempt (E) with the legal note as reason', function () {
    Organization::current()->forceFill(['taxation_mode' => 'small_business'])->save();

    $xml = ciiOf(draft(DocumentType::Invoice, [itemRow('Workshop', '10', '95')], ['service_date' => '2026-09-30', 'due_date' => '2026-10-18']));

    expect(CiiBuilder::validate($xml))->toBe([])
        ->and($xml)->toContain('<ram:CategoryCode>E</ram:CategoryCode>')
        ->toContain('<ram:ExemptionReason>'.Text::t('legal.small_business').'</ram:ExemptionReason>')
        ->toContain('<ram:TaxTotalAmount currencyID="EUR">0.00</ram:TaxTotalAmount>');
});

it('marks EU reverse charge (AE) with the buyer VAT ID', function () {
    $customer = Customer::factory()->create(['name' => 'Fjord Analytics AB', 'country' => 'SE', 'vat_id' => 'SE556677889901', 'tax_treatment' => TaxTreatment::EuReverseCharge]);

    $xml = ciiOf(draft(DocumentType::Invoice, [itemRow()], ['customer_id' => $customer->id, 'service_date' => '2026-09-30', 'due_date' => '2026-10-18']));

    expect(CiiBuilder::validate($xml))->toBe([])
        ->and($xml)->toContain('<ram:CategoryCode>AE</ram:CategoryCode>')
        ->toContain('SE556677889901')
        ->toContain('<ram:ExemptionReason>');
});

it('turns a cancellation into a credit note (381) with positive amounts and the invoice reference', function () {
    app()->bind(DocumentArchiver::class, NullDocumentArchiver::class);
    $invoice = app(FinalizeDocument::class)->handle(systemActor(), draft(DocumentType::Invoice, [itemRow('Workshop', '10', '95')], ['service_date' => '2026-09-30', 'due_date' => '2026-10-18']));
    $cancellation = app(CancelInvoice::class)->handle(systemActor(), $invoice)->document;

    $xml = ciiOf($cancellation, 'CN-2026-0001');

    expect(CiiBuilder::validate($xml))->toBe([])
        ->and($xml)->toContain('<ram:TypeCode>381</ram:TypeCode>')
        ->toContain('<ram:IssuerAssignedID>'.$invoice->number.'</ram:IssuerAssignedID>')
        ->toContain('unitCode="HUR">10.0000</ram:BilledQuantity>')
        ->toContain('<ram:GrandTotalAmount>1130.50</ram:GrandTotalAmount>')
        ->not->toContain('>-');
});

it('reports XSD errors for broken XML and refuses to hand out an invalid e-invoice', function () {
    expect(CiiBuilder::validate('<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"/>'))->not->toBe([])
        ->and(CiiBuilder::validate('not xml'))->not->toBe([]);

    // a CII invoice needs at least one line item (IncludedSupplyChainTradeLineItem); compliance blocks this
    // case before finalizing, the builder must refuse it on its own as well
    $onlyText = draft(DocumentType::Invoice, [['kind' => 'text', 'title' => 'Nur Text', 'quantity' => '0', 'unit_price' => '0', 'unit_id' => null, 'tax_rate_id' => null, 'custom' => []]]);

    expect(fn () => ciiOf($onlyText))->toThrow(EInvoiceInvalidException::class);
});

it('converts amounts to float only when they survive the round trip', function () {
    expect(CiiAmount::of('1234567890123.45'))->toBe(1234567890123.45)
        ->and(CiiAmount::of('12.3456'))->toBe(12.3456)
        ->and(fn () => CiiAmount::of('12345678901234567.89'))->toThrow(LogicException::class);
});
```

Rechnung zur Kontrolle: 10 × 95 = 950,00; 1,125 × 12,3456 = 13,8888 → 13,89; netto 963,89; 19 % = 183,1391 → 183,14 (die Steuer wird je Satz einmal gerundet); brutto 1147,03. Storno: −10 × 95 → Gutschrift mit Menge 10 und 1130,50.

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

```bash
ddev artisan test --filter=CiiBuilderTest
```
Erwartet: FAIL (`Class "App\EInvoice\CiiBuilder" not found`).

- [ ] **Step 3: Implementieren**

`app/EInvoice/CiiAmount.php`:

```php
<?php

namespace App\EInvoice;

use Brick\Math\BigDecimal;
use LogicException;

/**
 * The one place where amounts become floats: horstoeko/zugferd takes floats and prints them with fixed
 * decimals (2 for amounts, 4 for unit prices and quantities). DECIMAL(15,4) has at most 15 significant
 * digits, which a double holds exactly enough to print back the same decimal – checked on every call.
 */
final class CiiAmount
{
    public static function of(BigDecimal|string $value): float
    {
        $decimal = BigDecimal::of($value);
        $float = $decimal->toFloat();
        if (! BigDecimal::of(sprintf('%.4F', $float))->isEqualTo($decimal)) {
            throw new LogicException("Amount {$decimal} can't be passed to the e-invoice builder without losing digits.");
        }

        return $float;
    }
}
```

`app/Exceptions/EInvoiceInvalidException.php`:

```php
<?php

namespace App\Exceptions;

use App\Support\Text;

/** The generated CII XML does not pass the EN 16931 schema; nothing is archived (422). */
final class EInvoiceInvalidException extends DomainActionException
{
    /**
     * @param  list<string>  $errors  schema messages
     */
    public function __construct(public readonly array $errors)
    {
        parent::__construct(Text::t('einvoice.invalid', ['errors' => implode('; ', array_slice($errors, 0, 3))]));
    }

    public function status(): int
    {
        return 422;
    }
}
```

`app/EInvoice/CiiBuilder.php`:

```php
<?php

namespace App\EInvoice;

use App\Domain\Totals\Totals;
use App\Enums\DocumentType;
use App\Enums\PositionKind;
use App\Enums\TaxCategory;
use App\Exceptions\EInvoiceInvalidException;
use App\Models\Document;
use Brick\Math\BigDecimal;
use DOMDocument;
use horstoeko\zugferd\ZugferdDocumentBuilder;
use horstoeko\zugferd\ZugferdProfiles;
use horstoeko\zugferd\ZugferdSettings;
use LibXMLError;
use LogicException;

/**
 * EN 16931 e-invoice (UN/CEFACT CII, Factur-X/ZUGFeRD profile EN 16931) of an invoice or cancellation,
 * built with horstoeko/zugferd from the same data as the PDF (snapshot-shaped sources and totals) and
 * checked against the XSD before it is handed out. A cancellation becomes a credit note (381) with
 * positive amounts that refers to its invoice.
 */
final class CiiBuilder
{
    /**
     * @param  array<string, mixed>  $sources  snapshot-shaped master data
     *
     * @throws EInvoiceInvalidException
     */
    public function build(Document $document, array $sources, Totals $totals): string
    {
        ZugferdSettings::setAmountDecimals(2);
        ZugferdSettings::setPercentDecimals(2);
        ZugferdSettings::setUnitAmountDecimals(4);
        ZugferdSettings::setQuantityDecimals(4);

        $credit = $document->type === DocumentType::Cancellation;
        $amount = fn (BigDecimal $value) => CiiAmount::of($credit ? $value->negated() : $value);
        $org = $sources['org'];
        $customer = $sources['customer'] ?? [];
        $unitCodes = array_column($sources['units'], 'code', 'id');

        $cii = ZugferdDocumentBuilder::createNew(ZugferdProfiles::PROFILE_EN16931)
            ->setDocumentInformation((string) $document->number, $credit ? '381' : '380', $document->date, 'EUR');
        foreach ($totals->legalNotes as $note) {
            $cii->addDocumentNote($note);
        }

        $cii->setDocumentSeller((string) $org['name'])
            ->setDocumentSellerAddress(self::text($org['street'] ?? null), null, null, self::text($org['zip'] ?? null), self::text($org['city'] ?? null), self::text($org['country'] ?? null));
        if (self::text($org['vat_id'] ?? null) !== null) {
            $cii->addDocumentSellerTaxRegistration('VA', $org['vat_id']);
        }
        if (self::text($org['tax_number'] ?? null) !== null) {
            $cii->addDocumentSellerTaxRegistration('FC', $org['tax_number']);
        }
        if (self::text($org['email'] ?? null) !== null) {
            $cii->setDocumentSellerCommunication('EM', $org['email']);
        }

        $cii->setDocumentBuyer((string) ($customer['name'] ?? ''), self::text($customer['number'] ?? null))
            ->setDocumentBuyerAddress(self::text($customer['street'] ?? null), null, null, self::text($customer['zip'] ?? null), self::text($customer['city'] ?? null), self::text($customer['country'] ?? null));
        if (self::text($customer['vat_id'] ?? null) !== null) {
            $cii->addDocumentBuyerTaxRegistration('VA', $customer['vat_id']);
        }

        if ($document->service_date !== null) {
            $cii->setDocumentSupplyChainEvent($document->service_date);
            if ($document->service_date_end !== null) {
                $cii->setDocumentBillingPeriod($document->service_date, $document->service_date_end);
            }
        }
        if ($credit && $document->source_id !== null) {
            $invoice = Document::query()->find($document->source_id);
            if ($invoice?->number !== null) {
                $cii->addDocumentInvoiceReferencedDocument($invoice->number, null, $invoice->date);
            }
        }
        if (! $credit && self::text($org['iban'] ?? null) !== null) {
            $cii->addDocumentPaymentMeanToCreditTransfer(str_replace(' ', '', (string) $org['iban']), self::text($org['name'] ?? null), null, self::text($org['bic'] ?? null));
        }
        if ($document->due_date !== null) {
            $cii->addDocumentPaymentTerm(null, $document->due_date);
        }

        $line = 0;
        foreach ($document->groups as $group) {
            foreach ($group->positions as $position) {
                if ($position->kind !== PositionKind::Item) {
                    continue;
                }
                $total = $totals->lines[$position->id] ?? throw new LogicException("Position {$position->id} has no line total.");
                $tax = $total->tax ?? throw new LogicException("Position {$position->id} has no tax rate.");
                $cii->addNewPosition((string) ++$line)
                    ->setDocumentPositionProductDetails($position->title, self::text($position->description))
                    ->setDocumentPositionNetPrice(CiiAmount::of(BigDecimal::of($position->unit_price)))
                    ->setDocumentPositionQuantity($amount(BigDecimal::of($position->quantity)), $position->unit_id === null ? 'C62' : ($unitCodes[$position->unit_id] ?? 'C62'))
                    ->addDocumentPositionTax($tax->category->value, 'VAT', CiiAmount::of($tax->percent))
                    ->setDocumentPositionLineSummation($amount($total->net));
            }
        }

        foreach ($totals->taxBreakdown as $row) {
            $cii->addDocumentTax($row->category->value, 'VAT', $amount($row->net), $amount($row->tax), CiiAmount::of($row->percent), self::exemptionReason($row->category, $totals));
        }
        $cii->setDocumentSummation($amount($totals->gross), $amount($totals->gross), $amount($totals->net), null, null, $amount($totals->net), $amount($totals->tax));

        $xml = $cii->getContent();
        $errors = self::validate($xml);
        if ($errors !== []) {
            throw new EInvoiceInvalidException($errors);
        }

        return $xml;
    }

    /**
     * Schema errors of a CII document against the EN 16931 XSD shipped with horstoeko/zugferd.
     *
     * @return list<string>
     */
    public static function validate(string $xml): array
    {
        $previous = libxml_use_internal_errors(true);
        try {
            $dom = new DOMDocument;
            if (! $dom->loadXML($xml, LIBXML_NONET)) {
                return self::libxmlErrors() ?: ['The XML is not well-formed.'];
            }
            $dom->schemaValidate(rtrim(ZugferdSettings::getSchemaDirectory(), '/').'/FACTUR-X_EN16931.xsd');

            return self::libxmlErrors();
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($previous);
        }
    }

    /** @return list<string> */
    private static function libxmlErrors(): array
    {
        return array_values(array_map(fn (LibXMLError $e): string => trim($e->message)." (line {$e->line})", libxml_get_errors()));
    }

    /** BT-120 for exempt categories: the position's tax note (e.g. § 19 UStG), else the first legal note. */
    private static function exemptionReason(TaxCategory $category, Totals $totals): ?string
    {
        if (in_array($category, [TaxCategory::S, TaxCategory::Z], true)) {
            return null;
        }
        foreach ($totals->lines as $line) {
            if ($line->tax?->category === $category && self::text($line->tax->note) !== null) {
                return $line->tax->note;
            }
        }

        return $totals->legalNotes[0] ?? null;
    }

    private static function text(mixed $value): ?string
    {
        return is_string($value) && trim($value) !== '' ? trim($value) : null;
    }
}
```

- [ ] **Step 4: Sprachschlüssel ergänzen** (danach sortieren wie in Task 2)

| Schlüssel | en | de |
|---|---|---|
| `einvoice.invalid` | `The e-invoice XML is not valid: :errors` | `Die E-Rechnung (XML) ist ungültig: :errors` |

- [ ] **Step 5: Tests laufen lassen**

```bash
ddev artisan test --filter=CiiBuilderTest
```
Erwartet: PASS. Prüfpunkte (mit horstoeko 1.0.132 in DDEV verifiziert: `setUnitAmountDecimals(4)` → `<ram:ChargeAmount>12.3456`, `setQuantityDecimals(4)` → `1.1250`, `ZugferdSettings::getSchemaDirectory()` zeigt auf `vendor/horstoeko/zugferd/src/schema`, Builder + XSD ohne Fehler):
- `setDocumentBillingPeriod(?DateTimeInterface $start, ?DateTimeInterface $end, ?string $description = null)` – Signatur in `vendor/horstoeko/zugferd/src/ZugferdDocumentBuilder.php` nachsehen, falls der Aufruf scheitert.
- Erscheint der Ausnahmegrund mit Sonderzeichen escaped (`§` bleibt, `&` wird `&amp;`), den Test auf `->toContain('<ram:ExemptionReason>')` plus `str_contains(html_entity_decode($xml), …)` umstellen.
- Der Fall „nur Textposition“ beruht auf `IncludedSupplyChainTradeLineItem` (im EN-16931-XSD ohne `minOccurs="0"`, also Pflicht). Die Factur-X-XSDs enthalten keine Codelisten (0 `enumeration`), Codes prüft das XSD also nicht – deshalb bleibt die Prüfung strukturell (siehe Entscheidungen, KoSIT).

- [ ] **Step 6: Commit**

```bash
ddev exec vendor/bin/pint
git add app/EInvoice app/Exceptions/EInvoiceInvalidException.php lang tests/Feature/EInvoice/CiiBuilderTest.php
git commit -m "$(cat <<'EOF'
feat(einvoice): build EN 16931 CII invoices and credit notes, validated against the XSD

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Archiv beim Abschließen – PdfArchive, DocumentRenderer, PdfDocumentArchiver (Rollback bei Gotenberg-Fehler)

**Files:**
- Create: `app/Rendering/PdfArchive.php`, `app/Rendering/RenderedDocument.php`, `app/Rendering/DocumentRenderer.php`, `app/Rendering/PdfDocumentArchiver.php`
- Create: `app/Exceptions/TemplateRenderFailedException.php`, `app/Exceptions/ArchiveCorruptedException.php`
- Modify: `app/Providers/AppServiceProvider.php` (Bindung), `app/Contracts/DocumentArchiver.php` (Docblock)
- Modify: `database/seeders/DemoSeeder.php` (abgeschlossene Demo-Dokumente archivieren, Leistungsdatum am Rechnungsentwurf, alte Archivdateien löschen)
- Modify: `tests/Integration/ParallelAllocation.php` (Kindprozesse ohne PDF)
- Modify: `lang/en.json`, `lang/de.json`
- Test: `tests/Feature/Actions/FinalizeArchiveTest.php`, `tests/Feature/DemoSeederTest.php`

**Interfaces:**
- Consumes: Task 4 (`LiquidRenderer`), Task 5 (`ContextBuilder`, `TemplateResolver`), Task 9 (`GotenbergClient`), Task 10 (`CiiBuilder`), Phase 2 (`DocumentArchiver`, `FinalizeDocument`)
- Produces: `PdfArchive::store(Document, DocumentFileKind, string): DocumentFile`, `PdfArchive::read(DocumentFile): string`, `DocumentRenderer::render(Document $document, array $sources, bool $draft): RenderedDocument`, `DocumentRenderer::isEInvoice(Document): bool`, `RenderedDocument{pdf, ?xml}`, `PdfDocumentArchiver` (gebunden an `DocumentArchiver`), `TemplateRenderFailedException(list<RenderError>)` (422, `toArray()`), `ArchiveCorruptedException::{missing, checksum, noFile}`

- [ ] **Step 1: Failing tests schreiben**

`tests/Feature/Actions/FinalizeArchiveTest.php`:

```php
<?php

use App\Actions\FinalizeDocument;
use App\EInvoice\CiiBuilder;
use App\Enums\DocumentFileKind;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\RenderPart;
use App\Exceptions\PdfRenderFailedException;
use App\Exceptions\TemplateRenderFailedException;
use App\Models\Document;
use App\Models\DocumentFile;
use App\Models\DocumentTypeSetting;
use App\Models\NumberSequence;
use App\Models\Template;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\Support\GotenbergFake;

function invoiceNumberCounter(): int
{
    return (int) NumberSequence::query()->where('doc_type', 'invoice')->where('year', (int) now()->format('Y'))->value('next_value');
}

function eInvoiceDraft(): Document
{
    completeOrganization();
    DocumentTypeSetting::query()->whereIn('type', ['invoice', 'cancellation'])->update(['profile' => 'en16931']);

    return draft(DocumentType::Invoice, [itemRow('Workshop', '10', '95')], ['service_date' => now()->toDateString(), 'due_date' => now()->addDays(14)->toDateString()]);
}

function assertNothingArchived(Document $document): void
{
    expect($document->fresh()->status)->toBe(DocumentStatus::Draft)
        ->and($document->fresh()->number)->toBeNull()
        ->and($document->fresh()->finalized_at)->toBeNull()
        ->and(DocumentFile::query()->count())->toBe(0)
        ->and(Storage::disk('archive')->allFiles())->toBe([])
        ->and(invoiceNumberCounter())->toBe(0);
}

it('archives the PDF under {year}/{id}.pdf with its SHA-256 and leaves no temporary file', function () {
    $document = draft(DocumentType::Invoice, [itemRow('Workshop', '10', '95')]);

    $done = app(FinalizeDocument::class)->handle(systemActor(), $document);

    $file = $done->files()->sole();
    $path = $done->date->format('Y')."/{$done->id}.pdf";
    expect($file->kind)->toBe(DocumentFileKind::Pdf)
        ->and($file->path)->toBe($path)
        ->and($file->sha256)->toBe(hash('sha256', (string) Storage::disk('archive')->get($path)))
        ->and($file->size)->toBe(strlen((string) Storage::disk('archive')->get($path)))
        ->and(Storage::disk('archive')->files('.tmp'))->toBe([]);
    Http::assertSent(fn (Request $request): bool => str_contains($request->body(), 'INV-'.now()->format('Y').'-0001')
        && ! str_contains($request->body(), 'name="pdfa"')
        && ! str_contains($request->body(), 'openbill-draft-mark'));
});

it('embeds and archives the e-invoice XML for the EN 16931 profile', function () {
    $done = app(FinalizeDocument::class)->handle(systemActor(), eInvoiceDraft());

    $xml = $done->files()->where('kind', DocumentFileKind::Xml)->sole();
    $contents = (string) Storage::disk('archive')->get($xml->path);
    expect($done->files()->count())->toBe(2)
        ->and($xml->path)->toBe($done->date->format('Y')."/{$done->id}.xml")
        ->and(CiiBuilder::validate($contents))->toBe([])
        ->and($contents)->toContain($done->number);
    Http::assertSent(fn (Request $request): bool => str_contains($request->body(), 'PDF/A-3b')
        && str_contains($request->body(), 'filename="factur-x.xml"')
        && str_contains($request->body(), $done->number));
});

it('rolls everything back when Gotenberg fails, so the number stays free (review focus 1)', function (Closure $failure) {
    $document = eInvoiceDraft();
    $failure();

    expect(fn () => app(FinalizeDocument::class)->handle(systemActor(), $document))->toThrow(PdfRenderFailedException::class);
    assertNothingArchived($document);

    GotenbergFake::succeed();
    expect(app(FinalizeDocument::class)->handle(systemActor(), $document->fresh())->number)->toBe('INV-'.now()->format('Y').'-0001');
})->with([
    'error answer' => [fn () => GotenbergFake::failWithError()],
    'timeout' => [fn () => GotenbergFake::timeOut()],
]);

it('refuses to finalize with a broken template and reports part and line (review focus 2)', function () {
    $template = Template::factory()->create(['body' => "<h1>{{ document.number }}</h1>\n{% if %}"]);
    $document = draft(DocumentType::Invoice, [itemRow()], ['template_id' => $template->id]);

    try {
        app(FinalizeDocument::class)->handle(systemActor(), $document);
        $this->fail('no exception');
    } catch (TemplateRenderFailedException $e) {
        expect($e->status())->toBe(422)
            ->and($e->errors[0]->part)->toBe(RenderPart::Body)
            ->and($e->errors[0]->line)->toBe(2)
            ->and($e->toArray()[0]['file'])->toBe('template.liquid');
    }

    assertNothingArchived($document);
    Http::assertNothingSent();
});

it('freezes the effective template in the snapshot when the document has none', function () {
    $document = draft();
    $document->forceFill(['template_id' => null])->save();

    $done = app(FinalizeDocument::class)->handle(systemActor(), $document);

    expect($done->snapshot->data['template']['slug'])->toBe('klar');
});
```

`tests/Feature/DemoSeederTest.php` – ergänzen (Imports `App\Models\DocumentFile`, `App\Actions\FinalizeDocument` falls nicht vorhanden, `Illuminate\Support\Facades\Storage`):

```php
it('archives a PDF for every finalized demo document and the XML for e-invoices', function () {
    $this->seed(DemoSeeder::class);

    $finalized = Document::query()->whereNotNull('finalized_at');
    expect(DocumentFile::query()->where('kind', 'pdf')->count())->toBe((clone $finalized)->count())
        ->and(DocumentFile::query()->where('kind', 'xml')->count())->toBe((clone $finalized)->whereIn('type', ['invoice', 'cancellation'])->count());
    foreach (DocumentFile::all() as $file) {
        Storage::disk('archive')->assertExists($file->path);
    }
});

it('removes the archive files of the previous demo data', function () {
    $this->seed(DemoSeeder::class);
    $old = Storage::disk('archive')->allFiles();
    $this->seed(DemoSeeder::class);

    expect(array_intersect($old, Storage::disk('archive')->allFiles()))->toBe([])
        ->and(count(Storage::disk('archive')->allFiles()))->toBe(DocumentFile::query()->count());
});

it('lets the demo invoice draft be finalized as e-invoice', function () {
    $this->seed(DemoSeeder::class);
    $draft = Document::query()->where('type', DocumentType::Invoice)->where('status', DocumentStatus::Draft)->firstOrFail();

    $done = app(FinalizeDocument::class)->handle(systemActor(), $draft);

    expect($done->status)->toBe(DocumentStatus::Open)
        ->and($done->files->map(fn (DocumentFile $file): string => $file->kind->value)->sort()->values()->all())->toBe(['pdf', 'xml']);
});
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

```bash
ddev artisan test --filter='FinalizeArchiveTest|DemoSeederTest'
```
Erwartet: FAIL (keine `document_files`, weil noch `NullDocumentArchiver` gebunden ist; `TemplateRenderFailedException` fehlt).

- [ ] **Step 3: Exceptions**

`app/Exceptions/TemplateRenderFailedException.php`:

```php
<?php

namespace App\Exceptions;

use App\Rendering\RenderError;
use App\Support\Text;

/** Finalizing (or a draft PDF) stopped because the template has errors (422 with part, file, line, message). */
final class TemplateRenderFailedException extends DomainActionException
{
    /**
     * @param  list<RenderError>  $errors
     */
    public function __construct(public readonly array $errors)
    {
        parent::__construct(Text::t('rendering.failed', ['count' => count($errors)]));
    }

    /**
     * @return list<array{part: string, file: string|null, line: int|null, message: string}>
     */
    public function toArray(): array
    {
        return array_map(fn (RenderError $error): array => $error->toArray(), $this->errors);
    }

    public function status(): int
    {
        return 422;
    }
}
```

`app/Exceptions/ArchiveCorruptedException.php`:

```php
<?php

namespace App\Exceptions;

use App\Enums\DocumentFileKind;
use App\Models\Document;
use App\Models\DocumentFile;
use RuntimeException;

/** An archived file is missing or no longer matches its SHA-256: a server problem, never re-rendered. */
final class ArchiveCorruptedException extends RuntimeException
{
    public static function missing(DocumentFile $file): self
    {
        return new self("Archive file {$file->path} of document {$file->document_id} is missing.");
    }

    public static function checksum(DocumentFile $file): self
    {
        return new self("Archive file {$file->path} of document {$file->document_id} does not match its SHA-256.");
    }

    public static function noFile(Document $document, DocumentFileKind $kind): self
    {
        return new self("Finalized document {$document->id} has no archived {$kind->value} file.");
    }
}
```

- [ ] **Step 4: PdfArchive, DocumentRenderer, PdfDocumentArchiver**

`app/Rendering/PdfArchive.php`:

```php
<?php

namespace App\Rendering;

use App\Enums\DocumentFileKind;
use App\Exceptions\ArchiveCorruptedException;
use App\Models\Document;
use App\Models\DocumentFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Archive of finalized documents on the disk "archive": {yyyy}/{document_id}.pdf|xml plus a
 * document_files row with SHA-256 and size. Files are written while FinalizeDocument's transaction is open.
 */
final class PdfArchive
{
    private const DISK = 'archive';

    /**
     * Writes to .tmp/ first and renames into place (atomic: never a half-written archive file). If the
     * transaction rolls back, the file is deleted again. A file left behind by a crash at the same path
     * belongs to no finalized document (the document is still a draft) and is overwritten.
     */
    public function store(Document $document, DocumentFileKind $kind, string $contents): DocumentFile
    {
        $disk = Storage::disk(self::DISK);
        $path = $document->date->format('Y')."/{$document->id}.{$kind->value}";
        $temporary = '.tmp/'.Str::ulid().'.'.$kind->value;

        $disk->put($temporary, $contents);
        DB::afterRollBack(function () use ($disk, $temporary, $path): void {
            $disk->delete([$temporary, $path]);
        });
        $disk->delete($path);
        $disk->move($temporary, $path);

        return $document->files()->create([
            'kind' => $kind,
            'path' => $path,
            'sha256' => hash('sha256', $contents),
            'size' => strlen($contents),
        ]);
    }

    /**
     * @throws ArchiveCorruptedException
     */
    public function read(DocumentFile $file): string
    {
        $disk = Storage::disk(self::DISK);
        if (! $disk->exists($file->path)) {
            throw ArchiveCorruptedException::missing($file);
        }
        $contents = (string) $disk->get($file->path);
        if (! hash_equals($file->sha256, hash('sha256', $contents))) {
            throw ArchiveCorruptedException::checksum($file);
        }

        return $contents;
    }
}
```

`app/Rendering/RenderedDocument.php`:

```php
<?php

namespace App\Rendering;

final readonly class RenderedDocument
{
    public function __construct(
        public string $pdf,
        public ?string $xml = null,
    ) {}
}
```

`app/Rendering/DocumentRenderer.php`:

```php
<?php

namespace App\Rendering;

use App\EInvoice\CiiBuilder;
use App\Enums\ComplianceProfile;
use App\Enums\DocumentType;
use App\Enums\RenderPart;
use App\Exceptions\EInvoiceInvalidException;
use App\Exceptions\PdfRenderFailedException;
use App\Exceptions\TemplateRenderFailedException;
use App\Models\Document;
use App\Models\DocumentTypeSetting;
use App\Support\Text;

/**
 * Document → context → HTML parts (+ e-invoice XML) → PDF. Used by the archiver while finalizing and by
 * the live draft download. Template errors never reach Gotenberg.
 */
final class DocumentRenderer
{
    public function __construct(
        private readonly ContextBuilder $contexts,
        private readonly LiquidRenderer $renderer,
        private readonly GotenbergClient $gotenberg,
        private readonly CiiBuilder $cii,
    ) {}

    /**
     * @param  array<string, mixed>  $sources  snapshot-shaped (the snapshot when finalizing, SnapshotBuilder for drafts)
     * @param  bool  $draft  live draft PDF: watermark, no e-invoice, no PDF/A
     *
     * @throws TemplateRenderFailedException|EInvoiceInvalidException|PdfRenderFailedException
     */
    public function render(Document $document, array $sources, bool $draft): RenderedDocument
    {
        if (! is_array($sources['template'] ?? null)) {
            throw new TemplateRenderFailedException([new RenderError(RenderPart::Body, null, Text::t('rendering.error.no_template'))]);
        }

        $context = $this->contexts->build($document, $sources);
        $mark = $draft ? mb_strtoupper(Text::t('template.draft', [], $document->locale)) : null;
        $result = $this->renderer->render(TemplateSource::fromSnapshot($sources['template']), $context->data, new RenderOptions($document->locale, $mark));
        if (! $result->ok()) {
            throw new TemplateRenderFailedException($result->errors);
        }

        $xml = ! $draft && self::isEInvoice($document) ? $this->cii->build($document, $sources, $context->totals) : null;

        return new RenderedDocument($this->gotenberg->pdf($result, $xml), $xml);
    }

    /** Invoices and cancellations whose document type uses the EN 16931 profile. */
    public static function isEInvoice(Document $document): bool
    {
        return in_array($document->type, [DocumentType::Invoice, DocumentType::Cancellation], true)
            && DocumentTypeSetting::query()->find($document->type->value)?->profile === ComplianceProfile::En16931;
    }
}
```

`app/Rendering/PdfDocumentArchiver.php`:

```php
<?php

namespace App\Rendering;

use App\Contracts\DocumentArchiver;
use App\Enums\DocumentFileKind;
use App\Models\Document;
use App\Models\DocumentSnapshot;

/** Phase 3 archiver: renders the finalized document from its snapshot and stores PDF (+ XML). */
final class PdfDocumentArchiver implements DocumentArchiver
{
    public function __construct(
        private readonly DocumentRenderer $renderer,
        private readonly PdfArchive $archive,
    ) {}

    public function archive(Document $document, DocumentSnapshot $snapshot): void
    {
        $rendered = $this->renderer->render($document, $snapshot->data, draft: false);

        $this->archive->store($document, DocumentFileKind::Pdf, $rendered->pdf);
        if ($rendered->xml !== null) {
            $this->archive->store($document, DocumentFileKind::Xml, $rendered->xml);
        }
    }
}
```

`app/Providers/AppServiceProvider.php` – in `register()`:

```php
        $this->app->bind(DocumentArchiver::class, PdfDocumentArchiver::class);
```

(Import `use App\Rendering\PdfDocumentArchiver;` statt `use App\Support\NullDocumentArchiver;`, Kommentar „phase 3 binds …“ entfernen. `NullDocumentArchiver` bleibt für Tests bestehen.)

`app/Contracts/DocumentArchiver.php` – den zweiten Punkt im Docblock ersetzen:

```php
     * - A rollback can't remove files: write them to a temporary path first, rename them into place
     *   (atomic) and delete them in DB::afterRollBack(). Renaming before the commit means a committed
     *   (immutable) document never points to a missing file; a file left by a crash is overwritten by
     *   the next attempt. See App\Rendering\PdfArchive.
```

- [ ] **Step 5: DemoSeeder archiviert**

In `database/seeders/DemoSeeder.php`:
- Konstruktor um `private readonly DocumentArchiver $archiver,` ergänzen (`use App\Contracts\DocumentArchiver;`, `use Illuminate\Support\Facades\Storage;`);
- in `run()` vor `DB::transaction(…)`: `$oldFiles = Storage::disk('archive')->allFiles();` und als erste Zeile in der Transaktion: `DB::afterCommit(fn () => Storage::disk('archive')->delete($oldFiles));` (die alten Dateien gehören zu Dokumenten, die `wipe()` löscht; erst nach dem Commit löschen, damit ein fehlgeschlagener Lauf nichts verliert; `use` für `$oldFiles` in die Closure aufnehmen);
- in `document()` den Snapshot-Teil ersetzen:

```php
        if ($data !== null) {
            $snapshot = $document->snapshot()->create(['data' => $data]);
            $this->archiver->archive($document, $snapshot);
        }
```

- beim Rechnungsentwurf (Hafenkontor, `'status' => DocumentStatus::Draft`, Typ Invoice) `'service_date' => $this->day(-1),` ergänzen – sonst lehnt das Profil EN 16931 den Abschluss ab (Abnahme: „Demo-Rechnung lässt sich abschließen“).

Paralleltest aus Phase 2 entkoppeln: `tests/Integration/NumberAllocationTest.php` finalisiert in Kindprozessen (`Concurrency`), die weder den Gotenberg-Fake noch die gefakte Archiv-Disk haben – sie würden echte PDFs nach `storage/app/archive` schreiben und die Nummern-Sperre minutenlang halten. Der Test prüft die Nummernvergabe, nicht das Rendern. In `tests/Integration/ParallelAllocation.php`, `finalizeTask()`, als erste Zeile der statischen Closure:

```php
            // number allocation is under test here, not rendering: no Gotenberg, no archive files in child processes
            app()->bind(\App\Contracts\DocumentArchiver::class, \App\Support\NullDocumentArchiver::class);
```

- [ ] **Step 6: Sprachschlüssel ergänzen** (danach sortieren wie in Task 2)

| Schlüssel | en | de |
|---|---|---|
| `rendering.error.no_template` | `There is no template. Run php artisan app:sync-templates.` | `Es gibt kein Template. php artisan app:sync-templates ausführen.` |
| `rendering.failed` | `The template has errors (:count).` | `Das Template enthält Fehler (:count).` |

- [ ] **Step 7: Tests laufen lassen**

```bash
ddev artisan test --filter='FinalizeArchiveTest|DemoSeederTest|FinalizeDocumentTest|DocumentFlowTest|ContextBuilderTest'
ddev artisan test --testsuite=Integration
ddev artisan test
```
Erwartet: alles grün. Hinweise:
- Jetzt rendert jeder Abschluss in den Feature-Tests über den Gotenberg-Fake. Schlägt ein Phase-2-Test fehl, weil sein Template absichtlich kaputt ist (z. B. `Template::factory()` mit `body => '<h1>v1</h1>'` ist gültig, also kein Problem) oder weil eine E-Rechnung die XSD-Prüfung nicht besteht: Ursache im `CiiBuilder` beheben, nicht den Test aufweichen.
- `DB::afterRollBack()` greift auch bei der verschachtelten Transaktion innerhalb von `RefreshDatabase` (Savepoint-Rollback ruft die Rollback-Callbacks der inneren Transaktion auf) – der Test „rolls everything back“ prüft genau das über `Storage::disk('archive')->allFiles()`.

- [ ] **Step 8: Commit**

```bash
ddev exec vendor/bin/pint
git add app/Rendering app/Exceptions app/Providers/AppServiceProvider.php app/Contracts/DocumentArchiver.php database/seeders/DemoSeeder.php lang tests/Feature/Actions/FinalizeArchiveTest.php tests/Feature/DemoSeederTest.php tests/Integration/ParallelAllocation.php
git commit -m "$(cat <<'EOF'
feat(pdf): archive PDF and e-invoice XML when finalizing, roll back on render failures

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Downloads und Vorschau – DocumentPdf, DocumentXml, RenderPreview, `app:render-sample`

**Files:**
- Create: `app/Actions/DocumentPdf.php`, `app/Actions/DocumentXml.php`, `app/Actions/RenderPreview.php`
- Create: `app/Rendering/PreviewResult.php`, `app/Support/IssueList.php`
- Create: `app/Console/Commands/RenderSample.php`
- Modify: `app/Exceptions/ActionNotAllowedException.php` (`noEInvoice()`), `app/Exceptions/ComplianceFailedException.php` (nutzt `IssueList`)
- Modify: `lang/en.json`, `lang/de.json`
- Test: `tests/Feature/Actions/DownloadTest.php`, `tests/Feature/Rendering/RenderPreviewTest.php`

**Interfaces:**
- Consumes: Task 5 (`DraftInput`, `DraftOverlay`, `TemplateResolver`), Task 6 (`SampleDataFactory`), Task 7 (`DownloadFile`), Task 11 (`PdfArchive`, `DocumentRenderer`)
- Produces: `DocumentPdf::handle(Actor, Document): DownloadFile`, `DocumentXml::handle(Actor, Document): DownloadFile`, `RenderPreview::handle(Actor, array $input): PreviewResult`, `PreviewResult{RenderResult $render, Totals $totals, list<ComplianceIssue> $issues}` + `toArray()`, `IssueList::toArray(array)`, `ActionNotAllowedException::noEInvoice()` (`reason = no_e_invoice`), Kommando `app:render-sample`

- [ ] **Step 1: Failing tests schreiben**

`tests/Feature/Actions/DownloadTest.php`:

```php
<?php

use App\Actions\DocumentPdf;
use App\Actions\DocumentXml;
use App\Actions\FinalizeDocument;
use App\Enums\DocumentFileKind;
use App\Enums\DocumentType;
use App\Exceptions\ActionNotAllowedException;
use App\Exceptions\ArchiveCorruptedException;
use App\Models\Customer;
use App\Models\DocumentTypeSetting;
use App\Models\FieldDefinition;
use App\Models\Template;
use App\Models\TaxRate;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

it('renders a draft PDF live with a watermark and archives nothing', function () {
    $document = draft();

    $file = app(DocumentPdf::class)->handle(systemActor(), $document);

    expect($file->filename)->toBe("draft-{$document->id}.pdf")
        ->and($file->mimeType)->toBe('application/pdf')
        ->and($file->contents)->toStartWith('%PDF-')
        ->and($document->files()->count())->toBe(0);
    Http::assertSent(fn (Request $request): bool => str_contains($request->body(), 'openbill-draft-mark') && ! str_contains($request->body(), 'name="pdfa"'));
});

it('delivers the archived PDF of a finalized document byte for byte after master data changed (review focus 3)', function () {
    $template = Template::factory()->create(['body' => '<h1>{{ document.number }} {{ customer.name }}</h1>']);
    FieldDefinition::factory()->create(['key' => 'project_name', 'label' => 'Project', 'doc_types' => ['invoice']]);
    $customer = Customer::factory()->create(['name' => 'Hafenkontor Lindqvist GmbH']);
    $done = app(FinalizeDocument::class)->handle(systemActor(), draft(DocumentType::Invoice, [itemRow()], ['customer_id' => $customer->id, 'template_id' => $template->id]));
    $archived = (string) Storage::disk('archive')->get($done->files()->sole()->path);

    $customer->forceFill(['name' => 'Renamed'])->save();
    TaxRate::query()->whereKey(vatRateId())->update(['percent' => '25.00']);
    $template->forceFill(['body' => '<h1>changed</h1>'])->save();
    FieldDefinition::query()->update(['label' => 'Renamed']);

    $file = app(DocumentPdf::class)->handle(systemActor(), $done->fresh());

    expect($file->contents)->toBe($archived)
        ->and($file->filename)->toBe("{$done->number}.pdf");
    Http::assertSentCount(1);

    // a fresh render would differ (the fake PDF depends on the request): proves the download is not re-rendered
    expect(app(DocumentPdf::class)->handle(systemActor(), draft())->contents)->not->toBe($archived);
});

it('refuses a tampered or missing archive file instead of rendering again', function () {
    $done = app(FinalizeDocument::class)->handle(systemActor(), draft());
    $path = $done->files()->sole()->path;

    Storage::disk('archive')->put($path, 'tampered');
    expect(fn () => app(DocumentPdf::class)->handle(systemActor(), $done->fresh()))->toThrow(ArchiveCorruptedException::class);

    Storage::disk('archive')->delete($path);
    expect(fn () => app(DocumentPdf::class)->handle(systemActor(), $done->fresh()))->toThrow(ArchiveCorruptedException::class);
    Http::assertSentCount(1);
});

it('delivers the archived XML of an e-invoice and refuses documents without one', function () {
    completeOrganization();
    DocumentTypeSetting::query()->whereKey('invoice')->update(['profile' => 'en16931']);
    $eInvoice = app(FinalizeDocument::class)->handle(systemActor(), draft(DocumentType::Invoice, [itemRow()], ['service_date' => now()->toDateString(), 'due_date' => now()->addDays(14)->toDateString()]));
    $offer = app(FinalizeDocument::class)->handle(systemActor(), draft(DocumentType::Offer));

    $xml = app(DocumentXml::class)->handle(systemActor(), $eInvoice);

    expect($xml->filename)->toBe("{$eInvoice->number}.xml")
        ->and($xml->mimeType)->toBe('application/xml')
        ->and($xml->contents)->toBe(Storage::disk('archive')->get($eInvoice->files()->where('kind', DocumentFileKind::Xml)->sole()->path));

    foreach ([$offer, draft()] as $document) {
        try {
            app(DocumentXml::class)->handle(systemActor(), $document);
            $this->fail('no exception');
        } catch (ActionNotAllowedException $e) {
            expect($e->reason)->toBe('no_e_invoice')->and($e->status())->toBe(409);
        }
    }
});
```

`tests/Feature/Rendering/RenderPreviewTest.php`:

```php
<?php

use App\Actions\FinalizeDocument;
use App\Actions\RenderPreview;
use App\Enums\DocumentType;
use App\Exceptions\DocumentLockedException;
use App\Models\Customer;
use App\Models\Template;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;

it('answers with the shape of POST /api/render', function () {
    $result = app(RenderPreview::class)->handle(systemActor(), ['scenario' => 'short_invoice', 'locale' => 'de']);

    expect(array_keys($result->toArray()))->toBe(['header', 'body', 'footer', 'paper', 'errors', 'totals', 'issues'])
        ->and($result->toArray()['errors'])->toBe([])
        ->and($result->toArray()['totals']['gross'])->toBe('4105.50')
        ->and($result->toArray()['body'])->toContain('Hafenkontor Lindqvist GmbH');
    Http::assertNothingSent();
});

it('reports errors of an unsaved template instead of throwing (review focus 2)', function () {
    $klar = Template::query()->where('slug', 'klar')->firstOrFail();

    $result = app(RenderPreview::class)->handle(systemActor(), [
        'template_id' => $klar->id,
        'scenario' => 'long_invoice',
        'template' => ['body' => "<p>ok</p>\n{% for p in positions %}{{ p.title }"],
    ])->toArray();

    expect($result['errors'])->toBe([['part' => 'body', 'file' => 'template.liquid', 'line' => 2, 'message' => $result['errors'][0]['message']]])
        ->and($result['header'])->toContain('<span class="h-doc">');
});

it('previews unsaved draft changes with totals and compliance issues without saving them', function () {
    $document = draft(DocumentType::Invoice, [itemRow('Workshop', '10', '95')]);

    $result = app(RenderPreview::class)->handle(systemActor(), [
        'document_id' => $document->id,
        'draft' => ['groups' => [['title' => null, 'positions' => [itemRow('Workshop', '2', '95')]]]],
    ])->toArray();

    expect($result['totals']['net'])->toBe('190.00')
        ->and($result['issues'])->toBe([])
        ->and($document->fresh()->net_total)->toBe('950.00');
});

it('prefixes validation errors of the draft with draft.', function () {
    $document = draft();

    try {
        app(RenderPreview::class)->handle(systemActor(), ['document_id' => $document->id, 'draft' => ['groups' => [['positions' => [['kind' => 'item', 'quantity' => 'x']]]]]]);
        $this->fail('no exception');
    } catch (ValidationException $e) {
        expect(array_keys($e->errors()))->toBe(['draft.groups.0.positions.0.quantity']);
    }
});

it('renders a finalized document from its snapshot and refuses unsaved changes for it', function () {
    $customer = Customer::factory()->create(['name' => 'Hafenkontor Lindqvist GmbH']);
    $done = app(FinalizeDocument::class)->handle(systemActor(), draft(DocumentType::Invoice, [itemRow()], ['customer_id' => $customer->id]));
    $customer->forceFill(['name' => 'Renamed'])->save();

    $result = app(RenderPreview::class)->handle(systemActor(), ['document_id' => $done->id])->toArray();

    expect($result['body'])->toContain('Hafenkontor Lindqvist GmbH')->not->toContain('Renamed')
        ->and($result['issues'])->toBe([])
        ->and(fn () => app(RenderPreview::class)->handle(systemActor(), ['document_id' => $done->id, 'draft' => ['intro' => 'x']]))
        ->toThrow(DocumentLockedException::class);
});

it('needs exactly one source', function (array $input) {
    expect(fn () => app(RenderPreview::class)->handle(systemActor(), $input))->toThrow(ValidationException::class);
})->with([
    'none' => [[]],
    'both' => [['scenario' => 'short_invoice', 'document_id' => 'x']],
    'unknown scenario' => [['scenario' => 'huge_invoice']],
    'draft without document' => [['scenario' => 'short_invoice', 'draft' => ['intro' => 'x']]],
]);

it('renders a sample PDF from the console', function () {
    $out = storage_path('framework/testing/sample.pdf');

    $this->artisan('app:render-sample', ['template' => 'kante', 'scenario' => 'offer_with_options', '--locale' => 'en', '--out' => $out])
        ->expectsOutputToContain($out)
        ->assertSuccessful();

    expect((string) file_get_contents($out))->toStartWith('%PDF-');
    unlink($out);
});
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

```bash
ddev artisan test --filter='DownloadTest|RenderPreviewTest'
```
Erwartet: FAIL (`Class "App\Actions\DocumentPdf" not found`).

- [ ] **Step 3: IssueList, Exceptions**

`app/Support/IssueList.php`:

```php
<?php

namespace App\Support;

use App\Domain\Compliance\ComplianceIssue;

final class IssueList
{
    /**
     * Compliance issues as the API shows them, translated into the current app language.
     *
     * @param  list<ComplianceIssue>  $issues
     * @return list<array{path: string, message: string}>
     */
    public static function toArray(array $issues): array
    {
        return array_map(fn (ComplianceIssue $issue): array => [
            'path' => $issue->path,
            'message' => Text::t('compliance.'.$issue->rule->value, $issue->params),
        ], $issues);
    }
}
```

`app/Exceptions/ComplianceFailedException.php` – `toArray()` wird zu `return IssueList::toArray($this->issues);` (Import `App\Support\IssueList`, `ComplianceIssue`-Import bleibt für den Docblock).

`app/Exceptions/ActionNotAllowedException.php` – ergänzen:

```php
    /** No archived e-invoice XML: not finalized, or not an EN 16931 invoice/cancellation. */
    public static function noEInvoice(): self
    {
        return new self('no_e_invoice', Text::t('errors.no_e_invoice'));
    }
```

- [ ] **Step 4: Actions und PreviewResult**

`app/Actions/DocumentPdf.php`:

```php
<?php

namespace App\Actions;

use App\Enums\DocumentFileKind;
use App\Exceptions\ArchiveCorruptedException;
use App\Exceptions\PdfRenderFailedException;
use App\Exceptions\TemplateRenderFailedException;
use App\Models\Document;
use App\Rendering\DocumentRenderer;
use App\Rendering\PdfArchive;
use App\Support\Actor;
use App\Support\DownloadFile;
use App\Support\SnapshotBuilder;

/**
 * PDF download. Finalized: always the archived file (checked against its SHA-256), never rendered again –
 * later changes to customers, tax rates, templates or fields can't touch it. Draft: rendered live from the
 * current master data with a watermark, not archived.
 */
final class DocumentPdf
{
    public function __construct(
        private readonly PdfArchive $archive,
        private readonly DocumentRenderer $renderer,
        private readonly SnapshotBuilder $snapshots,
    ) {}

    /**
     * @throws ArchiveCorruptedException|TemplateRenderFailedException|PdfRenderFailedException
     */
    public function handle(Actor $actor, Document $document): DownloadFile
    {
        $name = DownloadFile::nameFor($document, 'pdf');
        if ($document->isFinalized()) {
            $file = $document->files()->where('kind', DocumentFileKind::Pdf)->first()
                ?? throw ArchiveCorruptedException::noFile($document, DocumentFileKind::Pdf);

            return new DownloadFile($name, 'application/pdf', $this->archive->read($file));
        }

        $document->loadMissing('groups.positions');

        return new DownloadFile($name, 'application/pdf', $this->renderer->render($document, $this->snapshots->build($document), draft: true)->pdf);
    }
}
```

`app/Actions/DocumentXml.php`:

```php
<?php

namespace App\Actions;

use App\Enums\DocumentFileKind;
use App\Exceptions\ActionNotAllowedException;
use App\Exceptions\ArchiveCorruptedException;
use App\Models\Document;
use App\Rendering\PdfArchive;
use App\Support\Actor;
use App\Support\DownloadFile;

/** The archived EN 16931 XML of a finalized e-invoice (the same bytes that are embedded in its PDF). */
final class DocumentXml
{
    public function __construct(private readonly PdfArchive $archive) {}

    /**
     * @throws ActionNotAllowedException|ArchiveCorruptedException
     */
    public function handle(Actor $actor, Document $document): DownloadFile
    {
        $file = $document->isFinalized() ? $document->files()->where('kind', DocumentFileKind::Xml)->first() : null;
        if ($file === null) {
            throw ActionNotAllowedException::noEInvoice();
        }

        return new DownloadFile(DownloadFile::nameFor($document, 'xml'), 'application/xml', $this->archive->read($file));
    }
}
```

`app/Rendering/PreviewResult.php`:

```php
<?php

namespace App\Rendering;

use App\Domain\Compliance\ComplianceIssue;
use App\Domain\Totals\Totals;
use App\Support\IssueList;

/** Answer of POST /api/render (phase 4): rendered parts, paper, template errors, totals and compliance issues. */
final readonly class PreviewResult
{
    /**
     * @param  list<ComplianceIssue>  $issues
     */
    public function __construct(
        public RenderResult $render,
        public Totals $totals,
        public array $issues = [],
    ) {}

    /**
     * @return array<string, mixed> {header, body, footer, paper, errors, totals, issues}
     */
    public function toArray(): array
    {
        return [
            ...$this->render->toArray(),
            'totals' => $this->totals->toArray(),
            'issues' => IssueList::toArray($this->issues),
        ];
    }
}
```

`app/Actions/RenderPreview.php`:

```php
<?php

namespace App\Actions;

use App\Enums\RenderScenario;
use App\Exceptions\DocumentLockedException;
use App\Models\Document;
use App\Models\Template;
use App\Rendering\ContextBuilder;
use App\Rendering\LiquidRenderer;
use App\Rendering\PreviewResult;
use App\Rendering\RenderOptions;
use App\Rendering\SampleDataFactory;
use App\Rendering\TemplateSource;
use App\Support\Actor;
use App\Support\DocumentInspector;
use App\Support\DraftInput;
use App\Support\DraftOverlay;
use App\Support\TemplateResolver;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Live preview behind POST /api/render (phase 4) for the document editor (6), the template editor (7)
 * and the toolkit (9). Sources: a saved document (draft: live master data, optionally with unsaved
 * changes in "draft"; finalized: its snapshot) or a sample scenario. Template: unsaved parts in
 * "template" over template_id, else the document's template. Template problems are part of the
 * result (errors) – nothing here writes.
 */
final class RenderPreview
{
    public function __construct(
        private readonly ContextBuilder $contexts,
        private readonly LiquidRenderer $renderer,
        private readonly DocumentInspector $inspector,
        private readonly SampleDataFactory $samples,
    ) {}

    /**
     * @param  array<string, mixed>  $input
     *
     * @throws ValidationException|DocumentLockedException
     */
    public function handle(Actor $actor, array $input): PreviewResult
    {
        $text = ['sometimes', 'nullable', 'string', 'max:1048576'];
        $data = Validator::make($input, [
            'template_id' => ['sometimes', 'nullable', 'string', Rule::exists('templates', 'id')],
            'template' => ['sometimes', 'array'],
            'template.header' => $text,
            'template.body' => $text,
            'template.footer' => $text,
            'template.css' => $text,
            'template.manifest' => ['sometimes', 'array'],
            'document_id' => ['required_without:scenario', 'prohibits:scenario', 'string', Rule::exists('documents', 'id')],
            'draft' => ['sometimes', 'array', 'prohibits:scenario'],
            'scenario' => ['required_without:document_id', Rule::enum(RenderScenario::class)],
            'locale' => ['sometimes', Rule::in(['en', 'de'])],
        ])->validate();

        $issues = [];
        if (isset($data['scenario'])) {
            $sample = $this->samples->make(RenderScenario::from($data['scenario']), $data['locale'] ?? app()->getLocale());
            [$document, $sources] = [$sample->document, $sample->sources];
            $fallback = TemplateResolver::fallback();
            $base = $fallback === null ? new TemplateSource('', '', '', '') : TemplateSource::fromModel($fallback);
        } else {
            $document = Document::query()->with('groups.positions')->findOrFail($data['document_id']);
            if (isset($data['draft'])) {
                if ($document->isFinalized()) {
                    throw DocumentLockedException::for($document);
                }
                $document = DraftOverlay::apply($document, self::draftInput($document, $data['draft']));
            }
            $sources = $this->inspector->sources($document);
            $issues = $document->isFinalized() ? [] : $this->inspector->issues($document, $sources);
            $base = TemplateSource::fromSnapshot(is_array($sources['template'] ?? null) ? $sources['template'] : []);
        }

        if (isset($data['template_id'])) {
            $base = TemplateSource::fromModel(Template::query()->with('assets')->findOrFail($data['template_id']));
        }
        $template = isset($data['template']) ? $base->with($data['template']) : $base;

        $context = $this->contexts->build($document, $sources);
        $result = $this->renderer->render($template, $context->data, new RenderOptions($document->locale));

        return new PreviewResult($result, $context->totals, $issues);
    }

    /**
     * @param  array<string, mixed>  $draft
     * @return array<string, mixed>
     *
     * @throws ValidationException paths prefixed with "draft."
     */
    private static function draftInput(Document $document, array $draft): array
    {
        try {
            return DraftInput::validate($document, $draft);
        } catch (ValidationException $e) {
            $messages = [];
            foreach ($e->errors() as $path => $list) {
                $messages["draft.{$path}"] = $list;
            }
            throw ValidationException::withMessages($messages);
        }
    }
}
```

- [ ] **Step 5: Kommando `app:render-sample`**

`app/Console/Commands/RenderSample.php`:

```php
<?php

namespace App\Console\Commands;

use App\Actions\RenderPreview;
use App\Models\Template;
use App\Rendering\GotenbergClient;
use App\Support\Actor;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

/** For template authors and reviews: a template with sample data as PDF, without creating documents. */
class RenderSample extends Command
{
    protected $signature = 'app:render-sample
        {template=klar : template slug}
        {scenario=short_invoice : short_invoice, long_invoice, small_business, reverse_charge or offer_with_options}
        {--locale=de : en or de}
        {--out= : PDF path (default storage/app/private/samples/<template>-<scenario>-<locale>.pdf)}';

    protected $description = 'Render a template with sample data to a PDF (via Gotenberg)';

    public function handle(RenderPreview $preview, GotenbergClient $gotenberg): int
    {
        $slug = (string) $this->argument('template');
        $scenario = (string) $this->argument('scenario');
        $locale = (string) $this->option('locale');
        $template = Template::query()->where('slug', $slug)->first();
        if ($template === null) {
            $this->error("No template with the slug {$slug}.");

            return self::FAILURE;
        }

        $result = $preview->handle(Actor::system(), ['template_id' => $template->id, 'scenario' => $scenario, 'locale' => $locale]);
        foreach ($result->render->errors as $error) {
            $this->warn("{$error->part->value}".($error->line === null ? '' : ":{$error->line}").": {$error->message}");
        }

        $out = (string) ($this->option('out') ?: storage_path("app/private/samples/{$slug}-{$scenario}-{$locale}.pdf"));
        File::ensureDirectoryExists(dirname($out));
        File::put($out, $gotenberg->pdf($result->render));
        $this->info("PDF written to {$out}");

        return self::SUCCESS;
    }
}
```

- [ ] **Step 6: Sprachschlüssel ergänzen** (danach sortieren wie in Task 2)

| Schlüssel | en | de |
|---|---|---|
| `errors.no_e_invoice` | `This document has no e-invoice XML (only finalized invoices and cancellations with the EN 16931 profile have one).` | `Zu diesem Dokument gibt es keine E-Rechnung (nur abgeschlossene Rechnungen und Stornos mit dem Profil EN 16931 haben eine).` |

- [ ] **Step 7: Tests laufen lassen**

```bash
ddev artisan test --filter='DownloadTest|RenderPreviewTest|FinalizeDocumentTest'
```
Erwartet: PASS. Prüfpunkte:
- `prohibits:scenario` an `document_id` und `draft` deckt „beide Quellen“ und „Entwurf ohne Dokument“ ab; `Rule::enum` lehnt `huge_invoice` ab.
- `$result['header']` im Test „reports errors of an unsaved template“ enthält `<span class="h-doc">` aus dem gespeicherten Kopf von Klar (nur `body` wurde überschrieben).
- `app:render-sample` läuft in Feature-Tests gegen den Gotenberg-Fake.

Von Hand in DDEV (echtes Gotenberg) ansehen:

```bash
ddev artisan app:render-sample klar long_invoice --locale=de
ddev artisan app:render-sample kante offer_with_options --locale=en
ddev artisan app:render-sample leise reverse_charge --locale=de
```
Erwartet: je `PDF written to /var/www/html/storage/app/private/samples/<…>.pdf`; die Dateien auf dem Mac unter `storage/app/private/samples/` öffnen. Kopf- und Fußzeile auf jeder Seite, Seitenzahlen „Seite x von y“, Kante mit farbigem Band (Hintergründe gedruckt), Tabellenzeilen nicht abgeschnitten.

- [ ] **Step 8: Commit**

```bash
ddev exec vendor/bin/pint
git add app/Actions app/Rendering/PreviewResult.php app/Support/IssueList.php app/Exceptions app/Console/Commands/RenderSample.php lang tests/Feature/Actions/DownloadTest.php tests/Feature/Rendering/RenderPreviewTest.php
git commit -m "$(cat <<'EOF'
feat(rendering): add PDF/XML downloads, render preview action and sample PDF command

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Integrationstests gegen echtes Gotenberg (DDEV-Dienst, CI-Service)

**Files:**
- Create: `tests/Integration/GotenbergTest.php`
- Modify: `.github/workflows/tests.yml` (Gotenberg vor Pest abwarten)

**Interfaces:**
- Consumes: Task 8 (Templates), Task 11 (Archiv), Task 12 (`RenderPreview`), `DemoSeeder`
- Produces: Integrationstests (Gruppe `gotenberg`), CI wartet vor Pest auf Gotenberg

Die Suite `Integration` läuft mit `DatabaseMigrations` und **ohne** Gotenberg-Fake (`Tests\TestCase`, nicht `FeatureTestCase`). In DDEV ist Gotenberg unter `http://gotenberg:3000` erreichbar, in CI als Service unter `http://127.0.0.1:3000` (`GOTENBERG_URL` in `tests.yml`, schon vorhanden). Die Tests tragen die Gruppe `gotenberg`.

- [ ] **Step 1: Failing tests schreiben**

`tests/Integration/GotenbergTest.php`:

```php
<?php

use App\Actions\FinalizeDocument;
use App\Actions\RenderPreview;
use App\EInvoice\CiiBuilder;
use App\Enums\DocumentFileKind;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Models\Document;
use App\Models\Template;
use App\Rendering\GotenbergClient;
use Database\Seeders\DemoSeeder;
use horstoeko\zugferd\ZugferdDocumentPdfReader;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Smalot\PdfParser\Parser;

beforeEach(fn () => Storage::fake('archive'));

/** Text of every page, whitespace removed (pdfparser splits words of Chromium PDFs unpredictably). */
function pageTexts(string $pdf): array
{
    return array_map(fn ($page): string => (string) preg_replace('/\s+/', '', $page->getText()), (new Parser)->parseContent($pdf)->getPages());
}

it('talks to a Gotenberg that can embed Factur-X (8.34 or newer)', function () {
    $version = trim(Http::timeout(10)->get(config('services.gotenberg.url').'/version')->body());

    expect(version_compare(ltrim($version, 'v'), '8.34.0', '>='))->toBeTrue("Gotenberg {$version} is older than 8.34");
})->group('gotenberg');

it('renders each built-in template as a multi-page PDF with header and footer on every page', function (string $slug, Closure $pageMarker) {
    $preview = app(RenderPreview::class)->handle(systemActor(), [
        'template_id' => Template::query()->where('slug', $slug)->value('id'),
        'scenario' => 'long_invoice',
        'locale' => 'de',
    ]);
    expect($preview->render->errors)->toBe([]);

    $pages = pageTexts(app(GotenbergClient::class)->pdf($preview->render));
    $total = count($pages);

    expect($total)->toBeGreaterThan(1);
    foreach ($pages as $i => $text) {
        expect($text)->toContain('StudioNordlicht')
            ->and($text)->toContain($pageMarker($i + 1, $total));
    }
})->with([
    'klar' => ['klar', fn (int $page, int $total): string => "Seite{$page}von{$total}"],
    'kante' => ['kante', fn (int $page, int $total): string => "{$page}/{$total}"],
    'leise' => ['leise', fn (int $page, int $total): string => "{$page}/{$total}"],
])->group('gotenberg');

it('finalizes the demo invoice into a PDF/A-3b with the archived XML embedded', function () {
    $this->seed(DemoSeeder::class);
    $draft = Document::query()->where('type', DocumentType::Invoice)->where('status', DocumentStatus::Draft)->firstOrFail();

    $done = app(FinalizeDocument::class)->handle(systemActor(), $draft);

    $pdf = (string) Storage::disk('archive')->get($done->files()->where('kind', DocumentFileKind::Pdf)->sole()->path);
    $xml = (string) Storage::disk('archive')->get($done->files()->where('kind', DocumentFileKind::Xml)->sole()->path);
    $meta = Http::timeout(30)->attach('files', $pdf, 'invoice.pdf')
        ->post(config('services.gotenberg.url').'/forms/pdfengines/metadata/read')
        ->json('invoice.pdf');

    expect(ZugferdDocumentPdfReader::getXmlFromContent($pdf))->toBe($xml)
        ->and(CiiBuilder::validate($xml))->toBe([])
        ->and($xml)->toContain((string) $done->number)
        ->and($meta['Part'] ?? null)->toBe(3)
        ->and($meta['Conformance'] ?? null)->toBe('B')
        ->and($meta['DocumentFileName'] ?? null)->toBe('factur-x.xml')
        ->and($meta['ConformanceLevel'] ?? null)->toBe('EN 16931')
        ->and(implode('', pageTexts($pdf)))->toContain(str_replace(' ', '', (string) $done->number));
})->group('gotenberg');
```

Am 2026-10-11 in DDEV geprüft: Gotenberg 8.37.0 liefert für ein PDF/A-3b mit `facturxXml` die Metadaten `{"Part":3,"Conformance":"B","DocumentFileName":"factur-x.xml","ConformanceLevel":"EN 16931",…}`, `ZugferdDocumentPdfReader::getXmlFromContent()` gibt die XML byte-gleich zurück, und die Fußzeile mit `pageNumber`/`totalPages` bleibt nach der PDF/A-Konvertierung erhalten (Text „Seite1von1“).

- [ ] **Step 2: Tests laufen lassen**

```bash
ddev artisan test --testsuite=Integration --group=gotenberg
```
Erwartet: PASS (5 Tests; der Demo-Test dauert länger, weil der Seeder sechs Dokumente über Gotenberg archiviert). Falls ein Template-Test bei einer einzelnen Seite endet (`toBeGreaterThan(1)` schlägt fehl): `long_invoice` hat 49 Positionen in 4 Gruppen – das reicht bei allen drei Layouts für mindestens zwei Seiten; sonst ist das Seitenlayout kaputt (Fußzeile verdeckt Inhalt o. ä.), nicht der Test.

```bash
ddev artisan test
```
Erwartet: alle Suiten grün (`Unit`, `Feature`, `Integration`).

- [ ] **Step 3: CI – Gotenberg vor Pest abwarten**

In `.github/workflows/tests.yml` den Schritt „Gotenberg reachable“ **vor** `Pest` verschieben und mit Wiederholungen versehen (der Service braucht nach dem Start einige Sekunden):

```yaml
      - name: Gotenberg reachable
        run: curl -fsS --retry 15 --retry-delay 2 --retry-all-errors http://127.0.0.1:3000/health

      - name: Pest
        run: php artisan test
```

Der alte Schritt nach `Pest` entfällt. Der Service `gotenberg/gotenberg:8` zieht immer die neueste 8.x (≥ 8.34), `GOTENBERG_URL` ist gesetzt – sonst nichts zu ändern. Prüfen:

```bash
grep -n "gotenberg" .github/workflows/tests.yml
```
Erwartet: Service-Image, `GOTENBERG_URL: http://127.0.0.1:3000` und der Health-Schritt vor `php artisan test`.

- [ ] **Step 4: Commit**

```bash
ddev exec vendor/bin/pint
git add tests/Integration/GotenbergTest.php .github/workflows/tests.yml
git commit -m "$(cat <<'EOF'
test(pdf): render, finalize and embed the e-invoice against a real gotenberg

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Architekturregeln, kein float, statische Analyse

**Files:**
- Modify: `tests/Unit/ArchTest.php`, `tests/Unit/NoFloatTest.php`
- Modify: ggf. `phpstan.neon` (nur falls Larastan in Fremdcode-Typen hängen bleibt)

**Interfaces:**
- Consumes: alle Klassen aus Task 1–12
- Produces: Architekturregeln für `App\Rendering`/`App\EInvoice`, float-Verbot außer `CiiAmount`

- [ ] **Step 1: Failing tests schreiben**

`tests/Unit/ArchTest.php` – ergänzen:

```php
arch('rendering and e-invoice code does not call actions or the http layer')
    ->expect(['App\Rendering', 'App\EInvoice'])
    ->not->toUse(['App\Actions', 'App\Http']);

arch('rendering and e-invoice classes are final')
    ->expect(['App\Rendering', 'App\EInvoice'])
    ->classes()
    ->toBeFinal();

arch('only the rendering layer talks to Gotenberg')
    ->expect('Gotenberg')
    ->toOnlyBeUsedIn('App\Rendering\GotenbergClient');

arch('only the e-invoice layer uses horstoeko/zugferd')
    ->expect('horstoeko\zugferd')
    ->toOnlyBeUsedIn('App\EInvoice');
```

und die Liste der Domain-Exceptions erweitern:

```php
arch('domain exceptions carry an HTTP status')
    ->expect([
        'App\Exceptions\DocumentLockedException', 'App\Exceptions\ActionNotAllowedException', 'App\Exceptions\ComplianceFailedException',
        'App\Exceptions\TemplateRenderFailedException', 'App\Exceptions\PdfRenderFailedException', 'App\Exceptions\EInvoiceInvalidException',
    ])
    ->toExtend('App\Exceptions\DomainActionException');
```

`tests/Unit/NoFloatTest.php` – ergänzen:

```php
it('never uses floating point in rendering and e-invoice code, except CiiAmount', function () {
    $root = dirname(__DIR__, 2).'/app';
    $hits = [];
    foreach (['Rendering', 'EInvoice'] as $dir) {
        $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator("{$root}/{$dir}", FilesystemIterator::SKIP_DOTS));
        foreach ($files as $file) {
            $relative = substr($file->getPathname(), strlen($root) + 1);
            if ($file->getExtension() === 'php' && $relative !== 'EInvoice/CiiAmount.php') {
                array_push($hits, ...floatUsages((string) file_get_contents($file->getPathname()), $relative));
            }
        }
    }

    expect($hits)->toBe([]);
});
```

- [ ] **Step 2: Tests laufen lassen**

```bash
ddev artisan test --testsuite=Unit
```
Erwartet: PASS. Schlägt `toOnlyBeUsedIn` an, wurde ein Paket außerhalb der vorgesehenen Schicht benutzt (z. B. `Smalot`/`horstoeko` in `app/` außerhalb von `App\EInvoice`): Aufruf in die Schicht verschieben. Tests (`tests/`) zählen nicht. Meldet `NoFloatTest` einen Treffer in `app/Rendering` (z. B. ein `float`-Rückgabetyp oder `round()`), mit `BigDecimal` umschreiben.

- [ ] **Step 3: Larastan und Pint**

```bash
ddev exec vendor/bin/phpstan analyse --memory-limit=1G
ddev exec vendor/bin/pint --test
```
Erwartet: `[OK] No errors` und keine Pint-Abweichungen. Typische Meldungen und ihre Behebung:
- Array-Formen (`array<string, mixed>` an Stellen, die `array{…}` erwarten) → präzisere `@param`/`@return` ergänzen, keine `@phpstan-ignore`-Kommentare ohne Begründung.
- `config('openbill.templates')` als `mixed` → `(array)` bzw. einzelne `(int) config('openbill.templates.max_entries')` verwenden.

- [ ] **Step 4: Commit**

```bash
ddev exec vendor/bin/pint
git add tests/Unit app phpstan.neon
git commit -m "$(cat <<'EOF'
test(arch): keep rendering and e-invoice code layered, final and float-free

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: Doku `templates` und `e-invoice` (en + de), `documents` ergänzt, CLAUDE.md, Fortschritt

**Files:**
- Create: `docs/en/templates.md`, `docs/de/templates.md`, `docs/en/e-invoice.md`, `docs/de/e-invoice.md`
- Modify: `docs/en/documents.md`, `docs/de/documents.md` (Abschnitt Abschließen)
- Modify: `docs/.vitepress/config.ts`
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/plans/2026-10-11-openbill-app.md` (Fortschritt: Phase 2 abhaken)

**Interfaces:**
- Consumes: Verhalten aus Task 1–13
- Produces: Doku-Seiten `templates`, `e-invoice` (en/de), aktualisierte `documents`, CLAUDE.md, Fortschritt im Master-Plan

`docs/en/templates.md` ist zugleich die Liquid-Referenz, die Phase 8 als MCP-Resource zur Laufzeit liest: vollständig, ohne Verweise auf UI, die es noch nicht gibt.

- [ ] **Step 1: Ausgangslage prüfen**

```bash
ddev artisan test --filter=DocsTest
```
Erwartet: PASS. `DocsTest` verlangt jede Seite in `docs/en` und `docs/de` und jede englische Seite in der Sidebar: Nach Step 2–4 (neue Seiten) schlägt er fehl, bis Step 6 die Sidebar ergänzt – das ist der rote Test dieser Task.

- [ ] **Step 2: `docs/en/templates.md`**

````markdown
# Templates

openbill renders every document on the server from a template written in HTML, CSS and [Liquid](https://shopify.github.io/liquid/). Gotenberg turns the result into a PDF. The same rendering drives the preview, the PDF download and the archived PDF of a finalized document.

## Built-in templates

| Template | Look |
|---|---|
| Klar | calm, classic layout with a clear table |
| Kante | bold: a strong colour band, a large total, heavy rules |
| Leise | minimal: lots of white space, a serif typeface, hairlines |

The built-in templates speak English and German (they follow the language of the document), show group subtotals, optional items, tax rows, legal notes and page numbers. They are read-only and are updated with openbill (`php artisan app:sync-templates`, run automatically on start). To change one, export it and import the package as your own template.

## Which template a document uses

A document uses its own template if it has one, else the default template of its document type, else Klar. When a document is finalized, the template is frozen together with the other master data and the PDF is archived. Changing or deleting the template later never changes a finalized document or its PDF.

## Template package

A template is exchanged as a ZIP file:

| File | Content |
|---|---|
| `manifest.json` | name, version, paper and more (required, see below) |
| `template.liquid` | the document body (required) |
| `header.liquid` | header on every page (optional) |
| `footer.liquid` | footer on every page (optional) |
| `styles.css` | CSS for the body (optional, plain CSS without Liquid) |
| `assets/…` | images (png, jpg, gif, webp, svg) and fonts (woff, woff2, ttf, otf) |

The files may also sit in one folder inside the ZIP. Limits: 10 MB per package, 20 MB unpacked, 100 files, 2 MB per asset. Other files, paths with `..` and absolute paths are refused.

Reference assets with a relative path, in HTML and in CSS:

```html
<img src="assets/logo.svg" alt="">
```

```css
@font-face { font-family: Brand; src: url(assets/brand.woff2); }
```

openbill embeds them as data URLs while rendering, so the PDF never loads anything from the network.

## manifest.json

```json
{
  "name": "Nordlicht Letter",
  "version": "1.0.0",
  "author": "Studio Nordlicht",
  "license": "MIT",
  "description": "Letterhead with logo",
  "documentTypes": ["offer", "invoice"],
  "expectedFields": [
    { "scope": "document", "key": "project_name", "type": "text", "fallback": "" }
  ],
  "paper": { "format": "A4", "marginX": "20mm", "headerHeight": "30mm", "footerHeight": "20mm" },
  "translations": {
    "en": { "hotline": "Hotline" },
    "de": { "hotline": "Hotline" }
  }
}
```

| Key | Required | Meaning |
|---|---|---|
| `name` | yes | display name (at most 100 characters) |
| `version` | yes | version like `1.0.0` |
| `author`, `license`, `description` | no | texts |
| `documentTypes` | no | document types the template is meant for: `offer`, `confirmation`, `invoice`, `cancellation` |
| `expectedFields` | no | custom fields the template uses (`scope`, `key`, `type`, `fallback`), shown as hints when a field is missing |
| `paper` | no | `format` (`A4` or `Letter`), `marginX` (left and right), `headerHeight`, `footerHeight`; lengths in `mm`, `cm`, `in`, `pt` or `px`. Default: A4, 20mm, 30mm, 20mm |
| `translations` | no | your own words for the `t` filter, per language (`en`, `de`) |

## Page layout

Every page has three areas, exactly like Chromium prints them:

- the **header** fills the top margin (`headerHeight`) across the full page width,
- the **footer** fills the bottom margin (`footerHeight`),
- the **body** sits in between, `marginX` away from the left and right edge, and flows over as many pages as it needs.

Header and footer are separate HTML documents: `styles.css` does not apply to them, so put a `<style>` element into `header.liquid` and `footer.liquid`. Set font sizes there explicitly. Backgrounds and colours are printed.

::: v-pre

## Liquid reference

Templates use standard Liquid (`{% if %}`, `{% for %}`, `{% assign %}`, `{% capture %}`, `{% case %}`, standard filters like `upcase`, `default`, `append`, `size`) plus the context and filters below.

### Context

All amounts are strings with a dot and two decimals (`"1130.50"`), dates are `YYYY-MM-DD`. All texts are already HTML-escaped: print them as they are, `escape` is not needed.

**`org`** – your organization

| Key | Content |
|---|---|
| `name`, `street`, `zip`, `city`, `country` | address (`country` as ISO code, `DE`) |
| `logo` | logo as data URL, empty when there is none: `{% if org.logo %}<img src="{{ org.logo }}">{% endif %}` |
| `vat_id`, `tax_number` | VAT ID, tax number |
| `iban`, `bic`, `bank_name` | bank account |
| `email`, `phone`, `website` | contact |
| `taxation_mode`, `small_business` | `regular` or `small_business`; `small_business` is `true` for small businesses (§ 19 UStG) |
| `locale` | default language |

**`customer`** – empty when the document has no customer: `number`, `name`, `street`, `zip`, `city`, `country`, `email`, `vat_id`, `tax_treatment` (`domestic`, `eu_reverse_charge`, `third_country`), `locale`.

**`contact`** – the contact person, may be empty: `salutation`, `first_name`, `last_name`, `full_name`, `position`, `email`, `phone`.

**`document`**

| Key | Content |
|---|---|
| `type`, `type_label` | `offer`, `confirmation`, `invoice`, `cancellation`; the name in the document language |
| `status` | `draft`, `open`, `accepted`, `paid`, … |
| `number` | number; drafts show "Draft"/"Entwurf" |
| `date`, `due_date`, `valid_until`, `service_date`, `service_date_end` | dates (may be empty) |
| `locale` | document language (`en`, `de`) |
| `intro`, `closing` | texts before and after the items (may contain Liquid themselves, see below) |
| `net_total`, `tax_total`, `gross_total` | totals |
| `optional_total` | sum of optional items (offers), not part of the totals |
| `tax_breakdown` | list of rows with `category`, `percent` (`"19"`), `net`, `tax`, `gross` |
| `legal_notes` | list of legal notes (small business, reverse charge, third country) |
| `source_number` | number of the document this one was created from (offer → invoice, invoice → cancellation) |

**`groups`** – the item groups in order: `title`, `has_title` (`false` for items without group), `total`, `optional_total`, `positions`.

**`positions`** – all items of all groups in order (the same objects as in `groups[].positions`):

| Key | Content |
|---|---|
| `index` | running number of items and optional items; empty for text lines |
| `kind`, `is_item`, `is_text`, `is_optional` | `item`, `text`, `optional` and the matching flags |
| `title`, `description` | texts |
| `quantity` | quantity without trailing zeros (`"10"`, `"1.5"`) |
| `unit`, `unit_name`, `unit_code` | symbol (`h`), name (`Hour`), UN/ECE code (`HUR`) |
| `unit_price` | price per unit, at least two decimals (`"95.00"`, `"12.3456"`) |
| `tax_percent` | tax rate (`"19"`) |
| `total` | net amount of the line |
| `group` | title of the group (empty for items without group) |

**`page`** – only in `header.liquid` and `footer.liquid`: `{{ page.number }}` and `{{ page.total }}` (see page placeholders).

### Custom fields

Custom fields sit directly on their object, with their key: `{{ document.project_name }}`, `{{ customer.industry }}`, `{{ contact.department }}`, `{{ org.register }}`, `{{ p.ticket }}` for a position `p`. Built-in keys are reserved, so a custom field never hides one. A field without value prints nothing; use `default` for a fallback: `{{ document.po_number | default: "–" }}`.

### Filters

| Filter | Example | Result (de / en) |
|---|---|---|
| `money` | `{{ document.gross_total \| money }}` | `1.130,50 €` / `€1,130.50` |
| `money: decimals` | `{{ p.unit_price \| money: 4 }}` | `12,3456 €` / `€12.3456` |
| `number: decimals` | `{{ p.quantity \| number: 2 }}` | `1,50` / `1.50` (default 2 decimals) |
| `date` | `{{ document.date \| date }}` | `04.10.2026` / `Oct 4, 2026` |
| `date: format` | `{{ document.date \| date: "%Y-%m-%d" }}` | strftime pattern like Liquid's standard `date` |
| `nl2br` | `{{ document.intro \| nl2br }}` | line breaks become `<br>` |
| `t` | `{{ 'total' \| t }}` | `Gesamt` / `Total` |

Formats follow the document language. Amounts are rounded commercially. `money` and `number` print nothing for values that are not numbers. An unknown filter is an error.

### Words in the document language (`t`)

`{{ 'key' | t }}` looks the word up in `translations` of your manifest (document language), then in openbill's vocabulary, else prints the key. openbill's vocabulary: `amount_due`, `credit`, `customer_number`, `date`, `details`, `draft`, `due_date`, `for`, `net`, `number`, `number_short`, `of`, `offer_total`, `optional`, `optional_total`, `page`, `pos`, `price`, `project`, `quantity`, `reference`, `service`, `service_date`, `subtotal`, `sum`, `tax_number`, `total`, `unit_price`, `valid_until`, `vat`, `vat_id`, `vat_long`, `vat_on`.

### Page placeholders

In the header and the footer, `{{ page.number }}` and `{{ page.total }}` become the current page and the number of pages:

```liquid
{{ 'page' | t }} {{ page.number }} {{ 'of' | t }} {{ page.total }}
```

They only work in `header.liquid` and `footer.liquid`, written exactly like this (filters can't be applied to them).

### Intro and closing

`document.intro` and `document.closing` (usually from text blocks) are Liquid too and are rendered first, with the same context: `Please transfer the amount by {{ document.due_date | date }}.` Print them with `nl2br` to keep the line breaks.

### Comparing amounts

Amounts are strings. Compare them with `>` or `<`, which compare numbers: `{% if document.optional_total > 0 %}`. Don't use `== 0` or `!= 0` with amounts: `"0.00" != 0` is true in Liquid.

## Limits and errors

A template can never break openbill or block it:

- each part (header, body, footer, styles) may be at most 200 KB, the rendered HTML of a part at most 5 MB,
- loops and output are limited (a loop over a range like `(1..n)` may have at most 10 000 items; endless or huge loops stop with "render limit"),
- `{% render %}` and `{% include %}` are not available, `{% tablerow %}` neither,
- `styles.css` must not contain `</style>`.

Every problem is reported with the **part** (`header`, `body`, `footer`, `css`, `manifest`, `intro`, `closing`), the **file** and the **line**, for example `body · template.liquid · line 3 · Unexpected character }`. The preview shows the error in place of the broken part. Finalizing and the draft PDF refuse to run while the template has errors, so a broken template never ends up in an archived PDF.

## Sample data

For previews without a real document openbill has five sample scenarios: `short_invoice`, `long_invoice` (several pages, groups), `small_business`, `reverse_charge` and `offer_with_options`. They use your organization (or the fictional Studio Nordlicht on a fresh installation), a fictional customer, fixed dates and sample values for your custom fields. To get one as PDF on the command line:

```bash
php artisan app:render-sample klar long_invoice --locale=en
```

The PDF is written to `storage/app/private/samples/`.

## Example

```liquid
<h1>{{ document.type_label }} {{ document.number }}</h1>
<p>{{ customer.name }}<br>{{ customer.street }}<br>{{ customer.zip }} {{ customer.city }}</p>

{% if document.intro %}<p>{{ document.intro | nl2br }}</p>{% endif %}

<table>
  {% for g in groups %}
    {% if g.has_title %}<tr><th colspan="3">{{ g.title }}</th></tr>{% endif %}
    {% for p in g.positions %}
      <tr>
        <td>{{ p.index }}</td>
        <td>{{ p.title }}{% if p.is_optional %} ({{ 'optional' | t }}){% endif %}</td>
        <td>{% unless p.is_text %}{{ p.total | money }}{% endunless %}</td>
      </tr>
    {% endfor %}
  {% endfor %}
</table>

<p>{{ 'total' | t }}: {{ document.gross_total | money }}</p>
{% for note in document.legal_notes %}<p>{{ note }}</p>{% endfor %}
```

:::
````

`::: v-pre` ist nötig, weil VitePress `{{ … }}` sonst als Vue-Ausdruck auswertet (in Tabellen und Inline-Code); der Build würde scheitern oder Text verschlucken.

- [ ] **Step 3: `docs/de/templates.md`**

````markdown
# Templates

openbill rendert jedes Dokument auf dem Server aus einem Template aus HTML, CSS und [Liquid](https://shopify.github.io/liquid/). Gotenberg macht daraus ein PDF. Dasselbe Rendering steckt hinter der Vorschau, dem PDF-Download und dem archivierten PDF eines abgeschlossenen Dokuments.

## Mitgelieferte Templates

| Template | Stil |
|---|---|
| Klar | ruhig, klassisch, klare Tabelle |
| Kante | markant: kräftiger Farbblock, große Summe, starke Linien |
| Leise | minimal: viel Weißraum, Serifenschrift, Haarlinien |

Die mitgelieferten Templates können Deutsch und Englisch (sie folgen der Sprache des Dokuments) und zeigen Zwischensummen der Gruppen, optionale Positionen, Steuerzeilen, gesetzliche Hinweise und Seitenzahlen. Sie sind schreibgeschützt und werden mit openbill aktualisiert (`php artisan app:sync-templates`, läuft beim Start automatisch). Zum Anpassen exportierst du eins und importierst das Paket als eigenes Template.

## Welches Template ein Dokument nutzt

Ein Dokument nutzt sein eigenes Template, sonst das Standard-Template seines Dokumenttyps, sonst Klar. Beim Abschließen wird das Template mit den übrigen Stammdaten eingefroren und das PDF archiviert. Spätere Änderungen am Template oder sein Löschen ändern ein abgeschlossenes Dokument und sein PDF nie.

## Template-Paket

Templates werden als ZIP-Datei ausgetauscht:

| Datei | Inhalt |
|---|---|
| `manifest.json` | Name, Version, Papier und mehr (Pflicht, siehe unten) |
| `template.liquid` | Inhalt des Dokuments (Pflicht) |
| `header.liquid` | Kopfzeile auf jeder Seite (optional) |
| `footer.liquid` | Fußzeile auf jeder Seite (optional) |
| `styles.css` | CSS für den Inhalt (optional, reines CSS ohne Liquid) |
| `assets/…` | Bilder (png, jpg, gif, webp, svg) und Schriften (woff, woff2, ttf, otf) |

Die Dateien dürfen auch in einem Ordner im ZIP liegen. Grenzen: 10 MB je Paket, 20 MB entpackt, 100 Dateien, 2 MB je Asset. Andere Dateien, Pfade mit `..` und absolute Pfade werden abgelehnt.

Assets verweist du mit relativem Pfad an, in HTML und in CSS:

```html
<img src="assets/logo.svg" alt="">
```

```css
@font-face { font-family: Brand; src: url(assets/brand.woff2); }
```

openbill bettet sie beim Rendern als Data-URL ein, das PDF lädt also nie etwas aus dem Netz.

## manifest.json

```json
{
  "name": "Nordlicht Brief",
  "version": "1.0.0",
  "author": "Studio Nordlicht",
  "license": "MIT",
  "description": "Briefbogen mit Logo",
  "documentTypes": ["offer", "invoice"],
  "expectedFields": [
    { "scope": "document", "key": "project_name", "type": "text", "fallback": "" }
  ],
  "paper": { "format": "A4", "marginX": "20mm", "headerHeight": "30mm", "footerHeight": "20mm" },
  "translations": {
    "en": { "hotline": "Hotline" },
    "de": { "hotline": "Hotline" }
  }
}
```

| Schlüssel | Pflicht | Bedeutung |
|---|---|---|
| `name` | ja | Anzeigename (höchstens 100 Zeichen) |
| `version` | ja | Version wie `1.0.0` |
| `author`, `license`, `description` | nein | Texte |
| `documentTypes` | nein | Dokumenttypen, für die das Template gedacht ist: `offer`, `confirmation`, `invoice`, `cancellation` |
| `expectedFields` | nein | eigene Felder, die das Template nutzt (`scope`, `key`, `type`, `fallback`), als Hinweis, wenn ein Feld fehlt |
| `paper` | nein | `format` (`A4` oder `Letter`), `marginX` (links und rechts), `headerHeight`, `footerHeight`; Längen in `mm`, `cm`, `in`, `pt` oder `px`. Standard: A4, 20mm, 30mm, 20mm |
| `translations` | nein | eigene Wörter für den Filter `t`, je Sprache (`en`, `de`) |

## Seitenaufbau

Jede Seite hat drei Bereiche, genau so, wie Chromium sie druckt:

- die **Kopfzeile** füllt den oberen Rand (`headerHeight`) über die volle Seitenbreite,
- die **Fußzeile** füllt den unteren Rand (`footerHeight`),
- der **Inhalt** liegt dazwischen, `marginX` vom linken und rechten Rand entfernt, und läuft über so viele Seiten wie nötig.

Kopf- und Fußzeile sind eigene HTML-Dokumente: `styles.css` gilt dort nicht, setze also ein `<style>`-Element in `header.liquid` und `footer.liquid` und gib Schriftgrößen dort ausdrücklich an. Hintergründe und Farben werden gedruckt.

::: v-pre

## Liquid-Referenz

Templates nutzen normales Liquid (`{% if %}`, `{% for %}`, `{% assign %}`, `{% capture %}`, `{% case %}`, Standardfilter wie `upcase`, `default`, `append`, `size`) und dazu den Kontext und die Filter unten.

### Kontext

Alle Beträge sind Strings mit Punkt und zwei Nachkommastellen (`"1130.50"`), Datumswerte `YYYY-MM-DD`. Alle Texte sind bereits HTML-escaped: Gib sie direkt aus, `escape` brauchst du nicht.

**`org`** – deine Organisation

| Schlüssel | Inhalt |
|---|---|
| `name`, `street`, `zip`, `city`, `country` | Anschrift (`country` als ISO-Code, `DE`) |
| `logo` | Logo als Data-URL, leer ohne Logo: `{% if org.logo %}<img src="{{ org.logo }}">{% endif %}` |
| `vat_id`, `tax_number` | USt-ID, Steuernummer |
| `iban`, `bic`, `bank_name` | Bankverbindung |
| `email`, `phone`, `website` | Kontakt |
| `taxation_mode`, `small_business` | `regular` oder `small_business`; `small_business` ist bei Kleinunternehmern (§ 19 UStG) `true` |
| `locale` | Standardsprache |

**`customer`** – leer, wenn das Dokument keinen Kunden hat: `number`, `name`, `street`, `zip`, `city`, `country`, `email`, `vat_id`, `tax_treatment` (`domestic`, `eu_reverse_charge`, `third_country`), `locale`.

**`contact`** – der Ansprechpartner, kann leer sein: `salutation`, `first_name`, `last_name`, `full_name`, `position`, `email`, `phone`.

**`document`**

| Schlüssel | Inhalt |
|---|---|
| `type`, `type_label` | `offer`, `confirmation`, `invoice`, `cancellation`; der Name in der Dokumentsprache |
| `status` | `draft`, `open`, `accepted`, `paid`, … |
| `number` | Nummer; Entwürfe zeigen „Entwurf“/„Draft“ |
| `date`, `due_date`, `valid_until`, `service_date`, `service_date_end` | Datumswerte (können leer sein) |
| `locale` | Dokumentsprache (`en`, `de`) |
| `intro`, `closing` | Texte vor und nach den Positionen (dürfen selbst Liquid enthalten, siehe unten) |
| `net_total`, `tax_total`, `gross_total` | Summen |
| `optional_total` | Summe der optionalen Positionen (Angebote), nicht in den Summen enthalten |
| `tax_breakdown` | Liste der Steuerzeilen mit `category`, `percent` (`"19"`), `net`, `tax`, `gross` |
| `legal_notes` | Liste der gesetzlichen Hinweise (Kleinunternehmer, Reverse Charge, Drittland) |
| `source_number` | Nummer des Dokuments, aus dem dieses entstanden ist (Angebot → Rechnung, Rechnung → Storno) |

**`groups`** – die Positionsgruppen in Reihenfolge: `title`, `has_title` (`false` für Positionen ohne Gruppe), `total`, `optional_total`, `positions`.

**`positions`** – alle Positionen aller Gruppen in Reihenfolge (dieselben Objekte wie in `groups[].positions`):

| Schlüssel | Inhalt |
|---|---|
| `index` | laufende Nummer von Leistungen und optionalen Positionen; leer bei Textzeilen |
| `kind`, `is_item`, `is_text`, `is_optional` | `item`, `text`, `optional` und die passenden Schalter |
| `title`, `description` | Texte |
| `quantity` | Menge ohne Nullen am Ende (`"10"`, `"1.5"`) |
| `unit`, `unit_name`, `unit_code` | Kürzel (`Std.`), Name (`Stunde`), UN/ECE-Code (`HUR`) |
| `unit_price` | Einzelpreis, mindestens zwei Nachkommastellen (`"95.00"`, `"12.3456"`) |
| `tax_percent` | Steuersatz (`"19"`) |
| `total` | Nettobetrag der Zeile |
| `group` | Titel der Gruppe (leer bei Positionen ohne Gruppe) |

**`page`** – nur in `header.liquid` und `footer.liquid`: `{{ page.number }}` und `{{ page.total }}` (siehe Seitenplatzhalter).

### Eigene Felder

Eigene Felder stehen direkt an ihrem Objekt, unter ihrem Schlüssel: `{{ document.project_name }}`, `{{ customer.industry }}`, `{{ contact.department }}`, `{{ org.register }}`, `{{ p.ticket }}` für eine Position `p`. Eingebaute Schlüssel sind reserviert, ein eigenes Feld verdeckt also nie eins. Ein Feld ohne Wert gibt nichts aus; mit `default` setzt du einen Ersatz: `{{ document.po_number | default: "–" }}`.

### Filter

| Filter | Beispiel | Ergebnis (de / en) |
|---|---|---|
| `money` | `{{ document.gross_total \| money }}` | `1.130,50 €` / `€1,130.50` |
| `money: Stellen` | `{{ p.unit_price \| money: 4 }}` | `12,3456 €` / `€12.3456` |
| `number: Stellen` | `{{ p.quantity \| number: 2 }}` | `1,50` / `1.50` (Standard 2 Stellen) |
| `date` | `{{ document.date \| date }}` | `04.10.2026` / `Oct 4, 2026` |
| `date: Format` | `{{ document.date \| date: "%d.%m.%Y" }}` | strftime-Muster wie beim Standardfilter `date` |
| `nl2br` | `{{ document.intro \| nl2br }}` | Zeilenumbrüche werden zu `<br>` |
| `t` | `{{ 'total' \| t }}` | `Gesamt` / `Total` |

Formate folgen der Dokumentsprache. Beträge werden kaufmännisch gerundet. `money` und `number` geben bei Werten, die keine Zahl sind, nichts aus. Ein unbekannter Filter ist ein Fehler.

### Wörter in der Dokumentsprache (`t`)

`{{ 'key' | t }}` sucht das Wort zuerst in `translations` deines Manifests (Dokumentsprache), dann im Vokabular von openbill, sonst wird der Schlüssel ausgegeben. Vokabular von openbill: `amount_due`, `credit`, `customer_number`, `date`, `details`, `draft`, `due_date`, `for`, `net`, `number`, `number_short`, `of`, `offer_total`, `optional`, `optional_total`, `page`, `pos`, `price`, `project`, `quantity`, `reference`, `service`, `service_date`, `subtotal`, `sum`, `tax_number`, `total`, `unit_price`, `valid_until`, `vat`, `vat_id`, `vat_long`, `vat_on`.

### Seitenplatzhalter

In Kopf- und Fußzeile werden `{{ page.number }}` und `{{ page.total }}` zur aktuellen Seite und zur Seitenzahl:

```liquid
{{ 'page' | t }} {{ page.number }} {{ 'of' | t }} {{ page.total }}
```

Sie funktionieren nur in `header.liquid` und `footer.liquid` und nur genau so geschrieben (Filter lassen sich darauf nicht anwenden).

### Einleitung und Schlusstext

`document.intro` und `document.closing` (meist aus Textbausteinen) sind ebenfalls Liquid und werden zuerst gerendert, mit demselben Kontext: `Bitte überweise den Betrag bis zum {{ document.due_date | date }}.` Gib sie mit `nl2br` aus, damit die Zeilenumbrüche bleiben.

### Beträge vergleichen

Beträge sind Strings. Vergleiche sie mit `>` oder `<`, die Zahlen vergleichen: `{% if document.optional_total > 0 %}`. Nutze `== 0` oder `!= 0` nicht mit Beträgen: `"0.00" != 0` ist in Liquid wahr.

## Grenzen und Fehler

Ein Template kann openbill weder kaputt machen noch blockieren:

- jeder Teil (Kopfzeile, Inhalt, Fußzeile, Styles) darf höchstens 200 KB groß sein, das gerenderte HTML eines Teils höchstens 5 MB,
- Schleifen und Ausgabe sind begrenzt (eine Schleife über einen Bereich wie `(1..n)` darf höchstens 10 000 Einträge haben; endlose oder riesige Schleifen enden mit „Render-Grenze“),
- `{% render %}` und `{% include %}` gibt es nicht, `{% tablerow %}` auch nicht,
- `styles.css` darf kein `</style>` enthalten.

Jeder Fehler wird mit **Bereich** (`header`, `body`, `footer`, `css`, `manifest`, `intro`, `closing`), **Datei** und **Zeile** gemeldet, zum Beispiel `body · template.liquid · Zeile 3 · Unexpected character }`. Die Vorschau zeigt den Fehler anstelle des kaputten Teils. Abschließen und Entwurfs-PDF verweigern, solange das Template Fehler hat; ein kaputtes Template landet so nie in einem archivierten PDF.

## Beispieldaten

Für Vorschauen ohne echtes Dokument hat openbill fünf Szenarien: `short_invoice`, `long_invoice` (mehrseitig, Gruppen), `small_business`, `reverse_charge` und `offer_with_options`. Sie nutzen deine Organisation (auf einer frischen Installation die fiktive Firma Studio Nordlicht), einen fiktiven Kunden, feste Daten und Beispielwerte für deine eigenen Felder. Als PDF auf der Kommandozeile:

```bash
php artisan app:render-sample klar long_invoice --locale=de
```

Das PDF landet unter `storage/app/private/samples/`.

## Beispiel

```liquid
<h1>{{ document.type_label }} {{ document.number }}</h1>
<p>{{ customer.name }}<br>{{ customer.street }}<br>{{ customer.zip }} {{ customer.city }}</p>

{% if document.intro %}<p>{{ document.intro | nl2br }}</p>{% endif %}

<table>
  {% for g in groups %}
    {% if g.has_title %}<tr><th colspan="3">{{ g.title }}</th></tr>{% endif %}
    {% for p in g.positions %}
      <tr>
        <td>{{ p.index }}</td>
        <td>{{ p.title }}{% if p.is_optional %} ({{ 'optional' | t }}){% endif %}</td>
        <td>{% unless p.is_text %}{{ p.total | money }}{% endunless %}</td>
      </tr>
    {% endfor %}
  {% endfor %}
</table>

<p>{{ 'total' | t }}: {{ document.gross_total | money }}</p>
{% for note in document.legal_notes %}<p>{{ note }}</p>{% endfor %}
```

:::
````

- [ ] **Step 4: `docs/en/e-invoice.md` und `docs/de/e-invoice.md`**

`docs/en/e-invoice.md`:

````markdown
# E-invoices

openbill creates e-invoices according to **EN 16931** in the UN/CEFACT CII syntax (Factur-X / ZUGFeRD profile EN 16931). The XML is embedded in a **PDF/A-3b**, so one file serves people and accounting software.

## Turning it on

The compliance profile is set per document type: `basic` or `en16931`. The e-invoice profile can only be chosen for invoices and cancellations. With `en16931`, finalizing checks everything an e-invoice needs (see [compliance profiles](/en/documents#compliance-profiles)) and stops with a list of what is missing.

## What finalizing does

For an invoice or cancellation with the profile `en16931` openbill, in the same step that assigns the number,

1. builds the CII XML from the frozen master data and the totals,
2. checks it against the EN 16931 XML schema (an invalid XML stops finalizing),
3. renders the PDF with the document's template and has Gotenberg convert it to PDF/A-3b with the XML embedded as `factur-x.xml`,
4. archives the PDF and the XML.

If any step fails – a template error, an invalid XML, Gotenberg not reachable – nothing is saved: the document stays a draft and the number stays free.

Documents with the profile `basic` (and offers and order confirmations) get a regular PDF without XML.

## Cancellations are credit notes

A finalized cancellation becomes a credit note (type code 381) with positive amounts that refers to the cancelled invoice (number and date).

## Taxes

| Situation | Tax category | Exemption reason |
|---|---|---|
| regular rate | `S` | – |
| zero rate | `Z` | – |
| small business (§ 19 UStG) | `E` | the small business note |
| EU reverse charge | `AE` (buyer VAT ID required) | the reverse charge note |
| outside the EU | `G` | the third country note |

The legal notes are also part of the XML as document notes.

## What goes into the XML

| openbill | EN 16931 |
|---|---|
| number, date | invoice number (BT-1), issue date (BT-2) |
| organization | seller name, address, VAT ID (`VA`) or tax number (`FC`), e-mail |
| customer | buyer name, customer number, address, VAT ID |
| service date (period) | delivery date (BT-72), invoicing period (BT-73/74) |
| IBAN, BIC | SEPA credit transfer (payment means 58) |
| due date | payment due date (BT-9) |
| items | name, description, net price (4 decimals), quantity with UN/ECE unit code, tax category and rate, line amount |
| totals | sum of lines, tax basis, tax total, grand total, amount due |

Text lines are not part of the XML; optional items only exist in offers.

## Downloads

The archived PDF and the archived XML can be downloaded separately; both are always the files from the archive, never rendered again. Only finalized invoices and cancellations with the e-invoice profile have an XML.

## Archive

Archived files live in `storage/app/archive/<year>/<document id>.pdf` and `.xml`. openbill stores the SHA-256 checksum of every file and checks it on every download: a changed or missing file is reported as an error instead of being replaced. Back up this folder together with the database.

## Requirements and limits

- Gotenberg **8.34 or newer** (the Docker image `gotenberg/gotenberg:8` is). `GOTENBERG_TIMEOUT` (seconds, default 20) limits each PDF request; keep it well below the database lock wait timeout (50 s).
- openbill checks the XML against the schema. Business rules beyond the schema (EN 16931 Schematron) are covered by the compliance profile; for a full check use an external validator.
- Not supported yet: XRechnung with Leitweg-ID, currencies other than EUR, allowances and charges, negative unit prices.
````

`docs/de/e-invoice.md` – vollständige deutsche Fassung mit gleichem Aufbau:

````markdown
# E-Rechnung

openbill erzeugt E-Rechnungen nach **EN 16931** in der Syntax UN/CEFACT CII (Factur-X / ZUGFeRD, Profil EN 16931). Die XML steckt in einem **PDF/A-3b**, eine Datei reicht also für Menschen und Buchhaltungssoftware.

## Einschalten

Das Prüfprofil wird je Dokumenttyp eingestellt: `basic` oder `en16931`. Das E-Rechnungsprofil gibt es nur für Rechnungen und Stornos. Mit `en16931` prüft das Abschließen alles, was eine E-Rechnung braucht (siehe [Prüfprofile](/de/documents#prufprofile)), und bricht mit einer Liste der fehlenden Angaben ab.

## Was beim Abschließen passiert

Bei einer Rechnung oder einem Storno mit Profil `en16931` erledigt openbill im selben Schritt, der die Nummer vergibt:

1. baut die CII-XML aus den eingefrorenen Stammdaten und den Summen,
2. prüft sie gegen das XML-Schema von EN 16931 (eine ungültige XML bricht das Abschließen ab),
3. rendert das PDF mit dem Template des Dokuments und lässt Gotenberg daraus ein PDF/A-3b mit der XML als `factur-x.xml` machen,
4. archiviert PDF und XML.

Scheitert ein Schritt – Template-Fehler, ungültige XML, Gotenberg nicht erreichbar –, wird nichts gespeichert: Das Dokument bleibt Entwurf und die Nummer bleibt frei.

Dokumente mit Profil `basic` (sowie Angebote und Auftragsbestätigungen) bekommen ein normales PDF ohne XML.

## Stornos sind Gutschriften

Ein abgeschlossenes Storno wird eine Gutschrift (Typcode 381) mit positiven Beträgen, die auf die stornierte Rechnung verweist (Nummer und Datum).

## Steuern

| Fall | Steuerkategorie | Befreiungsgrund |
|---|---|---|
| normaler Satz | `S` | – |
| Nullsatz | `Z` | – |
| Kleinunternehmer (§ 19 UStG) | `E` | der Kleinunternehmer-Hinweis |
| Reverse Charge in der EU | `AE` (USt-ID des Kunden nötig) | der Reverse-Charge-Hinweis |
| außerhalb der EU | `G` | der Drittland-Hinweis |

Die gesetzlichen Hinweise stehen außerdem als Dokumentnotizen in der XML.

## Was in die XML kommt

| openbill | EN 16931 |
|---|---|
| Nummer, Datum | Rechnungsnummer (BT-1), Rechnungsdatum (BT-2) |
| Organisation | Verkäufer: Name, Anschrift, USt-ID (`VA`) oder Steuernummer (`FC`), E-Mail |
| Kunde | Käufer: Name, Kundennummer, Anschrift, USt-ID |
| Leistungsdatum (-zeitraum) | Lieferdatum (BT-72), Leistungszeitraum (BT-73/74) |
| IBAN, BIC | SEPA-Überweisung (Zahlungsart 58) |
| Fälligkeit | Fälligkeitsdatum (BT-9) |
| Positionen | Bezeichnung, Beschreibung, Nettopreis (4 Nachkommastellen), Menge mit UN/ECE-Einheitencode, Steuerkategorie und -satz, Zeilenbetrag |
| Summen | Summe der Positionen, Steuerbasis, Steuerbetrag, Gesamtbetrag, Zahlbetrag |

Textzeilen stehen nicht in der XML; optionale Positionen gibt es nur in Angeboten.

## Downloads

Das archivierte PDF und die archivierte XML lassen sich einzeln herunterladen; beides sind immer die Dateien aus dem Archiv, nie ein neues Rendering. Nur abgeschlossene Rechnungen und Stornos mit E-Rechnungsprofil haben eine XML.

## Archiv

Archivierte Dateien liegen unter `storage/app/archive/<Jahr>/<Dokument-ID>.pdf` und `.xml`. openbill speichert die SHA-256-Prüfsumme jeder Datei und prüft sie bei jedem Download: Eine veränderte oder fehlende Datei wird als Fehler gemeldet statt ersetzt. Sichere diesen Ordner zusammen mit der Datenbank.

## Voraussetzungen und Grenzen

- Gotenberg **8.34 oder neuer** (das Docker-Image `gotenberg/gotenberg:8` ist es). `GOTENBERG_TIMEOUT` (Sekunden, Standard 20) begrenzt jede PDF-Anfrage; der Wert muss deutlich unter der Lock-Wartezeit der Datenbank (50 s) bleiben.
- openbill prüft die XML gegen das Schema. Geschäftsregeln jenseits des Schemas (EN-16931-Schematron) deckt das Prüfprofil ab; für eine vollständige Prüfung nutze einen externen Validator.
- Noch nicht unterstützt: XRechnung mit Leitweg-ID, andere Währungen als EUR, Zu- und Abschläge, negative Einzelpreise.
````

Anker prüfen: VitePress macht aus `### Prüfprofile` den Anker `#prufprofile` (Umlaute werden entfernt). Nach dem Doku-Build:

```bash
ddev exec pnpm --dir docs build
grep -o 'id="pr[^"]*profile"' docs/.vitepress/dist/de/documents.html
```
Erwartet: `id="prufprofile"`. Weicht der Anker ab, den Link in `docs/de/e-invoice.md` anpassen.

- [ ] **Step 5: `documents` ergänzen**

`docs/en/documents.md`, Abschnitt „Finalizing“ – die Liste wird zu:

```markdown
1. checks the compliance profile of the document type (see below) and stops with a list of what is missing,
2. assigns the next number of the number range,
3. freezes the master data the document uses (organization, customer, contact, tax rates, units, template, custom field definitions and the legal note texts) in a snapshot,
4. stores the totals,
5. renders the PDF with the document's template and archives it; e-invoices also get the EN 16931 XML, embedded in a PDF/A-3b (see [E-invoices](/en/e-invoice)).

If any step fails – also a template error or the PDF service not answering – nothing changes: the document stays a draft and the number stays free.
```

und nach dem Absatz „After finalizing a document is **locked** …“ ergänzen:

```markdown
Downloads of a finalized document always deliver the archived PDF (and XML), checked against the SHA-256 checksum stored when it was archived. A draft can be downloaded too: its PDF is rendered on the fly, marked "Draft" on every page and not archived. See [Templates](/en/templates) for how documents are rendered.
```

`docs/de/documents.md`, Abschnitt „Abschließen“ – entsprechend:

```markdown
1. prüft openbill das Prüfprofil des Dokumenttyps (siehe unten) und bricht mit einer Liste der fehlenden Angaben ab,
2. vergibt die nächste Nummer aus dem Nummernkreis,
3. friert die Stammdaten ein, die das Dokument nutzt (Organisation, Kunde, Ansprechpartner, Steuersätze, Einheiten, Template, Felddefinitionen und die Texte der gesetzlichen Hinweise),
4. speichert die Summen,
5. rendert das PDF mit dem Template des Dokuments und archiviert es; E-Rechnungen bekommen dazu die XML nach EN 16931, eingebettet in ein PDF/A-3b (siehe [E-Rechnung](/de/e-invoice)).

Scheitert ein Schritt – auch ein Template-Fehler oder ein PDF-Dienst, der nicht antwortet –, ändert sich nichts: Das Dokument bleibt Entwurf und die Nummer bleibt frei.
```

und nach „Danach ist das Dokument **gesperrt** …“:

```markdown
Downloads eines abgeschlossenen Dokuments liefern immer das archivierte PDF (und die XML), geprüft gegen die beim Archivieren gespeicherte SHA-256-Prüfsumme. Auch ein Entwurf lässt sich herunterladen: Sein PDF wird frisch gerendert, auf jeder Seite als „Entwurf“ markiert und nicht archiviert. Wie Dokumente gerendert werden, steht unter [Templates](/de/templates).
```

- [ ] **Step 6: Sidebar**

`docs/.vitepress/config.ts`:

```ts
const pages = ['documents', 'templates', 'e-invoice', 'development'];
```

und in `en` bzw. `de` ergänzen:

```ts
    templates: 'Templates',
    'e-invoice': 'E-invoices',
```

```ts
    templates: 'Templates',
    'e-invoice': 'E-Rechnung',
```

- [ ] **Step 7: Doku bauen und prüfen**

```bash
ddev artisan test --filter=DocsTest
ddev exec pnpm --dir docs build
grep -c 'document.gross_total' docs/.vitepress/dist/en/templates.html
grep -o 'id="pr[^"]*profile"' docs/.vitepress/dist/de/documents.html
```
Erwartet: `DocsTest` grün; Build ohne Fehler (keine Vue-Fehler wegen `{{ … }}`); `grep -c` > 0 (die Liquid-Ausdrücke stehen wörtlich im HTML); der deutsche Anker heißt `id="prufprofile"` – sonst den Link in `docs/de/e-invoice.md` anpassen.

- [ ] **Step 8: CLAUDE.md aktualisieren**

In `CLAUDE.md`:

1. „Was openbill ist“ – letzter Satz: `Stand: Phase 3 (Rendering: Liquid-Templates, PDF über Gotenberg, E-Rechnung EN 16931, Archiv; noch keine API und keine UI für Dokumente).`
2. „Tech Stack“ – neue Zeile nach „Rechnen“:
   `- Rendering: keepsuit/liquid (Templates), gotenberg/gotenberg-php (PDF über Gotenberg ≥ 8.34, PDF/A-3b mit Factur-X), horstoeko/zugferd (CII-XML EN 16931 + XSD), smalot/pdfparser (nur Tests)`
3. „Kommandos“ – ergänzen:

```bash
ddev artisan app:sync-templates              # mitgelieferte Templates Klar/Kante/Leise anlegen/aktualisieren
ddev artisan app:render-sample klar long_invoice --locale=de   # PDF mit Beispieldaten → storage/app/private/samples/
ddev artisan test --testsuite=Integration --group=gotenberg     # gegen das echte Gotenberg (DDEV-Dienst)
ddev exec 'UPDATE_GOLDEN=1 php artisan test --filter=GoldenTest'   # Golden-HTML der Templates neu schreiben (Diff prüfen!)
```

4. „Architektur“ – Überschrift „(Stand Phase 3)“ und neue Absätze nach „Abschließen“:

```markdown
- **Rendering** (`app/Rendering`): `ContextBuilder::build(Document, $sources)` → Liquid-Kontext (org, customer, contact, document, groups, positions; Beträge als Strings, eigene Felder direkt am Objekt, nur reservierte Kernschlüssel) + `Totals`. Quellen: gespeicherter Entwurf (`SnapshotBuilder::build`), abgeschlossen (Snapshot), ungespeicherter Entwurf (`DraftOverlay::apply` über `DraftInput::validate`, nie speichern), Beispieldaten (`SampleDataFactory`, Szenarien `RenderScenario`). `LiquidRenderer::render(TemplateSource, $context, RenderOptions)` → `RenderResult{header, body, footer, paper, errors[]}` (drei eigenständige HTML-Dokumente wie für Gotenberg; wirft nie wegen des Templates; `RenderError{part, line, message}` mit `RenderPart::file()`). Sandbox: `Liquid/LiquidEnvironment` (strikte Filter, Fehler mit Zeile, `ResourceLimits` aus `config('openbill.rendering')`, `BoundedForTag`, kein `tablerow`/`render`), Filter in `Liquid/OpenbillFilters` (`money`, `number`, `date`, `nl2br`, `t`). Vorschau-Schnittstelle für Phase 4/6/7/9: `App\Actions\RenderPreview` → `PreviewResult::toArray()` = Antwort von `POST /api/render`.
- **PDF und Archiv:** `GotenbergClient::pdf(RenderResult, ?xml)` (gotenberg-php baut den Request, Laravel `Http` sendet ihn mit `services.gotenberg.timeout`). `PdfDocumentArchiver` (gebunden an `DocumentArchiver`) rendert beim Abschließen aus dem Snapshot über `DocumentRenderer` und speichert per `PdfArchive` auf der Disk `archive` (`storage/app/archive/{yyyy}/{id}.pdf|xml`, `document_files` mit SHA-256): erst `.tmp/`, dann in der Transaktion umbenennen, `DB::afterRollBack()` löscht. Downloads: `DocumentPdf` (abgeschlossen: Archivdatei mit SHA-256-Prüfung, sonst `ArchiveCorruptedException`; Entwurf: live mit Wasserzeichen), `DocumentXml` (nur archivierte E-Rechnungen, sonst `ActionNotAllowedException` `no_e_invoice`).
- **E-Rechnung** (`app/EInvoice`): `CiiBuilder::build(Document, $sources, Totals)` mit horstoeko (Profil EN 16931, Storno = Gutschrift 381 mit positiven Beträgen), prüft gegen das XSD (`CiiBuilder::validate()`, sonst `EInvoiceInvalidException`). Einbetten macht Gotenberg (`pdfa=PDF/A-3b` + `facturX`, Datei `factur-x.xml`). Einzige float-Stelle: `CiiAmount::of()` (Rundreise-Prüfung).
- **Templates:** Paketformat `TemplatePackage` (`manifest.json`, `template.liquid`, `header.liquid`, `footer.liquid`, `styles.css`, `assets/…`), Prüfung `ManifestValidator`, Actions `ImportTemplatePackage` (ZIP, Assets auf Disk `local` unter `templates/{id}/`), `ExportTemplatePackage`, `SyncBuiltInTemplates` (Quellen `resources/templates/{klar,kante,leise}`, Migration `2026_10_11_100400`, `DemoSeeder`, `app:sync-templates`). Welches Template: `TemplateResolver::for()` (Dokument → Dokumenttyp → `klar`); der Snapshot friert das tatsächlich benutzte ein.
- **Exceptions** zusätzlich: `TemplateRenderFailedException` 422 (`toArray()` = Fehlerliste), `EInvoiceInvalidException` 422, `PdfRenderFailedException` 503, `ArchiveCorruptedException` (kein Domain-Fehler, 500).
```

5. „Fallstricke“ – ergänzen:

```markdown
- **Escaping:** keepsuit/liquid escapt nicht von selbst. `LiquidRenderer` escapt alle Strings im Kontext genau einmal; Templates geben Werte direkt aus, `nl2br` escapt nicht. Neue Kontextwerte, die HTML sein sollen (wie `org.logo` als Data-URL), dürfen keine Sonderzeichen enthalten oder müssen nach dem Escapen eingesetzt werden.
- **Beträge in Liquid** sind Strings: `"0.00" != 0` ist in keepsuit **wahr**. In Templates nur `> 0`/`< 0` vergleichen (Test in `BuiltInTemplatesTest`).
- **Gotenberg in Tests:** Die Feature-Suite erbt von `Tests\FeatureTestCase` (Gotenberg per `Tests\Support\GotenbergFake`, `Http::preventStrayRequests()`, Disks `archive` und `local` gefaked). `GotenbergFake::failWithError()`/`timeOut()`/`answerWithHtml()` schalten das Verhalten – darüber steuern, kein weiteres `Http::fake()` registrieren (bei mehreren passenden Stubs gewinnt der zuerst registrierte). Das Fake-PDF hängt vom Request ab – so lässt sich „nicht neu gerendert“ prüfen. Echte PDFs nur in `tests/Integration` (Gruppe `gotenberg`).
- Gotenberg muss **≥ 8.34** sein (Factur-X-Felder). DDEV und CI nutzen `gotenberg/gotenberg:8`; `GotenbergTest` prüft die Version.
- `services.gotenberg.timeout` (20 s) muss deutlich unter `innodb_lock_wait_timeout` (50 s) bleiben, weil `FinalizeDocument` beim Rendern die Nummernkreis-Zeile sperrt (`ConfigTest`).
- horstoeko/zugferd hat globale statische Einstellungen (`ZugferdSettings`); `CiiBuilder` setzt die Nachkommastellen bei jedem Aufruf (Preise/Mengen 4, Beträge 2).
- Golden-Dateien (`tests/Feature/Rendering/golden/`) nur mit `UPDATE_GOLDEN=1` neu schreiben und den Diff ansehen; sie enthalten nur Beispieldaten.
- Die Migration `2026_10_11_100400` ruft `SyncBuiltInTemplates` auf (Action + Model). Ändert sich das `templates`-Schema, muss die Action mit allen bisherigen Migrationsständen laufen.
- VitePress wertet `{{ … }}` als Vue aus: Liquid-Beispiele in der Doku in `::: v-pre` setzen.
```

- [ ] **Step 9: Fortschritt im Master-Plan**

In `docs/superpowers/plans/2026-10-11-openbill-app.md`, Abschnitt „Fortschritt“: `- [ ] Phase 2: Domain & Datenmodell` → `- [x] Phase 2: Domain & Datenmodell` (Phase 2 ist gemergt). Phase 3 bleibt offen, bis der PR gemergt ist (macht der Orchestrator).

- [ ] **Step 10: Commit**

```bash
git add docs/en docs/de docs/.vitepress/config.ts CLAUDE.md docs/superpowers/plans/2026-10-11-openbill-app.md
git commit -m "$(cat <<'EOF'
docs: add templates and e-invoice pages, update documents and CLAUDE.md for phase 3

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 16: Abnahme in DDEV, Verifikation, Push und Pull Request

**Files:** keine neuen (nur Korrekturen, falls die Prüfungen etwas finden)

**Interfaces:**
- Consumes: alles
- Produces: PR gegen `main`

- [ ] **Step 1: Komplette Prüfung wie in CI**

```bash
ddev exec vendor/bin/pint --test
ddev exec vendor/bin/phpstan analyse --memory-limit=1G
ddev artisan test
ddev exec pnpm typecheck
ddev exec pnpm build
ddev exec 'pnpm --filter "./prototypes/*" test'
ddev exec pnpm --dir docs build
```
Erwartet: Pint ohne Abweichungen, `[OK] No errors`, alle Pest-Suiten grün (Unit, Feature, Integration inkl. Gruppe `gotenberg`), `tsc`/Vite/Prototypen/Doku ohne Fehler. Jeder Fehler wird behoben (eigener Commit `fix: …`), nicht übersprungen.

- [ ] **Step 2: Abnahme aus dem Master-Plan von Hand**

```bash
ddev artisan migrate
ddev artisan db:seed --class=DemoSeeder
ddev artisan tinker --execute '$d = App\Models\Document::query()->where("type", "invoice")->where("status", "draft")->firstOrFail(); $done = app(App\Actions\FinalizeDocument::class)->handle(App\Support\Actor::system(), $d); echo $done->number, PHP_EOL; foreach ($done->files as $f) { echo $f->kind->value, " ", $f->path, " ", $f->sha256, PHP_EOL; }'
```
Erwartet: eine Nummer `RE-<Jahr>-0042` und zwei Zeilen `pdf <Jahr>/<id>.pdf …` und `xml <Jahr>/<id>.xml …`. Die Dateien liegen auf dem Mac unter `storage/app/archive/<Jahr>/`. Prüfen:

```bash
ddev exec bash -c 'f=$(ls -t storage/app/archive/*/*.pdf | head -1); curl -s http://gotenberg:3000/forms/pdfengines/metadata/read -F files=@$f'
```
Erwartet: JSON mit `"Part":3`, `"Conformance":"B"`, `"DocumentFileName":"factur-x.xml"`, `"ConformanceLevel":"EN 16931"`. Das PDF öffnen (Kopf-/Fußzeile, Seitenzahlen, Summen) und die eingebettete XML im PDF-Viewer (Anhänge) ansehen.

Danach die Demo-Daten wiederherstellen (das abgeschlossene Dokument bleibt sonst in der lokalen DB, das ist harmlos):

```bash
ddev artisan db:seed --class=DemoSeeder
```

- [ ] **Step 3: Branch-Inhalt prüfen**

```bash
git status
git log --oneline main..HEAD
git diff --stat main...HEAD
git grep -n -i -f ~/.config/openbill/denylist.txt || echo "clean"   # local denylist, never copied into the repo
```
Erwartet: sauberer Arbeitsbaum, die Commits der Tasks 1–15 (+ eventuelle `fix:`-Commits), keine Treffer (`clean`). Alle Commits mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`:

```bash
git log main..HEAD --format='%an <%ae>%n%b' | grep -c 'Co-Authored-By: Claude Opus 5.5'
git log main..HEAD --format='%ae' | sort -u
```
Erwartet: Anzahl = Anzahl der Commits; einzige Author-Adresse `rafael@hauss.dev`.

- [ ] **Step 4: Push und Pull Request**

```bash
git push -u origin phase-03-rendering
gh pr create --base main --head phase-03-rendering --title "feat: phase 3 rendering, PDF and e-invoice" --body "$(cat <<'EOF'
## Summary

- Liquid rendering on the server (keepsuit/liquid): context builder for saved drafts, unsaved drafts, finalized snapshots and five deterministic sample scenarios; filters `money`, `number`, `date`, `nl2br`, `t`; page placeholders; header, body and footer as standalone HTML documents
- Sandbox and readable errors: strict filters, line numbers, render/output/size limits, bounded ranges, no partials; `RenderResult` / `RenderError {part, file, line, message}` as the interface for `POST /api/render` (phase 4), the editors (6/7) and the toolkit (9) via the `RenderPreview` action
- PDF via Gotenberg (gotenberg/gotenberg-php): paper and margins from the manifest, backgrounds, PDF/A-3b with the EN 16931 CII XML embedded as factur-x.xml (Gotenberg ≥ 8.34)
- E-invoice: `CiiBuilder` with horstoeko/zugferd (EN 16931 profile, cancellations as credit notes 381), validated against the XSD
- Finalizing archives PDF (+ XML) inside the transaction (temporary file, atomic rename, deleted on rollback); a Gotenberg error or timeout rolls everything back and keeps the number free
- Downloads: `DocumentPdf` (finalized: archived file checked by SHA-256; draft: live with watermark), `DocumentXml`
- Built-in templates Klar, Kante and Leise (en/de) synced from `resources/templates`, template package ZIP import/export with manifest validation
- Docs: `templates` (Liquid reference: context, filters, page placeholders, package format) and `e-invoice`, en + de; CLAUDE.md updated

## Decisions

- Gotenberg embeds the XML (Factur-X fields since 8.34) instead of the horstoeko PDF merger: real PDF/A-3b conversion, verified metadata (Part 3, Conformance B, factur-x.xml) and byte-identical XML extraction
- horstoeko takes floats: the only conversion lives in `CiiAmount` with a round-trip check
- KoSIT validation is not part of this phase (no matching scenario for plain EN 16931 CII); XSD validation runs in tests and before every archive write

## Tests

- Renderer: golden HTML of the built-in templates, escaping, page placeholders, errors with part and line, limits (endless loops, huge ranges, output, size, partials, `</style>`)
- Finalize: rollback on Gotenberg error and timeout (review focus 1), broken template (review focus 2), archived file unchanged after master data changes (review focus 3), tampered archive detected
- E-invoice: XSD-valid invoices, small business (E), reverse charge (AE), credit notes
- Integration (real Gotenberg, DDEV service and CI service): multi-page PDFs with header/footer on every page for all built-in templates, demo invoice finalized into PDF/A-3b with embedded XML

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
Erwartet: URL des PRs (`https://github.com/baeroe/openbill/pull/…`).

- [ ] **Step 5: CI abwarten, nicht mergen**

```bash
gh pr checks --watch
```
Erwartet: Check `tests` (und alle weiteren) grün. Schlägt CI fehl: Log mit `gh run view --log-failed` ansehen, lokal nachstellen, mit einem `fix: …`-Commit beheben, pushen, erneut `gh pr checks --watch`. Typische CI-Unterschiede: Gotenberg unter `http://127.0.0.1:3000` (Health-Schritt vor Pest), Schreibrechte auf `storage/` (Disk `archive` legt Verzeichnisse selbst an).

**Nicht mergen** – den PR-Link melden; Review und Merge macht der Orchestrator.
