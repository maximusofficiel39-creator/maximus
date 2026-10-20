import { requestJson } from './api-request';

export type StockMovementType = 'ENTRÉE' | 'SORTIE' | 'TRANSFERT' | 'AJUSTEMENT+' | 'AJUSTEMENT-' | 'PERTE';
export type StockMovementInputType = StockMovementType;

export interface StockProduct {
  id: string;
  companyId: string;
  name: string;
  category: string;
  brand: string;
  sku: string;
  barcode: string;
  imageUrl: string;
  /** Legacy response compatibility; new product writes and responses omit this field. */
  unit?: string;
  minStock: number;
  maxStock: number;
  supplierId: string | null;
  description: string;
  archived: boolean;
}

export interface StockCategory { id: string; companyId: string; name: string; archived: boolean; }
export interface StockWarehouse {
  id: string;
  companyId: string;
  name: string;
  manager: string;
  address: string;
  archived: boolean;
}

export interface StockLocation { id: string; companyId: string; warehouseId: string; name: string; archived: boolean; }
export interface StockSupplier { id: string; companyId: string; name: string; contactName: string; email: string; phone: string; address: string; notes: string; archived: boolean; }
export interface StockBalance { id: string; companyId: string; productId: string; warehouseId: string; locationId: string | null; quantity: number; updatedAt: string; }
export interface StockMovement { id: string; companyId: string; productId: string; supplierId: string | null; warehouseId: string; destinationWarehouseId: string | null; locationId: string | null; requesterService: string | null; beneficiary: string | null; type: StockMovementType; quantity: number; reason: string; movementDate: string; userName: string; reference: string; comment: string; status: string; }
export interface StockRequest { id: string; companyId: string; productId: string; warehouseId: string; quantity: number; reason: string; status: 'EN ATTENTE' | 'APPROUVÉE' | 'REJETÉE'; createdBy: string; createdAt: string; updatedAt: string; }
export interface StockInventory { id: string; companyId: string; warehouseId: string; status: string; inventoryDate: string; notes: string; createdBy: string; validatedAt: string | null; }
export interface StockInventoryLine { id: string; inventoryId: string; productId: string; theoreticalQuantity: number; actualQuantity: number; difference: number; }
export interface StockBootstrap { products: StockProduct[]; categories: StockCategory[]; warehouses: StockWarehouse[]; locations: StockLocation[]; suppliers: StockSupplier[]; balances: StockBalance[]; movements: StockMovement[]; requests: StockRequest[]; inventories: StockInventory[]; inventoryLines: StockInventoryLine[]; }
export type StockBootstrapScope = 'all' | 'core' | 'operations' | 'inventory';

type StockProductInput = Omit<StockProduct, 'id' | 'companyId' | 'archived' | 'unit'> & { imageFile?: File | null };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return requestJson<T>(path, init, { fallbackMessage: 'Une erreur est survenue.' });
}

const json = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });
const productRequest = (method: 'POST' | 'PATCH', body: Partial<StockProduct> & { imageFile?: File | null }): RequestInit => {
  const { imageFile, ...fields } = body;
  if (!imageFile) {
    return { method, body: JSON.stringify(fields), headers: { 'Content-Type': 'application/json' } };
  }

  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value === undefined) return;
    formData.append(key, value === null ? '' : String(value));
  });
  formData.append('_imageUploadExpected', '1');
  formData.append('image', imageFile);
  if (method === 'PATCH') {
    formData.append('_method', 'PATCH');
    return { method: 'POST', body: formData };
  }
  return { method: 'POST', body: formData };
};

export type StockApi = ReturnType<typeof createStockApi>;

export const createStockApi = (companyId: string) => {
  const withCompany = (path: string) => `${path}${path.includes('?') ? '&' : '?'}companyId=${encodeURIComponent(companyId)}`;
  return {
    bootstrap: (scope: StockBootstrapScope = 'all') => request<Partial<StockBootstrap>>(withCompany(`/stock/bootstrap?scope=${scope}`)),
    createProduct: (body: StockProductInput) => request<StockProduct>(withCompany('/stock/products'), productRequest('POST', body)),
    updateProduct: (id: string, body: Partial<Omit<StockProduct, 'unit'>> & { imageFile?: File | null }) => request<StockProduct>(withCompany(`/stock/products/${id}`), productRequest('PATCH', body)),
    archiveProduct: (id: string) => request<StockProduct>(withCompany(`/stock/products/${id}`), { method: 'DELETE' }),
    createWarehouse: (body: { name: string; manager: string; address: string }) => request<StockWarehouse>(withCompany('/stock/warehouses'), json(body)),
    updateWarehouse: (id: string, body: Partial<StockWarehouse>) => request<StockWarehouse>(withCompany(`/stock/warehouses/${id}`), { method: 'PATCH', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }),
    archiveWarehouse: (id: string) => request<StockWarehouse>(withCompany(`/stock/warehouses/${id}`), { method: 'DELETE' }),
    createLocation: (warehouseId: string, name: string) => request<StockLocation>(withCompany(`/stock/warehouses/${warehouseId}/locations`), json({ name })),
    createSupplier: (body: Omit<StockSupplier, 'id' | 'companyId' | 'archived'>) => request<StockSupplier>(withCompany('/stock/suppliers'), json(body)),
    updateSupplier: (id: string, body: Partial<StockSupplier>) => request<StockSupplier>(withCompany(`/stock/suppliers/${id}`), { method: 'PATCH', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }),
     archiveSupplier: (id: string) => request<StockSupplier>(withCompany(`/stock/suppliers/${id}`), { method: 'DELETE' }),
     updateLocation: (id: string, name: string) => request<StockLocation>(withCompany(`/stock/locations/${id}`), { method: 'PATCH', body: JSON.stringify({ name }), headers: { 'Content-Type': 'application/json' } }),
     archiveLocation: (id: string) => request<StockLocation>(withCompany(`/stock/locations/${id}`), { method: 'DELETE' }),
    createMovement: (body: { productId: string; supplierId?: string | null; warehouseId: string; destinationWarehouseId?: string | null; locationId?: string | null; requesterService?: string | null; beneficiary?: string | null; type: StockMovementInputType; quantity: number; reason: string; movementDate?: string; userName: string; reference?: string; comment: string }) => request<StockMovement>(withCompany('/stock/movements'), json(body)),
    createCategory: (name: string) => request<StockCategory>(withCompany('/stock/categories'), json({ name })),
    archiveCategory: (id: string) => request<StockCategory>(withCompany(`/stock/categories/${id}`), { method: 'DELETE' }),
    createRequest: (body: { productId: string; warehouseId: string; quantity: number; reason: string; createdBy: string }) => request<StockRequest>(withCompany('/stock/requests'), json(body)),
    updateRequestStatus: (id: string, status: StockRequest['status']) => request<StockRequest>(withCompany(`/stock/requests/${id}/status`), { method: 'PATCH', body: JSON.stringify({ status }), headers: { 'Content-Type': 'application/json' } }),
     updateRequest: (id: string, body: Pick<StockRequest, 'productId' | 'warehouseId' | 'quantity' | 'reason'>) => request<StockRequest>(withCompany(`/stock/requests/${id}`), { method: 'PATCH', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }),
     deleteRequest: (id: string) => request<StockRequest>(withCompany(`/stock/requests/${id}`), { method: 'DELETE' }),
    createInventory: (body: { warehouseId: string; notes: string; lines: { productId: string; actualQuantity: number }[]; createdBy: string }) => request<StockInventory>(withCompany('/stock/inventories'), json(body)),
    validateInventory: (id: string) => request<StockInventory>(withCompany(`/stock/inventories/${id}/validate`), { method: 'POST', body: JSON.stringify({}) }),
  };
};
