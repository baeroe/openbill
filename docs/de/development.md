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

Gotenberg läuft gehärtet, weil Templates aus fremden Paketen kommen können: Chromium führt kein JavaScript aus und darf nur Gotenbergs eigene Arbeitsdateien und `data:`-URLs laden (`.ddev/docker-compose.gotenberg.yaml`; CI startet es mit denselben Schaltern). Im Betrieb genauso starten:

```bash
gotenberg --chromium-disable-javascript=true \
  '--chromium-deny-list=^file:(?!//\/tmp/).*' '--chromium-deny-list=^(?!(file|data):).*' \
  --chromium-deny-private-ips=true --chromium-deny-public-ips=true
```

## Alltägliche Befehle

```bash
ddev artisan test                                      # Pest
ddev artisan test --filter=AuthTest                    # eine Datei oder ein Test
ddev exec vendor/bin/pint                              # PHP formatieren
ddev exec vendor/bin/phpstan analyse --memory-limit=1G # Larastan, Level 6
ddev exec pnpm typecheck                               # TypeScript
ddev exec pnpm build                                   # Produktions-Assets
ddev exec 'pnpm --filter "./prototypes/*" test'        # Klick-Prototypen
```

JavaScript-Abhängigkeiten werden im DDEV-Container installiert, `pnpm` also immer über `ddev exec` aufrufen. `ddev exec` reicht die Argumente an eine Shell im Container weiter: Befehle mit Glob-Mustern wie oben in einfache Anführungszeichen setzen. Tests nutzen eine eigene Datenbank `testing`, die DDEV beim Start anlegt.

## Sprachen

Die Oberfläche gibt es auf Englisch und Deutsch. Texte stehen in `lang/en.json` und `lang/de.json` mit denselben Schlüsseln; fehlt ein Schlüssel in einer Datei, schlägt ein Test fehl.
