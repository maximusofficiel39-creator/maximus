import { requestJson } from './api-request';

export type EcommerceStoreStatus = 'DRAFT' | 'PUBLISHED' | 'SUSPENDED';
export type EcommerceProductStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type EcommerceProductType = 'SALE' | 'RENTAL';
export type EcommerceProductFulfillmentType = 'PHYSICAL' | 'DIGITAL';
export type EcommercePosSaleStatus = 'PAID' | 'REFUNDED';
export type EcommercePosPaymentMethod = 'CASH' | 'WAVE' | 'ORANGE_MONEY';
export type EcommerceRentalPeriod = 'JOUR' | 'SEMAINE' | 'MOIS';
export type EcommerceRentalStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type EcommerceOrderStatus = 'NOUVELLE' | 'CONFIRMÉE' | 'EN PRÉPARATION' | 'EXPÉDIÉE' | 'LIVRÉE' | 'ANNULÉE';
export type EcommerceDeliveryRequestStatus = 'DEMANDEE' | 'CONFIRMEE' | 'EN_COURS' | 'LIVREE' | 'ANNULEE';
export type EcommerceDeliveryServiceType = 'STANDARD' | 'URGENT';
export type SellerWithdrawalStatus = 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
export type PaymentProvider = 'WAVE' | 'ORANGE_MONEY';
export type PublicCheckoutPaymentMethod = PaymentProvider | 'CASH_ON_DELIVERY';

export interface EcommercePosSaleItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  stockBefore: number | null;
  stockAfter: number | null;
}

export interface EcommercePosSale {
  id: string;
  reference: string;
  customerName: string;
  paymentMethod: EcommercePosPaymentMethod;
  paymentReference: string | null;
  currency: 'XOF' | 'EUR' | 'USD';
  subtotal: number;
  total: number;
  amountReceived: number;
  changeDue: number;
  status: EcommercePosSaleStatus;
  createdAt: string;
  items: EcommercePosSaleItem[];
}

export interface EcommercePosExpense {
  id: string;
  type: 'INVESTMENT' | 'PERSONAL';
  description: string;
  categoryId: string | null;
  categoryName: string;
  amount: number;
  currency: 'XOF' | 'EUR' | 'USD';
  expenseDate: string;
  createdAt: string;
}

export interface EcommerceExpenseCategory {
  id: string;
  kind: 'EXPENSE' | 'INVESTMENT';
  name: string;
  slug: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
}

export interface EcommercePosSalesBootstrap {
  sales: EcommercePosSale[];
  summary: {
    currency: EcommercePosSale['currency'];
    todaySalesCount: number;
    todayRevenue: number;
    todayCashReceived: number;
    todayMobileMoneyReceived: number;
    todayChangeGiven: number;
  };
}

export interface EcommerceExpenseSummary {
  total: number;
  todayTotal: number;
  investmentTotal: number;
  personalTotal: number;
  netToday: number;
  netTotal: number;
}

export interface EcommerceExpensesBootstrap {
  currency: 'XOF' | 'EUR' | 'USD';
  type: EcommercePosExpense['type'];
  categories: Array<{ id: string; name: string }>;
  expenses: EcommercePosExpense[];
  expenseSummary: EcommerceExpenseSummary;
}

export interface EcommerceExpenseReport {
  type: EcommercePosExpense['type'];
  filters: { dateFrom: string; dateTo: string };
  summaryByCurrency: Array<{ currency: string; total: number; transactionCount: number }>;
  categories: Array<{ categoryName: string; currency: string; total: number; transactionCount: number }>;
  months: Array<{ month: string; currency: string; total: number; transactionCount: number }>;
}

export type EcommerceSalesReportSource = 'ONLINE' | 'COUNTER';
export type EcommerceSalesReportSourceFilter = 'ALL' | EcommerceSalesReportSource;

export interface EcommerceSalesReportSale {
  id: string;
  reference: string;
  source: EcommerceSalesReportSource;
  customerName: string;
  amount: number;
  currency: 'XOF' | 'EUR' | 'USD' | 'INCONNUE';
  orderStatus: string;
  paymentStatus: string;
  paymentMethod: EcommercePosPaymentMethod | null;
  createdAt: string;
}

export interface EcommerceSalesReportFilters {
  dateFrom: string;
  dateTo: string;
  source: EcommerceSalesReportSourceFilter;
  page?: number;
  perPage?: number;
}

export interface EcommerceSalesReportResponse {
  sales: EcommerceSalesReportSale[];
  availableSources: EcommerceSalesReportSource[];
  summary: {
    totalSales: number;
    onlineSales: number;
    counterSales: number;
    paidSales: number;
    refundedSales: number;
    revenueByCurrency: Array<{ currency: 'XOF' | 'EUR' | 'USD' | 'INCONNUE'; amount: number }>;
  };
  pagination: {
    page: number;
    perPage: number;
    total: number;
    lastPage: number;
  };
  filters: Pick<EcommerceSalesReportFilters, 'dateFrom' | 'dateTo' | 'source'>;
}

export interface CreateEcommercePosSale {
  lines: Array<{ productId: string; quantity: number }>;
  paymentMethod: EcommercePosPaymentMethod;
  amountReceived?: number;
  paymentConfirmed?: boolean;
  customerName?: string;
  idempotencyKey: string;
}

export type EcommerceRentalTransmission = 'MANUAL' | 'AUTOMATIC';
export type EcommerceRentalFuel = 'GASOLINE' | 'DIESEL' | 'HYBRID' | 'ELECTRIC';
export type EcommerceCarReservationStatus = 'PENDING_PAYMENT' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'PAYMENT_FAILED' | 'UNAVAILABLE';
export type EcommerceCarTripType = 'FAMILY' | 'BUSINESS';

export interface EcommerceLocationSettings {
  companyId: string;
  whatsapp: string;
  message: string;
  defaultDailyRate: number;
  defaultKmRate: number;
  defaultDeposit: number;
  policy: string;
}

export interface EcommerceCarReservation {
  id: string;
  rentalId: string;
  orderId: string;
  customerId: string | null;
  startsAt: string;
  endsAt: string;
  tripType: EcommerceCarTripType;
  departure: string;
  destination: string;
  distanceKm: number;
  durationMinutes: number;
  rateSnapshot: {
    dailyRate: number;
    kmRate: number;
    deposit: number;
    fees: number;
  };
  totalDetail: {
    days: number;
    distanceKm: number;
    durationMinutes: number;
    daily: number;
    distance: number;
    fees: number;
    deposit: number;
    total: number;
  };
  status: EcommerceCarReservationStatus;
  holdExpiresAt: string | null;
  invoiceAvailable: boolean;
  invoiceToken?: string;
  invoiceUrl?: string;
}

export interface EcommerceCarQuote {
  days: number;
  distanceKm: number;
  durationMinutes: number;
  daily: number;
  distance: number;
  fees: number;
  deposit: number;
  total: number;
}

export interface EcommerceStore {
  id: string;
  companyId: string;
  slug: string;
  name: string;
  description: string;
  status: EcommerceStoreStatus;
  homepageEnabled: boolean;
  bannerEnabled: boolean;
  currency: 'XOF' | 'EUR' | 'USD';
  primaryColor: string;
  accentColor: string;
  logoUrl: string;
  heroImages: string[];
  allowOrderAttachments: boolean;
}

export interface EcommerceOrderAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
}

export interface PublicShopFeatures {
  location: boolean;
  transport: boolean;
  immobilier: boolean;
  livraisons: boolean;
  ventePhysique: boolean;
  venteNumerique: boolean;
}

export type EcommerceDomainStatus = 'PENDING' | 'ACTIVE';

export interface EcommerceDomain {
  id: string;
  companyId: string;
  domain: string;
  targetHost: string;
  verificationName: string;
  verificationValue: string;
  status: EcommerceDomainStatus;
  lastError: string;
  verifiedAt: string | null;
}

export interface EcommerceProduct {
  id: string;
  companyId: string;
  name: string;
  slug: string;
  sku: string;
  description: string;
  category: string;
  categoryId: string | null;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  imageUrl: string;
  featured: boolean;
  status: EcommerceProductStatus;
  productType: EcommerceProductType;
  rentalPeriod: EcommerceRentalPeriod | null;
  fulfillmentType: EcommerceProductFulfillmentType;
  gallery?: string[];
  digitalFile?: {
    name: string;
    mime: string;
    size: number;
  } | null;
}

export interface EcommerceCategory {
  id: string;
  companyId: string;
  name: string;
  slug: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
}

export interface EcommerceRental {
  id: string;
  companyId: string;
  name: string;
  description: string;
  category: string;
  categoryId: string | null;
  imageUrl: string;
  price: number;
  billingUnit: EcommerceRentalPeriod;
  availability: number;
  isAvailable: boolean;
  brand?: string | null;
  model?: string | null;
  year?: number | null;
  seats?: number | null;
  transmission?: EcommerceRentalTransmission | null;
  fuel?: EcommerceRentalFuel | null;
  equipment?: string[] | null;
  gallery?: string[] | null;
  dailyRate?: number;
  kmRate?: number;
  deposit?: number;
  fees?: number;
  conditions?: string | null;
  instructions?: string | null;
  unavailablePeriods?: any[] | null;
  status: EcommerceRentalStatus;
  createdAt: string;
  updatedAt: string;
}

export interface EcommerceOrderItem {
  id: string;
  productId: string | null;
  rentalId?: string | null;
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  productType: EcommerceProductType;
  rentalPeriod: EcommerceRentalPeriod | null;
  imageUrl: string;
  fulfillmentType: EcommerceProductFulfillmentType;
  downloadUrl?: string | null;
}

export interface EcommerceDeliveryRequest {
  id: string;
  companyId?: string;
  customerId?: string | null;
  orderId?: string | null;
  reference: string;
  requesterName?: string;
  requesterEmail?: string;
  requesterPhone?: string;
  address: string;
  deliveryZoneId?: string | null;
  deliveryZoneName?: string | null;
  deliveryZoneFee?: number;
  serviceType: EcommerceDeliveryServiceType;
  desiredDate: string | null;
  note: string;
  status: EcommerceDeliveryRequestStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface EcommerceDeliveryZone {
  id: string;
  companyId?: string;
  name: string;
  description: string;
  fee: number;
  estimatedMinutes: number;
  isActive: boolean;
  sortOrder: number;
}

export interface EcommerceOrder {
  id: string;
  companyId: string;
  createdSource?: 'ONLINE' | 'MANUAL';
  reference: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string;
  shippingAddress: string;
  note: string;
  deliveryZoneId?: string | null;
  deliveryZoneName?: string | null;
  deliveryZoneFee?: number;
  total: number;
  status: EcommerceOrderStatus;
  paymentMethod?: PublicCheckoutPaymentMethod | null;
  paymentStatus: 'UNPAID' | 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  paymentCheckoutUrl: string | null;
  paymentFailureReason: string;
  createdAt: string;
  items: EcommerceOrderItem[];
  attachments?: EcommerceOrderAttachment[];
}

export interface EcommerceBootstrap {
  store: EcommerceStore;
  domains: EcommerceDomain[];
  categories: EcommerceCategory[];
  products: EcommerceProduct[];
  rentals: EcommerceRental[];
  orders: EcommerceOrder[];
  revenueSummary: Array<{
    currency: 'XOF' | 'EUR' | 'USD' | 'INCONNUE';
    total: number;
    online: number;
    counter: number;
    todayTotal: number;
    todayOnline: number;
    todayCounter: number;
  }>;
  deliveryZones: EcommerceDeliveryZone[];
  deliveryRequests: EcommerceDeliveryRequest[];
}

export interface SellerWallet {
  companyId: string;
  currency: 'XOF' | 'EUR' | 'USD';
  pendingBalance: number;
  availableBalance: number;
  reservedBalance: number;
  totalCredited: number;
  payoutProvider: 'WAVE';
  payoutMobile: string;
  payoutName: string;
}

export type SellerWalletMaturityPolicy = {
  mode: 'AUTOMATIC' | 'DAYS' | 'WEEKS';
  value: number | null;
  label: string;
};

export interface SellerWithdrawal {
  id: string;
  amount: number;
  fee: number;
  netAmount: number;
  totalDebit: number;
  provider: 'WAVE';
  mobile: string;
  beneficiaryName: string;
  status: SellerWithdrawalStatus;
  providerPayoutId: string | null;
  failureReason: string;
  requestedAt: string;
  processedAt: string | null;
}

export interface SellerWalletLedgerEntry {
  id: string;
  type: string;
  bucket: string;
  direction: 'CREDIT' | 'DEBIT';
  amount: number;
  referenceType: string | null;
  referenceId: string | null;
  availableAt: string | null;
  releasedAt: string | null;
  reversedAt: string | null;
  createdAt: string;
}

export interface SellerWalletBootstrap {
  wallet: SellerWallet;
  withdrawals: SellerWithdrawal[];
  ledger: SellerWalletLedgerEntry[];
  maturityPolicy: SellerWalletMaturityPolicy;
  withdrawalFee: {
    amount: number;
    label: string;
  };
}

export interface PublicImmobilierProperty {
  id: string;
  slug: string;
  title: string;
  propertyType: string;
  transactionType: 'SALE' | 'RENT';
  description: string;
  city: string;
  neighborhood: string;
  price: number;
  areaM2: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  furnished: boolean;
  featured: boolean;
  profileMedia: {
    id: string;
    url: string;
    mime: string;
    type: 'image' | 'video';
  } | null;
  gallery: Array<{
    id: string;
    url: string;
    mime: string;
    type: 'image' | 'video';
  }>;
}

export interface PublicShopBootstrap {
  store: Omit<EcommerceStore, 'id' | 'companyId'> & {
    seller: {
      name: string;
      email: string;
      phone: string;
      photoUrl: string;
    };
    transportPrimaryColor?: string;
    transportAccentColor?: string;
    enabledFeatures: PublicShopFeatures;
    locationSettings?: {
      whatsapp: string;
      message: string;
      policy: string;
    } | null;
  };
  deliveryZones: EcommerceDeliveryZone[];
  products: Array<Omit<EcommerceProduct, 'id' | 'companyId' | 'sku' | 'status'>>;
  rentals: Array<{
    id: string;
    productSlug?: string | null;
    name: string;
    description: string;
    category: string;
    categoryId: string | null;
    imageUrl: string;
    price: number;
    billingUnit: EcommerceRentalPeriod;
    availability: number;
    isAvailable: boolean;
    brand?: string | null;
    model?: string | null;
    year?: number | null;
    seats?: number | null;
    transmission?: EcommerceRentalTransmission | null;
    fuel?: EcommerceRentalFuel | null;
    equipment?: string | null;
     gallery?: string[] | null;
    dailyRate?: number;
    kmRate?: number;
    deposit?: number;
    fees?: number;
    conditions?: string | null;
    instructions?: string | null;
    unavailablePeriods?: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  immobilierProperties?: PublicImmobilierProperty[];
  immobilierListings: PublicImmobilierProperty[];
}

export type PublicDomainBootstrap = PublicShopBootstrap | { available: false };
export interface PublicPaymentStatus {
  reference: string;
  total: number;
  paymentStatus: EcommerceOrder['paymentStatus'];
  orderStatus: EcommerceOrderStatus;
  failureReason: string;
}

export interface EcommerceCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export interface EcommerceCustomerAddress {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export interface EcommerceCustomerCartLine {
  productId: string;
  productSlug: string;
  name: string;
  description: string;
  category: string;
  productType: EcommerceProductType;
  fulfillmentType: EcommerceProductFulfillmentType;
  rentalPeriod: EcommerceRentalPeriod | null;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  imageUrl: string;
  quantity: number;
}

export interface EcommerceCustomerOrder {
  id: string;
  reference: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string;
  shippingAddress: string;
  note: string;
  deliveryZoneId?: string | null;
  deliveryZoneName?: string | null;
  deliveryZoneFee?: number;
  total: number;
  status: EcommerceOrderStatus;
  paymentStatus: EcommerceOrder['paymentStatus'];
  paymentMethod?: PublicCheckoutPaymentMethod | null;
  paymentFailureReason: string;
  createdAt: string;
  items: EcommerceOrderItem[];
  attachments?: EcommerceOrderAttachment[];
}

export interface EcommerceCustomerBootstrap {
  customer: EcommerceCustomer;
  addresses: EcommerceCustomerAddress[];
  favoriteProductSlugs: string[];
  cart: EcommerceCustomerCartLine[];
  orders: EcommerceCustomerOrder[];
  deliveryRequests: EcommerceDeliveryRequest[];
}

async function request<T>(path: string, init?: RequestInit, options: { cacheTtlMs?: number } = {}): Promise<T> {
  return requestJson<T>(path, init, {
    fallbackMessage: 'Une erreur est survenue.',
    cacheTtlMs: options.cacheTtlMs,
  });
}

const json = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

export const createEcommerceApi = (companyId: string) => {
  const withCompany = (path: string) => `${path}${path.includes('?') ? '&' : '?'}companyId=${encodeURIComponent(companyId)}`;

  return {
    bootstrap: () => request<EcommerceBootstrap>(withCompany('/ecommerce/bootstrap')),
    posSales: () => request<EcommercePosSalesBootstrap>(withCompany('/ecommerce/pos-sales')),
    posExpenses: (type: EcommercePosExpense['type']) => request<EcommerceExpensesBootstrap>(withCompany(`/ecommerce/pos-expenses?type=${type}`)),
    expenseReport: (filters: { type: EcommercePosExpense['type']; dateFrom: string; dateTo: string }) => {
      const query = new URLSearchParams(filters);
      return request<EcommerceExpenseReport>(
        withCompany(`/ecommerce/expense-report?${query.toString()}`),
        undefined,
        { cacheTtlMs: 0 },
      );
    },
    salesReport: (filters: EcommerceSalesReportFilters) => {
      const query = new URLSearchParams({
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        source: filters.source,
        page: String(filters.page ?? 1),
        perPage: String(filters.perPage ?? 100),
      });
      return request<EcommerceSalesReportResponse>(
        withCompany(`/ecommerce/sales-report?${query.toString()}`),
        undefined,
        { cacheTtlMs: 0 },
      );
    },
    createPosSale: (body: CreateEcommercePosSale) => {
      const { idempotencyKey, ...payload } = body;
      return request<{ sale: EcommercePosSale }>(withCompany('/ecommerce/pos-sales'), {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Idempotency-Key': idempotencyKey },
      });
    },
    createPosExpense: (body: { type: EcommercePosExpense['type']; amount: number; description?: string; expenseDate: string; categoryId?: string }) =>
      request<{ expense: EcommercePosExpense }>(withCompany('/ecommerce/pos-expenses'), {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    expenseCategories: (kind: EcommerceExpenseCategory['kind']) =>
      request<{ categories: EcommerceExpenseCategory[] }>(withCompany(`/ecommerce/expense-categories?kind=${kind}`)),
    createExpenseCategory: (body: { kind: EcommerceExpenseCategory['kind']; name: string; description?: string; sortOrder?: number }) =>
      request<{ category: EcommerceExpenseCategory }>(withCompany('/ecommerce/expense-categories'), json(body)),
    updateExpenseCategory: (id: string, body: Partial<Pick<EcommerceExpenseCategory, 'name' | 'description' | 'isActive' | 'sortOrder'>>) =>
      request<{ category: EcommerceExpenseCategory }>(withCompany(`/ecommerce/expense-categories/${encodeURIComponent(id)}`), { method: 'PATCH', body: JSON.stringify(body) }),
    wallet: () => request<SellerWalletBootstrap>(withCompany('/ecommerce/wallet')),
    reconcilePayments: () => request<{ sync: { checked: number; updated: number; failed: number }; wallet: SellerWallet }>(withCompany('/ecommerce/wallet/reconcile'), { method: 'POST' }),
    updatePayoutAccount: (body: { provider: 'WAVE'; mobile: string; beneficiaryName: string }) =>
      request<SellerWallet>(withCompany('/ecommerce/wallet/payout-account'), { method: 'PATCH', body: JSON.stringify(body) }),
    requestWithdrawal: (body: { amount: number; provider?: 'WAVE'; mobile?: string; beneficiaryName?: string; idempotencyKey?: string }) =>
      request<{ withdrawal: SellerWithdrawal }>(withCompany('/ecommerce/wallet/withdrawals'), { method: 'POST', body: JSON.stringify(body), headers: { 'Idempotency-Key': body.idempotencyKey ?? crypto.randomUUID() } }),
    updateStore: (body: Partial<Omit<EcommerceStore, 'id' | 'companyId'>>) => request<EcommerceStore>(withCompany('/ecommerce/store'), { method: 'PATCH', body: JSON.stringify(body) }),
    uploadStoreLogo: async (file: File) => {
      const formData = new FormData();
      formData.append('image', file);
      return requestJson<EcommerceStore>(withCompany('/ecommerce/store/logo'), {
        method: 'POST',
        body: formData,
      }, { fallbackMessage: 'Le logo de la boutique n’a pas pu être envoyé.', timeoutMs: 90_000 });
    },
    uploadStoreHeroImages: async (files: File[]) => {
      const formData = new FormData();
      files.forEach(file => formData.append('images[]', file));
      return requestJson<EcommerceStore>(withCompany('/ecommerce/store/hero-images'), { method: 'POST', body: formData }, { fallbackMessage: 'Les images de bannière n’ont pas pu être envoyées.', timeoutMs: 120_000 });
    },
    deleteStoreHeroImage: (imageId: string) => request<EcommerceStore>(withCompany(`/ecommerce/store/hero-images/${encodeURIComponent(imageId)}`), { method: 'DELETE' }),
    createCategory: (body: { name: string; slug?: string; description?: string; isActive?: boolean; sortOrder?: number }) => request<EcommerceCategory>(withCompany('/ecommerce/categories'), json(body)),
    updateCategory: (id: string, body: Partial<Omit<EcommerceCategory, 'id' | 'companyId'>>) => request<EcommerceCategory>(withCompany(`/ecommerce/categories/${encodeURIComponent(id)}`), { method: 'PATCH', body: JSON.stringify(body) }),
    deleteCategory: (id: string) => request<{ ok: true }>(withCompany(`/ecommerce/categories/${encodeURIComponent(id)}`), { method: 'DELETE' }),
    createDomain: (domain: string) => request<EcommerceDomain>(withCompany('/ecommerce/domains'), { method: 'POST', body: JSON.stringify({ domain }) }),
    verifyDomain: (id: string) => request<EcommerceDomain>(withCompany(`/ecommerce/domains/${encodeURIComponent(id)}/verify`), { method: 'POST' }),
    deleteDomain: (id: string) => request<{ ok: true }>(withCompany(`/ecommerce/domains/${encodeURIComponent(id)}`), { method: 'DELETE' }),
    createProduct: (body: Omit<EcommerceProduct, 'id' | 'companyId' | 'slug'> & { slug?: string }) => request<EcommerceProduct>(withCompany('/ecommerce/products'), json(body)),
    updateProduct: (id: string, body: Partial<Omit<EcommerceProduct, 'id' | 'companyId'>>) => request<EcommerceProduct>(withCompany(`/ecommerce/products/${id}`), { method: 'PATCH', body: JSON.stringify(body) }),
    uploadDigitalFile: async (id: string, file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return requestJson<EcommerceProduct>(withCompany(`/ecommerce/products/${encodeURIComponent(id)}/digital-file`), {
        method: 'POST',
        body: formData,
      }, { fallbackMessage: 'Le fichier numérique n’a pas pu être envoyé.', timeoutMs: 90_000 });
    },
    uploadProductImage: async (id: string, file: File) => {
      const formData = new FormData();
      formData.append('image', file);
      return requestJson<EcommerceProduct>(withCompany(`/ecommerce/products/${encodeURIComponent(id)}/image`), {
        method: 'POST',
        body: formData,
      }, { fallbackMessage: 'La photo n’a pas pu être envoyée.', timeoutMs: 90_000 });
    },
    uploadProductGallery: async (id: string, files: File[]) => {
      const formData = new FormData();
      files.forEach(file => formData.append('images[]', file));
      return requestJson<EcommerceProduct>(withCompany(`/ecommerce/products/${encodeURIComponent(id)}/gallery`), { method: 'POST', body: formData }, { fallbackMessage: 'Les images du produit n’ont pas pu être envoyées.', timeoutMs: 120_000 });
    },
    deleteProductGalleryImage: (id: string, imageId: string) => request<EcommerceProduct>(withCompany(`/ecommerce/products/${encodeURIComponent(id)}/gallery/${encodeURIComponent(imageId)}`), { method: 'DELETE' }),
    archiveProduct: (id: string) => request<EcommerceProduct>(withCompany(`/ecommerce/products/${id}`), { method: 'DELETE' }),
      uploadRentalImage: async (id: string, file: File) => {
        const formData = new FormData();
        formData.append('image', file);
        return requestJson<EcommerceRental>(withCompany(`/ecommerce/rentals/${encodeURIComponent(id)}/image`), {
          method: 'POST',
          body: formData,
        }, { fallbackMessage: 'La photo n’a pas pu être envoyée.', timeoutMs: 90_000 });
      },
      uploadRentalGallery: async (id: string, files: File[]) => {
        const formData = new FormData();
        files.forEach(file => formData.append('images[]', file));
        return requestJson<EcommerceRental>(withCompany(`/ecommerce/rentals/${encodeURIComponent(id)}/gallery`), { method: 'POST', body: formData }, { fallbackMessage: 'Les images de la location n’ont pas pu être envoyées.', timeoutMs: 120_000 });
      },
      deleteRentalGalleryImage: (id: string, imageId: string) => request<EcommerceRental>(withCompany(`/ecommerce/rentals/${encodeURIComponent(id)}/gallery/${encodeURIComponent(imageId)}`), { method: 'DELETE' }),
      createRental: (body: any) =>
       request<EcommerceRental>(withCompany('/ecommerce/rentals'), json(body)),
      updateRental: (id: string, body: any) =>
       request<EcommerceRental>(withCompany(`/ecommerce/rentals/${encodeURIComponent(id)}`), { method: 'PATCH', body: JSON.stringify(body) }),
     updateRentalAvailability: (id: string, availability: number) =>
       request<EcommerceRental>(withCompany(`/ecommerce/rentals/${encodeURIComponent(id)}/availability`), { method: 'PATCH', body: JSON.stringify({ availability }) }),
     archiveRental: (id: string) => request<EcommerceRental>(withCompany(`/ecommerce/rentals/${encodeURIComponent(id)}`), { method: 'DELETE' }),
    createDeliveryZone: (body: { name: string; description?: string; fee?: number; estimatedMinutes?: number; isActive?: boolean; sortOrder?: number }) =>
      request<EcommerceDeliveryZone>(withCompany('/ecommerce/delivery-zones'), json(body)),
    updateDeliveryZone: (id: string, body: Partial<Omit<EcommerceDeliveryZone, 'id' | 'companyId'>>) =>
      request<EcommerceDeliveryZone>(withCompany(`/ecommerce/delivery-zones/${encodeURIComponent(id)}`), { method: 'PATCH', body: JSON.stringify(body) }),
    deleteDeliveryZone: (id: string) =>
      request<{ ok: true }>(withCompany(`/ecommerce/delivery-zones/${encodeURIComponent(id)}`), { method: 'DELETE' }),
     getLocationSettings: () => request<EcommerceLocationSettings>(withCompany('/ecommerce/location/settings')),
     updateLocationSettings: (body: Partial<EcommerceLocationSettings>) => request<EcommerceLocationSettings>(withCompany('/ecommerce/location/settings'), { method: 'PUT', body: JSON.stringify(body) }),
     getLocationReservations: () => request<EcommerceCarReservation[]>(withCompany('/ecommerce/location/reservations')),
     updateLocationReservationStatus: (id: string, status: EcommerceCarReservationStatus) => request<EcommerceCarReservation>(withCompany(`/ecommerce/location/reservations/${encodeURIComponent(id)}/status`), { method: 'PATCH', body: JSON.stringify({ status }) }),
    updateOrderStatus: (id: string, status: EcommerceOrderStatus) => request<EcommerceOrder>(withCompany(`/ecommerce/orders/${id}/status`), { method: 'PATCH', body: JSON.stringify({ status }) }),
    createCompanyOrder: (body: { customerName: string; customerEmail?: string; customerPhone?: string; shippingAddress?: string; note?: string; items: Array<{ productId: string; quantity: number }> }) =>
      request<EcommerceOrder>(withCompany('/ecommerce/orders'), json(body)),
    deliveryRequests: () => request<{ deliveryRequests: EcommerceDeliveryRequest[] }>(withCompany('/ecommerce/delivery-requests')),
    updateDeliveryRequestStatus: (id: string, status: EcommerceDeliveryRequestStatus) => request<EcommerceDeliveryRequest>(withCompany(`/ecommerce/delivery-requests/${encodeURIComponent(id)}/status`), { method: 'PATCH', body: JSON.stringify({ status }) }),
  };
};

type PublicOrderCreateBody = {
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddress: string;
  deliveryZoneId?: string;
  paymentMethod?: PublicCheckoutPaymentMethod;
  note?: string;
  idempotencyKey?: string;
  items: { productSlug?: string; rentalId?: string; quantity: number }[];
  attachments?: File[];
};

function publicOrderRequestBody(body: PublicOrderCreateBody): BodyInit {
  const { attachments = [], items, ...fields } = body;
  if (attachments.length === 0) return JSON.stringify({ ...fields, items });

  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) formData.append(key, String(value));
  });
  items.forEach((item, index) => {
    Object.entries(item).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(`items[${index}][${key}]`, String(value));
      }
    });
  });
  attachments.forEach(file => formData.append('attachments[]', file, file.name));
  return formData;
}

export const publicEcommerceApi = {
  bootstrap: (slug: string) => request<PublicShopBootstrap>(`/shop/${encodeURIComponent(slug)}`),
  bootstrapDomain: () => request<PublicDomainBootstrap>('/shop-domain'),
  quoteLocation: (slug: string, id: string, params: { startsAt: string; endsAt: string; departure: string; destination: string }) => request<EcommerceCarQuote>(`/shop/${encodeURIComponent(slug)}/location/${encodeURIComponent(id)}/quote?startsAt=${encodeURIComponent(params.startsAt)}&endsAt=${encodeURIComponent(params.endsAt)}&departure=${encodeURIComponent(params.departure)}&destination=${encodeURIComponent(params.destination)}`),
  quoteDomainLocation: (id: string, params: { startsAt: string; endsAt: string; departure: string; destination: string }) => request<EcommerceCarQuote>(`/shop-domain/location/${encodeURIComponent(id)}/quote?startsAt=${encodeURIComponent(params.startsAt)}&endsAt=${encodeURIComponent(params.endsAt)}&departure=${encodeURIComponent(params.departure)}&destination=${encodeURIComponent(params.destination)}`),
  reserveLocation: (slug: string, body: { rentalId: string; startsAt: string; endsAt: string; tripType: EcommerceCarTripType; departure: string; destination: string; customerName: string; customerEmail: string; customerPhone?: string; }, idempotencyKey?: string) => request<EcommerceCarReservation>(`/shop/${encodeURIComponent(slug)}/location/reservations`, { method: 'POST', body: JSON.stringify(body), headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined }),
  reserveDomainLocation: (body: { rentalId: string; startsAt: string; endsAt: string; tripType: EcommerceCarTripType; departure: string; destination: string; customerName: string; customerEmail: string; customerPhone?: string; }, idempotencyKey?: string) => request<EcommerceCarReservation>('/shop-domain/location/reservations', { method: 'POST', body: JSON.stringify(body), headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined }),
  createOrder: (slug: string, body: PublicOrderCreateBody) => request<{ id: string; reference: string; total: number; paymentStatus: string; paymentMethod?: PublicCheckoutPaymentMethod | null }>(`/shop/${encodeURIComponent(slug)}/orders`, { method: 'POST', body: publicOrderRequestBody(body) }),
  createDomainOrder: (body: PublicOrderCreateBody) => request<{ id: string; reference: string; total: number; paymentStatus: string; paymentMethod?: PublicCheckoutPaymentMethod | null }>('/shop-domain/orders', { method: 'POST', body: publicOrderRequestBody(body) }),
  createDeliveryRequest: (slug: string, body: { requesterName: string; requesterEmail: string; requesterPhone?: string; address: string; deliveryZoneId?: string; serviceType: EcommerceDeliveryServiceType; desiredDate?: string; note?: string }) => request<EcommerceDeliveryRequest>(`/shop/${encodeURIComponent(slug)}/delivery-requests`, { method: 'POST', body: JSON.stringify(body) }),
  createDomainDeliveryRequest: (body: { requesterName: string; requesterEmail: string; requesterPhone?: string; address: string; deliveryZoneId?: string; serviceType: EcommerceDeliveryServiceType; desiredDate?: string; note?: string }) => request<EcommerceDeliveryRequest>('/shop-domain/delivery-requests', { method: 'POST', body: JSON.stringify(body) }),
  createPayment: (slug: string, orderId: string, body?: { redirectUrl?: string; provider?: PaymentProvider }) =>
    request<{ reference: string; total: number; checkoutUrl: string; paymentStatus: string }>(`/shop/${encodeURIComponent(slug)}/orders/${encodeURIComponent(orderId)}/payment`, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  createDomainPayment: (orderId: string, body?: { redirectUrl?: string; provider?: PaymentProvider }) =>
    request<{ reference: string; total: number; checkoutUrl: string; paymentStatus: string }>(`/shop-domain/orders/${encodeURIComponent(orderId)}/payment`, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  paymentStatus: (slug: string, orderId: string) =>
    request<PublicPaymentStatus>(`/shop/${encodeURIComponent(slug)}/orders/${encodeURIComponent(orderId)}/payment-status`),
  domainPaymentStatus: (orderId: string) =>
    request<PublicPaymentStatus>(`/shop-domain/orders/${encodeURIComponent(orderId)}/payment-status`),
};

export const createCustomerApi = (slug?: string) => {
  const prefix = slug ? `/shop/${encodeURIComponent(slug)}/customer` : '/shop-domain/customer';
  const endpoint = (path: string) => `${prefix}${path}`;

  return {
    session: () => request<{ customer: EcommerceCustomer | null }>(endpoint('/session')),
    register: (body: { name: string; email: string; phone?: string; password: string }) =>
      request<{ customer: EcommerceCustomer }>(endpoint('/register'), { method: 'POST', body: JSON.stringify(body) }),
    login: (body: { email: string; password: string }) =>
      request<{ customer: EcommerceCustomer }>(endpoint('/login'), { method: 'POST', body: JSON.stringify(body) }),
    logout: () => request<void>(endpoint('/logout'), { method: 'POST' }),
    bootstrap: () => request<EcommerceCustomerBootstrap>(endpoint('/bootstrap')),
    downloadDigitalProduct: (orderId: string, itemId: string) =>
      fetch(`/api${endpoint(`/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}/download`)}`, {
        credentials: 'include',
      }).then(async response => {
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error ?? 'Le téléchargement n’est pas disponible.');
        }
        const blob = await response.blob();
        const disposition = response.headers.get('content-disposition') ?? '';
        const match = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i);
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = decodeURIComponent(match?.[1] ?? match?.[2] ?? 'produit-numerique');
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }),
    downloadOrderAttachment: (orderId: string, attachmentId: string) =>
      fetch(`/api${endpoint(`/orders/${encodeURIComponent(orderId)}/attachments/${encodeURIComponent(attachmentId)}`)}`, {
        credentials: 'include',
      }).then(async response => {
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error ?? 'La pièce jointe n’est pas disponible.');
        }
        const blob = await response.blob();
        const disposition = response.headers.get('content-disposition') ?? '';
        const match = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i);
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = decodeURIComponent(match?.[1] ?? match?.[2] ?? 'piece-jointe');
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }),
    updateProfile: (body: { name: string; phone?: string }) =>
      request<EcommerceCustomer>(endpoint('/profile'), { method: 'PATCH', body: JSON.stringify(body) }),
    changePassword: (body: { currentPassword: string; newPassword: string }) =>
      request<{ ok: true }>(endpoint('/password'), { method: 'PATCH', body: JSON.stringify(body) }),
    createAddress: (body: Omit<EcommerceCustomerAddress, 'id'>) =>
      request<EcommerceCustomerAddress>(endpoint('/addresses'), { method: 'POST', body: JSON.stringify(body) }),
    updateAddress: (id: string, body: Partial<Omit<EcommerceCustomerAddress, 'id'>>) =>
      request<EcommerceCustomerAddress>(endpoint(`/addresses/${encodeURIComponent(id)}`), { method: 'PATCH', body: JSON.stringify(body) }),
    deleteAddress: (id: string) =>
      request<{ ok: true }>(endpoint(`/addresses/${encodeURIComponent(id)}`), { method: 'DELETE' }),
    toggleFavorite: (productSlug: string) =>
      request<{ favoriteProductSlugs: string[] }>(endpoint(`/favorites/${encodeURIComponent(productSlug)}`), { method: 'POST' }),
    putCartItem: (productSlug: string, quantity: number) =>
      request<{ cart: EcommerceCustomerCartLine[] }>(endpoint('/cart'), { method: 'PUT', body: JSON.stringify({ productSlug, quantity }) }),
    clearCart: () => request<{ cart: EcommerceCustomerCartLine[] }>(endpoint('/cart'), { method: 'DELETE' }),
    orders: () => request<{ orders: EcommerceCustomerOrder[] }>(endpoint('/orders')),
    order: (id: string) => request<EcommerceCustomerOrder>(endpoint(`/orders/${encodeURIComponent(id)}`)),
    deliveryRequests: () => request<{ deliveryRequests: EcommerceDeliveryRequest[] }>(endpoint('/delivery-requests')),
  };
};