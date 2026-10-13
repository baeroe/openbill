<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

/**
 * year NULL: configuration of a number range; year set: counter of that year (yearly reset). doc_type is the range key:
 * a document type or "customer" (App\Support\NumberRange).
 */
class NumberSequence extends Model
{
    use HasUlids;

    protected $guarded = ['id'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'year' => 'integer',
            'next_value' => 'integer',
            'reset_yearly' => 'boolean',
        ];
    }
}
