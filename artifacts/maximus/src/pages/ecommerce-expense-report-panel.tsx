import { useEffect, useState } from 'react';
import { BarChart3, Download, RefreshCw } from 'lucide-react';
import { Button } from '@workspace/maximus-design-system/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/maximus-design-system/components/ui/card';
import { Input } from '@workspace/maximus-design-system/components/ui/input';
import { createEcommerceApi, type EcommerceExpenseReport, type EcommercePosExpense } from '@/lib/ecommerce-api';

type ReportType = EcommercePosExpense['type'];

const localDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const defaultStartDate = () => {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - 11);
  return localDate(date);
};

const money = (amount: number, currency: string) =>
  `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: currency === 'XOF' ? 0 : 2 }).format(amount)} ${currency}`;

const csvCell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;

function downloadReport(report: EcommerceExpenseReport, title: string) {
  const rows: Array<Array<string | number>> = [
    [title],
    ['Période', report.filters.dateFrom, report.filters.dateTo],
    [],
    ['Synthèse par devise', 'Montant', 'Nombre d’opérations'],
    ...report.summaryByCurrency.map(item => [item.currency, item.total, item.transactionCount]),
    [],
    ['Répartition par catégorie', 'Devise', 'Montant', 'Nombre d’opérations'],
    ...report.categories.map(item => [item.categoryName, item.currency, item.total, item.transactionCount]),
    [],
    ['Évolution mensuelle', 'Devise', 'Montant', 'Nombre d’opérations'],
    ...report.months.map(item => [item.month, item.currency, item.total, item.transactionCount]),
  ];
  const content = `\uFEFF${rows.map(row => row.map(csvCell).join(';')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${report.type === 'INVESTMENT' ? 'rapport-investissements' : 'rapport-depenses'}-${report.filters.dateFrom}-${report.filters.dateTo}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function EcommerceExpenseReportPanel({
  companyId,
  type,
  preview = false,
}: {
  companyId: string;
  type: ReportType;
  preview?: boolean;
}) {
  const api = createEcommerceApi(companyId);
  const [dateFrom, setDateFrom] = useState(defaultStartDate);
  const [dateTo, setDateTo] = useState(() => localDate(new Date()));
  const [report, setReport] = useState<EcommerceExpenseReport | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const title = type === 'INVESTMENT' ? 'Rapport des investissements' : 'Rapport des dépenses';

  const load = async () => {
    if (preview || pending || dateFrom > dateTo) return;
    setPending(true);
    setError('');
    setReport(null);
    try {
      setReport(await api.expenseReport({ type, dateFrom, dateTo }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Le rapport n’a pas pu être chargé.');
    } finally {
      setPending(false);
    }
  };

  useEffect(() => {
    if (!preview) void load();
  }, [companyId, type, preview]);

  const currencyGroups = report?.summaryByCurrency ?? [];
  const monthly = report?.months ?? [];
  const categories = report?.categories ?? [];

  return (
    <Card data-testid={`expense-report-${type.toLowerCase()}`}>
      <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="size-4 text-primary" aria-hidden="true" />{title}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Totaux complets, regroupés par devise, catégorie et mois.</p>
        </div>
        {report && <Button type="button" variant="outline" onClick={() => downloadReport(report, title)}>
          <Download className="mr-2 size-4" aria-hidden="true" />Exporter CSV
        </Button>}
      </CardHeader>
      <CardContent className="space-y-5">
        <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={event => { event.preventDefault(); void load(); }}>
          <label className="grid gap-1.5 text-sm font-medium">
            Du
            <Input type="date" value={dateFrom} max={dateTo} disabled={pending} onChange={event => setDateFrom(event.target.value)} required />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Au
            <Input type="date" value={dateTo} min={dateFrom} disabled={pending} onChange={event => setDateTo(event.target.value)} required />
          </label>
          <Button type="submit" disabled={pending || preview || dateFrom > dateTo}>
            <RefreshCw className={`mr-2 size-4 ${pending ? 'animate-spin' : ''}`} aria-hidden="true" />
            {pending ? 'Calcul…' : 'Actualiser le rapport'}
          </Button>
        </form>
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        {preview ? <p className="rounded-md bg-muted p-4 text-sm text-muted-foreground">Le rapport apparaîtra ici lorsqu’une entreprise réelle sera sélectionnée.</p>
          : pending && !report ? <p className="text-sm text-muted-foreground">Calcul du rapport…</p>
            : report && currencyGroups.length === 0 ? <p className="rounded-md bg-muted p-4 text-sm text-muted-foreground">Aucune opération sur cette période.</p>
              : currencyGroups.map(group => {
                const currencyCategories = categories.filter(item => item.currency === group.currency);
                const currencyMonths = monthly.filter(item => item.currency === group.currency);
                return <section className="space-y-4" key={group.currency} aria-label={`Rapport ${group.currency}`}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Card className="p-4"><p className="text-sm text-muted-foreground">Total · {group.currency}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{money(group.total, group.currency)}</p></Card>
                    <Card className="p-4"><p className="text-sm text-muted-foreground">Nombre d’opérations</p><p className="mt-1 text-2xl font-semibold tabular-nums">{new Intl.NumberFormat('fr-FR').format(group.transactionCount)}</p></Card>
                  </div>
                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="overflow-hidden rounded-lg border border-border">
                      <h3 className="bg-muted px-4 py-3 text-sm font-semibold">Répartition par catégorie</h3>
                      {currencyCategories.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Aucune catégorie renseignée.</p>
                        : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
                          <thead><tr className="border-b border-border text-muted-foreground"><th className="px-4 py-2 font-medium">Catégorie</th><th className="px-4 py-2 text-right font-medium">Opérations</th><th className="px-4 py-2 text-right font-medium">Total</th></tr></thead>
                          <tbody>{currencyCategories.map(item => <tr className="border-b border-border last:border-0" key={`${item.categoryName}-${item.currency}`}><td className="px-4 py-3">{item.categoryName}</td><td className="px-4 py-3 text-right tabular-nums">{item.transactionCount}</td><td className="px-4 py-3 text-right font-medium tabular-nums">{money(item.total, item.currency)}</td></tr>)}</tbody>
                        </table></div>}
                    </div>
                    <div className="overflow-hidden rounded-lg border border-border">
                      <h3 className="bg-muted px-4 py-3 text-sm font-semibold">Évolution mensuelle</h3>
                      {currencyMonths.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Aucune opération enregistrée.</p>
                        : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
                          <thead><tr className="border-b border-border text-muted-foreground"><th className="px-4 py-2 font-medium">Mois</th><th className="px-4 py-2 text-right font-medium">Opérations</th><th className="px-4 py-2 text-right font-medium">Total</th></tr></thead>
                          <tbody>{currencyMonths.map(item => <tr className="border-b border-border last:border-0" key={`${item.month}-${item.currency}`}><td className="px-4 py-3 capitalize">{new Date(`${item.month}-01T12:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</td><td className="px-4 py-3 text-right tabular-nums">{item.transactionCount}</td><td className="px-4 py-3 text-right font-medium tabular-nums">{money(item.total, item.currency)}</td></tr>)}</tbody>
                        </table></div>}
                    </div>
                  </div>
                </section>;
              })}
      </CardContent>
    </Card>
  );
}
