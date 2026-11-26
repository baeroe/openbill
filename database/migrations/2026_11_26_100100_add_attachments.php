<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Attachments of quotes and order confirmations: a list of short names of text documents (documents.attachments,
 * locked after finalizing like every other column) and the default per document type (document_types.attachments).
 * Nullable columns touch no row; documents_lock_update is re-created with all locked columns (SchemaTest).
 */
return new class extends Migration
{
    private const DOCUMENT_MUTABLE = ['status', 'paid_at', 'cancelled_by_id', 'updated_at'];

    public function up(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->json('attachments')->nullable();
        });
        Schema::table('document_types', function (Blueprint $table) {
            $table->json('attachments')->nullable();
        });
        $this->recreateTrigger();
    }

    public function down(): void
    {
        DB::unprepared('DROP TRIGGER IF EXISTS documents_lock_update');
        Schema::table('documents', function (Blueprint $table) {
            $table->dropColumn('attachments');
        });
        Schema::table('document_types', function (Blueprint $table) {
            $table->dropColumn('attachments');
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
