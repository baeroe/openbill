<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

/** code = UN/ECE Recommendation 20 (HUR, DAY, H87, …). Archived instead of deleted. */
class Unit extends Model
{
    use HasUlids;

    protected $guarded = ['id'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'decimals' => 'integer',
            'sort' => 'integer',
            'archived_at' => 'immutable_datetime',
        ];
    }
}
