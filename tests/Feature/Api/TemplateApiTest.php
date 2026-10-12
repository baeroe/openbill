<?php

use App\Models\Document;
use App\Models\Template;
use App\Rendering\TemplatePackage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(fn () => $this->withToken(apiToken()));

function kanteZip(): string
{
    return TemplatePackage::fromDirectory(resource_path('templates/kante'))->toZip();
}

it('lists the templates without their sources and shows one with everything', function () {
    $list = $this->getJson('/api/templates')->assertOk()->assertJsonMissingPath('0.body')->json();
    expect(collect($list)->pluck('slug')->all())->toContain('klar', 'kante', 'leise');

    $klar = Template::query()->where('slug', 'klar')->sole();
    $this->getJson("/api/templates/{$klar->id}")
        ->assertOk()
        ->assertJsonPath('built_in', true)
        ->assertJsonPath('manifest.name', 'Klar')
        ->assertJsonPath('body', $klar->body);
});

it('imports a template package as multipart upload', function () {
    $this->post('/api/templates', ['package' => UploadedFile::fake()->createWithContent('kante.zip', kanteZip())], ['Accept' => 'application/json'])
        ->assertCreated()
        ->assertJsonPath('slug', 'kante-2')
        ->assertJsonPath('built_in', false);

    $this->post('/api/templates', ['package' => UploadedFile::fake()->createWithContent('broken.zip', 'not a zip')], ['Accept' => 'application/json'])
        ->assertUnprocessable()
        ->assertJsonPath('violations.0.path', 'package');
    $this->post('/api/templates', [], ['Accept' => 'application/json'])
        ->assertUnprocessable()
        ->assertJsonPath('violations.0.path', 'package');
});

it('writes template files, manifest and assets and cleans up the old assets', function () {
    $template = Template::factory()->create(['name' => 'Fjord', 'slug' => 'fjord']);
    $svg = '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"></svg>';

    $first = $this->putJson("/api/templates/{$template->id}/files", [
        'body' => '<h1>{{ document.number }}</h1>',
        'manifest' => ['name' => 'Fjord', 'version' => '1.1.0', 'description' => 'Calm'],
        'assets' => ['assets/logo.svg' => base64_encode($svg)],
    ])
        ->assertOk()
        ->assertJsonPath('version', '1.1.0')
        ->assertJsonPath('description', 'Calm')
        ->assertJsonPath('body', '<h1>{{ document.number }}</h1>')
        ->assertJsonPath('assets', [['path' => 'assets/logo.svg', 'mime' => 'image/svg+xml', 'size' => strlen($svg)]]);
    $oldFile = $template->assets()->sole()->storage_path;
    expect(Storage::disk('local')->get($oldFile))->toBe($svg);

    $this->putJson("/api/templates/{$template->id}/files", ['assets' => []])->assertOk()->assertJsonPath('assets', []);
    expect(Storage::disk('local')->exists($oldFile))->toBeFalse()
        ->and($first->json('header'))->toBe((string) $template->header);
});

it('refuses broken files with their paths and changes nothing', function () {
    $template = Template::factory()->create();

    $response = $this->putJson("/api/templates/{$template->id}/files", [
        'manifest' => ['name' => '', 'version' => 'one'],
        'assets' => ['assets/../evil.svg' => base64_encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), 'assets/x.png' => 'no base64 !'],
    ])->assertUnprocessable();

    expect(collect($response->json('violations'))->pluck('path')->all())
        ->toEqualCanonicalizing(['manifest.name', 'manifest.version', 'assets.assets/../evil.svg', 'assets.assets/x.png'])
        ->and($template->fresh()->version)->toBe($template->version);
});

it('keeps built-in templates read-only', function () {
    $klar = Template::query()->where('slug', 'klar')->sole();

    $this->putJson("/api/templates/{$klar->id}/files", ['body' => 'x'])->assertStatus(409)->assertJsonPath('reason', 'template_built_in');
    $this->deleteJson("/api/templates/{$klar->id}")->assertStatus(409)->assertJsonPath('reason', 'template_built_in');
});

it('deletes an unused template with its files and refuses one in use', function () {
    $this->post('/api/templates', ['package' => UploadedFile::fake()->createWithContent('kante.zip', kanteZip())], ['Accept' => 'application/json'])->assertCreated();
    $imported = Template::query()->where('slug', 'kante-2')->sole();
    Storage::disk('local')->put("templates/{$imported->id}/assets/extra.svg", '<svg xmlns="http://www.w3.org/2000/svg"></svg>');

    $this->deleteJson("/api/templates/{$imported->id}")->assertNoContent();
    expect(Template::query()->find($imported->id))->toBeNull()
        ->and(Storage::disk('local')->allFiles("templates/{$imported->id}"))->toBe([]);

    $used = Template::factory()->create();
    draft(input: ['template_id' => $used->id]);
    $this->deleteJson("/api/templates/{$used->id}")->assertStatus(409)->assertJsonPath('reason', 'template_in_use');
    expect(Document::query()->where('template_id', $used->id)->count())->toBe(1);
});

it('downloads the template package as ZIP', function () {
    $klar = Template::query()->where('slug', 'klar')->sole();

    $response = $this->get("/api/templates/{$klar->id}/package")
        ->assertOk()
        ->assertHeader('Content-Type', 'application/zip')
        ->assertHeader('Content-Disposition', 'attachment; filename=klar-'.$klar->version.'.zip');

    $path = sys_get_temp_dir().'/openbill-test-'.bin2hex(random_bytes(6)).'.zip';
    file_put_contents($path, $response->getContent());
    $zip = new ZipArchive;
    $zip->open($path);
    expect($zip->getFromName('template.liquid'))->toBe($klar->body);
    $zip->close();
    unlink($path);
});

it('lists the document types of every template', function () {
    $list = collect($this->getJson('/api/templates')->assertOk()->json())->keyBy('slug');

    expect($list['klar']['document_types'])->toBe(['offer', 'confirmation', 'invoice', 'cancellation']);
});

it('duplicates a template over the API in the language of the request', function () {
    $klar = Template::query()->where('slug', 'klar')->sole();

    $this->postJson("/api/templates/{$klar->id}/duplicate", [], ['Accept-Language' => 'de'])
        ->assertCreated()
        ->assertJsonPath('name', 'Klar (Kopie)')
        ->assertJsonPath('built_in', false)
        ->assertJsonPath('manifest.name', 'Klar (Kopie)');
});
