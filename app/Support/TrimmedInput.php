<?php

namespace App\Support;

/**
 * Master data is stored without surrounding blanks. Laravel's TrimStrings middleware never sees the JSON bodies of
 * the API (API Platform reads the raw body) nor MCP arguments, so actions trim their name-like fields themselves –
 * before validating, so a name of blanks only fails "required". Free texts (text block bodies, document texts) stay
 * as typed. SaveCustomer has its own variant for nested contacts.
 */
final class TrimmedInput
{
    /**
     * @param  array<string, mixed>  $input
     * @param  list<string>  $keys
     * @return array<string, mixed>
     */
    public static function strings(array $input, array $keys): array
    {
        foreach ($keys as $key) {
            if (isset($input[$key]) && is_string($input[$key])) {
                $input[$key] = trim($input[$key]);
            }
        }

        return $input;
    }
}
