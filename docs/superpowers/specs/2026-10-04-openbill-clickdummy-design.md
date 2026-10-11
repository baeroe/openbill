# openbill — Fachkonzept & Klickdummy (Design-Spec)

Stand: 2026-10-11 · Status: Entwurf zur Abstimmung

> **Änderungen vom 2026-10-11 (Klickdummy v2):** Projektphasen, Kategorien und Katalog entfallen, stattdessen gibt es Positionsgruppen im Dokument (2.6). Alle eigenen Felder werden an einem Ort gepflegt, Dokument- und Positionsfelder einmal definiert und per Häkchen den Dokumenttypen zugeordnet (2.3). Neue Gestaltung „Graphit & Kobalt“ ohne Tailwind (3.4, `prototypes/clickdummy-v2/DESIGN.md`).

## 1. Ziel & Kontext

openbill ist ein **offenes, self-hosted Tool für Angebote und Rechnungen**, bei dem Nutzer die Felder ihrer Dokumente und Positionen frei definieren und eigene PDF-Templates schreiben bzw. hochladen können.

- **Zielgruppe:** zunächst der Maintainer selbst (Freelancer), danach Open Source für alle, die ein simples, anpassbares Rechnungsprogramm brauchen.
- **Betrieb:** eine Organisation pro Instanz, mehrere Benutzer. Auslieferung als Docker-Compose-Stack.
- **Später (eigene Projekte, nicht Teil dieser Spec):** Template-Marketplace (Vorlagen veröffentlichen/browsen/herunterladen), kostenpflichtiges Cloud-Hosting. Das Design hält dafür die Tür offen (portable Template-Pakete, sichere Template-Sprache), baut aber nichts davon.

### Phasen

1. **Klickdummy (diese Spec):** React + Vite, Mock-Daten, keine UI-Library. Dient dazu, Idee und Funktionsumfang zu finalisieren.
2. **Implementierung (eigene Spec, später):** Laravel, lokale Entwicklung mit ddev, PDF-Rendering mit Gotenberg, E-Rechnung (ZUGFeRD/XRechnung), Produktion als Docker-Stack.

Diese Spec beschreibt das **Fachkonzept** (gilt für beide Phasen) und den **Umfang des Klickdummys**.

## 2. Fachkonzept

### 2.1 Dokumenttypen & Status

Vier Dokumenttypen zum Start. Status bewusst simpel:

| Typ | Kürzel | Status |
|---|---|---|
| Angebot | AN | Entwurf → Offen → Angenommen / Abgelehnt |
| Auftragsbestätigung | AB | Entwurf → Offen → Erledigt |
| Rechnung | RE | Entwurf → Offen → Bezahlt (Anzeige „überfällig“ wird aus Fälligkeit abgeleitet, kein eigener Status) · Storniert (gesetzt durch Storno) |
| Storno | ST | Entwurf → Abgeschlossen |

- **Abschließen** (Entwurf → Offen bzw. Abgeschlossen) vergibt die Nummer aus dem Nummernkreis und **sperrt das Dokument** gegen Änderungen (GoBD). Korrekturen an Rechnungen nur über Storno + neue Rechnung.
- Status lassen sich manuell setzen (z. B. „Bezahlt“), jeweils nur entlang der erlaubten Übergänge.

### 2.2 Dokumentkette (Umwandeln per Klick)

- Angebot → Auftragsbestätigung → Rechnung; Angebot → Rechnung direkt ist ebenfalls erlaubt.
- Rechnung → Storno: Ein Storno bezieht sich immer auf genau eine abgeschlossene Rechnung, übernimmt deren Positionen mit negativen Beträgen und setzt die Rechnung auf „Storniert“.
- Beim Umwandeln werden Kernfelder, Kunde, Ansprechpartner, Positionsgruppen, Positionen und Texte übernommen. **Eigene Felder** wandern mit, wenn das Feld auch für den Zieltyp gilt; sonst wird der Wert verworfen (Hinweis im UI).
- Jedes Dokument zeigt seine Kette („aus Angebot AN-2026-014“, „storniert durch ST-2026-002“).

### 2.3 Datenebenen: fester Kern + eigene Felder

Einheitliches Prinzip auf allen Ebenen: ein **fester Kern** (nicht löschbar, für Berechnungen und E-Rechnung nötig) plus **eigene Felder**, die der Nutzer definiert.

| Ebene | Kern | Liquid-Zugriff |
|---|---|---|
| Organisation | Name, Adresse, Logo, USt-ID, Steuernummer, Bankverbindung (IBAN/BIC/Bank), E-Mail, Telefon, Website, Besteuerungsart | `org.*` |
| Kunde | Name, Adresse, E-Mail, USt-ID, Steuerbehandlung, Kundennummer | `customer.*` |
| Ansprechpartner (n pro Kunde, einer Standard) | Anrede, Vorname, Nachname, Position, E-Mail, Telefon | `contact.*` |
| Dokument | Nummer, Datum, Kunde, Ansprechpartner (optional), Einleitung, Schlusstext, Template; typspezifisch z. B. Gültig bis (AN), Fälligkeit/Zahlungsziel (RE) | `document.*` |
| Position | Art, Titel, Beschreibung, Menge, Einheit, Einzelpreis, Steuersatz, Gruppe | `p.*` in `positions` bzw. `g.positions` |

**Feldtypen für eigene Felder:** Text, Mehrzeiliger Text, Zahl, Betrag, Datum, Auswahl (Optionen), Ja/Nein, Bild.
**Felddefinition:** Label, Schlüssel (`snake_case`, eindeutig pro Ebene, unveränderlich nach Anlage), Typ, Pflicht ja/nein, Standardwert, Hilfetext; bei Dokument- und Positionsfeldern zusätzlich die Dokumenttypen, für die das Feld gilt.

**Ein Ort für alle eigenen Felder:** „Eigene Felder“ zeigt alle Ebenen (Organisation, Kunde, Ansprechpartner, Dokument, Position) mit demselben Feld-Builder. Dokument- und Positionsfelder werden einmal definiert und per Häkchen den Dokumenttypen (AN, AB, RE, ST) zugeordnet. Kernfelder und die von Profilen verlangten Felder stehen gesperrt daneben. Die Dokumenttyp-Einstellungen enthalten keine Felder mehr.

### 2.4 Konformitätsprofile

Pro Dokumenttyp wird ein Profil gewählt. Ein Profil fügt Pflichtfelder auf allen Ebenen hinzu, prüft beim Abschließen und erzeugt ggf. einen Export.

- **Basis:** nur der Kern. International nutzbar.
- **E-Rechnung EN 16931 (ZUGFeRD/XRechnung):** macht u. a. Leistungsdatum/-zeitraum, Fälligkeit, Zahlungsbedingungen, USt-ID bzw. Steuernummer der Organisation, vollständige Kundenadresse, Einheitencodes und Steuerkategorien verpflichtend. Erzeugt PDF/A-3 mit eingebetteter XML (Phase 2). Nur für Rechnung und Storno wählbar.
- Profilfelder erscheinen im UI gesperrt mit Badge; das Dokument zeigt eine **Prüfanzeige** („2 Pflichtangaben fehlen“ mit Sprung zum Feld). Abschließen ist erst möglich, wenn die Prüfung grün ist.
- Erweiterbar (z. B. Swiss QR-Rechnung) — nicht im Startumfang.

### 2.5 Steuern

- **Besteuerungsart der Organisation:** Regelbesteuerung oder Kleinunternehmer (§ 19 UStG). Bei Kleinunternehmern ist auf Positionen keine Steuer wählbar (Steuerkategorie `E`), der Pflichthinweis wird automatisch gesetzt.
- **Steuersätze** (Einstellungen): Bezeichnung, Prozentsatz, EN-16931-Steuerkategorie (`S`, `Z`, `E`, `AE`, `K`, `G`), Standard-Hinweistext bei Befreiung. Vorbelegt: 19 %, 7 %, 0 %.
- **Steuerbehandlung des Kunden:** Inland, EU mit USt-ID (Reverse Charge, `AE`), Drittland (`G`). Überschreibt die Steuerkategorie der Positionen und setzt den Hinweistext.
- **Summen** pro Steuersatz: Netto, Steuer, Brutto (`document.tax_breakdown`), dazu `document.net_total`, `document.tax_total`, `document.gross_total`.
- **Gesetzliche Hinweise** (§ 19, Reverse Charge, Ausfuhr) entstehen ausschließlich aus den Steuerregeln: `document.legal_notes`.

### 2.6 Einheiten, Positionsgruppen, Positionsarten

- **Einheiten** (Einstellungen): Name, Kürzel, Nachkommastellen, UN/ECE-Rec-20-Code. Vorbelegt: Stunde `HUR`, Tag `DAY`, Stück `H87`, Pauschal `LS`, Kilometer `KMT`, Monat `MON`.
- **Positionsgruppen:** Ein Dokument gliedert seine Positionen in Gruppen mit Titel und Zwischensumme (z. B. „Konzept & UX“, „Umsetzung“). Gruppen lassen sich sortieren und einklappen, Positionen zwischen Gruppen verschieben. Positionen ohne Gruppe stehen in einer Gruppe ohne Titel. Im Template: `groups` mit `title`, `has_title`, `total`, `positions`.
- **Kein Katalog, keine Kategorien:** Die Positionszeile schlägt per Autocomplete Positionen aus früheren Dokumenten vor (Titel, Beschreibung, Einheit, Preis, Steuersatz). Projektphasen gibt es nicht als eigenes Konzept; sie sind Gruppen im Dokument.
- **Positionsarten:** Leistung, Textzeile (ohne Betrag), Optionale Position (nur Angebot, zählt nicht zur Summe).

### 2.7 Texte

- **Textbausteine:** Bibliothek wiederverwendbarer Texte (Einleitung, Schlusstext, Zahlungsbedingungen, Hinweis). Dürfen Liquid-Platzhalter enthalten.
- Jedes Dokument hat eine **Einleitung** und einen **Schlusstext** (vor bzw. nach den Positionen); frei schreibbar oder aus Bausteinen einfügbar. Pro Dokumenttyp ist ein Standard-Baustein für beide hinterlegbar.
- Nicht zu verwechseln mit **Kopf- und Fußzeile**: Die gehören zum Template und stehen auf jeder Seite (siehe 2.9).

### 2.8 Nummernkreise

Pro Dokumenttyp ein Muster, z. B. `RE-{YYYY}-{0000}`; Platzhalter `{YYYY}`, `{YY}`, `{MM}`, `{0000}` (fortlaufend, Stellenzahl = Anzahl Nullen). Zurücksetzen jährlich optional. Nächste Nummer sichtbar.

### 2.9 Templates

- **Sprache:** HTML + CSS mit **Liquid** (sandboxed by design, identisch im Browser via `liquidjs` und auf dem Server via `keepsuit/liquid`). Gotenberg rendert das finale PDF.
- **Kontext:** `org`, `customer`, `contact`, `document`, `positions`, `groups`, `document.tax_breakdown`, `document.legal_notes`. Filter u. a. `money`, `date`, `number`, `nl2br`.
- **Seitenaufbau wie bei Gotenberg/Chromium:** Ein Template hat drei Teile: **Kopfzeile**, **Inhalt**, **Fußzeile**.
  - Kopf- und Fußzeile werden als `header.html`/`footer.html` an Gotenberg übergeben und auf **jeder Seite** im oberen bzw. unteren Seitenrand wiederholt.
  - Ihre Höhe ist der Seitenrand (`marginTop`/`marginBottom`); was höher ist, wird abgeschnitten.
  - Sie laufen in einem **eigenen Kontext**: kein CSS des Inhalts, kein JavaScript, keine externen Ressourcen. Styles stehen in einem `<style>` im jeweiligen Teil, Bilder (Logo) als Data-URL.
  - Seitenzahlen: Template-Autoren schreiben `{{ page.number }}` / `{{ page.total }}`; daraus wird `<span class="pageNumber">` / `<span class="totalPages">`, das Chromium beim Drucken befüllt.
- **Vorschau:** zeigt echte Seiten (Umbruch an Zeilen- und Absatzgrenzen), Kopf- und Fußzeile auf jeder Seite, Seitenzahl gefüllt, Anzahl der Seiten. Ein Schalter „Bereiche“ blendet Hilfslinien für Kopfzeile, Inhalt und Fußzeile ein; im Template-Editor ist der gerade bearbeitete Bereich hervorgehoben.
- **Template-Paket** (portabel, Marketplace-tauglich): ZIP mit
  - `manifest.json` — Name, Version, Autor, Lizenz, Beschreibung, unterstützte Dokumenttypen, erwartete eigene Felder (Schlüssel, Typ, Fallback), Papier: Format, Kopfzeilenhöhe, Fußzeilenhöhe, Rand links/rechts
  - `header.liquid` (Kopfzeile), `template.liquid` (Inhalt), `footer.liquid` (Fußzeile), `styles.css` (nur Inhalt), optional `assets/` (Fonts, Grafiken)
- Beim Zuweisen eines Templates zu einem Dokumenttyp zeigt das UI, welche erwarteten Felder fehlen (Hinweis, kein Blocker — Templates müssen mit leeren Werten umgehen).
- Mitgeliefert: 2–3 Standard-Templates unterschiedlicher Anmutung.

## 3. Klickdummy

### 3.1 Zweck & Abgrenzung

Ein durchklickbarer Prototyp, der alle oben genannten Funktionen sichtbar und bedienbar macht, um das Konzept zu prüfen. **Kein** Backend, **kein** echtes PDF, **keine** echte XML-Validierung, **keine** Authentifizierung.

### 3.2 Technik

> **v2 (`prototypes/clickdummy-v2/`):** Vite + React + TypeScript, React Router, eigenes CSS mit Tokens (kein Tailwind, keine UI-Library), TanStack Query über einer Fake-API (`src/api/*`, später gegen echte Endpunkte tauschbar), Zustand nur für Client-State, liquidjs, CodeMirror 6, @dnd-kit, lucide-react. Die Punkte unten beschreiben v1.

- `prototypes/clickdummy/` (ursprünglich `clickdummy/` im Repo-Root; mit Phase 1 der App nach `prototypes/` verschoben).
- Vite + React + TypeScript, React Router, **pnpm**.
- Styling mit **Tailwind CSS v4** (Design-Tokens via `@theme`), Light + Dark.
- **Keine UI-Library** (kein shadcn o. Ä.); eigenes kleines Komponentenset auf Tailwind-Basis.
- Lokaler State mit **Zustand** (Stores je Domäne, `persist`-Middleware für `localStorage`).
- Erlaubte Bibliotheken: `liquidjs` (echte Live-Vorschau), CodeMirror 6 (Template-Editor), ggf. ein Icon-Set.
- **Mock-Daten:** realistische Demo-Daten (fiktive Firma „Studio Nordlicht“ o. ä., fiktive Kunden — keine echten Namen), in Zustand-Stores, persistiert in `localStorage`, mit „Demo-Daten zurücksetzen“.
- Rechenlogik (Summen, Steuern, Nummernkreise, Umwandeln) ist im Dummy echt implementiert, damit sich das Konzept realistisch anfühlt.

### 3.3 Screens

1. **Login** — eigenständig gestaltet, Fake-Login (jede Eingabe führt rein).
2. **Übersicht** — offene Rechnungssumme, überfällige Rechnungen, offene Angebote, zuletzt bearbeitete Dokumente, Schnellaktion „Neues Dokument“.
3. **Dokumente** — Liste mit Filter nach Typ, Status, Kunde und Suche; Status-Badges, Überfällig-Markierung.
4. **Dokument-Editor** — Kernfelder + eigene Felder, Kunde/Ansprechpartner, Positionsgruppen mit Zwischensummen (Drag & Drop für Gruppen und Positionen, Positionsarten, Autocomplete aus früheren Positionen), Einleitung/Schlusstext mit Baustein-Einfügen, Summen inkl. Steueraufschlüsselung, Prüfanzeige des Profils, **Live-Vorschau daneben (echte A4-Seiten mit Kopf- und Fußzeile, Hilfslinien einblendbar)**, Aktionen: Abschließen, Status setzen, Umwandeln, Stornieren, „PDF herunterladen“ (Dummy), E-Rechnung-Tab mit XML-Vorschau (Mock), Dokumentkette.
5. **Kunden** — Liste, Detail mit Kern + eigenen Feldern, Steuerbehandlung, Ansprechpartnern, zugehörigen Dokumenten.
6. **Eigene Felder** — alle Ebenen an einem Ort, Dokumenttypen per Häkchen, Kernfelder und Profil-Pflichtfelder gesperrt daneben.
7. **Templates** — Galerie mit Vorschaubildern, Import eines ZIP (simuliert), Editor mit Tabs Kopfzeile · Inhalt · Fußzeile · CSS · Manifest (CodeMirror), Seitenskizze zeigt den bearbeiteten Bereich, Live-Vorschau rechts mit Beispieldokument und hervorgehobenem Bereich, Seitenleiste mit verfügbaren Feldern (klickbar zum Einfügen), Manifest-Bearbeitung.
8. **Einstellungen**
   - Organisation (Kern + eigene Felder, Logo-Upload, Besteuerungsart)
   - Dokumenttypen (je Typ: Profil, Nummernkreis, Standard-Template, Standard-Texte, Zahlungsziel)
   - Steuersätze, Einheiten, Textbausteine
   - Benutzer (Liste, Einladen — Dummy)

### 3.4 Gestaltung

Umsetzung mit dem Frontend-Design-Skill. Leitlinie: **modern, ruhig, eigenständig — nicht verspielt, nicht bieder.**

- Richtung **„Graphit & Kobalt“** (v2, gewählt am 2026-10-11 aus vier Moodboards; der erste Entwurf „Papier & Präzision“ wirkte zu steif): neutral-modern und weich, Ebenen durch Tonwerte statt Rahmen und Schatten, Pillen für Filter und Buttons, viel Luft.
- Ein Akzent (Kobalt), sparsam eingesetzt; Tokens als CSS-Variablen in eigenem CSS, **ohne Tailwind und ohne UI-Library**; Dark Mode gleichwertig.
- Eine Schriftfamilie (Schibsted Grotesk), Mono nur im Template-Editor.
- Details und Tokens: `prototypes/clickdummy-v2/DESIGN.md`.
- Desktop-first (Arbeitswerkzeug), Tablet nutzbar; Mobile nur Grundbedienbarkeit.

### 3.5 Erfolgskriterien

- Alle Screens aus 3.3 sind erreichbar und bedienbar.
- Ein kompletter Durchlauf funktioniert: Angebot anlegen → Positionsgruppen und Positionen anlegen → abschließen → angenommen → in Rechnung umwandeln → Prüfanzeige E-Rechnung grün machen → abschließen → stornieren.
- Eigenes Feld anlegen (z. B. „Projektname“ an Rechnungen), im Dokument befüllen, im Template einbauen → erscheint in der Live-Vorschau.
- Kleinunternehmer ein/aus ändert Steuerauswahl, Summen und Pflichthinweis sichtbar.
- Der Maintainer bewertet Look & Feel als „modern, nicht kindlich, nicht spießig“.

## 4. Nicht im Umfang

Backend/Persistenz auf Server, echte Authentifizierung und Rechte, echtes PDF-Rendering, echte ZUGFeRD-XML und Validierung, E-Mail-Versand, Zahlungsabgleich, Mahnwesen, Marketplace, Mehrmandantenfähigkeit, Mehrsprachigkeit der Oberfläche (UI deutsch), Fremdwährungen.
