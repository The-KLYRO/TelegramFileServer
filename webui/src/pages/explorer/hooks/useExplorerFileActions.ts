import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { toast } from "@/hooks/use-toast";
import { type FileItem } from "@/components/skybox/FileRow";
import { removePathsFromExplorerState } from "@/pages/explorer/explorerSessionStore";
import {
  type UploadConfirmDraft,
  type UploadDraftEntry,
} from "@/components/skybox/UploadConfirmWidget";
import {
  type ChatDriveCandidate,
  type ClipboardMode,
  type DbError,
  type DownloadProgressPayload,
  type ExplorerClipboardItem,
  type Favorite,
  type FsError,
  type TelegramError,
  type TelegramMessage,
  getExplorerTabTitle,
  getParentPath,
  getPathName,
  getSavedMediaKind,
  isGalleryPath,
  isNotesVirtualPath,
  isProtectedSavedFolderPath,
  isRecycleBinPath,
  isSavedPreviewableFile,
  isSavedVirtualFilePath,
  isSavedVirtualItemPath,
  isSavedVirtualFolderPath,
  isVirtualPath,
  joinPath,
  mergeFileItemsByIdentity,
  normalizePath,
  telegramMessageToFileItem,
  virtualToSavedPath,
} from "@/pages/explorer/shared";

type UseExplorerFileActionsArgs = {
  activeDownload: DownloadProgressPayload | null;
  canCancelDownload: boolean;
  clipboardItem: ExplorerClipboardItem | null;
  closeDetailsPanel: () => void;
  confirmMoveRef: React.MutableRefObject<boolean>;
  confirmRenameRef: React.MutableRefObject<boolean>;
  contextMenuState: { targetFile: FileItem | null } | null;
  currentPath: string;
  currentPathRef: React.MutableRefObject<string>;
  deleteTargets: FileItem[];
  files: FileItem[];
  filesRef: React.MutableRefObject<FileItem[]>;
  favorites: string[];
  isNotesFolderView: boolean;
  isSendingNoteMessage: boolean;
  isLocalAudioFile: (file: FileItem) => boolean;
  isLocalImageFile: (file: FileItem) => boolean;
  isLocalVideoFile: (file: FileItem) => boolean;
  loadDirectory: (path: string, options?: { force?: boolean }) => Promise<void>;
  loadDirectoryRef: React.MutableRefObject<
    (path: string, options?: { force?: boolean }) => Promise<void>
  >;
  navigate: (path: string) => void;
  newFolderName: string;
  noteComposerValue: string;
  noteEditTarget: FileItem | null;
  noteEditValue: string;
  openLocalAudioPlayer: (file: FileItem) => void;
  openLocalImageViewer: (file: FileItem) => void;
  openLocalVideoViewer: (file: FileItem) => void;
  openSavedAudioPlayer: (file: FileItem) => void;
  openSavedMediaViewer: (file: FileItem) => void;
  queueCloudSync: () => void;
  refreshRecentPaths: () => Promise<void>;
  renameTarget: FileItem | null;
  renameValue: string;
  requestDeleteTargets: (targets: FileItem[]) => void;
  requestStructureBackup: () => void;
  resetDownloadSpeedTracking: () => void;
  resetUploadSpeedTracking: () => void;
  savedPathCacheRef: React.MutableRefObject<Record<string, any>>;
  selectedFile: FileItem | null;
  selectedPaths: string[];
  setActiveDownload: React.Dispatch<
    React.SetStateAction<DownloadProgressPayload | null>
  >;
  setActivePaste: React.Dispatch<React.SetStateAction<any>>;
  setChatDriveCandidatesQuery: React.Dispatch<React.SetStateAction<string>>;
  setClipboardItem: React.Dispatch<
    React.SetStateAction<ExplorerClipboardItem | null>
  >;
  setDeleteTargets: React.Dispatch<React.SetStateAction<FileItem[]>>;
  setFiles: React.Dispatch<React.SetStateAction<FileItem[]>>;
  setFavorites: React.Dispatch<React.SetStateAction<string[]>>;
  setIsNewFolderDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsSendingNoteMessage: React.Dispatch<React.SetStateAction<boolean>>;
  setNewFolderName: React.Dispatch<React.SetStateAction<string>>;
  setNoteComposerValue: React.Dispatch<React.SetStateAction<string>>;
  setNoteEditTarget: React.Dispatch<React.SetStateAction<FileItem | null>>;
  setNoteEditValue: React.Dispatch<React.SetStateAction<string>>;
  setPendingMoveConfirm: React.Dispatch<React.SetStateAction<any>>;
  setPendingRenameConfirm: React.Dispatch<React.SetStateAction<any>>;
  setRenameTarget: React.Dispatch<React.SetStateAction<FileItem | null>>;
  setRenameValue: React.Dispatch<React.SetStateAction<string>>;
  setSavedItemsOffset: React.Dispatch<React.SetStateAction<number>>;
  setSelectedFile: React.Dispatch<React.SetStateAction<FileItem | null>>;
  setSelectedPaths: React.Dispatch<React.SetStateAction<string[]>>;
  setShareTarget: React.Dispatch<React.SetStateAction<FileItem | null>>;
  setUploadConfirmDraft: React.Dispatch<
    React.SetStateAction<UploadConfirmDraft | null>
  >;
  setUploadPremiumUser: React.Dispatch<React.SetStateAction<boolean | null>>;
  shareTarget: FileItem | null;
  showFavoritesRef: React.MutableRefObject<boolean>;
  uploadManagerRef: React.MutableRefObject<any>;
  uploadPremiumUser: boolean | null;
  explorerAreaRef: React.MutableRefObject<HTMLDivElement | null>;
  trackDownloadSpeedSample?: (payload: DownloadProgressPayload) => void;
  savedItemsOffset: number;
  hasMoreSavedItems: boolean;
  isSavedSyncComplete: boolean;
};

export function useExplorerFileActions(args: UseExplorerFileActionsArgs) {
  const {
    activeDownload,
    canCancelDownload,
    clipboardItem,
    closeDetailsPanel,
    confirmMoveRef,
    confirmRenameRef,
    contextMenuState,
    currentPath,
    currentPathRef,
    deleteTargets,
    files,
    filesRef,
    favorites,
    isNotesFolderView,
    isSendingNoteMessage,
    isLocalAudioFile,
    isLocalImageFile,
    isLocalVideoFile,
    loadDirectory,
    loadDirectoryRef,
    newFolderName,
    noteComposerValue,
    noteEditTarget,
    noteEditValue,
    openLocalAudioPlayer,
    openLocalImageViewer,
    openLocalVideoViewer,
    openSavedAudioPlayer,
    openSavedMediaViewer,
    queueCloudSync,
    renameTarget,
    renameValue,
    requestDeleteTargets,
    requestStructureBackup,
    resetDownloadSpeedTracking,
    resetUploadSpeedTracking,
    savedPathCacheRef,
    selectedFile,
    selectedPaths,
    setActiveDownload,
    setActivePaste,
    setClipboardItem,
    setDeleteTargets,
    setFiles,
    setFavorites,
    setIsNewFolderDialogOpen,
    setIsSendingNoteMessage,
    setNewFolderName,
    setNoteComposerValue,
    setNoteEditTarget,
    setNoteEditValue,
    setPendingMoveConfirm,
    setPendingRenameConfirm,
    setRenameTarget,
    setRenameValue,
    setSelectedFile,
    setSelectedPaths,
    setShareTarget,
    setUploadConfirmDraft,
    setUploadPremiumUser,
    shareTarget,
    showFavoritesRef,
    uploadManagerRef,
    uploadPremiumUser,
    explorerAreaRef,
    savedItemsOffset,
    hasMoreSavedItems,
    isSavedSyncComplete,
  } = args;

  const removeItemFromCurrentView = useCallback(
    (path: string) => {
      const normalizedPath = normalizePath(path);
      const currentItems = filesRef.current;
      const nextItems = currentItems.filter(
        (item) => normalizePath(item.path) !== normalizedPath,
      );
      if (nextItems.length === currentItems.length) return;
      setFiles(nextItems);
      setSelectedPaths((prev) =>
        prev.filter(
          (selectedPath) => normalizePath(selectedPath) !== normalizedPath,
        ),
      );
      if (selectedFile && normalizePath(selectedFile.path) === normalizedPath) {
        setSelectedFile(null);
        closeDetailsPanel();
      }
      if (currentPathRef.current.startsWith("tg://saved")) {
        args.setSavedItemsOffset((prev: number) => Math.max(0, prev - 1));
        const cacheEntry = savedPathCacheRef.current[currentPathRef.current];
        if (cacheEntry) {
          savedPathCacheRef.current[currentPathRef.current] = {
            ...cacheEntry,
            items: nextItems,
            nextOffset: Math.max(0, cacheEntry.nextOffset - 1),
          };
        }
      }
    },
    [
      args,
      closeDetailsPanel,
      currentPathRef,
      filesRef,
      savedPathCacheRef,
      selectedFile,
      setFiles,
      setSelectedFile,
      setSelectedPaths,
    ],
  );

  const appendItemToCurrentView = useCallback(
    (destinationFolderPath: string, item: FileItem) => {
      if (
        normalizePath(currentPathRef.current) !==
        normalizePath(destinationFolderPath)
      ) {
        return;
      }
      const currentItems = filesRef.current;
      const nextItems = mergeFileItemsByIdentity(currentItems, [item]);
      if (nextItems.length === currentItems.length) return;
      setFiles(nextItems);
      if (currentPathRef.current.startsWith("tg://saved")) {
        args.setSavedItemsOffset((prev: number) => prev + 1);
        const cacheEntry = savedPathCacheRef.current[currentPathRef.current];
        if (cacheEntry) {
          savedPathCacheRef.current[currentPathRef.current] = {
            ...cacheEntry,
            items: nextItems,
            nextOffset: cacheEntry.nextOffset + 1,
          };
        }
      }
    },
    [args, currentPathRef, filesRef, savedPathCacheRef, setFiles],
  );

  const handleDownloadSavedFile = useCallback(
    async (targetFile?: FileItem | null) => {
      const file = targetFile ?? selectedFile;
      if (!file || file.isDirectory || !isSavedVirtualFilePath(file.path))
        return;
      if (
        activeDownload &&
        !["completed", "failed", "cancelled"].includes(activeDownload.stage)
      ) {
        toast({
          title: "Download in progress",
          description: `Please wait for ${activeDownload.fileName} to finish.`,
        });
        return;
      }
      resetDownloadSpeedTracking();
      setActiveDownload({
        sourcePath: file.path,
        fileName: file.name,
        stage: "selecting",
        progress: 0,
        downloadedBytes: 0,
      });
      const unlisten = await listen<DownloadProgressPayload>(
        "tg-download-progress",
        (event) => {
          const payload = event.payload;
          if (!payload || payload.sourcePath !== file.path) return;
          args.trackDownloadSpeedSample?.(payload);
          setActiveDownload(payload);
        },
      );
      try {
        const destinationPath: string | null = await invoke(
          "tg_download_saved_file",
          { sourcePath: file.path },
        );
        if (!destinationPath) {
          resetDownloadSpeedTracking();
          setActiveDownload(null);
        }
      } catch (error) {
        const typedError = error as TelegramError;
        setActiveDownload((prev) =>
          !prev || prev.sourcePath !== file.path
            ? prev
            : {
                ...prev,
                stage: "failed",
                message: typedError.message || "An unknown error occurred",
              },
        );
        toast({
          title: "Download failed",
          description: typedError.message || "An unknown error occurred",
          variant: "destructive",
        });
      } finally {
        unlisten();
      }
    },
    [
      activeDownload,
      args,
      resetDownloadSpeedTracking,
      selectedFile,
      setActiveDownload,
    ],
  );

  const handleFileOpen = useCallback(
    async (file: FileItem) => {
      if (file.isDirectory) {
        args.navigate(file.path);
        return;
      }
      if (isSavedVirtualFilePath(file.path)) {
        if (file.isNoteMessage) return;
        if (isSavedPreviewableFile(file)) {
          const kind = getSavedMediaKind(file);
          if (kind === "audio") {
            openSavedAudioPlayer(file);
            return;
          }
          openSavedMediaViewer(file);
          return;
        }
        await handleDownloadSavedFile(file);
        return;
      }
      if (isLocalImageFile(file)) {
        openLocalImageViewer(file);
        return;
      }
      if (isLocalVideoFile(file)) {
        openLocalVideoViewer(file);
        return;
      }
      if (isLocalAudioFile(file)) {
        openLocalAudioPlayer(file);
        return;
      }
      try {
        await invoke("fs_open_path", { path: file.path });
        toast({ title: "Opening file", description: file.name });
      } catch (error) {
        const typedError = error as FsError;
        toast({
          title: "Error opening file",
          description: typedError.message || "An unknown error occurred",
          variant: "destructive",
        });
      }
    },
    [
      args,
      handleDownloadSavedFile,
      isLocalAudioFile,
      isLocalImageFile,
      isLocalVideoFile,
      openLocalAudioPlayer,
      openLocalImageViewer,
      openLocalVideoViewer,
      openSavedAudioPlayer,
      openSavedMediaViewer,
    ],
  );

  const handleDelete = useCallback(
    async (targetsOverride?: FileItem[]) => {
      const targets = targetsOverride ?? deleteTargets;
      if (!targets.length) return;
      const activePath = currentPathRef.current;
      const inRecycleBin = isRecycleBinPath(activePath);
      let deletedCount = 0,
        failedCount = 0,
        skippedCount = 0;
      let firstErrorMessage: string | null = null;
      try {
        const deletableTargets = targets.filter(
          (target) =>
            !(target.isDirectory && isProtectedSavedFolderPath(target.path)),
        );
        const savedTargets = deletableTargets.filter((target) =>
          isSavedVirtualItemPath(target.path),
        );
        const localTargets = deletableTargets.filter(
          (target) => !isSavedVirtualItemPath(target.path),
        );
        if (
          inRecycleBin &&
          savedTargets.length > 1 &&
          localTargets.length === 0
        ) {
          await invoke("tg_delete_saved_items_permanently", {
            args: { sourcePaths: savedTargets.map((target) => target.path) },
          });
          deletedCount = savedTargets.length;
        } else {
          for (const target of targets) {
            if (target.isDirectory && isProtectedSavedFolderPath(target.path)) {
              skippedCount += 1;
              continue;
            }
            try {
              if (isSavedVirtualItemPath(target.path)) {
                if (inRecycleBin) {
                  await invoke("tg_delete_saved_item_permanently", {
                    sourcePath: target.path,
                  });
                } else {
                  await invoke("tg_move_saved_item_to_recycle_bin", {
                    sourcePath: target.path,
                  });
                }
              } else {
                await invoke("fs_delete", { path: target.path });
              }
              deletedCount += 1;
            } catch (error) {
              failedCount += 1;
              if (!firstErrorMessage) {
                firstErrorMessage =
                  typeof error === "object" &&
                  error &&
                  "message" in (error as any)
                    ? String((error as any).message)
                    : "Delete failed";
              }
            }
          }
        }
        if (targets.some((target) => isSavedVirtualItemPath(target.path))) {
          requestStructureBackup();
          savedPathCacheRef.current = {};
          queueCloudSync();
        }
        await loadDirectoryRef.current(activePath, { force: true });
        toast({
          title:
            failedCount || skippedCount
              ? "Delete completed"
              : inRecycleBin
                ? "Deleted"
                : "Moved to Recycle Bin",
          description:
            failedCount || skippedCount
              ? `${deletedCount} succeeded, ${failedCount} failed${skippedCount ? `, ${skippedCount} skipped` : ""}${firstErrorMessage ? `. ${firstErrorMessage}` : ""}`
              : deletedCount === 1
                ? `${targets[0].name} ${inRecycleBin ? "deleted permanently" : "moved successfully"}`
                : `${deletedCount} items ${inRecycleBin ? "deleted permanently" : "moved successfully"}`,
          variant: failedCount ? "destructive" : undefined,
        });
      } catch (error) {
        const typedError = error as FsError | TelegramError;
        toast({
          title: "Error deleting item",
          description: typedError.message || "An unknown error occurred",
          variant: "destructive",
        });
      } finally {
        setDeleteTargets([]);
        if (
          selectedFile &&
          targets.some((target) => target.path === selectedFile.path)
        ) {
          setSelectedFile(null);
          closeDetailsPanel();
        }
      }
    },
    [
      closeDetailsPanel,
      currentPathRef,
      deleteTargets,
      loadDirectoryRef,
      queueCloudSync,
      requestStructureBackup,
      savedPathCacheRef,
      selectedFile,
      setDeleteTargets,
      setSelectedFile,
    ],
  );

  const handleDeleteNoteFromTelegram = useCallback(
    async (targetFile?: FileItem | null) => {
      const file = targetFile ?? selectedFile;
      if (!file || !file.isNoteMessage || !isNotesVirtualPath(currentPath))
        return;
      try {
        await invoke("tg_delete_saved_item_permanently", {
          sourcePath: file.path,
        });
        requestStructureBackup();
        queueCloudSync();
        toast({
          title: "Deleted from Telegram",
          description: `${file.name} deleted permanently from Telegram`,
        });
        removeItemFromCurrentView(file.path);
        savedPathCacheRef.current = {};
      } catch (error) {
        const typedError = error as TelegramError;
        toast({
          title: "Delete failed",
          description:
            typedError.message || "Unable to delete note from Telegram",
          variant: "destructive",
        });
      }
    },
    [
      currentPath,
      queueCloudSync,
      removeItemFromCurrentView,
      requestStructureBackup,
      savedPathCacheRef,
      selectedFile,
    ],
  );

  const handleRestoreFromRecycleBin = useCallback(
    async (targetFile?: FileItem | null) => {
      const file = targetFile ?? selectedFile;
      if (
        !file ||
        !isRecycleBinPath(currentPath) ||
        !isSavedVirtualItemPath(file.path)
      )
        return;
      try {
        await invoke("tg_restore_saved_item", { sourcePath: file.path });
        requestStructureBackup();
        queueCloudSync();
        savedPathCacheRef.current = {};
        toast({
          title: "Restored",
          description: `${file.name} restored to its previous folder`,
        });
        if (selectedFile?.path === file.path) {
          setSelectedFile(null);
          closeDetailsPanel();
        }
        await loadDirectory(currentPath, { force: true });
      } catch (error) {
        const typedError = error as TelegramError;
        toast({
          title: "Restore failed",
          description: typedError.message || "An unknown error occurred",
          variant: "destructive",
        });
      }
    },
    [
      closeDetailsPanel,
      currentPath,
      loadDirectory,
      queueCloudSync,
      requestStructureBackup,
      savedPathCacheRef,
      selectedFile,
      setSelectedFile,
    ],
  );

  const handleRestoreAllFromRecycleBin = useCallback(async () => {
    if (!isRecycleBinPath(currentPath)) {
      return;
    }

    const recycleBinItems = files.filter((file) =>
      isSavedVirtualItemPath(file.path),
    );
    if (!recycleBinItems.length) {
      toast({ title: "Recycle Bin is empty" });
      return;
    }

    const results = await Promise.allSettled(
      recycleBinItems.map((file) =>
        invoke("tg_restore_saved_item", { sourcePath: file.path }),
      ),
    );

    const restoredCount = results.filter(
      (result) => result.status === "fulfilled",
    ).length;
    const failedResults = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    const failedCount = failedResults.length;
    const firstError = failedResults[0]?.reason as TelegramError | undefined;

    if (restoredCount > 0) {
      requestStructureBackup();
      queueCloudSync();
      savedPathCacheRef.current = {};
      setSelectedFile(null);
      setSelectedPaths([]);
      closeDetailsPanel();
      await loadDirectory(currentPath, { force: true });
    }

    if (failedCount > 0) {
      toast({
        title: restoredCount > 0 ? "Restore completed" : "Restore failed",
        description:
          restoredCount > 0
            ? `${restoredCount} restored, ${failedCount} failed${firstError?.message ? `. ${firstError.message}` : ""}`
            : firstError?.message || "An unknown error occurred",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Restored",
      description:
        restoredCount === 1
          ? `${recycleBinItems[0]?.name || "Item"} restored to its previous folder`
          : `${restoredCount} items restored to their previous folders`,
    });
  }, [
    closeDetailsPanel,
    currentPath,
    files,
    loadDirectory,
    queueCloudSync,
    requestStructureBackup,
    savedPathCacheRef,
    setSelectedFile,
    setSelectedPaths,
  ]);

  const handleCopyPath = useCallback(
    (targetFile?: FileItem | null) => {
      const file = targetFile ?? selectedFile;
      if (!file) return;
      navigator.clipboard.writeText(file.path);
      toast({
        title: "Path copied",
        description: "File path copied to clipboard",
      });
    },
    [selectedFile],
  );

  const handleNewFolder = useCallback(() => {
    if (isGalleryPath(currentPath)) {
      toast({
        title: "Action unavailable",
        description: "Cannot create folders inside Gallery.",
      });
      return;
    }
    if (isRecycleBinPath(currentPath)) {
      toast({
        title: "Action unavailable",
        description: "Cannot create folders inside Recycle Bin.",
      });
      return;
    }
    setNewFolderName("");
    setIsNewFolderDialogOpen(true);
  }, [currentPath, setIsNewFolderDialogOpen, setNewFolderName]);

  const handleConfirmNewFolder = useCallback(async () => {
    const folderName = newFolderName.trim();
    if (!folderName) {
      toast({
        title: "Folder name required",
        description: "Please enter a folder name.",
        variant: "destructive",
      });
      return;
    }

    const targetPath = currentPath;
    setIsNewFolderDialogOpen(false);
    setNewFolderName("");

    try {
      if (targetPath.startsWith("tg://saved")) {
        await invoke("tg_create_saved_folder", {
          parentPath: virtualToSavedPath(targetPath),
          folderName,
        });
        requestStructureBackup();
        savedPathCacheRef.current = {};
        queueCloudSync();
      } else {
        const newPath = `${targetPath}/${folderName}`.replace("//", "/");
        await invoke("fs_create_dir", { path: newPath });
      }
      toast({
        title: "Folder created",
        description: `Created folder: ${folderName}`,
      });
      await loadDirectory(targetPath, { force: true });

      window.setTimeout(() => {
        if (currentPathRef.current === targetPath) {
          void loadDirectoryRef.current(targetPath, { force: true });
        }
      }, 1200);
    } catch (error) {
      setIsNewFolderDialogOpen(true);
      setNewFolderName(folderName);
      const typedError = error as FsError | TelegramError;
      toast({
        title: "Error creating folder",
        description: typedError.message || "An unknown error occurred",
        variant: "destructive",
      });
    }
  }, [
    currentPath,
    loadDirectory,
    loadDirectoryRef,
    newFolderName,
    currentPathRef,
    queueCloudSync,
    requestStructureBackup,
    savedPathCacheRef,
    setIsNewFolderDialogOpen,
    setNewFolderName,
  ]);

  const handleRename = useCallback(
    (targetFile?: FileItem | null) => {
      const file = targetFile ?? selectedFile;
      if (!file) return;
      if (isRecycleBinPath(currentPath)) {
        toast({
          title: "Action unavailable",
          description: "Cannot rename items inside Recycle Bin.",
        });
        return;
      }
      setRenameTarget(file);
      setRenameValue(file.name);
    },
    [currentPath, selectedFile, setRenameTarget, setRenameValue],
  );

  const performRename = useCallback(
    async (file: FileItem, normalizedName: string) => {
      const activePath = currentPathRef.current;
      try {
        if (isSavedVirtualItemPath(file.path)) {
          await invoke("tg_rename_saved_item", {
            sourcePath: file.path,
            newName: normalizedName,
          });
          requestStructureBackup();
          savedPathCacheRef.current = {};
          queueCloudSync();
        } else {
          const directory = getParentPath(file.path);
          if (!directory) {
            toast({
              title: "Rename failed",
              description: "Unable to resolve target directory",
              variant: "destructive",
            });
            return;
          }
          await invoke("rename_file", {
            oldPath: file.path,
            newPath: joinPath(directory, normalizedName),
          });
        }
        setRenameTarget(null);
        setRenameValue("");
        toast({
          title: "Renamed",
          description: `${file.name} renamed to ${normalizedName}`,
        });
        if (selectedFile?.path === file.path)
          setSelectedFile({ ...file, name: normalizedName });
        await loadDirectoryRef.current(activePath, { force: true });
      } catch (error) {
        const typedError = error as FsError | TelegramError;
        toast({
          title: "Rename failed",
          description: typedError.message || "An unknown error occurred",
          variant: "destructive",
        });
      }
    },
    [
      currentPathRef,
      loadDirectoryRef,
      queueCloudSync,
      requestStructureBackup,
      savedPathCacheRef,
      selectedFile,
      setRenameTarget,
      setRenameValue,
      setSelectedFile,
    ],
  );

  const handleConfirmRename = useCallback(async () => {
    const file = renameTarget;
    if (!file) return;
    const normalizedName = renameValue.trim();
    if (!normalizedName) {
      toast({
        title: "Name required",
        description: "Please enter a new name.",
        variant: "destructive",
      });
      return;
    }
    if (normalizedName === file.name) {
      setRenameTarget(null);
      setRenameValue("");
      return;
    }
    if (confirmRenameRef.current) {
      setPendingRenameConfirm({ file, newName: normalizedName });
      return;
    }
    await performRename(file, normalizedName);
  }, [
    confirmRenameRef,
    performRename,
    renameTarget,
    renameValue,
    setPendingRenameConfirm,
    setRenameTarget,
    setRenameValue,
  ]);

  const handleShare = useCallback(
    async (targetFile?: FileItem | null) => {
      const file = targetFile ?? selectedFile;
      if (!file || file.isDirectory) return;
      setShareTarget(file);
    },
    [selectedFile, setShareTarget],
  );

  const handleShareClose = useCallback(
    () => setShareTarget(null),
    [setShareTarget],
  );

  const handleShareToContact = useCallback(
    async (chatId: number) => {
      if (!shareTarget || !shareTarget.messageId) {
        toast({
          title: "Share failed",
          description: "Unable to share this item",
          variant: "destructive",
        });
        return;
      }
      try {
        await invoke("tg_forward_message", {
          messageId: shareTarget.messageId,
          chatId,
        });
        toast({ title: "Shared", description: "Item forwarded successfully" });
      } catch {
        toast({
          title: "Share failed",
          description: "Unable to share this item",
          variant: "destructive",
        });
      }
    },
    [shareTarget],
  );

  const handleCopyNoteText = useCallback(
    async (targetFile?: FileItem | null) => {
      const file = targetFile ?? selectedFile;
      if (!file || !file.isNoteMessage) return;
      const textToCopy = (file.noteText || file.name || "").trim();
      if (!textToCopy) return;
      try {
        await navigator.clipboard.writeText(textToCopy);
      } catch {
        toast({
          title: "Copy failed",
          description: "Unable to copy note text",
          variant: "destructive",
        });
      }
    },
    [selectedFile],
  );

  const handleEditNoteMessage = useCallback(
    (targetFile?: FileItem | null) => {
      const file = targetFile ?? selectedFile;
      if (!file || !file.isNoteMessage) return;
      setNoteEditTarget(file);
      setNoteEditValue(file.noteText || file.name || "");
    },
    [selectedFile, setNoteEditTarget, setNoteEditValue],
  );

  const handleConfirmEditNoteMessage = useCallback(async () => {
    const target = noteEditTarget;
    if (!target) return;
    const nextText = noteEditValue.trim();
    if (!nextText) {
      toast({
        title: "Message required",
        description: "Message text cannot be empty.",
        variant: "destructive",
      });
      return;
    }
    try {
      await invoke("tg_edit_saved_note_message", {
        sourcePath: target.path,
        text: nextText,
      });
      const normalizedTargetPath = normalizePath(target.path);
      const nowIso = new Date().toISOString();
      const updatedItems = filesRef.current.map((item) =>
        normalizePath(item.path) === normalizedTargetPath
          ? { ...item, name: nextText, noteText: nextText, modifiedAt: nowIso }
          : item,
      );
      setFiles(updatedItems);
      const cacheEntry = savedPathCacheRef.current[currentPathRef.current];
      if (cacheEntry) {
        savedPathCacheRef.current[currentPathRef.current] = {
          ...cacheEntry,
          items: updatedItems,
        };
      }
      setSelectedFile((prev) =>
        !prev || normalizePath(prev.path) !== normalizedTargetPath
          ? prev
          : { ...prev, name: nextText, noteText: nextText, modifiedAt: nowIso },
      );
      setNoteEditTarget(null);
      setNoteEditValue("");
    } catch (error) {
      const typedError = error as TelegramError;
      toast({
        title: "Edit failed",
        description: typedError.message || "Unable to edit note message",
        variant: "destructive",
      });
    }
  }, [
    currentPathRef,
    filesRef,
    noteEditTarget,
    noteEditValue,
    savedPathCacheRef,
    setFiles,
    setNoteEditTarget,
    setNoteEditValue,
    setSelectedFile,
  ]);

  const handleSendNoteMessage = useCallback(async () => {
    if (!isNotesFolderView || isSendingNoteMessage) return;
    const text = noteComposerValue.trim();
    if (!text) return;
    setIsSendingNoteMessage(true);
    try {
      const sentMessage = await invoke<TelegramMessage>(
        "tg_send_saved_note_message",
        { text },
      );
      const noteItem = telegramMessageToFileItem(sentMessage);
      appendItemToCurrentView("tg://saved/Notes", noteItem);
      setNoteComposerValue("");
      window.requestAnimationFrame(() => {
        const area = explorerAreaRef.current;
        if (area) area.scrollTop = area.scrollHeight;
      });
    } catch (error) {
      const typedError = error as TelegramError;
      toast({
        title: "Send failed",
        description: typedError.message || "Unable to send note message",
        variant: "destructive",
      });
    } finally {
      setIsSendingNoteMessage(false);
    }
  }, [
    appendItemToCurrentView,
    explorerAreaRef,
    isNotesFolderView,
    isSendingNoteMessage,
    noteComposerValue,
    setIsSendingNoteMessage,
    setNoteComposerValue,
  ]);

  const handleStageClipboardItem = useCallback(
    (mode: ClipboardMode, targetFile?: FileItem | null) => {
      const file = targetFile ?? selectedFile;
      if (!file) return;
      if (file.isNoteMessage || isNotesVirtualPath(currentPath)) {
        toast({
          title: "Action unavailable",
          description: "Copy/Cut is disabled in Notes folder.",
        });
        return;
      }
      if (isRecycleBinPath(currentPath)) {
        toast({
          title: "Action unavailable",
          description: "Cannot modify items inside Recycle Bin.",
        });
        return;
      }
      const shouldStageSelection =
        selectedPaths.length > 1 && selectedPaths.includes(file.path);
      const stagePaths = shouldStageSelection ? selectedPaths : [file.path];
      const stageItems = stagePaths
        .map((path) => {
          const fromList = filesRef.current.find((item) => item.path === path);
          return fromList
            ? {
                path: fromList.path,
                name: fromList.name,
                isDirectory: fromList.isDirectory,
              }
            : { path, name: getPathName(path), isDirectory: false };
        })
        .filter(
          (item, index, self) =>
            self.findIndex((other) => other.path === item.path) === index,
        );
      setClipboardItem({ mode, items: stageItems });
    },
    [currentPath, filesRef, selectedFile, selectedPaths, setClipboardItem],
  );

  const resolvePasteDestinationPath = useCallback((): string => {
    const targetFile = contextMenuState?.targetFile;
    return targetFile?.isDirectory ? targetFile.path : currentPath;
  }, [contextMenuState, currentPath]);

  const performPaste = useCallback(
    async (
      clipboardSnapshot: ExplorerClipboardItem,
      destinationFolderPath: string,
      pasteLabel: string,
    ) => {
      setActivePaste({
        fileName: pasteLabel,
        destinationPath: destinationFolderPath,
      });
      const sourceItems = clipboardSnapshot.items;
      const activePath = currentPathRef.current;
      try {
        const destinationIsSaved = isSavedVirtualFolderPath(
          destinationFolderPath,
        );
        const sourcesAreSaved = sourceItems.every((item) =>
          isSavedVirtualItemPath(item.path),
        );
        if (sourcesAreSaved || destinationIsSaved) {
          if (!sourcesAreSaved || !destinationIsSaved) {
            toast({
              title: "Paste unavailable",
              description:
                "Cannot move items between local files and Saved Messages.",
              variant: "destructive",
            });
            return;
          }
          if (clipboardSnapshot.mode === "copy") {
            let copiedCount = 0,
              failedCount = 0,
              skippedCount = 0;
            let firstErrorMessage: string | null = null;
            for (const item of sourceItems) {
              if (item.isDirectory || !isSavedVirtualFilePath(item.path)) {
                skippedCount += 1;
                continue;
              }
              try {
                await invoke("tg_copy_saved_item", {
                  sourcePath: item.path,
                  destinationPath: destinationFolderPath,
                });
                copiedCount += 1;
              } catch (error) {
                failedCount += 1;
                if (!firstErrorMessage)
                  firstErrorMessage =
                    typeof error === "object" &&
                    error &&
                    "message" in (error as any)
                      ? String((error as any).message)
                      : "Copy failed";
              }
            }
            if (copiedCount > 0) {
              requestStructureBackup();
              savedPathCacheRef.current = {};
              queueCloudSync();
            }
            await loadDirectoryRef.current(activePath, { force: true });
            toast({
              title: failedCount || skippedCount ? "Copy completed" : "Copied",
              description:
                failedCount || skippedCount
                  ? `${copiedCount} copied, ${failedCount} failed${skippedCount ? `, ${skippedCount} skipped` : ""}${firstErrorMessage ? `. ${firstErrorMessage}` : ""}`
                  : copiedCount === 1
                    ? `${sourceItems[0].name} copied successfully`
                    : `${copiedCount} items copied successfully`,
              variant: failedCount ? "destructive" : undefined,
            });
            return;
          }
          let movedCount = 0,
            failedCount = 0;
          const movedSourcePaths: string[] = [];
          for (const item of sourceItems) {
            try {
              await invoke("tg_move_saved_item", {
                sourcePath: item.path,
                destinationPath: destinationFolderPath,
              });
              movedCount += 1;
              movedSourcePaths.push(item.path);
            } catch {
              failedCount += 1;
            }
          }
          if (movedCount > 0) {
            requestStructureBackup();
            savedPathCacheRef.current = {};
            removePathsFromExplorerState(movedSourcePaths);
            queueCloudSync();
          }
          if (clipboardSnapshot.mode === "cut" && movedCount > 0)
            setClipboardItem(null);
          await loadDirectoryRef.current(activePath, { force: true });
          toast({
            title: failedCount ? "Paste completed" : "Moved",
            description: failedCount
              ? `${movedCount} moved, ${failedCount} failed`
              : movedCount === 1
                ? `${sourceItems[0].name} moved successfully`
                : `${movedCount} items moved successfully`,
            variant: failedCount ? "destructive" : undefined,
          });
          return;
        }
        if (
          sourceItems.some((item) => isVirtualPath(item.path)) ||
          isVirtualPath(destinationFolderPath)
        ) {
          toast({
            title: "Paste unavailable",
            description: "Unsupported source or destination path.",
            variant: "destructive",
          });
          return;
        }
        let copiedCount = 0,
          movedCount = 0,
          failedCount = 0;
        const movedSourcePaths: string[] = [];
        for (const item of sourceItems) {
          const destinationPath = joinPath(destinationFolderPath, item.name);
          if (normalizePath(item.path) === normalizePath(destinationPath))
            continue;
          try {
            if (clipboardSnapshot.mode === "copy") {
              await invoke("copy_file", {
                source: item.path,
                destination: destinationPath,
              });
              copiedCount += 1;
            } else {
              await invoke("move_file", {
                source: item.path,
                destination: destinationPath,
              });
              movedCount += 1;
              movedSourcePaths.push(item.path);
            }
          } catch {
            failedCount += 1;
          }
        }
        if (movedSourcePaths.length > 0) {
          savedPathCacheRef.current = {};
          removePathsFromExplorerState(movedSourcePaths);
        }
        if (clipboardSnapshot.mode === "cut" && movedCount > 0)
          setClipboardItem(null);
        await loadDirectoryRef.current(activePath, { force: true });
        const completedCount =
          clipboardSnapshot.mode === "copy" ? copiedCount : movedCount;
        toast({
          title: "Paste completed",
          description: failedCount
            ? `${completedCount} completed, ${failedCount} failed`
            : completedCount === 1
              ? "1 item completed"
              : `${completedCount} items completed`,
          variant: failedCount ? "destructive" : undefined,
        });
      } catch (error) {
        const typedError = error as FsError | TelegramError;
        toast({
          title: "Paste failed",
          description: typedError.message || "An unknown error occurred",
          variant: "destructive",
        });
      } finally {
        setActivePaste(null);
      }
    },
    [
      currentPathRef,
      loadDirectoryRef,
      queueCloudSync,
      requestStructureBackup,
      savedPathCacheRef,
      setActivePaste,
      setClipboardItem,
    ],
  );

  const handlePaste = useCallback(async () => {
    if (!clipboardItem || clipboardItem.items.length === 0) return;
    const clipboardSnapshot = clipboardItem;
    const destinationFolderPath = resolvePasteDestinationPath();
    const sourceItems = clipboardSnapshot.items;
    const pasteLabel =
      sourceItems.length === 1
        ? sourceItems[0].name
        : `${sourceItems.length} items`;
    if (!destinationFolderPath) return;
    if (isRecycleBinPath(destinationFolderPath)) {
      toast({
        title: "Paste unavailable",
        description: "Cannot paste items inside Recycle Bin.",
        variant: "destructive",
      });
      return;
    }
    if (
      isGalleryPath(destinationFolderPath) ||
      isGalleryPath(currentPathRef.current)
    ) {
      toast({
        title: "Paste unavailable",
        description: "Cannot paste items inside Gallery.",
        variant: "destructive",
      });
      return;
    }
    if (
      isNotesVirtualPath(destinationFolderPath) ||
      isNotesVirtualPath(currentPathRef.current)
    ) {
      toast({
        title: "Paste unavailable",
        description: "Paste is disabled in Notes folder.",
        variant: "destructive",
      });
      return;
    }
    if (clipboardSnapshot.mode === "cut" && confirmMoveRef.current) {
      const destinationLabel = destinationFolderPath.startsWith("tg://")
        ? getExplorerTabTitle(destinationFolderPath)
        : getPathName(destinationFolderPath);
      setPendingMoveConfirm({
        title: "Move items",
        message: `Move ${pasteLabel} to ${destinationLabel}?`,
        run: async () =>
          performPaste(clipboardSnapshot, destinationFolderPath, pasteLabel),
      });
      return;
    }
    await performPaste(clipboardSnapshot, destinationFolderPath, pasteLabel);
  }, [
    clipboardItem,
    confirmMoveRef,
    currentPathRef,
    performPaste,
    resolvePasteDestinationPath,
    setPendingMoveConfirm,
  ]);

  const handleRefresh = useCallback(async () => {
    await loadDirectory(currentPath, { force: true });
  }, [currentPath, loadDirectory]);

  return {
    appendItemToCurrentView,
    handleConfirmEditNoteMessage,
    handleConfirmNewFolder,
    handleConfirmRename,
    handleCopyNoteText,
    handleCopyPath,
    handleDelete,
    handleDeleteNoteFromTelegram,
    handleDownloadSavedFile,
    handleEditNoteMessage,
    handleFileOpen,
    handleNewFolder,
    handlePaste,
    handleRefresh,
    handleRename,
    handleRestoreAllFromRecycleBin,
    handleRestoreFromRecycleBin,
    handleSendNoteMessage,
    handleShare,
    handleShareClose,
    handleShareToContact,
    handleStageClipboardItem,
    handleToggleFavorite: async (targetFile?: FileItem | null) => {
      const file = targetFile ?? selectedFile;
      if (!showFavoritesRef.current || !file) return;
      const path = file.path;
      if (!favorites.includes(path) && !file.isDirectory) return;
      if (favorites.includes(path)) {
        try {
          const allFavorites: Favorite[] = await invoke("db_get_favorites");
          const favoriteToRemove = allFavorites.find(
            (fav) => fav.path === path,
          );
          if (favoriteToRemove) {
            await invoke("db_remove_favorite", { id: favoriteToRemove.id });
            setFavorites((prev) => prev.filter((f) => f !== path));
            toast({
              title: "Removed from favorites",
              description: `${file.name} is no longer a favorite`,
            });
          }
        } catch (error) {
          const typedError = error as DbError;
          toast({
            title: "Error removing from favorites",
            description: typedError.message || "An unknown error occurred",
            variant: "destructive",
          });
        }
      } else {
        try {
          await invoke("db_add_favorite", { path, label: file.name });
          setFavorites((prev) => [...prev, path]);
          toast({
            title: "Added to favorites",
            description: `${file.name} is now a favorite`,
          });
        } catch (error) {
          const typedError = error as DbError;
          toast({
            title: "Error adding to favorites",
            description: typedError.message || "An unknown error occurred",
            variant: "destructive",
          });
        }
      }
    },
    performRename,
  };
}
