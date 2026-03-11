import secrets
import httpx
from fastapi import APIRouter, Depends, HTTPException, Form
from fastapi.responses import RedirectResponse, JSONResponse, HTMLResponse
from app.config import AUTH_URL, AUTH_INTERNAL, APP_URL, APP_TOKEN, DEV_MODE
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


# ── DEV LOGIN (only when DEV_MODE=true) ──

@router.get("/dev-login", response_class=HTMLResponse)
async def dev_login_form():
    if not DEV_MODE:
        raise HTTPException(status_code=404)
    return HTMLResponse("""<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#09090e;color:#c4c7de;font-family:system-ui;display:flex;
       align-items:center;justify-content:center;height:100vh}
  form{border:1.5px solid #2e2e48;border-radius:13px;padding:44px 40px;
       text-align:center;background:#101018;width:300px}
  h2{margin-bottom:24px;letter-spacing:2px;font-size:16px;color:#c4c7de}
  input{display:block;width:100%;padding:11px 14px;margin-bottom:14px;
        background:#1c1c2a;border:1.5px solid #2e2e48;border-radius:8px;
        color:#c4c7de;font-size:14px;outline:none}
  input:focus{border-color:#0a4038}
  button{width:100%;padding:12px;background:#1c1c2a;border:1.5px solid #2e2e48;
         border-radius:8px;color:#c4c7de;font-size:14px;cursor:pointer}
  button:hover{background:#20202e}
  .note{margin-top:14px;font-size:11px;color:#3a3d56}
</style></head><body>
<form method="POST" action="/auth/dev-login">
  <h2>DEV LOGIN</h2>
  <input name="username" placeholder="username" value="dev user" autofocus/>
  <button type="submit">login</button>
  <div class="note">dev mode only</div>
</form>
</body></html>""")


@router.post("/dev-login")
async def dev_login_submit(username: str = Form(default="dev user"), db=Depends(get_db)):
    if not DEV_MODE:
        raise HTTPException(status_code=404)
    name    = username.strip() or "dev user"
    auth_id = "dev_local"

    await db.execute(
        "INSERT INTO users (auth_id, username, user_hash) VALUES (?, ?, ?) ON CONFLICT(auth_id) DO NOTHING",
        (auth_id, name, secrets.token_urlsafe(12)),
    )
    await db.commit()
    await db.execute("UPDATE users SET username = ? WHERE auth_id = ?", (name, auth_id))
    await db.commit()
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
