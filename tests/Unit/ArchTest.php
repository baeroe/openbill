<?php

use Illuminate\Database\Eloquent\Model;

arch('php preset')->preset()->php();

arch('security preset')->preset()->security();

arch('no debugging leftovers')
    ->expect(['dd', 'dump', 'ray', 'var_dump', 'print_r'])
    ->not->toBeUsed();

arch('models are Eloquent models')
    ->expect('App\Models')
    ->toExtend(Model::class);

arch('controllers carry the Controller suffix')
    ->expect('App\Http\Controllers')
    ->toHaveSuffix('Controller');

arch('controllers do not query the database directly')
    ->expect('App\Http\Controllers')
    ->not->toUse('Illuminate\Support\Facades\DB');

arch('enums are backed enums')
    ->expect('App\Enums')
    ->toBeStringBackedEnums();

arch('the domain is plain PHP')
    ->expect('App\Domain')
    ->not->toUse(['Illuminate', 'App\Models', 'App\Actions', 'App\Support', 'App\Http', 'App\Exceptions', 'Carbon']);

// classes() skips the enums FieldErrorCode/ComplianceRule, which this Pest version does not count as final
arch('domain classes are final')
    ->expect('App\Domain')
    ->classes()
    ->toBeFinal();

arch('actions are final and run through handle()')
    ->expect('App\Actions')
    ->toBeFinal()
    ->toHaveMethod('handle');

arch('models never call actions')
    ->expect('App\Models')
    ->not->toUse('App\Actions');

arch('the http layer does not compute: no domain classes in controllers')
    ->expect('App\Http')
    ->not->toUse('App\Domain');

arch('support code does not call actions')
    ->expect('App\Support')
    ->not->toUse('App\Actions');

arch('domain exceptions carry an HTTP status')
    ->expect([
        'App\Exceptions\DocumentLockedException', 'App\Exceptions\ActionNotAllowedException', 'App\Exceptions\ComplianceFailedException',
        'App\Exceptions\TemplateRenderFailedException', 'App\Exceptions\PdfRenderFailedException', 'App\Exceptions\EInvoiceInvalidException',
    ])
    ->toExtend('App\Exceptions\DomainActionException');

arch('rendering and e-invoice code does not call actions or the http layer')
    ->expect(['App\Rendering', 'App\EInvoice'])
    ->not->toUse(['App\Actions', 'App\Http']);

arch('rendering and e-invoice classes are final')
    ->expect(['App\Rendering', 'App\EInvoice'])
    ->classes()
    ->toBeFinal();

arch('only the rendering layer talks to Gotenberg')
    ->expect('Gotenberg')
    ->toOnlyBeUsedIn('App\Rendering\GotenbergClient');

arch('only the e-invoice layer uses horstoeko/zugferd')
    ->expect('horstoeko\zugferd')
    ->toOnlyBeUsedIn('App\EInvoice');

/**
 * Raw table writers on the locked tables: DB::table('documents'), $connection->table('positions'), ...
 * They bypass the model hooks (the database triggers still refuse writes to finalized documents).
 *
 * @return list<string>
 */
function lockedTableQueries(string $code, string $file = 'code'): array
{
    $tables = 'documents|positions|position_groups|document_snapshots|document_files';
    preg_match_all("/(?:DB::|->)table\\(\\s*['\"]({$tables})['\"]/", $code, $matches, PREG_OFFSET_CAPTURE);

    return array_map(fn (array $m): string => $file.':'.(substr_count(substr($code, 0, $m[1]), "\n") + 1).' '.$m[0], $matches[0]);
}

it('detects raw queries on locked tables', function () {
    $code = "<?php\nDB::table('documents')->update([]);\n\$db->table(\"positions\");\nDB::table('customers');";

    expect(lockedTableQueries($code))->toBe(["code:2 DB::table('documents'", 'code:3 ->table("positions"']);
});

it('never queries documents, positions, groups, snapshots or files through DB::table in app/', function () {
    $root = dirname(__DIR__, 2).'/app';
    $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS));
    $hits = [];
    foreach ($files as $file) {
        if ($file->getExtension() === 'php') {
            array_push($hits, ...lockedTableQueries((string) file_get_contents($file->getPathname()), substr($file->getPathname(), strlen($root) + 1)));
        }
    }

    expect($hits)->toBe([]);
});
