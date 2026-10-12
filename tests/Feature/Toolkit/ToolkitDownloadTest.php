<?php

use App\Models\PersonalAccessToken;
use App\Models\Template;
use App\Models\User;
use App\Support\ApiTokens;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

const TOOLKIT_FOLDER = 'openbill-fjord-brief';

beforeEach(function () {
    $this->kitDir = fakeToolkit();
    $this->user = User::factory()->create();
    $this->template = Template::factory()->create([
        'name' => 'Fjord Brief',
        'slug' => 'fjord-brief',
        'header' => '<p>{{ org.name }}</p>',
        'body' => '<h1>{{ document.number }}</h1>',
        'manifest' => ['name' => 'Fjord Brief', 'version' => '1.0.0'],
    ]);
    $svg = '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"></svg>';
    Storage::disk('local')->put("templates/{$this->template->id}/assets/logo.svg", $svg);
    $this->template->assets()->create(['path' => 'assets/logo.svg', 'mime' => 'image/svg+xml', 'storage_path' => "templates/{$this->template->id}/assets/logo.svg", 'size' => strlen($svg)]);
});

afterEach(fn () => File::deleteDirectory($this->kitDir));

it('hands out the kit, the saved template, .env.local and .gitignore as one ZIP', function () {
    $response = $this->actingAs($this->user)
        ->post("https://openbill.example/en/templates/{$this->template->id}/toolkit")
        ->assertOk()
        ->assertHeader('Content-Type', 'application/zip')
        ->assertDownload('openbill-toolkit-fjord-brief.zip');
    $entries = zipEntries((string) $response->getContent());

    expect((string) $response->headers->get('Cache-Control'))->toContain('no-store')
        ->and(array_keys($entries))->toEqualCanonicalizing(array_map(fn (string $path): string => TOOLKIT_FOLDER.'/'.$path, [
            '.env.local', '.gitignore', 'README.md', 'assets/index.js', 'index.html', 'package.json', 'tooling/cli.js',
            'template/manifest.json', 'template/header.liquid', 'template/template.liquid', 'template/footer.liquid', 'template/styles.css', 'template/assets/logo.svg',
        ]))
        ->and($entries[TOOLKIT_FOLDER.'/template/template.liquid'])->toBe('<h1>{{ document.number }}</h1>')
        ->and($entries[TOOLKIT_FOLDER.'/template/header.liquid'])->toBe('<p>{{ org.name }}</p>')
        ->and(json_decode($entries[TOOLKIT_FOLDER.'/template/manifest.json'], true))->toMatchArray(['name' => 'Fjord Brief', 'version' => '1.0.0'])
        ->and($entries[TOOLKIT_FOLDER.'/template/assets/logo.svg'])->toContain('<svg')
        ->and($entries[TOOLKIT_FOLDER.'/.gitignore'])->toContain('.env.local')
        ->and(implode("\n", $entries))->not->toContain('leaked')->not->toContain('stale template');
});

it('creates a token for the signed-in user that previews and writes only this template', function () {
    $zip = $this->actingAs($this->user)->post("https://openbill.example/en/templates/{$this->template->id}/toolkit")->assertOk()->getContent();
    $env = envLocal(zipEntries((string) $zip)[TOOLKIT_FOLDER.'/.env.local']);
    $token = PersonalAccessToken::findToken($env['OPENBILL_TOKEN']);

    expect($env['OPENBILL_URL'])->toBe('https://openbill.example')
        ->and($env['OPENBILL_TEMPLATE_ID'])->toBe($this->template->id)
        ->and($token)->not->toBeNull()
        ->and($token->abilities)->toBe(['templates:render', 'templates:write'])
        ->and($token->template_id)->toBe($this->template->id)
        ->and($token->tokenable_id)->toBe($this->user->id)
        ->and($token->name)->toStartWith('Toolkit: Fjord Brief (')
        ->and($token->expires_at)->toBeNull()
        ->and(ApiTokens::row($token))->toMatchArray(['is_toolkit' => true, 'template_name' => 'Fjord Brief']);
});

it('makes a new token with every download and keeps the older ones', function () {
    $this->actingAs($this->user);
    $this->post("/en/templates/{$this->template->id}/toolkit")->assertOk();
    $this->post("/en/templates/{$this->template->id}/toolkit")->assertOk();

    expect(PersonalAccessToken::query()->where('template_id', $this->template->id)->count())->toBe(2);
});

it('refuses built-in templates (duplicate first) and creates no token', function () {
    $klar = Template::query()->where('slug', 'klar')->sole();

    $this->actingAs($this->user)->postJson("/en/templates/{$klar->id}/toolkit")
        ->assertStatus(409)
        ->assertHeader('Content-Type', 'application/problem+json')
        ->assertJsonPath('reason', 'template_built_in');
    expect(PersonalAccessToken::query()->count())->toBe(0);
});

it('answers 503 without a token when the kit was not built', function () {
    config(['openbill.toolkit.path' => $this->kitDir.'/missing']);

    $this->actingAs($this->user)->postJson("/de/templates/{$this->template->id}/toolkit")
        ->assertStatus(503)
        ->assertJsonPath('reason', 'toolkit_unavailable')
        ->assertJsonPath('detail', __('errors.toolkit_unavailable', [], 'de'));
    expect(PersonalAccessToken::query()->count())->toBe(0);
});

it('needs the session: guests and API tokens get 401, unknown templates 404', function () {
    $this->postJson("/en/templates/{$this->template->id}/toolkit")
        ->assertUnauthorized()
        ->assertHeader('Content-Type', 'application/problem+json');
    $this->withToken(apiToken(['api:write']))->postJson("/en/templates/{$this->template->id}/toolkit")->assertUnauthorized();

    forgetApiAuth();
    $this->actingAs($this->user)->postJson('/en/templates/'.strtolower((string) Str::ulid()).'/toolkit')->assertNotFound();
    expect(PersonalAccessToken::query()->where('template_id', $this->template->id)->count())->toBe(0);
});
