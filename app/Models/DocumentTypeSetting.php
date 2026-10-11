<?php

namespace App\Models;

use App\Enums\ComplianceProfile;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Row in document_types (primary key = DocumentType value); named *Setting to not clash with the enum. */
class DocumentTypeSetting extends Model
{
    protected $table = 'document_types';

    protected $primaryKey = 'type';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $guarded = ['type'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'profile' => ComplianceProfile::class,
            'payment_term_days' => 'integer',
            'validity_days' => 'integer',
        ];
    }

    /** @return BelongsTo<Template, $this> */
    public function template(): BelongsTo
    {
        return $this->belongsTo(Template::class);
    }

    /** @return BelongsTo<TextBlock, $this> */
    public function introBlock(): BelongsTo
    {
        return $this->belongsTo(TextBlock::class, 'default_intro_block_id');
    }

    /** @return BelongsTo<TextBlock, $this> */
    public function closingBlock(): BelongsTo
    {
        return $this->belongsTo(TextBlock::class, 'default_closing_block_id');
    }
}
