<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Goods or services; only matters for third-country customers (G vs. O). Services is the common case for new
 * customers; existing third-country customers keep their previous treatment (goods, G).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->string('supply_type', 16)->default('services')->after('tax_treatment');
        });
        // existing third-country customers were invoiced as exports (G) so far: keep that, new ones start as services
        DB::table('customers')->where('tax_treatment', 'third_country')->update(['supply_type' => 'goods']);
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn('supply_type');
        });
    }
};
