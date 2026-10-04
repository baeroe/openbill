# openbill Klickdummy Implementation Plan (schlank)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Durchklickbarer Prototyp von openbill mit allen Funktionen aus der Spec, um Idee und Umfang zu finalisieren.

**Architecture:** Reine Client-App. Fachlogik als kleine TS-Module in `src/domain/` (echt rechnend), Zustand-Stores in `src/store/` (persistiert in `localStorage`), UI in `src/features/` + eigenes Komponentenset in `src/ui/`.

**Tech Stack:** Vite, React 19, TypeScript, React Router, Tailwind CSS v4, Zustand (`persist`), liquidjs, CodeMirror 6, @dnd-kit, lucide-react, Fontsource, Vitest (nur Domain).

**Spec:** `docs/superpowers/specs/2026-10-04-openbill-clickdummy-design.md`

## Global Constraints

- Alles unter `clickdummy/`; nur **pnpm**; Node 24.
- **Keine UI-Library**; Styling nur **Tailwind v4** mit Tokens via `@theme`; Light + Dark.
- State nur über **Zustand**.
- UI Deutsch, Code Englisch. Demo-Daten nur fiktiv.
- Fonts self-hosted (Fontsource).
- Kein Backend, kein echtes PDF, keine echte XML, kein echter Login.
- Templates: Liquid; Kontext `org`, `customer`, `contact`, `document`, `positions`, `groups` in `snake_case`, eigene Felder direkt am jeweiligen Objekt.
- UI-Tasks laden vorher `frontend-design:frontend-design`; Richtung „Papier & Präzision“.

## Review Focus

1. Kaputte Liquid-Syntax → Fehlermeldung in der Vorschau, kein Absturz.
2. Gelöschter Steuersatz/Einheit in Positionen → Summen rechnen weiter, Prüfanzeige meldet es.
3. Feldschlüssel-Kollision (Duplikat, Kernfeld, Umlaute) → abgelehnt bzw. sauberer Slug.
4. Abgeschlossene Dokumente → nicht editierbar; Storno nur einmal.
5. Kaputter `localStorage` → Rückfall auf Demo-Daten (Store-Version + `migrate`).

---

### Task 1: Grundgerüst

- [ ] `pnpm create vite clickdummy --template react-ts`, `.node-version` = 24, Abhängigkeiten installieren
- [ ] Tailwind v4 via `@tailwindcss/vite`, Alias `@/` → `src/`, Vitest (node)
- [ ] `.gitignore` im Root, Build grün → Commit

### Task 2: Fachlogik + Demo-Daten + Stores

- [ ] `domain/types.ts` — Typen für Organisation, Kunde, Ansprechpartner, Katalog, Position (item/heading/text/optional), Dokument, Dokumenttyp-Config (Profil, Nummernkreis, Felder), Steuersatz (mit EN-16931-Kategorie), Einheit (UN/ECE-Code), Kategorie, Textbaustein, Template (Manifest)
- [ ] `domain/totals.ts` — `effectiveTax` (§ 19 → E, Reverse Charge → AE, Drittland → G, sonst Satz; unbekannt → null), `calcTotals` (Zeilen, Gruppen, Steueraufschlüsselung pro Satz, optionale Summe, gesetzliche Hinweise) **+ Tests**
- [ ] `domain/numbering.ts` (`{YYYY}{YY}{MM}{0000}`, jährlicher Reset), `lifecycle.ts` (Übergänge, `isLocked`, `isOverdue`, Labels), `fields.ts` (`slugifyKey`, `validateFieldDef`, reservierte Keys), `convert.ts` (Kette, Felder per Key, optionale raus, Storno negiert, Leistungsdatum-Default), `compliance.ts` (Basis + EN 16931), `templateContext.ts`, `liquid.ts` (Filter `money`, `date`, `number`, `nl2br`; Fehler → Fehlerseite)
- [ ] Standard-Template „Klar“
- [ ] `data/seed.ts` (Studio Nordlicht, 3 Kunden, Katalog, 4 Dokumente), Stores: settings, customers, catalog, documents (Sperre für abgeschlossene Dokumente), templates, session; `resetDemo()`
- [ ] Tests + Typecheck grün → Commit

### Task 3: Designsystem, Shell, Login

- [ ] Tokens, UI-Primitives (Button, Input, Select, Textarea, Checkbox, Badge, StatusBadge, Card, Dialog, Tabs, PageHeader, EmptyState, Toast)
- [ ] AppShell mit Sidebar, Theme-Umschalter, „Demo-Daten zurücksetzen“; Routen aller Seiten
- [ ] Eigenständiger Login-Screen → Commit

### Task 4: Übersicht, Dokumentliste, Editor

- [ ] Übersicht mit Kennzahlen + zuletzt bearbeitet; Liste mit Typ-Tabs, Filter, Suche; „Neues Dokument“-Dialog
- [ ] Editor: Kopf- und eigene Felder, Positionstabelle (Arten, Drag & Drop, Katalog-Autocomplete, eigene Positionsfelder), Kopf-/Fußtext mit Bausteinen, Summen, Prüfanzeige mit Sprung zum Feld, Live-Vorschau (iframe, A4), E-Rechnung-Tab (XML-Beispiel), Aktionen (Abschließen, Status, Umwandeln, Stornieren, Duplizieren, Löschen), Dokumentkette → Commit

### Task 5: Kunden, Katalog, Templates

- [ ] Kundenliste + Detail (Steuerbehandlung, eigene Felder, Ansprechpartner, Dokumente)
- [ ] Katalog nach Kategorien mit Dialog
- [ ] Template-Galerie (Miniaturen, Duplizieren, Import simuliert), Editor (CodeMirror, Feldreferenz, Manifest, Live-Vorschau); Templates „Kante“ und „Leise“ → Commit

### Task 6: Einstellungen + Abschluss

- [ ] Organisation (Logo, Besteuerungsart, eigene Felder), Dokumenttypen (Profil, Nummernkreis mit Vorschau, Standard-Template/-Texte, Feld-Builder Dokument + Position), Eigene Felder (Kunde, Ansprechpartner, Katalog), Steuern, Einheiten, Kategorien, Textbausteine, Benutzer
- [ ] Durchklicken des Erfolgsszenarios aus Spec 3.5 + Screenshots Light/Dark, Fixes
- [ ] README (EN) + LICENSE (MIT) → Commit
