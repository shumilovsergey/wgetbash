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

First time — create `go/.env` from the example and fill in your values:
```bash
cp go/.env.example go/.env
```

Then start:
```bash
docker-compose -f go/docker-compose.dev.yml up --build
```

Open http://localhost:8000

Air watches for changes in `go/*.go` and rebuilds automatically.

## Prod — build Linux binary (Intel x86-64)

```bash
docker build --platform linux/amd64 --target binary --output go/bin/ -f go/Dockerfile .
```

Outputs `go/bin/wgetbash` — a static binary ready to copy to the server.

