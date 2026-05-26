# wgetbash
🧩

## Security

Session cookie is `HttpOnly` — JS cannot read it. It's a signed JWT (HMAC-SHA256):

```
Browser → sends cookie automatically (never readable by JS)
Server  → validates JWT signature with SECRET_KEY
        → rejects any tampered token with 401
```

```
Login → OAuth callback → server issues signed JWT → HttpOnly cookie
                                    ↓
                         user_id inside JWT is tamper-proof:
                         changing it breaks the signature → 401
```

## Dev (macOS ARM)

Requires Docker Desktop.

First time — create `.env` from the example and fill in your values:
```bash
cp .env.example .env
```

Then start:
```bash
docker compose -f dev-compose.yml up --build
```

Open http://localhost:8000

Air watches for changes in `build/*.go` and `build/static/` and rebuilds automatically.

## Prod — build Linux binary (Intel x86-64)

```bash
docker compose -f prod-compose.yml up --build
```

Outputs `bin/wgetbash` — a static binary ready to copy to the server.

