import secrets
import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse, JSONResponse
from app.config import AUTH_URL, AUTH_INTERNAL, APP_URL, APP_TOKEN
from app.db import get_db
from app.auth import create_token, get_current_user

router = APIRouter(prefix="/auth")


@router.get("/login")
async def login():
    return RedirectResponse(f"{AUTH_URL}/?redirect={APP_URL}/auth/callback")


@router.get("/callback")
async def callback(code: str, db=Depends(get_db)):
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{AUTH_INTERNAL}/exchange",
            json={"code": code, "app_token": APP_TOKEN},
            timeout=5,
        )
    data = resp.json()
    if not data.get("ok"):
        raise HTTPException(status_code=401, detail=data.get("error", "exchange failed"))

    user_data = data["user"]
    auth_id   = str(user_data["id"])
    username  = (
        user_data.get("username")
        or f"{user_data.get('first_name', '')} {user_data.get('last_name', '')}".strip()
        or user_data.get("email", "").split("@")[0]
        or "no name"
    )

    # create user if first login
    await db.execute(
        "INSERT INTO users (auth_id, username, user_hash) VALUES (?, ?, ?) ON CONFLICT(auth_id) DO NOTHING",
        (auth_id, username, secrets.token_urlsafe(12)),
    )
    await db.commit()

    # ensure existing users have a user_hash
    await db.execute(
        "UPDATE users SET user_hash = ? WHERE auth_id = ? AND (user_hash IS NULL OR user_hash = '')",
        (secrets.token_urlsafe(12), auth_id),
    )
    await db.commit()

    async with db.execute("SELECT id FROM users WHERE auth_id = ?", (auth_id,)) as cur:
        user = await cur.fetchone()

    token = create_token(user["id"])
    response = RedirectResponse(f"{APP_URL}/", status_code=302)
    response.set_cookie("token", token, httponly=True, max_age=86400 * 30, samesite="lax")
    return response


@router.get("/me")
async def me(user=Depends(get_current_user)):
    return user


@router.post("/logout")
async def logout():
    response = JSONResponse({"ok": True})
    response.delete_cookie("token")
    return response
