<?php

namespace App\Rendering\Liquid;

use Keepsuit\Liquid\Exceptions\ResourceLimitException;

/** The rendering used more memory than its budget (config openbill.rendering.max_memory_bytes). */
final class RenderMemoryException extends ResourceLimitException {}
