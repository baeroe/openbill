<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\User;
use App\Models\UserInvitation;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/** Login of the Playwright tests in e2e/ (fictional). Never in production. */
class E2eUserSeeder extends Seeder
{
    public const EMAIL = 'e2e@example.com';

    public const PASSWORD = 'e2e-password';

    /** Prefix of the addresses e2e/tests/users.spec.ts invites. */
    public const INVITED_PREFIX = 'e2e.';

    public function run(): void
    {
        if (app()->environment('production')) {
            throw new RuntimeException('E2eUserSeeder must not run in production.');
        }

        // accounts the Playwright tests invited (e2e.*@example.com) are test data: gone before every run, as long as
        // nothing refers to them (accounts are otherwise never deleted, see DisableUser)
        $leftovers = User::query()->where('email', 'like', self::INVITED_PREFIX.'%@example.com')
            ->whereNotIn('id', DB::table('documents')->whereNotNull('created_by')->select('created_by'))
            ->whereNotIn('id', DB::table('document_events')->whereNotNull('user_id')->select('user_id'))
            ->get();
        foreach ($leftovers as $user) {
            $user->tokens()->delete();
            DB::table('sessions')->where('user_id', $user->id)->delete();
            $user->delete();
        }
        UserInvitation::query()->where('email', 'like', self::INVITED_PREFIX.'%@example.com')->delete();

        // the model hashes the password (cast "hashed")
        User::query()->updateOrCreate(
            ['email' => self::EMAIL],
            ['name' => 'Erik Ende', 'password' => self::PASSWORD, 'role' => UserRole::Owner, 'locale' => null],
        );
    }
}
