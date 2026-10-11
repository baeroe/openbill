<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Seller legal registration identifier (EN 16931 BT-30), e.g. the commercial register number "HRB 12345".
 * Together with the VAT ID it identifies the seller of an e-invoice (BR-CO-26).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organization', function (Blueprint $table) {
            $table->string('registration_id', 64)->default('')->after('tax_number');
        });
    }

    public function down(): void
    {
        Schema::table('organization', function (Blueprint $table) {
            $table->dropColumn('registration_id');
        });
    }
};
