<?php

use App\Rendering\Liquid\FilterPolicy;
use App\Rendering\Liquid\LiquidEnvironment;
use App\Rendering\Liquid\OpenbillFilters;
use App\Rendering\Liquid\RenderEnv;
use App\Rendering\Liquid\RenderTimeoutException;
use Illuminate\Support\Str;

/*
 * Every filter in the Liquid environment is classified (re-review 2, #2): either its result can only grow
 * by a constant per call (covered by the output limit), or it is guarded in OpenbillFilters and checks the
 * size of its result before building it. A new filter (keepsuit update, own filter) fails here until it
 * is classified.
 */
it('classifies every registered filter as additive-safe or guarded', function () {
    $registered = LiquidEnvironment::make()->filterRegistry->all();
    sort($registered);
    $classified = [...FilterPolicy::ADDITIVE, ...FilterPolicy::GUARDED];
    sort($classified);

    expect(array_values(array_diff($registered, $classified)))->toBe([], 'unclassified filters')
        ->and(array_values(array_diff($classified, $registered)))->toBe([], 'classified filters that do not exist')
        ->and(array_intersect(FilterPolicy::ADDITIVE, FilterPolicy::GUARDED))->toBe([]);
});

it('implements every guarded filter in OpenbillFilters', function (string $filter) {
    expect(method_exists(OpenbillFilters::class, Str::camel($filter)))->toBeTrue("{$filter} is not overridden");
})->with(FilterPolicy::GUARDED);

/*
 * Re-review 3, I1: the deadline and the memory budget are checked before every filter call, not only in the
 * guarded filters. With an expired deadline every registered filter must stop before it runs – a filter that
 * is not wrapped would run (or fail on its missing arguments) instead.
 */
it('checks the render budget before every registered filter', function () {
    $environment = LiquidEnvironment::make();
    $context = $environment->newRenderContext(registers: [RenderEnv::REGISTER => new RenderEnv('de', deadline: hrtime(true) - 1)]);

    $unchecked = [];
    foreach ($environment->filterRegistry->all() as $filter) {
        try {
            $context->applyFilter($filter, 'x');
            $unchecked[] = $filter;
        } catch (RenderTimeoutException) {
            // stopped before the filter ran
        } catch (Throwable $e) {
            $unchecked[] = $filter.' ('.$e::class.')';
        }
    }

    expect($environment->filterRegistry->all())->toHaveCount(count(FilterPolicy::ADDITIVE) + count(FilterPolicy::GUARDED))
        ->and($unchecked)->toBe([]);
});
