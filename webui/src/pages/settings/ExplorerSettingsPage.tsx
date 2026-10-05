import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import SettingsSectionLayout from "./SettingsSectionLayout";

type ExplorerViewMode = "list" | "grid";

export default function ExplorerSettingsPage() {
  const [explorerViewMode, setExplorerViewMode] =
    useState<ExplorerViewMode>("grid");
  const [explorerHomePath, setExplorerHomePath] = useState("tg://saved");
  const [explorerRecentsLimit, setExplorerRecentsLimit] = useState("25");
  const [explorerShowFavorites, setExplorerShowFavorites] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(true);
  const [confirmMove, setConfirmMove] = useState(true);

  const saveSetting = useCallback(async (key: string, value: string) => {
    try {
      await invoke("db_set_setting", { key, value });

      window.dispatchEvent(
        new CustomEvent("skybox-explorer-setting-changed", {
          detail: { key, value },
        }),
      );
    } catch (error) {
      toast({
        title: "Failed to save setting",
        description:
          typeof error === "object" && error && "message" in error
            ? String((error as { message?: unknown }).message)
            : "An unknown error occurred",
        variant: "destructive",
      });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      invoke<string | null>("db_get_setting", { key: "explorer_view_mode" }),
      invoke<string | null>("db_get_setting", { key: "explorer_home_path" }),
      invoke<string | null>("db_get_setting", {
        key: "explorer_recents_limit",
      }),
      invoke<string | null>("db_get_setting", {
        key: "explorer_show_favorites",
      }),
      invoke<string | null>("db_get_setting", { key: "confirm_delete" }),
      invoke<string | null>("db_get_setting", { key: "confirm_move" }),
    ])
      .then(
        ([
          viewMode,
          homePath,
          recentsLimit,
          showFavorites,
          confirmDeleteValue,
          confirmMoveValue,
        ]) => {
          if (cancelled) return;

          if (viewMode === "list" || viewMode === "grid") {
            setExplorerViewMode(viewMode);
          }
          if (homePath && homePath.trim()) {
            setExplorerHomePath(homePath);
          }
          if (recentsLimit && recentsLimit.trim()) {
            setExplorerRecentsLimit(recentsLimit);
          }
          if (showFavorites === "0") {
            setExplorerShowFavorites(false);
          } else if (showFavorites === "1") {
            setExplorerShowFavorites(true);
          }
          if (confirmDeleteValue === "0") setConfirmDelete(false);
          if (confirmDeleteValue === "1") setConfirmDelete(true);
          if (confirmMoveValue === "0") setConfirmMove(false);
          if (confirmMoveValue === "1") setConfirmMove(true);
        },
      )
      .catch(() => {
        // ignore
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SettingsSectionLayout title="Explorer">
      <div className="rounded-xl border border-border bg-glass overflow-hidden">
        <div className="px-4 py-4 border-b border-border">
          <p className="text-body font-semibold text-foreground">Layout</p>
          <p className="text-small text-muted-foreground">
            Set defaults for how Explorer opens.
          </p>
        </div>

        <div className="px-4 py-4 space-y-6">
          <div>
            <p className="text-small font-medium text-foreground">
              Default view
            </p>
            <div className="mt-3">
              <RadioGroup
                value={explorerViewMode}
                onValueChange={(value) => {
                  if (value !== "list" && value !== "grid") return;
                  setExplorerViewMode(value);
                  void saveSetting("explorer_view_mode", value);
                }}
                className="space-y-2"
              >
                <label className="flex items-center gap-3">
                  <RadioGroupItem value="grid" />
                  <span className="text-small text-foreground">Grid</span>
                </label>
                <label className="flex items-center gap-3">
                  <RadioGroupItem value="list" />
                  <span className="text-small text-foreground">List</span>
                </label>
              </RadioGroup>
            </div>
          </div>

          <div>
            <p className="text-small font-medium text-foreground">
              Default home path
            </p>
            <p className="text-small text-muted-foreground mt-1">
              Used as a preference for new sessions/tabs.
            </p>
            <div className="mt-3">
              <input
                value={explorerHomePath}
                onChange={(e) => setExplorerHomePath(e.target.value)}
                onBlur={() =>
                  void saveSetting(
                    "explorer_home_path",
                    explorerHomePath.trim() || "tg://saved",
                  )
                }
                className="w-full h-10 rounded-md border border-border bg-background/60 px-3 text-small text-foreground"
                placeholder="tg://saved"
              />
            </div>
          </div>

          <div>
            <p className="text-small font-medium text-foreground">
              Recents limit
            </p>
            <p className="text-small text-muted-foreground mt-1">
              How many recent paths to keep.
            </p>
            <div className="mt-3">
              <input
                value={explorerRecentsLimit}
                onChange={(e) => setExplorerRecentsLimit(e.target.value)}
                onBlur={() =>
                  void saveSetting(
                    "explorer_recents_limit",
                    explorerRecentsLimit.trim() || "25",
                  )
                }
                className="w-full h-10 rounded-md border border-border bg-background/60 px-3 text-small text-foreground"
                inputMode="numeric"
                placeholder="25"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-small font-medium text-foreground">
                Show favorites
              </p>
              <p className="text-small text-muted-foreground truncate">
                Display favorites section in the sidebar.
              </p>
            </div>
            <Switch
              checked={explorerShowFavorites}
              onCheckedChange={(checked) => {
                setExplorerShowFavorites(checked);
                void saveSetting(
                  "explorer_show_favorites",
                  checked ? "1" : "0",
                );
              }}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-glass overflow-hidden">
        <div className="px-4 py-4 border-b border-border">
          <p className="text-body font-semibold text-foreground">
            Confirmations
          </p>
          <p className="text-small text-muted-foreground">
            Control safety prompts for destructive actions.
          </p>
        </div>

        <div className="px-4 py-4 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-small font-medium text-foreground">
                Confirm delete
              </p>
              <p className="text-small text-muted-foreground truncate">
                Ask before deleting files.
              </p>
            </div>
            <Switch
              checked={confirmDelete}
              onCheckedChange={(checked) => {
                setConfirmDelete(checked);
                void saveSetting("confirm_delete", checked ? "1" : "0");
              }}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-small font-medium text-foreground">
                Confirm move
              </p>
              <p className="text-small text-muted-foreground truncate">
                Ask before moving items.
              </p>
            </div>
            <Switch
              checked={confirmMove}
              onCheckedChange={(checked) => {
                setConfirmMove(checked);
                void saveSetting("confirm_move", checked ? "1" : "0");
              }}
            />
          </div>
        </div>
      </div>
    </SettingsSectionLayout>
  );
}
