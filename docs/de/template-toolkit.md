# Template-Toolkit

Mit dem Template-Toolkit schreibst du ein Template in deinem eigenen Editor mit Live-Vorschau: `template.liquid` ändern, speichern, und einen Moment später zeigt die Vorschau im Browser das Ergebnis – gerendert von deiner openbill-Instanz, mit echten Dokumenten oder Beispieldaten, in Seiten aufgeteilt wie das PDF. Wenn du fertig bist, schreibt `pnpm push` die Dateien zurück nach openbill.

## Voraussetzungen

- Node.js 24 oder neuer und pnpm (`corepack enable` richtet pnpm ein).
- Eine openbill-Instanz, die dein Rechner erreicht. Das Toolkit rendert auf der Instanz; ohne sie gibt es keine Vorschau.
- `APP_URL` der Instanz muss die https-Adresse sein, unter der du openbill erreichst: Der Download schreibt sie in `.env.local`, nie die Adresse der Anfrage. Das Toolkit lehnt unverschlüsseltes `http://` ab, außer für `localhost`, `127.0.0.1` und `::1`, damit der Token nie im Klartext unterwegs ist.
- Ein importiertes oder dupliziertes Template. Die mitgelieferten Templates (Klar, Kante, Leise) sind schreibgeschützt: erst öffnen und **Duplizieren, um es anzupassen** wählen.

## Herunterladen

Öffne das Template im Editor und wähle **Toolkit → Toolkit herunterladen**. Ungespeicherte Änderungen werden vorher gespeichert (**Speichern und herunterladen**). Das ZIP enthält einen Ordner `openbill-<template>`:

| Pfad | Inhalt |
|---|---|
| `template/` | das Template als Paketdateien: `manifest.json`, `template.liquid`, `header.liquid`, `footer.liquid`, `styles.css`, `assets/…` |
| `.env.local` | `OPENBILL_URL` (die `APP_URL` der Instanz), `OPENBILL_TOKEN`, `OPENBILL_TEMPLATE_ID` |
| `.gitignore` | hält `.env.local`, `node_modules/` und gepackte ZIPs aus Git heraus |
| `package.json`, `pnpm-workspace.yaml`, `vite.config.js`, `index.html`, `assets/`, `tooling/` | das Toolkit selbst, vorgebaut; es installiert nur Vite |
| `README.md` | die Kurzfassung dieser Seite (Englisch) |

### Der Token

Jeder Download legt einen neuen Token für dich an, Name *Toolkit: &lt;Template&gt; (&lt;Datum&gt;)*, mit den Fähigkeiten `templates:render` und `templates:write`, gebunden an dieses Template. Er kann

- jedes Dokument der Instanz in der Vorschau rendern – **das ist lesender Zugriff auf alle Dokumente** (Kunden, Adressen, Positionen, Beträge), genau wie `templates:render` in der [REST-API](/de/api);
- dieses eine Template lesen und schreiben (`GET /api/templates/{id}`, `GET /api/templates/{id}/package`, `PUT /api/templates/{id}/files`). Mit `template_id` nimmt `POST /api/render` nur dieses Template an (ein anderes → 403).

Er kann keine Dokumente, Kunden oder Einstellungen ändern, andere Templates weder lesen noch ändern, dieses Template weder löschen noch duplizieren, keine Tokens anlegen und kein MCP nutzen. Gib `.env.local` nicht weiter. Der Token steht unter **Einstellungen → API & MCP** als *Toolkit · &lt;Template&gt;*; **Widerrufen** beendet ihn sofort. Wird das Template gelöscht, verschwinden seine Toolkit-Tokens mit. Ältere Downloads funktionieren weiter, bis du ihre Tokens widerrufst.

## Starten

```bash
unzip openbill-toolkit-<template>.zip
cd openbill-<template>
pnpm install
pnpm dev
```

Öffne `http://localhost:5180` (anderer Port: `pnpm dev --port 5181`).

## Die Vorschau-Seite

Die Seite des Toolkits ist englisch beschriftet.

- **Data** wechselt zwischen den Beispielszenarien (kurze und lange Rechnung, Kleinunternehmer, Reverse Charge, Angebot mit optionalen Positionen; **Language** Englisch oder Deutsch) und deinen letzten Dokumenten, auch Entwürfen. Sie startet mit dem neuesten Dokument, wie der Template-Editor.
- **Areas** zeigt Kopfzeile, Inhalt und Fußzeile als Bereiche; rechts steht die Seitenzahl.
- **Fields** listet Kern- und eigene Felder jeder Ebene; ein Klick kopiert den Liquid-Ausdruck mit passendem Filter. Felder, die `manifest.json` unter `expectedFields` nennt, die openbill aber nicht kennt, sind als *missing* markiert: Sie bleiben leer, bis du sie unter [Eigene Felder](/de/custom-fields) anlegst.
- Fehler erscheinen in einem Kasten unten rechts: Liquid-Fehler mit Datei, Zeile und den Zeilen drumherum (`template.liquid:12`), ein kaputtes `manifest.json` mit Zeile und Verbindungsprobleme. Die Vorschau darunter zeigt den letzten funktionierenden Stand.

Jedes Speichern in `template/` rendert nach einer kurzen Pause neu. Die Seite lädt nicht neu und behält ihre Scroll-Position. Mehrere Speichervorgänge hintereinander ergeben ein Rendern; eine ältere Antwort ersetzt nie eine neuere.

**Assets:** Die Vorschau nutzt die in openbill gespeicherten Assets (`POST /api/render` nimmt keine Dateien). Neue oder geänderte Dateien in `template/assets/` erscheinen nach `pnpm push`; die Seite weist darauf hin, sobald du sie änderst.

::: v-pre
Beispiel: Ein Klick auf *document → number* kopiert `{{ document.number }}`, auf *position → unit_price* `{{ p.unit_price | money }}` (Positionen liest man in `{% for p in … %}`). Die [Liquid-Referenz](/de/templates#liquid-referenz) erklärt Kontext und Filter.
:::

## Befehle

| Befehl | Was er tut |
|---|---|
| `pnpm dev` | Vorschau unter `http://localhost:5180` |
| `pnpm push` | schreibt alle Dateien aus `template/` nach openbill (`PUT /api/templates/{id}/files`): die vier Teile, `manifest.json` und die vollständige Asset-Liste (lokal fehlende Dateien werden in openbill entfernt). Vorher geprüft, bevor etwas gesendet wird: nur Paketdateien, Teile bis 200 KB je Datei, Assets png, jpg, jpeg, gif, webp, svg, woff, woff2, ttf, otf bis 2 MB je Datei, 20 MB insgesamt, höchstens 100 Dateien, keine symbolischen Links, gültiges `manifest.json`. |
| `pnpm pull` | holt das gespeicherte Template nach `template/` und das Feldschema nach `schema.json`. Weichen lokale Dateien ab, bricht es ab und listet sie; `pnpm pull --force` überschreibt sie und entfernt lokale Paketdateien, die openbill nicht hat. |
| `pnpm run pack` | packt `template/` als Template-Paket (`<name>-<version>.zip`, oder `--out datei.zip`) für **Templates → ZIP importieren**, z. B. auf einer anderen Instanz. Gleiche Prüfungen wie `push`, und das ZIP darf wie beim Import höchstens 10 MB groß sein. |

Nutze `pnpm run pack`: `pnpm pack` ohne `run` ist ein eigener Befehl von pnpm (er baut npm-Tarballs) und schlägt im Toolkit-Ordner fehl.

## Lokale Instanz mit eigenem Zertifikat

Node vertraut den Zertifikaten einer lokalen Entwicklungs-CA (DDEV, mkcert) standardmäßig nicht; das Toolkit meldet dann *Node does not trust the certificate*. Starte es mit dem Zertifikatsspeicher des Systems:

```bash
NODE_OPTIONS=--use-system-ca pnpm dev
NODE_OPTIONS=--use-system-ca pnpm push
```

## Fehlersuche

| Meldung | Was zu tun ist |
|---|---|
| Cannot reach … | openbill starten oder `OPENBILL_URL` in `.env.local` korrigieren. |
| openbill refused the token (401) | Der Token wurde widerrufen. Toolkit neu herunterladen oder einen neuen Token in `.env.local` eintragen. |
| The token may not do this (403) | `OPENBILL_TEMPLATE_ID` zeigt auf ein anderes Template als der Token. |
| Built-in templates are read-only | Template duplizieren und das Toolkit der Kopie herunterladen. |
| Missing OPENBILL_URL … | `.env.local` fehlt oder ist unvollständig. |
| OPENBILL_URL must use https:// | `APP_URL` der Instanz ist eine unverschlüsselte `http://`-Adresse. Der Betreiber stellt `APP_URL` auf die https-Adresse um, danach das Toolkit neu herunterladen. |
| Nothing was pushed: fix template/ first | Die Liste darunter nennt jede Datei, die der Import ablehnen würde. |
| Das Template-Toolkit fehlt in dieser Installation (beim Download) | Der Betreiber hat das Kit nicht gebaut (`pnpm build`); das Docker-Image enthält es. |

## Sicherheit

- Der Token bleibt im Dev-Server (Node). Die Vorschau-Seite bekommt ihn nie, und Vite liefert `.env.local` nie aus.
- Der Dev-Server beantwortet seine Vorschau-Endpunkte nur für `localhost` (auch gegen DNS-Rebinding aus einer Webseite) und nimmt Änderungen nur als JSON an.
- Gerendert wird weiter auf dem Server, mit derselben Sandbox wie überall in openbill: keine Skripte, keine externen Ressourcen.
