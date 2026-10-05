import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  loadRequiredChannelConfig,
  type RequiredChannelConfig,
} from "@/lib/required-channel";
import { getBlockingRuntimeError } from "@/lib/telegramRuntime";

type Args = {
  hasAttemptedSessionRestoreRef: MutableRefObject<boolean>;
  initialIsOffline: boolean;
  isOfflineRef: MutableRefObject<boolean>;
  sessionDataRef: MutableRefObject<string | null>;
};

export function useExplorerCloudGate({
  hasAttemptedSessionRestoreRef,
  initialIsOffline,
  isOfflineRef,
  sessionDataRef,
}: Args) {
  const [isOffline, setIsOffline] = useState(initialIsOffline);
  const [requiredChannel, setRequiredChannel] =
    useState<RequiredChannelConfig | null>(null);
  const [mustJoinRequiredChannel, setMustJoinRequiredChannel] = useState(false);
  const cloudSyncTimerRef = useRef<number | null>(null);
  const cloudSyncQueuedTimerRef = useRef<number | null>(null);
  const cloudSyncInFlightRef = useRef(false);
  const cloudSyncEnabledRef = useRef(true);
  const cloudSyncDirtyRef = useRef(false);
  const lastMembershipCheckAtRef = useRef<number>(0);

  useEffect(() => {
    isOfflineRef.current = isOffline;
  }, [isOffline, isOfflineRef]);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const runCloudSyncOnce = useCallback(async (): Promise<boolean> => {
    if (
      !cloudSyncEnabledRef.current ||
      isOfflineRef.current ||
      cloudSyncInFlightRef.current
    ) {
      return false;
    }
    cloudSyncInFlightRef.current = true;
    try {
      await invoke("tg_cloud_sync_skybox_json_to_saved_messages", {
        force: false,
      });
      return true;
    } catch (error) {
      if (getBlockingRuntimeError(error)) {
        cloudSyncEnabledRef.current = false;
      }
      return false;
    } finally {
      cloudSyncInFlightRef.current = false;
    }
  }, [isOfflineRef]);

  const queueCloudSync = useCallback(() => {
    if (!cloudSyncEnabledRef.current) return;
    cloudSyncDirtyRef.current = true;
    if (isOfflineRef.current) return;
    if (cloudSyncQueuedTimerRef.current !== null) {
      window.clearTimeout(cloudSyncQueuedTimerRef.current);
      cloudSyncQueuedTimerRef.current = null;
    }
    cloudSyncQueuedTimerRef.current = window.setTimeout(() => {
      cloudSyncQueuedTimerRef.current = null;
      void runCloudSyncOnce().then((ok) => {
        if (ok) {
          cloudSyncDirtyRef.current = false;
        }
      });
    }, 750);
  }, [isOfflineRef, runCloudSyncOnce]);

  useEffect(() => {
    if (!isOffline && cloudSyncDirtyRef.current) {
      queueCloudSync();
    }
  }, [isOffline, queueCloudSync]);

  useEffect(() => {
    let cancelled = false;

    invoke<string | null>("db_get_setting", { key: "cloud_sync_enabled" })
      .then((value) => {
        if (!cancelled) {
          cloudSyncEnabledRef.current = value !== "0";
        }
      })
      .catch(() => {
        cloudSyncEnabledRef.current = true;
      });

    const tick = async () => {
      try {
        const enabled = await invoke<string | null>("db_get_setting", {
          key: "cloud_sync_enabled",
        });
        cloudSyncEnabledRef.current = enabled !== "0";
      } catch {
        // ignore
      }
      const ok = await runCloudSyncOnce();
      if (ok) {
        cloudSyncDirtyRef.current = false;
      }
    };

    void tick();
    cloudSyncTimerRef.current = window.setInterval(
      () => {
        void tick();
      },
      5 * 60 * 1000,
    );

    return () => {
      cancelled = true;
      if (cloudSyncTimerRef.current !== null) {
        window.clearInterval(cloudSyncTimerRef.current);
        cloudSyncTimerRef.current = null;
      }
      if (cloudSyncQueuedTimerRef.current !== null) {
        window.clearTimeout(cloudSyncQueuedTimerRef.current);
        cloudSyncQueuedTimerRef.current = null;
      }
    };
  }, [runCloudSyncOnce]);

  useEffect(() => {
    if (isOffline) {
      return;
    }
    void invoke("tg_start_real_time_sync").catch((error) => {
      if (getBlockingRuntimeError(error)) {
        cloudSyncEnabledRef.current = false;
      }
    });
    if (hasAttemptedSessionRestoreRef.current) {
      return;
    }
    const sessionData = sessionDataRef.current;
    if (!sessionData) {
      return;
    }
    hasAttemptedSessionRestoreRef.current = true;
    void invoke("tg_restore_session", { sessionData }).catch((error) => {
      if (getBlockingRuntimeError(error)) {
        cloudSyncEnabledRef.current = false;
      }
    });
  }, [hasAttemptedSessionRestoreRef, isOffline, sessionDataRef]);

  const runRequiredChannelMembershipCheck = useCallback(
    async (cfg: RequiredChannelConfig, mode: "bootstrap" | "revalidate") => {
      const now = Date.now();
      if (now - lastMembershipCheckAtRef.current < 1200) {
        return;
      }
      lastMembershipCheckAtRef.current = now;

      try {
        const result: {
          status?: string;
          is_member?: boolean;
          isMember?: boolean;
        } = await invoke(
          mode === "bootstrap"
            ? "tg_required_channel_bootstrap"
            : "tg_required_channel_revalidate",
          { chatId: cfg.chatId },
        );
        const status =
          typeof result?.status === "string"
            ? result.status
            : result?.is_member === true || result?.isMember === true
              ? "member"
              : "not_member";
        setMustJoinRequiredChannel(status !== "member");
      } catch (error) {
        if (getBlockingRuntimeError(error)) {
          setMustJoinRequiredChannel(false);
          return;
        }

        setMustJoinRequiredChannel(true);
        console.warn(
          `ExplorerPage: required channel check failed (${mode})`,
          error,
        );
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const bootRequiredChannel = async () => {
      const cfg = await loadRequiredChannelConfig();
      if (cancelled) return;
      setRequiredChannel(cfg);
      await runRequiredChannelMembershipCheck(cfg, "bootstrap");
    };
    void bootRequiredChannel();
    return () => {
      cancelled = true;
    };
  }, [runRequiredChannelMembershipCheck]);

  useEffect(() => {
    if (!requiredChannel) {
      return;
    }
    let unlisten: (() => void) | null = null;
    listen<{ status?: string }>(
      "required-channel-membership-changed",
      (event) => {
        const payload = event.payload;
        if (!payload || typeof payload.status !== "string") {
          return;
        }
        setMustJoinRequiredChannel(payload.status !== "member");
      },
    )
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {
        // ignore
      });
    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [requiredChannel]);

  const handleRequiredChannelConfirmed = useCallback(() => {
    if (!requiredChannel) {
      setMustJoinRequiredChannel(false);
      return;
    }
    setMustJoinRequiredChannel(false);
    void runRequiredChannelMembershipCheck(requiredChannel, "revalidate");
  }, [requiredChannel, runRequiredChannelMembershipCheck]);

  const requestStructureBackup = useCallback(() => {
    // Cloud sync runs on an interval; this is kept as a callsite hook.
  }, []);

  return {
    handleRequiredChannelConfirmed,
    isOffline,
    mustJoinRequiredChannel,
    queueCloudSync,
    requestStructureBackup,
    requiredChannel,
    setIsOffline,
  };
}
