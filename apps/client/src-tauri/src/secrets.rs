//! The user's Claude API key in the OS keychain (Mac: Keychain Services, iPhone: Protected Data).
//! The webview reads it only when it calls Claude (PLAN.md §6); it is never logged.

use std::sync::OnceLock;

use keyring_core::{Entry, Error};

const SERVICE: &str = "io.github.adzouz.readar";
const CLAUDE_KEY: &str = "claude-api-key";

/// Picks the platform store once. Errors are kept as text: commands report them to the webview.
fn store_ready() -> Result<(), String> {
    static READY: OnceLock<Result<(), String>> = OnceLock::new();
    READY
        .get_or_init(|| {
            #[cfg(target_os = "macos")]
            let store = apple_native_keyring_store::keychain::Store::new();
            #[cfg(target_os = "ios")]
            let store = apple_native_keyring_store::protected::Store::new();
            #[cfg(any(target_os = "macos", target_os = "ios"))]
            {
                store
                    .map(|store| keyring_core::set_default_store(store))
                    .map_err(|error| format!("Keychain unavailable: {error}"))
            }
            #[cfg(not(any(target_os = "macos", target_os = "ios")))]
            Err("No keychain on this platform.".to_string())
        })
        .clone()
}

fn entry() -> Result<Entry, String> {
    store_ready()?;
    Entry::new(SERVICE, CLAUDE_KEY).map_err(|error| format!("Keychain error: {error}"))
}

/// Rejects anything that isn't shaped like a Console API key before it reaches the keychain.
fn check_shape(key: &str) -> Result<(), String> {
    let valid = key.starts_with("sk-ant-")
        && key.len() <= 256
        && key
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');
    if valid {
        Ok(())
    } else {
        Err("This doesn't look like a Claude API key.".to_string())
    }
}

#[tauri::command]
pub fn claude_key_get() -> Result<Option<String>, String> {
    match entry()?.get_password() {
        Ok(key) => Ok(Some(key)),
        Err(Error::NoEntry) => Ok(None),
        Err(error) => Err(format!("Keychain error: {error}")),
    }
}

#[tauri::command]
pub fn claude_key_set(key: String) -> Result<(), String> {
    let key = key.trim();
    check_shape(key)?;
    entry()?
        .set_password(key)
        .map_err(|error| format!("Keychain error: {error}"))
}

#[tauri::command]
pub fn claude_key_delete() -> Result<(), String> {
    match entry()?.delete_credential() {
        Ok(()) | Err(Error::NoEntry) => Ok(()),
        Err(error) => Err(format!("Keychain error: {error}")),
    }
}

#[cfg(test)]
mod tests {
    use super::check_shape;

    #[test]
    fn accepts_console_keys_only() {
        assert!(check_shape("sk-ant-api03-abc_DEF-123").is_ok());
        assert!(check_shape("sk-proj-abc").is_err());
        assert!(check_shape("sk-ant-api03 abc").is_err());
        assert!(check_shape("").is_err());
        assert!(check_shape(&format!("sk-ant-{}", "a".repeat(300))).is_err());
    }
}
