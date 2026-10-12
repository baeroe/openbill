---
tags: [session, projekt]
datum: 2026-10-12
---
# 2026-10-12 – Ausprojektierung openbill (Phasen 1–11)

Vom Klickdummy zur releasefähigen App in elf Phasen, je Phase ein PR (#2–#12). Spec: `docs/superpowers/specs/2026-10-11-openbill-app-design.md`, Master-Plan und Phasenpläne: `docs/superpowers/plans/`. Diese Notiz hält fest, was in keinem Plan steht: welche Entscheidungen unterwegs fielen, warum, und woran wir hängen geblieben sind.

## Kontext
openbill soll wie prevju laufen: ein Image auf Docker Hub, `docker compose up -d`, Doku auf GitHub Pages, Agenten über REST und MCP, Template-Autoren mit einem lokalen Toolkit. Gebaut wurde von Agenten (Planung → Umsetzung → Review → Fix-Runden je Phase), der Nutzer gibt das Release v0.1.0 selbst frei.

## Was wurde gemacht
- **Phase 1 Fundament** (`33780ea`): Laravel 13 + Inertia/React/TS, Tailwind 4, Pest/Pint/Larastan, pnpm-Workspace, DDEV mit Gotenberg, i18n en/de, Login, Rollen, VitePress-Gerüst.
- **Phase 2 Domain** (`3d149d3`): Migrationen, Models mit ULID und Sperre, Domain-Services (Summen, Steuern, Nummern, Status, Felder, Prüfprofile), Actions, Demo-Seeder.
- **Phase 3 Rendering** (`cfcf18a`): ContextBuilder, Liquid-Sandbox, Templates Klar/Kante/Leise, Gotenberg, Archiv, ZUGFeRD/EN 16931.
- **Phase 4 REST-API** (`3811358`), **Phase 5 UI-Basis** (`0ae369a`), **Phase 6 Editor** (`c105ab9`), **Phase 7 Templates/Felder/Einstellungen** (`a457068`), **Phase 8 MCP** (`4d6e710`), **Phase 9 Toolkit** (`c926863`), **Phase 10 Docker & Release** (`99952ad`).
- **Phase 11 Feinschliff**: Logout/Sitzungsablauf, Datumsfilter, `app:prune-images`, Liquid-Ganzzahlen, Trimmen, `X-Forwarded-Prefix`, KoSIT-Validator im CI-Job `einvoice`, Dependabot, Doku-Theme, Landingpages, Screenshots, Pages-Workflow, README.

## Entscheidungen & Warum
- **Einheit der Ausführung ist eine Phase**, PR je Phase, Admin-Merge ohne menschliches Review: Nutzerwunsch (serielle Agenten, auto-mergen). Kostet: Fehler fallen erst auf Phasenebene auf – deshalb ein Review-Agent mit Fix-Runden je Phase.
- **Release nicht selbst taggen**: außenwirksam, der Nutzer gibt frei.
- **JS nur im DDEV-Container, ein Root-Lockfile** (Linux-Binaries in `node_modules`); Playwright als eigenes pnpm-Projekt `e2e/` auf dem Mac.
- **Unveränderlichkeit doppelt**: Eloquent-Hooks plus MariaDB-Trigger auf Dokumenten, Positionen, Gruppen, Snapshots, Dateien und ein Arch-Test gegen `DB::table` – GoBD; Mass-Updates umgingen sonst die Hooks. Seit Phase 11 wacht ein Arch-Test, dass `app/` die Trigger nie abschaltet.
- **Snapshot statt Live-Daten**: abgeschlossene Dokumente rendern aus eingefrorenen Stammdaten inkl. Felddefinitionen und Template; Teilstorno bleibt erlaubt (Teilgutschrift).
- **Keine Floats**: brick/math überall, einzige Ausnahme `CiiAmount` für horstoeko mit Rundreise-Prüfung. Liquid-Ganzzahlen rechnen seit Phase 11 über `BigInteger`.
- **XML-Einbettung über Gotenberg (Factur-X, PDF/A-3b)** statt horstoekos Merger: weniger Code, verlangt Gotenberg ≥ 8.34.
- **Templates in der Sandbox, zwei Schichten**: CSP im gerenderten HTML und gehärtetes Gotenberg (kein JavaScript, Deny-List) – das Review fand SSRF über Templates. Kostet: keine Web-Fonts/Bilder per URL, nur Assets/Data-URLs.
- **Filter-Policy statt Einzelfixes**: jeder registrierte Liquid-Filter ist eingestuft (größenbegrenzt überschrieben oder nur additiv), ein Test schlägt bei neuen Filtern fehl – Einzel-Fixes liefen zweimal hinterher.
- **EN-16931-Prüfung**: Pflichtfelder im Prüfprofil (Registernummer BT-30, USt-ID bei Reverse Charge/Drittland). Im CI-Job `einvoice` laufen das offizielle CEN-Schematron **und** der KoSIT-Validator; alle Beispiel-XMLs müssen im KoSIT-Szenario „EN16931 (CII)“ (Schema + EN-16931-Regeln, ohne die deutschen BR-DE-Regeln) als acceptable gelten. Versionen gepinnt und per SHA-256 geprüft. Warum beides: KoSIT ist der Prüfer, den Nutzer kennen – ein glaubwürdiger Nachweis. Der Plan ging zuerst davon aus, KoSIT prüfe nur XRechnung; die XRechnung-Konfiguration enthält aber ein reines EN-16931-Szenario. XRechnung mit Leitweg-ID bleibt außerhalb des Umfangs.
- **REST-API mit DTO-Ressourcen**, Processor reicht den rohen Body an genau eine Action, Fehler als Problem Details. `templates:render` darf alle Dokumente gerendert lesen (Spec 7, das Toolkit rendert echte Dokumente) – in Doku und Token-Dialog als lesender Zugriff markiert.
- **Entwurfs-Download-Links** tragen einen Hash über Dokument, Gruppen und Positionen statt `updated_at` (Autosave ändert mehrmals pro Sekunde, Positionen berühren `updated_at` nicht).
- **Der Server rechnet, der Browser formatiert**: Kennzahlen als Inertia-Props, Summen aus der Render-Antwort, Listen per SWR.
- **Barrierefreiheit vor Gestaltung**: `--muted` wurde abgedunkelt, obwohl DESIGN.md heller war.
- **Editor**: Zustand-Store mit reinen Ops, lokale IDs + `reconcileIds()`, höchstens eine Autosave-Instanz je Dokument (überlebt den Editor), last-write-wins, Löschen verzögert mit Undo statt Wiederherstellen.
- **Logout leert alle Caches** (auch `$inf$`-Seiten) – fremde Daten nach einem Login im selben Tab wären ein Datenschutzproblem. Seit Phase 11: 401 gilt als abgemeldet, 419 wird einmal mit frischem CSRF-Token wiederholt (die Sitzung kann noch gültig sein), Timeout 10 s, wartende Löschungen gehen vorher raus, ungespeicherte Eingaben überleben eine abgelaufene Sitzung in `sessionStorage` (nur für dieselbe Person).
- **Benutzer werden deaktiviert, nie gelöscht**: `created_by` abgeschlossener Dokumente darf sich nicht an den Triggern vorbei ändern.
- **Kundenart und Kategorie O**: Drittland + Dienstleistung + Unternehmen → nicht steuerbar (`O`), an Privatpersonen normaler Satz (§ 3a UStG).
- **MCP nur per Token**, eine Basisklasse übersetzt Fehler für das Modell, Ausgabe = REST-Formate, 25 Tools, eigener Limiter für Vorschau-PDFs (Agenten-Schleifen sollen Gotenberg nicht fürs Abschließen blockieren).
- **Toolkit vorgebaut**: der Nutzer installiert nur Vite; der Token bleibt im Node-Prozess; `OPENBILL_URL` kommt aus `APP_URL`, nie aus der Anfrage (Host-Header-Injection).
- **Docker**: serversideup v4.5.1 statt der frischen v5, alle Images per Digest, MariaDB ohne Binlog mit `log-bin-trust-function-creators`, internes Netz für DB und Gotenberg, Port nur auf `127.0.0.1`, `TRUSTED_PROXIES` konfigurierbar (nur IPs/CIDR), leere Passwörter in der Vorlage, Release-Notizen aus `upgrading.md` sind Pflicht. Dependabot ja, aber nicht für Docker-Images (Digests müssen an mehreren Stellen gleich bleiben).
- **Bilder aufräumen nur auf Befehl**: `app:prune-images` (mit `--dry-run`, Mindestalter 24 h) statt Zeitplan – Löschen ist Sache des Betreibers.
- **Doku auf GitHub Pages** unter `/openbill/`, bis es eine Domain gibt; `base` per Umgebungsvariable, Screenshots per Playwright aus den Demo-Daten (je Sprache ein Projekt, weil Datumsfelder der Browsersprache folgen).

## Stolpersteine
- Laravels `Request::capture()` dekodiert JSON schon beim Erzeugen – ein Body-Limit danach kommt zu spät. Lösung: eigenes `IncomingRequest`, Dekodieren erst nach `LimitApiBody`.
- `TrimStrings` sieht weder API-Platform-Bodies noch MCP-Argumente: Actions trimmen selbst.
- API Platform lässt `null` weg und macht `{}` zu `[]`; sein Metadaten-Cache ist unter Laravel 13 nicht deserialisierbar (`serializable_classes`) → eigener APCu-oder-Array-Store, Wahl zur Laufzeit.
- Throttle muss vor Auth laufen, sonst zählen 401-Anfragen nie.
- laravel/mcp fängt jede Exception selbst und blättert `tools/list` nach 15 Einträgen.
- keepsuit/liquid escapt nicht von selbst, `"0.00" != 0` ist wahr, leere Strings sind wahr.
- Chromium setzt Kopf-/Fußzeile in einen Flex-Container – ohne seitenbreite Hülle schrumpft der Inhalt.
- Inertia-v3-Layouts müssen Pfeilfunktionen sein; SWRs `mutate(filter)` überspringt `useSWRInfinite`; Radix-Menüs brauchen `modal={false}`.
- Playwright läuft in den Login-Throttle: einmal anmelden, Sitzung als `storageState` teilen. `browser.newContext()` im Test übernimmt die `storageState` des Projekts – für einen abgemeldeten Screenshot ausdrücklich leeren.
- Chromium formatiert `<input type="date">` nach der Browsersprache (`--lang`), nicht nach der Locale des Kontexts – unter macOS aber nur die Reihenfolge: die Platzhalterbuchstaben bleiben englisch (`dd.mm.yyyy` statt `TT.MM.JJJJ`), weil Chromium dort die Systemsprache nimmt. So akzeptiert.
- serversideups Entrypoint läuft in einer Subshell: `APP_KEY` erreicht PHP-FPM nur über den Config-Cache.
- Je nach Docker-Setup kommen Anfragen von außen mit der Gateway-IP `172.x.0.1` an, die in den privaten Netzen liegt – deshalb Bind auf `127.0.0.1` als Standard.
- Laravel vertraut `X-Forwarded-Prefix` standardmäßig; openbill läuft nur an der Wurzel und ignoriert ihn seit Phase 11.
- `pnpm pack` ist ein eingebauter Befehl (`pnpm run pack`), Node vertraut der mkcert-CA nicht (`--use-system-ca`), DDEV/Mutagen zeigt Container-Dateien mit Verzögerung.
- Externe Schematron-/Saxon-Downloads lieferten einmal 404 → im CI gecacht, Skript prüft SHA-256.
- Closures für `Concurrency::run()` müssen `static` sein und aus einer autoloadbaren Klasse kommen.
- Browser schicken kein `blur`, wenn das fokussierte Element entfernt wird: Toasts blieben nach einem Tastatur-Undo pausiert.
- `vitepress-plugin-llms` hängt die `base` selbst an `domain`: dort nur den Ursprung angeben.

## Offen
- Release v0.1.0 (Tag `v0.1.0`) nach Freigabe durch den Nutzer; danach synchronisiert `dockerhub.yml` die Docker-Hub-Beschreibung.
- Eigene Doku-Domain (dann `DOCS_BASE` weg, `DOCS_URL` und `CNAME`).
- Nicht im Umfang (Spec 13): OAuth für Connectors, XRechnung mit Leitweg-ID, E-Mail-Versand, Zahlungsabgleich, Mahnwesen, Mehrmandanten, Fremdwährungen.
