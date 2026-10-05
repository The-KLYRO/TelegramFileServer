import { Search, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({
  value,
  onChange,
  placeholder = "Search...",
}: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape" && isFocused) {
        inputRef.current?.blur();
        onChange("");
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isFocused, onChange]);

  return (
    <div
      className={`relative flex items-center transition-all duration-150 ${
        isFocused ? "w-72" : "w-56"
      }`}
    >
      <Search className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        className="w-full pl-9 pr-8 py-2 bg-secondary border border-border rounded-lg text-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all duration-150"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-2 p-1 rounded hover:bg-card transition-colors"
        >
          <X className="w-3 h-3 text-muted-foreground" />
        </button>
      )}
      {!value && !isFocused && (
        <span className="absolute right-3 text-small text-muted-foreground">
          ⌘F
        </span>
      )}
    </div>
  );
}
