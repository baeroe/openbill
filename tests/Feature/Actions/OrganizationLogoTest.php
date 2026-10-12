<?php

use App\Actions\RenderPreview;
use App\Models\Organization;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

const LOGO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="10"><rect width="40" height="10" fill="#2f55d4"/></svg>';

beforeEach(fn () => $this->withToken(apiToken()));

it('uploads, serves and removes the logo', function () {
    $this->post('/api/organization/logo', ['logo' => UploadedFile::fake()->createWithContent('logo.svg', LOGO_SVG)], ['Accept' => 'application/json'])
        ->assertOk()
        ->assertJsonPath('has_logo', true);

    $path = Organization::current()->logo_path;
    expect($path)->toMatch('#^logos/[0-9a-z]{26}\.svg$#')
        ->and(Storage::disk('local')->get($path))->toBe(LOGO_SVG);
    $this->getJson('/api/organization')->assertJsonPath('has_logo', true);

    $file = $this->get('/api/organization/logo')->assertOk();
    expect($file->getContent())->toBe(LOGO_SVG)
        ->and($file->headers->get('Content-Type'))->toBe('image/svg+xml')
        ->and($file->headers->get('Content-Security-Policy'))->toContain('sandbox');

    $this->deleteJson('/api/organization/logo')->assertNoContent();
    $this->getJson('/api/organization')->assertJsonPath('has_logo', false);
    $this->get('/api/organization/logo')->assertNotFound();
    // finalized documents may point at the old file through their snapshot: it stays
    expect(Storage::disk('local')->exists($path))->toBeTrue();
});

it('puts the logo into templates as data URL', function () {
    $this->post('/api/organization/logo', ['logo' => UploadedFile::fake()->createWithContent('logo.svg', LOGO_SVG)], ['Accept' => 'application/json'])->assertOk();

    $body = app(RenderPreview::class)->handle(systemActor(), ['scenario' => 'short_invoice', 'template' => ['body' => '<img src="{{ org.logo }}">']])->render->body;

    expect($body)->toContain('src="data:image/svg+xml;base64,'.base64_encode(LOGO_SVG).'"');
});

it('refuses non-images and keeps the old logo (review focus)', function () {
    $this->post('/api/organization/logo', ['logo' => UploadedFile::fake()->createWithContent('logo.svg', LOGO_SVG)], ['Accept' => 'application/json'])->assertOk();
    $before = Organization::current()->logo_path;

    $this->post('/api/organization/logo', ['logo' => UploadedFile::fake()->createWithContent('logo.png', 'not an image')], ['Accept' => 'application/json'])
        ->assertUnprocessable()
        ->assertJsonPath('violations.0.path', 'logo');
    $this->post('/api/organization/logo', [], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonPath('violations.0.path', 'logo');

    expect(Organization::current()->logo_path)->toBe($before);
});
