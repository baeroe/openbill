# Phase 2: Domain & Datenmodell – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Datenmodell (alle Tabellen aus Spec Abschnitt 4), reine Fachlogik in `app/Domain` (brick/math, kein float), alle Geschäftsabläufe als Actions mit `document_events`, Nummernvergabe mit `lockForUpdate`, Snapshot und Sperre beim Abschließen, Demo-Seeder, Architekturtests und die Doku-Seite `documents`.

**Architecture:** `app/Domain` ist reines PHP (nur `App\Enums` und `Brick\Math`) und wird 1:1 aus `prototypes/clickdummy-v2/src/domain/*.ts` portiert, samt Tests. `app/Actions` sind die einzigen Abläufe, die schreiben (Validierung, Transaktion, Events); `app/Support` verbindet beide Welten (Models → Domain-DTOs, Snapshot, Summen, Event-Log). Models halten nur Casts, Relationen und die Sperre abgeschlossener Dokumente. `FinalizeDocument` ruft einen `DocumentArchiver` auf, der in Phase 2 nichts tut und in Phase 3 PDF/XML erzeugt.

**Tech Stack:** PHP 8.4, Laravel 13, MariaDB 11.4, brick/math 1.x (bereits als Abhängigkeit von Laravel installiert, wird direkt verlangt), Pest 5 (+ Arch-Plugin), Larastan Level 6, Pint, VitePress, DDEV.

**Spec:** `docs/superpowers/specs/2026-10-11-openbill-app-design.md` (bindend, v. a. Abschnitt 4), Fachkonzept Abschnitt 2 in `docs/superpowers/specs/2026-10-04-openbill-clickdummy-design.md`, Master-Plan `docs/superpowers/plans/2026-10-11-openbill-app.md` (Abschnitt „Phase 2“). Erprobte Logik zum Portieren: `prototypes/clickdummy-v2/src/domain/` (totals, numbering, lifecycle, fields, convert, compliance, documentView) und `prototypes/clickdummy-v2/src/api/` (documents, customers, settings, seed).

## Global Constraints

- Branch `phase-02-domain` (ist ausgecheckt). Git-Identität kommt aus `~/.gitconfig`; vor dem ersten Commit `git config user.email` → muss `rafael@hauss.dev` sein, sonst stoppen und nachfragen. Nie `user.email`/`user.name` setzen.
- Jede Commit-Message endet mit der Zeile `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; die PR-Beschreibung endet mit `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- PHP, Composer, Artisan **nur in DDEV**: `ddev composer …`, `ddev artisan …`, `ddev exec …`. Auf dem Mac gibt es kein PHP.
- JS-Pakete nur mit pnpm im Container (`ddev exec pnpm …`), nie npm/npx.
- PHP 8.4, Laravel 13, MariaDB 11.4, Node 24.
- Vor jedem Commit `ddev exec vendor/bin/pint` laufen lassen (formatiert PHP nach Laravel-Preset; CI prüft mit `--test`). Code-Blöcke in diesem Plan sind inhaltlich verbindlich, Formatierung entscheidet Pint.
- Keine Geschäftslogik in Controllern, API-Processors, MCP-Tools; nur in `app/Actions` (Abläufe) und `app/Domain` (Rechnen/Regeln).
- Beträge nie als `float`: `DECIMAL` in der DB (`DECIMAL(15,4)` für Preise/Mengen, `DECIMAL(15,2)` für Summen), `Brick\Math\BigDecimal` in PHP, Strings im JSON.
- Primärschlüssel ULID (`HasUlids`); einzige Ausnahme `document_types` (PK `type`, laut Spec).
- Abgeschlossene Dokumente (`finalized_at` gesetzt) sind unveränderlich außer `status`, `paid_at`, `cancelled_by_id`.
- UI-Texte und Meldungen nur über Schlüssel in `lang/en.json` und `lang/de.json` (gleiche Schlüssel, flach, alphabetisch sortiert, Platzhalter `:name`). Code und Kommentare Englisch.
- Doku: VitePress-Seiten in `docs/en/` **und** `docs/de/` im selben PR.
- Demo-Daten nur fiktiv (Studio Nordlicht, Hafenkontor Lindqvist, Fjord Analytics, Hotel Alpenglück, Kulturwerk Elbinsel; E-Mails `@example.com`/`.example`). Keine echten Firmen, Hosts oder Personen, auch nicht in Tests.
- CI: Pflicht-Job heißt `tests` und muss grün sein; Name nie ändern.
- `CLAUDE.md` wird in dieser Phase aktualisiert (Stand, Kommandos, Architektur, Fallstricke).

## Review Focus

- **Zwei Abschlüsse gleichzeitig / Abschluss scheitert:** Parallel laufende Abschlüsse desselben Typs bekommen nie dieselbe Nummer; scheitert der Abschluss (Prüfung rot oder Archiver wirft), bleibt das Dokument Entwurf und der Zähler unverändert. → Task 11 (`tests/Integration/NumberAllocationTest.php` mit echten Parallelprozessen und Lock-Wait, `FinalizeDocumentTest` mit werfendem Archiver).
- **Nummernkreis von Hand geändert:** Muster gewechselt, Zähler zurückgesetzt oder jährlicher Reset ohne Jahr im Muster → nie eine doppelte Nummer, kein 500er; bereits vergebene Nummern werden übersprungen, Reset ohne `{YYYY}`/`{YY}` wird mit Pfad `numbering.pattern` abgelehnt. → Task 9 (`UpdateDocumentType`) und Task 11 (Allocator überspringt belegte Nummern).
- **Stammdaten nach dem Abschluss geändert:** Organisation, Kunde, Ansprechpartner, Steuersatz, Einheit, Template oder Felddefinition ändern sich → Snapshot, gespeicherte Summen und `DocumentInspector::totals()` des abgeschlossenen Dokuments bleiben gleich. → Task 7 und Task 11 (`FinalizeDocumentTest`).
- **Ungültige Werte über Actions (spätere API/MCP-Eingänge):** falscher Typ eigener Felder, unbekannte Option, Feld gilt nicht für den Dokumenttyp, fehlendes Pflichtfeld beim Kunden, Betrag als JSON-Zahl `12.5` oder mit Komma `"12,5"`, optionale Position in einer Rechnung → `ValidationException` mit Feldpfad (`custom.po_number`, `groups.0.positions.1.custom.ticket`, …), nichts wird gespeichert. → Task 4 (Domain) und Task 8/10 (Actions).
- **Schreiben auf abgeschlossene Dokumente über Nebenwege:** direktes `save()` am Model, Position/Gruppe speichern oder löschen, `UpdateDraft` nach `FinalizeDocument` (Autosave-Rennen), `DeleteDraft` → `DocumentLockedException`; `status`/`paid_at`/`cancelled_by_id` bleiben änderbar. → Task 6 (Model-Hooks) und Task 10 (Actions).

---

## Dateistruktur nach Phase 2

```
app/
├─ Actions/                     final, eine öffentliche handle()-Methode, Container-aufgelöst
│  ├─ AllocateDocumentNumber.php     Nummer aus number_sequences (lockForUpdate), preview()
│  ├─ CreateDocument.php, UpdateDraft.php, DeleteDraft.php, DuplicateDocument.php
│  ├─ FinalizeDocument.php, SetDocumentStatus.php, ConvertDocument.php, CancelInvoice.php
│  ├─ SaveCustomer.php, DeleteCustomer.php, SaveFieldDefinition.php, DeleteFieldDefinition.php
│  ├─ UpdateOrganization.php, UpdateDocumentType.php
│  └─ SaveTaxRate.php, ArchiveTaxRate.php, SaveUnit.php, ArchiveUnit.php, SaveTextBlock.php, DeleteTextBlock.php
├─ Contracts/DocumentArchiver.php      Haken für Phase 3 (PDF/XML)
├─ Domain/                       reines PHP, kein float
│  ├─ Money/Decimal.php
│  ├─ Tax/{TaxRateData,TaxContext,EffectiveTax,LegalNotes}.php
│  ├─ Totals/{PositionInput,GroupInput,LineTotal,GroupTotal,TaxBreakdownRow,Totals,TotalsCalculator}.php
│  ├─ Numbering/NumberFormatter.php
│  ├─ Lifecycle/StatusMachine.php
│  ├─ Fields/{FieldDefinitionData,FieldRegistry,KeySlugger,FieldError,FieldErrorCode,CustomValidationResult,CustomValueValidator,FieldDefinitionValidator}.php
│  ├─ Compliance/{ComplianceRule,ComplianceIssue,PartyFacts,ComplianceInput,ComplianceChecker}.php
│  └─ Conversion/{ConversionSource,ConversionPlan,DocumentConverter}.php
├─ Enums/ DocumentType, DocumentStatus, PositionKind, FieldScope, FieldType, TaxCategory, TaxationMode,
│         TaxTreatment, ComplianceProfile, TextBlockKind, ActorType, EventAction, DocumentFileKind (+ UserRole)
├─ Exceptions/{DomainActionException,DocumentLockedException,ActionNotAllowedException,ComplianceFailedException}.php
├─ Models/ Organization, Customer, Contact, FieldDefinition, TaxRate, Unit, TextBlock, Template, TemplateAsset,
│          DocumentTypeSetting, NumberSequence, Document, PositionGroup, Position, DocumentSnapshot,
│          DocumentFile, DocumentEvent (+ User)
├─ Rules/DecimalString.php
└─ Support/{Actor,Text,EventLog,LegalNoteTexts,FieldErrors,DomainMapper,SnapshotBuilder,DocumentInspector,
            GroupWriter,ConversionResult,NullDocumentArchiver}.php
database/
├─ migrations/2026_10_11_100000_create_master_data_tables.php
├─ migrations/2026_10_11_100100_create_customer_tables.php
├─ migrations/2026_10_11_100200_create_document_tables.php
├─ migrations/2026_10_11_100300_insert_default_master_data.php
├─ factories/{Customer,Contact,Document,FieldDefinition,TextBlock,Template}Factory.php
└─ seeders/DemoSeeder.php
tests/
├─ Pest.php (Helfer, Suite Integration), phpunit.xml (Suite Integration)
├─ Unit/EnumsTest.php, Unit/NoFloatTest.php, Unit/ArchTest.php (erweitert), Unit/TranslationsTest.php (erweitert)
├─ Unit/Domain/{TotalsTest,NumberFormatterTest,StatusMachineTest,FieldsTest,CustomValueValidatorTest,ComplianceTest,ConversionTest}.php
├─ Feature/Models/{SchemaTest,DocumentLockTest}.php
├─ Feature/Support/{ActorTest,GroupWriterTest,DocumentInspectorTest}.php
├─ Feature/Actions/{CustomerActionsTest,FieldDefinitionActionsTest,SettingsActionsTest,DraftActionsTest,
│                   AllocateDocumentNumberTest,FinalizeDocumentTest,DocumentFlowTest}.php
├─ Feature/DemoSeederTest.php
└─ Integration/NumberAllocationTest.php     echte Parallelität, eigene DB-Strategie (DatabaseMigrations)
docs/{en,de}/documents.md, docs/.vitepress/config.ts, lang/{en,de}.json, CLAUDE.md
```

## Interfaces (verbindlich für Phase 3, 4 und 8)

Alle Actions sind `final`, werden über den Container geholt (`app(X::class)->handle(...)`) und nehmen als erstes Argument einen `App\Support\Actor`. Eingaben kommen als `array` (wie JSON-Bodies) und werden **in der Action** validiert: Laravel-`ValidationException` mit Punkt-Pfaden (`custom.po_number`, `groups.0.positions.1.quantity`), API (Phase 4) antwortet 422, MCP (Phase 8) reicht sie als `ValidationException` durch. Zahlen/Beträge als String (`"12.50"`) oder int, nie float.

| Action | Signatur | Wirft (außer `ValidationException`) | Events |
|---|---|---|---|
| `CreateDocument` | `handle(Actor $actor, array $input): Document` – `type` Pflicht, `customer_id`, `date`, dazu jedes Feld von `UpdateDraft` | `ActionNotAllowedException` (Storno direkt anlegen) | `created` (+ `updated`) |
| `UpdateDraft` | `handle(Actor $actor, Document $document, array $input): Document` – fehlende Schlüssel bleiben, `groups` ersetzt alle Gruppen/Positionen (eigene IDs bleiben erhalten) | `DocumentLockedException` | `updated` `{fields}` |
| `DeleteDraft` | `handle(Actor $actor, Document $document): void` | `DocumentLockedException` | `deleted` `{type}` (bleibt mit `document_id = null`) |
| `DuplicateDocument` | `handle(Actor $actor, Document $document): Document` | `ActionNotAllowedException` (Storno) | `duplicated` `{source_id}` |
| `FinalizeDocument` | `handle(Actor $actor, Document $document): Document` | `DocumentLockedException`, `ComplianceFailedException`, `ActionNotAllowedException` (Storno-Quelle), alles was der `DocumentArchiver` wirft | `finalized` `{number}`, bei Storno an der Rechnung `cancelled` |
| `SetDocumentStatus` | `handle(Actor $actor, Document $document, DocumentStatus $status): Document` | `ActionNotAllowedException` | `status_changed` `{from,to}` |
| `ConvertDocument` | `handle(Actor $actor, Document $source, DocumentType $target): ConversionResult` | `ActionNotAllowedException` | neu: `converted_from` `{source_id,source_number}`, Quelle: `converted` `{target_id,type}` |
| `CancelInvoice` | `handle(Actor $actor, Document $invoice): ConversionResult` (Storno-Entwurf; erst `FinalizeDocument` setzt die Rechnung auf `cancelled`) | `ActionNotAllowedException` | wie `ConvertDocument` |
| `SaveCustomer` | `handle(Actor $actor, array $input, ?Customer $customer = null): Customer` – `contacts` ist die ganze Liste | – | – |
| `DeleteCustomer` | `handle(Actor $actor, Customer $customer): void` (Soft Delete, löscht Entwürfe) | `ActionNotAllowedException` | `deleted` je Entwurf |
| `SaveFieldDefinition` | `handle(Actor $actor, array $input, ?FieldDefinition $definition = null): FieldDefinition` (`scope`/`key` nach Anlage unveränderlich) | – | – |
| `DeleteFieldDefinition` | `handle(Actor $actor, FieldDefinition $definition): void` | – | – |
| `UpdateOrganization` | `handle(Actor $actor, array $input): Organization` | – | – |
| `UpdateDocumentType` | `handle(Actor $actor, DocumentType $type, array $input): DocumentTypeSetting` (inkl. `numbering.{pattern,reset_yearly,next_value}`) | – | – |
| `SaveTaxRate` / `ArchiveTaxRate` | `handle(Actor $actor, array $input, ?TaxRate $rate = null): TaxRate` / `handle(Actor $actor, TaxRate $rate): TaxRate` | – | – |
| `SaveUnit` / `ArchiveUnit` | `handle(Actor $actor, array $input, ?Unit $unit = null): Unit` / `handle(Actor $actor, Unit $unit): Unit` | – | – |
| `SaveTextBlock` / `DeleteTextBlock` | `handle(Actor $actor, array $input, ?TextBlock $block = null): TextBlock` / `handle(Actor $actor, TextBlock $block): void` | – | – |
| `AllocateDocumentNumber` | `handle(DocumentType $type, string $date): string` (nur in Transaktion), `preview(DocumentType $type, string $date): string` | `LogicException` außerhalb einer Transaktion | – |

**Exceptions** (`App\Exceptions`, alle `extends DomainActionException extends RuntimeException`, Methode `status(): int` für Problem Details in Phase 4):

- `DocumentLockedException` – 409; Properties `documentId`, `number`, `fields` (list der verbotenen Spalten). Fabrik `DocumentLockedException::for(Document $document, array $fields = [])`.
- `ComplianceFailedException` – 422; Property `issues` (`list<App\Domain\Compliance\ComplianceIssue>`), `toArray(): list<array{path: string, message: string}>` (übersetzt in die aktuelle App-Sprache). Message: `compliance.failed` mit `:count`.
- `ActionNotAllowedException` – 409; Property `reason` (`status_transition`, `conversion`, `duplicate_cancellation`, `cancellation_needs_invoice`, `cancellation_source`, `customer_has_finalized_documents`).

**Support** (`App\Support`):

- `Actor` (readonly): `type: ActorType`, `id: ?string`, `userId: ?string`; `Actor::user(User $user)`, `Actor::token(string $tokenId, ?string $userId)` (Phase 4/8 mit Sanctum-Token-ID), `Actor::system()` (Konsole, Seeder).
- `DocumentInspector`: `sources(Document): array` (Snapshot-Form, bei abgeschlossenen Dokumenten der Snapshot), `totals(Document, ?array $sources = null): Totals`, `issues(Document, ?array $sources = null): list<ComplianceIssue>` (abgeschlossen ohne `$sources` → `[]`), `applyTotals(Document, Totals): void`. Phase 3 (`ContextBuilder`) und Phase 4 (`POST /api/render` → `totals`, `issues`) nutzen genau diese Methoden.
- `SnapshotBuilder::build(Document): array` und `SnapshotBuilder::fieldDefinitionRows(): list<array>`; Form von `document_snapshots.data`:
  ```
  org:      name, street, zip, city, country, logo_path, vat_id, tax_number, iban, bic, bank_name, email, phone, website, taxation_mode, locale, custom
  customer: null | id, number, name, street, zip, city, country, email, vat_id, tax_treatment, locale, custom
  contact:  null | id, salutation, first_name, last_name, position, email, phone, custom
  tax_rates: list of id, label, percent ("19.00"), category, exemption_note, archived
  units:     list of id, name, symbol, decimals, code, archived
  template:  null | id, name, slug, version, manifest, header, body, footer, css
  field_definitions: list of id, scope, key, label, type, required, default_value, help, options, doc_types
  ```
- `ConversionResult` (readonly): `document: Document`, `droppedFields: list<string>` (`document.<key>` / `position.<key>`).
- `EventLog::record(Document, Actor, EventAction, array $payload = []): DocumentEvent`.
- `GroupWriter::replace(Document, list<array{id?: ?string, title: ?string, positions: list<array>}>): void`.

**Domain** (`App\Domain`, reines PHP):

- `Totals` mit `lines` (`array<positionId, LineTotal>`), `groups` (`array<groupId, GroupTotal>`), `taxBreakdown` (`list<TaxBreakdownRow>`), `net`, `tax`, `gross`, `optionalNet` (alle `BigDecimal`, Skala 2), `legalNotes` (`list<string>`), `missingTaxRate` (`list<positionId>`); `toArray()` liefert Strings:
  `{lines: {id: {net, tax_percent, tax_category}}, groups: {id: {title, net, optional_net}}, tax_breakdown: [{category, percent, net, tax, gross}], net, tax, gross, optional_net, legal_notes, missing_tax_rate}`.
- `ComplianceIssue{path, rule: ComplianceRule, params}`; Meldungsschlüssel `compliance.<rule>`. Pfade wie im Prototyp: `document.date`, `document.customer`, `positions`, `positions.<id>.title|tax_rate|unit|quantity|custom.<key>`, `org.address|vat_id|iban|<key>`, `customer.address|vat_id|<key>`, `contact.<key>`, `document.custom.<key>`, `document.service_date`, `document.due_date`.
- `FieldError{path, code: FieldErrorCode, params}`; Meldungsschlüssel `fields.error.<code>`.

**Haken für Phase 3:** `App\Contracts\DocumentArchiver::archive(Document $document, DocumentSnapshot $snapshot): void` läuft in der Transaktion von `FinalizeDocument` nach Nummer, Status und Snapshot und vor dem Event `finalized`. Wirft er, wird alles zurückgerollt (Dokument bleibt Entwurf, Nummer bleibt frei). Phase 2 bindet `App\Support\NullDocumentArchiver` (tut nichts) in `AppServiceProvider::register()`; Phase 3 ersetzt die Bindung durch den PDF/XML-Archiver.

**Grunddaten per Migration:** Eine Zeile `organization`, vier `document_types` (alle Profil `basic`, Angebot 30 Tage gültig, Rechnung 14 Tage Zahlungsziel), vier Nummernkreis-Konfigurationen (`year = NULL`, jährlicher Reset, `Q-{YYYY}-{0000}`, `OC-{YYYY}-{0000}`, `INV-{YYYY}-{0000}`, `CN-{YYYY}-{0000}`), Steuersätze 19 %/7 %/0 % und sechs Einheiten (Hour `HUR`, Day `DAY`, Piece `H87`, Flat rate `LS`, Kilometer `KMT`, Month `MON`). Phase 10 (Docker-Entrypoint) braucht deshalb kein Seeding.

**Nummernkreise:** Die Zeile mit `year = NULL` je Typ ist die Konfiguration (`pattern`, `reset_yearly`, bei `reset_yearly = false` auch der laufende Zähler). Mit jährlichem Reset gibt es je Jahr eine Zeile `(doc_type, year)` mit `next_value`. Rückdatierte Dokumente bekommen die nächste Nummer ihres Jahres.

---
### Task 1: brick/math direkt verlangen, Enums des Fachmodells

**Files:**
- Modify: `composer.json`, `composer.lock`
- Create: `app/Enums/DocumentType.php`, `app/Enums/DocumentStatus.php`, `app/Enums/PositionKind.php`, `app/Enums/FieldScope.php`, `app/Enums/FieldType.php`, `app/Enums/TaxCategory.php`, `app/Enums/TaxationMode.php`, `app/Enums/TaxTreatment.php`, `app/Enums/ComplianceProfile.php`, `app/Enums/TextBlockKind.php`, `app/Enums/ActorType.php`, `app/Enums/EventAction.php`, `app/Enums/DocumentFileKind.php`
- Test: `tests/Unit/EnumsTest.php`

**Interfaces:**
- Consumes: –
- Produces: String-Enums in `App\Enums` mit den Werten aus Spec/Fachkonzept; Case-Namen in PascalCase (`DocumentType::Invoice`, `DocumentStatus::Paid`, `TaxCategory::AE`, `TaxTreatment::EuReverseCharge`, `ComplianceProfile::En16931`, `ActorType::System`, `EventAction::StatusChanged`, …). `brick/math` als direkte Abhängigkeit.

- [ ] **Step 1: Identität prüfen**

Run: `git -C /Users/rafael/development/baeroe/openbill config user.email`
Expected: `rafael@hauss.dev` (sonst stoppen und nachfragen)

- [ ] **Step 2: brick/math direkt verlangen**

brick/math 1.0.0 ist schon als Abhängigkeit von `laravel/framework` installiert. Prüfen und direkt verlangen:

```bash
cd /Users/rafael/development/baeroe/openbill
ddev composer show brick/math | grep -E '^versions'
ddev composer require brick/math:^1.0
```

Expected: `versions : * 1.0.0` (oder neuer 1.x), danach steht `"brick/math": "^1.0"` unter `require` in `composer.json`; `composer.lock` ändert nur den `content-hash`. API-Hinweis für alle folgenden Tasks: In brick/math 1.x ist `RoundingMode` ein Enum mit Cases in PascalCase (`RoundingMode::HalfUp`), `BigDecimal::of()` nimmt nur `BigNumber|int|string` (kein float), `strippedOfTrailingZeros()` entfernt Nullen. Prüfen mit `ddev exec grep -n "case HalfUp" vendor/brick/math/src/RoundingMode.php`.

- [ ] **Step 3: Failing test schreiben**

`tests/Unit/EnumsTest.php`:

```php
<?php

use App\Enums\ActorType;
use App\Enums\ComplianceProfile;
use App\Enums\DocumentFileKind;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\EventAction;
use App\Enums\FieldScope;
use App\Enums\FieldType;
use App\Enums\PositionKind;
use App\Enums\TaxationMode;
use App\Enums\TaxCategory;
use App\Enums\TaxTreatment;
use App\Enums\TextBlockKind;

it('uses the exact values from the spec', function (string $enum, array $values) {
    expect(array_map(fn (BackedEnum $case): string|int => $case->value, $enum::cases()))->toBe($values);
})->with([
    'document types' => [DocumentType::class, ['offer', 'confirmation', 'invoice', 'cancellation']],
    'statuses' => [DocumentStatus::class, ['draft', 'open', 'accepted', 'rejected', 'done', 'paid', 'cancelled', 'closed']],
    'position kinds' => [PositionKind::class, ['item', 'text', 'optional']],
    'field scopes' => [FieldScope::class, ['org', 'customer', 'contact', 'document', 'position']],
    'field types' => [FieldType::class, ['text', 'textarea', 'number', 'money', 'date', 'select', 'boolean', 'image']],
    'tax categories' => [TaxCategory::class, ['S', 'Z', 'E', 'AE', 'K', 'G']],
    'taxation modes' => [TaxationMode::class, ['regular', 'small_business']],
    'tax treatments' => [TaxTreatment::class, ['domestic', 'eu_reverse_charge', 'third_country']],
    'profiles' => [ComplianceProfile::class, ['basic', 'en16931']],
    'text block kinds' => [TextBlockKind::class, ['intro', 'closing', 'payment', 'note']],
    'actor types' => [ActorType::class, ['user', 'token', 'system']],
    'event actions' => [EventAction::class, ['created', 'updated', 'finalized', 'status_changed', 'converted', 'converted_from', 'cancelled', 'duplicated', 'deleted']],
    'file kinds' => [DocumentFileKind::class, ['pdf', 'xml']],
]);
```

- [ ] **Step 4: Test laufen lassen, er muss scheitern**

Run: `ddev artisan test --filter=EnumsTest`
Expected: FAIL mit `Class "App\Enums\DocumentType" not found`

- [ ] **Step 5: Enums anlegen**

`app/Enums/DocumentType.php`:

```php
<?php

namespace App\Enums;

enum DocumentType: string
{
    case Offer = 'offer';
    case Confirmation = 'confirmation';
    case Invoice = 'invoice';
    case Cancellation = 'cancellation';
}
```

`app/Enums/DocumentStatus.php`:

```php
<?php

namespace App\Enums;

/**
 * offer: draft → open → accepted | rejected; confirmation: draft → open → done;
 * invoice: draft → open → paid, cancelled is set by a cancellation; cancellation: draft → closed.
 */
enum DocumentStatus: string
{
    case Draft = 'draft';
    case Open = 'open';
    case Accepted = 'accepted';
    case Rejected = 'rejected';
    case Done = 'done';
    case Paid = 'paid';
    case Cancelled = 'cancelled';
    case Closed = 'closed';
}
```

`app/Enums/PositionKind.php`:

```php
<?php

namespace App\Enums;

enum PositionKind: string
{
    /** Billable line. */
    case Item = 'item';

    /** Text line without amount. */
    case Text = 'text';

    /** Offers only; does not count towards the total. */
    case Optional = 'optional';
}
```

`app/Enums/FieldScope.php`:

```php
<?php

namespace App\Enums;

enum FieldScope: string
{
    case Org = 'org';
    case Customer = 'customer';
    case Contact = 'contact';
    case Document = 'document';
    case Position = 'position';
}
```

`app/Enums/FieldType.php`:

```php
<?php

namespace App\Enums;

enum FieldType: string
{
    case Text = 'text';
    case Textarea = 'textarea';
    case Number = 'number';
    case Money = 'money';
    case Date = 'date';
    case Select = 'select';
    case Boolean = 'boolean';
    case Image = 'image';
}
```

`app/Enums/TaxCategory.php`:

```php
<?php

namespace App\Enums;

/** EN 16931 VAT category codes (UNTDID 5305). */
enum TaxCategory: string
{
    case S = 'S';
    case Z = 'Z';
    case E = 'E';
    case AE = 'AE';
    case K = 'K';
    case G = 'G';
}
```

`app/Enums/TaxationMode.php`:

```php
<?php

namespace App\Enums;

enum TaxationMode: string
{
    case Regular = 'regular';

    /** § 19 UStG: no VAT, category E, legal note on every document. */
    case SmallBusiness = 'small_business';
}
```

`app/Enums/TaxTreatment.php`:

```php
<?php

namespace App\Enums;

enum TaxTreatment: string
{
    case Domestic = 'domestic';
    case EuReverseCharge = 'eu_reverse_charge';
    case ThirdCountry = 'third_country';
}
```

`app/Enums/ComplianceProfile.php`:

```php
<?php

namespace App\Enums;

enum ComplianceProfile: string
{
    case Basic = 'basic';

    /** E-invoice (ZUGFeRD/XRechnung); invoices and cancellations only. */
    case En16931 = 'en16931';
}
```

`app/Enums/TextBlockKind.php`:

```php
<?php

namespace App\Enums;

enum TextBlockKind: string
{
    case Intro = 'intro';
    case Closing = 'closing';
    case Payment = 'payment';
    case Note = 'note';
}
```

`app/Enums/ActorType.php`:

```php
<?php

namespace App\Enums;

/** Who triggered an action: a signed-in user, an API/MCP token, or the system (console, seeders). */
enum ActorType: string
{
    case User = 'user';
    case Token = 'token';
    case System = 'system';
}
```

`app/Enums/EventAction.php`:

```php
<?php

namespace App\Enums;

/** Entries in document_events. */
enum EventAction: string
{
    case Created = 'created';
    case Updated = 'updated';
    case Finalized = 'finalized';
    case StatusChanged = 'status_changed';

    /** On the source: a new document was created from it. */
    case Converted = 'converted';

    /** On the new document: where it came from. */
    case ConvertedFrom = 'converted_from';

    /** On an invoice: its cancellation was finalized. */
    case Cancelled = 'cancelled';

    case Duplicated = 'duplicated';
    case Deleted = 'deleted';
}
```

`app/Enums/DocumentFileKind.php`:

```php
<?php

namespace App\Enums;

enum DocumentFileKind: string
{
    case Pdf = 'pdf';
    case Xml = 'xml';
}
```

- [ ] **Step 6: Test laufen lassen**

Run: `ddev artisan test --filter=EnumsTest`
Expected: PASS (13 Fälle). Danach `ddev artisan test --filter=ArchTest` → PASS (`enums are backed enums` gilt auch für die neuen Enums).

- [ ] **Step 7: Commit**

```bash
git add composer.json composer.lock app/Enums tests/Unit/EnumsTest.php
git commit -m "feat(domain): add domain enums and require brick/math

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 2: Domain – Decimal, Steuern, Summen

Port von `prototypes/clickdummy-v2/src/domain/totals.ts` und `money.ts` samt `totals.test.ts`. `round2` im Prototyp rundet kaufmännisch weg von null; das ist `RoundingMode::HalfUp` in brick/math. Gesetzliche Hinweise kommen als Texte über `LegalNotes` herein (übersetzt außerhalb der Domain), damit die Domain sprachneutral bleibt.

**Files:**
- Create: `app/Domain/Money/Decimal.php`, `app/Domain/Tax/TaxRateData.php`, `app/Domain/Tax/LegalNotes.php`, `app/Domain/Tax/TaxContext.php`, `app/Domain/Tax/EffectiveTax.php`, `app/Domain/Totals/PositionInput.php`, `app/Domain/Totals/GroupInput.php`, `app/Domain/Totals/LineTotal.php`, `app/Domain/Totals/GroupTotal.php`, `app/Domain/Totals/TaxBreakdownRow.php`, `app/Domain/Totals/Totals.php`, `app/Domain/Totals/TotalsCalculator.php`
- Test: `tests/Unit/Domain/TotalsTest.php`

**Interfaces:**
- Consumes: `App\Enums\{PositionKind, TaxCategory, TaxationMode, TaxTreatment}` (Task 1).
- Produces:
  - `Decimal::of(BigNumber|int|string): BigDecimal`, `Decimal::zero(): BigDecimal`, `Decimal::round2(BigDecimal): BigDecimal`, `Decimal::isValid(mixed $value, int $scale = 4): bool`.
  - `new TaxRateData(string $id, BigDecimal $percent, TaxCategory $category, ?string $exemptionNote = null)`
  - `new LegalNotes(string $smallBusiness, string $reverseCharge, string $thirdCountry)`
  - `new TaxContext(list<TaxRateData> $taxRates, TaxationMode $taxationMode, TaxTreatment $taxTreatment, LegalNotes $notes)`, `->rate(?string $id): ?TaxRateData`
  - `EffectiveTax::resolve(?string $taxRateId, TaxContext $ctx): ?EffectiveTax` (`percent`, `category`, `note`)
  - `new PositionInput(string $id, PositionKind $kind, string $title, BigDecimal $quantity, BigDecimal $unitPrice, ?string $unitId, ?string $taxRateId, array $custom = [], string $description = '')`
  - `new GroupInput(string $id, ?string $title, list<PositionInput> $positions)`
  - `TotalsCalculator::calculate(list<GroupInput> $groups, TaxContext $ctx): Totals`, `Totals::toArray()` (Form siehe „Interfaces“ oben).

- [ ] **Step 1: Failing test schreiben**

`tests/Unit/Domain/TotalsTest.php`:

```php
<?php

use App\Domain\Money\Decimal;
use App\Domain\Tax\EffectiveTax;
use App\Domain\Tax\LegalNotes;
use App\Domain\Tax\TaxContext;
use App\Domain\Tax\TaxRateData;
use App\Domain\Totals\GroupInput;
use App\Domain\Totals\PositionInput;
use App\Domain\Totals\TotalsCalculator;
use App\Enums\PositionKind;
use App\Enums\TaxationMode;
use App\Enums\TaxCategory;
use App\Enums\TaxTreatment;

function totalsCtx(TaxationMode $mode = TaxationMode::Regular, TaxTreatment $treatment = TaxTreatment::Domestic): TaxContext
{
    return new TaxContext(
        [new TaxRateData('r19', Decimal::of('19'), TaxCategory::S), new TaxRateData('r7', Decimal::of('7'), TaxCategory::S)],
        $mode,
        $treatment,
        new LegalNotes('small business note', 'reverse charge note', 'third country note'),
    );
}

function totalsPos(string $id, string $quantity = '1', string $price = '0', PositionKind $kind = PositionKind::Item, ?string $taxRateId = 'r19'): PositionInput
{
    return new PositionInput($id, $kind, 'X', Decimal::of($quantity), Decimal::of($price), 'u', $taxRateId);
}

/** @return list<GroupInput> */
function totalsLoose(PositionInput ...$positions): array
{
    return [new GroupInput('g0', null, array_values($positions))];
}

describe('EffectiveTax', function () {
    it('uses the rate for regular domestic customers', function () {
        $tax = EffectiveTax::resolve('r7', totalsCtx());

        expect((string) $tax?->percent)->toBe('7')
            ->and($tax?->category)->toBe(TaxCategory::S)
            ->and($tax?->note)->toBeNull();
    });

    it('forces E with the § 19 note for small businesses', function () {
        $tax = EffectiveTax::resolve('r19', totalsCtx(TaxationMode::SmallBusiness));

        expect($tax?->percent->isZero())->toBeTrue()
            ->and($tax?->category)->toBe(TaxCategory::E)
            ->and($tax?->note)->toBe('small business note');
    });

    it('forces AE for EU reverse charge and G for third countries', function () {
        expect(EffectiveTax::resolve('r19', totalsCtx(treatment: TaxTreatment::EuReverseCharge))?->category)->toBe(TaxCategory::AE)
            ->and(EffectiveTax::resolve('r19', totalsCtx(treatment: TaxTreatment::ThirdCountry))?->category)->toBe(TaxCategory::G);
    });

    it('returns null for an unknown or missing rate', function () {
        expect(EffectiveTax::resolve('gone', totalsCtx()))->toBeNull()
            ->and(EffectiveTax::resolve(null, totalsCtx()))->toBeNull();
    });
});

describe('TotalsCalculator', function () {
    it('sums lines and computes tax per rate group', function () {
        $t = TotalsCalculator::calculate(totalsLoose(
            totalsPos('a', '10', '95'),
            totalsPos('b', '1', '49.9', taxRateId: 'r7'),
        ), totalsCtx());

        expect((string) $t->lines['a']->net)->toBe('950.00')
            ->and($t->toArray()['tax_breakdown'])->toBe([
                ['category' => 'S', 'percent' => '19', 'net' => '950.00', 'tax' => '180.50', 'gross' => '1130.50'],
                ['category' => 'S', 'percent' => '7', 'net' => '49.90', 'tax' => '3.49', 'gross' => '53.39'],
            ])
            ->and((string) $t->net)->toBe('999.90')
            ->and((string) $t->tax)->toBe('183.99')
            ->and((string) $t->gross)->toBe('1183.89');
    });

    it('computes a subtotal per group and ignores text lines', function () {
        $t = TotalsCalculator::calculate([
            new GroupInput('g1', 'Konzept', [totalsPos('a', '2', '100'), totalsPos('t', '0', '0', PositionKind::Text)]),
            new GroupInput('g2', 'Umsetzung', [totalsPos('b', '1', '50'), totalsPos('o', '1', '30', PositionKind::Optional)]),
        ], totalsCtx());

        expect($t->toArray()['groups'])->toBe([
            'g1' => ['title' => 'Konzept', 'net' => '200.00', 'optional_net' => '0.00'],
            'g2' => ['title' => 'Umsetzung', 'net' => '50.00', 'optional_net' => '30.00'],
        ])
            ->and($t->lines)->not->toHaveKey('t')
            ->and((string) $t->net)->toBe('250.00');
    });

    it('excludes optional positions from the total', function () {
        $t = TotalsCalculator::calculate(totalsLoose(totalsPos('a', '1', '100'), totalsPos('o', '1', '300', PositionKind::Optional)), totalsCtx());

        expect((string) $t->net)->toBe('100.00')
            ->and((string) $t->optionalNet)->toBe('300.00');
    });

    it('collects legal notes once', function () {
        $t = TotalsCalculator::calculate(totalsLoose(totalsPos('a', '1', '10'), totalsPos('b', '1', '20')), totalsCtx(TaxationMode::SmallBusiness));

        expect((string) $t->tax)->toBe('0.00')
            ->and($t->legalNotes)->toBe(['small business note']);
    });

    it('handles negative quantities (cancellations)', function () {
        $t = TotalsCalculator::calculate(totalsLoose(totalsPos('a', '-10', '95')), totalsCtx());

        expect((string) $t->gross)->toBe('-1130.50');
    });

    it('treats a missing tax rate as 0 % and reports it', function () {
        $t = TotalsCalculator::calculate(totalsLoose(totalsPos('a', '1', '100', taxRateId: 'gone')), totalsCtx());

        expect((string) $t->tax)->toBe('0.00')
            ->and($t->missingTaxRate)->toBe(['a']);
    });

    it('rounds half away from zero without floating point drift', function () {
        $t = TotalsCalculator::calculate(totalsLoose(
            totalsPos('a', '3', '0.1'),
            totalsPos('b', '1', '0.005'),
            totalsPos('c', '-1', '0.005'),
        ), totalsCtx());

        expect((string) $t->lines['a']->net)->toBe('0.30')
            ->and((string) $t->lines['b']->net)->toBe('0.01')
            ->and((string) $t->lines['c']->net)->toBe('-0.01');
    });
});

describe('Decimal', function () {
    it('accepts integer and dot-decimal strings only', function (mixed $value, int $scale, bool $valid) {
        expect(Decimal::isValid($value, $scale))->toBe($valid);
    })->with([
        ['12', 4, true],
        [12, 4, true],
        ['-3.5', 4, true],
        ['0.0001', 4, true],
        ['0.00001', 4, false],
        ['12.345', 2, false],
        ['12,5', 4, false],
        [12.5, 4, false],
        ['1e3', 4, false],
        ['', 4, false],
        [null, 4, false],
        ['123456789012', 4, false],
    ]);
});
```

- [ ] **Step 2: Test laufen lassen, er muss scheitern**

Run: `ddev artisan test --filter=TotalsTest`
Expected: FAIL mit `Class "App\Domain\Money\Decimal" not found`

- [ ] **Step 3: Decimal und Steuer-Klassen**

`app/Domain/Money/Decimal.php`:

```php
<?php

namespace App\Domain\Money;

use Brick\Math\BigDecimal;
use Brick\Math\BigNumber;
use Brick\Math\RoundingMode;

/** Amounts are never floats: strings or ints in, BigDecimal inside, strings out. */
final class Decimal
{
    public static function of(BigNumber|int|string $value): BigDecimal
    {
        return BigDecimal::of($value);
    }

    public static function zero(): BigDecimal
    {
        return BigDecimal::zero();
    }

    /** Commercial rounding to cents, half away from zero (the prototype's round2). */
    public static function round2(BigDecimal $value): BigDecimal
    {
        return $value->toScale(2, RoundingMode::HalfUp);
    }

    /**
     * True for ints and strings like "12", "-3.5", "0.0001": dot as separator, at most 11 integer digits
     * (DECIMAL(15,4)) and at most $scale decimals. Floats and "12,5" are rejected on purpose.
     */
    public static function isValid(mixed $value, int $scale = 4): bool
    {
        if (is_int($value)) {
            return true;
        }

        return is_string($value) && preg_match('/^-?\d{1,11}(\.\d{1,'.$scale.'})?$/', $value) === 1;
    }
}
```

`app/Domain/Tax/TaxRateData.php`:

```php
<?php

namespace App\Domain\Tax;

use App\Enums\TaxCategory;
use Brick\Math\BigDecimal;

final readonly class TaxRateData
{
    public function __construct(
        public string $id,
        public BigDecimal $percent,
        public TaxCategory $category,
        public ?string $exemptionNote = null,
    ) {}
}
```

`app/Domain/Tax/LegalNotes.php`:

```php
<?php

namespace App\Domain\Tax;

/** Legal note texts in the document's language; translated outside the domain. */
final readonly class LegalNotes
{
    public function __construct(
        public string $smallBusiness,
        public string $reverseCharge,
        public string $thirdCountry,
    ) {}
}
```

`app/Domain/Tax/TaxContext.php`:

```php
<?php

namespace App\Domain\Tax;

use App\Enums\TaxationMode;
use App\Enums\TaxTreatment;

final readonly class TaxContext
{
    /**
     * @param  list<TaxRateData>  $taxRates
     */
    public function __construct(
        public array $taxRates,
        public TaxationMode $taxationMode,
        public TaxTreatment $taxTreatment,
        public LegalNotes $notes,
    ) {}

    public function rate(?string $id): ?TaxRateData
    {
        foreach ($this->taxRates as $rate) {
            if ($rate->id === $id) {
                return $rate;
            }
        }

        return null;
    }
}
```

`app/Domain/Tax/EffectiveTax.php`:

```php
<?php

namespace App\Domain\Tax;

use App\Domain\Money\Decimal;
use App\Enums\TaxationMode;
use App\Enums\TaxCategory;
use App\Enums\TaxTreatment;
use Brick\Math\BigDecimal;

/** The tax that really applies to a position: small business and customer treatment override the rate. */
final readonly class EffectiveTax
{
    public function __construct(
        public BigDecimal $percent,
        public TaxCategory $category,
        public ?string $note,
    ) {}

    public static function resolve(?string $taxRateId, TaxContext $ctx): ?self
    {
        if ($ctx->taxationMode === TaxationMode::SmallBusiness) {
            return new self(Decimal::zero(), TaxCategory::E, $ctx->notes->smallBusiness);
        }
        if ($ctx->taxTreatment === TaxTreatment::EuReverseCharge) {
            return new self(Decimal::zero(), TaxCategory::AE, $ctx->notes->reverseCharge);
        }
        if ($ctx->taxTreatment === TaxTreatment::ThirdCountry) {
            return new self(Decimal::zero(), TaxCategory::G, $ctx->notes->thirdCountry);
        }

        $rate = $ctx->rate($taxRateId);

        return $rate === null ? null : new self($rate->percent, $rate->category, $rate->exemptionNote);
    }
}
```

- [ ] **Step 4: Summen-Klassen**

`app/Domain/Totals/PositionInput.php`:

```php
<?php

namespace App\Domain\Totals;

use App\Enums\PositionKind;
use Brick\Math\BigDecimal;

/** A position as the domain sees it (totals, compliance, conversion). */
final readonly class PositionInput
{
    /**
     * @param  array<string, mixed>  $custom
     */
    public function __construct(
        public string $id,
        public PositionKind $kind,
        public string $title,
        public BigDecimal $quantity,
        public BigDecimal $unitPrice,
        public ?string $unitId,
        public ?string $taxRateId,
        public array $custom = [],
        public string $description = '',
    ) {}
}
```

`app/Domain/Totals/GroupInput.php`:

```php
<?php

namespace App\Domain\Totals;

/** A position group; title null = loose positions without heading and subtotal. */
final readonly class GroupInput
{
    /**
     * @param  list<PositionInput>  $positions
     */
    public function __construct(
        public string $id,
        public ?string $title,
        public array $positions,
    ) {}
}
```

`app/Domain/Totals/LineTotal.php`:

```php
<?php

namespace App\Domain\Totals;

use App\Domain\Tax\EffectiveTax;
use Brick\Math\BigDecimal;

final readonly class LineTotal
{
    public function __construct(
        public string $positionId,
        public BigDecimal $net,
        public ?EffectiveTax $tax,
    ) {}
}
```

`app/Domain/Totals/GroupTotal.php`:

```php
<?php

namespace App\Domain\Totals;

use Brick\Math\BigDecimal;

final readonly class GroupTotal
{
    public function __construct(
        public string $groupId,
        public ?string $title,
        public BigDecimal $net,
        public BigDecimal $optionalNet,
    ) {}
}
```

`app/Domain/Totals/TaxBreakdownRow.php`:

```php
<?php

namespace App\Domain\Totals;

use App\Enums\TaxCategory;
use Brick\Math\BigDecimal;

final readonly class TaxBreakdownRow
{
    public function __construct(
        public TaxCategory $category,
        public BigDecimal $percent,
        public BigDecimal $net,
        public BigDecimal $tax,
        public BigDecimal $gross,
    ) {}
}
```

`app/Domain/Totals/Totals.php`:

```php
<?php

namespace App\Domain\Totals;

use Brick\Math\BigDecimal;

final readonly class Totals
{
    /**
     * @param  array<string, LineTotal>  $lines  by position id (text lines have none)
     * @param  array<string, GroupTotal>  $groups  by group id
     * @param  list<TaxBreakdownRow>  $taxBreakdown  highest rate first
     * @param  list<string>  $legalNotes
     * @param  list<string>  $missingTaxRate  position ids
     */
    public function __construct(
        public array $lines,
        public array $groups,
        public array $taxBreakdown,
        public BigDecimal $net,
        public BigDecimal $tax,
        public BigDecimal $gross,
        public BigDecimal $optionalNet,
        public array $legalNotes,
        public array $missingTaxRate,
    ) {}

    /**
     * JSON shape for render/autosave responses: every amount as a string.
     *
     * @return array{lines: array<string, array{net: string, tax_percent: string|null, tax_category: string|null}>, groups: array<string, array{title: string|null, net: string, optional_net: string}>, tax_breakdown: list<array{category: string, percent: string, net: string, tax: string, gross: string}>, net: string, tax: string, gross: string, optional_net: string, legal_notes: list<string>, missing_tax_rate: list<string>}
     */
    public function toArray(): array
    {
        return [
            'lines' => array_map(fn (LineTotal $l): array => [
                'net' => (string) $l->net,
                'tax_percent' => $l->tax === null ? null : (string) $l->tax->percent->strippedOfTrailingZeros(),
                'tax_category' => $l->tax?->category->value,
            ], $this->lines),
            'groups' => array_map(fn (GroupTotal $g): array => [
                'title' => $g->title,
                'net' => (string) $g->net,
                'optional_net' => (string) $g->optionalNet,
            ], $this->groups),
            'tax_breakdown' => array_map(fn (TaxBreakdownRow $r): array => [
                'category' => $r->category->value,
                'percent' => (string) $r->percent->strippedOfTrailingZeros(),
                'net' => (string) $r->net,
                'tax' => (string) $r->tax,
                'gross' => (string) $r->gross,
            ], $this->taxBreakdown),
            'net' => (string) $this->net,
            'tax' => (string) $this->tax,
            'gross' => (string) $this->gross,
            'optional_net' => (string) $this->optionalNet,
            'legal_notes' => $this->legalNotes,
            'missing_tax_rate' => $this->missingTaxRate,
        ];
    }
}
```

`app/Domain/Totals/TotalsCalculator.php`:

```php
<?php

namespace App\Domain\Totals;

use App\Domain\Money\Decimal;
use App\Domain\Tax\EffectiveTax;
use App\Domain\Tax\TaxContext;
use App\Enums\PositionKind;
use App\Enums\TaxCategory;
use Brick\Math\RoundingMode;

/** Port of calcTotals() from prototypes/clickdummy-v2/src/domain/totals.ts. */
final class TotalsCalculator
{
    /**
     * @param  list<GroupInput>  $groups
     */
    public static function calculate(array $groups, TaxContext $ctx): Totals
    {
        $lines = [];
        $groupTotals = [];
        $buckets = [];
        $notes = [];
        $missing = [];
        $optionalNet = Decimal::zero();

        foreach ($groups as $group) {
            $groupNet = Decimal::zero();
            $groupOptional = Decimal::zero();

            foreach ($group->positions as $p) {
                if ($p->kind === PositionKind::Text) {
                    continue;
                }

                $net = Decimal::round2($p->quantity->multipliedBy($p->unitPrice));
                $tax = EffectiveTax::resolve($p->taxRateId, $ctx);
                $lines[$p->id] = new LineTotal($p->id, $net, $tax);

                if ($p->kind === PositionKind::Optional) {
                    $optionalNet = $optionalNet->plus($net);
                    $groupOptional = $groupOptional->plus($net);

                    continue;
                }

                if ($tax === null) {
                    $missing[] = $p->id;
                }
                $groupNet = $groupNet->plus($net);

                $effective = $tax ?? new EffectiveTax(Decimal::zero(), TaxCategory::S, null);
                $key = $effective->category->value.':'.$effective->percent->strippedOfTrailingZeros();
                $buckets[$key] ??= ['category' => $effective->category, 'percent' => $effective->percent, 'net' => Decimal::zero()];
                $buckets[$key]['net'] = $buckets[$key]['net']->plus($net);

                if ($effective->note !== null && $effective->note !== '' && ! in_array($effective->note, $notes, true)) {
                    $notes[] = $effective->note;
                }
            }

            $groupTotals[$group->id] = new GroupTotal($group->id, $group->title, Decimal::round2($groupNet), Decimal::round2($groupOptional));
        }

        $rows = [];
        foreach ($buckets as $bucket) {
            $net = Decimal::round2($bucket['net']);
            $tax = $net->multipliedBy($bucket['percent'])->dividedBy(100, 2, RoundingMode::HalfUp);
            $rows[] = new TaxBreakdownRow($bucket['category'], $bucket['percent'], $net, $tax, $net->plus($tax));
        }
        usort($rows, fn (TaxBreakdownRow $a, TaxBreakdownRow $b): int => $b->percent->compareTo($a->percent));

        $net = Decimal::zero()->toScale(2);
        $tax = Decimal::zero()->toScale(2);
        foreach ($rows as $row) {
            $net = $net->plus($row->net);
            $tax = $tax->plus($row->tax);
        }

        return new Totals($lines, $groupTotals, $rows, $net, $tax, $net->plus($tax), Decimal::round2($optionalNet), $notes, $missing);
    }
}
```

- [ ] **Step 5: Test laufen lassen**

Run: `ddev artisan test --filter=TotalsTest`
Expected: PASS (alle `EffectiveTax`-, `TotalsCalculator`- und `Decimal`-Fälle). Falls `strippedOfTrailingZeros` oder `RoundingMode::HalfUp` anders heißen: `ddev exec grep -n "public function stripped\|case Half" vendor/brick/math/src/*.php` und Namen anpassen.

- [ ] **Step 6: Statische Analyse**

Run: `ddev exec vendor/bin/phpstan analyse --memory-limit=1G`
Expected: `[OK] No errors`

- [ ] **Step 7: Commit**

```bash
git add app/Domain/Money app/Domain/Tax app/Domain/Totals tests/Unit/Domain/TotalsTest.php
git commit -m "feat(domain): port tax and totals calculation to brick/math

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 3: Domain – Nummernformat und Statusmodell

Port von `formatDocumentNumber` (`numbering.ts`) und `lifecycle.ts`. Die Zählerlogik aus `allocateNumber` (getrennte Zähler je Jahr, Rückdatieren) lebt in der Datenbank und wird in Task 11 mit `AllocateDocumentNumber` portiert und getestet.

**Files:**
- Create: `app/Domain/Numbering/NumberFormatter.php`, `app/Domain/Lifecycle/StatusMachine.php`
- Test: `tests/Unit/Domain/NumberFormatterTest.php`, `tests/Unit/Domain/StatusMachineTest.php`

**Interfaces:**
- Consumes: `DocumentType`, `DocumentStatus` (Task 1).
- Produces:
  - `NumberFormatter::format(string $pattern, DateTimeInterface $date, int $sequence): string`, `NumberFormatter::isValidPattern(string $pattern): bool` (enthält `{0…}`), `NumberFormatter::hasYear(string $pattern): bool`.
  - `StatusMachine::nextStatuses(DocumentType, DocumentStatus): list<DocumentStatus>`, `::canTransition(DocumentType, DocumentStatus $from, DocumentStatus $to): bool`, `::canSetManually(DocumentType, DocumentStatus $from, DocumentStatus $to): bool` (nie aus `draft`), `::finalizedStatus(DocumentType): DocumentStatus` (`closed` für Storno, sonst `open`), `::isLocked(DocumentStatus): bool`, `::isOverdue(DocumentType, DocumentStatus, ?string $dueDate, string $today): bool`.

- [ ] **Step 1: Failing tests schreiben**

`tests/Unit/Domain/NumberFormatterTest.php`:

```php
<?php

use App\Domain\Numbering\NumberFormatter;

it('fills year, month and the padded sequence', function (string $pattern, string $date, int $sequence, string $expected) {
    expect(NumberFormatter::format($pattern, new DateTimeImmutable($date), $sequence))->toBe($expected);
})->with([
    ['RE-{YYYY}-{0000}', '2026-10-04', 5, 'RE-2026-0005'],
    ['{YY}/{MM}-{000}', '2026-03-01', 42, '26/03-042'],
    ['AN-{0000}', '2025-12-31', 7, 'AN-0007'],
    ['X-{00}', '2026-01-01', 123, 'X-123'],
    ['{YYYY}{MM}{0}', '2026-07-15', 9, '2026079'],
]);

it('knows valid patterns and patterns with a year', function () {
    expect(NumberFormatter::isValidPattern('RE-{0000}'))->toBeTrue()
        ->and(NumberFormatter::isValidPattern('RE-{YYYY}'))->toBeFalse()
        ->and(NumberFormatter::hasYear('RE-{YYYY}-{0000}'))->toBeTrue()
        ->and(NumberFormatter::hasYear('{YY}-{000}'))->toBeTrue()
        ->and(NumberFormatter::hasYear('RE-{MM}-{0000}'))->toBeFalse();
});
```

`tests/Unit/Domain/StatusMachineTest.php`:

```php
<?php

use App\Domain\Lifecycle\StatusMachine;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;

it('allows the transitions of the concept per document type', function (DocumentType $type, DocumentStatus $from, array $to) {
    expect(StatusMachine::nextStatuses($type, $from))->toBe($to);
})->with([
    [DocumentType::Offer, DocumentStatus::Draft, [DocumentStatus::Open]],
    [DocumentType::Offer, DocumentStatus::Open, [DocumentStatus::Accepted, DocumentStatus::Rejected]],
    [DocumentType::Offer, DocumentStatus::Accepted, []],
    [DocumentType::Confirmation, DocumentStatus::Open, [DocumentStatus::Done]],
    [DocumentType::Invoice, DocumentStatus::Open, [DocumentStatus::Paid]],
    [DocumentType::Invoice, DocumentStatus::Paid, []],
    [DocumentType::Cancellation, DocumentStatus::Draft, [DocumentStatus::Closed]],
]);

it('never sets a status manually out of draft (that is finalizing)', function () {
    expect(StatusMachine::canTransition(DocumentType::Invoice, DocumentStatus::Draft, DocumentStatus::Open))->toBeTrue()
        ->and(StatusMachine::canSetManually(DocumentType::Invoice, DocumentStatus::Draft, DocumentStatus::Open))->toBeFalse()
        ->and(StatusMachine::canSetManually(DocumentType::Invoice, DocumentStatus::Open, DocumentStatus::Paid))->toBeTrue()
        ->and(StatusMachine::canSetManually(DocumentType::Invoice, DocumentStatus::Open, DocumentStatus::Cancelled))->toBeFalse();
});

it('knows the status after finalizing and what is locked', function () {
    expect(StatusMachine::finalizedStatus(DocumentType::Offer))->toBe(DocumentStatus::Open)
        ->and(StatusMachine::finalizedStatus(DocumentType::Cancellation))->toBe(DocumentStatus::Closed)
        ->and(StatusMachine::isLocked(DocumentStatus::Draft))->toBeFalse()
        ->and(StatusMachine::isLocked(DocumentStatus::Paid))->toBeTrue();
});

it('derives overdue only for open invoices past their due date', function () {
    expect(StatusMachine::isOverdue(DocumentType::Invoice, DocumentStatus::Open, '2026-10-10', '2026-10-11'))->toBeTrue()
        ->and(StatusMachine::isOverdue(DocumentType::Invoice, DocumentStatus::Open, '2026-10-11', '2026-10-11'))->toBeFalse()
        ->and(StatusMachine::isOverdue(DocumentType::Invoice, DocumentStatus::Paid, '2026-10-01', '2026-10-11'))->toBeFalse()
        ->and(StatusMachine::isOverdue(DocumentType::Invoice, DocumentStatus::Open, null, '2026-10-11'))->toBeFalse()
        ->and(StatusMachine::isOverdue(DocumentType::Offer, DocumentStatus::Open, '2026-10-01', '2026-10-11'))->toBeFalse();
});
```

- [ ] **Step 2: Tests laufen lassen, sie müssen scheitern**

Run: `ddev artisan test --filter='NumberFormatterTest|StatusMachineTest'`
Expected: FAIL mit `Class "App\Domain\Numbering\NumberFormatter" not found`

- [ ] **Step 3: Implementieren**

`app/Domain/Numbering/NumberFormatter.php`:

```php
<?php

namespace App\Domain\Numbering;

use DateTimeInterface;

/** Placeholders: {YYYY}, {YY}, {MM}, {0000} (running number, padded to the count of zeros). */
final class NumberFormatter
{
    public static function format(string $pattern, DateTimeInterface $date, int $sequence): string
    {
        $year = $date->format('Y');
        $result = str_replace(['{YYYY}', '{YY}', '{MM}'], [$year, substr($year, -2), $date->format('m')], $pattern);

        return (string) preg_replace_callback(
            '/\{(0+)\}/',
            fn (array $m): string => str_pad((string) $sequence, strlen($m[1]), '0', STR_PAD_LEFT),
            $result,
        );
    }

    public static function isValidPattern(string $pattern): bool
    {
        return preg_match('/\{0+\}/', $pattern) === 1;
    }

    public static function hasYear(string $pattern): bool
    {
        return str_contains($pattern, '{YYYY}') || str_contains($pattern, '{YY}');
    }
}
```

`app/Domain/Lifecycle/StatusMachine.php`:

```php
<?php

namespace App\Domain\Lifecycle;

use App\Enums\DocumentStatus;
use App\Enums\DocumentType;

/** Port of prototypes/clickdummy-v2/src/domain/lifecycle.ts. */
final class StatusMachine
{
    /** @var array<string, array<string, list<string>>> */
    private const TRANSITIONS = [
        'offer' => ['draft' => ['open'], 'open' => ['accepted', 'rejected']],
        'confirmation' => ['draft' => ['open'], 'open' => ['done']],
        'invoice' => ['draft' => ['open'], 'open' => ['paid']],
        'cancellation' => ['draft' => ['closed']],
    ];

    /** @return list<DocumentStatus> */
    public static function nextStatuses(DocumentType $type, DocumentStatus $from): array
    {
        return array_map(
            fn (string $status): DocumentStatus => DocumentStatus::from($status),
            self::TRANSITIONS[$type->value][$from->value] ?? [],
        );
    }

    public static function canTransition(DocumentType $type, DocumentStatus $from, DocumentStatus $to): bool
    {
        return in_array($to, self::nextStatuses($type, $from), true);
    }

    /** Status changes a user may set; leaving draft is reserved for finalizing. */
    public static function canSetManually(DocumentType $type, DocumentStatus $from, DocumentStatus $to): bool
    {
        return $from !== DocumentStatus::Draft && self::canTransition($type, $from, $to);
    }

    public static function finalizedStatus(DocumentType $type): DocumentStatus
    {
        return $type === DocumentType::Cancellation ? DocumentStatus::Closed : DocumentStatus::Open;
    }

    public static function isLocked(DocumentStatus $status): bool
    {
        return $status !== DocumentStatus::Draft;
    }

    /** Dates as "Y-m-d"; overdue is derived, never stored. */
    public static function isOverdue(DocumentType $type, DocumentStatus $status, ?string $dueDate, string $today): bool
    {
        return $type === DocumentType::Invoice && $status === DocumentStatus::Open && $dueDate !== null && $dueDate < $today;
    }
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `ddev artisan test --filter='NumberFormatterTest|StatusMachineTest'`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/Domain/Numbering app/Domain/Lifecycle tests/Unit/Domain/NumberFormatterTest.php tests/Unit/Domain/StatusMachineTest.php
git commit -m "feat(domain): port number patterns and status transitions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 4: Domain – eigene Felder (Registry, Schlüssel, Validierung)

Port von `fields.ts` + `fields.test.ts`, dazu die Wertprüfung für eigene Felder, die es im Prototyp nicht gab. Fehler tragen einen Pfad und einen Code; übersetzt wird außerhalb der Domain (`fields.error.<code>`, Task 7). Werte für `number`/`money` sind Strings oder ints (kein float), werden zu Dezimalstrings normalisiert.

**Files:**
- Create: `app/Domain/Fields/FieldDefinitionData.php`, `app/Domain/Fields/FieldRegistry.php`, `app/Domain/Fields/KeySlugger.php`, `app/Domain/Fields/FieldErrorCode.php`, `app/Domain/Fields/FieldError.php`, `app/Domain/Fields/CustomValidationResult.php`, `app/Domain/Fields/CustomValueValidator.php`, `app/Domain/Fields/FieldDefinitionValidator.php`
- Test: `tests/Unit/Domain/FieldsTest.php`, `tests/Unit/Domain/CustomValueValidatorTest.php`

**Interfaces:**
- Consumes: `Decimal::isValid()`, `Decimal::of()` (Task 2), `FieldScope`, `FieldType`, `DocumentType` (Task 1).
- Produces:
  - `new FieldDefinitionData(FieldScope $scope, string $key, string $label, FieldType $type, bool $required = false, mixed $defaultValue = null, list<string> $options = [], list<DocumentType> $docTypes = [], ?string $id = null)`
  - `FieldRegistry::CORE` (Kernschlüssel je Ebene), `::coreKeys(FieldScope): list<string>`, `::isReserved(FieldScope, string): bool`, `::hasDocTypes(FieldScope): bool`, `::forScope(list<FieldDefinitionData>, FieldScope, ?DocumentType = null): list<FieldDefinitionData>`, `::defaults(list<FieldDefinitionData>): array<string, mixed>`, `::isEmpty(mixed): bool`
  - `KeySlugger::slug(string $label): string`, `KeySlugger::isValid(string $key): bool`
  - `FieldErrorCode` (Enum, Werte = Übersetzungsschlüssel-Suffix), `new FieldError(string $path, FieldErrorCode $code, array<string, string> $params = [])`
  - `CustomValueValidator::validate(list<FieldDefinitionData> $definitions, array $values, string $pathPrefix, bool $enforceRequired): CustomValidationResult` (`values`: normalisiert, `errors`: `list<FieldError>`, `ok(): bool`), `CustomValueValidator::normalize(FieldDefinitionData, mixed): string|bool|FieldErrorCode`
  - `FieldDefinitionValidator::validate(FieldDefinitionData $definition, list<FieldDefinitionData> $existing): list<FieldError>` (Pfade `label`, `key`, `options`, `doc_types`, `default_value`)

- [ ] **Step 1: Failing tests schreiben**

`tests/Unit/Domain/FieldsTest.php`:

```php
<?php

use App\Domain\Fields\FieldDefinitionData;
use App\Domain\Fields\FieldDefinitionValidator;
use App\Domain\Fields\FieldErrorCode;
use App\Domain\Fields\FieldRegistry;
use App\Domain\Fields\KeySlugger;
use App\Enums\DocumentType;
use App\Enums\FieldScope;
use App\Enums\FieldType;

function fieldDef(array $over = []): FieldDefinitionData
{
    return new FieldDefinitionData(...array_merge([
        'id' => 'x',
        'scope' => FieldScope::Document,
        'key' => 'project_name',
        'label' => 'Projektname',
        'type' => FieldType::Text,
        'docTypes' => [DocumentType::Invoice],
    ], $over));
}

/** @return list<string> */
function fieldErrorCodes(array $errors): array
{
    return array_map(fn ($e) => $e->code->value, $errors);
}

describe('KeySlugger', function () {
    it('transliterates umlauts and snake-cases', function () {
        expect(KeySlugger::slug('Größe der Fläche'))->toBe('groesse_der_flaeche')
            ->and(KeySlugger::slug('  2. Ansprechpartner '))->toBe('f_2_ansprechpartner')
            ->and(KeySlugger::slug('Café Crème'))->toBe('cafe_creme')
            ->and(KeySlugger::slug('!!!'))->toBe('');
    });

    it('accepts only snake_case keys starting with a letter', function () {
        expect(KeySlugger::isValid('po_number'))->toBeTrue()
            ->and(KeySlugger::isValid('PoNumber'))->toBeFalse()
            ->and(KeySlugger::isValid('2nd'))->toBeFalse()
            ->and(KeySlugger::isValid(str_repeat('a', 65)))->toBeFalse();
    });
});

describe('FieldDefinitionValidator', function () {
    it('rejects core keys, duplicates in the same scope and missing doc types', function () {
        expect(fieldErrorCodes(FieldDefinitionValidator::validate(fieldDef(['key' => 'number']), [])))->toBe(['key_reserved'])
            ->and(fieldErrorCodes(FieldDefinitionValidator::validate(fieldDef(['id' => 'y']), [fieldDef()])))->toBe(['key_taken'])
            ->and(fieldErrorCodes(FieldDefinitionValidator::validate(fieldDef(['docTypes' => []]), [])))->toBe(['doc_types_missing']);
    });

    it('allows the same key on another scope', function () {
        expect(FieldDefinitionValidator::validate(fieldDef(['id' => 'y', 'scope' => FieldScope::Customer, 'docTypes' => []]), [fieldDef()]))->toBe([]);
    });

    it('treats a new definition (id null) with an existing key as taken', function () {
        expect(fieldErrorCodes(FieldDefinitionValidator::validate(fieldDef(['id' => null]), [fieldDef()])))->toBe(['key_taken']);
    });

    it('needs a label, a valid key and options for select fields', function () {
        $errors = FieldDefinitionValidator::validate(fieldDef(['label' => ' ', 'key' => 'Bad Key', 'type' => FieldType::Select, 'options' => [' ']]), []);

        expect(array_map(fn ($e) => [$e->path, $e->code], $errors))->toBe([
            ['label', FieldErrorCode::LabelMissing],
            ['key', FieldErrorCode::KeyInvalid],
            ['options', FieldErrorCode::OptionsMissing],
        ]);
    });

    it('checks the default value against the type', function () {
        $errors = FieldDefinitionValidator::validate(fieldDef(['type' => FieldType::Select, 'options' => ['low', 'high'], 'defaultValue' => 'urgent']), []);

        expect(array_map(fn ($e) => [$e->path, $e->code], $errors))->toBe([['default_value', FieldErrorCode::NotOption]]);
    });
});

describe('FieldRegistry', function () {
    it('filters document fields by doc type but not customer fields', function () {
        $defs = [
            fieldDef(['id' => 'a']),
            fieldDef(['id' => 'b', 'key' => 'po', 'docTypes' => [DocumentType::Offer]]),
            fieldDef(['id' => 'c', 'scope' => FieldScope::Customer, 'key' => 'industry', 'docTypes' => []]),
        ];

        expect(array_map(fn ($d) => $d->id, FieldRegistry::forScope($defs, FieldScope::Document, DocumentType::Invoice)))->toBe(['a'])
            ->and(array_map(fn ($d) => $d->id, FieldRegistry::forScope($defs, FieldScope::Customer, DocumentType::Invoice)))->toBe(['c']);
    });

    it('reserves core and structural keys per scope', function () {
        expect(FieldRegistry::isReserved(FieldScope::Document, 'number'))->toBeTrue()
            ->and(FieldRegistry::isReserved(FieldScope::Document, 'groups'))->toBeTrue()
            ->and(FieldRegistry::isReserved(FieldScope::Position, 'kind'))->toBeTrue()
            ->and(FieldRegistry::isReserved(FieldScope::Customer, 'project_name'))->toBeFalse();
    });

    it('collects default values and treats blank strings as empty', function () {
        expect(FieldRegistry::defaults([fieldDef(['defaultValue' => 'Shop']), fieldDef(['key' => 'other'])]))->toBe(['project_name' => 'Shop'])
            ->and(FieldRegistry::isEmpty('  '))->toBeTrue()
            ->and(FieldRegistry::isEmpty(false))->toBeFalse();
    });
});
```

`tests/Unit/Domain/CustomValueValidatorTest.php`:

```php
<?php

use App\Domain\Fields\CustomValueValidator;
use App\Domain\Fields\FieldDefinitionData;
use App\Domain\Fields\FieldErrorCode;
use App\Enums\DocumentType;
use App\Enums\FieldScope;
use App\Enums\FieldType;

/** @return list<FieldDefinitionData> */
function valueDefs(): array
{
    $def = fn (string $key, FieldType $type, array $extra = []): FieldDefinitionData => new FieldDefinitionData(...array_merge([
        'scope' => FieldScope::Document, 'key' => $key, 'label' => ucfirst($key), 'type' => $type, 'docTypes' => [DocumentType::Invoice],
    ], $extra));

    return [
        $def('project_name', FieldType::Text),
        $def('hours', FieldType::Number),
        $def('budget', FieldType::Money),
        $def('deadline', FieldType::Date),
        $def('priority', FieldType::Select, ['options' => ['low', 'high']]),
        $def('rush', FieldType::Boolean),
        $def('po_number', FieldType::Text, ['required' => true]),
    ];
}

it('accepts and normalizes valid values', function () {
    $result = CustomValueValidator::validate(valueDefs(), [
        'project_name' => 'Shop', 'hours' => 12, 'budget' => '1500.5', 'deadline' => '2026-10-31',
        'priority' => 'high', 'rush' => false, 'po_number' => 'PO-1',
    ], 'custom.', true);

    expect($result->errors)->toBe([])
        ->and($result->ok())->toBeTrue()
        ->and($result->values)->toBe([
            'project_name' => 'Shop', 'hours' => '12', 'budget' => '1500.5', 'deadline' => '2026-10-31',
            'priority' => 'high', 'rush' => false, 'po_number' => 'PO-1',
        ]);
});

it('reports wrong types with their path', function () {
    $result = CustomValueValidator::validate(valueDefs(), [
        'project_name' => 42, 'hours' => '12,5', 'budget' => 12.5, 'deadline' => '31.10.2026', 'priority' => 'urgent', 'rush' => 'yes',
    ], 'groups.0.positions.1.custom.', false);

    expect(array_map(fn ($e) => [$e->path, $e->code], $result->errors))->toBe([
        ['groups.0.positions.1.custom.project_name', FieldErrorCode::NotText],
        ['groups.0.positions.1.custom.hours', FieldErrorCode::NotNumber],
        ['groups.0.positions.1.custom.budget', FieldErrorCode::NotMoney],
        ['groups.0.positions.1.custom.deadline', FieldErrorCode::NotDate],
        ['groups.0.positions.1.custom.priority', FieldErrorCode::NotOption],
        ['groups.0.positions.1.custom.rush', FieldErrorCode::NotBoolean],
    ]);
});

it('rejects keys that are not defined for the scope or document type', function () {
    $result = CustomValueValidator::validate(valueDefs(), ['offer_note' => 'x'], 'custom.', false);

    expect(array_map(fn ($e) => [$e->path, $e->code, $e->params], $result->errors))
        ->toBe([['custom.offer_note', FieldErrorCode::Unknown, ['key' => 'offer_note']]]);
});

it('checks required fields only when asked and stores blanks as null', function () {
    expect(CustomValueValidator::validate(valueDefs(), ['po_number' => ' '], 'custom.', false)->values)->toBe(['po_number' => null])
        ->and(array_map(fn ($e) => $e->path, CustomValueValidator::validate(valueDefs(), ['po_number' => ' '], 'custom.', true)->errors))
        ->toBe(['custom.po_number']);
});

it('rejects money with more than two decimals and impossible dates', function () {
    $result = CustomValueValidator::validate(valueDefs(), ['budget' => '1.005', 'deadline' => '2026-02-30'], 'custom.', false);

    expect(array_map(fn ($e) => $e->code, $result->errors))->toBe([FieldErrorCode::NotMoney, FieldErrorCode::NotDate]);
});
```

- [ ] **Step 2: Tests laufen lassen, sie müssen scheitern**

Run: `ddev artisan test --filter='FieldsTest|CustomValueValidatorTest'`
Expected: FAIL mit `Class "App\Domain\Fields\FieldDefinitionData" not found`

- [ ] **Step 3: Daten, Registry, Slugger**

`app/Domain/Fields/FieldDefinitionData.php`:

```php
<?php

namespace App\Domain\Fields;

use App\Enums\DocumentType;
use App\Enums\FieldScope;
use App\Enums\FieldType;

final readonly class FieldDefinitionData
{
    /**
     * @param  list<string>  $options  select fields only
     * @param  list<DocumentType>  $docTypes  document and position fields only
     */
    public function __construct(
        public FieldScope $scope,
        public string $key,
        public string $label,
        public FieldType $type,
        public bool $required = false,
        public mixed $defaultValue = null,
        public array $options = [],
        public array $docTypes = [],
        public ?string $id = null,
    ) {}
}
```

`app/Domain/Fields/FieldRegistry.php`:

```php
<?php

namespace App\Domain\Fields;

use App\Enums\DocumentType;
use App\Enums\FieldScope;

/** Core fields per level (fixed, used by totals and e-invoices) and reserved keys. */
final class FieldRegistry
{
    /** @var array<string, list<string>> */
    public const CORE = [
        'org' => ['name', 'street', 'zip', 'city', 'country', 'logo', 'vat_id', 'tax_number', 'iban', 'bic', 'bank_name', 'email', 'phone', 'website', 'taxation_mode', 'small_business', 'locale'],
        'customer' => ['number', 'name', 'street', 'zip', 'city', 'country', 'email', 'vat_id', 'tax_treatment', 'locale'],
        'contact' => ['salutation', 'first_name', 'last_name', 'full_name', 'position', 'email', 'phone'],
        'document' => ['number', 'date', 'type_label', 'status', 'due_date', 'valid_until', 'service_date', 'service_date_end', 'intro', 'closing', 'net_total', 'tax_total', 'gross_total', 'optional_total', 'tax_breakdown', 'legal_notes', 'source_number', 'locale'],
        'position' => ['index', 'title', 'description', 'quantity', 'unit', 'unit_code', 'unit_price', 'tax_percent', 'total', 'is_optional', 'is_text', 'group'],
    ];

    /** @var array<string, list<string>> */
    private const EXTRA_RESERVED = [
        'org' => ['id', 'custom'],
        'customer' => ['id', 'custom', 'contacts'],
        'contact' => ['id', 'custom'],
        'document' => ['id', 'custom', 'type', 'customer', 'contact', 'positions', 'groups'],
        'position' => ['id', 'custom', 'kind', 'is_item', 'unit_name'],
    ];

    /** @return list<string> */
    public static function coreKeys(FieldScope $scope): array
    {
        return self::CORE[$scope->value];
    }

    public static function isReserved(FieldScope $scope, string $key): bool
    {
        return in_array($key, self::CORE[$scope->value], true) || in_array($key, self::EXTRA_RESERVED[$scope->value], true);
    }

    public static function hasDocTypes(FieldScope $scope): bool
    {
        return $scope === FieldScope::Document || $scope === FieldScope::Position;
    }

    /**
     * Custom fields of one level; document and position fields filtered by document type.
     *
     * @param  list<FieldDefinitionData>  $definitions
     * @return list<FieldDefinitionData>
     */
    public static function forScope(array $definitions, FieldScope $scope, ?DocumentType $docType = null): array
    {
        return array_values(array_filter(
            $definitions,
            fn (FieldDefinitionData $d): bool => $d->scope === $scope
                && (! self::hasDocTypes($scope) || $docType === null || in_array($docType, $d->docTypes, true)),
        ));
    }

    /**
     * @param  list<FieldDefinitionData>  $definitions
     * @return array<string, mixed>
     */
    public static function defaults(array $definitions): array
    {
        $values = [];
        foreach ($definitions as $definition) {
            if ($definition->defaultValue !== null) {
                $values[$definition->key] = $definition->defaultValue;
            }
        }

        return $values;
    }

    public static function isEmpty(mixed $value): bool
    {
        return $value === null || (is_string($value) && trim($value) === '');
    }
}
```

`app/Domain/Fields/KeySlugger.php`:

```php
<?php

namespace App\Domain\Fields;

use Normalizer;

final class KeySlugger
{
    private const TRANSLIT = ['ä' => 'ae', 'ö' => 'oe', 'ü' => 'ue', 'ß' => 'ss'];

    /** snake_case key from a label, e.g. "Größe der Fläche" → "groesse_der_flaeche". */
    public static function slug(string $label): string
    {
        $base = strtr(mb_strtolower($label), self::TRANSLIT);
        $base = (string) preg_replace('/\p{Mn}/u', '', (string) Normalizer::normalize($base, Normalizer::FORM_KD));
        $base = trim((string) preg_replace('/[^a-z0-9]+/', '_', $base), '_');

        if ($base === '') {
            return '';
        }

        return preg_match('/^[a-z]/', $base) === 1 ? $base : 'f_'.$base;
    }

    public static function isValid(string $key): bool
    {
        return strlen($key) <= 64 && preg_match('/^[a-z][a-z0-9_]*$/', $key) === 1;
    }
}
```

- [ ] **Step 4: Fehler-Typen und Validatoren**

`app/Domain/Fields/FieldErrorCode.php`:

```php
<?php

namespace App\Domain\Fields;

/** Value = suffix of the translation key fields.error.<value>. */
enum FieldErrorCode: string
{
    case Unknown = 'unknown';
    case Required = 'required';
    case NotText = 'not_text';
    case TooLong = 'too_long';
    case NotNumber = 'not_number';
    case NotMoney = 'not_money';
    case NotDate = 'not_date';
    case NotOption = 'not_option';
    case NotBoolean = 'not_boolean';
    case NotImage = 'not_image';
    case LabelMissing = 'label_missing';
    case KeyInvalid = 'key_invalid';
    case KeyReserved = 'key_reserved';
    case KeyTaken = 'key_taken';
    case OptionsMissing = 'options_missing';
    case DocTypesMissing = 'doc_types_missing';
}
```

`app/Domain/Fields/FieldError.php`:

```php
<?php

namespace App\Domain\Fields;

final readonly class FieldError
{
    /**
     * @param  string  $path  dot path in the action input, e.g. "custom.po_number"
     * @param  array<string, string>  $params  placeholders for the message (:label, :key, :options)
     */
    public function __construct(
        public string $path,
        public FieldErrorCode $code,
        public array $params = [],
    ) {}
}
```

`app/Domain/Fields/CustomValidationResult.php`:

```php
<?php

namespace App\Domain\Fields;

final readonly class CustomValidationResult
{
    /**
     * @param  array<string, mixed>  $values  normalized values (decimals as strings, blanks as null)
     * @param  list<FieldError>  $errors
     */
    public function __construct(
        public array $values,
        public array $errors,
    ) {}

    public function ok(): bool
    {
        return $this->errors === [];
    }
}
```

`app/Domain/Fields/CustomValueValidator.php`:

```php
<?php

namespace App\Domain\Fields;

use App\Domain\Money\Decimal;
use App\Enums\FieldType;
use DateTimeImmutable;

final class CustomValueValidator
{
    private const MAX_TEXT = 1000;

    private const MAX_TEXTAREA = 10000;

    private const MAX_IMAGE = 2048;

    /**
     * @param  list<FieldDefinitionData>  $definitions  fields valid for this level (and document type)
     * @param  array<array-key, mixed>  $values
     */
    public static function validate(array $definitions, array $values, string $pathPrefix, bool $enforceRequired): CustomValidationResult
    {
        $byKey = [];
        foreach ($definitions as $definition) {
            $byKey[$definition->key] = $definition;
        }

        $clean = [];
        $errors = [];
        foreach ($values as $key => $value) {
            $key = (string) $key;
            $definition = $byKey[$key] ?? null;

            if ($definition === null) {
                $errors[] = new FieldError($pathPrefix.$key, FieldErrorCode::Unknown, ['key' => $key]);

                continue;
            }
            if (FieldRegistry::isEmpty($value)) {
                $clean[$key] = null;

                continue;
            }

            $normalized = self::normalize($definition, $value);
            if ($normalized instanceof FieldErrorCode) {
                $errors[] = new FieldError($pathPrefix.$key, $normalized, self::params($definition));

                continue;
            }
            $clean[$key] = $normalized;
        }

        if ($enforceRequired) {
            foreach ($definitions as $definition) {
                if ($definition->required && FieldRegistry::isEmpty($clean[$definition->key] ?? null)) {
                    $errors[] = new FieldError($pathPrefix.$definition->key, FieldErrorCode::Required, self::params($definition));
                }
            }
        }

        return new CustomValidationResult($clean, $errors);
    }

    /** Normalized value for a non-empty input, or the reason it is invalid. */
    public static function normalize(FieldDefinitionData $definition, mixed $value): string|bool|FieldErrorCode
    {
        return match ($definition->type) {
            FieldType::Text => self::text($value, self::MAX_TEXT),
            FieldType::Textarea => self::text($value, self::MAX_TEXTAREA),
            FieldType::Number => Decimal::isValid($value, 4) ? (string) Decimal::of($value) : FieldErrorCode::NotNumber,
            FieldType::Money => Decimal::isValid($value, 2) ? (string) Decimal::of($value) : FieldErrorCode::NotMoney,
            FieldType::Date => is_string($value) && self::isDate($value) ? $value : FieldErrorCode::NotDate,
            FieldType::Select => is_string($value) && in_array($value, $definition->options, true) ? $value : FieldErrorCode::NotOption,
            FieldType::Boolean => is_bool($value) ? $value : FieldErrorCode::NotBoolean,
            FieldType::Image => is_string($value) && mb_strlen($value) <= self::MAX_IMAGE ? $value : FieldErrorCode::NotImage,
        };
    }

    private static function text(mixed $value, int $max): string|FieldErrorCode
    {
        if (! is_string($value)) {
            return FieldErrorCode::NotText;
        }

        return mb_strlen($value) <= $max ? $value : FieldErrorCode::TooLong;
    }

    private static function isDate(string $value): bool
    {
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);

        return $date !== false && $date->format('Y-m-d') === $value;
    }

    /** @return array<string, string> */
    private static function params(FieldDefinitionData $definition): array
    {
        return ['label' => $definition->label, 'key' => $definition->key, 'options' => implode(', ', $definition->options)];
    }
}
```

`app/Domain/Fields/FieldDefinitionValidator.php`:

```php
<?php

namespace App\Domain\Fields;

use App\Enums\FieldType;

/** Port of validateFieldDef() from prototypes/clickdummy-v2/src/domain/fields.ts. */
final class FieldDefinitionValidator
{
    /**
     * @param  list<FieldDefinitionData>  $existing  all saved definitions (the one being edited included)
     * @return list<FieldError>
     */
    public static function validate(FieldDefinitionData $definition, array $existing): array
    {
        $errors = [];

        if (trim($definition->label) === '') {
            $errors[] = new FieldError('label', FieldErrorCode::LabelMissing);
        }
        if (! KeySlugger::isValid($definition->key)) {
            $errors[] = new FieldError('key', FieldErrorCode::KeyInvalid);
        } elseif (FieldRegistry::isReserved($definition->scope, $definition->key)) {
            $errors[] = new FieldError('key', FieldErrorCode::KeyReserved, ['key' => $definition->key]);
        }
        foreach ($existing as $other) {
            if ($other->scope === $definition->scope && $other->key === $definition->key && $other->id !== $definition->id) {
                $errors[] = new FieldError('key', FieldErrorCode::KeyTaken, ['key' => $definition->key]);
                break;
            }
        }
        if ($definition->type === FieldType::Select && array_filter($definition->options, fn (string $o): bool => trim($o) !== '') === []) {
            $errors[] = new FieldError('options', FieldErrorCode::OptionsMissing);
        }
        if (FieldRegistry::hasDocTypes($definition->scope) && $definition->docTypes === []) {
            $errors[] = new FieldError('doc_types', FieldErrorCode::DocTypesMissing);
        }
        if (! FieldRegistry::isEmpty($definition->defaultValue)) {
            $normalized = CustomValueValidator::normalize($definition, $definition->defaultValue);
            if ($normalized instanceof FieldErrorCode) {
                $errors[] = new FieldError('default_value', $normalized, ['label' => $definition->label, 'options' => implode(', ', $definition->options)]);
            }
        }

        return $errors;
    }
}
```

- [ ] **Step 5: Tests laufen lassen**

Run: `ddev artisan test --filter='FieldsTest|CustomValueValidatorTest'`
Expected: PASS. Hinweis: `Normalizer` kommt aus `ext-intl` (in DDEV und CI installiert); fehlt es, `ddev exec php -m | grep intl` prüfen.

- [ ] **Step 6: Statische Analyse**

Run: `ddev exec vendor/bin/phpstan analyse --memory-limit=1G`
Expected: `[OK] No errors`

- [ ] **Step 7: Commit**

```bash
git add app/Domain/Fields tests/Unit/Domain/FieldsTest.php tests/Unit/Domain/CustomValueValidatorTest.php
git commit -m "feat(domain): add custom field registry and value validation with paths

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 5: Domain – Prüfprofile und Umwandeln

Port von `compliance.ts` und `convert.ts` samt Tests. Statt deutscher Texte liefert die Prüfung `ComplianceRule`-Codes mit Parametern (Übersetzung in Task 7). Der Konverter erzeugt nur einen Plan (Gruppen, Felder, Datumswerte); IDs und Speichern übernimmt `ConvertDocument` (Task 12).

**Files:**
- Create: `app/Domain/Compliance/ComplianceRule.php`, `app/Domain/Compliance/ComplianceIssue.php`, `app/Domain/Compliance/PartyFacts.php`, `app/Domain/Compliance/ComplianceInput.php`, `app/Domain/Compliance/ComplianceChecker.php`, `app/Domain/Conversion/ConversionSource.php`, `app/Domain/Conversion/ConversionPlan.php`, `app/Domain/Conversion/DocumentConverter.php`
- Test: `tests/Unit/Domain/ComplianceTest.php`, `tests/Unit/Domain/ConversionTest.php`

**Interfaces:**
- Consumes: `PositionInput`, `GroupInput` (Task 2), `FieldDefinitionData`, `FieldRegistry` (Task 4), Enums (Task 1).
- Produces:
  - `ComplianceRule` (Enum, Werte = Suffix von `compliance.<value>`), `new ComplianceIssue(string $path, ComplianceRule $rule, array<string, string> $params = [])`
  - `new PartyFacts(string $name, string $street, string $zip, string $city, string $country, string $vatId = '', string $taxNumber = '', string $iban = '', array $custom = [], ?TaxTreatment $taxTreatment = null)`, `->addressComplete(): bool`
  - `new ComplianceInput(DocumentType $type, ComplianceProfile $profile, TaxationMode $taxationMode, ?string $date, ?string $serviceDate, ?string $dueDate, array $custom, list<GroupInput> $groups, PartyFacts $org, ?PartyFacts $customer, ?array $contactCustom, array<string, string> $unitCodes, list<string> $taxRateIds, list<FieldDefinitionData> $fieldDefinitions)`
  - `ComplianceChecker::check(ComplianceInput): list<ComplianceIssue>`
  - `new ConversionSource(DocumentType $type, DocumentStatus $status, bool $alreadyCancelled, ?string $serviceDate, ?string $serviceDateEnd, array $custom, list<GroupInput> $groups)`
  - `ConversionPlan` (`groups`, `custom`, `serviceDate`, `serviceDateEnd`, `dueDate`, `droppedFields: list<string>`)
  - `DocumentConverter::CONVERSIONS`, `::canConvert(DocumentType $source, DocumentStatus $status, bool $alreadyCancelled, DocumentType $target): bool`, `::convert(ConversionSource, DocumentType $target, ?int $paymentTermDays, list<FieldDefinitionData>, string $today): ConversionPlan` (wirft `DomainException`, wenn nicht erlaubt)

- [ ] **Step 1: Failing tests schreiben**

`tests/Unit/Domain/ComplianceTest.php`:

```php
<?php

use App\Domain\Compliance\ComplianceChecker;
use App\Domain\Compliance\ComplianceInput;
use App\Domain\Compliance\PartyFacts;
use App\Domain\Fields\FieldDefinitionData;
use App\Domain\Money\Decimal;
use App\Domain\Totals\GroupInput;
use App\Domain\Totals\PositionInput;
use App\Enums\ComplianceProfile;
use App\Enums\DocumentType;
use App\Enums\FieldScope;
use App\Enums\FieldType;
use App\Enums\PositionKind;
use App\Enums\TaxationMode;
use App\Enums\TaxTreatment;

function complianceItem(array $over = []): PositionInput
{
    return new PositionInput(...array_merge([
        'id' => 'p1', 'kind' => PositionKind::Item, 'title' => 'X', 'quantity' => Decimal::of('1'),
        'unitPrice' => Decimal::of('1'), 'unitId' => 'u', 'taxRateId' => 'r',
    ], $over));
}

/** @return list<string> */
function compliancePaths(array $over = [], array $positions = []): array
{
    $input = new ComplianceInput(...array_merge([
        'type' => DocumentType::Offer,
        'profile' => ComplianceProfile::Basic,
        'taxationMode' => TaxationMode::Regular,
        'date' => '2026-10-04',
        'serviceDate' => null,
        'dueDate' => null,
        'custom' => [],
        'groups' => [new GroupInput('g', null, $positions === [] ? [complianceItem()] : $positions)],
        'org' => new PartyFacts('O', 's', 'z', 'c', 'DE', vatId: 'DE1', iban: 'X'),
        'customer' => new PartyFacts('C', 's', 'z', 'c', 'DE', taxTreatment: TaxTreatment::Domestic),
        'contactCustom' => null,
        'unitCodes' => ['u' => 'HUR'],
        'taxRateIds' => ['r'],
        'fieldDefinitions' => [],
    ], $over));

    return array_map(fn ($issue) => $issue->path, ComplianceChecker::check($input));
}

it('passes a complete offer', function () {
    expect(compliancePaths())->toBe([]);
});

it('requires a date and a customer', function () {
    expect(compliancePaths(['date' => null, 'customer' => null]))->toBe(['document.date', 'document.customer']);
});

it('requires at least one item', function () {
    expect(compliancePaths([], [complianceItem(['kind' => PositionKind::Text])]))->toBe(['positions']);
});

it('reports a deleted unit and tax rate', function () {
    expect(compliancePaths([], [complianceItem(['unitId' => 'gone', 'taxRateId' => 'gone'])]))
        ->toBe(['positions.p1.tax_rate', 'positions.p1.unit']);
});

it('does not ask small businesses for a tax rate', function () {
    expect(compliancePaths(['taxationMode' => TaxationMode::SmallBusiness], [complianceItem(['taxRateId' => null])]))->toBe([]);
});

it('checks required document fields only for their doc types', function () {
    $def = new FieldDefinitionData(FieldScope::Document, 'po_number', 'Bestellnummer', FieldType::Text, required: true, docTypes: [DocumentType::Invoice]);

    expect(compliancePaths(['fieldDefinitions' => [$def]]))->toBe([])
        ->and(compliancePaths(['fieldDefinitions' => [$def], 'type' => DocumentType::Invoice]))->toContain('document.custom.po_number');
});

it('checks required fields on every level', function () {
    $defs = [
        new FieldDefinitionData(FieldScope::Org, 'register', 'Register', FieldType::Text, required: true),
        new FieldDefinitionData(FieldScope::Customer, 'industry', 'Industry', FieldType::Text, required: true),
        new FieldDefinitionData(FieldScope::Contact, 'department', 'Department', FieldType::Text, required: true),
        new FieldDefinitionData(FieldScope::Position, 'ticket', 'Ticket', FieldType::Text, required: true, docTypes: [DocumentType::Offer]),
    ];

    expect(compliancePaths(['fieldDefinitions' => $defs, 'contactCustom' => []]))
        ->toBe(['org.register', 'customer.industry', 'contact.department', 'positions.p1.custom.ticket']);
});

it('requires service date and due date for e-invoices', function () {
    expect(compliancePaths(['type' => DocumentType::Invoice, 'profile' => ComplianceProfile::En16931]))
        ->toBe(['document.service_date', 'document.due_date']);
});

it('checks organization, customer and units for e-invoices', function () {
    $paths = compliancePaths([
        'type' => DocumentType::Cancellation,
        'profile' => ComplianceProfile::En16931,
        'serviceDate' => '2026-10-01',
        'org' => new PartyFacts('O', '', 'z', 'c', 'DE'),
        'customer' => new PartyFacts('C', 's', '', 'c', 'SE', taxTreatment: TaxTreatment::EuReverseCharge),
        'unitCodes' => ['u' => ''],
    ], [complianceItem(['quantity' => Decimal::of('0')])]);

    expect($paths)->toBe([
        'org.address', 'org.vat_id', 'org.iban', 'customer.address', 'customer.vat_id',
        'positions.p1.unit', 'positions.p1.quantity',
    ]);
});
```

`tests/Unit/Domain/ConversionTest.php`:

```php
<?php

use App\Domain\Conversion\ConversionSource;
use App\Domain\Conversion\DocumentConverter;
use App\Domain\Fields\FieldDefinitionData;
use App\Domain\Money\Decimal;
use App\Domain\Totals\GroupInput;
use App\Domain\Totals\PositionInput;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\FieldScope;
use App\Enums\FieldType;
use App\Enums\PositionKind;

function conversionPos(string $id, PositionKind $kind, string $title, string $quantity, string $price, array $custom = []): PositionInput
{
    return new PositionInput($id, $kind, $title, Decimal::of($quantity), Decimal::of($price), 'u', 'r', $custom);
}

function acceptedOffer(array $over = []): ConversionSource
{
    return new ConversionSource(...array_merge([
        'type' => DocumentType::Offer,
        'status' => DocumentStatus::Accepted,
        'alreadyCancelled' => false,
        'serviceDate' => null,
        'serviceDateEnd' => null,
        'custom' => ['project_name' => 'Shop', 'offer_note' => 'offers only'],
        'groups' => [
            new GroupInput('g1', 'Konzept', [
                conversionPos('p1', PositionKind::Item, 'Workshop', '1', '890', ['ref' => 'A']),
                conversionPos('p2', PositionKind::Optional, 'Extra', '1', '100'),
            ]),
            new GroupInput('g2', 'Nur optional', [conversionPos('p3', PositionKind::Optional, 'Hosting', '12', '49')]),
        ],
    ], $over));
}

/** @return list<FieldDefinitionData> */
function conversionDefs(): array
{
    return [
        new FieldDefinitionData(FieldScope::Document, 'project_name', 'Project', FieldType::Text, docTypes: [DocumentType::Offer, DocumentType::Invoice]),
        new FieldDefinitionData(FieldScope::Document, 'offer_note', 'Offer note', FieldType::Text, docTypes: [DocumentType::Offer]),
        new FieldDefinitionData(FieldScope::Position, 'ref', 'Ref', FieldType::Text, docTypes: [DocumentType::Offer, DocumentType::Invoice]),
    ];
}

it('only converts along the chain and in the right status', function () {
    expect(DocumentConverter::canConvert(DocumentType::Offer, DocumentStatus::Open, false, DocumentType::Invoice))->toBeFalse()
        ->and(DocumentConverter::canConvert(DocumentType::Offer, DocumentStatus::Accepted, false, DocumentType::Invoice))->toBeTrue()
        ->and(DocumentConverter::canConvert(DocumentType::Offer, DocumentStatus::Accepted, false, DocumentType::Cancellation))->toBeFalse()
        ->and(DocumentConverter::canConvert(DocumentType::Confirmation, DocumentStatus::Draft, false, DocumentType::Invoice))->toBeFalse()
        ->and(DocumentConverter::canConvert(DocumentType::Confirmation, DocumentStatus::Done, false, DocumentType::Invoice))->toBeTrue()
        ->and(DocumentConverter::canConvert(DocumentType::Invoice, DocumentStatus::Paid, false, DocumentType::Cancellation))->toBeTrue()
        ->and(DocumentConverter::canConvert(DocumentType::Invoice, DocumentStatus::Open, true, DocumentType::Cancellation))->toBeFalse()
        ->and(DocumentConverter::canConvert(DocumentType::Invoice, DocumentStatus::Draft, false, DocumentType::Cancellation))->toBeFalse();
});

it('keeps groups, drops optional positions and empty groups, keeps fields valid for the target', function () {
    $plan = DocumentConverter::convert(acceptedOffer(), DocumentType::Invoice, 14, conversionDefs(), '2026-10-11');

    expect(array_map(fn ($g) => $g->title, $plan->groups))->toBe(['Konzept'])
        ->and(array_map(fn ($p) => $p->title, $plan->groups[0]->positions))->toBe(['Workshop'])
        ->and($plan->groups[0]->positions[0]->custom)->toBe(['ref' => 'A'])
        ->and($plan->custom)->toBe(['project_name' => 'Shop'])
        ->and($plan->droppedFields)->toBe(['document.offer_note'])
        ->and($plan->dueDate)->toBe('2026-10-25')
        ->and($plan->serviceDate)->toBe('2026-10-11');
});

it('keeps a loose group even when it ends up empty', function () {
    $offer = acceptedOffer(['groups' => [new GroupInput('g0', null, [conversionPos('o', PositionKind::Optional, 'Extra', '1', '1')])]]);

    expect(DocumentConverter::convert($offer, DocumentType::Confirmation, null, conversionDefs(), '2026-10-11')->groups)
        ->toHaveCount(1);
});

it('negates item quantities for cancellations and keeps the service date', function () {
    $invoice = acceptedOffer(['type' => DocumentType::Invoice, 'status' => DocumentStatus::Open, 'serviceDate' => '2026-09-30']);
    $plan = DocumentConverter::convert($invoice, DocumentType::Cancellation, 14, conversionDefs(), '2026-10-11');

    expect((string) $plan->groups[0]->positions[0]->quantity)->toBe('-1')
        ->and($plan->serviceDate)->toBe('2026-09-30')
        ->and($plan->dueDate)->toBeNull()
        ->and($plan->droppedFields)->toBe(['position.ref', 'document.project_name', 'document.offer_note']);
});

it('refuses conversions that are not allowed', function () {
    DocumentConverter::convert(acceptedOffer(['status' => DocumentStatus::Open]), DocumentType::Invoice, 14, conversionDefs(), '2026-10-11');
})->throws(DomainException::class);
```

- [ ] **Step 2: Tests laufen lassen, sie müssen scheitern**

Run: `ddev artisan test --filter='ComplianceTest|ConversionTest'`
Expected: FAIL mit `Class "App\Domain\Compliance\ComplianceInput" not found`

- [ ] **Step 3: Prüfprofile**

`app/Domain/Compliance/ComplianceRule.php`:

```php
<?php

namespace App\Domain\Compliance;

/** Value = suffix of the translation key compliance.<value>. */
enum ComplianceRule: string
{
    case DateMissing = 'date_missing';
    case CustomerMissing = 'customer_missing';
    case NoItems = 'no_items';
    case PositionTitleMissing = 'position_title_missing';
    case TaxRateMissing = 'tax_rate_missing';
    case UnitMissing = 'unit_missing';
    case OrgFieldMissing = 'org_field_missing';
    case CustomerFieldMissing = 'customer_field_missing';
    case ContactFieldMissing = 'contact_field_missing';
    case DocumentFieldMissing = 'document_field_missing';
    case PositionFieldMissing = 'position_field_missing';
    case OrgAddressMissing = 'org_address_missing';
    case OrgTaxIdMissing = 'org_tax_id_missing';
    case OrgIbanMissing = 'org_iban_missing';
    case CustomerAddressIncomplete = 'customer_address_incomplete';
    case CustomerVatIdMissing = 'customer_vat_id_missing';
    case ServiceDateMissing = 'service_date_missing';
    case DueDateMissing = 'due_date_missing';
    case UnitCodeMissing = 'unit_code_missing';
    case QuantityZero = 'quantity_zero';
}
```

`app/Domain/Compliance/ComplianceIssue.php`:

```php
<?php

namespace App\Domain\Compliance;

final readonly class ComplianceIssue
{
    /**
     * @param  string  $path  points at the field in the editor (jump target), e.g. "positions.<id>.unit"
     * @param  array<string, string>  $params  placeholders for the message (:title, :label)
     */
    public function __construct(
        public string $path,
        public ComplianceRule $rule,
        public array $params = [],
    ) {}
}
```

`app/Domain/Compliance/PartyFacts.php`:

```php
<?php

namespace App\Domain\Compliance;

use App\Enums\TaxTreatment;

/** What the checks need from the organization or a customer. */
final readonly class PartyFacts
{
    /**
     * @param  array<string, mixed>  $custom
     */
    public function __construct(
        public string $name,
        public string $street,
        public string $zip,
        public string $city,
        public string $country,
        public string $vatId = '',
        public string $taxNumber = '',
        public string $iban = '',
        public array $custom = [],
        public ?TaxTreatment $taxTreatment = null,
    ) {}

    public function addressComplete(): bool
    {
        foreach ([$this->street, $this->zip, $this->city, $this->country] as $part) {
            if (trim($part) === '') {
                return false;
            }
        }

        return true;
    }
}
```

`app/Domain/Compliance/ComplianceInput.php`:

```php
<?php

namespace App\Domain\Compliance;

use App\Domain\Fields\FieldDefinitionData;
use App\Domain\Totals\GroupInput;
use App\Enums\ComplianceProfile;
use App\Enums\DocumentType;
use App\Enums\TaxationMode;

final readonly class ComplianceInput
{
    /**
     * @param  array<string, mixed>  $custom  document custom values
     * @param  list<GroupInput>  $groups
     * @param  array<string, mixed>|null  $contactCustom  null = no contact chosen
     * @param  array<string, string>  $unitCodes  unit id => UN/ECE code ('' if none)
     * @param  list<string>  $taxRateIds
     * @param  list<FieldDefinitionData>  $fieldDefinitions  all definitions; filtered per level here
     */
    public function __construct(
        public DocumentType $type,
        public ComplianceProfile $profile,
        public TaxationMode $taxationMode,
        public ?string $date,
        public ?string $serviceDate,
        public ?string $dueDate,
        public array $custom,
        public array $groups,
        public PartyFacts $org,
        public ?PartyFacts $customer,
        public ?array $contactCustom,
        public array $unitCodes,
        public array $taxRateIds,
        public array $fieldDefinitions,
    ) {}
}
```

`app/Domain/Compliance/ComplianceChecker.php`:

```php
<?php

namespace App\Domain\Compliance;

use App\Domain\Fields\FieldDefinitionData;
use App\Domain\Fields\FieldRegistry;
use App\Domain\Totals\PositionInput;
use App\Enums\ComplianceProfile;
use App\Enums\DocumentType;
use App\Enums\FieldScope;
use App\Enums\PositionKind;
use App\Enums\TaxationMode;
use App\Enums\TaxTreatment;

/** Port of checkCompliance() from prototypes/clickdummy-v2/src/domain/compliance.ts. */
final class ComplianceChecker
{
    /** @return list<ComplianceIssue> */
    public static function check(ComplianceInput $in): array
    {
        $items = [];
        foreach ($in->groups as $group) {
            foreach ($group->positions as $position) {
                if ($position->kind === PositionKind::Item) {
                    $items[] = $position;
                }
            }
        }

        $issues = [];
        if ($in->date === null || $in->date === '') {
            $issues[] = new ComplianceIssue('document.date', ComplianceRule::DateMissing);
        }
        if ($in->customer === null) {
            $issues[] = new ComplianceIssue('document.customer', ComplianceRule::CustomerMissing);
        }
        if ($items === []) {
            $issues[] = new ComplianceIssue('positions', ComplianceRule::NoItems);
        }
        foreach ($items as $p) {
            $title = ['title' => self::title($p)];
            if (trim($p->title) === '') {
                $issues[] = new ComplianceIssue("positions.{$p->id}.title", ComplianceRule::PositionTitleMissing);
            }
            if ($in->taxationMode === TaxationMode::Regular && ! in_array($p->taxRateId, $in->taxRateIds, true)) {
                $issues[] = new ComplianceIssue("positions.{$p->id}.tax_rate", ComplianceRule::TaxRateMissing, $title);
            }
            if ($p->unitId === null || ! array_key_exists($p->unitId, $in->unitCodes)) {
                $issues[] = new ComplianceIssue("positions.{$p->id}.unit", ComplianceRule::UnitMissing, $title);
            }
        }

        $defs = $in->fieldDefinitions;
        array_push($issues, ...self::requiredCustom(FieldRegistry::forScope($defs, FieldScope::Org), $in->org->custom, 'org.', ComplianceRule::OrgFieldMissing));
        if ($in->customer !== null) {
            array_push($issues, ...self::requiredCustom(FieldRegistry::forScope($defs, FieldScope::Customer), $in->customer->custom, 'customer.', ComplianceRule::CustomerFieldMissing));
        }
        if ($in->contactCustom !== null) {
            array_push($issues, ...self::requiredCustom(FieldRegistry::forScope($defs, FieldScope::Contact), $in->contactCustom, 'contact.', ComplianceRule::ContactFieldMissing));
        }
        array_push($issues, ...self::requiredCustom(FieldRegistry::forScope($defs, FieldScope::Document, $in->type), $in->custom, 'document.custom.', ComplianceRule::DocumentFieldMissing));
        $positionDefs = FieldRegistry::forScope($defs, FieldScope::Position, $in->type);
        foreach ($items as $p) {
            array_push($issues, ...self::requiredCustom($positionDefs, $p->custom, "positions.{$p->id}.custom.", ComplianceRule::PositionFieldMissing, ['title' => self::title($p)]));
        }

        if ($in->profile !== ComplianceProfile::En16931) {
            return $issues;
        }

        if (trim($in->org->name) === '' || ! $in->org->addressComplete()) {
            $issues[] = new ComplianceIssue('org.address', ComplianceRule::OrgAddressMissing);
        }
        if (trim($in->org->vatId) === '' && trim($in->org->taxNumber) === '') {
            $issues[] = new ComplianceIssue('org.vat_id', ComplianceRule::OrgTaxIdMissing);
        }
        if (trim($in->org->iban) === '') {
            $issues[] = new ComplianceIssue('org.iban', ComplianceRule::OrgIbanMissing);
        }
        if ($in->customer !== null && ! $in->customer->addressComplete()) {
            $issues[] = new ComplianceIssue('customer.address', ComplianceRule::CustomerAddressIncomplete);
        }
        if ($in->customer?->taxTreatment === TaxTreatment::EuReverseCharge && trim($in->customer->vatId) === '') {
            $issues[] = new ComplianceIssue('customer.vat_id', ComplianceRule::CustomerVatIdMissing);
        }
        if ($in->serviceDate === null || $in->serviceDate === '') {
            $issues[] = new ComplianceIssue('document.service_date', ComplianceRule::ServiceDateMissing);
        }
        if ($in->type === DocumentType::Invoice && ($in->dueDate === null || $in->dueDate === '')) {
            $issues[] = new ComplianceIssue('document.due_date', ComplianceRule::DueDateMissing);
        }
        foreach ($items as $p) {
            $title = ['title' => self::title($p)];
            if ($p->unitId !== null && array_key_exists($p->unitId, $in->unitCodes) && trim($in->unitCodes[$p->unitId]) === '') {
                $issues[] = new ComplianceIssue("positions.{$p->id}.unit", ComplianceRule::UnitCodeMissing, $title);
            }
            if ($p->quantity->isZero()) {
                $issues[] = new ComplianceIssue("positions.{$p->id}.quantity", ComplianceRule::QuantityZero, $title);
            }
        }

        return $issues;
    }

    /**
     * @param  list<FieldDefinitionData>  $definitions
     * @param  array<string, mixed>  $values
     * @param  array<string, string>  $params
     * @return list<ComplianceIssue>
     */
    private static function requiredCustom(array $definitions, array $values, string $prefix, ComplianceRule $rule, array $params = []): array
    {
        $issues = [];
        foreach ($definitions as $definition) {
            if ($definition->required && FieldRegistry::isEmpty($values[$definition->key] ?? null)) {
                $issues[] = new ComplianceIssue($prefix.$definition->key, $rule, [...$params, 'label' => $definition->label]);
            }
        }

        return $issues;
    }

    private static function title(PositionInput $position): string
    {
        return trim($position->title) !== '' ? $position->title : '–';
    }
}
```

- [ ] **Step 4: Umwandeln**

`app/Domain/Conversion/ConversionSource.php`:

```php
<?php

namespace App\Domain\Conversion;

use App\Domain\Totals\GroupInput;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;

final readonly class ConversionSource
{
    /**
     * @param  array<string, mixed>  $custom
     * @param  list<GroupInput>  $groups
     */
    public function __construct(
        public DocumentType $type,
        public DocumentStatus $status,
        public bool $alreadyCancelled,
        public ?string $serviceDate,
        public ?string $serviceDateEnd,
        public array $custom,
        public array $groups,
    ) {}
}
```

`app/Domain/Conversion/ConversionPlan.php`:

```php
<?php

namespace App\Domain\Conversion;

use App\Domain\Totals\GroupInput;

/** What the new draft gets; ids of groups/positions are assigned when it is saved. */
final readonly class ConversionPlan
{
    /**
     * @param  list<GroupInput>  $groups
     * @param  array<string, mixed>  $custom
     * @param  list<string>  $droppedFields  "document.<key>" / "position.<key>" not valid for the target type
     */
    public function __construct(
        public array $groups,
        public array $custom,
        public ?string $serviceDate,
        public ?string $serviceDateEnd,
        public ?string $dueDate,
        public array $droppedFields,
    ) {}
}
```

`app/Domain/Conversion/DocumentConverter.php`:

```php
<?php

namespace App\Domain\Conversion;

use App\Domain\Fields\FieldDefinitionData;
use App\Domain\Fields\FieldRegistry;
use App\Domain\Totals\GroupInput;
use App\Domain\Totals\PositionInput;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\FieldScope;
use App\Enums\PositionKind;
use DateTimeImmutable;
use DomainException;

/** Port of prototypes/clickdummy-v2/src/domain/convert.ts. */
final class DocumentConverter
{
    /** @var array<string, list<string>> */
    public const CONVERSIONS = [
        'offer' => ['confirmation', 'invoice'],
        'confirmation' => ['invoice'],
        'invoice' => ['cancellation'],
        'cancellation' => [],
    ];

    public static function canConvert(DocumentType $source, DocumentStatus $status, bool $alreadyCancelled, DocumentType $target): bool
    {
        if (! in_array($target->value, self::CONVERSIONS[$source->value], true)) {
            return false;
        }
        if ($target === DocumentType::Cancellation) {
            return in_array($status, [DocumentStatus::Open, DocumentStatus::Paid], true) && ! $alreadyCancelled;
        }
        if ($source === DocumentType::Offer) {
            return $status === DocumentStatus::Accepted;
        }

        return $status !== DocumentStatus::Draft;
    }

    /**
     * Custom values move along when their field is defined for the target type too; others are dropped and reported.
     *
     * @param  list<FieldDefinitionData>  $definitions
     *
     * @throws DomainException when the conversion is not allowed
     */
    public static function convert(ConversionSource $source, DocumentType $target, ?int $paymentTermDays, array $definitions, string $today): ConversionPlan
    {
        if (! self::canConvert($source->type, $source->status, $source->alreadyCancelled, $target)) {
            throw new DomainException("Conversion {$source->type->value} ({$source->status->value}) -> {$target->value} is not allowed.");
        }

        $dropped = [];
        $groups = [];
        foreach ($source->groups as $group) {
            $positions = [];
            foreach ($group->positions as $p) {
                if ($p->kind === PositionKind::Optional) {
                    continue;
                }
                $positions[] = new PositionInput(
                    id: $p->id,
                    kind: $p->kind,
                    title: $p->title,
                    quantity: $p->kind === PositionKind::Item && $target === DocumentType::Cancellation ? $p->quantity->negated() : $p->quantity,
                    unitPrice: $p->unitPrice,
                    unitId: $p->unitId,
                    taxRateId: $p->taxRateId,
                    custom: self::pick($p->custom, FieldScope::Position, $target, $definitions, $dropped),
                    description: $p->description,
                );
            }
            if ($positions !== [] || $group->title === null) {
                $groups[] = new GroupInput($group->id, $group->title, $positions);
            }
        }

        return new ConversionPlan(
            groups: $groups,
            custom: self::pick($source->custom, FieldScope::Document, $target, $definitions, $dropped),
            serviceDate: $source->serviceDate ?? ($target === DocumentType::Invoice ? $today : null),
            serviceDateEnd: $source->serviceDateEnd,
            dueDate: $target === DocumentType::Invoice && $paymentTermDays !== null
                ? (new DateTimeImmutable($today))->modify("+{$paymentTermDays} days")->format('Y-m-d')
                : null,
            droppedFields: array_values(array_unique($dropped)),
        );
    }

    /**
     * @param  array<string, mixed>  $custom
     * @param  list<FieldDefinitionData>  $definitions
     * @param  list<string>  $dropped
     * @return array<string, mixed>
     */
    private static function pick(array $custom, FieldScope $scope, DocumentType $target, array $definitions, array &$dropped): array
    {
        $keys = array_map(fn (FieldDefinitionData $d): string => $d->key, FieldRegistry::forScope($definitions, $scope, $target));
        $kept = [];
        foreach ($custom as $key => $value) {
            if (in_array($key, $keys, true)) {
                $kept[$key] = $value;
            } else {
                $dropped[] = "{$scope->value}.{$key}";
            }
        }

        return $kept;
    }
}
```

- [ ] **Step 5: Tests laufen lassen**

Run: `ddev artisan test --filter='ComplianceTest|ConversionTest'`
Expected: PASS

- [ ] **Step 6: Statische Analyse**

Run: `ddev exec vendor/bin/phpstan analyse --memory-limit=1G`
Expected: `[OK] No errors`

- [ ] **Step 7: Commit**

```bash
git add app/Domain/Compliance app/Domain/Conversion tests/Unit/Domain/ComplianceTest.php tests/Unit/Domain/ConversionTest.php
git commit -m "feat(domain): port compliance profiles and document conversion

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 6: Migrationen, Models, Factories und Sperre abgeschlossener Dokumente

Alle Tabellen aus Spec Abschnitt 4 (außer `users`, existiert, und `personal_access_tokens`, kommt mit Sanctum in Phase 4). Grunddaten (Organisation, Dokumenttypen, Nummernkreise, Steuersätze, Einheiten) legt eine eigene Migration an. Die Sperre sitzt im Model: `Document::updating`/`deleting` und `saving`/`deleting` an Gruppen und Positionen. Mass-Updates (`Model::query()->update()`) umgehen Model-Events; Actions benutzen sie deshalb nur für Entwürfe.

**Files:**
- Create: `database/migrations/2026_10_11_100000_create_master_data_tables.php`, `database/migrations/2026_10_11_100100_create_customer_tables.php`, `database/migrations/2026_10_11_100200_create_document_tables.php`, `database/migrations/2026_10_11_100300_insert_default_master_data.php`
- Create: `app/Models/{Organization,Customer,Contact,FieldDefinition,TaxRate,Unit,TextBlock,Template,TemplateAsset,DocumentTypeSetting,NumberSequence,Document,PositionGroup,Position,DocumentSnapshot,DocumentFile,DocumentEvent}.php`
- Create: `app/Exceptions/DomainActionException.php`, `app/Exceptions/DocumentLockedException.php`, `app/Support/Text.php`
- Create: `database/factories/{Customer,Contact,Document,FieldDefinition,TextBlock,Template}Factory.php`
- Modify: `lang/en.json`, `lang/de.json` (Schlüssel `errors.document_locked`)
- Test: `tests/Feature/Models/SchemaTest.php`, `tests/Feature/Models/DocumentLockTest.php`

**Interfaces:**
- Consumes: Enums (Task 1).
- Produces:
  - Models in `App\Models` (alle `HasUlids` außer `DocumentTypeSetting`; `$guarded = ['id']`), Casts: Enums, `custom`/`data`/`payload`/`manifest`/`options`/`doc_types` als `array`, `default_value` als `json`, Beträge `decimal:2`/`decimal:4` (Strings), Datumsfelder `immutable_date:Y-m-d`, Zeitstempel `immutable_datetime`.
  - `Organization::current(): Organization`.
  - `Document::isFinalized(): bool`, `Document::assertDraft(string $id): void`, `Document::MUTABLE_WHEN_FINALIZED`, Relationen `customer()`, `contact()`, `template()`, `source()`, `cancelledBy()`, `groups()` (nach `sort`), `positions()`, `snapshot()` (HasOne), `files()`, `events()`, `creator()`.
  - `PositionGroup::positions()` (nach `sort`), `Customer::contacts()`, `DocumentTypeSetting` (Tabelle `document_types`, PK `type` als String, Relationen `template()`, `introBlock()`, `closingBlock()`), `NumberSequence` (`doc_type`, `year`, `pattern`, `next_value`, `reset_yearly`).
  - `DomainActionException` (abstrakt, `status(): int`), `DocumentLockedException::for(Document $document, array $fields = [])` (409).
  - `Text::t(string $key, array $replace = [], ?string $locale = null): string` (wie `__()`, gibt immer einen String).
  - Factories: `Customer::factory()`, `Contact::factory()`, `Document::factory()->type(DocumentType)->finalized()`, `FieldDefinition::factory()`, `TextBlock::factory()`, `Template::factory()`.

- [ ] **Step 1: Failing tests schreiben**

`tests/Feature/Models/SchemaTest.php`:

```php
<?php

use App\Enums\ComplianceProfile;
use App\Models\Contact;
use App\Models\Customer;
use App\Models\Document;
use App\Models\DocumentTypeSetting;
use App\Models\NumberSequence;
use App\Models\Organization;
use App\Models\TaxRate;
use App\Models\Unit;

it('ships the base master data with a fresh database', function () {
    expect(Organization::query()->count())->toBe(1)
        ->and(Organization::current()->locale)->toBe('en')
        ->and(DocumentTypeSetting::query()->orderBy('type')->pluck('type')->all())->toBe(['cancellation', 'confirmation', 'invoice', 'offer'])
        ->and(DocumentTypeSetting::query()->findOrFail('invoice')->profile)->toBe(ComplianceProfile::Basic)
        ->and(DocumentTypeSetting::query()->findOrFail('invoice')->payment_term_days)->toBe(14)
        ->and(NumberSequence::query()->whereNull('year')->orderBy('doc_type')->pluck('pattern')->all())
        ->toBe(['CN-{YYYY}-{0000}', 'OC-{YYYY}-{0000}', 'INV-{YYYY}-{0000}', 'Q-{YYYY}-{0000}'])
        ->and(TaxRate::query()->orderBy('sort')->pluck('percent')->all())->toBe(['19.00', '7.00', '0.00'])
        ->and(Unit::query()->orderBy('sort')->pluck('code')->all())->toBe(['HUR', 'DAY', 'H87', 'LS', 'KMT', 'MON']);
});

it('uses ULIDs and casts amounts to strings', function () {
    $document = Document::factory()->create(['net_total' => '12.5']);

    expect($document->id)->toHaveLength(26)
        ->and($document->customer_id)->toHaveLength(26)
        ->and($document->fresh()->net_total)->toBe('12.50')
        ->and($document->fresh()->date->toDateString())->toBe(now()->toDateString());
});

it('soft-deletes customers and contacts', function () {
    $customer = Customer::factory()->has(Contact::factory())->create();
    $contact = $customer->contacts()->firstOrFail();

    $contact->delete();
    $customer->delete();

    expect(Customer::withTrashed()->find($customer->id))->not->toBeNull()
        ->and(Customer::query()->find($customer->id))->toBeNull()
        ->and(Contact::withTrashed()->find($contact->id))->not->toBeNull();
});
```

`tests/Feature/Models/DocumentLockTest.php`:

```php
<?php

use App\Enums\DocumentStatus;
use App\Exceptions\DocumentLockedException;
use App\Models\Document;
use App\Models\DocumentSnapshot;
use App\Models\Position;
use App\Models\PositionGroup;

/** A document with one group and one position, then finalized directly on the model. */
function lockedDocument(): Document
{
    $document = Document::factory()->create();
    $group = new PositionGroup;
    $group->forceFill(['document_id' => $document->id, 'title' => null, 'sort' => 0])->save();
    $position = new Position;
    $position->forceFill([
        'document_id' => $document->id, 'group_id' => $group->id, 'kind' => 'item', 'title' => 'Consulting',
        'quantity' => '1', 'unit_price' => '100', 'custom' => [], 'sort' => 0,
    ])->save();
    $document->forceFill(['number' => 'INV-1', 'status' => DocumentStatus::Open, 'finalized_at' => now()])->save();

    return $document->fresh();
}

it('lets a draft change freely', function () {
    $document = Document::factory()->create();
    $document->intro = 'Hello';
    $document->save();

    expect($document->fresh()->intro)->toBe('Hello');
});

it('still allows status, paid_at and cancelled_by_id on a finalized document', function () {
    $document = lockedDocument();
    $document->forceFill(['status' => DocumentStatus::Paid, 'paid_at' => now()])->save();

    expect($document->fresh()->status)->toBe(DocumentStatus::Paid);
});

it('refuses every other change on a finalized document', function () {
    $document = lockedDocument();
    $document->intro = 'changed';

    expect(fn () => $document->save())->toThrow(DocumentLockedException::class)
        ->and($document->fresh()->intro)->not->toBe('changed');
});

it('names the locked fields', function () {
    $document = lockedDocument();
    $document->forceFill(['number' => 'INV-2', 'status' => DocumentStatus::Paid]);

    try {
        $document->save();
        $this->fail('no exception');
    } catch (DocumentLockedException $e) {
        expect($e->fields)->toBe(['number'])
            ->and($e->status())->toBe(409)
            ->and($e->getMessage())->toBe('INV-1 is finalized and can no longer be changed.');
    }
});

it('refuses to delete a finalized document', function () {
    expect(fn () => lockedDocument()->delete())->toThrow(DocumentLockedException::class);
});

it('refuses to change, add or delete positions and groups of a finalized document', function () {
    $document = lockedDocument();
    $position = $document->positions()->firstOrFail();
    $group = $document->groups()->firstOrFail();

    $position->title = 'changed';
    expect(fn () => $position->save())->toThrow(DocumentLockedException::class)
        ->and(fn () => $position->delete())->toThrow(DocumentLockedException::class)
        ->and(fn () => $group->delete())->toThrow(DocumentLockedException::class)
        ->and(fn () => (new PositionGroup)->forceFill(['document_id' => $document->id, 'sort' => 1])->save())->toThrow(DocumentLockedException::class);
});

it('never changes a snapshot once written', function () {
    $snapshot = DocumentSnapshot::query()->create(['document_id' => lockedDocument()->id, 'data' => ['org' => ['name' => 'A']]]);
    $snapshot->data = ['org' => ['name' => 'B']];

    expect(fn () => $snapshot->save())->toThrow(LogicException::class);
});
```

- [ ] **Step 2: Tests laufen lassen, sie müssen scheitern**

Run: `ddev artisan test --filter='SchemaTest|DocumentLockTest'`
Expected: FAIL mit `Class "App\Models\Organization" not found`

- [ ] **Step 3: Migrationen**

`database/migrations/2026_10_11_100000_create_master_data_tables.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('organization', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('name')->default('');
            $table->string('street')->default('');
            $table->string('zip', 32)->default('');
            $table->string('city')->default('');
            $table->string('country', 2)->default('');
            $table->string('logo_path')->nullable();
            $table->string('vat_id', 32)->default('');
            $table->string('tax_number', 32)->default('');
            $table->string('iban', 42)->default('');
            $table->string('bic', 11)->default('');
            $table->string('bank_name')->default('');
            $table->string('email')->default('');
            $table->string('phone', 64)->default('');
            $table->string('website')->default('');
            $table->string('taxation_mode', 16)->default('regular');
            $table->string('locale', 2)->default('en');
            $table->json('custom')->nullable();
            $table->timestamps();
        });

        Schema::create('templates', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('version', 32)->default('1.0.0');
            $table->string('author')->default('');
            $table->string('license', 64)->default('');
            $table->text('description')->nullable();
            $table->boolean('built_in')->default(false);
            $table->json('manifest')->nullable();
            $table->longText('header')->nullable();
            $table->longText('body')->nullable();
            $table->longText('footer')->nullable();
            $table->longText('css')->nullable();
            $table->timestamps();
        });

        Schema::create('template_assets', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('template_id')->constrained()->cascadeOnDelete();
            $table->string('path');
            $table->string('mime', 128);
            $table->string('storage_path');
            $table->unsignedBigInteger('size');
            $table->timestamps();
            $table->unique(['template_id', 'path']);
        });

        Schema::create('text_blocks', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('name');
            $table->string('kind', 16);
            $table->text('body');
            $table->timestamps();
        });

        Schema::create('tax_rates', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('label', 64);
            $table->decimal('percent', 5, 2);
            $table->string('category', 2);
            $table->text('exemption_note')->nullable();
            $table->unsignedInteger('sort')->default(0);
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();
        });

        Schema::create('units', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('name', 64);
            $table->string('symbol', 16)->default('');
            $table->unsignedTinyInteger('decimals')->default(2);
            $table->string('code', 3)->default('');
            $table->unsignedInteger('sort')->default(0);
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();
        });

        Schema::create('field_definitions', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('scope', 16);
            $table->string('key', 64);
            $table->string('label');
            $table->string('type', 16);
            $table->boolean('required')->default(false);
            $table->json('default_value')->nullable();
            $table->text('help')->nullable();
            $table->json('options')->nullable();
            $table->json('doc_types')->nullable();
            $table->unsignedInteger('sort')->default(0);
            $table->timestamps();
            $table->unique(['scope', 'key']);
        });

        Schema::create('document_types', function (Blueprint $table) {
            $table->string('type', 16)->primary();
            $table->string('profile', 16)->default('basic');
            $table->foreignUlid('template_id')->nullable()->constrained('templates')->nullOnDelete();
            $table->foreignUlid('default_intro_block_id')->nullable()->constrained('text_blocks')->nullOnDelete();
            $table->foreignUlid('default_closing_block_id')->nullable()->constrained('text_blocks')->nullOnDelete();
            $table->unsignedSmallInteger('payment_term_days')->nullable();
            $table->unsignedSmallInteger('validity_days')->nullable();
            $table->timestamps();
        });

        // year NULL = configuration row per type (pattern, reset_yearly, running counter without reset);
        // with a yearly reset, one counter row per (doc_type, year)
        Schema::create('number_sequences', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('doc_type', 16);
            $table->unsignedSmallInteger('year')->nullable();
            $table->string('pattern', 64);
            $table->unsignedInteger('next_value')->default(1);
            $table->boolean('reset_yearly')->default(true);
            $table->timestamps();
            $table->unique(['doc_type', 'year']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('number_sequences');
        Schema::dropIfExists('document_types');
        Schema::dropIfExists('field_definitions');
        Schema::dropIfExists('units');
        Schema::dropIfExists('tax_rates');
        Schema::dropIfExists('text_blocks');
        Schema::dropIfExists('template_assets');
        Schema::dropIfExists('templates');
        Schema::dropIfExists('organization');
    }
};
```

`database/migrations/2026_10_11_100100_create_customer_tables.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customers', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('number', 32)->unique();
            $table->string('name');
            $table->string('street')->default('');
            $table->string('zip', 32)->default('');
            $table->string('city')->default('');
            $table->string('country', 2)->default('');
            $table->string('email')->default('');
            $table->string('vat_id', 32)->default('');
            $table->string('tax_treatment', 32)->default('domestic');
            $table->string('locale', 2)->nullable();
            $table->json('custom')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('contacts', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('customer_id')->constrained()->cascadeOnDelete();
            $table->string('salutation', 64)->default('');
            $table->string('first_name')->default('');
            $table->string('last_name')->default('');
            $table->string('position')->default('');
            $table->string('email')->default('');
            $table->string('phone', 64)->default('');
            $table->boolean('is_default')->default(false);
            $table->json('custom')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contacts');
        Schema::dropIfExists('customers');
    }
};
```

`database/migrations/2026_10_11_100200_create_document_tables.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('documents', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('type', 16);
            $table->string('status', 16)->default('draft');
            $table->string('number', 64)->nullable()->unique();
            $table->date('date');
            $table->foreignUlid('customer_id')->nullable()->constrained('customers');
            $table->foreignUlid('contact_id')->nullable()->constrained('contacts');
            $table->date('service_date')->nullable();
            $table->date('service_date_end')->nullable();
            $table->date('due_date')->nullable();
            $table->date('valid_until')->nullable();
            $table->text('intro')->nullable();
            $table->text('closing')->nullable();
            $table->foreignUlid('template_id')->nullable()->constrained('templates');
            $table->string('locale', 2)->default('en');
            $table->json('custom')->nullable();
            $table->ulid('source_id')->nullable();
            $table->ulid('cancelled_by_id')->nullable();
            $table->timestamp('finalized_at')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->decimal('net_total', 15, 2)->default(0);
            $table->decimal('tax_total', 15, 2)->default(0);
            $table->decimal('gross_total', 15, 2)->default(0);
            $table->foreignUlid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->foreign('source_id')->references('id')->on('documents');
            $table->foreign('cancelled_by_id')->references('id')->on('documents');
            $table->index(['type', 'status']);
            $table->index('date');
        });

        Schema::create('position_groups', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('document_id')->constrained()->cascadeOnDelete();
            $table->string('title', 500)->nullable();
            $table->unsignedInteger('sort')->default(0);
            $table->timestamps();
        });

        Schema::create('positions', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('document_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('group_id')->constrained('position_groups')->cascadeOnDelete();
            $table->string('kind', 16);
            $table->string('title', 500)->default('');
            $table->text('description')->nullable();
            $table->decimal('quantity', 15, 4)->default(0);
            $table->foreignUlid('unit_id')->nullable()->constrained('units');
            $table->decimal('unit_price', 15, 4)->default(0);
            $table->foreignUlid('tax_rate_id')->nullable()->constrained('tax_rates');
            $table->json('custom')->nullable();
            $table->unsignedInteger('sort')->default(0);
            $table->timestamps();
        });

        Schema::create('document_snapshots', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('document_id')->unique()->constrained()->cascadeOnDelete();
            $table->json('data');
            $table->timestamps();
        });

        Schema::create('document_files', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('document_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 8);
            $table->string('path');
            $table->char('sha256', 64);
            $table->unsignedBigInteger('size');
            $table->timestamps();
            $table->unique(['document_id', 'kind']);
        });

        // survives DeleteDraft: document_id becomes NULL, the entry stays as protocol
        Schema::create('document_events', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('document_id')->nullable()->constrained()->nullOnDelete();
            $table->string('actor_type', 16);
            $table->string('actor_id', 64)->nullable();
            $table->string('action', 32);
            $table->json('payload')->nullable();
            $table->timestamps();
            $table->index(['document_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_events');
        Schema::dropIfExists('document_files');
        Schema::dropIfExists('document_snapshots');
        Schema::dropIfExists('positions');
        Schema::dropIfExists('position_groups');
        Schema::dropIfExists('documents');
    }
};
```

`database/migrations/2026_10_11_100300_insert_default_master_data.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Base data every instance needs: the organization row, document types, number ranges,
 * tax rates and units. Docker starts only migrate, it never seeds.
 */
return new class extends Migration
{
    public function up(): void
    {
        $now = now();
        $id = fn (): string => strtolower((string) Str::ulid());
        $stamps = ['created_at' => $now, 'updated_at' => $now];

        DB::table('organization')->insert(['id' => $id(), 'taxation_mode' => 'regular', 'locale' => 'en', ...$stamps]);

        foreach ([['19 %', '19.00', 'S'], ['7 %', '7.00', 'S'], ['0 %', '0.00', 'Z']] as $sort => [$label, $percent, $category]) {
            DB::table('tax_rates')->insert(['id' => $id(), 'label' => $label, 'percent' => $percent, 'category' => $category, 'sort' => $sort, ...$stamps]);
        }

        $units = [['Hour', 'h', 2, 'HUR'], ['Day', 'd', 1, 'DAY'], ['Piece', 'pc', 0, 'H87'], ['Flat rate', 'flat', 0, 'LS'], ['Kilometer', 'km', 1, 'KMT'], ['Month', 'mo', 0, 'MON']];
        foreach ($units as $sort => [$name, $symbol, $decimals, $code]) {
            DB::table('units')->insert(['id' => $id(), 'name' => $name, 'symbol' => $symbol, 'decimals' => $decimals, 'code' => $code, 'sort' => $sort, ...$stamps]);
        }

        $types = [
            'offer' => ['Q-{YYYY}-{0000}', null, 30],
            'confirmation' => ['OC-{YYYY}-{0000}', null, null],
            'invoice' => ['INV-{YYYY}-{0000}', 14, null],
            'cancellation' => ['CN-{YYYY}-{0000}', null, null],
        ];
        foreach ($types as $type => [$pattern, $paymentTermDays, $validityDays]) {
            DB::table('document_types')->insert(['type' => $type, 'profile' => 'basic', 'payment_term_days' => $paymentTermDays, 'validity_days' => $validityDays, ...$stamps]);
            DB::table('number_sequences')->insert(['id' => $id(), 'doc_type' => $type, 'year' => null, 'pattern' => $pattern, 'next_value' => 1, 'reset_yearly' => true, ...$stamps]);
        }
    }

    public function down(): void
    {
        DB::table('number_sequences')->delete();
        DB::table('document_types')->delete();
        DB::table('units')->delete();
        DB::table('tax_rates')->delete();
        DB::table('organization')->delete();
    }
};
```

- [ ] **Step 4: Text-Helfer und Exceptions**

`app/Support/Text.php`:

```php
<?php

namespace App\Support;

/** __() that always returns a string (Larastan types __() as string|array). */
final class Text
{
    /**
     * @param  array<string, string|int>  $replace
     */
    public static function t(string $key, array $replace = [], ?string $locale = null): string
    {
        $text = __($key, $replace, $locale);

        return is_string($text) ? $text : $key;
    }
}
```

`app/Exceptions/DomainActionException.php`:

```php
<?php

namespace App\Exceptions;

use RuntimeException;

/** An action refused to run. The API (phase 4) maps status() to Problem Details, MCP (phase 8) to a tool error. */
abstract class DomainActionException extends RuntimeException
{
    abstract public function status(): int;
}
```

`app/Exceptions/DocumentLockedException.php`:

```php
<?php

namespace App\Exceptions;

use App\Models\Document;
use App\Support\Text;

/** Finalized documents are immutable except status, paid_at and cancelled_by_id (GoBD). */
final class DocumentLockedException extends DomainActionException
{
    /**
     * @param  list<string>  $fields  columns that were about to change
     */
    public function __construct(
        public readonly string $documentId,
        public readonly ?string $number,
        public readonly array $fields = [],
    ) {
        parent::__construct(Text::t('errors.document_locked', ['number' => $number ?? $documentId]));
    }

    /**
     * @param  list<string>  $fields
     */
    public static function for(Document $document, array $fields = []): self
    {
        return new self($document->id, $document->getOriginal('number') ?? $document->number, $fields);
    }

    public function status(): int
    {
        return 409;
    }
}
```

In `lang/en.json` den Schlüssel `"errors.document_locked": ":number is finalized and can no longer be changed."` und in `lang/de.json` `"errors.document_locked": ":number ist abgeschlossen und lässt sich nicht mehr ändern."` alphabetisch einsortiert ergänzen (Task 7 ergänzt die übrigen Schlüssel).

- [ ] **Step 5: Models**

`app/Models/Organization.php`:

```php
<?php

namespace App\Models;

use App\Enums\TaxationMode;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

/** The one organization of this instance; its row is created by a migration. */
class Organization extends Model
{
    use HasUlids;

    protected $table = 'organization';

    protected $guarded = ['id'];

    public static function current(): self
    {
        return static::query()->firstOrFail();
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'taxation_mode' => TaxationMode::class,
            'custom' => 'array',
        ];
    }
}
```

`app/Models/Customer.php`:

```php
<?php

namespace App\Models;

use App\Enums\TaxTreatment;
use Database\Factories\CustomerFactory;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Customer extends Model
{
    /** @use HasFactory<CustomerFactory> */
    use HasFactory, HasUlids, SoftDeletes;

    protected $guarded = ['id'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'tax_treatment' => TaxTreatment::class,
            'custom' => 'array',
        ];
    }

    /** @return HasMany<Contact, $this> */
    public function contacts(): HasMany
    {
        return $this->hasMany(Contact::class)->orderByDesc('is_default')->orderBy('last_name');
    }

    /** @return HasMany<Document, $this> */
    public function documents(): HasMany
    {
        return $this->hasMany(Document::class);
    }
}
```

`app/Models/Contact.php`:

```php
<?php

namespace App\Models;

use Database\Factories\ContactFactory;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Contact extends Model
{
    /** @use HasFactory<ContactFactory> */
    use HasFactory, HasUlids, SoftDeletes;

    protected $guarded = ['id'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_default' => 'boolean',
            'custom' => 'array',
        ];
    }

    /** @return BelongsTo<Customer, $this> */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}
```

`app/Models/FieldDefinition.php`:

```php
<?php

namespace App\Models;

use App\Enums\FieldScope;
use App\Enums\FieldType;
use Database\Factories\FieldDefinitionFactory;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FieldDefinition extends Model
{
    /** @use HasFactory<FieldDefinitionFactory> */
    use HasFactory, HasUlids;

    protected $guarded = ['id'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'scope' => FieldScope::class,
            'type' => FieldType::class,
            'required' => 'boolean',
            'default_value' => 'json',
            'options' => 'array',
            'doc_types' => 'array',
            'sort' => 'integer',
        ];
    }
}
```

`app/Models/TaxRate.php`:

```php
<?php

namespace App\Models;

use App\Enums\TaxCategory;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

/** Archived instead of deleted: positions keep referencing it. */
class TaxRate extends Model
{
    use HasUlids;

    protected $guarded = ['id'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'percent' => 'decimal:2',
            'category' => TaxCategory::class,
            'sort' => 'integer',
            'archived_at' => 'immutable_datetime',
        ];
    }
}
```

`app/Models/Unit.php`:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

/** code = UN/ECE Recommendation 20 (HUR, DAY, H87, …). Archived instead of deleted. */
class Unit extends Model
{
    use HasUlids;

    protected $guarded = ['id'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'decimals' => 'integer',
            'sort' => 'integer',
            'archived_at' => 'immutable_datetime',
        ];
    }
}
```

`app/Models/TextBlock.php`:

```php
<?php

namespace App\Models;

use App\Enums\TextBlockKind;
use Database\Factories\TextBlockFactory;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TextBlock extends Model
{
    /** @use HasFactory<TextBlockFactory> */
    use HasFactory, HasUlids;

    protected $guarded = ['id'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return ['kind' => TextBlockKind::class];
    }
}
```

`app/Models/Template.php`:

```php
<?php

namespace App\Models;

use Database\Factories\TemplateFactory;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Liquid template (header, body, footer, css + manifest). Rendering arrives in phase 3. */
class Template extends Model
{
    /** @use HasFactory<TemplateFactory> */
    use HasFactory, HasUlids;

    protected $guarded = ['id'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'built_in' => 'boolean',
            'manifest' => 'array',
        ];
    }

    /** @return HasMany<TemplateAsset, $this> */
    public function assets(): HasMany
    {
        return $this->hasMany(TemplateAsset::class);
    }
}
```

`app/Models/TemplateAsset.php`:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TemplateAsset extends Model
{
    use HasUlids;

    protected $guarded = ['id'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return ['size' => 'integer'];
    }

    /** @return BelongsTo<Template, $this> */
    public function template(): BelongsTo
    {
        return $this->belongsTo(Template::class);
    }
}
```

`app/Models/DocumentTypeSetting.php`:

```php
<?php

namespace App\Models;

use App\Enums\ComplianceProfile;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Row in document_types (primary key = DocumentType value); named *Setting to not clash with the enum. */
class DocumentTypeSetting extends Model
{
    protected $table = 'document_types';

    protected $primaryKey = 'type';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $guarded = ['type'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'profile' => ComplianceProfile::class,
            'payment_term_days' => 'integer',
            'validity_days' => 'integer',
        ];
    }

    /** @return BelongsTo<Template, $this> */
    public function template(): BelongsTo
    {
        return $this->belongsTo(Template::class);
    }

    /** @return BelongsTo<TextBlock, $this> */
    public function introBlock(): BelongsTo
    {
        return $this->belongsTo(TextBlock::class, 'default_intro_block_id');
    }

    /** @return BelongsTo<TextBlock, $this> */
    public function closingBlock(): BelongsTo
    {
        return $this->belongsTo(TextBlock::class, 'default_closing_block_id');
    }
}
```

`app/Models/NumberSequence.php`:

```php
<?php

namespace App\Models;

use App\Enums\DocumentType;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

/** year NULL: configuration of a number range; year set: counter of that year (yearly reset). */
class NumberSequence extends Model
{
    use HasUlids;

    protected $guarded = ['id'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'doc_type' => DocumentType::class,
            'year' => 'integer',
            'next_value' => 'integer',
            'reset_yearly' => 'boolean',
        ];
    }
}
```

`app/Models/Document.php`:

```php
<?php

namespace App\Models;

use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Exceptions\DocumentLockedException;
use Database\Factories\DocumentFactory;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * Offer, order confirmation, invoice or cancellation. From finalized_at on only status, paid_at
 * and cancelled_by_id may change (GoBD); the hooks below enforce that for every model save.
 * Workflows live in app/Actions.
 */
class Document extends Model
{
    /** @use HasFactory<DocumentFactory> */
    use HasFactory, HasUlids;

    /** Columns that may still change after finalizing. */
    public const MUTABLE_WHEN_FINALIZED = ['status', 'paid_at', 'cancelled_by_id', 'updated_at'];

    protected $guarded = ['id'];

    protected static function booted(): void
    {
        static::updating(function (Document $document): void {
            if ($document->getOriginal('finalized_at') === null) {
                return;
            }
            $locked = array_values(array_diff(array_keys($document->getDirty()), self::MUTABLE_WHEN_FINALIZED));
            if ($locked !== []) {
                throw DocumentLockedException::for($document, $locked);
            }
        });

        static::deleting(function (Document $document): void {
            if ($document->getOriginal('finalized_at') !== null) {
                throw DocumentLockedException::for($document);
            }
        });
    }

    /** Guard for groups and positions: throws when their document is finalized. */
    public static function assertDraft(string $id): void
    {
        $document = static::query()->select(['id', 'number', 'finalized_at'])->find($id);
        if ($document !== null && $document->finalized_at !== null) {
            throw DocumentLockedException::for($document);
        }
    }

    public function isFinalized(): bool
    {
        return $this->finalized_at !== null;
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'type' => DocumentType::class,
            'status' => DocumentStatus::class,
            'date' => 'immutable_date:Y-m-d',
            'service_date' => 'immutable_date:Y-m-d',
            'service_date_end' => 'immutable_date:Y-m-d',
            'due_date' => 'immutable_date:Y-m-d',
            'valid_until' => 'immutable_date:Y-m-d',
            'custom' => 'array',
            'finalized_at' => 'immutable_datetime',
            'paid_at' => 'immutable_datetime',
            'net_total' => 'decimal:2',
            'tax_total' => 'decimal:2',
            'gross_total' => 'decimal:2',
        ];
    }

    /** @return BelongsTo<Customer, $this> */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    /** @return BelongsTo<Contact, $this> */
    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }

    /** @return BelongsTo<Template, $this> */
    public function template(): BelongsTo
    {
        return $this->belongsTo(Template::class);
    }

    /** @return BelongsTo<Document, $this> */
    public function source(): BelongsTo
    {
        return $this->belongsTo(Document::class, 'source_id');
    }

    /** @return BelongsTo<Document, $this> */
    public function cancelledBy(): BelongsTo
    {
        return $this->belongsTo(Document::class, 'cancelled_by_id');
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** @return HasMany<PositionGroup, $this> */
    public function groups(): HasMany
    {
        return $this->hasMany(PositionGroup::class)->orderBy('sort');
    }

    /** @return HasMany<Position, $this> */
    public function positions(): HasMany
    {
        return $this->hasMany(Position::class);
    }

    /** @return HasOne<DocumentSnapshot, $this> */
    public function snapshot(): HasOne
    {
        return $this->hasOne(DocumentSnapshot::class);
    }

    /** @return HasMany<DocumentFile, $this> */
    public function files(): HasMany
    {
        return $this->hasMany(DocumentFile::class);
    }

    /** @return HasMany<DocumentEvent, $this> */
    public function events(): HasMany
    {
        // ULIDs are monotonic, so id breaks ties within the same second
        return $this->hasMany(DocumentEvent::class)->orderBy('created_at')->orderBy('id');
    }
}
```

`app/Models/PositionGroup.php`:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** title null = loose positions (no heading, no subtotal). */
class PositionGroup extends Model
{
    use HasUlids;

    protected $guarded = ['id'];

    protected static function booted(): void
    {
        static::saving(function (PositionGroup $group): void {
            Document::assertDraft($group->document_id);
        });
        static::deleting(function (PositionGroup $group): void {
            Document::assertDraft($group->document_id);
        });
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return ['sort' => 'integer'];
    }

    /** @return BelongsTo<Document, $this> */
    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }

    /** @return HasMany<Position, $this> */
    public function positions(): HasMany
    {
        return $this->hasMany(Position::class, 'group_id')->orderBy('sort');
    }
}
```

`app/Models/Position.php`:

```php
<?php

namespace App\Models;

use App\Enums\PositionKind;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Position extends Model
{
    use HasUlids;

    protected $guarded = ['id'];

    protected static function booted(): void
    {
        static::saving(function (Position $position): void {
            Document::assertDraft($position->document_id);
        });
        static::deleting(function (Position $position): void {
            Document::assertDraft($position->document_id);
        });
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'kind' => PositionKind::class,
            'quantity' => 'decimal:4',
            'unit_price' => 'decimal:4',
            'custom' => 'array',
            'sort' => 'integer',
        ];
    }

    /** @return BelongsTo<Document, $this> */
    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }

    /** @return BelongsTo<PositionGroup, $this> */
    public function group(): BelongsTo
    {
        return $this->belongsTo(PositionGroup::class, 'group_id');
    }

    /** @return BelongsTo<Unit, $this> */
    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    /** @return BelongsTo<TaxRate, $this> */
    public function taxRate(): BelongsTo
    {
        return $this->belongsTo(TaxRate::class);
    }
}
```

`app/Models/DocumentSnapshot.php`:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

/** Master data at finalize time (shape: App\Support\SnapshotBuilder). Written once, never changed. */
class DocumentSnapshot extends Model
{
    use HasUlids;

    protected $guarded = ['id'];

    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException('Document snapshots are immutable.'));
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return ['data' => 'array'];
    }

    /** @return BelongsTo<Document, $this> */
    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }
}
```

`app/Models/DocumentFile.php`:

```php
<?php

namespace App\Models;

use App\Enums\DocumentFileKind;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

/** Archived PDF/XML of a finalized document (written in phase 3). Immutable. */
class DocumentFile extends Model
{
    use HasUlids;

    protected $guarded = ['id'];

    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException('Document files are immutable.'));
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'kind' => DocumentFileKind::class,
            'size' => 'integer',
        ];
    }

    /** @return BelongsTo<Document, $this> */
    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }
}
```

`app/Models/DocumentEvent.php`:

```php
<?php

namespace App\Models;

use App\Enums\ActorType;
use App\Enums\EventAction;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

/** Protocol entry; written by App\Support\EventLog, never changed. */
class DocumentEvent extends Model
{
    use HasUlids;

    protected $guarded = ['id'];

    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException('Document events are immutable.'));
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'actor_type' => ActorType::class,
            'action' => EventAction::class,
            'payload' => 'array',
        ];
    }

    /** @return BelongsTo<Document, $this> */
    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }
}
```

Hinweis: `document_events.document_id` wird beim Löschen eines Entwurfs per `ON DELETE SET NULL` von der Datenbank geleert; das ist kein Model-Update und löst den `updating`-Hook nicht aus.

- [ ] **Step 6: Factories**

Nur fiktive Namen (siehe Global Constraints); `safeEmail()` liefert `example.*`-Adressen.

`database/factories/CustomerFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Enums\TaxTreatment;
use App\Models\Customer;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Customer>
 */
class CustomerFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'number' => 'K-'.fake()->unique()->numberBetween(2000, 999999),
            'name' => fake()->randomElement(['Hafenkontor Lindqvist GmbH', 'Fjord Analytics AB', 'Hotel Alpenglück', 'Kulturwerk Elbinsel e. V.']),
            'street' => 'Musterweg 1',
            'zip' => '20457',
            'city' => 'Hamburg',
            'country' => 'DE',
            'email' => fake()->unique()->safeEmail(),
            'vat_id' => '',
            'tax_treatment' => TaxTreatment::Domestic,
            'locale' => null,
            'custom' => [],
        ];
    }
}
```

`database/factories/ContactFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Models\Contact;
use App\Models\Customer;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Contact>
 */
class ContactFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'customer_id' => Customer::factory(),
            'salutation' => '',
            'first_name' => fake()->firstName(),
            'last_name' => fake()->lastName(),
            'position' => '',
            'email' => fake()->unique()->safeEmail(),
            'phone' => '',
            'is_default' => true,
            'custom' => [],
        ];
    }
}
```

`database/factories/DocumentFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Models\Customer;
use App\Models\Document;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Bare document without groups; tests that need positions use the helpers in tests/Pest.php.
 *
 * @extends Factory<Document>
 */
class DocumentFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'type' => DocumentType::Invoice,
            'status' => DocumentStatus::Draft,
            'date' => now()->toDateString(),
            'customer_id' => Customer::factory(),
            'locale' => 'en',
            'intro' => '',
            'closing' => '',
            'custom' => [],
            'net_total' => '0.00',
            'tax_total' => '0.00',
            'gross_total' => '0.00',
        ];
    }

    public function type(DocumentType $type): static
    {
        return $this->state(fn (array $attributes) => ['type' => $type]);
    }

    public function finalized(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => DocumentStatus::Open,
            'number' => 'TEST-'.fake()->unique()->numberBetween(1, 999999),
            'finalized_at' => now(),
        ]);
    }
}
```

`database/factories/FieldDefinitionFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Enums\FieldScope;
use App\Enums\FieldType;
use App\Models\FieldDefinition;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<FieldDefinition>
 */
class FieldDefinitionFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'scope' => FieldScope::Document,
            'key' => 'field_'.fake()->unique()->numberBetween(1, 999999),
            'label' => 'Field',
            'type' => FieldType::Text,
            'required' => false,
            'default_value' => null,
            'help' => '',
            'options' => [],
            'doc_types' => ['offer', 'confirmation', 'invoice', 'cancellation'],
            'sort' => 0,
        ];
    }
}
```

`database/factories/TextBlockFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Enums\TextBlockKind;
use App\Models\TextBlock;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TextBlock>
 */
class TextBlockFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => 'Block '.fake()->unique()->numberBetween(1, 999999),
            'kind' => TextBlockKind::Intro,
            'body' => 'Thank you for your request.',
        ];
    }
}
```

`database/factories/TemplateFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Models\Template;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Template>
 */
class TemplateFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $slug = 'template-'.fake()->unique()->numberBetween(1, 999999);

        return [
            'name' => ucfirst($slug),
            'slug' => $slug,
            'version' => '1.0.0',
            'author' => 'openbill',
            'license' => 'MIT',
            'built_in' => false,
            'manifest' => [],
            'header' => '',
            'body' => '<h1>{{ document.number }}</h1>',
            'footer' => '',
            'css' => '',
        ];
    }
}
```

- [ ] **Step 7: Migrieren und Tests laufen lassen**

```bash
ddev artisan migrate
ddev artisan test --filter='SchemaTest|DocumentLockTest'
```

Expected: Migration läuft mit vier `DONE`-Zeilen; Tests PASS. Falls `immutable_date:Y-m-d` von Larastan nicht als `CarbonImmutable` erkannt wird, meldet Step 8 das; dann im Model einen `@property-read \Carbon\CarbonImmutable $date`-PHPDoc ergänzen.

- [ ] **Step 8: Statische Analyse und volle Suite**

```bash
ddev exec vendor/bin/phpstan analyse --memory-limit=1G
ddev artisan test
```

Expected: `[OK] No errors`; alle Tests PASS (inkl. `TranslationsTest`, weil `errors.document_locked` in beiden Dateien steht).

- [ ] **Step 9: Commit**

```bash
git add database/migrations database/factories app/Models app/Exceptions app/Support/Text.php lang/en.json lang/de.json tests/Feature/Models
git commit -m "feat(models): add data model with ULIDs, defaults and locked finalized documents

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 7: Support-Schicht – Actor, Event-Log, Snapshot, Summen und Prüfung am Model

Verbindet Models und Domain. `SnapshotBuilder` erzeugt die Stammdaten in der Form von `document_snapshots.data`; `DocumentInspector` rechnet für Entwürfe mit diesen aktuellen Daten und für abgeschlossene Dokumente mit dem gespeicherten Snapshot (Port von `documentView.ts`). Dazu die restlichen Exceptions, die Validierungsregel `DecimalString`, der Archiver-Haken für Phase 3 und alle Übersetzungsschlüssel der Phase.

**Files:**
- Create: `app/Support/Actor.php`, `app/Support/EventLog.php`, `app/Support/LegalNoteTexts.php`, `app/Support/FieldErrors.php`, `app/Support/DomainMapper.php`, `app/Support/SnapshotBuilder.php`, `app/Support/DocumentInspector.php`, `app/Support/GroupWriter.php`, `app/Support/NullDocumentArchiver.php`, `app/Contracts/DocumentArchiver.php`, `app/Exceptions/ActionNotAllowedException.php`, `app/Exceptions/ComplianceFailedException.php`, `app/Rules/DecimalString.php`
- Modify: `app/Providers/AppServiceProvider.php`, `lang/en.json`, `lang/de.json`, `tests/Pest.php`, `tests/Unit/TranslationsTest.php`
- Test: `tests/Feature/Support/ActorTest.php`, `tests/Feature/Support/GroupWriterTest.php`, `tests/Feature/Support/DocumentInspectorTest.php`

**Interfaces:**
- Consumes: Domain (Task 2–5), Models/Factories/`Text`/`DocumentLockedException` (Task 6).
- Produces (siehe auch Abschnitt „Interfaces“ oben):
  - `Actor::user(User)`, `Actor::token(string $tokenId, ?string $userId)`, `Actor::system()`; Properties `type`, `id`, `userId`.
  - `EventLog::record(Document $document, Actor $actor, EventAction $action, array $payload = []): DocumentEvent`
  - `LegalNoteTexts::for(string $locale): LegalNotes`
  - `FieldErrors::messages(list<FieldError>): array<string, list<string>>`, `FieldErrors::throwIfAny(list<FieldError>): void` (wirft `ValidationException`)
  - `DomainMapper::groups(Document): list<GroupInput>`, `::position(Position): PositionInput`, `::taxContext(array $sources, LegalNotes): TaxContext`, `::fieldDefinitions(list<array> $rows): list<FieldDefinitionData>`, `::currentFieldDefinitions(): list<FieldDefinitionData>`, `::party(array $row): PartyFacts`, `::complianceInput(Document, array $sources, ComplianceProfile): ComplianceInput`, `::conversionSource(Document): ConversionSource`, `::groupRows(list<GroupInput>): list<array>`
  - `SnapshotBuilder::build(Document): array`, `SnapshotBuilder::fieldDefinitionRows(): list<array<string, mixed>>`
  - `DocumentInspector::sources()`, `::totals()`, `::issues()`, `::applyTotals()`
  - `GroupWriter::replace(Document $document, array $groups): void` – Zeilen `{id?, title, positions: [{id?, kind, title, description, quantity, unit_price, unit_id, tax_rate_id, custom}]}`; eigene IDs bleiben, fremde/unbekannte werden neu vergeben; `sort` = Reihenfolge.
  - `ActionNotAllowedException::{statusTransition(DocumentStatus, DocumentStatus), conversion(DocumentType, DocumentType), duplicateCancellation(), cancellationNeedsInvoice(), cancellationSource(), customerHasFinalizedDocuments()}`, `->reason`, `->status()` = 409
  - `new ComplianceFailedException(list<ComplianceIssue>)`, `->issues`, `->toArray()`, `->status()` = 422
  - `new DecimalString(int $scale = 4)` (Validierungsregel)
  - `App\Contracts\DocumentArchiver` + Bindung auf `NullDocumentArchiver`
  - Test-Helfer in `tests/Pest.php`: `systemActor(): Actor`, `hourUnitId(): string`, `vatRateId(string $percent = '19.00'): string`, `itemRow(string $title = 'Consulting', string $quantity = '1', string $price = '100', array $extra = []): array`, `draftDocument(DocumentType $type = DocumentType::Invoice, array $positions = [], array $attributes = []): Document`

- [ ] **Step 1: Test-Helfer in `tests/Pest.php`**

`tests/Pest.php` komplett ersetzen:

```php
<?php

use App\Enums\DocumentType;
use App\Models\Document;
use App\Models\TaxRate;
use App\Models\Unit;
use App\Support\Actor;
use App\Support\GroupWriter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/*
 * Feature tests boot Laravel and run against the MariaDB database `testing`.
 * Unit tests are plain PHP (domain, architecture, file consistency) and don't boot the app.
 */
pest()->extend(TestCase::class)->use(RefreshDatabase::class)->in('Feature');

function systemActor(): Actor
{
    return Actor::system();
}

/** The "Hour" unit from the default master data. */
function hourUnitId(): string
{
    return (string) Unit::query()->where('code', 'HUR')->value('id');
}

/** A tax rate from the default master data by percent ("19.00", "7.00", "0.00"). */
function vatRateId(string $percent = '19.00'): string
{
    return (string) TaxRate::query()->where('percent', $percent)->value('id');
}

/**
 * A billable position row as actions and GroupWriter take it.
 *
 * @param  array<string, mixed>  $extra
 * @return array<string, mixed>
 */
function itemRow(string $title = 'Consulting', string $quantity = '1', string $price = '100', array $extra = []): array
{
    return [...[
        'kind' => 'item',
        'title' => $title,
        'description' => '',
        'quantity' => $quantity,
        'unit_price' => $price,
        'unit_id' => hourUnitId(),
        'tax_rate_id' => vatRateId(),
        'custom' => [],
    ], ...$extra];
}

/**
 * Draft built directly on the models (no actions, no events): one loose group with $positions.
 *
 * @param  list<array<string, mixed>>  $positions
 * @param  array<string, mixed>  $attributes
 */
function draftDocument(DocumentType $type = DocumentType::Invoice, array $positions = [], array $attributes = []): Document
{
    $document = Document::factory()->type($type)->create($attributes);
    GroupWriter::replace($document, [['title' => null, 'positions' => $positions]]);

    return $document->fresh(['groups.positions']);
}
```

- [ ] **Step 2: Failing tests schreiben**

`tests/Feature/Support/ActorTest.php`:

```php
<?php

use App\Enums\ActorType;
use App\Enums\EventAction;
use App\Models\Document;
use App\Models\User;
use App\Support\Actor;
use App\Support\EventLog;

it('describes users, tokens and the system', function () {
    $user = User::factory()->create();

    expect(Actor::user($user))->toMatchObject(['type' => ActorType::User, 'id' => $user->id, 'userId' => $user->id])
        ->and(Actor::token('42', $user->id))->toMatchObject(['type' => ActorType::Token, 'id' => '42', 'userId' => $user->id])
        ->and(Actor::system())->toMatchObject(['type' => ActorType::System, 'id' => null, 'userId' => null]);
});

it('records who did what on a document', function () {
    $user = User::factory()->create();
    $document = Document::factory()->create();

    EventLog::record($document, Actor::user($user), EventAction::StatusChanged, ['from' => 'open', 'to' => 'paid']);

    $event = $document->events()->firstOrFail();
    expect($event->actor_type)->toBe(ActorType::User)
        ->and($event->actor_id)->toBe($user->id)
        ->and($event->action)->toBe(EventAction::StatusChanged)
        ->and($event->payload)->toBe(['from' => 'open', 'to' => 'paid']);
});

it('binds a no-op archiver until phase 3', function () {
    expect(app(App\Contracts\DocumentArchiver::class))->toBeInstanceOf(App\Support\NullDocumentArchiver::class);
});
```

`tests/Feature/Support/GroupWriterTest.php`:

```php
<?php

use App\Enums\DocumentType;
use App\Support\GroupWriter;

it('writes groups and positions in order', function () {
    $document = draftDocument(DocumentType::Offer);

    GroupWriter::replace($document, [
        ['title' => 'Konzept', 'positions' => [itemRow('Workshop'), itemRow('Wireframes')]],
        ['title' => null, 'positions' => [itemRow('Hosting', '12', '49', ['kind' => 'optional'])]],
    ]);
    $document->load('groups.positions');

    expect($document->groups->pluck('title')->all())->toBe(['Konzept', null])
        ->and($document->groups[0]->positions->pluck('title')->all())->toBe(['Workshop', 'Wireframes'])
        ->and($document->groups[1]->positions[0]->quantity)->toBe('12.0000')
        ->and($document->positions()->count())->toBe(3);
});

it('keeps ids of its own groups and positions and replaces foreign ones', function () {
    $document = draftDocument(DocumentType::Invoice, [itemRow('A')]);
    $other = draftDocument(DocumentType::Invoice, [itemRow('B')]);
    $groupId = $document->groups[0]->id;
    $positionId = $document->groups[0]->positions[0]->id;
    $foreignId = $other->groups[0]->positions[0]->id;

    GroupWriter::replace($document, [['id' => $groupId, 'title' => null, 'positions' => [
        [...itemRow('A2'), 'id' => $positionId],
        [...itemRow('C'), 'id' => $foreignId],
    ]]]);
    $document->load('groups.positions');

    expect($document->groups[0]->id)->toBe($groupId)
        ->and($document->groups[0]->positions[0]->id)->toBe($positionId)
        ->and($document->groups[0]->positions[0]->title)->toBe('A2')
        ->and($document->groups[0]->positions[1]->id)->not->toBe($foreignId)
        ->and($other->positions()->whereKey($foreignId)->exists())->toBeTrue();
});
```

`tests/Feature/Support/DocumentInspectorTest.php`:

```php
<?php

use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\TaxTreatment;
use App\Models\Customer;
use App\Models\FieldDefinition;
use App\Models\Organization;
use App\Models\TaxRate;
use App\Models\Template;
use App\Models\Unit;
use App\Support\DocumentInspector;
use App\Support\SnapshotBuilder;

it('computes draft totals from the current master data', function () {
    $document = draftDocument(DocumentType::Invoice, [itemRow('Consulting', '10', '95')]);
    $totals = app(DocumentInspector::class)->totals($document);

    expect((string) $totals->net)->toBe('950.00')
        ->and((string) $totals->tax)->toBe('180.50')
        ->and((string) $totals->gross)->toBe('1130.50');
});

it('uses the reverse charge note in the document language', function () {
    $customer = Customer::factory()->create(['tax_treatment' => TaxTreatment::EuReverseCharge]);
    $document = draftDocument(DocumentType::Invoice, [itemRow()], ['customer_id' => $customer->id, 'locale' => 'de']);

    expect(app(DocumentInspector::class)->totals($document)->legalNotes)
        ->toBe(['Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge).']);
});

it('puts every master data level into the snapshot', function () {
    $template = Template::factory()->create();
    FieldDefinition::factory()->create(['key' => 'project_name']);
    $document = draftDocument(DocumentType::Invoice, [itemRow()], ['template_id' => $template->id]);

    $data = app(SnapshotBuilder::class)->build($document);

    expect($data)->toHaveKeys(['org', 'customer', 'contact', 'tax_rates', 'units', 'template', 'field_definitions'])
        ->and($data['customer']['id'])->toBe($document->customer_id)
        ->and($data['contact'])->toBeNull()
        ->and($data['org']['taxation_mode'])->toBe('regular')
        ->and($data['tax_rates'][0])->toMatchArray(['label' => '19 %', 'percent' => '19.00', 'category' => 'S', 'archived' => false])
        ->and($data['units'][0])->toMatchArray(['code' => 'HUR'])
        ->and($data['template']['id'])->toBe($template->id)
        ->and($data['field_definitions'][0])->toMatchArray(['key' => 'project_name', 'scope' => 'document']);
});

it('computes finalized documents from their snapshot, not from changed master data', function () {
    $document = draftDocument(DocumentType::Invoice, [itemRow('Consulting', '10', '95')]);
    $data = app(SnapshotBuilder::class)->build($document);
    $document->forceFill(['number' => 'INV-1', 'status' => DocumentStatus::Open, 'finalized_at' => now()])->save();
    $document->snapshot()->create(['data' => $data]);

    TaxRate::query()->whereKey(vatRateId())->update(['percent' => '25.00']);
    Organization::current()->forceFill(['taxation_mode' => 'small_business'])->save();
    Unit::query()->update(['code' => '']);

    $fresh = $document->fresh();
    expect((string) app(DocumentInspector::class)->totals($fresh)->tax)->toBe('180.50')
        ->and(app(DocumentInspector::class)->sources($fresh)['tax_rates'][0]['percent'])->toBe('19.00')
        ->and(app(DocumentInspector::class)->issues($fresh))->toBe([]);
});

it('reports compliance issues of drafts with paths', function () {
    $document = draftDocument(DocumentType::Invoice, [itemRow('Consulting', '1', '100', ['unit_id' => null])], ['customer_id' => null]);

    expect(array_map(fn ($i) => $i->path, app(DocumentInspector::class)->issues($document)))
        ->toBe(['document.customer', 'positions.'.$document->groups[0]->positions[0]->id.'.unit']);
});
```

`tests/Unit/TranslationsTest.php` am Ende ergänzen:

```php
it('has a message for every domain code', function () {
    $root = dirname(__DIR__, 2);
    $keys = fn (string $locale): array => array_keys(json_decode((string) file_get_contents("{$root}/lang/{$locale}.json"), true, flags: JSON_THROW_ON_ERROR));
    $needed = [
        ...array_map(fn ($c) => "compliance.{$c->value}", App\Domain\Compliance\ComplianceRule::cases()),
        ...array_map(fn ($c) => "fields.error.{$c->value}", App\Domain\Fields\FieldErrorCode::cases()),
    ];

    expect(array_values(array_diff($needed, $keys('en'))))->toBe([])
        ->and(array_values(array_diff($needed, $keys('de'))))->toBe([]);
});
```

- [ ] **Step 3: Tests laufen lassen, sie müssen scheitern**

Run: `ddev artisan test --filter='ActorTest|GroupWriterTest|DocumentInspectorTest|TranslationsTest'`
Expected: FAIL mit `Class "App\Support\GroupWriter" not found` (bzw. `Actor`) und fehlenden Schlüsseln `compliance.*` im TranslationsTest.

- [ ] **Step 4: Übersetzungen**

`lang/en.json` komplett ersetzen:

```json
{
    "common.logout": "Log out",
    "compliance.contact_field_missing": "Contact: :label is missing.",
    "compliance.customer_address_incomplete": "Customer: the address is incomplete.",
    "compliance.customer_field_missing": "Customer: :label is missing.",
    "compliance.customer_missing": "Customer is missing.",
    "compliance.customer_vat_id_missing": "Customer: the VAT ID is required for reverse charge.",
    "compliance.date_missing": "Date is missing.",
    "compliance.document_field_missing": ":label is missing.",
    "compliance.due_date_missing": "Due date is missing.",
    "compliance.failed": "Required information is missing (:count).",
    "compliance.no_items": "At least one billable item is required.",
    "compliance.org_address_missing": "Organization: name and full address are missing.",
    "compliance.org_field_missing": "Organization: :label is missing.",
    "compliance.org_iban_missing": "Organization: IBAN is missing.",
    "compliance.org_tax_id_missing": "Organization: VAT ID or tax number is missing.",
    "compliance.position_field_missing": "“:title”: :label is missing.",
    "compliance.position_title_missing": "A position has no title.",
    "compliance.quantity_zero": "“:title”: the quantity must not be 0.",
    "compliance.service_date_missing": "Service date is missing.",
    "compliance.tax_rate_missing": "“:title”: tax rate is missing.",
    "compliance.unit_code_missing": "“:title”: the unit has no e-invoice code.",
    "compliance.unit_missing": "“:title”: unit is missing.",
    "errors.cancellation_needs_invoice": "Cancellations are created from an invoice.",
    "errors.cancellation_source": "The invoice of this cancellation is not open or paid, or it is already cancelled.",
    "errors.contact_not_of_customer": "This contact does not belong to the selected customer.",
    "errors.conversion": "This conversion is not possible in the current status.",
    "errors.customer_has_finalized_documents": "The customer has finalized documents and cannot be deleted.",
    "errors.decimal": "Enter a number as a string with a dot and at most :scale decimals, e.g. \"12.50\".",
    "errors.document_locked": ":number is finalized and can no longer be changed.",
    "errors.duplicate_cancellation": "Cancellations cannot be duplicated.",
    "errors.number_pattern_year": "With a yearly reset the pattern needs {YYYY} or {YY}.",
    "errors.optional_only_offers": "Optional positions are only allowed in offers.",
    "errors.percent_range": "The rate must be between 0 and 100.",
    "errors.status_transition": "This status change is not possible.",
    "fields.error.doc_types_missing": "Choose at least one document type.",
    "fields.error.key_invalid": "The key may only contain lowercase letters, digits and _ and must start with a letter.",
    "fields.error.key_reserved": "“:key” is a core field and therefore reserved.",
    "fields.error.key_taken": "The key “:key” is already used on this level.",
    "fields.error.label_missing": "Label is missing.",
    "fields.error.not_boolean": ":label must be yes or no.",
    "fields.error.not_date": ":label must be a date (YYYY-MM-DD).",
    "fields.error.not_image": ":label must be an image path.",
    "fields.error.not_money": ":label must be an amount as a string with at most 2 decimals, e.g. \"12.50\".",
    "fields.error.not_number": ":label must be a number as a string, e.g. \"12.5\".",
    "fields.error.not_option": ":label must be one of: :options.",
    "fields.error.not_text": ":label must be text.",
    "fields.error.options_missing": "Select fields need at least one option.",
    "fields.error.required": ":label is required.",
    "fields.error.too_long": ":label is too long.",
    "fields.error.unknown": "There is no custom field “:key” here.",
    "home.placeholder": "Documents, customers and templates will show up here.",
    "home.signed_in_as": "Signed in as :name.",
    "home.title": "Overview",
    "legal.reverse_charge": "Reverse charge: the recipient of the service is liable for VAT.",
    "legal.small_business": "No VAT is charged under § 19 UStG.",
    "legal.third_country": "Service not taxable in Germany.",
    "locale.de": "Deutsch",
    "locale.en": "English",
    "locale.switch": "Language",
    "login.email": "Email",
    "login.failed": "Email or password is incorrect.",
    "login.password": "Password",
    "login.remember": "Keep me signed in",
    "login.submit": "Log in",
    "login.throttled": "Too many login attempts. Please try again in :seconds seconds.",
    "login.title": "Log in"
}
```

`lang/de.json` komplett ersetzen:

```json
{
    "common.logout": "Abmelden",
    "compliance.contact_field_missing": "Ansprechpartner: :label fehlt.",
    "compliance.customer_address_incomplete": "Kunde: Die Adresse ist unvollständig.",
    "compliance.customer_field_missing": "Kunde: :label fehlt.",
    "compliance.customer_missing": "Kunde fehlt.",
    "compliance.customer_vat_id_missing": "Kunde: Bei Reverse Charge ist die USt-ID Pflicht.",
    "compliance.date_missing": "Datum fehlt.",
    "compliance.document_field_missing": ":label fehlt.",
    "compliance.due_date_missing": "Fälligkeit fehlt.",
    "compliance.failed": "Pflichtangaben fehlen (:count).",
    "compliance.no_items": "Mindestens eine Leistung ist nötig.",
    "compliance.org_address_missing": "Organisation: Name und vollständige Adresse fehlen.",
    "compliance.org_field_missing": "Organisation: :label fehlt.",
    "compliance.org_iban_missing": "Organisation: IBAN fehlt.",
    "compliance.org_tax_id_missing": "Organisation: USt-ID oder Steuernummer fehlt.",
    "compliance.position_field_missing": "„:title“: :label fehlt.",
    "compliance.position_title_missing": "Eine Position hat keine Bezeichnung.",
    "compliance.quantity_zero": "„:title“: Die Menge darf nicht 0 sein.",
    "compliance.service_date_missing": "Leistungsdatum fehlt.",
    "compliance.tax_rate_missing": "„:title“: Steuersatz fehlt.",
    "compliance.unit_code_missing": "„:title“: Die Einheit hat keinen E-Rechnungs-Code.",
    "compliance.unit_missing": "„:title“: Einheit fehlt.",
    "errors.cancellation_needs_invoice": "Stornos entstehen nur aus einer Rechnung.",
    "errors.cancellation_source": "Die Rechnung zu diesem Storno ist nicht offen oder bezahlt oder schon storniert.",
    "errors.contact_not_of_customer": "Dieser Ansprechpartner gehört nicht zum gewählten Kunden.",
    "errors.conversion": "Diese Umwandlung ist im aktuellen Status nicht möglich.",
    "errors.customer_has_finalized_documents": "Der Kunde hat abgeschlossene Dokumente und kann nicht gelöscht werden.",
    "errors.decimal": "Bitte eine Zahl als Text mit Punkt und höchstens :scale Nachkommastellen angeben, z. B. \"12.50\".",
    "errors.document_locked": ":number ist abgeschlossen und lässt sich nicht mehr ändern.",
    "errors.duplicate_cancellation": "Stornos lassen sich nicht duplizieren.",
    "errors.number_pattern_year": "Bei jährlichem Zurücksetzen braucht das Muster {YYYY} oder {YY}.",
    "errors.optional_only_offers": "Optionale Positionen gibt es nur in Angeboten.",
    "errors.percent_range": "Der Satz muss zwischen 0 und 100 liegen.",
    "errors.status_transition": "Dieser Statuswechsel ist nicht möglich.",
    "fields.error.doc_types_missing": "Wähle mindestens einen Dokumenttyp.",
    "fields.error.key_invalid": "Der Schlüssel darf nur Kleinbuchstaben, Ziffern und _ enthalten und muss mit einem Buchstaben beginnen.",
    "fields.error.key_reserved": "„:key“ ist ein Kernfeld und deshalb reserviert.",
    "fields.error.key_taken": "Der Schlüssel „:key“ ist auf dieser Ebene schon vergeben.",
    "fields.error.label_missing": "Bezeichnung fehlt.",
    "fields.error.not_boolean": ":label muss Ja oder Nein sein.",
    "fields.error.not_date": ":label muss ein Datum sein (JJJJ-MM-TT).",
    "fields.error.not_image": ":label muss ein Bildpfad sein.",
    "fields.error.not_money": ":label muss ein Betrag als Text mit höchstens 2 Nachkommastellen sein, z. B. \"12.50\".",
    "fields.error.not_number": ":label muss eine Zahl als Text sein, z. B. \"12.5\".",
    "fields.error.not_option": ":label muss eins davon sein: :options.",
    "fields.error.not_text": ":label muss Text sein.",
    "fields.error.options_missing": "Auswahlfelder brauchen mindestens eine Option.",
    "fields.error.required": ":label ist Pflicht.",
    "fields.error.too_long": ":label ist zu lang.",
    "fields.error.unknown": "Hier gibt es kein eigenes Feld „:key“.",
    "home.placeholder": "Hier erscheinen bald Dokumente, Kunden und Templates.",
    "home.signed_in_as": "Angemeldet als :name.",
    "home.title": "Übersicht",
    "legal.reverse_charge": "Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge).",
    "legal.small_business": "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.",
    "legal.third_country": "Nicht im Inland steuerbare Leistung.",
    "locale.de": "Deutsch",
    "locale.en": "English",
    "locale.switch": "Sprache",
    "login.email": "E-Mail",
    "login.failed": "E-Mail oder Passwort stimmen nicht.",
    "login.password": "Passwort",
    "login.remember": "Angemeldet bleiben",
    "login.submit": "Anmelden",
    "login.throttled": "Zu viele Anmeldeversuche. Bitte in :seconds Sekunden erneut versuchen.",
    "login.title": "Anmelden"
}
```

- [ ] **Step 5: Actor, Event-Log, Texte, Fehler**

`app/Support/Actor.php`:

```php
<?php

namespace App\Support;

use App\Enums\ActorType;
use App\Models\User;

/** Who runs an action; written to document_events. Phase 4/8 build it from the Sanctum token. */
final readonly class Actor
{
    private function __construct(
        public ActorType $type,
        public ?string $id,
        public ?string $userId,
    ) {}

    public static function user(User $user): self
    {
        return new self(ActorType::User, $user->id, $user->id);
    }

    public static function token(string $tokenId, ?string $userId): self
    {
        return new self(ActorType::Token, $tokenId, $userId);
    }

    /** Console commands and seeders. */
    public static function system(): self
    {
        return new self(ActorType::System, null, null);
    }
}
```

`app/Support/EventLog.php`:

```php
<?php

namespace App\Support;

use App\Enums\EventAction;
use App\Models\Document;
use App\Models\DocumentEvent;

final class EventLog
{
    /**
     * @param  array<string, mixed>  $payload
     */
    public static function record(Document $document, Actor $actor, EventAction $action, array $payload = []): DocumentEvent
    {
        return $document->events()->create([
            'actor_type' => $actor->type,
            'actor_id' => $actor->id,
            'action' => $action,
            'payload' => $payload,
        ]);
    }
}
```

`app/Support/LegalNoteTexts.php`:

```php
<?php

namespace App\Support;

use App\Domain\Tax\LegalNotes;

final class LegalNoteTexts
{
    public static function for(string $locale): LegalNotes
    {
        return new LegalNotes(
            Text::t('legal.small_business', [], $locale),
            Text::t('legal.reverse_charge', [], $locale),
            Text::t('legal.third_country', [], $locale),
        );
    }
}
```

`app/Support/FieldErrors.php`:

```php
<?php

namespace App\Support;

use App\Domain\Fields\FieldError;
use Illuminate\Validation\ValidationException;

/** Domain field errors → Laravel validation errors with the same dot paths. */
final class FieldErrors
{
    /**
     * @param  list<FieldError>  $errors
     * @return array<string, list<string>>
     */
    public static function messages(array $errors): array
    {
        $messages = [];
        foreach ($errors as $error) {
            $messages[$error->path][] = Text::t('fields.error.'.$error->code->value, $error->params);
        }

        return $messages;
    }

    /**
     * @param  list<FieldError>  $errors
     *
     * @throws ValidationException
     */
    public static function throwIfAny(array $errors): void
    {
        if ($errors !== []) {
            throw ValidationException::withMessages(self::messages($errors));
        }
    }
}
```

`app/Exceptions/ActionNotAllowedException.php`:

```php
<?php

namespace App\Exceptions;

use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Support\Text;

/** The action contradicts the document lifecycle (409). $reason is stable for API/MCP clients. */
final class ActionNotAllowedException extends DomainActionException
{
    private function __construct(public readonly string $reason, string $message)
    {
        parent::__construct($message);
    }

    public static function statusTransition(DocumentStatus $from, DocumentStatus $to): self
    {
        return new self('status_transition', Text::t('errors.status_transition', ['from' => $from->value, 'to' => $to->value]));
    }

    public static function conversion(DocumentType $from, DocumentType $to): self
    {
        return new self('conversion', Text::t('errors.conversion', ['from' => $from->value, 'to' => $to->value]));
    }

    public static function duplicateCancellation(): self
    {
        return new self('duplicate_cancellation', Text::t('errors.duplicate_cancellation'));
    }

    public static function cancellationNeedsInvoice(): self
    {
        return new self('cancellation_needs_invoice', Text::t('errors.cancellation_needs_invoice'));
    }

    public static function cancellationSource(): self
    {
        return new self('cancellation_source', Text::t('errors.cancellation_source'));
    }

    public static function customerHasFinalizedDocuments(): self
    {
        return new self('customer_has_finalized_documents', Text::t('errors.customer_has_finalized_documents'));
    }

    public function status(): int
    {
        return 409;
    }
}
```

`app/Exceptions/ComplianceFailedException.php`:

```php
<?php

namespace App\Exceptions;

use App\Domain\Compliance\ComplianceIssue;
use App\Support\Text;

/** Finalizing stopped because the profile check is not green (422 with the issue list). */
final class ComplianceFailedException extends DomainActionException
{
    /**
     * @param  list<ComplianceIssue>  $issues
     */
    public function __construct(public readonly array $issues)
    {
        parent::__construct(Text::t('compliance.failed', ['count' => count($issues)]));
    }

    /**
     * @return list<array{path: string, message: string}>
     */
    public function toArray(): array
    {
        return array_map(fn (ComplianceIssue $issue): array => [
            'path' => $issue->path,
            'message' => Text::t('compliance.'.$issue->rule->value, $issue->params),
        ], $this->issues);
    }

    public function status(): int
    {
        return 422;
    }
}
```

`app/Rules/DecimalString.php`:

```php
<?php

namespace App\Rules;

use App\Domain\Money\Decimal;
use App\Support\Text;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/** Amounts and quantities: int or dot-decimal string, never a float. */
final class DecimalString implements ValidationRule
{
    public function __construct(private readonly int $scale = 4) {}

    /**
     * @param  Closure(string, ?string=): \Illuminate\Translation\PotentiallyTranslatedString  $fail
     */
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! Decimal::isValid($value, $this->scale)) {
            $fail(Text::t('errors.decimal', ['scale' => $this->scale]));
        }
    }
}
```

- [ ] **Step 6: Archiver-Haken**

`app/Contracts/DocumentArchiver.php`:

```php
<?php

namespace App\Contracts;

use App\Models\Document;
use App\Models\DocumentSnapshot;

interface DocumentArchiver
{
    /**
     * Runs inside FinalizeDocument's transaction after number, status and snapshot are set and before
     * the "finalized" event. Throwing rolls everything back: the document stays a draft and the number
     * stays free. Phase 3 renders the PDF (and the e-invoice XML) here and writes document_files.
     */
    public function archive(Document $document, DocumentSnapshot $snapshot): void;
}
```

`app/Support/NullDocumentArchiver.php`:

```php
<?php

namespace App\Support;

use App\Contracts\DocumentArchiver;
use App\Models\Document;
use App\Models\DocumentSnapshot;

/** Phase 2: nothing to archive yet (no PDF). Replaced by the real archiver in phase 3. */
final class NullDocumentArchiver implements DocumentArchiver
{
    public function archive(Document $document, DocumentSnapshot $snapshot): void {}
}
```

In `app/Providers/AppServiceProvider.php` die Methode `register()` ersetzen und die Imports ergänzen:

```php
use App\Contracts\DocumentArchiver;
use App\Support\NullDocumentArchiver;
```

```php
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // phase 3 binds the PDF/XML archiver here
        $this->app->bind(DocumentArchiver::class, NullDocumentArchiver::class);
    }
```

- [ ] **Step 7: Snapshot, Mapper, Inspector, GroupWriter**

`app/Support/SnapshotBuilder.php`:

```php
<?php

namespace App\Support;

use App\Models\Contact;
use App\Models\Customer;
use App\Models\Document;
use App\Models\FieldDefinition;
use App\Models\Organization;
use App\Models\TaxRate;
use App\Models\Template;
use App\Models\Unit;

/**
 * Master data a document depends on, in the shape stored in document_snapshots.data.
 * Drafts are computed from build() (live data), finalized documents from their stored snapshot.
 */
final class SnapshotBuilder
{
    /**
     * @return array<string, mixed>
     */
    public function build(Document $document): array
    {
        $org = Organization::current();
        $customer = $document->customer_id === null ? null : Customer::withTrashed()->find($document->customer_id);
        $contact = $document->contact_id === null ? null : Contact::withTrashed()->find($document->contact_id);
        $template = $document->template_id === null ? null : Template::query()->find($document->template_id);

        return [
            'org' => [
                ...$org->only(['name', 'street', 'zip', 'city', 'country', 'logo_path', 'vat_id', 'tax_number', 'iban', 'bic', 'bank_name', 'email', 'phone', 'website', 'locale']),
                'taxation_mode' => $org->taxation_mode->value,
                'custom' => $org->custom ?? [],
            ],
            'customer' => $customer === null ? null : [
                ...$customer->only(['id', 'number', 'name', 'street', 'zip', 'city', 'country', 'email', 'vat_id', 'locale']),
                'tax_treatment' => $customer->tax_treatment->value,
                'custom' => $customer->custom ?? [],
            ],
            'contact' => $contact === null ? null : [
                ...$contact->only(['id', 'salutation', 'first_name', 'last_name', 'position', 'email', 'phone']),
                'custom' => $contact->custom ?? [],
            ],
            'tax_rates' => TaxRate::query()->orderBy('sort')->get()->map(fn (TaxRate $rate): array => [
                'id' => $rate->id,
                'label' => $rate->label,
                'percent' => $rate->percent,
                'category' => $rate->category->value,
                'exemption_note' => $rate->exemption_note,
                'archived' => $rate->archived_at !== null,
            ])->values()->all(),
            'units' => Unit::query()->orderBy('sort')->get()->map(fn (Unit $unit): array => [
                'id' => $unit->id,
                'name' => $unit->name,
                'symbol' => $unit->symbol,
                'decimals' => $unit->decimals,
                'code' => $unit->code,
                'archived' => $unit->archived_at !== null,
            ])->values()->all(),
            'template' => $template === null ? null : [
                ...$template->only(['id', 'name', 'slug', 'version', 'header', 'body', 'footer', 'css']),
                'manifest' => $template->manifest ?? [],
            ],
            'field_definitions' => self::fieldDefinitionRows(),
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function fieldDefinitionRows(): array
    {
        return FieldDefinition::query()->orderBy('sort')->orderBy('label')->get()->map(fn (FieldDefinition $d): array => [
            'id' => $d->id,
            'scope' => $d->scope->value,
            'key' => $d->key,
            'label' => $d->label,
            'type' => $d->type->value,
            'required' => $d->required,
            'default_value' => $d->default_value,
            'help' => $d->help ?? '',
            'options' => $d->options ?? [],
            'doc_types' => $d->doc_types ?? [],
        ])->values()->all();
    }
}
```

`app/Support/DomainMapper.php`:

```php
<?php

namespace App\Support;

use App\Domain\Compliance\ComplianceInput;
use App\Domain\Compliance\PartyFacts;
use App\Domain\Conversion\ConversionSource;
use App\Domain\Fields\FieldDefinitionData;
use App\Domain\Money\Decimal;
use App\Domain\Tax\LegalNotes;
use App\Domain\Tax\TaxContext;
use App\Domain\Tax\TaxRateData;
use App\Domain\Totals\GroupInput;
use App\Domain\Totals\PositionInput;
use App\Enums\ComplianceProfile;
use App\Enums\DocumentType;
use App\Enums\FieldScope;
use App\Enums\FieldType;
use App\Enums\TaxationMode;
use App\Enums\TaxCategory;
use App\Enums\TaxTreatment;
use App\Models\Document;
use App\Models\Position;
use App\Models\PositionGroup;

/** Models and snapshot arrays → domain input objects (and back for position rows). */
final class DomainMapper
{
    /** @return list<GroupInput> */
    public static function groups(Document $document): array
    {
        return $document->groups->map(fn (PositionGroup $group): GroupInput => new GroupInput(
            $group->id,
            $group->title,
            $group->positions->map(fn (Position $p): PositionInput => self::position($p))->values()->all(),
        ))->values()->all();
    }

    public static function position(Position $position): PositionInput
    {
        return new PositionInput(
            id: $position->id,
            kind: $position->kind,
            title: $position->title,
            quantity: Decimal::of($position->quantity),
            unitPrice: Decimal::of($position->unit_price),
            unitId: $position->unit_id,
            taxRateId: $position->tax_rate_id,
            custom: $position->custom ?? [],
            description: $position->description ?? '',
        );
    }

    /**
     * @param  array<string, mixed>  $sources  snapshot-shaped (SnapshotBuilder)
     */
    public static function taxContext(array $sources, LegalNotes $notes): TaxContext
    {
        $rates = array_map(fn (array $r): TaxRateData => new TaxRateData(
            $r['id'],
            Decimal::of($r['percent']),
            TaxCategory::from($r['category']),
            $r['exemption_note'] ?? null,
        ), $sources['tax_rates']);

        return new TaxContext(
            array_values($rates),
            TaxationMode::from($sources['org']['taxation_mode']),
            TaxTreatment::from($sources['customer']['tax_treatment'] ?? TaxTreatment::Domestic->value),
            $notes,
        );
    }

    /**
     * @param  list<array<string, mixed>>  $rows  SnapshotBuilder::fieldDefinitionRows() shape
     * @return list<FieldDefinitionData>
     */
    public static function fieldDefinitions(array $rows): array
    {
        return array_values(array_map(fn (array $row): FieldDefinitionData => new FieldDefinitionData(
            scope: FieldScope::from($row['scope']),
            key: $row['key'],
            label: $row['label'],
            type: FieldType::from($row['type']),
            required: (bool) $row['required'],
            defaultValue: $row['default_value'] ?? null,
            options: array_values($row['options'] ?? []),
            docTypes: array_values(array_map(fn (string $t): DocumentType => DocumentType::from($t), $row['doc_types'] ?? [])),
            id: $row['id'] ?? null,
        ), $rows));
    }

    /** @return list<FieldDefinitionData> */
    public static function currentFieldDefinitions(): array
    {
        return self::fieldDefinitions(SnapshotBuilder::fieldDefinitionRows());
    }

    /**
     * @param  array<string, mixed>  $row  "org" or "customer" from a snapshot
     */
    public static function party(array $row): PartyFacts
    {
        return new PartyFacts(
            name: (string) ($row['name'] ?? ''),
            street: (string) ($row['street'] ?? ''),
            zip: (string) ($row['zip'] ?? ''),
            city: (string) ($row['city'] ?? ''),
            country: (string) ($row['country'] ?? ''),
            vatId: (string) ($row['vat_id'] ?? ''),
            taxNumber: (string) ($row['tax_number'] ?? ''),
            iban: (string) ($row['iban'] ?? ''),
            custom: $row['custom'] ?? [],
            taxTreatment: isset($row['tax_treatment']) ? TaxTreatment::from($row['tax_treatment']) : null,
        );
    }

    /**
     * @param  array<string, mixed>  $sources
     */
    public static function complianceInput(Document $document, array $sources, ComplianceProfile $profile): ComplianceInput
    {
        return new ComplianceInput(
            type: $document->type,
            profile: $profile,
            taxationMode: TaxationMode::from($sources['org']['taxation_mode']),
            date: $document->date->toDateString(),
            serviceDate: $document->service_date?->toDateString(),
            dueDate: $document->due_date?->toDateString(),
            custom: $document->custom ?? [],
            groups: self::groups($document),
            org: self::party($sources['org']),
            customer: $sources['customer'] === null ? null : self::party($sources['customer']),
            contactCustom: $sources['contact'] === null ? null : ($sources['contact']['custom'] ?? []),
            unitCodes: array_column($sources['units'], 'code', 'id'),
            taxRateIds: array_values(array_column($sources['tax_rates'], 'id')),
            fieldDefinitions: self::fieldDefinitions($sources['field_definitions']),
        );
    }

    public static function conversionSource(Document $document): ConversionSource
    {
        return new ConversionSource(
            type: $document->type,
            status: $document->status,
            alreadyCancelled: $document->cancelled_by_id !== null,
            serviceDate: $document->service_date?->toDateString(),
            serviceDateEnd: $document->service_date_end?->toDateString(),
            custom: $document->custom ?? [],
            groups: self::groups($document),
        );
    }

    /**
     * Rows for GroupWriter::replace(); ids are left out so the new document gets fresh ones.
     *
     * @param  list<GroupInput>  $groups
     * @return list<array<string, mixed>>
     */
    public static function groupRows(array $groups): array
    {
        return array_map(fn (GroupInput $group): array => [
            'title' => $group->title,
            'positions' => array_map(fn (PositionInput $p): array => [
                'kind' => $p->kind->value,
                'title' => $p->title,
                'description' => $p->description,
                'quantity' => (string) $p->quantity,
                'unit_price' => (string) $p->unitPrice,
                'unit_id' => $p->unitId,
                'tax_rate_id' => $p->taxRateId,
                'custom' => $p->custom,
            ], $group->positions),
        ], $groups);
    }
}
```

`app/Support/DocumentInspector.php`:

```php
<?php

namespace App\Support;

use App\Domain\Compliance\ComplianceChecker;
use App\Domain\Compliance\ComplianceIssue;
use App\Domain\Totals\Totals;
use App\Domain\Totals\TotalsCalculator;
use App\Models\Document;
use App\Models\DocumentTypeSetting;

/** Totals and compliance of a document: drafts with live master data, finalized ones with their snapshot. */
final class DocumentInspector
{
    public function __construct(private readonly SnapshotBuilder $snapshots) {}

    /**
     * @return array<string, mixed>
     */
    public function sources(Document $document): array
    {
        if ($document->isFinalized() && $document->snapshot !== null) {
            return $document->snapshot->data;
        }

        return $this->snapshots->build($document);
    }

    /**
     * @param  array<string, mixed>|null  $sources  pass the snapshot data when it was built already
     */
    public function totals(Document $document, ?array $sources = null): Totals
    {
        $sources ??= $this->sources($document);
        $document->loadMissing('groups.positions');

        return TotalsCalculator::calculate(
            DomainMapper::groups($document),
            DomainMapper::taxContext($sources, LegalNoteTexts::for($document->locale)),
        );
    }

    /**
     * Issues that block finalizing. A finalized document has none (unless $sources is given).
     *
     * @param  array<string, mixed>|null  $sources
     * @return list<ComplianceIssue>
     */
    public function issues(Document $document, ?array $sources = null): array
    {
        if ($sources === null && $document->isFinalized()) {
            return [];
        }
        $sources ??= $this->sources($document);
        $document->loadMissing('groups.positions');
        $profile = DocumentTypeSetting::query()->findOrFail($document->type->value)->profile;

        return ComplianceChecker::check(DomainMapper::complianceInput($document, $sources, $profile));
    }

    /** Copies the totals into the model's stored columns (not saved). */
    public function applyTotals(Document $document, Totals $totals): void
    {
        $document->forceFill([
            'net_total' => (string) $totals->net,
            'tax_total' => (string) $totals->tax,
            'gross_total' => (string) $totals->gross,
        ]);
    }
}
```

`app/Support/GroupWriter.php`:

```php
<?php

namespace App\Support;

use App\Models\Document;
use App\Models\Position;
use App\Models\PositionGroup;

/**
 * Replaces all groups and positions of a draft. Ids that already belong to this document are kept
 * (stable keys for the editor's autosave), all others get new ULIDs. The model hooks refuse finalized documents.
 */
final class GroupWriter
{
    /**
     * @param  list<array<string, mixed>>  $groups
     */
    public static function replace(Document $document, array $groups): void
    {
        Document::assertDraft($document->id);
        $ownGroups = $document->groups()->pluck('id')->all();
        $ownPositions = $document->positions()->pluck('id')->all();

        $document->positions()->delete();
        $document->groups()->delete();

        foreach (array_values($groups) as $groupIndex => $row) {
            $group = new PositionGroup;
            $group->forceFill([
                'id' => self::keep($row['id'] ?? null, $ownGroups),
                'document_id' => $document->id,
                'title' => $row['title'] ?? null,
                'sort' => $groupIndex,
            ])->save();

            foreach (array_values($row['positions'] ?? []) as $positionIndex => $p) {
                (new Position)->forceFill([
                    'id' => self::keep($p['id'] ?? null, $ownPositions),
                    'document_id' => $document->id,
                    'group_id' => $group->id,
                    'kind' => $p['kind'],
                    'title' => (string) ($p['title'] ?? ''),
                    'description' => $p['description'] ?? null,
                    'quantity' => (string) ($p['quantity'] ?? '0'),
                    'unit_id' => $p['unit_id'] ?? null,
                    'unit_price' => (string) ($p['unit_price'] ?? '0'),
                    'tax_rate_id' => $p['tax_rate_id'] ?? null,
                    'custom' => $p['custom'] ?? [],
                    'sort' => $positionIndex,
                ])->save();
            }
        }

        $document->unsetRelation('groups')->unsetRelation('positions');
    }

    /**
     * @param  array<int, mixed>  $own
     */
    private static function keep(mixed $id, array $own): ?string
    {
        return is_string($id) && in_array($id, $own, true) ? $id : null;
    }
}
```

`HasUlids` vergibt eine neue ULID, wenn `id` beim Anlegen leer (`null`) ist; geprüft in `vendor/laravel/framework/src/Illuminate/Database/Eloquent/Concerns/HasUniqueIds.php` (`setUniqueIds`: `if (empty($this->{$column}))`).

- [ ] **Step 8: Tests laufen lassen**

Run: `ddev artisan test --filter='ActorTest|GroupWriterTest|DocumentInspectorTest|TranslationsTest'`
Expected: PASS

- [ ] **Step 9: Volle Suite und statische Analyse**

```bash
ddev artisan test
ddev exec vendor/bin/phpstan analyse --memory-limit=1G
ddev exec vendor/bin/pint --test
```

Expected: alles grün. Meldet Larastan in `DomainMapper` Zugriffe auf `mixed`, sind das Level-9-Meldungen und dürfen bei Level 6 nicht auftreten; tauchen dennoch Fehler zu `array_column`/`array_map` auf, die Snapshot-Zugriffe mit `/** @var list<array<string, mixed>> $rates */` typisieren statt Casts einzubauen.

- [ ] **Step 10: Commit**

```bash
git add app/Support app/Contracts app/Exceptions app/Rules app/Providers/AppServiceProvider.php lang tests/Pest.php tests/Unit/TranslationsTest.php tests/Feature/Support
git commit -m "feat(support): add actor, event log, snapshot builder, document inspector and archiver hook

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 8: Actions für Kunden und eigene Felder

Port von `customers.ts` (`saveCustomer`, `deleteCustomer`) und `settings.ts` (`saveFieldDef`, `deleteFieldDef`). Pflichtfelder von Kunden und Ansprechpartnern werden beim Speichern erzwungen (bei Dokumenten erst beim Abschließen). `DeleteCustomer` braucht `DeleteDraft` aus Task 10; deshalb liefert dieser Task `DeleteDraft` gleich mit (Task 10 testet es zusätzlich im Dokumentkontext).

**Files:**
- Create: `app/Actions/SaveCustomer.php`, `app/Actions/DeleteCustomer.php`, `app/Actions/DeleteDraft.php`, `app/Actions/SaveFieldDefinition.php`, `app/Actions/DeleteFieldDefinition.php`
- Test: `tests/Feature/Actions/CustomerActionsTest.php`, `tests/Feature/Actions/FieldDefinitionActionsTest.php`

**Interfaces:**
- Consumes: `Actor`, `EventLog`, `FieldErrors`, `DomainMapper::currentFieldDefinitions()` (Task 7), `CustomValueValidator`, `FieldRegistry`, `FieldDefinitionValidator`, `KeySlugger` (Task 4), `ActionNotAllowedException`, `DocumentLockedException`.
- Produces:
  - `SaveCustomer::handle(Actor $actor, array $input, ?Customer $customer = null): Customer` – Felder `number` (leer → nächste Nummer, Präfix der höchsten vorhandenen, sonst `C-1001`), `name`, `street`, `zip`, `city`, `country` (ISO-2, groß), `email`, `vat_id`, `tax_treatment`, `locale`, `custom`, `contacts[]` (`id`, `salutation`, `first_name`, `last_name`, `position`, `email`, `phone`, `is_default`, `custom`). Rückgabe mit geladenen `contacts`.
  - `DeleteCustomer::handle(Actor $actor, Customer $customer): void`
  - `DeleteDraft::handle(Actor $actor, Document $document): void`
  - `SaveFieldDefinition::handle(Actor $actor, array $input, ?FieldDefinition $definition = null): FieldDefinition` – `scope` (nur beim Anlegen), `key` (optional, sonst aus `label`), `label`, `type`, `required`, `default_value`, `help`, `options[]`, `doc_types[]`, `sort`.
  - `DeleteFieldDefinition::handle(Actor $actor, FieldDefinition $definition): void`

- [ ] **Step 1: Failing tests schreiben**

`tests/Feature/Actions/CustomerActionsTest.php`:

```php
<?php

use App\Actions\DeleteCustomer;
use App\Actions\SaveCustomer;
use App\Enums\DocumentType;
use App\Enums\EventAction;
use App\Enums\FieldScope;
use App\Enums\FieldType;
use App\Enums\TaxTreatment;
use App\Exceptions\ActionNotAllowedException;
use App\Models\Contact;
use App\Models\Customer;
use App\Models\Document;
use App\Models\DocumentEvent;
use App\Models\FieldDefinition;
use Illuminate\Validation\ValidationException;

/** @return array<string, list<string>> */
function customerErrors(Closure $run): array
{
    try {
        $run();
    } catch (ValidationException $e) {
        return $e->errors();
    }

    return [];
}

it('creates a customer with contacts and exactly one default contact', function () {
    $customer = app(SaveCustomer::class)->handle(systemActor(), [
        'name' => 'Hafenkontor Lindqvist GmbH',
        'country' => 'de',
        'tax_treatment' => 'domestic',
        'contacts' => [
            ['first_name' => 'Mira', 'last_name' => 'Albers', 'is_default' => true],
            ['first_name' => 'Ole', 'last_name' => 'Brandt', 'is_default' => true],
        ],
    ]);

    expect($customer->number)->toBe('C-1001')
        ->and($customer->country)->toBe('DE')
        ->and($customer->tax_treatment)->toBe(TaxTreatment::Domestic)
        ->and($customer->contacts->where('is_default', true)->pluck('first_name')->all())->toBe(['Mira']);
});

it('continues the highest customer number with its prefix', function () {
    Customer::factory()->create(['number' => 'K-1004']);

    expect(app(SaveCustomer::class)->handle(systemActor(), ['name' => 'Kulturwerk Elbinsel e. V.'])->number)->toBe('K-1005');
});

it('makes the first contact the default when none is marked', function () {
    $customer = app(SaveCustomer::class)->handle(systemActor(), [
        'name' => 'Fjord Analytics AB',
        'contacts' => [['first_name' => 'Elin', 'last_name' => 'Berg']],
    ]);

    expect($customer->contacts->first()?->is_default)->toBeTrue();
});

it('validates custom fields of customers and contacts with paths and enforces required ones', function () {
    FieldDefinition::factory()->create(['scope' => FieldScope::Customer, 'key' => 'industry', 'label' => 'Industry', 'type' => FieldType::Select, 'options' => ['Software', 'Retail'], 'doc_types' => []]);
    FieldDefinition::factory()->create(['scope' => FieldScope::Customer, 'key' => 'supplier_number', 'label' => 'Supplier number', 'required' => true, 'doc_types' => []]);
    FieldDefinition::factory()->create(['scope' => FieldScope::Contact, 'key' => 'department', 'label' => 'Department', 'doc_types' => []]);

    $errors = customerErrors(fn () => app(SaveCustomer::class)->handle(systemActor(), [
        'name' => 'Fjord Analytics AB',
        'custom' => ['industry' => 'Shipping'],
        'contacts' => [['first_name' => 'Elin', 'custom' => ['department' => 7, 'shoe_size' => '42']]],
    ]));

    expect(array_keys($errors))->toBe(['custom.industry', 'custom.supplier_number', 'contacts.0.custom.department', 'contacts.0.custom.shoe_size'])
        ->and($errors['custom.industry'][0])->toBe('Industry must be one of: Software, Retail.')
        ->and(Customer::query()->count())->toBe(0);
});

it('applies default values of customer fields on create', function () {
    FieldDefinition::factory()->create(['scope' => FieldScope::Customer, 'key' => 'industry', 'type' => FieldType::Text, 'default_value' => 'Software', 'doc_types' => []]);

    expect(app(SaveCustomer::class)->handle(systemActor(), ['name' => 'Fjord Analytics AB'])->custom)->toBe(['industry' => 'Software']);
});

it('soft-deletes removed contacts and clears them from drafts only', function () {
    $customer = Customer::factory()->create();
    $kept = Contact::factory()->for($customer)->create(['first_name' => 'Mira']);
    $removed = Contact::factory()->for($customer)->create(['first_name' => 'Ole', 'is_default' => false]);
    $draft = Document::factory()->create(['customer_id' => $customer->id, 'contact_id' => $removed->id]);
    $final = Document::factory()->finalized()->create(['customer_id' => $customer->id, 'contact_id' => $removed->id]);

    app(SaveCustomer::class)->handle(systemActor(), ['contacts' => [['id' => $kept->id, 'first_name' => 'Mira', 'is_default' => true]]], $customer);

    expect(Contact::query()->whereKey($removed->id)->exists())->toBeFalse()
        ->and(Contact::withTrashed()->whereKey($removed->id)->exists())->toBeTrue()
        ->and($draft->fresh()->contact_id)->toBeNull()
        ->and($final->fresh()->contact_id)->toBe($removed->id);
});

it('refuses a duplicate customer number', function () {
    Customer::factory()->create(['number' => 'K-1001']);

    expect(array_keys(customerErrors(fn () => app(SaveCustomer::class)->handle(systemActor(), ['name' => 'X', 'number' => 'K-1001']))))
        ->toBe(['number']);
});

it('deletes a customer with drafts only and logs the deleted drafts', function () {
    $customer = Customer::factory()->create();
    $draft = Document::factory()->create(['customer_id' => $customer->id]);

    app(DeleteCustomer::class)->handle(systemActor(), $customer);

    expect(Customer::query()->find($customer->id))->toBeNull()
        ->and(Document::query()->find($draft->id))->toBeNull()
        ->and(DocumentEvent::query()->where('action', EventAction::Deleted)->whereNull('document_id')->count())->toBe(1);
});

it('refuses to delete a customer with finalized documents', function () {
    $customer = Customer::factory()->create();
    Document::factory()->finalized()->type(DocumentType::Invoice)->create(['customer_id' => $customer->id]);

    expect(fn () => app(DeleteCustomer::class)->handle(systemActor(), $customer))
        ->toThrow(ActionNotAllowedException::class, 'The customer has finalized documents and cannot be deleted.');
});
```

`tests/Feature/Actions/FieldDefinitionActionsTest.php`:

```php
<?php

use App\Actions\DeleteFieldDefinition;
use App\Actions\SaveFieldDefinition;
use App\Enums\DocumentType;
use App\Enums\FieldScope;
use App\Enums\FieldType;
use App\Models\FieldDefinition;
use Illuminate\Validation\ValidationException;

/** @return array<string, list<string>> */
function fieldDefinitionErrors(array $input, ?FieldDefinition $definition = null): array
{
    try {
        app(SaveFieldDefinition::class)->handle(systemActor(), $input, $definition);
    } catch (ValidationException $e) {
        return $e->errors();
    }

    return [];
}

it('creates a field and derives the key from the label', function () {
    $definition = app(SaveFieldDefinition::class)->handle(systemActor(), [
        'scope' => 'document', 'label' => 'Bestellnummer des Kunden', 'type' => 'text', 'doc_types' => ['confirmation', 'invoice'],
    ]);

    expect($definition->key)->toBe('bestellnummer_des_kunden')
        ->and($definition->scope)->toBe(FieldScope::Document)
        ->and($definition->doc_types)->toBe(['confirmation', 'invoice'])
        ->and($definition->sort)->toBe(1);
});

it('keeps scope and key after creation', function () {
    $definition = FieldDefinition::factory()->create(['key' => 'project_name', 'scope' => FieldScope::Document]);

    $saved = app(SaveFieldDefinition::class)->handle(systemActor(), [
        'scope' => 'customer', 'key' => 'renamed', 'label' => 'Project', 'type' => 'text', 'doc_types' => ['invoice'],
    ], $definition);

    expect($saved->key)->toBe('project_name')
        ->and($saved->scope)->toBe(FieldScope::Document)
        ->and($saved->label)->toBe('Project');
});

it('rejects reserved keys, duplicates, empty selects and missing doc types with paths', function () {
    FieldDefinition::factory()->create(['scope' => FieldScope::Document, 'key' => 'po_number']);

    expect(array_keys(fieldDefinitionErrors(['scope' => 'document', 'key' => 'number', 'label' => 'Nr', 'type' => 'text', 'doc_types' => ['invoice']])))->toBe(['key'])
        ->and(array_keys(fieldDefinitionErrors(['scope' => 'document', 'key' => 'po_number', 'label' => 'PO', 'type' => 'text', 'doc_types' => ['invoice']])))->toBe(['key'])
        ->and(array_keys(fieldDefinitionErrors(['scope' => 'document', 'label' => 'Priority', 'type' => 'select', 'options' => [' '], 'doc_types' => []])))->toBe(['options', 'doc_types'])
        ->and(array_keys(fieldDefinitionErrors(['scope' => 'planet', 'label' => 'X', 'type' => 'text'])))->toBe(['scope']);
});

it('drops doc types for levels without document types and normalizes the default value', function () {
    $definition = app(SaveFieldDefinition::class)->handle(systemActor(), [
        'scope' => 'customer', 'label' => 'Rabatt', 'type' => 'money', 'default_value' => '5', 'doc_types' => ['invoice'],
    ]);

    expect($definition->doc_types)->toBe([])
        ->and($definition->default_value)->toBe('5')
        ->and($definition->type)->toBe(FieldType::Money);
});

it('rejects a default value that does not fit the type', function () {
    expect(array_keys(fieldDefinitionErrors(['scope' => 'document', 'label' => 'Due', 'type' => 'date', 'default_value' => 'tomorrow', 'doc_types' => [DocumentType::Invoice->value]])))
        ->toBe(['default_value']);
});

it('deletes a field definition', function () {
    $definition = FieldDefinition::factory()->create();

    app(DeleteFieldDefinition::class)->handle(systemActor(), $definition);

    expect(FieldDefinition::query()->count())->toBe(0);
});
```

- [ ] **Step 2: Tests laufen lassen, sie müssen scheitern**

Run: `ddev artisan test --filter='CustomerActionsTest|FieldDefinitionActionsTest'`
Expected: FAIL mit `Class "App\Actions\SaveCustomer" not found`

- [ ] **Step 3: Kunden-Actions und DeleteDraft**

`app/Actions/SaveCustomer.php`:

```php
<?php

namespace App\Actions;

use App\Domain\Fields\CustomValueValidator;
use App\Domain\Fields\FieldRegistry;
use App\Enums\FieldScope;
use App\Enums\TaxTreatment;
use App\Models\Contact;
use App\Models\Customer;
use App\Models\Document;
use App\Support\Actor;
use App\Support\DomainMapper;
use App\Support\FieldErrors;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Creates or updates a customer. `contacts`, when given, is the complete list: missing contacts are
 * soft-deleted (drafts lose them, finalized documents keep theirs). Exactly one contact is the default.
 * Required custom fields are enforced here (documents enforce theirs when finalizing).
 */
final class SaveCustomer
{
    private const STRINGS = ['street', 'zip', 'city', 'country', 'email', 'vat_id'];

    private const CONTACT_STRINGS = ['salutation', 'first_name', 'last_name', 'position', 'email', 'phone'];

    /**
     * @param  array<string, mixed>  $input
     *
     * @throws ValidationException
     */
    public function handle(Actor $actor, array $input, ?Customer $customer = null): Customer
    {
        $data = Validator::make($input, [
            'number' => ['sometimes', 'nullable', 'string', 'max:32', Rule::unique('customers', 'number')->ignore($customer?->id)],
            'name' => [$customer === null ? 'required' : 'sometimes', 'string', 'max:255'],
            'street' => ['sometimes', 'nullable', 'string', 'max:255'],
            'zip' => ['sometimes', 'nullable', 'string', 'max:32'],
            'city' => ['sometimes', 'nullable', 'string', 'max:255'],
            'country' => ['sometimes', 'nullable', 'string', 'size:2'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'vat_id' => ['sometimes', 'nullable', 'string', 'max:32'],
            'tax_treatment' => ['sometimes', Rule::enum(TaxTreatment::class)],
            'locale' => ['sometimes', 'nullable', Rule::in(['en', 'de'])],
            'custom' => ['sometimes', 'array'],
            'contacts' => ['sometimes', 'array', 'list', 'max:100'],
            'contacts.*' => ['array'],
            'contacts.*.id' => ['sometimes', 'nullable', 'string'],
            'contacts.*.salutation' => ['sometimes', 'nullable', 'string', 'max:64'],
            'contacts.*.first_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'contacts.*.last_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'contacts.*.position' => ['sometimes', 'nullable', 'string', 'max:255'],
            'contacts.*.email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'contacts.*.phone' => ['sometimes', 'nullable', 'string', 'max:64'],
            'contacts.*.is_default' => ['sometimes', 'boolean'],
            'contacts.*.custom' => ['sometimes', 'array'],
        ])->validate();

        $definitions = DomainMapper::currentFieldDefinitions();
        $customerFields = FieldRegistry::forScope($definitions, FieldScope::Customer);
        $contactFields = FieldRegistry::forScope($definitions, FieldScope::Contact);
        $errors = [];

        if ($customer === null || array_key_exists('custom', $data)) {
            $values = $customer === null ? [...FieldRegistry::defaults($customerFields), ...($data['custom'] ?? [])] : $data['custom'];
            $result = CustomValueValidator::validate($customerFields, $values, 'custom.', true);
            $errors = $result->errors;
            $data['custom'] = $result->values;
        }
        foreach ($data['contacts'] ?? [] as $i => $contact) {
            $result = CustomValueValidator::validate($contactFields, $contact['custom'] ?? [], "contacts.{$i}.custom.", true);
            $errors = [...$errors, ...$result->errors];
            $data['contacts'][$i]['custom'] = $result->values;
        }
        FieldErrors::throwIfAny($errors);

        return DB::transaction(function () use ($data, $customer): Customer {
            $customer ??= new Customer;
            foreach (['name', 'tax_treatment', 'locale', 'custom'] as $key) {
                if (array_key_exists($key, $data)) {
                    $customer->{$key} = $data[$key];
                }
            }
            foreach (self::STRINGS as $key) {
                if (array_key_exists($key, $data)) {
                    $value = (string) ($data[$key] ?? '');
                    $customer->{$key} = $key === 'country' ? strtoupper($value) : $value;
                }
            }
            if (($data['number'] ?? null) !== null) {
                $customer->number = $data['number'];
            } elseif (! $customer->exists) {
                $customer->number = $this->nextNumber();
            }
            $customer->save();

            if (array_key_exists('contacts', $data)) {
                $this->syncContacts($customer, $data['contacts']);
            }

            return $customer->load('contacts');
        });
    }

    /** Highest numeric customer number + 1, with its prefix ("K-1004" → "K-1005"); first customer "C-1001". */
    private function nextNumber(): string
    {
        $max = 1000;
        $prefix = 'C-';
        foreach (Customer::withTrashed()->pluck('number') as $number) {
            if (preg_match('/^(\D*)(\d+)$/', (string) $number, $m) === 1 && (int) $m[2] >= $max) {
                $max = (int) $m[2];
                $prefix = $m[1];
            }
        }

        return $prefix.($max + 1);
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     */
    private function syncContacts(Customer $customer, array $rows): void
    {
        $existing = $customer->contacts()->pluck('id')->all();
        $defaultIndex = 0;
        foreach ($rows as $i => $row) {
            if (! empty($row['is_default'])) {
                $defaultIndex = $i;
                break;
            }
        }

        $kept = [];
        foreach ($rows as $i => $row) {
            $id = is_string($row['id'] ?? null) && in_array($row['id'], $existing, true) ? $row['id'] : null;
            $contact = $id === null ? new Contact : Contact::query()->findOrFail($id);
            $values = ['customer_id' => $customer->id, 'is_default' => $i === $defaultIndex, 'custom' => $row['custom'] ?? []];
            foreach (self::CONTACT_STRINGS as $key) {
                $values[$key] = (string) ($row[$key] ?? '');
            }
            $contact->forceFill($values)->save();
            $kept[] = $contact->id;
        }

        $removed = array_values(array_diff($existing, $kept));
        if ($removed !== []) {
            // drafts only; finalized documents keep their contact (and their snapshot)
            Document::query()->whereIn('contact_id', $removed)->whereNull('finalized_at')->update(['contact_id' => null]);
            Contact::query()->whereIn('id', $removed)->delete();
        }
    }
}
```

`app/Actions/DeleteDraft.php`:

```php
<?php

namespace App\Actions;

use App\Enums\EventAction;
use App\Exceptions\DocumentLockedException;
use App\Models\Document;
use App\Support\Actor;
use App\Support\EventLog;
use Illuminate\Support\Facades\DB;

/** Deletes a draft with its groups and positions. The "deleted" event stays (document_id becomes NULL). */
final class DeleteDraft
{
    /**
     * @throws DocumentLockedException
     */
    public function handle(Actor $actor, Document $document): void
    {
        if ($document->isFinalized()) {
            throw DocumentLockedException::for($document);
        }

        DB::transaction(function () use ($actor, $document): void {
            EventLog::record($document, $actor, EventAction::Deleted, ['type' => $document->type->value, 'customer_id' => $document->customer_id]);
            $document->delete();
        });
    }
}
```

`app/Actions/DeleteCustomer.php`:

```php
<?php

namespace App\Actions;

use App\Exceptions\ActionNotAllowedException;
use App\Models\Customer;
use App\Models\Document;
use App\Support\Actor;
use Illuminate\Support\Facades\DB;

/** Soft-deletes a customer and deletes its drafts; refused when finalized documents exist. */
final class DeleteCustomer
{
    public function __construct(private readonly DeleteDraft $deleteDraft) {}

    /**
     * @throws ActionNotAllowedException
     */
    public function handle(Actor $actor, Customer $customer): void
    {
        if (Document::query()->where('customer_id', $customer->id)->whereNotNull('finalized_at')->exists()) {
            throw ActionNotAllowedException::customerHasFinalizedDocuments();
        }

        DB::transaction(function () use ($actor, $customer): void {
            foreach (Document::query()->where('customer_id', $customer->id)->get() as $draft) {
                $this->deleteDraft->handle($actor, $draft);
            }
            $customer->delete();
        });
    }
}
```

- [ ] **Step 4: Feld-Actions**

`app/Actions/SaveFieldDefinition.php`:

```php
<?php

namespace App\Actions;

use App\Domain\Fields\CustomValueValidator;
use App\Domain\Fields\FieldDefinitionData;
use App\Domain\Fields\FieldDefinitionValidator;
use App\Domain\Fields\FieldRegistry;
use App\Domain\Fields\KeySlugger;
use App\Enums\DocumentType;
use App\Enums\FieldScope;
use App\Enums\FieldType;
use App\Models\FieldDefinition;
use App\Support\Actor;
use App\Support\DomainMapper;
use App\Support\FieldErrors;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** Creates or updates a custom field. Scope and key are fixed after creation (templates use the key). */
final class SaveFieldDefinition
{
    /**
     * @param  array<string, mixed>  $input
     *
     * @throws ValidationException
     */
    public function handle(Actor $actor, array $input, ?FieldDefinition $definition = null): FieldDefinition
    {
        $data = Validator::make($input, [
            'scope' => [$definition === null ? 'required' : 'sometimes', Rule::enum(FieldScope::class)],
            'key' => ['sometimes', 'nullable', 'string', 'max:64'],
            'label' => ['required', 'string', 'max:255'],
            'type' => ['required', Rule::enum(FieldType::class)],
            'required' => ['sometimes', 'boolean'],
            'default_value' => ['sometimes', 'nullable'],
            'help' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'options' => ['sometimes', 'array', 'list', 'max:100'],
            'options.*' => ['string', 'max:255'],
            'doc_types' => ['sometimes', 'array', 'list'],
            'doc_types.*' => [Rule::enum(DocumentType::class)],
            'sort' => ['sometimes', 'integer', 'min:0'],
        ])->validate();

        $scope = $definition === null ? FieldScope::from($data['scope']) : $definition->scope;
        $key = $definition?->key ?? (is_string($data['key'] ?? null) && $data['key'] !== '' ? $data['key'] : KeySlugger::slug($data['label']));
        $docTypes = FieldRegistry::hasDocTypes($scope) ? array_values(array_unique($data['doc_types'] ?? [])) : [];
        $options = array_values(array_filter(array_map('trim', $data['options'] ?? []), fn (string $o): bool => $o !== ''));

        $candidate = new FieldDefinitionData(
            scope: $scope,
            key: $key,
            label: trim($data['label']),
            type: FieldType::from($data['type']),
            required: (bool) ($data['required'] ?? false),
            defaultValue: $data['default_value'] ?? null,
            options: $options,
            docTypes: array_map(fn (string $t): DocumentType => DocumentType::from($t), $docTypes),
            id: $definition?->id,
        );
        FieldErrors::throwIfAny(FieldDefinitionValidator::validate($candidate, DomainMapper::currentFieldDefinitions()));

        $definition ??= new FieldDefinition;
        $sort = $data['sort'] ?? ($definition->exists ? $definition->sort : (int) FieldDefinition::query()->where('scope', $scope)->max('sort') + 1);
        $definition->forceFill([
            'scope' => $scope,
            'key' => $key,
            'label' => $candidate->label,
            'type' => $candidate->type,
            'required' => $candidate->required,
            'default_value' => FieldRegistry::isEmpty($candidate->defaultValue) ? null : CustomValueValidator::normalize($candidate, $candidate->defaultValue),
            'help' => (string) ($data['help'] ?? ''),
            'options' => $options,
            'doc_types' => $docTypes,
            'sort' => $sort,
        ])->save();

        return $definition;
    }
}
```

`app/Actions/DeleteFieldDefinition.php`:

```php
<?php

namespace App\Actions;

use App\Models\FieldDefinition;
use App\Support\Actor;

/** Values already stored in custom JSON stay; finalized documents keep the definition in their snapshot. */
final class DeleteFieldDefinition
{
    public function handle(Actor $actor, FieldDefinition $definition): void
    {
        $definition->delete();
    }
}
```

- [ ] **Step 5: Tests laufen lassen**

Run: `ddev artisan test --filter='CustomerActionsTest|FieldDefinitionActionsTest'`
Expected: PASS. Hinweis zu „sort = 1“: die erste Definition einer Ebene bekommt `max(sort) + 1` = `0 + 1`. Hinweis zur Fehlermeldung: `'Industry must be one of: Software, Retail.'` kommt aus `fields.error.not_option` (App-Sprache in Tests: `en`).

- [ ] **Step 6: Commit**

```bash
git add app/Actions tests/Feature/Actions/CustomerActionsTest.php tests/Feature/Actions/FieldDefinitionActionsTest.php
git commit -m "feat(actions): save and delete customers and custom field definitions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 9: Actions für Einstellungen (Organisation, Dokumenttypen, Steuern, Einheiten, Textbausteine)

Port von `settings.ts`. Steuersätze und Einheiten werden archiviert statt gelöscht (Positionen und Snapshots verweisen weiter darauf). `UpdateDocumentType` pflegt auch den Nummernkreis und lehnt einen jährlichen Reset ohne Jahr im Muster ab (sonst kämen Nummern doppelt).

**Files:**
- Create: `app/Actions/UpdateOrganization.php`, `app/Actions/UpdateDocumentType.php`, `app/Actions/SaveTaxRate.php`, `app/Actions/ArchiveTaxRate.php`, `app/Actions/SaveUnit.php`, `app/Actions/ArchiveUnit.php`, `app/Actions/SaveTextBlock.php`, `app/Actions/DeleteTextBlock.php`
- Test: `tests/Feature/Actions/SettingsActionsTest.php`

**Interfaces:**
- Consumes: `Actor`, `FieldErrors`, `DomainMapper::currentFieldDefinitions()`, `Text`, `DecimalString` (Task 7), `NumberFormatter::hasYear()` (Task 3), `CustomValueValidator`, `FieldRegistry` (Task 4).
- Produces:
  - `UpdateOrganization::handle(Actor, array $input): Organization` – `name`, `street`, `zip`, `city`, `country`, `vat_id`, `tax_number`, `iban`, `bic`, `bank_name`, `email`, `phone`, `website`, `taxation_mode`, `locale`, `custom` (Pflichtfelder erzwungen). `logo_path` setzt Phase 7 (Upload).
  - `UpdateDocumentType::handle(Actor, DocumentType $type, array $input): DocumentTypeSetting` – `profile` (`en16931` nur für `invoice`/`cancellation`), `template_id`, `default_intro_block_id`, `default_closing_block_id`, `payment_term_days`, `validity_days`, `numbering.pattern`, `numbering.reset_yearly`, `numbering.next_value` (bei jährlichem Reset: Zähler des laufenden Jahres).
  - `SaveTaxRate::handle(Actor, array $input, ?TaxRate $rate = null): TaxRate` (`label`, `percent` als String 0–100, `category`, `exemption_note`, `sort`), `ArchiveTaxRate::handle(Actor, TaxRate): TaxRate`
  - `SaveUnit::handle(Actor, array $input, ?Unit $unit = null): Unit` (`name`, `symbol`, `decimals` 0–4, `code` UN/ECE 2–3 Zeichen, `sort`), `ArchiveUnit::handle(Actor, Unit): Unit`
  - `SaveTextBlock::handle(Actor, array $input, ?TextBlock $block = null): TextBlock` (`name`, `kind`, `body`), `DeleteTextBlock::handle(Actor, TextBlock): void` (Dokumenttyp-Vorgaben werden per FK `NULL`)

- [ ] **Step 1: Failing test schreiben**

`tests/Feature/Actions/SettingsActionsTest.php`:

```php
<?php

use App\Actions\ArchiveTaxRate;
use App\Actions\ArchiveUnit;
use App\Actions\DeleteTextBlock;
use App\Actions\SaveTaxRate;
use App\Actions\SaveTextBlock;
use App\Actions\SaveUnit;
use App\Actions\UpdateDocumentType;
use App\Actions\UpdateOrganization;
use App\Enums\ComplianceProfile;
use App\Enums\DocumentType;
use App\Enums\FieldScope;
use App\Enums\TaxationMode;
use App\Enums\TaxCategory;
use App\Enums\TextBlockKind;
use App\Models\DocumentTypeSetting;
use App\Models\FieldDefinition;
use App\Models\NumberSequence;
use App\Models\TaxRate;
use App\Models\TextBlock;
use App\Models\Unit;
use Illuminate\Validation\ValidationException;

/** @return list<string> */
function settingsErrorPaths(Closure $run): array
{
    try {
        $run();
    } catch (ValidationException $e) {
        return array_keys($e->errors());
    }

    return [];
}

it('updates the organization and normalizes empty strings', function () {
    $org = app(UpdateOrganization::class)->handle(systemActor(), [
        'name' => 'Studio Nordlicht', 'country' => 'de', 'vat_id' => null, 'taxation_mode' => 'small_business', 'locale' => 'de',
    ]);

    expect($org->name)->toBe('Studio Nordlicht')
        ->and($org->country)->toBe('DE')
        ->and($org->vat_id)->toBe('')
        ->and($org->taxation_mode)->toBe(TaxationMode::SmallBusiness)
        ->and($org->locale)->toBe('de');
});

it('validates organization custom fields and enforces required ones', function () {
    FieldDefinition::factory()->create(['scope' => FieldScope::Org, 'key' => 'register', 'label' => 'Register', 'required' => true, 'doc_types' => []]);

    expect(settingsErrorPaths(fn () => app(UpdateOrganization::class)->handle(systemActor(), ['custom' => ['register' => '', 'motto' => 'x']])))
        ->toBe(['custom.motto', 'custom.register']);
});

it('updates a document type and its number range', function () {
    $intro = TextBlock::factory()->create(['kind' => TextBlockKind::Intro]);

    $setting = app(UpdateDocumentType::class)->handle(systemActor(), DocumentType::Invoice, [
        'profile' => 'en16931',
        'payment_term_days' => 30,
        'default_intro_block_id' => $intro->id,
        'numbering' => ['pattern' => 'RE-{YYYY}-{00000}', 'next_value' => 43],
    ]);

    $year = (int) now()->format('Y');
    expect($setting->profile)->toBe(ComplianceProfile::En16931)
        ->and($setting->payment_term_days)->toBe(30)
        ->and($setting->default_intro_block_id)->toBe($intro->id)
        ->and(NumberSequence::query()->where('doc_type', 'invoice')->whereNull('year')->value('pattern'))->toBe('RE-{YYYY}-{00000}')
        ->and(NumberSequence::query()->where('doc_type', 'invoice')->where('year', $year)->value('next_value'))->toBe(43);
});

it('keeps one running counter without yearly reset', function () {
    app(UpdateDocumentType::class)->handle(systemActor(), DocumentType::Offer, ['numbering' => ['pattern' => 'AN-{0000}', 'reset_yearly' => false, 'next_value' => 7]]);

    $config = NumberSequence::query()->where('doc_type', 'offer')->whereNull('year')->firstOrFail();
    expect($config->reset_yearly)->toBeFalse()
        ->and($config->next_value)->toBe(7);
});

it('refuses e-invoice profiles for offers, patterns without counter and yearly reset without year', function () {
    expect(settingsErrorPaths(fn () => app(UpdateDocumentType::class)->handle(systemActor(), DocumentType::Offer, ['profile' => 'en16931'])))->toBe(['profile'])
        ->and(settingsErrorPaths(fn () => app(UpdateDocumentType::class)->handle(systemActor(), DocumentType::Invoice, ['numbering' => ['pattern' => 'RE-{YYYY}']])))->toBe(['numbering.pattern'])
        ->and(settingsErrorPaths(fn () => app(UpdateDocumentType::class)->handle(systemActor(), DocumentType::Invoice, ['numbering' => ['pattern' => 'RE-{0000}', 'reset_yearly' => true]])))->toBe(['numbering.pattern'])
        ->and(NumberSequence::query()->where('doc_type', 'invoice')->whereNull('year')->value('pattern'))->toBe('INV-{YYYY}-{0000}')
        ->and(DocumentTypeSetting::query()->findOrFail('offer')->profile)->toBe(ComplianceProfile::Basic);
});

it('saves and archives tax rates; percent must be a decimal string between 0 and 100', function () {
    $rate = app(SaveTaxRate::class)->handle(systemActor(), ['label' => '10,7 %', 'percent' => '10.7', 'category' => 'S']);

    expect($rate->percent)->toBe('10.70')
        ->and($rate->category)->toBe(TaxCategory::S)
        ->and($rate->sort)->toBe(3)
        ->and(app(ArchiveTaxRate::class)->handle(systemActor(), $rate)->archived_at)->not->toBeNull()
        ->and(TaxRate::query()->whereKey($rate->id)->exists())->toBeTrue()
        ->and(settingsErrorPaths(fn () => app(SaveTaxRate::class)->handle(systemActor(), ['label' => 'X', 'percent' => 19.5, 'category' => 'S'])))->toBe(['percent'])
        ->and(settingsErrorPaths(fn () => app(SaveTaxRate::class)->handle(systemActor(), ['label' => 'X', 'percent' => '120', 'category' => 'S'])))->toBe(['percent'])
        ->and(settingsErrorPaths(fn () => app(SaveTaxRate::class)->handle(systemActor(), ['label' => 'X', 'percent' => '7', 'category' => 'VAT'])))->toBe(['category']);
});

it('saves and archives units with UN/ECE codes', function () {
    $unit = app(SaveUnit::class)->handle(systemActor(), ['name' => 'Woche', 'symbol' => 'Wo.', 'decimals' => 0, 'code' => 'WEE']);

    expect($unit->code)->toBe('WEE')
        ->and(app(ArchiveUnit::class)->handle(systemActor(), $unit)->archived_at)->not->toBeNull()
        ->and(settingsErrorPaths(fn () => app(SaveUnit::class)->handle(systemActor(), ['name' => 'X', 'code' => 'week'])))->toBe(['code'])
        ->and(Unit::query()->count())->toBe(7);
});

it('saves text blocks and clears document type defaults when one is deleted', function () {
    $block = app(SaveTextBlock::class)->handle(systemActor(), ['name' => 'Intro', 'kind' => 'intro', 'body' => 'Hello {{ contact.first_name }},']);
    DocumentTypeSetting::query()->whereKey('offer')->update(['default_intro_block_id' => $block->id]);

    app(DeleteTextBlock::class)->handle(systemActor(), $block);

    expect(TextBlock::query()->count())->toBe(0)
        ->and(DocumentTypeSetting::query()->findOrFail('offer')->default_intro_block_id)->toBeNull();
});
```

- [ ] **Step 2: Test laufen lassen, er muss scheitern**

Run: `ddev artisan test --filter=SettingsActionsTest`
Expected: FAIL mit `Class "App\Actions\UpdateOrganization" not found`

- [ ] **Step 3: Organisation und Dokumenttypen**

`app/Actions/UpdateOrganization.php`:

```php
<?php

namespace App\Actions;

use App\Domain\Fields\CustomValueValidator;
use App\Domain\Fields\FieldRegistry;
use App\Enums\FieldScope;
use App\Enums\TaxationMode;
use App\Models\Organization;
use App\Support\Actor;
use App\Support\DomainMapper;
use App\Support\FieldErrors;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class UpdateOrganization
{
    private const STRINGS = ['name', 'street', 'zip', 'city', 'country', 'vat_id', 'tax_number', 'iban', 'bic', 'bank_name', 'email', 'phone', 'website'];

    /**
     * @param  array<string, mixed>  $input
     *
     * @throws ValidationException
     */
    public function handle(Actor $actor, array $input): Organization
    {
        $data = Validator::make($input, [
            'name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'street' => ['sometimes', 'nullable', 'string', 'max:255'],
            'zip' => ['sometimes', 'nullable', 'string', 'max:32'],
            'city' => ['sometimes', 'nullable', 'string', 'max:255'],
            'country' => ['sometimes', 'nullable', 'string', 'size:2'],
            'vat_id' => ['sometimes', 'nullable', 'string', 'max:32'],
            'tax_number' => ['sometimes', 'nullable', 'string', 'max:32'],
            'iban' => ['sometimes', 'nullable', 'string', 'max:42'],
            'bic' => ['sometimes', 'nullable', 'string', 'max:11'],
            'bank_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:64'],
            'website' => ['sometimes', 'nullable', 'string', 'max:255'],
            'taxation_mode' => ['sometimes', Rule::enum(TaxationMode::class)],
            'locale' => ['sometimes', Rule::in(['en', 'de'])],
            'custom' => ['sometimes', 'array'],
        ])->validate();

        if (array_key_exists('custom', $data)) {
            $fields = FieldRegistry::forScope(DomainMapper::currentFieldDefinitions(), FieldScope::Org);
            $result = CustomValueValidator::validate($fields, $data['custom'], 'custom.', true);
            FieldErrors::throwIfAny($result->errors);
            $data['custom'] = $result->values;
        }

        $org = Organization::current();
        foreach (self::STRINGS as $key) {
            if (array_key_exists($key, $data)) {
                $value = (string) ($data[$key] ?? '');
                $org->{$key} = $key === 'country' ? strtoupper($value) : $value;
            }
        }
        foreach (['taxation_mode', 'locale', 'custom'] as $key) {
            if (array_key_exists($key, $data)) {
                $org->{$key} = $data[$key];
            }
        }
        $org->save();

        return $org;
    }
}
```

`app/Actions/UpdateDocumentType.php`:

```php
<?php

namespace App\Actions;

use App\Domain\Numbering\NumberFormatter;
use App\Enums\ComplianceProfile;
use App\Enums\DocumentType;
use App\Models\DocumentTypeSetting;
use App\Models\NumberSequence;
use App\Support\Actor;
use App\Support\Text;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class UpdateDocumentType
{
    /**
     * @param  array<string, mixed>  $input
     *
     * @throws ValidationException
     */
    public function handle(Actor $actor, DocumentType $type, array $input): DocumentTypeSetting
    {
        $profiles = in_array($type, [DocumentType::Invoice, DocumentType::Cancellation], true)
            ? [ComplianceProfile::Basic->value, ComplianceProfile::En16931->value]
            : [ComplianceProfile::Basic->value];

        $data = Validator::make($input, [
            'profile' => ['sometimes', Rule::in($profiles)],
            'template_id' => ['sometimes', 'nullable', 'string', Rule::exists('templates', 'id')],
            'default_intro_block_id' => ['sometimes', 'nullable', 'string', Rule::exists('text_blocks', 'id')],
            'default_closing_block_id' => ['sometimes', 'nullable', 'string', Rule::exists('text_blocks', 'id')],
            'payment_term_days' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:365'],
            'validity_days' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:365'],
            'numbering' => ['sometimes', 'array'],
            'numbering.pattern' => ['sometimes', 'string', 'max:64', 'regex:/\{0+\}/'],
            'numbering.reset_yearly' => ['sometimes', 'boolean'],
            'numbering.next_value' => ['sometimes', 'integer', 'min:1', 'max:99999999'],
        ])->validate();

        return DB::transaction(function () use ($type, $data): DocumentTypeSetting {
            $setting = DocumentTypeSetting::query()->findOrFail($type->value);
            $setting->fill(Arr::except($data, ['numbering']))->save();

            if (isset($data['numbering'])) {
                $this->updateNumbering($type, $data['numbering']);
            }

            return $setting;
        });
    }

    /**
     * @param  array<string, mixed>  $numbering
     *
     * @throws ValidationException
     */
    private function updateNumbering(DocumentType $type, array $numbering): void
    {
        $config = NumberSequence::query()->where('doc_type', $type->value)->whereNull('year')->lockForUpdate()->firstOrFail();
        $pattern = $numbering['pattern'] ?? $config->pattern;
        $resetYearly = array_key_exists('reset_yearly', $numbering) ? (bool) $numbering['reset_yearly'] : $config->reset_yearly;

        // a yearly reset without the year in the pattern would hand out the same number every year
        if ($resetYearly && ! NumberFormatter::hasYear($pattern)) {
            throw ValidationException::withMessages(['numbering.pattern' => [Text::t('errors.number_pattern_year')]]);
        }

        $config->forceFill(['pattern' => $pattern, 'reset_yearly' => $resetYearly]);
        if (isset($numbering['next_value'])) {
            if ($resetYearly) {
                NumberSequence::query()->updateOrCreate(
                    ['doc_type' => $type->value, 'year' => (int) now()->format('Y')],
                    ['pattern' => $pattern, 'reset_yearly' => true, 'next_value' => (int) $numbering['next_value']],
                );
            } else {
                $config->next_value = (int) $numbering['next_value'];
            }
        }
        $config->save();
    }
}
```

- [ ] **Step 4: Steuersätze, Einheiten, Textbausteine**

`app/Actions/SaveTaxRate.php`:

```php
<?php

namespace App\Actions;

use App\Domain\Money\Decimal;
use App\Enums\TaxCategory;
use App\Models\TaxRate;
use App\Rules\DecimalString;
use App\Support\Actor;
use App\Support\Text;
use Closure;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class SaveTaxRate
{
    /**
     * @param  array<string, mixed>  $input
     *
     * @throws ValidationException
     */
    public function handle(Actor $actor, array $input, ?TaxRate $rate = null): TaxRate
    {
        $required = $rate === null ? 'required' : 'sometimes';
        $data = Validator::make($input, [
            'label' => [$required, 'string', 'max:64'],
            'percent' => [$required, new DecimalString(2), function (string $attribute, mixed $value, Closure $fail): void {
                if (Decimal::isValid($value, 2) && (Decimal::of($value)->isNegative() || Decimal::of($value)->isGreaterThan(100))) {
                    $fail(Text::t('errors.percent_range'));
                }
            }],
            'category' => [$required, Rule::enum(TaxCategory::class)],
            'exemption_note' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'sort' => ['sometimes', 'integer', 'min:0'],
        ])->validate();

        $rate ??= new TaxRate;
        $rate->fill($data);
        if (! $rate->exists && ! array_key_exists('sort', $data)) {
            $rate->sort = (int) TaxRate::query()->max('sort') + 1;
        }
        $rate->save();

        return $rate;
    }
}
```

`app/Actions/ArchiveTaxRate.php`:

```php
<?php

namespace App\Actions;

use App\Models\TaxRate;
use App\Support\Actor;

/** Hidden from new positions; existing positions and snapshots keep pointing at it. */
final class ArchiveTaxRate
{
    public function handle(Actor $actor, TaxRate $rate): TaxRate
    {
        $rate->forceFill(['archived_at' => now()])->save();

        return $rate;
    }
}
```

`app/Actions/SaveUnit.php`:

```php
<?php

namespace App\Actions;

use App\Models\Unit;
use App\Support\Actor;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

final class SaveUnit
{
    /**
     * @param  array<string, mixed>  $input
     *
     * @throws ValidationException
     */
    public function handle(Actor $actor, array $input, ?Unit $unit = null): Unit
    {
        $data = Validator::make($input, [
            'name' => [$unit === null ? 'required' : 'sometimes', 'string', 'max:64'],
            'symbol' => ['sometimes', 'nullable', 'string', 'max:16'],
            'decimals' => ['sometimes', 'integer', 'min:0', 'max:4'],
            'code' => ['sometimes', 'nullable', 'string', 'regex:/^[A-Z0-9]{2,3}$/'],
            'sort' => ['sometimes', 'integer', 'min:0'],
        ])->validate();

        $unit ??= new Unit;
        foreach ($data as $key => $value) {
            $unit->{$key} = in_array($key, ['symbol', 'code'], true) ? (string) ($value ?? '') : $value;
        }
        if (! $unit->exists && ! array_key_exists('sort', $data)) {
            $unit->sort = (int) Unit::query()->max('sort') + 1;
        }
        $unit->save();

        return $unit;
    }
}
```

`app/Actions/ArchiveUnit.php`:

```php
<?php

namespace App\Actions;

use App\Models\Unit;
use App\Support\Actor;

final class ArchiveUnit
{
    public function handle(Actor $actor, Unit $unit): Unit
    {
        $unit->forceFill(['archived_at' => now()])->save();

        return $unit;
    }
}
```

`app/Actions/SaveTextBlock.php`:

```php
<?php

namespace App\Actions;

use App\Enums\TextBlockKind;
use App\Models\TextBlock;
use App\Support\Actor;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** Text blocks may contain Liquid placeholders; they are rendered with the document in phase 3. */
final class SaveTextBlock
{
    /**
     * @param  array<string, mixed>  $input
     *
     * @throws ValidationException
     */
    public function handle(Actor $actor, array $input, ?TextBlock $block = null): TextBlock
    {
        $required = $block === null ? 'required' : 'sometimes';
        $data = Validator::make($input, [
            'name' => [$required, 'string', 'max:255'],
            'kind' => [$required, Rule::enum(TextBlockKind::class)],
            'body' => ['sometimes', 'nullable', 'string', 'max:20000'],
        ])->validate();

        $block ??= new TextBlock(['body' => '']);
        $block->fill([...$data, ...(array_key_exists('body', $data) ? ['body' => (string) ($data['body'] ?? '')] : [])]);
        $block->save();

        return $block;
    }
}
```

`app/Actions/DeleteTextBlock.php`:

```php
<?php

namespace App\Actions;

use App\Models\TextBlock;
use App\Support\Actor;

/** Document type defaults pointing at it become NULL (foreign key ON DELETE SET NULL). */
final class DeleteTextBlock
{
    public function handle(Actor $actor, TextBlock $block): void
    {
        $block->delete();
    }
}
```

- [ ] **Step 5: Test laufen lassen**

Run: `ddev artisan test --filter=SettingsActionsTest`
Expected: PASS. Wenn die Regel `list` unbekannt sein sollte (Task 8 nutzt sie ebenfalls): `ddev exec grep -n "function validateList" vendor/laravel/framework/src/Illuminate/Validation/Concerns/ValidatesAttributes.php` muss einen Treffer liefern (Laravel 13 hat sie).

- [ ] **Step 6: Statische Analyse**

Run: `ddev exec vendor/bin/phpstan analyse --memory-limit=1G`
Expected: `[OK] No errors`

- [ ] **Step 7: Commit**

```bash
git add app/Actions tests/Feature/Actions/SettingsActionsTest.php
git commit -m "feat(actions): manage organization, document types, number ranges, tax rates, units and text blocks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 10: Entwürfe – CreateDocument, UpdateDraft, DeleteDraft

Port von `createDocument`/`updateDocument`/`deleteDocument` aus `documents.ts`. `UpdateDraft` ist das Ziel des Autosaves (Phase 4 `PATCH /api/documents/{id}`, Phase 6 Editor): fehlende Schlüssel bleiben, `groups` ersetzt alle Gruppen und Positionen. Eigene Felder werden auf Typ, Option und Gültigkeit für den Dokumenttyp geprüft, Pflichtfelder erst beim Abschließen. Gespeicherte Summen werden bei jedem Speichern neu berechnet.

**Files:**
- Create: `app/Actions/CreateDocument.php`, `app/Actions/UpdateDraft.php`
- Modify: `tests/Pest.php` (Helfer `draft()`, `completeOrganization()`)
- Test: `tests/Feature/Actions/DraftActionsTest.php`

**Interfaces:**
- Consumes: `GroupWriter`, `DocumentInspector`, `EventLog`, `DomainMapper::currentFieldDefinitions()`, `FieldErrors`, `DecimalString`, `Text` (Task 7), `DeleteDraft` (Task 8), `CustomValueValidator`, `FieldRegistry` (Task 4).
- Produces:
  - `CreateDocument::handle(Actor $actor, array $input): Document` – Pflicht `type` (nicht `cancellation`), optional `customer_id`, `date` und alle `UpdateDraft`-Felder. Vorgaben: Standard-Ansprechpartner, Leistungsdatum = Datum (Rechnung), Fälligkeit = Datum + Zahlungsziel (Rechnung), gültig bis = Datum + Gültigkeit (Angebot), Einleitung/Schlusstext aus den Standard-Bausteinen, Template des Typs, Sprache des Kunden sonst der Organisation, Standardwerte eigener Felder, eine Gruppe ohne Titel.
  - `UpdateDraft::handle(Actor $actor, Document $document, array $input): Document` – Felder `date`, `customer_id`, `contact_id`, `service_date`, `service_date_end`, `due_date`, `valid_until`, `intro`, `closing`, `template_id`, `locale`, `custom`, `groups[{id?, title?, positions[{id?, kind, title?, description?, quantity?, unit_price?, unit_id?, tax_rate_id?, custom?}]}]`. Kundenwechsel ohne `contact_id` setzt den Standard-Ansprechpartner des neuen Kunden. Rückgabe mit geladenen `groups.positions`.
  - Test-Helfer: `draft(DocumentType $type = DocumentType::Invoice, array $positions = [], array $input = []): Document` (über `CreateDocument`, neuer Kunde mit vollständiger Adresse), `completeOrganization(): void` (alles, was EN 16931 verlangt).

- [ ] **Step 1: Helfer in `tests/Pest.php` ergänzen**

Imports oben ergänzen:

```php
use App\Actions\CreateDocument;
use App\Models\Customer;
use App\Models\Organization;
```

Am Ende anfügen:

```php
/**
 * Draft created through CreateDocument for a new customer, with one loose group holding $positions
 * (one 100.00 consulting item when empty).
 *
 * @param  list<array<string, mixed>>  $positions
 * @param  array<string, mixed>  $input  extra CreateDocument/UpdateDraft input
 */
function draft(DocumentType $type = DocumentType::Invoice, array $positions = [], array $input = []): Document
{
    return app(CreateDocument::class)->handle(systemActor(), [
        'type' => $type->value,
        'customer_id' => Customer::factory()->create()->id,
        'groups' => [['title' => null, 'positions' => $positions === [] ? [itemRow()] : $positions]],
        ...$input,
    ]);
}

/** Organization data the EN 16931 profile requires (fictional). */
function completeOrganization(): void
{
    Organization::current()->forceFill([
        'name' => 'Studio Nordlicht', 'street' => 'Speicherstraße 12', 'zip' => '20457', 'city' => 'Hamburg', 'country' => 'DE',
        'vat_id' => 'DE123456789', 'iban' => 'DE02120300000000202051',
    ])->save();
}
```

- [ ] **Step 2: Failing test schreiben**

`tests/Feature/Actions/DraftActionsTest.php`:

```php
<?php

use App\Actions\CreateDocument;
use App\Actions\DeleteDraft;
use App\Actions\UpdateDraft;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\EventAction;
use App\Enums\FieldScope;
use App\Enums\FieldType;
use App\Enums\PositionKind;
use App\Enums\TextBlockKind;
use App\Exceptions\ActionNotAllowedException;
use App\Exceptions\DocumentLockedException;
use App\Models\Contact;
use App\Models\Customer;
use App\Models\Document;
use App\Models\DocumentEvent;
use App\Models\DocumentTypeSetting;
use App\Models\FieldDefinition;
use App\Models\Template;
use App\Models\TextBlock;
use App\Models\User;
use App\Support\Actor;
use Illuminate\Validation\ValidationException;

/** @return array<string, list<string>> */
function draftErrors(Closure $run): array
{
    try {
        $run();
    } catch (ValidationException $e) {
        return $e->errors();
    }

    return [];
}

it('creates a draft with the defaults of its document type', function () {
    $intro = TextBlock::factory()->create(['kind' => TextBlockKind::Intro, 'body' => 'Thank you for the good cooperation.']);
    $template = Template::factory()->create();
    DocumentTypeSetting::query()->whereKey('invoice')->update(['default_intro_block_id' => $intro->id, 'template_id' => $template->id]);
    FieldDefinition::factory()->create(['key' => 'project_name', 'default_value' => 'Relaunch', 'doc_types' => ['invoice']]);
    FieldDefinition::factory()->create(['key' => 'offer_note', 'default_value' => 'only offers', 'doc_types' => ['offer']]);
    $customer = Customer::factory()->create(['locale' => 'de']);
    $contact = Contact::factory()->for($customer)->create(['is_default' => true]);
    $user = User::factory()->create();

    $document = app(CreateDocument::class)->handle(Actor::user($user), ['type' => 'invoice', 'customer_id' => $customer->id, 'date' => '2026-10-11']);

    expect($document->status)->toBe(DocumentStatus::Draft)
        ->and($document->number)->toBeNull()
        ->and($document->contact_id)->toBe($contact->id)
        ->and($document->service_date?->toDateString())->toBe('2026-10-11')
        ->and($document->due_date?->toDateString())->toBe('2026-10-25')
        ->and($document->valid_until)->toBeNull()
        ->and($document->intro)->toBe('Thank you for the good cooperation.')
        ->and($document->template_id)->toBe($template->id)
        ->and($document->locale)->toBe('de')
        ->and($document->custom)->toBe(['project_name' => 'Relaunch'])
        ->and($document->created_by)->toBe($user->id)
        ->and($document->groups)->toHaveCount(1)
        ->and($document->groups[0]->title)->toBeNull()
        ->and($document->events()->pluck('action')->all())->toBe([EventAction::Created]);
});

it('sets valid until for offers and accepts groups right away', function () {
    $document = draft(DocumentType::Offer, [itemRow('Workshop', '1', '890'), itemRow('Hosting', '12', '49', ['kind' => 'optional'])], ['date' => '2026-10-01']);

    expect($document->valid_until?->toDateString())->toBe('2026-10-31')
        ->and($document->groups[0]->positions->pluck('kind')->all())->toBe([PositionKind::Item, PositionKind::Optional])
        ->and($document->net_total)->toBe('890.00')
        ->and($document->gross_total)->toBe('1059.10')
        ->and($document->events()->pluck('action')->all())->toBe([EventAction::Created, EventAction::Updated]);
});

it('refuses to create a cancellation without an invoice', function () {
    expect(fn () => app(CreateDocument::class)->handle(systemActor(), ['type' => 'cancellation']))
        ->toThrow(ActionNotAllowedException::class);
});

it('saves only the given fields and recomputes the totals', function () {
    $document = draft(DocumentType::Invoice, [itemRow('Consulting', '10', '95')]);

    $updated = app(UpdateDraft::class)->handle(systemActor(), $document, ['intro' => 'Hello']);
    expect($updated->intro)->toBe('Hello')
        ->and($updated->groups[0]->positions)->toHaveCount(1)
        ->and($updated->gross_total)->toBe('1130.50');

    $updated = app(UpdateDraft::class)->handle(systemActor(), $updated, ['groups' => [
        ['title' => 'Umsetzung', 'positions' => [itemRow('Frontend', '52', '95'), ['kind' => 'text', 'title' => 'Two review rounds included.']]],
    ]]);
    expect($updated->groups->pluck('title')->all())->toBe(['Umsetzung'])
        ->and($updated->net_total)->toBe('4940.00')
        ->and($updated->tax_total)->toBe('938.60');
});

it('switches to the default contact of a new customer', function () {
    $document = draft();
    $customer = Customer::factory()->create();
    $contact = Contact::factory()->for($customer)->create(['is_default' => true]);

    expect(app(UpdateDraft::class)->handle(systemActor(), $document, ['customer_id' => $customer->id])->contact_id)->toBe($contact->id);
});

it('rejects invalid input with paths and saves nothing', function () {
    FieldDefinition::factory()->create(['scope' => FieldScope::Document, 'key' => 'po_number', 'label' => 'PO number', 'doc_types' => ['invoice']]);
    FieldDefinition::factory()->create(['scope' => FieldScope::Position, 'key' => 'ticket', 'label' => 'Ticket', 'type' => FieldType::Select, 'options' => ['SHOP-142'], 'doc_types' => ['invoice']]);
    $document = draft(DocumentType::Invoice, [itemRow('Consulting', '1', '100')]);
    $foreignContact = Contact::factory()->create();

    $errors = draftErrors(fn () => app(UpdateDraft::class)->handle(systemActor(), $document, [
        'intro' => 'must not be saved',
        'contact_id' => $foreignContact->id,
        'custom' => ['po_number' => 7, 'offer_note' => 'x'],
        'groups' => [['title' => null, 'positions' => [
            itemRow('A', '12,5'),
            itemRow('B', '1', '100', ['custom' => ['ticket' => 'SHOP-999']]),
            itemRow('C', '1', '100', ['kind' => 'optional']),
        ]]],
    ]));

    expect(array_keys($errors))->toBe(['groups.0.positions.0.quantity'])
        ->and($document->fresh()->intro)->not->toBe('must not be saved');

    $errors = draftErrors(fn () => app(UpdateDraft::class)->handle(systemActor(), $document, [
        'contact_id' => $foreignContact->id,
        'custom' => ['po_number' => 7, 'offer_note' => 'x'],
        'groups' => [['title' => null, 'positions' => [
            itemRow('B', '1', '100', ['custom' => ['ticket' => 'SHOP-999']]),
            itemRow('C', '1', '100', ['kind' => 'optional']),
            itemRow('D', '1', 12.5),
        ]]],
    ]));

    expect(array_keys($errors))->toBe(['groups.0.positions.2.unit_price']);

    $errors = draftErrors(fn () => app(UpdateDraft::class)->handle(systemActor(), $document, [
        'contact_id' => $foreignContact->id,
        'custom' => ['po_number' => 7, 'offer_note' => 'x'],
        'groups' => [['title' => null, 'positions' => [
            itemRow('B', '1', '100', ['custom' => ['ticket' => 'SHOP-999']]),
            itemRow('C', '1', '100', ['kind' => 'optional']),
        ]]],
    ]));

    expect(array_keys($errors))->toBe([
        'custom.po_number',
        'custom.offer_note',
        'groups.0.positions.0.custom.ticket',
        'groups.0.positions.1.kind',
        'contact_id',
    ])
        ->and($errors['custom.po_number'][0])->toBe('PO number must be text.')
        ->and($document->fresh()->groups[0]->positions->pluck('title')->all())->toBe(['Consulting']);
});

it('refuses to update or delete a finalized document, also after a racing finalize', function () {
    $document = draft();
    $stale = Document::query()->findOrFail($document->id);
    Document::query()->whereKey($document->id)->update(['number' => 'INV-1', 'status' => 'open', 'finalized_at' => now()]);

    expect(fn () => app(UpdateDraft::class)->handle(systemActor(), $stale, ['intro' => 'late autosave']))->toThrow(DocumentLockedException::class)
        ->and(fn () => app(DeleteDraft::class)->handle(systemActor(), $document->fresh()))->toThrow(DocumentLockedException::class)
        ->and($document->fresh()->intro)->not->toBe('late autosave')
        ->and($document->fresh()->positions()->count())->toBe(1);
});

it('deletes a draft and keeps the event', function () {
    $document = draft();

    app(DeleteDraft::class)->handle(systemActor(), $document);

    expect(Document::query()->count())->toBe(0)
        ->and(DocumentEvent::query()->where('action', EventAction::Deleted)->value('payload'))->toMatchArray(['type' => 'invoice']);
});
```

- [ ] **Step 3: Test laufen lassen, er muss scheitern**

Run: `ddev artisan test --filter=DraftActionsTest`
Expected: FAIL mit `Class "App\Actions\CreateDocument" not found`

- [ ] **Step 4: UpdateDraft**

`app/Actions/UpdateDraft.php`:

```php
<?php

namespace App\Actions;

use App\Domain\Fields\CustomValueValidator;
use App\Domain\Fields\FieldRegistry;
use App\Enums\DocumentType;
use App\Enums\EventAction;
use App\Enums\FieldScope;
use App\Enums\PositionKind;
use App\Exceptions\DocumentLockedException;
use App\Models\Contact;
use App\Models\Document;
use App\Rules\DecimalString;
use App\Support\Actor;
use App\Support\DocumentInspector;
use App\Support\DomainMapper;
use App\Support\EventLog;
use App\Support\FieldErrors;
use App\Support\GroupWriter;
use App\Support\Text;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Saves a draft (autosave target). Missing top-level keys stay as they are; `groups`, when given,
 * replaces all groups and positions (ids of this document's own groups/positions are kept).
 * Required custom fields are checked when finalizing, not here.
 */
final class UpdateDraft
{
    private const FIELDS = ['date', 'customer_id', 'contact_id', 'service_date', 'service_date_end', 'due_date', 'valid_until', 'intro', 'closing', 'template_id', 'locale', 'custom'];

    public function __construct(private readonly DocumentInspector $inspector) {}

    /**
     * @param  array<string, mixed>  $input
     *
     * @throws DocumentLockedException|ValidationException
     */
    public function handle(Actor $actor, Document $document, array $input): Document
    {
        if ($document->isFinalized()) {
            throw DocumentLockedException::for($document);
        }

        $data = Validator::make($input, self::rules())->validate();
        $data = $this->checkDomain($document, $data);

        return DB::transaction(function () use ($actor, $document, $data): Document {
            // re-read with a row lock: a finalize that won the race must not be overwritten
            $draft = Document::query()->lockForUpdate()->findOrFail($document->id);
            if ($draft->isFinalized()) {
                throw DocumentLockedException::for($draft);
            }

            $draft->fill(Arr::only($data, self::FIELDS));
            if (array_key_exists('customer_id', $data) && ! array_key_exists('contact_id', $data) && $draft->isDirty('customer_id')) {
                $draft->contact_id = $data['customer_id'] === null
                    ? null
                    : Contact::query()->where('customer_id', $data['customer_id'])->where('is_default', true)->value('id');
            }
            $draft->save();

            if (array_key_exists('groups', $data)) {
                GroupWriter::replace($draft, $data['groups']);
            }
            $draft->load('groups.positions');
            $this->inspector->applyTotals($draft, $this->inspector->totals($draft));
            $draft->save();

            EventLog::record($draft, $actor, EventAction::Updated, ['fields' => array_keys($data)]);

            return $draft;
        });
    }

    /**
     * @return array<string, mixed>
     */
    private static function rules(): array
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
     * Custom values (type, option, valid for this document type), optional positions and contact ↔ customer.
     * Returns $data with normalized custom values.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    private function checkDomain(Document $document, array $data): array
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

Reihenfolge der Fehlerpfade: erst eigene Felder (Dokument, dann Positionen), dann `kind`, dann `contact_id` – so prüft es der Test. Laravels Strukturfehler (z. B. `"12,5"`, JSON-Zahl `12.5`) kommen vorher allein, weil `validate()` zuerst wirft.

- [ ] **Step 5: CreateDocument**

`app/Actions/CreateDocument.php`:

```php
<?php

namespace App\Actions;

use App\Domain\Fields\FieldRegistry;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\EventAction;
use App\Enums\FieldScope;
use App\Exceptions\ActionNotAllowedException;
use App\Models\Customer;
use App\Models\Document;
use App\Models\DocumentTypeSetting;
use App\Models\Organization;
use App\Support\Actor;
use App\Support\DomainMapper;
use App\Support\EventLog;
use App\Support\GroupWriter;
use Carbon\CarbonImmutable;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * New draft with the defaults of its document type. Any further draft field in $input goes through
 * UpdateDraft in the same transaction, so invalid input leaves nothing behind.
 * Cancellations only come from an invoice (CancelInvoice).
 */
final class CreateDocument
{
    public function __construct(private readonly UpdateDraft $updateDraft) {}

    /**
     * @param  array<string, mixed>  $input
     *
     * @throws ActionNotAllowedException|ValidationException
     */
    public function handle(Actor $actor, array $input): Document
    {
        $data = Validator::make($input, [
            'type' => ['required', Rule::enum(DocumentType::class)],
            'customer_id' => ['sometimes', 'nullable', 'string', Rule::exists('customers', 'id')->whereNull('deleted_at')],
            'date' => ['sometimes', 'required', 'date_format:Y-m-d'],
        ])->validate();

        $type = DocumentType::from($data['type']);
        if ($type === DocumentType::Cancellation) {
            throw ActionNotAllowedException::cancellationNeedsInvoice();
        }

        return DB::transaction(function () use ($actor, $input, $data, $type): Document {
            $setting = DocumentTypeSetting::query()->with(['introBlock', 'closingBlock'])->findOrFail($type->value);
            $customer = isset($data['customer_id']) ? Customer::query()->findOrFail($data['customer_id']) : null;
            $date = CarbonImmutable::parse($data['date'] ?? now()->toDateString());
            $fields = FieldRegistry::forScope(DomainMapper::currentFieldDefinitions(), FieldScope::Document, $type);

            $document = new Document;
            $document->forceFill([
                'type' => $type,
                'status' => DocumentStatus::Draft,
                'date' => $date->toDateString(),
                'customer_id' => $customer?->id,
                'contact_id' => $customer?->contacts()->where('is_default', true)->value('id'),
                'service_date' => $type === DocumentType::Invoice ? $date->toDateString() : null,
                'due_date' => $type === DocumentType::Invoice && $setting->payment_term_days !== null
                    ? $date->addDays($setting->payment_term_days)->toDateString() : null,
                'valid_until' => $type === DocumentType::Offer && $setting->validity_days !== null
                    ? $date->addDays($setting->validity_days)->toDateString() : null,
                'intro' => $setting->introBlock?->body ?? '',
                'closing' => $setting->closingBlock?->body ?? '',
                'template_id' => $setting->template_id,
                'locale' => $customer?->locale ?? Organization::current()->locale,
                'custom' => FieldRegistry::defaults($fields),
                'net_total' => '0.00',
                'tax_total' => '0.00',
                'gross_total' => '0.00',
                'created_by' => $actor->userId,
            ])->save();

            GroupWriter::replace($document, [['title' => null, 'positions' => []]]);
            EventLog::record($document, $actor, EventAction::Created, ['type' => $type->value]);

            $rest = Arr::except($input, ['type', 'customer_id', 'date']);

            return $rest === [] ? $document->load('groups.positions') : $this->updateDraft->handle($actor, $document, $rest);
        });
    }
}
```

- [ ] **Step 6: Test laufen lassen**

Run: `ddev artisan test --filter=DraftActionsTest`
Expected: PASS. Rechnung zur Prüfung: 52 × 95,00 = 4.940,00 netto, 19 % = 938,60; Angebot 890,00 + 19 % = 1.059,10 (die optionale Position zählt nicht).

- [ ] **Step 7: Volle Suite, statische Analyse, Format**

```bash
ddev artisan test
ddev exec vendor/bin/phpstan analyse --memory-limit=1G
ddev exec vendor/bin/pint --test
```

Expected: alles grün.

- [ ] **Step 8: Commit**

```bash
git add app/Actions tests/Pest.php tests/Feature/Actions/DraftActionsTest.php
git commit -m "feat(actions): create and update drafts with validated custom fields and totals

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 11: Nummernvergabe und Abschließen (lockForUpdate, Snapshot, Archiver-Haken)

Port von `allocateNumber` (`numbering.ts`) und `finalizeDocument` (`documents.ts`). `FinalizeDocument` läuft komplett in einer Transaktion: Zeile sperren → Prüfprofil → (Storno: Rechnung sperren und prüfen) → Nummer → Summen → Status/`finalized_at` → Snapshot → Rechnung auf `cancelled` → `DocumentArchiver` → Event. Jeder Fehler rollt alles zurück.

Die Parallelität wird echt getestet: eine eigene Pest-Suite `Integration` mit `DatabaseMigrations` (committete Daten statt Test-Transaktion), Kindprozesse über Laravels `Concurrency`-Facade (Treiber `process`) und ein Lock-Wait-Test mit einer zweiten DB-Verbindung.

**Files:**
- Create: `app/Actions/AllocateDocumentNumber.php`, `app/Actions/FinalizeDocument.php`
- Modify: `phpunit.xml` (Suite `Integration`), `tests/Pest.php` (Suite-Zuordnung)
- Test: `tests/Feature/Actions/AllocateDocumentNumberTest.php`, `tests/Feature/Actions/FinalizeDocumentTest.php`, `tests/Integration/NumberAllocationTest.php`

**Interfaces:**
- Consumes: `NumberFormatter` (Task 3), `StatusMachine` (Task 3), `NumberSequence`, `Document`, `DocumentSnapshot` (Task 6), `DocumentInspector`, `SnapshotBuilder`, `EventLog`, `DocumentArchiver`, `ComplianceFailedException`, `ActionNotAllowedException` (Task 7), Helfer `draft()`, `completeOrganization()` (Task 10).
- Produces:
  - `AllocateDocumentNumber::handle(DocumentType $type, string $date): string` – nur innerhalb einer Transaktion (`LogicException` sonst); sperrt die Konfigurationszeile (`year IS NULL`) per `lockForUpdate`, bei jährlichem Reset zusätzlich die Jahreszeile (legt sie mit `next_value = 1` an); überspringt Nummern, die schon ein Dokument trägt.
  - `AllocateDocumentNumber::preview(DocumentType $type, string $date): string` – nächste Nummer ohne Sperre und ohne Reservierung (Phase 7: Vorschau im Nummernkreis-Formular).
  - `FinalizeDocument::handle(Actor $actor, Document $document): Document` – Rückgabe mit `groups.positions` und `snapshot`.

- [ ] **Step 1: Suite `Integration` anlegen**

In `phpunit.xml` nach der Suite `Feature` einfügen:

```xml
        <testsuite name="Integration">
            <directory>tests/Integration</directory>
        </testsuite>
```

In `tests/Pest.php` den Import `use Illuminate\Foundation\Testing\DatabaseMigrations;` ergänzen und nach der `Feature`-Zeile einfügen:

```php
/*
 * Integration tests need committed data (other processes and connections must see it), so they
 * migrate per test instead of wrapping it in a transaction. DatabaseMigrations resets
 * RefreshDatabaseState afterwards, so later Feature tests migrate again.
 */
pest()->extend(TestCase::class)->use(DatabaseMigrations::class)->in('Integration');
```

- [ ] **Step 2: Failing tests schreiben**

`tests/Feature/Actions/AllocateDocumentNumberTest.php` (Port von `numbering.test.ts`):

```php
<?php

use App\Actions\AllocateDocumentNumber;
use App\Enums\DocumentType;
use App\Models\Document;
use App\Models\NumberSequence;
use Illuminate\Support\Facades\DB;

function configureInvoiceNumbers(string $pattern, bool $resetYearly, int $next = 1, array $years = []): void
{
    NumberSequence::query()->where('doc_type', 'invoice')->whereNotNull('year')->delete();
    NumberSequence::query()->where('doc_type', 'invoice')->whereNull('year')
        ->update(['pattern' => $pattern, 'reset_yearly' => $resetYearly, 'next_value' => $next]);
    foreach ($years as $year => $value) {
        NumberSequence::query()->create(['doc_type' => 'invoice', 'year' => $year, 'pattern' => $pattern, 'next_value' => $value, 'reset_yearly' => true]);
    }
}

function allocateInvoiceNumber(string $date): string
{
    return DB::transaction(fn () => app(AllocateDocumentNumber::class)->handle(DocumentType::Invoice, $date));
}

it('keeps separate counters per year when backdating', function () {
    configureInvoiceNumbers('RE-{YYYY}-{0000}', true, years: [2026 => 5, 2025 => 8]);

    expect(allocateInvoiceNumber('2025-12-30'))->toBe('RE-2025-0008')
        ->and(allocateInvoiceNumber('2026-10-04'))->toBe('RE-2026-0005')
        ->and(allocateInvoiceNumber('2026-10-05'))->toBe('RE-2026-0006');
});

it('starts a fresh year at 1', function () {
    configureInvoiceNumbers('{YYYY}-{000}', true, years: [2026 => 42]);

    expect(allocateInvoiceNumber('2025-06-01'))->toBe('2025-001')
        ->and(allocateInvoiceNumber('2026-01-02'))->toBe('2026-042');
});

it('uses one running counter without yearly reset', function () {
    configureInvoiceNumbers('RE-{0000}', false, 7);

    expect(allocateInvoiceNumber('2025-01-01'))->toBe('RE-0007')
        ->and(NumberSequence::query()->where('doc_type', 'invoice')->whereNull('year')->value('next_value'))->toBe(8);
});

it('skips numbers that are already taken after a manual change', function () {
    configureInvoiceNumbers('RE-{0000}', false, 3);
    Document::factory()->finalized()->create(['number' => 'RE-0003']);
    Document::factory()->finalized()->create(['number' => 'RE-0004']);

    expect(allocateInvoiceNumber('2026-10-11'))->toBe('RE-0005');
});

it('previews the next number without reserving it', function () {
    configureInvoiceNumbers('RE-{YYYY}-{0000}', true, years: [2026 => 12]);

    expect(app(AllocateDocumentNumber::class)->preview(DocumentType::Invoice, '2026-10-11'))->toBe('RE-2026-0012')
        ->and(app(AllocateDocumentNumber::class)->preview(DocumentType::Invoice, '2027-01-01'))->toBe('RE-2027-0001')
        ->and(allocateInvoiceNumber('2026-10-11'))->toBe('RE-2026-0012');
});
```

`tests/Feature/Actions/FinalizeDocumentTest.php`:

```php
<?php

use App\Actions\FinalizeDocument;
use App\Actions\UpdateDraft;
use App\Contracts\DocumentArchiver;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\EventAction;
use App\Exceptions\ActionNotAllowedException;
use App\Exceptions\ComplianceFailedException;
use App\Exceptions\DocumentLockedException;
use App\Models\Contact;
use App\Models\Customer;
use App\Models\Document;
use App\Models\DocumentSnapshot;
use App\Models\DocumentTypeSetting;
use App\Models\FieldDefinition;
use App\Models\NumberSequence;
use App\Models\Organization;
use App\Models\TaxRate;
use App\Models\Template;
use App\Models\Unit;
use App\Support\DocumentInspector;

function invoiceCounter(): int
{
    return (int) NumberSequence::query()->where('doc_type', 'invoice')->where('year', (int) now()->format('Y'))->value('next_value');
}

it('assigns the number, locks the document, stores the snapshot and logs the event', function () {
    $document = draft(DocumentType::Invoice, [itemRow('Consulting', '10', '95')]);

    $done = app(FinalizeDocument::class)->handle(systemActor(), $document);

    expect($done->number)->toBe('INV-'.now()->format('Y').'-0001')
        ->and($done->status)->toBe(DocumentStatus::Open)
        ->and($done->finalized_at)->not->toBeNull()
        ->and($done->gross_total)->toBe('1130.50')
        ->and($done->snapshot)->toBeInstanceOf(DocumentSnapshot::class)
        ->and($done->snapshot->data['customer']['id'])->toBe($document->customer_id)
        ->and($done->events()->pluck('action')->last())->toBe(EventAction::Finalized)
        ->and(invoiceCounter())->toBe(2);
});

it('refuses to finalize twice', function () {
    $done = app(FinalizeDocument::class)->handle(systemActor(), draft());

    expect(fn () => app(FinalizeDocument::class)->handle(systemActor(), $done))->toThrow(DocumentLockedException::class);
});

it('refuses with the issue list when the profile check fails and uses no number', function () {
    DocumentTypeSetting::query()->whereKey('invoice')->update(['profile' => 'en16931']);
    FieldDefinition::factory()->create(['key' => 'po_number', 'label' => 'PO number', 'required' => true, 'doc_types' => ['invoice']]);
    $document = draft(DocumentType::Invoice, [itemRow()], ['customer_id' => null]);

    try {
        app(FinalizeDocument::class)->handle(systemActor(), $document);
        $this->fail('no exception');
    } catch (ComplianceFailedException $e) {
        expect(array_column($e->toArray(), 'path'))->toBe(['document.customer', 'document.custom.po_number', 'org.address', 'org.vat_id', 'org.iban'])
            ->and($e->toArray()[1]['message'])->toBe('PO number is missing.')
            ->and($e->status())->toBe(422);
    }

    expect($document->fresh()->status)->toBe(DocumentStatus::Draft)
        ->and($document->fresh()->number)->toBeNull()
        ->and(invoiceCounter())->toBe(0);
});

it('passes the e-invoice profile with complete data', function () {
    DocumentTypeSetting::query()->whereKey('invoice')->update(['profile' => 'en16931']);
    completeOrganization();

    expect(app(FinalizeDocument::class)->handle(systemActor(), draft())->status)->toBe(DocumentStatus::Open);
});

it('rolls everything back when the archiver fails, so the number stays free', function () {
    app()->bind(DocumentArchiver::class, fn () => new class implements DocumentArchiver
    {
        public function archive(Document $document, DocumentSnapshot $snapshot): void
        {
            throw new RuntimeException('Gotenberg is down');
        }
    });
    $document = draft();

    expect(fn () => app(FinalizeDocument::class)->handle(systemActor(), $document))->toThrow(RuntimeException::class, 'Gotenberg is down');

    expect($document->fresh()->status)->toBe(DocumentStatus::Draft)
        ->and($document->fresh()->number)->toBeNull()
        ->and($document->fresh()->finalized_at)->toBeNull()
        ->and(DocumentSnapshot::query()->count())->toBe(0)
        ->and(invoiceCounter())->toBe(0);

    app()->bind(DocumentArchiver::class, App\Support\NullDocumentArchiver::class);
    expect(app(FinalizeDocument::class)->handle(systemActor(), $document->fresh())->number)->toBe('INV-'.now()->format('Y').'-0001');
});

it('keeps the finalized document unchanged when master data changes afterwards', function () {
    $template = Template::factory()->create(['body' => '<h1>v1</h1>']);
    $field = FieldDefinition::factory()->create(['key' => 'project_name', 'label' => 'Project', 'doc_types' => ['invoice']]);
    $customer = Customer::factory()->create(['name' => 'Hafenkontor Lindqvist GmbH']);
    $contact = Contact::factory()->for($customer)->create(['first_name' => 'Mira']);
    $document = app(App\Actions\CreateDocument::class)->handle(systemActor(), [
        'type' => 'invoice', 'customer_id' => $customer->id, 'template_id' => $template->id,
        'groups' => [['title' => null, 'positions' => [itemRow('Consulting', '10', '95')]]],
    ]);
    $done = app(FinalizeDocument::class)->handle(systemActor(), $document);
    $before = $done->snapshot->data;

    Organization::current()->forceFill(['name' => 'Renamed', 'taxation_mode' => 'small_business'])->save();
    $customer->forceFill(['name' => 'Renamed customer', 'tax_treatment' => 'third_country'])->save();
    $contact->forceFill(['first_name' => 'Renamed'])->save();
    TaxRate::query()->whereKey(vatRateId())->update(['percent' => '25.00']);
    Unit::query()->whereKey(hourUnitId())->update(['name' => 'Renamed', 'code' => 'XXX']);
    $template->forceFill(['body' => '<h1>v2</h1>'])->save();
    $field->forceFill(['label' => 'Renamed'])->save();
    $customer->delete();

    $fresh = Document::query()->findOrFail($done->id);
    expect($fresh->snapshot->data)->toBe($before)
        ->and($before['customer']['name'])->toBe('Hafenkontor Lindqvist GmbH')
        ->and($before['contact']['first_name'])->toBe('Mira')
        ->and($before['template']['body'])->toBe('<h1>v1</h1>')
        ->and($before['field_definitions'][0]['label'])->toBe('Project')
        ->and($fresh->gross_total)->toBe('1130.50')
        ->and(app(DocumentInspector::class)->totals($fresh)->toArray()['gross'])->toBe('1130.50')
        ->and(fn () => app(UpdateDraft::class)->handle(systemActor(), $fresh, ['intro' => 'x']))->toThrow(DocumentLockedException::class);
});

it('refuses a cancellation whose invoice is no longer cancellable', function () {
    $invoice = draft();
    $cancellation = Document::factory()->type(DocumentType::Cancellation)->create(['customer_id' => $invoice->customer_id, 'source_id' => $invoice->id]);
    App\Support\GroupWriter::replace($cancellation, [['title' => null, 'positions' => [itemRow('Consulting', '-1', '100')]]]);

    expect(fn () => app(FinalizeDocument::class)->handle(systemActor(), $cancellation->fresh()))
        ->toThrow(ActionNotAllowedException::class);
});
```

`tests/Integration/NumberAllocationTest.php`:

```php
<?php

use App\Actions\AllocateDocumentNumber;
use App\Enums\DocumentType;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Concurrency;
use Illuminate\Support\Facades\DB;

it('never hands out the same number to parallel processes', function () {
    // static: the closure is serialized for the child processes and must not capture the test case
    $task = static function (): array {
        $numbers = [];
        for ($i = 0; $i < 5; $i++) {
            $numbers[] = Illuminate\Support\Facades\DB::transaction(
                fn () => app(App\Actions\AllocateDocumentNumber::class)->handle(App\Enums\DocumentType::Invoice, '2026-10-11'),
            );
        }

        return ['database' => Illuminate\Support\Facades\DB::connection()->getDatabaseName(), 'numbers' => $numbers];
    };

    $results = Concurrency::driver('process')->run(array_fill(0, 6, $task));

    $numbers = array_merge(...array_column($results, 'numbers'));
    sort($numbers);

    expect(array_unique(array_column($results, 'database')))->toBe(['testing'])
        ->and($numbers)->toBe(array_map(fn (int $n): string => sprintf('INV-2026-%04d', $n), range(1, 30)));
});

it('makes a second connection wait while the first one holds the number range', function () {
    $name = config('database.default');
    config(["database.connections.{$name}_second" => config("database.connections.{$name}")]);
    $second = DB::connection("{$name}_second");
    $second->statement('SET SESSION innodb_lock_wait_timeout = 1');
    $lockRow = fn () => $second->table('number_sequences')->where('doc_type', 'invoice')->whereNull('year')->lockForUpdate()->first();

    DB::beginTransaction();
    $first = app(AllocateDocumentNumber::class)->handle(DocumentType::Invoice, '2026-10-11');

    $second->beginTransaction();
    expect($lockRow)->toThrow(QueryException::class, 'Lock wait timeout');
    $second->rollBack();

    DB::commit();

    $second->beginTransaction();
    expect($lockRow())->not->toBeNull();
    $second->rollBack();

    expect($first)->toBe('INV-2026-0001')
        ->and(DB::transaction(fn () => app(AllocateDocumentNumber::class)->handle(DocumentType::Invoice, '2026-10-11')))->toBe('INV-2026-0002');
});

// Feature tests always run inside the RefreshDatabase transaction, so the guard is only testable here
it('refuses to allocate outside a transaction', function () {
    app(AllocateDocumentNumber::class)->handle(DocumentType::Invoice, '2026-10-11');
})->throws(LogicException::class);
```

Die Closure für `Concurrency` nutzt voll qualifizierte Namen, weil sie serialisiert im Kindprozess läuft (`php artisan invoke-serialized-closure`). Der Kindprozess erbt die Umgebung des Testprozesses (`DB_DATABASE=testing` aus `phpunit.xml`); die Assertion auf `database` beweist das. Zeigt sie `db` statt `testing`, gilt `.env` statt `phpunit.xml`: dann in der Closure vor der Schleife `config(['database.connections.mariadb.database' => 'testing']); DB::purge();` ergänzen.

- [ ] **Step 3: Tests laufen lassen, sie müssen scheitern**

Run: `ddev artisan test --filter='AllocateDocumentNumberTest|FinalizeDocumentTest|NumberAllocationTest'`
Expected: FAIL mit `Class "App\Actions\AllocateDocumentNumber" not found`

- [ ] **Step 4: AllocateDocumentNumber**

`app/Actions/AllocateDocumentNumber.php`:

```php
<?php

namespace App\Actions;

use App\Domain\Numbering\NumberFormatter;
use App\Enums\DocumentType;
use App\Models\Document;
use App\Models\NumberSequence;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use LogicException;

/**
 * Hands out the next number of a range. The configuration row (year NULL) is locked with
 * SELECT … FOR UPDATE until the surrounding transaction ends, so parallel finalizations wait for
 * each other; a rollback (failed finalize) gives the number back.
 */
final class AllocateDocumentNumber
{
    public function handle(DocumentType $type, string $date): string
    {
        if (DB::transactionLevel() === 0) {
            throw new LogicException('AllocateDocumentNumber must run inside a database transaction.');
        }

        $day = CarbonImmutable::parse($date);
        $config = NumberSequence::query()->where('doc_type', $type->value)->whereNull('year')->lockForUpdate()->firstOrFail();

        $counter = $config;
        if ($config->reset_yearly) {
            $year = (int) $day->format('Y');
            $counter = NumberSequence::query()->where('doc_type', $type->value)->where('year', $year)->lockForUpdate()->first()
                ?? NumberSequence::query()->create([
                    'doc_type' => $type,
                    'year' => $year,
                    'pattern' => $config->pattern,
                    'next_value' => 1,
                    'reset_yearly' => true,
                ]);
        }

        // pattern or counter changed by hand: skip numbers that already exist instead of failing on the unique index
        do {
            $sequence = $counter->next_value;
            $number = NumberFormatter::format($config->pattern, $day, $sequence);
            $counter->next_value = $sequence + 1;
        } while (Document::query()->where('number', $number)->exists());

        $counter->save();

        return $number;
    }

    /** The number the next finalize on $date would get; nothing is locked or reserved. */
    public function preview(DocumentType $type, string $date): string
    {
        $day = CarbonImmutable::parse($date);
        $config = NumberSequence::query()->where('doc_type', $type->value)->whereNull('year')->firstOrFail();
        $next = $config->reset_yearly
            ? (int) (NumberSequence::query()->where('doc_type', $type->value)->where('year', (int) $day->format('Y'))->value('next_value') ?? 1)
            : $config->next_value;

        return NumberFormatter::format($config->pattern, $day, $next);
    }
}
```

- [ ] **Step 5: FinalizeDocument**

`app/Actions/FinalizeDocument.php`:

```php
<?php

namespace App\Actions;

use App\Contracts\DocumentArchiver;
use App\Domain\Lifecycle\StatusMachine;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\EventAction;
use App\Exceptions\ActionNotAllowedException;
use App\Exceptions\ComplianceFailedException;
use App\Exceptions\DocumentLockedException;
use App\Models\Document;
use App\Support\Actor;
use App\Support\DocumentInspector;
use App\Support\EventLog;
use App\Support\SnapshotBuilder;
use Illuminate\Support\Facades\DB;

/**
 * Draft → open (cancellation: closed). One transaction: check profile, allocate number, freeze master
 * data (snapshot), mark the invoice of a cancellation as cancelled, archive (phase 3: PDF/XML), log.
 * Any exception rolls everything back; the number stays free.
 */
final class FinalizeDocument
{
    public function __construct(
        private readonly AllocateDocumentNumber $numbers,
        private readonly DocumentInspector $inspector,
        private readonly SnapshotBuilder $snapshots,
        private readonly DocumentArchiver $archiver,
    ) {}

    /**
     * @throws DocumentLockedException|ComplianceFailedException|ActionNotAllowedException
     */
    public function handle(Actor $actor, Document $document): Document
    {
        return DB::transaction(function () use ($actor, $document): Document {
            $draft = Document::query()->lockForUpdate()->findOrFail($document->id);
            if ($draft->isFinalized()) {
                throw DocumentLockedException::for($draft);
            }
            $draft->load('groups.positions');

            $sources = $this->snapshots->build($draft);
            $issues = $this->inspector->issues($draft, $sources);
            if ($issues !== []) {
                throw new ComplianceFailedException($issues);
            }

            $invoice = null;
            if ($draft->type === DocumentType::Cancellation) {
                $invoice = $draft->source_id === null ? null : Document::query()->lockForUpdate()->find($draft->source_id);
                if ($invoice === null
                    || $invoice->type !== DocumentType::Invoice
                    || ! in_array($invoice->status, [DocumentStatus::Open, DocumentStatus::Paid], true)
                    || $invoice->cancelled_by_id !== null) {
                    throw ActionNotAllowedException::cancellationSource();
                }
            }

            $this->inspector->applyTotals($draft, $this->inspector->totals($draft, $sources));
            $draft->forceFill([
                'number' => $this->numbers->handle($draft->type, $draft->date->toDateString()),
                'status' => StatusMachine::finalizedStatus($draft->type),
                'finalized_at' => now(),
            ])->save();
            $snapshot = $draft->snapshot()->create(['data' => $sources]);

            if ($invoice !== null) {
                $invoice->forceFill(['status' => DocumentStatus::Cancelled, 'cancelled_by_id' => $draft->id])->save();
                EventLog::record($invoice, $actor, EventAction::Cancelled, ['cancellation_id' => $draft->id, 'number' => $draft->number]);
            }

            $this->archiver->archive($draft, $snapshot);
            EventLog::record($draft, $actor, EventAction::Finalized, ['number' => $draft->number]);

            return $draft->load(['groups.positions', 'snapshot']);
        });
    }
}
```

- [ ] **Step 6: Tests laufen lassen**

```bash
ddev artisan test --filter='AllocateDocumentNumberTest|FinalizeDocumentTest'
ddev artisan test --testsuite=Integration
```

Expected: PASS. Die Integration-Suite braucht ein paar Sekunden (sechs Kindprozesse, ein Lock-Wait von 1 s).

Prüfwerte: Rechnung 10 × 95,00 = 950,00 + 19 % = 1.130,50. Bei der Prüfung ohne Kunden und mit EN 16931 fehlen Kunde, `po_number` und die drei Organisationsangaben; `customer.*` entfällt ohne Kunden, `document.service_date`/`due_date` sind durch `CreateDocument` gesetzt.

- [ ] **Step 7: Volle Suite, statische Analyse, Format**

```bash
ddev artisan test
ddev exec vendor/bin/phpstan analyse --memory-limit=1G
ddev exec vendor/bin/pint --test
```

Expected: alles grün; `ddev artisan test` führt die Suiten `Unit`, `Feature`, `Integration` aus.

- [ ] **Step 8: Commit**

```bash
git add app/Actions phpunit.xml tests/Pest.php tests/Feature/Actions/AllocateDocumentNumberTest.php tests/Feature/Actions/FinalizeDocumentTest.php tests/Integration
git commit -m "feat(actions): finalize documents with locked number allocation, snapshot and archiver hook

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 12: Status setzen, Umwandeln, Stornieren, Duplizieren – und der Hauptablauf

Port von `setDocumentStatus`, `convertDocumentTo`, `duplicateDocument` aus `documents.ts`. Ein Storno-Entwurf zählt schon als Storno: ein zweiter Aufruf liefert denselben Entwurf zurück. Der Abschlusstest spielt den Hauptablauf aus Spec Abschnitt 1 über die Actions durch (Angebot → angenommen → Rechnung → E-Rechnungsprüfung grün → abschließen → bezahlt → Storno).

**Files:**
- Create: `app/Actions/SetDocumentStatus.php`, `app/Actions/ConvertDocument.php`, `app/Actions/CancelInvoice.php`, `app/Actions/DuplicateDocument.php`, `app/Support/ConversionResult.php`
- Test: `tests/Feature/Actions/DocumentFlowTest.php`

**Interfaces:**
- Consumes: `StatusMachine` (Task 3), `DocumentConverter` (Task 5), `DomainMapper`, `GroupWriter`, `DocumentInspector`, `EventLog`, `ActionNotAllowedException` (Task 7), `CreateDocument` (Task 10), `FinalizeDocument` (Task 11).
- Produces:
  - `SetDocumentStatus::handle(Actor $actor, Document $document, DocumentStatus $status): Document` (setzt `paid_at` bei `paid`)
  - `ConvertDocument::handle(Actor $actor, Document $source, DocumentType $target): ConversionResult`
  - `CancelInvoice::handle(Actor $actor, Document $invoice): ConversionResult`
  - `DuplicateDocument::handle(Actor $actor, Document $document): Document`
  - `ConversionResult{document: Document, droppedFields: list<string>}`

- [ ] **Step 1: Failing test schreiben**

`tests/Feature/Actions/DocumentFlowTest.php`:

```php
<?php

use App\Actions\CancelInvoice;
use App\Actions\ConvertDocument;
use App\Actions\CreateDocument;
use App\Actions\DuplicateDocument;
use App\Actions\FinalizeDocument;
use App\Actions\SetDocumentStatus;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\EventAction;
use App\Enums\FieldScope;
use App\Exceptions\ActionNotAllowedException;
use App\Models\Document;
use App\Models\DocumentTypeSetting;
use App\Models\FieldDefinition;
use App\Support\DocumentInspector;

function finalized(Document $document): Document
{
    return app(FinalizeDocument::class)->handle(systemActor(), $document);
}

it('sets statuses only along the allowed transitions and stamps paid_at', function () {
    $invoice = finalized(draft());

    expect(fn () => app(SetDocumentStatus::class)->handle(systemActor(), $invoice, DocumentStatus::Accepted))->toThrow(ActionNotAllowedException::class)
        ->and(fn () => app(SetDocumentStatus::class)->handle(systemActor(), draft(), DocumentStatus::Open))->toThrow(ActionNotAllowedException::class);

    $paid = app(SetDocumentStatus::class)->handle(systemActor(), $invoice, DocumentStatus::Paid);

    expect($paid->status)->toBe(DocumentStatus::Paid)
        ->and($paid->paid_at)->not->toBeNull()
        ->and($paid->events()->pluck('payload')->last())->toBe(['from' => 'open', 'to' => 'paid']);
});

it('converts an accepted offer into an invoice and reports dropped fields', function () {
    FieldDefinition::factory()->create(['scope' => FieldScope::Document, 'key' => 'project_name', 'doc_types' => ['offer', 'invoice']]);
    FieldDefinition::factory()->create(['scope' => FieldScope::Document, 'key' => 'response_time', 'doc_types' => ['offer']]);
    $offer = finalized(draft(DocumentType::Offer, [itemRow('Workshop', '1', '890'), itemRow('Hosting', '12', '49', ['kind' => 'optional'])], [
        'custom' => ['project_name' => 'Relaunch', 'response_time' => '48h'],
    ]));

    expect(fn () => app(ConvertDocument::class)->handle(systemActor(), $offer, DocumentType::Invoice))->toThrow(ActionNotAllowedException::class);

    $offer = app(SetDocumentStatus::class)->handle(systemActor(), $offer, DocumentStatus::Accepted);
    $result = app(ConvertDocument::class)->handle(systemActor(), $offer, DocumentType::Invoice);
    $invoice = $result->document;

    expect($invoice->type)->toBe(DocumentType::Invoice)
        ->and($invoice->status)->toBe(DocumentStatus::Draft)
        ->and($invoice->source_id)->toBe($offer->id)
        ->and($invoice->custom)->toBe(['project_name' => 'Relaunch'])
        ->and($result->droppedFields)->toBe(['document.response_time'])
        ->and($invoice->groups[0]->positions->pluck('title')->all())->toBe(['Workshop'])
        ->and($invoice->due_date?->toDateString())->toBe(now()->addDays(14)->toDateString())
        ->and($invoice->gross_total)->toBe('1059.10')
        ->and($invoice->events()->pluck('action')->all())->toBe([EventAction::ConvertedFrom])
        ->and($offer->events()->pluck('action')->last())->toBe(EventAction::Converted);
});

it('creates one cancellation per invoice with negated quantities', function () {
    $invoice = finalized(draft(DocumentType::Invoice, [itemRow('Consulting', '10', '95')]));

    $first = app(CancelInvoice::class)->handle(systemActor(), $invoice)->document;
    $second = app(CancelInvoice::class)->handle(systemActor(), $invoice)->document;

    expect($second->id)->toBe($first->id)
        ->and($first->type)->toBe(DocumentType::Cancellation)
        ->and($first->groups[0]->positions[0]->quantity)->toBe('-10.0000')
        ->and($first->gross_total)->toBe('-1130.50')
        ->and($invoice->fresh()->status)->toBe(DocumentStatus::Open);
});

it('closes the cancellation and marks the invoice as cancelled when finalizing', function () {
    $invoice = finalized(draft());
    $cancellation = finalized(app(CancelInvoice::class)->handle(systemActor(), $invoice)->document);

    expect($cancellation->status)->toBe(DocumentStatus::Closed)
        ->and($cancellation->number)->toStartWith('CN-')
        ->and($invoice->fresh()->status)->toBe(DocumentStatus::Cancelled)
        ->and($invoice->fresh()->cancelled_by_id)->toBe($cancellation->id)
        ->and($invoice->events()->pluck('action')->last())->toBe(EventAction::Cancelled)
        ->and(fn () => app(CancelInvoice::class)->handle(systemActor(), $invoice->fresh()))->toThrow(ActionNotAllowedException::class);
});

it('refuses to cancel offers and drafts', function () {
    expect(fn () => app(CancelInvoice::class)->handle(systemActor(), draft()))->toThrow(ActionNotAllowedException::class)
        ->and(fn () => app(CancelInvoice::class)->handle(systemActor(), finalized(draft(DocumentType::Offer))))->toThrow(ActionNotAllowedException::class);
});

it('duplicates a document as a fresh draft with new ids', function () {
    $source = finalized(draft(DocumentType::Invoice, [itemRow('Consulting', '10', '95')], ['intro' => 'Hello']));

    $copy = app(DuplicateDocument::class)->handle(systemActor(), $source);

    expect($copy->id)->not->toBe($source->id)
        ->and($copy->status)->toBe(DocumentStatus::Draft)
        ->and($copy->number)->toBeNull()
        ->and($copy->finalized_at)->toBeNull()
        ->and($copy->source_id)->toBeNull()
        ->and($copy->intro)->toBe('Hello')
        ->and($copy->date->toDateString())->toBe(now()->toDateString())
        ->and($copy->groups[0]->positions[0]->id)->not->toBe($source->groups[0]->positions[0]->id)
        ->and($copy->gross_total)->toBe('1130.50')
        ->and($copy->events()->pluck('action')->all())->toBe([EventAction::Duplicated]);
});

it('refuses to duplicate a cancellation', function () {
    $cancellation = app(CancelInvoice::class)->handle(systemActor(), finalized(draft()))->document;

    expect(fn () => app(DuplicateDocument::class)->handle(systemActor(), $cancellation))->toThrow(ActionNotAllowedException::class);
});

it('runs the main flow: offer → accepted → invoice → e-invoice check → paid → cancellation', function () {
    completeOrganization();
    DocumentTypeSetting::query()->whereIn('type', ['invoice', 'cancellation'])->update(['profile' => 'en16931']);

    $offer = app(CreateDocument::class)->handle(systemActor(), [
        'type' => 'offer',
        'customer_id' => App\Models\Customer::factory()->create()->id,
        'groups' => [
            ['title' => 'Konzept & UX', 'positions' => [itemRow('Discovery-Workshop', '1', '890')]],
            ['title' => 'Betrieb', 'positions' => [itemRow('Wartung & Updates', '12', '149', ['kind' => 'optional'])]],
        ],
    ]);
    $offer = app(SetDocumentStatus::class)->handle(systemActor(), finalized($offer), DocumentStatus::Accepted);

    $invoice = app(ConvertDocument::class)->handle(systemActor(), $offer, DocumentType::Invoice)->document;
    expect(app(DocumentInspector::class)->issues($invoice))->toBe([]);

    $invoice = app(SetDocumentStatus::class)->handle(systemActor(), finalized($invoice), DocumentStatus::Paid);
    $cancellation = finalized(app(CancelInvoice::class)->handle(systemActor(), $invoice)->document);

    $year = now()->format('Y');
    expect($offer->number)->toBe("Q-{$year}-0001")
        ->and($invoice->number)->toBe("INV-{$year}-0001")
        ->and($invoice->groups->pluck('title')->all())->toBe(['Konzept & UX'])
        ->and($cancellation->number)->toBe("CN-{$year}-0001")
        ->and($cancellation->gross_total)->toBe('-1059.10')
        ->and($invoice->fresh()->status)->toBe(DocumentStatus::Cancelled)
        ->and(Document::query()->count())->toBe(3);
});
```

- [ ] **Step 2: Test laufen lassen, er muss scheitern**

Run: `ddev artisan test --filter=DocumentFlowTest`
Expected: FAIL mit `Class "App\Actions\SetDocumentStatus" not found`

- [ ] **Step 3: Implementieren**

`app/Support/ConversionResult.php`:

```php
<?php

namespace App\Support;

use App\Models\Document;

final readonly class ConversionResult
{
    /**
     * @param  list<string>  $droppedFields  "document.<key>" / "position.<key>" not used by the target type
     */
    public function __construct(
        public Document $document,
        public array $droppedFields,
    ) {}
}
```

`app/Actions/SetDocumentStatus.php`:

```php
<?php

namespace App\Actions;

use App\Domain\Lifecycle\StatusMachine;
use App\Enums\DocumentStatus;
use App\Enums\EventAction;
use App\Exceptions\ActionNotAllowedException;
use App\Models\Document;
use App\Support\Actor;
use App\Support\EventLog;
use Illuminate\Support\Facades\DB;

/** Manual status change of a finalized document (accepted, rejected, done, paid). Leaving draft = FinalizeDocument. */
final class SetDocumentStatus
{
    /**
     * @throws ActionNotAllowedException
     */
    public function handle(Actor $actor, Document $document, DocumentStatus $status): Document
    {
        if (! $document->isFinalized() || ! StatusMachine::canSetManually($document->type, $document->status, $status)) {
            throw ActionNotAllowedException::statusTransition($document->status, $status);
        }

        return DB::transaction(function () use ($actor, $document, $status): Document {
            $from = $document->status;
            $document->forceFill([
                'status' => $status,
                'paid_at' => $status === DocumentStatus::Paid ? now() : $document->paid_at,
            ])->save();
            EventLog::record($document, $actor, EventAction::StatusChanged, ['from' => $from->value, 'to' => $status->value]);

            return $document;
        });
    }
}
```

`app/Actions/ConvertDocument.php`:

```php
<?php

namespace App\Actions;

use App\Domain\Conversion\DocumentConverter;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\EventAction;
use App\Exceptions\ActionNotAllowedException;
use App\Models\Document;
use App\Models\DocumentTypeSetting;
use App\Support\Actor;
use App\Support\ConversionResult;
use App\Support\DocumentInspector;
use App\Support\DomainMapper;
use App\Support\EventLog;
use App\Support\GroupWriter;
use Illuminate\Support\Facades\DB;

/**
 * Offer → confirmation/invoice, confirmation → invoice, invoice → cancellation (rules: DocumentConverter).
 * An existing cancellation draft of the invoice counts: it is returned instead of a second one.
 */
final class ConvertDocument
{
    public function __construct(private readonly DocumentInspector $inspector) {}

    /**
     * @throws ActionNotAllowedException
     */
    public function handle(Actor $actor, Document $source, DocumentType $target): ConversionResult
    {
        if (! DocumentConverter::canConvert($source->type, $source->status, $source->cancelled_by_id !== null, $target)) {
            throw ActionNotAllowedException::conversion($source->type, $target);
        }

        return DB::transaction(function () use ($actor, $source, $target): ConversionResult {
            if ($target === DocumentType::Cancellation) {
                $existing = Document::query()->where('source_id', $source->id)->where('type', DocumentType::Cancellation)->first();
                if ($existing !== null) {
                    return new ConversionResult($existing->load('groups.positions'), []);
                }
            }

            $source->loadMissing('groups.positions');
            $setting = DocumentTypeSetting::query()->findOrFail($target->value);
            $today = now()->toDateString();
            $plan = DocumentConverter::convert(
                DomainMapper::conversionSource($source),
                $target,
                $setting->payment_term_days,
                DomainMapper::currentFieldDefinitions(),
                $today,
            );

            $document = new Document;
            $document->forceFill([
                'type' => $target,
                'status' => DocumentStatus::Draft,
                'date' => $today,
                'customer_id' => $source->customer_id,
                'contact_id' => $source->contact_id,
                'service_date' => $plan->serviceDate,
                'service_date_end' => $plan->serviceDateEnd,
                'due_date' => $plan->dueDate,
                'valid_until' => null,
                'intro' => $source->intro,
                'closing' => $source->closing,
                'template_id' => $setting->template_id ?? $source->template_id,
                'locale' => $source->locale,
                'custom' => $plan->custom,
                'source_id' => $source->id,
                'created_by' => $actor->userId,
            ])->save();

            GroupWriter::replace($document, DomainMapper::groupRows($plan->groups));
            $document->load('groups.positions');
            $this->inspector->applyTotals($document, $this->inspector->totals($document));
            $document->save();

            EventLog::record($document, $actor, EventAction::ConvertedFrom, ['source_id' => $source->id, 'source_number' => $source->number]);
            EventLog::record($source, $actor, EventAction::Converted, ['target_id' => $document->id, 'type' => $target->value]);

            return new ConversionResult($document, $plan->droppedFields);
        });
    }
}
```

`app/Actions/CancelInvoice.php`:

```php
<?php

namespace App\Actions;

use App\Enums\DocumentType;
use App\Exceptions\ActionNotAllowedException;
use App\Models\Document;
use App\Support\Actor;
use App\Support\ConversionResult;

/** Creates (or returns) the cancellation draft of an open or paid invoice; finalizing it cancels the invoice. */
final class CancelInvoice
{
    public function __construct(private readonly ConvertDocument $convert) {}

    /**
     * @throws ActionNotAllowedException
     */
    public function handle(Actor $actor, Document $invoice): ConversionResult
    {
        if ($invoice->type !== DocumentType::Invoice) {
            throw ActionNotAllowedException::conversion($invoice->type, DocumentType::Cancellation);
        }

        return $this->convert->handle($actor, $invoice, DocumentType::Cancellation);
    }
}
```

`app/Actions/DuplicateDocument.php`:

```php
<?php

namespace App\Actions;

use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\EventAction;
use App\Exceptions\ActionNotAllowedException;
use App\Models\Document;
use App\Support\Actor;
use App\Support\DocumentInspector;
use App\Support\DomainMapper;
use App\Support\EventLog;
use App\Support\GroupWriter;
use Illuminate\Support\Facades\DB;

/** Copy as a new draft dated today, without number, chain or snapshot. Cancellations only come from invoices. */
final class DuplicateDocument
{
    public function __construct(private readonly DocumentInspector $inspector) {}

    /**
     * @throws ActionNotAllowedException
     */
    public function handle(Actor $actor, Document $document): Document
    {
        if ($document->type === DocumentType::Cancellation) {
            throw ActionNotAllowedException::duplicateCancellation();
        }

        return DB::transaction(function () use ($actor, $document): Document {
            $document->loadMissing('groups.positions');
            $copy = $document->replicate(['number', 'status', 'source_id', 'cancelled_by_id', 'finalized_at', 'paid_at', 'created_by']);
            $copy->setRelations([]);
            $copy->forceFill([
                'status' => DocumentStatus::Draft,
                'date' => now()->toDateString(),
                'created_by' => $actor->userId,
            ])->save();

            GroupWriter::replace($copy, DomainMapper::groupRows(DomainMapper::groups($document)));
            $copy->load('groups.positions');
            $this->inspector->applyTotals($copy, $this->inspector->totals($copy));
            $copy->save();

            EventLog::record($copy, $actor, EventAction::Duplicated, ['source_id' => $document->id]);

            return $copy;
        });
    }
}
```

- [ ] **Step 4: Test laufen lassen**

Run: `ddev artisan test --filter=DocumentFlowTest`
Expected: PASS. Prüfwerte: Angebot 890,00 netto (Wartung optional), Rechnung 890,00 + 19 % = 1.059,10, Storno −1.059,10; Fälligkeit heute + 14 Tage (Standard-Zahlungsziel der Rechnung).

- [ ] **Step 5: Volle Suite, statische Analyse, Format**

```bash
ddev artisan test
ddev exec vendor/bin/phpstan analyse --memory-limit=1G
ddev exec vendor/bin/pint --test
```

Expected: alles grün.

- [ ] **Step 6: Commit**

```bash
git add app/Actions app/Support/ConversionResult.php tests/Feature/Actions/DocumentFlowTest.php
git commit -m "feat(actions): set status, convert, cancel and duplicate documents

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 13: DemoSeeder

Port von `prototypes/clickdummy-v2/src/api/seed.ts`: Studio Nordlicht, vier Kunden mit Ansprechpartnern, acht eigene Felder, Textbausteine, Steuersätze, Einheiten, Nummernkreise (`AN`/`AB`/`RE`/`ST`) und acht Dokumente relativ zu heute. Abgeschlossene Dokumente bekommen ihren Snapshot, Summen rechnet die Domain. Die Templates „Klar“, „Kante“, „Leise“ sind Platzhalter (`built_in`, Slugs `klar`/`kante`/`leise`); Phase 3 ersetzt Inhalt und Manifest per Slug. Der Seeder ersetzt alle Fachdaten (Benutzer bleiben) und darf mehrfach laufen. Abweichung vom Prototyp: Der Rechnungs-Zähler steht auf 42 statt 43 (die Entwurfsrechnung `RE-…-0042` würde sonst eine Lücke reißen), der AB-Zähler auf 2 (AB-0001 existiert).

**Files:**
- Create: `database/seeders/DemoSeeder.php`
- Modify: `database/seeders/DatabaseSeeder.php` (Kommentar)
- Test: `tests/Feature/DemoSeederTest.php`

**Interfaces:**
- Consumes: `GroupWriter`, `DocumentInspector`, `SnapshotBuilder` (Task 7), Models (Task 6), `FinalizeDocument` (Task 11, nur im Test).
- Produces: `Database\Seeders\DemoSeeder` (`ddev artisan db:seed --class=DemoSeeder`).

- [ ] **Step 1: Failing test schreiben**

`tests/Feature/DemoSeederTest.php`:

```php
<?php

use App\Actions\FinalizeDocument;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Models\Contact;
use App\Models\Customer;
use App\Models\Document;
use App\Models\DocumentSnapshot;
use App\Models\FieldDefinition;
use App\Models\Organization;
use App\Models\Template;
use App\Models\User;
use Database\Seeders\DemoSeeder;

it('seeds the demo data from the clickdummy', function () {
    $this->seed(DemoSeeder::class);

    expect(Organization::current()->name)->toBe('Studio Nordlicht')
        ->and(Customer::query()->orderBy('number')->pluck('name')->all())
        ->toBe(['Hafenkontor Lindqvist GmbH', 'Fjord Analytics AB', 'Hotel Alpenglück', 'Kulturwerk Elbinsel e. V.'])
        ->and(Contact::query()->count())->toBe(5)
        ->and(FieldDefinition::query()->count())->toBe(8)
        ->and(Template::query()->orderBy('slug')->pluck('slug')->all())->toBe(['kante', 'klar', 'leise'])
        ->and(Document::query()->count())->toBe(8)
        ->and(Document::query()->whereNotNull('finalized_at')->count())->toBe(6)
        ->and(DocumentSnapshot::query()->count())->toBe(6)
        ->and(Document::query()->where('status', DocumentStatus::Draft)->count())->toBe(2);
});

it('stores totals computed by the domain', function () {
    $this->seed(DemoSeeder::class);
    $year = now()->format('Y');

    $paid = Document::query()->where('number', "RE-{$year}-0041")->firstOrFail();
    $reverseCharge = Document::query()->where('number', "RE-{$year}-0040")->firstOrFail();
    $offer = Document::query()->where('number', "AN-{$year}-0001")->firstOrFail();

    // 24 h × 95 + 49 hosting = 2329.00 net, 19 % VAT
    expect($paid->status)->toBe(DocumentStatus::Paid)
        ->and($paid->paid_at)->not->toBeNull()
        ->and($paid->net_total)->toBe('2329.00')
        ->and($paid->gross_total)->toBe('2771.51')
        // EU reverse charge: no VAT
        ->and($reverseCharge->gross_total)->toBe('1320.00')
        // 890 + 3 × 760 + 52 × 95 = 8110.00; the optional maintenance does not count
        ->and($offer->net_total)->toBe('8110.00')
        ->and($offer->snapshot?->data['org']['name'])->toBe('Studio Nordlicht');
});

it('keeps users and can run twice; the number ranges continue', function () {
    $user = User::factory()->create();

    $this->seed(DemoSeeder::class);
    $this->seed(DemoSeeder::class);

    $draftOffer = Document::query()->where('type', DocumentType::Offer)->where('status', DocumentStatus::Draft)->firstOrFail();
    $draftInvoice = Document::query()->where('type', DocumentType::Invoice)->where('status', DocumentStatus::Draft)->firstOrFail();
    $year = now()->format('Y');

    expect(User::query()->whereKey($user->id)->exists())->toBeTrue()
        ->and(Document::query()->count())->toBe(8)
        ->and(app(FinalizeDocument::class)->handle(systemActor(), $draftOffer)->number)->toBe("AN-{$year}-0004")
        ->and($draftInvoice->source_id)->not->toBeNull();
});
```

- [ ] **Step 2: Test laufen lassen, er muss scheitern**

Run: `ddev artisan test --filter=DemoSeederTest`
Expected: FAIL mit `Target class [Database\Seeders\DemoSeeder] does not exist.`

- [ ] **Step 3: DemoSeeder schreiben**

`database/seeders/DemoSeeder.php`:

```php
<?php

namespace Database\Seeders;

use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\FieldScope;
use App\Enums\FieldType;
use App\Enums\TaxationMode;
use App\Enums\TaxTreatment;
use App\Enums\TextBlockKind;
use App\Models\Contact;
use App\Models\Customer;
use App\Models\Document;
use App\Models\DocumentTypeSetting;
use App\Models\FieldDefinition;
use App\Models\NumberSequence;
use App\Models\Organization;
use App\Models\TaxRate;
use App\Models\Template;
use App\Models\TextBlock;
use App\Models\Unit;
use App\Support\DocumentInspector;
use App\Support\GroupWriter;
use App\Support\SnapshotBuilder;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Fictional demo data (Studio Nordlicht and its customers), ported from
 * prototypes/clickdummy-v2/src/api/seed.ts. Replaces all business data; users stay.
 *
 *   php artisan db:seed --class=DemoSeeder
 */
class DemoSeeder extends Seeder
{
    /** Business tables, emptied before seeding (users, sessions and the organization row stay). */
    private const TABLES = [
        'document_events', 'document_files', 'document_snapshots', 'positions', 'position_groups', 'documents',
        'contacts', 'customers', 'field_definitions', 'template_assets', 'templates', 'text_blocks',
        'tax_rates', 'units', 'number_sequences',
    ];

    /** @var array<string, string> */
    private array $units = [];

    /** @var array<string, string> */
    private array $taxRates = [];

    private CarbonImmutable $today;

    public function __construct(
        private readonly DocumentInspector $inspector,
        private readonly SnapshotBuilder $snapshots,
    ) {}

    public function run(): void
    {
        $this->today = CarbonImmutable::today();

        DB::transaction(function (): void {
            $this->wipe();
            $this->organization();
            $templates = $this->templates();
            $blocks = $this->textBlocks();
            $this->masterData();
            $this->fieldDefinitions();
            $this->documentTypes($templates, $blocks);
            $customers = $this->customers();
            $this->documents($customers, $templates, $blocks);
        });
    }

    private function wipe(): void
    {
        Schema::withoutForeignKeyConstraints(function (): void {
            DB::table('document_types')->update(['template_id' => null, 'default_intro_block_id' => null, 'default_closing_block_id' => null]);
            foreach (self::TABLES as $table) {
                DB::table($table)->delete();
            }
        });
    }

    private function organization(): void
    {
        Organization::current()->forceFill([
            'name' => 'Studio Nordlicht',
            'street' => 'Speicherstraße 12',
            'zip' => '20457',
            'city' => 'Hamburg',
            'country' => 'DE',
            'logo_path' => null,
            'vat_id' => 'DE123456789',
            'tax_number' => '',
            'iban' => 'DE02 1203 0000 0000 2020 51',
            'bic' => 'BYLADEM1001',
            'bank_name' => 'Demo Bank',
            'email' => 'hallo@nordlicht.example',
            'phone' => '+49 40 1234567',
            'website' => 'nordlicht.example',
            'taxation_mode' => TaxationMode::Regular,
            'locale' => 'de',
            'custom' => ['register' => 'Amtsgericht Hamburg HRB 000000'],
        ])->save();
    }

    /** @return array<string, string> slug => id */
    private function templates(): array
    {
        $ids = [];
        foreach (['klar' => 'Klar', 'kante' => 'Kante', 'leise' => 'Leise'] as $slug => $name) {
            $ids[$slug] = Template::query()->create([
                'name' => $name,
                'slug' => $slug,
                'version' => '0.0.0',
                'author' => 'openbill',
                'license' => 'MIT',
                'description' => 'Placeholder until phase 3 ships the real template.',
                'built_in' => true,
                'manifest' => ['paper' => ['format' => 'A4', 'marginX' => '20mm', 'headerHeight' => '30mm', 'footerHeight' => '20mm']],
                'header' => '',
                'body' => '<h1>{{ document.type_label }} {{ document.number }}</h1>',
                'footer' => '',
                'css' => '',
            ])->id;
        }

        return $ids;
    }

    /** @return array<string, TextBlock> */
    private function textBlocks(): array
    {
        $blocks = [
            'offer_intro' => ['Angebot: Einleitung', TextBlockKind::Intro, "Hallo {{ contact.first_name }},\nvielen Dank für das gute Gespräch. Wie besprochen biete ich Ihnen folgende Leistungen an:"],
            'invoice_intro' => ['Rechnung: Einleitung', TextBlockKind::Intro, 'Vielen Dank für die gute Zusammenarbeit. Für das Projekt berechne ich Ihnen folgende Leistungen:'],
            'payment' => ['Zahlungsbedingungen', TextBlockKind::Payment, 'Bitte überweisen Sie den Betrag bis zum {{ document.due_date | date }} auf das unten genannte Konto.'],
            'closing' => ['Schlusstext', TextBlockKind::Closing, "Ich freue mich auf Ihre Rückmeldung.\nViele Grüße\nKai Behrens"],
        ];

        return array_map(
            fn (array $b): TextBlock => TextBlock::query()->create(['name' => $b[0], 'kind' => $b[1], 'body' => $b[2]]),
            $blocks,
        );
    }

    private function masterData(): void
    {
        foreach (['19' => ['19 %', '19.00', 'S'], '7' => ['7 %', '7.00', 'S'], '0' => ['0 %', '0.00', 'Z']] as $key => [$label, $percent, $category]) {
            $this->taxRates[(string) $key] = TaxRate::query()->create([
                'label' => $label, 'percent' => $percent, 'category' => $category, 'sort' => count($this->taxRates),
            ])->id;
        }

        $units = [
            'hour' => ['Stunde', 'Std.', 2, 'HUR'],
            'day' => ['Tag', 'Tage', 1, 'DAY'],
            'piece' => ['Stück', 'Stk.', 0, 'H87'],
            'flat' => ['Pauschal', 'Psch.', 0, 'LS'],
            'month' => ['Monat', 'Mon.', 0, 'MON'],
        ];
        foreach ($units as $key => [$name, $symbol, $decimals, $code]) {
            $this->units[$key] = Unit::query()->create([
                'name' => $name, 'symbol' => $symbol, 'decimals' => $decimals, 'code' => $code, 'sort' => count($this->units),
            ])->id;
        }
    }

    private function fieldDefinitions(): void
    {
        $all = ['offer', 'confirmation', 'invoice', 'cancellation'];
        $fields = [
            [FieldScope::Org, 'register', 'Handelsregister', FieldType::Text, [], [], ''],
            [FieldScope::Customer, 'industry', 'Branche', FieldType::Select, [], ['Handel', 'Software', 'Hotellerie', 'Logistik', 'Kultur'], ''],
            [FieldScope::Customer, 'supplier_number', 'Unsere Lieferantennummer', FieldType::Text, [], [], 'Die Nummer, unter der uns der Kunde führt.'],
            [FieldScope::Contact, 'department', 'Abteilung', FieldType::Text, [], [], ''],
            [FieldScope::Document, 'project_name', 'Projektname', FieldType::Text, $all, [], ''],
            [FieldScope::Document, 'po_number', 'Bestellnummer des Kunden', FieldType::Text, ['confirmation', 'invoice'], [], 'Steht auf der Bestellung des Kunden und muss auf die Rechnung.'],
            [FieldScope::Document, 'response_time', 'Reaktionszeit', FieldType::Select, ['offer', 'confirmation'], ['24 Stunden', '48 Stunden', 'nächster Werktag'], ''],
            [FieldScope::Position, 'ticket', 'Ticket', FieldType::Text, ['invoice', 'cancellation'], [], 'Referenz aus dem Ticketsystem, z. B. SHOP-142.'],
        ];
        foreach ($fields as $sort => [$scope, $key, $label, $type, $docTypes, $options, $help]) {
            FieldDefinition::query()->create([
                'scope' => $scope, 'key' => $key, 'label' => $label, 'type' => $type, 'required' => false, 'default_value' => null,
                'help' => $help, 'options' => $options, 'doc_types' => $docTypes, 'sort' => $sort,
            ]);
        }
    }

    /**
     * @param  array<string, string>  $templates
     * @param  array<string, TextBlock>  $blocks
     */
    private function documentTypes(array $templates, array $blocks): void
    {
        $year = (int) $this->today->format('Y');
        $types = [
            'offer' => ['AN-{YYYY}-{0000}', 4, ['profile' => 'basic', 'template_id' => $templates['klar'], 'validity_days' => 30, 'payment_term_days' => null, 'default_intro_block_id' => $blocks['offer_intro']->id, 'default_closing_block_id' => $blocks['closing']->id]],
            'confirmation' => ['AB-{YYYY}-{0000}', 2, ['profile' => 'basic', 'template_id' => $templates['leise'], 'validity_days' => null, 'payment_term_days' => null]],
            'invoice' => ['RE-{YYYY}-{0000}', 42, ['profile' => 'en16931', 'template_id' => $templates['klar'], 'validity_days' => null, 'payment_term_days' => 14, 'default_intro_block_id' => $blocks['invoice_intro']->id, 'default_closing_block_id' => $blocks['payment']->id]],
            'cancellation' => ['ST-{YYYY}-{0000}', null, ['profile' => 'en16931', 'template_id' => $templates['klar'], 'validity_days' => null, 'payment_term_days' => null]],
        ];
        foreach ($types as $type => [$pattern, $next, $setting]) {
            DocumentTypeSetting::query()->whereKey($type)->update($setting);
            NumberSequence::query()->create(['doc_type' => $type, 'year' => null, 'pattern' => $pattern, 'next_value' => 1, 'reset_yearly' => true]);
            if ($next !== null) {
                NumberSequence::query()->create(['doc_type' => $type, 'year' => $year, 'pattern' => $pattern, 'next_value' => $next, 'reset_yearly' => true]);
            }
        }
    }

    /** @return array<string, array{customer: Customer, contact: Contact}> */
    private function customers(): array
    {
        $rows = [
            'hafenkontor' => [
                ['number' => 'K-1001', 'name' => 'Hafenkontor Lindqvist GmbH', 'street' => 'Am Sandtorkai 4', 'zip' => '20457', 'city' => 'Hamburg', 'country' => 'DE', 'email' => 'buchhaltung@hafenkontor.example', 'vat_id' => 'DE987654321', 'tax_treatment' => TaxTreatment::Domestic, 'custom' => ['industry' => 'Handel', 'supplier_number' => 'L-20931']],
                [
                    ['salutation' => 'Frau', 'first_name' => 'Mira', 'last_name' => 'Albers', 'position' => 'Leitung E-Commerce', 'email' => 'mira.albers@hafenkontor.example', 'phone' => '+49 40 555 0101', 'is_default' => true, 'custom' => ['department' => 'Digital']],
                    ['salutation' => 'Herr', 'first_name' => 'Ole', 'last_name' => 'Brandt', 'position' => 'Einkauf', 'email' => 'ole.brandt@hafenkontor.example', 'phone' => '', 'is_default' => false, 'custom' => ['department' => 'Einkauf']],
                ],
                -220,
            ],
            'fjord' => [
                ['number' => 'K-1002', 'name' => 'Fjord Analytics AB', 'street' => 'Storgatan 8', 'zip' => '111 51', 'city' => 'Stockholm', 'country' => 'SE', 'email' => 'invoices@fjord.example', 'vat_id' => 'SE556677889901', 'tax_treatment' => TaxTreatment::EuReverseCharge, 'custom' => ['industry' => 'Software']],
                [['salutation' => 'Frau', 'first_name' => 'Elin', 'last_name' => 'Berg', 'position' => 'CTO', 'email' => 'elin@fjord.example', 'phone' => '', 'is_default' => true, 'custom' => []]],
                -160,
            ],
            'alpen' => [
                ['number' => 'K-1003', 'name' => 'Hotel Alpenglück', 'street' => 'Bergweg 1', 'zip' => '87561', 'city' => 'Oberstdorf', 'country' => 'DE', 'email' => 'info@alpenglueck.example', 'vat_id' => '', 'tax_treatment' => TaxTreatment::Domestic, 'custom' => ['industry' => 'Hotellerie']],
                [['salutation' => 'Herr', 'first_name' => 'Max', 'last_name' => 'Huber', 'position' => 'Inhaber', 'email' => 'max@alpenglueck.example', 'phone' => '+49 8322 555 22', 'is_default' => true, 'custom' => []]],
                -90,
            ],
            'kulturwerk' => [
                ['number' => 'K-1004', 'name' => 'Kulturwerk Elbinsel e. V.', 'street' => 'Veringstraße 40', 'zip' => '21107', 'city' => 'Hamburg', 'country' => 'DE', 'email' => 'vorstand@kulturwerk.example', 'vat_id' => '', 'tax_treatment' => TaxTreatment::Domestic, 'custom' => ['industry' => 'Kultur']],
                [['salutation' => 'Frau', 'first_name' => 'Jana', 'last_name' => 'Okafor', 'position' => 'Vorstand', 'email' => 'jana@kulturwerk.example', 'phone' => '', 'is_default' => true, 'custom' => []]],
                -30,
            ],
        ];

        $result = [];
        foreach ($rows as $key => [$attributes, $contacts, $createdDaysAgo]) {
            $customer = Customer::query()->create($attributes);
            DB::table('customers')->where('id', $customer->id)->update(['created_at' => $this->stamp($createdDaysAgo), 'updated_at' => $this->stamp($createdDaysAgo)]);
            $first = null;
            foreach ($contacts as $contact) {
                $model = Contact::query()->create([...$contact, 'customer_id' => $customer->id]);
                $first ??= $model;
            }
            $result[$key] = ['customer' => $customer, 'contact' => $first];
        }

        return $result;
    }

    /**
     * @param  array<string, array{customer: Customer, contact: Contact}>  $c
     * @param  array<string, string>  $templates
     * @param  array<string, TextBlock>  $blocks
     */
    private function documents(array $c, array $templates, array $blocks): void
    {
        $year = $this->today->format('Y');
        $offerIntro = $blocks['offer_intro']->body;
        $invoiceIntro = $blocks['invoice_intro']->body;
        $closing = $blocks['closing']->body;
        $payment = $blocks['payment']->body;

        $offer1 = $this->document([
            'type' => DocumentType::Offer, 'status' => DocumentStatus::Accepted, 'number' => "AN-{$year}-0001", 'date' => $this->day(-48),
            'customer' => $c['hafenkontor'], 'valid_until' => $this->day(-18), 'intro' => $offerIntro, 'closing' => $closing,
            'template_id' => $templates['klar'], 'custom' => ['project_name' => 'Relaunch Online-Shop', 'response_time' => '48 Stunden'],
            'finalized_at' => $this->stamp(-48), 'created_at' => $this->stamp(-49), 'updated_at' => $this->stamp(-40),
        ], $this->shopGroups());

        $this->document([
            'type' => DocumentType::Invoice, 'status' => DocumentStatus::Draft, 'number' => null, 'date' => $this->day(0),
            'customer' => $c['hafenkontor'], 'due_date' => $this->day(14), 'intro' => $invoiceIntro, 'closing' => $payment,
            'template_id' => $templates['klar'], 'source_id' => $offer1->id, 'custom' => ['project_name' => 'Relaunch Online-Shop', 'po_number' => 'PO-77812'],
            'finalized_at' => null, 'created_at' => $this->stamp(-1), 'updated_at' => $this->stamp(0),
        ], array_map(fn (array $group): array => [
            ...$group,
            'positions' => array_map(fn (array $p): array => [...$p, 'custom' => $p['kind'] === 'item' ? ['ticket' => 'SHOP-142'] : []], $group['positions']),
        ], array_slice($this->shopGroups(), 0, 2)));

        $this->document([
            'type' => DocumentType::Offer, 'status' => DocumentStatus::Open, 'number' => "AN-{$year}-0002", 'date' => $this->day(-6),
            'customer' => $c['fjord'], 'valid_until' => $this->day(24), 'intro' => $offerIntro, 'closing' => $closing,
            'template_id' => $templates['kante'], 'custom' => ['project_name' => 'Dashboard-Audit'],
            'finalized_at' => $this->stamp(-6), 'created_at' => $this->stamp(-7), 'updated_at' => $this->stamp(-6),
        ], [['title' => null, 'positions' => [$this->position(['title' => 'UX-Audit Analytics-Dashboard', 'description' => 'Heuristische Analyse, Bericht mit Empfehlungen', 'quantity' => '16', 'unit_price' => '110'])]]]);

        $this->document([
            'type' => DocumentType::Offer, 'status' => DocumentStatus::Open, 'number' => "AN-{$year}-0003", 'date' => $this->day(-3),
            'customer' => $c['kulturwerk'], 'valid_until' => $this->day(27), 'intro' => $offerIntro, 'closing' => $closing,
            'template_id' => $templates['klar'], 'custom' => ['project_name' => 'Festival-Website 2027'],
            'finalized_at' => $this->stamp(-3), 'created_at' => $this->stamp(-4), 'updated_at' => $this->stamp(-3),
        ], [
            ['title' => 'Gestaltung', 'positions' => [$this->position(['title' => 'Designsystem & Startseite', 'quantity' => '4', 'unit_id' => $this->units['day'], 'unit_price' => '720'])]],
            ['title' => 'Umsetzung', 'positions' => [
                $this->position(['title' => 'Programmübersicht mit Filter', 'quantity' => '28']),
                $this->position(['title' => 'Ticket-Anbindung', 'quantity' => '12']),
            ]],
        ]);

        $this->document([
            'type' => DocumentType::Invoice, 'status' => DocumentStatus::Open, 'number' => "RE-{$year}-0040", 'date' => $this->day(-24),
            'customer' => $c['fjord'], 'service_date' => $this->day(-26), 'due_date' => $this->day(-10), 'intro' => $invoiceIntro, 'closing' => $payment,
            'template_id' => $templates['klar'], 'custom' => ['project_name' => 'Datenmodell'],
            'finalized_at' => $this->stamp(-24), 'created_at' => $this->stamp(-25), 'updated_at' => $this->stamp(-24),
        ], [['title' => null, 'positions' => [$this->position(['title' => 'Beratung Datenmodell', 'quantity' => '12', 'unit_price' => '110'])]]]);

        $this->document([
            'type' => DocumentType::Invoice, 'status' => DocumentStatus::Paid, 'number' => "RE-{$year}-0041", 'date' => $this->day(-15),
            'customer' => $c['alpen'], 'service_date' => $this->day(-17), 'due_date' => $this->day(-1), 'intro' => $invoiceIntro, 'closing' => $payment,
            'template_id' => $templates['klar'], 'custom' => ['project_name' => 'Buchungsstrecke'], 'paid_at' => $this->stamp(-4),
            'finalized_at' => $this->stamp(-15), 'created_at' => $this->stamp(-16), 'updated_at' => $this->stamp(-4),
        ], [
            ['title' => 'Entwicklung', 'positions' => [
                $this->position(['title' => 'Buchungsstrecke mobil', 'quantity' => '18']),
                $this->position(['title' => 'Anbindung Channel-Manager', 'quantity' => '6']),
            ]],
            ['title' => 'Betrieb', 'positions' => [$this->position(['title' => 'Hosting', 'unit_id' => $this->units['month'], 'quantity' => '1', 'unit_price' => '49'])]],
        ]);

        $this->document([
            'type' => DocumentType::Confirmation, 'status' => DocumentStatus::Open, 'number' => "AB-{$year}-0001", 'date' => $this->day(-40),
            'customer' => $c['hafenkontor'], 'intro' => 'Vielen Dank für Ihren Auftrag. Hiermit bestätige ich die folgenden Leistungen:', 'closing' => $closing,
            'template_id' => $templates['leise'], 'source_id' => $offer1->id,
            'custom' => ['project_name' => 'Relaunch Online-Shop', 'po_number' => 'PO-77812', 'response_time' => '48 Stunden'],
            'finalized_at' => $this->stamp(-40), 'created_at' => $this->stamp(-40), 'updated_at' => $this->stamp(-40),
        ], array_slice($this->shopGroups(), 0, 2));

        $this->document([
            'type' => DocumentType::Offer, 'status' => DocumentStatus::Draft, 'number' => null, 'date' => $this->day(0),
            'customer' => $c['alpen'], 'valid_until' => $this->day(30), 'intro' => $offerIntro, 'closing' => $closing,
            'template_id' => $templates['klar'], 'custom' => ['project_name' => 'Newsletter'],
            'finalized_at' => null, 'created_at' => $this->stamp(-2), 'updated_at' => $this->stamp(-2),
        ], [['title' => null, 'positions' => [$this->position(['title' => 'Newsletter-Vorlage', 'description' => 'Gestaltung und Umsetzung, responsiv', 'quantity' => '8'])]]]);
    }

    /**
     * Saves the document as a draft first (groups need an open document), computes the totals,
     * then freezes the master data and sets finalized_at for finalized ones.
     *
     * @param  array<string, mixed>  $a
     * @param  list<array<string, mixed>>  $groups
     */
    private function document(array $a, array $groups): Document
    {
        /** @var array{customer: Customer, contact: Contact} $party */
        $party = $a['customer'];
        $document = new Document;
        $document->forceFill([
            'type' => $a['type'],
            'status' => $a['status'],
            'number' => $a['number'],
            'date' => $a['date'],
            'customer_id' => $party['customer']->id,
            'contact_id' => $party['contact']->id,
            'service_date' => $a['service_date'] ?? null,
            'due_date' => $a['due_date'] ?? null,
            'valid_until' => $a['valid_until'] ?? null,
            'intro' => $a['intro'],
            'closing' => $a['closing'],
            'template_id' => $a['template_id'],
            'locale' => 'de',
            'custom' => $a['custom'],
            'source_id' => $a['source_id'] ?? null,
            'paid_at' => $a['paid_at'] ?? null,
        ])->save();

        GroupWriter::replace($document, $groups);
        $document->load('groups.positions');
        $this->inspector->applyTotals($document, $this->inspector->totals($document));
        $document->save();

        if ($a['finalized_at'] !== null) {
            $data = $this->snapshots->build($document);
            $document->forceFill(['finalized_at' => $a['finalized_at']])->save();
            $document->snapshot()->create(['data' => $data]);
        }

        DB::table('documents')->where('id', $document->id)->update(['created_at' => $a['created_at'], 'updated_at' => $a['updated_at']]);

        return $document;
    }

    /** @return list<array<string, mixed>> */
    private function shopGroups(): array
    {
        return [
            ['title' => 'Konzept & UX', 'positions' => [
                $this->position(['title' => 'Discovery-Workshop', 'description' => 'Halbtags vor Ort, inklusive Protokoll', 'unit_id' => $this->units['flat'], 'unit_price' => '890']),
                $this->position(['title' => 'Wireframes & Klickpfade', 'quantity' => '3', 'unit_id' => $this->units['day'], 'unit_price' => '760']),
            ]],
            ['title' => 'Umsetzung', 'positions' => [
                $this->position(['title' => 'Frontend-Entwicklung', 'description' => 'Shop-Theme, Warenkorb, Checkout', 'quantity' => '52']),
                $this->position(['kind' => 'text', 'title' => 'Inklusive zwei Korrekturschleifen.', 'quantity' => '0', 'unit_id' => null, 'unit_price' => '0', 'tax_rate_id' => null]),
            ]],
            ['title' => 'Betrieb', 'positions' => [
                $this->position(['kind' => 'optional', 'title' => 'Wartung & Updates', 'description' => 'Monatlich, inklusive Monitoring', 'unit_id' => $this->units['month'], 'quantity' => '12', 'unit_price' => '149']),
            ]],
        ];
    }

    /**
     * @param  array<string, mixed>  $over
     * @return array<string, mixed>
     */
    private function position(array $over): array
    {
        return [...[
            'kind' => 'item',
            'title' => '',
            'description' => '',
            'quantity' => '1',
            'unit_id' => $this->units['hour'],
            'unit_price' => '95',
            'tax_rate_id' => $this->taxRates['19'],
            'custom' => [],
        ], ...$over];
    }

    private function day(int $offset): string
    {
        return $this->today->addDays($offset)->toDateString();
    }

    private function stamp(int $offset): CarbonImmutable
    {
        return $this->today->addDays($offset)->setTime(9, 0);
    }
}
```

In `database/seeders/DatabaseSeeder.php` den Kommentar der Methode `run()` ersetzen durch:

```php
    /**
     * Intentionally empty: the owner comes from `app:ensure-admin`, base data from the migrations.
     * Demo data: `php artisan db:seed --class=DemoSeeder` (replaces all business data).
     */
```

- [ ] **Step 4: Test laufen lassen**

Run: `ddev artisan test --filter=DemoSeederTest`
Expected: PASS. Prüfwerte: `RE-0041` = (18 + 6) × 95 + 49 = 2.329,00 netto + 442,51 USt = 2.771,51; `RE-0040` Reverse Charge 12 × 110 = 1.320,00 ohne USt; `AN-0001` = 890 + 3 × 760 + 52 × 95 = 8.110,00 (Wartung optional).

- [ ] **Step 5: In DDEV ausprobieren**

```bash
ddev artisan migrate:fresh --no-interaction
ddev artisan db:seed --class=DemoSeeder --no-interaction
ddev artisan tinker --execute="echo App\Models\Document::count().' '.App\Models\Document::whereNotNull('finalized_at')->count().' '.App\Models\Customer::count();"
```

Expected: `INFO  Seeding database.` ohne Fehler, dann `8 6 4`.

- [ ] **Step 6: Statische Analyse und Commit**

```bash
ddev exec vendor/bin/phpstan analyse --memory-limit=1G
ddev exec vendor/bin/pint --test
git add database/seeders tests/Feature/DemoSeederTest.php
git commit -m "feat(seed): add demo seeder with the clickdummy data

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Expected: `[OK] No errors`, Pint ohne Befund.

---
### Task 14: Architekturtests – Actions/Domain-Regeln und kein float

Sichert die Kernregeln ab: `app/Domain` ist reines PHP ohne Laravel und ohne float, Actions sind finale Klassen mit `handle()`, Models rufen keine Actions, Controller rechnen nicht selbst. Der float-Test arbeitet mit dem PHP-Tokenizer (Typ `float`, `(float)`, `floatval`, Float-Literale, `round`/`floor`/`ceil`/`fdiv`/`number_format`, `toFloat`) und prüft sich selbst an einem Beispiel.

**Files:**
- Modify: `tests/Unit/ArchTest.php`
- Create: `tests/Unit/NoFloatTest.php`

**Interfaces:**
- Consumes: alle Klassen aus Task 1–13.
- Produces: Architekturtests, die in späteren Phasen mitwachsen (Phase 4: `App\ApiResource`, Phase 8: `App\Mcp` dürfen `App\Domain` nicht direkt benutzen).

- [ ] **Step 1: Tests schreiben**

`tests/Unit/NoFloatTest.php`:

```php
<?php

/**
 * Lines in $code that use floating point: the float type or cast, float literals, floatval(),
 * BigNumber::toFloat() and the float-returning rounding helpers.
 *
 * @return list<string>
 */
function floatUsages(string $code, string $file = 'code'): array
{
    $banned = ['float', 'floatval', 'tofloat', 'round', 'floor', 'ceil', 'fdiv', 'number_format'];
    $hits = [];
    foreach (token_get_all($code) as $token) {
        if (! is_array($token)) {
            continue;
        }
        [$id, $text, $line] = $token;
        if ($id === T_DNUMBER || $id === T_DOUBLE_CAST || ($id === T_STRING && in_array(strtolower($text), $banned, true))) {
            $hits[] = "{$file}:{$line} {$text}";
        }
    }

    return $hits;
}

it('detects floating point usage', function () {
    $code = '<?php function f(float $a): int { return (int) round((float) $a * 1.5) + floatval("1"); }';

    expect(floatUsages($code))->toBe(['code:1 float', 'code:1 round', 'code:1 (float)', 'code:1 1.5', 'code:1 floatval']);
});

it('never uses floating point in app/Domain', function () {
    $root = dirname(__DIR__, 2).'/app/Domain';
    $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS));
    $hits = [];
    foreach ($files as $file) {
        if ($file->getExtension() === 'php') {
            array_push($hits, ...floatUsages((string) file_get_contents($file->getPathname()), substr($file->getPathname(), strlen($root) + 1)));
        }
    }

    expect($hits)->toBe([]);
});
```

`tests/Unit/ArchTest.php` am Ende ergänzen:

```php
arch('the domain is plain PHP')
    ->expect('App\Domain')
    ->not->toUse(['Illuminate', 'App\Models', 'App\Actions', 'App\Support', 'App\Http', 'App\Exceptions', 'Carbon']);

arch('domain classes are final')
    ->expect('App\Domain')
    ->toBeFinal();

arch('actions are final and run through handle()')
    ->expect('App\Actions')
    ->toBeFinal()
    ->toHaveMethod('handle');

arch('models never call actions')
    ->expect('App\Models')
    ->not->toUse('App\Actions');

arch('the http layer does not compute: no domain classes in controllers')
    ->expect('App\Http')
    ->not->toUse('App\Domain');

arch('support code does not call actions')
    ->expect('App\Support')
    ->not->toUse('App\Actions');

arch('domain exceptions carry an HTTP status')
    ->expect(['App\Exceptions\DocumentLockedException', 'App\Exceptions\ActionNotAllowedException', 'App\Exceptions\ComplianceFailedException'])
    ->toExtend('App\Exceptions\DomainActionException');
```

- [ ] **Step 2: Tests laufen lassen**

Run: `ddev artisan test --filter='ArchTest|NoFloatTest'`
Expected: PASS. Schlägt `domain classes are final` wegen der Enums `FieldErrorCode`/`ComplianceRule` fehl (Pest-Versionen unterscheiden sich darin, ob Enums als `final` gelten), die Regel auf Klassen einschränken: `->expect('App\Domain')->classes()->toBeFinal()` (`classes()` gibt es in `vendor/pestphp/pest-plugin-arch/src/PendingArchExpectation.php`). Schlägt `the domain is plain PHP` an, zeigt die Meldung die Datei – dort die Laravel-Abhängigkeit in `app/Support` verschieben, nicht die Regel lockern.

- [ ] **Step 3: Gegenprobe**

Testweise in `app/Domain/Money/Decimal.php` eine Zeile `public static function bad(): float { return 0.1; }` einfügen und `ddev artisan test --filter=NoFloatTest` laufen lassen → FAIL mit `Money/Decimal.php:… float` und `… 0.1`. Zeile wieder entfernen, Test erneut → PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/Unit/ArchTest.php tests/Unit/NoFloatTest.php
git commit -m "test(arch): guard domain purity, final actions and no floats in app/Domain

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 15: Doku-Seite `documents`, CLAUDE.md, Fortschritt im Master-Plan

Die Seite beschreibt das fachliche Verhalten aus Phase 2 (Status, Kette, Sperre, Nummernkreise, Summen/Steuern, eigene Felder in Dokumenten, Demo-Daten). Phase 5 ergänzt sie später um die Oberfläche.

**Files:**
- Create: `docs/en/documents.md`, `docs/de/documents.md`
- Modify: `docs/.vitepress/config.ts`, `CLAUDE.md`, `docs/superpowers/plans/2026-10-11-openbill-app.md` (Abschnitt „Fortschritt“)

**Interfaces:**
- Consumes: Verhalten aus Task 3, 5, 9, 10–13.
- Produces: Doku-Seite `documents` (en/de, in der Sidebar), aktualisierte `CLAUDE.md`.

- [ ] **Step 1: Prüfen, dass der Doku-Test die neue Seite verlangt**

Erst nur `docs/en/documents.md` anlegen (Inhalt aus Step 2) und `ddev artisan test --filter=DocsTest` laufen lassen.
Expected: FAIL in `has every docs page in English and German` (fehlt in `de`) und in `lists every English page in the sidebar` (`'documents'` fehlt in `config.ts`).

- [ ] **Step 2: Englische Seite**

`docs/en/documents.md`:

````markdown
# Documents

openbill knows four document types. Each one moves through a small set of statuses; finalizing gives it a number and locks it.

| Type | Statuses |
|---|---|
| Offer | draft → open → accepted / rejected |
| Order confirmation | draft → open → done |
| Invoice | draft → open → paid; cancelled (set by a cancellation) |
| Cancellation | draft → closed |

"Overdue" is not a status: an open invoice whose due date has passed is shown as overdue.

## Drafts

A new draft takes the defaults of its document type: intro and closing text blocks, template, payment term (invoice: due date = date + payment term, service date = date), validity (offer: valid until = date + validity), the customer's default contact and the default values of custom fields. A draft can be changed freely. Positions are organized in groups with a title and a subtotal; positions without a group sit in a group without title.

Position kinds:

- **Item** – quantity × unit price, counts towards the total.
- **Text** – a line without amount.
- **Optional** – offers only; shown with its price but not part of the total.

Amounts and quantities are exact decimals. Through the API they are sent as strings with a dot (`"12.50"`); numbers like `12.5` or `"12,5"` are rejected with a message for that field.

## Taxes and totals

Totals are computed per tax rate (net, tax, gross) and for the whole document; the tax of each rate is rounded once, commercially, to cents.

- **Small business (§ 19 UStG):** no VAT on any position (category E), the legal note is added automatically.
- **EU customer with reverse charge:** no VAT (category AE), the reverse charge note is added.
- **Customer in a third country:** no VAT (category G), the export note is added.

Legal notes are written in the document's language.

## Finalizing

Finalizing turns a draft into an open document (a cancellation into a closed one). In one step openbill

1. checks the compliance profile of the document type (see below) and stops with a list of what is missing,
2. assigns the next number of the number range,
3. freezes the master data the document uses (organization, customer, contact, tax rates, units, template and custom field definitions) in a snapshot,
4. stores the totals.

If any step fails, nothing changes: the document stays a draft and the number stays free.

After finalizing a document is **locked**. Only its status, the payment date and the link to its cancellation can still change. Later changes to customers, tax rates, units, templates or custom fields do not affect it, because it is shown and computed from its snapshot. To correct an invoice, cancel it and create a new one.

### Compliance profiles

| Profile | Checks |
|---|---|
| Basic | date, customer, at least one item, title, tax rate (unless small business) and unit of every item, required custom fields |
| E-invoice (EN 16931) | everything from Basic, plus organization name, full address, VAT ID or tax number and IBAN, full customer address, the customer's VAT ID for reverse charge, service date, due date (invoices), a unit code for every unit and no quantity 0 |

The e-invoice profile can only be chosen for invoices and cancellations.

## Document chain

Documents can be converted along the chain:

- an **accepted** offer → order confirmation or invoice,
- an order confirmation (not a draft) → invoice,
- an open or paid invoice → cancellation.

The new document is a draft with the customer, contact, groups, positions and texts of its source. Optional positions are dropped, groups that end up empty are dropped. Custom field values move along when the field is defined for the target type too; other values are dropped and reported. Every document knows its source, and an invoice knows the cancellation that cancelled it.

A cancellation copies the positions of its invoice with negative quantities. Each invoice has at most one cancellation; asking again returns the existing draft. When the cancellation is finalized, the invoice becomes **cancelled**.

Duplicating creates a new draft dated today without number and without chain. Cancellations cannot be duplicated.

## Number ranges

Every document type has its own number range with a pattern:

| Placeholder | Meaning |
|---|---|
| `{YYYY}` | year of the document date |
| `{YY}` | two-digit year |
| `{MM}` | month |
| `{0000}` | running number, padded to the number of zeros |

Defaults: `Q-{YYYY}-{0000}` (offers), `OC-{YYYY}-{0000}` (order confirmations), `INV-{YYYY}-{0000}` (invoices), `CN-{YYYY}-{0000}` (cancellations), each reset yearly.

- With a **yearly reset** every year has its own counter; a backdated document gets the next number of its own year. The pattern must then contain `{YYYY}` or `{YY}`.
- Numbers are assigned while the number range is locked, so two documents finalized at the same moment never get the same number.
- If a number already exists (for example after the pattern or the counter was changed by hand), it is skipped.

## Activity log

Every change to a document is logged with who made it (user, API token or the system): created, updated, finalized, status changed, converted, cancelled, duplicated, deleted. Entries of deleted drafts stay in the log.

## Demo data

For development and trying things out:

```bash
ddev artisan db:seed --class=DemoSeeder
```

This **replaces all business data** (documents, customers, custom fields, tax rates, units, text blocks, templates, number ranges) with the fictional company Studio Nordlicht and its customers. User accounts stay.
````

- [ ] **Step 3: Deutsche Seite**

`docs/de/documents.md`:

````markdown
# Dokumente

openbill kennt vier Dokumenttypen. Jeder durchläuft wenige Status; beim Abschließen bekommt er eine Nummer und wird gesperrt.

| Typ | Status |
|---|---|
| Angebot | Entwurf → Offen → Angenommen / Abgelehnt |
| Auftragsbestätigung | Entwurf → Offen → Erledigt |
| Rechnung | Entwurf → Offen → Bezahlt; Storniert (durch ein Storno) |
| Storno | Entwurf → Abgeschlossen |

„Überfällig“ ist kein Status: Eine offene Rechnung, deren Fälligkeit vorbei ist, wird als überfällig angezeigt.

## Entwürfe

Ein neuer Entwurf übernimmt die Vorgaben seines Dokumenttyps: Einleitung und Schlusstext aus Textbausteinen, Template, Zahlungsziel (Rechnung: Fälligkeit = Datum + Zahlungsziel, Leistungsdatum = Datum), Gültigkeit (Angebot: gültig bis = Datum + Gültigkeit), den Standard-Ansprechpartner des Kunden und die Standardwerte eigener Felder. Ein Entwurf lässt sich frei ändern. Positionen stehen in Gruppen mit Titel und Zwischensumme; Positionen ohne Gruppe stehen in einer Gruppe ohne Titel.

Positionsarten:

- **Leistung** – Menge × Einzelpreis, zählt zur Summe.
- **Textzeile** – eine Zeile ohne Betrag.
- **Optional** – nur in Angeboten; mit Preis angezeigt, aber nicht Teil der Summe.

Beträge und Mengen sind exakte Dezimalzahlen. Über die API werden sie als Text mit Punkt geschickt (`"12.50"`); Zahlen wie `12.5` oder `"12,5"` werden mit einer Meldung zum Feld abgelehnt.

## Steuern und Summen

Summen entstehen je Steuersatz (Netto, Steuer, Brutto) und für das ganze Dokument; die Steuer je Satz wird einmal kaufmännisch auf Cent gerundet.

- **Kleinunternehmer (§ 19 UStG):** keine Umsatzsteuer auf Positionen (Kategorie E), der Pflichthinweis wird automatisch gesetzt.
- **EU-Kunde mit Reverse Charge:** keine Umsatzsteuer (Kategorie AE), der Reverse-Charge-Hinweis wird gesetzt.
- **Kunde im Drittland:** keine Umsatzsteuer (Kategorie G), der Ausfuhrhinweis wird gesetzt.

Gesetzliche Hinweise stehen in der Sprache des Dokuments.

## Abschließen

Abschließen macht aus einem Entwurf ein offenes Dokument (ein Storno wird abgeschlossen). In einem Schritt

1. prüft openbill das Prüfprofil des Dokumenttyps (siehe unten) und bricht mit einer Liste der fehlenden Angaben ab,
2. vergibt die nächste Nummer aus dem Nummernkreis,
3. friert die Stammdaten ein, die das Dokument nutzt (Organisation, Kunde, Ansprechpartner, Steuersätze, Einheiten, Template und Felddefinitionen),
4. speichert die Summen.

Scheitert ein Schritt, ändert sich nichts: Das Dokument bleibt Entwurf und die Nummer bleibt frei.

Danach ist das Dokument **gesperrt**. Nur Status, Zahlungsdatum und der Verweis auf das Storno können sich noch ändern. Spätere Änderungen an Kunden, Steuersätzen, Einheiten, Templates oder eigenen Feldern wirken nicht mehr, weil das Dokument aus seinen eingefrorenen Stammdaten angezeigt und berechnet wird. Eine Rechnung korrigierst du mit einem Storno und einer neuen Rechnung.

### Prüfprofile

| Profil | Prüft |
|---|---|
| Basis | Datum, Kunde, mindestens eine Leistung, Bezeichnung, Steuersatz (außer bei Kleinunternehmern) und Einheit jeder Leistung, eigene Pflichtfelder |
| E-Rechnung (EN 16931) | alles aus Basis, dazu Name, vollständige Adresse, USt-ID oder Steuernummer und IBAN der Organisation, vollständige Kundenadresse, USt-ID des Kunden bei Reverse Charge, Leistungsdatum, Fälligkeit (Rechnungen), einen Einheiten-Code je Einheit und keine Menge 0 |

Das E-Rechnungs-Profil ist nur für Rechnungen und Stornos wählbar.

## Dokumentkette

Dokumente lassen sich entlang der Kette umwandeln:

- ein **angenommenes** Angebot → Auftragsbestätigung oder Rechnung,
- eine Auftragsbestätigung (kein Entwurf) → Rechnung,
- eine offene oder bezahlte Rechnung → Storno.

Das neue Dokument ist ein Entwurf mit Kunde, Ansprechpartner, Gruppen, Positionen und Texten der Quelle. Optionale Positionen fallen weg, danach leere Gruppen ebenfalls. Werte eigener Felder wandern mit, wenn das Feld auch für den Zieltyp gilt; andere Werte fallen weg und werden gemeldet. Jedes Dokument kennt seine Quelle, und eine Rechnung kennt das Storno, das sie storniert hat.

Ein Storno übernimmt die Positionen seiner Rechnung mit negativen Mengen. Jede Rechnung hat höchstens ein Storno; ein zweiter Versuch liefert den vorhandenen Entwurf. Wird das Storno abgeschlossen, ist die Rechnung **storniert**.

Duplizieren legt einen neuen Entwurf mit heutigem Datum an, ohne Nummer und ohne Kette. Stornos lassen sich nicht duplizieren.

## Nummernkreise

Jeder Dokumenttyp hat einen eigenen Nummernkreis mit einem Muster:

| Platzhalter | Bedeutung |
|---|---|
| `{YYYY}` | Jahr des Dokumentdatums |
| `{YY}` | zweistelliges Jahr |
| `{MM}` | Monat |
| `{0000}` | laufende Nummer, aufgefüllt auf die Anzahl der Nullen |

Vorgaben: `Q-{YYYY}-{0000}` (Angebote), `OC-{YYYY}-{0000}` (Auftragsbestätigungen), `INV-{YYYY}-{0000}` (Rechnungen), `CN-{YYYY}-{0000}` (Stornos), jeweils jährlich zurückgesetzt.

- Mit **jährlichem Zurücksetzen** hat jedes Jahr einen eigenen Zähler; ein rückdatiertes Dokument bekommt die nächste Nummer seines Jahres. Das Muster muss dann `{YYYY}` oder `{YY}` enthalten.
- Nummern werden vergeben, während der Nummernkreis gesperrt ist; zwei gleichzeitig abgeschlossene Dokumente bekommen nie dieselbe Nummer.
- Gibt es eine Nummer schon (etwa nachdem Muster oder Zähler von Hand geändert wurden), wird sie übersprungen.

## Protokoll

Jede Änderung an einem Dokument wird mit Urheber (Benutzer, API-Token oder System) protokolliert: angelegt, geändert, abgeschlossen, Status geändert, umgewandelt, storniert, dupliziert, gelöscht. Einträge gelöschter Entwürfe bleiben im Protokoll.

## Demo-Daten

Zum Entwickeln und Ausprobieren:

```bash
ddev artisan db:seed --class=DemoSeeder
```

Das **ersetzt alle Fachdaten** (Dokumente, Kunden, eigene Felder, Steuersätze, Einheiten, Textbausteine, Templates, Nummernkreise) durch die fiktive Firma Studio Nordlicht und ihre Kunden. Benutzerkonten bleiben.
````

- [ ] **Step 4: Sidebar**

In `docs/.vitepress/config.ts`:

```ts
const pages = ['documents', 'development'];
```

und in den beiden Label-Objekten ergänzen:

```ts
const en: Record<string, string> = {
    guide: 'Guide',
    documents: 'Documents',
    development: 'Development',
};

const de: Record<string, string> = {
    guide: 'Anleitung',
    documents: 'Dokumente',
    development: 'Entwicklung',
};
```

- [ ] **Step 5: Doku-Test und Build**

```bash
ddev artisan test --filter=DocsTest
ddev exec pnpm --dir docs build
```

Expected: PASS; VitePress baut ohne tote Links (`build complete`).

- [ ] **Step 6: CLAUDE.md aktualisieren**

In `CLAUDE.md`:

1. Im Abschnitt „Was openbill ist“ den Satz `Stand: Phase 1 (Fundament: Login, i18n, Tooling).` ersetzen durch `Stand: Phase 2 (Domain & Datenmodell: Tabellen, Fachlogik, Actions, Demo-Daten; noch keine UI für Dokumente).`

2. Im Abschnitt „Tech Stack“ die Zeile `- Tests: Pest 5 (Feature gegen MariaDB-DB `testing`, Unit ohne App), Larastan Level 6, Pint` ersetzen durch:

```markdown
- Tests: Pest 5 (Suiten `Unit` ohne App, `Feature` gegen MariaDB-DB `testing` mit `RefreshDatabase`, `Integration` mit `DatabaseMigrations` für echte Parallelität), Larastan Level 6, Pint
- Rechnen: brick/math (`BigDecimal`), nie float
```

3. Im Abschnitt „Kommandos“ nach `ddev artisan test --filter=AuthTest` einfügen:

```bash
ddev artisan test --testsuite=Integration    # Parallelprozesse/Locks (DatabaseMigrations, langsamer)
ddev artisan db:seed --class=DemoSeeder      # Demo-Daten (ersetzt alle Fachdaten, Benutzer bleiben)
```

4. Den Abschnitt `## Architektur (Stand Phase 1)` in `## Architektur (Stand Phase 2)` umbenennen und am Ende des Abschnitts anfügen:

```markdown
- **Domain** (`app/Domain`, reines PHP, nur `App\Enums` + brick/math, kein float – `tests/Unit/NoFloatTest.php`, `ArchTest`): `Money/Decimal`, `Tax/*`, `Totals/TotalsCalculator` → `Totals` (`toArray()` mit Strings), `Numbering/NumberFormatter`, `Lifecycle/StatusMachine`, `Fields/*` (Registry, `KeySlugger`, `CustomValueValidator`, `FieldDefinitionValidator`), `Compliance/ComplianceChecker` (Profile `basic`/`en16931`), `Conversion/DocumentConverter`. Port der Logik aus `prototypes/clickdummy-v2/src/domain`; Meldungen kommen als Codes (`ComplianceRule`, `FieldErrorCode`), übersetzt über `compliance.*` / `fields.error.*`.
- **Actions** (`app/Actions`, final, `handle(Actor $actor, …)`): einzige Stelle, die Fachdaten schreibt. Validieren selbst (Laravel-`ValidationException` mit Punkt-Pfaden wie `groups.0.positions.1.custom.ticket`), laufen in Transaktionen, schreiben `document_events` über `App\Support\EventLog`. Liste und Signaturen: Phasenplan `docs/superpowers/plans/2026-10-11-phase-02-domain.md`, Abschnitt „Interfaces“.
- **Support** (`app/Support`): `Actor` (user/token/system), `SnapshotBuilder` (Stammdaten in Snapshot-Form), `DocumentInspector` (Summen/Prüfung: Entwurf live, abgeschlossen aus dem Snapshot), `DomainMapper` (Models → Domain-DTOs), `GroupWriter` (ersetzt Gruppen/Positionen, behält eigene IDs), `Text::t()` (`__()` mit String-Rückgabe).
- **Sperre:** `Document::updating/deleting` werfen `DocumentLockedException`, sobald `finalized_at` gesetzt ist (erlaubt bleiben `status`, `paid_at`, `cancelled_by_id`); Gruppen/Positionen prüfen über `Document::assertDraft()`. Snapshots, Dateien und Events sind unveränderlich.
- **Abschließen:** `FinalizeDocument` in einer Transaktion: Zeile sperren → Prüfprofil (`ComplianceFailedException` mit Issue-Liste) → `AllocateDocumentNumber` (`lockForUpdate` auf `number_sequences`, überspringt belegte Nummern) → Summen → Snapshot → Storno setzt Rechnung auf `cancelled` → `App\Contracts\DocumentArchiver` (Phase 2: `NullDocumentArchiver`, Phase 3: PDF/XML) → Event. Jeder Fehler rollt alles zurück.
- **Exceptions** (`app/Exceptions`, Basis `DomainActionException::status()`): `DocumentLockedException` 409, `ActionNotAllowedException` 409 (`reason`), `ComplianceFailedException` 422 (`toArray()` → `[{path, message}]`).
- **Grunddaten** kommen aus der Migration `2026_10_11_100300_insert_default_master_data.php` (Organisation, Dokumenttypen, Nummernkreise `Q`/`OC`/`INV`/`CN`, Steuersätze, Einheiten), nicht aus Seedern.
```

5. Im Abschnitt „Fallstricke“ anfügen:

```markdown
- Mass-Updates/-Deletes (`Model::query()->update()`, `->delete()` auf Relationen) umgehen die Sperr-Hooks. In Actions nur für Entwürfe benutzen (wie `GroupWriter`, `SaveCustomer`), nie für abgeschlossene Dokumente.
- Beträge/Mengen in Action-Eingaben nur als String mit Punkt oder int (`DecimalString`); JSON-Zahlen mit Nachkommastellen (`12.5`) werden abgelehnt.
- Feature-Tests laufen in einer Transaktion: Was andere Prozesse oder Verbindungen sehen müssen (Locks, `Concurrency`), gehört in `tests/Integration` (DatabaseMigrations, committete Daten). Closures für `Concurrency::run()` müssen `static` sein.
- `document_types` hat den String-PK `type` (Model `DocumentTypeSetting`, weil `DocumentType` das Enum ist).
- Laravels eingebaute Validierungstexte (`required`, `email`, …) sind nur englisch, bis `lang/de/validation.php` existiert; eigene Meldungen stehen in `lang/*.json`.
```

- [ ] **Step 7: Fortschritt im Master-Plan**

In `docs/superpowers/plans/2026-10-11-openbill-app.md` im Abschnitt „Fortschritt“ `- [ ] Phase 1: Fundament` durch `- [x] Phase 1: Fundament` ersetzen (Phase 2 hakt der Orchestrator nach dem Merge ab).

- [ ] **Step 8: Volle Suite und Commit**

```bash
ddev artisan test
git add docs/en/documents.md docs/de/documents.md docs/.vitepress/config.ts CLAUDE.md docs/superpowers/plans/2026-10-11-openbill-app.md
git commit -m "docs: add documents page, update CLAUDE.md for phase 2, tick phase 1

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Expected: alle Tests PASS.

---
### Task 16: Abnahme, Push und Pull Request

**Files:** keine neuen (nur Korrekturen, falls die Abnahme etwas findet).

**Interfaces:**
- Consumes: alles.
- Produces: Branch `phase-02-domain` auf `origin`, offener PR gegen `main` (nicht gemergt).

- [ ] **Step 1: Frische Datenbank, Migration und Demo-Daten**

```bash
cd /Users/rafael/development/baeroe/openbill
ddev start
ddev composer install
ddev artisan migrate:fresh --no-interaction
ddev artisan db:seed --class=DemoSeeder --no-interaction
ddev artisan tinker --execute="echo App\Models\Document::count().' '.App\Models\DocumentSnapshot::count().' '.App\Models\Customer::count().' '.App\Models\FieldDefinition::count();"
ddev artisan app:ensure-admin
```

Expected: Migrationen `DONE`, Seeder ohne Fehler, Ausgabe `8 6 4 8`; Admin wird angelegt bzw. „already exists“.

- [ ] **Step 2: Alle Checks wie in CI**

```bash
ddev exec vendor/bin/pint --test
ddev exec vendor/bin/phpstan analyse --no-progress --memory-limit=1G
ddev artisan test
ddev exec pnpm typecheck
ddev exec pnpm build
ddev exec 'pnpm --filter "./prototypes/*" run test'
ddev exec pnpm --dir docs build
```

Expected: alles grün; Pest meldet die Suiten `Unit`, `Feature` und `Integration` als PASS (keine SKIPPED).

- [ ] **Step 3: Abnahme der Phase gegen den Master-Plan**

Einzeln abhaken (jede Zeile hat ihren Test):

- Migrationen/Models für alle Tabellen aus Spec 4 → `SchemaTest`, `DocumentLockTest`
- Domain mit brick/math, kein float → `TotalsTest`, `NoFloatTest`, `ArchTest`
- alle Actions mit `document_events` und `Actor` → `DraftActionsTest`, `FinalizeDocumentTest`, `DocumentFlowTest`, `CustomerActionsTest`, `SettingsActionsTest`, `FieldDefinitionActionsTest`
- Feldvalidierung mit Pfaden → `CustomValueValidatorTest`, `DraftActionsTest`, `CustomerActionsTest`
- Nummernvergabe mit `lockForUpdate` und Parallelität → `AllocateDocumentNumberTest`, `tests/Integration/NumberAllocationTest.php`
- Snapshot beim Abschließen, Stammdaten danach geändert → `FinalizeDocumentTest`
- Sperre im Model → `DocumentLockTest`
- Demo-Seeder → `DemoSeederTest` + Step 1
- Doku `documents` en/de → `DocsTest` + Docs-Build

Die Testnamen aus den portierten Prototyp-Tests (`totals.test.ts`, `numbering.test.ts`, `fields.test.ts`, `convert.test.ts`, `compliance.test.ts`) müssen sich in `tests/Unit/Domain/*` bzw. `AllocateDocumentNumberTest` wiederfinden: `rg -n "^\s*it\(" prototypes/clickdummy-v2/src/domain/{totals,numbering,fields,convert,compliance}.test.ts` mit `rg -n "^\s*it\(" tests/Unit/Domain tests/Feature/Actions/AllocateDocumentNumberTest.php` vergleichen.

- [ ] **Step 4: Vor dem Push prüfen**

```bash
git config user.email                                  # rafael@hauss.dev
git status --short                                     # leer
git log --format='%an <%ae>%n%b' main..HEAD | grep -E "<|Co-Authored" | sort | uniq -c
git grep -n -i -f ~/.config/openbill/denylist.txt || echo "clean"   # local, untracked list of names that must never appear
git ls-files | grep -E "\.env$|^vendor/|node_modules/|public/build/|public/hot" || echo "no artifacts"
```

Expected: nur `Rafael Haußmann <rafael@hauss.dev>` als Autor, jede Nachricht mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; `clean` (gibt es die Denylist nicht, meldet `git grep` einen Dateifehler – dann Demo-Namen und Testdaten von Hand auf echte Firmen/Personen prüfen); `no artifacts`.

- [ ] **Step 5: Push und PR**

```bash
git push -u origin phase-02-domain
gh pr create --base main --head phase-02-domain --title "Phase 2: Domain & data model" --body-file - <<'EOF'
## Summary

- Data model for every table of spec section 4 (ULIDs, casts, decimals as strings), base data via migration (organization, document types, number ranges, tax rates, units)
- `app/Domain`: plain PHP on brick/math – totals and taxes, number patterns, status machine, custom field registry and validation, compliance profiles (basic, EN 16931), conversion; ported from `prototypes/clickdummy-v2/src/domain` with its tests
- `app/Actions`: create/update/delete drafts, finalize (transaction + `lockForUpdate` number allocation + snapshot + `DocumentArchiver` hook for phase 3), set status, convert, cancel, duplicate, customers, custom fields, organization, document types, tax rates, units, text blocks; every document change is logged in `document_events` with the actor
- Finalized documents are locked in the model (only status, paid_at, cancelled_by_id change); snapshots/events/files are immutable
- Field validation with dot paths (`custom.po_number`, `groups.0.positions.1.custom.ticket`) as `ValidationException`; `DocumentLockedException` (409), `ActionNotAllowedException` (409), `ComplianceFailedException` (422 with issue list) for phases 4 and 8
- `DemoSeeder` with the fictional clickdummy data
- Architecture tests (pure domain, final actions, no float in `app/Domain`), new Pest suite `Integration` for real parallel number allocation
- Docs page `documents` (en/de), CLAUDE.md updated, phase 1 ticked in the master plan

## Test plan

- [ ] CI `tests` green
- [ ] `ddev artisan migrate:fresh && ddev artisan db:seed --class=DemoSeeder` creates 8 documents (6 finalized with snapshot) and 4 customers
- [ ] `ddev artisan test --testsuite=Integration` green (parallel allocation, lock wait)
- [ ] `ddev exec pnpm --dir docs build` green, page `documents` in both languages

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
```

- [ ] **Step 6: CI beobachten**

Run: `gh pr checks --watch`
Expected: `tests` pass. Bei Fehlern: Ursache beheben (CI hat keinen DDEV-Container: DB-Host `127.0.0.1`; die Integration-Suite startet Kindprozesse mit `php artisan`, die Umgebung kommt aus den Job-Variablen und `phpunit.xml`), als `fix: …`-Commit mit Co-Authored-By-Zeile pushen, erneut beobachten. **Nicht mergen.**
