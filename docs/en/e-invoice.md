# E-invoices

openbill creates e-invoices according to **EN 16931** in the UN/CEFACT CII syntax (Factur-X / ZUGFeRD profile EN 16931). The XML is embedded in a **PDF/A-3b**, so one file serves people and accounting software.

## Turning it on

The compliance profile is set per document type: `basic` or `en16931`. The e-invoice profile can only be chosen for invoices and cancellations. With `en16931`, finalizing checks everything an e-invoice needs (see [compliance profiles](/en/documents#compliance-profiles)) and stops with a list of what is missing.

## What finalizing does

For an invoice or cancellation with the profile `en16931` openbill, in the same step that assigns the number,

1. builds the CII XML from the frozen master data and the totals,
2. checks it against the EN 16931 XML schema (an invalid XML stops finalizing),
3. renders the PDF with the document's template and has Gotenberg convert it to PDF/A-3b with the XML embedded as `factur-x.xml`,
4. archives the PDF and the XML.

If any step fails – a template error, an invalid XML, Gotenberg not reachable – nothing is saved: the document stays a draft and the number stays free.

Documents with the profile `basic` (and offers and order confirmations) get a regular PDF without XML.

## Cancellations are credit notes

A finalized cancellation becomes a credit note (type code 381) with positive amounts that refers to the cancelled invoice (number and date).

## Taxes

| Situation | Tax category | Exemption reason |
|---|---|---|
| regular rate | `S` | – |
| zero rate | `Z` | – |
| small business (§ 19 UStG) | `E` | the small business note |
| EU reverse charge | `AE` (buyer VAT ID required) | the reverse charge note |
| outside the EU | `G` | the third country note |

The legal notes are also part of the XML as document notes.

## What goes into the XML

| openbill | EN 16931 |
|---|---|
| number, date | invoice number (BT-1), issue date (BT-2) |
| organization | seller name, address, VAT ID (`VA`) or tax number (`FC`), e-mail |
| customer | buyer name, customer number, address, VAT ID |
| service date (period) | delivery date (BT-72), invoicing period (BT-73/74) |
| IBAN, BIC | SEPA credit transfer (payment means 58) |
| due date | payment due date (BT-9) |
| items | name, description, net price (4 decimals), quantity with UN/ECE unit code, tax category and rate, line amount |
| totals | sum of lines, tax basis, tax total, grand total, amount due |

Text lines are not part of the XML; optional items only exist in offers.

## Downloads

The archived PDF and the archived XML can be downloaded separately; both are always the files from the archive, never rendered again. Only finalized invoices and cancellations with the e-invoice profile have an XML.

## Archive

Archived files live in `storage/app/archive/<year>/<document id>.pdf` and `.xml`. openbill stores the SHA-256 checksum of every file and checks it on every download: a changed or missing file is reported as an error instead of being replaced. Back up this folder together with the database.

## Requirements and limits

- Gotenberg **8.34 or newer** (the Docker image `gotenberg/gotenberg:8` is). `GOTENBERG_TIMEOUT` (seconds, default 20) limits each PDF request; keep it well below the database lock wait timeout (50 s).
- openbill checks the XML against the schema. Business rules beyond the schema (EN 16931 Schematron) are covered by the compliance profile; for a full check use an external validator.
- Not supported yet: XRechnung with Leitweg-ID, currencies other than EUR, allowances and charges, negative unit prices.
