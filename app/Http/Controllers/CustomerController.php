<?php

namespace App\Http\Controllers;

use App\Support\Overview;
use Carbon\CarbonImmutable;
use Inertia\Inertia;
use Inertia\Response;

class CustomerController extends Controller
{
    /** Rows come from GET /api/customers (SWR); the open amounts per customer from here (exact sums). */
    public function index(): Response
    {
        // object: an empty map stays {} in JSON
        return Inertia::render('customers/index', ['open_by_customer' => (object) Overview::openByCustomer(CarbonImmutable::today())]);
    }
}
