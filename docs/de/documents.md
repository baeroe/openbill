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
4. speichert die Summen,
5. rendert das PDF mit dem Template des Dokuments und archiviert es; E-Rechnungen bekommen dazu die XML nach EN 16931, eingebettet in ein PDF/A-3b (siehe [E-Rechnung](/de/e-invoice)).

Scheitert ein Schritt – auch ein Template-Fehler oder ein PDF-Dienst, der nicht antwortet –, ändert sich nichts: Das Dokument bleibt Entwurf und die Nummer bleibt frei.

Danach ist das Dokument **gesperrt**. Nur Status, Zahlungsdatum und der Verweis auf das Storno können sich noch ändern. Spätere Änderungen an Kunden, Steuersätzen, Einheiten, Templates oder eigenen Feldern wirken nicht mehr, weil das Dokument aus seinen eingefrorenen Stammdaten angezeigt und berechnet wird. Eine Rechnung korrigierst du mit einem Storno und einer neuen Rechnung.

Downloads eines abgeschlossenen Dokuments liefern immer das archivierte PDF (und die XML), geprüft gegen die beim Archivieren gespeicherte SHA-256-Prüfsumme. Auch ein Entwurf lässt sich herunterladen: Sein PDF wird frisch gerendert, auf jeder Seite als „Entwurf“ markiert und nicht archiviert. Wie Dokumente gerendert werden, steht unter [Templates](/de/templates).

Die Sperre sichert auch die Datenbank ab: Schreibzugriffe, die ein abgeschlossenes Dokument, seine Gruppen oder Positionen ändern, und jede Änderung an eingefrorenen Stammdaten oder archivierten Dateien werden abgelehnt, egal auf welchem Weg sie kommen. Ein abgeschlossenes Dokument wird nie wieder zum Entwurf.

### Prüfprofile

| Profil | Prüft |
|---|---|
| Basis | Datum, Kunde, mindestens eine Leistung, Bezeichnung, Steuersatz (außer bei Kleinunternehmern) und Einheit jeder Leistung, eigene Pflichtfelder |
| E-Rechnung (EN 16931) | alles aus Basis, dazu Name, vollständige Adresse, USt-ID oder Steuernummer, USt-ID oder Registernummer (bei Regelbesteuerung ist bei Reverse Charge und Ausfuhr von Waren die USt-ID Pflicht, bei Dienstleistungen an Kunden außerhalb der EU die Registernummer) und IBAN der Organisation, vollständige Kundenadresse, USt-ID des Kunden bei Reverse Charge, Leistungsdatum, Fälligkeit (Rechnungen), einen Einheiten-Code je Einheit und keine Menge 0 |

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

## In der App

### Übersicht

Nach dem Anmelden landest du auf der Übersicht. Vier Kennzahlen fassen das Geld zusammen: offene Rechnungen, wie viel davon überfällig ist, offene Angebote und was in diesem Monat bezahlt wurde (mit der Summe seit Jahresbeginn). Die Kennzahlen zu offenen Rechnungen und Angeboten öffnen die passend gefilterte Liste. **Braucht deine Aufmerksamkeit** zeigt zuerst überfällige Rechnungen, dann offene Angebote, deren Gültigkeit in den nächsten sieben Tagen endet oder schon abgelaufen ist, dann Entwürfe. **Zuletzt bearbeitet** zeigt die sechs zuletzt geänderten Dokumente.

### Dokumentliste

**Dokumente** zeigt alle Dokumente, die neuesten zuerst und nach Monaten gruppiert. Filtern lässt sich nach Art (jede Pille zeigt, wie viele Dokumente dieser Art unter den übrigen Filtern dazukommen), nach Status und Kunde, dazu eine Suche über Nummer und Kundennamen. Der Statusfilter kennt zusätzlich **Überfällig**: offene Rechnungen, deren Fälligkeit überschritten ist. Jeder Filter steht in der Adresse, zum Beispiel `/de/documents?type=invoice&status=overdue`; eine gefilterte Liste lässt sich also als Lesezeichen speichern, weitergeben und mit dem Zurück-Knopf des Browsers wieder aufrufen. Die Liste lädt 50 Dokumente auf einmal (**Mehr laden**); die Zeile darunter zählt alle passenden Dokumente und summiert ihre Bruttobeträge.

### Neues Dokument

**Neues Dokument** in der Seitenleiste – oder die Taste **N** überall, solange du nicht in einem Feld tippst – öffnet einen Dialog: Art und Kunde wählen (den Kunden auch später), und openbill legt einen Entwurf mit den Vorgaben des Dokumenttyps an. Stornos entstehen hier nicht, sondern immer aus einer Rechnung. Der neue Entwurf öffnet sich im Dokument-Editor.

### Dokument-Editor

Jedes Dokument öffnet sich im Editor: links das Formular, rechts eine Live-Vorschau (auf schmalen Bildschirmen unter dem Formular). Die Vorschau zeigt die Seiten genau so, wie das PDF aussehen wird – openbill rendert Kopfzeile, Inhalt und Fußzeile auf dem Server mit dem Template des Dokuments und teilt sie im Browser nur in Seiten auf. **Bereiche** umrandet Kopfzeile, Inhalt und Fußzeile auf jeder Seite. Die Vorschau lässt sich aus- und wieder einblenden; die Wahl merkt sich dieser Browser.

- **Kopfdaten:** Kunde, Ansprechpartner (der Standard-Ansprechpartner des Kunden ist vorausgewählt), Datum, Gültig bis (Angebote), Leistungszeitraum (Rechnungen und Stornos), Fälligkeit (Rechnungen), Dokumentsprache und Template, dazu die eigenen Felder des Dokuments. Ein Storno behält immer den Kunden seiner Rechnung.
- **Positionen:** Positionen lassen sich in Gruppen ordnen, jede mit Zwischensumme. Gruppen und Positionen ziehst du am Griff – auch per Tastatur: Griff fokussieren, Leertaste, mit den Pfeiltasten bewegen, Leertaste. Eine Position ist eine Leistung, eine Textzeile oder in Angeboten eine optionale Leistung, die angezeigt, aber nicht mitgerechnet wird. Beim Tippen der Bezeichnung schlägt openbill Positionen aus früheren Dokumenten mit Preis, Einheit und Steuersatz vor. Zahlen gehen mit Komma oder Punkt (`12,5` oder `12.5`); ungültige Eingaben werden markiert und nicht gespeichert. Das Entfernen einer Gruppe oder Position lässt sich in der eingeblendeten Meldung rückgängig machen.
- **Texte:** Einleitung und Schlusstext, frei getippt oder aus Textbausteinen eingefügt.
- **Summen und Prüfung:** Netto, Umsatzsteuer je Satz, Gesamt, optionale Positionen und rechtliche Hinweise kommen vom Server, ebenso die Zeilen- und Gruppensummen. Die Prüfanzeige listet, was das Prüfprofil des Dokuments noch verlangt; ein Klick springt ins Feld. Punkte zum Kunden verlinken auf den Kunden, Punkte zur eigenen Organisation öffnen die Einstellungen der Organisation am richtigen Feld.
- **Speichern:** Änderungen speichert openbill kurz nach dem letzten Tastendruck von selbst; der Kopf zeigt *Ungespeichert*, *Speichert …* und *Gespeichert*. Beim Verlassen der Seite oder Schließen des Tabs wird vorher gespeichert. Auch Abmelden speichert vorher und schickt Löschungen ab, die noch auf ihre Rückgängig-Meldung warten, und wartet darauf zusammen höchstens drei Sekunden; eine Meldung sagt, dass du abgemeldet wirst. War deine Sitzung schon beendet, landest du einfach bei der Anmeldung. Scheitert das Abmelden (etwa ohne Verbindung oder ohne Antwort binnen zehn Sekunden), bleibst du angemeldet, Bearbeiten und Speichern laufen weiter, und eine Meldung sagt das. Scheitert das Speichern an der Verbindung, versucht openbill es selbst erneut (oder sofort mit **Erneut versuchen**); ungültige Eingaben werden am Feld markiert. Wurde das Dokument inzwischen woanders abgeschlossen oder gelöscht (anderer Tab, API oder MCP), hört der Editor auf zu speichern und sagt das. Bearbeiten zwei Personen gleichzeitig denselben Entwurf, überschreiben sie sich gegenseitig – der letzte Stand gewinnt. Ist deine Sitzung abgelaufen, behält openbill die Änderungen seit dem letzten Speichern in diesem Tab und schickt dich zur Anmeldung; öffnest du das Dokument danach wieder (als dieselbe Person, innerhalb eines Tages), sind sie wieder da und werden gespeichert. Bekannte Grenzen: Wird der Tab geschlossen, während noch gespeichert wird, kann in seltenen Fällen das ältere Speichern zuletzt ankommen; sehr große Entwürfe (mehrere hundert Positionen) gehen beim Schließen des Tabs gar nicht mehr raus.
- **Aktionen:** **Abschließen** fragt nach und nennt die Nummer, die das Dokument bekommt; fehlen noch Pflichtangaben, springt es stattdessen zur ersten. Abgeschlossene Dokumente sind schreibgeschützt. Je nach Status kannst du ihn ändern (z. B. *Als angenommen markieren*, *Als bezahlt markieren*), ein Dokument entlang der Kette umwandeln, eine Rechnung stornieren, ein Dokument duplizieren, das PDF herunterladen (Entwürfe mit Wasserzeichen) und einen Entwurf löschen – mit **Rückgängig**, solange die Meldung zu sehen ist.
- **Kette und E-Rechnung:** Über dem Formular verbindet die Kette Angebot, Auftragsbestätigung, Rechnung und Storno, die zusammengehören. Mit dem E-Rechnungs-Profil zeigt der Tab **E-Rechnung** die XML einer abgeschlossenen Rechnung oder eines Stornos (kopieren oder herunterladen); bei Entwürfen erklärt er, dass die XML beim Abschließen entsteht.

### Kunden

**Kunden** listet alle Kunden mit ihrem Standard-Ansprechpartner und dem, was offen ist: die Summe ihrer offenen Rechnungen, überfällige markiert. Die Suche geht über Name, Nummer und E-Mail.

Die Seite eines Kunden enthält die Stammdaten, die **Steuerbehandlung** (Inland; EU mit USt-ID, also Reverse Charge; Drittland), die **Kundenart** (Unternehmen oder Privatperson), bei Kunden außerhalb der EU die **Leistungsart**, die eigenen Felder des Kunden, die **Ansprechpartner** und seine Dokumente. Ansprechpartner bearbeitest du in einem Seitenpanel; einer davon ist der Standard, den neue Dokumente übernehmen. Alle Änderungen, auch die an Ansprechpartnern, speichert **Speichern** zusammen:

- Fehler stehen am betroffenen Feld (oder am Ansprechpartner), und gespeichert wird erst, wenn alles gültig ist.
- Leerzeichen am Anfang und Ende werden entfernt; eine leere Kundennummer bekommt die nächste freie Nummer.
- Wer die Seite mit ungespeicherten Änderungen verlässt, wird vorher gefragt.
- Kunden mit abgeschlossenen Dokumenten lassen sich nicht löschen.

Die **Kundenart** sagt, ob der Kunde ein Unternehmen (Standard) oder eine Privatperson ist. Bei Kunden außerhalb der EU entscheiden **Leistungsart** und **Kundenart** über die Steuer: Dienstleistungen an Unternehmen sind im Inland nicht steuerbar (Kategorie `O`), Dienstleistungen an Privatpersonen behalten den normalen Satz, Waren sind steuerfreie Ausfuhren (`G`). Bestehende Drittland-Kunden wurden beim Einführen der Option auf Ware gesetzt, ihre Entwürfe behalten also die bisherige Behandlung.

### Templates, eigene Felder und Einstellungen

Templates, eigene Felder und Einstellungen haben eigene Seiten: siehe [Templates](/de/templates#template-editor), [Eigene Felder](/de/custom-fields) und [Einstellungen](/de/settings).

### Darstellung und Sprache

Das Kontomenü unten in der Seitenleiste schaltet zwischen hell, dunkel und der Systemeinstellung um (gemerkt pro Browser) und zwischen Englisch und Deutsch. Die Seitenleiste lässt sich auf Symbole einklappen; auf kleinen Bildschirmen öffnet sie der Menü-Knopf.

## Demo-Daten

Zum Entwickeln und Ausprobieren:

```bash
ddev artisan db:seed --class=DemoSeeder
```

Das **ersetzt alle Fachdaten** (Dokumente, Kunden, eigene Felder, Steuersätze, Einheiten, Textbausteine, Templates, Nummernkreise) durch die fiktive Firma Studio Nordlicht und ihre Kunden. Benutzerkonten bleiben.
