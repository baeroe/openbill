<?php

namespace App\Models;

use Database\Factories\TemplateFactory;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Liquid template (header, body, footer, css + manifest). Rendering arrives in phase 3. */
class Template extends Model
{
    /** @use HasFactory<TemplateFactory> */
    use HasFactory, HasUlids;

    protected $guarded = ['id'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'built_in' => 'boolean',
            'manifest' => 'array',
        ];
    }

    /** @return HasMany<TemplateAsset, $this> */
    public function assets(): HasMany
    {
        return $this->hasMany(TemplateAsset::class);
    }
}
