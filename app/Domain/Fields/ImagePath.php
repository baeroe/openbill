<?php

namespace App\Domain\Fields;

/** Value of an image field: a file stored by POST /api/uploads ("uploads/<ulid>.<ext>"). */
final class ImagePath
{
    public const PATTERN = '#^uploads/[0-9a-z]{26}\.(png|jpg|jpeg|gif|webp|svg)$#';

    public static function isValid(string $value): bool
    {
        return preg_match(self::PATTERN, $value) === 1;
    }
}
