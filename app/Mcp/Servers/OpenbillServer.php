<?php

namespace App\Mcp\Servers;

use App\Mcp\Tools;
use Laravel\Mcp\Server;
use Laravel\Mcp\Server\Attributes\Instructions;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Version;
use Laravel\Mcp\Server\Tool;

#[Name('openbill')]
#[Version('1.0.0')]
#[Instructions('openbill manages quotes, order confirmations, invoices and cancellations. Start with get-overview.')]
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
        Tools\DuplicateDocumentTool::class,
        Tools\FinalizeDocumentTool::class,
        Tools\SetDocumentStatusTool::class,
        Tools\ConvertDocumentTool::class,
        Tools\CancelInvoiceTool::class,
        Tools\GetDocumentPdfUrlTool::class,
        Tools\ListFieldDefinitionsTool::class,
        Tools\SaveFieldDefinitionTool::class,
        Tools\ListTemplatesTool::class,
        Tools\GetTemplateTool::class,
        Tools\UpdateTemplateTool::class,
        Tools\GetSettingsTool::class,
        Tools\UpdateOrganizationTool::class,
        Tools\ListTaxRatesAndUnitsTool::class,
        Tools\ListTextBlocksTool::class,
    ];

    /** @var array<int, class-string<Server\Resource>> */
    protected array $resources = [];
}
