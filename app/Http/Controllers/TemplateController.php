<?php

namespace App\Http\Controllers;

use App\Models\Template;
use Inertia\Inertia;
use Inertia\Response;

/** Template gallery and editor; the templates come from GET /api/templates (SWR). */
class TemplateController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('templates/index');
    }

    /** 404 for unknown templates; the sources come from GET /api/templates/{id}. */
    public function show(string $id): Response
    {
        return Inertia::render('templates/show', ['template_id' => Template::query()->findOrFail($id)->id]);
    }
}
