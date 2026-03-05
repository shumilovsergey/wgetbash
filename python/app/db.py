import aiosqlite
from app.config import DB_PATH


async def get_db():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        yield db


async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript("""
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS users (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                auth_id   TEXT    UNIQUE NOT NULL,
                username  TEXT    NOT NULL DEFAULT '',
                user_hash TEXT    UNIQUE NOT NULL DEFAULT ''
            );

            CREATE TABLE IF NOT EXISTS groups (
                id      INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name    TEXT    NOT NULL
            );

            CREATE TABLE IF NOT EXISTS scripts (
                id       INTEGER PRIMARY KEY AUTOINCREMENT,
                group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
                name     TEXT    NOT NULL DEFAULT '',
                content  TEXT    NOT NULL DEFAULT '',
                hash     TEXT    UNIQUE NOT NULL
            );
        """)
        await db.commit()

        # migration: add user_hash column if missing
        try:
            await db.execute("ALTER TABLE users ADD COLUMN user_hash TEXT NOT NULL DEFAULT ''")
            await db.commit()
        except Exception:
            pass
