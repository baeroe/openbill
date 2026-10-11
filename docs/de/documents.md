# Dokumente

openbill kennt vier Dokumenttypen. Jeder durchläuft wenige Status; beim Abschließen bekommt er eine Nummer und wird gesperrt.

| Typ | Status |
|---|---|
| Angebot | Entwurf → Offen → Angenommen / Abgelehnt |
| Auftragsbestätigung | Entwurf → Offen → Erledigt |
| Rechnung | Entwurf → Offen → Bezahlt; Storniert (durch ein Storno) |
| Storno | Entwurf → Abgeschlossen |

„Überfällig“ ist kein Status: Eine offene Rechnung, deren Fälligkeit vorbei ist, wird als überfällig angezeigt.

## Entwürfe

Ein neuer Entwurf übernimmt die Vorgaben seines Dokumenttyps: Einleitung und Schlusstext aus Textbausteinen, Template, Zahlungsziel (Rechnung: Fälligkeit = Datum + Zahlungsziel, Leistungsdatum = Datum), Gültigkeit (Angebot: gültig bis = Datum + Gültigkeit), den Standard-Ansprechpartner des Kunden und die Standardwerte eigener Felder. Ein Entwurf lässt sich frei ändern. Positionen stehen in Gruppen mit Titel und Zwischensumme; Positionen ohne Gruppe stehen in einer Gruppe ohne Titel.

Positionsarten:

- **Leistung** – Menge × Einzelpreis, zählt zur Summe.
- **Textzeile** – eine Zeile ohne Betrag.
- **Optional** – nur in Angeboten; mit Preis angezeigt, aber nicht Teil der Summe.

Beträge und Mengen sind exakte Dezimalzahlen. Über die API werden sie als Text mit Punkt geschickt (`"12.50"`); Zahlen wie `12.5` oder `"12,5"` werden mit einer Meldung zum Feld abgelehnt.

## Steuern und Summen

Summen entstehen je Steuersatz (Netto, Steuer, Brutto) und für das ganze Dokument; die Steuer je Satz wird einmal kaufmännisch auf Cent gerundet.

- **Kleinunternehmer (§ 19 UStG):** keine Umsatzsteuer auf Positionen (Kategorie E), der Pflichthinweis wird automatisch gesetzt.
- **EU-Kunde mit Reverse Charge:** keine Umsatzsteuer (Kategorie AE), der Reverse-Charge-Hinweis wird gesetzt.
- **Kunde im Drittland:** keine Umsatzsteuer (Kategorie G), der Ausfuhrhinweis wird gesetzt.

Gesetzliche Hinweise stehen in der Sprache des Dokuments.

## Abschließen

Abschließen macht aus einem Entwurf ein offenes Dokument (ein Storno wird abgeschlossen). In einem Schritt

1. prüft openbill das Prüfprofil des Dokumenttyps (siehe unten) und bricht mit einer Liste der fehlenden Angaben ab,
2. vergibt die nächste Nummer aus dem Nummernkreis,
3. friert die Stammdaten ein, die das Dokument nutzt (Organisation, Kunde, Ansprechpartner, Steuersätze, Einheiten, Template, Felddefinitionen und die Texte der gesetzlichen Hinweise),
4. speichert die Summen.

Scheitert ein Schritt, ändert sich nichts: Das Dokument bleibt Entwurf und die Nummer bleibt frei.

Danach ist das Dokument **gesperrt**. Nur Status, Zahlungsdatum und der Verweis auf das Storno können sich noch ändern. Spätere Änderungen an Kunden, Steuersätzen, Einheiten, Templates oder eigenen Feldern wirken nicht mehr, weil das Dokument aus seinen eingefrorenen Stammdaten angezeigt und berechnet wird. Eine Rechnung korrigierst du mit einem Storno und einer neuen Rechnung.

Die Sperre sichert auch die Datenbank ab: Schreibzugriffe, die ein abgeschlossenes Dokument, seine Gruppen oder Positionen ändern, und jede Änderung an eingefrorenen Stammdaten oder archivierten Dateien werden abgelehnt, egal auf welchem Weg sie kommen. Ein abgeschlossenes Dokument wird nie wieder zum Entwurf.

### Prüfprofile

| Profil | Prüft |
|---|---|
| Basis | Datum, Kunde, mindestens eine Leistung, Bezeichnung, Steuersatz (außer bei Kleinunternehmern) und Einheit jeder Leistung, eigene Pflichtfelder |
| E-Rechnung (EN 16931) | alles aus Basis, dazu Name, vollständige Adresse, USt-ID oder Steuernummer und IBAN der Organisation, vollständige Kundenadresse, USt-ID des Kunden bei Reverse Charge, Leistungsdatum, Fälligkeit (Rechnungen), einen Einheiten-Code je Einheit und keine Menge 0 |

Das E-Rechnungs-Profil ist nur für Rechnungen und Stornos wählbar.

## Dokumentkette

Dokumente lassen sich entlang der Kette umwandeln:

- ein **angenommenes** Angebot → Auftragsbestätigung oder Rechnung,
- eine Auftragsbestätigung (kein Entwurf) → Rechnung,
- eine offene oder bezahlte Rechnung → Storno.

Das neue Dokument ist ein Entwurf mit Kunde, Ansprechpartner, Gruppen, Positionen und Texten der Quelle. Optionale Positionen fallen weg, danach leere Gruppen ebenfalls. Werte eigener Felder wandern mit, wenn das Feld auch für den Zieltyp gilt; andere Werte fallen weg und werden gemeldet. Jedes Dokument kennt seine Quelle, und eine Rechnung kennt das Storno, das sie storniert hat.

Ein Storno übernimmt die Positionen seiner Rechnung mit negativen Mengen. Jede Rechnung hat höchstens ein Storno; ein zweiter Versuch liefert den vorhandenen Entwurf. Ein Storno gehört immer zum Kunden seiner Rechnung; der Kunde lässt sich nicht ändern. Wird das Storno abgeschlossen, ist die Rechnung **storniert**, und eine stornierte Rechnung lässt sich nicht mehr auf bezahlt setzen.

Duplizieren legt einen neuen Entwurf mit heutigem Datum an, ohne Nummer und ohne Kette. Stornos lassen sich nicht duplizieren.

## Nummernkreise

Jeder Dokumenttyp hat einen eigenen Nummernkreis mit einem Muster:

| Platzhalter | Bedeutung |
|---|---|
| `{YYYY}` | Jahr des Dokumentdatums |
| `{YY}` | zweistelliges Jahr |
| `{MM}` | Monat |
| `{0000}` | laufende Nummer, aufgefüllt auf die Anzahl der Nullen |

Vorgaben: `Q-{YYYY}-{0000}` (Angebote), `OC-{YYYY}-{0000}` (Auftragsbestätigungen), `INV-{YYYY}-{0000}` (Rechnungen), `CN-{YYYY}-{0000}` (Stornos), jeweils jährlich zurückgesetzt.

- Mit **jährlichem Zurücksetzen** hat jedes Jahr einen eigenen Zähler; ein rückdatiertes Dokument bekommt die nächste Nummer seines Jahres. Das Muster muss dann `{YYYY}` oder `{YY}` enthalten.
- Nummern werden vergeben, während der Nummernkreis gesperrt ist; zwei gleichzeitig abgeschlossene Dokumente bekommen nie dieselbe Nummer.
- Gibt es eine Nummer schon (etwa nachdem Muster oder Zähler von Hand geändert wurden), wird sie übersprungen.

## Protokoll

Jede Änderung an einem Dokument wird mit Urheber (Benutzer, API-Token oder System; bei einem Token auch der zugehörige Benutzer, der auch nach dem Löschen des Tokens im Protokoll bleibt) protokolliert: angelegt, geändert, abgeschlossen, Status geändert, umgewandelt, storniert, dupliziert, gelöscht. Einträge gelöschter Entwürfe bleiben im Protokoll.

## Demo-Daten

Zum Entwickeln und Ausprobieren:

```bash
ddev artisan db:seed --class=DemoSeeder
```

Das **ersetzt alle Fachdaten** (Dokumente, Kunden, eigene Felder, Steuersätze, Einheiten, Textbausteine, Templates, Nummernkreise) durch die fiktive Firma Studio Nordlicht und ihre Kunden. Benutzerkonten bleiben.
