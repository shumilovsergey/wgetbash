from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.db import get_db
from app.auth import get_current_user

router = APIRouter(prefix="/api/groups")


class GroupIn(BaseModel):
    name: str


async def own_group(group_id: int, user_id: int, db):
    async with db.execute(
        "SELECT id FROM groups WHERE id = ? AND user_id = ?", (group_id, user_id)
    ) as cur:
        if not await cur.fetchone():
            raise HTTPException(status_code=404)


@router.get("")
async def list_groups(user=Depends(get_current_user), db=Depends(get_db)):
    async with db.execute(
        """
        SELECT g.id, g.name, COUNT(s.id) AS script_count
        FROM groups g
        LEFT JOIN scripts s ON s.group_id = g.id
        WHERE g.user_id = ?
        GROUP BY g.id
        ORDER BY g.id
        """,
        (user["id"],),
    ) as cur:
        rows = await cur.fetchall()
    return [dict(r) for r in rows]


@router.post("")
async def create_group(body: GroupIn, user=Depends(get_current_user), db=Depends(get_db)):
    name = body.name.strip()
    cur = await db.execute(
        "INSERT INTO groups (user_id, name) VALUES (?, ?)", (user["id"], name)
    )
    await db.commit()
    return {"id": cur.lastrowid, "name": name, "script_count": 0}


@router.put("/{group_id}")
async def update_group(group_id: int, body: GroupIn, user=Depends(get_current_user), db=Depends(get_db)):
    await own_group(group_id, user["id"], db)
    await db.execute("UPDATE groups SET name = ? WHERE id = ?", (body.name.strip(), group_id))
    await db.commit()
    return {"ok": True}


@router.delete("/{group_id}")
async def delete_group(group_id: int, user=Depends(get_current_user), db=Depends(get_db)):
    await own_group(group_id, user["id"], db)
    await db.execute("DELETE FROM groups WHERE id = ?", (group_id,))
    await db.commit()
    return {"ok": True}
