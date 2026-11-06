import os
import pytest
from app.core.config import Settings

def test_validate_security_development():
    """Verify validate_security does not raise in development."""
    dev_settings = Settings(
        ENVIRONMENT="development",
        DEBUG=True,
        JWT_SECRET="dev-secret",
        ENABLE_HOST_CODE_EXECUTION=False
    )
    # Should complete without error
    dev_settings.validate_security()

def test_validate_security_prod_placeholder_jwt():
    """Verify startup fails in production if JWT_SECRET is the default placeholder."""
    default_placeholder = "careeros-super-secret-jwt-key-with-at-least-256-bits-length-for-security-purposes!"
    prod_settings = Settings(
        ENVIRONMENT="production",
        DEBUG=False,
        JWT_SECRET=default_placeholder,
        ENABLE_HOST_CODE_EXECUTION=False
    )
    with pytest.raises(ValueError, match="CRITICAL SECURITY ERROR.*JWT_SECRET"):
        prod_settings.validate_security()

def test_validate_security_prod_short_jwt():
    """Verify startup fails in production if JWT_SECRET is shorter than 32 characters."""
    prod_settings = Settings(
        ENVIRONMENT="production",
        DEBUG=False,
        JWT_SECRET="short_jwt_secret_123",
        ENABLE_HOST_CODE_EXECUTION=False
    )
    with pytest.raises(ValueError, match="CRITICAL SECURITY ERROR.*JWT_SECRET"):
        prod_settings.validate_security()

def test_validate_security_prod_host_execution_enabled():
    """Verify startup fails in production if host code execution is toggled True."""
    prod_settings = Settings(
        ENVIRONMENT="production",
        DEBUG=False,
        JWT_SECRET="a" * 64,
        ENABLE_HOST_CODE_EXECUTION=True
    )
    with pytest.raises(ValueError, match="ENABLE_HOST_CODE_EXECUTION must not be enabled"):
        prod_settings.validate_security()

def test_validate_security_prod_debug_enabled():
    """Verify startup fails in production if DEBUG mode is enabled."""
    prod_settings = Settings(
        ENVIRONMENT="production",
        DEBUG=True,
        JWT_SECRET="a" * 64,
        ENABLE_HOST_CODE_EXECUTION=False
    )
    with pytest.raises(ValueError, match="DEBUG mode must be disabled"):
        prod_settings.validate_security()

def test_validate_security_prod_wildcard_cors():
    """Verify startup fails in production if CORS contains a wildcard."""
    prod_settings = Settings(
        ENVIRONMENT="production",
        DEBUG=False,
        JWT_SECRET="a" * 64,
        ENABLE_HOST_CODE_EXECUTION=False,
        CORS_ALLOWED_ORIGINS="*"
    )
    with pytest.raises(ValueError, match="Wildcard CORS origin"):
        prod_settings.validate_security()

def test_validate_security_prod_valid_configuration():
    """Verify startup succeeds in production when all security controls are met."""
    prod_settings = Settings(
        ENVIRONMENT="production",
        DEBUG=False,
        JWT_SECRET="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        ENABLE_HOST_CODE_EXECUTION=False,
        CORS_ALLOWED_ORIGINS="https://nexoraos.space,https://www.nexoraos.space"
    )
    # Should validate cleanly with zero exceptions
    prod_settings.validate_security()

def test_gitignore_contains_critical_secrets_patterns():
    """Verify .gitignore blocks all env and cryptographic key extensions."""
    with open(".gitignore", "r", encoding="utf-8") as f:
        content = f.read()

    assert ".env" in content
    assert "*.pem" in content
    assert "*.key" in content
    assert "*.secret" in content
    assert "*.p12" in content
