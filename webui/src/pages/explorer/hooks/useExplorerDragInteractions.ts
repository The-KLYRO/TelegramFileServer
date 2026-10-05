import { useCallback, useEffect, useRef, useState } from "react";
import { type FileItem } from "@/components/skybox/FileRow";
import { removePathsFromExplorerState } from "@/pages/explorer/explorerSessionStore";
import {
  type UploadConfirmDraft,
  type UploadDraftEntry,
} from "@/components/skybox/UploadConfirmWidget";
import { toast } from "@/hooks/use-toast";
import {
  INTERNAL_DRAG_MIME,
  INTERNAL_DRAG_MIME_LIST,
  isGalleryPath,
  getParentPath,
  getPathName,
  isNotesVirtualPath,
  isRecycleBinPath,
  isSavedVirtualFilePath,
  isSavedVirtualFolderPath,
  isVirtualPath,
  joinPath,
  normalizePath,
} from "@/pages/explorer/shared";

type Args = {
  closeContextMenu: () => void;
  closeDetailsPanel: () => void;
  confirmMoveRef: React.MutableRefObject<boolean>;
  currentPath: string;
  currentPathRef: React.MutableRefObject<string>;
  files: FileItem[];
  filesRef: React.MutableRefObject<FileItem[]>;
  handleUploadFiles: (
    droppedEntries: UploadDraftEntry[],
    caption?: string,
    options?: UploadConfirmDraft["options"],
  ) => Promise<void>;
  isDirectoryLoading: boolean;
  loadDirectoryRef: React.MutableRefObject<
    (path: string, options?: { force?: boolean }) => Promise<void>
  >;
  queueCloudSync: () => void;
  requestStructureBackup: () => void;
  savedPathCacheRef: React.MutableRefObject<Record<string, any>>;
  selectedFile: FileItem | null;
  selectedPaths: string[];
  setDropTargetPath: React.Dispatch<React.SetStateAction<string | null>>;
  dropTargetPath: string | null;
  setDraggedPaths: React.Dispatch<React.SetStateAction<string[]>>;
  draggedPaths: string[];
  setIsExternalDragging: React.Dispatch<React.SetStateAction<boolean>>;
  setPendingMoveConfirm: React.Dispatch<React.SetStateAction<any>>;
  setSelectedFile: React.Dispatch<React.SetStateAction<FileItem | null>>;
  setSelectedPaths: React.Dispatch<React.SetStateAction<string[]>>;
  setSelectionBox: React.Dispatch<React.SetStateAction<any>>;
  selectionBox: any;
  setUploadConfirmDraft: React.Dispatch<
    React.SetStateAction<UploadConfirmDraft | null>
  >;
  sortedFiles: FileItem[];
  explorerAreaRef: React.MutableRefObject<HTMLDivElement | null>;
};

export function useExplorerDragInteractions({
  closeContextMenu,
  closeDetailsPanel,
  confirmMoveRef,
  currentPath,
  currentPathRef,
  files,
  filesRef,
  handleUploadFiles,
  isDirectoryLoading,
  loadDirectoryRef,
  queueCloudSync,
  requestStructureBackup,
  savedPathCacheRef,
  selectedFile,
  selectedPaths,
  setDropTargetPath,
  dropTargetPath,
  setDraggedPaths,
  draggedPaths,
  setIsExternalDragging,
  setPendingMoveConfirm,
  setSelectedFile,
  setSelectedPaths,
  setSelectionBox,
  selectionBox,
  setUploadConfirmDraft,
  sortedFiles,
  explorerAreaRef,
}: Args) {
  const marqueeLastClientPointRef = useRef<{ x: number; y: number } | null>(
    null,
  );
  const dragPreviewElementRef = useRef<HTMLDivElement | null>(null);
  const dropSuccessTimerRef = useRef<number | null>(null);
  const draggedItemsRef = useRef<Record<string, FileItem>>({});
  const draggedOriginPathsRef = useRef<Record<string, string>>({});
  const [recentDropTargetPath, setRecentDropTargetPath] = useState<
    string | null
  >(null);

  useEffect(() => {
    return () => {
      window.dispatchEvent(
        new CustomEvent("skybox-explorer-drag-state", { detail: null }),
      );
      if (dragPreviewElementRef.current) {
        dragPreviewElementRef.current.remove();
        dragPreviewElementRef.current = null;
      }
      if (dropSuccessTimerRef.current !== null) {
        window.clearTimeout(dropSuccessTimerRef.current);
      }
    };
  }, []);

  const removeDragPreview = useCallback(() => {
    if (dragPreviewElementRef.current) {
      dragPreviewElementRef.current.remove();
      dragPreviewElementRef.current = null;
    }
  }, []);

  const broadcastDragState = useCallback((sourcePaths: string[]) => {
    window.dispatchEvent(
      new CustomEvent("skybox-explorer-drag-state", {
        detail: sourcePaths.length ? { sourcePaths } : null,
      }),
    );
  }, []);

  const clearDragUiState = useCallback(() => {
    setDraggedPaths([]);
    setDropTargetPath(null);
    removeDragPreview();
  }, [removeDragPreview, setDraggedPaths, setDropTargetPath]);

  const clearDraggedState = useCallback(() => {
    draggedItemsRef.current = {};
    draggedOriginPathsRef.current = {};
    broadcastDragState([]);
    clearDragUiState();
  }, [broadcastDragState, clearDragUiState]);

  const showDropSuccess = useCallback((targetPath: string) => {
    if (dropSuccessTimerRef.current !== null) {
      window.clearTimeout(dropSuccessTimerRef.current);
    }
    setRecentDropTargetPath(targetPath);
    dropSuccessTimerRef.current = window.setTimeout(() => {
      setRecentDropTargetPath(null);
      dropSuccessTimerRef.current = null;
    }, 320);
  }, []);

  const applySelectionFromPaths = useCallback(
    (paths: string[]) => {
      if (!paths.length) {
        setSelectedPaths([]);
        setSelectedFile(null);
        closeDetailsPanel();
        return;
      }
      setSelectedPaths(paths);
      const firstSelected =
        filesRef.current.find((item) => item.path === paths[0]) || null;
      setSelectedFile(firstSelected);
      if (paths.length > 1) closeDetailsPanel();
    },
    [closeDetailsPanel, filesRef, setSelectedFile, setSelectedPaths],
  );

  const updateSelectionFromMarquee = useCallback(
    (
      startX: number,
      startY: number,
      currentX: number,
      currentY: number,
      baseSelection: string[],
    ) => {
      const explorerArea = explorerAreaRef.current;
      if (!explorerArea) return;
      const areaRect = explorerArea.getBoundingClientRect();
      const scrollLeft = explorerArea.scrollLeft;
      const scrollTop = explorerArea.scrollTop;
      const left = Math.min(startX, currentX);
      const right = Math.max(startX, currentX);
      const top = Math.min(startY, currentY);
      const bottom = Math.max(startY, currentY);
      const intersectedPaths = new Set<string>();
      const itemNodes = explorerArea.querySelectorAll<HTMLElement>(
        "[data-file-item='true']",
      );
      itemNodes.forEach((node) => {
        const path = node.dataset.filePath;
        if (!path) return;
        const rect = node.getBoundingClientRect();
        const nodeLeft = rect.left - areaRect.left + scrollLeft;
        const nodeRight = rect.right - areaRect.left + scrollLeft;
        const nodeTop = rect.top - areaRect.top + scrollTop;
        const nodeBottom = rect.bottom - areaRect.top + scrollTop;
        const intersects = !(
          nodeRight < left ||
          nodeLeft > right ||
          nodeBottom < top ||
          nodeTop > bottom
        );
        if (intersects) intersectedPaths.add(path);
      });
      const orderedIntersectedPaths = sortedFiles
        .map((item) => item.path)
        .filter((path) => intersectedPaths.has(path));
      const mergedSelection =
        baseSelection.length > 0
          ? Array.from(new Set([...baseSelection, ...orderedIntersectedPaths]))
          : orderedIntersectedPaths;
      applySelectionFromPaths(mergedSelection);
    },
    [applySelectionFromPaths, explorerAreaRef, sortedFiles],
  );

  const handleExplorerMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.button !== 0 || isDirectoryLoading) return;
      const targetElement = event.target as HTMLElement | null;
      if ((targetElement as any)?.closest?.("[data-file-item='true']")) return;
      closeContextMenu();
      const explorerArea = explorerAreaRef.current;
      if (!explorerArea) return;
      const areaRect = explorerArea.getBoundingClientRect();
      const pointFromClient = (clientX: number, clientY: number) => ({
        x: clientX - areaRect.left + explorerArea.scrollLeft,
        y: clientY - areaRect.top + explorerArea.scrollTop,
      });
      const startPoint = pointFromClient(event.clientX, event.clientY);
      const startX = startPoint.x;
      const startY = startPoint.y;
      marqueeLastClientPointRef.current = {
        x: event.clientX,
        y: event.clientY,
      };
      const additiveSelection = event.ctrlKey || event.metaKey;
      const baseSelection = additiveSelection ? selectedPaths : [];
      setSelectionBox({ startX, startY, currentX: startX, currentY: startY });
      if (!additiveSelection) applySelectionFromPaths([]);
      const handleMouseMove = (moveEvent: MouseEvent) => {
        marqueeLastClientPointRef.current = {
          x: moveEvent.clientX,
          y: moveEvent.clientY,
        };
        const currentPoint = pointFromClient(
          moveEvent.clientX,
          moveEvent.clientY,
        );
        setSelectionBox({
          startX,
          startY,
          currentX: currentPoint.x,
          currentY: currentPoint.y,
        });
        updateSelectionFromMarquee(
          startX,
          startY,
          currentPoint.x,
          currentPoint.y,
          baseSelection,
        );
      };
      const handleAreaScroll = () => {
        const lastPoint = marqueeLastClientPointRef.current;
        if (!lastPoint) return;
        const currentPoint = pointFromClient(lastPoint.x, lastPoint.y);
        setSelectionBox({
          startX,
          startY,
          currentX: currentPoint.x,
          currentY: currentPoint.y,
        });
        updateSelectionFromMarquee(
          startX,
          startY,
          currentPoint.x,
          currentPoint.y,
          baseSelection,
        );
      };
      const handleMouseUp = (upEvent: MouseEvent) => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        explorerArea.removeEventListener("scroll", handleAreaScroll);
        marqueeLastClientPointRef.current = null;
        setSelectionBox(null);
        const currentPoint = pointFromClient(upEvent.clientX, upEvent.clientY);
        updateSelectionFromMarquee(
          startX,
          startY,
          currentPoint.x,
          currentPoint.y,
          baseSelection,
        );
      };
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      explorerArea.addEventListener("scroll", handleAreaScroll, {
        passive: true,
      });
      event.preventDefault();
    },
    [
      applySelectionFromPaths,
      closeContextMenu,
      explorerAreaRef,
      isDirectoryLoading,
      selectedPaths,
      setSelectionBox,
      updateSelectionFromMarquee,
    ],
  );

  const isDraggableItem = useCallback(
    (file: FileItem) => {
      if (isRecycleBinPath(currentPath)) return false;
      if (isSavedVirtualFolderPath(file.path))
        return file.path !== "tg://saved";
      if (isSavedVirtualFilePath(file.path)) return true;
      return !isVirtualPath(file.path);
    },
    [currentPath],
  );

  const getDraggedSourcePaths = useCallback(
    (event: React.DragEvent): string[] => {
      const listPayload = event.dataTransfer.getData(INTERNAL_DRAG_MIME_LIST);
      if (listPayload) {
        try {
          const parsed = JSON.parse(listPayload) as unknown;
          if (Array.isArray(parsed))
            return parsed.filter(
              (value): value is string => typeof value === "string",
            );
        } catch {
          // ignore
        }
      }
      const fromTransfer = event.dataTransfer.getData(INTERNAL_DRAG_MIME);
      if (fromTransfer) return [fromTransfer];
      return draggedPaths;
    },
    [draggedPaths],
  );

  const canDropToTarget = useCallback(
    (sourcePath: string, target: FileItem): boolean => {
      if (isRecycleBinPath(currentPath) || !target.isDirectory) return false;
      const sourceItem =
        files.find((file) => file.path === sourcePath) ||
        draggedItemsRef.current[sourcePath];
      const sourceOriginPath =
        draggedOriginPathsRef.current[sourcePath] || currentPathRef.current;
      const sourceIsSavedVirtual =
        isSavedVirtualFolderPath(sourcePath) ||
        isSavedVirtualFilePath(sourcePath);
      const targetIsSavedVirtualFolder = isSavedVirtualFolderPath(target.path);
      if (sourceIsSavedVirtual || targetIsSavedVirtualFolder) {
        if (!sourceIsSavedVirtual || !targetIsSavedVirtualFolder) return false;
        if (sourcePath === target.path) return false;
        if (isSavedVirtualFolderPath(sourcePath)) {
          const sourceParentPath = getParentPath(sourcePath);
          if (sourceParentPath === target.path) return false;
          if (target.path.startsWith(`${sourcePath}/`)) return false;
        }
        if (
          isSavedVirtualFilePath(sourcePath) &&
          sourceOriginPath === target.path
        )
          return false;
        if (!sourceItem && !isSavedVirtualFilePath(sourcePath)) return false;
        return true;
      }
      if (isVirtualPath(sourcePath) || isVirtualPath(target.path)) return false;
      const normalizedSourcePath = normalizePath(sourcePath);
      const normalizedTargetPath = normalizePath(target.path);
      if (normalizedSourcePath === normalizedTargetPath) return false;
      const sourceParentPath = getParentPath(normalizedSourcePath);
      if (sourceParentPath === normalizedTargetPath) return false;
      if (
        sourceItem?.isDirectory &&
        normalizedTargetPath.startsWith(`${normalizedSourcePath}/`)
      )
        return false;
      return true;
    },
    [currentPath, files],
  );

  const canDropPathsToTarget = useCallback(
    (sourcePaths: string[], target: FileItem) => {
      return (
        sourcePaths.length > 0 &&
        sourcePaths.every((sourcePath) => canDropToTarget(sourcePath, target))
      );
    },
    [canDropToTarget],
  );

  const canDropPathsToDestination = useCallback(
    (sourcePaths: string[], destinationPath: string) => {
      if (
        !sourcePaths.length ||
        !destinationPath ||
        isRecycleBinPath(destinationPath) ||
        isGalleryPath(destinationPath) ||
        isNotesVirtualPath(destinationPath) ||
        (isVirtualPath(destinationPath) &&
          !isSavedVirtualFolderPath(destinationPath))
      ) {
        return false;
      }

      return canDropPathsToTarget(sourcePaths, {
        name: getPathName(destinationPath),
        path: destinationPath,
        isDirectory: true,
      });
    },
    [canDropPathsToTarget],
  );

  const canDropPathsToCurrentPath = useCallback(
    (sourcePaths: string[]) => {
      return canDropPathsToDestination(sourcePaths, currentPath);
    },
    [canDropPathsToDestination, currentPath],
  );

  const handleItemDragStart = useCallback(
    (event: React.DragEvent, file: FileItem) => {
      if (!isDraggableItem(file)) return;
      const pathsToDrag =
        selectedPaths.length > 1 && selectedPaths.includes(file.path)
          ? selectedPaths
          : [file.path];
      draggedItemsRef.current = pathsToDrag.reduce<Record<string, FileItem>>(
        (acc, path) => {
          const item = filesRef.current.find(
            (candidate) => candidate.path === path,
          );
          if (item) acc[path] = item;
          return acc;
        },
        {},
      );
      draggedOriginPathsRef.current = pathsToDrag.reduce<
        Record<string, string>
      >((acc, path) => {
        acc[path] = currentPathRef.current;
        return acc;
      }, {});
      broadcastDragState(pathsToDrag);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.dropEffect = "move";
      event.dataTransfer.setData(INTERNAL_DRAG_MIME, pathsToDrag[0]);
      event.dataTransfer.setData(
        INTERNAL_DRAG_MIME_LIST,
        JSON.stringify(pathsToDrag),
      );
      setDraggedPaths(pathsToDrag);

      removeDragPreview();

      const sourceElement = event.currentTarget as HTMLElement;
      const sourceRect = sourceElement.getBoundingClientRect();
      const preview = sourceElement.cloneNode(true) as HTMLDivElement;
      preview.style.position = "fixed";
      preview.style.left = "-10000px";
      preview.style.top = "-10000px";
      preview.style.pointerEvents = "none";
      preview.style.margin = "0";
      preview.style.width = `${Math.max(92, Math.round(sourceRect.width * 0.9))}px`;
      preview.style.height = `${Math.max(36, Math.round(sourceRect.height * 0.9))}px`;
      preview.style.opacity = "0.84";
      preview.style.transform = "scale(0.92)";
      preview.style.transformOrigin = "top left";
      preview.style.boxShadow = "0 14px 34px rgba(0,0,0,0.24)";
      preview.style.overflow = "hidden";
      preview.style.zIndex = "9999";

      if (pathsToDrag.length > 1) {
        const badge = document.createElement("div");
        badge.textContent = String(pathsToDrag.length);
        badge.style.position = "absolute";
        badge.style.right = "8px";
        badge.style.top = "8px";
        badge.style.minWidth = "22px";
        badge.style.height = "22px";
        badge.style.padding = "0 6px";
        badge.style.borderRadius = "999px";
        badge.style.display = "flex";
        badge.style.alignItems = "center";
        badge.style.justifyContent = "center";
        badge.style.background = "rgba(34, 197, 94, 0.92)";
        badge.style.color = "white";
        badge.style.fontSize = "11px";
        badge.style.fontWeight = "700";
        badge.style.boxShadow = "0 4px 16px rgba(0,0,0,0.22)";
        preview.appendChild(badge);
      }

      document.body.appendChild(preview);
      dragPreviewElementRef.current = preview;
      event.dataTransfer.setDragImage(
        preview,
        preview.offsetWidth / 2,
        preview.offsetHeight / 2,
      );
    },
    [
      broadcastDragState,
      currentPathRef,
      filesRef,
      isDraggableItem,
      removeDragPreview,
      selectedPaths,
      setDraggedPaths,
    ],
  );

  const handleItemDragEnd = useCallback(() => {
    broadcastDragState([]);
    clearDragUiState();
  }, [broadcastDragState, clearDragUiState]);

  const handleItemDragOver = useCallback(
    (event: React.DragEvent, target: FileItem) => {
      const sourcePaths = getDraggedSourcePaths(event);
      if (!canDropPathsToTarget(sourcePaths, target)) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setDropTargetPath(target.path);
    },
    [canDropPathsToTarget, getDraggedSourcePaths, setDropTargetPath],
  );

  const handleItemDragLeave = useCallback(
    (target: FileItem) => {
      if (dropTargetPath === target.path) setDropTargetPath(null);
    },
    [dropTargetPath, setDropTargetPath],
  );

  const movePathsToDestination = useCallback(
    async (
      uniquePaths: string[],
      destinationPath: string,
      destinationLabel: string,
      sourceDisplayName: string,
    ) => {
      const activePath = currentPathRef.current;
      if (
        uniquePaths.every(
          (path) =>
            isSavedVirtualFolderPath(path) || isSavedVirtualFilePath(path),
        ) &&
        isSavedVirtualFolderPath(destinationPath)
      ) {
        try {
          let movedCount = 0,
            failedCount = 0;
          const movedSourcePaths: string[] = [];
          for (const sourcePath of uniquePaths) {
            try {
              await (window as any).__TAURI_INTERNALS__;
              // noop
              await import("@tauri-apps/api/core").then(({ invoke }) =>
                invoke("tg_move_saved_item", { sourcePath, destinationPath }),
              );
              movedCount += 1;
              movedSourcePaths.push(sourcePath);
            } catch {
              failedCount += 1;
            }
          }
          if (movedCount > 0) {
            requestStructureBackup();
            savedPathCacheRef.current = {};
            removePathsFromExplorerState(movedSourcePaths);
            queueCloudSync();
            showDropSuccess(destinationPath);
          }
          toast({
            title: failedCount ? "Move completed" : "Moved",
            description: failedCount
              ? `${movedCount} moved, ${failedCount} failed`
              : `${sourceDisplayName} moved to ${destinationLabel}`,
            variant: failedCount ? "destructive" : undefined,
          });
          if (selectedFile?.path && uniquePaths.includes(selectedFile.path)) {
            setSelectedFile(null);
            closeDetailsPanel();
          }
          await loadDirectoryRef.current(activePath, { force: true });
        } catch (error) {
          toast({
            title: "Move failed",
            description: (error as any)?.message || "Unable to move item",
            variant: "destructive",
          });
        } finally {
          clearDraggedState();
        }
        return;
      }
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        let movedCount = 0,
          failedCount = 0;
        const movedSourcePaths: string[] = [];
        for (const sourcePath of uniquePaths) {
          const nextDestinationPath = joinPath(
            destinationPath,
            getPathName(sourcePath),
          );
          try {
            await invoke("move_file", {
              source: sourcePath,
              destination: nextDestinationPath,
            });
            movedCount += 1;
            movedSourcePaths.push(sourcePath);
          } catch {
            failedCount += 1;
          }
        }
        if (movedSourcePaths.length > 0) {
          savedPathCacheRef.current = {};
          removePathsFromExplorerState(movedSourcePaths);
        }
        toast({
          title: failedCount ? "Move completed" : "Moved",
          description: failedCount
            ? `${movedCount} moved, ${failedCount} failed`
            : `${sourceDisplayName} moved to ${destinationLabel}`,
          variant: failedCount ? "destructive" : undefined,
        });
        if (movedCount > 0) {
          showDropSuccess(destinationPath);
        }
        if (selectedFile?.path && uniquePaths.includes(selectedFile.path)) {
          setSelectedFile(null);
          closeDetailsPanel();
        }
        await loadDirectoryRef.current(activePath, { force: true });
      } catch (error) {
        toast({
          title: "Move failed",
          description: (error as any)?.message || "Unable to move item",
          variant: "destructive",
        });
      } finally {
        clearDraggedState();
      }
    },
    [
      clearDraggedState,
      closeDetailsPanel,
      currentPathRef,
      loadDirectoryRef,
      queueCloudSync,
      requestStructureBackup,
      savedPathCacheRef,
      selectedFile,
      setSelectedFile,
      showDropSuccess,
    ],
  );

  useEffect(() => {
    const handleDropToTab = (event: Event) => {
      const typed = event as CustomEvent<{
        destinationPath: string;
        sourcePaths: string[];
      }>;
      const destinationPath = typed.detail?.destinationPath || "";
      const sourcePaths = typed.detail?.sourcePaths || [];
      if (!canDropPathsToDestination(sourcePaths, destinationPath)) {
        return;
      }
      const uniquePaths = Array.from(new Set(sourcePaths)).filter(
        (path) => typeof path === "string" && path.trim() !== "",
      );
      if (!uniquePaths.length) {
        return;
      }
      const destinationLabel = getPathName(destinationPath) || "folder";
      const sourceDisplayName =
        uniquePaths.length === 1
          ? draggedItemsRef.current[uniquePaths[0]]?.name ||
            filesRef.current.find((file) => file.path === uniquePaths[0])
              ?.name ||
            getPathName(uniquePaths[0])
          : `${uniquePaths.length} items`;

      if (confirmMoveRef.current) {
        setPendingMoveConfirm({
          title: "Move items",
          message: `Move ${sourceDisplayName} to ${destinationLabel}?`,
          run: async () =>
            movePathsToDestination(
              uniquePaths,
              destinationPath,
              destinationLabel,
              sourceDisplayName,
            ),
          onCancel: () => {
            clearDraggedState();
          },
        });
        return;
      }

      void movePathsToDestination(
        uniquePaths,
        destinationPath,
        destinationLabel,
        sourceDisplayName,
      );
    };

    window.addEventListener(
      "skybox-explorer-drop-to-tab",
      handleDropToTab as EventListener,
    );
    return () => {
      window.removeEventListener(
        "skybox-explorer-drop-to-tab",
        handleDropToTab as EventListener,
      );
    };
  }, [
    canDropPathsToDestination,
    clearDraggedState,
    confirmMoveRef,
    filesRef,
    movePathsToDestination,
    setPendingMoveConfirm,
  ]);

  const handleItemDrop = useCallback(
    async (event: React.DragEvent, target: FileItem) => {
      const sourcePaths = getDraggedSourcePaths(event);
      if (
        !canDropPathsToTarget(sourcePaths, target) ||
        isRecycleBinPath(currentPath)
      )
        return;
      const uniquePaths = Array.from(new Set(sourcePaths)).filter(
        (path) => typeof path === "string" && path.trim() !== "",
      );
      const sourceDisplayName =
        uniquePaths.length === 1
          ? draggedItemsRef.current[uniquePaths[0]]?.name ||
            files.find((file) => file.path === uniquePaths[0])?.name ||
            getPathName(uniquePaths[0])
          : `${uniquePaths.length} items`;
      const targetLabel = target.name || getPathName(target.path);
      event.preventDefault();
      event.stopPropagation();
      if (confirmMoveRef.current) {
        setPendingMoveConfirm({
          title: "Move items",
          message: `Move ${sourceDisplayName} to ${targetLabel}?`,
          run: async () =>
            movePathsToDestination(
              uniquePaths,
              target.path,
              targetLabel,
              sourceDisplayName,
            ),
          onCancel: () => {
            clearDraggedState();
          },
        });
        return;
      }
      await movePathsToDestination(
        uniquePaths,
        target.path,
        targetLabel,
        sourceDisplayName,
      );
    },
    [
      canDropPathsToTarget,
      clearDraggedState,
      confirmMoveRef,
      currentPath,
      files,
      getDraggedSourcePaths,
      movePathsToDestination,
      setPendingMoveConfirm,
    ],
  );

  const isExternalFileDrag = useCallback((event: React.DragEvent): boolean => {
    const dragTypes = Array.from(event.dataTransfer.types || []);
    const hasFiles = dragTypes.includes("Files");
    const hasInternalFile =
      dragTypes.includes(INTERNAL_DRAG_MIME) ||
      dragTypes.includes(INTERNAL_DRAG_MIME_LIST);
    return hasFiles && !hasInternalFile;
  }, []);

  const makeUploadEntryId = useCallback((relativePath: string, file: File) => {
    const normalized = relativePath.replace(/\\/g, "/");
    return `${normalized}:${file.size}:${file.lastModified}`;
  }, []);

  const stageUploadEntries = useCallback(
    (incomingEntries: UploadDraftEntry[]) => {
      if (!incomingEntries.length) return;
      if (!currentPath.startsWith("tg://saved")) {
        toast({
          title: "Upload unavailable",
          description: "Upload is available in Saved Messages only.",
          variant: "destructive",
        });
        return;
      }
      if (isRecycleBinPath(currentPath)) {
        toast({
          title: "Upload unavailable",
          description: "Cannot upload files inside Recycle Bin.",
          variant: "destructive",
        });
        return;
      }
      setUploadConfirmDraft((prev) => {
        const prevEntries = prev?.entries ?? [];
        const mergedEntries = [...prevEntries];
        const seen = new Set(prevEntries.map((entry) => entry.id));
        for (const entry of incomingEntries) {
          if (!seen.has(entry.id)) {
            mergedEntries.push(entry);
            seen.add(entry.id);
          }
        }
        const mergedFiles = mergedEntries.map((entry) => entry.file);
        const allImages = mergedFiles.every((file) =>
          file.type.startsWith("image/"),
        );
        const allVideos = mergedFiles.every((file) =>
          file.type.startsWith("video/"),
        );
        const allMedia = mergedFiles.every(
          (file) =>
            file.type.startsWith("image/") || file.type.startsWith("video/"),
        );
        const defaultSendAs =
          allImages || allVideos || allMedia ? "photo" : "file";
        const prevSendAs = prev?.options.sendAs;
        const nextSendAs =
          prevSendAs === "photo" && defaultSendAs !== "photo"
            ? "file"
            : (prevSendAs ?? defaultSendAs);
        const nextSelection: Record<string, boolean> = {
          ...(prev?.selection ?? {}),
        };
        for (const entry of incomingEntries) nextSelection[entry.id] = true;
        return {
          entries: mergedEntries,
          selection: nextSelection,
          caption: prev?.caption ?? "",
          options: prev
            ? { ...prev.options, sendAs: nextSendAs }
            : {
                sendAs: nextSendAs,
                highQuality: true,
                hideWithSpoiler: false,
                moveCaptionUp: false,
              },
        };
      });
    },
    [currentPath, setUploadConfirmDraft],
  );

  const handleExplorerDragOver = useCallback(
    (event: React.DragEvent) => {
      if (isExternalFileDrag(event)) {
        if (isRecycleBinPath(currentPath)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        setIsExternalDragging(true);
        return;
      }

      const hasInternalDrag = getDraggedSourcePaths(event).length > 0;
      if (!hasInternalDrag) {
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setDropTargetPath(null);
    },
    [
      currentPath,
      getDraggedSourcePaths,
      isExternalFileDrag,
      setDropTargetPath,
      setIsExternalDragging,
    ],
  );

  const handleExplorerDragLeave = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      const nextTarget = event.relatedTarget as Node | null;
      if (nextTarget && event.currentTarget.contains(nextTarget)) return;
      setIsExternalDragging(false);
    },
    [setIsExternalDragging],
  );

  const handleExplorerDrop = useCallback(
    async (event: React.DragEvent) => {
      if (!isExternalFileDrag(event)) {
        const sourcePaths = getDraggedSourcePaths(event);
        if (sourcePaths.length === 0) return;
        event.preventDefault();
        setDropTargetPath(null);
        if (!canDropPathsToCurrentPath(sourcePaths)) return;
        const uniquePaths = Array.from(new Set(sourcePaths)).filter(
          (path) => typeof path === "string" && path.trim() !== "",
        );
        if (!uniquePaths.length) return;
        const destinationPath = currentPathRef.current;
        const sourceDisplayName =
          uniquePaths.length === 1
            ? draggedItemsRef.current[uniquePaths[0]]?.name ||
              getPathName(uniquePaths[0])
            : `${uniquePaths.length} items`;
        const destinationLabel =
          getPathName(destinationPath) || "current folder";
        if (confirmMoveRef.current) {
          setPendingMoveConfirm({
            title: "Move items",
            message: `Move ${sourceDisplayName} to ${destinationLabel}?`,
            run: async () =>
              movePathsToDestination(
                uniquePaths,
                destinationPath,
                destinationLabel,
                sourceDisplayName,
              ),
            onCancel: () => {
              clearDraggedState();
            },
          });
          return;
        }
        await movePathsToDestination(
          uniquePaths,
          destinationPath,
          destinationLabel,
          sourceDisplayName,
        );
        return;
      }
      event.preventDefault();
      setIsExternalDragging(false);
      const items = Array.from(event.dataTransfer.items || []);
      const buildFallbackEntries = (): UploadDraftEntry[] => {
        const files = Array.from(event.dataTransfer.files || []);
        const looksLikeFolderDrop = items.length === 1 && files.length > 0;
        const paths = files
          .map((file) => (file as unknown as { path?: string }).path)
          .filter(
            (value): value is string =>
              typeof value === "string" && value.trim() !== "",
          );
        const canInferTree =
          looksLikeFolderDrop && paths.length === files.length;
        if (!canInferTree) {
          return files.map((file) => {
            const rel =
              (file as unknown as { webkitRelativePath?: string })
                .webkitRelativePath || file.name;
            return {
              id: makeUploadEntryId(rel, file),
              file,
              relativePath: rel,
              sourcePath: (file as unknown as { path?: string }).path,
            };
          });
        }
        const normalized = paths.map((value) => value.replace(/\\/g, "/"));
        const dirs = normalized.map((value) => {
          const idx = value.lastIndexOf("/");
          return idx >= 0 ? value.slice(0, idx) : value;
        });
        const parts = dirs.map((value) => value.split("/").filter(Boolean));
        const minLen = Math.min(...parts.map((p) => p.length));
        const common: string[] = [];
        for (let i = 0; i < minLen; i += 1) {
          const seg = parts[0]?.[i];
          if (!seg) break;
          if (parts.every((p) => p[i] === seg)) common.push(seg);
          else break;
        }
        const commonDir = `/${common.join("/")}`.replace(/\/+/g, "/");
        const baseName = common.length ? common[common.length - 1] : "";
        return files.map((file, index) => {
          const full = normalized[index] || "";
          let rel = full.startsWith(commonDir)
            ? full.slice(commonDir.length)
            : file.name;
          rel = rel.replace(/^\/+/, "");
          rel = baseName ? `${baseName}/${rel}` : rel;
          return {
            id: makeUploadEntryId(rel, file),
            file,
            relativePath: rel,
            sourcePath: (file as unknown as { path?: string }).path,
          };
        });
      };
      const fallbackEntries = buildFallbackEntries();
      const fallbackHasTree = fallbackEntries.some((entry) =>
        entry.relativePath.replace(/\\/g, "/").includes("/"),
      );
      const fallbackHasSourcePaths = fallbackEntries.every(
        (entry) =>
          typeof entry.sourcePath === "string" && entry.sourcePath.trim(),
      );
      if (fallbackHasTree && fallbackHasSourcePaths) {
        stageUploadEntries(fallbackEntries);
        return;
      }
      if (
        items.length &&
        items.some(
          (item) => typeof (item as any).webkitGetAsEntry === "function",
        )
      ) {
        const extract = async (): Promise<UploadDraftEntry[]> => {
          const entries: UploadDraftEntry[] = [];
          const walk = async (entry: any, parentPath: string) => {
            if (!entry) return;
            if (entry.isFile) {
              const file: File = await new Promise((resolve, reject) =>
                entry.file(resolve, reject),
              );
              const rel = `${parentPath}${file.name}`.replace(/^\/+/, "");
              entries.push({
                id: makeUploadEntryId(rel, file),
                file,
                relativePath: rel,
                sourcePath: (file as unknown as { path?: string }).path,
              });
              return;
            }
            if (entry.isDirectory) {
              const reader = entry.createReader();
              const readBatch = (): Promise<any[]> =>
                new Promise((resolve, reject) =>
                  reader.readEntries(resolve, reject),
                );
              while (true) {
                const batch = await readBatch();
                if (!batch.length) break;
                for (const child of batch)
                  await walk(child, `${parentPath}${entry.name}/`);
              }
            }
          };
          for (const item of items) {
            const entry = (item as any).webkitGetAsEntry?.();
            if (!entry) continue;
            await walk(entry, "");
          }
          return entries;
        };
        void extract().then((entries) =>
          stageUploadEntries(entries.length ? entries : fallbackEntries),
        );
        return;
      }
      stageUploadEntries(fallbackEntries);
    },
    [
      canDropPathsToCurrentPath,
      clearDraggedState,
      confirmMoveRef,
      currentPathRef,
      getDraggedSourcePaths,
      isExternalFileDrag,
      makeUploadEntryId,
      movePathsToDestination,
      setDropTargetPath,
      setIsExternalDragging,
      setPendingMoveConfirm,
      stageUploadEntries,
    ],
  );

  return {
    draggedPaths,
    dropTargetPath,
    recentDropTargetPath,
    handleExplorerDragLeave,
    handleExplorerDragOver,
    handleExplorerDrop,
    handleExplorerMouseDown,
    handleItemDragEnd,
    handleItemDragLeave,
    handleItemDragOver,
    handleItemDragStart,
    handleItemDrop,
    isDraggableItem,
    selectionBox,
    stageUploadEntries,
  };
}
