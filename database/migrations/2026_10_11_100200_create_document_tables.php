<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('documents', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('type', 16);
            $table->string('status', 16)->default('draft');
            $table->string('number', 64)->nullable()->unique();
            $table->date('date');
            $table->foreignUlid('customer_id')->nullable()->constrained('customers');
            $table->foreignUlid('contact_id')->nullable()->constrained('contacts');
            $table->date('service_date')->nullable();
            $table->date('service_date_end')->nullable();
            $table->date('due_date')->nullable();
            $table->date('valid_until')->nullable();
            $table->text('intro')->nullable();
            $table->text('closing')->nullable();
            $table->foreignUlid('template_id')->nullable()->constrained('templates');
            $table->string('locale', 2)->default('en');
            $table->json('custom')->nullable();
            $table->ulid('source_id')->nullable();
            $table->ulid('cancelled_by_id')->nullable();
            $table->timestamp('finalized_at')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->decimal('net_total', 15, 2)->default(0);
            $table->decimal('tax_total', 15, 2)->default(0);
            $table->decimal('gross_total', 15, 2)->default(0);
            $table->foreignUlid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->foreign('source_id')->references('id')->on('documents');
            $table->foreign('cancelled_by_id')->references('id')->on('documents');
            $table->index(['type', 'status']);
            $table->index('date');
        });

        Schema::create('position_groups', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('document_id')->constrained()->cascadeOnDelete();
            $table->string('title', 500)->nullable();
            $table->unsignedInteger('sort')->default(0);
            $table->timestamps();
        });

        Schema::create('positions', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('document_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('group_id')->constrained('position_groups')->cascadeOnDelete();
            $table->string('kind', 16);
            $table->string('title', 500)->default('');
            $table->text('description')->nullable();
            $table->decimal('quantity', 15, 4)->default(0);
            $table->foreignUlid('unit_id')->nullable()->constrained('units');
            $table->decimal('unit_price', 15, 4)->default(0);
            $table->foreignUlid('tax_rate_id')->nullable()->constrained('tax_rates');
            $table->json('custom')->nullable();
            $table->unsignedInteger('sort')->default(0);
            $table->timestamps();
        });

        Schema::create('document_snapshots', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('document_id')->unique()->constrained()->cascadeOnDelete();
            $table->json('data');
            $table->timestamps();
        });

        Schema::create('document_files', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('document_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 8);
            $table->string('path');
            $table->char('sha256', 64);
            $table->unsignedBigInteger('size');
            $table->timestamps();
            $table->unique(['document_id', 'kind']);
        });

        // survives DeleteDraft: document_id becomes NULL, the entry stays as protocol
        Schema::create('document_events', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('document_id')->nullable()->constrained()->nullOnDelete();
            $table->string('actor_type', 16);
            $table->string('actor_id', 64)->nullable();
            $table->string('action', 32);
            $table->json('payload')->nullable();
            $table->timestamps();
            $table->index(['document_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_events');
        Schema::dropIfExists('document_files');
        Schema::dropIfExists('document_snapshots');
        Schema::dropIfExists('positions');
        Schema::dropIfExists('position_groups');
        Schema::dropIfExists('documents');
    }
};
