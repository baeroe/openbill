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

<!-- nur absolute Links: jeder Abschnitt wird zu den Notizen des GitHub-Release (scripts/release-notes.sh) -->

### 0.1.0

- Erstes Release: Angebote, Auftragsbestätigungen, Rechnungen und Stornos mit eigenen Feldern, Liquid-Templates (Klar, Kante, Leise und eigene), E-Rechnungen nach EN 16931 als PDF/A-3 mit eingebettetem XML, REST-API, MCP-Server und das Template-Toolkit.
- Läuft als Docker-Compose-Stack mit MariaDB 11.4 und Gotenberg 8, siehe [Einrichtung](https://github.com/baeroe/openbill/blob/main/docs/de/setup.md).
