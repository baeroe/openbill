# REST API

openbill has a REST API under `/api`. The UI, AI agents and the template toolkit use the same endpoints, and every change runs through the same rules: a finalized document can no longer be changed, custom fields are validated, and every step is logged.

The interactive reference (Swagger UI) is at `/api/docs`, the OpenAPI document at `/api/docs.jsonopenapi`. Both work without a token.

## Authentication

Send a token in the `Authorization` header:

```bash
export OPENBILL_URL=https://openbill.ddev.site   # your instance
export OPENBILL_TOKEN='01J…|openbill_…'

curl -H "Authorization: Bearer $OPENBILL_TOKEN" -H 'Accept: application/json' "$OPENBILL_URL/api/documents"
```

Create a token under **Settings → API & MCP** in the app (see [MCP](/en/mcp#connect)) or on the command line. The token is shown once:

```bash
php artisan app:create-token admin@example.com --name=agent --ability=api:read --ability=api:write
# in DDEV: ddev artisan app:create-token …
```

| Ability | Allows |
|---|---|
| `api:read` | reading all resources, PDF/XML downloads, position suggestions, previews |
| `api:write` | everything `api:read` allows, plus creating, changing and deleting |
| `templates:render` | previews: `POST /api/render`, `GET /api/render/sources`, `GET /api/render/schema`. **This is read access to all documents:** the token can render every document (customer, address, positions, amounts) and `render/sources` lists recent documents with number and customer name. The toolkit needs this to preview templates with real documents. |
| `templates:write` | reading and writing **one** template (`--template=<id>`): `GET /api/templates/{id}`, `GET /api/templates/{id}/package`, `PUT /api/templates/{id}/files` |
| `mcp` | the [MCP server](/en/mcp) only (no REST endpoint) |

Without a valid token the API answers `401`, with a token that lacks the ability `403`. A revoked or expired token gets `401`.

The openbill UI itself uses the API with its login session (no token needed in the browser).

## Formats

- `Accept: application/json` – plain JSON. Lists are arrays of the current page.
- `Accept: application/ld+json` (default) – JSON-LD. Lists are objects with `member`, `totalItems` and `view` (links to the first, last, next and previous page).
- Field names are snake_case. Amounts and quantities are strings (`"1130.50"`, `"10.0000"`); numbers with decimals in a request are refused. Dates are `YYYY-MM-DD`, IDs are ULIDs.
- Every field of a resource is always present; fields without a value are `null` (for example `"number": null` of a draft).
- Lists of customers and documents are paginated: `?page=2&itemsPerPage=50` (up to 100, default 30).
- `PATCH` changes only the keys you send. `groups` of a document and `contacts` of a customer always replace the whole list (send the `id` of a group, position or contact to keep it).
- Send `Accept-Language: de` for German messages.

## Errors

Every error is `application/problem+json`:

```json
{
  "type": "urn:openbill:problem:document_locked",
  "title": "Conflict",
  "status": 409,
  "detail": "INV-2026-0007 is finalized and can no longer be changed.",
  "reason": "document_locked",
  "document_id": "01J…",
  "number": "INV-2026-0007"
}
```

`reason` is stable and meant for programs:

| Status | `reason` | Extra fields |
|---|---|---|
| 400 | `bad_request` (body is not a JSON object) | |
| 401 | `unauthenticated` | |
| 403 | `forbidden` | |
| 404 | `not_found` | |
| 409 | `document_locked` | `document_id`, `number` |
| 409 | `status_transition`, `conversion`, `duplicate_cancellation`, `cancellation_needs_invoice`, `cancellation_source`, `cancellation_customer`, `no_e_invoice`, `customer_has_finalized_documents`, `template_built_in`, `template_in_use` | |
| 422 | `validation_failed` | `violations: [{path, message}]` |
| 422 | `compliance_failed` (finalizing) | `violations: [{path, message, code}]` |
| 422 | `template_render_failed` (finalizing) | `errors: [{part, file, line, message}]` |
| 422 | `einvoice_invalid` | `errors: [message]` |
| 429 | `too_many_requests` | |
| 503 | `pdf_render_failed` (PDF service unavailable, try again) | |

Paths come in two forms. **Validation** uses the position in the request: `groups.0.positions.1.custom.ticket` is the custom field `ticket` of the second position in the first group. **Compliance** (`issues` of a draft, `compliance_failed`) uses IDs, because it describes the saved document: `positions.01J….unit`, `document.custom.project_name`, `customer.address`.

## Resources

| Resource | Endpoints |
|---|---|
| Customers | `GET/POST /api/customers` (`?q=`), `GET/PATCH/DELETE /api/customers/{id}` |
| Documents | `GET/POST /api/documents` (`?type= &status= &customer_id= &q= &date_from= &date_to= &sort=`), `GET/PATCH/DELETE /api/documents/{id}` |
| Document actions | `POST /api/documents/{id}/finalize`, `…/status` (`{"status": "accepted"}`), `…/convert` (`{"type": "invoice"}`), `…/cancel`, `…/duplicate` |
| Downloads | `GET /api/documents/{id}/pdf` (`?inline=1`), `GET /api/documents/{id}/xml` |
| Position suggestions | `GET /api/position-suggestions` (`?q= &limit=`) |
| Custom fields | `GET/POST /api/field-definitions` (`?scope= &doc_type=`), `GET/PATCH/DELETE /api/field-definitions/{id}` |
| Tax rates, units | `GET/POST /api/tax-rates`, `/api/units` (`?include_archived=1`), `GET/PATCH/DELETE …/{id}` – `DELETE` archives |
| Text blocks | `GET/POST /api/text-blocks` (`?kind=`), `GET/PATCH/DELETE /api/text-blocks/{id}` |
| Document types | `GET /api/document-types`, `GET/PATCH /api/document-types/{type}` (profile, template, texts, terms, number range) |
| Organization | `GET/PATCH /api/organization` |
| Templates | `GET /api/templates`, `POST /api/templates` (package ZIP as multipart field `package`), `GET/DELETE /api/templates/{id}`, `PUT /api/templates/{id}/files`, `GET /api/templates/{id}/package` |
| Preview | `POST /api/render`, `GET /api/render/sources`, `GET /api/render/schema` |

Additional endpoints (phase 7):

| Endpoint | What it does |
|---|---|
| `POST /api/templates/{id}/duplicate` | editable copy of a template (also of a built-in one), 201 |
| `POST /api/field-definitions/reorder` | order of all fields of one level: `{"scope", "ids"}` |
| `POST /api/uploads`, `GET /api/uploads/{name}` | image for an image field (multipart `file`, at most 1 MB); the answer's `path` is the field value |
| `GET`, `POST`, `DELETE /api/organization/logo` | logo of the organization (multipart `logo`) |
| `GET /api/document-types/{type}/number-preview?pattern=…&reset_yearly=1&next_value=…` | next number for a pattern that is not saved yet |
| `POST /api/tax-rates/{id}/restore`, `POST /api/units/{id}/restore` | undo of the archiving `DELETE` |

Customers have `supply_type` (`goods` or `services`, default `services`) and `customer_kind` (`business` or `consumer`, default `business`); for customers outside the EU they decide between tax category `G`, `O` (services to businesses) and the regular rate (services to consumers) (see [e-invoices](/en/e-invoice#taxes)). User management (`/api/users`, `/api/users/{id}/disable|enable`, `/api/invitations`) is only open to the session of the app, never to tokens; disabled accounts get no API tokens and their existing ones stop working.

A document in a list has the short form (number, status, customer, totals, dates). `GET /api/documents/{id}` adds texts, custom fields, `groups` with their positions, `totals` (net, tax, gross, tax breakdown, legal notes) and – for drafts – `issues`: everything finalizing would still complain about.

The `status` filter of `GET /api/documents` also takes `overdue`: open invoices whose due date has passed. Overdue is not a status of its own, so documents never carry it.

## The main flow with curl

```bash
H=(-H "Authorization: Bearer $OPENBILL_TOKEN" -H 'Accept: application/json' -H 'Content-Type: application/json')

# a customer
CUSTOMER=$(curl -s "${H[@]}" -X POST "$OPENBILL_URL/api/customers" -d '{
  "name": "Hafenkontor Lindqvist GmbH", "street": "Kaistraße 4", "zip": "20457", "city": "Hamburg", "country": "DE"
}' | jq -r .id)

UNIT=$(curl -s "${H[@]}" "$OPENBILL_URL/api/units" | jq -r '.[] | select(.code=="HUR") | .id')
VAT=$(curl -s "${H[@]}" "$OPENBILL_URL/api/tax-rates" | jq -r '.[] | select(.percent=="19.00") | .id')

# an offer with a group
OFFER=$(curl -s "${H[@]}" -X POST "$OPENBILL_URL/api/documents" -d "{
  \"type\": \"offer\", \"customer_id\": \"$CUSTOMER\",
  \"groups\": [{\"title\": \"Workshop\", \"positions\": [
    {\"kind\": \"item\", \"title\": \"Discovery workshop\", \"quantity\": \"8\", \"unit_price\": \"120\", \"unit_id\": \"$UNIT\", \"tax_rate_id\": \"$VAT\"}
  ]}]
}" | jq -r .id)

# finalize, accept, convert into an invoice
curl -s "${H[@]}" -X POST "$OPENBILL_URL/api/documents/$OFFER/finalize" | jq -r .number
curl -s "${H[@]}" -X POST "$OPENBILL_URL/api/documents/$OFFER/status" -d '{"status": "accepted"}' > /dev/null
INVOICE=$(curl -s "${H[@]}" -X POST "$OPENBILL_URL/api/documents/$OFFER/convert" -d '{"type": "invoice"}' | jq -r .id)

# what is still missing? (empty list = ready)
curl -s "${H[@]}" "$OPENBILL_URL/api/documents/$INVOICE" | jq .issues

# finalize the invoice, download the PDF, mark it paid
curl -s "${H[@]}" -X POST "$OPENBILL_URL/api/documents/$INVOICE/finalize" | jq -r .number
curl -s -H "Authorization: Bearer $OPENBILL_TOKEN" -o invoice.pdf "$OPENBILL_URL/api/documents/$INVOICE/pdf"
curl -s "${H[@]}" -X POST "$OPENBILL_URL/api/documents/$INVOICE/status" -d '{"status": "paid"}' > /dev/null

# cancel it: creates the cancellation draft, finalizing it cancels the invoice
CANCELLATION=$(curl -s "${H[@]}" -X POST "$OPENBILL_URL/api/documents/$INVOICE/cancel" | jq -r .id)
curl -s "${H[@]}" -X POST "$OPENBILL_URL/api/documents/$CANCELLATION/finalize" | jq -r .status
```

## Saving drafts

`PATCH /api/documents/{id}` saves a draft and answers with the new totals and open issues – the editor's autosave uses exactly this. The body takes `date`, `customer_id`, `contact_id`, `service_date`, `service_date_end`, `due_date`, `valid_until`, `intro`, `closing`, `template_id`, `locale`, `custom` and `groups`:

```json
{
  "groups": [
    {"id": "01J…", "title": "Workshop", "positions": [
      {"id": "01J…", "kind": "item", "title": "Discovery workshop", "description": "", "quantity": "8",
       "unit_price": "120", "unit_id": "01J…", "tax_rate_id": "01J…", "custom": {"ticket": "OPS-12"}}
    ]},
    {"title": null, "positions": [{"kind": "text", "title": "Travel costs are billed separately."}]}
  ]
}
```

A group with `"title": null` holds loose positions (no heading, no subtotal). `kind` is `item`, `text` or `optional` (offers only). A finalized document answers `409 document_locked`.

## Previews

`POST /api/render` renders a saved document, unsaved draft changes (`draft`, same body as `PATCH`) or sample data (`scenario`), optionally with unsaved template parts (`template`). The answer has `header`, `body`, `footer` (complete HTML documents), `paper`, `totals`, `issues` and `errors`. Template problems are not an HTTP error: they come back in `errors` with part, file and line, and the request still answers `200`.

```bash
curl -s "${H[@]}" -X POST "$OPENBILL_URL/api/render" -d '{"scenario": "long_invoice", "locale": "en"}' | jq .errors
```

`GET /api/render/sources` lists the sample scenarios and recent documents, `GET /api/render/schema` the fields a template can use per level (`?document_type=invoice` filters custom fields).

## Templates

`PUT /api/templates/{id}/files` writes the given parts of an imported template – the toolkit's `push` does this:

```json
{
  "header": "…", "body": "…", "footer": "…", "css": "…",
  "manifest": {"name": "Fjord", "version": "1.1.0"},
  "assets": {"assets/logo.svg": "<base64>"}
}
```

`assets`, when sent, is the complete list. Built-in templates (Klar, Kante, Leise) are read-only: `409 template_built_in`. `GET /api/templates/{id}/package` downloads the template as package ZIP, `POST /api/templates` imports one (`-F package=@template.zip`).

## Downloads for other programs

The MCP server hands out signed download links for PDF and XML. They work without a token for 15 minutes; after that, or when changed, they answer `403`. A finalized document delivers its archived file. A draft is rendered live with a watermark. Its link is bound to the draft's content (fields, texts, customer and contact, template choice, groups and positions in their order): after any change of these it answers `403`, ask for a new link. Master data is read live, so a changed customer address or template shows up in a draft link. Once the draft is finalized, the link delivers the archived file.

## Limits

600 requests per minute per token (per IP without a token). Above that the API answers `429` with `Retry-After`.
