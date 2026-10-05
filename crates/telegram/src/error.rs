//! Error types for the Telegram transfer engine

use thiserror::Error;

/// Result type alias for Telegram operations
pub type Result<T> = std::result::Result<T, TelegramError>;

/// Comprehensive error type for Telegram operations
#[derive(Debug, Error)]
pub enum TelegramError {
    /// FloodWait error from Telegram - must wait N seconds before retrying
    #[error("FloodWait: must wait {seconds} seconds before retrying")]
    FloodWait { seconds: u32 },

    /// RPC error from Telegram API
    #[error("RPC error: {code} - {message}")]
    Rpc { code: i32, message: String },

    /// Network/transport error
    #[error("Network error: {0}")]
    Network(#[from] std::io::Error),

    /// Operation was cancelled
    #[error("Operation cancelled")]
    Cancelled,

    /// Session error (invalid, expired, or corrupted)
    #[error("Session error: {0}")]
    Session(String),

    /// Authentication error
    #[error("Authentication error: {0}")]
    Auth(String),

    /// File not found
    #[error("File not found: chat_id={chat_id}, message_id={message_id}")]
    FileNotFound { chat_id: i64, message_id: i32 },

    /// Invalid file hash
    #[error("Invalid file hash")]
    InvalidHash,

    /// Media type not supported
    #[error("Unsupported media type: {0}")]
    UnsupportedMediaType(String),

    /// Download/Upload error
    #[error("Transfer error: {0}")]
    Transfer(String),

    /// Configuration error
    #[error("Configuration error: {0}")]
    Config(String),

    /// Generic/other error
    #[error("Other error: {0}")]
    Other(String),
}

impl TelegramError {
    /// Check if this error is retryable (transient)
    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            TelegramError::FloodWait { .. }
                | TelegramError::Network(_)
                | TelegramError::Rpc {
                    code: 500..=599,
                    ..
                }
                | TelegramError::Transfer(_)
        )
    }

    /// Get the FloodWait duration if this is a FloodWait error
    pub fn flood_wait_seconds(&self) -> Option<u32> {
        match self {
            TelegramError::FloodWait { seconds } => Some(*seconds),
            _ => None,
        }
    }
}

impl From<grammers_client::InvocationError> for TelegramError {
    fn from(err: grammers_client::InvocationError) -> Self {
        match err {
            grammers_client::InvocationError::Rpc(rpc_error) => {
                // Check for FloodWait
                if rpc_error.name == "FLOOD_WAIT"
                    && let Some(seconds) = rpc_error.value
                {
                    return TelegramError::FloodWait { seconds };
                }
                TelegramError::Rpc {
                    code: rpc_error.code,
                    message: rpc_error.name,
                }
            }
            grammers_client::InvocationError::Io(e) => TelegramError::Network(e),
            grammers_client::InvocationError::Session(e) => TelegramError::Session(e.to_string()),
            grammers_client::InvocationError::Deserialize(e) => TelegramError::Other(e.to_string()),
            grammers_client::InvocationError::Transport(e) => {
                TelegramError::Network(std::io::Error::other(e.to_string()))
            }
            grammers_client::InvocationError::Dropped => {
                TelegramError::Other("Invocation dropped".into())
            }
            _ => TelegramError::Other(err.to_string()),
        }
    }
}
