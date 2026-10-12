<?php

use App\Mcp\Tools\GetOverviewTool;
use App\Support\Overview;
use Carbon\CarbonImmutable;

it('returns exactly the figures and lists of the overview page', function () {
    $draft = draft();

    $response = mcpTool(GetOverviewTool::class)->assertOk()->assertName('get-overview');

    expect(mcpJson($response))->toBe(json_decode(json_encode(Overview::build(CarbonImmutable::today())), true))
        ->and(mcpJson($response)['recent'][0]['id'])->toBe($draft->id);
});

it('runs over HTTP with an mcp token', function () {
    $call = mcpCall(apiToken(['mcp']), 'get-overview');

    expect($call['error'])->toBeFalse()
        ->and($call['data'])->toHaveKeys(['figures', 'attention', 'attention_count', 'recent'])
        ->and($call['data']['figures']['open']['gross'])->toBeString();
});
