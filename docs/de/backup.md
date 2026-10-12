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
