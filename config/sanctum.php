<?php

use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Laravel\Sanctum\Http\Middleware\AuthenticateSession;
use Laravel\Sanctum\Sanctum;

return [
    /*
    | Hosts whose browser requests get the session (the own UI): local hosts, the DDEV host and the
    | host of APP_URL (Docker, phase 10). Requests from elsewhere need a token.
    */
    'stateful' => explode(',', (string) env('SANCTUM_STATEFUL_DOMAINS', sprintf(
        '%s%s',
        'localhost,localhost:3000,127.0.0.1,127.0.0.1:8000,::1,openbill.ddev.site',
        Sanctum::currentApplicationUrlWithPort(),
    ))),

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
