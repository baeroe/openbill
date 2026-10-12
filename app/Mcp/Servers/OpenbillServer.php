<?php

namespace App\Mcp\Servers;

use App\Mcp\Resources;
use App\Mcp\Tools;
use Laravel\Mcp\Server;
use Laravel\Mcp\Server\Attributes\Instructions;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Version;
use Laravel\Mcp\Server\Tool;

/**
 * openbill over MCP (/mcp, routes/ai.php): the tools of spec section 6 as a thin layer over app/Actions.
 * Every tool name used in a text must exist (tests/Feature/Mcp/McpServerTest.php, also for docs/{en,de}/mcp.md).
 */
#[Name('openbill')]
#[Version('1.0.0')]
#[Instructions(<<<'TXT'
    openbill keeps the offers, order confirmations, invoices and cancellations of one organization, with custom fields and Liquid templates rendered to PDF; invoices can carry an EN 16931 e-invoice.
    Start with get-overview. Look up ids before writing: list-customers, list-documents, list-tax-rates-and-units (tax_rate_id and unit_id of positions), list-field-definitions (keys for "custom"), list-text-blocks, get-settings.
    Main flow: create-customer, create-document (type offer, groups with positions), finalize-document, set-document-status accepted, convert-document to an invoice, update-document (service_date, due_date), get-document (empty "issues" means ready), finalize-document, get-document-pdf-url, set-document-status paid. cancel-invoice creates the cancellation draft, finalize-document finalizes it.
    Rules: ids are ULIDs. Amounts and quantities are strings with a dot ("1130.50", "8"), never numbers with decimals. Dates are YYYY-MM-DD. update-document changes only the keys you send; "groups" replaces all groups and positions (send their ids to keep them). Only drafts can change. Finalizing assigns the number and locks the document for good: ask the user before finalize-document, cancel-invoice and marking an invoice as paid.
    Errors name the field path (groups.0.positions.1.custom.ticket) or a reason code (document_locked; compliance_failed with the list of missing data and their paths).
    Templates: get-template, then update-template (own templates only, built-in ones are read-only); check with render-template-preview (errors with line, page count, missing fields). Read the resource openbill://docs/liquid-reference before writing Liquid; openbill://schema/fields lists every field a template can use.
    Files: get-document-pdf-url returns signed links valid for 15 minutes without a token. Give the link to the user instead of downloading the file.
    TXT)]
final class OpenbillServer extends Server
{
    /** All tools in one tools/list answer (laravel/mcp pages by 15 otherwise; there are 25). */
    public int $defaultPaginationLength = 50;

    /** @var array<int, class-string<Tool>> */
    protected array $tools = [
        Tools\GetOverviewTool::class,
        Tools\ListCustomersTool::class,
        Tools\GetCustomerTool::class,
        Tools\CreateCustomerTool::class,
        Tools\UpdateCustomerTool::class,
        Tools\ListDocumentsTool::class,
        Tools\GetDocumentTool::class,
        Tools\CreateDocumentTool::class,
        Tools\UpdateDocumentTool::class,
        Tools\FinalizeDocumentTool::class,
        Tools\SetDocumentStatusTool::class,
        Tools\ConvertDocumentTool::class,
        Tools\CancelInvoiceTool::class,
        Tools\DuplicateDocumentTool::class,
        Tools\GetDocumentPdfUrlTool::class,
        Tools\ListFieldDefinitionsTool::class,
        Tools\SaveFieldDefinitionTool::class,
        Tools\ListTemplatesTool::class,
        Tools\GetTemplateTool::class,
        Tools\UpdateTemplateTool::class,
        Tools\RenderTemplatePreviewTool::class,
        Tools\GetSettingsTool::class,
        Tools\UpdateOrganizationTool::class,
        Tools\ListTaxRatesAndUnitsTool::class,
        Tools\ListTextBlocksTool::class,
    ];

    /** @var array<int, class-string<Server\Resource>> */
    protected array $resources = [
        Resources\LiquidReferenceResource::class,
        Resources\FieldSchemaResource::class,
    ];
}
