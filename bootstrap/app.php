<?php

use App\Exceptions\ActionNotAllowedException;
use App\Exceptions\ComplianceFailedException;
use App\Exceptions\DocumentLockedException;
use App\Exceptions\TemplateRenderFailedException;
use App\Http\Api\ProblemResponse;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LimitApiBody;
use App\Http\Middleware\RequireApiAbility;
use App\Http\Middleware\SetApiLocale;
use App\Http\Middleware\SetLocale;
use Illuminate\Contracts\Auth\Middleware\AuthenticatesRequests;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->web(append: [SetLocale::class, HandleInertiaRequests::class]);
        // /api: session of the own UI (Sanctum stateful + CSRF), rate limit "api", response language
        $middleware->statefulApi();
        $middleware->throttleApi();
        // body size first: nothing parses a body above config('openbill.api.*')
        $middleware->api(prepend: [LimitApiBody::class]);
        $middleware->api(append: [SetApiLocale::class]);
        // before auth (priority list), so a 401 is already in the requested language
        $middleware->prependToPriorityList(AuthenticatesRequests::class, SetApiLocale::class);
        $middleware->alias(['api.ability' => RequireApiAbility::class]);
        // auth runs before SetLocale (middleware priority), so resolve the language here as well
        $middleware->redirectGuestsTo(fn (Request $request) => route('login', ['locale' => SetLocale::fromRequest($request)]));
        $middleware->redirectUsersTo(fn (Request $request) => route('home', ['locale' => SetLocale::fromRequest($request)]));
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // expected refusals of the API, not server errors
        $exceptions->dontReport([
            DocumentLockedException::class,
            ActionNotAllowedException::class,
            ComplianceFailedException::class,
            TemplateRenderFailedException::class,
        ]);

        // every /api route answers with Problem Details (API Platform's own error handler is off, config/api-platform.php)
        $exceptions->render(function (Throwable $e, Request $request) {
            if (! $request->is('api', 'api/*') || $e instanceof HttpResponseException) {
                return null;
            }

            return ProblemResponse::from($e);
        });

        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
