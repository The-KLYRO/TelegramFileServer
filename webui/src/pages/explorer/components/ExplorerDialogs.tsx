import type { Dispatch, RefObject, SetStateAction } from "react";
import { Edit3 } from "lucide-react";
import { ConfirmDialog } from "@/components/skybox/ConfirmDialog";
import { ContextMenu } from "@/components/skybox/ContextMenu";
import { FolderSettingsDialog } from "@/components/skybox/FolderSettingsDialog";
import {
  UploadConfirmWidget,
  type UploadConfirmDraft,
} from "@/components/skybox/UploadConfirmWidget";
import { TextInputDialog } from "@/components/skybox/TextInputDialog";
import type { FileItem } from "@/components/skybox/FileRow";
import type {
  ClipboardMode,
  ExplorerClipboardItem,
  ExplorerContextMenuState,
} from "@/pages/explorer/shared";

interface ExplorerDialogsProps {
  contextMenuRef: RefObject<HTMLDivElement | null>;
  contextMenuState: ExplorerContextMenuState | null;
  selectedPaths: string[];
  clipboardItem: ExplorerClipboardItem | null;
  favorites: string[];
  showFavorites: boolean;
  currentPath: string;
  isRecycleBinView: boolean;
  isNotesFolderView: boolean;
  isNotesMessageContextMenu: boolean;
  isMultiSelectionContextMenu: boolean;
  contextTargetFile: FileItem | null;
  canPasteInCurrentPath: boolean;
  onCloseContextMenu: () => void;
  onContextOpen: () => void;
  onOpenInNewTab: (file: FileItem) => void;
  onContextDelete: () => void;
  onContextDetails: () => void;
  onCopyPath: () => void;
  onToggleFavorite: (file?: FileItem | null) => void;
  onRename: () => void;
  onNewFolder: () => void;
  onPaste: () => void;
  onCopyNoteText: () => void;
  onEditNoteMessage: () => void;
  onRestoreFromRecycleBin: () => void;
  onOpenFolderSettings: (file?: FileItem | null) => void;
  onStageClipboardItem: (mode: ClipboardMode, file?: FileItem) => void;
  onDownloadSavedFile: (file?: FileItem) => void;
  onDeleteNoteFromTelegram: (file?: FileItem) => void;
  isNewFolderDialogOpen: boolean;
  newFolderName: string;
  setNewFolderName: Dispatch<SetStateAction<string>>;
  onConfirmNewFolder: () => void;
  onCancelNewFolder: () => void;
  folderSettingsTarget: FileItem | null;
  onCloseFolderSettings: () => void;
  onFolderSettingsSaved: () => void;
  renameTarget: FileItem | null;
  renameValue: string;
  setRenameValue: Dispatch<SetStateAction<string>>;
  onConfirmRename: () => void;
  onCancelRename: () => void;
  noteEditTarget: FileItem | null;
  noteEditValue: string;
  setNoteEditValue: Dispatch<SetStateAction<string>>;
  onConfirmEditNoteMessage: () => void;
  onCancelEditNoteMessage: () => void;
  pendingMoveConfirm: {
    title: string;
    message: string;
    run: () => Promise<void>;
    onCancel?: () => void;
  } | null;
  setPendingMoveConfirm: Dispatch<
    SetStateAction<{
      title: string;
      message: string;
      run: () => Promise<void>;
      onCancel?: () => void;
    } | null>
  >;
  pendingRenameConfirm: {
    file: FileItem;
    newName: string;
  } | null;
  setPendingRenameConfirm: Dispatch<
    SetStateAction<{
      file: FileItem;
      newName: string;
    } | null>
  >;
  onPerformRename: (file: FileItem, newName: string) => void;
  deleteTargets: FileItem[];
  isPermanentDeleteTarget: boolean;
  isSavedDeleteTarget: boolean;
  isMultiDelete: boolean;
  deleteTarget: FileItem | null;
  onConfirmDelete: (targets: FileItem[]) => void;
  onCancelDelete: () => void;
  uploadConfirmDraft: UploadConfirmDraft | null;
  uploadPremiumUser: boolean | null;
  setUploadConfirmDraft: Dispatch<SetStateAction<UploadConfirmDraft | null>>;
  onConfirmUploadDraft: (draft: UploadConfirmDraft) => void;
}

export function ExplorerDialogs({
  contextMenuRef,
  contextMenuState,
  selectedPaths,
  clipboardItem,
  favorites,
  showFavorites,
  currentPath,
  isRecycleBinView,
  isNotesFolderView,
  isNotesMessageContextMenu,
  isMultiSelectionContextMenu,
  contextTargetFile,
  canPasteInCurrentPath,
  onCloseContextMenu,
  onContextOpen,
  onOpenInNewTab,
  onContextDelete,
  onContextDetails,
  onCopyPath,
  onToggleFavorite,
  onRename,
  onNewFolder,
  onPaste,
  onCopyNoteText,
  onEditNoteMessage,
  onRestoreFromRecycleBin,
  onOpenFolderSettings,
  onStageClipboardItem,
  onDownloadSavedFile,
  onDeleteNoteFromTelegram,
  isNewFolderDialogOpen,
  newFolderName,
  setNewFolderName,
  onConfirmNewFolder,
  onCancelNewFolder,
  folderSettingsTarget,
  onCloseFolderSettings,
  onFolderSettingsSaved,
  renameTarget,
  renameValue,
  setRenameValue,
  onConfirmRename,
  onCancelRename,
  noteEditTarget,
  noteEditValue,
  setNoteEditValue,
  onConfirmEditNoteMessage,
  onCancelEditNoteMessage,
  pendingMoveConfirm,
  setPendingMoveConfirm,
  pendingRenameConfirm,
  setPendingRenameConfirm,
  onPerformRename,
  deleteTargets,
  isPermanentDeleteTarget,
  isSavedDeleteTarget,
  isMultiDelete,
  deleteTarget,
  onConfirmDelete,
  onCancelDelete,
  uploadConfirmDraft,
  uploadPremiumUser,
  setUploadConfirmDraft,
  onConfirmUploadDraft,
}: ExplorerDialogsProps) {
  return (
    <>
      <ContextMenu
        ref={contextMenuRef}
        contextMenuState={contextMenuState}
        selectedPaths={selectedPaths}
        clipboardItem={clipboardItem}
        favorites={favorites}
        showFavorites={showFavorites}
        currentPath={currentPath}
        isRecycleBinView={isRecycleBinView}
        isNotesFolderView={isNotesFolderView}
        isNotesMessageContextMenu={isNotesMessageContextMenu}
        isMultiSelectionContextMenu={isMultiSelectionContextMenu}
        contextTargetFile={contextTargetFile}
        canPasteInCurrentPath={canPasteInCurrentPath}
        onClose={onCloseContextMenu}
        onOpen={onContextOpen}
        onOpenInNewTab={onOpenInNewTab}
        onDelete={onContextDelete}
        onDetails={onContextDetails}
        onCopyPath={onCopyPath}
        onToggleFavorite={onToggleFavorite}
        onRename={onRename}
        onNewFolder={onNewFolder}
        onPaste={onPaste}
        onCopyNoteText={onCopyNoteText}
        onEditNoteMessage={onEditNoteMessage}
        onRestoreFromRecycleBin={onRestoreFromRecycleBin}
        onFolderSettings={onOpenFolderSettings}
        onCopy={(file) => onStageClipboardItem("copy", file)}
        onCut={(file) => onStageClipboardItem("cut", file)}
        onDownload={onDownloadSavedFile}
        onDeleteNoteFromTelegram={onDeleteNoteFromTelegram}
      />

      <FolderSettingsDialog
        folder={folderSettingsTarget}
        isOpen={!!folderSettingsTarget}
        onClose={onCloseFolderSettings}
        onSaved={onFolderSettingsSaved}
      />

      <TextInputDialog
        isOpen={isNewFolderDialogOpen}
        title="Create Folder"
        description="Enter a name for the new folder."
        value={newFolderName}
        placeholder="Folder name"
        confirmLabel="Create"
        cancelLabel="Cancel"
        onValueChange={setNewFolderName}
        onConfirm={onConfirmNewFolder}
        onCancel={onCancelNewFolder}
      />

      <TextInputDialog
        isOpen={!!renameTarget}
        title="Rename Item"
        description={renameTarget ? `Rename ${renameTarget.name}` : undefined}
        value={renameValue}
        placeholder="New name"
        confirmLabel="Rename"
        cancelLabel="Cancel"
        icon={<Edit3 className="w-4 h-4 text-primary" />}
        framed
        onValueChange={setRenameValue}
        onConfirm={onConfirmRename}
        onCancel={onCancelRename}
      />

      <TextInputDialog
        isOpen={!!noteEditTarget}
        title="Edit Message"
        description={noteEditTarget ? "Update note message text" : undefined}
        value={noteEditValue}
        placeholder="Message"
        confirmLabel="Save"
        cancelLabel="Cancel"
        icon={<Edit3 className="w-4 h-4 text-primary" />}
        framed
        onValueChange={setNoteEditValue}
        onConfirm={onConfirmEditNoteMessage}
        onCancel={onCancelEditNoteMessage}
      />

      <ConfirmDialog
        isOpen={!!pendingMoveConfirm}
        title={pendingMoveConfirm?.title || "Move items"}
        message={pendingMoveConfirm?.message || ""}
        confirmLabel="Move"
        cancelLabel="Cancel"
        variant="primary"
        onCancel={() => {
          const pending = pendingMoveConfirm;
          setPendingMoveConfirm(null);
          pending?.onCancel?.();
        }}
        onConfirm={() => {
          const pending = pendingMoveConfirm;
          setPendingMoveConfirm(null);
          if (!pending) return;
          void pending.run();
        }}
      />

      <ConfirmDialog
        isOpen={!!pendingRenameConfirm}
        title="Rename item"
        message={
          pendingRenameConfirm
            ? `Rename "${pendingRenameConfirm.file.name}" to "${pendingRenameConfirm.newName}"?`
            : ""
        }
        confirmLabel="Rename"
        cancelLabel="Cancel"
        variant="primary"
        onCancel={() => setPendingRenameConfirm(null)}
        onConfirm={() => {
          const pending = pendingRenameConfirm;
          setPendingRenameConfirm(null);
          if (!pending) return;
          onPerformRename(pending.file, pending.newName);
        }}
      />

      <ConfirmDialog
        isOpen={deleteTargets.length > 0}
        title={
          isPermanentDeleteTarget
            ? "Delete Permanently"
            : isSavedDeleteTarget
              ? "Move to Recycle Bin"
              : isMultiDelete
                ? "Delete Items"
                : "Delete Item"
        }
        message={
          <p>
            {isPermanentDeleteTarget ? (
              <>
                Delete{isMultiDelete ? "" : " "}
                <strong>
                  {isMultiDelete
                    ? `${deleteTargets.length} items`
                    : deleteTarget?.name}
                </strong>{" "}
                from Recycle Bin permanently? This action cannot be undone.
              </>
            ) : isSavedDeleteTarget ? (
              <>
                Move{isMultiDelete ? "" : " "}
                <strong>
                  {isMultiDelete
                    ? `${deleteTargets.length} items`
                    : deleteTarget?.name}
                </strong>{" "}
                to Recycle Bin? You can restore it later.
              </>
            ) : (
              <>
                Are you sure you want to delete{isMultiDelete ? "" : " "}
                <strong>
                  {isMultiDelete
                    ? `${deleteTargets.length} items`
                    : deleteTarget?.name}
                </strong>
                ? This action cannot be undone.
              </>
            )}
          </p>
        }
        confirmLabel={
          isPermanentDeleteTarget
            ? "Delete Permanently"
            : isSavedDeleteTarget
              ? "Move to Recycle Bin"
              : "Delete"
        }
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => onConfirmDelete(deleteTargets)}
        onCancel={onCancelDelete}
      />

      {uploadConfirmDraft ? (
        <UploadConfirmWidget
          isOpen
          draft={uploadConfirmDraft}
          maxFileBytes={(uploadPremiumUser ? 4 : 2) * 1024 * 1024 * 1024}
          onChange={(next) => setUploadConfirmDraft(next)}
          onClose={() => setUploadConfirmDraft(null)}
          onConfirm={() => onConfirmUploadDraft(uploadConfirmDraft)}
        />
      ) : null}
    </>
  );
}
