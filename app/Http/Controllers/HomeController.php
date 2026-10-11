<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use Inertia\Response;

/** Minimal start page after login; the app shell arrives in phase 5. */
class HomeController extends Controller
{
    public function __invoke(): Response
    {
        return Inertia::render('home');
    }
}
