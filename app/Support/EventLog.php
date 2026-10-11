<?php

namespace App\Support;

use App\Enums\EventAction;
use App\Models\Document;
use App\Models\DocumentEvent;

final class EventLog
{
    /**
     * @param  array<string, mixed>  $payload
     */
    public static function record(Document $document, Actor $actor, EventAction $action, array $payload = []): DocumentEvent
    {
        return $document->events()->create([
            'actor_type' => $actor->type,
            'actor_id' => $actor->id,
            'action' => $action,
            'payload' => $payload,
        ]);
    }
}
