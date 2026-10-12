# Phase 9: Template-Toolkit – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Template-Autoren laden im Template-Editor ein Toolkit herunter (ZIP mit vorgebautem Kit, den gespeicherten Template-Dateien, `.env.local` mit einem neuen, an das Template gebundenen Token und `.gitignore`), starten es mit `pnpm install && pnpm dev`, sehen jede Änderung an `template/` ohne Neuladen in einer Seitenvorschau (gerendert von ihrer openbill-Instanz) und schreiben sie mit `pnpm push` zurück; `pnpm pull` holt den Stand, `pnpm run pack` baut ein importierbares Paket. Abnahme: Erfolgskriterium Toolkit aus Spec 1 grün in Playwright.

**Architecture:** `packages/template-kit` ist ein Workspace-Paket mit drei Teilen: (1) der Vorschau-Seite (React + `@openbill/paged-preview`, eigene kleine CSS mit den Grundtokens aus DESIGN.md), die beim Build zu statischem `index.html` + `assets/` wird; (2) dem Node-Werkzeug (`src/tooling`): Vite-Plugin `openbill-render` (beobachtet `template/`, rendert per `POST /api/render` mit dem Token aus `.env.local`, schickt das Ergebnis als HMR-Event `openbill:render`, bedient die Seite über eigene Endpunkte `/__openbill/*`) und CLI `push`/`pull`/`pack`, gebaut zu `tooling/plugin.js` und `tooling/cli.js`; (3) den Endnutzer-Dateien (`kit-files/`: `package.json` mit nur `vite` als Abhängigkeit, `pnpm-workspace.yaml`, `vite.config.js`, `README.md`). `pnpm build` legt alles nach `packages/template-kit/dist/kit`. Laravel liest diesen Ordner über `config('openbill.toolkit.path')`; die neue Action `DownloadTemplateToolkit` (Route `POST /{locale}/templates/{id}/toolkit`, nur Sitzung) legt über `IssueApiToken` einen Token mit `templates:render` + `templates:write` + `template_id` an und baut mit `App\Rendering\ToolkitPackage` das ZIP. Der Token verlässt nie den Node-Prozess des Autors: Die Vorschau-Seite spricht nur mit dem Dev-Server.

**Tech Stack:** Laravel 13, Sanctum 4, Pest 5, Inertia v3 + React 19 + TypeScript, Vite 8.3 (Rolldown), Vitest 5, fflate 0.8 (ZIP im Kit, wird mitgebündelt), Node 24 (`node:util` `parseEnv`, globales `fetch`), Playwright (`e2e/`), VitePress.

**Spec:** `docs/superpowers/specs/2026-10-11-openbill-app-design.md` (bindend; Abschnitt 1 „Erfolgskriterien“ – Toolkit herunterladen → `pnpm install && pnpm dev` → Änderung an `template.liquid` ohne Neuladen sichtbar → `pnpm push`; Abschnitt 5 „Render-Endpunkt“ – Toolkit mit Token `templates:render`, `render/sources`, `render/schema`; Abschnitt 7 „Template-Toolkit“; Abschnitt 10 „Vitest: packages/template-kit“, „Playwright: Toolkit-Download“; Abschnitt 13: keine Offline-Vorschau), Master-Plan `docs/superpowers/plans/2026-10-11-openbill-app.md` (Abschnitt „Phase 9“, Review Focus 5, Phase 10: Node-Stage baut das Kit).

## Global Constraints

- Branch `phase-09-toolkit` (ist ausgecheckt). Git-Identität kommt aus `~/.gitconfig`; vor dem ersten Commit `test "$(git config user.email)" = "rafael@hauss.dev" && echo ok` → muss `ok` ausgeben, sonst stoppen und nachfragen. Nie `user.email`/`user.name` setzen.
- Jede Commit-Message endet mit der Zeile `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (in diesem Plan als zweites `-m`); die PR-Beschreibung endet mit `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- PHP, Composer, Artisan **nur in DDEV** (`ddev composer …`, `ddev artisan …`, `ddev exec …`). JS nur mit pnpm **im Container** (`ddev exec pnpm …`), nie npm/npx. Ausnahme: `e2e/` läuft auf dem Mac (`pnpm --dir e2e …`), und der Playwright-Test startet das entpackte Kit auf dem Mac.
- Vor jedem Commit: bei PHP `ddev exec vendor/bin/pint` und `ddev exec vendor/bin/phpstan analyse --memory-limit=1G`; bei TS `ddev exec pnpm typecheck`, `ddev exec pnpm test` bzw. für das Kit `ddev exec pnpm --filter @openbill/template-kit typecheck` und `… test`. Code-Blöcke dieses Plans sind inhaltlich verbindlich; Formatierung nach vorhandenem Stil (Pint für PHP; 4 Leerzeichen, einfache Quotes, Semikolons in TS).
- **Actions-Regel:** Keine Geschäftslogik im Controller. `TemplateToolkitController` lädt das Template, ruft genau `DownloadTemplateToolkit` und formt die Antwort. Der Token entsteht nur über `IssueApiToken`.
- **Der Token bleibt im Node-Prozess:** Plugin und CLI lesen `.env.local`; die Vorschau-Seite bekommt nur Render-Ergebnisse, Quellen und Schema über `/__openbill/*`. Kein `VITE_`-Präfix, nichts davon im Browser-Bundle.
- **Toolkit-Token = genau** `['templates:render', 'templates:write']` + `template_id`. Keine weiteren Fähigkeiten, kein Ablaufdatum, jeder Download einen neuen Token (alte bleiben gültig, bis sie widerrufen werden).
- Das Kit für Endnutzer braucht nur Node ≥ 24, pnpm und das Paket `vite`. Alle Skripte im Endnutzer-`package.json` sind `vite` oder `node tooling/cli.js …` (kein npm, kein npx).
- Grenzen wie der Import: `config/openbill.php` → `templates` (2 MB je Asset, 20 MB entpackt, 100 Einträge) und `TemplatePackage::ASSET_TYPES`. Das Kit spiegelt sie in `LIMITS`/`ASSET_EXTENSIONS`; `limits.drift.test.ts` hält sie gleich.
- UI-Texte der App nur über Schlüssel in `lang/en.json` **und** `lang/de.json` (gleiche Schlüssel, flach, ohne Ziffern, deutsche Texte in Du-Form). React `t()`/`path()` aus `resources/js/lib/i18n.ts`, PHP `Text::t()`. Die Vorschau-Seite des Kits ist ein eigenständiges Entwicklerwerkzeug und nur englisch (keine Schlüssel). Code und Kommentare Englisch.
- Gestaltung der App nach `prototypes/clickdummy-v2/DESIGN.md` mit den vorhandenen Komponenten (`Button`, `Dialog`, `Notice`). Das Kit nutzt die Grundtokens (Farben hell/dunkel, Radien, Schatten, Schriftstapel) als CSS-Variablen in `src/app/styles.css`, ohne Tailwind.
- Demo- und Testdaten nur fiktiv (Studio Nordlicht, Hafenkontor Lindqvist, Fjord Analytics, Hotel Alpenglück, Kulturwerk Elbinsel; Hosts `openbill.example`, `127.0.0.1`, `localhost`, `openbill.ddev.site`; E-Mails nur `@example.com`).
- CI: Pflicht-Job heißt `tests` und muss grün sein; Name nie ändern. Das Kit läuft dort über die vorhandenen Schritte „Packages“ (typecheck + test) und „Build“ (`pnpm build` baut ab Task 9 auch das Kit).
- Doku: neue Seite `template-toolkit` in `docs/en/` **und** `docs/de/`, Eintrag in `pages` und in beiden Label-Tabellen von `docs/.vitepress/config.ts`; `templates`, `api`, `development` ergänzt; `CLAUDE.md` aktualisiert.
- Der Haken für Phase 8 im Abschnitt „Fortschritt“ des Master-Plans ist mit diesem Plan committet. Den Haken für Phase 9 setzt der Orchestrator nach dem Merge, nicht der Umsetzer.

## Review Focus

- **Toolkit-Token kann nur sein Template schreiben (Master Review Focus 5):** Der Token aus dem echten ZIP rendert jedes Dokument und liest/schreibt sein Template; alles andere – fremdes Template lesen/schreiben, eigenes löschen/duplizieren, Import, Templateliste, Dokumente lesen/ändern/abschließen/PDF, Kunden, Organisation, Felder, Tokens, MCP – ist 403 und ändert nichts; mit dem Token lässt sich kein weiterer Toolkit-Token holen (Download-Route kennt nur die Sitzung → 401); widerrufen → 401; Template gelöscht → Token weg. → Task 12 (`ToolkitTokenScopeTest`).
- **Token landet nirgends, wo er nicht hingehört:** `.env.local` steht in der mitgelieferten `.gitignore`; der Dev-Server liefert `.env.local` nie aus; `/__openbill/*` antwortet nur für `localhost`/`127.0.0.1`/`::1` (sonst 403, gegen DNS-Rebinding) und nimmt POST nur als `application/json` (kein Cross-Site-Formular); Antworten an die Seite enthalten den Token nicht; die Download-Antwort ist `Cache-Control: no-store`. → Task 4 (`plugin.test.ts`), Task 10/11 (ZIP-Inhalt, Header).
- **Instanz weg oder Token kaputt, während `pnpm dev` läuft:** Netzwerkfehler, Zertifikat nicht vertraut, 401 (widerrufen), 403 (falsches Template), 404, 409 (mitgeliefertes Template), 413, 422 (mit Feldpfaden), 5xx und ein kaputtes `manifest.json` (mit Zeile) erscheinen als verständliche Meldung im Fehler-Overlay bzw. auf der Konsole; der Dev-Server läuft weiter, die Vorschau zeigt den letzten funktionierenden Stand, die nächste Änderung rendert wieder. → Task 2 (`client.test.ts`), Task 3 (`runtime.test.ts`), Task 5 (`push.test.ts`).
- **Unsichere oder ungewöhnliche Dateien:** `push`/`pack` prüfen vor jedem Request bzw. jeder Datei: Symlinks, unbekannte Dateien, Ordner außerhalb von `assets/`, falsche Endungen, zu große Assets, zu viele Dateien, fehlendes `template.liquid`/`manifest.json` → Liste aller Probleme, nichts wird gesendet/geschrieben; versteckte Dateien (`.DS_Store`) werden übersprungen; `pull` schreibt nie außerhalb von `template/` (Einträge mit `..` oder unbekannte Pfade → Abbruch ohne Schreiben) und überschreibt lokale Änderungen nur mit `--force`. → Task 1, Task 5, Task 6.
- **Schnelles Speichern im Editor:** Mehrere Änderungen kurz hintereinander (auch atomares Speichern per Umbenennen) ergeben einen Render-Aufruf mit dem neuesten Inhalt; eine ältere, langsame Antwort überschreibt nie eine neuere; kein Full Reload, die Scroll-Position bleibt. → Task 3 (`runtime.test.ts`), Task 4 (kein `full-reload`), Task 14 (Playwright: Marker, `scrollY`).

## Entscheidungen (geprüft am 2026-10-12)

| Thema | Entscheidung | Grund / Prüfung |
|---|---|---|
| UI-Technik des Kits | **React** + `@openbill/paged-preview` (Workspace, `lazy`), eigene CSS ohne Tailwind | `paged-preview` ist eine React-Komponente; Vanilla müsste sie nachbauen. Gebündelt (React-Produktionsbuild) bleibt die Seite klein, der Endnutzer installiert kein React. |
| Was ausgeliefert wird | Vorgebaut: Vorschau-Seite (`index.html`, `assets/`), `tooling/plugin.js`, `tooling/cli.js` (fflate eingebündelt). Endnutzer-`package.json` hat nur `vite` (`^8.3.4`, gleiche Range wie der Workspace, `kit-files.test.ts`) | `pnpm install` lädt nur Vite; nichts aus dem Workspace (`paged-preview`) muss auf npm liegen. |
| HMR in einer vorgebauten Seite | Das Plugin injiziert per `transformIndexHtml` das virtuelle Modul `/@openbill/bridge.js` (über `resolveId`/`load`); es nutzt `import.meta.hot.on('openbill:render')` und reicht die Daten als `window`-Event `openbill:render` weiter, setzt `window.__openbillLive = true` | Im Build gibt es kein `import.meta.hot`; ein virtuelles Modul läuft durch Vites Transform-Pipeline und bekommt den offiziellen Hot-Context. Kein Zugriff auf Vite-Interna, keine Warnungen über nicht analysierbare dynamische Imports. Task 4 prüft, dass das ausgelieferte Modul `createHotContext` enthält; Task 14 prüft es im Browser. |
| Seite ↔ Dev-Server | `GET /__openbill/state` → `KitState` (Instanz, Template-ID, letztes Event, Quellen, Schema), `POST /__openbill/source` (JSON `Source`) → neues `RenderEvent` (auch per HMR an alle Tabs). Host-Prüfung (`localhost`, `127.0.0.1`, `::1`, `*.localhost`, sonst nur `server.allowedHosts`) und JSON-Pflicht für POST in der Middleware selbst | Die Middleware hängt vor Vites eigenen (Host-Check, CORS); deshalb prüft sie selbst. Antworten sind `no-store`. |
| Rendern | `createRuntime()`: Datei-Event in `template/` → 80 ms Entprellen → `readTemplate()` → `POST /api/render` mit `template_id` + allen vier Teilen + Manifest + Quelle; neuere Anfrage bricht ältere ab (`AbortController`, Sequenznummer); Template-Fehler bekommen einen Ausschnitt der lokalen Datei (±2 Zeilen); die Vorschau zeigt das neueste Ergebnis **ohne** Template-Fehler | Wie der Template-Editor (`use-template-preview.ts`), aber im Node-Prozess. |
| Kaputtes `manifest.json` | Wird lokal erkannt (Zeile aus der `JSON.parse`-Meldung), nicht an openbill geschickt; Overlay `manifest.json:<zeile>` | Der Editor verfährt genauso (ungültiges JSON wird nie gerendert). |
| Assets in der Vorschau | `POST /api/render` kennt keine Asset-Uploads: die Vorschau nutzt die gespeicherten Assets des Templates. Änderungen unter `template/assets/` lösen trotzdem ein Rendern aus und setzen `notice: 'assets_changed'` („mit `pnpm push` übernehmen“) | Kein neuer Server-Endpunkt in dieser Phase, Body-Limit 2 MB bleibt. Doku und README sagen es. |
| Standard-Datenquelle | Wie der Template-Editor: neuestes Dokument aus `render/sources`, sonst Szenario `long_invoice`. Szenarien zusätzlich mit Sprache `en`/`de` | gleiche Erwartung in Editor und Kit. |
| Feldliste | `expression()`/`liquidPath()` als Kopie in `src/app/fields.ts`; `expression.drift.test.ts` vergleicht mit `resources/js/fields/expression.ts` (nur dieser Test importiert App-Code, von `tsc` des Kits ausgenommen) | Das Kit bleibt ohne App-Aliase baubar, die Ausdrücke bleiben gleich. |
| Ort des gebauten Kits | `packages/template-kit/dist/kit` (git-ignoriert). Laravel: `config('openbill.toolkit.path')` = `env('OPENBILL_TOOLKIT_PATH', base_path('packages/template-kit/dist/kit'))`. DDEV: `ddev exec pnpm build` (Root-`build` baut App **und** Kit) oder `ddev exec pnpm --filter @openbill/template-kit build`. Docker (Phase 10): Node-Stage führt `pnpm build` aus, die PHP-Stage kopiert `packages/template-kit/dist/kit` an denselben Pfad unter `/var/www/html` | Ein Pfad überall, Variable nur für Sonderfälle. Fehlt das Kit (`package.json` oder `tooling/cli.js`), antwortet der Download mit 503 `toolkit_unavailable` und legt **keinen** Token an. |
| Download-Endpunkt | `POST /{locale}/templates/{id}/toolkit` in `routes/web.php` (Gruppe `auth`, `whereUlid`, `throttle:10,1`, Name `templates.toolkit`), Aufruf per `fetch` mit `X-XSRF-TOKEN`. Fehler als Problem Details: `bootstrap/app.php` rendert Exceptions dieser Route wie `/api/*` | Spec 7/Master-Plan nennen genau diese Route. API-Tokens kommen nicht hinein (Web-Guard) – ein Token kann keine Tokens erzeugen. |
| ZIP-Aufbau | Ein Ordner `openbill-<slug>/`: Kit-Dateien, `template/` (Paketdateien aus `TemplatePackage::files()`), `.env.local`, `.gitignore`. Aus dem Kit-Ordner werden `template/`, `node_modules/`, `.env*`, `.gitignore`, `schema.json` und Symlinks nie übernommen | Entpacken legt keinen Dateihaufen ins aktuelle Verzeichnis. |
| `.env.local` | `OPENBILL_URL="<schema+host der Anfrage>"`, `OPENBILL_TOKEN="…"`, `OPENBILL_TEMPLATE_ID="…"`, Kommentarzeile oben; Werte in doppelten Anführungszeichen (Token enthält `|`) | Die URL, unter der der Autor openbill gerade im Browser nutzt, ist die beste Annahme für „von deinem Rechner erreichbar“ (hinter einem Proxy über Trusted Proxies, Phase 10). |
| Token-Name | `Toolkit: <Template> (<YYYY-MM-DD HH:MM>)` (`toolkit.token_name`); die Seite „API & MCP“ zeigt zusätzlich das Badge „Toolkit · <Template>“ (Phase 8) | sprechend und je Download unterscheidbar. |
| Mitgelieferte Templates | Dialog erklärt „erst duplizieren“ und bietet keinen Download; der Endpunkt antwortet 409 `template_built_in` | `UpdateTemplateFiles` lehnt sie ohnehin ab. |
| Ungespeicherte Änderungen | Dialog-Knopf „Speichern und herunterladen“ ruft `save()` aus `ToolkitSlotProps`; schlägt das fehl, kein Download | Das Kit startet mit dem gespeicherten Stand (Kommentar in `toolkit-slot.tsx`). |
| `pnpm pack` | pnpm hat ein eingebautes `pack` (npm-Tarball), das Vorrang vor Skripten hat. Das Skript heißt trotzdem `pack`; Doku, README und Dialog sagen `pnpm run pack`. `push`/`pull` sind keine pnpm-Befehle (Task 9 prüft beides) | Spec-Name bleibt, Aufruf funktioniert. |
| `pull` | Holt `GET /api/templates/{id}/package` + `GET /api/render/schema` (→ `schema.json`). Weichen lokale Dateien ab (Inhalt anders oder nur lokal vorhanden), bricht es mit der Liste ab; `--force` überschreibt und entfernt nur-lokale Paketdateien | kein stiller Datenverlust. |
| `pack` | ZIP im Importformat (Dateien oben, `assets/…`), Name `<slug(name)>-<version>.zip` im Kit-Ordner, `--out` möglich; gleiche Prüfungen wie `push` | `TemplatePackage::fromZip` nimmt genau das (Task 14 importiert es). |
| Lokale Instanz mit eigener CA | Node vertraut der mkcert-CA von DDEV nicht. Doku/README/Fehlermeldung: `NODE_OPTIONS=--use-system-ca` (Node ≥ 23.8 liest den System-Zertifikatsspeicher). Der Playwright-Test setzt das | Task 14 prüft es vorab mit einem `fetch` gegen `https://openbill.ddev.site/up`. |
| Kit als eigenes pnpm-Projekt | `kit-files/pnpm-workspace.yaml` mit `packages: []`, `engineStrict: true` und `allowBuilds: { esbuild: true }` | Entpackt in einem anderen Workspace bleibt das Kit eigenständig; Node < 24 bricht `pnpm install` ab; mögliche Build-Skripte blockieren die Installation nicht. |
| Ledger „deferred“ Phase-6 #16 | IntersectionObserver in `paged-preview` ist seit Phase 7 umgesetzt (`packages/paged-preview/src/lazy.ts`, Prop `lazy`); das Kit nutzt `lazy` | nichts nachzuholen. |

---

## Dateistruktur nach Phase 9

```
packages/template-kit/
├─ package.json                      @openbill/template-kit (private): build, test, typecheck
├─ tsconfig.json, vitest.config.ts
├─ vite.config.ts                    Build der Vorschau-Seite → dist/kit/index.html + assets/
├─ vite.tooling.config.ts            Build von src/tooling/{plugin,cli}.ts → dist/kit/tooling/*.js (Node 24, ESM)
├─ index.html                        Einstieg der Vorschau-Seite (Quelle)
├─ scripts/assemble.mjs              kopiert kit-files/ nach dist/kit
├─ kit-files/                        Endnutzer: package.json, pnpm-workspace.yaml, vite.config.js, README.md
└─ src/
   ├─ kit-files.test.ts              Endnutzer-package.json: nur pnpm-taugliche Skripte, Vite-Version
   ├─ shared/protocol.ts             Typen Seite ↔ Dev-Server (RenderEvent, KitState, Source, KitError, …)
   ├─ tooling/
   │  ├─ env.ts (+test)              .env.local lesen
   │  ├─ template-files.ts (+test)   Teile/Manifest lesen, sichere Pfade, Grenzen, Ausschnitt
   │  ├─ limits.drift.test.ts        Grenzen = config/openbill.php + TemplatePackage::ASSET_TYPES
   │  ├─ client.ts (+test)           openbill-API mit Token, verständliche Fehler
   │  ├─ runtime.ts (+test)          Rendern bei Datei-Änderung, neueste gewinnt
   │  ├─ plugin.ts (+test)           Vite-Plugin openbill-render, /__openbill/*, Bridge
   │  ├─ cli.ts, push.ts, pull.ts, pack.ts (+tests)
   │  └─ test-support/fake-openbill.ts   Fake-Instanz für Tests
   └─ app/
      ├─ main.tsx, app.tsx, styles.css
      ├─ toolbar.tsx, field-list.tsx, error-overlay.tsx
      ├─ use-kit.ts, kit-api.ts, hot.ts (+test)
      ├─ fields.ts, expression.drift.test.ts, missing.ts (+test), describe.ts (+test), stored-flag.ts (+test)
app/
├─ Actions/DownloadTemplateToolkit.php     Token + ZIP
├─ Exceptions/ToolkitUnavailableException.php   503 toolkit_unavailable
├─ Http/Controllers/TemplateToolkitController.php
└─ Rendering/
   ├─ TemplatePackage.php                  (geändert) files()
   └─ ToolkitPackage.php                   Kit lesen, ZIP bauen, .env.local
bootstrap/app.php                          (geändert) Problem Details auch für templates.toolkit
config/openbill.php                        (geändert) toolkit.path
routes/web.php                             (geändert) POST /{locale}/templates/{id}/toolkit
resources/js/
├─ lib/api.ts (+test)                      (geändert) apiBlob(), filenameOf()
├─ lib/download.ts                         saveBlob()
└─ templates/editor/toolkit-slot.tsx       Knopf + Dialog
lang/en.json, lang/de.json                 toolkit.*, errors.toolkit_unavailable
tests/
├─ Pest.php                                (geändert) fakeToolkit(), zipEntries(), envLocal()
├─ Feature/Rendering/ToolkitPackageTest.php
├─ Feature/Toolkit/ToolkitDownloadTest.php
├─ Feature/Toolkit/ToolkitTokenScopeTest.php
└─ Unit/DocsTest.php                       (geändert)
e2e/global-setup.ts                        (geändert) Kit gebaut?
e2e/tests/toolkit.spec.ts
docs/{en,de}/template-toolkit.md (+ templates.md, api.md, development.md), docs/.vitepress/config.ts
package.json (build), vite.config.ts (watch.ignored), .gitignore, CLAUDE.md
```

## Interfaces

**Kit (TypeScript, `packages/template-kit/src`)**

- `shared/protocol.ts`: `RENDER_EVENT = 'openbill:render'`, `KIT_API = '/__openbill'`, Typen `Paper`, `FieldScope`, `FieldType`, `ExpectedField`, `TemplateManifest`, `Source` (`{kind:'scenario', key, locale:'en'|'de'} | {kind:'document', id}`), `RenderSources`, `SchemaField`, `RenderSchema`, `ExcerptLine`, `RenderErrorItem` (`{part, file, line, message, excerpt?}`), `RenderResult` (`{header, body, footer, paper, errors}`), `KitErrorKind`, `KitError` (`{kind, status, message, details}`), `RenderEvent` (`{seq, at, source, manifest, result, errors, failure, notice}`), `KitState` (`{instance, templateId, event, sources, schema, failure}`).
- `tooling/env.ts`: `readKitEnv(root: string, environment?: Record<string, string|undefined>): KitEnv` (`{url, token, templateId}`), `KitConfigError` (`problems: string[]`), `ENV_FILE = '.env.local'`.
- `tooling/template-files.ts`: `TEMPLATE_DIR`, `PART_FILES`, `Part`, `MANIFEST_FILE`, `REQUIRED_FILES`, `LIMITS`, `ASSET_EXTENSIONS`, `isSafePath()`, `parseManifest()`, `jsonErrorLine()`, `readTemplate(dir): Promise<LocalTemplate>`, `excerpt(source, line, around?)`, `listTemplateFiles(dir): Promise<{entries: TemplateEntry[], problems: string[]}>`, `TemplateProblemError` (`problems: string[]`).
- `tooling/client.ts`: `createClient(env, fetchImpl?): OpenbillClient` (`render`, `sources`, `schema`, `putFiles`, `packageZip`), `renderRequest(templateId, source, template)`, `describeFailure(status, problem, url): KitError`, `networkFailure(url, cause): KitError`, `OpenbillError` (`failure: KitError`).
- `tooling/runtime.ts`: `createRuntime(options): KitRuntime` (`state()`, `setSource()`, `fileChanged()`, `render()`, `dispose()`), `defaultSource(sources)`.
- `tooling/plugin.ts`: `openbillRender(options?): Plugin`, `isLocalHost(host, allowed)`, `isSource(value)`, `BRIDGE_ID = '/@openbill/bridge.js'`.
- `tooling/cli.ts`: `main(argv, io): Promise<number>`; `push.ts` `push(root, env, client, log)`, `pull.ts` `pull(root, env, client, {force, log})` + `unpackPackage(zip)`, `pack.ts` `pack(root, {out?, log})` + `slug(name)`.

**Laravel**

- `App\Rendering\TemplatePackage::files(): array<string, string>` (Paketpfad → Inhalt, Reihenfolge `manifest.json`, `header.liquid`, `template.liquid`, `footer.liquid`, `styles.css`, Assets).
- `App\Rendering\ToolkitPackage` (`final readonly`): `__construct(array $kit, TemplatePackage $template, array $env)`, `static readKit(string $dir): array<string, string>` (wirft `ToolkitUnavailableException`), `toZip(string $folder): string`, `static envFile(array $env): string`, `GITIGNORE`.
- `App\Actions\DownloadTemplateToolkit::handle(Actor $actor, User $user, Template $template, string $instanceUrl): DownloadFile`, `static tokenName(Template $template): string`.
- `App\Exceptions\ToolkitUnavailableException` (503, `toolkit_unavailable`).
- Route `templates.toolkit` = `POST /{locale}/templates/{id}/toolkit` → ZIP `openbill-toolkit-<slug>.zip`, `Cache-Control: no-store`.
- Pest-Helfer in `tests/Pest.php`: `fakeToolkit(): string`, `zipEntries(string $zip): array<string, string>`, `envLocal(string $contents): array<string, string>`.

**Für Phase 10 (Docker)**

- Die Node-Stage führt `pnpm build` aus (baut `public/build` **und** `packages/template-kit/dist/kit`); die PHP-Stage kopiert beide. Ohne `dist/kit` antwortet der Toolkit-Download mit 503. `OPENBILL_TOOLKIT_PATH` nur, wenn das Kit woanders liegt.
- Der `e2e`-Job gegen den Compose-Stack setzt `OPENBILL_URL`; `e2e/global-setup.ts` prüft das lokale Kit dann nicht. `toolkit.spec.ts` braucht auf dem Runner Node 24, pnpm und `unzip`.

---
### Task 1: Kit-Paket, Protokoll, `.env.local` und Template-Dateien

**Files:**
- Create: `packages/template-kit/package.json`, `packages/template-kit/tsconfig.json`, `packages/template-kit/vitest.config.ts`
- Create: `packages/template-kit/src/shared/protocol.ts`
- Create: `packages/template-kit/src/tooling/env.ts`, `packages/template-kit/src/tooling/env.test.ts`
- Create: `packages/template-kit/src/tooling/template-files.ts`, `packages/template-kit/src/tooling/template-files.test.ts`
- Create: `packages/template-kit/src/tooling/limits.drift.test.ts`
- Modify: `.gitignore`, `pnpm-lock.yaml` (durch `pnpm install`)

**Interfaces:**
- Consumes: `config/openbill.php` (`templates.*`), `App\Rendering\TemplatePackage::ASSET_TYPES` und `safePath()` (nur als Vorbild/Drift-Test).
- Produces: alles aus „Interfaces → Kit“ für `shared/protocol.ts`, `tooling/env.ts`, `tooling/template-files.ts`.

- [ ] **Step 1: Identität prüfen**

Run: `test "$(git config user.email)" = "rafael@hauss.dev" && echo ok`
Expected: `ok` (sonst stoppen und nachfragen)

- [ ] **Step 2: Paket anlegen**

`packages/template-kit/package.json`:

```json
{
    "name": "@openbill/template-kit",
    "version": "0.0.0",
    "private": true,
    "type": "module",
    "description": "Local template development for openbill: live preview (Vite), push, pull and pack. Built into dist/kit, which openbill hands out as ZIP.",
    "license": "MIT",
    "scripts": {
        "build": "vite build && vite build --config vite.tooling.config.ts && node scripts/assemble.mjs",
        "test": "vitest run",
        "typecheck": "tsc -p ."
    },
    "devDependencies": {
        "@openbill/paged-preview": "workspace:*",
        "@types/node": "^24.19.2",
        "@types/react": "^19.3.0",
        "@types/react-dom": "^19.3.0",
        "@vitejs/plugin-react": "^6.1.2",
        "fflate": "^0.8.3",
        "react": "^19.3.0",
        "react-dom": "^19.3.0",
        "typescript": "^7.0.2",
        "vite": "^8.3.4",
        "vitest": "^5.0.3"
    }
}
```

`packages/template-kit/tsconfig.json`:

```json
{
    "compilerOptions": {
        "target": "ES2023",
        "lib": ["ES2023", "DOM", "DOM.Iterable"],
        "module": "ESNext",
        "moduleResolution": "bundler",
        "jsx": "react-jsx",
        "strict": true,
        "noEmit": true,
        "skipLibCheck": true,
        "isolatedModules": true,
        "verbatimModuleSyntax": true,
        "noUnusedLocals": true,
        "noUnusedParameters": true,
        "types": ["node", "vite/client"]
    },
    "include": ["src"],
    "exclude": ["src/app/expression.drift.test.ts"]
}
```

(`expression.drift.test.ts` importiert App-Code mit `@/`-Typimporten; Vitest entfernt sie, `tsc` des Kits kennt den Alias nicht. Die beiden Vite-Konfigurationen prüft der Build in Task 9.)

`packages/template-kit/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

// Tooling (env, client, runtime, plugin, CLI) runs in Node; the preview page is checked through its plain functions.
export default defineConfig({
    test: {
        include: ['src/**/*.test.ts'],
        environment: 'node',
        testTimeout: 20_000,
    },
});
```

An `.gitignore` anhängen:

```gitignore
/packages/template-kit/dist
/packages/template-kit/template
/packages/template-kit/.env.local
```

Run: `ddev exec pnpm install`
Expected: endet mit `Done in …`, kein Fehler zu Build-Skripten (fflate hat keine); `pnpm-lock.yaml` enthält `packages/template-kit`.

- [ ] **Step 3: Protokoll-Typen schreiben**

`packages/template-kit/src/shared/protocol.ts`:

```ts
/**
 * What the dev server (Node, holds the token) and the preview page (browser, never sees the token) exchange.
 * Shapes of openbill's answers: POST /api/render, GET /api/render/sources, GET /api/render/schema.
 */

/** HMR event of the plugin and window event of the bridge module. */
export const RENDER_EVENT = 'openbill:render';
/** Prefix of the dev server's own endpoints (plugin middleware). */
export const KIT_API = '/__openbill';

export type Paper = { format: string; marginX: string; headerHeight: string; footerHeight: string };
export type FieldScope = 'org' | 'customer' | 'contact' | 'document' | 'position';
export type FieldType = 'text' | 'textarea' | 'number' | 'money' | 'date' | 'select' | 'boolean' | 'image';
export type ExpectedField = { scope: FieldScope; key: string; type: FieldType };

/** manifest.json as far as the kit reads it; everything else goes to openbill untouched. */
export type TemplateManifest = {
    name?: unknown;
    version?: unknown;
    expectedFields?: ExpectedField[];
    paper?: Paper;
    [key: string]: unknown;
};

export type Source = { kind: 'scenario'; key: string; locale: 'en' | 'de' } | { kind: 'document'; id: string };

export type RenderSources = {
    scenarios: { key: string; document_type: string }[];
    documents: { id: string; type: string; status: string; number: string | null; date: string; customer_name: string | null; locale: string }[];
};

export type SchemaField = { key: string; label: string; type: FieldType; required: boolean; options: string[]; doc_types: string[] };
export type RenderSchema = { levels: Record<FieldScope, { context: string; core: string[]; custom: SchemaField[] }> };

export type ExcerptLine = { line: number; text: string };
/** A template error of POST /api/render; the dev server adds lines of the local file around it. */
export type RenderErrorItem = { part: string; file: string | null; line: number | null; message: string; excerpt?: ExcerptLine[] };
export type RenderResult = { header: string; body: string; footer: string; paper: Paper; errors: RenderErrorItem[] };

export type KitErrorKind = 'config' | 'network' | 'unauthorized' | 'forbidden' | 'not_found' | 'conflict' | 'validation' | 'too_large' | 'server' | 'manifest';
/** Why there is no new preview (or why push/pull failed), in words for the template author. */
export type KitError = { kind: KitErrorKind; status: number | null; message: string; details: string[] };

export type RenderEvent = {
    /** Grows with every render of this dev server: the page never replaces a newer event with an older one. */
    seq: number;
    at: string;
    source: Source;
    manifest: TemplateManifest | null;
    /** What the preview shows: the newest result without template errors (null before the first one). */
    result: RenderResult | null;
    /** Template errors of the newest render (with excerpt). */
    errors: RenderErrorItem[];
    /** The newest render did not happen: instance unreachable, token refused, broken manifest.json, … */
    failure: KitError | null;
    notice: 'assets_changed' | null;
};

export type KitState = {
    instance: string;
    templateId: string;
    event: RenderEvent | null;
    sources: RenderSources | null;
    schema: RenderSchema | null;
    /** Sources/schema could not be loaded, or .env.local is incomplete. */
    failure: KitError | null;
};
```

- [ ] **Step 4: Failing Tests für `.env.local` schreiben**

`packages/template-kit/src/tooling/env.test.ts`:

```ts
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { KitConfigError, readKitEnv } from './env';

function kit(env?: string): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'kit-env-'));
    if (env !== undefined) writeFileSync(path.join(dir, '.env.local'), env);
    return dir;
}

describe('readKitEnv', () => {
    it('reads .env.local with quoted values (the token contains "|") and drops a trailing slash', () => {
        const dir = kit('# keep private\nOPENBILL_URL="https://openbill.example/"\nOPENBILL_TOKEN="3|openbill_abc"\nOPENBILL_TEMPLATE_ID="01kfjordbrief"\n');

        expect(readKitEnv(dir, {})).toEqual({ url: 'https://openbill.example', token: '3|openbill_abc', templateId: '01kfjordbrief' });
    });

    it('lets OPENBILL_* variables of the environment win over the file', () => {
        const dir = kit('OPENBILL_URL="https://openbill.example"\nOPENBILL_TOKEN="3|old"\nOPENBILL_TEMPLATE_ID="01kfjordbrief"\n');

        expect(readKitEnv(dir, { OPENBILL_TOKEN: '4|new' }).token).toBe('4|new');
    });

    it('names every missing key', () => {
        expect(() => readKitEnv(kit(), {})).toThrow(/Missing OPENBILL_URL, OPENBILL_TOKEN, OPENBILL_TEMPLATE_ID/);
    });

    it('refuses a URL without http(s)', () => {
        const dir = kit('OPENBILL_URL="openbill.example"\nOPENBILL_TOKEN="3|x"\nOPENBILL_TEMPLATE_ID="01k"\n');

        expect(() => readKitEnv(dir, {})).toThrow(KitConfigError);
        expect(() => readKitEnv(dir, {})).toThrow(/must start with http/);
    });
});
```

- [ ] **Step 5: Test laufen lassen**

Run: `ddev exec pnpm --filter @openbill/template-kit exec vitest run src/tooling/env.test.ts`
Expected: FAIL mit `Failed to resolve import "./env"` (oder „Cannot find module“)

- [ ] **Step 6: `env.ts` schreiben**

`packages/template-kit/src/tooling/env.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';

export type KitEnv = { url: string; token: string; templateId: string };

export const ENV_FILE = '.env.local';

const KEYS = { url: 'OPENBILL_URL', token: 'OPENBILL_TOKEN', templateId: 'OPENBILL_TEMPLATE_ID' } as const;

export class KitConfigError extends Error {
    constructor(readonly problems: string[]) {
        super(`${ENV_FILE}: ${problems.join(' ')}`);
        this.name = 'KitConfigError';
    }
}

/** Instance URL, token and template id from .env.local (written by the toolkit download); OPENBILL_* variables of the environment win. */
export function readKitEnv(root: string, environment: Record<string, string | undefined> = process.env): KitEnv {
    const file = path.join(root, ENV_FILE);
    const fromFile = existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : {};
    const value = (key: string): string => (environment[key] ?? fromFile[key] ?? '').trim();

    const problems: string[] = [];
    const missing = Object.values(KEYS).filter((key) => value(key) === '');
    if (missing.length > 0) {
        problems.push(`Missing ${missing.join(', ')} (download the toolkit again in the template editor, or set them in ${ENV_FILE}).`);
    }
    const url = value(KEYS.url).replace(/\/+$/, '');
    if (url !== '' && !/^https?:\/\/[^/\s]+/.test(url)) {
        problems.push(`${KEYS.url} must start with http:// or https:// (got "${url}").`);
    }
    if (problems.length > 0) throw new KitConfigError(problems);

    return { url, token: value(KEYS.token), templateId: value(KEYS.templateId) };
}
```

- [ ] **Step 7: Test laufen lassen**

Run: `ddev exec pnpm --filter @openbill/template-kit exec vitest run src/tooling/env.test.ts`
Expected: PASS (4 Tests)

- [ ] **Step 8: Failing Tests für Template-Dateien schreiben**

`packages/template-kit/src/tooling/template-files.test.ts`:

```ts
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { excerpt, isSafePath, jsonErrorLine, LIMITS, listTemplateFiles, parseManifest, readTemplate } from './template-files';

function templateDir(files: Record<string, string | Buffer>): string {
    const dir = path.join(mkdtempSync(path.join(tmpdir(), 'kit-tpl-')), 'template');
    for (const [name, contents] of Object.entries(files)) {
        mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
        writeFileSync(path.join(dir, name), contents);
    }
    return dir;
}

describe('isSafePath', () => {
    it.each([
        ['assets/logo.svg', true],
        ['assets/fonts/brand.woff2', true],
        ['template.liquid', true],
        ['../evil.txt', false],
        ['assets/../../evil.svg', false],
        ['/etc/passwd', false],
        ['C:/evil.svg', false],
        ['assets\\logo.svg', false],
        ['assets//logo.svg', false],
        ['./manifest.json', false],
        ['', false],
    ])('%s → %s', (name, safe) => {
        expect(isSafePath(name)).toBe(safe);
    });
});

describe('parseManifest', () => {
    it('reads a JSON object', () => {
        expect(parseManifest('{"name": "Fjord Brief", "version": "1.0.0"}')).toEqual({ manifest: { name: 'Fjord Brief', version: '1.0.0' }, problem: null });
    });

    it('names the line of a syntax error', () => {
        const { manifest, problem } = parseManifest('{\n  "name": "Fjord Brief",\n}');

        expect(manifest).toBeNull();
        expect(problem?.line).toBe(3);
        expect(problem?.message).toMatch(/^manifest\.json is not valid JSON: /);
    });

    it('refuses anything but an object', () => {
        expect(parseManifest('["Fjord"]').problem).toEqual({ line: 1, message: 'manifest.json must be a JSON object.' });
    });

    it('turns a position into a line when the message has no line', () => {
        expect(jsonErrorLine('{\n\n x', 'Unexpected token x in JSON at position 4')).toBe(3);
        expect(jsonErrorLine('{}', 'something else')).toBeNull();
    });
});

describe('readTemplate', () => {
    it('reads the parts, missing optional parts are empty, a missing manifest is a problem', async () => {
        const dir = templateDir({ 'template.liquid': '<h1>{{ document.number }}</h1>', 'styles.css': 'h1 { color: navy; }' });

        const local = await readTemplate(dir);

        expect(local.parts).toEqual({ header: '', body: '<h1>{{ document.number }}</h1>', footer: '', css: 'h1 { color: navy; }' });
        expect(local.manifest).toBeNull();
        expect(local.manifestProblem).toEqual({ line: null, message: 'template/manifest.json is missing.' });
    });
});

describe('excerpt', () => {
    it('returns the lines around the error line', () => {
        expect(excerpt('a\nb\nc\nd\ne\nf', 2)).toEqual([
            { line: 1, text: 'a' },
            { line: 2, text: 'b' },
            { line: 3, text: 'c' },
            { line: 4, text: 'd' },
        ]);
    });
});

describe('listTemplateFiles', () => {
    it('lists package files, skips hidden files and reports everything the import would refuse', async () => {
        const dir = templateDir({
            'manifest.json': '{"name":"Fjord Brief","version":"1.0.0"}',
            'template.liquid': '<h1>Fjord</h1>',
            'assets/logo.svg': '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
            'assets/fonts/brand.woff2': 'wOF2',
            'assets/run.sh': 'echo',
            'assets/huge.png': Buffer.alloc(LIMITS.assetBytes + 1),
            'notes.txt': 'todo',
            'partials/card.liquid': '',
            '.DS_Store': '',
            'assets/.gitkeep': '',
        });
        symlinkSync('/etc/hostname', path.join(dir, 'assets/link.svg'));

        const { entries, problems } = await listTemplateFiles(dir);

        expect(entries.map((entry) => entry.path)).toEqual(['assets/fonts/brand.woff2', 'assets/logo.svg', 'manifest.json', 'template.liquid']);
        expect(problems).toEqual([
            'assets/huge.png: 2.0 MB is larger than 2.0 MB per asset.',
            'assets/link.svg: symbolic links are not allowed.',
            'assets/run.sh: assets must be png, jpg, jpeg, gif, webp, svg, woff, woff2, ttf, otf.',
            'notes.txt: unknown file (allowed: manifest.json, header.liquid, template.liquid, footer.liquid, styles.css, assets/…).',
            'partials/: only assets/ may contain folders.',
        ]);
    });

    it('requires manifest.json and template.liquid', async () => {
        const { problems } = await listTemplateFiles(templateDir({ 'header.liquid': '' }));

        expect(problems).toEqual(['manifest.json is missing.', 'template.liquid is missing.']);
    });

    it('reports a missing template folder instead of throwing', async () => {
        const { entries, problems } = await listTemplateFiles(path.join(tmpdir(), 'kit-no-such-folder', 'template'));

        expect(entries).toEqual([]);
        expect(problems).toEqual(['template/ is missing.']);
    });
});
```

`limits.drift.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';
import { ASSET_EXTENSIONS, LIMITS } from './template-files';

// packages/template-kit/src/tooling → repository root
const root = path.resolve(import.meta.dirname, '../../../..');

it('uses the template limits of config/openbill.php', () => {
    const config = readFileSync(path.join(root, 'config/openbill.php'), 'utf8');
    const bytes = (key: string): number => {
        const match = new RegExp(`'${key}' => ([\\d *_]+),`).exec(config);
        if (!match) throw new Error(`config/openbill.php has no ${key}`);
        return match[1].split('*').reduce((product, factor) => product * Number(factor.trim().replaceAll('_', '')), 1);
    };

    expect(LIMITS).toEqual({ assetBytes: bytes('max_asset_bytes'), totalBytes: bytes('max_unpacked_bytes'), entries: bytes('max_entries') });
});

it('allows exactly the asset types of TemplatePackage::ASSET_TYPES', () => {
    const php = readFileSync(path.join(root, 'app/Rendering/TemplatePackage.php'), 'utf8');
    const block = /ASSET_TYPES = \[([\s\S]*?)\];/.exec(php)?.[1] ?? '';

    expect([...block.matchAll(/'([a-z0-9]+)' =>/g)].map((match) => match[1]).sort()).toEqual([...ASSET_EXTENSIONS].sort());
});
```

- [ ] **Step 9: Tests laufen lassen**

Run: `ddev exec pnpm --filter @openbill/template-kit exec vitest run src/tooling`
Expected: FAIL mit `Failed to resolve import "./template-files"`

- [ ] **Step 10: `template-files.ts` schreiben**

`packages/template-kit/src/tooling/template-files.ts`:

```ts
import { lstat, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ExcerptLine, TemplateManifest } from '../shared/protocol';

/** Folder of the template sources inside the kit. */
export const TEMPLATE_DIR = 'template';
/** Part of POST /api/render and PUT /api/templates/{id}/files => file (App\Rendering\TemplatePackage::FILES). */
export const PART_FILES = { header: 'header.liquid', body: 'template.liquid', footer: 'footer.liquid', css: 'styles.css' } as const;
export type Part = keyof typeof PART_FILES;
export const MANIFEST_FILE = 'manifest.json';
export const REQUIRED_FILES = [MANIFEST_FILE, PART_FILES.body];

/** config/openbill.php "templates" and TemplatePackage::ASSET_TYPES (limits.drift.test.ts keeps them equal). */
export const LIMITS = { assetBytes: 2 * 1024 * 1024, totalBytes: 20 * 1024 * 1024, entries: 100 } as const;
export const ASSET_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'woff', 'woff2', 'ttf', 'otf'] as const;

export type ManifestProblem = { line: number | null; message: string };
export type LocalTemplate = { parts: Record<Part, string>; manifestText: string; manifest: TemplateManifest | null; manifestProblem: ManifestProblem | null };
export type TemplateEntry = { path: string; absolute: string; size: number };

/** Local problems of template/ (push, pull, pack); nothing was sent or written. */
export class TemplateProblemError extends Error {
    constructor(
        message: string,
        readonly problems: string[],
    ) {
        super(message);
        this.name = 'TemplateProblemError';
    }
}

/** Like TemplatePackage::safePath(): relative, "/" only, no ".", ".." or empty segment, no drive letter. */
export function isSafePath(name: string): boolean {
    if (name === '' || name.includes('\0') || name.includes('\\') || name.startsWith('/') || /^[A-Za-z]:/.test(name)) return false;
    return name.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

/** Line of a JSON.parse error: Node names "line X column Y", older engines only a position. */
export function jsonErrorLine(text: string, message: string): number | null {
    const lineColumn = /line (\d+) column \d+/.exec(message);
    if (lineColumn) return Number(lineColumn[1]);
    const position = /position (\d+)/.exec(message);
    if (position) return text.slice(0, Number(position[1])).split('\n').length;
    return null;
}

/** manifest.json as object, or where it breaks. */
export function parseManifest(text: string): { manifest: TemplateManifest | null; problem: ManifestProblem | null } {
    try {
        const value: unknown = JSON.parse(text);
        if (value === null || typeof value !== 'object' || Array.isArray(value)) {
            return { manifest: null, problem: { line: 1, message: 'manifest.json must be a JSON object.' } };
        }
        return { manifest: value as TemplateManifest, problem: null };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { manifest: null, problem: { line: jsonErrorLine(text, message), message: `manifest.json is not valid JSON: ${message}` } };
    }
}

async function readOptional(file: string): Promise<string> {
    try {
        return await readFile(file, 'utf8');
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '';
        throw error;
    }
}

/** The parts and the manifest as the dev server renders them; a missing optional part is empty. */
export async function readTemplate(templateDir: string): Promise<LocalTemplate> {
    const read = (file: string) => readOptional(path.join(templateDir, file));
    const parts: Record<Part, string> = {
        header: await read(PART_FILES.header),
        body: await read(PART_FILES.body),
        footer: await read(PART_FILES.footer),
        css: await read(PART_FILES.css),
    };
    const manifestText = await read(MANIFEST_FILE);
    const { manifest, problem } = manifestText === '' ? { manifest: null, problem: { line: null, message: `${TEMPLATE_DIR}/${MANIFEST_FILE} is missing.` } } : parseManifest(manifestText);

    return { parts, manifestText, manifest, manifestProblem: problem };
}

/** Lines around `line` (1-based) of a source, for the error overlay. */
export function excerpt(source: string, line: number, around = 2): ExcerptLine[] {
    const lines = source.split('\n');
    const result: ExcerptLine[] = [];
    for (let n = Math.max(1, line - around); n <= Math.min(lines.length, line + around); n++) {
        result.push({ line: n, text: lines[n - 1] });
    }
    return result;
}

const mb = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/**
 * Every file of template/ that belongs into a template package, checked like the import (TemplatePackage::fromZip):
 * manifest.json and the four parts at the top, assets/… with an allowed extension, no symbolic links, no other files,
 * sizes and count within LIMITS. Hidden files (.DS_Store, .gitkeep, …) are skipped. Problems are collected, never thrown.
 */
export async function listTemplateFiles(templateDir: string): Promise<{ entries: TemplateEntry[]; problems: string[] }> {
    const entries: TemplateEntry[] = [];
    const problems: string[] = [];
    const known: string[] = [MANIFEST_FILE, ...Object.values(PART_FILES)];

    const walk = async (relative: string): Promise<void> => {
        const dir = relative === '' ? templateDir : path.join(templateDir, ...relative.split('/'));
        for (const name of (await readdir(dir)).sort()) {
            if (name.startsWith('.')) continue;
            const rel = relative === '' ? name : `${relative}/${name}`;
            const absolute = path.join(dir, name);
            const stat = await lstat(absolute);
            if (stat.isSymbolicLink()) {
                problems.push(`${rel}: symbolic links are not allowed.`);
            } else if (stat.isDirectory()) {
                if (rel === 'assets' || rel.startsWith('assets/')) await walk(rel);
                else problems.push(`${rel}/: only assets/ may contain folders.`);
            } else if (!stat.isFile() || !isSafePath(rel)) {
                problems.push(`${rel}: not a regular file with a safe name.`);
            } else if (rel.startsWith('assets/')) {
                const extension = path.extname(rel).slice(1).toLowerCase();
                if (!(ASSET_EXTENSIONS as readonly string[]).includes(extension)) problems.push(`${rel}: assets must be ${ASSET_EXTENSIONS.join(', ')}.`);
                else if (stat.size > LIMITS.assetBytes) problems.push(`${rel}: ${mb(stat.size)} is larger than ${mb(LIMITS.assetBytes)} per asset.`);
                else entries.push({ path: rel, absolute, size: stat.size });
            } else if (!known.includes(rel)) {
                problems.push(`${rel}: unknown file (allowed: ${known.join(', ')}, assets/…).`);
            } else {
                entries.push({ path: rel, absolute, size: stat.size });
            }
        }
    };

    try {
        await walk('');
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { entries: [], problems: [`${TEMPLATE_DIR}/ is missing.`] };
        throw error;
    }
    for (const required of REQUIRED_FILES) {
        if (!entries.some((entry) => entry.path === required)) problems.push(`${required} is missing.`);
    }
    const total = entries.reduce((sum, entry) => sum + entry.size, 0);
    if (total > LIMITS.totalBytes) problems.push(`template/ holds ${mb(total)}, at most ${mb(LIMITS.totalBytes)} are allowed.`);
    if (entries.length > LIMITS.entries) problems.push(`${entries.length} files, at most ${LIMITS.entries} are allowed.`);
    entries.sort((a, b) => (a.path < b.path ? -1 : 1));

    return { entries, problems: problems.sort() };
}
```

Hinweis: `problems.sort()` sortiert alle Meldungen (auch „… is missing.“) alphabetisch, damit Ausgabe und Tests deterministisch sind; sie beginnen jeweils mit dem Pfad.

- [ ] **Step 11: Tests laufen lassen**

Run: `ddev exec pnpm --filter @openbill/template-kit exec vitest run src/tooling`
Expected: PASS (env, template-files, limits.drift). Falls die Größenmeldung für `assets/huge.png` anders gerundet ist (`2.0 MB is larger than 2.0 MB`): Die Erwartung im Test ist so gewollt (2 MB + 1 Byte rundet auf `2.0`); nicht die Grenze ändern.

- [ ] **Step 12: Typen prüfen und committen**

Run: `ddev exec pnpm --filter @openbill/template-kit typecheck`
Expected: keine Ausgabe, Exit 0

```bash
git add .gitignore pnpm-lock.yaml packages/template-kit
git commit -m "feat(toolkit): template kit package with env and template file checks" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: API-Client und Fake-Instanz

**Files:**
- Create: `packages/template-kit/src/tooling/test-support/fake-openbill.ts`
- Create: `packages/template-kit/src/tooling/client.ts`, `packages/template-kit/src/tooling/client.test.ts`

**Interfaces:**
- Consumes: `KitError`, `RenderResult`, `RenderSources`, `RenderSchema`, `Source`, `TemplateManifest` (Task 1), `Part` (Task 1); openbill: `POST /api/render`, `GET /api/render/sources|schema`, `PUT /api/templates/{id}/files`, `GET /api/templates/{id}/package`, Problem Details (`App\Support\Problem`: `title`, `detail`, `reason`, `violations[{path,message}]`).
- Produces: `createClient(env: {url, token}, fetchImpl?: typeof fetch): OpenbillClient`; `OpenbillClient = { render(body: RenderRequest, signal?: AbortSignal): Promise<RenderResult>; sources(): Promise<RenderSources>; schema(): Promise<RenderSchema>; putFiles(templateId: string, body: FilesBody): Promise<SavedTemplate>; packageZip(templateId: string): Promise<Uint8Array> }`; `renderRequest(templateId, source, template): RenderRequest`; `describeFailure(status, problem, url): KitError`; `networkFailure(url, cause): KitError`; `class OpenbillError { failure: KitError }`; `startFakeOpenbill(): Promise<FakeOpenbill>` mit `SAMPLE_RESULT`, `SAMPLE_SOURCES`, `SAMPLE_SCHEMA`.

- [ ] **Step 1: Fake-Instanz schreiben**

`packages/template-kit/src/tooling/test-support/fake-openbill.ts`:

```ts
import { createServer, type IncomingHttpHeaders } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { RenderResult, RenderSchema, RenderSources } from '../../shared/protocol';

export type Recorded = { method: string; path: string; headers: IncomingHttpHeaders; body: string };
export type Reply = { status?: number; json?: unknown; body?: Uint8Array | string; contentType?: string; delayMs?: number };
export type Handler = (request: Recorded) => Reply | Promise<Reply>;

export type FakeOpenbill = {
    url: string;
    requests: Recorded[];
    /** Replaces the answer for one method + path. */
    on(method: string, path: string, handler: Handler): void;
    close(): Promise<void>;
};

export const SAMPLE_RESULT: RenderResult = {
    header: '<p>Studio Nordlicht</p>',
    body: '<p>Rechnung</p>',
    footer: '<p>Seite</p>',
    paper: { format: 'A4', marginX: '20mm', headerHeight: '30mm', footerHeight: '20mm' },
    errors: [],
};

export const SAMPLE_SOURCES: RenderSources = {
    scenarios: [
        { key: 'short_invoice', document_type: 'invoice' },
        { key: 'long_invoice', document_type: 'invoice' },
    ],
    documents: [{ id: '01kdochafenkontor', type: 'invoice', status: 'draft', number: null, date: '2026-10-12', customer_name: 'Hafenkontor Lindqvist', locale: 'de' }],
};

export const SAMPLE_SCHEMA: RenderSchema = {
    levels: {
        org: { context: 'org', core: ['name', 'logo'], custom: [] },
        customer: { context: 'customer', core: ['name'], custom: [] },
        contact: { context: 'contact', core: ['name'], custom: [] },
        document: { context: 'document', core: ['number', 'date', 'gross_total'], custom: [{ key: 'po_number', label: 'PO number', type: 'text', required: false, options: [], doc_types: ['invoice'] }] },
        position: { context: 'positions[]', core: ['title', 'quantity'], custom: [] },
    },
};

/** A tiny stand-in for an openbill instance: records every request and answers per method + path (default: sample data). */
export async function startFakeOpenbill(): Promise<FakeOpenbill> {
    const requests: Recorded[] = [];
    const handlers = new Map<string, Handler>([
        ['POST /api/render', () => ({ json: { ...SAMPLE_RESULT, totals: {}, issues: [] } })],
        ['GET /api/render/sources', () => ({ json: SAMPLE_SOURCES })],
        ['GET /api/render/schema', () => ({ json: SAMPLE_SCHEMA })],
    ]);

    const server = createServer((req, res) => {
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => {
            void (async () => {
                const recorded: Recorded = { method: req.method ?? 'GET', path: (req.url ?? '/').split('?')[0], headers: req.headers, body: Buffer.concat(chunks).toString('utf8') };
                requests.push(recorded);
                const handler = handlers.get(`${recorded.method} ${recorded.path}`);
                const reply: Reply = handler ? await handler(recorded) : { status: 404, json: { status: 404, title: 'Not Found', detail: '', reason: 'not_found' } };
                if (reply.delayMs) await new Promise((resolve) => setTimeout(resolve, reply.delayMs));
                if (res.destroyed) return;
                const status = reply.status ?? 200;
                const json = reply.json !== undefined;
                res.writeHead(status, { 'Content-Type': reply.contentType ?? (json ? (status >= 400 ? 'application/problem+json' : 'application/json') : 'application/octet-stream') });
                res.end(json ? JSON.stringify(reply.json) : (reply.body ?? ''));
            })();
        });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;

    return {
        url: `http://127.0.0.1:${port}`,
        requests,
        on: (method, path, handler) => void handlers.set(`${method} ${path}`, handler),
        close: () =>
            new Promise<void>((resolve) => {
                server.closeAllConnections();
                server.close(() => resolve());
            }),
    };
}
```

- [ ] **Step 2: Failing Tests schreiben**

`packages/template-kit/src/tooling/client.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createClient, describeFailure, networkFailure, OpenbillError, renderRequest } from './client';
import { SAMPLE_RESULT, startFakeOpenbill, type FakeOpenbill } from './test-support/fake-openbill';

let fake: FakeOpenbill;
beforeEach(async () => {
    fake = await startFakeOpenbill();
});
afterEach(() => fake.close());

const failureOf = async (promise: Promise<unknown>) => {
    try {
        await promise;
    } catch (error) {
        if (error instanceof OpenbillError) return error.failure;
        throw error;
    }
    throw new Error('expected a failure');
};

describe('createClient', () => {
    it('renders with the bearer token and JSON', async () => {
        const client = createClient({ url: fake.url, token: '1|openbill_test' });

        const result = await client.render(renderRequest('01kfjord', { kind: 'scenario', key: 'long_invoice', locale: 'de' }, { body: '<h1>Fjord</h1>' }));

        expect(result.body).toBe(SAMPLE_RESULT.body);
        expect(fake.requests[0].headers.authorization).toBe('Bearer 1|openbill_test');
        expect(fake.requests[0].headers['content-type']).toBe('application/json');
        expect(JSON.parse(fake.requests[0].body)).toEqual({ template_id: '01kfjord', template: { body: '<h1>Fjord</h1>' }, scenario: 'long_invoice', locale: 'de' });
    });

    it('renders a document by id', () => {
        expect(renderRequest('01kfjord', { kind: 'document', id: '01kdoc' }, {})).toEqual({ template_id: '01kfjord', template: {}, document_id: '01kdoc' });
    });

    it('explains a revoked token', async () => {
        fake.on('POST', '/api/render', () => ({ status: 401, json: { status: 401, title: 'Unauthorized', detail: 'Unauthenticated.', reason: 'unauthenticated' } }));

        const failure = await failureOf(createClient({ url: fake.url, token: '1|gone' }).render(renderRequest('01k', { kind: 'document', id: '01kdoc' }, {})));

        expect(failure.kind).toBe('unauthorized');
        expect(failure.message).toContain('download the toolkit again');
    });

    it('lists the violations of a 422', async () => {
        fake.on('PUT', '/api/templates/01kfjord/files', () => ({
            status: 422,
            json: { status: 422, title: 'Unprocessable', detail: 'The manifest is invalid.', reason: 'validation_failed', violations: [{ path: 'manifest.version', message: 'Use a version like 1.0.0.' }] },
        }));

        const failure = await failureOf(createClient({ url: fake.url, token: '1|x' }).putFiles('01kfjord', { header: '', body: '', footer: '', css: '', manifest: {}, assets: {} }));

        expect(failure).toEqual({ kind: 'validation', status: 422, message: 'The manifest is invalid.', details: ['manifest.version: Use a version like 1.0.0.'] });
    });

    it('reads the package ZIP as bytes', async () => {
        fake.on('GET', '/api/templates/01kfjord/package', () => ({ body: new Uint8Array([80, 75, 3, 4]), contentType: 'application/zip' }));

        expect([...(await createClient({ url: fake.url, token: '1|x' }).packageZip('01kfjord'))]).toEqual([80, 75, 3, 4]);
    });

    it('says when the instance cannot be reached', async () => {
        const url = fake.url;
        await fake.close();

        const failure = await failureOf(createClient({ url, token: '1|x' }).sources());

        expect(failure.kind).toBe('network');
        expect(failure.message).toContain(`Cannot reach ${url}`);
        fake = await startFakeOpenbill(); // afterEach closes it again
    });
});

describe('describeFailure', () => {
    it.each([
        [403, { detail: 'This token is missing the rule template-write.' }, 'forbidden', 'writes only its own template'],
        [404, null, 'not_found', 'OPENBILL_TEMPLATE_ID'],
        [409, { reason: 'template_built_in', detail: 'x' }, 'conflict', 'Duplicate it in openbill'],
        [413, { detail: 'The request is too large.' }, 'too_large', 'The request is too large.'],
        [503, { detail: 'Gotenberg is down.' }, 'server', 'openbill answered 503: Gotenberg is down.'],
    ] as const)('%i → %s', (status, problem, kind, text) => {
        const failure = describeFailure(status, problem, 'https://openbill.example/api/templates/01k/files');

        expect(failure.kind).toBe(kind);
        expect(failure.message).toContain(text);
    });
});

describe('networkFailure', () => {
    it('points to --use-system-ca when Node does not trust the certificate', () => {
        const cause = Object.assign(new TypeError('fetch failed'), { cause: { code: 'SELF_SIGNED_CERT_IN_CHAIN' } });

        expect(networkFailure('https://openbill.ddev.site/api/render', cause).message).toContain('NODE_OPTIONS=--use-system-ca');
    });
});
```

- [ ] **Step 3: Tests laufen lassen**

Run: `ddev exec pnpm --filter @openbill/template-kit exec vitest run src/tooling/client.test.ts`
Expected: FAIL mit `Failed to resolve import "./client"`

- [ ] **Step 4: `client.ts` schreiben**

`packages/template-kit/src/tooling/client.ts`:

```ts
import type { KitError, RenderResult, RenderSchema, RenderSources, Source, TemplateManifest } from '../shared/protocol';
import type { Part } from './template-files';

/** Problem Details of openbill (App\Support\Problem). */
export type Problem = { status?: number; title?: string; detail?: string; reason?: string; violations?: { path: string; message: string }[] };
export type RenderRequest = {
    template_id: string;
    template: Partial<Record<Part, string>> & { manifest?: TemplateManifest };
    scenario?: string;
    locale?: string;
    document_id?: string;
};
export type FilesBody = Record<Part, string> & { manifest: TemplateManifest; assets: Record<string, string> };
export type SavedTemplate = { id: string; name: string; version: string; assets: { path: string; size: number }[] };

export class OpenbillError extends Error {
    constructor(readonly failure: KitError) {
        super(failure.message);
        this.name = 'OpenbillError';
    }
}

export type OpenbillClient = {
    render(body: RenderRequest, signal?: AbortSignal): Promise<RenderResult>;
    sources(): Promise<RenderSources>;
    schema(): Promise<RenderSchema>;
    putFiles(templateId: string, body: FilesBody): Promise<SavedTemplate>;
    packageZip(templateId: string): Promise<Uint8Array>;
};

/** Body of POST /api/render: the local parts over the saved template, rendered with a document or a sample scenario. */
export function renderRequest(templateId: string, source: Source, template: RenderRequest['template']): RenderRequest {
    return source.kind === 'document'
        ? { template_id: templateId, template, document_id: source.id }
        : { template_id: templateId, template, scenario: source.key, locale: source.locale };
}

/** A readable explanation of an answer ≥ 400. */
export function describeFailure(status: number, problem: Problem | null, url: string): KitError {
    const detail = problem?.detail || problem?.title || '';
    const details = (problem?.violations ?? []).map((violation) => `${violation.path}: ${violation.message}`);
    if (status === 401) {
        return { kind: 'unauthorized', status, message: 'openbill refused the token (401): it was revoked or is wrong. Download the toolkit again in the template editor, or put a new token into .env.local.', details };
    }
    if (status === 403) {
        return { kind: 'forbidden', status, message: 'The token may not do this (403). A toolkit token previews documents and writes only its own template (OPENBILL_TEMPLATE_ID).', details: detail ? [detail] : details };
    }
    if (status === 404) {
        return { kind: 'not_found', status, message: `Not found (404): ${url}. Is OPENBILL_TEMPLATE_ID right, and does the template still exist?`, details };
    }
    if (status === 409) {
        const message = problem?.reason === 'template_built_in' ? 'Built-in templates are read-only. Duplicate it in openbill and download the toolkit of the copy.' : detail || 'openbill refused the change (409).';
        return { kind: 'conflict', status, message, details };
    }
    if (status === 413) return { kind: 'too_large', status, message: detail || 'The request is too large for openbill (413). Make the assets smaller.', details };
    if (status === 422) return { kind: 'validation', status, message: detail || 'openbill refused the input (422).', details };
    return { kind: 'server', status, message: `openbill answered ${status}${detail ? `: ${detail}` : ''}.`, details };
}

export function networkFailure(url: string, cause: unknown): KitError {
    const origin = new URL(url).origin;
    const nested = (cause as { cause?: { code?: unknown } } | null)?.cause?.code;
    const code = typeof nested === 'string' ? nested : cause instanceof Error ? cause.message : String(cause);
    if (/CERT|SELF_SIGNED|UNABLE_TO_VERIFY/.test(code)) {
        return { kind: 'network', status: null, message: `Node does not trust the certificate of ${origin} (${code}). For a local instance with its own CA (DDEV, mkcert) start with NODE_OPTIONS=--use-system-ca.`, details: [] };
    }
    return { kind: 'network', status: null, message: `Cannot reach ${origin} (${code}). Is openbill running and OPENBILL_URL right? Without the instance there is no preview.`, details: [] };
}

export function createClient(env: { url: string; token: string }, fetchImpl: typeof fetch = fetch): OpenbillClient {
    const call = async (method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<Response> => {
        const url = `${env.url}${path}`;
        let response: Response;
        try {
            response = await fetchImpl(url, {
                method,
                signal,
                headers: { Authorization: `Bearer ${env.token}`, Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
                body: body === undefined ? undefined : JSON.stringify(body),
            });
        } catch (error) {
            if (signal?.aborted) throw error;
            throw new OpenbillError(networkFailure(url, error));
        }
        if (!response.ok) {
            let problem: Problem | null = null;
            try {
                problem = (await response.json()) as Problem;
            } catch {
                problem = null;
            }
            throw new OpenbillError(describeFailure(response.status, problem, url));
        }
        return response;
    };
    const json = async <T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> => (await (await call(method, path, body, signal)).json()) as T;
    const templatePath = (id: string) => `/api/templates/${encodeURIComponent(id)}`;

    return {
        render: (body, signal) => json<RenderResult>('POST', '/api/render', body, signal),
        sources: () => json<RenderSources>('GET', '/api/render/sources'),
        schema: () => json<RenderSchema>('GET', '/api/render/schema'),
        putFiles: (id, body) => json<SavedTemplate>('PUT', `${templatePath(id)}/files`, body),
        packageZip: async (id) => new Uint8Array(await (await call('GET', `${templatePath(id)}/package`)).arrayBuffer()),
    };
}
```

- [ ] **Step 5: Tests laufen lassen**

Run: `ddev exec pnpm --filter @openbill/template-kit exec vitest run src/tooling/client.test.ts`
Expected: PASS. Falls `failure.message` im Netzwerk-Test `Cannot reach http://127.0.0.1:<port> (fetch failed)` statt `(ECONNREFUSED)` zeigt: in Ordnung, der Test prüft nur den Anfang. Falls undici den Code unter `cause.cause` verpackt, `networkFailure` um einen Zugriff `cause.cause.cause?.code` erweitern und im Test sichtbar halten.

- [ ] **Step 6: Typen prüfen und committen**

Run: `ddev exec pnpm --filter @openbill/template-kit typecheck`
Expected: Exit 0

```bash
git add packages/template-kit/src/tooling
git commit -m "feat(toolkit): openbill API client with readable failures" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Render-Laufzeit (Entprellen, neueste gewinnt, Ausschnitte)

**Files:**
- Create: `packages/template-kit/src/tooling/runtime.ts`, `packages/template-kit/src/tooling/runtime.test.ts`

**Interfaces:**
- Consumes: `createClient`, `renderRequest`, `OpenbillError`, `OpenbillClient` (Task 2); `readTemplate`, `excerpt`, `PART_FILES`, `MANIFEST_FILE`, `TEMPLATE_DIR`, `LocalTemplate` (Task 1); `KitEnv` (Task 1); Typen aus `protocol.ts`.
- Produces: `createRuntime(options: RuntimeOptions): KitRuntime` mit `RuntimeOptions = { root: string; env: KitEnv; client: OpenbillClient; send(event: RenderEvent): void; debounceMs?: number; log?(message: string): void }` und `KitRuntime = { state(): Promise<KitState>; setSource(source: Source): Promise<RenderEvent>; fileChanged(file: string): void; render(): Promise<RenderEvent>; dispose(): void }`; `defaultSource(sources: RenderSources | null): Source`.

- [ ] **Step 1: Failing Tests schreiben**

`packages/template-kit/src/tooling/runtime.test.ts`:

```ts
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RenderEvent } from '../shared/protocol';
import { createClient } from './client';
import { createRuntime, defaultSource, type KitRuntime } from './runtime';
import { SAMPLE_RESULT, SAMPLE_SOURCES, startFakeOpenbill, type FakeOpenbill } from './test-support/fake-openbill';

const MANIFEST = '{"name":"Fjord Brief","version":"1.0.0"}';

let fake: FakeOpenbill;
let root: string;
let events: RenderEvent[];
let runtime: KitRuntime;

function write(name: string, contents: string): string {
    const file = path.join(root, 'template', name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, contents);
    return file;
}

const renders = () => fake.requests.filter((request) => request.path === '/api/render');
const lastBody = () => JSON.parse(renders().at(-1)?.body ?? '{}') as Record<string, any>;

beforeEach(async () => {
    fake = await startFakeOpenbill();
    root = mkdtempSync(path.join(tmpdir(), 'kit-runtime-'));
    write('manifest.json', MANIFEST);
    write('template.liquid', '<h1>{{ document.number }}</h1>');
    events = [];
    const env = { url: fake.url, token: '1|openbill_test', templateId: '01kfjord' };
    runtime = createRuntime({ root, env, client: createClient(env), send: (event) => events.push(event), debounceMs: 10 });
});

afterEach(async () => {
    runtime.dispose();
    await fake.close();
});

describe('createRuntime', () => {
    it('renders the local files once after several quick changes and sends one event', async () => {
        await runtime.state(); // first render with the default source
        events.length = 0;
        fake.requests.length = 0;

        const file = write('template.liquid', '<h1>v1</h1>');
        runtime.fileChanged(file);
        write('template.liquid', '<h1>v2</h1>');
        runtime.fileChanged(file);
        runtime.fileChanged(file);

        await vi.waitFor(() => expect(events).toHaveLength(1));
        expect(renders()).toHaveLength(1);
        expect(lastBody()).toEqual({
            template_id: '01kfjord',
            template: { header: '', body: '<h1>v2</h1>', footer: '', css: '', manifest: { name: 'Fjord Brief', version: '1.0.0' } },
            document_id: SAMPLE_SOURCES.documents[0].id,
        });
        expect(events[0]).toMatchObject({ result: SAMPLE_RESULT, errors: [], failure: null, notice: null, manifest: { name: 'Fjord Brief' } });
    });

    it('ignores files outside template/', async () => {
        runtime.fileChanged(path.join(root, 'README.md'));
        runtime.fileChanged(path.join(root, 'template-old', 'template.liquid'));

        await new Promise((resolve) => setTimeout(resolve, 60));
        expect(renders()).toHaveLength(0);
    });

    it('reports a broken manifest.json with its line and does not ask openbill', async () => {
        runtime.fileChanged(write('manifest.json', '{\n  "name": "Fjord Brief",\n}'));

        await vi.waitFor(() => expect(events).toHaveLength(1));
        expect(renders()).toHaveLength(0);
        expect(events[0].failure).toMatchObject({ kind: 'manifest', details: ['manifest.json:3'] });
    });

    it('adds lines of the local file to template errors and keeps showing the last good result', async () => {
        await runtime.render();
        fake.on('POST', '/api/render', () => ({ json: { ...SAMPLE_RESULT, body: '', errors: [{ part: 'body', file: 'template.liquid', line: 2, message: 'Unknown filter nope' }] } }));

        runtime.fileChanged(write('template.liquid', '<h1>Fjord</h1>\n{{ document.number | nope }}\n<p>end</p>'));

        await vi.waitFor(() => expect(events).toHaveLength(2));
        expect(events[1].result?.body).toBe(SAMPLE_RESULT.body);
        expect(events[1].errors[0].excerpt).toEqual([
            { line: 1, text: '<h1>Fjord</h1>' },
            { line: 2, text: '{{ document.number | nope }}' },
            { line: 3, text: '<p>end</p>' },
        ]);
    });

    it('turns a refused token into a failure and keeps the last good result', async () => {
        await runtime.render();
        fake.on('POST', '/api/render', () => ({ status: 401, json: { status: 401, title: 'Unauthorized', detail: 'Unauthenticated.' } }));

        const event = await runtime.render();

        expect(event.failure?.kind).toBe('unauthorized');
        expect(event.result).toMatchObject(SAMPLE_RESULT);
    });

    it('never lets an older, slower answer overwrite a newer one', async () => {
        let call = 0;
        fake.on('POST', '/api/render', () => {
            call++;
            return call === 1 ? { json: { ...SAMPLE_RESULT, body: '<p>old</p>' }, delayMs: 300 } : { json: { ...SAMPLE_RESULT, body: '<p>new</p>' } };
        });

        const slow = runtime.render();
        await vi.waitFor(() => expect(renders()).toHaveLength(1));
        const fast = await runtime.render();
        await slow;

        expect(fast.result?.body).toBe('<p>new</p>');
        expect(events.map((event) => event.result?.body)).toEqual(['<p>new</p>']);
    });

    it('notes changed assets (the preview uses the saved ones until push)', async () => {
        runtime.fileChanged(write('assets/logo.svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>'));

        await vi.waitFor(() => expect(events).toHaveLength(1));
        expect(events[0].notice).toBe('assets_changed');
    });

    it('renders a chosen scenario in the chosen language', async () => {
        const event = await runtime.setSource({ kind: 'scenario', key: 'long_invoice', locale: 'de' });

        expect(event.source).toEqual({ kind: 'scenario', key: 'long_invoice', locale: 'de' });
        expect(lastBody()).toMatchObject({ scenario: 'long_invoice', locale: 'de' });
    });

    it('loads sources and schema once and renders once for the first state', async () => {
        const first = await runtime.state();
        const second = await runtime.state();

        expect(fake.requests.filter((request) => request.path === '/api/render/sources')).toHaveLength(1);
        expect(renders()).toHaveLength(1);
        expect(second.event?.seq).toBe(first.event?.seq);
        expect(second).toMatchObject({ instance: fake.url, templateId: '01kfjord', failure: null, sources: SAMPLE_SOURCES });
    });
});

describe('defaultSource', () => {
    it('takes the newest document, else the long sample invoice', () => {
        expect(defaultSource(SAMPLE_SOURCES)).toEqual({ kind: 'document', id: SAMPLE_SOURCES.documents[0].id });
        expect(defaultSource({ scenarios: [], documents: [] })).toEqual({ kind: 'scenario', key: 'long_invoice', locale: 'en' });
        expect(defaultSource(null)).toEqual({ kind: 'scenario', key: 'long_invoice', locale: 'en' });
    });
});
```

- [ ] **Step 2: Tests laufen lassen**

Run: `ddev exec pnpm --filter @openbill/template-kit exec vitest run src/tooling/runtime.test.ts`
Expected: FAIL mit `Failed to resolve import "./runtime"`

- [ ] **Step 3: `runtime.ts` schreiben**

`packages/template-kit/src/tooling/runtime.ts`:

```ts
import path from 'node:path';
import type { KitError, KitState, RenderErrorItem, RenderEvent, RenderResult, RenderSchema, RenderSources, Source } from '../shared/protocol';
import { OpenbillError, renderRequest, type OpenbillClient } from './client';
import type { KitEnv } from './env';
import { excerpt, MANIFEST_FILE, PART_FILES, readTemplate, TEMPLATE_DIR, type LocalTemplate } from './template-files';

export type RuntimeOptions = {
    root: string;
    env: KitEnv;
    client: OpenbillClient;
    /** Pushes an event to every open preview (HMR event openbill:render). */
    send(event: RenderEvent): void;
    debounceMs?: number;
    log?(message: string): void;
};

export type KitRuntime = {
    /** Sources, schema and the newest event; loads them (and renders once) on the first call. */
    state(): Promise<KitState>;
    setSource(source: Source): Promise<RenderEvent>;
    /** A file changed somewhere below the kit; only template/ counts. */
    fileChanged(file: string): void;
    render(): Promise<RenderEvent>;
    dispose(): void;
};

/** Like the template editor: the newest document, else the long sample invoice (several pages). */
export function defaultSource(sources: RenderSources | null): Source {
    const [latest] = sources?.documents ?? [];
    return latest ? { kind: 'document', id: latest.id } : { kind: 'scenario', key: 'long_invoice', locale: 'en' };
}

function failureOf(error: unknown): KitError {
    if (error instanceof OpenbillError) return error.failure;
    return { kind: 'server', status: null, message: error instanceof Error ? error.message : String(error), details: [] };
}

function withExcerpts(errors: RenderErrorItem[], local: LocalTemplate): RenderErrorItem[] {
    const sources: Record<string, string> = {
        [PART_FILES.header]: local.parts.header,
        [PART_FILES.body]: local.parts.body,
        [PART_FILES.footer]: local.parts.footer,
        [PART_FILES.css]: local.parts.css,
        [MANIFEST_FILE]: local.manifestText,
    };
    return errors.map((error) => (error.file && error.line && sources[error.file] !== undefined ? { ...error, excerpt: excerpt(sources[error.file], error.line) } : error));
}

/**
 * Renders the local template on the instance (POST /api/render) whenever a file in template/ changes: debounced,
 * newest wins (an older request is aborted and never overwrites a newer answer), template errors with lines of the
 * local file. The preview keeps the newest result without template errors.
 */
export function createRuntime({ root, env, client, send, debounceMs = 80, log = () => undefined }: RuntimeOptions): KitRuntime {
    const templateDir = path.join(root, TEMPLATE_DIR);
    let source: Source | null = null;
    let sources: RenderSources | null = null;
    let schema: RenderSchema | null = null;
    let lookupFailure: KitError | null = null;
    let lookups: Promise<void> | null = null;
    let last: RenderEvent | null = null;
    let lastGood: RenderResult | null = null;
    let seq = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let running: AbortController | null = null;
    let assetsChanged = false;

    const loadLookups = (): Promise<void> =>
        (lookups ??= Promise.all([client.sources(), client.schema()]).then(
            ([loadedSources, loadedSchema]) => {
                sources = loadedSources;
                schema = loadedSchema;
                lookupFailure = null;
            },
            (error: unknown) => {
                lookupFailure = failureOf(error);
                lookups = null; // ask again with the next state request
            },
        ));

    const render = async (): Promise<RenderEvent> => {
        clearTimeout(timer);
        running?.abort();
        const controller = new AbortController();
        running = controller;
        const id = ++seq;
        if (source === null) {
            await loadLookups();
            source ??= defaultSource(sources);
        }
        const current = source;
        const notice: RenderEvent['notice'] = assetsChanged ? 'assets_changed' : null;
        assetsChanged = false;
        const local = await readTemplate(templateDir);
        const make = (fields: Pick<RenderEvent, 'manifest' | 'result' | 'errors' | 'failure'>): RenderEvent => ({ seq: id, at: new Date().toISOString(), source: current, notice, ...fields });

        let event: RenderEvent;
        if (local.manifest === null) {
            const problem = local.manifestProblem;
            event = make({
                manifest: last?.manifest ?? null,
                result: lastGood,
                errors: [],
                failure: { kind: 'manifest', status: null, message: problem?.message ?? 'manifest.json is broken.', details: problem?.line ? [`${MANIFEST_FILE}:${problem.line}`] : [] },
            });
        } else {
            try {
                const result = await client.render(renderRequest(env.templateId, current, { ...local.parts, manifest: local.manifest }), controller.signal);
                const errors = withExcerpts(result.errors, local);
                if (errors.length === 0) lastGood = result;
                event = make({ manifest: local.manifest, result: errors.length === 0 ? result : (lastGood ?? result), errors, failure: null });
            } catch (error) {
                event = make({ manifest: local.manifest, result: lastGood, errors: [], failure: failureOf(error) });
            }
        }

        // a newer render started meanwhile: it sends its own event, this one must never overwrite it
        if (id !== seq) return event;
        running = null;
        last = event;
        send(event);
        log(event.failure ? event.failure.message : event.errors.length > 0 ? `${event.errors.length} template error(s)` : 'rendered');
        return event;
    };

    return {
        state: async () => {
            await loadLookups();
            if (last === null) await render();
            return { instance: env.url, templateId: env.templateId, event: last, sources, schema, failure: lookupFailure };
        },
        setSource: async (next) => {
            source = next;
            return render();
        },
        fileChanged: (file) => {
            const relative = path.relative(templateDir, path.resolve(file));
            if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) return;
            if (relative.split(path.sep)[0] === 'assets') assetsChanged = true;
            clearTimeout(timer);
            timer = setTimeout(() => void render(), debounceMs);
        },
        render,
        dispose: () => {
            clearTimeout(timer);
            running?.abort();
        },
    };
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `ddev exec pnpm --filter @openbill/template-kit exec vitest run src/tooling/runtime.test.ts`
Expected: PASS (10 Tests). Falls „never lets an older …“ flackert, weil der erste Request beim `abort()` noch nicht beim Fake angekommen ist: Der Test wartet mit `vi.waitFor` auf genau einen Render-Request – nicht entfernen, nicht durch `sleep` ersetzen.

- [ ] **Step 5: Typen prüfen und committen**

Run: `ddev exec pnpm --filter @openbill/template-kit typecheck`
Expected: Exit 0

```bash
git add packages/template-kit/src/tooling/runtime.ts packages/template-kit/src/tooling/runtime.test.ts
git commit -m "feat(toolkit): render runtime – debounced, newest wins, error excerpts" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 4: Vite-Plugin `openbill-render`

**Files:**
- Create: `packages/template-kit/src/tooling/plugin.ts`, `packages/template-kit/src/tooling/plugin.test.ts`

**Interfaces:**
- Consumes: `createRuntime`, `KitRuntime` (Task 3), `createClient` (Task 2), `readKitEnv`, `KitConfigError`, `KitEnv` (Task 1), `TEMPLATE_DIR` (Task 1), `KIT_API`, `RENDER_EVENT`, `KitState`, `Source` (Task 1).
- Produces: `openbillRender(options?: { root?: string; env?: KitEnv; fetch?: typeof fetch; debounceMs?: number }): Plugin` (nur `serve`); `BRIDGE_ID = '/@openbill/bridge.js'`; `isLocalHost(host: string | undefined, allowed: true | string[] | undefined): boolean`; `isSource(value: unknown): value is Source`. Endpunkte für die Seite (Task 7/8): `GET /__openbill/state` → `KitState`, `POST /__openbill/source` (JSON `Source`) → `RenderEvent`. Window-Event `openbill:render` (`detail: RenderEvent`) und `window.__openbillLive = true` aus der Bridge.

- [ ] **Step 1: Failing Tests schreiben**

`packages/template-kit/src/tooling/plugin.test.ts`:

```ts
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer, type ViteDevServer } from 'vite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BRIDGE_ID, isLocalHost, isSource, openbillRender } from './plugin';
import { startFakeOpenbill, type FakeOpenbill } from './test-support/fake-openbill';

type Payload = { type: string; event?: string; data?: any };

let fake: FakeOpenbill;
let server: ViteDevServer;
let root: string;
let port: number;
let sent: Payload[];

function raw(options: { path: string; method?: string; headers?: Record<string, string>; body?: string }): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
        const req = request({ host: '127.0.0.1', port, path: options.path, method: options.method ?? 'GET', headers: options.headers }, (res) => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', (chunk: string) => (body += chunk));
            res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
        });
        req.on('error', reject);
        req.end(options.body);
    });
}

beforeEach(async () => {
    fake = await startFakeOpenbill();
    root = mkdtempSync(path.join(tmpdir(), 'kit-plugin-'));
    mkdirSync(path.join(root, 'template'));
    writeFileSync(path.join(root, 'template', 'manifest.json'), '{"name":"Fjord Brief","version":"1.0.0"}');
    writeFileSync(path.join(root, 'template', 'template.liquid'), '<h1>Fjord v1</h1>');
    writeFileSync(path.join(root, '.env.local'), 'OPENBILL_TOKEN="1|openbill_secret_in_file"\n');
    writeFileSync(path.join(root, 'index.html'), '<!doctype html><html><head></head><body><div id="root"></div></body></html>');
    sent = [];
    server = await createServer({
        root,
        configFile: false,
        logLevel: 'silent',
        clearScreen: false,
        optimizeDeps: { noDiscovery: true, include: [] },
        server: { host: '127.0.0.1', port: 0 },
        plugins: [openbillRender({ env: { url: fake.url, token: '1|openbill_test', templateId: '01kfjord' }, debounceMs: 20 })],
    });
    // every way Vite talks to the page: the plugin's custom events and Vite's own full reloads
    const record = ((payload: Payload) => void sent.push(payload)) as never;
    vi.spyOn(server.ws, 'send').mockImplementation(record);
    if ((server.environments.client.hot as unknown) !== server.ws) vi.spyOn(server.environments.client.hot, 'send').mockImplementation(record);
    await server.listen();
    port = (server.httpServer?.address() as AddressInfo).port;
});

afterEach(async () => {
    await server.close();
    await fake.close();
    vi.restoreAllMocks();
});

const renderEvents = () => sent.filter((payload) => payload.type === 'custom' && payload.event === 'openbill:render');
const renderBodies = () => fake.requests.filter((r) => r.path === '/api/render').map((r) => (JSON.parse(r.body) as { template: { body: string } }).template.body);

/** chokidar needs a moment after the start: write again until the change has been rendered. */
async function writeUntil(file: string, contents: string, done: () => boolean): Promise<void> {
    for (let attempt = 0; attempt < 40; attempt++) {
        writeFileSync(file, contents);
        await new Promise((resolve) => setTimeout(resolve, 250));
        if (done()) return;
    }
    throw new Error(`no render after writing ${file}`);
}

describe('openbillRender', () => {
    it('renders on a change in template/ and sends openbill:render – never a full reload', async () => {
        await writeUntil(path.join(root, 'template', 'template.liquid'), '<h1>Fjord v2</h1>', () => renderBodies().includes('<h1>Fjord v2</h1>') && renderEvents().length > 0);

        expect(renderEvents().at(-1)?.data).toMatchObject({ failure: null, errors: [], manifest: { name: 'Fjord Brief' }, source: { kind: 'document' } });
        expect(fake.requests.find((r) => r.path === '/api/render')?.headers.authorization).toBe('Bearer 1|openbill_test');
        expect(sent.filter((payload) => payload.type === 'full-reload')).toEqual([]);
    });

    it('answers the page with sources, schema and the first render – never with the token', async () => {
        const response = await raw({ path: '/__openbill/state' });

        expect(response.status).toBe(200);
        expect(JSON.parse(response.body)).toMatchObject({
            instance: fake.url,
            templateId: '01kfjord',
            failure: null,
            sources: { documents: [{ customer_name: 'Hafenkontor Lindqvist' }] },
            event: { result: { body: '<p>Rechnung</p>' } },
        });
        expect(response.body).not.toContain('openbill_test');
    });

    it('switches the source on POST /source, JSON only', async () => {
        const json = await raw({ path: '/__openbill/source', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'scenario', key: 'short_invoice', locale: 'de' }) });

        expect(json.status).toBe(200);
        expect(JSON.parse(fake.requests.filter((r) => r.path === '/api/render').at(-1)?.body ?? '{}')).toMatchObject({ scenario: 'short_invoice', locale: 'de' });
        expect((await raw({ path: '/__openbill/source', method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{"kind":"document","id":"01k"}' })).status).toBe(415);
        expect((await raw({ path: '/__openbill/source', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"kind":"other"}' })).status).toBe(422);
    });

    it('refuses other hosts (DNS rebinding) and never serves .env.local', async () => {
        const foreign = await raw({ path: '/__openbill/state', headers: { Host: 'openbill-rebind.example:5180' } });
        expect(foreign.status).toBe(403);
        expect(foreign.body).not.toContain('Hafenkontor');

        const env = await raw({ path: '/.env.local' });
        expect(env.status).not.toBe(200);
        expect(env.body).not.toContain('openbill_secret_in_file');
    });

    it('injects the bridge module, and Vite gives it a hot context', async () => {
        const html = await server.transformIndexHtml('/', '<!doctype html><html><head></head><body></body></html>');
        expect(html).toContain(`src="${BRIDGE_ID}"`);

        const bridge = await raw({ path: BRIDGE_ID });
        expect(bridge.status).toBe(200);
        expect(bridge.body).toContain('createHotContext');
        expect(bridge.body).toContain('openbill:render');
    });
});

describe('isLocalHost', () => {
    it.each([
        ['localhost:5180', undefined, true],
        ['127.0.0.1:5180', undefined, true],
        ['[::1]:5180', undefined, true],
        ['kit.localhost', undefined, true],
        ['openbill-rebind.example', undefined, false],
        [undefined, undefined, false],
        ['laptop.example', ['laptop.example'], true],
        ['a.dev.example', ['.dev.example'], true],
        ['anything.example', true, true],
    ] as const)('%s with %s → %s', (host, allowed, expected) => {
        expect(isLocalHost(host, allowed as true | string[] | undefined)).toBe(expected);
    });
});

describe('isSource', () => {
    it('accepts scenarios with a language and documents with an id', () => {
        expect(isSource({ kind: 'scenario', key: 'long_invoice', locale: 'de' })).toBe(true);
        expect(isSource({ kind: 'document', id: '01kdoc' })).toBe(true);
        expect(isSource({ kind: 'scenario', key: 'long_invoice', locale: 'fr' })).toBe(false);
        expect(isSource({ kind: 'document', id: '' })).toBe(false);
        expect(isSource(null)).toBe(false);
    });
});
```

- [ ] **Step 2: Tests laufen lassen**

Run: `ddev exec pnpm --filter @openbill/template-kit exec vitest run src/tooling/plugin.test.ts`
Expected: FAIL mit `Failed to resolve import "./plugin"`

- [ ] **Step 3: `plugin.ts` schreiben**

`packages/template-kit/src/tooling/plugin.ts`:

```ts
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import type { Connect, Plugin, ViteDevServer } from 'vite';
import { KIT_API, RENDER_EVENT, type KitState, type Source } from '../shared/protocol';
import { createClient } from './client';
import { KitConfigError, readKitEnv, type KitEnv } from './env';
import { createRuntime, type KitRuntime } from './runtime';
import { TEMPLATE_DIR } from './template-files';

export type OpenbillRenderOptions = {
    /** Kit folder with template/ and .env.local; default: Vite's root. */
    root?: string;
    /** Instead of .env.local (tests). */
    env?: KitEnv;
    fetch?: typeof fetch;
    debounceMs?: number;
};

/** Virtual module injected into index.html: HMR events -> window events of the prebuilt page (no import.meta.hot there). */
export const BRIDGE_ID = '/@openbill/bridge.js';
const RESOLVED_BRIDGE = '\0openbill-bridge.js';
const BRIDGE_SOURCE = `// openbill-render: HMR events of the dev server -> window events of the preview page
if (import.meta.hot) {
    window.__openbillLive = true;
    import.meta.hot.on(${JSON.stringify(RENDER_EVENT)}, (data) => window.dispatchEvent(new CustomEvent(${JSON.stringify(RENDER_EVENT)}, { detail: data })));
}
`;

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Only this computer may ask the dev server for renders (they carry real documents): a foreign Host header – DNS
 * rebinding from a web page – gets 403. Vite's own host check runs after this middleware, so it checks itself.
 */
export function isLocalHost(host: string | undefined, allowed: true | string[] | undefined): boolean {
    if (allowed === true) return true;
    const name = (host ?? '').toLowerCase().replace(/:\d+$/, '');
    if (LOCAL_HOSTS.has(name) || name.endsWith('.localhost')) return true;
    return (allowed ?? []).some((entry) => (entry.startsWith('.') ? name === entry.slice(1) || name.endsWith(entry) : name === entry));
}

export function isSource(value: unknown): value is Source {
    if (typeof value !== 'object' || value === null) return false;
    const source = value as Record<string, unknown>;
    if (source.kind === 'document') return typeof source.id === 'string' && source.id !== '';
    return source.kind === 'scenario' && typeof source.key === 'string' && source.key !== '' && (source.locale === 'en' || source.locale === 'de');
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req as AsyncIterable<Buffer>) {
        size += chunk.length;
        if (size > 64 * 1024) throw new Error('body too large');
        chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function configState(error: KitConfigError): KitState {
    return { instance: '', templateId: '', event: null, sources: null, schema: null, failure: { kind: 'config', status: null, message: error.message, details: error.problems } };
}

function kitMiddleware(server: ViteDevServer, runtime: KitRuntime | KitConfigError): Connect.NextHandleFunction {
    return (req, res, next) => {
        void (async () => {
            if (!isLocalHost(req.headers.host, server.config.server.allowedHosts)) {
                return sendJson(res, 403, { message: 'Only this computer (localhost) may use the openbill preview.' });
            }
            const route = `${req.method} ${(req.url ?? '').split('?')[0]}`;
            if (route === 'GET /state') {
                return sendJson(res, 200, runtime instanceof KitConfigError ? configState(runtime) : await runtime.state());
            }
            if (route === 'POST /source') {
                // JSON only: a cross-site form can't send it without a CORS preflight, which nobody answers
                if (!(req.headers['content-type'] ?? '').startsWith('application/json')) return sendJson(res, 415, { message: 'Send JSON.' });
                if (runtime instanceof KitConfigError) return sendJson(res, 409, configState(runtime).failure);
                const body = await readJson(req).catch(() => null);
                if (!isSource(body)) return sendJson(res, 422, { message: 'Unknown source.' });
                return sendJson(res, 200, await runtime.setSource(body));
            }
            next();
        })().catch(next);
    };
}

function isInside(dir: string, file: string): boolean {
    const relative = path.relative(dir, file);
    return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

/**
 * pnpm dev of the template kit: watches template/, renders it on the openbill instance (POST /api/render with the
 * token of .env.local) and sends the result to the page as HMR event "openbill:render". The token never leaves Node.
 */
export function openbillRender(options: OpenbillRenderOptions = {}): Plugin {
    let root = '';

    return {
        name: 'openbill-render',
        apply: 'serve',
        configResolved(config) {
            root = options.root ?? config.root;
        },
        resolveId(id) {
            return id === BRIDGE_ID ? RESOLVED_BRIDGE : undefined;
        },
        load(id) {
            return id === RESOLVED_BRIDGE ? BRIDGE_SOURCE : undefined;
        },
        transformIndexHtml() {
            return [{ tag: 'script', attrs: { type: 'module', src: BRIDGE_ID }, injectTo: 'head-prepend' }];
        },
        configureServer(server) {
            let runtime: KitRuntime | KitConfigError;
            try {
                const env = options.env ?? readKitEnv(root);
                runtime = createRuntime({
                    root,
                    env,
                    client: createClient(env, options.fetch),
                    debounceMs: options.debounceMs,
                    send: (data) => server.ws.send({ type: 'custom', event: RENDER_EVENT, data }),
                    log: (message) => server.config.logger.info(`openbill: ${message}`, { timestamp: true }),
                });
            } catch (error) {
                if (!(error instanceof KitConfigError)) throw error;
                runtime = error;
                server.config.logger.error(`openbill: ${error.message}`);
            }
            server.watcher.add(path.join(root, TEMPLATE_DIR));
            server.watcher.on('all', (_event, file) => {
                if (!(runtime instanceof KitConfigError)) runtime.fileChanged(file);
            });
            server.middlewares.use(KIT_API, kitMiddleware(server, runtime));
            server.httpServer?.once('close', () => {
                if (!(runtime instanceof KitConfigError)) runtime.dispose();
            });
        },
        // template files are no modules: Vite must never reload the page for them (the render event updates it)
        handleHotUpdate({ file }) {
            if (isInside(path.join(root, TEMPLATE_DIR), file)) return [];
        },
    };
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `ddev exec pnpm --filter @openbill/template-kit exec vitest run src/tooling/plugin.test.ts`
Expected: PASS (5 + 9 + 1 Tests). Prüfpunkte, falls etwas scheitert:
- `port: 0` nimmt Vite nicht an → `server: { host: '127.0.0.1', port: 51000 + Math.floor(Math.random() * 1000), strictPort: false }` und den Port wie gehabt aus `httpServer.address()` lesen.
- `bridge.body` enthält kein `createHotContext` → Vite hat `import.meta.hot` im virtuellen Modul nicht ersetzt. Dann statt `\0openbill-bridge.js` die ID `/@openbill/bridge.js` selbst zurückgeben (`resolveId` → `BRIDGE_ID`, `load` prüft `BRIDGE_ID`) und erneut testen; der Test bleibt unverändert.
- `full-reload` taucht auf → `handleHotUpdate` greift nicht; in Vite 8 zusätzlich `hotUpdate({ file }) { if (isInside(…)) return []; }` ergänzen.

- [ ] **Step 5: Typen prüfen und committen**

Run: `ddev exec pnpm --filter @openbill/template-kit typecheck`
Expected: Exit 0

```bash
git add packages/template-kit/src/tooling/plugin.ts packages/template-kit/src/tooling/plugin.test.ts
git commit -m "feat(toolkit): Vite plugin openbill-render with HMR event and local-only endpoints" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: CLI `push`

**Files:**
- Create: `packages/template-kit/src/tooling/push.ts`, `packages/template-kit/src/tooling/push.test.ts`

**Interfaces:**
- Consumes: `OpenbillClient`, `OpenbillError` (Task 2), `KitEnv` (Task 1), `listTemplateFiles`, `parseManifest`, `PART_FILES`, `MANIFEST_FILE`, `TEMPLATE_DIR`, `TemplateProblemError`, `Part` (Task 1).
- Produces: `push(root: string, env: KitEnv, client: OpenbillClient, log: (line: string) => void): Promise<void>` – wirft `TemplateProblemError` (lokal, nichts gesendet) oder `OpenbillError` (Antwort der Instanz).

- [ ] **Step 1: Failing Tests schreiben**

`packages/template-kit/src/tooling/push.test.ts`:

```ts
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createClient, OpenbillError } from './client';
import { push } from './push';
import { LIMITS, TemplateProblemError } from './template-files';
import { startFakeOpenbill, type FakeOpenbill } from './test-support/fake-openbill';

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"></svg>';

let fake: FakeOpenbill;
let root: string;
let lines: string[];

function write(name: string, contents: string | Buffer): void {
    const file = path.join(root, 'template', name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, contents);
}

const env = () => ({ url: fake.url, token: '1|openbill_test', templateId: '01kfjord' });
const run = () => push(root, env(), createClient(env()), (line) => lines.push(line));
const puts = () => fake.requests.filter((request) => request.method === 'PUT');
const failure = async (): Promise<unknown> => run().then(() => null, (error: unknown) => error);

beforeEach(async () => {
    fake = await startFakeOpenbill();
    fake.on('PUT', '/api/templates/01kfjord/files', (request) => ({
        json: { id: '01kfjord', name: 'Fjord Brief', version: '1.1.0', assets: Object.keys((JSON.parse(request.body) as { assets: object }).assets).map((p) => ({ path: p, size: 1 })) },
    }));
    root = mkdtempSync(path.join(tmpdir(), 'kit-push-'));
    write('manifest.json', '{"name":"Fjord Brief","version":"1.1.0"}');
    write('template.liquid', '<h1>{{ document.number }}</h1>');
    write('styles.css', 'h1 { color: #2f55d4; }');
    write('assets/logo.svg', SVG);
    lines = [];
});

afterEach(() => fake.close());

describe('push', () => {
    it('sends every part, the manifest and the complete asset list as base64', async () => {
        await run();

        expect(puts()).toHaveLength(1);
        expect(puts()[0].headers.authorization).toBe('Bearer 1|openbill_test');
        expect(JSON.parse(puts()[0].body)).toEqual({
            header: '',
            body: '<h1>{{ document.number }}</h1>',
            footer: '',
            css: 'h1 { color: #2f55d4; }',
            manifest: { name: 'Fjord Brief', version: '1.1.0' },
            assets: { 'assets/logo.svg': Buffer.from(SVG).toString('base64') },
        });
        expect(lines).toEqual([`Pushed "Fjord Brief" 1.1.0 (1 asset) to ${fake.url}.`]);
    });

    it('checks template/ before sending anything', async () => {
        write('notes.txt', 'todo');
        write('assets/huge.png', Buffer.alloc(LIMITS.assetBytes + 1));
        symlinkSync('/etc/hostname', path.join(root, 'template', 'assets', 'link.svg'));

        const error = await failure();

        expect(error).toBeInstanceOf(TemplateProblemError);
        expect((error as TemplateProblemError).problems).toHaveLength(3);
        expect(puts()).toHaveLength(0);
    });

    it('does not send a broken manifest.json', async () => {
        write('manifest.json', '{"name": "Fjord Brief",}');

        const error = (await failure()) as TemplateProblemError;

        expect(error.problems[0]).toMatch(/^manifest\.json:1: manifest\.json is not valid JSON/);
        expect(puts()).toHaveLength(0);
    });

    it.each([
        [403, { detail: 'This token is missing the rule template-write.' }, 'forbidden'],
        [409, { reason: 'template_built_in', detail: 'Built-in templates cannot be changed.' }, 'conflict'],
        [413, { detail: 'The request is too large.' }, 'too_large'],
        [422, { detail: 'Invalid.', violations: [{ path: 'assets.assets/logo.svg', message: 'The file is not an SVG image.' }] }, 'validation'],
    ] as const)('passes a %i of openbill on as readable failure', async (status, problem, kind) => {
        fake.on('PUT', '/api/templates/01kfjord/files', () => ({ status, json: { status, title: 'Refused', ...problem } }));

        const error = await failure();

        expect(error).toBeInstanceOf(OpenbillError);
        expect((error as OpenbillError).failure.kind).toBe(kind);
    });
});
```

- [ ] **Step 2: Tests laufen lassen**

Run: `ddev exec pnpm --filter @openbill/template-kit exec vitest run src/tooling/push.test.ts`
Expected: FAIL mit `Failed to resolve import "./push"`

- [ ] **Step 3: `push.ts` schreiben**

`packages/template-kit/src/tooling/push.ts`:

```ts
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { OpenbillClient } from './client';
import type { KitEnv } from './env';
import { listTemplateFiles, MANIFEST_FILE, parseManifest, PART_FILES, TEMPLATE_DIR, TemplateProblemError, type Part } from './template-files';

/**
 * pnpm push: PUT /api/templates/{id}/files with the four parts, the manifest and the complete asset list (base64).
 * template/ is checked like the import first; nothing is sent while a problem is left. Only the template of
 * OPENBILL_TEMPLATE_ID – the token may not write any other (openbill answers 403).
 */
export async function push(root: string, env: KitEnv, client: OpenbillClient, log: (line: string) => void): Promise<void> {
    const dir = path.join(root, TEMPLATE_DIR);
    const { entries, problems } = await listTemplateFiles(dir);
    if (problems.length > 0) throw new TemplateProblemError('Nothing was pushed: fix template/ first.', problems);

    const text = async (file: string): Promise<string> => (entries.some((entry) => entry.path === file) ? readFile(path.join(dir, file), 'utf8') : '');
    const { manifest, problem } = parseManifest(await text(MANIFEST_FILE));
    if (manifest === null) {
        throw new TemplateProblemError('Nothing was pushed: manifest.json is broken.', [`${MANIFEST_FILE}${problem?.line ? `:${problem.line}` : ''}: ${problem?.message ?? 'unreadable'}`]);
    }

    const parts = {} as Record<Part, string>;
    for (const part of Object.keys(PART_FILES) as Part[]) parts[part] = await text(PART_FILES[part]);
    const assets: Record<string, string> = {};
    for (const entry of entries) {
        if (entry.path.startsWith('assets/')) assets[entry.path] = (await readFile(entry.absolute)).toString('base64');
    }

    const saved = await client.putFiles(env.templateId, { ...parts, manifest, assets });
    const count = Object.keys(assets).length;
    log(`Pushed "${saved.name}" ${saved.version} (${count} asset${count === 1 ? '' : 's'}) to ${env.url}.`);
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `ddev exec pnpm --filter @openbill/template-kit exec vitest run src/tooling/push.test.ts`
Expected: PASS (7 Tests)

- [ ] **Step 5: Typen prüfen und committen**

Run: `ddev exec pnpm --filter @openbill/template-kit typecheck`
Expected: Exit 0

```bash
git add packages/template-kit/src/tooling/push.ts packages/template-kit/src/tooling/push.test.ts
git commit -m "feat(toolkit): pnpm push with local checks before upload" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: CLI `pull`, `pack` und Einstieg `cli.ts`

**Files:**
- Create: `packages/template-kit/src/tooling/pull.ts`, `packages/template-kit/src/tooling/pull.test.ts`
- Create: `packages/template-kit/src/tooling/pack.ts`, `packages/template-kit/src/tooling/pack.test.ts`
- Create: `packages/template-kit/src/tooling/cli.ts`, `packages/template-kit/src/tooling/cli.test.ts`

**Interfaces:**
- Consumes: `push` (Task 5), `createClient`, `OpenbillError`, `OpenbillClient` (Task 2), `readKitEnv`, `KitConfigError`, `KitEnv` (Task 1), `listTemplateFiles`, `parseManifest`, `isSafePath`, `PART_FILES`, `MANIFEST_FILE`, `TEMPLATE_DIR`, `TemplateProblemError` (Task 1), fflate `zipSync`/`unzipSync`.
- Produces: `pull(root, env, client, { force: boolean; log(line: string): void }): Promise<void>`, `unpackPackage(zip: Uint8Array): Map<string, Uint8Array>`; `pack(root, { out?: string; log(line: string): void }): Promise<string>` (Pfad der ZIP), `slug(name: string): string`; `main(argv: string[], io: Io): Promise<number>` (0 ok, 1 Fehler, 2 Aufruf), `USAGE`, Typ `Io = { root; out(line); err(line); fetch?; environment? }`. `tooling/cli.js` (Task 9) ist der gebaute Einstieg: `node tooling/cli.js push|pull [--force]|pack [--out <file>]`.

- [ ] **Step 1: Failing Tests für `pull` schreiben**

`packages/template-kit/src/tooling/pull.test.ts`:

```ts
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createClient } from './client';
import { pull } from './pull';
import { TemplateProblemError } from './template-files';
import { SAMPLE_SCHEMA, startFakeOpenbill, type FakeOpenbill } from './test-support/fake-openbill';

const SVG = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
const PACKAGE: Record<string, string> = {
    'manifest.json': '{\n    "name": "Fjord Brief",\n    "version": "1.2.0"\n}\n',
    'header.liquid': '<p>Studio Nordlicht</p>',
    'template.liquid': '<h1>v2</h1>',
    'footer.liquid': '',
    'styles.css': '',
    'assets/logo.svg': SVG,
};

let fake: FakeOpenbill;
let root: string;
let lines: string[];

const zip = (files: Record<string, string>) => zipSync(Object.fromEntries(Object.entries(files).map(([name, contents]) => [name, strToU8(contents)])));
const local = (name: string) => path.join(root, 'template', name);
function write(name: string, contents: string): void {
    mkdirSync(path.dirname(local(name)), { recursive: true });
    writeFileSync(local(name), contents);
}
const run = (force: boolean) => {
    const env = { url: fake.url, token: '1|openbill_test', templateId: '01kfjord' };
    return pull(root, env, createClient(env), { force, log: (line) => lines.push(line) });
};

beforeEach(async () => {
    fake = await startFakeOpenbill();
    fake.on('GET', '/api/templates/01kfjord/package', () => ({ body: zip(PACKAGE), contentType: 'application/zip' }));
    root = mkdtempSync(path.join(tmpdir(), 'kit-pull-'));
    lines = [];
});

afterEach(() => fake.close());

describe('pull', () => {
    it('fetches the template into a fresh kit and the field schema into schema.json', async () => {
        await run(false);

        expect(readFileSync(local('template.liquid'), 'utf8')).toBe('<h1>v2</h1>');
        expect(readFileSync(local('assets/logo.svg'), 'utf8')).toBe(SVG);
        expect(JSON.parse(readFileSync(path.join(root, 'schema.json'), 'utf8'))).toEqual(SAMPLE_SCHEMA);
        expect(lines).toEqual(['Pulled 6 files into template/ and the field schema into schema.json.']);
    });

    it('stops when local files differ and overwrites them only with --force', async () => {
        write('manifest.json', PACKAGE['manifest.json']);
        write('template.liquid', '<h1>my local work</h1>');
        write('assets/old.png', 'png');

        const error = await run(false).then(() => null, (e: unknown) => e);

        expect(error).toBeInstanceOf(TemplateProblemError);
        expect((error as TemplateProblemError).problems).toEqual(['assets/old.png', 'template.liquid']);
        expect(readFileSync(local('template.liquid'), 'utf8')).toBe('<h1>my local work</h1>');

        await run(true);

        expect(readFileSync(local('template.liquid'), 'utf8')).toBe('<h1>v2</h1>');
        expect(existsSync(local('assets/old.png'))).toBe(false);
    });

    it('refuses a package with unsafe or unknown paths and writes nothing', async () => {
        fake.on('GET', '/api/templates/01kfjord/package', () => ({ body: zip({ ...PACKAGE, '../evil.liquid': 'x', 'notes.txt': 'x' }), contentType: 'application/zip' }));

        const error = await run(true).then(() => null, (e: unknown) => e);

        expect((error as TemplateProblemError).problems).toEqual(['../evil.liquid: not written (unsafe or unknown path).', 'notes.txt: not written (unsafe or unknown path).']);
        expect(existsSync(path.join(root, 'template'))).toBe(false);
        expect(existsSync(path.join(root, 'evil.liquid'))).toBe(false);
    });
});
```

- [ ] **Step 2: Failing Tests für `pack` schreiben**

`packages/template-kit/src/tooling/pack.test.ts`:

```ts
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { unzipSync } from 'fflate';
import { beforeEach, describe, expect, it } from 'vitest';
import { pack, slug } from './pack';
import { TemplateProblemError } from './template-files';

let root: string;
let lines: string[];

function write(name: string, contents: string): void {
    const file = path.join(root, 'template', name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, contents);
}

const log = (line: string) => lines.push(line);
const zips = () => readdirSync(root).filter((name) => name.endsWith('.zip'));

beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'kit-pack-'));
    lines = [];
    write('manifest.json', '{"name":"Hotel Alpenglück Rechnung","version":"1.2.0"}');
    write('template.liquid', '<h1>{{ document.number }}</h1>');
    write('header.liquid', '<p>Hotel Alpenglück</p>');
    write('assets/fonts/brand.woff2', 'wOF2');
    write('.DS_Store', '');
});

describe('pack', () => {
    it('packs template/ in the layout of the import, without hidden files', async () => {
        const target = await pack(root, { log });

        expect(path.basename(target)).toBe('hotel-alpengluck-rechnung-1.2.0.zip');
        expect(Object.keys(unzipSync(readFileSync(target))).sort()).toEqual(['assets/fonts/brand.woff2', 'header.liquid', 'manifest.json', 'template.liquid']);
        expect(lines).toEqual(['Packed 4 files into hotel-alpengluck-rechnung-1.2.0.zip (import it under Templates → Import ZIP).']);
    });

    it('writes to --out', async () => {
        const target = await pack(root, { out: 'dist/alpenglueck.zip', log });

        expect(target).toBe(path.join(root, 'dist', 'alpenglueck.zip'));
        expect(Object.keys(unzipSync(readFileSync(target)))).toContain('template.liquid');
    });

    it('refuses symbolic links and unknown files and writes no ZIP', async () => {
        write('notes.txt', 'todo');
        symlinkSync('/etc/hostname', path.join(root, 'template', 'assets', 'link.svg'));

        const error = await pack(root, { log }).then(() => null, (e: unknown) => e);

        expect(error).toBeInstanceOf(TemplateProblemError);
        expect((error as TemplateProblemError).problems).toEqual(['assets/link.svg: symbolic links are not allowed.', expect.stringMatching(/^notes\.txt: unknown file/)]);
        expect(zips()).toEqual([]);
    });

    it('needs name and version in manifest.json', async () => {
        write('manifest.json', '{"name":"Kulturwerk Elbinsel"}');

        const error = await pack(root, { log }).then(() => null, (e: unknown) => e);

        expect((error as TemplateProblemError).message).toBe('No package was written: manifest.json needs "name" and "version".');
        expect(zips()).toEqual([]);
    });
});

describe('slug', () => {
    it.each([
        ['Hotel Alpenglück', 'hotel-alpengluck'],
        ['  Fjord Analytics – Brief  ', 'fjord-analytics-brief'],
        ['!!!', 'template'],
    ])('%s → %s', (name, expected) => {
        expect(slug(name)).toBe(expected);
    });
});
```

`slug()` übernimmt die Regel aus dem Import nicht exakt (Laravels `Str::slug` macht aus „ü“ ein „u“ wie hier): Der Dateiname ist nur ein Vorschlag, den Slug vergibt openbill beim Import selbst.

- [ ] **Step 3: Failing Tests für `cli.ts` schreiben**

`packages/template-kit/src/tooling/cli.test.ts`:

```ts
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { main, USAGE, type Io } from './cli';
import { startFakeOpenbill, type FakeOpenbill } from './test-support/fake-openbill';

let fake: FakeOpenbill;
let root: string;
let out: string[];
let err: string[];
let io: Io;

beforeEach(async () => {
    fake = await startFakeOpenbill();
    root = mkdtempSync(path.join(tmpdir(), 'kit-cli-'));
    out = [];
    err = [];
    io = { root, out: (line) => out.push(line), err: (line) => err.push(line), environment: { OPENBILL_URL: fake.url, OPENBILL_TOKEN: '1|openbill_test', OPENBILL_TEMPLATE_ID: '01kfjord' } };
});

afterEach(() => fake.close());

describe('main', () => {
    it('prints the usage for unknown commands', async () => {
        expect(await main(['deploy'], io)).toBe(2);
        expect(err).toEqual([USAGE]);
    });

    it('explains a missing .env.local', async () => {
        expect(await main(['push'], { ...io, environment: {} })).toBe(1);
        expect(err[0]).toMatch(/Missing OPENBILL_URL, OPENBILL_TOKEN, OPENBILL_TEMPLATE_ID/);
    });

    it('lists the violations openbill reports for a push', async () => {
        mkdirSync(path.join(root, 'template'));
        writeFileSync(path.join(root, 'template', 'manifest.json'), '{"name":"Fjord Brief","version":"one"}');
        writeFileSync(path.join(root, 'template', 'template.liquid'), '<h1>Fjord</h1>');
        fake.on('PUT', '/api/templates/01kfjord/files', () => ({ status: 422, json: { status: 422, detail: 'The manifest is invalid.', violations: [{ path: 'manifest.version', message: 'Use a version like 1.0.0.' }] } }));

        expect(await main(['push'], io)).toBe(1);
        expect(err).toEqual(['The manifest is invalid.', '  - manifest.version: Use a version like 1.0.0.']);
    });

    it('lists the local problems of pack', async () => {
        expect(await main(['pack'], io)).toBe(1);
        expect(err).toEqual(['No package was written: fix template/ first.', '  - template/ is missing.']);
    });
});
```

- [ ] **Step 4: Tests laufen lassen**

Run: `ddev exec pnpm --filter @openbill/template-kit exec vitest run src/tooling/pull.test.ts src/tooling/pack.test.ts src/tooling/cli.test.ts`
Expected: FAIL mit `Failed to resolve import "./pull"` / `"./pack"` / `"./cli"`

- [ ] **Step 5: `pull.ts` schreiben**

`packages/template-kit/src/tooling/pull.ts`:

```ts
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { unzipSync } from 'fflate';
import type { OpenbillClient } from './client';
import type { KitEnv } from './env';
import { isSafePath, listTemplateFiles, MANIFEST_FILE, PART_FILES, TEMPLATE_DIR, TemplateProblemError } from './template-files';

const PACKAGE_FILES: string[] = [MANIFEST_FILE, ...Object.values(PART_FILES)];

/** The files of a template package ZIP that the toolkit writes; anything unsafe or unknown stops the pull. */
export function unpackPackage(zip: Uint8Array): Map<string, Uint8Array> {
    const files = new Map<string, Uint8Array>();
    const problems: string[] = [];
    for (const [name, contents] of Object.entries(unzipSync(zip))) {
        if (name.endsWith('/')) continue;
        if (!isSafePath(name) || !(PACKAGE_FILES.includes(name) || name.startsWith('assets/'))) {
            problems.push(`${name}: not written (unsafe or unknown path).`);
            continue;
        }
        files.set(name, contents);
    }
    if (problems.length > 0) throw new TemplateProblemError('The package from openbill contains files the toolkit does not write; nothing was changed.', problems);
    return files;
}

/**
 * pnpm pull: GET /api/templates/{id}/package into template/ and GET /api/render/schema into schema.json. When local
 * files differ (other content, or only here), nothing changes unless `force` – then they are overwritten or removed.
 */
export async function pull(root: string, env: KitEnv, client: OpenbillClient, { force, log }: { force: boolean; log(line: string): void }): Promise<void> {
    const dir = path.join(root, TEMPLATE_DIR);
    const files = unpackPackage(await client.packageZip(env.templateId));
    const local = await listTemplateFiles(dir);

    const changed: string[] = [];
    for (const entry of local.entries) {
        const incoming = files.get(entry.path);
        if (incoming === undefined || !Buffer.from(incoming).equals(await readFile(entry.absolute))) changed.push(entry.path);
    }
    if (changed.length > 0 && !force) {
        throw new TemplateProblemError('Local files differ from openbill; nothing was changed. Push them first, or overwrite them with `pnpm pull --force`:', changed);
    }

    for (const entry of local.entries) {
        if (!files.has(entry.path)) await rm(entry.absolute);
    }
    for (const [name, contents] of files) {
        const target = path.join(dir, ...name.split('/'));
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, contents);
    }
    await writeFile(path.join(root, 'schema.json'), `${JSON.stringify(await client.schema(), null, 2)}\n`);
    log(`Pulled ${files.size} files into template/ and the field schema into schema.json.`);
}
```

- [ ] **Step 6: `pack.ts` schreiben**

`packages/template-kit/src/tooling/pack.ts`:

```ts
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { zipSync } from 'fflate';
import { listTemplateFiles, MANIFEST_FILE, parseManifest, TEMPLATE_DIR, TemplateProblemError } from './template-files';

/** File name part from the template name: "Hotel Alpenglück" → "hotel-alpengluck". */
export function slug(name: string): string {
    return (
        name
            .normalize('NFKD')
            .replace(/[̀-ͯ]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'template'
    );
}

/**
 * pnpm run pack: template/ as template package ZIP (files at the top, assets/…) for Templates → Import ZIP – the format
 * TemplatePackage::fromZip reads. Same checks as push; nothing is written while a problem is left.
 */
export async function pack(root: string, { out, log }: { out?: string; log(line: string): void }): Promise<string> {
    const dir = path.join(root, TEMPLATE_DIR);
    const { entries, problems } = await listTemplateFiles(dir);
    if (problems.length > 0) throw new TemplateProblemError('No package was written: fix template/ first.', problems);

    const { manifest, problem } = parseManifest(await readFile(path.join(dir, MANIFEST_FILE), 'utf8'));
    if (manifest === null) throw new TemplateProblemError('No package was written: manifest.json is broken.', [`${MANIFEST_FILE}${problem?.line ? `:${problem.line}` : ''}: ${problem?.message ?? 'unreadable'}`]);
    const name = typeof manifest.name === 'string' ? manifest.name.trim() : '';
    const version = typeof manifest.version === 'string' ? manifest.version.trim() : '';
    if (name === '' || version === '') throw new TemplateProblemError('No package was written: manifest.json needs "name" and "version".', []);

    const files: Record<string, Uint8Array> = {};
    for (const entry of entries) files[entry.path] = new Uint8Array(await readFile(entry.absolute));
    const target = path.resolve(root, out ?? `${slug(name)}-${version.replace(/[^A-Za-z0-9._-]+/g, '-')}.zip`);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, zipSync(files, { level: 6 }));
    log(`Packed ${entries.length} files into ${path.relative(root, target)} (import it under Templates → Import ZIP).`);

    return target;
}
```

- [ ] **Step 7: `cli.ts` schreiben**

`packages/template-kit/src/tooling/cli.ts`:

```ts
import { pathToFileURL } from 'node:url';
import { createClient, OpenbillError } from './client';
import { KitConfigError, readKitEnv } from './env';
import { pack } from './pack';
import { pull } from './pull';
import { push } from './push';
import { TemplateProblemError } from './template-files';

export type Io = {
    root: string;
    out(line: string): void;
    err(line: string): void;
    fetch?: typeof fetch;
    environment?: Record<string, string | undefined>;
};

export const USAGE = 'Usage: pnpm push | pnpm pull [--force] | pnpm run pack [--out <file.zip>]';

function option(args: string[], name: string): string | undefined {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
}

/** push, pull and pack of the template kit; returns the exit code (0 done, 1 failed, 2 wrong call). */
export async function main(argv: string[], io: Io): Promise<number> {
    const [command, ...args] = argv;
    try {
        if (command === 'pack') {
            await pack(io.root, { out: option(args, '--out'), log: io.out });
            return 0;
        }
        if (command !== 'push' && command !== 'pull') {
            io.err(USAGE);
            return 2;
        }
        const env = readKitEnv(io.root, io.environment ?? process.env);
        const client = createClient(env, io.fetch);
        if (command === 'push') await push(io.root, env, client, io.out);
        else await pull(io.root, env, client, { force: args.includes('--force'), log: io.out });
        return 0;
    } catch (error) {
        if (error instanceof OpenbillError) {
            io.err(error.failure.message);
            error.failure.details.forEach((detail) => io.err(`  - ${detail}`));
            return 1;
        }
        if (error instanceof TemplateProblemError) {
            io.err(error.message);
            error.problems.forEach((problem) => io.err(`  - ${problem}`));
            return 1;
        }
        if (error instanceof KitConfigError) {
            io.err(error.message);
            return 1;
        }
        throw error;
    }
}

// started as `node tooling/cli.js …` (package.json scripts of the kit), not when imported by tests
const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
    const major = Number(process.versions.node.split('.')[0]);
    if (major < 24) {
        console.error(`The openbill template toolkit needs Node.js 24 or newer (this is ${process.versions.node}).`);
        process.exitCode = 1;
    } else {
        process.exitCode = await main(process.argv.slice(2), { root: process.cwd(), out: (line) => console.log(line), err: (line) => console.error(line) });
    }
}
```

- [ ] **Step 8: Tests laufen lassen**

Run: `ddev exec pnpm --filter @openbill/template-kit test`
Expected: PASS (alle Dateien unter `src/tooling`)

- [ ] **Step 9: Typen prüfen und committen**

Run: `ddev exec pnpm --filter @openbill/template-kit typecheck`
Expected: Exit 0

```bash
git add packages/template-kit/src/tooling
git commit -m "feat(toolkit): pnpm pull (with --force guard), pnpm run pack and CLI entry" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 7: Vorschau-Seite – reine Logik

**Files:**
- Create: `packages/template-kit/src/app/fields.ts`, `packages/template-kit/src/app/expression.drift.test.ts`
- Create: `packages/template-kit/src/app/missing.ts`, `packages/template-kit/src/app/missing.test.ts`
- Create: `packages/template-kit/src/app/describe.ts`, `packages/template-kit/src/app/describe.test.ts`
- Create: `packages/template-kit/src/app/hot.ts`, `packages/template-kit/src/app/hot.test.ts`
- Create: `packages/template-kit/src/app/stored-flag.ts`, `packages/template-kit/src/app/stored-flag.test.ts`

**Interfaces:**
- Consumes: Typen aus `shared/protocol.ts` (Task 1), Window-Event der Bridge (Task 4), `resources/js/fields/expression.ts` (nur im Drift-Test).
- Produces: `expression(scope, key, type?)`, `liquidPath(scope, key)`; `missingExpectedFields(manifest, schema): ExpectedField[]`; `sourceValue(source)`, `parseSource(value, locale)`, `errorLabel(error)`, `documentLabel(document)`, `SCENARIO_LABELS`, `newer(current, next)`, `pagesLabel(n)`; `onRenderEvent(listener, target?): () => void`, `isLive(target?)`; `readFlag(key, fallback, storage?)`, `writeFlag(key, value, storage?)`, `useStoredFlag(key, fallback): [boolean, (next: boolean) => void]`.

- [ ] **Step 1: Failing Tests schreiben**

`packages/template-kit/src/app/expression.drift.test.ts`:

```ts
import { expect, it } from 'vitest';
// the field bar of the template editor; this test is the only place where the kit reads app code
import * as editor from '../../../../resources/js/fields/expression';
import type { FieldScope, FieldType } from '../shared/protocol';
import { expression, liquidPath } from './fields';

const CASES: [FieldScope, string, FieldType | undefined][] = [
    ['document', 'number', undefined],
    ['document', 'date', undefined],
    ['document', 'net_total', undefined],
    ['document', 'intro', undefined],
    ['document', 'legal_notes', undefined],
    ['document', 'tax_breakdown', undefined],
    ['org', 'logo', undefined],
    ['position', 'quantity', undefined],
    ['position', 'unit_price', undefined],
    ['document', 'po_number', 'text'],
    ['customer', 'note', 'textarea'],
    ['position', 'hours', 'number'],
    ['document', 'budget', 'money'],
    ['document', 'deadline', 'date'],
    ['document', 'rush', 'boolean'],
    ['customer', 'badge', 'image'],
    ['document', 'tier', 'select'],
];

it.each(CASES)('copies the same expression as the template editor for %s.%s (%s)', (scope, key, type) => {
    expect(expression(scope, key, type)).toBe(editor.expression(scope, key, type));
    expect(liquidPath(scope, key)).toBe(editor.liquidPath(scope, key));
});
```

`packages/template-kit/src/app/missing.test.ts`:

```ts
import { expect, it } from 'vitest';
import { SAMPLE_SCHEMA } from '../tooling/test-support/fake-openbill';
import { missingExpectedFields } from './missing';

it('marks expected fields that are neither core nor custom fields of their level', () => {
    const manifest = {
        expectedFields: [
            { scope: 'document' as const, key: 'po_number', type: 'text' as const },
            { scope: 'document' as const, key: 'number', type: 'text' as const },
            { scope: 'customer' as const, key: 'loyalty_level', type: 'select' as const },
        ],
    };

    expect(missingExpectedFields(manifest, SAMPLE_SCHEMA)).toEqual([{ scope: 'customer', key: 'loyalty_level', type: 'select' }]);
    expect(missingExpectedFields(null, SAMPLE_SCHEMA)).toEqual([]);
    expect(missingExpectedFields(manifest, null)).toEqual([]);
});
```

`packages/template-kit/src/app/describe.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { documentLabel, errorLabel, newer, pagesLabel, parseSource, sourceValue } from './describe';

describe('sources', () => {
    it('round-trips select values', () => {
        expect(sourceValue({ kind: 'scenario', key: 'long_invoice', locale: 'de' })).toBe('scenario:long_invoice');
        expect(parseSource('scenario:long_invoice', 'de')).toEqual({ kind: 'scenario', key: 'long_invoice', locale: 'de' });
        expect(parseSource('document:01kdoc', 'en')).toEqual({ kind: 'document', id: '01kdoc' });
        expect(parseSource('document:', 'en')).toBeNull();
        expect(parseSource('other:x', 'en')).toBeNull();
    });

    it('labels documents with number and customer, drafts with their type', () => {
        const base = { id: '01k', type: 'invoice', status: 'draft', date: '2026-10-12', locale: 'de' };
        expect(documentLabel({ ...base, number: 'INV-2026-0007', customer_name: 'Hafenkontor Lindqvist' })).toBe('INV-2026-0007 · Hafenkontor Lindqvist');
        expect(documentLabel({ ...base, number: null, customer_name: null })).toBe('Draft invoice');
    });
});

describe('errors and events', () => {
    it('labels errors with file and line', () => {
        expect(errorLabel({ part: 'body', file: 'template.liquid', line: 12, message: 'x' })).toBe('template.liquid:12');
        expect(errorLabel({ part: 'intro', file: null, line: null, message: 'x' })).toBe('intro');
    });

    it('keeps the newer event', () => {
        expect(newer(null, { seq: 1 })).toEqual({ seq: 1 });
        expect(newer({ seq: 3 }, { seq: 2 })).toEqual({ seq: 3 });
        expect(newer({ seq: 3 }, { seq: 4 })).toEqual({ seq: 4 });
    });

    it('counts pages', () => {
        expect(pagesLabel(1)).toBe('1 page');
        expect(pagesLabel(3)).toBe('3 pages');
    });
});
```

`packages/template-kit/src/app/hot.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { RenderEvent } from '../shared/protocol';
import { isLive, onRenderEvent } from './hot';

describe('onRenderEvent', () => {
    it('forwards the bridge events until unsubscribed', () => {
        const target = new EventTarget();
        const seen: number[] = [];
        const stop = onRenderEvent((event: RenderEvent) => seen.push(event.seq), target);

        target.dispatchEvent(new CustomEvent('openbill:render', { detail: { seq: 4 } }));
        stop();
        target.dispatchEvent(new CustomEvent('openbill:render', { detail: { seq: 5 } }));

        expect(seen).toEqual([4]);
    });

    it('knows whether the bridge of pnpm dev ran', () => {
        expect(isLive(Object.assign(new EventTarget(), { __openbillLive: true }))).toBe(true);
        expect(isLive(new EventTarget())).toBe(false);
    });
});
```

`packages/template-kit/src/app/stored-flag.test.ts`:

```ts
import { expect, it } from 'vitest';
import { readFlag, writeFlag } from './stored-flag';

it('remembers a flag and falls back when storage is missing or throws', () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => void values.set(key, value) };
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };

    expect(readFlag('openbill-kit:guides', false, storage)).toBe(false);
    writeFlag('openbill-kit:guides', true, storage);
    expect(readFlag('openbill-kit:guides', false, storage)).toBe(true);
    expect(readFlag('openbill-kit:guides', true, undefined)).toBe(true);
    expect(readFlag('openbill-kit:guides', false, broken)).toBe(false);
    expect(() => writeFlag('openbill-kit:guides', true, broken)).not.toThrow();
});
```

- [ ] **Step 2: Tests laufen lassen**

Run: `ddev exec pnpm --filter @openbill/template-kit exec vitest run src/app`
Expected: FAIL mit `Failed to resolve import "./fields"` (und den anderen Modulen)

- [ ] **Step 3: Module schreiben**

`packages/template-kit/src/app/fields.ts` (Kopie von `resources/js/fields/expression.ts` ohne `SNIPPETS`):

```ts
import type { FieldScope, FieldType } from '../shared/protocol';

// Copy of resources/js/fields/expression.ts (the kit builds without the app); expression.drift.test.ts keeps both equal.
const MONEY = new Set(['net_total', 'tax_total', 'gross_total', 'optional_total', 'unit_price', 'total']);
const DATES = new Set(['date', 'due_date', 'valid_until', 'service_date', 'service_date_end']);
const TEXTS = new Set(['intro', 'closing']);

/** Where a field lives in Liquid; positions are read inside {% for p in … %}. */
export function liquidPath(scope: FieldScope, key: string): string {
    return `${scope === 'position' ? 'p' : scope}.${key}`;
}

/** Liquid expression with the fitting filter, copied by a click in the field list. */
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
```

Vor dem Speichern mit `resources/js/fields/expression.ts` vergleichen: Hat sich dort seit Phase 8 etwas geändert, die Kopie anpassen (der Drift-Test zeigt es sonst).

`packages/template-kit/src/app/missing.ts`:

```ts
import type { ExpectedField, RenderSchema, TemplateManifest } from '../shared/protocol';

/** manifest.expectedFields that are neither a core field nor a custom field of their level (they stay empty). Same rule as the template editor. */
export function missingExpectedFields(manifest: TemplateManifest | null, schema: RenderSchema | null): ExpectedField[] {
    if (manifest === null || schema === null) return [];
    return (manifest.expectedFields ?? []).filter((field) => {
        const level = schema.levels[field.scope];
        return level !== undefined && !level.core.includes(field.key) && !level.custom.some((custom) => custom.key === field.key);
    });
}
```

`packages/template-kit/src/app/describe.ts`:

```ts
import type { RenderErrorItem, RenderSources, Source } from '../shared/protocol';

export const SCENARIO_LABELS: Record<string, string> = {
    short_invoice: 'Short invoice',
    long_invoice: 'Long invoice (several pages)',
    small_business: 'Small business (no VAT)',
    reverse_charge: 'Reverse charge (EU)',
    offer_with_options: 'Quote with optional items',
};

export const sourceValue = (source: Source): string => (source.kind === 'scenario' ? `scenario:${source.key}` : `document:${source.id}`);

export function parseSource(value: string, locale: 'en' | 'de'): Source | null {
    const [kind, ...rest] = value.split(':');
    const id = rest.join(':');
    if (id === '') return null;
    if (kind === 'scenario') return { kind, key: id, locale };
    if (kind === 'document') return { kind, id };
    return null;
}

export function documentLabel(document: RenderSources['documents'][number]): string {
    const number = document.number ?? `Draft ${document.type}`;
    return document.customer_name ? `${number} · ${document.customer_name}` : number;
}

/** "template.liquid:12", or the part when there is no file (intro/closing of a document). */
export function errorLabel(error: RenderErrorItem): string {
    const where = error.file ?? error.part;
    return error.line ? `${where}:${error.line}` : where;
}

/** Newest render wins: an event never replaces one with a higher sequence number. */
export function newer<T extends { seq: number }>(current: T | null, next: T): T {
    return current !== null && current.seq > next.seq ? current : next;
}

export const pagesLabel = (n: number): string => (n === 1 ? '1 page' : `${n} pages`);
```

`packages/template-kit/src/app/hot.ts`:

```ts
import { RENDER_EVENT, type RenderEvent } from '../shared/protocol';

type LiveTarget = EventTarget & { __openbillLive?: boolean };

/**
 * Render events of the dev server. The page is a prebuilt bundle without import.meta.hot: the plugin's bridge module
 * (/@openbill/bridge.js, injected by `pnpm dev`) turns the HMR event into a window event of the same name.
 */
export function onRenderEvent(listener: (event: RenderEvent) => void, target: LiveTarget = window): () => void {
    const handler = (event: Event) => listener((event as CustomEvent<RenderEvent>).detail);
    target.addEventListener(RENDER_EVENT, handler);
    return () => target.removeEventListener(RENDER_EVENT, handler);
}

/** True when the page came from `pnpm dev` (the bridge runs before the page). */
export function isLive(target: LiveTarget = window): boolean {
    return target.__openbillLive === true;
}
```

`packages/template-kit/src/app/stored-flag.ts`:

```ts
import { useCallback, useState } from 'react';

type FlagStorage = Pick<Storage, 'getItem' | 'setItem'>;

function browserStorage(): FlagStorage | undefined {
    try {
        return window.localStorage;
    } catch {
        return undefined;
    }
}

export function readFlag(key: string, fallback: boolean, storage: FlagStorage | undefined = browserStorage()): boolean {
    try {
        const value = storage?.getItem(key);
        return value === null || value === undefined ? fallback : value === '1';
    } catch {
        return fallback;
    }
}

export function writeFlag(key: string, value: boolean, storage: FlagStorage | undefined = browserStorage()): void {
    try {
        storage?.setItem(key, value ? '1' : '0');
    } catch {
        // private mode or blocked storage: the flag lasts for this page only
    }
}

/** A switch of the preview page that survives a reload (localStorage, never required). */
export function useStoredFlag(key: string, fallback: boolean): [boolean, (next: boolean) => void] {
    const [value, setValue] = useState(() => readFlag(key, fallback));
    const set = useCallback(
        (next: boolean) => {
            setValue(next);
            writeFlag(key, next);
        },
        [key],
    );
    return [value, set];
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `ddev exec pnpm --filter @openbill/template-kit exec vitest run src/app`
Expected: PASS (17 + 1 + 5 + 2 + 1 Tests)

- [ ] **Step 5: Typen prüfen und committen**

Run: `ddev exec pnpm --filter @openbill/template-kit typecheck`
Expected: Exit 0 (der Drift-Test ist per `exclude` ausgenommen)

```bash
git add packages/template-kit/src/app
git commit -m "feat(toolkit): preview logic – field expressions, missing fields, render events" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Vorschau-Seite – React-UI und Gestaltung

**Files:**
- Create: `packages/template-kit/index.html`, `packages/template-kit/vite.config.ts`
- Create: `packages/template-kit/src/app/main.tsx`, `app.tsx`, `toolbar.tsx`, `field-list.tsx`, `error-overlay.tsx`, `use-kit.ts`, `kit-api.ts`, `styles.css` (alle unter `packages/template-kit/src/app/`)

**Interfaces:**
- Consumes: Task 7 (alle Funktionen), `PagedPreview` aus `@openbill/paged-preview` (Props `parts`, `paper`, `lazy`, `showGuides`, `onPageCount`), Endpunkte `GET /__openbill/state` und `POST /__openbill/source` (Task 4), `KIT_API` (Task 1).
- Produces: die Vorschau-Seite. Für Playwright (Task 14) verbindlich: Auswahl mit Label **Data** (Werte `scenario:<key>` / `document:<id>`), Knopf **Areas** (`aria-pressed`), Seitenzahl als `1 page`/`n pages`, Feldliste `aside[aria-label="Fields"]`, Fehler-Overlay `role="alert"` mit Namen **Template problems**, Vorschau `main[aria-label="Preview"]` mit den `.pp-page`-Seiten von `paged-preview`.

- [ ] **Step 1: Einstieg und Build-Konfiguration**

`packages/template-kit/index.html`:

```html
<!doctype html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="color-scheme" content="light dark" />
        <title>openbill template preview</title>
    </head>
    <body>
        <div id="root"></div>
        <script type="module" src="/src/app/main.tsx"></script>
    </body>
</html>
```

`packages/template-kit/vite.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The preview page as static bundle: dist/kit/index.html + dist/kit/assets/. The end user's `pnpm dev` serves it
// (kit-files/vite.config.js) together with the openbill-render plugin; it is never developed against this config.
export default defineConfig({
    plugins: [react()],
    build: {
        outDir: 'dist/kit',
        emptyOutDir: true,
        target: 'es2022',
        sourcemap: false,
    },
});
```

- [ ] **Step 2: Datenanbindung**

`packages/template-kit/src/app/kit-api.ts`:

```ts
import { KIT_API, type KitState, type RenderEvent, type Source } from '../shared/protocol';

async function json<T>(response: Response): Promise<T> {
    if (!response.ok) throw new Error(`The dev server answered ${response.status}.`);
    return (await response.json()) as T;
}

export async function fetchState(): Promise<KitState> {
    return json(await fetch(`${KIT_API}/state`, { headers: { Accept: 'application/json' } }));
}

export async function chooseSource(source: Source): Promise<RenderEvent> {
    return json(await fetch(`${KIT_API}/source`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(source) }));
}
```

`packages/template-kit/src/app/use-kit.ts`:

```ts
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { KitState, RenderEvent, Source } from '../shared/protocol';
import { newer } from './describe';
import { isLive, onRenderEvent } from './hot';
import { chooseSource, fetchState } from './kit-api';

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** State of the dev server plus the newest render event (first state, HMR events, own source changes). */
export function useKit() {
    const [state, setState] = useState<KitState | null>(null);
    const [event, setEvent] = useState<RenderEvent | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const connected = useMemo(() => isLive(), []);

    useEffect(() => {
        let alive = true;
        const accept = (next: RenderEvent) => {
            if (alive) setEvent((current) => newer(current, next));
        };
        const stop = onRenderEvent(accept);
        fetchState()
            .then((loaded) => {
                if (!alive) return;
                setState(loaded);
                if (loaded.event) accept(loaded.event);
            })
            .catch((error: unknown) => alive && setLoadError(message(error)));
        return () => {
            alive = false;
            stop();
        };
    }, []);

    const setSource = useCallback(async (source: Source) => {
        try {
            const next = await chooseSource(source);
            setEvent((current) => newer(current, next));
            setLoadError(null);
        } catch (error) {
            setLoadError(message(error));
        }
    }, []);

    return { state, event, connected, loadError, setSource };
}
```

- [ ] **Step 3: Komponenten**

`packages/template-kit/src/app/toolbar.tsx`:

```tsx
import type { RenderSources, Source, TemplateManifest } from '../shared/protocol';
import { documentLabel, pagesLabel, parseSource, SCENARIO_LABELS, sourceValue } from './describe';

type Props = {
    manifest: TemplateManifest | null;
    instance: string;
    connected: boolean;
    sources: RenderSources | null;
    source: Source | null;
    pages: number;
    guides: boolean;
    onSource(source: Source): void;
    onGuides(next: boolean): void;
};

const host = (url: string): string => {
    try {
        return new URL(url).host;
    } catch {
        return 'no instance';
    }
};

export function Toolbar({ manifest, instance, connected, sources, source, pages, guides, onSource, onGuides }: Props) {
    const name = typeof manifest?.name === 'string' && manifest.name !== '' ? manifest.name : 'Template';
    const version = typeof manifest?.version === 'string' ? manifest.version : null;
    const locale = source?.kind === 'scenario' ? source.locale : 'en';

    return (
        <header className="kit-bar">
            <div className="kit-title">
                <strong>{name}</strong>
                {version && <span className="kit-muted">{version}</span>}
            </div>
            <span className={connected ? 'kit-chip' : 'kit-chip kit-chip--bad'} title={connected ? 'Live: every save in template/ renders again' : 'Not connected to pnpm dev'}>
                <span className="kit-dot" aria-hidden />
                {host(instance)}
            </span>
            <span className="kit-spacer" />
            {sources && source && (
                <label className="kit-field">
                    <span>Data</span>
                    <select
                        value={sourceValue(source)}
                        onChange={(event) => {
                            const next = parseSource(event.target.value, locale);
                            if (next) onSource(next);
                        }}
                    >
                        <optgroup label="Sample data">
                            {sources.scenarios.map((scenario) => (
                                <option key={scenario.key} value={`scenario:${scenario.key}`}>
                                    {SCENARIO_LABELS[scenario.key] ?? scenario.key}
                                </option>
                            ))}
                        </optgroup>
                        {sources.documents.length > 0 && (
                            <optgroup label="Documents">
                                {sources.documents.map((document) => (
                                    <option key={document.id} value={`document:${document.id}`}>
                                        {documentLabel(document)}
                                    </option>
                                ))}
                            </optgroup>
                        )}
                    </select>
                </label>
            )}
            {source?.kind === 'scenario' && (
                <label className="kit-field">
                    <span>Language</span>
                    <select value={locale} onChange={(event) => onSource({ ...source, locale: event.target.value === 'de' ? 'de' : 'en' })}>
                        <option value="en">English</option>
                        <option value="de">Deutsch</option>
                    </select>
                </label>
            )}
            <button type="button" className="kit-button" aria-pressed={guides} onClick={() => onGuides(!guides)} title="Show header, content and footer areas">
                Areas
            </button>
            <span className="kit-muted kit-pages" aria-live="polite">
                {pagesLabel(pages)}
            </span>
        </header>
    );
}
```

`packages/template-kit/src/app/field-list.tsx`:

```tsx
import type { ExpectedField, FieldScope, RenderSchema } from '../shared/protocol';
import { expression, liquidPath } from './fields';

const SCOPES: FieldScope[] = ['org', 'customer', 'contact', 'document', 'position'];
const SCOPE_LABELS: Record<FieldScope, string> = { org: 'Organization', customer: 'Customer', contact: 'Contact', document: 'Document', position: 'Position' };

/** Core and custom fields per level; a click copies the Liquid expression. Expected fields openbill lacks are marked. */
export function FieldList({ schema, missing, onCopy }: { schema: RenderSchema | null; missing: ExpectedField[]; onCopy(code: string): void }) {
    return (
        <aside className="kit-fields" aria-label="Fields">
            <h2 className="kit-h2">Fields</h2>
            <p className="kit-muted kit-small">A click copies the Liquid expression.</p>
            {schema === null ? (
                <p className="kit-muted kit-small">Loading…</p>
            ) : (
                SCOPES.map((scope) => {
                    const level = schema.levels[scope];
                    return (
                        <section key={scope} className="kit-level">
                            <h3>
                                {SCOPE_LABELS[scope]} <code>{level.context}</code>
                            </h3>
                            <ul>
                                {missing
                                    .filter((field) => field.scope === scope)
                                    .map((field) => (
                                        <li key={`missing-${field.key}`}>
                                            <button type="button" className="kit-field-item kit-field-item--missing" onClick={() => onCopy(expression(scope, field.key, field.type))} title="Expected by manifest.json, but openbill has no such field: it stays empty.">
                                                <span>{field.key}</span>
                                                <span className="kit-badge kit-badge--warn">missing</span>
                                                <code>{liquidPath(scope, field.key)}</code>
                                            </button>
                                        </li>
                                    ))}
                                {level.custom.map((field) => (
                                    <li key={`custom-${field.key}`}>
                                        <button type="button" className="kit-field-item" onClick={() => onCopy(expression(scope, field.key, field.type))} title={expression(scope, field.key, field.type)}>
                                            <span>{field.label}</span>
                                            <span className="kit-badge">{field.type}</span>
                                            <code>{liquidPath(scope, field.key)}</code>
                                        </button>
                                    </li>
                                ))}
                                {level.core.map((key) => (
                                    <li key={`core-${key}`}>
                                        <button type="button" className="kit-field-item kit-field-item--core" onClick={() => onCopy(expression(scope, key))} title={expression(scope, key)}>
                                            <code>{liquidPath(scope, key)}</code>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    );
                })
            )}
        </aside>
    );
}
```

`packages/template-kit/src/app/error-overlay.tsx`:

```tsx
import { useState } from 'react';
import type { KitError, RenderErrorItem } from '../shared/protocol';
import { errorLabel } from './describe';

/** Template errors (file, line, excerpt) and failures (instance, token, manifest.json) over the preview. */
export function ErrorOverlay({ failure, errors, hasPreview }: { failure: KitError | null; errors: RenderErrorItem[]; hasPreview: boolean }) {
    const key = JSON.stringify([failure?.message ?? null, errors.map((error) => [error.file, error.line, error.message])]);
    const [hidden, setHidden] = useState<string | null>(null);
    if ((failure === null && errors.length === 0) || hidden === key) return null;

    const title = failure ? 'No new preview' : errors.length === 1 ? 'Template error' : `${errors.length} template errors`;

    return (
        <section className="kit-overlay" role="alert" aria-label="Template problems">
            <header>
                <strong>{title}</strong>
                {hasPreview && <span className="kit-muted kit-small">The preview shows the last working state.</span>}
                <button type="button" className="kit-button" onClick={() => setHidden(key)}>
                    Hide
                </button>
            </header>
            {failure && (
                <div className="kit-problem">
                    <p>{failure.message}</p>
                    {failure.details.length > 0 && (
                        <ul>
                            {failure.details.map((detail) => (
                                <li key={detail}>
                                    <code>{detail}</code>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
            {errors.map((error, index) => (
                <div key={`${error.file}:${error.line}:${index}`} className="kit-problem">
                    <p>
                        <code className="kit-where">{errorLabel(error)}</code> {error.message}
                    </p>
                    {error.excerpt && error.excerpt.length > 0 && (
                        <pre className="kit-excerpt">
                            {error.excerpt.map((line) => (
                                <span key={line.line} className={line.line === error.line ? 'kit-excerpt-hit' : undefined}>
                                    <span className="kit-ln">{line.line}</span>
                                    {line.text}
                                </span>
                            ))}
                        </pre>
                    )}
                </div>
            ))}
        </section>
    );
}
```

`packages/template-kit/src/app/app.tsx`:

```tsx
import { PagedPreview } from '@openbill/paged-preview';
import { useEffect, useMemo, useState } from 'react';
import type { KitError } from '../shared/protocol';
import { ErrorOverlay } from './error-overlay';
import { FieldList } from './field-list';
import { missingExpectedFields } from './missing';
import { useStoredFlag } from './stored-flag';
import { Toolbar } from './toolbar';
import { useKit } from './use-kit';

export function App() {
    const { state, event, connected, loadError, setSource } = useKit();
    const [guides, setGuides] = useStoredFlag('openbill-kit:guides', false);
    const [pages, setPages] = useState(1);
    const [status, setStatus] = useState<string | null>(null);
    const manifest = event?.manifest ?? null;
    const schema = state?.schema ?? null;
    const missing = useMemo(() => missingExpectedFields(manifest, schema), [manifest, schema]);
    const unreachable: KitError | null = loadError ? { kind: 'network', status: null, message: `The page lost the dev server (${loadError}). Is pnpm dev still running?`, details: [] } : null;
    const failure = event?.failure ?? state?.failure ?? unreachable;

    useEffect(() => {
        if (status === null) return;
        const timer = setTimeout(() => setStatus(null), 2500);
        return () => clearTimeout(timer);
    }, [status]);

    const copy = async (code: string) => {
        try {
            await navigator.clipboard.writeText(code);
            setStatus(`Copied ${code}`);
        } catch {
            setStatus(`Copying failed – the expression is ${code}`);
        }
    };

    return (
        <div className="kit">
            <Toolbar
                manifest={manifest}
                instance={state?.instance ?? ''}
                connected={connected}
                sources={state?.sources ?? null}
                source={event?.source ?? null}
                pages={pages}
                guides={guides}
                onSource={(source) => void setSource(source)}
                onGuides={setGuides}
            />
            <div className="kit-body">
                <FieldList schema={schema} missing={missing} onCopy={(code) => void copy(code)} />
                <main className="kit-main" aria-label="Preview">
                    {!connected && (
                        <p className="kit-note kit-note--bad">
                            Live updates are off: open this page through <code>pnpm dev</code>.
                        </p>
                    )}
                    {event?.notice === 'assets_changed' && (
                        <p className="kit-note">
                            assets/ changed. The preview uses the assets saved in openbill – run <code>pnpm push</code> to use the new files.
                        </p>
                    )}
                    {missing.length > 0 && (
                        <p className="kit-note kit-note--warn">
                            manifest.json expects fields openbill does not have: {missing.map((field) => `${field.scope}.${field.key}`).join(', ')}. They stay empty until you create them under Custom fields.
                        </p>
                    )}
                    {event?.result ? (
                        <PagedPreview parts={event.result} paper={event.result.paper} lazy showGuides={guides} onPageCount={setPages} />
                    ) : (
                        <div className="kit-empty">{failure ? 'No preview yet.' : 'Rendering…'}</div>
                    )}
                </main>
            </div>
            <ErrorOverlay failure={failure} errors={event?.errors ?? []} hasPreview={!!event?.result} />
            {status && (
                <div role="status" className="kit-toast">
                    {status}
                </div>
            )}
        </div>
    );
}
```

`packages/template-kit/src/app/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import './styles.css';

const root = document.getElementById('root');
if (root) {
    createRoot(root).render(
        <StrictMode>
            <App />
        </StrictMode>,
    );
}
```

- [ ] **Step 4: Gestaltung (Grundtokens aus DESIGN.md, hell/dunkel nach System)**

`packages/template-kit/src/app/styles.css`:

```css
/* Base tokens of prototypes/clickdummy-v2/DESIGN.md (values as in resources/css/app.css); dark follows the system. */
:root {
    color-scheme: light;
    --bg: #f4f4f2;
    --surface: #ffffff;
    --surface-2: #ecece9;
    --ink: #23252b;
    --muted: #5f626a;
    --faint: #a2a4aa;
    --accent: #2f55d4;
    --accent-soft: #e3e9fb;
    --accent-soft-hover: #d5def8;
    --ok: #2e7d4f;
    --warn: #8f5b00;
    --warn-soft: #faefd7;
    --bad: #b4322e;
    --bad-soft: #fbe3e1;
    --elev-paper: 0 1px 2px rgb(20 22 30 / 0.06), 0 16px 36px -18px rgb(20 22 30 / 0.28);
    --elev-float: 0 1px 2px rgb(20 22 30 / 0.06), 0 18px 48px -12px rgb(20 22 30 / 0.22);
    --font: 'Schibsted Grotesk Variable', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
    --font-code: ui-monospace, 'SF Mono', 'Cascadia Code', Menlo, monospace;
    /* packages/paged-preview */
    --pp-accent: var(--accent);
    --pp-accent-soft: var(--accent-soft);
    --pp-accent-soft-hover: var(--accent-soft-hover);
    --pp-paper-shadow: var(--elev-paper);
}

@media (prefers-color-scheme: dark) {
    :root {
        color-scheme: dark;
        --bg: #16171a;
        --surface: #1f2024;
        --surface-2: #292a2f;
        --ink: #ececee;
        --muted: #9a9ca3;
        --faint: #686a71;
        --accent: #829bf3;
        --accent-soft: #252e52;
        --accent-soft-hover: #2e3963;
        --ok: #6cc891;
        --warn: #e3b158;
        --warn-soft: #3a2c10;
        --bad: #f08a84;
        --bad-soft: #3d1a18;
        --elev-paper: 0 1px 2px rgb(0 0 0 / 0.4), 0 18px 40px -16px rgb(0 0 0 / 0.7);
        --elev-float: 0 1px 2px rgb(0 0 0 / 0.4), 0 20px 50px -12px rgb(0 0 0 / 0.6);
    }
}

* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 14px/1.5 var(--font); -webkit-font-smoothing: antialiased; }
code, pre { font-family: var(--font-code); }
button, select { font: inherit; color: inherit; }

.kit { min-height: 100dvh; display: grid; grid-template-rows: auto 1fr; }
.kit-bar {
    position: sticky; top: 0; z-index: 10;
    display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px;
    padding: 10px 20px;
    background: color-mix(in srgb, var(--bg) 88%, transparent);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid var(--surface-2);
}
.kit-title { display: flex; align-items: baseline; gap: 8px; font-size: 15px; }
.kit-title strong { font-weight: 700; letter-spacing: -0.01em; }
.kit-muted { color: var(--muted); }
.kit-small { font-size: 12px; }
.kit-spacer { flex: 1; }
.kit-chip { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px; background: var(--surface-2); color: var(--muted); font-size: 12px; }
.kit-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--ok); }
.kit-chip--bad .kit-dot { background: var(--bad); }
.kit-field { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); }
.kit-field select { height: 32px; max-width: 18rem; padding: 0 8px; border: 0; border-radius: 10px; background: var(--surface-2); color: var(--ink); font-size: 13px; }
.kit-button { height: 32px; padding: 0 12px; border: 0; border-radius: 10px; background: transparent; font-size: 13px; font-weight: 600; cursor: pointer; }
.kit-button:hover { background: var(--surface-2); }
.kit-button[aria-pressed='true'] { background: var(--accent-soft); color: var(--accent); }
.kit-button:focus-visible, .kit-field select:focus-visible, .kit-field-item:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.kit-pages { min-width: 4.5rem; font-size: 12px; text-align: right; }

.kit-body { display: grid; grid-template-columns: 16rem minmax(0, 1fr); gap: 16px; align-items: start; padding: 16px 20px 40px; }
.kit-fields { position: sticky; top: 68px; max-height: calc(100dvh - 84px); overflow: auto; padding: 14px 10px; border-radius: 18px; background: var(--surface-2); }
.kit-h2 { margin: 0 8px; font-size: 13px; font-weight: 700; }
.kit-fields > p { margin: 2px 8px 10px; }
.kit-level { margin-top: 12px; }
.kit-level h3 { display: flex; align-items: baseline; gap: 6px; margin: 0 8px 4px; font-size: 12.5px; font-weight: 650; }
.kit-level h3 code { padding: 0 4px; border-radius: 4px; background: var(--bg); color: var(--muted); font-size: 11px; font-weight: 400; }
.kit-level ul { margin: 0; padding: 0; list-style: none; }
.kit-field-item { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 1px 8px; width: 100%; padding: 5px 8px; border: 0; border-radius: 8px; background: transparent; text-align: left; cursor: pointer; }
.kit-field-item:hover { background: var(--bg); }
.kit-field-item code { grid-column: 1 / -1; overflow: hidden; color: var(--muted); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.kit-field-item--core code { color: var(--ink); font-size: 12px; }
.kit-field-item--missing { background: var(--warn-soft); }
.kit-badge { color: var(--muted); font-size: 11px; }
.kit-badge--warn { color: var(--warn); font-weight: 600; }

.kit-main { display: grid; gap: 12px; width: 100%; min-width: 0; max-width: 920px; margin: 0 auto; }
.kit-note { margin: 0; padding: 10px 14px; border-radius: 12px; background: var(--accent-soft); font-size: 13px; }
.kit-note--warn { background: var(--warn-soft); }
.kit-note--bad { background: var(--bad-soft); }
.kit-empty { display: grid; place-items: center; min-height: 60vh; border-radius: 18px; background: var(--surface-2); color: var(--muted); }

.kit-overlay {
    position: fixed; right: 20px; bottom: 20px; z-index: 20;
    width: min(40rem, calc(100vw - 40px)); max-height: 60vh; overflow: auto;
    padding: 16px 18px;
    border-left: 4px solid var(--bad); border-radius: 18px;
    background: var(--surface); box-shadow: var(--elev-float);
}
.kit-overlay header { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; margin-bottom: 8px; }
.kit-overlay header strong { color: var(--bad); }
.kit-overlay header .kit-button { margin-left: auto; }
.kit-problem + .kit-problem { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--surface-2); }
.kit-problem p { margin: 0; }
.kit-problem ul { margin: 6px 0 0; padding-left: 18px; }
.kit-where { color: var(--bad); font-weight: 600; }
.kit-excerpt { margin: 8px 0 0; padding: 8px 0; overflow: auto; border-radius: 10px; background: var(--bg); font-size: 12px; line-height: 1.6; }
.kit-excerpt > span { display: block; padding: 0 12px; white-space: pre; }
.kit-excerpt-hit { background: var(--bad-soft); }
.kit-ln { display: inline-block; width: 3ch; margin-right: 12px; color: var(--faint); text-align: right; user-select: none; }
.kit-toast { position: fixed; bottom: 20px; left: 50%; z-index: 30; transform: translateX(-50%); padding: 8px 14px; border-radius: 12px; background: var(--ink); color: var(--bg); font-size: 13px; box-shadow: var(--elev-float); }

@media (max-width: 900px) {
    .kit-body { grid-template-columns: 1fr; }
    .kit-fields { position: static; max-height: 18rem; }
}
```

(Formatierung wie im Plan: eine Regel je Zeile ist hier gewollt, damit die Datei kurz bleibt.)

- [ ] **Step 5: Typen prüfen und Seite bauen**

Run: `ddev exec pnpm --filter @openbill/template-kit typecheck`
Expected: Exit 0

Run: `ddev exec 'cd packages/template-kit && pnpm exec vite build && ls dist/kit dist/kit/assets'`
Expected: `✓ built in …`; `dist/kit` enthält `index.html` und `assets/`, `assets/` eine `index-*.js` und eine `index-*.css`. Die JS-Datei bleibt unter ~300 kB (React-Produktionsbuild + Seite); deutlich größer heißt, dass versehentlich App-Code mitgebündelt wurde – Importe prüfen.

- [ ] **Step 6: Committen**

```bash
git add packages/template-kit/index.html packages/template-kit/vite.config.ts packages/template-kit/src/app
git commit -m "feat(toolkit): preview page with paged preview, field list and error overlay" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Build-Artefakt – Endnutzer-Kit, README, Root-Build

**Files:**
- Create: `packages/template-kit/vite.tooling.config.ts`, `packages/template-kit/scripts/assemble.mjs`
- Create: `packages/template-kit/kit-files/package.json`, `kit-files/pnpm-workspace.yaml`, `kit-files/vite.config.js`, `kit-files/README.md`
- Create: `packages/template-kit/src/kit-files.test.ts`
- Modify: `package.json` (Root, Skript `build`), `vite.config.ts` (Root, `server.watch.ignored`)

**Interfaces:**
- Consumes: `openbillRender` (Task 4), `main` (Task 6), Vorschau-Build (Task 8).
- Produces: `packages/template-kit/dist/kit/` mit `index.html`, `assets/`, `tooling/plugin.js`, `tooling/cli.js` (+ `tooling/chunks/*`), `package.json`, `pnpm-workspace.yaml`, `vite.config.js`, `README.md` – genau das liest Laravel (Task 10) über `config('openbill.toolkit.path')`. Root-`pnpm build` baut App und Kit.

- [ ] **Step 1: Failing Test für die Endnutzer-Dateien schreiben**

`packages/template-kit/src/kit-files.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const here = path.resolve(import.meta.dirname, '..');
const read = (file: string) => readFileSync(path.join(here, file), 'utf8');
const kit = JSON.parse(read('kit-files/package.json')) as { scripts: Record<string, string>; devDependencies: Record<string, string>; dependencies?: unknown; engines: { node: string }; packageManager: string };
const workspace = JSON.parse(read('package.json')) as { devDependencies: Record<string, string> };

describe('the kit the user unpacks', () => {
    it('runs only vite and node tooling/cli.js – no npm, no npx', () => {
        expect(kit.scripts).toEqual({ dev: 'vite', push: 'node tooling/cli.js push', pull: 'node tooling/cli.js pull', pack: 'node tooling/cli.js pack' });
    });

    it('installs only vite, in the version of the workspace, and needs Node 24 and pnpm', () => {
        expect(kit.dependencies).toBeUndefined();
        expect(kit.devDependencies).toEqual({ vite: workspace.devDependencies.vite });
        expect(kit.engines.node).toBe('>=24');
        expect(kit.packageManager).toMatch(/^pnpm@\d+\.\d+\.\d+$/);
    });

    it('is its own pnpm project that refuses old Node versions', () => {
        const yaml = read('kit-files/pnpm-workspace.yaml');
        expect(yaml).toContain('packages: []');
        expect(yaml).toContain('engineStrict: true');
    });

    it('explains every command and the token in the README', () => {
        const readme = read('kit-files/README.md');
        for (const text of ['pnpm install', 'pnpm dev', 'pnpm push', 'pnpm pull', 'pnpm run pack', '.env.local', '--use-system-ca']) expect(readme).toContain(text);
    });
});
```

Run: `ddev exec pnpm --filter @openbill/template-kit exec vitest run src/kit-files.test.ts`
Expected: FAIL mit `ENOENT: no such file or directory, open '…/kit-files/package.json'`

- [ ] **Step 2: Endnutzer-Dateien schreiben**

`packages/template-kit/kit-files/package.json` (die Version von `packageManager` = Root-`package.json`, derzeit `pnpm@12.8.1`):

```json
{
    "name": "openbill-template",
    "private": true,
    "type": "module",
    "description": "Local development of an openbill template: live preview, push, pull and pack.",
    "packageManager": "pnpm@12.8.1",
    "engines": {
        "node": ">=24"
    },
    "scripts": {
        "dev": "vite",
        "push": "node tooling/cli.js push",
        "pull": "node tooling/cli.js pull",
        "pack": "node tooling/cli.js pack"
    },
    "devDependencies": {
        "vite": "^8.3.4"
    }
}
```

`packages/template-kit/kit-files/pnpm-workspace.yaml`:

```yaml
# This folder is its own pnpm project – also when you unpack it inside another workspace.
packages: []

# The toolkit needs Node.js 24 or newer.
engineStrict: true

# Packages that may run install scripts (Vite may pull esbuild in).
allowBuilds:
  esbuild: true
```

`packages/template-kit/kit-files/vite.config.js`:

```js
import { defineConfig } from 'vite';
import { openbillRender } from './tooling/plugin.js';

// pnpm dev: the preview page (index.html, assets/) plus the plugin that renders template/ on your openbill instance.
export default defineConfig({
    plugins: [openbillRender()],
    server: { port: 5180 },
    clearScreen: false,
    // the page is prebuilt: nothing to pre-bundle
    optimizeDeps: { noDiscovery: true, include: [] },
});
```

`packages/template-kit/kit-files/README.md`:

````md
# openbill template toolkit

Develop this openbill template in your own editor with a live preview. Every time you save a file in `template/`, your openbill instance renders it and the preview shows the result – laid out in pages like the PDF, without reloading the page.

## Requirements

- Node.js 24 or newer and pnpm (`corepack enable` sets pnpm up).
- Your openbill instance must be reachable from this computer. It renders the preview; without it there is no preview.

## Start

```bash
pnpm install
pnpm dev
```

Open http://localhost:5180 . Choose the data on top (sample scenarios or one of your recent documents), switch **Areas** to see header, content and footer, and click a field on the left to copy its Liquid expression.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Preview at http://localhost:5180 (`pnpm dev --port 5181` for another port). |
| `pnpm push` | Writes all files of `template/` to openbill: the parts, `manifest.json` and the complete `assets/` folder. Checked first: only package files, assets png/jpg/jpeg/gif/webp/svg/woff/woff2/ttf/otf up to 2 MB each, 20 MB in total, at most 100 files, no symbolic links. |
| `pnpm pull` | Fetches the template saved in openbill into `template/` and the field schema into `schema.json`. Stops when local files differ; `pnpm pull --force` overwrites them. |
| `pnpm run pack` | Packs `template/` as template package (`<name>-<version>.zip`, or `--out file.zip`) for **Templates → Import ZIP**. |

Use `pnpm run pack`, not `pnpm pack`: `pnpm pack` is pnpm's own command and creates an npm tarball.

## Files

- `template/` – your template: `template.liquid` (content), `header.liquid`, `footer.liquid`, `styles.css`, `manifest.json`, `assets/`.
- `.env.local` – `OPENBILL_URL`, `OPENBILL_TOKEN`, `OPENBILL_TEMPLATE_ID`. Listed in `.gitignore`.
- `index.html`, `assets/`, `tooling/`, `vite.config.js` – the toolkit itself.

Assets: the preview uses the assets saved in openbill. New or changed files in `template/assets/` appear after `pnpm push`.

## Keep the token private

`.env.local` holds a token made for this template. It can render every document of your openbill instance in the preview (read access to customers, addresses, positions and amounts) and change only this template. It cannot change documents or settings. Do not commit or share it. You find it in openbill under **Settings → API & MCP** as *Toolkit · <template>*; **Revoke** ends it at once. Downloading the toolkit again creates a new token.

## Troubleshooting

| Message | What to do |
|---|---|
| Cannot reach … | Start openbill, or fix `OPENBILL_URL` in `.env.local`. |
| Node does not trust the certificate … | Local instance with its own CA (DDEV, mkcert): `NODE_OPTIONS=--use-system-ca pnpm dev` (also for push and pull). |
| openbill refused the token (401) | The token was revoked. Download the toolkit again in the template editor, or put a new token into `.env.local`. |
| The token may not do this (403) | `OPENBILL_TEMPLATE_ID` points to another template than the token. |
| Built-in templates are read-only | Duplicate the template in openbill and download the toolkit of the copy. |
| Missing OPENBILL_URL … | `.env.local` is missing or incomplete. |
````

- [ ] **Step 3: Werkzeug-Build und Zusammenbau**

`packages/template-kit/vite.tooling.config.ts`:

```ts
import { builtinModules } from 'node:module';
import { defineConfig } from 'vite';

// The Node side of the kit (Vite plugin, CLI) as plain ESM for Node 24 in dist/kit/tooling: fflate is bundled in,
// vite stays the end user's own dependency, Node built-ins stay imports.
export default defineConfig({
    build: {
        outDir: 'dist/kit/tooling',
        emptyOutDir: true,
        target: 'node24',
        minify: false,
        ssr: true,
        rolldownOptions: {
            input: { plugin: 'src/tooling/plugin.ts', cli: 'src/tooling/cli.ts' },
            external: ['vite', ...builtinModules, ...builtinModules.map((name) => `node:${name}`)],
            output: { format: 'es', entryFileNames: '[name].js', chunkFileNames: 'chunks/[name].js' },
        },
    },
    ssr: { noExternal: true },
});
```

`packages/template-kit/scripts/assemble.mjs`:

```js
// Copies the files of the end user's kit (package.json, README, vite.config.js, pnpm-workspace.yaml) next to the built
// preview page and tooling. Runs last in `pnpm build`.
import { cpSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const target = path.join(root, 'dist/kit');

for (const file of ['index.html', 'tooling/plugin.js', 'tooling/cli.js']) {
    if (!existsSync(path.join(target, file))) throw new Error(`dist/kit/${file} is missing: run both vite builds first.`);
}
cpSync(path.join(root, 'kit-files'), target, { recursive: true });
console.log(`template kit → ${path.relative(process.cwd(), target)}: ${readdirSync(target).sort().join(', ')}`);
```

Root-`package.json`, Skript `build` ersetzen:

```json
        "build": "vite build && pnpm --filter @openbill/template-kit build",
```

Root-`vite.config.ts`, in `server.watch.ignored` ergänzen (nach `'**/e2e/**'`):

```ts
'**/packages/template-kit/dist/**', '**/packages/template-kit/template/**'
```

- [ ] **Step 4: Tests und Build laufen lassen**

Run: `ddev exec pnpm --filter @openbill/template-kit test`
Expected: PASS (alle Dateien, inkl. `kit-files.test.ts`)

Run: `ddev exec pnpm build`
Expected: App-Build wie bisher, danach die Zeile `template kit → packages/template-kit/dist/kit: README.md, assets, index.html, package.json, pnpm-workspace.yaml, tooling, vite.config.js` (der Pfad steht relativ zum Arbeitsordner von pnpm, also ggf. nur `dist/kit`). Falls Vite 8 `rolldownOptions` nicht kennt (Warnung „unknown option“ oder die Ausgabe heißt nicht `plugin.js`/`cli.js`): auf `rollupOptions` umstellen, gleicher Inhalt.

Run: `ddev exec 'ls packages/template-kit/dist/kit/tooling && head -3 packages/template-kit/dist/kit/tooling/cli.js && grep -c "from \"fflate\"" packages/template-kit/dist/kit/tooling/*.js packages/template-kit/dist/kit/tooling/chunks/*.js || true'`
Expected: `cli.js`, `plugin.js` (und ggf. `chunks/`); in keiner Datei ein Import aus `fflate` (Zählung 0 bzw. kein Treffer): fflate ist eingebündelt.

- [ ] **Step 5: Rauchtest des gebauten Kits im Container (wie ein Endnutzer)**

Run:
```bash
ddev exec 'rm -rf /tmp/kit-smoke && cp -r packages/template-kit/dist/kit /tmp/kit-smoke && cd /tmp/kit-smoke && pnpm install 2>&1 | tail -3'
```
Expected: `Done in …`, keine Rückfrage zu Build-Skripten, kein Fehler wegen eines übergeordneten Workspaces.

Run:
```bash
ddev exec 'cd /tmp/kit-smoke && pnpm push; echo "exit=$?"; pnpm run pack; echo "exit=$?"'
```
Expected: `.env.local: Missing OPENBILL_URL, OPENBILL_TOKEN, OPENBILL_TEMPLATE_ID (…)` und `exit=1`; danach `No package was written: fix template/ first.`, `  - template/ is missing.`, `exit=1`. Das beweist: `pnpm push` startet das Skript.

Run:
```bash
ddev exec 'cd /tmp/kit-smoke && pnpm pack 2>&1 | tail -2; ls *.tgz 2>/dev/null; rm -f *.tgz'
```
Expected: pnpm baut einen Tarball (oder meldet einen eigenen pnpm-Fehler) – jedenfalls **nicht** unsere Meldung „No package was written“. Damit ist bestätigt, dass Doku und README `pnpm run pack` sagen müssen. Zeigt pnpm hier doch unsere Meldung, die Hinweise auf `pnpm run pack` trotzdem lassen (funktioniert in beiden Fällen).

Run:
```bash
ddev exec 'cd /tmp/kit-smoke && (timeout 25 pnpm dev --port 5199 > /tmp/kit-dev.log 2>&1 &) ; sleep 8; curl -s localhost:5199/__openbill/state; echo; curl -s -o /dev/null -w "page=%{http_code}\n" localhost:5199/; curl -s localhost:5199/@openbill/bridge.js | grep -c createHotContext; curl -s localhost:5199/ | grep -c "@openbill/bridge.js"'
```
Expected: JSON mit `"failure":{"kind":"config",…"Missing OPENBILL_URL…"}`, `page=200`, dann zweimal eine Zahl ≥ 1 (Bridge mit Hot-Context, Bridge in `index.html` eingebunden).

- [ ] **Step 6: Committen**

```bash
git add package.json vite.config.ts packages/template-kit/vite.tooling.config.ts packages/template-kit/scripts packages/template-kit/kit-files packages/template-kit/src/kit-files.test.ts
git commit -m "build(toolkit): assemble the end user's kit in packages/template-kit/dist/kit" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 10: Laravel – Kit lesen und Toolkit-ZIP bauen

**Files:**
- Modify: `app/Rendering/TemplatePackage.php` (neue Methode `files()`, `toZip()` nutzt sie)
- Create: `app/Rendering/ToolkitPackage.php`
- Create: `app/Exceptions/ToolkitUnavailableException.php`
- Modify: `config/openbill.php` (Abschnitt `toolkit`)
- Modify: `lang/en.json`, `lang/de.json` (`errors.toolkit_unavailable`)
- Modify: `tests/Pest.php` (Helfer `fakeToolkit()`, `zipEntries()`, `envLocal()`)
- Create: `tests/Feature/Rendering/ToolkitPackageTest.php`

**Interfaces:**
- Consumes: `TemplatePackage` (Phase 3), `DomainActionException` (Phase 2), `Text::t()`.
- Produces: `TemplatePackage::files(): array<string, string>`; `ToolkitPackage::readKit(string $dir): array<string, string>` (wirft `ToolkitUnavailableException`), `new ToolkitPackage(array $kit, TemplatePackage $template, array $env)`, `->toZip(string $folder): string`, `ToolkitPackage::envFile(array $env): string`, `ToolkitPackage::GITIGNORE`; `config('openbill.toolkit.path')`; Pest-Helfer für Task 11/12.

- [ ] **Step 1: Pest-Helfer ergänzen**

In `tests/Pest.php` oben `use Illuminate\Support\Facades\File;` ergänzen (alphabetisch bei den anderen `use`), am Ende anhängen:

```php
/**
 * A built template kit as `pnpm build` leaves it in packages/template-kit/dist/kit (only a few files), plus what
 * must never reach the toolkit ZIP: template/, node_modules/, .env.local and a symbolic link. Points
 * config('openbill.toolkit.path') at it; the test deletes the folder afterwards (File::deleteDirectory).
 */
function fakeToolkit(): string
{
    $dir = sys_get_temp_dir().'/openbill-kit-'.bin2hex(random_bytes(6));
    foreach (['tooling', 'assets', 'template', 'node_modules/vite'] as $folder) {
        File::ensureDirectoryExists("{$dir}/{$folder}");
    }
    file_put_contents("{$dir}/package.json", '{"name":"openbill-template","scripts":{"dev":"vite"}}');
    file_put_contents("{$dir}/README.md", "# openbill template toolkit\n");
    file_put_contents("{$dir}/index.html", '<div id="root"></div>');
    file_put_contents("{$dir}/assets/index.js", 'console.log("preview")');
    file_put_contents("{$dir}/tooling/cli.js", '// cli');
    file_put_contents("{$dir}/template/template.liquid", 'stale template');
    file_put_contents("{$dir}/node_modules/vite/index.js", '// vite');
    file_put_contents("{$dir}/.env.local", 'OPENBILL_TOKEN="leaked"');
    symlink('/etc/hostname', "{$dir}/assets/link.txt");
    config(['openbill.toolkit.path' => $dir]);

    return $dir;
}

/**
 * Entries of a ZIP (toolkit download, template package), sorted by name.
 *
 * @return array<string, string>
 */
function zipEntries(string $zip): array
{
    $path = sys_get_temp_dir().'/openbill-test-'.bin2hex(random_bytes(6)).'.zip';
    file_put_contents($path, $zip);
    $archive = new ZipArchive;
    $archive->open($path);
    $entries = [];
    for ($i = 0; $i < $archive->numFiles; $i++) {
        $entries[(string) $archive->getNameIndex($i)] = (string) $archive->getFromIndex($i);
    }
    $archive->close();
    unlink($path);
    ksort($entries);

    return $entries;
}

/**
 * KEY => value of an .env.local written by App\Rendering\ToolkitPackage.
 *
 * @return array<string, string>
 */
function envLocal(string $contents): array
{
    preg_match_all('/^([A-Z_]+)="([^"]*)"$/m', $contents, $matches);

    return array_combine($matches[1], $matches[2]);
}
```

- [ ] **Step 2: Failing Test schreiben**

`tests/Feature/Rendering/ToolkitPackageTest.php`:

```php
<?php

use App\Exceptions\ToolkitUnavailableException;
use App\Rendering\TemplatePackage;
use App\Rendering\ToolkitPackage;
use Illuminate\Support\Facades\File;

afterEach(function () {
    if (isset($this->kitDir)) {
        File::deleteDirectory($this->kitDir);
    }
});

it('lists the package files in the order of the ZIP', function () {
    $package = new TemplatePackage(['name' => 'Fjord Brief', 'version' => '1.0.0'], 'h', 'b', 'f', 'c', ['assets/logo.svg' => '<svg/>']);

    expect(array_keys($package->files()))->toBe(['manifest.json', 'header.liquid', 'template.liquid', 'footer.liquid', 'styles.css', 'assets/logo.svg'])
        ->and($package->files()['template.liquid'])->toBe('b')
        ->and(json_decode($package->files()['manifest.json'], true))->toBe(['name' => 'Fjord Brief', 'version' => '1.0.0']);
});

it('reads the built kit without template, installs, secrets and symbolic links', function () {
    $this->kitDir = fakeToolkit();

    expect(array_keys(ToolkitPackage::readKit($this->kitDir)))->toBe(['README.md', 'assets/index.js', 'index.html', 'package.json', 'tooling/cli.js']);
});

it('refuses a folder without a built kit', function (string $missing) {
    $this->kitDir = fakeToolkit();
    File::delete("{$this->kitDir}/{$missing}");

    ToolkitPackage::readKit($this->kitDir);
})->with(['package.json', 'tooling/cli.js'])->throws(ToolkitUnavailableException::class);

it('puts kit, template, .env.local and .gitignore into one folder of the ZIP', function () {
    $template = new TemplatePackage(['name' => 'Fjord Brief', 'version' => '1.0.0'], '<p>head</p>', '<h1>body</h1>', '', 'h1 {}', ['assets/logo.svg' => '<svg xmlns="http://www.w3.org/2000/svg"></svg>']);
    $env = ['OPENBILL_URL' => 'https://openbill.example', 'OPENBILL_TOKEN' => '7|openbill_secret', 'OPENBILL_TEMPLATE_ID' => '01kfjordbrief'];

    $entries = zipEntries((new ToolkitPackage(['package.json' => '{}', 'tooling/cli.js' => '// cli'], $template, $env))->toZip('openbill-fjord'));

    expect(array_keys($entries))->toEqualCanonicalizing([
        'openbill-fjord/.env.local', 'openbill-fjord/.gitignore', 'openbill-fjord/package.json', 'openbill-fjord/tooling/cli.js',
        'openbill-fjord/template/manifest.json', 'openbill-fjord/template/header.liquid', 'openbill-fjord/template/template.liquid',
        'openbill-fjord/template/footer.liquid', 'openbill-fjord/template/styles.css', 'openbill-fjord/template/assets/logo.svg',
    ])
        ->and($entries['openbill-fjord/template/template.liquid'])->toBe('<h1>body</h1>')
        ->and(envLocal($entries['openbill-fjord/.env.local']))->toBe($env)
        ->and($entries['openbill-fjord/.env.local'])->toStartWith('#')
        ->and($entries['openbill-fjord/.gitignore'])->toContain(".env.local\n")->toContain("node_modules/\n");
});

it('never writes a value that would break .env.local', function (string $value) {
    ToolkitPackage::envFile(['OPENBILL_URL' => $value]);
})->with(["https://openbill.example\nOPENBILL_TOKEN=evil", 'https://openbill.example"', 'C:\\openbill'])->throws(RuntimeException::class);
```

- [ ] **Step 3: Test laufen lassen**

Run: `ddev artisan test --filter=ToolkitPackageTest`
Expected: FAIL mit `Call to undefined method App\Rendering\TemplatePackage::files()` bzw. `Class "App\Rendering\ToolkitPackage" not found`

- [ ] **Step 4: `TemplatePackage::files()` und `toZip()`**

In `app/Rendering/TemplatePackage.php` vor `toZip()` einfügen:

```php
    /**
     * Package path => contents in the order of the ZIP: manifest.json, the four parts, assets/… (toZip(), toolkit).
     *
     * @return array<string, string>
     */
    public function files(): array
    {
        $files = ['manifest.json' => json_encode($this->manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)."\n"];
        foreach (self::FILES as $column => $file) {
            $files[$file] = $this->{$column};
        }

        return [...$files, ...$this->assets];
    }
```

In `toZip()` die drei Schreibschritte (`manifest.json`, Schleife über `self::FILES`, Schleife über `$this->assets`) ersetzen durch:

```php
            foreach ($this->files() as $name => $contents) {
                $zip->addFromString($name, $contents);
            }
```

- [ ] **Step 5: Exception, Konfiguration, Übersetzungen**

`app/Exceptions/ToolkitUnavailableException.php`:

```php
<?php

namespace App\Exceptions;

use App\Support\Text;

/** The built template kit (config openbill.toolkit.path) is missing: `pnpm build` did not run (503). */
final class ToolkitUnavailableException extends DomainActionException
{
    public function __construct()
    {
        parent::__construct(Text::t('errors.toolkit_unavailable'));
    }

    public function status(): int
    {
        return 503;
    }

    public function reason(): string
    {
        return 'toolkit_unavailable';
    }
}
```

In `config/openbill.php` nach dem Abschnitt `templates` einfügen:

```php
    /*
    | Template toolkit (POST /{locale}/templates/{id}/toolkit): the built kit that goes into the ZIP.
    | `pnpm build` writes it to packages/template-kit/dist/kit – in DDEV and in the Docker image (phase 10).
    */
    'toolkit' => [
        'path' => env('OPENBILL_TOOLKIT_PATH', base_path('packages/template-kit/dist/kit')),
    ],
```

`lang/en.json` (alphabetisch bei den `errors.*`):

```json
    "errors.toolkit_unavailable": "The template toolkit is missing in this installation. Run `pnpm build`, or use the official Docker image.",
```

`lang/de.json`:

```json
    "errors.toolkit_unavailable": "Das Template-Toolkit fehlt in dieser Installation. Führe `pnpm build` aus oder nutze das offizielle Docker-Image.",
```

- [ ] **Step 6: `ToolkitPackage` schreiben**

`app/Rendering/ToolkitPackage.php`:

```php
<?php

namespace App\Rendering;

use App\Exceptions\ToolkitUnavailableException;
use FilesystemIterator;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use RuntimeException;
use SplFileInfo;
use ZipArchive;

/**
 * The ZIP of the toolkit download (POST /{locale}/templates/{id}/toolkit): the built kit (config openbill.toolkit.path),
 * the template as package files under template/, .env.local (instance URL, token, template id) and a .gitignore that
 * keeps .env.local out of git. Everything sits in one folder.
 */
final readonly class ToolkitPackage
{
    /** First path segments never taken from the kit folder: the template comes from the database, secrets and installs stay local. */
    private const SKIP = ['template', 'node_modules', '.env', '.env.local', '.gitignore', 'schema.json'];

    public const GITIGNORE = "node_modules/\n.env.local\n*.zip\n";

    /**
     * @param  array<string, string>  $kit  kit path => contents (readKit())
     * @param  array<string, string>  $env  .env.local
     */
    public function __construct(
        public array $kit,
        public TemplatePackage $template,
        public array $env,
    ) {}

    /**
     * Every regular file of the built kit by relative path ("/"); symbolic links are skipped.
     *
     * @return array<string, string>
     *
     * @throws ToolkitUnavailableException when the kit was not built
     */
    public static function readKit(string $dir): array
    {
        if (! is_file("{$dir}/package.json") || ! is_file("{$dir}/tooling/cli.js")) {
            throw new ToolkitUnavailableException;
        }

        $files = [];
        $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS));
        foreach ($iterator as $file) {
            /** @var SplFileInfo $file */
            if ($file->isLink() || ! $file->isFile()) {
                continue;
            }
            $relative = str_replace(DIRECTORY_SEPARATOR, '/', substr($file->getPathname(), strlen($dir) + 1));
            if (in_array(explode('/', $relative)[0], self::SKIP, true)) {
                continue;
            }
            $files[$relative] = (string) file_get_contents($file->getPathname());
        }
        ksort($files);

        return $files;
    }

    public function toZip(string $folder): string
    {
        // random name instead of tempnam() (forbidden by the security arch preset)
        $path = sys_get_temp_dir().'/openbill-toolkit-'.bin2hex(random_bytes(12)).'.zip';
        try {
            $zip = new ZipArchive;
            if ($zip->open($path, ZipArchive::CREATE | ZipArchive::EXCL) !== true) {
                throw new RuntimeException('Could not create a temporary file for the template toolkit.');
            }
            foreach ($this->kit as $name => $contents) {
                $zip->addFromString("{$folder}/{$name}", $contents);
            }
            foreach ($this->template->files() as $name => $contents) {
                $zip->addFromString("{$folder}/template/{$name}", $contents);
            }
            $zip->addFromString("{$folder}/.env.local", self::envFile($this->env));
            $zip->addFromString("{$folder}/.gitignore", self::GITIGNORE);
            $zip->close();

            return (string) file_get_contents($path);
        } finally {
            if (is_file($path)) {
                unlink($path);
            }
        }
    }

    /**
     * KEY="value" lines. Values are an URL, a token and a ULID: quotes, backslashes and line breaks never belong there.
     *
     * @param  array<string, string>  $env
     */
    public static function envFile(array $env): string
    {
        $lines = ['# openbill template toolkit – keep this file private: it holds a token (Settings → API & MCP to revoke it).'];
        foreach ($env as $key => $value) {
            if (preg_match('/["\\\\\r\n]/', $value) === 1) {
                throw new RuntimeException("Unexpected character in {$key}.");
            }
            $lines[] = "{$key}=\"{$value}\"";
        }

        return implode("\n", $lines)."\n";
    }
}
```

- [ ] **Step 7: Tests laufen lassen**

Run: `ddev artisan test --filter='ToolkitPackageTest|TemplatePackage|TemplateApiTest|TranslationsTest'`
Expected: PASS (die bisherigen Paket-Tests bleiben grün: `toZip()` schreibt dieselben Einträge)

- [ ] **Step 8: Statische Prüfungen und committen**

Run: `ddev exec vendor/bin/pint && ddev exec vendor/bin/phpstan analyse --memory-limit=1G`
Expected: Pint formatiert ggf.; PHPStan `[OK] No errors`

```bash
git add app/Rendering/TemplatePackage.php app/Rendering/ToolkitPackage.php app/Exceptions/ToolkitUnavailableException.php config/openbill.php lang/en.json lang/de.json tests/Pest.php tests/Feature/Rendering/ToolkitPackageTest.php
git commit -m "feat(toolkit): read the built kit and pack the toolkit ZIP with .env.local" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Download-Endpunkt `POST /{locale}/templates/{id}/toolkit`

**Files:**
- Create: `app/Actions/DownloadTemplateToolkit.php`
- Create: `app/Http/Controllers/TemplateToolkitController.php`
- Modify: `routes/web.php` (Gruppe `auth`)
- Modify: `bootstrap/app.php` (Problem Details auch für `templates.toolkit`)
- Modify: `lang/en.json`, `lang/de.json` (`toolkit.token_name`)
- Create: `tests/Feature/Toolkit/ToolkitDownloadTest.php`

**Interfaces:**
- Consumes: `IssueApiToken::handle(Actor $actor, User $user, array $input): NewAccessToken` (Phase 4/8), `TemplatePackage::fromTemplate()`, `ToolkitPackage` (Task 10), `ActionNotAllowedException::templateBuiltIn()`, `FileResponse::download()`, `DownloadFile`, `Actor::user()`, Pest-Helfer (Task 10).
- Produces: `DownloadTemplateToolkit::handle(Actor $actor, User $user, Template $template, string $instanceUrl): DownloadFile`, `DownloadTemplateToolkit::tokenName(Template $template): string`; Route `templates.toolkit` (`POST /{locale}/templates/{id}/toolkit`, Sitzung + CSRF, `throttle:10,1`) → 200 `application/zip` `openbill-toolkit-<slug>.zip`, `Cache-Control: no-store`; Fehler als `application/problem+json`: 401 (keine Sitzung), 404, 409 `template_built_in`, 429, 503 `toolkit_unavailable`.

- [ ] **Step 1: Failing Test schreiben**

`tests/Feature/Toolkit/ToolkitDownloadTest.php`:

```php
<?php

use App\Models\PersonalAccessToken;
use App\Models\Template;
use App\Models\User;
use App\Support\ApiTokens;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

const TOOLKIT_FOLDER = 'openbill-fjord-brief';

beforeEach(function () {
    $this->kitDir = fakeToolkit();
    $this->user = User::factory()->create();
    $this->template = Template::factory()->create([
        'name' => 'Fjord Brief',
        'slug' => 'fjord-brief',
        'header' => '<p>{{ org.name }}</p>',
        'body' => '<h1>{{ document.number }}</h1>',
        'manifest' => ['name' => 'Fjord Brief', 'version' => '1.0.0'],
    ]);
    $svg = '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"></svg>';
    Storage::disk('local')->put("templates/{$this->template->id}/assets/logo.svg", $svg);
    $this->template->assets()->create(['path' => 'assets/logo.svg', 'mime' => 'image/svg+xml', 'storage_path' => "templates/{$this->template->id}/assets/logo.svg", 'size' => strlen($svg)]);
});

afterEach(fn () => File::deleteDirectory($this->kitDir));

it('hands out the kit, the saved template, .env.local and .gitignore as one ZIP', function () {
    $response = $this->actingAs($this->user)
        ->post("https://openbill.example/en/templates/{$this->template->id}/toolkit")
        ->assertOk()
        ->assertHeader('Content-Type', 'application/zip')
        ->assertDownload('openbill-toolkit-fjord-brief.zip');
    $entries = zipEntries((string) $response->getContent());

    expect((string) $response->headers->get('Cache-Control'))->toContain('no-store')
        ->and(array_keys($entries))->toEqualCanonicalizing(array_map(fn (string $path): string => TOOLKIT_FOLDER.'/'.$path, [
            '.env.local', '.gitignore', 'README.md', 'assets/index.js', 'index.html', 'package.json', 'tooling/cli.js',
            'template/manifest.json', 'template/header.liquid', 'template/template.liquid', 'template/footer.liquid', 'template/styles.css', 'template/assets/logo.svg',
        ]))
        ->and($entries[TOOLKIT_FOLDER.'/template/template.liquid'])->toBe('<h1>{{ document.number }}</h1>')
        ->and($entries[TOOLKIT_FOLDER.'/template/header.liquid'])->toBe('<p>{{ org.name }}</p>')
        ->and(json_decode($entries[TOOLKIT_FOLDER.'/template/manifest.json'], true))->toMatchArray(['name' => 'Fjord Brief', 'version' => '1.0.0'])
        ->and($entries[TOOLKIT_FOLDER.'/template/assets/logo.svg'])->toContain('<svg')
        ->and($entries[TOOLKIT_FOLDER.'/.gitignore'])->toContain('.env.local')
        ->and(implode("\n", $entries))->not->toContain('leaked')->not->toContain('stale template');
});

it('creates a token for the signed-in user that previews and writes only this template', function () {
    $zip = $this->actingAs($this->user)->post("https://openbill.example/en/templates/{$this->template->id}/toolkit")->assertOk()->getContent();
    $env = envLocal(zipEntries((string) $zip)[TOOLKIT_FOLDER.'/.env.local']);
    $token = PersonalAccessToken::findToken($env['OPENBILL_TOKEN']);

    expect($env['OPENBILL_URL'])->toBe('https://openbill.example')
        ->and($env['OPENBILL_TEMPLATE_ID'])->toBe($this->template->id)
        ->and($token)->not->toBeNull()
        ->and($token->abilities)->toBe(['templates:render', 'templates:write'])
        ->and($token->template_id)->toBe($this->template->id)
        ->and($token->tokenable_id)->toBe($this->user->id)
        ->and($token->name)->toStartWith('Toolkit: Fjord Brief (')
        ->and($token->expires_at)->toBeNull()
        ->and(ApiTokens::row($token))->toMatchArray(['is_toolkit' => true, 'template_name' => 'Fjord Brief']);
});

it('makes a new token with every download and keeps the older ones', function () {
    $this->actingAs($this->user);
    $this->post("/en/templates/{$this->template->id}/toolkit")->assertOk();
    $this->post("/en/templates/{$this->template->id}/toolkit")->assertOk();

    expect(PersonalAccessToken::query()->where('template_id', $this->template->id)->count())->toBe(2);
});

it('refuses built-in templates (duplicate first) and creates no token', function () {
    $klar = Template::query()->where('slug', 'klar')->sole();

    $this->actingAs($this->user)->postJson("/en/templates/{$klar->id}/toolkit")
        ->assertStatus(409)
        ->assertHeader('Content-Type', 'application/problem+json')
        ->assertJsonPath('reason', 'template_built_in');
    expect(PersonalAccessToken::query()->count())->toBe(0);
});

it('answers 503 without a token when the kit was not built', function () {
    config(['openbill.toolkit.path' => $this->kitDir.'/missing']);

    $this->actingAs($this->user)->postJson("/de/templates/{$this->template->id}/toolkit")
        ->assertStatus(503)
        ->assertJsonPath('reason', 'toolkit_unavailable')
        ->assertJsonPath('detail', __('errors.toolkit_unavailable', [], 'de'));
    expect(PersonalAccessToken::query()->count())->toBe(0);
});

it('needs the session: guests and API tokens get 401, unknown templates 404', function () {
    $this->postJson("/en/templates/{$this->template->id}/toolkit")
        ->assertUnauthorized()
        ->assertHeader('Content-Type', 'application/problem+json');
    $this->withToken(apiToken(['api:write']))->postJson("/en/templates/{$this->template->id}/toolkit")->assertUnauthorized();

    forgetApiAuth();
    $this->actingAs($this->user)->postJson('/en/templates/'.strtolower((string) Str::ulid()).'/toolkit')->assertNotFound();
    expect(PersonalAccessToken::query()->where('template_id', $this->template->id)->count())->toBe(0);
});
```

- [ ] **Step 2: Test laufen lassen**

Run: `ddev artisan test --filter=ToolkitDownloadTest`
Expected: FAIL – die Route fehlt (405 `Method Not Allowed` bzw. 404 statt 200)

- [ ] **Step 3: Action schreiben**

`app/Actions/DownloadTemplateToolkit.php`:

```php
<?php

namespace App\Actions;

use App\Enums\TokenAbility;
use App\Exceptions\ActionNotAllowedException;
use App\Exceptions\ToolkitUnavailableException;
use App\Models\Template;
use App\Models\User;
use App\Rendering\TemplatePackage;
use App\Rendering\ToolkitPackage;
use App\Support\Actor;
use App\Support\DownloadFile;
use App\Support\Text;
use Illuminate\Support\Facades\DB;

/**
 * Template editor "Download toolkit" (spec 7): a new token for $user that previews documents (templates:render) and
 * reads and writes only this template (templates:write + template_id), and the ZIP with the built kit, the saved
 * template under template/ and .env.local. Built-in templates are read-only: duplicate first. Every download makes
 * a new token; older ones stay until revoked (settings "API & MCP") or until the template is deleted.
 */
final class DownloadTemplateToolkit
{
    public function __construct(private readonly IssueApiToken $tokens) {}

    /**
     * @throws ActionNotAllowedException|ToolkitUnavailableException
     */
    public function handle(Actor $actor, User $user, Template $template, string $instanceUrl): DownloadFile
    {
        if ($template->built_in) {
            throw ActionNotAllowedException::templateBuiltIn();
        }
        // before the token: a missing kit must not leave a token behind
        $kit = ToolkitPackage::readKit((string) config('openbill.toolkit.path'));
        $package = TemplatePackage::fromTemplate($template->loadMissing('assets'));

        return DB::transaction(function () use ($actor, $user, $template, $instanceUrl, $kit, $package): DownloadFile {
            $token = $this->tokens->handle($actor, $user, [
                'name' => self::tokenName($template),
                'abilities' => [TokenAbility::TemplatesRender->value, TokenAbility::TemplatesWrite->value],
                'template_id' => $template->id,
            ]);
            $zip = (new ToolkitPackage($kit, $package, [
                'OPENBILL_URL' => rtrim($instanceUrl, '/'),
                'OPENBILL_TOKEN' => $token->plainTextToken,
                'OPENBILL_TEMPLATE_ID' => $template->id,
            ]))->toZip("openbill-{$template->slug}");

            return new DownloadFile("openbill-toolkit-{$template->slug}.zip", 'application/zip', $zip);
        });
    }

    /** "Toolkit: Fjord Brief (2026-10-12 14:03)" – template names have at most 100 characters, tokens 255. */
    public static function tokenName(Template $template): string
    {
        return Text::t('toolkit.token_name', ['template' => $template->name, 'date' => now()->format('Y-m-d H:i')]);
    }
}
```

`lang/en.json` und `lang/de.json` (gleicher Text, alphabetisch einsortieren):

```json
    "toolkit.token_name": "Toolkit: :template (:date)",
```

- [ ] **Step 4: Controller, Route, Fehlerformat**

`app/Http/Controllers/TemplateToolkitController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Actions\DownloadTemplateToolkit;
use App\Http\Api\FileResponse;
use App\Models\Template;
use App\Models\User;
use App\Support\Actor;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * POST /{locale}/templates/{id}/toolkit – toolkit ZIP with a new token, only for the signed-in session (CSRF); the
 * template editor fetches it. Errors come as Problem Details (bootstrap/app.php), like /api.
 */
final class TemplateToolkitController extends Controller
{
    public function __invoke(Request $request, string $id, DownloadTemplateToolkit $download): Response
    {
        /** @var User $user */
        $user = $request->user();
        $template = Template::query()->with('assets')->findOrFail($id);

        return FileResponse::download($download->handle(Actor::user($user), $user, $template, $request->getSchemeAndHttpHost()))
            ->header('Cache-Control', 'no-store, private');
    }
}
```

`routes/web.php`: `use App\Http\Controllers\TemplateToolkitController;` ergänzen und in der Gruppe `auth` direkt nach der Route `templates.show`:

```php
        // toolkit download: creates a token, so only the session (never an API token) and rarely
        Route::post('/templates/{id}/toolkit', TemplateToolkitController::class)
            ->whereUlid('id')->middleware('throttle:10,1')->name('templates.toolkit');
```

`bootstrap/app.php`, im Render-Callback die Bedingung erweitern:

```php
        // every /api route answers with Problem Details (API Platform's own error handler is off, config/api-platform.php),
        // and so does the toolkit download, which the template editor fetches
        $exceptions->render(function (Throwable $e, Request $request) {
            if (! ($request->is('api', 'api/*') || $request->routeIs('templates.toolkit')) || $e instanceof HttpResponseException) {
                return null;
            }

            return ProblemResponse::from($e);
        });
```

- [ ] **Step 5: Tests laufen lassen**

Run: `ddev artisan test --filter=ToolkitDownloadTest`
Expected: PASS (6 Tests). Prüfpunkte:
- `assertDownload` scheitert am Dateinamen → `FileResponse` setzt `Content-Disposition` per `HeaderUtils::makeDisposition` (ASCII-Name, passt); Slug der Factory prüfen.
- Gast bekommt 302 statt 401 → `routeIs('templates.toolkit')` greift nicht, weil Laravels `unauthenticated()` vorher rendert: dann in `bootstrap/app.php` zusätzlich `shouldRenderJsonWhen` um `$request->routeIs('templates.toolkit')` erweitern und erneut testen.

- [ ] **Step 6: Architektur, statische Prüfungen, alle Tests, committen**

Run: `ddev artisan test --filter='ArchTest|TranslationsTest|ToolkitDownloadTest|ToolkitPackageTest|ApiTokensApiTest'`
Expected: PASS

Run: `ddev exec vendor/bin/pint && ddev exec vendor/bin/phpstan analyse --memory-limit=1G`
Expected: `[OK] No errors`

```bash
git add app/Actions/DownloadTemplateToolkit.php app/Http/Controllers/TemplateToolkitController.php routes/web.php bootstrap/app.php lang/en.json lang/de.json tests/Feature/Toolkit/ToolkitDownloadTest.php
git commit -m "feat(toolkit): download endpoint creates a template-bound token and the toolkit ZIP" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Pest – Bindung des Toolkit-Tokens (Review Focus 5)

**Files:**
- Create: `tests/Feature/Toolkit/ToolkitTokenScopeTest.php`

**Interfaces:**
- Consumes: Route `templates.toolkit` (Task 11), Pest-Helfer `fakeToolkit()`, `zipEntries()`, `envLocal()` (Task 10), `draft()`, `systemActor()`, `forgetApiAuth()` (`tests/Pest.php`), `RevokeApiToken`, `DeleteTemplate` (`handle(Actor $actor, Template $template): void`), `ApiAccess`/`RequireApiAbility` (Phase 4/8).
- Produces: Absicherung von Master Review Focus 5 mit dem Token aus dem echten Download. Erwartung: Es ist **keine** Produktionsänderung nötig. Scheitert ein Test, ist das eine echte Lücke: in `App\Support\ApiAccess` bzw. an der `middleware:` der betroffenen Operation schließen, nicht den Test anpassen.

- [ ] **Step 1: Test schreiben**

`tests/Feature/Toolkit/ToolkitTokenScopeTest.php`:

```php
<?php

use App\Actions\DeleteTemplate;
use App\Actions\RevokeApiToken;
use App\Models\PersonalAccessToken;
use App\Models\Template;
use App\Models\User;
use Illuminate\Support\Facades\File;

/*
 * Review focus 5 (master plan): the token of a toolkit download previews documents and reads and writes its own
 * template – nothing else. The token comes out of the real ZIP of POST /{locale}/templates/{id}/toolkit.
 */

/** Plain-text token in the .env.local of a toolkit download of $template (as $user, through the session). */
function toolkitToken(Template $template, User $user): string
{
    $zip = test()->actingAs($user)->post("/en/templates/{$template->id}/toolkit")->assertOk()->getContent();
    // the download ran in the session; every request after it must authenticate with the token alone
    forgetApiAuth();

    return envLocal(zipEntries((string) $zip)["openbill-{$template->slug}/.env.local"])['OPENBILL_TOKEN'];
}

/** Status of one request with only the toolkit token. */
function asToolkit(string $token, string $method, string $uri, array $body = []): int
{
    forgetApiAuth();

    return test()->withToken($token)->json($method, $uri, $body)->getStatusCode();
}

beforeEach(function () {
    $this->kitDir = fakeToolkit();
    $this->own = Template::factory()->create(['name' => 'Fjord Brief', 'slug' => 'fjord-brief']);
    $this->other = Template::factory()->create(['name' => 'Kulturwerk Elbinsel', 'slug' => 'kulturwerk', 'body' => '<p>Kulturwerk</p>']);
    $this->draft = draft();
    $this->token = toolkitToken($this->own, User::factory()->create());
});

afterEach(fn () => File::deleteDirectory($this->kitDir));

it('previews any document and reads and writes its own template', function () {
    $own = $this->own->id;
    $allowed = [
        ['POST', '/api/render', ['document_id' => $this->draft->id, 'template_id' => $own]],
        ['POST', '/api/render', ['scenario' => 'long_invoice', 'template_id' => $own, 'template' => ['body' => '<p>Fjord</p>']]],
        ['GET', '/api/render/sources'],
        ['GET', '/api/render/schema'],
        ['GET', "/api/templates/{$own}"],
        ['GET', "/api/templates/{$own}/package"],
        ['PUT', "/api/templates/{$own}/files", ['body' => '<h1>Fjord {{ document.number }}</h1>']],
    ];

    foreach ($allowed as $row) {
        [$method, $uri, $body] = [...$row, []];
        expect(asToolkit($this->token, $method, $uri, $body))->toBe(200, "{$method} {$uri}");
    }
    expect($this->own->fresh()->body)->toBe('<h1>Fjord {{ document.number }}</h1>');
});

it('refuses everything else with 403 and changes nothing', function () {
    [$own, $other, $doc] = [$this->own->id, $this->other->id, $this->draft->id];
    $draftBefore = $this->draft->fresh()->toArray();
    $templatesBefore = Template::query()->count();
    $denied = [
        ['PUT', "/api/templates/{$other}/files", ['body' => '<p>taken over</p>']],
        ['GET', "/api/templates/{$other}"],
        ['GET', "/api/templates/{$other}/package"],
        ['GET', '/api/templates'],
        ['POST', '/api/templates'],
        ['POST', "/api/templates/{$own}/duplicate"],
        ['DELETE', "/api/templates/{$own}"],
        ['GET', '/api/documents'],
        ['GET', "/api/documents/{$doc}"],
        ['PATCH', "/api/documents/{$doc}", ['intro' => 'Hafenkontor Lindqvist']],
        ['POST', "/api/documents/{$doc}/finalize"],
        ['DELETE', "/api/documents/{$doc}"],
        ['GET', "/api/documents/{$doc}/pdf"],
        ['POST', '/api/customers', ['name' => 'Kulturwerk Elbinsel']],
        ['PATCH', '/api/organization', ['name' => 'Studio Nordlicht']],
        ['POST', '/api/field-definitions', ['scope' => 'document', 'key' => 'po_number', 'label' => 'PO', 'type' => 'text']],
        ['GET', '/api/tokens'],
        ['POST', '/api/tokens', ['name' => 'more', 'abilities' => ['api:write']]],
        ['POST', '/mcp', ['jsonrpc' => '2.0', 'id' => 1, 'method' => 'tools/list']],
    ];

    foreach ($denied as $row) {
        [$method, $uri, $body] = [...$row, []];
        expect(asToolkit($this->token, $method, $uri, $body))->toBe(403, "{$method} {$uri}");
    }
    expect($this->other->fresh()->body)->toBe('<p>Kulturwerk</p>')
        ->and(Template::query()->count())->toBe($templatesBefore)
        ->and($this->draft->fresh()->toArray())->toBe($draftBefore)
        ->and(PersonalAccessToken::query()->count())->toBe(1);
});

it('cannot get more tokens: the download route only knows the session', function () {
    forgetApiAuth();

    $this->withToken($this->token)->postJson("/en/templates/{$this->own->id}/toolkit")->assertUnauthorized();
    expect(PersonalAccessToken::query()->count())->toBe(1);
});

it('stops working when revoked and disappears with its template', function () {
    expect(asToolkit($this->token, 'GET', '/api/render/schema'))->toBe(200);
    app(RevokeApiToken::class)->handle(systemActor(), PersonalAccessToken::findToken($this->token));
    expect(asToolkit($this->token, 'GET', '/api/render/schema'))->toBe(401);

    $second = toolkitToken($this->other, User::factory()->create());
    app(DeleteTemplate::class)->handle(systemActor(), $this->other->fresh());

    expect(PersonalAccessToken::findToken($second))->toBeNull()
        ->and(asToolkit($second, 'GET', '/api/render/schema'))->toBe(401);
});
```

- [ ] **Step 2: Test laufen lassen**

Run: `ddev artisan test --filter=ToolkitTokenScopeTest`
Expected: PASS (4 Tests). Erwartbare Stolpersteine, die **kein** Rechteproblem sind:
- `POST /api/templates` ohne Datei antwortet 403 nur, wenn die Fähigkeit vor der Validierung geprüft wird – so ist es (`api.ability:write` ist Route-Middleware). Kommt 422, ist die Middleware an der Operation verloren gegangen → Lücke, in `TemplateResource` beheben.
- `PATCH /api/documents/{id}` mit `application/json` statt `merge-patch+json`: 403 kommt vor der Formatprüfung. Kommt 415, läuft API Platforms Formatprüfung vor der Middleware → Lücke melden und `RightsMatrixTest` vergleichen (dort gilt dieselbe Erwartung).
- `/mcp` antwortet bei falscher Fähigkeit 403 (`McpAuthTest` „toolkit token“).

- [ ] **Step 3: Committen**

```bash
git add tests/Feature/Toolkit/ToolkitTokenScopeTest.php
git commit -m "test(toolkit): toolkit token writes only its template (review focus 5)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 13: Dialog „Toolkit“ im Template-Editor

**Files:**
- Modify: `resources/js/lib/api.ts` (neu `apiBlob()`, `filenameOf()`), `resources/js/lib/api.test.ts`
- Create: `resources/js/lib/download.ts`
- Modify: `resources/js/templates/editor/toolkit-slot.tsx` (ersetzt den Platzhalter; keine andere Editor-Datei ändert sich)
- Modify: `lang/en.json`, `lang/de.json` (`toolkit.*`)

**Interfaces:**
- Consumes: `ToolkitSlotProps = { templateId; builtIn; dirty; save(): Promise<boolean> }` (Phase 7), Route `templates.toolkit` (Task 11), `request()`/`ApiError`/`errorMessage` aus `lib/api.ts`, `keys.tokens()` (Phase 8), `Button`, `Dialog`, `Notice` aus `@/components/ui`, `toast`, `path()`/`t()`.
- Produces: `apiBlob(path, options?): Promise<{ blob: Blob; filename: string | null }>`, `filenameOf(disposition: string | null): string | null`, `saveBlob(blob, filename): void`; Knopf **Toolkit** im Editor-Kopf, Dialog **Template toolkit** mit Knopf **Download toolkit** bzw. **Save and download** (Playwright, Task 14).

- [ ] **Step 1: Failing Tests für `apiBlob`/`filenameOf` schreiben**

In `resources/js/lib/api.test.ts` den Import um `apiBlob, filenameOf` erweitern und am Ende anhängen:

```ts
describe('file answers', () => {
    it('returns the blob and the file name of a download', async () => {
        fetchMock.mockResolvedValueOnce(new Response(new Uint8Array([80, 75, 3, 4]), { status: 200, headers: { 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename=openbill-toolkit-fjord-brief.zip' } }));

        const file = await apiBlob('/en/templates/01kfjord/toolkit', { method: 'POST' });

        expect(file.filename).toBe('openbill-toolkit-fjord-brief.zip');
        expect([...new Uint8Array(await file.blob.arrayBuffer())]).toEqual([80, 75, 3, 4]);
        expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST', credentials: 'same-origin' });
    });

    it('throws Problem Details as ApiError', async () => {
        fetchMock.mockResolvedValueOnce(problem(409, 'template_built_in'));

        await expect(apiBlob('/en/templates/01kklar/toolkit', { method: 'POST' })).rejects.toMatchObject({ status: 409, reason: 'template_built_in' });
    });

    it('reads plain, quoted and RFC 5987 file names', () => {
        expect(filenameOf('attachment; filename="openbill-toolkit-hotel.zip"')).toBe('openbill-toolkit-hotel.zip');
        expect(filenameOf("attachment; filename*=UTF-8''openbill-toolkit-alpengl%C3%BCck.zip")).toBe('openbill-toolkit-alpenglück.zip');
        expect(filenameOf(null)).toBeNull();
    });
});
```

Run: `ddev exec pnpm test -- resources/js/lib/api.test.ts`
Expected: FAIL mit `apiBlob is not a function` (bzw. „does not provide an export named 'apiBlob'“)

- [ ] **Step 2: `apiBlob`, `filenameOf`, `saveBlob` schreiben**

In `resources/js/lib/api.ts` nach `apiText()` einfügen:

```ts
/** attachment; filename=openbill-toolkit-fjord.zip – also quoted, or RFC 5987 filename*=UTF-8''… */
export function filenameOf(disposition: string | null): string | null {
    if (!disposition) return null;
    const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
    if (encoded) return decodeURIComponent(encoded[1]);
    const plain = /filename="?([^";]+)"?/i.exec(disposition);
    return plain ? plain[1] : null;
}

/** A file answer (toolkit ZIP) with its name; CSRF, 419 retry and 401 like api(), errors as ApiError. */
export async function apiBlob(path: string, options: Omit<ApiOptions, 'format'> = {}): Promise<{ blob: Blob; filename: string | null }> {
    const response = await request(path, options, 'json');
    return { blob: await response.blob(), filename: filenameOf(response.headers.get('Content-Disposition')) };
}
```

`resources/js/lib/download.ts`:

```ts
/** Hands a fetched file to the browser as download (object URL on a temporary link). */
export function saveBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    // Safari starts the download asynchronously: revoke a moment later
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
```

Run: `ddev exec pnpm test -- resources/js/lib/api.test.ts`
Expected: PASS

- [ ] **Step 3: Übersetzungen**

`lang/en.json` (alphabetisch, gleiche Schlüssel wie de):

```json
    "toolkit.built_in": "Built-in templates are read-only. Duplicate it with “Duplicate to customize”, then download the toolkit of the copy.",
    "toolkit.button": "Toolkit",
    "toolkit.description": "Develop this template in your own editor, with a live preview rendered by openbill.",
    "toolkit.download": "Download toolkit",
    "toolkit.downloaded": "Toolkit downloaded – a new token was created",
    "toolkit.requirements": "Needs Node.js 24 and pnpm, and openbill must be reachable from your computer.",
    "toolkit.save_and_download": "Save and download",
    "toolkit.step_edit": "Edit the files in template/ – the preview at http://localhost:5180 updates without reloading.",
    "toolkit.step_install": "Unzip, then run in the folder:",
    "toolkit.step_push": "Write back, fetch, pack:",
    "toolkit.title": "Template toolkit",
    "toolkit.token_link": "Tokens under API & MCP",
    "toolkit.token_text": "The download contains a token in .env.local. It can preview every document (read access) and change only this template. Keep it private; you can revoke it at any time.",
    "toolkit.token_title": "New token.",
    "toolkit.unsaved": "Your unsaved changes are saved first: the toolkit starts from the saved state.",
```

`lang/de.json`:

```json
    "toolkit.built_in": "Mitgelieferte Templates lassen sich nicht ändern. Dupliziere es mit „Duplizieren, um es anzupassen“ und lade dann das Toolkit der Kopie herunter.",
    "toolkit.button": "Toolkit",
    "toolkit.description": "Entwickle dieses Template in deinem eigenen Editor, mit einer Live-Vorschau, die openbill rendert.",
    "toolkit.download": "Toolkit herunterladen",
    "toolkit.downloaded": "Toolkit heruntergeladen – ein neuer Token wurde angelegt",
    "toolkit.requirements": "Braucht Node.js 24 und pnpm, und openbill muss von deinem Rechner aus erreichbar sein.",
    "toolkit.save_and_download": "Speichern und herunterladen",
    "toolkit.step_edit": "Ändere die Dateien in template/ – die Vorschau unter http://localhost:5180 aktualisiert sich ohne Neuladen.",
    "toolkit.step_install": "Entpacken, dann im Ordner ausführen:",
    "toolkit.step_push": "Zurückschreiben, holen, packen:",
    "toolkit.title": "Template-Toolkit",
    "toolkit.token_link": "Tokens unter API & MCP",
    "toolkit.token_text": "Der Download enthält einen Token in .env.local. Er kann jedes Dokument in der Vorschau rendern (lesender Zugriff) und nur dieses Template ändern. Gib ihn nicht weiter; du kannst ihn jederzeit widerrufen.",
    "toolkit.token_title": "Neuer Token.",
    "toolkit.unsaved": "Deine ungespeicherten Änderungen werden zuerst gespeichert: Das Toolkit startet mit dem gespeicherten Stand.",
```

Vorher prüfen, dass die zitierten Knopftexte stimmen: `grep -n '"templates.duplicate_to_edit"' lang/en.json lang/de.json` → `Duplicate to customize` / `Duplizieren, um es anzupassen`.

- [ ] **Step 4: `toolkit-slot.tsx` ersetzen**

`resources/js/templates/editor/toolkit-slot.tsx`:

```tsx
import { Link } from '@inertiajs/react';
import { AlertTriangle, Download, SquareTerminal } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { mutate } from 'swr';
import { keys } from '@/api/keys';
import { Button, Dialog, Notice } from '@/components/ui';
import { apiBlob, errorMessage } from '@/lib/api';
import { saveBlob } from '@/lib/download';
import { path, t } from '@/lib/i18n';
import { toast } from '@/lib/toast';

export type ToolkitSlotProps = {
    templateId: string;
    builtIn: boolean;
    /** Unsaved changes in the editor: the toolkit should start from the saved state. */
    dirty: boolean;
    /** Saves the editor (PUT /api/templates/{id}/files); false when invalid or failed. */
    save(): Promise<boolean>;
};

const code = 'rounded-sm bg-surface-2 px-1 font-mono text-sm';

/**
 * "Toolkit" in the editor header (spec 7): explains the kit, warns about the token it contains and downloads the ZIP
 * (POST /{locale}/templates/{id}/toolkit). Built-in templates get the hint to duplicate first, no download.
 */
export function ToolkitSlot({ templateId, builtIn, dirty, save }: ToolkitSlotProps): ReactNode {
    const [open, setOpen] = useState(false);
    const [pending, setPending] = useState(false);

    const download = async () => {
        setPending(true);
        try {
            if (dirty && !(await save())) return;
            const file = await apiBlob(path(`/templates/${templateId}/toolkit`), { method: 'POST' });
            saveBlob(file.blob, file.filename ?? 'openbill-toolkit.zip');
            void mutate(keys.tokens());
            toast.success(t('toolkit.downloaded'));
            setOpen(false);
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setPending(false);
        }
    };

    const footer = builtIn ? (
        <Button variant="primary" onClick={() => setOpen(false)}>
            {t('common.close')}
        </Button>
    ) : (
        <>
            <Button variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
                {t('common.cancel')}
            </Button>
            <Button variant="primary" icon={<Download />} pending={pending} onClick={() => void download()}>
                {dirty ? t('toolkit.save_and_download') : t('toolkit.download')}
            </Button>
        </>
    );

    return (
        <>
            <Button variant="ghost" icon={<SquareTerminal />} onClick={() => setOpen(true)}>
                {t('toolkit.button')}
            </Button>
            <Dialog open={open} onClose={() => !pending && setOpen(false)} title={t('toolkit.title')} description={t('toolkit.description')} footer={footer} wide>
                {builtIn ? (
                    <Notice tone="warn" icon={<AlertTriangle />}>
                        {t('toolkit.built_in')}
                    </Notice>
                ) : (
                    <>
                        <ol className="m-0 grid list-decimal gap-2 pl-5">
                            <li>
                                {t('toolkit.step_install')} <code className={code}>pnpm install</code> · <code className={code}>pnpm dev</code>
                            </li>
                            <li>{t('toolkit.step_edit')}</li>
                            <li>
                                {t('toolkit.step_push')} <code className={code}>pnpm push</code> · <code className={code}>pnpm pull</code> · <code className={code}>pnpm run pack</code>
                            </li>
                        </ol>
                        <Notice tone="warn" icon={<AlertTriangle />}>
                            <b>{t('toolkit.token_title')}</b> {t('toolkit.token_text')} <Link href={path('/settings/api')}>{t('toolkit.token_link')}</Link>
                        </Notice>
                        {dirty && <Notice>{t('toolkit.unsaved')}</Notice>}
                        <p className="m-0 text-sm text-muted">{t('toolkit.requirements')}</p>
                    </>
                )}
            </Dialog>
        </>
    );
}
```

Prüfen: `ddev exec 'grep -c "SquareTerminal" node_modules/lucide-react/dist/lucide-react.d.ts'` → ≥ 1 (sonst `TerminalSquare`). `Notice` ohne `tone` ist `neutral` (Phase 5).

- [ ] **Step 5: Prüfen und im Browser ansehen**

Run: `ddev exec pnpm typecheck && ddev exec pnpm test && ddev artisan test --filter=TranslationsTest`
Expected: alles grün

Run: `ddev exec pnpm build` (oder `ddev exec pnpm dev` laufen lassen), dann im Browser `https://openbill.ddev.site/en/templates` → ein eigenes Template (oder Duplikat von Klar) öffnen → **Toolkit**.
Expected: Dialog mit drei Schritten, Token-Hinweis mit Link, Knopf **Download toolkit**; Download liefert `openbill-toolkit-<slug>.zip`, Toast erscheint, unter Einstellungen → API & MCP steht ein Token mit Badge „Toolkit · <Template>“. Bei Klar: nur der Hinweis „erst duplizieren“. Mit ungespeicherter Änderung heißt der Knopf **Save and download** und speichert vorher.

- [ ] **Step 6: Committen**

```bash
git add resources/js/lib/api.ts resources/js/lib/api.test.ts resources/js/lib/download.ts resources/js/templates/editor/toolkit-slot.tsx lang/en.json lang/de.json
git commit -m "feat(toolkit): toolkit dialog in the template editor" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Playwright – Toolkit von Download bis `pnpm push`

**Files:**
- Modify: `e2e/global-setup.ts` (Kit gebaut?)
- Create: `e2e/tests/toolkit.spec.ts`

**Interfaces:**
- Consumes: Dialog (Task 13), Download-Route (Task 11), gebautes Kit (Task 9) in `packages/template-kit/dist/kit`, Vorschau-Seite (Task 8: Label **Data**, `role="alert"` „Template problems“, `.pp-page`), Helfer `apiGet`/`apiPost`/`apiDelete` aus `e2e/tests/helpers.ts`, `POST /api/templates` (Import) für die Pack-Probe.
- Produces: Abnahme „Erfolgskriterium Toolkit aus Spec 1“ und die Screenshots `e2e/screenshots/toolkit-1440-light.png`, `toolkit-1440-dark.png`, `toolkit-dialog-1440.png` (git-ignoriert) für Task 16.

- [ ] **Step 1: Vorab prüfen – Node vertraut der DDEV-CA mit `--use-system-ca`**

Run (auf dem Mac): `NODE_OPTIONS=--use-system-ca node -e "fetch('https://openbill.ddev.site/up').then(r => console.log(r.status))"`
Expected: `200`. Kommt ein Zertifikatsfehler: `NODE_EXTRA_CA_CERTS="$(mkcert -CAROOT)/rootCA.pem" node -e "…"` probieren; funktioniert nur das, im Test unten statt `NODE_OPTIONS` die Variable `NODE_EXTRA_CA_CERTS` aus `execFileSync('mkcert', ['-CAROOT'])` setzen und das in der Doku (Task 15) zusätzlich nennen.

- [ ] **Step 2: `global-setup.ts` erweitern**

In `e2e/global-setup.ts` direkt nach der Prüfung der Frontend-Assets einfügen:

```ts
    // the toolkit download (toolkit.spec.ts) packs packages/template-kit/dist/kit; against Compose (phase 10) it lives in the image
    if (!process.env.OPENBILL_URL && !existsSync(path.join(root, 'packages/template-kit/dist/kit/tooling/cli.js'))) {
        throw new Error('No template kit: run `ddev exec pnpm build` (or `ddev exec pnpm --filter @openbill/template-kit build`) first.');
    }
```

- [ ] **Step 3: Test schreiben**

`e2e/tests/toolkit.spec.ts`:

```ts
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { apiDelete, apiGet, apiPost } from './helpers';

const PORT = 5190;
const KIT_URL = `http://localhost:${PORT}`;
const SCREENSHOTS = path.resolve(import.meta.dirname, '../screenshots');
// Node on the Mac must trust the DDEV certificate (mkcert CA in the keychain), like a template author would
const nodeEnv = { ...process.env, NODE_OPTIONS: [process.env.NODE_OPTIONS, '--use-system-ca'].filter(Boolean).join(' ') };

async function waitForKit(timeout: number): Promise<void> {
    const until = Date.now() + timeout;
    while (Date.now() < until) {
        try {
            if ((await fetch(`${KIT_URL}/__openbill/state`)).ok) return;
        } catch {
            // dev server not up yet
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`pnpm dev did not answer on ${KIT_URL} within ${timeout} ms`);
}

test('toolkit: download, pnpm install && pnpm dev, live preview without reload, push and pack (spec 1)', async ({ page }) => {
    test.setTimeout(360_000);
    await page.goto('/en/templates');
    const templates = (await apiGet(page, '/api/templates')) as { id: string; slug: string }[];
    const klar = templates.find((template) => template.slug === 'klar')!;
    const copy = (await apiPost(page, `/api/templates/${klar.id}/duplicate`)) as { id: string; slug: string };
    // outside the repository: e2e/ is a pnpm workspace of its own
    const work = mkdtempSync(path.join(tmpdir(), 'openbill-toolkit-'));
    let dev: ChildProcess | undefined;

    try {
        // 1. dialog and download
        await page.goto(`/en/templates/${copy.id}`);
        await page.getByRole('button', { name: 'Toolkit', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Template toolkit' });
        await expect(dialog).toContainText('.env.local');
        await expect(dialog).toContainText('pnpm run pack');
        mkdirSync(SCREENSHOTS, { recursive: true });
        await page.screenshot({ path: path.join(SCREENSHOTS, 'toolkit-dialog-1440.png') });
        const downloading = page.waitForEvent('download');
        await dialog.getByRole('button', { name: 'Download toolkit' }).click();
        const download = await downloading;
        expect(download.suggestedFilename()).toBe(`openbill-toolkit-${copy.slug}.zip`);
        const zip = path.join(work, download.suggestedFilename());
        await download.saveAs(zip);
        await expect(page.getByText('Toolkit downloaded')).toBeVisible();

        // 2. unpack, install, start
        execFileSync('unzip', ['-q', zip, '-d', work]);
        const kit = path.join(work, `openbill-${copy.slug}`);
        expect(readFileSync(path.join(kit, '.env.local'), 'utf8')).toContain(`OPENBILL_TEMPLATE_ID="${copy.id}"`);
        expect(readFileSync(path.join(kit, '.gitignore'), 'utf8')).toContain('.env.local');
        execFileSync('pnpm', ['install'], { cwd: kit, env: nodeEnv, stdio: 'inherit', timeout: 180_000 });
        dev = spawn('pnpm', ['dev', '--port', String(PORT), '--strictPort'], { cwd: kit, env: nodeEnv, stdio: 'inherit', detached: true });
        await waitForKit(60_000);

        // 3. the preview page renders the template, several pages with the long sample invoice
        const kitPage = await page.context().newPage();
        await kitPage.setViewportSize({ width: 1440, height: 900 });
        await kitPage.goto(KIT_URL);
        await expect(kitPage.locator('.pp-page').first()).toBeVisible({ timeout: 30_000 });
        await kitPage.getByLabel('Data').selectOption('scenario:long_invoice');
        await expect(kitPage.getByText(/^\d+ pages$/)).toBeVisible({ timeout: 30_000 });
        await expect(kitPage.getByRole('complementary', { name: 'Fields' })).toContainText('document.number');

        // 4. change template.liquid: the preview updates without a reload and keeps its scroll position
        await kitPage.evaluate(() => {
            (window as unknown as { kitAlive: boolean }).kitAlive = true;
            window.scrollTo(0, 600);
        });
        const body = path.join(kit, 'template', 'template.liquid');
        const original = readFileSync(body, 'utf8');
        writeFileSync(body, `<p id="toolkit-marker">Toolkit check Hafenkontor</p>\n${original}`);
        const firstPage = kitPage.locator('.pp-page[data-page="1"] .pp-clip iframe').contentFrame();
        await expect(firstPage.locator('#toolkit-marker')).toHaveText('Toolkit check Hafenkontor', { timeout: 15_000 });
        expect(await kitPage.evaluate(() => (window as unknown as { kitAlive?: boolean }).kitAlive)).toBe(true);
        expect(Math.abs((await kitPage.evaluate(() => window.scrollY)) - 600)).toBeLessThanOrEqual(2);

        // 5. a Liquid error shows the overlay with file and line, fixing it removes the overlay
        writeFileSync(body, `{{ document.number | nope }}\n<p id="toolkit-marker">Toolkit check Hafenkontor</p>\n${original}`);
        const overlay = kitPage.getByRole('alert', { name: 'Template problems' });
        await expect(overlay).toContainText('template.liquid:1', { timeout: 15_000 });
        writeFileSync(body, `<p id="toolkit-marker">Toolkit check Hafenkontor</p>\n${original}`);
        await expect(overlay).toHaveCount(0, { timeout: 15_000 });

        // review screenshots of the preview page (Task 16)
        await kitPage.evaluate(() => window.scrollTo(0, 0));
        await kitPage.emulateMedia({ colorScheme: 'light' });
        await kitPage.screenshot({ path: path.join(SCREENSHOTS, 'toolkit-1440-light.png') });
        await kitPage.emulateMedia({ colorScheme: 'dark' });
        await kitPage.screenshot({ path: path.join(SCREENSHOTS, 'toolkit-1440-dark.png') });

        // 6. pnpm push writes the change to openbill
        execFileSync('pnpm', ['push'], { cwd: kit, env: nodeEnv, stdio: 'inherit', timeout: 60_000 });
        const saved = (await apiGet(page, `/api/templates/${copy.id}`)) as { body: string };
        expect(saved.body).toContain('Toolkit check Hafenkontor');

        // 7. pnpm run pack makes a package the import accepts
        execFileSync('pnpm', ['run', 'pack'], { cwd: kit, env: nodeEnv, stdio: 'inherit', timeout: 60_000 });
        const packed = readdirSync(kit).find((name) => name.endsWith('.zip'));
        expect(packed).toBeDefined();
        const xsrf = (await page.context().cookies()).find((cookie) => cookie.name === 'XSRF-TOKEN')?.value ?? '';
        const imported = await page.request.post('/api/templates', {
            multipart: { package: { name: packed!, mimeType: 'application/zip', buffer: readFileSync(path.join(kit, packed!)) } },
            headers: { Accept: 'application/json', Referer: page.url(), 'X-XSRF-TOKEN': decodeURIComponent(xsrf) },
        });
        expect(imported.status(), await imported.text()).toBe(201);
        await apiDelete(page, `/api/templates/${((await imported.json()) as { id: string }).id}`);
    } finally {
        if (dev?.pid) {
            try {
                process.kill(-dev.pid, 'SIGTERM');
            } catch {
                // already gone
            }
        }
        // deleting the template deletes its toolkit token, too
        await apiDelete(page, `/api/templates/${copy.id}`);
    }
});
```

- [ ] **Step 4: Kit bauen und Test laufen lassen**

Run: `ddev exec pnpm build && ddev mutagen sync`
Expected: Build grün; danach existiert `packages/template-kit/dist/kit/tooling/cli.js` auch auf dem Mac.

Run (auf dem Mac): `pnpm --dir e2e test toolkit.spec.ts`
Expected: `1 passed` (plus Setup-Projekt). Laufzeit vor allem `pnpm install` (erstes Mal bis ~1 min). Prüfpunkte:
- `pnpm install` scheitert an `engineStrict` → Node auf dem Mac < 24: `mise use -g node@24` bzw. die Projektversion nutzen.
- Overlay erscheint nicht mit `template.liquid:1` → in der Konsole des Dev-Servers die Render-Antwort prüfen; die Zeile kommt von openbill (`RenderError::line`), der Test erwartet die erste Zeile, weil der Fehler dort steht.
- `kitAlive` ist weg → Vite hat neu geladen: in der Ausgabe von `pnpm dev` nach `page reload` suchen; Task 4 (`handleHotUpdate`/`hotUpdate`) nachschärfen.
- `scrollY` springt → Seitenhöhe der Vorschau hat sich verändert (ändert der Marker die Seitenzahl, Scroll-Ziel auf 300 senken – der Marker ist eine Zeile).

- [ ] **Step 5: Ganze Suite einmal laufen lassen**

Run (auf dem Mac, eine Minute nach dem letzten Lauf wegen des Login-Throttles): `pnpm --dir e2e test`
Expected: alle Tests grün

- [ ] **Step 6: Committen**

```bash
git add e2e/global-setup.ts e2e/tests/toolkit.spec.ts
git commit -m "test(e2e): toolkit download, live preview, push and pack against DDEV" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 15: Doku `template-toolkit` (en/de) und CLAUDE.md

**Files:**
- Create: `docs/en/template-toolkit.md`, `docs/de/template-toolkit.md`
- Modify: `docs/.vitepress/config.ts` (`pages`, Labels `en`/`de`)
- Modify: `docs/en/templates.md`, `docs/de/templates.md` (Abschnitt „Template editor“/„Template-Editor“)
- Modify: `docs/en/api.md`, `docs/de/api.md` (Zeile `templates:write`)
- Modify: `docs/en/development.md`, `docs/de/development.md` (Abschnitt zum Kit)
- Modify: `tests/Unit/DocsTest.php`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: alles aus Task 1–14 (Verhalten, Befehle, Meldungen).
- Produces: Doku-Seite `/en/template-toolkit`, `/de/template-toolkit`; aktuelle CLAUDE.md (Stand Phase 9, Kit, Fallstricke, Phase-10-Hinweis).

- [ ] **Step 1: Failing Doku-Test schreiben**

An `tests/Unit/DocsTest.php` anhängen:

```php
it('explains the toolkit token, pnpm run pack and local certificates on the toolkit page', function () {
    $root = dirname(__DIR__, 2);

    expect((string) file_get_contents("{$root}/docs/en/template-toolkit.md"))
        ->toContain('read access to all documents', '.env.local', 'pnpm run pack', '--use-system-ca', 'pnpm pull --force')
        ->and((string) file_get_contents("{$root}/docs/de/template-toolkit.md"))
        ->toContain('lesender Zugriff auf alle Dokumente', '.env.local', 'pnpm run pack', '--use-system-ca', 'pnpm pull --force');
});
```

Run: `ddev artisan test --filter=DocsTest`
Expected: FAIL (`file_get_contents(…/docs/en/template-toolkit.md): Failed to open stream`)

- [ ] **Step 2: `docs/en/template-toolkit.md` schreiben**

````md
# Template toolkit

The template toolkit lets you write a template in your own editor with a live preview: change `template.liquid`, save, and a moment later the preview in your browser shows the result – rendered by your openbill instance, with real documents or sample data, laid out in pages like the PDF. When you are done, `pnpm push` writes the files back to openbill.

## Requirements

- Node.js 24 or newer and pnpm (`corepack enable` sets pnpm up).
- An openbill instance your computer can reach. The toolkit renders on the instance; without it there is no preview.
- An imported or duplicated template. The built-in templates (Klar, Kante, Leise) are read-only: open one and choose **Duplicate to customize** first.

## Download

Open the template in the editor and choose **Toolkit → Download toolkit**. Unsaved changes are saved first (**Save and download**). The ZIP contains one folder `openbill-<template>`:

| Path | Content |
|---|---|
| `template/` | the template as package files: `manifest.json`, `template.liquid`, `header.liquid`, `footer.liquid`, `styles.css`, `assets/…` |
| `.env.local` | `OPENBILL_URL` (the address you use openbill under), `OPENBILL_TOKEN`, `OPENBILL_TEMPLATE_ID` |
| `.gitignore` | keeps `.env.local`, `node_modules/` and packed ZIPs out of git |
| `package.json`, `pnpm-workspace.yaml`, `vite.config.js`, `index.html`, `assets/`, `tooling/` | the toolkit itself, prebuilt; it only installs Vite |
| `README.md` | the short version of this page |

### The token

Every download creates a new token for you, named *Toolkit: &lt;template&gt; (&lt;date&gt;)*, with the abilities `templates:render` and `templates:write`, bound to this template. It can

- render every document of the instance in the preview – **this is read access to all documents** (customers, addresses, positions, amounts), the same as `templates:render` in the [REST API](/en/api);
- read and write this one template (`GET /api/templates/{id}`, `GET /api/templates/{id}/package`, `PUT /api/templates/{id}/files`).

It cannot change documents, customers or settings, cannot read or change other templates, cannot delete or duplicate this template, cannot create tokens and cannot use MCP. Keep `.env.local` private. The token appears under **Settings → API & MCP** as *Toolkit · &lt;template&gt;*; **Revoke** ends it at once. Deleting the template deletes its toolkit tokens. Older downloads keep working until you revoke their tokens.

## Start

```bash
unzip openbill-toolkit-<template>.zip
cd openbill-<template>
pnpm install
pnpm dev
```

Open http://localhost:5180 (another port: `pnpm dev --port 5181`).

## The preview page

- **Data** switches between the sample scenarios (short and long invoice, small business, reverse charge, quote with optional items; **Language** English or German) and your recent documents, drafts included. It starts with the newest document, like the template editor.
- **Areas** shows the header, content and footer areas; on the right you see the page count.
- **Fields** lists the core and custom fields of every level; a click copies the Liquid expression with the fitting filter. Fields that `manifest.json` lists in `expectedFields` but openbill does not know are marked *missing*: they stay empty until you create them under [Custom fields](/en/custom-fields).
- Errors appear in a box at the bottom right: Liquid errors with file, line and the lines around it (`template.liquid:12`), a broken `manifest.json` with its line, and connection problems. The preview below keeps the last working state.

Every save in `template/` renders again after a short pause. The page does not reload and keeps its scroll position. Several saves in a row cause one render; an older answer never replaces a newer one.

**Assets:** The preview uses the assets saved in openbill (`POST /api/render` takes no files). New or changed files in `template/assets/` appear after `pnpm push`; the page says so when you change them.

::: v-pre
Example: a click on *document → number* copies `{{ document.number }}`, on *position → unit_price* `{{ p.unit_price | money }}` (positions are read inside `{% for p in … %}`). The [Liquid reference](/en/templates#liquid-reference) explains the context and the filters.
:::

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | preview at http://localhost:5180 |
| `pnpm push` | writes all files of `template/` to openbill (`PUT /api/templates/{id}/files`): the four parts, `manifest.json` and the complete assets list (files missing locally are removed in openbill). Checked first, before anything is sent: only package files, assets png, jpg, jpeg, gif, webp, svg, woff, woff2, ttf, otf up to 2 MB each, 20 MB in total, at most 100 files, no symbolic links, valid `manifest.json`. |
| `pnpm pull` | fetches the saved template into `template/` and the field schema into `schema.json`. When local files differ, it stops and lists them; `pnpm pull --force` overwrites them and removes local package files openbill does not have. |
| `pnpm run pack` | packs `template/` as template package (`<name>-<version>.zip`, or `--out file.zip`) for **Templates → Import ZIP**, e.g. on another instance. Same checks as `push`. |

Use `pnpm run pack`: `pnpm pack` without `run` is pnpm's own command and creates an npm tarball.

## Local instance with its own certificate

Node does not trust the certificates of a local development CA (DDEV, mkcert) by default; the toolkit then reports *Node does not trust the certificate*. Start it with the system certificate store:

```bash
NODE_OPTIONS=--use-system-ca pnpm dev
NODE_OPTIONS=--use-system-ca pnpm push
```

## Troubleshooting

| Message | What to do |
|---|---|
| Cannot reach … | Start openbill, or correct `OPENBILL_URL` in `.env.local`. |
| openbill refused the token (401) | The token was revoked. Download the toolkit again, or put a new token into `.env.local`. |
| The token may not do this (403) | `OPENBILL_TEMPLATE_ID` points to another template than the token. |
| Built-in templates are read-only | Duplicate the template and download the toolkit of the copy. |
| Missing OPENBILL_URL … | `.env.local` is missing or incomplete. |
| Nothing was pushed: fix template/ first | The list below names every file that the import would refuse. |
| The template toolkit is missing in this installation (download) | The operator did not build the kit (`pnpm build`); the Docker image contains it. |

## Security

- The token stays in the dev server (Node). The preview page never receives it, and Vite never serves `.env.local`.
- The dev server answers its preview endpoints only for `localhost` (also against DNS rebinding from a web page) and accepts changes only as JSON.
- Rendering stays on the server, with the same sandbox as everywhere in openbill: no scripts, no external resources.
````

- [ ] **Step 3: `docs/de/template-toolkit.md` schreiben**

````md
# Template-Toolkit

Mit dem Template-Toolkit schreibst du ein Template in deinem eigenen Editor mit Live-Vorschau: `template.liquid` ändern, speichern, und einen Moment später zeigt die Vorschau im Browser das Ergebnis – gerendert von deiner openbill-Instanz, mit echten Dokumenten oder Beispieldaten, in Seiten aufgeteilt wie das PDF. Wenn du fertig bist, schreibt `pnpm push` die Dateien zurück nach openbill.

## Voraussetzungen

- Node.js 24 oder neuer und pnpm (`corepack enable` richtet pnpm ein).
- Eine openbill-Instanz, die dein Rechner erreicht. Das Toolkit rendert auf der Instanz; ohne sie gibt es keine Vorschau.
- Ein importiertes oder dupliziertes Template. Die mitgelieferten Templates (Klar, Kante, Leise) sind schreibgeschützt: erst öffnen und **Duplizieren, um es anzupassen** wählen.

## Herunterladen

Öffne das Template im Editor und wähle **Toolkit → Toolkit herunterladen**. Ungespeicherte Änderungen werden vorher gespeichert (**Speichern und herunterladen**). Das ZIP enthält einen Ordner `openbill-<template>`:

| Pfad | Inhalt |
|---|---|
| `template/` | das Template als Paketdateien: `manifest.json`, `template.liquid`, `header.liquid`, `footer.liquid`, `styles.css`, `assets/…` |
| `.env.local` | `OPENBILL_URL` (die Adresse, unter der du openbill nutzt), `OPENBILL_TOKEN`, `OPENBILL_TEMPLATE_ID` |
| `.gitignore` | hält `.env.local`, `node_modules/` und gepackte ZIPs aus Git heraus |
| `package.json`, `pnpm-workspace.yaml`, `vite.config.js`, `index.html`, `assets/`, `tooling/` | das Toolkit selbst, vorgebaut; es installiert nur Vite |
| `README.md` | die Kurzfassung dieser Seite (Englisch) |

### Der Token

Jeder Download legt einen neuen Token für dich an, Name *Toolkit: &lt;Template&gt; (&lt;Datum&gt;)*, mit den Fähigkeiten `templates:render` und `templates:write`, gebunden an dieses Template. Er kann

- jedes Dokument der Instanz in der Vorschau rendern – **das ist lesender Zugriff auf alle Dokumente** (Kunden, Adressen, Positionen, Beträge), genau wie `templates:render` in der [REST-API](/de/api);
- dieses eine Template lesen und schreiben (`GET /api/templates/{id}`, `GET /api/templates/{id}/package`, `PUT /api/templates/{id}/files`).

Er kann keine Dokumente, Kunden oder Einstellungen ändern, andere Templates weder lesen noch ändern, dieses Template weder löschen noch duplizieren, keine Tokens anlegen und kein MCP nutzen. Gib `.env.local` nicht weiter. Der Token steht unter **Einstellungen → API & MCP** als *Toolkit · &lt;Template&gt;*; **Widerrufen** beendet ihn sofort. Wird das Template gelöscht, verschwinden seine Toolkit-Tokens mit. Ältere Downloads funktionieren weiter, bis du ihre Tokens widerrufst.

## Starten

```bash
unzip openbill-toolkit-<template>.zip
cd openbill-<template>
pnpm install
pnpm dev
```

Öffne http://localhost:5180 (anderer Port: `pnpm dev --port 5181`).

## Die Vorschau-Seite

Die Seite des Toolkits ist englisch beschriftet.

- **Data** wechselt zwischen den Beispielszenarien (kurze und lange Rechnung, Kleinunternehmer, Reverse Charge, Angebot mit optionalen Positionen; **Language** Englisch oder Deutsch) und deinen letzten Dokumenten, auch Entwürfen. Sie startet mit dem neuesten Dokument, wie der Template-Editor.
- **Areas** zeigt Kopfzeile, Inhalt und Fußzeile als Bereiche; rechts steht die Seitenzahl.
- **Fields** listet Kern- und eigene Felder jeder Ebene; ein Klick kopiert den Liquid-Ausdruck mit passendem Filter. Felder, die `manifest.json` unter `expectedFields` nennt, die openbill aber nicht kennt, sind als *missing* markiert: Sie bleiben leer, bis du sie unter [Eigene Felder](/de/custom-fields) anlegst.
- Fehler erscheinen in einem Kasten unten rechts: Liquid-Fehler mit Datei, Zeile und den Zeilen drumherum (`template.liquid:12`), ein kaputtes `manifest.json` mit Zeile und Verbindungsprobleme. Die Vorschau darunter zeigt den letzten funktionierenden Stand.

Jedes Speichern in `template/` rendert nach einer kurzen Pause neu. Die Seite lädt nicht neu und behält ihre Scroll-Position. Mehrere Speichervorgänge hintereinander ergeben ein Rendern; eine ältere Antwort ersetzt nie eine neuere.

**Assets:** Die Vorschau nutzt die in openbill gespeicherten Assets (`POST /api/render` nimmt keine Dateien). Neue oder geänderte Dateien in `template/assets/` erscheinen nach `pnpm push`; die Seite weist darauf hin, sobald du sie änderst.

::: v-pre
Beispiel: Ein Klick auf *document → number* kopiert `{{ document.number }}`, auf *position → unit_price* `{{ p.unit_price | money }}` (Positionen liest man in `{% for p in … %}`). Die [Liquid-Referenz](/de/templates#liquid-referenz) erklärt Kontext und Filter.
:::

## Befehle

| Befehl | Was er tut |
|---|---|
| `pnpm dev` | Vorschau unter http://localhost:5180 |
| `pnpm push` | schreibt alle Dateien aus `template/` nach openbill (`PUT /api/templates/{id}/files`): die vier Teile, `manifest.json` und die vollständige Asset-Liste (lokal fehlende Dateien werden in openbill entfernt). Vorher geprüft, bevor etwas gesendet wird: nur Paketdateien, Assets png, jpg, jpeg, gif, webp, svg, woff, woff2, ttf, otf bis 2 MB je Datei, 20 MB insgesamt, höchstens 100 Dateien, keine symbolischen Links, gültiges `manifest.json`. |
| `pnpm pull` | holt das gespeicherte Template nach `template/` und das Feldschema nach `schema.json`. Weichen lokale Dateien ab, bricht es ab und listet sie; `pnpm pull --force` überschreibt sie und entfernt lokale Paketdateien, die openbill nicht hat. |
| `pnpm run pack` | packt `template/` als Template-Paket (`<name>-<version>.zip`, oder `--out datei.zip`) für **Templates → ZIP importieren**, z. B. auf einer anderen Instanz. Gleiche Prüfungen wie `push`. |

Nutze `pnpm run pack`: `pnpm pack` ohne `run` ist ein eigener Befehl von pnpm und erzeugt ein npm-Tarball.

## Lokale Instanz mit eigenem Zertifikat

Node vertraut den Zertifikaten einer lokalen Entwicklungs-CA (DDEV, mkcert) standardmäßig nicht; das Toolkit meldet dann *Node does not trust the certificate*. Starte es mit dem Zertifikatsspeicher des Systems:

```bash
NODE_OPTIONS=--use-system-ca pnpm dev
NODE_OPTIONS=--use-system-ca pnpm push
```

## Fehlersuche

| Meldung | Was zu tun ist |
|---|---|
| Cannot reach … | openbill starten oder `OPENBILL_URL` in `.env.local` korrigieren. |
| openbill refused the token (401) | Der Token wurde widerrufen. Toolkit neu herunterladen oder einen neuen Token in `.env.local` eintragen. |
| The token may not do this (403) | `OPENBILL_TEMPLATE_ID` zeigt auf ein anderes Template als der Token. |
| Built-in templates are read-only | Template duplizieren und das Toolkit der Kopie herunterladen. |
| Missing OPENBILL_URL … | `.env.local` fehlt oder ist unvollständig. |
| Nothing was pushed: fix template/ first | Die Liste darunter nennt jede Datei, die der Import ablehnen würde. |
| Das Template-Toolkit fehlt in dieser Installation (beim Download) | Der Betreiber hat das Kit nicht gebaut (`pnpm build`); das Docker-Image enthält es. |

## Sicherheit

- Der Token bleibt im Dev-Server (Node). Die Vorschau-Seite bekommt ihn nie, und Vite liefert `.env.local` nie aus.
- Der Dev-Server beantwortet seine Vorschau-Endpunkte nur für `localhost` (auch gegen DNS-Rebinding aus einer Webseite) und nimmt Änderungen nur als JSON an.
- Gerendert wird weiter auf dem Server, mit derselben Sandbox wie überall in openbill: keine Skripte, keine externen Ressourcen.
````

Anker prüfen: `grep -n "^## Liquid" docs/de/templates.md docs/en/templates.md` → die Überschriften heißen „Liquid-Referenz“ bzw. „Liquid reference“ (VitePress-Anker `#liquid-referenz` / `#liquid-reference`); sonst die Links anpassen.

- [ ] **Step 4: Sidebar und Querverweise**

`docs/.vitepress/config.ts`:

```ts
const pages = ['documents', 'custom-fields', 'templates', 'template-toolkit', 'e-invoice', 'settings', 'api', 'mcp', 'development'];
```

In `en` nach `templates: 'Templates',` ergänzen: `'template-toolkit': 'Template toolkit',`; in `de` nach `templates: 'Templates',`: `'template-toolkit': 'Template-Toolkit',`.

`docs/en/templates.md`, Abschnitt „Template editor“: an den Absatz „The editor has five tabs …“ anhängen:

```md
To work in your own editor with a live preview, download the [template toolkit](/en/template-toolkit) (**Toolkit** in the editor header).
```

`docs/de/templates.md`, Abschnitt „Template-Editor“: an den Absatz „Der Editor hat fünf Tabs …“ anhängen:

```md
Wer lieber im eigenen Editor mit Live-Vorschau arbeitet, lädt das [Template-Toolkit](/de/template-toolkit) herunter (**Toolkit** im Kopf des Editors).
```

`docs/en/api.md`, Zeile `templates:write` ersetzen:

```md
| `templates:write` | reading and writing **one** template (`--template=<id>`): `GET /api/templates/{id}`, `GET /api/templates/{id}/package`, `PUT /api/templates/{id}/files`. The [template toolkit](/en/template-toolkit) download creates such a token together with `templates:render`. |
```

`docs/de/api.md`, Zeile `templates:write` ersetzen:

```md
| `templates:write` | **ein** Template lesen und schreiben (`--template=<id>`): `GET /api/templates/{id}`, `GET /api/templates/{id}/package`, `PUT /api/templates/{id}/files`. Der Download des [Template-Toolkits](/de/template-toolkit) legt so einen Token zusammen mit `templates:render` an. |
```

`docs/en/development.md`: im Kommandoblock nach der Zeile mit `pnpm --filter "./packages/*" test` ergänzen

```bash
ddev exec pnpm --filter @openbill/template-kit build   # template kit only → packages/template-kit/dist/kit (pnpm build does it, too)
```

und nach dem Absatz über `packages/paged-preview`:

```md
`packages/template-kit` is the [template toolkit](/en/template-toolkit): a prebuilt preview page (React, `paged-preview`), the Vite plugin `openbill-render` and the CLI `push`/`pull`/`pack` (`src/tooling`), and the end user's files (`kit-files/`). `pnpm build` assembles it in `packages/template-kit/dist/kit`; the toolkit download zips that folder (`OPENBILL_TOOLKIT_PATH` points elsewhere, the download answers 503 without it). To try a change like a template author: build, unzip a download outside the repository and run `pnpm install && pnpm dev` there.
```

`docs/de/development.md` entsprechend:

```bash
ddev exec pnpm --filter @openbill/template-kit build   # nur das Template-Kit → packages/template-kit/dist/kit (pnpm build macht das mit)
```

```md
`packages/template-kit` ist das [Template-Toolkit](/de/template-toolkit): eine vorgebaute Vorschau-Seite (React, `paged-preview`), das Vite-Plugin `openbill-render` und die CLI `push`/`pull`/`pack` (`src/tooling`) sowie die Dateien für Endnutzer (`kit-files/`). `pnpm build` baut es nach `packages/template-kit/dist/kit`; der Toolkit-Download packt diesen Ordner (`OPENBILL_TOOLKIT_PATH` zeigt woandershin, ohne ihn antwortet der Download mit 503). Eine Änderung wie ein Template-Autor ausprobieren: bauen, einen Download außerhalb des Repos entpacken und dort `pnpm install && pnpm dev` starten.
```

- [ ] **Step 5: CLAUDE.md aktualisieren**

Ersetzen bzw. ergänzen (Wortlaut verbindlich, Stellen wie angegeben):

- „Was openbill ist“: `Stand: Phase 8 (…; MCP-Server unter /mcp)` → `Stand: Phase 9 (…; MCP-Server unter /mcp; Template-Toolkit zum Herunterladen im Template-Editor)`.
- „Tech Stack“, Zeile UI: nach dem Eintrag zu `packages/paged-preview` einfügen: `, Workspace-Paket packages/template-kit (Template-Toolkit: vorgebaute Vorschau-Seite mit React + paged-preview, Vite-Plugin openbill-render, CLI push/pull/pack, fflate eingebündelt; Endnutzer installiert nur vite)`.
- „Kommandos“, nach der Zeile `ddev exec 'pnpm --filter "./packages/*" test'`:

```bash
ddev exec pnpm --filter @openbill/template-kit build   # Template-Kit → packages/template-kit/dist/kit (pnpm build baut App + Kit)
ddev exec pnpm --filter @openbill/template-kit test    # Vitest des Kits (Plugin mit echtem Vite + Fake-Instanz, CLI)
```

- „Architektur (Stand Phase 8)“ → „Architektur (Stand Phase 9)“ und am Ende des Abschnitts (nach „Leistungsart und Kundenart“) anhängen:

```md
- **Template-Toolkit** (`packages/template-kit`, Doku `docs/*/template-toolkit.md`): `src/tooling` = Node-Seite: `env.ts` (`.env.local`, `OPENBILL_*` aus der Umgebung gewinnen), `template-files.ts` (Teile/Manifest lesen, `listTemplateFiles` prüft wie der Import, `LIMITS`/`ASSET_EXTENSIONS` – `limits.drift.test.ts` vergleicht mit `config/openbill.php` und `TemplatePackage::ASSET_TYPES`), `client.ts` (API mit Token, `describeFailure` → lesbare `KitError`), `runtime.ts` (Datei-Event → 80 ms → `POST /api/render` mit `template_id` + Teilen + Manifest, neueste gewinnt, Ausschnitt der lokalen Datei, letztes fehlerfreies Ergebnis bleibt), `plugin.ts` (`openbillRender()`: Watcher, HMR-Event `openbill:render` über `server.ws.send`, Endpunkte `GET /__openbill/state`, `POST /__openbill/source` nur für localhost und nur JSON, virtuelles Modul `/@openbill/bridge.js` reicht HMR-Events als `window`-Event an die vorgebaute Seite), `cli.ts`/`push.ts`/`pull.ts`/`pack.ts`. `src/app` = Vorschau-Seite (React, `@openbill/paged-preview` mit `lazy`, eigene CSS mit DESIGN-Grundtokens, nur Englisch); `fields.ts` ist eine Kopie von `resources/js/fields/expression.ts` (`expression.drift.test.ts`). `kit-files/` = Endnutzer-`package.json` (nur `vite`, Skripte `vite` bzw. `node tooling/cli.js …`), `pnpm-workspace.yaml` (eigenes Projekt, `engineStrict`), `vite.config.js`, `README.md`. `pnpm build` → `packages/template-kit/dist/kit` (Vorschau-Build, Werkzeug-Build `vite.tooling.config.ts`, `scripts/assemble.mjs`).
- **Toolkit-Download:** `POST /{locale}/templates/{id}/toolkit` (`TemplateToolkitController`, nur Sitzung, `throttle:10,1`, Fehler als Problem Details über `routeIs('templates.toolkit')` in `bootstrap/app.php`) → `DownloadTemplateToolkit`: mitgelieferte Templates 409 `template_built_in`, Kit fehlt 503 `toolkit_unavailable` (beides ohne Token), sonst `IssueApiToken` mit `['templates:render', 'templates:write']` + `template_id`, Name `Toolkit: <Template> (<Datum>)`, und `App\Rendering\ToolkitPackage` (Kit aus `config('openbill.toolkit.path')` ohne `template/`, `node_modules/`, `.env*`, Symlinks; `template/` aus `TemplatePackage::files()`; `.env.local` mit `OPENBILL_URL` = Schema+Host der Anfrage; `.gitignore`) in einem Ordner `openbill-<slug>/`, Antwort `no-store`. UI: `templates/editor/toolkit-slot.tsx` (`apiBlob()` + `saveBlob()`). `ToolkitTokenScopeTest` hält Review Focus 5 mit dem Token aus dem echten ZIP fest.
```

- „Fallstricke“, am Ende anhängen:

```md
- `pnpm pack` ist ein eingebauter pnpm-Befehl (npm-Tarball) und schlägt Skripte gleichen Namens: im Kit immer `pnpm run pack` schreiben (Doku, README, Dialog). `pnpm push`/`pnpm pull` sind keine pnpm-Befehle und laufen als Skript.
- Der Toolkit-Download braucht das gebaute Kit (`ddev exec pnpm build` oder `… --filter @openbill/template-kit build`, danach ggf. `ddev mutagen sync`); sonst 503 `toolkit_unavailable`. `e2e/global-setup.ts` bricht ohne Kit ab (außer mit `OPENBILL_URL`). **Phase 10:** Die Node-Stage führt `pnpm build` aus, die PHP-Stage kopiert `packages/template-kit/dist/kit` an denselben Pfad (oder `OPENBILL_TOOLKIT_PATH` setzen).
- Node vertraut der mkcert-CA von DDEV nicht: Kit-Befehle gegen `https://openbill.ddev.site` mit `NODE_OPTIONS=--use-system-ca` starten (`toolkit.spec.ts` setzt das). Der Playwright-Test entpackt das Kit nach `os.tmpdir()`, nie ins Repo (sonst hält pnpm `e2e/` für den Workspace).
- Die Vorschau-Seite des Kits ist ein vorgebautes Bundle ohne `import.meta.hot`; HMR-Events kommen nur über das virtuelle Modul `/@openbill/bridge.js` des Plugins an. Middleware des Plugins hängt **vor** Vites Host-Check und CORS: Prüfungen (localhost, JSON) stehen deshalb im Plugin selbst.
- Ändert sich `resources/js/fields/expression.ts`, `packages/template-kit/src/app/fields.ts` mitziehen (`expression.drift.test.ts` schlägt sonst fehl). Ändern sich die Paketgrenzen in `config/openbill.php` oder `TemplatePackage::ASSET_TYPES`, `LIMITS`/`ASSET_EXTENSIONS` im Kit anpassen (`limits.drift.test.ts`).
- Die Vorschau im Kit nutzt die gespeicherten Assets des Templates: `POST /api/render` nimmt keine Dateien; neue Assets erst nach `pnpm push` sichtbar (Hinweis `assets_changed`).
```

- [ ] **Step 6: Doku bauen und Tests laufen lassen**

Run: `ddev artisan test --filter=DocsTest && ddev exec pnpm --dir docs build`
Expected: DocsTest PASS; VitePress `build complete`, keine „dead link“-Fehler (sonst Anker aus Step 3 prüfen)

- [ ] **Step 7: Committen**

```bash
git add docs/en docs/de docs/.vitepress/config.ts tests/Unit/DocsTest.php CLAUDE.md
git commit -m "docs: template toolkit (en/de), cross references and CLAUDE.md for phase 9" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Abschluss – Screenshots, Prüfungen, Push, PR, CI

**Files:**
- keine neuen (ggf. Korrekturen aus der Sichtprüfung in den betroffenen Dateien)

**Interfaces:**
- Consumes: alles aus Task 1–15.
- Produces: PR `phase-09-toolkit` → `main` mit grüner CI (`tests`), nicht gemergt.

- [ ] **Step 1: Alles lokal prüfen**

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
ddev exec pnpm --dir docs build
```
Expected: alles grün; `pnpm build` endet mit der Zeile `template kit → …dist/kit: README.md, assets, index.html, package.json, pnpm-workspace.yaml, tooling, vite.config.js`.

- [ ] **Step 2: Screenshots erzeugen und ansehen**

Run (auf dem Mac, nach `ddev mutagen sync`): `pnpm --dir e2e test toolkit.spec.ts`
Expected: `1 passed`; neu in `e2e/screenshots/`: `toolkit-1440-light.png`, `toolkit-1440-dark.png`, `toolkit-dialog-1440.png`.

Die drei Bilder mit dem Read-Werkzeug öffnen und prüfen:
- Vorschau-Seite hell und dunkel: Kopfleiste mit Template-Name, Version, Instanz-Chip (grüner Punkt), **Data**, **Language**, **Areas**, Seitenzahl; links die Feldliste auf `surface-2` mit Ebenen und Codes; Mitte weiße Seiten mit Schatten und Kopf-/Fußzeile; kein Fehler-Overlay; dunkel: dunkler Hintergrund, Seiten bleiben weiß, Texte lesbar, keine hellen Flächen außer den Seiten.
- Dialog: Titel „Template toolkit“, drei Schritte mit Code-Chips, gelber Token-Hinweis mit Link, Knöpfe „Cancel“ und „Download toolkit“, Gestaltung wie die anderen Dialoge (Radien, Schatten, Abstände).

Was davon abweicht, beheben (CSS in `packages/template-kit/src/app/styles.css` bzw. Klassen in `toolkit-slot.tsx`), Kit neu bauen (`ddev exec pnpm build`), Test erneut laufen lassen, Bilder erneut ansehen. Korrekturen committen:

```bash
git add packages/template-kit resources/js/templates/editor/toolkit-slot.tsx
git commit -m "fix(toolkit): polish preview page and dialog after screenshot review" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(nur, wenn es Änderungen gab)

- [ ] **Step 3: Vor dem Push prüfen**

Run:
```bash
test "$(git config user.email)" = "rafael@hauss.dev" && echo ok
git log --format='%ae %ce' main..HEAD | sort -u
git diff main --stat
git diff main | grep -nE 'openbill_[A-Za-z0-9]{20,}' || echo "no tokens"
```
Expected: `ok`; Author- und Committer-Adresse ausschließlich `rafael@hauss.dev`; im Diff keine Binärdateien, keine `dist/`-Ordner, keine `.env.local`, keine echten Tokens (`no tokens`), nur fiktive Namen und Hosts.

- [ ] **Step 4: Pushen und PR öffnen**

```bash
git push -u origin phase-09-toolkit
gh pr create --base main --head phase-09-toolkit --title "feat: phase 9 template toolkit" --body-file - <<'EOF'
## Phase 9: Template-Toolkit

- `packages/template-kit`: prebuilt preview page (React + `@openbill/paged-preview`, own CSS with the DESIGN.md base tokens): data source (sample scenarios with language, real documents), field list with click-to-copy and missing expected fields, error overlay with file, line and excerpt, "Areas", page count.
- Vite plugin `openbill-render`: watches `template/`, renders via `POST /api/render` with the token from `.env.local`, sends HMR event `openbill:render` (no reload, scroll position kept), readable network/401/403/409/413/422/5xx and broken-manifest messages; endpoints `/__openbill/*` only for localhost and JSON; the token never reaches the browser.
- CLI `pnpm push` (checks like the import before upload), `pnpm pull` (template + schema, `--force` guard), `pnpm run pack` (import format, safe paths).
- Build artefact `packages/template-kit/dist/kit` (`pnpm build` builds app + kit); Laravel reads it via `config('openbill.toolkit.path')` (`OPENBILL_TOOLKIT_PATH`), 503 without it. Phase 10: copy it from the Node stage.
- `POST /{locale}/templates/{id}/toolkit` (session only): token with `templates:render` + `templates:write` bound to the template, ZIP with kit, saved template, `.env.local`, `.gitignore`; built-in templates → 409.
- Template editor: "Toolkit" dialog (steps, token warning, save-and-download).
- Tests: Vitest for env, files, client, runtime, plugin (real Vite + fake instance), push/pull/pack, preview logic; Pest for ZIP content, download errors and the token binding (review focus 5); Playwright: download → `pnpm install && pnpm dev` → change `template.liquid` → preview updates without reload → `pnpm push` → `pnpm run pack` imports.
- Docs: `template-toolkit` (en/de), templates/api/development, CLAUDE.md.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
```

Expected: `gh` gibt die PR-URL aus.

- [ ] **Step 5: CI abwarten**

Run: `gh pr checks --watch`
Expected: `tests` grün (weitere Jobs wie `einvoice` dürfen anders heißen; nicht Pflicht). Bei Rot: Log mit `gh run view --log-failed` lesen, beheben, committen, pushen, erneut warten. **Nicht mergen** – das macht der Orchestrator.

