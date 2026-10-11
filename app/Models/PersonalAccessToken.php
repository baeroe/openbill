<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Laravel\Sanctum\PersonalAccessToken as SanctumToken;

/**
 * Sanctum token with a ULID key. template_id binds a toolkit token (templates:write) to one template
 * (App\Support\ApiAccess); the row is deleted together with the template.
 */
class PersonalAccessToken extends SanctumToken
{
    use HasUlids;

    /** @return BelongsTo<Template, $this> */
    public function template(): BelongsTo
    {
        return $this->belongsTo(Template::class);
    }
}
