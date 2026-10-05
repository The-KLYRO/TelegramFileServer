import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Dispatch,
  MutableRefObject,
  RefObject,
  SetStateAction,
} from "react";
import type { FileItem } from "@/components/skybox/FileRow";
import {
  getExplorerSessionState,
  updateExplorerSessionState,
} from "@/pages/explorer/explorerSessionStore";
import {
  DEFAULT_EXPLORER_HOME_PATH,
  type ExplorerContextMenuState,
  type ExplorerTab,
  type ExplorerTabSnapshot,
  createExplorerTabId,
  getExplorerTabTitle,
} from "@/pages/explorer/shared";

interface UseExplorerTabsParams {
  currentPath: string;
  explorerHomePathRef: MutableRefObject<string>;
  currentPathRef: MutableRefObject<string>;
  filesRef: MutableRefObject<FileItem[]>;
  savedItemsOffsetRef: MutableRefObject<number>;
  hasMoreSavedItemsRef: MutableRefObject<boolean>;
  selectedPathsRef: MutableRefObject<string[]>;
  selectedFileRef: MutableRefObject<FileItem | null>;
  searchRef: MutableRefObject<string>;
  navigationStateRef: MutableRefObject<{
    backHistory: string[];
    forwardHistory: string[];
    currentPath: string;
    isLoading: boolean;
  }>;
  explorerAreaRef: RefObject<HTMLDivElement | null>;
  loadDirectoryRef: MutableRefObject<
    (path: string, options?: { force?: boolean }) => Promise<void>
  >;
  closeDetailsPanel: () => void;
  setContextMenuState: Dispatch<
    SetStateAction<ExplorerContextMenuState | null>
  >;
  setError: Dispatch<SetStateAction<string | null>>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  setIsLoadingMoreSavedItems: Dispatch<SetStateAction<boolean>>;
  setSearch: Dispatch<SetStateAction<string>>;
  setBackHistory: Dispatch<SetStateAction<string[]>>;
  setForwardHistory: Dispatch<SetStateAction<string[]>>;
  setFiles: Dispatch<SetStateAction<FileItem[]>>;
  setCurrentPath: Dispatch<SetStateAction<string>>;
  setSavedItemsOffset: Dispatch<SetStateAction<number>>;
  setHasMoreSavedItems: Dispatch<SetStateAction<boolean>>;
  setSelectedPaths: Dispatch<SetStateAction<string[]>>;
  setSelectedFile: Dispatch<SetStateAction<FileItem | null>>;
}

export function useExplorerTabs({
  currentPath,
  explorerHomePathRef,
  currentPathRef,
  filesRef,
  savedItemsOffsetRef,
  hasMoreSavedItemsRef,
  selectedPathsRef,
  selectedFileRef,
  searchRef,
  navigationStateRef,
  explorerAreaRef,
  loadDirectoryRef,
  closeDetailsPanel,
  setContextMenuState,
  setError,
  setIsLoading,
  setIsLoadingMoreSavedItems,
  setSearch,
  setBackHistory,
  setForwardHistory,
  setFiles,
  setCurrentPath,
  setSavedItemsOffset,
  setHasMoreSavedItems,
  setSelectedPaths,
  setSelectedFile,
}: UseExplorerTabsParams) {
  const sessionState = getExplorerSessionState();
  const initialTabIdRef = useRef<string>(
    sessionState.activeTabId || createExplorerTabId(),
  );
  const [tabs, setTabs] = useState<ExplorerTab[]>(() => {
    if (sessionState.tabs.length > 0) {
      return sessionState.tabs;
    }

    return [
      {
        id: initialTabIdRef.current,
        path: "tg://saved",
        title: getExplorerTabTitle("tg://saved"),
      },
    ];
  });
  const [activeTabId, setActiveTabId] = useState<string>(
    () => sessionState.activeTabId || initialTabIdRef.current,
  );
  const tabSnapshotsRef = useRef<Record<string, ExplorerTabSnapshot>>(
    sessionState.tabSnapshots,
  );

  const captureTabSnapshot = useCallback(
    (tabId: string) => {
      tabSnapshotsRef.current[tabId] = {
        currentPath: currentPathRef.current,
        backHistory: navigationStateRef.current.backHistory,
        forwardHistory: navigationStateRef.current.forwardHistory,
        files: filesRef.current,
        savedItemsOffset: savedItemsOffsetRef.current,
        hasMoreSavedItems: hasMoreSavedItemsRef.current,
        selectedPaths: selectedPathsRef.current,
        selectedFile: selectedFileRef.current,
        search: searchRef.current,
        scrollTop: explorerAreaRef.current?.scrollTop ?? 0,
      };
      updateExplorerSessionState({
        tabSnapshots: tabSnapshotsRef.current,
      });
    },
    [
      currentPathRef,
      explorerAreaRef,
      filesRef,
      hasMoreSavedItemsRef,
      navigationStateRef,
      savedItemsOffsetRef,
      searchRef,
      selectedFileRef,
      selectedPathsRef,
    ],
  );

  const restoreTabSnapshot = useCallback(
    (tabId: string): boolean => {
      const snapshot = tabSnapshotsRef.current[tabId];
      if (!snapshot) {
        return false;
      }

      setContextMenuState(null);
      setError(null);
      setIsLoading(false);
      setIsLoadingMoreSavedItems(false);

      setSearch(snapshot.search);
      setBackHistory(snapshot.backHistory);
      setForwardHistory(snapshot.forwardHistory);
      setFiles(snapshot.files);
      setCurrentPath(snapshot.currentPath);
      setSavedItemsOffset(snapshot.savedItemsOffset);
      setHasMoreSavedItems(snapshot.hasMoreSavedItems);
      setSelectedPaths(snapshot.selectedPaths);
      setSelectedFile(snapshot.selectedFile);
      closeDetailsPanel();

      window.requestAnimationFrame(() => {
        if (explorerAreaRef.current) {
          explorerAreaRef.current.scrollTop = snapshot.scrollTop;
        }
      });

      return true;
    },
    [
      closeDetailsPanel,
      explorerAreaRef,
      setBackHistory,
      setContextMenuState,
      setCurrentPath,
      setError,
      setFiles,
      setForwardHistory,
      setHasMoreSavedItems,
      setIsLoading,
      setIsLoadingMoreSavedItems,
      setSavedItemsOffset,
      setSearch,
      setSelectedFile,
      setSelectedPaths,
    ],
  );

  const switchToTab = useCallback(
    (tabId: string) => {
      if (tabId === activeTabId) {
        return;
      }

      captureTabSnapshot(activeTabId);
      setActiveTabId(tabId);

      if (restoreTabSnapshot(tabId)) {
        return;
      }

      const targetTab = tabs.find((tab) => tab.id === tabId);
      if (!targetTab) {
        return;
      }

      setSearch("");
      setSelectedPaths([]);
      setSelectedFile(null);
      closeDetailsPanel();
      void loadDirectoryRef.current(targetTab.path);
    },
    [
      activeTabId,
      captureTabSnapshot,
      closeDetailsPanel,
      loadDirectoryRef,
      restoreTabSnapshot,
      setSearch,
      setSelectedFile,
      setSelectedPaths,
      tabs,
    ],
  );

  const openPathInNewTab = useCallback(
    (path: string) => {
      if (!path) {
        return;
      }

      captureTabSnapshot(activeTabId);

      const tabId = createExplorerTabId();
      setTabs((prev) => [
        ...prev,
        { id: tabId, path, title: getExplorerTabTitle(path) },
      ]);
      setActiveTabId(tabId);

      tabSnapshotsRef.current[tabId] = {
        currentPath: path,
        backHistory: [],
        forwardHistory: [],
        files: [],
        savedItemsOffset: 0,
        hasMoreSavedItems: false,
        selectedPaths: [],
        selectedFile: null,
        search: "",
        scrollTop: 0,
      };

      setContextMenuState(null);
      setSearch("");
      setSelectedPaths([]);
      setSelectedFile(null);
      closeDetailsPanel();
      void loadDirectoryRef.current(path);
    },
    [
      activeTabId,
      captureTabSnapshot,
      closeDetailsPanel,
      loadDirectoryRef,
      setContextMenuState,
      setSearch,
      setSelectedFile,
      setSelectedPaths,
    ],
  );

  const closeTab = useCallback(
    (tabId: string) => {
      if (tabs.length <= 1) {
        return;
      }

      const closingIndex = tabs.findIndex((tab) => tab.id === tabId);
      if (closingIndex < 0) {
        return;
      }

      const nextActiveId =
        tabId === activeTabId
          ? tabs[closingIndex - 1]?.id || tabs[closingIndex + 1]?.id
          : null;

      if (tabId === activeTabId && nextActiveId) {
        captureTabSnapshot(activeTabId);
      }

      setTabs((prev) => prev.filter((tab) => tab.id !== tabId));
      delete tabSnapshotsRef.current[tabId];

      if (nextActiveId) {
        setActiveTabId(nextActiveId);
        if (restoreTabSnapshot(nextActiveId)) {
          return;
        }

        const targetTab = tabs.find((tab) => tab.id === nextActiveId);
        if (targetTab) {
          void loadDirectoryRef.current(targetTab.path);
        }
      }
    },
    [
      activeTabId,
      captureTabSnapshot,
      loadDirectoryRef,
      restoreTabSnapshot,
      tabs,
    ],
  );

  const reorderTabs = useCallback(
    (
      draggedTabId: string,
      targetTabId: string,
      position: "before" | "after",
    ) => {
      if (!draggedTabId || !targetTabId || draggedTabId === targetTabId) {
        return;
      }

      setTabs((prev) => {
        const draggedIndex = prev.findIndex((tab) => tab.id === draggedTabId);
        const targetIndex = prev.findIndex((tab) => tab.id === targetTabId);
        if (draggedIndex < 0 || targetIndex < 0) {
          return prev;
        }

        const next = [...prev];
        const [draggedTab] = next.splice(draggedIndex, 1);
        const adjustedTargetIndex =
          draggedIndex < targetIndex ? targetIndex - 1 : targetIndex;
        const insertionIndex =
          position === "after" ? adjustedTargetIndex + 1 : adjustedTargetIndex;
        next.splice(
          Math.max(0, Math.min(next.length, insertionIndex)),
          0,
          draggedTab,
        );
        return next;
      });
    },
    [],
  );

  const applyTabOrder = useCallback((orderedTabIds: string[]) => {
    if (!orderedTabIds.length) {
      return;
    }

    setTabs((prev) => {
      const byId = new Map(prev.map((tab) => [tab.id, tab]));
      const next = orderedTabIds
        .map((tabId) => byId.get(tabId) || null)
        .filter((tab): tab is ExplorerTab => tab !== null);

      if (next.length !== prev.length) {
        return prev;
      }

      return next;
    });
  }, []);

  const createNewTab = useCallback(() => {
    const homePath = explorerHomePathRef.current || DEFAULT_EXPLORER_HOME_PATH;
    openPathInNewTab(homePath);
  }, [explorerHomePathRef, openPathInNewTab]);

  const handleOpenInNewTab = useCallback(
    (file: FileItem) => {
      if (!file.isDirectory) {
        return;
      }

      openPathInNewTab(file.path);
    },
    [openPathInNewTab],
  );

  useEffect(() => {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTabId
          ? {
              ...tab,
              path: currentPath,
              title: getExplorerTabTitle(currentPath),
            }
          : tab,
      ),
    );
  }, [activeTabId, currentPath]);

  useEffect(() => {
    updateExplorerSessionState({
      tabs,
      activeTabId,
      tabSnapshots: tabSnapshotsRef.current,
    });
  }, [activeTabId, tabs]);

  useEffect(() => {
    const handler = (event: Event) => {
      const typed = event as CustomEvent<{ paths: string[] }>;
      const removedPaths = new Set(
        (typed.detail?.paths || []).map((path) => path.replace(/\\/g, "/")),
      );
      if (!removedPaths.size) {
        return;
      }

      let changed = false;
      const nextSnapshots = Object.fromEntries(
        Object.entries(tabSnapshotsRef.current).map(([tabId, snapshot]) => {
          const nextFiles = snapshot.files.filter(
            (file) => !removedPaths.has(file.path.replace(/\\/g, "/")),
          );
          const nextSelectedPaths = snapshot.selectedPaths.filter(
            (path) => !removedPaths.has(path.replace(/\\/g, "/")),
          );
          const nextSelectedFile =
            snapshot.selectedFile &&
            removedPaths.has(snapshot.selectedFile.path.replace(/\\/g, "/"))
              ? null
              : snapshot.selectedFile;

          if (
            nextFiles.length !== snapshot.files.length ||
            nextSelectedPaths.length !== snapshot.selectedPaths.length ||
            nextSelectedFile !== snapshot.selectedFile
          ) {
            changed = true;
            return [
              tabId,
              {
                ...snapshot,
                files: nextFiles,
                selectedPaths: nextSelectedPaths,
                selectedFile: nextSelectedFile,
              },
            ];
          }

          return [tabId, snapshot];
        }),
      );

      if (!changed) {
        return;
      }

      tabSnapshotsRef.current = nextSnapshots;
      updateExplorerSessionState({ tabSnapshots: nextSnapshots });
    };

    window.addEventListener("skybox-explorer-paths-removed", handler);
    return () => {
      window.removeEventListener("skybox-explorer-paths-removed", handler);
    };
  }, []);

  useEffect(() => {
    const payload = {
      tabs: tabs.map((tab) => ({
        id: tab.id,
        title: tab.title,
        path: tab.path,
        iconName: tab.title,
      })),
      activeTabId,
    };
    window.dispatchEvent(
      new CustomEvent("skybox-explorer-tabs-update", { detail: payload }),
    );
  }, [activeTabId, tabs]);

  useEffect(() => {
    return () => {
      window.dispatchEvent(
        new CustomEvent("skybox-explorer-tabs-update", { detail: null }),
      );
    };
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const typed = event as CustomEvent<
        | { type: "switch"; tabId: string }
        | { type: "close"; tabId: string }
        | { type: "new" }
        | {
            type: "reorder";
            draggedTabId: string;
            targetTabId: string;
            position: "before" | "after";
          }
        | { type: "reorder-order"; orderedTabIds: string[] }
      >;
      const detail = typed.detail;
      if (!detail) {
        return;
      }

      if (detail.type === "switch") {
        switchToTab(detail.tabId);
        return;
      }

      if (detail.type === "close") {
        closeTab(detail.tabId);
        return;
      }

      if (detail.type === "new") {
        createNewTab();
        return;
      }

      if (detail.type === "reorder") {
        reorderTabs(detail.draggedTabId, detail.targetTabId, detail.position);
        return;
      }

      if (detail.type === "reorder-order") {
        applyTabOrder(detail.orderedTabIds);
      }
    };

    window.addEventListener("skybox-explorer-tabs-action", handler);
    return () => {
      window.removeEventListener("skybox-explorer-tabs-action", handler);
    };
  }, [applyTabOrder, closeTab, createNewTab, reorderTabs, switchToTab]);

  return {
    tabs,
    activeTabId,
    switchToTab,
    openPathInNewTab,
    closeTab,
    createNewTab,
    handleOpenInNewTab,
  };
}
