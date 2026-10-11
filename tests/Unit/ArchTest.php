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
