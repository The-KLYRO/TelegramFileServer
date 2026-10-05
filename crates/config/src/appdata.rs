use dirs;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// Connection information persisted locally to resume setup wizard
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionStore {
    pub mongo_uri: String,
    pub password: String,
}

/// Get the data directory for storing connection.json
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

/// Get the full path to connection.json
fn connection_file_path() -> PathBuf {
    get_data_dir().join("connection.json")
}

/// Load connection from local storage
/// Returns Ok(None) if file doesn't exist
pub fn load_connection() -> anyhow::Result<Option<ConnectionStore>> {
    let path = connection_file_path();

    if !path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&path)?;
    let store: ConnectionStore = serde_json::from_str(&content)?;
    Ok(Some(store))
}

/// Save connection to local storage
/// Creates parent directories if they don't exist
pub fn save_connection(store: &ConnectionStore) -> anyhow::Result<()> {
    let path = connection_file_path();

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let content = serde_json::to_string_pretty(store)?;
    fs::write(&path, content)?;
    Ok(())
}

/// Delete connection from local storage
/// Idempotent: returns Ok(()) if file doesn't exist
pub fn delete_connection() -> anyhow::Result<()> {
    let path = connection_file_path();

    // Windows reports a missing *parent* directory as os error 3 (path not
    // found) rather than NotFound — short-circuit before touching the FS.
    if !path.exists() {
        return Ok(());
    }

    match fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::sync::Mutex;
    use tempfile::tempdir;

    /// TFS_DATA_DIR is process-wide; serialize tests so parallel runs don't
    /// clobber each other's env var (same pattern as the tfs-api test lock).
    static ENV_LOCK: Mutex<()> = Mutex::new(());

    fn test_store() -> ConnectionStore {
        ConnectionStore {
            mongo_uri: "mongodb://localhost:27017".to_string(),
            password: "password123".to_string(),
        }
    }

    #[test]
    fn test_save_load_roundtrip() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let temp_dir = tempdir().unwrap();
        unsafe { env::set_var("TFS_DATA_DIR", temp_dir.path()) };

        let store = test_store();
        save_connection(&store).unwrap();

        let loaded = load_connection().unwrap().unwrap();
        assert_eq!(loaded.mongo_uri, store.mongo_uri);
        assert_eq!(loaded.password, store.password);

        unsafe { env::remove_var("TFS_DATA_DIR") };
    }

    #[test]
    fn test_delete_connection() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let temp_dir = tempdir().unwrap();
        unsafe { env::set_var("TFS_DATA_DIR", temp_dir.path()) };

        let store = test_store();
        save_connection(&store).unwrap();
        assert!(load_connection().unwrap().is_some());

        delete_connection().unwrap();
        assert!(load_connection().unwrap().is_none());

        unsafe { env::remove_var("TFS_DATA_DIR") };
    }

    #[test]
    fn test_load_none_when_missing() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let temp_dir = tempdir().unwrap();
        unsafe { env::set_var("TFS_DATA_DIR", temp_dir.path()) };

        let result = load_connection().unwrap();
        assert!(result.is_none());

        unsafe { env::remove_var("TFS_DATA_DIR") };
    }

    #[test]
    fn test_save_creates_parent_dirs() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let temp_dir = tempdir().unwrap();
        let subdir = temp_dir.path().join("subdir");
        unsafe { env::set_var("TFS_DATA_DIR", subdir.to_str().unwrap()) };

        let store = test_store();
        save_connection(&store).unwrap();

        let loaded = load_connection().unwrap().unwrap();
        assert_eq!(loaded.mongo_uri, store.mongo_uri);

        unsafe { env::remove_var("TFS_DATA_DIR") };
    }
}
