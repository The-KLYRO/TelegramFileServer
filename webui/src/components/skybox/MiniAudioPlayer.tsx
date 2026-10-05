import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, X } from "lucide-react";

interface MiniAudioPlayerProps {
  src: string | null;
  isLoading?: boolean;
  onClose?: () => void;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0:00";
  }
  const whole = Math.floor(seconds);
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function MiniAudioPlayer({
  src,
  isLoading,
  onClose,
}: MiniAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const disabled = !src || !!isLoading;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const handleLoadedMetadata = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    };
    const handleTimeUpdate = () => {
      if (!isScrubbing) {
        setCurrentTime(audio.currentTime || 0);
      }
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [isScrubbing]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);

    if (!src) {
      audio.removeAttribute("src");
      audio.load();
      return;
    }

    audio.src = src;
    audio.load();

    // Opening a file is a user gesture; try to autoplay.
    void audio.play().catch(() => {
      // ignore
    });
  }, [src]);

  const progressMax = useMemo(() => {
    if (!Number.isFinite(duration) || duration <= 0) {
      return 0;
    }
    return duration;
  }, [duration]);

  const label = disabled
    ? "Audio player"
    : `Audio player, ${formatTime(currentTime)} of ${formatTime(duration)}`;

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio || disabled) {
      return;
    }
    if (audio.paused) {
      void audio.play();
    } else {
      audio.pause();
    }
  };

  return (
    <div
      className="flex items-center gap-3 rounded-xl bg-secondary/20 px-3 py-2"
      aria-label={label}
    >
      <audio ref={audioRef} preload="metadata" />

      <button
        type="button"
        onClick={togglePlayback}
        disabled={disabled}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent/70 text-foreground transition hover:bg-sidebar-accent disabled:opacity-40"
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </button>

      <div className="flex-1">
        <input
          type="range"
          min={0}
          max={progressMax}
          step={0.1}
          value={Math.min(currentTime, progressMax || 0)}
          disabled={disabled || progressMax <= 0}
          onPointerDown={() => setIsScrubbing(true)}
          onPointerUp={() => setIsScrubbing(false)}
          onChange={(event) => {
            const audio = audioRef.current;
            if (!audio) {
              return;
            }
            const next = Number(event.target.value);
            setCurrentTime(next);
            audio.currentTime = next;
          }}
          className="w-full accent-primary"
          aria-label="Seek"
        />
      </div>

      <button
        type="button"
        onClick={() => {
          audioRef.current?.pause();
          onClose?.();
        }}
        disabled={!onClose}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-transparent text-muted-foreground transition hover:bg-sidebar-accent/50 hover:text-foreground disabled:opacity-40"
        aria-label="Close"
        title="Close"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
