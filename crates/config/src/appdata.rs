use crate::{
    EncryptedPayload, KdfParams, SensitiveData, SetupConfig, decrypt_sensitive, decrypt_value,
    encrypt_value,
};
use chrono::{DateTime, Utc};
use dirs;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// Connection information persisted locally to resume setup wizard
/// (in-memory type — also embedded in resume API responses).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionStore {
    pub mongo_uri: String,
    pub password: String,
}

/// What the appdata dir stores: the wizard password only (the root secret —
/// it cannot encrypt itself).
#[derive(Debug, Serialize, Deserialize)]
struct PasswordStore {
    password: String,
}

/// What the binary dir stores: the MongoDB URI, encrypted with the wizard
/// password using the cheap [`KdfParams::local`] params (the plaintext
/// password sits in appdata by design — see `local()` docs). Everything
/// except the password lives next to the binary.
#[derive(Debug, Serialize, Deserialize)]
struct MongoStore {
    kdf: KdfParams,
    encrypted_uri: EncryptedPayload,
}

/// What setup.json holds after a cheap local decrypt: everything the server
/// needs to come up (and the wizard needs to show the final step) without
/// touching MongoDB.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalConfig {
    pub owner_id: i64,
    pub default_chat_id: i64,
    pub created_at: DateTime<Utc>,
    pub sensitive: SensitiveData,
}

/// On-disk wrapper for setup.json: `LocalConfig` re-encrypted under the
/// cheap local KDF so a resume answers in milliseconds instead of paying
/// the strong 64 MB Argon2 multiple times.
#[derive(Debug, Serialize, Deserialize)]
struct LocalConfigStore {
    kdf: KdfParams,
    encrypted_config: EncryptedPayload,
}

/// Get the data directory for storing password.json (user dir).
/// Uses TFS_DATA_DIR env var if set, otherwise uses platform-specific data dir
fn get_data_dir() -> PathBuf {
    if let Ok(env_dir) = std::env::var("TFS_DATA_DIR") {
        return PathBuf::from(env_dir);
    }

    // Windows: %APPDATA%\TelegramFileServer (Roaming)
    // Linux: ~/.local/share/TelegramFileServer
    // macOS: ~/Library/Application Support/TelegramFileServer
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("TelegramFileServer")
}

/// Get the directory of the running binary — mongo.json and setup.json live
/// here so the whole config travels with the binary. TFS_BIN_DIR overrides
/// (used by tests).
fn get_bin_dir() -> PathBuf {
    if let Ok(env_dir) = std::env::var("TFS_BIN_DIR") {
        return PathBuf::from(env_dir);
    }

    std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()))
        .unwrap_or_else(|| PathBuf::from("."))
}

/// appdata/password.json — the wizard password (user dir)
fn password_file_path() -> PathBuf {
    get_data_dir().join("password.json")
}

/// binary-dir/mongo.json — MongoDB URI (next to the binary)
fn mongo_file_path() -> PathBuf {
    get_bin_dir().join("mongo.json")
}

/// appdata/connection.json — legacy single-file layout (URI + password in
/// one file in appdata). Read once for migration, then removed.
fn legacy_connection_file_path() -> PathBuf {
    get_data_dir().join("connection.json")
}

/// binary-dir/setup.json — local mirror of the MongoDB setup config
fn setup_file_path() -> PathBuf {
    get_bin_dir().join("setup.json")
}

fn read_json<T: serde::de::DeserializeOwned>(path: &PathBuf) -> anyhow::Result<Option<T>> {
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(path)?;
    Ok(Some(serde_json::from_str(&content)?))
}

fn write_json<T: Serialize>(path: &PathBuf, value: &T) -> anyhow::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let content = serde_json::to_string_pretty(value)?;
    fs::write(path, content)?;
    Ok(())
}

fn remove_file_if_exists(path: &PathBuf) -> anyhow::Result<()> {
    // Windows reports a missing *parent* directory as os error 3 (path not
    // found) rather than NotFound — short-circuit before touching the FS.
    if !path.exists() {
        return Ok(());
    }

    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.into()),
    }
}

/// Load connection (password from appdata, encrypted MongoDB URI from the
/// binary dir)
/// Returns Ok(None) if neither the new split layout nor the legacy file is
/// present, or if the stored URI cannot be decrypted (password no longer
/// matches — the wizard restarts from step 1 in that case).
///
/// Legacy migration: earlier builds stored `{mongo_uri, password}` in a
/// single appdata/connection.json (URI in plaintext) — it is split into the
/// new files and removed on first load.
pub fn load_connection() -> anyhow::Result<Option<ConnectionStore>> {
    let password = read_json::<PasswordStore>(&password_file_path())?;
    let mongo = read_json::<MongoStore>(&mongo_file_path())?;

    if let (Some(p), Some(m)) = (password, mongo) {
        // Decrypt-failure (changed/corrupt password) behaves like "not
        // saved": the wizard falls back to step 1, where the user's input
        // re-creates both files.
        let Some(mongo_uri) = decrypt_value::<String>(&m.encrypted_uri, &p.password, &m.kdf).ok()
        else {
            return Ok(None);
        };
        return Ok(Some(ConnectionStore {
            mongo_uri,
            password: p.password,
        }));
    }

    // Legacy single-file layout.
    let legacy_path = legacy_connection_file_path();
    if !legacy_path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&legacy_path)?;
    let store: ConnectionStore = serde_json::from_str(&content)?;

    // Split into the new layout (URI now encrypted); only drop the legacy
    // file once the new files are safely written.
    if save_connection(&store).is_ok() {
        let _ = remove_file_if_exists(&legacy_path);
    }
    Ok(Some(store))
}

/// Save connection: password → appdata (plaintext, it is the root secret),
/// MongoDB URI → binary dir encrypted with that password (cheap local KDF)
/// Creates parent directories as needed
pub fn save_connection(store: &ConnectionStore) -> anyhow::Result<()> {
    let kdf = KdfParams::local();
    let encrypted_uri = encrypt_value(&store.mongo_uri, &store.password, &kdf)?;

    write_json(
        &password_file_path(),
        &PasswordStore {
            password: store.password.clone(),
        },
    )?;
    write_json(&mongo_file_path(), &MongoStore { kdf, encrypted_uri })
}

/// Delete connection (both halves + any legacy file)
/// Idempotent: returns Ok(()) if nothing exists
pub fn delete_connection() -> anyhow::Result<()> {
    remove_file_if_exists(&password_file_path())?;
    remove_file_if_exists(&mongo_file_path())?;
    remove_file_if_exists(&legacy_connection_file_path())
}

/// Load the local mirror of the setup config (binary dir), opened with the
/// wizard password in ~10 ms (cheap local KDF — no PHC verify: the AEAD tag
/// authenticates the password).
/// Returns Ok(None) if the file doesn't exist or the password doesn't open it.
///
/// Legacy format: earlier builds stored the raw MongoDB `SetupConfig` JSON
/// (strong-kdf blob). It is read once, converted to the cheap format, and
/// rewritten (self-heal).
pub fn load_local_config(password: &str) -> anyhow::Result<Option<LocalConfig>> {
    let path = setup_file_path();

    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(&path)?;

    // Current format: cheap-encrypted wrapper.
    if let Ok(store) = serde_json::from_str::<LocalConfigStore>(&content) {
        let config =
            decrypt_value::<LocalConfig>(&store.encrypted_config, password, &store.kdf).ok();
        return Ok(config);
    }

    // Legacy format: raw SetupConfig JSON.
    let legacy: SetupConfig = serde_json::from_str(&content)?;
    let Ok(sensitive) = decrypt_sensitive(&legacy.encrypted, password, &legacy.kdf) else {
        // Wrong password here: fall back to the MongoDB path, which applies
        // the same password-mismatch handling as before.
        return Ok(None);
    };

    let local = local_from(&legacy, sensitive);
    // Self-heal: rewrite in the cheap format so the next resume is fast.
    if let Err(e) = save_local_config(&legacy, &local.sensitive, password) {
        eprintln!("failed to upgrade local config mirror: {e}");
    }
    Ok(Some(local))
}

fn local_from(config: &SetupConfig, sensitive: SensitiveData) -> LocalConfig {
    LocalConfig {
        owner_id: config.owner_id,
        default_chat_id: config.default_chat_id,
        created_at: config.created_at,
        sensitive,
    }
}

/// Save a local mirror of the setup config, re-encrypted under the cheap
/// local KDF so resumes stay fast. `sensitive` must already be decrypted by
/// the caller (every call site has it in hand from its own verify step).
pub fn save_local_config(
    config: &SetupConfig,
    sensitive: &SensitiveData,
    password: &str,
) -> anyhow::Result<()> {
    let kdf = KdfParams::local();
    let local = local_from(config, sensitive.clone());
    let encrypted_config = encrypt_value(&local, password, &kdf)?;
    write_json(
        &setup_file_path(),
        &LocalConfigStore {
            kdf,
            encrypted_config,
        },
    )
}

/// Delete the local config mirror
/// Idempotent: returns Ok(()) if file doesn't exist
pub fn delete_local_config() -> anyhow::Result<()> {
    remove_file_if_exists(&setup_file_path())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::sync::Mutex;
    use tempfile::tempdir;

    /// TFS_DATA_DIR/TFS_BIN_DIR are process-wide; serialize tests so
    /// parallel runs don't clobber each other's env vars (same pattern as
    /// the tfs-api test lock).
    static ENV_LOCK: Mutex<()> = Mutex::new(());

    /// Point appdata and binary-dir storage at isolated temp folders.
    fn set_test_dirs(base: &std::path::Path) -> (PathBuf, PathBuf) {
        let data = base.join("appdata");
        let bin = base.join("bindir");
        unsafe {
            env::set_var("TFS_DATA_DIR", &data);
            env::set_var("TFS_BIN_DIR", &bin);
        }
        (data, bin)
    }

    fn clear_test_dirs() {
        unsafe {
            env::remove_var("TFS_DATA_DIR");
            env::remove_var("TFS_BIN_DIR");
        }
    }

    fn test_store() -> ConnectionStore {
        ConnectionStore {
            mongo_uri: "mongodb://localhost:27017".to_string(),
            password: "password123".to_string(),
        }
    }

    fn test_config() -> SetupConfig {
        use crate::{Step1Input, Step2Input, create_setup_config};

        let step1 = Step1Input {
            mongo_uri: "mongodb://localhost:27017".to_string(),
            password: "password123".to_string(),
        };
        let step2 = Step2Input {
            api_id: 123456,
            api_hash: "abcdef1234567890abcdef1234567890".to_string(),
            bot_token_1: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11".to_string(),
            bot_token_2: None,
            bot_token_3: None,
            owner_id: 987654321,
            default_chat_id: -1001234567890,
        };
        create_setup_config(&step1, &step2).unwrap()
    }

    #[test]
    fn test_save_load_roundtrip() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let temp_dir = tempdir().unwrap();
        let (_data, bin) = set_test_dirs(temp_dir.path());

        let store = test_store();
        save_connection(&store).unwrap();

        let loaded = load_connection().unwrap().unwrap();
        assert_eq!(loaded.mongo_uri, store.mongo_uri);
        assert_eq!(loaded.password, store.password);

        // Layout: password in appdata, encrypted URI + config next to the
        // binary.
        assert!(password_file_path().exists());
        assert!(mongo_file_path().exists());
        assert!(bin.join("mongo.json").exists());

        // The URI must never sit on disk in plaintext.
        let raw_mongo = fs::read_to_string(mongo_file_path()).unwrap();
        assert!(!raw_mongo.contains("mongodb://"));
        let raw_password = fs::read_to_string(password_file_path()).unwrap();
        assert!(raw_password.contains("password123"));

        clear_test_dirs();
    }

    #[test]
    fn test_delete_connection() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let temp_dir = tempdir().unwrap();
        set_test_dirs(temp_dir.path());

        let store = test_store();
        save_connection(&store).unwrap();
        assert!(load_connection().unwrap().is_some());

        delete_connection().unwrap();
        assert!(load_connection().unwrap().is_none());

        // Idempotent on a missing file.
        delete_connection().unwrap();

        clear_test_dirs();
    }

    #[test]
    fn test_load_none_when_missing() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let temp_dir = tempdir().unwrap();
        set_test_dirs(temp_dir.path());

        let result = load_connection().unwrap();
        assert!(result.is_none());

        clear_test_dirs();
    }

    #[test]
    fn test_save_creates_parent_dirs() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let temp_dir = tempdir().unwrap();
        let data = temp_dir.path().join("subdir-data");
        let bin = temp_dir.path().join("subdir-bin");
        unsafe {
            env::set_var("TFS_DATA_DIR", &data);
            env::set_var("TFS_BIN_DIR", &bin);
        }

        let store = test_store();
        save_connection(&store).unwrap();

        let loaded = load_connection().unwrap().unwrap();
        assert_eq!(loaded.mongo_uri, store.mongo_uri);
        assert!(data.join("password.json").exists());
        assert!(bin.join("mongo.json").exists());

        clear_test_dirs();
    }

    #[test]
    fn test_legacy_connection_file_migrates() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let temp_dir = tempdir().unwrap();
        let (data, bin) = set_test_dirs(temp_dir.path());

        // Old layout: one file, both fields, in appdata.
        let legacy = ConnectionStore {
            mongo_uri: "mongodb://legacy-host:27017".to_string(),
            password: "legacy-password".to_string(),
        };
        fs::create_dir_all(&data).unwrap();
        fs::write(
            data.join("connection.json"),
            serde_json::to_string_pretty(&legacy).unwrap(),
        )
        .unwrap();

        let loaded = load_connection().unwrap().unwrap();
        assert_eq!(loaded.mongo_uri, legacy.mongo_uri);
        assert_eq!(loaded.password, legacy.password);

        // Split into the new layout and the legacy file is gone; the URI is
        // now encrypted at rest.
        assert!(data.join("password.json").exists());
        assert!(bin.join("mongo.json").exists());
        assert!(!data.join("connection.json").exists());
        let raw_mongo = fs::read_to_string(bin.join("mongo.json")).unwrap();
        assert!(!raw_mongo.contains("legacy-host"));
        assert_eq!(
            load_connection().unwrap().unwrap().password,
            legacy.password
        );

        clear_test_dirs();
    }

    #[test]
    fn test_load_none_when_password_cannot_decrypt_uri() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let temp_dir = tempdir().unwrap();
        set_test_dirs(temp_dir.path());

        save_connection(&test_store()).unwrap();

        // Overwrite the appdata password — the encrypted URI can no longer
        // be opened, so the connection reads back as "not saved" and the
        // wizard restarts from step 1.
        fs::write(
            password_file_path(),
            serde_json::to_string(&PasswordStore {
                password: "different-password".to_string(),
            })
            .unwrap(),
        )
        .unwrap();

        assert!(load_connection().unwrap().is_none());

        clear_test_dirs();
    }

    fn test_sensitive() -> SensitiveData {
        SensitiveData {
            api_id: 123456,
            api_hash: "abcdef1234567890abcdef1234567890".to_string(),
            bot_tokens: vec!["123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11".to_string()],
        }
    }

    #[test]
    fn test_local_config_roundtrip() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let temp_dir = tempdir().unwrap();
        set_test_dirs(temp_dir.path());

        assert!(load_local_config("password123").unwrap().is_none());

        let config = test_config();
        // Real call sites pass the sensitive data their own verify step just
        // decrypted — mirror it the same way.
        let sensitive = crate::verify_and_decrypt(&config, "password123").unwrap();
        save_local_config(&config, &sensitive, "password123").unwrap();

        let loaded = load_local_config("password123").unwrap().unwrap();
        assert_eq!(loaded.owner_id, config.owner_id);
        assert_eq!(loaded.default_chat_id, config.default_chat_id);
        assert_eq!(loaded.sensitive.api_id, sensitive.api_id);
        assert_eq!(loaded.sensitive.api_hash, sensitive.api_hash);
        assert_eq!(loaded.sensitive.bot_tokens, sensitive.bot_tokens);

        // New format on disk: nothing readable, api_hash never in plaintext.
        let raw = fs::read_to_string(setup_file_path()).unwrap();
        assert!(raw.contains("encrypted_config"));
        assert!(!raw.contains("abcdef1234567890"));
        // Mirror lives next to the binary, not in appdata.
        assert!(setup_file_path().exists());
        assert!(!get_data_dir().join("setup.json").exists());

        // Wrong password must not open it.
        assert!(load_local_config("wrong-password").unwrap().is_none());

        clear_test_dirs();
    }

    #[test]
    fn test_local_config_legacy_raw_upgrades() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let temp_dir = tempdir().unwrap();
        set_test_dirs(temp_dir.path());

        // Legacy layout: raw SetupConfig JSON (strong-kdf blob), as written
        // by the first local-mirror build.
        let config = test_config();
        fs::create_dir_all(setup_file_path().parent().unwrap()).unwrap();
        fs::write(
            setup_file_path(),
            serde_json::to_string_pretty(&config).unwrap(),
        )
        .unwrap();

        let loaded = load_local_config("password123").unwrap().unwrap();
        assert_eq!(loaded.owner_id, config.owner_id);
        assert_eq!(loaded.sensitive.api_id, 123456);

        // Self-healed into the cheap format.
        let raw = fs::read_to_string(setup_file_path()).unwrap();
        assert!(raw.contains("encrypted_config"));
        assert!(load_local_config("password123").unwrap().is_some());

        // Legacy file + wrong password → None (MongoDB fallback applies).
        fs::write(
            setup_file_path(),
            serde_json::to_string_pretty(&config).unwrap(),
        )
        .unwrap();
        assert!(load_local_config("wrong-password").unwrap().is_none());

        clear_test_dirs();
    }

    #[test]
    fn test_delete_local_config() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let temp_dir = tempdir().unwrap();
        set_test_dirs(temp_dir.path());

        save_local_config(&test_config(), &test_sensitive(), "password123").unwrap();
        assert!(load_local_config("password123").unwrap().is_some());

        delete_local_config().unwrap();
        assert!(load_local_config("password123").unwrap().is_none());

        // Idempotent on a missing file.
        delete_local_config().unwrap();

        clear_test_dirs();
    }
}
