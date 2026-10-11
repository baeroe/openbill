<?php

namespace App\Models;

use App\Enums\FieldScope;
use App\Enums\FieldType;
use Database\Factories\FieldDefinitionFactory;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FieldDefinition extends Model
{
    /** @use HasFactory<FieldDefinitionFactory> */
    use HasFactory, HasUlids;

    protected $guarded = ['id'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'scope' => FieldScope::class,
            'type' => FieldType::class,
            'required' => 'boolean',
            'default_value' => 'json',
            'options' => 'array',
            'doc_types' => 'array',
            'sort' => 'integer',
        ];
    }
}
