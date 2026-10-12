# Phase 7: Templates, eigene Felder, Einstellungen – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Shell bekommt Templates, Eigene Felder und Einstellungen aus dem Klickdummy v2: Template-Galerie mit Mini-Vorschau über `POST /api/render` (erst sichtbar, dann geladen), ZIP-Import, Duplizieren, Löschen; Template-Editor mit CodeMirror 6 (Kopfzeile, Inhalt, Fußzeile, CSS, Manifest + Papier-Formular), Feldleiste, Live-Vorschau mit Bereichshervorhebung, Beispieldaten-Auswahl, Fehlern mit Bereich und Zeile (auch im Code markiert), Speichern über `PUT /files`, Export und Read-only für mitgelieferte Templates; Eigene Felder auf allen Ebenen mit Dokumenttyp-Schaltern in der Zeile, Drawer mit Live-Vorschau, gesperrten Kern- und Profilfeldern, Undo und Bild-Upload; Einstellungen für Organisation (Logo, Besteuerung, `registration_id`), Dokumenttypen (Profil, Nummernkreis mit Vorschau, Vorgaben), Steuern & Einheiten (Archivieren/Wiederherstellen), Textbausteine und Benutzer (Einladen per kopierbarem Link, Rollen); dazu die Kundenoption „Leistungsart“ mit Steuerkategorie `O` – abgesichert mit Pest, Vitest und dem Playwright-Erfolgskriterium „eigenes Feld bis in Vorschau und PDF“.

**Architecture:** Wie in Phase 5/6: Seiten sind Inertia-Komponenten mit Shell (`Page.layout = appLayout`), Inertia-Props nur für Seitenkontext (`template_id`, `scope`, `section`, `can_manage_users`), alle Daten per SWR aus `/api`, geschrieben wird nur über `lib/api.ts` → `/api` → Actions. Neue Schreibwege sind Actions (`DuplicateTemplate`, `ReorderFieldDefinitions`, `StoreUpload`, `UpdateOrganizationLogo`, `RemoveOrganizationLogo`, `PreviewDocumentNumber`, `RestoreTaxRate`, `RestoreUnit`, `InviteUser`, `RevokeInvitation`, `AcceptInvitation`, `ChangeUserRole`, `RemoveUser`); API-Ressourcen bekommen benannte Zusatz-Operationen, Dateien und Sitzungs-Endpunkte sind Controller in `routes/api.php`. Der Template-Editor rendert ausschließlich serverseitig (`POST /api/render` mit `template_id` + ungespeicherten Teilen), `packages/paged-preview` füllt Seiten außerhalb des sichtbaren Bereichs erst, wenn sie erscheinen (IntersectionObserver).

**Tech Stack:** Laravel 13, Inertia v3, React 19, TypeScript 7, Tailwind 4, Vite 8, SWR 2, CodeMirror 6 (`codemirror` 6.0.2, `@codemirror/state` 6.7, `@codemirror/view` 6.43, `@codemirror/lang-liquid` 6.3, `@codemirror/lang-css` 6.3, `@codemirror/lang-json` 6.0, `@codemirror/lint` 6.9), lucide-react, Pest 5, Vitest 5, Playwright (`e2e/`, neu `unpdf` für PDF-Text).

**Spec:** `docs/superpowers/specs/2026-10-11-openbill-app-design.md` (bindend; Abschnitte 2.3 „Rendering nur serverseitig/Rechenlogik nur in PHP“, 4 „Datenmodell“, 7 „Template-Toolkit“ (Schnittstelle des Editors für Phase 9), 8 „UI“), Master-Plan `docs/superpowers/plans/2026-10-11-openbill-app.md` (Abschnitt „Phase 7“ und Entscheidung „Steuerkategorie Drittland“ in Phase 3), Gestaltung `prototypes/clickdummy-v2/DESIGN.md`, Schnittstellen aus `…-phase-04-api.md` und `…-phase-06-editor.md` (jeweils „Interfaces“). **Vorlagen:** `prototypes/clickdummy-v2/src/routes/templates/*` (TemplateGalleryPage, TemplateEditorPage, FieldSidebar, TemplatePreview, templates.css), `src/routes/fields/*` (FieldsPage, FieldDrawer, shared.ts, fields.css), `src/routes/settings/*` (SettingsPage, OrganizationSettings, DocTypeSettings, TaxUnitSettings, TextBlockSettings, UserSettings, settings.css), `src/components/CodeEditor.tsx`. Im Klickdummy rendert und rechnet der Browser; **in der App kommt alles vom Server.**

## Global Constraints

- Branch `phase-07-settings` (ist ausgecheckt). Git-Identität kommt aus `~/.gitconfig`; vor dem ersten Commit `git config user.email` → muss `rafael@hauss.dev` sein, sonst stoppen und nachfragen. Nie `user.email`/`user.name` setzen.
- Jede Commit-Message endet mit der Zeile `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (in diesem Plan als zweites `-m`); die PR-Beschreibung endet mit `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- PHP, Composer, Artisan **nur in DDEV** (`ddev artisan …`, `ddev exec …`). JS-Pakete nur mit pnpm **im Container** (`ddev exec pnpm …`; Root-Abhängigkeiten mit `add -w`, Pakete mit `--filter`), nie npm/npx. Ausnahme: `e2e/` läuft und installiert auf dem Mac (`pnpm --dir e2e …`), dort keine App-Abhängigkeiten.
- Vor jedem Commit: `ddev exec vendor/bin/pint` (bei PHP), `ddev exec vendor/bin/phpstan analyse --memory-limit=1G` (bei PHP), `ddev exec pnpm typecheck` und `ddev exec pnpm test` (bei TS). Code-Blöcke dieses Plans sind inhaltlich verbindlich; Formatierung nach vorhandenem Stil (4 Leerzeichen, einfache Quotes, Semikolons; Pint für PHP).
- **Actions-Regel:** Keine Geschäftslogik in Controllern, Processors oder Seiten. Controller validieren höchstens die Form (Datei vorhanden), rufen genau eine Action und formen die Antwort (`tests/Unit/ArchTest.php`). Actions sind `final`, haben `handle(Actor $actor, …)`, validieren selbst, laufen in Transaktionen, wo sie mehr als eine Zeile schreiben.
- **Rendering und Rechnen nur auf dem Server:** Der Template-Editor zeigt nur, was `POST /api/render` liefert; die Nummernvorschau kommt aus `GET /api/document-types/{type}/number-preview`. Im Browser keine Liquid-Auswertung, keine Nummernformatierung, keine Beträge.
- Neue API-Operationen: `middleware: ApiMiddleware::…` an **jeder** Operation/Route, Schreib-Operationen `read: false, deserialize: false`, `normalizationContext` mit `Normalization::CONTEXT`; jeder neue Pfad bekommt eine Zeile in `tests/Feature/Api/RightsMatrixTest.php` (`MATRIX_ROUTES`), Controller-Routen zusätzlich einen Eintrag in `App\OpenApi\OpenApiFactory` und in `OpenApiTest`. Controller lesen Route-Parameter mit `$request->route('id')`.
- UI-Texte nur über Schlüssel in `lang/en.json` **und** `lang/de.json` (gleiche Schlüssel, flach, Platzhalter `:name`, Plural `.one`/`.other`; deutsche Texte in Du-Form). **Schlüssel ohne Ziffern** (`TranslationsTest` sucht `[a-z_]+(\.[a-z_]+)+`). React `t()`/`tn()`/`path()` aus `resources/js/lib/i18n.ts`, Admin-URLs nur über `path('/…')`. Dateien mit `t('…')` höchstens drei Ordner unter `resources/js` (`resources/js/templates/editor/x.tsx` geht). Dynamische Schlüssel (`t(\`scenario.${key}\`)`) müssen trotzdem in beiden Dateien stehen. Code und Kommentare Englisch.
- Gestaltung nach `prototypes/clickdummy-v2/DESIGN.md` und den Tokens in `resources/css/app.css` (`bg-surface-2`, `text-muted`, `rounded-lg`, `h-control`, `num`, Breakpoints `xs/sm/md/lg`). Keine shadcn-Defaults, Radix nur Dialog/Menü. Zwei Tailwind-Klassen für dieselbe CSS-Eigenschaft sind verboten (kein tailwind-merge; `className` an Komponenten nur für Eigenschaften, die die Komponente nicht setzt). Was mit Utilities nicht sauber geht (Editor-Raster, CodeMirror-Theme), steht in `resources/css/templates.css` (`@layer components`, nur Tokens), importiert in `resources/css/app.css`.
- `packages/paged-preview` bleibt ohne Tailwind und ohne App-Abhängigkeit; die öffentliche Schnittstelle wächst nur um die Prop `lazy` (siehe Interfaces).
- Demo- und Testdaten nur fiktiv (Studio Nordlicht, Hafenkontor Lindqvist, Fjord Analytics, Hotel Alpenglück, Kulturwerk Elbinsel, Bergbahn Demo AG; E-Mails `@example.com` bzw. `.example`). Auch in Screenshots keine echten Firmen, Hosts oder Personen.
- CI: Pflicht-Job heißt `tests` und muss grün sein; Name nie ändern.
- Doku: neue Seiten `custom-fields` und `settings`, ergänzt `templates` (UI-Editor) und `documents`/`e-invoice` (Leistungsart), jeweils `docs/en/` **und** `docs/de/`, neue Seiten in `pages` in `docs/.vitepress/config.ts`; `CLAUDE.md` aktualisieren.
- Der Haken für Phase 6 im Abschnitt „Fortschritt“ des Master-Plans ist mit diesem Plan committet. Den Haken für Phase 7 setzt der Orchestrator nach dem Merge, nicht der Umsetzer.

## Review Focus

- **Kaputtes Template im Editor:** Liquid-Syntaxfehler, unbekannter Filter, ungültiges Manifest-JSON oder ungültige Papiermaße zeigen eine lesbare Meldung mit Datei und Zeile, markieren die Zeile im passenden Tab (Klick springt hin), die letzte gute Vorschau bleibt stehen; ungültiges JSON wird nie gespeichert und nie an `/api/render` geschickt; 422 des Servers zu `manifest.*` landet am Manifest-Tab. → Task 4 (`diagnostics.test.ts`), Task 5 (`editor-state.test.ts`), Task 6 (`errors.test.ts`), Task 15 (Playwright: Syntaxfehler tippen → Meldung mit Zeile, korrigieren → Vorschau).
- **Mitgelieferte und benutzte Templates:** Klar/Kante/Leise sind im Editor schreibgeschützt (kein Speichern, Hinweis „Duplizieren, um es anzupassen“), `PUT /files` antwortet 409 `template_built_in`; Löschen eines Templates, das Dokumente benutzen, antwortet 409 `template_in_use` und die Galerie zeigt die Meldung statt die Karte zu entfernen; Duplikate bekommen einen freien Slug und „(Kopie)“ im Namen und im Manifest. → Task 3 (`DuplicateTemplateTest`), Task 15.
- **Eigene Felder unter Last:** Löschen mit Undo stellt dasselbe Feld (gleiche ID, gleicher Schlüssel) wieder her, weil das `DELETE` erst nach Ablauf des Toasts läuft; das Abwählen des letzten Dokumenttyps wird lokal und auf dem Server (422 `doc_types_missing`) abgelehnt; Reihenfolge mit veralteten oder fremden IDs → 422, nichts ändert sich. → Task 7 (`ReorderFieldDefinitionsTest`), Task 8 (Vitest `field-form.test.ts`), Task 15.
- **Dateien, die keine Bilder sind:** Logo und Bildfelder nehmen nur PNG/JPEG/GIF/WebP/SVG bis 1 MB, deren Inhalt zur Endung passt (umbenannte `.exe` → 422); hochgeladene Dateien werden mit `Content-Security-Policy: …; sandbox` und `nosniff` ausgeliefert (ein SVG mit Skript läuft nie, auch nicht direkt geöffnet); im Template erscheinen Bildfelder nur als Data-URL, alles andere als `''`. → Task 7 (`UploadApiTest`, `ImageFieldContextTest`), Task 9 (`OrganizationLogoTest`).
- **Benutzerverwaltung:** Nur ein Owner lädt ein, ändert Rollen und entfernt Benutzer (Member → 403 `owner_required`, API-Tokens → 403); der letzte Owner kann weder herabgestuft noch entfernt werden (409 `last_owner`), niemand entfernt sich selbst; ein Einladungslink mit geänderter Signatur → 403, abgelaufen → Seite „abgelaufen“, schon benutzt oder widerrufen → Seite „nicht mehr gültig“, E-Mail inzwischen vergeben → 422. → Task 12 (`UserManagementTest`, `InvitationPageTest`), Task 15.

## Entscheidungen (geprüft am 2026-10-12)

| Thema | Entscheidung | Grund / Prüfung |
|---|---|---|
| Umfang | Alles aus „Phase 7 → Liefert“ inklusive Kundenoption „Leistungsart“ (Task 14) in **17 Tasks**. Die Phase ist groß; geschnitten wird nach Schichten pro Bereich (Backend-Task vor UI-Task), jede Task ist für sich testbar | Master-Plan Phase 7 nennt die Leistungsart ausdrücklich (Entscheidung aus Phase 3). |
| Datumsfilter der Dokumentliste (Phase-5-Deferred) | **nicht** in Phase 7 | optional laut Auftrag; gehört zur Dokumentliste, nicht zu Einstellungen (Phase 11). |
| Seitenaufbau | Je Bereich eine Inertia-Seite: `templates/index`, `templates/show`, `fields/index`, `settings/show` (eine Seite für alle Einstellungsbereiche, Prop `section`), `invitation` (Gast). Neue Routen unter `/{locale}`: `/templates`, `/templates/{id}`, `/fields?scope=`, `/settings` → `/settings/organization`, `/settings/{section}` mit `section ∈ organization|document-types|taxes-units|text-blocks|users` | wie Klickdummy (`/settings/<bereich>`); ein Seitenwechsel zwischen Bereichen ist ein normaler Inertia-Besuch mit erhaltener Shell. |
| Navigation | „Templates“ in `navItems()` nach Kunden (Icon `SquareCode`), Gruppe „Einrichten“ (`setupItems()`): „Eigene Felder“ (`ListPlus`), „Einstellungen“ (`Settings`) | `nav.ts`-Kommentar aus Phase 5; Shell blendet die Gruppe schon ein, sobald sie Einträge hat. |
| Template-Liste | `GET /api/templates` (Gruppe `template:list`) bekommt `document_types` (aus `manifest.documentTypes`, sonst alle vier) | Galerie zeigt Typen und wählt das Szenario für die Mini-Vorschau, ohne jedes Template ganz zu laden. |
| Mini-Vorschau | Jede Karte rendert erst, wenn sie sichtbar ist (`useInView`, IntersectionObserver, `rootMargin: 200px`): `POST /api/render` mit `template_id` und Szenario `short_invoice` (bzw. `offer_with_options`, wenn das Template keine Rechnungen kann), eine Seite (`maxPages={1}`), SWR-Schlüssel enthält `updated_at` | Phase-6-Deferred #16: viele Vorschauen gleichzeitig wären 3n+1 Iframes und n Renderaufrufe beim Laden. |
| `paged-preview` lazy | Neue Prop `lazy?: boolean`: Seite 1 sofort, weitere Seiten bekommen ihre drei Iframes erst, wenn die Seite in den sichtbaren Bereich (Viewport, 300 px Vorlauf) kommt; einmal gefüllt bleibt gefüllt. Ohne `IntersectionObserver` (SSR, alte Browser) wird alles gefüllt | Template-Editor zeigt lange Szenarien (`long_invoice`); Editor aus Phase 6 bleibt unverändert (`lazy` aus). |
| Duplizieren | Neue Action `DuplicateTemplate` und Operation `POST /api/templates/{id}/duplicate` (201): kopiert Teile, Manifest (Name „<Name> (Kopie)“/„(copy)“ in der Sprache der Anfrage, höchstens 100 Zeichen), Assets in einen neuen Ordner, freier Slug wie beim Import; `built_in = false` | Spec 4: „built_in schreibgeschützt“ → Anpassen geht nur über eine Kopie; die API hatte keinen Weg. |
| Template-Editor-Zustand | Lokaler Zustand mit reinen Funktionen in `resources/js/templates/editor-state.ts` (`useReducer`), kein Zustand-Store | CLAUDE.md: Zustand nur für den Dokument-Editor; die Logik ist so per Vitest testbar. |
| Template-Teile im Editor | Tabs heißen wie die API-Teile: `header`, `body`, `footer`, `css`, `manifest`. Vorschau-Hervorhebung: `header`→`header`, `body`→`body`, `footer`→`footer`, sonst keine | `RenderError.part` hat dieselben Werte, Fehler lassen sich direkt einem Tab zuordnen. |
| Live-Vorschau | `POST /api/render` mit `{ template_id, template: { header, body, footer, css, manifest }, scenario \| document_id }`, 250 ms entprellt, `createLatest` pro Editor-Instanz (neue Anfrage bricht die alte ab), `keepPreviousData`. Bei ungültigem Manifest-JSON geht das zuletzt gültige Manifest mit | `RenderPreview` nimmt `template` über `template_id` (Phase 4). |
| Beispieldaten | Auswahl aus `GET /api/render/sources?limit=50`: Szenarien (`scenario.<key>`) und echte Dokumente (Typ, Nummer oder „Entwurf“, Kunde). Standard: das zuletzt bearbeitete Dokument, sonst `long_invoice` | Spec 7 (gleiche Quelle wie das Toolkit); das zuletzt bearbeitete Dokument ist im Akzeptanztest das gerade befüllte. |
| Fehler im Editor | Fehlerliste über der Vorschau (`<Datei>:<Zeile> – <Meldung>`, Klick wechselt Tab und setzt den Cursor), im CodeMirror als Diagnose (`@codemirror/lint`, `setDiagnostics`) an der Zeile; `intro`/`closing`-Fehler (aus dem Dokument) nur in der Liste | Abnahme „Fehleranzeige mit Bereich und Zeile, auch im Editor markiert“. |
| Feldleiste | Aus `GET /api/render/schema`: Kernfelder je Ebene als Liquid-Pfad (ohne übersetzte Bezeichnung), eigene Felder mit Bezeichnung und Typ; Klick fügt einen Ausdruck mit passendem Filter an der Cursorposition ein (`fields/expression.ts`); fehlende `expectedFields` des Manifests als Hinweis mit Link auf „Eigene Felder“ | Spart ~65 Übersetzungen für Kernfelder; die Pfade sind das, was Template-Autoren tippen. |
| Speichern | `PUT /api/templates/{id}/files` mit allen fünf Teilen (ohne `assets`), Strg/⌘+S, „Verwerfen“, Verlassen-Schutz (`useLeaveGuard`); Export (`GET /api/templates/{id}/package`) ist bei ungespeicherten Änderungen gesperrt | `UpdateTemplateFiles` ersetzt Assets nur, wenn `assets` gesendet wird. Assets bearbeitet der Editor nicht (Phase 9: Toolkit). |
| Phase-9-Schnittstelle | Komponente `ToolkitSlot` in `resources/js/templates/editor/toolkit-slot.tsx` (Phase 7: rendert `null`), im Editor-Kopf zwischen Export und Speichern mit `{ templateId, builtIn, dirty, save }` | Phase 9 ersetzt nur diese Datei (Knopf + Dialog), siehe Interfaces. |
| Feld-Reihenfolge | Neue Action `ReorderFieldDefinitions` + `POST /api/field-definitions/reorder` (`{ scope, ids }`, alle IDs der Ebene genau einmal) statt zwei PATCHes | atomar; zwei PATCHes könnten halb scheitern. |
| Felder löschen mit Undo | Verzögertes Löschen über `lib/pending-delete.ts` (wie Entwürfe in Phase 6): Zeile verschwindet sofort, `DELETE` erst bei `onExpire` des Toasts | Wiederanlegen per POST bekäme eine neue ID; Schlüssel und gespeicherte Werte bleiben so unberührt. Gleiches Muster für Textbausteine. |
| Steuersätze/Einheiten löschen | `DELETE` archiviert (Phase 4); Undo ruft neu `POST /api/tax-rates/{id}/restore` bzw. `/api/units/{id}/restore` (Actions `RestoreTaxRate`/`RestoreUnit`); archivierte stehen eingeklappt unter „Archiviert“ mit „Wiederherstellen“ | Spec 4: archivieren statt löschen. |
| Bildfelder | Neue Action `StoreUpload` + `POST /api/uploads` (multipart `file`) → `{ path: "uploads/<ulid>.<ext>", mime, size }`; Wert des Feldes ist dieser Pfad. `CustomValueValidator` nimmt für `image` nur noch solche Pfade (`App\Domain\Fields\ImagePath`). `GET /api/uploads/{name}` liefert die Datei für die UI; `ContextBuilder` setzt Bildfelder als Data-URL ein (sonst `''`). Hochgeladene Dateien werden nie gelöscht | Phase-5-Lücke „Upload-Weg für Bildfelder“; abgeschlossene Dokumente verweisen über ihren Snapshot auf den Pfad – Löschen würde ihre Vorschau ändern. Aufräumen ungenutzter Uploads: Phase 11. |
| Logo | `POST/DELETE/GET /api/organization/logo` (Controller → `UpdateOrganizationLogo`/`RemoveOrganizationLogo`/`ReadOrganizationLogo`), Datei unter `logos/<ulid>.<ext>` auf Disk `local`, alte Logos bleiben liegen | Snapshots halten `logo_path`; gleiche Bildprüfung wie Uploads (`App\Support\StoredImage`). |
| Nummernvorschau | `GET /api/document-types/{type}/number-preview?pattern=&reset_yearly=&next_value=` → `{ number, valid, message }` aus `NumberFormatter` (Action `PreviewDocumentNumber`), SWR 250 ms entprellt | Spec 2: Rechenlogik nur in PHP; Phase 4 liefert `next_number` nur für den gespeicherten Stand. |
| Rollen | `owner` verwaltet Benutzer und Einladungen; `member` sieht die Benutzerliste, alles andere (Einstellungen, Felder, Templates) dürfen beide | Auftrag: „nur owner verwaltet Benutzer“. Einstellungen auf Owner zu beschränken hieße, API-Tokens von Membern zu sperren – nicht Teil der Spec; in der Doku `settings` festgehalten. |
| Benutzer-API | Nur für die Sitzung der UI (neue Zugriffsregel `ApiAccess::SESSION`, Tokens → 403): `GET /api/users`, `PATCH/DELETE /api/users/{id}`, `POST /api/invitations`, `DELETE /api/invitations/{id}`; Controller in `routes/api.php`, nicht im OpenAPI-Dokument | Konten gehören nicht in die Agenten-API (Spec 6 nennt keine Benutzer-Ressource). |
| Einladung | Tabelle `user_invitations` (ULID, `email`, `role`, `invited_by_id`, `expires_at` = +7 Tage, `accepted_at`). Link = `url(URL::signedRoute('invitations.show', ['locale' => …, 'invitation' => id], absolute: false))` (ohne Ablauf in der Signatur, damit ein alter Link „abgelaufen“ zeigt statt 403), Route mit `signed:relative`, jederzeit neu kopierbar. Annehmen: Name + Passwort (min. 8, bestätigt) → Konto mit der Rolle, Einladung `accepted_at`, Anmeldung, Weiterleitung zur Übersicht. Neue Einladung an dieselbe Adresse ersetzt offene | Auftrag: kopierbarer Link mit signiertem Token, kein Mailversand. Relative Signatur wie `SignedDownloads` (hinter Proxys stabil). |
| Benutzer entfernen | Hart löschen samt Tokens und Sitzungen (`sessions.user_id`); `documents.created_by` wird per Fremdschlüssel `NULL` (InnoDB-Fremdschlüsselaktionen lösen keine Trigger aus – im Test mit abgeschlossenem Dokument geprüft). Kein Undo, Bestätigungsdialog | Spec 4 kennt kein Deaktivieren; Undo per Neueinladung wäre ein anderes Konto. |
| Leistungsart | Neues Enum `SupplyType` (`goods`/`services`), Spalte `customers.supply_type` (Standard `services`), nur bei `third_country` im Kundenformular sichtbar. `EffectiveTax`: Drittland + Dienstleistung → Kategorie `O` (0 %, Hinweis `legal.third_country_services`), Ware → `G`. EN 16931: bei `O` keine USt-IDs von Verkäufer und Käufer in der XML (BR-O-02), Verkäufer braucht dann `registration_id` (BR-CO-26), Befreiungsgrund `einvoice.exemption.o` | Entscheidung aus Phase 3 im Master-Plan. Abgeschlossene Dokumente bleiben über ihren Snapshot unverändert. |
| Prüfpunkte der Organisation | `org.*`-Issues im Editor verlinken auf `/{locale}/settings/organization?focus=<pfad>`; die Seite springt per `jumpTo()` (aus `editor/jump.ts`) zum Feld mit diesem `data-path` (`org.address`, `org.vat_id`, `org.registration_id`, `org.iban`, `org.<eigenes Feld>`) | Phase 6 zeigte nur Text („Einstellungen gibt es erst in Phase 7“). |
| PDF-Prüfung im Playwright-Test | `unpdf` (`extractText`) in `e2e/` liest den Text des Entwurfs-PDFs aus `GET /api/documents/{id}/pdf` | Erfolgskriterium „erscheint in Vorschau **und PDF**“; Text in PDFs ist komprimiert, ein `includes` auf die Bytes reicht nicht. |
| Phase-3-Deferred M6 | Doku `templates`, Abschnitt „Sandbox“: `file:`-URLs (z. B. `file:///tmp`) sind in Gotenberg erlaubt, aber durch die CSP jedes gerenderten Dokuments gesperrt; eigene Templates sollen nie `file:` verwenden | Auftrag. |

---

## Dateistruktur nach Phase 7

```
app/
├─ Actions/
│  ├─ DuplicateTemplate.php                 Kopie eines Templates (Teile, Manifest, Assets)
│  ├─ ReorderFieldDefinitions.php           Reihenfolge einer Ebene
│  ├─ StoreUpload.php, ReadUpload.php       Bilder für Bildfelder
│  ├─ UpdateOrganizationLogo.php, RemoveOrganizationLogo.php, ReadOrganizationLogo.php
│  ├─ PreviewDocumentNumber.php             Nummernvorschau für ungespeicherte Muster
│  ├─ RestoreTaxRate.php, RestoreUnit.php
│  ├─ ListUsers.php, InviteUser.php, RevokeInvitation.php, AcceptInvitation.php, ChangeUserRole.php, RemoveUser.php
│  └─ (geändert) SaveCustomer.php (supply_type)
├─ Domain/
│  ├─ Fields/ImagePath.php                  Muster "uploads/<ulid>.<ext>"
│  ├─ Fields/CustomValueValidator.php       Bildwerte nur als ImagePath
│  ├─ Tax/EffectiveTax.php, TaxContext.php, LegalNotes.php   Kategorie O
│  └─ Compliance/ComplianceChecker.php, PartyFacts.php       BR-O / BR-CO-26 bei O
├─ Enums/SupplyType.php, TaxCategory.php (+O)
├─ Exceptions/OwnerRequiredException.php (403), ActionNotAllowedException.php (+lastOwner, cannotRemoveSelf)
├─ Http/
│  ├─ Controllers/TemplateController.php, FieldController.php, SettingsController.php, InvitationController.php
│  ├─ Controllers/Api/UploadController.php, OrganizationLogoController.php, NumberPreviewController.php,
│  │  FieldOrderController.php, UsersController.php, InvitationsController.php
│  └─ Api/ApiMiddleware.php (+SESSION)
├─ Models/UserInvitation.php
├─ Rendering/AssetInliner.php (+upload), ContextBuilder.php (Bildfelder)
├─ Support/StoredImage.php, InvitationLinks.php, Owners.php, ApiAccess.php (+SESSION), SnapshotBuilder.php, DomainMapper.php, LegalNoteTexts.php
└─ EInvoice/CiiBuilder.php                  keine VA-Registrierungen bei Kategorie O
database/migrations/2026_10_12_100000_create_user_invitations_table.php
database/migrations/2026_10_12_100100_add_supply_type_to_customers.php
packages/paged-preview/src/lazy.ts (+ .test.ts), paged-preview.tsx (+lazy)
resources/
├─ css/templates.css                        Editor-Raster, CodeMirror-Theme
└─ js/
   ├─ api/templates.ts, settings.ts, users.ts, fields.ts (erweitert), keys.ts (+ test), types.ts
   ├─ lib/api.ts (+ apiUpload, + test), lib/use-in-view.ts
   ├─ components/code-editor.tsx, components/image-field-input.tsx, components/custom-field-input.tsx (Bild)
   ├─ layouts/nav.ts (+ test)
   ├─ templates/
   │  ├─ gallery-card.tsx, import-button.tsx, scenario.ts (+ test)
   │  ├─ diagnostics.ts (+ test), editor-state.ts (+ test), errors.ts (+ test)
   │  └─ editor/ template-editor.tsx, editor-header.tsx, code-pane.tsx, paper-form.tsx, field-sidebar.tsx,
   │             preview-pane.tsx, sample-picker.tsx, use-template-preview.ts, toolkit-slot.tsx
   ├─ fields/ expression.ts (+ test), field-form.ts (+ test), profile-requirements.ts, fields-list.tsx,
   │          field-drawer.tsx, built-in-fields.tsx
   ├─ settings/ sections.ts, save-bar.tsx, organization.tsx, document-types.tsx, taxes-units.tsx,
   │            tax-rate-drawer.tsx, unit-drawer.tsx, unit-codes.ts, text-blocks.tsx, users.tsx, invite-dialog.tsx
   ├─ editor/components/compliance-panel.tsx (org-Links)
   └─ pages/ templates/index.tsx, templates/show.tsx, fields/index.tsx, settings/show.tsx, invitation.tsx,
             customers/show.tsx (Leistungsart)
tests/Feature/Pages/SetupPagesTest.php, InvitationPageTest.php
tests/Feature/Actions/DuplicateTemplateTest.php, ReorderFieldDefinitionsTest.php, OrganizationLogoTest.php,
                     NumberPreviewTest.php, RestoreMasterDataTest.php, UserManagementTest.php, SupplyTypeTest.php
tests/Feature/Api/UploadApiTest.php, UsersApiTest.php, (geändert) RightsMatrixTest.php, OpenApiTest.php, TemplateApiTest.php
tests/Feature/Rendering/ImageFieldContextTest.php
tests/Unit/Domain/… (EffectiveTax, Compliance O, ImagePath)
e2e/tests/custom-field-flow.spec.ts, templates.spec.ts, settings.spec.ts, users.spec.ts, screenshots.spec.ts (+6 Seiten)
docs/{en,de}/custom-fields.md, settings.md (neu), templates.md, documents.md, e-invoice.md (ergänzt)
```

## Interfaces

### Neue/geänderte Endpunkte

| Methode | Pfad | Middleware | Action | Antwort |
|---|---|---|---|---|
| GET | `/api/templates` | `READ` | – | wie bisher + `document_types: DocumentType[]` je Eintrag |
| POST | `/api/templates/{id}/duplicate` | `WRITE` | `DuplicateTemplate` | 201 `TemplateResource` |
| POST | `/api/field-definitions/reorder` | `WRITE` | `ReorderFieldDefinitions` | 204 |
| POST | `/api/uploads` | `WRITE` | `StoreUpload` | 201 `{ path, mime, size }` |
| GET | `/api/uploads/{name}` | `READ` | `ReadUpload` | Bilddatei (inline, CSP-Sandbox) |
| GET | `/api/organization/logo` | `READ` | `ReadOrganizationLogo` | Bilddatei oder 404 |
| POST | `/api/organization/logo` | `WRITE` | `UpdateOrganizationLogo` | 200 `{ has_logo: true, updated_at }` |
| DELETE | `/api/organization/logo` | `WRITE` | `RemoveOrganizationLogo` | 204 |
| GET | `/api/document-types/{type}/number-preview` | `READ` | `PreviewDocumentNumber` | `{ number: string\|null, valid: bool, message: string\|null }` |
| POST | `/api/tax-rates/{id}/restore` | `WRITE` | `RestoreTaxRate` | 200 `TaxRateResource` |
| POST | `/api/units/{id}/restore` | `WRITE` | `RestoreUnit` | 200 `UnitResource` |
| GET | `/api/users` | `SESSION` | `ListUsers` | `{ users: UserRow[], invitations: InvitationRow[] }` |
| PATCH | `/api/users/{id}` | `SESSION` | `ChangeUserRole` | `UserRow` |
| DELETE | `/api/users/{id}` | `SESSION` | `RemoveUser` | 204 |
| POST | `/api/invitations` | `SESSION` | `InviteUser` | 201 `InvitationRow` |
| DELETE | `/api/invitations/{id}` | `SESSION` | `RevokeInvitation` | 204 |
| GET | `/{locale}/invitations/{invitation}` | `guest`, `signed:relative` | – (Model-Lookup, `InvitationLinks::state`) | Inertia `invitation` |
| POST | `/{locale}/invitations/{invitation}` | `guest`, `signed:relative`, `throttle:10,1` | `AcceptInvitation` | Redirect `home` (angemeldet) |
| GET | `/{locale}/templates`, `/templates/{id}`, `/fields`, `/settings`, `/settings/{section}` | `auth` | – | Inertia-Seiten |

`UserRow = { id, name, email, role: 'owner'|'member', is_self: bool }`, `InvitationRow = { id, email, role, expires_at, link: string|null }` (`link` nur für Owner).
`Customer` (`/api/customers…`) bekommt `supply_type: 'goods'|'services'` (lesen und schreiben).

### Actions (PHP-Signaturen)

```php
DuplicateTemplate::handle(Actor $actor, Template $template): Template
ReorderFieldDefinitions::handle(Actor $actor, array $input): void                  // {scope, ids: list<string>}
StoreUpload::handle(Actor $actor, UploadedFile $file): array                        // {path, mime, size}
ReadUpload::handle(Actor $actor, string $name): ?DownloadFile
UpdateOrganizationLogo::handle(Actor $actor, UploadedFile $file): Organization
RemoveOrganizationLogo::handle(Actor $actor): Organization
ReadOrganizationLogo::handle(Actor $actor): ?DownloadFile
PreviewDocumentNumber::handle(Actor $actor, DocumentType $type, array $input): array // {number, valid, message}
RestoreTaxRate::handle(Actor $actor, TaxRate $rate): TaxRate
RestoreUnit::handle(Actor $actor, Unit $unit): Unit
ListUsers::handle(Actor $actor, string $locale): array                              // {users, invitations}
InviteUser::handle(Actor $actor, array $input): UserInvitation                      // {email, role}
RevokeInvitation::handle(Actor $actor, UserInvitation $invitation): void
AcceptInvitation::handle(Actor $actor, UserInvitation $invitation, array $input): User // {name, password, password_confirmation}
ChangeUserRole::handle(Actor $actor, User $user, array $input): User               // {role}
RemoveUser::handle(Actor $actor, User $user): void
```

Support: `StoredImage::problem(string $extension, string $contents): ?string` (übersetzte Meldung oder `null`), `StoredImage::EXTENSIONS`, `StoredImage::MAX_BYTES` (1 MB), `StoredImage::headers(): array` (CSP-Sandbox, `nosniff`); `InvitationLinks::for(UserInvitation $invitation, string $locale): string`; `Owners::assertOwner(Actor $actor): User` (wirft `OwnerRequiredException`), `Owners::isOwner(Actor $actor): bool`; `UserRows::user()`/`UserRows::invitation()`; `AssetInliner::upload(?string $path): string`; `ImagePath::PATTERN`, `ImagePath::isValid(string $value): bool`.

### Frontend (TypeScript)

```ts
// lib/api.ts
export async function apiUpload<T>(path: string, form: FormData, options?: { signal?: AbortSignal }): Promise<T>;

// lib/use-in-view.ts
export function useInView<T extends Element>(rootMargin?: string): [ref: (node: T | null) => void, inView: boolean];

// api/templates.ts
export type TemplateSummary = { id: string; name: string; slug: string; version: string; author: string; license: string; description: string | null; built_in: boolean; document_types: DocumentType[]; updated_at: string | null };
export type TemplateManifest = { name: string; version: string; author?: string; license?: string; description?: string; documentTypes?: DocumentType[]; expectedFields?: { scope: FieldScope; key: string; type: FieldType; fallback?: unknown }[]; paper?: Paper; translations?: Record<string, Record<string, string>> };
export type TemplateDetail = TemplateSummary & { manifest: TemplateManifest; header: string; body: string; footer: string; css: string; assets: { path: string; mime: string; size: number }[] };
export type TemplateFiles = Pick<TemplateDetail, 'header' | 'body' | 'footer' | 'css' | 'manifest'>;
export type RenderSources = { scenarios: { key: string; document_type: DocumentType }[]; documents: { id: string; type: DocumentType; status: DocumentStatus; number: string | null; date: string; customer_name: string | null; locale: string }[] };
export type RenderSchema = { levels: Record<FieldScope, { context: string; core: string[]; custom: { key: string; label: string; type: FieldType; required: boolean; options: string[]; doc_types: DocumentType[] }[] }> };
export function useTemplates(): SWRResponse<TemplateSummary[]>;
export function useTemplate(id: string): SWRResponse<TemplateDetail>;
export function useRenderSources(): SWRResponse<RenderSources>;
export function useRenderSchema(): SWRResponse<RenderSchema>;
export function importTemplate(file: File): Promise<TemplateDetail>;
export function duplicateTemplate(id: string): Promise<TemplateDetail>;
export function deleteTemplate(id: string): Promise<void>;
export function saveTemplateFiles(id: string, files: TemplateFiles): Promise<TemplateDetail>;
export function packageUrl(id: string): string;
export type TemplateRenderRequest = { template_id: string; template?: Partial<TemplateFiles>; scenario?: string; document_id?: string };
export function renderTemplate(body: TemplateRenderRequest, signal?: AbortSignal): Promise<RenderResponse>;
```

**Template-Editor ↔ Phase 9 (verbindlich):** `resources/js/templates/editor/toolkit-slot.tsx`

```tsx
export type ToolkitSlotProps = {
    templateId: string;
    builtIn: boolean;
    /** Unsaved changes in the editor: the toolkit should start from the saved state. */
    dirty: boolean;
    /** Saves the editor (PUT /api/templates/{id}/files); false when invalid or failed. */
    save(): Promise<boolean>;
};
export function ToolkitSlot(props: ToolkitSlotProps): ReactNode;
```

Phase 7 liefert `ToolkitSlot` als `return null`. Der Editor-Kopf (`editor-header.tsx`) rendert `<ToolkitSlot …/>` immer zwischen „Exportieren“ und „Speichern“ bzw. „Duplizieren“; Phase 9 ersetzt nur den Körper dieser Datei (Knopf „Toolkit herunterladen“ + Dialog, der `POST /{locale}/templates/{id}/toolkit` aufruft) und fügt die Übersetzungen hinzu, ohne andere Editor-Dateien zu ändern. Mitgelieferte Templates bekommen `builtIn: true` (Phase 9 zeigt dann „erst duplizieren“).

**`packages/paged-preview`:** `PagedPreviewProps` bekommt `lazy?: boolean` (Standard `false`). Die exportierte Liste (`index.ts`) bleibt gleich; `lazy.ts` ist intern.

---

## Task 1: Navigation, Routen und Seitengerüste

**Files:**
- Modify: `routes/web.php`
- Create: `app/Http/Controllers/TemplateController.php`, `app/Http/Controllers/FieldController.php`, `app/Http/Controllers/SettingsController.php`
- Create: `resources/js/pages/templates/index.tsx`, `resources/js/pages/templates/show.tsx`, `resources/js/pages/fields/index.tsx`, `resources/js/pages/settings/show.tsx`
- Create: `resources/js/settings/sections.ts`
- Modify: `resources/js/layouts/nav.ts`, `resources/js/layouts/nav.test.ts`, `resources/js/types.ts`
- Modify: `lang/en.json`, `lang/de.json`
- Test: `tests/Feature/Pages/SetupPagesTest.php`

**Interfaces:**
- Consumes: `appLayout` (`resources/js/layouts/app-shell.tsx`), `Page`, `PageHeader`, `Skeleton` (`@/components/ui`), `App\Enums\FieldScope`, `App\Enums\UserRole`.
- Produces: Inertia-Seiten `templates/index` (keine Props), `templates/show` (`template_id: string`), `fields/index` (`scope: FieldScope`), `settings/show` (`section: SettingsSection`, `can_manage_users: boolean`); `SETTINGS_SECTIONS` / `type SettingsSection = 'organization' | 'document-types' | 'taxes-units' | 'text-blocks' | 'users'` in `resources/js/settings/sections.ts`; PHP `SettingsController::SECTIONS`. Routennamen `templates.index`, `templates.show`, `fields.index`, `settings.index`, `settings.show`.

- [ ] **Step 1: Failing Pest-Test schreiben**

`tests/Feature/Pages/SetupPagesTest.php`:

```php
<?php

use App\Models\Template;
use App\Models\User;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

it('renders the template gallery and the editor of an existing template only', function () {
    $template = Template::query()->where('slug', 'klar')->sole();
    $this->actingAs(User::factory()->create());

    $this->get('/en/templates')->assertOk()->assertInertia(fn (Assert $page) => $page->component('templates/index'));
    $this->get("/de/templates/{$template->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('templates/show')->where('template_id', $template->id));
    $this->get('/en/templates/'.strtolower((string) Str::ulid()))->assertNotFound();
});

it('opens the custom fields on the requested level, documents by default', function (string $query, string $scope) {
    $this->actingAs(User::factory()->create())->get("/en/fields{$query}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('fields/index')->where('scope', $scope));
})->with([
    'default' => ['', 'document'],
    'org' => ['?scope=org', 'org'],
    'position' => ['?scope=position', 'position'],
    'unknown level' => ['?scope=invoice', 'document'],
    'array' => ['?scope[]=org', 'document'],
]);

it('sends /settings to the organization and renders every section', function () {
    $this->actingAs(User::factory()->owner()->create());

    $this->get('/de/settings')->assertRedirect('/de/settings/organization');
    foreach (['organization', 'document-types', 'taxes-units', 'text-blocks', 'users'] as $section) {
        $this->get("/en/settings/{$section}")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('settings/show')->where('section', $section)->where('can_manage_users', true));
    }
    $this->get('/en/settings/api')->assertNotFound();
});

it('tells the page whether the user may manage users', function () {
    $this->actingAs(User::factory()->create())->get('/en/settings/users')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('can_manage_users', false));
});

it('sends guests to the login', function (string $url) {
    $this->get($url)->assertRedirect('/en/login');
})->with(['/en/templates', '/en/fields', '/en/settings/organization']);
```

- [ ] **Step 2: Test laufen lassen**

Run: `ddev artisan test --filter=SetupPagesTest`
Expected: FAIL (404 für `/en/templates`, Klassen fehlen).

- [ ] **Step 3: Controller anlegen**

`app/Http/Controllers/TemplateController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Models\Template;
use Inertia\Inertia;
use Inertia\Response;

/** Template gallery and editor; the templates come from GET /api/templates (SWR). */
class TemplateController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('templates/index');
    }

    /** 404 for unknown templates; the sources come from GET /api/templates/{id}. */
    public function show(string $id): Response
    {
        return Inertia::render('templates/show', ['template_id' => Template::query()->findOrFail($id)->id]);
    }
}
```

`app/Http/Controllers/FieldController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Enums\FieldScope;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Custom fields of all levels; ?scope= picks the tab (anything unknown → document). */
class FieldController extends Controller
{
    public function index(Request $request): Response
    {
        $scope = $request->query('scope');
        $scope = is_string($scope) ? FieldScope::tryFrom($scope) : null;

        return Inertia::render('fields/index', ['scope' => ($scope ?? FieldScope::Document)->value]);
    }
}
```

`app/Http/Controllers/SettingsController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Settings: one page, the section comes from the URL; the data from /api (SWR). */
class SettingsController extends Controller
{
    /** @var list<string> */
    public const SECTIONS = ['organization', 'document-types', 'taxes-units', 'text-blocks', 'users'];

    public function index(): RedirectResponse
    {
        return redirect()->route('settings.show', ['section' => 'organization']);
    }

    public function show(Request $request, string $section): Response
    {
        $user = $request->user();

        return Inertia::render('settings/show', [
            'section' => $section,
            'can_manage_users' => $user instanceof User && $user->role === UserRole::Owner,
        ]);
    }
}
```

- [ ] **Step 4: Routen ergänzen**

In `routes/web.php` die `use`-Zeilen um `FieldController`, `SettingsController`, `TemplateController` ergänzen und in der `auth`-Gruppe nach den Kunden-Routen einfügen:

```php
        Route::get('/templates', [TemplateController::class, 'index'])->name('templates.index');
        Route::get('/templates/{id}', [TemplateController::class, 'show'])->whereUlid('id')->name('templates.show');
        Route::get('/fields', [FieldController::class, 'index'])->name('fields.index');
        Route::get('/settings', [SettingsController::class, 'index'])->name('settings.index');
        Route::get('/settings/{section}', [SettingsController::class, 'show'])
            ->whereIn('section', SettingsController::SECTIONS)
            ->name('settings.show');
```

- [ ] **Step 5: Navigation und Test anpassen (TDD für `nav.ts`)**

`resources/js/layouts/nav.test.ts` – den zweiten Test ersetzen:

```ts
    it('lists the main pages and the setup group', () => {
        expect(navItems().map((item) => item.href)).toEqual(['/en', '/en/documents', '/en/customers', '/en/templates']);
        expect(setupItems().map((item) => item.href)).toEqual(['/en/fields', '/en/settings']);
    });

    it('keeps settings active on every section', () => {
        const [, settings] = setupItems();

        expect(isActive('/en/settings/taxes-units', settings)).toBe(true);
        expect(isActive('/en/settings', settings)).toBe(true);
    });
```

(Import oben: `import { isActive, navItems, setupItems } from './nav';`)

Run: `ddev exec pnpm test -- resources/js/layouts/nav.test.ts`
Expected: FAIL (`/en/templates` fehlt, `setupItems()` leer).

`resources/js/layouts/nav.ts` vollständig:

```ts
import { FileText, LayoutGrid, ListPlus, Settings, SquareCode, Users, type LucideIcon } from 'lucide-react';
import { path, t } from '@/lib/i18n';

export type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };

/** Main navigation. */
export function navItems(): NavItem[] {
    return [
        { href: path(''), label: t('nav.overview'), icon: LayoutGrid, exact: true },
        { href: path('/documents'), label: t('nav.documents'), icon: FileText },
        { href: path('/customers'), label: t('nav.customers'), icon: Users },
        { href: path('/templates'), label: t('nav.templates'), icon: SquareCode },
    ];
}

/** Group "Set up": custom fields and settings. */
export function setupItems(): NavItem[] {
    return [
        { href: path('/fields'), label: t('nav.fields'), icon: ListPlus },
        { href: path('/settings'), label: t('nav.settings'), icon: Settings },
    ];
}

/** `url` is Inertia's page URL (path + query). */
export function isActive(url: string, item: NavItem): boolean {
    const pathname = url.split(/[?#]/)[0];
    return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}
```

Der Test ruft `path()` ohne geladene Übersetzungen; `path('')` liefert `/en` (Standard aus `lib/i18n.ts`) – wie im bestehenden Test.

- [ ] **Step 6: Abschnitte und Seitengerüste anlegen**

`resources/js/settings/sections.ts`:

```ts
import { Building2, FileStack, Percent, TextQuote, UsersRound, type LucideIcon } from 'lucide-react';

/** Same list as App\Http\Controllers\SettingsController::SECTIONS. */
export const SETTINGS_SECTIONS = ['organization', 'document-types', 'taxes-units', 'text-blocks', 'users'] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export const SECTION_ICONS: Record<SettingsSection, LucideIcon> = {
    organization: Building2,
    'document-types': FileStack,
    'taxes-units': Percent,
    'text-blocks': TextQuote,
    users: UsersRound,
};

/** Translation key of a section title: settings.section.organization, settings.section.document_types, … */
export const sectionKey = (section: SettingsSection): string => `settings.section.${section.replace('-', '_')}`;
```

`resources/js/pages/settings/show.tsx` (Bereiche füllen Task 9–13; bis dahin zeigt ein Bereich ein Skelett):

```tsx
import { Head, Link } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { Page, PageHeader, Skeleton, cx } from '@/components/ui';
import { appLayout } from '@/layouts/app-shell';
import { path, t } from '@/lib/i18n';
import { SECTION_ICONS, SETTINGS_SECTIONS, sectionKey, type SettingsSection } from '@/settings/sections';

type Props = { section: SettingsSection; can_manage_users: boolean };

const LINK =
    'flex h-10 items-center gap-3 rounded-full px-3 font-strong whitespace-nowrap text-muted no-underline transition-colors hover:bg-surface-2 hover:text-ink [&_svg]:size-[1.05rem] [&_svg]:shrink-0 md:max-lg:h-9 md:max-lg:text-sm';
const ACTIVE = 'flex h-10 items-center gap-3 rounded-full bg-ink px-3 font-strong whitespace-nowrap text-bg no-underline [&_svg]:size-[1.05rem] [&_svg]:shrink-0';

/** Settings (/{locale}/settings/{section}): section navigation left (top below 900 px), the section right. */
export default function SettingsPage({ section, can_manage_users: canManageUsers }: Props) {
    return (
        <Page>
            <Head title={`${t(sectionKey(section))} · ${t('nav.settings')}`} />
            <PageHeader title={t('nav.settings')} description={t('settings.description')} />
            <div className="grid items-start gap-5 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-8">
                <nav aria-label={t('settings.nav_label')} className="flex gap-1 overflow-x-auto pb-0.5 md:sticky md:top-6 md:grid md:gap-0.5 md:overflow-visible">
                    {SETTINGS_SECTIONS.map((item) => {
                        const Icon = SECTION_ICONS[item];
                        return (
                            <Link key={item} href={path(`/settings/${item}`)} aria-current={item === section ? 'page' : undefined} className={item === section ? ACTIVE : LINK}>
                                <Icon aria-hidden />
                                <span>{t(sectionKey(item))}</span>
                            </Link>
                        );
                    })}
                </nav>
                <div className={cx('grid min-w-0 gap-6')}>{renderSection(section, canManageUsers)}</div>
            </div>
        </Page>
    );
}

/** Tasks 9–13 replace the cases one by one. */
function renderSection(section: SettingsSection, canManageUsers: boolean): ReactNode {
    void canManageUsers;
    switch (section) {
        default:
            return <Skeleton h={320} r={18} />;
    }
}

SettingsPage.layout = appLayout;
```

`resources/js/pages/templates/index.tsx` (Task 3 ersetzt die Datei vollständig):

```tsx
import { Head } from '@inertiajs/react';
import { Page, PageHeader, Skeleton } from '@/components/ui';
import { appLayout } from '@/layouts/app-shell';
import { t } from '@/lib/i18n';

export default function Templates() {
    return (
        <Page>
            <Head title={t('nav.templates')} />
            <PageHeader title={t('nav.templates')} description={t('templates.description')} />
            <Skeleton h={240} r={18} />
        </Page>
    );
}

Templates.layout = appLayout;
```

`resources/js/pages/templates/show.tsx` (Task 5 ersetzt die Datei vollständig):

```tsx
import { Head } from '@inertiajs/react';
import { Page, Skeleton } from '@/components/ui';
import { appLayout } from '@/layouts/app-shell';
import { t } from '@/lib/i18n';

export default function TemplatePage({ template_id: id }: { template_id: string }) {
    return (
        <Page>
            <Head title={t('nav.templates')} />
            <Skeleton h={480} r={18} className={id ? undefined : 'hidden'} />
        </Page>
    );
}

TemplatePage.layout = appLayout;
```

`resources/js/pages/fields/index.tsx` (Task 8 ersetzt die Datei vollständig):

```tsx
import { Head } from '@inertiajs/react';
import type { FieldScope } from '@/api/types';
import { Page, PageHeader, Skeleton } from '@/components/ui';
import { appLayout } from '@/layouts/app-shell';
import { t } from '@/lib/i18n';

export default function Fields({ scope }: { scope: FieldScope }) {
    return (
        <Page>
            <Head title={t('nav.fields')} />
            <PageHeader title={t('nav.fields')} description={t('fields.description')} />
            <Skeleton h={240} r={18} className={scope ? undefined : 'hidden'} />
        </Page>
    );
}

Fields.layout = appLayout;
```

- [ ] **Step 7: Übersetzungen**

`lang/en.json` (alphabetisch einsortieren):

```json
"fields.description": "All additional fields in one place. What you add here appears in the forms and is available in every template.",
"nav.fields": "Custom fields",
"nav.settings": "Settings",
"nav.templates": "Templates",
"settings.description": "Your company, the document types and the master data for taxes, units and texts.",
"settings.nav_label": "Settings sections",
"settings.section.document_types": "Document types",
"settings.section.organization": "Organization",
"settings.section.taxes_units": "Taxes & units",
"settings.section.text_blocks": "Text blocks",
"settings.section.users": "Users",
"templates.description": "Templates define how your documents look as PDF. They consist of HTML, CSS and Liquid and can be shared as ZIP."
```

`lang/de.json`:

```json
"fields.description": "Alle zusätzlichen Felder an einem Ort. Was du hier anlegst, erscheint in den Formularen und steht in jedem Template bereit.",
"nav.fields": "Eigene Felder",
"nav.settings": "Einstellungen",
"nav.templates": "Templates",
"settings.description": "Deine Firma, die Dokumenttypen und die Stammdaten für Steuern, Einheiten und Texte.",
"settings.nav_label": "Bereiche der Einstellungen",
"settings.section.document_types": "Dokumenttypen",
"settings.section.organization": "Organisation",
"settings.section.taxes_units": "Steuern & Einheiten",
"settings.section.text_blocks": "Textbausteine",
"settings.section.users": "Benutzer",
"templates.description": "Templates legen fest, wie deine Dokumente als PDF aussehen. Sie bestehen aus HTML, CSS und Liquid und lassen sich als ZIP weitergeben."
```

`sectionKey()` erzeugt die Schlüssel dynamisch – `TranslationsTest` prüft sie nicht, sie stehen deshalb ausdrücklich oben.

- [ ] **Step 8: Tests laufen lassen**

Run: `ddev artisan test --filter=SetupPagesTest && ddev exec pnpm test && ddev exec pnpm typecheck && ddev artisan test --filter=TranslationsTest`
Expected: PASS (SetupPagesTest 12 Fälle; Vitest inkl. `nav.test.ts`).

Der Redirect-Test deckt ab, dass `/en/settings` dank `URL::defaults` (SetLocale) ohne Locale-Parameter umleitet. `e2e/tests/shell.spec.ts` zählt keine Navigationspunkte (nur Fokus im mobilen Menü) und bleibt unverändert.

- [ ] **Step 9: Commit**

```bash
ddev exec vendor/bin/pint && ddev exec vendor/bin/phpstan analyse --memory-limit=1G
git add routes/web.php app/Http/Controllers resources/js lang tests/Feature/Pages/SetupPagesTest.php
git commit -m "feat: navigation and pages for templates, custom fields and settings" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 2: `paged-preview` füllt Seiten erst, wenn sie sichtbar werden

**Files:**
- Create: `packages/paged-preview/src/lazy.ts`, `packages/paged-preview/src/lazy.test.ts`
- Modify: `packages/paged-preview/src/paged-preview.tsx`, `packages/paged-preview/src/paged-preview.test.tsx`, `packages/paged-preview/src/paged-preview.css`
- Create: `resources/js/lib/use-in-view.ts`

**Interfaces:**
- Consumes: bestehendes `PagedPreview`.
- Produces: Prop `lazy?: boolean`; intern `isPageFilled(index: number, filled: ReadonlySet<number>, lazy: boolean): boolean` und `observePages(elements: Element[], onVisible: (index: number) => void, rootMargin?: string): () => void`; in der App `useInView<T extends Element>(rootMargin = '200px'): [(node: T | null) => void, boolean]` (Task 3 nutzt es für Karten).

- [ ] **Step 1: Failing Tests schreiben**

`packages/paged-preview/src/lazy.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isPageFilled, observePages } from './lazy';

describe('isPageFilled', () => {
    it('fills every page when not lazy', () => {
        expect(isPageFilled(5, new Set(), false)).toBe(true);
    });

    it('fills the first page at once and others once seen', () => {
        expect(isPageFilled(0, new Set(), true)).toBe(true);
        expect(isPageFilled(1, new Set(), true)).toBe(false);
        expect(isPageFilled(1, new Set([1]), true)).toBe(true);
    });
});

describe('observePages', () => {
    it('reports every page as visible without IntersectionObserver (server rendering, old browsers)', () => {
        const seen: number[] = [];
        const stop = observePages([{} as Element, {} as Element], (index) => seen.push(index));

        expect(seen).toEqual([0, 1]);
        stop();
    });

    it('reports a page when it intersects and stops watching it', () => {
        const unobserved: Element[] = [];
        let callback: IntersectionObserverCallback = () => undefined;
        class FakeObserver {
            constructor(cb: IntersectionObserverCallback) {
                callback = cb;
            }
            observe() {}
            unobserve(element: Element) {
                unobserved.push(element);
            }
            disconnect() {}
        }
        const original = globalThis.IntersectionObserver;
        globalThis.IntersectionObserver = FakeObserver as unknown as typeof IntersectionObserver;
        const first = { dataset: { page: '1' } } as unknown as Element;
        const second = { dataset: { page: '2' } } as unknown as Element;
        const seen: number[] = [];

        const stop = observePages([first, second], (index) => seen.push(index));
        callback(
            [
                { target: second, isIntersecting: true },
                { target: first, isIntersecting: false },
            ] as unknown as IntersectionObserverEntry[],
            {} as IntersectionObserver,
        );

        expect(seen).toEqual([1]);
        expect(unobserved).toEqual([second]);
        stop();
        globalThis.IntersectionObserver = original;
    });
});
```

In `packages/paged-preview/src/paged-preview.test.tsx` ergänzen:

```tsx
    it('fills the first page right away when lazy', () => {
        const html = renderToStaticMarkup(<PagedPreview parts={parts} paper={paper} lazy />);

        expect(html.match(/<iframe/g)).toHaveLength(4);
        expect(html).not.toContain('pp-page--pending');
    });
```

- [ ] **Step 2: Tests laufen lassen**

Run: `ddev exec 'pnpm --filter "./packages/*" test'`
Expected: FAIL („Cannot find module './lazy'“).

- [ ] **Step 3: `lazy.ts` implementieren**

```ts
/** Page 1 always, every other page once it was seen (lazy) – or all pages (not lazy). */
export function isPageFilled(index: number, filled: ReadonlySet<number>, lazy: boolean): boolean {
    return !lazy || index === 0 || filled.has(index);
}

/**
 * Calls onVisible(index) once per page element (data-page = index + 1) when it comes near the viewport. The
 * viewport check includes clipping by scrolling ancestors (preview panes), see the IntersectionObserver spec.
 * Without IntersectionObserver every page counts as visible.
 */
export function observePages(elements: Element[], onVisible: (index: number) => void, rootMargin = '300px'): () => void {
    if (typeof IntersectionObserver === 'undefined') {
        elements.forEach((_, index) => onVisible(index));
        return () => undefined;
    }
    const observer = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                const page = Number((entry.target as HTMLElement).dataset.page);
                if (Number.isFinite(page)) onVisible(page - 1);
                observer.unobserve(entry.target);
            }
        },
        { rootMargin },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
}
```

- [ ] **Step 4: `PagedPreview` um `lazy` erweitern**

In `packages/paged-preview/src/paged-preview.tsx`:

1. Import ergänzen: `import { isPageFilled, observePages } from './lazy';`
2. `PagedPreviewProps` um `lazy?: boolean;` erweitern (mit Kommentar `/** Fill pages after the first only when they come into view (long documents, galleries). */`), Destrukturierung um `lazy = false`.
3. Den Sicherheitskommentar oben ersetzen durch:

```ts
/*
 * Security: every frame is sandbox="allow-same-origin" WITHOUT allow-scripts. Same origin is needed to measure the body
 * and fill in page numbers from outside; without script rights nothing in the rendered markup can run. Never add
 * allow-scripts here – together with allow-same-origin a frame could lift its own sandbox.
 * Cost: n pages make 3n+1 frames, all reloaded on every render answer. With `lazy`, pages after the first get their
 * frames only once they come into view (and keep them).
 */
```

4. Nach den bestehenden States:

```tsx
    const stack = useRef<HTMLDivElement>(null);
    const [filled, setFilled] = useState<ReadonlySet<number>>(() => new Set());
```

5. Nach `const pages = …` einen Effekt ergänzen, der die noch leeren Seiten beobachtet:

```tsx
    const pending = lazy ? pages.map((_, i) => i).filter((i) => !isPageFilled(i, filled, true)) : [];
    const pendingKey = pending.join(',');
    useEffect(() => {
        if (!lazy || pendingKey === '' || !stack.current) return;
        const elements = pendingKey.split(',').map((i) => stack.current?.querySelector(`[data-page="${Number(i) + 1}"]`)).filter((e): e is Element => !!e);
        return observePages(elements, (index) => setFilled((current) => (current.has(index) ? current : new Set([...current, index]))));
    }, [lazy, pendingKey]);
```

6. Am `pp-stack`-Div `ref={stack}` setzen. In der Seitenschleife die drei Frames nur rendern, wenn die Seite gefüllt ist:

```tsx
                {pages.map((start, i) => {
                    const end = layout.breaks[i + 1] ?? layout.total;
                    const fill = isPageFilled(i, filled, lazy);
                    return (
                        <div key={i} data-page={i + 1} className={cx('pp-page', !fill && 'pp-page--pending')} style={{ top: i * (g.height + PAGE_GAP), width: g.width, height: g.height }}>
                            {fill && (
                                <>
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
                                </>
                            )}
                            {shown.map((z) => (
                                <div key={z.zone} className={cx('pp-guide', highlight === z.zone && 'pp-guide--on')} style={{ top: z.y, left: z.x, width: z.w, height: z.h }} />
                            ))}
                        </div>
                    );
                })}
```

7. `packages/paged-preview/src/paged-preview.css` ergänzen:

```css
/* page whose frames are not loaded yet (lazy): a calm sheet instead of an empty hole */
.pp-page--pending {
    background: repeating-linear-gradient(180deg, transparent 0 40px, var(--pp-pending, rgba(127, 127, 127, 0.06)) 40px 52px);
}
```

- [ ] **Step 5: `useInView` für die App**

`resources/js/lib/use-in-view.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';

/**
 * true once the element came near the viewport (and stays true): galleries render their previews only then.
 * Without IntersectionObserver the element counts as visible.
 */
export function useInView<T extends Element>(rootMargin = '200px'): [(node: T | null) => void, boolean] {
    const [node, setNode] = useState<T | null>(null);
    const [inView, setInView] = useState(false);

    useEffect(() => {
        if (!node || inView) return;
        if (typeof IntersectionObserver === 'undefined') {
            setInView(true);
            return;
        }
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    setInView(true);
                    observer.disconnect();
                }
            },
            { rootMargin },
        );
        observer.observe(node);
        return () => observer.disconnect();
    }, [node, inView, rootMargin]);

    return [useCallback((element: T | null) => setNode(element), []), inView];
}
```

- [ ] **Step 6: Tests laufen lassen**

Run: `ddev exec 'pnpm --filter "./packages/*" test' && ddev exec 'pnpm --filter "./packages/*" typecheck' && ddev exec pnpm typecheck`
Expected: PASS (der bestehende Export-Test bleibt grün, weil `index.ts` unverändert ist).

- [ ] **Step 7: Commit**

```bash
git add packages/paged-preview resources/js/lib/use-in-view.ts
git commit -m "feat(paged-preview): fill pages lazily when they come into view" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 3: Templates duplizieren, Liste mit Dokumenttypen, Galerie mit Import und Löschen

**Files:**
- Create: `app/Actions/DuplicateTemplate.php`
- Modify: `app/Actions/ImportTemplatePackage.php` (`freeSlug` öffentlich), `app/ApiResource/TemplateResource.php`, `app/State/Processor/TemplateProcessor.php`
- Modify: `resources/js/lib/api.ts`, `resources/js/lib/api.test.ts`, `resources/js/api/keys.ts`, `resources/js/api/keys.test.ts`
- Create: `resources/js/api/templates.ts`, `resources/js/api/settings.ts`
- Create: `resources/js/templates/scenario.ts`, `resources/js/templates/scenario.test.ts`, `resources/js/templates/gallery-card.tsx`, `resources/js/templates/import-button.tsx`
- Modify: `resources/js/pages/templates/index.tsx` (vollständig ersetzen)
- Modify: `lang/en.json`, `lang/de.json`
- Test: `tests/Feature/Actions/DuplicateTemplateTest.php`, `tests/Feature/Api/TemplateApiTest.php`, `tests/Feature/Api/RightsMatrixTest.php`, `tests/Feature/Api/OpenApiTest.php`

**Interfaces:**
- Consumes: `ImportTemplatePackage`, `TemplatePackage::mimeOf`, `useInView` (Task 2), `PagedPreview` mit `lazy`.
- Produces: `DuplicateTemplate::handle(Actor, Template): Template`; `ImportTemplatePackage::freeSlug(string $base): string` (public static); `TemplateResource::$document_types`; Operation `template_duplicate`; `apiUpload()`; `api/templates.ts` (siehe Interfaces oben); `api/settings.ts` mit `type DocumentTypeSetting` und `useDocumentTypes()`; `previewScenario(types: DocumentType[]): 'short_invoice' | 'offer_with_options'`.

- [ ] **Step 1: Failing Pest-Tests schreiben**

`tests/Feature/Actions/DuplicateTemplateTest.php`:

```php
<?php

use App\Actions\DuplicateTemplate;
use App\Actions\UpdateTemplateFiles;
use App\Models\Template;
use Illuminate\Support\Facades\Storage;

it('copies a built-in template into an editable one with a free slug', function () {
    $klar = Template::query()->where('slug', 'klar')->sole();

    $first = app(DuplicateTemplate::class)->handle(systemActor(), $klar);
    $second = app(DuplicateTemplate::class)->handle(systemActor(), $klar);

    expect($first->id)->not->toBe($klar->id)
        ->and($first->built_in)->toBeFalse()
        ->and($first->name)->toBe('Klar (copy)')
        ->and($first->manifest['name'])->toBe('Klar (copy)')
        ->and($first->manifest['paper'])->toBe($klar->manifest['paper'])
        ->and($first->body)->toBe($klar->body)
        ->and($first->css)->toBe($klar->css)
        ->and($first->slug)->toBe('klar-copy')
        ->and($second->slug)->toBe('klar-copy-2');
});

it('copies the assets into the folder of the copy', function () {
    $template = Template::factory()->create(['name' => 'Fjord', 'slug' => 'fjord']);
    $svg = '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"></svg>';
    app(UpdateTemplateFiles::class)->handle(systemActor(), $template, ['assets' => ['assets/logo.svg' => base64_encode($svg)]]);

    $copy = app(DuplicateTemplate::class)->handle(systemActor(), $template->fresh());
    $asset = $copy->assets()->sole();

    expect($asset->path)->toBe('assets/logo.svg')
        ->and($asset->storage_path)->toStartWith("templates/{$copy->id}/")
        ->and(Storage::disk('local')->get($asset->storage_path))->toBe($svg);

    Storage::disk('local')->deleteDirectory("templates/{$template->id}");
    expect(Storage::disk('local')->get($asset->storage_path))->toBe($svg);
});

it('names the copy in the language of the request and keeps the manifest limit of 100 characters', function () {
    app()->setLocale('de');
    $template = Template::factory()->create(['name' => str_repeat('N', 100), 'manifest' => ['name' => str_repeat('N', 100), 'version' => '1.0.0']]);

    $copy = app(DuplicateTemplate::class)->handle(systemActor(), $template);

    expect(mb_strlen($copy->name))->toBe(100)
        ->and($copy->manifest['name'])->toBe($copy->name);
    expect(app(DuplicateTemplate::class)->handle(systemActor(), Template::query()->where('slug', 'kante')->sole())->name)->toBe('Kante (Kopie)');
});
```

In `tests/Feature/Api/TemplateApiTest.php` ergänzen:

```php
it('lists the document types of every template', function () {
    $list = collect($this->getJson('/api/templates')->assertOk()->json())->keyBy('slug');

    expect($list['klar']['document_types'])->toBe(['offer', 'confirmation', 'invoice', 'cancellation']);
});

it('duplicates a template over the API in the language of the request', function () {
    $klar = Template::query()->where('slug', 'klar')->sole();

    $this->postJson("/api/templates/{$klar->id}/duplicate", [], ['Accept-Language' => 'de'])
        ->assertCreated()
        ->assertJsonPath('name', 'Klar (Kopie)')
        ->assertJsonPath('built_in', false)
        ->assertJsonPath('manifest.name', 'Klar (Kopie)');
});
```

In `tests/Feature/Api/RightsMatrixTest.php` in `MATRIX_ROUTES` nach `'write own template'` ergänzen:

```php
    'duplicate own template' => ['POST', '/api/templates/{A}/duplicate', ['api:write']],
```

In `tests/Feature/Api/OpenApiTest.php` die erwarteten Pfade um `'/api/templates/{id}/duplicate'` ergänzen.

- [ ] **Step 2: Tests laufen lassen**

Run: `ddev artisan test --filter='DuplicateTemplateTest|TemplateApiTest|RightsMatrixTest|OpenApiTest'`
Expected: FAIL (Klasse `DuplicateTemplate` fehlt, `document_types` fehlt, Route fehlt).

- [ ] **Step 3: `freeSlug` öffentlich machen**

In `app/Actions/ImportTemplatePackage.php` `private static function freeSlug` → `public static function freeSlug` (Docblock bleibt).

- [ ] **Step 4: `DuplicateTemplate` implementieren**

`app/Actions/DuplicateTemplate.php`:

```php
<?php

namespace App\Actions;

use App\Models\Template;
use App\Models\TemplateAsset;
use App\Support\Actor;
use App\Support\Text;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * POST /api/templates/{id}/duplicate: an editable copy of any template (built-in ones are changed this way).
 * Name "<name> (copy)" in the request language (manifest limit 100 characters), a free slug like the import,
 * assets copied into the folder of the copy.
 */
final class DuplicateTemplate
{
    public function handle(Actor $actor, Template $template): Template
    {
        $template->loadMissing('assets');

        return DB::transaction(function () use ($template): Template {
            $name = Str::limit(Text::t('templates.copy_name', ['name' => $template->name]), 100, '');
            $copy = Template::query()->create([
                'name' => $name,
                'slug' => ImportTemplatePackage::freeSlug(Str::slug($name) ?: 'template'),
                'version' => $template->version,
                'author' => $template->author,
                'license' => $template->license,
                'description' => $template->description,
                'built_in' => false,
                'manifest' => [...($template->manifest ?? []), 'name' => $name],
                'header' => $template->header,
                'body' => $template->body,
                'footer' => $template->footer,
                'css' => $template->css,
            ]);

            $disk = Storage::disk('local');
            $folder = "templates/{$copy->id}";
            DB::afterRollBack(fn () => $disk->deleteDirectory($folder));
            foreach ($template->assets as $asset) {
                /** @var TemplateAsset $asset */
                $contents = $disk->get($asset->storage_path);
                if ($contents === null) {
                    continue;
                }
                $disk->put("{$folder}/{$asset->path}", $contents);
                $copy->assets()->create([
                    'path' => $asset->path,
                    'mime' => $asset->mime,
                    'storage_path' => "{$folder}/{$asset->path}",
                    'size' => strlen($contents),
                ]);
            }

            return $copy->load('assets');
        });
    }
}
```

`lang/en.json`: `"templates.copy_name": ":name (copy)"`, `lang/de.json`: `"templates.copy_name": ":name (Kopie)"`.

- [ ] **Step 5: Ressource und Processor erweitern**

In `app/ApiResource/TemplateResource.php`:

1. `use App\Enums\DocumentType;` ergänzen.
2. Nach `public bool $built_in,` den Konstruktorparameter einfügen:

```php
        /** @var list<string> */
        #[Groups([self::LIST, self::ITEM])]
        public array $document_types,
```

3. In `fromModel()` nach `built_in:` einfügen:

```php
            document_types: self::documentTypes($template->manifest ?? []),
```

4. Methode ergänzen:

```php
    /**
     * manifest.documentTypes when valid, otherwise all types (the manifest key is optional).
     *
     * @param  array<string, mixed>  $manifest
     * @return list<string>
     */
    private static function documentTypes(array $manifest): array
    {
        $all = array_map(fn (DocumentType $type): string => $type->value, DocumentType::cases());
        $types = $manifest['documentTypes'] ?? null;

        return is_array($types) && $types !== [] ? array_values(array_intersect($all, $types)) : $all;
    }
```

5. In `operations` nach der `Put`-Operation:

```php
        new Post(
            uriTemplate: '/templates/{id}/duplicate',
            name: 'template_duplicate',
            status: 201,
            input: false,
            middleware: ApiMiddleware::WRITE,
            read: false,
            deserialize: false,
            processor: TemplateProcessor::class,
            description: 'Copies a template (also a built-in one) into a new, editable template.',
        ),
```

In `app/State/Processor/TemplateProcessor.php`: `DuplicateTemplate` in den Konstruktor (`private readonly DuplicateTemplate $duplicate,`), Docblock um „POST …/duplicate = DuplicateTemplate“ ergänzen und am Anfang von `process()` nach `$actor = …`:

```php
        if ($operation->getName() === 'template_duplicate') {
            $source = Template::query()->with('assets')->findOrFail((string) $uriVariables['id']);

            return TemplateResource::fromModel($this->duplicate->handle($actor, $source));
        }
```

- [ ] **Step 6: Backend-Tests laufen lassen**

Run: `ddev artisan test --filter='DuplicateTemplateTest|TemplateApiTest|RightsMatrixTest|OpenApiTest|NormalizationTest'`
Expected: PASS. `NormalizationTest` prüft die neue Operation mit (sie erbt `Normalization::CONTEXT` vom Ressourcen-Attribut).

- [ ] **Step 7: `apiUpload` mit Test (TDD)**

In `resources/js/lib/api.test.ts` im `describe('api')` ergänzen (Import um `apiUpload` erweitern):

```ts
    it('uploads multipart form data without its own Content-Type (the browser sets the boundary)', async () => {
        fetchMock.mockResolvedValue(json(201, { id: 't1' }));
        const form = new FormData();
        form.append('package', new Blob(['zip']), 'kante.zip');

        await expect(apiUpload('/api/templates', form)).resolves.toEqual({ id: 't1' });
        const { init, headers } = sent();
        expect(init.method).toBe('POST');
        expect(init.body).toBe(form);
        expect(headers['Content-Type']).toBeUndefined();
        expect(headers['X-XSRF-TOKEN']).toBe('abc==');
    });
```

Run: `ddev exec pnpm test -- resources/js/lib/api.test.ts` → FAIL (`apiUpload` fehlt).

In `resources/js/lib/api.ts`:

1. `ApiOptions` um `form?: FormData;` ergänzen (Kommentar: `/** Multipart body (uploads); replaces body, the browser sets the Content-Type. */`).
2. In `send()` die Zeile mit `Content-Type` ersetzen durch:

```ts
    if (options.body !== undefined && !options.form) headers['Content-Type'] = method === 'PATCH' ? 'application/merge-patch+json' : 'application/json';
```

und im `fetch`-Aufruf `body:` ersetzen durch:

```ts
            body: options.form ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
```

3. Ergänzen:

```ts
/** POST of a multipart form (template ZIP, logo, image field) to the own API. */
export function apiUpload<T>(path: string, form: FormData, options: { signal?: AbortSignal } = {}): Promise<T> {
    return api<T>(path, { method: 'POST', form, signal: options.signal });
}
```

Run: `ddev exec pnpm test -- resources/js/lib/api.test.ts` → PASS.

- [ ] **Step 8: Schlüssel, Typen und Hooks**

In `resources/js/api/keys.ts` ergänzen:

```ts
    templates: () => '/api/templates',
    template: (id: string) => `/api/templates/${id}`,
    renderSources: () => apiUrl('/api/render/sources', { limit: 50 }),
    renderSchema: () => '/api/render/schema',
    documentTypes: () => '/api/document-types',
```

`keys.test.ts` ergänzen:

```ts
    it('know the template and settings URLs', () => {
        expect(keys.templates()).toBe('/api/templates');
        expect(keys.template('01k9')).toBe('/api/templates/01k9');
        expect(keys.renderSources()).toBe('/api/render/sources?limit=50');
        expect(keys.renderSchema()).toBe('/api/render/schema');
        expect(keys.documentTypes()).toBe('/api/document-types');
    });
```

`resources/js/api/templates.ts`:

```ts
import useSWR from 'swr';
import { api, apiUpload } from '@/lib/api';
import { keys } from './keys';
import { invalidate } from './paged';
import type { DocumentStatus, DocumentType, FieldScope, FieldType, Paper, RenderResponse } from './types';

export type TemplateSummary = {
    id: string;
    name: string;
    slug: string;
    version: string;
    author: string;
    license: string;
    description: string | null;
    built_in: boolean;
    document_types: DocumentType[];
    updated_at: string | null;
};

export type ExpectedField = { scope: FieldScope; key: string; type: FieldType; fallback?: unknown };

export type TemplateManifest = {
    name: string;
    version: string;
    author?: string;
    license?: string;
    description?: string;
    documentTypes?: DocumentType[];
    expectedFields?: ExpectedField[];
    paper?: Paper;
    translations?: Record<string, Record<string, string>>;
};

export type TemplateDetail = TemplateSummary & {
    manifest: TemplateManifest;
    header: string;
    body: string;
    footer: string;
    css: string;
    assets: { path: string; mime: string; size: number }[];
};

export type TemplateFiles = Pick<TemplateDetail, 'header' | 'body' | 'footer' | 'css' | 'manifest'>;

export type RenderSources = {
    scenarios: { key: string; document_type: DocumentType }[];
    documents: { id: string; type: DocumentType; status: DocumentStatus; number: string | null; date: string; customer_name: string | null; locale: string }[];
};

export type SchemaField = { key: string; label: string; type: FieldType; required: boolean; options: string[]; doc_types: DocumentType[] };
export type RenderSchema = { levels: Record<FieldScope, { context: string; core: string[]; custom: SchemaField[] }> };

export type TemplateRenderRequest = { template_id: string; template?: Partial<TemplateFiles>; scenario?: string; document_id?: string };

const STATIC = { revalidateOnFocus: false };

export function useTemplates() {
    return useSWR<TemplateSummary[]>(keys.templates());
}

export function useTemplate(id: string) {
    return useSWR<TemplateDetail>(keys.template(id), STATIC);
}

export function useRenderSources() {
    return useSWR<RenderSources>(keys.renderSources(), STATIC);
}

export function useRenderSchema() {
    return useSWR<RenderSchema>(keys.renderSchema());
}

export function renderTemplate(body: TemplateRenderRequest, signal?: AbortSignal): Promise<RenderResponse> {
    return api<RenderResponse>('/api/render', { method: 'POST', body, signal });
}

export async function importTemplate(file: File): Promise<TemplateDetail> {
    const form = new FormData();
    form.append('package', file);
    const template = await apiUpload<TemplateDetail>('/api/templates', form);
    void invalidate('/api/templates');
    return template;
}

export async function duplicateTemplate(id: string): Promise<TemplateDetail> {
    const copy = await api<TemplateDetail>(`${keys.template(id)}/duplicate`, { method: 'POST', body: {} });
    void invalidate('/api/templates');
    return copy;
}

export async function deleteTemplate(id: string): Promise<void> {
    await api<void>(keys.template(id), { method: 'DELETE' });
    void invalidate('/api/templates');
}

export async function saveTemplateFiles(id: string, files: TemplateFiles): Promise<TemplateDetail> {
    const template = await api<TemplateDetail>(`${keys.template(id)}/files`, { method: 'PUT', body: files });
    void invalidate('/api/templates');
    return template;
}

/** Download of the saved state as template package (session cookie, same origin). */
export const packageUrl = (id: string): string => `${keys.template(id)}/package`;
```

`resources/js/api/settings.ts` (Task 9–11 erweitern die Datei):

```ts
import useSWR from 'swr';
import { keys } from './keys';
import type { ComplianceProfile, DocumentType } from './types';

/** GET /api/document-types (DocumentTypeResource). */
export type DocumentTypeSetting = {
    type: DocumentType;
    profile: ComplianceProfile;
    template_id: string | null;
    default_intro_block_id: string | null;
    default_closing_block_id: string | null;
    payment_term_days: number | null;
    validity_days: number | null;
    numbering: { pattern: string; reset_yearly: boolean; next_value: number; next_number: string };
};

export function useDocumentTypes() {
    return useSWR<DocumentTypeSetting[]>(keys.documentTypes());
}
```

- [ ] **Step 9: Szenario der Mini-Vorschau (TDD)**

`resources/js/templates/scenario.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { previewScenario } from './scenario';

describe('previewScenario', () => {
    it('shows an invoice when the template can do invoices, else a quote', () => {
        expect(previewScenario(['offer', 'confirmation', 'invoice', 'cancellation'])).toBe('short_invoice');
        expect(previewScenario(['offer'])).toBe('offer_with_options');
        expect(previewScenario(['confirmation'])).toBe('short_invoice');
        expect(previewScenario([])).toBe('short_invoice');
    });
});
```

`resources/js/templates/scenario.ts`:

```ts
import type { DocumentType } from '@/api/types';

/** Sample scenario of a gallery thumbnail: an invoice, unless the template is made for quotes only. */
export function previewScenario(types: DocumentType[]): 'short_invoice' | 'offer_with_options' {
    return types.includes('offer') && !types.includes('invoice') && !types.includes('confirmation') && !types.includes('cancellation')
        ? 'offer_with_options'
        : 'short_invoice';
}
```

Run: `ddev exec pnpm test -- resources/js/templates/scenario.test.ts resources/js/api/keys.test.ts` → PASS.

- [ ] **Step 10: Galerie bauen**

`resources/js/templates/import-button.tsx`:

```tsx
import { router } from '@inertiajs/react';
import { Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { importTemplate } from '@/api/templates';
import { Button, type ButtonVariant } from '@/components/ui';
import { ApiError, errorMessage } from '@/lib/api';
import { path, t } from '@/lib/i18n';
import { toast } from '@/lib/toast';

/** First violation of a 422 (the package or manifest problem), otherwise the general message. */
export function uploadError(error: unknown): string {
    return error instanceof ApiError && error.violations[0] ? error.violations[0].message : errorMessage(error);
}

/** "Import ZIP": file picker → POST /api/templates (multipart "package") → toast with "Open". */
export function ImportButton({ variant = 'primary' }: { variant?: ButtonVariant }) {
    const input = useRef<HTMLInputElement>(null);
    const [pending, setPending] = useState(false);

    const onFile = async (file: File | undefined) => {
        if (!file) return;
        setPending(true);
        try {
            const template = await importTemplate(file);
            toast.success(t('templates.imported', { name: template.name }), { label: t('templates.open'), run: () => router.visit(path(`/templates/${template.id}`)) });
        } catch (error) {
            toast.error(uploadError(error));
        } finally {
            setPending(false);
        }
    };

    return (
        <>
            <input
                ref={input}
                type="file"
                accept=".zip,application/zip"
                hidden
                onChange={(e) => {
                    void onFile(e.target.files?.[0]);
                    e.target.value = '';
                }}
            />
            <Button variant={variant} icon={<Upload />} pending={pending} onClick={() => input.current?.click()}>
                {t('templates.import')}
            </Button>
        </>
    );
}
```

`resources/js/templates/gallery-card.tsx`:

```tsx
import { Link, router } from '@inertiajs/react';
import { PagedPreview } from '@openbill/paged-preview';
import { Copy, Eye, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import useSWR from 'swr';
import type { DocumentTypeSetting } from '@/api/settings';
import { deleteTemplate, duplicateTemplate, renderTemplate, type TemplateSummary } from '@/api/templates';
import type { RenderResponse } from '@/api/types';
import { Badge, Button, ButtonLink, ConfirmDialog, Menu, MenuItem, Skeleton, Tag } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { path, t } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { useInView } from '@/lib/use-in-view';
import { previewScenario } from './scenario';

/** One template: thumbnail (rendered on the server once visible), name, types, actions. */
export function GalleryCard({ template, documentTypes }: { template: TemplateSummary; documentTypes: DocumentTypeSetting[] }) {
    const href = path(`/templates/${template.id}`);
    const [confirm, setConfirm] = useState(false);
    const [busy, setBusy] = useState<'duplicate' | 'delete' | null>(null);
    const defaultFor = documentTypes.filter((setting) => setting.template_id === template.id).map((setting) => setting.type);

    const duplicate = async () => {
        setBusy('duplicate');
        try {
            const copy = await duplicateTemplate(template.id);
            toast.success(t('templates.duplicated', { name: copy.name }), { label: t('templates.edit'), run: () => router.visit(path(`/templates/${copy.id}`)) });
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setBusy(null);
        }
    };

    const remove = async () => {
        setBusy('delete');
        try {
            await deleteTemplate(template.id);
            setConfirm(false);
            toast.success(t('templates.deleted', { name: template.name }));
        } catch (error) {
            setConfirm(false);
            toast.error(errorMessage(error));
        } finally {
            setBusy(null);
        }
    };

    return (
        <article className="grid min-w-0 grid-rows-[auto_1fr] overflow-hidden rounded-lg bg-bg">
            <Link
                href={href}
                aria-label={t(template.built_in ? 'templates.view_named' : 'templates.edit_named', { name: template.name })}
                className="block h-60 overflow-hidden bg-surface-2 px-8 pt-6 text-inherit no-underline transition-colors hover:bg-surface-3"
            >
                <Thumbnail template={template} />
            </Link>
            <div className="grid content-start gap-3 px-5 pt-4 pb-5">
                <div className="flex min-w-0 items-center gap-2">
                    <h2 className="min-w-0 truncate text-lg">{template.name}</h2>
                    {template.built_in && <Badge plain>{t('templates.built_in')}</Badge>}
                    <span className="flex-1" />
                    <span className="num text-xs text-muted">v{template.version}</span>
                </div>
                {template.description && <p className="text-sm text-muted">{template.description}</p>}
                <div className="flex flex-wrap gap-1.5" aria-label={t('templates.document_types')}>
                    {template.document_types.map((type) => (
                        <Tag key={type} neutral={!defaultFor.includes(type)}>
                            {t(`document_type.${type}`)}
                            {defaultFor.includes(type) && ` · ${t('templates.default')}`}
                        </Tag>
                    ))}
                </div>
                <div className="mt-1 flex items-center gap-2">
                    <ButtonLink href={href} size="sm" variant={template.built_in ? 'default' : 'soft'} icon={template.built_in ? <Eye /> : <Pencil />}>
                        {template.built_in ? t('templates.view') : t('templates.edit')}
                    </ButtonLink>
                    <Button size="sm" variant="ghost" icon={<Copy />} pending={busy === 'duplicate'} onClick={() => void duplicate()}>
                        {t('templates.duplicate')}
                    </Button>
                    <span className="flex-1" />
                    {!template.built_in && (
                        <Menu
                            trigger={
                                <Button size="sm" variant="ghost" iconOnly icon={<MoreHorizontal />}>
                                    {t('templates.more')}
                                </Button>
                            }
                        >
                            <MenuItem danger icon={<Trash2 />} onSelect={() => setConfirm(true)}>
                                {t('templates.delete')}
                            </MenuItem>
                        </Menu>
                    )}
                </div>
            </div>
            <ConfirmDialog
                open={confirm}
                onClose={() => setConfirm(false)}
                onConfirm={() => void remove()}
                title={t('templates.delete_title', { name: template.name })}
                description={t('templates.delete_text')}
                confirmLabel={t('templates.delete')}
                pending={busy === 'delete'}
                danger
            />
        </article>
    );
}

/** First page with sample data; nothing is requested before the card comes near the viewport. */
function Thumbnail({ template }: { template: TemplateSummary }) {
    const [ref, inView] = useInView<HTMLDivElement>();
    const scenario = previewScenario(template.document_types);
    const { data } = useSWR<RenderResponse>(inView ? ['/api/render', 'thumbnail', template.id, template.updated_at, scenario] : null, () => renderTemplate({ template_id: template.id, scenario }), {
        revalidateOnFocus: false,
        shouldRetryOnError: false,
    });

    return (
        <div ref={ref} className="h-full">
            {data ? (
                <PagedPreview parts={data} paper={data.paper} maxPages={1} lazy labels={{ document: t('templates.preview_of', { name: template.name }) }} className="[&_.pp-page]:rounded-t-[3px]" />
            ) : (
                <Skeleton h="100%" r={3} />
            )}
        </div>
    );
}
```

`Menu` nimmt ein `trigger`-Element (Radix `asChild`, `modal={false}`), `MenuItem` ein `onSelect`; `ConfirmDialog` hat `confirmLabel`, `pending`, `danger`; `Tag` hat `neutral` – so wie oben benutzt (geprüft in `resources/js/components/ui/menu.tsx`, `dialog.tsx`, `badge.tsx`).

`resources/js/pages/templates/index.tsx` vollständig:

```tsx
import { Head } from '@inertiajs/react';
import { FileArchive, SquareCode } from 'lucide-react';
import { useDocumentTypes } from '@/api/settings';
import { useTemplates } from '@/api/templates';
import { Card, EmptyState, ErrorState, Page, PageHeader, Skeleton } from '@/components/ui';
import { appLayout } from '@/layouts/app-shell';
import { t } from '@/lib/i18n';
import { GalleryCard } from '@/templates/gallery-card';
import { ImportButton } from '@/templates/import-button';

const FILES = ['manifest', 'header', 'template', 'footer', 'styles', 'assets'] as const;
const FILE_NAMES: Record<(typeof FILES)[number], string> = {
    manifest: 'manifest.json',
    header: 'header.liquid',
    template: 'template.liquid',
    footer: 'footer.liquid',
    styles: 'styles.css',
    assets: 'assets/',
};

/** Template gallery (/{locale}/templates). */
export default function Templates() {
    const templates = useTemplates();
    const documentTypes = useDocumentTypes();
    const error = templates.error ?? documentTypes.error;

    return (
        <Page>
            <Head title={t('nav.templates')} />
            <PageHeader title={t('nav.templates')} description={t('templates.description')} actions={<ImportButton />} />

            {error ? (
                <ErrorState
                    error={error}
                    onRetry={() => {
                        void templates.mutate();
                        void documentTypes.mutate();
                    }}
                />
            ) : !templates.data || !documentTypes.data ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-5" aria-busy="true" aria-label={t('templates.loading')}>
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="overflow-hidden rounded-lg bg-bg">
                            <Skeleton h={240} r={0} />
                            <div className="grid gap-2 px-5 pt-4 pb-5">
                                <Skeleton w="45%" h={16} />
                                <Skeleton w="90%" h={12} />
                            </div>
                        </div>
                    ))}
                </div>
            ) : templates.data.length === 0 ? (
                <Card>
                    <EmptyState icon={<SquareCode />} title={t('templates.empty')} actions={<ImportButton />}>
                        {t('templates.empty_text')}
                    </EmptyState>
                </Card>
            ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-5">
                    {templates.data.map((template) => (
                        <GalleryCard key={template.id} template={template} documentTypes={documentTypes.data!} />
                    ))}
                </div>
            )}

            <Card aria-labelledby="template-package" className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                <div>
                    <div className="flex items-center gap-2">
                        <FileArchive aria-hidden className="size-[18px]" />
                        <h2 id="template-package" className="text-lg">
                            {t('templates.package_title')}
                        </h2>
                    </div>
                    <p className="mt-1 max-w-[52ch] text-sm text-muted">{t('templates.package_text')}</p>
                </div>
                <ul className="m-0 grid list-none gap-0.5 p-0">
                    {FILES.map((file) => (
                        <li key={file} className="grid items-baseline gap-0.5 rounded-sm bg-surface-2 px-3 py-2 text-sm sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-3">
                            <code className="justify-self-start rounded-sm bg-bg px-1.5 font-mono text-xs">{FILE_NAMES[file]}</code>
                            <span className="text-muted">{t(`templates.file.${file}`)}</span>
                        </li>
                    ))}
                </ul>
            </Card>
        </Page>
    );
}

Templates.layout = appLayout;
```

- [ ] **Step 11: Übersetzungen**

`lang/en.json`:

```json
"templates.built_in": "Built-in",
"templates.default": "Default",
"templates.delete": "Delete",
"templates.delete_text": "The template disappears from the list. Finalized documents keep their PDF. Templates still used by documents cannot be deleted.",
"templates.delete_title": "Delete “:name”?",
"templates.deleted": "“:name” deleted",
"templates.document_types": "Document types",
"templates.duplicate": "Duplicate",
"templates.duplicated": "“:name” created",
"templates.edit": "Edit",
"templates.edit_named": "Edit :name",
"templates.empty": "No templates yet",
"templates.empty_text": "Import a template package to output documents as PDF.",
"templates.file.assets": "Optional: fonts and images",
"templates.file.footer": "Footer, in the bottom margin of every page, also with page numbers",
"templates.file.header": "Header, in the top margin of every page",
"templates.file.manifest": "Name, version, author, license, document types, expected custom fields and paper",
"templates.file.styles": "Styles of the content. Header and footer bring their own <style>",
"templates.file.template": "Content with address, positions and totals, flows over as many pages as needed",
"templates.import": "Import ZIP",
"templates.imported": "“:name” imported",
"templates.loading": "Loading templates",
"templates.more": "More actions",
"templates.open": "Open",
"templates.package_text": "A package is a ZIP file. Header and footer run in their own context like in Gotenberg: without the content's CSS, without JavaScript and without external files. Images such as the logo come in as data URLs.",
"templates.package_title": "What is in a template package?",
"templates.preview_of": "Preview of :name",
"templates.view": "View",
"templates.view_named": "View :name"
```

`lang/de.json`:

```json
"templates.built_in": "Mitgeliefert",
"templates.default": "Standard",
"templates.delete": "Löschen",
"templates.delete_text": "Das Template verschwindet aus der Liste. Abgeschlossene Dokumente behalten ihr PDF. Templates, die Dokumente noch benutzen, lassen sich nicht löschen.",
"templates.delete_title": "„:name“ löschen?",
"templates.deleted": "„:name“ gelöscht",
"templates.document_types": "Dokumenttypen",
"templates.duplicate": "Duplizieren",
"templates.duplicated": "„:name“ angelegt",
"templates.edit": "Bearbeiten",
"templates.edit_named": ":name bearbeiten",
"templates.empty": "Noch keine Templates",
"templates.empty_text": "Importiere ein Template-Paket, um Dokumente als PDF auszugeben.",
"templates.file.assets": "Optional: Schriften und Grafiken",
"templates.file.footer": "Fußzeile, steht auf jeder Seite im unteren Rand, auch mit Seitenzahl",
"templates.file.header": "Kopfzeile, steht auf jeder Seite im oberen Rand",
"templates.file.manifest": "Name, Version, Autor, Lizenz, Dokumenttypen, erwartete eigene Felder und Papierformat",
"templates.file.styles": "Gestaltung des Inhalts. Kopf- und Fußzeile bringen ihr eigenes <style> mit",
"templates.file.template": "Inhalt mit Adresse, Positionen und Summen, fließt über beliebig viele Seiten",
"templates.import": "ZIP importieren",
"templates.imported": "„:name“ importiert",
"templates.loading": "Templates werden geladen",
"templates.more": "Weitere Aktionen",
"templates.open": "Öffnen",
"templates.package_text": "Ein Paket ist eine ZIP-Datei. Kopf- und Fußzeile laufen wie bei Gotenberg in einem eigenen Kontext: ohne das CSS des Inhalts, ohne JavaScript und ohne externe Dateien. Bilder wie das Logo kommen als Data-URL hinein.",
"templates.package_title": "Was steckt in einem Template-Paket?",
"templates.preview_of": "Vorschau von :name",
"templates.view": "Ansehen",
"templates.view_named": ":name ansehen"
```

- [ ] **Step 12: Alles prüfen**

Run: `ddev exec pnpm typecheck && ddev exec pnpm test && ddev artisan test --filter='Template|RightsMatrix|OpenApi|Translations|SetupPages'`
Expected: PASS.

Manuell: `ddev exec pnpm dev`, https://openbill.ddev.site/en/templates – drei Karten mit Vorschau, im Netzwerk-Tab nur Render-Anfragen für sichtbare Karten (Fenster klein ziehen: untere Karten laden erst beim Scrollen). „Duplizieren“ an Klar → Toast, neue Karte „Klar (copy)“ mit Menü „Löschen“.

- [ ] **Step 13: Commit**

```bash
ddev exec vendor/bin/pint && ddev exec vendor/bin/phpstan analyse --memory-limit=1G
git add app resources/js lang tests
git commit -m "feat: template gallery with lazy previews, ZIP import, duplicate and delete" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 4: CodeMirror-Komponente mit Fehlermarkierung

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml` (über pnpm)
- Create: `resources/js/templates/diagnostics.ts`, `resources/js/templates/diagnostics.test.ts`
- Create: `resources/js/components/code-editor.tsx`
- Create: `resources/css/templates.css`; Modify: `resources/css/app.css`

**Interfaces:**
- Consumes: –
- Produces:
  - `type LineError = { line: number | null; message: string }`, `toDiagnostics(doc: Text, errors: LineError[]): Diagnostic[]` (`resources/js/templates/diagnostics.ts`)
  - `CodeEditor` (`resources/js/components/code-editor.tsx`): Props `{ value: string; onChange(value: string): void; language: 'liquid' | 'css' | 'json'; readOnly?: boolean; ariaLabel: string; errors?: LineError[]; ref?: Ref<CodeEditorHandle> }`, `type CodeEditorHandle = { insert(text: string): void; goToLine(line: number): void; focus(): void }`

- [ ] **Step 1: Abhängigkeiten installieren**

```bash
ddev exec pnpm add -w codemirror@^6.0.2 @codemirror/state@^6.7.6 @codemirror/view@^6.43.14 @codemirror/lang-liquid@^6.3.3 @codemirror/lang-css@^6.3.1 @codemirror/lang-json@^6.0.2 @codemirror/lint@^6.9.7
```

Expected: `dependencies` in `package.json` enthält die sieben Pakete; die Versionen sind dieselben wie in `prototypes/clickdummy-v2` (ein Lockfile, kein zweiter Download). Keines der Pakete hat Build-Skripte (`pnpm install` bricht sonst wegen `allowBuilds` ab – dann melden, nicht freischalten).

- [ ] **Step 2: Failing Test für die Diagnosen**

`resources/js/templates/diagnostics.test.ts`:

```ts
import { Text } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { toDiagnostics } from './diagnostics';

const doc = Text.of(['<h1>{{ document.number }}</h1>', '{% if x %}', '', 'end']);

describe('toDiagnostics', () => {
    it('marks the whole reported line', () => {
        expect(toDiagnostics(doc, [{ line: 2, message: 'Unclosed if' }])).toEqual([{ from: 31, to: 41, severity: 'error', message: 'Unclosed if' }]);
    });

    it('marks an empty line as a point and clamps lines past the end to the last line', () => {
        expect(toDiagnostics(doc, [{ line: 3, message: 'a' }])[0]).toMatchObject({ from: 42, to: 42 });
        expect(toDiagnostics(doc, [{ line: 99, message: 'b' }])[0]).toMatchObject({ from: 43, to: 46 });
    });

    it('leaves errors without a line to the error list', () => {
        expect(toDiagnostics(doc, [{ line: null, message: 'Output too large' }, { line: 0, message: 'zero' }])).toEqual([]);
    });
});
```

Run: `ddev exec pnpm test -- resources/js/templates/diagnostics.test.ts`
Expected: FAIL (Modul fehlt).

- [ ] **Step 3: `diagnostics.ts` implementieren**

```ts
import type { Diagnostic } from '@codemirror/lint';
import type { Text } from '@codemirror/state';

/** A template error of one part (RenderError of POST /api/render, line 1-based or unknown). */
export type LineError = { line: number | null; message: string };

/** CodeMirror diagnostics for the errors of one part: the whole line, lines past the end on the last line. */
export function toDiagnostics(doc: Text, errors: LineError[]): Diagnostic[] {
    return errors
        .filter((error): error is { line: number; message: string } => error.line !== null && error.line >= 1)
        .map((error) => {
            const line = doc.line(Math.min(error.line, doc.lines));
            return { from: line.from, to: line.to, severity: 'error', message: error.message };
        });
}
```

Run: `ddev exec pnpm test -- resources/js/templates/diagnostics.test.ts`
Expected: PASS.

- [ ] **Step 4: `CodeEditor` implementieren**

`resources/js/components/code-editor.tsx`:

```tsx
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { liquid } from '@codemirror/lang-liquid';
import { setDiagnostics } from '@codemirror/lint';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { toDiagnostics, type LineError } from '@/templates/diagnostics';

export type CodeEditorHandle = { insert(text: string): void; goToLine(line: number): void; focus(): void };

type Props = {
    value: string;
    onChange(value: string): void;
    language: 'liquid' | 'css' | 'json';
    readOnly?: boolean;
    ariaLabel: string;
    /** Template errors of this part: marked at their line (gutter, underline, tooltip). */
    errors?: LineError[];
    ref?: Ref<CodeEditorHandle>;
};

/** Colors from the app tokens, so light and dark mode follow data-theme. */
const theme = EditorView.theme({
    '&': { height: '100%', fontSize: '12.5px', backgroundColor: 'var(--surface)', color: 'var(--ink)' },
    '.cm-content': { fontFamily: 'var(--font-code)', caretColor: 'var(--accent)' },
    '.cm-gutters': { backgroundColor: 'var(--surface-2)', color: 'var(--faint)', border: 'none' },
    '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'color-mix(in srgb, var(--accent) 7%, transparent)' },
    '&.cm-focused': { outline: 'none' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { backgroundColor: 'var(--accent-soft) !important' },
    '.cm-scroller': { overflow: 'auto' },
});

const languages = { liquid, css, json };

/** CodeMirror 6 for Liquid, CSS and the manifest (JSON). The document follows `value`; changes go out through onChange. */
export function CodeEditor({ value, onChange, language, readOnly = false, ariaLabel, errors = [], ref }: Props) {
    const host = useRef<HTMLDivElement>(null);
    const view = useRef<EditorView | null>(null);
    const changeRef = useRef(onChange);
    const errorsRef = useRef(errors);

    useEffect(() => {
        changeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
        const editor = new EditorView({
            parent: host.current!,
            state: EditorState.create({
                doc: value,
                extensions: [
                    basicSetup,
                    languages[language](),
                    theme,
                    EditorState.readOnly.of(readOnly),
                    EditorView.lineWrapping,
                    EditorView.contentAttributes.of({ 'aria-label': ariaLabel }),
                    EditorView.updateListener.of((update) => {
                        if (update.docChanged) changeRef.current(update.state.doc.toString());
                    }),
                ],
            }),
        });
        editor.dispatch(setDiagnostics(editor.state, toDiagnostics(editor.state.doc, errorsRef.current)));
        view.current = editor;
        return () => {
            editor.destroy();
            view.current = null;
        };
        // a new language or read-only mode builds a new editor; value and errors follow in their own effects
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [language, readOnly, ariaLabel]);

    // outside changes (discard, paper form → manifest text, after saving)
    useEffect(() => {
        const editor = view.current;
        if (editor && editor.state.doc.toString() !== value) editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } });
    }, [value]);

    useEffect(() => {
        errorsRef.current = errors;
        const editor = view.current;
        if (editor) editor.dispatch(setDiagnostics(editor.state, toDiagnostics(editor.state.doc, errors)));
    }, [errors]);

    useImperativeHandle(
        ref,
        () => ({
            insert(text) {
                const editor = view.current;
                if (!editor || readOnly) return;
                const { from, to } = editor.state.selection.main;
                editor.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length }, scrollIntoView: true });
                editor.focus();
            },
            goToLine(line) {
                const editor = view.current;
                if (!editor) return;
                const target = editor.state.doc.line(Math.max(1, Math.min(line, editor.state.doc.lines)));
                editor.dispatch({ selection: { anchor: target.from }, effects: EditorView.scrollIntoView(target.from, { y: 'center' }) });
                editor.focus();
            },
            focus() {
                view.current?.focus();
            },
        }),
        [readOnly],
    );

    return <div ref={host} className="code-editor h-full min-h-0 overflow-hidden" />;
}
```

Hinweis zu `errors`: Aufrufer übergeben eine stabile Liste (`useMemo`), sonst würde jeder Render neue Diagnosen setzen (harmlos, aber unnötig).

- [ ] **Step 5: CSS für CodeMirror-Tooltips**

`resources/css/templates.css`:

```css
/* CodeMirror inside the template editor: fill the pane, tooltips in app colors (lint messages). */
@layer components {
    .code-editor .cm-editor {
        height: 100%;
    }
    .code-editor .cm-tooltip {
        border: 0;
        border-radius: var(--radius-sm);
        background: var(--surface);
        color: var(--ink);
        box-shadow: var(--shadow-float);
    }
    .code-editor .cm-diagnostic-error {
        border-left-color: var(--bad);
    }
    .code-editor .cm-lintRange-error {
        background-image: none;
        text-decoration: underline wavy var(--bad);
        text-underline-offset: 3px;
    }
}
```

In `resources/css/app.css` nach `@import './editor.css';` ergänzen: `@import './templates.css';` (`--radius-sm` und `--shadow-float` sind dort definiert).

- [ ] **Step 6: Prüfen**

Run: `ddev exec pnpm typecheck && ddev exec pnpm test && ddev exec pnpm build`
Expected: PASS; `pnpm build` zeigt CodeMirror im Bundle (Warnung über Chunk-Größe ist okay; Aufteilen erst bei Bedarf in Phase 11).

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml resources/js/components/code-editor.tsx resources/js/templates/diagnostics.ts resources/js/templates/diagnostics.test.ts resources/css
git commit -m "feat: CodeMirror editor component with template error markers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 5: Template-Editor I – Zustand, Tabs, Papier-Formular, Speichern, Export, Read-only

**Files:**
- Create: `resources/js/templates/editor-state.ts`, `resources/js/templates/editor-state.test.ts`
- Create: `resources/js/templates/editor/template-editor.tsx`, `resources/js/templates/editor/editor-header.tsx`, `resources/js/templates/editor/code-pane.tsx`, `resources/js/templates/editor/paper-form.tsx`, `resources/js/templates/editor/toolkit-slot.tsx`
- Modify: `resources/js/pages/templates/show.tsx` (vollständig ersetzen)
- Modify: `lang/en.json`, `lang/de.json`

**Interfaces:**
- Consumes: `useTemplate`, `saveTemplateFiles`, `duplicateTemplate`, `packageUrl` (Task 3), `CodeEditor` (Task 4), `useLeaveGuard` (`lib/hooks.ts`), `Paper` (`api/types.ts`).
- Produces (`editor-state.ts`):

```ts
export type Part = 'header' | 'body' | 'footer' | 'css' | 'manifest';
export const PARTS: Part[];
export type ManifestProblem = { code: 'invalid_json' | 'not_object'; detail?: string };
export type EditorState = { saved: TemplateFiles; files: TemplateFiles; manifestText: string; manifestProblem: ManifestProblem | null; part: Part };
export type EditorAction =
    | { type: 'part'; part: Part }
    | { type: 'edit'; part: Exclude<Part, 'manifest'>; value: string }
    | { type: 'manifest_text'; text: string }
    | { type: 'paper'; patch: Partial<Paper> }
    | { type: 'saved'; template: TemplateDetail }
    | { type: 'discard' };
export function initEditor(template: TemplateDetail): EditorState;
export function editorReducer(state: EditorState, action: EditorAction): EditorState;
export function isDirty(state: EditorState): boolean;
export function savePayload(state: EditorState): TemplateFiles | null;
export function zoneOf(part: Part): 'header' | 'body' | 'footer' | null;
export function parseManifest(text: string): { manifest: TemplateManifest } | { problem: ManifestProblem };
export const DEFAULT_PAPER: Paper; // wie App\Rendering\Paper::DEFAULT
```

- `TemplateEditor` (`template-editor.tsx`) mit Props `{ template: TemplateDetail }`; `ToolkitSlot` laut Interfaces oben. Task 6 hängt Vorschau und Feldleiste an `TemplateEditor` an.

- [ ] **Step 1: Failing Tests für den Zustand**

`resources/js/templates/editor-state.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { TemplateDetail } from '@/api/templates';
import { editorReducer, initEditor, isDirty, parseManifest, savePayload, zoneOf } from './editor-state';

const template: TemplateDetail = {
    id: 't1',
    name: 'Fjord',
    slug: 'fjord',
    version: '1.0.0',
    author: 'Studio Nordlicht',
    license: 'MIT',
    description: null,
    built_in: false,
    document_types: ['invoice'],
    updated_at: null,
    manifest: { name: 'Fjord', version: '1.0.0', paper: { format: 'A4', marginX: '20mm', headerHeight: '30mm', footerHeight: '20mm' } },
    header: '<header>{{ org.name }}</header>',
    body: '<h1>{{ document.number }}</h1>',
    footer: '',
    css: 'h1 { font-size: 20px; }',
    assets: [],
};

describe('editor state', () => {
    it('starts clean on the content tab with the manifest as pretty JSON', () => {
        const state = initEditor(template);

        expect(state.part).toBe('body');
        expect(isDirty(state)).toBe(false);
        expect(state.manifestText).toBe(JSON.stringify(template.manifest, null, 2));
        expect(savePayload(state)).toEqual({ header: template.header, body: template.body, footer: '', css: template.css, manifest: template.manifest });
    });

    it('marks edits as unsaved and discards them', () => {
        const edited = editorReducer(initEditor(template), { type: 'edit', part: 'body', value: '<h1>{{ document.number }} {{ document.project_name }}</h1>' });

        expect(isDirty(edited)).toBe(true);
        expect(isDirty(editorReducer(edited, { type: 'discard' }))).toBe(false);
    });

    it('keeps the last valid manifest while the JSON is broken and refuses to save it (review focus)', () => {
        const broken = editorReducer(initEditor(template), { type: 'manifest_text', text: '{ "name": "Fjord", ' });

        expect(broken.manifestProblem?.code).toBe('invalid_json');
        expect(broken.files.manifest).toEqual(template.manifest);
        expect(isDirty(broken)).toBe(true);
        expect(savePayload(broken)).toBeNull();

        const array = editorReducer(broken, { type: 'manifest_text', text: '[]' });
        expect(array.manifestProblem).toEqual({ code: 'not_object' });

        const fixed = editorReducer(array, { type: 'manifest_text', text: JSON.stringify({ ...template.manifest, version: '1.1.0' }) });
        expect(fixed.manifestProblem).toBeNull();
        expect(savePayload(fixed)?.manifest.version).toBe('1.1.0');
    });

    it('writes paper changes into the manifest and its text', () => {
        const state = editorReducer(initEditor(template), { type: 'paper', patch: { marginX: '25mm' } });

        expect(state.files.manifest.paper).toEqual({ format: 'A4', marginX: '25mm', headerHeight: '30mm', footerHeight: '20mm' });
        expect(JSON.parse(state.manifestText).paper.marginX).toBe('25mm');
    });

    it('fills a missing paper with the defaults before patching', () => {
        const bare = { ...template, manifest: { name: 'Fjord', version: '1.0.0' } };
        const state = editorReducer(initEditor(bare), { type: 'paper', patch: { format: 'Letter' } });

        expect(state.files.manifest.paper).toEqual({ format: 'Letter', marginX: '20mm', headerHeight: '30mm', footerHeight: '20mm' });
    });

    it('is clean again after saving and takes the server state', () => {
        const edited = editorReducer(initEditor(template), { type: 'edit', part: 'css', value: 'h1 { color: red; }' });
        const saved = editorReducer(edited, { type: 'saved', template: { ...template, css: 'h1 { color: red; }' } });

        expect(isDirty(saved)).toBe(false);
        expect(saved.part).toBe(edited.part);
    });

    it('maps tabs to preview zones', () => {
        expect([zoneOf('header'), zoneOf('body'), zoneOf('footer'), zoneOf('css'), zoneOf('manifest')]).toEqual(['header', 'body', 'footer', null, null]);
    });

    it('parses manifests', () => {
        expect(parseManifest('{"name":"A","version":"1.0.0"}')).toEqual({ manifest: { name: 'A', version: '1.0.0' } });
        expect(parseManifest('nope')).toMatchObject({ problem: { code: 'invalid_json' } });
        expect(parseManifest('null')).toEqual({ problem: { code: 'not_object' } });
    });
});
```

Run: `ddev exec pnpm test -- resources/js/templates/editor-state.test.ts`
Expected: FAIL (Modul fehlt).

- [ ] **Step 2: `editor-state.ts` implementieren**

```ts
import type { TemplateDetail, TemplateFiles, TemplateManifest } from '@/api/templates';
import type { Paper } from '@/api/types';

export type Part = 'header' | 'body' | 'footer' | 'css' | 'manifest';
export const PARTS: Part[] = ['header', 'body', 'footer', 'css', 'manifest'];

/** Same as App\Rendering\Paper::DEFAULT. */
export const DEFAULT_PAPER: Paper = { format: 'A4', marginX: '20mm', headerHeight: '30mm', footerHeight: '20mm' };

export type ManifestProblem = { code: 'invalid_json' | 'not_object'; detail?: string };

/** files.manifest is always the last valid manifest; manifestText is what the user typed. */
export type EditorState = { saved: TemplateFiles; files: TemplateFiles; manifestText: string; manifestProblem: ManifestProblem | null; part: Part };

export type EditorAction =
    | { type: 'part'; part: Part }
    | { type: 'edit'; part: Exclude<Part, 'manifest'>; value: string }
    | { type: 'manifest_text'; text: string }
    | { type: 'paper'; patch: Partial<Paper> }
    | { type: 'saved'; template: TemplateDetail }
    | { type: 'discard' };

const pretty = (manifest: TemplateManifest): string => JSON.stringify(manifest, null, 2);

const filesOf = (template: TemplateDetail): TemplateFiles => ({
    header: template.header,
    body: template.body,
    footer: template.footer,
    css: template.css,
    manifest: template.manifest,
});

export function parseManifest(text: string): { manifest: TemplateManifest } | { problem: ManifestProblem } {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch (error) {
        return { problem: { code: 'invalid_json', detail: error instanceof Error ? error.message : String(error) } };
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return { problem: { code: 'not_object' } };
    return { manifest: parsed as TemplateManifest };
}

export function initEditor(template: TemplateDetail): EditorState {
    const files = filesOf(template);
    return { saved: files, files, manifestText: pretty(files.manifest), manifestProblem: null, part: 'body' };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
    switch (action.type) {
        case 'part':
            return { ...state, part: action.part };
        case 'edit':
            return { ...state, files: { ...state.files, [action.part]: action.value } };
        case 'manifest_text': {
            const result = parseManifest(action.text);
            return 'manifest' in result
                ? { ...state, manifestText: action.text, manifestProblem: null, files: { ...state.files, manifest: result.manifest } }
                : { ...state, manifestText: action.text, manifestProblem: result.problem };
        }
        case 'paper': {
            const manifest = { ...state.files.manifest, paper: { ...DEFAULT_PAPER, ...state.files.manifest.paper, ...action.patch } };
            return { ...state, files: { ...state.files, manifest }, manifestText: pretty(manifest), manifestProblem: null };
        }
        case 'saved': {
            const files = filesOf(action.template);
            return { ...state, saved: files, files, manifestText: pretty(files.manifest), manifestProblem: null };
        }
        case 'discard':
            return { ...state, files: state.saved, manifestText: pretty(state.saved.manifest), manifestProblem: null };
    }
}

export function isDirty(state: EditorState): boolean {
    return JSON.stringify(state.files) !== JSON.stringify(state.saved) || state.manifestText !== pretty(state.saved.manifest);
}

/** What PUT /api/templates/{id}/files gets; null while the manifest text is no valid JSON object. */
export function savePayload(state: EditorState): TemplateFiles | null {
    return state.manifestProblem ? null : state.files;
}

export function zoneOf(part: Part): 'header' | 'body' | 'footer' | null {
    return part === 'header' || part === 'body' || part === 'footer' ? part : null;
}
```

Run: `ddev exec pnpm test -- resources/js/templates/editor-state.test.ts`
Expected: PASS (8 Tests). Hinweis zu „is clean again after saving“: nach `saved` ist `manifestText` = `pretty(saved.manifest)`, daher sauber.

- [ ] **Step 3: Phase-9-Platzhalter `ToolkitSlot`**

`resources/js/templates/editor/toolkit-slot.tsx`:

```tsx
import type { ReactNode } from 'react';

export type ToolkitSlotProps = {
    templateId: string;
    builtIn: boolean;
    /** Unsaved changes in the editor: the toolkit should start from the saved state. */
    dirty: boolean;
    /** Saves the editor (PUT /api/templates/{id}/files); false when invalid or failed. */
    save(): Promise<boolean>;
};

/**
 * Place of the "Download toolkit" button in the editor header (spec 7). Phase 9 replaces this body with the button and
 * its dialog (POST /{locale}/templates/{id}/toolkit) – no other editor file changes for that.
 */
export function ToolkitSlot(props: ToolkitSlotProps): ReactNode {
    void props;
    return null;
}
```

- [ ] **Step 4: Papier-Formular**

`resources/js/templates/editor/paper-form.tsx`:

```tsx
import type { Paper } from '@/api/types';
import { Select, TextInput } from '@/components/ui';
import { t } from '@/lib/i18n';
import { DEFAULT_PAPER } from '../editor-state';

/** CSS length as the manifest wants it (App\Rendering\Paper::LENGTH); only a format hint, the server checks the rest. */
const LENGTH = /^\d+(?:\.\d+)?(mm|cm|in|pt|px)$/;

export function PaperForm({ paper, readOnly, onChange }: { paper: Paper | undefined; readOnly: boolean; onChange(patch: Partial<Paper>): void }) {
    const value = { ...DEFAULT_PAPER, ...paper };
    const length = (key: 'headerHeight' | 'footerHeight' | 'marginX', label: string) => (
        <TextInput
            label={label}
            value={value[key]}
            disabled={readOnly}
            className="font-mono text-sm"
            error={LENGTH.test(value[key]) ? undefined : t('templates.paper_length_hint')}
            onChange={(e) => onChange({ [key]: e.target.value.trim() })}
        />
    );

    return (
        <div className="grid grid-cols-2 gap-3 px-4 pt-3 pb-4 sm:grid-cols-4">
            <Select label={t('templates.paper_format')} value={value.format} disabled={readOnly} onChange={(e) => onChange({ format: e.target.value })}>
                <option value="A4">A4</option>
                <option value="Letter">Letter</option>
            </Select>
            {length('headerHeight', t('templates.paper_header'))}
            {length('footerHeight', t('templates.paper_footer'))}
            {length('marginX', t('templates.paper_margin'))}
        </div>
    );
}
```

- [ ] **Step 5: Kopfzeile des Editors**

`resources/js/templates/editor/editor-header.tsx`:

```tsx
import { ChevronLeft, Copy, Download, Lock, Save } from 'lucide-react';
import { Badge, Button, ButtonLink, buttonClass } from '@/components/ui';
import { path, t } from '@/lib/i18n';
import { packageUrl, type TemplateManifest } from '@/api/templates';
import { ToolkitSlot } from './toolkit-slot';

type Props = {
    templateId: string;
    manifest: TemplateManifest;
    builtIn: boolean;
    dirty: boolean;
    saving: boolean;
    duplicating: boolean;
    onSave(): Promise<boolean>;
    onDiscard(): void;
    onDuplicate(): void;
};

export function EditorHeader({ templateId, manifest, builtIn, dirty, saving, duplicating, onSave, onDiscard, onDuplicate }: Props) {
    return (
        <header className="flex flex-wrap items-center gap-3 px-4 pt-4 pb-3 sm:px-6 sm:pt-5 sm:pb-4">
            <ButtonLink href={path('/templates')} variant="ghost" iconOnly icon={<ChevronLeft />}>
                {t('templates.back')}
            </ButtonLink>
            <div className="grid min-w-0 gap-0.5">
                <h1 className="min-w-0 truncate text-2xl font-bold tracking-brand">{manifest.name || t('templates.unnamed')}</h1>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                    <span className="num">{t('templates.version', { version: manifest.version })}</span>
                    {manifest.author && <span>{t('templates.by', { author: manifest.author })}</span>}
                    {builtIn && (
                        <Badge plain>
                            <Lock aria-hidden className="size-3" /> {t('templates.read_only')}
                        </Badge>
                    )}
                    {!builtIn && dirty && <Badge tone="warn">{t('templates.unsaved')}</Badge>}
                </div>
            </div>
            <span className="flex-1" />
            {dirty ? (
                <Button variant="ghost" icon={<Download />} disabled title={t('templates.export_unsaved')}>
                    {t('templates.export')}
                </Button>
            ) : (
                <a href={packageUrl(templateId)} download className={buttonClass({ variant: 'ghost' })}>
                    <Download aria-hidden />
                    {t('templates.export')}
                </a>
            )}
            <ToolkitSlot templateId={templateId} builtIn={builtIn} dirty={dirty} save={onSave} />
            {builtIn ? (
                <Button variant="primary" icon={<Copy />} pending={duplicating} onClick={onDuplicate}>
                    {t('templates.duplicate_to_edit')}
                </Button>
            ) : (
                <>
                    {dirty && (
                        <Button variant="ghost" onClick={onDiscard}>
                            {t('templates.discard')}
                        </Button>
                    )}
                    <Button variant="primary" icon={<Save />} pending={saving} disabled={!dirty} onClick={() => void onSave()} title={t('templates.save_hint')}>
                        {t('templates.save')}
                    </Button>
                </>
            )}
        </header>
    );
}
```

`buttonClass()` stylt Icons (`[&_svg]:size-4`) und gilt laut Kommentar auch für Links; `<Button>` setzt das Icon nur vor den Text – das `<a>` oben entspricht dem.

- [ ] **Step 6: Code-Bereich**

`resources/js/templates/editor/code-pane.tsx`:

```tsx
import { PanelLeftOpen } from 'lucide-react';
import type { Ref } from 'react';
import type { Paper } from '@/api/types';
import { CodeEditor, type CodeEditorHandle } from '@/components/code-editor';
import { Button, Notice, Tabs } from '@/components/ui';
import { t } from '@/lib/i18n';
import type { LineError } from '../diagnostics';
import { PARTS, type EditorState, type Part } from '../editor-state';
import { PaperForm } from './paper-form';

type Props = {
    state: EditorState;
    readOnly: boolean;
    errors: Record<Part, LineError[]>;
    /** Messages of the server for manifest.* (422 on save). */
    manifestViolations: string[];
    fieldsOpen: boolean;
    editorRef: Ref<CodeEditorHandle>;
    onOpenFields(): void;
    onPart(part: Part): void;
    onEdit(part: Exclude<Part, 'manifest'>, value: string): void;
    onManifestText(text: string): void;
    onPaper(patch: Partial<Paper>): void;
};

const LANGUAGE: Record<Exclude<Part, 'manifest'>, 'liquid' | 'css'> = { header: 'liquid', body: 'liquid', footer: 'liquid', css: 'css' };

export function CodePane({ state, readOnly, errors, manifestViolations, fieldsOpen, editorRef, onOpenFields, onPart, onEdit, onManifestText, onPaper }: Props) {
    const part = state.part;

    return (
        <section aria-label={t('templates.source')} className="grid min-h-[34rem] min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg bg-surface-2 lg:min-h-0">
            <div className="flex flex-wrap items-center gap-2 p-3">
                {!fieldsOpen && (
                    <Button size="sm" variant="ghost" iconOnly icon={<PanelLeftOpen />} onClick={onOpenFields}>
                        {t('templates.fields_open')}
                    </Button>
                )}
                <Tabs<Part>
                    label={t('templates.part_label')}
                    value={part}
                    onChange={onPart}
                    items={PARTS.map((value) => ({
                        value,
                        label: errors[value].length > 0 ? `${t(`templates.part.${value}`)} · ${errors[value].length}` : t(`templates.part.${value}`),
                    }))}
                />
            </div>
            <div className="mx-3 mb-3 grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden rounded-md bg-surface">
                <p className="px-4 py-2 text-xs text-muted">{t(`templates.hint.${part}`)}</p>
                {part === 'manifest' ? (
                    <div>
                        <PaperForm paper={state.files.manifest.paper} readOnly={readOnly} onChange={onPaper} />
                        {state.manifestProblem && (
                            <Notice tone="bad" className="mx-4 mb-3">
                                <b>{t('templates.manifest_invalid')}</b> {t(`templates.manifest_problem.${state.manifestProblem.code}`)} {state.manifestProblem.detail}
                            </Notice>
                        )}
                        {manifestViolations.length > 0 && (
                            <Notice tone="bad" className="mx-4 mb-3">
                                <ul className="m-0 grid list-none gap-0.5 p-0">
                                    {manifestViolations.map((message) => (
                                        <li key={message}>{message}</li>
                                    ))}
                                </ul>
                            </Notice>
                        )}
                    </div>
                ) : (
                    <div />
                )}
                <div className="min-h-0">
                    {part === 'manifest' ? (
                        <CodeEditor key="manifest" ref={editorRef} language="json" value={state.manifestText} readOnly={readOnly} ariaLabel="manifest.json" errors={errors.manifest} onChange={onManifestText} />
                    ) : (
                        <CodeEditor
                            key={part}
                            ref={editorRef}
                            language={LANGUAGE[part]}
                            value={state.files[part]}
                            readOnly={readOnly}
                            ariaLabel={t(`templates.part.${part}`)}
                            errors={errors[part]}
                            onChange={(value) => onEdit(part, value)}
                        />
                    )}
                </div>
            </div>
        </section>
    );
}
```

- [ ] **Step 7: Editor zusammensetzen (ohne Vorschau, die kommt in Task 6)**

`resources/js/templates/editor/template-editor.tsx`:

```tsx
import { router } from '@inertiajs/react';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { mutate } from 'swr';
import { keys } from '@/api/keys';
import { duplicateTemplate, saveTemplateFiles, type TemplateDetail } from '@/api/templates';
import type { CodeEditorHandle } from '@/components/code-editor';
import { ApiError, errorMessage } from '@/lib/api';
import { useLeaveGuard } from '@/lib/hooks';
import { path, t } from '@/lib/i18n';
import { useStoredFlag } from '@/lib/prefs';
import { toast } from '@/lib/toast';
import type { LineError } from '../diagnostics';
import { editorReducer, initEditor, isDirty, savePayload, type Part } from '../editor-state';
import { CodePane } from './code-pane';
import { EditorHeader } from './editor-header';

const NO_ERRORS: Record<Part, LineError[]> = { header: [], body: [], footer: [], css: [], manifest: [] };

/** Template editor: header, (Task 6: field bar), code, (Task 6: preview). Keyed by template id in the page. */
export function TemplateEditor({ template }: { template: TemplateDetail }) {
    const [state, dispatch] = useReducer(editorReducer, template, initEditor);
    const [saving, setSaving] = useState(false);
    const [duplicating, setDuplicating] = useState(false);
    const [manifestViolations, setManifestViolations] = useState<string[]>([]);
    const [fieldsOpen, setFieldsOpen] = useStoredFlag('openbill:template-fields', true);
    const editorRef = useRef<CodeEditorHandle>(null);
    const readOnly = template.built_in;
    const dirty = !readOnly && isDirty(state);
    const releaseGuard = useLeaveGuard(dirty, t('templates.leave_confirm'));
    const errors = NO_ERRORS; // Task 6: from the render answer

    const save = useCallback(async (): Promise<boolean> => {
        const payload = savePayload(state);
        if (!payload) {
            dispatch({ type: 'part', part: 'manifest' });
            toast.error(t('templates.manifest_fix_first'));
            return false;
        }
        setSaving(true);
        try {
            const saved = await saveTemplateFiles(template.id, payload);
            dispatch({ type: 'saved', template: saved });
            setManifestViolations([]);
            void mutate(keys.template(template.id), saved, { revalidate: false });
            toast.success(t('templates.saved'));
            return true;
        } catch (error) {
            const manifest = error instanceof ApiError ? error.violations.filter((v) => v.path === 'manifest' || v.path.startsWith('manifest.')) : [];
            if (manifest.length > 0) {
                setManifestViolations(manifest.map((v) => `${v.path.replace(/^manifest\.?/, '') || 'manifest'}: ${v.message}`));
                dispatch({ type: 'part', part: 'manifest' });
            }
            toast.error(errorMessage(error));
            return false;
        } finally {
            setSaving(false);
        }
    }, [state, template.id]);

    const duplicate = async () => {
        setDuplicating(true);
        try {
            const copy = await duplicateTemplate(template.id);
            toast.success(t('templates.duplicated', { name: copy.name }));
            releaseGuard();
            router.visit(path(`/templates/${copy.id}`));
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setDuplicating(false);
        }
    };

    // ⌘S / Ctrl+S saves (also inside CodeMirror: the event bubbles up)
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
                event.preventDefault();
                if (!readOnly && dirty && !saving) void save();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [readOnly, dirty, saving, save]);

    const layout = useMemo(() => (fieldsOpen ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]' : 'lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]'), [fieldsOpen]);

    return (
        <div className="grid grid-rows-[auto_minmax(0,1fr)] lg:h-[calc(100dvh-1.5rem)]">
            <EditorHeader
                templateId={template.id}
                manifest={state.files.manifest}
                builtIn={readOnly}
                dirty={dirty}
                saving={saving}
                duplicating={duplicating}
                onSave={save}
                onDiscard={() => {
                    dispatch({ type: 'discard' });
                    setManifestViolations([]);
                }}
                onDuplicate={() => void duplicate()}
            />
            <div className={`grid min-h-0 gap-3 px-3 pb-3 ${layout}`}>
                <CodePane
                    state={state}
                    readOnly={readOnly}
                    errors={errors}
                    manifestViolations={manifestViolations}
                    fieldsOpen={fieldsOpen}
                    editorRef={editorRef}
                    onOpenFields={() => setFieldsOpen(true)}
                    onPart={(part) => dispatch({ type: 'part', part })}
                    onEdit={(part, value) => dispatch({ type: 'edit', part, value })}
                    onManifestText={(text) => dispatch({ type: 'manifest_text', text })}
                    onPaper={(patch) => dispatch({ type: 'paper', patch })}
                />
            </div>
        </div>
    );
}
```

(`layout` und `fieldsOpen` bekommen in Task 6 ihre dritte Spalte; bis dahin sind beide Zweige gleich.)

`resources/js/pages/templates/show.tsx` vollständig:

```tsx
import { Head } from '@inertiajs/react';
import { FileQuestion } from 'lucide-react';
import { useTemplate } from '@/api/templates';
import { ButtonLink, EmptyState, ErrorState, Page, Skeleton } from '@/components/ui';
import { appLayout } from '@/layouts/app-shell';
import { ApiError } from '@/lib/api';
import { path, t } from '@/lib/i18n';
import { TemplateEditor } from '@/templates/editor/template-editor';

/** Template editor (/{locale}/templates/{id}): the template from GET /api/templates/{id}. */
export default function TemplatePage({ template_id: id }: { template_id: string }) {
    const { data: template, error, mutate } = useTemplate(id);

    if (error && !template) {
        return (
            <Page>
                <Head title={t('nav.templates')} />
                {error instanceof ApiError && error.status === 404 ? (
                    <EmptyState
                        icon={<FileQuestion />}
                        title={t('templates.not_found')}
                        actions={
                            <ButtonLink href={path('/templates')} variant="primary">
                                {t('templates.back')}
                            </ButtonLink>
                        }
                    />
                ) : (
                    <ErrorState error={error} onRetry={() => void mutate()} />
                )}
            </Page>
        );
    }

    return (
        <>
            <Head title={template ? `${template.name} · ${t('nav.templates')}` : t('nav.templates')} />
            {template ? <TemplateEditor key={template.id} template={template} /> : <EditorSkeleton />}
        </>
    );
}

function EditorSkeleton() {
    return (
        <div className="grid gap-3 p-6" aria-busy="true" aria-label={t('templates.loading_one')}>
            <Skeleton w={220} h={28} />
            <div className="grid gap-3 lg:grid-cols-[15rem_minmax(0,1fr)_minmax(0,0.9fr)]">
                <Skeleton h={520} r={18} />
                <Skeleton h={520} r={18} />
                <Skeleton h={520} r={18} />
            </div>
        </div>
    );
}

TemplatePage.layout = appLayout;
```

- [ ] **Step 8: Übersetzungen**

`lang/en.json`:

```json
"templates.back": "Back to templates",
"templates.by": "by :author",
"templates.discard": "Discard",
"templates.duplicate_to_edit": "Duplicate to customize",
"templates.export": "Export",
"templates.export_unsaved": "Save first: the export contains the saved state.",
"templates.fields_open": "Show field bar",
"templates.hint.body": "template.liquid: the content. It flows over as many pages as needed.",
"templates.hint.css": "styles.css: applies to the content only.",
"templates.hint.footer": "footer.liquid: in the bottom margin of every page. {{ page.number }} and {{ page.total }} are filled in by the PDF renderer.",
"templates.hint.header": "header.liquid: in the top margin of every page. Put its own <style> here, the content's CSS does not apply.",
"templates.hint.manifest": "manifest.json: package details. The paper can also be changed in the form above.",
"templates.leave_confirm": "The template has unsaved changes. Leave anyway?",
"templates.loading_one": "Loading template",
"templates.manifest_fix_first": "The manifest contains an error. Fix it before saving.",
"templates.manifest_invalid": "Invalid manifest:",
"templates.manifest_problem.invalid_json": "This is not valid JSON.",
"templates.manifest_problem.not_object": "The manifest must be a JSON object.",
"templates.not_found": "Template not found",
"templates.paper_footer": "Footer",
"templates.paper_format": "Format",
"templates.paper_header": "Header",
"templates.paper_length_hint": "e.g. 20mm",
"templates.paper_margin": "Margin left/right",
"templates.part.body": "Content",
"templates.part.css": "CSS",
"templates.part.footer": "Footer",
"templates.part.header": "Header",
"templates.part.manifest": "Manifest",
"templates.part_label": "Part of the template",
"templates.read_only": "Built-in, read-only",
"templates.save": "Save",
"templates.save_hint": "Save (⌘S / Ctrl+S)",
"templates.saved": "Template saved",
"templates.source": "Source",
"templates.unnamed": "Untitled",
"templates.unsaved": "Unsaved",
"templates.version": "Version :version"
```

`lang/de.json`:

```json
"templates.back": "Zurück zu den Templates",
"templates.by": "von :author",
"templates.discard": "Verwerfen",
"templates.duplicate_to_edit": "Duplizieren, um es anzupassen",
"templates.export": "Exportieren",
"templates.export_unsaved": "Erst speichern: Der Export enthält den gespeicherten Stand.",
"templates.fields_open": "Feldleiste ausklappen",
"templates.hint.body": "template.liquid: der Inhalt. Er fließt über so viele Seiten wie nötig.",
"templates.hint.css": "styles.css: gilt nur für den Inhalt.",
"templates.hint.footer": "footer.liquid: steht auf jeder Seite im unteren Rand. {{ page.number }} und {{ page.total }} füllt der PDF-Renderer.",
"templates.hint.header": "header.liquid: steht auf jeder Seite im oberen Rand. Eigenes <style> hier hinein, das CSS des Inhalts gilt nicht.",
"templates.hint.manifest": "manifest.json: Angaben zum Paket. Das Papierformat lässt sich auch oben im Formular ändern.",
"templates.leave_confirm": "Das Template hat ungespeicherte Änderungen. Trotzdem verlassen?",
"templates.loading_one": "Template wird geladen",
"templates.manifest_fix_first": "Das Manifest enthält einen Fehler. Korrigiere es vor dem Speichern.",
"templates.manifest_invalid": "Ungültiges Manifest:",
"templates.manifest_problem.invalid_json": "Das ist kein gültiges JSON.",
"templates.manifest_problem.not_object": "Das Manifest muss ein JSON-Objekt sein.",
"templates.not_found": "Template nicht gefunden",
"templates.paper_footer": "Fußzeile",
"templates.paper_format": "Format",
"templates.paper_header": "Kopfzeile",
"templates.paper_length_hint": "z. B. 20mm",
"templates.paper_margin": "Rand links/rechts",
"templates.part.body": "Inhalt",
"templates.part.css": "CSS",
"templates.part.footer": "Fußzeile",
"templates.part.header": "Kopfzeile",
"templates.part.manifest": "Manifest",
"templates.part_label": "Teil des Templates",
"templates.read_only": "Mitgeliefert, schreibgeschützt",
"templates.save": "Speichern",
"templates.save_hint": "Speichern (⌘S / Strg+S)",
"templates.saved": "Template gespeichert",
"templates.source": "Quelltext",
"templates.unnamed": "Ohne Namen",
"templates.unsaved": "Ungespeichert",
"templates.version": "Version :version"
```

`{{ page.number }}` in den Texten ist unkritisch: `t()` ersetzt nur übergebene `:name`-Platzhalter.

- [ ] **Step 9: Prüfen**

Run: `ddev exec pnpm typecheck && ddev exec pnpm test && ddev artisan test --filter='TranslationsTest|SetupPagesTest'`
Expected: PASS.

Manuell: Klar öffnen → schreibgeschützt (CodeMirror nimmt keine Eingaben, Knopf „Duplizieren, um es anzupassen“ führt zur Kopie); in der Kopie tippen → „Ungespeichert“, ⌘S speichert, Seite neu laden zeigt den Stand; Manifest-Tab: Rand auf `25mm` → JSON ändert sich mit; JSON kaputt machen → Hinweis, Speichern zeigt Toast und bleibt auf dem Tab; Seite mit ungespeicherter Änderung verlassen → Rückfrage.

- [ ] **Step 10: Commit**

```bash
git add resources/js lang
git commit -m "feat: template editor with CodeMirror tabs, paper form, save, export and read-only built-ins" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 6: Template-Editor II – Live-Vorschau, Beispieldaten, Fehler, Feldleiste

**Files:**
- Create: `resources/js/templates/errors.ts`, `resources/js/templates/errors.test.ts`
- Modify: `resources/js/templates/scenario.ts`, `resources/js/templates/scenario.test.ts`
- Create: `resources/js/fields/expression.ts`, `resources/js/fields/expression.test.ts`
- Create: `resources/js/templates/editor/use-template-preview.ts`, `resources/js/templates/editor/preview-pane.tsx`, `resources/js/templates/editor/sample-picker.tsx`, `resources/js/templates/editor/field-sidebar.tsx`
- Modify: `resources/js/templates/editor/template-editor.tsx`
- Modify: `lang/en.json`, `lang/de.json`

**Interfaces:**
- Consumes: `renderTemplate`, `useRenderSources`, `useRenderSchema`, `RenderSchema`, `TemplateManifest` (Task 3); `createLatest`, `isAbort` (`resources/js/editor/latest.ts`); `useDebounced` (`lib/hooks.ts`); `PagedPreview` mit `lazy`/`highlight`; `CodeEditorHandle.insert/goToLine` (Task 4); `EditorState`, `zoneOf`, `Part` (Task 5).
- Produces:
  - `errors.ts`: `errorsByPart(errors: RenderErrorItem[]): Record<Part, LineError[]>`, `errorLabel(error: RenderErrorItem): string`, `missingExpectedFields(manifest: TemplateManifest, schema: RenderSchema): ExpectedField[]`
  - `scenario.ts` (zusätzlich): `type SampleSource = { kind: 'scenario'; key: string } | { kind: 'document'; id: string }`, `sourceValue(source: SampleSource): string`, `parseSource(value: string): SampleSource | null`, `defaultSource(sources: RenderSources): SampleSource`
  - `fields/expression.ts`: `liquidPath(scope: FieldScope, key: string): string`, `expression(scope: FieldScope, key: string, type?: FieldType): string`, `SNIPPETS: { key: 'groups' | 'page_numbers'; code: string }[]`
  - `useTemplatePreview(templateId: string, files: TemplateFiles, source: SampleSource | null): SWRResponse<RenderResponse>`
  - Übersetzungen `fields.scope.<scope>` und `fields.type.<type>` (Task 8 nutzt sie mit)

- [ ] **Step 1: Failing Tests**

`resources/js/templates/errors.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { RenderSchema } from '@/api/templates';
import { errorLabel, errorsByPart, missingExpectedFields } from './errors';

describe('errorsByPart', () => {
    it('sorts render errors into the tabs and leaves document texts out', () => {
        const byPart = errorsByPart([
            { part: 'body', file: 'template.liquid', line: 12, message: 'Unknown filter "moneys"' },
            { part: 'header', file: 'header.liquid', line: null, message: 'Output too large' },
            { part: 'intro', file: null, line: 1, message: 'Unclosed tag' },
            { part: 'manifest', file: 'manifest.json', line: null, message: 'paper.marginX is invalid' },
        ]);

        expect(byPart.body).toEqual([{ line: 12, message: 'Unknown filter "moneys"' }]);
        expect(byPart.header).toEqual([{ line: null, message: 'Output too large' }]);
        expect(byPart.manifest).toHaveLength(1);
        expect(byPart.footer).toEqual([]);
        expect(byPart.css).toEqual([]);
    });
});

describe('errorLabel', () => {
    it('names file and line, or the part', () => {
        expect(errorLabel({ part: 'body', file: 'template.liquid', line: 12, message: '' })).toBe('template.liquid:12');
        expect(errorLabel({ part: 'intro', file: null, line: null, message: '' })).toBe('intro');
    });
});

describe('missingExpectedFields', () => {
    const schema = {
        levels: {
            org: { context: 'org', core: ['name'], custom: [] },
            customer: { context: 'customer', core: ['name'], custom: [] },
            contact: { context: 'contact', core: [], custom: [] },
            document: { context: 'document', core: ['number'], custom: [{ key: 'project_name', label: 'Project', type: 'text', required: false, options: [], doc_types: ['invoice'] }] },
            position: { context: 'positions[]', core: ['title'], custom: [] },
        },
    } as RenderSchema;

    it('lists expected fields that are neither core nor custom fields', () => {
        const manifest = {
            name: 'Fjord',
            version: '1.0.0',
            expectedFields: [
                { scope: 'document' as const, key: 'project_name', type: 'text' as const },
                { scope: 'document' as const, key: 'number', type: 'text' as const },
                { scope: 'position' as const, key: 'ticket', type: 'text' as const },
            ],
        };

        expect(missingExpectedFields(manifest, schema)).toEqual([{ scope: 'position', key: 'ticket', type: 'text' }]);
        expect(missingExpectedFields({ name: 'A', version: '1.0.0' }, schema)).toEqual([]);
    });
});
```

In `resources/js/templates/scenario.test.ts` ergänzen (Import erweitern):

```ts
describe('sample sources', () => {
    const sources = {
        scenarios: [
            { key: 'short_invoice', document_type: 'invoice' as const },
            { key: 'long_invoice', document_type: 'invoice' as const },
        ],
        documents: [{ id: '01k9', type: 'invoice' as const, status: 'draft' as const, number: null, date: '2026-10-12', customer_name: 'Hafenkontor Lindqvist GmbH', locale: 'de' }],
    };

    it('round-trips the select value', () => {
        expect(parseSource(sourceValue({ kind: 'scenario', key: 'long_invoice' }))).toEqual({ kind: 'scenario', key: 'long_invoice' });
        expect(parseSource(sourceValue({ kind: 'document', id: '01k9' }))).toEqual({ kind: 'document', id: '01k9' });
        expect(parseSource('nonsense')).toBeNull();
    });

    it('starts with the most recently edited document, else the long invoice', () => {
        expect(defaultSource(sources)).toEqual({ kind: 'document', id: '01k9' });
        expect(defaultSource({ ...sources, documents: [] })).toEqual({ kind: 'scenario', key: 'long_invoice' });
    });
});
```

`resources/js/fields/expression.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { expression, liquidPath } from './expression';

describe('expression', () => {
    it('uses p inside the position loop', () => {
        expect(liquidPath('position', 'ticket')).toBe('p.ticket');
        expect(liquidPath('document', 'number')).toBe('document.number');
    });

    it('adds the matching filter for core fields and custom field types', () => {
        expect(expression('document', 'gross_total')).toBe('{{ document.gross_total | money }}');
        expect(expression('document', 'due_date')).toBe('{{ document.due_date | date }}');
        expect(expression('document', 'intro')).toBe('{{ document.intro | nl2br }}');
        expect(expression('position', 'quantity')).toBe('{{ p.quantity | number: 2 }}');
        expect(expression('document', 'project_name', 'text')).toBe('{{ document.project_name }}');
        expect(expression('customer', 'budget', 'money')).toBe('{{ customer.budget | money }}');
        expect(expression('position', 'month', 'date')).toBe('{{ p.month | date }}');
        expect(expression('contact', 'note', 'textarea')).toBe('{{ contact.note | nl2br }}');
        expect(expression('position', 'hours', 'number')).toBe('{{ p.hours | number: 2 }}');
    });

    it('wraps images and yes/no fields', () => {
        expect(expression('document', 'stamp', 'image')).toBe('{% if document.stamp != blank %}<img src="{{ document.stamp }}" alt="">{% endif %}');
        expect(expression('org', 'logo')).toBe('{% if org.logo != blank %}<img src="{{ org.logo }}" alt="">{% endif %}');
        expect(expression('document', 'urgent', 'boolean')).toBe('{% if document.urgent %}{% endif %}');
    });

    it('turns lists into loops', () => {
        expect(expression('document', 'legal_notes')).toBe('{% for note in document.legal_notes %}<p>{{ note }}</p>{% endfor %}');
        expect(expression('document', 'tax_breakdown')).toContain('{% for t in document.tax_breakdown %}');
    });
});
```

Run: `ddev exec pnpm test -- resources/js/templates resources/js/fields`
Expected: FAIL (Module fehlen).

- [ ] **Step 2: `errors.ts`, Quellen und Ausdrücke implementieren**

`resources/js/templates/errors.ts`:

```ts
import type { ExpectedField, RenderSchema, TemplateManifest } from '@/api/templates';
import type { RenderErrorItem } from '@/api/types';
import type { LineError } from './diagnostics';
import { PARTS, type Part } from './editor-state';

/** Errors of POST /api/render per editor tab; intro/closing errors come from the document and stay in the list only. */
export function errorsByPart(errors: RenderErrorItem[]): Record<Part, LineError[]> {
    const byPart = Object.fromEntries(PARTS.map((part) => [part, [] as LineError[]])) as Record<Part, LineError[]>;
    for (const error of errors) {
        if ((PARTS as string[]).includes(error.part)) byPart[error.part as Part].push({ line: error.line, message: error.message });
    }
    return byPart;
}

export function errorLabel(error: RenderErrorItem): string {
    const where = error.file ?? error.part;
    return error.line ? `${where}:${error.line}` : where;
}

/** manifest.expectedFields that are neither a core field nor a custom field of their level (they stay empty). */
export function missingExpectedFields(manifest: TemplateManifest, schema: RenderSchema): ExpectedField[] {
    return (manifest.expectedFields ?? []).filter((field) => {
        const level = schema.levels[field.scope];
        return level !== undefined && !level.core.includes(field.key) && !level.custom.some((custom) => custom.key === field.key);
    });
}
```

`resources/js/templates/scenario.ts` ergänzen:

```ts
import type { RenderSources } from '@/api/templates';

export type SampleSource = { kind: 'scenario'; key: string } | { kind: 'document'; id: string };

export const sourceValue = (source: SampleSource): string => (source.kind === 'scenario' ? `scenario:${source.key}` : `document:${source.id}`);

export function parseSource(value: string): SampleSource | null {
    const [kind, ...rest] = value.split(':');
    const id = rest.join(':');
    if (!id) return null;
    if (kind === 'scenario') return { kind, key: id };
    if (kind === 'document') return { kind, id };
    return null;
}

/** The most recently edited document (sources come newest first), without documents the long sample invoice. */
export function defaultSource(sources: RenderSources): SampleSource {
    const [latest] = sources.documents;
    return latest ? { kind: 'document', id: latest.id } : { kind: 'scenario', key: 'long_invoice' };
}
```

`resources/js/fields/expression.ts`:

```ts
import type { FieldScope, FieldType } from '@/api/types';

const MONEY = new Set(['net_total', 'tax_total', 'gross_total', 'optional_total', 'unit_price', 'total']);
const DATES = new Set(['date', 'due_date', 'valid_until', 'service_date', 'service_date_end']);
const TEXTS = new Set(['intro', 'closing']);

/** Where a field lives in Liquid; positions are read inside {% for p in … %}. */
export function liquidPath(scope: FieldScope, key: string): string {
    return `${scope === 'position' ? 'p' : scope}.${key}`;
}

/** Liquid expression with the fitting filter, inserted by the field bar of the template editor. */
export function expression(scope: FieldScope, key: string, type?: FieldType): string {
    const path = liquidPath(scope, key);
    if (key === 'legal_notes' && !type) return `{% for note in ${path} %}<p>{{ note }}</p>{% endfor %}`;
    if (key === 'tax_breakdown' && !type) return `{% for t in ${path} %}{{ t.percent }} %: {{ t.tax | money }}{% endfor %}`;
    if (type === 'image' || (!type && scope === 'org' && key === 'logo')) return `{% if ${path} != blank %}<img src="{{ ${path} }}" alt="">{% endif %}`;
    if (type === 'boolean') return `{% if ${path} %}{% endif %}`;
    if (type === 'money' || (!type && MONEY.has(key))) return `{{ ${path} | money }}`;
    if (type === 'date' || (!type && DATES.has(key))) return `{{ ${path} | date }}`;
    if (type === 'textarea' || (!type && TEXTS.has(key))) return `{{ ${path} | nl2br }}`;
    if (type === 'number' || (!type && key === 'quantity')) return `{{ ${path} | number: 2 }}`;
    return `{{ ${path} }}`;
}

export const SNIPPETS: { key: 'groups' | 'page_numbers'; code: string }[] = [
    {
        key: 'groups',
        code: '{% for g in groups %}\n  {% if g.has_title %}<h3>{{ g.title }}</h3>{% endif %}\n  {% for p in g.positions %}\n    {{ p.title }} {{ p.total | money }}\n  {% endfor %}\n  {% if g.has_title %}{{ g.total | money }}{% endif %}\n{% endfor %}',
    },
    { key: 'page_numbers', code: '{{ page.number }} / {{ page.total }}' },
];
```

Run: `ddev exec pnpm test -- resources/js/templates resources/js/fields`
Expected: PASS.

- [ ] **Step 3: Vorschau-Hook**

`resources/js/templates/editor/use-template-preview.ts`:

```ts
import { useMemo } from 'react';
import useSWR from 'swr';
import { renderTemplate, type TemplateFiles, type TemplateRenderRequest } from '@/api/templates';
import type { RenderResponse } from '@/api/types';
import { createLatest } from '@/editor/latest';
import { useDebounced } from '@/lib/hooks';
import type { SampleSource } from '../scenario';

/**
 * Live preview of the unsaved template: POST /api/render with template_id + all parts, 250 ms after the last change.
 * A newer request aborts the older one (per editor instance), the last answer stays visible meanwhile.
 */
export function useTemplatePreview(templateId: string, files: TemplateFiles, source: SampleSource | null) {
    const render = useMemo(() => createLatest((body: TemplateRenderRequest, signal: AbortSignal) => renderTemplate(body, signal)), []);
    const body = source
        ? JSON.stringify({ template_id: templateId, template: files, ...(source.kind === 'scenario' ? { scenario: source.key } : { document_id: source.id }) })
        : null;
    const debounced = useDebounced(body, 250);

    return useSWR<RenderResponse>(debounced ? ['/api/render', 'template', debounced] : null, ([, , json]: [string, string, string]) => render(JSON.parse(json) as TemplateRenderRequest), {
        keepPreviousData: true,
        revalidateOnFocus: false,
        revalidateIfStale: false,
        shouldRetryOnError: false,
    });
}
```

- [ ] **Step 4: Beispieldaten-Auswahl**

`resources/js/templates/editor/sample-picker.tsx`:

```tsx
import type { RenderSources } from '@/api/templates';
import { SelectControl } from '@/components/ui';
import { t } from '@/lib/i18n';
import { parseSource, sourceValue, type SampleSource } from '../scenario';

export function SamplePicker({ sources, value, onChange }: { sources: RenderSources; value: SampleSource; onChange(source: SampleSource): void }) {
    return (
        <label className="flex min-w-0 items-center gap-2 text-sm text-muted">
            <span className="whitespace-nowrap">{t('templates.sample')}</span>
            <SelectControl
                className="w-[16rem] max-w-full"
                value={sourceValue(value)}
                onChange={(e) => {
                    const source = parseSource(e.target.value);
                    if (source) onChange(source);
                }}
            >
                <optgroup label={t('templates.sample_scenarios')}>
                    {sources.scenarios.map((scenario) => (
                        <option key={scenario.key} value={sourceValue({ kind: 'scenario', key: scenario.key })}>
                            {t(`scenario.${scenario.key}`)}
                        </option>
                    ))}
                </optgroup>
                {sources.documents.length > 0 && (
                    <optgroup label={t('templates.sample_documents')}>
                        {sources.documents.map((document) => (
                            <option key={document.id} value={sourceValue({ kind: 'document', id: document.id })}>
                                {`${t(`document_type.${document.type}`)} ${document.number ?? t('templates.sample_draft')} · ${document.customer_name ?? '–'}`}
                            </option>
                        ))}
                    </optgroup>
                )}
            </SelectControl>
        </label>
    );
}
```

`SelectControl` legt `className` auf die Hülle (`<span>`), das `<select>` selbst trägt `h-control` und `bg-surface-2` – deshalb hier nur Breite an der Hülle, keine Höhe/Farbe (geprüft in `resources/js/components/ui/form.tsx`).

- [ ] **Step 5: Vorschau-Bereich**

`resources/js/templates/editor/preview-pane.tsx`:

```tsx
import { Link } from '@inertiajs/react';
import { PagedPreview } from '@openbill/paged-preview';
import { AlertTriangle, Frame } from 'lucide-react';
import { useState } from 'react';
import type { ExpectedField, RenderSources } from '@/api/templates';
import type { RenderErrorItem, RenderResponse } from '@/api/types';
import { Notice, PillButton, Skeleton } from '@/components/ui';
import { isAbort } from '@/editor/latest';
import { path, t, tn } from '@/lib/i18n';
import { useStoredFlag } from '@/lib/prefs';
import { errorLabel } from '../errors';
import type { SampleSource } from '../scenario';
import { SamplePicker } from './sample-picker';

type Props = {
    data: RenderResponse | undefined;
    error: unknown;
    highlight: 'header' | 'body' | 'footer' | null;
    sources: RenderSources | undefined;
    source: SampleSource | null;
    missing: ExpectedField[];
    onSource(source: SampleSource): void;
    onJump(error: RenderErrorItem): void;
};

export function PreviewPane({ data, error, highlight, sources, source, missing, onSource, onJump }: Props) {
    const [guides, setGuides] = useStoredFlag('openbill:template-guides', false);
    const [pages, setPages] = useState(1);
    const broken = !!error && !isAbort(error);

    return (
        <section aria-label={t('templates.preview')} className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg bg-surface-2">
            <div className="flex flex-wrap items-center gap-2 p-3">
                <span className="pl-2 text-sm font-strong">{t('templates.preview')}</span>
                <span className="num text-xs text-muted">{tn('editor.pages', pages)}</span>
                <span className="flex-1" />
                {sources && source && <SamplePicker sources={sources} value={source} onChange={onSource} />}
                <PillButton pressed={guides} onClick={() => setGuides(!guides)} title={t('editor.guides_title')}>
                    <Frame aria-hidden className="size-3.5" />
                    {t('editor.guides')}
                </PillButton>
            </div>
            <div className="grid content-start gap-3 overflow-auto px-5 pb-5">
                {missing.length > 0 && (
                    <Notice tone="warn" icon={<AlertTriangle />}>
                        <b>{t('templates.missing_fields')}</b> {missing.map((field) => `${field.scope}.${field.key}`).join(', ')}.{' '}
                        <Link href={path(`/fields?scope=${missing[0].scope}`)}>{t('templates.missing_fields_link')}</Link>
                    </Notice>
                )}
                {data && data.errors.length > 0 && (
                    <Notice tone="bad" icon={<AlertTriangle />}>
                        <b>{t('templates.render_errors')}</b>
                        <ul className="m-0 mt-1 grid list-none gap-0.5 p-0" aria-live="polite">
                            {data.errors.map((item, i) => (
                                <li key={`${item.part}:${item.line}:${i}`}>
                                    <button type="button" className="text-left underline-offset-2 hover:underline" onClick={() => onJump(item)}>
                                        <code className="font-mono text-xs">{errorLabel(item)}</code> – {item.message}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </Notice>
                )}
                {broken && <Notice tone="bad">{data ? t('editor.preview_stale') : t('editor.preview_failed')}</Notice>}
                {data ? (
                    <PagedPreview
                        parts={data}
                        paper={data.paper}
                        lazy
                        highlight={highlight}
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
                    !broken && <Skeleton h={520} r={4} />
                )}
            </div>
        </section>
    );
}
```

`PillButton` nimmt laut `tabs.tsx` `pressed` und normale Button-Props – passt.

- [ ] **Step 6: Feldleiste**

`resources/js/templates/editor/field-sidebar.tsx`:

```tsx
import { PanelLeftClose } from 'lucide-react';
import type { RenderSchema } from '@/api/templates';
import type { FieldScope } from '@/api/types';
import { Button, Skeleton, cx } from '@/components/ui';
import { expression, liquidPath, SNIPPETS } from '@/fields/expression';
import { t } from '@/lib/i18n';

const SCOPES: FieldScope[] = ['org', 'customer', 'contact', 'document', 'position'];
const ITEM = 'grid w-full grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2 gap-y-0.5 rounded-sm px-2 py-1.5 text-left text-sm text-ink transition-colors enabled:hover:bg-bg disabled:cursor-default';

/** "Available fields": core and custom fields per level; a click inserts the expression at the cursor. */
export function FieldSidebar({ schema, disabledReason, onInsert, onClose }: { schema: RenderSchema | undefined; disabledReason: string | null; onInsert(code: string): void; onClose(): void }) {
    const disabled = disabledReason !== null;

    return (
        <section aria-label={t('templates.fields')} className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg bg-surface-2">
            <div className="flex items-center gap-2 p-3">
                <span className="pl-2 text-sm font-strong">{t('templates.fields')}</span>
                <span className="flex-1" />
                <Button size="sm" variant="ghost" iconOnly icon={<PanelLeftClose />} onClick={onClose}>
                    {t('templates.fields_close')}
                </Button>
            </div>
            <div className="grid max-h-80 content-start gap-4 overflow-auto px-3 pb-4 lg:max-h-none">
                {disabledReason && <p className="px-2 text-xs text-muted">{disabledReason}</p>}
                {!schema ? (
                    <Skeleton h={240} />
                ) : (
                    SCOPES.map((scope) => {
                        const level = schema.levels[scope];
                        return (
                            <div key={scope} className="grid gap-0.5">
                                <div className="flex items-baseline gap-2 px-2 pb-1 text-sm font-strong">
                                    {t(`fields.scope.${scope}`)}
                                    <code className="rounded-sm bg-bg px-1 font-mono text-xs font-normal text-muted">{level.context}</code>
                                </div>
                                {level.custom.map((field) => (
                                    <button key={field.key} type="button" disabled={disabled} className={ITEM} onClick={() => onInsert(expression(scope, field.key, field.type))} title={expression(scope, field.key, field.type)}>
                                        <span className="min-w-0 truncate after:ml-1.5 after:inline-block after:size-1.5 after:rounded-full after:bg-accent after:align-middle after:content-['']">{field.label}</span>
                                        <span className="text-xs text-muted">{t(`fields.type.${field.type}`)}</span>
                                        <span className="col-span-2 truncate font-mono text-[11px] text-muted">{liquidPath(scope, field.key)}</span>
                                    </button>
                                ))}
                                {level.core.map((key) => (
                                    <button key={key} type="button" disabled={disabled} className={cx(ITEM, 'py-1')} onClick={() => onInsert(expression(scope, key))} title={expression(scope, key)}>
                                        <span className="col-span-2 truncate font-mono text-xs">{liquidPath(scope, key)}</span>
                                    </button>
                                ))}
                            </div>
                        );
                    })
                )}
                <div className="grid gap-2 rounded-md bg-bg p-3 text-xs text-muted">
                    <span>{t('templates.snippets')}</span>
                    {SNIPPETS.map((snippet) => (
                        <button key={snippet.key} type="button" disabled={disabled} className="justify-self-start text-left font-mono text-ink enabled:hover:text-accent" onClick={() => onInsert(snippet.code)} title={snippet.code}>
                            {t(`templates.snippet.${snippet.key}`)}
                        </button>
                    ))}
                    <span>{t('templates.filters_hint')}</span>
                    <span>{t('templates.custom_dot_hint')}</span>
                </div>
            </div>
        </section>
    );
}
```

- [ ] **Step 7: Editor verdrahten**

In `resources/js/templates/editor/template-editor.tsx`:

1. Imports ergänzen:

```tsx
import { useRenderSchema, useRenderSources } from '@/api/templates';
import type { RenderErrorItem } from '@/api/types';
import { errorsByPart, missingExpectedFields } from '../errors';
import { defaultSource, type SampleSource } from '../scenario';
import { FieldSidebar } from './field-sidebar';
import { PreviewPane } from './preview-pane';
import { useTemplatePreview } from './use-template-preview';
```

`zoneOf` in den vorhandenen Import aus `'../editor-state'` aufnehmen und `NO_ERRORS` samt `const errors = NO_ERRORS;` entfernen (`LineError`-Import dann ebenfalls).

2. Nach den State-Hooks:

```tsx
    const sources = useRenderSources();
    const schema = useRenderSchema();
    const [picked, setPicked] = useState<SampleSource | null>(null);
    const source = picked ?? (sources.data ? defaultSource(sources.data) : null);
    const preview = useTemplatePreview(template.id, state.files, source);
    const errors = useMemo(() => errorsByPart(preview.data?.errors ?? []), [preview.data?.errors]);
    const missing = useMemo(() => (schema.data ? missingExpectedFields(state.files.manifest, schema.data) : []), [schema.data, state.files.manifest]);
    const liquidPart = state.part === 'header' || state.part === 'body' || state.part === 'footer';
    const insertDisabled = readOnly ? t('templates.insert_read_only') : !liquidPart ? t('templates.insert_liquid_only') : null;

    const jump = (item: RenderErrorItem) => {
        if (item.part !== 'header' && item.part !== 'body' && item.part !== 'footer' && item.part !== 'css' && item.part !== 'manifest') return;
        dispatch({ type: 'part', part: item.part });
        // the tab's editor mounts in the next frame
        requestAnimationFrame(() => item.line && editorRef.current?.goToLine(item.line));
    };
```

3. `layout` ersetzen durch:

```tsx
    const layout = fieldsOpen
        ? 'lg:grid-cols-[12rem_minmax(0,1fr)_minmax(0,0.8fr)] xl:grid-cols-[15rem_minmax(0,1fr)_minmax(0,0.9fr)]'
        : 'lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]';
```

(`xl` = 80rem ist in `resources/css/app.css` als `--breakpoint-xl` definiert.)

4. Im Raster vor `<CodePane …/>`:

```tsx
                {fieldsOpen && <FieldSidebar schema={schema.data} disabledReason={insertDisabled} onInsert={(code) => editorRef.current?.insert(code)} onClose={() => setFieldsOpen(false)} />}
```

und nach `<CodePane …/>`:

```tsx
                <PreviewPane
                    data={preview.data}
                    error={preview.error}
                    highlight={zoneOf(state.part)}
                    sources={sources.data}
                    source={source}
                    missing={missing}
                    onSource={setPicked}
                    onJump={jump}
                />
```

- [ ] **Step 8: Übersetzungen**

`lang/en.json`:

```json
"fields.scope.contact": "Contact",
"fields.scope.customer": "Customer",
"fields.scope.document": "Document",
"fields.scope.org": "Organization",
"fields.scope.position": "Position",
"fields.type.boolean": "Yes/no",
"fields.type.date": "Date",
"fields.type.image": "Image",
"fields.type.money": "Amount",
"fields.type.number": "Number",
"fields.type.select": "Selection",
"fields.type.text": "Text",
"fields.type.textarea": "Long text",
"scenario.long_invoice": "Long invoice (several pages, groups)",
"scenario.offer_with_options": "Quote with optional positions",
"scenario.reverse_charge": "Invoice with reverse charge",
"scenario.short_invoice": "Short invoice",
"scenario.small_business": "Invoice of a small business",
"templates.custom_dot_hint": "A dot marks custom fields.",
"templates.fields": "Available fields",
"templates.fields_close": "Hide field bar",
"templates.filters_hint": "Filters: money, date, number: 2, nl2br. Positions run through {% for g in groups %} and inside {% for p in g.positions %}.",
"templates.insert_liquid_only": "Fields can be inserted into header, content and footer.",
"templates.insert_read_only": "Built-in templates are read-only.",
"templates.missing_fields": "Expected fields are missing:",
"templates.missing_fields_link": "Add them under custom fields. Until then they stay empty.",
"templates.preview": "Preview",
"templates.render_errors": "Template errors",
"templates.sample": "Sample data",
"templates.sample_documents": "Documents",
"templates.sample_draft": "(draft)",
"templates.sample_scenarios": "Samples",
"templates.snippet.groups": "Positions by groups",
"templates.snippet.page_numbers": "Page numbers",
"templates.snippets": "Snippets"
```

`lang/de.json`:

```json
"fields.scope.contact": "Ansprechpartner",
"fields.scope.customer": "Kunde",
"fields.scope.document": "Dokument",
"fields.scope.org": "Organisation",
"fields.scope.position": "Position",
"fields.type.boolean": "Ja/Nein",
"fields.type.date": "Datum",
"fields.type.image": "Bild",
"fields.type.money": "Betrag",
"fields.type.number": "Zahl",
"fields.type.select": "Auswahl",
"fields.type.text": "Text",
"fields.type.textarea": "Langer Text",
"scenario.long_invoice": "Lange Rechnung (mehrseitig, Gruppen)",
"scenario.offer_with_options": "Angebot mit optionalen Positionen",
"scenario.reverse_charge": "Rechnung mit Reverse Charge",
"scenario.short_invoice": "Kurze Rechnung",
"scenario.small_business": "Rechnung als Kleinunternehmer",
"templates.custom_dot_hint": "Ein Punkt markiert eigene Felder.",
"templates.fields": "Verfügbare Felder",
"templates.fields_close": "Feldleiste einklappen",
"templates.filters_hint": "Filter: money, date, number: 2, nl2br. Positionen laufen über {% for g in groups %} und darin {% for p in g.positions %}.",
"templates.insert_liquid_only": "Felder lassen sich in Kopfzeile, Inhalt und Fußzeile einfügen.",
"templates.insert_read_only": "Mitgelieferte Templates sind schreibgeschützt.",
"templates.missing_fields": "Erwartete Felder fehlen:",
"templates.missing_fields_link": "Lege sie unter „Eigene Felder“ an. Bis dahin bleiben sie leer.",
"templates.preview": "Vorschau",
"templates.render_errors": "Template-Fehler",
"templates.sample": "Beispieldaten",
"templates.sample_documents": "Dokumente",
"templates.sample_draft": "(Entwurf)",
"templates.sample_scenarios": "Beispiele",
"templates.snippet.groups": "Positionen nach Gruppen",
"templates.snippet.page_numbers": "Seitenzahl",
"templates.snippets": "Bausteine"
```

- [ ] **Step 9: Prüfen**

Run: `ddev exec pnpm typecheck && ddev exec pnpm test && ddev artisan test --filter=TranslationsTest`
Expected: PASS.

Manuell (Kopie von Klar): Vorschau erscheint, Tab „Kopfzeile“ hebt die Kopfzeile hervor; im Inhalt `{{ document.number | moneys }}` tippen → nach ~250 ms Meldung „template.liquid:<Zeile> – …“, Zeile im Code rot unterwellt, Klick auf die Meldung setzt den Cursor; Feld „Projekt“ in der Feldleiste klicken → `{{ document.project_name }}` an der Cursorposition; Beispieldaten auf „Lange Rechnung“ → mehrere Seiten, im Netzwerk-Tab keine Iframe-Last für Seiten außerhalb des Sichtbereichs (Elemente-Tab: `pp-page--pending` bis zum Scrollen).

- [ ] **Step 10: Commit**

```bash
git add resources/js lang
git commit -m "feat: template editor live preview with zones, sample data, error markers and field bar" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 7: Felder-Backend – Reihenfolge, Bild-Uploads, Bildfelder im Template

**Files:**
- Create: `app/Domain/Fields/ImagePath.php`
- Modify: `app/Domain/Fields/CustomValueValidator.php`
- Create: `app/Support/StoredImage.php`
- Create: `app/Actions/StoreUpload.php`, `app/Actions/ReadUpload.php`, `app/Actions/ReorderFieldDefinitions.php`
- Create: `app/Http/Controllers/Api/UploadController.php`, `app/Http/Controllers/Api/FieldOrderController.php`
- Modify: `routes/api.php`, `app/OpenApi/OpenApiFactory.php`
- Modify: `app/Rendering/AssetInliner.php`, `app/Rendering/ContextBuilder.php`
- Modify: `lang/en.json`, `lang/de.json`
- Test: `tests/Unit/Domain/CustomValueValidatorTest.php`, `tests/Feature/Api/UploadApiTest.php`, `tests/Feature/Actions/ReorderFieldDefinitionsTest.php`, `tests/Feature/Rendering/ImageFieldContextTest.php`, `tests/Feature/Api/RightsMatrixTest.php`, `tests/Feature/Api/OpenApiTest.php`

**Interfaces:**
- Consumes: `TemplatePackage::assetProblem/mimeOf`, `DownloadFile`, `FileResponse::download`, `ApiJson::ok`, `CurrentActor::from`.
- Produces: `ImagePath::PATTERN` / `ImagePath::isValid(string): bool`; `StoredImage::EXTENSIONS`, `StoredImage::MAX_BYTES`, `StoredImage::validate(UploadedFile $file, string $attribute): array{0: string, 1: string}` (Endung, Inhalt; wirft `ValidationException`), `StoredImage::headers(): array<string, string>`; Actions laut Interfaces; Routen `POST /api/uploads`, `GET /api/uploads/{name}`, `POST /api/field-definitions/reorder`; `AssetInliner::upload(?string $path): string`. Task 8 (Bildfeld-Eingabe) und Task 9 (Logo) nutzen `StoredImage`.

- [ ] **Step 1: Failing Tests schreiben**

In `tests/Unit/Domain/CustomValueValidatorTest.php` ergänzen:

```php
it('accepts only uploaded image paths for image fields (review focus)', function () {
    $image = [new FieldDefinitionData(scope: FieldScope::Document, key: 'stamp', label: 'Stamp', type: FieldType::Image, docTypes: [DocumentType::Invoice])];
    $check = fn (mixed $value) => CustomValueValidator::validate($image, ['stamp' => $value], 'custom.', false);

    expect($check('uploads/01k9x2m3n4p5q6r7s8t9v0w1y2.png')->ok())->toBeTrue()
        ->and($check('uploads/01k9x2m3n4p5q6r7s8t9v0w1y2.svg')->ok())->toBeTrue();
    foreach (['https://example.com/logo.png', '../../.env', 'uploads/01k9x2m3n4p5q6r7s8t9v0w1y2.exe', 'uploads/short.png', 'logos/01k9x2m3n4p5q6r7s8t9v0w1y2.png'] as $bad) {
        expect($check($bad)->errors[0]->code ?? null)->toBe(FieldErrorCode::NotImage, $bad);
    }
});
```

(`FieldError` hat `path`, `code`, `params` – `app/Domain/Fields/FieldError.php`.)

`tests/Feature/Api/UploadApiTest.php`:

```php
<?php

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

beforeEach(fn () => $this->withToken(apiToken()));

it('stores an image and serves it sandboxed', function () {
    $response = $this->post('/api/uploads', ['file' => UploadedFile::fake()->createWithContent('stamp.png', base64_decode(TINY_PNG))], ['Accept' => 'application/json'])
        ->assertCreated()
        ->assertJsonPath('mime', 'image/png')
        ->assertJsonPath('size', strlen(base64_decode(TINY_PNG)));
    $path = $response->json('path');

    expect($path)->toMatch('#^uploads/[0-9a-z]{26}\.png$#')
        ->and(Storage::disk('local')->get($path))->toBe(base64_decode(TINY_PNG));

    $file = $this->get('/api/'.$path)->assertOk();
    expect($file->headers->get('Content-Type'))->toBe('image/png')
        ->and($file->headers->get('Content-Security-Policy'))->toContain('sandbox')
        ->and($file->headers->get('X-Content-Type-Options'))->toBe('nosniff');
});

it('refuses files that are no images or too large (review focus)', function (string $name, string $contents) {
    $this->post('/api/uploads', ['file' => UploadedFile::fake()->createWithContent($name, $contents)], ['Accept' => 'application/json'])
        ->assertUnprocessable()
        ->assertJsonPath('violations.0.path', 'file');
})->with([
    'program renamed to png' => ['stamp.png', "MZ\x90\x00binary"],
    'pdf' => ['stamp.pdf', '%PDF-1.7'],
    'too large' => ['big.png', base64_decode(TINY_PNG).str_repeat('0', 1024 * 1024)],
]);

it('answers 422 without a file and 404 for unknown or odd names', function () {
    $this->post('/api/uploads', [], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonPath('violations.0.path', 'file');
    $this->get('/api/uploads/01k9x2m3n4p5q6r7s8t9v0w1y2.png')->assertNotFound();
    $this->get('/api/uploads/..%2F.env')->assertNotFound();
});
```

`tests/Feature/Actions/ReorderFieldDefinitionsTest.php`:

```php
<?php

use App\Actions\ReorderFieldDefinitions;
use App\Enums\FieldScope;
use App\Models\FieldDefinition;

it('stores the order of one level and leaves the others alone', function () {
    [$a, $b, $c] = FieldDefinition::factory()->count(3)->sequence(['sort' => 0], ['sort' => 1], ['sort' => 2])->create();
    $org = FieldDefinition::factory()->create(['scope' => FieldScope::Org, 'doc_types' => [], 'sort' => 5]);

    app(ReorderFieldDefinitions::class)->handle(systemActor(), ['scope' => 'document', 'ids' => [$c->id, $a->id, $b->id]]);

    expect(FieldDefinition::query()->where('scope', 'document')->orderBy('sort')->pluck('id')->all())->toBe([$c->id, $a->id, $b->id])
        ->and($org->fresh()->sort)->toBe(5);
});

it('refuses missing, foreign or repeated ids and changes nothing (review focus)', function (Closure $ids) {
    [$a, $b] = FieldDefinition::factory()->count(2)->sequence(['sort' => 0], ['sort' => 1])->create();
    $org = FieldDefinition::factory()->create(['scope' => FieldScope::Org, 'doc_types' => []]);

    $errors = validationErrors(fn () => app(ReorderFieldDefinitions::class)->handle(systemActor(), ['scope' => 'document', 'ids' => $ids($a, $b, $org)]));

    expect(array_keys($errors)[0])->toStartWith('ids')
        ->and(FieldDefinition::query()->where('scope', 'document')->orderBy('sort')->pluck('id')->all())->toBe([$a->id, $b->id]);
})->with([
    'one missing' => [fn ($a, $b, $org) => [$b->id]],
    'foreign level' => [fn ($a, $b, $org) => [$b->id, $a->id, $org->id]],
    'twice' => [fn ($a, $b, $org) => [$b->id, $b->id]],
]);

it('reorders over the API', function () {
    [$a, $b] = FieldDefinition::factory()->count(2)->sequence(['sort' => 0], ['sort' => 1])->create();

    $this->withToken(apiToken())->postJson('/api/field-definitions/reorder', ['scope' => 'document', 'ids' => [$b->id, $a->id]])->assertNoContent();

    expect($a->fresh()->sort)->toBe(1);
});
```

`tests/Feature/Rendering/ImageFieldContextTest.php`:

```php
<?php

use App\Actions\RenderPreview;
use App\Actions\StoreUpload;
use App\Enums\DocumentType;
use App\Enums\FieldScope;
use App\Enums\FieldType;
use App\Models\FieldDefinition;
use Illuminate\Http\UploadedFile;

it('puts uploaded images of image fields into the template as data URL and nothing else (review focus)', function () {
    FieldDefinition::factory()->create(['key' => 'stamp', 'label' => 'Stamp', 'type' => FieldType::Image]);
    FieldDefinition::factory()->create(['scope' => FieldScope::Position, 'key' => 'photo', 'label' => 'Photo', 'type' => FieldType::Image]);
    $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');
    $path = app(StoreUpload::class)->handle(systemActor(), UploadedFile::fake()->createWithContent('stamp.png', $png))['path'];
    $document = draft(DocumentType::Invoice, [itemRow('Workshop', extra: ['custom' => ['photo' => $path]])], ['custom' => ['stamp' => $path]]);

    $body = app(RenderPreview::class)->handle(systemActor(), [
        'document_id' => $document->id,
        'template' => ['body' => '<img id="a" src="{{ document.stamp }}">{% for p in positions %}<img id="b" src="{{ p.photo }}">{% endfor %}'],
    ])->render->body;

    expect($body)->toContain('id="a" src="data:image/png;base64,'.base64_encode($png).'"')
        ->and($body)->toContain('id="b" src="data:image/png;base64,');

    // a value that did not come through the upload (old data, written past the validation) renders empty
    $document->forceFill(['custom' => ['stamp' => 'https://example.com/stamp.png']])->saveQuietly();
    $body = app(RenderPreview::class)->handle(systemActor(), ['document_id' => $document->id, 'template' => ['body' => '<img id="a" src="{{ document.stamp }}">']])->render->body;
    expect($body)->toContain('id="a" src=""');
});
```

`itemRow()` hat die Signatur `itemRow(string $title, string $quantity, string $price, array $extra)` – benannte Argumente wie oben funktionieren in Pest-Dateien.

In `tests/Feature/Api/RightsMatrixTest.php` (`MATRIX_ROUTES`) ergänzen und im Guard-Test den Platzhalter `{upload}` nicht nötig (feste Beispiel-URL):

```php
    'upload image' => ['POST', '/api/uploads', ['api:write']],
    'read upload' => ['GET', '/api/uploads/01k9x2m3n4p5q6r7s8t9v0w1y2.png', MATRIX_READ],
    'reorder fields' => ['POST', '/api/field-definitions/reorder', ['api:write']],
```

Der Guard-Test vergleicht URIs der Routen (`api/uploads/{name}`) mit den Matrix-Pfaden: In der `map`-Funktion des Guard-Tests `preg_replace('#/uploads/[^/]+$#', '/uploads/{name}', …)` auf den Pfad anwenden (nach `str_replace('/document-types/invoice', …)`). „Erlaubt“ heißt dort „nicht 401/403/5xx“ – die 404 für die unbekannte Datei zählt als erlaubt.

In `tests/Feature/Api/OpenApiTest.php` die erwarteten Pfade um `'/api/uploads', '/api/uploads/{name}', '/api/field-definitions/reorder'` ergänzen.

- [ ] **Step 2: Tests laufen lassen**

Run: `ddev artisan test --filter='CustomValueValidatorTest|UploadApiTest|ReorderFieldDefinitionsTest|ImageFieldContextTest|RightsMatrixTest|OpenApiTest'`
Expected: FAIL (Klassen und Routen fehlen; Bildwert-Prüfung zu locker).

- [ ] **Step 3: Domain: `ImagePath` und Validator**

`app/Domain/Fields/ImagePath.php`:

```php
<?php

namespace App\Domain\Fields;

/** Value of an image field: a file stored by POST /api/uploads ("uploads/<ulid>.<ext>"). */
final class ImagePath
{
    public const PATTERN = '#^uploads/[0-9a-z]{26}\.(png|jpg|jpeg|gif|webp|svg)$#';

    public static function isValid(string $value): bool
    {
        return preg_match(self::PATTERN, $value) === 1;
    }
}
```

In `app/Domain/Fields/CustomValueValidator.php` die Konstante `MAX_IMAGE` entfernen und die `Image`-Zeile in `normalize()` ersetzen:

```php
            FieldType::Image => is_string($value) && ImagePath::isValid($value) ? $value : FieldErrorCode::NotImage,
```

Übersetzung `fields.error.not_image` anpassen – en: `":label must be an image uploaded through openbill (POST /api/uploads)."`, de: `":label muss ein über openbill hochgeladenes Bild sein (POST /api/uploads)."`.

Geprüft: Weder Seeder noch Tests setzen bisher Bildwerte; `SampleDataFactory` setzt Bildfelder auf `''` (leer, wird nicht geprüft).

- [ ] **Step 4: `StoredImage`**

`app/Support/StoredImage.php`:

```php
<?php

namespace App\Support;

use App\Rendering\TemplatePackage;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\ValidationException;

/** Images people upload (logo, image fields): type, size and content check, and how they are served. */
final class StoredImage
{
    /** @var list<string> */
    public const EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];

    public const MAX_BYTES = 1024 * 1024;

    /**
     * @return array{0: string, 1: string} extension (lower case) and contents
     *
     * @throws ValidationException under $attribute
     */
    public static function validate(UploadedFile $file, string $attribute): array
    {
        $extension = strtolower($file->getClientOriginalExtension());
        $fail = fn (string $key, array $replace = []): ValidationException => ValidationException::withMessages([$attribute => [Text::t($key, $replace)]]);

        if (! in_array($extension, self::EXTENSIONS, true)) {
            throw $fail('uploads.type', ['types' => 'PNG, JPEG, GIF, WebP, SVG']);
        }
        if ((int) $file->getSize() > self::MAX_BYTES) {
            throw $fail('uploads.too_large', ['mb' => 1]);
        }
        $contents = (string) $file->get();
        // same content check as template assets: the bytes must be what the extension says
        $problem = TemplatePackage::assetProblem("assets/image.{$extension}", $contents);
        if ($problem !== null) {
            throw $fail('uploads.content');
        }

        return [$extension, $contents];
    }

    /**
     * Headers for serving an uploaded file: an SVG opened directly must not run scripts or load anything.
     *
     * @return array<string, string>
     */
    public static function headers(): array
    {
        return [
            'Content-Security-Policy' => "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox",
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, max-age=0, must-revalidate',
        ];
    }
}
```

`lang/en.json`:

```json
"uploads.content": "The file content does not match its type.",
"uploads.missing": "Choose a file.",
"uploads.too_large": "The file is larger than :mb MB.",
"uploads.type": "Allowed are :types."
```

`lang/de.json`:

```json
"uploads.content": "Der Inhalt der Datei passt nicht zu ihrem Typ.",
"uploads.missing": "Wähle eine Datei aus.",
"uploads.too_large": "Die Datei ist größer als :mb MB.",
"uploads.type": "Erlaubt sind :types."
```

- [ ] **Step 5: Actions**

`app/Actions/StoreUpload.php`:

```php
<?php

namespace App\Actions;

use App\Rendering\TemplatePackage;
use App\Support\Actor;
use App\Support\StoredImage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * POST /api/uploads: an image for an image field, stored as uploads/<ulid>.<ext> on the local disk. The returned path
 * is the field value. Files are never deleted (finalized documents point at them through their snapshot).
 */
final class StoreUpload
{
    /**
     * @return array{path: string, mime: string, size: int}
     *
     * @throws ValidationException
     */
    public function handle(Actor $actor, UploadedFile $file): array
    {
        [$extension, $contents] = StoredImage::validate($file, 'file');
        $path = 'uploads/'.strtolower((string) Str::ulid()).'.'.$extension;
        Storage::disk('local')->put($path, $contents);

        return ['path' => $path, 'mime' => TemplatePackage::mimeOf($path), 'size' => strlen($contents)];
    }
}
```

`app/Actions/ReadUpload.php`:

```php
<?php

namespace App\Actions;

use App\Domain\Fields\ImagePath;
use App\Rendering\TemplatePackage;
use App\Support\Actor;
use App\Support\DownloadFile;
use Illuminate\Support\Facades\Storage;

/** GET /api/uploads/{name}: the stored image, null when the name is no upload or the file is gone. */
final class ReadUpload
{
    public function handle(Actor $actor, string $name): ?DownloadFile
    {
        $path = "uploads/{$name}";
        if (! ImagePath::isValid($path)) {
            return null;
        }
        $contents = Storage::disk('local')->get($path);

        return $contents === null ? null : new DownloadFile($name, TemplatePackage::mimeOf($path), $contents);
    }
}
```

`app/Actions/ReorderFieldDefinitions.php`:

```php
<?php

namespace App\Actions;

use App\Enums\FieldScope;
use App\Models\FieldDefinition;
use App\Support\Actor;
use App\Support\Text;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** POST /api/field-definitions/reorder: the complete order of one level ({scope, ids}); all or nothing. */
final class ReorderFieldDefinitions
{
    /**
     * @param  array<string, mixed>  $input
     *
     * @throws ValidationException
     */
    public function handle(Actor $actor, array $input): void
    {
        $data = Validator::make($input, [
            'scope' => ['required', Rule::enum(FieldScope::class)],
            'ids' => ['required', 'array', 'list'],
            'ids.*' => ['string', 'distinct'],
        ])->validate();

        DB::transaction(function () use ($data): void {
            $existing = FieldDefinition::query()->where('scope', $data['scope'])->lockForUpdate()->pluck('id')->all();
            if (count($data['ids']) !== count($existing) || array_diff($data['ids'], $existing) !== []) {
                throw ValidationException::withMessages(['ids' => [Text::t('fields.reorder_mismatch')]]);
            }
            foreach ($data['ids'] as $sort => $id) {
                FieldDefinition::query()->whereKey($id)->update(['sort' => $sort]);
            }
        });
    }
}
```

`lang/en.json`: `"fields.reorder_mismatch": "The order must contain every field of this level exactly once. Reload the page and try again."`; `lang/de.json`: `"fields.reorder_mismatch": "Die Reihenfolge muss jedes Feld dieser Ebene genau einmal enthalten. Lade die Seite neu und versuch es noch einmal."`

- [ ] **Step 6: Controller, Routen, OpenAPI**

`app/Http/Controllers/Api/UploadController.php`:

```php
<?php

namespace App\Http\Controllers\Api;

use App\Actions\ReadUpload;
use App\Actions\StoreUpload;
use App\Http\Api\ApiJson;
use App\Http\Api\CurrentActor;
use App\Http\Api\FileResponse;
use App\Http\Controllers\Controller;
use App\Support\StoredImage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Validator;

/** POST /api/uploads (multipart "file") and GET /api/uploads/{name} – images of image fields. */
final class UploadController extends Controller
{
    public function store(Request $request, StoreUpload $store): JsonResponse
    {
        /** @var UploadedFile $file */
        $file = Validator::make($request->allFiles(), ['file' => ['required', 'file']])->validate()['file'];

        return ApiJson::ok($store->handle(CurrentActor::from($request), $file), 201);
    }

    public function show(Request $request, ReadUpload $read): Response
    {
        $file = $read->handle(CurrentActor::from($request), (string) $request->route('name')) ?? abort(404);

        return FileResponse::download($file, inline: true)->withHeaders(StoredImage::headers());
    }
}
```

`app/Http/Controllers/Api/FieldOrderController.php`:

```php
<?php

namespace App\Http\Controllers\Api;

use App\Actions\ReorderFieldDefinitions;
use App\Http\Api\CurrentActor;
use App\Http\Api\RequestBody;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/** POST /api/field-definitions/reorder – {scope, ids}. */
final class FieldOrderController extends Controller
{
    public function __invoke(Request $request, ReorderFieldDefinitions $reorder): Response
    {
        $reorder->handle(CurrentActor::from($request), RequestBody::object($request));

        return response()->noContent();
    }
}
```

In `routes/api.php` (Imports ergänzen):

```php
Route::middleware(ApiMiddleware::READ)->group(function (): void {
    // … bestehende Routen …
    Route::get('/uploads/{name}', [UploadController::class, 'show'])
        ->where('name', '[0-9a-z]{26}\.(png|jpg|jpeg|gif|webp|svg)')
        ->name('api.uploads.show');
});

Route::middleware(ApiMiddleware::WRITE)->group(function (): void {
    Route::post('/uploads', [UploadController::class, 'store'])->name('api.uploads.store');
    Route::post('/field-definitions/reorder', FieldOrderController::class)->name('api.field-definitions.reorder');
});
```

(Die `uploads`-Zeile in die vorhandene `READ`-Gruppe einfügen, die `WRITE`-Gruppe neu anlegen.)

In `app/OpenApi/OpenApiFactory::paths()` ergänzen:

```php
            '/api/uploads' => new PathItem(post: new Operation(
                operationId: 'uploadImage',
                tags: ['Upload'],
                responses: self::responses(self::json('Stored image: path (the value of an image field), mime, size.')),
                summary: 'Uploads an image (PNG, JPEG, GIF, WebP, SVG, at most 1 MB) for an image field.',
                requestBody: new RequestBody('Multipart form with the field "file"', new ArrayObject(['multipart/form-data' => ['schema' => [
                    'type' => 'object', 'properties' => ['file' => ['type' => 'string', 'format' => 'binary']], 'required' => ['file'],
                ]]]), true),
            )),
            '/api/uploads/{name}' => new PathItem(get: new Operation(
                operationId: 'getUpload',
                tags: ['Upload'],
                responses: self::responses(self::file('image/*', 'The stored image (sandboxed).')),
                summary: 'Downloads an uploaded image.',
                parameters: [new Parameter('name', 'path', '<ulid>.<ext> from the upload path', true, schema: ['type' => 'string'])],
            )),
            '/api/field-definitions/reorder' => new PathItem(post: new Operation(
                operationId: 'reorderFieldDefinitions',
                tags: ['FieldDefinition'],
                responses: self::responses(new Response('Order stored')),
                summary: 'Sets the order of all custom fields of one level.',
                requestBody: new RequestBody('scope and every field id of that level', new ArrayObject(['application/json' => ['schema' => [
                    'type' => 'object',
                    'properties' => ['scope' => ['type' => 'string'], 'ids' => ['type' => 'array', 'items' => ['type' => 'string']]],
                    'required' => ['scope', 'ids'],
                ]]]), true),
            )),
```

(`self::responses()` setzt `200`; für 201/204 ist das im Dokument eine Vereinfachung wie bei den anderen Controller-Routen.)

- [ ] **Step 7: Bildfelder im Kontext**

`app/Rendering/AssetInliner.php` ergänzen (`use App\Domain\Fields\ImagePath;`):

```php
    /** Value of an image field as data URL; '' for anything that is no stored upload. */
    public function upload(?string $path): string
    {
        if ($path === null || ! ImagePath::isValid($path)) {
            return '';
        }
        $contents = Storage::disk('local')->get($path);

        return $contents === null ? '' : self::dataUrl(TemplatePackage::mimeOf($path), $contents);
    }
```

In `app/Rendering/ContextBuilder.php`:

1. Am Anfang von `build()` nach `$units = …`: `$images = self::imageKeys($sources);`
2. Die fünf Spreads der eigenen Werte ersetzen:
   - Position: `...($position->custom ?? []),` → `...$this->inlineImages($position->custom ?? [], $images['position']),`
   - org: `...($org['custom'] ?? []),` → `...$this->inlineImages($org['custom'] ?? [], $images['org']),`
   - customer: `...($customer['custom'] ?? []),` → `...$this->inlineImages($customer['custom'] ?? [], $images['customer']),`
   - contact: `...($contact['custom'] ?? []),` → `...$this->inlineImages($contact['custom'] ?? [], $images['contact']),`
   - document: `...($document->custom ?? []),` → `...$this->inlineImages($document->custom ?? [], $images['document']),`
3. Methoden ergänzen:

```php
    /**
     * Keys of image fields per level, from the definitions of the sources (snapshot, live or sample).
     *
     * @param  array<string, mixed>  $sources
     * @return array{org: list<string>, customer: list<string>, contact: list<string>, document: list<string>, position: list<string>}
     */
    private static function imageKeys(array $sources): array
    {
        $keys = ['org' => [], 'customer' => [], 'contact' => [], 'document' => [], 'position' => []];
        foreach ($sources['field_definitions'] ?? [] as $definition) {
            if (($definition['type'] ?? null) === 'image' && isset($keys[$definition['scope'] ?? ''])) {
                $keys[$definition['scope']][] = (string) $definition['key'];
            }
        }

        return $keys;
    }

    /**
     * Image fields become data URLs (Chromium's header/footer load no files, the CSP allows data: only).
     *
     * @param  array<string, mixed>  $custom
     * @param  list<string>  $imageKeys
     * @return array<string, mixed>
     */
    private function inlineImages(array $custom, array $imageKeys): array
    {
        foreach ($imageKeys as $key) {
            if (array_key_exists($key, $custom)) {
                $custom[$key] = $this->assets->upload(is_string($custom[$key]) ? $custom[$key] : null);
            }
        }

        return $custom;
    }
```

Escaping: Data-URLs bestehen aus `[A-Za-z0-9+/=:;,]` und dem MIME-Typ – `LiquidRenderer` escapt sie unverändert (vgl. Fallstrick `org.logo`).

- [ ] **Step 8: Tests laufen lassen**

Run: `ddev artisan test --filter='CustomValueValidatorTest|UploadApiTest|ReorderFieldDefinitionsTest|ImageFieldContextTest|RightsMatrixTest|OpenApiTest|ContextBuilderTest|GoldenTest|ArchTest'`
Expected: PASS. `GoldenTest` bleibt grün (keine Bildfelder in den Beispieldaten; `SampleDataFactory` setzt Bildfelder auf `''`).

- [ ] **Step 9: Commit**

```bash
ddev exec vendor/bin/pint && ddev exec vendor/bin/phpstan analyse --memory-limit=1G
git add app routes lang tests
git commit -m "feat: image uploads for image fields, field order endpoint, images as data URLs in templates" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 8: Seite „Eigene Felder“ mit Drawer, Undo und Bild-Upload

**Files:**
- Modify: `resources/js/api/fields.ts`, `resources/js/api/keys.ts`, `resources/js/api/keys.test.ts`
- Create: `resources/js/fields/field-form.ts`, `resources/js/fields/field-form.test.ts`, `resources/js/fields/profile-requirements.ts`
- Create: `resources/js/fields/fields-list.tsx`, `resources/js/fields/field-drawer.tsx`, `resources/js/fields/built-in-fields.tsx`
- Create: `resources/js/components/image-field-input.tsx`; Modify: `resources/js/components/custom-field-input.tsx`
- Modify: `resources/js/pages/fields/index.tsx` (vollständig ersetzen)
- Modify: `lang/en.json`, `lang/de.json`

**Interfaces:**
- Consumes: `useRenderSchema` (Task 3), `useDocumentTypes` (Task 3), `apiUpload` (Task 3), `POST /api/uploads`, `POST /api/field-definitions/reorder` (Task 7), `scheduleDelete`/`usePendingDeletes` (`lib/pending-delete.ts`), `CustomFieldInput`, `fields.scope.*`/`fields.type.*` (Task 6).
- Produces:
  - `api/fields.ts`: `useAllFieldDefinitions(): SWRResponse<FieldDefinition[]>`, `type FieldDefinitionInput`, `saveFieldDefinition(input: FieldDefinitionInput, id?: string): Promise<FieldDefinition>`, `deleteFieldDefinition(id: string, options?: { keepalive: boolean }): Promise<void>`, `reorderFieldDefinitions(scope: FieldScope, ids: string[]): Promise<void>`, `uploadImage(file: File): Promise<{ path: string; mime: string; size: number }>`, `uploadUrl(path: string): string`
  - `fields/field-form.ts`: `slugKey(label: string): string` (wie `KeySlugger::slug`), `toggleDocType(current: DocumentType[], type: DocumentType): DocumentType[] | null`, `moveId(ids: string[], index: number, direction: -1 | 1): string[]`, `emptyDefinition(scope: FieldScope): FieldDefinitionInput`, `hasDocTypes(scope: FieldScope): boolean`
  - `keys.allFieldDefinitions(): '/api/field-definitions'`
  - `ImageFieldInput` (auch für Positionszeilen im Dokument-Editor, `compact`)

- [ ] **Step 1: Failing Tests**

`resources/js/fields/field-form.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { emptyDefinition, hasDocTypes, moveId, slugKey, toggleDocType } from './field-form';

describe('slugKey', () => {
    it('builds keys like App\\Domain\\Fields\\KeySlugger', () => {
        expect(slugKey('Größe der Fläche')).toBe('groesse_der_flaeche');
        expect(slugKey('Bestellnummer des Kunden')).toBe('bestellnummer_des_kunden');
        expect(slugKey('Café Crème')).toBe('cafe_creme');
        expect(slugKey('  2. Ansprechpartner ')).toBe('f_2_ansprechpartner');
        expect(slugKey('!!!')).toBe('');
    });
});

describe('toggleDocType', () => {
    it('adds in the canonical order and refuses to remove the last type (review focus)', () => {
        expect(toggleDocType(['invoice'], 'offer')).toEqual(['offer', 'invoice']);
        expect(toggleDocType(['offer', 'invoice'], 'offer')).toEqual(['invoice']);
        expect(toggleDocType(['invoice'], 'invoice')).toBeNull();
    });
});

describe('moveId', () => {
    it('moves one id up or down and keeps the list at the edges', () => {
        expect(moveId(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
        expect(moveId(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
        expect(moveId(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    });
});

describe('emptyDefinition', () => {
    it('applies document and position fields to every type, other levels to none', () => {
        expect(emptyDefinition('document').doc_types).toEqual(['offer', 'confirmation', 'invoice', 'cancellation']);
        expect(emptyDefinition('customer').doc_types).toEqual([]);
        expect([hasDocTypes('position'), hasDocTypes('org')]).toEqual([true, false]);
    });
});
```

In `resources/js/api/keys.test.ts` ergänzen: `expect(keys.allFieldDefinitions()).toBe('/api/field-definitions');`

Run: `ddev exec pnpm test -- resources/js/fields resources/js/api/keys.test.ts`
Expected: FAIL.

- [ ] **Step 2: `field-form.ts` implementieren**

```ts
import type { FieldDefinitionInput } from '@/api/fields';
import { DOCUMENT_TYPES, type DocumentType, type FieldScope } from '@/api/types';

const TRANSLIT: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };

/** Preview of the key the server would build (App\Domain\Fields\KeySlugger::slug); the server decides. */
export function slugKey(label: string): string {
    const base = label
        .toLowerCase()
        .replace(/[äöüß]/g, (c) => TRANSLIT[c])
        .normalize('NFKD')
        .replace(/\p{Mn}/gu, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
    if (base === '') return '';
    return /^[a-z]/.test(base) ? base : `f_${base}`;
}

export const hasDocTypes = (scope: FieldScope): boolean => scope === 'document' || scope === 'position';

/** null: the last type cannot be removed (delete the field instead). */
export function toggleDocType(current: DocumentType[], type: DocumentType): DocumentType[] | null {
    const next = current.includes(type) ? current.filter((t) => t !== type) : DOCUMENT_TYPES.filter((t) => t === type || current.includes(t));
    return next.length === 0 ? null : next;
}

export function moveId(ids: string[], index: number, direction: -1 | 1): string[] {
    const target = index + direction;
    if (target < 0 || target >= ids.length) return ids;
    const next = [...ids];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
}

export function emptyDefinition(scope: FieldScope): FieldDefinitionInput {
    return { scope, key: '', label: '', type: 'text', required: false, default_value: null, help: '', options: [], doc_types: hasDocTypes(scope) ? [...DOCUMENT_TYPES] : [] };
}
```

- [ ] **Step 3: API-Funktionen**

`resources/js/api/keys.ts`: `allFieldDefinitions: () => '/api/field-definitions',`

`resources/js/api/fields.ts` vollständig:

```ts
import useSWR from 'swr';
import { api, apiUpload } from '@/lib/api';
import { keys } from './keys';
import { invalidate } from './paged';
import type { FieldDefinition, FieldScope } from './types';

/** Custom field definitions of one level (not paginated), in their configured order. */
export function useFieldDefinitions(scope: FieldScope) {
    return useSWR<FieldDefinition[]>(keys.fieldDefinitions(scope));
}

/** All levels at once (tab counts on the fields page). */
export function useAllFieldDefinitions() {
    return useSWR<FieldDefinition[]>(keys.allFieldDefinitions());
}

/** What SaveFieldDefinition takes; scope and key only count when creating. */
export type FieldDefinitionInput = Omit<FieldDefinition, 'id' | 'sort'>;

const settle = () => invalidate('/api/field-definitions').then(() => invalidate('/api/render/schema'));

export async function saveFieldDefinition(input: FieldDefinitionInput, id?: string): Promise<FieldDefinition> {
    const body = id ? { label: input.label, type: input.type, required: input.required, default_value: input.default_value, help: input.help, options: input.options, doc_types: input.doc_types } : { ...input, key: input.key || null };
    const saved = await api<FieldDefinition>(id ? `/api/field-definitions/${id}` : '/api/field-definitions', { method: id ? 'PATCH' : 'POST', body });
    void settle();
    return saved;
}

export async function deleteFieldDefinition(id: string, options: { keepalive: boolean } = { keepalive: false }): Promise<void> {
    await api<void>(`/api/field-definitions/${id}`, { method: 'DELETE', keepalive: options.keepalive });
    void settle();
}

export async function reorderFieldDefinitions(scope: FieldScope, ids: string[]): Promise<void> {
    await api<void>('/api/field-definitions/reorder', { method: 'POST', body: { scope, ids } });
    void settle();
}

export function uploadImage(file: File): Promise<{ path: string; mime: string; size: number }> {
    const form = new FormData();
    form.append('file', file);
    return apiUpload<{ path: string; mime: string; size: number }>('/api/uploads', form);
}

/** "uploads/<ulid>.png" → URL of GET /api/uploads/{name}. */
export const uploadUrl = (path: string): string => `/api/${path}`;
```

Run: `ddev exec pnpm test -- resources/js/fields resources/js/api/keys.test.ts` → PASS.

- [ ] **Step 4: Bildfeld-Eingabe**

`resources/js/components/image-field-input.tsx`:

```tsx
import { ImagePlus, Trash2 } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { uploadImage, uploadUrl } from '@/api/fields';
import { Button, Field } from '@/components/ui';
import { t } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { uploadError } from '@/templates/import-button';

type Props = { label?: ReactNode; hint?: ReactNode; error?: string; path?: string; value: string | null; disabled: boolean; compact?: boolean; aria?: string; onChange(value: string | null): void };

/** Image field: upload (POST /api/uploads) → the stored path is the value; shown through GET /api/uploads/{name}. */
export function ImageFieldInput({ label, hint, error, path, value, disabled, compact = false, aria, onChange }: Props) {
    const input = useRef<HTMLInputElement>(null);
    const [pending, setPending] = useState(false);

    const onFile = async (file: File | undefined) => {
        if (!file) return;
        setPending(true);
        try {
            onChange((await uploadImage(file)).path);
        } catch (e) {
            toast.error(uploadError(e));
        } finally {
            setPending(false);
        }
    };

    const picker = (
        <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
            hidden
            onChange={(e) => {
                void onFile(e.target.files?.[0]);
                e.target.value = '';
            }}
        />
    );

    return (
        <Field label={label} hint={hint ?? (compact ? undefined : t('fields.image_hint'))} error={error} path={path}>
            {() => (
                <div className="flex min-w-0 items-center gap-2">
                    {picker}
                    {value && <img src={uploadUrl(value)} alt="" className={compact ? 'size-8 rounded-sm bg-surface-2 object-contain' : 'size-14 rounded-md bg-surface-2 object-contain p-1'} />}
                    <Button size="sm" variant="default" icon={<ImagePlus />} iconOnly={compact} pending={pending} disabled={disabled} aria-label={aria} onClick={() => input.current?.click()}>
                        {value ? t('fields.image_replace') : t('fields.image_upload')}
                    </Button>
                    {value && (
                        <Button size="sm" variant="ghost" iconOnly icon={<Trash2 />} disabled={disabled} onClick={() => onChange(null)}>
                            {t('fields.image_remove')}
                        </Button>
                    )}
                </div>
            )}
        </Field>
    );
}
```

In `resources/js/components/custom-field-input.tsx` den `image`-Fall ersetzen (Import `ImageFieldInput` ergänzen):

```tsx
        case 'image':
            return <ImageFieldInput label={label} hint={hint} error={error} path={path} value={text || null} disabled={disabled} compact={compact} aria={aria} onChange={onChange} />;
```

Den Schlüssel `fields.image_read_only` aus `lang/en.json` und `lang/de.json` entfernen (nicht mehr benutzt).

- [ ] **Step 5: Profil-Pflichtangaben**

`resources/js/fields/profile-requirements.ts`:

```ts
import type { FieldScope } from '@/api/types';

/**
 * What the EN 16931 profile requires per level (labels only; the rules live in App\Domain\Compliance\ComplianceChecker).
 * Keys: fields.profile.<scope>_<item>.
 */
export const PROFILE_REQUIREMENTS: Partial<Record<FieldScope, string[]>> = {
    org: ['org_address', 'org_tax_id', 'org_registration', 'org_iban'],
    customer: ['customer_address', 'customer_vat_id'],
    document: ['document_service_date', 'document_due_date'],
    position: ['position_unit', 'position_quantity'],
};
```

- [ ] **Step 6: Eingebaute Felder**

`resources/js/fields/built-in-fields.tsx`:

```tsx
import { Link } from '@inertiajs/react';
import { ChevronDown, Lock } from 'lucide-react';
import { useState } from 'react';
import { useDocumentTypes } from '@/api/settings';
import { useRenderSchema } from '@/api/templates';
import type { FieldScope } from '@/api/types';
import { Badge, cx } from '@/components/ui';
import { path, t, tn } from '@/lib/i18n';
import { liquidPath } from './expression';
import { PROFILE_REQUIREMENTS } from './profile-requirements';

/** Locked core fields and e-invoice requirements of a level, folded by default. */
export function BuiltInFields({ scope }: { scope: FieldScope }) {
    const [open, setOpen] = useState(false);
    const schema = useRenderSchema();
    const documentTypes = useDocumentTypes();
    const core = schema.data?.levels[scope].core ?? [];
    const requirements = PROFILE_REQUIREMENTS[scope] ?? [];
    const einvoiceTypes = (documentTypes.data ?? []).filter((setting) => setting.profile === 'en16931').map((setting) => t(`document_type.${setting.type}`));

    return (
        <section className="rounded-lg bg-surface-2">
            <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 rounded-lg px-5 py-4 text-left">
                <Lock aria-hidden className="size-4 shrink-0 text-muted" />
                <span>
                    <b className="font-strong">{t('fields.built_in')}</b>{' '}
                    <span className="text-muted">
                        {tn('fields.core_count', core.length)}
                        {requirements.length > 0 && `, ${tn('fields.profile_count', requirements.length)}`}
                    </span>
                </span>
                <ChevronDown aria-hidden className={cx('ml-auto size-4 transition-transform', open && 'rotate-180')} />
            </button>
            {open && (
                <div className="grid gap-4 px-5 pb-5">
                    <p className="text-muted">{t('fields.built_in_text')}</p>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-2">
                        {core.map((key) => (
                            <div key={key} className="flex min-w-0 items-center justify-between gap-2 rounded-md bg-surface px-3 py-2 text-sm">
                                <code className="truncate font-mono text-xs">{liquidPath(scope, key)}</code>
                                <Lock aria-hidden className="size-3.5 shrink-0 text-faint" />
                            </div>
                        ))}
                    </div>
                    {requirements.length > 0 && (
                        <div className="grid gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge tone="accent">{t('fields.einvoice')}</Badge>
                                <span className="text-muted">
                                    {einvoiceTypes.length > 0 ? (
                                        t('fields.einvoice_active', { types: einvoiceTypes.join(', ') })
                                    ) : (
                                        <>
                                            {t('fields.einvoice_inactive')} <Link href={path('/settings/document-types')}>{t('fields.einvoice_settings')}</Link>
                                        </>
                                    )}
                                </span>
                            </div>
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-2">
                                {requirements.map((item) => (
                                    <div key={item} className="flex min-w-0 items-center justify-between gap-2 rounded-md bg-surface px-3 py-2 text-sm">
                                        <span className="truncate">{t(`fields.profile.${item}`)}</span>
                                        <Lock aria-hidden className="size-3.5 shrink-0 text-faint" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}
```

- [ ] **Step 7: Drawer mit Live-Vorschau**

`resources/js/fields/field-drawer.tsx`:

```tsx
import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { saveFieldDefinition, type FieldDefinitionInput } from '@/api/fields';
import { DOCUMENT_TYPES, type CustomValue, type FieldDefinition, type FieldType } from '@/api/types';
import { CustomFieldInput } from '@/components/custom-field-input';
import { Button, Checkbox, Drawer, Field, Switch, Textarea, TextInput, controlClass, cx } from '@/components/ui';
import { ApiError, errorMessage } from '@/lib/api';
import { t } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { liquidPath } from './expression';
import { hasDocTypes, slugKey } from './field-form';

const TYPES: FieldType[] = ['text', 'textarea', 'number', 'money', 'date', 'select', 'boolean', 'image'];

type Props = { initial: FieldDefinitionInput; id?: string; onClose(): void };

/** Create or edit a custom field; the preview shows the input as forms will show it. */
export function FieldDrawer({ initial, id, onClose }: Props) {
    const isNew = !id;
    const [draft, setDraft] = useState<FieldDefinitionInput>(() => (isNew && initial.label && !initial.key ? { ...initial, key: slugKey(initial.label) } : initial));
    const [keyTouched, setKeyTouched] = useState(!isNew);
    const [option, setOption] = useState('');
    const [preview, setPreview] = useState<CustomValue>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [pending, setPending] = useState(false);
    const set = (patch: Partial<FieldDefinitionInput>) => setDraft((current) => ({ ...current, ...patch }));
    const asDefinition = (extra: Partial<FieldDefinition>): FieldDefinition => ({ ...draft, id: id ?? 'new', sort: 0, ...extra });

    const addOption = () => {
        const value = option.trim();
        if (!value || draft.options.includes(value)) return;
        set({ options: [...draft.options, value] });
        setOption('');
    };

    const submit = async () => {
        if (!draft.label.trim()) {
            setErrors({ label: t('fields.error.label_missing') });
            return;
        }
        setPending(true);
        try {
            const saved = await saveFieldDefinition(draft, id);
            toast.success(t(isNew ? 'fields.created' : 'fields.saved', { label: saved.label }));
            onClose();
        } catch (error) {
            if (error instanceof ApiError && error.status === 422) setErrors(error.fieldErrors());
            else toast.error(errorMessage(error));
        } finally {
            setPending(false);
        }
    };

    return (
        <Drawer
            open
            onClose={onClose}
            title={isNew ? t('fields.add') : t('fields.edit_named', { label: initial.label })}
            description={t('fields.level', { level: t(`fields.scope.${draft.scope}`) })}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>
                        {t('common.cancel')}
                    </Button>
                    <Button variant="primary" pending={pending} onClick={() => void submit()}>
                        {isNew ? t('fields.create') : t('fields.save')}
                    </Button>
                </>
            }
        >
            <form
                className="grid gap-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    void submit();
                }}
            >
                <TextInput
                    label={t('fields.label')}
                    value={draft.label}
                    data-autofocus
                    placeholder={t('fields.label_placeholder')}
                    error={errors.label}
                    onChange={(e) => set({ label: e.target.value, ...(isNew && !keyTouched ? { key: slugKey(e.target.value) } : {}) })}
                />
                <TextInput
                    label={t('fields.key')}
                    value={draft.key}
                    readOnly={!isNew}
                    className="font-mono text-sm"
                    error={errors.key}
                    hint={isNew ? t('fields.key_hint_new') : t('fields.key_hint_fixed')}
                    onChange={(e) => {
                        setKeyTouched(true);
                        set({ key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') });
                    }}
                />
                <Field label={t('fields.type')} error={errors.type}>
                    {() => (
                        <div role="radiogroup" aria-label={t('fields.type')} className="grid grid-cols-2 gap-1.5 xs:grid-cols-4">
                            {TYPES.map((type) => (
                                <button
                                    key={type}
                                    type="button"
                                    role="radio"
                                    aria-checked={draft.type === type}
                                    onClick={() => set({ type, default_value: null, options: type === 'select' ? draft.options : [] })}
                                    className={cx(
                                        'h-9 truncate rounded-md px-2 text-sm font-strong transition-colors',
                                        draft.type === type ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-muted hover:bg-surface-3 hover:text-ink',
                                    )}
                                >
                                    {t(`fields.type.${type}`)}
                                </button>
                            ))}
                        </div>
                    )}
                </Field>

                {draft.type === 'select' && (
                    <Field label={t('fields.options')} error={errors.options}>
                        {(fieldId) => (
                            <div className="grid gap-2">
                                {draft.options.length > 0 && (
                                    <ul className="m-0 grid list-none gap-1 p-0">
                                        {draft.options.map((value) => (
                                            <li key={value} className="flex items-center justify-between gap-2 rounded-md bg-surface-2 py-0.5 pr-1 pl-3">
                                                <span>{value}</span>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    iconOnly
                                                    icon={<X />}
                                                    onClick={() => set({ options: draft.options.filter((o) => o !== value), default_value: draft.default_value === value ? null : draft.default_value })}
                                                >
                                                    {t('fields.option_remove', { option: value })}
                                                </Button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                <div className="flex gap-2">
                                    <input
                                        id={fieldId}
                                        className={controlClass(false, 'h-control')}
                                        value={option}
                                        placeholder={t('fields.option_new')}
                                        onChange={(e) => setOption(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                addOption();
                                            }
                                        }}
                                    />
                                    <Button icon={<Plus />} disabled={!option.trim()} onClick={addOption}>
                                        {t('fields.option_add')}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </Field>
                )}

                {hasDocTypes(draft.scope) && (
                    <Field label={t('fields.applies_to')} hint={t('fields.applies_to_hint')} error={errors.doc_types}>
                        {() => (
                            <div className="flex flex-wrap gap-x-4 gap-y-2">
                                {DOCUMENT_TYPES.map((type) => (
                                    <Checkbox
                                        key={type}
                                        label={t(`document_type.${type}`)}
                                        checked={draft.doc_types.includes(type)}
                                        onChange={(e) => set({ doc_types: e.target.checked ? DOCUMENT_TYPES.filter((x) => x === type || draft.doc_types.includes(x)) : draft.doc_types.filter((x) => x !== type) })}
                                    />
                                ))}
                            </div>
                        )}
                    </Field>
                )}

                <Switch label={t('fields.required_label')} checked={draft.required} onChange={(e) => set({ required: e.target.checked })} />

                {draft.type !== 'image' && (
                    <CustomFieldInput
                        definition={asDefinition({ label: t('fields.default_value'), required: false, help: t('fields.default_value_hint') })}
                        value={draft.default_value}
                        error={errors.default_value}
                        onChange={(value) => set({ default_value: value })}
                    />
                )}

                <Textarea label={t('fields.help')} rows={2} value={draft.help} placeholder={t('fields.help_placeholder')} onChange={(e) => set({ help: e.target.value })} />
            </form>

            <section aria-label={t('fields.preview')} className="mt-5 grid gap-3 rounded-lg bg-surface-2 p-4">
                <p className="text-sm font-strong">{t('fields.preview')}</p>
                <div className="rounded-md bg-surface p-4">
                    <CustomFieldInput definition={asDefinition({ label: draft.label || t('fields.new_field') })} value={preview ?? draft.default_value} onChange={setPreview} />
                </div>
                <p className="text-muted">
                    {t('fields.in_template')} <code className="rounded-sm bg-surface px-1 font-mono text-xs">{`{{ ${liquidPath(draft.scope, draft.key || 'key')} }}`}</code>
                </p>
            </section>
        </Drawer>
    );
}
```

Hinweis: Im Vorschau-Feld lädt ein Bild wirklich hoch (`POST /api/uploads`) – gewollt, so sieht man das echte Verhalten; die Datei bleibt ungenutzt liegen (Aufräumen Phase 11).

- [ ] **Step 8: Liste einer Ebene**

`resources/js/fields/fields-list.tsx`:

```tsx
import { ArrowDown, ArrowUp, ListPlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { deleteFieldDefinition, reorderFieldDefinitions, saveFieldDefinition, type FieldDefinitionInput } from '@/api/fields';
import { DOCUMENT_TYPES, type DocumentType, type FieldDefinition, type FieldScope, type FieldType } from '@/api/types';
import { Button, Card, EmptyState, Tag, cx } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { t, tn } from '@/lib/i18n';
import { scheduleDelete, usePendingDeletes } from '@/lib/pending-delete';
import { toast } from '@/lib/toast';
import { emptyDefinition, hasDocTypes, moveId, toggleDocType } from './field-form';

const EXAMPLES: Record<FieldScope, { key: string; type: FieldType }[]> = {
    org: [{ key: 'register', type: 'text' }, { key: 'management', type: 'text' }],
    customer: [{ key: 'supplier_number', type: 'text' }, { key: 'industry', type: 'select' }],
    contact: [{ key: 'department', type: 'text' }, { key: 'birthday', type: 'date' }],
    document: [{ key: 'project_name', type: 'text' }, { key: 'order_number', type: 'text' }],
    position: [{ key: 'ticket', type: 'text' }, { key: 'service_month', type: 'date' }],
};
const COLUMNS = 'grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_8rem_9rem]';
const COLUMNS_TYPES = 'grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_8rem_11rem_9rem]';
const toInput = (field: FieldDefinition): FieldDefinitionInput => ({ ...field });

export function FieldsList({ scope, fields, onEdit }: { scope: FieldScope; fields: FieldDefinition[]; onEdit(input: FieldDefinitionInput, id?: string): void }) {
    const pending = usePendingDeletes();
    const [busy, setBusy] = useState(false);
    const visible = fields.filter((field) => !pending.has(field.id));
    const withTypes = hasDocTypes(scope);
    const columns = withTypes ? COLUMNS_TYPES : COLUMNS;

    const run = async (task: () => Promise<unknown>) => {
        setBusy(true);
        try {
            await task();
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setBusy(false);
        }
    };

    const toggle = (field: FieldDefinition, type: DocumentType) => {
        const next = toggleDocType(field.doc_types, type);
        if (!next) {
            toast.error(t('fields.last_type'));
            return;
        }
        const added = next.includes(type);
        void run(async () => {
            await saveFieldDefinition({ ...toInput(field), doc_types: next }, field.id);
            toast.success(t(added ? 'fields.type_added' : 'fields.type_removed', { label: field.label, type: t(`document_type.${type}`) }));
        });
    };

    const remove = (field: FieldDefinition) => {
        const handle = scheduleDelete(field.id, (options) => deleteFieldDefinition(field.id, options));
        toast.success(t('fields.deleted', { label: field.label }), {
            label: t('fields.undo'),
            run: () => {
                if (handle.undo()) toast.info(t('fields.restored', { label: field.label }));
            },
            onExpire: () => void handle.commit().catch((error: unknown) => toast.error(errorMessage(error))),
        });
    };

    if (visible.length === 0) {
        return (
            <Card flush>
                <EmptyState
                    icon={<ListPlus />}
                    title={t(`fields.empty.${scope}`)}
                    actions={EXAMPLES[scope].map((example) => (
                        <Button key={example.key} variant="soft" size="sm" icon={<Plus />} onClick={() => onEdit({ ...emptyDefinition(scope), label: t(`fields.example.${example.key}`), type: example.type })}>
                            {t(`fields.example.${example.key}`)}
                        </Button>
                    ))}
                >
                    {t('fields.empty_text')}
                </EmptyState>
            </Card>
        );
    }

    return (
        <Card flush aria-label={t('fields.list_label', { level: t(`fields.scope.${scope}`) })}>
            <div aria-hidden className={cx('hidden gap-4 px-6 pt-4 pb-1 text-xs font-medium text-muted md:grid', columns)}>
                <span>{t('fields.col_field')}</span>
                <span>{t('fields.col_type')}</span>
                {withTypes && <span>{t('fields.col_applies')}</span>}
                <span />
            </div>
            <ul className="m-0 grid list-none gap-0.5 p-2">
                {visible.map((field, index) => (
                    <li key={field.id} className={cx('grid items-center gap-x-4 gap-y-2 rounded-md px-4 py-2.5 hover:bg-surface-2', columns)}>
                        <button type="button" className="grid min-w-0 gap-0.5 text-left" onClick={() => onEdit(toInput(field), field.id)}>
                            <span className="flex items-center gap-2 font-strong">
                                {field.label}
                                {field.required && <Tag neutral>{t('fields.required')}</Tag>}
                            </span>
                            <span className="truncate text-sm text-muted">
                                <code className="font-mono text-xs">{field.key}</code>
                                {field.help && ` · ${field.help}`}
                            </span>
                        </button>
                        <span className="hidden text-sm text-muted md:grid">
                            {t(`fields.type.${field.type}`)}
                            {field.type === 'select' && <span className="text-xs">{tn('fields.option_count', field.options.length)}</span>}
                        </span>
                        {withTypes && (
                            <span role="group" aria-label={t('fields.applies_named', { label: field.label })} className="col-start-1 row-start-2 inline-flex gap-1 md:col-start-auto md:row-start-auto">
                                {DOCUMENT_TYPES.map((type) => (
                                    <button
                                        key={type}
                                        type="button"
                                        aria-pressed={field.doc_types.includes(type)}
                                        title={t(`document_type.${type}`)}
                                        disabled={busy}
                                        onClick={() => toggle(field, type)}
                                        className="h-7 min-w-9 rounded-full bg-surface-2 px-2 text-xs font-heading text-faint transition-colors hover:bg-surface-3 hover:text-ink disabled:cursor-progress aria-pressed:bg-accent-soft aria-pressed:text-accent"
                                    >
                                        {t(`fields.doc_short.${type}`)}
                                    </button>
                                ))}
                            </span>
                        )}
                        <span className="row-span-2 flex justify-end gap-0.5 md:row-span-1">
                            <Button variant="ghost" size="sm" iconOnly icon={<ArrowUp />} disabled={index === 0 || busy || fields.length !== visible.length} onClick={() => void run(() => reorderFieldDefinitions(scope, moveId(visible.map((f) => f.id), index, -1)))}>
                                {t('fields.move_up')}
                            </Button>
                            <Button variant="ghost" size="sm" iconOnly icon={<ArrowDown />} disabled={index === visible.length - 1 || busy || fields.length !== visible.length} onClick={() => void run(() => reorderFieldDefinitions(scope, moveId(visible.map((f) => f.id), index, 1)))}>
                                {t('fields.move_down')}
                            </Button>
                            <Button variant="ghost" size="sm" iconOnly icon={<Pencil />} onClick={() => onEdit(toInput(field), field.id)}>
                                {t('fields.edit')}
                            </Button>
                            <Button variant="ghost" size="sm" iconOnly icon={<Trash2 />} onClick={() => remove(field)}>
                                {t('fields.delete')}
                            </Button>
                        </span>
                    </li>
                ))}
            </ul>
        </Card>
    );
}
```

Die Pfeile sind gesperrt, solange auf dieser Ebene eine Löschung aussteht (`fields.length !== visible.length`): `visible` enthält die vorgemerkte ID nicht, die Reihenfolge ginge sonst unvollständig an den Server (422 `fields.reorder_mismatch`).

- [ ] **Step 9: Seite**

`resources/js/pages/fields/index.tsx` vollständig:

```tsx
import { Head, router } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useAllFieldDefinitions, type FieldDefinitionInput } from '@/api/fields';
import type { FieldScope } from '@/api/types';
import { Button, Card, ErrorState, ListSkeleton, Page, PageHeader, Tabs } from '@/components/ui';
import { BuiltInFields } from '@/fields/built-in-fields';
import { FieldDrawer } from '@/fields/field-drawer';
import { emptyDefinition } from '@/fields/field-form';
import { FieldsList } from '@/fields/fields-list';
import { appLayout } from '@/layouts/app-shell';
import { path, t } from '@/lib/i18n';

const SCOPES: FieldScope[] = ['org', 'customer', 'contact', 'document', 'position'];

/** Custom fields (/{locale}/fields?scope=…): one tab per level. */
export default function Fields({ scope }: { scope: FieldScope }) {
    const all = useAllFieldDefinitions();
    const [editing, setEditing] = useState<{ input: FieldDefinitionInput; id?: string } | null>(null);
    const fields = (all.data ?? []).filter((field) => field.scope === scope);

    return (
        <Page>
            <Head title={t('nav.fields')} />
            <PageHeader
                title={t('nav.fields')}
                description={t('fields.description')}
                actions={
                    <Button variant="primary" icon={<Plus />} onClick={() => setEditing({ input: emptyDefinition(scope) })}>
                        {t('fields.add')}
                    </Button>
                }
            />
            <Tabs<FieldScope>
                label={t('fields.level_label')}
                value={scope}
                onChange={(next) => router.get(path('/fields'), { scope: next }, { preserveState: true, preserveScroll: true, replace: true })}
                items={SCOPES.map((item) => ({
                    value: item,
                    label: (
                        <>
                            {t(`fields.scope.${item}`)}
                            {all.data && <span className="num text-xs text-faint">{all.data.filter((field) => field.scope === item).length}</span>}
                        </>
                    ),
                }))}
            />
            <div className="grid max-w-[72ch] gap-1">
                <p>{t(`fields.intro.${scope}`)}</p>
                <p className="text-muted">
                    {t('fields.in_template')} <code className="rounded-sm bg-surface-2 px-1 font-mono text-xs">{scope === 'position' ? '{% for p in positions %} {{ p.key }}' : `{{ ${scope}.key }}`}</code>
                </p>
            </div>
            {all.error ? (
                <Card>
                    <ErrorState error={all.error} onRetry={() => void all.mutate()} />
                </Card>
            ) : !all.data ? (
                <Card flush>
                    <ListSkeleton rows={4} />
                </Card>
            ) : (
                <FieldsList key={scope} scope={scope} fields={fields} onEdit={(input, id) => setEditing({ input, id })} />
            )}
            <BuiltInFields key={`builtin-${scope}`} scope={scope} />
            {editing && <FieldDrawer key={editing.id ?? 'new'} initial={editing.input} id={editing.id} onClose={() => setEditing(null)} />}
        </Page>
    );
}

Fields.layout = appLayout;
```

- [ ] **Step 10: Übersetzungen**

`lang/en.json`:

```json
"fields.add": "Add field",
"fields.applies_named": ":label applies to",
"fields.applies_to": "Applies to",
"fields.applies_to_hint": "When converting, a value only moves along if the field also applies to the target type.",
"fields.built_in": "Built-in fields",
"fields.built_in_text": "These fields belong to openbill. They cannot be deleted because totals, numbers and the e-invoice need them.",
"fields.col_applies": "Applies to",
"fields.col_field": "Field",
"fields.col_type": "Type",
"fields.core_count.one": ":count core field",
"fields.core_count.other": ":count core fields",
"fields.create": "Create field",
"fields.created": "Field “:label” created",
"fields.default_value": "Default value",
"fields.default_value_hint": "Pre-filled in new entries.",
"fields.delete": "Delete",
"fields.deleted": "Field “:label” deleted",
"fields.doc_short.cancellation": "CN",
"fields.doc_short.confirmation": "OC",
"fields.doc_short.invoice": "INV",
"fields.doc_short.offer": "QU",
"fields.edit": "Edit",
"fields.edit_named": "Edit :label",
"fields.einvoice": "E-invoice",
"fields.einvoice_active": "Required as soon as a document with the profile is finalized. Active for :types.",
"fields.einvoice_inactive": "No document type uses the profile right now.",
"fields.einvoice_settings": "Set up profiles",
"fields.empty.contact": "No custom fields for contacts yet",
"fields.empty.customer": "No custom fields for customers yet",
"fields.empty.document": "No custom fields for documents yet",
"fields.empty.org": "No custom fields for your organization yet",
"fields.empty.position": "No custom fields for positions yet",
"fields.empty_text": "Start with a suggestion or add your own field.",
"fields.example.birthday": "Birthday",
"fields.example.department": "Department",
"fields.example.industry": "Industry",
"fields.example.management": "Managing directors",
"fields.example.order_number": "Customer order number",
"fields.example.project_name": "Project name",
"fields.example.register": "Commercial register",
"fields.example.service_month": "Service month",
"fields.example.supplier_number": "Supplier number",
"fields.example.ticket": "Ticket",
"fields.help": "Help text",
"fields.help_placeholder": "Shown below the field in forms",
"fields.image_hint": "PNG, JPEG, GIF, WebP or SVG, at most 1 MB.",
"fields.image_remove": "Remove image",
"fields.image_replace": "Replace image",
"fields.image_upload": "Upload image",
"fields.in_template": "In the template:",
"fields.intro.contact": "Details of single contacts of a customer, such as department or extension.",
"fields.intro.customer": "Additional master data per customer, for example industry or the supplier number they know you by.",
"fields.intro.document": "Fields in the head of a document. You add them once and choose which document types they apply to.",
"fields.intro.org": "Details of your own company that can appear on every document, such as commercial register or managing directors.",
"fields.intro.position": "Fields on every position. Here, too, you choose per field which document types it applies to.",
"fields.key": "Key",
"fields.key_hint_fixed": "The key is fixed so that templates and stored values stay valid.",
"fields.key_hint_new": "Templates access the field with it. It cannot be changed after creating the field.",
"fields.label": "Label",
"fields.label_placeholder": "e.g. Customer order number",
"fields.last_type": "A field needs at least one document type. Delete it if you no longer need it.",
"fields.level": "Level: :level",
"fields.level_label": "Level",
"fields.list_label": "Custom fields: :level",
"fields.move_down": "Move down",
"fields.move_up": "Move up",
"fields.new_field": "New field",
"fields.option_add": "Add",
"fields.option_count.one": ":count option",
"fields.option_count.other": ":count options",
"fields.option_new": "New option",
"fields.option_remove": "Remove :option",
"fields.options": "Options",
"fields.preview": "This is how it looks",
"fields.profile.customer_address": "Complete address",
"fields.profile.customer_vat_id": "VAT ID (for reverse charge)",
"fields.profile.document_due_date": "Due date",
"fields.profile.document_service_date": "Service date",
"fields.profile.org_address": "Complete address",
"fields.profile.org_iban": "IBAN",
"fields.profile.org_registration": "Register number (without VAT ID)",
"fields.profile.org_tax_id": "VAT ID or tax number",
"fields.profile.position_quantity": "Quantity other than 0",
"fields.profile.position_unit": "Unit with e-invoice code",
"fields.profile_count.one": ":count e-invoice requirement",
"fields.profile_count.other": ":count e-invoice requirements",
"fields.required": "Required",
"fields.required_label": "Required: documents can only be finalized when it is filled in",
"fields.restored": "Field “:label” restored",
"fields.save": "Save",
"fields.saved": "Field “:label” saved",
"fields.type": "Type",
"fields.type_added": "“:label” now also applies to :type",
"fields.type_removed": "“:label” no longer applies to :type",
"fields.undo": "Undo"
```

`lang/de.json`:

```json
"fields.add": "Feld hinzufügen",
"fields.applies_named": ":label gilt für",
"fields.applies_to": "Gilt für",
"fields.applies_to_hint": "Beim Umwandeln wandert ein Wert nur mit, wenn das Feld auch für den Zieltyp gilt.",
"fields.built_in": "Eingebaute Felder",
"fields.built_in_text": "Diese Felder gehören fest zu openbill. Sie lassen sich nicht löschen, weil Summen, Nummern und die E-Rechnung sie brauchen.",
"fields.col_applies": "Gilt für",
"fields.col_field": "Feld",
"fields.col_type": "Typ",
"fields.core_count.one": ":count Kernfeld",
"fields.core_count.other": ":count Kernfelder",
"fields.create": "Feld anlegen",
"fields.created": "Feld „:label“ angelegt",
"fields.default_value": "Standardwert",
"fields.default_value_hint": "Wird bei neuen Einträgen vorausgefüllt.",
"fields.delete": "Löschen",
"fields.deleted": "Feld „:label“ gelöscht",
"fields.doc_short.cancellation": "ST",
"fields.doc_short.confirmation": "AB",
"fields.doc_short.invoice": "RE",
"fields.doc_short.offer": "AN",
"fields.edit": "Bearbeiten",
"fields.edit_named": ":label bearbeiten",
"fields.einvoice": "E-Rechnung",
"fields.einvoice_active": "Pflicht, sobald ein Dokument mit dem Profil abgeschlossen wird. Aktiv für :types.",
"fields.einvoice_inactive": "Derzeit nutzt kein Dokumenttyp das Profil.",
"fields.einvoice_settings": "Profile einstellen",
"fields.empty.contact": "Noch keine eigenen Felder für Ansprechpartner",
"fields.empty.customer": "Noch keine eigenen Felder für Kunden",
"fields.empty.document": "Noch keine eigenen Felder für Dokumente",
"fields.empty.org": "Noch keine eigenen Felder für deine Organisation",
"fields.empty.position": "Noch keine eigenen Felder für Positionen",
"fields.empty_text": "Fang mit einem Vorschlag an oder lege ein eigenes Feld an.",
"fields.example.birthday": "Geburtstag",
"fields.example.department": "Abteilung",
"fields.example.industry": "Branche",
"fields.example.management": "Geschäftsführung",
"fields.example.order_number": "Bestellnummer des Kunden",
"fields.example.project_name": "Projektname",
"fields.example.register": "Handelsregister",
"fields.example.service_month": "Leistungsmonat",
"fields.example.supplier_number": "Lieferantennummer",
"fields.example.ticket": "Ticket",
"fields.help": "Hilfetext",
"fields.help_placeholder": "Erscheint unter dem Feld im Formular",
"fields.image_hint": "PNG, JPEG, GIF, WebP oder SVG, höchstens 1 MB.",
"fields.image_remove": "Bild entfernen",
"fields.image_replace": "Bild ersetzen",
"fields.image_upload": "Bild hochladen",
"fields.in_template": "Im Template:",
"fields.intro.contact": "Angaben zu einzelnen Ansprechpartnern eines Kunden, etwa Abteilung oder Durchwahl.",
"fields.intro.customer": "Zusätzliche Stammdaten pro Kunde, zum Beispiel Branche oder die Lieferantennummer, unter der er dich führt.",
"fields.intro.document": "Felder im Kopf eines Dokuments. Du legst sie einmal an und wählst, für welche Dokumenttypen sie gelten.",
"fields.intro.org": "Angaben zu deiner eigenen Firma, die auf jedem Dokument stehen können, etwa Handelsregister oder Geschäftsführung.",
"fields.intro.position": "Felder an jeder Position. Auch hier wählst du pro Feld, für welche Dokumenttypen es gilt.",
"fields.key": "Schlüssel",
"fields.key_hint_fixed": "Der Schlüssel ist fest, damit Templates und gespeicherte Werte gültig bleiben.",
"fields.key_hint_new": "Damit greifst du im Template auf das Feld zu. Nach dem Anlegen lässt er sich nicht mehr ändern.",
"fields.label": "Bezeichnung",
"fields.label_placeholder": "z. B. Bestellnummer des Kunden",
"fields.last_type": "Ein Feld braucht mindestens einen Dokumenttyp. Lösche es, wenn du es nicht mehr brauchst.",
"fields.level": "Ebene: :level",
"fields.level_label": "Ebene",
"fields.list_label": "Eigene Felder: :level",
"fields.move_down": "Nach unten",
"fields.move_up": "Nach oben",
"fields.new_field": "Neues Feld",
"fields.option_add": "Hinzufügen",
"fields.option_count.one": ":count Option",
"fields.option_count.other": ":count Optionen",
"fields.option_new": "Neue Option",
"fields.option_remove": ":option entfernen",
"fields.options": "Optionen",
"fields.preview": "So sieht es aus",
"fields.profile.customer_address": "Vollständige Adresse",
"fields.profile.customer_vat_id": "USt-ID (bei Reverse Charge)",
"fields.profile.document_due_date": "Fälligkeit",
"fields.profile.document_service_date": "Leistungsdatum",
"fields.profile.org_address": "Vollständige Adresse",
"fields.profile.org_iban": "IBAN",
"fields.profile.org_registration": "Registernummer (ohne USt-ID)",
"fields.profile.org_tax_id": "USt-ID oder Steuernummer",
"fields.profile.position_quantity": "Menge ungleich 0",
"fields.profile.position_unit": "Einheit mit E-Rechnungs-Code",
"fields.profile_count.one": ":count Pflichtangabe der E-Rechnung",
"fields.profile_count.other": ":count Pflichtangaben der E-Rechnung",
"fields.required": "Pflicht",
"fields.required_label": "Pflichtfeld: Dokumente lassen sich erst abschließen, wenn es ausgefüllt ist",
"fields.restored": "Feld „:label“ wiederhergestellt",
"fields.save": "Speichern",
"fields.saved": "Feld „:label“ gespeichert",
"fields.type": "Typ",
"fields.type_added": "„:label“ gilt jetzt auch für :type",
"fields.type_removed": "„:label“ gilt nicht mehr für :type",
"fields.undo": "Rückgängig"
```

(Die dynamischen Schlüssel `fields.empty.*`, `fields.intro.*`, `fields.example.*`, `fields.doc_short.*`, `fields.profile.*` stehen vollständig oben.)

- [ ] **Step 11: Prüfen**

Run: `ddev exec pnpm typecheck && ddev exec pnpm test && ddev artisan test --filter='TranslationsTest|SetupPagesTest'`
Expected: PASS.

Manuell: `/en/fields` → Tab Dokument; Vorschlag „Projektname“ → Drawer mit Schlüssel `projektname`/`project_name` (je nach Sprache), Typ Auswahl → Optionen; Vorschau zeigt das Feld; Anlegen → Zeile; Schalter „AN“ aus → Toast; letzten Typ ausschalten → Fehler-Toast, nichts gespeichert; Löschen → Zeile weg, „Rückgängig“ → Zeile wieder da (gleiche ID, kein DELETE im Netzwerk-Tab); Löschen ohne Undo → nach ~6 s `DELETE`. Bildfeld anlegen → im Dokument-Editor (Kopf) Bild hochladen, Vorschaubild erscheint.

- [ ] **Step 12: Commit**

```bash
git add resources/js lang
git commit -m "feat: custom fields page with doc type toggles, drawer preview, undo and image upload" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 9: Einstellungen „Organisation“ mit Logo-Upload und Links aus der Prüfanzeige

**Files:**
- Create: `app/Actions/UpdateOrganizationLogo.php`, `app/Actions/RemoveOrganizationLogo.php`, `app/Actions/ReadOrganizationLogo.php`
- Create: `app/Http/Controllers/Api/OrganizationLogoController.php`
- Modify: `routes/api.php`, `app/OpenApi/OpenApiFactory.php`, `app/ApiResource/OrganizationResource.php` (Docblock)
- Modify: `resources/js/api/settings.ts`, `resources/js/api/keys.ts`, `resources/js/api/keys.test.ts`
- Create: `resources/js/settings/save-bar.tsx`, `resources/js/settings/settings-card.tsx`, `resources/js/settings/organization.tsx`
- Modify: `resources/js/pages/settings/show.tsx`, `resources/js/editor/components/compliance-panel.tsx`
- Modify: `lang/en.json`, `lang/de.json`
- Test: `tests/Feature/Actions/OrganizationLogoTest.php`, `tests/Feature/Api/RightsMatrixTest.php`, `tests/Feature/Api/OpenApiTest.php`

**Interfaces:**
- Consumes: `StoredImage` (Task 7), `AssetInliner::logo` (Phase 3), `CustomFieldInput`, `useFieldDefinitions('org')`, `jumpTo` (`resources/js/editor/jump.ts`), `useLeaveGuard`.
- Produces:
  - Actions laut Interfaces; Routen `GET|POST|DELETE /api/organization/logo`
  - `api/settings.ts`: `type Organization`, `type OrganizationInput`, `useOrganization()`, `saveOrganization(input: OrganizationInput): Promise<Organization>`, `uploadLogo(file: File): Promise<void>`, `removeLogo(): Promise<void>`, `logoUrl(organization: Organization): string`
  - `SaveBar` (`resources/js/settings/save-bar.tsx`): Props `{ dirty: boolean; pending: boolean; onReset(): void; label?: string }` – Task 10 nutzt sie
  - `SettingsCard` (`resources/js/settings/settings-card.tsx`): Props `HTMLAttributes<HTMLElement> & { flush?: boolean }` – Tasks 10, 11, 13 nutzen sie
  - `useFocusFromUrl(ready: boolean): void` (in `organization.tsx` exportiert; springt einmal zu `?focus=<data-path>`)

- [ ] **Step 1: Failing Pest-Test**

`tests/Feature/Actions/OrganizationLogoTest.php`:

```php
<?php

use App\Actions\RenderPreview;
use App\Models\Organization;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

const LOGO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="10"><rect width="40" height="10" fill="#2f55d4"/></svg>';

beforeEach(fn () => $this->withToken(apiToken()));

it('uploads, serves and removes the logo', function () {
    $this->post('/api/organization/logo', ['logo' => UploadedFile::fake()->createWithContent('logo.svg', LOGO_SVG)], ['Accept' => 'application/json'])
        ->assertOk()
        ->assertJsonPath('has_logo', true);

    $path = Organization::current()->logo_path;
    expect($path)->toMatch('#^logos/[0-9a-z]{26}\.svg$#')
        ->and(Storage::disk('local')->get($path))->toBe(LOGO_SVG);
    $this->getJson('/api/organization')->assertJsonPath('has_logo', true);

    $file = $this->get('/api/organization/logo')->assertOk();
    expect($file->getContent())->toBe(LOGO_SVG)
        ->and($file->headers->get('Content-Type'))->toBe('image/svg+xml')
        ->and($file->headers->get('Content-Security-Policy'))->toContain('sandbox');

    $this->deleteJson('/api/organization/logo')->assertNoContent();
    $this->getJson('/api/organization')->assertJsonPath('has_logo', false);
    $this->get('/api/organization/logo')->assertNotFound();
    // finalized documents may point at the old file through their snapshot: it stays
    expect(Storage::disk('local')->exists($path))->toBeTrue();
});

it('puts the logo into templates as data URL', function () {
    $this->post('/api/organization/logo', ['logo' => UploadedFile::fake()->createWithContent('logo.svg', LOGO_SVG)], ['Accept' => 'application/json'])->assertOk();

    $body = app(RenderPreview::class)->handle(systemActor(), ['scenario' => 'short_invoice', 'template' => ['body' => '<img src="{{ org.logo }}">']])->render->body;

    expect($body)->toContain('src="data:image/svg+xml;base64,'.base64_encode(LOGO_SVG).'"');
});

it('refuses non-images and keeps the old logo (review focus)', function () {
    $this->post('/api/organization/logo', ['logo' => UploadedFile::fake()->createWithContent('logo.svg', LOGO_SVG)], ['Accept' => 'application/json'])->assertOk();
    $before = Organization::current()->logo_path;

    $this->post('/api/organization/logo', ['logo' => UploadedFile::fake()->createWithContent('logo.png', 'not an image')], ['Accept' => 'application/json'])
        ->assertUnprocessable()
        ->assertJsonPath('violations.0.path', 'logo');
    $this->post('/api/organization/logo', [], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonPath('violations.0.path', 'logo');

    expect(Organization::current()->logo_path)->toBe($before);
});
```

- [ ] **Step 2: Matrix und OpenAPI-Erwartung ergänzen**

`SampleDataFactory::org()` nimmt die echte Organisation (`SnapshotBuilder::orgRow(Organization::current())`) samt `logo_path` – Test 2 rendert deshalb das Szenario mit dem hochgeladenen Logo.

In `tests/Feature/Api/RightsMatrixTest.php` (`MATRIX_ROUTES`):

```php
    'organization logo' => ['GET', '/api/organization/logo', MATRIX_READ],
    'upload organization logo' => ['POST', '/api/organization/logo', ['api:write']],
    'remove organization logo' => ['DELETE', '/api/organization/logo', ['api:write']],
```

In `tests/Feature/Api/OpenApiTest.php` `'/api/organization/logo'` ergänzen.

Run: `ddev artisan test --filter='OrganizationLogoTest|RightsMatrixTest|OpenApiTest'`
Expected: FAIL (Routen fehlen).

- [ ] **Step 3: Actions**

`app/Actions/UpdateOrganizationLogo.php`:

```php
<?php

namespace App\Actions;

use App\Models\Organization;
use App\Support\Actor;
use App\Support\StoredImage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * POST /api/organization/logo: a new logo file (logos/<ulid>.<ext>). The previous file stays: snapshots of finalized
 * documents keep pointing at it.
 */
final class UpdateOrganizationLogo
{
    /**
     * @throws ValidationException under "logo"
     */
    public function handle(Actor $actor, UploadedFile $file): Organization
    {
        [$extension, $contents] = StoredImage::validate($file, 'logo');
        $path = 'logos/'.strtolower((string) Str::ulid()).'.'.$extension;
        Storage::disk('local')->put($path, $contents);

        $org = Organization::current();
        $org->forceFill(['logo_path' => $path])->save();

        return $org;
    }
}
```

`app/Actions/RemoveOrganizationLogo.php`:

```php
<?php

namespace App\Actions;

use App\Models\Organization;
use App\Support\Actor;

/** DELETE /api/organization/logo: templates show the company name again; the file stays for snapshots. */
final class RemoveOrganizationLogo
{
    public function handle(Actor $actor): Organization
    {
        $org = Organization::current();
        $org->forceFill(['logo_path' => null])->save();

        return $org;
    }
}
```

`app/Actions/ReadOrganizationLogo.php`:

```php
<?php

namespace App\Actions;

use App\Models\Organization;
use App\Rendering\TemplatePackage;
use App\Support\Actor;
use App\Support\DownloadFile;
use Illuminate\Support\Facades\Storage;

/** GET /api/organization/logo: the current logo, null without one. */
final class ReadOrganizationLogo
{
    public function handle(Actor $actor): ?DownloadFile
    {
        $path = Organization::current()->logo_path;
        if ($path === null || $path === '') {
            return null;
        }
        $contents = Storage::disk('local')->get($path);

        return $contents === null ? null : new DownloadFile(basename($path), TemplatePackage::mimeOf($path), $contents);
    }
}
```

- [ ] **Step 4: Controller, Routen, OpenAPI**

`app/Http/Controllers/Api/OrganizationLogoController.php`:

```php
<?php

namespace App\Http\Controllers\Api;

use App\Actions\ReadOrganizationLogo;
use App\Actions\RemoveOrganizationLogo;
use App\Actions\UpdateOrganizationLogo;
use App\Http\Api\ApiJson;
use App\Http\Api\CurrentActor;
use App\Http\Api\FileResponse;
use App\Http\Controllers\Controller;
use App\Support\StoredImage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Validator;

/** GET|POST|DELETE /api/organization/logo (multipart "logo"). */
final class OrganizationLogoController extends Controller
{
    public function show(Request $request, ReadOrganizationLogo $read): Response
    {
        $file = $read->handle(CurrentActor::from($request)) ?? abort(404);

        return FileResponse::download($file, inline: true)->withHeaders(StoredImage::headers());
    }

    public function store(Request $request, UpdateOrganizationLogo $update): JsonResponse
    {
        /** @var UploadedFile $file */
        $file = Validator::make($request->allFiles(), ['logo' => ['required', 'file']])->validate()['logo'];
        $org = $update->handle(CurrentActor::from($request), $file);

        return ApiJson::ok(['has_logo' => true, 'updated_at' => $org->updated_at?->toAtomString()]);
    }

    public function destroy(Request $request, RemoveOrganizationLogo $remove): Response
    {
        $remove->handle(CurrentActor::from($request));

        return response()->noContent();
    }
}
```

`routes/api.php`: in die `READ`-Gruppe `Route::get('/organization/logo', [OrganizationLogoController::class, 'show'])->name('api.organization.logo');`, in die `WRITE`-Gruppe `Route::post('/organization/logo', [OrganizationLogoController::class, 'store'])->name('api.organization.logo.store');` und `Route::delete('/organization/logo', [OrganizationLogoController::class, 'destroy'])->name('api.organization.logo.destroy');`.

`OpenApiFactory::paths()`:

```php
            '/api/organization/logo' => new PathItem(
                get: new Operation(
                    operationId: 'getOrganizationLogo',
                    tags: ['Organization'],
                    responses: self::responses(self::file('image/*', 'The current logo (404 without one).')),
                    summary: 'Downloads the logo of the organization.',
                ),
                post: new Operation(
                    operationId: 'uploadOrganizationLogo',
                    tags: ['Organization'],
                    responses: self::responses(self::json('has_logo and updated_at.')),
                    summary: 'Replaces the logo (PNG, JPEG, GIF, WebP, SVG, at most 1 MB).',
                    requestBody: new RequestBody('Multipart form with the field "logo"', new ArrayObject(['multipart/form-data' => ['schema' => [
                        'type' => 'object', 'properties' => ['logo' => ['type' => 'string', 'format' => 'binary']], 'required' => ['logo'],
                    ]]]), true),
                ),
                delete: new Operation(
                    operationId: 'removeOrganizationLogo',
                    tags: ['Organization'],
                    responses: self::responses(new Response('Logo removed')),
                    summary: 'Removes the logo; templates show the company name again.',
                ),
            ),
```

Docblock von `OrganizationResource`: „The one organization of this instance (sender of every document). The logo has its own endpoints (/api/organization/logo).“

Run: `ddev artisan test --filter='OrganizationLogoTest|RightsMatrixTest|OpenApiTest|ContextBuilderTest'`
Expected: PASS.

- [ ] **Step 5: API-Funktionen im Frontend**

`resources/js/api/keys.ts`: `organization: () => '/api/organization',` (+ Test `expect(keys.organization()).toBe('/api/organization');`).

`resources/js/api/settings.ts` ergänzen:

```ts
import { mutate } from 'swr';
import { api, apiUpload } from '@/lib/api';
import type { CustomValues } from './types';

/** GET /api/organization (OrganizationResource). */
export type Organization = {
    id: string;
    name: string;
    street: string;
    zip: string;
    city: string;
    country: string;
    has_logo: boolean;
    vat_id: string;
    tax_number: string;
    registration_id: string;
    iban: string;
    bic: string;
    bank_name: string;
    email: string;
    phone: string;
    website: string;
    taxation_mode: 'regular' | 'small_business';
    locale: string;
    custom: CustomValues;
    updated_at: string | null;
};

export type OrganizationInput = Omit<Organization, 'id' | 'has_logo' | 'updated_at'>;

export function useOrganization() {
    return useSWR<Organization>(keys.organization());
}

export async function saveOrganization(input: OrganizationInput): Promise<Organization> {
    const saved = await api<Organization>(keys.organization(), { method: 'PATCH', body: input });
    await mutate(keys.organization(), saved, { revalidate: false });
    return saved;
}

export async function uploadLogo(file: File): Promise<void> {
    const form = new FormData();
    form.append('logo', file);
    await apiUpload('/api/organization/logo', form);
    await mutate(keys.organization());
}

export async function removeLogo(): Promise<void> {
    await api<void>('/api/organization/logo', { method: 'DELETE' });
    await mutate(keys.organization());
}

/** Changes with every new logo, so the browser does not show a cached old one. */
export const logoUrl = (organization: Organization): string => `/api/organization/logo?v=${encodeURIComponent(organization.updated_at ?? '')}`;
```

(Die `import`-Zeilen an den Anfang der Datei zu den vorhandenen ziehen.)

- [ ] **Step 6: Speichern-Leiste und Karte der Einstellungen**

`resources/js/settings/settings-card.tsx` (die Karten der Einstellungen stehen wie im Klickdummy in `bg` auf der `surface`-Seite; `Card` setzt selbst `bg-surface`, ein zweites `bg-*` wäre ein Klassenkonflikt):

```tsx
import type { HTMLAttributes } from 'react';
import { cx } from '@/components/ui';

/** Card of the settings sections: page-coloured (bg) on the surface of the page, 18 px radius. */
export function SettingsCard({ flush = false, className, children, ...rest }: HTMLAttributes<HTMLElement> & { flush?: boolean }) {
    return (
        <section className={cx('min-w-0 rounded-lg bg-bg', flush ? 'overflow-hidden' : 'p-5', className)} {...rest}>
            {children}
        </section>
    );
}
```

`resources/js/settings/save-bar.tsx`:

```tsx
import { Button } from '@/components/ui';
import { t } from '@/lib/i18n';

/** Bar that slides in at the bottom while a settings form has unsaved changes (submit = form submit). */
export function SaveBar({ dirty, pending, onReset, label }: { dirty: boolean; pending: boolean; onReset(): void; label?: string }) {
    if (!dirty && !pending) return null;
    return (
        <div role="region" aria-label={t('settings.unsaved_region')} className="sticky bottom-4 z-20 flex animate-fade-in flex-wrap items-center gap-2 rounded-full bg-ink py-2 pr-2 pl-5 text-sm font-medium text-bg shadow-float">
            <span>{t('settings.unsaved')}</span>
            <span className="flex-1" />
            <button type="button" onClick={onReset} disabled={pending} className="h-control-sm rounded-full px-3 text-bg opacity-75 transition-opacity hover:opacity-100 disabled:opacity-40">
                {t('settings.discard')}
            </button>
            <Button size="sm" variant="primary" type="submit" pending={pending}>
                {label ?? t('settings.save')}
            </Button>
        </div>
    );
}
```

- [ ] **Step 7: Formular „Organisation“**

`resources/js/settings/organization.tsx`:

```tsx
import { Link } from '@inertiajs/react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useFieldDefinitions } from '@/api/fields';
import { logoUrl, removeLogo, saveOrganization, uploadLogo, useOrganization, type Organization, type OrganizationInput } from '@/api/settings';
import { CustomFieldInput } from '@/components/custom-field-input';
import { Button, CardHead, ErrorState, Select, Skeleton, TextInput, cx } from '@/components/ui';
import { SettingsCard } from './settings-card';
import { jumpTo } from '@/editor/jump';
import { ApiError, errorMessage } from '@/lib/api';
import { useLeaveGuard } from '@/lib/hooks';
import { path, t } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { uploadError } from '@/templates/import-button';
import { SaveBar } from './save-bar';

const TAXATION = ['regular', 'small_business'] as const;

/** ?focus=org.vat_id (links from the document editor's compliance panel): jump once the form is there. */
export function useFocusFromUrl(ready: boolean): void {
    const done = useRef(false);
    useEffect(() => {
        if (!ready || done.current) return;
        const focus = new URLSearchParams(window.location.search).get('focus');
        done.current = true;
        if (focus) requestAnimationFrame(() => jumpTo(focus));
    }, [ready]);
}

export function OrganizationSettings() {
    const organization = useOrganization();
    useFocusFromUrl(!!organization.data);

    if (organization.error) return <ErrorState error={organization.error} onRetry={() => void organization.mutate()} />;
    if (!organization.data) return <Skeleton h={420} r={18} />;
    return <OrganizationForm key={organization.data.updated_at ?? 'org'} saved={organization.data} />;
}

const inputOf = ({ id: _id, has_logo: _logo, updated_at: _updated, ...input }: Organization): OrganizationInput => input;

function OrganizationForm({ saved }: { saved: Organization }) {
    const [org, setOrg] = useState<OrganizationInput>(() => inputOf(saved));
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [pending, setPending] = useState(false);
    const [logoPending, setLogoPending] = useState(false);
    const fields = useFieldDefinitions('org');
    const logoInput = useRef<HTMLInputElement>(null);
    const dirty = JSON.stringify(org) !== JSON.stringify(inputOf(saved));
    const releaseGuard = useLeaveGuard(dirty, t('settings.leave_confirm'));
    const set = (patch: Partial<OrganizationInput>) => setOrg((current) => ({ ...current, ...patch }));
    const text = (key: keyof OrganizationInput, label: string, extra: Partial<Parameters<typeof TextInput>[0]> = {}) => (
        <TextInput label={label} value={String(org[key] ?? '')} error={errors[key]} onChange={(e) => set({ [key]: e.target.value } as Partial<OrganizationInput>)} {...extra} />
    );

    const submit = async () => {
        setPending(true);
        try {
            await saveOrganization(org);
            releaseGuard();
            setErrors({});
            toast.success(t('settings.org_saved'));
        } catch (error) {
            if (error instanceof ApiError && error.status === 422) setErrors(error.fieldErrors());
            toast.error(errorMessage(error));
        } finally {
            setPending(false);
        }
    };

    const onLogo = async (file: File | undefined) => {
        if (!file) return;
        setLogoPending(true);
        try {
            await uploadLogo(file);
            toast.success(t('settings.logo_saved'));
        } catch (error) {
            toast.error(uploadError(error));
        } finally {
            setLogoPending(false);
        }
    };

    return (
        <form
            noValidate
            className="grid gap-6"
            onSubmit={(e) => {
                e.preventDefault();
                void submit();
            }}
        >
            <SettingsCard aria-labelledby="org-company">
                <CardHead titleId="org-company" title={t('settings.company')} description={t('settings.company_text')} />
                <div className="grid gap-4">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className={cx('grid size-20 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface p-2')}>
                            {saved.has_logo ? <img src={logoUrl(saved)} alt={t('settings.logo')} className="max-h-full max-w-full object-contain" /> : <span className="text-xl font-bold tracking-brand text-faint">{(org.name || 'Lo').slice(0, 2)}</span>}
                        </div>
                        <div className="grid gap-2">
                            <div className="flex flex-wrap gap-2">
                                <input
                                    ref={logoInput}
                                    type="file"
                                    accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                                    hidden
                                    onChange={(e) => {
                                        void onLogo(e.target.files?.[0]);
                                        e.target.value = '';
                                    }}
                                />
                                <Button size="sm" icon={<ImagePlus />} pending={logoPending} onClick={() => logoInput.current?.click()}>
                                    {saved.has_logo ? t('settings.logo_replace') : t('settings.logo_upload')}
                                </Button>
                                {saved.has_logo && (
                                    <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => void removeLogo().catch((error: unknown) => toast.error(errorMessage(error)))}>
                                        {t('settings.logo_remove')}
                                    </Button>
                                )}
                            </div>
                            <p className="text-xs text-muted">{t('settings.logo_hint')}</p>
                        </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2" data-path="org.address">
                        {text('name', t('settings.org_name'), { wrapClassName: 'sm:col-span-2' })}
                        {text('street', t('settings.street'), { wrapClassName: 'sm:col-span-2' })}
                        {text('zip', t('settings.zip'))}
                        {text('city', t('settings.city'))}
                        {text('country', t('settings.country'), { maxLength: 2, hint: t('settings.country_hint') })}
                    </div>
                </div>
            </SettingsCard>

            <SettingsCard aria-labelledby="org-tax">
                <CardHead titleId="org-tax" title={t('settings.taxation')} description={t('settings.taxation_text')} />
                <div role="radiogroup" aria-labelledby="org-tax" className="grid gap-3 sm:grid-cols-2">
                    {TAXATION.map((mode) => (
                        <label
                            key={mode}
                            className={cx('relative grid cursor-pointer gap-1 rounded-lg py-4 pr-4 pl-11 transition-colors', org.taxation_mode === mode ? 'bg-accent-soft' : 'bg-surface hover:bg-surface-2')}
                        >
                            <input type="radio" name="taxation_mode" value={mode} checked={org.taxation_mode === mode} onChange={() => set({ taxation_mode: mode })} className="absolute top-[1.15rem] left-4 size-4 accent-[var(--accent)]" />
                            <span className={cx('font-heading', org.taxation_mode === mode && 'text-accent')}>{t(`settings.taxation.${mode}`)}</span>
                            <span className="text-sm text-muted">{t(`settings.taxation.${mode}_text`)}</span>
                        </label>
                    ))}
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {text('vat_id', t('settings.vat_id'), { placeholder: 'DE123456789', path: 'org.vat_id' })}
                    {text('tax_number', t('settings.tax_number'), { hint: t('settings.tax_number_hint') })}
                    {text('registration_id', t('settings.registration_id'), { hint: t('settings.registration_id_hint'), path: 'org.registration_id', wrapClassName: 'sm:col-span-2' })}
                </div>
            </SettingsCard>

            <SettingsCard aria-labelledby="org-bank">
                <CardHead titleId="org-bank" title={t('settings.bank_contact')} description={t('settings.bank_contact_text')} />
                <div className="grid gap-4 sm:grid-cols-2">
                    {text('iban', t('settings.iban'), { wrapClassName: 'sm:col-span-2', className: 'num', path: 'org.iban' })}
                    {text('bic', t('settings.bic'))}
                    {text('bank_name', t('settings.bank_name'))}
                    {text('email', t('settings.email'), { type: 'email' })}
                    {text('phone', t('settings.phone'), { type: 'tel' })}
                    {text('website', t('settings.website'))}
                    <Select label={t('settings.locale')} hint={t('settings.locale_hint')} value={org.locale} error={errors.locale} onChange={(e) => set({ locale: e.target.value })}>
                        <option value="de">Deutsch</option>
                        <option value="en">English</option>
                    </Select>
                </div>
            </SettingsCard>

            <SettingsCard aria-labelledby="org-fields">
                <CardHead
                    titleId="org-fields"
                    title={t('settings.custom_fields')}
                    description={t('settings.custom_fields_text')}
                    actions={
                        <Link href={path('/fields?scope=org')} className="text-sm">
                            {t('settings.manage_fields')}
                        </Link>
                    }
                />
                {(fields.data ?? []).length > 0 ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                        {fields.data!.map((definition) => (
                            <CustomFieldInput
                                key={definition.id}
                                definition={definition}
                                path={`org.${definition.key}`}
                                value={org.custom[definition.key]}
                                error={errors[`custom.${definition.key}`]}
                                onChange={(value) => set({ custom: { ...org.custom, [definition.key]: value } })}
                            />
                        ))}
                    </div>
                ) : (
                    <p className="text-muted">{t('settings.no_custom_fields')}</p>
                )}
            </SettingsCard>

            <SaveBar dirty={dirty} pending={pending} onReset={() => setOrg(inputOf(saved))} />
        </form>
    );
}
```

Prüfpfade: `org.address` (Hülle der Adressfelder), `org.vat_id`, `org.registration_id`, `org.iban`, `org.<schlüssel>` – das sind genau die Pfade aus `ComplianceChecker` (`org.address`, `org.vat_id`, `org.registration_id`, `org.iban`, eigene Felder `org.` + Schlüssel).

- [ ] **Step 8: Abschnitt einhängen und Prüfanzeige verlinken**

In `resources/js/pages/settings/show.tsx`: `import { OrganizationSettings } from '@/settings/organization';` und in `renderSection()` vor `default:`:

```tsx
        case 'organization':
            return <OrganizationSettings />;
```

In `resources/js/editor/components/compliance-panel.tsx` den `org.`-Zweig ersetzen:

```tsx
                            ) : issue.path.startsWith('org.') ? (
                                <Link href={path(`/settings/organization?focus=${encodeURIComponent(issue.path)}`)} className={ITEM}>
                                    {issue.message}
                                    <span className={WHERE}>
                                        {t('editor.check.org')}
                                        <ArrowUpRight aria-hidden />
                                    </span>
                                </Link>
```

Der Editor speichert beim Verlassen automatisch (Phase 6, `router.on('before')`), der Link verliert also nichts.

- [ ] **Step 9: Übersetzungen**

`lang/en.json`:

```json
"settings.bank_contact": "Bank and contact",
"settings.bank_contact_text": "For payment details and the footer.",
"settings.bank_name": "Bank",
"settings.bic": "BIC",
"settings.city": "City",
"settings.company": "Company",
"settings.company_text": "Appears as sender, in header and footer and in the e-invoice.",
"settings.country": "Country",
"settings.country_hint": "ISO 3166 country code, e.g. DE",
"settings.custom_fields": "Custom fields",
"settings.custom_fields_text": "Additional details about your company, in templates under org.",
"settings.discard": "Discard",
"settings.email": "Email",
"settings.iban": "IBAN",
"settings.leave_confirm": "The settings have unsaved changes. Leave anyway?",
"settings.locale": "Document language",
"settings.locale_hint": "Default for new customers and documents.",
"settings.logo": "Logo",
"settings.logo_hint": "SVG or PNG, at most 1 MB. Without a logo, templates show the company name.",
"settings.logo_remove": "Remove",
"settings.logo_replace": "Replace logo",
"settings.logo_saved": "Logo saved",
"settings.logo_upload": "Upload logo",
"settings.manage_fields": "Manage fields",
"settings.no_custom_fields": "No custom fields yet. Add them under custom fields, for example for commercial register or managing directors.",
"settings.org_name": "Name",
"settings.org_saved": "Organization saved",
"settings.phone": "Phone",
"settings.registration_id": "Register number",
"settings.registration_id_hint": "Commercial register or similar (BT-30). Required for e-invoices without VAT ID and for services to customers outside the EU.",
"settings.save": "Save",
"settings.street": "Street and number",
"settings.tax_number": "Tax number",
"settings.tax_number_hint": "Enough for the e-invoice if you have no VAT ID.",
"settings.taxation": "Taxation",
"settings.taxation.regular": "Standard taxation",
"settings.taxation.regular_text": "You charge VAT. You choose the rate per position.",
"settings.taxation.small_business": "Small business (§ 19 UStG)",
"settings.taxation.small_business_text": "No VAT. The required note is added to every document.",
"settings.taxation_text": "Decides which tax rates you can choose on positions.",
"settings.unsaved": "You have unsaved changes.",
"settings.unsaved_region": "Unsaved changes",
"settings.vat_id": "VAT ID",
"settings.website": "Website",
"settings.zip": "Postcode"
```

`lang/de.json`:

```json
"settings.bank_contact": "Bank und Kontakt",
"settings.bank_contact_text": "Für Zahlungsangaben und die Fußzeile.",
"settings.bank_name": "Bank",
"settings.bic": "BIC",
"settings.city": "Ort",
"settings.company": "Firma",
"settings.company_text": "Steht im Absender, in Kopf- und Fußzeile und in der E-Rechnung.",
"settings.country": "Land",
"settings.country_hint": "Ländercode nach ISO 3166, z. B. DE",
"settings.custom_fields": "Eigene Felder",
"settings.custom_fields_text": "Zusätzliche Angaben zu deiner Firma, im Template unter org.",
"settings.discard": "Verwerfen",
"settings.email": "E-Mail",
"settings.iban": "IBAN",
"settings.leave_confirm": "Die Einstellungen haben ungespeicherte Änderungen. Trotzdem verlassen?",
"settings.locale": "Dokumentsprache",
"settings.locale_hint": "Vorgabe für neue Kunden und Dokumente.",
"settings.logo": "Logo",
"settings.logo_hint": "SVG oder PNG, höchstens 1 MB. Ohne Logo zeigen die Templates den Firmennamen.",
"settings.logo_remove": "Entfernen",
"settings.logo_replace": "Logo ersetzen",
"settings.logo_saved": "Logo gespeichert",
"settings.logo_upload": "Logo hochladen",
"settings.manage_fields": "Felder verwalten",
"settings.no_custom_fields": "Noch keine eigenen Felder. Lege sie unter „Eigene Felder“ an, etwa für Handelsregister oder Geschäftsführung.",
"settings.org_name": "Name",
"settings.org_saved": "Organisation gespeichert",
"settings.phone": "Telefon",
"settings.registration_id": "Registernummer",
"settings.registration_id_hint": "Handelsregister o. Ä. (BT-30). Pflicht für E-Rechnungen ohne USt-ID und für Dienstleistungen an Kunden außerhalb der EU.",
"settings.save": "Speichern",
"settings.street": "Straße und Hausnummer",
"settings.tax_number": "Steuernummer",
"settings.tax_number_hint": "Reicht für die E-Rechnung, wenn du keine USt-ID hast.",
"settings.taxation": "Besteuerung",
"settings.taxation.regular": "Regelbesteuerung",
"settings.taxation.regular_text": "Du weist Umsatzsteuer aus. Pro Position wählst du den Steuersatz.",
"settings.taxation.small_business": "Kleinunternehmer (§ 19 UStG)",
"settings.taxation.small_business_text": "Keine Umsatzsteuer. Der Pflichthinweis kommt automatisch auf jedes Dokument.",
"settings.taxation_text": "Bestimmt, welche Steuersätze du an Positionen wählen kannst.",
"settings.unsaved": "Du hast ungespeicherte Änderungen.",
"settings.unsaved_region": "Ungespeicherte Änderungen",
"settings.vat_id": "USt-ID",
"settings.website": "Website",
"settings.zip": "PLZ"
```

- [ ] **Step 10: Prüfen**

Run: `ddev exec pnpm typecheck && ddev exec pnpm test && ddev artisan test --filter='Organization|TranslationsTest|RightsMatrixTest'`
Expected: PASS.

Manuell: Entwurfsrechnung mit E-Rechnungs-Profil ohne IBAN öffnen → Prüfpunkt „IBAN fehlt“ ist ein Link → Einstellungen öffnen, IBAN-Feld leuchtet auf und hat den Fokus; Logo hochladen → Vorschau im Editor zeigt es.

- [ ] **Step 11: Commit**

```bash
ddev exec vendor/bin/pint && ddev exec vendor/bin/phpstan analyse --memory-limit=1G
git add app routes resources/js lang tests
git commit -m "feat: organization settings with logo upload, taxation and links from the compliance panel" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 10: Einstellungen „Dokumenttypen“ mit Nummernvorschau vom Server

**Files:**
- Create: `app/Actions/PreviewDocumentNumber.php`, `app/Http/Controllers/Api/NumberPreviewController.php`
- Modify: `routes/api.php`, `app/OpenApi/OpenApiFactory.php`
- Modify: `resources/js/api/settings.ts`, `resources/js/api/keys.ts`, `resources/js/api/keys.test.ts`
- Create: `resources/js/settings/document-types.tsx`
- Modify: `resources/js/pages/settings/show.tsx`
- Modify: `lang/en.json`, `lang/de.json`
- Test: `tests/Feature/Actions/NumberPreviewTest.php`, `tests/Feature/Api/RightsMatrixTest.php`, `tests/Feature/Api/OpenApiTest.php`

**Interfaces:**
- Consumes: `NumberFormatter` (Domain), `AllocateDocumentNumber::nextValue()`, `useDocumentTypes`/`DocumentTypeSetting` (Task 3), `useTemplates` (Task 3), `useTextBlocks` (`api/master-data.ts`), `useFieldDefinitions`, `SaveBar` (Task 9), `PATCH /api/document-types/{type}` (Phase 4).
- Produces: `PreviewDocumentNumber::handle(Actor, DocumentType, array): array{number: ?string, valid: bool, message: ?string}`; Route `GET /api/document-types/{type}/number-preview`; `keys.numberPreview(type, pattern, resetYearly, nextValue)`; `useNumberPreview(type, pattern, resetYearly, nextValue)`, `type DocumentTypeInput`, `saveDocumentType(type: DocumentType, input: DocumentTypeInput): Promise<DocumentTypeSetting>`.

- [ ] **Step 1: Failing Test**

`tests/Feature/Actions/NumberPreviewTest.php`:

```php
<?php

use App\Actions\PreviewDocumentNumber;
use App\Enums\DocumentType;

beforeEach(fn () => $this->travelTo('2026-10-12 10:00:00'));

it('formats an unsaved pattern with the given or the current next value', function () {
    $preview = app(PreviewDocumentNumber::class);

    expect($preview->handle(systemActor(), DocumentType::Invoice, ['pattern' => 'RE-{YY}{MM}-{00000}', 'reset_yearly' => '1', 'next_value' => '42']))
        ->toBe(['number' => 'RE-2610-00042', 'valid' => true, 'message' => null])
        ->and($preview->handle(systemActor(), DocumentType::Offer, ['pattern' => 'Q-{YYYY}-{0000}'])['number'])->toBe('Q-2026-0001');
});

it('explains invalid patterns instead of formatting them', function (array $input, string $text) {
    $result = app(PreviewDocumentNumber::class)->handle(systemActor(), DocumentType::Invoice, $input);

    expect($result['valid'])->toBeFalse()
        ->and($result['number'])->toBeNull()
        ->and($result['message'])->toContain($text);
})->with([
    'no running number' => [['pattern' => 'RE-{YYYY}'], '{0000}'],
    'yearly reset without year' => [['pattern' => 'RE-{0000}', 'reset_yearly' => '1'], '{YYYY}'],
]);

it('answers over the API and 404 for unknown types', function () {
    $this->withToken(apiToken(['api:read']));

    $this->getJson('/api/document-types/invoice/number-preview?pattern=INV-{YYYY}-{0000}&reset_yearly=1&next_value=7')
        ->assertOk()
        ->assertJsonPath('number', 'INV-2026-0007');
    $this->getJson('/api/document-types/invoice/number-preview')->assertUnprocessable()->assertJsonPath('violations.0.path', 'pattern');
    $this->getJson('/api/document-types/receipt/number-preview?pattern=X-{0}')->assertNotFound();
});
```

`MATRIX_ROUTES` ergänzen: `'number preview' => ['GET', '/api/document-types/invoice/number-preview', MATRIX_READ],` und im Guard-Test die Ersetzung `str_replace('/document-types/invoice', '/document-types/{type}', …)` greift schon. `OpenApiTest`: `'/api/document-types/{type}/number-preview'`.

Run: `ddev artisan test --filter='NumberPreviewTest|RightsMatrixTest|OpenApiTest'`
Expected: FAIL.

- [ ] **Step 2: Action und Controller**

`app/Actions/PreviewDocumentNumber.php`:

```php
<?php

namespace App\Actions;

use App\Domain\Numbering\NumberFormatter;
use App\Enums\DocumentType;
use App\Support\Actor;
use App\Support\Text;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

/**
 * GET /api/document-types/{type}/number-preview: the next number for an unsaved pattern (settings form). The same
 * rules as UpdateDocumentType; problems come back as message instead of 422, so the preview can explain them.
 */
final class PreviewDocumentNumber
{
    public function __construct(private readonly AllocateDocumentNumber $numbers) {}

    /**
     * @param  array<string, mixed>  $input  pattern, reset_yearly?, next_value?
     * @return array{number: string|null, valid: bool, message: string|null}
     *
     * @throws ValidationException
     */
    public function handle(Actor $actor, DocumentType $type, array $input): array
    {
        $data = Validator::make($input, [
            'pattern' => ['required', 'string', 'max:64'],
            'reset_yearly' => ['sometimes', 'boolean'],
            'next_value' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:99999999'],
        ])->validate();

        $pattern = (string) $data['pattern'];
        if (! NumberFormatter::isValidPattern($pattern)) {
            return ['number' => null, 'valid' => false, 'message' => Text::t('errors.number_pattern_sequence')];
        }
        if ((bool) ($data['reset_yearly'] ?? false) && ! NumberFormatter::hasYear($pattern)) {
            return ['number' => null, 'valid' => false, 'message' => Text::t('errors.number_pattern_year')];
        }
        $today = now();
        $sequence = isset($data['next_value']) ? (int) $data['next_value'] : $this->numbers->nextValue($type, $today->toDateString());

        return ['number' => NumberFormatter::format($pattern, $today, $sequence), 'valid' => true, 'message' => null];
    }
}
```

`app/Http/Controllers/Api/NumberPreviewController.php`:

```php
<?php

namespace App\Http\Controllers\Api;

use App\Actions\PreviewDocumentNumber;
use App\Enums\DocumentType;
use App\Http\Api\ApiJson;
use App\Http\Api\CurrentActor;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** GET /api/document-types/{type}/number-preview?pattern=&reset_yearly=&next_value= */
final class NumberPreviewController extends Controller
{
    public function __invoke(Request $request, PreviewDocumentNumber $preview): JsonResponse
    {
        $type = DocumentType::tryFrom((string) $request->route('type')) ?? abort(404);

        return ApiJson::ok($preview->handle(CurrentActor::from($request), $type, $request->query()));
    }
}
```

`routes/api.php` (READ-Gruppe): `Route::get('/document-types/{type}/number-preview', NumberPreviewController::class)->name('api.document-types.number-preview');` (keine `whereIn`-Einschränkung: unbekannte Typen beantwortet der Controller mit 404 als Problem Details, wie der Test verlangt).

`OpenApiFactory::paths()`:

```php
            '/api/document-types/{type}/number-preview' => new PathItem(get: new Operation(
                operationId: 'previewDocumentNumber',
                tags: ['DocumentType'],
                responses: self::responses(self::json('number (null when invalid), valid, message.')),
                summary: 'Previews the next number for a (not yet saved) pattern.',
                parameters: [
                    new Parameter('type', 'path', 'offer, confirmation, invoice or cancellation', true, schema: ['type' => 'string']),
                    $query('pattern', 'e.g. INV-{YYYY}-{0000}'),
                    $query('reset_yearly', '1 = start at 1 every year', 'boolean'),
                    $query('next_value', 'running number to show; default the current next value', 'integer'),
                ],
            )),
```

`lang/en.json`: `"errors.number_pattern_sequence": "The pattern needs a running number, e.g. {0000}."`; `lang/de.json`: `"errors.number_pattern_sequence": "Das Muster braucht eine laufende Nummer, zum Beispiel {0000}."`

Run: `ddev artisan test --filter='NumberPreviewTest|RightsMatrixTest|OpenApiTest'`
Expected: PASS.

- [ ] **Step 3: Frontend-API (TDD für den Schlüssel)**

`keys.test.ts` ergänzen:

```ts
    it('builds the number preview URL', () => {
        expect(keys.numberPreview('invoice', 'INV-{YYYY}-{0000}', true, 7)).toBe('/api/document-types/invoice/number-preview?pattern=INV-%7BYYYY%7D-%7B0000%7D&reset_yearly=1&next_value=7');
        expect(keys.numberPreview('offer', 'Q-{0000}', false, null)).toBe('/api/document-types/offer/number-preview?pattern=Q-%7B0000%7D&reset_yearly=0');
    });
```

`keys.ts`:

```ts
    numberPreview: (type: DocumentType, pattern: string, resetYearly: boolean, nextValue: number | null) =>
        apiUrl(`/api/document-types/${type}/number-preview`, { pattern, reset_yearly: resetYearly ? 1 : 0, next_value: nextValue }),
```

(`DocumentType` aus `./types` importieren.)

`api/settings.ts` ergänzen (Imports `useDebounced` aus `@/lib/hooks`, `DocumentType` aus `./types` ergänzen):

```ts
export type DocumentTypeInput = {
    profile: ComplianceProfile;
    template_id: string | null;
    default_intro_block_id: string | null;
    default_closing_block_id: string | null;
    payment_term_days: number | null;
    validity_days: number | null;
    numbering: { pattern: string; reset_yearly: boolean; next_value?: number };
};

export async function saveDocumentType(type: DocumentType, input: DocumentTypeInput): Promise<DocumentTypeSetting> {
    const saved = await api<DocumentTypeSetting>(`/api/document-types/${type}`, { method: 'PATCH', body: input });
    await mutate(keys.documentTypes());
    return saved;
}

export type NumberPreview = { number: string | null; valid: boolean; message: string | null };

/** Next number for the pattern being typed, from the server (250 ms after the last keystroke). */
export function useNumberPreview(type: DocumentType, pattern: string, resetYearly: boolean, nextValue: number | null) {
    const key = useDebounced(keys.numberPreview(type, pattern, resetYearly, nextValue), 250);
    return useSWR<NumberPreview>(pattern.trim() ? key : null, { keepPreviousData: true, revalidateOnFocus: false });
}
```

Run: `ddev exec pnpm test -- resources/js/api/keys.test.ts` → PASS.

- [ ] **Step 4: Formular**

`resources/js/settings/document-types.tsx`:

```tsx
import { Link } from '@inertiajs/react';
import { ListPlus } from 'lucide-react';
import { useState } from 'react';
import { useFieldDefinitions } from '@/api/fields';
import { useTextBlocks } from '@/api/master-data';
import { saveDocumentType, useDocumentTypes, useNumberPreview, type DocumentTypeInput, type DocumentTypeSetting } from '@/api/settings';
import { useTemplates } from '@/api/templates';
import { DOCUMENT_TYPES, type ComplianceProfile, type DocumentType } from '@/api/types';
import { Badge, CardHead, Checkbox, ErrorState, Select, Skeleton, Tabs, TextInput, cx } from '@/components/ui';
import { SettingsCard } from './settings-card';
import { ApiError, errorMessage } from '@/lib/api';
import { useLeaveGuard } from '@/lib/hooks';
import { path, t } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { SaveBar } from './save-bar';

const PLACEHOLDERS = ['{YYYY}', '{YY}', '{MM}', '{0000}'] as const;
const PLACEHOLDER_KEYS: Record<(typeof PLACEHOLDERS)[number], string> = { '{YYYY}': 'year_long', '{YY}': 'year_short', '{MM}': 'month', '{0000}': 'sequence' };

export function DocumentTypeSettings() {
    const [type, setType] = useState<DocumentType>('invoice');
    const settings = useDocumentTypes();
    const current = settings.data?.find((setting) => setting.type === type);

    return (
        <div className="grid gap-6">
            <Tabs<DocumentType> label={t('settings.doc_type_label')} value={type} onChange={setType} items={DOCUMENT_TYPES.map((value) => ({ value, label: t(`document_type.${value}`) }))} />
            {settings.error ? (
                <ErrorState error={settings.error} onRetry={() => void settings.mutate()} />
            ) : !current ? (
                <Skeleton h={420} r={18} />
            ) : (
                <DocumentTypeForm key={`${type}:${JSON.stringify(current)}`} saved={current} />
            )}
        </div>
    );
}

const inputOf = (setting: DocumentTypeSetting): DocumentTypeInput => ({
    profile: setting.profile,
    template_id: setting.template_id,
    default_intro_block_id: setting.default_intro_block_id,
    default_closing_block_id: setting.default_closing_block_id,
    payment_term_days: setting.payment_term_days,
    validity_days: setting.validity_days,
    numbering: { pattern: setting.numbering.pattern, reset_yearly: setting.numbering.reset_yearly, next_value: setting.numbering.next_value },
});

function DocumentTypeForm({ saved }: { saved: DocumentTypeSetting }) {
    const type = saved.type;
    const [form, setForm] = useState<DocumentTypeInput>(() => inputOf(saved));
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [pending, setPending] = useState(false);
    const templates = useTemplates();
    const blocks = useTextBlocks();
    const documentFields = useFieldDefinitions('document');
    const positionFields = useFieldDefinitions('position');
    const preview = useNumberPreview(type, form.numbering.pattern, form.numbering.reset_yearly, form.numbering.next_value ?? null);
    const dirty = JSON.stringify(form) !== JSON.stringify(inputOf(saved));
    const releaseGuard = useLeaveGuard(dirty, t('settings.leave_confirm'));
    const set = (patch: Partial<DocumentTypeInput>) => setForm((current) => ({ ...current, ...patch }));
    const setNumbering = (patch: Partial<DocumentTypeInput['numbering']>) => setForm((current) => ({ ...current, numbering: { ...current.numbering, ...patch } }));
    const profiles: ComplianceProfile[] = type === 'invoice' || type === 'cancellation' ? ['basic', 'en16931'] : ['basic'];
    const templateOptions = (templates.data ?? []).filter((template) => template.document_types.includes(type) || template.id === form.template_id);
    const blockOptions = (kinds: string[]) => (blocks.data ?? []).filter((block) => kinds.includes(block.kind));
    const fieldsForType = [...(documentFields.data ?? []), ...(positionFields.data ?? [])].filter((field) => field.doc_types.includes(type));

    const submit = async () => {
        setPending(true);
        try {
            // send next_value only when it was changed: the counter may have moved since the page loaded
            const numbering = form.numbering.next_value === saved.numbering.next_value ? { pattern: form.numbering.pattern, reset_yearly: form.numbering.reset_yearly } : form.numbering;
            await saveDocumentType(type, { ...form, numbering });
            releaseGuard();
            setErrors({});
            toast.success(t('settings.doc_type_saved', { type: t(`document_type.${type}`) }));
        } catch (error) {
            if (error instanceof ApiError && error.status === 422) setErrors(error.fieldErrors());
            toast.error(errorMessage(error));
        } finally {
            setPending(false);
        }
    };

    const days = (key: 'payment_term_days' | 'validity_days', label: string) => (
        <TextInput
            label={label}
            type="number"
            min={0}
            max={365}
            inputMode="numeric"
            value={form[key] ?? ''}
            error={errors[key]}
            aside={<span className="text-xs">{t('settings.days')}</span>}
            onChange={(e) => set({ [key]: e.target.value === '' ? null : Math.max(0, Math.trunc(Number(e.target.value))) } as Partial<DocumentTypeInput>)}
        />
    );

    return (
        <form
            noValidate
            className="grid gap-6"
            onSubmit={(e) => {
                e.preventDefault();
                void submit();
            }}
        >
            <SettingsCard aria-labelledby="dt-profile">
                <CardHead titleId="dt-profile" title={t('settings.profile')} description={t('settings.profile_text')} />
                <div role="radiogroup" aria-labelledby="dt-profile" className="grid gap-3 sm:grid-cols-2">
                    {profiles.map((profile) => (
                        <label key={profile} className={cx('relative grid cursor-pointer gap-1 rounded-lg py-4 pr-4 pl-11 transition-colors', form.profile === profile ? 'bg-accent-soft' : 'bg-surface hover:bg-surface-2')}>
                            <input type="radio" name="profile" checked={form.profile === profile} onChange={() => set({ profile })} className="absolute top-[1.15rem] left-4 size-4 accent-[var(--accent)]" />
                            <span className={cx('font-heading', form.profile === profile && 'text-accent')}>{t(`editor.profile.${profile}`)}</span>
                            <span className="text-sm text-muted">{t(`settings.profile.${profile}_text`)}</span>
                        </label>
                    ))}
                </div>
                {profiles.length === 1 && <p className="mt-3 text-xs text-muted">{t('settings.profile_einvoice_only')}</p>}
            </SettingsCard>

            <SettingsCard aria-labelledby="dt-numbering">
                <CardHead titleId="dt-numbering" title={t('settings.numbering')} description={t('settings.numbering_text')} />
                <div className="grid items-start gap-5 sm:grid-cols-[minmax(0,1fr)_15rem]">
                    <div className="grid gap-4">
                        <TextInput
                            label={t('settings.pattern')}
                            value={form.numbering.pattern}
                            className="font-mono text-sm"
                            error={errors['numbering.pattern']}
                            onChange={(e) => setNumbering({ pattern: e.target.value })}
                        />
                        <div className="flex flex-wrap gap-1.5" aria-label={t('settings.placeholders')}>
                            {PLACEHOLDERS.map((token) => (
                                <button
                                    key={token}
                                    type="button"
                                    onClick={() => setNumbering({ pattern: form.numbering.pattern + token })}
                                    className="inline-flex h-[1.875rem] items-center gap-2 rounded-full bg-surface px-3 text-xs text-muted transition-colors hover:bg-accent-soft hover:text-accent"
                                >
                                    <code className="font-mono text-ink">{token}</code>
                                    <span>{t(`settings.placeholder.${PLACEHOLDER_KEYS[token]}`)}</span>
                                </button>
                            ))}
                        </div>
                        <Checkbox label={t('settings.reset_yearly')} checked={form.numbering.reset_yearly} onChange={(e) => setNumbering({ reset_yearly: e.target.checked })} />
                        <TextInput
                            label={t('settings.next_value')}
                            type="number"
                            min={1}
                            inputMode="numeric"
                            value={form.numbering.next_value ?? ''}
                            error={errors['numbering.next_value']}
                            hint={t('settings.next_value_hint')}
                            onChange={(e) => setNumbering({ next_value: e.target.value === '' ? undefined : Math.max(1, Math.trunc(Number(e.target.value))) })}
                        />
                    </div>
                    <div aria-live="polite" className="grid gap-1 rounded-lg bg-accent-soft p-5">
                        <span className="text-sm text-muted">{t('settings.next_number')}</span>
                        <strong className="num text-2xl font-bold tracking-brand break-all text-accent">{preview.data?.valid ? preview.data.number : '–'}</strong>
                        {preview.data && !preview.data.valid && <span className="text-xs text-bad">{preview.data.message}</span>}
                    </div>
                </div>
            </SettingsCard>

            <SettingsCard aria-labelledby="dt-defaults">
                <CardHead titleId="dt-defaults" title={t('settings.defaults')} description={t('settings.defaults_text')} />
                <div className="grid gap-4 sm:grid-cols-2">
                    <Select label={t('settings.template')} value={form.template_id ?? ''} error={errors.template_id} onChange={(e) => set({ template_id: e.target.value || null })}>
                        <option value="">{t('settings.template_default')}</option>
                        {templateOptions.map((template) => (
                            <option key={template.id} value={template.id}>
                                {template.name}
                            </option>
                        ))}
                    </Select>
                    {type === 'invoice' && days('payment_term_days', t('settings.payment_term'))}
                    {type === 'offer' && days('validity_days', t('settings.validity'))}
                    <Select label={t('settings.intro_block')} value={form.default_intro_block_id ?? ''} onChange={(e) => set({ default_intro_block_id: e.target.value || null })}>
                        <option value="">{t('settings.none')}</option>
                        {blockOptions(['intro', 'note']).map((block) => (
                            <option key={block.id} value={block.id}>
                                {block.name}
                            </option>
                        ))}
                    </Select>
                    <Select label={t('settings.closing_block')} value={form.default_closing_block_id ?? ''} onChange={(e) => set({ default_closing_block_id: e.target.value || null })}>
                        <option value="">{t('settings.none')}</option>
                        {blockOptions(['closing', 'payment', 'note']).map((block) => (
                            <option key={block.id} value={block.id}>
                                {block.name}
                            </option>
                        ))}
                    </Select>
                </div>
            </SettingsCard>

            <div className="flex flex-wrap items-center gap-4 rounded-lg bg-surface-2 px-5 py-4">
                <ListPlus aria-hidden className="size-5 shrink-0 text-muted" />
                <div className="grid min-w-0 gap-1">
                    <b className="font-strong">{t('settings.fields_for_type', { type: t(`document_type.${type}`) })}</b>
                    <div className="flex flex-wrap gap-1.5">
                        {fieldsForType.length === 0 && <span className="text-muted">{t('settings.none_yet')}</span>}
                        {fieldsForType.map((field) => (
                            <Badge key={field.id} plain tone={field.scope === 'position' ? 'accent' : 'neutral'}>
                                {field.scope === 'position' ? t('settings.position_field', { label: field.label }) : field.label}
                            </Badge>
                        ))}
                    </div>
                </div>
                <span className="flex-1" />
                <Link href={path('/fields?scope=document')} className="text-sm">
                    {t('settings.manage_fields')}
                </Link>
            </div>

            <SaveBar dirty={dirty} pending={pending} onReset={() => setForm(inputOf(saved))} />
        </form>
    );
}
```

Die Profilnamen kommen aus den vorhandenen Schlüsseln `editor.profile.basic`/`editor.profile.en16931` (Phase 6). Ohne Template am Dokumenttyp greift `TemplateResolver::fallback()` (Klar) – daher die Option „Standard (Klar)“ mit leerem Wert.

In `resources/js/pages/settings/show.tsx`: `import { DocumentTypeSettings } from '@/settings/document-types';` und

```tsx
        case 'document-types':
            return <DocumentTypeSettings />;
```

- [ ] **Step 5: Übersetzungen**

`lang/en.json`:

```json
"settings.closing_block": "Closing text",
"settings.days": "days",
"settings.defaults": "Defaults for new documents",
"settings.defaults_text": "Applies to newly created documents of this type. You can change everything in the document.",
"settings.doc_type_label": "Document type",
"settings.doc_type_saved": ":type: settings saved",
"settings.fields_for_type": "Custom fields for :type",
"settings.intro_block": "Intro",
"settings.next_number": "Next number",
"settings.next_value": "Next running number",
"settings.next_value_hint": "Only change it when you continue an existing number range. Numbers already used are skipped.",
"settings.none": "None",
"settings.none_yet": "None yet.",
"settings.numbering": "Number range",
"settings.numbering_text": "The number is assigned when finalizing. Drafts have none yet.",
"settings.pattern": "Pattern",
"settings.payment_term": "Payment term",
"settings.placeholder.month": "Month",
"settings.placeholder.sequence": "Running number, as many digits as zeros",
"settings.placeholder.year_long": "Year, four digits",
"settings.placeholder.year_short": "Year, two digits",
"settings.placeholders": "Placeholders",
"settings.position_field": ":label · position",
"settings.profile": "Compliance profile",
"settings.profile.basic_text": "Checks the basics: customer, date, positions with title, tax rate and unit.",
"settings.profile.en16931_text": "Additionally everything the European e-invoice standard requires. Finalizing creates a PDF/A-3 with embedded XML.",
"settings.profile_einvoice_only": "The e-invoice exists for invoices and cancellations only.",
"settings.profile_text": "Decides which details must be present before finalizing.",
"settings.reset_yearly": "Start at 1 again every year",
"settings.template": "Template",
"settings.template_default": "Default (Klar)",
"settings.validity": "Valid for"
```

`lang/de.json`:

```json
"settings.closing_block": "Schlusstext",
"settings.days": "Tage",
"settings.defaults": "Vorgaben für neue Dokumente",
"settings.defaults_text": "Gilt für neu angelegte Dokumente dieses Typs. Im Dokument kannst du alles ändern.",
"settings.doc_type_label": "Dokumenttyp",
"settings.doc_type_saved": ":type: Einstellungen gespeichert",
"settings.fields_for_type": "Eigene Felder für :type",
"settings.intro_block": "Einleitung",
"settings.next_number": "Nächste Nummer",
"settings.next_value": "Nächste laufende Nummer",
"settings.next_value_hint": "Nur ändern, wenn du einen bestehenden Nummernkreis fortsetzt. Schon vergebene Nummern werden übersprungen.",
"settings.none": "Keine",
"settings.none_yet": "Noch keine.",
"settings.numbering": "Nummernkreis",
"settings.numbering_text": "Die Nummer wird erst beim Abschließen vergeben. Entwürfe haben noch keine.",
"settings.pattern": "Muster",
"settings.payment_term": "Zahlungsziel",
"settings.placeholder.month": "Monat",
"settings.placeholder.sequence": "Laufende Nummer, so viele Stellen wie Nullen",
"settings.placeholder.year_long": "Jahr, vierstellig",
"settings.placeholder.year_short": "Jahr, zweistellig",
"settings.placeholders": "Platzhalter",
"settings.position_field": ":label · Position",
"settings.profile": "Prüfprofil",
"settings.profile.basic_text": "Prüft das Nötigste: Kunde, Datum, Positionen mit Titel, Steuersatz und Einheit.",
"settings.profile.en16931_text": "Zusätzlich alles, was die europäische E-Rechnung verlangt. Beim Abschließen entsteht ein PDF/A-3 mit eingebetteter XML.",
"settings.profile_einvoice_only": "Die E-Rechnung gibt es nur für Rechnungen und Stornos.",
"settings.profile_text": "Legt fest, welche Angaben vor dem Abschließen vorhanden sein müssen.",
"settings.reset_yearly": "Jedes Jahr wieder bei 1 anfangen",
"settings.template": "Template",
"settings.template_default": "Standard (Klar)",
"settings.validity": "Gültig für"
```

- [ ] **Step 6: Prüfen**

Run: `ddev exec pnpm typecheck && ddev exec pnpm test && ddev artisan test --filter='NumberPreviewTest|TranslationsTest|SettingsApiTest'`
Expected: PASS.

Manuell: `/de/settings/document-types` → Rechnung: Muster `RE-{YY}-{000}` tippen → Vorschau `RE-26-001` (bzw. mit der aktuellen Nummer); `{000}` löschen → „–“ und Hinweis; „Jedes Jahr …“ an und `{YY}` löschen → Hinweis zum Jahr; Speichern → Toast, Neuladen zeigt den Stand; Angebot: nur Profil „Basis“ mit Hinweis.

- [ ] **Step 7: Commit**

```bash
ddev exec vendor/bin/pint && ddev exec vendor/bin/phpstan analyse --memory-limit=1G
git add app routes resources/js lang tests
git commit -m "feat: document type settings with server-side number preview" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 11: Einstellungen „Steuern & Einheiten“ (Archivieren/Wiederherstellen) und „Textbausteine“

**Files:**
- Create: `app/Actions/RestoreTaxRate.php`, `app/Actions/RestoreUnit.php`
- Modify: `app/ApiResource/TaxRateResource.php`, `app/ApiResource/UnitResource.php`, `app/State/Processor/TaxRateProcessor.php`, `app/State/Processor/UnitProcessor.php`
- Modify: `resources/js/api/settings.ts`
- Create: `resources/js/settings/taxes-units.tsx`, `resources/js/settings/tax-rate-drawer.tsx`, `resources/js/settings/unit-drawer.tsx`, `resources/js/settings/unit-codes.ts`, `resources/js/settings/text-blocks.tsx`
- Modify: `resources/js/pages/settings/show.tsx`
- Modify: `lang/en.json`, `lang/de.json`
- Test: `tests/Feature/Actions/RestoreMasterDataTest.php`, `tests/Feature/Api/RightsMatrixTest.php`

**Interfaces:**
- Consumes: `useTaxRates`, `useUnits`, `useTextBlocks` (`api/master-data.ts`, Schlüssel mit `include_archived=1`), `useDocumentTypes` (Task 3), `scheduleDelete`/`usePendingDeletes`, `toDecimalString` (`lib/format.ts`), `invalidate` (`api/paged.ts`).
- Produces: `RestoreTaxRate::handle(Actor, TaxRate): TaxRate`, `RestoreUnit::handle(Actor, Unit): Unit`; Operationen `tax_rate_restore`, `unit_restore`; in `api/settings.ts`: `saveTaxRate(input: TaxRateInput, id?: string)`, `archiveTaxRate(id)`, `restoreTaxRate(id)`, `saveUnit(input: UnitInput, id?: string)`, `archiveUnit(id)`, `restoreUnit(id)`, `saveTextBlock(input: TextBlockInput, id?: string)`, `deleteTextBlock(id, options?)`; `TAX_CATEGORIES: string[]` (`settings/tax-rate-drawer.tsx`, Task 14 ergänzt `'O'`).

- [ ] **Step 1: Failing Test**

`tests/Feature/Actions/RestoreMasterDataTest.php`:

```php
<?php

use App\Models\TaxRate;
use App\Models\Unit;

beforeEach(fn () => $this->withToken(apiToken()));

it('restores an archived tax rate so new positions can pick it again', function () {
    $rate = TaxRate::query()->firstOrFail();

    $this->deleteJson("/api/tax-rates/{$rate->id}")->assertNoContent();
    expect(collect($this->getJson('/api/tax-rates')->json())->pluck('id'))->not->toContain($rate->id);

    $this->postJson("/api/tax-rates/{$rate->id}/restore")->assertOk()->assertJsonPath('archived_at', null);
    expect(collect($this->getJson('/api/tax-rates')->json())->pluck('id'))->toContain($rate->id);
});

it('restores an archived unit', function () {
    $unit = Unit::query()->firstOrFail();
    $this->deleteJson("/api/units/{$unit->id}")->assertNoContent();

    $this->postJson("/api/units/{$unit->id}/restore")->assertOk()->assertJsonPath('id', $unit->id)->assertJsonPath('archived_at', null);
    expect($unit->fresh()->archived_at)->toBeNull();
});
```

`MATRIX_ROUTES`:

```php
    'restore tax rate' => ['POST', '/api/tax-rates/{rate}/restore', ['api:write']],
    'restore unit' => ['POST', '/api/units/{unit}/restore', ['api:write']],
```

Run: `ddev artisan test --filter='RestoreMasterDataTest|RightsMatrixTest'`
Expected: FAIL (404 für `/restore`).

- [ ] **Step 2: Actions und Operationen**

`app/Actions/RestoreTaxRate.php`:

```php
<?php

namespace App\Actions;

use App\Models\TaxRate;
use App\Support\Actor;

/** Undo of ArchiveTaxRate: new positions can pick the rate again. */
final class RestoreTaxRate
{
    public function handle(Actor $actor, TaxRate $rate): TaxRate
    {
        $rate->forceFill(['archived_at' => null])->save();

        return $rate;
    }
}
```

`app/Actions/RestoreUnit.php`:

```php
<?php

namespace App\Actions;

use App\Models\Unit;
use App\Support\Actor;

/** Undo of ArchiveUnit. */
final class RestoreUnit
{
    public function handle(Actor $actor, Unit $unit): Unit
    {
        $unit->forceFill(['archived_at' => null])->save();

        return $unit;
    }
}
```

`TaxRateResource` – nach der `Delete`-Operation:

```php
        new Post(
            uriTemplate: '/tax-rates/{id}/restore',
            name: 'tax_rate_restore',
            status: 200,
            input: false,
            middleware: ApiMiddleware::WRITE,
            read: false,
            deserialize: false,
            processor: TaxRateProcessor::class,
            description: 'Restores an archived rate.',
        ),
```

`UnitResource` entsprechend mit `uriTemplate: '/units/{id}/restore'`, `name: 'unit_restore'`, `processor: UnitProcessor::class`, `description: 'Restores an archived unit.'`.

`TaxRateProcessor`: `RestoreTaxRate $restore` in den Konstruktor, nach dem `DeleteOperationInterface`-Zweig:

```php
        if ($operation->getName() === 'tax_rate_restore' && $rate !== null) {
            return TaxRateResource::fromModel($this->restore->handle($actor, $rate));
        }
```

`UnitProcessor` entsprechend (`unit_restore`, `RestoreUnit`, `UnitResource`; das Model heißt dort `$unit`).

Run: `ddev artisan test --filter='RestoreMasterDataTest|RightsMatrixTest|OpenApiTest|NormalizationTest'`
Expected: PASS.

- [ ] **Step 3: Frontend-API**

`api/settings.ts` ergänzen (Imports: `invalidate` aus `./paged`, `TaxRate`, `Unit`, `TextBlock`, `TextBlockKind` aus `./types`):

```ts
export type TaxRateInput = Pick<TaxRate, 'label' | 'percent' | 'category' | 'exemption_note'>;
export type UnitInput = Pick<Unit, 'name' | 'symbol' | 'decimals' | 'code'>;
export type TextBlockInput = { name: string; kind: TextBlockKind; body: string };

const write = async <T>(url: string, method: 'POST' | 'PATCH' | 'DELETE', prefix: string, body?: unknown, keepalive = false): Promise<T> => {
    const result = await api<T>(url, { method, body, keepalive });
    void invalidate(prefix);
    return result;
};

export const saveTaxRate = (input: TaxRateInput, id?: string) => write<TaxRate>(id ? `/api/tax-rates/${id}` : '/api/tax-rates', id ? 'PATCH' : 'POST', '/api/tax-rates', input);
export const archiveTaxRate = (id: string) => write<void>(`/api/tax-rates/${id}`, 'DELETE', '/api/tax-rates');
export const restoreTaxRate = (id: string) => write<TaxRate>(`/api/tax-rates/${id}/restore`, 'POST', '/api/tax-rates', {});
export const saveUnit = (input: UnitInput, id?: string) => write<Unit>(id ? `/api/units/${id}` : '/api/units', id ? 'PATCH' : 'POST', '/api/units', input);
export const archiveUnit = (id: string) => write<void>(`/api/units/${id}`, 'DELETE', '/api/units');
export const restoreUnit = (id: string) => write<Unit>(`/api/units/${id}/restore`, 'POST', '/api/units', {});
export const saveTextBlock = (input: TextBlockInput, id?: string) => write<TextBlock>(id ? `/api/text-blocks/${id}` : '/api/text-blocks', id ? 'PATCH' : 'POST', '/api/text-blocks', input);
export const deleteTextBlock = (id: string, options: { keepalive: boolean } = { keepalive: false }) => write<void>(`/api/text-blocks/${id}`, 'DELETE', '/api/text-blocks', undefined, options.keepalive);
```

`invalidate('/api/tax-rates')` lädt auch `keys.taxRates()` (`/api/tax-rates?include_archived=1`), den der Dokument-Editor benutzt.

- [ ] **Step 4: Einheiten-Codes und Steuersatz-Drawer**

`resources/js/settings/unit-codes.ts`:

```ts
/** Common UN/ECE Recommendation 20 codes as e-invoices want them; labels: unit_code.<CODE>. */
export const UNIT_CODES = ['HUR', 'MIN', 'DAY', 'WEE', 'MON', 'ANN', 'H87', 'C62', 'LS', 'SET', 'PR', 'KMT', 'MTR', 'MTK', 'KGM', 'LTR'] as const;
```

`resources/js/settings/tax-rate-drawer.tsx`:

```tsx
import { useState } from 'react';
import { saveTaxRate, type TaxRateInput } from '@/api/settings';
import { Button, Drawer, Select, Textarea, TextInput } from '@/components/ui';
import { ApiError, errorMessage } from '@/lib/api';
import { toDecimalString } from '@/lib/format';
import { t } from '@/lib/i18n';
import { toast } from '@/lib/toast';

/** EN 16931 VAT categories (App\Enums\TaxCategory); labels tax_category.<code>. */
export const TAX_CATEGORIES = ['S', 'Z', 'E', 'AE', 'K', 'G'];

export function TaxRateDrawer({ initial, id, onClose }: { initial: TaxRateInput; id?: string; onClose(): void }) {
    const [rate, setRate] = useState(initial);
    const [percent, setPercent] = useState(initial.percent);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [pending, setPending] = useState(false);

    const submit = async () => {
        setPending(true);
        try {
            const saved = await saveTaxRate({ ...rate, percent: toDecimalString(percent) ?? percent, exemption_note: rate.exemption_note?.trim() || null }, id);
            toast.success(t('settings.rate_saved', { label: saved.label }));
            onClose();
        } catch (error) {
            if (error instanceof ApiError && error.status === 422) setErrors(error.fieldErrors());
            else toast.error(errorMessage(error));
        } finally {
            setPending(false);
        }
    };

    return (
        <Drawer
            open
            onClose={onClose}
            title={id ? t('settings.rate_edit') : t('settings.rate_new')}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>
                        {t('common.cancel')}
                    </Button>
                    <Button variant="primary" pending={pending} onClick={() => void submit()}>
                        {t('settings.save')}
                    </Button>
                </>
            }
        >
            <form
                noValidate
                className="grid gap-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    void submit();
                }}
            >
                <TextInput label={t('settings.rate_label')} value={rate.label} data-autofocus placeholder={t('settings.rate_label_placeholder')} error={errors.label} onChange={(e) => setRate({ ...rate, label: e.target.value })} />
                <TextInput label={t('settings.rate_percent')} inputMode="decimal" value={percent} className="num" aside={<span className="text-xs">%</span>} error={errors.percent} onChange={(e) => setPercent(e.target.value)} />
                <Select label={t('settings.rate_category')} value={rate.category} error={errors.category} onChange={(e) => setRate({ ...rate, category: e.target.value })}>
                    {TAX_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                            {category}: {t(`tax_category.${category}`)}
                        </option>
                    ))}
                </Select>
                <Textarea
                    label={t('settings.rate_note')}
                    rows={2}
                    value={rate.exemption_note ?? ''}
                    hint={t('settings.rate_note_hint')}
                    error={errors.exemption_note}
                    onChange={(e) => setRate({ ...rate, exemption_note: e.target.value })}
                />
            </form>
        </Drawer>
    );
}
```

`toDecimalString` liegt laut Phase 5 in `lib/format.ts` und gibt bei leerer/ungültiger Eingabe `null` zurück (`grep -n "export function toDecimalString" -A8 resources/js/lib/format.ts`); ungültige Eingaben gehen roh an den Server und kommen als 422 an `percent` zurück.

`resources/js/settings/unit-drawer.tsx`:

```tsx
import { useState } from 'react';
import { saveUnit, type UnitInput } from '@/api/settings';
import { Button, Drawer, Select, TextInput } from '@/components/ui';
import { ApiError, errorMessage } from '@/lib/api';
import { t } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { UNIT_CODES } from './unit-codes';

export function UnitDrawer({ initial, id, onClose }: { initial: UnitInput; id?: string; onClose(): void }) {
    const [unit, setUnit] = useState(initial);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [pending, setPending] = useState(false);

    const submit = async () => {
        setPending(true);
        try {
            const saved = await saveUnit(unit, id);
            toast.success(t('settings.unit_saved', { name: saved.name }));
            onClose();
        } catch (error) {
            if (error instanceof ApiError && error.status === 422) setErrors(error.fieldErrors());
            else toast.error(errorMessage(error));
        } finally {
            setPending(false);
        }
    };

    return (
        <Drawer
            open
            onClose={onClose}
            title={id ? t('settings.unit_edit') : t('settings.unit_new')}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>
                        {t('common.cancel')}
                    </Button>
                    <Button variant="primary" pending={pending} onClick={() => void submit()}>
                        {t('settings.save')}
                    </Button>
                </>
            }
        >
            <form
                noValidate
                className="grid gap-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    void submit();
                }}
            >
                <div className="grid gap-4 sm:grid-cols-2">
                    <TextInput label={t('settings.unit_name')} value={unit.name} data-autofocus placeholder={t('settings.unit_name_placeholder')} error={errors.name} onChange={(e) => setUnit({ ...unit, name: e.target.value })} />
                    <TextInput label={t('settings.unit_symbol')} value={unit.symbol} placeholder={t('settings.unit_symbol_placeholder')} error={errors.symbol} onChange={(e) => setUnit({ ...unit, symbol: e.target.value })} />
                </div>
                <TextInput
                    label={t('settings.unit_decimals')}
                    type="number"
                    min={0}
                    max={4}
                    value={unit.decimals}
                    error={errors.decimals}
                    onChange={(e) => setUnit({ ...unit, decimals: Math.min(4, Math.max(0, Math.trunc(Number(e.target.value)))) })}
                />
                <Select label={t('settings.unit_code')} hint={t('settings.unit_code_hint')} value={unit.code} error={errors.code} onChange={(e) => setUnit({ ...unit, code: e.target.value })}>
                    <option value="">{t('settings.unit_no_code')}</option>
                    {UNIT_CODES.map((code) => (
                        <option key={code} value={code}>
                            {code}: {t(`unit_code.${code}`)}
                        </option>
                    ))}
                    {unit.code && !(UNIT_CODES as readonly string[]).includes(unit.code) && <option value={unit.code}>{unit.code}</option>}
                </Select>
            </form>
        </Drawer>
    );
}
```

- [ ] **Step 5: Liste „Steuern & Einheiten“**

`resources/js/settings/taxes-units.tsx`:

```tsx
import { Archive, ChevronDown, Pencil, Percent, Plus, RotateCcw, Ruler } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTaxRates, useUnits } from '@/api/master-data';
import { archiveTaxRate, archiveUnit, restoreTaxRate, restoreUnit, type TaxRateInput, type UnitInput } from '@/api/settings';
import type { TaxRate, Unit } from '@/api/types';
import { Badge, Button, CardHead, EmptyState, ErrorState, ListSkeleton, Tag, cx } from '@/components/ui';
import { SettingsCard } from './settings-card';
import { errorMessage } from '@/lib/api';
import { formatPercent } from '@/lib/format';
import { t, tn } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { TaxRateDrawer } from './tax-rate-drawer';
import { UnitDrawer } from './unit-drawer';

const ROW = 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-md px-3 py-2.5 hover:bg-surface sm:grid-cols-[minmax(0,1fr)_7rem_3rem_auto]';

/** Archive with undo: DELETE archives (documents keep pointing at it), undo restores. */
async function archiveWithUndo(label: string, archive: () => Promise<unknown>, restore: () => Promise<unknown>): Promise<void> {
    try {
        await archive();
        toast.success(t('settings.archived', { label }), {
            label: t('fields.undo'),
            run: () => void restore().then(() => toast.info(t('settings.restored', { label }))).catch((error: unknown) => toast.error(errorMessage(error))),
        });
    } catch (error) {
        toast.error(errorMessage(error));
    }
}

export function TaxesUnitsSettings() {
    const rates = useTaxRates();
    const units = useUnits();
    const [rate, setRate] = useState<{ input: TaxRateInput; id?: string } | null>(null);
    const [unit, setUnit] = useState<{ input: UnitInput; id?: string } | null>(null);
    const newRate = () => setRate({ input: { label: '', percent: '19', category: 'S', exemption_note: null } });
    const newUnit = () => setUnit({ input: { name: '', symbol: '', decimals: 2, code: '' } });

    return (
        <div className="grid gap-6">
            <Section
                title={t('settings.tax_rates')}
                description={t('settings.tax_rates_text')}
                action={
                    <Button size="sm" variant="soft" icon={<Plus />} onClick={newRate}>
                        {t('settings.rate_add')}
                    </Button>
                }
                query={rates}
                empty={
                    <EmptyState icon={<Percent />} title={t('settings.rates_empty')} actions={<Button variant="primary" icon={<Plus />} onClick={newRate}>{t('settings.rate_add')}</Button>}>
                        {t('settings.rates_empty_text')}
                    </EmptyState>
                }
                render={(item: TaxRate) => (
                    <>
                        <button type="button" className="grid min-w-0 gap-0.5 text-left" onClick={() => setRate({ input: item, id: item.id })}>
                            <span className="font-strong">{item.label}</span>
                            <span className="truncate text-sm text-muted">{item.exemption_note ?? t(`tax_category.${item.category}`)}</span>
                        </button>
                        <span className="num hidden text-right sm:block">{formatPercent(item.percent)}</span>
                        <span className="hidden sm:block">
                            <Badge plain>{item.category}</Badge>
                        </span>
                    </>
                )}
                onEdit={(item) => setRate({ input: item, id: item.id })}
                onArchive={(item) => void archiveWithUndo(item.label, () => archiveTaxRate(item.id), () => restoreTaxRate(item.id))}
                onRestore={(item) => void restoreTaxRate(item.id).catch((error: unknown) => toast.error(errorMessage(error)))}
                label={(item) => item.label}
            />
            <Section
                title={t('settings.units')}
                description={t('settings.units_text')}
                action={
                    <Button size="sm" variant="soft" icon={<Plus />} onClick={newUnit}>
                        {t('settings.unit_add')}
                    </Button>
                }
                query={units}
                empty={
                    <EmptyState icon={<Ruler />} title={t('settings.units_empty')} actions={<Button variant="primary" icon={<Plus />} onClick={newUnit}>{t('settings.unit_add')}</Button>}>
                        {t('settings.units_empty_text')}
                    </EmptyState>
                }
                render={(item: Unit) => (
                    <>
                        <button type="button" className="grid min-w-0 gap-0.5 text-left" onClick={() => setUnit({ input: item, id: item.id })}>
                            <span className="font-strong">{item.name}</span>
                            <span className="truncate text-sm text-muted">{t('settings.unit_summary', { symbol: item.symbol, decimals: item.decimals })}</span>
                        </button>
                        <span className="hidden text-right sm:block">{item.code ? <code className="font-mono text-xs">{item.code}</code> : <Tag tone="bad">{t('settings.unit_no_code')}</Tag>}</span>
                        <span className="hidden sm:block" />
                    </>
                )}
                onEdit={(item) => setUnit({ input: item, id: item.id })}
                onArchive={(item) => void archiveWithUndo(item.name, () => archiveUnit(item.id), () => restoreUnit(item.id))}
                onRestore={(item) => void restoreUnit(item.id).catch((error: unknown) => toast.error(errorMessage(error)))}
                label={(item) => item.name}
            />
            {rate && <TaxRateDrawer initial={rate.input} id={rate.id} onClose={() => setRate(null)} />}
            {unit && <UnitDrawer initial={unit.input} id={unit.id} onClose={() => setUnit(null)} />}
        </div>
    );
}

type SectionProps<T extends { id: string; archived_at: string | null }> = {
    title: string;
    description: string;
    action: ReactNode;
    query: { data?: T[]; error?: unknown; mutate(): unknown };
    empty: ReactNode;
    render(item: T): ReactNode;
    onEdit(item: T): void;
    onArchive(item: T): void;
    onRestore(item: T): void;
    label(item: T): string;
};

function Section<T extends { id: string; archived_at: string | null }>({ title, description, action, query, empty, render, onEdit, onArchive, onRestore, label }: SectionProps<T>) {
    const [showArchived, setShowArchived] = useState(false);
    const active = (query.data ?? []).filter((item) => item.archived_at === null);
    const archived = (query.data ?? []).filter((item) => item.archived_at !== null);

    return (
        <SettingsCard flush>
            <div className="px-5 pt-5">
                <CardHead title={title} description={description} actions={action} />
            </div>
            {query.error ? (
                <ErrorState error={query.error} onRetry={() => void query.mutate()} />
            ) : !query.data ? (
                <ListSkeleton rows={3} />
            ) : active.length === 0 ? (
                empty
            ) : (
                <ul className="m-0 grid list-none gap-0.5 px-2 pb-2">
                    {active.map((item) => (
                        <li key={item.id} className={ROW}>
                            {render(item)}
                            <span className="row-span-2 flex justify-end gap-0.5 sm:row-span-1">
                                <Button variant="ghost" size="sm" iconOnly icon={<Pencil />} onClick={() => onEdit(item)}>
                                    {t('settings.edit_named', { label: label(item) })}
                                </Button>
                                <Button variant="ghost" size="sm" iconOnly icon={<Archive />} onClick={() => onArchive(item)}>
                                    {t('settings.archive_named', { label: label(item) })}
                                </Button>
                            </span>
                        </li>
                    ))}
                </ul>
            )}
            {archived.length > 0 && (
                <div className="border-t border-surface-2 px-2 pt-1 pb-2">
                    <button type="button" aria-expanded={showArchived} onClick={() => setShowArchived(!showArchived)} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-muted hover:text-ink">
                        {tn('settings.archived_count', archived.length)}
                        <ChevronDown aria-hidden className={cx('ml-auto size-4 transition-transform', showArchived && 'rotate-180')} />
                    </button>
                    {showArchived && (
                        <ul className="m-0 grid list-none gap-0.5 p-0">
                            {archived.map((item) => (
                                <li key={item.id} className={cx(ROW, 'opacity-70')}>
                                    {render(item)}
                                    <span className="row-span-2 flex justify-end sm:row-span-1">
                                        <Button variant="ghost" size="sm" icon={<RotateCcw />} onClick={() => onRestore(item)}>
                                            {t('settings.restore')}
                                        </Button>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </SettingsCard>
    );
}
```

`resources/js/lib/format.ts` bekommt `formatPercent` (gibt es noch nicht), mit Test in `resources/js/lib/format.test.ts` (Import ergänzen):

```ts
/** "19.00" → "19 %" (de) / "19%" (en). Intl formats the decimal string exactly (ES2023), no float maths. */
export function formatPercent(percent: string, locale?: string): string {
    const format = new Intl.NumberFormat(intlLocale(locale), { style: 'percent', maximumFractionDigits: 2 }).format as unknown as (value: string) => string;
    return format(`${percent}E-2`);
}
```

```ts
describe('formatPercent', () => {
    it('formats percent strings exactly', () => {
        expect(plain(formatPercent('19.00', 'de'))).toBe('19 %');
        expect(plain(formatPercent('7.5', 'de'))).toBe('7,5 %');
        expect(formatPercent('19.00', 'en')).toBe('19%');
    });
});
```

(`plain()` ersetzt in `format.test.ts` schon die geschützten Leerzeichen; `"19.00E-2"` ist ein gültiger Dezimal-String für `Intl.NumberFormat`.)

- [ ] **Step 6: Textbausteine**

`resources/js/settings/text-blocks.tsx`:

```tsx
import { Pencil, Plus, TextQuote, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTextBlocks } from '@/api/master-data';
import { deleteTextBlock, saveTextBlock, useDocumentTypes, type TextBlockInput } from '@/api/settings';
import type { TextBlockKind } from '@/api/types';
import { Badge, Button, CardHead, Drawer, EmptyState, ErrorState, ListSkeleton, Select, Textarea, TextInput } from '@/components/ui';
import { SettingsCard } from './settings-card';
import { ApiError, errorMessage } from '@/lib/api';
import { t } from '@/lib/i18n';
import { scheduleDelete, usePendingDeletes } from '@/lib/pending-delete';
import { toast } from '@/lib/toast';

const KINDS: TextBlockKind[] = ['intro', 'closing', 'payment', 'note'];
const PLACEHOLDERS = ['{{ contact.first_name }}', '{{ customer.name }}', '{{ document.number }}', '{{ document.due_date | date }}', '{{ document.gross_total | money }}'];

export function TextBlockSettings() {
    const blocks = useTextBlocks();
    const documentTypes = useDocumentTypes();
    const pending = usePendingDeletes();
    const [editing, setEditing] = useState<{ input: TextBlockInput; id?: string } | null>(null);
    const visible = (blocks.data ?? []).filter((block) => !pending.has(block.id));
    const create = () => setEditing({ input: { name: '', kind: 'intro', body: '' } });

    const remove = (id: string, name: string) => {
        const handle = scheduleDelete(id, (options) => deleteTextBlock(id, options));
        toast.success(t('settings.block_deleted', { name }), {
            label: t('fields.undo'),
            run: () => {
                if (handle.undo()) toast.info(t('settings.restored', { label: name }));
            },
            onExpire: () => void handle.commit().catch((error: unknown) => toast.error(errorMessage(error))),
        });
    };

    return (
        <SettingsCard flush>
            <div className="px-5 pt-5">
                <CardHead
                    title={t('settings.section.text_blocks')}
                    description={t('settings.blocks_text')}
                    actions={
                        <Button size="sm" variant="soft" icon={<Plus />} onClick={create}>
                            {t('settings.block_add')}
                        </Button>
                    }
                />
            </div>
            {blocks.error ? (
                <ErrorState error={blocks.error} onRetry={() => void blocks.mutate()} />
            ) : !blocks.data ? (
                <ListSkeleton rows={4} />
            ) : visible.length === 0 ? (
                <EmptyState icon={<TextQuote />} title={t('settings.blocks_empty')} actions={<Button variant="primary" icon={<Plus />} onClick={create}>{t('settings.block_add')}</Button>}>
                    {t('settings.blocks_empty_text')}
                </EmptyState>
            ) : (
                <ul className="m-0 grid list-none gap-0.5 px-2 pb-2">
                    {visible.map((block) => {
                        const usedBy = (documentTypes.data ?? []).filter((setting) => setting.default_intro_block_id === block.id || setting.default_closing_block_id === block.id);
                        return (
                            <li key={block.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-md px-3 py-2.5 hover:bg-surface sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                                <button type="button" className="grid min-w-0 gap-0.5 text-left" onClick={() => setEditing({ input: block, id: block.id })}>
                                    <span className="font-strong">{block.name}</span>
                                    <span className="truncate text-sm text-muted">{block.body.replace(/\n/g, ' ')}</span>
                                </button>
                                <span className="col-start-1 flex flex-wrap gap-1.5 sm:col-start-auto sm:justify-end">
                                    <Badge plain>{t(`text_block.kind.${block.kind}`)}</Badge>
                                    {usedBy.length > 0 && (
                                        <Badge plain tone="accent">
                                            {t('settings.block_default_for', { types: usedBy.map((setting) => t(`document_type.${setting.type}`)).join(', ') })}
                                        </Badge>
                                    )}
                                </span>
                                <span className="row-span-2 row-start-1 flex justify-end gap-0.5 sm:row-span-1 sm:row-start-auto">
                                    <Button variant="ghost" size="sm" iconOnly icon={<Pencil />} onClick={() => setEditing({ input: block, id: block.id })}>
                                        {t('settings.edit_named', { label: block.name })}
                                    </Button>
                                    <Button variant="ghost" size="sm" iconOnly icon={<Trash2 />} onClick={() => remove(block.id, block.name)}>
                                        {t('settings.delete_named', { label: block.name })}
                                    </Button>
                                </span>
                            </li>
                        );
                    })}
                </ul>
            )}
            {editing && <TextBlockDrawer initial={editing.input} id={editing.id} onClose={() => setEditing(null)} />}
        </SettingsCard>
    );
}

function TextBlockDrawer({ initial, id, onClose }: { initial: TextBlockInput; id?: string; onClose(): void }) {
    const [block, setBlock] = useState<TextBlockInput>({ name: initial.name, kind: initial.kind, body: initial.body });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [pending, setPending] = useState(false);

    const submit = async () => {
        setPending(true);
        try {
            const saved = await saveTextBlock(block, id);
            toast.success(t('settings.block_saved', { name: saved.name }));
            onClose();
        } catch (error) {
            if (error instanceof ApiError && error.status === 422) setErrors(error.fieldErrors());
            else toast.error(errorMessage(error));
        } finally {
            setPending(false);
        }
    };

    return (
        <Drawer
            open
            onClose={onClose}
            title={id ? t('settings.block_edit') : t('settings.block_new')}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>
                        {t('common.cancel')}
                    </Button>
                    <Button variant="primary" pending={pending} onClick={() => void submit()}>
                        {t('settings.save')}
                    </Button>
                </>
            }
        >
            <form
                noValidate
                className="grid gap-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    void submit();
                }}
            >
                <TextInput label={t('settings.block_name')} value={block.name} data-autofocus placeholder={t('settings.block_name_placeholder')} error={errors.name} onChange={(e) => setBlock({ ...block, name: e.target.value })} />
                <Select label={t('settings.block_kind')} value={block.kind} error={errors.kind} onChange={(e) => setBlock({ ...block, kind: e.target.value as TextBlockKind })}>
                    {KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                            {t(`text_block.kind.${kind}`)}
                        </option>
                    ))}
                </Select>
                <Textarea label={t('settings.block_body')} rows={7} value={block.body} error={errors.body} onChange={(e) => setBlock({ ...block, body: e.target.value })} />
                <div className="grid gap-2">
                    <span className="text-xs text-muted">{t('settings.block_placeholders')}</span>
                    <div className="flex flex-wrap gap-1.5">
                        {PLACEHOLDERS.map((placeholder) => (
                            <button
                                key={placeholder}
                                type="button"
                                onClick={() => setBlock({ ...block, body: `${block.body}${block.body && !/\s$/.test(block.body) ? ' ' : ''}${placeholder}` })}
                                className="h-[1.875rem] rounded-full bg-surface-2 px-3 font-mono text-xs text-ink transition-colors hover:bg-accent-soft hover:text-accent"
                            >
                                {placeholder}
                            </button>
                        ))}
                    </div>
                </div>
            </form>
        </Drawer>
    );
}
```

Die Schlüssel `text_block.kind.*` gibt es noch nicht; sie stehen unten.

`resources/js/pages/settings/show.tsx`: Imports `TaxesUnitsSettings`, `TextBlockSettings` und

```tsx
        case 'taxes-units':
            return <TaxesUnitsSettings />;
        case 'text-blocks':
            return <TextBlockSettings />;
```

- [ ] **Step 7: Übersetzungen**

`lang/en.json`:

```json
"settings.archive_named": "Archive :label",
"settings.archived": "“:label” archived",
"settings.archived_count.one": ":count archived",
"settings.archived_count.other": ":count archived",
"settings.block_add": "Text block",
"settings.block_body": "Text",
"settings.block_default_for": "Default for :types",
"settings.block_deleted": "Text block “:name” deleted",
"settings.block_edit": "Edit text block",
"settings.block_kind": "Kind",
"settings.block_name": "Name",
"settings.block_name_placeholder": "e.g. Payment terms 14 days",
"settings.block_new": "New text block",
"settings.block_placeholders": "Liquid placeholders, a click appends them:",
"settings.block_saved": "Text block “:name” saved",
"settings.blocks_empty": "No text blocks yet",
"settings.blocks_empty_text": "Add your payment terms once, for example, and insert them into every invoice.",
"settings.blocks_text": "Reusable texts for intro and closing. openbill fills in the placeholders when rendering.",
"settings.delete_named": "Delete :label",
"settings.edit_named": "Edit :label",
"settings.rate_add": "Tax rate",
"settings.rate_category": "Tax category (EN 16931)",
"settings.rate_edit": "Edit tax rate",
"settings.rate_label": "Label",
"settings.rate_label_placeholder": "e.g. 19 %",
"settings.rate_new": "New tax rate",
"settings.rate_note": "Exemption note",
"settings.rate_note_hint": "Appears as legal note on the document. Only needed at 0 %.",
"settings.rate_percent": "Percentage",
"settings.rate_saved": "Tax rate :label saved",
"settings.rates_empty": "No tax rates",
"settings.rates_empty_text": "Without a tax rate you cannot bill positions under standard taxation.",
"settings.restore": "Restore",
"settings.restored": "“:label” restored",
"settings.tax_rates": "Tax rates",
"settings.tax_rates_text": "Every rate carries the tax category the e-invoice requires. Archived rates stay in existing documents.",
"settings.unit_add": "Unit",
"settings.unit_code": "Code for the e-invoice",
"settings.unit_code_hint": "UN/ECE Recommendation 20. Without a code no e-invoice can be finalized.",
"settings.unit_decimals": "Decimal places",
"settings.unit_edit": "Edit unit",
"settings.unit_name": "Name",
"settings.unit_name_placeholder": "Hour",
"settings.unit_new": "New unit",
"settings.unit_no_code": "No code",
"settings.unit_saved": "Unit :name saved",
"settings.unit_summary": "Symbol “:symbol”, :decimals decimal places",
"settings.unit_symbol": "Symbol",
"settings.unit_symbol_placeholder": "h",
"settings.units": "Units",
"settings.units_empty": "No units",
"settings.units_empty_text": "Add at least hour, day or flat rate.",
"settings.units_text": "The UN/ECE Rec. 20 code goes into the e-invoice.",
"tax_category.AE": "Reverse charge",
"text_block.kind.closing": "Closing text",
"text_block.kind.intro": "Intro",
"text_block.kind.note": "Note",
"text_block.kind.payment": "Payment terms",
"tax_category.E": "Exempt",
"tax_category.G": "Export / outside the EU",
"tax_category.K": "Intra-community supply",
"tax_category.S": "Standard rate",
"tax_category.Z": "Zero rate",
"unit_code.ANN": "Year",
"unit_code.C62": "Unit",
"unit_code.DAY": "Day",
"unit_code.H87": "Piece",
"unit_code.HUR": "Hour",
"unit_code.KGM": "Kilogram",
"unit_code.KMT": "Kilometre",
"unit_code.LS": "Flat rate",
"unit_code.LTR": "Litre",
"unit_code.MIN": "Minute",
"unit_code.MON": "Month",
"unit_code.MTK": "Square metre",
"unit_code.MTR": "Metre",
"unit_code.PR": "Pair",
"unit_code.SET": "Set",
"unit_code.WEE": "Week"
```

`lang/de.json`:

```json
"settings.archive_named": ":label archivieren",
"settings.archived": "„:label“ archiviert",
"settings.archived_count.one": ":count archiviert",
"settings.archived_count.other": ":count archiviert",
"settings.block_add": "Textbaustein",
"settings.block_body": "Text",
"settings.block_default_for": "Standard für :types",
"settings.block_deleted": "Textbaustein „:name“ gelöscht",
"settings.block_edit": "Textbaustein bearbeiten",
"settings.block_kind": "Art",
"settings.block_name": "Name",
"settings.block_name_placeholder": "z. B. Zahlungsbedingungen 14 Tage",
"settings.block_new": "Textbaustein anlegen",
"settings.block_placeholders": "Platzhalter mit Liquid, ein Klick fügt sie ans Ende an:",
"settings.block_saved": "Textbaustein „:name“ gespeichert",
"settings.blocks_empty": "Noch keine Textbausteine",
"settings.blocks_empty_text": "Lege zum Beispiel deine Zahlungsbedingungen einmal an und füge sie in jede Rechnung ein.",
"settings.blocks_text": "Wiederverwendbare Texte für Einleitung und Schlusstext. Platzhalter füllt openbill beim Rendern aus.",
"settings.delete_named": ":label löschen",
"settings.edit_named": ":label bearbeiten",
"settings.rate_add": "Steuersatz",
"settings.rate_category": "Steuerkategorie (EN 16931)",
"settings.rate_edit": "Steuersatz bearbeiten",
"settings.rate_label": "Bezeichnung",
"settings.rate_label_placeholder": "z. B. 19 %",
"settings.rate_new": "Steuersatz anlegen",
"settings.rate_note": "Hinweis bei Befreiung",
"settings.rate_note_hint": "Erscheint als gesetzlicher Hinweis auf dem Dokument. Nur bei 0 % nötig.",
"settings.rate_percent": "Prozentsatz",
"settings.rate_saved": "Steuersatz :label gespeichert",
"settings.rates_empty": "Keine Steuersätze",
"settings.rates_empty_text": "Ohne Steuersatz kannst du in der Regelbesteuerung keine Positionen abrechnen.",
"settings.restore": "Wiederherstellen",
"settings.restored": "„:label“ wiederhergestellt",
"settings.tax_rates": "Steuersätze",
"settings.tax_rates_text": "Jeder Satz trägt die Steuerkategorie, die die E-Rechnung verlangt. Archivierte Sätze bleiben in bestehenden Dokumenten erhalten.",
"settings.unit_add": "Einheit",
"settings.unit_code": "Code für die E-Rechnung",
"settings.unit_code_hint": "UN/ECE Recommendation 20. Ohne Code lässt sich keine E-Rechnung abschließen.",
"settings.unit_decimals": "Nachkommastellen",
"settings.unit_edit": "Einheit bearbeiten",
"settings.unit_name": "Name",
"settings.unit_name_placeholder": "Stunde",
"settings.unit_new": "Einheit anlegen",
"settings.unit_no_code": "Kein Code",
"settings.unit_saved": "Einheit :name gespeichert",
"settings.unit_summary": "Kürzel „:symbol“, :decimals Nachkommastellen",
"settings.unit_symbol": "Kürzel",
"settings.unit_symbol_placeholder": "Std.",
"settings.units": "Einheiten",
"settings.units_empty": "Keine Einheiten",
"settings.units_empty_text": "Lege mindestens Stunde, Tag oder Pauschal an.",
"settings.units_text": "Der Code nach UN/ECE Rec. 20 landet in der E-Rechnung.",
"tax_category.AE": "Reverse Charge",
"text_block.kind.closing": "Schlusstext",
"text_block.kind.intro": "Einleitung",
"text_block.kind.note": "Hinweis",
"text_block.kind.payment": "Zahlungsbedingungen",
"tax_category.E": "Steuerbefreit",
"tax_category.G": "Ausfuhr / Drittland",
"tax_category.K": "Innergemeinschaftliche Lieferung",
"tax_category.S": "Normalsatz",
"tax_category.Z": "Nullsatz",
"unit_code.ANN": "Jahr",
"unit_code.C62": "Einheit",
"unit_code.DAY": "Tag",
"unit_code.H87": "Stück",
"unit_code.HUR": "Stunde",
"unit_code.KGM": "Kilogramm",
"unit_code.KMT": "Kilometer",
"unit_code.LS": "Pauschale",
"unit_code.LTR": "Liter",
"unit_code.MIN": "Minute",
"unit_code.MON": "Monat",
"unit_code.MTK": "Quadratmeter",
"unit_code.MTR": "Meter",
"unit_code.PR": "Paar",
"unit_code.SET": "Satz",
"unit_code.WEE": "Woche"
```

`tax_category.*` und `unit_code.*` sind dynamische Schlüssel mit Großbuchstaben/Ziffern – `TranslationsTest` sucht sie nicht, sie müssen trotzdem in beiden Dateien stehen (oben vollständig).

- [ ] **Step 8: Prüfen**

Run: `ddev exec pnpm typecheck && ddev exec pnpm test && ddev artisan test --filter='RestoreMasterDataTest|TranslationsTest|MasterDataApiTest|TextBlockApiTest'`
Expected: PASS.

Manuell: Steuersatz archivieren → Toast „Rückgängig“ stellt ihn wieder her; ohne Undo erscheint er unter „1 archiviert“ mit „Wiederherstellen“; im Dokument-Editor ist er nicht mehr wählbar, bleibt in bestehenden Positionen sichtbar. Textbaustein löschen → Undo stellt ihn mit derselben ID wieder her (Vorgabe am Dokumenttyp bleibt erhalten).

- [ ] **Step 9: Commit**

```bash
ddev exec vendor/bin/pint && ddev exec vendor/bin/phpstan analyse --memory-limit=1G
git add app resources/js lang tests
git commit -m "feat: tax rate, unit and text block settings with archive, restore and undo" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 12: Benutzerverwaltung – Einladungen mit signiertem Link, Rollen, letzter Owner

**Files:**
- Create: `database/migrations/2026_10_12_100000_create_user_invitations_table.php`, `app/Models/UserInvitation.php`, `database/factories/UserInvitationFactory.php`
- Create: `app/Exceptions/OwnerRequiredException.php`; Modify: `app/Exceptions/ActionNotAllowedException.php`, `app/Enums/UserRole.php` (Docblocks)
- Create: `app/Support/Owners.php`, `app/Support/InvitationLinks.php`, `app/Support/UserRows.php`
- Create: `app/Actions/ListUsers.php`, `app/Actions/InviteUser.php`, `app/Actions/RevokeInvitation.php`, `app/Actions/AcceptInvitation.php`, `app/Actions/ChangeUserRole.php`, `app/Actions/RemoveUser.php`
- Modify: `app/Support/ApiAccess.php`, `app/Http/Api/ApiMiddleware.php`
- Create: `app/Http/Controllers/Api/UsersController.php`, `app/Http/Controllers/Api/InvitationsController.php`, `app/Http/Controllers/InvitationController.php`
- Modify: `routes/api.php`, `routes/web.php`
- Modify: `lang/en.json`, `lang/de.json`
- Test: `tests/Feature/Actions/UserManagementTest.php`, `tests/Feature/Api/UsersApiTest.php`, `tests/Feature/Pages/InvitationPageTest.php`, `tests/Feature/Api/RightsMatrixTest.php`, `tests/Unit/ArchTest.php`

**Interfaces:**
- Consumes: `Actor` (`userId`), `User` (`role`, `tokens()`), `ApiJson`, `RequestBody`, `CurrentActor`.
- Produces:
  - Actions laut Interfaces; `OwnerRequiredException` (403, `reason` = `owner_required`); `ActionNotAllowedException::lastOwner()` (409 `last_owner`), `::cannotRemoveSelf()` (409 `cannot_remove_self`)
  - `Owners::assertOwner(Actor): User`, `Owners::isOwner(Actor): bool`
  - `InvitationLinks::for(UserInvitation $invitation, string $locale): string` (absolute URL), `InvitationLinks::state(?UserInvitation): 'open'|'expired'|'closed'`
  - `UserRows::user(User $user, ?string $viewerId): array{id, name, email, role, is_self}`, `UserRows::invitation(UserInvitation $invitation, ?string $link): array{id, email, role, expires_at, link}`
  - `ApiAccess::SESSION = 'session'`, `ApiMiddleware::SESSION = ['auth:sanctum', 'api.ability:session']`
  - Web-Route `invitations.show` (`GET|POST /{locale}/invitations/{invitation}`), Inertia-Seite `invitation` mit Props `{ state: 'open'|'expired'|'closed'; email: string|null; role: 'owner'|'member'|null }`

- [ ] **Step 1: Failing Tests**

`tests/Feature/Actions/UserManagementTest.php`:

```php
<?php

use App\Actions\AcceptInvitation;
use App\Actions\ChangeUserRole;
use App\Actions\InviteUser;
use App\Actions\RemoveUser;
use App\Enums\UserRole;
use App\Exceptions\ActionNotAllowedException;
use App\Exceptions\OwnerRequiredException;
use App\Models\Document;
use App\Models\User;
use App\Models\UserInvitation;
use App\Support\Actor;
use Illuminate\Support\Facades\DB;

function ownerActor(): array
{
    $owner = User::factory()->owner()->create();

    return [$owner, Actor::user($owner)];
}

it('invites by email and role and turns the invitation into an account once', function () {
    [, $actor] = ownerActor();

    $invitation = app(InviteUser::class)->handle($actor, ['email' => ' lena@example.com ', 'role' => 'member']);
    expect($invitation->email)->toBe('lena@example.com')
        ->and($invitation->expires_at->isFuture())->toBeTrue();

    $user = app(AcceptInvitation::class)->handle(systemActor(), $invitation, ['name' => 'Lena Sommer', 'password' => 'long-enough', 'password_confirmation' => 'long-enough']);
    expect($user->role)->toBe(UserRole::Member)
        ->and($user->email)->toBe('lena@example.com')
        ->and($invitation->fresh()->accepted_at)->not->toBeNull();

    $errors = validationErrors(fn () => app(AcceptInvitation::class)->handle(systemActor(), $invitation->fresh(), ['name' => 'Again', 'password' => 'long-enough', 'password_confirmation' => 'long-enough']));
    expect(array_keys($errors))->toBe(['invitation']);
});

it('replaces an open invitation to the same address and refuses existing accounts', function () {
    [, $actor] = ownerActor();
    User::factory()->create(['email' => 'taken@example.com']);

    $first = app(InviteUser::class)->handle($actor, ['email' => 'nils@example.com', 'role' => 'member']);
    app(InviteUser::class)->handle($actor, ['email' => 'nils@example.com', 'role' => 'owner']);

    expect(UserInvitation::query()->where('email', 'nils@example.com')->pluck('role')->map->value->all())->toBe(['owner'])
        ->and(UserInvitation::query()->find($first->id))->toBeNull()
        ->and(array_keys(validationErrors(fn () => app(InviteUser::class)->handle($actor, ['email' => 'TAKEN@example.com', 'role' => 'member']))))->toBe(['email']);
});

it('refuses an invitation whose address got an account in the meantime', function () {
    [, $actor] = ownerActor();
    $invitation = app(InviteUser::class)->handle($actor, ['email' => 'mia@example.com', 'role' => 'member']);
    User::factory()->create(['email' => 'mia@example.com']);

    expect(array_keys(validationErrors(fn () => app(AcceptInvitation::class)->handle(systemActor(), $invitation, ['name' => 'Mia', 'password' => 'long-enough', 'password_confirmation' => 'long-enough']))))->toBe(['email']);
});

it('lets only owners manage users (review focus)', function (Closure $run) {
    $member = User::factory()->create();
    $other = User::factory()->create();

    expect(fn () => $run(Actor::user($member), $other))->toThrow(OwnerRequiredException::class);
})->with([
    'invite' => [fn (Actor $actor) => app(InviteUser::class)->handle($actor, ['email' => 'x@example.com', 'role' => 'member'])],
    'change role' => [fn (Actor $actor, User $user) => app(ChangeUserRole::class)->handle($actor, $user, ['role' => 'owner'])],
    'remove' => [fn (Actor $actor, User $user) => app(RemoveUser::class)->handle($actor, $user)],
]);

it('keeps the last owner (review focus)', function () {
    [$owner, $actor] = ownerActor();

    expect(fn () => app(ChangeUserRole::class)->handle($actor, $owner, ['role' => 'member']))->toThrow(ActionNotAllowedException::class)
        ->and(fn () => app(RemoveUser::class)->handle($actor, $owner))->toThrow(ActionNotAllowedException::class);

    $second = User::factory()->owner()->create();
    app(ChangeUserRole::class)->handle($actor, $second, ['role' => 'member']);
    expect($second->fresh()->role)->toBe(UserRole::Member);
});

it('removes a user with tokens and sessions; documents keep existing without author', function () {
    [, $actor] = ownerActor();
    $user = User::factory()->create();
    apiToken(['api:read'], null, $user);
    DB::table('sessions')->insert(['id' => 'sess-1', 'user_id' => $user->id, 'ip_address' => null, 'user_agent' => null, 'payload' => '', 'last_activity' => time()]);
    $document = Document::factory()->finalized()->create(['created_by' => $user->id]);

    app(RemoveUser::class)->handle($actor, $user);

    expect(User::query()->find($user->id))->toBeNull()
        ->and(DB::table('personal_access_tokens')->where('tokenable_id', $user->id)->count())->toBe(0)
        ->and(DB::table('sessions')->where('user_id', $user->id)->count())->toBe(0)
        ->and(Document::query()->find($document->id)?->created_by)->toBeNull();
});
```

Der letzte Test läuft durch, weil InnoDB für Fremdschlüsselaktionen (`nullOnDelete` auf `documents.created_by`) keine Trigger auslöst. Scheitert er trotzdem mit `SQLSTATE 45000` (`openbill: …`), stoppen und melden – dann braucht es eine Entscheidung (Konto deaktivieren statt löschen).

`tests/Feature/Api/UsersApiTest.php`:

```php
<?php

use App\Models\User;
use App\Models\UserInvitation;

it('lists users and open invitations with links for owners only', function () {
    $owner = User::factory()->owner()->create(['name' => 'Anna Owner']);
    $member = User::factory()->create(['name' => 'Ben Member']);
    $this->actingAs($owner)->postJson('/api/invitations', ['email' => 'lena@example.com', 'role' => 'member'])
        ->assertCreated()
        ->assertJsonPath('email', 'lena@example.com')
        ->assertJsonPath('link', fn (string $link): bool => str_starts_with($link, url('/en/invitations/')) && str_contains($link, 'signature='));

    $this->actingAs($owner)->getJson('/api/users')
        ->assertOk()
        ->assertJsonPath('users.0.name', 'Anna Owner')
        ->assertJsonPath('users.0.is_self', true)
        ->assertJsonPath('invitations.0.email', 'lena@example.com');

    $this->actingAs($member)->getJson('/api/users')
        ->assertOk()
        ->assertJsonPath('invitations.0.link', null);
    $this->actingAs($member)->postJson('/api/invitations', ['email' => 'x@example.com', 'role' => 'member'])
        ->assertForbidden()
        ->assertJsonPath('reason', 'owner_required');
});

it('changes roles, protects the last owner and removes users over the session API', function () {
    $owner = User::factory()->owner()->create();
    $member = User::factory()->create();

    $this->actingAs($owner)->patchJson("/api/users/{$owner->id}", ['role' => 'member'])->assertStatus(409)->assertJsonPath('reason', 'last_owner');
    $this->actingAs($owner)->patchJson("/api/users/{$member->id}", ['role' => 'owner'])->assertOk()->assertJsonPath('role', 'owner');
    $this->actingAs($owner)->deleteJson("/api/users/{$owner->id}")->assertStatus(409)->assertJsonPath('reason', 'cannot_remove_self');
    $this->actingAs($owner)->deleteJson("/api/users/{$member->id}")->assertNoContent();
});

it('revokes invitations', function () {
    $owner = User::factory()->owner()->create();
    $invitation = UserInvitation::factory()->create();

    $this->actingAs($owner)->deleteJson("/api/invitations/{$invitation->id}")->assertNoContent();
    expect(UserInvitation::query()->find($invitation->id))->toBeNull();
});

it('closes the user endpoints to every API token', function () {
    $this->withToken(apiToken(['api:read', 'api:write']))->getJson('/api/users')->assertForbidden();
});
```

`tests/Feature/Pages/InvitationPageTest.php`:

```php
<?php

use App\Models\User;
use App\Models\UserInvitation;
use App\Support\InvitationLinks;
use Inertia\Testing\AssertableInertia as Assert;

function relativeLink(UserInvitation $invitation, string $locale = 'en'): string
{
    return str_replace(url('/'), '', InvitationLinks::for($invitation, $locale));
}

it('shows an open invitation and creates the account', function () {
    $invitation = UserInvitation::factory()->create(['email' => 'lena@example.com']);
    $link = relativeLink($invitation, 'de');

    $this->get($link)->assertOk()->assertInertia(fn (Assert $page) => $page->component('invitation')->where('state', 'open')->where('email', 'lena@example.com'));

    $this->post($link, ['name' => 'Lena Sommer', 'password' => 'long-enough', 'password_confirmation' => 'long-enough'])->assertRedirect('/de');
    $this->assertAuthenticatedAs(User::query()->where('email', 'lena@example.com')->sole());
});

it('explains expired and used invitations and refuses tampered links (review focus)', function () {
    $expired = UserInvitation::factory()->create(['expires_at' => now()->subDay()]);
    $used = UserInvitation::factory()->create(['accepted_at' => now()]);
    $open = UserInvitation::factory()->create();

    $this->get(relativeLink($expired))->assertOk()->assertInertia(fn (Assert $page) => $page->where('state', 'expired'));
    $this->get(relativeLink($used))->assertOk()->assertInertia(fn (Assert $page) => $page->where('state', 'closed'));
    $this->get(relativeLink($open).'x')->assertForbidden();
    $this->get("/en/invitations/{$open->id}")->assertForbidden();
});

it('keeps the form errors on the page', function () {
    $link = relativeLink(UserInvitation::factory()->create());

    $this->from($link)->post($link, ['name' => '', 'password' => 'short', 'password_confirmation' => 'other'])
        ->assertRedirect($link)
        ->assertSessionHasErrors(['name', 'password']);
    $this->assertGuest();
});
```

`MATRIX_ROUTES` (Session-only: kein Token darf, `[]`):

```php
    'list users' => ['GET', '/api/users', []],
    'change user' => ['PATCH', '/api/users/{customer}', []],
    'remove user' => ['DELETE', '/api/users/{customer}', []],
    'invite user' => ['POST', '/api/invitations', []],
    'revoke invitation' => ['DELETE', '/api/invitations/{customer}', []],
```

(`{customer}` dient nur als irgendeine ULID; der Guard-Test bildet sie auf `{id}` ab, die Routen heißen `api/users/{id}` und `api/invitations/{id}`.)

In `tests/Unit/ArchTest.php` die Liste `domain exceptions carry an HTTP status` um `'App\Exceptions\OwnerRequiredException'` ergänzen.

Run: `ddev artisan test --filter='UserManagementTest|UsersApiTest|InvitationPageTest|RightsMatrixTest'`
Expected: FAIL (Tabelle, Klassen, Routen fehlen).

- [ ] **Step 2: Migration, Model, Factory**

`database/migrations/2026_10_12_100000_create_user_invitations_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Invitations by copyable signed link (no mail): email, role, who invited, until when, accepted when. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_invitations', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('email');
            $table->string('role', 16);
            $table->foreignUlid('invited_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('expires_at');
            $table->timestamp('accepted_at')->nullable();
            $table->timestamps();
            $table->index('email');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_invitations');
    }
};
```

`app/Models/UserInvitation.php` (Stil wie `app/Models/TextBlock.php`):

```php
<?php

namespace App\Models;

use App\Enums\UserRole;
use Database\Factories\UserInvitationFactory;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class UserInvitation extends Model
{
    /** @use HasFactory<UserInvitationFactory> */
    use HasFactory, HasUlids;

    protected $guarded = ['id'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'role' => UserRole::class,
            'expires_at' => 'datetime',
            'accepted_at' => 'datetime',
        ];
    }
}
```

`database/factories/UserInvitationFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Enums\UserRole;
use App\Models\UserInvitation;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<UserInvitation>
 */
class UserInvitationFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'email' => fake()->unique()->safeEmail(),
            'role' => UserRole::Member,
            'invited_by_id' => null,
            'expires_at' => now()->addDays(7),
            'accepted_at' => null,
        ];
    }
}
```

`DemoSeeder::wipe()` lässt Benutzer stehen; Einladungen sind Kontodaten wie Benutzer und bleiben ebenfalls (kein Eingriff in den Seeder).

- [ ] **Step 3: Ausnahmen, Rollen-Docblocks, Support**

`app/Exceptions/OwnerRequiredException.php`:

```php
<?php

namespace App\Exceptions;

use App\Support\Text;

/** Only owners manage users and invitations (403). */
final class OwnerRequiredException extends DomainActionException
{
    public function __construct()
    {
        parent::__construct(Text::t('errors.owner_required'));
    }

    public function reason(): string
    {
        return 'owner_required';
    }

    public function status(): int
    {
        return 403;
    }
}
```

In `ActionNotAllowedException` ergänzen:

```php
    /** At least one owner must stay (role change or removal). */
    public static function lastOwner(): self
    {
        return new self('last_owner', Text::t('errors.last_owner'));
    }

    public static function cannotRemoveSelf(): self
    {
        return new self('cannot_remove_self', Text::t('errors.cannot_remove_self'));
    }
```

`app/Enums/UserRole.php` Docblocks: Owner „Full access including users and invitations; the account from app:ensure-admin.“, Member „Everything except managing users (documents, customers, templates, fields, settings).“

`app/Support/Owners.php`:

```php
<?php

namespace App\Support;

use App\Enums\UserRole;
use App\Exceptions\OwnerRequiredException;
use App\Models\User;

final class Owners
{
    /** The owner behind the actor (session user or token owner). */
    public static function assertOwner(Actor $actor): User
    {
        $user = $actor->userId === null ? null : User::query()->find($actor->userId);
        if (! $user instanceof User || $user->role !== UserRole::Owner) {
            throw new OwnerRequiredException;
        }

        return $user;
    }

    public static function isOwner(Actor $actor): bool
    {
        return $actor->userId !== null && User::query()->whereKey($actor->userId)->where('role', UserRole::Owner)->exists();
    }
}
```

`app/Support/InvitationLinks.php`:

```php
<?php

namespace App\Support;

use App\Models\UserInvitation;
use Illuminate\Support\Facades\URL;

/**
 * Copyable invitation link: signed (relative, like SignedDownloads), without expiry in the signature – the invitation
 * itself expires, so an old link shows "expired" instead of a bare 403.
 */
final class InvitationLinks
{
    public static function for(UserInvitation $invitation, string $locale): string
    {
        return url(URL::signedRoute('invitations.show', ['locale' => $locale, 'invitation' => $invitation->id], absolute: false));
    }

    /** @return 'open'|'expired'|'closed' */
    public static function state(?UserInvitation $invitation): string
    {
        return match (true) {
            $invitation === null || $invitation->accepted_at !== null => 'closed',
            $invitation->expires_at->isPast() => 'expired',
            default => 'open',
        };
    }
}
```

`app/Support/UserRows.php`:

```php
<?php

namespace App\Support;

use App\Models\User;
use App\Models\UserInvitation;

/** JSON rows of the users settings (GET /api/users and the answers of the user actions). */
final class UserRows
{
    /** @return array{id: string, name: string, email: string, role: string, is_self: bool} */
    public static function user(User $user, ?string $viewerId): array
    {
        return ['id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'role' => $user->role->value, 'is_self' => $user->id === $viewerId];
    }

    /** @return array{id: string, email: string, role: string, expires_at: string, link: string|null} */
    public static function invitation(UserInvitation $invitation, ?string $link): array
    {
        return ['id' => $invitation->id, 'email' => $invitation->email, 'role' => $invitation->role->value, 'expires_at' => $invitation->expires_at->toAtomString(), 'link' => $link];
    }
}
```

- [ ] **Step 4: Actions**

`app/Actions/ListUsers.php`:

```php
<?php

namespace App\Actions;

use App\Models\User;
use App\Models\UserInvitation;
use App\Support\Actor;
use App\Support\InvitationLinks;
use App\Support\Owners;
use App\Support\UserRows;

/** GET /api/users: all users and the open invitations; only owners get the copyable links. */
final class ListUsers
{
    /**
     * @return array{users: list<array<string, mixed>>, invitations: list<array<string, mixed>>}
     */
    public function handle(Actor $actor, string $locale): array
    {
        $owner = Owners::isOwner($actor);

        return [
            'users' => User::query()->orderBy('name')->get()->map(fn (User $user): array => UserRows::user($user, $actor->userId))->values()->all(),
            'invitations' => UserInvitation::query()->whereNull('accepted_at')->where('expires_at', '>', now())->orderBy('created_at')->get()
                ->map(fn (UserInvitation $invitation): array => UserRows::invitation($invitation, $owner ? InvitationLinks::for($invitation, $locale) : null))
                ->values()->all(),
        ];
    }
}
```

`app/Actions/InviteUser.php`:

```php
<?php

namespace App\Actions;

use App\Enums\UserRole;
use App\Exceptions\OwnerRequiredException;
use App\Models\UserInvitation;
use App\Support\Actor;
use App\Support\Owners;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** POST /api/invitations: owner invites {email, role}; valid 7 days; replaces an open invitation to the same address. */
final class InviteUser
{
    public const DAYS = 7;

    /**
     * @param  array<string, mixed>  $input
     *
     * @throws OwnerRequiredException|ValidationException
     */
    public function handle(Actor $actor, array $input): UserInvitation
    {
        $owner = Owners::assertOwner($actor);
        $input['email'] = is_string($input['email'] ?? null) ? trim($input['email']) : ($input['email'] ?? null);
        $data = Validator::make($input, [
            // the collation compares case-insensitively, so Anna@… and anna@… are the same account
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users', 'email')],
            'role' => ['required', Rule::enum(UserRole::class)],
        ])->validate();

        return DB::transaction(function () use ($data, $owner): UserInvitation {
            UserInvitation::query()->where('email', $data['email'])->whereNull('accepted_at')->delete();

            return UserInvitation::query()->create([
                'email' => $data['email'],
                'role' => UserRole::from($data['role']),
                'invited_by_id' => $owner->id,
                'expires_at' => now()->addDays(self::DAYS),
            ]);
        });
    }
}
```

Die Datenbank läuft mit `utf8mb4_unicode_ci` (`config/database.php`): Vergleiche ignorieren Groß-/Kleinschreibung, darauf baut der Test „TAKEN@example.com“.

`app/Actions/RevokeInvitation.php`:

```php
<?php

namespace App\Actions;

use App\Exceptions\OwnerRequiredException;
use App\Models\UserInvitation;
use App\Support\Actor;
use App\Support\Owners;

/** DELETE /api/invitations/{id}: the link stops working at once. */
final class RevokeInvitation
{
    /**
     * @throws OwnerRequiredException
     */
    public function handle(Actor $actor, UserInvitation $invitation): void
    {
        Owners::assertOwner($actor);
        $invitation->delete();
    }
}
```

`app/Actions/AcceptInvitation.php`:

```php
<?php

namespace App\Actions;

use App\Models\User;
use App\Models\UserInvitation;
use App\Support\Actor;
use App\Support\Text;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

/** The invited person sets name and password: a new account with the invited role; the invitation is used up. */
final class AcceptInvitation
{
    /**
     * @param  array<string, mixed>  $input  name, password, password_confirmation
     *
     * @throws ValidationException
     */
    public function handle(Actor $actor, UserInvitation $invitation, array $input): User
    {
        $data = Validator::make($input, [
            'name' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string', 'min:8', 'max:255', 'confirmed'],
        ])->validate();

        return DB::transaction(function () use ($invitation, $data): User {
            $invitation = UserInvitation::query()->lockForUpdate()->findOrFail($invitation->id);
            if ($invitation->accepted_at !== null || $invitation->expires_at->isPast()) {
                throw ValidationException::withMessages(['invitation' => [Text::t('invitations.closed')]]);
            }
            if (User::query()->where('email', $invitation->email)->exists()) {
                throw ValidationException::withMessages(['email' => [Text::t('invitations.email_taken')]]);
            }

            $user = User::query()->create([
                'name' => trim((string) $data['name']),
                'email' => $invitation->email,
                'password' => $data['password'],
                'role' => $invitation->role,
                'locale' => app()->getLocale(),
            ]);
            $invitation->forceFill(['accepted_at' => now()])->save();

            return $user;
        });
    }
}
```

`app/Actions/ChangeUserRole.php`:

```php
<?php

namespace App\Actions;

use App\Enums\UserRole;
use App\Exceptions\ActionNotAllowedException;
use App\Exceptions\OwnerRequiredException;
use App\Models\User;
use App\Support\Actor;
use App\Support\Owners;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** PATCH /api/users/{id} {role}: owners only; the last owner stays owner (owner rows locked, two owners at once cannot demote each other). */
final class ChangeUserRole
{
    /**
     * @param  array<string, mixed>  $input
     *
     * @throws OwnerRequiredException|ActionNotAllowedException|ValidationException
     */
    public function handle(Actor $actor, User $user, array $input): User
    {
        Owners::assertOwner($actor);
        $role = UserRole::from(Validator::make($input, ['role' => ['required', Rule::enum(UserRole::class)]])->validate()['role']);

        return DB::transaction(function () use ($user, $role): User {
            $owners = User::query()->where('role', UserRole::Owner)->lockForUpdate()->pluck('id')->all();
            if ($role === UserRole::Member && $owners === [$user->id]) {
                throw ActionNotAllowedException::lastOwner();
            }
            $user->forceFill(['role' => $role])->save();

            return $user;
        });
    }
}
```

`app/Actions/RemoveUser.php`:

```php
<?php

namespace App\Actions;

use App\Enums\UserRole;
use App\Exceptions\ActionNotAllowedException;
use App\Exceptions\OwnerRequiredException;
use App\Models\User;
use App\Support\Actor;
use App\Support\Owners;
use Illuminate\Support\Facades\DB;

/**
 * DELETE /api/users/{id}: owners only, never oneself, never the last owner. Tokens and sessions go with the account;
 * documents.created_by becomes NULL through the foreign key (InnoDB runs no triggers for foreign key actions).
 */
final class RemoveUser
{
    /**
     * @throws OwnerRequiredException|ActionNotAllowedException
     */
    public function handle(Actor $actor, User $user): void
    {
        $owner = Owners::assertOwner($actor);
        if ($owner->id === $user->id) {
            throw ActionNotAllowedException::cannotRemoveSelf();
        }

        DB::transaction(function () use ($user): void {
            $owners = User::query()->where('role', UserRole::Owner)->lockForUpdate()->pluck('id')->all();
            if ($owners === [$user->id]) {
                throw ActionNotAllowedException::lastOwner();
            }
            $user->tokens()->delete();
            DB::table('sessions')->where('user_id', $user->id)->delete();
            $user->delete();
        });
    }
}
```

- [ ] **Step 5: Zugriffsregel „nur Sitzung“, Controller, Routen**

`app/Support/ApiAccess.php`: Konstante `public const SESSION = 'session';` und in `OPEN` den Eintrag `self::SESSION => [],` (keine Fähigkeit öffnet ihn; die Sitzung (`TransientToken`) kommt schon vorher durch). Docblock der Klasse um „SESSION: only the own UI (user management).“ ergänzen.

`app/Http/Api/ApiMiddleware.php`: `public const SESSION = ['auth:sanctum', 'api.ability:session'];`

`app/Http/Controllers/Api/UsersController.php`:

```php
<?php

namespace App\Http\Controllers\Api;

use App\Actions\ChangeUserRole;
use App\Actions\ListUsers;
use App\Actions\RemoveUser;
use App\Http\Api\ApiJson;
use App\Http\Api\CurrentActor;
use App\Http\Api\RequestBody;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\UserRows;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/** Users of the instance – only for the session of the own UI (ApiMiddleware::SESSION). */
final class UsersController extends Controller
{
    public function index(Request $request, ListUsers $list): JsonResponse
    {
        return ApiJson::ok($list->handle(CurrentActor::from($request), app()->getLocale()));
    }

    public function update(Request $request, ChangeUserRole $change): JsonResponse
    {
        $actor = CurrentActor::from($request);
        $user = $change->handle($actor, User::query()->findOrFail((string) $request->route('id')), RequestBody::object($request));

        return ApiJson::ok(UserRows::user($user, $actor->userId));
    }

    public function destroy(Request $request, RemoveUser $remove): Response
    {
        $remove->handle(CurrentActor::from($request), User::query()->findOrFail((string) $request->route('id')));

        return response()->noContent();
    }
}
```

`app/Http/Controllers/Api/InvitationsController.php`:

```php
<?php

namespace App\Http\Controllers\Api;

use App\Actions\InviteUser;
use App\Actions\RevokeInvitation;
use App\Http\Api\ApiJson;
use App\Http\Api\CurrentActor;
use App\Http\Api\RequestBody;
use App\Http\Controllers\Controller;
use App\Models\UserInvitation;
use App\Support\InvitationLinks;
use App\Support\UserRows;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/** Invitations by copyable link – session only. The link is in the language of the request (Accept-Language). */
final class InvitationsController extends Controller
{
    public function store(Request $request, InviteUser $invite): JsonResponse
    {
        $invitation = $invite->handle(CurrentActor::from($request), RequestBody::object($request));

        return ApiJson::ok(UserRows::invitation($invitation, InvitationLinks::for($invitation, app()->getLocale())), 201);
    }

    public function destroy(Request $request, RevokeInvitation $revoke): Response
    {
        $revoke->handle(CurrentActor::from($request), UserInvitation::query()->findOrFail((string) $request->route('id')));

        return response()->noContent();
    }
}
```

`routes/api.php`:

```php
// user management: only the session of the own UI, never API tokens (not in the OpenAPI document)
Route::middleware(ApiMiddleware::SESSION)->group(function (): void {
    Route::get('/users', [UsersController::class, 'index'])->name('api.users');
    Route::patch('/users/{id}', [UsersController::class, 'update'])->whereUlid('id')->name('api.users.update');
    Route::delete('/users/{id}', [UsersController::class, 'destroy'])->whereUlid('id')->name('api.users.destroy');
    Route::post('/invitations', [InvitationsController::class, 'store'])->name('api.invitations.store');
    Route::delete('/invitations/{id}', [InvitationsController::class, 'destroy'])->whereUlid('id')->name('api.invitations.destroy');
});
```

`app/Http/Controllers/InvitationController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Actions\AcceptInvitation;
use App\Models\UserInvitation;
use App\Support\Actor;
use App\Support\InvitationLinks;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

/** Signed invitation link (guest): set name and password, then signed in. */
class InvitationController extends Controller
{
    public function show(string $invitation): Response
    {
        $model = UserInvitation::query()->find($invitation);

        return Inertia::render('invitation', [
            'state' => InvitationLinks::state($model),
            'email' => $model?->email,
            'role' => $model?->role->value,
        ]);
    }

    public function store(Request $request, string $invitation, AcceptInvitation $accept): RedirectResponse
    {
        $user = $accept->handle(Actor::system(), UserInvitation::query()->findOrFail($invitation), $request->only(['name', 'password', 'password_confirmation']));
        Auth::login($user);
        $request->session()->regenerate();

        return redirect()->route('home');
    }
}
```

`routes/web.php` in der `guest`-Gruppe:

```php
        Route::get('/invitations/{invitation}', [InvitationController::class, 'show'])
            ->whereUlid('invitation')->middleware('signed:relative')->name('invitations.show');
        Route::post('/invitations/{invitation}', [InvitationController::class, 'store'])
            ->whereUlid('invitation')->middleware(['signed:relative', 'throttle:10,1']);
```

`SetLocale` entfernt den Parameter `locale`; `show(string $invitation)` bekommt deshalb wirklich die ULID (wie `CustomerController::show`).

- [ ] **Step 6: Übersetzungen (Backend)**

`lang/en.json`:

```json
"errors.cannot_remove_self": "You cannot remove yourself. Ask another owner.",
"errors.last_owner": "At least one owner must stay. Make someone else owner first.",
"errors.owner_required": "Only owners can manage users.",
"invitations.closed": "This invitation is no longer valid. Ask for a new one.",
"invitations.email_taken": "There is already an account with this email address. Log in instead."
```

`lang/de.json`:

```json
"errors.cannot_remove_self": "Du kannst dich nicht selbst entfernen. Bitte einen anderen Inhaber darum.",
"errors.last_owner": "Mindestens ein Inhaber muss bleiben. Mach vorher jemand anderen zum Inhaber.",
"errors.owner_required": "Nur Inhaber können Benutzer verwalten.",
"invitations.closed": "Diese Einladung gilt nicht mehr. Bitte um eine neue.",
"invitations.email_taken": "Zu dieser E-Mail-Adresse gibt es schon ein Konto. Melde dich stattdessen an."
```

Die Seite `invitation.tsx` entsteht in Task 13; bis dahin prüft `InvitationPageTest` nur den Komponentennamen – `withoutVite()` in `TestCase` verlangt aber die Datei `resources/js/pages/invitation.tsx`. Deshalb jetzt schon anlegen (Task 13 ersetzt den Inhalt):

```tsx
import { Head } from '@inertiajs/react';
import { t } from '@/lib/i18n';

export default function Invitation({ state }: { state: 'open' | 'expired' | 'closed' }) {
    return (
        <main className="grid min-h-dvh place-items-center p-6">
            <Head title={t('invitation.title')} />
            <p data-state={state}>{t('invitation.title')}</p>
        </main>
    );
}
```

und `"invitation.title": "Invitation to openbill"` / `"invitation.title": "Einladung zu openbill"` in beide Dateien.

- [ ] **Step 7: Tests laufen lassen**

Run: `ddev artisan migrate && ddev artisan test --filter='UserManagementTest|UsersApiTest|InvitationPageTest|RightsMatrixTest|ArchTest|TranslationsTest|SchemaTest'`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
ddev exec vendor/bin/pint && ddev exec vendor/bin/phpstan analyse --memory-limit=1G
git add app database routes resources/js/pages/invitation.tsx lang tests
git commit -m "feat: user management with signed invitation links, roles and last-owner protection" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 13: Einstellungen „Benutzer“ und Seite zum Annehmen der Einladung

**Files:**
- Create: `resources/js/api/users.ts`; Modify: `resources/js/api/keys.ts`, `resources/js/api/keys.test.ts`
- Create: `resources/js/settings/users.tsx`, `resources/js/settings/invite-dialog.tsx`
- Modify: `resources/js/pages/invitation.tsx` (vollständig ersetzen), `resources/js/pages/settings/show.tsx`
- Modify: `lang/en.json`, `lang/de.json`

**Interfaces:**
- Consumes: Endpunkte aus Task 12 (`/api/users`, `/api/invitations`), Inertia-Props `invitation` (Task 12), `can_manage_users` (Task 1), `Avatar`, `Dialog`, `ConfirmDialog`, `LocaleSwitch`, `LogoMark`.
- Produces: `api/users.ts`: `type UserRow`, `type InvitationRow`, `useUsers()`, `inviteUser(email: string, role: UserRole): Promise<InvitationRow>`, `revokeInvitation(id)`, `changeUserRole(id, role): Promise<UserRow>`, `removeUser(id)`, `copyText(text: string): Promise<boolean>`; `keys.users()`.

- [ ] **Step 1: Schlüssel (TDD) und API**

`keys.test.ts`: `expect(keys.users()).toBe('/api/users');` → Run `ddev exec pnpm test -- resources/js/api/keys.test.ts` → FAIL; `keys.ts`: `users: () => '/api/users',` → PASS.

`resources/js/api/users.ts`:

```ts
import useSWR, { mutate } from 'swr';
import { api } from '@/lib/api';
import type { UserRole } from '@/types';
import { keys } from './keys';

export type UserRow = { id: string; name: string; email: string; role: UserRole; is_self: boolean };
export type InvitationRow = { id: string; email: string; role: UserRole; expires_at: string; link: string | null };
export type UsersResponse = { users: UserRow[]; invitations: InvitationRow[] };

export function useUsers() {
    return useSWR<UsersResponse>(keys.users());
}

const refresh = () => mutate(keys.users());

export async function inviteUser(email: string, role: UserRole): Promise<InvitationRow> {
    const invitation = await api<InvitationRow>('/api/invitations', { method: 'POST', body: { email, role } });
    void refresh();
    return invitation;
}

export async function revokeInvitation(id: string): Promise<void> {
    await api<void>(`/api/invitations/${id}`, { method: 'DELETE' });
    void refresh();
}

export async function changeUserRole(id: string, role: UserRole): Promise<UserRow> {
    const user = await api<UserRow>(`/api/users/${id}`, { method: 'PATCH', body: { role } });
    void refresh();
    return user;
}

export async function removeUser(id: string): Promise<void> {
    await api<void>(`/api/users/${id}`, { method: 'DELETE' });
    void refresh();
}

/** Clipboard when allowed (HTTPS, user gesture); false lets the caller show the link for manual copying. */
export async function copyText(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}
```

(`UserRole` ist in `resources/js/types.ts` schon exportiert.)

- [ ] **Step 2: Einladungsdialog**

`resources/js/settings/invite-dialog.tsx`:

```tsx
import { Check, Copy, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { copyText, inviteUser, type InvitationRow } from '@/api/users';
import { Button, Dialog, Select, TextInput } from '@/components/ui';
import { ApiError, errorMessage } from '@/lib/api';
import { t } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import type { UserRole } from '@/types';

/** Invite: email + role → the copyable link (no mail is sent). */
export function InviteDialog({ onClose }: { onClose(): void }) {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<UserRole>('member');
    const [error, setError] = useState<string | undefined>();
    const [pending, setPending] = useState(false);
    const [created, setCreated] = useState<InvitationRow | null>(null);
    const [copied, setCopied] = useState(false);

    const submit = async () => {
        setPending(true);
        try {
            setCreated(await inviteUser(email.trim(), role));
            setError(undefined);
        } catch (e) {
            if (e instanceof ApiError && e.status === 422) setError(e.fieldErrors().email ?? errorMessage(e));
            else toast.error(errorMessage(e));
        } finally {
            setPending(false);
        }
    };

    const copy = async () => {
        if (created?.link && (await copyText(created.link))) {
            setCopied(true);
            toast.success(t('users.link_copied'));
        }
    };

    if (created) {
        return (
            <Dialog
                open
                onClose={onClose}
                title={t('users.invited_title')}
                description={t('users.invited_text', { email: created.email })}
                footer={
                    <>
                        <Button variant="ghost" onClick={onClose}>
                            {t('common.close')}
                        </Button>
                        <Button variant="primary" icon={copied ? <Check /> : <Copy />} onClick={() => void copy()}>
                            {t('users.copy_link')}
                        </Button>
                    </>
                }
            >
                <TextInput label={t('users.link')} value={created.link ?? ''} readOnly className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} hint={t('users.link_hint')} />
            </Dialog>
        );
    }

    return (
        <Dialog
            open
            onClose={onClose}
            title={t('users.invite_title')}
            description={t('users.invite_text')}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>
                        {t('common.cancel')}
                    </Button>
                    <Button variant="primary" icon={<UserPlus />} pending={pending} onClick={() => void submit()}>
                        {t('users.create_link')}
                    </Button>
                </>
            }
        >
            <form
                noValidate
                className="grid gap-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    void submit();
                }}
            >
                <TextInput label={t('users.email')} type="email" value={email} data-autofocus placeholder="name@example.com" error={error} onChange={(e) => setEmail(e.target.value)} />
                <Select label={t('users.role')} value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
                    <option value="member">{t('users.role_member_text')}</option>
                    <option value="owner">{t('users.role_owner_text')}</option>
                </Select>
            </form>
        </Dialog>
    );
}
```

- [ ] **Step 3: Benutzerliste**

`resources/js/settings/users.tsx`:

```tsx
import { Copy, Trash2, UserPlus, X } from 'lucide-react';
import { useState } from 'react';
import { changeUserRole, copyText, removeUser, revokeInvitation, useUsers, type UserRow } from '@/api/users';
import { Avatar, Badge, Button, CardHead, ConfirmDialog, ErrorState, ListSkeleton, SelectControl } from '@/components/ui';
import { SettingsCard } from './settings-card';
import { errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import type { UserRole } from '@/types';
import { InviteDialog } from './invite-dialog';

const ROW = 'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-md px-3 py-2.5 hover:bg-surface sm:grid-cols-[auto_minmax(0,1fr)_10rem_2.5rem]';

export function UserSettings({ canManage }: { canManage: boolean }) {
    const users = useUsers();
    const [inviting, setInviting] = useState(false);
    const [removing, setRemoving] = useState<UserRow | null>(null);
    const [pending, setPending] = useState(false);

    const run = async (task: () => Promise<unknown>, success?: string) => {
        try {
            await task();
            if (success) toast.success(success);
        } catch (error) {
            toast.error(errorMessage(error));
        }
    };

    const confirmRemove = async () => {
        if (!removing) return;
        setPending(true);
        await run(() => removeUser(removing.id), t('users.removed', { name: removing.name }));
        setPending(false);
        setRemoving(null);
    };

    return (
        <div className="grid gap-6">
            <SettingsCard flush>
                <div className="px-5 pt-5">
                    <CardHead
                        title={t('settings.section.users')}
                        description={canManage ? t('users.text_owner') : t('users.text_member')}
                        actions={
                            canManage && (
                                <Button size="sm" variant="soft" icon={<UserPlus />} onClick={() => setInviting(true)}>
                                    {t('users.invite')}
                                </Button>
                            )
                        }
                    />
                </div>
                {users.error ? (
                    <ErrorState error={users.error} onRetry={() => void users.mutate()} />
                ) : !users.data ? (
                    <ListSkeleton rows={2} />
                ) : (
                    <ul className="m-0 grid list-none gap-0.5 px-2 pb-2">
                        {users.data.users.map((user) => (
                            <li key={user.id} className={ROW}>
                                <Avatar name={user.name} size="sm" />
                                <span className="grid min-w-0 gap-0.5">
                                    <span className="truncate font-strong">
                                        {user.name}
                                        {user.is_self && <span className="font-normal text-muted"> · {t('users.you')}</span>}
                                    </span>
                                    <span className="truncate text-sm text-muted">{user.email}</span>
                                </span>
                                {canManage ? (
                                    <SelectControl
                                        aria-label={t('users.role_of', { name: user.name })}
                                        value={user.role}
                                        className="col-start-2 sm:col-start-auto"
                                        onChange={(e) => void run(() => changeUserRole(user.id, e.target.value as UserRole), t('users.role_changed', { name: user.name }))}
                                    >
                                        <option value="member">{t('users.role.member')}</option>
                                        <option value="owner">{t('users.role.owner')}</option>
                                    </SelectControl>
                                ) : (
                                    <Badge plain tone={user.role === 'owner' ? 'ink' : 'neutral'}>
                                        {t(`users.role.${user.role}`)}
                                    </Badge>
                                )}
                                <span className="row-start-1 flex justify-end sm:row-start-auto">
                                    {canManage && !user.is_self && (
                                        <Button variant="ghost" size="sm" iconOnly icon={<Trash2 />} onClick={() => setRemoving(user)}>
                                            {t('users.remove_named', { name: user.name })}
                                        </Button>
                                    )}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </SettingsCard>

            {users.data && users.data.invitations.length > 0 && (
                <SettingsCard flush>
                    <div className="px-5 pt-5">
                        <CardHead title={t('users.invitations')} description={t('users.invitations_text')} />
                    </div>
                    <ul className="m-0 grid list-none gap-0.5 px-2 pb-2">
                        {users.data.invitations.map((invitation) => (
                            <li key={invitation.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md px-3 py-2.5 hover:bg-surface">
                                <span className="grid min-w-0 gap-0.5">
                                    <span className="truncate font-strong">{invitation.email}</span>
                                    <span className="text-sm text-muted">
                                        {t(`users.role.${invitation.role}`)} · {t('users.valid_until', { date: formatDate(invitation.expires_at) })}
                                    </span>
                                </span>
                                {canManage && invitation.link && (
                                    <span className="flex gap-0.5">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            icon={<Copy />}
                                            onClick={() => void copyText(invitation.link!).then((ok) => (ok ? toast.success(t('users.link_copied')) : toast.info(invitation.link!)))}
                                        >
                                            {t('users.copy_link')}
                                        </Button>
                                        <Button size="sm" variant="ghost" iconOnly icon={<X />} onClick={() => void run(() => revokeInvitation(invitation.id), t('users.revoked', { email: invitation.email }))}>
                                            {t('users.revoke_named', { email: invitation.email })}
                                        </Button>
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                </SettingsCard>
            )}

            {inviting && <InviteDialog onClose={() => setInviting(false)} />}
            <ConfirmDialog
                open={removing !== null}
                onClose={() => setRemoving(null)}
                onConfirm={() => void confirmRemove()}
                title={t('users.remove_title', { name: removing?.name ?? '' })}
                description={t('users.remove_text')}
                confirmLabel={t('users.remove')}
                pending={pending}
                danger
            />
        </div>
    );
}
```


`resources/js/pages/settings/show.tsx`: Import `UserSettings` und

```tsx
        case 'users':
            return <UserSettings canManage={canManageUsers} />;
```

sowie die Zeile `void canManageUsers;` und den `default`-Zweig entfernen (alle fünf Fälle sind jetzt da; `renderSection` gibt für jeden Abschnitt etwas zurück, TypeScript prüft die Vollständigkeit über den `switch` mit Rückgabetyp `ReactNode`). Den Import `Skeleton` entfernen, wenn er nicht mehr benutzt wird.

- [ ] **Step 4: Seite „Einladung annehmen“**

`resources/js/pages/invitation.tsx` vollständig:

```tsx
import { Head, Link, useForm } from '@inertiajs/react';
import { UserCheck } from 'lucide-react';
import { Button, Notice, TextInput } from '@/components/ui';
import { LogoMark } from '@/layouts/logo';
import { path, t } from '@/lib/i18n';

type Props = { state: 'open' | 'expired' | 'closed'; email: string | null; role: 'owner' | 'member' | null };

/** Signed invitation link (/{locale}/invitations/{id}?signature=…): name and password, then signed in. */
export default function Invitation({ state, email, role }: Props) {
    const form = useForm({ name: '', password: '', password_confirmation: '' });
    const errors = form.errors as Record<string, string | undefined>;

    return (
        <main className="grid min-h-dvh content-center justify-items-start gap-8 px-6 py-12 sm:px-[clamp(1.5rem,8vw,8rem)]">
            <Head title={t('invitation.title')} />
            <div className="flex items-center gap-2.5 text-xl font-bold tracking-brand">
                <LogoMark />
                <span>openbill</span>
            </div>
            <div>
                <h1 className="text-3xl font-bold tracking-brand">{t('invitation.title')}</h1>
                {state === 'open' && email && role && <p className="mt-2 max-w-[44ch] text-muted">{t('invitation.lead', { email, role: t(`users.role.${role}`) })}</p>}
            </div>

            {state !== 'open' ? (
                <div className="grid max-w-sm gap-4">
                    <Notice tone="warn">{state === 'expired' ? t('invitation.expired') : t('invitations.closed')}</Notice>
                    <Link href={path('/login')}>{t('invitation.to_login')}</Link>
                </div>
            ) : (
                <form
                    noValidate
                    className="grid w-full max-w-sm gap-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        // the signature is part of the URL: post to exactly this address
                        form.post(window.location.pathname + window.location.search, { onFinish: () => form.reset('password', 'password_confirmation') });
                    }}
                >
                    {(errors.invitation || errors.email) && <Notice tone="bad">{errors.invitation ?? errors.email}</Notice>}
                    <TextInput label={t('invitation.email')} value={email ?? ''} readOnly autoComplete="username" />
                    <TextInput label={t('invitation.name')} autoComplete="name" autoFocus value={form.data.name} error={errors.name} onChange={(e) => form.setData('name', e.target.value)} />
                    <TextInput label={t('invitation.password')} type="password" autoComplete="new-password" value={form.data.password} error={errors.password} hint={t('invitation.password_hint')} onChange={(e) => form.setData('password', e.target.value)} />
                    <TextInput label={t('invitation.password_confirmation')} type="password" autoComplete="new-password" value={form.data.password_confirmation} onChange={(e) => form.setData('password_confirmation', e.target.value)} />
                    <Button type="submit" variant="primary" icon={<UserCheck />} pending={form.processing} className="mt-2">
                        {t('invitation.submit')}
                    </Button>
                </form>
            )}
        </main>
    );
}
```

Bewusst ohne `LocaleSwitch` (anders als die Login-Seite): Die Signatur deckt Pfad und Query ab (`signed:relative`), ein Sprachwechsel ändert den Pfad (`/en/…` → `/de/…`) und ergäbe 403. Die Sprache bestimmt der Link (Sprache des Owners beim Erstellen).

- [ ] **Step 5: Übersetzungen**

`lang/en.json`:

```json
"invitation.email": "Email",
"invitation.expired": "This invitation has expired. Ask the person who invited you for a new link.",
"invitation.lead": "You were invited as :role with :email. Choose your name and a password.",
"invitation.name": "Your name",
"invitation.password": "Password",
"invitation.password_confirmation": "Repeat password",
"invitation.password_hint": "At least 8 characters.",
"invitation.submit": "Create account",
"invitation.to_login": "To the login",
"users.copy_link": "Copy link",
"users.create_link": "Create invitation link",
"users.email": "Email",
"users.invitations": "Open invitations",
"users.invitations_text": "Links stay valid for 7 days or until they are used.",
"users.invite": "Invite",
"users.invite_text": "openbill sends no email: you get a link to pass on. The person sets their password themselves.",
"users.invite_title": "Invite user",
"users.invited_text": "Send this link to :email. It is valid for 7 days and works once.",
"users.invited_title": "Invitation created",
"users.link": "Invitation link",
"users.link_copied": "Link copied",
"users.link_hint": "Anyone with this link can create the account – share it only with the invited person.",
"users.remove": "Remove",
"users.remove_named": "Remove :name",
"users.remove_text": "The account, its API tokens and sessions are deleted. Documents stay.",
"users.remove_title": "Remove :name?",
"users.removed": ":name removed",
"users.revoke_named": "Revoke invitation for :email",
"users.revoked": "Invitation for :email revoked",
"users.role": "Role",
"users.role.member": "Member",
"users.role.owner": "Owner",
"users.role_changed": "Role of :name changed",
"users.role_member_text": "Member: documents, customers, templates and settings",
"users.role_of": "Role of :name",
"users.role_owner_text": "Owner: additionally users and invitations",
"users.text_member": "All users work in the same organization. Only owners invite and manage users.",
"users.text_owner": "All users work in the same organization. At least one owner always stays.",
"users.valid_until": "valid until :date",
"users.you": "you"
```

`lang/de.json`:

```json
"invitation.email": "E-Mail",
"invitation.expired": "Diese Einladung ist abgelaufen. Bitte die Person, die dich eingeladen hat, um einen neuen Link.",
"invitation.lead": "Du wurdest als :role mit :email eingeladen. Wähle deinen Namen und ein Passwort.",
"invitation.name": "Dein Name",
"invitation.password": "Passwort",
"invitation.password_confirmation": "Passwort wiederholen",
"invitation.password_hint": "Mindestens 8 Zeichen.",
"invitation.submit": "Konto anlegen",
"invitation.to_login": "Zur Anmeldung",
"users.copy_link": "Link kopieren",
"users.create_link": "Einladungslink erstellen",
"users.email": "E-Mail",
"users.invitations": "Offene Einladungen",
"users.invitations_text": "Links gelten 7 Tage oder bis sie benutzt wurden.",
"users.invite": "Einladen",
"users.invite_text": "openbill verschickt keine E-Mail: Du bekommst einen Link zum Weitergeben. Die Person legt ihr Passwort selbst fest.",
"users.invite_title": "Benutzer einladen",
"users.invited_text": "Schick diesen Link an :email. Er gilt 7 Tage und funktioniert einmal.",
"users.invited_title": "Einladung erstellt",
"users.link": "Einladungslink",
"users.link_copied": "Link kopiert",
"users.link_hint": "Wer diesen Link hat, kann das Konto anlegen – gib ihn nur an die eingeladene Person weiter.",
"users.remove": "Entfernen",
"users.remove_named": ":name entfernen",
"users.remove_text": "Das Konto, seine API-Tokens und Sitzungen werden gelöscht. Dokumente bleiben.",
"users.remove_title": ":name entfernen?",
"users.removed": ":name entfernt",
"users.revoke_named": "Einladung für :email zurückziehen",
"users.revoked": "Einladung für :email zurückgezogen",
"users.role": "Rolle",
"users.role.member": "Mitglied",
"users.role.owner": "Inhaber",
"users.role_changed": "Rolle von :name geändert",
"users.role_member_text": "Mitglied: Dokumente, Kunden, Templates und Einstellungen",
"users.role_of": "Rolle von :name",
"users.role_owner_text": "Inhaber: zusätzlich Benutzer und Einladungen",
"users.text_member": "Alle Benutzer arbeiten in derselben Organisation. Nur Inhaber laden ein und verwalten Benutzer.",
"users.text_owner": "Alle Benutzer arbeiten in derselben Organisation. Mindestens ein Inhaber bleibt immer.",
"users.valid_until": "gültig bis :date",
"users.you": "du"
```

- [ ] **Step 6: Prüfen**

Run: `ddev exec pnpm typecheck && ddev exec pnpm test && ddev artisan test --filter='InvitationPageTest|UsersApiTest|TranslationsTest|SetupPagesTest'`
Expected: PASS.

Manuell: Als Owner einladen → Dialog zeigt den Link, „Link kopieren“; Link in einem privaten Fenster öffnen → Formular, Konto anlegen → angemeldet auf der Übersicht; in der Liste ist die Einladung verschwunden, der neue Benutzer steht da; letzten Owner auf „Mitglied“ stellen → Fehler-Toast, Auswahl springt nach dem Neuladen der Liste zurück; als Mitglied angemeldet: keine Knöpfe, Rollen als Badge.

- [ ] **Step 7: Commit**

```bash
git add resources/js lang
git commit -m "feat: users settings with invitation links, roles and the invitation page" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 14: Kundenoption „Leistungsart“ und Steuerkategorie `O` für Dienstleistungen an Drittland-Kunden

**Files:**
- Create: `app/Enums/SupplyType.php`, `database/migrations/2026_10_12_100100_add_supply_type_to_customers.php`
- Modify: `app/Enums/TaxCategory.php`, `app/Models/Customer.php`, `app/Actions/SaveCustomer.php`, `app/ApiResource/CustomerResource.php`
- Modify: `app/Domain/Tax/TaxContext.php`, `app/Domain/Tax/LegalNotes.php`, `app/Domain/Tax/EffectiveTax.php`, `app/Domain/Compliance/PartyFacts.php`, `app/Domain/Compliance/ComplianceChecker.php`
- Modify: `app/Support/SnapshotBuilder.php`, `app/Support/DomainMapper.php`, `app/Support/LegalNoteTexts.php`, `app/EInvoice/CiiBuilder.php`
- Modify: `resources/js/api/types.ts`, `resources/js/lib/customers.ts`, `resources/js/lib/customers.test.ts`, `resources/js/pages/customers/show.tsx`, `resources/js/settings/tax-rate-drawer.tsx`
- Modify: `lang/en.json`, `lang/de.json`
- Test: `tests/Unit/EnumsTest.php`, `tests/Unit/Domain/TotalsTest.php`, `tests/Unit/Domain/ComplianceTest.php`, `tests/Feature/Actions/SupplyTypeTest.php`, `tests/Feature/EInvoice/EInvoiceSamplesTest.php`, `tests/Feature/Api/CustomerApiTest.php`

**Interfaces:**
- Consumes: `EffectiveTax::resolve`, `ComplianceChecker::check`, `CiiBuilder::build`, `LegalNoteTexts`, Snapshot-Form `customer`.
- Produces: `enum SupplyType: string { Goods = 'goods'; Services = 'services' }`; `TaxCategory::O`; `TaxContext::$supplyType` (Standard `Goods`, damit bestehende Aufrufe gleich bleiben); `LegalNotes::$thirdCountryServices`; `PartyFacts::$supplyType` (`?SupplyType`); Snapshot `customer.supply_type`, `legal_notes.third_country_services`; API `customers.supply_type`.

Fachlich (Entscheidung Phase 3): Drittland + Dienstleistung = nicht im Inland steuerbar (Kategorie `O`, 0 %, Hinweis), Drittland + Ware = steuerfreie Ausfuhr (`G`). Bei `O` verbietet BR-O-02 die USt-IDs von Verkäufer (BT-31) und Käufer (BT-48) in der XML; damit verlangt BR-CO-26 die Registernummer (BT-30). Snapshots ohne `supply_type` (vor Phase 7 abgeschlossen) gelten als Ware – so bleiben ihre Summen/Kategorien unverändert.

- [ ] **Step 1: Failing Unit-Tests**

`tests/Unit/EnumsTest.php`: Zeile `'tax categories'` auf `['S', 'Z', 'E', 'AE', 'K', 'G', 'O']` ändern und ergänzen: `'supply types' => [SupplyType::class, ['goods', 'services']],` (Import `App\Enums\SupplyType`).

`tests/Unit/Domain/TotalsTest.php`:
1. In `totalsCtx()` einen Parameter `SupplyType $supply = SupplyType::Goods` ergänzen, `new LegalNotes('small business note', 'reverse charge note', 'third country note', 'third country services note')` und `$supply` als fünftes Argument an `TaxContext` (Import `App\Enums\SupplyType`).
2. Test ergänzen:

```php
    it('uses O with its own note for services to third-country customers, G for goods', function () {
        $services = EffectiveTax::resolve('r19', totalsCtx(treatment: TaxTreatment::ThirdCountry, supply: SupplyType::Services));
        $goods = EffectiveTax::resolve('r19', totalsCtx(treatment: TaxTreatment::ThirdCountry, supply: SupplyType::Goods));

        expect($services?->category)->toBe(TaxCategory::O)
            ->and((string) $services?->percent)->toBe('0')
            ->and($services?->note)->toBe('third country services note')
            ->and($goods?->category)->toBe(TaxCategory::G)
            ->and($goods?->note)->toBe('third country note');
    });
```

(`Decimal::zero()` ist `BigDecimal::zero()`, als String `"0"`.)

`tests/Unit/Domain/ComplianceTest.php` ergänzen (Import `App\Enums\SupplyType`):

```php
it('needs no VAT ID but a register number for services to third-country customers (BR-O-02, BR-CO-26)', function () {
    $invoice = ['type' => DocumentType::Invoice, 'profile' => ComplianceProfile::En16931, 'serviceDate' => '2026-10-01', 'dueDate' => '2026-10-15'];
    $customer = new PartyFacts('C', 's', 'z', 'c', 'CH', taxTreatment: TaxTreatment::ThirdCountry, supplyType: SupplyType::Services);

    expect(compliancePaths([...$invoice, 'org' => new PartyFacts('O', 's', 'z', 'c', 'DE', vatId: 'DE1', iban: 'X'), 'customer' => $customer]))->toBe(['org.registration_id'])
        ->and(compliancePaths([...$invoice, 'org' => new PartyFacts('O', 's', 'z', 'c', 'DE', iban: 'X', registrationId: 'HRB 1'), 'customer' => $customer]))->toBe([]);
});
```

Run: `ddev artisan test --testsuite=Unit --filter='EnumsTest|TotalsTest|ComplianceTest'`
Expected: FAIL (`SupplyType` fehlt).

- [ ] **Step 2: Domain anpassen**

`app/Enums/SupplyType.php`:

```php
<?php

namespace App\Enums;

/** What a customer gets from us; decides the tax category for third-country customers (G goods, O services). */
enum SupplyType: string
{
    case Goods = 'goods';
    case Services = 'services';
}
```

`app/Enums/TaxCategory.php`: `case O = 'O';` nach `G` (Kommentar: `/** Not subject to VAT (services to third-country customers). */`).

`app/Domain/Tax/LegalNotes.php`: vierter Konstruktorparameter `public string $thirdCountryServices,`.

`app/Domain/Tax/TaxContext.php`: fünfter Konstruktorparameter `public SupplyType $supplyType = SupplyType::Goods,` (Import `App\Enums\SupplyType`; Domain darf Enums benutzen).

`app/Domain/Tax/EffectiveTax.php` – den Drittland-Zweig ersetzen:

```php
        if ($ctx->taxTreatment === TaxTreatment::ThirdCountry) {
            return $ctx->supplyType === SupplyType::Services
                ? new self(Decimal::zero(), TaxCategory::O, $ctx->notes->thirdCountryServices)
                : new self(Decimal::zero(), TaxCategory::G, $ctx->notes->thirdCountry);
        }
```

`app/Domain/Compliance/PartyFacts.php`: letzter Konstruktorparameter `public ?SupplyType $supplyType = null,`.

`app/Domain/Compliance/ComplianceChecker.php` – im EN-16931-Block den Anfang der USt-ID-Prüfung ersetzen:

```php
        // services to third-country customers are not subject to VAT (category O): BR-O-02 forbids the VAT IDs in the
        // XML, so BR-CO-26 needs the legal registration ID (BT-30)
        $notSubjectToVat = $in->taxationMode === TaxationMode::Regular
            && $in->customer?->taxTreatment === TaxTreatment::ThirdCountry
            && $in->customer->supplyType === SupplyType::Services;
        if ($notSubjectToVat) {
            if (trim($in->org->registrationId) === '') {
                $issues[] = new ComplianceIssue('org.registration_id', ComplianceRule::OrgSellerIdMissing);
            }
        } elseif (trim($in->org->vatId) === '') {
```

(der bisherige Inhalt des `if (trim($in->org->vatId) === '') { … }`-Blocks bleibt als Körper des `elseif`; Drittland erreicht ihn nur noch als Ware → BR-G-02 gilt weiter.)

Run: `ddev artisan test --testsuite=Unit`
Expected: PASS (`NoFloatTest`, `ArchTest` eingeschlossen).

- [ ] **Step 3: Daten, Snapshot, Mapper, Texte**

`database/migrations/2026_10_12_100100_add_supply_type_to_customers.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Goods or services; only matters for third-country customers (G vs. O). Services is the common case. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->string('supply_type', 16)->default('services')->after('tax_treatment');
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn('supply_type');
        });
    }
};
```

`customers` hat keine Sperr-Trigger (nur Dokument-Tabellen) – `SchemaTest` bleibt unberührt.

`app/Models/Customer.php` Casts: `'supply_type' => SupplyType::class,`.

`app/Actions/SaveCustomer.php`: Regel `'supply_type' => ['sometimes', Rule::enum(SupplyType::class)],` nach `tax_treatment`, und die Schleife `foreach (['name', 'tax_treatment', 'locale', 'custom'] …)` um `'supply_type'` ergänzen.

`app/ApiResource/CustomerResource.php`: Konstruktorparameter `public string $supply_type,` nach `$tax_treatment` und in `fromModel()` `supply_type: $customer->supply_type->value,`. (`SaveCustomer` lädt das Model nach dem Speichern neu – `refresh()` liefert den Datenbank-Standard.)

`app/Support/SnapshotBuilder.php` (Kunde): nach `'tax_treatment' => …` `'supply_type' => $customer->supply_type->value,`.

`app/Support/DomainMapper.php`:
- `taxContext()`: fünftes Argument

```php
            // snapshots finalized before phase 7 have no supply type and were exports (G)
            SupplyType::from($sources['customer']['supply_type'] ?? SupplyType::Goods->value),
```

- `party()`: `supplyType: isset($row['supply_type']) ? SupplyType::from($row['supply_type']) : null,`

`app/Support/LegalNoteTexts.php`:
- `for()`: viertes Argument `Text::t('legal.third_country_services', [], $locale),`
- `toArray()`: `'third_country_services' => $notes->thirdCountryServices,` (Docblock-Typ ergänzen)
- `fromSources()`: viertes Argument `(string) ($notes['third_country_services'] ?? Text::t('legal.third_country_services', [], $locale)),` (ältere Snapshots haben den Schlüssel nicht)

`app/EInvoice/CiiBuilder.php`: vor den Steuerregistrierungen

```php
        // BR-O-02: an invoice with category O carries neither the seller's nor the buyer's VAT ID
        $notSubjectToVat = array_filter($totals->taxBreakdown, fn ($row): bool => $row->category === TaxCategory::O) !== [];
```

und die beiden `VA`-Zeilen bedingen: `if (! $notSubjectToVat && self::text($org['vat_id'] ?? null) !== null)` bzw. `if (! $notSubjectToVat && self::text($customer['vat_id'] ?? null) !== null)`. Den Kommentar bei BT-30 ergänzen: „… and the only one with category O“.

Übersetzungen – `lang/en.json`:

```json
"einvoice.exemption.o": "Not subject to VAT",
"legal.third_country": "Tax-free export delivery (section 4 no. 1a, section 6 UStG).",
"legal.third_country_services": "Service not taxable in Germany (place of supply abroad, section 3a (2) UStG).",
"tax_category.O": "Not subject to VAT",
"customer.supply_type": "What you supply",
"customer.supply_type_hint": "Decides the tax category for customers outside the EU: services are not taxable in Germany (O), goods are tax-free exports (G).",
"customer.supply_type.goods": "Goods",
"customer.supply_type.services": "Services"
```

`lang/de.json`:

```json
"einvoice.exemption.o": "Nicht steuerbar",
"legal.third_country": "Steuerfreie Ausfuhrlieferung (§ 4 Nr. 1a, § 6 UStG).",
"legal.third_country_services": "Im Inland nicht steuerbare Leistung (Leistungsort im Ausland, § 3a Abs. 2 UStG).",
"tax_category.O": "Nicht steuerbar",
"customer.supply_type": "Leistungsart",
"customer.supply_type_hint": "Bestimmt die Steuerkategorie für Kunden außerhalb der EU: Dienstleistungen sind im Inland nicht steuerbar (O), Waren steuerfreie Ausfuhren (G).",
"customer.supply_type.goods": "Ware",
"customer.supply_type.services": "Dienstleistung"
```

(`legal.third_country` und `legal.third_country_services` bestehen schon bzw. sind neu – den vorhandenen Text von `legal.third_country` wie oben ersetzen: Er beschrieb bisher die Dienstleistung, gilt jetzt aber für Waren. Abgeschlossene Dokumente behalten ihren eingefrorenen Text aus dem Snapshot.)

`resources/js/settings/tax-rate-drawer.tsx`: `TAX_CATEGORIES` um `'O'` ergänzen.

- [ ] **Step 4: Feature- und E-Rechnungstests**

`tests/Feature/Actions/SupplyTypeTest.php`:

```php
<?php

use App\Enums\DocumentType;
use App\Enums\TaxTreatment;
use App\Models\Customer;
use App\Support\DocumentInspector;

it('defaults customers to services and renders third-country services as not taxable (O)', function () {
    $customer = Customer::factory()->create(['country' => 'CH', 'tax_treatment' => TaxTreatment::ThirdCountry]);
    expect($customer->fresh()->supply_type->value)->toBe('services');

    $document = draft(DocumentType::Invoice, [itemRow('Workshop', '10', '95')], ['customer_id' => $customer->id]);
    $totals = app(DocumentInspector::class)->totals($document, app(DocumentInspector::class)->sources($document))->toArray();

    expect($totals['tax_breakdown'][0]['category'])->toBe('O')
        ->and($totals['tax'])->toBe('0.00')
        ->and($totals['legal_notes'])->toContain(__('legal.third_country_services', [], $document->locale));
});

it('keeps exports of goods at G and saves the option over the API', function () {
    $customer = Customer::factory()->create(['country' => 'CH', 'tax_treatment' => TaxTreatment::ThirdCountry]);

    $this->withToken(apiToken())->patchJson("/api/customers/{$customer->id}", ['supply_type' => 'goods'], ['Content-Type' => 'application/merge-patch+json'])
        ->assertOk()
        ->assertJsonPath('supply_type', 'goods');
    $document = draft(DocumentType::Invoice, [itemRow('Maschine', '1', '1000')], ['customer_id' => $customer->id]);

    expect(app(DocumentInspector::class)->totals($document, app(DocumentInspector::class)->sources($document))->toArray()['tax_breakdown'][0]['category'])->toBe('G');
});
```

(`DocumentInspector::sources(Document): array` und `totals(Document, ?array $sources): Totals` – dieselben Methoden wie in `RenderPreview`.)

`tests/Feature/EInvoice/EInvoiceSamplesTest.php` in `eInvoiceCases()`:
- im Fall `'third_country'` dem Kunden `'supply_type' => 'goods'` mitgeben (Waren → `G`, wie bisher),
- neuen Fall ergänzen:

```php
        'third_country_services' => function () {
            Organization::current()->forceFill(['registration_id' => 'HRB 000000'])->save();

            return finalizedInvoice([itemRow('Workshop', '10', '95')], [], ['name' => 'Bergbahn Demo AG', 'street' => 'Talweg 3', 'zip' => '3920', 'city' => 'Zermatt', 'country' => 'CH', 'vat_id' => 'CHE123456789', 'tax_treatment' => TaxTreatment::ThirdCountry, 'supply_type' => 'services']);
        },
```

und einen gezielten Test ergänzen:

```php
it('leaves out the VAT IDs for services to third-country customers (BR-O-02)', function () {
    $xml = archivedXml(eInvoiceCases()['third_country_services']());

    expect($xml)->toContain('<ram:CategoryCode>O</ram:CategoryCode>')
        ->and($xml)->not->toContain('schemeID="VA"')
        ->and($xml)->toContain('HRB 000000');
});
```

`tests/Feature/Api/CustomerApiTest.php`: im Test, der einen Kunden liest, `->assertJsonPath('supply_type', 'services')` ergänzen.

`resources/js/api/types.ts`: `export type SupplyType = 'goods' | 'services';` und in `Customer` nach `tax_treatment` `supply_type: SupplyType;`. `resources/js/lib/customers.ts`: in `emptyCustomer()` `supply_type: 'services'`, in `draftOf()` `supply_type: customer.supply_type`, in `inputOf()` `supply_type: draft.supply_type`; `customers.test.ts` (Erwartungen an `inputOf`/`draftOf`) um das Feld ergänzen.

`resources/js/pages/customers/show.tsx` – in der Karte „Besteuerung“ nach dem Radiogroup-`div`:

```tsx
                            {draft.tax_treatment === 'third_country' && (
                                <Select
                                    label={t('customer.supply_type')}
                                    hint={t('customer.supply_type_hint')}
                                    wrapClassName="mt-4 max-w-sm"
                                    value={draft.supply_type}
                                    error={errors.supply_type}
                                    onChange={(e) => set({ supply_type: e.target.value as SupplyType })}
                                >
                                    <option value="services">{t('customer.supply_type.services')}</option>
                                    <option value="goods">{t('customer.supply_type.goods')}</option>
                                </Select>
                            )}
```

(`Select` aus `@/components/ui` und `SupplyType` aus `@/api/types` importieren; `errors` ist der vorhandene State mit den Feldfehlern der Seite.)

Run: `ddev artisan migrate && ddev artisan test --filter='SupplyTypeTest|EInvoiceSamplesTest|CustomerApiTest|CustomerActionsTest|FinalizeDocumentTest|ContextBuilderTest|GoldenTest' && ddev exec pnpm typecheck && ddev exec pnpm test`
Expected: PASS.

- [ ] **Step 5: Schematron gegen alle E-Rechnungsfälle**

```bash
ddev exec 'EINVOICE_SAMPLES_DIR=/var/www/html/storage/app/private/einvoice-samples php artisan test --filter=EInvoiceSamplesTest'
ddev mutagen sync
scripts/validate-einvoice.sh storage/app/private/einvoice-samples
```

Expected: alle Fälle ohne `fatal`-Asserts, insbesondere `third_country_services.xml` (BR-O-*) und `third_country.xml` (BR-G-*). Meldet das Schematron für `O` noch die Steuernummer (`FC`, BT-32), auch diese Registrierung bei `O` weglassen, den Test um `->not->toContain('schemeID="FC"')` ergänzen und erneut prüfen. Das Skript kennt die Fälle nicht einzeln (es prüft jede XML im Ordner) – „bekommt den Fall dazu“ heißt: der neue Fall in `EInvoiceSamplesTest` landet automatisch im CI-Job `einvoice`.

- [ ] **Step 6: Commit**

```bash
ddev exec vendor/bin/pint && ddev exec vendor/bin/phpstan analyse --memory-limit=1G
git add app database resources/js lang tests
git commit -m "feat: supply type per customer and tax category O for services to third-country customers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 15: Playwright – Erfolgskriterium „eigenes Feld bis in Vorschau und PDF“ und die neuen Seiten

**Files:**
- Modify: `e2e/package.json`, `e2e/pnpm-lock.yaml` (über pnpm, auf dem Mac)
- Create: `e2e/tests/custom-field-flow.spec.ts`, `e2e/tests/templates.spec.ts`, `e2e/tests/settings.spec.ts`, `e2e/tests/users.spec.ts`
- Modify: `e2e/tests/helpers.ts`

**Interfaces:**
- Consumes: alle UI-Texte der Tasks 1–14 (englische Oberfläche), `apiGet`/`apiPost`/`apiPatch` (`e2e/tests/helpers.ts`), `settle()` (`e2e/tests/editor-helpers.ts`), Demo-Daten (`DemoSeeder`, Kunde „Hafenkontor Lindqvist GmbH“).
- Produces: `apiDelete(page, url)` in `helpers.ts`; vier Specs. Abnahme der Phase = `custom-field-flow.spec.ts` grün.

- [ ] **Step 1: `unpdf` installieren und Helfer ergänzen**

```bash
pnpm --dir e2e add -D unpdf
```

Expected: `e2e/package.json` → `devDependencies.unpdf` (aktuelle Version, z. B. `^1.x`); `unpdf` bündelt pdf.js ohne native Abhängigkeiten. `pnpm --dir e2e exec node -e "import('unpdf').then(m => console.log(typeof m.extractText))"` → `function`.

In `e2e/tests/helpers.ts` ergänzen:

```ts
/** DELETE with the page's session (cleanup after a test). */
export async function apiDelete(page: Page, url: string): Promise<void> {
    const xsrf = (await page.context().cookies()).find((cookie) => cookie.name === 'XSRF-TOKEN')?.value ?? '';
    const response = await page.request.delete(url, { headers: { Accept: 'application/json', Referer: page.url(), 'X-XSRF-TOKEN': decodeURIComponent(xsrf) } });
    expect(response.ok(), await response.text()).toBe(true);
}

/** Text of a PDF (unpdf/pdf.js): drafts come rendered live, finalized documents from the archive. */
export async function pdfText(page: Page, url: string): Promise<string> {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const response = await page.request.get(url, { headers: { Referer: page.url() } });
    expect(response.headers()['content-type']).toContain('application/pdf');
    const pdf = await getDocumentProxy(new Uint8Array(await response.body()));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
}
```

- [ ] **Step 2: Abnahmetest schreiben**

`e2e/tests/custom-field-flow.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { settle } from './editor-helpers';
import { apiGet, apiPatch, apiPost, pdfText } from './helpers';

/**
 * Success criterion of the spec: custom field → filled in a document → used in a template → visible in the preview
 * and in the PDF. Runs against the demo data; the field gets a unique label so reruns without reseeding work.
 */
test('custom field from definition to preview and PDF', async ({ page }) => {
    test.setTimeout(120_000);
    const suffix = Date.now().toString(36);
    const label = `Project code ${suffix}`;
    const key = `project_code_${suffix}`;
    const value = `NORDLICHT-${suffix.toUpperCase()}`;

    // 1. define the field (document level, all types)
    await page.goto('/en/fields?scope=document');
    await page.getByRole('button', { name: 'Add field' }).click();
    const drawer = page.getByRole('dialog', { name: 'Add field' });
    await drawer.getByLabel('Label').fill(label);
    await expect(drawer.getByLabel('Key')).toHaveValue(key);
    await drawer.getByRole('button', { name: 'Create field' }).click();
    await expect(page.getByText(`Field “${label}” created`)).toBeVisible();

    // 2. fill it in a new invoice draft
    const [customer] = (await apiGet(page, '/api/customers?q=Hafenkontor')) as { id: string }[];
    const draft = (await apiPost(page, '/api/documents', { type: 'invoice', customer_id: customer.id })) as { id: string };
    await page.goto(`/en/documents/${draft.id}`);
    await page.getByLabel(label).fill(value);
    await settle(page);

    // 3. use it in a copy of Klar through the field bar
    await page.goto('/en/templates');
    const klar = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Klar', exact: true }) });
    await klar.getByRole('button', { name: 'Duplicate' }).click();
    await page.getByRole('button', { name: 'Edit' }).last().click(); // toast action
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Klar \(copy\)/);
    const templateId = page.url().split('/').pop()!;
    await page.getByRole('tab', { name: 'Content' }).click();
    await page.locator('.cm-content').click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.press('Enter');
    await page.getByRole('region', { name: 'Available fields' }).getByRole('button', { name: new RegExp(label) }).click();
    await expect(page.locator('.cm-content')).toContainText(`{{ document.${key} }}`);

    // 4. preview with the draft as sample data
    await page.getByLabel('Sample data').selectOption(`document:${draft.id}`);
    await expect(page.frameLocator('.pp-clip iframe').first().getByText(value)).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('ControlOrMeta+s');
    await expect(page.getByText('Template saved')).toBeVisible();

    try {
        // 5. make the copy the invoice template, then the document preview and the PDF show the value
        await apiPatch(page, '/api/document-types/invoice', { template_id: templateId });
        await page.goto(`/en/documents/${draft.id}`);
        await expect(page.frameLocator('.pp-clip iframe').first().getByText(value)).toBeVisible({ timeout: 15_000 });
        expect(await pdfText(page, `/api/documents/${draft.id}/pdf`)).toContain(value);
    } finally {
        await apiPatch(page, '/api/document-types/invoice', { template_id: null });
    }
});
```

Hinweise: `apiPatch` schickt `application/merge-patch+json` – `PATCH /api/document-types/invoice` nimmt Teilangaben (`UpdateDocumentType` mit `sometimes`). `region` „Available fields“ ist die `<section aria-label>` der Feldleiste (Task 6). Der Entwurf existiert, bevor der Editor öffnet; `useRenderSources` lädt die Quellen beim ersten Mount der Editor-Seite, die Option `document:<id>` ist also da.

- [ ] **Step 3: Weitere Specs**

`e2e/tests/templates.spec.ts`:

```ts
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { apiDelete, apiGet, apiPost } from './helpers';

test('gallery renders previews; built-ins are read-only', async ({ page }) => {
    await page.goto('/en/templates');
    for (const name of ['Klar', 'Kante', 'Leise']) {
        await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    }
    await expect(page.locator('.pp-page').first()).toBeVisible({ timeout: 15_000 });

    await page.getByRole('link', { name: 'View Klar' }).click();
    await expect(page.getByRole('button', { name: 'Duplicate to customize' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
    await expect(page.getByText('Built-in, read-only')).toBeVisible();
});

test('shows template errors with file and line and marks them in the code (review focus)', async ({ page }) => {
    await page.goto('/en/templates');
    const templates = (await apiGet(page, '/api/templates')) as { id: string; slug: string }[];
    const klar = templates.find((t) => t.slug === 'klar')!;
    const copy = (await apiPost(page, `/api/templates/${klar.id}/duplicate`)) as { id: string };

    try {
        await page.goto(`/en/templates/${copy.id}`);
        await page.locator('.cm-content').click();
        await page.keyboard.press('ControlOrMeta+End');
        await page.keyboard.press('Enter');
        await page.keyboard.insertText('{{ document.number | nope }}');

        const errors = page.getByText('Template errors').locator('..');
        await expect(errors).toContainText('template.liquid:', { timeout: 15_000 });
        await expect(page.locator('.cm-lintRange-error')).toHaveCount(1);

        await page.keyboard.press('ControlOrMeta+z');
        await expect(page.locator('.cm-lintRange-error')).toHaveCount(0, { timeout: 15_000 });
        await expect(page.getByText('Template errors')).toHaveCount(0);
    } finally {
        await apiDelete(page, `/api/templates/${copy.id}`);
    }
});

test('imports a template package and deletes it again', async ({ page }) => {
    await page.goto('/en/templates');
    const templates = (await apiGet(page, '/api/templates')) as { id: string; slug: string }[];
    const kante = templates.find((t) => t.slug === 'kante')!;
    const zip = await page.request.get(`/api/templates/${kante.id}/package`, { headers: { Referer: page.url() } });
    const file = path.join(mkdtempSync(path.join(tmpdir(), 'openbill-e2e-')), 'kante.zip');
    writeFileSync(file, await zip.body());

    await page.locator('input[type=file][accept*="zip"]').setInputFiles(file);
    await expect(page.getByText('“Kante” imported')).toBeVisible();
    const imported = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Kante', exact: true }) }).filter({ hasNot: page.getByText('Built-in') });
    await imported.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('“Kante” deleted')).toBeVisible();
});
```

(`apiPost(page, url, body = {})` schickt Session-Cookie, `Referer` und `X-XSRF-TOKEN`; vorher eine Seite der App öffnen, damit `page.url()` als Referer taugt.)

`e2e/tests/settings.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { apiGet, apiPatch } from './helpers';

const TINY_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

test('organization: register number, logo and the jump from the compliance panel', async ({ page }) => {
    const before = (await apiGet(page, '/api/organization')) as { registration_id: string };
    await page.goto('/en/settings/organization?focus=org.iban');
    await expect(page.getByLabel('IBAN')).toBeFocused();

    try {
        await page.getByLabel('Register number').fill('HRB 000000 Demo');
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(page.getByText('Organization saved')).toBeVisible();
        await page.reload();
        await expect(page.getByLabel('Register number')).toHaveValue('HRB 000000 Demo');

        await page.locator('input[type=file][accept*="image/png"]').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: TINY_PNG });
        await expect(page.getByText('Logo saved')).toBeVisible();
        await expect(page.getByRole('img', { name: 'Logo' })).toBeVisible();
        await page.getByRole('button', { name: 'Remove' }).click();
        await expect(page.getByRole('img', { name: 'Logo' })).toHaveCount(0);
    } finally {
        await apiPatch(page, '/api/organization', { registration_id: before.registration_id });
    }
});

test('document types: the number preview follows the pattern', async ({ page }) => {
    await page.goto('/en/settings/document-types');
    const pattern = page.getByLabel('Pattern');
    await pattern.fill('RE-{YY}-{000}');
    await expect(page.getByText(/^RE-\d{2}-\d{3}$/)).toBeVisible();
    await pattern.fill('RE-{YY}');
    await expect(page.getByText('The pattern needs a running number, e.g. {0000}.')).toBeVisible();
    await page.getByRole('button', { name: 'Discard' }).click();
});

test('taxes: archive with undo', async ({ page }) => {
    await page.goto('/en/settings/taxes-units');
    const first = page.getByRole('button', { name: /^Archive / }).first();
    const name = ((await first.textContent()) ?? '').replace(/^Archive /, '');
    await first.click();
    await expect(page.getByText(`“${name}” archived`)).toBeVisible();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByText(`“${name}” restored`)).toBeVisible();
});

test('text blocks: create and delete with undo', async ({ page }) => {
    await page.goto('/en/settings/text-blocks');
    await page.getByRole('button', { name: 'Text block', exact: true }).click();
    const drawer = page.getByRole('dialog', { name: 'New text block' });
    await drawer.getByLabel('Name').fill('Thanks Elbinsel');
    await drawer.getByLabel('Text').fill('Thank you, {{ customer.name }}.');
    await drawer.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Text block “Thanks Elbinsel” saved')).toBeVisible();

    await page.getByRole('button', { name: 'Delete Thanks Elbinsel' }).click();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByRole('button', { name: 'Thanks Elbinsel' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete Thanks Elbinsel' }).click();
});
```

(`Archive …`-Knöpfe sind Icon-Knöpfe: Ihr Text ist `sr-only` und zählt für `textContent`.)

`e2e/tests/users.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('invite by link, accept in a fresh browser, remove again', async ({ page, browser }) => {
    const email = `nina.${Date.now().toString(36)}@example.com`;
    await page.goto('/en/settings/users');
    await page.getByRole('button', { name: 'Invite' }).click();
    const dialog = page.getByRole('dialog', { name: 'Invite user' });
    await dialog.getByLabel('Email').fill(email);
    await dialog.getByRole('button', { name: 'Create invitation link' }).click();
    const link = await page.getByRole('dialog', { name: 'Invitation created' }).getByLabel('Invitation link').inputValue();
    expect(link).toContain('/en/invitations/');
    await page.getByRole('dialog', { name: 'Invitation created' }).getByRole('button', { name: 'Close' }).first().click();

    const guest = await browser.newContext({ storageState: { cookies: [], origins: [] }, ignoreHTTPSErrors: true });
    const invited = await guest.newPage();
    await invited.goto(link);
    await expect(invited.getByLabel('Email')).toHaveValue(email);
    await invited.getByLabel('Your name').fill('Nina Nordlicht');
    await invited.getByLabel('Password', { exact: true }).fill('long-enough-password');
    await invited.getByLabel('Repeat password').fill('long-enough-password');
    await invited.getByRole('button', { name: 'Create account' }).click();
    await expect(invited).toHaveURL(/\/en$/);
    await guest.close();

    await page.reload();
    await expect(page.getByText(email)).toBeVisible();
    await page.getByRole('button', { name: 'Remove Nina Nordlicht' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByText('Nina Nordlicht removed')).toBeVisible();
});
```

(`browser.newContext()` erbt die `use`-Optionen aus `e2e/playwright.config.ts` nicht – deshalb `ignoreHTTPSErrors: true` ausdrücklich (DDEV-Zertifikat); der Link ist absolut, `baseURL` braucht es nicht. `getByLabel('Email')` trifft auf der Einladungsseite das schreibgeschützte Feld.)

- [ ] **Step 4: Suite laufen lassen**

```bash
ddev exec pnpm build
pnpm --dir e2e test
```

Expected: alle Specs grün, darunter `custom-field-flow.spec.ts` (Abnahme). Bei 429 auf `/login` eine Minute warten (Throttle, siehe CLAUDE.md). Bei Fehlschlägen den Trace öffnen: `pnpm --dir e2e exec playwright show-trace e2e/test-results/<…>/trace.zip`.

- [ ] **Step 5: Commit**

```bash
git add e2e/package.json e2e/pnpm-lock.yaml e2e/tests
git commit -m "test(e2e): custom field to preview and PDF, templates, settings and users" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 16: Doku (en + de) und CLAUDE.md

**Files:**
- Create: `docs/en/custom-fields.md`, `docs/de/custom-fields.md`, `docs/en/settings.md`, `docs/de/settings.md`
- Modify: `docs/en/templates.md`, `docs/de/templates.md`, `docs/en/api.md`, `docs/de/api.md`, `docs/en/documents.md`, `docs/de/documents.md`, `docs/en/e-invoice.md`, `docs/de/e-invoice.md`, `docs/.vitepress/config.ts`
- Modify: `CLAUDE.md`
- Test: `tests/Unit/DocsTest.php` (bestehend)

**Interfaces:**
- Consumes: Verhalten aus Task 1–15.
- Produces: Seiten `custom-fields`, `settings` in der Seitenleiste; Phase 8 liest `docs/en/templates.md` als MCP-Resource (Struktur der Überschriften „Liquid reference“ bleibt unverändert).

- [ ] **Step 1: Seitenleiste**

`docs/.vitepress/config.ts`: `const pages = ['documents', 'custom-fields', 'templates', 'e-invoice', 'settings', 'api', 'development'];`, in `en` `'custom-fields': 'Custom fields', settings: 'Settings',`, in `de` `'custom-fields': 'Eigene Felder', settings: 'Einstellungen',`.

Run: `ddev artisan test --filter=DocsTest`
Expected: FAIL (Seiten fehlen) – Schritt 2 behebt das.

- [ ] **Step 2: `custom-fields` (neu)**

`docs/en/custom-fields.md`:

````md
# Custom fields

Custom fields add your own data to the organization, customers, contacts, documents and positions – a project code on invoices, the supplier number a customer knows you by, a ticket per position. They appear in the forms of the app, are checked by the API and MCP, and every template can print them.

## Levels

| Level | Where it appears | In templates |
|---|---|---|
| Organization | Settings → Organization | `org.<key>` |
| Customer | customer page | `customer.<key>` |
| Contact | contact drawer of a customer | `contact.<key>` |
| Document | head of the document editor | `document.<key>` |
| Position | every position row | `p.<key>` inside `{% for p in g.positions %}` |

Document and position fields apply to chosen document types (quote, order confirmation, invoice, cancellation). On the custom fields page the four short buttons in each row switch a type on or off; a field always keeps at least one type. When a document is converted, a value only moves along if the field also applies to the target type.

## Types

Text, long text, number, amount, date, selection (with options), yes/no and image. Numbers and amounts are stored as strings with a dot (`"12.5"`), dates as `YYYY-MM-DD`.

**Image fields** take an upload (PNG, JPEG, GIF, WebP or SVG, at most 1 MB). The value is the path of the stored file (`uploads/<id>.png`); in templates the field is a data URL that works in header, body and footer:

::: v-pre
```liquid
{% if document.stamp != blank %}<img src="{{ document.stamp }}" alt="">{% endif %}
```
:::

Uploaded files are kept even when the value changes, because finalized documents still refer to them.

## Adding and editing

**Custom fields → Add field** opens a drawer with a live preview of the input. The **key** is built from the label (`Project code` → `project_code`) and can be changed until the field is created; afterwards it is fixed so that templates and stored values stay valid. Core keys of a level (`number`, `date`, `name`, …) are reserved. **Required** fields must be filled before a document can be finalized. A **default value** is pre-filled in new entries.

The arrows change the order (it is the order of the forms). **Delete** removes the field after the undo notice has gone; stored values stay in the data and finalized documents keep the field in their snapshot.

## Built-in fields

Each level has core fields (always available, listed under “Built-in fields”) and, for the e-invoice profile, required details such as a complete address, VAT ID or tax number, IBAN, service date and unit codes. They cannot be removed because totals, numbers and the e-invoice depend on them.

## Templates

The template editor lists every field per level in its field bar; a click inserts an expression with the fitting filter (`| money`, `| date`, `| nl2br`, `| number: 2`). A template can declare the fields it expects in `manifest.json` (`expectedFields`); the editor warns when one of them does not exist yet.

## API

`GET/POST /api/field-definitions`, `GET/PATCH/DELETE /api/field-definitions/{id}`, `POST /api/field-definitions/reorder` (`{"scope": "document", "ids": [...]}` with every field of the level), `POST /api/uploads` (multipart `file`, answer `{"path": "uploads/…"}` = the value of an image field). Values travel in `custom` of the object: `{"custom": {"project_code": "NORDLICHT-7"}}`. Wrong types, unknown options, missing required fields and fields that do not apply to the document type answer 422 with the field path.
````

`docs/de/custom-fields.md`:

````md
# Eigene Felder

Eigene Felder ergänzen Organisation, Kunden, Ansprechpartner, Dokumente und Positionen um deine Angaben – einen Projektcode auf Rechnungen, die Lieferantennummer, unter der dich ein Kunde führt, ein Ticket pro Position. Sie erscheinen in den Formularen der App, werden von API und MCP geprüft und stehen in jedem Template bereit.

## Ebenen

| Ebene | Wo sie erscheint | Im Template |
|---|---|---|
| Organisation | Einstellungen → Organisation | `org.<schlüssel>` |
| Kunde | Kundenseite | `customer.<schlüssel>` |
| Ansprechpartner | Drawer des Ansprechpartners | `contact.<schlüssel>` |
| Dokument | Kopf des Dokument-Editors | `document.<schlüssel>` |
| Position | jede Positionszeile | `p.<schlüssel>` in `{% for p in g.positions %}` |

Dokument- und Positionsfelder gelten für ausgewählte Dokumenttypen (Angebot, Auftragsbestätigung, Rechnung, Storno). Auf der Seite „Eigene Felder“ schalten die vier kurzen Knöpfe in jeder Zeile einen Typ an oder aus; ein Feld behält immer mindestens einen Typ. Beim Umwandeln wandert ein Wert nur mit, wenn das Feld auch für den Zieltyp gilt.

## Typen

Text, langer Text, Zahl, Betrag, Datum, Auswahl (mit Optionen), Ja/Nein und Bild. Zahlen und Beträge werden als String mit Punkt gespeichert (`"12.5"`), Daten als `YYYY-MM-DD`.

**Bildfelder** nehmen einen Upload (PNG, JPEG, GIF, WebP oder SVG, höchstens 1 MB). Der Wert ist der Pfad der gespeicherten Datei (`uploads/<id>.png`); im Template ist das Feld eine Data-URL, die in Kopfzeile, Inhalt und Fußzeile funktioniert:

::: v-pre
```liquid
{% if document.stamp != blank %}<img src="{{ document.stamp }}" alt="">{% endif %}
```
:::

Hochgeladene Dateien bleiben erhalten, auch wenn sich der Wert ändert, weil abgeschlossene Dokumente noch auf sie verweisen.

## Anlegen und bearbeiten

**Eigene Felder → Feld hinzufügen** öffnet einen Drawer mit Live-Vorschau des Eingabefelds. Der **Schlüssel** entsteht aus der Bezeichnung (`Projektcode` → `projektcode`) und lässt sich bis zum Anlegen ändern; danach ist er fest, damit Templates und gespeicherte Werte gültig bleiben. Kernschlüssel einer Ebene (`number`, `date`, `name`, …) sind reserviert. **Pflichtfelder** müssen vor dem Abschließen ausgefüllt sein. Ein **Standardwert** wird bei neuen Einträgen vorausgefüllt.

Die Pfeile ändern die Reihenfolge (so stehen die Felder in den Formularen). **Löschen** entfernt das Feld, sobald der Hinweis mit „Rückgängig“ verschwunden ist; gespeicherte Werte bleiben in den Daten, abgeschlossene Dokumente behalten das Feld in ihrem Snapshot.

## Eingebaute Felder

Jede Ebene hat Kernfelder (immer vorhanden, unter „Eingebaute Felder“) und für das E-Rechnungs-Profil Pflichtangaben wie vollständige Adresse, USt-ID oder Steuernummer, IBAN, Leistungsdatum und Einheiten-Codes. Sie lassen sich nicht entfernen, weil Summen, Nummern und die E-Rechnung sie brauchen.

## Templates

Der Template-Editor zeigt alle Felder je Ebene in seiner Feldleiste; ein Klick fügt einen Ausdruck mit passendem Filter ein (`| money`, `| date`, `| nl2br`, `| number: 2`). Ein Template kann die erwarteten Felder in `manifest.json` angeben (`expectedFields`); der Editor warnt, wenn eines davon noch fehlt.

## API

`GET/POST /api/field-definitions`, `GET/PATCH/DELETE /api/field-definitions/{id}`, `POST /api/field-definitions/reorder` (`{"scope": "document", "ids": [...]}` mit allen Feldern der Ebene), `POST /api/uploads` (multipart `file`, Antwort `{"path": "uploads/…"}` = Wert eines Bildfelds). Werte stehen in `custom` des Objekts: `{"custom": {"projektcode": "NORDLICHT-7"}}`. Falscher Typ, unbekannte Option, fehlendes Pflichtfeld oder ein Feld, das für den Dokumenttyp nicht gilt, beantwortet die API mit 422 und dem Feldpfad.
````

- [ ] **Step 3: `settings` (neu)**

`docs/en/settings.md`:

````md
# Settings

**Settings** holds your company, the document types and the master data. Everything here is also available through the REST API (except users).

## Organization

Name, address, logo (PNG, JPEG, GIF, WebP or SVG, at most 1 MB – without a logo templates show the name), taxation (standard or small business under § 19 UStG), VAT ID, tax number, **register number** (`registration_id`, e.g. the commercial register entry), bank and contact details, the default document language and the custom fields of the organization. Missing details of the e-invoice profile show up in the check panel of the document editor; a click there opens this page at the right field.

The e-invoice profile needs the VAT ID or the register number; with reverse charge and exports of goods the VAT ID, with services to customers outside the EU the register number (the VAT IDs must not appear in that e-invoice).

## Document types

Per type: the **compliance profile** (basic, or EN 16931 e-invoice for invoices and cancellations), the **number range** and the **defaults** for new documents (template, payment term, validity, intro and closing text).

Number patterns use `{YYYY}`, `{YY}`, `{MM}` and a running number `{0000}` (as many digits as zeros). With “Start at 1 again every year” the pattern must contain the year. The preview next to the pattern comes from the server and shows the next number exactly as finalizing would assign it. “Next running number” continues an existing range; numbers already used are skipped.

## Taxes & units

Tax rates carry an EN 16931 category (`S` standard, `Z` zero rate, `E` exempt, `AE` reverse charge, `K` intra-community supply, `G` export, `O` not subject to VAT) and, at 0 %, a legal note. Units carry a UN/ECE Recommendation 20 code (e.g. `HUR` hour, `DAY` day, `H87` piece); without a code no e-invoice can be finalized.

Deleting a rate or unit **archives** it: it disappears from the pickers, existing documents keep it. “Undo” in the notice or “Restore” in the archived list brings it back.

## Text blocks

::: v-pre
Reusable intro, closing, payment and note texts. They may contain Liquid placeholders like `{{ customer.name }}` or `{{ document.due_date | date }}`, filled in when the document is rendered. A text block can be the default for a document type.
:::

## Users

All users work in the same organization. **Owners** invite users, change roles and remove users; **members** can do everything else (documents, customers, templates, fields, settings). At least one owner always stays, and nobody can remove themselves.

openbill sends no email: **Invite** creates a link to pass on. The link is valid for 7 days and works once; it opens a page where the invited person sets their name and password and is signed in. Open invitations can be copied again or revoked. Removing a user deletes the account, its API tokens and its sessions; documents stay.

User management is only available in the app (not through API tokens or MCP).
````

`docs/de/settings.md`:

````md
# Einstellungen

Unter **Einstellungen** stehen deine Firma, die Dokumenttypen und die Stammdaten. Alles davon geht auch über die REST-API (außer Benutzer).

## Organisation

Name, Adresse, Logo (PNG, JPEG, GIF, WebP oder SVG, höchstens 1 MB – ohne Logo zeigen die Templates den Namen), Besteuerung (Regelbesteuerung oder Kleinunternehmer nach § 19 UStG), USt-ID, Steuernummer, **Registernummer** (`registration_id`, z. B. der Handelsregistereintrag), Bank- und Kontaktdaten, die Standard-Dokumentsprache und die eigenen Felder der Organisation. Fehlende Angaben des E-Rechnungs-Profils erscheinen in der Prüfanzeige des Dokument-Editors; ein Klick dort öffnet diese Seite am richtigen Feld.

Das E-Rechnungs-Profil braucht die USt-ID oder die Registernummer; bei Reverse Charge und Ausfuhr von Waren die USt-ID, bei Dienstleistungen an Kunden außerhalb der EU die Registernummer (die USt-IDs dürfen in dieser E-Rechnung nicht stehen).

## Dokumenttypen

Je Typ: das **Prüfprofil** (Basis oder E-Rechnung EN 16931 für Rechnungen und Stornos), der **Nummernkreis** und die **Vorgaben** für neue Dokumente (Template, Zahlungsziel, Gültigkeit, Einleitung und Schlusstext).

Muster nutzen `{YYYY}`, `{YY}`, `{MM}` und eine laufende Nummer `{0000}` (so viele Stellen wie Nullen). Mit „Jedes Jahr wieder bei 1 anfangen“ muss das Muster das Jahr enthalten. Die Vorschau neben dem Muster kommt vom Server und zeigt die nächste Nummer genau so, wie sie beim Abschließen vergeben würde. „Nächste laufende Nummer“ setzt einen bestehenden Nummernkreis fort; schon vergebene Nummern werden übersprungen.

## Steuern & Einheiten

Steuersätze tragen eine EN-16931-Kategorie (`S` Normalsatz, `Z` Nullsatz, `E` steuerbefreit, `AE` Reverse Charge, `K` innergemeinschaftliche Lieferung, `G` Ausfuhr, `O` nicht steuerbar) und bei 0 % einen gesetzlichen Hinweis. Einheiten tragen einen Code nach UN/ECE Recommendation 20 (z. B. `HUR` Stunde, `DAY` Tag, `H87` Stück); ohne Code lässt sich keine E-Rechnung abschließen.

Löschen **archiviert** einen Satz oder eine Einheit: Er verschwindet aus der Auswahl, bestehende Dokumente behalten ihn. „Rückgängig“ im Hinweis oder „Wiederherstellen“ in der Liste der archivierten holt ihn zurück.

## Textbausteine

::: v-pre
Wiederverwendbare Texte für Einleitung, Schluss, Zahlungsbedingungen und Hinweise. Sie dürfen Liquid-Platzhalter wie `{{ customer.name }}` oder `{{ document.due_date | date }}` enthalten, die beim Rendern ausgefüllt werden. Ein Textbaustein kann Vorgabe eines Dokumenttyps sein.
:::

## Benutzer

Alle Benutzer arbeiten in derselben Organisation. **Inhaber** laden ein, ändern Rollen und entfernen Benutzer; **Mitglieder** dürfen alles andere (Dokumente, Kunden, Templates, Felder, Einstellungen). Mindestens ein Inhaber bleibt immer, und niemand kann sich selbst entfernen.

openbill verschickt keine E-Mails: **Einladen** erzeugt einen Link zum Weitergeben. Er gilt 7 Tage und funktioniert einmal; er öffnet eine Seite, auf der die eingeladene Person Namen und Passwort festlegt und angemeldet wird. Offene Einladungen lassen sich erneut kopieren oder zurückziehen. Beim Entfernen werden Konto, API-Tokens und Sitzungen gelöscht; Dokumente bleiben.

Die Benutzerverwaltung gibt es nur in der App (nicht über API-Tokens oder MCP).
````

VitePress wertet `{{ … }}` auch in Inline-Code als Vue aus (nur Code-Blöcke sind automatisch `v-pre`): Deshalb stehen die Absätze mit Platzhaltern in `::: v-pre` (CLAUDE.md, Doku).

- [ ] **Step 4: Bestehende Seiten ergänzen**

`docs/en/templates.md`:
1. Im Abschnitt „Built-in templates“ den Satz „To change one, export it and import the package as your own template.“ ersetzen durch „To change one, duplicate it (Templates → Duplicate) and edit the copy.“
2. Neuen Abschnitt vor „## Template package“:

````md
## Template editor

**Templates** shows every template with a preview of its first page (rendered on the server with sample data). **Import ZIP** adds a template package, **Duplicate** creates an editable copy (“Klar (copy)”), **Delete** removes your own templates (not while documents still use them).

The editor has five tabs – header, content, footer, CSS and manifest – with syntax highlighting; the manifest tab also has a form for the paper (format, header and footer height, side margins). On the left, the field bar lists the core and custom fields of every level; a click inserts the expression at the cursor. On the right, the preview renders the unsaved state on the server 250 ms after the last change and highlights the area of the current tab. **Sample data** switches between the sample scenarios and real documents (also drafts). Errors appear above the preview with file and line and are underlined in the code; a click jumps there. **Save** (⌘S / Ctrl+S) writes the parts, **Export** downloads the saved state as package. Built-in templates open read-only. Assets (fonts, images) are not edited here: import them with the package or upload them with `PUT /api/templates/{id}/files`.
````

3. Im Abschnitt „Limits and errors“ einen Punkt anfügen:

```md
- `file:` URLs: Gotenberg may read local files, but the content security policy at the top of every rendered document blocks everything except `data:` – a template referring to `file:///tmp/…` or other local paths shows nothing. Never use `file:` in templates; use assets.
```

`docs/de/templates.md` entsprechend:
1. „Zum Anpassen duplizierst du es (Templates → Duplizieren) und bearbeitest die Kopie.“
2. Abschnitt „## Template-Editor“:

````md
## Template-Editor

**Templates** zeigt jedes Template mit einer Vorschau seiner ersten Seite (auf dem Server mit Beispieldaten gerendert). **ZIP importieren** fügt ein Template-Paket hinzu, **Duplizieren** legt eine bearbeitbare Kopie an („Klar (Kopie)“), **Löschen** entfernt eigene Templates (nicht, solange Dokumente sie benutzen).

Der Editor hat fünf Tabs – Kopfzeile, Inhalt, Fußzeile, CSS und Manifest – mit Syntax-Hervorhebung; im Manifest-Tab gibt es zusätzlich ein Formular für das Papier (Format, Höhe von Kopf- und Fußzeile, Seitenränder). Links listet die Feldleiste Kern- und eigene Felder jeder Ebene; ein Klick fügt den Ausdruck an der Cursorposition ein. Rechts rendert die Vorschau den ungespeicherten Stand 250 ms nach der letzten Änderung auf dem Server und hebt den Bereich des aktuellen Tabs hervor. **Beispieldaten** wechselt zwischen den Beispielszenarien und echten Dokumenten (auch Entwürfen). Fehler stehen über der Vorschau mit Datei und Zeile und sind im Code unterwellt; ein Klick springt hin. **Speichern** (⌘S / Strg+S) schreibt die Teile, **Exportieren** lädt den gespeicherten Stand als Paket. Mitgelieferte Templates öffnen schreibgeschützt. Assets (Schriften, Bilder) bearbeitet der Editor nicht: Sie kommen mit dem Paket oder per `PUT /api/templates/{id}/files`.
````

3. Punkt in „Grenzen und Fehler“: „- `file:`-URLs: Gotenberg dürfte lokale Dateien lesen, aber die Content-Security-Policy am Anfang jedes gerenderten Dokuments sperrt alles außer `data:` – ein Template mit `file:///tmp/…` oder anderen lokalen Pfaden zeigt nichts an. Verwende in Templates nie `file:`, sondern Assets.“ (Abschnitt „## Grenzen und Fehler“.)

`docs/en/api.md` / `docs/de/api.md` – im Abschnitt „Resources“ bzw. „Templates“ ergänzen (englisch, deutsch sinngemäß):

```md
Additional endpoints (phase 7):

| Endpoint | What it does |
|---|---|
| `POST /api/templates/{id}/duplicate` | editable copy of a template (also of a built-in one), 201 |
| `POST /api/field-definitions/reorder` | order of all fields of one level: `{"scope", "ids"}` |
| `POST /api/uploads`, `GET /api/uploads/{name}` | image for an image field (multipart `file`, at most 1 MB); the answer's `path` is the field value |
| `GET`, `POST`, `DELETE /api/organization/logo` | logo of the organization (multipart `logo`) |
| `GET /api/document-types/{type}/number-preview?pattern=…&reset_yearly=1&next_value=…` | next number for a pattern that is not saved yet |
| `POST /api/tax-rates/{id}/restore`, `POST /api/units/{id}/restore` | undo of the archiving `DELETE` |

Customers have `supply_type` (`goods` or `services`, default `services`); for customers outside the EU it decides between tax category `G` and `O` (see e-invoices). User management (`/api/users`, `/api/invitations`) is only open to the session of the app, never to tokens.
```

`docs/en/documents.md` (Abschnitt „Customers“) / `docs/de/documents.md` (Abschnitt „Kunden“): einen Satz ergänzen – en: „For customers outside the EU, **What you supply** decides the tax: services are not taxable in Germany (category `O`), goods are tax-free exports (`G`).“; de: „Bei Kunden außerhalb der EU entscheidet die **Leistungsart** über die Steuer: Dienstleistungen sind im Inland nicht steuerbar (Kategorie `O`), Waren steuerfreie Ausfuhren (`G`).“ Dazu im Abschnitt „In the app“ / „In der App“ je einen Absatz mit Verweis auf die neuen Seiten: „Templates, custom fields and settings have their own pages: see [Templates](/en/templates#template-editor), [Custom fields](/en/custom-fields) and [Settings](/en/settings).“ (de mit `/de/…`-Links).

`docs/en/e-invoice.md` / `docs/de/e-invoice.md` (Abschnitt „Taxes“/„Steuern“): Tabelle bzw. Liste um `O` ergänzen – en: „`O` – not subject to VAT: services to customers outside the EU (customer option ‘What you supply’ = services). The XML then contains neither your VAT ID nor the customer's (BR-O-02); your register number identifies you (BR-CO-26). Goods to customers outside the EU stay exports (`G`) and need your VAT ID.“; de sinngemäß.

- [ ] **Step 5: CLAUDE.md**

Änderungen in `CLAUDE.md`:
1. „Was openbill ist“: Stand → „Phase 7 (UI mit Shell, Übersicht, Dokumenten, Kunden, Dokument-Editor, Templates mit Editor, eigenen Feldern und Einstellungen inkl. Benutzerverwaltung; REST-API unter `/api`; kein MCP)“.
2. Tech Stack, Zeile UI: „CodeMirror 6 (`codemirror`, `@codemirror/*`: Liquid/CSS/JSON, `lint` für Fehlermarkierungen; nur im Template-Editor, `resources/js/components/code-editor.tsx`)“ ergänzen. Tests: „`e2e/` nutzt `unpdf` für PDF-Text“.
3. Überschrift „Architektur (Stand Phase 6)“ → „(Stand Phase 7)“ und neue Punkte:
   - **Routen** ergänzen: `GET /{locale}/templates`, `/templates/{id}` (`TemplateController`), `/fields?scope=` (`FieldController`), `/settings` → `/settings/organization`, `/settings/{section}` (`SettingsController::SECTIONS`, eine Inertia-Seite `settings/show`, Props `section`, `can_manage_users`), Gast: `GET|POST /{locale}/invitations/{invitation}` (`signed:relative`, `InvitationController`).
   - **Template-Editor** (`resources/js/templates`): Zustand mit reinen Funktionen in `editor-state.ts` (`useReducer`, kein Zustand-Store), Tabs = API-Teile `header|body|footer|css|manifest`, Vorschau `use-template-preview.ts` (SWR `POST /api/render` mit `template_id` + allen Teilen, 250 ms, `createLatest` pro Instanz), Fehler → Tabs über `errors.ts`, Diagnosen über `diagnostics.ts`; Speichern `PUT /api/templates/{id}/files` ohne `assets`. **Phase-9-Schnittstelle:** `templates/editor/toolkit-slot.tsx` (`ToolkitSlot`, Phase 7 rendert `null`).
   - **Galerie:** Karten rendern erst, wenn sichtbar (`lib/use-in-view.ts`); `packages/paged-preview` mit `lazy` füllt Seiten nach der ersten erst im Sichtbereich.
   - **Eigene Felder:** Reihenfolge `POST /api/field-definitions/reorder` (`ReorderFieldDefinitions`), Löschen mit verzögertem `DELETE` (`lib/pending-delete.ts`, auch Textbausteine), Bildfelder = `uploads/<ulid>.<ext>` (`StoreUpload`, `ImagePath`), im Template als Data-URL (`ContextBuilder::inlineImages`, `AssetInliner::upload`).
   - **Bilder** (Logo, Bildfelder): `App\Support\StoredImage` (Endung, 1 MB, Inhaltsprüfung wie Template-Assets, Auslieferung mit CSP-Sandbox + `nosniff`). Logo unter `logos/`, Uploads unter `uploads/` auf Disk `local`, nie gelöscht (Snapshots).
   - **Einstellungen:** Organisation (`/api/organization`, Logo `/api/organization/logo`), Dokumenttypen mit Nummernvorschau `GET /api/document-types/{type}/number-preview` (`PreviewDocumentNumber`), Steuern/Einheiten mit `…/restore` (`RestoreTaxRate`/`RestoreUnit`), `org.*`-Prüfpunkte verlinken auf `/settings/organization?focus=<pfad>` (`useFocusFromUrl` → `jumpTo`).
   - **Benutzer:** Rollen `owner` (verwaltet Benutzer/Einladungen) und `member` (alles andere); Actions `InviteUser`, `RevokeInvitation`, `AcceptInvitation`, `ChangeUserRole`, `RemoveUser`, `ListUsers`; `OwnerRequiredException` 403, `last_owner`/`cannot_remove_self` 409; Tabelle `user_invitations`; Link `InvitationLinks::for()` (relativ signiert, ohne Ablauf in der Signatur, Einladung läuft nach 7 Tagen ab); API nur für die Sitzung (`ApiMiddleware::SESSION`, `ApiAccess::SESSION`), nicht im OpenAPI-Dokument.
   - **Leistungsart:** `customers.supply_type` (`SupplyType`, Standard `services`); `EffectiveTax`: Drittland + Dienstleistung → `O`, Ware → `G`; Snapshots ohne `supply_type` gelten als Ware; `CiiBuilder` lässt bei `O` beide USt-IDs weg; Compliance verlangt dann `registration_id`.
4. Fallstricke ergänzen:
   - „Übersetzungsschlüssel ohne Ziffern: `TranslationsTest` findet `t('…')` nur mit `[a-z_]` je Segment. Dynamische Schlüssel (`tax_category.${code}`, `unit_code.${code}`, `scenario.${key}`, `fields.type.${type}` …) prüft der Test nicht – beide JSON-Dateien vollständig halten.“
   - „Einladungslinks sind relativ signiert (Pfad + Query): Ein Sprachwechsel ändert den Pfad und macht die Signatur ungültig – die Einladungsseite hat deshalb keinen Sprachumschalter.“
   - „`CodeEditor` baut die CodeMirror-Instanz nur bei Sprache/Read-only neu; `value` und `errors` laufen über eigene Effekte. `errors` stabil übergeben (`useMemo`).“
   - „CodeMirror schließt Klammern/Tags beim Tippen automatisch: In Playwright Code mit `page.keyboard.insertText()` einfügen, nicht mit `type()`.“
   - „Hochgeladene Bilder und alte Logos werden nie gelöscht (Snapshots verweisen darauf); Aufräumen ungenutzter Dateien ist offen (Phase 11).“

- [ ] **Step 6: Prüfen**

Run: `ddev artisan test --filter='DocsTest|TranslationsTest' && ddev exec pnpm --dir docs build`
Expected: PASS; VitePress baut ohne Fehler (tote Links meldet der Build als Fehler – Anker `#template-editor` in beiden Sprachen prüfen; deutsch heißt der Anker `#template-editor`, weil die Überschrift gleich ist).

- [ ] **Step 7: Commit**

```bash
git add docs/en docs/de docs/.vitepress/config.ts CLAUDE.md
git commit -m "docs: custom fields, settings and the template editor (en, de), CLAUDE.md for phase 7" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 17: Screenshots gegen den Klickdummy, Gesamtprüfung, Push, PR, CI

**Files:**
- Modify: `e2e/tests/screenshots.spec.ts`

**Interfaces:**
- Consumes: alles aus Task 1–16.
- Produces: PR gegen `main` mit grüner CI (nicht gemergt).

- [ ] **Step 1: Neue Seiten in die Screenshot-Liste**

In `e2e/tests/screenshots.spec.ts` dem Array `SHOTS` anfügen (der Klickdummy hat dieselben Pfade, außer `doc-types` statt `document-types`):

```ts
    { name: 'templates', open: (page, prefix) => go(page, prefix, '/templates') },
    {
        name: 'template-editor',
        open: async (page, prefix) => {
            await go(page, prefix, '/templates');
            await page.locator('a[href*="/templates/"]').first().click();
            await page.waitForURL(/\/templates\/[^/?]+$/);
            await page.locator('.cm-editor').first().waitFor();
            await page.locator('.pp-page').first().waitFor();
        },
    },
    { name: 'fields', open: (page, prefix) => go(page, prefix, '/fields') },
    { name: 'settings-organization', open: (page, prefix) => go(page, prefix, '/settings/organization') },
    { name: 'settings-document-types', open: (page, prefix) => go(page, prefix, prefix ? '/settings/document-types' : '/settings/doc-types') },
    { name: 'settings-taxes-units', open: (page, prefix) => go(page, prefix, '/settings/taxes-units') },
    { name: 'settings-text-blocks', open: (page, prefix) => go(page, prefix, '/settings/text-blocks') },
    { name: 'settings-users', open: (page, prefix) => go(page, prefix, '/settings/users') },
```

Routen des Klickdummys (geprüft in `prototypes/clickdummy-v2/src/App.tsx` und `src/routes/settings/SettingsPage.tsx`): `/templates`, `/templates/:id` (Karten-Link mit echtem `href`), `/fields`, `/settings/organization|doc-types|taxes-units|text-blocks|users`.

- [ ] **Step 2: Screenshots erzeugen und vergleichen**

```bash
ddev exec 'pnpm --filter openbill-clickdummy-v2 build'
ddev mutagen sync
pnpm dlx serve -s prototypes/clickdummy-v2/dist -l 4173   # im Hintergrund laufen lassen
CLICKDUMMY_URL=http://localhost:4173 pnpm --dir e2e screenshots
ls e2e/screenshots/app | wc -l; ls e2e/screenshots/clickdummy | wc -l
git status --short
```

Expected: `8 passed`; je Verzeichnis 64 PNGs (16 Seiten × 2 Breiten × 2 Themes); `git status` ohne `dist/` und ohne Screenshots. Danach den `serve`-Prozess beenden.

Die neuen Bilder paarweise ansehen (Read-Tool auf die PNGs, je Seite 1440/390 hell/dunkel) und Abweichungen beheben, bevor es weitergeht:
- Galerie: Kartenraster `auto-fill` ab 17rem, Vorschau oben auf `surface-2`, Paket-Erklärung zweispaltig ab `md`, auf 390 einspaltig.
- Template-Editor 1440: drei Spalten (Feldleiste 15rem, Code, Vorschau), volle Höhe; 390: gestapelt, keine horizontale Scrollleiste; dunkel: CodeMirror in `surface`, Papier weiß.
- Eigene Felder: Tabs mit Zählern, Zeilen mit Dokumenttyp-Schaltern (390: Schalter in zweiter Zeile), „Eingebaute Felder“ eingeklappt.
- Einstellungen: Abschnittsnavigation links 13rem (390: oben horizontal scrollbar), Karten in `bg`, Speichern-Leiste erst bei Änderungen.
Bewusste Unterschiede (keine Behebung): Kernfelder in Feldleiste und „Eingebaute Felder“ als Liquid-Pfad statt Bezeichnung; Einladung mit kopierbarem Link statt „E-Mail gesendet“; Galerie-Vorschau mit Beispieldaten statt erster Rechnung; Felder-Undo über verzögertes Löschen (identisch im Ergebnis).

- [ ] **Step 3: Gesamtprüfung**

```bash
ddev exec vendor/bin/pint --test
ddev exec vendor/bin/phpstan analyse --memory-limit=1G
ddev artisan test
ddev artisan test --testsuite=Integration
ddev exec pnpm typecheck
ddev exec pnpm test
ddev exec 'pnpm --filter "./packages/*" run typecheck'
ddev exec 'pnpm --filter "./packages/*" run test'
ddev exec pnpm build
ddev exec 'pnpm --filter "./prototypes/*" test'
ddev exec pnpm --dir docs build
pnpm --dir e2e test
```

Expected: alles grün (Pint ohne Änderungen, Larastan `[OK] No errors`, Pest alle Suiten, Vitest App und Paket, Build, Prototypen, Doku, Playwright alle Specs inkl. `custom-field-flow.spec.ts`).

Abnahme gegenprüfen – kein Rendern/Rechnen im Browser:

Run: `grep -rnE "liquid|parseFloat|toFixed\(|NumberFormatter" resources/js/templates resources/js/settings resources/js/fields | grep -v "\.test\.\|lang-liquid\|language" `
Expected: keine Treffer außer Sprachangaben (`'liquid'` als CodeMirror-Sprache, Texte). Ein Treffer, der rendert oder rechnet, wird entfernt.

- [ ] **Step 4: Push und PR**

Run: `git status --short && git log --oneline main..HEAD`
Expected: sauberer Arbeitsbaum; Plan-Commit + Commits der Tasks 1–17.

Run: `git push -u origin phase-07-settings`

```bash
gh pr create --base main --head phase-07-settings --title "feat: phase 7 templates, custom fields and settings" --body "$(cat <<'EOF'
## Summary
- Navigation: Templates, Custom fields and Settings
- Template gallery with lazy server-rendered previews (IntersectionObserver, `paged-preview` `lazy`), ZIP import, duplicate (`POST /api/templates/{id}/duplicate`) and delete
- Template editor: CodeMirror 6 tabs for header, content, footer, CSS and manifest plus a paper form, field bar, live preview via SWR `POST /api/render` with zone highlight, sample data (scenarios and real documents), errors with file and line marked in the code, save via `PUT /files`, export, read-only built-ins; `ToolkitSlot` reserved for phase 9
- Custom fields on all levels: doc type toggles per row, drawer with live preview, locked core and profile fields, undo (delayed delete), order endpoint, image uploads (`POST /api/uploads`) rendered as data URLs
- Settings: organization (logo upload, taxation, `registration_id`), document types (profile, number range with server-side preview, defaults), taxes & units (archive/restore), text blocks, users (invitation by signed copyable link, roles, last owner protected); compliance issues of the organization link to the settings
- Customer option "supply type" and tax category `O` for services to third-country customers (BR-O-02 in the CII XML)
- Docs `custom-fields`, `settings` (new), `templates` (UI editor), `api`, `documents`, `e-invoice` in en/de; CLAUDE.md

## Test plan
- [x] Pest: pages, duplicate template, uploads, reorder, image fields in context, logo, number preview, restore, user management and invitation page, supply type, rights matrix, OpenAPI, full suite
- [x] Vitest: editor state, diagnostics, render errors, expressions, field form helpers, keys, `apiUpload`, `formatPercent`; `paged-preview` lazy
- [x] Schematron for all e-invoice cases incl. `third_country_services`
- [x] Playwright against DDEV: custom field → document → template → preview and PDF; templates, settings, users
- [x] Screenshots 1440/390 light/dark compared with the clickdummy

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: `gh` gibt die PR-URL aus.

- [ ] **Step 5: CI abwarten (nicht mergen)**

Run: `gh pr checks --watch`
Expected: `tests` (Pflicht) grün, ebenso die übrigen Jobs (`einvoice` ist kein Pflicht-Check, sollte mit dem neuen Fall aber grün sein). Schlägt etwas fehl: Log mit `gh run view --log-failed` lesen, beheben, committen (Co-Authored-By-Zeile), pushen, erneut `gh pr checks --watch`. **Nicht mergen** – das macht der Orchestrator nach dem Review.

---

## Abdeckung (Self-Review gegen Master-Plan Phase 7 und Spec)

| Anforderung | Task |
|---|---|
| Navigation Templates / Eigene Felder / Einstellungen | 1 |
| Galerie mit Mini-Vorschau über `/api/render` (IntersectionObserver), ZIP-Import, Duplizieren, Löschen | 2, 3 |
| Editor: CodeMirror 6 für fünf Teile + Papier-Formular | 4, 5 |
| Feldleiste, Live-Vorschau mit Bereichshervorhebung, Beispieldaten (Szenarien + echte Dokumente) | 6 |
| Fehler mit Bereich und Zeile, im Editor markiert | 4, 6 |
| Speichern `PUT /files`, Export, Read-only für mitgelieferte | 3, 5 |
| Phase-9-Platz für den Toolkit-Knopf/-Dialog | 5 (`ToolkitSlot`), Interfaces |
| Eigene Felder: alle Ebenen, Dokumenttyp-Schalter in der Zeile, Drawer mit Live-Vorschau, gesperrte Kern-/Profilfelder, Undo | 7, 8 |
| Upload-Weg für Bildfelder | 7, 8 |
| Organisation (Logo, Besteuerung, `registration_id`), Prüfpunkte verlinkt | 9 |
| Dokumenttypen (Profil, Nummernkreis mit Vorschau, Vorgaben) | 10 |
| Steuern & Einheiten (Archivieren), Textbausteine | 11 |
| Benutzer (Einladen per kopierbarem signiertem Link, Rollen owner/member, nur owner verwaltet, letzter owner bleibt) | 12, 13 |
| Kundenoption „Leistungsart“, Kategorie `O` (Entscheidung Phase 3) | 14 |
| Pest-Inertia-Tests, Tests neuer Actions, Vitest | 1–14 |
| Playwright: Feld anlegen → im Dokument füllen → im Template ergänzen → Vorschau und PDF | 15 |
| Doku `custom-fields`, `templates` (UI-Editor) en/de, CLAUDE.md | 16 |
| Deferred: Phase-6 #16 IntersectionObserver | 2, 3 |
| Deferred: Phase-3 M6 (Doku `file:///tmp`) | 16 |
| Deferred: Phase-5 Datumsfilter der Dokumentliste | bewusst nicht (Entscheidungen) |
| Screenshots 1440/390 hell/dunkel, PR, CI | 17 |
