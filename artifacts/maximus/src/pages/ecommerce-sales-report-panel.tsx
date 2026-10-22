import './ecommerce-sales-report-panel.css';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Printer, RefreshCw, RotateCcw } from 'lucide-react';
import { Badge } from '@workspace/maximus-design-system/components/ui/badge';
import { Button } from '@workspace/maximus-design-system/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/maximus-design-system/components/ui/card';
import { Input } from '@workspace/maximus-design-system/components/ui/input';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@workspace/maximus-design-system/components/ui/pagination';
import { Skeleton } from '@workspace/maximus-design-system/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/maximus-design-system/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/maximus-design-system/components/ui/table';
import {
  createEcommerceApi,
  type EcommerceSalesReportResponse,
  type EcommerceSalesReportSale,
  type EcommerceSalesReportSource,
  type EcommerceSalesReportSourceFilter,
} from '@/lib/ecommerce-api';
import { EcommerceExpenseReportPanel } from '@/pages/ecommerce-expense-report-panel';

type SalesReportFilters = {
  dateFrom: string;
  dateTo: string;
  source: EcommerceSalesReportSourceFilter;
};

const PAGE_SIZE = 25;

const localDateInput = (date: Date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-');
const today = () => localDateInput(new Date());
const firstDayOfMonth = () => localDateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

const sourceLabels: Record<EcommerceSalesReportSource, string> = {
  ONLINE: 'En ligne',
  COUNTER: 'Comptoir',
};

const paymentMethodLabels: Record<NonNullable<EcommerceSalesReportSale['paymentMethod']>, string> = {
  CASH: 'Espèces',
  WAVE: 'Wave',
  ORANGE_MONEY: 'Orange Money',
};

const statusLabels: Record<string, string> = {
  NOUVELLE: 'Nouvelle',
  CONFIRMÉE: 'Confirmée',
  'EN PRÉPARATION': 'En préparation',
  EXPÉDIÉE: 'Expédiée',
  LIVRÉE: 'Livrée',
  ANNULÉE: 'Annulée',
  UNPAID: 'Non payée',
  PENDING: 'En attente',
  PAID: 'Payée',
  FAILED: 'Échec',
  REFUNDED: 'Remboursée',
};

function statusLabel(value: string) {
  return statusLabels[value] ?? value.replaceAll('_', ' ');
}

function formatMoney(amount: number, currency: EcommerceSalesReportSale['currency']) {
  const formatted = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: currency === 'XOF' ? 0 : 2,
  }).format(amount);
  return currency === 'INCONNUE' ? `${formatted} (devise inconnue)` : `${formatted} ${currency}`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(date);
}

function ReportSkeleton() {
  return (
    <div className="space-y-4" aria-label="Chargement du rapport" data-testid="status-sales-report-loading">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <Card className="p-4" key={index}>
            <Skeleton className="mb-3 h-3 w-24" />
            <Skeleton className="h-6 w-20" />
          </Card>
        ))}
      </div>
      <Card className="p-4">
        <Skeleton className="mb-4 h-9 w-full" />
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton className="mb-3 h-10 w-full" key={index} />
        ))}
      </Card>
    </div>
  );
}

function SourceBadge({ source }: { source: EcommerceSalesReportSource }) {
  return (
    <Badge variant={source === 'ONLINE' ? 'secondary' : 'outline'}>
      {sourceLabels[source]}
    </Badge>
  );
}

function PaymentStatusBadge({ status }: { status: string }) {
  const variant = status === 'PAID' ? 'secondary' : status === 'REFUNDED' ? 'destructive' : 'outline';
  return <Badge variant={variant}>{statusLabel(status)}</Badge>;
}

function SaleRows({ sales }: { sales: EcommerceSalesReportSale[] }) {
  return (
    <TableBody>
      {sales.map(sale => (
        <TableRow key={sale.id} data-testid={`row-sales-report-${sale.id}`}>
          <TableCell className="whitespace-nowrap font-medium">{sale.reference}</TableCell>
          <TableCell><SourceBadge source={sale.source} /></TableCell>
          <TableCell className="min-w-32">{sale.customerName || 'Client non renseigné'}</TableCell>
          <TableCell className="whitespace-nowrap">{formatDateTime(sale.createdAt)}</TableCell>
          <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums">
            {formatMoney(sale.amount, sale.currency)}
          </TableCell>
          <TableCell className="whitespace-nowrap">
            {sale.paymentMethod ? paymentMethodLabels[sale.paymentMethod] : sale.source === 'ONLINE' ? 'En ligne' : 'Non renseigné'}
          </TableCell>
          <TableCell className="whitespace-nowrap">
            <PaymentStatusBadge status={sale.paymentStatus} />
          </TableCell>
          <TableCell className="whitespace-nowrap">
            <Badge variant="outline">{statusLabel(sale.orderStatus)}</Badge>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  );
}

export default function EcommerceSalesReportPanel({
  companyId,
  availableSources,
  canViewSalesReport = true,
  availableExpenseReports = [],
  storeName,
  preview = false,
}: {
  companyId: string;
  availableSources: EcommerceSalesReportSource[];
  canViewSalesReport?: boolean;
  availableExpenseReports?: Array<'PERSONAL' | 'INVESTMENT'>;
  storeName?: string;
  preview?: boolean;
}) {
  const api = useMemo(() => createEcommerceApi(companyId), [companyId]);
  const initialFilters = useMemo<SalesReportFilters>(() => ({
    dateFrom: firstDayOfMonth(),
    dateTo: today(),
    source: 'ALL',
  }), []);
  const [dateFrom, setDateFrom] = useState(initialFilters.dateFrom);
  const [dateTo, setDateTo] = useState(initialFilters.dateTo);
  const [source, setSource] = useState<EcommerceSalesReportSourceFilter>('ALL');
  const [filters, setFilters] = useState<SalesReportFilters>(initialFilters);
  const [page, setPage] = useState(1);
  const [report, setReport] = useState<EcommerceSalesReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterError, setFilterError] = useState('');
  const [printing, setPrinting] = useState(false);
  const [printSales, setPrintSales] = useState<EcommerceSalesReportSale[] | null>(null);
  const [printSummary, setPrintSummary] = useState<EcommerceSalesReportResponse['summary'] | null>(null);
  const [printFilters, setPrintFilters] = useState<SalesReportFilters | null>(null);
  const [activeReport, setActiveReport] = useState<'SALES' | 'PERSONAL' | 'INVESTMENT'>(canViewSalesReport ? 'SALES' : availableExpenseReports[0] ?? 'SALES');
  const requestId = useRef(0);
  const allowedSources = report?.availableSources ?? availableSources;

  useEffect(() => {
    const currentRequest = ++requestId.current;
    if (!canViewSalesReport) {
      setLoading(false);
      setReport(null);
      return;
    }
    if (preview) {
      setReport({
        sales: [],
        availableSources,
        summary: {
          totalSales: 0,
          onlineSales: 0,
          counterSales: 0,
          paidSales: 0,
          refundedSales: 0,
          revenueByCurrency: [],
        },
        pagination: { page, perPage: PAGE_SIZE, total: 0, lastPage: 1 },
        filters: { ...filters },
      });
      setError('');
      setLoading(false);
      return () => {
        if (currentRequest === requestId.current) requestId.current += 1;
      };
    }
    setLoading(true);
    setError('');
    void api.salesReport({ ...filters, page, perPage: PAGE_SIZE })
      .then(response => {
        if (currentRequest !== requestId.current) return;
        setReport(response);
        setError('');
      })
      .catch(cause => {
        if (currentRequest !== requestId.current) return;
        setError(cause instanceof Error ? cause.message : 'Le rapport n’a pas pu être chargé.');
      })
      .finally(() => {
        if (currentRequest === requestId.current) setLoading(false);
      });
    return () => {
      if (currentRequest === requestId.current) requestId.current += 1;
    };
  }, [api, availableSources, canViewSalesReport, filters, page, preview]);

  useEffect(() => {
    if (source !== 'ALL' && report && !report.availableSources.includes(source)) {
      setSource('ALL');
    }
  }, [report, source]);

  useEffect(() => {
    if (!printSales) return;
    const handleAfterPrint = () => {
      setPrintSales(null);
      setPrintSummary(null);
      setPrintFilters(null);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, [printSales]);

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!dateFrom || !dateTo) {
      setFilterError('Choisissez une date de début et une date de fin.');
      return;
    }
    if (dateFrom > dateTo) {
      setFilterError('La date de début doit précéder ou égaler la date de fin.');
      return;
    }
    if (source !== 'ALL' && report && !report.availableSources.includes(source)) {
      setFilterError('Cette source n’est pas disponible pour le rapport.');
      return;
    }
    setFilterError('');
    setPage(1);
    setFilters({ dateFrom, dateTo, source });
  };

  const resetFilters = () => {
    const defaults = { ...initialFilters };
    setDateFrom(defaults.dateFrom);
    setDateTo(defaults.dateTo);
    setSource('ALL');
    setFilterError('');
    setPage(1);
    setFilters(defaults);
  };

  const printAllResults = async () => {
    if (preview) return;
    if (!dateFrom || !dateTo || dateFrom > dateTo) {
      setFilterError('Vérifiez les dates avant de préparer l’impression.');
      return;
    }
    const selectedFilters = { dateFrom, dateTo, source };
    setFilterError('');
    setPrinting(true);
    setError('');
    try {
      const first = await api.salesReport({ ...selectedFilters, page: 1, perPage: PAGE_SIZE });
      if (selectedFilters.source !== 'ALL' && !first.availableSources.includes(selectedFilters.source)) {
        throw new Error('La source sélectionnée n’est pas disponible pour cette période.');
      }
      const allSales = [...first.sales];
      for (let nextPage = 2; nextPage <= first.pagination.lastPage; nextPage += 1) {
        const response = await api.salesReport({
          ...selectedFilters,
          page: nextPage,
          perPage: PAGE_SIZE,
        });
        allSales.push(...response.sales);
      }
      setPrintSales(allSales);
      setPrintSummary(first.summary);
      setPrintFilters(selectedFilters);
      window.setTimeout(() => window.print(), 100);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Le rapport complet n’a pas pu être préparé.');
    } finally {
      setPrinting(false);
    }
  };

  const pagination = report?.pagination;
  const firstVisible = pagination && pagination.total > 0 ? (pagination.page - 1) * pagination.perPage + 1 : 0;
  const lastVisible = pagination ? Math.min(pagination.page * pagination.perPage, pagination.total) : 0;
  const pageNumbers = useMemo(() => {
    if (!pagination) return [];
    const start = Math.max(1, Math.min(pagination.page - 2, pagination.lastPage - 4));
    const end = Math.min(pagination.lastPage, start + 4);
    return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index);
  }, [pagination]);

  return (
    <div className="space-y-4" data-testid="panel-ecommerce-sales-report">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">E-commerce · activité financière</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">Rapports</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Consultez séparément les ventes, les dépenses et les investissements.
          </p>
        </div>
        {activeReport === 'SALES' && canViewSalesReport && <Button
          data-testid="button-sales-report-print"
          disabled={preview || printing || loading}
          onClick={() => void printAllResults()}
          type="button"
          variant="outline"
        >
          <Printer aria-hidden="true" />
          {printing ? 'Préparation du rapport…' : 'Imprimer / PDF'}
        </Button>}
      </section>

      <nav aria-label="Types de rapport" className="flex flex-wrap gap-2">
        {canViewSalesReport && <Button type="button" variant={activeReport === 'SALES' ? 'default' : 'outline'} onClick={() => setActiveReport('SALES')}>Ventes</Button>}
        {availableExpenseReports.includes('PERSONAL') && <Button type="button" variant={activeReport === 'PERSONAL' ? 'default' : 'outline'} onClick={() => setActiveReport('PERSONAL')}>Dépenses</Button>}
        {availableExpenseReports.includes('INVESTMENT') && <Button type="button" variant={activeReport === 'INVESTMENT' ? 'default' : 'outline'} onClick={() => setActiveReport('INVESTMENT')}>Investissements</Button>}
      </nav>

      {activeReport === 'PERSONAL' && availableExpenseReports.includes('PERSONAL') && <EcommerceExpenseReportPanel companyId={companyId} type="PERSONAL" preview={preview} />}
      {activeReport === 'INVESTMENT' && availableExpenseReports.includes('INVESTMENT') && <EcommerceExpenseReportPanel companyId={companyId} type="INVESTMENT" preview={preview} />}
      {activeReport === 'SALES' && canViewSalesReport && <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Période et source</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto_auto]" onSubmit={applyFilters}>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="sales-report-from">Du</label>
              <Input
                data-testid="input-sales-report-date-from"
                id="sales-report-from"
                onChange={event => setDateFrom(event.target.value)}
                type="date"
                value={dateFrom}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="sales-report-to">Au</label>
              <Input
                data-testid="input-sales-report-date-to"
                id="sales-report-to"
                onChange={event => setDateTo(event.target.value)}
                type="date"
                value={dateTo}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="sales-report-source">Source</label>
              <Select value={source} onValueChange={value => setSource(value as EcommerceSalesReportSourceFilter)}>
                <SelectTrigger id="sales-report-source" data-testid="select-sales-report-source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Toutes les sources</SelectItem>
                  {allowedSources.map(availableSource => (
                    <SelectItem key={availableSource} value={availableSource}>
                      {sourceLabels[availableSource]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="self-end" data-testid="button-sales-report-apply" type="submit">
              Appliquer
            </Button>
            <Button
              className="self-end"
              data-testid="button-sales-report-reset"
              onClick={resetFilters}
              type="button"
              variant="outline"
            >
              <RotateCcw aria-hidden="true" />
              Réinitialiser
            </Button>
          </form>
          {filterError && (
            <p className="mt-3 text-sm text-destructive" role="alert" data-testid="status-sales-report-filter-error">
              {filterError}
            </p>
          )}
        </CardContent>
      </Card>

      {error && (
        <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between" role="alert" data-testid="status-sales-report-error">
          <span className="flex items-center gap-2"><AlertCircle aria-hidden="true" className="size-4 shrink-0" />{error}</span>
          <Button
            className="shrink-0"
            data-testid="button-sales-report-retry"
            onClick={() => {
              setError('');
              setFilters(current => ({ ...current }));
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            <RefreshCw aria-hidden="true" />
            Réessayer
          </Button>
        </div>
      )}

      {loading && !report ? <ReportSkeleton /> : report && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Synthèse des ventes">
            <Card className="p-4" data-testid="metric-sales-report-total">
              <p className="text-xs font-medium text-muted-foreground">Ventes</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{report.summary.totalSales}</p>
            </Card>
            <Card className="p-4" data-testid="metric-sales-report-online">
              <p className="text-xs font-medium text-muted-foreground">En ligne</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{report.summary.onlineSales}</p>
            </Card>
            <Card className="p-4" data-testid="metric-sales-report-counter">
              <p className="text-xs font-medium text-muted-foreground">Au comptoir</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{report.summary.counterSales}</p>
            </Card>
            <Card className="p-4" data-testid="metric-sales-report-paid">
              <p className="text-xs font-medium text-muted-foreground">Payées</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{report.summary.paidSales}</p>
            </Card>
            <Card className="p-4" data-testid="metric-sales-report-refunded">
              <p className="text-xs font-medium text-muted-foreground">Remboursées</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{report.summary.refundedSales}</p>
            </Card>
          </section>

          <Card data-testid="card-sales-report-revenue">
            <CardHeader className="flex-row items-center justify-between gap-3 pb-3">
              <div>
                <CardTitle className="text-base">Chiffre d’affaires par devise</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Montants communiqués par le rapport, sans conversion.</p>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {report.summary.revenueByCurrency.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun montant disponible pour cette sélection.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-3">
                  {report.summary.revenueByCurrency.map(item => (
                    <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2" key={item.currency}>
                      <span className="text-sm text-muted-foreground">
                        {item.currency === 'INCONNUE' ? 'Devise non enregistrée' : item.currency}
                      </span>
                      <span className="font-semibold tabular-nums">{formatMoney(item.amount, item.currency)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="min-w-0" aria-busy={loading}>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 pb-3">
              <div>
                <CardTitle className="text-base">Détail des ventes</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {loading ? 'Mise à jour du rapport…' : `${firstVisible}–${lastVisible} sur ${pagination?.total ?? 0} vente${pagination?.total === 1 ? '' : 's'}`}
                </p>
              </div>
              {loading && <RefreshCw aria-label="Actualisation" className="size-4 animate-spin text-muted-foreground" />}
            </CardHeader>
            <CardContent className="pt-0">
              {report.sales.length === 0 && !loading ? (
                <div className="rounded-lg border border-dashed border-border px-5 py-10 text-center" data-testid="empty-sales-report">
                  <p className="font-medium">Aucune vente pour cette sélection</p>
                  <p className="mt-1 text-sm text-muted-foreground">Modifiez la période ou la source pour consulter d’autres ventes.</p>
                </div>
              ) : (
                <div className="w-full overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Référence</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                        <TableHead>Paiement</TableHead>
                        <TableHead>Statut paiement</TableHead>
                        <TableHead>Statut commande</TableHead>
                      </TableRow>
                    </TableHeader>
                    <SaleRows sales={report.sales} />
                  </Table>
                </div>
              )}

              {pagination && pagination.lastPage > 1 && (
                <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">Page {pagination.page} sur {pagination.lastPage}</p>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          aria-disabled={pagination.page <= 1}
                          className={pagination.page <= 1 ? 'pointer-events-none opacity-50' : ''}
                          data-testid="button-sales-report-previous-page"
                          href="#sales-report"
                          onClick={event => {
                            event.preventDefault();
                            if (pagination.page > 1) setPage(pagination.page - 1);
                          }}
                        />
                      </PaginationItem>
                      {pageNumbers.map(pageNumber => (
                        <PaginationItem key={pageNumber}>
                          <PaginationLink
                            href="#sales-report"
                            isActive={pageNumber === pagination.page}
                            data-testid={`button-sales-report-page-${pageNumber}`}
                            onClick={event => {
                              event.preventDefault();
                              setPage(pageNumber);
                            }}
                          >
                            {pageNumber}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          aria-disabled={pagination.page >= pagination.lastPage}
                          className={pagination.page >= pagination.lastPage ? 'pointer-events-none opacity-50' : ''}
                          data-testid="button-sales-report-next-page"
                          href="#sales-report"
                          onClick={event => {
                            event.preventDefault();
                            if (pagination.page < pagination.lastPage) setPage(pagination.page + 1);
                          }}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
      </>}

      {printSales && printSummary && printFilters && typeof document !== 'undefined' && createPortal(
        <section className="ecommerce-sales-report-print-root" aria-label="Version imprimable du rapport">
          <div className="ecommerce-sales-report-print">
          <header className="print-report-header">
            <p className="print-report-kicker">MAXIMUS ERP · E-commerce</p>
            {storeName && <p className="print-report-store">{storeName}</p>}
            <h1>Rapport des ventes</h1>
            <p>Période : {formatDate(printFilters.dateFrom)} — {formatDate(printFilters.dateTo)}</p>
            <p>Source : {printFilters.source === 'ALL' ? 'Toutes les sources' : sourceLabels[printFilters.source]}</p>
            <p>Édité le {formatDateTime(new Date().toISOString())} · {printSales.length} vente{printSales.length === 1 ? '' : 's'}</p>
          </header>
          <div className="print-report-summary">
            <p><strong>Ventes :</strong> {printSummary.totalSales}</p>
            <p><strong>En ligne :</strong> {printSummary.onlineSales}</p>
            <p><strong>Au comptoir :</strong> {printSummary.counterSales}</p>
            <p><strong>Payées :</strong> {printSummary.paidSales}</p>
            <p><strong>Remboursées :</strong> {printSummary.refundedSales}</p>
            {printSummary.revenueByCurrency.map(item => (
              <p key={item.currency}>
                <strong>
                  Chiffre d’affaires {item.currency === 'INCONNUE' ? 'sans devise enregistrée' : item.currency} :
                </strong> {formatMoney(item.amount, item.currency)}
              </p>
            ))}
          </div>
          <table className="print-report-table">
            <thead>
              <tr>
                <th>Référence</th><th>Source</th><th>Client</th><th>Date</th><th>Montant</th>
                <th>Paiement</th><th>Statut paiement</th><th>Statut commande</th>
              </tr>
            </thead>
            <tbody>
              {printSales.map(sale => (
                <tr key={sale.id}>
                  <td>{sale.reference}</td>
                  <td>{sourceLabels[sale.source]}</td>
                  <td>{sale.customerName || 'Client non renseigné'}</td>
                  <td>{formatDateTime(sale.createdAt)}</td>
                  <td>{formatMoney(sale.amount, sale.currency)}</td>
                  <td>{sale.paymentMethod ? paymentMethodLabels[sale.paymentMethod] : sale.source === 'ONLINE' ? 'En ligne' : 'Non renseigné'}</td>
                  <td>{statusLabel(sale.paymentStatus)}</td>
                  <td>{statusLabel(sale.orderStatus)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </section>
      , document.body)}
    </div>
  );
}