import jwt
from datetime import datetime, timedelta, timezone
from fastapi import Request, HTTPException, Depends
from app.config import SECRET_KEY
from app.db import get_db

ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 30


def create_token(user_id: int) -> str:
    payload = {
        "sub": str(user_id),
        "exp": datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(request: Request, db=Depends(get_db)):
    token = request.cookies.get("token")
    if not token:
        raise HTTPException(status_code=401, detail="not authenticated")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload["sub"])
    except Exception:
        raise HTTPException(status_code=401, detail="invalid token")

    async with db.execute("SELECT * FROM users WHERE id = ?", (user_id,)) as cur:
        user = await cur.fetchone()
    if not user:
        raise HTTPException(status_code=401, detail="user not found")
    return dict(user)
