<?php

namespace App\Domain\Fields;

use App\Enums\DocumentType;
use App\Enums\FieldScope;
use App\Enums\FieldType;

final readonly class FieldDefinitionData
{
    /**
     * @param  list<string>  $options  select fields only
     * @param  list<DocumentType>  $docTypes  document and position fields only
     */
    public function __construct(
        public FieldScope $scope,
        public string $key,
        public string $label,
        public FieldType $type,
        public bool $required = false,
        public mixed $defaultValue = null,
        public array $options = [],
        public array $docTypes = [],
        public ?string $id = null,
    ) {}
}
