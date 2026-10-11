<?php

return [
    /*
     * Owner account created on start by `php artisan app:ensure-admin`.
     * Read through config (not env()) so it also works with a cached config.
     */
    'admin' => [
        'email' => env('ADMIN_EMAIL'),
        'password' => env('ADMIN_PASSWORD'),
    ],
];
