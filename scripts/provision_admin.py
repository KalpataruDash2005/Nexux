#!/usr/bin/env python3
"""
Nexora Administrative Account Provisioning Utility.
Used exclusively by DevOps and Operations to securely create or promote an administrator.
Never accessible via public HTTP API routes.
"""

import os
import sys
import argparse
import getpass
import re

# Ensure api directory is in sys.path
repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
api_dir = os.path.join(repo_root, "api")
if api_dir not in sys.path:
    sys.path.insert(0, api_dir)

from app.core.database import SessionLocal, init_db
from app.models.base import User, StudentProfile
from app.core.security import get_password_hash


def validate_password_strength(password: str) -> bool:
    if len(password) < 12:
        return False
    if not re.search(r"[A-Z]", password):
        return False
    if not re.search(r"[a-z]", password):
        return False
    if not re.search(r"[0-9]", password):
        return False
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        return False
    return True


def provision_admin(email: str, password: str, name: str = None) -> bool:
    clean_email = email.strip().lower()
    if "@" not in clean_email or "." not in clean_email:
        print("[ERROR] Invalid email address format.")
        return False

    if not validate_password_strength(password):
        print("[ERROR] Password does not meet enterprise complexity requirements.")
        print("  - Minimum 12 characters")
        print("  - At least one uppercase letter (A-Z)")
        print("  - At least one lowercase letter (a-z)")
        print("  - At least one digit (0-9)")
        print("  - At least one special character (!@#$%^&*...)")
        return False

    init_db()
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == clean_email).first()
        if user:
            print(f"[INFO] User {clean_email} exists with role: {user.role}.")
            user.role = "ADMIN"
            user.password_hash = get_password_hash(password)
            db.commit()
            print(f"[SUCCESS] User {clean_email} successfully promoted to ADMIN with updated password.")
        else:
            new_admin = User(
                email=clean_email,
                password_hash=get_password_hash(password),
                role="ADMIN"
            )
            db.add(new_admin)
            db.commit()
            db.refresh(new_admin)

            if name:
                profile = StudentProfile(
                    user_id=new_admin.id,
                    first_name=name.split()[0],
                    last_name=name.split()[1] if len(name.split()) > 1 else ""
                )
                db.add(profile)
                db.commit()

            print(f"[SUCCESS] Administrative account successfully created: {clean_email}")
        return True
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Failed to provision administrative user: {e}")
        return False
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="Provision or promote an administrator for Nexora.")
    parser.add_argument("--email", help="Admin email address")
    parser.add_argument("--password", help="Admin password (recommended: omit to enter securely)")
    parser.add_argument("--name", help="Admin display name", default="Platform Admin")

    args = parser.parse_args()

    email = args.email or input("Enter Admin Email: ").strip()
    password = args.password
    if not password:
        password = getpass.getpass("Enter Secure Admin Password: ")
        confirm_pwd = getpass.getpass("Confirm Admin Password: ")
        if password != confirm_pwd:
            print("[ERROR] Passwords do not match.")
            sys.exit(1)

    success = provision_admin(email, password, args.name)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
