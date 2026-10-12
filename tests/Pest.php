<?php

use App\Actions\CreateDocument;
use App\Actions\IssueApiToken;
use App\Enums\DocumentType;
use App\Mcp\Servers\OpenbillServer;
use App\Models\Customer;
use App\Models\Document;
use App\Models\Organization;
use App\Models\TaxRate;
use App\Models\Unit;
use App\Models\User;
use App\Support\Actor;
use App\Support\GroupWriter;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Illuminate\Validation\ValidationException;
use Laravel\Mcp\Server\Testing\TestResponse;
use Laravel\Mcp\Server\Tool;
use Tests\FeatureTestCase;
use Tests\TestCase;

/*
 * Feature tests boot Laravel and run against the MariaDB database `testing`.
 * Unit tests are plain PHP (domain, architecture, file consistency) and don't boot the app.
 * Gotenberg is faked and the archive/local disks are fake disks (`Tests\FeatureTestCase`).
 */
pest()->extend(FeatureTestCase::class)->use(RefreshDatabase::class)->in('Feature');

/*
 * Integration tests need committed data (other processes and connections must see it), so they
 * migrate per test instead of wrapping it in a transaction. DatabaseMigrations resets
 * RefreshDatabaseState afterwards, so later Feature tests migrate again.
 */
pest()->extend(TestCase::class)->use(DatabaseMigrations::class)->in('Integration');

function systemActor(): Actor
{
    return Actor::system();
}

/** The "Hour" unit from the default master data. */
function hourUnitId(): string
{
    return (string) Unit::query()->where('code', 'HUR')->value('id');
}

/** A tax rate from the default master data by percent ("19.00", "7.00", "0.00"). */
function vatRateId(string $percent = '19.00'): string
{
    return (string) TaxRate::query()->where('percent', $percent)->value('id');
}

/**
 * A billable position row as actions and GroupWriter take it.
 *
 * @param  array<string, mixed>  $extra
 * @return array<string, mixed>
 */
function itemRow(string $title = 'Consulting', string $quantity = '1', string $price = '100', array $extra = []): array
{
    return [...[
        'kind' => 'item',
        'title' => $title,
        'description' => '',
        'quantity' => $quantity,
        'unit_price' => $price,
        'unit_id' => hourUnitId(),
        'tax_rate_id' => vatRateId(),
        'custom' => [],
    ], ...$extra];
}

/**
 * Draft built directly on the models (no actions, no events): one loose group with $positions.
 *
 * @param  list<array<string, mixed>>  $positions
 * @param  array<string, mixed>  $attributes
 */
function draftDocument(DocumentType $type = DocumentType::Invoice, array $positions = [], array $attributes = []): Document
{
    $document = Document::factory()->type($type)->create($attributes);
    GroupWriter::replace($document, [['title' => null, 'positions' => $positions]]);

    return $document->fresh(['groups.positions']);
}

/**
 * Draft created through CreateDocument for a new customer, with one loose group holding $positions
 * (one 100.00 consulting item when empty).
 *
 * @param  list<array<string, mixed>>  $positions
 * @param  array<string, mixed>  $input  extra CreateDocument/UpdateDraft input
 */
function draft(DocumentType $type = DocumentType::Invoice, array $positions = [], array $input = []): Document
{
    return app(CreateDocument::class)->handle(systemActor(), [
        'type' => $type->value,
        'customer_id' => Customer::factory()->create()->id,
        'groups' => [['title' => null, 'positions' => $positions === [] ? [itemRow()] : $positions]],
        ...$input,
    ]);
}

/** Organization data the EN 16931 profile requires (fictional). */
function completeOrganization(): void
{
    Organization::current()->forceFill([
        'name' => 'Studio Nordlicht', 'street' => 'Speicherstraße 12', 'zip' => '20457', 'city' => 'Hamburg', 'country' => 'DE',
        'vat_id' => 'DE123456789', 'iban' => 'DE02120300000000202051',
    ])->save();
}

/**
 * Plain-text Sanctum token ("<id>|openbill_…") of a new (or the given) user.
 *
 * @param  list<string>  $abilities
 */
function apiToken(array $abilities = ['api:read', 'api:write'], ?string $templateId = null, ?User $user = null): string
{
    return app(IssueApiToken::class)->handle(systemActor(), $user ?? User::factory()->create(), [
        'name' => 'test',
        'abilities' => $abilities,
        'template_id' => $templateId,
    ])->plainTextToken;
}

/** Sanctum's guard keeps the user of the first request; call this before a request with another (or a revoked) token. */
function forgetApiAuth(): void
{
    app('auth')->forgetGuards();
}

/**
 * The errors of the ValidationException $run throws.
 *
 * @return array<string, list<string>>
 */
function validationErrors(Closure $run): array
{
    try {
        $run();
    } catch (ValidationException $e) {
        return $e->errors();
    }
    throw new RuntimeException('Expected a ValidationException.');
}

/**
 * One JSON-RPC call against POST /mcp with $token (legacy request without _meta, like most clients send).
 *
 * @param  array<string, mixed>  $params
 * @return array<string, mixed>
 */
function mcpRpc(string $token, string $method, array $params = []): array
{
    forgetApiAuth();
    $response = test()->withToken($token)->postJson('/mcp', ['jsonrpc' => '2.0', 'id' => 1, 'method' => $method, 'params' => (object) $params]);
    $response->assertOk();

    return $response->json();
}

/**
 * tools/call over HTTP: the tool's text and, when it is JSON, the decoded data.
 *
 * @param  array<string, mixed>  $arguments
 * @return array{error: bool, text: string, data: mixed}
 */
function mcpCall(string $token, string $tool, array $arguments = []): array
{
    $result = mcpRpc($token, 'tools/call', ['name' => $tool, 'arguments' => (object) $arguments])['result'] ?? [];
    $text = (string) ($result['content'][0]['text'] ?? '');

    return ['error' => (bool) ($result['isError'] ?? false), 'text' => $text, 'data' => json_decode($text, true)];
}

/**
 * A tool of the openbill server, called in-process as a (new) user of the session guard.
 *
 * @param  class-string<Tool>  $tool
 * @param  array<string, mixed>  $arguments
 */
function mcpTool(string $tool, array $arguments = [], ?User $user = null): TestResponse
{
    return OpenbillServer::actingAs($user ?? User::factory()->create())->tool($tool, $arguments);
}

/** Decoded JSON of a tool's first text content. */
function mcpJson(TestResponse $response): mixed
{
    $text = (fn (): string => $this->content()[0] ?? '')->call($response);

    return json_decode($text, true, flags: JSON_THROW_ON_ERROR);
}

/**
 * A built template kit as `pnpm build` leaves it in packages/template-kit/dist/kit (only a few files), plus what
 * must never reach the toolkit ZIP: template/, node_modules/, .env.local and a symbolic link. Points
 * config('openbill.toolkit.path') at it; the test deletes the folder afterwards (File::deleteDirectory).
 */
function fakeToolkit(): string
{
    $dir = sys_get_temp_dir().'/openbill-kit-'.bin2hex(random_bytes(6));
    foreach (['tooling', 'assets', 'template', 'node_modules/vite'] as $folder) {
        File::ensureDirectoryExists("{$dir}/{$folder}");
    }
    file_put_contents("{$dir}/package.json", '{"name":"openbill-template","scripts":{"dev":"vite"}}');
    file_put_contents("{$dir}/README.md", "# openbill template toolkit\n");
    file_put_contents("{$dir}/index.html", '<div id="root"></div>');
    file_put_contents("{$dir}/assets/index.js", 'console.log("preview")');
    file_put_contents("{$dir}/tooling/cli.js", '// cli');
    file_put_contents("{$dir}/template/template.liquid", 'stale template');
    file_put_contents("{$dir}/node_modules/vite/index.js", '// vite');
    file_put_contents("{$dir}/.env.local", 'OPENBILL_TOKEN="leaked"');
    symlink('/etc/hostname', "{$dir}/assets/link.txt");
    config(['openbill.toolkit.path' => $dir]);

    return $dir;
}

/**
 * Entries of a ZIP (toolkit download, template package), sorted by name.
 *
 * @return array<string, string>
 */
function zipEntries(string $zip): array
{
    $path = sys_get_temp_dir().'/openbill-test-'.bin2hex(random_bytes(6)).'.zip';
    file_put_contents($path, $zip);
    $archive = new ZipArchive;
    $archive->open($path);
    $entries = [];
    for ($i = 0; $i < $archive->numFiles; $i++) {
        $entries[(string) $archive->getNameIndex($i)] = (string) $archive->getFromIndex($i);
    }
    $archive->close();
    unlink($path);
    ksort($entries);

    return $entries;
}

/**
 * KEY => value of an .env.local written by App\Rendering\ToolkitPackage.
 *
 * @return array<string, string>
 */
function envLocal(string $contents): array
{
    preg_match_all('/^([A-Z_]+)="([^"]*)"$/m', $contents, $matches);

    return array_combine($matches[1], $matches[2]);
}
