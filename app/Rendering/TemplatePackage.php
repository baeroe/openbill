<?php

namespace App\Rendering;

use App\Models\Template;
use App\Support\Text;
use finfo;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use JsonException;
use RuntimeException;
use ZipArchive;

/**
 * Template package: manifest.json, template.liquid, header.liquid, footer.liquid, styles.css, assets/…
 * Read from a ZIP (import, untrusted: paths, types and sizes are checked) or a directory (built-ins).
 */
final readonly class TemplatePackage
{
    /** Template column => file in the package. */
    public const FILES = ['header' => 'header.liquid', 'body' => 'template.liquid', 'footer' => 'footer.liquid', 'css' => 'styles.css'];

    /** Allowed asset types by extension. */
    public const ASSET_TYPES = [
        'png' => 'image/png', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'gif' => 'image/gif', 'webp' => 'image/webp',
        'svg' => 'image/svg+xml', 'woff' => 'font/woff', 'woff2' => 'font/woff2', 'ttf' => 'font/ttf', 'otf' => 'font/otf',
    ];

    /**
     * @param  array<string, mixed>  $manifest
     * @param  array<string, string>  $assets  package path ("assets/logo.svg") => contents
     */
    public function __construct(
        public array $manifest,
        public string $header,
        public string $body,
        public string $footer,
        public string $css,
        public array $assets = [],
    ) {}

    /**
     * MIME types finfo may report for an allowed extension (content check of untrusted assets).
     *
     * @var array<string, list<string>>
     */
    private const ASSET_CONTENT = [
        'png' => ['image/png'], 'jpg' => ['image/jpeg'], 'jpeg' => ['image/jpeg'], 'gif' => ['image/gif'], 'webp' => ['image/webp'],
        'svg' => ['image/svg+xml', 'text/xml', 'application/xml', 'text/plain', 'text/html'],
        'woff' => ['font/woff', 'application/font-woff'], 'woff2' => ['font/woff2', 'application/font-woff2'],
        'ttf' => ['font/ttf', 'font/sfnt', 'application/font-sfnt', 'application/x-font-ttf'],
        'otf' => ['font/otf', 'font/sfnt', 'application/font-sfnt', 'application/vnd.ms-opentype'],
    ];

    /** Trusted source (resources/templates/<slug>). */
    public static function fromDirectory(string $dir): self
    {
        $read = fn (string $file): string => is_file("{$dir}/{$file}") ? (string) file_get_contents("{$dir}/{$file}") : '';
        $assets = [];
        foreach (glob("{$dir}/assets/*") ?: [] as $file) {
            $assets['assets/'.basename($file)] = (string) file_get_contents($file);
        }

        return new self(
            json_decode($read('manifest.json'), true, flags: JSON_THROW_ON_ERROR),
            $read(self::FILES['header']),
            $read(self::FILES['body']),
            $read(self::FILES['footer']),
            $read(self::FILES['css']),
            $assets,
        );
    }

    /**
     * Untrusted ZIP upload.
     *
     * @throws ValidationException
     */
    public static function fromZip(string $path): self
    {
        $limits = config('openbill.templates');
        if (! is_file($path) || filesize($path) > $limits['max_package_bytes']) {
            self::fail('package', 'template_package.too_large', ['mb' => intdiv($limits['max_package_bytes'], 1024 * 1024)]);
        }
        $zip = new ZipArchive;
        if ($zip->open($path, ZipArchive::RDONLY) !== true) {
            self::fail('package', 'template_package.not_a_zip');
        }

        try {
            if ($zip->numFiles > $limits['max_entries']) {
                self::fail('package', 'template_package.too_many_files', ['max' => $limits['max_entries']]);
            }

            $entries = [];
            $unpacked = 0;
            for ($i = 0; $i < $zip->numFiles; $i++) {
                $stat = $zip->statIndex($i);
                $name = is_array($stat) ? (string) $stat['name'] : '';
                if (str_ends_with($name, '/') || str_starts_with($name, '__MACOSX/') || basename($name) === '.DS_Store') {
                    continue;
                }
                if (! self::safePath($name)) {
                    self::fail('package', 'template_package.bad_path', ['path' => $name]);
                }
                $unpacked += (int) $stat['size'];
                if ($unpacked > $limits['max_unpacked_bytes']) {
                    self::fail('package', 'template_package.too_large', ['mb' => intdiv($limits['max_unpacked_bytes'], 1024 * 1024)]);
                }
                $entries[$name] = $i;
            }
            $entries = self::withoutCommonFolder($entries);

            foreach (array_keys($entries) as $name) {
                if (in_array($name, ['manifest.json', ...array_values(self::FILES)], true)) {
                    continue;
                }
                if (! str_starts_with($name, 'assets/')) {
                    self::fail('package', 'template_package.unknown_file', ['path' => $name]);
                }
                if (! array_key_exists(strtolower(pathinfo($name, PATHINFO_EXTENSION)), self::ASSET_TYPES)) {
                    self::fail("assets.{$name}", 'template_package.asset_type', ['path' => $name]);
                }
                if ((int) ($zip->statIndex($entries[$name])['size'] ?? 0) > $limits['max_asset_bytes']) {
                    self::fail("assets.{$name}", 'template_package.asset_too_large', ['path' => $name, 'mb' => intdiv($limits['max_asset_bytes'], 1024 * 1024)]);
                }
            }
            foreach (['manifest.json', self::FILES['body']] as $required) {
                if (! isset($entries[$required])) {
                    self::fail('package', 'template_package.missing_file', ['file' => $required]);
                }
            }

            $text = function (string $file) use ($zip, $entries): string {
                if (! isset($entries[$file])) {
                    return '';
                }
                $contents = (string) $zip->getFromIndex($entries[$file]);
                if (! mb_check_encoding($contents, 'UTF-8')) {
                    self::fail('package', 'template_package.not_utf8', ['file' => $file]);
                }
                // a part above the render limit would only ever render an error
                $max = (int) config('openbill.rendering.max_source_bytes');
                if ($file !== 'manifest.json' && strlen($contents) > $max) {
                    self::fail('package', 'template_package.file_too_large', ['file' => $file, 'kb' => intdiv($max, 1024)]);
                }

                return $contents;
            };

            try {
                $manifest = json_decode($text('manifest.json'), true, flags: JSON_THROW_ON_ERROR);
            } catch (JsonException) {
                self::fail('manifest', 'template_package.manifest_json');
            }
            $errors = ManifestValidator::validate($manifest);
            if ($errors !== []) {
                $paths = array_map(fn (string $path): string => $path === 'manifest' ? 'manifest' : "manifest.{$path}", array_keys($errors));
                throw ValidationException::withMessages(array_combine($paths, array_values($errors)));
            }

            $assets = [];
            foreach ($entries as $name => $index) {
                if (str_starts_with($name, 'assets/')) {
                    $assets[$name] = (string) $zip->getFromIndex($index);
                    if (! self::contentMatches($name, $assets[$name])) {
                        self::fail("assets.{$name}", 'template_package.asset_content', ['path' => $name]);
                    }
                }
            }

            return new self($manifest, $text(self::FILES['header']), $text(self::FILES['body']), $text(self::FILES['footer']), $text(self::FILES['css']), $assets);
        } finally {
            $zip->close();
        }
    }

    /** Export: columns win over the stored manifest for name, version, author, license, description. */
    public static function fromTemplate(Template $template): self
    {
        $assets = [];
        foreach ($template->assets as $asset) {
            $assets[$asset->path] = (string) Storage::disk('local')->get($asset->storage_path);
        }
        $manifest = [
            ...($template->manifest ?? []),
            'name' => $template->name,
            'version' => $template->version,
            'author' => $template->author,
            'license' => $template->license,
            'description' => (string) $template->description,
        ];

        return new self($manifest, (string) $template->header, (string) $template->body, (string) $template->footer, (string) $template->css, $assets);
    }

    public function toZip(): string
    {
        // random name instead of tempnam() (forbidden by the security arch preset)
        $path = sys_get_temp_dir().'/openbill-template-'.bin2hex(random_bytes(12)).'.zip';
        try {
            $zip = new ZipArchive;
            if ($zip->open($path, ZipArchive::CREATE | ZipArchive::EXCL) !== true) {
                throw new RuntimeException('Could not create a temporary file for the template package.');
            }
            $zip->addFromString('manifest.json', json_encode($this->manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)."\n");
            foreach (self::FILES as $column => $file) {
                $zip->addFromString($file, $this->{$column});
            }
            foreach ($this->assets as $name => $contents) {
                $zip->addFromString($name, $contents);
            }
            $zip->close();

            return (string) file_get_contents($path);
        } finally {
            if (is_file($path)) {
                unlink($path);
            }
        }
    }

    public static function mimeOf(string $path): string
    {
        return self::ASSET_TYPES[strtolower(pathinfo($path, PATHINFO_EXTENSION))] ?? 'application/octet-stream';
    }

    /**
     * One asset written outside a ZIP (PUT /api/templates/{id}/files): path, type, size and content follow
     * the import rules. Returns [translation key, replacements] of the first problem, null when fine.
     *
     * @return array{0: string, 1: array<string, string|int>}|null
     */
    public static function assetProblem(string $path, string $contents): ?array
    {
        if (! str_starts_with($path, 'assets/') || ! self::safePath($path)) {
            return ['template_package.bad_path', ['path' => $path]];
        }
        if (! array_key_exists(strtolower(pathinfo($path, PATHINFO_EXTENSION)), self::ASSET_TYPES)) {
            return ['template_package.asset_type', ['path' => $path]];
        }
        $max = (int) config('openbill.templates.max_asset_bytes');
        if (strlen($contents) > $max) {
            return ['template_package.asset_too_large', ['path' => $path, 'mb' => intdiv($max, 1024 * 1024)]];
        }
        if (! self::contentMatches($path, $contents)) {
            return ['template_package.asset_content', ['path' => $path]];
        }

        return null;
    }

    /** The content is what the extension says (an image is an image, a font a font, an SVG an SVG). */
    private static function contentMatches(string $path, string $contents): bool
    {
        $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        $mime = (new finfo(FILEINFO_MIME_TYPE))->buffer($contents);
        if (! in_array($mime, self::ASSET_CONTENT[$extension] ?? [], true)) {
            return false;
        }

        return $extension !== 'svg' || preg_match('/<svg[\s>]/i', $contents) === 1;
    }

    private static function safePath(string $name): bool
    {
        if ($name === '' || str_contains($name, "\0") || str_contains($name, '\\') || str_starts_with($name, '/') || preg_match('/^[A-Za-z]:/', $name) === 1) {
            return false;
        }
        $segments = explode('/', $name);

        return ! in_array('..', $segments, true) && ! in_array('.', $segments, true) && ! in_array('', $segments, true);
    }

    /**
     * "folder/manifest.json", "folder/template.liquid", … → "manifest.json", … when everything sits in one folder.
     *
     * @param  array<string, int>  $entries
     * @return array<string, int>
     */
    private static function withoutCommonFolder(array $entries): array
    {
        if ($entries === [] || isset($entries['manifest.json'])) {
            return $entries;
        }
        $folders = array_unique(array_map(fn (string $name): string => explode('/', $name, 2)[0], array_keys($entries)));
        if (count($folders) !== 1) {
            return $entries;
        }
        $prefix = reset($folders).'/';
        $stripped = [];
        foreach ($entries as $name => $index) {
            $stripped[substr($name, strlen($prefix))] = $index;
        }

        return $stripped;
    }

    /**
     * @param  array<string, string|int>  $replace
     *
     * @throws ValidationException
     */
    private static function fail(string $path, string $key, array $replace = []): never
    {
        throw ValidationException::withMessages([$path => Text::t($key, $replace)]);
    }
}
