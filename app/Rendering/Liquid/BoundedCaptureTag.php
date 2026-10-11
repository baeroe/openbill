<?php

namespace App\Rendering\Liquid;

use Keepsuit\Liquid\Render\RenderContext;
use Keepsuit\Liquid\Tags\CaptureTag;

/**
 * {% capture %} that counts while it builds: keepsuit renders the block into one string and charges its
 * length only afterwards, so a capture around a big loop could run the process out of memory. Here the
 * block is streamed and every chunk is charged to the assign limit (and the render budget) right away.
 */
final class BoundedCaptureTag extends CaptureTag
{
    public function render(RenderContext $context): string
    {
        $value = '';
        foreach ($this->body->stream($context) as $chunk) {
            $context->resourceLimits->incrementAssignScore(strlen($chunk));
            $value .= $chunk;
        }
        $context->setToActiveScope($this->to, $value);

        return '';
    }
}
