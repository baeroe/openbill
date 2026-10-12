<?php

use App\Exceptions\ToolkitUnavailableException;
use App\Rendering\TemplatePackage;
use App\Rendering\ToolkitPackage;
use Illuminate\Support\Facades\File;

afterEach(function () {
    if (isset($this->kitDir)) {
        File::deleteDirectory($this->kitDir);
    }
});

it('lists the package files in the order of the ZIP', function () {
    $package = new TemplatePackage(['name' => 'Fjord Brief', 'version' => '1.0.0'], 'h', 'b', 'f', 'c', ['assets/logo.svg' => '<svg/>']);

    expect(array_keys($package->files()))->toBe(['manifest.json', 'header.liquid', 'template.liquid', 'footer.liquid', 'styles.css', 'assets/logo.svg'])
        ->and($package->files()['template.liquid'])->toBe('b')
        ->and(json_decode($package->files()['manifest.json'], true))->toBe(['name' => 'Fjord Brief', 'version' => '1.0.0']);
});

it('reads the built kit without template, installs, secrets and symbolic links', function () {
    $this->kitDir = fakeToolkit();

    expect(array_keys(ToolkitPackage::readKit($this->kitDir)))->toBe(['README.md', 'assets/index.js', 'index.html', 'package.json', 'tooling/cli.js']);
});

it('refuses a folder without a built kit', function (string $missing) {
    $this->kitDir = fakeToolkit();
    File::delete("{$this->kitDir}/{$missing}");

    ToolkitPackage::readKit($this->kitDir);
})->with(['package.json', 'tooling/cli.js'])->throws(ToolkitUnavailableException::class);

it('puts kit, template, .env.local and .gitignore into one folder of the ZIP', function () {
    $template = new TemplatePackage(['name' => 'Fjord Brief', 'version' => '1.0.0'], '<p>head</p>', '<h1>body</h1>', '', 'h1 {}', ['assets/logo.svg' => '<svg xmlns="http://www.w3.org/2000/svg"></svg>']);
    $env = ['OPENBILL_URL' => 'https://openbill.example', 'OPENBILL_TOKEN' => '7|openbill_secret', 'OPENBILL_TEMPLATE_ID' => '01kfjordbrief'];

    $entries = zipEntries((new ToolkitPackage(['package.json' => '{}', 'tooling/cli.js' => '// cli'], $template, $env))->toZip('openbill-fjord'));

    expect(array_keys($entries))->toEqualCanonicalizing([
        'openbill-fjord/.env.local', 'openbill-fjord/.gitignore', 'openbill-fjord/package.json', 'openbill-fjord/tooling/cli.js',
        'openbill-fjord/template/manifest.json', 'openbill-fjord/template/header.liquid', 'openbill-fjord/template/template.liquid',
        'openbill-fjord/template/footer.liquid', 'openbill-fjord/template/styles.css', 'openbill-fjord/template/assets/logo.svg',
    ])
        ->and($entries['openbill-fjord/template/template.liquid'])->toBe('<h1>body</h1>')
        ->and(envLocal($entries['openbill-fjord/.env.local']))->toBe($env)
        ->and($entries['openbill-fjord/.env.local'])->toStartWith('#')
        ->and($entries['openbill-fjord/.gitignore'])->toContain(".env.local\n")->toContain("node_modules/\n");
});

it('never writes a value that would break .env.local', function (string $value) {
    ToolkitPackage::envFile(['OPENBILL_URL' => $value]);
})->with(["https://openbill.example\nOPENBILL_TOKEN=evil", 'https://openbill.example"', 'C:\\openbill'])->throws(RuntimeException::class);
