<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\ModuleAuthorization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

final class EcommerceExpenseCategoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $kind = $this->validatedKind($request);
        if ($denied = $this->authorizeKind($request, $kind, 'view')) {
            return $denied;
        }

        $companyId = $this->companyId($request);
        $categories = DB::table('ecommerce_expense_categories')
            ->where('company_id', $companyId)
            ->where('kind', $kind)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return response()->json([
            'categories' => $categories->map(fn (object $row): array => $this->category($row))->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $kind = $this->validatedKind($request);
        if ($denied = $this->authorizeKind($request, $kind, 'create')) {
            return $denied;
        }

        $input = Validator::make($request->all(), [
            'name' => ['required', 'string', 'min:2', 'max:80'],
            'description' => ['nullable', 'string', 'max:300'],
            'isActive' => ['sometimes', 'boolean'],
            'sortOrder' => ['sometimes', 'integer', 'min:0', 'max:100000'],
        ])->validate();
        $companyId = $this->companyId($request);
        $name = trim($input['name']);
        $slug = $this->uniqueSlug($companyId, $kind, $name);
        $row = [
            'id' => (string) Str::uuid(),
            'company_id' => $companyId,
            'kind' => $kind,
            'name' => $name,
            'slug' => $slug,
            'description' => trim((string) ($input['description'] ?? '')),
            'is_active' => (bool) ($input['isActive'] ?? true),
            'sort_order' => (int) ($input['sortOrder'] ?? 0),
            'created_at' => now(),
            'updated_at' => now(),
        ];
        DB::table('ecommerce_expense_categories')->insert($row);

        return response()->json(['category' => $this->category((object) $row)], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $companyId = $this->companyId($request);
        $category = DB::table('ecommerce_expense_categories')
            ->where('company_id', $companyId)
            ->where('id', $id)
            ->first();
        if (! $category) {
            return response()->json(['error' => 'Catégorie introuvable.'], 404);
        }
        if ($denied = $this->authorizeKind($request, (string) $category->kind, 'modify')) {
            return $denied;
        }

        $input = Validator::make($request->all(), [
            'name' => ['sometimes', 'required', 'string', 'min:2', 'max:80'],
            'description' => ['sometimes', 'nullable', 'string', 'max:300'],
            'isActive' => ['sometimes', 'boolean'],
            'sortOrder' => ['sometimes', 'integer', 'min:0', 'max:100000'],
        ])->validate();
        $name = trim((string) ($input['name'] ?? $category->name));
        $updates = ['updated_at' => now()];
        if (array_key_exists('name', $input)) {
            $updates['name'] = $name;
            $updates['slug'] = $this->uniqueSlug($companyId, (string) $category->kind, $name, $id);
        }
        if (array_key_exists('description', $input)) {
            $updates['description'] = trim((string) ($input['description'] ?? ''));
        }
        if (array_key_exists('isActive', $input)) {
            $updates['is_active'] = (bool) $input['isActive'];
        }
        if (array_key_exists('sortOrder', $input)) {
            $updates['sort_order'] = (int) $input['sortOrder'];
        }
        DB::table('ecommerce_expense_categories')
            ->where('company_id', $companyId)
            ->where('id', $id)
            ->update($updates);

        return response()->json([
            'category' => $this->category(DB::table('ecommerce_expense_categories')->where('company_id', $companyId)->where('id', $id)->first()),
        ]);
    }

    private function validatedKind(Request $request): string
    {
        return (string) Validator::make(
            ['kind' => strtoupper(trim((string) $request->query('kind', $request->input('kind', ''))))],
            ['kind' => ['required', 'in:EXPENSE,INVESTMENT']],
        )->validate()['kind'];
    }

    private function authorizeKind(Request $request, string $kind, string $action): ?JsonResponse
    {
        $actor = $request->attributes->get('authActor', []);
        $feature = $kind === 'INVESTMENT' ? 'investissements' : 'depenses';
        if (! is_array($actor) || ! ModuleAuthorization::allows($actor, 'ecommerce', $action, $feature)) {
            return response()->json(['error' => 'Cette action n’est pas autorisée pour cette catégorie.'], 403);
        }

        return null;
    }

    private function companyId(Request $request): string
    {
        return (string) $request->attributes->get('companyId', '');
    }

    private function uniqueSlug(string $companyId, string $kind, string $name, ?string $exceptId = null): string
    {
        $base = Str::slug($name) ?: 'categorie';
        $slug = $base;
        $suffix = 2;
        while (DB::table('ecommerce_expense_categories')
            ->where('company_id', $companyId)
            ->where('kind', $kind)
            ->where('slug', $slug)
            ->when($exceptId, fn ($query) => $query->where('id', '!=', $exceptId))
            ->exists()) {
            $slug = $base.'-'.$suffix++;
        }

        return $slug;
    }

    private function category(object $row): array
    {
        return [
            'id' => (string) $row->id,
            'kind' => (string) $row->kind,
            'name' => (string) $row->name,
            'slug' => (string) $row->slug,
            'description' => (string) $row->description,
            'isActive' => (bool) $row->is_active,
            'sortOrder' => (int) $row->sort_order,
        ];
    }
}
