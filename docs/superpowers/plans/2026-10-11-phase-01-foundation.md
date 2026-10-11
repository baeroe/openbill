# Phase 1: Fundament – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das Repo von „zwei Klickdummys“ zu einer lauffähigen Laravel-13-App im Root umbauen: DDEV (MariaDB 11.4, Node 24, Vite mit HMR, Gotenberg), Inertia v3 + React 19 + TS + Tailwind 4, Pest/Pint/Larastan, i18n en/de, Login mit Rollen und `app:ensure-admin`, VitePress-Gerüst, CLAUDE.md und CI-Job `tests`.

**Architecture:** Laravel liegt im Repo-Root (Skeleton per `composer create-project` in einen Unterordner, dann per `rsync` ins Root). Alles PHP läuft in DDEV, alle JS-Pakete werden **im DDEV-Container** mit pnpm installiert (ein Workspace: Root-App, `docs`, `prototypes/*`, später `packages/*`). Admin-URLs tragen das Sprachpräfix `/{locale}`; `SetLocale` setzt die Sprache, `HandleInertiaRequests` teilt Übersetzungen und den angemeldeten Nutzer, React liest sie über `t()`/`tn()`/`path()`.

**Tech Stack:** PHP 8.4, Laravel 13, MariaDB 11.4, inertiajs/inertia-laravel 3, @inertiajs/react 3, React 19, TypeScript 7, Tailwind 4 (`@tailwindcss/vite`), Vite 8 + laravel-vite-plugin 3, Pest 5, Pint, Larastan 3 (Level 6), VitePress 1.6 + vitepress-plugin-llms, pnpm 12 (corepack), DDEV 1.25, Gotenberg 8, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-11-openbill-app-design.md` (bindend), Master-Plan `docs/superpowers/plans/2026-10-11-openbill-app.md` (Abschnitt „Phase 1: Fundament“), Gestaltung `prototypes/clickdummy-v2/DESIGN.md` (vor Task 1: `clickdummy-v2/DESIGN.md`). Referenzprojekt mit gleicher Machart: `baeroe/prevju` (öffentlich auf GitHub; lesen per `gh api repos/baeroe/prevju/contents/<pfad> --jq .content | base64 -d`).

## Global Constraints

- Branch `phase-01-foundation` (ist ausgecheckt). Git-Identität kommt aus `~/.gitconfig`; vor dem ersten Commit `git config user.email` → muss `rafael@hauss.dev` sein, sonst stoppen und nachfragen. Nie `user.email`/`user.name` setzen.
- Jede Commit-Message endet mit der Zeile `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; die PR-Beschreibung endet mit `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- PHP, Composer, Artisan **nur in DDEV**: `ddev composer …`, `ddev artisan …`, `ddev exec …`. Auf dem Mac gibt es kein PHP.
- JS-Pakete **nur mit pnpm** (nie npm/npx; Einmal-Tools `pnpm dlx`). Installiert wird im Container: `ddev exec pnpm …`. pnpm-Workspace: Root, `packages/*`, `docs`, `prototypes/*`.
- PHP 8.4, Laravel 13, MariaDB 11.4, Node 24.
- Keine Geschäftslogik in Controllern; Geschäftsabläufe später nur in `app/Actions`, Rechnen in `app/Domain`.
- Primärschlüssel ULID (`HasUlids`) – gilt ab dieser Phase auch für `users`.
- UI-Texte nur über Schlüssel in `lang/en.json` und `lang/de.json` (gleiche Schlüssel, flach, Punkt-Namensräume, Platzhalter `:name`); Admin-URLs mit Präfix `/{locale}` (`en|de`). Code und Kommentare Englisch.
- Gestaltung nach `prototypes/clickdummy-v2/DESIGN.md` (Graphit & Kobalt); in Phase 1 nur Grundtokens (helle Farben, Radien, Schrift-Stack, Fokus), keine shadcn-Defaults, keine UI-Library.
- Doku: VitePress-Seiten in `docs/en/` **und** `docs/de/` im selben PR.
- Demo-Daten nur fiktiv; nie `lulububu`, keine echten Firmen, Hosts oder Personen (auch nicht in Tests: Beispieladressen nur `@example.com`).
- CI: Pflicht-Job heißt `tests` und muss grün sein.
- Englisches README, MIT-Lizenz (`Copyright (c) 2026 Rafael Haußmann`) bleibt unverändert.
- `CLAUDE.md` im Repo wird in dieser Phase angelegt und bei jeder späteren Änderung aktuell gehalten.

## Review Focus

- **Fremdes oder manipuliertes Sprachpräfix/Cookie:** `/fr/login` und `/fr` liefern 404; ein Cookie `locale=../../etc` wird ignoriert (Englisch). → Tests in Task 6 (`LocaleTest`).
- **Brute Force auf den Login:** Nach 5 Fehlversuchen für dieselbe E-Mail (egal in welcher Groß-/Kleinschreibung) von derselben IP ist der Login 60 s gesperrt – auch mit richtigem Passwort –, die Meldung ist übersetzt, ein anderes Konto von derselben IP ist nicht betroffen. → Test in Task 7 (`AuthTest`).
- **Sprache geht bei Weiterleitungen verloren:** Gast auf `/de` landet auf `/de/login`; angemeldeter Nutzer mit Cookie `en` auf `/de/login` landet auf `/de`; Login über `/de/login` nach einem Aufruf von `/en` landet auf `/de`; Logout aus `/de` landet auf `/de/login`. → Tests in Task 6 und Task 7.
- **`app:ensure-admin` bei jedem Containerstart:** zweiter Lauf ändert nichts (Passwort aus der UI bleibt), fehlende Variablen brechen den Start nicht ab, ungültige E-Mail oder zu kurzes Passwort brechen mit Fehler ab und legen nichts an. → Tests in Task 5 (`EnsureAdminTest`).
- **Übersetzungs- und Doku-Drift:** Schlüssel nur in einer Sprachdatei, im Code benutzter Schlüssel fehlt, Doku-Seite nur in einer Sprache. → Tests in Task 6 (`TranslationsTest`) und Task 8 (`DocsTest`).

---

## Dateistruktur nach Phase 1

```
openbill/
├─ .ddev/config.yaml, .ddev/docker-compose.gotenberg.yaml
├─ .github/workflows/tests.yml          Job `tests`
├─ .env.example, .node-version, .gitignore, .editorconfig, .gitattributes
├─ CLAUDE.md, README.md, LICENSE
├─ composer.json/.lock, phpstan.neon, phpunit.xml
├─ package.json, pnpm-workspace.yaml, pnpm-lock.yaml, tsconfig.json, vite.config.ts
├─ app/
│  ├─ Console/Commands/EnsureAdminUser.php
│  ├─ Enums/UserRole.php
│  ├─ Http/Controllers/{Controller,HomeController,LoginController}.php
│  ├─ Http/Middleware/{SetLocale,HandleInertiaRequests}.php
│  ├─ Http/Requests/LoginRequest.php
│  └─ Models/User.php
├─ config/openbill.php, config/services.php (+gotenberg)
├─ database/migrations/0001_01_01_000000_create_users_table.php (ULID, role, locale)
├─ database/factories/UserFactory.php
├─ lang/en.json, lang/de.json
├─ resources/css/app.css, resources/views/app.blade.php
├─ resources/js/{app.tsx, types.ts, lib/i18n.ts, components/locale-switch.tsx, pages/login.tsx, pages/home.tsx}
├─ routes/web.php
├─ tests/{Pest.php, TestCase.php}
├─ tests/Unit/{ArchTest,TranslationsTest,DocsTest}.php
├─ tests/Feature/{HealthTest,UserTest,EnsureAdminTest,LocaleTest,AuthTest}.php
├─ docs/package.json, docs/.vitepress/{config.ts, theme/index.ts, theme/style.css}
├─ docs/public/favicon.svg, docs/{en,de}/{index,development}.md
├─ public/favicon.svg
└─ prototypes/clickdummy/, prototypes/clickdummy-v2/
```

---

### Task 1: Klickdummys nach `prototypes/` verschieben

**Files:**
- Move: `clickdummy/` → `prototypes/clickdummy/`, `clickdummy-v2/` → `prototypes/clickdummy-v2/`
- Modify: `README.md`, `docs/superpowers/specs/2026-10-04-openbill-clickdummy-design.md` (Zeilen 5, 120, 122, 153), `.github/workflows/tests.yml`
- Unverändert lassen: `docs/superpowers/plans/2026-10-04-openbill-clickdummy.md` (historischer Plan)

**Interfaces:**
- Consumes: –
- Produces: Prototypen unter `prototypes/clickdummy` (Paketname `openbill-clickdummy`) und `prototypes/clickdummy-v2` (`openbill-clickdummy-v2`), Design-Quelle `prototypes/clickdummy-v2/DESIGN.md` und `prototypes/clickdummy-v2/src/styles/tokens.css`.

- [ ] **Step 1: Identität prüfen**

Run: `git -C /Users/rafael/development/baeroe/openbill config user.email`
Expected: `rafael@hauss.dev` (sonst stoppen und nachfragen)

- [ ] **Step 2: Verschieben**

```bash
cd /Users/rafael/development/baeroe/openbill
mkdir -p prototypes
git mv clickdummy prototypes/clickdummy
git mv clickdummy-v2 prototypes/clickdummy-v2
ls -A clickdummy clickdummy-v2
```

Expected: In den alten Ordnern liegen nur noch ignorierte Reste (`node_modules`, `dist`). Dann:

```bash
rm -rf clickdummy clickdummy-v2
```

- [ ] **Step 3: Verweise in der Klickdummy-Spec anpassen**

In `docs/superpowers/specs/2026-10-04-openbill-clickdummy-design.md` exakt ersetzen:

- Zeile 5: `` (3.4, `clickdummy-v2/DESIGN.md`). `` → `` (3.4, `prototypes/clickdummy-v2/DESIGN.md`). ``
- Zeile 120: ``> **v2 (`clickdummy-v2/`):**`` → ``> **v2 (`prototypes/clickdummy-v2/`):**``
- Zeile 122: ``- `clickdummy/` im Repo-Root (Phase 2 bekommt später eigene Ordner).`` → ``- `prototypes/clickdummy/` (ursprünglich `clickdummy/` im Repo-Root; mit Phase 1 der App nach `prototypes/` verschoben).``
- Zeile 153: ``- Details und Tokens: `clickdummy-v2/DESIGN.md`.`` → ``- Details und Tokens: `prototypes/clickdummy-v2/DESIGN.md`.``

Die App-Spec (`2026-10-11-openbill-app-design.md`) nennt bereits `prototypes/…`; nur prüfen.

- [ ] **Step 4: README-Abschnitt „Clickdummy“ anpassen**

In `README.md` ersetzen:

- `> **Status:** concept phase. This repository currently contains a clickable prototype (\`clickdummy/\`) used to settle scope and design before the real Laravel implementation.` → `> **Status:** concept phase. The clickable prototypes live in \`prototypes/\`; the real Laravel app is being built in phases.`
- im Codeblock die Zeile `cd clickdummy` → `cd prototypes/clickdummy-v2` (der vollständige README-Umbau folgt in Task 10)

- [ ] **Step 5: CI-Pfade anpassen**

`.github/workflows/tests.yml` komplett ersetzen durch (Übergangsstand bis Task 9):

```yaml
name: Tests

on:
  pull_request:
  push:
    branches: [main]

jobs:
  tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 12
      - uses: actions/setup-node@v4
        with:
          node-version-file: prototypes/clickdummy-v2/.node-version
          cache: pnpm
          cache-dependency-path: |
            prototypes/clickdummy/pnpm-lock.yaml
            prototypes/clickdummy-v2/pnpm-lock.yaml
      # Fachlogik: Summen, Steuern, Nummernkreise, Dokumentkette, Liquid-Rendering, Seitenumbruch
      - name: clickdummy
        working-directory: prototypes/clickdummy
        run: |
          pnpm install --frozen-lockfile
          pnpm typecheck
          pnpm test
          pnpm build
      - name: clickdummy-v2
        working-directory: prototypes/clickdummy-v2
        run: |
          pnpm install --frozen-lockfile
          pnpm typecheck
          pnpm test
          pnpm build
```

- [ ] **Step 6: Verweise prüfen**

Run: `git grep -n "clickdummy" -- ':!prototypes' ':!docs/superpowers/plans'`
Expected: Jeder Treffer, der einen Pfad nennt, beginnt mit `prototypes/` (oder ist der Dateiname `2026-10-04-openbill-clickdummy-design.md`).

- [ ] **Step 7: Prototypen laufen am neuen Ort (Host, einmalig)**

```bash
cd /Users/rafael/development/baeroe/openbill
pnpm --dir prototypes/clickdummy-v2 install --frozen-lockfile && pnpm --dir prototypes/clickdummy-v2 test
pnpm --dir prototypes/clickdummy install --frozen-lockfile && pnpm --dir prototypes/clickdummy test
rm -rf prototypes/clickdummy/node_modules prototypes/clickdummy-v2/node_modules prototypes/*/dist
```

Expected: beide Vitest-Läufe grün. Das `rm` ist Pflicht: ab Task 4 installiert der Workspace im Linux-Container, Host-`node_modules` würden dort stören.

- [ ] **Step 8: Commit**

```bash
git add -A prototypes README.md docs/superpowers/specs .github/workflows/tests.yml
git status --short   # darf keine gelöschten clickdummy-Dateien ohne Gegenstück zeigen
git commit -F - <<'EOF'
refactor: move clickdummies to prototypes/

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 2: DDEV und Laravel-13-Skeleton im Repo-Root

**Files:**
- Create: `.ddev/config.yaml`, `.ddev/docker-compose.gotenberg.yaml`, alle Skeleton-Dateien (`app/`, `bootstrap/`, `config/`, `database/`, `public/`, `resources/css/app.css`, `resources/views/welcome.blade.php`, `routes/`, `storage/`, `tests/`, `artisan`, `composer.json`, `composer.lock`, `phpunit.xml`, `.editorconfig`, `.gitattributes`, `.env.example`)
- Modify: `.gitignore`, `config/services.php`
- Bewusst **nicht** aus dem Skeleton übernehmen: `README.md`, `CHANGELOG.md`, `.github/`, `.styleci.yml`, `CLAUDE.md`, `AGENTS.md` (Laravel-Boost-Bootstrap), `.gitignore`, `.npmrc`, `package.json`, `vite.config.js`, `resources/js/`, `vendor/`, `composer.lock` (wird neu erzeugt)

**Interfaces:**
- Consumes: –
- Produces: DDEV-Projekt `openbill` unter `https://openbill.ddev.site`; DB-Zugang im Container `db:3306`, Nutzer/Passwort/DB `db`/`db`/`db`; zusätzliche Test-DB `testing` (per Hook); Gotenberg unter `http://gotenberg:3000` (Container-intern); Config `config('services.gotenberg.url')`; Vite-Port 5173 und VitePress-Port 5174 per HTTPS erreichbar.

- [ ] **Step 1: DDEV-Konfiguration schreiben**

`.ddev/config.yaml`:

```yaml
name: openbill
type: laravel
docroot: public
php_version: "8.4"
webserver_type: nginx-fpm
xdebug_enabled: false
database:
  type: mariadb
  version: "11.4"
composer_version: "2"
nodejs_version: "24"
corepack_enable: true
web_environment:
  - COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# Vite dev server (HMR) and VitePress dev server, reachable as https://openbill.ddev.site:5173 / :5174
web_extra_exposed_ports:
  - name: vite
    container_port: 5173
    http_port: 5172
    https_port: 5173
  - name: vitepress
    container_port: 5174
    http_port: 5175
    https_port: 5174
hooks:
  post-start:
    # separate database for Pest (phpunit.xml forces DB_DATABASE=testing)
    - exec: bash -c 'C=$(command -v mariadb || command -v mysql); $C -uroot -proot -e "CREATE DATABASE IF NOT EXISTS testing; GRANT ALL ON testing.* TO '"'"'db'"'"'@'"'"'%'"'"';"'
      service: db
```

`.ddev/docker-compose.gotenberg.yaml`:

```yaml
# Gotenberg 8 for PDF rendering, reachable from the web container as http://gotenberg:3000
services:
  gotenberg:
    container_name: ddev-${DDEV_SITENAME}-gotenberg
    image: gotenberg/gotenberg:8
    restart: "no"
    labels:
      com.ddev.site-name: ${DDEV_SITENAME}
      com.ddev.approot: ${DDEV_APPROOT}
    expose:
      - "3000"
```

- [ ] **Step 2: DDEV starten**

```bash
cd /Users/rafael/development/baeroe/openbill
mkdir -p public
ddev start
```

Expected: `Successfully started openbill` mit `https://openbill.ddev.site`. Falls der Hook mit „Access denied“ scheitert: `ddev describe` prüfen (DB-Root-Passwort ist bei DDEV `root`) und den Fehler beheben, nicht entfernen.

Run: `ddev mysql -uroot -proot -e "SHOW DATABASES" | grep -E "^(db|testing)$"`
Expected: `db` und `testing`

Run: `ddev exec curl -s http://gotenberg:3000/health`
Expected: JSON mit `"status":"up"`

- [ ] **Step 3: Skeleton in einen Unterordner erzeugen**

Nicht `ddev composer create-project` benutzen (der DDEV-Wrapper will ein leeres Projekt-Root). Stattdessen Composer direkt im Container:

```bash
ddev exec --dir /var/www/html composer create-project laravel/laravel tmp-laravel "^13.0" --prefer-dist --no-install --no-scripts --no-interaction
ls -A tmp-laravel
```

Expected: `app artisan bootstrap composer.json config database package.json phpunit.xml public resources routes storage tests vite.config.js …` (Liste kann um `AGENTS.md`/`CLAUDE.md`/`.npmrc` variieren).

- [ ] **Step 4: Skeleton ins Root übernehmen (ohne bestehende Dateien zu überschreiben)**

```bash
cd /Users/rafael/development/baeroe/openbill
rsync -a \
  --exclude README.md --exclude CHANGELOG.md --exclude .github --exclude .styleci.yml \
  --exclude CLAUDE.md --exclude AGENTS.md --exclude .gitignore --exclude .npmrc \
  --exclude package.json --exclude vite.config.js --exclude 'resources/js' \
  --exclude vendor --exclude node_modules --exclude composer.lock \
  tmp-laravel/ ./
rm -rf tmp-laravel
git status --short | grep -E "^( M|M )" || echo "no tracked file modified"
```

Expected: `no tracked file modified` (README.md, LICENSE, docs/, prototypes/, .github/ unverändert). Nur neue, untracked Dateien.

- [ ] **Step 5: `.gitignore` ersetzen**

`.gitignore` (komplett):

```gitignore
*.log
.DS_Store
.env
.env.backup
.env.production
.phpactor.json
.phpunit.result.cache
/.codex
/.cursor/
/.idea
/.nova
/.phpunit.cache
/.vscode
/.zed
/.playwright-mcp
/.superpowers/
/auth.json
node_modules/
/.pnpm-store/
/public/build
/public/fonts-manifest.dev.json
/public/hot
/public/storage
/storage/*.key
/storage/pail
/vendor
/tmp-laravel
_ide_helper.php
Homestead.json
Homestead.yaml
Thumbs.db
/docs/.vitepress/cache
/docs/.vitepress/dist
```

(`.pnpm-store`: pnpm legt seinen Store im Container ggf. im Mount-Root an.)

- [ ] **Step 6: `.env.example` für DDEV schreiben**

`.env.example` (komplett):

```dotenv
APP_NAME=openbill
APP_ENV=local
APP_KEY=
APP_DEBUG=true
APP_URL=https://openbill.ddev.site

APP_LOCALE=en
APP_FALLBACK_LOCALE=en
APP_FAKER_LOCALE=en_US

APP_MAINTENANCE_DRIVER=file

BCRYPT_ROUNDS=12

LOG_CHANNEL=stack
LOG_STACK=single
LOG_DEPRECATIONS_CHANNEL=null
LOG_LEVEL=debug

# DDEV defaults (CI overrides these via environment variables)
DB_CONNECTION=mariadb
DB_HOST=db
DB_PORT=3306
DB_DATABASE=db
DB_USERNAME=db
DB_PASSWORD=db

SESSION_DRIVER=database
SESSION_LIFETIME=120
SESSION_ENCRYPT=false
SESSION_PATH=/
SESSION_DOMAIN=null

BROADCAST_CONNECTION=log
FILESYSTEM_DISK=local
QUEUE_CONNECTION=database
CACHE_STORE=database

# DDEV ships Mailpit: https://openbill.ddev.site:8026
MAIL_MAILER=smtp
MAIL_SCHEME=null
MAIL_HOST=127.0.0.1
MAIL_PORT=1025
MAIL_USERNAME=null
MAIL_PASSWORD=null
MAIL_FROM_ADDRESS="openbill@example.com"
MAIL_FROM_NAME="${APP_NAME}"

# PDF rendering (Gotenberg 8)
GOTENBERG_URL=http://gotenberg:3000

# Owner account created by `php artisan app:ensure-admin` (local development only)
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=password

VITE_APP_NAME="${APP_NAME}"
```

- [ ] **Step 7: Gotenberg-URL in `config/services.php`**

Im Array von `config/services.php` am Ende ergänzen:

```php
    'gotenberg' => [
        'url' => env('GOTENBERG_URL', 'http://gotenberg:3000'),
    ],
```

- [ ] **Step 8: composer.json anpassen und installieren**

```bash
ddev composer config name baeroe/openbill
ddev composer config description "Open, self-hosted quotes and invoices with custom fields, Liquid templates and EN 16931 e-invoices."
ddev composer config --unset scripts.setup   # used npm
ddev composer config --unset scripts.dev     # artisan dev does not apply to DDEV
ddev composer require "php:^8.4" --no-update
ddev composer update --no-interaction
ddev composer validate
```

Expected: `./composer.json is valid`. Falls `composer config name/description` nicht unterstützt wird: die beiden Felder mit dem Edit-Tool in `composer.json` setzen.

Run: `ddev artisan --version`
Expected: `Laravel Framework 13.x.y`

- [ ] **Step 9: `.env`, Key, Migration, Health**

```bash
cp .env.example .env
ddev artisan key:generate
ddev artisan migrate --no-interaction
curl -sk -o /dev/null -w '%{http_code}\n' https://openbill.ddev.site/up
```

Expected: Migration legt `users`, `cache`, `jobs` an; `200`.

- [ ] **Step 10: Commit**

```bash
git add -A .ddev .gitignore .env.example .editorconfig .gitattributes app artisan bootstrap composer.json composer.lock config database phpunit.xml public resources routes storage tests
git status --short   # .env, vendor/ dürfen NICHT auftauchen
git commit -F - <<'EOF'
feat: add Laravel 13 skeleton with DDEV, MariaDB 11.4 and Gotenberg

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 3: Pest, Pint, Larastan und Architekturtests

**Files:**
- Modify: `composer.json`/`composer.lock`, `phpunit.xml`, `tests/TestCase.php`
- Create: `tests/Pest.php`, `tests/Unit/ArchTest.php`, `tests/Feature/HealthTest.php`, `phpstan.neon`
- Delete: `tests/Feature/ExampleTest.php`, `tests/Unit/ExampleTest.php`

**Interfaces:**
- Consumes: Test-DB `testing` aus Task 2.
- Produces: Pest-Konvention: `tests/Feature/*` laufen mit `Tests\TestCase` + `RefreshDatabase`; `tests/Unit/*` ohne Laravel-App (reines PHP, Pfade über `dirname(__DIR__, 2)`). Kommandos: `ddev artisan test`, `ddev exec vendor/bin/pint --test`, `ddev exec vendor/bin/phpstan analyse --memory-limit=1G`.

- [ ] **Step 1: Pest statt PHPUnit, Larastan installieren**

```bash
ddev composer remove --dev phpunit/phpunit --no-interaction
ddev composer require --dev "pestphp/pest:^5.3" "pestphp/pest-plugin-laravel:^5.0" --with-all-dependencies --no-interaction
ddev composer require --dev "larastan/larastan:^3.13" --no-interaction
ddev composer show pestphp/pest | grep -E "^versions"
ddev composer show larastan/larastan | grep -E "^versions"
```

Expected: Pest `v5.x`, Larastan `v3.x`. (Stand Planung: Pest 5.3.1 braucht PHP ^8.4 und PHPUnit ^13; pest-plugin-laravel 5 braucht Laravel ^13.23. Falls Composer einen Konflikt mit `nunomaduro/collision` meldet: `--with-all-dependencies` beibehalten und `nunomaduro/collision` in denselben `require --dev` aufnehmen.)

- [ ] **Step 2: Beispieltests löschen, Pest-Basis schreiben**

```bash
git rm -q tests/Feature/ExampleTest.php tests/Unit/ExampleTest.php
```

`tests/Pest.php`:

```php
<?php

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/*
 * Feature tests boot Laravel and run against the MariaDB database `testing`.
 * Unit tests are plain PHP (architecture, file consistency) and don't boot the app.
 */
pest()->extend(TestCase::class)->use(RefreshDatabase::class)->in('Feature');
```

`tests/TestCase.php`:

```php
<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite(); // CI runs tests without public/build
    }
}
```

- [ ] **Step 3: `phpunit.xml` auf MariaDB umstellen**

In `phpunit.xml` die Zeilen

```xml
        <env name="DB_CONNECTION" value="sqlite"/>
        <env name="DB_DATABASE" value=":memory:"/>
```

ersetzen durch

```xml
        <env name="DB_CONNECTION" value="mariadb" force="true"/>
        <env name="DB_DATABASE" value="testing" force="true"/>
        <env name="ADMIN_EMAIL" value="" force="true"/>
        <env name="ADMIN_PASSWORD" value="" force="true"/>
```

(Host/Nutzer/Passwort kommen aus `.env` bzw. in CI aus den Job-Variablen.)

- [ ] **Step 4: Tests schreiben**

`tests/Feature/HealthTest.php`:

```php
<?php

it('answers the health check with a migrated database', function () {
    $this->get('/up')->assertOk();
});
```

`tests/Unit/ArchTest.php`:

```php
<?php

use Illuminate\Database\Eloquent\Model;

arch('php preset')->preset()->php();

arch('security preset')->preset()->security();

arch('no debugging leftovers')
    ->expect(['dd', 'dump', 'ray', 'var_dump', 'print_r'])
    ->not->toBeUsed();

arch('models are Eloquent models')
    ->expect('App\Models')
    ->toExtend(Model::class);

arch('controllers carry the Controller suffix')
    ->expect('App\Http\Controllers')
    ->toHaveSuffix('Controller');

arch('controllers do not query the database directly')
    ->expect('App\Http\Controllers')
    ->not->toUse('Illuminate\Support\Facades\DB');
```

- [ ] **Step 5: Tests laufen lassen**

Run: `ddev artisan test`
Expected: PASS, 7 Tests (1 Feature + 6 Arch), 0 Fehler. Falls ein Preset an Skeleton-Code anschlägt: den Code anpassen, nicht das Preset entfernen; nur wenn es reiner Framework-Code ist, gezielt `->ignoring(<Klasse>)` ergänzen und im Commit begründen.

- [ ] **Step 6: Larastan konfigurieren**

`phpstan.neon`:

```neon
includes:
    - vendor/larastan/larastan/extension.neon

parameters:
    level: 6
    paths:
        - app
        - bootstrap/app.php
        - config
        - database
        - routes
```

Run: `ddev exec vendor/bin/phpstan analyse --no-progress --memory-limit=1G`
Expected: `[OK] No errors`. Fehler im Skeleton mit Typangaben beheben, keine Baseline anlegen.

- [ ] **Step 7: Pint**

Run: `ddev exec vendor/bin/pint && ddev exec vendor/bin/pint --test`
Expected: zweiter Lauf `PASS`.

- [ ] **Step 8: Commit**

```bash
git add -A composer.json composer.lock phpunit.xml phpstan.neon tests app config database routes bootstrap
git commit -F - <<'EOF'
test: switch to Pest, add Larastan level 6, Pint and architecture tests

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 4: pnpm-Workspace, Vite mit DDEV-HMR, React/TS, Tailwind-Grundtokens, Inertia-Server

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `.node-version`, `tsconfig.json`, `vite.config.ts`, `resources/js/app.tsx`, `resources/js/lib/i18n.ts`, `resources/js/types.ts`, `resources/views/app.blade.php`, `public/favicon.svg`
- Modify: `resources/css/app.css`, `composer.json`/`composer.lock`
- Delete: `prototypes/clickdummy/pnpm-lock.yaml`, `prototypes/clickdummy-v2/pnpm-lock.yaml`, `public/favicon.ico`

**Interfaces:**
- Consumes: DDEV-Projekt (Task 2), `prototypes/*` (Task 1).
- Produces:
  - `resources/js/lib/i18n.ts`: `initI18n(props: { locale?: string; translations?: Record<string, string> }): void`, `getLocale(): string`, `t(key: string, params?: Record<string, string | number>): string`, `tn(key: string, count: number): string`, `path(p: string): string`
  - `resources/js/types.ts`: `type Locale = 'en' | 'de'`, `type UserRole = 'owner' | 'member'`, `type AuthUser = { id: string; name: string; email: string; role: UserRole }`, `type SharedProps = { locale: Locale; translations: Record<string, string>; auth: { user: AuthUser | null } }`
  - Inertia-Seiten liegen unter `resources/js/pages/<name>.tsx` (kleingeschrieben), Root-View `resources/views/app.blade.php`
  - Tailwind-Utilities: Farben `bg|text-{bg,surface,surface-2,surface-3,ink,muted,faint,accent,accent-hover,accent-ink,accent-soft,ok,ok-soft,warn,warn-soft,bad,bad-soft}`, Radien `rounded-sm|md|lg|xl` = 8/12/18/24 px, `font-sans` = Schibsted-Grotesk-Stack
  - Root-Skripte: `pnpm dev`, `pnpm build`, `pnpm typecheck`

- [ ] **Step 1: Workspace-Dateien schreiben**

`.node-version`:

```
24
```

`package.json`:

```json
{
    "name": "openbill",
    "private": true,
    "type": "module",
    "packageManager": "pnpm@12.8.1",
    "engines": {
        "node": ">=24"
    },
    "scripts": {
        "dev": "vite",
        "build": "vite build",
        "typecheck": "tsc -p ."
    }
}
```

`pnpm-workspace.yaml`:

```yaml
# The root package (the Laravel app's frontend) is always part of the workspace.
packages:
  - packages/*
  - docs
  - prototypes/*

# pnpm fails on dependency build scripts nobody reviewed (strictDepBuilds).
# Allow only packages that fetch or build a native binary; block everything else explicitly.
allowBuilds: {}
```

Prototypen-Lockfiles entfernen (der Workspace hat genau ein Lockfile im Root):

```bash
git rm -q prototypes/clickdummy/pnpm-lock.yaml prototypes/clickdummy-v2/pnpm-lock.yaml
```

- [ ] **Step 2: pnpm im Container prüfen**

Run: `ddev exec pnpm --version`
Expected: `12.8.1` (corepack lädt die Version aus `packageManager`). Falls corepack scheitert: `ddev exec corepack install -g pnpm@12.8.1` und erneut prüfen.

- [ ] **Step 3: Abhängigkeiten installieren**

```bash
ddev exec pnpm add -w @inertiajs/react react react-dom
ddev exec pnpm add -w -D vite laravel-vite-plugin @vitejs/plugin-react tailwindcss @tailwindcss/vite typescript @types/react @types/react-dom
```

Wenn pnpm mit `ERR_PNPM_IGNORED_BUILDS` abbricht: Für jedes genannte Paket in `pnpm-workspace.yaml` unter `allowBuilds` eintragen – `true`, wenn es nur ein natives Binary lädt/baut (z. B. `esbuild`, `@tailwindcss/oxide`), sonst `false` – (`allowBuilds: {}` dabei durch eine Map ersetzen) und den Befehl wiederholen.

Run: `ddev exec pnpm ls -w --depth 0`
Expected (Stand Planung, Minor darf höher sein): `@inertiajs/react 3.9.x`, `react 19.3.x`, `vite 8.x`, `laravel-vite-plugin 3.2.x`, `tailwindcss 4.3.x`, `typescript 7.0.x`.

Run: `ddev exec pnpm exec tsc --version`
Expected: `Version 7.x`. Falls TypeScript 7 mit dieser Konfiguration nicht läuft: `ddev exec pnpm add -w -D typescript@~6.0` und im Commit begründen.

- [ ] **Step 4: Inertia serverseitig**

```bash
ddev composer require "inertiajs/inertia-laravel:^3.5" --no-interaction
ddev composer show inertiajs/inertia-laravel | grep -E "^versions"
```

Expected: `v3.x`.

- [ ] **Step 5: Vite-Konfiguration mit DDEV-HMR**

`vite.config.ts`:

```ts
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import path from 'node:path';
import { defineConfig } from 'vite';

// Set inside the DDEV web container, e.g. https://openbill.ddev.site
const ddevUrl = process.env.DDEV_PRIMARY_URL_WITHOUT_PORT;

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.tsx'],
            refresh: true,
        }),
        react(),
        tailwindcss(),
    ],
    resolve: {
        alias: { '@': path.resolve(import.meta.dirname, 'resources/js') },
    },
    server: {
        // DDEV routes https://openbill.ddev.site:5173 to this port inside the container
        ...(ddevUrl
            ? {
                  host: '0.0.0.0',
                  port: 5173,
                  strictPort: true,
                  origin: `${ddevUrl}:5173`,
                  cors: { origin: /https?:\/\/([A-Za-z0-9\-.]+)?(\.ddev\.site)(?::\d+)?$/ },
              }
            : {}),
        watch: {
            ignored: ['**/storage/framework/views/**', '**/vendor/**', '**/prototypes/**', '**/docs/**', '**/.pnpm-store/**'],
        },
    },
});
```

Run: `ddev exec printenv DDEV_PRIMARY_URL_WITHOUT_PORT`
Expected: `https://openbill.ddev.site`. (Fehlt die Variable in dieser DDEV-Version, `DDEV_PRIMARY_URL` verwenden und prüfen, dass sie keinen Port enthält.)

- [ ] **Step 6: TypeScript-Konfiguration**

`tsconfig.json`:

```json
{
    "compilerOptions": {
        "target": "ES2022",
        "lib": ["ES2022", "DOM", "DOM.Iterable"],
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
        "noFallthroughCasesInSwitch": true,
        "types": ["vite/client"],
        "paths": { "@/*": ["./resources/js/*"] }
    },
    "include": ["resources/js"]
}
```

- [ ] **Step 7: Tailwind-Grundtokens**

`resources/css/app.css` (komplett):

```css
/* Only resources/ is scanned: the prototypes and docs carry their own (old) classes. */
@import 'tailwindcss' source(none);
@source '../js';
@source '../views';

/*
 * Base tokens "Graphit & Kobalt" from prototypes/clickdummy-v2/src/styles/tokens.css (light only).
 * Dark mode, the Schibsted Grotesk font files and the component set follow in phase 5.
 */
:root {
    --bg: #f4f4f2;
    --surface: #ffffff;
    --surface-2: #ecece9;
    --surface-3: #e3e3df;
    --ink: #23252b;
    --muted: #73767e;
    --faint: #a2a4aa;
    --accent: #2f55d4;
    --accent-hover: #2647b8;
    --accent-ink: #ffffff;
    --accent-soft: #e3e9fb;
    --ok: #2e7d4f;
    --ok-soft: #dff0e5;
    --warn: #8f5b00;
    --warn-soft: #faefd7;
    --bad: #b4322e;
    --bad-soft: #fbe3e1;
    --font: 'Schibsted Grotesk Variable', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
    --dur: 180ms;
    --ease: cubic-bezier(0.2, 0, 0, 1);
    color-scheme: light;
}

@theme inline {
    --color-bg: var(--bg);
    --color-surface: var(--surface);
    --color-surface-2: var(--surface-2);
    --color-surface-3: var(--surface-3);
    --color-ink: var(--ink);
    --color-muted: var(--muted);
    --color-faint: var(--faint);
    --color-accent: var(--accent);
    --color-accent-hover: var(--accent-hover);
    --color-accent-ink: var(--accent-ink);
    --color-accent-soft: var(--accent-soft);
    --color-ok: var(--ok);
    --color-ok-soft: var(--ok-soft);
    --color-warn: var(--warn);
    --color-warn-soft: var(--warn-soft);
    --color-bad: var(--bad);
    --color-bad-soft: var(--bad-soft);

    --font-sans: var(--font);

    --radius-sm: 8px;
    --radius-md: 12px;
    --radius-lg: 18px;
    --radius-xl: 24px;
}

@layer base {
    body {
        background: var(--bg);
        color: var(--ink);
        font-family: var(--font);
        font-size: 0.875rem;
        -webkit-font-smoothing: antialiased;
    }

    :focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
    }
}
```

- [ ] **Step 8: Root-View, Favicon, React-Einstieg, i18n-Helfer**

`resources/views/app.blade.php`:

```blade
<!doctype html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex">
    <meta name="theme-color" content="#f4f4f2">
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/app.tsx'])
    <title>openbill</title>
    @inertiaHead
</head>
<body>
    @inertia
</body>
</html>
```

`public/favicon.svg` (und `git rm -q public/favicon.ico`):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#2F55D4"/><circle cx="16" cy="16" r="7" fill="none" stroke="#FFFFFF" stroke-width="3.5"/></svg>
```

`resources/js/types.ts`:

```ts
export type Locale = 'en' | 'de';

export type UserRole = 'owner' | 'member';

export type AuthUser = {
    id: string;
    name: string;
    email: string;
    role: UserRole;
};

/** Props every Inertia page receives (app/Http/Middleware/HandleInertiaRequests.php). */
export type SharedProps = {
    locale: Locale;
    translations: Record<string, string>;
    auth: { user: AuthUser | null };
};
```

`resources/js/lib/i18n.ts`:

```ts
type Translations = Record<string, string>;

let locale = 'en';
let translations: Translations = {};

/** Set once per page load from the shared Inertia props; switching the language reloads the page. */
export function initI18n(props: { locale?: string; translations?: Translations }): void {
    locale = props.locale ?? 'en';
    translations = props.translations ?? {};
}

export function getLocale(): string {
    return locale;
}

/** Translation for a key with :placeholders filled in. A missing key shows up as the key itself. */
export function t(key: string, params: Record<string, string | number> = {}): string {
    let text = translations[key] ?? key;
    for (const [name, value] of Object.entries(params)) text = text.replaceAll(`:${name}`, String(value));
    return text;
}

/** Singular/plural pair key.one / key.other, :count filled in. */
export function tn(key: string, count: number): string {
    return t(count === 1 ? `${key}.one` : `${key}.other`, { count });
}

/** Admin URL in the current language: path('/documents') -> '/de/documents'. */
export function path(p: string): string {
    return `/${locale}${p}`;
}
```

`resources/js/app.tsx`:

```tsx
import { createInertiaApp, router } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';
import { getLocale, initI18n } from '@/lib/i18n';
import type { SharedProps } from '@/types';

createInertiaApp({
    title: (title) => (title ? `${title} – openbill` : 'openbill'),
    resolve: (name) => {
        const pages = import.meta.glob('./pages/**/*.tsx', { eager: true });
        return pages[`./pages/${name}.tsx`] as never;
    },
    setup({ el, App, props }) {
        initI18n(props.initialPage.props as unknown as SharedProps);
        // translations are set once per page load: a visit that lands in another language reloads
        router.on('navigate', (event) => {
            if (event.detail.page.props.locale !== getLocale()) window.location.reload();
        });
        createRoot(el).render(<App {...props} />);
    },
    progress: { color: '#2F55D4', showSpinner: false },
});
```

- [ ] **Step 9: Typecheck und Build**

Run: `ddev exec pnpm typecheck && ddev exec pnpm build`
Expected: `tsc` ohne Ausgabe, Vite meldet `✓ built in …` und schreibt `public/build/manifest.json`.

- [ ] **Step 10: Prototypen im Workspace**

Run: `ddev exec pnpm --filter "./prototypes/*" run test`
Expected: Beide Pakete (`openbill-clickdummy`, `openbill-clickdummy-v2`) grün. Wichtig: Das Root-Lockfile löst die Prototyp-Abhängigkeiten neu auf (innerhalb der `^`-Bereiche). Schlägt ein Test wegen einer neueren Version fehl, die betroffene Version im Prototyp-`package.json` auf die bisher gelockte Version pinnen (alte Version per `git show HEAD~1:prototypes/<name>/pnpm-lock.yaml | grep -A2 "<paket>@"` nachsehen), nicht den Test ändern.

Run: `ddev exec pnpm --filter "./prototypes/*" run typecheck && ddev exec pnpm --filter "./prototypes/*" run build`
Expected: grün.

- [ ] **Step 11: HMR über DDEV prüfen**

```bash
ddev exec pnpm dev   # im Hintergrund laufen lassen (run_in_background), ~5 s warten
cat public/hot
curl -sk -o /dev/null -w '%{http_code}\n' https://openbill.ddev.site:5173/@vite/client
```

Expected: `public/hot` enthält `https://openbill.ddev.site:5173`; `200`. Danach Vite beenden und prüfen, dass `public/hot` gelöscht ist (sonst `rm public/hot`).

- [ ] **Step 12: PHP-Checks laufen weiter**

Run: `ddev artisan test && ddev exec vendor/bin/phpstan analyse --no-progress --memory-limit=1G`
Expected: grün.

- [ ] **Step 13: Commit**

```bash
git add -A package.json pnpm-workspace.yaml pnpm-lock.yaml .node-version tsconfig.json vite.config.ts resources public/favicon.svg prototypes composer.json composer.lock
git status --short   # public/build, public/hot, node_modules dürfen NICHT auftauchen
git commit -F - <<'EOF'
feat: add pnpm workspace, Vite with DDEV HMR, React, TypeScript, Tailwind base tokens and Inertia

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 5: Nutzer mit ULID und Rolle, `app:ensure-admin`

**Files:**
- Create: `app/Enums/UserRole.php`, `app/Console/Commands/EnsureAdminUser.php`, `config/openbill.php`, `tests/Feature/UserTest.php`, `tests/Feature/EnsureAdminTest.php`
- Modify: `database/migrations/0001_01_01_000000_create_users_table.php`, `app/Models/User.php`, `database/factories/UserFactory.php`, `tests/Unit/ArchTest.php`

**Interfaces:**
- Consumes: Pest-Setup (Task 3).
- Produces:
  - `enum App\Enums\UserRole: string { case Owner = 'owner'; case Member = 'member'; }`
  - `App\Models\User`: ULID-`id` (26 Zeichen), fillable `name, email, password, role, locale`, Cast `role` → `UserRole`, `password` → `hashed`
  - `UserFactory::owner(): static`
  - `config('openbill.admin.email')`, `config('openbill.admin.password')` (aus `ADMIN_EMAIL`/`ADMIN_PASSWORD`)
  - Artisan `app:ensure-admin` (Exit 0 bei Erfolg/fehlenden Variablen, Exit 1 bei ungültigen Werten)
  - Hinweis für Phase 4: `sessions.user_id` ist `foreignUlid`; Sanctums `personal_access_tokens` muss `ulidMorphs('tokenable')` verwenden.

- [ ] **Step 1: Fehlschlagende Tests schreiben**

`tests/Feature/UserTest.php`:

```php
<?php

use App\Enums\UserRole;
use App\Models\User;

it('uses ULIDs as primary keys', function () {
    $user = User::factory()->create();

    expect($user->id)->toBeString()->toHaveLength(26);
});

it('gives new users the member role unless stated otherwise', function () {
    expect(User::factory()->create()->role)->toBe(UserRole::Member)
        ->and(User::factory()->owner()->create()->role)->toBe(UserRole::Owner);
});

it('never exposes the password hash when serialized', function () {
    expect(User::factory()->create()->toArray())->not->toHaveKeys(['password', 'remember_token']);
});
```

`tests/Feature/EnsureAdminTest.php`:

```php
<?php

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

beforeEach(function () {
    config(['openbill.admin.email' => 'owner@example.com', 'openbill.admin.password' => 'secret-pass']);
});

it('creates the owner from ADMIN_EMAIL and ADMIN_PASSWORD', function () {
    $this->artisan('app:ensure-admin')->expectsOutputToContain('created')->assertSuccessful();

    $user = User::where('email', 'owner@example.com')->sole();
    expect($user->role)->toBe(UserRole::Owner)
        ->and(Hash::check('secret-pass', $user->password))->toBeTrue();
});

it('leaves an existing user untouched when it runs again on the next start', function () {
    $this->artisan('app:ensure-admin')->assertSuccessful();
    User::where('email', 'owner@example.com')->sole()->update(['password' => 'changed-in-the-ui']);

    $this->artisan('app:ensure-admin')->expectsOutputToContain('already exists')->assertSuccessful();

    expect(User::count())->toBe(1)
        ->and(Hash::check('changed-in-the-ui', User::sole()->password))->toBeTrue();
});

it('skips without failing when the variables are not set', function () {
    config(['openbill.admin.email' => null, 'openbill.admin.password' => '']);

    $this->artisan('app:ensure-admin')->expectsOutputToContain('not set')->assertSuccessful();

    expect(User::count())->toBe(0);
});

it('fails and creates nothing for invalid values', function (string $email, string $password) {
    config(['openbill.admin.email' => $email, 'openbill.admin.password' => $password]);

    $this->artisan('app:ensure-admin')->assertFailed();

    expect(User::count())->toBe(0);
})->with([
    'invalid email' => ['not-an-email', 'secret-pass'],
    'short password' => ['owner@example.com', 'short'],
]);
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `ddev artisan test --filter="UserTest|EnsureAdminTest"`
Expected: FAIL – `Class "App\Enums\UserRole" not found` bzw. `Command "app:ensure-admin" is not defined`.

- [ ] **Step 3: Migration anpassen**

In `database/migrations/0001_01_01_000000_create_users_table.php` die `users`- und `sessions`-Definition ersetzen (die Tabelle `password_reset_tokens` bleibt):

```php
        Schema::create('users', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('name');
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            $table->string('role', 16)->default('member');
            $table->string('locale', 2)->nullable();
            $table->rememberToken();
            $table->timestamps();
        });
```

```php
        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignUlid('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
```

- [ ] **Step 4: Enum, Model, Factory, Config, Command**

`app/Enums/UserRole.php`:

```php
<?php

namespace App\Enums;

enum UserRole: string
{
    /** Full access including users and settings; the account from app:ensure-admin. */
    case Owner = 'owner';

    /** Works with documents and customers. */
    case Member = 'member';
}
```

`app/Models/User.php`:

```php
<?php

namespace App\Models;

use App\Enums\UserRole;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable(['name', 'email', 'password', 'role', 'locale'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, HasUlids, Notifiable;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'role' => UserRole::class,
        ];
    }
}
```

`database/factories/UserFactory.php` – in `definition()` den Eintrag `'role' => UserRole::Member,` nach `'password'` ergänzen, `use App\Enums\UserRole;` importieren und diese Methode anhängen:

```php
    /**
     * The owner account (full access).
     */
    public function owner(): static
    {
        return $this->state(fn (array $attributes) => [
            'role' => UserRole::Owner,
        ]);
    }
```

`config/openbill.php`:

```php
<?php

return [
    /*
     * Owner account created on start by `php artisan app:ensure-admin`.
     * Read through config (not env()) so it also works with a cached config.
     */
    'admin' => [
        'email' => env('ADMIN_EMAIL'),
        'password' => env('ADMIN_PASSWORD'),
    ],
];
```

`app/Console/Commands/EnsureAdminUser.php`:

```php
<?php

namespace App\Console\Commands;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;

/**
 * Runs on every container start: creates the owner once, never changes an existing account.
 */
class EnsureAdminUser extends Command
{
    protected $signature = 'app:ensure-admin';

    protected $description = 'Create the owner account from ADMIN_EMAIL / ADMIN_PASSWORD if it does not exist yet';

    public function handle(): int
    {
        $email = config('openbill.admin.email');
        $password = config('openbill.admin.password');

        if (! is_string($email) || $email === '' || ! is_string($password) || $password === '') {
            $this->warn('ADMIN_EMAIL / ADMIN_PASSWORD not set, skipping.');

            return self::SUCCESS;
        }

        $validator = Validator::make(
            ['email' => $email, 'password' => $password],
            ['email' => ['email'], 'password' => ['min:8']],
        );

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $message) {
                $this->error($message);
            }

            return self::FAILURE;
        }

        if (User::where('email', $email)->exists()) {
            $this->info("Admin user {$email} already exists, left unchanged.");

            return self::SUCCESS;
        }

        User::create(['name' => 'Admin', 'email' => $email, 'password' => $password, 'role' => UserRole::Owner]);
        $this->info("Admin user {$email} created.");

        return self::SUCCESS;
    }
}
```

`tests/Unit/ArchTest.php` – anhängen:

```php
arch('enums are backed enums')
    ->expect('App\Enums')
    ->toBeStringBackedEnums();
```

- [ ] **Step 5: Tests laufen lassen**

Run: `ddev artisan test --filter="UserTest|EnsureAdminTest"`
Expected: PASS (8 Tests inkl. 2 Dataset-Fälle).

- [ ] **Step 6: Lokale DB neu aufsetzen und Kommando echt ausführen**

```bash
ddev artisan migrate:fresh --no-interaction
ddev artisan app:ensure-admin
ddev artisan app:ensure-admin
```

Expected: erst `Admin user admin@example.com created.`, dann `… already exists, left unchanged.`

- [ ] **Step 7: Alle Checks**

Run: `ddev artisan test && ddev exec vendor/bin/pint --test && ddev exec vendor/bin/phpstan analyse --no-progress --memory-limit=1G`
Expected: alles grün.

- [ ] **Step 8: Commit**

```bash
git add app config/openbill.php database tests
git commit -F - <<'EOF'
feat: add ULID users with owner/member role and app:ensure-admin

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 6: i18n (en/de), Sprachpräfix, Shared Props, Login-Seite und Startseite

**Files:**
- Create: `lang/en.json`, `lang/de.json`, `app/Http/Middleware/SetLocale.php`, `app/Http/Middleware/HandleInertiaRequests.php`, `app/Http/Controllers/HomeController.php`, `app/Http/Controllers/LoginController.php` (nur `show`), `resources/js/components/locale-switch.tsx`, `resources/js/pages/login.tsx`, `resources/js/pages/home.tsx`, `tests/Feature/LocaleTest.php`, `tests/Unit/TranslationsTest.php`
- Modify: `bootstrap/app.php`, `routes/web.php`
- Delete: `resources/views/welcome.blade.php`

**Interfaces:**
- Consumes: `i18n.ts`, `types.ts`, `app.blade.php` (Task 4); `User`, `UserRole` (Task 5).
- Produces:
  - `App\Http\Middleware\SetLocale::LOCALES` (`['en', 'de']`), `SetLocale::fromRequest(Request $request): string`
  - Request-Attribut `locale` (aufgelöste Sprache); Route-Parameter `locale` wird nach dem Auflösen entfernt (Controller bekommen ihn nie als Argument); `URL::defaults(['locale' => …])` ist gesetzt, `route('home')` braucht also kein Locale-Argument.
  - Cookie `locale` (für Pfade ohne Präfix)
  - Shared Props: `locale`, `translations`, `auth.user` (`id`, `name`, `email`, `role`)
  - Routen: `GET /{locale}/login` (`login`, guest), `GET /{locale}` (`home`, auth), `GET /` und `GET /login` → Weiterleitung mit Sprache
  - Inertia-Seiten `login`, `home`; Komponente `LocaleSwitch`

- [ ] **Step 1: Fehlschlagende Tests schreiben**

`tests/Unit/TranslationsTest.php`:

```php
<?php

it('has the same keys in English and German', function () {
    $keys = fn (string $locale): array => array_keys(json_decode(
        (string) file_get_contents(dirname(__DIR__, 2)."/lang/{$locale}.json"),
        true,
        flags: JSON_THROW_ON_ERROR,
    ));

    expect(array_values(array_diff($keys('en'), $keys('de'))))->toBe([], 'missing in de.json')
        ->and(array_values(array_diff($keys('de'), $keys('en'))))->toBe([], 'missing in en.json');
});

it('defines every key used in code', function () {
    $root = dirname(__DIR__, 2);
    $en = json_decode((string) file_get_contents("{$root}/lang/en.json"), true, flags: JSON_THROW_ON_ERROR);
    $files = [
        ...(glob("{$root}/resources/js/{,*/,*/*/,*/*/*/}*.{ts,tsx}", GLOB_BRACE) ?: []),
        ...(glob("{$root}/app/{,*/,*/*/,*/*/*/}*.php", GLOB_BRACE) ?: []),
        ...(glob("{$root}/resources/views/*.blade.php") ?: []),
    ];
    $code = implode("\n", array_map(fn (string $file): string => (string) file_get_contents($file), $files));

    preg_match_all("/\\b(t|tn|__)\\(\\s*'([a-z_]+(?:\\.[a-z_]+)+)'/", $code, $matches, PREG_SET_ORDER);
    $used = array_values(array_unique(array_merge(...array_map(
        fn (array $m): array => $m[1] === 'tn' ? ["{$m[2]}.one", "{$m[2]}.other"] : [$m[2]],
        $matches,
    ))));

    expect($used)->not->toBeEmpty('texts should go through t()/tn()/__()')
        ->and(array_values(array_diff($used, array_keys($en))))->toBe([]);
});
```

`tests/Feature/LocaleTest.php`:

```php
<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

$translation = fn (string $key, string $expected) => fn ($translations) => ($translations[$key] ?? null) === $expected;

it('is English by default whatever the browser says', function () use ($translation) {
    $this->withHeader('Accept-Language', 'de-DE,de;q=0.9')->get('/en/login')
        ->assertOk()
        ->assertSee('lang="en"', false)
        ->assertInertia(fn (Assert $page) => $page
            ->component('login')
            ->where('locale', 'en')
            ->where('translations', $translation('login.submit', 'Log in')));
});

it('takes the language from the prefix and remembers it', function () use ($translation) {
    $this->get('/de/login')
        ->assertSee('lang="de"', false)
        ->assertCookie('locale', 'de')
        ->assertInertia(fn (Assert $page) => $page
            ->where('locale', 'de')
            ->where('translations', $translation('login.submit', 'Anmelden')));
});

it('sends unprefixed entry points to the remembered language', function () {
    $this->get('/')->assertRedirect('/en');
    $this->get('/login')->assertRedirect('/en/login');
    $this->withCookie('locale', 'de')->get('/')->assertRedirect('/de');
    $this->withCookie('locale', 'de')->get('/login')->assertRedirect('/de/login');
});

it('answers unknown language prefixes with 404', function () {
    $this->get('/fr/login')->assertNotFound();
    $this->get('/fr')->assertNotFound();
});

it('ignores a manipulated language cookie', function () {
    $this->withCookie('locale', '../../etc')->get('/')->assertRedirect('/en');
});

it('keeps the language when a guest is sent to the login', function () {
    $this->get('/de')->assertRedirect('/de/login');
});

it('sends a signed-in user from the login to the start page in the URL language', function () {
    $this->actingAs(User::factory()->create())
        ->withCookie('locale', 'en')
        ->get('/de/login')
        ->assertRedirect('/de');
});

it('shows the start page with the signed-in user but without secrets', function () {
    $user = User::factory()->owner()->create(['name' => 'Anna Berg', 'email' => 'anna@example.com']);

    $this->actingAs($user)->get('/de')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('home')
            ->where('locale', 'de')
            ->where('auth.user.id', $user->id)
            ->where('auth.user.email', 'anna@example.com')
            ->where('auth.user.role', 'owner')
            ->missing('auth.user.password'));
});

it('shares no user with guests', function () {
    $this->get('/en/login')->assertInertia(fn (Assert $page) => $page->where('auth.user', null));
});
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `ddev artisan test --filter="LocaleTest|TranslationsTest"`
Expected: FAIL (fehlende `lang/en.json`, Routen 404).

- [ ] **Step 3: Sprachdateien**

`lang/en.json`:

```json
{
    "common.logout": "Log out",
    "home.placeholder": "Documents, customers and templates will show up here.",
    "home.signed_in_as": "Signed in as :name.",
    "home.title": "Overview",
    "locale.de": "Deutsch",
    "locale.en": "English",
    "locale.switch": "Language",
    "login.email": "Email",
    "login.failed": "Email or password is incorrect.",
    "login.password": "Password",
    "login.submit": "Log in",
    "login.throttled": "Too many login attempts. Please try again in :seconds seconds.",
    "login.title": "Log in"
}
```

`lang/de.json`:

```json
{
    "common.logout": "Abmelden",
    "home.placeholder": "Hier erscheinen bald Dokumente, Kunden und Templates.",
    "home.signed_in_as": "Angemeldet als :name.",
    "home.title": "Übersicht",
    "locale.de": "Deutsch",
    "locale.en": "English",
    "locale.switch": "Sprache",
    "login.email": "E-Mail",
    "login.failed": "E-Mail oder Passwort stimmen nicht.",
    "login.password": "Passwort",
    "login.submit": "Anmelden",
    "login.throttled": "Zu viele Anmeldeversuche. Bitte in :seconds Sekunden erneut versuchen.",
    "login.title": "Anmelden"
}
```

(`login.failed`/`login.throttled` werden in Task 7 im Code benutzt; sie stehen schon hier, damit beide Dateien vollständig sind.)

- [ ] **Step 4: Middleware**

`app/Http/Middleware/SetLocale.php`:

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Routing\Route;
use Illuminate\Support\Facades\URL;
use Symfony\Component\HttpFoundation\Response;

/**
 * Admin URLs carry the language as /en|/de prefix; it is remembered in the cookie `locale`,
 * which unprefixed entry points (/ and /login) use. Default: English, never the browser language.
 */
class SetLocale
{
    /** @var list<string> */
    public const array LOCALES = ['en', 'de'];

    /**
     * The language of this request. Also usable before this middleware ran
     * (auth runs earlier because of the middleware priority).
     */
    public static function fromRequest(Request $request): string
    {
        $resolved = $request->attributes->get('locale');
        if (is_string($resolved)) {
            return $resolved;
        }

        $route = $request->route();
        $prefix = $route instanceof Route ? $route->parameter('locale') : null;
        if (is_string($prefix) && in_array($prefix, self::LOCALES, true)) {
            return $prefix;
        }

        $cookie = $request->cookie('locale');

        return is_string($cookie) && in_array($cookie, self::LOCALES, true) ? $cookie : 'en';
    }

    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $locale = self::fromRequest($request);
        $route = $request->route();
        $fromPrefix = $route instanceof Route && $route->hasParameter('locale');

        app()->setLocale($locale);
        URL::defaults(['locale' => $locale]);
        $request->attributes->set('locale', $locale);
        // controllers never get the prefix as an argument (it would shift model bindings)
        if ($route instanceof Route) {
            $route->forgetParameter('locale');
        }

        $response = $next($request);

        if ($fromPrefix && $request->cookie('locale') !== $locale) {
            $response->headers->setCookie(cookie()->forever('locale', $locale));
        }

        return $response;
    }
}
```

`app/Http/Middleware/HandleInertiaRequests.php`:

```php
<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    /**
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $locale = app()->getLocale();

        return [
            ...parent::share($request),
            'locale' => $locale,
            'translations' => fn (): array => File::json(lang_path("{$locale}.json")),
            'auth' => [
                'user' => fn (): ?array => $request->user()?->only(['id', 'name', 'email', 'role']),
            ],
        ];
    }
}
```

`bootstrap/app.php` (komplett):

```php
<?php

use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\SetLocale;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->web(append: [SetLocale::class, HandleInertiaRequests::class]);
        // auth runs before SetLocale (middleware priority), so resolve the language here as well
        $middleware->redirectGuestsTo(fn (Request $request) => route('login', ['locale' => SetLocale::fromRequest($request)]));
        $middleware->redirectUsersTo(fn (Request $request) => route('home', ['locale' => SetLocale::fromRequest($request)]));
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
```

- [ ] **Step 5: Controller und Routen**

`app/Http/Controllers/HomeController.php`:

```php
<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use Inertia\Response;

/** Minimal start page after login; the app shell arrives in phase 5. */
class HomeController extends Controller
{
    public function __invoke(): Response
    {
        return Inertia::render('home');
    }
}
```

`app/Http/Controllers/LoginController.php` (Task 7 ergänzt `store`/`destroy`):

```php
<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use Inertia\Response;

class LoginController extends Controller
{
    public function show(): Response
    {
        return Inertia::render('login');
    }
}
```

`routes/web.php` (komplett):

```php
<?php

use App\Http\Controllers\HomeController;
use App\Http\Controllers\LoginController;
use Illuminate\Support\Facades\Route;

// admin: the language is part of the URL (/en/…, /de/…)
Route::prefix('{locale}')->where(['locale' => 'en|de'])->group(function (): void {
    Route::middleware('guest')->group(function (): void {
        Route::get('/login', [LoginController::class, 'show'])->name('login');
    });

    Route::middleware('auth')->group(function (): void {
        Route::get('/', HomeController::class)->name('home');
    });
});

// unprefixed entry points go to the remembered language (cookie), default English
Route::get('/', fn () => redirect('/'.app()->getLocale()));
Route::get('/login', fn () => redirect('/'.app()->getLocale().'/login'));
```

```bash
git rm -q resources/views/welcome.blade.php
```

- [ ] **Step 6: React-Seiten**

`resources/js/components/locale-switch.tsx`:

```tsx
import { getLocale, t } from '@/lib/i18n';
import type { Locale } from '@/types';

/** Same page in the other language. A full page load, because translations are loaded once per page. */
export function LocaleSwitch() {
    const labels: Record<Locale, string> = { en: t('locale.en'), de: t('locale.de') };
    const href = (locale: Locale) =>
        window.location.pathname.replace(/^\/(en|de)(?=\/|$)/, `/${locale}`) + window.location.search;

    return (
        <nav aria-label={t('locale.switch')} className="flex gap-1">
            {(Object.keys(labels) as Locale[]).map((locale) => (
                <a
                    key={locale}
                    href={href(locale)}
                    lang={locale}
                    aria-current={locale === getLocale() ? 'true' : undefined}
                    className="rounded-full px-3 py-1 text-muted hover:bg-surface-2 aria-[current=true]:bg-accent-soft aria-[current=true]:text-accent"
                >
                    {labels[locale]}
                </a>
            ))}
        </nav>
    );
}
```

`resources/js/pages/login.tsx`:

```tsx
import { Head, useForm } from '@inertiajs/react';
import { LocaleSwitch } from '@/components/locale-switch';
import { path, t } from '@/lib/i18n';

const field = 'h-[2.375rem] w-full rounded-md bg-surface-2 px-3 text-ink placeholder:text-faint';

export default function Login() {
    const form = useForm({ email: '', password: '' });

    return (
        <main className="relative grid min-h-dvh place-items-center px-6 py-16">
            <Head title={t('login.title')} />
            <div className="absolute top-4 right-6">
                <LocaleSwitch />
            </div>
            <div className="w-full max-w-sm rounded-xl bg-surface p-8">
                <p className="text-xl font-bold tracking-tight">openbill</p>
                <h1 className="sr-only">{t('login.title')}</h1>
                <form
                    className="mt-8 grid gap-5"
                    onSubmit={(e) => {
                        e.preventDefault();
                        form.post(path('/login'), { onFinish: () => form.reset('password') });
                    }}
                >
                    <div className="grid gap-2">
                        <label htmlFor="email" className="font-medium">
                            {t('login.email')}
                        </label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="username"
                            spellCheck={false}
                            className={field}
                            value={form.data.email}
                            onChange={(e) => form.setData('email', e.target.value)}
                            aria-invalid={!!form.errors.email}
                            aria-describedby={form.errors.email ? 'login-error' : undefined}
                            autoFocus
                            required
                        />
                    </div>
                    <div className="grid gap-2">
                        <label htmlFor="password" className="font-medium">
                            {t('login.password')}
                        </label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            className={field}
                            value={form.data.password}
                            onChange={(e) => form.setData('password', e.target.value)}
                            required
                        />
                    </div>
                    {form.errors.email && (
                        <p id="login-error" role="alert" className="rounded-md bg-bad-soft px-3 py-2 text-bad">
                            {form.errors.email}
                        </p>
                    )}
                    <button
                        type="submit"
                        disabled={form.processing}
                        className="mt-2 h-[2.375rem] rounded-full bg-accent font-medium text-accent-ink hover:bg-accent-hover disabled:opacity-60"
                    >
                        {t('login.submit')}
                    </button>
                </form>
            </div>
        </main>
    );
}
```

`resources/js/pages/home.tsx`:

```tsx
import { Head, router, usePage } from '@inertiajs/react';
import { LocaleSwitch } from '@/components/locale-switch';
import { path, t } from '@/lib/i18n';
import type { SharedProps } from '@/types';

export default function Home() {
    const { auth } = usePage<SharedProps>().props;

    return (
        <main className="mx-auto grid min-h-dvh max-w-2xl content-center gap-6 px-6 py-16">
            <Head title={t('home.title')} />
            <header className="flex items-center justify-between gap-4">
                <h1 className="text-[1.625rem] font-bold tracking-tight">{t('home.title')}</h1>
                <LocaleSwitch />
            </header>
            <section className="grid gap-3 rounded-lg bg-surface p-8">
                <p>{t('home.signed_in_as', { name: auth.user?.name ?? '' })}</p>
                <p className="text-muted">{t('home.placeholder')}</p>
                <button
                    type="button"
                    onClick={() => router.post(path('/logout'))}
                    className="mt-2 h-8 justify-self-start rounded-full bg-surface-2 px-4 font-medium hover:bg-surface-3"
                >
                    {t('common.logout')}
                </button>
            </section>
        </main>
    );
}
```

- [ ] **Step 7: Tests laufen lassen**

Run: `ddev artisan test --filter="LocaleTest|TranslationsTest"`
Expected: PASS (11 Tests).

- [ ] **Step 8: Alle Checks**

Run: `ddev artisan test && ddev exec vendor/bin/pint --test && ddev exec vendor/bin/phpstan analyse --no-progress --memory-limit=1G && ddev exec pnpm typecheck && ddev exec pnpm build`
Expected: alles grün.

- [ ] **Step 9: Commit**

```bash
git add -A app bootstrap/app.php routes lang resources tests
git commit -F - <<'EOF'
feat: add en/de i18n with locale prefix, login page and start page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 7: Anmelden, Abmelden, Login-Drosselung

**Files:**
- Create: `app/Http/Requests/LoginRequest.php`, `tests/Feature/AuthTest.php`
- Modify: `app/Http/Controllers/LoginController.php`, `routes/web.php`

**Interfaces:**
- Consumes: `SetLocale` (URL-Defaults), Routen `login`/`home`, Übersetzungen `login.failed`/`login.throttled` (Task 6), `User` (Task 5).
- Produces:
  - `POST /{locale}/login` (guest, zusätzlich `throttle:20,1` je IP), `POST /{locale}/logout` (`logout`, auth)
  - `App\Http\Requests\LoginRequest::authenticate(): void` (wirft `ValidationException` auf `email`), Drosselung: 5 Fehlversuche je `lower(email)|ip`, Sperre 60 s
  - Nach Login: Weiterleitung auf die vorher angefragte Seite, aber in der Sprache des Logins; sonst `home`.

- [ ] **Step 1: Fehlschlagende Tests schreiben**

`tests/Feature/AuthTest.php`:

```php
<?php

use App\Models\User;

beforeEach(function () {
    $this->user = User::factory()->create(['email' => 'anna@example.com', 'password' => 'secret-pass']);
});

it('logs in and lands on the start page in the language of the login', function () {
    $this->post('/de/login', ['email' => 'anna@example.com', 'password' => 'secret-pass'])
        ->assertRedirect(url('/de'));

    $this->assertAuthenticatedAs($this->user);
});

it('rejects a wrong password with a translated message', function () {
    $this->post('/de/login', ['email' => 'anna@example.com', 'password' => 'wrong'])
        ->assertSessionHasErrors(['email' => 'E-Mail oder Passwort stimmen nicht.']);

    $this->assertGuest();
});

it('validates the form', function () {
    $this->post('/en/login', ['email' => 'not-an-email', 'password' => ''])
        ->assertSessionHasErrors(['email', 'password']);
});

it('returns to the page that asked for the login, in the language of the login', function () {
    $this->get('/en')->assertRedirect('/en/login');

    $this->post('/de/login', ['email' => 'anna@example.com', 'password' => 'secret-pass'])
        ->assertRedirect(url('/de'));
});

it('logs out and returns to the login in the same language', function () {
    $this->actingAs($this->user)->post('/de/logout')->assertRedirect(url('/de/login'));

    $this->assertGuest();
});

it('locks the login for a minute after five failed attempts for the same email', function () {
    foreach (['anna@example.com', 'Anna@Example.com', 'ANNA@example.com', 'anna@example.com', 'anna@EXAMPLE.com'] as $email) {
        $this->post('/en/login', ['email' => $email, 'password' => 'wrong'])->assertSessionHasErrors('email');
    }

    // even the right password is refused while locked
    $this->post('/en/login', ['email' => 'anna@example.com', 'password' => 'secret-pass'])
        ->assertSessionHasErrors('email');
    $this->assertGuest();
    expect(session('errors')->first('email'))->toContain('Too many login attempts');

    // another account from the same address is not affected
    User::factory()->create(['email' => 'ben@example.com', 'password' => 'secret-pass']);
    $this->post('/en/login', ['email' => 'ben@example.com', 'password' => 'secret-pass'])
        ->assertRedirect(url('/en'));
    auth()->logout();

    $this->travel(61)->seconds();
    $this->post('/en/login', ['email' => 'anna@example.com', 'password' => 'secret-pass'])
        ->assertRedirect(url('/en'));
    $this->assertAuthenticatedAs($this->user);
});

it('shows the lock message in German on the German login', function () {
    foreach (range(1, 5) as $attempt) {
        $this->post('/de/login', ['email' => 'anna@example.com', 'password' => 'wrong']);
    }

    $this->post('/de/login', ['email' => 'anna@example.com', 'password' => 'wrong']);

    expect(session('errors')->first('email'))->toContain('Zu viele Anmeldeversuche');
});
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `ddev artisan test --filter=AuthTest`
Expected: FAIL – `405 Method Not Allowed` für `POST /de/login`.

- [ ] **Step 3: LoginRequest**

`app/Http/Requests/LoginRequest.php`:

```php
<?php

namespace App\Http\Requests;

use Illuminate\Auth\Events\Lockout;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LoginRequest extends FormRequest
{
    private const int MAX_ATTEMPTS = 5;

    private const int DECAY_SECONDS = 60;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<string>>
     */
    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ];
    }

    /**
     * @throws ValidationException
     */
    public function authenticate(): void
    {
        $this->ensureIsNotRateLimited();

        if (! Auth::attempt($this->only('email', 'password'), remember: true)) {
            RateLimiter::hit($this->throttleKey(), self::DECAY_SECONDS);

            throw ValidationException::withMessages(['email' => __('login.failed')]);
        }

        RateLimiter::clear($this->throttleKey());
    }

    private function ensureIsNotRateLimited(): void
    {
        if (! RateLimiter::tooManyAttempts($this->throttleKey(), self::MAX_ATTEMPTS)) {
            return;
        }

        event(new Lockout($this));

        throw ValidationException::withMessages([
            'email' => __('login.throttled', ['seconds' => RateLimiter::availableIn($this->throttleKey())]),
        ]);
    }

    /** One bucket per account and address; the email is case-insensitive like the database collation. */
    private function throttleKey(): string
    {
        return Str::transliterate(Str::lower($this->string('email')->value()).'|'.$this->ip());
    }
}
```

- [ ] **Step 4: Controller und Routen**

`app/Http/Controllers/LoginController.php` (komplett):

```php
<?php

namespace App\Http\Controllers;

use App\Http\Requests\LoginRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class LoginController extends Controller
{
    public function show(): Response
    {
        return Inertia::render('login');
    }

    public function store(LoginRequest $request): RedirectResponse
    {
        $request->authenticate();
        $request->session()->regenerate();

        // back to the page that asked for the login, but in the language the login was done in
        $intended = $request->session()->pull('url.intended', route('home'));
        $target = is_string($intended)
            ? preg_replace('#^('.preg_quote(url('/'), '#').')/(en|de)(?=/|$)#', '$1/'.app()->getLocale(), $intended)
            : null;

        return redirect()->to($target ?? route('home'));
    }

    public function destroy(Request $request): RedirectResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login');
    }
}
```

In `routes/web.php` die beiden Gruppen ersetzen durch:

```php
    Route::middleware('guest')->group(function (): void {
        Route::get('/login', [LoginController::class, 'show'])->name('login');
        // per-account lockout lives in LoginRequest; this caps password spraying per address
        Route::post('/login', [LoginController::class, 'store'])->middleware('throttle:20,1');
    });

    Route::middleware('auth')->group(function (): void {
        Route::get('/', HomeController::class)->name('home');
        Route::post('/logout', [LoginController::class, 'destroy'])->name('logout');
    });
```

- [ ] **Step 5: Tests laufen lassen**

Run: `ddev artisan test --filter=AuthTest`
Expected: PASS (7 Tests).

- [ ] **Step 6: Alle Checks**

Run: `ddev artisan test && ddev exec vendor/bin/pint --test && ddev exec vendor/bin/phpstan analyse --no-progress --memory-limit=1G && ddev exec pnpm typecheck`
Expected: alles grün.

- [ ] **Step 7: Im Browser prüfen**

```bash
ddev exec pnpm build
```

Mit Playwright-MCP (`browser_navigate` auf `https://openbill.ddev.site/en/login`): mit `admin@example.com` / `password` anmelden → Startseite „Overview“ mit „Signed in as Admin.“; „Deutsch“ klicken → `/de`, „Übersicht“; „Abmelden“ → `/de/login`. Falsches Passwort → Meldung unter den Feldern. `browser_console_messages` ohne Fehler. (Wenn der Browser das DDEV-Zertifikat ablehnt: Prüfung per curl aus Task 11 Step 4.)

- [ ] **Step 8: Commit**

```bash
git add app routes tests
git commit -F - <<'EOF'
feat: add login, logout and per-account login throttling

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 8: VitePress-Gerüst (en/de) mit Seiten `index` und `development`

**Files:**
- Create: `docs/package.json`, `docs/.vitepress/config.ts`, `docs/.vitepress/theme/index.ts`, `docs/.vitepress/theme/style.css`, `docs/public/favicon.svg`, `docs/en/index.md`, `docs/de/index.md`, `docs/en/development.md`, `docs/de/development.md`, `tests/Unit/DocsTest.php`
- Modify: `pnpm-workspace.yaml`, `pnpm-lock.yaml`

**Interfaces:**
- Consumes: pnpm-Workspace (Task 4), DDEV-Port 5174 (Task 2).
- Produces: Doku-Seiten unter `docs/en/<name>.md` und `docs/de/<name>.md` (gleiche Dateinamen, interne Links immer mit Präfix `/en/…`/`/de/…`); Sidebar-Liste `pages` in `docs/.vitepress/config.ts` (spätere Phasen hängen ihre Seiten dort an); `llms.txt` aus `docs/en`; Kommandos `ddev exec pnpm --dir docs dev` (https://openbill.ddev.site:5174/en/) und `pnpm --dir docs build`.

- [ ] **Step 1: Fehlschlagenden Test schreiben**

`tests/Unit/DocsTest.php`:

```php
<?php

it('has every docs page in English and German', function () {
    $pages = fn (string $locale): array => array_map('basename', glob(dirname(__DIR__, 2)."/docs/{$locale}/*.md") ?: []);

    expect($pages('en'))->not->toBeEmpty()
        ->toEqualCanonicalizing($pages('de'));
});

it('lists every English page in the sidebar', function () {
    $root = dirname(__DIR__, 2);
    $config = (string) file_get_contents("{$root}/docs/.vitepress/config.ts");
    $pages = array_map(fn (string $f): string => basename($f, '.md'), glob("{$root}/docs/en/*.md") ?: []);

    foreach (array_diff($pages, ['index']) as $page) {
        expect($config)->toContain("'{$page}'");
    }
});
```

Run: `ddev artisan test --filter=DocsTest`
Expected: FAIL (`docs/en` leer, `config.ts` fehlt).

- [ ] **Step 2: Paket und Abhängigkeiten**

`docs/package.json`:

```json
{
    "name": "openbill-docs",
    "private": true,
    "type": "module",
    "scripts": {
        "dev": "vitepress dev --host 0.0.0.0 --port 5174",
        "build": "vitepress build",
        "preview": "vitepress preview"
    }
}
```

In `pnpm-workspace.yaml` ergänzen (VitePress 1.x pinnt Vite 5 mit bekannten Dev-Server-Lücken; nur VitePress bekommt Vite 6, die App bleibt auf Vite 8):

```yaml
overrides:
  vitepress>vite: ^6.4.3
```

```bash
ddev exec pnpm --dir docs add -D vitepress@^1.6.4 vitepress-plugin-llms@^1.14.0
ddev exec pnpm --dir docs why vite
```

Expected: `vite 6.x` unter `vitepress`. Bei `ERR_PNPM_IGNORED_BUILDS`: wie in Task 4 Step 3 verfahren (`esbuild: true`; `vue-demi` o. ä. Postinstall ohne Binary: `false`). Prüfen, ob es inzwischen ein stabiles VitePress 2 gibt: `ddev exec pnpm view vitepress dist-tags` – ist `latest` ≥ 2, ohne Override und mit `vitepress@latest` installieren.

- [ ] **Step 3: Konfiguration und Theme**

`docs/.vitepress/config.ts`:

```ts
import { defineConfig, type DefaultTheme } from 'vitepress';
import llmstxt from 'vitepress-plugin-llms';

// every page exists in docs/en and docs/de under the same file name (tests/Unit/DocsTest.php)
const pages = ['development'];

const sidebar = (prefix: string, t: Record<string, string>): DefaultTheme.SidebarItem[] => [
    { text: t.guide, items: pages.map((p) => ({ text: t[p], link: `${prefix}/${p}` })) },
];

const en: Record<string, string> = {
    guide: 'Guide',
    development: 'Development',
};

const de: Record<string, string> = {
    guide: 'Anleitung',
    development: 'Entwicklung',
};

export default defineConfig({
    title: 'openbill',
    cleanUrls: true,
    lastUpdated: true,
    // docs/history is the project's memory, docs/superpowers holds specs and plans: not part of the site
    srcExclude: ['history/**', 'superpowers/**', 'README.md'],
    head: [
        ['link', { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }],
        ['meta', { name: 'theme-color', content: '#f4f4f2' }],
    ],
    appearance: false,
    // agents get the English docs only
    vite: { plugins: [llmstxt({ workDir: 'en' })] },

    locales: {
        root: {
            label: 'English',
            lang: 'en',
            // English lives under /en like German under /de; links without a prefix are redirected in the theme
            link: '/en/',
            description: 'Open, self-hosted quotes and invoices with custom fields, Liquid templates and e-invoices.',
            themeConfig: {
                nav: [{ text: 'Guide', link: '/en/development' }],
                sidebar: sidebar('/en', en),
                editLink: { pattern: 'https://github.com/baeroe/openbill/edit/main/docs/:path', text: 'Edit this page' },
                footer: { message: 'Released under the MIT License.', copyright: '© 2026 Rafael Haußmann' },
            },
        },
        de: {
            label: 'Deutsch',
            lang: 'de',
            link: '/de/',
            description: 'Offene, selbst gehostete Angebote und Rechnungen mit eigenen Feldern, Liquid-Templates und E-Rechnung.',
            themeConfig: {
                nav: [{ text: 'Anleitung', link: '/de/development' }],
                sidebar: sidebar('/de', de),
                editLink: { pattern: 'https://github.com/baeroe/openbill/edit/main/docs/:path', text: 'Seite bearbeiten' },
                footer: { message: 'Veröffentlicht unter der MIT-Lizenz.', copyright: '© 2026 Rafael Haußmann' },
                outline: { label: 'Auf dieser Seite' },
                docFooter: { prev: 'Zurück', next: 'Weiter' },
                lastUpdated: { text: 'Zuletzt aktualisiert' },
                langMenuLabel: 'Sprache wechseln',
                returnToTopLabel: 'Nach oben',
                sidebarMenuLabel: 'Menü',
                skipToContentLabel: 'Zum Inhalt springen',
                notFound: {
                    title: 'Seite nicht gefunden',
                    quote: 'Diese Seite gibt es nicht (mehr).',
                    linkLabel: 'Zur Startseite',
                    linkText: 'Zur Startseite',
                },
            },
        },
    },

    themeConfig: {
        logo: { src: '/favicon.svg', alt: '' },
        socialLinks: [{ icon: 'github', link: 'https://github.com/baeroe/openbill' }],
        search: {
            provider: 'local',
            options: {
                locales: {
                    de: {
                        translations: {
                            button: { buttonText: 'Suchen', buttonAriaLabel: 'Suchen' },
                            modal: {
                                noResultsText: 'Keine Ergebnisse für',
                                resetButtonTitle: 'Suche zurücksetzen',
                                displayDetails: 'Details anzeigen',
                                footer: { selectText: 'auswählen', navigateText: 'navigieren', closeText: 'schließen' },
                            },
                        },
                    },
                },
            },
        },
    },
});
```

`docs/.vitepress/theme/index.ts`:

```ts
import { inBrowser } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import './style.css';

// pages live under /en and /de: links without a prefix (/, /development) land in English
if (inBrowser && !/^\/(en|de)(\/|$)/.test(location.pathname)) {
    location.replace(`/en${location.pathname}${location.search}${location.hash}`);
}

export default DefaultTheme;
```

`docs/.vitepress/theme/style.css`:

```css
/* openbill tokens (prototypes/clickdummy-v2/DESIGN.md, "Graphit & Kobalt"), mapped onto VitePress variables */
:root {
    --vp-font-family-base: 'Schibsted Grotesk Variable', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;

    --vp-c-bg: #f4f4f2;
    --vp-c-bg-alt: #ffffff;
    --vp-c-bg-elv: #ffffff;
    --vp-c-bg-soft: #ecece9;
    --vp-c-text-1: #23252b;
    --vp-c-text-2: #73767e;
    --vp-c-text-3: #a2a4aa;
    --vp-c-divider: #e3e3df;
    --vp-c-gutter: #e3e3df;

    --vp-c-brand-1: #2f55d4;
    --vp-c-brand-2: #2647b8;
    --vp-c-brand-3: #2f55d4;
    --vp-c-brand-soft: #e3e9fb;

    --vp-button-brand-bg: #2f55d4;
    --vp-button-brand-hover-bg: #2647b8;
    --vp-button-brand-text: #ffffff;
}
```

`docs/public/favicon.svg`: identisch mit `public/favicon.svg` aus Task 4 (`cp public/favicon.svg docs/public/favicon.svg`).

- [ ] **Step 4: Seiten**

`docs/en/index.md`:

```markdown
---
layout: home

hero:
  name: openbill
  text: Quotes and invoices the way you need them.
  tagline: Open source and self-hosted. Your own fields on every level, your own PDF templates in Liquid, and EN 16931 e-invoices out of the box.
  actions:
    - theme: brand
      text: Development setup
      link: /en/development
    - theme: alt
      text: GitHub
      link: https://github.com/baeroe/openbill

features:
  - title: Your own fields
    details: Add fields to your organisation, customers, contacts, documents and line items, and use them in your templates.
  - title: Your own templates
    details: Templates are HTML, CSS and Liquid, rendered to PDF on the server. A local toolkit gives you a live preview.
  - title: E-invoices
    details: Invoices can follow EN 16931 and ship as PDF/A-3 with embedded XML (ZUGFeRD).
  - title: Built for agents
    details: Everything you can do in the UI also works through a REST API and an MCP server.
---

::: warning Work in progress
openbill is being built in phases. These pages grow with every phase.
:::
```

`docs/de/index.md`:

```markdown
---
layout: home

hero:
  name: openbill
  text: Angebote und Rechnungen, wie du sie brauchst.
  tagline: Open Source und selbst gehostet. Eigene Felder auf jeder Ebene, eigene PDF-Templates in Liquid und E-Rechnungen nach EN 16931.
  actions:
    - theme: brand
      text: Entwicklungsumgebung
      link: /de/development
    - theme: alt
      text: GitHub
      link: https://github.com/baeroe/openbill

features:
  - title: Eigene Felder
    details: Felder für Organisation, Kunden, Ansprechpartner, Dokumente und Positionen anlegen und in Templates verwenden.
  - title: Eigene Templates
    details: Templates sind HTML, CSS und Liquid und werden auf dem Server zu PDF. Ein lokales Toolkit zeigt eine Live-Vorschau.
  - title: E-Rechnung
    details: Rechnungen können EN 16931 erfüllen und als PDF/A-3 mit eingebetteter XML (ZUGFeRD) entstehen.
  - title: Für Agenten gebaut
    details: Alles, was in der Oberfläche geht, geht auch über eine REST-API und einen MCP-Server.
---

::: warning In Arbeit
openbill entsteht in Phasen. Diese Seiten wachsen mit jeder Phase.
:::
```

`docs/en/development.md`:

````markdown
# Development

openbill runs locally in [DDEV](https://ddev.com): PHP 8.4, MariaDB 11.4, Node 24 with pnpm, Vite with hot reload, Mailpit and Gotenberg. You don't need PHP or Composer on your machine.

## Requirements

- DDEV 1.25 or newer with a Docker provider (for example Colima or OrbStack)
- Git

## First start

```bash
git clone https://github.com/baeroe/openbill.git
cd openbill
cp .env.example .env
ddev start
ddev composer install
ddev artisan key:generate
ddev artisan migrate
ddev artisan app:ensure-admin   # creates admin@example.com / password from .env
ddev exec pnpm install
ddev exec pnpm dev              # Vite with hot reload, keep it running
```

Open <https://openbill.ddev.site/en/login> and log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`.

## Services

| What | Where |
|---|---|
| App | `https://openbill.ddev.site` (`/en/…` and `/de/…`) |
| Vite dev server | `https://openbill.ddev.site:5173` |
| Mailpit | `ddev mailpit` |
| Gotenberg (PDF) | `http://gotenberg:3000` inside the containers |
| Database | `ddev mysql`, user/password/database `db` |
| These docs | `ddev exec pnpm --dir docs dev` → `https://openbill.ddev.site:5174/en/` |

## Everyday commands

```bash
ddev artisan test                                      # Pest
ddev artisan test --filter=AuthTest                    # one file or test
ddev exec vendor/bin/pint                              # format PHP
ddev exec vendor/bin/phpstan analyse --memory-limit=1G # Larastan, level 6
ddev exec pnpm typecheck                               # TypeScript
ddev exec pnpm build                                   # production assets
ddev exec pnpm --filter "./prototypes/*" test          # clickable prototypes
```

JavaScript dependencies are installed inside the DDEV container, so always run `pnpm` through `ddev exec`. Tests use their own database `testing`, which DDEV creates on start.

## Languages

The interface is English and German. Texts live in `lang/en.json` and `lang/de.json` with the same keys; a test fails if a key is missing in one of them.
````

`docs/de/development.md`:

````markdown
# Entwicklung

openbill läuft lokal in [DDEV](https://ddev.com): PHP 8.4, MariaDB 11.4, Node 24 mit pnpm, Vite mit Hot Reload, Mailpit und Gotenberg. PHP oder Composer brauchst du auf deinem Rechner nicht.

## Voraussetzungen

- DDEV 1.25 oder neuer mit einem Docker-Anbieter (zum Beispiel Colima oder OrbStack)
- Git

## Erster Start

```bash
git clone https://github.com/baeroe/openbill.git
cd openbill
cp .env.example .env
ddev start
ddev composer install
ddev artisan key:generate
ddev artisan migrate
ddev artisan app:ensure-admin   # legt admin@example.com / password aus der .env an
ddev exec pnpm install
ddev exec pnpm dev              # Vite mit Hot Reload, laufen lassen
```

<https://openbill.ddev.site/de/login> öffnen und mit `ADMIN_EMAIL` / `ADMIN_PASSWORD` aus der `.env` anmelden.

## Dienste

| Was | Wo |
|---|---|
| App | `https://openbill.ddev.site` (`/en/…` und `/de/…`) |
| Vite-Dev-Server | `https://openbill.ddev.site:5173` |
| Mailpit | `ddev mailpit` |
| Gotenberg (PDF) | `http://gotenberg:3000` innerhalb der Container |
| Datenbank | `ddev mysql`, Nutzer/Passwort/Datenbank `db` |
| Diese Doku | `ddev exec pnpm --dir docs dev` → `https://openbill.ddev.site:5174/de/` |

## Alltägliche Befehle

```bash
ddev artisan test                                      # Pest
ddev artisan test --filter=AuthTest                    # eine Datei oder ein Test
ddev exec vendor/bin/pint                              # PHP formatieren
ddev exec vendor/bin/phpstan analyse --memory-limit=1G # Larastan, Level 6
ddev exec pnpm typecheck                               # TypeScript
ddev exec pnpm build                                   # Produktions-Assets
ddev exec pnpm --filter "./prototypes/*" test          # Klick-Prototypen
```

JavaScript-Abhängigkeiten werden im DDEV-Container installiert, `pnpm` also immer über `ddev exec` aufrufen. Tests nutzen eine eigene Datenbank `testing`, die DDEV beim Start anlegt.

## Sprachen

Die Oberfläche gibt es auf Englisch und Deutsch. Texte stehen in `lang/en.json` und `lang/de.json` mit denselben Schlüsseln; fehlt ein Schlüssel in einer Datei, schlägt ein Test fehl.
````

- [ ] **Step 5: Tests und Build**

Run: `ddev artisan test --filter=DocsTest && ddev exec pnpm --dir docs build`
Expected: Tests PASS; VitePress `build complete`, `docs/.vitepress/dist/llms.txt` existiert, `docs/.vitepress/dist/en/development.html` und `…/de/development.html` existieren, kein Ordner `superpowers` in `dist`.

Run: `ls docs/.vitepress/dist | grep -c superpowers`
Expected: `0`

- [ ] **Step 6: Commit**

```bash
git add docs/package.json docs/.vitepress/config.ts docs/.vitepress/theme docs/public docs/en docs/de pnpm-workspace.yaml pnpm-lock.yaml tests/Unit/DocsTest.php
git status --short   # docs/.vitepress/dist und cache dürfen NICHT auftauchen
git commit -F - <<'EOF'
docs: add VitePress site with English and German development guide

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 9: CI-Job `tests`

**Files:**
- Modify: `.github/workflows/tests.yml` (komplett ersetzen)

**Interfaces:**
- Consumes: alle Kommandos aus Task 3–8; `.node-version`, `packageManager` in `package.json`.
- Produces: Pflicht-Check `tests` (Name unverändert); spätere Phasen hängen Schritte an diesen Job an (z. B. Vitest) oder legen eigene Jobs an (`e2e`).

- [ ] **Step 1: Workflow schreiben**

`.github/workflows/tests.yml`:

```yaml
name: Tests

on:
  pull_request:
  push:
    branches: [main]

jobs:
  # required check: the name must stay `tests`
  tests:
    runs-on: ubuntu-latest

    services:
      mariadb:
        image: mariadb:11.4
        env:
          MARIADB_ROOT_PASSWORD: root
          MARIADB_DATABASE: testing
          MARIADB_USER: db
          MARIADB_PASSWORD: db
        ports:
          - 3306:3306
        options: >-
          --health-cmd="healthcheck.sh --connect --innodb_initialized"
          --health-interval=5s
          --health-timeout=5s
          --health-retries=20
      gotenberg:
        image: gotenberg/gotenberg:8
        ports:
          - 3000:3000

    env:
      DB_CONNECTION: mariadb
      DB_HOST: 127.0.0.1
      DB_PORT: 3306
      DB_DATABASE: testing
      DB_USERNAME: db
      DB_PASSWORD: db
      GOTENBERG_URL: http://127.0.0.1:3000

    steps:
      - uses: actions/checkout@v4

      - uses: shivammathur/setup-php@v2
        with:
          php-version: '8.4'
          extensions: intl, zip, bcmath, gd, pdo_mysql
          coverage: none

      # version comes from "packageManager" in package.json
      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version-file: .node-version
          cache: pnpm

      - name: Composer
        run: composer install --no-interaction --no-progress --prefer-dist

      - name: Environment
        run: cp .env.example .env && php artisan key:generate

      - name: Pint
        run: vendor/bin/pint --test

      - name: Larastan
        run: vendor/bin/phpstan analyse --no-progress --memory-limit=1G

      - name: pnpm install
        run: pnpm install --frozen-lockfile

      - name: TypeScript
        run: pnpm typecheck

      - name: Build
        run: pnpm build

      - name: Pest
        run: php artisan test

      - name: Gotenberg reachable
        run: curl -fsS http://127.0.0.1:3000/health

      # domain logic of the clickable prototypes (sums, taxes, numbering, chain, Liquid, page breaks)
      - name: Prototypes
        run: |
          pnpm --filter "./prototypes/*" run typecheck
          pnpm --filter "./prototypes/*" run test
          pnpm --filter "./prototypes/*" run build

      - name: Docs
        run: pnpm --dir docs build
```

- [ ] **Step 2: Workflow lokal prüfen**

Run: `pnpm dlx @action-validator/cli .github/workflows/tests.yml` (auf dem Host; Einmal-Tool)
Expected: keine Fehler. Falls das Tool nicht verfügbar ist: `ruby -ryaml -e 'YAML.load_file(".github/workflows/tests.yml")' && echo ok` bzw. `python3 -c 'import yaml,sys; yaml.safe_load(open(".github/workflows/tests.yml")); print("ok")'`.

Run: `grep -n "^  tests:" .github/workflows/tests.yml`
Expected: genau ein Treffer.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/tests.yml
git commit -F - <<'EOF'
ci: run Pint, Larastan, Pest, TypeScript, build, prototypes and docs in the tests job

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 10: CLAUDE.md und README

**Files:**
- Create: `CLAUDE.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: Stand aller vorherigen Tasks.
- Produces: `CLAUDE.md` als verbindliche Arbeitsregeln für spätere Phasen (Doku in jedem PR, Kommandos über DDEV, Actions-Regel, pnpm-Regel, Fallstricke).

- [ ] **Step 1: `CLAUDE.md` schreiben**

`CLAUDE.md`:

````markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Diese Datei aktuell halten.** Wer Stack, Ablauf, Kommandos oder Konventionen ändert, passt CLAUDE.md im selben Commit an. Veraltete Angaben hier sind schlimmer als keine.

**Die Doku (`docs/`, VitePress) ist Teil jeder Änderung.** Jede Änderung, die Nutzer, Betreiber oder Entwickler betrifft (Verhalten, Setup, Umgebungsvariablen, Routen, API, MCP-Tools, UI-Abläufe, Templates), passt im selben PR die betroffenen Seiten an, **auf Englisch (`docs/en/`) und Deutsch (`docs/de/`)**. Kein Merge mit veralteter Doku. Reine Refactorings ohne sichtbare Auswirkung brauchen keine Doku.

Spec und Pläne: `docs/superpowers/specs/2026-10-11-openbill-app-design.md` (bindend), Master-Plan `docs/superpowers/plans/2026-10-11-openbill-app.md`, Phasenpläne daneben. Projektgedächtnis: `docs/history/` (falls vorhanden).

## Was openbill ist

Offenes, selbst gehostetes Programm für Angebote, Auftragsbestätigungen, Rechnungen und Stornos mit eigenen Feldern, eigenen Liquid-Templates (Rendering nur serverseitig, PDF über Gotenberg) und E-Rechnung (EN 16931). Steuerbar über UI, REST-API und MCP. Wird in Phasen gebaut; Stand: Phase 1 (Fundament: Login, i18n, Tooling).

## Tech Stack

- PHP 8.4, Laravel 13, MariaDB 11.4, Inertia v3 + React 19 + TypeScript, Tailwind 4, Vite 8 (`laravel-vite-plugin`)
- Tests: Pest 5 (Feature gegen MariaDB-DB `testing`, Unit ohne App), Larastan Level 6, Pint
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
ddev exec vendor/bin/pint                    # PHP formatieren (CI: --test)
ddev exec vendor/bin/phpstan analyse --memory-limit=1G
ddev exec pnpm typecheck                     # tsc
ddev exec pnpm build
ddev exec pnpm --filter "./prototypes/*" test
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

## Architektur (Stand Phase 1)

- Routen (`routes/web.php`): Admin unter Sprachpräfix `/{locale}` (`en|de`): `GET|POST /{locale}/login` (guest), `POST /{locale}/logout`, `GET /{locale}` = Startseite `home` (auth). `/` und `/login` leiten in die zuletzt genutzte Sprache um (Cookie `locale`, sonst `en`). Unbekanntes Präfix → 404.
- `app/Http/Middleware/SetLocale.php`: Sprache aus Präfix, sonst Cookie, sonst `en` (nie `Accept-Language`). Setzt `URL::defaults(['locale' => …])` und das Request-Attribut `locale`, merkt die Sprache im Cookie und **entfernt den Routenparameter `locale`**, damit Controller ihn nie als Argument bekommen (sonst verrutschen Model-Bindings). `SetLocale::fromRequest()` funktioniert auch vor der Middleware (Auth läuft wegen der Middleware-Priorität früher) und wird in `bootstrap/app.php` für `redirectGuestsTo`/`redirectUsersTo` genutzt.
- `app/Http/Middleware/HandleInertiaRequests.php`: Shared Props `locale`, `translations` (ganze JSON-Datei der Sprache), `auth.user` (`id`, `name`, `email`, `role`). TS-Typ: `SharedProps` in `resources/js/types.ts`. Sprachwechsel lädt die Seite neu (`resources/js/app.tsx`).
- Login: `app/Http/Requests/LoginRequest.php` sperrt nach 5 Fehlversuchen je `lower(email)|IP` für 60 s; Route zusätzlich `throttle:20,1` je IP. Nach Login zurück zur angefragten Seite, aber in der Sprache des Logins.
- Nutzer: ULID, `role` (`App\Enums\UserRole`: `owner`/`member`), `locale` (nullable). `php artisan app:ensure-admin` liest `config('openbill.admin.*')` (= `ADMIN_EMAIL`/`ADMIN_PASSWORD`), legt einmalig einen Owner an, ändert bestehende Konten nie, überspringt ohne Variablen, bricht bei ungültiger E-Mail oder Passwort < 8 Zeichen ab.
- Gotenberg: `config('services.gotenberg.url')` (`GOTENBERG_URL`, DDEV: `http://gotenberg:3000`).

## Doku

VitePress in `docs/`, Englisch unter `docs/en/` (Locale `root` mit `link: '/en/'`), Deutsch unter `docs/de/`, gleiche Dateinamen; Pfade ohne Präfix leitet `docs/.vitepress/theme/index.ts` auf `/en/…` um. Interne Links immer mit Präfix. Neue Seite: Datei in beiden Sprachen anlegen und den Namen in `pages` in `docs/.vitepress/config.ts` eintragen (`tests/Unit/DocsTest.php` prüft beides). `docs/history/` und `docs/superpowers/` sind per `srcExclude` nicht Teil der Website. `llms.txt` enthält nur die englischen Seiten. `pnpm-workspace.yaml` überschreibt `vitepress>vite` auf ^6.4.3 (VitePress 1.x pinnt Vite 5); entfernen, sobald VitePress 2 stabil ist.

## Fallstricke

- `public/hot` bleibt liegen, wenn Vite hart beendet wird; dann lädt die Seite Assets vom toten Dev-Server. `rm public/hot`.
- Tests laufen ohne Vite-Build (`withoutVite()` in `tests/TestCase.php`); Inertia-Tests prüfen, dass `resources/js/pages/<name>.tsx` existiert.
- `phpunit.xml` erzwingt `DB_DATABASE=testing` (DDEV-Hook legt sie bei `ddev start` an; in CI der MariaDB-Service).
- Tailwind scannt nur `resources/` (`@import 'tailwindcss' source(none)` + `@source`), sonst landen Klassen aus Prototypen und Doku im CSS.
- `users.id` ist eine ULID: Sanctum (Phase 4) braucht `ulidMorphs('tokenable')` in `personal_access_tokens`; `sessions.user_id` ist bereits `foreignUlid`.
- `ddev composer create-project` nicht benutzen (der DDEV-Wrapper will ein leeres Root).
- Laravel Boost wird nicht genutzt; es gibt kein `AGENTS.md`.
````

- [ ] **Step 2: README aktualisieren**

`README.md` (komplett):

````markdown
# openbill

Open, self-hosted quotes and invoices. Define your own fields for documents and line items, write your own PDF templates in Liquid, and get German/EU e-invoices (EN 16931, ZUGFeRD/XRechnung) out of the box.

> **Status:** under construction. The Laravel app is being built in phases; phase 1 (foundation: login, English/German UI, tooling, docs) is in place. The clickable prototypes in `prototypes/` show where it is going.

## What it does (planned)

- Four document types: quote, order confirmation, invoice, cancellation, with simple statuses and one-click conversion along the chain
- A fixed core plus **custom fields** on every level: organisation, customer, contact, document, line item
- Line items in **groups** with subtotals
- **Compliance profiles** per document type: *Basic* (international) or *E-Invoice EN 16931* with required fields and embedded XML
- VAT handling: regular, small business (§ 19 UStG), EU reverse charge, third countries
- **Templates** as portable packages (HTML + CSS + Liquid + manifest), rendered to PDF with Gotenberg, with a local toolkit for live preview
- REST API and MCP server for agents
- Runs as a Docker Compose stack

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

## Prototypes

```bash
ddev exec pnpm --filter "./prototypes/*" test
```

`prototypes/clickdummy-v2` is the current design reference (see its [`DESIGN.md`](prototypes/clickdummy-v2/DESIGN.md)); `prototypes/clickdummy` is the first draft.

Design spec: [`docs/superpowers/specs/2026-10-11-openbill-app-design.md`](docs/superpowers/specs/2026-10-11-openbill-app-design.md)

## License

[MIT](LICENSE)
````

- [ ] **Step 3: Verweise prüfen**

Run: `git grep -n "clickdummy" -- README.md CLAUDE.md | grep -v "prototypes/"`
Expected: keine Treffer.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md README.md
git commit -F - <<'EOF'
docs: add CLAUDE.md and update README for the app foundation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 11: Abnahme, Push und Pull Request

**Files:** keine neuen (nur Korrekturen, falls die Abnahme etwas findet).

**Interfaces:**
- Consumes: alles.
- Produces: Branch `phase-01-foundation` auf `origin`, offener PR gegen `main` (nicht gemergt).

- [ ] **Step 1: Frischer Start wie in der Abnahme**

```bash
cd /Users/rafael/development/baeroe/openbill
ddev restart
ddev composer install
ddev exec pnpm install
ddev artisan migrate:fresh --no-interaction
ddev artisan app:ensure-admin
ddev exec curl -s http://gotenberg:3000/health
```

Expected: alle Befehle ohne Fehler; `Admin user admin@example.com created.`; Gotenberg `"status":"up"`.

- [ ] **Step 2: Alle Checks wie in CI**

```bash
ddev exec vendor/bin/pint --test
ddev exec vendor/bin/phpstan analyse --no-progress --memory-limit=1G
ddev artisan test
ddev exec pnpm typecheck
ddev exec pnpm build
ddev exec pnpm --filter "./prototypes/*" run typecheck
ddev exec pnpm --filter "./prototypes/*" run test
ddev exec pnpm --filter "./prototypes/*" run build
ddev exec pnpm --dir docs build
```

Expected: alles grün; Pest meldet alle Tests aus `tests/Unit` und `tests/Feature` als PASS.

- [ ] **Step 3: HMR prüfen**

`ddev exec pnpm dev` im Hintergrund starten, dann:

```bash
cat public/hot
curl -sk -o /dev/null -w '%{http_code}\n' https://openbill.ddev.site:5173/@vite/client
```

Expected: `https://openbill.ddev.site:5173`, `200`. Mit Playwright-MCP `https://openbill.ddev.site/en/login` öffnen, `browser_network_requests` zeigt Assets von `:5173`; einen Text in `resources/js/pages/login.tsx` testweise ändern → Seite aktualisiert sich ohne Reload (danach Änderung zurücknehmen). Vite beenden, `public/hot` ist weg.

- [ ] **Step 4: Login auf `/en/login` und `/de/login`**

Mit Playwright-MCP: auf `https://openbill.ddev.site/en/login` und `https://openbill.ddev.site/de/login` jeweils mit `admin@example.com` / `password` anmelden → `/en` „Overview“ bzw. `/de` „Übersicht“; abmelden. Screenshot nicht committen.

Fallback per curl (falls der Browser das Zertifikat ablehnt):

```bash
J=$(mktemp)
curl -sk -c "$J" -b "$J" -o /dev/null https://openbill.ddev.site/de/login
X=$(awk '$6=="XSRF-TOKEN"{print $7}' "$J" | python3 -c 'import sys,urllib.parse;print(urllib.parse.unquote(sys.stdin.read().strip()))')
curl -sk -c "$J" -b "$J" -H "X-XSRF-TOKEN: $X" -d 'email=admin@example.com&password=password' \
  -o /dev/null -w '%{http_code} %{redirect_url}\n' https://openbill.ddev.site/de/login
curl -sk -b "$J" https://openbill.ddev.site/de | grep -o '"component":"home"'
```

Expected: `302 https://openbill.ddev.site/de`, dann `"component":"home"`. Dasselbe mit `/en/login` → `302 https://openbill.ddev.site/en`.

- [ ] **Step 5: Vor dem Push prüfen**

```bash
git config user.email                                  # rafael@hauss.dev
git status --short                                     # leer
git log --format='%an <%ae>%n%b' main..HEAD | grep -E "<|Co-Authored" | sort | uniq -c
git grep -n -i "lulububu" || echo "clean"
git ls-files | grep -E "\.env$|^vendor/|node_modules/|public/build/|public/hot" || echo "no artifacts"
```

Expected: nur `Rafael Haußmann <rafael@hauss.dev>` als Autor, jede Nachricht mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; `clean`; `no artifacts`.

- [ ] **Step 6: Push und PR**

```bash
git push -u origin phase-01-foundation
gh pr create --base main --head phase-01-foundation --title "Phase 1: Foundation" --body-file - <<'EOF'
## Summary

- Clickdummies moved to `prototypes/` (paths in README, specs and CI updated); one pnpm workspace with a single lockfile
- Laravel 13 in the repo root, DDEV (PHP 8.4, MariaDB 11.4, Node 24/pnpm via corepack, Vite HMR on :5173, Gotenberg 8, test database `testing`)
- Inertia v3 + React 19 + TypeScript 7 + Tailwind 4 with the base "Graphit & Kobalt" tokens
- Pest 5, Pint, Larastan level 6, first architecture tests
- English/German UI: `/{locale}` prefix, `SetLocale`, shared translations, `t()`/`tn()`/`path()`
- Login/logout with per-account throttling, ULID users with `owner`/`member` role, `app:ensure-admin`
- VitePress docs (en/de) with the development guide, `llms.txt`
- `CLAUDE.md`, README, CI job `tests` (PHP + MariaDB + Gotenberg services, Pint, Larastan, Pest, tsc, build, prototypes, docs)

## Test plan

- [ ] CI `tests` green
- [ ] `ddev start && ddev composer install && ddev exec pnpm install && ddev artisan migrate` works on a fresh clone
- [ ] Login with the `app:ensure-admin` user on `/en/login` and `/de/login`
- [ ] `ddev exec pnpm dev` serves HMR via `https://openbill.ddev.site:5173`
- [ ] `ddev artisan test` and `pnpm --dir docs build` green

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
```

- [ ] **Step 7: CI beobachten**

Run: `gh pr checks --watch`
Expected: `tests` pass. Bei Fehlern: Ursache beheben, als `fix: …`-Commit (mit Co-Authored-By-Zeile) pushen, erneut beobachten. **Nicht mergen.**
