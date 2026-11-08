from typing import Optional
from pydantic import BaseModel, EmailStr, Field

class RegisterRequestDto(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, description="Password must be at least 6 characters")
    role: Optional[str] = "STUDENT"
    name: Optional[str] = None

class AuthRequestDto(BaseModel):
    email: EmailStr
    password: str

class AuthResponseDto(BaseModel):
    token: str
    type: str = "Bearer"
    email: str
    role: str
    name: Optional[str] = None
    message: Optional[str] = None
