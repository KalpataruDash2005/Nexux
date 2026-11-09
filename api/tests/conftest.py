import pytest
from typing import Generator
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import get_db
from app.models.base import Base, User
from app.core.security import get_password_hash, create_access_token
from app.core.cache import cache_manager

# Test database: In-memory SQLite with single connection pool
TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(autouse=True)
def isolate_ai_environment(monkeypatch):
    """Ensure hermetic test execution independent of local .env credentials."""
    from app.core.config import settings
    monkeypatch.setattr(settings, "XAI_API_KEY", "")
    monkeypatch.setattr(settings, "XAI_BACKUP_API_KEY", "")
    for cat in ["PDF", "CHAT", "RESUME", "ASSESSMENT", "GENERAL"]:
        monkeypatch.setattr(settings, f"XAI_API_KEY_{cat}", "")
        monkeypatch.setattr(settings, f"XAI_BACKUP_API_KEY_{cat}", "")

@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    cache_manager.clear()
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    
    yield session
    
    session.close()
    transaction.rollback()
    connection.close()
    cache_manager.clear()

@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

@pytest.fixture
def test_user(db_session: Session) -> User:
    user = User(
        email="teststudent@nexux.app",
        password_hash=get_password_hash("SecretPassword123!"),
        role="STUDENT"
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def test_admin(db_session: Session) -> User:
    admin = User(
        email="testadmin@nexux.app",
        password_hash=get_password_hash("AdminPass123!"),
        role="ADMIN"
    )
    db_session.add(admin)
    db_session.commit()
    db_session.refresh(admin)
    return admin

@pytest.fixture
def auth_headers(test_user: User) -> dict:
    token = create_access_token(subject=test_user.email)
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def admin_headers(test_admin: User) -> dict:
    token = create_access_token(subject=test_admin.email)
    return {"Authorization": f"Bearer {token}"}
