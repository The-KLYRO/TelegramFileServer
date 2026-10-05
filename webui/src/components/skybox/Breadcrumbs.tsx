import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbItem {
  name: string;
  path: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  onNavigate: (path: string) => void;
  homePath?: string;
}

export function Breadcrumbs({
  items,
  onNavigate,
  homePath = "/",
}: BreadcrumbsProps) {
  return (
    <nav className="flex items-center gap-1 text-body overflow-x-auto">
      <button
        onClick={() => onNavigate(homePath)}
        className="flex items-center gap-1 px-2 py-1 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
      >
        <Home className="w-4 h-4" />
      </button>

      {items.map((item, index) => (
        <div key={item.path} className="flex items-center">
          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <button
            onClick={() => onNavigate(item.path)}
            className={`px-2 py-1 rounded transition-colors truncate max-w-[150px] ${
              index === items.length - 1
                ? "text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            {item.name}
          </button>
        </div>
      ))}
    </nav>
  );
}
