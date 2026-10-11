import { useEffect, type MutableRefObject } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getExplorerSessionState } from "@/pages/explorer/explorerSessionStore";
import {
  DEFAULT_EXPLORER_HOME_PATH,
  EXPLORER_VIEW_MODE_KEY,
  type ExplorerViewMode,
  type UserInfo,
} from "@/pages/explorer/shared";

type InitialRouteState =
  | {
      initialPath?: unknown;
      userInfo?: unknown;
    }
  | null
  | undefined;

type UseExplorerBootstrapArgs = {
  initialRouteState: unknown;
  normalizeHomePathSetting: (value: string | null) => string;
  parseRecentsLimitSetting: (value: string | null) => number;
  parseSettingBool: (value: string | null, defaultValue: boolean) => boolean;
  setExplorerHomePath: (value: string) => void;
  explorerHomePathRef: MutableRefObject<string>;
  explorerRecentsLimitRef: MutableRefObject<number>;
  showFavoritesRef: MutableRefObject<boolean>;
  confirmDeleteRef: MutableRefObject<boolean>;
  confirmMoveRef: MutableRefObject<boolean>;
  confirmRenameRef: MutableRefObject<boolean>;
  setShowFavorites: (value: boolean) => void;
  setViewMode: (value: ExplorerViewMode) => void;
  loadDirectoryRef: MutableRefObject<
    (path: string, options?: { force?: boolean }) => Promise<void>
  >;
  refreshRecentPaths: () => Promise<void>;
  loadFavorites: () => Promise<void>;
  setFavorites: (value: string[]) => void;
  setUserInfo: (value: UserInfo) => void;
  loadUserInfo: () => Promise<void>;
};

export function useExplorerBootstrap({
  initialRouteState,
  normalizeHomePathSetting,
  parseRecentsLimitSetting,
  parseSettingBool,
  setExplorerHomePath,
  explorerHomePathRef,
  explorerRecentsLimitRef,
  showFavoritesRef,
  confirmDeleteRef,
  confirmMoveRef,
  confirmRenameRef,
  setShowFavorites,
  setViewMode,
  loadDirectoryRef,
  refreshRecentPaths,
  loadFavorites,
  setFavorites,
  setUserInfo,
  loadUserInfo,
}: UseExplorerBootstrapArgs) {
  const sessionState = getExplorerSessionState();

  useEffect(() => {
    let cancelled = false;

    const initialState = initialRouteState as InitialRouteState;
    const requestedInitialPath =
      initialState && typeof initialState.initialPath === "string"
        ? initialState.initialPath
        : null;

    const loadExplorerSettingsAndBootstrap = async () => {
      if (sessionState.hasHydratedExplorer) {
        const restoredHomePath =
          sessionState.explorerHomePath || DEFAULT_EXPLORER_HOME_PATH;
        explorerHomePathRef.current = restoredHomePath;
        setExplorerHomePath(restoredHomePath);
        showFavoritesRef.current = sessionState.showFavorites;
        setShowFavorites(sessionState.showFavorites);
        setViewMode(sessionState.viewMode);
        setFavorites(sessionState.favorites);
        return;
      }

      try {
        const [
          homePath,
          recentsLimit,
          showFavoritesValue,
          confirmDeleteValue,
          confirmMoveValue,
          confirmRenameValue,
          viewModeValue,
        ] = await Promise.all([
          invoke<string | null>("db_get_setting", {
            key: "explorer_home_path",
          }),
          invoke<string | null>("db_get_setting", {
            key: "explorer_recents_limit",
          }),
          invoke<string | null>("db_get_setting", {
            key: "explorer_show_favorites",
          }),
          invoke<string | null>("db_get_setting", { key: "confirm_delete" }),
          invoke<string | null>("db_get_setting", { key: "confirm_move" }),
          invoke<string | null>("db_get_setting", { key: "confirm_rename" }),
          invoke<string | null>("db_get_setting", {
            key: EXPLORER_VIEW_MODE_KEY,
          }),
        ]);

        if (cancelled) {
          return;
        }

        const normalizedHomePath = normalizeHomePathSetting(homePath);
        explorerHomePathRef.current = normalizedHomePath;
        setExplorerHomePath(normalizedHomePath);

        explorerRecentsLimitRef.current =
          parseRecentsLimitSetting(recentsLimit);

        const nextShowFavorites = parseSettingBool(showFavoritesValue, true);
        showFavoritesRef.current = nextShowFavorites;
        setShowFavorites(nextShowFavorites);
        confirmDeleteRef.current = parseSettingBool(confirmDeleteValue, true);
        confirmMoveRef.current = parseSettingBool(confirmMoveValue, true);
        confirmRenameRef.current = parseSettingBool(confirmRenameValue, true);

        if (viewModeValue === "list" || viewModeValue === "grid") {
          setViewMode(viewModeValue);
        }

        const bootstrapPath =
          requestedInitialPath && requestedInitialPath.trim()
            ? requestedInitialPath.trim()
            : normalizedHomePath;

        void loadDirectoryRef.current(bootstrapPath);
        void refreshRecentPaths();

        if (nextShowFavorites) {
          void loadFavorites();
        } else {
          setFavorites([]);
        }
      } catch {
        void loadDirectoryRef.current(
          requestedInitialPath && requestedInitialPath.trim()
            ? requestedInitialPath.trim()
            : DEFAULT_EXPLORER_HOME_PATH,
        );
      }
    };

    void loadExplorerSettingsAndBootstrap();

    const passedUserInfo =
      initialState && typeof initialState.userInfo === "object"
        ? (initialState.userInfo as UserInfo)
        : undefined;
    if (passedUserInfo) {
      setUserInfo(passedUserInfo);
    } else {
      void loadUserInfo();
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
