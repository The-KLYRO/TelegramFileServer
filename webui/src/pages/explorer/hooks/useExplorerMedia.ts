import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { FileItem } from "@/components/skybox/FileRow";
import { resolveThumbnailSrc } from "@/lib/thumbnail-src";
import {
  AUDIO_EXTENSIONS,
  IMAGE_EXTENSIONS,
  VIDEO_EXTENSIONS,
  type SavedPathCacheEntry,
  type TelegramError,
  extensionFromFileName,
  getSavedMediaKind,
  isSavedPreviewableFile,
} from "@/pages/explorer/shared";

interface UseExplorerMediaParams {
  currentPath: string;
  sortedFiles: FileItem[];
  selectedFile: FileItem | null;
  setFiles: Dispatch<SetStateAction<FileItem[]>>;
  setSelectedFile: Dispatch<SetStateAction<FileItem | null>>;
  savedPathCacheRef: MutableRefObject<Record<string, SavedPathCacheEntry>>;
}

export function useExplorerMedia({
  currentPath,
  sortedFiles,
  selectedFile,
  setFiles,
  setSelectedFile,
  savedPathCacheRef,
}: UseExplorerMediaParams) {
  const [isMediaViewerOpen, setIsMediaViewerOpen] = useState(false);
  const [mediaViewerItems, setMediaViewerItems] = useState<FileItem[]>([]);
  const [mediaViewerIndex, setMediaViewerIndex] = useState(0);
  const [mediaViewerThumbnailSrc, setMediaViewerThumbnailSrc] = useState<
    string | null
  >(null);
  const [mediaViewerSrc, setMediaViewerSrc] = useState<string | null>(null);
  const [mediaViewerError, setMediaViewerError] = useState<string | null>(null);
  const [isMediaViewerLoading, setIsMediaViewerLoading] = useState(false);
  const [isLocalImageViewerOpen, setIsLocalImageViewerOpen] = useState(false);
  const [localImageViewerItems, setLocalImageViewerItems] = useState<
    FileItem[]
  >([]);
  const [localImageViewerIndex, setLocalImageViewerIndex] = useState(0);
  const [isLocalVideoViewerOpen, setIsLocalVideoViewerOpen] = useState(false);
  const [localVideoViewerFile, setLocalVideoViewerFile] =
    useState<FileItem | null>(null);
  const [audioPlayerSrc, setAudioPlayerSrc] = useState<string | null>(null);
  const [audioPlayerLoading, setAudioPlayerLoading] = useState(false);

  const mediaViewerOpenedPathRef = useRef<string | null>(null);
  const localImageViewerOpenedPathRef = useRef<string | null>(null);
  const localVideoViewerOpenedPathRef = useRef<string | null>(null);
  const thumbnailFetchInFlightRef = useRef<Set<string>>(new Set());
  const savedMediaPreviewCacheRef = useRef<Map<string, string>>(new Map());

  const currentMediaViewerFile = isMediaViewerOpen
    ? (mediaViewerItems[mediaViewerIndex] ?? null)
    : null;
  const currentMediaKind = currentMediaViewerFile
    ? getSavedMediaKind(currentMediaViewerFile)
    : null;
  const canGoToPreviousMedia = mediaViewerIndex > 0;
  const canGoToNextMedia = mediaViewerIndex < mediaViewerItems.length - 1;

  const currentLocalImageFile = isLocalImageViewerOpen
    ? (localImageViewerItems[localImageViewerIndex] ?? null)
    : null;
  const localImageSrc = currentLocalImageFile
    ? resolveThumbnailSrc(currentLocalImageFile.path) || null
    : null;
  const canGoToPreviousLocalImage = localImageViewerIndex > 0;
  const canGoToNextLocalImage =
    localImageViewerIndex < localImageViewerItems.length - 1;
  const localVideoSrc = localVideoViewerFile
    ? resolveThumbnailSrc(localVideoViewerFile.path) || null
    : null;

  const closeSavedMediaViewer = useCallback(() => {
    mediaViewerOpenedPathRef.current = null;
    setIsMediaViewerOpen(false);
    setMediaViewerItems([]);
    setMediaViewerIndex(0);
    setMediaViewerThumbnailSrc(null);
    setMediaViewerSrc(null);
    setMediaViewerError(null);
    setIsMediaViewerLoading(false);
  }, []);

  const closeLocalImageViewer = useCallback(() => {
    localImageViewerOpenedPathRef.current = null;
    setIsLocalImageViewerOpen(false);
    setLocalImageViewerItems([]);
    setLocalImageViewerIndex(0);
  }, []);

  const closeLocalVideoViewer = useCallback(() => {
    localVideoViewerOpenedPathRef.current = null;
    setIsLocalVideoViewerOpen(false);
    setLocalVideoViewerFile(null);
  }, []);

  const closeAudioPlayer = useCallback(() => {
    setAudioPlayerLoading(false);
    setAudioPlayerSrc(null);
  }, []);

  const isLocalImageFile = useCallback((file: FileItem): boolean => {
    if (file.isDirectory || file.path.startsWith("tg://")) {
      return false;
    }

    const extension = (file.extension || extensionFromFileName(file.name) || "")
      .toLowerCase()
      .replace(/^\./, "");
    return !!extension && IMAGE_EXTENSIONS.has(extension);
  }, []);

  const isLocalVideoFile = useCallback((file: FileItem): boolean => {
    if (file.isDirectory || file.path.startsWith("tg://")) {
      return false;
    }

    const extension = (file.extension || extensionFromFileName(file.name) || "")
      .toLowerCase()
      .replace(/^\./, "");
    return !!extension && VIDEO_EXTENSIONS.has(extension);
  }, []);

  const isLocalAudioFile = useCallback((file: FileItem): boolean => {
    if (file.isDirectory || file.path.startsWith("tg://")) {
      return false;
    }

    const extension = (file.extension || extensionFromFileName(file.name) || "")
      .toLowerCase()
      .replace(/^\./, "");
    return !!extension && AUDIO_EXTENSIONS.has(extension);
  }, []);

  const openSavedMediaViewer = useCallback(
    (targetFile: FileItem) => {
      if (isLocalImageViewerOpen) {
        closeLocalImageViewer();
      }
      if (isLocalVideoViewerOpen) {
        closeLocalVideoViewer();
      }

      const targetKind = getSavedMediaKind(targetFile);
      if (!targetKind) {
        return;
      }

      const nextItems =
        targetKind === "image"
          ? sortedFiles.filter((item) => getSavedMediaKind(item) === "image")
          : [targetFile];
      const initialIndex = nextItems.findIndex(
        (item) => item.path === targetFile.path,
      );
      if (initialIndex < 0) {
        return;
      }

      setMediaViewerItems(nextItems);
      setMediaViewerIndex(initialIndex);
      setMediaViewerThumbnailSrc(
        resolveThumbnailSrc(targetFile.thumbnail) || null,
      );
      const cachedPreview = savedMediaPreviewCacheRef.current.get(
        targetFile.path,
      );
      setMediaViewerSrc(cachedPreview || null);
      setMediaViewerError(null);
      setIsMediaViewerLoading(!cachedPreview);
      mediaViewerOpenedPathRef.current = currentPath;
      setIsMediaViewerOpen(true);
    },
    [
      closeLocalImageViewer,
      closeLocalVideoViewer,
      currentPath,
      isLocalImageViewerOpen,
      isLocalVideoViewerOpen,
      sortedFiles,
    ],
  );

  const openLocalImageViewer = useCallback(
    (targetFile: FileItem) => {
      if (!isLocalImageFile(targetFile)) {
        return;
      }

      if (isMediaViewerOpen) {
        closeSavedMediaViewer();
      }
      if (isLocalVideoViewerOpen) {
        closeLocalVideoViewer();
      }

      const imageItems = sortedFiles.filter(isLocalImageFile);
      const initialIndex = imageItems.findIndex(
        (item) => item.path === targetFile.path,
      );
      if (initialIndex < 0) {
        return;
      }

      setLocalImageViewerItems(imageItems);
      setLocalImageViewerIndex(initialIndex);
      localImageViewerOpenedPathRef.current = currentPath;
      setIsLocalImageViewerOpen(true);
    },
    [
      closeLocalVideoViewer,
      closeSavedMediaViewer,
      currentPath,
      isLocalImageFile,
      isLocalVideoViewerOpen,
      isMediaViewerOpen,
      sortedFiles,
    ],
  );

  const openLocalVideoViewer = useCallback(
    (targetFile: FileItem) => {
      if (!isLocalVideoFile(targetFile)) {
        return;
      }

      if (isMediaViewerOpen) {
        closeSavedMediaViewer();
      }
      if (isLocalImageViewerOpen) {
        closeLocalImageViewer();
      }

      setLocalVideoViewerFile(targetFile);
      localVideoViewerOpenedPathRef.current = currentPath;
      setIsLocalVideoViewerOpen(true);
    },
    [
      closeLocalImageViewer,
      closeSavedMediaViewer,
      currentPath,
      isLocalImageViewerOpen,
      isLocalVideoFile,
      isMediaViewerOpen,
    ],
  );

  const openSavedAudioPlayer = useCallback(
    (targetFile: FileItem) => {
      if (isMediaViewerOpen) {
        closeSavedMediaViewer();
      }
      if (isLocalImageViewerOpen) {
        closeLocalImageViewer();
      }
      if (isLocalVideoViewerOpen) {
        closeLocalVideoViewer();
      }

      setAudioPlayerLoading(true);
      setAudioPlayerSrc(null);

      invoke<string>("tg_prepare_saved_media_stream", {
        sourcePath: targetFile.path,
      })
        .then((localPath) => {
          const resolved = resolveThumbnailSrc(localPath);
          if (resolved) {
            setAudioPlayerSrc(resolved);
          }
        })
        .catch(() => {
          // ignore
        })
        .finally(() => {
          setAudioPlayerLoading(false);
        });
    },
    [
      closeLocalImageViewer,
      closeLocalVideoViewer,
      closeSavedMediaViewer,
      isLocalImageViewerOpen,
      isLocalVideoViewerOpen,
      isMediaViewerOpen,
    ],
  );

  const openLocalAudioPlayer = useCallback(
    (targetFile: FileItem) => {
      if (!isLocalAudioFile(targetFile)) {
        return;
      }

      if (isMediaViewerOpen) {
        closeSavedMediaViewer();
      }
      if (isLocalImageViewerOpen) {
        closeLocalImageViewer();
      }
      if (isLocalVideoViewerOpen) {
        closeLocalVideoViewer();
      }

      const resolved = resolveThumbnailSrc(targetFile.path);
      setAudioPlayerSrc(resolved || null);
      setAudioPlayerLoading(false);
    },
    [
      closeLocalImageViewer,
      closeLocalVideoViewer,
      closeSavedMediaViewer,
      isLocalAudioFile,
      isLocalImageViewerOpen,
      isLocalVideoViewerOpen,
      isMediaViewerOpen,
    ],
  );

  const applyFetchedThumbnail = useCallback(
    (messageId: number, thumbnailSrc: string) => {
      setFiles((prev) =>
        prev.map((item) =>
          item.messageId === messageId
            ? { ...item, thumbnail: thumbnailSrc }
            : item,
        ),
      );

      setMediaViewerItems((prev) =>
        prev.map((item) =>
          item.messageId === messageId
            ? { ...item, thumbnail: thumbnailSrc }
            : item,
        ),
      );

      setSelectedFile((prev) =>
        prev && prev.messageId === messageId
          ? { ...prev, thumbnail: thumbnailSrc }
          : prev,
      );

      Object.keys(savedPathCacheRef.current).forEach((cachePath) => {
        const entry = savedPathCacheRef.current[cachePath];
        let changed = false;
        const nextItems = entry.items.map((item) => {
          if (item.messageId === messageId) {
            changed = true;
            return { ...item, thumbnail: thumbnailSrc };
          }

          return item;
        });

        if (changed) {
          savedPathCacheRef.current[cachePath] = {
            ...entry,
            items: nextItems,
          };
        }
      });
    },
    [savedPathCacheRef, setFiles, setSelectedFile],
  );

  const ensureThumbnailForFile = useCallback(
    async (file: FileItem) => {
      const mediaKind = getSavedMediaKind(file);
      if (mediaKind !== "image" && mediaKind !== "video") {
        return;
      }

      const messageId = file.messageId;
      if (!messageId || messageId <= 0) {
        return;
      }

      const chatId = file.chatId;
      const thumbnailKey =
        chatId && Number.isFinite(chatId) && chatId !== 0
          ? `${chatId}:${messageId}`
          : String(messageId);

      const resolvedExisting = resolveThumbnailSrc(file.thumbnail);
      if (resolvedExisting && !resolvedExisting.startsWith("data:")) {
        return;
      }

      if (thumbnailFetchInFlightRef.current.has(thumbnailKey)) {
        return;
      }

      thumbnailFetchInFlightRef.current.add(thumbnailKey);

      try {
        const thumbnailPath: string | null = await invoke(
          chatId && Number.isFinite(chatId) && chatId !== 0
            ? "tg_get_chat_message_thumbnail"
            : "tg_get_message_thumbnail",
          chatId && Number.isFinite(chatId) && chatId !== 0
            ? { args: { chatId, messageId } }
            : { messageId },
        );

        const resolvedThumbnail = resolveThumbnailSrc(thumbnailPath);
        if (resolvedThumbnail) {
          applyFetchedThumbnail(messageId, resolvedThumbnail);
          if (
            isMediaViewerOpen &&
            currentMediaViewerFile?.messageId === messageId
          ) {
            setMediaViewerThumbnailSrc(resolvedThumbnail);
          }
          return;
        }

        if (mediaKind === "image") {
          const previewPath: string = await invoke(
            "tg_prepare_saved_media_preview",
            {
              sourcePath: file.path,
            },
          );

          const resolvedPreview = resolveThumbnailSrc(previewPath);
          if (resolvedPreview) {
            applyFetchedThumbnail(messageId, resolvedPreview);
            if (
              isMediaViewerOpen &&
              currentMediaViewerFile?.messageId === messageId
            ) {
              setMediaViewerThumbnailSrc(resolvedPreview);
            }
          }
        }
      } catch (error) {
        console.error("Failed to ensure thumbnail for file:", file.path, error);
      } finally {
        thumbnailFetchInFlightRef.current.delete(thumbnailKey);
      }
    },
    [applyFetchedThumbnail, currentMediaViewerFile, isMediaViewerOpen],
  );

  const goToPreviousMedia = useCallback(() => {
    setMediaViewerIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const goToNextMedia = useCallback(() => {
    setMediaViewerIndex((prev) =>
      Math.min(mediaViewerItems.length - 1, prev + 1),
    );
  }, [mediaViewerItems.length]);

  const goToPreviousLocalImage = useCallback(() => {
    setLocalImageViewerIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const goToNextLocalImage = useCallback(() => {
    setLocalImageViewerIndex((prev) =>
      Math.min(localImageViewerItems.length - 1, prev + 1),
    );
  }, [localImageViewerItems.length]);

  useEffect(() => {
    if (!selectedFile || !isSavedPreviewableFile(selectedFile)) {
      return;
    }

    void ensureThumbnailForFile(selectedFile);
  }, [ensureThumbnailForFile, selectedFile]);

  useEffect(() => {
    if (
      !isMediaViewerOpen ||
      !currentMediaViewerFile ||
      !isSavedPreviewableFile(currentMediaViewerFile)
    ) {
      return;
    }

    void ensureThumbnailForFile(currentMediaViewerFile);
  }, [currentMediaViewerFile, ensureThumbnailForFile, isMediaViewerOpen]);

  useEffect(() => {
    if (!isMediaViewerOpen || !currentMediaViewerFile) {
      setMediaViewerThumbnailSrc(null);
      return;
    }

    const existingThumbnail = resolveThumbnailSrc(
      currentMediaViewerFile.thumbnail,
    );
    setMediaViewerThumbnailSrc(existingThumbnail || null);
  }, [currentMediaViewerFile, isMediaViewerOpen]);

  useEffect(() => {
    if (!isMediaViewerOpen || !currentMediaViewerFile) {
      return;
    }

    if (!isSavedPreviewableFile(currentMediaViewerFile)) {
      setMediaViewerError("This file cannot be previewed.");
      setIsMediaViewerLoading(false);
      return;
    }

    let cancelled = false;
    const cachedPreview = savedMediaPreviewCacheRef.current.get(
      currentMediaViewerFile.path,
    );
    if (cachedPreview) {
      setMediaViewerSrc(cachedPreview);
      setMediaViewerError(null);
      setIsMediaViewerLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setIsMediaViewerLoading(true);
    setMediaViewerSrc(null);
    setMediaViewerError(null);

    const previewCommand =
      currentMediaKind === "video" || currentMediaKind === "audio"
        ? "tg_prepare_saved_media_stream"
        : "tg_prepare_saved_media_preview";

    invoke<string>(previewCommand, {
      sourcePath: currentMediaViewerFile.path,
    })
      .then((localPath) => {
        if (cancelled) {
          return;
        }

        const resolvedPath = resolveThumbnailSrc(localPath);
        if (!resolvedPath) {
          setMediaViewerError("Unable to load media preview.");
          return;
        }
        savedMediaPreviewCacheRef.current.set(
          currentMediaViewerFile.path,
          resolvedPath,
        );
        setMediaViewerSrc(resolvedPath);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        const typedError = error as TelegramError;
        savedMediaPreviewCacheRef.current.delete(currentMediaViewerFile.path);
        setMediaViewerError(
          typedError.message || "Failed to load media preview.",
        );
      })
      .finally(() => {
        if (!cancelled) {
          setIsMediaViewerLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentMediaKind, currentMediaViewerFile, isMediaViewerOpen]);

  useEffect(() => {
    if (
      !isMediaViewerOpen ||
      !currentMediaViewerFile ||
      !currentMediaViewerFile.messageId ||
      !!mediaViewerThumbnailSrc ||
      !mediaViewerSrc ||
      (currentMediaKind !== "image" && currentMediaKind !== "video")
    ) {
      return;
    }

    setMediaViewerThumbnailSrc(mediaViewerSrc);
    applyFetchedThumbnail(currentMediaViewerFile.messageId, mediaViewerSrc);
  }, [
    applyFetchedThumbnail,
    currentMediaKind,
    currentMediaViewerFile,
    isMediaViewerOpen,
    mediaViewerSrc,
    mediaViewerThumbnailSrc,
  ]);

  useEffect(() => {
    if (!isMediaViewerOpen) {
      return;
    }

    if (
      mediaViewerOpenedPathRef.current &&
      mediaViewerOpenedPathRef.current !== currentPath
    ) {
      closeSavedMediaViewer();
    }
  }, [closeSavedMediaViewer, currentPath, isMediaViewerOpen]);

  useEffect(() => {
    if (!isLocalImageViewerOpen) {
      return;
    }

    if (
      localImageViewerOpenedPathRef.current &&
      localImageViewerOpenedPathRef.current !== currentPath
    ) {
      closeLocalImageViewer();
    }
  }, [closeLocalImageViewer, currentPath, isLocalImageViewerOpen]);

  useEffect(() => {
    if (!isLocalVideoViewerOpen) {
      return;
    }

    if (
      localVideoViewerOpenedPathRef.current &&
      localVideoViewerOpenedPathRef.current !== currentPath
    ) {
      closeLocalVideoViewer();
    }
  }, [closeLocalVideoViewer, currentPath, isLocalVideoViewerOpen]);

  return {
    isMediaViewerOpen,
    mediaViewerItems,
    mediaViewerIndex,
    mediaViewerThumbnailSrc,
    mediaViewerSrc,
    mediaViewerError,
    isMediaViewerLoading,
    isLocalImageViewerOpen,
    localImageViewerItems,
    localImageViewerIndex,
    isLocalVideoViewerOpen,
    localVideoViewerFile,
    audioPlayerSrc,
    audioPlayerLoading,
    currentMediaViewerFile,
    currentMediaKind,
    canGoToPreviousMedia,
    canGoToNextMedia,
    currentLocalImageFile,
    localImageSrc,
    canGoToPreviousLocalImage,
    canGoToNextLocalImage,
    localVideoSrc,
    closeSavedMediaViewer,
    closeLocalImageViewer,
    closeLocalVideoViewer,
    closeAudioPlayer,
    openSavedMediaViewer,
    openLocalImageViewer,
    openLocalVideoViewer,
    openSavedAudioPlayer,
    openLocalAudioPlayer,
    applyFetchedThumbnail,
    ensureThumbnailForFile,
    isLocalImageFile,
    isLocalVideoFile,
    isLocalAudioFile,
    goToPreviousMedia,
    goToNextMedia,
    goToPreviousLocalImage,
    goToNextLocalImage,
  };
}
