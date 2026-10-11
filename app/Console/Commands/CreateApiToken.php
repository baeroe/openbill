<?php

namespace App\Console\Commands;

use App\Actions\IssueApiToken;
use App\Models\User;
use App\Support\Actor;
use Illuminate\Console\Command;
use Illuminate\Validation\ValidationException;

class CreateApiToken extends Command
{
    protected $signature = 'app:create-token
        {email : Email of the user the token acts for}
        {--name=cli : Name shown in the token list}
        {--ability=* : api:read, api:write, mcp, templates:render, templates:write (default api:read)}
        {--template= : Template id, required with templates:write}';

    protected $description = 'Create an API token and print it once';

    public function handle(IssueApiToken $issue): int
    {
        $user = User::query()->where('email', (string) $this->argument('email'))->first();
        if ($user === null) {
            $this->error('There is no user with this email.');

            return self::FAILURE;
        }

        try {
            $token = $issue->handle(Actor::system(), $user, [
                'name' => (string) $this->option('name'),
                'abilities' => $this->option('ability') ?: ['api:read'],
                'template_id' => $this->option('template'),
            ]);
        } catch (ValidationException $e) {
            foreach ($e->errors() as $path => $messages) {
                $this->error("{$path}: ".implode(' ', $messages));
            }

            return self::FAILURE;
        }

        $this->line($token->plainTextToken);

        return self::SUCCESS;
    }
}
