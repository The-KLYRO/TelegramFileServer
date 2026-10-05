import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { format, formatDistanceToNowStrict } from "date-fns";
import { Bell, X } from "lucide-react";
import type { RequiredChannelNotificationItem } from "@/lib/required-channel-notifications";
import { resolveThumbnailSrc } from "@/lib/thumbnail-src";
import { invoke } from "@tauri-apps/api/core";

type FormattedText = NonNullable<
  RequiredChannelNotificationItem["formattedText"]
>;

const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function hasRenderableFormattedText(
  formattedText?: RequiredChannelNotificationItem["formattedText"],
): formattedText is FormattedText {
  return (
    isNonEmptyString(formattedText?.text) &&
    formattedText.text.trim().length > 0
  );
}

async function openExternalUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return;
  if (isTauri) {
    try {
      await invoke("plugin:shell|open", { path: trimmed });
    } catch {
      // Avoid falling back to `window.open` in Tauri, which can double-open.
    }
    return;
  }

  window.open(trimmed, "_blank", "noopener,noreferrer");
}

function renderFormattedText(formatted: FormattedText) {
  const text = isNonEmptyString(formatted.text) ? formatted.text : "";
  const entities = Array.isArray(formatted.entities) ? formatted.entities : [];
  const sorted = entities
    .filter(
      (entity): entity is (typeof entities)[number] =>
        entity &&
        typeof entity.offset === "number" &&
        typeof entity.length === "number" &&
        entity.length > 0 &&
        Number.isFinite(entity.offset) &&
        Number.isFinite(entity.length) &&
        typeof entity.type === "object" &&
        entity.type !== null,
    )
    .slice()
    .sort((a, b) => a.offset - b.offset);

  // Entities can overlap (nested formats, spoiler + link, etc.). This renderer only supports
  // non-overlapping ranges; when we detect overlaps we fall back to plain text so content
  // is always visible (spoilers/quotes included).
  {
    let endCursor = 0;
    for (const entity of sorted) {
      const start = Math.max(0, entity.offset);
      const end = Math.min(text.length, start + entity.length);
      if (end <= start) continue;
      if (start < endCursor) {
        return text;
      }
      endCursor = end;
    }
  }

  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const entity of sorted) {
    const start = Math.max(0, entity.offset);
    const end = Math.min(text.length, start + entity.length);
    if (end <= cursor) {
      continue;
    }
    if (start > cursor) {
      nodes.push(text.slice(cursor, start));
    }

    const slice = text.slice(start, end);
    const kind = (entity.type as { "@type"?: unknown })["@type"];
    const kindText = typeof kind === "string" ? kind : "";

    switch (kindText) {
      case "textEntityTypeBold":
        nodes.push(<strong key={`${start}:${end}`}>{slice}</strong>);
        break;
      case "textEntityTypeItalic":
        nodes.push(<em key={`${start}:${end}`}>{slice}</em>);
        break;
      case "textEntityTypeUnderline":
        nodes.push(
          <span key={`${start}:${end}`} className="underline">
            {slice}
          </span>,
        );
        break;
      case "textEntityTypeStrikethrough":
        nodes.push(
          <span key={`${start}:${end}`} className="line-through">
            {slice}
          </span>,
        );
        break;
      case "textEntityTypeCode":
        nodes.push(
          <code
            key={`${start}:${end}`}
            className="font-mono text-[12px] bg-secondary/60 px-1 py-0.5 rounded"
          >
            {slice}
          </code>,
        );
        break;
      case "textEntityTypePre":
      case "textEntityTypePreCode":
        nodes.push(
          <pre
            key={`${start}:${end}`}
            className="mt-2 whitespace-pre-wrap break-words font-mono text-[12px] bg-secondary/40 border border-border rounded-md p-2"
          >
            {slice}
          </pre>,
        );
        break;
      case "textEntityTypeSpoiler":
        nodes.push(
          <span
            key={`${start}:${end}`}
            className="rounded bg-secondary/50 px-1"
          >
            {slice}
          </span>,
        );
        break;
      case "textEntityTypeBlockQuote":
      case "textEntityTypeExpandableBlockQuote":
        nodes.push(
          <blockquote
            key={`${start}:${end}`}
            className="my-1 border-l-2 border-primary/40 pl-3 py-1 bg-secondary/20 rounded-r whitespace-pre-wrap"
          >
            {slice}
          </blockquote>,
        );
        break;
      case "textEntityTypeTextUrl": {
        const url = (entity.type as { url?: unknown }).url;
        const href = typeof url === "string" ? url : "";
        nodes.push(
          <a
            key={`${start}:${end}`}
            href={href || undefined}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-primary/60 hover:decoration-primary"
            onClick={(event) => {
              if (!href) return;
              event.preventDefault();
              event.stopPropagation();
              void openExternalUrl(href);
            }}
          >
            {slice}
          </a>,
        );
        break;
      }
      case "textEntityTypeUrl":
        nodes.push(
          <a
            key={`${start}:${end}`}
            href={slice}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-primary/60 hover:decoration-primary"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void openExternalUrl(slice);
            }}
          >
            {slice}
          </a>,
        );
        break;
      default:
        nodes.push(<span key={`${start}:${end}`}>{slice}</span>);
        break;
    }

    cursor = end;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes.length ? nodes : text;
}

type Props = {
  isOpen: boolean;
  channelTitle: string;
  notifications: RequiredChannelNotificationItem[];
  onClose: () => void;
  triggerRef?: RefObject<HTMLElement | null>;
};

export function NotificationWidget({
  isOpen,
  channelTitle,
  notifications,
  onClose,
  triggerRef,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!isOpen) return;
    setNowMs(Date.now());
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (containerRef.current?.contains(target)) return;
      if (triggerRef?.current?.contains(target)) return;
      onClose();
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [isOpen, onClose, triggerRef]);

  const content = useMemo(() => {
    if (!notifications.length) {
      return (
        <div className="flex h-[360px] flex-col items-center justify-center gap-3 text-center px-6">
          <div className="h-11 w-11 rounded-full bg-secondary flex items-center justify-center">
            <Bell className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-body text-foreground">No notifications yet</p>
            <p className="text-small text-muted-foreground">
              New channel posts will show up here.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="max-h-[420px] overflow-y-auto p-3 space-y-3">
        {notifications.map((item) => {
          const createdAt = new Date(item.createdAtMs);
          const ageMs = nowMs - item.createdAtMs;
          const timeLabel =
            ageMs >= 60 * 60 * 1000
              ? format(createdAt, "hh.mm a yyyy-MM-dd")
              : formatDistanceToNowStrict(createdAt, {
                  addSuffix: true,
                });

          return (
            <div
              key={item.id}
              className="rounded-xl border border-border bg-secondary/10 overflow-hidden"
            >
              {item.previewImage ? (
                <div className="w-full flex items-center justify-center bg-background/10">
                  <img
                    src={
                      resolveThumbnailSrc(item.previewImage) ??
                      item.previewImage
                    }
                    alt=""
                    className="w-full max-h-[360px] object-contain block"
                    draggable={false}
                  />
                </div>
              ) : null}

              <div
                className={`bg-background/80 px-4 pb-3 ${item.previewImage ? "pt-2" : "pt-3"}`}
              >
                <div className="text-body text-foreground leading-snug whitespace-pre-wrap break-words">
                  {hasRenderableFormattedText(item.formattedText)
                    ? renderFormattedText(item.formattedText)
                    : item.text}
                </div>
                <div className="mt-2 flex justify-end">
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {timeLabel}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }, [notifications, nowMs]);

  if (!isOpen) return null;

  const panel = (
    <div
      ref={containerRef}
      className="fixed right-3 top-[var(--titlebar-height)] z-[120] mt-2 w-[420px] max-w-[calc(100vw-24px)] animate-scale-in"
    >
      <div className="relative">
        <div className="notification-widget-backdrop absolute inset-0 rounded-xl" />
        <div
          role="dialog"
          className="notification-widget-shell relative overflow-hidden rounded-xl shadow-2xl shadow-black/50"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="text-body font-semibold text-foreground">
                Notifications
              </p>
              <p className="text-small max-w-[340px] truncate text-muted-foreground">
                {channelTitle}
              </p>
            </div>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-md transition-colors hover:bg-sidebar-accent/50"
              aria-label="Close notifications"
            >
              <span className="sr-only">Close</span>
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <X className="h-4 w-4" />
              </div>
            </button>
          </div>
          {content}
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return panel;
  }

  const portalTarget = document.getElementById("root") ?? document.body;

  return createPortal(panel, portalTarget);
}
