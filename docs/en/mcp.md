# MCP

openbill has an MCP server at `<APP_URL>/mcp`. With it, agents like Claude Code or Codex look up customers and documents, write drafts, finalize them, hand out PDF links and work on templates – under the same rules as the app and the [REST API](/en/api): a finalized document can no longer be changed, custom fields are checked, and every step is logged with the token that did it.

## Connect

Create a token under **Settings → API & MCP**: **New token**, a name (for example the device) and the ability **MCP**. openbill shows the token once, together with the setup snippets with your URL and the token filled in. Create one token per device so you can revoke them one by one; the list shows when each token was last used.

**Claude Code** (`--scope user` for all projects, `--scope local` for the current one):

```bash
claude mcp add --transport http --scope user openbill https://openbill.example.com/mcp --header "Authorization: Bearer <token>"
```

**Codex:** add this to `~/.codex/config.toml` (all projects) or `.codex/config.toml` in a trusted project. Keep the project file out of git, it contains the token.

```toml
[mcp_servers.openbill]
url = "https://openbill.example.com/mcp"
http_headers = { "Authorization" = "Bearer <token>" }
```

**Other clients** with an `mcpServers` configuration (for example `.mcp.json`):

```json
{
  "mcpServers": {
    "openbill": {
      "type": "http",
      "url": "https://openbill.example.com/mcp",
      "headers": { "Authorization": "Bearer <token>" }
    }
  }
}
```

Without the settings page, the Artisan command from [REST API → Authentication](/en/api#authentication) creates a token too: give it `--ability=mcp`.

## Rights

Only a token with the ability `mcp` gets in. Without a token, or with a revoked or expired one, the server answers `401`; a token without `mcp` gets `403`. The login of the browser does not work for `/mcp`. An `mcp` token reaches no REST endpoint – give a token several abilities if a script needs both.

An `mcp` token can do everything the tools offer, including finalizing documents and marking invoices as paid, in the name of the user who created it. Tools that change or finalize data are marked as destructive (`destructiveHint`), reading tools as read-only, so clients can ask before running them; the server instructions also tell agents to ask before finalizing, cancelling or marking as paid.

## Tools

| Tool | What it does |
|---|---|
| `get-overview` | Key figures (open, overdue, offers, paid), documents that need attention, recently edited ones |
| `list-customers`, `get-customer` | Customers with contacts; search and pages |
| `create-customer`, `update-customer` | Create or change a customer; `contacts` is the complete list |
| `list-documents`, `get-document` | Documents in short form with filters; one document completely, with totals and open issues |
| `create-document`, `update-document` | Create a draft (offer, confirmation, invoice) or change it; `groups` replaces all groups and positions |
| `duplicate-document` | Copy a document into a new draft |
| `finalize-document` | Check, assign the number, archive the PDF (and the e-invoice XML) – cannot be undone |
| `set-document-status` | Accepted, rejected, done, paid, back to open |
| `convert-document` | Accepted offer into a confirmation or invoice, confirmation into an invoice |
| `cancel-invoice` | Cancellation draft of an open or paid invoice |
| `get-document-pdf-url` | Signed links to the PDF (and the XML of an e-invoice), 15 minutes, no token needed |
| `list-field-definitions`, `save-field-definition` | Custom fields: list, create, change |
| `list-templates`, `get-template`, `update-template` | Templates with their Liquid and CSS sources; built-in ones are read-only |
| `render-template-preview` | Liquid errors with line, page count, missing fields and a text excerpt – never HTML |
| `get-settings`, `update-organization` | Organization and document types; change the organization |
| `list-tax-rates-and-units`, `list-text-blocks` | Ids of tax rates and units for positions, reusable texts |

## Resources

| URI | Content |
|---|---|
| `openbill://docs/liquid-reference` | The [Templates](/en/templates) page as Markdown, including the Liquid reference (read from the docs at runtime) |
| `openbill://schema/fields` | Every field a template can use, per level, with the custom fields, as JSON |

## Designing templates

An agent can design or change a template inside the instance: `list-templates`, then `get-template` for the sources, `render-template-preview` with the changed parts to check them without saving (errors with line, page count, fields the manifest expects but openbill doesn't know), and `update-template` to save. Built-in templates are read-only: duplicate one in the template editor first. To let a coding agent work on the files in your own editor with a live preview instead, see [Template toolkit → Working with an AI agent](/en/template-toolkit#working-with-an-ai-agent).

## Answers and errors

- Answers are JSON in the format of the REST API with `Accept: application/json`: snake_case keys, amounts and quantities as strings (`"1130.50"`), `null` for empty values. Customers and documents come in pages: `page`, `per_page` (up to 100); the answer has `items`, `total` and `has_more`.
- Send amounts and quantities as strings too. Numbers with decimals are refused, so no rounding happens on the way.
- Invalid input names every field with its path:

```text
Invalid input:
- groups.0.positions.0.custom.billable: The field must be true or false.
```

- A refusal names its reason, for example `(reason: document_locked)`. When finalizing fails because data is missing (`compliance_failed`), the error lists every issue with its path, such as `document.custom.po_number` or `org.vat_id`.

## Limits

- 300 requests per minute per token, request bodies up to 2 MB.
- `render-template-preview` renders a PDF to count the pages at most 20 times a minute per token; above that `page_count` is `null` and `page_count_skipped` is `rate_limited` (the rest of the preview still comes back). Finalizing needs the same PDF service, so an agent loop cannot block it.
- Download links expire after 15 minutes; a link to a draft stops working as soon as the draft changes.
- No files over MCP: PDFs and XML come as links, template assets and the logo are uploaded in the app or through the REST API.
- No OAuth: connectors that require OAuth (for example in claude.ai) cannot connect; use a client that sends the token as a header.
