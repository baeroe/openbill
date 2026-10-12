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
use App\Support\TrustedRequests;
use Illuminate\Auth\Middleware\Authorize;
use Illuminate\Contracts\Auth\Middleware\AuthenticatesRequests;
use Illuminate\Contracts\Session\Middleware\AuthenticatesSessions;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Foundation\Http\Middleware\HandlePrecognitiveRequests;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Routing\Middleware\ThrottleRequestsWithRedis;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\View\Middleware\ShareErrorsFromSession;

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
        // body size first, globally before ValidatePostSize/TrimStrings (which decode JSON): nothing parses
        // an /api body above config('openbill.api.*')
        $middleware->prepend(LimitApiBody::class);
        $middleware->api(append: [SetApiLocale::class]);
        // Laravel's priority list with the rate limit moved before auth: requests with made-up tokens (401)
        // count as well, otherwise guessing tokens is unlimited
        $middleware->priority([
            HandlePrecognitiveRequests::class,
            EncryptCookies::class,
            AddQueuedCookiesToResponse::class,
            StartSession::class,
            ShareErrorsFromSession::class,
            ThrottleRequests::class,
            ThrottleRequestsWithRedis::class,
            AuthenticatesRequests::class,
            AuthenticatesSessions::class,
            SubstituteBindings::class,
            Authorize::class,
        ]);
        // language before rate limit and auth, so 429 and 401 are already in the requested language
        $middleware->prependToPriorityList(ThrottleRequests::class, SetApiLocale::class);
        $middleware->alias(['api.ability' => RequireApiAbility::class]);
        // auth runs before SetLocale (middleware priority), so resolve the language here as well
        $middleware->redirectGuestsTo(fn (Request $request) => route('login', ['locale' => SetLocale::fromRequest($request)]));
        $middleware->redirectUsersTo(fn (Request $request) => route('home', ['locale' => SetLocale::fromRequest($request)]));
        // reverse proxy in front (docs: reverse-proxy): X-Forwarded-* only from private networks, so a direct hit on the
        // published port can't fake https or its IP; the Host header must be the host of APP_URL (outside local/tests)
        $middleware->trustProxies(at: TrustedRequests::PROXIES);
        $middleware->trustHosts(at: fn (): array => TrustedRequests::hostPatterns(config('app.url')), subdomains: false);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // expected refusals of the API, not server errors
        $exceptions->dontReport([
            DocumentLockedException::class,
            ActionNotAllowedException::class,
            ComplianceFailedException::class,
            TemplateRenderFailedException::class,
        ]);

        // every /api route answers with Problem Details (API Platform's own error handler is off, config/api-platform.php),
        // and so does the toolkit download, which the template editor fetches
        $exceptions->render(function (Throwable $e, Request $request) {
            if (! ($request->is('api', 'api/*') || $request->routeIs('templates.toolkit')) || $e instanceof HttpResponseException) {
                return null;
            }

            return ProblemResponse::from($e);
        });

        // /mcp: agents do not always send Accept: application/json, and a 302 to the login page helps nobody
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*', 'mcp') || $request->expectsJson(),
        );
    })->create();
