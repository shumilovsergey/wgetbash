from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.db import get_db
from app.auth import get_current_user

router = APIRouter(prefix="/api/users")


class UsernameIn(BaseModel):
    username: str


@router.put("/me")
async def update_username(body: UsernameIn, user=Depends(get_current_user), db=Depends(get_db)):
    name = body.username.strip() or "no name"
    await db.execute("UPDATE users SET username = ? WHERE id = ?", (name, user["id"]))
    await db.commit()
    return {"ok": True, "username": name}
