<?php

namespace App\Actions;

use App\Enums\TokenAbility;
use App\Models\User;
use App\Support\Actor;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\NewAccessToken;

/**
 * Creates a Sanctum token for $user (settings page "API & MCP" in phase 8, toolkit download in phase 9,
 * app:create-token). templates:write needs template_id and is then limited to that template.
 */
final class IssueApiToken
{
    /**
     * @param  array<string, mixed>  $input  name, abilities (TokenAbility values), template_id?, expires_at?
     *
     * @throws ValidationException
     */
    public function handle(Actor $actor, User $user, array $input): NewAccessToken
    {
        $abilities = is_array($input['abilities'] ?? null) ? $input['abilities'] : [];
        $writesTemplate = in_array(TokenAbility::TemplatesWrite->value, $abilities, true);

        $data = Validator::make($input, [
            'name' => ['required', 'string', 'max:255'],
            'abilities' => ['required', 'array', 'list', 'min:1'],
            'abilities.*' => ['distinct', Rule::enum(TokenAbility::class)],
            'template_id' => [
                Rule::requiredIf($writesTemplate),
                Rule::prohibitedIf(! $writesTemplate),
                'nullable', 'string', Rule::exists('templates', 'id'),
            ],
            'expires_at' => ['sometimes', 'nullable', 'date', 'after:now'],
        ])->validate();

        return DB::transaction(function () use ($user, $data): NewAccessToken {
            $expiresAt = isset($data['expires_at']) ? CarbonImmutable::parse($data['expires_at']) : null;
            $token = $user->createToken($data['name'], array_values($data['abilities']), $expiresAt);
            if (isset($data['template_id'])) {
                $token->accessToken->forceFill(['template_id' => $data['template_id']])->save();
            }

            return $token;
        });
    }
}
