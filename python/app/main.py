from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.db import init_db
from app.routers import auth, groups, scripts, public, users
from app.config import APP_URL


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[APP_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(groups.router)
app.include_router(scripts.router)
app.include_router(public.router)

@app.get("/")
async def index():
    return FileResponse("/app/static/index.html")

app.mount("/", StaticFiles(directory="/app/static"), name="static")
