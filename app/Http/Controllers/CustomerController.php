<?php

namespace App\Http\Controllers;

use App\Models\Customer;
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

    public function create(): Response
    {
        return Inertia::render('customers/show', ['customer_id' => null]);
    }

    /** The data comes from GET /api/customers/{id}; 404 here for unknown or deleted customers. */
    public function show(string $id): Response
    {
        return Inertia::render('customers/show', ['customer_id' => Customer::query()->findOrFail($id)->id]);
    }
}
