<?php

namespace App\Mcp\Resources;

use App\Actions\DescribeRenderSchema;
use App\Http\Api\CurrentActor;
use Illuminate\Auth\AuthenticationException;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\MimeType;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Title;
use Laravel\Mcp\Server\Attributes\Uri;
use Laravel\Mcp\Server\Resource;

#[Name('field-schema')]
#[Title('Field schema')]
#[Description('Every field a template can use, per level (org, customer, contact, document, position): where it lives in the Liquid context, the core fields and the custom fields with label, type, required, options and document types. Custom fields are managed with list-field-definitions and save-field-definition.')]
#[Uri('openbill://schema/fields')]
#[MimeType('application/json')]
final class FieldSchemaResource extends Resource
{
    /**
     * @throws AuthenticationException
     */
    public function handle(Request $request, DescribeRenderSchema $describe): Response
    {
        return Response::json($describe->handle(CurrentActor::forUser($request->user()), []));
    }
}
