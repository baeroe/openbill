<?php

use App\Enums\ActorType;
use App\Enums\ComplianceProfile;
use App\Enums\DocumentFileKind;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\EventAction;
use App\Enums\FieldScope;
use App\Enums\FieldType;
use App\Enums\PositionKind;
use App\Enums\RenderPart;
use App\Enums\TaxationMode;
use App\Enums\TaxCategory;
use App\Enums\TaxTreatment;
use App\Enums\TextBlockKind;

it('uses the exact values from the spec', function (string $enum, array $values) {
    expect(array_map(fn (BackedEnum $case): string|int => $case->value, $enum::cases()))->toBe($values);
})->with([
    'document types' => [DocumentType::class, ['offer', 'confirmation', 'invoice', 'cancellation']],
    'statuses' => [DocumentStatus::class, ['draft', 'open', 'accepted', 'rejected', 'done', 'paid', 'cancelled', 'closed']],
    'position kinds' => [PositionKind::class, ['item', 'text', 'optional']],
    'field scopes' => [FieldScope::class, ['org', 'customer', 'contact', 'document', 'position']],
    'field types' => [FieldType::class, ['text', 'textarea', 'number', 'money', 'date', 'select', 'boolean', 'image']],
    'tax categories' => [TaxCategory::class, ['S', 'Z', 'E', 'AE', 'K', 'G']],
    'taxation modes' => [TaxationMode::class, ['regular', 'small_business']],
    'tax treatments' => [TaxTreatment::class, ['domestic', 'eu_reverse_charge', 'third_country']],
    'profiles' => [ComplianceProfile::class, ['basic', 'en16931']],
    'text block kinds' => [TextBlockKind::class, ['intro', 'closing', 'payment', 'note']],
    'actor types' => [ActorType::class, ['user', 'token', 'system']],
    'event actions' => [EventAction::class, ['created', 'updated', 'finalized', 'status_changed', 'converted', 'converted_from', 'cancelled', 'duplicated', 'deleted']],
    'file kinds' => [DocumentFileKind::class, ['pdf', 'xml']],
    'render parts' => [RenderPart::class, ['header', 'body', 'footer', 'css', 'manifest', 'intro', 'closing']],
]);
