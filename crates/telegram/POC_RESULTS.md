# TelegramFileServer - Rust PoC Results

**Date**: NOT RUN
**API ID**: NOT RUN
**Chat ID**: NOT RUN
**Test File Size**: NOT RUN MB

## Test Results

| Test | Status | Duration | Details |
|------|--------|----------|---------|
| Session Persistence | ⏳ NOT RUN | 0ms | — |
| Small File Upload | ⏳ NOT RUN | 0ms | — |
| Large File Upload | ⏳ NOT RUN | 0ms | — |
| Metadata Retrieval | ⏳ NOT RUN | 0ms | — |
| Full Download + SHA-256 | ⏳ NOT RUN | 0ms | — |
| Ranged Download | ⏳ NOT RUN | 0ms | — |
| Cancellation | ⏳ NOT RUN | 0ms | — |
| FloodWait Instrumentation | ⏳ NOT RUN | 0ms | — |

## Operation Mapping (Phase 0 Audit)

| Operation | Pyrogram Behavior | Grammers Result | Status |
|-----------|-------------------|-----------------|--------|
| send_document | `client.send_document()` with force_document | `client.send_message(InputMessage::document())` | ⏳ NOT RUN |
| send_photo | `client.send_photo()` | `client.send_message(InputMessage::photo())` | ⏳ NOT RUN |
| send_video | `client.send_video()` | `client.send_message(InputMessage::video())` | ⏳ NOT RUN |
| send_audio | `client.send_audio()` | `client.send_message(InputMessage::audio())` | ⏳ NOT RUN |
| get_messages | `client.get_messages(chat_id, message_id)` | `client.get_messages_by_id()` | ⏳ NOT RUN |
| Ranged download | `upload.GetFile` with offset/limit, per-DC sessions | `client.download_media()` with range | ⏳ NOT RUN |
| Thumbnail download | `client.download_media(file_id, in_memory=True)` | `client.download_media_to_memory()` | ⏳ NOT RUN |
| Session persistence | Pyrogram session file | `grammers_session::Session` file | ⏳ NOT RUN |
| Multi-bot isolation | Separate Client instances | Separate GrammersClient instances | ⏳ NOT RUN |
| Cancellation | Manual flag checking | `CancellationToken` between chunks | ⏳ NOT RUN |
| FloodWait handling | Pyrogram auto-sleeps | Explicit retry with backoff | ⏳ NOT RUN |
| Large file limits | 2GB (bot), 4GB (user) | Same Telegram limits apply | ⏳ NOT RUN |
| Pyrogram→Grammers session migration | Pyrogram session format | Grammers SqliteSession (SQLite) | ❌ ASSUMED NOT POSSIBLE UNTIL PROVEN |

---

> **Note on schema alignment**: This template matches the exact structure written by `src/bin/poc.rs::write_results_md()`. The binary overwrites this file on every run. All 12 Operation Mapping rows from the task's required list are already emitted by the binary; none were added or dropped — the template simply mirrors the binary's schema with `NOT RUN` placeholders.