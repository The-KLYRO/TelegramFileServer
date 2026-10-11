import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { getExplorerSessionState } from "@/pages/explorer/explorerSessionStore";
import {
  DEFAULT_EXPLORER_HOME_PATH,
  DEFAULT_EXPLORER_RECENTS_LIMIT,
  EXPLORER_VIEW_MODE_KEY,
  type Favorite,
  type RecentPath,
  type TelegramAuthResult,
  type UserInfo,
  isSavedVirtualFilePath,
} from "@/pages/explorer/shared";

type Args = {
  isOfflineRef: MutableRefObject<boolean>;
  sessionDataRef: MutableRefObject<string | null>;
  hasAttemptedSessionRestoreRef: MutableRefObject<boolean>;
  setAvatarUrl: (value: string | null) => void;
  setExplorerHomePath: (value: string) => void;
  setFavorites: (value: string[] | ((prev: string[]) => string[])) => void;
  setPhoneNumber: (value: string | null) => void;
  setRecentPaths: (value: string[]) => void;
  setShowFavorites: (value: boolean) => void;
  setUserInfo: (value: UserInfo | null) => void;
  setUploadPremiumUser: (value: boolean | null) => void;
  uploadConfirmDraft: unknown;
  uploadPremiumUser: boolean | null;
  explorerHomePathRef: MutableRefObject<string>;
  explorerRecentsLimitRef: MutableRefObject<number>;
  showFavoritesRef: MutableRefObject<boolean>;
  confirmDeleteRef: MutableRefObject<boolean>;
  confirmMoveRef: MutableRefObject<boolean>;
  confirmRenameRef: MutableRefObject<boolean>;
  normalizeHomePathSetting: (value: string | null) => string;
  parseRecentsLimitSetting: (value: string | null) => number;
  parseSettingBool: (value: string | null, defaultValue: boolean) => boolean;
};

export function useExplorerAccountSettings({
  isOfflineRef,
  sessionDataRef,
  hasAttemptedSessionRestoreRef,
  setAvatarUrl,
  setExplorerHomePath,
  setFavorites,
  setPhoneNumber,
  setRecentPaths,
  setShowFavorites,
  setUserInfo,
  setUploadPremiumUser,
  uploadConfirmDraft,
  uploadPremiumUser,
  explorerHomePathRef,
  explorerRecentsLimitRef,
  showFavoritesRef,
  confirmDeleteRef,
  confirmMoveRef,
  confirmRenameRef,
  normalizeHomePathSetting,
  parseRecentsLimitSetting,
  parseSettingBool,
}: Args) {
  const sessionState = getExplorerSessionState();
  const [viewMode, setViewModeState] = useState<"list" | "grid">(
    () => sessionState.viewMode,
  );
  const [isViewModeLoaded, setIsViewModeLoaded] = useState(
    () => sessionState.hasHydratedExplorer,
  );

  const applyViewMode = useCallback(
    (value: "list" | "grid" | ((prev: "list" | "grid") => "list" | "grid")) => {
      setViewModeState(value);
    },
    [],
  );

  const refreshRecentPaths = useCallback(async () => {
    const limit = explorerRecentsLimitRef.current;
    try {
      const rows: RecentPath[] = await invoke("db_get_recent_paths", { limit });
      const paths = (Array.isArray(rows) ? rows : [])
        .map((row) => row.path)
        .filter(
          (path): path is string => typeof path === "string" && !!path.trim(),
        );
      setRecentPaths(Array.from(new Set(paths)));
    } catch {
      // ignore
    }
  }, [explorerRecentsLimitRef, setRecentPaths]);

  const loadFavorites = useCallback(async () => {
    if (!showFavoritesRef.current) {
      setFavorites([]);
      return;
    }
    try {
      const result: Favorite[] = await invoke("db_get_favorites");
      const favoritePaths = result
        .map((fav) => fav.path)
        .filter((path) => !isSavedVirtualFilePath(path));
      setFavorites(favoritePaths);
    } catch (error) {
      console.error("Error loading favorites:", error);
    }
  }, [setFavorites, showFavoritesRef]);

  const loadUserInfo = useCallback(async () => {
    try {
      const session = await invoke<{
        id: number;
        phone: string;
        session_data?: string;
        profile_photo?: string;
        first_name?: string;
        last_name?: string;
        username?: string;
        created_at: string;
      }>("db_get_session");
      if (!session) {
        return;
      }

      if (session.first_name || session.last_name || session.username) {
        setUserInfo({
          id: 0,
          username: session.username || null,
          first_name: session.first_name || null,
          last_name: session.last_name || null,
          profile_photo: session.profile_photo || null,
        });

        if (session.profile_photo) {
          setAvatarUrl(session.profile_photo);
        }
        if (session.phone) {
          setPhoneNumber(session.phone);
        }
      }

      sessionDataRef.current = session.session_data ?? null;

      if (session.session_data && !isOfflineRef.current) {
        hasAttemptedSessionRestoreRef.current = true;
        const result: TelegramAuthResult = await invoke("tg_restore_session", {
          sessionData: session.session_data,
        });

        if (result.authorized && result.user_info) {
          setUserInfo(result.user_info);
          if (result.user_info.profile_photo) {
            setAvatarUrl(result.user_info.profile_photo);
          }

          if (!session.first_name || !session.last_name || !session.username) {
            invoke("db_update_session_user_info", {
              firstName: result.user_info.first_name,
              lastName: result.user_info.last_name,
              username: result.user_info.username,
            }).catch((e) =>
              console.error("Failed to update user info cache:", e),
            );
          }
        }
      }
    } catch (error) {
      console.error("Error loading user info:", error);
    }
  }, [
    hasAttemptedSessionRestoreRef,
    isOfflineRef,
    sessionDataRef,
    setAvatarUrl,
    setPhoneNumber,
    setUserInfo,
  ]);

  useEffect(() => {
    if (!uploadConfirmDraft || uploadPremiumUser !== null) {
      return;
    }

    invoke<boolean>("tg_is_premium_user")
      .then((value) => setUploadPremiumUser(Boolean(value)))
      .catch(() => setUploadPremiumUser(false));
  }, [setUploadPremiumUser, uploadConfirmDraft, uploadPremiumUser]);

  useEffect(() => {
    if (sessionState.hasHydratedExplorer) {
      return;
    }

    let cancelled = false;

    const loadViewModePreference = async () => {
      try {
        const savedViewMode = await invoke<string | null>("db_get_setting", {
          key: EXPLORER_VIEW_MODE_KEY,
        });
        if (
          !cancelled &&
          (savedViewMode === "list" || savedViewMode === "grid")
        ) {
          applyViewMode(savedViewMode);
        }
      } catch (error) {
        console.error("Error loading explorer view mode setting:", error);
      } finally {
        if (!cancelled) {
          setIsViewModeLoaded(true);
        }
      }
    };

    void loadViewModePreference();
    return () => {
      cancelled = true;
    };
  }, [applyViewMode, sessionState.hasHydratedExplorer]);

  useEffect(() => {
    if (!isViewModeLoaded) {
      return;
    }
    invoke("db_set_setting", {
      key: EXPLORER_VIEW_MODE_KEY,
      value: viewMode,
    }).catch((error) => {
      console.error("Error saving explorer view mode setting:", error);
    });
  }, [isViewModeLoaded, viewMode]);

  useEffect(() => {
    const handler = (event: Event) => {
      const typed = event as CustomEvent<{ key?: unknown; value?: unknown }>;
      const detail = typed.detail;
      const key = typeof detail?.key === "string" ? detail.key : "";
      const value = typeof detail?.value === "string" ? detail.value : null;
      if (!key) {
        return;
      }

      if (key === "explorer_home_path") {
        const normalized = normalizeHomePathSetting(value);
        explorerHomePathRef.current = normalized;
        setExplorerHomePath(normalized);
        return;
      }
      if (key === "explorer_recents_limit") {
        explorerRecentsLimitRef.current = parseRecentsLimitSetting(value);
        void refreshRecentPaths();
        return;
      }
      if (key === "explorer_show_favorites") {
        const next = parseSettingBool(value, true);
        showFavoritesRef.current = next;
        setShowFavorites(next);
        if (next) {
          void loadFavorites();
        } else {
          setFavorites([]);
        }
        return;
      }
      if (key === "confirm_delete") {
        confirmDeleteRef.current = parseSettingBool(value, true);
        return;
      }
      if (key === "confirm_move") {
        confirmMoveRef.current = parseSettingBool(value, true);
        return;
      }
      if (key === "confirm_rename") {
        confirmRenameRef.current = parseSettingBool(value, true);
        return;
      }
      if (
        key === EXPLORER_VIEW_MODE_KEY &&
        (value === "list" || value === "grid")
      ) {
        applyViewMode(value);
      }
    };

    window.addEventListener("skybox-explorer-setting-changed", handler);
    return () => {
      window.removeEventListener("skybox-explorer-setting-changed", handler);
    };
  }, [
    applyViewMode,
    confirmDeleteRef,
    confirmMoveRef,
    confirmRenameRef,
    explorerHomePathRef,
    explorerRecentsLimitRef,
    loadFavorites,
    normalizeHomePathSetting,
    parseRecentsLimitSetting,
    parseSettingBool,
    refreshRecentPaths,
    setExplorerHomePath,
    setFavorites,
    setShowFavorites,
    showFavoritesRef,
  ]);

  return {
    isViewModeLoaded,
    loadFavorites,
    loadUserInfo,
    refreshRecentPaths,
    setViewMode: applyViewMode,
    viewMode,
  };
}
