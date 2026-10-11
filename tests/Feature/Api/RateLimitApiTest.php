<?php

beforeEach(fn () => config(['openbill.api.requests_per_minute' => 3]));

it('counts made-up tokens against the IP instead of giving each its own bucket', function () {
    foreach (range(1, 3) as $i) {
        $this->withToken("{$i}|openbill_".bin2hex(random_bytes(20)))->getJson('/api/units')->assertUnauthorized();
        forgetApiAuth();
    }

    $this->withToken('9|openbill_'.bin2hex(random_bytes(20)))->getJson('/api/units')
        ->assertStatus(429)
        ->assertHeader('Content-Type', 'application/problem+json')
        ->assertHeader('Retry-After')
        ->assertJsonPath('reason', 'too_many_requests');
});

it('gives a valid token its own bucket', function () {
    foreach (range(1, 3) as $i) {
        $this->getJson('/api/units')->assertUnauthorized();
    }

    $this->withToken(apiToken(['api:read']))->getJson('/api/units')->assertOk();
});
