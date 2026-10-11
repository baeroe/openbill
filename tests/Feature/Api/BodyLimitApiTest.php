<?php

use App\Http\IncomingRequest;
use App\Models\Customer;
use App\Models\Template;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Foundation\Http\Middleware\TrimStrings;
use Symfony\Component\HttpFoundation\Request as SymfonyRequest;

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

afterEach(fn () => TrimStrings::flushState());

it('stops a large JSON body without a token before any other middleware reads it', function () {
    config(['openbill.api.max_body_bytes' => 1000]);
    $reached = false;
    TrimStrings::skipWhen(function () use (&$reached): bool {
        $reached = true;

        return false;
    });

    // no token, no Content-Length: the size is only known by reading the body
    $this->withHeaders(['Authorization' => ''])->call('POST', '/api/customers', server: ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json'], content: '['.str_repeat('0,', 50_000).'0]')
        ->assertStatus(413)
        ->assertHeader('Content-Type', 'application/problem+json')
        ->assertJsonPath('reason', 'payload_too_large');

    expect($reached)->toBeFalse();
});

it('never decodes a JSON body above the limit (request of public/index.php)', function () {
    $body = '['.str_repeat('0,', 1_500_000).'0]'; // 3 MB, 1.5 million elements once decoded
    $request = IncomingRequest::fromBase(SymfonyRequest::create('/api/customers', 'POST', server: [
        'CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json',
    ], content: $body));
    $before = memory_get_usage();
    memory_reset_peak_usage();

    $response = app(Kernel::class)->handle($request);

    expect($response->getStatusCode())->toBe(413)
        ->and($response->headers->get('Content-Type'))->toBe('application/problem+json')
        ->and($request->jsonDecoded())->toBeFalse()
        // the body itself and one streamed copy, nothing like the decoded array (> 50 MB)
        ->and(memory_get_peak_usage() - $before)->toBeLessThan(16 * 1024 * 1024);
});

it('decodes the JSON body once it is within the limit', function () {
    $request = IncomingRequest::fromBase(SymfonyRequest::create('/api/units', 'POST', server: [
        'CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json', 'HTTP_AUTHORIZATION' => 'Bearer '.apiToken(),
    ], content: '{"name": "Lump sum", "symbol": "ls", "decimals": 0, "code": "LS"}'));

    expect($request->jsonDecoded())->toBeFalse();
    $response = app(Kernel::class)->handle($request);

    expect($response->getStatusCode())->toBe(201)
        ->and($request->jsonDecoded())->toBeTrue()
        ->and($request->input('code'))->toBe('LS');
});

it('counts the text fields of form and multipart bodies', function () {
    config(['openbill.api.max_body_bytes' => 1000]);

    $this->post('/api/customers', ['name' => str_repeat('x', 2000)], ['Accept' => 'application/json'])
        ->assertStatus(413)
        ->assertJsonPath('reason', 'payload_too_large');
});
