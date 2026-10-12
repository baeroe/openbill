---
layout: home
markdownStyles: false

landing:
  # all copy of the landing page lives here (and in docs/en/index.md); docs/.vitepress/theme/landing/ lays it out
  hero:
    title: Angebote und Rechnungen, wie du sie brauchst.
    tagline: Open Source und selbst gehostet. Eigene Felder auf jeder Ebene, Positionen in Gruppen, PDF-Templates in Liquid und E-Rechnungen nach EN 16931 – im Browser, über eine REST-API und für KI-Agenten über MCP.
    primary: { text: Loslegen, link: /de/setup }
    secondary: { text: GitHub, link: https://github.com/baeroe/openbill }
    replay: Noch einmal abspielen
  invoice:
    locale: de-DE
    label: Eine Rechnung von Studio Nordlicht an die Hafenkontor Lindqvist GmbH über 9.650,90 Euro, abgeschlossen als RE-2026-0042 und archiviert als PDF/A-3 mit factur-x.xml
    sender: Studio Nordlicht
    senderLine: Studio Nordlicht, Speicherstraße 12, 20457 Hamburg
    recipient: [Hafenkontor Lindqvist GmbH, Frau Mira Albers, Am Sandtorkai 4, 20457 Hamburg]
    title: Rechnung
    subject: Relaunch Online-Shop
    draft: Entwurf
    number: RE-2026-0042
    date: 12.10.2026
    groups:
      - title: Konzept & UX
        items:
          - { name: Discovery-Workshop, quantity: '1', unit: Psch., price: '890.00' }
          - { name: Wireframes & Klickpfade, quantity: '3', unit: Tage, price: '760.00' }
      - title: Umsetzung
        items:
          - { name: Frontend-Entwicklung, quantity: '52', unit: Std., price: '95.00' }
    subtotal: Summe
    net: Netto
    vat: USt. 19 %
    vatRate: 19
    total: Gesamt
    stamp: Abgeschlossen
    badges: [PDF/A-3, factur-x.xml]
  story:
    title: Vom Entwurf zur E-Rechnung
    intro: Ein Dokument, vier Stationen. Alles, was du hier siehst, ist die App selbst, mit Demodaten.
    steps:
      - title: Entwurf schreiben
        text: Kunden wählen, Positionen in Gruppen ordnen, eigene Felder ausfüllen. Die Vorschau rendert beim Tippen das echte PDF, und jede Änderung speichert sich von selbst.
        image: /screenshots/de/editor.png
        alt: Der Dokument-Editor mit einem Rechnungsentwurf und der Live-Vorschau
        more: { text: Dokumente und Editor, link: /de/documents }
      - title: Template gestalten
        text: Templates sind HTML, CSS und Liquid und werden auf dem Server zu PDF. Bearbeite sie im Browser oder lade das Toolkit herunter und arbeite in deinem eigenen Editor weiter.
        image: /screenshots/de/template-editor.png
        alt: Der Template-Editor mit dem Liquid-Quelltext und einer Vorschau der Seite
        more: { text: Templates, link: /de/templates }
      - title: Fehlendes ergänzen
        text: Vor dem Abschließen prüft openbill das Dokument nach EN 16931 und zeigt jede fehlende Angabe, bis zum Feld in den Einstellungen, in das sie gehört.
        image: /screenshots/de/settings-organization.png
        alt: Die Einstellungen der Organisation mit Firmendaten, Besteuerung und USt-ID
        more: { text: E-Rechnung, link: /de/e-invoice }
      - title: Abschließen und archivieren
        text: Beim Abschließen bekommt das Dokument seine Nummer und ist danach gesperrt. openbill archiviert ein PDF/A-3 mit der factur-x.xml darin, ändern lässt es sich nur noch per Storno.
        image: /screenshots/de/einvoice.png
        alt: Eine abgeschlossene Rechnung mit der eingebetteten E-Rechnungs-XML daneben
        more: { text: E-Rechnung, link: /de/e-invoice }
  studio:
    title: Ein Agent gestaltet dein Template
    intro: Templates sind HTML, CSS und Liquid. Bearbeite sie in deinem eigenen Editor mit Live-Vorschau, oder beschreibe das Aussehen und lass einen KI-Agenten schreiben – er sieht Render-Fehler mit Zeilennummer und prüft das Ergebnis, bevor etwas gespeichert wird.
    demo:
      label: Ein Agent ändert auf Wunsch die styles.css eines Templates, und die Vorschau der Rechnung bekommt eine Serifen-Überschrift, eine Kobaltlinie unter der Adresse und die Summe in einem Kasten
      prompt: 'Bitte ruhiger: Überschrift mit Serifen, eine Kobaltlinie unter der Adresse und die Summe in einem Kasten.'
      file: template/styles.css
      edits:
        - { op: '-', text: 'h1 { font: 700 22px/1.2 sans-serif; }' }
        - { op: '+', text: 'h1 { font: 600 26px/1.15 ui-serif, Georgia, serif; }', effect: serif }
        - { op: '+', text: '.address { border-bottom: 2px solid #2f55d4; }', effect: rule }
        - { op: '+', text: '.totals { background: #f4f4f2; border-radius: 6px; }', effect: box }
      status: 'Gerendert: 1 Seite, keine Fehler'
    paths:
      - title: In deinem Editor, mit einem Coding-Agenten
        text: Lade das Template-Toolkit herunter und öffne Claude Code, Codex oder einen anderen Coding-Agenten in seinem Ordner. Der Agent bearbeitet template.liquid und styles.css, die Vorschau im Browser rendert jedes Speichern auf deiner Instanz, und AGENTS.md erklärt ihm die Regeln. Gefällt es dir, speichert pnpm push es in openbill.
        commands: [pnpm dev, pnpm push, pnpm pull]
        image: /screenshots/de/toolkit.png
        alt: Der Toolkit-Dialog eines Templates in openbill
        more: { text: Template-Toolkit, link: /de/template-toolkit }
      - title: In openbill, über MCP
        text: Verbinde einen Agenten mit dem MCP-Server, und er arbeitet direkt am Template. Er probiert Änderungen mit Beispieldaten oder einem echten Dokument aus, liest Fehler mit Zeilennummer, Seitenzahl und fehlende Felder und speichert, sobald alles rendert. Die Liquid-Referenz bekommt er als MCP-Resource.
        commands: [get-template, render-template-preview, update-template]
        image: /screenshots/de/template-editor.png
        alt: Der Template-Editor mit Code und einer Vorschau der Seite
        more: { text: Templates über MCP, link: /de/mcp#templates-gestalten }
  agents:
    title: Lass einen Agenten den Papierkram machen
    text: Alles, was die App kann, geht auch über eine REST-API mit eingeschränkten Tokens und einen MCP-Server. Ein Agent entwirft eine Rechnung, liest die offenen Punkte und schließt sie ab, mit denselben Prüfungen wie du.
    links:
      - { text: MCP-Server, link: /de/mcp }
      - { text: REST-API, link: /de/api }
    terminalLabel: Ein Agent legt eine Rechnung über MCP an, prüft sie und schließt sie ab
    lines:
      - { kind: you, text: 'Stell Hafenkontor Lindqvist den Shop-Relaunch in Rechnung.' }
      - { kind: call, text: 'create-document {"type":"invoice","customer_id":"01K7…","groups":[…]}' }
      - { kind: result, text: '{"status":"draft","totals":{"gross":"9650.90"},"issues":[]}' }
      - { kind: call, text: 'finalize-document {"id":"01K9…"}' }
      - { kind: result, text: '{"number":"RE-2026-0042","status":"open","is_locked":true}' }
      - { kind: call, text: 'get-document-pdf-url {"id":"01K9…"}' }
      - { kind: result, text: '{"pdf":"https://…/downloads/…","xml":"https://…/downloads/…"}' }
      - { kind: agent, text: 'RE-2026-0042 ist abgeschlossen. PDF und E-Rechnungs-XML sind archiviert, die Links gelten 15 Minuten.' }
  hosting:
    title: Läuft auf deinem Server, mit Docker Compose
    text: Ein Compose-Stack mit allem, was er braucht. Zwei Dateien laden, Passwörter und Adresse in .env eintragen, starten.
    code: |
      mkdir openbill && cd openbill
      curl -fsSLO https://raw.githubusercontent.com/baeroe/openbill/main/docker-compose.yml
      curl -fsSL -o .env https://raw.githubusercontent.com/baeroe/openbill/main/.env.docker.example
      nano .env    # APP_URL, ADMIN_*, DB_* Passwörter
      docker compose up -d
    copy: Kopieren
    copied: Kopiert
    facts:
      - { title: amd64 und arm64, text: 'Images für beide, vom Heimserver bis in die Cloud.' }
      - { title: MariaDB und Gotenberg, text: 'Datenbank und PDF-Dienst gehören zum Stack, in einem internen Netz.' }
      - { title: Deine Daten bleiben bei dir, text: 'Dokumente, Archiv und Templates liegen auf deinem Server und in deinen Backups.' }
    more: { text: Komplette Anleitung für Docker Compose, link: /de/setup }
  features:
    title: Was drin ist
    items:
      - { title: Eigene Felder, text: 'Text, Zahl, Betrag, Datum, Auswahl, Ja/Nein oder Bild – für Organisation, Kunden, Ansprechpartner, Dokumente und Positionen.', link: /de/custom-fields }
      - { title: Positionen in Gruppen, text: 'Gruppen mit Zwischensummen, optionale Leistungen in Angeboten, Vorschläge aus früheren Dokumenten.', link: /de/documents }
      - { title: Liquid-Templates mit Toolkit, text: 'Drei mitgelieferte Templates als Start, eigene im Browser oder in deinem Editor.', link: /de/template-toolkit }
      - { title: E-Rechnung eingebaut, text: 'EN 16931, archiviert als PDF/A-3 mit eingebetteter ZUGFeRD/Factur-X-XML.', link: /de/e-invoice }
      - { title: REST-API und MCP, text: 'Eingeschränkte Tokens für Skripte und Integrationen, 25 Tools für KI-Agenten.', link: /de/api }
      - { title: Selbst gehostet mit Docker, text: 'Ein Compose-Stack, Sicherung von zwei Volumes, Updates per Image-Tag.', link: /de/backup }
  closing:
    title: Starte mit der Einrichtung.
    primary: { text: Loslegen, link: /de/setup }
    secondary: { text: GitHub, link: https://github.com/baeroe/openbill }
---

<Landing />
