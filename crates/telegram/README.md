# tfs-telegram — Phase 1 PoC

**Grammers transfer engine behind a `TelegramClient` trait for TelegramFileServer v2.**

This crate provides a clean abstraction over the Grammers Telegram client library, exposing a `TelegramClient` trait that matches the operations TelegramFileServer needs. The `GrammersClient` implementation handles all low-level details (chunked uploads/downloads, session persistence, FloodWait retries, cancellation).

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TG_API_ID` | ✅ | — | Telegram API ID (integer, from my.telegram.org) |
| `TG_API_HASH` | ✅ | — | Telegram API Hash (string, from my.telegram.org) |
| `TG_BOT_TOKEN` | ✅ | — | Bot token from @BotFather |
| `TG_CHAT_ID` | ✅ | — | Chat ID for tests (integer, negative for groups/channels) |
| `TG_POC_FILE_MB` | ❌ | `100` | Large test file size in MB |
| `TG_SESSION_DIR` | ❌ | `poc-sessions/` | Directory for session files |

---

## Run Command

```bash
# From workspace root
cargo run -p tfs-telegram --bin poc

# Or from crate directory
cd crates/telegram && cargo run --bin poc
```

**Without env vars**: prints required variables and exits with code `2`.

---

## Test Scenarios (in execution order)

The PoC binary (`src/bin/poc.rs`) runs these scenarios sequentially:

1. **Session Persistence** — Connect with bot token, save session, disconnect, reconnect from saved session
2. **Small File Upload** — Upload ~1 KB file as `Document`
3. **Large File Upload** — Upload configurable large file (default 100 MB) as `Document`, compute SHA-256 during generation
4. **Metadata Retrieval** — Fetch message metadata via `get_messages` equivalent; verify size/name/MIME match
5. **Full Download + SHA-256 Verification** — Download entire large file, verify byte-for-byte integrity against original SHA-256
6. **Ranged Download** — HTTP-Range-style streaming: download a 1 KB slice at offset 5 MB, verify byte alignment
7. **Cancellation** — Start full download, cancel after 100 ms, verify cooperative stop between chunks
8. **FloodWait Instrumentation** — Documents that retry loop logs FloodWait seconds and retries; real flood behavior observed live

---

## Go / No-Go Criteria

**All scenarios must PASS** for the PoC to be considered successful:

- ✅ Session Persistence — reconnect from saved session works
- ✅ Small File Upload — 1 KB upload succeeds
- ✅ Large File Upload — 100 MB upload succeeds
- ✅ Metadata Retrieval — size/name/MIME match original
- ✅ Full Download + SHA-256 — byte-for-byte integrity verified
- ✅ Ranged Download — slice matches expected bytes at offset
- ✅ Cancellation — download stops cooperatively between chunks
- ✅ FloodWait path exercised or documented — retry loop logs wait time and retries (live observation required)

---

## Known Limitations

| Limitation | Details |
|------------|---------|
| **Pyrogram session migration** | Assumed impossible until proven. Grammers uses `grammers_session::SqliteSession` (SQLite file); Pyrogram uses its own session format. No migration path implemented. |
| **Gramers chunk cap** | Grammers enforces `MAX_CHUNK_SIZE = 512 KiB` (see `client.rs:496`). Python's Pyrogram uses 1 MiB chunks. This affects throughput but not correctness. |
| **Performance parity** | **NOT a goal** for Phase 1. Correctness and API compatibility are the only criteria. |
| **Thumbnail download** | `download_media_to_memory(file_id)` requires message context (chat_id + message_id) in Grammers. Returns `UnsupportedMediaType` error. Use `download_range` with full range instead. |
| **User authentication** | PoC only implements bot token auth (`bot_sign_in`). User auth (phone/code/string session) not implemented. |
| **Media type coverage** | `send_photo`/`send_video`/`send_audio` all delegate to `send_document` with appropriate `MediaType`. Grammers 0.10 sends video/audio/animation as documents. |

---

## Architecture

```
TelegramClient (trait)
    │
    └── GrammersClient (impl)
          ├── connect() / disconnect() — SqliteSession persistence
          ├── send_document / send_photo / send_video / send_audio
          ├── get_media — get_messages_by_id equivalent
          ├── download_range — 512 KiB chunks, offset alignment, cancellation
          ├── download_full — convenience wrapper over download_range
          ├── download_media_to_memory — unsupported (needs message context)
          └── save_session / session_path
```

The `TransferEngine` (in `engine.rs`) adds higher-level orchestration: retry logic with exponential backoff, progress callbacks, and concurrent chunk management.

---

## Dependencies

- `grammers-client` 0.10 — MTProto client
- `grammers-session` 0.10 — SQLite session storage
- `grammers-mtproto` / `grammers-tl-types` — protocol layer
- `tokio` — async runtime
- `tracing` — structured logging
- `sha2` — SHA-256 for integrity checks
- `bytes` — zero-copy chunk handling
- `async-trait` — trait objects for `TelegramClient`