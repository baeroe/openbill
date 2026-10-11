<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    /**
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $locale = app()->getLocale();

        return [
            ...parent::share($request),
            'locale' => $locale,
            'translations' => fn (): array => File::json(lang_path("{$locale}.json")),
            'auth' => [
                'user' => fn (): ?array => $request->user()?->only(['id', 'name', 'email', 'role']),
            ],
        ];
    }
}
