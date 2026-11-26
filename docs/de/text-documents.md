# Textdokumente

Ein **Textdokument** besteht nur aus Worten: AGB, eine Leistungsbeschreibung, ein kleiner Vertrag. Es hat einen Titel und einen Text in Markdown, ein Datum, optional eigene Felder und optional einen Kunden. Positionen, Steuern und Summen gibt es nicht. Wie jedes Dokument bekommt es beim Abschließen eine Nummer (`T-{YYYY}-{0000}`), wird mit einem Template gerendert und als PDF archiviert; danach ist es gesperrt.

![Der Editor eines Textdokuments: Titel, Markdown-Text und die Live-Vorschau](/screenshots/de/text-editor.png)

## Anlegen und schreiben

**Neues Dokument** (oder die Taste **N**) → **Textdokument**. Der Kunde ist optional: AGB haben keinen, ein Rahmenvertrag für einen Auftraggeber schon. Der Editor zeigt:

- **Titel** und **Text**. Der Text ist Markdown: `## Überschrift`, Listen mit `-` oder `1.`, `**fett**`, `*kursiv*`, `> Zitat`, Links `[Text](https://…)`. Rohes HTML erscheint als einfacher Text, Bilder werden nicht angezeigt (das PDF lädt nichts von außen).
- Die üblichen Kopffelder: Datum, Kunde, Ansprechpartner, Sprache, Template und deine eigenen Felder für Textdokumente.
- **Veröffentlichen:** ein **Kurzname** (Buchstaben `a–z`, Ziffern und Bindestriche, zum Beispiel `agb`; alle Versionen eines Textes teilen ihn) und der Schalter **öffentlich**. Ein öffentlicher Text braucht einen Kurznamen und keinen Kunden. Öffentliche Texte werden in einem späteren Schritt dieser Funktion ohne Anmeldung erreichbar; bis dahin wird das Kennzeichen nur gespeichert.
- Rechts die Live-Vorschau, genau so wie das PDF aussehen wird. Die Prüfung unter dem Formular nennt, was noch fehlt (Datum, Titel, Text, Pflicht-Eigenfelder, „öffentlich“ zusammen mit einem Kunden).

Änderungen werden wie in jedem Entwurf automatisch gespeichert.

## Klauseln

Wiederkehrende Absätze sind **Textbausteine** der Art **Klausel** (Einstellungen → Textbausteine). Im Editor setzt **Klausel einfügen** den Text einer Klausel an die Cursorposition, als eigenen Absatz. Klauseln sind einfaches Markdown; sie werden als Text eingefügt, du kannst sie im Dokument also ändern, ohne den Textbaustein anzufassen.

## Abschließen und neue Versionen

Beim Abschließen prüft openbill den Entwurf, vergibt die Nummer (`T-2026-0001`), friert den Text ein, rendert das PDF mit dem Template des Dokumenttyps und legt es im Archiv ab. Der Status wird **abgeschlossen**; weitere Status gibt es bei einem Textdokument nicht. Danach lässt es sich nicht mehr ändern, in ein anderes Dokument umwandeln oder stornieren.

Eine **neue Version** ist eine Kopie: **Weitere Aktionen → Duplizieren** legt einen Entwurf mit demselben Titel, Text, Kurznamen und Öffentlich-Kennzeichen an, datiert auf heute. Ändere ihn und schließe ihn ab; die alte Version bleibt, wie sie war.

## Templates und Einstellungen

Die mitgelieferten Templates Klar, Kante und Leise (ab Version 1.2.0) setzen ein Textdokument als Titel und Text. Für eigene Templates siehe [Textdokumente in Templates](/de/templates#textdokumente). In **Einstellungen → Dokumenttypen** hat die Karte *Textdokument* den Nummernkreis und das Template; ein Prüfprofil oder Zahlungsziel gibt es nicht.

Textdokumente erscheinen in der [Dokumentliste](/de/documents#in-der-app) mit dem Filter **Texte**; ohne Kunde zeigt die Liste den Titel, die Betragsspalte bleibt leer. Sie zählen nie in Summen, Kennzahlen der Übersicht, offenen oder überfälligen Beträgen. Dasselbe geht über die [REST-API](/de/api#entwurfe-speichern) und [MCP](/de/mcp) (`type: text`, `title`, `body`, `slug`, `is_public`).
