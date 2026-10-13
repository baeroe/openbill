<?php

use App\Domain\Numbering\RangeFromNumbers;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** Customer numbers get a number range (number_sequences, key "customer") that continues the existing numbers. */
return new class extends Migration
{
    public function up(): void
    {
        $range = RangeFromNumbers::guess(DB::table('customers')->pluck('number'));
        $now = now();
        DB::table('number_sequences')->insert([
            'id' => strtolower((string) Str::ulid()),
            'doc_type' => 'customer',
            'year' => null,
            'pattern' => $range['pattern'],
            'next_value' => $range['next_value'],
            'reset_yearly' => false,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    public function down(): void
    {
        DB::table('number_sequences')->where('doc_type', 'customer')->delete();
    }
};
