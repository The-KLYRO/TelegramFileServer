import { useState, useEffect, useRef } from "react";
import { Search, X, User, Loader2, Send } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TelegramButton } from "./TelegramButton";

export interface TelegramContact {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  phone?: string;
  profile_photo?: string;
}

interface ShareWidgetProps {
  isOpen: boolean;
  fileName: string;
  onClose: () => void;
  onShare: (chatId: number) => Promise<void>;
  onSearchContacts: (query: string) => Promise<TelegramContact[]>;
  onGetRecentChats: () => Promise<TelegramContact[]>;
}

export function ShareWidget({
  isOpen,
  fileName,
  onClose,
  onShare,
  onSearchContacts,
  onGetRecentChats,
}: ShareWidgetProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [contacts, setContacts] = useState<TelegramContact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [selectedContact, setSelectedContact] =
    useState<TelegramContact | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setContacts([]);
      setSelectedContact(null);
      setIsLoading(true);
      onGetRecentChats()
        .then((recentChats) => {
          setContacts(recentChats);
        })
        .catch(console.error)
        .finally(() => {
          setIsLoading(false);
        });
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, onGetRecentChats]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      onGetRecentChats()
        .then((recentChats) => {
          setContacts(recentChats);
        })
        .catch(console.error);
      return;
    }

    const debounceTimer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const results = await onSearchContacts(searchQuery);
        setContacts(results);
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, onSearchContacts, onGetRecentChats]);

  const handleShare = async () => {
    if (!selectedContact) return;

    setIsSending(true);
    try {
      await onShare(selectedContact.id);
      onClose();
    } catch (error) {
      console.error("Share failed:", error);
    } finally {
      setIsSending(false);
    }
  };

  const getInitials = (contact: TelegramContact): string => {
    const first = contact.first_name?.[0] || "";
    const last = contact.last_name?.[0] || "";
    if (first || last) {
      return (first + last).toUpperCase();
    }
    return contact.username?.[0]?.toUpperCase() || "?";
  };

  const getDisplayName = (contact: TelegramContact): string => {
    if (contact.first_name || contact.last_name) {
      return [contact.first_name, contact.last_name].filter(Boolean).join(" ");
    }
    return contact.username || contact.phone || "Unknown";
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 top-[var(--titlebar-height)] z-[90] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-background/70 animate-fade-in"
        onClick={onClose}
      />

      <div className="relative flex h-[min(500px,calc(100dvh-var(--titlebar-height)-2.5rem))] w-[400px] max-w-full flex-col">
        <div className="share-widget-backdrop absolute inset-0 rounded-xl" />
        <div className="share-widget-shell relative flex h-full min-h-0 flex-col overflow-hidden rounded-xl shadow-2xl shadow-black/50">
          <div className="flex min-h-0 flex-1 flex-col animate-scale-in">
            <div className="flex shrink-0 items-center justify-between border-b border-border p-4">
              <div className="flex items-center gap-3">
                <h2 className="text-body font-semibold text-foreground">
                  Share
                </h2>
              </div>
              <button
                onClick={onClose}
                className="rounded p-1 outline-none transition-colors hover:bg-sidebar-accent/50 focus-visible:outline-none"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <div className="shrink-0 border-b border-border p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search contacts..."
                  className="w-full rounded-lg border border-border bg-secondary py-2 pl-9 pr-8 text-body text-foreground placeholder:text-muted-foreground transition-all duration-150 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 transition-colors hover:bg-card"
                  >
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                )}
              </div>
              {fileName && (
                <p className="mt-2 truncate text-small text-muted-foreground">
                  Sharing: <span className="text-foreground">{fileName}</span>
                </p>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : contacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <User className="mb-2 h-10 w-10 text-muted-foreground/50" />
                  <p className="text-body text-muted-foreground">
                    {searchQuery ? "No contacts found" : "No recent chats"}
                  </p>
                </div>
              ) : (
                <ul className="space-y-1">
                  {contacts.map((contact) => (
                    <li key={contact.id}>
                      <button
                        onClick={() => setSelectedContact(contact)}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 outline-none transition-colors focus-visible:outline-none ${
                          selectedContact?.id === contact.id
                            ? "bg-primary/15"
                            : "hover:bg-sidebar-accent/50"
                        }`}
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={contact.profile_photo} />
                          <AvatarFallback className="bg-secondary text-small">
                            {getInitials(contact)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 overflow-hidden text-left">
                          <p className="truncate text-body text-foreground">
                            {getDisplayName(contact)}
                          </p>
                          {contact.username && (
                            <p className="truncate text-small text-muted-foreground">
                              @{contact.username}
                            </p>
                          )}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="shrink-0 border-t border-border p-4">
              <TelegramButton
                onClick={handleShare}
                disabled={!selectedContact}
                loading={isSending}
                fullWidth
              >
                <Send className="w-4 h-4" />
                Share
              </TelegramButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
