import { useState, type FormEvent } from 'react';
import { Banknote } from 'lucide-react';
import { Button } from '@workspace/maximus-design-system/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/maximus-design-system/components/ui/card';
import { Input } from '@workspace/maximus-design-system/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/maximus-design-system/components/ui/select';
import type { EcommerceExpensesBootstrap, EcommercePosExpense } from '@/lib/ecommerce-api';
import { EcommerceExpenseReportPanel } from '@/pages/ecommerce-expense-report-panel';

type EcommerceExpensesPanelProps = {
  companyId: string;
  preview?: boolean;
  data: EcommerceExpensesBootstrap;
  mode: 'PERSONAL' | 'INVESTMENT';
  canCreate: boolean;
  onCreateExpense(input: {
    type: EcommercePosExpense['type'];
    amount: number;
    description?: string;
    expenseDate: string;
    categoryId?: string;
  }): Promise<void>;
};

const localDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const money = (amount: number, currency: EcommerceExpensesBootstrap['currency']) =>
  `${new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: currency === 'XOF' ? 0 : 2,
  }).format(amount)} ${currency}`;

export default function EcommerceExpensesPanel({ companyId, preview = false, data, mode, canCreate, onCreateExpense }: EcommerceExpensesPanelProps) {
  const [type] = useState<EcommercePosExpense['type']>(mode);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('__none__');
  const [expenseDate, setExpenseDate] = useState(localDate);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const summary = data.expenseSummary;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!canCreate || pending || !Number.isSafeInteger(numericAmount) || numericAmount < 1) return;
    setPending(true);
    setError('');
    try {
      await onCreateExpense({
        type,
        amount: numericAmount,
        description: description.trim(),
        expenseDate,
        ...(categoryId !== '__none__' ? { categoryId } : {}),
      });
      setAmount('');
      setDescription('');
      setCategoryId('__none__');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La dépense n’a pas pu être enregistrée.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-5" data-testid={`panel-ecommerce-${mode === 'INVESTMENT' ? 'investments' : 'expenses'}`}>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5" aria-label="Résumé des dépenses">
        <Card className="p-4"><p className="text-xs font-medium text-muted-foreground">Dépenses cumulées</p><p className="mt-2 text-xl font-semibold tabular-nums">{money(summary.total, data.currency)}</p></Card>
        <Card className="p-4"><p className="text-xs font-medium text-muted-foreground">Solde net cumulé</p><p className="mt-2 text-xl font-semibold tabular-nums">{money(summary.netTotal, data.currency)}</p><p className="mt-1 text-xs text-muted-foreground">CA brut − dépenses</p></Card>
        <Card className="p-4"><p className="text-xs font-medium text-muted-foreground">Investissements</p><p className="mt-2 text-xl font-semibold tabular-nums">{money(summary.investmentTotal, data.currency)}</p></Card>
        <Card className="p-4"><p className="text-xs font-medium text-muted-foreground">Dépenses personnelles</p><p className="mt-2 text-xl font-semibold tabular-nums">{money(summary.personalTotal, data.currency)}</p></Card>
        <Card className="p-4"><p className="text-xs font-medium text-muted-foreground">Solde caisse du jour</p><p className="mt-2 text-xl font-semibold tabular-nums">{money(summary.netToday, data.currency)}</p><p className="mt-1 text-xs text-muted-foreground">CA comptoir − dépenses du jour</p></Card>
      </section>

      <EcommerceExpenseReportPanel companyId={companyId} type={mode} preview={preview} />

      {canCreate && <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{mode === 'INVESTMENT' ? 'Enregistrer un investissement' : 'Enregistrer une dépense'}</CardTitle>
          <p className="text-sm text-muted-foreground">Le chiffre d’affaires brut reste séparé des sorties de caisse.</p>
        </CardHeader>
        <CardContent className="pt-0">
          <form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" onSubmit={submit}>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger aria-label="Catégorie"><SelectValue placeholder="Catégorie (facultative)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sans catégorie</SelectItem>
                {data.categories.map(category => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input aria-label="Montant de la dépense" type="number" min="1" step="1" required placeholder={`Montant (${data.currency})`} value={amount} onChange={event => setAmount(event.target.value)} />
            <Input aria-label={mode === 'INVESTMENT' ? 'Description de l’investissement' : 'Description de la dépense'} maxLength={500} placeholder="Description (facultative)" value={description} onChange={event => setDescription(event.target.value)} />
            <Input aria-label="Date de la dépense" type="date" required value={expenseDate} onChange={event => setExpenseDate(event.target.value)} />
            <Button disabled={pending || !amount} type="submit">{pending ? 'Enregistrement…' : 'Ajouter la dépense'}</Button>
            {error && <p className="text-sm text-destructive sm:col-span-2 xl:col-span-5" role="alert">{error}</p>}
          </form>
        </CardContent>
      </Card>}

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 pb-3">
          <div>
            <CardTitle className="text-base">Historique des dépenses</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Investissements et dépenses personnelles enregistrés.</p>
          </div>
          <span className="text-sm tabular-nums text-muted-foreground">{data.expenses.length}</span>
        </CardHeader>
        <CardContent className="pt-0">
          {data.expenses.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-5 py-8 text-center">
              <Banknote className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
              <p className="mt-2 font-medium">Aucune dépense enregistrée</p>
              <p className="mt-1 text-sm text-muted-foreground">Les dépenses ajoutées apparaîtront ici.</p>
            </div>
          ) : <div className="space-y-2">
            {data.expenses.map(expense => (
              <article className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3 last:border-0" key={expense.id}>
                <div className="min-w-0">
                  <p className="font-medium">{expense.categoryName || (expense.type === 'INVESTMENT' ? 'Investissement' : 'Dépense personnelle')}</p>
                  {expense.description && <p className="mt-0.5 break-words text-sm text-muted-foreground">{expense.description}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">{expense.expenseDate}</p>
                </div>
                <p className="shrink-0 font-semibold tabular-nums">{money(expense.amount, expense.currency)}</p>
              </article>
            ))}
          </div>}
        </CardContent>
      </Card>
    </div>
  );
}
