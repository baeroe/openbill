<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Settings: one page, the section comes from the URL; the data from /api (SWR). */
class SettingsController extends Controller
{
    /** @var list<string> */
    public const SECTIONS = ['organization', 'document-types', 'customers', 'taxes-units', 'text-blocks', 'users', 'api', 'account'];

    public function index(): RedirectResponse
    {
        return redirect()->route('settings.show', ['section' => 'organization']);
    }

    public function show(Request $request, string $section): Response
    {
        $user = $request->user();

        return Inertia::render('settings/show', [
            'section' => $section,
            'can_manage_users' => $user instanceof User && $user->role === UserRole::Owner,
            // section "api": the setup snippets and the link to the API reference
            'mcp_url' => url('/mcp'),
            'api_docs_url' => url('/api/docs'),
        ]);
    }
}
