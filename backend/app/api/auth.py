from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DBSession
from app.models.user import User
from app.schemas.auth import LoginRequest, Token
from app.schemas.user import UserResponse
from app.utils.security import create_access_token, verify_password

router = APIRouter()


@router.post("/login", response_model=Token)
async def login(
    credentials: LoginRequest,
    db: DBSession,
) -> Token:
    """Authenticate user and return JWT token."""
    result = await db.execute(select(User).where(User.email == credentials.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
        )

    access_token = create_access_token(data={"sub": user.id, "email": user.email})
    return Token(access_token=access_token)


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: CurrentUser) -> User:
    """Get current authenticated user info."""
    return current_user
