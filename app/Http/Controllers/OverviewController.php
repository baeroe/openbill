<?php

namespace App\Http\Controllers;

use App\Support\Overview;
use Carbon\CarbonImmutable;
use Inertia\Inertia;
use Inertia\Response;

/** Start page after login: figures, what needs attention, recently edited documents. */
class OverviewController extends Controller
{
    public function __invoke(): Response
    {
        return Inertia::render('overview', ['overview' => Overview::build(CarbonImmutable::today())]);
    }
}
