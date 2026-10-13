# Einstellungen

Unter **Einstellungen** stehen deine Firma, die Dokumenttypen, die Kundennummern und die Stammdaten. Alles davon geht auch über die REST-API (außer Benutzer und Tokens).

## Organisation

![Einstellungen der Organisation](/screenshots/de/settings-organization.png)

Name, Adresse, Logo (PNG, JPEG, GIF, WebP oder SVG, höchstens 1 MB – ohne Logo zeigen die Templates den Namen), Besteuerung (Regelbesteuerung oder Kleinunternehmer nach § 19 UStG), USt-ID, Steuernummer, **Registernummer** (`registration_id`, z. B. der Handelsregistereintrag), Bank- und Kontaktdaten, die Standard-Dokumentsprache und die eigenen Felder der Organisation. Fehlende Angaben des E-Rechnungs-Profils erscheinen in der Prüfanzeige des Dokument-Editors; ein Klick dort öffnet diese Seite am richtigen Feld. Ein neues Logo behält die alte Datei für abgeschlossene Dokumente; `app:prune-images` entfernt alte Logos, auf die nichts mehr verweist (siehe [Eigene Felder](/de/custom-fields#typen)).

Das E-Rechnungs-Profil braucht die USt-ID oder die Registernummer; bei Reverse Charge und Ausfuhr von Waren die USt-ID, bei Dienstleistungen an Kunden außerhalb der EU die Registernummer (die USt-IDs dürfen in dieser E-Rechnung nicht stehen).

## Dokumenttypen

Je Typ: das **Prüfprofil** (Basis oder E-Rechnung EN 16931 für Rechnungen und Stornos), der **Nummernkreis** und die **Vorgaben** für neue Dokumente (Template, Zahlungsziel, Gültigkeit, Einleitung und Schlusstext).

Muster nutzen `{YYYY}`, `{YY}`, `{MM}` und eine laufende Nummer `{0000}` (so viele Stellen wie Nullen). Mit „Jedes Jahr wieder bei 1 anfangen“ muss das Muster das Jahr enthalten. Die Vorschau neben dem Muster kommt vom Server und zeigt die nächste Nummer genau so, wie sie beim Abschließen vergeben würde. „Nächste laufende Nummer“ setzt einen bestehenden Nummernkreis fort; schon vergebene Nummern werden übersprungen.

## Kunden

Die **Kundennummern**: Ein neuer Kunde, dessen Nummernfeld leer bleibt, bekommt die nächste Nummer dieses Kreises; eine von Hand eingetragene Nummer bleibt, wie sie ist. Muster funktionieren wie bei den Dokumenttypen (`{YYYY}`, `{YY}`, `{MM}`, `{0000}`, optional jedes Jahr neu nach dem Datum, an dem der Kunde angelegt wird); die Nummer darf höchstens 32 Zeichen lang sein. Vorhandene Nummern – auch die gelöschter Kunden – werden übersprungen, und die Vorschau zeigt die Nummer, die ein neuer Kunde wirklich bekommt. Das Formular für einen neuen Kunden zeigt sie als Platzhalter.

Nach einem Update setzt der Kreis die bisher vergebenen Nummern fort: die höchste Nummer ab 1000 der Form *Präfix + Ziffern* (zum Beispiel `K-1004` → `K-{0000}` ab 1005), sonst `C-{0000}` ab 1001.

## Steuern & Einheiten

Steuersätze tragen eine EN-16931-Kategorie (`S` Normalsatz, `Z` Nullsatz, `E` steuerbefreit, `AE` Reverse Charge, `K` innergemeinschaftliche Lieferung, `G` Ausfuhr, `O` nicht steuerbar) und bei 0 % einen gesetzlichen Hinweis. Einheiten tragen einen Code nach UN/ECE Recommendation 20 (z. B. `HUR` Stunde, `DAY` Tag, `H87` Stück); ohne Code lässt sich keine E-Rechnung abschließen.

Löschen **archiviert** einen Satz oder eine Einheit: Er verschwindet aus der Auswahl, bestehende Dokumente behalten ihn. „Rückgängig“ im Hinweis oder „Wiederherstellen“ in der Liste der archivierten holt ihn zurück.

## Textbausteine

::: v-pre
Wiederverwendbare Texte für Einleitung, Schluss, Zahlungsbedingungen und Hinweise. Sie dürfen Liquid-Platzhalter wie `{{ customer.name }}` oder `{{ document.due_date | date }}` enthalten, die beim Rendern ausgefüllt werden. Ein Textbaustein kann Vorgabe eines Dokumenttyps sein.
:::

## Benutzer

Alle Benutzer arbeiten in derselben Organisation. **Inhaber** laden ein, ändern Rollen und deaktivieren Benutzer; **Mitglieder** dürfen alles andere (Dokumente, Kunden, Templates, Felder, Einstellungen). Mindestens ein aktiver Inhaber bleibt immer, und niemand kann sich selbst deaktivieren.

openbill verschickt keine E-Mails: **Einladen** erzeugt einen Link zum Weitergeben. Er gilt 7 Tage und funktioniert einmal; er öffnet eine Seite, auf der die eingeladene Person Namen und Passwort festlegt und angemeldet wird. Offene Einladungen lassen sich erneut kopieren oder zurückziehen.

Benutzer werden nie gelöscht, sondern **deaktiviert**: Das Konto bleibt, damit Dokumente und ihr Protokoll ihren Ersteller behalten, aber die Person kann sich nicht mehr anmelden (die Anmeldung sagt, dass das Konto deaktiviert ist), ihre API-Tokens und Sitzungen enden sofort und sie bekommt keine neuen Tokens. **Wieder aktivieren** lässt sie sich wieder anmelden; alte Tokens bleiben widerrufen.

Die Benutzerverwaltung gibt es nur in der App (nicht über API-Tokens oder MCP).

## Dein Konto

Zeigt, wer angemeldet ist, und ändert dein eigenes Passwort: das aktuelle eingeben und das neue zweimal (mindestens 8 Zeichen). Hier bleibst du angemeldet; alle anderen Sitzungen deines Kontos werden abgemeldet, und „Angemeldet bleiben“ wirkt auf anderen Geräten nicht mehr. API-Tokens bleiben gültig – widerrufe sie unter **API & MCP**, falls auch sie bekannt geworden sein könnten.

Passwort vergessen: Owner sehen und setzen keine Passwörter. Wer den Server betreibt, setzt es mit `php artisan app:reset-password <E-Mail>` zurück (siehe [Einrichtung](/de/setup#passworter)).

## API & MCP

![API-Tokens und die MCP-Einrichtung](/screenshots/de/settings-api.png)

Mit Tokens handeln Agenten, Skripte und das Template-Toolkit in deinem Namen. **Neuer Token** fragt nach einem Namen und den Fähigkeiten (MCP, REST-API lesen bzw. lesen und schreiben, Template-Vorschau); openbill zeigt den Token einmal an, mit den fertigen Einrichtungsbefehlen für Claude Code, Codex und andere MCP-Clients. Die Liste zeigt deine eigenen Tokens mit Fähigkeiten, Anlagedatum und letzter Benutzung; **Widerrufen** beendet einen Token sofort. Tokens für das Template-Toolkit entstehen im Template-Editor und erscheinen hier als *Toolkit · &lt;Template&gt;*. Die Karte **REST-API** öffnet die interaktive API-Referenz (`/api/docs`). Details: [MCP](/de/mcp), [REST-API](/de/api).
