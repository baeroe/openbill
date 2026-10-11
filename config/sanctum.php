<?php

use App\Support\StatefulDomains;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Laravel\Sanctum\Http\Middleware\AuthenticateSession;

return [
    /*
    | Hosts whose browser requests get the session (the own UI): the host of APP_URL, plus the local
    | development hosts (localhost, DDEV) outside production (App\Support\StatefulDomains).
    | SANCTUM_STATEFUL_DOMAINS (comma-separated) replaces the list.
    */
    'stateful' => env('SANCTUM_STATEFUL_DOMAINS') !== null
        ? explode(',', (string) env('SANCTUM_STATEFUL_DOMAINS'))
        : StatefulDomains::list((string) env('APP_ENV', 'production'), env('APP_URL')),

    'guard' => ['web'],

    // tokens expire only when created with expires_at
    'expiration' => null,

    // "<id>|openbill_<secret>": recognisable for secret scanners
    'token_prefix' => env('SANCTUM_TOKEN_PREFIX', 'openbill_'),

    'middleware' => [
        'authenticate_session' => AuthenticateSession::class,
        'encrypt_cookies' => EncryptCookies::class,
        'validate_csrf_token' => ValidateCsrfToken::class,
    ],
];
