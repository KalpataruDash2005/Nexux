import uuid
from datetime import datetime
from sqlalchemy import (
    Column,
    String,
    Text,
    Integer,
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Numeric,
    UniqueConstraint,
    Index
)
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

def generate_uuid() -> str:
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="STUDENT")
    token_version = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    profile = relationship("StudentProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    workspaces = relationship("Workspace", back_populates="owner", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="user", cascade="all, delete-orphan")
    jobs = relationship("Job", back_populates="posted_by", cascade="all, delete-orphan")
    applications = relationship("Application", back_populates="student", cascade="all, delete-orphan")
    ai_conversations = relationship("AiConversation", back_populates="user", cascade="all, delete-orphan")
    ai_memories = relationship("AiMemory", back_populates="user", cascade="all, delete-orphan")
    resumes = relationship("PlacementResume", back_populates="owner", cascade="all, delete-orphan")
    placement_sessions = relationship("PlacementSession", back_populates="owner", cascade="all, delete-orphan")


class StudentProfile(Base):
    __tablename__ = "student_profiles"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    university = Column(String(255), nullable=True)
    degree = Column(String(100), nullable=True)
    graduation_year = Column(Integer, nullable=True)
    skills = Column(Text, nullable=True)
    resume_url = Column(String(500), nullable=True)
    phone = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="profile")


class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="ACTIVE")
    owner_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    owner = relationship("User", back_populates="workspaces")
    pdf_documents = relationship("PdfDocument", back_populates="workspace", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="workspace", cascade="all, delete-orphan")
    flashcards = relationship("Flashcard", back_populates="workspace", cascade="all, delete-orphan")
    quizzes = relationship("Quiz", back_populates="workspace", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_workspaces_owner_created", "owner_id", "created_at"),
    )


class PdfDocument(Base):
    __tablename__ = "pdf_documents"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    workspace_id = Column(String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    owner_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    file_name = Column(String(255), nullable=False)
    file_size = Column(BigInteger, nullable=False)
    content_type = Column(String(100), nullable=True, default="application/pdf")
    storage_key = Column(String(500), nullable=False)
    status = Column(String(20), nullable=False, default="PENDING")  # PENDING, PROCESSING, READY, FAILED
    processing_source = Column(String(20), nullable=True, default="NATIVE")
    summary = Column(Text().with_variant(LONGTEXT, "mysql"), nullable=True)
    chunk_count = Column(Integer, nullable=True, default=0)
    error_message = Column(Text().with_variant(LONGTEXT, "mysql"), nullable=True)
    processed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    workspace = relationship("Workspace", back_populates="pdf_documents")
    owner = relationship("User")
    chat_messages = relationship("PdfChatMessage", back_populates="document", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_pdf_documents_workspace_owner", "workspace_id", "owner_id"),
    )


class PdfChatMessage(Base):
    __tablename__ = "pdf_chat_messages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), ForeignKey("pdf_documents.id", ondelete="CASCADE"), nullable=False, index=True)
    owner_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(10), nullable=False)  # USER, AI
    content = Column(Text().with_variant(LONGTEXT, "mysql"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    document = relationship("PdfDocument", back_populates="chat_messages")
    owner = relationship("User")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    status = Column(String(20), nullable=False, default="PENDING")  # PENDING, IN_PROGRESS, PAUSED, COMPLETED
    deadline = Column(DateTime, nullable=True)
    progress_notes = Column(Text, nullable=True)
    parent_task_id = Column(String(36), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True)
    estimated_hours = Column(Numeric(5, 2), nullable=True)
    remaining_hours = Column(Numeric(5, 2), nullable=True)
    chunk_index = Column(Integer, nullable=True)
    total_chunks = Column(Integer, nullable=True)
    ai_generated = Column(Boolean, nullable=False, default=False)
    started_at = Column(DateTime, nullable=True)
    paused_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    last_activity = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="tasks")
    subtasks = relationship("Task", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_tasks_user_status", "user_id", "status"),
        Index("idx_tasks_user_deadline", "user_id", "deadline"),
    )


class AiConversation(Base):
    __tablename__ = "ai_conversations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(10), nullable=False)  # USER, AI
    content = Column(Text().with_variant(LONGTEXT, "mysql"), nullable=False)
    task_id = Column(String(36), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="ai_conversations")

    __table_args__ = (
        Index("idx_ai_conversations_user_created", "user_id", "created_at"),
    )


class AiMemory(Base):
    __tablename__ = "ai_memory"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    mem_key = Column(String(64), nullable=False)
    mem_value = Column(String(500), nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="ai_memories")

    __table_args__ = (
        UniqueConstraint("user_id", "mem_key", name="uq_ai_memory_user_key"),
    )


class PlacementResume(Base):
    __tablename__ = "placement_resumes"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    owner_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    file_name = Column(String(255), nullable=False)
    text = Column(Text().with_variant(LONGTEXT, "mysql"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    owner = relationship("User", back_populates="resumes")
    analyses = relationship("PlacementResumeAnalysis", back_populates="resume", cascade="all, delete-orphan")


class PlacementResumeAnalysis(Base):
    __tablename__ = "placement_resume_analyses"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    resume_id = Column(String(36), ForeignKey("placement_resumes.id", ondelete="CASCADE"), nullable=False, index=True)
    owner_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    analysis_json = Column(Text().with_variant(LONGTEXT, "mysql"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    resume = relationship("PlacementResume", back_populates="analyses")
    owner = relationship("User")


class PlacementSession(Base):
    __tablename__ = "placement_sessions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    owner_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type = Column(String(30), nullable=False)
    mode = Column(String(20), nullable=False, default="AI")
    role = Column(String(100), nullable=True)
    company = Column(String(100), nullable=True)
    difficulty = Column(String(20), nullable=True)
    topic = Column(String(100), nullable=True)
    status = Column(String(20), nullable=False, default="ACTIVE")
    score = Column(Integer, nullable=True)
    payload_json = Column(Text().with_variant(LONGTEXT, "mysql"), nullable=True)
    summary = Column(Text().with_variant(LONGTEXT, "mysql"), nullable=True)
    started_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    owner = relationship("User", back_populates="placement_sessions")
    messages = relationship("PlacementMessage", back_populates="session", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_placement_session_owner_created", "owner_id", "created_at"),
    )


class PlacementMessage(Base):
    __tablename__ = "placement_messages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    session_id = Column(String(36), ForeignKey("placement_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    owner_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(20), nullable=False)  # user, assistant, system
    content = Column(Text().with_variant(LONGTEXT, "mysql"), nullable=False)
    analysis_json = Column(Text().with_variant(LONGTEXT, "mysql"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    session = relationship("PlacementSession", back_populates="messages")
    owner = relationship("User")


class Job(Base):
    __tablename__ = "jobs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    posted_by_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    company_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    location = Column(String(255), nullable=True)
    salary = Column(String(100), nullable=True)
    status = Column(String(50), nullable=False, default="ACTIVE")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    posted_by = relationship("User", back_populates="jobs")
    applications = relationship("Application", back_populates="job", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_jobs_status_created", "status", "created_at"),
    )


class Application(Base):
    __tablename__ = "applications"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    job_id = Column(String(36), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(50), nullable=False, default="APPLIED")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    job = relationship("Job", back_populates="applications")
    student = relationship("User", back_populates="applications")

    __table_args__ = (
        UniqueConstraint("job_id", "student_id", name="uq_application_job_student"),
        Index("idx_applications_student_status", "student_id", "status"),
    )


class FeedbackSubmission(Base):
    __tablename__ = "feedback_submissions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default="NEW")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("idx_feedback_submissions_status", "status"),
        Index("idx_feedback_submissions_created", "created_at"),
    )


class AptitudeSet(Base):
    __tablename__ = "aptitude_sets"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    title = Column(String(255), nullable=False)
    file_name = Column(String(255), nullable=True)
    question_count = Column(Integer, nullable=False, default=0)
    created_by = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    questions = relationship("AptitudeQuestion", back_populates="aptitude_set", cascade="all, delete-orphan")


class AptitudeQuestion(Base):
    __tablename__ = "aptitude_questions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    set_id = Column(String(36), ForeignKey("aptitude_sets.id", ondelete="CASCADE"), nullable=False, index=True)
    text = Column(Text, nullable=False)
    options_json = Column(Text, nullable=False)
    correct_index = Column(Integer, nullable=False)
    explanation = Column(Text, nullable=True)
    difficulty = Column(String(20), nullable=True)
    topic = Column(String(100), nullable=True)
    category = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    aptitude_set = relationship("AptitudeSet", back_populates="questions")


class Document(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    workspace_id = Column(String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    type = Column(String(100), nullable=True)
    size = Column(BigInteger, nullable=True)
    storage_url = Column(String(500), nullable=True)
    metadata_json = Column(Text().with_variant(LONGTEXT, "mysql"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    workspace = relationship("Workspace", back_populates="documents")


class Summary(Base):
    __tablename__ = "summaries"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), nullable=False, index=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Flashcard(Base):
    __tablename__ = "flashcards"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    workspace_id = Column(String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id = Column(String(36), nullable=True)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    workspace = relationship("Workspace", back_populates="flashcards")


class Quiz(Base):
    __tablename__ = "quizzes"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    workspace_id = Column(String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    workspace = relationship("Workspace", back_populates="quizzes")
    questions = relationship("QuizQuestion", back_populates="quiz", cascade="all, delete-orphan")


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    quiz_id = Column(String(36), ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False, index=True)
    question = Column(Text, nullable=False)
    options_json = Column(Text, nullable=False)
    correct_answer = Column(String(255), nullable=False)

    quiz = relationship("Quiz", back_populates="questions")


class RevokedToken(Base):
    __tablename__ = "revoked_tokens"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    jti = Column(String(64), unique=True, nullable=False, index=True)
    token_hash = Column(String(64), nullable=True, index=True)
    revoked_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=True)

    __table_args__ = (
        Index("idx_revoked_tokens_jti", "jti"),
        Index("idx_revoked_tokens_expires", "expires_at"),
    )
