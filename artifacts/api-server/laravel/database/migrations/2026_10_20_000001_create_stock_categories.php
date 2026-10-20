<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('stock_categories')) {
            Schema::create('stock_categories', function (Blueprint $table): void {
                $table->string('id')->primary();
                $table->string('company_id');
                $table->string('name', 120);
                $table->boolean('archived')->default(false);
                $table->timestampTz('created_at')->useCurrent();
                $table->timestampTz('updated_at')->useCurrent();
                $table->unique(['company_id', 'name']);
            });
        }

        if (! Schema::hasTable('stock_products')) {
            return;
        }

        $legacyCategories = DB::table('stock_products')
            ->select('company_id', 'category')
            ->distinct()
            ->get();

        foreach ($legacyCategories as $legacyCategory) {
            $name = trim((string) $legacyCategory->category);
            $name = $name !== '' ? mb_substr($name, 0, 120) : 'Divers';

            $exists = DB::table('stock_categories')
                ->where('company_id', $legacyCategory->company_id)
                ->where('name', $name)
                ->exists();
            if (! $exists) {
                DB::table('stock_categories')->insert([
                    'id' => 'stock-category-'.Str::uuid(),
                    'company_id' => $legacyCategory->company_id,
                    'name' => $name,
                    'archived' => false,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            $oldName = $legacyCategory->category;
            DB::table('stock_products')
                ->where('company_id', $legacyCategory->company_id)
                ->where(function ($query) use ($oldName): void {
                    $oldName === null
                        ? $query->whereNull('category')
                        : $query->where('category', $oldName);
                })
                ->update(['category' => $name]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_categories');
    }
};
