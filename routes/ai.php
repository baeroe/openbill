<?php

use App\Http\Middleware\SetApiLocale;
use App\Mcp\Servers\OpenbillServer;
use Laravel\Mcp\Facades\Mcp;

/*
 * MCP for agents (Claude Code, Codex): a Sanctum token with the ability "mcp" (ApiAccess::MCP, never the UI
 * session), its own rate limit (AppServiceProvider, limiter "mcp"). Accept-Language de gives German messages.
 * laravel/mcp loads this file itself; GET and DELETE /mcp answer 405.
 */
Mcp::web('/mcp', OpenbillServer::class)
    ->middleware([SetApiLocale::class, 'throttle:mcp', 'auth:sanctum', 'api.ability:mcp'])
    ->name('mcp');
