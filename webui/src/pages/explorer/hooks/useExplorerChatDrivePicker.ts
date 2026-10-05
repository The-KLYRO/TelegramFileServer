import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "@/hooks/use-toast";
import {
  STORAGE_KEY_CHAT_DRIVE,
  STORAGE_KEY_CHAT_DRIVES,
  type ChatDriveCandidate,
  type TelegramChatSummaryDto,
} from "@/pages/explorer/shared";

type Args = {
  attemptedChatDriveAutoIndexRef: MutableRefObject<Set<number>>;
  isOfflineRef: MutableRefObject<boolean>;
  navigateToPath: (path: string) => Promise<void> | void;
};

export function useExplorerChatDrivePicker({
  attemptedChatDriveAutoIndexRef,
  isOfflineRef,
  navigateToPath,
}: Args) {
  const [isChatDrivePickerOpen, setIsChatDrivePickerOpen] = useState(false);
  const [chatDriveCandidates, setChatDriveCandidates] = useState<
    ChatDriveCandidate[]
  >([]);
  const [isChatDriveCandidatesLoading, setIsChatDriveCandidatesLoading] =
    useState(false);
  const [chatDriveCandidatesQuery, setChatDriveCandidatesQuery] = useState("");
  const [pendingChatDriveCandidate, setPendingChatDriveCandidate] =
    useState<ChatDriveCandidate | null>(null);
  const chatDriveCandidatesFetchSeqRef = useRef(0);

  useEffect(() => {
    const handler = () => {
      setIsChatDrivePickerOpen(true);
    };
    window.addEventListener(
      "open-chat-drive-picker",
      handler as unknown as EventListener,
    );
    return () => {
      window.removeEventListener(
        "open-chat-drive-picker",
        handler as unknown as EventListener,
      );
    };
  }, []);

  useEffect(() => {
    if (!isChatDrivePickerOpen) {
      setPendingChatDriveCandidate(null);
      setChatDriveCandidatesQuery("");
      return;
    }
    if (isOfflineRef.current) {
      setChatDriveCandidates([]);
      setIsChatDriveCandidatesLoading(false);
      return;
    }
    const seq = (chatDriveCandidatesFetchSeqRef.current += 1);
    setIsChatDriveCandidatesLoading(true);
    invoke<TelegramChatSummaryDto[]>("tg_list_group_channel_chats")
      .then((rows) => {
        if (chatDriveCandidatesFetchSeqRef.current !== seq) return;
        const mapped: ChatDriveCandidate[] = (Array.isArray(rows) ? rows : [])
          .map((row) => ({
            id: Number(row.id),
            title: String(row.title || ""),
            kind: String(row.kind || "").trim() || undefined,
            profilePhoto:
              typeof row.profile_photo === "string" ? row.profile_photo : null,
          }))
          .filter((row) => {
            if (!Number.isSafeInteger(row.id) || row.id === 0 || !row.title)
              return false;
            if (row.id < 0) return true;
            const kind = (row.kind || "").toLowerCase();
            return (
              kind.includes("group") ||
              kind.includes("supergroup") ||
              kind.includes("channel")
            );
          })
          .sort((a, b) => a.title.localeCompare(b.title));
        setChatDriveCandidates(mapped);
      })
      .catch((error) => {
        if (chatDriveCandidatesFetchSeqRef.current !== seq) return;
        const typedError = error as { message?: string };
        console.error("Failed to list chat drive candidates:", error);
        toast({
          title: "Couldn't load chats",
          description: typedError?.message || "Please try again.",
          variant: "destructive",
        });
        setChatDriveCandidates([]);
      })
      .finally(() => {
        if (chatDriveCandidatesFetchSeqRef.current !== seq) return;
        setIsChatDriveCandidatesLoading(false);
      });
  }, [isChatDrivePickerOpen, isOfflineRef]);

  const handleConfirmChatDriveCandidate = useCallback(
    (candidate: ChatDriveCandidate) => {
      setIsChatDrivePickerOpen(false);

      const stored = {
        id: candidate.id,
        title: candidate.title,
        kind: candidate.kind,
        profilePhoto: candidate.profilePhoto ?? null,
      };

      void invoke<
        Array<{
          id: number;
          title: string;
          kind: string;
          profile_photo?: string | null;
        }>
      >("tg_add_chat_drive", {
        chat: {
          id: candidate.id,
          title: candidate.title,
          kind: candidate.kind ?? "chat",
          profile_photo: candidate.profilePhoto ?? null,
        },
      })
        .then((rows) => {
          const mapped = (Array.isArray(rows) ? rows : [])
            .map((row) => ({
              id: Number(row.id),
              title: String(row.title || ""),
              kind: String(row.kind || "").trim() || undefined,
              profilePhoto:
                typeof row.profile_photo === "string"
                  ? row.profile_photo
                  : null,
            }))
            .filter(
              (row) =>
                Number.isSafeInteger(row.id) &&
                row.id !== 0 &&
                row.title.trim(),
            );
          try {
            window.localStorage.setItem(
              STORAGE_KEY_CHAT_DRIVES,
              JSON.stringify(mapped),
            );
          } catch {
            // ignore
          }
          window.dispatchEvent(
            new CustomEvent("chat-drives-updated", { detail: mapped }),
          );
        })
        .catch(() => {
          // ignore
        })
        .finally(() => {
          try {
            window.localStorage.setItem(
              STORAGE_KEY_CHAT_DRIVE,
              JSON.stringify(stored),
            );
          } catch {
            // ignore
          }
          window.dispatchEvent(
            new CustomEvent("chat-drive-updated", { detail: stored }),
          );
        });

      void navigateToPath(`tg://drive/${candidate.id}`);
      attemptedChatDriveAutoIndexRef.current.add(candidate.id);
      void invoke("tg_index_chat_drive", {
        args: {
          chatId: candidate.id,
          maxMessages: 25000,
        },
      }).catch((error) => {
        console.error(
          "Failed to start chat drive indexing:",
          (error as { message?: string })?.message || error,
        );
      });
    },
    [attemptedChatDriveAutoIndexRef, navigateToPath],
  );

  return {
    chatDriveCandidates,
    chatDriveCandidatesQuery,
    handleConfirmChatDriveCandidate,
    isChatDriveCandidatesLoading,
    isChatDrivePickerOpen,
    pendingChatDriveCandidate,
    setChatDriveCandidatesQuery,
    setIsChatDrivePickerOpen,
    setPendingChatDriveCandidate,
  };
}
