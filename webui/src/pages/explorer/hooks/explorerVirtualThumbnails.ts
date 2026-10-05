import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import { invoke } from "@tauri-apps/api/core";
import { resolveThumbnailSrc } from "@/lib/thumbnail-src";
import { type FileItem } from "@/components/skybox/FileRow";
import { isDriveVirtualFolderPath } from "@/pages/explorer/shared";

type Args = {
  applyFetchedThumbnailRef: MutableRefObject<
    (messageId: number, thumbnailSrc: string) => void
  >;
  currentPathRef: MutableRefObject<string>;
  filesRef: MutableRefObject<FileItem[]>;
};

export function useExplorerVirtualThumbnails({
  applyFetchedThumbnailRef,
  currentPathRef,
  filesRef,
}: Args) {
  const prefetchedThumbnailIdsRef = useRef<Set<number>>(new Set());
  const thumbnailRetryCountsRef = useRef<Map<number, number>>(new Map());
  const thumbnailRetryTimerRef = useRef<number | null>(null);
  const prefetchedChatDriveThumbnailKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    return () => {
      if (thumbnailRetryTimerRef.current !== null) {
        window.clearTimeout(thumbnailRetryTimerRef.current);
      }
    };
  }, []);

  const prefetchThumbnailsForItems = useCallback(
    (items: FileItem[]) => {
      if (isDriveVirtualFolderPath(currentPathRef.current)) {
        const pairs = items
          .map((item) => ({ chatId: item.chatId, messageId: item.messageId }))
          .filter(
            (item): item is { chatId: number; messageId: number } =>
              typeof item.chatId === "number" &&
              Number.isFinite(item.chatId) &&
              item.chatId !== 0 &&
              typeof item.messageId === "number" &&
              item.messageId > 0,
          )
          .filter((item) => {
            const key = `${item.chatId}:${item.messageId}`;
            return !prefetchedChatDriveThumbnailKeysRef.current.has(key);
          });

        if (!pairs.length) return;

        pairs.forEach((item) =>
          prefetchedChatDriveThumbnailKeysRef.current.add(
            `${item.chatId}:${item.messageId}`,
          ),
        );

        invoke<{
          thumbnails?: Array<{
            chat_id: number;
            message_id: number;
            thumbnail: string;
          }>;
        }>("tg_prefetch_chat_message_thumbnails", {
          args: {
            items: pairs.map((item) => ({
              chatId: item.chatId,
              messageId: item.messageId,
            })),
          },
        })
          .then((result) => {
            const fetched = result?.thumbnails ?? [];
            for (const entry of fetched) {
              if (!entry || typeof entry.message_id !== "number") continue;
              const thumbnail = entry.thumbnail?.trim();
              if (!thumbnail) continue;
              const resolved = resolveThumbnailSrc(thumbnail);
              if (!resolved) continue;
              applyFetchedThumbnailRef.current(entry.message_id, resolved);
            }
          })
          .catch((error) => {
            console.error(
              "Failed to prefetch chat drive thumbnails:",
              (error as { message?: string })?.message || error,
            );
            pairs.forEach((item) =>
              prefetchedChatDriveThumbnailKeysRef.current.delete(
                `${item.chatId}:${item.messageId}`,
              ),
            );
          });
        return;
      }

      const messageIds = items
        .map((item) => item.messageId)
        .filter((id): id is number => !!id && id > 0)
        .filter((id) => !prefetchedThumbnailIdsRef.current.has(id));
      if (!messageIds.length) return;

      messageIds.forEach((id) => prefetchedThumbnailIdsRef.current.add(id));

      invoke<{
        thumbnails?: Array<{ message_id: number; thumbnail: string }>;
      }>("tg_prefetch_message_thumbnails", { messageIds })
        .then((result) => {
          const fetched = result?.thumbnails ?? [];
          const fetchedIds = new Set<number>();
          for (const entry of fetched) {
            if (!entry || typeof entry.message_id !== "number") continue;
            fetchedIds.add(entry.message_id);
            const thumbnail = entry.thumbnail?.trim();
            if (!thumbnail) continue;
            applyFetchedThumbnailRef.current(entry.message_id, thumbnail);
          }

          const missing = messageIds.filter((id) => !fetchedIds.has(id));
          if (!missing.length) return;

          for (const id of missing) {
            const attempts = (thumbnailRetryCountsRef.current.get(id) ?? 0) + 1;
            thumbnailRetryCountsRef.current.set(id, attempts);
            if (attempts <= 6) {
              prefetchedThumbnailIdsRef.current.delete(id);
            }
          }

          if (thumbnailRetryTimerRef.current === null) {
            thumbnailRetryTimerRef.current = window.setTimeout(() => {
              thumbnailRetryTimerRef.current = null;
              const retryItems = filesRef.current.filter((item) =>
                item.messageId
                  ? missing.includes(item.messageId) &&
                    (thumbnailRetryCountsRef.current.get(item.messageId) ??
                      0) <= 6
                  : false,
              );
              if (retryItems.length) {
                prefetchThumbnailsForItems(retryItems);
              }
            }, 1500);
          }
        })
        .catch((error) => {
          console.error("Failed to prefetch message thumbnails:", error);
          messageIds.forEach((id) =>
            prefetchedThumbnailIdsRef.current.delete(id),
          );
        });
    },
    [applyFetchedThumbnailRef, currentPathRef, filesRef],
  );

  return { prefetchThumbnailsForItems };
}
