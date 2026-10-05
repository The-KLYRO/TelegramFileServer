export type NativeRuntimeState =
  | "NotChecked"
  | "Checking"
  | "Ready"
  | { Failed: { reason: string } };

export type CredentialState = "CredentialsMissing" | "CredentialsReady";

export interface TdlibRuntimeDependencyCheck {
  name: string;
  path: string;
  exists: boolean;
}

export interface TdlibRuntimeDiagnostics {
  executable_path: string;
  install_dir: string;
  bin_dir: string;
  tdjson_path: string;
  dll_checks: TdlibRuntimeDependencyCheck[];
  architecture_expectation: string;
  loader_flags: string[];
  set_default_dll_directories_succeeded?: boolean | null;
  dll_directory_registration_succeeded?: boolean | null;
  load_error_code?: number | null;
  load_error_message?: string | null;
}

export interface TdlibRuntimeReadinessReport {
  state: NativeRuntimeState;
  blocking_title: string;
  blocking_message: string;
  technical_detail?: string | null;
  diagnostics: TdlibRuntimeDiagnostics;
}

export interface StartupReadinessReport {
  webview2: {
    state: NativeRuntimeState;
    reason?: string | null;
  };
  credentials: {
    state: CredentialState;
    blocking_title: string;
    blocking_message: string;
    technical_detail?: string | null;
    source: string;
    tdlib_present: boolean;
    tmdb_present: boolean;
  };
  telegram_runtime: TdlibRuntimeReadinessReport;
}

export interface BlockingRuntimeError {
  title: string;
  message: string;
  technicalDetail?: string;
  rawMessage?: string;
}

const RUNTIME_ERROR_PREFIX = "TelegramRuntimeUnavailable:";
const CREDENTIALS_ERROR_PREFIX = "SkyBoxCredentialsUnavailable:";
export const SKYBOX_RUNTIME_NOTICE_KEY = "skybox_runtime_notice";

export function getNativeRuntimeStateKind(
  state: NativeRuntimeState,
): "NotChecked" | "Checking" | "Ready" | "Failed" {
  if (typeof state === "string") {
    return state;
  }

  return "Failed";
}

export function getBlockingRuntimeErrorFromReadiness(
  report: StartupReadinessReport,
): BlockingRuntimeError | null {
  if (report.credentials.state === "CredentialsMissing") {
    return {
      title: report.credentials.blocking_title,
      message: report.credentials.blocking_message,
      technicalDetail: report.credentials.technical_detail || undefined,
      rawMessage: report.credentials.technical_detail || undefined,
    };
  }

  if (getNativeRuntimeStateKind(report.telegram_runtime.state) === "Ready") {
    return null;
  }

  return {
    title: report.telegram_runtime.blocking_title,
    message: report.telegram_runtime.blocking_message,
    technicalDetail: report.telegram_runtime.technical_detail || undefined,
    rawMessage: report.telegram_runtime.technical_detail || undefined,
  };
}

export function getBlockingRuntimeError(
  error: unknown,
): BlockingRuntimeError | null {
  if (
    typeof error !== "object" ||
    error === null ||
    !("message" in error) ||
    typeof (error as { message?: unknown }).message !== "string"
  ) {
    return null;
  }

  const rawMessage = (error as { message: string }).message;
  const matchedPrefix = [RUNTIME_ERROR_PREFIX, CREDENTIALS_ERROR_PREFIX].find(
    (prefix) => rawMessage.includes(prefix),
  );
  if (!matchedPrefix) {
    return null;
  }

  const detail = rawMessage.slice(rawMessage.indexOf(matchedPrefix));
  const normalized = detail.replace(matchedPrefix, "").trim();
  const firstPeriodIndex = normalized.indexOf(".");
  const title =
    firstPeriodIndex >= 0
      ? normalized.slice(0, firstPeriodIndex).trim()
      : "Telegram runtime failed to load";
  const technicalDetail =
    firstPeriodIndex >= 0
      ? normalized.slice(firstPeriodIndex + 1).trim()
      : normalized;

  return {
    title: title || "Telegram runtime failed to load",
    message:
      matchedPrefix === CREDENTIALS_ERROR_PREFIX
        ? "This build is not configured correctly."
        : "A required native dependency is missing or incompatible.",
    technicalDetail: technicalDetail || undefined,
    rawMessage,
  };
}

export function persistBlockingRuntimeError(error: BlockingRuntimeError): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    SKYBOX_RUNTIME_NOTICE_KEY,
    JSON.stringify(error),
  );
}

export function readBlockingRuntimeError(): BlockingRuntimeError | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(SKYBOX_RUNTIME_NOTICE_KEY);
  if (!raw) {
    return null;
  }

  window.sessionStorage.removeItem(SKYBOX_RUNTIME_NOTICE_KEY);

  try {
    const parsed = JSON.parse(raw) as BlockingRuntimeError;
    if (
      typeof parsed?.title !== "string" ||
      typeof parsed?.message !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
