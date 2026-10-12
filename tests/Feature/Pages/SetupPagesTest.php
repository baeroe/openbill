<?php

use App\Models\Template;
use App\Models\User;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

it('renders the template gallery and the editor of an existing template only', function () {
    $template = Template::query()->where('slug', 'klar')->sole();
    $this->actingAs(User::factory()->create());

    $this->get('/en/templates')->assertOk()->assertInertia(fn (Assert $page) => $page->component('templates/index'));
    $this->get("/de/templates/{$template->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('templates/show')->where('template_id', $template->id));
    $this->get('/en/templates/'.strtolower((string) Str::ulid()))->assertNotFound();
});

it('opens the custom fields on the requested level, documents by default', function (string $query, string $scope) {
    $this->actingAs(User::factory()->create())->get("/en/fields{$query}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('fields/index')->where('scope', $scope));
})->with([
    'default' => ['', 'document'],
    'org' => ['?scope=org', 'org'],
    'position' => ['?scope=position', 'position'],
    'unknown level' => ['?scope=invoice', 'document'],
    'array' => ['?scope[]=org', 'document'],
]);

it('sends /settings to the organization and renders every section', function () {
    $this->actingAs(User::factory()->owner()->create());

    $this->get('/de/settings')->assertRedirect('/de/settings/organization');
    foreach (['organization', 'document-types', 'taxes-units', 'text-blocks', 'users', 'api', 'account'] as $section) {
        $this->get("/en/settings/{$section}")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('settings/show')->where('section', $section)->where('can_manage_users', true)
                ->where('mcp_url', url('/mcp'))->where('api_docs_url', url('/api/docs')));
    }
});

it('tells the page whether the user may manage users', function () {
    $this->actingAs(User::factory()->create())->get('/en/settings/users')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('can_manage_users', false));
});

it('sends guests to the login', function (string $url) {
    $this->get($url)->assertRedirect('/en/login');
})->with(['/en/templates', '/en/fields', '/en/settings/organization']);
