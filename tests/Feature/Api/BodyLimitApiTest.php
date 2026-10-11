<?php

use App\Models\Customer;
use App\Models\Template;

beforeEach(fn () => $this->withToken(apiToken()));

it('refuses a body whose Content-Length is above the limit with 413 problem details', function () {
    config(['openbill.api.max_body_bytes' => 1000]);

    $this->call('POST', '/api/customers', server: [
        'CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json', 'CONTENT_LENGTH' => '5000',
    ], content: '{"name": "Studio Nordlicht"}')
        ->assertStatus(413)
        ->assertHeader('Content-Type', 'application/problem+json')
        ->assertJsonPath('reason', 'payload_too_large');
});

it('refuses a body that is larger than the limit even without Content-Length (chunked)', function () {
    config(['openbill.api.max_body_bytes' => 1000]);
    $body = json_encode(['name' => str_repeat('x', 2000)]);

    $this->call('POST', '/api/customers', server: ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json'], content: $body)
        ->assertStatus(413)
        ->assertJsonPath('reason', 'payload_too_large');
    expect(Customer::query()->count())->toBe(0);
});

it('gives template files the larger template limit', function () {
    config(['openbill.api.max_body_bytes' => 1000, 'openbill.api.max_template_body_bytes' => 100_000]);
    $template = Template::factory()->create();

    $this->putJson("/api/templates/{$template->id}/files", ['body' => str_repeat('<p>x</p>', 500)])->assertOk();
    $this->putJson("/api/templates/{$template->id}/files", ['body' => str_repeat('<p>x</p>', 20_000)])->assertStatus(413);
});

it('checks the asset sizes from the base64 length before decoding anything', function () {
    config(['openbill.templates.max_unpacked_bytes' => 300, 'openbill.templates.max_asset_bytes' => 200]);
    $template = Template::factory()->create();

    // without the early check, every asset would be decoded and checked (asset_content for the fake PNG)
    $response = $this->putJson("/api/templates/{$template->id}/files", ['assets' => [
        'assets/a.png' => base64_encode(str_repeat('a', 150)),
        'assets/b.png' => base64_encode(str_repeat('b', 150)),
        'assets/c.png' => base64_encode(str_repeat('c', 250)),
    ]])->assertUnprocessable();

    expect(collect($response->json('violations'))->pluck('path')->all())->toEqualCanonicalizing(['assets', 'assets.assets/c.png']);
});
