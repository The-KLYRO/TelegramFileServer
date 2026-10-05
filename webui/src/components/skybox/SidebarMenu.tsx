import { useState } from "react";
import {
  User,
  Users,
  Megaphone,
  MessageCircle,
  Contact,
  Phone,
  Settings,
  HelpCircle,
  Info,
  Moon,
  ChevronUp,
  ArrowLeft,
  QrCode,
  Palette,
  Lock,
  Bell,
  Database,
  Zap,
  Folder,
  Smartphone,
  Globe,
  Star,
  Store,
  Gift,
  Search,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface UserInfo {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  profile_photo?: string;
}

interface SidebarMenuProps {
  isOpen: boolean;
  onClose: () => void;
  userInfo?: UserInfo;
  avatarUrl?: string | null;
  phoneNumber?: string | null;
  onLogout?: () => void;
}

type MenuView = "main" | "settings";

export function SidebarMenu({
  isOpen,
  onClose,
  userInfo,
  avatarUrl,
  phoneNumber,
  onLogout,
}: SidebarMenuProps) {
  const [view, setView] = useState<MenuView>("main");

  if (!isOpen) return null;

  const nameParts = [
    userInfo?.first_name?.trim(),
    userInfo?.last_name?.trim(),
  ].filter((value): value is string => Boolean(value && value.length > 0));
  const displayName = nameParts.join(" ") || userInfo?.username || "User";

  const getInitials = () => {
    if (!userInfo) return "U";
    const first = userInfo.first_name?.charAt(0) || "";
    const last = userInfo.last_name?.charAt(0) || "";
    return (
      (first + last).toUpperCase() ||
      userInfo.username?.charAt(0).toUpperCase() ||
      "U"
    );
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => setView("main"), 200);
  };

  const mainMenuItems = [
    { icon: Folder, label: "Files" },
    { icon: User, label: "My Profile" },
    { separator: true },
    { icon: Users, label: "New Group" },
    { icon: Megaphone, label: "New Channel" },
    { separator: true },
    { icon: MessageCircle, label: "Chats" },
    { icon: Contact, label: "Contacts" },
    { icon: Phone, label: "Calls" },
    { icon: Settings, label: "Settings", onClick: () => setView("settings") },
    { separator: true },
    { icon: HelpCircle, label: "TelegramFileServer Features" },
    { icon: Info, label: "News" },
  ];

  const settingsItems = [
    { icon: User, label: "Account", color: "text-emerald-500" },
    { icon: Palette, label: "Appearance", color: "text-orange-400" },
    { icon: Lock, label: "Privacy and Security", color: "text-blue-400" },
    { icon: Bell, label: "Notifications and Sounds", color: "text-sky-400" },
    { icon: Database, label: "Data and Storage", color: "text-blue-500" },
    { icon: Zap, label: "Power Saving", color: "text-yellow-500" },
    { icon: Folder, label: "Chat Folders", color: "text-amber-500" },
    { icon: Smartphone, label: "Devices", color: "text-gray-400" },
    { icon: Globe, label: "Language", color: "text-blue-400" },
    { icon: Settings, label: "Advanced", color: "text-gray-500" },
    { separator: true },
    { icon: Star, label: "Telegram Premium", color: "text-purple-400" },
    { icon: Star, label: "My Stars", color: "text-orange-400" },
    { icon: Store, label: "Telegram Business", color: "text-pink-400" },
    { icon: Gift, label: "Send a Gift", color: "text-green-400" },
    { separator: true },
    { icon: HelpCircle, label: "Ask a Question", color: "text-sky-400" },
  ];

  return (
    <div className="absolute inset-0 z-50 bg-background flex flex-col animate-in fade-in slide-in-from-left duration-200 overflow-hidden">
      {/* --- SHARED HEADER (Fixed Position) --- */}
      <div className="p-4 flex flex-col gap-4 z-10 bg-background/95 backdrop-blur-sm">
        {/* Navigation / App Title Area */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {view === "settings" && (
              <button
                onClick={() => setView("main")}
                className="text-muted-foreground hover:text-foreground p-1 transition-colors"
                aria-label="Back"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
            )}
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center p-1">
                <div className="w-full h-full text-primary-foreground">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.93 1.23-5.46 3.62-.51.35-.98.52-1.4.51-.46-.01-1.35-.26-2.01-.48-.81-.27-1.45-.42-1.39-.88.03-.24.3-.48.82-.74 3.2-1.39 5.33-2.31 6.4-2.75 3.03-1.25 3.67-1.47 4.08-1.47.09 0 .29.02.42.13.11.09.14.21.16.29.03.04.04.14.04.22z" />
                  </svg>
                </div>
              </div>
              <h2 className="text-lg font-bold text-foreground">TelegramFileServer</h2>
            </div>
          </div>
          <button className="text-muted-foreground hover:text-foreground p-1 transition-colors">
            <Moon className="w-6 h-6" />
          </button>
        </div>

        {/* Search Bar (Only in Settings) - Keep space to avoid jump */}
        <div
          className={`transition-all duration-300 overflow-hidden ${view === "settings" ? "h-10 opacity-100 mb-1" : "h-0 opacity-0 mb-0"}`}
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search Settings and FAQ"
              className="w-full bg-secondary/50 border-none rounded-md py-1.5 pl-9 pr-4 text-small focus:ring-1 focus:ring-primary outline-none transition-all"
            />
          </div>
        </div>

        {/* Shared Profile Area (Consistent Size/Place) */}
        <div className="flex items-center justify-between group px-1">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10 transition-transform group-hover:scale-105">
              <AvatarImage src={avatarUrl || ""} />
              <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-body">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <h2 className="text-body font-medium text-foreground truncate max-w-[140px]">
                {displayName}
              </h2>
              {view === "main" ? (
                <p className="text-small text-muted-foreground">
                  {phoneNumber || userInfo?.username || "No phone"}
                </p>
              ) : (
                <p className="text-small text-emerald-500 font-medium">
                  online
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col items-center">
            {view === "settings" && (
              <button className="text-muted-foreground hover:text-foreground p-2 transition-colors">
                <QrCode className="w-6 h-6" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* --- SLIDING CONTENT CONTAINER --- */}
      <div className="flex-1 relative overflow-hidden">
        {/* Main Menu View */}
        <div
          className={`absolute inset-0 p-2 overflow-y-auto scrollbar-thin transition-transform duration-300 ease-in-out ${view === "settings" ? "-translate-x-full" : "translate-x-0"}`}
        >
          {mainMenuItems.map((item, index) => {
            if (item.separator) {
              return (
                <div
                  key={`sep-${index}`}
                  className="h-px bg-border my-2 mx-2"
                />
              );
            }

            const Icon = item.icon!;
            return (
              <button
                key={item.label}
                onClick={item.onClick}
                className="w-full flex items-center gap-4 px-3 py-3 rounded-lg transition-colors group text-foreground hover:bg-sidebar-accent/50 text-left"
              >
                <Icon className="w-6 h-6 text-muted-foreground group-hover:text-foreground transition-colors" />
                <span className="text-body font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Settings View */}
        <div
          className={`absolute inset-0 px-2 pb-4 overflow-y-auto scrollbar-thin transition-transform duration-300 ease-in-out ${view === "settings" ? "translate-x-0" : "translate-x-full"}`}
        >
          <div className="space-y-1">
            {settingsItems.map((item, index) => {
              if (item.separator) {
                return (
                  <div
                    key={`sep-set-${index}`}
                    className="h-px bg-border my-2 mx-2"
                  />
                );
              }

              const Icon = item.icon!;
              return (
                <button
                  key={item.label}
                  className="w-full flex items-center gap-4 px-3 py-2.5 rounded-lg transition-colors group text-foreground hover:bg-sidebar-accent/50 text-left"
                >
                  <Icon
                    className={`w-5 h-5 ${item.color} group-hover:scale-110 transition-transform`}
                  />
                  <span className="text-body font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
