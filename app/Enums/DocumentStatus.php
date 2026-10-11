<?php

namespace App\Enums;

/**
 * offer: draft → open → accepted | rejected; confirmation: draft → open → done;
 * invoice: draft → open → paid, cancelled is set by a cancellation; cancellation: draft → closed.
 */
enum DocumentStatus: string
{
    case Draft = 'draft';
    case Open = 'open';
    case Accepted = 'accepted';
    case Rejected = 'rejected';
    case Done = 'done';
    case Paid = 'paid';
    case Cancelled = 'cancelled';
    case Closed = 'closed';
}
