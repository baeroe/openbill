# Einrichtung mit Docker Compose

openbill läuft als Docker-Compose-Stack: die App (`baeroe/openbill`, für `linux/amd64` und `linux/arm64`), MariaDB 11.4 und Gotenberg 8, das die PDFs erzeugt. Du brauchst Docker mit Compose v2 und für HTTPS einen Reverse Proxy davor (siehe [Reverse Proxy](/de/reverse-proxy)).

::: tip Deine Instanz, deine Verantwortung
openbill ist keine Steuer- oder Rechtsberatung und kommt ohne Gewährleistung (MIT-Lizenz). Ob deine Rechnungen und dein Archiv die für dich geltenden Vorschriften erfüllen (z. B. GoBD), klärst du mit deiner Steuerberatung; siehe [E-Rechnung](/de/e-invoice).
:::

## Schnellstart: einfügen und starten

Eine Compose-Datei mit allem drin, ohne `.env`:

1. Füge den Block unten in Dockge oder Portainer als neuen Stack ein oder speichere ihn auf deinem Server als `compose.yaml`.
2. Ändere die vier Werte ganz oben: `APP_URL` (die https-Adresse deines Reverse Proxys), `ADMIN_EMAIL`, `ADMIN_PASSWORD` und `DB_PASSWORD`. Solange ein Passwort noch `change-me` lautet, startet openbill nicht.
3. Starte den Stack (Dockge/Portainer: Deploy) oder führe `docker compose up -d` aus. Warte im Log von `openbill` auf `openbill: ready` und öffne dann `APP_URL`. openbill lauscht für deinen Reverse Proxy auf `http://127.0.0.1:7739`.

Das Owner-Konto entsteht beim ersten Start; danach kannst du die Zeile `ADMIN_PASSWORD` löschen. `DB_PASSWORD` bleibt, wie es ist: MariaDB speichert es beim ersten Start. Das Root-Passwort von MariaDB ist zufällig und wird nicht gebraucht (Backups nutzen den Benutzer `openbill`).

<<< @/../docker-compose.standalone.yml{yaml}

Wer die Einstellungen lieber in einer eigenen `.env` neben der Compose-Datei hat (etwa, um die Compose-Datei bei Updates unverändert zu lassen), nimmt stattdessen den Weg unten.

## Dateien

```bash
mkdir openbill && cd openbill
curl -fsSLO https://raw.githubusercontent.com/baeroe/openbill/main/docker-compose.yml
curl -fsSL -o .env https://raw.githubusercontent.com/baeroe/openbill/main/.env.docker.example
```

## .env

Fülle `.env` vor dem ersten Start aus. Die Passwörter sind in der Vorlage absichtlich leer: Solange die Datenbank-Passwörter fehlen, bricht `docker compose up` mit `DB_PASSWORD missing` (bzw. `DB_ROOT_PASSWORD`) ab, und ohne `ADMIN_PASSWORD` legt der erste Start keinen Owner an (das Log meldet `nobody can log in`).

| Variable | Pflicht | Bedeutung |
|---|---|---|
| `APP_URL` | ja | Öffentliche Adresse mit `https://`, z. B. `https://invoices.example.com`. Links, der Toolkit-Download und der erlaubte `Host`-Header kommen daher: Anfragen an jeden anderen Host bekommen `400`. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | erster Start | Owner-Konto (das Passwort ist in der Vorlage leer), nur beim ersten Start angelegt (Passwort mindestens 8 Zeichen). Spätere Änderungen fassen das bestehende Konto nicht an. Entferne `ADMIN_PASSWORD` aus `.env`, sobald du dich angemeldet hast, siehe [Passwörter](#passworter). |
| `DB_PASSWORD`, `DB_ROOT_PASSWORD` | ja | MariaDB-Passwörter (in der Vorlage leer). MariaDB speichert sie beim ersten Start; änderst du sie danach in `.env`, klappt die Verbindung nicht mehr. |
| `OPENBILL_BIND`, `OPENBILL_PORT` | nein | Adresse und Port auf dem Host, Standard `127.0.0.1` und `7739` (der Container lauscht auf `8080`): Nur ein Reverse Proxy auf demselben Host erreicht openbill. Für einen Proxy auf einem anderen Host siehe [Reverse Proxy](/de/reverse-proxy). |
| `TRUSTED_PROXIES` | nein | IP-Adressen oder CIDR-Netze (keine Hostnamen), deren `X-Forwarded-*`-Headern openbill glaubt, kommagetrennt. Standard: localhost und die privaten Netze. Schränke es auf deinen Proxy ein, sobald `OPENBILL_BIND` nicht `127.0.0.1` ist. |
| `OPENBILL_IMAGE` | nein | Standard `baeroe/openbill:latest`. Eine Version festhalten mit `baeroe/openbill:0.1.0`. |
| `APP_KEY` | nein | Schlüssel für Sitzungen und Cookies. Ohne ihn erzeugt openbill beim ersten Start einen und legt ihn im Daten-Volume ab. |

## Starten

![Die Anmeldung einer frischen Instanz](/screenshots/de/login.png)

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

## Passwörter

`ADMIN_PASSWORD` braucht nur der erste Start. Sobald du dich angemeldet hast, lösche die Zeile aus `.env` und führe `docker compose up -d` aus, damit das Passwort weder in der Datei noch in der Umgebung des Containers steht. Ohne die Variable überspringt der Container das Anlegen des Owners; er warnt im Log nur, wenn es noch gar kein Konto gibt.

Sein eigenes Passwort ändert jede Person unter **Einstellungen → Dein Konto** (siehe [Einstellungen](/de/settings#dein-konto)). Ein vergessenes Passwort wird auf dem Server zurückgesetzt; der Befehl fragt das neue zweimal ab, ohne es anzuzeigen:

```bash
docker compose exec openbill php artisan app:reset-password owner@example.com
```

Ohne Terminal liest er stattdessen die erste Zeile seiner Eingabe, z. B. `docker compose exec -T openbill php artisan app:reset-password owner@example.com < neues-passwort.txt`. Das Passwort ist nie ein Argument und landet so nicht in der Shell-Historie. Das Zurücksetzen meldet das Konto überall ab; seine API-Tokens bleiben gültig.

## Was wo liegt

| Was | Wo |
|---|---|
| Archivierte PDFs und E-Rechnungs-XMLs, Template-Assets, hochgeladene Bilder und Logos, der erzeugte `APP_KEY` (`.app-key`) | Volume `openbill-data` (`/var/www/html/storage/app` im Container) |
| Datenbank | Volume `openbill-db` (MariaDB) |
| Einstellungen | `.env` neben `docker-compose.yml` oder der Block oben in der Standalone-Compose-Datei |

Container kannst du jederzeit neu anlegen, die Volumes bleiben. `docker compose down -v` löscht sie und damit jedes Dokument. Sichere beide Volumes, siehe [Datensicherung](/de/backup).

## Dienste

- **openbill**: nginx und PHP-FPM auf Port `8080`, läuft als `www-data`; den Code im Image kann er nur lesen. Gilt als gesund, sobald Laravel `/up` für den Host aus `APP_URL` beantwortet.
- **mariadb**: nur für openbill erreichbar (internes Netz, kein veröffentlichter Port). Läuft mit `--log-bin-trust-function-creators=1`: Abgeschlossene Dokumente schützen Datenbank-Trigger, und Trigger anlegen braucht diesen Schalter (oder das SUPER-Recht), sobald Binärlogs eingeschaltet sind.
- **gotenberg**: macht aus HTML ein PDF/A-3. Nur für openbill erreichbar und ohne Internetzugang. Templates können aus fremden Paketen kommen, deshalb führt Chromium kein JavaScript aus und lädt nur Gotenbergs eigene Arbeitsdateien und `data:`-URLs.

## Eigene MariaDB

Statt des Dienstes `mariadb` eine vorhandene MariaDB 11.4 nutzen: Dienst und seinen `depends_on`-Eintrag entfernen, für openbill `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME` und `DB_PASSWORD` setzen und dem Benutzer alle Rechte auf seiner Datenbank geben (auch `TRIGGER`). Sind dort Binärlogs eingeschaltet, setze `log_bin_trust_function_creators = 1` in der Server-Konfiguration – sonst scheitert die erste Migration mit Fehler 1419 („You do not have the SUPER privilege and binary logging is enabled“).

## Sprache

Die App gibt es auf Englisch und Deutsch, Standard ist Englisch. Die Sprache steht in der URL (`APP_URL/en/…`, `APP_URL/de/…`); umschalten kannst du im Menü. Dokumente haben ihre eigene Sprache, unabhängig von der App.

## Versionen

`latest` folgt jedem Release. Eine Version festhalten mit `OPENBILL_IMAGE=baeroe/openbill:0.1.0` in `.env`. Aktualisieren: [Aktualisieren](/de/upgrading).

## docker-compose.yml

Die vollständige Compose-Datei, dieselbe, die `curl` oben aus dem main-Branch lädt. Meist bleibt sie, wie sie ist: Alles, was du einstellst, kommt in die `.env`.

<<< @/../docker-compose.yml{yaml}
