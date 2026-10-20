/** @jsxRuntime automatic */
/** @jsxImportSource react */
import { useContext, useEffect, useState } from 'react';
import { Button } from '@workspace/maximus-design-system/components/ui/button';
import { Card } from '@workspace/maximus-design-system/components/ui/card';
import { Switch } from '@workspace/maximus-design-system/components/ui/switch';
import type { Company } from '@/lib/store';
import {
  loadCompanyNavigationSettings,
  saveCompanyNavigationSettings,
  type CompanyNavigationMode,
  type CompanyNavigationSettings,
} from '@/lib/company-navigation-api';
import {
  canShowNavigationControl,
  companyNavigationCustomAllowed,
  companyNavigationMode,
  effectiveCustomAllowed,
} from '@/lib/company-navigation';
import { NavigationSettingsContext } from '@/lib/navigation-settings-context';

const modeOptions: { id: CompanyNavigationMode; label: string; hint: string }[] = [
  { id: 'menu', label: 'Menu latéral', hint: 'Modules et fonctionnalités dans le menu principal.' },
  { id: 'horizontal', label: 'Barre horizontale', hint: 'Modules dans le menu, fonctionnalités en haut de la page.' },
];

export function NavigationModeChoice({
  value,
  onChange,
  disabled = false,
  testIdPrefix = 'navigation-mode',
}: {
  value: CompanyNavigationMode;
  onChange: (mode: CompanyNavigationMode) => void;
  disabled?: boolean;
  testIdPrefix?: string;
}) {
  return (
    <div role="group" aria-label="Mode de navigation" className="grid gap-2 sm:grid-cols-2">
      {modeOptions.map(option => (
        <Button
          key={option.id}
          type="button"
          variant={value === option.id ? 'default' : 'outline'}
          aria-pressed={value === option.id}
          disabled={disabled}
          data-testid={`${testIdPrefix}-${option.id}`}
          onClick={() => onChange(option.id)}
          className="h-auto flex-col items-start gap-1 whitespace-normal px-4 py-3 text-left"
        >
          <span className="text-sm font-bold">{option.label}</span>
          <span className="text-xs font-normal opacity-80">{option.hint}</span>
        </Button>
      ))}
    </div>
  );
}

type Feedback = { kind: 'success' | 'error'; text: string } | null;

function FeedbackLine({ feedback, testId }: { feedback: Feedback; testId: string }) {
  if (!feedback) return null;
  return (
    <p
      role={feedback.kind === 'error' ? 'alert' : 'status'}
      data-testid={testId}
      className={`rounded-lg px-3 py-2 text-xs font-semibold ${feedback.kind === 'error' ? 'bg-[hsl(var(--destructive)/.08)] text-[hsl(var(--destructive))]' : 'bg-[hsl(var(--primary)/.08)] text-[hsl(var(--primary))]'}`}
    >
      {feedback.text}
    </p>
  );
}

const errorText = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);

/** Company-side control. Rendered only for an authorized company administrator. */
export function CompanyNavigationSettingsPanel({ company }: { company: Company }) {
  const { isCompanyAdmin, onSaved } = useContext(NavigationSettingsContext);
  const [remote, setRemote] = useState<CompanyNavigationSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    setRemote(null);
    setFeedback(null);
    if (!isCompanyAdmin) return;
    let cancelled = false;
    loadCompanyNavigationSettings(company.id)
      .then(settings => { if (!cancelled) setRemote(settings); })
      .catch(error => { if (!cancelled) setFeedback({ kind: 'error', text: errorText(error, 'Les réglages de navigation sont indisponibles.') }); });
    return () => { cancelled = true; };
  }, [company.id, isCompanyAdmin, company.navigationCustomAllowed, company.moduleNavigationMode]);

  const customAllowed = effectiveCustomAllowed(companyNavigationCustomAllowed(company), remote?.customAllowed);
  if (!canShowNavigationControl({ companyAdmin: isCompanyAdmin, customAllowed })) return null;
  const mode = remote?.mode ?? companyNavigationMode(company);

  const choose = async (next: CompanyNavigationMode) => {
    if (saving || next === mode) return;
    setSaving(true);
    setFeedback(null);
    try {
      const saved = await saveCompanyNavigationSettings(company.id, { mode: next });
      setRemote({ companyId: saved.companyId, mode: saved.mode, customAllowed: saved.customAllowed });
      setFeedback({ kind: 'success', text: 'Mode de navigation enregistré.' });
      await onSaved?.();
    } catch (error) {
      setFeedback({ kind: 'error', text: errorText(error, 'Le mode de navigation n’a pas pu être enregistré.') });
      loadCompanyNavigationSettings(company.id).then(setRemote).catch(() => undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card data-testid="company-navigation-settings" className="mt-5 space-y-4 p-6 shadow-none">
      <div>
        <h3 className="font-bold">Navigation de l’espace</h3>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          Choisissez l’affichage des fonctionnalités pour tous les utilisateurs de l’entreprise. Les droits ne changent pas.
        </p>
      </div>
      <NavigationModeChoice value={mode} onChange={choose} disabled={saving} testIdPrefix="company-navigation-mode" />
      <FeedbackLine feedback={feedback} testId="company-navigation-feedback" />
    </Card>
  );
}

/** MAXIMUS-side control: mode choice plus the grant for company administrators. */
export function MaximusNavigationSettings({
  company,
  onSaved,
}: {
  company: Company;
  onSaved?: () => Promise<unknown> | void;
}) {
  const [savedMode, setSavedMode] = useState<CompanyNavigationMode>(companyNavigationMode(company));
  const [mode, setMode] = useState<CompanyNavigationMode>(companyNavigationMode(company));
  const [savedAllowed, setSavedAllowed] = useState(companyNavigationCustomAllowed(company));
  const [allowed, setAllowed] = useState(companyNavigationCustomAllowed(company));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const initialMode = companyNavigationMode(company);
    const initialAllowed = companyNavigationCustomAllowed(company);
    setSavedMode(initialMode); setMode(initialMode);
    setSavedAllowed(initialAllowed); setAllowed(initialAllowed);
    setFeedback(null); setLoadError(''); setLoading(true);
    loadCompanyNavigationSettings(company.id)
      .then(settings => {
        if (cancelled) return;
        setSavedMode(settings.mode); setMode(settings.mode);
        setSavedAllowed(settings.customAllowed); setAllowed(settings.customAllowed);
      })
      .catch(error => { if (!cancelled) setLoadError(errorText(error, 'Les réglages de navigation sont indisponibles.')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id]);

  const persist = async (patch: { mode?: CompanyNavigationMode; customAllowed?: boolean }): Promise<boolean> => {
    setSaving(true);
    setFeedback(null);
    try {
      const saved = await saveCompanyNavigationSettings(company.id, patch);
      setSavedMode(saved.mode); setMode(saved.mode);
      setSavedAllowed(saved.customAllowed); setAllowed(saved.customAllowed);
      setFeedback({ kind: 'success', text: 'Réglages de navigation enregistrés.' });
      await onSaved?.();
      return true;
    } catch (error) {
      setFeedback({ kind: 'error', text: errorText(error, 'Les réglages de navigation n’ont pas pu être enregistrés.') });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveAuthorization = () =>
    persist({ customAllowed: allowed });

  return (
    <Card data-testid="maximus-navigation-settings" className="space-y-4 p-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-bold">Navigation de l’espace entreprise</h2>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Choisissez l’affichage des fonctionnalités et décidez si l’administrateur de l’entreprise peut le modifier.
        </p>
      </div>
      {loadError && <p role="alert" data-testid="maximus-navigation-load-error" className="text-xs font-semibold text-[hsl(var(--destructive))]">{loadError}</p>}
      <NavigationModeChoice value={mode} onChange={setMode} disabled={loading || saving} testIdPrefix="maximus-navigation-mode" />
      <div className="flex justify-end">
        <Button
          type="button"
          data-testid="button-save-navigation-mode"
          disabled={loading || saving || mode === savedMode}
          onClick={() => void persist({ mode })}
        >
          {saving ? 'Enregistrement…' : 'Enregistrer le mode'}
        </Button>
      </div>
        <div className="space-y-3">
          <label className="flex items-start gap-3 rounded-lg border p-4">
            <Switch
              data-testid="switch-navigation-custom-allowed"
              aria-label="Autoriser l’administrateur de l’entreprise à choisir le mode de navigation"
              checked={allowed}
              disabled={loading || saving}
              onCheckedChange={checked => setAllowed(checked === true)}
            />
            <span>
              <strong className="block text-sm">Autoriser l’administrateur de l’entreprise à choisir le mode</strong>
              <span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">
                Désactivé par défaut. Le retrait masque le contrôle mais conserve le mode configuré.
              </span>
            </span>
          </label>
          <div className="flex justify-end">
            <Button
              type="button"
              data-testid="button-save-navigation-authorization"
              disabled={loading || saving || allowed === savedAllowed}
              onClick={() => void saveAuthorization()}
            >
              Enregistrer l’autorisation
            </Button>
          </div>
        </div>
      <FeedbackLine feedback={feedback} testId="maximus-navigation-feedback" />
    </Card>
  );
}
