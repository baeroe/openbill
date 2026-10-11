<?php

namespace App\Rendering\Liquid;

use App\Support\Text;
use Keepsuit\Liquid\Exceptions\StandardException;
use Keepsuit\Liquid\Nodes\Range;
use Keepsuit\Liquid\Render\RenderContext;
use Keepsuit\Liquid\Tags\ForTag;

/**
 * {% for %} with two guards against endless rendering:
 * - a range like (1..100000000) would be expanded with range() before any limit applies → refused;
 * - every iteration costs one render point, so empty nested loops hit the render limit as well.
 */
final class BoundedForTag extends ForTag
{
    protected function collectionSegment(RenderContext $context): array
    {
        $collection = $context->evaluate($this->collection);
        $max = (int) config('openbill.rendering.max_range');
        if ($collection instanceof Range && abs($collection->end - $collection->start) + 1 > $max) {
            throw new StandardException(Text::t('rendering.error.range', ['max' => $max]));
        }

        $segment = parent::collectionSegment($context);
        $context->resourceLimits->incrementRenderScore(count($segment));

        return $segment;
    }
}
