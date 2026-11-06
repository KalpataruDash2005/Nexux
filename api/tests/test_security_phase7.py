import io
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from app.models.base import User
from app.core.file_security import validate_and_sanitize_upload
from app.core.security import create_access_token

def test_valid_pdf_magic_bytes_accepted():
    valid_pdf_bytes = b"%PDF-1.4\n%Demo Content\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"
    clean_name = validate_and_sanitize_upload("course_notes.pdf", valid_pdf_bytes)
    assert clean_name == "course_notes.pdf"

def test_fake_pdf_rejected_by_magic_bytes():
    """
    NEX-VULN-009 Verification:
    Verify that non-PDF payloads spoofed with a .pdf extension are rejected.
    """
    non_pdf_payloads = [
        b"TEXT_DATA_WITHOUT_PDF_HEADER",
        b"SOME_GENERIC_DATA_STREAM_XYZ",
        b"CONFIG_FILE_DATA_NOT_PDF"
    ]
    for invalid_bytes in non_pdf_payloads:
        with pytest.raises(HTTPException) as excinfo:
            validate_and_sanitize_upload("sample.pdf", invalid_bytes)
        assert excinfo.value.status_code == 400
        assert "Invalid file signature" in excinfo.value.detail

def test_empty_file_upload_rejected():
    """Verify that 0-byte file uploads are rejected with 400."""
    with pytest.raises(HTTPException) as excinfo:
        validate_and_sanitize_upload("empty.pdf", b"")
    assert excinfo.value.status_code == 400
    assert "empty" in excinfo.value.detail.lower()

def test_oversized_file_upload_rejected():
    """Verify that file exceeding size limit is rejected with 413."""
    oversized_bytes = b"%PDF-" + b"0" * 1000
    with pytest.raises(HTTPException) as excinfo:
        validate_and_sanitize_upload("large.pdf", oversized_bytes, max_size_bytes=500)
    assert excinfo.value.status_code == 413

def test_path_traversal_filename_sanitization():
    """Verify that path traversal sequences are stripped from filenames."""
    valid_pdf_bytes = b"%PDF-1.4\nminimal"
    traversal_filenames = [
        "../../../../etc/passwd.pdf",
        "/var/log/secret.pdf",
        "nested/deep/notes.pdf"
    ]
    for traversal in traversal_filenames:
        clean = validate_and_sanitize_upload(traversal, valid_pdf_bytes)
        assert "/" not in clean
        assert "\\" not in clean
        assert ".." not in clean

def test_pdf_assistant_upload_api_rejects_spoofed_pdf(
    client: TestClient,
    test_user: User
):
    """
    End-to-End API Test:
    Attempting to upload a spoofed non-PDF file via the REST API must return HTTP 400.
    """
    token = create_access_token(subject=test_user.email, role=test_user.role)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create a workspace
    ws_resp = client.post("/api/v1/workspaces", headers=headers, json={
        "name": "Security Audit Test Workspace"
    })
    assert ws_resp.status_code == 201
    workspace_id = ws_resp.json()["id"]

    # 2. Upload fake PDF
    fake_pdf = io.BytesIO(b"NON_PDF_MIME_SPOOFED_STREAM")
    files = {"file": ("exploit.pdf", fake_pdf, "application/pdf")}
    upload_resp = client.post(
        f"/api/v1/pdf-assistant/workspaces/{workspace_id}/documents",
        headers=headers,
        files=files
    )
    assert upload_resp.status_code == 400
    assert "Invalid file signature" in upload_resp.json().get("detail", "")
