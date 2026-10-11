# openbill Klickdummy

Durchklickbarer Prototyp zum Abstimmen von Funktionsumfang und Design. Kein Backend: alle Daten liegen im `localStorage` des Browsers.

```bash
pnpm install
pnpm dev        # http://localhost:5173, jede Eingabe beim Login funktioniert
pnpm test       # Tests der Fachlogik (Summen, Steuern, Dokumentkette)
pnpm typecheck
```

Aufbau:

- `src/domain/` – Fachlogik als reine Funktionen (Summen, Steuern, Nummernkreise, Status, Umwandeln, Prüfprofile, Liquid-Rendering, E-Rechnungs-XML)
- `src/store/` – Zustand-Stores mit Persistenz, `src/data/seed.ts` die fiktiven Demo-Daten
- `src/features/` – Seiten, `src/ui/` – eigenes Komponentenset (Tailwind, keine UI-Library)
- `src/templates/` – mitgelieferte Liquid-Templates „Klar“, „Kante“, „Leise“, je mit `header.liquid`, `template.liquid`, `footer.liquid`, `styles.css`
