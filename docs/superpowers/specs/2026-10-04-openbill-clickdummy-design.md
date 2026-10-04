# openbill — Fachkonzept & Klickdummy (Design-Spec)

Stand: 2026-10-04 · Status: Entwurf zur Abstimmung

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
- Beim Umwandeln werden Kernfelder, Kunde, Ansprechpartner, Positionen und Texte übernommen; **eigene Felder werden per gleichem Feldschlüssel** übernommen, nicht passende verworfen (Hinweis im UI).
- Jedes Dokument zeigt seine Kette („aus Angebot AN-2026-014“, „storniert durch ST-2026-002“).

### 2.3 Datenebenen: fester Kern + eigene Felder

Einheitliches Prinzip auf allen Ebenen: ein **fester Kern** (nicht löschbar, für Berechnungen und E-Rechnung nötig) plus **eigene Felder**, die der Nutzer definiert.

| Ebene | Kern | Liquid-Zugriff |
|---|---|---|
| Organisation | Name, Adresse, Logo, USt-ID, Steuernummer, Bankverbindung (IBAN/BIC/Bank), E-Mail, Telefon, Website, Besteuerungsart | `org.*` |
| Kunde | Name, Adresse, E-Mail, USt-ID, Steuerbehandlung, Kundennummer | `customer.*` |
| Ansprechpartner (n pro Kunde, einer Standard) | Anrede, Vorname, Nachname, Position, E-Mail, Telefon | `contact.*` |
| Dokument (pro Typ) | Nummer, Datum, Kunde, Ansprechpartner (optional), Kopftext, Fußtext, Template; typspezifisch z. B. Gültig bis (AN), Fälligkeit/Zahlungsziel (RE) | `document.*` |
| Position (pro Typ) | Art, Titel, Beschreibung, Menge, Einheit, Einzelpreis, Steuersatz, Kategorie | `p.*` in `positions` |
| Katalogeintrag | Bezeichnung, Beschreibung, Kategorie, Einheit, Preis, Steuersatz | — (wird in Positionen kopiert) |

**Feldtypen für eigene Felder:** Text, Mehrzeiliger Text, Zahl, Betrag, Datum, Auswahl (Optionen), Ja/Nein, Bild.
**Felddefinition:** Label, Schlüssel (`snake_case`, eindeutig pro Ebene, unveränderlich nach Anlage), Typ, Pflicht ja/nein, Standardwert, Hilfetext.

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

### 2.6 Katalog, Einheiten, Positionsarten

- **Einheiten** (Einstellungen): Name, Kürzel, Nachkommastellen, UN/ECE-Rec-20-Code. Vorbelegt: Stunde `HUR`, Tag `DAY`, Stück `H87`, Pauschal `LS`, Kilometer `KMT`, Monat `MON`.
- **Kategorien:** frei anlegbar (z. B. Beratung, Implementierung, Hosting).
- **Katalog:** Einträge mit Kern + eigenen Feldern. **Einfügen kopiert** die Werte in die Position (keine Verknüpfung); eigene Felder werden per Schlüssel übernommen. Einfügen per Autocomplete direkt in der Positionszeile.
- **Positionsarten:** Leistung, Überschrift/Gruppe (gruppiert Folgepositionen, Zwischensumme im Template verfügbar), Textzeile (ohne Betrag), Optionale Position (nur Angebot, zählt nicht zur Summe).

### 2.7 Texte

- **Textbausteine:** Bibliothek wiederverwendbarer Texte (Einleitung, Schlusstext, Zahlungsbedingungen, Hinweis). Dürfen Liquid-Platzhalter enthalten.
- Jedes Dokument hat **Kopftext** und **Fußtext**; frei schreibbar oder aus Bausteinen einfügbar. Pro Dokumenttyp ist ein Standard-Baustein für beide hinterlegbar.

### 2.8 Nummernkreise

Pro Dokumenttyp ein Muster, z. B. `RE-{YYYY}-{0000}`; Platzhalter `{YYYY}`, `{YY}`, `{MM}`, `{0000}` (fortlaufend, Stellenzahl = Anzahl Nullen). Zurücksetzen jährlich optional. Nächste Nummer sichtbar.

### 2.9 Templates

- **Sprache:** HTML + CSS mit **Liquid** (sandboxed by design, identisch im Browser via `liquidjs` und auf dem Server via `keepsuit/liquid`). Gotenberg rendert das finale PDF.
- **Kontext:** `org`, `customer`, `contact`, `document`, `positions`, `groups`, `document.tax_breakdown`, `document.legal_notes`. Filter u. a. `money`, `date`, `number`, `nl2br`.
- **Template-Paket** (portabel, Marketplace-tauglich): ZIP mit
  - `manifest.json` — Name, Version, Autor, Lizenz, Beschreibung, unterstützte Dokumenttypen, erwartete eigene Felder (Schlüssel, Typ, Fallback), Papierformat/Ränder
  - `template.liquid`, `styles.css`, optional `assets/` (Fonts, Grafiken)
- Beim Zuweisen eines Templates zu einem Dokumenttyp zeigt das UI, welche erwarteten Felder fehlen (Hinweis, kein Blocker — Templates müssen mit leeren Werten umgehen).
- Mitgeliefert: 2–3 Standard-Templates unterschiedlicher Anmutung.

## 3. Klickdummy

### 3.1 Zweck & Abgrenzung

Ein durchklickbarer Prototyp, der alle oben genannten Funktionen sichtbar und bedienbar macht, um das Konzept zu prüfen. **Kein** Backend, **kein** echtes PDF, **keine** echte XML-Validierung, **keine** Authentifizierung.

### 3.2 Technik

- `clickdummy/` im Repo-Root (Phase 2 bekommt später eigene Ordner).
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
4. **Dokument-Editor** — Kernfelder + eigene Felder, Kunde/Ansprechpartner, Positionstabelle (Positionsarten, Katalog-Autocomplete, Drag & Drop-Sortierung), Kopf-/Fußtext mit Baustein-Einfügen, Summen inkl. Steueraufschlüsselung, Prüfanzeige des Profils, **Live-Vorschau (A4) daneben**, Aktionen: Abschließen, Status setzen, Umwandeln, Stornieren, „PDF herunterladen“ (Dummy), E-Rechnung-Tab mit XML-Vorschau (Mock), Dokumentkette.
5. **Kunden** — Liste, Detail mit Kern + eigenen Feldern, Steuerbehandlung, Ansprechpartnern, zugehörigen Dokumenten.
6. **Katalog** — Einträge nach Kategorie, Anlegen/Bearbeiten.
7. **Templates** — Galerie mit Vorschaubildern, Import eines ZIP (simuliert), Editor: CodeMirror links, Live-Vorschau rechts mit Beispieldokument, Seitenleiste mit verfügbaren Feldern (klickbar zum Einfügen), Manifest-Bearbeitung.
8. **Einstellungen**
   - Organisation (Kern + eigene Felder, Logo-Upload, Besteuerungsart)
   - Dokumenttypen (je Typ: Feld-Builder für Dokument- und Positionsfelder, Profil, Nummernkreis, Standard-Template, Standard-Texte, Zahlungsziel)
   - Eigene Felder für Kunde, Ansprechpartner, Katalog (gleicher Feld-Builder)
   - Steuersätze, Einheiten, Kategorien, Textbausteine
   - Benutzer (Liste, Einladen — Dummy)

### 3.4 Gestaltung

Umsetzung mit dem Frontend-Design-Skill. Leitlinie: **modern, ruhig, eigenständig — nicht verspielt, nicht bieder.**

- Richtung „Papier & Präzision“: Das Produkt dreht sich um Dokumente, die Oberfläche greift das auf (helle, leicht warme Flächen, Dokumente als „Blätter“, klare Typografie), kombiniert mit präzisen, technischen Details (tabellarische Zahlen, Mono-Akzente für Nummern und Feldschlüssel).
- Eine markante Akzentfarbe, sparsam eingesetzt; konsequente Tokens (Tailwind `@theme`); Dark Mode gleichwertig.
- Eigenständige, nicht generische Schriftwahl (Display + Text + Mono).
- Desktop-first (Arbeitswerkzeug), Tablet nutzbar; Mobile nur Grundbedienbarkeit.

### 3.5 Erfolgskriterien

- Alle Screens aus 3.3 sind erreichbar und bedienbar.
- Ein kompletter Durchlauf funktioniert: Angebot anlegen → Katalogpositionen einfügen → abschließen → angenommen → in Rechnung umwandeln → Prüfanzeige E-Rechnung grün machen → abschließen → stornieren.
- Eigenes Feld anlegen (z. B. „Projektname“ an Rechnungen), im Dokument befüllen, im Template einbauen → erscheint in der Live-Vorschau.
- Kleinunternehmer ein/aus ändert Steuerauswahl, Summen und Pflichthinweis sichtbar.
- Der Maintainer bewertet Look & Feel als „modern, nicht kindlich, nicht spießig“.

## 4. Nicht im Umfang

Backend/Persistenz auf Server, echte Authentifizierung und Rechte, echtes PDF-Rendering, echte ZUGFeRD-XML und Validierung, E-Mail-Versand, Zahlungsabgleich, Mahnwesen, Marketplace, Mehrmandantenfähigkeit, Mehrsprachigkeit der Oberfläche (UI deutsch), Fremdwährungen.
