<?php

namespace App\Mcp\Tools;

use App\ApiResource\OrganizationResource;
use App\Enums\DocumentType;
use App\Mcp\Output;
use App\Models\Organization;
use App\State\Provider\DocumentTypeProvider;
use App\Support\Actor;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('get-settings')]
#[Description('The organization (the sender: address, VAT ID, register number, bank, taxation mode, custom fields) and the document types (compliance profile basic or en16931, default template and texts, payment term, validity, numbering with the next number).')]
#[IsReadOnly]
final class GetSettingsTool extends OpenbillTool
{
    protected function run(Request $request, Actor $actor): Response
    {
        return Output::json([
            'organization' => Output::resource(OrganizationResource::fromModel(Organization::current())),
            'document_types' => array_map(
                fn (DocumentType $type): array => Output::resource(DocumentTypeProvider::resource($type)),
                DocumentType::cases(),
            ),
        ]);
    }
}
