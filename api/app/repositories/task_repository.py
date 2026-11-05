from datetime import datetime
from typing import Optional, List, Dict
from sqlalchemy import func, case
from sqlalchemy.orm import Session
from app.models.base import Task, AiConversation, AiMemory

class TaskRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id_and_user(self, task_id: str, user_id: str) -> Optional[Task]:
        return self.db.query(Task).filter(
            Task.id == task_id,
            Task.user_id == user_id
        ).first()

    def get_all_by_user(self, user_id: str, status: Optional[str] = None, limit: int = 50, offset: int = 0) -> List[Task]:
        q = self.db.query(Task).filter(Task.user_id == user_id)
        if status:
            q = q.filter(Task.status == status.upper())
        return q.order_by(Task.created_at.desc()).offset(offset).limit(min(limit, 100)).all()

    def create(self, task: Task) -> Task:
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        return task

    def update(self, task: Task) -> Task:
        self.db.commit()
        self.db.refresh(task)
        return task

    def delete(self, task: Task):
        self.db.delete(task)
        self.db.commit()

    def get_summary(self, user_id: str) -> Dict[str, int]:
        """
        Calculates task metrics using SQL aggregate expressions (func.count and case),
        avoiding in-memory object loading and scaling efficiently to thousands of tasks.
        """
        now = datetime.utcnow()
        row = (
            self.db.query(
                func.count(Task.id),
                func.count(case((Task.status == "COMPLETED", Task.id))),
                func.count(case((Task.status != "COMPLETED", Task.id))),
                func.count(case(((Task.status != "COMPLETED") & (Task.deadline != None) & (Task.deadline < now), Task.id)))
            )
            .filter(Task.user_id == user_id)
            .first()
        )
        return {
            "total": int(row[0] or 0),
            "completed": int(row[1] or 0),
            "pending": int(row[2] or 0),
            "overdue": int(row[3] or 0)
        }

    def save_conversation(self, conv: AiConversation) -> AiConversation:
        self.db.add(conv)
        self.db.commit()
        self.db.refresh(conv)
        return conv

    def get_conversation_history(self, user_id: str, limit: int = 20) -> List[AiConversation]:
        return self.db.query(AiConversation).filter(
            AiConversation.user_id == user_id
        ).order_by(AiConversation.created_at.desc()).limit(limit).all()

    def get_memories(self, user_id: str) -> Dict[str, str]:
        rows = self.db.query(AiMemory).filter(AiMemory.user_id == user_id).all()
        return {r.mem_key: r.mem_value for r in rows}

    def set_memory(self, user_id: str, key: str, value: str):
        existing = self.db.query(AiMemory).filter(
            AiMemory.user_id == user_id,
            AiMemory.mem_key == key
        ).first()
        if existing:
            existing.mem_value = value
            existing.updated_at = datetime.utcnow()
        else:
            self.db.add(AiMemory(user_id=user_id, mem_key=key, mem_value=value))
        self.db.commit()
