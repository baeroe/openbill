<?php

namespace App\Enums;

enum FieldScope: string
{
    case Org = 'org';
    case Customer = 'customer';
    case Contact = 'contact';
    case Document = 'document';
    case Position = 'position';
}
