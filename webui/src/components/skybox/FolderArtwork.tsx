import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Film, Music2, Tv } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getDefaultFolderSymbol } from "@/components/skybox/folderSymbols";
import {
  getEffectiveArtworkVariant,
  getEffectiveFolderType,
  getFolderSettingsPreviewSrc,
  getFolderTypeLabel,
  supportsArtworkVariants,
  type FolderSettings,
  type FolderArtworkVariant,
  type FolderType,
} from "@/lib/folder-settings";
import { cn } from "@/lib/utils";

interface FolderArtworkProps {
  name: string;
  path?: string;
  settings?: FolderSettings | null;
  size: number;
  folderClassName?: string;
  symbolClassName?: string;
  customIconClassName?: string;
  badgeClassName?: string;
  showBadge?: boolean;
}

const folderTypeIconMap = {
  movie: Film,
  movie_collection: Film,
  tv_collection: Tv,
  tv: Tv,
  music: Music2,
} as const;

function getFolderTypeIcon(folderType: FolderType) {
  if (folderType === "normal") {
    return null;
  }

  return folderTypeIconMap[folderType];
}

function getFolderTypeBadgeClassName(folderType: FolderType): string {
  switch (folderType) {
    case "movie":
    case "movie_collection":
      return "border-amber-300/35 bg-amber-500/90 text-amber-50";
    case "tv_collection":
    case "tv":
      return "border-cyan-300/35 bg-cyan-500/90 text-cyan-50";
    case "music":
      return "border-emerald-300/35 bg-emerald-500/90 text-emerald-50";
    default:
      return "border-transparent bg-secondary text-secondary-foreground";
  }
}

function renderArtworkVariant(
  variant: FolderArtworkVariant,
  artworkSrc: string,
  name: string,
  customIconClassName?: string,
) {
  const imageClassName = cn("h-full w-full object-cover", customIconClassName);

  switch (variant) {
    case "case_spine":
      return (
        <div className="relative h-full w-full overflow-hidden rounded-[16%] border border-primary/20 bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-950 shadow-[0_10px_24px_rgba(0,0,0,0.24)]">
          <div className="absolute inset-y-[8%] left-[5%] w-[9%] rounded-full bg-black/35 blur-[1px]" />
          <div className="absolute inset-y-[5%] right-[7%] left-[16%] overflow-hidden rounded-[10%] border border-white/10 bg-black/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <img
              src={artworkSrc}
              alt={name}
              className={imageClassName}
              draggable={false}
            />
          </div>
        </div>
      );
    case "case_panel":
      return (
        <div className="relative h-full w-full overflow-hidden rounded-[14%] border border-primary/20 bg-gradient-to-b from-zinc-600 to-zinc-950 shadow-[0_10px_24px_rgba(0,0,0,0.24)]">
          <div className="absolute inset-x-[7%] top-[3%] h-[13%] rounded-t-[9px] bg-gradient-to-b from-white/50 to-white/12">
            <div className="flex h-full items-center justify-center text-[8px] font-bold uppercase tracking-[0.22em] text-black/80">
              DVD
            </div>
          </div>
          <div className="absolute inset-x-[8%] bottom-[6%] top-[15%] overflow-hidden rounded-[8%] border border-white/10 bg-black/15">
            <img
              src={artworkSrc}
              alt={name}
              className={imageClassName}
              draggable={false}
            />
          </div>
        </div>
      );
    case "case_disc":
      return (
        <div className="relative h-full w-full overflow-hidden rounded-[14%] border border-primary/20 bg-gradient-to-br from-slate-700 to-slate-950 shadow-[0_10px_24px_rgba(0,0,0,0.24)]">
          <div className="absolute inset-y-[10%] right-0 w-[13%] rounded-l-[12px] bg-zinc-900/90" />
          <div className="absolute inset-y-[22%] right-[2%] w-[9%] rounded-l-[10px] bg-zinc-800/95" />
          <div className="absolute inset-y-[6%] left-[6%] right-[12%] overflow-hidden rounded-[8%] border border-white/10 bg-black/15">
            <img
              src={artworkSrc}
              alt={name}
              className={imageClassName}
              draggable={false}
            />
          </div>
        </div>
      );
    case "case_plain":
      return (
        <div className="relative h-full w-full overflow-hidden rounded-[12%] border border-primary/20 bg-gradient-to-b from-slate-800 to-slate-950 shadow-[0_10px_24px_rgba(0,0,0,0.24)]">
          <div className="absolute inset-[4%] overflow-hidden rounded-[10%] border border-white/10 bg-black/10">
            <img
              src={artworkSrc}
              alt={name}
              className={imageClassName}
              draggable={false}
            />
          </div>
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.14),transparent_28%,transparent_72%,rgba(255,255,255,0.04))]" />
        </div>
      );
    case "cover_wide":
      return (
        <div className="relative h-full w-full overflow-hidden rounded-[16%] border border-primary/20 bg-gradient-to-b from-zinc-700 to-zinc-950 shadow-[0_10px_24px_rgba(0,0,0,0.22)]">
          <div className="absolute inset-x-[5%] bottom-[13%] top-[25%] overflow-hidden rounded-[12%] border border-black/15 bg-black/20 shadow-[0_8px_18px_rgba(0,0,0,0.25)]">
            <img
              src={artworkSrc}
              alt={name}
              className={imageClassName}
              draggable={false}
            />
          </div>
          <div className="absolute inset-x-[12%] top-[8%] h-[10%] rounded-full bg-white/8 blur-md" />
        </div>
      );
    case "folder_poster": {
      const spineLabel =
        name.length > 11 ? `${name.slice(0, 11).trim()}...` : name;

      return (
        <div className="relative h-full w-full">
          <div className="absolute inset-x-[26%] bottom-[6.5%] h-[9%] rounded-full bg-black/45 blur-[8px]" />
          <div
            className="absolute left-[16%] right-[23%] top-[4%] bottom-[9%] overflow-hidden rounded-[11%] border border-white/10 bg-[#1f2125]"
            style={{
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -1px 0 rgba(0,0,0,0.42), 0 14px 24px rgba(0,0,0,0.24)",
            }}
          >
            <div className="absolute inset-[2.6%] overflow-hidden rounded-[9%] border border-white/8 bg-black/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_0_0_1px_rgba(15,23,42,0.34)]">
              <img
                src={artworkSrc}
                alt={name}
                className={cn(
                  imageClassName,
                  "scale-[1.04] brightness-[0.94] contrast-[1.06] saturate-[0.94]",
                )}
                style={{ objectPosition: "center center" }}
                draggable={false}
              />
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),transparent_24%,transparent_72%,rgba(0,0,0,0.2))]" />
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(127deg,rgba(255,255,255,0.24)_0%,rgba(255,255,255,0.14)_19%,transparent_34%,transparent_100%)]" />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_50%,rgba(0,0,0,0.18)_100%)]" />
            </div>
            <div className="pointer-events-none absolute inset-x-[12%] top-[2.6%] h-[5.5%] rounded-full bg-white/9 blur-md" />
          </div>
          <div className="absolute right-[7.8%] top-1/2 h-[47%] w-[16.5%] -translate-y-1/2">
            <div
              className="absolute inset-0 rounded-r-[10px] border border-white/12 bg-gradient-to-b from-[#2d3036] via-[#272a30] to-[#212329]"
              style={{
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.38), 0 10px 18px rgba(0,0,0,0.18)",
              }}
            />
            <div className="absolute inset-y-[16%] -left-[18%] w-[28%] rounded-l-full border border-r-0 border-white/10 bg-[#272a30] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]" />
            <div className="pointer-events-none absolute inset-y-[10%] left-[16%] w-px bg-white/10" />
            <div className="pointer-events-none absolute inset-x-[30%] top-[7%] h-[14%] rounded-full bg-white/10 blur-[4px]" />
            <div className="pointer-events-none absolute left-1/2 top-1/2 w-[52px] -translate-x-1/2 -translate-y-1/2 rotate-90 overflow-hidden text-ellipsis whitespace-nowrap text-center text-[6.5px] font-medium tracking-[0.04em] text-white/72">
              {spineLabel}
            </div>
          </div>
          <div className="absolute bottom-[2%] right-[11.2%] z-[1]">
            <svg
              width="18"
              height="21"
              viewBox="0 0 48 56"
              fill="none"
              className="drop-shadow-[0_6px_10px_rgba(0,0,0,0.28)]"
            >
              <path
                d="M2 4C2 2.89543 2.89543 2 4 2H44C45.1046 2 46 2.89543 46 4V44C46 45.5 45 47 43.5 48L24 56L4.5 48C3 47 2 45.5 2 44V4Z"
                fill="url(#poster-shield-grad)"
                stroke="rgba(163,163,163,0.9)"
                strokeWidth="1"
              />
              <defs>
                <linearGradient
                  id="poster-shield-grad"
                  x1="24"
                  y1="0"
                  x2="24"
                  y2="56"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="rgb(250 250 250)" />
                  <stop offset="1" stopColor="rgb(212 212 216)" />
                </linearGradient>
              </defs>
              <text
                x="24"
                y="31"
                textAnchor="middle"
                dominantBaseline="central"
                fill="rgb(24 24 27)"
                fontSize="18"
                fontWeight="700"
                style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
              >
                8.7
              </text>
            </svg>
          </div>
        </div>
      );
    }
    default:
      return (
        <div className="h-full w-full overflow-hidden rounded-[18%] border border-primary/20 bg-secondary/20 shadow-[0_10px_24px_rgba(0,0,0,0.22)]">
          <img
            src={artworkSrc}
            alt={name}
            className={imageClassName}
            draggable={false}
          />
        </div>
      );
  }
}

export function FolderTypeBadge({
  folderType,
  className,
}: {
  folderType: FolderType;
  className?: string;
}) {
  if (
    folderType === "normal" ||
    folderType === "movie" ||
    folderType === "movie_collection" ||
    folderType === "tv_collection"
  ) {
    return null;
  }

  return (
    <Badge
      className={cn(
        "pointer-events-none absolute right-0 top-0 z-[1] px-1.5 py-0 text-[10px] uppercase tracking-[0.12em] shadow-[0_8px_16px_rgba(0,0,0,0.2)]",
        getFolderTypeBadgeClassName(folderType),
        className,
      )}
    >
      {getFolderTypeLabel(folderType)}
    </Badge>
  );
}

export function FolderArtwork({
  name,
  path,
  settings,
  size,
  folderClassName,
  symbolClassName,
  customIconClassName,
  badgeClassName,
  showBadge = true,
}: FolderArtworkProps) {
  const artworkSrc = useMemo(
    () => getFolderSettingsPreviewSrc(settings),
    [settings],
  );
  const [artworkFailed, setArtworkFailed] = useState(false);
  const effectiveFolderType = getEffectiveFolderType(settings);
  const artworkVariant = getEffectiveArtworkVariant(settings);

  useEffect(() => {
    setArtworkFailed(false);
  }, [artworkSrc]);

  const SymbolIcon = useMemo(() => {
    const typedIcon = getFolderTypeIcon(effectiveFolderType);
    return typedIcon || getDefaultFolderSymbol(name, path);
  }, [effectiveFolderType, name, path]);

  const canRenderArtwork =
    (settings?.iconMode === "custom" || settings?.iconMode === "tmdb_poster") &&
    !!artworkSrc &&
    !artworkFailed;

  return (
    <div className="relative">
      {canRenderArtwork ? (
        <div
          className={cn("relative", folderClassName)}
          style={{ width: `${size}px`, height: `${size}px` }}
        >
          <div
            onErrorCapture={() => setArtworkFailed(true)}
            className="h-full w-full"
          >
            {renderArtworkVariant(
              supportsArtworkVariants(effectiveFolderType)
                ? artworkVariant
                : "case_plain",
              artworkSrc,
              name,
              customIconClassName,
            )}
          </div>
        </div>
      ) : (
        <>
          <div
            className={cn("skybox-folder-icon", folderClassName)}
            style={{ "--folder-size": `${size}px` } as unknown as CSSProperties}
          />
          {SymbolIcon ? <SymbolIcon className={symbolClassName} /> : null}
        </>
      )}

      {showBadge ? (
        <FolderTypeBadge
          folderType={effectiveFolderType}
          className={badgeClassName}
        />
      ) : null}
    </div>
  );
}
