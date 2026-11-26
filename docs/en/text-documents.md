# Text documents

A **text document** is a document made of words only: terms and conditions, a service description, a small contract. It has a title and a text in Markdown, a date, optional custom fields and optionally a customer. It has no positions, no taxes and no totals. Like any other document it is numbered when you finalize it (`T-{YYYY}-{0000}`), rendered with a template and archived as a PDF, and it is locked afterwards.

![The editor of a text document: title, Markdown text and the live preview](/screenshots/en/text-editor.png)

## Create and write

**New document** (or the key **N**) → **Text document**. The customer is optional: terms and conditions have none, a framework contract for one client does. The editor shows:

- **Title** and **Text**. The text is Markdown: `## Heading`, lists with `-` or `1.`, `**bold**`, `*italic*`, `> quote`, links `[text](https://…)`. Raw HTML is shown as plain text, and images are not shown (the PDF loads nothing from outside).
- The usual header fields: date, customer, contact, language, template and your custom fields for text documents.
- **Publish:** a **short name** (letters `a–z`, digits and hyphens, for example `terms`; all versions of one text share it) and the switch **public**. A public text needs a short name and no customer. A finalized public text is reachable without login (see [Public link](#public-link)).
- The live preview on the right, exactly as the PDF will look. The check below the form lists what is still missing (date, title, text, required custom fields, `public` together with a customer).

Changes are saved automatically, like in every draft.

## Clauses

Recurring paragraphs are **text blocks** of the kind **Clause** (Settings → Text blocks). In the editor, **Insert clause** puts the text of a clause at the cursor, as a paragraph of its own. Clauses are plain Markdown; they are inserted as text, so you can change them in the document without touching the text block.

## Finalize and new versions

Finalizing checks the draft, assigns the number (`T-2026-0001`), freezes the text, renders the PDF with the template of the document type and stores it in the archive. The status becomes **closed**; a text document has no other statuses. It cannot be changed afterwards, converted into another document or cancelled.

A **new version** is a copy: **More actions → Duplicate** creates a draft with the same title, text, short name and public flag, dated today. Change it and finalize it; the old version stays as it was.

## Public link

A **finalized**, **public** text document **without a customer** is readable by anyone, without login, as a PDF:

- `https://<your instance>/legal/<short name>` – the **newest** version of the short name (for example `/legal/terms`). When you finalize a new version, the link shows it.
- `https://<your instance>/legal/<short name>/<number>` – exactly **this version** (for example `/legal/terms/T-2026-0002`). The address never changes its content, so an old quote keeps a working link to the terms it was based on.

The finalized document shows both links in the card **Publish**, ready to copy. The address is built from `APP_URL`, so it is the public `https://` address of your instance; the route has to be reachable without login in your [reverse proxy](/en/reverse-proxy#checklist).

**Withdrawing a text:** finalize a new version that is **not** public. The newest version decides: `/legal/<short name>` then answers 404, older public versions stay reachable by their number.

Everything that does not qualify answers the same **404**, so nobody can find out which short names exist: drafts, texts that are not public, texts with a customer (never public), other document types, unknown short names and numbers. The PDF is the archived file (checked against its SHA-256, never rendered again), served `inline`, 60 requests a minute per address. The link of the newest version is not cached; a version link is cached for a year (`immutable`).

## Templates and settings

The built-in templates Klar, Kante and Leise (version 1.2.0 and later) set a text document as title and text. For your own templates see [Text documents in templates](/en/templates#text-documents). In **Settings → Document types** the card *Text document* holds the number range and the template; there is no compliance profile and no payment term.

Text documents appear in the [document list](/en/documents#in-the-app) with the filter **Texts**; without a customer the list shows the title, and the amount column stays empty. They are never part of sums, the overview figures, open or overdue amounts. The same works through the [REST API](/en/api#saving-drafts) and [MCP](/en/mcp) (`type: text`, `title`, `body`, `slug`, `is_public`).
