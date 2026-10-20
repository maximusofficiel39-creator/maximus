<?php

use App\Http\Controllers\Api\StockController;
use Illuminate\Support\Facades\Route;

Route::middleware(['maximus.auth', 'maximus.company', 'maximus.subscription', 'maximus.demo-data', 'maximus.module:stocks'])->prefix('stock')->group(function (): void {
    Route::get('/bootstrap', [StockController::class, 'bootstrap']);
    Route::post('/categories', [StockController::class, 'createCategory']);
    Route::delete('/categories/{id}', [StockController::class, 'archiveCategory']);
    Route::post('/products', [StockController::class, 'createProduct']);
    Route::patch('/products/{id}', [StockController::class, 'updateProduct']);
    Route::get('/products/{id}/image', [StockController::class, 'productImage']);
    Route::delete('/products/{id}', [StockController::class, 'archiveProduct']);
    Route::post('/suppliers', [StockController::class, 'createSupplier']);
    Route::patch('/suppliers/{id}', [StockController::class, 'updateSupplier']);
    Route::delete('/suppliers/{id}', [StockController::class, 'archiveSupplier']);
    Route::post('/warehouses', [StockController::class, 'createWarehouse']);
    Route::patch('/warehouses/{id}', [StockController::class, 'updateWarehouse']);
    Route::delete('/warehouses/{id}', [StockController::class, 'archiveWarehouse']);
    Route::post('/warehouses/{warehouseId}/locations', [StockController::class, 'createLocation']);
    Route::patch('/locations/{id}', [StockController::class, 'updateLocation']);
    Route::delete('/locations/{id}', [StockController::class, 'archiveLocation']);
    Route::post('/movements', [StockController::class, 'createMovement']);
    Route::post('/requests', [StockController::class, 'createRequest']);
    Route::patch('/requests/{id}/status', [StockController::class, 'updateRequestStatus']);
    Route::patch('/requests/{id}', [StockController::class, 'updateRequest']);
    Route::delete('/requests/{id}', [StockController::class, 'deleteRequest']);
    Route::post('/inventories', [StockController::class, 'createInventory']);
    Route::post('/inventories/{id}/validate', [StockController::class, 'validateInventory']);
});