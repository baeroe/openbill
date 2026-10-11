<?php

namespace App\Rendering\Liquid;

use Keepsuit\Liquid\Filters\FiltersProvider;

/**
 * One registered filter behind RenderEnv::checkBudget(): FilterGuard puts one of these in front of every
 * filter of the environment, so the deadline and the memory budget are checked before each filter call –
 * also in a chain of cheap filters inside one output tag ("split | sort | reverse" × 1000), where no render
 * point, chunk or loop iteration would notice that time has run out.
 */
final class BudgetedFilter extends FiltersProvider
{
    public function __construct(
        public readonly FiltersProvider $provider,
        public readonly string $method,
    ) {}

    public function call(mixed $value, mixed ...$args): mixed
    {
        $env = $this->context->getRegister(RenderEnv::REGISTER);
        if ($env instanceof RenderEnv) {
            $env->checkBudget();
        }

        $this->provider->setContext($this->context);

        return $this->provider->{$this->method}($value, ...$args);
    }
}
