import { useEffect, useRef, useState } from 'react';
import { Building2, Settings, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@workspace/maximus-design-system/components/ui/alert';
import { useAppDialog } from '@/components/confirm-dialog';
import {
  uid,
  getConfiguredModules,
  type Company,
  type Employee,
  type Module,
  type OrgNode,
  type Role,
  type StoreData,
} from '@/lib/store';
import { authApi } from '@/lib/auth-api';
import { isRoleAssignableToUnit, rolesForExactUnit } from '@/lib/employee-permissions';
import { synchronizeSelectedPackRolesForCompany } from '@/lib/module-role-sync';
import { canRunAutomaticPackRoleRepair, repairSelectedPackRolesAndAccounts } from '@/lib/pack-role-repair';
import { ActionButton, Field, Modal } from './organization-shared';

type Mutate = (fn: (data: StoreData) => void, message?: string | null) => void;
type EmployeeFormData = Omit<Employee, 'id' | 'companyId' | 'status' | 'department' | 'subDepartment' | 'role'> & { role: string; loginPassword?: string };

function getSectorDescendantIds(nodes: OrgNode[], rootId: string) {
  const ids = new Set<string>([rootId]);
  const pending = [rootId];
  while (pending.length > 0) {
    const parentId = pending.pop();
    if (!parentId) continue;
    nodes.filter(node => node.parentId === parentId).forEach(node => {
      if (ids.has(node.id)) return;
      ids.add(node.id);
      pending.push(node.id);
    });
  }
  return [...ids];
}

export function EmployeesTab({
  company,
  data,
  mutate,
  allowSectorAdmin = true,
  actorRole = 'company_admin',
}: {
  company: Company;
  data: StoreData;
  mutate: Mutate;
  allowSectorAdmin?: boolean;
  actorRole?: 'maximus_admin' | 'company_admin' | 'sector_manager' | 'employee';
}) {
  const { alert, confirm } = useAppDialog();
  const companyEmployees = data.employees.filter(employee => employee.companyId === company.id);
  const companyNodes = data.orgNodes.filter(node => node.companyId === company.id);
  const companyRoles = data.roles.filter(role => role.companyId === company.id);
  const moduleDefinitions = getConfiguredModules(data);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deletingEmployeeId, setDeletingEmployeeId] = useState('');
  const [packRoleRepairStatus, setPackRoleRepairStatus] = useState<'checking' | 'syncing' | 'ready' | 'failed'>('checking');
  const [packRoleRepairError, setPackRoleRepairError] = useState('');
  const [packRoleRepairAttempt, setPackRoleRepairAttempt] = useState(0);
  const attemptedPackRoleRepair = useRef('');
  const packRoleRepairRun = useRef(0);

  const packRoleRepairSignature = JSON.stringify({
    companyId: company.id,
    allowedModules: company.allowedModules,
    requestedModules: company.requestedModules,
    requestedModuleFeatures: company.requestedModuleFeatures,
    requestedModulePermissions: company.requestedModulePermissions,
    nodes: companyNodes.map(node => ({
      id: node.id,
      parentId: node.parentId,
      modulePackIds: node.modulePackIds,
      moduleFeatures: node.moduleFeatures,
    })),
    roles: companyRoles.map(role => ({
      id: role.id,
      sectorId: role.sectorId,
      packId: role.packId,
      packModuleId: role.packModuleId,
      modulePermissions: role.modulePermissions,
    })),
    employees: companyEmployees.map(employee => ({
      id: employee.id,
      email: employee.email,
      firstName: employee.firstName,
      lastName: employee.lastName,
      phone: employee.phone,
      status: employee.status,
      sectorId: employee.sectorId,
      isSectorAdmin: employee.isSectorAdmin,
      roleId: employee.roleId,
    })),
  });

  useEffect(() => {
    if (!canRunAutomaticPackRoleRepair(actorRole)) {
      setPackRoleRepairError('');
      setPackRoleRepairStatus('ready');
      return;
    }
    const attemptKey = `${packRoleRepairSignature}:${packRoleRepairAttempt}`;
    if (attemptedPackRoleRepair.current === attemptKey) return;
    attemptedPackRoleRepair.current = attemptKey;
    const runId = ++packRoleRepairRun.current;

    const nodeIds = companyNodes.map(node => node.id);
    setPackRoleRepairError('');
    setPackRoleRepairStatus('checking');
    void (async () => {
      const repair = await repairSelectedPackRolesAndAccounts({
        data,
        company,
        nodeIds,
        employees: companyEmployees,
        provisionEmployee: async (employee, role) => {
          if (!employee.sectorId || !employee.email.trim()) {
            throw new Error('Un compte utilisant un rôle prérempli est incomplet; ses droits n’ont pas été synchronisés.');
          }
          await authApi.provisionAccount({
            id: employee.id,
            email: employee.email.trim().toLowerCase(),
            displayName: `${employee.firstName.trim()} ${employee.lastName.trim()}`,
            phone: employee.phone,
            companyId: company.id,
            employeeId: employee.id,
            sectorId: employee.sectorId,
            sectorIds: employee.isSectorAdmin
              ? getSectorDescendantIds(companyNodes, employee.sectorId)
              : [employee.sectorId],
            role: employee.isSectorAdmin ? 'sector_manager' : 'employee',
            permissions: role.modulePermissions,
          });
        },
      });
      if (packRoleRepairRun.current !== runId) return;
      if (!repair.rolesChanged) {
        setPackRoleRepairStatus('ready');
        return;
      }

      mutate(draft => {
        synchronizeSelectedPackRolesForCompany(
          draft,
          company,
          draft.orgNodes
            .filter(node => node.companyId === company.id && nodeIds.includes(node.id))
            .map(node => node.id),
        );
      }, null);
      setPackRoleRepairStatus('ready');
    })().catch(error => {
      if (packRoleRepairRun.current !== runId) return;
      setPackRoleRepairError(
        error instanceof Error
          ? error.message
          : 'La vérification des rôles issus des packs a échoué.',
      );
      setPackRoleRepairStatus('failed');
    });
  }, [
    company,
    companyEmployees,
    companyNodes,
    companyRoles,
    data,
    mutate,
    actorRole,
    packRoleRepairAttempt,
    packRoleRepairSignature,
  ]);

  const deleteEmployee = async (employee: Employee) => {
    if (deletingEmployeeId) return;
    setDeletingEmployeeId(employee.id);
    const ok = await confirm({
      title: 'Supprimer ce compte employé ?',
      description: `La fiche de ${employee.firstName} ${employee.lastName} sera retirée de l’entreprise et son accès de connexion sera révoqué.`,
      confirmLabel: 'Supprimer',
      tone: 'danger',
    });
    if (!ok) {
      setDeletingEmployeeId('');
      return;
    }
    try {
      await authApi.revokeAccount(employee.id, company.id);
      mutate(draft => {
        draft.employees = draft.employees.filter(
          item => item.companyId !== company.id || item.id !== employee.id,
        );
        draft.orgNodes.forEach(node => {
          if (node.companyId === company.id && node.managerEmployeeId === employee.id) {
            node.managerEmployeeId = undefined;
          }
        });
      }, 'Employé supprimé.');
    } catch (error) {
      await alert({
        title: 'Suppression impossible',
        description: error instanceof Error ? error.message : 'La révocation du compte a échoué.',
        confirmLabel: 'Compris',
        tone: 'danger',
      });
    } finally {
      setDeletingEmployeeId('');
    }
  };

  return (
    <div className="card-surface min-w-0 overflow-hidden rounded-2xl fade-up">
      <div className="flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div>
          <h2 className="text-lg font-bold">Comptes Employés</h2>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Créez le compte, choisissez son appartenance et son rôle. Les permissions viennent du rôle configuré à l’étape 2.</p>
        </div>
        <ActionButton className="shrink-0 self-start" primary disabled={packRoleRepairStatus !== 'ready' || companyNodes.length === 0 || companyRoles.length === 0} onClick={() => { setEditingEmployee(null); setModalOpen(true); }} testId="btn-create-employee">Ajouter un employé</ActionButton>
      </div>
      {packRoleRepairStatus === 'failed' ? (
        <div role="alert" className="mx-6 mt-5 rounded-lg border border-[hsl(var(--destructive)/.3)] bg-[hsl(var(--destructive)/.08)] p-3 text-sm">
          <p>{packRoleRepairError} Si des comptes utilisent déjà ces rôles, certains peuvent avoir reçu les droits corrigés avant l’échec. Relancez la vérification pour terminer.</p>
          <button
            type="button"
            className="mt-2 font-bold text-[hsl(var(--destructive))] underline"
            onClick={() => setPackRoleRepairAttempt(attempt => attempt + 1)}
          >
            Réessayer
          </button>
        </div>
      ) : null}
      {packRoleRepairStatus === 'ready' && (companyNodes.length === 0 || companyRoles.length === 0) && (
        <p className="m-6 rounded-lg bg-[hsl(var(--muted))] p-3 text-sm text-[hsl(var(--muted-foreground))]">Créez d’abord la structure, configurez les rôles et leurs autorisations, puis ajoutez les comptes employés.</p>
      )}
      <div className="space-y-3 p-4 sm:hidden">
        {companyEmployees.map(employee => {
          const sector = companyNodes.find(node => node.id === employee.sectorId);
          const role = companyRoles.find(item => item.id === employee.roleId);
          return (
            <article key={employee.id} className="rounded-xl border bg-[hsl(var(--card))] p-4">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--accent)/.2)] text-xs font-black text-[hsl(var(--foreground))]">
                  {employee.firstName[0]}{employee.lastName[0]}
                </span>
                <div className="min-w-0">
                  <p className="break-words font-bold">{employee.firstName} {employee.lastName}</p>
                  <p className="mt-1 break-all text-xs text-[hsl(var(--muted-foreground))]">{employee.email}</p>
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-1 gap-3 border-t pt-3 text-xs">
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Unité</dt>
                  <dd className="mt-1 flex flex-wrap items-center gap-1.5 font-medium">
                    <Building2 size={13} className="text-[hsl(var(--muted-foreground))]" />
                    {sector?.name || 'Non assigné'}
                    {employee.isSectorAdmin && <span className="rounded-full bg-[hsl(var(--primary)/.12)] px-2 py-0.5 text-[9px] font-bold text-[hsl(var(--primary))]">Manager</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Rôle assigné</dt>
                  <dd className="mt-1 break-words font-medium">{role?.name || 'Non assigné'}</dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2 border-t pt-3">
                <button type="button" data-testid={`button-edit-org-employee-${employee.id}`} aria-label={`Modifier le compte de ${employee.firstName} ${employee.lastName}`} onClick={() => { setEditingEmployee(employee); setModalOpen(true); }} className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[10px] font-bold text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"><Settings size={13} /><span>Modifier</span></button>
                <button type="button" disabled={Boolean(deletingEmployeeId)} aria-busy={deletingEmployeeId === employee.id} data-testid={`button-delete-org-employee-${employee.id}`} aria-label={`Supprimer le compte de ${employee.firstName} ${employee.lastName}`} onClick={() => void deleteEmployee(employee)} className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[10px] font-bold text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/.1)] disabled:cursor-not-allowed disabled:opacity-50"><Trash2 size={13} /><span>{deletingEmployeeId === employee.id ? 'Suppression…' : 'Supprimer'}</span></button>
              </div>
            </article>
          );
        })}
        {companyEmployees.length === 0 && <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">Aucun employé dans cette entreprise.</div>}
      </div>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="bg-[hsl(var(--muted)/.5)] text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            <tr><th className="px-6 py-3 font-bold">Employé</th><th className="px-6 py-3 font-bold">Unité</th><th className="px-6 py-3 font-bold">Rôle Assigné</th><th className="px-6 py-3 text-right font-bold">Actions</th></tr>
          </thead>
          <tbody className="divide-y">
            {companyEmployees.map(employee => {
              const sector = companyNodes.find(node => node.id === employee.sectorId);
              const role = companyRoles.find(item => item.id === employee.roleId);
              return (
                <tr key={employee.id} className="transition hover:bg-[hsl(var(--muted)/.3)]">
                  <td className="px-6 py-4"><div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--accent)/.2)] text-xs font-black text-[hsl(var(--foreground))]">{employee.firstName[0]}{employee.lastName[0]}</span><div><p className="font-bold">{employee.firstName} {employee.lastName}</p><p className="text-xs text-[hsl(var(--muted-foreground))]">{employee.email}</p></div></div></td>
                  <td className="px-6 py-4"><span className="inline-flex items-center gap-1.5 text-xs font-medium"><Building2 size={13} className="text-[hsl(var(--muted-foreground))]" />{sector?.name || 'Non assigné'}{employee.isSectorAdmin && <span className="ml-1 rounded-full bg-[hsl(var(--primary)/.12)] px-2 py-0.5 text-[9px] font-bold text-[hsl(var(--primary))]">Manager</span>}</span></td>
                  <td className="px-6 py-4 text-xs font-medium">{role?.name || 'Non assigné'}</td>
                  <td className="px-6 py-4 text-right"><div className="flex justify-end gap-2">
                    <button type="button" data-testid={`button-edit-org-employee-${employee.id}`} aria-label={`Modifier le compte de ${employee.firstName} ${employee.lastName}`} onClick={() => { setEditingEmployee(employee); setModalOpen(true); }} className="inline-flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[10px] font-bold text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"><Settings size={13} /><span>Modifier</span></button>
                       <button type="button" disabled={Boolean(deletingEmployeeId)} aria-busy={deletingEmployeeId === employee.id} data-testid={`button-delete-org-employee-${employee.id}`} aria-label={`Supprimer le compte de ${employee.firstName} ${employee.lastName}`} onClick={() => void deleteEmployee(employee)} className="inline-flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[10px] font-bold text-[hsl(var(--destructive)/.1)] hover:bg-[hsl(var(--destructive)/.1)] disabled:cursor-not-allowed disabled:opacity-50"><Trash2 size={13} /><span>{deletingEmployeeId === employee.id ? 'Suppression…' : 'Supprimer'}</span></button>
                  </div></td>
                </tr>
              );
            })}
            {companyEmployees.length === 0 && <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">Aucun employé dans cette entreprise.</td></tr>}
          </tbody>
        </table>
      </div>
      {modalOpen && <Modal title={editingEmployee ? 'Modifier un employé' : 'Ajouter un employé'} onClose={() => setModalOpen(false)}>
        <EmployeeFormModal
          company={company}
          initialData={editingEmployee}
          allNodes={companyNodes}
          allRoles={companyRoles}
          allEmployees={companyEmployees}
          moduleDefinitions={moduleDefinitions}
          allowSectorAdmin={allowSectorAdmin}
          onClose={() => setModalOpen(false)}
           onSave={async employeeData => {
             const employeeId = editingEmployee?.id ?? uid('emp');
             const sectorId = employeeData.sectorId;
             const assignedRole = data.roles.find(role => role.id === employeeData.roleId);
             if (!sectorId) throw new Error('Une unité doit être sélectionnée pour ce compte.');
             if (!assignedRole) throw new Error('Le rôle sélectionné est introuvable.');
             const sectorIds = employeeData.isSectorAdmin
               ? getSectorDescendantIds(companyNodes, sectorId)
               : [sectorId];
             await authApi.provisionAccount({
               id: employeeId,
               email: employeeData.email.trim().toLowerCase(),
               displayName: `${employeeData.firstName.trim()} ${employeeData.lastName.trim()}`,
               phone: employeeData.phone,
               companyId: company.id,
               employeeId,
               sectorId,
               sectorIds,
               role: employeeData.isSectorAdmin ? 'sector_manager' : 'employee',
               permissions: assignedRole.modulePermissions,
               ...(employeeData.loginPassword ? { password: employeeData.loginPassword } : {}),
             });
            mutate(draft => {
              const sector = draft.orgNodes.find(node => node.id === employeeData.sectorId);
              const parent = sector?.parentId ? draft.orgNodes.find(node => node.id === sector.parentId) : null;
               const { loginPassword: _loginPassword, ...employeeFields } = employeeData;
               const normalized = { ...employeeFields, email: employeeData.email.trim().toLowerCase(), department: sector?.name ?? '', subDepartment: parent?.name ?? '' };
              if (editingEmployee) {
                const index = draft.employees.findIndex(employee => employee.id === editingEmployee.id);
                if (index !== -1) draft.employees[index] = { ...draft.employees[index], ...normalized };
              } else {
                 draft.employees.push({ id: employeeId, companyId: company.id, status: 'ACTIF', ...normalized } as Employee);
              }
              draft.orgNodes.forEach(node => {
                if (node.managerEmployeeId === employeeId && node.id !== employeeData.sectorId) node.managerEmployeeId = undefined;
              });
              if (employeeData.isSectorAdmin && sector) {
                draft.orgNodes.forEach(node => { if (node.id !== sector.id && node.managerEmployeeId === employeeId) node.managerEmployeeId = undefined; });
                sector.managerEmployeeId = employeeId;
              } else if (sector?.managerEmployeeId === employeeId) {
                sector.managerEmployeeId = undefined;
              }
            }, editingEmployee ? (employeeData.loginPassword ? 'Employé mis à jour et mot de passe actualisé.' : 'Employé mis à jour.') : 'Employé ajouté. Utilisez son email et son mot de passe initial pour la connexion.');
            setModalOpen(false);
           }}
        />
      </Modal>}
    </div>
  );
}

function EmployeeFormModal({
  company,
  initialData,
  allNodes,
  allRoles,
  allEmployees,
  moduleDefinitions,
  allowSectorAdmin = true,
  onClose,
  onSave,
}: {
  company: Company;
  initialData: Employee | null;
  allNodes: OrgNode[];
  allRoles: Role[];
  allEmployees: Employee[];
  moduleDefinitions: Module[];
  allowSectorAdmin?: boolean;
  onClose: () => void;
  onSave: (data: EmployeeFormData) => Promise<void>;
}) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    firstName: initialData?.firstName || '',
    lastName: initialData?.lastName || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    position: initialData?.position || '',
    sectorId: initialData?.sectorId || (allNodes[0]?.id ?? ''),
    roleId: initialData?.roleId || '',
    isSectorAdmin: initialData?.isSectorAdmin ?? false,
    password: '',
    passwordConfirm: '',
  });
  const sectorCompatibleRoles = rolesForExactUnit(allRoles, formData.sectorId);
  const compatibleRoles = sectorCompatibleRoles.filter(role =>
    isRoleAssignableToUnit(role, company, formData.sectorId, allNodes, moduleDefinitions),
  );
  const selectedRole = allRoles.find(role => role.id === formData.roleId);
  const selectedRoleIsCompatible = compatibleRoles.some(role => role.id === formData.roleId);
  const selectedRoleNeedsCorrection = Boolean(selectedRole && !selectedRoleIsCompatible);

  const handleSave = () => {
    const email = formData.email.trim().toLowerCase();
    const role = compatibleRoles.find(item => item.id === formData.roleId);
    if (selectedRoleNeedsCorrection) {
      setError('Le rôle affecté appartient à une autre unité ou dépasse les droits autorisés. Choisissez un rôle de cette unité, ou corrigez ses permissions dans « Rôles & permissions ».');
      return;
    }
    if (!formData.firstName.trim() || !formData.lastName.trim() || !email || !formData.position.trim() || !formData.sectorId || !role) {
      setError('Prénom, nom, email, poste, appartenance et rôle compatible sont obligatoires.');
      return;
    }
    if (formData.isSectorAdmin && Object.keys(role.modulePermissions).length === 0) {
      setError('Un manager doit utiliser un rôle avec au moins une autorisation.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Saisissez une adresse email valide.');
      return;
    }
    if (allEmployees.some(employee => employee.id !== initialData?.id && employee.email.trim().toLowerCase() === email)) {
      setError('Cette adresse email est déjà utilisée dans l’entreprise.');
      return;
    }
    const password = formData.password.trim();
    if (!initialData && password.length < 8) {
      setError('Définissez un mot de passe initial d’au moins 8 caractères.');
      return;
    }
    if (password && password.length < 8) {
      setError('Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (password !== formData.passwordConfirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setError('');
    setSaving(true);
    void onSave({
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      email,
      phone: formData.phone,
      position: formData.position.trim(),
      sectorId: formData.sectorId,
      roleId: formData.roleId,
      isSectorAdmin: formData.isSectorAdmin,
      role: role.name,
      ...(password ? { loginPassword: password } : {}),
    }).catch(nextError => {
      setError(nextError instanceof Error ? nextError.message : 'La création du compte a échoué.');
    }).finally(() => setSaving(false));
  };

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="rounded-lg bg-[hsl(var(--destructive)/.1)] p-3 text-sm font-semibold text-[hsl(var(--destructive))]">{error}</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field label="Prénom *" value={formData.firstName} onChange={(value: string) => setFormData(current => ({ ...current, firstName: value }))} help="Prénom utilisé dans les listes et l’historique des actions." /><Field label="Nom *" value={formData.lastName} onChange={(value: string) => setFormData(current => ({ ...current, lastName: value }))} help="Nom de famille de l’employé." /></div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field label="Email *" type="email" value={formData.email} onChange={(value: string) => setFormData(current => ({ ...current, email: value }))} help="Adresse utilisée par l’employé pour se connecter à son espace." /><Field label="Téléphone" value={formData.phone} onChange={(value: string) => setFormData(current => ({ ...current, phone: value }))} help="Numéro de contact professionnel de l’employé." /></div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field label={initialData ? 'Nouveau mot de passe' : 'Mot de passe initial *'} type="password" value={formData.password} onChange={(value: string) => setFormData(current => ({ ...current, password: value }))} placeholder={initialData ? 'Laisser vide pour conserver' : 'Au moins 8 caractères'} testId="input-employee-password" help={initialData ? 'Laissez vide pour conserver le mot de passe actuel ; sinon utilisez au moins 8 caractères.' : 'Mot de passe utilisé par l’employé pour sa première connexion.'} /><Field label={initialData ? 'Confirmer le nouveau mot de passe' : 'Confirmer le mot de passe *'} type="password" value={formData.passwordConfirm} onChange={(value: string) => setFormData(current => ({ ...current, passwordConfirm: value }))} placeholder="Répétez le mot de passe" testId="input-employee-password-confirm" help="Saisissez exactement le même mot de passe pour confirmer." /></div>
      <p className="rounded-lg bg-[hsl(var(--muted))] p-3 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Le compte se connecte depuis « Espace entreprise » avec cet email et ce mot de passe. Le mot de passe n’est pas affiché dans la liste des employés.</p>
      <Field label="Titre du poste" value={formData.position} onChange={(value: string) => setFormData(current => ({ ...current, position: value }))} placeholder="Ex: Développeur Senior" help="Intitulé professionnel visible dans les listes, distinct du rôle d’accès." />
      <div className="mt-4 grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold">Appartenance *
          <select value={formData.sectorId} onChange={event => setFormData(current => ({ ...current, sectorId: event.target.value, roleId: '' }))} className="mt-2 w-full rounded-lg border bg-[hsl(var(--card))] px-3 py-3 text-sm focus:border-[hsl(var(--primary))]">{allNodes.map(node => <option key={node.id} value={node.id}>{node.name}</option>)}</select>
          <span className="mt-1 block text-[10px] font-normal leading-4 text-[hsl(var(--muted-foreground))]">Section, département ou service de rattachement. Elle détermine les rôles compatibles.</span>
        </label>
        <label className="block text-sm font-semibold">Rôle *
          <select value={formData.roleId} onChange={event => setFormData(current => ({ ...current, roleId: event.target.value }))} className="mt-2 w-full rounded-lg border bg-[hsl(var(--card))] px-3 py-3 text-sm focus:border-[hsl(var(--primary))]">
            <option value="">Sélectionner un rôle...</option>
            {selectedRoleNeedsCorrection && <option value={selectedRole?.id} disabled>{selectedRole?.name} — permissions à corriger</option>}
            {compatibleRoles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
          </select>
          <p className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">Seuls les rôles de l’unité sélectionnée et compatibles avec ses droits sont proposés.</p>
          {selectedRoleNeedsCorrection ? (
            <Alert variant="destructive" className="mt-2">
              <AlertDescription>Ce rôle ne peut pas être attribué tel quel. Fermez ce formulaire et corrigez ses permissions dans « Rôles & permissions ».</AlertDescription>
            </Alert>
          ) : null}
        </label>
      </div>
      {allowSectorAdmin && <label className="mt-4 flex items-start gap-2 rounded-lg border p-3 text-xs font-semibold"><input type="checkbox" checked={formData.isSectorAdmin} onChange={event => setFormData(current => ({ ...current, isSectorAdmin: event.target.checked }))} className="mt-0.5" /><span><strong className="block">Manager de cette unité</strong><small className="font-normal text-[hsl(var(--muted-foreground))]">Ce compte pourra gérer les rôles, permissions et employés de son appartenance et de ses unités descendantes. Il sera aussi proposé comme manager dans la structure.</small></span></label>}
      <div className="mt-6 flex justify-end gap-3 border-t pt-4"><button onClick={onClose} disabled={saving} className="rounded-lg border px-4 py-2 text-sm font-bold hover:bg-[hsl(var(--muted))] disabled:opacity-50">Annuler</button><ActionButton primary onClick={handleSave} disabled={saving || !formData.firstName || !formData.lastName || !formData.email || !formData.position || !formData.sectorId || !formData.roleId || !selectedRoleIsCompatible}>{saving ? 'Enregistrement…' : 'Enregistrer'}</ActionButton></div>
    </div>
  );
}