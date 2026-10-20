/** @jsxRuntime automatic */
/** @jsxImportSource react */
import type { ReactNode } from 'react';
import type { AuthorizationGateController } from '@/lib/authorization-gate';

type AuthorizationGateProps = {
  gate: Pick<AuthorizationGateController, 'locked' | 'confirming' | 'pending' | 'requestUnlock' | 'confirmUnlock' | 'cancelUnlock' | 'relock'>;
  title?: string;
  testId?: string;
  children: ReactNode;
};

export function AuthorizationGate({
  testId = 'authorization-gate',
  children,
}: AuthorizationGateProps) {
  return (
    <div data-testid={testId}>{children}</div>
  );
}
