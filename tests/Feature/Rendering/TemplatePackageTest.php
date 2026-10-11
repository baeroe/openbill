<?php

use App\Actions\ExportTemplatePackage;
use App\Actions\ImportTemplatePackage;
use App\Models\Template;
use App\Rendering\ManifestValidator;
use App\Rendering\TemplatePackage;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/** @param  array<string, string>  $files */
function zipOf(array $files): string
{
    $path = (string) tempnam(sys_get_temp_dir(), 'openbill-test-');
    $zip = new ZipArchive;
    $zip->open($path, ZipArchive::OVERWRITE);
    foreach ($files as $name => $contents) {
        $zip->addFromString($name, $contents);
    }
    $zip->close();

    return $path;
}

/** @return array<string, string> */
function packageFiles(array $manifest = [], array $extra = []): array
{
    return [
        'manifest.json' => json_encode([
            'name' => 'Nordlicht Brief', 'version' => '1.2.0', 'author' => 'Studio Nordlicht', 'license' => 'MIT',
            'description' => 'Briefbogen', 'documentTypes' => ['invoice'],
            'expectedFields' => [['scope' => 'document', 'key' => 'project_name', 'type' => 'text', 'fallback' => '']],
            'paper' => ['format' => 'A4', 'marginX' => '20mm', 'headerHeight' => '30mm', 'footerHeight' => '20mm'],
            ...$manifest,
        ]),
        'template.liquid' => '<h1>{{ document.number }}</h1><img src="assets/logo.svg">',
        'header.liquid' => '<b>{{ org.name }}</b>',
        'footer.liquid' => '{{ page.number }}',
        'styles.css' => 'h1 { font-size: 14pt; }',
        'assets/logo.svg' => '<svg xmlns="http://www.w3.org/2000/svg"/>',
        ...$extra,
    ];
}

function importErrors(string $zipPath): array
{
    try {
        app(ImportTemplatePackage::class)->handle(systemActor(), $zipPath);
    } catch (ValidationException $e) {
        return $e->errors();
    }

    return [];
}

it('imports a package with its assets as a new template', function () {
    $template = app(ImportTemplatePackage::class)->handle(systemActor(), zipOf(packageFiles()));

    expect($template->only(['name', 'slug', 'version', 'author', 'license', 'description', 'built_in']))->toBe([
        'name' => 'Nordlicht Brief', 'slug' => 'nordlicht-brief', 'version' => '1.2.0', 'author' => 'Studio Nordlicht',
        'license' => 'MIT', 'description' => 'Briefbogen', 'built_in' => false,
    ])
        ->and($template->body)->toContain('<h1>')
        ->and($template->css)->toBe('h1 { font-size: 14pt; }')
        ->and($template->manifest['paper']['format'])->toBe('A4')
        ->and($template->assets->pluck('path')->all())->toBe(['assets/logo.svg'])
        ->and($template->assets->first()->mime)->toBe('image/svg+xml');

    Storage::disk('local')->assertExists($template->assets->first()->storage_path);
});

it('accepts a zipped folder and ignores macOS metadata', function () {
    $files = [];
    foreach (packageFiles() as $name => $contents) {
        $files["nordlicht/{$name}"] = $contents;
    }
    $files['__MACOSX/nordlicht/._template.liquid'] = 'x';
    $files['nordlicht/.DS_Store'] = 'x';

    expect(app(ImportTemplatePackage::class)->handle(systemActor(), zipOf($files))->slug)->toBe('nordlicht-brief');
});

it('gives imported templates a free slug and never takes a built-in one', function () {
    $first = app(ImportTemplatePackage::class)->handle(systemActor(), zipOf(packageFiles()));
    $second = app(ImportTemplatePackage::class)->handle(systemActor(), zipOf(packageFiles()));
    $klar = app(ImportTemplatePackage::class)->handle(systemActor(), zipOf(packageFiles(['name' => 'Klar'])));

    expect([$first->slug, $second->slug, $klar->slug])->toBe(['nordlicht-brief', 'nordlicht-brief-2', 'klar-2']);
});

it('refuses unsafe or broken packages with a path and creates nothing', function (array $files, string $key) {
    expect(importErrors(zipOf($files)))->toHaveKey($key)
        ->and(Template::query()->where('built_in', false)->count())->toBe(0);
})->with([
    'path traversal' => [packageFiles([], ['../evil.liquid' => 'x']), 'package'],
    'absolute path' => [packageFiles([], ['/etc/passwd' => 'x']), 'package'],
    'unknown file' => [packageFiles([], ['run.php' => '<?php']), 'package'],
    'executable asset' => [packageFiles([], ['assets/tool.exe' => 'MZ']), 'assets.assets/tool.exe'],
    'missing template' => [array_diff_key(packageFiles(), ['template.liquid' => true]), 'package'],
    'missing manifest' => [array_diff_key(packageFiles(), ['manifest.json' => true]), 'package'],
    'broken json' => [[...packageFiles(), 'manifest.json' => '{'], 'manifest'],
    'bad version' => [packageFiles(['version' => 'latest']), 'manifest.version'],
    'bad paper' => [packageFiles(['paper' => ['format' => 'A3']]), 'manifest.paper.format'],
    'bad document type' => [packageFiles(['documentTypes' => ['receipt']]), 'manifest.documentTypes'],
    'no name' => [packageFiles(['name' => '']), 'manifest.name'],
]);

it('refuses a file that is no ZIP and a ZIP bomb', function () {
    $notZip = (string) tempnam(sys_get_temp_dir(), 'openbill-test-');
    file_put_contents($notZip, 'plain text');
    config(['openbill.templates.max_unpacked_bytes' => 1024]);

    expect(importErrors($notZip))->toHaveKey('package')
        ->and(importErrors(zipOf(packageFiles([], ['assets/big.png' => str_repeat('0', 4096)]))))->toHaveKey('package');
});

it('exports a template as a package that imports to the same template', function () {
    $original = app(ImportTemplatePackage::class)->handle(systemActor(), zipOf(packageFiles()));

    $download = app(ExportTemplatePackage::class)->handle(systemActor(), $original);
    $path = (string) tempnam(sys_get_temp_dir(), 'openbill-test-');
    file_put_contents($path, $download->contents);
    $copy = app(ImportTemplatePackage::class)->handle(systemActor(), $path);

    expect($download->filename)->toBe('nordlicht-brief-1.2.0.zip')
        ->and($download->mimeType)->toBe('application/zip')
        ->and($copy->only(['name', 'version', 'header', 'body', 'footer', 'css']))->toBe($original->only(['name', 'version', 'header', 'body', 'footer', 'css']))
        ->and($copy->manifest)->toBe($original->manifest)
        ->and(Storage::disk('local')->get($copy->assets->first()->storage_path))->toBe('<svg xmlns="http://www.w3.org/2000/svg"/>');
});

it('validates manifests field by field', function () {
    expect(ManifestValidator::validate(json_decode(packageFiles()['manifest.json'], true)))->toBe([])
        ->and(array_keys(ManifestValidator::validate(['name' => 'X', 'version' => '1.0.0', 'expectedFields' => [['key' => 'x']], 'translations' => ['fr' => ['a' => 'b']]])))
        ->toBe(['expectedFields.0', 'translations'])
        ->and(ManifestValidator::validate('nope'))->toHaveKey('manifest');
});

it('reads a package from a directory', function () {
    $dir = sys_get_temp_dir().'/openbill-package-'.uniqid();
    mkdir("{$dir}/assets", 0777, true);
    foreach (packageFiles() as $name => $contents) {
        file_put_contents("{$dir}/{$name}", $contents);
    }

    $package = TemplatePackage::fromDirectory($dir);

    expect($package->manifest['name'])->toBe('Nordlicht Brief')
        ->and($package->body)->toContain('<h1>')
        ->and($package->assets)->toBe(['assets/logo.svg' => '<svg xmlns="http://www.w3.org/2000/svg"/>']);
});
