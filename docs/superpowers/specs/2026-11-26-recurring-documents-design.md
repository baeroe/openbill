# Wiederkehrende Dokumente (OPBI-1)

Stand: 2026-11-26 · Status: Entwurf zur Freigabe · Epic: OPBI-1 (werkbuch)

## 1. Ziel und Warum

Rahmenverträge, Monitoring- und Wartungspauschalen laufen über Jahre. Jeden Monat dieselbe Rechnung von Hand anzulegen kostet Zeit und lädt zu Fehlern ein (falscher Leistungszeitraum, vergessener Monat). openbill soll aus einer **Vorlage** zu festen Terminen **normale Entwürfe** erzeugen. Der Entwurf bleibt danach frei bearbeitbar – typisch: zur Pauschale kommen Stundenpositionen für Mehraufwand – und wird wie jedes andere Dokument von Hand abgeschlossen.

Gilt für **alle Dokumenttypen außer Storno** (Rechnung, Angebot, Auftragsbestätigung; später die Textdokumente aus OPBI-2). Beispiele: monatliche Monitoring-Rechnung, jährliches Verlängerungsangebot fürs Hosting, quartalsweise Auftragsbestätigung bei Abrufkontingenten.

**Erfolgskriterien**

- Vorlage anlegen (neu oder aus einem bestehenden Dokument), im gewohnten Dokument-Editor bearbeiten, Intervall setzen → am Termin liegt ein Entwurf mit richtigem Datum, Leistungszeitraum, Fälligkeit und ersetzten Platzhaltern bereit.
- Der Entwurf erscheint in der Übersicht unter „Aufmerksamkeit“ als „Aus Vorlage erzeugt“.
- War die Instanz ein paar Tage aus, holt sie verpasste Termine nach; pro Zeitraum entsteht nie mehr als ein Entwurf.
- Nach `docker compose pull && docker compose up -d` läuft das ohne Änderung an der Compose-Datei.
- Alles auch über REST-API und MCP; Doku en + de.

## 2. Ziele, Nicht-Ziele, Anti-Ziele

**Ziele (v1)**

- Plan je Vorlage: Intervall in Monaten, Start, optionales Ende, vorschüssig/nachträglich, aktiv/pausiert.
- Automatisches Erzeugen über den Laravel-Scheduler, dazu „Jetzt erzeugen“ von Hand.
- Platzhalter `{month}`, `{year}`, `{period}` in Texten.
- Liste der Pläne mit nächstem Termin, letztem Fehler und den erzeugten Dokumenten.

**Nicht-Ziele (eigene Tickets später)**

- Stundenkontingente, Übertrag ungenutzter Stunden
- Import von Stunden aus einer Zeiterfassung (Mehrstunden trägt man im Entwurf von Hand nach)
- Erinnerungen vor Verlängerung/Kündigungsfrist (es gibt noch keinen Benachrichtigungsweg, keine Mails in der App)
- Automatisches Abschließen ohne Prüfung
- Platzhalter in der Vorschau der Vorlage auflösen (die Vorschau zeigt `{month}` wörtlich)
- Intervalle in Tagen/Wochen

**Anti-Ziele (wäre ein Fehlschlag, auch wenn es technisch läuft)**

- Eine Vorlage taucht irgendwo als normaler Entwurf auf (Dokumentliste, Übersicht, Zähler, MCP `list-documents`, Render-Quellen) oder lässt sich abschließen, umwandeln, duplizieren oder per Status ändern.
- Ein Zeitraum wird doppelt erzeugt (zwei Container, doppelter Klick, Neustart mitten im Lauf).
- `app:prune-images` löscht Bilder, die nur eine Vorlage nutzt.
- Bestehende Installationen müssen ihre Compose-Datei ändern, damit es läuft.

## 3. Ansätze (entschieden)

| Ansatz | Bewertung |
|---|---|
| **A: Vorlage ist ein ausgeblendetes Dokument** (`documents.is_template` + Global Scope) | **gewählt.** Editor, Vorschau, Gruppen, Positionen, Rabatte, eigene Felder, Autosave, API `PATCH /api/documents/{id}` und MCP `get-document`/`update-document` funktionieren nach dem Freischalten weniger Ladestellen (5.1) ohne weiteren Code. Preis: der Scope muss überall greifen; Ausnahmen sind eine kleine, per Test festgehaltene Liste. |
| B: Plan zeigt auf eine bestehende Rechnung als Quelle | verworfen: Vorlage ändern = Quelle wechseln; nimmt man die letzte Rechnung, wandern deren Mehrstunden mit. |
| C: Eigene Tabellen für Vorlagen-Gruppen/-Positionen | verworfen: zweiter Editor, doppelte Logik. |

Scheduler: **im bestehenden Container** als zusätzlicher s6-Dienst (das Basis-Image `serversideup/php:…-fpm-nginx-v5` startet nginx und PHP-FPM über s6-overlay, `/etc/s6-overlay/s6-rc.d/{nginx,php-fpm}`). Verworfen: eigener Compose-Dienst `scheduler` (jede bestehende Installation müsste ihre Compose-Datei ändern, und der Entrypoint würde dort ein zweites Mal migrieren); Erzeugen „nebenbei“ bei Requests (versteckte Nebenwirkung, für spätere Erinnerungen ungeeignet).

## 4. Datenmodell

**Neue Tabelle `recurring_documents`** (Model `RecurringDocument`, ULID):

| Spalte | Typ | Bedeutung |
|---|---|---|
| `id` | ulid | |
| `template_document_id` | ulid null FK `documents`, unique | die Vorlage (`is_template = true`); null nach dem Löschen des Plans |
| `name` | string(200) | Anzeigename, z. B. „Monitoring Hafenkontor“ |
| `interval_months` | tinyint unsigned | 1–24 (1 = monatlich, 3 = Quartal, 12 = jährlich) |
| `timing` | string(16) | Enum `RecurringTiming`: `advance` (vorschüssig) / `arrears` (nachträglich) |
| `start_on` | date | erster Termin, Anker für den Tag im Monat |
| `end_on` | date null | letzter möglicher Termin (inklusive); danach erzeugt der Plan nichts mehr |
| `next_run_on` | date null | nächster Termin; null = Plan beendet |
| `paused_at` | timestamp null | pausiert = erzeugt nichts, `next_run_on` läuft beim Fortsetzen **nicht** nach (siehe 5.3) |
| `last_run_at` | timestamp null | |
| `last_error` | text null | letzter Fehler beim Erzeugen (Meldung für die Liste), beim nächsten Erfolg null |
| `created_by` | ulid FK users null | |
| `deleted_at` | timestamp null | Soft Delete (5.5) |
| timestamps | | |

**Neue Spalten in `documents`:**

- `is_template` boolean default false, Index
- `recurring_document_id` ulid null FK `recurring_documents` (ohne `nullOnDelete`, Pläne werden nur soft gelöscht), an erzeugten Dokumenten
- `recurring_period_start` date null, an erzeugten Dokumenten
- unique (`recurring_document_id`, `recurring_period_start`) – Schutz gegen Doppelte

Fallstrick (CLAUDE.md): Neue Spalten in `documents` → Trigger `documents_lock_update` in derselben Migration neu anlegen (DROP + CREATE mit allen gesperrten Spalten). Alle drei neuen Spalten gehören zu den gesperrten (nach dem Abschließen unveränderlich). Deshalb werden Pläne nie hart gelöscht (ein `nullOnDelete` würde abgeschlossene Dokumente ändern und am Trigger scheitern), siehe 5.5.

**Kopieren:** `is_template`, `recurring_document_id` und `recurring_period_start` werden beim Duplizieren und Umwandeln **nie** mitkopiert (`DuplicateDocument` nutzt `replicate()` – ohne Ausschluss gäbe die Kopie eines erzeugten Entwurfs eine Unique-Verletzung; `ConvertDocument` prüfen). Test dafür.

**Enums:** `RecurringTiming` (`advance`, `arrears`); `EventAction::Generated` (`generated`, Daten `recurring_document_id`, `period_start`, `period_end`).

## 5. Verhalten

### 5.1 Global Scope für Vorlagen

- `App\Models\Scopes\ExcludeTemplates` an `Document` (in `booted()`): `where documents.is_template = false`.
- `Document::withTemplates()` (lokaler Scope/Makro = `withoutGlobalScope(ExcludeTemplates::class)`) ist **die einzige** Art, Vorlagen zu sehen.
- **Erlaubte Stellen** (abschließend; neue nur mit Begründung):
  - `DocumentController@show` (Editor öffnet die Vorlage)
  - `DocumentProvider::load` (GET `/api/documents/{id}`, MCP `get-document`)
  - `DocumentProcessor` (lädt für PATCH und DELETE an derselben Stelle): PATCH → `UpdateDraft`; DELETE einer Vorlage → 409 `template_delete_via_plan`
  - MCP `get-document` und `update-document`: laden über `OpenbillTool::find()` (`$class::query()->find`) – für Dokumente in diesen beiden Tools mit `withTemplates()` laden (z. B. eigene Methode an `OpenbillTool`), alle anderen Tools bleiben beim Scope
  - `UpdateDraft` (Autosave/MCP `update-document`)
  - `RenderPreview` (Vorschau im Editor, `document_id`)
  - `DescribeDocumentPage` (Seitenkontext)
  - `DeleteCustomer`, `SaveCustomer` (entfernte Kontakte an Entwürfen), `DeleteTemplate` (Template in Benutzung?) – sonst bleiben Vorlagen mit toten Bezügen zurück bzw. der FK schlägt fehl
  - (`ImageReferences` liest schon mit `withoutGlobalScopes()`, bleibt unverändert; Test, dass Vorlagen-Bilder überleben)
  - die neuen Recurring-Actions
- **Bleiben bewusst ohne Vorlagen** (→ 404 für Vorlagen, gewolltes Verhalten): `FinalizeDocument`, `SetDocumentStatus`, `ConvertDocument`, `DuplicateDocument`, `CancelInvoice`, `DeleteDraft`, PDF/XML/signierte Downloads, `DocumentQuery`, `Overview`, `ListRenderSources`, `DocumentChain`, `NumberRange`.
- `ArchTest`: `withTemplates`, `withoutGlobalScope(` und `withoutGlobalScopes(` auf Dokumenten nur in den Dateien der Liste oben (plus `ImageReferences`).
- **Der Scope greift nicht bei Joins und `DB::table()`.** Abfragen, die `documents` joinen (z. B. `SuggestPositions`, `app/Actions/SuggestPositions.php:38`: sonst tauchen Vorlagen-Positionen samt `{month}` in den Positionsvorschlägen auf), filtern `documents.is_template = false` selbst. Beim Umsetzen nach `join('documents'` / `'documents.` in `app/` suchen und jede Stelle prüfen; Test für die Positionsvorschläge.
- `DocumentResource` bekommt `is_template` und `recurring_document_id`, `recurring_period_start`.

### 5.2 Vorlage anlegen

Action `CreateRecurringDocument(Actor, array $input)`, zwei Wege:

- **neu:** `type` (nicht `cancellation`), `customer_id` (optional), `name`, Plan-Felder → legt die Vorlage wie `CreateDocument` an (gleiche Defaults: Template des Dokumenttyps, Sprache, Texte) mit `is_template = true`, dann den Plan.
- **aus Dokument:** `from_document_id` + `name` + Plan-Felder → kopiert das Dokument wie `DuplicateDocument` (Gruppen/Positionen/Rabatte/eigene Felder über `DomainMapper::groupRows`) in eine neue Vorlage. Quelle darf jeder Typ außer Storno und jeder Status sein (auch abgeschlossen).

Die Kopierlogik von `DuplicateDocument` wird dafür in einen gemeinsamen Helfer gezogen (z. B. `App\Support\DocumentCopier::copy(Document $source, array $overrides): Document`), den `DuplicateDocument`, `CreateRecurringDocument` und `GenerateRecurringDraft` benutzen. Kein drittes Kopieren von Hand.

Validierung (422 an Feldpfaden): `interval_months` 1–24, `timing` aus dem Enum, `start_on` Datum, `end_on` ≥ `start_on`, `name` 1–200 (getrimmt über `TrimmedInput`). `next_run_on` = `start_on`. Event `created` an der Vorlage.

### 5.3 Termine und Zeitraum (reines PHP in `app/Domain/Recurring/Schedule`)

- Termin k (k = 0, 1, 2, …) = `start_on + k × interval_months` Monate **ab dem Anker** gerechnet, mit Monatsende-Kappung (`addMonthsNoOverflow`): Start 31.01. → 28.02. → 31.03. → 30.04. Nie iterativ vom letzten Termin weiterrechnen (sonst driftet 31. → 28. → 28.).
- Zeitraum zu Termin T:
  - `advance`: `[T, T + interval − 1 Tag]` (Termin 01.11., monatlich → 01.11.–30.11.)
  - `arrears`: `[T − interval, T − 1 Tag]` (Termin 01.12., monatlich → 01.11.–30.11.)
  - Beides ebenfalls ab Anker mit Kappung rechnen (Zeitraum k beginnt an Termin k bzw. k−1).
- `end_on`: Termine nach `end_on` gibt es nicht; nach dem letzten wird `next_run_on = null` (Plan beendet).
- Pausieren setzt `paused_at`. Fortsetzen setzt `paused_at = null` und schiebt `next_run_on` auf den ersten Termin ≥ heute (pausierte Zeiträume werden **nicht** nachgeholt). Das ist der Unterschied zum Nachholen nach Ausfall (5.4).
- „Heute“ = `now()` in `config('app.timezone')` (UTC). Bewusst so gelassen; Doku erwähnt, dass der Lauf nach Mitternacht UTC fällig wird.
- Unit-Tests: Monatsende-Kappung, Schaltjahr, Quartal/Jahr, beide `timing`, `end_on` genau auf einem Termin.

### 5.4 Erzeugen

Action `GenerateRecurringDraft(Actor, RecurringDocument $plan, ?string $forceToday = null): ?Document` erzeugt **einen** Termin, in einer Transaktion:

1. Plan mit `lockForUpdate` neu laden; ohne `next_run_on` oder pausiert → nichts (bzw. bei „Jetzt erzeugen“ 409 `recurring_inactive`).
2. Zeitraum aus `next_run_on` berechnen.
3. Vorlage kopieren (`DocumentCopier`) mit `is_template = false`, `status = draft`, `date` = **heute** (auch beim Nachholen), `service_date`/`service_date_end` = Zeitraum, `due_date`/`valid_until` nach denselben Regeln wie `CreateDocument` (Zahlungsziel bei Rechnungen, Gültigkeit bei Angeboten – Regel in einen gemeinsamen Helfer ziehen, nicht kopieren), `recurring_document_id`, `recurring_period_start`, `created_by` = Ersteller des Plans bzw. Actor.
4. Platzhalter ersetzen (5.6).
5. Summen wie in `DuplicateDocument` (`DocumentInspector::applyTotals`).
6. Event `generated` am neuen Dokument; `next_run_on` auf den nächsten Termin (oder null), `last_run_at = now()`, `last_error = null`.

Unique-Verletzung (`recurring_document_id`, `recurring_period_start`) → Zeitraum gibt es schon: `next_run_on` weiterschieben, kein Fehler.

**Befehl `app:generate-recurring`:** für jeden aktiven Plan mit `next_run_on ≤ heute` in einer Schleife `GenerateRecurringDraft` aufrufen, bis `next_run_on > heute` (holt verpasste Termine nach, je Zeitraum ein Entwurf). Fehler eines Plans: Meldung in `last_error`, Log, weiter mit dem nächsten Plan; `next_run_on` bleibt stehen (nächster Lauf versucht es wieder). Actor = `systemActor` / `Actor::system()`. Option `--dry-run` listet nur.

**„Jetzt erzeugen“** (UI/API/MCP): erzeugt den Termin `next_run_on`, auch wenn er in der Zukunft liegt (z. B. um früher zu schicken), und rückt danach weiter. Antwort = das neue Dokument.

### 5.5 Ändern, Pausieren, Löschen

- `UpdateRecurringDocument`: `name` und `end_on` jederzeit. **`start_on`, `interval_months` und `timing` nur, solange der Plan noch nichts erzeugt hat**, danach 409 `recurring_schedule_locked` (sonst entstehen Lücken oder doppelte Zeiträume, z. B. nachträglich → vorschüssig überspringt einen Monat). Wer den Rhythmus ändern will, beendet den Plan per `end_on` und legt aus der Vorlage einen neuen an (Weg „aus Dokument“ mit der Vorlagen-ID ist erlaubt). Vor dem ersten Lauf: `next_run_on = start_on`.
- `end_on` ändern: liegt `next_run_on` danach → `next_run_on = null` (beendet). Wird ein beendeter Plan verlängert → `next_run_on` = erster Termin ≥ heute **und** nach dem zuletzt erzeugten Zeitraum (gleiche Regel wie Fortsetzen, kein Nachholen der Zeit dazwischen); liegt der nach dem neuen `end_on`, bleibt er beendet.
- `PauseRecurringDocument`/`ResumeRecurringDocument` (5.3).
- Die Vorlage selbst (Kunde, Texte, Positionen) ändert man im Editor bzw. per `PATCH /api/documents/{template_id}` – wirkt ab dem nächsten erzeugten Entwurf, nie rückwirkend.
- `DeleteRecurringDocument`: Soft Delete des Plans (`deleted_at`), `template_document_id = null`, Vorlage hart löschen (wie `DeleteDraft`, Gruppen/Positionen per Cascade). Erzeugte Dokumente bleiben unverändert und behalten `recurring_document_id`; der Hinweis im Editor zeigt dann „Vorlage gelöscht“. Gelöschte Pläne erzeugen nichts und erscheinen nicht in Listen.
- Kunde löschen (`DeleteCustomer`): Pläne mit Vorlagen dieses Kunden werden wie oben gelöscht (in derselben Transaktion).

### 5.6 Platzhalter

`App\Domain\Recurring\Placeholders::apply(string $text, Period $period, string $locale): string`, ersetzt genau:

| Platzhalter | de | en |
|---|---|---|
| `{month}` | „November“ (Monat des Zeitraumbeginns) | „November“ |
| `{year}` | „2026“ (Jahr des Zeitraumbeginns) | „2026“ |
| `{period}` | „01.11.2026 – 30.11.2026“ | „Nov 1, 2026 – Nov 30, 2026“ |

Datumsformat von `{period}` = dasselbe wie der Liquid-Filter `date` ohne Format (`OpenbillFilters`, de `d.m.Y`, en `M j, Y`) – gemeinsame Formatfunktion nutzen, nicht kopieren. Monatsnamen über `Carbon::locale($locale)->monthName`. Unbekannte `{…}` bleiben stehen. Angewendet auf: `intro`, `closing`, Gruppentitel, Positionsname/-beschreibung und Werte eigener Felder vom Typ Text/Textarea. Nicht in der Vorlage selbst (die behält die Platzhalter).

### 5.7 Scheduler im Image

- `routes/console.php`: `Schedule::command('app:generate-recurring')->hourly()->withoutOverlapping()`.
- Dockerfile: s6-Longrun-Dienst `scheduler` neben `nginx`/`php-fpm` mit `with-contenv` und `php /var/www/html/artisan schedule:work`, als `www-data`. Registrierung wie im gepinnten Image: Dienstordner unter `/etc/s6-overlay/s6-rc.d/scheduler/` (`type` = `longrun`, `run`), eingehängt über eine leere Datei `/etc/s6-overlay/user-bundles.d/user/contents.d/scheduler` (dort liegen auch `nginx`/`php-fpm`). Muss nach dem Entrypoint (`optimize`, Config-Cache mit `APP_KEY`) starten – gilt für s6-Dienste ohnehin, im Test prüfen.
- `DockerSetupTest` ergänzen (Dienst vorhanden, Befehl). Compose-Dateien bleiben unverändert.
- DDEV: `web_extra_daemons` in `.ddev/config.yaml` mit `php artisan schedule:work`.
- Doppelte Läufe (mehrere Container) sind durch Plan-Sperre + Unique-Schlüssel harmlos.

## 6. Oberflächen

### 6.1 UI

- **Navigation:** neuer Punkt „Wiederkehrend“ (`resources/js/layouts/nav.ts`), Seite `/{locale}/recurring` (`RecurringController@index`, Inertia `recurring/index`): Liste der Pläne (Name, Kunde, Typ, Intervall, nächster Termin, pausiert/beendet, letzter Fehler, Anzahl erzeugter Dokumente), Filter `customer_id`, Knopf „Neue Vorlage“ (Dialog: Name, Typ, Kunde, Plan-Felder → öffnet danach den Editor der Vorlage).
- **Editor der Vorlage** (`/documents/{template_id}`): gleicher Editor, `DescribeDocumentPage` liefert `context.recurring` (Plan-Felder, nächste 3 Termine mit Zeitraum, letzte erzeugte Dokumente mit Link) und keine Abschließen-/Status-/Umwandeln-/Duplizieren-Aktionen und keine Nummernvorschau. Statt der Abschließen-Leiste eine Karte „Wiederholung“ mit den Plan-Feldern (speichern über `PATCH /api/recurring-documents/{id}`), Pausieren/Fortsetzen, „Jetzt erzeugen“, Löschen (mit Bestätigung). Hinweis auf die Platzhalter mit kurzer Erklärung.
- **Aus Dokument:** (auch aus einer Vorlage, um den Rhythmus zu wechseln) im Menü eines Dokuments (außer Storno) „Als wiederkehrende Vorlage“ → derselbe Dialog vorbefüllt, `from_document_id`.
- **Erzeugter Entwurf:** im Editor ein Hinweis „Aus Vorlage <Name> für <Zeitraum>“ mit Link zur Vorlage.
- **Übersicht:** Grund `recurring` (`Overview::attention`): Entwürfe mit `recurring_document_id` vor den übrigen Entwürfen, `reason_date` = `created_at`, eigenes Icon (z. B. `Repeat` aus lucide), Text „Aus Vorlage erzeugt …“. `overview.tsx`: Typ `Reason`, Map `ATTENTION`, Übersetzung.
- Alle Texte über `lang/en.json`/`lang/de.json`; Gestaltung nach `prototypes/clickdummy-v2/DESIGN.md`, Einstellungskarten-Stil wie `SettingsCard`.

### 6.2 REST-API

DTO `RecurringDocumentResource` (`app/ApiResource`), `middleware: ApiMiddleware::…` an jeder Operation, `Normalization::CONTEXT`:

- `GET /api/recurring-documents` (Filter `customer_id`, `type`; Seiten) – `api:read`
- `GET /api/recurring-documents/{id}` – `api:read`; enthält `template_document_id`, Plan-Felder, `next_runs` (nächste 3 Termine mit Zeitraum), `customer` (Kurzform), `type`
- `POST /api/recurring-documents` (neu oder `from_document_id`) – `api:write`
- `PATCH /api/recurring-documents/{id}` – `api:write`
- `POST /api/recurring-documents/{id}/pause`, `/resume`, `/generate` – `api:write`
- `DELETE /api/recurring-documents/{id}` – `api:write`

Inhalt der Vorlage über die bestehenden `GET|PATCH /api/documents/{template_document_id}`. `RightsMatrixTest` und `NormalizationTest` ergänzen.

### 6.3 MCP

Neue Tools (Namen exakt so, Annotationen wie bestehende): `list-recurring-documents` (IsReadOnly), `create-recurring-document` (IsDestructive false), `update-recurring-document` (IsDestructive; inkl. `paused: bool`), `generate-recurring-document` (IsDestructive false). Löschen bewusst nicht per MCP. Inhalt der Vorlage über `get-document`/`update-document` mit der Vorlagen-ID; die Tool-Beschreibung sagt das. `OpenbillServer::$tools`, Instructions, `docs/*/mcp.md` ergänzen (`McpServerTest`).

## 7. Doku (en + de)

- Neue Seite `recurring-documents.md` (beide Sprachen, in `pages` in `docs/.vitepress/config.ts`): Vorlage anlegen, Intervall/Zeitraum mit Beispielen (vorschüssig/nachträglich, Monatsende), Platzhalter, Nachholen vs. Pausieren, „Jetzt erzeugen“, Scheduler (läuft im Container; DDEV/eigene Installationen: `schedule:work` bzw. Cron `schedule:run`), UTC-Hinweis.
- `api.md`, `mcp.md`, `documents.md` (Hinweis auf erzeugte Entwürfe), `upgrading.md` (Abschnitt der nächsten Version: neuer Scheduler-Dienst im Image, keine Compose-Änderung).
- Screenshots über `pnpm --dir e2e docs:screenshots` (Liste, Vorlagen-Editor mit Karte „Wiederholung“), Demo-Daten im `DemoSeeder`: ein monatlicher Plan „Monitoring“ für Hafenkontor Lindqvist mit zwei erzeugten Entwürfen.
- CLAUDE.md: Architekturabschnitt „Wiederkehrende Dokumente“ inkl. Global-Scope-Regel und Liste der erlaubten Stellen, Scheduler im Image, Fallstrick „neue Abfragen auf Vorlagen nur über `withTemplates()`“.

## 8. Tests (Schwerpunkte)

- Unit: `Schedule` (5.3), `Placeholders` (5.6).
- Feature: Vorlage taucht in keiner Liste/Übersicht/Zählung/MCP-Liste/Render-Quelle auf; Finalize/Status/Convert/Duplicate/Cancel/PDF auf Vorlage → 404; DELETE `/api/documents/{template}` → 409; `app:prune-images` behält Vorlagen-Bilder; Erzeugen setzt Datum, Zeitraum, Fälligkeit, Platzhalter, Event; zweimal erzeugen → ein Dokument; Nachholen über drei verpasste Monate → drei Entwürfe; pausieren/fortsetzen holt nicht nach; Kunde/Template löschen mit Vorlagen.
- Integration: zwei parallele `app:generate-recurring` → je Zeitraum ein Dokument (`Concurrency`, statische Closure in einer ladbaren Klasse).
- `ArchTest` (5.1), `SchemaTest` (Trigger), `DockerSetupTest` (s6-Dienst), `RightsMatrixTest`, `McpServerTest`, `TranslationsTest`, `DocsTest`.
- e2e: Vorlage aus Dokument anlegen → „Jetzt erzeugen“ → Entwurf mit Zeitraum erscheint in der Übersicht.

## 9. Dem Umsetzer überlassen

Komponentenaufbau im Frontend, genaue Texte, Icon, Reihenfolge der Spalten in der Liste, Name des Kopier-Helfers, ob `next_runs` im Provider oder in einer Action berechnet wird (Rechnen bleibt in `app/Domain`).
