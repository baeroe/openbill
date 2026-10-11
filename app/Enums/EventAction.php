<?php

namespace App\Enums;

/** Entries in document_events. */
enum EventAction: string
{
    case Created = 'created';
    case Updated = 'updated';
    case Finalized = 'finalized';
    case StatusChanged = 'status_changed';

    /** On the source: a new document was created from it. */
    case Converted = 'converted';

    /** On the new document: where it came from. */
    case ConvertedFrom = 'converted_from';

    /** On an invoice: its cancellation was finalized. */
    case Cancelled = 'cancelled';

    case Duplicated = 'duplicated';
    case Deleted = 'deleted';
}
