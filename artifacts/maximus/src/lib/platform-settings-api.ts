import { ApiRequestError, requestJson } from './api-request';

export type SellerWalletMaturityMode = 'AUTOMATIC' | 'DAYS' | 'WEEKS';

export type SellerWalletMaturityPolicy = {
  mode: SellerWalletMaturityMode;
  value: number | null;
  label: string;
};

export type SellerWalletWithdrawalFeePolicy = {
  amount: number;
  label: string;
};

export type PublicRegistrationPolicy = {
  enabled: boolean;
  label: string;
};

export type EcommerceCommissionPolicy = {
  providerPercent: number;
  maximusPercent: number;
  totalPercent: number;
  sellerPercent: number;
  label: string;
};

export type MaximusWallet = {
  currency: 'XOF';
  availableBalance: number;
  reservedBalance: number;
  totalCredited: number;
  payoutProvider: 'WAVE';
  payoutMobile: string;
  payoutName: string;
};

export type MaximusWithdrawalStatus = 'PROCESSING' | 'SUCCEEDED' | 'FAILED';

export type MaximusWithdrawal = {
  id: string;
  amount: number;
  fee: number;
  netAmount: number;
  totalDebit: number;
  provider: 'WAVE';
  mobile: string;
  beneficiaryName: string;
  status: MaximusWithdrawalStatus;
  providerPayoutId: string | null;
  failureReason: string;
  requestedAt: string;
  processedAt: string | null;
};

export type MaximusWalletLedgerEntry = {
  id: string;
  type: string;
  direction: 'CREDIT' | 'DEBIT';
  amount: number;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: string;
};

export type MaximusWalletBootstrap = {
  wallet: MaximusWallet;
  withdrawals: MaximusWithdrawal[];
  ledger: MaximusWalletLedgerEntry[];
  commissionPolicy: EcommerceCommissionPolicy;
};

export type PendingCounterCashDeposit = {
  id: string;
  companyId: string;
  amount: number;
  currency: 'XOF' | 'EUR' | 'USD';
  reference: string;
  note: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submittedAt: string;
  reviewedAt: string | null;
  reviewNote: string;
  sales: number;
};

export type DiagnosticTokenStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED';

export type DiagnosticTokenSummary = {
  id: string;
  tokenPrefix: string;
  label: string;
  scope: string;
  status: DiagnosticTokenStatus;
  expiresAt: string;
  lastUsedAt: string | null;
  createdAt: string;
};

export type IssuedDiagnosticToken = {
  id: string;
  token: string;
  tokenPrefix: string;
  label: string;
  scope: string;
  expiresAt: string;
};

export class PlatformSettingsRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'PlatformSettingsRequestError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    return await requestJson<T>(path, init, { fallbackMessage: 'Les paramètres plateforme sont indisponibles.' });
  } catch (cause) {
    if (cause instanceof ApiRequestError) {
      throw new PlatformSettingsRequestError(cause.message, cause.status);
    }
    throw cause;
  }
}

export const platformSettingsApi = {
  publicRegistration: () => request<PublicRegistrationPolicy>('/platform-settings/public-registration'),
  updatePublicRegistration: (payload: { enabled: boolean }) =>
    request<PublicRegistrationPolicy>('/platform-settings/public-registration', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  sellerWalletMaturity: () => request<SellerWalletMaturityPolicy>('/platform-settings/seller-wallet-maturity'),
  updateSellerWalletMaturity: (payload: {
    mode: SellerWalletMaturityMode;
    value?: number;
  }) =>
    request<SellerWalletMaturityPolicy>('/platform-settings/seller-wallet-maturity', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  sellerWalletWithdrawalFee: () => request<SellerWalletWithdrawalFeePolicy>('/platform-settings/seller-wallet-withdrawal-fee'),
  updateSellerWalletWithdrawalFee: (payload: { amount: number }) =>
    request<SellerWalletWithdrawalFeePolicy>('/platform-settings/seller-wallet-withdrawal-fee', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  ecommerceCommission: () => request<EcommerceCommissionPolicy>('/platform-settings/ecommerce-commission'),
  updateEcommerceCommission: (payload: { providerPercent: number; maximusPercent: number }) =>
    request<EcommerceCommissionPolicy>('/platform-settings/ecommerce-commission', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  maximusWallet: () => request<MaximusWalletBootstrap>('/platform-settings/maximus-wallet'),
  pendingCounterCashDeposits: () =>
    request<{ deposits: PendingCounterCashDeposit[] }>('/platform-settings/maximus-wallet/counter-deposits'),
  reviewCounterCashDeposit: (id: string, payload: { decision: 'APPROVE' | 'REJECT'; note?: string }) =>
    request<{ deposit: PendingCounterCashDeposit }>(`/platform-settings/maximus-wallet/counter-deposits/${encodeURIComponent(id)}/review`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateMaximusPayoutAccount: (payload: { provider: 'WAVE'; mobile: string; beneficiaryName: string }) =>
    request<MaximusWallet>('/platform-settings/maximus-wallet/payout-account', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  requestMaximusWithdrawal: (payload: {
    amount: number;
    provider: 'WAVE';
    mobile: string;
    beneficiaryName: string;
    idempotencyKey: string;
  }) =>
    request<{ withdrawal: MaximusWithdrawal }>('/platform-settings/maximus-wallet/withdrawals', {
      method: 'POST',
      headers: { 'Idempotency-Key': payload.idempotencyKey },
      body: JSON.stringify(payload),
    }),
  diagnosticTokens: async () => request<{ tokens: DiagnosticTokenSummary[] }>('/platform-settings/diagnostic-tokens'),
  createDiagnosticToken: (payload: { label: string; expiresInHours: number }) =>
    request<IssuedDiagnosticToken>('/platform-settings/diagnostic-tokens', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  revokeDiagnosticToken: (id: string) =>
    request<{ ok: true }>(`/platform-settings/diagnostic-tokens/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};