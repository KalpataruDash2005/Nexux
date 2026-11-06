import json
import os
import pytest
from fastapi.testclient import TestClient

def test_cors_allowed_for_legitimate_production_origin(client: TestClient):
    """Verify that requests from authorized production origin receive CORS headers."""
    headers = {
        "Origin": "https://nexoraos.space",
        "Access-Control-Request-Method": "GET"
    }
    response = client.get("/health", headers=headers)
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "https://nexoraos.space"

def test_cors_allowed_for_localhost_development(client: TestClient):
    """Verify that local development frontend origins receive CORS headers."""
    headers = {
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "GET"
    }
    response = client.get("/health", headers=headers)
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"

def test_cors_rejected_for_untrusted_origins(client: TestClient):
    """
    NEX-VULN-007 Verification:
    Verify that arbitrary third-party domains and untrusted vercel.app subdomains
    do NOT receive CORS access headers.
    """
    untrusted_origins = [
        "https://malicious-exploit.com",
        "https://evil-attacker.vercel.app",
        "https://phishing-nexoraos.com",
        "http://attacker-controlled-site.net"
    ]
    for origin in untrusted_origins:
        headers = {
            "Origin": origin,
            "Access-Control-Request-Method": "GET"
        }
        response = client.get("/health", headers=headers)
        allow_origin = response.headers.get("access-control-allow-origin")
        assert allow_origin != origin, f"Origin '{origin}' was improperly allowed by CORS!"

def test_defense_in_depth_security_headers_present_on_api(client: TestClient):
    """Verify that all standard security headers are attached to API responses."""
    response = client.get("/health")
    assert response.status_code == 200
    headers = response.headers

    assert headers.get("x-content-type-options") == "nosniff"
    assert headers.get("x-frame-options") == "DENY"
    assert headers.get("x-xss-protection") == "1; mode=block"
    assert headers.get("referrer-policy") == "strict-origin-when-cross-origin"
    assert "max-age=" in headers.get("strict-transport-security", "")

def test_vercel_json_security_headers_configuration():
    """Verify that vercel.json includes production security headers configuration."""
    assert os.path.exists("vercel.json")
    with open("vercel.json", "r", encoding="utf-8") as f:
        config = json.load(f)

    headers_block = config.get("headers", [])
    assert len(headers_block) > 0, "vercel.json must define a 'headers' configuration block."

    root_headers = headers_block[0].get("headers", [])
    header_keys = {h["key"].lower(): h["value"] for h in root_headers}

    assert "x-content-type-options" in header_keys
    assert header_keys["x-content-type-options"] == "nosniff"
    assert "x-frame-options" in header_keys
    assert header_keys["x-frame-options"] == "DENY"
    assert "content-security-policy" in header_keys
    assert "strict-transport-security" in header_keys
    assert "permissions-policy" in header_keys
