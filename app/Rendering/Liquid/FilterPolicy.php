<?php

namespace App\Rendering\Liquid;

/**
 * Size classification of every filter in the Liquid environment (FilterPolicyTest keeps it complete).
 *
 * A single filter call can allocate more memory than any limit can catch afterwards (one str_replace of
 * 30 000 × 30 000 bytes, one implode with a 100 KB glue, a chain of base64_encode growing by 4/3 per step).
 * So every filter whose result can be larger than its input plus its arguments – by a factor, a product or
 * by building an array – is overridden in OpenbillFilters and checks the size of its result before
 * building it (guardLength: max_output_bytes, guardCount: 10 × max_range items, guardDigits: numbers).
 * The others shrink, keep the size, pick from their input or grow by a bounded constant per call; their
 * output is covered by the streamed output limit.
 */
final class FilterPolicy
{
    /** Overridden in OpenbillFilters with a size check before the result is built. */
    public const GUARDED = [
        // strings that grow by a product or a factor > 1
        'append', 'prepend', 'replace', 'replace_first', 'replace_last', 'join',
        'base64_encode', 'url_encode', 'escape', 'escape_once', 'newline_to_br', 'nl2br',
        'upcase', 'downcase', 'capitalize', 'date',
        // arrays
        'split', 'concat',
        // numbers whose digits add up per call
        'plus', 'minus', 'times', 'divided_by', 'modulo', 'round', 'money', 'number',
    ];

    /** Result at most input + a bounded constant, a part of the input, or a scalar. */
    public const ADDITIVE = [
        'abs', 'at_least', 'at_most', 'base64_decode', 'ceil', 'compact', 'default', 'first', 'floor', 'last', 'map',
        'remove', 'remove_first', 'remove_last', 'reverse', 'size', 'slice', 'sort', 'sort_natural', 'strip', 'lstrip',
        'rstrip', 'squish', 'strip_html', 'strip_newlines', 'sum', 'truncate', 'truncatewords', 'uniq', 'url_decode',
        'where', 'reject', 'has', 'find', 'find_index', 't',
    ];

    /** Digits of a number a math filter accepts (amounts have at most 19). */
    public const MAX_DIGITS = 1000;
}
