use mongodb::{
    Client, Collection, Database,
    bson::doc,
    options::{ClientOptions, ServerApi, ServerApiVersion},
};
use tfs_config::{ConfigError, SetupConfig};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum DbError {
    #[error("mongodb connection failed: {0}")]
    Connection(#[from] mongodb::error::Error),
    #[error("config error: {0}")]
    Config(#[from] ConfigError),
    #[error("config not found")]
    NotFound,
    #[error("invalid data: {0}")]
    InvalidData(String),
}

pub type Result<T> = std::result::Result<T, DbError>;

const CONNECTION_TIMEOUT_MS: u64 = 5000;
const SERVER_SELECTION_TIMEOUT_MS: u64 = 5000;

/// Connect to MongoDB with fast timeouts for wizard error feedback
pub async fn connect(uri: &str) -> Result<Client> {
    let mut client_options = ClientOptions::parse(uri).await?;

    // Set fast timeouts for wizard
    client_options.connect_timeout = Some(std::time::Duration::from_millis(CONNECTION_TIMEOUT_MS));
    client_options.server_selection_timeout = Some(std::time::Duration::from_millis(
        SERVER_SELECTION_TIMEOUT_MS,
    ));

    // Use stable API version
    client_options.server_api = Some(ServerApi::builder().version(ServerApiVersion::V1).build());

    let client = Client::with_options(client_options)?;

    // Test connection with a ping
    client
        .database("admin")
        .run_command(doc! { "ping": 1 })
        .await?;

    Ok(client)
}

/// Get the v2 database
pub fn get_database(client: &Client) -> Database {
    client.database(SetupConfig::DATABASE_NAME)
}

/// Get the setup collection
pub fn get_setup_collection(client: &Client) -> Collection<SetupConfig> {
    get_database(client).collection(SetupConfig::COLLECTION_NAME)
}

/// Check if setup config exists
pub async fn has_config(client: &Client) -> Result<bool> {
    let collection = get_setup_collection(client);
    let count = collection
        .count_documents(doc! { "_id": SetupConfig::DOC_ID })
        .await?;
    Ok(count > 0)
}

/// Load setup config from database
pub async fn load_config(client: &Client) -> Result<SetupConfig> {
    let collection = get_setup_collection(client);
    let config = collection
        .find_one(doc! { "_id": SetupConfig::DOC_ID })
        .await?
        .ok_or(DbError::NotFound)?;
    Ok(config)
}

/// Save setup config to database (upsert)
pub async fn save_config(client: &Client, config: &SetupConfig) -> Result<()> {
    let collection = get_setup_collection(client);
    collection
        .replace_one(doc! { "_id": SetupConfig::DOC_ID }, config)
        .upsert(true)
        .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tfs_config::{Step1Input, Step2Input, create_setup_config};

    // These tests require a running MongoDB instance
    // They are marked as ignored by default

    #[tokio::test]
    #[ignore]
    async fn test_connect_and_save_load() {
        let uri = std::env::var("MONGODB_URI")
            .unwrap_or_else(|_| "mongodb://localhost:27017".to_string());
        let client = connect(&uri).await.unwrap();

        let step1 = Step1Input {
            mongo_uri: uri.clone(),
            password: "password123".to_string(),
        };
        let step2 = Step2Input {
            api_id: 123456,
            api_hash: "abcdef1234567890abcdef1234567890".to_string(),
            bot_token_1: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11".to_string(),
            bot_token_2: Some("123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew12".to_string()),
            bot_token_3: None,
            owner_id: 987654321,
        };

        let config = create_setup_config(&step1, &step2).unwrap();
        save_config(&client, &config).await.unwrap();

        let loaded = load_config(&client).await.unwrap();
        assert_eq!(loaded.api_id, config.api_id);
        assert_eq!(loaded.owner_id, config.owner_id);
        assert_eq!(loaded.id, config.id);

        let has = has_config(&client).await.unwrap();
        assert!(has);
    }
}
