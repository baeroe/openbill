# Phase 11: Feinschliff – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** openbill ist bereit für v0.1.0: die offenen „deferred“-Punkte aus dem Ledger sind erledigt (Logout, abgelaufene Sitzung, Toast/Animationen, Datumsfilter, Aufräumen ungenutzter Bilder, Liquid-Mathe, Trimmen, `X-Forwarded-Prefix`, Dependabot, KoSIT-Beurteilung), die Doku liegt mit Landingpage im Stil von prevju, eigenem Theme und reproduzierbaren Screenshots (en/de) auf GitHub Pages unter `https://baeroe.github.io/openbill/`, README, Repo-Metadaten, Projektgedächtnis (`docs/history/`) und `CLAUDE.md` sind final. Abnahme: Doku baut, Seiten vollständig in beiden Sprachen, alle CI-Jobs grün. **Kein Release-Tag.**

**Architecture:** Kleine, getestete Änderungen an bestehenden Bausteinen statt neuer Schichten: Logout und Session-Ablauf in `resources/js/layouts/logout.ts` bzw. `resources/js/editor/unsaved-drafts.ts` + `autosave-registry.ts` (sessionStorage, nur für dieselbe Person), Toast-Pausen als „Halter“ in `resources/js/lib/toast.ts`, Exit-Animationen über Radix-`data-state=closed`, Datumsfilter über die schon vorhandenen API-Filter `date_from`/`date_to` (`App\Support\DocumentQuery`), Aufräumen als Action `PruneUnusedImages` + Artisan-Befehl `app:prune-images`, Liquid-Ganzzahlen über `BigInteger`. Die Doku bekommt eine konfigurierbare VitePress-`base` (`DOCS_BASE`), ein Theme aus den App-Tokens (hell + dunkel) und einen Pages-Workflow; Screenshots erzeugt ein eigenes Playwright-Projekt `docs-screenshots` aus den Demo-Daten.

**Tech Stack:** Laravel 13, Pest 5, Larastan 6, React 19 + TypeScript, Vitest, Radix Dialog, Tailwind 4, keepsuit/liquid, brick/math 1.0, Playwright (Mac gegen DDEV), VitePress 1.6 + vitepress-plugin-llms, GitHub Actions (Pages: `configure-pages`, `upload-pages-artifact`, `deploy-pages`), Dependabot, `gh`.

**Spec:** `docs/superpowers/specs/2026-10-11-openbill-app-design.md` (bindend; Abschnitt 1 „Erfolgskriterien“ – letzter Punkt: Doku en + de beschreibt Setup, Betrieb, Templates, Toolkit, E-Rechnung, API und MCP; Abschnitt 10 – `docs.yml` (GitHub Pages bei Änderungen in `docs/`); Abschnitt 11 „Doku“ – VitePress, `/en/` + `/de/`, gleiche Dateinamen, `llms.txt` aus den englischen Seiten, Screenshots nur mit Demo-Daten). Master-Plan `docs/superpowers/plans/2026-10-11-openbill-app.md`, Abschnitt „Phase 11“. Referenzprojekt `baeroe/prevju` (öffentlich): `.github/workflows/docs.yml`, `docs/.vitepress/theme/*`, `docs/en/index.md`, `README.md`, `docs/history/*`. Offene Punkte: SDD-Ledger `.superpowers/sdd/2026-10-11-openbill-app/progress.md` (git-ignoriert, liegt lokal).

## Global Constraints

- Branch `phase-11-polish` (ist ausgecheckt). Git-Identität kommt aus `~/.gitconfig`; vor dem ersten Commit `test "$(git config user.email)" = "rafael@hauss.dev" && echo ok` → muss `ok` ausgeben, sonst stoppen und nachfragen. Nie `user.email`/`user.name` setzen.
- Jede Commit-Message endet mit der Zeile `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (in diesem Plan als zweites `-m`); die PR-Beschreibung endet mit `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- PHP, Composer, Artisan **nur in DDEV** (`ddev artisan …`, `ddev exec …`). JS nur mit **pnpm** (nie npm/npx; Einmal-Tools `pnpm dlx`). App-JS im Container (`ddev exec pnpm …`), `e2e/` auf dem Mac (`pnpm --dir e2e …`).
- Vor jedem Commit mit PHP: `ddev exec vendor/bin/pint` und `ddev exec vendor/bin/phpstan analyse --memory-limit=1G`. Vor jedem Commit mit TS: `ddev exec pnpm typecheck` und `ddev exec pnpm test`.
- Keine Geschäftslogik in Controllern/Commands/MCP-Tools: Abläufe in `app/Actions`, Regeln in `app/Domain`. Beträge nie als `float`.
- UI-Texte nur über Schlüssel in `lang/en.json` **und** `lang/de.json` (alphabetisch einsortieren; `tests/Unit/TranslationsTest.php`). Code und Kommentare Englisch, Doku und Plan-Prosa wie gehabt.
- Gestaltung nach `prototypes/clickdummy-v2/DESIGN.md`; Tokens aus `resources/css/app.css`. Kein tailwind-merge: `className`-Ergänzungen nur für Eigenschaften, die die Komponente nicht setzt (Ausnahme: Varianten wie `data-[state=closed]:` – die gewinnen über die Attribut-Spezifität).
- Doku: jede sichtbare Änderung im selben Commit in `docs/en/` **und** `docs/de/` (Du-Form). Interne Links immer mit Sprachpräfix (`/en/…`, `/de/…`). Liquid in `::: v-pre`.
- Demo-/Testdaten nur fiktiv: Studio Nordlicht, Hafenkontor Lindqvist, Fjord Analytics, Hotel Alpenglück, Kulturwerk Elbinsel; E-Mails nur `@example.com` bzw. `*.example`; Hosts `openbill.example`, `invoices.example.com`, `localhost`, `evil.example`. Keine echten Firmen, Arbeitgeber, Kunden, Hosts oder Personen – auch nicht in `docs/history/`. Einzige echte E-Mail-Adresse im Repo: `rafael@hauss.dev` (nur hier im Plan).
- CI: Pflicht-Job heißt `tests` und bleibt so benannt. Neue Prüfungen dort anhängen.
- Doku-Adresse bis zu einer eigenen Domain: `https://baeroe.github.io/openbill/` (VitePress `base` = `/openbill/` per `DOCS_BASE`; lokal und in DDEV `/`).
- **Kein Tag pushen, kein Release anlegen, nicht mergen.** Der Plan endet mit dem PR. v0.1.0 gibt der Nutzer frei; der Abschnitt `### 0.1.0` in `docs/{en,de}/upgrading.md` ist vorher fertig.
- Der Haken für Phase 10 im Abschnitt „Fortschritt“ des Master-Plans ist mit diesem Plan committet. Den Haken für Phase 11 setzt der Orchestrator nach dem Merge.

## Review Focus

- **Sitzung abgelaufen, während im Editor ungespeicherte Eingaben stehen:** Autosave bekommt 401 → openbill schickt zur Anmeldung; nach dem Login (dieselbe Person, im selben Tab, innerhalb eines Tages) ist die Eingabe beim Öffnen des Dokuments wieder da und wird gespeichert, mit Hinweis. Eine andere Person im selben Tab bekommt sie nie; ein inzwischen abgeschlossenes Dokument bekommt sie nicht. → Task 2 (`unsaved-drafts.test.ts`, `autosave-registry.test.ts`).
- **Abmelden mit schon beendeter Sitzung oder hängender Verbindung:** 419 (CSRF nach Sitzungsablauf) oder 401 auf `POST /logout` → gilt als abgemeldet (aufräumen, zur Anmeldung), nicht „Abmelden fehlgeschlagen“ bis zum Neuladen; ein hängender Request bricht nach 10 s mit Meldung ab; noch wartende Undo-Löschungen gehen vorher raus. → Task 1 (`logout.test.ts`).
- **Aufräumen löscht etwas, das noch gebraucht wird:** Ein Bild, auf das nur noch der Snapshot eines abgeschlossenen Dokuments verweist (altes Logo), ein Bild eines gelöschten Kunden mit Entwurf, ein gerade hochgeladenes, noch nicht gespeichertes Bild → bleiben; `--dry-run` löscht nichts. → Task 5 (`PruneUnusedImagesTest`).
- **Doku unter Unterpfad `/openbill/`:** Favicon, Assets, Screenshots, interne Links, `llms.txt` und die Weiterleitung von Pfaden ohne Sprache (`/openbill/` → `/openbill/en/`, `/openbill/development` → `/openbill/en/development`) funktionieren unter der Pages-Adresse, lokal unter `/`. → Task 9 (Build mit `DOCS_BASE`, `grep`, Playwright-Probe gegen `vitepress preview`), CI-Schritt `Docs`.
- **Getippte Datumsfilter in der URL:** `?date_from=2026-13-01&date_to=gestern` → wird ignoriert (Liste ungefiltert, kein 422/500); `date_from` nach `date_to` → leere Liste mit „Filter zurücksetzen“, kein Fehler. → Task 4 (`DocumentPagesTest`).

## Entscheidungen (geprüft am 2026-10-12)

| Thema | Entscheidung | Grund / Prüfung |
|---|---|---|
| Doku-Adresse | GitHub Pages per Actions unter `https://baeroe.github.io/openbill/`; `base` aus `DOCS_BASE` (Standard `/`), absolute Adresse aus `DOCS_URL` (für `llms.txt`-Links und `og:image`) | Repo ist öffentlich, Pages ist noch nicht aktiviert (`gh api repos/baeroe/openbill/pages` → 404, geprüft). Kommt später eine Domain: `DOCS_BASE` weglassen, `DOCS_URL` umstellen, `CNAME` – sonst nichts. |
| Theme | Tokens aus `resources/css/app.css` (hell **und** dunkel, `--muted` #5f626a wie nach dem A11y-Fix), Schibsted Grotesk über `@fontsource-variable/schibsted-grotesk` (bisher nur deklariert, nie geladen), `appearance` wieder an | Die App hat einen Dunkelmodus; die Doku zeigt jetzt dunkle Screenshots. Bisher lud das Theme die Schrift nicht und nutzte das alte, zu helle Grau. |
| Weiterleitung ohne Sprachpräfix | Theme liest `import.meta.env.BASE_URL` statt fest `/` | Mit `base` = `/openbill/` würde die alte Regel `/openbill/en/…` nach `/en/openbill/…` umleiten. |
| Screenshots | Eigenes Playwright-Projekt `docs-screenshots` (`DOCS_SCREENSHOTS=1`, Skript `pnpm --dir e2e docs:screenshots`), 1440×900, DPR 1, hell; `editor` zusätzlich dunkel; Ausgabe `docs/public/screenshots/{en,de}/` (eingecheckt). Die Review-Screenshots (`pnpm --dir e2e screenshots`, git-ignoriert) bleiben | Reproduzierbar aus `DemoSeeder` (global-setup seedet), englische UI für englische Seiten, deutsche für deutsche. DPR 1 hält die PNGs klein (13 Bilder je Sprache). |
| KoSIT-Validator | **Weggelassen**, begründet in `docs/*/e-invoice.md` und `docs/history/` | KoSIT liefert nur die XRechnung-Konfiguration (Task 8 prüft `scenarios.xml`): sie prüft zusätzlich BR-DE (u. a. Leitweg-ID BT-10, Verkäuferkontakt), was openbill bewusst nicht erzeugt (Spec 13). Die EN-16931-Regeln selbst prüft schon der Job `einvoice` mit dem offiziellen CEN-Schematron. Ein KoSIT-Job wäre also immer rot oder müsste BR-DE ausblenden. |
| `X-Forwarded-Prefix` | Wird auch von vertrauten Proxys **nicht** geglaubt (`App\Http\Middleware\TrustProxies::headers()`) | Laravel vertraut ihm standardmäßig (`HEADER_X_FORWARDED_PREFIX`, geprüft in `vendor/laravel/framework/src/Illuminate/Http/Middleware/TrustProxies.php`). openbill läuft nur an der Wurzel seines Hosts; ein Präfix landete in jeder erzeugten URL. |
| `TRUSTED_PROXIES` | Nur IP-Adressen oder CIDR-Netze; Doku sagt das ausdrücklich (kein Hostname, kein Docker-Dienstname) | Symfony vergleicht nur IPs; `traefik` passt auf nichts, die Header würden still ignoriert. Kein Code-Fallback: ungültige Einträge zu verwerfen würde auf die (weitere) Standardliste zurückfallen. |
| Abgelaufene Sitzung | Ungespeicherte Entwürfe gehen beim 401 nach `sessionStorage` (Schlüssel `openbill:unsaved:<id>`, mit Nutzer-ID und Zeit), werden beim nächsten Öffnen des Dokuments durch dieselbe Person geladen (höchstens 24 h, nur Entwürfe) und beim Abmelden gelöscht | Erfüllt den Hinweis in `CLAUDE.md` („Payload in sessionStorage sichern und nach dem Login anbieten“). `sessionStorage` gilt nur für den Tab; Nutzer-ID verhindert Weitergabe an eine andere Person am selben Rechner. |
| Logout | `POST /logout`: 401/419 = Sitzung war schon beendet → Erfolg; Timeout 10 s; vorher `flushAutosaves()` **und** `flushPendingDeletes()` (zusammen höchstens 3 s); Info-Toast „Abmelden …“ | Ledger Phase 6. Ohne 419-Regel sperrt ein abgelaufener CSRF-Token den Nutzer bis zum Neuladen ein. |
| Bilder aufräumen | Action `PruneUnusedImages` + `php artisan app:prune-images [--dry-run] [--min-age=24]`, kein Zeitplan | Sammelt alle Pfade `uploads/…`/`logos/…` aus Organisation (`logo_path`, `custom`), Kunden, Ansprechpartnern (auch gelöschten), Dokumenten, Positionen, Feld-Standardwerten und **allen Snapshots**; Dateien jünger als `--min-age` Stunden bleiben (Upload kommt vor dem Speichern des Formulars). Löschen ist Sache des Betreibers, daher kein Scheduler. |
| Liquid-Ganzzahlen | `plus`/`minus`/`times`/`divided_by` mit zwei Ganzzahlen rechnen über `BigInteger`; passt das Ergebnis nicht mehr in `int`, kommt ein exakter String | PHP wechselt bei Überlauf still zu `float` (`9.2233720368548E+18`); `intdiv(PHP_INT_MIN, -1)` wirft. Ledger Phase 3 M5. |
| `date` mit Zahl | Ganzzahl = Unix-Zeitstempel in `config('app.timezone')` (wie Liquids Standardfilter) | Ledger Phase 3; bisher leer. |
| Trimmen | `App\Support\TrimmedInput::strings()` in `UpdateOrganization`, `SaveTaxRate`, `SaveUnit`, `SaveTextBlock` (nur `name`), `IssueApiToken`; `SaveCustomer`/`SaveFieldDefinition`/`InviteUser` trimmen schon | Ledger Phase 4: `TrimStrings` sieht die JSON-Bodies der API und MCP-Argumente nie (geprüft: nur diese drei Actions trimmen). Freitexte (Textbaustein-Inhalt, Dokumenttexte) bleiben wie getippt. |
| Dependabot | Wöchentlich: `github-actions`, `composer`, `npm` (pnpm-Lockfile v9; `/` und `/e2e`), gruppiert; **kein** `docker` | Docker-Images sind an mehreren Stellen per Digest gepinnt und müssen gleich bleiben (`DockerSetupTest`); einzelne Dependabot-PRs würden das brechen. |
| Repo-Metadaten | Beschreibung angleichen, Website = Doku-Adresse, Topics: `xrechnung` raus (XRechnung mit Leitweg-ID ist nicht im Umfang), `docker`, `en16931`, `factur-x`, `inertiajs`, `mcp`, `mcp-server` dazu | Ist-Stand per `gh repo view` geprüft. |
| Nicht gemacht (Ledger, begründet) | Phase 4: 413 ohne CORS-Header (openbill nutzt kein CORS, UI und API sind gleiche Herkunft), `callAfterResolving` (interne Stilfrage ohne Wirkung), Entwurfs-Link rendert live (gewollt, dokumentiert); Phase 2: M-A (kein Action-Pfad zum Umhängen), M-B (erledigt: `ConvertDocument` sperrt mit `lockForUpdate`); Phase 3: M6 (dokumentiert in `templates.md`), „Filter nach `make()` nicht gewrappt“ (`FilterPolicyTest` prüft jeden registrierten Filter); Phase 5: Doku-Satz verlinkte Kennzahlen (steht in `documents.md`); Phase 6 #16 (in Phase 7 erledigt, `lazy`) | Jeweils im Code bzw. in der Doku geprüft. Phase 2 M-C (Arch-Test gegen `@openbill_unlock` in `app/`) kommt als billiger Wächter in Task 7. |

## Datei-Übersicht

| Datei | Task | Zweck |
|---|---|---|
| `resources/js/layouts/logout.ts` | 1, 2 | Timeout, 401/419, Löschungen, Info-Toast; `clearDrafts()` |
| `resources/js/lib/pending-delete.ts` | 1 | `flushPendingDeletes()` |
| `resources/js/test-utils/memory-storage.ts` (neu) | 2 | `sessionStorage` für Vitest |
| `resources/js/editor/unsaved-drafts.ts` (neu) | 2 | Entwürfe über den Login retten |
| `resources/js/editor/autosave-registry.ts` | 2 | `stashUnsavedDrafts()`, 401-Handler, Wiederherstellen in `showDocument` |
| `resources/js/editor/use-autosave.ts` | 2 | `setDraftOwner()` |
| `resources/js/lib/api.ts` | 2 | `goToLogin()` |
| `resources/js/lib/toast.ts`, `components/ui/toaster.tsx` | 3 | Halter `pointer`/`focus` |
| `resources/css/app.css`, `components/ui/dialog.tsx`, `layouts/app-shell.tsx` | 3 | Exit-Animationen |
| `app/Support/DocumentQuery.php`, `app/Http/Controllers/DocumentController.php`, `resources/js/pages/documents/index.tsx`, `resources/js/api/{keys,types}.ts` | 4 | Datumsfilter |
| `app/Support/ImageReferences.php`, `app/Actions/PruneUnusedImages.php`, `app/Console/Commands/PruneImages.php` (neu) | 5 | Aufräumen |
| `app/Rendering/Liquid/OpenbillFilters.php` | 6 | Ganzzahl-Mathe, `date` mit Zeitstempel |
| `app/Support/TrimmedInput.php` (neu), 5 Actions, `app/Http/Middleware/TrustProxies.php`, `tests/Unit/ArchTest.php` | 7 | Trimmen, Präfix, Wächter |
| `.github/dependabot.yml` (neu) | 8 | Updates |
| `docs/.vitepress/config.ts`, `docs/.vitepress/theme/{index.ts,style.css}`, `docs/package.json`, `.github/workflows/docs.yml` (neu), `.github/workflows/tests.yml` | 9 | Pages, Theme |
| `e2e/tests/docs-screenshots.spec.ts` (neu), `e2e/playwright.config.ts`, `e2e/package.json`, `docs/public/screenshots/{en,de}/*.png` (neu) | 10 | Screenshots |
| `docs/{en,de}/*.md`, `tests/Unit/DocsTest.php` | 4–11 | Doku |
| `README.md`, `docs/history/2026-10-12 Ausprojektierung openbill.md` (neu), `CLAUDE.md` | 12 | Repo, Gedächtnis |

---

### Task 1: Logout härten (Timeout, 401/419, wartende Löschungen, Rückmeldung)

**Files:**
- Modify: `resources/js/layouts/logout.ts`
- Modify: `resources/js/lib/pending-delete.ts`
- Modify: `lang/en.json`, `lang/de.json`
- Modify: `docs/en/documents.md`, `docs/de/documents.md` (Absatz „Saving“/„Speichern“)
- Test: `resources/js/layouts/logout.test.ts`, `resources/js/lib/pending-delete.test.ts`

**Interfaces:**
- Consumes: `flushAutosaves()`, `resetAutosaves()` (`@/editor/autosave-registry`), `toast`, `dismissToast`, `currentToasts` (`@/lib/toast`), `scheduleDelete`, `pendingDeleteIds` (`@/lib/pending-delete`).
- Produces: `flushPendingDeletes(): Promise<void>` in `@/lib/pending-delete`; `postLogout(signal: AbortSignal): Promise<void>`, `LOGOUT_POST_TIMEOUT = 10000`, `LogoutOptions.post: (signal: AbortSignal) => Promise<void>`, `LogoutOptions.timeout?: number` in `@/layouts/logout`. Task 2 ergänzt in `logout()` den Aufruf `clearDrafts()`.

- [ ] **Step 1: Identität prüfen**

Run: `test "$(git config user.email)" = "rafael@hauss.dev" && echo ok`
Expected: `ok`

- [ ] **Step 2: Failing test für `flushPendingDeletes`**

In `resources/js/lib/pending-delete.test.ts` den Import erweitern und den Test anhängen (im `describe('scheduleDelete', …)`):

```ts
import { commitAllKeepalive, flushPendingDeletes, pendingDeleteIds, scheduleDelete } from './pending-delete';
```

```ts
    it('flushPendingDeletes sends every waiting delete without keepalive and resolves once they answered (logout)', async () => {
        const runs: boolean[] = [];
        let finish!: () => void;
        scheduleDelete('f1', ({ keepalive }) => {
            runs.push(keepalive);
            return new Promise<void>((resolve) => (finish = resolve));
        });
        const undone = scheduleDelete('f2', async () => void runs.push(true));
        undone.undo();

        let done = false;
        const flushing = flushPendingDeletes().then(() => (done = true));
        expect(runs).toEqual([false]);
        expect(pendingDeleteIds().size).toBe(0);
        await Promise.resolve();
        expect(done).toBe(false);
        finish();
        await flushing;
        expect(done).toBe(true);
    });
```

- [ ] **Step 3: Failing tests für den Logout**

In `resources/js/layouts/logout.test.ts`:

Importe ersetzen:

```ts
import { mutate, SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentDetail } from '@/api/types';
import { acquireAutosave, resetAutosaves, showDocument } from '@/editor/autosave-registry';
import { useEditor } from '@/editor/store';
import type { DraftPayload } from '@/editor/types';
import { commitAllKeepalive, pendingDeleteIds, scheduleDelete } from '@/lib/pending-delete';
import { currentToasts, dismissToast } from '@/lib/toast';
import { LOGOUT_POST_TIMEOUT, LOGOUT_SAVE_WAIT, logout } from './logout';
```

`afterEach` ersetzen:

```ts
afterEach(() => {
    commitAllKeepalive();
    vi.unstubAllGlobals();
    vi.useRealTimers();
});
```

Im bestehenden Test „a failed logout keeps the editor saving …“ bleibt die Erwartung `[['error', 'user_menu.logout_failed']]` (der Info-Toast wird beim Fehlschlag entfernt). Neue Tests ans Ende von `describe('logout', …)`:

```ts
    it('says that it is logging out while it waits (ledger phase 6)', async () => {
        editing();
        const done = logout({ post: async () => undefined, leave: () => undefined });
        expect(currentToasts().map((toast) => [toast.tone, toast.message])).toEqual([['neutral', 'user_menu.logging_out']]);
        calls[0].resolve(detail('a', 'Hallo'));
        expect(await done).toBe(true);
    });

    it('sends deletes still waiting for their undo toast before it ends the session (ledger phase 6)', async () => {
        const order: string[] = [];
        scheduleDelete('d1', async ({ keepalive }) => void order.push(`delete d1, keepalive: ${keepalive}`));

        expect(await logout({ post: async () => void order.push('post'), leave: () => undefined })).toBe(true);
        expect(order).toEqual(['delete d1, keepalive: false', 'post']);
        expect(pendingDeleteIds().size).toBe(0);
    });

    it.each([401, 419])('counts %i on logout as a session that had ended already: cleans up and leaves (ledger phase 6)', async (status) => {
        const fetch = vi.fn(async () => new Response(null, { status }));
        vi.stubGlobal('fetch', fetch);
        const { entry } = editing();
        const leave = vi.fn();
        const done = logout({ leave });
        calls[0].resolve(detail('a', 'Hallo'));

        expect(await done).toBe(true);
        expect(fetch).toHaveBeenCalledOnce();
        expect(leave).toHaveBeenCalledOnce();
        expect(entry.autosave.stopped).toBe(true);
    });

    it('still fails on a server error of the logout', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 500 })));
        const leave = vi.fn();

        expect(await logout({ leave })).toBe(false);
        expect(leave).not.toHaveBeenCalled();
    });

    it('gives up on a logout request that hangs for 10 s and says so (ledger phase 6)', async () => {
        const post = vi.fn((signal: AbortSignal) => new Promise<void>((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))));
        const leave = vi.fn();
        const done = logout({ post, leave });
        let settled = false;
        void done.then(() => (settled = true));

        await vi.advanceTimersByTimeAsync(LOGOUT_POST_TIMEOUT - 1);
        expect(post).toHaveBeenCalledOnce();
        expect(settled).toBe(false);
        await vi.advanceTimersByTimeAsync(1);

        expect(await done).toBe(false);
        expect(leave).not.toHaveBeenCalled();
        expect(currentToasts().map((toast) => [toast.tone, toast.message])).toEqual([['error', 'user_menu.logout_failed']]);
        expect(LOGOUT_POST_TIMEOUT).toBe(10000);
    });
```

- [ ] **Step 4: Tests laufen lassen, sie schlagen fehl**

Run: `ddev exec pnpm test -- resources/js/layouts/logout.test.ts resources/js/lib/pending-delete.test.ts`
Expected: FAIL – `flushPendingDeletes` und `LOGOUT_POST_TIMEOUT` sind nicht exportiert (TypeError/undefined), der 419-Test liefert `false`.

- [ ] **Step 5: `flushPendingDeletes` implementieren**

In `resources/js/lib/pending-delete.ts` direkt nach `commitAllKeepalive()` einfügen:

```ts
/**
 * Logout: every delete still waiting for its toast goes out now – without keepalive, the page waits for the answers
 * (the logout caps that wait). The toasts' own commit() finds nothing left to do afterwards.
 */
export function flushPendingDeletes(): Promise<void> {
    const runs: Promise<void>[] = [];
    for (const [id, entry] of entries) {
        if (entry.committing) continue;
        entry.committing = true;
        entries.delete(id);
        runs.push(entry.run({ keepalive: false }).catch(() => undefined));
    }
    emit();
    return Promise.all(runs).then(() => undefined);
}
```

- [ ] **Step 6: `logout.ts` umbauen**

`resources/js/layouts/logout.ts` vollständig ersetzen:

```ts
import { SWRConfig } from 'swr';
import { flushAutosaves, resetAutosaves } from '@/editor/autosave-registry';
import { useEditor } from '@/editor/store';
import { cookie } from '@/lib/api';
import { path, t } from '@/lib/i18n';
import { flushPendingDeletes } from '@/lib/pending-delete';
import { dismissToast, toast } from '@/lib/toast';

/** How long the logout waits for the last save of open documents and for pending deletes (both keep running after). */
export const LOGOUT_SAVE_WAIT = 3000;
/** How long POST /logout may take before the logout counts as failed (a hanging request must not block the person). */
export const LOGOUT_POST_TIMEOUT = 10000;

export type LogoutOptions = {
    /** POST /{locale}/logout; resolves once the session is over (also when it had ended already), rejects otherwise. */
    post?: (signal: AbortSignal) => Promise<void>;
    /** After a successful logout: a full page load of the login (no state of this person survives in the tab). */
    leave?: () => void;
    wait?: number;
    timeout?: number;
};

/** 401/419: the session ended on its own (expired, or logged out in another tab) – which is what logging out wants. */
export async function postLogout(signal: AbortSignal): Promise<void> {
    const xsrf = cookie('XSRF-TOKEN');
    const response = await fetch(path('/logout'), {
        method: 'POST',
        credentials: 'same-origin',
        signal,
        headers: { Accept: 'text/html', 'X-Requested-With': 'XMLHttpRequest', ...(xsrf ? { 'X-XSRF-TOKEN': xsrf } : {}) },
    });
    if (response.status === 401 || response.status === 419) return;
    if (!response.ok) throw new Error(`logout: ${response.status}`);
}

/**
 * Every cached API answer, also the useSWRInfinite pages (`$inf$…`) that a filter-mutate skips. Deleted straight from
 * SWR's default cache; the full page load right after starts with a new one anyway.
 */
export function clearApiCache(): void {
    const cache = SWRConfig.defaultValue.cache;
    for (const key of [...cache.keys()]) cache.delete(key);
}

let running = false;

/**
 * Saves what is open and sends pending deletes (at most `wait` ms), ends the session (at most `timeout` ms), and only
 * then forgets drafts, autosaves and cached API data: the next person in this tab sees none of it. A failed logout
 * leaves everything running and says so.
 */
export async function logout({
    post = postLogout,
    leave = () => window.location.assign(path('/login')),
    wait = LOGOUT_SAVE_WAIT,
    timeout = LOGOUT_POST_TIMEOUT,
}: LogoutOptions = {}): Promise<boolean> {
    if (running) return false;
    running = true;
    // the menu is closed already: say that something is happening (saving may take up to `wait`)
    const notice = toast.info(t('user_menu.logging_out'));
    try {
        let timer: ReturnType<typeof setTimeout> | undefined;
        await Promise.race([Promise.all([flushAutosaves(), flushPendingDeletes()]), new Promise<void>((resolve) => (timer = setTimeout(resolve, wait)))]);
        clearTimeout(timer);
        const controller = new AbortController();
        const abort = setTimeout(() => controller.abort(), timeout);
        try {
            await post(controller.signal);
        } catch {
            dismissToast(notice);
            toast.error(t('user_menu.logout_failed'));
            return false;
        } finally {
            clearTimeout(abort);
        }
        resetAutosaves();
        useEditor.getState().reset();
        clearApiCache();
        leave();
        return true;
    } finally {
        running = false;
    }
}
```

- [ ] **Step 7: Übersetzungen**

In `lang/en.json` alphabetisch vor `"user_menu.logout_failed"`: `"user_menu.logging_out": "Logging out …",`
In `lang/de.json` an derselben Stelle: `"user_menu.logging_out": "Abmelden …",`

- [ ] **Step 8: Tests laufen lassen**

Run: `ddev exec pnpm test -- resources/js/layouts/logout.test.ts resources/js/lib/pending-delete.test.ts && ddev exec pnpm typecheck && ddev artisan test --filter=TranslationsTest`
Expected: alle PASS, `tsc` ohne Fehler.

- [ ] **Step 9: Doku**

`docs/en/documents.md`, Zeile mit `- **Saving:**`, ersetzen:
alt: `Logging out saves too, waiting at most three seconds for it; if logging out fails (for example without a connection), you stay signed in, editing and saving go on, and a message says so.`
neu: `Logging out saves too and sends deletions still waiting for their undo message, waiting at most three seconds for both; a message says that you are being logged out. If your session had ended already, logging out simply takes you to the login. If logging out fails (for example without a connection, or without an answer within ten seconds), you stay signed in, editing and saving go on, and a message says so.`

`docs/de/documents.md`, Zeile mit `- **Speichern:**`:
alt: `Auch Abmelden speichert vorher und wartet darauf höchstens drei Sekunden; scheitert das Abmelden (etwa ohne Verbindung), bleibst du angemeldet, Bearbeiten und Speichern laufen weiter, und eine Meldung sagt das.`
neu: `Auch Abmelden speichert vorher und schickt Löschungen ab, die noch auf ihre Rückgängig-Meldung warten, und wartet darauf zusammen höchstens drei Sekunden; eine Meldung sagt, dass du abgemeldet wirst. War deine Sitzung schon beendet, landest du einfach bei der Anmeldung. Scheitert das Abmelden (etwa ohne Verbindung oder ohne Antwort binnen zehn Sekunden), bleibst du angemeldet, Bearbeiten und Speichern laufen weiter, und eine Meldung sagt das.`

- [ ] **Step 10: Commit**

```bash
git add resources/js/layouts/logout.ts resources/js/layouts/logout.test.ts resources/js/lib/pending-delete.ts resources/js/lib/pending-delete.test.ts lang/en.json lang/de.json docs/en/documents.md docs/de/documents.md
git commit -m "fix: logout treats an ended session as logged out, times out and sends pending deletes" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Abgelaufene Sitzung – ungespeicherte Eingaben über den Login retten

**Files:**
- Create: `resources/js/test-utils/memory-storage.ts`
- Create: `resources/js/editor/unsaved-drafts.ts`
- Modify: `resources/js/editor/autosave-registry.ts`
- Modify: `resources/js/editor/use-autosave.ts`
- Modify: `resources/js/lib/api.ts`
- Modify: `resources/js/layouts/logout.ts`
- Modify: `lang/en.json`, `lang/de.json`
- Modify: `docs/en/documents.md`, `docs/de/documents.md`
- Test: `resources/js/editor/unsaved-drafts.test.ts` (neu), `resources/js/editor/autosave-registry.test.ts`, `resources/js/layouts/logout.test.ts`

**Interfaces:**
- Consumes: `Autosave.pending`, `Autosave.stopped`, `DraftSource.payload()`, `useEditor().load(document, { payload, saveState })`, `setUnauthenticatedHandler()` aus `@/lib/api`, `logout()` aus Task 1.
- Produces: `setDraftOwner(id: string | null)`, `stashDrafts(drafts: { id: string; payload: DraftPayload }[])`, `takeDraft(id: string): DraftPayload | null`, `clearDrafts()`, `UNSAVED_MAX_AGE` in `@/editor/unsaved-drafts`; `stashUnsavedDrafts(): void` in `@/editor/autosave-registry`; `goToLogin(): void` in `@/lib/api`; `memoryStorage(): Storage` in `@/test-utils/memory-storage`; Schlüssel `editor.restored_after_login`.

- [ ] **Step 1: Test-Hilfe anlegen**

`resources/js/test-utils/memory-storage.ts`:

```ts
/** sessionStorage/localStorage for Vitest: the test environment (node) has none. */
export function memoryStorage(): Storage {
    const items = new Map<string, string>();
    return {
        get length() {
            return items.size;
        },
        clear: () => items.clear(),
        getItem: (key) => items.get(key) ?? null,
        key: (index) => [...items.keys()][index] ?? null,
        removeItem: (key) => void items.delete(key),
        setItem: (key, value) => void items.set(key, String(value)),
    };
}
```

- [ ] **Step 2: Failing tests für den Speicher**

`resources/js/editor/unsaved-drafts.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryStorage } from '@/test-utils/memory-storage';
import type { DraftPayload } from './types';
import { clearDrafts, setDraftOwner, stashDrafts, takeDraft, UNSAVED_MAX_AGE } from './unsaved-drafts';

const payload = (intro: string) => ({ intro }) as unknown as DraftPayload;

beforeEach(() => {
    vi.stubGlobal('sessionStorage', memoryStorage());
    setDraftOwner('u1');
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe('unsaved drafts', () => {
    it('keeps the input of a draft for the same person and hands it out once', () => {
        stashDrafts([{ id: 'a', payload: payload('Hallo Jana') }]);

        expect(takeDraft('a')?.intro).toBe('Hallo Jana');
        expect(takeDraft('a')).toBeNull();
    });

    it("never hands one person's input to another (same tab, shared computer)", () => {
        stashDrafts([{ id: 'a', payload: payload('Hallo Jana') }]);
        setDraftOwner('u2');
        expect(takeDraft('a')).toBeNull();
        setDraftOwner('u1');
        expect(takeDraft('a')).toBeNull(); // gone once the other person opened the document
    });

    it('drops input older than a day', () => {
        vi.useFakeTimers();
        stashDrafts([{ id: 'a', payload: payload('alt') }]);
        vi.advanceTimersByTime(UNSAVED_MAX_AGE + 1);

        expect(takeDraft('a')).toBeNull();
    });

    it('forgets everything on logout and keeps nothing without a signed-in person', () => {
        stashDrafts([
            { id: 'a', payload: payload('x') },
            { id: 'b', payload: payload('y') },
        ]);
        sessionStorage.setItem('something:else', 'stays');
        clearDrafts();
        expect(sessionStorage.length).toBe(1);

        setDraftOwner(null);
        stashDrafts([{ id: 'c', payload: payload('z') }]);
        expect(sessionStorage.length).toBe(1);
    });

    it('survives a storage that throws (blocked by privacy settings)', () => {
        const blocked = () => {
            throw new Error('blocked');
        };
        vi.stubGlobal('sessionStorage', { getItem: blocked, setItem: blocked, removeItem: blocked, key: () => null, length: 0, clear: blocked });

        expect(() => stashDrafts([{ id: 'a', payload: payload('x') }])).not.toThrow();
        expect(takeDraft('a')).toBeNull();
        expect(() => clearDrafts()).not.toThrow();
    });
});
```

- [ ] **Step 3: Failing tests im Registry-Test**

In `resources/js/editor/autosave-registry.test.ts` die Importe ergänzen:

```ts
import { currentToasts } from '@/lib/toast';
import { memoryStorage } from '@/test-utils/memory-storage';
import { acquireAutosave, flushAllKeepalive, releaseAutosave, resetAutosaves, showDocument, stashUnsavedDrafts } from './autosave-registry';
import { setDraftOwner } from './unsaved-drafts';
```

(die bisherige Import-Zeile aus `./autosave-registry` ersetzen). `afterEach` ersetzen durch:

```ts
afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
});
```

Tests ans Ende von `describe('autosave registry', …)`:

```ts
    it('keeps unsaved input across an expired session and brings it back after the login (ledger phase 6, #8)', async () => {
        vi.stubGlobal('sessionStorage', memoryStorage());
        setDraftOwner('u1');
        const a = open('a', detail('a'));
        a.type('Hallo Jana');
        await vi.advanceTimersByTimeAsync(600); // the save goes out … and the server answers 401
        stashUnsavedDrafts(); // what the 401 handler does before the browser goes to the login

        // the login is a full page load: nothing in memory survives
        resetAutosaves();
        useEditor.getState().reset();
        calls = [];

        open('a', detail('a', ''));
        expect(useEditor.getState().draft?.intro).toBe('Hallo Jana');
        expect(useEditor.getState().saveState).toBe('dirty');
        expect(currentToasts().map((toast) => toast.message)).toContain('editor.restored_after_login');
        await vi.advanceTimersByTimeAsync(600);
        expect(calls.map((call) => call.intro)).toEqual(['Hallo Jana']);
    });

    it('does not put kept input into a document that was finalized in the meantime', () => {
        vi.stubGlobal('sessionStorage', memoryStorage());
        setDraftOwner('u1');
        open('a', detail('a')).type('Hallo Jana');
        stashUnsavedDrafts();
        resetAutosaves();
        useEditor.getState().reset();

        open('a', { ...detail('a', ''), status: 'open', is_locked: true });
        expect(useEditor.getState().draft?.intro).toBe('');
        expect(sessionStorage.length).toBe(0);
    });
```

In `resources/js/layouts/logout.test.ts` Importe ergänzen:

```ts
import { setDraftOwner, stashDrafts } from '@/editor/unsaved-drafts';
import { memoryStorage } from '@/test-utils/memory-storage';
```

und Test anhängen:

```ts
    it('forgets input kept from an expired session (the next person in this tab must not get it)', async () => {
        vi.stubGlobal('sessionStorage', memoryStorage());
        setDraftOwner('u1');
        stashDrafts([{ id: 'a', payload: { intro: 'Hallo' } as unknown as DraftPayload }]);

        expect(await logout({ post: async () => undefined, leave: () => undefined })).toBe(true);
        expect(sessionStorage.length).toBe(0);
    });
```

- [ ] **Step 4: Tests laufen lassen, sie schlagen fehl**

Run: `ddev exec pnpm test -- resources/js/editor/unsaved-drafts.test.ts resources/js/editor/autosave-registry.test.ts resources/js/layouts/logout.test.ts`
Expected: FAIL – Modul `./unsaved-drafts` fehlt, `stashUnsavedDrafts` ist nicht exportiert.

- [ ] **Step 5: `unsaved-drafts.ts` anlegen**

`resources/js/editor/unsaved-drafts.ts`:

```ts
import type { DraftPayload } from './types';

/**
 * Unsaved input of drafts whose session ended (401): kept in sessionStorage (this tab only) while the browser goes to
 * the login, and loaded again when the same person opens the document after logging in. Never handed to anyone else,
 * dropped after a day and on logout.
 */
const PREFIX = 'openbill:unsaved:';
/** Older input is more likely to confuse than to help. */
export const UNSAVED_MAX_AGE = 24 * 60 * 60 * 1000;

type Stash = { user: string; at: number; payload: DraftPayload };

let owner: string | null = null;

/** The signed-in person (Inertia's auth.user.id): input is kept and handed out for them only. */
export function setDraftOwner(id: string | null): void {
    owner = id;
}

function storage(): Storage | null {
    try {
        return typeof sessionStorage === 'undefined' ? null : sessionStorage;
    } catch {
        return null; // storage blocked by privacy settings throws on access
    }
}

export function stashDrafts(drafts: { id: string; payload: DraftPayload }[]): void {
    const store = storage();
    if (!store || owner === null) return;
    for (const { id, payload } of drafts) {
        try {
            store.setItem(PREFIX + id, JSON.stringify({ user: owner, at: Date.now(), payload } satisfies Stash));
        } catch {
            // quota or blocked storage: the input is lost as before, nothing else breaks
        }
    }
}

/** The kept input of one document for the current person, removed on reading; null if none, too old or someone else's. */
export function takeDraft(id: string): DraftPayload | null {
    const store = storage();
    if (!store) return null;
    let raw: string | null;
    try {
        raw = store.getItem(PREFIX + id);
        store.removeItem(PREFIX + id);
    } catch {
        return null;
    }
    if (raw === null || owner === null) return null;
    try {
        const stash = JSON.parse(raw) as Partial<Stash>;
        if (stash.user !== owner || typeof stash.at !== 'number' || Date.now() - stash.at > UNSAVED_MAX_AGE || !stash.payload) return null;
        return stash.payload;
    } catch {
        return null;
    }
}

/** Logout: nothing of this person stays in the tab. */
export function clearDrafts(): void {
    const store = storage();
    if (!store) return;
    try {
        const keys: string[] = [];
        for (let i = 0; i < store.length; i++) {
            const key = store.key(i);
            if (key?.startsWith(PREFIX)) keys.push(key);
        }
        keys.forEach((key) => store.removeItem(key));
    } catch {
        // nothing to clear
    }
}
```

- [ ] **Step 6: `goToLogin` in `api.ts`**

In `resources/js/lib/api.ts` den Block

```ts
let onUnauthenticated = (): void => {
    window.location.assign(`/${getLocale()}/login`);
};
```

ersetzen durch:

```ts
/** The login page of the current language (full page load). */
export function goToLogin(): void {
    window.location.assign(`/${getLocale()}/login`);
}

let onUnauthenticated = goToLogin;
```

- [ ] **Step 7: Registry: sichern, 401-Handler, wiederherstellen**

In `resources/js/editor/autosave-registry.ts`:

Importe ergänzen/ersetzen:

```ts
import { ApiError, errorMessage, goToLogin, setUnauthenticatedHandler } from '@/lib/api';
import { t } from '@/lib/i18n';
import { stashDrafts, takeDraft } from './unsaved-drafts';
```

Nach `flushAllKeepalive` einfügen:

```ts
/**
 * The session is gone (401): the unsaved input of every open document goes to sessionStorage before the browser
 * leaves for the login. Opening the document again after logging in brings it back (showDocument).
 */
export function stashUnsavedDrafts(): void {
    const drafts: { id: string; payload: DraftPayload }[] = [];
    for (const entry of entries.values()) {
        if (!entry.autosave.pending || entry.autosave.stopped) continue;
        const payload = entry.source.payload();
        if (payload) drafts.push({ id: entry.id, payload });
    }
    stashDrafts(drafts);
}
```

In `acquireAutosave` den Block `if (!listening && typeof window !== 'undefined') { … }` ersetzen durch:

```ts
    if (!listening && typeof window !== 'undefined') {
        listening = true;
        window.addEventListener('pagehide', () => flushAllKeepalive());
        // 401 anywhere in the app: keep what is not saved, then the login (api.ts' default only does the latter)
        setUnauthenticatedHandler(() => {
            stashUnsavedDrafts();
            goToLogin();
        });
    }
```

In `showDocument` den Zweig für „Dokument wird geöffnet“ ersetzen:

```ts
    if (store.draft === null || store.draft.id !== entry.id) {
        const local = autosave.pending && !autosave.stopped ? source.payload() : null;
        // input kept from before an expired session (stashed on 401): only into a document that is still a draft
        const kept = local === null ? takeDraft(entry.id) : null;
        const restored = kept !== null && !document.is_locked ? kept : null;
        const payload = local ?? restored;
        store.load(document, payload ? { payload, saveState: local ? autosave.state : 'dirty' } : undefined);
        if (payload) autosave.changed();
        else autosave.reset();
        if (restored) toast.info(t('editor.restored_after_login'));
        return;
    }
```

Den Doc-Kommentar über `showDocument` um einen Satz ergänzen: `Input kept from an expired session (unsaved-drafts.ts) comes back the same way, with a message.`

- [ ] **Step 8: Besitzer setzen und beim Logout löschen**

`resources/js/editor/use-autosave.ts`: Importe ergänzen

```ts
import { router, usePage } from '@inertiajs/react';
import type { SharedProps } from '@/types';
import { setDraftOwner } from './unsaved-drafts';
```

(die bisherige `router`-Import-Zeile ersetzen) und am Anfang von `useAutosave` vor dem ersten `useEffect`:

```ts
    const user = usePage<SharedProps>().props.auth.user?.id ?? null;
    // before the effects below: whose kept input showDocument may hand out
    useEffect(() => setDraftOwner(user), [user]);
```

`resources/js/layouts/logout.ts`: Import `import { clearDrafts } from '@/editor/unsaved-drafts';` und nach `clearApiCache();` die Zeile `clearDrafts();`.

- [ ] **Step 9: Übersetzungen**

`lang/en.json` (alphabetisch bei `editor.r…`): `"editor.restored_after_login": "Your changes from before the login are back and are being saved.",`
`lang/de.json`: `"editor.restored_after_login": "Deine Änderungen von vor der Anmeldung sind wieder da und werden gespeichert.",`

- [ ] **Step 10: Tests laufen lassen**

Run: `ddev exec pnpm test && ddev exec pnpm typecheck && ddev artisan test --filter=TranslationsTest`
Expected: alle PASS.

- [ ] **Step 11: Doku**

`docs/en/documents.md`, Zeile `- **Saving:**`:
alt: `Known limits: if the tab is closed while a save is still on its way, in rare cases the older save can arrive last; very large drafts (several hundred positions) cannot be sent at all while the tab closes; and if your session has expired, the changes since the last save are lost when openbill sends you to the login page.`
neu: `If your session has expired, openbill keeps the changes since the last save in this tab and sends you to the login; open the document again after logging in (as the same person, within a day) and they are back and get saved. Known limits: if the tab is closed while a save is still on its way, in rare cases the older save can arrive last; very large drafts (several hundred positions) cannot be sent at all while the tab closes.`

`docs/de/documents.md`, Zeile `- **Speichern:**`:
alt: `Bekannte Grenzen: Wird der Tab geschlossen, während noch gespeichert wird, kann in seltenen Fällen das ältere Speichern zuletzt ankommen; sehr große Entwürfe (mehrere hundert Positionen) gehen beim Schließen des Tabs gar nicht mehr raus; und ist deine Sitzung abgelaufen, gehen die Änderungen seit dem letzten Speichern verloren, wenn openbill dich zur Anmeldung schickt.`
neu: `Ist deine Sitzung abgelaufen, behält openbill die Änderungen seit dem letzten Speichern in diesem Tab und schickt dich zur Anmeldung; öffnest du das Dokument danach wieder (als dieselbe Person, innerhalb eines Tages), sind sie wieder da und werden gespeichert. Bekannte Grenzen: Wird der Tab geschlossen, während noch gespeichert wird, kann in seltenen Fällen das ältere Speichern zuletzt ankommen; sehr große Entwürfe (mehrere hundert Positionen) gehen beim Schließen des Tabs gar nicht mehr raus.`

- [ ] **Step 12: Commit**

```bash
git add resources/js/test-utils/memory-storage.ts resources/js/editor/unsaved-drafts.ts resources/js/editor/unsaved-drafts.test.ts resources/js/editor/autosave-registry.ts resources/js/editor/autosave-registry.test.ts resources/js/editor/use-autosave.ts resources/js/lib/api.ts resources/js/layouts/logout.ts resources/js/layouts/logout.test.ts lang/en.json lang/de.json docs/en/documents.md docs/de/documents.md
git commit -m "feat: keep unsaved draft input across an expired session and restore it after the login" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Toasts laufen nach Tastatur-Undo weiter; Exit-Animation für Dialog und Drawer

**Files:**
- Modify: `resources/js/lib/toast.ts`
- Modify: `resources/js/components/ui/toaster.tsx`
- Modify: `resources/css/app.css` (Block `@theme` mit den `--animate-*`)
- Modify: `resources/js/components/ui/dialog.tsx`
- Modify: `resources/js/layouts/app-shell.tsx` (mobile Seitenleiste, Zeilen 77/81)
- Test: `resources/js/lib/toast.test.ts`

**Interfaces:**
- Consumes: –
- Produces: `type ToastHold = 'pointer' | 'focus'`, `pauseToasts(hold?: ToastHold)`, `resumeToasts(hold?: ToastHold)` (Standard `'pointer'`, bisherige Aufrufe bleiben gültig); Tailwind-Animationen `animate-pop-out`, `animate-overlay-out`, `animate-slide-out`, `animate-slide-out-left`.

- [ ] **Step 1: Failing tests**

In `resources/js/lib/toast.test.ts` `afterEach` ersetzen:

```ts
afterEach(() => {
    resumeToasts('pointer');
    resumeToasts('focus');
    currentToasts().forEach((item) => dismissToast(item.id));
    vi.useRealTimers();
});
```

Tests anhängen:

```ts
    it('runs again after an undo used with the keyboard: its focused button is gone and no blur ever comes (ledger phase 5)', () => {
        const first = toast.success('Draft deleted', { label: 'Undo', run: () => undefined });
        toast.info('Customer saved');
        pauseToasts('focus'); // Tab onto the undo button
        vi.advanceTimersByTime(10_000);
        expect(currentToasts()).toHaveLength(2);

        dismissToast(first, true); // Enter on undo: the toast and its button disappear
        vi.advanceTimersByTime(3_500);
        expect(currentToasts()).toEqual([]);
    });

    it('stays paused while the pointer is still over the toasts', () => {
        const first = toast.success('Draft deleted', { label: 'Undo', run: () => undefined });
        toast.info('Customer saved');
        pauseToasts('pointer');
        pauseToasts('focus');

        dismissToast(first, true);
        vi.advanceTimersByTime(10_000);
        expect(currentToasts()).toHaveLength(1);
        resumeToasts('pointer');
        vi.advanceTimersByTime(3_500);
        expect(currentToasts()).toEqual([]);
    });
```

- [ ] **Step 2: Tests laufen lassen, sie schlagen fehl**

Run: `ddev exec pnpm test -- resources/js/lib/toast.test.ts`
Expected: FAIL im ersten neuen Test (`expected [ … ] to deeply equal []`: die Toasts bleiben pausiert).

- [ ] **Step 3: Halter in `toast.ts`**

In `resources/js/lib/toast.ts`:
- `let paused = false;` ersetzen durch:

```ts
/** Who holds the toasts open: the pointer over them or the keyboard focus in them (WCAG 2.2.1). */
export type ToastHold = 'pointer' | 'focus';
const holds = new Set<ToastHold>();
```

- In `dismissToast` nach `emit();` und vor dem `onExpire`-Aufruf einfügen:

```ts
    // the action's button had the focus and is gone with its toast: browsers send no blur for a removed element
    if (used) resumeToasts('focus');
```

- In `push` `if (!paused) start(id);` ersetzen durch `if (holds.size === 0) start(id);`
- `pauseToasts` und `resumeToasts` ersetzen:

```ts
/** While the pointer or the keyboard focus is on the toasts, none of them closes (WCAG 2.2.1). */
export function pauseToasts(hold: ToastHold = 'pointer'): void {
    const running = holds.size === 0;
    holds.add(hold);
    if (!running) return;
    for (const timer of timers.values()) {
        if (!timer.handle) continue;
        clearTimeout(timer.handle);
        timer.handle = null;
        timer.remaining = Math.max(0, timer.remaining - (Date.now() - timer.started));
    }
}

export function resumeToasts(hold: ToastHold = 'pointer'): void {
    if (!holds.delete(hold) || holds.size > 0) return;
    for (const id of timers.keys()) start(id);
}
```

- [ ] **Step 4: Toaster benutzt die Halter**

In `resources/js/components/ui/toaster.tsx` die vier Handler am äußeren `div` ersetzen:

```tsx
            onMouseEnter={() => pauseToasts('pointer')}
            onMouseLeave={() => resumeToasts('pointer')}
            onFocus={() => pauseToasts('focus')}
            // only when the focus leaves the toasts, not when it moves from one toast button to the next
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) resumeToasts('focus');
            }}
```

- [ ] **Step 5: Tests laufen lassen**

Run: `ddev exec pnpm test -- resources/js/lib/toast.test.ts && ddev exec pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Exit-Animationen definieren**

In `resources/css/app.css` im `@theme`-Block nach `--animate-slide-in-left: …;` einfügen:

```css
    /* exits: Radix keeps a closing dialog mounted until its animation ends (data-state="closed") */
    --animate-pop-out: pop-out 140ms cubic-bezier(0.4, 0, 1, 1) forwards;
    --animate-overlay-out: overlay-out 140ms cubic-bezier(0.4, 0, 1, 1) forwards;
    --animate-slide-out: slide-out 160ms cubic-bezier(0.4, 0, 1, 1) forwards;
    --animate-slide-out-left: slide-out-left 160ms cubic-bezier(0.4, 0, 1, 1) forwards;
```

und nach `@keyframes slide-in-left { … }`:

```css
    @keyframes pop-out {
        from {
            opacity: 1;
            transform: none;
        }
        to {
            opacity: 0;
            transform: translateY(4px) scale(0.985);
        }
    }
    @keyframes overlay-out {
        from {
            opacity: 1;
        }
        to {
            opacity: 0;
        }
    }
    @keyframes slide-out {
        from {
            opacity: 1;
            transform: none;
        }
        to {
            opacity: 0;
            transform: translateX(16px);
        }
    }
    @keyframes slide-out-left {
        from {
            opacity: 1;
            transform: none;
        }
        to {
            opacity: 0;
            transform: translateX(-16px);
        }
    }
```

(`prefers-reduced-motion` setzt schon alle Animationen auf 1 ms – Radix bekommt trotzdem sein `animationend`.)

- [ ] **Step 7: Klassen ergänzen**

`resources/js/components/ui/dialog.tsx`:
- Dialog-Overlay: `className="fixed inset-0 z-50 grid animate-overlay-in place-items-center overflow-y-auto bg-overlay p-4 data-[state=closed]:animate-overlay-out"`
- Dialog-Content: im `cx(…)` den ersten String um ` data-[state=closed]:animate-pop-out` ergänzen.
- Drawer-Overlay: `className="fixed inset-0 z-50 animate-overlay-in bg-overlay data-[state=closed]:animate-overlay-out"`
- Drawer-Content: Klasse um ` data-[state=closed]:animate-slide-out` ergänzen.

`resources/js/layouts/app-shell.tsx`:
- Zeile 77: `… animate-overlay-in bg-overlay md:hidden` → `… animate-overlay-in bg-overlay data-[state=closed]:animate-overlay-out md:hidden`
- Zeile 81: nach `animate-slide-in-left` ` data-[state=closed]:animate-slide-out-left` einfügen.

- [ ] **Step 8: Prüfen, dass die Animationen im CSS landen und nichts bricht**

Run: `ddev exec pnpm build >/dev/null && grep -l 'pop-out' public/build/assets/*.css && grep -c 'data-state=closed\]\|data-state="closed"' public/build/assets/app-*.css`
Expected: eine CSS-Datei wird genannt, der Zähler ist ≥ 1.

Run (Mac, DDEV läuft, Assets gebaut): `pnpm --dir e2e test -- shell.spec.ts documents.spec.ts customers.spec.ts`
Expected: alle PASS (Dialoge/Drawer schließen weiterhin; Playwright wartet die 140–160 ms ab). Danach `rm -f public/hot` nur falls ein Dev-Server lief.

- [ ] **Step 9: Commit**

```bash
git add resources/js/lib/toast.ts resources/js/lib/toast.test.ts resources/js/components/ui/toaster.tsx resources/css/app.css resources/js/components/ui/dialog.tsx resources/js/layouts/app-shell.tsx
git commit -m "fix: toasts resume after a keyboard undo; dialogs, drawers and the mobile sidebar animate out" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Datumsfilter in der Dokumentliste

**Files:**
- Modify: `app/Support/DocumentQuery.php` (`PAGE_FILTERS`)
- Modify: `app/Http/Controllers/DocumentController.php` (`index`)
- Modify: `resources/js/api/types.ts` (`DocumentFilters`), `resources/js/api/keys.ts` (`documents`)
- Modify: `resources/js/pages/documents/index.tsx`
- Modify: `lang/en.json`, `lang/de.json`
- Modify: `docs/en/documents.md`, `docs/de/documents.md` (Abschnitt „Document list“/„Dokumentliste“)
- Test: `tests/Feature/Pages/DocumentPagesTest.php`, `resources/js/api/keys.test.ts`

**Interfaces:**
- Consumes: API-Filter `date_from`/`date_to` (`Y-m-d`, gibt es schon in `DocumentQuery::rules()` und `filtered()`), `controlClass(invalid, extra)` aus `@/components/ui`.
- Produces: Inertia-Prop `filters` mit sechs Schlüsseln `type, status, customer_id, q, date_from, date_to`; `DocumentFilters.date_from?/date_to?: string | null`; Schlüssel `documents.filter_date_from`, `documents.filter_date_to`.

- [ ] **Step 1: Failing Pest-Tests**

In `tests/Feature/Pages/DocumentPagesTest.php`:
- im Test „renders the list with normalized filters …“ die Erwartung ersetzen durch `->where('filters', ['type' => 'invoice', 'status' => null, 'customer_id' => $fjord->id, 'q' => null, 'date_from' => null, 'date_to' => null])`
- im Test „ignores invalid filters of a typed URL …“ durch `->where('filters', ['type' => null, 'status' => null, 'customer_id' => null, 'q' => null, 'date_from' => null, 'date_to' => null])`

Neuer Test nach „filters overdue invoices“:

```php
it('filters by document date and ignores dates of a typed URL that are no dates (review focus)', function () {
    Document::factory()->create(['date' => '2026-09-30']);
    Document::factory()->create(['date' => '2026-10-05']);
    Document::factory()->create(['date' => '2026-10-11']);
    $this->actingAs(User::factory()->create());

    $this->get('/en/documents?date_from=2026-10-01&date_to=2026-10-10')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('filters.date_from', '2026-10-01')
            ->where('filters.date_to', '2026-10-10')
            ->where('counts.all', 1)
            ->where('summary.count', 1));

    $this->get('/en/documents?date_from=2026-13-01&date_to=yesterday')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('filters.date_from', null)
            ->where('filters.date_to', null)
            ->where('summary.count', 3));

    // from after to: an empty list, not an error
    $this->get('/en/documents?date_from=2026-10-10&date_to=2026-10-01')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('summary.count', 0));
});
```

- [ ] **Step 2: Failing Vitest**

In `resources/js/api/keys.test.ts` im ersten Test nach der zweiten `keys.documents`-Zeile:

```ts
        expect(keys.documents({ date_from: '2026-10-01', date_to: '2026-10-31' }, 1)).toBe('/api/documents?date_from=2026-10-01&date_to=2026-10-31&page=1&itemsPerPage=50');
```

- [ ] **Step 3: Tests laufen lassen, sie schlagen fehl**

Run: `ddev artisan test --filter=DocumentPagesTest; ddev exec pnpm test -- resources/js/api/keys.test.ts`
Expected: Pest FAIL (`filters` ohne `date_from`), Vitest FAIL (Typfehler bzw. URL ohne Datum).

- [ ] **Step 4: Server**

`app/Support/DocumentQuery.php`: `private const PAGE_FILTERS = ['type', 'status', 'customer_id', 'q', 'date_from', 'date_to'];`

`app/Http/Controllers/DocumentController.php`, im Array `'filters' => [ … ]` nach `'q' => …` ergänzen:

```php
                'date_from' => $filters['date_from'] ?? null,
                'date_to' => $filters['date_to'] ?? null,
```

- [ ] **Step 5: Client**

`resources/js/api/types.ts`, `DocumentFilters` ergänzen:

```ts
    /** Document date, inclusive (YYYY-MM-DD). */
    date_from?: string | null;
    date_to?: string | null;
```

`resources/js/api/keys.ts`, in `documents` nach `q: filters.q?.trim(),`:

```ts
            date_from: filters.date_from,
            date_to: filters.date_to,
```

`resources/js/pages/documents/index.tsx`:
- Import aus `@/components/ui` um `controlClass` ergänzen.
- Typ und Leerwert:

```tsx
type Filters = {
    type: DocumentType | null;
    status: DocumentFilters['status'];
    customer_id: string | null;
    q: string | null;
    date_from: string | null;
    date_to: string | null;
};
```

```tsx
const EMPTY: Filters = { type: null, status: null, customer_id: null, q: null, date_from: null, date_to: null };
```

- `const filtered = Boolean(filters.type || filters.status || filters.customer_id || filters.q || filters.date_from || filters.date_to);`
- Nach dem Kunden-`SelectControl` und vor `{filtered && (` einfügen:

```tsx
                    {/* document date from/to; typing a date replaces the history entry like the search does */}
                    <input
                        type="date"
                        className={controlClass(false, 'flex-[1_1_9rem] sm:flex-[0_1_10rem]')}
                        value={filters.date_from ?? ''}
                        max={filters.date_to ?? undefined}
                        onChange={(e) => set({ date_from: e.target.value || null }, true)}
                        aria-label={t('documents.filter_date_from')}
                        title={t('documents.filter_date_from')}
                    />
                    <input
                        type="date"
                        className={controlClass(false, 'flex-[1_1_9rem] sm:flex-[0_1_10rem]')}
                        value={filters.date_to ?? ''}
                        min={filters.date_from ?? undefined}
                        onChange={(e) => set({ date_to: e.target.value || null }, true)}
                        aria-label={t('documents.filter_date_to')}
                        title={t('documents.filter_date_to')}
                    />
```

- [ ] **Step 6: Übersetzungen**

`lang/en.json` (alphabetisch nach `documents.filter_customer`): `"documents.filter_date_from": "Date from",` und `"documents.filter_date_to": "Date to",`
`lang/de.json`: `"documents.filter_date_from": "Datum von",` und `"documents.filter_date_to": "Datum bis",`

- [ ] **Step 7: Tests laufen lassen**

Run: `ddev artisan test --filter='DocumentPagesTest|TranslationsTest|DocumentsApiTest' && ddev exec pnpm test && ddev exec pnpm typecheck`
Expected: PASS (falls `DocumentsApiTest` nicht existiert, meldet Pest „No tests found“ für dieses Muster – unkritisch, die beiden anderen müssen grün sein).

- [ ] **Step 8: Im Browser ansehen**

Run (Mac): `ddev exec pnpm build >/dev/null && open https://openbill.ddev.site/en/documents`
Expected: zwei Datumsfelder rechts neben den Selects (bei 390 px umbrechend), Auswahl filtert die Liste, „Reset filters“ erscheint und leert beide.

- [ ] **Step 9: Doku**

`docs/en/documents.md`, Abschnitt „### Document list“:
alt: `Filter by type (each pill shows how many documents that type has under the other filters), by status, by customer, and search number and customer name.`
neu: `Filter by type (each pill shows how many documents that type has under the other filters), by status, by customer and by document date (from/to), and search number and customer name.`
alt: `for example `/en/documents?type=invoice&status=overdue`,`
neu: `for example `/en/documents?type=invoice&status=overdue` or `/en/documents?date_from=2026-01-01&date_to=2026-03-31`,`

`docs/de/documents.md`, Abschnitt „### Dokumentliste“:
alt: `nach Status und Kunde, dazu eine Suche über Nummer und Kundennamen.`
neu: `nach Status, Kunde und Dokumentdatum (von/bis), dazu eine Suche über Nummer und Kundennamen.`
alt: `zum Beispiel `/de/documents?type=invoice&status=overdue`;`
neu: `zum Beispiel `/de/documents?type=invoice&status=overdue` oder `/de/documents?date_from=2026-01-01&date_to=2026-03-31`;`

- [ ] **Step 10: Pint, Larastan, Commit**

```bash
ddev exec vendor/bin/pint && ddev exec vendor/bin/phpstan analyse --memory-limit=1G
git add app/Support/DocumentQuery.php app/Http/Controllers/DocumentController.php tests/Feature/Pages/DocumentPagesTest.php resources/js/api/types.ts resources/js/api/keys.ts resources/js/api/keys.test.ts resources/js/pages/documents/index.tsx lang/en.json lang/de.json docs/en/documents.md docs/de/documents.md
git commit -m "feat: filter the document list by document date" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Ungenutzte Bilder aufräumen (`app:prune-images`)

**Files:**
- Create: `app/Support/ImageReferences.php`
- Create: `app/Actions/PruneUnusedImages.php`
- Create: `app/Console/Commands/PruneImages.php`
- Modify: `app/Actions/StoreUpload.php`, `app/Actions/UpdateOrganizationLogo.php` (Doc-Kommentare)
- Modify: `docs/en/custom-fields.md`, `docs/de/custom-fields.md`, `docs/en/settings.md`, `docs/de/settings.md`
- Test: `tests/Feature/Actions/PruneUnusedImagesTest.php`

**Interfaces:**
- Consumes: Disk `local` (in Feature-Tests gefaked), Models `Organization`, `Customer`, `Contact`, `Document`, `Position`, `FieldDefinition`, `DocumentSnapshot`; `FinalizeDocument`, `draft()`, `completeOrganization()`, `systemActor()` (Tests).
- Produces: `ImageReferences::PATTERN`, `ImageReferences::isImagePath(string): bool`, `ImageReferences::all(): array<string, true>`; `PruneUnusedImages::handle(Actor $actor, bool $dryRun = false, int $minAgeHours = 24): list<string>`; Artisan `app:prune-images {--dry-run} {--min-age=24}`.

- [ ] **Step 1: Failing tests**

`tests/Feature/Actions/PruneUnusedImagesTest.php`:

```php
<?php

use App\Actions\FinalizeDocument;
use App\Actions\PruneUnusedImages;
use App\Models\Customer;
use App\Models\Document;
use App\Models\Organization;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/** A stored image, `$hours` old (file time). */
function pruneTestImage(string $folder, int $hours = 48): string
{
    $path = $folder.'/'.strtolower((string) Str::ulid()).'.svg';
    Storage::disk('local')->put($path, '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/>');
    touch(Storage::disk('local')->path($path), now()->subHours($hours)->getTimestamp());

    return $path;
}

it('deletes only images nothing refers to and keeps those of records, snapshots and fresh uploads (ledger phase 7, review focus)', function () {
    completeOrganization();
    $oldLogo = pruneTestImage('logos');
    Organization::current()->forceFill(['logo_path' => $oldLogo])->save();
    app(FinalizeDocument::class)->handle(systemActor(), draft()); // its snapshot keeps the old logo
    $logo = pruneTestImage('logos');
    Organization::current()->forceFill(['logo_path' => $logo])->save();

    $photo = pruneTestImage('uploads');
    $customer = Customer::factory()->create(['custom' => ['photo' => $photo]]);
    $customer->delete(); // soft-deleted customers still count
    $sketch = pruneTestImage('uploads');
    Document::factory()->create(['custom' => ['sketch' => $sketch]]);
    $fresh = pruneTestImage('uploads', hours: 1); // uploaded, form not saved yet
    $orphan = pruneTestImage('uploads');
    $orphanLogo = pruneTestImage('logos');
    Storage::disk('local')->put('uploads/readme.txt', 'not an upload');

    $prune = app(PruneUnusedImages::class);
    expect($prune->handle(systemActor(), dryRun: true))->toBe(collect([$orphanLogo, $orphan])->sort()->values()->all())
        ->and(Storage::disk('local')->exists($orphan))->toBeTrue();

    expect($prune->handle(systemActor()))->toHaveCount(2);
    foreach ([$oldLogo, $logo, $photo, $sketch, $fresh, 'uploads/readme.txt'] as $kept) {
        expect(Storage::disk('local')->exists($kept))->toBeTrue($kept);
    }
    expect(Storage::disk('local')->exists($orphan))->toBeFalse()
        ->and(Storage::disk('local')->exists($orphanLogo))->toBeFalse()
        ->and($prune->handle(systemActor(), minAgeHours: 0))->toBe([$fresh]);
});

it('lists with --dry-run, deletes without it and refuses a min-age that is no number', function () {
    $orphan = pruneTestImage('uploads');

    $this->artisan('app:prune-images --dry-run')
        ->expectsOutputToContain("would delete {$orphan}")
        ->expectsOutputToContain('1 unused image(s) found (dry run, nothing deleted).')
        ->assertSuccessful();
    expect(Storage::disk('local')->exists($orphan))->toBeTrue();

    $this->artisan('app:prune-images')->expectsOutputToContain("deleted {$orphan}")->assertSuccessful();
    expect(Storage::disk('local')->exists($orphan))->toBeFalse();

    $this->artisan('app:prune-images --min-age=abc')->assertExitCode(2);
});
```

- [ ] **Step 2: Tests laufen lassen, sie schlagen fehl**

Run: `ddev artisan test --filter=PruneUnusedImagesTest`
Expected: FAIL – `Class "App\Actions\PruneUnusedImages" not found` bzw. Befehl unbekannt.

- [ ] **Step 3: `ImageReferences`**

`app/Support/ImageReferences.php`:

```php
<?php

namespace App\Support;

use App\Models\Contact;
use App\Models\Customer;
use App\Models\Document;
use App\Models\DocumentSnapshot;
use App\Models\FieldDefinition;
use App\Models\Organization;
use App\Models\Position;
use Illuminate\Database\Eloquent\Model;

/**
 * Every stored image (uploads/… of image fields, logos/… of the organization) that a record or a snapshot still
 * refers to. Values are read as stored JSON, so a path counts wherever it sits (custom fields of any level, field
 * defaults, the frozen master data of finalized documents), also in soft-deleted customers and contacts.
 */
final class ImageReferences
{
    public const PATTERN = '#^(uploads|logos)/[0-9a-z]{26}\.(png|jpg|jpeg|gif|webp|svg)$#';

    /** @var list<array{class-string<Model>, string}> */
    private const SOURCES = [
        [Organization::class, 'custom'],
        [Customer::class, 'custom'],
        [Contact::class, 'custom'],
        [Document::class, 'custom'],
        [Position::class, 'custom'],
        [FieldDefinition::class, 'default_value'],
        [DocumentSnapshot::class, 'data'],
    ];

    public static function isImagePath(string $value): bool
    {
        return preg_match(self::PATTERN, $value) === 1;
    }

    /**
     * @return array<string, true>
     */
    public static function all(): array
    {
        $paths = [];
        foreach (Organization::query()->pluck('logo_path') as $logo) {
            self::collect($logo, $paths);
        }
        foreach (self::SOURCES as [$model, $column]) {
            $rows = $model::query()->withoutGlobalScopes()->toBase()->select(['id', $column])->lazyById(500);
            foreach ($rows as $row) {
                $raw = $row->{$column};
                self::collect(is_string($raw) ? json_decode($raw, true) : $raw, $paths);
            }
        }

        return $paths;
    }

    /**
     * @param  array<string, true>  $paths
     */
    private static function collect(mixed $value, array &$paths): void
    {
        if (is_string($value)) {
            if (self::isImagePath($value)) {
                $paths[$value] = true;
            }

            return;
        }
        if (is_array($value)) {
            foreach ($value as $item) {
                self::collect($item, $paths);
            }
        }
    }
}
```

- [ ] **Step 4: Action**

`app/Actions/PruneUnusedImages.php`:

```php
<?php

namespace App\Actions;

use App\Support\Actor;
use App\Support\ImageReferences;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Storage;

/**
 * php artisan app:prune-images: deletes uploaded images (uploads/) and old logos (logos/) that no record and no
 * snapshot refers to anymore (ImageReferences). Files younger than $minAgeHours stay: an upload is stored before the
 * form that uses it is saved. Other files in those folders are never touched.
 */
final class PruneUnusedImages
{
    public const FOLDERS = ['uploads', 'logos'];

    /**
     * @return list<string> the deleted paths (with $dryRun: the paths that would be deleted), sorted
     */
    public function handle(Actor $actor, bool $dryRun = false, int $minAgeHours = 24): array
    {
        $disk = Storage::disk('local');
        $used = ImageReferences::all();
        $cutoff = CarbonImmutable::now()->subHours(max(0, $minAgeHours))->getTimestamp();

        $unused = [];
        foreach (self::FOLDERS as $folder) {
            foreach ($disk->files($folder) as $path) {
                if (! ImageReferences::isImagePath($path) || isset($used[$path]) || $disk->lastModified($path) > $cutoff) {
                    continue;
                }
                $unused[] = $path;
            }
        }
        sort($unused);
        if (! $dryRun && $unused !== []) {
            $disk->delete($unused);
        }

        return $unused;
    }
}
```

- [ ] **Step 5: Befehl**

`app/Console/Commands/PruneImages.php`:

```php
<?php

namespace App\Console\Commands;

use App\Actions\PruneUnusedImages;
use App\Support\Actor;
use Illuminate\Console\Command;

class PruneImages extends Command
{
    protected $signature = 'app:prune-images
        {--dry-run : Only list the files that would be deleted}
        {--min-age=24 : Keep files younger than this many hours (uploads are stored before their form is saved)}';

    protected $description = 'Delete uploaded images and old logos that no record and no finalized document refers to';

    public function handle(PruneUnusedImages $prune): int
    {
        $minAge = $this->option('min-age');
        if (! is_string($minAge) || ! ctype_digit($minAge)) {
            $this->error('--min-age must be a whole number of hours.');

            return self::INVALID;
        }
        $dryRun = (bool) $this->option('dry-run');

        $paths = $prune->handle(Actor::system(), $dryRun, (int) $minAge);
        foreach ($paths as $path) {
            $this->line(($dryRun ? 'would delete ' : 'deleted ').$path);
        }
        $this->info(sprintf('%d unused image(s) %s.', count($paths), $dryRun ? 'found (dry run, nothing deleted)' : 'deleted'));

        return self::SUCCESS;
    }
}
```

- [ ] **Step 6: Doc-Kommentare der Upload-Actions angleichen**

`app/Actions/StoreUpload.php`: Satz `Files are never deleted (finalized documents point at them through their snapshot).` ersetzen durch `Files stay when the value changes (finalized documents point at them through their snapshot); app:prune-images removes the ones nothing refers to.`
`app/Actions/UpdateOrganizationLogo.php`: `The previous file stays: snapshots of finalized documents keep pointing at it.` ersetzen durch `The previous file stays: snapshots of finalized documents keep pointing at it (app:prune-images removes it once nothing does).`

- [ ] **Step 7: Tests, Pint, Larastan**

Run: `ddev artisan test --filter=PruneUnusedImagesTest && ddev exec vendor/bin/pint && ddev exec vendor/bin/phpstan analyse --memory-limit=1G && ddev artisan test --filter=ArchTest`
Expected: PASS, Larastan ohne Fehler. Meldet Larastan `$row->{$column}` als Zugriff auf `mixed`/`object`, über `$row` ein `/** @var \stdClass $row */` setzen.

- [ ] **Step 8: Gegen DDEV ausprobieren**

Run: `ddev artisan app:prune-images --dry-run`
Expected: `0 unused image(s) found (dry run, nothing deleted).` (Demo-Daten haben keine Uploads) oder eine Liste, falls lokal etwas hochgeladen wurde – nichts wird gelöscht.

- [ ] **Step 9: Doku**

`docs/en/custom-fields.md`, Abschnitt „## Types“:
alt: `Uploaded files are kept even when the value changes, because finalized documents still refer to them.`
neu: `Uploaded files are kept even when the value changes, because finalized documents still refer to them. Images nothing refers to anymore (no record, no finalized document) are listed by `docker compose exec openbill php artisan app:prune-images --dry-run`; without `--dry-run` they are deleted. Files younger than 24 hours stay (`--min-age=<hours>`), because an upload is stored before its form is saved.`

`docs/de/custom-fields.md`, Abschnitt „## Typen“:
alt: `Hochgeladene Dateien bleiben erhalten, auch wenn sich der Wert ändert, weil abgeschlossene Dokumente noch auf sie verweisen.`
neu: `Hochgeladene Dateien bleiben erhalten, auch wenn sich der Wert ändert, weil abgeschlossene Dokumente noch auf sie verweisen. Bilder, auf die nichts mehr verweist (kein Datensatz, kein abgeschlossenes Dokument), listet `docker compose exec openbill php artisan app:prune-images --dry-run` auf; ohne `--dry-run` werden sie gelöscht. Dateien, die jünger als 24 Stunden sind, bleiben (`--min-age=<Stunden>`), weil ein Upload gespeichert wird, bevor sein Formular gespeichert ist.`

`docs/en/settings.md`, Ende des Absatzes unter „## Organization“ anhängen: ` A new logo keeps the old file for finalized documents; `app:prune-images` removes old logos nothing refers to anymore (see [Custom fields](/en/custom-fields#types)).`
`docs/de/settings.md`, Ende des Absatzes unter „## Organisation“: ` Ein neues Logo behält die alte Datei für abgeschlossene Dokumente; `app:prune-images` entfernt alte Logos, auf die nichts mehr verweist (siehe [Eigene Felder](/de/custom-fields#typen)).`

- [ ] **Step 10: Commit**

```bash
git add app/Support/ImageReferences.php app/Actions/PruneUnusedImages.php app/Console/Commands/PruneImages.php app/Actions/StoreUpload.php app/Actions/UpdateOrganizationLogo.php tests/Feature/Actions/PruneUnusedImagesTest.php docs/en/custom-fields.md docs/de/custom-fields.md docs/en/settings.md docs/de/settings.md
git commit -m "feat: app:prune-images deletes uploads and logos nothing refers to anymore" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Liquid – Ganzzahl-Mathe ohne Überlauf, `date` mit Unix-Zeitstempel

**Files:**
- Modify: `app/Rendering/Liquid/OpenbillFilters.php` (`date`, `plus`, `minus`, `times`, `dividedBy`, `math`)
- Modify: `docs/en/templates.md`, `docs/de/templates.md` (Abschnitt „### Filters“/„### Filter“)
- Test: `tests/Feature/Rendering/FiltersTest.php`

**Interfaces:**
- Consumes: `liquid(string $source, array $data = [], string $locale = 'de')` (Helfer in `FiltersTest.php`), `Brick\Math\BigInteger`, `RoundingMode`.
- Produces: unveränderte Filter-Signaturen (`int|string`).

- [ ] **Step 1: brick/math-API prüfen**

Run: `ddev exec 'grep -n "public function dividedBy\|public function isGreaterThan\|public function toInt" vendor/brick/math/src/BigInteger.php vendor/brick/math/src/BigNumber.php; grep -n "case Floor" vendor/brick/math/src/RoundingMode.php'`
Expected: `dividedBy(… $that, RoundingMode $roundingMode = …)`, `isGreaterThan`, `toInt` und `case Floor`. Heißt der Fall anders (z. B. `FLOOR`), in Step 4 entsprechend schreiben.

- [ ] **Step 2: Failing tests**

In `tests/Feature/Rendering/FiltersTest.php` anhängen:

```php
it('keeps integer math exact past PHP_INT_MAX instead of turning into a float (ledger phase 3, M5)', function () {
    $max = (string) PHP_INT_MAX; // 9223372036854775807

    expect(liquid("{{ {$max} | plus: 1 }}"))->toBe('9223372036854775808')
        ->and(liquid("{{ {$max} | times: 2 }}"))->toBe('18446744073709551614')
        ->and(liquid('{{ -9223372036854775807 | minus: 2 }}'))->toBe('-9223372036854775809')
        // PHP_INT_MIN / -1 throws in intdiv()
        ->and(liquid('{{ -9223372036854775807 | minus: 1 | divided_by: -1 }}'))->toBe('9223372036854775808')
        ->and(liquid("{{ {$max} | plus: 1 | minus: 1 }}"))->toBe($max)
        // Liquid's integer division rounds down, also below zero
        ->and(liquid('{{ -7 | divided_by: 2 }}'))->toBe('-4');
});

it('formats an integer as Unix timestamp like Liquid does (ledger phase 3)', function () {
    // 2026-10-04 12:00:00 UTC
    expect(liquid('{{ 1791115200 | date }}'))->toBe('04.10.2026')
        ->and(liquid('{{ 1791115200 | date }}', [], 'en'))->toBe('Oct 4, 2026')
        ->and(liquid('{{ 1791115200 | date: "%Y-%m-%d %H:%M" }}'))->toBe('2026-10-04 12:00')
        ->and(liquid('{{ t | date: "%d.%m.%Y" }}', ['t' => 1791115200]))->toBe('04.10.2026')
        ->and(fn () => liquid('[{{ t | date }}]', ['t' => PHP_INT_MAX]))->not->toThrow(Throwable::class);
});
```

- [ ] **Step 3: Tests laufen lassen, sie schlagen fehl**

Run: `ddev artisan test --filter=FiltersTest`
Expected: FAIL – z. B. `'9.2233720368548E+18'` statt `'9223372036854775808'`, und `''` statt `'04.10.2026'`.

- [ ] **Step 4: Implementieren**

In `app/Rendering/Liquid/OpenbillFilters.php`:
- Import `use Brick\Math\BigInteger;` ergänzen.
- Am Anfang von `date()` vor `if (! is_string($value) || trim($value) === '') {` einfügen:

```php
        // Liquid takes Unix timestamps too ({{ 1791115200 | date }}): seconds, shown in the app's time zone
        if (is_int($value)) {
            try {
                $value = CarbonImmutable::createFromTimestamp($value, (string) config('app.timezone'))->format('Y-m-d H:i:s');
            } catch (Throwable) {
                return '';
            }
        }
```

- `plus`/`minus`/`times`/`dividedBy` – nur die Ganzzahl-Closures ändern:

```php
    public function plus(mixed $input, mixed $operand): int|string
    {
        return $this->math($input, $operand, fn (BigDecimal $a, BigDecimal $b): BigDecimal => $a->plus($b), fn (BigInteger $a, BigInteger $b): BigInteger => $a->plus($b));
    }

    public function minus(mixed $input, mixed $operand): int|string
    {
        return $this->math($input, $operand, fn (BigDecimal $a, BigDecimal $b): BigDecimal => $a->minus($b), fn (BigInteger $a, BigInteger $b): BigInteger => $a->minus($b));
    }

    public function times(mixed $input, mixed $operand): int|string
    {
        return $this->math($input, $operand, fn (BigDecimal $a, BigDecimal $b): BigDecimal => $a->multipliedBy($b), fn (BigInteger $a, BigInteger $b): BigInteger => $a->multipliedBy($b));
    }
```

In `dividedBy` die zweite Closure ersetzen durch `fn (BigInteger $a, BigInteger $b): BigInteger => $a->dividedBy($b, RoundingMode::Floor),`.

- Doc-Kommentar über `plus` ergänzen: `Two integers keep Liquid's integer semantics, exactly: a result beyond PHP's int range comes back as a decimal string.` (statt `Two integers keep Liquid's integer semantics.`)
- `math()` ersetzen:

```php
    private function math(mixed $input, mixed $operand, Closure $decimal, Closure $integer): int|string
    {
        $this->guardDigits($input);
        $this->guardDigits($operand);
        if (is_int($input) && is_int($operand)) {
            // PHP would switch to float past PHP_INT_MAX: compute exactly, an int as long as it fits
            /** @var BigInteger $result */
            $result = $integer(BigInteger::of($input), BigInteger::of($operand));

            return $result->isGreaterThan(PHP_INT_MAX) || $result->isLessThan(PHP_INT_MIN) ? (string) $result : $result->toInt();
        }

        return (string) $decimal(self::decimal($input) ?? BigDecimal::zero(), self::decimal($operand) ?? BigDecimal::zero());
    }
```

- [ ] **Step 5: Tests laufen lassen**

Run: `ddev artisan test --filter='FiltersTest|FilterPolicyTest|NoFloatTest|GoldenTest|BuiltInTemplatesTest'`
Expected: PASS.

- [ ] **Step 6: Doku**

Im Abschnitt „### Filters“ von `docs/en/templates.md` den Eintrag zu `date` suchen (`grep -n '`date`' docs/en/templates.md`) und am Ende der Beschreibung ergänzen: ` A whole number is read as Unix timestamp (seconds).` Unter den Rechenfiltern (`plus`, `minus`, `times`, `divided_by`) ergänzen: ` Two whole numbers stay whole numbers (`divided_by` rounds down); results beyond ±9.2 × 10¹⁸ stay exact.`
`docs/de/templates.md`, gleiche Stellen: ` Eine ganze Zahl gilt als Unix-Zeitstempel (Sekunden).` und ` Zwei ganze Zahlen bleiben ganze Zahlen (`divided_by` rundet ab); Ergebnisse jenseits von ±9,2 × 10¹⁸ bleiben exakt.`
Die Überschriften `## Liquid reference` und `## Limits and errors` nicht ändern (`McpServerTest`).

Run: `ddev artisan test --filter=McpServerTest`
Expected: PASS.

- [ ] **Step 7: Pint, Larastan, Commit**

```bash
ddev exec vendor/bin/pint && ddev exec vendor/bin/phpstan analyse --memory-limit=1G
git add app/Rendering/Liquid/OpenbillFilters.php tests/Feature/Rendering/FiltersTest.php docs/en/templates.md docs/de/templates.md
git commit -m "fix: exact Liquid integer math beyond PHP_INT_MAX, date filter takes Unix timestamps" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Stammdaten trimmen, `X-Forwarded-Prefix` ignorieren, Wächter gegen `@openbill_unlock`

**Files:**
- Create: `app/Support/TrimmedInput.php`
- Modify: `app/Actions/UpdateOrganization.php`, `app/Actions/SaveTaxRate.php`, `app/Actions/SaveUnit.php`, `app/Actions/SaveTextBlock.php`, `app/Actions/IssueApiToken.php`
- Modify: `app/Http/Middleware/TrustProxies.php`
- Modify: `docs/en/reverse-proxy.md`, `docs/de/reverse-proxy.md`, `docs/en/setup.md`, `docs/de/setup.md`
- Test: `tests/Feature/Actions/MasterDataTrimTest.php` (neu), `tests/Feature/TrustedProxiesTest.php`, `tests/Unit/ArchTest.php`

**Interfaces:**
- Consumes: Actions wie oben, `systemActor()`, `User::factory()`.
- Produces: `TrimmedInput::strings(array $input, list<string> $keys): array`; `TrustProxies::headers(): int` ohne `HEADER_X_FORWARDED_PREFIX`.

- [ ] **Step 1: Failing tests (Trimmen)**

`tests/Feature/Actions/MasterDataTrimTest.php`:

```php
<?php

use App\Actions\IssueApiToken;
use App\Actions\SaveTaxRate;
use App\Actions\SaveTextBlock;
use App\Actions\SaveUnit;
use App\Actions\UpdateOrganization;
use App\Models\User;
use Illuminate\Validation\ValidationException;

it('stores names sent as JSON without surrounding blanks, free texts as typed (ledger phase 4)', function () {
    $rate = app(SaveTaxRate::class)->handle(systemActor(), ['label' => '  Reduziert 7 % ', 'percent' => '7.00', 'category' => 'S']);
    $unit = app(SaveUnit::class)->handle(systemActor(), ['name' => ' Pauschale ', 'symbol' => ' psch ', 'code' => ' LS ']);
    $block = app(SaveTextBlock::class)->handle(systemActor(), ['name' => '  Zahlungsziel ', 'kind' => 'closing', 'body' => "  Bitte zahlen.\n"]);
    $org = app(UpdateOrganization::class)->handle(systemActor(), ['name' => ' Studio Nordlicht ', 'city' => ' Hamburg ', 'email' => ' hallo@nordlicht.example ']);
    $token = app(IssueApiToken::class)->handle(systemActor(), User::factory()->create(), ['name' => ' Agent ', 'abilities' => ['api:read']]);

    expect($rate->label)->toBe('Reduziert 7 %')
        ->and([$unit->name, $unit->symbol, $unit->code])->toBe(['Pauschale', 'psch', 'LS'])
        ->and($block->name)->toBe('Zahlungsziel')
        ->and($block->body)->toBe("  Bitte zahlen.\n")
        ->and([$org->name, $org->city, $org->email])->toBe(['Studio Nordlicht', 'Hamburg', 'hallo@nordlicht.example'])
        ->and($token->accessToken->name)->toBe('Agent');
});

it('refuses names of blanks only', function () {
    expect(fn () => app(SaveTaxRate::class)->handle(systemActor(), ['label' => '   ', 'percent' => '7.00', 'category' => 'S']))->toThrow(ValidationException::class)
        ->and(fn () => app(SaveUnit::class)->handle(systemActor(), ['name' => '  ']))->toThrow(ValidationException::class)
        ->and(fn () => app(SaveTextBlock::class)->handle(systemActor(), ['name' => ' ', 'kind' => 'closing']))->toThrow(ValidationException::class)
        ->and(fn () => app(IssueApiToken::class)->handle(systemActor(), User::factory()->create(), ['name' => '  ', 'abilities' => ['api:read']]))->toThrow(ValidationException::class);
});
```

- [ ] **Step 2: Failing test (Präfix)**

In `tests/Feature/TrustedProxiesTest.php` nach „ignores X-Forwarded-* sent straight from the internet“:

```php
it('ignores X-Forwarded-Prefix even from a trusted proxy: openbill runs at the root of its host (ledger phase 10)', function () {
    Route::get('/_prefix-check', fn (Request $request): array => ['base' => $request->getBaseUrl(), 'secure' => $request->isSecure()]);

    $this->withServerVariables(['REMOTE_ADDR' => '10.1.2.3'])
        ->get('http://localhost/_prefix-check', ['X-Forwarded-Prefix' => '/elsewhere', 'X-Forwarded-Proto' => 'https'])
        ->assertOk()
        ->assertExactJson(['base' => '', 'secure' => true]);
});
```

- [ ] **Step 3: Wächter (Ledger Phase 2, M-C)**

In `tests/Unit/ArchTest.php` nach dem Test „never queries documents, positions, … through DB::table in app/“:

```php
it('never switches the lock triggers off in app/ (only DemoSeeder::wipe may, ledger phase 2 M-C)', function () {
    $root = dirname(__DIR__, 2).'/app';
    $hits = [];
    foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS)) as $file) {
        if ($file->getExtension() === 'php' && str_contains((string) file_get_contents($file->getPathname()), 'openbill_unlock')) {
            $hits[] = substr($file->getPathname(), strlen($root) + 1);
        }
    }

    expect($hits)->toBe([]);
});
```

- [ ] **Step 4: Tests laufen lassen**

Run: `ddev artisan test --filter='MasterDataTrimTest|TrustedProxiesTest|ArchTest'`
Expected: `MasterDataTrimTest` FAIL (`' Pauschale '` bzw. ValidationException wegen `' LS '`), der Präfix-Test FAIL (`base` = `/elsewhere`), der Arch-Wächter PASS (sichert den Ist-Zustand).

- [ ] **Step 5: `TrimmedInput`**

`app/Support/TrimmedInput.php`:

```php
<?php

namespace App\Support;

/**
 * Master data is stored without surrounding blanks. Laravel's TrimStrings middleware never sees the JSON bodies of
 * the API (API Platform reads the raw body) nor MCP arguments, so actions trim their name-like fields themselves –
 * before validating, so a name of blanks only fails "required". Free texts (text block bodies, document texts) stay
 * as typed. SaveCustomer has its own variant for nested contacts.
 */
final class TrimmedInput
{
    /**
     * @param  array<string, mixed>  $input
     * @param  list<string>  $keys
     * @return array<string, mixed>
     */
    public static function strings(array $input, array $keys): array
    {
        foreach ($keys as $key) {
            if (isset($input[$key]) && is_string($input[$key])) {
                $input[$key] = trim($input[$key]);
            }
        }

        return $input;
    }
}
```

- [ ] **Step 6: In den Actions anwenden**

Jeweils als erste Zeile in `handle()` (vor `Validator::make`), Import `use App\Support\TrimmedInput;` ergänzen:
- `app/Actions/UpdateOrganization.php`: `$input = TrimmedInput::strings($input, self::STRINGS);`
- `app/Actions/SaveTaxRate.php`: `$input = TrimmedInput::strings($input, ['label', 'exemption_note']);`
- `app/Actions/SaveUnit.php`: `$input = TrimmedInput::strings($input, ['name', 'symbol', 'code']);`
- `app/Actions/SaveTextBlock.php`: `$input = TrimmedInput::strings($input, ['name']);`
- `app/Actions/IssueApiToken.php`: nach dem `isDisabled()`-Check: `$input = TrimmedInput::strings($input, ['name']);`

- [ ] **Step 7: `TrustProxies::headers()`**

`app/Http/Middleware/TrustProxies.php` vollständig:

```php
<?php

namespace App\Http\Middleware;

use App\Support\TrustedRequests;
use Illuminate\Http\Middleware\TrustProxies as BaseTrustProxies;
use Illuminate\Http\Request;

/**
 * Laravel's TrustProxies with the proxy list read per request from config (TRUSTED_PROXIES), so it works with a
 * cached config and in tests; bootstrap/app.php replaces the framework middleware with this one.
 */
class TrustProxies extends BaseTrustProxies
{
    /** @return list<string> */
    protected function proxies(): array
    {
        return TrustedRequests::proxies();
    }

    /**
     * X-Forwarded-For/-Host/-Port/-Proto only. openbill runs at the root of its host: X-Forwarded-Prefix (which
     * Laravel trusts by default) would end up in every generated URL, so not even a trusted proxy may set it.
     */
    protected function headers(): int
    {
        return Request::HEADER_X_FORWARDED_FOR | Request::HEADER_X_FORWARDED_HOST | Request::HEADER_X_FORWARDED_PORT | Request::HEADER_X_FORWARDED_PROTO;
    }
}
```

- [ ] **Step 8: Tests laufen lassen**

Run: `ddev artisan test --filter='MasterDataTrimTest|TrustedProxiesTest|ArchTest|SettingsActionsTest|ApiTokenActionsTest|RestoreMasterDataTest'`
Expected: PASS.

- [ ] **Step 9: Doku `TRUSTED_PROXIES` und Präfix**

`docs/en/reverse-proxy.md`, erste Aufzählung unter „## Who openbill believes“ (Zeile mit `- **Forwarded headers**`), ersetzen durch:

```markdown
- **Forwarded headers** (`X-Forwarded-For`, `-Proto`, `-Host`, `-Port`) only from the addresses in `TRUSTED_PROXIES`: IP addresses or networks in CIDR notation, comma-separated – no host names (a Docker service name like `traefik` matches nothing, and the headers are silently ignored). Default: `127.0.0.1`, `::1`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `fc00::/7` – a proxy on the same host, in the same Docker network or in your LAN is covered. `X-Forwarded-Prefix` is never believed: openbill runs at the root of its own host name, not under a path like `/openbill`.
```

`docs/de/reverse-proxy.md`, Zeile mit `- **Weitergeleitete Header**`:

```markdown
- **Weitergeleitete Header** (`X-Forwarded-For`, `-Proto`, `-Host`, `-Port`) nur von den Adressen in `TRUSTED_PROXIES`: IP-Adressen oder Netze in CIDR-Schreibweise, kommagetrennt – keine Hostnamen (ein Docker-Dienstname wie `traefik` passt auf nichts, die Header werden dann still ignoriert). Standard: `127.0.0.1`, `::1`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `fc00::/7` – ein Proxy auf demselben Host, im selben Docker-Netz oder in deinem LAN ist damit abgedeckt. `X-Forwarded-Prefix` glaubt openbill nie: openbill läuft an der Wurzel seines eigenen Hostnamens, nicht unter einem Pfad wie `/openbill`.
```

`docs/en/setup.md`, Tabellenzeile `TRUSTED_PROXIES`:

```markdown
| `TRUSTED_PROXIES` | no | IP addresses or CIDR networks (no host names) whose `X-Forwarded-*` headers openbill believes, comma-separated. Default: localhost and the private networks. Narrow it to your proxy as soon as `OPENBILL_BIND` isn't `127.0.0.1`. |
```

`docs/de/setup.md`:

```markdown
| `TRUSTED_PROXIES` | nein | IP-Adressen oder CIDR-Netze (keine Hostnamen), deren `X-Forwarded-*`-Headern openbill glaubt, kommagetrennt. Standard: localhost und die privaten Netze. Schränke es auf deinen Proxy ein, sobald `OPENBILL_BIND` nicht `127.0.0.1` ist. |
```

Run: `ddev artisan test --filter=DocsTest`
Expected: PASS (die Pflichtbegriffe der Seiten bleiben enthalten).

- [ ] **Step 10: Pint, Larastan, Commit**

```bash
ddev exec vendor/bin/pint && ddev exec vendor/bin/phpstan analyse --memory-limit=1G
git add app/Support/TrimmedInput.php app/Actions/UpdateOrganization.php app/Actions/SaveTaxRate.php app/Actions/SaveUnit.php app/Actions/SaveTextBlock.php app/Actions/IssueApiToken.php app/Http/Middleware/TrustProxies.php tests/Feature/Actions/MasterDataTrimTest.php tests/Feature/TrustedProxiesTest.php tests/Unit/ArchTest.php docs/en/reverse-proxy.md docs/de/reverse-proxy.md docs/en/setup.md docs/de/setup.md
git commit -m "fix: trim master data names from JSON bodies, ignore X-Forwarded-Prefix, document TRUSTED_PROXIES format" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Dependabot und KoSIT-Beurteilung, E-Rechnungs-Doku aktualisieren

**Files:**
- Create: `.github/dependabot.yml`
- Modify: `docs/en/e-invoice.md`, `docs/de/e-invoice.md` (Abschnitt „## Requirements and limits“/„## Voraussetzungen und Grenzen“)
- Modify: `docs/en/development.md`, `docs/de/development.md` (Abschnitt zu gepinnten Images)

**Interfaces:**
- Consumes: –
- Produces: `.github/dependabot.yml` (wird erst auf `main` aktiv).

- [ ] **Step 1: KoSIT-Annahme prüfen**

Run: `gh api repos/itplr-kosit/validator-configuration-xrechnung/contents/scenarios.xml --jq .content | base64 -d | grep -oE '<name>[^<]+</name>' | sort -u`
Expected: nur XRechnung-Szenarien (UBL Invoice/CreditNote, CII, ggf. Extension), keines für reines EN 16931/Factur-X. Auch `gh search repos --owner itplr-kosit validator-configuration --json name --jq '.[].name'` zeigt keine EN-16931-Konfiguration.
Falls doch eine reine EN-16931-CII-Konfiguration existiert: hier stoppen und dem Orchestrator melden (dann wird ein Job `kosit` neben `einvoice` nachgeplant); sonst weiter.

- [ ] **Step 2: Lockfile-Version prüfen**

Run: `head -1 pnpm-lock.yaml e2e/pnpm-lock.yaml`
Expected: beide `lockfileVersion: '9.0'` (Dependabot liest pnpm-Lockfiles v9). Steht dort etwas anderes, den `npm`-Block in Step 3 weglassen und das im Commit-Text nennen.

- [ ] **Step 3: `.github/dependabot.yml`**

```yaml
# Weekly update PRs, grouped. Docker images are left out on purpose: they are pinned by digest in several places that
# must stay equal (tests/Feature/DockerSetupTest.php, docs/en/development.md "Base images").
version: 2
updates:
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
    groups:
      actions:
        patterns: ['*']

  - package-ecosystem: composer
    directory: /
    schedule:
      interval: weekly
    open-pull-requests-limit: 5
    groups:
      composer-minor:
        update-types: [minor, patch]

  # pnpm: Dependabot reads pnpm-lock.yaml (workspace root; e2e/ is a project of its own)
  - package-ecosystem: npm
    directories: ['/', '/e2e']
    schedule:
      interval: weekly
    open-pull-requests-limit: 5
    groups:
      npm-minor:
        update-types: [minor, patch]
```

Run: `docker run --rm -v "$PWD:/r:ro" mikefarah/yq:4.44.3 '.updates[].package-ecosystem' /r/.github/dependabot.yml`
Expected: `github-actions`, `composer`, `npm` (gültiges YAML).

- [ ] **Step 4: E-Rechnungs-Doku**

In `docs/en/e-invoice.md`, Abschnitt „## Requirements and limits“:
- Zeile `- openbill checks every XML against the schema …` ersetzen durch:

```markdown
- openbill checks every XML against the schema before archiving it. The business rules of EN 16931 (Schematron) are covered by the compliance profile; the official CEN Schematron runs in development and CI on the e-invoice cases of the test suite (`scripts/validate-einvoice.sh`). The KoSIT validator is not used: its configuration checks XRechnung, which adds German rules on top (BR-DE, for example the Leitweg-ID), and openbill does not produce XRechnung.
```

- Zeile `- Customers outside the EU are taxed with category `G` (export); a category for services to such customers (`O`) is planned.` ersetzen (Stand seit Phase 7, vorher mit Abschnitt „## Taxes“ derselben Seite abgleichen und dort gleiche Begriffe nutzen):

```markdown
- Customers outside the EU: goods are taxed with category `G` (export), services to businesses with category `O` (not subject to VAT, without VAT IDs in the XML), services to consumers with the regular rate of the position.
```

In `docs/de/e-invoice.md`, Abschnitt „## Voraussetzungen und Grenzen“:

```markdown
- openbill prüft jede XML vor dem Archivieren gegen das Schema. Die Geschäftsregeln von EN 16931 (Schematron) deckt das Prüfprofil ab; das offizielle CEN-Schematron läuft in der Entwicklung und in CI über die E-Rechnungsfälle der Tests (`scripts/validate-einvoice.sh`). Den KoSIT-Validator nutzt openbill nicht: Seine Konfiguration prüft XRechnung, die zusätzliche deutsche Regeln mitbringt (BR-DE, etwa die Leitweg-ID), und XRechnung erzeugt openbill nicht.
```

```markdown
- Kunden außerhalb der EU: Waren werden mit Kategorie `G` (Ausfuhr) besteuert, Dienstleistungen an Unternehmen mit Kategorie `O` (nicht steuerbar, ohne USt-IDs in der XML), Dienstleistungen an Privatpersonen mit dem normalen Satz der Position.
```

- [ ] **Step 5: Entwickler-Doku**

In `docs/en/development.md` nach dem Absatz `Base images are pinned by version and digest …` (und seinem Codeblock) einfügen:

```markdown
Dependabot (`.github/dependabot.yml`) opens weekly, grouped PRs for GitHub Actions, Composer and pnpm (root and `e2e/`). It leaves Docker images alone on purpose: update those by hand as described above.
```

`docs/de/development.md`, an der entsprechenden Stelle:

```markdown
Dependabot (`.github/dependabot.yml`) öffnet wöchentlich gruppierte PRs für GitHub Actions, Composer und pnpm (Root und `e2e/`). Docker-Images lässt es absichtlich aus: die wie oben beschrieben von Hand aktualisieren.
```

- [ ] **Step 6: Doku-Build und Commit**

Run: `ddev exec pnpm --dir docs build >/dev/null && ddev artisan test --filter=DocsTest`
Expected: Build ohne Fehler, DocsTest PASS.

```bash
git add .github/dependabot.yml docs/en/e-invoice.md docs/de/e-invoice.md docs/en/development.md docs/de/development.md
git commit -m "chore: dependabot for actions, composer and pnpm; document why there is no KoSIT check" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: VitePress für GitHub Pages – `base`, Theme, Workflow `docs.yml`, Pages aktivieren

**Files:**
- Modify: `docs/.vitepress/config.ts`
- Modify: `docs/.vitepress/theme/index.ts`, `docs/.vitepress/theme/style.css`
- Modify: `docs/package.json`, `pnpm-lock.yaml` (Schrift)
- Create: `.github/workflows/docs.yml`
- Modify: `.github/workflows/tests.yml` (Schritt `Docs`)
- Test: `tests/Unit/DocsTest.php`

**Interfaces:**
- Consumes: –
- Produces: Umgebungsvariablen `DOCS_BASE` (z. B. `/openbill/`, Standard `/`) und `DOCS_URL` (z. B. `https://baeroe.github.io/openbill`, ohne Schrägstrich am Ende) für `pnpm --dir docs build`; Theme-Klasse `.showcase` (Task 11).

- [ ] **Step 1: Failing test**

In `tests/Unit/DocsTest.php` anhängen:

```php
it('builds the docs for GitHub Pages under /openbill/ and redirects relative to the base', function () {
    $root = dirname(__DIR__, 2);
    $workflow = (string) file_get_contents("{$root}/.github/workflows/docs.yml");

    expect((string) file_get_contents("{$root}/docs/.vitepress/config.ts"))->toContain('process.env.DOCS_BASE', 'process.env.DOCS_URL')
        ->and((string) file_get_contents("{$root}/docs/.vitepress/theme/index.ts"))->toContain('import.meta.env.BASE_URL')
        ->and($workflow)->toContain('DOCS_BASE: /openbill/', 'DOCS_URL: https://baeroe.github.io/openbill', 'actions/deploy-pages', 'fetch-depth: 0')
        ->and((string) file_get_contents("{$root}/.github/workflows/tests.yml"))->toContain('DOCS_BASE: /openbill/');
});
```

Run: `ddev artisan test --filter=DocsTest`
Expected: FAIL (`docs.yml` fehlt).

- [ ] **Step 2: Schrift für die Doku**

Run: `ddev exec pnpm --dir docs add -D @fontsource-variable/schibsted-grotesk@^5.3.0`
Expected: `docs/package.json` hat die Abhängigkeit, `pnpm-lock.yaml` ist aktualisiert (keine neue `allowBuilds`-Meldung).

- [ ] **Step 3: `config.ts`**

In `docs/.vitepress/config.ts`:
- Import `import { defineConfig, type DefaultTheme, type HeadConfig } from 'vitepress';`
- Nach den Importen:

```ts
// Published on GitHub Pages under /openbill/ until the docs get a domain of their own (.github/workflows/docs.yml sets
// DOCS_BASE and DOCS_URL). Locally and in DDEV the site lives at /.
const base = process.env.DOCS_BASE ?? '/';
/** Absolute address of the published docs without trailing slash (llms.txt links, link previews); unset locally. */
const site = process.env.DOCS_URL?.replace(/\/$/, '');
const description = 'Open, self-hosted quotes and invoices with custom fields, Liquid templates and EN 16931 e-invoices.';
```

- In `defineConfig({ … })`: `base,` als erste Eigenschaft; `head` ersetzen durch

```ts
    // head entries are not rewritten to the base by VitePress
    head: [
        ['link', { rel: 'icon', href: `${base}favicon.svg`, type: 'image/svg+xml' }],
        ['meta', { name: 'theme-color', content: '#f4f4f2' }],
        ['meta', { property: 'og:title', content: 'openbill' }],
        ['meta', { property: 'og:description', content: description }],
        ...(site ? ([['meta', { property: 'og:image', content: `${site}/screenshots/en/editor.png` }]] satisfies HeadConfig[]) : []),
    ],
```

- Die Zeile `appearance: false,` löschen (hell und dunkel wie die App).
- `plugins: [llmstxt({ workDir: 'en' })],` ersetzen durch `plugins: [llmstxt({ workDir: 'en', ...(site ? { domain: site } : {}) })],`
- Im englischen Locale `description: description,`; `nav` beider Sprachen um den Releases-Link ergänzen:
  - en: `nav: [{ text: 'Guide', link: '/en/setup' }, { text: 'Releases', link: 'https://github.com/baeroe/openbill/releases' }],`
  - de: `nav: [{ text: 'Anleitung', link: '/de/setup' }, { text: 'Releases', link: 'https://github.com/baeroe/openbill/releases' }],`
- Im deutschen `themeConfig` ergänzen: `darkModeSwitchLabel: 'Darstellung', lightModeSwitchTitle: 'Zu hell wechseln', darkModeSwitchTitle: 'Zu dunkel wechseln',`

- [ ] **Step 4: Theme**

`docs/.vitepress/theme/index.ts` vollständig:

```ts
import '@fontsource-variable/schibsted-grotesk';
import { inBrowser } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import './style.css';

// pages live under /en and /de below the base (/ locally, /openbill/ on GitHub Pages): paths without a language
// (/, /development) land in English. Runs on GitHub Pages' 404 page too.
const base = import.meta.env.BASE_URL;
if (inBrowser && location.pathname.startsWith(base)) {
    const rest = location.pathname.slice(base.length);
    if (!/^(en|de)(\/|$)/.test(rest)) {
        location.replace(`${base}en/${rest}${location.search}${location.hash}`);
    }
}

export default DefaultTheme;
```

`docs/.vitepress/theme/style.css` vollständig:

```css
/* openbill tokens ("Graphit & Kobalt", prototypes/clickdummy-v2/DESIGN.md; values of resources/css/app.css), light and dark */
:root {
    --ob-bg: #f4f4f2;
    --ob-surface: #ffffff;
    --ob-surface-2: #ecece9;
    --ob-surface-3: #e3e3df;
    --ob-ink: #23252b;
    --ob-muted: #5f626a;
    --ob-faint: #a2a4aa;
    --ob-accent: #2f55d4;
    --ob-accent-hover: #2647b8;
    --ob-accent-ink: #ffffff;
    --ob-accent-soft: #e3e9fb;
    --ob-elev-paper: 0 1px 2px rgb(20 22 30 / 0.06), 0 16px 36px -18px rgb(20 22 30 / 0.28);

    --vp-font-family-base: 'Schibsted Grotesk Variable', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
    --vp-font-family-mono: ui-monospace, 'SF Mono', 'Cascadia Code', Menlo, monospace;
}

.dark {
    --ob-bg: #16171a;
    --ob-surface: #1f2024;
    --ob-surface-2: #292a2f;
    --ob-surface-3: #33343a;
    --ob-ink: #ececee;
    --ob-muted: #9a9ca3;
    --ob-faint: #686a71;
    --ob-accent: #829bf3;
    --ob-accent-hover: #9aaff6;
    --ob-accent-ink: #0d1330;
    --ob-accent-soft: #252e52;
    --ob-elev-paper: 0 1px 2px rgb(0 0 0 / 0.4), 0 18px 40px -16px rgb(0 0 0 / 0.7);
}

/* layers come from tone, not from borders (DESIGN.md) */
:root,
.dark {
    --vp-c-bg: var(--ob-bg);
    --vp-c-bg-alt: var(--ob-surface);
    --vp-c-bg-elv: var(--ob-surface);
    --vp-c-bg-soft: var(--ob-surface-2);
    --vp-c-text-1: var(--ob-ink);
    --vp-c-text-2: var(--ob-muted);
    --vp-c-text-3: var(--ob-faint);
    --vp-c-divider: var(--ob-surface-3);
    --vp-c-gutter: var(--ob-surface-3);
    --vp-c-border: var(--ob-surface-3);

    --vp-c-brand-1: var(--ob-accent);
    --vp-c-brand-2: var(--ob-accent-hover);
    --vp-c-brand-3: var(--ob-accent);
    --vp-c-brand-soft: var(--ob-accent-soft);

    --vp-button-brand-bg: var(--ob-accent);
    --vp-button-brand-hover-bg: var(--ob-accent-hover);
    --vp-button-brand-active-bg: var(--ob-accent-hover);
    --vp-button-brand-text: var(--ob-accent-ink);
    --vp-button-brand-hover-text: var(--ob-accent-ink);
    --vp-button-brand-active-text: var(--ob-accent-ink);
    --vp-button-alt-bg: var(--ob-surface-2);
    --vp-button-alt-text: var(--ob-ink);
    --vp-button-alt-hover-bg: var(--ob-surface-3);
    --vp-button-alt-hover-text: var(--ob-ink);

    --vp-code-block-bg: var(--ob-surface-2);
    --vp-home-hero-name-color: var(--ob-ink);
}

/* pill buttons and 18 px cards like the app */
.VPButton {
    border-radius: 999px !important;
}
.VPFeature {
    border: 0 !important;
    border-radius: 18px !important;
    background: var(--ob-surface) !important;
    box-shadow: var(--ob-elev-paper);
}

.VPHero .name {
    letter-spacing: -0.03em;
}
.VPHero .text {
    letter-spacing: -0.02em;
    max-width: 20ch;
    text-wrap: balance;
}

/* the screenshot below the features on the landing pages */
.showcase {
    max-width: 1152px;
    margin: 72px auto 96px;
    padding: 0 48px;
}
.showcase img {
    display: block;
    width: 100%;
    border-radius: 14px;
    box-shadow: var(--ob-elev-paper);
}
@media (max-width: 640px) {
    .showcase {
        margin-top: 48px;
        padding: 0 24px;
    }
}

/* screenshots in the guide: framed like a sheet of the app */
.vp-doc img {
    border-radius: 12px;
    box-shadow: var(--ob-elev-paper);
}
```

- [ ] **Step 5: Workflow `docs.yml`**

`.github/workflows/docs.yml`:

```yaml
name: Docs

# GitHub Pages: https://baeroe.github.io/openbill/ – until the docs get a domain of their own (then drop DOCS_BASE,
# point DOCS_URL at the domain and add docs/public/CNAME)
on:
  push:
    branches: [main]
    paths: ['docs/**', 'pnpm-lock.yaml', '.github/workflows/docs.yml']
  workflow_dispatch:

permissions:
  contents: read

# one deployment at a time; a running one is not cancelled halfway
concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    env:
      DOCS_BASE: /openbill/
      DOCS_URL: https://baeroe.github.io/openbill
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # "last updated" needs the git history

      # version comes from "packageManager" in package.json
      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version-file: .node-version
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: pnpm --dir docs build

      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: docs/.vitepress/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 6: CI baut die Doku wie Pages**

In `.github/workflows/tests.yml` den Schritt `- name: Docs` ersetzen:

```yaml
      # built like docs.yml publishes it (GitHub Pages under /openbill/): links, assets and the favicon carry the base
      - name: Docs
        run: |
          pnpm --dir docs build
          grep -q 'href="/openbill/favicon.svg"' docs/.vitepress/dist/en/index.html
          grep -q 'https://baeroe.github.io/openbill/setup.md' docs/.vitepress/dist/llms.txt
        env:
          DOCS_BASE: /openbill/
          DOCS_URL: https://baeroe.github.io/openbill
```

- [ ] **Step 7: Lokal unter der Pages-Basis bauen und prüfen**

Run:
```bash
ddev exec 'DOCS_BASE=/openbill/ DOCS_URL=https://baeroe.github.io/openbill pnpm --dir docs build' >/dev/null && \
grep -o 'href="/openbill/favicon.svg"' docs/.vitepress/dist/en/index.html && \
grep -c '"/openbill/assets/' docs/.vitepress/dist/en/index.html && \
grep -o 'href="/openbill/en/setup"' docs/.vitepress/dist/en/index.html | head -1 && \
sed -n 1,20p docs/.vitepress/dist/llms.txt
```
Expected: `href="/openbill/favicon.svg"`, ein Zähler ≥ 1, `href="/openbill/en/setup"`, und `llms.txt` mit Links der Form `https://baeroe.github.io/openbill/setup.md`. Stehen in `llms.txt` andere Pfade (z. B. ohne `/openbill`), die `domain`-Option in `vitepress-plugin-llms` 1.14 nachlesen (`docs/node_modules/vitepress-plugin-llms/dist/index.d.ts`, Abschnitt `domain`) und den Wert so setzen, dass genau diese Form entsteht; die Prüfung im CI-Schritt (Step 6) anpassen. (Mutagen: falls `dist` auf dem Mac noch alt ist, `ddev mutagen sync`.)

- [ ] **Step 8: Weiterleitung unter `/openbill/` im Browser prüfen**

Run (Terminal 1): `ddev exec 'pnpm --dir docs exec vitepress preview --host 0.0.0.0 --port 5174'`
Run (Terminal 2, Mac):
```bash
cd e2e && node --input-type=module -e "
import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ ignoreHTTPSErrors: true });
await page.goto('https://openbill.ddev.site:5174/openbill/');
await page.waitForURL(/\/openbill\/en\/$/);
console.log(page.url(), '|', await page.locator('.VPHero .name').innerText());
await page.goto('https://openbill.ddev.site:5174/openbill/development');
await page.waitForURL(/\/openbill\/en\/development$/);
console.log(page.url());
await page.goto('https://openbill.ddev.site:5174/openbill/de/setup');
console.log(page.url(), '|', await page.locator('h1').first().innerText());
await browser.close();"
```
Expected:
```
https://openbill.ddev.site:5174/openbill/en/ | openbill
https://openbill.ddev.site:5174/openbill/en/development
https://openbill.ddev.site:5174/openbill/de/setup | Einrichtung
```
Danach Preview beenden (Ctrl+C) und einmal ohne Basis bauen: `ddev exec pnpm --dir docs build >/dev/null && grep -o 'href="/favicon.svg"' docs/.vitepress/dist/en/index.html` → `href="/favicon.svg"`.

- [ ] **Step 9: Tests, actionlint, Commit**

Run: `ddev artisan test --filter=DocsTest && docker run --rm -v "$PWD:/repo:ro" -w /repo rhysd/actionlint:1.7.7 -color`
Expected: PASS, actionlint ohne Meldungen.

```bash
git add docs/.vitepress/config.ts docs/.vitepress/theme/index.ts docs/.vitepress/theme/style.css docs/package.json pnpm-lock.yaml .github/workflows/docs.yml .github/workflows/tests.yml tests/Unit/DocsTest.php
git commit -m "docs: GitHub Pages workflow, configurable base and an openbill theme with dark mode" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 10: GitHub Pages aktivieren (Quelle: GitHub Actions)**

Run: `gh api repos/baeroe/openbill/pages 2>&1 | head -3`
Expected: `Not Found (HTTP 404)` (noch nicht aktiv). Dann:

Run: `gh api -X POST repos/baeroe/openbill/pages -f build_type=workflow --jq '{build_type, html_url}'`
Expected: `{"build_type":"workflow","html_url":"https://baeroe.github.io/openbill/"}`. Antwortet die API mit 409 (schon vorhanden), stattdessen `gh api -X PUT repos/baeroe/openbill/pages -f build_type=workflow` und danach erneut `gh api repos/baeroe/openbill/pages --jq '{build_type, html_url}'`.
Der erste Deploy läuft erst nach dem Merge auf `main` (`docs.yml` reagiert nur dort; die Umgebung `github-pages` lässt nur `main` zu). Das ist erwartet und gehört in die PR-Beschreibung.

---

### Task 10: Doku-Screenshots reproduzierbar per Playwright

**Files:**
- Create: `e2e/tests/docs-screenshots.spec.ts`
- Modify: `e2e/playwright.config.ts`
- Modify: `e2e/package.json` (Skript `docs:screenshots`)
- Create: `docs/public/screenshots/en/*.png`, `docs/public/screenshots/de/*.png` (erzeugt, eingecheckt)
- Test: `tests/Unit/DocsTest.php`

**Interfaces:**
- Consumes: `AUTH_FILE`, `apiGet`, `apiPost`, `apiDelete` aus `e2e/tests/helpers.ts`; `DemoSeeder`/`E2eUserSeeder` über `e2e/global-setup.ts`; UI-Stand nach Task 1–4.
- Produces: je Sprache genau diese 13 Dateien: `login.png`, `overview.png`, `documents.png`, `editor.png`, `editor-dark.png`, `customer.png`, `templates.png`, `template-editor.png`, `toolkit.png`, `fields.png`, `settings-organization.png`, `settings-api.png`, `einvoice.png` (Task 11 bindet sie ein, Task 12 nimmt `en/editor.png` ins README).

- [ ] **Step 1: Failing test**

In `tests/Unit/DocsTest.php` anhängen:

```php
it('has the same documentation screenshots in English and German, the editor among them', function () {
    $root = dirname(__DIR__, 2);
    $shots = fn (string $locale): array => array_map('basename', glob("{$root}/docs/public/screenshots/{$locale}/*.png") ?: []);

    expect($shots('en'))->toContain('editor.png', 'editor-dark.png')
        ->toEqualCanonicalizing($shots('de'));
});
```

Run: `ddev artisan test --filter=DocsTest`
Expected: FAIL (Ordner leer).

- [ ] **Step 2: Playwright-Projekt**

In `e2e/playwright.config.ts`:
- Kopfkommentar um eine Zeile ergänzen: `// Screenshots for the docs (docs/public/screenshots, committed): pnpm --dir e2e docs:screenshots`
- Im `chromium`-Projekt bleibt `testIgnore: /screenshots\.spec\.ts/` (trifft beide Screenshot-Specs).
- Den Review-Eintrag ersetzen und das neue Projekt anhängen:

```ts
        // review screenshots against the clickdummy (pnpm screenshots): only when asked for
        ...(process.env.SCREENSHOTS ? [{ name: 'screenshots', testMatch: /\/screenshots\.spec\.ts$/, use: { ...devices['Desktop Chrome'] } }] : []),
        // screenshots for the docs (pnpm docs:screenshots): signed in like the suite, 1440×900, device scale 1
        ...(process.env.DOCS_SCREENSHOTS
            ? [
                  {
                      name: 'docs-screenshots',
                      testMatch: /docs-screenshots\.spec\.ts$/,
                      dependencies: ['setup'],
                      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, storageState: AUTH_FILE },
                  },
              ]
            : []),
```

`e2e/package.json`, `scripts` ergänzen: `"docs:screenshots": "DOCS_SCREENSHOTS=1 playwright test --project=docs-screenshots"`

- [ ] **Step 3: Labels prüfen, die das Skript braucht**

Run: `grep -n '"templates.view_named"\|"editor.e_invoice"\|"toolkit.button"' lang/en.json lang/de.json`
Expected: en `View :name`, `E-invoice`, `Toolkit`; de `:name ansehen`, `E-Rechnung`, `Toolkit`. Weicht etwas ab, die Werte in Step 4 anpassen.

- [ ] **Step 4: Spec schreiben**

`e2e/tests/docs-screenshots.spec.ts`:

```ts
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { apiDelete, apiGet, apiPost } from './helpers';

/**
 * Screenshots of the documentation, committed under docs/public/screenshots/{en,de}/<name>.png: the demo data of
 * DemoSeeder (global-setup seeds it before the run), 1440×900, light; shots with `dark` also as <name>-dark.png.
 * English pages show the English UI, German pages the German one. Run: pnpm --dir e2e docs:screenshots – then look at
 * every image before committing. Fictional data only (DemoSeeder, E2eUserSeeder).
 */
const OUT = path.resolve(import.meta.dirname, '../../docs/public/screenshots');
const LOCALES = ['en', 'de'] as const;
type Locale = (typeof LOCALES)[number];
type Theme = 'light' | 'dark';
type Shot = { name: string; dark?: boolean; open(page: Page, locale: Locale): Promise<void> };

const go = (page: Page, locale: Locale, to: string) => page.goto(to === '/' ? `/${locale}` : `/${locale}${to}`);

/** The draft invoice of Hafenkontor Lindqvist: groups, custom fields, live preview. */
async function openEditor(page: Page, locale: Locale): Promise<void> {
    await go(page, locale, '/documents');
    await page.getByRole('link', { name: /Hafenkontor Lindqvist GmbH/ }).first().click();
    await page.waitForURL(/\/documents\/[^/?]+$/);
    await page.locator('.pp-page').first().waitFor();
}

const SHOTS: Shot[] = [
    { name: 'overview', open: (page, locale) => go(page, locale, '/') },
    { name: 'documents', open: (page, locale) => go(page, locale, '/documents') },
    { name: 'editor', dark: true, open: openEditor },
    {
        name: 'customer',
        open: async (page, locale) => {
            await go(page, locale, '/customers');
            await page.getByRole('link', { name: /Hafenkontor Lindqvist GmbH/ }).first().click();
            await page.waitForURL(/\/customers\/[^/]+$/);
            await page.locator('input[value="Hafenkontor Lindqvist GmbH"]').waitFor();
        },
    },
    { name: 'templates', open: (page, locale) => go(page, locale, '/templates') },
    {
        name: 'template-editor',
        open: async (page, locale) => {
            await go(page, locale, '/templates');
            await page.getByRole('link', { name: locale === 'de' ? 'Klar ansehen' : 'View Klar' }).first().click();
            await page.waitForURL(/\/templates\/[^/]+$/);
            await page.locator('.pp-page').first().waitFor();
        },
    },
    { name: 'fields', open: (page, locale) => go(page, locale, '/fields?scope=document') },
    { name: 'settings-organization', open: (page, locale) => go(page, locale, '/settings/organization') },
    { name: 'settings-api', open: (page, locale) => go(page, locale, '/settings/api') },
    {
        // a finalized EN 16931 invoice (Fjord Analytics, reverse charge) with its archived XML
        name: 'einvoice',
        open: async (page, locale) => {
            await go(page, locale, '/documents?q=0040');
            await page.getByRole('link', { name: /RE-\d{4}-0040/ }).first().click();
            await page.waitForURL(/\/documents\/[^/?]+$/);
            await page.getByRole('tab', { name: locale === 'de' ? 'E-Rechnung' : 'E-invoice' }).click();
            await page.getByText(/CrossIndustryInvoice/).first().waitFor();
        },
    },
];

async function capture(page: Page, file: string): Promise<void> {
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: file, animations: 'disabled', caret: 'hide' });
}

const fileOf = (locale: Locale, name: string, theme: Theme) => path.join(OUT, locale, theme === 'light' ? `${name}.png` : `${name}-dark.png`);

for (const locale of LOCALES) {
    test.describe(locale, () => {
        test.beforeAll(() => mkdirSync(path.join(OUT, locale), { recursive: true }));

        test('login', async ({ browser, baseURL }) => {
            // signed out: a context without the stored session
            const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, ignoreHTTPSErrors: true, colorScheme: 'light' });
            const page = await context.newPage();
            await page.addInitScript(() => window.localStorage.setItem('openbill:theme', 'light'));
            await page.goto(`/${locale}/login`);
            await capture(page, fileOf(locale, 'login', 'light'));
            await context.close();
        });

        for (const shot of SHOTS) {
            test(shot.name, async ({ page }) => {
                for (const theme of (shot.dark ? ['light', 'dark'] : ['light']) as Theme[]) {
                    await page.emulateMedia({ colorScheme: theme });
                    // init scripts add up: the last one sets the theme before the next page load
                    await page.addInitScript((value) => window.localStorage.setItem('openbill:theme', value), theme);
                    await shot.open(page, locale);
                    await capture(page, fileOf(locale, shot.name, theme));
                }
            });
        }

        test('toolkit', async ({ page }) => {
            await page.addInitScript(() => window.localStorage.setItem('openbill:theme', 'light'));
            await go(page, locale, '/templates');
            const templates = (await apiGet(page, '/api/templates')) as { id: string; slug: string }[];
            const klar = templates.find((template) => template.slug === 'klar')!;
            // built-in templates have no toolkit: a copy, removed again afterwards
            const copy = (await apiPost(page, `/api/templates/${klar.id}/duplicate`)) as { id: string };
            try {
                await go(page, locale, `/templates/${copy.id}`);
                await page.locator('.pp-page').first().waitFor();
                await page.getByRole('button', { name: 'Toolkit', exact: true }).click();
                await expect(page.getByRole('dialog')).toContainText('pnpm run pack');
                await capture(page, fileOf(locale, 'toolkit', 'light'));
            } finally {
                await apiDelete(page, `/api/templates/${copy.id}`);
            }
        });
    });
}
```

- [ ] **Step 5: Screenshots erzeugen**

Voraussetzungen (Mac): `ddev start`, `ddev exec pnpm build` (App + Kit; kein laufendes `pnpm dev`, sonst `rm public/hot` nach dem Beenden), `pnpm --dir e2e install`.
Run: `pnpm --dir e2e docs:screenshots`
Expected: `setup` + 2 × 12 Tests PASS (login, 10 Seiten, toolkit je Sprache). Bei 429 auf dem Login eine Minute warten (Throttle) und erneut starten.

Run: `ls docs/public/screenshots/en docs/public/screenshots/de && du -sh docs/public/screenshots`
Expected: je 13 PNGs mit den Namen aus „Produces“; zusammen grob 3–8 MB.

- [ ] **Step 6: Jedes Bild ansehen**

Alle 26 PNGs mit dem Read-Tool öffnen (`docs/public/screenshots/en/editor.png` usw.). Prüfen:
- englische Bilder zeigen englische UI, deutsche die deutsche (Navigation, Buttons);
- nur Demo-Daten (Studio Nordlicht, Hafenkontor Lindqvist, Fjord Analytics, Hotel Alpenglück, Kulturwerk Elbinsel, Nutzer „Erik Ende“, `@example.com`); keine echten Namen, Hosts außer `openbill.ddev.site` nicht sichtbar (Browser-Chrome ist nicht im Bild);
- keine Skeletons, Spinner, Toasts oder halb geladenen Vorschauen; `editor-dark.png` ist dunkel, alle anderen hell;
- `einvoice.png` zeigt den Tab E-Rechnung mit XML, `toolkit.png` den Dialog.
Ist ein Bild unbrauchbar, die Warte-Bedingung des Shots verschärfen (z. B. auf einen bestimmten Text warten), neu erzeugen, erneut ansehen.

- [ ] **Step 7: Tests und Commit**

Run: `ddev artisan test --filter=DocsTest`
Expected: PASS.

```bash
git add e2e/tests/docs-screenshots.spec.ts e2e/playwright.config.ts e2e/package.json docs/public/screenshots tests/Unit/DocsTest.php
git commit -m "docs: reproducible screenshots of the demo data for the docs (en, de)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Landingpages, Screenshots in der Doku, Durchsicht aller Seiten, Upgrade-Notiz 0.1.0

**Files:**
- Modify: `docs/en/index.md`, `docs/de/index.md` (vollständig neu)
- Modify: `docs/en/{setup,documents,custom-fields,templates,template-toolkit,e-invoice,settings,api,upgrading}.md` und dieselben Dateien in `docs/de/`
- Test: `tests/Unit/DocsTest.php`

**Interfaces:**
- Consumes: Screenshots aus Task 10, Klasse `.showcase` aus Task 9.
- Produces: Doku-Stand für v0.1.0; Abschnitt `### 0.1.0` in `docs/{en,de}/upgrading.md` (von `scripts/release-notes.sh` gelesen).

- [ ] **Step 1: Failing tests (Synchronität, Links, Screenshots, Landingpages)**

In `tests/Unit/DocsTest.php` oben unter dem `use`-Import eine Hilfsfunktion und am Ende die Tests:

```php
/** Page text without fenced code blocks (comments in code are no headings). */
function docsProse(string $file): string
{
    return (string) preg_replace('/^```.*?^```/ms', '', (string) file_get_contents($file));
}
```

```php
it('keeps English and German pages in step: same headings per level, links only within their language to pages that exist', function () {
    $root = dirname(__DIR__, 2);
    $levels = fn (string $file): array => array_map(fn (string $line): int => strspn($line, '#'), array_values(preg_grep('/^#{1,6} /m', explode("\n", docsProse($file))) ?: []));
    // on purpose: the MCP resource openbill://docs/liquid-reference is the English templates page
    $crossLanguage = ['de/mcp.md -> /en/templates'];

    foreach (glob("{$root}/docs/en/*.md") ?: [] as $en) {
        $name = basename($en);
        expect($levels("{$root}/docs/de/{$name}"))->toBe($levels($en), "headings of {$name}");

        foreach (['en' => $en, 'de' => "{$root}/docs/de/{$name}"] as $locale => $file) {
            preg_match_all('#(?:\]\(|link: )/(en|de)/([a-z0-9-]*)#', docsProse($file), $links, PREG_SET_ORDER);
            foreach ($links as [, $language, $page]) {
                $link = "{$locale}/{$name} -> /{$language}/{$page}";
                expect($language === $locale || in_array($link, $crossLanguage, true))->toBeTrue($link)
                    ->and(is_file("{$root}/docs/{$language}/".($page === '' ? 'index' : $page).'.md'))->toBeTrue($link);
            }
        }
    }
});

it('shows only screenshots that exist, in the language of the page', function () {
    $root = dirname(__DIR__, 2);
    $count = 0;
    foreach (['en', 'de'] as $locale) {
        foreach (glob("{$root}/docs/{$locale}/*.md") ?: [] as $file) {
            preg_match_all('#/screenshots/([a-z]{2})/([a-z0-9-]+\.png)#', (string) file_get_contents($file), $shots, PREG_SET_ORDER);
            foreach ($shots as [, $language, $image]) {
                $count++;
                expect($language)->toBe($locale, basename($file))
                    ->and(is_file("{$root}/docs/public/screenshots/{$language}/{$image}"))->toBeTrue("{$language}/{$image}");
            }
        }
    }
    expect($count)->toBeGreaterThanOrEqual(2 * 12);
});

it('names the core features on both landing pages and says no more that the docs are work in progress', function () {
    $root = dirname(__DIR__, 2);

    expect((string) file_get_contents("{$root}/docs/en/index.md"))
        ->toContain('Your own fields', 'groups', 'Liquid', 'toolkit', 'EN 16931', 'REST API', 'MCP', 'Docker', '/screenshots/en/editor.png')
        ->not->toContain('Work in progress')
        ->and((string) file_get_contents("{$root}/docs/de/index.md"))
        ->toContain('Eigene Felder', 'Gruppen', 'Liquid', 'Toolkit', 'EN 16931', 'REST-API', 'MCP', 'Docker', '/screenshots/de/editor.png')
        ->not->toContain('In Arbeit');
});
```

Run: `ddev artisan test --filter=DocsTest`
Expected: FAIL (Landingpages alt, keine Screenshots eingebunden; ggf. weitere Abweichungen bei Überschriften/Links – die werden in Step 5 behoben).

- [ ] **Step 2: Landingpage Englisch**

`docs/en/index.md` vollständig:

````markdown
---
layout: home

hero:
  name: openbill
  text: Quotes and invoices the way you need them.
  tagline: Open source and self-hosted. Your own fields on every level, line items in groups, PDF templates in Liquid and EN 16931 e-invoices – in the browser, over a REST API and for AI agents over MCP.
  actions:
    - theme: brand
      text: Get started
      link: /en/setup
    - theme: alt
      text: Documents & editor
      link: /en/documents
    - theme: alt
      text: GitHub
      link: https://github.com/baeroe/openbill

features:
  - title: Your own fields
    details: Add fields to the organization, customers, contacts, documents and line items – text, number, amount, date, selection, yes/no or image. They show up in the forms, the API and your templates.
    link: /en/custom-fields
    linkText: Custom fields
  - title: Line items in groups
    details: Organize positions in groups with subtotals, move them with mouse or keyboard, and offer optional services in quotes. openbill suggests positions from earlier documents.
    link: /en/documents
    linkText: Documents
  - title: Liquid templates with a toolkit
    details: Templates are HTML, CSS and Liquid, rendered to PDF on the server. Edit them in the browser, or download the toolkit and work in your own editor with a live preview.
    link: /en/templates
    linkText: Templates
  - title: E-invoices built in
    details: Invoices and cancellations can follow EN 16931 and are archived as PDF/A-3 with embedded XML (ZUGFeRD/Factur-X). Missing details show up before you finalize.
    link: /en/e-invoice
    linkText: E-invoices
  - title: REST API and MCP
    details: Everything the UI does works through a REST API with scoped tokens and an MCP server, so agents can draft, check and finalize documents for you.
    link: /en/mcp
    linkText: MCP
  - title: Self-hosted with Docker
    details: One Compose stack with MariaDB and Gotenberg, images for amd64 and arm64. Your data stays on your server.
    link: /en/setup
    linkText: Setup
---

<div class="showcase">

![The document editor: a draft invoice with groups of positions, custom fields, the compliance check and the live preview](/screenshots/en/editor.png)

</div>
````

- [ ] **Step 3: Landingpage Deutsch**

`docs/de/index.md` vollständig:

````markdown
---
layout: home

hero:
  name: openbill
  text: Angebote und Rechnungen, wie du sie brauchst.
  tagline: Open Source und selbst gehostet. Eigene Felder auf jeder Ebene, Positionen in Gruppen, PDF-Templates in Liquid und E-Rechnungen nach EN 16931 – im Browser, über eine REST-API und für KI-Agenten über MCP.
  actions:
    - theme: brand
      text: Loslegen
      link: /de/setup
    - theme: alt
      text: Dokumente & Editor
      link: /de/documents
    - theme: alt
      text: GitHub
      link: https://github.com/baeroe/openbill

features:
  - title: Eigene Felder
    details: Felder für Organisation, Kunden, Ansprechpartner, Dokumente und Positionen – Text, Zahl, Betrag, Datum, Auswahl, Ja/Nein oder Bild. Sie erscheinen in den Formularen, in der API und in deinen Templates.
    link: /de/custom-fields
    linkText: Eigene Felder
  - title: Positionen in Gruppen
    details: Positionen in Gruppen mit Zwischensummen ordnen, mit Maus oder Tastatur verschieben und in Angeboten optionale Leistungen anbieten. openbill schlägt Positionen aus früheren Dokumenten vor.
    link: /de/documents
    linkText: Dokumente
  - title: Liquid-Templates mit Toolkit
    details: Templates sind HTML, CSS und Liquid und werden auf dem Server zu PDF. Bearbeite sie im Browser oder lade das Toolkit herunter und arbeite in deinem eigenen Editor mit Live-Vorschau.
    link: /de/templates
    linkText: Templates
  - title: E-Rechnung eingebaut
    details: Rechnungen und Stornos können EN 16931 erfüllen und werden als PDF/A-3 mit eingebetteter XML (ZUGFeRD/Factur-X) archiviert. Fehlende Angaben siehst du vor dem Abschließen.
    link: /de/e-invoice
    linkText: E-Rechnung
  - title: REST-API und MCP
    details: Alles, was die Oberfläche kann, geht auch über eine REST-API mit eingeschränkten Tokens und einen MCP-Server – Agenten entwerfen, prüfen und schließen Dokumente für dich ab.
    link: /de/mcp
    linkText: MCP
  - title: Selbst gehostet mit Docker
    details: Ein Compose-Stack mit MariaDB und Gotenberg, Images für amd64 und arm64. Deine Daten bleiben auf deinem Server.
    link: /de/setup
    linkText: Einrichtung
---

<div class="showcase">

![Der Dokument-Editor: ein Rechnungsentwurf mit Positionsgruppen, eigenen Feldern, der Prüfanzeige und der Live-Vorschau](/screenshots/de/editor.png)

</div>
````

- [ ] **Step 4: Screenshots in die Seiten einbinden**

Jeweils als eigener Absatz (Leerzeile davor und danach) direkt **unter** der genannten Überschrift, vor dem ersten Absatz. Englisch / Deutsch:

| Seite | Überschrift en / de | Bild en | Alt-Text en | Bild de | Alt-Text de |
|---|---|---|---|---|---|
| `setup.md` | `## Start` / `## Starten` | `/screenshots/en/login.png` | The login of a fresh instance | `/screenshots/de/login.png` | Die Anmeldung einer frischen Instanz |
| `documents.md` | `### Overview` / `### Übersicht` | `…/en/overview.png` | The overview with open amounts, what needs attention and recently edited documents | `…/de/overview.png` | Die Übersicht mit offenen Beträgen, was Aufmerksamkeit braucht, und zuletzt bearbeiteten Dokumenten |
| `documents.md` | `### Document list` / `### Dokumentliste` | `…/en/documents.png` | The document list, filtered by type, status, customer and date | `…/de/documents.png` | Die Dokumentliste mit Filtern nach Art, Status, Kunde und Datum |
| `documents.md` | `### Document editor` / `### Dokument-Editor` | `…/en/editor.png` | The editor of a draft invoice with position groups and the live preview | `…/de/editor.png` | Der Editor eines Rechnungsentwurfs mit Positionsgruppen und Live-Vorschau |
| `documents.md` | `### Customers` / `### Kunden` | `…/en/customer.png` | A customer with contacts and custom fields | `…/de/customer.png` | Ein Kunde mit Ansprechpartnern und eigenen Feldern |
| `documents.md` | `### Appearance and language` / `### Darstellung und Sprache` | `…/en/editor-dark.png` | The editor in dark mode | `…/de/editor-dark.png` | Der Editor im dunklen Modus |
| `custom-fields.md` | `## Adding and editing` / `## Anlegen und bearbeiten` | `…/en/fields.png` | Custom fields of documents | `…/de/fields.png` | Eigene Felder der Dokumente |
| `templates.md` | `## Built-in templates` / `## Mitgelieferte Templates` | `…/en/templates.png` | The template gallery with Klar, Kante and Leise | `…/de/templates.png` | Die Template-Galerie mit Klar, Kante und Leise |
| `templates.md` | `## Template editor` / `## Template-Editor` | `…/en/template-editor.png` | The template editor: code on the left, preview on the right | `…/de/template-editor.png` | Der Template-Editor: Code links, Vorschau rechts |
| `template-toolkit.md` | `## Download` / `## Herunterladen` | `…/en/toolkit.png` | The toolkit dialog of a template | `…/de/toolkit.png` | Der Toolkit-Dialog eines Templates |
| `e-invoice.md` | `## Downloads` / `## Downloads` | `…/en/einvoice.png` | The archived XML of a finalized invoice in the editor | `…/de/einvoice.png` | Die archivierte XML einer abgeschlossenen Rechnung im Editor |
| `settings.md` | `## Organization` / `## Organisation` | `…/en/settings-organization.png` | Organization settings | `…/de/settings-organization.png` | Einstellungen der Organisation |
| `settings.md` | `## API & MCP` / `## API & MCP` | `…/en/settings-api.png` | API tokens and the MCP setup | `…/de/settings-api.png` | API-Tokens und die MCP-Einrichtung |

Form (Beispiel `docs/en/documents.md` unter `### Document editor`):

```markdown
![The editor of a draft invoice with position groups and the live preview](/screenshots/en/editor.png)
```

`…` steht in der Tabelle nur für `/screenshots` – im Markdown immer den vollen Pfad schreiben. Im Absatz unter `### Appearance and language`/`### Darstellung und Sprache` nach dem Bild nichts weiter ändern.

- [ ] **Step 5: Durchsicht aller Seiten**

a) **Veraltetes finden:**
Run: `grep -n -i -E 'phase|work in progress|in arbeit|planned|geplant|not yet|noch nicht|todo|tbd' docs/en/*.md docs/de/*.md`
Bekannte Treffer und Behandlung:
- `api.md`: `Additional endpoints (phase 7):` → `Additional endpoints:`; de `Zusätzliche Endpunkte (Phase 7):` → `Zusätzliche Endpunkte:`.
- `e-invoice.md`: „Not supported yet: XRechnung with Leitweg-ID …“ / „Noch nicht unterstützt …“ bleibt (stimmt, Spec 13).
- Alle anderen Treffer einzeln am Code prüfen und korrigieren oder begründet stehen lassen.

b) **Vollständigkeit gegen Spec 1/11:** Für jede Seite der Spec-Liste (`index`, `setup`, `reverse-proxy`, `backup`, `upgrading`, `documents`, `custom-fields`, `templates` inkl. Liquid-Referenz, `template-toolkit`, `e-invoice`, `api`, `mcp`; dazu `settings`, `development`) in beiden Sprachen lesen und gegen den Code prüfen. Mindestens:
- `mcp.md` nennt alle 25 Tools (`ddev artisan test --filter=McpServerTest` grün);
- `api.md` nennt die Filter `date_from`/`date_to` von `GET /api/documents` (`grep -n date_from docs/en/api.md docs/de/api.md`; fehlt es, in der Tabelle/Liste der Dokument-Filter ergänzen: en `date_from`, `date_to` (document date, `YYYY-MM-DD`, inclusive)`, de `date_from`, `date_to` (Dokumentdatum, `YYYY-MM-DD`, einschließlich)`);
- `setup.md`/`backup.md` nennen `app:prune-images` nicht zwingend, aber `backup.md` sagt, dass gelöschte Bilder nicht wiederkommen: am Ende der Aufzählung unter dem letzten Abschnitt ergänzen en `- `app:prune-images` deletes images for good – run it after a backup.`, de `- `app:prune-images` löscht Bilder endgültig – nach einer Sicherung ausführen.`;
- alle Änderungen aus Task 1–8 stehen in beiden Sprachen.

c) **Synchronität:** `wc -l docs/en/*.md docs/de/*.md` – Unterschiede > 3 Zeilen je Datei ansehen (bekannt: `template-toolkit.md` 96 vs. 98 Zeilen; Absatz für Absatz vergleichen und angleichen, sodass beide Fassungen dasselbe sagen).

d) **Sidebar:** `docs/.vitepress/config.ts` – jede Seite außer `index` steht in `hosting` oder `pages`, Titel in `en`/`de` vorhanden (DocsTest prüft das).

e) **Tests:**
Run: `ddev artisan test --filter='DocsTest|McpServerTest|ReleaseNotesTest'`
Expected: PASS. Meldet der Überschriften-Test eine Abweichung, die Überschriften der deutschen bzw. englischen Fassung angleichen (gleiche Ebenen in gleicher Reihenfolge); meldet der Link-Test einen Link in die falsche Sprache oder auf eine fehlende Seite, korrigieren.

- [ ] **Step 6: Upgrade-Notiz 0.1.0 fertigstellen**

`docs/en/upgrading.md`, alles nach `### 0.1.0` bis zum Dateiende ersetzen:

```markdown
### 0.1.0

- First release: quotes, order confirmations, invoices and cancellations with custom fields on every level, line items in groups, Liquid templates (Klar, Kante, Leise and your own, with the template toolkit), EN 16931 e-invoices as PDF/A-3 with embedded XML, a REST API and an MCP server, in English and German.
- Image `baeroe/openbill:0.1.0` for `linux/amd64` and `linux/arm64`. Runs as Docker Compose stack with MariaDB 11.4 and Gotenberg 8, see [Setup](https://github.com/baeroe/openbill/blob/main/docs/en/setup.md).
- Documentation: https://baeroe.github.io/openbill/
```

`docs/de/upgrading.md`:

```markdown
### 0.1.0

- Erstes Release: Angebote, Auftragsbestätigungen, Rechnungen und Stornos mit eigenen Feldern auf jeder Ebene, Positionen in Gruppen, Liquid-Templates (Klar, Kante, Leise und eigene, mit dem Template-Toolkit), E-Rechnungen nach EN 16931 als PDF/A-3 mit eingebetteter XML, REST-API und MCP-Server, auf Englisch und Deutsch.
- Image `baeroe/openbill:0.1.0` für `linux/amd64` und `linux/arm64`. Läuft als Docker-Compose-Stack mit MariaDB 11.4 und Gotenberg 8, siehe [Einrichtung](https://github.com/baeroe/openbill/blob/main/docs/de/setup.md).
- Dokumentation: https://baeroe.github.io/openbill/de/
```

Run: `scripts/release-notes.sh 0.1.0 && ddev artisan test --filter=ReleaseNotesTest`
Expected: die drei englischen Zeilen, beginnend mit `- First release`; Test PASS.

- [ ] **Step 7: Doku bauen und ansehen, `llms.txt` prüfen**

Run: `ddev exec pnpm --dir docs build >/dev/null && cat docs/.vitepress/dist/llms.txt && ls docs/.vitepress/dist/screenshots/en | wc -l`
Expected: `llms.txt` mit Titel `openbill`, der neuen Tagline und allen 13 englischen Seiten (Backup, Custom fields, Development, Documents, E-invoices, MCP, REST API, Reverse proxy, Settings, Setup, Template toolkit, Templates, Upgrading); `13` Screenshots im Build.

Run: `ddev exec pnpm --dir docs dev` und im Browser `https://openbill.ddev.site:5174/en/` sowie `/de/` öffnen.
Expected: Landingpage mit sechs Kacheln und dem Editor-Screenshot, Dunkelmodus-Schalter funktioniert (Kacheln/Screenshot lesbar), die Seiten zeigen ihre Screenshots. Dev-Server danach beenden.

- [ ] **Step 8: Commit**

```bash
git add docs/en docs/de tests/Unit/DocsTest.php
git commit -m "docs: landing pages, screenshots on every page, review of all pages, notes for 0.1.0" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: README, Repo-Metadaten, Projektgedächtnis, `CLAUDE.md` final

**Files:**
- Modify: `README.md` (vollständig neu)
- Create: `docs/history/2026-10-12 Ausprojektierung openbill.md` (Datum = Umsetzungstag, siehe Step 3)
- Modify: `CLAUDE.md`
- Modify: `.github/workflows/dockerhub.yml` (Kurzbeschreibung)

**Interfaces:**
- Consumes: `docs/public/screenshots/en/editor.png` (Task 10), Doku-Adresse (Task 9).
- Produces: GitHub-About, Website, Topics.

- [ ] **Step 1: README**

`README.md` vollständig:

````markdown
# openbill

[![Tests](https://github.com/baeroe/openbill/actions/workflows/tests.yml/badge.svg)](https://github.com/baeroe/openbill/actions/workflows/tests.yml)
[![Docker Hub](https://img.shields.io/docker/v/baeroe/openbill?sort=semver&label=docker%20hub)](https://hub.docker.com/r/baeroe/openbill)

Open, self-hosted quotes, order confirmations, invoices and cancellations. Your own fields on every level, line items in groups, PDF templates in Liquid and EN 16931 e-invoices (ZUGFeRD/Factur-X) – in the browser, over a REST API and for AI agents over MCP.

**Docs: [baeroe.github.io/openbill](https://baeroe.github.io/openbill/)** (English and German)

![The document editor: a draft invoice with groups of positions, custom fields, the compliance check and the live preview](docs/public/screenshots/en/editor.png)

## Features

- Quotes, order confirmations, invoices and cancellations, converted along the chain with one click; numbers are assigned when you finalize
- Custom fields on the organization, customers, contacts, documents and line items
- Line items in groups with subtotals, optional items in quotes, suggestions from earlier documents
- Templates in HTML, CSS and Liquid, rendered to PDF by Gotenberg: three built in, a toolkit with live preview for your own
- E-invoices after EN 16931 as PDF/A-3 with embedded XML; VAT for regular taxation, small businesses (§ 19 UStG), EU reverse charge and third countries
- REST API (OpenAPI) and an MCP server with scoped tokens
- English and German, light and dark

## Quickstart

You need Docker with Compose v2.

```bash
mkdir openbill && cd openbill
curl -fsSLO https://raw.githubusercontent.com/baeroe/openbill/main/docker-compose.yml
curl -fsSL -o .env https://raw.githubusercontent.com/baeroe/openbill/main/.env.docker.example
# edit .env: APP_URL, ADMIN_EMAIL and the passwords ADMIN_PASSWORD, DB_PASSWORD, DB_ROOT_PASSWORD
# (empty in the template: docker compose refuses to start until they are set)
docker compose up -d                              # start
docker compose pull && docker compose up -d       # update
```

openbill listens on `127.0.0.1:7739`. Put a reverse proxy with HTTPS in front, set `APP_URL` to its address and log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

- [Setup](https://baeroe.github.io/openbill/en/setup) and [Reverse proxy](https://baeroe.github.io/openbill/en/reverse-proxy)
- [Backup](https://baeroe.github.io/openbill/en/backup) and [Upgrading](https://baeroe.github.io/openbill/en/upgrading)
- [Templates](https://baeroe.github.io/openbill/en/templates), [E-invoices](https://baeroe.github.io/openbill/en/e-invoice), [REST API](https://baeroe.github.io/openbill/en/api), [MCP](https://baeroe.github.io/openbill/en/mcp)

Images: `baeroe/openbill` on Docker Hub for `linux/amd64` and `linux/arm64`, tagged `X.Y.Z`, `X.Y` and `latest`.

## Development

Local development runs in [DDEV](https://ddev.com) (PHP 8.4, MariaDB 11.4, Node 24 with pnpm, Gotenberg); the guide is [Development](https://baeroe.github.io/openbill/en/development). The docs live in [`docs/`](docs) (VitePress): `ddev exec pnpm --dir docs dev`.

The clickable prototypes in [`prototypes/`](prototypes) (`clickdummy` and `clickdummy-v2` with its `DESIGN.md`) are the design reference the app was built from; they are not part of the app.

## Release

A tag `vX.Y.Z` builds the image for amd64 and arm64, pushes it to Docker Hub and creates a GitHub release with the notes from [`docs/en/upgrading.md`](docs/en/upgrading.md).

## License

[MIT](LICENSE)
````

Run: `test -f docs/public/screenshots/en/editor.png && echo ok`
Expected: `ok`.

- [ ] **Step 2: Docker-Hub-Kurzbeschreibung angleichen**

`.github/workflows/dockerhub.yml`: `short-description:` auf `Self-hosted quotes and invoices with custom fields, Liquid templates, EN 16931 e-invoices, REST API and MCP.` setzen (≤ 100 Zeichen; prüfen: `printf %s '…' | wc -c`).

- [ ] **Step 3: Projektgedächtnis**

Datum bestimmen: `date +%F` → `<DATUM>` (Plan-Annahme: `2026-10-12`). Datei `docs/history/<DATUM> Ausprojektierung openbill.md` anlegen (Frontmatter `datum` gleich), Inhalt:

```markdown
---
tags: [session, projekt]
datum: 2026-10-12
---
# 2026-10-12 – Ausprojektierung openbill (Phasen 1–11)

Vom Klickdummy zur releasefähigen App in elf Phasen, je Phase ein PR (#2–#12). Spec: `docs/superpowers/specs/2026-10-11-openbill-app-design.md`, Master-Plan und Phasenpläne: `docs/superpowers/plans/`. Diese Notiz hält fest, was in keinem Plan steht: welche Entscheidungen unterwegs fielen, warum, und woran wir hängen geblieben sind.

## Kontext
openbill soll wie prevju laufen: ein Image auf Docker Hub, `docker compose up -d`, Doku auf GitHub Pages, Agenten über REST und MCP, Template-Autoren mit einem lokalen Toolkit. Gebaut wurde von Agenten (Planung → Umsetzung → Review → Fix-Runden je Phase), der Nutzer gibt das Release v0.1.0 selbst frei.

## Was wurde gemacht
- **Phase 1 Fundament** (`33780ea`): Laravel 13 + Inertia/React/TS, Tailwind 4, Pest/Pint/Larastan, pnpm-Workspace, DDEV mit Gotenberg, i18n en/de, Login, Rollen, VitePress-Gerüst.
- **Phase 2 Domain** (`3d149d3`): Migrationen, Models mit ULID und Sperre, Domain-Services (Summen, Steuern, Nummern, Status, Felder, Prüfprofile), Actions, Demo-Seeder.
- **Phase 3 Rendering** (`cfcf18a`): ContextBuilder, Liquid-Sandbox, Templates Klar/Kante/Leise, Gotenberg, Archiv, ZUGFeRD/EN 16931.
- **Phase 4 REST-API** (`3811358`), **Phase 5 UI-Basis** (`0ae369a`), **Phase 6 Editor** (`c105ab9`), **Phase 7 Templates/Felder/Einstellungen** (`a457068`), **Phase 8 MCP** (`4d6e710`), **Phase 9 Toolkit** (`c926863`), **Phase 10 Docker & Release** (`99952ad`).
- **Phase 11 Feinschliff**: Logout/Sitzungsablauf, Datumsfilter, `app:prune-images`, Liquid-Ganzzahlen, Trimmen, `X-Forwarded-Prefix`, Dependabot, Doku-Theme, Landingpages, Screenshots, Pages-Workflow, README.

## Entscheidungen & Warum
- **Einheit der Ausführung ist eine Phase**, PR je Phase, Admin-Merge ohne menschliches Review: Nutzerwunsch (serielle Agenten, auto-mergen). Kostet: Fehler fallen erst auf Phasenebene auf – deshalb ein Review-Agent mit Fix-Runden je Phase.
- **Release nicht selbst taggen**: außenwirksam, der Nutzer gibt frei.
- **JS nur im DDEV-Container, ein Root-Lockfile** (Linux-Binaries in `node_modules`); Playwright als eigenes pnpm-Projekt `e2e/` auf dem Mac.
- **Unveränderlichkeit doppelt**: Eloquent-Hooks plus MariaDB-Trigger auf Dokumenten, Positionen, Gruppen, Snapshots, Dateien und ein Arch-Test gegen `DB::table` – GoBD; Mass-Updates umgingen sonst die Hooks.
- **Snapshot statt Live-Daten**: abgeschlossene Dokumente rendern aus eingefrorenen Stammdaten inkl. Felddefinitionen und Template; Teilstorno bleibt erlaubt (Teilgutschrift).
- **Keine Floats**: brick/math überall, einzige Ausnahme `CiiAmount` für horstoeko mit Rundreise-Prüfung.
- **XML-Einbettung über Gotenberg (Factur-X, PDF/A-3b)** statt horstoekos Merger: weniger Code, verlangt Gotenberg ≥ 8.34.
- **Templates in der Sandbox, zwei Schichten**: CSP im gerenderten HTML und gehärtetes Gotenberg (kein JavaScript, Deny-List) – das Review fand SSRF über Templates. Kostet: keine Web-Fonts/Bilder per URL, nur Assets/Data-URLs.
- **Filter-Policy statt Einzelfixes**: jeder registrierte Liquid-Filter ist eingestuft (größenbegrenzt überschrieben oder nur additiv), ein Test schlägt bei neuen Filtern fehl – Einzel-Fixes liefen zweimal hinterher.
- **EN-16931-Prüfung**: Pflichtfelder im Prüfprofil (Registernummer BT-30, USt-ID bei Reverse Charge/Drittland), offizielles CEN-Schematron im CI-Job `einvoice`. **KoSIT bewusst nicht**: die KoSIT-Konfiguration prüft XRechnung (BR-DE, Leitweg-ID), die openbill nicht erzeugt.
- **REST-API mit DTO-Ressourcen**, Processor reicht den rohen Body an genau eine Action, Fehler als Problem Details. `templates:render` darf alle Dokumente gerendert lesen (Spec 7, das Toolkit rendert echte Dokumente) – in Doku und Token-Dialog als lesender Zugriff markiert.
- **Entwurfs-Download-Links** tragen einen Hash über Dokument, Gruppen und Positionen statt `updated_at` (Autosave ändert mehrmals pro Sekunde, Positionen berühren `updated_at` nicht).
- **Der Server rechnet, der Browser formatiert**: Kennzahlen als Inertia-Props, Summen aus der Render-Antwort, Listen per SWR.
- **Barrierefreiheit vor Gestaltung**: `--muted` wurde abgedunkelt, obwohl DESIGN.md heller war.
- **Editor**: Zustand-Store mit reinen Ops, lokale IDs + `reconcileIds()`, höchstens eine Autosave-Instanz je Dokument (überlebt den Editor), last-write-wins, Löschen verzögert mit Undo statt Wiederherstellen.
- **Logout leert alle Caches** (auch `$inf$`-Seiten) – fremde Daten nach einem Login im selben Tab wären ein Datenschutzproblem. Seit Phase 11: 401/419 gilt als abgemeldet, Timeout 10 s, wartende Löschungen gehen vorher raus, ungespeicherte Eingaben überleben eine abgelaufene Sitzung in `sessionStorage` (nur für dieselbe Person).
- **Benutzer werden deaktiviert, nie gelöscht**: `created_by` abgeschlossener Dokumente darf sich nicht an den Triggern vorbei ändern.
- **Kundenart und Kategorie O**: Drittland + Dienstleistung + Unternehmen → nicht steuerbar (`O`), an Privatpersonen normaler Satz (§ 3a UStG).
- **MCP nur per Token**, eine Basisklasse übersetzt Fehler für das Modell, Ausgabe = REST-Formate, 25 Tools, eigener Limiter für Vorschau-PDFs (Agenten-Schleifen sollen Gotenberg nicht fürs Abschließen blockieren).
- **Toolkit vorgebaut**: der Nutzer installiert nur Vite; der Token bleibt im Node-Prozess; `OPENBILL_URL` kommt aus `APP_URL`, nie aus der Anfrage (Host-Header-Injection).
- **Docker**: serversideup v4.5.1 statt der frischen v5, alle Images per Digest, MariaDB ohne Binlog mit `log-bin-trust-function-creators`, internes Netz für DB und Gotenberg, Port nur auf `127.0.0.1`, `TRUSTED_PROXIES` konfigurierbar, leere Passwörter in der Vorlage, Release-Notizen aus `upgrading.md` sind Pflicht.
- **Doku auf GitHub Pages** unter `/openbill/`, bis es eine Domain gibt; `base` per Umgebungsvariable, Screenshots per Playwright aus den Demo-Daten.

## Stolpersteine
- Laravels `Request::capture()` dekodiert JSON schon beim Erzeugen – ein Body-Limit danach kommt zu spät. Lösung: eigenes `IncomingRequest`, Dekodieren erst nach `LimitApiBody`.
- `TrimStrings` sieht weder API-Platform-Bodies noch MCP-Argumente: Actions trimmen selbst.
- API Platform lässt `null` weg und macht `{}` zu `[]`; sein Metadaten-Cache ist unter Laravel 13 nicht deserialisierbar (`serializable_classes`) → eigener APCu-oder-Array-Store, Wahl zur Laufzeit.
- Throttle muss vor Auth laufen, sonst zählen 401-Anfragen nie.
- laravel/mcp fängt jede Exception selbst und blättert `tools/list` nach 15 Einträgen.
- keepsuit/liquid escapt nicht von selbst, `"0.00" != 0` ist wahr, leere Strings sind wahr.
- Chromium setzt Kopf-/Fußzeile in einen Flex-Container – ohne seitenbreite Hülle schrumpft der Inhalt.
- Inertia-v3-Layouts müssen Pfeilfunktionen sein; SWRs `mutate(filter)` überspringt `useSWRInfinite`; Radix-Menüs brauchen `modal={false}`.
- Playwright läuft in den Login-Throttle: einmal anmelden, Sitzung als `storageState` teilen.
- serversideups Entrypoint läuft in einer Subshell: `APP_KEY` erreicht PHP-FPM nur über den Config-Cache.
- Je nach Docker-Setup kommen Anfragen von außen mit der Gateway-IP `172.x.0.1` an, die in den privaten Netzen liegt – deshalb Bind auf `127.0.0.1` als Standard.
- Laravel vertraut `X-Forwarded-Prefix` standardmäßig; openbill läuft nur an der Wurzel und ignoriert ihn seit Phase 11.
- `pnpm pack` ist ein eingebauter Befehl (`pnpm run pack`), Node vertraut der mkcert-CA nicht (`--use-system-ca`), DDEV/Mutagen zeigt Container-Dateien mit Verzögerung.
- Externe Schematron-/Saxon-Downloads lieferten einmal 404 → im CI gecacht, Skript prüft SHA-256.
- Closures für `Concurrency::run()` müssen `static` sein und aus einer autoloadbaren Klasse kommen.
- Browser schicken kein `blur`, wenn das fokussierte Element entfernt wird: Toasts blieben nach einem Tastatur-Undo pausiert.

## Offen
- Release v0.1.0 (Tag `v0.1.0`) nach Freigabe durch den Nutzer; danach synchronisiert `dockerhub.yml` die Docker-Hub-Beschreibung.
- Eigene Doku-Domain (dann `DOCS_BASE` weg, `DOCS_URL` und `CNAME`).
- Nicht im Umfang (Spec 13): OAuth für Connectors, XRechnung mit Leitweg-ID, E-Mail-Versand, Zahlungsabgleich, Mahnwesen, Mehrmandanten, Fremdwährungen.
```

Prüfen: `grep -n -i -E '@[a-z0-9-]+\.[a-z]{2,}|https?://' "docs/history/<DATUM> Ausprojektierung openbill.md"`
Expected: keine Treffer (keine Adressen, keine Hosts).

- [ ] **Step 4: `CLAUDE.md` final**

Folgende Stellen ändern (alt → neu):
1. Zeile 9: `Projektgedächtnis: `docs/history/` (falls vorhanden).` → `Projektgedächtnis: `docs/history/` (Entscheidungen und Stolpersteine der Ausprojektierung: `docs/history/<DATUM> Ausprojektierung openbill.md`).`
2. Zeile 13: `Wird in Phasen gebaut; Stand: Phase 10 (…).` (ganzer Satz bis zur schließenden Klammer) → `Stand: alle 11 Phasen des Master-Plans umgesetzt, v0.1.0 vorbereitet (UI mit Übersicht, Dokumenten, Kunden, Dokument-Editor, Templates mit Editor und Toolkit, eigenen Feldern und Einstellungen inkl. Benutzerverwaltung und „API & MCP“; REST-API unter `/api`; MCP-Server unter `/mcp`; Docker-Image + Compose-Stack; Doku auf GitHub Pages).`
3. Abschnitt „Kommandos“, nach der Zeile `pnpm --dir e2e screenshots …` einfügen:
   `pnpm --dir e2e docs:screenshots              # Doku-Screenshots (Demo-Daten, en/de, 1440×900) nach docs/public/screenshots/ – danach jedes Bild ansehen und committen`
   und nach `ddev exec pnpm --dir docs build`:
   `ddev exec 'DOCS_BASE=/openbill/ DOCS_URL=https://baeroe.github.io/openbill pnpm --dir docs build'   # so wie GitHub Pages (docs.yml)`
   `ddev artisan app:prune-images --dry-run      # ungenutzte Bilder (uploads/, logos/) auflisten; ohne --dry-run löschen (--min-age=24 h)`
4. „Regeln“, CI-Zeile ergänzen: `… `image` in `docker.yml` (…). `docs.yml` veröffentlicht die Doku bei Änderungen in `docs/` auf `main` nach GitHub Pages (`https://baeroe.github.io/openbill/`). Dependabot (`.github/dependabot.yml`) für Actions, Composer, pnpm – nicht für Docker-Images (Digests, `DockerSetupTest`).`
5. „Regeln“, Git-Zeile: `- Git: Branch je Phase `phase-NN-<name>`, PR gegen `main`, Conventional Commits.` → `- Git: Branch je Änderung (`feat/…`, `fix/…`, `docs/…`; die Phasen-Branches `phase-NN-*` sind abgeschlossen), PR gegen `main`, Conventional Commits. Release: Tag `vX.Y.Z` nur nach Freigabe durch den Maintainer, vorher Abschnitt `### X.Y.Z` in `docs/en/upgrading.md` und `docs/de/upgrading.md`.`
6. `## Architektur (Stand Phase 10)` → `## Architektur`
7. Routen-Zeile (86): `Filter `?type&status&customer_id&q`` → `Filter `?type&status&customer_id&q&date_from&date_to``
8. `Phase 8 gibt `build()` als MCP-Tool `get-overview` zurück` → ``build()` ist auch das MCP-Tool `get-overview``
9. `Vorschau-Schnittstelle für Phase 4/6/7/9:` → `Vorschau-Schnittstelle:`
10. `(Toolkit-Tokens entstehen in Phase 9 im Template-Editor und erscheinen …)` → `(Toolkit-Tokens entstehen im Template-Editor und erscheinen …)`
11. `Schnittstelle für Phase 7/9: Phasenplan …` → `Schnittstelle: Phasenplan …`
12. Editor-Absatz (120), Logout-Teil ersetzen: `Logout (`layouts/logout.ts`): `flushAutosaves()` und `flushPendingDeletes()` mit zusammen höchstens 3 s Wartezeit (beides läuft danach weiter), Info-Toast, dann `POST /{locale}/logout` per fetch mit 10 s Timeout; 401/419 gilt als schon abgemeldet; erst bei Erfolg `resetAutosaves()`, Store-`reset()`, `clearApiCache()` (…), `clearDrafts()` und ein voller Seitenaufruf des Login; scheitert der POST, bleibt alles aktiv und ein Fehler-Toast erscheint. Abgelaufene Sitzung: der 401-Handler (gesetzt in `acquireAutosave`) schreibt ungespeicherte Entwürfe per `stashUnsavedDrafts()` nach `sessionStorage` (`editor/unsaved-drafts.ts`, Nutzer-ID aus `setDraftOwner()`, 24 h), `showDocument` lädt sie beim nächsten Öffnen (nur Entwürfe, Toast `editor.restored_after_login`).`
13. Bilder-Zeile (126): `Uploads unter `uploads/` auf Disk `local`, nie gelöscht (Snapshots).` → `Uploads unter `uploads/` auf Disk `local`; bleiben bei Wertwechsel (Snapshots), `app:prune-images` (`PruneUnusedImages`, `App\Support\ImageReferences`: alle JSON-Werte aller Datensätze und Snapshots) löscht, worauf nichts mehr verweist und was älter als `--min-age` ist.`
14. Fallstrick (194): `- `SaveCustomer` trimmt Stammdaten selbst (`TrimStrings` sieht API-Bodies nicht).` → `- Stammdaten-Actions trimmen ihre Namensfelder selbst (`App\Support\TrimmedInput::strings()`, `SaveCustomer` mit eigener Variante für Kontakte): `TrimStrings` sieht API-Bodies und MCP-Argumente nicht.`
15. Fallstrick (205): Satz `401 zählt als `invalid`, der Login-Redirect verwirft ungespeicherte Eingaben (Phase 11: Payload in `sessionStorage` sichern und nach dem Login anbieten).` → `401 zählt als `invalid`; die Eingaben überleben den Login-Redirect in `sessionStorage` (siehe Dokument-Editor).`
16. Fallstrick (212) `- Hochgeladene Bilder und alte Logos werden nie gelöscht (Snapshots verweisen darauf); Aufräumen ungenutzter Dateien ist offen (Phase 11).` → `- Hochgeladene Bilder und alte Logos löscht nur `app:prune-images`; neue Stellen, die Bildpfade speichern, müssen in `ImageReferences::SOURCES` (sonst löscht der Befehl ihre Dateien).`
17. Abschnitt „Doku“ ergänzen: `Veröffentlicht per `.github/workflows/docs.yml` auf GitHub Pages unter `https://baeroe.github.io/openbill/`: `base` kommt aus `DOCS_BASE` (Standard `/`), `DOCS_URL` setzt die absolute Adresse für `llms.txt`/`og:image`; der CI-Schritt `Docs` baut mit beiden. Head-Einträge (Favicon) bekommen die Basis nicht automatisch; die Weiterleitung ohne Sprachpräfix im Theme nutzt `import.meta.env.BASE_URL`. Theme `docs/.vitepress/theme/style.css` mit den App-Tokens (hell/dunkel). Screenshots nur aus `pnpm --dir e2e docs:screenshots` (`docs/public/screenshots/{en,de}/`, gleiche Dateien in beiden Sprachen, englische Seiten binden `/screenshots/en/…` ein, deutsche `/screenshots/de/…`); ändert sich die UI sichtbar, neu erzeugen und im selben PR mitliefern. `DocsTest` prüft gleiche Überschriften je Ebene in en/de, Links nur innerhalb der Sprache auf existierende Seiten und dass jeder eingebundene Screenshot existiert.`
18. Fallstricke ergänzen:
    - `- `App\Http\Middleware\TrustProxies::headers()` glaubt `X-Forwarded-Prefix` nie (Laravel täte es standardmäßig): openbill läuft nur an der Wurzel seines Hosts. `TRUSTED_PROXIES` nimmt nur IPs/CIDR.`
    - `- Liquid-Rechenfilter mit zwei Ganzzahlen rechnen über `BigInteger`; jenseits von `PHP_INT_MAX` kommt ein exakter String statt eines Floats. `date` nimmt Ganzzahlen als Unix-Zeitstempel.`
    - `- Toasts pausieren über Halter (`pauseToasts('pointer'|'focus')`); wird eine Toast-Aktion benutzt, gibt `dismissToast(id, true)` den Fokus-Halter frei (Browser schicken kein `blur` für entfernte Elemente).`
    - `- Radix-Dialoge/Drawer/mobile Seitenleiste haben Exit-Animationen über `data-[state=closed]:animate-*-out` (Variante gewinnt über die Attribut-Spezifität).`

Run: `grep -n -i 'phase 1[01]\|Phase 11\|(Stand Phase' CLAUDE.md`
Expected: keine Treffer mehr außer Verweisen auf Phasenpläne als Dokumente (z. B. `phase-02-domain.md`).

- [ ] **Step 5: Repo-Metadaten**

Run:
```bash
gh repo edit baeroe/openbill \
  --description "Self-hosted quotes and invoices with custom fields, Liquid templates and EN 16931 e-invoices. REST API and MCP for agents." \
  --homepage "https://baeroe.github.io/openbill/" \
  --add-topic docker,en16931,factur-x,inertiajs,mcp,mcp-server \
  --remove-topic xrechnung && \
gh repo view baeroe/openbill --json description,homepageUrl,repositoryTopics --jq '{description, homepageUrl, topics: [.repositoryTopics[].name] | sort}'
```
Expected: die neue Beschreibung, `https://baeroe.github.io/openbill/` und die Topics `docker, e-invoice, en16931, factur-x, gotenberg, inertiajs, invoicing, laravel, liquid, mcp, mcp-server, pdf, react, self-hosted, zugferd` (ohne `xrechnung`).

- [ ] **Step 6: Tests und Commit**

Run: `ddev artisan test --filter='DocsTest|DockerSetupTest|ReleaseNotesTest'`
Expected: PASS.

```bash
git add README.md "docs/history/" CLAUDE.md .github/workflows/dockerhub.yml
git commit -m "docs: README with screenshot and docs links, project memory, final CLAUDE.md" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Verifizieren, pushen, PR, CI

**Files:**
- keine (nur Prüfung und Veröffentlichung des Branches)

**Interfaces:**
- Consumes: alles aus Tasks 1–12.
- Produces: PR gegen `main` mit grüner CI; **kein Merge, kein Tag**.

- [ ] **Step 1: Volle lokale Prüfung**

Run:
```bash
ddev exec vendor/bin/pint --test && \
ddev exec vendor/bin/phpstan analyse --memory-limit=1G && \
ddev artisan test && \
ddev exec pnpm typecheck && ddev exec pnpm test && \
ddev exec 'pnpm --filter "./packages/*" test' && \
ddev exec pnpm build >/dev/null && \
ddev exec 'DOCS_BASE=/openbill/ DOCS_URL=https://baeroe.github.io/openbill pnpm --dir docs build' >/dev/null && \
ddev exec pnpm --dir docs build >/dev/null && \
docker run --rm -v "$PWD:/repo:ro" -w /repo rhysd/actionlint:1.7.7 -color && echo ALL-GREEN
```
Expected: `ALL-GREEN`; Pest ohne Fehler (neu u. a. `PruneUnusedImagesTest` 2, `MasterDataTrimTest` 2, `DocsTest` +5, `FiltersTest` +2, `TrustedProxiesTest` +1, `DocumentPagesTest` +1, `ArchTest` +1).

Run (Mac, DDEV läuft, `rm -f public/hot`): `pnpm --dir e2e test`
Expected: ganze Playwright-Suite PASS (bei 429 eine Minute warten).

- [ ] **Step 2: Screenshots ein letztes Mal ansehen**

Alle Bilder unter `docs/public/screenshots/en/` und `docs/public/screenshots/de/` mit dem Read-Tool öffnen (Kriterien wie Task 10 Step 6). Hat sich die UI seit Task 10 sichtbar geändert (Task 11/12 ändern nur Doku), nichts tun; sonst `pnpm --dir e2e docs:screenshots`, ansehen, committen.

- [ ] **Step 3: Identität, Arbeitsstand, keine fremden Daten**

Run: `test "$(git config user.email)" = "rafael@hauss.dev" && echo ok && git status --short && git log --oneline main..HEAD`
Expected: `ok`, kein `git status`-Output, die Commits dieser Phase (Plan + Tasks 1–12, ggf. Fixes).

Run: `git diff main -U0 | grep '^+' | grep -oE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}' | sort -u`
Expected: nur Adressen unter `example.com`/`*.example` (z. B. `hallo@nordlicht.example`, `e2e@example.com`), `noreply@anthropic.com` und `rafael@hauss.dev` (beide aus dem Plan). Alles andere entfernen.

Run: `git diff main --stat -- '*.png' | tail -1 && git diff main -U0 -- . ':!*.png' | grep '^+' | grep -oE 'https?://[A-Za-z0-9./_-]+' | sed -E 's#^(https?://[^/]+).*#\1#' | sort -u`
Expected: 26 PNGs; Hosts nur `github.com`, `baeroe.github.io`, `raw.githubusercontent.com`, `hub.docker.com`, `img.shields.io`, `ddev.com`, `openbill.ddev.site`, `localhost`, `claude.com`, `www.w3.org`.

- [ ] **Step 4: Push**

Run: `git push -u origin phase-11-polish`
Expected: Branch angelegt bzw. aktualisiert.

- [ ] **Step 5: PR anlegen**

Run:
```bash
gh pr create --base main --head phase-11-polish --title "feat: phase 11 polish – docs site, screenshots, README and open ends" --body "$(cat <<'BODY'
## Summary

- **Logout:** a session that had ended already (401/419) counts as logged out, the request times out after 10 s, deletions still waiting for their undo toast are sent first, and a toast says that logging out is in progress
- **Expired session:** unsaved draft input is kept in `sessionStorage` on 401 and comes back when the same person opens the document after logging in (drafts only, one day)
- **UI:** toasts resume after an undo used with the keyboard; dialogs, drawers and the mobile sidebar animate out; the document list filters by document date (`date_from`/`date_to`, also in the URL)
- **`php artisan app:prune-images [--dry-run] [--min-age=24]`:** deletes uploads and old logos that no record and no snapshot refers to
- **Liquid:** exact integer math beyond `PHP_INT_MAX`, `date` takes Unix timestamps
- **Input and proxies:** master data names sent as JSON are trimmed (tax rates, units, text blocks, organization, tokens); `X-Forwarded-Prefix` is never trusted; `TRUSTED_PROXIES` documented as IP/CIDR only
- **Dependabot** for GitHub Actions, Composer and pnpm (Docker images stay manual because of the pinned digests); the KoSIT validator is documented as not applicable (it checks XRechnung)
- **Docs:** GitHub Pages workflow `docs.yml` (https://baeroe.github.io/openbill/, base via `DOCS_BASE`), theme with the app's tokens incl. dark mode, landing pages in the style of prevju, screenshots of the demo data in English and German on every page (reproducible: `pnpm --dir e2e docs:screenshots`), review of all pages (en/de in step, links, `llms.txt`), notes for 0.1.0
- **Repo:** README with screenshot and docs links, project memory `docs/history/`, final `CLAUDE.md`, About/website/topics updated

## Test plan

- [x] Pest, Pint, Larastan, tsc, Vitest, packages, app build, docs build with and without the Pages base, actionlint
- [x] Playwright suite against DDEV; docs screenshots generated and looked at
- [x] Docs preview under `/openbill/`: redirect to `/openbill/en/`, assets and favicon with the base, `llms.txt` with absolute links
- [ ] CI: `tests`, `einvoice`, `e2e`, `image` green

GitHub Pages is enabled (source: GitHub Actions); the first deployment runs after the merge to `main`. No tag is pushed; the v0.1.0 release is up to the maintainer.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
BODY
)"
```
Expected: URL des PRs.

- [ ] **Step 6: CI abwarten**

Run: `gh pr checks --watch --interval 30`
Expected: `tests`, `einvoice`, `e2e` und – weil `pnpm-lock.yaml` sich geändert hat – `image` (Workflow „Docker image“, nur Build amd64+arm64, 20–40 min) `pass`. `docs.yml` läuft im PR nicht (nur auf `main`).
Schlägt ein Job fehl: Log lesen (`gh run view <run-id> --log-failed`), Ursache beheben (eigener Commit, Test wenn möglich), pushen, erneut `gh pr checks --watch`. Bei `e2e`: `gh run download <run-id> -n e2e-results -D "${TMPDIR:-/tmp}/openbill-e2e-results"`. **Nicht mergen, keinen Tag pushen.**

- [ ] **Step 7: Abschluss melden**

PR-URL und CI-Status an den Orchestrator melden, dazu: Pages ist aktiviert, erster Deploy nach dem Merge (dann `gh run list --workflow docs.yml` und https://baeroe.github.io/openbill/ prüfen). Der Orchestrator setzt nach Review und Merge den Haken für Phase 11; das Release (`git tag v0.1.0 && git push origin v0.1.0`) macht der Nutzer.
