<?php

namespace App\Rendering;

use App\Exceptions\ToolkitUnavailableException;
use FilesystemIterator;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use RuntimeException;
use SplFileInfo;
use ZipArchive;

/**
 * The ZIP of the toolkit download (POST /{locale}/templates/{id}/toolkit): the built kit (config openbill.toolkit.path),
 * the template as package files under template/, .env.local (instance URL, token, template id) and a .gitignore that
 * keeps .env.local out of git. Everything sits in one folder.
 */
final readonly class ToolkitPackage
{
    /** First path segments never taken from the kit folder: the template comes from the database, secrets and installs stay local. */
    private const SKIP = ['template', 'node_modules', '.env', '.env.local', '.gitignore', 'schema.json'];

    public const GITIGNORE = "node_modules/\n.env.local\n*.zip\n";

    /**
     * @param  array<string, string>  $kit  kit path => contents (readKit())
     * @param  array<string, string>  $env  .env.local
     */
    public function __construct(
        public array $kit,
        public TemplatePackage $template,
        public array $env,
    ) {}

    /**
     * Every regular file of the built kit by relative path ("/"); symbolic links are skipped.
     *
     * @return array<string, string>
     *
     * @throws ToolkitUnavailableException when the kit was not built
     */
    public static function readKit(string $dir): array
    {
        if (! is_file("{$dir}/package.json") || ! is_file("{$dir}/tooling/cli.js")) {
            throw new ToolkitUnavailableException;
        }

        $files = [];
        $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS));
        foreach ($iterator as $file) {
            /** @var SplFileInfo $file */
            if ($file->isLink() || ! $file->isFile()) {
                continue;
            }
            $relative = str_replace(DIRECTORY_SEPARATOR, '/', substr($file->getPathname(), strlen($dir) + 1));
            if (in_array(explode('/', $relative)[0], self::SKIP, true)) {
                continue;
            }
            $files[$relative] = (string) file_get_contents($file->getPathname());
        }
        ksort($files);

        return $files;
    }

    public function toZip(string $folder): string
    {
        // random name instead of tempnam() (forbidden by the security arch preset)
        $path = sys_get_temp_dir().'/openbill-toolkit-'.bin2hex(random_bytes(12)).'.zip';
        try {
            $zip = new ZipArchive;
            if ($zip->open($path, ZipArchive::CREATE | ZipArchive::EXCL) !== true) {
                throw new RuntimeException('Could not create a temporary file for the template toolkit.');
            }
            foreach ($this->kit as $name => $contents) {
                $zip->addFromString("{$folder}/{$name}", $contents);
            }
            foreach ($this->template->files() as $name => $contents) {
                $zip->addFromString("{$folder}/template/{$name}", $contents);
            }
            $zip->addFromString("{$folder}/.env.local", self::envFile($this->env));
            $zip->addFromString("{$folder}/.gitignore", self::GITIGNORE);
            $zip->close();

            return (string) file_get_contents($path);
        } finally {
            if (is_file($path)) {
                unlink($path);
            }
        }
    }

    /**
     * KEY="value" lines. Values are an URL, a token and a ULID: quotes, backslashes and line breaks never belong there.
     *
     * @param  array<string, string>  $env
     */
    public static function envFile(array $env): string
    {
        $lines = ['# openbill template toolkit – keep this file private: it holds a token (Settings → API & MCP to revoke it).'];
        foreach ($env as $key => $value) {
            if (preg_match('/["\\\\\r\n]/', $value) === 1) {
                throw new RuntimeException("Unexpected character in {$key}.");
            }
            $lines[] = "{$key}=\"{$value}\"";
        }

        return implode("\n", $lines)."\n";
    }
}
