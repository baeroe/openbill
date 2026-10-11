<?php

namespace App\Models;

use App\Enums\DocumentType;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

/** year NULL: configuration of a number range; year set: counter of that year (yearly reset). */
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
            'doc_type' => DocumentType::class,
            'year' => 'integer',
            'next_value' => 'integer',
            'reset_yearly' => 'boolean',
        ];
    }
}
