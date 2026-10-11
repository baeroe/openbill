<?php

namespace App\Enums;

/** What a Sanctum token may do (spec section 4). Rules per endpoint: App\Support\ApiAccess. */
enum TokenAbility: string
{
    case ApiRead = 'api:read';
    case ApiWrite = 'api:write';
    case Mcp = 'mcp';
    case TemplatesRender = 'templates:render';
    case TemplatesWrite = 'templates:write';
}
