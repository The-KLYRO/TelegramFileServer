import type { FileItem } from "@/components/skybox/FileRow";
import type { SavedPathCacheEntry } from "@/pages/explorer/shared";
import { normalizePath } from "@/pages/explorer/shared";

/**
 * Single source of truth for the explorer's directory listings.
 *
 * Previously the same data lived in two drifting places — a `savedPathCacheRef`
 * threaded through six hooks and `explorerSessionStore.directoryCache` — neither
 * of which survived a reload, and both of which were wholesale-cleared by
 * mutations. This module owns one record, persists it, and exposes surgical
 * write-through operations so a rename in one folder no longer costs a full
 * refetch of every other folder.
 */
const STORAGE_KEY = "tfs_explorer_directory_cache_v1";
/** Bound the record so a long session cannot outgrow localStorage. */
const MAX_ENTRIES = 60;
/** Entries older than this are still shown but revalidated on next visit. */
const MAX_ENTRY_AGE_MS = 5 * 60 * 1000;
/** Debounce so a burst of writes (one per mutated path) costs one save. */
const PERSIST_DEBOUNCE_MS = 250;
/** Data-URL thumbnails are base64 and dominate the 5MB localStorage quota. */
const DATA_URL_PREFIX = "data:";

type PersistedEntry = {
  entry: SavedPathCacheEntry;
  /** Epoch ms of the last write; drives eviction and revalidation. */
  updatedAt: number;
};

type PersistedRecord = Record<string, PersistedEntry>;

let entries: PersistedRecord = {};
let persistTimer: number | null = null;
let hydrated = false;

const now = (): number => Date.now();

const stripHeavyFields = (item: FileItem): FileItem => {
  if (!item.thumbnail || !item.thumbnail.startsWith(DATA_URL_PREFIX)) {
    return item;
  }
  const { thumbnail: _thumbnail, ...rest } = item;
  return rest;
};

const cloneForPersist = (entry: SavedPathCacheEntry): SavedPathCacheEntry => ({
  ...entry,
  items: entry.items.map(stripHeavyFields),
});

const readStorage = (): PersistedRecord => {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as PersistedRecord;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
};

const evictStaleEntries = (): void => {
  const keys = Object.keys(entries);
  if (keys.length <= MAX_ENTRIES) {
    return;
  }
  const byAge = keys
    .map((key) => ({ key, updatedAt: entries[key]?.updatedAt ?? 0 }))
    .sort((a, b) => a.updatedAt - b.updatedAt);
  const excess = byAge.slice(0, keys.length - MAX_ENTRIES);
  for (const { key } of excess) {
    delete entries[key];
  }
};

const persistNow = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    evictStaleEntries();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Quota exceeded or storage disabled — the in-memory record still works,
    // so a failed persist must never surface to the user.
  }
};

const schedulePersist = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  if (persistTimer) {
    window.clearTimeout(persistTimer);
  }
  persistTimer = window.setTimeout(() => {
    persistTimer = null;
    persistNow();
  }, PERSIST_DEBOUNCE_MS);
};

const hydrate = (): void => {
  if (hydrated) {
    return;
  }
  hydrated = true;
  entries = readStorage();
};

const touch = (path: string, entry: SavedPathCacheEntry): void => {
  const key = normalizePath(path);
  entries[key] = { entry, updatedAt: now() };
  schedulePersist();
};

export const getDirectoryCache = (
  path: string,
): SavedPathCacheEntry | null => {
  hydrate();
  if (!path) {
    return null;
  }
  return entries[normalizePath(path)]?.entry ?? null;
};

export const getAllDirectoryCache = (): Record<string, SavedPathCacheEntry> => {
  hydrate();
  const result: Record<string, SavedPathCacheEntry> = {};
  for (const [key, value] of Object.entries(entries)) {
    result[key] = value.entry;
  }
  return result;
};

export const setDirectoryCache = (
  path: string,
  entry: SavedPathCacheEntry,
): void => {
  hydrate();
  touch(path, entry);
};

export const replaceDirectoryCache = (
  next: Record<string, SavedPathCacheEntry>,
): void => {
  hydrate();
  const rebuilt: PersistedRecord = {};
  const stamp = now();
  for (const [key, entry] of Object.entries(next)) {
    rebuilt[normalizePath(key)] = { entry, updatedAt: stamp };
  }
  entries = rebuilt;
  schedulePersist();
};

/**
 * `true` when the entry is fresh enough to render without a background
 * revalidation. Anything older is shown immediately (no spinner) but refreshed.
 */
export const isDirectoryCacheFresh = (path: string): boolean => {
  hydrate();
  const record = entries[normalizePath(path)];
  if (!record) {
    return false;
  }
  return now() - record.updatedAt < MAX_ENTRY_AGE_MS;
};

/** Drop one path (and nothing else) so the next visit refetches it alone. */
export const invalidateDirectoryCache = (path: string): void => {
  hydrate();
  const key = normalizePath(path);
  if (!entries[key]) {
    return;
  }
  delete entries[key];
  schedulePersist();
};

/** Drop every entry whose path is `path` or lives beneath it. */
export const invalidateDirectoryPrefix = (prefix: string): void => {
  hydrate();
  const normalized = normalizePath(prefix).replace(/\/+$/, "");
  if (!normalized) {
    return;
  }
  let changed = false;
  for (const key of Object.keys(entries)) {
    if (key === normalized || key.startsWith(`${normalized}/`)) {
      delete entries[key];
      changed = true;
    }
  }
  if (changed) {
    schedulePersist();
  }
};

export const clearDirectoryCache = (): void => {
  hydrate();
  entries = {};
  schedulePersist();
};

/** Patch the cached items of one path in place; drops the entry if absent. */
const patchItems = (
  path: string,
  updater: (items: FileItem[]) => FileItem[],
): void => {
  hydrate();
  const key = normalizePath(path);
  const record = entries[key];
  if (!record) {
    return;
  }
  entries[key] = {
    entry: { ...record.entry, items: updater(record.entry.items) },
    updatedAt: now(),
  };
  schedulePersist();
};

const byPath = (target: string) => (item: FileItem) =>
  normalizePath(item.path) === normalizePath(target);

/**
 * Insert or replace a single item inside `path`'s listing. Used by uploads,
 * note messages and any flow that already knows the resulting item.
 */
export const upsertItemInCache = (path: string, item: FileItem): void => {
  patchItems(path, (items) => {
    const index = items.findIndex(byPath(item.path));
    if (index >= 0) {
      const next = [...items];
      next[index] = item;
      return next;
    }
    return [...items, item];
  });
};

/**
 * Remove items from every cached listing.
 *
 * Saved-file items carry a `tg://msg/<id>` path with no folder component, so a
 * single item can legitimately appear in several cached listings (the folder it
 * was listed in, plus parent views). Filtering by path across all entries is
 * therefore the correct behaviour — and is exactly what the old
 * `removePathsFromExplorerState` did, except it never reached the ref copy.
 */
export const removeItemsFromCache = (paths: string[]): void => {
  hydrate();
  if (!paths.length) {
    return;
  }
  const targets = new Set(paths.map((p) => normalizePath(p)));
  let changed = false;
  for (const key of Object.keys(entries)) {
    const record = entries[key];
    if (!record) {
      continue;
    }
    const filtered = record.entry.items.filter(
      (item) => !targets.has(normalizePath(item.path)),
    );
    if (filtered.length === record.entry.items.length) {
      continue;
    }
    entries[key] = {
      entry: { ...record.entry, items: filtered },
      updatedAt: now(),
    };
    changed = true;
  }
  if (changed) {
    schedulePersist();
  }
};

/**
 * Apply a rename in place.
 *
 * For folders the path itself changes (`parent/old` → `parent/new`), and any
 * cached listing holding that folder must be updated too. For saved files the
 * `tg://msg/<id>` path is unchanged and only the display name moves — the
 * backend keeps `message_id` across a rename (vfs.rs re-inserts the doc with a
 * new `_id` but the same `message_id`).
 */
export const renameItemInCache = (
  oldPath: string,
  updatedItem: FileItem,
): void => {
  hydrate();
  const normalizedOld = normalizePath(oldPath);
  const normalizedNew = normalizePath(updatedItem.path);
  let changed = false;

  for (const key of Object.keys(entries)) {
    const record = entries[key];
    if (!record) {
      continue;
    }
    let items = record.entry.items;
    const index = items.findIndex(byPath(normalizedOld));
    if (index >= 0) {
      const next = [...items];
      next[index] = updatedItem;
      items = next;
      changed = true;
    }
    // A renamed folder may itself be the cached key (views of that folder).
    let newKey = key;
    if (key === normalizedOld) {
      newKey = normalizedNew;
    } else if (key.startsWith(`${normalizedOld}/`)) {
      newKey = normalizedNew + key.slice(normalizedOld.length);
    }
    if (newKey !== key) {
      delete entries[key];
      entries[newKey] = { entry: { ...record.entry, items }, updatedAt: now() };
      changed = true;
      continue;
    }
    if (items !== record.entry.items) {
      entries[key] = { entry: { ...record.entry, items }, updatedAt: now() };
      changed = true;
    }
  }

  if (changed) {
    schedulePersist();
  }
};

/**
 * Record that `items` now live in `destinationPath`.
 *
 * Copy and cut both end here. Cut additionally calls `removeItemsFromCache`
 * for the source paths first — but callers must not rely on ordering, since
 * saved-file paths have no folder component and a cut within one folder would
 * otherwise remove the item we just added.
 */
export const addItemsToCache = (
  destinationPath: string,
  items: FileItem[],
): void => {
  if (!items.length) {
    return;
  }
  patchItems(destinationPath, (existing) => {
    const merged = [...existing];
    const seenPaths = new Set(existing.map((item) => normalizePath(item.path)));
    const seenMessageIds = new Set(
      existing
        .map((item) => item.messageId)
        .filter((id): id is number => !!id && id > 0),
    );
    for (const item of items) {
      if (seenPaths.has(normalizePath(item.path))) {
        continue;
      }
      if (item.messageId && seenMessageIds.has(item.messageId)) {
        continue;
      }
      merged.push(item);
      seenPaths.add(normalizePath(item.path));
      if (item.messageId) {
        seenMessageIds.add(item.messageId);
      }
    }
    return merged;
  });
};

/**
 * Flush any pending debounced write. Called on page hide so a reload in the
 * same tick as a mutation does not lose it.
 */
export const flushDirectoryCache = (): void => {
  if (persistTimer && typeof window !== "undefined") {
    window.clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (hydrated) {
    persistNow();
  }
};

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushDirectoryCache);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushDirectoryCache();
    }
  });
}
