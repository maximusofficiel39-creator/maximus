import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

export type GateState = { locked: boolean; confirming: boolean };
export type GateAction = 'request' | 'confirm' | 'cancel' | 'relock';

export const initialGateState: GateState = { locked: false, confirming: false };

export function gateReducer(state: GateState, action: GateAction): GateState {
  switch (action) {
    case 'cancel':
    case 'relock':
      return initialGateState;
    case 'request':
    case 'confirm':
      return initialGateState;
    default:
      return state;
  }
}

/** Events from inside a locked gate must never reach their controls. */
export function shouldBlockGateEvent(locked: boolean): boolean {
  return locked;
}

export type GateConfirmOptions = { title: string; description: string; confirmLabel?: string; cancelLabel?: string; tone?: 'default' | 'danger' };
export type GateConfirmFn = (options: GateConfirmOptions) => Promise<boolean>;

/**
 * Runs `action` only when the gate is open, nothing else is in flight and the
 * context (resetKey) is unchanged after the confirmation resolved.
 */
export async function runGuardedAuthorization(input: {
  isLocked: () => boolean;
  isBusy: () => boolean;
  setBusy: (busy: boolean) => void;
  currentKey: () => string;
  key: string;
  confirm: () => Promise<boolean>;
  action: () => Promise<boolean | void> | boolean | void;
  onSuccess: () => void;
  onError?: (error: unknown) => void;
}): Promise<boolean> {
  if (input.isLocked() || input.isBusy()) return false;
  input.setBusy(true);
  try {
    const accepted = await input.confirm();
    if (!accepted || input.isLocked() || input.currentKey() !== input.key) return false;
    const result = await input.action();
    if (result === false) return false;
    if (input.currentKey() === input.key) input.onSuccess();
    return true;
  } catch (error) {
    input.onError?.(error);
    return false;
  } finally {
    input.setBusy(false);
  }
}

export function useAuthorizationGate({
  resetKey,
  confirm,
  onError,
}: {
  resetKey: string;
  confirm: GateConfirmFn;
  onError?: (error: unknown) => void;
}) {
  const [state, dispatch] = useReducer(gateReducer, initialGateState);
  const [pending, setPending] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const keyRef = useRef(resetKey);
  keyRef.current = resetKey;
  const busyRef = useRef(false);
  const confirmRef = useRef(confirm);
  confirmRef.current = confirm;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    dispatch('relock');
    busyRef.current = false;
    setPending(false);
  }, [resetKey]);

  const confirmAndRun = useCallback(
    (options: GateConfirmOptions, action: () => Promise<boolean | void> | boolean | void): Promise<boolean> =>
      runGuardedAuthorization({
        isLocked: () => stateRef.current.locked,
        isBusy: () => busyRef.current,
        setBusy: busy => { busyRef.current = busy; setPending(busy); },
        currentKey: () => keyRef.current,
        key: keyRef.current,
        confirm: () => confirmRef.current(options),
        action,
        onSuccess: () => dispatch('relock'),
        onError: error => onErrorRef.current?.(error),
      }),
    [],
  );

  return {
    locked: state.locked,
    confirming: state.confirming,
    pending,
    requestUnlock: () => dispatch('request'),
    confirmUnlock: () => dispatch('confirm'),
    cancelUnlock: () => dispatch('cancel'),
    relock: () => dispatch('relock'),
    confirmAndRun,
  };
}

export type AuthorizationGateController = ReturnType<typeof useAuthorizationGate>;
