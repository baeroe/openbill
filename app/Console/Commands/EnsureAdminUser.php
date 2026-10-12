<?php

namespace App\Console\Commands;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;

/**
 * Runs on every container start: creates the owner once, never changes an existing account. Without the variables it
 * only warns when no account exists at all (nobody could log in); ADMIN_PASSWORD can be removed after the first start.
 */
class EnsureAdminUser extends Command
{
    protected $signature = 'app:ensure-admin';

    protected $description = 'Create the owner account from ADMIN_EMAIL / ADMIN_PASSWORD if it does not exist yet';

    public function handle(): int
    {
        $email = config('openbill.admin.email');
        $password = config('openbill.admin.password');

        if (! is_string($email) || $email === '' || ! is_string($password) || $password === '') {
            if (! User::query()->exists()) {
                // nobody could log in: say so loudly in the container log instead of starting silently
                $this->error('No account exists yet and ADMIN_EMAIL / ADMIN_PASSWORD are not set: nobody can log in.');
                $this->error('Set both in .env for the first start and restart the container (docker compose up -d).');

                return self::SUCCESS;
            }
            $this->info('ADMIN_EMAIL / ADMIN_PASSWORD not set, skipping (accounts exist).');

            return self::SUCCESS;
        }

        $validator = Validator::make(
            ['email' => $email, 'password' => $password],
            ['email' => ['email'], 'password' => ['min:8']],
        );

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $message) {
                $this->error($message);
            }

            return self::FAILURE;
        }

        if (User::where('email', $email)->exists()) {
            $this->info("Admin user {$email} already exists, left unchanged.");
            $this->warn('ADMIN_PASSWORD is only needed for the first start: remove it from .env (change passwords in the UI or with php artisan app:reset-password).');

            return self::SUCCESS;
        }

        User::create(['name' => 'Admin', 'email' => $email, 'password' => $password, 'role' => UserRole::Owner]);
        $this->info("Admin user {$email} created.");

        return self::SUCCESS;
    }
}
