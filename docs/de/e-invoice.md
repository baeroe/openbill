# E-Rechnung

openbill erzeugt E-Rechnungen nach **EN 16931** in der Syntax UN/CEFACT CII (Factur-X / ZUGFeRD, Profil EN 16931). Die XML steckt in einem **PDF/A-3b**, eine Datei reicht also für Menschen und Buchhaltungssoftware.

::: warning Keine Steuer- oder Rechtsberatung
openbill hilft dir, Rechnungen nach EN 16931 zu schreiben, und prüft, was es prüfen kann. Es ist aber keine Steuer- oder Rechtsberatung und sichert nicht zu, dass deine Dokumente, dein Archiv oder deine Abläufe die für dich geltenden Vorschriften erfüllen (z. B. GoBD, Umsatzsteuerrecht). Stimm deine Einrichtung mit deiner Steuerberatung ab. openbill kommt ohne Gewährleistung (MIT-Lizenz).
:::

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

Ein abgeschlossenes Storno wird eine Gutschrift (Typcode 381) mit positiven Beträgen, die auf die stornierte Rechnung verweist (Nummer und Datum). Sie trägt die Zahlungsbedingung „Der Betrag wird erstattet.“ in der Dokumentsprache. Ihre Steuerkategorien und -sätze sind die der Rechnung (siehe [Steuern und Summen](/de/documents#steuern-und-summen)), auch wenn sich Organisation, Kunde oder Steuersatz seitdem geändert haben.

## Rabatte

Ein Rabatt ist eine Position mit negativem Preis. In der XML bleibt der Preis positiv und die Menge trägt das Vorzeichen (EN 16931 verbietet negative Nettopreise); der Zeilenbetrag bleibt gleich.

## Steuern

| Fall | Steuerkategorie | Befreiungsgrund |
|---|---|---|
| normaler Satz | `S` | – |
| Nullsatz | `Z` | – |
| Kleinunternehmer (§ 19 UStG) | `E` | der Kleinunternehmer-Hinweis |
| Reverse Charge in der EU | `AE` (USt-ID des Kunden nötig) | der Reverse-Charge-Hinweis |
| Waren an Kunden außerhalb der EU | `G` | der Drittland-Hinweis |
| Dienstleistungen an Unternehmen außerhalb der EU | `O` (ohne Satz) | der Hinweis auf die im Inland nicht steuerbare Leistung |
| Dienstleistungen an Privatpersonen außerhalb der EU | der Satz der Position (meist `S`) | – |

Ohne Steuer- oder Rechtshinweis bekommt eine steuerbefreite Kategorie einen Standardgrund (z. B. „Steuerbefreit“).

`O` – nicht steuerbar: Dienstleistungen an Unternehmen außerhalb der EU (Kundenoptionen „Leistungsart“ = Dienstleistung und „Kundenart“ = Unternehmen, § 3a Abs. 2 UStG). Dienstleistungen an Privatpersonen außerhalb der EU sind im Inland steuerbar (§ 3a Abs. 1 UStG): Sie behalten den normalen Satz der Position und bekommen keinen Befreiungshinweis. Die XML enthält dann weder deine USt-ID noch die des Kunden (BR-O-02) und keinen Steuersatz; deine Registernummer identifiziert dich (BR-CO-26), deshalb verlangt das E-Rechnungs-Profil sie. Waren an Kunden außerhalb der EU bleiben Ausfuhren (`G`) und brauchen deine USt-ID. Dokumente, die vor dieser Option abgeschlossen wurden, behalten ihre Kategorie über ihren Snapshot.

Die gesetzlichen Hinweise stehen außerdem als Dokumentnotizen in der XML.

## Was in die XML kommt

| openbill | EN 16931 |
|---|---|
| Nummer, Datum | Rechnungsnummer (BT-1), Rechnungsdatum (BT-2) |
| Organisation | Verkäufer: Name, Anschrift, USt-ID (`VA`) und/oder Steuernummer (`FC`), Registernummer (BT-30), E-Mail |
| Kunde | Käufer: Name, Kundennummer, Anschrift, USt-ID |
| Leistungsdatum (-zeitraum) | Lieferdatum (BT-72), Leistungszeitraum (BT-73/74) |
| IBAN, BIC | SEPA-Überweisung (Zahlungsart 58) |
| Fälligkeit | Fälligkeitsdatum (BT-9) |
| Positionen | Bezeichnung, Beschreibung, Nettopreis (4 Nachkommastellen), Menge mit UN/ECE-Einheitencode, Steuerkategorie und -satz, Zeilenbetrag |
| Summen | Summe der Positionen, Steuerbasis, Steuerbetrag, Gesamtbetrag, Zahlbetrag |

Textzeilen stehen nicht in der XML; optionale Positionen gibt es nur in Angeboten.

## Downloads

![Die archivierte XML einer abgeschlossenen Rechnung im Editor](/screenshots/de/einvoice.png)

Das archivierte PDF und die archivierte XML lassen sich einzeln herunterladen; beides sind immer die Dateien aus dem Archiv, nie ein neues Rendering. Nur abgeschlossene Rechnungen und Stornos mit E-Rechnungsprofil haben eine XML.

## Archiv

Archivierte Dateien liegen unter `storage/app/archive/<Jahr>/<Dokument-ID>.pdf` und `.xml`. openbill speichert die SHA-256-Prüfsumme jeder Datei und prüft sie bei jedem Download: Eine veränderte oder fehlende Datei wird als Fehler gemeldet statt ersetzt. Sichere diesen Ordner zusammen mit der Datenbank.

## Voraussetzungen und Grenzen

- Gotenberg **8.34 oder neuer** (das Docker-Image `gotenberg/gotenberg:8` ist es). `GOTENBERG_TIMEOUT` (Sekunden, Standard 20) begrenzt jede PDF-Anfrage; der Wert muss deutlich unter der Lock-Wartezeit der Datenbank (50 s) bleiben.
- openbill prüft jede XML vor dem Archivieren gegen das Schema. Die Geschäftsregeln von EN 16931 (Schematron) deckt das Prüfprofil ab. In der Entwicklung und in CI werden die E-Rechnungsfälle der Tests zweifach geprüft (`scripts/validate-einvoice.sh`): mit dem offiziellen CEN-Schematron und mit dem KoSIT-Validator im Szenario „EN16931 (CII)“ (Schema und EN-16931-Regeln; die deutschen XRechnung-Regeln BR-DE, etwa die Leitweg-ID, gehören nicht dazu, weil openbill keine XRechnung erzeugt).
- Der Verkäufer braucht eine USt-ID oder eine Registernummer; bei Regelbesteuerung brauchen Reverse Charge und Kunden außerhalb der EU die USt-ID (Kleinunternehmer rechnen mit Kategorie `E` ab, dort reicht die Steuernummer).
- Kunden außerhalb der EU: Waren werden mit Kategorie `G` (Ausfuhr) besteuert, Dienstleistungen an Unternehmen mit Kategorie `O` (nicht steuerbar, ohne USt-IDs in der XML), Dienstleistungen an Privatpersonen mit dem normalen Satz der Position.
- Noch nicht unterstützt: XRechnung mit Leitweg-ID, andere Währungen als EUR, Zu- und Abschläge auf Dokumentebene.
