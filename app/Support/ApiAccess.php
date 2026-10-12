<?php

namespace App\Support;

use App\Enums\TokenAbility;
use App\Models\PersonalAccessToken;
use InvalidArgumentException;
use Laravel\Sanctum\Contracts\HasAbilities;
use Laravel\Sanctum\TransientToken;

/**
 * Which token may use which endpoint. The session of the own UI (Sanctum TransientToken) may do everything.
 * A toolkit token (templates:write with template_id) reads and writes only its own template.
 * SESSION: only the own UI (user management), never a token.
 */
final class ApiAccess
{
    public const READ = 'read';

    public const WRITE = 'write';

    public const RENDER = 'render';

    public const TEMPLATE_READ = 'template-read';

    public const TEMPLATE_WRITE = 'template-write';

    public const MCP = 'mcp';

    /** Only the own UI (user management): no ability opens it, only the session. */
    public const SESSION = 'session';

    /** Abilities that open a rule on their own. */
    private const OPEN = [
        self::READ => ['api:read', 'api:write'],
        self::WRITE => ['api:write'],
        self::RENDER => ['api:read', 'api:write', 'templates:render'],
        self::TEMPLATE_READ => ['api:read', 'api:write'],
        self::TEMPLATE_WRITE => ['api:write'],
        self::MCP => ['mcp'],
        self::SESSION => [],
    ];

    public static function allows(?HasAbilities $token, string $rule, ?string $templateId = null): bool
    {
        if (! array_key_exists($rule, self::OPEN)) {
            throw new InvalidArgumentException("Unknown API access rule {$rule}.");
        }
        if ($token === null) {
            return false;
        }
        if ($token instanceof TransientToken) {
            return true;
        }
        foreach (self::OPEN[$rule] as $ability) {
            if ($token->can($ability)) {
                return true;
            }
        }

        return in_array($rule, [self::TEMPLATE_READ, self::TEMPLATE_WRITE], true)
            && $templateId !== null
            && $token instanceof PersonalAccessToken
            && $token->template_id === $templateId
            && $token->can(TokenAbility::TemplatesWrite->value);
    }
}
