# Settings

**Settings** holds your company, the document types and the master data. Everything here is also available through the REST API (except users).

## Organization

Name, address, logo (PNG, JPEG, GIF, WebP or SVG, at most 1 MB – without a logo templates show the name), taxation (standard or small business under § 19 UStG), VAT ID, tax number, **register number** (`registration_id`, e.g. the commercial register entry), bank and contact details, the default document language and the custom fields of the organization. Missing details of the e-invoice profile show up in the check panel of the document editor; a click there opens this page at the right field.

The e-invoice profile needs the VAT ID or the register number; with reverse charge and exports of goods the VAT ID, with services to customers outside the EU the register number (the VAT IDs must not appear in that e-invoice).

## Document types

Per type: the **compliance profile** (basic, or EN 16931 e-invoice for invoices and cancellations), the **number range** and the **defaults** for new documents (template, payment term, validity, intro and closing text).

Number patterns use `{YYYY}`, `{YY}`, `{MM}` and a running number `{0000}` (as many digits as zeros). With “Start at 1 again every year” the pattern must contain the year. The preview next to the pattern comes from the server and shows the next number exactly as finalizing would assign it. “Next running number” continues an existing range; numbers already used are skipped.

## Taxes & units

Tax rates carry an EN 16931 category (`S` standard, `Z` zero rate, `E` exempt, `AE` reverse charge, `K` intra-community supply, `G` export, `O` not subject to VAT) and, at 0 %, a legal note. Units carry a UN/ECE Recommendation 20 code (e.g. `HUR` hour, `DAY` day, `H87` piece); without a code no e-invoice can be finalized.

Deleting a rate or unit **archives** it: it disappears from the pickers, existing documents keep it. “Undo” in the notice or “Restore” in the archived list brings it back.

## Text blocks

::: v-pre
Reusable intro, closing, payment and note texts. They may contain Liquid placeholders like `{{ customer.name }}` or `{{ document.due_date | date }}`, filled in when the document is rendered. A text block can be the default for a document type.
:::

## Users

All users work in the same organization. **Owners** invite users, change roles and disable users; **members** can do everything else (documents, customers, templates, fields, settings). At least one active owner always stays, and nobody can disable themselves.

openbill sends no email: **Invite** creates a link to pass on. The link is valid for 7 days and works once; it opens a page where the invited person sets their name and password and is signed in. Open invitations can be copied again or revoked.

Users are never deleted, they are **disabled**: the account stays so that documents and their activity log keep their author, but the person can no longer log in (the login says the account is disabled), their API tokens and sessions end at once and they get no new tokens. **Enable again** lets them log in again; old tokens stay revoked.

User management is only available in the app (not through API tokens or MCP).
