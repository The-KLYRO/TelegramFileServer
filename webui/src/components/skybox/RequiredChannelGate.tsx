import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { TelegramButton } from "@/components/skybox/TelegramButton";
import { Checkbox } from "@/components/ui/checkbox";
import type { RequiredChannelConfig } from "@/lib/required-channel";

interface RequiredChannelGateProps {
  isOpen: boolean;
  config: RequiredChannelConfig | null;
  onMembershipConfirmed: () => void;
}

export function RequiredChannelGate({
  isOpen,
  config,
  onMembershipConfirmed,
}: RequiredChannelGateProps) {
  const [isJoining, setIsJoining] = useState(false);
  const [hasAgreed, setHasAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inviteLink = useMemo(
    () => config?.inviteLink || "",
    [config?.inviteLink],
  );
  const chatTitle = useMemo(() => config?.chatTitle || "", [config?.chatTitle]);
  const chatId = useMemo(() => config?.chatId || 0, [config?.chatId]);
  useEffect(() => {
    if (!isOpen) {
      setHasAgreed(false);
      setError(null);
      setIsJoining(false);
    }
  }, [isOpen]);

  const handleJoin = useCallback(async () => {
    if (!config || !hasAgreed) {
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      await invoke("tg_join_channel", {
        chatId,
        inviteLink,
      });

      // Close optimistically; Explorer will re-check and re-open if needed.
      onMembershipConfirmed();
    } catch (e) {
      const message =
        typeof e === "object" && e && "message" in e
          ? String((e as { message?: unknown }).message)
          : "";
      setError(message || "Failed to join channel");
    } finally {
      setIsJoining(false);
    }
  }, [chatId, config, hasAgreed, inviteLink, onMembershipConfirmed]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 top-[var(--titlebar-height)] z-[95] flex items-center justify-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-md animate-fade-in" />

      <div className="relative mx-4 flex max-h-[min(82vh,720px)] w-[min(92vw,560px)] flex-col overflow-hidden rounded-2xl border border-white/15 bg-[linear-gradient(180deg,rgba(23,27,34,0.94)_0%,rgba(13,16,22,0.96)_100%)] shadow-2xl shadow-black/60 backdrop-blur-2xl backdrop-saturate-150 animate-scale-in">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(107,138,255,0.12),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(28,180,152,0.1),transparent_34%)]" />

        <div className="relative border-b border-white/10 bg-black/15 p-5 backdrop-blur-xl">
          <div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-foreground/70">
            Privacy Notice
          </div>
          <h2 className="mt-3 text-lg font-semibold text-foreground">
            Before you continue
          </h2>
          <p className="mt-2 text-sm leading-6 text-foreground/90">
            SkyBox requires membership in the official Telegram channel to keep
            access notices and service updates visible inside your own Telegram
            account.
          </p>
          {chatTitle ? (
            <p className="mt-3 truncate text-xs uppercase tracking-[0.2em] text-foreground/55">
              Required channel - {chatTitle}
            </p>
          ) : null}
        </div>

        <div className="relative flex-1 space-y-4 overflow-y-auto p-5">
          <div className="rounded-2xl border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.03)_100%)] p-4 backdrop-blur-xl">
            <div className="space-y-3 text-sm leading-6 text-foreground/88">
              <p>
                SkyBox connects directly with Telegram servers through your own
                Telegram session.
              </p>
              <p>
                There is no SkyBox relay server between you and Telegram for
                this step, and your account data stays inside that Telegram
                connection instead of passing through a separate middle server.
              </p>
              <p>
                If your account has left the required channel, SkyBox will use
                your current Telegram session to join it again so Explorer can
                continue.
              </p>
              <p>
                If you leave the channel again later, SkyBox can ask you to
                confirm this notice again before Explorer access continues.
              </p>
            </div>
          </div>

          <label className="flex items-start gap-3 px-1 text-sm leading-6 text-foreground/92 select-none">
            <Checkbox
              checked={hasAgreed}
              onCheckedChange={(checked) => setHasAgreed(checked === true)}
              className="mt-1 border-white/30 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
            />
            <span>
              I have read this notice and agree that SkyBox may continue with
              the required Telegram channel check for my account.
            </span>
          </label>

          {error ? (
            <p className="text-small break-words text-destructive">{error}</p>
          ) : null}
        </div>

        <div className="relative border-t border-white/10 bg-black/20 p-5 backdrop-blur-xl">
          <TelegramButton
            onClick={() => {
              void handleJoin();
            }}
            disabled={!config || !hasAgreed}
            loading={isJoining}
            fullWidth
          >
            OK
          </TelegramButton>
        </div>
      </div>
    </div>
  );
}
