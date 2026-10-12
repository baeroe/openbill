<?php

use App\Actions\PreviewDocumentNumber;
use App\Enums\DocumentType;

beforeEach(fn () => $this->travelTo('2026-10-12 10:00:00'));

it('formats an unsaved pattern with the given or the current next value', function () {
    $preview = app(PreviewDocumentNumber::class);

    expect($preview->handle(systemActor(), DocumentType::Invoice, ['pattern' => 'RE-{YY}{MM}-{00000}', 'reset_yearly' => '1', 'next_value' => '42']))
        ->toBe(['number' => 'RE-2610-00042', 'valid' => true, 'message' => null])
        ->and($preview->handle(systemActor(), DocumentType::Offer, ['pattern' => 'Q-{YYYY}-{0000}'])['number'])->toBe('Q-2026-0001');
});

it('explains invalid patterns instead of formatting them', function (array $input, string $text) {
    $result = app(PreviewDocumentNumber::class)->handle(systemActor(), DocumentType::Invoice, $input);

    expect($result['valid'])->toBeFalse()
        ->and($result['number'])->toBeNull()
        ->and($result['message'])->toContain($text);
})->with([
    'no running number' => [['pattern' => 'RE-{YYYY}'], '{0000}'],
    'yearly reset without year' => [['pattern' => 'RE-{0000}', 'reset_yearly' => '1'], '{YYYY}'],
]);

it('answers over the API and 404 for unknown types', function () {
    $this->withToken(apiToken(['api:read']));

    $this->getJson('/api/document-types/invoice/number-preview?pattern=INV-{YYYY}-{0000}&reset_yearly=1&next_value=7')
        ->assertOk()
        ->assertJsonPath('number', 'INV-2026-0007');
    $this->getJson('/api/document-types/invoice/number-preview')->assertUnprocessable()->assertJsonPath('violations.0.path', 'pattern');
    $this->getJson('/api/document-types/receipt/number-preview?pattern=X-{0}')->assertNotFound();
});
