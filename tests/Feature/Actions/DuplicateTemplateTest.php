<?php

use App\Actions\DuplicateTemplate;
use App\Actions\UpdateTemplateFiles;
use App\Models\Template;
use Illuminate\Support\Facades\Storage;

it('copies a built-in template into an editable one with a free slug', function () {
    $klar = Template::query()->where('slug', 'klar')->sole();

    $first = app(DuplicateTemplate::class)->handle(systemActor(), $klar);
    $second = app(DuplicateTemplate::class)->handle(systemActor(), $klar);

    expect($first->id)->not->toBe($klar->id)
        ->and($first->built_in)->toBeFalse()
        ->and($first->name)->toBe('Klar (copy)')
        ->and($first->manifest['name'])->toBe('Klar (copy)')
        ->and($first->manifest['paper'])->toBe($klar->manifest['paper'])
        ->and($first->body)->toBe($klar->body)
        ->and($first->css)->toBe($klar->css)
        ->and($first->slug)->toBe('klar-copy')
        ->and($second->slug)->toBe('klar-copy-2');
});

it('copies the assets into the folder of the copy', function () {
    $template = Template::factory()->create(['name' => 'Fjord', 'slug' => 'fjord']);
    $svg = '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"></svg>';
    app(UpdateTemplateFiles::class)->handle(systemActor(), $template, ['assets' => ['assets/logo.svg' => base64_encode($svg)]]);

    $copy = app(DuplicateTemplate::class)->handle(systemActor(), $template->fresh());
    $asset = $copy->assets()->sole();

    expect($asset->path)->toBe('assets/logo.svg')
        ->and($asset->storage_path)->toStartWith("templates/{$copy->id}/")
        ->and(Storage::disk('local')->get($asset->storage_path))->toBe($svg);

    Storage::disk('local')->deleteDirectory("templates/{$template->id}");
    expect(Storage::disk('local')->get($asset->storage_path))->toBe($svg);
});

it('names the copy in the language of the request and keeps the manifest limit of 100 characters', function () {
    app()->setLocale('de');
    $template = Template::factory()->create(['name' => str_repeat('N', 100), 'manifest' => ['name' => str_repeat('N', 100), 'version' => '1.0.0']]);

    $copy = app(DuplicateTemplate::class)->handle(systemActor(), $template);

    expect(mb_strlen($copy->name))->toBe(100)
        ->and($copy->manifest['name'])->toBe($copy->name);
    expect(app(DuplicateTemplate::class)->handle(systemActor(), Template::query()->where('slug', 'kante')->sole())->name)->toBe('Kante (Kopie)');
});
