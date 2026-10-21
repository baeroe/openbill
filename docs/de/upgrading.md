# Aktualisieren

Mach zuerst eine [Datensicherung](/de/backup), dann:

```bash
docker compose pull
docker compose up -d
```

Mit der [Standalone-Compose-Datei](/de/setup#schnellstart-einfugen-und-starten) in Dockge oder Portainer: den Stack aktualisieren (Dockge: Update) bzw. das Image neu ziehen und neu deployen (Portainer).

Beim Start migriert openbill die Datenbank, spielt die mitgelieferten Templates der neuen Version ein und baut seine Caches neu. Die Daten in den Volumes bleiben. `docker compose restart` allein behält das alte Image.

- **Feste Version:** zuerst `OPENBILL_IMAGE` in `.env` ändern (z. B. `baeroe/openbill:0.2.0`) bzw. die Zeile `image:` der Standalone-Compose-Datei.
- **Compose-Datei:** Die Hinweise unten sagen, wann sich `docker-compose.yml` geändert hat (etwa neue MariaDB- oder Gotenberg-Versionen). Lade sie dann neu und übernimm deine eigenen Änderungen:
  `curl -fsSLO https://raw.githubusercontent.com/baeroe/openbill/main/docker-compose.yml`
  Mit der Standalone-Compose-Datei die neue [docker-compose.standalone.yml](https://github.com/baeroe/openbill/blob/main/docker-compose.standalone.yml) einfügen und deine Werte aus dem Block ganz oben übernehmen.
- **MariaDB:** Patch-Versionen aktualisieren sich beim Start selbst (`MARIADB_AUTO_UPGRADE`). Eine neue Hauptversion kommt nur mit einem Hinweis hier.
- **Zurück:** Migrationen werden nicht zurückgedreht. Spiel die Sicherung ein und halte die alte Version fest.

Alle Versionen und ihre Änderungen: https://github.com/baeroe/openbill/releases

## Hinweise je Version

<!-- nur absolute Links: jeder Abschnitt wird zu den Notizen des GitHub-Release (scripts/release-notes.sh) -->

### 0.3.1

- **Sicherheitsupdate:** PHP 8.4.27 behebt zwei kritische Lücken in PHP selbst, über die sich ohne Anmeldung Code ausführen lässt (CVE-2026-109618, CVE-2026-109619). Jetzt aktualisieren: https://www.php.net/archive/2026.php#2026-10-21-5
- Das Image basiert jetzt auf `serversideup/php` v5.0.2 (vorher v4.5.1 mit PHP 8.4.23). Dazu kommt nginx 1.30.6 mit Fixes für fünf nginx-Lücken.
- `TRUSTED_PROXY=off`: nginx schreibt die Client-IP nicht selbst um, über weitergeleitete Header entscheidet wie bisher nur `TRUSTED_PROXIES`. Keine Änderung für Setups mit Reverse Proxy davor: https://openbill.dev/de/reverse-proxy
- Aktualisieren: `docker compose pull && docker compose up -d`
- Keine Änderungen an den Compose-Dateien.

### 0.3.0

- **GiroCode auf Rechnungen:** Templates bekommen `document.payment_qr`, einen EPC-QR-Code (SVG-Data-URL), den Banking-Apps scannen, um die SEPA-Überweisung auszufüllen: Name und IBAN/BIC deiner Organisation, die Summe und die Rechnungsnummer als Verwendungszweck. Befüllt ist er nur bei abgeschlossenen Rechnungen mit einer Summe über null und einer IBAN in den Organisationseinstellungen. Die mitgelieferten Templates drucken ihn nicht; bau ihn in dein eigenes Template ein: https://openbill.dev/de/templates#girocode
- Neuer Liquid-Filter `iban` gibt eine IBAN in Vierergruppen aus (`org.iban | iban`).
- `payment_qr` ist jetzt ein reservierter Schlüssel für Dokumentfelder: Ein eigenes Dokumentfeld mit diesem Schlüssel wird in Templates vom GiroCode verdeckt.
- Keine Änderungen an den Compose-Dateien.

### 0.2.1

- Der Dialog **Neues Dokument** bietet nur noch die Arten an, die dort entstehen können (Angebot, Auftragsbestätigung, Rechnung). Stornos entstehen weiter aus einer Rechnung; die ausgegraute Karte ist weg, und die übrigen Karten haben Platz für ihre Namen.
- Template-Galerie: Die Knöpfe einer Karte brechen auf schmalen Karten um, statt aus der Karte zu laufen.
- Keine Änderungen an den Compose-Dateien.

### 0.2.0

- **Kundennummern frei gestaltbar:** neuer Bereich Einstellungen → Kunden mit einem Nummernkreis wie bei den Dokumenttypen (Platzhalter `{YYYY}`, `{YY}`, `{MM}`, `{0000}`, optional jedes Jahr neu, nächste Nummer, Live-Vorschau). Neue Kunden ohne Nummer bekommen die nächste Nummer dieses Kreises; von Hand eingetragene Nummern bleiben, wie sie sind. Beim Update setzt der Kreis die bisher vergebenen Nummern fort (zum Beispiel `K-1004` → `K-{0000}` ab 1005, sonst `C-{0000}` ab 1001) – es ändert sich also nichts, bis du das Muster umstellst. Details: https://openbill.dev/de/settings#kunden
- REST-API: `GET/PATCH /api/customer-numbering` und `GET /api/customer-numbering/preview`; das MCP-Tool `get-settings` liefert zusätzlich `customer_numbering`.
- Die nächste Nummer in den Dokumenttyp-Einstellungen überspringt jetzt schon vorhandene Nummern, wie beim Abschließen.
- Keine Änderungen an den Compose-Dateien.

### 0.1.1

- **Compose-Datei geändert:** Port `7739` von openbill ist jetzt auf allen Adressen des Hosts veröffentlicht (als `7739:8080`), nicht mehr nur auf `127.0.0.1`. Ein Reverse Proxy im Container, etwa Nginx Proxy Manager in Dockge, kann jetzt an `<server>:7739` weiterleiten (vorher kam `502 Bad Gateway`). `docker-compose.yml` neu laden bzw. die neue `docker-compose.standalone.yml` einfügen. Mit `OPENBILL_BIND=127.0.0.1` in deiner `.env` bleibt der Port lokal. Möglichkeiten zum Absichern: https://openbill.dev/de/reverse-proxy
- Dokumentation: Haftungshinweis (keine Steuer- oder Rechtsberatung, keine Gewährleistung) in README, Einrichtung und E-Rechnung.

### 0.1.0

- Erstes Release: Angebote, Auftragsbestätigungen, Rechnungen und Stornos mit eigenen Feldern auf jeder Ebene, Positionen in Gruppen, Liquid-Templates (Klar, Kante, Leise und eigene, mit dem Template-Toolkit), E-Rechnungen nach EN 16931 als PDF/A-3 mit eingebetteter XML, REST-API und MCP-Server, auf Englisch und Deutsch.
- Image `baeroe/openbill:0.1.0` für `linux/amd64` und `linux/arm64`. Läuft als Docker-Compose-Stack mit MariaDB 11.4 und Gotenberg 8, siehe [Einrichtung](https://github.com/baeroe/openbill/blob/main/docs/de/setup.md).
- Dokumentation: https://openbill.dev/de/
