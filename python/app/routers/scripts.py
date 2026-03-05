import secrets
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.db import get_db
from app.auth import get_current_user

router = APIRouter()


class ScriptIn(BaseModel):
    name: str = ""
    content: str = ""


async def own_script(script_id: int, user_id: int, db):
    async with db.execute(
        """
        SELECT s.id FROM scripts s
        JOIN groups g ON g.id = s.group_id
        WHERE s.id = ? AND g.user_id = ?
        """,
        (script_id, user_id),
    ) as cur:
        if not await cur.fetchone():
            raise HTTPException(status_code=404)


async def own_group(group_id: int, user_id: int, db):
    async with db.execute(
        "SELECT id FROM groups WHERE id = ? AND user_id = ?", (group_id, user_id)
    ) as cur:
        if not await cur.fetchone():
            raise HTTPException(status_code=404)


@router.get("/api/groups/{group_id}/scripts")
async def list_scripts(group_id: int, user=Depends(get_current_user), db=Depends(get_db)):
    await own_group(group_id, user["id"], db)
    async with db.execute(
        "SELECT id, name, content, hash FROM scripts WHERE group_id = ? ORDER BY id",
        (group_id,),
    ) as cur:
        rows = await cur.fetchall()
    return [dict(r) for r in rows]


@router.post("/api/groups/{group_id}/scripts")
async def create_script(group_id: int, body: ScriptIn, user=Depends(get_current_user), db=Depends(get_db)):
    await own_group(group_id, user["id"], db)
    hash_ = secrets.token_urlsafe(12)
    cur = await db.execute(
        "INSERT INTO scripts (group_id, name, content, hash) VALUES (?, ?, ?, ?)",
        (group_id, body.name.strip(), body.content, hash_),
    )
    await db.commit()
    return {"id": cur.lastrowid, "name": body.name.strip(), "content": body.content, "hash": hash_}


@router.put("/api/scripts/{script_id}")
async def update_script(script_id: int, body: ScriptIn, user=Depends(get_current_user), db=Depends(get_db)):
    await own_script(script_id, user["id"], db)
    await db.execute(
        "UPDATE scripts SET name = ?, content = ? WHERE id = ?",
        (body.name.strip(), body.content, script_id),
    )
    await db.commit()
    return {"ok": True}


@router.delete("/api/scripts/{script_id}")
async def delete_script(script_id: int, user=Depends(get_current_user), db=Depends(get_db)):
    await own_script(script_id, user["id"], db)
    await db.execute("DELETE FROM scripts WHERE id = ?", (script_id,))
    await db.commit()
    return {"ok": True}
