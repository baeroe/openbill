<?php

namespace App\Models;

use App\Enums\TaxationMode;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

/** The one organization of this instance; its row is created by a migration. */
class Organization extends Model
{
    use HasUlids;

    protected $table = 'organization';

    protected $guarded = ['id'];

    public static function current(): self
    {
        return static::query()->firstOrFail();
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'taxation_mode' => TaxationMode::class,
            'custom' => 'array',
        ];
    }
}
