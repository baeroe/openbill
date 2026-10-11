# REST-API

openbill hat unter `/api` eine REST-API. Die Oberfläche, KI-Agenten und das Template-Toolkit nutzen dieselben Endpunkte, und jede Änderung läuft durch dieselben Regeln: Ein abgeschlossenes Dokument lässt sich nicht mehr ändern, eigene Felder werden geprüft, jeder Schritt wird protokolliert.

Die interaktive Referenz (Swagger UI) liegt unter `/api/docs`, das OpenAPI-Dokument unter `/api/docs.jsonopenapi`. Beide funktionieren ohne Token.

## Anmeldung

Ein Token wird im Header `Authorization` mitgeschickt:

```bash
export OPENBILL_URL=https://openbill.ddev.site   # Ihre Instanz
export OPENBILL_TOKEN='01J…|openbill_…'

curl -H "Authorization: Bearer $OPENBILL_TOKEN" -H 'Accept: application/json' "$OPENBILL_URL/api/documents"
```

Tokens entstehen auf der Kommandozeile (die Einstellungsseite „API & MCP“ folgt in einer späteren Version). Der Token wird nur einmal angezeigt:

```bash
php artisan app:create-token admin@example.com --name=agent --ability=api:read --ability=api:write
# in DDEV: ddev artisan app:create-token …
```

| Fähigkeit | Erlaubt |
|---|---|
| `api:read` | alle Ressourcen lesen, PDF/XML herunterladen, Positionsvorschläge, Vorschau |
| `api:write` | alles aus `api:read` und zusätzlich anlegen, ändern, löschen |
| `templates:render` | Vorschau: `POST /api/render`, `GET /api/render/sources`, `GET /api/render/schema`. **Das ist lesender Zugriff auf alle Dokumente:** Der Token kann jedes Dokument gerendert sehen (Kunde, Adresse, Positionen, Beträge), und `render/sources` listet die letzten Dokumente mit Nummer und Kundenname. Das Toolkit braucht das, um Templates mit echten Dokumenten anzusehen. |
| `templates:write` | **ein** Template lesen und schreiben (`--template=<id>`): `GET /api/templates/{id}`, `GET /api/templates/{id}/package`, `PUT /api/templates/{id}/files` |
| `mcp` | nur der MCP-Server (kein REST-Endpunkt) |

Ohne gültigen Token antwortet die API mit `401`, mit einem Token ohne passende Fähigkeit mit `403`. Ein widerrufener oder abgelaufener Token bekommt `401`.

Die openbill-Oberfläche selbst nutzt die API mit ihrer Anmeldung (Session), im Browser ist kein Token nötig.

## Formate

- `Accept: application/json` – einfaches JSON. Listen sind Arrays der aktuellen Seite.
- `Accept: application/ld+json` (Standard) – JSON-LD. Listen sind Objekte mit `member`, `totalItems` und `view` (Links auf erste, letzte, nächste und vorige Seite).
- Feldnamen in snake_case. Beträge und Mengen sind Strings (`"1130.50"`, `"10.0000"`); Zahlen mit Nachkommastellen in einer Anfrage werden abgelehnt. Datumswerte `YYYY-MM-DD`, IDs sind ULIDs.
- Jedes Feld einer Ressource ist immer vorhanden; Felder ohne Wert sind `null` (zum Beispiel `"number": null` eines Entwurfs).
- Kunden- und Dokumentlisten sind seitenweise: `?page=2&itemsPerPage=50` (bis 100, Standard 30).
- `PATCH` ändert nur die mitgeschickten Schlüssel. `groups` eines Dokuments und `contacts` eines Kunden ersetzen immer die ganze Liste (mit der `id` einer Gruppe, Position oder eines Ansprechpartners bleibt er erhalten).
- Mit `Accept-Language: de` kommen Meldungen auf Deutsch.

## Fehler

Jeder Fehler ist `application/problem+json`:

```json
{
  "type": "urn:openbill:problem:document_locked",
  "title": "Konflikt",
  "status": 409,
  "detail": "INV-2026-0007 ist abgeschlossen und lässt sich nicht mehr ändern.",
  "reason": "document_locked",
  "document_id": "01J…",
  "number": "INV-2026-0007"
}
```

`reason` ist stabil und für Programme gedacht:

| Status | `reason` | Zusätzliche Felder |
|---|---|---|
| 400 | `bad_request` (Body ist kein JSON-Objekt) | |
| 401 | `unauthenticated` | |
| 403 | `forbidden` | |
| 404 | `not_found` | |
| 409 | `document_locked` | `document_id`, `number` |
| 409 | `status_transition`, `conversion`, `duplicate_cancellation`, `cancellation_needs_invoice`, `cancellation_source`, `cancellation_customer`, `no_e_invoice`, `customer_has_finalized_documents`, `template_built_in`, `template_in_use` | |
| 422 | `validation_failed` | `violations: [{path, message}]` |
| 422 | `compliance_failed` (Abschließen) | `violations: [{path, message, code}]` |
| 422 | `template_render_failed` (Abschließen) | `errors: [{part, file, line, message}]` |
| 422 | `einvoice_invalid` | `errors: [Meldung]` |
| 429 | `too_many_requests` | |
| 503 | `pdf_render_failed` (PDF-Dienst nicht erreichbar, später erneut versuchen) | |

Pfade gibt es in zwei Formen. Die **Validierung** nutzt die Stelle in der Anfrage: `groups.0.positions.1.custom.ticket` ist das eigene Feld `ticket` der zweiten Position in der ersten Gruppe. Die **Prüfung** (`issues` eines Entwurfs, `compliance_failed`) nutzt IDs, weil sie das gespeicherte Dokument beschreibt: `positions.01J….unit`, `document.custom.project_name`, `customer.address`.

## Ressourcen

| Ressource | Endpunkte |
|---|---|
| Kunden | `GET/POST /api/customers` (`?q=`), `GET/PATCH/DELETE /api/customers/{id}` |
| Dokumente | `GET/POST /api/documents` (`?type= &status= &customer_id= &q= &date_from= &date_to= &sort=`), `GET/PATCH/DELETE /api/documents/{id}` |
| Dokument-Aktionen | `POST /api/documents/{id}/finalize`, `…/status` (`{"status": "accepted"}`), `…/convert` (`{"type": "invoice"}`), `…/cancel`, `…/duplicate` |
| Downloads | `GET /api/documents/{id}/pdf` (`?inline=1`), `GET /api/documents/{id}/xml` |
| Positionsvorschläge | `GET /api/position-suggestions` (`?q= &limit=`) |
| Eigene Felder | `GET/POST /api/field-definitions` (`?scope= &doc_type=`), `GET/PATCH/DELETE /api/field-definitions/{id}` |
| Steuersätze, Einheiten | `GET/POST /api/tax-rates`, `/api/units` (`?include_archived=1`), `GET/PATCH/DELETE …/{id}` – `DELETE` archiviert |
| Textbausteine | `GET/POST /api/text-blocks` (`?kind=`), `GET/PATCH/DELETE /api/text-blocks/{id}` |
| Dokumenttypen | `GET /api/document-types`, `GET/PATCH /api/document-types/{type}` (Profil, Template, Texte, Fristen, Nummernkreis) |
| Organisation | `GET/PATCH /api/organization` |
| Templates | `GET /api/templates`, `POST /api/templates` (Paket-ZIP als Multipart-Feld `package`), `GET/DELETE /api/templates/{id}`, `PUT /api/templates/{id}/files`, `GET /api/templates/{id}/package` |
| Vorschau | `POST /api/render`, `GET /api/render/sources`, `GET /api/render/schema` |

Ein Dokument in einer Liste hat die Kurzform (Nummer, Status, Kunde, Summen, Datumswerte). `GET /api/documents/{id}` ergänzt Texte, eigene Felder, `groups` mit ihren Positionen, `totals` (netto, Steuer, brutto, Steueraufschlüsselung, Rechtshinweise) und bei Entwürfen `issues`: alles, was das Abschließen noch bemängeln würde.

## Der Hauptablauf mit curl

```bash
H=(-H "Authorization: Bearer $OPENBILL_TOKEN" -H 'Accept: application/json' -H 'Content-Type: application/json')

# ein Kunde
CUSTOMER=$(curl -s "${H[@]}" -X POST "$OPENBILL_URL/api/customers" -d '{
  "name": "Hafenkontor Lindqvist GmbH", "street": "Kaistraße 4", "zip": "20457", "city": "Hamburg", "country": "DE"
}' | jq -r .id)

UNIT=$(curl -s "${H[@]}" "$OPENBILL_URL/api/units" | jq -r '.[] | select(.code=="HUR") | .id')
VAT=$(curl -s "${H[@]}" "$OPENBILL_URL/api/tax-rates" | jq -r '.[] | select(.percent=="19.00") | .id')

# ein Angebot mit einer Gruppe
OFFER=$(curl -s "${H[@]}" -X POST "$OPENBILL_URL/api/documents" -d "{
  \"type\": \"offer\", \"customer_id\": \"$CUSTOMER\",
  \"groups\": [{\"title\": \"Workshop\", \"positions\": [
    {\"kind\": \"item\", \"title\": \"Discovery-Workshop\", \"quantity\": \"8\", \"unit_price\": \"120\", \"unit_id\": \"$UNIT\", \"tax_rate_id\": \"$VAT\"}
  ]}]
}" | jq -r .id)

# abschließen, annehmen, in eine Rechnung umwandeln
curl -s "${H[@]}" -X POST "$OPENBILL_URL/api/documents/$OFFER/finalize" | jq -r .number
curl -s "${H[@]}" -X POST "$OPENBILL_URL/api/documents/$OFFER/status" -d '{"status": "accepted"}' > /dev/null
INVOICE=$(curl -s "${H[@]}" -X POST "$OPENBILL_URL/api/documents/$OFFER/convert" -d '{"type": "invoice"}' | jq -r .id)

# was fehlt noch? (leere Liste = bereit)
curl -s "${H[@]}" "$OPENBILL_URL/api/documents/$INVOICE" | jq .issues

# Rechnung abschließen, PDF laden, als bezahlt markieren
curl -s "${H[@]}" -X POST "$OPENBILL_URL/api/documents/$INVOICE/finalize" | jq -r .number
curl -s -H "Authorization: Bearer $OPENBILL_TOKEN" -o rechnung.pdf "$OPENBILL_URL/api/documents/$INVOICE/pdf"
curl -s "${H[@]}" -X POST "$OPENBILL_URL/api/documents/$INVOICE/status" -d '{"status": "paid"}' > /dev/null

# stornieren: legt den Storno-Entwurf an, sein Abschluss storniert die Rechnung
CANCELLATION=$(curl -s "${H[@]}" -X POST "$OPENBILL_URL/api/documents/$INVOICE/cancel" | jq -r .id)
curl -s "${H[@]}" -X POST "$OPENBILL_URL/api/documents/$CANCELLATION/finalize" | jq -r .status
```

## Entwürfe speichern

`PATCH /api/documents/{id}` speichert einen Entwurf und antwortet mit den neuen Summen und offenen Punkten – genau das nutzt das automatische Speichern im Editor. Der Body nimmt `date`, `customer_id`, `contact_id`, `service_date`, `service_date_end`, `due_date`, `valid_until`, `intro`, `closing`, `template_id`, `locale`, `custom` und `groups`:

```json
{
  "groups": [
    {"id": "01J…", "title": "Workshop", "positions": [
      {"id": "01J…", "kind": "item", "title": "Discovery-Workshop", "description": "", "quantity": "8",
       "unit_price": "120", "unit_id": "01J…", "tax_rate_id": "01J…", "custom": {"ticket": "OPS-12"}}
    ]},
    {"title": null, "positions": [{"kind": "text", "title": "Reisekosten werden gesondert berechnet."}]}
  ]
}
```

Eine Gruppe mit `"title": null` enthält lose Positionen (ohne Überschrift und Zwischensumme). `kind` ist `item`, `text` oder `optional` (nur in Angeboten). Ein abgeschlossenes Dokument antwortet mit `409 document_locked`.

## Vorschau

`POST /api/render` rendert ein gespeichertes Dokument, ungespeicherte Änderungen eines Entwurfs (`draft`, gleicher Body wie bei `PATCH`) oder Beispieldaten (`scenario`), optional mit ungespeicherten Template-Teilen (`template`). Die Antwort enthält `header`, `body`, `footer` (vollständige HTML-Dokumente), `paper`, `totals`, `issues` und `errors`. Fehler im Template sind kein HTTP-Fehler: Sie stehen mit Bereich, Datei und Zeile in `errors`, die Anfrage antwortet trotzdem mit `200`.

```bash
curl -s "${H[@]}" -X POST "$OPENBILL_URL/api/render" -d '{"scenario": "long_invoice", "locale": "de"}' | jq .errors
```

`GET /api/render/sources` listet die Beispielszenarien und die letzten Dokumente, `GET /api/render/schema` die Felder, die ein Template je Ebene nutzen kann (`?document_type=invoice` filtert die eigenen Felder).

## Templates

`PUT /api/templates/{id}/files` schreibt die mitgeschickten Teile eines importierten Templates – so arbeitet `push` im Toolkit:

```json
{
  "header": "…", "body": "…", "footer": "…", "css": "…",
  "manifest": {"name": "Fjord", "version": "1.1.0"},
  "assets": {"assets/logo.svg": "<base64>"}
}
```

`assets` ist, wenn mitgeschickt, die vollständige Liste. Mitgelieferte Templates (Klar, Kante, Leise) sind schreibgeschützt: `409 template_built_in`. `GET /api/templates/{id}/package` lädt das Template als Paket-ZIP, `POST /api/templates` importiert eines (`-F package=@template.zip`).

## Downloads für andere Programme

Der MCP-Server gibt signierte Download-Links für PDF und XML aus. Sie funktionieren 15 Minuten ohne Token; danach oder verändert antworten sie mit `403`. Ein abgeschlossenes Dokument liefert seine Archivdatei. Ein Entwurf wird live mit Wasserzeichen gerendert. Sein Link ist an den Inhalt des Entwurfs gebunden (Felder, Texte, Kunde und Ansprechpartner, Template-Wahl, Gruppen und Positionen in ihrer Reihenfolge): Nach jeder Änderung daran antwortet er mit `403`, dann einen neuen Link anfordern. Stammdaten werden live gelesen, eine geänderte Kundenadresse oder ein geändertes Template erscheint also auch über einen Entwurfs-Link. Nach dem Abschließen liefert der Link die Archivdatei.

## Grenzen

600 Anfragen pro Minute je Token (ohne Token je IP). Darüber antwortet die API mit `429` und `Retry-After`.
