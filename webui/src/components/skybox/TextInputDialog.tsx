import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { TelegramButton } from "./TelegramButton";

interface TextInputDialogProps {
  isOpen: boolean;
  title: string;
  description?: string;
  value: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  icon?: ReactNode;
  framed?: boolean;
  onValueChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function TextInputDialog({
  isOpen,
  title,
  description,
  value,
  placeholder,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  icon,
  framed = false,
  onValueChange,
  onConfirm,
  onCancel,
}: TextInputDialogProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onConfirm();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 top-[var(--titlebar-height)] z-[90] flex items-center justify-center p-4">
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
                {icon && (
                  <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
                    {icon}
                  </div>
                )}
                <h2 className="text-body font-semibold text-foreground">
                  {title}
                </h2>
              </div>
              <button
                onClick={onCancel}
                className="p-1 rounded hover:bg-sidebar-accent/50 transition-colors outline-none focus-visible:outline-none"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {description && (
                <p className="text-body text-muted-foreground">{description}</p>
              )}
              <input
                ref={inputRef}
                value={value}
                onChange={(event) => onValueChange(event.target.value)}
                onKeyDown={handleInputKeyDown}
                className={`w-full bg-secondary/60 rounded-lg px-3 py-2 text-body text-foreground placeholder:text-muted-foreground outline-none focus:outline-none focus:ring-0 transition-all duration-150 border ${
                  framed
                    ? "border-border"
                    : "border-border/40 hover:border-border/70 focus:border-border"
                }`}
                placeholder={placeholder}
              />
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
                variant="primary"
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
