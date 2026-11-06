import re
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator

def validate_password_complexity(v: str) -> str:
    if len(v) < 8:
        raise ValueError("Password must be at least 8 characters long.")
    if not re.search(r"[a-z]", v):
        raise ValueError("Password must contain at least one lowercase letter.")
    if not re.search(r"[A-Z]", v):
        raise ValueError("Password must contain at least one uppercase letter.")
    if not re.search(r"\d", v):
        raise ValueError("Password must contain at least one number.")
    if not re.search(r"[^a-zA-Z0-9]", v):
        raise ValueError("Password must contain at least one special character.")
    return v

class RegisterRequestDto(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, description="Password must be at least 8 characters")
    role: Optional[str] = "STUDENT"
    name: Optional[str] = None

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        return validate_password_complexity(v)

class AuthRequestDto(BaseModel):
    email: EmailStr
    password: str

class AuthResponseDto(BaseModel):
    token: str
    type: str = "Bearer"
    email: str
    role: str
    name: Optional[str] = None

class LogoutResponseDto(BaseModel):
    message: str = "Logged out successfully"
    status: str = "LOGGED_OUT"

class ChangePasswordRequestDto(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, description="New password must be at least 8 characters")

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        return validate_password_complexity(v)
