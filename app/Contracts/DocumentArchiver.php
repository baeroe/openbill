<?php

namespace App\Contracts;

use App\Models\Document;
use App\Models\DocumentSnapshot;

interface DocumentArchiver
{
    /**
     * Runs inside FinalizeDocument's transaction after number, status and snapshot are set and before
     * the "finalized" event. Throwing rolls everything back: the document stays a draft and the number
     * stays free. Phase 3 renders the PDF (and the e-invoice XML) here and writes document_files.
     *
     * Contract for implementations:
     * - The transaction holds the row lock on number_sequences, so every finalize of the same type waits
     *   while this runs. The render timeout (Gotenberg) must stay well below innodb_lock_wait_timeout
     *   (50 s), otherwise waiting finalizes fail with a lock wait timeout.
     * - A rollback can't remove files: write them to a temporary path, move them into place in
     *   DB::afterCommit() and delete the temporary files when the transaction rolls back.
     */
    public function archive(Document $document, DocumentSnapshot $snapshot): void;
}
