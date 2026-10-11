<?php

use App\Actions\SyncBuiltInTemplates;
use App\Support\Actor;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The built-in templates belong to the base data (like document types), so every instance and every
 * test database has them. Later versions are applied by app:sync-templates (Docker entrypoint).
 */
return new class extends Migration
{
    public function up(): void
    {
        app(SyncBuiltInTemplates::class)->handle(Actor::system());
    }

    public function down(): void
    {
        DB::table('document_types')->update(['template_id' => null]);
        DB::table('templates')
            ->where('built_in', true)
            ->whereNotIn('id', DB::table('documents')->whereNotNull('template_id')->select('template_id'))
            ->delete();
    }
};
