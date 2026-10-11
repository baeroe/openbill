<?php

namespace App\ApiResource;

/**
 * Normalization context of every API operation: null values stay in the answer ("number": null) and empty
 * keyed maps stay {} (custom, manifest, totals.lines). A resource's own normalizationContext replaces the
 * global default instead of merging it, so every resource and operation spreads CONTEXT
 * (tests/Feature/Api/NormalizationTest.php checks all operations).
 */
final class Normalization
{
    public const CONTEXT = ['preserve_empty_objects' => true, 'skip_null_values' => false];
}
