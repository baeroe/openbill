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
    ->expect(['App\Exceptions\DocumentLockedException', 'App\Exceptions\ActionNotAllowedException', 'App\Exceptions\ComplianceFailedException'])
    ->toExtend('App\Exceptions\DomainActionException');
