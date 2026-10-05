import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export default function SettingsSectionLayout({
  title,
  children,
  scrollable = true,
  containerClassName,
  contentClassName,
}: {
  title: string;
  children: ReactNode;
  scrollable?: boolean;
  containerClassName?: string;
  contentClassName?: string;
}) {
  return (
    <div
      className={cn(
        "flex-1 p-5",
        scrollable ? "overflow-y-auto" : "overflow-hidden",
        containerClassName,
      )}
    >
      <div className={cn("max-w-3x2 space-y-4", contentClassName)}>
        <div className="sr-only">{title}</div>
        {children}
      </div>
    </div>
  );
}
