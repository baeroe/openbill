---
layout: home

hero:
  name: openbill
  text: Quotes and invoices the way you need them.
  tagline: Open source and self-hosted. Your own fields on every level, line items in groups, PDF templates in Liquid and EN 16931 e-invoices – in the browser, over a REST API and for AI agents over MCP.
  actions:
    - theme: brand
      text: Get started
      link: /en/setup
    - theme: alt
      text: Documents & editor
      link: /en/documents
    - theme: alt
      text: GitHub
      link: https://github.com/baeroe/openbill

features:
  - title: Your own fields
    details: Add fields to the organization, customers, contacts, documents and line items – text, number, amount, date, selection, yes/no or image. They show up in the forms, the API and your templates.
    link: /en/custom-fields
    linkText: Custom fields
  - title: Line items in groups
    details: Organize positions in groups with subtotals, move them with mouse or keyboard, and offer optional services in quotes. openbill suggests positions from earlier documents.
    link: /en/documents
    linkText: Documents
  - title: Liquid templates with a toolkit
    details: Templates are HTML, CSS and Liquid, rendered to PDF on the server. Edit them in the browser, or download the toolkit and work in your own editor with a live preview.
    link: /en/templates
    linkText: Templates
  - title: E-invoices built in
    details: Invoices and cancellations can follow EN 16931 and are archived as PDF/A-3 with embedded XML (ZUGFeRD/Factur-X). Missing details show up before you finalize.
    link: /en/e-invoice
    linkText: E-invoices
  - title: REST API and MCP
    details: Everything the UI does works through a REST API with scoped tokens and an MCP server, so agents can draft, check and finalize documents for you.
    link: /en/mcp
    linkText: MCP
  - title: Self-hosted with Docker
    details: One Compose stack with MariaDB and Gotenberg, images for amd64 and arm64. Your data stays on your server.
    link: /en/setup
    linkText: Setup
---

<div class="showcase">

![The document editor: a draft invoice with groups of positions, custom fields, the compliance check and the live preview (the demo company writes its invoices in German)](/screenshots/en/editor.png)

</div>
