import pytest
from app.core.crypto import encrypt_field, decrypt_field
from app.schemas.admin import UserAdminDto
from app.schemas.profile import StudentProfileDto
from app.schemas.auth import AuthResponseDto

def test_aes_gcm_field_encryption_roundtrip():
    """Verify AES-256-GCM encrypts and decrypts sensitive data losslessly."""
    secret_payload = "sk-live-confidential-api-key-999-secure"
    encrypted = encrypt_field(secret_payload)
    assert encrypted != secret_payload
    decrypted = decrypt_field(encrypted)
    assert decrypted == secret_payload

def test_aes_gcm_nonce_randomness():
    """Verify that identical plaintexts produce completely different ciphertexts due to fresh nonces."""
    plaintext = "Same text encrypted multiple times"
    enc1 = encrypt_field(plaintext)
    enc2 = encrypt_field(plaintext)
    assert enc1 != enc2
    assert decrypt_field(enc1) == plaintext
    assert decrypt_field(enc2) == plaintext

def test_aes_gcm_tamper_detection():
    """Verify that tampering with ciphertext causes authentication tag verification failure."""
    plaintext = "Original untampered data"
    encrypted = encrypt_field(plaintext)
    
    # Tamper with the middle of the ciphertext
    raw_list = list(encrypted)
    idx = len(raw_list) // 2
    raw_list[idx] = "A" if raw_list[idx] != "A" else "B"
    tampered = "".join(raw_list)

    with pytest.raises(ValueError) as excinfo:
        decrypt_field(tampered)
    assert "Decryption failed" in str(excinfo.value)

def test_dto_schemas_strictly_exclude_password_hash():
    """Verify that user-facing and admin DTO schemas strictly exclude password hashes."""
    assert "password_hash" not in UserAdminDto.model_fields
    assert "password" not in UserAdminDto.model_fields
    assert "password_hash" not in StudentProfileDto.model_fields
    assert "password_hash" not in AuthResponseDto.model_fields

def test_empty_input_handling():
    """Verify graceful handling of empty or None values."""
    assert encrypt_field(None) == ""
    assert decrypt_field("") == ""
