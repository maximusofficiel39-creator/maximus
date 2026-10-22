<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ecommerce_pos_wallet_deposits', function (Blueprint $table): void {
            $table->string('id', 36)->primary();
            $table->string('company_id')->index();
            $table->bigInteger('amount');
            $table->string('currency', 3);
            $table->string('reference', 120);
            $table->text('note')->default('');
            $table->string('status', 16)->default('PENDING')->index();
            $table->string('idempotency_key', 120)->nullable();
            $table->string('submitted_by')->nullable();
            $table->string('reviewed_by')->nullable();
            $table->timestampTz('submitted_at');
            $table->timestampTz('reviewed_at')->nullable();
            $table->text('review_note')->default('');
            $table->timestampsTz();
            $table->unique(['company_id', 'idempotency_key']);
        });

        Schema::create('ecommerce_pos_wallet_deposit_sales', function (Blueprint $table): void {
            $table->string('id', 36)->primary();
            $table->string('company_id')->index();
            $table->string('deposit_id', 36)->index();
            $table->string('sale_id')->index();
            $table->bigInteger('amount');
            $table->timestampsTz();
            $table->unique(['deposit_id', 'sale_id']);
            $table->index(['company_id', 'sale_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ecommerce_pos_wallet_deposit_sales');
        Schema::dropIfExists('ecommerce_pos_wallet_deposits');
    }
};
