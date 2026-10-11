<?php

namespace App\Http\Controllers;

use App\Http\Requests\LoginRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class LoginController extends Controller
{
    public function show(): Response
    {
        return Inertia::render('login');
    }

    public function store(LoginRequest $request): RedirectResponse
    {
        $request->authenticate();
        $request->session()->regenerate();

        // back to the page that asked for the login, but in the language the login was done in
        $intended = $request->session()->pull('url.intended', route('home'));
        $target = is_string($intended)
            ? preg_replace('#^('.preg_quote(url('/'), '#').')/(en|de)(?=/|$)#', '$1/'.app()->getLocale(), $intended)
            : null;

        return redirect()->to($target ?? route('home'));
    }

    public function destroy(Request $request): RedirectResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login');
    }
}
