<?php

namespace App\Enums;

enum FieldType: string
{
    case Text = 'text';
    case Textarea = 'textarea';
    case Number = 'number';
    case Money = 'money';
    case Date = 'date';
    case Select = 'select';
    case Boolean = 'boolean';
    case Image = 'image';
}
