<?php

namespace App\Rendering\Liquid;

use Keepsuit\Liquid\Exceptions\ResourceLimitException;

/** The rendering ran past its deadline (config openbill.rendering.max_seconds). */
final class RenderTimeoutException extends ResourceLimitException {}
