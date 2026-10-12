<?php

namespace App\Console\Commands;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;

/**
 * Runs on every container start: creates the owner once, never changes an existing account.
 */
class EnsureAdminUser extends Command
{
    /** Placeholder of docker-compose.standalone.yml; the entrypoint refuses the same value for DB_PASSWORD. */
    public const PLACEHOLDER = 'change-me';

    protected $signature = 'app:ensure-admin';

    protected $description = 'Create the owner account from ADMIN_EMAIL / ADMIN_PASSWORD if it does not exist yet';

    public function handle(): int
    {
        $email = config('openbill.admin.email');
        $password = config('openbill.admin.password');

        if (! is_string($email) || $email === '' || ! is_string($password) || $password === '') {
            $this->warn('ADMIN_EMAIL / ADMIN_PASSWORD not set, skipping.');

            return self::SUCCESS;
        }

        $validator = Validator::make(
            ['email' => $email, 'password' => $password],
            ['email' => ['email'], 'password' => ['min:8']],
        );

        if ($password === self::PLACEHOLDER) {
            $this->error('ADMIN_PASSWORD is still the placeholder "'.self::PLACEHOLDER.'": set your own password (docker-compose.standalone.yml: the block at the top).');

            return self::FAILURE;
        }

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $message) {
                $this->error($message);
            }

            return self::FAILURE;
        }

        if (User::where('email', $email)->exists()) {
            $this->info("Admin user {$email} already exists, left unchanged.");

            return self::SUCCESS;
        }

        User::create(['name' => 'Admin', 'email' => $email, 'password' => $password, 'role' => UserRole::Owner]);
        $this->info("Admin user {$email} created.");

        return self::SUCCESS;
    }
}
