import { forwardRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  FolderPlus,
  ClipboardPaste,
  RotateCcw,
  Trash2,
  Copy,
  Edit3,
  FileText,
  Info,
  ArrowDownToLine,
  FolderOpen,
  Settings,
  Star,
} from "lucide-react";
import type { FileItem } from "@/components/skybox/FileRow";
import {
  isProtectedSavedFolderPath,
  isRecycleBinPath,
} from "@/pages/explorer/shared";

interface ContextMenuState {
  x: number;
  y: number;
  targetFile: FileItem | null;
  isEmptyArea: boolean;
}

interface ContextMenuProps {
  contextMenuState: ContextMenuState | null;
  selectedPaths: string[];
  clipboardItem: {
    mode: "copy" | "cut";
    items: Array<{
      path: string;
      name: string;
      isDirectory: boolean;
    }>;
  } | null;
  favorites: string[];
  showFavorites?: boolean;
  currentPath: string;
  isRecycleBinView: boolean;
  isNotesFolderView: boolean;
  isNotesMessageContextMenu: boolean;
  isMultiSelectionContextMenu: boolean;
  contextTargetFile: FileItem | null;
  canPasteInCurrentPath: boolean;
  onClose: () => void;
  onOpen: (file: FileItem) => void;
  onOpenInNewTab: (file: FileItem) => void;
  onDelete: (file: FileItem) => void;
  onDetails: (file: FileItem) => void;
  onCopyPath: (file: FileItem) => void;
  onToggleFavorite: (file: FileItem) => void;
  onRename: (file: FileItem) => void;
  onNewFolder: () => void;
  onPaste: () => void;
  onDownload: (file: FileItem) => void;
  onCopyNoteText: (file: FileItem) => void;
  onEditNoteMessage: (file: FileItem) => void;
  onRestoreFromRecycleBin: (file: FileItem) => void;
  onFolderSettings: (file: FileItem) => void;
  onDeleteNoteFromTelegram: (file: FileItem) => void;
  onCopy: (file: FileItem) => void;
  onCut: (file: FileItem) => void;
}

const contextMenuItemClassName =
  "w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-body text-foreground transition-colors hover:bg-primary/15 outline-none focus-visible:outline-none";
const contextMenuDisabledItemClassName =
  "w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-body text-muted-foreground/60 pointer-events-none outline-none focus-visible:outline-none";
const contextMenuDangerItemClassName =
  "w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-body text-destructive transition-colors hover:bg-destructive/10 outline-none focus-visible:outline-none";
function estimateContextMenuHeight({
  contextMenuState,
  contextTargetFile,
  isRecycleBinView,
  isNotesMessageContextMenu,
  isMultiSelectionContextMenu,
  showFavorites,
}: {
  contextMenuState: ContextMenuState;
  contextTargetFile: FileItem | null;
  isRecycleBinView: boolean;
  isNotesMessageContextMenu: boolean;
  isMultiSelectionContextMenu: boolean;
  showFavorites: boolean;
}) {
  const ITEM_HEIGHT = 40;
  const DIVIDER_HEIGHT = 10;
  const VERTICAL_PADDING = 10;

  if (contextMenuState.isEmptyArea) {
    return VERTICAL_PADDING + ITEM_HEIGHT * 2;
  }

  if (isRecycleBinView) {
    return VERTICAL_PADDING + ITEM_HEIGHT * 2 + DIVIDER_HEIGHT;
  }

  if (isNotesMessageContextMenu) {
    return VERTICAL_PADDING + ITEM_HEIGHT * 3 + DIVIDER_HEIGHT;
  }

  if (isMultiSelectionContextMenu) {
    return VERTICAL_PADDING + ITEM_HEIGHT * 2 + DIVIDER_HEIGHT;
  }

  if (!contextTargetFile) {
    return 220;
  }

  const supportsOpen =
    contextTargetFile.isDirectory ||
    contextTargetFile.extension?.match(
      /^(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i,
    ) ||
    contextTargetFile.extension?.match(/^(mp4|mkv|avi|mov|wmv|webm)$/i) ||
    contextTargetFile.extension?.match(/^(mp3|wav|flac|aac|ogg)$/i);

  const showFolderSettings =
    !!contextTargetFile.isDirectory &&
    !isProtectedSavedFolderPath(contextTargetFile.path) &&
    !isRecycleBinPath(contextTargetFile.path);

  let itemCount = 5;
  let dividerCount = 1;

  if (supportsOpen) {
    itemCount += 1;
  }

  if (contextTargetFile.isDirectory) {
    itemCount += 1;
  }

  if (showFavorites && contextTargetFile.isDirectory) {
    itemCount += 1;
  }

  if (!contextTargetFile.isDirectory) {
    itemCount += 2;
    dividerCount += 1;
  }

  if (showFolderSettings) {
    itemCount += 1;
  }

  return (
    VERTICAL_PADDING + itemCount * ITEM_HEIGHT + dividerCount * DIVIDER_HEIGHT
  );
}
export const ContextMenu = forwardRef<HTMLDivElement, ContextMenuProps>(
  function ContextMenu(
    {
      contextMenuState,
      selectedPaths,
      clipboardItem,
      favorites,
      showFavorites = true,
      currentPath,
      isRecycleBinView,
      isNotesFolderView,
      isNotesMessageContextMenu,
      isMultiSelectionContextMenu,
      contextTargetFile,
      canPasteInCurrentPath,
      onClose,
      onOpen,
      onOpenInNewTab,
      onDelete,
      onDetails,
      onCopyPath,
      onToggleFavorite,
      onRename,
      onNewFolder,
      onPaste,
      onDownload,
      onCopyNoteText,
      onEditNoteMessage,
      onRestoreFromRecycleBin,
      onFolderSettings,
      onDeleteNoteFromTelegram,
      onCopy,
      onCut,
    },
    ref,
  ) {
    useEffect(() => {
      if (!contextMenuState) {
        return;
      }

      const handlePointerDown = (event: MouseEvent) => {
        const target = event.target as Node | null;
        if (
          ref &&
          (ref as React.RefObject<HTMLDivElement>).current &&
          target &&
          (ref as React.RefObject<HTMLDivElement>).current.contains(target)
        ) {
          return;
        }
        onClose();
      };

      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          onClose();
        }
      };

      const handleViewportChange = () => {
        onClose();
      };

      window.addEventListener("mousedown", handlePointerDown, true);
      window.addEventListener("keydown", handleEscape);
      window.addEventListener("scroll", handleViewportChange, true);
      window.addEventListener("blur", handleViewportChange);

      return () => {
        window.removeEventListener("mousedown", handlePointerDown, true);
        window.removeEventListener("keydown", handleEscape);
        window.removeEventListener("scroll", handleViewportChange, true);
        window.removeEventListener("blur", handleViewportChange);
      };
    }, [contextMenuState, onClose, ref]);

    if (!contextMenuState) {
      return null;
    }

    const isFavorite =
      showFavorites && contextTargetFile
        ? favorites.includes(contextTargetFile.path)
        : false;
    const showFolderSettings =
      !!contextTargetFile?.isDirectory &&
      !isProtectedSavedFolderPath(contextTargetFile.path) &&
      !isRecycleBinPath(contextTargetFile.path);
    const menuWidth = 220;
    const menuHeight = estimateContextMenuHeight({
      contextMenuState,
      contextTargetFile,
      isRecycleBinView,
      isNotesMessageContextMenu,
      isMultiSelectionContextMenu,
      showFavorites,
    });
    const clampedX = Math.max(
      8,
      Math.min(contextMenuState.x, window.innerWidth - menuWidth - 8),
    );
    const clampedY = Math.max(
      8,
      Math.min(contextMenuState.y, window.innerHeight - menuHeight - 8),
    );

    const menu = (
      <div
        className="fixed inset-0 z-[80] pointer-events-none"
        onContextMenu={(event) => event.preventDefault()}
      >
        <div
          className="absolute"
          style={{ left: `${clampedX}px`, top: `${clampedY}px` }}
        >
          <div className="context-menu-backdrop pointer-events-none absolute inset-0 rounded-xl" />
          <div
            ref={ref}
            role="menu"
            className="context-menu-surface pointer-events-auto relative flex min-w-[220px] flex-col overflow-hidden rounded-xl shadow-2xl shadow-black/50"
            onClick={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.preventDefault()}
          >
            <div className="relative z-10 p-1">
              {contextMenuState.isEmptyArea ? (
                <>
                  <button
                    className={contextMenuItemClassName}
                    onClick={() => {
                      onClose();
                      onNewFolder();
                    }}
                  >
                    <FolderPlus className="w-4 h-4 text-muted-foreground" />
                    <span>New Folder</span>
                  </button>
                  <button
                    className={
                      canPasteInCurrentPath
                        ? contextMenuItemClassName
                        : contextMenuDisabledItemClassName
                    }
                    disabled={!canPasteInCurrentPath}
                    onClick={() => {
                      if (!canPasteInCurrentPath) {
                        return;
                      }
                      onClose();
                      onPaste();
                    }}
                  >
                    <ClipboardPaste className="w-4 h-4 text-muted-foreground" />
                    <span>Paste</span>
                  </button>
                </>
              ) : isRecycleBinView ? (
                <>
                  <button
                    className={contextMenuItemClassName}
                    onClick={() => {
                      onClose();
                      onRestoreFromRecycleBin(contextTargetFile!);
                    }}
                  >
                    <RotateCcw className="w-4 h-4 text-muted-foreground" />
                    <span>Restore</span>
                  </button>

                  <div className="my-1 h-px bg-border" />

                  <button
                    className={contextMenuDangerItemClassName}
                    onClick={() => {
                      onClose();
                      onDelete(contextTargetFile!);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </button>
                </>
              ) : isNotesMessageContextMenu ? (
                <>
                  <button
                    className={contextMenuItemClassName}
                    onClick={() => {
                      onClose();
                      onCopyNoteText(contextTargetFile!);
                    }}
                  >
                    <Copy className="w-4 h-4 text-muted-foreground" />
                    <span>Copy as text</span>
                  </button>

                  <button
                    className={contextMenuItemClassName}
                    onClick={() => {
                      onClose();
                      onEditNoteMessage(contextTargetFile!);
                    }}
                  >
                    <Edit3 className="w-4 h-4 text-muted-foreground" />
                    <span>Edit</span>
                  </button>

                  <div className="my-1 h-px bg-border" />

                  <button
                    className={contextMenuDangerItemClassName}
                    onClick={() => {
                      onClose();
                      onDeleteNoteFromTelegram(contextTargetFile!);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete from Telegram</span>
                  </button>
                </>
              ) : isMultiSelectionContextMenu ? (
                <>
                  <button
                    className={contextMenuDangerItemClassName}
                    onClick={() => {
                      onClose();
                      onDelete(contextTargetFile!);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </button>
                </>
              ) : (
                <>
                  {contextTargetFile.isDirectory ||
                  contextTargetFile.extension?.match(
                    /^(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i,
                  ) ||
                  contextTargetFile.extension?.match(
                    /^(mp4|mkv|avi|mov|wmv|webm)$/i,
                  ) ||
                  contextTargetFile.extension?.match(
                    /^(mp3|wav|flac|aac|ogg)$/i,
                  ) ? (
                    <button
                      className={contextMenuItemClassName}
                      onClick={() => {
                        onClose();
                        onOpen(contextTargetFile!);
                      }}
                    >
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span>Open</span>
                    </button>
                  ) : null}

                  {contextTargetFile.isDirectory ? (
                    <>
                      <button
                        className={contextMenuItemClassName}
                        onClick={() => {
                          onClose();
                          onOpenInNewTab(contextTargetFile!);
                        }}
                      >
                        <FolderOpen className="w-4 h-4 text-muted-foreground" />
                        <span>Open in new tab</span>
                      </button>
                    </>
                  ) : null}

                  {showFavorites && contextTargetFile.isDirectory ? (
                    <button
                      className={contextMenuItemClassName}
                      onClick={() => {
                        onClose();
                        onToggleFavorite(contextTargetFile!);
                      }}
                    >
                      <Star
                        className={`w-4 h-4 ${
                          isFavorite
                            ? "fill-primary text-primary"
                            : "text-muted-foreground"
                        }`}
                      />
                      <span>
                        {isFavorite
                          ? "Remove from favorites"
                          : "Add to favorites"}
                      </span>
                    </button>
                  ) : null}

                  {!contextTargetFile.isDirectory && (
                    <>
                      <button
                        className={contextMenuItemClassName}
                        onClick={() => {
                          onClose();
                          onDownload(contextTargetFile!);
                        }}
                      >
                        <ArrowDownToLine className="w-4 h-4 text-muted-foreground" />
                        <span>Download</span>
                      </button>
                    </>
                  )}

                  <button
                    className={contextMenuItemClassName}
                    onClick={() => {
                      onClose();
                      onCopy(contextTargetFile!);
                    }}
                  >
                    <Copy className="w-4 h-4 text-muted-foreground" />
                    <span>Copy</span>
                  </button>

                  <button
                    className={contextMenuItemClassName}
                    onClick={() => {
                      onClose();
                      onCut(contextTargetFile!);
                    }}
                  >
                    <Copy className="w-4 h-4 text-muted-foreground" />
                    <span>Cut</span>
                  </button>

                  {contextTargetFile && !contextTargetFile.isDirectory && (
                    <div className="my-1 h-px bg-border" />
                  )}

                  <button
                    className={contextMenuItemClassName}
                    onClick={() => {
                      onClose();
                      onRename(contextTargetFile!);
                    }}
                  >
                    <Edit3 className="w-4 h-4 text-muted-foreground" />
                    <span>Rename</span>
                  </button>

                  <button
                    className={contextMenuDangerItemClassName}
                    onClick={() => {
                      onClose();
                      onDelete(contextTargetFile!);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </button>

                  {showFolderSettings ? (
                    <button
                      className={contextMenuItemClassName}
                      onClick={() => {
                        onClose();
                        onFolderSettings(contextTargetFile!);
                      }}
                    >
                      <Settings className="w-4 h-4 text-muted-foreground" />
                      <span>Folder settings</span>
                    </button>
                  ) : null}

                  <div className="my-1 h-px bg-border" />

                  <button
                    className={contextMenuItemClassName}
                    onClick={() => {
                      onClose();
                      onDetails(contextTargetFile!);
                    }}
                  >
                    <Info className="w-4 h-4 text-muted-foreground" />
                    <span>Details</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );

    const portalTarget =
      document.getElementById("floating-root") ?? document.body;

    return createPortal(menu, portalTarget);
  },
);

ContextMenu.displayName = "ContextMenu";
