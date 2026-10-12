<?php

namespace App\Http\Api;

/** Middleware stacks of the API operations (app/ApiResource) and of routes/api.php. Rules: App\Support\ApiAccess. */
final class ApiMiddleware
{
    public const READ = ['auth:sanctum', 'api.ability:read'];

    public const WRITE = ['auth:sanctum', 'api.ability:write'];

    public const RENDER = ['auth:sanctum', 'api.ability:render'];

    public const TEMPLATE_READ = ['auth:sanctum', 'api.ability:template-read'];

    public const TEMPLATE_WRITE = ['auth:sanctum', 'api.ability:template-write'];

    /** Session of the own UI only (user management); every API token gets 403. */
    public const SESSION = ['auth:sanctum', 'api.ability:session'];
}
