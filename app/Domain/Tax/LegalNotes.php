<?php

namespace App\Domain\Tax;

/** Legal note texts in the document's language; translated outside the domain. */
final readonly class LegalNotes
{
    public function __construct(
        public string $smallBusiness,
        public string $reverseCharge,
        public string $thirdCountry,
    ) {}
}
