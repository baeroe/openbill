# Eigene Felder

Eigene Felder ergänzen Organisation, Kunden, Ansprechpartner, Dokumente und Positionen um deine Angaben – einen Projektcode auf Rechnungen, die Lieferantennummer, unter der dich ein Kunde führt, ein Ticket pro Position. Sie erscheinen in den Formularen der App, werden von API und MCP geprüft und stehen in jedem Template bereit.

## Ebenen

| Ebene | Wo sie erscheint | Im Template |
|---|---|---|
| Organisation | Einstellungen → Organisation | `org.<schlüssel>` |
| Kunde | Kundenseite | `customer.<schlüssel>` |
| Ansprechpartner | Drawer des Ansprechpartners | `contact.<schlüssel>` |
| Dokument | Kopf des Dokument-Editors | `document.<schlüssel>` |
| Position | jede Positionszeile | `p.<schlüssel>` in `{% for p in g.positions %}` |

Dokument- und Positionsfelder gelten für ausgewählte Dokumenttypen (Angebot, Auftragsbestätigung, Rechnung, Storno). Auf der Seite „Eigene Felder“ schalten die vier kurzen Knöpfe in jeder Zeile einen Typ an oder aus; ein Feld behält immer mindestens einen Typ. Beim Umwandeln wandert ein Wert nur mit, wenn das Feld auch für den Zieltyp gilt.

## Typen

Text, langer Text, Zahl, Betrag, Datum, Auswahl (mit Optionen), Ja/Nein und Bild. Zahlen und Beträge werden als String mit Punkt gespeichert (`"12.5"`), Daten als `YYYY-MM-DD`.

**Bildfelder** nehmen einen Upload (PNG, JPEG, GIF, WebP oder SVG, höchstens 1 MB). Der Wert ist der Pfad der gespeicherten Datei (`uploads/<id>.png`); im Template ist das Feld eine Data-URL, die in Kopfzeile, Inhalt und Fußzeile funktioniert:

::: v-pre
```liquid
{% if document.stamp != blank %}<img src="{{ document.stamp }}" alt="">{% endif %}
```
:::

Hochgeladene Dateien bleiben erhalten, auch wenn sich der Wert ändert, weil abgeschlossene Dokumente noch auf sie verweisen. Bilder, auf die nichts mehr verweist (kein Datensatz, kein abgeschlossenes Dokument), listet `docker compose exec openbill php artisan app:prune-images --dry-run` auf; ohne `--dry-run` werden sie gelöscht. Dateien, die jünger als 24 Stunden sind, bleiben (`--min-age=<Stunden>`), weil ein Upload gespeichert wird, bevor sein Formular gespeichert ist.

## Anlegen und bearbeiten

![Eigene Felder der Dokumente](/screenshots/de/fields.png)

**Eigene Felder → Feld hinzufügen** öffnet einen Drawer mit Live-Vorschau des Eingabefelds. Der **Schlüssel** entsteht aus der Bezeichnung (`Projektcode` → `projektcode`) und lässt sich bis zum Anlegen ändern; danach ist er fest, damit Templates und gespeicherte Werte gültig bleiben. Kernschlüssel einer Ebene (`number`, `date`, `name`, …) sind reserviert. **Pflichtfelder** müssen vor dem Abschließen ausgefüllt sein. Ein **Standardwert** wird bei neuen Einträgen vorausgefüllt.

Die Pfeile ändern die Reihenfolge (so stehen die Felder in den Formularen). **Löschen** entfernt das Feld, sobald der Hinweis mit „Rückgängig“ verschwunden ist; gespeicherte Werte bleiben in den Daten, abgeschlossene Dokumente behalten das Feld in ihrem Snapshot.

## Eingebaute Felder

Jede Ebene hat Kernfelder (immer vorhanden, unter „Eingebaute Felder“; bei Kunden z. B. `kind`, Unternehmen oder Privatperson) und für das E-Rechnungs-Profil Pflichtangaben wie vollständige Adresse, USt-ID oder Steuernummer, IBAN, Leistungsdatum und Einheiten-Codes. Sie lassen sich nicht entfernen, weil Summen, Nummern und die E-Rechnung sie brauchen.

## Templates

Der Template-Editor zeigt alle Felder je Ebene in seiner Feldleiste; ein Klick fügt einen Ausdruck mit passendem Filter ein (`| money`, `| date`, `| nl2br`, `| number: 2`). Ein Template kann die erwarteten Felder in `manifest.json` angeben (`expectedFields`); der Editor warnt, wenn eines davon noch fehlt.

## API

`GET/POST /api/field-definitions`, `GET/PATCH/DELETE /api/field-definitions/{id}`, `POST /api/field-definitions/reorder` (`{"scope": "document", "ids": [...]}` mit allen Feldern der Ebene), `POST /api/uploads` (multipart `file`, Antwort `{"path": "uploads/…"}` = Wert eines Bildfelds). Werte stehen in `custom` des Objekts: `{"custom": {"projektcode": "NORDLICHT-7"}}`. Falscher Typ, unbekannte Option, fehlendes Pflichtfeld oder ein Feld, das für den Dokumenttyp nicht gilt, beantwortet die API mit 422 und dem Feldpfad.
