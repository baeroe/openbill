<?php

namespace App\Support;

use App\Contracts\DocumentArchiver;
use App\Models\Document;
use App\Models\DocumentSnapshot;

/** Phase 2: nothing to archive yet (no PDF). Replaced by the real archiver in phase 3. */
final class NullDocumentArchiver implements DocumentArchiver
{
    public function archive(Document $document, DocumentSnapshot $snapshot): void {}
}
