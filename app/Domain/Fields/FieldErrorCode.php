<?php

namespace App\Domain\Fields;

/** Value = suffix of the translation key fields.error.<value>. */
enum FieldErrorCode: string
{
    case Unknown = 'unknown';
    case Required = 'required';
    case NotText = 'not_text';
    case TooLong = 'too_long';
    case NotNumber = 'not_number';
    case NotMoney = 'not_money';
    case NotDate = 'not_date';
    case NotOption = 'not_option';
    case NotBoolean = 'not_boolean';
    case NotImage = 'not_image';
    case LabelMissing = 'label_missing';
    case KeyInvalid = 'key_invalid';
    case KeyReserved = 'key_reserved';
    case KeyTaken = 'key_taken';
    case OptionsMissing = 'options_missing';
    case DocTypesMissing = 'doc_types_missing';
}
