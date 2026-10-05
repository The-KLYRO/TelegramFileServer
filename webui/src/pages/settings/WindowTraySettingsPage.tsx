import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import SettingsSectionLayout from "./SettingsSectionLayout";

type WindowCloseBehavior = "hide" | "quit";

export default function WindowTraySettingsPage() {
  const [trayEnabled, setTrayEnabled] = useState(true);
  const [startMinimized, setStartMinimized] = useState(false);
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [windowCloseBehavior, setWindowCloseBehavior] =
    useState<WindowCloseBehavior>("hide");

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
      invoke<string | null>("db_get_setting", { key: "tray_enabled" }),
      invoke<string | null>("db_get_setting", { key: "start_minimized" }),
      invoke<string | null>("db_get_setting", { key: "window_close_behavior" }),
      invoke<boolean>("app_get_autostart_enabled").catch(() => false),
    ])
      .then(([tray, startMin, closeBehavior, autostart]) => {
        if (cancelled) return;
        if (tray === "0") setTrayEnabled(false);
        if (tray === "1") setTrayEnabled(true);
        if (startMin === "1") setStartMinimized(true);
        if (startMin === "0") setStartMinimized(false);
        if (closeBehavior === "hide" || closeBehavior === "quit") {
          setWindowCloseBehavior(closeBehavior);
        }
        setAutostartEnabled(Boolean(autostart));
      })
      .catch(() => {
        // ignore
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SettingsSectionLayout title="Window & Tray">
      <div className="rounded-xl border border-border bg-glass overflow-hidden">
        <div className="px-4 py-4 border-b border-border">
          <p className="text-body font-semibold text-foreground">Tray</p>
          <p className="text-small text-muted-foreground">
            Controls tray icon and close-to-tray behavior.
          </p>
        </div>

        <div className="px-4 py-4 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-small font-medium text-foreground">
                Start on system startup
              </p>
              <p className="text-small text-muted-foreground truncate">
                Starts hidden with tray icon only.
              </p>
            </div>
            <Switch
              checked={autostartEnabled}
              onCheckedChange={(checked) => {
                setAutostartEnabled(checked);
                void (async () => {
                  try {
                    const enabled = await invoke<boolean>(
                      "app_set_autostart_enabled",
                      { enabled: checked },
                    );
                    setAutostartEnabled(enabled);
                    if (enabled) {
                      setTrayEnabled(true);
                      setStartMinimized(true);
                      void saveSetting("tray_enabled", "1");
                      void saveSetting("start_minimized", "1");
                    }
                  } catch (error) {
                    toast({
                      title: "Failed to update startup",
                      description:
                        typeof error === "object" && error && "message" in error
                          ? String((error as { message?: unknown }).message)
                          : "An unknown error occurred",
                      variant: "destructive",
                    });
                    setAutostartEnabled(false);
                  }
                })();
              }}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-small font-medium text-foreground">
                Tray enabled
              </p>
              <p className="text-small text-muted-foreground truncate">
                Takes effect after restart.
              </p>
            </div>
            <Switch
              checked={trayEnabled}
              disabled={autostartEnabled}
              onCheckedChange={(checked) => {
                setTrayEnabled(checked);
                void saveSetting("tray_enabled", checked ? "1" : "0");
              }}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-glass overflow-hidden">
        <div className="px-4 py-4 border-b border-border">
          <p className="text-body font-semibold text-foreground">
            Window Buttons
          </p>
          <p className="text-small text-muted-foreground">
            Choose close behavior.
          </p>
        </div>

        <div className="px-4 py-4 space-y-6">
          <div>
            <p className="text-small font-medium text-foreground">
              Close button
            </p>
            <p className="text-small text-muted-foreground mt-1">
              If tray is disabled, the app will quit on close.
            </p>
            <div className="mt-3">
              <RadioGroup
                value={windowCloseBehavior}
                onValueChange={(value) => {
                  if (value !== "hide" && value !== "quit") return;
                  setWindowCloseBehavior(value);
                  void saveSetting("window_close_behavior", value);
                }}
                className="space-y-2"
              >
                <label className="flex items-center gap-3">
                  <RadioGroupItem value="hide" disabled={!trayEnabled} />
                  <span className="text-small text-foreground">
                    Hide to tray
                  </span>
                </label>
                <label className="flex items-center gap-3">
                  <RadioGroupItem value="quit" />
                  <span className="text-small text-foreground">Quit app</span>
                </label>
              </RadioGroup>
            </div>
          </div>
        </div>
      </div>
    </SettingsSectionLayout>
  );
}
