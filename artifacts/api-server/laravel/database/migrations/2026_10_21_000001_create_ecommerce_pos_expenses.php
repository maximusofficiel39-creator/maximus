<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('ecommerce_pos_expenses')) {
            return;
        }

        Schema::create('ecommerce_pos_expenses', function (Blueprint $table): void {
            $table->string('id', 36)->primary();
            $table->string('company_id')->index();
            $table->string('created_by')->nullable();
            $table->string('type', 20);
            $table->text('description')->default('');
            $table->integer('amount');
            $table->string('currency', 3);
            $table->date('expense_date');
            $table->timestampsTz();
            $table->index(['company_id', 'expense_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ecommerce_pos_expenses');
    }
};
