<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('organization', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('name')->default('');
            $table->string('street')->default('');
            $table->string('zip', 32)->default('');
            $table->string('city')->default('');
            $table->string('country', 2)->default('');
            $table->string('logo_path')->nullable();
            $table->string('vat_id', 32)->default('');
            $table->string('tax_number', 32)->default('');
            $table->string('iban', 42)->default('');
            $table->string('bic', 11)->default('');
            $table->string('bank_name')->default('');
            $table->string('email')->default('');
            $table->string('phone', 64)->default('');
            $table->string('website')->default('');
            $table->string('taxation_mode', 16)->default('regular');
            $table->string('locale', 2)->default('en');
            $table->json('custom')->nullable();
            $table->timestamps();
        });

        Schema::create('templates', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('version', 32)->default('1.0.0');
            $table->string('author')->default('');
            $table->string('license', 64)->default('');
            $table->text('description')->nullable();
            $table->boolean('built_in')->default(false);
            $table->json('manifest')->nullable();
            $table->longText('header')->nullable();
            $table->longText('body')->nullable();
            $table->longText('footer')->nullable();
            $table->longText('css')->nullable();
            $table->timestamps();
        });

        Schema::create('template_assets', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('template_id')->constrained()->cascadeOnDelete();
            $table->string('path');
            $table->string('mime', 128);
            $table->string('storage_path');
            $table->unsignedBigInteger('size');
            $table->timestamps();
            $table->unique(['template_id', 'path']);
        });

        Schema::create('text_blocks', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('name');
            $table->string('kind', 16);
            $table->text('body');
            $table->timestamps();
        });

        Schema::create('tax_rates', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('label', 64);
            $table->decimal('percent', 5, 2);
            $table->string('category', 2);
            $table->text('exemption_note')->nullable();
            $table->unsignedInteger('sort')->default(0);
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();
        });

        Schema::create('units', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('name', 64);
            $table->string('symbol', 16)->default('');
            $table->unsignedTinyInteger('decimals')->default(2);
            $table->string('code', 3)->default('');
            $table->unsignedInteger('sort')->default(0);
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();
        });

        Schema::create('field_definitions', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('scope', 16);
            $table->string('key', 64);
            $table->string('label');
            $table->string('type', 16);
            $table->boolean('required')->default(false);
            $table->json('default_value')->nullable();
            $table->text('help')->nullable();
            $table->json('options')->nullable();
            $table->json('doc_types')->nullable();
            $table->unsignedInteger('sort')->default(0);
            $table->timestamps();
            $table->unique(['scope', 'key']);
        });

        Schema::create('document_types', function (Blueprint $table) {
            $table->string('type', 16)->primary();
            $table->string('profile', 16)->default('basic');
            $table->foreignUlid('template_id')->nullable()->constrained('templates')->nullOnDelete();
            $table->foreignUlid('default_intro_block_id')->nullable()->constrained('text_blocks')->nullOnDelete();
            $table->foreignUlid('default_closing_block_id')->nullable()->constrained('text_blocks')->nullOnDelete();
            $table->unsignedSmallInteger('payment_term_days')->nullable();
            $table->unsignedSmallInteger('validity_days')->nullable();
            $table->timestamps();
        });

        // year NULL = configuration row per type (pattern, reset_yearly, running counter without reset);
        // with a yearly reset, one counter row per (doc_type, year)
        Schema::create('number_sequences', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('doc_type', 16);
            $table->unsignedSmallInteger('year')->nullable();
            $table->string('pattern', 64);
            $table->unsignedInteger('next_value')->default(1);
            $table->boolean('reset_yearly')->default(true);
            $table->timestamps();
            $table->unique(['doc_type', 'year']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('number_sequences');
        Schema::dropIfExists('document_types');
        Schema::dropIfExists('field_definitions');
        Schema::dropIfExists('units');
        Schema::dropIfExists('tax_rates');
        Schema::dropIfExists('text_blocks');
        Schema::dropIfExists('template_assets');
        Schema::dropIfExists('templates');
        Schema::dropIfExists('organization');
    }
};
