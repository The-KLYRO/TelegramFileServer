import { InputHTMLAttributes, forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface TelegramInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const TelegramInput = forwardRef<HTMLInputElement, TelegramInputProps>(
  ({ label, error, hint, className = "", type, ...props }, ref) => {
    const isPasswordField = type === "password";
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-small text-muted-foreground font-medium">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            type={
              isPasswordField && isPasswordVisible ? "text" : (type ?? "text")
            }
            className={`w-full bg-secondary border rounded-lg text-body text-foreground placeholder:text-muted-foreground focus:outline-none transition-all duration-150 ${
              isPasswordField ? "telegram-password-input pr-12" : "px-4"
            } py-3 px-4 ${
              error
                ? "border-destructive focus:ring-2 focus:ring-destructive/30"
                : "border-border focus:border-primary focus:ring-2 focus:ring-primary/20"
            } ${className}`}
            {...props}
          />

          {isPasswordField && (
            <button
              type="button"
              onClick={() => setIsPasswordVisible((value) => !value)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white transition-colors hover:text-white/80"
              aria-label={isPasswordVisible ? "Hide password" : "Show password"}
            >
              {isPasswordVisible ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
        {error && <p className="text-small text-destructive">{error}</p>}
        {hint && !error && (
          <p className="text-small text-muted-foreground">{hint}</p>
        )}
      </div>
    );
  },
);

TelegramInput.displayName = "TelegramInput";
