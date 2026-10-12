<?php

use App\Actions\IssueApiToken;
use App\Actions\SaveTaxRate;
use App\Actions\SaveTextBlock;
use App\Actions\SaveUnit;
use App\Actions\UpdateOrganization;
use App\Models\User;
use Illuminate\Validation\ValidationException;

it('stores names sent as JSON without surrounding blanks, free texts as typed (ledger phase 4)', function () {
    $rate = app(SaveTaxRate::class)->handle(systemActor(), ['label' => '  Reduziert 7 % ', 'percent' => '7.00', 'category' => 'S']);
    $unit = app(SaveUnit::class)->handle(systemActor(), ['name' => ' Pauschale ', 'symbol' => ' psch ', 'code' => ' LS ']);
    $block = app(SaveTextBlock::class)->handle(systemActor(), ['name' => '  Zahlungsziel ', 'kind' => 'closing', 'body' => "  Bitte zahlen.\n"]);
    $org = app(UpdateOrganization::class)->handle(systemActor(), ['name' => ' Studio Nordlicht ', 'city' => ' Hamburg ', 'email' => ' hallo@nordlicht.example ']);
    $token = app(IssueApiToken::class)->handle(systemActor(), User::factory()->create(), ['name' => ' Agent ', 'abilities' => ['api:read']]);

    expect($rate->label)->toBe('Reduziert 7 %')
        ->and([$unit->name, $unit->symbol, $unit->code])->toBe(['Pauschale', 'psch', 'LS'])
        ->and($block->name)->toBe('Zahlungsziel')
        ->and($block->body)->toBe("  Bitte zahlen.\n")
        ->and([$org->name, $org->city, $org->email])->toBe(['Studio Nordlicht', 'Hamburg', 'hallo@nordlicht.example'])
        ->and($token->accessToken->name)->toBe('Agent');
});

it('refuses names of blanks only', function () {
    expect(fn () => app(SaveTaxRate::class)->handle(systemActor(), ['label' => '   ', 'percent' => '7.00', 'category' => 'S']))->toThrow(ValidationException::class)
        ->and(fn () => app(SaveUnit::class)->handle(systemActor(), ['name' => '  ']))->toThrow(ValidationException::class)
        ->and(fn () => app(SaveTextBlock::class)->handle(systemActor(), ['name' => ' ', 'kind' => 'closing']))->toThrow(ValidationException::class)
        ->and(fn () => app(IssueApiToken::class)->handle(systemActor(), User::factory()->create(), ['name' => '  ', 'abilities' => ['api:read']]))->toThrow(ValidationException::class);
});
