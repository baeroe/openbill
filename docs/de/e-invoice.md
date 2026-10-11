# E-Rechnung

openbill erzeugt E-Rechnungen nach **EN 16931** in der Syntax UN/CEFACT CII (Factur-X / ZUGFeRD, Profil EN 16931). Die XML steckt in einem **PDF/A-3b**, eine Datei reicht also für Menschen und Buchhaltungssoftware.

## Einschalten

Das Prüfprofil wird je Dokumenttyp eingestellt: `basic` oder `en16931`. Das E-Rechnungsprofil gibt es nur für Rechnungen und Stornos. Mit `en16931` prüft das Abschließen alles, was eine E-Rechnung braucht (siehe [Prüfprofile](/de/documents#prufprofile)), und bricht mit einer Liste der fehlenden Angaben ab.

## Was beim Abschließen passiert

Bei einer Rechnung oder einem Storno mit Profil `en16931` erledigt openbill im selben Schritt, der die Nummer vergibt:

1. baut die CII-XML aus den eingefrorenen Stammdaten und den Summen,
2. prüft sie gegen das XML-Schema von EN 16931 (eine ungültige XML bricht das Abschließen ab),
3. rendert das PDF mit dem Template des Dokuments und lässt Gotenberg daraus ein PDF/A-3b mit der XML als `factur-x.xml` machen,
4. archiviert PDF und XML.

Scheitert ein Schritt – Template-Fehler, ungültige XML, Gotenberg nicht erreichbar –, wird nichts gespeichert: Das Dokument bleibt Entwurf und die Nummer bleibt frei.

Dokumente mit Profil `basic` (sowie Angebote und Auftragsbestätigungen) bekommen ein normales PDF ohne XML.

## Stornos sind Gutschriften

Ein abgeschlossenes Storno wird eine Gutschrift (Typcode 381) mit positiven Beträgen, die auf die stornierte Rechnung verweist (Nummer und Datum).

## Steuern

| Fall | Steuerkategorie | Befreiungsgrund |
|---|---|---|
| normaler Satz | `S` | – |
| Nullsatz | `Z` | – |
| Kleinunternehmer (§ 19 UStG) | `E` | der Kleinunternehmer-Hinweis |
| Reverse Charge in der EU | `AE` (USt-ID des Kunden nötig) | der Reverse-Charge-Hinweis |
| außerhalb der EU | `G` | der Drittland-Hinweis |

Die gesetzlichen Hinweise stehen außerdem als Dokumentnotizen in der XML.

## Was in die XML kommt

| openbill | EN 16931 |
|---|---|
| Nummer, Datum | Rechnungsnummer (BT-1), Rechnungsdatum (BT-2) |
| Organisation | Verkäufer: Name, Anschrift, USt-ID (`VA`) oder Steuernummer (`FC`), E-Mail |
| Kunde | Käufer: Name, Kundennummer, Anschrift, USt-ID |
| Leistungsdatum (-zeitraum) | Lieferdatum (BT-72), Leistungszeitraum (BT-73/74) |
| IBAN, BIC | SEPA-Überweisung (Zahlungsart 58) |
| Fälligkeit | Fälligkeitsdatum (BT-9) |
| Positionen | Bezeichnung, Beschreibung, Nettopreis (4 Nachkommastellen), Menge mit UN/ECE-Einheitencode, Steuerkategorie und -satz, Zeilenbetrag |
| Summen | Summe der Positionen, Steuerbasis, Steuerbetrag, Gesamtbetrag, Zahlbetrag |

Textzeilen stehen nicht in der XML; optionale Positionen gibt es nur in Angeboten.

## Downloads

Das archivierte PDF und die archivierte XML lassen sich einzeln herunterladen; beides sind immer die Dateien aus dem Archiv, nie ein neues Rendering. Nur abgeschlossene Rechnungen und Stornos mit E-Rechnungsprofil haben eine XML.

## Archiv

Archivierte Dateien liegen unter `storage/app/archive/<Jahr>/<Dokument-ID>.pdf` und `.xml`. openbill speichert die SHA-256-Prüfsumme jeder Datei und prüft sie bei jedem Download: Eine veränderte oder fehlende Datei wird als Fehler gemeldet statt ersetzt. Sichere diesen Ordner zusammen mit der Datenbank.

## Voraussetzungen und Grenzen

- Gotenberg **8.34 oder neuer** (das Docker-Image `gotenberg/gotenberg:8` ist es). `GOTENBERG_TIMEOUT` (Sekunden, Standard 20) begrenzt jede PDF-Anfrage; der Wert muss deutlich unter der Lock-Wartezeit der Datenbank (50 s) bleiben.
- openbill prüft die XML gegen das Schema. Geschäftsregeln jenseits des Schemas (EN-16931-Schematron) deckt das Prüfprofil ab; für eine vollständige Prüfung nutze einen externen Validator.
- Noch nicht unterstützt: XRechnung mit Leitweg-ID, andere Währungen als EUR, Zu- und Abschläge, negative Einzelpreise.
