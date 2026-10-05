import { useCallback, useEffect, useMemo, type MutableRefObject } from "react";
import { type FileItem } from "@/components/skybox/FileRow";
import {
  DEFAULT_EXPLORER_HOME_PATH,
  DETAILS_PANEL_ANIMATION_MS,
  NOTES_VIRTUAL_PATH,
  RECYCLE_BIN_VIRTUAL_PATH,
  type DownloadProgressPayload,
  type ExplorerContextMenuState,
  type ExplorerSortDirection,
  type ExplorerSortField,
  type ExplorerViewMode,
  isGalleryPath,
  isHiddenExplorerFileName,
  isNotesVirtualPath,
  isRecycleBinPath,
} from "@/pages/explorer/shared";

type Args = {
  activeDownload: DownloadProgressPayload | null;
  contextMenuState: ExplorerContextMenuState | null;
  currentPath: string;
  detailsPanelCloseTimerRef: MutableRefObject<number | null>;
  detailsPanelRef: MutableRefObject<HTMLDivElement | null>;
  downloadDetailMessage: string | undefined;
  downloadProgressPercent: number;
  downloadToolbarLabel: string;
  explorerHomePathRef: MutableRefObject<string>;
  files: FileItem[];
  isDetailsPanelOpen: boolean;
  isLoading: boolean;
  isSavedBackfillSyncing: boolean;
  isTransferMenuOpen: boolean;
  search: string;
  selectedFile: FileItem | null;
  selectedPaths: string[];
  setSortDirection: React.Dispatch<React.SetStateAction<ExplorerSortDirection>>;
  setSortField: React.Dispatch<React.SetStateAction<ExplorerSortField>>;
  setContextMenuState: (value: ExplorerContextMenuState | null) => void;
  contextMenuRef: MutableRefObject<HTMLDivElement | null>;
  setIsDetailsPanelOpen: (value: boolean) => void;
  setIsSendingNoteMessage: (value: boolean) => void;
  setIsTransferMenuOpen: (
    value: boolean | ((prev: boolean) => boolean),
  ) => void;
  setNoteComposerValue: (value: string) => void;
  setSelectedFile: (value: FileItem | null) => void;
  setSelectedPaths: React.Dispatch<React.SetStateAction<string[]>>;
  setShowDetails: (value: boolean) => void;
  showDetails: boolean;
  sortDirection: ExplorerSortDirection;
  sortField: ExplorerSortField;
  transferMenuRef: MutableRefObject<HTMLDivElement | null>;
  transferMenuTriggerRef: MutableRefObject<HTMLDivElement | null>;
  uploadQueueItemsLength: number;
  setViewMode:
    | React.Dispatch<React.SetStateAction<ExplorerViewMode>>
    | ((value: any) => void);
};

export function useExplorerControllerUi({
  activeDownload,
  contextMenuState,
  contextMenuRef,
  currentPath,
  detailsPanelCloseTimerRef,
  detailsPanelRef,
  downloadDetailMessage,
  downloadProgressPercent,
  downloadToolbarLabel,
  explorerHomePathRef,
  files,
  isDetailsPanelOpen,
  isLoading,
  isSavedBackfillSyncing,
  isTransferMenuOpen,
  search,
  selectedFile,
  selectedPaths,
  setSortDirection,
  setSortField,
  setContextMenuState,
  setIsDetailsPanelOpen,
  setIsSendingNoteMessage,
  setIsTransferMenuOpen,
  setNoteComposerValue,
  setSelectedFile,
  setSelectedPaths,
  setShowDetails,
  showDetails,
  sortDirection,
  sortField,
  transferMenuRef,
  transferMenuTriggerRef,
  uploadQueueItemsLength,
  setViewMode,
}: Args) {
  const clearDetailsPanelCloseTimer = useCallback(() => {
    if (detailsPanelCloseTimerRef.current !== null) {
      window.clearTimeout(detailsPanelCloseTimerRef.current);
      detailsPanelCloseTimerRef.current = null;
    }
  }, [detailsPanelCloseTimerRef]);

  const openDetailsPanel = useCallback(() => {
    clearDetailsPanelCloseTimer();
    setShowDetails(true);
    window.requestAnimationFrame(() => {
      setIsDetailsPanelOpen(true);
    });
  }, [clearDetailsPanelCloseTimer, setIsDetailsPanelOpen, setShowDetails]);

  const closeDetailsPanel = useCallback(() => {
    if (!showDetails && !isDetailsPanelOpen) {
      return;
    }
    clearDetailsPanelCloseTimer();
    setIsDetailsPanelOpen(false);
    detailsPanelCloseTimerRef.current = window.setTimeout(() => {
      setShowDetails(false);
      detailsPanelCloseTimerRef.current = null;
    }, DETAILS_PANEL_ANIMATION_MS);
  }, [
    clearDetailsPanelCloseTimer,
    detailsPanelCloseTimerRef,
    isDetailsPanelOpen,
    setIsDetailsPanelOpen,
    setShowDetails,
    showDetails,
  ]);

  useEffect(() => {
    return () => {
      clearDetailsPanelCloseTimer();
    };
  }, [clearDetailsPanelCloseTimer]);

  const filteredFiles = useMemo(() => {
    const query = search.trim().toLowerCase();
    return files.filter((file) => {
      if (!file.isDirectory && isHiddenExplorerFileName(file.name)) {
        return false;
      }

      if (
        currentPath === "tg://saved" &&
        file.isDirectory &&
        (file.path === RECYCLE_BIN_VIRTUAL_PATH ||
          file.path === NOTES_VIRTUAL_PATH)
      ) {
        return false;
      }
      return !query || file.name.toLowerCase().includes(query);
    });
  }, [currentPath, files, search]);

  const sortedFiles = useMemo(() => {
    const compareByName = (a: FileItem, b: FileItem) => {
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    };

    const compareByModifiedAt = (a: FileItem, b: FileItem) => {
      const dateA = new Date(a.modifiedAt || "").getTime();
      const dateB = new Date(b.modifiedAt || "").getTime();
      if (dateA === dateB) {
        return compareByName(a, b);
      }
      return dateA - dateB;
    };

    const applyDirection = (value: number) => {
      return sortDirection === "desc" ? value * -1 : value;
    };

    if (isGalleryPath(currentPath)) {
      return [...filteredFiles].sort((a, b) => compareByModifiedAt(b, a));
    }

    if (currentPath.startsWith("tg://saved")) {
      if (isNotesVirtualPath(currentPath)) {
        return [...filteredFiles].sort((a, b) => {
          const comparison =
            sortField === "modified_at"
              ? compareByModifiedAt(a, b)
              : compareByName(a, b);
          return applyDirection(comparison);
        });
      }

      if (sortField === "name" && sortDirection === "asc") {
        return filteredFiles;
      }

      return [...filteredFiles].sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        const comparison =
          sortField === "modified_at"
            ? compareByModifiedAt(a, b)
            : compareByName(a, b);
        return applyDirection(comparison);
      });
    }

    return [...filteredFiles].sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      const comparison =
        sortField === "modified_at"
          ? compareByModifiedAt(a, b)
          : compareByName(a, b);
      return applyDirection(comparison);
    });
  }, [currentPath, filteredFiles, sortDirection, sortField]);

  useEffect(() => {
    setSelectedPaths((prev) => {
      if (!prev.length) return prev;
      const availablePaths = new Set(files.map((item) => item.path));
      const next = prev.filter((path) => availablePaths.has(path));
      return next.length === prev.length ? prev : next;
    });
  }, [files, setSelectedPaths]);

  useEffect(() => {
    if (!selectedPaths.length) {
      if (selectedFile) setSelectedFile(null);
      return;
    }
    if (selectedFile && selectedPaths.includes(selectedFile.path)) return;
    const nextSelectedFile =
      files.find((item) => item.path === selectedPaths[0]) || null;
    setSelectedFile(nextSelectedFile);
  }, [files, selectedFile, selectedPaths, setSelectedFile]);

  useEffect(() => {
    if (selectedPaths.length > 1) {
      closeDetailsPanel();
    }
  }, [closeDetailsPanel, selectedPaths.length]);

  useEffect(() => {
    if (!contextMenuState) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (
        contextMenuRef.current &&
        target &&
        contextMenuRef.current.contains(target)
      ) {
        return;
      }
      setContextMenuState(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setContextMenuState(null);
      }
    };

    const handleViewportChange = () => {
      setContextMenuState(null);
    };

    window.addEventListener("mousedown", handlePointerDown, true);
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("scroll", handleViewportChange, true);
    window.addEventListener("blur", handleViewportChange);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown, true);
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("scroll", handleViewportChange, true);
      window.removeEventListener("blur", handleViewportChange);
    };
  }, [contextMenuRef, contextMenuState, setContextMenuState]);

  useEffect(() => {
    if (!isTransferMenuOpen) return;
    const handleWindowClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (
        transferMenuRef.current &&
        target &&
        transferMenuRef.current.contains(target)
      )
        return;
      if (
        transferMenuTriggerRef.current &&
        target &&
        transferMenuTriggerRef.current.contains(target)
      )
        return;
      setIsTransferMenuOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsTransferMenuOpen(false);
    };
    window.addEventListener("click", handleWindowClick);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("click", handleWindowClick);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [
    isTransferMenuOpen,
    setIsTransferMenuOpen,
    transferMenuRef,
    transferMenuTriggerRef,
  ]);

  useEffect(() => {
    if (activeDownload || uploadQueueItemsLength > 0) return;
    setIsTransferMenuOpen(false);
  }, [activeDownload, setIsTransferMenuOpen, uploadQueueItemsLength]);

  useEffect(() => {
    if (!isNotesVirtualPath(currentPath)) {
      setNoteComposerValue("");
      setIsSendingNoteMessage(false);
    }
  }, [currentPath, setIsSendingNoteMessage, setNoteComposerValue]);

  useEffect(() => {
    if (!showDetails) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (
        detailsPanelRef.current &&
        target &&
        detailsPanelRef.current.contains(target)
      )
        return;
      closeDetailsPanel();
    };
    window.addEventListener("mousedown", handlePointerDown, true);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown, true);
    };
  }, [closeDetailsPanel, detailsPanelRef, showDetails]);

  useEffect(() => {
    if (isRecycleBinPath(currentPath) && showDetails) {
      closeDetailsPanel();
    }
  }, [closeDetailsPanel, currentPath, showDetails]);

  useEffect(() => {
    setContextMenuState(null);
  }, [currentPath, setContextMenuState]);

  const handleViewModeChange = useCallback(
    (mode: ExplorerViewMode) => {
      (setViewMode as any)((prev: ExplorerViewMode) =>
        prev === mode ? prev : mode,
      );
    },
    [setViewMode],
  );

  const handleToggleNameSort = useCallback(() => {
    setSortField("name");
    setSortDirection((prev) =>
      sortField === "name" && prev === "asc" ? "desc" : "asc",
    );
  }, [setSortDirection, setSortField, sortField]);

  const isLoadingSavedFiles =
    currentPath.startsWith("tg://saved") &&
    isSavedBackfillSyncing &&
    !search.trim() &&
    sortedFiles.length === 0;
  const isDirectoryLoading = isLoading || isLoadingSavedFiles;
  const breadcrumbsHomePath = currentPath.startsWith("tg://")
    ? explorerHomePathRef.current.startsWith("tg://")
      ? explorerHomePathRef.current
      : DEFAULT_EXPLORER_HOME_PATH
    : "/";
  const transferDownloadItem = activeDownload
    ? {
        fileName: activeDownload.fileName,
        statusLabel: downloadToolbarLabel,
        detailMessage: downloadDetailMessage,
        progressPercent: downloadProgressPercent,
      }
    : null;

  return {
    breadcrumbsHomePath,
    clearDetailsPanelCloseTimer,
    closeDetailsPanel,
    filteredFiles,
    handleToggleNameSort,
    handleViewModeChange,
    isDirectoryLoading,
    isLoadingSavedFiles,
    openDetailsPanel,
    sortDirection,
    sortField,
    sortedFiles,
    transferDownloadItem,
  };
}
