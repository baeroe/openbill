<?php

use App\Actions\DeleteTemplate;
use App\Actions\RevokeApiToken;
use App\Models\PersonalAccessToken;
use App\Models\Template;
use App\Models\User;
use Illuminate\Support\Facades\File;

/*
 * Review focus 5 (master plan): the token of a toolkit download previews documents and reads and writes its own
 * template – nothing else. The token comes out of the real ZIP of POST /{locale}/templates/{id}/toolkit.
 */

/** Plain-text token in the .env.local of a toolkit download of $template (as $user, through the session). */
function toolkitToken(Template $template, User $user): string
{
    $zip = test()->actingAs($user)->post("/en/templates/{$template->id}/toolkit")->assertOk()->getContent();
    // the download ran in the session; every request after it must authenticate with the token alone
    forgetApiAuth();

    return envLocal(zipEntries((string) $zip)["openbill-{$template->slug}/.env.local"])['OPENBILL_TOKEN'];
}

/** Status of one request with only the toolkit token. */
function asToolkit(string $token, string $method, string $uri, array $body = []): int
{
    forgetApiAuth();

    return test()->withToken($token)->json($method, $uri, $body)->getStatusCode();
}

beforeEach(function () {
    $this->kitDir = fakeToolkit();
    $this->own = Template::factory()->create(['name' => 'Fjord Brief', 'slug' => 'fjord-brief']);
    $this->other = Template::factory()->create(['name' => 'Kulturwerk Elbinsel', 'slug' => 'kulturwerk', 'body' => '<p>Kulturwerk</p>']);
    $this->draft = draft();
    $this->token = toolkitToken($this->own, User::factory()->create());
});

afterEach(fn () => File::deleteDirectory($this->kitDir));

it('previews any document and reads and writes its own template', function () {
    $own = $this->own->id;
    $allowed = [
        ['POST', '/api/render', ['document_id' => $this->draft->id, 'template_id' => $own]],
        ['POST', '/api/render', ['scenario' => 'long_invoice', 'template_id' => $own, 'template' => ['body' => '<p>Fjord</p>']]],
        ['GET', '/api/render/sources'],
        ['GET', '/api/render/schema'],
        ['GET', "/api/templates/{$own}"],
        ['GET', "/api/templates/{$own}/package"],
        ['PUT', "/api/templates/{$own}/files", ['body' => '<h1>Fjord {{ document.number }}</h1>']],
    ];

    foreach ($allowed as $row) {
        [$method, $uri, $body] = [...$row, []];
        expect(asToolkit($this->token, $method, $uri, $body))->toBe(200, "{$method} {$uri}");
    }
    expect($this->own->fresh()->body)->toBe('<h1>Fjord {{ document.number }}</h1>');
});

it('refuses everything else with 403 and changes nothing', function () {
    [$own, $other, $doc] = [$this->own->id, $this->other->id, $this->draft->id];
    $draftBefore = $this->draft->fresh()->toArray();
    $templatesBefore = Template::query()->count();
    $denied = [
        ['PUT', "/api/templates/{$other}/files", ['body' => '<p>taken over</p>']],
        ['POST', '/api/render', ['scenario' => 'long_invoice', 'template_id' => $other]],
        ['POST', '/api/render', ['document_id' => $doc, 'template_id' => $other]],
        // without template_id the document's or the fallback template would render: a bound token must name its own
        ['POST', '/api/render', ['document_id' => $doc]],
        ['POST', '/api/render', ['scenario' => 'long_invoice']],
        ['POST', '/api/render', ['document_id' => $doc, 'template' => ['body' => '<p>Fjord</p>']]],
        ['GET', "/api/templates/{$other}"],
        ['GET', "/api/templates/{$other}/package"],
        ['GET', '/api/templates'],
        ['POST', '/api/templates'],
        ['POST', "/api/templates/{$own}/duplicate"],
        ['DELETE', "/api/templates/{$own}"],
        ['GET', '/api/documents'],
        ['GET', "/api/documents/{$doc}"],
        ['PATCH', "/api/documents/{$doc}", ['intro' => 'Hafenkontor Lindqvist']],
        ['POST', "/api/documents/{$doc}/finalize"],
        ['DELETE', "/api/documents/{$doc}"],
        ['GET', "/api/documents/{$doc}/pdf"],
        ['POST', '/api/customers', ['name' => 'Kulturwerk Elbinsel']],
        ['PATCH', '/api/organization', ['name' => 'Studio Nordlicht']],
        ['POST', '/api/field-definitions', ['scope' => 'document', 'key' => 'po_number', 'label' => 'PO', 'type' => 'text']],
        ['GET', '/api/tokens'],
        ['POST', '/api/tokens', ['name' => 'more', 'abilities' => ['api:write']]],
        ['POST', '/mcp', ['jsonrpc' => '2.0', 'id' => 1, 'method' => 'tools/list']],
    ];

    foreach ($denied as $row) {
        [$method, $uri, $body] = [...$row, []];
        expect(asToolkit($this->token, $method, $uri, $body))->toBe(403, "{$method} {$uri}");
    }
    expect($this->other->fresh()->body)->toBe('<p>Kulturwerk</p>')
        ->and(Template::query()->count())->toBe($templatesBefore)
        ->and($this->draft->fresh()->toArray())->toBe($draftBefore)
        ->and(PersonalAccessToken::query()->count())->toBe(1);
});

it('renders real documents with its own template', function () {
    $response = test()->withToken($this->token)->postJson('/api/render', ['document_id' => $this->draft->id, 'template_id' => $this->own->id, 'template' => ['body' => '<p id="fjord">Fjord {{ document.type_label }}</p>']]);

    $response->assertOk();
    expect((string) $response->json('body'))->toContain('id="fjord"');
});

it('cannot get more tokens: the download route only knows the session', function () {
    forgetApiAuth();

    $this->withToken($this->token)->postJson("/en/templates/{$this->own->id}/toolkit")->assertUnauthorized();
    expect(PersonalAccessToken::query()->count())->toBe(1);
});

it('stops working when revoked and disappears with its template', function () {
    expect(asToolkit($this->token, 'GET', '/api/render/schema'))->toBe(200);
    app(RevokeApiToken::class)->handle(systemActor(), PersonalAccessToken::findToken($this->token));
    expect(asToolkit($this->token, 'GET', '/api/render/schema'))->toBe(401);

    $second = toolkitToken($this->other, User::factory()->create());
    app(DeleteTemplate::class)->handle(systemActor(), $this->other->fresh());

    expect(PersonalAccessToken::findToken($second))->toBeNull()
        ->and(asToolkit($second, 'GET', '/api/render/schema'))->toBe(401);
});
