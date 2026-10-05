import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { UploadManager } from "@/lib/upload-manager";
import {
  TRANSFER_SPEED_STALE_MS,
  TRANSFER_SPEED_UPDATE_INTERVAL_MS,
  UPLOAD_PROGRESS_ANIMATION_MS,
  type DownloadProgressPayload,
  type UploadProgressPayload,
  type UploadProgressState,
  type UploadQueueItemState,
  formatTransferSpeed,
  getDownloadStageLabel,
  getUploadQueueStatusLabel,
  isRecycleBinPath,
  isUploadQueueItemInProgress,
  savedToVirtualPath,
  virtualToSavedPath,
} from "@/pages/explorer/shared";

export function useExplorerTransfers() {
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [uploadProgress, setUploadProgress] =
    useState<UploadProgressState | null>(null);
  const [uploadActiveTargetPath, setUploadActiveTargetPath] = useState<
    string | null
  >(null);
  const [uploadActivePlaceholderPath, setUploadActivePlaceholderPath] =
    useState<string | null>(null);
  const [uploadQueueItems, setUploadQueueItems] = useState<
    UploadQueueItemState[]
  >([]);
  const [isUploadProgressMounted, setIsUploadProgressMounted] = useState(false);
  const [isUploadProgressVisible, setIsUploadProgressVisible] = useState(false);
  const [uploadSpeedBytesPerSecond, setUploadSpeedBytesPerSecond] = useState(0);
  const [activeDownload, setActiveDownload] =
    useState<DownloadProgressPayload | null>(null);
  const [downloadSpeedBytesPerSecond, setDownloadSpeedBytesPerSecond] =
    useState(0);
  const [isTransferMenuOpen, setIsTransferMenuOpen] = useState(false);

  const uploadManagerRef = useRef<UploadManager | null>(null);
  const uploadManagerWasUploadingRef = useRef(false);
  const transferMenuRef = useRef<HTMLDivElement | null>(null);
  const transferMenuTriggerRef = useRef<HTMLDivElement | null>(null);
  const uploadProgressHideTimerRef = useRef<number | null>(null);
  const uploadProgressEnterFrameRef = useRef<number | null>(null);
  const uploadSpeedSampleRef = useRef({
    uploadKey: null as string | null,
    latestBytes: 0,
    latestAt: 0,
  });

  const clearUploadProgressTimers = useCallback(() => {
    if (uploadProgressHideTimerRef.current !== null) {
      window.clearTimeout(uploadProgressHideTimerRef.current);
      uploadProgressHideTimerRef.current = null;
    }

    if (uploadProgressEnterFrameRef.current !== null) {
      window.cancelAnimationFrame(uploadProgressEnterFrameRef.current);
      uploadProgressEnterFrameRef.current = null;
    }
  }, []);

  const resetUploadSpeedTracking = useCallback(() => {
    uploadSpeedSampleRef.current = {
      uploadKey: null,
      latestBytes: 0,
      latestAt: 0,
    };
    setUploadSpeedBytesPerSecond(0);
  }, []);

  const resetDownloadSpeedTracking = useCallback(() => {
    setDownloadSpeedBytesPerSecond(0);
  }, []);

  const trackUploadSpeedSample = useCallback(
    (payload: UploadProgressPayload) => {
      const now = Date.now();
      const sample = uploadSpeedSampleRef.current;
      const uploadKey =
        payload.uploadId ||
        `${payload.fileId || "unknown"}:${payload.fileName}`;
      const uploadedBytes = Math.max(0, Number(payload.uploadedBytes ?? 0));

      if (
        sample.uploadKey !== uploadKey ||
        uploadedBytes < sample.latestBytes ||
        sample.latestAt <= 0
      ) {
        sample.uploadKey = uploadKey;
        sample.latestBytes = uploadedBytes;
        sample.latestAt = now;
        setUploadSpeedBytesPerSecond(0);
        return;
      }

      const deltaBytes = uploadedBytes - sample.latestBytes;
      const deltaMs = now - sample.latestAt;

      sample.latestBytes = uploadedBytes;
      sample.latestAt = now;

      if (["completed", "failed", "cancelled"].includes(payload.stage)) {
        setUploadSpeedBytesPerSecond(0);
        return;
      }

      const payloadSpeed = Number(payload.bytesPerSecond);
      if (Number.isFinite(payloadSpeed) && payloadSpeed > 0) {
        setUploadSpeedBytesPerSecond((prev) =>
          prev > 0 ? prev * 0.25 + payloadSpeed * 0.75 : payloadSpeed,
        );
        return;
      }

      if (deltaBytes > 0 && deltaMs > 0) {
        const instantSpeed = (deltaBytes * 1000) / deltaMs;
        setUploadSpeedBytesPerSecond((prev) =>
          prev > 0 ? prev * 0.25 + instantSpeed * 0.75 : instantSpeed,
        );
      }
    },
    [],
  );

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    void listen<UploadProgressPayload>("tg-upload-progress", (event) => {
      trackUploadSpeedSample(event.payload);
    })
      .then((dispose) => {
        unlisten = dispose;
      })
      .catch((error) => {
        console.error("Failed to listen for upload speed updates:", error);
      });

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [trackUploadSpeedSample]);

  const trackDownloadSpeedSample = useCallback(
    (payload: DownloadProgressPayload) => {
      if (
        payload.stage === "completed" ||
        payload.stage === "failed" ||
        payload.stage === "cancelled"
      ) {
        setDownloadSpeedBytesPerSecond(0);
        return;
      }

      if (payload.stage !== "downloading") {
        return;
      }

      const payloadSpeed = Number(payload.bytesPerSecond);
      if (Number.isFinite(payloadSpeed) && payloadSpeed > 0) {
        setDownloadSpeedBytesPerSecond(payloadSpeed);
      }
    },
    [],
  );

  useEffect(() => {
    const manager = new UploadManager({
      concurrency: 3,
      virtualToSavedPath,
      savedToVirtualPath,
      isRecycleBinVirtualPath: isRecycleBinPath,
    });
    uploadManagerRef.current = manager;

    let unsubscribe: (() => void) | null = null;
    void manager.init().then(() => {
      unsubscribe = manager.subscribe((snap) => {
        setUploadActiveTargetPath(snap.activeTargetVirtualPath);
        setUploadActivePlaceholderPath(snap.activePlaceholderVirtualPath);
        setUploadQueueItems(
          snap.items.map((item) => ({
            id: item.id,
            fileName: item.relativePath || item.fileName,
            status: item.status,
            progress: item.progress,
            message: item.message,
            destinationVirtualPath: item.destinationVirtualPath,
          })),
        );
        setUploadProgress(snap.progress);
        setIsUploadingFiles(snap.isUploading);

        const wasUploading = uploadManagerWasUploadingRef.current;
        uploadManagerWasUploadingRef.current = snap.isUploading;

        if (snap.isUploading && !wasUploading) {
          clearUploadProgressTimers();
          setIsUploadProgressMounted(true);
          setIsUploadProgressVisible(false);
          uploadProgressEnterFrameRef.current = window.requestAnimationFrame(
            () => {
              setIsUploadProgressVisible(true);
              uploadProgressEnterFrameRef.current = null;
            },
          );
        }

        if (!snap.isUploading && wasUploading) {
          uploadProgressHideTimerRef.current = window.setTimeout(() => {
            setIsUploadProgressVisible(false);
            uploadProgressHideTimerRef.current = window.setTimeout(() => {
              setIsUploadProgressMounted(false);
              setUploadProgress(null);
              setUploadQueueItems([]);
              setUploadSpeedBytesPerSecond(0);
              uploadProgressHideTimerRef.current = null;
            }, UPLOAD_PROGRESS_ANIMATION_MS);
          }, 5000);
        }
      });
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      clearUploadProgressTimers();
      manager.dispose();
      uploadManagerRef.current = null;
    };
  }, [clearUploadProgressTimers]);

  useEffect(() => {
    if (!isUploadingFiles) {
      return;
    }

    setUploadProgress((prev) => {
      if (!prev) {
        return prev;
      }

      const uploadedFiles = uploadQueueItems.filter(
        (item) => item.status === "completed",
      ).length;
      const failedFiles = uploadQueueItems.filter(
        (item) => item.status === "failed",
      ).length;
      const cancelledFiles = uploadQueueItems.filter(
        (item) => item.status === "cancelled",
      ).length;

      return {
        ...prev,
        totalFiles: uploadQueueItems.length,
        uploadedFiles,
        failedFiles,
        cancelledFiles,
      };
    });
  }, [isUploadingFiles, uploadQueueItems]);

  useEffect(() => {
    if (!isUploadingFiles) {
      setUploadSpeedBytesPerSecond(0);
      return;
    }

    const interval = window.setInterval(() => {
      const sample = uploadSpeedSampleRef.current;
      const now = Date.now();

      if (sample.latestAt <= 0) {
        setUploadSpeedBytesPerSecond(0);
        return;
      }

      if (now - sample.latestAt >= TRANSFER_SPEED_STALE_MS) {
        setUploadSpeedBytesPerSecond(0);
      }
    }, TRANSFER_SPEED_UPDATE_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [isUploadingFiles]);

  useEffect(() => {
    if (!activeDownload) {
      return;
    }

    if (!["completed", "failed", "cancelled"].includes(activeDownload.stage)) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setActiveDownload((prev) => {
        if (!prev || prev.sourcePath !== activeDownload.sourcePath) {
          return prev;
        }

        return null;
      });
    }, 2500);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [activeDownload]);

  const uploadProcessedFiles = uploadProgress
    ? uploadProgress.uploadedFiles +
      uploadProgress.failedFiles +
      uploadProgress.cancelledFiles
    : 0;
  const uploadToolbarItem = useMemo(() => {
    if (!uploadQueueItems.length) {
      return null;
    }

    const inProgressItem = uploadQueueItems.find((item) =>
      isUploadQueueItemInProgress(item.status),
    );
    if (inProgressItem) {
      return inProgressItem;
    }

    const queuedItem = uploadQueueItems.find(
      (item) => item.status === "queued",
    );
    if (queuedItem) {
      return queuedItem;
    }

    for (let index = uploadQueueItems.length - 1; index >= 0; index -= 1) {
      const item = uploadQueueItems[index];
      if (item.status !== "queued") {
        return item;
      }
    }

    return uploadQueueItems[0];
  }, [uploadQueueItems]);
  const uploadToolbarPercent = uploadToolbarItem
    ? Math.min(100, Math.max(0, Math.round(uploadToolbarItem.progress)))
    : 0;
  const uploadToolbarProgressLabel = uploadProgress
    ? `${uploadProcessedFiles}/${uploadProgress.totalFiles} files`
    : "";
  const isUploadInProgress =
    isUploadingFiles &&
    uploadQueueItems.some((item) => isUploadQueueItemInProgress(item.status));
  const uploadSpeedLabel = formatTransferSpeed(uploadSpeedBytesPerSecond);
  const uploadToolbarLabel = uploadToolbarProgressLabel
    ? `${isUploadInProgress ? `${uploadSpeedLabel} | ` : ""}${uploadToolbarProgressLabel}`
    : uploadSpeedLabel;
  const uploadToolbarTitle = uploadToolbarItem
    ? `${uploadToolbarItem.fileName} - ${getUploadQueueStatusLabel(uploadToolbarItem.status)}${uploadToolbarProgressLabel ? ` (${uploadToolbarProgressLabel})` : ""}`
    : "";
  const downloadProgressPercent = activeDownload
    ? Math.min(100, Math.max(0, Math.round(activeDownload.progress)))
    : 0;
  const downloadProgressLabel = activeDownload
    ? getDownloadStageLabel(activeDownload.stage)
    : "";
  const downloadDetailMessage = activeDownload?.message?.trim();
  const downloadSpeedLabel = formatTransferSpeed(downloadSpeedBytesPerSecond);
  const downloadToolbarLabel = activeDownload
    ? activeDownload.stage === "downloading"
      ? `${downloadSpeedLabel} | ${downloadProgressLabel}`
      : downloadProgressLabel
    : "";
  const hasTransferEntries = !!activeDownload || uploadQueueItems.length > 0;
  const canCancelDownload =
    !!activeDownload &&
    !["completed", "failed", "cancelled"].includes(activeDownload.stage);
  const canCancelUploads =
    isUploadingFiles &&
    uploadQueueItems.some(
      (item) =>
        item.status === "queued" || isUploadQueueItemInProgress(item.status),
    );
  const transferUploadItems = useMemo(
    () =>
      uploadQueueItems.map((item) => {
        const statusLabel = getUploadQueueStatusLabel(item.status);
        const isInProgress = isUploadQueueItemInProgress(item.status);

        return {
          id: item.id,
          fileName: item.fileName,
          statusLabel,
          message: item.message,
          progress: item.progress,
          isInProgress,
          trailingLabel: isInProgress
            ? `${Math.round(item.progress)}%`
            : statusLabel,
        };
      }),
    [uploadQueueItems],
  );

  return {
    activeDownload,
    canCancelDownload,
    canCancelUploads,
    clearUploadProgressTimers,
    downloadDetailMessage,
    downloadProgressPercent,
    downloadToolbarLabel,
    hasTransferEntries,
    isTransferMenuOpen,
    isUploadInProgress,
    isUploadProgressMounted,
    isUploadProgressVisible,
    isUploadingFiles,
    resetDownloadSpeedTracking,
    resetUploadSpeedTracking,
    setActiveDownload,
    setIsTransferMenuOpen,
    setUploadActivePlaceholderPath,
    setUploadActiveTargetPath,
    setUploadProgress,
    setUploadQueueItems,
    trackDownloadSpeedSample,
    trackUploadSpeedSample,
    transferMenuRef,
    transferMenuTriggerRef,
    transferUploadItems,
    uploadActivePlaceholderPath,
    uploadActiveTargetPath,
    uploadManagerRef,
    uploadProgress,
    uploadQueueItems,
    uploadToolbarItem,
    uploadToolbarLabel,
    uploadToolbarPercent,
    uploadToolbarTitle,
  };
}
