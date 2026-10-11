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
     */
    public function archive(Document $document, DocumentSnapshot $snapshot): void;
}
