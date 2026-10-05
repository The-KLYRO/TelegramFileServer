import {
  Binary,
  Braces,
  File,
  FileArchive,
  FileAudio2,
  FileCode,
  FileCog,
  FileJson,
  FileKey,
  FileImage,
  FileSpreadsheet,
  FileTerminal,
  FileText,
  FileType,
  FileVideo2,
  FileVolume2,
  Package,
  Presentation,
  Shield,
  type LucideIcon,
} from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type FileIconTone =
  | "default"
  | "image"
  | "video"
  | "audio"
  | "code"
  | "archive"
  | "sheet"
  | "text"
  | "pdf"
  | "binary"
  | "executable"
  | "config"
  | "package"
  | "secure";

type FileIconSize = "sm" | "md" | "lg";

export interface FileIconTarget {
  name: string;
  extension?: string;
}

interface FileIconMeta {
  Icon: LucideIcon;
  tone: FileIconTone;
}

interface ThemedFileIconProps {
  file: FileIconTarget;
  size?: FileIconSize;
  className?: string;
  iconClassName?: string;
}

const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "svg",
  "bmp",
  "ico",
]);

const VIDEO_EXTENSIONS = new Set([
  "mp4",
  "mkv",
  "avi",
  "mov",
  "wmv",
  "webm",
  "m4v",
]);

const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "flac", "aac", "ogg"]);

const PLAYLIST_EXTENSIONS = new Set(["m3u", "m3u8", "pls"]);

const CODE_EXTENSIONS = new Set([
  "js",
  "ts",
  "jsx",
  "tsx",
  "py",
  "rs",
  "go",
  "java",
  "cpp",
  "c",
  "h",
  "php",
  "rb",
  "swift",
  "kt",
]);

const WEB_CODE_EXTENSIONS = new Set(["html", "css", "scss", "xml"]);

const MARKUP_EXTENSIONS = new Set(["html", "xml"]);

const JSON_EXTENSIONS = new Set(["json", "jsonc"]);

const CONFIG_EXTENSIONS = new Set([
  "yaml",
  "yml",
  "toml",
  "ini",
  "cfg",
  "conf",
  "env",
  "properties",
]);

const SCRIPT_EXTENSIONS = new Set(["sh", "bash", "zsh", "ps1", "bat", "cmd"]);

const ARCHIVE_EXTENSIONS = new Set(["zip", "rar", "7z", "tar", "gz"]);

const SHEET_EXTENSIONS = new Set(["xlsx", "xls", "csv"]);

const PRESENTATION_EXTENSIONS = new Set(["ppt", "pptx", "key"]);

const DOCUMENT_EXTENSIONS = new Set(["doc", "docx", "odt", "rtf"]);

const TEXT_EXTENSIONS = new Set(["txt", "md", "rst"]);

const PDF_EXTENSIONS = new Set(["pdf"]);

const FONT_EXTENSIONS = new Set(["ttf", "otf", "woff", "woff2"]);

const PACKAGE_EXTENSIONS = new Set([
  "apk",
  "msi",
  "deb",
  "rpm",
  "pkg",
  "appimage",
]);

const EXECUTABLE_EXTENSIONS = new Set(["exe"]);

const BINARY_EXTENSIONS = new Set(["dll", "bin", "so", "dylib", "iso"]);

const SECURE_EXTENSIONS = new Set(["pem", "crt", "cer", "key", "p12", "pfx"]);

const DATABASE_EXTENSIONS = new Set(["db", "sqlite", "sqlite3", "sql"]);

const PACKAGE_FILE_NAMES = new Set([
  "package.json",
  "package-lock.json",
  "npm-shrinkwrap.json",
  "cargo.toml",
  "cargo.lock",
  "composer.json",
  "composer.lock",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
]);

const DOC_FILE_NAMES = new Set(["readme", "readme.md", "license", "changelog"]);

const MarkupFileIcon = (props: ComponentProps<"svg">) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
    <path d="M14 2v5h5" />
    <path d="m10.25 10.75-2.5 2.75 2.5 2.75" />
    <path d="m13.75 10.75 2.5 2.75-2.5 2.75" />
    <path d="m12.8 9.75-1.6 7.5" />
  </svg>
);

const SIZE_CLASSES: Record<FileIconSize, { container: string; icon: string }> =
  {
    sm: {
      container: "h-full w-full",
      icon: "h-6 w-6",
    },
    md: {
      container: "h-full w-full",
      icon: "h-16 w-16",
    },
    lg: {
      container: "h-full w-full",
      icon: "h-20 w-20",
    },
  };

const resolveExtension = ({ name, extension }: FileIconTarget): string =>
  (extension || name.split(".").pop() || "").trim().toLowerCase();

const getFileIconMeta = (file: FileIconTarget): FileIconMeta => {
  const extension = resolveExtension(file);
  const fileName = file.name.trim().toLowerCase();

  if (PACKAGE_FILE_NAMES.has(fileName)) {
    return { Icon: Package, tone: "package" };
  }

  if (DOC_FILE_NAMES.has(fileName)) {
    return { Icon: FileText, tone: "text" };
  }

  if (IMAGE_EXTENSIONS.has(extension)) {
    return { Icon: FileImage, tone: "image" };
  }

  if (VIDEO_EXTENSIONS.has(extension)) {
    return { Icon: FileVideo2, tone: "video" };
  }

  if (AUDIO_EXTENSIONS.has(extension)) {
    return { Icon: FileAudio2, tone: "audio" };
  }

  if (PLAYLIST_EXTENSIONS.has(extension)) {
    return { Icon: FileVolume2, tone: "audio" };
  }

  if (JSON_EXTENSIONS.has(extension)) {
    return { Icon: FileJson, tone: "code" };
  }

  if (WEB_CODE_EXTENSIONS.has(extension)) {
    return {
      Icon: MARKUP_EXTENSIONS.has(extension)
        ? (MarkupFileIcon as LucideIcon)
        : Braces,
      tone: "code",
    };
  }

  if (SCRIPT_EXTENSIONS.has(extension)) {
    return { Icon: FileTerminal, tone: "code" };
  }

  if (CONFIG_EXTENSIONS.has(extension)) {
    return { Icon: FileCog, tone: "config" };
  }

  if (CODE_EXTENSIONS.has(extension)) {
    return { Icon: FileCode, tone: "code" };
  }

  if (ARCHIVE_EXTENSIONS.has(extension)) {
    return { Icon: FileArchive, tone: "archive" };
  }

  if (PACKAGE_EXTENSIONS.has(extension)) {
    return { Icon: Package, tone: "package" };
  }

  if (EXECUTABLE_EXTENSIONS.has(extension)) {
    return { Icon: FileCog, tone: "executable" };
  }

  if (BINARY_EXTENSIONS.has(extension)) {
    return { Icon: Binary, tone: "binary" };
  }

  if (SHEET_EXTENSIONS.has(extension)) {
    return { Icon: FileSpreadsheet, tone: "sheet" };
  }

  if (PRESENTATION_EXTENSIONS.has(extension)) {
    return { Icon: Presentation, tone: "sheet" };
  }

  if (DOCUMENT_EXTENSIONS.has(extension)) {
    return { Icon: FileText, tone: "text" };
  }

  if (TEXT_EXTENSIONS.has(extension)) {
    return { Icon: FileText, tone: "text" };
  }

  if (PDF_EXTENSIONS.has(extension)) {
    return { Icon: FileText, tone: "pdf" };
  }

  if (FONT_EXTENSIONS.has(extension)) {
    return { Icon: FileType, tone: "text" };
  }

  if (SECURE_EXTENSIONS.has(extension)) {
    return { Icon: extension === "key" ? FileKey : Shield, tone: "secure" };
  }

  if (DATABASE_EXTENSIONS.has(extension)) {
    return { Icon: FileSpreadsheet, tone: "binary" };
  }

  return { Icon: File, tone: "default" };
};

const getFileIcon = (file: FileIconTarget): LucideIcon =>
  getFileIconMeta(file).Icon;

function ThemedFileIcon({
  file,
  size = "md",
  className,
  iconClassName,
}: ThemedFileIconProps) {
  const { Icon, tone } = getFileIconMeta(file);
  const classes = SIZE_CLASSES[size];

  return (
    <div
      className={cn(
        "skybox-file-icon-shell relative isolate flex items-center justify-center",
        classes.container,
        className,
      )}
      data-tone={tone}
    >
      <Icon
        className={cn(
          "skybox-file-icon-glyph relative z-[1]",
          classes.icon,
          iconClassName,
        )}
        strokeWidth={1.3}
      />
    </div>
  );
}

export { getFileIcon, getFileIconMeta, ThemedFileIcon };
