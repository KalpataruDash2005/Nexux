import pytest
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from datetime import datetime

from app.models.base import User, StudentProfile, Workspace, Task, Job, Application
from app.core.security import get_password_hash

def test_database_user_and_profile_relationship(db_session: Session):
    user = User(
        email="dbuser@nexux.app",
        password_hash=get_password_hash("Pass123!"),
        role="STUDENT"
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    profile = StudentProfile(
        user_id=user.id,
        first_name="Jane",
        last_name="Doe",
        university="MIT",
        degree="B.S. Computer Science"
    )
    db_session.add(profile)
    db_session.commit()
    db_session.refresh(profile)

    assert user.profile is not None
    assert user.profile.first_name == "Jane"
    assert user.profile.university == "MIT"

def test_database_workspace_crud_and_cascade(db_session: Session, test_user: User):
    ws = Workspace(
        name="Machine Learning Workspace",
        description="Notes on neural networks",
        owner_id=test_user.id
    )
    db_session.add(ws)
    db_session.commit()
    db_session.refresh(ws)

    assert ws.id is not None
    assert ws.status == "ACTIVE"

    # Update
    ws.name = "Deep Learning & Neural Networks"
    db_session.commit()
    db_session.refresh(ws)
    assert ws.name == "Deep Learning & Neural Networks"

    # Delete
    db_session.delete(ws)
    db_session.commit()
    found = db_session.query(Workspace).filter(Workspace.id == ws.id).first()
    assert found is None

def test_database_task_crud_and_status(db_session: Session, test_user: User):
    task = Task(
        user_id=test_user.id,
        title="Complete Placement Resume",
        status="PENDING",
        deadline=datetime(2026, 12, 31, 23, 59)
    )
    db_session.add(task)
    db_session.commit()
    db_session.refresh(task)

    assert task.status == "PENDING"
    task.status = "IN_PROGRESS"
    task.started_at = datetime.utcnow()
    db_session.commit()
    db_session.refresh(task)
    assert task.status == "IN_PROGRESS"
    assert task.started_at is not None

def test_database_job_and_application_unique_constraint(db_session: Session, test_user: User):
    job = Job(
        posted_by_id=test_user.id,
        title="Software Engineer Intern",
        company_name="Google",
        description="Great engineering internship"
    )
    db_session.add(job)
    db_session.commit()
    db_session.refresh(job)

    app1 = Application(job_id=job.id, student_id=test_user.id, status="APPLIED")
    db_session.add(app1)
    db_session.commit()

    # Second application for same job and student should violate unique constraint
    app2 = Application(job_id=job.id, student_id=test_user.id, status="APPLIED")
    db_session.add(app2)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()
