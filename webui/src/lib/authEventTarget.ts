export interface TrackedAuthEventTarget {
  accountId: string;
  runtimeId: string | null;
}

type AuthEventTargetLike = {
  account_id?: string | null;
  runtime_id?: string | null;
};

let trackedAuthEventTarget: TrackedAuthEventTarget | null = null;

const normalizeAuthTargetValue = (
  value: string | null | undefined,
): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
};

export const buildAuthAccountIdFromPhone = (phoneNumber: string): string => {
  const cleanedPhoneNumber = phoneNumber
    .trim()
    .split("")
    .filter((character) => /[+\d]/.test(character))
    .join("");

  return cleanedPhoneNumber.length > 0
    ? `acc:${cleanedPhoneNumber}`
    : "default";
};

export const getTrackedAuthEventTarget = (): TrackedAuthEventTarget | null => {
  return trackedAuthEventTarget;
};

export const setTrackedAuthEventTarget = (
  nextTarget:
    | {
        accountId?: string | null;
        runtimeId?: string | null;
      }
    | null
    | undefined,
): TrackedAuthEventTarget | null => {
  const accountId = normalizeAuthTargetValue(nextTarget?.accountId);
  if (!accountId) {
    trackedAuthEventTarget = null;
    return trackedAuthEventTarget;
  }

  const runtimeId = normalizeAuthTargetValue(nextTarget?.runtimeId);
  trackedAuthEventTarget = {
    accountId,
    runtimeId:
      runtimeId ??
      (trackedAuthEventTarget?.accountId === accountId
        ? trackedAuthEventTarget.runtimeId
        : null),
  };

  return trackedAuthEventTarget;
};

export const rememberTrackedAuthSnapshot = (
  snapshot: AuthEventTargetLike | null | undefined,
): TrackedAuthEventTarget | null => {
  return setTrackedAuthEventTarget({
    accountId: snapshot?.account_id,
    runtimeId: snapshot?.runtime_id,
  });
};

export const isTrackedAuthEventRelevant = (
  snapshot: AuthEventTargetLike | null | undefined,
): boolean => {
  const trackedTarget = trackedAuthEventTarget;
  if (!trackedTarget) {
    return true;
  }

  const accountId = normalizeAuthTargetValue(snapshot?.account_id);
  if (accountId && accountId !== trackedTarget.accountId) {
    return false;
  }

  const runtimeId = normalizeAuthTargetValue(snapshot?.runtime_id);
  if (
    trackedTarget.runtimeId &&
    runtimeId &&
    runtimeId !== trackedTarget.runtimeId
  ) {
    return false;
  }

  return true;
};

export const resetTrackedAuthEventTarget = (): void => {
  trackedAuthEventTarget = null;
};
