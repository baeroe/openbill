# Design-Richtung

**Produkt**: openbill, ein selbst gehostetes Programm für Angebote und Rechnungen mit eigenen Feldern und eigenen PDF-Templates. Erst für einen Freelancer, dann Open Source. Die Konkurrenz sind sevDesk, lexoffice und Invoice Ninja, die alle nach Buchhaltungssoftware aussehen.
**Modus**: Product (Arbeitswerkzeug, Desktop zuerst, Tablet nutzbar, Mobile nur Grundbedienung)
**Richtung**: Graphit & Kobalt. Neutral-modern und weich, aber nicht verspielt. Getönte Flächen statt Rahmen und Schatten, Pillen für Filter und Buttons, viel Luft. Gewählt aus vier Moodboards (2026-10-11), weil der alte Entwurf zu steif war.
**Referenz**: Moodboard https://claude.ai/artifact/JJ2wmpd9kTxrq9UJAMhaTU

## Tokens

Die Quelle ist `src/styles/tokens.css`. Kurzfassung:

```css
:root {
  --bg: #F4F4F2;          /* Kreide: App-Hintergrund */
  --surface: #FFFFFF;     /* Karten, Panels */
  --surface-2: #ECECE9;   /* Eingabefelder, Pillen, Hover */
  --surface-3: #E3E3DF;   /* Pressed, Trenner auf surface-2 */
  --ink: #23252B;         /* Graphit: Text */
  --muted: #73767E;       /* Stein: Nebentext */
  --faint: #A2A4AA;       /* Platzhalter, deaktiviert */
  --accent: #2F55D4;      /* Kobalt: Aktion, Auswahl, Fokus */
  --accent-ink: #FFFFFF;
  --accent-soft: #E3E9FB;

  --font: "Schibsted Grotesk Variable", ui-sans-serif, system-ui, sans-serif;
  --font-code: ui-monospace, "SF Mono", Menlo, monospace;  /* nur im Template-Editor */

  --r-sm: 8px; --r-md: 12px; --r-lg: 18px; --r-xl: 24px; --r-pill: 999px;
  --dur: 180ms; --ease: cubic-bezier(0.2, 0, 0, 1);
}
```

Dark Mode belegt dieselben Namen neu (`[data-theme="dark"]` bzw. `prefers-color-scheme`).

## Typo-Regeln

Eine Familie: Schibsted Grotesk (variabel). Überschriften 650–700 mit −0,03em Laufweite, Text 400, Labels 500.
Skala: 12 / 13 / 14 (Basis) / 16 / 20 / 26 / 34 px. Zahlen mit `proportional-nums lining-nums` und rechtsbündig. Die Tabellenziffern von Schibsted Grotesk sehen aus wie Schreibmaschinenschrift (Eins mit Fuß) und sind deshalb tabu.
Kein Versal-Label, keine Mono-Schrift für Daten. Die Mono-Schrift gibt es nur im Code-Editor, weil Templates Code sind.
Zeilenlänge für Fließtext max. 68ch.

## Form

- **Keine Rahmen und keine Schatten für Gliederung.** Ebenen entstehen durch Tonwerte: `bg` → `surface` → `surface-2`.
- Ausnahme: Dialoge, Popover und Toasts schweben und bekommen einen weichen Schatten (`--shadow-float`).
- Radius-System: Eingabefelder und kleine Elemente 12, Karten 18, Dialoge 24, Buttons, Filter und Badges als Pille.
- Auswahl und aktive Navigation: Fläche `accent-soft`, Text `accent`.
- Fokus: 2px Kobalt-Ring mit 2px Abstand, immer sichtbar bei Tastaturbedienung.
- Das Dokument in der Vorschau bleibt weißes Papier mit eigenem Schatten, weil es das gedruckte PDF zeigt.

## Motion

180 ms ease-out. Animiert werden nur Reaktionen auf Aktionen: Dialog und Seitenpanel kommen herein, Toasts erscheinen, Gruppen klappen auf und zu. Inhalte blenden beim Laden sanft ein (Opazität, 4px). Keine Dauer-Animation. `prefers-reduced-motion` schaltet alles bis auf Opazität ab.

## No-Gos

- Tailwind, shadcn oder eine andere UI-Library: alles ist eigenes CSS (`src/styles/`).
- Rahmenlinien um jede Karte, gestapelte graue Schatten.
- Versal-Labels mit Laufweite über Überschriften, Pfeile `→` an Buttons, Emoji als Icons.
- Lila-blaue Verläufe. Kobalt ist der einzige Akzent, Semantikfarben (ok/warn/bad) sind kein zweiter Akzent.

## Entscheidungen

- 2026-10-11: Positionsgruppen statt Projektphasen, Kategorien und Katalog. Grund: drei Gruppierungsmechanismen haben verwirrt, und eine Phase hängt am Projekt statt an einer Leistung.
- 2026-10-11: Alle eigenen Felder an einem Ort (Einstellungen → Eigene Felder) für die Ebenen Organisation, Kunde, Ansprechpartner, Dokument und Position. Dokument- und Positionsfelder werden einmal definiert und per Häkchen den Dokumenttypen zugeordnet. Grund: Vorher waren Dokumentfelder in den Dokumenttyp-Einstellungen versteckt, der Rest lag unter „Eigene Felder“.
- 2026-10-11: Ohne Katalog schlägt die Positionszeile per Autocomplete Positionen aus früheren Dokumenten vor.
- 2026-10-11: Proportionalziffern statt `tabular-nums`. Grund: Die Tabellenziffern von Schibsted Grotesk sehen aus wie Schreibmaschinenschrift.
