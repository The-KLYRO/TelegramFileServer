import { invoke } from "@tauri-apps/api/core";

const isTauri = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function log(
  cmd: string,
  message: string,
  context?: Record<string, unknown>,
) {
  console.log(`[${cmd}]`, message, context ?? "");

  if (!isTauri()) return;

  try {
    await invoke(cmd, { message });
  } catch {
    // Silent error handling for logging function
  }
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) =>
    log("log_debug", message, context),
  info: (message: string, context?: Record<string, unknown>) =>
    log("log_info", message, context),
  warn: (message: string, context?: Record<string, unknown>) =>
    log("log_warn", message, context),
  error: (message: string, context?: Record<string, unknown>) =>
    log("log_error", message, context),
};
