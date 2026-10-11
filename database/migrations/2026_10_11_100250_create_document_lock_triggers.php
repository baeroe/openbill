<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Finalized documents are immutable on the database level too, so query-builder writes
 * (Model::query()->update(), relation ->delete(), DB::table()) can't bypass the model hooks:
 *
 * - documents: once finalized_at is set, only status, paid_at, cancelled_by_id and updated_at change,
 *   status never goes back to draft, and the row can't be deleted.
 * - positions, position_groups: no insert, update or delete when the old or new document is finalized;
 *   a position's group must belong to the same document.
 * - document_snapshots, document_files: never updated or deleted (cascades from deleting a draft
 *   don't fire triggers).
 *
 * Errors are SIGNAL SQLSTATE '45000' (QueryException). The session variable @openbill_unlock = 1
 * switches the lock off; only DemoSeeder uses it to wipe all business data.
 *
 * A new column on documents must be added to documents_lock_update (drop and re-create the trigger
 * in that migration); SchemaTest checks that every column is covered.
 */
return new class extends Migration
{
    private const DOCUMENT_MUTABLE = ['status', 'paid_at', 'cancelled_by_id', 'updated_at'];

    private const UNLOCKED = 'COALESCE(@openbill_unlock, 0) = 1';

    public function up(): void
    {
        $locked = array_values(array_diff(Schema::getColumnListing('documents'), self::DOCUMENT_MUTABLE));
        $changed = implode(' OR ', array_map(fn (string $c): string => "NOT (NEW.`{$c}` <=> OLD.`{$c}`)", $locked));

        $this->trigger('documents_lock_update', 'BEFORE UPDATE ON documents', "
            IF OLD.finalized_at IS NOT NULL AND ({$changed} OR NEW.status = 'draft') THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'openbill: finalized document is locked';
            END IF;
        ");
        $this->trigger('documents_lock_delete', 'BEFORE DELETE ON documents', "
            IF OLD.finalized_at IS NOT NULL THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'openbill: finalized document can not be deleted';
            END IF;
        ");

        $finalized = fn (string $id): string => "EXISTS (SELECT 1 FROM documents d WHERE d.id = {$id} AND d.finalized_at IS NOT NULL)";
        $groupMismatch = 'NOT EXISTS (SELECT 1 FROM position_groups g WHERE g.id = NEW.group_id AND g.document_id = NEW.document_id)';
        $signalLocked = "SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'openbill: finalized document is locked';";
        $signalGroup = "SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'openbill: position group belongs to another document';";

        $this->trigger('position_groups_lock_insert', 'BEFORE INSERT ON position_groups', "
            IF {$finalized('NEW.document_id')} THEN {$signalLocked} END IF;
        ");
        $this->trigger('position_groups_lock_update', 'BEFORE UPDATE ON position_groups', "
            IF {$finalized('OLD.document_id')} OR {$finalized('NEW.document_id')} THEN {$signalLocked} END IF;
        ");
        $this->trigger('position_groups_lock_delete', 'BEFORE DELETE ON position_groups', "
            IF {$finalized('OLD.document_id')} THEN {$signalLocked} END IF;
        ");

        $this->trigger('positions_lock_insert', 'BEFORE INSERT ON positions', "
            IF {$finalized('NEW.document_id')} THEN {$signalLocked} END IF;
            IF {$groupMismatch} THEN {$signalGroup} END IF;
        ");
        $this->trigger('positions_lock_update', 'BEFORE UPDATE ON positions', "
            IF {$finalized('OLD.document_id')} OR {$finalized('NEW.document_id')} THEN {$signalLocked} END IF;
            IF {$groupMismatch} THEN {$signalGroup} END IF;
        ");
        $this->trigger('positions_lock_delete', 'BEFORE DELETE ON positions', "
            IF {$finalized('OLD.document_id')} THEN {$signalLocked} END IF;
        ");

        foreach (['document_snapshots', 'document_files'] as $table) {
            foreach (['update' => 'BEFORE UPDATE', 'delete' => 'BEFORE DELETE'] as $suffix => $timing) {
                $this->trigger("{$table}_lock_{$suffix}", "{$timing} ON {$table}", "
                    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'openbill: {$table} are immutable';
                ");
            }
        }
    }

    public function down(): void
    {
        foreach ([
            'documents_lock_update', 'documents_lock_delete',
            'position_groups_lock_insert', 'position_groups_lock_update', 'position_groups_lock_delete',
            'positions_lock_insert', 'positions_lock_update', 'positions_lock_delete',
            'document_snapshots_lock_update', 'document_snapshots_lock_delete',
            'document_files_lock_update', 'document_files_lock_delete',
        ] as $name) {
            DB::unprepared("DROP TRIGGER IF EXISTS {$name}");
        }
    }

    /** Every trigger body is skipped while @openbill_unlock = 1. */
    private function trigger(string $name, string $timing, string $body): void
    {
        $unlocked = self::UNLOCKED;
        DB::unprepared("DROP TRIGGER IF EXISTS {$name}");
        DB::unprepared("CREATE TRIGGER {$name} {$timing} FOR EACH ROW
            BEGIN
                IF NOT ({$unlocked}) THEN
                    {$body}
                END IF;
            END");
    }
};
