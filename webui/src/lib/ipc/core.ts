export type UnlistenFn = () => void;

interface InvokeOptions {
  cmd: string;
  args?: Record<string, unknown>;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData && typeof errorData.error === "string") {
        errorMessage = errorData.error;
      }
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

function logToServer(level: string, message: string): void {
  fetch("/api/logs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ level, message }),
  }).catch(() => {
    // Silently ignore logging failures (endpoint may not exist yet)
  });
}

export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  // Command to HTTP endpoint mapping
  switch (cmd) {
    case "db_get_setting": {
      const key = args?.key as string;
      if (!key) throw new Error("db_get_setting: missing key");
      try {
        return await fetchJson<T>(`/api/settings/${encodeURIComponent(key)}`);
      } catch (e) {
        if (e instanceof Error && e.message.startsWith("HTTP 404")) {
          return null as T;
        }
        throw e;
      }
    }

    case "db_set_setting": {
      const key = args?.key as string;
      const value = args?.value;
      if (!key) throw new Error("db_set_setting: missing key");
      await fetchJson(`/api/settings/${encodeURIComponent(key)}`, {
        method: "PUT",
        body: JSON.stringify(value),
      });
      return undefined as T;
    }

    case "db_get_favorites": {
      return await fetchJson<T>("/api/favorites");
    }

    case "db_add_favorite": {
      const path = args?.path as string;
      const label = args?.label as string;
      if (!path) throw new Error("db_add_favorite: missing path");
      await fetchJson("/api/favorites", {
        method: "POST",
        body: JSON.stringify({ path, label }),
      });
      return undefined as T;
    }

    case "db_remove_favorite": {
      const id = args?.id as string | number;
      if (id === undefined) throw new Error("db_remove_favorite: missing id");
      await fetchJson(`/api/favorites/${encodeURIComponent(String(id))}`, {
        method: "DELETE",
      });
      return undefined as T;
    }

    case "db_get_recent_paths": {
      const limit = args?.limit as number | undefined;
      const url = limit ? `/api/recents?limit=${limit}` : "/api/recents";
      return await fetchJson<T>(url);
    }

    case "db_add_recent_path": {
      const path = args?.path as string;
      if (!path) throw new Error("db_add_recent_path: missing path");
      await fetchJson("/api/recents", {
        method: "POST",
        body: JSON.stringify({ path }),
      });
      return undefined as T;
    }

    case "db_get_session": {
      const token = localStorage.getItem("tfs_token");
      if (!token) return null as T;
      try {
        return await fetchJson<T>("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        return null as T;
      }
    }

    case "db_clear_session": {
      localStorage.removeItem("tfs_token");
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch {
        // ignore network errors
      }
      return undefined as T;
    }

    case "tg_logout": {
      localStorage.removeItem("tfs_token");
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch {
        // ignore 401/network errors
      }
      return null as T;
    }

    case "tg_get_startup_readiness": {
      return await fetchJson<T>("/api/session/readiness");
    }

    case "tg_get_auth_state": {
      return await fetchJson<T>("/api/session/auth");
    }

    case "log_debug": {
      logToServer("debug", args?.message as string);
      return undefined as T;
    }

    case "log_info": {
      logToServer("info", args?.message as string);
      return undefined as T;
    }

    case "log_warn": {
      logToServer("warn", args?.message as string);
      return undefined as T;
    }

    case "log_error": {
      logToServer("error", args?.message as string);
      return undefined as T;
    }

    case "app_get_autostart_enabled": {
      // TODO: implement when backend supports it
      return false as T;
    }

    case "app_set_autostart_enabled": {
      // TODO: implement when backend supports it
      return false as T;
    }

    case "tg_get_tdlib_version": {
      return "Not used" as T;
    }

    default: {
      console.warn("[ipc] unhandled command", cmd);
      return null as T;
    }
  }
}

export function convertFileSrc(path: string): string {
  // v1: return path unchanged; TODO: implement thumbnails endpoint
  return path;
}