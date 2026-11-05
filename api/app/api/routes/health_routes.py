from fastapi import APIRouter

router = APIRouter(tags=["Health"])

@router.get("/")
def root():
    return {"status": "UP", "message": "CareerOS backend running"}

@router.get("/health")
def health():
    return {"status": "UP", "message": "CareerOS backend running"}
