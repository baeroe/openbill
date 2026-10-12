---
layout: home

hero:
  name: openbill
  text: Angebote und Rechnungen, wie du sie brauchst.
  tagline: Open Source und selbst gehostet. Eigene Felder auf jeder Ebene, Positionen in Gruppen, PDF-Templates in Liquid und E-Rechnungen nach EN 16931 – im Browser, über eine REST-API und für KI-Agenten über MCP.
  actions:
    - theme: brand
      text: Loslegen
      link: /de/setup
    - theme: alt
      text: Dokumente & Editor
      link: /de/documents
    - theme: alt
      text: GitHub
      link: https://github.com/baeroe/openbill

features:
  - title: Eigene Felder
    details: Felder für Organisation, Kunden, Ansprechpartner, Dokumente und Positionen – Text, Zahl, Betrag, Datum, Auswahl, Ja/Nein oder Bild. Sie erscheinen in den Formularen, in der API und in deinen Templates.
    link: /de/custom-fields
    linkText: Eigene Felder
  - title: Positionen in Gruppen
    details: Positionen in Gruppen mit Zwischensummen ordnen, mit Maus oder Tastatur verschieben und in Angeboten optionale Leistungen anbieten. openbill schlägt Positionen aus früheren Dokumenten vor.
    link: /de/documents
    linkText: Dokumente
  - title: Liquid-Templates mit Toolkit
    details: Templates sind HTML, CSS und Liquid und werden auf dem Server zu PDF. Bearbeite sie im Browser oder lade das Toolkit herunter und arbeite in deinem eigenen Editor mit Live-Vorschau.
    link: /de/templates
    linkText: Templates
  - title: E-Rechnung eingebaut
    details: Rechnungen und Stornos können EN 16931 erfüllen und werden als PDF/A-3 mit eingebetteter XML (ZUGFeRD/Factur-X) archiviert. Fehlende Angaben siehst du vor dem Abschließen.
    link: /de/e-invoice
    linkText: E-Rechnung
  - title: REST-API und MCP
    details: Alles, was die Oberfläche kann, geht auch über eine REST-API mit eingeschränkten Tokens und einen MCP-Server – Agenten entwerfen, prüfen und schließen Dokumente für dich ab.
    link: /de/mcp
    linkText: MCP
  - title: Selbst gehostet mit Docker
    details: Ein Compose-Stack mit MariaDB und Gotenberg, Images für amd64 und arm64. Deine Daten bleiben auf deinem Server.
    link: /de/setup
    linkText: Einrichtung
---

<div class="showcase">

![Der Dokument-Editor: ein Rechnungsentwurf mit Positionsgruppen, eigenen Feldern, der Prüfanzeige und der Live-Vorschau](/screenshots/de/editor.png)

</div>
