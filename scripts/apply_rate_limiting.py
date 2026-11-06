import re

def patch_pdf_assistant():
    path = "api/app/api/routes/pdf_assistant_routes.py"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    if "from app.core.rate_limiter import rate_limit" not in content:
        content = content.replace(
            "from app.core.database import get_db",
            "from app.core.database import get_db\nfrom app.core.rate_limiter import rate_limit"
        )

    # upload
    content = re.sub(
        r'@router\.post\("/workspaces/\{workspaceId\}/documents",\s*response_model=PdfUploadResponse\)',
        '@router.post("/workspaces/{workspaceId}/documents", response_model=PdfUploadResponse, dependencies=[Depends(rate_limit(max_requests=10, window_seconds=60))])',
        content
    )

    # chat
    content = re.sub(
        r'@router\.post\("/workspaces/\{workspaceId\}/documents/\{documentId\}/chat",\s*response_model=PdfChatResponse\)',
        '@router.post("/workspaces/{workspaceId}/documents/{documentId}/chat", response_model=PdfChatResponse, dependencies=[Depends(rate_limit(max_requests=25, window_seconds=60))])',
        content
    )

    # stream
    content = re.sub(
        r'@router\.post\("/workspaces/\{workspaceId\}/documents/\{documentId\}/chat/stream"\)',
        '@router.post("/workspaces/{workspaceId}/documents/{documentId}/chat/stream", dependencies=[Depends(rate_limit(max_requests=25, window_seconds=60))])',
        content
    )

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Patched pdf_assistant_routes.py")

def patch_placement():
    path = "api/app/api/routes/placement_routes.py"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    if "from app.core.rate_limiter import rate_limit" not in content:
        content = content.replace(
            "from app.core.database import get_db",
            "from app.core.database import get_db\nfrom app.core.rate_limiter import rate_limit"
        )

    # resume/analyze
    content = re.sub(
        r'@router\.post\("/resume/analyze",\s*response_model=ResumeResponse\)',
        '@router.post("/resume/analyze", response_model=ResumeResponse, dependencies=[Depends(rate_limit(max_requests=10, window_seconds=60))])',
        content
    )

    # interview message
    content = re.sub(
        r'@router\.post\("/sessions/\{id\}/messages",\s*response_model=MessageResponse\)',
        '@router.post("/sessions/{id}/messages", response_model=MessageResponse, dependencies=[Depends(rate_limit(max_requests=30, window_seconds=60))])',
        content
    )

    # coding run
    content = re.sub(
        r'@router\.post\("/coding/\{id\}/run",\s*response_model=CodingRunResponse\)',
        '@router.post("/coding/{id}/run", response_model=CodingRunResponse, dependencies=[Depends(rate_limit(max_requests=20, window_seconds=60))])',
        content
    )

    # coding submit
    content = re.sub(
        r'@router\.post\("/coding/\{id\}/submit",\s*response_model=CodingSubmitResponse\)',
        '@router.post("/coding/{id}/submit", response_model=CodingSubmitResponse, dependencies=[Depends(rate_limit(max_requests=10, window_seconds=60))])',
        content
    )

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Patched placement_routes.py")

def patch_tasks():
    path = "api/app/api/routes/task_routes.py"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    if "from app.core.rate_limiter import rate_limit" not in content:
        content = content.replace(
            "from app.core.database import get_db",
            "from app.core.database import get_db\nfrom app.core.rate_limiter import rate_limit"
        )

    # ai-plan
    content = re.sub(
        r'@router\.post\("/ai-plan",\s*response_model=AiPlanResponse\)',
        '@router.post("/ai-plan", response_model=AiPlanResponse, dependencies=[Depends(rate_limit(max_requests=10, window_seconds=60))])',
        content
    )

    # assistant
    content = re.sub(
        r'@router\.post\("/assistant",\s*response_model=AssistantResponse\)',
        '@router.post("/assistant", response_model=AssistantResponse, dependencies=[Depends(rate_limit(max_requests=30, window_seconds=60))])',
        content
    )

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Patched task_routes.py")

if __name__ == "__main__":
    patch_pdf_assistant()
    patch_placement()
    patch_tasks()
