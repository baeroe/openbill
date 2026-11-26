<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Text documents (type "text"): title, Markdown body, short name and the public flag on documents, plus the
 * document type and number range. Adding nullable columns touches no row; documents_lock_update is re-created with
 * all locked columns (SchemaTest).
 */
return new class extends Migration
{
    private const DOCUMENT_MUTABLE = ['status', 'paid_at', 'cancelled_by_id', 'updated_at'];

    public function up(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->string('title', 255)->nullable();
            $table->mediumText('body')->nullable();
            $table->string('slug', 64)->nullable()->index();
            $table->boolean('is_public')->default(false);
        });

        $this->recreateTrigger();

        $now = now();
        if (! DB::table('document_types')->where('type', 'text')->exists()) {
            DB::table('document_types')->insert([
                'type' => 'text', 'profile' => 'basic',
                'template_id' => DB::table('templates')->where('slug', 'klar')->value('id'),
                'created_at' => $now, 'updated_at' => $now,
            ]);
        }
        if (! DB::table('number_sequences')->where('doc_type', 'text')->whereNull('year')->exists()) {
            DB::table('number_sequences')->insert([
                'id' => strtolower((string) Str::ulid()), 'doc_type' => 'text', 'year' => null,
                'pattern' => 'T-{YYYY}-{0000}', 'next_value' => 1, 'reset_yearly' => true,
                'created_at' => $now, 'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        DB::table('documents')->where('type', 'text')->exists() && throw new RuntimeException('Text documents exist; delete them before rolling back.');
        DB::table('number_sequences')->where('doc_type', 'text')->delete();
        DB::table('document_types')->where('type', 'text')->delete();
        DB::unprepared('DROP TRIGGER IF EXISTS documents_lock_update');
        Schema::table('documents', function (Blueprint $table) {
            $table->dropIndex(['slug']);
            $table->dropColumn(['title', 'body', 'slug', 'is_public']);
        });
        $this->recreateTrigger();
    }

    private function recreateTrigger(): void
    {
        $locked = array_values(array_diff(Schema::getColumnListing('documents'), self::DOCUMENT_MUTABLE));
        $changed = implode(' OR ', array_map(fn (string $c): string => "NOT (NEW.`{$c}` <=> OLD.`{$c}`)", $locked));

        DB::unprepared('DROP TRIGGER IF EXISTS documents_lock_update');
        DB::unprepared("CREATE TRIGGER documents_lock_update BEFORE UPDATE ON documents FOR EACH ROW
            BEGIN
                IF NOT (COALESCE(@openbill_unlock, 0) = 1) THEN
                    IF OLD.finalized_at IS NOT NULL AND ({$changed} OR NEW.status = 'draft') THEN
                        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'openbill: finalized document is locked';
                    END IF;
                END IF;
            END");
    }
};
