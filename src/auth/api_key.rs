use rand::Rng;
use sha2::{Digest, Sha256};

pub struct GeneratedApiKey {
    pub raw_key: String,
    pub key_hash: String,
    pub key_prefix: String,
}

pub fn generate_api_key() -> GeneratedApiKey {
    let random_bytes: [u8; 20] = rand::rng().random();
    let hex_str = hex::encode(random_bytes);
    let raw_key = format!("sb_live_{hex_str}");
    let key_prefix = raw_key[..16].to_string();

    let mut hasher = Sha256::new();
    hasher.update(raw_key.as_bytes());
    let key_hash = hex::encode(hasher.finalize());

    GeneratedApiKey {
        raw_key,
        key_hash,
        key_prefix,
    }
}

pub fn hash_api_key(raw_key: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(raw_key.as_bytes());
    hex::encode(hasher.finalize())
}
