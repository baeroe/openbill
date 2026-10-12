<?php

namespace App\Mcp;

use Illuminate\Contracts\JsonSchema\JsonSchema;

/** Input schemas shared by several tools. Amounts and quantities are strings ("1130.50"), dates YYYY-MM-DD. */
final class Schemas
{
    /**
     * @return array<string, mixed>
     */
    public static function paging(JsonSchema $schema): array
    {
        return [
            'page' => $schema->integer()->description('Page, starting at 1 (default 1)'),
            'per_page' => $schema->integer()->description('Items per page, 1 to 100 (default 30)'),
        ];
    }

    /**
     * Customer as SaveCustomer takes it. Only "name" is required when creating.
     *
     * @return array<string, mixed>
     */
    public static function customer(JsonSchema $schema, bool $create): array
    {
        $name = $schema->string()->description('Company or person name');

        return [
            'number' => $schema->string()->description('Customer number; left out: the next free number'),
            'name' => $create ? $name->required() : $name,
            'street' => $schema->string(),
            'zip' => $schema->string(),
            'city' => $schema->string(),
            'country' => $schema->string()->description('ISO 3166-1 alpha-2 code, e.g. DE, AT, NO'),
            'email' => $schema->string(),
            'vat_id' => $schema->string()->description('VAT ID; needed for eu_reverse_charge'),
            'tax_treatment' => $schema->string()->enum(['domestic', 'eu_reverse_charge', 'third_country'])
                ->description('domestic (default); eu_reverse_charge: EU business with VAT ID, no VAT; third_country: outside the EU'),
            'supply_type' => $schema->string()->enum(['services', 'goods'])->description('Only for third_country: services (default) or goods'),
            'customer_kind' => $schema->string()->enum(['business', 'consumer'])
                ->description('business (default) or consumer (private person; never together with eu_reverse_charge)'),
            'locale' => $schema->string()->enum(['en', 'de'])->nullable()->description('Language of this customer\'s documents; null: the organization\'s'),
            'custom' => $schema->object()->description('Custom field values by key (list-field-definitions, scope customer)'),
            'contacts' => $schema->array()->items($schema->object([
                'id' => $schema->string()->description('Keeps an existing contact (ids from get-customer)'),
                'salutation' => $schema->string(),
                'first_name' => $schema->string(),
                'last_name' => $schema->string(),
                'position' => $schema->string(),
                'email' => $schema->string(),
                'phone' => $schema->string(),
                'is_default' => $schema->boolean()->description('The contact new documents use; exactly one'),
                'custom' => $schema->object()->description('Custom field values (scope contact)'),
            ]))->description('The complete list of contacts: contacts left out are removed'),
        ];
    }
}
