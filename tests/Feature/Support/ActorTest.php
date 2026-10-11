<?php

use App\Contracts\DocumentArchiver;
use App\Enums\ActorType;
use App\Enums\EventAction;
use App\Models\Document;
use App\Models\User;
use App\Rendering\PdfDocumentArchiver;
use App\Support\Actor;
use App\Support\EventLog;

it('describes users, tokens and the system', function () {
    $user = User::factory()->create();

    expect(Actor::user($user))->toMatchObject(['type' => ActorType::User, 'id' => $user->id, 'userId' => $user->id])
        ->and(Actor::token('42', $user->id))->toMatchObject(['type' => ActorType::Token, 'id' => '42', 'userId' => $user->id])
        ->and(Actor::system())->toMatchObject(['type' => ActorType::System, 'id' => null, 'userId' => null]);
});

it('records who did what on a document', function () {
    $user = User::factory()->create();
    $document = Document::factory()->create();

    EventLog::record($document, Actor::user($user), EventAction::StatusChanged, ['from' => 'open', 'to' => 'paid']);

    $event = $document->events()->firstOrFail();
    expect($event->actor_type)->toBe(ActorType::User)
        ->and($event->actor_id)->toBe($user->id)
        ->and($event->action)->toBe(EventAction::StatusChanged)
        ->and($event->payload)->toBe(['from' => 'open', 'to' => 'paid']);
});

it('binds the PDF archiver since phase 3', function () {
    expect(app(DocumentArchiver::class))->toBeInstanceOf(PdfDocumentArchiver::class);
});

it('keeps the user behind a token in the event', function () {
    $user = User::factory()->create();
    $document = Document::factory()->create();

    $event = EventLog::record($document, Actor::token('42', $user->id), EventAction::Updated);

    expect($event->fresh()->actor_id)->toBe('42')
        ->and($event->fresh()->user_id)->toBe($user->id);
});
