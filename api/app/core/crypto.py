import base64
import os
from typing import Optional
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from app.core.config import settings
from app.core.logging import logger

# Constant salt for deterministic key derivation from application master secret
_APPLICATION_KDF_SALT = b"nexora_application_encryption_kdf_v1"

def _derive_encryption_key(secret: str) -> bytes:
    """Derives a 256-bit AES key using PBKDF2-HMAC-SHA256."""
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=_APPLICATION_KDF_SALT,
        iterations=100000,
    )
    return kdf.derive(secret.encode("utf-8"))

def encrypt_field(plaintext: str, key_override: Optional[bytes] = None) -> str:
    """
    Encrypts a string using AES-256-GCM with a random 96-bit nonce.
    Returns URL-safe Base64 encoded string: nonce (12 bytes) + ciphertext + 16-byte auth tag.
    """
    if plaintext is None:
        return ""
    
    key = key_override or _derive_encryption_key(settings.JWT_SECRET)
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)  # 96-bit nonce as recommended by NIST SP 800-38D
    
    data_bytes = plaintext.encode("utf-8")
    ciphertext = aesgcm.encrypt(nonce, data_bytes, None)
    
    combined = nonce + ciphertext
    return base64.urlsafe_b64encode(combined).decode("utf-8")

def decrypt_field(encoded_ciphertext: str, key_override: Optional[bytes] = None) -> str:
    """
    Decrypts an AES-256-GCM encoded string, verifying the cryptographic authentication tag.
    Raises ValueError on invalid ciphertext, bad key, or data tampering.
    """
    if not encoded_ciphertext:
        return ""
        
    try:
        combined = base64.urlsafe_b64decode(encoded_ciphertext.encode("utf-8"))
        if len(combined) < 28:  # 12 bytes nonce + at least 16 bytes auth tag
            raise ValueError("Ciphertext is too short to be valid AES-GCM data.")
            
        nonce = combined[:12]
        ciphertext = combined[12:]
        
        key = key_override or _derive_encryption_key(settings.JWT_SECRET)
        aesgcm = AESGCM(key)
        
        decrypted_bytes = aesgcm.decrypt(nonce, ciphertext, None)
        return decrypted_bytes.decode("utf-8")
    except Exception as e:
        logger.error(f"[CRYPTO] Decryption failed or data tampered: {e}")
        raise ValueError("Decryption failed: invalid ciphertext or cryptographic tag verification failure.")
