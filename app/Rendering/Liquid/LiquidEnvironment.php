<?php

namespace App\Rendering\Liquid;

use Keepsuit\Liquid\Environment;
use Keepsuit\Liquid\EnvironmentFactory;
use Keepsuit\Liquid\Render\ResourceLimits;

/**
 * The sandbox templates run in: strict parsing (keepsuit always), unknown filters are errors, unknown
 * variables render empty, errors are rethrown (with line numbers) instead of printed, resource limits from
 * config('openbill.rendering') (LiquidRenderer adds a deadline per rendering: RenderLimits), no file system
 * (render/include fail), no tablerow.
 */
final class LiquidEnvironment
{
    public static function make(): Environment
    {
        $environment = EnvironmentFactory::new()
            ->setStrictFilters(true)
            ->setStrictVariables(false)
            ->setRethrowErrors(true)
            ->setResourceLimits(new ResourceLimits(
                renderLengthLimit: (int) config('openbill.rendering.max_output_bytes'),
                renderScoreLimit: (int) config('openbill.rendering.max_render_score'),
                assignScoreLimit: (int) config('openbill.rendering.max_assign_score'),
            ))
            ->registerFilters(OpenbillFilters::class)
            ->registerTag(BoundedForTag::class)
            ->build();

        // tablerow expands ranges without a limit and has no use in documents
        $environment->tagRegistry->delete('tablerow');

        return $environment;
    }
}
