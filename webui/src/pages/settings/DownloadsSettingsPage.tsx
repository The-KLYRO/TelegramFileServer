import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import SettingsSectionLayout from "./SettingsSectionLayout";

export default function DownloadsSettingsPage() {
  const [downloadsFolder, setDownloadsFolder] = useState("");
  const [downloadConflictPolicy, setDownloadConflictPolicy] =
    useState("rename");
  const [askWhereToSave, setAskWhereToSave] = useState(false);
  const [autoOpenAfterDownload, setAutoOpenAfterDownload] = useState(false);

  const saveSetting = useCallback(async (key: string, value: string) => {
    try {
      await invoke("db_set_setting", { key, value });
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
      invoke<string | null>("db_get_setting", { key: "downloads_folder" }),
      invoke<string | null>("db_get_setting", {
        key: "download_conflict_policy",
      }),
      invoke<string | null>("db_get_setting", {
        key: "download_ask_where_to_save",
      }),
      invoke<string | null>("db_get_setting", { key: "download_auto_open" }),
    ])
      .then(([folder, policy, askWhere, autoOpen]) => {
        if (cancelled) return;
        if (folder && folder.trim()) setDownloadsFolder(folder);
        if (policy && policy.trim()) setDownloadConflictPolicy(policy);
        if (askWhere === "1") setAskWhereToSave(true);
        if (askWhere === "0") setAskWhereToSave(false);
        if (autoOpen === "1") setAutoOpenAfterDownload(true);
        if (autoOpen === "0") setAutoOpenAfterDownload(false);
      })
      .catch(() => {
        // ignore
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SettingsSectionLayout title="Downloads">
      <div className="rounded-xl border border-border bg-glass overflow-hidden">
        <div className="px-4 py-4 border-b border-border">
          <p className="text-body font-semibold text-foreground">Downloads</p>
          <p className="text-small text-muted-foreground">
            Configure where and how downloads are saved.
          </p>
        </div>

        <div className="px-4 py-4 space-y-6">
          <div>
            <p className="text-small font-medium text-foreground">
              Default download folder
            </p>
            <p className="text-small text-muted-foreground mt-1">
              Leave empty to use the system default.
            </p>
            <div className="mt-3">
              <input
                value={downloadsFolder}
                onChange={(e) => setDownloadsFolder(e.target.value)}
                onBlur={() =>
                  void saveSetting("downloads_folder", downloadsFolder.trim())
                }
                className="w-full h-10 rounded-md border border-border bg-background/60 px-3 text-small text-foreground"
                placeholder="(optional)"
              />
            </div>
          </div>

          <div>
            <p className="text-small font-medium text-foreground">
              Name conflicts
            </p>
            <div className="mt-3">
              <RadioGroup
                value={downloadConflictPolicy}
                onValueChange={(value) => {
                  setDownloadConflictPolicy(value);
                  void saveSetting("download_conflict_policy", value);
                }}
                className="space-y-2"
              >
                <label className="flex items-center gap-3">
                  <RadioGroupItem value="rename" />
                  <span className="text-small text-foreground">Rename</span>
                </label>
                <label className="flex items-center gap-3">
                  <RadioGroupItem value="overwrite" />
                  <span className="text-small text-foreground">Overwrite</span>
                </label>
                <label className="flex items-center gap-3">
                  <RadioGroupItem value="skip" />
                  <span className="text-small text-foreground">Skip</span>
                </label>
              </RadioGroup>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-small font-medium text-foreground">
                Ask where to save
              </p>
              <p className="text-small text-muted-foreground truncate">
                Prompt for a destination each time.
              </p>
            </div>
            <Switch
              checked={askWhereToSave}
              onCheckedChange={(checked) => {
                setAskWhereToSave(checked);
                void saveSetting(
                  "download_ask_where_to_save",
                  checked ? "1" : "0",
                );
              }}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-small font-medium text-foreground">
                Auto-open after download
              </p>
              <p className="text-small text-muted-foreground truncate">
                Open the file when download completes.
              </p>
            </div>
            <Switch
              checked={autoOpenAfterDownload}
              onCheckedChange={(checked) => {
                setAutoOpenAfterDownload(checked);
                void saveSetting("download_auto_open", checked ? "1" : "0");
              }}
            />
          </div>
        </div>
      </div>
    </SettingsSectionLayout>
  );
}
