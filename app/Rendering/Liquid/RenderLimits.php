<?php

namespace App\Rendering\Liquid;

use Keepsuit\Liquid\Render\ResourceLimits;

/**
 * keepsuit's resource limits plus a deadline and a memory budget (RenderEnv::checkBudget()). keepsuit counts a render point for every node and (with
 * BoundedForTag) every loop iteration, so checking the clock there stops expensive filters in loops too.
 */
final class RenderLimits extends ResourceLimits
{
    public function __construct(private readonly RenderEnv $env)
    {
        parent::__construct(
            renderLengthLimit: (int) config('openbill.rendering.max_output_bytes'),
            renderScoreLimit: (int) config('openbill.rendering.max_render_score'),
            assignScoreLimit: (int) config('openbill.rendering.max_assign_score'),
        );
    }

    public function incrementRenderScore(int $amount = 1): ResourceLimits
    {
        $this->env->checkBudget();

        return parent::incrementRenderScore($amount);
    }

    public function incrementAssignScore(int $amount = 1): ResourceLimits
    {
        $this->env->checkBudget();

        return parent::incrementAssignScore($amount);
    }
}
