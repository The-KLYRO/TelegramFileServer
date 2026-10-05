import { useRef, useState } from "react";
import { type FileItem } from "@/components/skybox/FileRow";
import { getExplorerSessionState } from "@/pages/explorer/explorerSessionStore";
import {
  DEFAULT_EXPLORER_HOME_PATH,
  DEFAULT_EXPLORER_RECENTS_LIMIT,
  type ExplorerClipboardItem,
  type ExplorerContextMenuState,
  type ExplorerSortDirection,
  type ExplorerSortField,
  type PasteProgressState,
  type SelectionBoxState,
  type UserInfo,
} from "@/pages/explorer/shared";
import { type UploadConfirmDraft } from "@/components/skybox/UploadConfirmWidget";

export function useExplorerControllerState() {
  const sessionState = getExplorerSessionState();
  const [search, setSearch] = useState(() => sessionState.search);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(
    () => sessionState.selectedFile,
  );
  const [showDetails, setShowDetails] = useState(false);
  const [isDetailsPanelOpen, setIsDetailsPanelOpen] = useState(false);
  const [explorerHomePath, setExplorerHomePath] = useState<string>(
    () => sessionState.explorerHomePath || DEFAULT_EXPLORER_HOME_PATH,
  );
  const [recentPaths, setRecentPaths] = useState<string[]>(
    () => sessionState.recentPaths,
  );
  const [showFavorites, setShowFavorites] = useState(
    () => sessionState.showFavorites,
  );
  const [pendingMoveConfirm, setPendingMoveConfirm] = useState<{
    title: string;
    message: string;
    run: () => Promise<void>;
    onCancel?: () => void;
  } | null>(null);
  const [pendingRenameConfirm, setPendingRenameConfirm] = useState<{
    file: FileItem;
    newName: string;
  } | null>(null);
  const [contextMenuState, setContextMenuState] =
    useState<ExplorerContextMenuState | null>(null);
  const [clipboardItem, setClipboardItem] =
    useState<ExplorerClipboardItem | null>(null);
  const [favorites, setFavorites] = useState<string[]>(
    () => sessionState.favorites,
  );
  const [deleteTargets, setDeleteTargets] = useState<FileItem[]>([]);
  const [shareTarget, setShareTarget] = useState<FileItem | null>(null);
  const [isNewFolderDialogOpen, setIsNewFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [folderSettingsTarget, setFolderSettingsTarget] =
    useState<FileItem | null>(null);
  const [renameTarget, setRenameTarget] = useState<FileItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [noteEditTarget, setNoteEditTarget] = useState<FileItem | null>(null);
  const [noteEditValue, setNoteEditValue] = useState("");
  const [noteComposerValue, setNoteComposerValue] = useState("");
  const [isSendingNoteMessage, setIsSendingNoteMessage] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [files, setFiles] = useState<FileItem[]>(() => sessionState.files);
  const [currentPath, setCurrentPath] = useState<string>(
    () => sessionState.currentPath || DEFAULT_EXPLORER_HOME_PATH,
  );
  const [error, setError] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [draggedPaths, setDraggedPaths] = useState<string[]>([]);
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);
  const [isExternalDragging, setIsExternalDragging] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState<string[]>(
    () => sessionState.selectedPaths,
  );
  const [sortField, setSortField] = useState<ExplorerSortField>(
    () => sessionState.sortField,
  );
  const [sortDirection, setSortDirection] = useState<ExplorerSortDirection>(
    () => sessionState.sortDirection,
  );
  const [selectionBox, setSelectionBox] = useState<SelectionBoxState | null>(
    null,
  );
  const [activePaste, setActivePaste] = useState<PasteProgressState | null>(
    null,
  );
  const [uploadConfirmDraft, setUploadConfirmDraft] =
    useState<UploadConfirmDraft | null>(null);
  const [uploadPremiumUser, setUploadPremiumUser] = useState<boolean | null>(
    null,
  );
  const [backHistory, setBackHistory] = useState<string[]>(
    () => sessionState.backHistory,
  );
  const [forwardHistory, setForwardHistory] = useState<string[]>(
    () => sessionState.forwardHistory,
  );

  const explorerHomePathRef = useRef<string>(DEFAULT_EXPLORER_HOME_PATH);
  const explorerRecentsLimitRef = useRef<number>(
    DEFAULT_EXPLORER_RECENTS_LIMIT,
  );
  const showFavoritesRef = useRef(sessionState.showFavorites);
  const confirmDeleteRef = useRef(true);
  const confirmMoveRef = useRef(true);
  const confirmRenameRef = useRef(true);
  const runDeleteTargetsRef = useRef<(targets: FileItem[]) => void>(() => {});
  const filesRef = useRef<FileItem[]>(sessionState.files);
  const currentPathRef = useRef(
    sessionState.currentPath || DEFAULT_EXPLORER_HOME_PATH,
  );
  const searchRef = useRef(sessionState.search);
  const selectedPathsRef = useRef<string[]>(sessionState.selectedPaths);
  const selectedFileRef = useRef<FileItem | null>(sessionState.selectedFile);
  const selectionAnchorPathRef = useRef<string | null>(null);
  const lastNavigationAtRef = useRef(Date.now());
  const explorerAreaRef = useRef<HTMLDivElement | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const detailsPanelRef = useRef<HTMLDivElement | null>(null);
  const detailsPanelCloseTimerRef = useRef<number | null>(null);
  const isViewerOpenRef = useRef({ media: false, localImage: false });
  const closeViewerRef = useRef({
    closeMedia: () => {},
    closeLocalImage: () => {},
  });
  const navigationStateRef = useRef({
    backHistory: sessionState.backHistory,
    forwardHistory: sessionState.forwardHistory,
    currentPath: sessionState.currentPath || DEFAULT_EXPLORER_HOME_PATH,
    isLoading: false,
  });
  const applyFetchedThumbnailRef = useRef<
    (messageId: number, thumbnailSrc: string) => void
  >(() => {});
  const handleFileOpenRef = useRef<(file: FileItem) => Promise<void> | void>(
    () => {},
  );
  const navigateToPathRef = useRef<(path: string) => Promise<void> | void>(
    () => {},
  );

  return {
    activePaste,
    applyFetchedThumbnailRef,
    avatarUrl,
    backHistory,
    clipboardItem,
    closeViewerRef,
    confirmDeleteRef,
    confirmMoveRef,
    confirmRenameRef,
    contextMenuRef,
    contextMenuState,
    currentPath,
    currentPathRef,
    deleteTargets,
    detailsPanelCloseTimerRef,
    detailsPanelRef,
    draggedPaths,
    dropTargetPath,
    error,
    explorerAreaRef,
    explorerHomePath,
    explorerHomePathRef,
    explorerRecentsLimitRef,
    favorites,
    files,
    filesRef,
    folderSettingsTarget,
    forwardHistory,
    handleFileOpenRef,
    isDetailsPanelOpen,
    isExternalDragging,
    isLoading,
    isSendingNoteMessage,
    isViewerOpenRef,
    navigateToPathRef,
    navigationStateRef,
    newFolderName,
    noteComposerValue,
    noteEditTarget,
    noteEditValue,
    pendingMoveConfirm,
    pendingRenameConfirm,
    phoneNumber,
    recentPaths,
    renameTarget,
    renameValue,
    runDeleteTargetsRef,
    search,
    searchRef,
    selectedFile,
    selectedFileRef,
    selectedPaths,
    selectedPathsRef,
    selectionAnchorPathRef,
    selectionBox,
    sortDirection,
    sortField,
    setActivePaste,
    setAvatarUrl,
    setBackHistory,
    setClipboardItem,
    setContextMenuState,
    setCurrentPath,
    setDeleteTargets,
    setDropTargetPath,
    setError,
    setExplorerHomePath,
    setFavorites,
    setFiles,
    setFolderSettingsTarget,
    setForwardHistory,
    setDraggedPaths,
    setIsDetailsPanelOpen,
    setIsExternalDragging,
    setIsLoading,
    setIsNewFolderDialogOpen,
    setIsSendingNoteMessage,
    setNewFolderName,
    setNoteComposerValue,
    setNoteEditTarget,
    setNoteEditValue,
    setPendingMoveConfirm,
    setPendingRenameConfirm,
    setPhoneNumber,
    setRecentPaths,
    setRenameTarget,
    setRenameValue,
    setSearch,
    setSelectedFile,
    setSelectedPaths,
    setSelectionBox,
    setSortDirection,
    setSortField,
    setShareTarget,
    setShowDetails,
    setShowFavorites,
    setUploadConfirmDraft,
    setUploadPremiumUser,
    setUserInfo,
    shareTarget,
    showDetails,
    showFavorites,
    showFavoritesRef,
    uploadConfirmDraft,
    uploadPremiumUser,
    userInfo,
    isNewFolderDialogOpen,
  };
}
