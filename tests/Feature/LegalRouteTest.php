<?php

use App\Actions\CreateDocument;
use App\Actions\FinalizeDocument;
use App\Enums\DocumentFileKind;
use App\Mcp\Tools\GetDocumentTool;
use App\Models\Customer;
use App\Models\Document;
use App\Support\LegalLinks;
use App\Support\TextDocuments;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

function legalText(array $input = [], bool $finalize = true): Document
{
    $document = app(CreateDocument::class)->handle(systemActor(), ['type' => 'text', 'title' => 'Terms', 'body' => 'Terms text', 'slug' => 'agb', 'is_public' => true, ...$input]);

    return $finalize ? app(FinalizeDocument::class)->handle(systemActor(), $document) : $document;
}

it('serves the newest public version of a short name as an inline PDF', function () {
    $first = legalText();
    $second = legalText();

    $response = $this->get('/legal/agb');

    $response->assertOk()
        ->assertHeader('Content-Type', 'application/pdf')
        ->assertHeader('X-Content-Type-Options', 'nosniff');
    expect($response->headers->get('Content-Disposition'))->toContain('inline')->toContain("agb-{$second->number}.pdf")
        ->and($response->headers->get('Cache-Control'))->toContain('no-cache')
        ->and($response->headers->get('Set-Cookie'))->toBeNull()
        ->and($first->number)->not->toBe($second->number);
});

it('keeps an older version reachable under its number, immutable', function () {
    $first = legalText();
    legalText();

    $response = $this->get("/legal/agb/{$first->number}");

    $response->assertOk()->assertHeader('Content-Type', 'application/pdf');
    expect($response->headers->get('Cache-Control'))->toContain('max-age=31536000')->toContain('immutable')->toContain('public')
        ->and($response->headers->get('Content-Disposition'))->toContain("agb-{$first->number}.pdf");
    expect($response->getContent())->toStartWith('%PDF');
});

it('answers 404 when the newest version is not public (withdrawn), older public ones stay', function () {
    $old = legalText();
    legalText(['is_public' => false]);

    $this->get('/legal/agb')->assertNotFound();
    $this->get("/legal/agb/{$old->number}")->assertOk();
});

it('answers the same 404 for everything that is not a public finalized text without customer', function (callable $setup, string $url) {
    $setup();

    $this->get($url)->assertNotFound();
    expect($this->get($url)->headers->get('Content-Type'))->not->toContain('pdf');
})->with([
    'draft' => [fn () => legalText(finalize: false), '/legal/agb'],
    'not public' => [fn () => legalText(['is_public' => false]), '/legal/agb'],
    'with customer' => [fn () => legalText(['customer_id' => Customer::factory()->create()->id, 'is_public' => false]), '/legal/agb'],
    'unknown slug' => [fn () => legalText(), '/legal/other'],
    'unknown number' => [fn () => legalText(), '/legal/agb/T-1999-0001'],
    'invalid slug' => [fn () => legalText(), '/legal/AGB'],
    'other type' => [fn () => draft(), '/legal/agb'],
]);

it('never shows a customer version, even when it is the only one marked public in the database', function () {
    $document = legalText(['customer_id' => Customer::factory()->create()->id, 'is_public' => false]);
    // public flag with a customer is a compliance issue for a draft; force the combination to prove the route's own rule
    DB::statement('SET @openbill_unlock = 1');
    DB::table('documents')->where('id', $document->id)->update(['is_public' => true]);
    DB::statement('SET @openbill_unlock = 0');

    $this->get('/legal/agb')->assertNotFound();
    $this->get("/legal/agb/{$document->number}")->assertNotFound();
});

it('does not take a customer version as the newest one', function () {
    $public = legalText();
    legalText(['customer_id' => Customer::factory()->create()->id, 'is_public' => false]);

    expect(TextDocuments::latest('agb')?->id)->toBe($public->id);
    $this->get('/legal/agb')->assertOk();
});

it('answers 500 when the archive file does not match its SHA-256', function () {
    $document = legalText();
    $file = $document->files()->where('kind', DocumentFileKind::Pdf)->firstOrFail();
    Storage::disk('archive')->put($file->path, 'tampered');

    $this->get('/legal/agb')->assertStatus(500);
});

it('throttles to 60 requests a minute', function () {
    legalText();

    foreach (range(1, 60) as $i) {
        $this->get('/legal/unknown')->assertNotFound();
    }
    $this->get('/legal/unknown')->assertStatus(429);
});

it('builds links on the configured address, not on the host of the request', function () {
    config(['app.url' => 'https://docs.example.com/']);
    $document = legalText();

    expect(LegalLinks::latest('agb'))->toBe('https://docs.example.com/legal/agb')
        ->and(LegalLinks::version('agb', 'T-2026-0001'))->toBe('https://docs.example.com/legal/agb/T-2026-0001')
        ->and(LegalLinks::versionOf($document))->toBe("https://docs.example.com/legal/agb/{$document->number}")
        ->and(LegalLinks::latestOf(draft()))->toBeNull();
});

it('puts public_url into the document of the API and MCP, only for finalized public texts', function () {
    $draft = legalText(finalize: false);
    $done = legalText();
    $private = legalText(['slug' => 'intern', 'is_public' => false]);

    $this->withToken(apiToken())->getJson("/api/documents/{$done->id}")->assertOk()
        ->assertJsonPath('public_url', url("/legal/agb/{$done->number}"))
        ->assertJsonPath('public_latest_url', url('/legal/agb'));
    $this->getJson("/api/documents/{$draft->id}")->assertOk()->assertJsonPath('public_url', null);
    $this->getJson("/api/documents/{$private->id}")->assertOk()->assertJsonPath('public_url', null);
    expect(mcpJson(mcpTool(GetDocumentTool::class, ['id' => $done->id]))['public_url'])->toBe(url("/legal/agb/{$done->number}"));
});

it('does not use up the login and invitation limits of the same address', function () {
    foreach (range(1, 25) as $i) {
        $this->get('/legal/unknown')->assertNotFound();
    }

    // POST /en/invitations/... and /en/login are throttled 10 and 20 a minute: the legal requests must not count there
    $this->post('/en/login', ['email' => 'nobody@example.com', 'password' => 'x'])->assertStatus(302)->assertSessionHasErrors();
});
