import type * as React from "react";
import { Image, Music, Play } from "lucide-react";

export type FolderSymbolIcon = React.ComponentType<
  React.SVGProps<SVGSVGElement>
>;

const DocumentsSymbol: FolderSymbolIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    {...props}
  >
    {/* Paper outline + fold (doc vibe) */}
    <path
      d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M14 3v4a2 2 0 0 0 2 2h4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.7"
    />
    <path
      d="M8 12h8"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      opacity="0.75"
    />
    <path
      d="M8 15.5h6.5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      opacity="0.75"
    />
  </svg>
);

const normalizeFolderName = (value: string): string =>
  value.trim().toLowerCase();

const isSavedVirtualFolderPath = (path?: string): boolean =>
  !!path && path.startsWith("tg://saved/");

export function getDefaultFolderSymbol(
  name: string,
  path?: string,
): FolderSymbolIcon | null {
  // Only decorate the built-in Saved folders.
  if (!isSavedVirtualFolderPath(path)) {
    return null;
  }

  const normalized = normalizeFolderName(name);

  switch (normalized) {
    case "images":
      return Image;
    case "videos":
      return Play;
    case "audio":
    case "audios":
      return Music;
    case "documents":
      return DocumentsSymbol;
    default:
      return null;
  }
}
