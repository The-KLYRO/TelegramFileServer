import type { FileItem } from "@/components/skybox/FileRow";
import {
  getDirectoryCache,
  getAllDirectoryCache,
  removeItemsFromCache,
  replaceDirectoryCache,
  setDirectoryCache,
} from "@/pages/explorer/explorerDirectoryCache";
import {
  DEFAULT_EXPLORER_HOME_PATH,
  createExplorerTabId,
  getExplorerTabTitle,
  normalizePath,
  type ExplorerTab,
  type ExplorerTabSnapshot,
  type ExplorerSortDirection,
  type ExplorerSortField,
  type ExplorerViewMode,
  type SavedPathCacheEntry,
} from "@/pages/explorer/shared";

export type SettingsRouteState = {
  returnTo?: string;
  fromExplorer?: boolean;
};

export type ExplorerSessionState = {
  hasHydratedExplorer: boolean;
  currentPath: string;
  backHistory: string[];
  forwardHistory: string[];
  files: FileItem[];
  savedItemsOffset: number;
  hasMoreSavedItems: boolean;
  search: string;
  selectedPaths: string[];
  selectedFile: FileItem | null;
  viewMode: ExplorerViewMode;
  sortField: ExplorerSortField;
  sortDirection: ExplorerSortDirection;
  explorerHomePath: string;
  recentPaths: string[];
  favorites: string[];
  showFavorites: boolean;
  scrollPositions: Record<string, number>;
  pendingScrollRestorePath: string | null;
  directoryCache: Record<string, SavedPathCacheEntry>;
  tabs: ExplorerTab[];
  activeTabId: string;
  tabSnapshots: Record<string, ExplorerTabSnapshot>;
};

const INITIAL_TAB_ID = createExplorerTabId();

const createInitialState = (): ExplorerSessionState => ({
  hasHydratedExplorer: false,
  currentPath: DEFAULT_EXPLORER_HOME_PATH,
  backHistory: [],
  forwardHistory: [],
  files: [],
  savedItemsOffset: 0,
  hasMoreSavedItems: false,
  search: "",
  selectedPaths: [],
  selectedFile: null,
  viewMode: "grid",
  sortField: "name",
  sortDirection: "asc",
  explorerHomePath: DEFAULT_EXPLORER_HOME_PATH,
  recentPaths: [],
  favorites: [],
  showFavorites: true,
  scrollPositions: {},
  pendingScrollRestorePath: null,
  directoryCache: getAllDirectoryCache(),
  tabs: [
    {
      id: INITIAL_TAB_ID,
      path: DEFAULT_EXPLORER_HOME_PATH,
      title: getExplorerTabTitle(DEFAULT_EXPLORER_HOME_PATH),
    },
  ],
  activeTabId: INITIAL_TAB_ID,
  tabSnapshots: {},
});

let explorerSessionState = createInitialState();

export const getExplorerSessionState = (): ExplorerSessionState => {
  return explorerSessionState;
};

export const updateExplorerSessionState = (
  updater:
    | Partial<ExplorerSessionState>
    | ((state: ExplorerSessionState) => Partial<ExplorerSessionState>),
): ExplorerSessionState => {
  const patch =
    typeof updater === "function" ? updater(explorerSessionState) : updater;
  explorerSessionState = {
    ...explorerSessionState,
    ...patch,
  };
  return explorerSessionState;
};

export const markExplorerHydrated = (): void => {
  updateExplorerSessionState({ hasHydratedExplorer: true });
};

export const rememberExplorerScrollPosition = (
  path: string,
  scrollTop: number,
): void => {
  if (!path) {
    return;
  }

  updateExplorerSessionState((state) => ({
    scrollPositions: {
      ...state.scrollPositions,
      [path]: Math.max(0, scrollTop),
    },
  }));
};

export const getExplorerScrollPosition = (path: string): number => {
  if (!path) {
    return 0;
  }

  return explorerSessionState.scrollPositions[path] ?? 0;
};

export const queueExplorerScrollRestore = (path: string | null): void => {
  updateExplorerSessionState({ pendingScrollRestorePath: path });
};

export const consumeExplorerScrollRestore = (path: string): boolean => {
  if (!path || explorerSessionState.pendingScrollRestorePath !== path) {
    return false;
  }

  updateExplorerSessionState({ pendingScrollRestorePath: null });
  return true;
};

export const cacheExplorerDirectory = (
  path: string,
  snapshot: SavedPathCacheEntry,
): void => {
  if (!path) {
    return;
  }

  // The persisted cache is the single source of truth; the in-memory session
  // mirror below exists only so a freshly-mounted hook can seed its ref.
  setDirectoryCache(path, snapshot);
  updateExplorerSessionState((state) => ({
    directoryCache: {
      ...state.directoryCache,
      [path]: snapshot,
    },
  }));
};

export const getCachedExplorerDirectory = (
  path: string,
): SavedPathCacheEntry | null => {
  if (!path) {
    return null;
  }

  return getDirectoryCache(path);
};

export const replaceExplorerDirectoryCache = (
  nextCache: Record<string, SavedPathCacheEntry>,
): void => {
  replaceDirectoryCache(nextCache);
  updateExplorerSessionState({ directoryCache: { ...nextCache } });
};

export const removePathsFromExplorerState = (paths: string[]): void => {
  const normalizedPaths = Array.from(
    new Set(
      paths
        .filter((path) => typeof path === "string" && path.trim())
        .map((path) => normalizePath(path)),
    ),
  );
  if (!normalizedPaths.length) {
    return;
  }

  const removedSet = new Set(normalizedPaths);
  const filterItems = (items: FileItem[]): FileItem[] =>
    items.filter((item) => !removedSet.has(normalizePath(item.path)));
  const filterSelectedPaths = (selectedPaths: string[]): string[] =>
    selectedPaths.filter((path) => !removedSet.has(normalizePath(path)));

  // Reach every cached listing, not just this session's mirror — the old
  // implementation only filtered `directoryCache`, leaving the hook-level ref
  // (and the persisted copy, once added) still holding the removed items.
  removeItemsFromCache(normalizedPaths);

  updateExplorerSessionState((state) => {
    const nextTabSnapshots = Object.fromEntries(
      Object.entries(state.tabSnapshots).map(([tabId, snapshot]) => [
        tabId,
        {
          ...snapshot,
          files: filterItems(snapshot.files),
          selectedPaths: filterSelectedPaths(snapshot.selectedPaths),
          selectedFile:
            snapshot.selectedFile &&
            removedSet.has(normalizePath(snapshot.selectedFile.path))
              ? null
              : snapshot.selectedFile,
        },
      ]),
    );

    return {
      files: filterItems(state.files),
      selectedPaths: filterSelectedPaths(state.selectedPaths),
      selectedFile:
        state.selectedFile &&
        removedSet.has(normalizePath(state.selectedFile.path))
          ? null
          : state.selectedFile,
      directoryCache: { ...getAllDirectoryCache() },
      tabSnapshots: nextTabSnapshots,
    };
  });

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("skybox-explorer-paths-removed", {
        detail: { paths: normalizedPaths },
      }),
    );
  }
};
