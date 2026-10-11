<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Seeder;
use RuntimeException;

/** Login of the Playwright tests in e2e/ (fictional). Never in production. */
class E2eUserSeeder extends Seeder
{
    public const EMAIL = 'e2e@example.com';

    public const PASSWORD = 'e2e-password';

    public function run(): void
    {
        if (app()->environment('production')) {
            throw new RuntimeException('E2eUserSeeder must not run in production.');
        }

        // the model hashes the password (cast "hashed")
        User::query()->updateOrCreate(
            ['email' => self::EMAIL],
            ['name' => 'Erik Ende', 'password' => self::PASSWORD, 'role' => UserRole::Owner, 'locale' => null],
        );
    }
}
