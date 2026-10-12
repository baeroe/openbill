---
layout: home
markdownStyles: false

landing:
  # all copy of the landing page lives here (and in docs/de/index.md); docs/.vitepress/theme/landing/ lays it out
  hero:
    title: Quotes and invoices the way you need them.
    tagline: Open source and self-hosted. Your own fields on every level, line items in groups, PDF templates in Liquid and EN 16931 e-invoices – in the browser, over a REST API and for AI agents over MCP.
    primary: { text: Get started, link: /en/setup }
    secondary: { text: GitHub, link: https://github.com/baeroe/openbill }
    replay: Play again
  invoice:
    locale: en-US
    label: An invoice from Studio Nordlicht to Hafenkontor Lindqvist GmbH over 9,650.90 euros, finalized as INV-2026-0042 and archived as PDF/A-3 with factur-x.xml
    sender: Studio Nordlicht
    senderLine: Studio Nordlicht, Speicherstraße 12, 20457 Hamburg
    recipient: [Hafenkontor Lindqvist GmbH, Mira Albers, Am Sandtorkai 4, 20457 Hamburg]
    title: Invoice
    subject: Relaunch online shop
    draft: Draft
    number: INV-2026-0042
    date: Oct 12, 2026
    groups:
      - title: Concept & UX
        items:
          - { name: Discovery workshop, quantity: '1', unit: flat, price: '890.00' }
          - { name: Wireframes & click prototype, quantity: '3', unit: days, price: '760.00' }
      - title: Implementation
        items:
          - { name: Frontend development, quantity: '52', unit: hrs, price: '95.00' }
    subtotal: Subtotal
    net: Net
    vat: VAT 19 %
    vatRate: 19
    total: Total
    stamp: Finalized
    badges: [PDF/A-3, factur-x.xml]
  story:
    title: From draft to e-invoice
    intro: One document, four stops. Everything you see here is the app itself, with demo data.
    steps:
      - title: Write the draft
        text: Pick the customer, put line items in groups and fill in your own fields. The preview renders the real PDF while you type, and every change is saved on its own.
        image: /screenshots/en/editor.png
        alt: The document editor with a draft invoice and the live preview
        more: { text: Documents and the editor, link: /en/documents }
      - title: Shape the template
        text: Templates are HTML, CSS and Liquid, rendered to PDF on the server. Edit them in the browser, or download the toolkit and keep working in your own editor.
        image: /screenshots/en/template-editor.png
        alt: The template editor with the Liquid source and a preview of the page
        more: { text: Templates, link: /en/templates }
      - title: Fix what is missing
        text: Before you finalize, openbill checks the document against EN 16931 and points to every missing detail, down to the field in your settings where it belongs.
        image: /screenshots/en/settings-organization.png
        alt: The organization settings with company details, taxation and VAT ID
        more: { text: E-invoices, link: /en/e-invoice }
      - title: Finalize and archive
        text: Finalizing assigns the number and locks the document. openbill archives a PDF/A-3 with the factur-x.xml inside, and only a cancellation can change it from then on.
        image: /screenshots/en/einvoice.png
        alt: A finalized invoice with the embedded e-invoice XML next to it
        more: { text: E-invoices, link: /en/e-invoice }
  studio:
    title: An agent can design your template
    intro: Templates are HTML, CSS and Liquid. Work on them in your own editor with a live preview, or describe the look and let an AI agent write it – it sees render errors with line numbers and checks the result before anything is saved.
    demo:
      label: An agent changes styles.css of a template as asked, and the invoice preview takes on a serif heading, a cobalt rule under the address and the total in a box
      prompt: 'Calmer, please: a serif heading, a cobalt rule under the address and the total in a box.'
      file: template/styles.css
      edits:
        - { op: '-', text: 'h1 { font: 700 22px/1.2 sans-serif; }' }
        - { op: '+', text: 'h1 { font: 600 26px/1.15 ui-serif, Georgia, serif; }', effect: serif }
        - { op: '+', text: '.address { border-bottom: 2px solid #2f55d4; }', effect: rule }
        - { op: '+', text: '.totals { background: #f4f4f2; border-radius: 6px; }', effect: box }
      status: 'Rendered: 1 page, no errors'
    paths:
      - title: In your editor, with a coding agent
        text: Download the template toolkit and open Claude Code, Codex or another coding agent in its folder. The agent edits template.liquid and styles.css, the preview in your browser renders every save on your instance, and AGENTS.md tells it the rules. Happy with it? pnpm push saves it in openbill.
        commands: [pnpm dev, pnpm push, pnpm pull]
        image: /screenshots/en/toolkit.png
        alt: The toolkit dialog of a template in openbill
        more: { text: Template toolkit, link: /en/template-toolkit }
      - title: Inside openbill, over MCP
        text: Connect an agent to the MCP server and it works on the template in place. It tries changes with sample data or a real document, reads errors with line numbers, the page count and missing fields, and saves once everything renders. The Liquid reference comes along as an MCP resource.
        commands: [get-template, render-template-preview, update-template]
        image: /screenshots/en/template-editor.png
        alt: The template editor with code and a preview of the page
        more: { text: Templates over MCP, link: /en/mcp#designing-templates }
  agents:
    title: Let an agent do the paperwork
    text: Everything the app does works through a REST API with scoped tokens and an MCP server. An agent can draft an invoice, read the open issues and finalize it, with the same checks as you.
    links:
      - { text: MCP server, link: /en/mcp }
      - { text: REST API, link: /en/api }
    terminalLabel: An agent creates, checks and finalizes an invoice over MCP
    lines:
      - { kind: you, text: 'Invoice Hafenkontor Lindqvist for the shop relaunch.' }
      - { kind: call, text: 'create-document {"type":"invoice","customer_id":"01K7…","groups":[…]}' }
      - { kind: result, text: '{"status":"draft","totals":{"gross":"9650.90"},"issues":[]}' }
      - { kind: call, text: 'finalize-document {"id":"01K9…"}' }
      - { kind: result, text: '{"number":"INV-2026-0042","status":"open","is_locked":true}' }
      - { kind: call, text: 'get-document-pdf-url {"id":"01K9…"}' }
      - { kind: result, text: '{"pdf":"https://…/downloads/…","xml":"https://…/downloads/…"}' }
      - { kind: agent, text: 'INV-2026-0042 is finalized. PDF and e-invoice XML are archived; the links work for 15 minutes.' }
  hosting:
    title: Runs on your server, with Docker Compose
    text: One compose file with everything it needs. Paste it into Dockge or Portainer (or save it as compose.yaml), change the four values at the top, deploy.
    rest: '# … and the services openbill, MariaDB and Gotenberg. Copy takes the whole file.'
    copy: Copy compose file
    copied: Copied
    facts:
      - { title: amd64 and arm64, text: 'Images for both, from a home server to the cloud.' }
      - { title: MariaDB and Gotenberg, text: 'The database and the PDF service come with the stack, on an internal network.' }
      - { title: Your data stays with you, text: 'Documents, archive and templates live on your server and in your backups.' }
    more: { text: Full Docker Compose guide, link: /en/setup }
  features:
    title: What is in the box
    items:
      - { title: Your own fields, text: 'Text, number, amount, date, selection, yes/no or image – on the organization, customers, contacts, documents and line items.', link: /en/custom-fields }
      - { title: Line items in groups, text: 'Groups with subtotals, optional services in quotes, suggestions from earlier documents.', link: /en/documents }
      - { title: Liquid templates with a toolkit, text: 'Three built-in templates to start from, your own in the browser or your editor.', link: /en/template-toolkit }
      - { title: E-invoices built in, text: 'EN 16931, archived as PDF/A-3 with embedded ZUGFeRD/Factur-X XML.', link: /en/e-invoice }
      - { title: REST API and MCP, text: 'Scoped tokens for scripts and integrations, 25 tools for AI agents.', link: /en/api }
      - { title: Self-hosted with Docker, text: 'One Compose stack, backups of two volumes, upgrades by image tag.', link: /en/backup }
  closing:
    title: Start with the setup guide.
    primary: { text: Get started, link: /en/setup }
    secondary: { text: GitHub, link: https://github.com/baeroe/openbill }
---

<Landing />
