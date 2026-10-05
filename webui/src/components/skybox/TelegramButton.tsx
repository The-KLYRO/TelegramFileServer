import { ReactNode } from "react";
import { Loader2 } from "lucide-react";

interface TelegramButtonProps {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
}

export function TelegramButton({
  children,
  onClick,
  type = "button",
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  fullWidth = false,
  className = "",
}: TelegramButtonProps) {
  const baseClasses =
    "inline-flex items-center justify-center font-medium transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100";

  const variantClasses = {
    primary: "bg-primary hover:bg-accent text-primary-foreground",
    secondary:
      "bg-secondary hover:bg-telegram-panel-2 text-foreground border border-border",
    ghost: "bg-transparent hover:bg-secondary text-foreground",
    danger:
      "bg-destructive hover:bg-destructive/90 text-destructive-foreground",
  };

  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm rounded-md gap-1.5",
    md: "px-5 py-2.5 text-sm rounded-lg gap-2",
    lg: "px-6 py-3 text-base rounded-lg gap-2",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${fullWidth ? "w-full" : ""} ${className}`}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}
