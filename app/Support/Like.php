<?php

namespace App\Support;

/** Search terms for SQL LIKE: wildcards typed by the user are matched literally. */
final class Like
{
    public static function contains(string $term): string
    {
        return '%'.addcslashes($term, '%_\\').'%';
    }
}
