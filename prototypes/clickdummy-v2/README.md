# openbill Klickdummy v2

Zweiter Entwurf des Klickdummys mit neuer Gestaltung (Graphit & Kobalt, eigenes CSS ohne Tailwind) und überarbeitetem Konzept:

- **Positionsgruppen** im Dokument statt Projektphasen, Kategorien und Katalog. Die Positionszeile schlägt Positionen aus früheren Dokumenten vor.
- **Alle eigenen Felder an einem Ort** (Eigene Felder): Organisation, Kunde, Ansprechpartner, Dokument und Position. Dokument- und Positionsfelder werden einmal angelegt und per Häkchen den Dokumenttypen zugeordnet.

```bash
pnpm install
pnpm dev        # http://localhost:5173, jede Eingabe beim Login funktioniert
pnpm test       # Fachlogik (Summen, Steuern, Gruppen, Felder, Umwandeln, Prüfprofile, Liquid)
pnpm typecheck
```

Gestaltung und Entscheidungen: [`DESIGN.md`](DESIGN.md)

## Aufbau

- `src/domain/` – Fachlogik als reine Funktionen
- `src/api/` – Fake-API: `seed.ts` (fiktive Demo-Daten), `db.ts` (Speicher im `localStorage`, Latenz, Fehlerfall), je Ressource ein Modul. **Hier wird später die echte API eingehängt:** nur die Funktionsrümpfe gegen `fetch` tauschen, alles darüber bleibt.
- `src/hooks/` – TanStack-Query-Hooks mit zentralen Query-Keys
- `src/store/` – Zustand für Client-State (Theme, Anmeldung, Toasts)
- `src/components/ui/` – eigenes Komponentenset, `src/styles/` – Tokens und CSS
- `src/routes/` – eine Datei pro Screen
- `src/templates/` – mitgelieferte Liquid-Templates „Klar“, „Kante“, „Leise“

Fehlerfall testen: `localStorage.setItem("api:fail", "1")` in der Konsole, zum Beenden `localStorage.removeItem("api:fail")`.
