import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Banknote, Check, Minus, Plus, Search, ShoppingBag, UserRound, X } from 'lucide-react';
import { Badge } from '@workspace/maximus-design-system/components/ui/badge';
import { Button } from '@workspace/maximus-design-system/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/maximus-design-system/components/ui/card';
import { Checkbox } from '@workspace/maximus-design-system/components/ui/checkbox';
import { Input } from '@workspace/maximus-design-system/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/maximus-design-system/components/ui/select';
import { Skeleton } from '@workspace/maximus-design-system/components/ui/skeleton';
import type {
  EcommercePosPaymentMethod,
  EcommercePosSale,
  EcommercePosSalesBootstrap,
  EcommerceProduct,
  EcommerceStore,
} from '@/lib/ecommerce-api';

type EcommercePosPanelProps = {
  idempotencyScope: string;
  products: EcommerceProduct[];
  sales: EcommercePosSale[];
  summary: EcommercePosSalesBootstrap['summary'];
  currency: EcommerceStore['currency'];
  canCreate: boolean;
  loading: boolean;
  onCreateSale(input: {
    lines: Array<{ productId: string; quantity: number }>;
    paymentMethod: EcommercePosPaymentMethod;
    amountReceived?: number;
    paymentConfirmed?: boolean;
    customerName?: string;
    idempotencyKey: string;
  }): Promise<EcommercePosSale>;
};

type CartLine = {
  product: EcommerceProduct;
  quantity: number;
};

const money = (amount: number, currency: EcommerceStore['currency']) =>
  `${new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: currency === 'XOF' ? 0 : 2,
  }).format(amount)} ${currency}`;

const dateTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

const paymentMethodLabels: Record<EcommercePosPaymentMethod, string> = {
  CASH: 'Espèces',
  WAVE: 'Wave',
  ORANGE_MONEY: 'Orange Money',
};

function createIdempotencyKey(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `pos-${globalThis.crypto.randomUUID()}`;
  }
  return `pos-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function PosLoadingState() {
  return (
    <div className="space-y-4" aria-label="Chargement du point de vente" data-testid="status-pos-loading">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <Card className="p-4" key={index}>
            <Skeleton className="mb-3 h-3 w-24" />
            <Skeleton className="h-6 w-32" />
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="p-4">
          <Skeleton className="mb-4 h-9 w-full" />
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => <Skeleton className="h-24 w-full" key={index} />)}
          </div>
        </Card>
        <Card className="p-4">
          <Skeleton className="mb-4 h-6 w-36" />
          <Skeleton className="mb-3 h-16 w-full" />
          <Skeleton className="h-10 w-full" />
        </Card>
      </div>
    </div>
  );
}

export default function EcommercePosPanel({
  idempotencyScope,
  products,
  sales,
  summary,
  currency,
  canCreate,
  loading,
  onCreateSale,
}: EcommercePosPanelProps) {
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<EcommercePosPaymentMethod>('CASH');
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [amountReceived, setAmountReceived] = useState('');
  const [pending, setPending] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [completedSale, setCompletedSale] = useState<EcommercePosSale | null>(null);
  const idempotencyKeysByPayload = useRef(new Map<string, string>());

  const availableProducts = useMemo(
    () => products.filter(product =>
      product.status === 'PUBLISHED'
      && product.productType === 'SALE'
      && product.fulfillmentType === 'PHYSICAL'
      && product.stock > 0,
    ),
    [products],
  );
  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fr-FR');
    if (!query) return availableProducts;
    return availableProducts.filter(product =>
      `${product.name} ${product.sku} ${product.category}`.toLocaleLowerCase('fr-FR').includes(query),
    );
  }, [availableProducts, search]);
  const cartLines = Object.values(cart);
  const total = cartLines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const received = Number(amountReceived) || 0;
  const changeDue = Math.max(0, received - total);
  const hasValidCash = Number.isFinite(received) && received >= total && received > 0;
  const hasValidPayment = paymentMethod === 'CASH'
    ? hasValidCash
    : paymentConfirmed;

  const addProduct = (product: EcommerceProduct) => {
    setCart(current => {
      const existing = current[product.id];
      const quantity = existing?.quantity ?? 0;
      if (quantity >= product.stock) return current;
      return { ...current, [product.id]: { product, quantity: quantity + 1 } };
    });
    setSubmitError('');
    setCompletedSale(null);
  };

  const adjustQuantity = (productId: string, delta: number) => {
    setCart(current => {
      const line = current[productId];
      if (!line) return current;
      const nextQuantity = line.quantity + delta;
      if (nextQuantity <= 0) {
        const next = { ...current };
        delete next[productId];
        return next;
      }
      if (nextQuantity > line.product.stock) return current;
      return { ...current, [productId]: { ...line, quantity: nextQuantity } };
    });
    setSubmitError('');
    setCompletedSale(null);
  };

  const submitSale = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreate || pending || !cartLines.length || !hasValidPayment) return;
    setPending(true);
    setSubmitError('');
    setCompletedSale(null);
    const payload = {
      lines: cartLines.map(({ product, quantity }) => ({ productId: product.id, quantity })),
      paymentMethod,
      ...(paymentMethod === 'CASH'
        ? { amountReceived: received }
        : { paymentConfirmed }),
      ...(customerName.trim() ? { customerName: customerName.trim() } : {}),
    };
    const fingerprint = JSON.stringify([idempotencyScope, payload]);
    const idempotencyKey = idempotencyKeysByPayload.current.get(fingerprint) ?? createIdempotencyKey();
    idempotencyKeysByPayload.current.set(fingerprint, idempotencyKey);
    try {
      const sale = await onCreateSale({ ...payload, idempotencyKey });
      setCompletedSale(sale);
      setCart({});
      setPaymentMethod('CASH');
      setPaymentConfirmed(false);
      setAmountReceived('');
      setCustomerName('');
      idempotencyKeysByPayload.current.clear();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'La vente n’a pas pu être enregistrée. Réessayez.');
    } finally {
      setPending(false);
    }
  };

  if (loading) return <PosLoadingState />;

  return (
    <div className="space-y-5" data-testid="panel-pos">
      <section
        aria-label="Résumé des ventes du jour"
        className="flex min-w-0 gap-3 overflow-x-auto pb-1 md:grid md:grid-cols-3 md:overflow-visible md:pb-0 xl:grid-cols-5"
      >
        <Card className="w-36 shrink-0 p-4 md:w-auto" data-testid="metric-pos-sales-count">
          <p className="text-xs font-medium text-muted-foreground">Ventes du jour</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{summary.todaySalesCount}</p>
        </Card>
        <Card className="w-36 shrink-0 p-4 md:w-auto" data-testid="metric-pos-revenue">
          <p className="text-xs font-medium text-muted-foreground">Chiffre d’affaires</p>
          <p className="mt-2 text-xl font-semibold tabular-nums">{money(summary.todayRevenue, currency)}</p>
        </Card>
        <Card className="w-36 shrink-0 p-4 md:w-auto" data-testid="metric-pos-cash-received">
          <p className="text-xs font-medium text-muted-foreground">Espèces reçues</p>
          <p className="mt-2 text-xl font-semibold tabular-nums">{money(summary.todayCashReceived, currency)}</p>
        </Card>
        <Card className="w-36 shrink-0 p-4 md:w-auto" data-testid="metric-pos-mobile-money-received">
          <p className="text-xs font-medium text-muted-foreground">Wave &amp; Orange Money</p>
          <p className="mt-2 text-xl font-semibold tabular-nums">{money(summary.todayMobileMoneyReceived, currency)}</p>
        </Card>
        <Card className="w-36 shrink-0 p-4 md:w-auto" data-testid="metric-pos-change-given">
          <p className="text-xs font-medium text-muted-foreground">Monnaie rendue</p>
          <p className="mt-2 text-xl font-semibold tabular-nums">{money(summary.todayChangeGiven, currency)}</p>
        </Card>
      </section>

      {!canCreate && (
        <div className="rounded-lg border border-border bg-muted p-4 text-sm text-muted-foreground" role="status" data-testid="status-pos-permission">
          Vous n’avez pas l’autorisation d’enregistrer une vente. Le catalogue et l’historique restent consultables.
        </div>
      )}

      <section className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]" aria-label="Enregistrer une vente">
        <Card className="min-w-0">
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Catalogue disponible</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Articles physiques publiés avec du stock.</p>
              </div>
              <Badge variant="outline">{availableProducts.length} article{availableProducts.length === 1 ? '' : 's'}</Badge>
            </div>
            <div className="relative mt-4">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Rechercher un article"
                className="pl-9"
                data-testid="input-pos-search"
                onChange={event => setSearch(event.target.value)}
                placeholder="Rechercher par nom, référence ou catégorie"
                type="search"
                value={search}
              />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {availableProducts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-5 py-10 text-center" data-testid="empty-pos-inventory">
                <ShoppingBag aria-hidden="true" className="mx-auto mb-3 size-8 text-muted-foreground" />
                <p className="font-medium">Aucun article disponible</p>
                <p className="mt-1 text-sm text-muted-foreground">Les articles vendables apparaîtront ici dès qu’ils seront publiés et en stock.</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground" data-testid="empty-pos-search">
                Aucun article ne correspond à « {search} ».
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {filteredProducts.map(product => {
                  const selectedQuantity = cart[product.id]?.quantity ?? 0;
                  return (
                    <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border bg-card p-3" key={product.id} data-testid={`card-pos-product-${product.id}`}>
                      <div className="min-w-0">
                        <p className="truncate font-medium" data-testid={`text-pos-product-${product.id}`}>{product.name}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{product.sku || product.category || 'Article'}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold tabular-nums">{money(product.price, currency)}</span>
                          <Badge variant="secondary">{product.stock} en stock</Badge>
                        </div>
                      </div>
                      <Button
                        aria-label={`Ajouter ${product.name} à la vente`}
                        data-testid={`button-pos-add-${product.id}`}
                        disabled={!canCreate || selectedQuantity >= product.stock || pending}
                        onClick={() => addProduct(product)}
                        size="icon"
                        type="button"
                      >
                        <Plus aria-hidden="true" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingBag aria-hidden="true" className="size-4 text-primary" />
              Vente en cours
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="space-y-4" onSubmit={submitSale}>
              {cartLines.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-4 py-7 text-center" data-testid="empty-pos-cart">
                  <p className="text-sm font-medium">Le panier est vide</p>
                  <p className="mt-1 text-xs text-muted-foreground">Ajoutez des articles du catalogue pour commencer.</p>
                </div>
              ) : (
                <ul className="divide-y divide-border" aria-label="Articles de la vente">
                  {cartLines.map(({ product, quantity }) => (
                    <li className="flex items-center justify-between gap-3 py-3 first:pt-0" key={product.id} data-testid={`row-pos-cart-${product.id}`}>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{product.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{money(product.price, currency)} l’unité</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          aria-label={`Retirer une unité de ${product.name}`}
                          data-testid={`button-pos-decrease-${product.id}`}
                          disabled={!canCreate || pending}
                          onClick={() => adjustQuantity(product.id, -1)}
                          size="icon"
                          type="button"
                          variant="outline"
                        >
                          <Minus aria-hidden="true" />
                        </Button>
                        <span className="w-7 text-center text-sm font-semibold tabular-nums" aria-label={`Quantité ${quantity}`}>{quantity}</span>
                        <Button
                          aria-label={`Ajouter une unité de ${product.name}`}
                          data-testid={`button-pos-increase-${product.id}`}
                          disabled={!canCreate || pending || quantity >= product.stock}
                          onClick={() => adjustQuantity(product.id, 1)}
                          size="icon"
                          type="button"
                          variant="outline"
                        >
                          <Plus aria-hidden="true" />
                        </Button>
                        <Button
                          aria-label={`Retirer ${product.name} du panier`}
                          className="ml-1"
                          data-testid={`button-pos-remove-${product.id}`}
                          disabled={!canCreate || pending}
                          onClick={() => setCart(current => {
                            const next = { ...current };
                            delete next[product.id];
                            return next;
                    })}
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          <X aria-hidden="true" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="space-y-3 border-t border-border pt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total à payer</span>
                  <span className="text-lg font-semibold tabular-nums" data-testid="text-pos-total">{money(total, currency)}</span>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="pos-customer-name">Nom du client <span className="font-normal text-muted-foreground">(facultatif)</span></label>
                  <div className="relative">
                    <UserRound aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      data-testid="input-pos-customer"
                      disabled={!canCreate || pending}
                      id="pos-customer-name"
                      onChange={event => setCustomerName(event.target.value)}
                      placeholder="Nom du client"
                      value={customerName}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="pos-payment-method">Moyen de paiement</label>
                  <Select
                    disabled={!canCreate || pending}
                    onValueChange={value => {
                      setPaymentMethod(value as EcommercePosPaymentMethod);
                      setAmountReceived('');
                      setPaymentConfirmed(false);
                      setSubmitError('');
                    }}
                    value={paymentMethod}
                  >
                    <SelectTrigger id="pos-payment-method" data-testid="select-pos-payment-method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">Espèces</SelectItem>
                      <SelectItem value="WAVE">Wave</SelectItem>
                      <SelectItem value="ORANGE_MONEY">Orange Money</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {paymentMethod === 'CASH' ? (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium" htmlFor="pos-amount-received">Espèces reçues</label>
                      <div className="relative">
                        <Banknote aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          aria-describedby="pos-change-due"
                          className="pl-9"
                          data-testid="input-pos-cash"
                          disabled={!canCreate || pending}
                          id="pos-amount-received"
                          min="0"
                          onChange={event => setAmountReceived(event.target.value)}
                          placeholder="0"
                          step={currency === 'XOF' ? '1' : '0.01'}
                          type="number"
                          value={amountReceived}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2" id="pos-change-due">
                      <span className="text-sm text-muted-foreground">Monnaie à rendre</span>
                      <span className="font-semibold tabular-nums" data-testid="text-pos-change">{money(changeDue, currency)}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs leading-5 text-muted-foreground" role="note">
                      Vérifiez le paiement dans l’application {paymentMethodLabels[paymentMethod]} : le transfert se fait hors MAXIMUS.
                    </p>
                    <div className="flex items-start gap-2">
                      <Checkbox
                        checked={paymentConfirmed}
                        data-testid="checkbox-pos-payment-confirmed"
                        disabled={!canCreate || pending}
                        id="pos-payment-confirmed"
                        onCheckedChange={checked => setPaymentConfirmed(checked === true)}
                      />
                      <label className="text-sm leading-5" htmlFor="pos-payment-confirmed">
                        J’ai confirmé la réception du paiement.
                      </label>
                    </div>
                  </>
                )}
              </div>

              {submitError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert" data-testid="status-pos-error">
                  {submitError}
                </div>
              )}
              {completedSale && (
                <div className="rounded-md border border-primary/30 bg-primary/10 p-3 text-sm" role="status" data-testid="status-pos-success">
                  <p className="flex items-center gap-2 font-semibold"><Check aria-hidden="true" className="size-4" /> Vente enregistrée</p>
                  <p className="mt-1 text-muted-foreground">Référence : <span className="font-semibold text-foreground">{completedSale.reference}</span></p>
                </div>
              )}

              <Button
                className="w-full"
                data-testid="button-pos-submit"
                disabled={!canCreate || pending || cartLines.length === 0 || !hasValidPayment}
                type="submit"
              >
                {pending ? 'Enregistrement…' : 'Enregistrer la vente'}
              </Button>
              {!hasValidPayment && cartLines.length > 0 && (
                <p className="text-xs text-muted-foreground" aria-live="polite">
                  {paymentMethod === 'CASH'
                    ? 'Saisissez un montant reçu au moins égal au total.'
                    : 'Confirmez la réception du paiement avant de valider.'}
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 pb-3">
          <div>
            <CardTitle className="text-base">Ventes récentes</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Les dernières ventes enregistrées en caisse.</p>
          </div>
          <Badge variant="outline">{sales.length}</Badge>
        </CardHeader>
        <CardContent className="pt-0">
          {sales.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-5 py-8 text-center" data-testid="empty-pos-sales">
              <p className="font-medium">Aucune vente récente</p>
              <p className="mt-1 text-sm text-muted-foreground">Les ventes confirmées apparaîtront ici avec leur référence et leurs articles.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sales.slice(0, 6).map(sale => (
                <article className="rounded-lg border border-border p-4" key={sale.id} data-testid={`card-pos-sale-${sale.id}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold" data-testid={`text-pos-sale-reference-${sale.id}`}>{sale.reference}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{dateTime(sale.createdAt)}{sale.customerName ? ` · ${sale.customerName}` : ''}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Paiement : {paymentMethodLabels[sale.paymentMethod]}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold tabular-nums">{money(sale.total, currency)}</p>
                      <Badge className="mt-1" variant={sale.status === 'PAID' ? 'secondary' : 'outline'}>
                        {sale.status === 'PAID' ? 'Payée' : 'Remboursée'}
                      </Badge>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-1 border-t border-border pt-3" aria-label={`Articles de la vente ${sale.reference}`}>
                    {sale.items.map(item => (
                      <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm" key={item.id} data-testid={`row-pos-sale-item-${item.id}`}>
                        <span className="min-w-0 flex-1">
                          {item.productName} <span className="text-muted-foreground">× {item.quantity}</span>
                          {item.stockBefore !== null && item.stockAfter !== null && (
                            <span className="mt-0.5 block text-xs text-muted-foreground">Stock : {item.stockBefore} → {item.stockAfter}</span>
                          )}
                        </span>
                        <span className="shrink-0 font-medium tabular-nums">{money(item.lineTotal, currency)}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}