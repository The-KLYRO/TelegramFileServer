import { ReactNode } from "react";
import { AlertTriangle, X } from "lucide-react";
import { TelegramButton } from "./TelegramButton";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string | ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 top-[var(--titlebar-height)] z-[110] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-background/70 animate-fade-in"
        onClick={onCancel}
      />

      <div className="relative w-full max-w-md">
        <div className="floating-dialog-backdrop absolute inset-0 rounded-xl" />
        <div className="floating-dialog-shell relative overflow-hidden rounded-xl shadow-2xl shadow-black/50">
          <div className="animate-scale-in">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                {variant === "danger" && (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/15">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                  </div>
                )}
                <h2 className="text-body font-semibold text-foreground">
                  {title}
                </h2>
              </div>
              <button
                onClick={onCancel}
                className="p-1 rounded hover:bg-sidebar-accent/50 transition-colors outline-none focus-visible:outline-none"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <div className="p-4">
              {typeof message === "string" ? (
                <p className="text-body text-muted-foreground">{message}</p>
              ) : (
                message
              )}
            </div>

            <div className="flex justify-end gap-3 p-4">
              <TelegramButton
                variant="secondary"
                onClick={onCancel}
                className="outline-none focus-visible:outline-none focus-visible:ring-0"
              >
                {cancelLabel}
              </TelegramButton>
              <TelegramButton
                variant={variant === "danger" ? "danger" : "primary"}
                onClick={onConfirm}
                className="outline-none focus-visible:outline-none focus-visible:ring-0"
              >
                {confirmLabel}
              </TelegramButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
