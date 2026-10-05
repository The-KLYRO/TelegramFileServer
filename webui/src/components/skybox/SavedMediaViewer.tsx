import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import Plyr from "plyr";
import "plyr/dist/plyr.css";
import plyrSpriteUrl from "@/assets/plyr/plyr.svg?url";
import "./saved-media-viewer.css";

type PlyrInstance = {
  destroy: () => void;
  on?: (event: string, callback: () => void) => void;
};

export type SavedMediaKind = "image" | "video" | "audio";

interface SavedMediaViewerProps {
  isOpen: boolean;
  fileName: string;
  mediaKind: SavedMediaKind | null;
  thumbnailSrc?: string | null;
  mediaSrc?: string | null;
  isLoading: boolean;
  error?: string | null;
  canGoPrevious: boolean;
  canGoNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onClose: () => void;
}

interface PlyrMediaProps {
  kind: "video" | "audio";
  src: string;
  onReady?: () => void;
  onBufferingChange?: (value: boolean) => void;
}

function PlyrMedia({ kind, src, onReady, onBufferingChange }: PlyrMediaProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<PlyrInstance | null>(null);
  const onReadyRef = useRef(onReady);
  const onBufferingChangeRef = useRef(onBufferingChange);
  const lastInitErrorKeyRef = useRef<string | null>(null);
  const isReadyRef = useRef(false);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    onBufferingChangeRef.current = onBufferingChange;
  }, [onBufferingChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    playerRef.current?.destroy();
    playerRef.current = null;
    isReadyRef.current = false;

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    if (!src.trim()) {
      onBufferingChangeRef.current?.(false);
      return;
    }

    const target = document.createElement(kind);
    if (kind === "video") {
      (target as HTMLVideoElement).playsInline = true;
      target.className = "h-full w-full";
    } else {
      target.className = "w-full";
    }

    target.controls = false;
    const source = document.createElement("source");
    source.src = src;
    target.appendChild(source);
    container.appendChild(target);

    const setBuffering = (value: boolean) => {
      onBufferingChangeRef.current?.(value);
    };

    const handleWaiting = () => {
      if (!isReadyRef.current) return;
      setBuffering(true);
    };
    const handleStalled = () => {
      if (!isReadyRef.current) return;
      setBuffering(true);
    };
    const handleSeeking = () => {
      if (!isReadyRef.current) return;
      setBuffering(true);
    };
    const handleCanPlay = () => {
      if (!isReadyRef.current) return;
      setBuffering(false);
    };
    const handlePlaying = () => {
      if (!isReadyRef.current) return;
      setBuffering(false);
    };
    const handleSeeked = () => {
      if (!isReadyRef.current) return;
      setBuffering(false);
    };
    const handleLoadedData = () => {
      isReadyRef.current = true;
      setBuffering(false);
      onReadyRef.current?.();
    };

    target.addEventListener("waiting", handleWaiting);
    target.addEventListener("stalled", handleStalled);
    target.addEventListener("seeking", handleSeeking);
    target.addEventListener("canplay", handleCanPlay);
    target.addEventListener("canplaythrough", handleCanPlay);
    target.addEventListener("playing", handlePlaying);
    target.addEventListener("seeked", handleSeeked);
    target.addEventListener("loadeddata", handleLoadedData);

    setBuffering(false);

    try {
      const player = new Plyr(target, {
        resetOnEnd: false,
        hideControls: false,
        keyboard: { focused: true, global: true },
        iconUrl: plyrSpriteUrl,
      }) as unknown as PlyrInstance;

      player.on?.("ready", () => {
        target.controls = false;
        isReadyRef.current = true;
        setBuffering(false);
        onReadyRef.current?.();
      });
      player.on?.("loadedmetadata", () => {
        target.controls = false;
        onReadyRef.current?.();
      });

      // Verify Plyr actually enhanced the element.
      setTimeout(() => {
        const plyrRoot = target.closest(".plyr");
        const controls = plyrRoot?.querySelector(".plyr__controls");
        if (!plyrRoot || !controls) {
          const key = `${kind}:${src}`;
          if (lastInitErrorKeyRef.current !== key) {
            lastInitErrorKeyRef.current = key;
            console.error(
              "Plyr init incomplete (missing .plyr/.plyr__controls); falling back to native controls",
              {
                kind,
                src,
                iconUrl: plyrSpriteUrl,
              },
            );
          }
          try {
            player.destroy();
          } catch {
            // ignore
          }
          playerRef.current = null;
          target.controls = true;
          isReadyRef.current = true;
          setBuffering(false);
          return;
        }

        target.controls = false;
      }, 0);

      playerRef.current = player;
    } catch (error) {
      const key = `${kind}:${src}`;
      if (lastInitErrorKeyRef.current !== key) {
        lastInitErrorKeyRef.current = key;
        console.error(
          "Plyr init failed; falling back to native controls",
          error,
        );
      }
      target.controls = true;
      isReadyRef.current = true;
      setBuffering(false);
    }

    return () => {
      playerRef.current?.destroy();
      playerRef.current = null;

      target.removeEventListener("waiting", handleWaiting);
      target.removeEventListener("stalled", handleStalled);
      target.removeEventListener("seeking", handleSeeking);
      target.removeEventListener("canplay", handleCanPlay);
      target.removeEventListener("canplaythrough", handleCanPlay);
      target.removeEventListener("playing", handlePlaying);
      target.removeEventListener("seeked", handleSeeked);
      target.removeEventListener("loadeddata", handleLoadedData);

      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    };
  }, [kind, src]);

  return (
    <div
      className={kind === "video" ? "h-full w-full" : "w-full"}
      ref={containerRef}
    />
  );
}

export function SavedMediaViewer({
  isOpen,
  fileName,
  mediaKind,
  thumbnailSrc,
  mediaSrc,
  isLoading,
  error,
  canGoPrevious,
  canGoNext,
  onPrevious,
  onNext,
  onClose,
}: SavedMediaViewerProps) {
  const [isPrimaryMediaReady, setIsPrimaryMediaReady] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const performClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    setIsPrimaryMediaReady(false);
    setIsBuffering(false);
  }, [fileName, mediaKind, mediaSrc]);

  useEffect(() => {
    if (!isOpen) {
      setIsPrimaryMediaReady(false);
      setIsBuffering(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    if (mediaKind !== "image" && mediaKind !== "video") {
      return;
    }

    const handleWindowCloseRequest = (event: Event) => {
      event.preventDefault();
      performClose();
    };

    window.addEventListener(
      "skybox-window-close-request",
      handleWindowCloseRequest,
    );
    return () => {
      window.removeEventListener(
        "skybox-window-close-request",
        handleWindowCloseRequest,
      );
    };
  }, [isOpen, mediaKind, performClose]);

  useEffect(() => {
    if (mediaKind === "audio" && mediaSrc && !isLoading) {
      setIsPrimaryMediaReady(true);
    }
  }, [isLoading, mediaKind, mediaSrc]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (mediaKind !== "image" || !mediaSrc || isLoading) {
      return;
    }

    const img = imageRef.current;
    if (!img) {
      return;
    }

    // When switching quickly, the image can be served from cache and load
    // before React attaches the onLoad handler. In that case, mark it ready.
    if (img.complete && img.naturalWidth > 0) {
      setIsPrimaryMediaReady(true);
    }
  }, [isLoading, isOpen, mediaKind, mediaSrc]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        performClose();
      }

      if (event.key === "ArrowLeft" && canGoPrevious) {
        event.preventDefault();
        onPrevious();
      }

      if (event.key === "ArrowRight" && canGoNext) {
        event.preventDefault();
        onNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [canGoNext, canGoPrevious, isOpen, onNext, onPrevious, performClose]);

  if (!isOpen) {
    return null;
  }

  const showBlurPlaceholder =
    !!thumbnailSrc &&
    (isLoading ||
      !mediaSrc ||
      (!isPrimaryMediaReady &&
        (mediaKind === "image" || mediaKind === "video")));

  const showLoadingIndicator =
    mediaKind === "image" &&
    (isLoading ||
      (!isPrimaryMediaReady && !!mediaSrc && mediaKind === "image"));

  return (
    <div className="saved-media-viewer absolute inset-0 z-[94] overflow-hidden">
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-md"
        onClick={performClose}
      />

      <button
        type="button"
        className="absolute left-4 top-3 z-[96] inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white shadow-lg shadow-black/40 backdrop-blur-md transition hover:bg-black/45 sm:top-4"
        onClick={performClose}
        aria-label="Back"
      >
        <span className="text-[18px] leading-none" aria-hidden="true">
          ←
        </span>
      </button>

      <div className="absolute left-1/2 top-3 z-[96] -translate-x-1/2 sm:top-4">
        <div className="max-w-[70vw] truncate rounded-full border border-white/10 bg-black/35 px-4 py-2 text-center text-sm font-medium text-white/90 shadow-lg shadow-black/30 backdrop-blur-md">
          {fileName}
        </div>
      </div>

      <div className="relative z-[95] flex h-full w-full items-center justify-center px-4 pb-10 pt-16 sm:px-6 sm:pb-12 sm:pt-20">
        <div className="relative flex h-full w-full max-w-6xl items-center justify-center overflow-hidden">
          {showBlurPlaceholder && (
            <>
              <img
                src={thumbnailSrc || undefined}
                alt=""
                className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover blur-2xl opacity-55"
                aria-hidden="true"
              />
              <div className="pointer-events-none absolute inset-0 bg-black/30" />
            </>
          )}

          {showLoadingIndicator && (
            <div className="relative z-10 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-body">Loading media...</p>
            </div>
          )}

          {!isLoading && error && (
            <div className="text-center">
              <p className="text-body text-destructive">{error}</p>
            </div>
          )}

          {!isLoading && !error && mediaSrc && mediaKind === "image" && (
            <img
              key={mediaSrc}
              ref={imageRef}
              src={mediaSrc}
              alt={fileName}
              onLoad={() => setIsPrimaryMediaReady(true)}
              onError={() => {
                setIsPrimaryMediaReady(true);
              }}
              className={`relative z-10 max-h-full max-w-full rounded-xl object-contain shadow-2xl shadow-black/60 transition-opacity duration-300 ${isPrimaryMediaReady ? "opacity-100" : "opacity-0"}`}
            />
          )}

          {mediaKind === "image" && (
            <>
              <button
                type="button"
                className={`absolute left-3 top-1/2 z-[96] inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white shadow-lg shadow-black/40 backdrop-blur-md transition hover:bg-black/45 ${canGoPrevious ? "" : "pointer-events-none opacity-30"}`}
                onClick={onPrevious}
                aria-label="Previous image"
                disabled={!canGoPrevious}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                className={`absolute right-3 top-1/2 z-[96] inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white shadow-lg shadow-black/40 backdrop-blur-md transition hover:bg-black/45 ${canGoNext ? "" : "pointer-events-none opacity-30"}`}
                onClick={onNext}
                aria-label="Next image"
                disabled={!canGoNext}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}

          {!error && (mediaKind === "video" || mediaKind === "audio") && (
            <div
              className={`saved-media-player relative z-10 w-full rounded-xl bg-black/25 shadow-2xl shadow-black/60 backdrop-blur-sm transition-opacity duration-300 ${mediaKind === "video" ? "h-full opacity-100" : "max-w-2xl opacity-100"}`}
              data-buffering={isBuffering ? "true" : "false"}
            >
              <div
                className="saved-media-buffer pointer-events-none absolute z-20"
                aria-hidden="true"
              >
                <div className="saved-media-buffer-badge">
                  <Loader2 className="h-16 w-16 animate-spin" />
                </div>
              </div>
              <PlyrMedia
                kind={mediaKind}
                src={mediaSrc ?? ""}
                onReady={() => setIsPrimaryMediaReady(true)}
                onBufferingChange={setIsBuffering}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
