<?php

namespace App\Http\Controllers;

use App\Enums\FieldScope;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Custom fields of all levels; ?scope= picks the tab (anything unknown → document). */
class FieldController extends Controller
{
    public function index(Request $request): Response
    {
        $scope = $request->query('scope');
        $scope = is_string($scope) ? FieldScope::tryFrom($scope) : null;

        return Inertia::render('fields/index', ['scope' => ($scope ?? FieldScope::Document)->value]);
    }
}
