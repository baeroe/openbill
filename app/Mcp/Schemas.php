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

    /**
     * Fields of a draft as CreateDocument and UpdateDraft take them (the shape get-document returns).
     *
     * @return array<string, mixed>
     */
    public static function draft(JsonSchema $schema): array
    {
        return [
            'date' => $schema->string()->description('Document date (YYYY-MM-DD); default today'),
            'customer_id' => $schema->string()->nullable()->description('Customer ID (list-customers)'),
            'contact_id' => $schema->string()->nullable()->description('Contact of that customer; left out: the default contact'),
            'service_date' => $schema->string()->nullable()->description('Service date or start of the service period (YYYY-MM-DD)'),
            'service_date_end' => $schema->string()->nullable()->description('End of the service period (YYYY-MM-DD)'),
            'due_date' => $schema->string()->nullable()->description('Due date of an invoice (YYYY-MM-DD)'),
            'valid_until' => $schema->string()->nullable()->description('Offer valid until (YYYY-MM-DD)'),
            'intro' => $schema->string()->nullable()->description('Text above the positions'),
            'closing' => $schema->string()->nullable()->description('Text below the positions'),
            'template_id' => $schema->string()->nullable()->description('Template (list-templates); null: the default of the document type'),
            'locale' => $schema->string()->enum(['en', 'de'])->description('Document language'),
            'custom' => $schema->object()->description('Custom field values by key (list-field-definitions, scope document)'),
            'groups' => $schema->array()->items($schema->object([
                'id' => $schema->string()->description('Keeps an existing group'),
                'title' => $schema->string()->nullable()->description('Group heading; null: positions without a heading'),
                'positions' => $schema->array()->items($schema->object([
                    'id' => $schema->string()->description('Keeps an existing position'),
                    'kind' => $schema->string()->enum(['item', 'optional', 'text'])->required()
                        ->description('item; optional (offers only, not in the total); text (a line without amount)'),
                    'title' => $schema->string(),
                    'description' => $schema->string(),
                    'quantity' => $schema->string()->description('Decimal as string, e.g. "8" or "1.5"'),
                    'unit_price' => $schema->string()->description('Net price as string, e.g. "120" or "49.90"'),
                    'unit_id' => $schema->string()->nullable()->description('Unit (list-tax-rates-and-units)'),
                    'tax_rate_id' => $schema->string()->nullable()->description('Tax rate (list-tax-rates-and-units)'),
                    'custom' => $schema->object()->description('Custom field values (scope position)'),
                ])),
            ]))->description('All groups with their positions, in order. Replaces the existing ones: send their ids to keep them'),
        ];
    }

    /**
     * Organization (sender) as UpdateOrganization takes it; every key is optional.
     *
     * @return array<string, mixed>
     */
    public static function organization(JsonSchema $schema): array
    {
        $fields = [];
        foreach (['name', 'street', 'zip', 'city', 'tax_number', 'iban', 'bic', 'bank_name', 'email', 'phone', 'website'] as $key) {
            $fields[$key] = $schema->string()->nullable();
        }

        return [
            ...$fields,
            'country' => $schema->string()->nullable()->description('ISO 3166-1 alpha-2 code, e.g. DE'),
            'vat_id' => $schema->string()->nullable()->description('VAT ID; needed for e-invoices with reverse charge or to third countries'),
            'registration_id' => $schema->string()->nullable()->description('Register number (BT-30), e.g. HRB 12345'),
            'taxation_mode' => $schema->string()->enum(['regular', 'small_business'])->description('small_business: no VAT (§ 19 UStG)'),
            'locale' => $schema->string()->enum(['en', 'de'])->description('Default document language'),
            'custom' => $schema->object()->description('Custom field values by key (list-field-definitions, scope org)'),
        ];
    }

    /**
     * Custom field as SaveFieldDefinition takes it. Scope and key cannot change after creation.
     *
     * @return array<string, mixed>
     */
    public static function fieldDefinition(JsonSchema $schema): array
    {
        return [
            'scope' => $schema->string()->enum(['org', 'customer', 'contact', 'document', 'position'])->description('Required when creating; fixed afterwards'),
            'key' => $schema->string()->description('Key used in templates and in "custom"; left out: made from the label. Fixed after creation'),
            'label' => $schema->string()->description('Required when creating'),
            'type' => $schema->string()->enum(['text', 'textarea', 'number', 'money', 'date', 'select', 'boolean', 'image'])->description('Required when creating'),
            'required' => $schema->boolean()->description('Documents need a value before finalize-document; customers when saved'),
            'default_value' => $schema->union(['string', 'number', 'boolean', 'null'])->description('Value new documents or customers start with'),
            'help' => $schema->string()->nullable(),
            'options' => $schema->array()->items($schema->string())->description('Choices of a select field'),
            'doc_types' => $schema->array()->items($schema->string()->enum(['offer', 'confirmation', 'invoice', 'cancellation']))
                ->description('Document types a document or position field applies to (at least one)'),
            'sort' => $schema->integer(),
        ];
    }
}
