# Text documents

A **text document** is a document made of words only: terms and conditions, a service description, a small contract. It has a title and a text in Markdown, a date, optional custom fields and optionally a customer. It has no positions, no taxes and no totals. Like any other document it is numbered when you finalize it (`T-{YYYY}-{0000}`), rendered with a template and archived as a PDF, and it is locked afterwards.

![The editor of a text document: title, Markdown text and the live preview](/screenshots/en/text-editor.png)

## Create and write

**New document** (or the key **N**) → **Text document**. The customer is optional: terms and conditions have none, a framework contract for one client does. The editor shows:

- **Title** and **Text**. The text is Markdown: `## Heading`, lists with `-` or `1.`, `**bold**`, `*italic*`, `> quote`, links `[text](https://…)`. Raw HTML is shown as plain text, and images are not shown (the PDF loads nothing from outside).
- The usual header fields: date, customer, contact, language, template and your custom fields for text documents.
- **Publish:** a **short name** (letters `a–z`, digits and hyphens, for example `terms`; all versions of one text share it) and the switch **public**. A public text needs a short name and no customer. Public texts become reachable without login in a later step of this feature; until then the flag is only stored.
- The live preview on the right, exactly as the PDF will look. The check below the form lists what is still missing (date, title, text, required custom fields, `public` together with a customer).

Changes are saved automatically, like in every draft.

## Clauses

Recurring paragraphs are **text blocks** of the kind **Clause** (Settings → Text blocks). In the editor, **Insert clause** puts the text of a clause at the cursor, as a paragraph of its own. Clauses are plain Markdown; they are inserted as text, so you can change them in the document without touching the text block.

## Finalize and new versions

Finalizing checks the draft, assigns the number (`T-2026-0001`), freezes the text, renders the PDF with the template of the document type and stores it in the archive. The status becomes **closed**; a text document has no other statuses. It cannot be changed afterwards, converted into another document or cancelled.

A **new version** is a copy: **More actions → Duplicate** creates a draft with the same title, text, short name and public flag, dated today. Change it and finalize it; the old version stays as it was.

## Templates and settings

The built-in templates Klar, Kante and Leise (version 1.2.0 and later) set a text document as title and text. For your own templates see [Text documents in templates](/en/templates#text-documents). In **Settings → Document types** the card *Text document* holds the number range and the template; there is no compliance profile and no payment term.

Text documents appear in the [document list](/en/documents#in-the-app) with the filter **Texts**; without a customer the list shows the title, and the amount column stays empty. They are never part of sums, the overview figures, open or overdue amounts. The same works through the [REST API](/en/api#saving-drafts) and [MCP](/en/mcp) (`type: text`, `title`, `body`, `slug`, `is_public`).
