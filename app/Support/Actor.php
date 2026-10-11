<?php

namespace App\Support;

use App\Enums\ActorType;
use App\Models\User;

/** Who runs an action; written to document_events. Phase 4/8 build it from the Sanctum token. */
final readonly class Actor
{
    private function __construct(
        public ActorType $type,
        public ?string $id,
        public ?string $userId,
    ) {}

    public static function user(User $user): self
    {
        return new self(ActorType::User, $user->id, $user->id);
    }

    public static function token(string $tokenId, ?string $userId): self
    {
        return new self(ActorType::Token, $tokenId, $userId);
    }

    /** Console commands and seeders. */
    public static function system(): self
    {
        return new self(ActorType::System, null, null);
    }
}
