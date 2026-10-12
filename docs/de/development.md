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

Gotenberg läuft gehärtet, weil Templates aus fremden Paketen kommen können: Chromium führt kein JavaScript aus und darf nur Gotenbergs eigene Arbeitsdateien und `data:`-URLs laden (`.ddev/docker-compose.gotenberg.yaml`; CI startet es mit denselben Schaltern). `docker-compose.yml` startet es mit denselben Schaltern, und alle drei Stellen (DDEV, CI, Compose) nutzen dasselbe per Digest gepinnte Image; `tests/Feature/DockerSetupTest.php` schlägt fehl, wenn sie auseinanderlaufen.

## Alltägliche Befehle

```bash
ddev artisan test                                      # Pest
ddev artisan test --filter=AuthTest                    # eine Datei oder ein Test
ddev exec vendor/bin/pint                              # PHP formatieren
ddev exec vendor/bin/phpstan analyse --memory-limit=1G # Larastan, Level 6
ddev exec pnpm typecheck                               # TypeScript
ddev exec pnpm test                                    # Vitest (resources/js)
ddev exec 'pnpm --filter "./packages/*" test'          # Workspace-Pakete (paged-preview)
ddev exec pnpm --filter @openbill/template-kit build   # nur das Template-Kit → packages/template-kit/dist/kit (pnpm build macht das mit)
pnpm --dir e2e test                                    # Playwright auf dem Mac gegen DDEV (inkl. Editor-Ablauf)
ddev exec pnpm build                                   # Produktions-Assets und Template-Kit
ddev exec 'pnpm --filter "./prototypes/*" test'        # Klick-Prototypen
```

JavaScript-Abhängigkeiten werden im DDEV-Container installiert, `pnpm` also immer über `ddev exec` aufrufen. `ddev exec` reicht die Argumente an eine Shell im Container weiter: Befehle mit Glob-Mustern wie oben in einfache Anführungszeichen setzen. Tests nutzen eine eigene Datenbank `testing`, die DDEV beim Start anlegt.

`packages/paged-preview` teilt die serverseitig gerenderten Teile eines Dokuments in Seiten auf. App, Template-Editor und Template-Toolkit nutzen das Paket; es hängt nicht von der App ab (kein Tailwind, Texte kommen als Props).

`packages/template-kit` ist das [Template-Toolkit](/de/template-toolkit): eine vorgebaute Vorschau-Seite (React, `paged-preview`), das Vite-Plugin `openbill-render` und die CLI `push`/`pull`/`pack` (`src/tooling`) sowie die Dateien für Endnutzer (`kit-files/`). `pnpm build` baut es nach `packages/template-kit/dist/kit`; der Toolkit-Download packt diesen Ordner (`OPENBILL_TOOLKIT_PATH` zeigt woandershin, ohne ihn antwortet der Download mit 503). Eine Änderung wie ein Template-Autor ausprobieren: bauen, einen Download außerhalb des Repos entpacken und dort `pnpm install && pnpm dev` starten.

## Browsertests

Die Playwright-Tests liegen in `e2e/` und laufen auf deinem Rechner gegen die DDEV-Seite (die Browser sind native Programme, die `node_modules` der App gehören dem Container). `e2e/` ist ein eigenes pnpm-Projekt mit eigenem Lockfile.

```bash
pnpm --dir e2e install                       # einmal, auf dem Host
pnpm --dir e2e exec playwright install chromium
ddev exec pnpm build                         # oder `ddev exec pnpm dev` laufen lassen
pnpm --dir e2e test                          # spielt Demo-Daten ein, dann die Tests
```

Die Tests melden sich als `e2e@example.com` an (angelegt von `Database\Seeders\E2eUserSeeder`) und ersetzen vor dem Start alle Fachdaten durch die Demo-Daten (`E2E_SKIP_SEED=1` überspringt das). `OPENBILL_URL` richtet sie auf eine andere Instanz. `toolkit.spec.ts` braucht das gebaute Template-Kit (`ddev exec pnpm build`; `pnpm dev` allein baut es nicht), Node 24, pnpm und `unzip` auf deinem Rechner; der Test entpackt einen Download in einen temporären Ordner und startet ihn mit `NODE_OPTIONS=--use-system-ca`, damit Node dem DDEV-Zertifikat vertraut.

Gegen das Docker-Image statt gegen DDEV (so macht es der CI-Job `e2e`):

```bash
docker build -t openbill:e2e .
e2e/compose.sh up -d --wait --wait-timeout 300   # docker-compose.yml + e2e-Overrides, http://localhost:7739
OPENBILL_URL=http://localhost:7739 E2E_ARTISAN="e2e/compose.sh exec -T openbill php artisan" pnpm --dir e2e test
e2e/compose.sh down -v
```

`E2E_ARTISAN` ist der Befehl, mit dem das globale Setup seedet (Standard `ddev artisan`). Der Stack läuft mit `APP_ENV=e2e`, weil die Seeder `production` verweigern; alles andere ist der Produktionsaufbau.

## Sprachen

Die Oberfläche gibt es auf Englisch und Deutsch. Texte stehen in `lang/en.json` und `lang/de.json` mit denselben Schlüsseln; fehlt ein Schlüssel in einer Datei, schlägt ein Test fehl.

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

Die Prüfwerkzeuge in `scripts/validate-einvoice.sh` (CEN-Schematron, Saxon-HE, KoSIT-Validator und seine Konfiguration) sind genauso per Version und SHA-256 gepinnt; Adresse und Prüfsumme immer zusammen ändern.

Dependabot (`.github/dependabot.yml`) öffnet wöchentlich gruppierte PRs für GitHub Actions, Composer und pnpm (Root und `e2e/`). Docker-Images lässt es absichtlich aus: die wie oben beschrieben von Hand aktualisieren.

Releases: Ein Tag `vX.Y.Z` baut `linux/amd64` und `linux/arm64`, pusht `baeroe/openbill:X.Y.Z`, `:X.Y` und `:latest` und legt das GitHub-Release mit den Hinweisen aus `### X.Y.Z` in `docs/en/upgrading.md` an (`scripts/release-notes.sh`; ohne diesen Abschnitt auf Englisch und Deutsch scheitert der Tag). Pull Requests, die das Image ändern, bauen es nur.
