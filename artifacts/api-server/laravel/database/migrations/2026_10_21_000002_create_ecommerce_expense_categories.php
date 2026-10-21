<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('ecommerce_expense_categories')) {
            Schema::create('ecommerce_expense_categories', function (Blueprint $table): void {
                $table->string('id', 36)->primary();
                $table->string('company_id')->index();
                $table->string('kind', 20);
                $table->string('name', 80);
                $table->string('slug', 100);
                $table->text('description')->default('');
                $table->boolean('is_active')->default(true);
                $table->unsignedInteger('sort_order')->default(0);
                $table->timestampsTz();
                $table->unique(['company_id', 'kind', 'slug']);
                $table->index(['company_id', 'kind', 'is_active', 'sort_order']);
            });
        }

        if (Schema::hasTable('ecommerce_pos_expenses') && ! Schema::hasColumn('ecommerce_pos_expenses', 'category_id')) {
            Schema::table('ecommerce_pos_expenses', function (Blueprint $table): void {
                $table->string('category_id', 36)->nullable()->index();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('ecommerce_pos_expenses') && Schema::hasColumn('ecommerce_pos_expenses', 'category_id')) {
            Schema::table('ecommerce_pos_expenses', function (Blueprint $table): void {
                $table->dropColumn('category_id');
            });
        }
        Schema::dropIfExists('ecommerce_expense_categories');
    }
};
