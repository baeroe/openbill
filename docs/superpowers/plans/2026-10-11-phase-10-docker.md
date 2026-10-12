# Phase 10: Docker & Release – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** openbill läuft selbst gehostet per `docker compose up -d` (Image `baeroe/openbill`, MariaDB 11.4, gehärtetes Gotenberg 8, Host-Port 7739), überlebt Neustarts mit Daten und `APP_KEY`, steht korrekt hinter einem Reverse Proxy, wird per Tag `vX.Y.Z` als Multi-Arch-Image nach Docker Hub veröffentlicht (mit GitHub-Release und README-Sync) und wird in CI als Compose-Stack mit Playwright geprüft (Job `e2e`). Abnahme: lokal gebautes Image unter Colima → Login → Rechnung abschließen → PDF/A-3 mit XML im Volume; `e2e`-Job grün.

**Architecture:** Ein zweistufiges `Dockerfile`: Stage `assets` (Node 24 Alpine, pnpm über corepack aus `packageManager`, läuft auf `$BUILDPLATFORM`) installiert den pnpm-Workspace mit `--frozen-lockfile` und führt `pnpm build` aus (App-Assets nach `public/build`, Template-Kit nach `packages/template-kit/dist/kit`); Stage `app` (`serversideup/php:8.4-fpm-nginx-v4.5.1`, per Digest gepinnt) installiert `intl bcmath gd apcu`, kopiert **nur** die Laufzeit-Ordner (inkl. `docs/en/templates.md`), Assets und Kit, setzt Body-Limits (PHP/nginx 32M ≥ `max_template_body_bytes` 30 MB) und läuft als `www-data`. `docker/entrypoint.d/99-openbill.sh` (von serversideups Entrypoint vor nginx/FPM ausgeführt) legt die Speicherordner im Volume an, persistiert `APP_KEY` in `storage/app/.app-key`, wartet mit Timeout auf die DB, migriert, synchronisiert die mitgelieferten Templates, legt den Owner an und cacht per `optimize` die Config (damit erreicht `APP_KEY` PHP-FPM). `docker-compose.yml` verbindet `openbill` (öffentlich über Port 7739) mit `mariadb` und `gotenberg` in einem `internal`-Netz. `bootstrap/app.php` vertraut `X-Forwarded-*` nur aus privaten Netzen und akzeptiert als Host nur den Host aus `APP_URL`. Ein Feature-Test (`DockerSetupTest`) hält Dockerfile, Compose, DDEV, CI und `.dockerignore` gegeneinander konsistent.

**Tech Stack:** Docker (BuildKit, Buildx, QEMU), serversideup/php 8.4-fpm-nginx v4.5.1 (Debian trixie, s6, `install-php-extensions`), Node 24 + corepack + pnpm 12.8.1, MariaDB 11.4.13, Gotenberg 8.37.0, GitHub Actions (`docker/*-action`, `peter-evans/dockerhub-description`), Laravel 13 (`trustProxies`/`trustHosts`), Pest 5, Playwright, VitePress, Colima (arm64) für die lokale Abnahme.

**Spec:** `docs/superpowers/specs/2026-10-11-openbill-app-design.md` (bindend; Abschnitt 9 „Betrieb“ – Compose-Dienste, Entrypoint, `.env.docker.example`-Variablen, Trusted Proxies, Release; Abschnitt 10 „Tests und CI“ – Job `e2e` gegen den Compose-Stack, nicht Pflicht). Master-Plan `docs/superpowers/plans/2026-10-11-openbill-app.md`, Abschnitt „Phase 10“ (Liefert, Doku, Abnahme). Referenzprojekt: `baeroe/prevju` (öffentlich; `Dockerfile`, `docker/entrypoint.d/99-prevju.sh`, `.github/workflows/docker.yml`, `dockerhub.yml`, `docs/en/{setup,reverse-proxy,upgrading}.md`, `bootstrap/app.php`).

## Global Constraints

- Branch `phase-10-docker` (ist ausgecheckt). Git-Identität kommt aus `~/.gitconfig`; vor dem ersten Commit `test "$(git config user.email)" = "rafael@hauss.dev" && echo ok` → muss `ok` ausgeben, sonst stoppen und nachfragen. Nie `user.email`/`user.name` setzen.
- Jede Commit-Message endet mit der Zeile `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (in diesem Plan als zweites `-m`); die PR-Beschreibung endet mit `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- PHP, Composer, Artisan im Entwicklungsablauf **nur in DDEV** (`ddev artisan …`, `ddev exec …`). Im Image läuft PHP natürlich im Container (`docker compose exec openbill php artisan …`). JS nur mit **pnpm** (nie npm/npx; auch nicht im Dockerfile). `e2e/` läuft auf dem Mac (`pnpm --dir e2e …`).
- Vor jedem Commit mit PHP: `ddev exec vendor/bin/pint` und `ddev exec vendor/bin/phpstan analyse --memory-limit=1G`. `e2e/` hat kein eigenes `tsc` (Playwright transpiliert selbst); geprüft wird es durch den Lauf der Suite.
- **Images per Version und Digest pinnen** (Ledger Phase 3 M4): Dockerfile (`node`, `serversideup/php`), `docker-compose.yml` (`mariadb`, `gotenberg`), `.ddev/docker-compose.gotenberg.yaml`, `.github/workflows/tests.yml` (MariaDB-Service, Gotenberg), `scripts/validate-einvoice.sh` (`JAVA_IMAGE`). Gleiches Image = gleicher String überall (`DockerSetupTest`).
- Image-Werte (geprüft am 2026-10-12 über die Docker-Hub-API, Index-Digests für alle Plattformen):
  - `node:24-alpine3.24@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1` (Node v24.21.0, corepack 0.36.0, geprüft)
  - `serversideup/php:8.4-fpm-nginx-v4.5.1@sha256:8e0864511c48a943b59c59c2845eb8de1dc402b6d549a3b2e0e45018f1b99567` (PHP 8.4.23, Debian 13, User `www-data`, geprüft)
  - `mariadb:11.4.13@sha256:1292844148b311e4ed4300022a996d39083f415a963e970cf47cad1b3b18e3a6`
  - `gotenberg/gotenberg:8.37.0@sha256:f29984bd1e226bf1b93ba90af06000afa8b315853e99d27b9aaa41b93f15c769` (volles Image: PDF/A-Umwandlung braucht LibreOffice, nicht die `-chromium`-Variante)
  - `eclipse-temurin:21-jre-noble@sha256:000fd431958bc81a24abe1e8e5f0f0fd3ae365a594bd50aadb20696805f9408c`
- Gotenberg läuft überall mit genau diesen Schaltern (wie `.ddev/docker-compose.gotenberg.yaml`): `--chromium-disable-javascript=true`, `--chromium-deny-list=^file:(?!//\/tmp/).*`, `--chromium-deny-list=^(?!(file|data):).*`, `--chromium-deny-private-ips=true`, `--chromium-deny-public-ips=true`.
- Image `baeroe/openbill`, Host-Port **7739** → Container 8080, Volumes `openbill-data` (= `/var/www/html/storage/app`) und `openbill-db` (= `/var/lib/mysql`). `.env.docker.example` enthält mindestens `APP_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DB_PASSWORD`, `DB_ROOT_PASSWORD`, `OPENBILL_PORT`, optional `OPENBILL_IMAGE` (Spec 9).
- `docs/en/templates.md` muss im Image liegen (`LiquidReferenceResource` liest sie zur Laufzeit) – `.dockerignore` nimmt sie ausdrücklich wieder auf.
- Body-Limits: PHP `post_max_size`/`upload_max_filesize` und nginx `client_max_body_size` ≥ `config('openbill.api.max_template_body_bytes')` (30 MB) → **32M**. PHP `memory_limit` **512M** (`config/openbill.php` → `rendering.max_memory_bytes` rechnet damit).
- Trusted Proxies nur `127.0.0.1`, `::1`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `fc00::/7` (wie prevju). Trusted Hosts: genau der Host aus `APP_URL` (ohne Subdomains); Laravel prüft das außerhalb von `local` und Tests.
- Demo- und Testdaten nur fiktiv (Studio Nordlicht, Hafenkontor Lindqvist …; Hosts `invoices.example.com`, `openbill.example`, `localhost`; E-Mails nur `@example.com`). Keine echten Firmen, Hosts oder Personen.
- CI: Pflicht-Job heißt `tests` und bleibt unverändert benannt. Neue Jobs `e2e` (in `tests.yml`) und `image` (in `docker.yml`) sind keine Pflicht-Checks.
- **Kein Tag pushen, kein Release anlegen, nicht mergen.** Das Release v0.1.0 macht der Nutzer.
- Doku: neue Seiten `setup`, `reverse-proxy`, `backup`, `upgrading` in `docs/en/` **und** `docs/de/` (Du-Form), eingetragen in `docs/.vitepress/config.ts` (`tests/Unit/DocsTest.php` prüft beides); `development` ergänzt; README mit Quickstart; `CLAUDE.md` aktualisiert.
- Der Haken für Phase 9 im Abschnitt „Fortschritt“ des Master-Plans ist mit diesem Plan committet. Den Haken für Phase 10 setzt der Orchestrator nach dem Merge.

## Review Focus

- **Neustart und Neuanlage der Container:** `docker compose restart` und `docker compose down && docker compose up -d` (ohne `-v`) behalten Dokumente, Archiv-PDFs, Templates und den `APP_KEY` (bestehende Sitzungs-Cookies bleiben gültig); ein gesetztes `APP_KEY` in `.env` hat Vorrang vor der Datei. → Task 3 (Reihenfolge/Skript), Task 11 (Neustart- und Neuanlage-Probe mit Cookie-Jar und SHA-256 der Schlüsseldatei).
- **Datenbank langsam oder falsch konfiguriert:** Beim ersten Start ist MariaDB noch nicht bereit, oder Host/Passwort stimmen nicht → der Container wartet höchstens `DB_WAIT_TIMEOUT` (60 s), meldet dann `openbill: database <host>:<port> not reachable after <n>s: <PDO-Meldung>` und beendet sich (kein halb migrierter Betrieb, kein endloses Hängen). → Task 3 (Lauf ohne DB mit `DB_WAIT_TIMEOUT=4`).
- **Reverse Proxy und gefälschte Header:** Hinter Caddy/Traefik/nginx im privaten Netz erzeugt openbill `https://`-Links, sieht die echte Client-IP (Login-Throttle je IP!) und lehnt fremde `Host`-Header mit 400 ab; ein Client aus dem Internet, der direkt auf Port 7739 `X-Forwarded-Proto/For` schickt, ändert weder Schema noch IP. → Task 1 (`TrustedProxiesTest`), Task 4 (`curl -H 'Host: evil.example'` → 400), Task 11 (Login über Proxy-Header-freien Ablauf).
- **Große Template-Uploads:** Ein Template-Paket bis 30 MB kommt durch nginx und PHP bis zu `LimitApiBody` (dort 401 ohne Token statt 413 von nginx), ein 34-MB-Body scheitert früh an nginx (413), ein 25-MB-Body an `/api/documents` scheitert an `LimitApiBody` mit Problem Details `payload_too_large`. → Task 2 (`DockerSetupTest` Größen), Task 4 (curl-Proben).
- **MariaDB mit eingeschaltetem Binlog:** Die Trigger-Migration (`2026_10_11_100250`) läuft auch, wenn jemand Binärlogs einschaltet (Replikation, Point-in-Time-Backup) oder eine externe MariaDB nutzt; ohne `log_bin_trust_function_creators=1` scheitert sie dort mit Fehler 1419. → Task 4 (Probe mit `--log-bin`), Doku `setup`/`backup` (externe DB).

## Entscheidungen (geprüft am 2026-10-12)

| Thema | Entscheidung | Grund / Prüfung |
|---|---|---|
| Basis-Image | `serversideup/php:8.4-fpm-nginx-v4.5.1` + Digest, nicht `v5.0.0` | v5.0.0 ist vier Tage alt (neue Hauptversion), v4.5.1 seit Juli stabil. Geprüft: Entrypoint führt `/etc/entrypoint.d/*.sh` sortiert per `(. "$f")` aus (Subshell, `set -e` im Elternskript stoppt bei Fehler), `install-php-extensions` vorhanden, Image läuft als `www-data`, nginx-Template nutzt `client_max_body_size $NGINX_CLIENT_MAX_BODY_SIZE`, eingebauter `HEALTHCHECK` auf `/healthcheck` (nginx → FPM-Ping, nicht Laravel). |
| PHP-Extensions | Basis hat bereits `ctype curl dom fileinfo iconv mbstring openssl pdo_mysql simplexml tokenizer xml zip zlib`; nachinstalliert werden `intl bcmath gd apcu` | `composer.lock` verlangt `ext-gd` (setasign/fpdf), `ext-zip`/`dom`/`simplexml`/`fileinfo` (horstoeko/zugferd); `intl` für `NumberFormatter`/`KeySlugger`, `bcmath` beschleunigt brick/math, `apcu` für den API-Platform-Metadaten-Cache (`MetadataStore`). |
| Node-Stage | `FROM --platform=$BUILDPLATFORM node:24-alpine3.24@…`, `corepack enable && corepack install` (liest `packageManager: pnpm@12.8.1`), alle Workspace-Manifeste kopieren, `pnpm install --frozen-lockfile`, `pnpm build` | Ausgabe ist plattformunabhängiges JS/CSS → einmal nativ bauen statt unter QEMU. Volles Install (auch `docs`, `prototypes`) statt `--filter`, damit `--frozen-lockfile` sicher passt; die Stage landet nicht im Image. |
| Was ins Image kommt | Explizite `COPY`s: `app bootstrap config database lang public resources routes artisan composer.*`, `docs/en/templates.md`, `public/build`, `packages/template-kit/dist/kit`; `storage/` wird per `mkdir` angelegt | Kein `COPY . .`: keine Tests, Prototypen, `.ddev`, `e2e`, `.env`. Seeder bleiben drin (für den e2e-Stack, verweigern `production`). |
| `.dockerignore` | Schließt Geheimnisse/Abhängigkeiten/Caches aus, `docs/*` und `prototypes/*/*` mit Ausnahmen `!docs/package.json`, `!docs/en/templates.md`, `!prototypes/*/package.json` | Node-Stage braucht die Manifeste für den Lockfile, die PHP-Stage die Liquid-Referenz. Task 2 prüft den Build-Kontext mit einem Wegwerf-Build. |
| Entrypoint-Exports | `APP_KEY` wird exportiert **und** per `php artisan optimize` in den Config-Cache geschrieben | Exports aus `entrypoint.d` erreichen PHP-FPM nicht (Subshell). Der Config-Cache trägt den Schlüssel; `config:clear` am Anfang verhindert einen veralteten Cache nach `docker compose restart`. |
| Mitgelieferte Templates | Erste Anlage per Migration `2026_10_11_100400` (gibt es schon), danach bei **jedem** Start `php artisan app:sync-templates` | Neue Versionen von Klar/Kante/Leise kommen mit dem Image; die Migration läuft nur einmal. |
| Binlog | MariaDB-Container läuft mit Binlog **aus** (Image-Standard) **und** `--log-bin-trust-function-creators=1` | Trigger brauchen bei aktivem Binlog SUPER oder diesen Schalter. Mit dem Schalter funktioniert es auch, wenn jemand Binlogs einschaltet; Task 4 prüft beides. Externe Datenbanken: Doku. |
| Netze | `default` (nur `openbill`, Port 7739) + `backend` mit `internal: true` (`openbill`, `mariadb`, `gotenberg`) | MariaDB und Gotenberg sind weder vom Host noch aus dem Internet erreichbar und haben selbst keinen Internetzugang. |
| Pflichtvariablen | `APP_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DB_PASSWORD`, `DB_ROOT_PASSWORD` per `${VAR:?… missing}` | `APP_URL` bestimmt Trusted Host, Links und `OPENBILL_URL` im Toolkit-ZIP; ohne Admin kann sich niemand anmelden. |
| Trusted Hosts | `trustHosts(at: fn () => TrustedRequests::hostPatterns(config('app.url')), subdomains: false)` | Laravels Standard erlaubt alle Subdomains; openbill braucht genau einen Host. Aktiv außerhalb `local` und Tests (Laravel-Verhalten), also in Produktion **und** im e2e-Stack. |
| Seeding im e2e-Stack | Override `e2e/docker-compose.e2e.yml` setzt `APP_ENV=e2e`; `e2e/global-setup.ts` ruft Artisan über `E2E_ARTISAN` (Standard `ddev artisan`), im Stack `e2e/compose.sh exec -T openbill php artisan` | `DemoSeeder`/`E2eUserSeeder` brauchen **kein Faker** (keine Factories, Task 6 prüft per `grep`) und liegen im Autoload ohne `--dev`; sie verweigern nur `production`. Alles andere ist der Produktionsaufbau. |
| e2e-Umfang | Die ganze Suite (Projekt `chromium`, inkl. `toolkit.spec.ts`) gegen `http://localhost:7739` | Das Kit erlaubt `http://` für `localhost`; Runner hat Node 24, pnpm, `unzip`. Screenshots bleiben aus (nur mit `SCREENSHOTS=1`). |
| Release | `docker.yml`: Tag `v*` → Notizen aus `docs/en/upgrading.md` (`scripts/release-notes.sh`, bricht ohne Abschnitt in en **oder** de ab, bevor etwas gepusht wird) → Multi-Arch-Build/-Push `X.Y.Z`, `X.Y`, `latest` (nicht für Vorabversionen) → `gh release create --verify-tag --generate-notes --notes …`. Zusätzlich bei PRs, die Dockerfile/Lockfiles/Workflow ändern: nur bauen (amd64+arm64), nichts pushen | arm64 (QEMU) wird so vor dem ersten Tag geprüft. `gh release create --help` (geprüft): `--notes` wird den generierten Notizen vorangestellt. |
| README-Sync | `dockerhub.yml` bei README-Änderungen auf `main` **und** nach erfolgreichem Release-Lauf (`workflow_run`); überspringt mit Hinweis, solange es `baeroe/openbill` auf Docker Hub noch nicht gibt | Nach dem Merge (vor dem ersten Tag) würde der Sync sonst rot werden. |
| einvoice-Artefakte | `actions/cache` auf `storage/framework/testing/einvoice-validator`, Schlüssel = Hash von `scripts/validate-einvoice.sh` | Das Skript prüft SHA-256 ohnehin; ein 404 der Quelle trifft nur noch Läufe nach einer Versionsänderung (Ledger Phase 8). |

## Datei-Übersicht

| Datei | Task | Zweck |
|---|---|---|
| `app/Support/TrustedRequests.php` (neu) | 1 | Proxy-Netze, Host-Muster aus `APP_URL` |
| `bootstrap/app.php` | 1 | `trustProxies`, `trustHosts` |
| `tests/Feature/TrustedProxiesTest.php` (neu) | 1 | Header aus privaten/öffentlichen Netzen, Host-Muster |
| `Dockerfile` (neu) | 2, 3 | Node-Stage + serversideup-Stage |
| `.dockerignore` (neu) | 2 | Build-Kontext |
| `tests/Feature/DockerSetupTest.php` (neu) | 2–5 | Konsistenz Dockerfile/Compose/DDEV/CI/Skripte |
| `docker/entrypoint.d/99-openbill.sh` (neu) | 3 | Start-Ablauf |
| `docker-compose.yml`, `.env.docker.example` (neu) | 4 | Self-Hosting-Stack |
| `config/openbill.php` | 4 | Kommentare „Phase 10“ auflösen |
| `.ddev/docker-compose.gotenberg.yaml`, `scripts/validate-einvoice.sh` | 5 | Digests |
| `.github/workflows/tests.yml` | 5, 7 | Digests, einvoice-Cache, Job `e2e` |
| `e2e/global-setup.ts`, `e2e/playwright.config.ts`, `e2e/compose.sh`, `e2e/compose.env`, `e2e/docker-compose.e2e.yml` | 6 | Playwright gegen den Compose-Stack |
| `docs/{en,de}/setup.md`, `reverse-proxy.md`, `backup.md`, `upgrading.md` (neu), `docs/.vitepress/config.ts`, `docs/{en,de}/index.md`, `tests/Unit/DocsTest.php` | 8 | Betriebs-Doku |
| `scripts/release-notes.sh` (neu), `tests/Unit/ReleaseNotesTest.php` (neu), `.github/workflows/docker.yml`, `.github/workflows/dockerhub.yml` (neu) | 9 | Release |
| `README.md`, `docs/{en,de}/development.md`, `CLAUDE.md` | 10 | Kurzfassung, Entwickler-Doku, Projektwissen |
| – | 11 | Lokale Abnahme unter Colima |
| – | 12 | Verifikation, Push, PR, CI |

---

### Task 1: Trusted Proxies und Trusted Hosts

**Files:**
- Create: `app/Support/TrustedRequests.php`
- Modify: `bootstrap/app.php` (im `withMiddleware`-Block, nach `$middleware->redirectUsersTo(...)`)
- Test: `tests/Feature/TrustedProxiesTest.php`

**Interfaces:**
- Produces: `App\Support\TrustedRequests::PROXIES` (`list<string>`), `App\Support\TrustedRequests::hostPatterns(mixed $appUrl): list<string>` (Regex ohne Delimiter für `Request::setTrustedHosts`, z. B. `['^invoices\.example\.com$']`). Doku `reverse-proxy` (Task 8) nennt genau diese Netze.

- [ ] **Step 1: Identität prüfen**

Run: `test "$(git config user.email)" = "rafael@hauss.dev" && echo ok`
Expected: `ok`

- [ ] **Step 2: Failing Test schreiben**

`tests/Feature/TrustedProxiesTest.php`:

```php
<?php

use App\Support\TrustedRequests;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Http\Middleware\TrustHosts;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Symfony\Component\HttpFoundation\Exception\SuspiciousOperationException;

beforeEach(function () {
    Route::get('/_proxy-check', fn (Request $request): array => ['secure' => $request->isSecure(), 'ip' => $request->ip()]);
});

it('trusts X-Forwarded-* from a reverse proxy in a private network', function (string $proxy) {
    $this->withServerVariables(['REMOTE_ADDR' => $proxy])
        ->get('/_proxy-check', ['X-Forwarded-Proto' => 'https', 'X-Forwarded-Port' => '443', 'X-Forwarded-For' => '203.0.113.7'])
        ->assertOk()
        ->assertExactJson(['secure' => true, 'ip' => '203.0.113.7']);
})->with(['127.0.0.1', '::1', '10.1.2.3', '172.18.0.5', '192.168.1.20', 'fd00::5']);

it('ignores X-Forwarded-* sent straight from the internet', function () {
    $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.9'])
        ->get('/_proxy-check', ['X-Forwarded-Proto' => 'https', 'X-Forwarded-For' => '203.0.113.7'])
        ->assertOk()
        ->assertExactJson(['secure' => false, 'ip' => '198.51.100.9']);
});

it('derives exactly one host pattern from APP_URL, without subdomains or port', function () {
    expect(TrustedRequests::hostPatterns('https://invoices.example.com'))->toBe(['^invoices\.example\.com$'])
        ->and(TrustedRequests::hostPatterns('http://localhost:7739'))->toBe(['^localhost$'])
        ->and(TrustedRequests::hostPatterns('https://Invoices.Example.com/sub/'))->toBe(['^invoices\.example\.com$'])
        // unusable APP_URL: localhost only, never "every host"
        ->and(TrustedRequests::hostPatterns(''))->toBe(['^localhost$'])
        ->and(TrustedRequests::hostPatterns(null))->toBe(['^localhost$']);
});

it('registers TrustHosts globally with the host of APP_URL', function () {
    config(['app.url' => 'https://invoices.example.com']);

    expect(app(Kernel::class)->hasMiddleware(TrustHosts::class))->toBeTrue()
        ->and(app(TrustHosts::class)->hosts())->toBe(['^invoices\.example\.com$']);
});

it('rejects a foreign Host header once the patterns apply', function () {
    Request::setTrustedHosts(TrustedRequests::hostPatterns('https://invoices.example.com'));

    try {
        expect(Request::create('https://invoices.example.com/en/login')->getHost())->toBe('invoices.example.com')
            ->and(fn () => Request::create('https://evil.example/en/login')->getHost())->toThrow(SuspiciousOperationException::class)
            ->and(fn () => Request::create('https://a.invoices.example.com/en/login')->getHost())->toThrow(SuspiciousOperationException::class);
    } finally {
        Request::setTrustedHosts([]);
    }
});
```

- [ ] **Step 3: Test laufen lassen, Fehlschlag prüfen**

Run: `ddev artisan test --filter=TrustedProxiesTest`
Expected: FAIL – `Class "App\Support\TrustedRequests" not found` bzw. `secure` ist `false` für die privaten Proxies.

- [ ] **Step 4: `app/Support/TrustedRequests.php` anlegen**

```php
<?php

namespace App\Support;

/**
 * Which requests openbill believes (docs: reverse-proxy).
 *
 * - Proxies: X-Forwarded-For/-Proto/-Host/-Port only from localhost and private networks, where a reverse proxy
 *   (Caddy, Traefik, nginx, Docker's own network) sits. A client on the internet that hits the published port
 *   directly can't fake https or its IP (the login throttle counts per IP).
 * - Hosts: only the host of APP_URL (no subdomains). Laravel applies it outside `local` and tests; any other Host
 *   header answers 400, so no link or redirect is ever built from a foreign host.
 */
final class TrustedRequests
{
    /** @var list<string> */
    public const PROXIES = ['127.0.0.1', '::1', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', 'fc00::/7'];

    /**
     * Patterns for Request::setTrustedHosts(): the host of APP_URL, case-insensitive, without port.
     * An unusable APP_URL trusts localhost only, never every host.
     *
     * @return list<string>
     */
    public static function hostPatterns(mixed $appUrl): array
    {
        $host = is_string($appUrl) ? parse_url($appUrl, PHP_URL_HOST) : null;

        if (! is_string($host) || $host === '') {
            $host = 'localhost';
        }

        return ['^'.preg_quote(strtolower($host)).'$'];
    }
}
```

- [ ] **Step 5: `bootstrap/app.php` ergänzen**

Import oben (alphabetisch zwischen den `App\…`-Imports):

```php
use App\Support\TrustedRequests;
```

Im `withMiddleware`-Block direkt nach der Zeile `$middleware->redirectUsersTo(...)` einfügen:

```php
        // reverse proxy in front (docs: reverse-proxy): X-Forwarded-* only from private networks, so a direct hit on the
        // published port can't fake https or its IP; the Host header must be the host of APP_URL (outside local/tests)
        $middleware->trustProxies(at: TrustedRequests::PROXIES);
        $middleware->trustHosts(at: fn (): array => TrustedRequests::hostPatterns(config('app.url')), subdomains: false);
```

- [ ] **Step 6: Test grün**

Run: `ddev artisan test --filter=TrustedProxiesTest`
Expected: PASS (10 Tests: 6 Datensätze + 4).

- [ ] **Step 7: Ganze Suite, damit kein bestehender Test an den neuen Middlewares hängt**

Run: `ddev artisan test`
Expected: PASS, gleiche Anzahl wie vorher + 10.

- [ ] **Step 8: Statische Prüfungen**

Run: `ddev exec vendor/bin/pint && ddev exec vendor/bin/phpstan analyse --memory-limit=1G`
Expected: Pint ohne Änderungen außer ggf. Formatierung der neuen Dateien, PHPStan `[OK] No errors`.

- [ ] **Step 9: Commit**

```bash
git add app/Support/TrustedRequests.php bootstrap/app.php tests/Feature/TrustedProxiesTest.php
git commit -m "feat: trust reverse proxies in private networks and only the APP_URL host" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Dockerfile und `.dockerignore`

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`
- Test: `tests/Feature/DockerSetupTest.php`

**Interfaces:**
- Consumes: `config('openbill.api.max_template_body_bytes')` (30 MB), `config('openbill.templates.max_package_bytes')` (10 MB), `config('openbill.toolkit.path')` (`base_path('packages/template-kit/dist/kit')`), Root-Skript `pnpm build` (`vite build && pnpm --filter @openbill/template-kit build`).
- Produces: Image-Stages `assets` und `app`; im Image `/var/www/html/public/build/manifest.json`, `/var/www/html/packages/template-kit/dist/kit/tooling/cli.js`, `/var/www/html/docs/en/templates.md`; Test-Helfer in `DockerSetupTest.php`: `dockerRepoFile(string $path): string`, `dockerSizeBytes(string $size): int`, `dockerfileEnv(string $name): string` (Tasks 3–5 hängen Tests an diese Datei an).

- [ ] **Step 1: Failing Test schreiben**

`tests/Feature/DockerSetupTest.php`:

```php
<?php

/*
 * Keeps the self-hosting files consistent with the app and with each other: Dockerfile, .dockerignore, entrypoint,
 * docker-compose.yml, DDEV, CI and scripts (phase 10). Pure file checks; the image itself is verified by building it.
 */

function dockerRepoFile(string $path): string
{
    $file = base_path($path);
    expect(is_file($file))->toBeTrue("{$path} is missing");

    return (string) file_get_contents($file);
}

/** "32M" → bytes (PHP/nginx size notation). */
function dockerSizeBytes(string $size): int
{
    if (preg_match('/^(\d+)([KMG]?)$/i', trim($size), $m) !== 1) {
        throw new InvalidArgumentException("Unknown size {$size}");
    }

    return (int) $m[1] * match (strtoupper($m[2])) {
        'K' => 1024,
        'M' => 1024 ** 2,
        'G' => 1024 ** 3,
        default => 1,
    };
}

/** Value of NAME=value in the ENV instruction of the Dockerfile. */
function dockerfileEnv(string $name): string
{
    $found = preg_match('/^\s*(?:ENV\s+)?'.preg_quote($name, '/').'=(\S+?)(?:\s+\\\\)?$/m', dockerRepoFile('Dockerfile'), $m);
    expect($found)->toBe(1, "Dockerfile sets no {$name}");

    return $m[1];
}

it('pins every base image by version and digest', function () {
    preg_match_all('/^FROM\s+(?:--platform=\S+\s+)?(\S+)/m', dockerRepoFile('Dockerfile'), $m);

    expect($m[1])->toHaveCount(2);
    foreach ($m[1] as $image) {
        expect($image)->toMatch('/^[a-z0-9\/._-]+:[\w.-]+@sha256:[0-9a-f]{64}$/');
    }
});

it('builds assets and the template kit with pnpm from corepack, never npm', function () {
    $dockerfile = dockerRepoFile('Dockerfile');

    expect($dockerfile)->toContain('corepack enable', 'pnpm install --frozen-lockfile', 'RUN pnpm build')
        ->and(preg_match('/(?<![\w-])npm\b|npx\b/', $dockerfile))->toBe(0);
});

it('installs the PHP extensions the app needs on top of the base image', function () {
    expect(dockerRepoFile('Dockerfile'))->toMatch('/install-php-extensions\s+intl\s+bcmath\s+gd\s+apcu/');
});

it('lets template uploads through nginx and PHP and gives PHP the memory rendering expects', function () {
    $templateBody = (int) config('openbill.api.max_template_body_bytes');

    expect(dockerSizeBytes(dockerfileEnv('PHP_POST_MAX_SIZE')))->toBeGreaterThanOrEqual($templateBody)
        ->and(dockerSizeBytes(dockerfileEnv('NGINX_CLIENT_MAX_BODY_SIZE')))->toBeGreaterThanOrEqual($templateBody)
        ->and(dockerSizeBytes(dockerfileEnv('PHP_UPLOAD_MAX_FILE_SIZE')))->toBeGreaterThanOrEqual((int) config('openbill.templates.max_package_bytes'))
        ->and(dockerSizeBytes(dockerfileEnv('PHP_MEMORY_LIMIT')))->toBe(512 * 1024 ** 2)
        ->and(dockerfileEnv('APP_ENV'))->toBe('production')
        ->and(dockerfileEnv('APP_DEBUG'))->toBe('false');
});

it('ships the Liquid reference the MCP server reads at runtime', function () {
    $ignore = array_map('trim', explode("\n", dockerRepoFile('.dockerignore')));

    expect($ignore)->toContain('!docs/en/templates.md')
        ->and(dockerRepoFile('Dockerfile'))->toContain('COPY --chown=www-data:www-data docs/en/templates.md ./docs/en/templates.md');
});

it('puts the built template kit where config(openbill.toolkit.path) looks for it', function () {
    expect(config('openbill.toolkit.path'))->toBe(base_path('packages/template-kit/dist/kit'))
        ->and(dockerRepoFile('Dockerfile'))->toContain('--from=assets /app/packages/template-kit/dist/kit ./packages/template-kit/dist/kit');
});

it('keeps secrets, dependencies and local caches out of the build context', function () {
    $ignore = array_map('trim', explode("\n", dockerRepoFile('.dockerignore')));

    expect($ignore)->toContain('.env', '.env.*', '**/node_modules', 'vendor', 'storage', 'bootstrap/cache/*.php', '.git', '.ddev', 'e2e', 'tests');
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `ddev artisan test --filter=DockerSetupTest`
Expected: FAIL – `Dockerfile is missing` / `.dockerignore is missing`.

- [ ] **Step 3: `.dockerignore` anlegen**

```gitignore
# Build context of the Dockerfile. The image copies only what it needs (explicit COPYs in the Dockerfile);
# this list keeps secrets, dependencies, caches and everything not needed for the build out of the context.
.git
.github
.ddev
.superpowers
.idea
.vscode
.env
.env.*
**/node_modules
.pnpm-store
vendor
storage
bootstrap/cache/*.php
public/build
public/hot
public/storage
public/vendor
e2e
tests
*.log
**/.DS_Store

# docs: the workspace manifest (frozen lockfile) and the Liquid reference the MCP server reads at runtime
# (resource openbill://docs/liquid-reference) – never drop docs/en/templates.md
docs/*
!docs/package.json
!docs/en
docs/en/*
!docs/en/templates.md

# prototypes: only the manifests, so pnpm's frozen lockfile matches the workspace
prototypes/*/*
!prototypes/*/package.json

# built or local files of the template kit (the image builds the kit itself)
packages/template-kit/dist
packages/template-kit/template
packages/template-kit/.env.local
```

- [ ] **Step 4: `Dockerfile` anlegen**

```dockerfile
# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------------------------------------------------
# assets: Vite build of the app (public/build) and the template kit (packages/template-kit/dist/kit).
# Runs on the platform of the build machine: the output is plain JS/CSS, the same for amd64 and arm64.
# ---------------------------------------------------------------------------------------------------------------------
FROM --platform=$BUILDPLATFORM node:24-alpine3.24@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS assets
WORKDIR /app
ENV CI=true \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0

# pnpm in exactly the version of "packageManager" in package.json
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && corepack install

# every manifest of the workspace, so the frozen lockfile matches (docs and prototypes are installed, not built)
COPY packages/paged-preview/package.json packages/paged-preview/
COPY packages/template-kit/package.json packages/template-kit/
COPY docs/package.json docs/
COPY prototypes/clickdummy/package.json prototypes/clickdummy/
COPY prototypes/clickdummy-v2/package.json prototypes/clickdummy-v2/
RUN --mount=type=cache,id=openbill-pnpm-store,target=/pnpm-store \
    pnpm install --frozen-lockfile --store-dir /pnpm-store

COPY vite.config.ts tsconfig.json ./
COPY resources ./resources
COPY packages ./packages
# app assets and the template kit (root script "build")
RUN pnpm build

# ---------------------------------------------------------------------------------------------------------------------
# app: PHP-FPM + nginx (serversideup), runs as www-data on port 8080
# ---------------------------------------------------------------------------------------------------------------------
FROM serversideup/php:8.4-fpm-nginx-v4.5.1@sha256:8e0864511c48a943b59c59c2845eb8de1dc402b6d549a3b2e0e45018f1b99567 AS app

LABEL org.opencontainers.image.title="openbill" \
      org.opencontainers.image.description="Self-hosted quotes and invoices with custom fields, Liquid templates and EN 16931 e-invoices." \
      org.opencontainers.image.source="https://github.com/baeroe/openbill" \
      org.opencontainers.image.licenses="MIT"

# Template uploads carry up to 30 MB (config openbill.api.max_template_body_bytes): nginx and PHP must let them through
# to LimitApiBody. Rendering may add 128 MB (openbill.rendering.max_memory_bytes) on top of the request: 512M.
ENV AUTORUN_ENABLED=false \
    SSL_MODE=off \
    PHP_OPCACHE_ENABLE=1 \
    PHP_MEMORY_LIMIT=512M \
    PHP_POST_MAX_SIZE=32M \
    PHP_UPLOAD_MAX_FILE_SIZE=32M \
    NGINX_CLIENT_MAX_BODY_SIZE=32M \
    APP_NAME=openbill \
    APP_ENV=production \
    APP_DEBUG=false \
    LOG_CHANNEL=stderr \
    LOG_LEVEL=info \
    DB_CONNECTION=mariadb \
    DB_HOST=mariadb \
    DB_PORT=3306 \
    DB_DATABASE=openbill \
    DB_USERNAME=openbill \
    SESSION_DRIVER=database \
    CACHE_STORE=database \
    QUEUE_CONNECTION=sync \
    MAIL_MAILER=log \
    GOTENBERG_URL=http://gotenberg:3000

USER root
# intl (numbering, slugs), bcmath (brick/math), gd (fpdf inside horstoeko/zugferd), apcu (API Platform metadata cache);
# pdo_mysql, zip, dom, simplexml, fileinfo, mbstring come with the base image
RUN install-php-extensions intl bcmath gd apcu
USER www-data
WORKDIR /var/www/html

# dependencies first (cached while composer.lock is unchanged), the autoloader after the code is in place
COPY --chown=www-data:www-data composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --no-progress --prefer-dist --no-scripts --no-autoloader

COPY --chown=www-data:www-data artisan ./
COPY --chown=www-data:www-data app ./app
COPY --chown=www-data:www-data bootstrap ./bootstrap
COPY --chown=www-data:www-data config ./config
COPY --chown=www-data:www-data database ./database
COPY --chown=www-data:www-data lang ./lang
COPY --chown=www-data:www-data public ./public
COPY --chown=www-data:www-data resources ./resources
COPY --chown=www-data:www-data routes ./routes
# read at runtime by the MCP resource openbill://docs/liquid-reference
COPY --chown=www-data:www-data docs/en/templates.md ./docs/en/templates.md
COPY --chown=www-data:www-data --from=assets /app/public/build ./public/build
COPY --chown=www-data:www-data --from=assets /app/packages/template-kit/dist/kit ./packages/template-kit/dist/kit

# storage/app is the data volume: created here, so a new named volume starts out owned by www-data.
# dump-autoload runs the post-autoload-dump scripts (package discovery, Swagger UI assets in public/vendor).
RUN mkdir -p storage/app storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && composer dump-autoload --no-dev --optimize --no-interaction
```

- [ ] **Step 5: Test grün**

Run: `ddev artisan test --filter=DockerSetupTest`
Expected: PASS (7 Tests).

- [ ] **Step 6: Build-Kontext prüfen (Wegwerf-Build, listet, was Docker sieht)**

Run:
```bash
printf 'FROM busybox:1.37\nCOPY . /ctx\nRUN cd /ctx && find . -maxdepth 3 -not -path "./resources/*" -not -path "./app/*" -not -path "./packages/*/src*" | sort\n' \
  | docker build --no-cache --progress=plain -f - . 2>&1 | grep -E '^#[0-9]+ [0-9.]+ \./' | sed -E 's/^#[0-9]+ [0-9.]+ //' > "${TMPDIR:-/tmp}/openbill-context.txt"
grep -E '^\./(docs|prototypes|storage|vendor|e2e|tests|\.env|\.git|\.ddev)(/|$)' "${TMPDIR:-/tmp}/openbill-context.txt"
```
Expected (genau diese Zeilen, Reihenfolge egal; kein `.env`, `.git`, `.ddev`, `vendor`, `storage`, `e2e`, `tests`):
```
./docs
./docs/en
./docs/en/templates.md
./docs/package.json
./prototypes
./prototypes/clickdummy
./prototypes/clickdummy-v2
./prototypes/clickdummy-v2/package.json
./prototypes/clickdummy/package.json
```
Weicht es ab: `.dockerignore` korrigieren, bis die Liste stimmt (Ausnahmen mit `!` greifen nur, wenn der Elternordner nicht ganz ausgeschlossen ist – deshalb `docs/*` statt `docs`).

- [ ] **Step 7: Image bauen (nativ arm64 unter Colima)**

Run: `docker build -t openbill:local . 2>&1 | tail -n 5`
Expected: endet mit `naming to docker.io/library/openbill:local` (bzw. `… done`). Dauer beim ersten Mal einige Minuten (Extensions werden kompiliert).

Falls `pnpm install --frozen-lockfile` mit `ERR_PNPM_OUTDATED_LOCKFILE` scheitert: `ls -d packages/*/ prototypes/*/` mit den `COPY …/package.json`-Zeilen der Node-Stage abgleichen (jeder Workspace-Ordner braucht seine Zeile). Falls `install-php-extensions` scheitert: Fehlermeldung lesen; die Extensions-Liste nicht kürzen, sondern fehlende Systempakete melden (Nutzer fragen).

- [ ] **Step 8: Image prüfen**

Run:
```bash
docker image inspect openbill:local --format '{{.Os}}/{{.Architecture}} user={{.Config.User}}'
docker run --rm --entrypoint sh openbill:local -c '
  php -m | grep -E "^(intl|bcmath|gd|apcu|pdo_mysql|zip|dom|fileinfo|mbstring)$" | sort | tr "\n" " "; echo
  php -r "echo ini_get(\"post_max_size\"), \" \", ini_get(\"upload_max_filesize\"), \" \", ini_get(\"memory_limit\"), PHP_EOL;"
  test -f docs/en/templates.md && test -f public/build/manifest.json && test -f packages/template-kit/dist/kit/tooling/cli.js && test -f packages/template-kit/dist/kit/package.json && echo files-ok
  test -d public/vendor/api-platform && echo swagger-ok
  test ! -e .env && test ! -d tests && test ! -d node_modules && test ! -d vendor/pestphp && echo lean-ok
  stat -c "%U %a" storage/app
  id -un'
```
Expected:
```
linux/arm64 user=www-data
apcu bcmath dom fileinfo gd intl mbstring pdo_mysql zip 
32M 32M 512M
files-ok
swagger-ok
lean-ok
www-data 755
www-data
```
(serversideups `php.ini` liest die `PHP_*`-Variablen direkt – geprüft: `PHP_POST_MAX_SIZE=32M` ergibt `ini_get('post_max_size') = 32M` auch ohne Entrypoint. Die nginx-Seite prüft Task 4 per curl.)

- [ ] **Step 9: Statische Prüfungen**

Run: `ddev exec vendor/bin/pint --test tests/Feature/DockerSetupTest.php && ddev exec vendor/bin/phpstan analyse --memory-limit=1G`
Expected: `PASS` bzw. `[OK] No errors`.

- [ ] **Step 10: Commit**

```bash
git add Dockerfile .dockerignore tests/Feature/DockerSetupTest.php
git commit -m "feat: add Dockerfile with pnpm asset stage and serversideup PHP 8.4" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Entrypoint `docker/entrypoint.d/99-openbill.sh`

**Files:**
- Create: `docker/entrypoint.d/99-openbill.sh` (ausführbar)
- Modify: `Dockerfile` (Zeile `COPY --chmod=755 docker/entrypoint.d/ /etc/entrypoint.d/` im `USER root`-Block)
- Test: `tests/Feature/DockerSetupTest.php` (anhängen)

**Interfaces:**
- Consumes: `php artisan app:sync-templates`, `php artisan app:ensure-admin` (liest `ADMIN_EMAIL`/`ADMIN_PASSWORD`, überspringt ohne, Exit 1 bei ungültiger E-Mail/Passwort < 8), Env `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `APP_KEY`.
- Produces: Env `DB_WAIT_TIMEOUT` (Sekunden, Standard 60), Datei `storage/app/.app-key` (0600, im Volume), Log-Zeilen mit Präfix `openbill: ` (u. a. `openbill: database <host>:<port> not reachable after <n>s: …`, `openbill: generated APP_KEY in storage/app/.app-key (data volume)`, `openbill: ready`).

- [ ] **Step 1: Failing Tests anhängen** (ans Ende von `tests/Feature/DockerSetupTest.php`; `use`-Zeile oben in die Datei nach `<?php` setzen)

```php
use Symfony\Component\Process\Process;
```

```php
it('starts through the openbill entrypoint script in the right order', function () {
    $path = 'docker/entrypoint.d/99-openbill.sh';
    $script = dockerRepoFile($path);
    $steps = [
        'mkdir -p storage/app/private storage/app/public storage/app/archive',
        'KEY_FILE=storage/app/.app-key',
        'php artisan config:clear',
        'DB_WAIT_TIMEOUT',
        'php artisan migrate --force',
        'php artisan app:sync-templates',
        'php artisan app:ensure-admin',
        'php artisan optimize',
    ];
    $positions = array_map(fn (string $step): int|false => strpos($script, $step), $steps);
    $sorted = $positions;
    sort($sorted);

    expect(is_executable(base_path($path)))->toBeTrue()
        ->and(dockerRepoFile('Dockerfile'))->toContain('COPY --chmod=755 docker/entrypoint.d/ /etc/entrypoint.d/')
        ->and($positions)->not->toContain(false)
        ->and($positions)->toBe($sorted);
});

it('has an entrypoint script a POSIX shell accepts', function () {
    $process = new Process(['sh', '-n', base_path('docker/entrypoint.d/99-openbill.sh')]);
    $process->run();

    expect($process->getExitCode())->toBe(0, $process->getErrorOutput());
});
```

- [ ] **Step 2: Fehlschlag prüfen**

Run: `ddev artisan test --filter=DockerSetupTest`
Expected: FAIL – `docker/entrypoint.d/99-openbill.sh is missing`.

- [ ] **Step 3: Skript anlegen**

`docker/entrypoint.d/99-openbill.sh`:

```sh
#!/bin/sh
# openbill start-up. serversideup's entrypoint runs every /etc/entrypoint.d/*.sh in order before nginx and PHP-FPM
# start, each sourced in a subshell: exported variables never reach PHP-FPM, which is why the config cache at the
# end (it contains APP_KEY) is what PHP-FPM reads. Any failing step stops the container with a message, so a
# half-migrated instance never serves requests.
set -e
cd /var/www/html

log() { echo "openbill: $*"; }

# 1. data volume (storage/app): folders of the disks local (private), public and archive
mkdir -p storage/app/private storage/app/public storage/app/archive

# 2. APP_KEY from the environment; otherwise generated once and kept in the data volume (survives new containers)
if [ -z "${APP_KEY:-}" ]; then
    KEY_FILE=storage/app/.app-key
    if [ ! -s "$KEY_FILE" ]; then
        (umask 077 && php -r 'echo "base64:".base64_encode(random_bytes(32));' > "$KEY_FILE")
        log "generated APP_KEY in $KEY_FILE (data volume)"
    fi
    APP_KEY=$(cat "$KEY_FILE")
    export APP_KEY
fi

# 3. a config cache from an earlier start of this container would hide changed environment variables
php artisan config:clear --no-interaction > /dev/null

# 4. wait for the database (first start: MariaDB initialises; external databases may be slow)
timeout=${DB_WAIT_TIMEOUT:-60}
waited=0
until php -r '
    $dsn = sprintf("mysql:host=%s;port=%s", getenv("DB_HOST") ?: "mariadb", getenv("DB_PORT") ?: "3306");
    try {
        new PDO($dsn, (string) getenv("DB_USERNAME"), (string) getenv("DB_PASSWORD"), [PDO::ATTR_TIMEOUT => 3]);
    } catch (Throwable $e) {
        fwrite(STDERR, $e->getMessage());
        exit(1);
    }
' 2> /tmp/openbill-db-wait; do
    if [ "$waited" -ge "$timeout" ]; then
        log "database ${DB_HOST:-mariadb}:${DB_PORT:-3306} not reachable after ${timeout}s: $(cat /tmp/openbill-db-wait)" >&2
        exit 1
    fi
    sleep 2
    waited=$((waited + 2))
done

# 5. schema, the built-in templates in the version of this image, the owner account (only created once)
php artisan migrate --force --no-interaction
php artisan app:sync-templates --no-interaction
php artisan app:ensure-admin --no-interaction

# 6. caches for production: config (with APP_KEY), routes, views, events
php artisan optimize --no-interaction
log "ready"
```

Run: `chmod +x docker/entrypoint.d/99-openbill.sh`

- [ ] **Step 4: Dockerfile ergänzen**

In `Dockerfile` im Block

```dockerfile
USER root
# intl (numbering, slugs), bcmath (brick/math), gd (fpdf inside horstoeko/zugferd), apcu (API Platform metadata cache);
# pdo_mysql, zip, dom, simplexml, fileinfo, mbstring come with the base image
RUN install-php-extensions intl bcmath gd apcu
USER www-data
```

die Zeile vor `USER www-data` ergänzen, sodass der Block so aussieht:

```dockerfile
USER root
# intl (numbering, slugs), bcmath (brick/math), gd (fpdf inside horstoeko/zugferd), apcu (API Platform metadata cache);
# pdo_mysql, zip, dom, simplexml, fileinfo, mbstring come with the base image
RUN install-php-extensions intl bcmath gd apcu
# start-up: wait for the database, APP_KEY, migrations, built-in templates, owner, caches
COPY --chmod=755 docker/entrypoint.d/ /etc/entrypoint.d/
USER www-data
```

- [ ] **Step 5: Tests grün**

Run: `ddev artisan test --filter=DockerSetupTest`
Expected: PASS (9 Tests).

- [ ] **Step 6: shellcheck**

Run: `docker run --rm -v "$PWD/docker:/mnt:ro" koalaman/shellcheck:v0.10.0 -s sh /mnt/entrypoint.d/99-openbill.sh && echo clean`
Expected: `clean`. (SC2016 für die einfachen Quotes um den PHP-Code ist gewollt; meldet shellcheck ihn, die Zeile darüber mit `# shellcheck disable=SC2016` versehen und erneut prüfen.)

- [ ] **Step 7: Image neu bauen und den Start ohne Datenbank prüfen (Review Focus 2)**

Run:
```bash
docker build -q -t openbill:local . && \
time docker run --rm -e DB_HOST=db.invalid -e DB_WAIT_TIMEOUT=4 -e APP_URL=http://localhost:7739 openbill:local; echo "exit=$?"
```
Expected: nach ~4–6 s eine Zeile
`openbill: generated APP_KEY in storage/app/.app-key (data volume)`, dann
`openbill: database db.invalid:3306 not reachable after 4s: SQLSTATE[HY000] [2002] php_network_getaddresses: getaddrinfo for db.invalid failed: …`
und `exit=1` (oder ein anderer Wert ≠ 0) – der Container startet nginx/FPM **nicht**.

- [ ] **Step 8: Commit**

```bash
git add docker/entrypoint.d/99-openbill.sh Dockerfile tests/Feature/DockerSetupTest.php
git commit -m "feat: add container entrypoint (db wait, APP_KEY, migrate, templates, admin, optimize)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `docker-compose.yml` und `.env.docker.example`

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.docker.example`
- Modify: `config/openbill.php` (zwei Kommentare)
- Test: `tests/Feature/DockerSetupTest.php` (anhängen)

**Interfaces:**
- Consumes: Image aus Task 2/3 (`OPENBILL_IMAGE=openbill:local` lokal), Entrypoint-Env `DB_WAIT_TIMEOUT`.
- Produces: Dienste `openbill`, `mariadb`, `gotenberg`; Netze `default`, `backend` (`internal: true`); Volumes `openbill-data`, `openbill-db`; Variablen `APP_URL`, `APP_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DB_PASSWORD`, `DB_ROOT_PASSWORD`, `OPENBILL_PORT`, `OPENBILL_IMAGE`. Abnahme-Ordner `${TMPDIR:-/tmp}/openbill-acceptance` (auch Task 11). Test-Helfer `dockerCompose(): array`.

- [ ] **Step 1: Failing Tests anhängen** (`use Symfony\Component\Yaml\Yaml;` oben zu den `use`-Zeilen)

```php
/** @return array<string, mixed> */
function dockerCompose(): array
{
    return Yaml::parse(dockerRepoFile('docker-compose.yml'));
}

it('runs openbill, MariaDB 11.4 and Gotenberg 8 with two persistent volumes', function () {
    $compose = dockerCompose();
    $services = $compose['services'];

    expect(array_keys($services))->toEqualCanonicalizing(['openbill', 'mariadb', 'gotenberg'])
        ->and($services['openbill']['image'])->toBe('${OPENBILL_IMAGE:-baeroe/openbill:latest}')
        ->and($services['openbill']['ports'])->toBe(['${OPENBILL_PORT:-7739}:8080'])
        ->and($services['openbill']['volumes'])->toBe(['openbill-data:/var/www/html/storage/app'])
        ->and($services['mariadb']['volumes'])->toBe(['openbill-db:/var/lib/mysql'])
        ->and(array_keys($compose['volumes']))->toEqualCanonicalizing(['openbill-data', 'openbill-db'])
        ->and($services['mariadb']['image'])->toMatch('/^mariadb:11\.4\.\d+@sha256:[0-9a-f]{64}$/')
        ->and($services['gotenberg']['image'])->toMatch('/^gotenberg\/gotenberg:8\.\d+\.\d+@sha256:[0-9a-f]{64}$/');
});

it('starts openbill only after MariaDB and Gotenberg report healthy', function () {
    $services = dockerCompose()['services'];

    expect($services['openbill']['depends_on'])->toBe([
        'mariadb' => ['condition' => 'service_healthy'],
        'gotenberg' => ['condition' => 'service_healthy'],
    ])
        ->and($services['mariadb']['healthcheck']['test'])->toContain('healthcheck.sh')
        ->and($services['gotenberg']['healthcheck']['test'])->toContain('http://localhost:3000/health');
});

it('lets MariaDB create the document lock triggers even with binary logging on', function () {
    expect(dockerCompose()['services']['mariadb']['command'])->toContain('--log-bin-trust-function-creators=1');
});

it('keeps MariaDB and Gotenberg off the host and the internet', function () {
    $compose = dockerCompose();

    foreach (['mariadb', 'gotenberg'] as $service) {
        expect($compose['services'][$service])->not->toHaveKey('ports')
            ->and($compose['services'][$service]['networks'])->toBe(['backend']);
    }
    expect($compose['networks']['backend']['internal'])->toBeTrue()
        ->and($compose['services']['openbill']['networks'])->toEqualCanonicalizing(['default', 'backend']);
});

it('runs Gotenberg with the same hardening flags as DDEV', function () {
    $ddev = Yaml::parse(dockerRepoFile('.ddev/docker-compose.gotenberg.yaml'));

    expect(dockerCompose()['services']['gotenberg']['command'])->toBe($ddev['services']['gotenberg']['command']);
});

it('documents every variable of the compose file in .env.docker.example', function () {
    preg_match_all('/\$\{([A-Z_]+)/', dockerRepoFile('docker-compose.yml'), $m);
    $example = dockerRepoFile('.env.docker.example');

    expect(array_unique($m[1]))->toEqualCanonicalizing(['OPENBILL_IMAGE', 'OPENBILL_PORT', 'APP_KEY', 'APP_URL', 'ADMIN_EMAIL', 'ADMIN_PASSWORD', 'DB_PASSWORD', 'DB_ROOT_PASSWORD']);
    foreach (array_unique($m[1]) as $name) {
        expect($example)->toMatch('/^#?\s*'.$name.'=/m');
    }
});
```

- [ ] **Step 2: Fehlschlag prüfen**

Run: `ddev artisan test --filter=DockerSetupTest`
Expected: FAIL – `docker-compose.yml is missing`.

- [ ] **Step 3: `docker-compose.yml` anlegen**

```yaml
# openbill, self-hosted: docs/en/setup.md. Put a .env next to this file (template: .env.docker.example).
# Data lives in the volumes openbill-data (documents' PDFs/XMLs, templates, uploads, the generated APP_KEY) and
# openbill-db (MariaDB). `docker compose down` keeps them, `docker compose down -v` deletes them.
services:
  openbill:
    image: ${OPENBILL_IMAGE:-baeroe/openbill:latest}
    restart: unless-stopped
    depends_on:
      mariadb:
        condition: service_healthy
      gotenberg:
        condition: service_healthy
    ports:
      - "${OPENBILL_PORT:-7739}:8080"
    environment:
      APP_URL: "${APP_URL:?APP_URL missing (public https address, see .env.docker.example)}"
      # optional: without it, a key is generated once and kept in the data volume
      APP_KEY: "${APP_KEY:-}"
      ADMIN_EMAIL: "${ADMIN_EMAIL:?ADMIN_EMAIL missing}"
      ADMIN_PASSWORD: "${ADMIN_PASSWORD:?ADMIN_PASSWORD missing}"
      DB_HOST: mariadb
      DB_DATABASE: openbill
      DB_USERNAME: openbill
      DB_PASSWORD: "${DB_PASSWORD:?DB_PASSWORD missing}"
      GOTENBERG_URL: http://gotenberg:3000
    volumes:
      - openbill-data:/var/www/html/storage/app
    networks:
      - default
      - backend

  mariadb:
    image: mariadb:11.4.13@sha256:1292844148b311e4ed4300022a996d39083f415a963e970cf47cad1b3b18e3a6
    restart: unless-stopped
    # Binary logging is off in this image. The document lock triggers need SUPER or this switch as soon as someone
    # turns it on (replication, point-in-time backups), so it is set either way.
    command:
      - --log-bin-trust-function-creators=1
    environment:
      MARIADB_DATABASE: openbill
      MARIADB_USER: openbill
      MARIADB_PASSWORD: "${DB_PASSWORD:?DB_PASSWORD missing}"
      MARIADB_ROOT_PASSWORD: "${DB_ROOT_PASSWORD:?DB_ROOT_PASSWORD missing}"
      # runs mariadb-upgrade after a new MariaDB patch version
      MARIADB_AUTO_UPGRADE: "1"
    volumes:
      - openbill-db:/var/lib/mysql
    healthcheck:
      test: ["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"]
      interval: 5s
      timeout: 5s
      retries: 20
      start_period: 30s
    networks:
      - backend

  # PDF rendering. Hardened like in development (.ddev/docker-compose.gotenberg.yaml): templates may come from untrusted
  # packages, so Chromium runs no JavaScript and loads nothing but Gotenberg's own files and data: URLs.
  gotenberg:
    image: gotenberg/gotenberg:8.37.0@sha256:f29984bd1e226bf1b93ba90af06000afa8b315853e99d27b9aaa41b93f15c769
    restart: unless-stopped
    command:
      - gotenberg
      - --chromium-disable-javascript=true
      - --chromium-deny-list=^file:(?!//\/tmp/).*
      - --chromium-deny-list=^(?!(file|data):).*
      - --chromium-deny-private-ips=true
      - --chromium-deny-public-ips=true
    healthcheck:
      test: ["CMD", "curl", "-fsS", "-o", "/dev/null", "http://localhost:3000/health"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 20s
    networks:
      - backend

networks:
  default:
  # MariaDB and Gotenberg: reachable from openbill only, no published ports, no internet access
  backend:
    internal: true

volumes:
  openbill-data:
  openbill-db:
```

- [ ] **Step 4: `.env.docker.example` anlegen**

```bash
# Copy to .env next to docker-compose.yml and change every value. Docs: docs/en/setup.md

# Public address of this instance, with https:// (reverse proxy in front, docs/en/reverse-proxy.md).
# Links, the allowed Host header and the toolkit download use it.
APP_URL=https://invoices.example.com

# Owner account, created on the first start only (password at least 8 characters).
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-me-please

# MariaDB passwords: set them before the first start, the database keeps them.
DB_PASSWORD=change-me-database
DB_ROOT_PASSWORD=change-me-root

# Host port (container port 8080). 127.0.0.1:7739 keeps it local when the reverse proxy runs on the same host.
OPENBILL_PORT=7739

# Pin a version instead of latest:
# OPENBILL_IMAGE=baeroe/openbill:0.1.0

# Optional: without it, a key is generated once and kept in the data volume.
# APP_KEY=
```

- [ ] **Step 5: Kommentare in `config/openbill.php` auflösen**

Ersetze

```php
    | Template toolkit (POST /{locale}/templates/{id}/toolkit): the built kit that goes into the ZIP.
    | `pnpm build` writes it to packages/template-kit/dist/kit – in DDEV and in the Docker image (phase 10).
```

durch

```php
    | Template toolkit (POST /{locale}/templates/{id}/toolkit): the built kit that goes into the ZIP.
    | `pnpm build` writes it to packages/template-kit/dist/kit – in DDEV and in the Docker image (Dockerfile, stage assets).
```

und

```php
    | 20 MB unpacked assets as base64 (× 4/3) plus four sources. Phase 10: nginx client_max_body_size
    | and PHP post_max_size at least max_template_body_bytes.
```

durch

```php
    | 20 MB unpacked assets as base64 (× 4/3) plus four sources. The Docker image lets 32M through nginx
    | (client_max_body_size) and PHP (post_max_size); DockerSetupTest keeps both at least max_template_body_bytes.
```

- [ ] **Step 6: Tests grün**

Run: `ddev artisan test --filter=DockerSetupTest`
Expected: PASS (15 Tests).

- [ ] **Step 7: Gotenberg-Image prüfen (curl für den Healthcheck vorhanden?)**

Run: `docker run --rm --entrypoint sh gotenberg/gotenberg:8.37.0@sha256:f29984bd1e226bf1b93ba90af06000afa8b315853e99d27b9aaa41b93f15c769 -c 'command -v curl && gotenberg --version 2>/dev/null | head -1'`
Expected: `/usr/bin/curl` und eine Zeile mit `8.37.0`. Fehlt curl: Healthcheck auf `["CMD", "gotenberg-healthcheck"]` o. ä. umstellen – erst mit `docker run --rm --entrypoint sh <image> -c 'ls /usr/bin | grep -i health'` nachsehen, Test in Step 1 anpassen.

- [ ] **Step 8: Digests gegen die Registry prüfen**

Run:
```bash
for i in mariadb:11.4.13 gotenberg/gotenberg:8.37.0 serversideup/php:8.4-fpm-nginx-v4.5.1 node:24-alpine3.24 eclipse-temurin:21-jre-noble; do
  printf '%s ' "$i"; docker buildx imagetools inspect "$i" --format '{{json .Manifest.Digest}}'; done
```
Expected: genau die Digests aus „Global Constraints“. Weicht einer ab (Tag wurde neu gebaut): den gepinnten Digest **nicht** ändern – er ist weiterhin gültig und abrufbar; nur bei `not found` den neuen Digest übernehmen und überall (Tasks 2, 4, 5) gleich setzen.

- [ ] **Step 9: Abnahme-Ordner wie bei einem Nutzer anlegen und Stack starten**

Run:
```bash
ACC="${TMPDIR:-/tmp}/openbill-acceptance"
rm -rf "$ACC" && mkdir -p "$ACC" && cp docker-compose.yml "$ACC/" && cp .env.docker.example "$ACC/.env"
cd "$ACC" && sed -i '' \
  -e 's#^APP_URL=.*#APP_URL=http://localhost:7739#' \
  -e 's#^ADMIN_PASSWORD=.*#ADMIN_PASSWORD=acceptance-admin-pw#' \
  -e 's#^DB_PASSWORD=.*#DB_PASSWORD=acceptance-db-pw#' \
  -e 's#^DB_ROOT_PASSWORD=.*#DB_ROOT_PASSWORD=acceptance-root-pw#' \
  -e 's@^# OPENBILL_IMAGE=.*@OPENBILL_IMAGE=openbill:local@' .env
docker compose -p openbill-acceptance up -d --wait --wait-timeout 300 && docker compose -p openbill-acceptance ps --format '{{.Service}} {{.Health}}'
```
Expected: `--wait` endet ohne Fehler, dann
```
gotenberg healthy
mariadb healthy
openbill healthy
```
(Ist 7739 belegt: `lsof -nP -iTCP:7739 -sTCP:LISTEN` – fremden Dienst nicht beenden, Nutzer fragen.)

- [ ] **Step 10: Start-Log und Datenbank prüfen**

Run:
```bash
cd "${TMPDIR:-/tmp}/openbill-acceptance"
docker compose -p openbill-acceptance logs openbill | grep -E 'openbill:|Admin user|Built-in templates|DONE|FAIL' | head -20
docker compose -p openbill-acceptance exec -T mariadb sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" -N -e "SELECT @@log_bin, @@log_bin_trust_function_creators; SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = \"openbill\";"'
docker compose -p openbill-acceptance exec -T openbill sh -c 'ls -la storage/app; stat -c "%a %U" storage/app/.app-key; php -d apc.enable_cli=1 -r "var_dump(extension_loaded(\"apcu\"));"'
```
Expected: Log enthält `openbill: generated APP_KEY in storage/app/.app-key (data volume)`, Migrationen `DONE`, `Built-in templates: klar, kante, leise`, `Admin user admin@example.com created.`, `openbill: ready`; MariaDB `0	1` und eine Trigger-Zahl > 0 (gleich der Zahl aus `ddev mysql -N -e 'SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA="db"'`); `storage/app` mit `archive`, `private`, `public`, `.app-key` (`600 www-data`); `bool(true)`.

- [ ] **Step 11: HTTP, Host-Prüfung, APCu-Cache und Body-Limits (Review Focus 3 und 4)**

Run:
```bash
B=http://localhost:7739
curl -s -o /dev/null -w 'login %{http_code}\n' "$B/en/login"
curl -s -o /dev/null -w 'foreign host %{http_code}\n' -H 'Host: evil.example' "$B/en/login"
curl -s -o /dev/null -w 'healthcheck %{http_code}\n' "$B/healthcheck"
for n in 1 2; do curl -s "$B/api/docs.jsonopenapi" | jq -r .info.title; done
head -c 34000000 /dev/zero | curl -s -o /dev/null -w 'nginx 34MB %{http_code}\n' -X POST -H 'Content-Type: application/json' --data-binary @- "$B/api/documents"
head -c 29000000 /dev/zero | curl -s -o /dev/null -w 'templates 29MB %{http_code}\n' -X POST -H 'Content-Type: application/json' -H 'Accept: application/json' --data-binary @- "$B/api/templates"
head -c 25000000 /dev/zero | curl -s -w '\n' -X POST -H 'Content-Type: application/json' -H 'Accept: application/json' --data-binary @- "$B/api/documents" | jq -r '.status, .reason // .type'
```
Expected:
```
login 200
foreign host 400
healthcheck 200
openbill API
openbill API
nginx 34MB 413
templates 29MB 401
413
payload_too_large
```
(Die letzte Zeile kann statt `reason` den Typ-URI mit `payload_too_large` zeigen – entscheidend: `413` aus `LimitApiBody` mit Problem Details, nicht die HTML-Seite von nginx. `templates 29MB 401` zeigt, dass nginx und PHP 29 MB bis zur App durchlassen.)

- [ ] **Step 12: Probe mit eingeschaltetem Binlog (Review Focus 5)**

Run:
```bash
cd "${TMPDIR:-/tmp}/openbill-acceptance"
cat > binlog.override.yml <<'EOF'
services:
  mariadb:
    command: ["--log-bin=mariadb-bin", "--log-bin-trust-function-creators=1"]
EOF
docker compose -p openbill-binlog -f docker-compose.yml -f binlog.override.yml up -d --wait --wait-timeout 300 mariadb
docker compose -p openbill-binlog -f docker-compose.yml -f binlog.override.yml run --rm --no-deps -e DB_WAIT_TIMEOUT=30 --entrypoint sh openbill -c 'php artisan migrate --force --no-interaction > /dev/null && echo migrated'
docker compose -p openbill-binlog -f docker-compose.yml -f binlog.override.yml exec -T mariadb sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" -N -e "SELECT @@log_bin"'
docker compose -p openbill-binlog -f docker-compose.yml -f binlog.override.yml down -v
rm binlog.override.yml
```
Expected: `migrated`, dann `1` (Binlog war an). Hinweis: `run --entrypoint sh` überspringt das Entrypoint-Skript; `APP_KEY` braucht `migrate` nicht.

- [ ] **Step 13: Stack stoppen (Task 11 legt alles neu an)**

Run: `cd "${TMPDIR:-/tmp}/openbill-acceptance" && docker compose -p openbill-acceptance down -v`
Expected: Container, Netze und beide Volumes `Removed`.

- [ ] **Step 14: Commit**

```bash
git add docker-compose.yml .env.docker.example config/openbill.php tests/Feature/DockerSetupTest.php
git commit -m "feat: add docker compose stack with MariaDB 11.4 and hardened Gotenberg 8" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Digests in DDEV, CI und Skript; einvoice-Artefakte cachen

**Files:**
- Modify: `.ddev/docker-compose.gotenberg.yaml` (Zeile `image: gotenberg/gotenberg:8`)
- Modify: `.github/workflows/tests.yml` (MariaDB-Service `image`, Gotenberg-`docker run`, Job `einvoice`)
- Modify: `scripts/validate-einvoice.sh` (Zeile `JAVA_IMAGE=…`)
- Test: `tests/Feature/DockerSetupTest.php` (anhängen)

**Interfaces:**
- Consumes: `dockerCompose()`, `dockerRepoFile()` aus Task 2/4.
- Produces: gleiche Image-Strings in DDEV/CI/Compose; Cache-Schlüssel `einvoice-validator-<hash>`.

- [ ] **Step 1: Failing Tests anhängen**

```php
it('uses the same pinned Gotenberg and MariaDB images in DDEV, CI and Compose', function () {
    $services = dockerCompose()['services'];
    $ddev = Yaml::parse(dockerRepoFile('.ddev/docker-compose.gotenberg.yaml'));
    $ci = Yaml::parse(dockerRepoFile('.github/workflows/tests.yml'));

    expect($ddev['services']['gotenberg']['image'])->toBe($services['gotenberg']['image'])
        ->and($ci['jobs']['tests']['services']['mariadb']['image'])->toBe($services['mariadb']['image'])
        ->and(dockerRepoFile('.github/workflows/tests.yml'))->toContain('docker run -d --name gotenberg -p 3000:3000 '.$services['gotenberg']['image'].' gotenberg');
});

it('starts Gotenberg in CI with the hardening flags of DDEV', function () {
    $flags = array_slice(Yaml::parse(dockerRepoFile('.ddev/docker-compose.gotenberg.yaml'))['services']['gotenberg']['command'], 1);
    $workflow = dockerRepoFile('.github/workflows/tests.yml');

    expect($flags)->toHaveCount(5);
    foreach ($flags as $flag) {
        expect($workflow)->toContain($flag);
    }
});

it('pins the Java image of the e-invoice validator', function () {
    preg_match('/^JAVA_IMAGE=(\S+)$/m', dockerRepoFile('scripts/validate-einvoice.sh'), $m);

    expect($m[1] ?? '')->toMatch('/^eclipse-temurin:21[\w.-]*@sha256:[0-9a-f]{64}$/');
});
```

- [ ] **Step 2: Fehlschlag prüfen**

Run: `ddev artisan test --filter=DockerSetupTest`
Expected: FAIL in den drei neuen Tests (`gotenberg/gotenberg:8` ≠ gepinnter String, `mariadb:11.4` ≠ …, `eclipse-temurin:21-jre` ohne Digest).

- [ ] **Step 3: DDEV pinnen**

In `.ddev/docker-compose.gotenberg.yaml` ersetze `    image: gotenberg/gotenberg:8` durch

```yaml
    # pinned like docker-compose.yml and CI (tests/Feature/DockerSetupTest.php keeps them equal)
    image: gotenberg/gotenberg:8.37.0@sha256:f29984bd1e226bf1b93ba90af06000afa8b315853e99d27b9aaa41b93f15c769
```

und in der Kopfzeile `# Keep the flags in sync with the gotenberg step in .github/workflows/tests.yml.` durch
`# Keep image and flags in sync with docker-compose.yml and the gotenberg step in .github/workflows/tests.yml (DockerSetupTest).`

- [ ] **Step 4: CI pinnen**

In `.github/workflows/tests.yml`:

```yaml
      mariadb:
        image: mariadb:11.4
```
→
```yaml
      mariadb:
        image: mariadb:11.4.13@sha256:1292844148b311e4ed4300022a996d39083f415a963e970cf47cad1b3b18e3a6
```

und

```yaml
          docker run -d --name gotenberg -p 3000:3000 gotenberg/gotenberg:8 gotenberg
```
→
```yaml
          docker run -d --name gotenberg -p 3000:3000 gotenberg/gotenberg:8.37.0@sha256:f29984bd1e226bf1b93ba90af06000afa8b315853e99d27b9aaa41b93f15c769 gotenberg
```

Kommentar darüber anpassen: `# … – same image and flags as docker-compose.yml and .ddev/docker-compose.gotenberg.yaml (DockerSetupTest)`.

- [ ] **Step 5: einvoice-Cache**

Im Job `einvoice` zwischen `actions/download-artifact` und `EN 16931 Schematron` einfügen:

```yaml
      # Schematron, Saxon-HE and xmlresolver: downloaded once per version of the script (it pins URLs and SHA-256),
      # so a flaky download source only hurts the first run after a version bump
      - uses: actions/cache@v4
        with:
          path: storage/framework/testing/einvoice-validator
          key: einvoice-validator-${{ hashFiles('scripts/validate-einvoice.sh') }}
```

- [ ] **Step 6: Java-Image pinnen**

In `scripts/validate-einvoice.sh`: `JAVA_IMAGE=eclipse-temurin:21-jre` → `JAVA_IMAGE=eclipse-temurin:21-jre-noble@sha256:000fd431958bc81a24abe1e8e5f0f0fd3ae365a594bd50aadb20696805f9408c`

- [ ] **Step 7: Tests grün**

Run: `ddev artisan test --filter=DockerSetupTest`
Expected: PASS (18 Tests).

- [ ] **Step 8: DDEV mit gepinntem Gotenberg neu starten und Schematron lokal laufen lassen**

Run: `ddev restart && ddev artisan test --testsuite=Integration --group=gotenberg && scripts/validate-einvoice.sh | tail -n 1`
Expected: Gotenberg-Tests PASS (`GotenbergTest` prüft Version ≥ 8.34), letzte Zeile `EN 16931 CII Schematron 1.3.16: 0 fatal error(s)`.

- [ ] **Step 9: Workflow-Syntax prüfen**

Run: `docker run --rm -v "$PWD:/repo:ro" -w /repo rhysd/actionlint:1.7.7 -color .github/workflows/tests.yml && echo clean`
Expected: `clean`.

- [ ] **Step 10: Commit**

```bash
git add .ddev/docker-compose.gotenberg.yaml .github/workflows/tests.yml scripts/validate-einvoice.sh tests/Feature/DockerSetupTest.php
git commit -m "ci: pin Gotenberg, MariaDB and Java images by digest, cache e-invoice validator" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Playwright gegen den Compose-Stack

**Files:**
- Create: `e2e/compose.sh` (ausführbar), `e2e/compose.env`, `e2e/docker-compose.e2e.yml`
- Modify: `e2e/global-setup.ts`, `e2e/playwright.config.ts` (Kommentar)

**Interfaces:**
- Consumes: `docker-compose.yml` (Task 4), Image-Tag `openbill:e2e`, Seeder `Database\Seeders\DemoSeeder` und `E2eUserSeeder` (verweigern nur `production`).
- Produces: `e2e/compose.sh <compose-args>` (Projekt `openbill-e2e`, Port 7739, `APP_ENV=e2e`), Env `E2E_ARTISAN` (Befehlspräfix, durch Leerzeichen getrennt; Standard `ddev artisan`), `OPENBILL_URL=http://localhost:7739`. Task 7 (CI) nutzt genau diese Namen.

- [ ] **Step 1: Prüfen, dass die Seeder ohne Dev-Abhängigkeiten laufen**

Run: `grep -nE 'factory\(|fake\(|Faker|::factory' database/seeders/DemoSeeder.php database/seeders/E2eUserSeeder.php; echo "matches=$?"`
Expected: keine Treffer, `matches=1`. (Gibt es Treffer, die Stelle auf feste Werte umstellen, bevor es weitergeht – `composer install --no-dev` hat kein Faker.)

- [ ] **Step 2: `e2e/docker-compose.e2e.yml` anlegen**

```yaml
# Overrides for the Playwright run against the Compose stack (e2e/compose.sh, CI job e2e). The seeders (DemoSeeder,
# E2eUserSeeder) refuse APP_ENV=production, so the stack runs as "e2e"; everything else – image, entrypoint,
# MariaDB, hardened Gotenberg, trusted hosts – is the production setup from docker-compose.yml.
services:
  openbill:
    environment:
      APP_ENV: e2e
```

- [ ] **Step 3: `e2e/compose.env` anlegen** (fiktive Testwerte, keine Geheimnisse)

```bash
# Environment of the Playwright stack (e2e/compose.sh). Test values only, never used for a real instance.
APP_URL=http://localhost:7739
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=e2e-admin-password
DB_PASSWORD=e2e-db-password
DB_ROOT_PASSWORD=e2e-root-password
OPENBILL_PORT=7739
OPENBILL_IMAGE=openbill:e2e
```

- [ ] **Step 4: `e2e/compose.sh` anlegen**

```sh
#!/bin/sh
# docker compose for the Playwright stack: the production docker-compose.yml plus e2e/docker-compose.e2e.yml, with its
# own project name and env file, so neither the .env of DDEV nor another stack gets in the way.
#
#   docker build -t openbill:e2e .
#   e2e/compose.sh up -d --wait --wait-timeout 300
#   OPENBILL_URL=http://localhost:7739 E2E_ARTISAN="e2e/compose.sh exec -T openbill php artisan" pnpm --dir e2e test
#   e2e/compose.sh down -v
set -e
cd "$(dirname "$0")/.."
exec docker compose -p openbill-e2e --env-file e2e/compose.env -f docker-compose.yml -f e2e/docker-compose.e2e.yml "$@"
```

Run: `chmod +x e2e/compose.sh`

- [ ] **Step 5: `e2e/global-setup.ts` ersetzen** (ganze Datei)

```ts
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

/**
 * Fresh demo data and the e2e login before the run (E2E_SKIP_SEED=1 skips it).
 * Artisan runs in DDEV by default. E2E_ARTISAN replaces the command, e.g. for the Compose stack (CI job e2e):
 *   E2E_ARTISAN="e2e/compose.sh exec -T openbill php artisan"
 */
export default function globalSetup(): void {
    // against DDEV, assets and the template kit come from this working copy; another instance (OPENBILL_URL) has its own
    if (!process.env.OPENBILL_URL) {
        if (!existsSync(path.join(root, 'public/hot')) && !existsSync(path.join(root, 'public/build/manifest.json'))) {
            throw new Error('No frontend assets: run `ddev exec pnpm build` (or keep `ddev exec pnpm dev` running) first.');
        }
        // the toolkit download (toolkit.spec.ts) packs packages/template-kit/dist/kit
        if (!existsSync(path.join(root, 'packages/template-kit/dist/kit/tooling/cli.js'))) {
            throw new Error('No template kit: run `ddev exec pnpm build` (or `ddev exec pnpm --filter @openbill/template-kit build`) first.');
        }
    }
    if (process.env.E2E_SKIP_SEED) return;

    const [command, ...prefix] = (process.env.E2E_ARTISAN ?? 'ddev artisan').split(/\s+/).filter(Boolean);
    const artisan = (...args: string[]) => execFileSync(command, [...prefix, ...args], { cwd: root, stdio: 'inherit' });
    artisan('db:seed', '--class=DemoSeeder', '--no-interaction');
    artisan('db:seed', '--class=E2eUserSeeder', '--no-interaction');
}
```

- [ ] **Step 6: Kommentar in `e2e/playwright.config.ts`**

Ersetze `// The app runs in DDEV, Playwright on the Mac. Phase 10 points it at the Compose stack via OPENBILL_URL.` durch

```ts
// The app runs in DDEV, Playwright on the Mac. OPENBILL_URL points it at another instance, e.g. the Compose stack
// (http://localhost:7739 with E2E_ARTISAN, see e2e/compose.sh and the CI job e2e).
```

- [ ] **Step 7: Image und Stack bauen/starten**

Run: `docker build -q -t openbill:e2e . && e2e/compose.sh up -d --wait --wait-timeout 300 && e2e/compose.sh ps --format '{{.Service}} {{.Health}}'`
Expected: drei Zeilen `… healthy`.

- [ ] **Step 8: Suite gegen den Stack (inkl. Toolkit)**

Run: `OPENBILL_URL=http://localhost:7739 E2E_ARTISAN="e2e/compose.sh exec -T openbill php artisan" pnpm --dir e2e test 2>&1 | tail -n 15`
Expected: Seeder-Ausgabe (`Database\Seeders\DemoSeeder … DONE`, `E2eUserSeeder … DONE`), dann alle Tests `passed`, `0 failed` – gleiche Anzahl wie gegen DDEV (`pnpm --dir e2e exec playwright test --list | tail -n 1` zeigt sie).

Schlägt ein Test fehl: Ursache suchen (`e2e/test-results/*/trace.zip` mit `pnpm --dir e2e exec playwright show-trace …`, `e2e/compose.sh logs openbill`). Typische Kandidaten und richtige Reaktion:
- 400 bei Seitenaufrufen → Test oder Kit nutzt einen anderen Host als `localhost` (z. B. `127.0.0.1`): im Test `baseURL` nutzen, nicht den Trusted Host aufweichen.
- 419/401 bei API-Aufrufen mit Sitzung → `Referer` fehlt; Helfer aus `e2e/tests/helpers.ts` verwenden.
- Toolkit: `OPENBILL_URL` im ZIP muss `http://localhost:7739` sein (`APP_URL` aus `e2e/compose.env`).
Jeder Fix bekommt einen eigenen Commit; Tests nicht lockern, nur weil der Stack anders ist.

- [ ] **Step 9: Stack entfernen**

Run: `e2e/compose.sh down -v`
Expected: alles `Removed`.

- [ ] **Step 10: Commit**

```bash
git add e2e/compose.sh e2e/compose.env e2e/docker-compose.e2e.yml e2e/global-setup.ts e2e/playwright.config.ts
git commit -m "test: run Playwright against the Compose stack (E2E_ARTISAN, e2e/compose.sh)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: CI-Job `e2e`

**Files:**
- Modify: `.github/workflows/tests.yml` (neuer Job am Ende)

**Interfaces:**
- Consumes: `e2e/compose.sh`, `e2e/compose.env` (`OPENBILL_IMAGE=openbill:e2e`), `E2E_ARTISAN`, `OPENBILL_URL` aus Task 6.
- Produces: Job `e2e` (kein Pflicht-Check), Artefakt `e2e-results` (nur bei Fehlern: `compose.log`, `e2e/test-results`).

- [ ] **Step 1: Job anhängen** (ans Ende von `.github/workflows/tests.yml`, gleiche Einrückung wie `einvoice:`)

```yaml
  # Playwright against the Compose stack built from this commit: production image, MariaDB, hardened Gotenberg,
  # APP_ENV=e2e only so the seeders run (e2e/docker-compose.e2e.yml). Not a required check.
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 45
    env:
      OPENBILL_URL: http://localhost:7739
      E2E_ARTISAN: e2e/compose.sh exec -T openbill php artisan
    steps:
      - uses: actions/checkout@v4

      - uses: docker/setup-buildx-action@v3

      - name: Image
        uses: docker/build-push-action@v6
        with:
          context: .
          load: true
          tags: openbill:e2e
          cache-from: type=gha,scope=e2e
          cache-to: type=gha,scope=e2e,mode=max

      - name: Compose stack
        run: e2e/compose.sh up -d --wait --wait-timeout 300

      # version comes from "packageManager" in package.json (same as e2e/package.json)
      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version-file: .node-version
          cache: pnpm
          cache-dependency-path: e2e/pnpm-lock.yaml

      - name: Playwright
        run: |
          pnpm --dir e2e install --frozen-lockfile
          pnpm --dir e2e exec playwright install --with-deps chromium

      - name: Tests
        run: pnpm --dir e2e test

      - name: Compose logs
        if: failure()
        run: e2e/compose.sh logs --no-color --timestamps > compose.log

      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: e2e-results
          path: |
            compose.log
            e2e/test-results
          if-no-files-found: ignore

      - name: Stop
        if: always()
        run: e2e/compose.sh down -v
```

- [ ] **Step 2: actionlint**

Run: `docker run --rm -v "$PWD:/repo:ro" -w /repo rhysd/actionlint:1.7.7 -color .github/workflows/tests.yml && echo clean`
Expected: `clean`.

- [ ] **Step 3: Pflicht-Job unverändert**

Run: `grep -nE '^  [a-z0-9-]+:$' .github/workflows/tests.yml`
Expected: genau `  tests:`, `  einvoice:`, `  e2e:` (Job `tests` heißt weiter `tests`).

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/tests.yml
git commit -m "ci: add e2e job against the Compose stack" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Der echte Lauf passiert in Task 12 mit dem PR.

---

### Task 8: Betriebs-Doku (`setup`, `reverse-proxy`, `backup`, `upgrading`, en + de)

**Files:**
- Create: `docs/en/setup.md`, `docs/de/setup.md`, `docs/en/reverse-proxy.md`, `docs/de/reverse-proxy.md`, `docs/en/backup.md`, `docs/de/backup.md`, `docs/en/upgrading.md`, `docs/de/upgrading.md`
- Modify: `docs/.vitepress/config.ts` (Seitenliste, Sidebar-Gruppe, Labels, Nav), `docs/en/index.md`, `docs/de/index.md` (Hero-Knöpfe)
- Test: `tests/Unit/DocsTest.php` (anhängen)

**Interfaces:**
- Consumes: `App\Support\TrustedRequests::PROXIES` (Task 1), Compose-Namen (Task 4), Entrypoint-Meldungen (Task 3).
- Produces: Abschnitt `### 0.1.0` in `docs/en/upgrading.md` und `docs/de/upgrading.md` (liest `scripts/release-notes.sh`, Task 9); Doku-Befehle für Backup/Restore, die Task 11 wörtlich ausführt.

- [ ] **Step 1: Failing Tests anhängen** (`tests/Unit/DocsTest.php`; `use App\Support\TrustedRequests;` oben nach `<?php` ergänzen)

```php
it('lists the trusted proxy networks, the APP_URL host rule and the body size on the reverse proxy page', function () {
    $root = dirname(__DIR__, 2);

    foreach (['en', 'de'] as $locale) {
        $page = (string) file_get_contents("{$root}/docs/{$locale}/reverse-proxy.md");
        foreach (TrustedRequests::PROXIES as $network) {
            expect($page)->toContain("`{$network}`");
        }
        expect($page)->toContain('APP_URL', 'client_max_body_size 32m', '127.0.0.1:7739');
    }
});

it('documents backup and restore of the database and the data volume', function () {
    $root = dirname(__DIR__, 2);

    foreach (['en', 'de'] as $locale) {
        expect((string) file_get_contents("{$root}/docs/{$locale}/backup.md"))
            ->toContain('mariadb-dump', '--single-transaction', '--triggers', '/var/www/html/storage/app', '.app-key', 'down -v');
    }
});

it('explains binary logging for external databases and the data volume on the setup page', function () {
    $root = dirname(__DIR__, 2);

    foreach (['en', 'de'] as $locale) {
        expect((string) file_get_contents("{$root}/docs/{$locale}/setup.md"))
            ->toContain('log_bin_trust_function_creators', 'openbill-data', 'openbill-db', '7739', 'DB_WAIT_TIMEOUT');
    }
});

it('has upgrade notes for the first release in both languages', function () {
    $root = dirname(__DIR__, 2);

    foreach (['en', 'de'] as $locale) {
        expect((string) file_get_contents("{$root}/docs/{$locale}/upgrading.md"))->toContain("\n### 0.1.0\n");
    }
});
```

- [ ] **Step 2: Fehlschlag prüfen**

Run: `ddev artisan test --filter=DocsTest`
Expected: FAIL – `file_get_contents(…/docs/en/reverse-proxy.md): Failed to open stream`.

- [ ] **Step 3: `docs/en/setup.md`**

````markdown
# Setup

openbill runs as a Docker Compose stack: the app (`baeroe/openbill`, for `linux/amd64` and `linux/arm64`), MariaDB 11.4 and Gotenberg 8, which renders the PDFs. You need Docker with Compose v2 and, for HTTPS, a reverse proxy in front (see [Reverse proxy](/en/reverse-proxy)).

## Files

```bash
mkdir openbill && cd openbill
curl -fsSLO https://raw.githubusercontent.com/baeroe/openbill/main/docker-compose.yml
curl -fsSL -o .env https://raw.githubusercontent.com/baeroe/openbill/main/.env.docker.example
```

## .env

Change every value in `.env` before the first start:

| Variable | Required | Meaning |
|---|---|---|
| `APP_URL` | yes | Public address including `https://`, e.g. `https://invoices.example.com`. Links, the toolkit download and the allowed `Host` header come from it: requests for any other host get `400`. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | yes | Owner account, created on the first start only (password at least 8 characters). Changing them later doesn't touch the existing account. |
| `DB_PASSWORD`, `DB_ROOT_PASSWORD` | yes | MariaDB passwords. MariaDB stores them on the first start; changing them in `.env` afterwards breaks the connection. |
| `OPENBILL_PORT` | no | Host port, default `7739` (the container listens on `8080`). With a reverse proxy on the same host use `127.0.0.1:7739`, so the port isn't reachable from outside. |
| `OPENBILL_IMAGE` | no | Default `baeroe/openbill:latest`. Pin a version with `baeroe/openbill:0.1.0`. |
| `APP_KEY` | no | Encryption key of sessions and cookies. Without it, openbill generates one on the first start and keeps it in the data volume. |

## Start

```bash
docker compose up -d
docker compose logs -f openbill    # wait for "openbill: ready", then Ctrl+C
```

Open `APP_URL` and log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

On every start the container:

1. waits up to 60 seconds for the database (`DB_WAIT_TIMEOUT`); if it isn't reachable, it stops with `openbill: database … not reachable` and Docker restarts it,
2. generates the `APP_KEY` once, unless you set one,
3. migrates the database,
4. installs the built-in templates (Klar, Kante, Leise) in the version of the image,
5. creates the owner account if it doesn't exist yet,
6. builds its caches.

## What lives where

| What | Where |
|---|---|
| Archived PDFs and e-invoice XMLs, template assets, uploaded images and logos, the generated `APP_KEY` (`.app-key`) | volume `openbill-data` (`/var/www/html/storage/app` in the container) |
| Database | volume `openbill-db` (MariaDB) |
| Settings | `.env` next to `docker-compose.yml` |

Containers can be recreated at any time, the volumes stay. `docker compose down -v` deletes them, and with them every document. Back up both volumes, see [Backup](/en/backup).

## Services

- **openbill**: nginx and PHP-FPM on port `8080`, runs as `www-data`.
- **mariadb**: only reachable by openbill (internal network, no published port). It runs with `--log-bin-trust-function-creators=1`: finalized documents are protected by database triggers, and creating triggers needs this switch (or the SUPER privilege) as soon as binary logging is on.
- **gotenberg**: renders HTML to PDF/A-3. Only reachable by openbill and without internet access. Templates can come from untrusted packages, so Chromium runs no JavaScript and loads nothing but Gotenberg's own working files and `data:` URLs.

## Your own MariaDB

To use an existing MariaDB 11.4 instead of the `mariadb` service: remove the service and its `depends_on` entry, set `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME` and `DB_PASSWORD` for openbill, and give the user all privileges on its database (including `TRIGGER`). If binary logging is on there, set `log_bin_trust_function_creators = 1` in the server configuration – otherwise the first migration fails with error 1419 (“You do not have the SUPER privilege and binary logging is enabled”).

## Language

The app is in English and German, English by default. The language is part of the URL (`APP_URL/en/…`, `APP_URL/de/…`); switch it in the menu. Documents have their own language, independent of the app.

## Versions

`latest` follows every release. Pin a version with `OPENBILL_IMAGE=baeroe/openbill:0.1.0` in `.env`. How to update: [Upgrading](/en/upgrading).
````

- [ ] **Step 4: `docs/de/setup.md`**

````markdown
# Einrichtung

openbill läuft als Docker-Compose-Stack: die App (`baeroe/openbill`, für `linux/amd64` und `linux/arm64`), MariaDB 11.4 und Gotenberg 8, das die PDFs erzeugt. Du brauchst Docker mit Compose v2 und für HTTPS einen Reverse Proxy davor (siehe [Reverse Proxy](/de/reverse-proxy)).

## Dateien

```bash
mkdir openbill && cd openbill
curl -fsSLO https://raw.githubusercontent.com/baeroe/openbill/main/docker-compose.yml
curl -fsSL -o .env https://raw.githubusercontent.com/baeroe/openbill/main/.env.docker.example
```

## .env

Ändere vor dem ersten Start jeden Wert in `.env`:

| Variable | Pflicht | Bedeutung |
|---|---|---|
| `APP_URL` | ja | Öffentliche Adresse mit `https://`, z. B. `https://invoices.example.com`. Links, der Toolkit-Download und der erlaubte `Host`-Header kommen daher: Anfragen an jeden anderen Host bekommen `400`. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | ja | Owner-Konto, nur beim ersten Start angelegt (Passwort mindestens 8 Zeichen). Spätere Änderungen fassen das bestehende Konto nicht an. |
| `DB_PASSWORD`, `DB_ROOT_PASSWORD` | ja | MariaDB-Passwörter. MariaDB speichert sie beim ersten Start; änderst du sie danach in `.env`, klappt die Verbindung nicht mehr. |
| `OPENBILL_PORT` | nein | Port auf dem Host, Standard `7739` (der Container lauscht auf `8080`). Läuft der Reverse Proxy auf demselben Host, nimm `127.0.0.1:7739`, dann ist der Port von außen nicht erreichbar. |
| `OPENBILL_IMAGE` | nein | Standard `baeroe/openbill:latest`. Eine Version festhalten mit `baeroe/openbill:0.1.0`. |
| `APP_KEY` | nein | Schlüssel für Sitzungen und Cookies. Ohne ihn erzeugt openbill beim ersten Start einen und legt ihn im Daten-Volume ab. |

## Starten

```bash
docker compose up -d
docker compose logs -f openbill    # auf "openbill: ready" warten, dann Strg+C
```

Öffne `APP_URL` und melde dich mit `ADMIN_EMAIL` / `ADMIN_PASSWORD` an.

Bei jedem Start

1. wartet der Container bis zu 60 Sekunden auf die Datenbank (`DB_WAIT_TIMEOUT`); ist sie nicht erreichbar, beendet er sich mit `openbill: database … not reachable` und Docker startet ihn neu,
2. erzeugt er einmalig den `APP_KEY`, falls du keinen gesetzt hast,
3. migriert er die Datenbank,
4. spielt er die mitgelieferten Templates (Klar, Kante, Leise) in der Version des Images ein,
5. legt er das Owner-Konto an, falls es noch nicht existiert,
6. baut er seine Caches.

## Was wo liegt

| Was | Wo |
|---|---|
| Archivierte PDFs und E-Rechnungs-XMLs, Template-Assets, hochgeladene Bilder und Logos, der erzeugte `APP_KEY` (`.app-key`) | Volume `openbill-data` (`/var/www/html/storage/app` im Container) |
| Datenbank | Volume `openbill-db` (MariaDB) |
| Einstellungen | `.env` neben `docker-compose.yml` |

Container kannst du jederzeit neu anlegen, die Volumes bleiben. `docker compose down -v` löscht sie und damit jedes Dokument. Sichere beide Volumes, siehe [Datensicherung](/de/backup).

## Dienste

- **openbill**: nginx und PHP-FPM auf Port `8080`, läuft als `www-data`.
- **mariadb**: nur für openbill erreichbar (internes Netz, kein veröffentlichter Port). Läuft mit `--log-bin-trust-function-creators=1`: Abgeschlossene Dokumente schützen Datenbank-Trigger, und Trigger anlegen braucht diesen Schalter (oder das SUPER-Recht), sobald Binärlogs eingeschaltet sind.
- **gotenberg**: macht aus HTML ein PDF/A-3. Nur für openbill erreichbar und ohne Internetzugang. Templates können aus fremden Paketen kommen, deshalb führt Chromium kein JavaScript aus und lädt nur Gotenbergs eigene Arbeitsdateien und `data:`-URLs.

## Eigene MariaDB

Statt des Dienstes `mariadb` eine vorhandene MariaDB 11.4 nutzen: Dienst und seinen `depends_on`-Eintrag entfernen, für openbill `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME` und `DB_PASSWORD` setzen und dem Benutzer alle Rechte auf seiner Datenbank geben (auch `TRIGGER`). Sind dort Binärlogs eingeschaltet, setze `log_bin_trust_function_creators = 1` in der Server-Konfiguration – sonst scheitert die erste Migration mit Fehler 1419 („You do not have the SUPER privilege and binary logging is enabled“).

## Sprache

Die App gibt es auf Englisch und Deutsch, Standard ist Englisch. Die Sprache steht in der URL (`APP_URL/en/…`, `APP_URL/de/…`); umschalten kannst du im Menü. Dokumente haben ihre eigene Sprache, unabhängig von der App.

## Versionen

`latest` folgt jedem Release. Eine Version festhalten mit `OPENBILL_IMAGE=baeroe/openbill:0.1.0` in `.env`. Aktualisieren: [Aktualisieren](/de/upgrading).
````

- [ ] **Step 5: `docs/en/reverse-proxy.md`**

````markdown
# Reverse proxy

openbill speaks plain HTTP on port `7739`. HTTPS comes from a reverse proxy in front of it. Set `APP_URL` in `.env` to the public `https://` address.

## What openbill trusts

- **Forwarded headers** (`X-Forwarded-For`, `-Proto`, `-Host`, `-Port`) only from these networks: `127.0.0.1`, `::1`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `fc00::/7`. A proxy on the same host, in the same Docker network or in your LAN is covered. Requests straight from the internet can't fake `https` or their IP address.
- **Host**: only the host of `APP_URL`. Any other `Host` header answers `400 Bad Request`. Your proxy must pass the original host (all examples below do).

If your proxy reaches openbill from a public IP address, openbill ignores its headers: links and assets come out as `http://` (browsers block them as mixed content), and every user shares the proxy's IP – the login lock after failed attempts then hits everyone at once. Put the proxy into a private network with openbill instead.

With the proxy on the same host, publish the port on localhost only: `OPENBILL_PORT=127.0.0.1:7739` in `.env`.

## Caddy

```txt
invoices.example.com {
    reverse_proxy localhost:7739
}
```

If Caddy runs in the same Compose project, use `reverse_proxy openbill:8080`. Caddy gets the certificate on its own and doesn't limit the body size.

## Traefik

Labels on the `openbill` service; Traefik and openbill need a shared Docker network:

```yaml
services:
  openbill:
    labels:
      - traefik.enable=true
      - traefik.http.routers.openbill.rule=Host(`invoices.example.com`)
      - traefik.http.routers.openbill.entrypoints=websecure
      - traefik.http.routers.openbill.tls.certresolver=letsencrypt
      - traefik.http.services.openbill.loadbalancer.server.port=8080
```

Entrypoint and cert resolver names depend on your Traefik setup. Without `ports` openbill is reachable through Traefik only.

## nginx

```nginx
server {
    listen 443 ssl;
    server_name invoices.example.com;
    # template packages and toolkit pushes carry up to 30 MB
    client_max_body_size 32m;

    location / {
        proxy_pass http://127.0.0.1:7739;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Port $server_port;
    }
}
```

## Nginx Proxy Manager

1. Add a proxy host for `invoices.example.com`.
2. Scheme `http`, forward to the Docker host and port `7739` (or to `openbill`, port `8080`, if both share a Docker network).
3. SSL tab: request a certificate, enable *Force SSL*.
4. Advanced tab: `client_max_body_size 32m;`

## Checklist

- `APP_URL` starts with `https://` and has exactly the host the browser uses.
- The page source of `/en/login` shows asset links starting with `https://`. If they start with `http://`, the proxy is not in one of the trusted networks above.
- Template packages and toolkit pushes carry up to 30 MB: allow at least `client_max_body_size 32m` (nginx); Caddy and Traefik don't limit the body size by default.
- The [template toolkit](/en/template-toolkit) of template authors talks to `APP_URL` from their machine: it must be reachable from there with a valid certificate.
````

- [ ] **Step 6: `docs/de/reverse-proxy.md`**

````markdown
# Reverse Proxy

openbill spricht einfaches HTTP auf Port `7739`. HTTPS kommt von einem Reverse Proxy davor. Setze `APP_URL` in `.env` auf die öffentliche `https://`-Adresse.

## Wem openbill glaubt

- **Weitergeleitete Header** (`X-Forwarded-For`, `-Proto`, `-Host`, `-Port`) nur aus diesen Netzen: `127.0.0.1`, `::1`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `fc00::/7`. Ein Proxy auf demselben Host, im selben Docker-Netz oder in deinem LAN ist damit abgedeckt. Anfragen direkt aus dem Internet können weder `https` noch ihre IP-Adresse vortäuschen.
- **Host**: nur der Host aus `APP_URL`. Jeder andere `Host`-Header bekommt `400 Bad Request`. Dein Proxy muss den ursprünglichen Host weiterreichen (alle Beispiele unten tun das).

Erreicht dein Proxy openbill von einer öffentlichen IP-Adresse, ignoriert openbill seine Header: Links und Assets kommen als `http://` heraus (Browser blockieren sie als Mixed Content), und alle Nutzer teilen sich die IP des Proxys – die Login-Sperre nach Fehlversuchen trifft dann alle gleichzeitig. Bring den Proxy stattdessen mit openbill in ein privates Netz.

Läuft der Proxy auf demselben Host, veröffentliche den Port nur auf localhost: `OPENBILL_PORT=127.0.0.1:7739` in `.env`.

## Caddy

```txt
invoices.example.com {
    reverse_proxy localhost:7739
}
```

Läuft Caddy im selben Compose-Projekt, nimm `reverse_proxy openbill:8080`. Caddy holt das Zertifikat selbst und begrenzt die Body-Größe nicht.

## Traefik

Labels am Dienst `openbill`; Traefik und openbill brauchen ein gemeinsames Docker-Netz:

```yaml
services:
  openbill:
    labels:
      - traefik.enable=true
      - traefik.http.routers.openbill.rule=Host(`invoices.example.com`)
      - traefik.http.routers.openbill.entrypoints=websecure
      - traefik.http.routers.openbill.tls.certresolver=letsencrypt
      - traefik.http.services.openbill.loadbalancer.server.port=8080
```

Namen von Entrypoint und Cert-Resolver hängen von deinem Traefik ab. Ohne `ports` ist openbill nur über Traefik erreichbar.

## nginx

```nginx
server {
    listen 443 ssl;
    server_name invoices.example.com;
    # Template-Pakete und Toolkit-Pushes sind bis zu 30 MB groß
    client_max_body_size 32m;

    location / {
        proxy_pass http://127.0.0.1:7739;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Port $server_port;
    }
}
```

## Nginx Proxy Manager

1. Proxy-Host für `invoices.example.com` anlegen.
2. Schema `http`, Ziel Docker-Host und Port `7739` (oder `openbill`, Port `8080`, wenn beide ein Docker-Netz teilen).
3. Reiter SSL: Zertifikat anfordern, *Force SSL* einschalten.
4. Reiter Advanced: `client_max_body_size 32m;`

## Checkliste

- `APP_URL` beginnt mit `https://` und hat genau den Host, den der Browser benutzt.
- Der Quelltext von `/de/login` zeigt Asset-Links mit `https://`. Stehen dort `http://`-Links, liegt der Proxy in keinem der vertrauten Netze oben.
- Template-Pakete und Toolkit-Pushes sind bis zu 30 MB groß: mindestens `client_max_body_size 32m` erlauben (nginx); Caddy und Traefik begrenzen die Body-Größe standardmäßig nicht.
- Das [Template-Toolkit](/de/template-toolkit) der Template-Autoren spricht von deren Rechner aus mit `APP_URL`: Die Adresse muss dort mit gültigem Zertifikat erreichbar sein.
````

- [ ] **Step 7: `docs/en/backup.md`**

````markdown
# Backup

A backup has three parts: the database (volume `openbill-db`), the files (volume `openbill-data`: archived PDFs and XMLs, template assets, uploads, the generated `APP_KEY` in `.app-key`) and your `.env`. Database and files belong together: openbill checks the SHA-256 of every archived PDF against the database when it delivers it.

Run the commands next to `docker-compose.yml`, the stack keeps running.

## Back up

Database first, then the files – so every document in the dump has its file:

```bash
# 1. database: consistent snapshot including the triggers that protect finalized documents
docker compose exec -T mariadb sh -c 'exec mariadb-dump -uroot -p"$MARIADB_ROOT_PASSWORD" --single-transaction --routines --triggers openbill' > openbill-db-$(date +%F).sql

# 2. files of the data volume
docker compose exec -T openbill tar czf - -C /var/www/html/storage/app . > openbill-data-$(date +%F).tar.gz
```

Keep both files and a copy of `.env` somewhere else than the server. For a nightly backup put both commands into a script and run it from cron.

## Restore

A restore replaces everything. On a new server: copy `docker-compose.yml` and `.env` there first. On the existing server, remove the old data (this deletes it!):

```bash
docker compose down -v
```

Then:

```bash
# 1. empty database (MariaDB creates the database "openbill" and its user from .env)
docker compose up -d --wait mariadb
docker compose exec -T mariadb sh -c 'exec mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" openbill' < openbill-db-2026-10-12.sql

# 2. files into the data volume
docker compose run --rm --no-deps -T --entrypoint tar openbill xzf - -C /var/www/html/storage/app < openbill-data-2026-10-12.tar.gz

# 3. start openbill
docker compose up -d
```

openbill finds the restored `APP_KEY` in the data volume, so existing sessions stay valid. Then open one finalized document's PDF as a check: if the files don't match the database, the download fails instead of delivering a different file.

## Notes

- Keep the database user `openbill` (from `docker-compose.yml`): the triggers in the dump are defined for it.
- `docker compose down -v` deletes both volumes. Without `-v`, `down` keeps them.
- Moving to a new server is backup on the old one plus restore on the new one, with the same `.env`.
````

- [ ] **Step 8: `docs/de/backup.md`**

````markdown
# Datensicherung

Eine Sicherung hat drei Teile: die Datenbank (Volume `openbill-db`), die Dateien (Volume `openbill-data`: archivierte PDFs und XMLs, Template-Assets, Uploads, der erzeugte `APP_KEY` in `.app-key`) und deine `.env`. Datenbank und Dateien gehören zusammen: openbill prüft beim Ausliefern den SHA-256 jedes archivierten PDFs gegen die Datenbank.

Führe die Befehle neben `docker-compose.yml` aus, der Stack läuft dabei weiter.

## Sichern

Erst die Datenbank, dann die Dateien – so hat jedes Dokument im Dump seine Datei:

```bash
# 1. Datenbank: konsistenter Stand inklusive der Trigger, die abgeschlossene Dokumente schützen
docker compose exec -T mariadb sh -c 'exec mariadb-dump -uroot -p"$MARIADB_ROOT_PASSWORD" --single-transaction --routines --triggers openbill' > openbill-db-$(date +%F).sql

# 2. Dateien des Daten-Volumes
docker compose exec -T openbill tar czf - -C /var/www/html/storage/app . > openbill-data-$(date +%F).tar.gz
```

Bewahre beide Dateien und eine Kopie der `.env` an einem anderen Ort als dem Server auf. Für eine nächtliche Sicherung beide Befehle in ein Skript schreiben und per cron starten.

## Wiederherstellen

Eine Wiederherstellung ersetzt alles. Auf einem neuen Server: zuerst `docker-compose.yml` und `.env` dorthin kopieren. Auf dem bestehenden Server die alten Daten entfernen (das löscht sie!):

```bash
docker compose down -v
```

Dann:

```bash
# 1. leere Datenbank (MariaDB legt die Datenbank "openbill" und ihren Benutzer aus .env an)
docker compose up -d --wait mariadb
docker compose exec -T mariadb sh -c 'exec mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" openbill' < openbill-db-2026-10-12.sql

# 2. Dateien ins Daten-Volume
docker compose run --rm --no-deps -T --entrypoint tar openbill xzf - -C /var/www/html/storage/app < openbill-data-2026-10-12.tar.gz

# 3. openbill starten
docker compose up -d
```

openbill findet den wiederhergestellten `APP_KEY` im Daten-Volume, bestehende Sitzungen bleiben gültig. Öffne zur Probe das PDF eines abgeschlossenen Dokuments: Passen Dateien und Datenbank nicht zusammen, schlägt der Download fehl, statt eine falsche Datei zu liefern.

## Hinweise

- Behalte den Datenbank-Benutzer `openbill` (aus `docker-compose.yml`): Die Trigger im Dump sind für ihn definiert.
- `docker compose down -v` löscht beide Volumes. Ohne `-v` behält `down` sie.
- Umzug auf einen neuen Server = Sichern auf dem alten plus Wiederherstellen auf dem neuen, mit derselben `.env`.
````

- [ ] **Step 9: `docs/en/upgrading.md`**

````markdown
# Upgrading

Make a [backup](/en/backup) first, then:

```bash
docker compose pull
docker compose up -d
```

On start openbill migrates the database, installs the built-in templates of the new version and rebuilds its caches. Data in the volumes stays. `docker compose restart` alone keeps the old image.

- **Pinned version:** change `OPENBILL_IMAGE` in `.env` first (e.g. `baeroe/openbill:0.2.0`).
- **Compose file:** the notes below say when `docker-compose.yml` changed (for example new MariaDB or Gotenberg versions). Download it again and keep your own changes:
  `curl -fsSLO https://raw.githubusercontent.com/baeroe/openbill/main/docker-compose.yml`
- **MariaDB:** patch versions upgrade themselves on start (`MARIADB_AUTO_UPGRADE`). A new major version only comes with a note here.
- **Going back:** migrations are not rolled back. Restore the backup and pin the old version.

All versions and their changes: https://github.com/baeroe/openbill/releases

## Notes per version

### 0.1.0

- First release: quotes, order confirmations, invoices and cancellations with custom fields, Liquid templates (Klar, Kante, Leise and your own), EN 16931 e-invoices as PDF/A-3 with embedded XML, REST API, MCP server and the template toolkit.
- Runs as Docker Compose stack with MariaDB 11.4 and Gotenberg 8, see [Setup](/en/setup).
````

- [ ] **Step 10: `docs/de/upgrading.md`**

````markdown
# Aktualisieren

Mach zuerst eine [Datensicherung](/de/backup), dann:

```bash
docker compose pull
docker compose up -d
```

Beim Start migriert openbill die Datenbank, spielt die mitgelieferten Templates der neuen Version ein und baut seine Caches neu. Die Daten in den Volumes bleiben. `docker compose restart` allein behält das alte Image.

- **Feste Version:** zuerst `OPENBILL_IMAGE` in `.env` ändern (z. B. `baeroe/openbill:0.2.0`).
- **Compose-Datei:** Die Hinweise unten sagen, wann sich `docker-compose.yml` geändert hat (etwa neue MariaDB- oder Gotenberg-Versionen). Lade sie dann neu und übernimm deine eigenen Änderungen:
  `curl -fsSLO https://raw.githubusercontent.com/baeroe/openbill/main/docker-compose.yml`
- **MariaDB:** Patch-Versionen aktualisieren sich beim Start selbst (`MARIADB_AUTO_UPGRADE`). Eine neue Hauptversion kommt nur mit einem Hinweis hier.
- **Zurück:** Migrationen werden nicht zurückgedreht. Spiel die Sicherung ein und halte die alte Version fest.

Alle Versionen und ihre Änderungen: https://github.com/baeroe/openbill/releases

## Hinweise je Version

### 0.1.0

- Erstes Release: Angebote, Auftragsbestätigungen, Rechnungen und Stornos mit eigenen Feldern, Liquid-Templates (Klar, Kante, Leise und eigene), E-Rechnungen nach EN 16931 als PDF/A-3 mit eingebettetem XML, REST-API, MCP-Server und das Template-Toolkit.
- Läuft als Docker-Compose-Stack mit MariaDB 11.4 und Gotenberg 8, siehe [Einrichtung](/de/setup).
````

- [ ] **Step 11: `docs/.vitepress/config.ts`**

Ersetze

```ts
// every page exists in docs/en and docs/de under the same file name (tests/Unit/DocsTest.php)
const pages = ['documents', 'custom-fields', 'templates', 'template-toolkit', 'e-invoice', 'settings', 'api', 'mcp', 'development'];

const sidebar = (prefix: string, t: Record<string, string>): DefaultTheme.SidebarItem[] => [
    { text: t.guide, items: pages.map((p) => ({ text: t[p], link: `${prefix}/${p}` })) },
];
```

durch

```ts
// every page exists in docs/en and docs/de under the same file name (tests/Unit/DocsTest.php)
const hosting = ['setup', 'reverse-proxy', 'backup', 'upgrading'];
const pages = ['documents', 'custom-fields', 'templates', 'template-toolkit', 'e-invoice', 'settings', 'api', 'mcp', 'development'];

const sidebar = (prefix: string, t: Record<string, string>): DefaultTheme.SidebarItem[] => [
    { text: t.hosting, items: hosting.map((p) => ({ text: t[p], link: `${prefix}/${p}` })) },
    { text: t.guide, items: pages.map((p) => ({ text: t[p], link: `${prefix}/${p}` })) },
];
```

Im Objekt `en` nach `guide: 'Guide',` einfügen:

```ts
    hosting: 'Self-hosting',
    setup: 'Setup',
    'reverse-proxy': 'Reverse proxy',
    backup: 'Backup',
    upgrading: 'Upgrading',
```

Im Objekt `de` nach `guide: 'Anleitung',` einfügen:

```ts
    hosting: 'Betrieb',
    setup: 'Einrichtung',
    'reverse-proxy': 'Reverse Proxy',
    backup: 'Datensicherung',
    upgrading: 'Aktualisieren',
```

Nav: `nav: [{ text: 'Guide', link: '/en/development' }]` → `nav: [{ text: 'Guide', link: '/en/setup' }]` und `nav: [{ text: 'Anleitung', link: '/de/development' }]` → `nav: [{ text: 'Anleitung', link: '/de/setup' }]`.

- [ ] **Step 12: Hero-Knöpfe**

`docs/en/index.md`: den Block

```yaml
    - theme: brand
      text: Development setup
      link: /en/development
```

ersetzen durch

```yaml
    - theme: brand
      text: Self-host it
      link: /en/setup
    - theme: alt
      text: Development
      link: /en/development
```

`docs/de/index.md`: den Block

```yaml
    - theme: brand
      text: Entwicklungsumgebung
      link: /de/development
```

ersetzen durch

```yaml
    - theme: brand
      text: Selbst hosten
      link: /de/setup
    - theme: alt
      text: Entwicklung
      link: /de/development
```

- [ ] **Step 13: Tests und Doku-Build**

Run: `ddev artisan test --filter=DocsTest && ddev exec pnpm --dir docs build 2>&1 | tail -n 3`
Expected: DocsTest PASS (8 Tests), VitePress `build complete` ohne `dead link`.

- [ ] **Step 14: Commit**

```bash
git add docs/en/setup.md docs/de/setup.md docs/en/reverse-proxy.md docs/de/reverse-proxy.md docs/en/backup.md docs/de/backup.md docs/en/upgrading.md docs/de/upgrading.md docs/.vitepress/config.ts docs/en/index.md docs/de/index.md tests/Unit/DocsTest.php
git commit -m "docs: add setup, reverse proxy, backup and upgrading pages" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Release-Workflows (`docker.yml`, `dockerhub.yml`, Release-Notizen)

**Files:**
- Create: `scripts/release-notes.sh` (ausführbar)
- Create: `.github/workflows/docker.yml`
- Create: `.github/workflows/dockerhub.yml`
- Test: `tests/Unit/ReleaseNotesTest.php`

**Interfaces:**
- Consumes: Abschnitte `### <version>` in `docs/en/upgrading.md` und `docs/de/upgrading.md` (Task 8), Repo-Secrets `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN` (gesetzt).
- Produces: `scripts/release-notes.sh <version ohne v>` → Notizen auf stdout, Exit 1 + Meldung auf stderr ohne Abschnitt; Workflow „Docker image“ (Job `image`), Workflow „Docker Hub description“ (Job `sync`).

- [ ] **Step 1: Failing Test schreiben**

`tests/Unit/ReleaseNotesTest.php`:

```php
<?php

use Symfony\Component\Process\Process;

function releaseNotes(string $version): Process
{
    $process = new Process([dirname(__DIR__, 2).'/scripts/release-notes.sh', $version]);
    $process->run();

    return $process;
}

it('prints the notes of a version from docs/en/upgrading.md', function () {
    $process = releaseNotes('0.1.0');

    expect($process->getExitCode())->toBe(0, $process->getErrorOutput())
        ->and($process->getOutput())->toStartWith('- First release')
        ->not->toContain('##')
        ->and(trim($process->getOutput()))->toBe(rtrim($process->getOutput(), "\n"));
});

it('uses the notes of the final version for a pre-release tag', function () {
    expect(releaseNotes('0.1.0-rc.1')->getOutput())->toBe(releaseNotes('0.1.0')->getOutput());
});

it('refuses a version without notes, before anything is published', function () {
    $process = releaseNotes('9.9.9');

    expect($process->getExitCode())->toBe(1)
        ->and($process->getErrorOutput())->toContain('docs/en/upgrading.md has no section "### 9.9.9"');
});
```

- [ ] **Step 2: Fehlschlag prüfen**

Run: `ddev artisan test --filter=ReleaseNotesTest`
Expected: FAIL – Prozess findet `scripts/release-notes.sh` nicht (Exit 127).

- [ ] **Step 3: `scripts/release-notes.sh` anlegen**

```bash
#!/usr/bin/env bash
# Release notes of one version for the GitHub release (.github/workflows/docker.yml): the section "### <version>" of
# docs/en/upgrading.md. Every tag needs that section in docs/en/upgrading.md and docs/de/upgrading.md (spec 9), so
# this fails without one – the workflow runs it before anything is pushed. Pre-releases (0.2.0-rc.1) use the section
# of their final version.
#
#   scripts/release-notes.sh 0.1.0
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
VERSION=${1:?usage: scripts/release-notes.sh <version without v, e.g. 0.1.0>}
VERSION=${VERSION%%-*}

for lang in en de; do
    if ! grep -qxF "### ${VERSION}" "$ROOT/docs/$lang/upgrading.md"; then
        echo "docs/$lang/upgrading.md has no section \"### ${VERSION}\"" >&2
        exit 1
    fi
done

# lines after the heading up to the next heading of level 2 or 3, without leading and trailing blank lines
awk -v heading="### ${VERSION}" '
    $0 == heading { found = 1; next }
    found && /^##/ { exit }
    found { lines[++n] = $0 }
    END {
        first = 1
        while (first <= n && lines[first] == "") first++
        last = n
        while (last >= first && lines[last] == "") last--
        for (i = first; i <= last; i++) print lines[i]
    }
' "$ROOT/docs/en/upgrading.md"
```

Run: `chmod +x scripts/release-notes.sh`

- [ ] **Step 4: Test grün**

Run: `ddev artisan test --filter=ReleaseNotesTest && scripts/release-notes.sh 0.1.0`
Expected: PASS (3 Tests), dann die zwei Aufzählungspunkte aus `### 0.1.0` (beginnen mit `- First release:` und `- Runs as Docker Compose stack`).

- [ ] **Step 5: `.github/workflows/docker.yml` anlegen**

```yaml
name: Docker image

on:
  # release: tag vX.Y.Z → baeroe/openbill:X.Y.Z, :X.Y, :latest (not for pre-releases like v0.2.0-rc.1) + GitHub release
  push:
    tags: ['v*']
  # build-only check of both platforms (nothing is pushed) when the inputs of the image change
  pull_request:
    paths:
      - Dockerfile
      - .dockerignore
      - docker/**
      - composer.lock
      - pnpm-lock.yaml
      - .github/workflows/docker.yml
  workflow_dispatch:

jobs:
  image:
    runs-on: ubuntu-latest
    timeout-minutes: 90
    permissions:
      contents: write # GitHub release
    env:
      RELEASE: ${{ startsWith(github.ref, 'refs/tags/v') }}
    steps:
      - uses: actions/checkout@v4

      # every tag needs a section in docs/en/upgrading.md and docs/de/upgrading.md: checked before anything is pushed
      - name: Release notes
        if: env.RELEASE == 'true'
        run: scripts/release-notes.sh "${GITHUB_REF_NAME#v}" > "$RUNNER_TEMP/release-notes.md"

      - uses: docker/setup-qemu-action@v3
      - uses: docker/setup-buildx-action@v3

      - uses: docker/login-action@v3
        if: env.RELEASE == 'true'
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - id: meta
        uses: docker/metadata-action@v5
        with:
          images: baeroe/openbill
          tags: |
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=raw,value=latest,enable=${{ env.RELEASE == 'true' && !contains(github.ref_name, '-') }}
            type=ref,event=pr

      - uses: docker/build-push-action@v6
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: ${{ env.RELEASE == 'true' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha,scope=image
          cache-to: type=gha,scope=image,mode=max

      - name: GitHub release
        if: env.RELEASE == 'true'
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          prerelease=""
          case "$GITHUB_REF_NAME" in *-*) prerelease="--prerelease" ;; esac
          # the notes from docs/en/upgrading.md come first, GitHub's generated list of changes after them
          gh release create "$GITHUB_REF_NAME" --verify-tag --generate-notes --notes "$(cat "$RUNNER_TEMP/release-notes.md")" $prerelease
```

- [ ] **Step 6: `.github/workflows/dockerhub.yml` anlegen**

```yaml
name: Docker Hub description

on:
  push:
    branches: [main]
    paths: ['README.md', '.github/workflows/dockerhub.yml']
  # after a release: the repository on Docker Hub only exists once the first image is pushed
  workflow_run:
    workflows: ['Docker image']
    types: [completed]
  workflow_dispatch:

jobs:
  sync:
    if: github.event_name != 'workflow_run' || (github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.event == 'push')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Repository on Docker Hub
        id: hub
        run: |
          if curl -fsS -o /dev/null https://hub.docker.com/v2/repositories/baeroe/openbill/; then
            echo "exists=true" >> "$GITHUB_OUTPUT"
          else
            echo "::notice::baeroe/openbill is not on Docker Hub yet (no release pushed), nothing to sync"
            echo "exists=false" >> "$GITHUB_OUTPUT"
          fi

      # needs a Docker Hub token with read/write/delete scope
      - if: steps.hub.outputs.exists == 'true'
        uses: peter-evans/dockerhub-description@v4
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}
          repository: baeroe/openbill
          short-description: Self-hosted quotes and invoices with custom fields, Liquid templates and EN 16931 e-invoices.
          enable-url-completion: true
```

- [ ] **Step 7: Prüfen: Kurzbeschreibung ≤ 100 Zeichen, actionlint**

Run:
```bash
grep -o 'short-description: .*' .github/workflows/dockerhub.yml | cut -d' ' -f2- | awk '{ print length($0) }'
docker run --rm -v "$PWD:/repo:ro" -w /repo rhysd/actionlint:1.7.7 -color && echo clean
```
Expected: `93` (≤ 100, Docker-Hub-Grenze), dann `clean`.

- [ ] **Step 8: Metadaten der Tags trocken prüfen**

Run: `gh release create --help | grep -n 'prepended'`
Expected: eine Zeile mit „Additional release notes can be prepended to automatically generated notes by using the `--notes` flag“ (bestätigt, dass `--notes` + `--generate-notes` zusammen gehen).

- [ ] **Step 9: Commit**

```bash
git add scripts/release-notes.sh tests/Unit/ReleaseNotesTest.php .github/workflows/docker.yml .github/workflows/dockerhub.yml
git commit -m "ci: release multi-arch image to Docker Hub on tags and sync the README" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: README, Entwickler-Doku und `CLAUDE.md`

**Files:**
- Modify: `README.md`, `docs/en/development.md`, `docs/de/development.md`, `CLAUDE.md`

**Interfaces:**
- Consumes: alles aus Tasks 1–9 (Namen, Pfade, Kommandos).
- Produces: README-Abschnitt „Quickstart“ (geht per `dockerhub.yml` nach Docker Hub; relative Links macht `enable-url-completion` absolut).

- [ ] **Step 1: `README.md` ersetzen** (ganze Datei)

````markdown
# openbill

Open, self-hosted quotes and invoices. Define your own fields for documents and line items, write your own PDF templates in Liquid, and get German/EU e-invoices (EN 16931, ZUGFeRD/XRechnung) out of the box.

> **Status:** feature-complete for a first release (0.1.0 in preparation). Feedback welcome in the issues.

## What it does

- Four document types: quote, order confirmation, invoice, cancellation, with simple statuses and one-click conversion along the chain
- A fixed core plus **custom fields** on every level: organisation, customer, contact, document, line item
- Line items in **groups** with subtotals
- **Compliance profiles** per document type: *Basic* (international) or *E-Invoice EN 16931* with required fields and embedded XML
- VAT handling: regular, small business (§ 19 UStG), EU reverse charge, third countries
- **Templates** as portable packages (HTML + CSS + Liquid + manifest), rendered to PDF/A-3 with Gotenberg, with a local toolkit for live preview
- REST API and MCP server for agents
- Runs as a Docker Compose stack (app, MariaDB, Gotenberg)

## Quickstart

You need Docker with Compose v2.

```bash
mkdir openbill && cd openbill
curl -fsSLO https://raw.githubusercontent.com/baeroe/openbill/main/docker-compose.yml
curl -fsSL -o .env https://raw.githubusercontent.com/baeroe/openbill/main/.env.docker.example
# edit .env: APP_URL, ADMIN_EMAIL, ADMIN_PASSWORD, DB_PASSWORD, DB_ROOT_PASSWORD
docker compose up -d
```

openbill listens on port `7739`; put a reverse proxy with HTTPS in front and set `APP_URL` to its address. Then log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

- Setup: [`docs/en/setup.md`](docs/en/setup.md)
- Reverse proxy: [`docs/en/reverse-proxy.md`](docs/en/reverse-proxy.md)
- Backup: [`docs/en/backup.md`](docs/en/backup.md)
- Upgrading: [`docs/en/upgrading.md`](docs/en/upgrading.md)

Images: `baeroe/openbill` on Docker Hub for `linux/amd64` and `linux/arm64`, tagged `X.Y.Z`, `X.Y` and `latest`.

## Development

Local development runs in [DDEV](https://ddev.com) (PHP 8.4, MariaDB 11.4, Node 24 with pnpm, Gotenberg):

```bash
cp .env.example .env
ddev start
ddev composer install
ddev artisan key:generate && ddev artisan migrate
ddev artisan app:ensure-admin
ddev exec pnpm install
ddev exec pnpm dev          # https://openbill.ddev.site/en/login
ddev artisan test
```

Full guide: [`docs/en/development.md`](docs/en/development.md) (German: [`docs/de/development.md`](docs/de/development.md)).

## License

[MIT](LICENSE)
````

- [ ] **Step 2: `docs/en/development.md` ergänzen**

(a) Den Satz `Run it the same way in production:` samt dem folgenden `bash`-Block mit `gotenberg --chromium-disable-javascript=true …` ersetzen durch:

```markdown
`docker-compose.yml` runs it with the same switches, and all three places (DDEV, CI, Compose) use the same image pinned by digest; `tests/Feature/DockerSetupTest.php` fails when they drift apart.
```

(b) Im Abschnitt „Browser tests“ nach dem Absatz, der mit `The tests log in as` beginnt, einfügen:

````markdown
Against the Docker image instead of DDEV (what the CI job `e2e` does):

```bash
docker build -t openbill:e2e .
e2e/compose.sh up -d --wait --wait-timeout 300   # docker-compose.yml + e2e overrides, http://localhost:7739
OPENBILL_URL=http://localhost:7739 E2E_ARTISAN="e2e/compose.sh exec -T openbill php artisan" pnpm --dir e2e test
e2e/compose.sh down -v
```

`E2E_ARTISAN` is the command the global setup seeds with (default `ddev artisan`). The stack runs with `APP_ENV=e2e`, because the seeders refuse `production`; everything else is the production setup.
````

(c) Am Ende der Datei einen Abschnitt anhängen:

````markdown
## Docker image

`Dockerfile` builds the image in two stages: `assets` (Node 24, pnpm from corepack, `pnpm build` for the app and the template kit) and `app` (`serversideup/php` 8.4 with nginx, extensions `intl`, `bcmath`, `gd`, `apcu`). `docker/entrypoint.d/99-openbill.sh` runs on every start: wait for the database, `APP_KEY`, migrations, built-in templates, owner account, caches.

```bash
docker build -t openbill:local .
# try it like a user: docker-compose.yml + .env from .env.docker.example with OPENBILL_IMAGE=openbill:local
```

Base images are pinned by version and digest (Dockerfile, `docker-compose.yml`, `.ddev/docker-compose.gotenberg.yaml`, `.github/workflows/tests.yml`, `scripts/validate-einvoice.sh`). To update one, look up the new digest and change every place at once:

::: v-pre
```bash
docker buildx imagetools inspect gotenberg/gotenberg:8.38.0 --format '{{json .Manifest.Digest}}'
```
:::

Releases: a tag `vX.Y.Z` builds `linux/amd64` and `linux/arm64`, pushes `baeroe/openbill:X.Y.Z`, `:X.Y` and `:latest` and creates the GitHub release with the notes of `### X.Y.Z` from `docs/en/upgrading.md` (`scripts/release-notes.sh`; the tag fails without that section in English and German). Pull requests that change the image only build it.
````

(`::: v-pre` ist nötig: VitePress wertet `{{ … }}` sonst als Vue aus, siehe CLAUDE.md „Fallstricke“.)

- [ ] **Step 3: `docs/de/development.md` gleich ergänzen**

(a) Den Satz `Im Betrieb genauso starten:` samt folgendem `bash`-Block ersetzen durch:

```markdown
`docker-compose.yml` startet es mit denselben Schaltern, und alle drei Stellen (DDEV, CI, Compose) nutzen dasselbe per Digest gepinnte Image; `tests/Feature/DockerSetupTest.php` schlägt fehl, wenn sie auseinanderlaufen.
```

(b) Im Abschnitt „Browser-Tests“ nach dem Absatz über `e2e@example.com`:

````markdown
Gegen das Docker-Image statt gegen DDEV (so macht es der CI-Job `e2e`):

```bash
docker build -t openbill:e2e .
e2e/compose.sh up -d --wait --wait-timeout 300   # docker-compose.yml + e2e-Overrides, http://localhost:7739
OPENBILL_URL=http://localhost:7739 E2E_ARTISAN="e2e/compose.sh exec -T openbill php artisan" pnpm --dir e2e test
e2e/compose.sh down -v
```

`E2E_ARTISAN` ist der Befehl, mit dem das globale Setup seedet (Standard `ddev artisan`). Der Stack läuft mit `APP_ENV=e2e`, weil die Seeder `production` verweigern; alles andere ist der Produktionsaufbau.
````

(c) Am Ende:

````markdown
## Docker-Image

`Dockerfile` baut das Image in zwei Stufen: `assets` (Node 24, pnpm über corepack, `pnpm build` für App und Template-Kit) und `app` (`serversideup/php` 8.4 mit nginx, Extensions `intl`, `bcmath`, `gd`, `apcu`). `docker/entrypoint.d/99-openbill.sh` läuft bei jedem Start: auf die Datenbank warten, `APP_KEY`, Migrationen, mitgelieferte Templates, Owner-Konto, Caches.

```bash
docker build -t openbill:local .
# wie ein Nutzer ausprobieren: docker-compose.yml + .env aus .env.docker.example mit OPENBILL_IMAGE=openbill:local
```

Basis-Images sind per Version und Digest gepinnt (Dockerfile, `docker-compose.yml`, `.ddev/docker-compose.gotenberg.yaml`, `.github/workflows/tests.yml`, `scripts/validate-einvoice.sh`). Zum Aktualisieren den neuen Digest nachschlagen und alle Stellen auf einmal ändern:

::: v-pre
```bash
docker buildx imagetools inspect gotenberg/gotenberg:8.38.0 --format '{{json .Manifest.Digest}}'
```
:::

Releases: Ein Tag `vX.Y.Z` baut `linux/amd64` und `linux/arm64`, pusht `baeroe/openbill:X.Y.Z`, `:X.Y` und `:latest` und legt das GitHub-Release mit den Hinweisen aus `### X.Y.Z` in `docs/en/upgrading.md` an (`scripts/release-notes.sh`; ohne diesen Abschnitt auf Englisch und Deutsch scheitert der Tag). Pull Requests, die das Image ändern, bauen es nur.
````


- [ ] **Step 4: `CLAUDE.md` aktualisieren**

Ersetzungen (jeweils ganze Zeile bzw. ganzer Satz):

1. In „Was openbill ist“: `Wird in Phasen gebaut; Stand: Phase 9 (` → `Wird in Phasen gebaut; Stand: Phase 10 (` und vor der schließenden Klammer `; Template-Toolkit zum Herunterladen im Template-Editor)` ergänzen zu `; Template-Toolkit zum Herunterladen im Template-Editor; Docker-Image + Compose-Stack, Release-Workflows)`.
2. In „Tech Stack“ nach der Zeile `- Lokal: DDEV (…)` einfügen:
   `- Betrieb: Docker-Image `baeroe/openbill` (`Dockerfile`: Node-Stage mit pnpm/corepack, `serversideup/php:8.4-fpm-nginx-v4.5.1` + `intl bcmath gd apcu`), `docker-compose.yml` mit MariaDB 11.4.13 und Gotenberg 8.37.0 (alle Images per Digest gepinnt), Entrypoint `docker/entrypoint.d/99-openbill.sh`; Release per Tag `vX.Y.Z` (`.github/workflows/docker.yml`, `dockerhub.yml`)`
3. In „Kommandos“ vor der Zeile `curl -s https://openbill.ddev.site/api/docs.jsonopenapi …` einfügen:
   ```bash
   docker build -t openbill:local .             # Image (Colima, nativ arm64)
   e2e/compose.sh up -d --wait --wait-timeout 300   # Compose-Stack für Playwright (Image openbill:e2e, http://localhost:7739, APP_ENV=e2e)
   OPENBILL_URL=http://localhost:7739 E2E_ARTISAN="e2e/compose.sh exec -T openbill php artisan" pnpm --dir e2e test
   scripts/release-notes.sh 0.1.0               # Release-Notizen aus docs/en/upgrading.md (Abschnitt fehlt → Exit 1)
   ```
4. In „Regeln“ die Zeile `- CI: Pflicht-Job `tests` …` ersetzen durch:
   `- CI: Pflicht-Job `tests` in `.github/workflows/tests.yml` – Name nie ändern. Neue Prüfungen dort anhängen. Weitere Jobs (kein Pflicht-Check): `einvoice`, `e2e` (Playwright gegen den Compose-Stack), `image` in `docker.yml` (bei PRs, die das Image ändern, nur Build amd64+arm64; bei Tags Push + Release).`
5. In „Architektur“ nach dem Punkt **Body-Limit** einen Punkt einfügen:
   `- **Reverse Proxy:** `bootstrap/app.php` → `trustProxies(at: TrustedRequests::PROXIES)` (nur localhost + private Netze, `App\Support\TrustedRequests`) und `trustHosts(…, subdomains: false)` mit genau dem Host aus `APP_URL` (`TrustedRequests::hostPatterns()`); Laravel wendet die Host-Prüfung außerhalb von `local` und Tests an, fremde Hosts → 400. Doku `reverse-proxy` nennt dieselben Netze (`DocsTest`).`
   Und am Ende des Punkts **Body-Limit** den Satz `Phase 10: nginx `client_max_body_size` und PHP `post_max_size` ≈ `max_template_body_bytes`.` ersetzen durch `Im Image: nginx `client_max_body_size`, PHP `post_max_size`/`upload_max_filesize` = 32M, `memory_limit` 512M (`Dockerfile`, `DockerSetupTest`).`
6. In „Architektur“ einen Punkt **Docker** anhängen:
   `- **Docker:** `Dockerfile` kopiert nur Laufzeit-Ordner (`app bootstrap config database lang public resources routes`, `docs/en/templates.md`, `public/build`, `packages/template-kit/dist/kit`), `storage/` entsteht per `mkdir` (Volume `openbill-data` = `storage/app` gehört so `www-data`). Entrypoint `docker/entrypoint.d/99-openbill.sh`: Ordner im Volume → `APP_KEY` (Env, sonst `storage/app/.app-key`) → `config:clear` → DB warten (`DB_WAIT_TIMEOUT`, 60 s) → `migrate --force` → `app:sync-templates` → `app:ensure-admin` → `optimize`. Compose: `openbill` (7739→8080) im Netz `default` + `backend` (`internal: true`) mit `mariadb` (`--log-bin-trust-function-creators=1`, Healthcheck) und `gotenberg` (Schalter wie DDEV). `tests/Feature/DockerSetupTest.php` hält Dockerfile/Compose/DDEV/CI/Skripte konsistent.`
7. „Fallstricke“:
   - Zeile `- Trigger anlegen braucht bei aktivem Binlog `log_bin_trust_function_creators = 1` oder SUPER (relevant für Phase 10, Docker/Produktion).` → `- Trigger anlegen braucht bei aktivem Binlog `log_bin_trust_function_creators = 1` oder SUPER: Compose startet MariaDB mit dem Schalter (Binlog selbst ist aus); externe Datenbanken: Doku `setup`.`
   - Zeile `- Gotenberg muss **≥ 8.34** sein (Factur-X-Felder). DDEV und CI nutzen `gotenberg/gotenberg:8`; `GotenbergTest` prüft die Version.` → `- Gotenberg muss **≥ 8.34** sein (Factur-X-Felder). DDEV, CI und Compose nutzen `gotenberg/gotenberg:8.37.0@sha256:…` (volles Image, PDF/A braucht LibreOffice); `GotenbergTest` prüft die Version, `DockerSetupTest` die Gleichheit.`
   - Im Punkt zum API-Platform-Cache den Satz `**Phase 10: Das Docker-Image braucht die Extension `apcu`** (`pecl install apcu`); nach einem Deploy leert ein FPM-Neustart den Cache.` → `Das Docker-Image installiert `apcu` (`install-php-extensions`); ein neuer Container startet mit leerem Cache.`
   - Zeile `- `docs/en/templates.md` wird zur Laufzeit gelesen …: Phase 10 darf die Datei nicht per `.dockerignore` aus dem Image nehmen; …` → den Teil `Phase 10 darf die Datei nicht per `.dockerignore` aus dem Image nehmen` ersetzen durch ``.dockerignore` nimmt sie mit `!docs/en/templates.md` wieder auf, das Dockerfile kopiert sie (`DockerSetupTest`)`.
   - Im Punkt zum Toolkit-Download den Satz ab `**Phase 10:** Die Node-Stage führt …` ersetzen durch `Im Image baut die Node-Stage das Kit (`pnpm build`) und die PHP-Stage kopiert es nach `packages/template-kit/dist/kit`. `APP_URL` muss die öffentliche https-Adresse sein (steht als `OPENBILL_URL` im Toolkit-ZIP und ist der einzige erlaubte Host).`
   - Neue Fallstricke anhängen:
     - `- serversideups Entrypoint führt `/etc/entrypoint.d/*.sh` in einer Subshell aus: `export` erreicht PHP-FPM nicht. `APP_KEY` kommt nur über den Config-Cache (`php artisan optimize` am Ende des Skripts) zu FPM – geänderte Umgebungsvariablen wirken erst nach `docker compose up -d` (neuer Container, neues `optimize`).`
     - `- Trusted Hosts sind außerhalb von `local`/Tests aktiv: Wer den Stack per `127.0.0.1` statt über den Host aus `APP_URL` anspricht, bekommt 400. Der e2e-Stack nutzt deshalb `APP_URL=http://localhost:7739`.`
     - `- Neues Basis-Image oder neue Version: Digest mit `docker buildx imagetools inspect <image:tag>` holen und **alle** Stellen gleich ändern (`DockerSetupTest`). `docker/metadata-action` taggt Vorabversionen (`v0.2.0-rc.1`) nur mit der vollen Version, nie `latest`.`
     - `- Neue Workspace-Pakete (`packages/*`, `prototypes/*`) brauchen eine eigene `COPY …/package.json`-Zeile in der Node-Stage des `Dockerfile`, sonst scheitert `pnpm install --frozen-lockfile` im Image-Build.`
     - `- `dockerhub.yml` überspringt den README-Sync, solange `baeroe/openbill` auf Docker Hub nicht existiert (vor dem ersten Release); nach einem Release läuft er per `workflow_run`.`
8. In „Fallstricke“ die Zeile zu Playwright `- Playwright läuft auf dem Mac; …` am Ende ergänzen: ` Gegen den Compose-Stack: `OPENBILL_URL` + `E2E_ARTISAN` (siehe Kommandos).`

- [ ] **Step 5: Doku-Build und Docs-Tests**

Run: `ddev artisan test --filter=DocsTest && ddev exec pnpm --dir docs build 2>&1 | tail -n 3`
Expected: PASS, `build complete`, kein `dead link`, keine Vue-Fehler zu `{{json`.

- [ ] **Step 6: Keine verwaisten Phase-10-Hinweise**

Run: `grep -niE 'phase 10( points|:|\)| darf|, docker|\*\*)' CLAUDE.md config/openbill.php e2e/*.ts .ddev/*.yaml || echo none`
Expected: `none` (nur noch „Stand: Phase 10 (…)“ in „Was openbill ist“, das der Ausdruck nicht trifft).

- [ ] **Step 7: Commit**

```bash
git add README.md docs/en/development.md docs/de/development.md CLAUDE.md
git commit -m "docs: README quickstart, Docker in the development guide, CLAUDE.md for phase 10" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Lokale Abnahme unter Colima

**Files:**
- keine geplanten Änderungen. Findet ein Schritt einen Fehler: Ursache beheben, mit Test (falls testbar) in einem eigenen Commit `fix: …`, dann den Task ab Step 1 wiederholen.

**Interfaces:**
- Consumes: Abnahme-Ordner `${TMPDIR:-/tmp}/openbill-acceptance` (Task 4 Step 9 legt ihn an; hier frisch), Projekt `openbill-acceptance`, Admin `admin@example.com` / `acceptance-admin-pw`, API-Ablauf aus `docs/en/api.md` („The main flow with curl“), Backup-Befehle aus `docs/en/backup.md`.
- Produces: nichts im Repo – Ergebnis ist die erfüllte Master-Abnahme „`docker compose up -d` mit lokal gebautem Image → Login → Rechnung abschließen → PDF“.

Jeder Code-Block läuft in **einer** Shell (Variablen gelten nur innerhalb des Blocks); die Blöcke setzen `ACC`, `B` und `cd` jeweils neu.

- [ ] **Step 1: Frisches Image, Architektur**

Run: `docker build -q -t openbill:local . >/dev/null && docker image inspect openbill:local --format '{{.Os}}/{{.Architecture}}'`
Expected: `linux/arm64`

- [ ] **Step 2: Stack wie ein Nutzer starten**

Run:
```bash
ACC="${TMPDIR:-/tmp}/openbill-acceptance"
(cd "$ACC" 2>/dev/null && docker compose -p openbill-acceptance down -v >/dev/null 2>&1) ; rm -rf "$ACC"
mkdir -p "$ACC" && cp docker-compose.yml "$ACC/" && cp .env.docker.example "$ACC/.env"
cd "$ACC" && sed -i '' \
  -e 's#^APP_URL=.*#APP_URL=http://localhost:7739#' \
  -e 's#^ADMIN_PASSWORD=.*#ADMIN_PASSWORD=acceptance-admin-pw#' \
  -e 's#^DB_PASSWORD=.*#DB_PASSWORD=acceptance-db-pw#' \
  -e 's#^DB_ROOT_PASSWORD=.*#DB_ROOT_PASSWORD=acceptance-root-pw#' \
  -e 's@^# OPENBILL_IMAGE=.*@OPENBILL_IMAGE=openbill:local@' .env
docker compose -p openbill-acceptance up -d --wait --wait-timeout 300 && docker compose -p openbill-acceptance logs openbill | grep -c 'openbill: ready'
```
Expected: `1`

- [ ] **Step 3: Login im Browser-Ablauf (Session-Cookie, CSRF)**

Run:
```bash
ACC="${TMPDIR:-/tmp}/openbill-acceptance"; B=http://localhost:7739; JAR="$ACC/cookies.txt"; rm -f "$JAR"
xsrf() { awk '$6 == "XSRF-TOKEN" { print $7 }' "$JAR" | python3 -c 'import sys, urllib.parse; print(urllib.parse.unquote(sys.stdin.read().strip()))'; }
curl -s -c "$JAR" -b "$JAR" -o /dev/null "$B/en/login"
curl -s -c "$JAR" -b "$JAR" -o /dev/null -w '%{http_code} %{redirect_url}\n' -X POST "$B/en/login" \
  -H "X-XSRF-TOKEN: $(xsrf)" -H "Referer: $B/en/login" \
  --data-urlencode 'email=admin@example.com' --data-urlencode 'password=acceptance-admin-pw'
curl -s -c "$JAR" -b "$JAR" -o /dev/null -w 'overview %{http_code}\n' "$B/en"
```
Expected:
```
302 http://localhost:7739/en
overview 200
```

- [ ] **Step 4: Rechnung über die API anlegen und abschließen**

Run:
```bash
ACC="${TMPDIR:-/tmp}/openbill-acceptance"; B=http://localhost:7739; cd "$ACC"
TOKEN=$(docker compose -p openbill-acceptance exec -T openbill php artisan app:create-token admin@example.com --name=acceptance --ability=api:read --ability=api:write | tail -n 1 | tr -d '\r')
echo "$TOKEN" > token.txt
A=(-H "Authorization: Bearer $TOKEN" -H 'Accept: application/json')
H=("${A[@]}" -H 'Content-Type: application/json')
curl -s "${A[@]}" -X PATCH -H 'Content-Type: application/merge-patch+json' "$B/api/organization" -d '{
  "name": "Studio Nordlicht", "street": "Speicherstraße 12", "zip": "20457", "city": "Hamburg", "country": "DE",
  "vat_id": "DE123456789", "iban": "DE02120300000000202051"}' | jq -r .name
CUSTOMER=$(curl -s "${H[@]}" -X POST "$B/api/customers" -d '{
  "name": "Hafenkontor Lindqvist GmbH", "street": "Kaistraße 4", "zip": "20457", "city": "Hamburg", "country": "DE"}' | jq -r .id)
UNIT=$(curl -s "${H[@]}" "$B/api/units" | jq -r '.[] | select(.code=="HUR") | .id')
VAT=$(curl -s "${H[@]}" "$B/api/tax-rates" | jq -r '.[] | select(.percent=="19.00") | .id')
INVOICE=$(curl -s "${H[@]}" -X POST "$B/api/documents" -d "{
  \"type\": \"invoice\", \"customer_id\": \"$CUSTOMER\",
  \"groups\": [{\"title\": \"Workshop\", \"positions\": [
    {\"kind\": \"item\", \"title\": \"Discovery workshop\", \"quantity\": \"8\", \"unit_price\": \"120\", \"unit_id\": \"$UNIT\", \"tax_rate_id\": \"$VAT\"}]}]}" | jq -r .id)
echo "$INVOICE" > invoice.txt
curl -s "${H[@]}" "$B/api/documents/$INVOICE" | jq -c .issues
curl -s "${H[@]}" -X POST "$B/api/documents/$INVOICE/finalize" | jq -r '.number, .status'
```
Expected: `Studio Nordlicht`, `[]` (keine offenen Prüfpunkte), dann eine Rechnungsnummer (beginnt mit `INV`) und `open`.
Zeigt `issues` Einträge: die genannten Pfade (`org.*`, `customer.*`) per `PATCH` ergänzen und den `finalize`-Aufruf wiederholen – das ist Datenpflege, kein Fehler. Antwortet `finalize` mit 503 (`PdfRenderFailedException`): `docker compose -p openbill-acceptance logs gotenberg openbill | tail -n 50` lesen; das ist ein Fehler im Stack (Netz/Gotenberg) und muss behoben werden.

- [ ] **Step 5: PDF/A-3 mit eingebettetem XML, Dateien im Volume**

Run:
```bash
ACC="${TMPDIR:-/tmp}/openbill-acceptance"; B=http://localhost:7739; cd "$ACC"
TOKEN=$(cat token.txt); INVOICE=$(cat invoice.txt)
curl -s -H "Authorization: Bearer $TOKEN" -o invoice.pdf -w 'pdf %{http_code} %{content_type}\n' "$B/api/documents/$INVOICE/pdf"
curl -s -H "Authorization: Bearer $TOKEN" -o invoice.xml -w 'xml %{http_code}\n' "$B/api/documents/$INVOICE/xml"
grep -c 'CrossIndustryInvoice' invoice.xml
uv run --quiet --with pypdf==5.4.0 python - invoice.pdf <<'PY'
import sys
from pypdf import PdfReader
reader = PdfReader(sys.argv[1])
xmp = reader.trailer['/Root']['/Metadata'].get_object().get_data().decode('utf-8', 'replace').replace(' ', '')
print('attachments', sorted(reader.attachments))
print('pdfa-3', 'pdfaid:part>3<' in xmp or 'pdfaid:part="3"' in xmp)
PY
docker compose -p openbill-acceptance exec -T openbill sh -c "find storage/app/archive -type f -name '$INVOICE.*' | sort; sha256sum \$(find storage/app/archive -type f -name '$INVOICE.pdf') | cut -d' ' -f1"
shasum -a 256 invoice.pdf | cut -d' ' -f1
```
Expected:
```
pdf 200 application/pdf
xml 200
1          (oder mehr)
attachments ['factur-x.xml']
pdfa-3 True
storage/app/archive/2026/<INVOICE>.pdf
storage/app/archive/2026/<INVOICE>.xml
<sha256>
<derselbe sha256>
```

- [ ] **Step 6: Toolkit-ZIP enthält das Kit (Sitzung wie im Template-Editor)**

Run:
```bash
ACC="${TMPDIR:-/tmp}/openbill-acceptance"; B=http://localhost:7739; JAR="$ACC/cookies.txt"; cd "$ACC"
xsrf() { awk '$6 == "XSRF-TOKEN" { print $7 }' "$JAR" | python3 -c 'import sys, urllib.parse; print(urllib.parse.unquote(sys.stdin.read().strip()))'; }
S=(-c "$JAR" -b "$JAR" -H 'Accept: application/json' -H "Referer: $B/en/templates")
KLAR=$(curl -s "${S[@]}" "$B/api/templates" | jq -r '.[] | select(.slug=="klar") | .id')
COPY=$(curl -s "${S[@]}" -X POST -H "X-XSRF-TOKEN: $(xsrf)" "$B/api/templates/$KLAR/duplicate" | jq -r .id)
curl -s -c "$JAR" -b "$JAR" -X POST -H "X-XSRF-TOKEN: $(xsrf)" -H "Referer: $B/en/templates/$COPY" \
  -H 'Accept: application/zip, application/problem+json' -o toolkit.zip -w 'toolkit %{http_code} %{content_type}\n' "$B/en/templates/$COPY/toolkit"
unzip -l toolkit.zip | grep -E 'tooling/cli\.js|tooling/plugin\.js|/index\.html|template/template\.liquid|\.env\.local|/package\.json' | awk '{ print $4 }' | sed -E 's#^openbill-[^/]+/##' | sort
unzip -p toolkit.zip '*/.env.local' | grep OPENBILL_URL
```
Expected (Reihenfolge der Dateizeilen egal):
```
toolkit 200 application/zip
.env.local
index.html
package.json
template/template.liquid
tooling/cli.js
tooling/plugin.js
OPENBILL_URL="http://localhost:7739"
```

- [ ] **Step 7: MCP `tools/list` per curl**

Run:
```bash
ACC="${TMPDIR:-/tmp}/openbill-acceptance"; B=http://localhost:7739; cd "$ACC"
MCP=$(docker compose -p openbill-acceptance exec -T openbill php artisan app:create-token admin@example.com --name=acceptance-mcp --ability=mcp | tail -n 1 | tr -d '\r')
curl -s -H "Authorization: Bearer $MCP" -H 'Accept: application/json, text/event-stream' -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' "$B/mcp" | jq '.result.tools | length'
curl -s -H "Authorization: Bearer $MCP" -H 'Accept: application/json, text/event-stream' -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"resources/read","params":{"uri":"openbill://docs/liquid-reference"}}' "$B/mcp" | jq -r '.result.contents[0].text' | grep -c '^## '
```
Expected: `25`, dann eine Zahl ≥ 3 (die Liquid-Referenz aus `docs/en/templates.md` kommt aus dem Image).

- [ ] **Step 8: Neustart – Daten und `APP_KEY` bleiben (Review Focus 1)**

Run:
```bash
ACC="${TMPDIR:-/tmp}/openbill-acceptance"; B=http://localhost:7739; JAR="$ACC/cookies.txt"; cd "$ACC"
TOKEN=$(cat token.txt); INVOICE=$(cat invoice.txt)
key() { docker compose -p openbill-acceptance exec -T openbill sha256sum storage/app/.app-key | cut -d' ' -f1; }
check() {
  echo "key $(key)"
  curl -s -b "$JAR" -o /dev/null -w "session %{http_code}\n" "$B/en"
  curl -s -H "Authorization: Bearer $TOKEN" -H 'Accept: application/json' "$B/api/documents/$INVOICE" | jq -r '"document " + .status'
  curl -s -H "Authorization: Bearer $TOKEN" "$B/api/documents/$INVOICE/pdf" | shasum -a 256 | cut -d' ' -f1
}
check
docker compose -p openbill-acceptance restart openbill >/dev/null && docker compose -p openbill-acceptance up -d --wait >/dev/null
check
docker compose -p openbill-acceptance down >/dev/null && docker compose -p openbill-acceptance up -d --wait --wait-timeout 300 >/dev/null
check
```
Expected: dreimal dieselben vier Zeilen – gleicher `key`, `session 200` (das Cookie aus Step 3 ist nach Neustart und Neuanlage noch gültig, also gleicher `APP_KEY`), `document open`, gleicher PDF-Hash wie in Step 5.

- [ ] **Step 9: Sicherung und Wiederherstellung nach `docs/en/backup.md`**

Run:
```bash
ACC="${TMPDIR:-/tmp}/openbill-acceptance"; B=http://localhost:7739; JAR="$ACC/cookies.txt"; cd "$ACC"
TOKEN=$(cat token.txt); INVOICE=$(cat invoice.txt)
dc() { docker compose -p openbill-acceptance "$@"; }
dc exec -T mariadb sh -c 'exec mariadb-dump -uroot -p"$MARIADB_ROOT_PASSWORD" --single-transaction --routines --triggers openbill' > db.sql
dc exec -T openbill tar czf - -C /var/www/html/storage/app . > data.tar.gz
grep -c 'CREATE.*TRIGGER' db.sql
dc down -v >/dev/null
dc up -d --wait mariadb >/dev/null
dc exec -T mariadb sh -c 'exec mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" openbill' < db.sql
dc run --rm --no-deps -T --entrypoint tar openbill xzf - -C /var/www/html/storage/app < data.tar.gz
dc up -d --wait --wait-timeout 300 >/dev/null
curl -s -b "$JAR" -o /dev/null -w "session %{http_code}\n" "$B/en"
curl -s -H "Authorization: Bearer $TOKEN" "$B/api/documents/$INVOICE/pdf" | shasum -a 256 | cut -d' ' -f1
```
Expected: eine Trigger-Zahl > 0, `session 200`, derselbe PDF-Hash wie in Step 5. (Weicht die Doku von dem ab, was hier nötig war, Doku in en **und** de korrigieren und committen.)

- [ ] **Step 10: Aufräumen**

Run: `ACC="${TMPDIR:-/tmp}/openbill-acceptance"; cd "$ACC" && docker compose -p openbill-acceptance down -v && cd / && rm -rf "$ACC"`
Expected: alles `Removed`, Ordner weg.

- [ ] **Step 11: Commit (nur falls Fixes nötig waren)**

Alle Fixes sind bereits einzeln committet; `git status --short` ist leer.

---

### Task 12: Verifizieren, pushen, PR, CI

**Files:**
- keine (nur Prüfung und Veröffentlichung des Branches)

**Interfaces:**
- Consumes: alles aus Tasks 1–11.
- Produces: PR gegen `main` mit grüner CI (`tests`, `einvoice`, `e2e`, `image`); **kein Merge, kein Tag**.

- [ ] **Step 1: Volle lokale Prüfung**

Run:
```bash
ddev exec vendor/bin/pint --test && \
ddev exec vendor/bin/phpstan analyse --memory-limit=1G && \
ddev artisan test && \
ddev exec pnpm typecheck && ddev exec pnpm test && \
ddev exec 'pnpm --filter "./packages/*" test' && \
ddev exec pnpm --dir docs build >/dev/null && \
docker run --rm -v "$PWD:/repo:ro" -w /repo rhysd/actionlint:1.7.7 -color && echo ALL-GREEN
```
Expected: `ALL-GREEN` am Ende; Pest ohne Fehler (neue Tests: `TrustedProxiesTest` 10, `DockerSetupTest` 18, `DocsTest` +4, `ReleaseNotesTest` 3).

- [ ] **Step 2: Identität und Arbeitsstand**

Run: `test "$(git config user.email)" = "rafael@hauss.dev" && echo ok && git status --short && git log --oneline main..HEAD`
Expected: `ok`, kein `git status`-Output, die Commits dieser Phase (Plan + Tasks 1–10, ggf. Fixes).

Run (E-Mail-Adressen und Hosts, die diese Phase hinzufügt): `git diff main -U0 | grep '^+' | grep -oE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}' | sort -u`
Expected: nur `admin@example.com`, `e2e@example.com`, `noreply@anthropic.com`, `rafael@hauss.dev` (die letzten beiden aus dem Plan). Alles andere entfernen. Hosts nur `invoices.example.com`, `evil.example`, `db.invalid`, `localhost`, `github.com/baeroe/openbill`, `raw.githubusercontent.com/baeroe/openbill`, `hub.docker.com`.

- [ ] **Step 3: Push**

Run: `git push -u origin phase-10-docker`
Expected: Branch angelegt bzw. aktualisiert.

- [ ] **Step 4: PR anlegen**

Run:
```bash
gh pr create --base main --head phase-10-docker --title "feat: phase 10 Docker & release" --body "$(cat <<'BODY'
## Summary

- `Dockerfile`: Node 24 stage (pnpm via corepack) builds app assets and the template kit; `serversideup/php:8.4-fpm-nginx-v4.5.1` (pinned by digest) with `intl bcmath gd apcu`, 32M body limits, 512M memory, runs as `www-data`
- `docker/entrypoint.d/99-openbill.sh`: storage folders in the volume, `APP_KEY` persisted in `storage/app/.app-key`, DB wait with timeout, `migrate --force`, `app:sync-templates`, `app:ensure-admin`, `optimize`
- `docker-compose.yml` + `.env.docker.example`: openbill (7739→8080), MariaDB 11.4 (`--log-bin-trust-function-creators=1`, healthcheck), hardened Gotenberg 8 (same flags as DDEV), internal backend network, volumes `openbill-data`/`openbill-db`
- Trusted proxies for private networks only, trusted host = host of `APP_URL`
- Images pinned by digest in Dockerfile, Compose, DDEV, CI and the e-invoice script (`DockerSetupTest` keeps them equal); e-invoice validator artefacts cached in CI
- CI job `e2e`: builds the image, starts the Compose stack (`APP_ENV=e2e` for the seeders), runs the whole Playwright suite incl. the toolkit, uploads logs on failure
- `docker.yml` (tag → amd64+arm64 to `baeroe/openbill` `X.Y.Z`/`X.Y`/`latest` + GitHub release with notes from `docs/en/upgrading.md`; PRs touching the image only build), `dockerhub.yml` (README sync)
- Docs `setup`, `reverse-proxy`, `backup`, `upgrading` (en + de), README quickstart, development guide, CLAUDE.md

## Test plan

- [x] Pest (incl. `TrustedProxiesTest`, `DockerSetupTest`, `ReleaseNotesTest`, `DocsTest`), Pint, Larastan, tsc, Vitest, docs build, actionlint
- [x] Local acceptance on Colima (arm64): build, `docker compose up -d`, login, invoice finalized, PDF/A-3 with `factur-x.xml` in the volume, toolkit ZIP with kit, MCP `tools/list` = 25, restart and recreate keep data and `APP_KEY`, backup/restore per docs
- [x] Playwright suite against the Compose stack locally
- [ ] CI: `tests`, `einvoice`, `e2e`, `image` green

No tag is pushed; the v0.1.0 release is up to the maintainer.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
BODY
)"
```
Expected: URL des PRs.

- [ ] **Step 5: CI abwarten**

Run: `gh pr checks --watch --interval 30`
Expected: `tests`, `einvoice`, `e2e` und `image` (Workflow „Docker image“, nur Build) `pass`. Dauer: `image` baut arm64 unter QEMU (20–40 min).

Schlägt `e2e` fehl: `gh run download <run-id> -n e2e-results -D "${TMPDIR:-/tmp}/openbill-e2e-results"`, `compose.log` und Traces ansehen, Ursache beheben (eigener Commit, Test wenn möglich), pushen, erneut `gh pr checks --watch`. Schlägt `image` nur für arm64 fehl: Log des Schritts `build-push-action` lesen (meist `install-php-extensions` unter QEMU); nicht die Plattform streichen, sondern beheben. **Nicht mergen, keinen Tag pushen.**

- [ ] **Step 6: Abschluss melden**

PR-URL und CI-Status an den Orchestrator melden. Der setzt nach Review und Merge den Haken für Phase 10; das Release (`git tag v0.1.0 && git push --tags`) macht der Nutzer.
