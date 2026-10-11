<?php

namespace App\Rendering\Liquid;

use Keepsuit\Liquid\Support\FilterRegistry;

/**
 * keepsuit dispatches every filter – in output tags, assigns, tag arguments and lookups like "list.size" –
 * through FilterRegistry::invoke(), which calls the registered [provider, method] pair. The environment's
 * registry is a readonly property and cannot be swapped, so FilterGuard (a FilterRegistry only to reach its
 * protected filter table) replaces each pair with a BudgetedFilter around it. LiquidEnvironment::make() does
 * this last; FilterPolicyTest checks that every registered filter stops on an expired deadline.
 */
final class FilterGuard extends FilterRegistry
{
    public static function wrap(FilterRegistry $registry): void
    {
        foreach ($registry->filters as $name => [$provider, $method]) {
            if (! $provider instanceof BudgetedFilter) {
                $registry->filters[$name] = [new BudgetedFilter($provider, $method), 'call'];
            }
        }
    }
}
