# Documents

openbill knows four document types. Each one moves through a small set of statuses; finalizing gives it a number and locks it.

| Type | Statuses |
|---|---|
| Offer | draft → open → accepted / rejected |
| Order confirmation | draft → open → done |
| Invoice | draft → open → paid; cancelled (set by a cancellation) |
| Cancellation | draft → closed |

"Overdue" is not a status: an open invoice whose due date has passed is shown as overdue.

## Drafts

A new draft takes the defaults of its document type: intro and closing text blocks, template, payment term (invoice: due date = date + payment term, service date = date), validity (offer: valid until = date + validity), the customer's default contact and the default values of custom fields. A draft can be changed freely. Positions are organized in groups with a title and a subtotal; positions without a group sit in a group without title.

Position kinds:

- **Item** – quantity × unit price, counts towards the total.
- **Text** – a line without amount.
- **Optional** – offers only; shown with its price but not part of the total.

Amounts and quantities are exact decimals. Through the API they are sent as strings with a dot (`"12.50"`); numbers like `12.5` or `"12,5"` are rejected with a message for that field.

## Taxes and totals

Totals are computed per tax rate (net, tax, gross) and for the whole document; the tax of each rate is rounded once, commercially, to cents.

- **Small business (§ 19 UStG):** no VAT on any position (category E), the legal note is added automatically.
- **EU customer with reverse charge:** no VAT (category AE), the reverse charge note is added.
- **Customer in a third country:** no VAT (category G), the export note is added.

Legal notes are written in the document's language.

## Finalizing

Finalizing turns a draft into an open document (a cancellation into a closed one). In one step openbill

1. checks the compliance profile of the document type (see below) and stops with a list of what is missing,
2. assigns the next number of the number range,
3. freezes the master data the document uses (organization, customer, contact, tax rates, units, template and custom field definitions) in a snapshot,
4. stores the totals.

If any step fails, nothing changes: the document stays a draft and the number stays free.

After finalizing a document is **locked**. Only its status, the payment date and the link to its cancellation can still change. Later changes to customers, tax rates, units, templates or custom fields do not affect it, because it is shown and computed from its snapshot. To correct an invoice, cancel it and create a new one.

### Compliance profiles

| Profile | Checks |
|---|---|
| Basic | date, customer, at least one item, title, tax rate (unless small business) and unit of every item, required custom fields |
| E-invoice (EN 16931) | everything from Basic, plus organization name, full address, VAT ID or tax number and IBAN, full customer address, the customer's VAT ID for reverse charge, service date, due date (invoices), a unit code for every unit and no quantity 0 |

The e-invoice profile can only be chosen for invoices and cancellations.

## Document chain

Documents can be converted along the chain:

- an **accepted** offer → order confirmation or invoice,
- an order confirmation (not a draft) → invoice,
- an open or paid invoice → cancellation.

The new document is a draft with the customer, contact, groups, positions and texts of its source. Optional positions are dropped, groups that end up empty are dropped. Custom field values move along when the field is defined for the target type too; other values are dropped and reported. Every document knows its source, and an invoice knows the cancellation that cancelled it.

A cancellation copies the positions of its invoice with negative quantities. Each invoice has at most one cancellation; asking again returns the existing draft. When the cancellation is finalized, the invoice becomes **cancelled**.

Duplicating creates a new draft dated today without number and without chain. Cancellations cannot be duplicated.

## Number ranges

Every document type has its own number range with a pattern:

| Placeholder | Meaning |
|---|---|
| `{YYYY}` | year of the document date |
| `{YY}` | two-digit year |
| `{MM}` | month |
| `{0000}` | running number, padded to the number of zeros |

Defaults: `Q-{YYYY}-{0000}` (offers), `OC-{YYYY}-{0000}` (order confirmations), `INV-{YYYY}-{0000}` (invoices), `CN-{YYYY}-{0000}` (cancellations), each reset yearly.

- With a **yearly reset** every year has its own counter; a backdated document gets the next number of its own year. The pattern must then contain `{YYYY}` or `{YY}`.
- Numbers are assigned while the number range is locked, so two documents finalized at the same moment never get the same number.
- If a number already exists (for example after the pattern or the counter was changed by hand), it is skipped.

## Activity log

Every change to a document is logged with who made it (user, API token or the system): created, updated, finalized, status changed, converted, cancelled, duplicated, deleted. Entries of deleted drafts stay in the log.

## Demo data

For development and trying things out:

```bash
ddev artisan db:seed --class=DemoSeeder
```

This **replaces all business data** (documents, customers, custom fields, tax rates, units, text blocks, templates, number ranges) with the fictional company Studio Nordlicht and its customers. User accounts stay.
