<?php

namespace App\Enums;

/** Who triggered an action: a signed-in user, an API/MCP token, or the system (console, seeders). */
enum ActorType: string
{
    case User = 'user';
    case Token = 'token';
    case System = 'system';
}
