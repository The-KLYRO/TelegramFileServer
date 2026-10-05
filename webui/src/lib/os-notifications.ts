import { invoke } from "@tauri-apps/api/core";

export async function ensureOsNotificationPermission(): Promise<boolean> {
  return true;
}

export async function showOsNotification(args: {
  title: string;
  body?: string;
}): Promise<void> {
  try {
    const title = args.title.trim();
    if (!title) {
      return;
    }

    await invoke("app_show_os_notification", {
      title,
      body: typeof args.body === "string" ? args.body : null,
    });
  } catch (error) {
    console.warn(
      "[os-notification] invoke failed:",
      (error as { message?: unknown })?.message || error,
    );
  }
}
