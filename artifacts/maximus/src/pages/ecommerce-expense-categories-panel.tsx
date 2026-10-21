import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@workspace/maximus-design-system/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/maximus-design-system/components/ui/card';
import { Input } from '@workspace/maximus-design-system/components/ui/input';
import { createEcommerceApi, type EcommerceExpenseCategory } from '@/lib/ecommerce-api';

export function EcommerceExpenseCategoriesPanel({
  companyId,
  kind,
  canCreate,
  canModify,
}: {
  companyId: string;
  kind: EcommerceExpenseCategory['kind'];
  canCreate: boolean;
  canModify: boolean;
}) {
  const api = createEcommerceApi(companyId);
  const [categories, setCategories] = useState<EcommerceExpenseCategory[]>([]);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<EcommerceExpenseCategory | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const label = kind === 'INVESTMENT' ? 'Investissement' : 'Dépense';

  const refresh = async () => {
    setLoading(true);
    try {
      const result = await api.expenseCategories(kind);
      setCategories(result.categories);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de charger les catégories.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [companyId, kind]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (pending || !name.trim() || (editing ? !canModify : !canCreate)) return;
    setPending(true);
    try {
      if (editing) await api.updateExpenseCategory(editing.id, { name: name.trim() });
      else await api.createExpenseCategory({ kind, name: name.trim() });
      setName('');
      setEditing(null);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La catégorie n’a pas pu être enregistrée.');
    } finally {
      setPending(false);
    }
  };

  const toggleActive = async (category: EcommerceExpenseCategory) => {
    if (!canModify || pending) return;
    setPending(true);
    try {
      await api.updateExpenseCategory(category.id, { isActive: !category.isActive });
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La catégorie n’a pas pu être modifiée.');
    } finally {
      setPending(false);
    }
  };

  return <Card data-testid={`expense-categories-${kind.toLowerCase()}`}>
    <CardHeader>
      <CardTitle className="text-base">Catégories · {label}</CardTitle>
      <p className="text-sm text-muted-foreground">Ces catégories restent séparées des catégories de produits.</p>
    </CardHeader>
    <CardContent className="space-y-4">
      {(canCreate || editing) && <form className="flex flex-col gap-2 sm:flex-row" onSubmit={save}>
        <Input aria-label={`Nom de la catégorie ${label.toLowerCase()}`} maxLength={80} minLength={2} required value={name} onChange={event => setName(event.target.value)} placeholder={`Nouvelle catégorie ${label.toLowerCase()}`} />
        <div className="flex gap-2">
          {editing && <Button type="button" variant="outline" onClick={() => { setEditing(null); setName(''); }}>Annuler</Button>}
          <Button type="submit" disabled={pending || !name.trim()}>{pending ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Ajouter'}</Button>
        </div>
      </form>}
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      {loading ? <p className="text-sm text-muted-foreground">Chargement…</p>
        : categories.length === 0 ? <p className="text-sm text-muted-foreground">Aucune catégorie pour le moment.</p>
          : <ul className="divide-y divide-border">{categories.map(category => <li className="flex flex-wrap items-center justify-between gap-3 py-3" key={category.id}>
            <div><p className="font-medium">{category.name}</p><p className="text-xs text-muted-foreground">{category.isActive ? 'Active' : 'Inactive'}</p></div>
            {canModify && <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={pending} onClick={() => { setEditing(category); setName(category.name); }}>Modifier</Button>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => void toggleActive(category)}>{category.isActive ? 'Désactiver' : 'Activer'}</Button>
            </div>}
          </li>)}</ul>}
    </CardContent>
  </Card>;
}
