# MCP

openbill hat einen MCP-Server unter `<APP_URL>/mcp`. Darüber suchen Agenten wie Claude Code oder Codex Kunden und Dokumente, schreiben Entwürfe, schließen sie ab, geben PDF-Links heraus und arbeiten an Templates – nach denselben Regeln wie die App und die [REST-API](/de/api): Ein abgeschlossenes Dokument lässt sich nicht mehr ändern, eigene Felder werden geprüft, und jeder Schritt wird mit dem Token protokolliert, der ihn ausgeführt hat.

## Verbinden

Leg unter **Einstellungen → API & MCP** einen Token an: **Neuer Token**, ein Name (zum Beispiel das Gerät) und die Fähigkeit **MCP**. openbill zeigt den Token einmal an, zusammen mit den Einrichtungsbefehlen, in denen deine URL und der Token schon stehen. Leg pro Gerät einen Token an, dann kannst du sie einzeln widerrufen; die Liste zeigt, wann jeder Token zuletzt benutzt wurde.

**Claude Code** (`--scope user` für alle Projekte, `--scope local` für das aktuelle):

```bash
claude mcp add --transport http --scope user openbill https://openbill.example.com/mcp --header "Authorization: Bearer <token>"
```

**Codex:** in `~/.codex/config.toml` (alle Projekte) oder `.codex/config.toml` in einem vertrauenswürdigen Projekt eintragen. Die Projektdatei nicht ins Git einchecken, sie enthält den Token.

```toml
[mcp_servers.openbill]
url = "https://openbill.example.com/mcp"
http_headers = { "Authorization" = "Bearer <token>" }
```

**Andere Clients** mit `mcpServers`-Konfiguration (zum Beispiel `.mcp.json`):

```json
{
  "mcpServers": {
    "openbill": {
      "type": "http",
      "url": "https://openbill.example.com/mcp",
      "headers": { "Authorization": "Bearer <token>" }
    }
  }
}
```

Ohne Einstellungsseite legt der Artisan-Befehl aus [REST-API → Anmeldung](/de/api#anmeldung) ebenfalls einen Token an: mit `--ability=mcp`.

## Rechte

Nur ein Token mit der Fähigkeit `mcp` kommt hinein. Ohne Token oder mit einem widerrufenen oder abgelaufenen antwortet der Server mit `401`, ein Token ohne `mcp` bekommt `403`. Die Anmeldung im Browser gilt für `/mcp` nicht. Ein `mcp`-Token erreicht keinen REST-Endpunkt – gib einem Token mehrere Fähigkeiten, wenn ein Skript beides braucht.

Ein `mcp`-Token darf alles, was die Tools anbieten, auch Dokumente abschließen und Rechnungen als bezahlt markieren, im Namen der Person, die ihn angelegt hat. Tools, die Daten ändern oder abschließen, sind als destruktiv markiert (`destructiveHint`), lesende als read-only, damit Clients vor dem Ausführen nachfragen können; die Server-Anweisungen sagen Agenten außerdem, vor Abschließen, Stornieren und „bezahlt“ nachzufragen.

## Tools

| Tool | Was es tut |
|---|---|
| `get-overview` | Kennzahlen (offen, überfällig, Angebote, bezahlt), Dokumente, die Aufmerksamkeit brauchen, zuletzt bearbeitete |
| `list-customers`, `get-customer` | Kunden mit Ansprechpartnern; Suche und Seiten |
| `create-customer`, `update-customer` | Kunden anlegen oder ändern; `contacts` ist die vollständige Liste |
| `list-documents`, `get-document` | Dokumente in Kurzform mit Filtern; ein Dokument vollständig mit Summen und offenen Prüfpunkten |
| `create-document`, `update-document` | Entwurf anlegen (Angebot, Auftragsbestätigung, Rechnung) oder ändern; `groups` ersetzt alle Gruppen und Positionen |
| `duplicate-document` | Dokument in einen neuen Entwurf kopieren |
| `finalize-document` | Prüfen, Nummer vergeben, PDF (und E-Rechnungs-XML) archivieren – nicht umkehrbar |
| `set-document-status` | Angenommen, abgelehnt, erledigt, bezahlt, zurück auf offen |
| `convert-document` | Angenommenes Angebot in Auftragsbestätigung oder Rechnung, Auftragsbestätigung in Rechnung |
| `cancel-invoice` | Storno-Entwurf einer offenen oder bezahlten Rechnung |
| `get-document-pdf-url` | Signierte Links zum PDF (und zum XML einer E-Rechnung), 15 Minuten, ohne Token |
| `list-field-definitions`, `save-field-definition` | Eigene Felder auflisten, anlegen, ändern |
| `list-templates`, `get-template`, `update-template` | Templates mit Liquid- und CSS-Quellen; mitgelieferte sind schreibgeschützt |
| `render-template-preview` | Liquid-Fehler mit Zeile, Seitenzahl, fehlende Felder und ein Text-Auszug – nie HTML |
| `get-settings`, `update-organization` | Organisation und Dokumenttypen; Organisation ändern |
| `list-tax-rates-and-units`, `list-text-blocks` | IDs von Steuersätzen und Einheiten für Positionen, Textbausteine |

## Resources

| URI | Inhalt |
|---|---|
| `openbill://docs/liquid-reference` | Die englische Seite [Templates](/en/templates) als Markdown, mit der Liquid-Referenz (zur Laufzeit aus der Doku gelesen) |
| `openbill://schema/fields` | Alle Felder, die ein Template nutzen kann, je Ebene, mit den eigenen Feldern, als JSON |

## Templates gestalten

Ein Agent kann ein Template direkt in der Instanz gestalten oder ändern: `list-templates`, dann `get-template` für die Quellen, `render-template-preview` mit den geänderten Teilen, um sie ohne Speichern zu prüfen (Fehler mit Zeile, Seitenzahl, Felder, die das Manifest erwartet, die openbill aber nicht kennt), und `update-template` zum Speichern. Mitgelieferte Templates sind schreibgeschützt: vorher im Template-Editor duplizieren. Soll stattdessen ein Coding-Agent an den Dateien in deinem eigenen Editor mit Live-Vorschau arbeiten, siehe [Template-Toolkit → Mit einem KI-Agenten arbeiten](/de/template-toolkit#mit-einem-ki-agenten-arbeiten).

## Antworten und Fehler

- Antworten sind JSON im Format der REST-API mit `Accept: application/json`: Schlüssel in snake_case, Beträge und Mengen als Strings (`"1130.50"`), `null` für leere Werte. Kunden und Dokumente kommen seitenweise: `page`, `per_page` (bis 100); die Antwort hat `items`, `total` und `has_more`.
- Beträge und Mengen auch als Strings schicken. Zahlen mit Nachkommastellen werden abgelehnt, damit unterwegs nichts gerundet wird.
- Ungültige Eingaben nennen jedes Feld mit seinem Pfad:

```text
Invalid input:
- groups.0.positions.0.custom.billable: The field must be true or false.
```

- Eine Ablehnung nennt ihren Grund, zum Beispiel `(reason: document_locked)`. Scheitert das Abschließen an fehlenden Angaben (`compliance_failed`), listet der Fehler jeden Prüfpunkt mit Pfad auf, etwa `document.custom.po_number` oder `org.vat_id`. Mit `Accept-Language: de` kommen die Meldungen auf Deutsch.

## Grenzen

- 300 Anfragen pro Minute und Token, Anfragen bis 2 MB.
- `render-template-preview` rendert höchstens 20-mal pro Minute und Token ein PDF, um die Seiten zu zählen; darüber ist `page_count` `null` und `page_count_skipped` `rate_limited` (der Rest der Vorschau kommt trotzdem). Das Abschließen braucht denselben PDF-Dienst, eine Agenten-Schleife kann ihn so nicht blockieren.
- Download-Links laufen nach 15 Minuten ab; ein Link zu einem Entwurf funktioniert nicht mehr, sobald sich der Entwurf ändert.
- Keine Dateien über MCP: PDFs und XML kommen als Links, Template-Assets und das Logo werden in der App oder über die REST-API hochgeladen.
- Kein OAuth: Connectoren, die OAuth verlangen (zum Beispiel in claude.ai), können sich nicht verbinden; nimm einen Client, der den Token als Header schickt.
