<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Discount per position: discount_type percent|amount (null = none) and discount_value (percent 0–100 or an amount
 * in the document currency). Existing positions get none, so finalized documents keep their totals; adding nullable
 * columns touches no row (the lock triggers stay quiet).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('positions', function (Blueprint $table) {
            $table->string('discount_type', 16)->nullable()->after('unit_price');
            $table->decimal('discount_value', 15, 2)->nullable()->after('discount_type');
        });
    }

    public function down(): void
    {
        Schema::table('positions', function (Blueprint $table) {
            $table->dropColumn(['discount_type', 'discount_value']);
        });
    }
};
