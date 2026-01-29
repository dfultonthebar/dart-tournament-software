from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from uuid import UUID

from backend.core import get_db, verify_password, get_password_hash, create_access_token, decode_access_token
from backend.models import Player, Admin
from backend.schemas import (
    Token,
    LoginRequest,
    RegisterRequest,
    PlayerResponse,
    PasswordChange,
    PinLoginRequest,
    PlayerRegisterRequest,
    AdminLoginRequest,
    AdminResponse,
    AdminCreate,
)

router = APIRouter(prefix="/auth", tags=["authentication"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


async def get_current_player(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> Player:
    """Dependency to get current authenticated player."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    player_id: Optional[str] = payload.get("sub")
    if player_id is None:
        raise credentials_exception

    try:
        player_uuid = UUID(player_id)
    except ValueError:
        raise credentials_exception

    result = await db.execute(select(Player).where(Player.id == player_uuid))
    player = result.scalar_one_or_none()

    if player is None:
        raise credentials_exception

    if not player.is_active:
        raise HTTPException(status_code=400, detail="Inactive player")

    return player


async def get_current_admin(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> Admin:
    """Dependency to get current authenticated admin."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    # Check if this is an admin token
    if payload.get("type") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    admin_id: Optional[str] = payload.get("sub")
    if admin_id is None:
        raise credentials_exception

    try:
        admin_uuid = UUID(admin_id)
    except ValueError:
        raise credentials_exception

    result = await db.execute(select(Admin).where(Admin.id == admin_uuid))
    admin = result.scalar_one_or_none()

    if admin is None:
        raise credentials_exception

    if not admin.is_active:
        raise HTTPException(status_code=400, detail="Inactive admin")

    return admin


async def get_current_admin_or_player(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
):
    """Dependency that accepts either admin or player token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    user_id: Optional[str] = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    try:
        user_uuid = UUID(user_id)
    except ValueError:
        raise credentials_exception

    token_type = payload.get("type", "player")

    if token_type == "admin":
        result = await db.execute(select(Admin).where(Admin.id == user_uuid))
        admin = result.scalar_one_or_none()
        if admin and admin.is_active:
            return admin
    else:
        result = await db.execute(select(Player).where(Player.id == user_uuid))
        player = result.scalar_one_or_none()
        if player and player.is_active:
            return player

    raise credentials_exception


@router.post("/register", response_model=PlayerResponse, status_code=status.HTTP_201_CREATED)
async def register(
    request: RegisterRequest,
    db: AsyncSession = Depends(get_db)
):
    """Register a new player."""
    # Check if email already exists
    result = await db.execute(select(Player).where(Player.email == request.email))
    existing_player = result.scalar_one_or_none()

    if existing_player:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Create new player
    hashed_password = get_password_hash(request.password)
    new_player = Player(
        name=request.name,
        email=request.email,
        phone=request.phone,
        hashed_password=hashed_password,
    )

    db.add(new_player)
    await db.flush()
    await db.refresh(new_player)

    return new_player


@router.post("/player-register", response_model=PlayerResponse, status_code=status.HTTP_201_CREATED)
async def player_register(
    request: PlayerRegisterRequest,
    db: AsyncSession = Depends(get_db)
):
    """Register a new player with PIN (simpler registration for tournaments)."""
    # Check if email already exists
    result = await db.execute(select(Player).where(Player.email == request.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Check if phone already exists
    result = await db.execute(select(Player).where(Player.phone == request.phone))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone number already registered"
        )

    # Check if name + PIN combination is unique enough (warn if name exists)
    result = await db.execute(select(Player).where(Player.name.ilike(request.name)))
    existing_name = result.scalar_one_or_none()
    if existing_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A player with this name already exists. Please use a different name or add your last initial."
        )

    # Create new player
    new_player = Player(
        name=request.name,
        email=request.email,
        phone=request.phone,
        pin=request.pin,
        marketing_opt_in=request.marketing_opt_in,
        gender=request.gender,
    )

    db.add(new_player)
    await db.flush()
    await db.refresh(new_player)

    return new_player


@router.post("/login", response_model=Token)
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """Login with email and password."""
    result = await db.execute(select(Player).where(Player.email == request.email))
    player = result.scalar_one_or_none()

    if not player or not verify_password(request.password, player.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not player.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account is inactive"
        )

    access_token = create_access_token(data={"sub": str(player.id), "email": player.email})

    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/pin-login", response_model=Token)
async def pin_login(
    request: PinLoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """Login with player name and 4-digit PIN."""
    # Find player by name (case-insensitive)
    result = await db.execute(
        select(Player).where(Player.name.ilike(request.name))
    )
    player = result.scalar_one_or_none()

    if not player:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Player not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not player.pin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="PIN not set for this player. Please contact admin.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if player.pin != request.pin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect PIN",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not player.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account is inactive"
        )

    access_token = create_access_token(data={"sub": str(player.id), "email": player.email, "type": "player"})

    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/admin-login", response_model=Token)
async def admin_login(
    request: AdminLoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """Login as admin with name and 4-digit PIN."""
    # Find admin by name (case-insensitive)
    result = await db.execute(
        select(Admin).where(Admin.name.ilike(request.name))
    )
    admin = result.scalar_one_or_none()

    if not admin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not admin.pin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="PIN not set for this admin.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if admin.pin != request.pin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect PIN",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not admin.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin account is inactive"
        )

    access_token = create_access_token(data={
        "sub": str(admin.id),
        "email": admin.email,
        "type": "admin",
        "is_super_admin": admin.is_super_admin
    })

    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/token", response_model=Token)
async def token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """OAuth2 compatible token endpoint."""
    result = await db.execute(select(Player).where(Player.email == form_data.username))
    player = result.scalar_one_or_none()

    if not player or not verify_password(form_data.password, player.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not player.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account is inactive"
        )

    access_token = create_access_token(data={"sub": str(player.id), "email": player.email})

    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=PlayerResponse)
async def get_me(current_player: Player = Depends(get_current_player)):
    """Get current player information."""
    return current_player


@router.post("/change-password")
async def change_password(
    request: PasswordChange,
    current_player: Player = Depends(get_current_player),
    db: AsyncSession = Depends(get_db)
):
    """Change player password."""
    if not verify_password(request.current_password, current_player.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password"
        )

    current_player.hashed_password = get_password_hash(request.new_password)
    await db.flush()

    return {"message": "Password updated successfully"}


@router.post("/set-pin")
async def set_pin(
    pin: str,
    current_player: Player = Depends(get_current_player),
    db: AsyncSession = Depends(get_db)
):
    """Set or update the current player's 4-digit PIN."""
    if not pin or len(pin) != 4 or not pin.isdigit():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PIN must be exactly 4 digits"
        )

    current_player.pin = pin
    await db.flush()

    return {"message": "PIN set successfully"}


# Admin management endpoints
@router.post("/admins", response_model=AdminResponse, status_code=status.HTTP_201_CREATED)
async def create_admin(
    admin_data: AdminCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new admin. First admin created becomes super admin."""
    # Check if any admins exist
    result = await db.execute(select(Admin))
    existing_admins = result.scalars().all()

    # First admin is always super admin
    is_first_admin = len(existing_admins) == 0

    # Check if name already exists
    result = await db.execute(select(Admin).where(Admin.name.ilike(admin_data.name)))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin with this name already exists"
        )

    hashed_password = None
    if admin_data.password:
        hashed_password = get_password_hash(admin_data.password)

    new_admin = Admin(
        name=admin_data.name,
        email=admin_data.email,
        pin=admin_data.pin,
        hashed_password=hashed_password,
        is_super_admin=is_first_admin or admin_data.is_super_admin,
    )

    db.add(new_admin)
    await db.flush()
    await db.refresh(new_admin)

    return new_admin


@router.get("/admins", response_model=list[AdminResponse])
async def list_admins(
    current_admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """List all admins (admin only)."""
    result = await db.execute(select(Admin).order_by(Admin.name))
    admins = result.scalars().all()
    return admins


@router.get("/admin/me", response_model=AdminResponse)
async def get_admin_me(current_admin: Admin = Depends(get_current_admin)):
    """Get current admin information."""
    return current_admin
