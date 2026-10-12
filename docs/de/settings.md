# Einstellungen

Unter **Einstellungen** stehen deine Firma, die Dokumenttypen und die Stammdaten. Alles davon geht auch über die REST-API (außer Benutzer).

## Organisation

Name, Adresse, Logo (PNG, JPEG, GIF, WebP oder SVG, höchstens 1 MB – ohne Logo zeigen die Templates den Namen), Besteuerung (Regelbesteuerung oder Kleinunternehmer nach § 19 UStG), USt-ID, Steuernummer, **Registernummer** (`registration_id`, z. B. der Handelsregistereintrag), Bank- und Kontaktdaten, die Standard-Dokumentsprache und die eigenen Felder der Organisation. Fehlende Angaben des E-Rechnungs-Profils erscheinen in der Prüfanzeige des Dokument-Editors; ein Klick dort öffnet diese Seite am richtigen Feld.

Das E-Rechnungs-Profil braucht die USt-ID oder die Registernummer; bei Reverse Charge und Ausfuhr von Waren die USt-ID, bei Dienstleistungen an Kunden außerhalb der EU die Registernummer (die USt-IDs dürfen in dieser E-Rechnung nicht stehen).

## Dokumenttypen

Je Typ: das **Prüfprofil** (Basis oder E-Rechnung EN 16931 für Rechnungen und Stornos), der **Nummernkreis** und die **Vorgaben** für neue Dokumente (Template, Zahlungsziel, Gültigkeit, Einleitung und Schlusstext).

Muster nutzen `{YYYY}`, `{YY}`, `{MM}` und eine laufende Nummer `{0000}` (so viele Stellen wie Nullen). Mit „Jedes Jahr wieder bei 1 anfangen“ muss das Muster das Jahr enthalten. Die Vorschau neben dem Muster kommt vom Server und zeigt die nächste Nummer genau so, wie sie beim Abschließen vergeben würde. „Nächste laufende Nummer“ setzt einen bestehenden Nummernkreis fort; schon vergebene Nummern werden übersprungen.

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
