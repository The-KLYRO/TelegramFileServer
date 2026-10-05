import { resolveThumbnailSrc } from "@/lib/thumbnail-src";

export type FolderType =
  | "normal"
  | "movie"
  | "movie_collection"
  | "tv_collection"
  | "tv"
  | "music";
export type FolderIconMode = "default" | "auto" | "custom" | "tmdb_poster";
export type TmdbMediaType = "movie" | "tv";
export type FolderArtworkVariant =
  | "case_spine"
  | "case_panel"
  | "case_disc"
  | "case_plain"
  | "cover_wide"
  | "folder_poster";

export interface FolderSettings {
  folderId: string;
  folderType: FolderType;
  detectedType: FolderType;
  iconMode: FolderIconMode;
  isManualOverride: boolean;
  customIconAssetPath?: string | null;
  customIconIcoPath?: string | null;
  sourceImageName?: string | null;
  artworkVariant: FolderArtworkVariant;
  tmdbMediaType?: TmdbMediaType | null;
  tmdbId?: number | null;
  tmdbTitle?: string | null;
  tmdbPosterRemotePath?: string | null;
  tmdbLocalPosterPath?: string | null;
  updatedAt: number;
}

export interface FolderSettingsDto {
  folder_id: string;
  folder_type: FolderType;
  detected_type: FolderType;
  icon_mode: FolderIconMode;
  is_manual_override: boolean;
  custom_icon_asset_path?: string | null;
  custom_icon_ico_path?: string | null;
  source_image_name?: string | null;
  artwork_variant?: FolderArtworkVariant | null;
  tmdb_media_type?: TmdbMediaType | null;
  tmdb_id?: number | null;
  tmdb_title?: string | null;
  tmdb_poster_remote_path?: string | null;
  tmdb_local_poster_path?: string | null;
  updated_at: number;
}

export interface TmdbSearchResult {
  media_type: TmdbMediaType;
  id: number;
  title: string;
  year?: string | null;
  poster_remote_path?: string | null;
  poster_url?: string | null;
}

export interface FolderSettingsSeedInput {
  folderId: string;
  folderName: string;
}

export interface FolderSettingsSaveInput {
  folderId: string;
  folderName: string;
  folderType: FolderType;
  iconMode: FolderIconMode;
  isManualOverride: boolean;
  customIconFileName?: string;
  customIconBytes?: number[];
  artworkVariant: FolderArtworkVariant;
  tmdbMediaType?: TmdbMediaType;
  tmdbId?: number;
  tmdbTitle?: string;
  tmdbPosterRemotePath?: string;
  clearTmdbSelection?: boolean;
}

export function mapFolderSettingsDto(input: FolderSettingsDto): FolderSettings {
  return {
    folderId: input.folder_id,
    folderType: input.folder_type,
    detectedType: input.detected_type,
    iconMode: input.icon_mode,
    isManualOverride: input.is_manual_override,
    customIconAssetPath: input.custom_icon_asset_path,
    customIconIcoPath: input.custom_icon_ico_path,
    sourceImageName: input.source_image_name,
    artworkVariant: input.artwork_variant || "case_plain",
    tmdbMediaType: input.tmdb_media_type,
    tmdbId: input.tmdb_id,
    tmdbTitle: input.tmdb_title,
    tmdbPosterRemotePath: input.tmdb_poster_remote_path,
    tmdbLocalPosterPath: input.tmdb_local_poster_path,
    updatedAt: input.updated_at,
  };
}

const MOVIE_KEYWORDS = ["movie", "movies", "film", "films", "cinema", "anime"];
const TV_KEYWORDS = ["tv", "tv show", "tv shows", "shows", "series"];
const MUSIC_KEYWORDS = ["music", "songs", "albums"];

export const ALLOWED_FOLDER_ICON_EXTENSIONS = [
  ".ico",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
] as const;

export function normalizeFolderId(folderId: string): string {
  const trimmed = folderId.trim().replace(/\\/g, "/");
  if (!trimmed) {
    return trimmed;
  }

  if (/^[a-zA-Z]:\/$/.test(trimmed)) {
    return trimmed;
  }

  return trimmed.replace(/\/+$/, "") || trimmed;
}

function normalizeFolderName(folderName: string): string {
  return folderName
    .trim()
    .toLowerCase()
    .replace(/[._-]+/g, " ")
    .replace(/[()\[\]{}!?,:;]+/g, " ")
    .replace(/\s+/g, " ");
}

function matchesKeyword(normalizedName: string, keywords: string[]): boolean {
  return keywords.some((keyword) => normalizedName.includes(keyword));
}

export function detectFolderTypeFromName(folderName: string): FolderType {
  const normalizedName = normalizeFolderName(folderName);
  if (!normalizedName) {
    return "normal";
  }

  if (matchesKeyword(normalizedName, MOVIE_KEYWORDS)) {
    return "movie";
  }

  if (matchesKeyword(normalizedName, TV_KEYWORDS)) {
    return "tv";
  }

  if (matchesKeyword(normalizedName, MUSIC_KEYWORDS)) {
    return "music";
  }

  return "normal";
}

export function getFolderTypeLabel(folderType: FolderType): string {
  switch (folderType) {
    case "movie":
      return "Movie";
    case "movie_collection":
      return "Movie collection";
    case "tv_collection":
      return "TV collection";
    case "tv":
      return "TV";
    case "music":
      return "Music";
    default:
      return "Normal";
  }
}

export function getFolderIconModeLabel(iconMode: FolderIconMode): string {
  switch (iconMode) {
    case "auto":
      return "Auto";
    case "custom":
      return "Custom icon";
    case "tmdb_poster":
      return "TMDB poster";
    default:
      return "Default";
  }
}

export function getFolderSettingsPreviewSrc(
  settings?: FolderSettings | null,
): string | undefined {
  if (settings?.iconMode === "tmdb_poster") {
    return resolveThumbnailSrc(settings.tmdbLocalPosterPath);
  }

  return resolveThumbnailSrc(
    settings?.customIconAssetPath || settings?.customIconIcoPath,
  );
}

export function isTmdbFolderType(
  folderType: FolderType,
): folderType is TmdbMediaType {
  return folderType === "movie" || folderType === "tv";
}

export function supportsArtworkVariants(folderType: FolderType): boolean {
  return folderType !== "normal";
}

export function getEffectiveArtworkVariant(
  settings?: FolderSettings | null,
): FolderArtworkVariant {
  if (!settings || !supportsArtworkVariants(settings.folderType)) {
    return "case_plain";
  }

  return settings.artworkVariant || "case_plain";
}

export function getEffectiveFolderType(
  settings?: FolderSettings | null,
): FolderType {
  if (!settings) {
    return "normal";
  }

  if (
    settings.iconMode === "default" &&
    (settings.folderType === "movie_collection" ||
      settings.folderType === "tv_collection")
  ) {
    return settings.folderType;
  }

  if (settings.iconMode === "default") {
    return "normal";
  }

  return settings.folderType;
}

export function getFolderSettingsErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return "An unknown error occurred.";
}
