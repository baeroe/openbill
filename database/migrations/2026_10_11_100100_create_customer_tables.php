<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customers', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('number', 32)->unique();
            $table->string('name');
            $table->string('street')->default('');
            $table->string('zip', 32)->default('');
            $table->string('city')->default('');
            $table->string('country', 2)->default('');
            $table->string('email')->default('');
            $table->string('vat_id', 32)->default('');
            $table->string('tax_treatment', 32)->default('domestic');
            $table->string('locale', 2)->nullable();
            $table->json('custom')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('contacts', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('customer_id')->constrained()->cascadeOnDelete();
            $table->string('salutation', 64)->default('');
            $table->string('first_name')->default('');
            $table->string('last_name')->default('');
            $table->string('position')->default('');
            $table->string('email')->default('');
            $table->string('phone', 64)->default('');
            $table->boolean('is_default')->default(false);
            $table->json('custom')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contacts');
        Schema::dropIfExists('customers');
    }
};
