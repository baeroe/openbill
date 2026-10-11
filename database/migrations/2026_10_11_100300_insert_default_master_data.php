<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Base data every instance needs: the organization row, document types, number ranges,
 * tax rates and units. Docker starts only migrate, it never seeds.
 */
return new class extends Migration
{
    public function up(): void
    {
        $now = now();
        $id = fn (): string => strtolower((string) Str::ulid());
        $stamps = ['created_at' => $now, 'updated_at' => $now];

        DB::table('organization')->insert(['id' => $id(), 'taxation_mode' => 'regular', 'locale' => 'en', ...$stamps]);

        foreach ([['19 %', '19.00', 'S'], ['7 %', '7.00', 'S'], ['0 %', '0.00', 'Z']] as $sort => [$label, $percent, $category]) {
            DB::table('tax_rates')->insert(['id' => $id(), 'label' => $label, 'percent' => $percent, 'category' => $category, 'sort' => $sort, ...$stamps]);
        }

        $units = [['Hour', 'h', 2, 'HUR'], ['Day', 'd', 1, 'DAY'], ['Piece', 'pc', 0, 'H87'], ['Flat rate', 'flat', 0, 'LS'], ['Kilometer', 'km', 1, 'KMT'], ['Month', 'mo', 0, 'MON']];
        foreach ($units as $sort => [$name, $symbol, $decimals, $code]) {
            DB::table('units')->insert(['id' => $id(), 'name' => $name, 'symbol' => $symbol, 'decimals' => $decimals, 'code' => $code, 'sort' => $sort, ...$stamps]);
        }

        $types = [
            'offer' => ['Q-{YYYY}-{0000}', null, 30],
            'confirmation' => ['OC-{YYYY}-{0000}', null, null],
            'invoice' => ['INV-{YYYY}-{0000}', 14, null],
            'cancellation' => ['CN-{YYYY}-{0000}', null, null],
        ];
        foreach ($types as $type => [$pattern, $paymentTermDays, $validityDays]) {
            DB::table('document_types')->insert(['type' => $type, 'profile' => 'basic', 'payment_term_days' => $paymentTermDays, 'validity_days' => $validityDays, ...$stamps]);
            DB::table('number_sequences')->insert(['id' => $id(), 'doc_type' => $type, 'year' => null, 'pattern' => $pattern, 'next_value' => 1, 'reset_yearly' => true, ...$stamps]);
        }
    }

    public function down(): void
    {
        DB::table('number_sequences')->delete();
        DB::table('document_types')->delete();
        DB::table('units')->delete();
        DB::table('tax_rates')->delete();
        DB::table('organization')->delete();
    }
};
