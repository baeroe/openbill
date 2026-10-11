<?php

namespace App\Models;

use App\Enums\TaxCategory;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

/** Archived instead of deleted: positions keep referencing it. */
class TaxRate extends Model
{
    use HasUlids;

    protected $guarded = ['id'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'percent' => 'decimal:2',
            'category' => TaxCategory::class,
            'sort' => 'integer',
            'archived_at' => 'immutable_datetime',
        ];
    }
}
