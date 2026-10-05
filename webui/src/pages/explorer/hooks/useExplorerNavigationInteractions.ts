import { useCallback, useEffect, useMemo, type MutableRefObject } from "react";
import { type FileItem } from "@/components/skybox/FileRow";
import {
  RECYCLE_BIN_VIRTUAL_PATH,
  type ExplorerClipboardItem,
  type ExplorerViewMode,
  getExplorerTabTitle,
  isDriveVirtualFolderPath,
  isTextInputElement,
  parseDriveChatIdFromPath,
} from "@/pages/explorer/shared";

type Args = {
  backHistory: string[];
  clipboardItem: ExplorerClipboardItem | null;
  closeDetailsPanel: () => void;
  closeLocalImageViewer: () => void;
  closeLocalVideoViewer: () => void;
  closeSavedMediaViewer: () => void;
  currentPath: string;
  filesRef: React.MutableRefObject<FileItem[]>;
  forwardHistory: string[];
  handleLogout: () => Promise<void> | void;
  handlePaste: () => Promise<void>;
  handleRefresh: () => Promise<void>;
  handleStageClipboardItem: (
    mode: "copy" | "cut",
    targetFile?: FileItem | null,
  ) => void;
  isRouteActive: boolean;
  isLoading: boolean;
  isLocalImageViewerOpen: boolean;
  isLocalVideoViewerOpen: boolean;
  isMediaViewerOpen: boolean;
  loadDirectory: (path: string, options?: { force?: boolean }) => Promise<void>;
  navigationStateRef: MutableRefObject<{
    backHistory: string[];
    forwardHistory: string[];
    currentPath: string;
    isLoading: boolean;
  }>;
  requestDeleteTargets: (targets: FileItem[]) => void;
  search: string;
  selectedFile: FileItem | null;
  selectedPaths: string[];
  setBackHistory: React.Dispatch<React.SetStateAction<string[]>>;
  setForwardHistory: React.Dispatch<React.SetStateAction<string[]>>;
  setSelectedFile: React.Dispatch<React.SetStateAction<FileItem | null>>;
  setSelectedPaths: React.Dispatch<React.SetStateAction<string[]>>;
};

export function useExplorerNavigationInteractions({
  backHistory,
  clipboardItem,
  closeDetailsPanel,
  closeLocalImageViewer,
  closeLocalVideoViewer,
  closeSavedMediaViewer,
  currentPath,
  filesRef,
  forwardHistory,
  handleLogout,
  handlePaste,
  handleRefresh,
  handleStageClipboardItem,
  isRouteActive,
  isLoading,
  isLocalImageViewerOpen,
  isLocalVideoViewerOpen,
  isMediaViewerOpen,
  loadDirectory,
  navigationStateRef,
  requestDeleteTargets,
  search,
  selectedFile,
  selectedPaths,
  setBackHistory,
  setForwardHistory,
  setSelectedFile,
  setSelectedPaths,
}: Args) {
  const navigateToPath = useCallback(
    async (path: string) => {
      if (!path) return;
      if (path === currentPath) {
        await loadDirectory(path);
        return;
      }
      setBackHistory((prev) => [...prev, currentPath]);
      setForwardHistory([]);
      await loadDirectory(path);
    },
    [currentPath, loadDirectory, setBackHistory, setForwardHistory],
  );

  const handleGoBack = useCallback(async () => {
    if (!backHistory.length) return;
    const previousPath = backHistory[backHistory.length - 1];
    setBackHistory((prev) => prev.slice(0, -1));
    setForwardHistory((prev) => [...prev, currentPath]);
    await loadDirectory(previousPath);
  }, [
    backHistory,
    currentPath,
    loadDirectory,
    setBackHistory,
    setForwardHistory,
  ]);

  const handleGoForward = useCallback(async () => {
    if (!forwardHistory.length) return;
    const nextPath = forwardHistory[forwardHistory.length - 1];
    setForwardHistory((prev) => prev.slice(0, -1));
    setBackHistory((prev) => [...prev, currentPath]);
    await loadDirectory(nextPath);
  }, [
    currentPath,
    forwardHistory,
    loadDirectory,
    setBackHistory,
    setForwardHistory,
  ]);

  useEffect(() => {
    const handleNavigateEvent = (event: CustomEvent) => {
      if (!isRouteActive) {
        return;
      }
      const nextPath = event.detail;
      if (!nextPath) return;
      if (nextPath === currentPath) {
        void loadDirectory(nextPath, { force: true });
        return;
      }
      setBackHistory((prev) => [...prev, currentPath]);
      setForwardHistory([]);
      void loadDirectory(nextPath);
    };

    window.addEventListener(
      "navigate-to-path",
      handleNavigateEvent as EventListener,
    );
    return () => {
      window.removeEventListener(
        "navigate-to-path",
        handleNavigateEvent as EventListener,
      );
    };
  }, [
    currentPath,
    isRouteActive,
    loadDirectory,
    setBackHistory,
    setForwardHistory,
  ]);

  useEffect(() => {
    const handleLogoutEvent = () => {
      void handleLogout();
    };
    window.addEventListener("logout-request", handleLogoutEvent);
    return () => {
      window.removeEventListener("logout-request", handleLogoutEvent);
    };
  }, [handleLogout]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isRouteActive) {
        return;
      }
      const isViewerOpen =
        isMediaViewerOpen || isLocalImageViewerOpen || isLocalVideoViewerOpen;
      if (isViewerOpen) {
        const isBackShortcut =
          e.key === "BrowserBack" || (e.altKey && e.key === "ArrowLeft");
        if (e.key === "Escape" || isBackShortcut) {
          e.preventDefault();
          if (isMediaViewerOpen) {
            closeSavedMediaViewer();
            return;
          }
          if (isLocalImageViewerOpen) closeLocalImageViewer();
          if (isLocalVideoViewerOpen) closeLocalVideoViewer();
        }
        return;
      }

      const canNavigateByKeyboard = !isTextInputElement(e.target);
      const isBackShortcut =
        e.key === "BrowserBack" || (e.altKey && e.key === "ArrowLeft");
      const isForwardShortcut =
        e.key === "BrowserForward" || (e.altKey && e.key === "ArrowRight");

      if (canNavigateByKeyboard && isBackShortcut) {
        e.preventDefault();
        void handleGoBack();
        return;
      }
      if (canNavigateByKeyboard && isForwardShortcut) {
        e.preventDefault();
        void handleGoForward();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "r") {
        e.preventDefault();
        void handleRefresh();
      }

      if (
        canNavigateByKeyboard &&
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "a"
      ) {
        e.preventDefault();
        const query = search.trim().toLowerCase();
        const visibleFiles = filesRef.current.filter((file) => {
          if (
            currentPath === "tg://saved" &&
            file.isDirectory &&
            file.path === RECYCLE_BIN_VIRTUAL_PATH
          ) {
            return false;
          }
          return !query || file.name.toLowerCase().includes(query);
        });
        const allVisiblePaths = visibleFiles.map((file) => file.path);
        setSelectedPaths(allVisiblePaths);
        if (allVisiblePaths.length > 0) {
          setSelectedFile(visibleFiles[0]);
        } else {
          setSelectedFile(null);
          closeDetailsPanel();
        }
        if (allVisiblePaths.length > 1) closeDetailsPanel();
        return;
      }

      if (
        canNavigateByKeyboard &&
        (e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        e.key.toLowerCase() === "c"
      ) {
        e.preventDefault();
        const targetFile =
          selectedFile ??
          (selectedPaths.length > 0
            ? filesRef.current.find((file) => file.path === selectedPaths[0]) ||
              null
            : null);
        if (targetFile) handleStageClipboardItem("copy", targetFile);
        return;
      }

      if (
        canNavigateByKeyboard &&
        (e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        e.key.toLowerCase() === "x"
      ) {
        e.preventDefault();
        const targetFile =
          selectedFile ??
          (selectedPaths.length > 0
            ? filesRef.current.find((file) => file.path === selectedPaths[0]) ||
              null
            : null);
        if (targetFile) handleStageClipboardItem("cut", targetFile);
        return;
      }

      if (
        canNavigateByKeyboard &&
        (e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        e.key.toLowerCase() === "v"
      ) {
        if (!clipboardItem) return;
        e.preventDefault();
        void handlePaste();
        return;
      }

      if (e.key === "Escape" && selectedPaths.length >= 0) {
        closeDetailsPanel();
      }

      if (e.key === "Delete" && selectedPaths.length > 0) {
        const targets = selectedPaths
          .map(
            (path) =>
              filesRef.current.find((file) => file.path === path) || null,
          )
          .filter((item): item is FileItem => !!item);
        if (targets.length) requestDeleteTargets(targets);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    clipboardItem,
    closeDetailsPanel,
    closeLocalImageViewer,
    closeLocalVideoViewer,
    closeSavedMediaViewer,
    currentPath,
    filesRef,
    handleGoBack,
    handleGoForward,
    handlePaste,
    handleRefresh,
    handleStageClipboardItem,
    isRouteActive,
    isLocalImageViewerOpen,
    isLocalVideoViewerOpen,
    isMediaViewerOpen,
    requestDeleteTargets,
    search,
    selectedFile,
    selectedPaths,
    setSelectedFile,
    setSelectedPaths,
  ]);

  useEffect(() => {
    if (!isRouteActive) {
      return;
    }

    const suppressDefaultMouseNavigation = (event: MouseEvent) => {
      if (event.button === 3 || event.button === 4) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const handleMouseNavigationButtons = (event: MouseEvent) => {
      if (isTextInputElement(event.target)) return;
      if (
        isMediaViewerOpen ||
        isLocalImageViewerOpen ||
        isLocalVideoViewerOpen
      ) {
        if (event.button === 3 || event.button === 4) {
          event.preventDefault();
          event.stopPropagation();
          if (isMediaViewerOpen) {
            closeSavedMediaViewer();
            return;
          }
          closeLocalImageViewer();
          closeLocalVideoViewer();
        }
        return;
      }
      if (event.button === 3) {
        event.preventDefault();
        event.stopPropagation();
        void handleGoBack();
      }
      if (event.button === 4) {
        event.preventDefault();
        event.stopPropagation();
        void handleGoForward();
      }
    };

    window.addEventListener("mousedown", suppressDefaultMouseNavigation, true);
    window.addEventListener("mouseup", handleMouseNavigationButtons, true);
    return () => {
      window.removeEventListener(
        "mousedown",
        suppressDefaultMouseNavigation,
        true,
      );
      window.removeEventListener("mouseup", handleMouseNavigationButtons, true);
    };
  }, [
    closeLocalImageViewer,
    closeLocalVideoViewer,
    closeSavedMediaViewer,
    handleGoBack,
    handleGoForward,
    isRouteActive,
    isLocalImageViewerOpen,
    isLocalVideoViewerOpen,
    isMediaViewerOpen,
  ]);

  useEffect(() => {
    if (!isRouteActive) {
      return;
    }

    const explorerUrl = window.location.href;
    const guardState = {
      ...(window.history.state || {}),
      __skyboxExplorerGuard: true,
    };
    const hasGuardState =
      typeof window.history.state === "object" &&
      window.history.state !== null &&
      "__skyboxExplorerGuard" in window.history.state;
    if (!hasGuardState) {
      window.history.pushState(guardState, "", explorerUrl);
    }

    const handlePopState = () => {
      window.history.pushState(guardState, "", explorerUrl);
      if (isMediaViewerOpen) {
        closeSavedMediaViewer();
        return;
      }
      if (isLocalImageViewerOpen || isLocalVideoViewerOpen) {
        closeLocalImageViewer();
        closeLocalVideoViewer();
        return;
      }
      const {
        backHistory: stack,
        currentPath: activePath,
        isLoading: loading,
      } = navigationStateRef.current;
      if (!stack.length || loading) return;
      const previousPath = stack[stack.length - 1];
      setBackHistory((prev) => prev.slice(0, -1));
      setForwardHistory((prev) => [...prev, activePath]);
      void loadDirectory(previousPath);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [
    closeLocalImageViewer,
    closeLocalVideoViewer,
    closeSavedMediaViewer,
    isLocalImageViewerOpen,
    isLocalVideoViewerOpen,
    isMediaViewerOpen,
    isRouteActive,
    loadDirectory,
    navigationStateRef,
    setBackHistory,
    setForwardHistory,
  ]);

  const breadcrumbItems = useMemo(() => {
    if (!currentPath) return [];
    if (currentPath.startsWith("tg://saved")) {
      const relativePath = currentPath.replace(/^tg:\/\/saved\/?/, "");
      if (!relativePath) return [];
      const parts = relativePath.split("/").filter(Boolean);
      const breadcrumbs: { name: string; path: string }[] = [];
      let runningPath = "tg://saved";
      parts.forEach((part) => {
        runningPath = `${runningPath}/${part}`;
        breadcrumbs.push({ name: part, path: runningPath });
      });
      return breadcrumbs;
    }
    if (isDriveVirtualFolderPath(currentPath)) {
      const chatId = parseDriveChatIdFromPath(currentPath);
      const title = getExplorerTabTitle(currentPath);
      if (!chatId) return [];
      return [{ name: title, path: `tg://drive/${chatId}` }];
    }
    const parts = currentPath.split("/").filter(Boolean);
    const breadcrumbs: { name: string; path: string }[] = [];
    let current = "";
    parts.forEach((part) => {
      current += `/${part}`;
      breadcrumbs.push({ name: part, path: current });
    });
    return breadcrumbs;
  }, [currentPath]);

  return {
    backHistory,
    breadcrumbItems,
    forwardHistory,
    handleGoBack,
    handleGoForward,
    handleNavigateToPath: navigateToPath,
    navigateToPath,
  };
}
